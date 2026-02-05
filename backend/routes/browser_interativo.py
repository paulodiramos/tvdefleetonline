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
        
        # Buscar credenciais guardadas
        cred = await db.credenciais_uber.find_one({"parceiro_id": parceiro_id})
        
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
        
        # Buscar credenciais
        cred = await db.credenciais_uber.find_one({"parceiro_id": parceiro_id})
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
        
        # Buscar credenciais
        cred = await db.credenciais_uber.find_one({"parceiro_id": parceiro_id})
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
            
            await db.importacoes_uber.insert_one({
                "parceiro_id": parceiro_id,
                "data_inicio": now.strftime('%Y-%m-%d'),
                "data_fim": now.strftime('%Y-%m-%d'),
                "motoristas": resultado.get("motoristas", []),
                "total_motoristas": resultado.get("total_motoristas", 0),
                "total_rendimentos": resultado.get("total_rendimentos", 0),
                "ficheiro_csv": resultado.get("ficheiro"),
                "tipo": "extracao_automatica",
                "created_at": now.isoformat(),
                "created_by": current_user["id"]
            })
            
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
