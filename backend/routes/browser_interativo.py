"""
Rotas para Browser Interativo - Login Uber com CAPTCHA
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import asyncio

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/browser", tags=["Browser Interativo"])
db = get_database()


async def get_uber_credentials(parceiro_id: str) -> dict:
    """
    Obter credenciais Uber do parceiro.
    Tenta primeiro credenciais_uber, depois credenciais_plataformas.
    """
    # 1. Tentar colecção dedicada credenciais_uber
    cred = await db.credenciais_uber.find_one({"parceiro_id": parceiro_id}, {"_id": 0})
    
    if cred and cred.get("email"):
        return cred
    
    # 2. Fallback para credenciais_plataformas
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0, "credenciais_plataformas": 1})
    if not parceiro:
        parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0, "credenciais_plataformas": 1})
    
    if parceiro and parceiro.get("credenciais_plataformas"):
        cp = parceiro["credenciais_plataformas"]
        return {
            "email": cp.get("uber_email"),
            "password": cp.get("uber_password"),
            "telefone": cp.get("uber_telefone")
        }
    
    return {}


class AcaoMouse(BaseModel):
    x: int
    y: int


class AcaoTeclado(BaseModel):
    texto: Optional[str] = None
    tecla: Optional[str] = None  # Enter, Tab, Escape, etc


@router.post("/iniciar")
async def iniciar_browser_uber(
    current_user: dict = Depends(get_current_user)
):
    """Iniciar browser e navegar para Uber Fleet"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo import get_browser
        
        # Buscar credenciais guardadas (usa função centralizada)
        cred = await get_uber_credentials(parceiro_id)
        
        browser = await get_browser(parceiro_id)
        await browser.navegar("https://auth.uber.com/v2/?next_url=https%3A%2F%2Fsupplier.uber.com%2F")
        
        await asyncio.sleep(2)
        
        # Se tiver credenciais, preencher email automaticamente
        if cred and cred.get("email"):
            email = cred["email"]
            # Clicar no campo de email
            email_field = browser.page.locator('input[name="email"], input[type="email"], input[type="text"]').first
            if await email_field.count() > 0:
                await email_field.click()
                await asyncio.sleep(0.3)
                await email_field.fill(email)
                logger.info(f"Email preenchido automaticamente: {email}")
        
        screenshot = await browser.screenshot()
        
        return {
            "sucesso": True,
            "screenshot": screenshot,
            "mensagem": "Browser iniciado - email preenchido automaticamente"
        }
        
    except Exception as e:
        logger.error(f"Erro ao iniciar browser: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/screenshot")
async def obter_screenshot(
    current_user: dict = Depends(get_current_user)
):
    """Obter screenshot atual do browser"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo import browsers_ativos
        
        if parceiro_id not in browsers_ativos:
            return {"sucesso": False, "erro": "Browser não iniciado"}
            
        browser = browsers_ativos[parceiro_id]
        screenshot = await browser.screenshot()
        status = await browser.verificar_login()
        
        return {
            "sucesso": True,
            "screenshot": screenshot,
            "logado": status.get("logado", False),
            "url": status.get("url", "")
        }
        
    except Exception as e:
        logger.error(f"Erro no screenshot: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/clicar")
async def clicar_browser(
    acao: AcaoMouse,
    current_user: dict = Depends(get_current_user)
):
    """Clicar numa posição do browser"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo import browsers_ativos
        
        if parceiro_id not in browsers_ativos:
            return {"sucesso": False, "erro": "Browser não iniciado"}
            
        browser = browsers_ativos[parceiro_id]
        await browser.clicar(acao.x, acao.y)
        await asyncio.sleep(0.5)
        
        screenshot = await browser.screenshot()
        status = await browser.verificar_login()
        
        return {
            "sucesso": True,
            "screenshot": screenshot,
            "logado": status.get("logado", False)
        }
        
    except Exception as e:
        logger.error(f"Erro ao clicar: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/escrever")
