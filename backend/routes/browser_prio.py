"""
Rotas para Browser Interativo Prio - Login com SMS 2FA
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
import logging
import asyncio
import os
import json
from datetime import datetime, timedelta

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/prio", tags=["Browser Interativo Prio"])
db = get_database()


class AcaoMouse(BaseModel):
    x: int
    y: int


class AcaoTeclado(BaseModel):
    texto: Optional[str] = None
    tecla: Optional[str] = None  # Enter, Tab, Escape, etc


class ExtrairDadosRequest(BaseModel):
    tipo: str  # "combustivel" ou "eletrico"
    semana: Optional[int] = None
    ano: Optional[int] = None
    data_inicio: Optional[str] = None  # YYYY-MM-DD
    data_fim: Optional[str] = None  # YYYY-MM-DD


@router.post("/browser/iniciar")
async def iniciar_browser_prio(
    current_user: dict = Depends(get_current_user)
):
    """Iniciar browser e navegar para Prio login"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import get_browser_prio
        
        # Buscar credenciais guardadas
        parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0, "credenciais_plataformas": 1})
        if not parceiro:
            parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0, "credenciais_plataformas": 1})
        
        creds = parceiro.get("credenciais_plataformas", {}) if parceiro else {}
        
        browser = await get_browser_prio(parceiro_id)
        # URL correcta baseada no vídeo do utilizador
        await browser.navegar("https://myprio.com/MyPrioReactiveTheme/Login")
        
        await asyncio.sleep(2)
        
        # Se tiver credenciais, preencher utilizador automaticamente
        prio_usuario = creds.get("prio_usuario")
        if prio_usuario:
            # Clicar no campo de utilizador
            user_field = browser.page.locator('input[type="text"], input[name*="user"], input[id*="user"]').first
            if await user_field.count() > 0:
                await user_field.click()
                await asyncio.sleep(0.3)
                await user_field.fill(str(prio_usuario))
                logger.info(f"Utilizador Prio preenchido: {prio_usuario}")
        
        screenshot = await browser.screenshot()
        
        return {
            "sucesso": True,
            "screenshot": screenshot,
            "mensagem": "Browser Prio iniciado" + (" - utilizador preenchido" if prio_usuario else "")
        }
        
    except Exception as e:
        logger.error(f"Erro ao iniciar browser Prio: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/browser/screenshot")
async def obter_screenshot_prio(
    current_user: dict = Depends(get_current_user)
):
    """Obter screenshot atual do browser Prio"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import get_browser_prio
        
        browser = await get_browser_prio(parceiro_id)
        screenshot = await browser.screenshot()
        
        # Verificar status de login
        login_status = await browser.verificar_login()
        
        return {
            "sucesso": True,
            "screenshot": screenshot,
            "url": browser.page.url if browser.page else None,
            "logado": login_status.get("logado", False)
        }
        
    except Exception as e:
        logger.error(f"Erro no screenshot Prio: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/browser/clicar")
async def clicar_browser_prio(
    acao: AcaoMouse,
    current_user: dict = Depends(get_current_user)
):
    """Clicar numa posição no browser Prio"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import get_browser_prio
        
        browser = await get_browser_prio(parceiro_id)
        await browser.clicar(acao.x, acao.y)
        
        await asyncio.sleep(1)
        screenshot = await browser.screenshot()
        login_status = await browser.verificar_login()
        
        # Se acabou de fazer login, guardar sessão e estado
        if login_status.get("logado"):
            await browser.guardar_sessao()
            _save_login_state(parceiro_id, True)
            logger.info(f"Login Prio bem-sucedido para parceiro {parceiro_id}")
        
        return {
            "sucesso": True,
            "screenshot": screenshot,
            "url": browser.page.url if browser.page else None,
            "logado": login_status.get("logado", False)
        }
        
    except Exception as e:
        logger.error(f"Erro ao clicar Prio: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/browser/digitar")
