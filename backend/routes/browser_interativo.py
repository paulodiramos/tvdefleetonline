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
        
        browser = await get_browser(parceiro_id)
        await browser.navegar("https://auth.uber.com/v2/?next_url=https%3A%2F%2Ffleet.uber.com%2F")
        
        screenshot = await browser.screenshot()
        
        return {
            "sucesso": True,
            "screenshot": screenshot,
            "mensagem": "Browser iniciado - faça login"
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