async def escrever_browser(
    acao: AcaoTeclado,
    current_user: dict = Depends(get_current_user)
):
    """Escrever texto ou pressionar tecla no browser"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo import browsers_ativos
        
        if parceiro_id not in browsers_ativos:
            return {"sucesso": False, "erro": "Browser não iniciado"}
            
        browser = browsers_ativos[parceiro_id]
        
        if acao.texto:
            await browser.escrever(acao.texto)
        if acao.tecla:
            await browser.tecla(acao.tecla)
            
        await asyncio.sleep(0.5)
        
        screenshot = await browser.screenshot()
        status = await browser.verificar_login()
        
        return {
            "sucesso": True,
            "screenshot": screenshot,
            "logado": status.get("logado", False)
        }
        
    except Exception as e:
        logger.error(f"Erro ao escrever: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/preencher-email")
async def preencher_email_browser(
    current_user: dict = Depends(get_current_user)
):
    """Preencher email automaticamente no campo de login"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo import browsers_ativos
        
        if parceiro_id not in browsers_ativos:
            return {"sucesso": False, "erro": "Browser não iniciado"}
        
        # Buscar credenciais (usa função centralizada)
        cred = await get_uber_credentials(parceiro_id)
        if not cred or not cred.get("email"):
            return {"sucesso": False, "erro": "Email não configurado"}
        
        browser = browsers_ativos[parceiro_id]
        email = cred["email"]
        
        # Preencher email
        email_field = browser.page.locator('input[name="email"], input[type="email"], input[type="text"], input[id*="email"], input[id*="PHONE"]').first
        if await email_field.count() > 0:
            await email_field.click()
            await asyncio.sleep(0.3)
            await email_field.fill(email)
            await asyncio.sleep(0.5)
            
            screenshot = await browser.screenshot()
            return {
                "sucesso": True,
                "screenshot": screenshot,
                "mensagem": f"Email preenchido: {email}"
            }
        else:
            return {"sucesso": False, "erro": "Campo de email não encontrado"}
        
    except Exception as e:
        logger.error(f"Erro ao preencher email: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/preencher-password")
async def preencher_password_browser(
    current_user: dict = Depends(get_current_user)
):
    """Preencher password automaticamente"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo import browsers_ativos
        
        if parceiro_id not in browsers_ativos:
            return {"sucesso": False, "erro": "Browser não iniciado"}
        
        # Buscar credenciais (usa função centralizada)
        cred = await get_uber_credentials(parceiro_id)
        if not cred or not cred.get("password"):
            return {"sucesso": False, "erro": "Password não configurada"}
        
        browser = browsers_ativos[parceiro_id]
        password = cred["password"]
        
        # Preencher password
        pwd_field = browser.page.locator('input[name="password"], input[type="password"]').first
        if await pwd_field.count() > 0:
            await pwd_field.click()
            await asyncio.sleep(0.3)
            await pwd_field.fill(password)
            await asyncio.sleep(0.5)
            
            screenshot = await browser.screenshot()
            return {
                "sucesso": True,
                "screenshot": screenshot,
                "mensagem": "Password preenchida"
            }
        else:
            return {"sucesso": False, "erro": "Campo de password não encontrado"}
        
    except Exception as e:
        logger.error(f"Erro ao preencher password: {e}")
        return {"sucesso": False, "erro": str(e)}



class CodigoSMS(BaseModel):
    codigo: str


@router.post("/preencher-sms")
async def preencher_sms_browser(
    data: CodigoSMS,
    current_user: dict = Depends(get_current_user)
):
    """Preencher código SMS nos campos de 4 dígitos da Uber"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo import browsers_ativos
        
        if parceiro_id not in browsers_ativos:
            return {"sucesso": False, "erro": "Browser não iniciado"}
        
        browser = browsers_ativos[parceiro_id]
        codigo = data.codigo.replace(" ", "")[:4]  # Limpar e limitar a 4 dígitos
        
        if len(codigo) != 4 or not codigo.isdigit():
            return {"sucesso": False, "erro": "Código deve ter 4 dígitos numéricos"}
        
        # Estratégia 1: Procurar campos de input para SMS (4 campos separados ou 1 campo único)
        page = browser.page
        
        # Procurar todos os inputs visíveis
        all_inputs = await page.locator('input').all()
        sms_inputs = []
        
        for inp in all_inputs:
            try:
                if await inp.is_visible():
                    input_type = await inp.get_attribute('type') or 'text'
                    if input_type in ['text', 'tel', 'number', 'password']:
                        box = await inp.bounding_box()
                        if box:
                            # Campos de dígito são geralmente pequenos
                            if box['width'] < 100 and box['height'] < 80:
                                sms_inputs.append(inp)
            except Exception:
                continue
        
        logger.info(f"Encontrados {len(sms_inputs)} campos potenciais para SMS")
        
        if len(sms_inputs) >= 4:
            # 4 campos separados - inserir um dígito em cada
            logger.info(f"A preencher 4 campos separados com código: {codigo}")
            for i, digit in enumerate(codigo):
                if i < len(sms_inputs):
                    await sms_inputs[i].click()
                    await asyncio.sleep(0.1)
                    await sms_inputs[i].fill(digit)
                    await asyncio.sleep(0.2)
            
            await asyncio.sleep(0.5)
            screenshot = await browser.screenshot()
            
            return {
                "sucesso": True,
                "screenshot": screenshot,
                "mensagem": f"Código {codigo} inserido nos 4 campos"
            }
        
        elif len(sms_inputs) >= 1:
            # Campo único
            logger.info(f"A preencher campo único com código: {codigo}")
            await sms_inputs[0].click()
            await asyncio.sleep(0.1)
            await sms_inputs[0].fill(codigo)
            
            await asyncio.sleep(0.5)
            screenshot = await browser.screenshot()
            
            return {
                "sucesso": True,
                "screenshot": screenshot,
                "mensagem": f"Código {codigo} inserido no campo"
            }
        
        else:
            # Fallback: digitar diretamente
            logger.info(f"Nenhum campo encontrado, a digitar código diretamente: {codigo}")
            await page.keyboard.type(codigo, delay=100)
            
            await asyncio.sleep(0.5)
            screenshot = await browser.screenshot()
            
            return {
                "sucesso": True,
                "screenshot": screenshot,
                "mensagem": f"Código {codigo} digitado"
            }
        
    except Exception as e:
        logger.error(f"Erro ao preencher SMS: {e}")
        return {"sucesso": False, "erro": str(e)}