async def digitar_browser_prio(
    acao: AcaoTeclado,
    current_user: dict = Depends(get_current_user)
):
    """Digitar texto no browser Prio"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import get_browser_prio
        
        browser = await get_browser_prio(parceiro_id)
        
        if acao.texto:
            await browser.digitar(acao.texto)
        if acao.tecla:
            await browser.tecla(acao.tecla)
        
        await asyncio.sleep(0.5)
        screenshot = await browser.screenshot()
        
        return {
            "sucesso": True,
            "screenshot": screenshot
        }
        
    except Exception as e:
        logger.error(f"Erro ao digitar Prio: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/browser/preencher-email")
async def preencher_email_prio(
    current_user: dict = Depends(get_current_user)
):
    """Preencher email/utilizador automaticamente no formulário Prio"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import get_browser_prio
        
        # Buscar credenciais guardadas
        parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0, "credenciais_plataformas": 1})
        if not parceiro:
            parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0, "credenciais_plataformas": 1})
        
        creds = parceiro.get("credenciais_plataformas", {}) if parceiro else {}
        prio_usuario = creds.get("prio_usuario")
        
        if not prio_usuario:
            return {"sucesso": False, "erro": "Utilizador Prio não configurado. Configure nas Credenciais."}
        
        browser = await get_browser_prio(parceiro_id)
        resultado = await browser.preencher_email(prio_usuario)
        
        await asyncio.sleep(0.5)
        screenshot = await browser.screenshot()
        
        return {
            "sucesso": resultado.get("sucesso", False),
            "screenshot": screenshot,
            "erro": resultado.get("erro")
        }
        
    except Exception as e:
        logger.error(f"Erro ao preencher email Prio: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/browser/preencher-password")
async def preencher_password_prio(
    current_user: dict = Depends(get_current_user)
):
    """Preencher password automaticamente no formulário Prio"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import get_browser_prio
        
        # Buscar credenciais guardadas
        parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0, "credenciais_plataformas": 1})
        if not parceiro:
            parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0, "credenciais_plataformas": 1})
        
        creds = parceiro.get("credenciais_plataformas", {}) if parceiro else {}
        prio_password = creds.get("prio_password")
        
        if not prio_password:
            return {"sucesso": False, "erro": "Password Prio não configurada. Configure nas Credenciais."}
        
        browser = await get_browser_prio(parceiro_id)
        resultado = await browser.preencher_password(prio_password)
        
        await asyncio.sleep(0.5)
        screenshot = await browser.screenshot()
        
        return {
            "sucesso": resultado.get("sucesso", False),
            "screenshot": screenshot,
            "erro": resultado.get("erro")
        }
        
    except Exception as e:
        logger.error(f"Erro ao preencher password Prio: {e}")
        return {"sucesso": False, "erro": str(e)}


class PreencherSMSRequest(BaseModel):
    codigo: str


@router.post("/browser/preencher-sms")
async def preencher_sms_prio(
    request: PreencherSMSRequest,
    current_user: dict = Depends(get_current_user)
):
    """Preencher código SMS no formulário Prio"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import get_browser_prio
        
        browser = await get_browser_prio(parceiro_id)
        resultado = await browser.preencher_sms(request.codigo)
        
        await asyncio.sleep(0.5)
        screenshot = await browser.screenshot()
        login_status = await browser.verificar_login()
        
        # Se acabou de fazer login, guardar sessão e estado
        if login_status.get("logado"):
            await browser.guardar_sessao()
            _save_login_state(parceiro_id, True)
            logger.info(f"Login Prio bem-sucedido após SMS para parceiro {parceiro_id}")
        
        return {
            "sucesso": resultado.get("sucesso", False),
            "screenshot": screenshot,
            "logado": login_status.get("logado", False),
            "erro": resultado.get("erro")
        }
        
    except Exception as e:
        logger.error(f"Erro ao preencher SMS Prio: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/browser/clicar-iniciar-sessao")
