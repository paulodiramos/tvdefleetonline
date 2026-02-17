"""
Rotas para Browser Virtual do Admin
- Browser interativo embutido na UI
- Gravação de passos RPA
- Preview em tempo real via WebSocket
"""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import logging
import os
import uuid
import asyncio
import base64
from pathlib import Path

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/browser-virtual", tags=["Browser Virtual Admin"])
db = get_database()

# Configurar Playwright
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'

# Armazenar sessões activas
active_sessions: Dict[str, Any] = {}

# Directório para screenshots
SCREENSHOTS_DIR = Path("/app/backend/browser_screenshots")
SCREENSHOTS_DIR.mkdir(exist_ok=True)


# Função auxiliar para auto-save
async def _auto_save_passos(plataforma_id: str, admin_id: str, passos: list, tipo: str = "rascunho"):
    """Guarda automaticamente os passos na BD como rascunho"""
    try:
        await db.rpa_rascunhos.update_one(
            {"plataforma_id": plataforma_id, "admin_id": admin_id},
            {
                "$set": {
                    "passos": passos,
                    "tipo": tipo,
                    "atualizado_em": datetime.now(timezone.utc).isoformat()
                },
                "$setOnInsert": {
                    "criado_em": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        logger.debug(f"Auto-save: {len(passos)} passos guardados para plataforma {plataforma_id}")
    except Exception as e:
        logger.error(f"Erro no auto-save: {e}")


async def _carregar_rascunho(plataforma_id: str, admin_id: str) -> list:
    """Carrega rascunho de passos da BD"""
    try:
        rascunho = await db.rpa_rascunhos.find_one(
            {"plataforma_id": plataforma_id, "admin_id": admin_id},
            {"_id": 0, "passos": 1}
        )
        if rascunho and rascunho.get("passos"):
            return rascunho["passos"]
    except Exception as e:
        logger.error(f"Erro ao carregar rascunho: {e}")
    return []


async def _limpar_rascunho(plataforma_id: str, admin_id: str):
    """Remove rascunho após guardar passos definitivamente"""
    try:
        await db.rpa_rascunhos.delete_one(
            {"plataforma_id": plataforma_id, "admin_id": admin_id}
        )
    except Exception as e:
        logger.error(f"Erro ao limpar rascunho: {e}")


class IniciarSessaoRequest(BaseModel):
    plataforma_id: str
    url_inicial: Optional[str] = None
    parceiro_id: Optional[str] = None


class EnviarAcaoRequest(BaseModel):
    tipo: str  # click, type, scroll, press
    x: Optional[int] = None
    y: Optional[int] = None
    texto: Optional[str] = None
    tecla: Optional[str] = None
    delta: Optional[int] = None
    seletor: Optional[str] = None


@router.post("/sessao/iniciar")
async def iniciar_sessao_browser(
    data: IniciarSessaoRequest,
    current_user: dict = Depends(get_current_user)
):
    """Iniciar uma sessão de browser virtual para o admin"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode usar o browser virtual")
    
    # Obter plataforma
    plataforma = await db.plataformas.find_one(
        {"id": data.plataforma_id},
        {"_id": 0}
    )
    
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    # Obter credenciais do parceiro se especificado
    credenciais_parceiro = None
    parceiro_nome = None
    if data.parceiro_id:
        parceiro = await db.parceiros.find_one(
            {"id": data.parceiro_id},
            {"_id": 0, "nome": 1, f"credenciais_plataformas.{data.plataforma_id}": 1}
        )
        if parceiro:
            parceiro_nome = parceiro.get("nome")
            credenciais_parceiro = parceiro.get("credenciais_plataformas", {}).get(data.plataforma_id, {})
        
        # Se não encontrou no documento do parceiro, procurar na colecção credenciais_plataforma
        if not credenciais_parceiro or not credenciais_parceiro.get("password"):
            plataforma_nome = plataforma.get("nome", "").lower().replace(" ", "_")
            nomes_plataforma = [
                plataforma_nome,
                plataforma.get("nome", ""),
                plataforma.get("nome", "").lower(),
                plataforma_nome.replace("_", "")
            ]
            
            for nome in nomes_plataforma:
                if not nome:
                    continue
                cred_doc = await db.credenciais_plataforma.find_one(
                    {
                        "parceiro_id": data.parceiro_id,
                        "plataforma": {"$regex": f"^{nome}$", "$options": "i"},
                        "ativo": {"$ne": False}
                    },
                    {"_id": 0}
                )
                if cred_doc:
                    # Desencriptar password se necessário
                    password = cred_doc.get("password_encrypted") or cred_doc.get("password")
                    credenciais_parceiro = {
                        "email": cred_doc.get("email"),
                        "password": password
                    }
                    if not parceiro_nome:
                        p = await db.parceiros.find_one({"id": data.parceiro_id}, {"_id": 0, "nome": 1})
                        parceiro_nome = p.get("nome") if p else None
                    break
    
    session_id = str(uuid.uuid4())
    url_inicial = data.url_inicial or plataforma.get("url_login") or plataforma.get("url_base") or "https://www.google.com"
    
    # Carregar rascunho de passos existente (auto-save)
    passos_rascunho = await _carregar_rascunho(data.plataforma_id, current_user["id"])
    
    try:
        from playwright.async_api import async_playwright
        
        playwright = await async_playwright().start()
        
        # Iniciar browser headless
        browser = await playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            accept_downloads=True,
            ignore_https_errors=True
        )
        
        page = await context.new_page()
        await page.goto(url_inicial, timeout=30000, wait_until="domcontentloaded")
        
        # Tirar screenshot inicial
        screenshot_bytes = await page.screenshot(type="jpeg", quality=60)
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
        
        # Guardar sessão (com passos do rascunho se existir)
        active_sessions[session_id] = {
            "playwright": playwright,
            "browser": browser,
            "context": context,
            "page": page,
            "plataforma_id": data.plataforma_id,
            "plataforma_nome": plataforma.get("nome", ""),
            "admin_id": current_user["id"],
            "passos_gravados": passos_rascunho,  # Carregar rascunho
            "criado_em": datetime.now(timezone.utc).isoformat(),
            "gravando": False,
            "parceiro_id": data.parceiro_id,
            "parceiro_nome": parceiro_nome,
            "credenciais": credenciais_parceiro  # Guardar credenciais para uso nos passos
        }
        
        logger.info(f"Sessão browser virtual iniciada: {session_id} para plataforma {plataforma.get('nome')}")
        if passos_rascunho:
            logger.info(f"  -> Carregados {len(passos_rascunho)} passos do rascunho anterior")
        if parceiro_nome:
            logger.info(f"  -> Com credenciais do parceiro: {parceiro_nome}")
        
        return {
            "sucesso": True,
            "session_id": session_id,
            "url": page.url,
            "screenshot": screenshot_base64,
            "plataforma": plataforma.get("nome"),
            "passos_recuperados": len(passos_rascunho),
            "rascunho_carregado": len(passos_rascunho) > 0,
            "parceiro_nome": parceiro_nome,
            "tem_credenciais": credenciais_parceiro is not None
        }
        
    except Exception as e:
        logger.error(f"Erro ao iniciar sessão browser: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar browser: {str(e)}")


@router.delete("/sessao/{session_id}")
async def terminar_sessao_browser(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Terminar uma sessão de browser virtual"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    try:
        if session.get("browser"):
            await session["browser"].close()
        if session.get("playwright"):
            await session["playwright"].stop()
        
        passos = session.get("passos_gravados", [])
        del active_sessions[session_id]
        
        logger.info(f"Sessão browser virtual terminada: {session_id}")
        
        return {
            "sucesso": True,
            "passos_gravados": passos,
            "total_passos": len(passos)
        }
        
    except Exception as e:
        logger.error(f"Erro ao terminar sessão: {e}")
        # Limpar de qualquer forma
        if session_id in active_sessions:
            del active_sessions[session_id]
        return {"sucesso": True, "erro": str(e)}


@router.get("/sessao/{session_id}/status")
async def obter_status_sessao(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter status de uma sessão"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    return {
        "session_id": session_id,
        "plataforma_id": session.get("plataforma_id"),
        "plataforma_nome": session.get("plataforma_nome"),
        "gravando": session.get("gravando", False),
        "total_passos": len(session.get("passos_gravados", [])),
        "criado_em": session.get("criado_em")
    }


@router.post("/sessao/{session_id}/gravar")
async def toggle_gravacao(
    session_id: str,
    ativar: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Ativar/desativar modo de gravação"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    session["gravando"] = ativar
    
    return {
        "sucesso": True,
        "gravando": ativar,
        "mensagem": "Gravação activada" if ativar else "Gravação desactivada"
    }


@router.post("/sessao/{session_id}/acao")
async def executar_acao(
    session_id: str,
    data: EnviarAcaoRequest,
    current_user: dict = Depends(get_current_user)
):
    """Executar uma acção no browser e retornar screenshot"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    page = session.get("page")
    if not page:
        raise HTTPException(status_code=400, detail="Página não disponível")
    
    passo_gravado = None
    
    try:
        # Executar acção
        if data.tipo == "click":
            if data.x is not None and data.y is not None:
                await page.mouse.click(data.x, data.y)
                if session.get("gravando"):
                    passo_gravado = {
                        "ordem": len(session["passos_gravados"]) + 1,
                        "tipo": "click",
                        "descricao": f"🖱️ Clique em ({data.x}, {data.y})",
                        "x": data.x,
                        "y": data.y
                    }
                    
        elif data.tipo == "type" or data.tipo == "inserir_texto":
            if data.texto:
                await page.keyboard.type(data.texto)
                if session.get("gravando"):
                    passo_gravado = {
                        "ordem": len(session["passos_gravados"]) + 1,
                        "tipo": "type",
                        "descricao": f"⌨️ Texto: {data.texto[:30]}..." if len(data.texto) > 30 else f"⌨️ Texto: {data.texto}",
                        "valor": data.texto
                    }
                    
        elif data.tipo == "press" or data.tipo == "tecla":
            tecla = data.tecla or "Enter"
            await page.keyboard.press(tecla)
            if session.get("gravando"):
                passo_gravado = {
                    "ordem": len(session["passos_gravados"]) + 1,
                    "tipo": "press",
                    "descricao": f"⏎ Tecla: {tecla}",
                    "tecla": tecla
                }
                
        elif data.tipo == "scroll":
            delta = data.delta or 300
            if isinstance(delta, str):
                delta = 300 if delta == "down" else -300
            await page.mouse.wheel(0, delta)
            if session.get("gravando"):
                passo_gravado = {
                    "ordem": len(session["passos_gravados"]) + 1,
                    "tipo": "scroll",
                    "descricao": f"📜 Scroll {'↓' if delta > 0 else '↑'}",
                    "delta": delta
                }
                
        elif data.tipo == "goto":
            if data.texto:
                await page.goto(data.texto, timeout=30000)
                if session.get("gravando"):
                    passo_gravado = {
                        "ordem": len(session["passos_gravados"]) + 1,
                        "tipo": "goto",
                        "descricao": f"🌐 Navegar: {data.texto[:50]}...",
                        "valor": data.texto
                    }
                    
        elif data.tipo == "espera":
            ms = int(data.texto) if data.texto else 2000
            await page.wait_for_timeout(ms)
            if session.get("gravando"):
                passo_gravado = {
                    "ordem": len(session["passos_gravados"]) + 1,
                    "tipo": "wait",
                    "descricao": f"⏳ Esperar {ms}ms",
                    "timeout": ms
                }
        
        # Gravar passo
        if passo_gravado:
            session["passos_gravados"].append(passo_gravado)
            # AUTO-SAVE: guardar automaticamente na BD
            await _auto_save_passos(
                session.get("plataforma_id"),
                session.get("admin_id"),
                session["passos_gravados"]
            )
        
        # Esperar um pouco e tirar screenshot
        await page.wait_for_timeout(300)
        screenshot_bytes = await page.screenshot(type="jpeg", quality=60)
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
        
        return {
            "sucesso": True,
            "url": page.url,
            "screenshot": screenshot_base64,
            "passo_gravado": passo_gravado,
            "total_passos": len(session.get("passos_gravados", []))
        }
        
    except Exception as e:
        logger.error(f"Erro ao executar acção: {e}")
        
        # Tentar obter screenshot mesmo com erro
        try:
            screenshot_bytes = await page.screenshot(type="jpeg", quality=60)
            screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
        except Exception:
            screenshot_base64 = None
            
        return {
            "sucesso": False,
            "erro": str(e),
            "url": page.url if page else None,
            "screenshot": screenshot_base64
        }


@router.get("/sessao/{session_id}/screenshot")
async def obter_screenshot(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter screenshot actual do browser"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    page = session.get("page")
    if not page:
        raise HTTPException(status_code=400, detail="Página não disponível")
    
    try:
        screenshot_bytes = await page.screenshot(type="jpeg", quality=60)
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
        
        return {
            "sucesso": True,
            "url": page.url,
            "screenshot": screenshot_base64
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter screenshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessao/{session_id}/inserir-credencial")
async def inserir_credencial_parceiro(
    session_id: str,
    campo: str = "email",  # email ou password
    current_user: dict = Depends(get_current_user)
):
    """Inserir credencial do parceiro no campo activo do browser (sem expor ao admin)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    credenciais = session.get("credenciais")
    if not credenciais:
        raise HTTPException(status_code=400, detail="Sessão sem credenciais de parceiro")
    
    page = session.get("page")
    if not page:
        raise HTTPException(status_code=400, detail="Página não disponível")
    
    # Obter valor da credencial
    valor = None
    if campo == "email":
        valor = credenciais.get("email") or credenciais.get("username") or credenciais.get("login")
    elif campo == "password":
        valor = credenciais.get("password") or credenciais.get("senha")
    else:
        raise HTTPException(status_code=400, detail=f"Campo desconhecido: {campo}")
    
    if not valor:
        raise HTTPException(status_code=400, detail=f"Credencial '{campo}' não configurada para este parceiro")
    
    passo_gravado = None
    
    try:
        # Inserir valor no campo activo
        await page.keyboard.type(valor)
        
        # Se está a gravar, adicionar passo (sem expor o valor real)
        if session.get("gravando"):
            passo_gravado = {
                "ordem": len(session["passos_gravados"]) + 1,
                "tipo": "fill_credential",
                "descricao": f"🔐 Credencial: {campo}",
                "campo_credencial": campo  # Guarda só o tipo, não o valor
            }
            session["passos_gravados"].append(passo_gravado)
            # Auto-save
            await _auto_save_passos(
                session.get("plataforma_id"),
                session.get("admin_id"),
                session["passos_gravados"]
            )
        
        # Screenshot após inserir
        await page.wait_for_timeout(200)
        screenshot_bytes = await page.screenshot(type="jpeg", quality=60)
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
        
        return {
            "sucesso": True,
            "campo": campo,
            "url": page.url,
            "screenshot": screenshot_base64,
            "passo_gravado": passo_gravado,
            "total_passos": len(session.get("passos_gravados", []))
        }
        
    except Exception as e:
        logger.error(f"Erro ao inserir credencial: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao inserir credencial: {str(e)}")


@router.get("/sessao/{session_id}/tem-credenciais")
async def verificar_credenciais_sessao(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Verificar se a sessão tem credenciais de parceiro disponíveis"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    credenciais = session.get("credenciais")
    parceiro_nome = session.get("parceiro_nome")
    
    campos_disponiveis = []
    if credenciais:
        if credenciais.get("email") or credenciais.get("username") or credenciais.get("login"):
            campos_disponiveis.append("email")
        if credenciais.get("password") or credenciais.get("senha"):
            campos_disponiveis.append("password")
    
    return {
        "tem_credenciais": credenciais is not None and len(campos_disponiveis) > 0,
        "parceiro_nome": parceiro_nome,
        "campos_disponiveis": campos_disponiveis
    }


@router.get("/sessao/{session_id}/passos")
async def obter_passos_gravados(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter passos gravados na sessão"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    return {
        "passos": session.get("passos_gravados", []),
        "gravando": session.get("gravando", False)
    }


@router.post("/sessao/{session_id}/replay")
async def executar_replay_passos(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Executar replay de todos os passos gravados para testar a automação"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    page = session.get("page")
    if not page:
        raise HTTPException(status_code=400, detail="Página não disponível")
    
    passos = session.get("passos_gravados", [])
    if not passos:
        raise HTTPException(status_code=400, detail="Nenhum passo para executar")
    
    resultados = []
    screenshots = []
    
    try:
        for passo in passos:
            resultado = {
                "ordem": passo.get("ordem"),
                "tipo": passo.get("tipo"),
                "descricao": passo.get("descricao"),
                "sucesso": False,
                "erro": None
            }
            
            try:
                tipo = passo.get("tipo")
                
                if tipo == "click":
                    x = passo.get("x")
                    y = passo.get("y")
                    if x is not None and y is not None:
                        await page.mouse.click(x, y)
                    elif passo.get("seletor"):
                        await page.click(passo["seletor"], timeout=10000)
                        
                elif tipo == "type":
                    valor = passo.get("valor", "")
                    if valor:
                        await page.keyboard.type(valor)
                        
                elif tipo == "press":
                    tecla = passo.get("tecla", "Enter")
                    await page.keyboard.press(tecla)
                    
                elif tipo == "scroll":
                    delta = passo.get("delta", 300)
                    await page.mouse.wheel(0, delta)
                    
                elif tipo == "goto":
                    url = passo.get("valor", "")
                    if url:
                        await page.goto(url, timeout=30000)
                        
                elif tipo == "wait":
                    timeout = passo.get("timeout", 2000)
                    await page.wait_for_timeout(timeout)
                
                resultado["sucesso"] = True
                
                # Capturar screenshot após cada passo
                await page.wait_for_timeout(300)
                screenshot_bytes = await page.screenshot(type="jpeg", quality=50)
                screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
                screenshots.append({
                    "ordem": passo.get("ordem"),
                    "screenshot": screenshot_base64
                })
                
            except Exception as e:
                resultado["erro"] = str(e)
                logger.error(f"Erro no replay passo {passo.get('ordem')}: {e}")
                # Continuar mesmo com erro
            
            resultados.append(resultado)
        
        # Screenshot final
        final_screenshot = await page.screenshot(type="jpeg", quality=60)
        final_base64 = base64.b64encode(final_screenshot).decode()
        
        sucesso_total = all(r["sucesso"] for r in resultados)
        
        return {
            "sucesso": sucesso_total,
            "total_passos": len(passos),
            "passos_sucesso": sum(1 for r in resultados if r["sucesso"]),
            "passos_erro": sum(1 for r in resultados if not r["sucesso"]),
            "resultados": resultados,
            "screenshot_final": final_base64,
            "url_final": page.url
        }
        
    except Exception as e:
        logger.error(f"Erro geral no replay: {e}")
        raise HTTPException(status_code=500, detail=f"Erro no replay: {str(e)}")


@router.post("/sessao/{session_id}/passos/guardar")
async def guardar_passos_na_plataforma(
    session_id: str,
    tipo: str = "extracao",  # login ou extracao
    current_user: dict = Depends(get_current_user)
):
    """Guardar os passos gravados na configuração da plataforma"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    passos = session.get("passos_gravados", [])
    if not passos:
        raise HTTPException(status_code=400, detail="Nenhum passo gravado")
    
    plataforma_id = session.get("plataforma_id")
    
    # Converter passos para formato da plataforma
    passos_convertidos = []
    for p in passos:
        passo = {
            "ordem": p.get("ordem", 0),
            "tipo": p.get("tipo", "click"),
            "descricao": p.get("descricao", ""),
            "timeout": p.get("timeout", 5000)
        }
        
        if p.get("seletor"):
            passo["seletor"] = p["seletor"]
        if p.get("valor"):
            passo["valor"] = p["valor"]
        if p.get("tecla"):
            passo["tecla"] = p["tecla"]
        if p.get("x") is not None and p.get("y") is not None:
            # Para cliques por coordenadas, não temos seletor
            passo["x"] = p["x"]
            passo["y"] = p["y"]
            
        passos_convertidos.append(passo)
    
    # Atualizar plataforma
    campo = "passos_login" if tipo == "login" else "passos_extracao"
    
    result = await db.plataformas.update_one(
        {"id": plataforma_id},
        {
            "$set": {
                campo: passos_convertidos,
                "atualizado_em": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    # Limpar rascunho após guardar definitivamente
    await _limpar_rascunho(plataforma_id, current_user["id"])
    
    logger.info(f"Passos RPA ({tipo}) guardados para plataforma {plataforma_id}: {len(passos_convertidos)} passos")
    
    return {
        "sucesso": True,
        "tipo": tipo,
        "passos_guardados": len(passos_convertidos),
        "mensagem": f"Passos de {tipo} guardados com sucesso"
    }


@router.delete("/sessao/{session_id}/passos/{ordem}")
async def remover_passo(
    session_id: str,
    ordem: int,
    current_user: dict = Depends(get_current_user)
):
    """Remover um passo específico"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    passos = session.get("passos_gravados", [])
    passos = [p for p in passos if p.get("ordem") != ordem]
    
    # Renumerar
    for i, p in enumerate(passos):
        p["ordem"] = i + 1
    
    session["passos_gravados"] = passos
    
    return {
        "sucesso": True,
        "total_passos": len(passos)
    }


@router.delete("/sessao/{session_id}/passos")
async def limpar_passos(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Limpar todos os passos gravados"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    session["passos_gravados"] = []
    
    # Também limpar o rascunho na BD
    await _limpar_rascunho(session.get("plataforma_id"), current_user["id"])
    
    return {"sucesso": True, "mensagem": "Passos limpos"}


@router.get("/rascunho/{plataforma_id}")
async def obter_rascunho(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter rascunho de passos guardados automaticamente"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    rascunho = await db.rpa_rascunhos.find_one(
        {"plataforma_id": plataforma_id, "admin_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not rascunho:
        return {"tem_rascunho": False, "passos": []}
    
    return {
        "tem_rascunho": True,
        "passos": rascunho.get("passos", []),
        "atualizado_em": rascunho.get("atualizado_em")
    }


@router.delete("/rascunho/{plataforma_id}")
async def limpar_rascunho_endpoint(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Limpar rascunho de passos manualmente"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    await _limpar_rascunho(plataforma_id, current_user["id"])
    
    return {"sucesso": True, "mensagem": "Rascunho limpo"}


# WebSocket para comunicação em tempo real
@router.websocket("/ws/{session_id}")
async def websocket_browser_virtual(websocket: WebSocket, session_id: str):
    """WebSocket para comunicação em tempo real com o browser virtual"""
    await websocket.accept()
    
    session = active_sessions.get(session_id)
    if not session:
        await websocket.send_json({"erro": "Sessão não encontrada"})
        await websocket.close()
        return
    
    page = session.get("page")
    if not page:
        await websocket.send_json({"erro": "Página não disponível"})
        await websocket.close()
        return
    
    logger.info(f"WebSocket conectado para sessão: {session_id}")
    
    # Enviar screenshot inicial
    try:
        screenshot_bytes = await page.screenshot(type="jpeg", quality=50)
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
        await websocket.send_json({
            "tipo": "screenshot",
            "url": page.url,
            "data": screenshot_base64
        })
    except Exception as e:
        await websocket.send_json({"erro": f"Erro screenshot inicial: {e}"})
    
    # Loop principal
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=2.0)
                tipo = data.get("tipo", "")
                passo_gravado = None
                
                if tipo == "click":
                    x = data.get("x", 0)
                    y = data.get("y", 0)
                    await page.mouse.click(x, y)
                    if session.get("gravando"):
                        passo_gravado = {
                            "ordem": len(session["passos_gravados"]) + 1,
                            "tipo": "click",
                            "descricao": f"🖱️ Clique ({x}, {y})",
                            "x": x, "y": y
                        }
                        
                elif tipo == "type" or tipo == "inserir_texto":
                    texto = data.get("texto", "")
                    if texto:
                        await page.keyboard.type(texto)
                        if session.get("gravando"):
                            passo_gravado = {
                                "ordem": len(session["passos_gravados"]) + 1,
                                "tipo": "type",
                                "descricao": f"⌨️ {texto[:20]}...",
                                "valor": texto
                            }
                            
                elif tipo == "tecla" or tipo == "press":
                    tecla = data.get("tecla", "Enter")
                    await page.keyboard.press(tecla)
                    if session.get("gravando"):
                        passo_gravado = {
                            "ordem": len(session["passos_gravados"]) + 1,
                            "tipo": "press",
                            "descricao": f"⏎ {tecla}",
                            "tecla": tecla
                        }
                        
                elif tipo == "scroll":
                    direcao = data.get("direcao", "down")
                    delta = 300 if direcao == "down" else -300
                    await page.mouse.wheel(0, delta)
                    if session.get("gravando"):
                        passo_gravado = {
                            "ordem": len(session["passos_gravados"]) + 1,
                            "tipo": "scroll",
                            "descricao": f"📜 Scroll {direcao}",
                            "delta": delta
                        }
                        
                elif tipo == "espera":
                    segundos = data.get("segundos", 2)
                    await page.wait_for_timeout(segundos * 1000)
                    if session.get("gravando"):
                        passo_gravado = {
                            "ordem": len(session["passos_gravados"]) + 1,
                            "tipo": "wait",
                            "descricao": f"⏳ Esperar {segundos}s",
                            "timeout": segundos * 1000
                        }
                        
                elif tipo == "goto":
                    url = data.get("url", "")
                    if url:
                        await page.goto(url, timeout=30000)
                        if session.get("gravando"):
                            passo_gravado = {
                                "ordem": len(session["passos_gravados"]) + 1,
                                "tipo": "goto",
                                "descricao": "🌐 Navegar",
                                "valor": url
                            }
                            
                elif tipo == "gravar_toggle":
                    session["gravando"] = not session.get("gravando", False)
                    await websocket.send_json({
                        "tipo": "gravacao",
                        "gravando": session["gravando"]
                    })
                    continue
                    
                elif tipo == "limpar_passos":
                    session["passos_gravados"] = []
                    await websocket.send_json({
                        "tipo": "passos_limpos",
                        "total": 0
                    })
                    continue
                
                # Gravar passo
                if passo_gravado:
                    session["passos_gravados"].append(passo_gravado)
                    await websocket.send_json({
                        "tipo": "passo_gravado",
                        "passo": passo_gravado,
                        "total": len(session["passos_gravados"])
                    })
                
                # Enviar screenshot após acção
                await page.wait_for_timeout(200)
                screenshot_bytes = await page.screenshot(type="jpeg", quality=50)
                screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
                await websocket.send_json({
                    "tipo": "screenshot",
                    "url": page.url,
                    "data": screenshot_base64
                })
                
            except asyncio.TimeoutError:
                # Enviar screenshot periódico
                try:
                    screenshot_bytes = await page.screenshot(type="jpeg", quality=40)
                    screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
                    await websocket.send_json({
                        "tipo": "screenshot",
                        "url": page.url,
                        "data": screenshot_base64
                    })
                except Exception:
                    pass
                    
    except WebSocketDisconnect:
        logger.info(f"WebSocket desconectado: {session_id}")
    except Exception as e:
        logger.error(f"Erro WebSocket: {e}")
        try:
            await websocket.send_json({"erro": str(e)})
        except Exception:
            pass


@router.get("/sessoes")
async def listar_sessoes_activas(
    current_user: dict = Depends(get_current_user)
):
    """Listar sessões activas (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    sessoes = []
    for session_id, session in active_sessions.items():
        sessoes.append({
            "session_id": session_id,
            "plataforma_nome": session.get("plataforma_nome"),
            "admin_id": session.get("admin_id"),
            "gravando": session.get("gravando", False),
            "total_passos": len(session.get("passos_gravados", [])),
            "criado_em": session.get("criado_em")
        })
    
    return sessoes