@router.post("/verificar-login")
async def verificar_login_browser(
    current_user: dict = Depends(get_current_user)
):
    """Verificar se está logado e guardar sessão"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo import browsers_ativos
        
        if parceiro_id not in browsers_ativos:
            return {"sucesso": False, "erro": "Browser não iniciado"}
            
        browser = browsers_ativos[parceiro_id]
        status = await browser.verificar_login()
        
        if status.get("logado"):
            await browser.guardar_sessao()
            return {
                "sucesso": True,
                "logado": True,
                "mensagem": "Login confirmado! Sessão guardada."
            }
        else:
            return {
                "sucesso": True,
                "logado": False,
                "mensagem": "Ainda não está logado. Continue o processo de login."
            }
        
    except Exception as e:
        logger.error(f"Erro ao verificar login: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/extrair")
async def extrair_rendimentos_browser(
    current_user: dict = Depends(get_current_user)
):
    """Extrair rendimentos após login"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo import browsers_ativos
        from datetime import datetime, timezone
        
        if parceiro_id not in browsers_ativos:
            return {"sucesso": False, "erro": "Browser não iniciado"}
            
        browser = browsers_ativos[parceiro_id]
        
        # Verificar login primeiro
        status = await browser.verificar_login()
        if not status.get("logado"):
            return {"sucesso": False, "erro": "Faça login primeiro"}
            
        # Extrair rendimentos
        resultado = await browser.extrair_rendimentos()
        
        if resultado.get("sucesso"):
            # Guardar na base de dados
            now = datetime.now(timezone.utc)
            from datetime import timedelta
            import uuid
            
            motoristas_importados = resultado.get("motoristas", [])
            
            # Calcular período (última semana)
            hoje = datetime.now()
            periodo_fim = hoje.strftime('%Y-%m-%d')
            periodo_inicio = (hoje - timedelta(days=7)).strftime('%Y-%m-%d')
            
            # Guardar cada motorista em ganhos_uber (para o resumo semanal)
            for mot in motoristas_importados:
                nome_motorista = mot.get("nome", "")
                
                # Tentar encontrar motorista na base de dados
                motorista_db = await db.motoristas.find_one({
                    "$or": [
                        {"nome": {"$regex": nome_motorista, "$options": "i"}},
                        {"name": {"$regex": nome_motorista, "$options": "i"}}
                    ]
                })
                
                motorista_id = motorista_db.get("id") if motorista_db else None
                
                ganho = {
                    "id": str(uuid.uuid4()),
                    "motorista_id": motorista_id,
                    "nome_motorista": nome_motorista,
                    "parceiro_id": parceiro_id,
                    "periodo_inicio": periodo_inicio,
                    "periodo_fim": periodo_fim,
                    "pago_total": mot.get("rendimentos_liquidos", 0),
                    "rendimentos_total": mot.get("rendimentos_totais", 0),
                    "reembolsos": mot.get("reembolsos", 0),
                    "ajustes": mot.get("ajustes", 0),
                    "data_importacao": now,
                    "importado_por": current_user["id"],
                    "fonte": "browser_interativo"
                }
                
                await db.ganhos_uber.insert_one(ganho)
            
            # Guardar resumo em importacoes_uber
            await db.importacoes_uber.insert_one({
                "parceiro_id": parceiro_id,
                "periodo_inicio": periodo_inicio,
                "periodo_fim": periodo_fim,
                "motoristas": motoristas_importados,
                "total_motoristas": resultado.get("total_motoristas", 0),
                "total_rendimentos": resultado.get("total_rendimentos", 0),
                "ficheiro_csv": resultado.get("ficheiro"),
                "tipo": "browser_interativo",
                "created_at": now.isoformat(),
                "created_by": current_user["id"]
            })
            
            logger.info(f"Importados {len(motoristas_importados)} motoristas para ganhos_uber")
            
            # Guardar sessão
            await browser.guardar_sessao()
        
        return resultado
        
    except Exception as e:
        logger.error(f"Erro na extração: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/fechar")
async def fechar_browser_uber(
    current_user: dict = Depends(get_current_user)
):
    """Fechar browser"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo import fechar_browser
        
        await fechar_browser(parceiro_id)
        
        return {"sucesso": True, "mensagem": "Browser fechado"}
        
    except Exception as e:
        logger.error(f"Erro ao fechar browser: {e}")
        return {"sucesso": False, "erro": str(e)}