async def clicar_iniciar_sessao_prio(
    current_user: dict = Depends(get_current_user)
):
    """Clicar no botão 'Iniciar Sessão' automaticamente"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import get_browser_prio
        
        browser = await get_browser_prio(parceiro_id)
        resultado = await browser.clicar_iniciar_sessao()
        
        await asyncio.sleep(2)
        screenshot = await browser.screenshot()
        login_status = await browser.verificar_login()
        
        # Se acabou de fazer login, guardar sessão e estado
        if login_status.get("logado"):
            await browser.guardar_sessao()
            _save_login_state(parceiro_id, True)
            logger.info(f"Login Prio bem-sucedido após clicar iniciar sessão para parceiro {parceiro_id}")
        
        return {
            "sucesso": resultado.get("sucesso", False),
            "screenshot": screenshot,
            "logado": login_status.get("logado", False),
            "erro": resultado.get("erro")
        }
        
    except Exception as e:
        logger.error(f"Erro ao clicar iniciar sessão Prio: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/browser/fechar")
async def fechar_browser_prio(
    current_user: dict = Depends(get_current_user)
):
    """Fechar browser Prio"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import fechar_browser_prio
        
        await fechar_browser_prio(parceiro_id)
        
        return {"sucesso": True, "mensagem": "Browser Prio fechado"}
        
    except Exception as e:
        logger.error(f"Erro ao fechar browser Prio: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.get("/browser/status")
async def status_browser_prio(
    current_user: dict = Depends(get_current_user)
):
    """Verificar status do browser e sessão Prio"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import _browsers_prio, PRIO_SESSIONS_DIR
        
        browser_ativo = parceiro_id in _browsers_prio and _browsers_prio[parceiro_id].ativo
        
        # Verificar se há sessão persistente guardada
        user_data_dir = os.path.join(PRIO_SESSIONS_DIR, f"parceiro_{parceiro_id}")
        cookies_path = os.path.join(user_data_dir, "Default", "Cookies")
        sessao_existe = os.path.exists(cookies_path)
        sessao_data = None
        if sessao_existe:
            sessao_data = datetime.fromtimestamp(os.path.getmtime(cookies_path)).isoformat()
        
        # Verificar credenciais
        parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0, "credenciais_plataformas": 1})
        if not parceiro:
            parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0, "credenciais_plataformas": 1})
        
        creds = parceiro.get("credenciais_plataformas", {}) if parceiro else {}
        tem_credenciais = bool(creds.get("prio_usuario") and creds.get("prio_password"))
        
        return {
            "browser_ativo": browser_ativo,
            "sessao_existe": sessao_existe,
            "sessao_data": sessao_data,
            "tem_credenciais": tem_credenciais,
            "prio_usuario": creds.get("prio_usuario")
        }
        
    except Exception as e:
        logger.error(f"Erro ao verificar status Prio: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/extrair")
async def extrair_dados_prio(
    request: ExtrairDadosRequest,
    current_user: dict = Depends(get_current_user)
):
    """Extrair dados de combustível ou elétrico da Prio"""
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import get_browser_prio, verificar_sessao_prio_valida
        from services.prio_processor import PrioProcessor
        
        # Primeiro, verificar se há sessão válida (reutiliza cookies existentes)
        logger.info(f"🔄 Iniciando extração Prio para parceiro {parceiro_id}")
        sessao_check = await verificar_sessao_prio_valida(parceiro_id)
        
        if not sessao_check.get("valida"):
            logger.warning(f"⚠️ Sessão Prio inválida: {sessao_check.get('mensagem')}")
            return {
                "sucesso": False, 
                "erro": "Sessão Prio expirada. Faça login na página Configuração Prio.",
                "requer_login": True
            }
        
        logger.info(f"✅ Sessão Prio válida, continuando extração...")
        browser = await get_browser_prio(parceiro_id)
        
        # Calcular datas se fornecida semana/ano
        semana = request.semana
        ano = request.ano
        
        if semana and ano:
            # Calcular data início (segunda-feira da semana ISO)
            from datetime import date
            # Usar semana ISO
            primeiro_dia_semana = date.fromisocalendar(ano, semana, 1)  # Segunda-feira
            ultimo_dia_semana = date.fromisocalendar(ano, semana, 7)   # Domingo
            
            request.data_inicio = primeiro_dia_semana.strftime('%Y-%m-%d')
            request.data_fim = ultimo_dia_semana.strftime('%Y-%m-%d')
        
        if not request.data_inicio or not request.data_fim:
            return {"sucesso": False, "erro": "Datas não fornecidas"}
        
        # Extrair dados
        if request.tipo == "combustivel":
            resultado = await browser.extrair_combustivel(request.data_inicio, request.data_fim)
        elif request.tipo == "eletrico":
            resultado = await browser.extrair_eletrico(request.data_inicio, request.data_fim)
        else:
            return {"sucesso": False, "erro": f"Tipo inválido: {request.tipo}"}
        
        # Se extracção bem sucedida, processar ficheiro
        if resultado.get("sucesso") and resultado.get("ficheiro"):
            logger.info(f"✅ Ficheiro extraído: {resultado['ficheiro']}")
            
            # Processar ficheiro e inserir na base de dados
            processor = PrioProcessor(db)
            
            if request.tipo == "combustivel":
                proc_result = await processor.processar_combustivel_xls(
                    resultado['ficheiro'],
                    parceiro_id,
                    semana=semana,
                    ano=ano
                )
            else:
                proc_result = await processor.processar_eletrico_csv(
                    resultado['ficheiro'],
                    parceiro_id,
                    semana=semana,
                    ano=ano
                )
            
            # Registar execução
            await db.execucoes_rpa.insert_one({
                "parceiro_id": parceiro_id,
                "plataforma": f"prio_{request.tipo}",
                "data_inicio": datetime.now(),
                "data_fim": datetime.now(),
                "status": "sucesso" if proc_result.get("sucesso") else "erro",
                "ficheiro": resultado["ficheiro"],
                "periodo": f"{request.data_inicio} a {request.data_fim}",
                "registos_processados": proc_result.get("registos_processados", 0),
                "registos_inseridos": proc_result.get("registos_inseridos", 0),
                "registos_atualizados": proc_result.get("registos_atualizados", 0)
            })
            
            # Actualizar timestamp de login bem-sucedido
            _save_login_state(parceiro_id, True)
            
            # Combinar resultados
            resultado["processamento"] = proc_result
        
        return resultado
        
    except Exception as e:
        logger.error(f"Erro ao extrair dados Prio: {e}")
        return {"sucesso": False, "erro": str(e)}



# Ficheiro para guardar estado de login verificado
PRIO_LOGIN_STATE_FILE = "/app/data/prio_login_state.json"

def _load_login_states() -> Dict:
    """Carregar estados de login guardados"""
    try:
        if os.path.exists(PRIO_LOGIN_STATE_FILE):
            with open(PRIO_LOGIN_STATE_FILE, 'r') as f:
                return json.load(f)
    except:
        pass
    return {}

def _save_login_state(parceiro_id: str, logado: bool):
    """Guardar estado de login para um parceiro"""
    try:
        states = _load_login_states()
        states[parceiro_id] = {
            "logado": logado,
            "timestamp": datetime.now().isoformat()
        }
        os.makedirs(os.path.dirname(PRIO_LOGIN_STATE_FILE), exist_ok=True)
        with open(PRIO_LOGIN_STATE_FILE, 'w') as f:
            json.dump(states, f)
    except Exception as e:
        logger.error(f"Erro ao guardar estado login Prio: {e}")

def _get_login_state(parceiro_id: str) -> Optional[Dict]:
    """Obter estado de login guardado"""
    states = _load_login_states()
    state = states.get(parceiro_id)
    if state:
        # Verificar se não expirou (30 dias)
        try:
            ts = datetime.fromisoformat(state["timestamp"])
            if datetime.now() - ts < timedelta(days=30):
                return state
        except:
            pass
    return None


def _calcular_dias_restantes(timestamp_str: str) -> int:
    """Calcular dias restantes até expiração (30 dias)"""
    try:
        ts = datetime.fromisoformat(timestamp_str)
        expira_em = ts + timedelta(days=30)
        dias_restantes = (expira_em - datetime.now()).days
        return max(0, dias_restantes)
    except:
        return 0


@router.get("/sessao")
async def verificar_sessao_prio(
    current_user: dict = Depends(get_current_user)
):
    """
    Verificar se há sessão Prio válida.
    Primeiro verifica se há browser activo, depois faz verificação se necessário.
    """
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import PRIO_SESSIONS_DIR, _browsers_prio
        
        # 1. Verificar se há browser activo com sessão válida (mais rápido)
        if parceiro_id in _browsers_prio and _browsers_prio[parceiro_id].ativo:
            browser = _browsers_prio[parceiro_id]
            login_status = await browser.verificar_login()
            if login_status.get("logado"):
                _save_login_state(parceiro_id, True)
                return {
                    "logado": True,
                    "sessao_persistente": True,
                    "verificado_em": datetime.now().isoformat(),
                    "dias_restantes": 30,
                    "expirando": False,
                    "nota": "Sessão activa!",
                    "browser_activo": True
                }
        
        # 2. Verificar se há estado de login guardado recentemente (última 1h)
        login_state = _get_login_state(parceiro_id)
        if login_state and login_state.get("logado"):
            dias_restantes = _calcular_dias_restantes(login_state.get("timestamp", ""))
            
            try:
                ts = datetime.fromisoformat(login_state.get("timestamp", ""))
                minutos_desde_verificacao = (datetime.now() - ts).total_seconds() / 60
                
                # Se foi verificado há menos de 60 minutos e não expirou, confiar no estado
                if minutos_desde_verificacao < 60 and dias_restantes > 0:
                    expirando = dias_restantes <= 5
                    return {
                        "logado": True,
                        "sessao_persistente": True,
                        "verificado_em": login_state.get("timestamp"),
                        "dias_restantes": dias_restantes,
                        "expirando": expirando,
                        "nota": f"Sessão válida por mais {dias_restantes} dias" if not expirando else f"⚠️ Sessão expira em {dias_restantes} dias! Renove o login."
                    }
            except:
                pass
        
        # 3. Verificar se existe directório de sessão com cookies
        user_data_dir = os.path.join(PRIO_SESSIONS_DIR, f"parceiro_{parceiro_id}")
        cookies_path = os.path.join(user_data_dir, "Default", "Cookies")
        
        if not os.path.exists(cookies_path):
            return {"logado": False, "motivo": "Nenhuma sessão encontrada. Faça login na página Configuração Prio."}
        
        # 4. Cookies existem mas não há browser activo nem estado recente
        # Iniciar browser e verificar activamente
        logger.info(f"Verificação activa de sessão Prio para parceiro {parceiro_id}")
        from services.browser_interativo_prio import verificar_sessao_prio_valida
        resultado = await verificar_sessao_prio_valida(parceiro_id)
        
        if resultado.get("valida"):
            _save_login_state(parceiro_id, True)
            return {
                "logado": True,
                "sessao_persistente": True,
                "verificado_em": datetime.now().isoformat(),
                "dias_restantes": 30,
                "expirando": False,
                "nota": "Sessão verificada e activa!"
            }
        else:
            _save_login_state(parceiro_id, False)
            return {
                "logado": False, 
                "motivo": resultado.get("mensagem", "Sessão expirada. Faça login novamente."),
                "cookies_existem": True
            }
        
    except Exception as e:
        logger.error(f"Erro ao verificar sessão Prio: {e}")
        return {"logado": False, "erro": str(e)}


@router.get("/sessao/status-completo")
async def status_completo_sessao_prio(
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna estado completo da sessão Prio com informações de expiração.
    Usado para mostrar alertas no dashboard/resumo semanal.
    """
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import PRIO_SESSIONS_DIR
        
        login_state = _get_login_state(parceiro_id)
        
        if not login_state or not login_state.get("logado"):
            return {
                "tem_sessao": False,
                "logado": False,
                "alerta": {
                    "tipo": "sem_sessao",
                    "severidade": "warning",
                    "mensagem": "Não tem sessão Prio activa. Configure na página Configuração Prio.",
                    "acao": "/configuracao-prio"
                }
            }
        
        dias_restantes = _calcular_dias_restantes(login_state.get("timestamp", ""))
        verificado_em = login_state.get("timestamp", "")
        
        # Determinar tipo de alerta
        alerta = None
        if dias_restantes <= 0:
            alerta = {
                "tipo": "expirada",
                "severidade": "error",
                "mensagem": "Sessão Prio expirada! Faça login novamente.",
                "acao": "/configuracao-prio"
            }
        elif dias_restantes <= 3:
            alerta = {
                "tipo": "expirando",
                "severidade": "warning",
                "mensagem": f"Sessão Prio expira em {dias_restantes} dias! Renove o login.",
                "acao": "/configuracao-prio"
            }
        elif dias_restantes <= 7:
            alerta = {
                "tipo": "aviso",
                "severidade": "info",
                "mensagem": f"Sessão Prio válida por mais {dias_restantes} dias.",
                "acao": None
            }
        
        return {
            "tem_sessao": True,
            "logado": dias_restantes > 0,
            "verificado_em": verificado_em,
            "dias_restantes": dias_restantes,
            "expira_em": (datetime.fromisoformat(verificado_em) + timedelta(days=30)).isoformat() if verificado_em else None,
            "alerta": alerta
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter status completo Prio: {e}")
        return {"tem_sessao": False, "logado": False, "erro": str(e)}


@router.post("/sessao/verificar-activa")
async def verificar_sessao_activa_prio(
    current_user: dict = Depends(get_current_user)
):
    """
    Verifica activamente se a sessão Prio ainda está válida.
    Inicia o browser e navega para uma página protegida para confirmar.
    Útil antes de sincronização para garantir que não será pedido login.
    """
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import verificar_sessao_prio_valida
        
        resultado = await verificar_sessao_prio_valida(parceiro_id)
        
        if resultado.get("valida"):
            # Actualizar estado de login
            _save_login_state(parceiro_id, True)
            return {
                "sessao_valida": True,
                "mensagem": "Sessão Prio está activa e válida!",
                "url": resultado.get("url", ""),
                "dias_restantes": 30  # Reset porque verificamos agora
            }
        else:
            return {
                "sessao_valida": False,
                "mensagem": resultado.get("mensagem", "Sessão expirada"),
                "requer_login": True
            }
            
    except Exception as e:
        logger.error(f"Erro ao verificar sessão activa Prio: {e}")
        return {"sessao_valida": False, "erro": str(e)}



@router.post("/sessao/refrescar")
async def refrescar_sessao_prio(
    current_user: dict = Depends(get_current_user)
):
    """
    Refrescar a sessão Prio para mantê-la activa.
    Útil para prevenir timeout por inactividade.
    """
    
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    try:
        from services.browser_interativo_prio import get_browser_prio
        
        browser = await get_browser_prio(parceiro_id, verificar_sessao=True)
        resultado = await browser.refrescar_sessao()
        
        if resultado.get("sucesso"):
            _save_login_state(parceiro_id, True)
            return {
                "sucesso": True,
                "mensagem": "Sessão Prio refrescada com sucesso!",
                "proxima_verificacao": "em 30 dias"
            }
        else:
            _save_login_state(parceiro_id, False)
            return {
                "sucesso": False,
                "mensagem": resultado.get("erro", "Sessão expirada"),
                "requer_login": True
            }
            
    except Exception as e:
        logger.error(f"Erro ao refrescar sessão Prio: {e}")
        return {"sucesso": False, "erro": str(e)}

