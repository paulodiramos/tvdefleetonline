"""
Rotas para Configuração e RPA Uber
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import logging
import os

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rpa/uber", tags=["RPA Uber"])
db = get_database()


class CredenciaisUber(BaseModel):
    email: str
    password: str
    telefone: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class SMSConfirmRequest(BaseModel):
    codigo: str


@router.get("/credenciais/{parceiro_id}")
async def get_credenciais_uber(
    parceiro_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter credenciais Uber de um parceiro"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    cred = await db.credenciais_plataforma.find_one(
        {"parceiro_id": parceiro_id, "plataforma": "uber"},
        {"_id": 0, "password": 0}  # Não retornar password
    )
    
    if not cred:
        return None
    
    return {
        "email": cred.get("email"),
        "telefone": cred.get("telefone"),
        "ativo": cred.get("ativo", False)
    }


@router.post("/credenciais/{parceiro_id}")
async def salvar_credenciais_uber(
    parceiro_id: str,
    data: CredenciaisUber,
    current_user: dict = Depends(get_current_user)
):
    """Salvar credenciais Uber de um parceiro"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    now = datetime.now(timezone.utc)
    
    await db.credenciais_plataforma.update_one(
        {"parceiro_id": parceiro_id, "plataforma": "uber"},
        {"$set": {
            "email": data.email,
            "password": data.password,
            "telefone": data.telefone,
            "ativo": True,
            "updated_at": now.isoformat()
        },
        "$setOnInsert": {
            "parceiro_id": parceiro_id,
            "plataforma": "uber",
            "created_at": now.isoformat()
        }},
        upsert=True
    )
    
    return {"sucesso": True, "mensagem": "Credenciais guardadas"}


