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