@router.get("/sessao-status/{parceiro_id}")
async def get_sessao_status(
    parceiro_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Verificar se há sessão Uber ativa para o parceiro"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Verificar se existe ficheiro de sessão
    sessao_path = f"/tmp/uber_sessao_{parceiro_id}.json"
    
    if os.path.exists(sessao_path):
        # Verificar idade do ficheiro
        mtime = os.path.getmtime(sessao_path)
        idade_dias = (datetime.now().timestamp() - mtime) / 86400
        
        if idade_dias < 30:  # Sessão válida por 30 dias
            expira = datetime.fromtimestamp(mtime + (30 * 86400))
            return {
                "valida": True,
                "expira": expira.isoformat(),
                "idade_dias": round(idade_dias, 1)
            }
    
    return {"valida": False}


@router.post("/iniciar-login/{parceiro_id}")
async def iniciar_login_uber(
    parceiro_id: str,
    data: LoginRequest,
    current_user: dict = Depends(get_current_user)
):
    """Iniciar processo de login Uber"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    try:
        from services.rpa_uber import UberRPA
        
        rpa = UberRPA(
            email=data.email,
            password=data.password,
            sms_code=None
        )
        
        await rpa.iniciar_browser(headless=True, usar_sessao=False)
        
        # Tentar login
        login_ok = await rpa.fazer_login()
        
        if login_ok:
            # Guardar sessão
            await rpa.guardar_sessao(f"/tmp/uber_sessao_{parceiro_id}.json")
            await rpa.fechar_browser(guardar=False)
            return {"sucesso": True, "mensagem": "Login realizado com sucesso"}
        
        # Verificar se precisa de SMS ou CAPTCHA
        page_content = await rpa.page.content()
        
        if "4 dígitos" in page_content or "Mais opções" in page_content:
            # Guardar referência para continuar depois
            await rpa.fechar_browser(guardar=False)
            return {"sucesso": False, "precisa_sms": True}
        
        if "Proteger a sua conta" in page_content or "Iniciar desafio" in page_content:
            await rpa.fechar_browser(guardar=False)
            return {"sucesso": False, "precisa_captcha": True}
        
        await rpa.fechar_browser(guardar=False)
        return {"sucesso": False, "erro": "Login falhou - verifique credenciais"}
        
    except Exception as e:
        logger.error(f"Erro no login Uber: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/confirmar-sms/{parceiro_id}")
async def confirmar_sms_uber(
    parceiro_id: str,
    data: SMSConfirmRequest,
    current_user: dict = Depends(get_current_user)
):
    """Confirmar código SMS para login Uber"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Obter credenciais guardadas
    cred = await db.credenciais_plataforma.find_one(
        {"parceiro_id": parceiro_id, "plataforma": "uber"}
    )
    
    if not cred:
        raise HTTPException(status_code=404, detail="Credenciais não encontradas")
    
    try:
        from services.rpa_uber import UberRPA
        
        rpa = UberRPA(
            email=cred["email"],
            password=cred["password"],
            sms_code=data.codigo
        )
        
        await rpa.iniciar_browser(headless=True, usar_sessao=False)
        login_ok = await rpa.fazer_login()
        
        if login_ok:
            await rpa.guardar_sessao(f"/tmp/uber_sessao_{parceiro_id}.json")
            await rpa.fechar_browser(guardar=False)
            return {"sucesso": True, "mensagem": "Login com SMS realizado"}
        
        await rpa.fechar_browser(guardar=False)
        return {"sucesso": False, "erro": "Código inválido ou expirado"}
        
    except Exception as e:
        logger.error(f"Erro na confirmação SMS Uber: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/capturar-sessao/{parceiro_id}")
async def capturar_sessao_manual(
    parceiro_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Após login manual no popup, tentar capturar a sessão.
    NOTA: Esta funcionalidade é limitada porque não temos acesso aos cookies do popup.
    """
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Na prática, não conseguimos capturar cookies de uma janela externa.
    # Esta rota é um placeholder - o utilizador precisa fazer o login manual
    # e depois executar uma sincronização de teste para verificar.
    
    return {
        "sucesso": False, 
        "mensagem": "Para login manual, use a sincronização de teste após fazer login na janela popup."
    }


class ExtrairRendimentosRequest(BaseModel):
    data_inicio: str  # YYYY-MM-DD
    data_fim: str     # YYYY-MM-DD
    semana_index: Optional[int] = None  # Índice da semana no dropdown (0=atual, 1=anterior, etc)


@router.post("/testar/{parceiro_id}")
async def testar_sincronizacao_uber(
    parceiro_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Testar se a sincronização Uber está a funcionar"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Obter credenciais
    cred = await db.credenciais_plataforma.find_one(
        {"parceiro_id": parceiro_id, "plataforma": "uber"}
    )
    
    if not cred:
        return {"sucesso": False, "erro": "Credenciais não configuradas"}
    
    try:
        from services.rpa_uber import UberRPA
        
        sessao_path = f"/tmp/uber_sessao_{parceiro_id}.json"
        
        rpa = UberRPA(
            email=cred["email"],
            password=cred["password"]
        )
        
        # Tentar usar sessão guardada
        await rpa.iniciar_browser(headless=True, usar_sessao=True)
        
        # Verificar se já está logado
        await rpa.page.goto("https://fleet.uber.com/", wait_until="domcontentloaded", timeout=30000)
        await rpa.page.wait_for_timeout(5000)
        
        url = rpa.page.url
        
        if "fleet.uber.com" in url and "auth" not in url:
            await rpa.fechar_browser(guardar=True)
            return {"sucesso": True, "mensagem": "Sessão Uber ativa - sincronização disponível"}
        
        # Tentar fazer login
        login_ok = await rpa.fazer_login()
        
        if login_ok:
            await rpa.guardar_sessao(sessao_path)
            await rpa.fechar_browser(guardar=False)
            return {"sucesso": True, "mensagem": "Login bem sucedido"}
        
        await rpa.fechar_browser(guardar=False)
        return {"sucesso": False, "erro": "Sessão expirada - reconfigure o login"}
        
    except Exception as e:
        logger.error(f"Erro no teste Uber: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/extrair-rendimentos/{parceiro_id}")
async def extrair_rendimentos_uber(
    parceiro_id: str,
    data: ExtrairRendimentosRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Extrair rendimentos da Uber Fleet para o período especificado.
    
    Processo:
    1. Navegar para página de Rendimentos
    2. Selecionar período (dropdown semanal ou datas personalizadas)
    3. Clicar em "Fazer o download do relatório"
    4. Processar CSV e importar dados
    """
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Obter credenciais
    cred = await db.credenciais_plataforma.find_one(
        {"parceiro_id": parceiro_id, "plataforma": "uber"}
    )
    
    if not cred:
        return {"sucesso": False, "erro": "Credenciais não configuradas"}
    
    try:
        from services.rpa_uber import UberRPA
        import csv
        import io
        
        rpa = UberRPA(
            email=cred["email"],
            password=cred["password"]
        )
        
        await rpa.iniciar_browser(headless=True, usar_sessao=True)
        
        # Navegar para Fleet
        await rpa.page.goto("https://fleet.uber.com/", wait_until="domcontentloaded", timeout=60000)
        await rpa.page.wait_for_timeout(3000)
        
        url = rpa.page.url
        
        # Se não está logado, tentar login
        if "auth" in url or "login" in url:
            logger.info("Sessão expirada - a fazer login...")
            login_ok = await rpa.fazer_login()
            if not login_ok:
                await rpa.fechar_browser()
                return {"sucesso": False, "erro": "Sessão expirada - faça login manual novamente"}
        
        # Navegar para Rendimentos
        logger.info("A navegar para Rendimentos...")
        rendimentos_link = rpa.page.locator('a:has-text("Rendimentos"), [href*="earnings"]').first
        
        if await rendimentos_link.count() > 0:
            await rendimentos_link.click()
            await rpa.page.wait_for_timeout(3000)
        else:
            # Tentar URL direta
            current_url = rpa.page.url
            org_id = current_url.split('/orgs/')[1].split('/')[0] if '/orgs/' in current_url else None
            if org_id:
                await rpa.page.goto(f"https://supplier.uber.com/orgs/{org_id}/earnings", wait_until="domcontentloaded")
            else:
                await rpa.page.goto("https://fleet.uber.com/p3/earnings", wait_until="domcontentloaded")
            await rpa.page.wait_for_timeout(3000)
        
        await rpa.screenshot("pagina_rendimentos")
        
        # Selecionar período usando dropdown
        if data.semana_index is not None:
            logger.info(f"A selecionar semana índice {data.semana_index}...")
            
            # Clicar no seletor de datas
            date_picker = rpa.page.locator('[data-testid="date-picker"], button:has-text("AM"), .date-range-picker, button:has(svg)').first
            if await date_picker.count() > 0:
                await date_picker.click()
                await rpa.page.wait_for_timeout(1000)
                
                # Selecionar "Intervalo de pagamento"
                intervalo_tab = rpa.page.locator('text=Intervalo de pagamento').first
                if await intervalo_tab.count() > 0:
                    await intervalo_tab.click()
                    await rpa.page.wait_for_timeout(500)
                
                # Selecionar a semana pelo índice
                semanas = rpa.page.locator('[role="option"], [data-testid*="week"], li:has-text("AM")').all()
                semanas_list = await semanas
                
                if data.semana_index < len(semanas_list):
                    await semanas_list[data.semana_index].click()
                    await rpa.page.wait_for_timeout(2000)
                    logger.info(f"Semana {data.semana_index} selecionada")
        
        await rpa.screenshot("periodo_selecionado")
        
        # Clicar em "Fazer o download do relatório"
        logger.info("A fazer download do relatório...")
        download_btn = rpa.page.locator('button:has-text("Fazer o download"), text=Fazer o download do relatório, a:has-text("download")').first
        
        ficheiro_csv = None
        motoristas_data = []
        
        if await download_btn.count() > 0 and await download_btn.is_visible():
            try:
                async with rpa.page.expect_download(timeout=60000) as download_info:
                    await download_btn.click()
                
                download = await download_info.value
                
                # Guardar ficheiro
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                original_name = download.suggested_filename or f"uber_rendimentos_{timestamp}.csv"
                ficheiro_csv = f"/tmp/uber_downloads/{original_name}"
                
                await download.save_as(ficheiro_csv)
                logger.info(f"CSV descarregado: {ficheiro_csv}")
                
                # Processar CSV
                with open(ficheiro_csv, 'r', encoding='utf-8-sig') as f:
                    content = f.read()
                
                # Tentar detectar delimitador
                delimiter = ';' if ';' in content else ','
                
                reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
                
                for row in reader:
                    motorista = {
                        "nome": row.get("Nome do motorista", row.get("Driver name", row.get("Nome", ""))),
                        "rendimentos_totais": parse_valor(row.get("Rendimentos totais", row.get("Total earnings", "0"))),
                        "reembolsos_despesas": parse_valor(row.get("Reembolsos e despesas", row.get("Reimbursements", "0"))),
                        "ajustes": parse_valor(row.get("Ajustes", row.get("Adjustments", "0"))),
                        "pagamento": parse_valor(row.get("Pagamento", row.get("Payment", "0"))),
                        "rendimentos_liquidos": parse_valor(row.get("Rendimentos líquidos", row.get("Net earnings", "0"))),
                    }
                    if motorista["nome"]:
                        motoristas_data.append(motorista)
                
                logger.info(f"Processados {len(motoristas_data)} motoristas do CSV")
                
            except Exception as e:
                logger.warning(f"Download falhou: {e}")
                # Fallback: extrair dados da tabela
                motoristas_data = await rpa.extrair_dados_tabela()
        else:
            # Fallback: extrair dados da tabela
            logger.info("Botão download não encontrado - a extrair da tabela...")
            motoristas_data = await rpa.extrair_dados_tabela()
        
        await rpa.fechar_browser(guardar=True)
        
        # Calcular totais
        total_rendimentos = sum(m.get("rendimentos_liquidos", 0) for m in motoristas_data)
        
        # Guardar na base de dados
        if motoristas_data:
            now = datetime.now(timezone.utc)
            
            await db.importacoes_uber.insert_one({
                "parceiro_id": parceiro_id,
                "data_inicio": data.data_inicio,
                "data_fim": data.data_fim,
                "motoristas": motoristas_data,
                "total_motoristas": len(motoristas_data),
                "total_rendimentos": total_rendimentos,
                "ficheiro_csv": ficheiro_csv,
                "created_at": now.isoformat(),
                "created_by": current_user["id"]
            })
        
        return {
            "sucesso": True,
            "mensagem": f"Extração concluída! {len(motoristas_data)} motoristas, total €{total_rendimentos:.2f}",
            "motoristas": motoristas_data,
            "total_motoristas": len(motoristas_data),
            "total_rendimentos": total_rendimentos,
            "ficheiro": ficheiro_csv
        }
        
    except Exception as e:
        logger.error(f"Erro na extração Uber: {e}")
        return {"sucesso": False, "erro": str(e)}


def parse_valor(valor_str: str) -> float:
    """Converter string de valor monetário para float"""
    if not valor_str:
        return 0.0
    # Remover símbolos de moeda e espaços
    valor = valor_str.replace("€", "").replace("$", "").replace(" ", "").strip()
    # Substituir vírgula por ponto (formato europeu)
    valor = valor.replace(",", ".")
    try:
        return float(valor)
    except:
        return 0.0


@router.get("/historico/{parceiro_id}")
async def get_historico_importacoes(
    parceiro_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter histórico de importações Uber de um parceiro"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    cursor = db.importacoes_uber.find(
        {"parceiro_id": parceiro_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20)
    
    importacoes = await cursor.to_list(length=20)
    return importacoes
