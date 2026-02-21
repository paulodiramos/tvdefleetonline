"""
Rotas para o RPA Designer Visual
- Admin: criar/editar plataformas e designs
- Parceiro: configurar agendamentos e executar
"""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import logging
import os
import uuid
import asyncio
import base64
import json

from models.rpa_designer import (
    PlataformaRPA, DesignRPA, AgendamentoRPA, ExecucaoRPA,
    CriarPlataformaRequest, AtualizarPlataformaRequest,
    CriarDesignRequest, AtualizarDesignRequest,
    ConfigurarAgendamentoRequest, GravarPassoRequest,
    ExecutarDesignRequest, PassoRPA, TipoPasso
)
from utils.database import get_database
from utils.auth import get_current_user
from services.rpa_processor import (
    processar_download, 
    guardar_no_resumo_semanal, 
    garantir_diretorio,
    calcular_semana_ano
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rpa-designer", tags=["RPA Designer"])
db = get_database()

# Configurar Playwright
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'

# Armazenar sessões de design ativas
active_design_sessions: Dict[str, Any] = {}


# ==================== PLATAFORMAS ====================

@router.get("/plataformas")
async def listar_plataformas(
    current_user: dict = Depends(get_current_user)
):
    """Listar todas as plataformas RPA"""
    filtro = {}
    if current_user["role"] != "admin":
        filtro["ativo"] = True
        
    plataformas = await db.plataformas_rpa.find(
        filtro,
        {"_id": 0}
    ).sort("nome", 1).to_list(length=100)
    
    # Adicionar contagem de designs para cada plataforma
    for p in plataformas:
        designs_count = await db.designs_rpa.count_documents({
            "plataforma_id": p["id"],
            "ativo": True
        })
        p["designs_count"] = designs_count
        p["designs_completos"] = designs_count >= p.get("max_semanas", 4)
        
    return plataformas


@router.get("/plataformas/{plataforma_id}")
async def obter_plataforma(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de uma plataforma"""
    plataforma = await db.plataformas_rpa.find_one(
        {"id": plataforma_id},
        {"_id": 0}
    )
    
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
        
    return plataforma


@router.post("/plataformas")
async def criar_plataforma(
    data: CriarPlataformaRequest,
    current_user: dict = Depends(get_current_user)
):
    """Criar nova plataforma (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode criar plataformas")
        
    now = datetime.now(timezone.utc).isoformat()
    
    plataforma = {
        "id": str(uuid.uuid4()),
        "nome": data.nome,
        "url_base": data.url_base,
        "icone": data.icone,
        "descricao": data.descricao,
        "ativo": True,
        "suporta_semanas": data.suporta_semanas,
        "max_semanas": data.max_semanas,
        "campos_credenciais": data.campos_credenciais,
        "tipo_ficheiro": data.tipo_ficheiro,
        "mapeamento_campos": None,
        "criado_por": current_user["id"],
        "criado_em": now,
        "atualizado_em": now,
        "total_execucoes": 0,
        "ultima_execucao": None
    }
    
    await db.plataformas_rpa.insert_one(plataforma)
    
    return {"sucesso": True, "plataforma_id": plataforma["id"], "plataforma": {k: v for k, v in plataforma.items() if k != "_id"}}


@router.put("/plataformas/{plataforma_id}")
async def atualizar_plataforma(
    plataforma_id: str,
    data: AtualizarPlataformaRequest,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar plataforma (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode editar plataformas")
        
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.plataformas_rpa.update_one(
        {"id": plataforma_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
        
    return {"sucesso": True, "mensagem": "Plataforma atualizada"}


@router.delete("/plataformas/{plataforma_id}")
async def desativar_plataforma(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Desativar plataforma (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode desativar plataformas")
        
    await db.plataformas_rpa.update_one(
        {"id": plataforma_id},
        {"$set": {"ativo": False, "atualizado_em": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"sucesso": True, "mensagem": "Plataforma desativada"}


# ==================== DESIGNS ====================

@router.get("/designs")
async def listar_designs(
    plataforma_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar designs de uma plataforma"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode ver designs")
        
    filtro = {"ativo": True}
    if plataforma_id:
        filtro["plataforma_id"] = plataforma_id
        
    designs = await db.designs_rpa.find(
        filtro,
        {"_id": 0}
    ).sort([("plataforma_id", 1), ("semana_offset", 1)]).to_list(length=100)
    
    return designs


@router.get("/designs/{design_id}")
async def obter_design(
    design_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de um design"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode ver designs")
        
    design = await db.designs_rpa.find_one(
        {"id": design_id},
        {"_id": 0}
    )
    
    if not design:
        raise HTTPException(status_code=404, detail="Design não encontrado")
        
    return design


@router.post("/designs")
async def criar_design(
    data: CriarDesignRequest,
    current_user: dict = Depends(get_current_user)
):
    """Criar novo design (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode criar designs")
        
    # Verificar se plataforma existe
    plataforma = await db.plataformas_rpa.find_one({"id": data.plataforma_id})
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
        
    # Verificar se já existe design para esta semana
    existente = await db.designs_rpa.find_one({
        "plataforma_id": data.plataforma_id,
        "semana_offset": data.semana_offset,
        "ativo": True
    })
    
    if existente:
        raise HTTPException(
            status_code=400, 
            detail=f"Já existe design para semana {data.semana_offset} desta plataforma"
        )
        
    now = datetime.now(timezone.utc).isoformat()
    
    design = {
        "id": str(uuid.uuid4()),
        "plataforma_id": data.plataforma_id,
        "nome": data.nome,
        "semana_offset": data.semana_offset,
        "passos": [p.dict() for p in data.passos],
        "variaveis": data.variaveis,
        "versao": 1,
        "testado": False,
        "ativo": True,
        "criado_por": current_user["id"],
        "criado_em": now,
        "atualizado_em": now,
        "total_execucoes": 0,
        "execucoes_sucesso": 0,
        "ultima_execucao": None
    }
    
    await db.designs_rpa.insert_one(design)
    
    return {"sucesso": True, "design_id": design["id"]}


@router.put("/designs/{design_id}")
async def atualizar_design(
    design_id: str,
    data: AtualizarDesignRequest,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar design (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode editar designs")
        
    # Buscar design atual para incrementar versão
    design_atual = await db.designs_rpa.find_one({"id": design_id})
    versao_atual = design_atual.get("versao", 0) if design_atual else 0
        
    update_data = {}
    
    if data.nome is not None:
        update_data["nome"] = data.nome
    if data.passos is not None:
        update_data["passos"] = [p.dict() for p in data.passos]
    if data.variaveis is not None:
        update_data["variaveis"] = data.variaveis
    if data.testado is not None:
        update_data["testado"] = data.testado
    if data.ativo is not None:
        update_data["ativo"] = data.ativo
        
    if update_data:
        update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
        update_data["versao"] = versao_atual + 1
        
        await db.designs_rpa.update_one(
            {"id": design_id},
            {"$set": update_data}
        )
        
    return {"sucesso": True, "mensagem": "Design atualizado"}


@router.delete("/designs/{design_id}")
async def eliminar_design(
    design_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar design (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode eliminar designs")
        
    await db.designs_rpa.update_one(
        {"id": design_id},
        {"$set": {"ativo": False, "atualizado_em": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"sucesso": True, "mensagem": "Design eliminado"}


# ==================== SESSÃO DE DESIGN (Browser Interativo) ====================

class IniciarSessaoRequest(BaseModel):
    """Request para iniciar sessão de design"""
    plataforma_id: str
    semana_offset: int = 0
    usar_sessao_parceiro: Optional[Dict[str, Any]] = None  # {parceiro_id, session_path}
    url_inicial: Optional[str] = None  # URL para começar (pós-login)

@router.post("/sessao/iniciar")
async def iniciar_sessao_design(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Iniciar sessão de gravação de design (admin only)
    
    Body JSON:
        plataforma_id: ID da plataforma
        semana_offset: Offset da semana (0=atual, 1=-1 semana, etc)
        parceiro_id: ID do parceiro cuja sessão usar (opcional)
        url_inicial: URL para começar em vez da URL base (opcional)
        credenciais_teste: {username, password} para login automático (opcional)
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode criar designs")
    
    # Parse body
    try:
        body = await request.json()
    except:
        body = {}
    
    plataforma_id = body.get("plataforma_id")
    semana_offset = body.get("semana_offset", 0)
    parceiro_id = body.get("parceiro_id")
    url_inicial = body.get("url_inicial")
    credenciais_teste = body.get("credenciais_teste")
    
    if not plataforma_id:
        raise HTTPException(status_code=400, detail="plataforma_id é obrigatório")
        
    # Verificar plataforma
    plataforma = await db.plataformas_rpa.find_one({"id": plataforma_id})
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    # Verificar sessão do parceiro se fornecido
    usar_sessao_parceiro = None
    if parceiro_id:
        import os
        # Mapear nome da plataforma para prefixo do ficheiro
        plataforma_nome = plataforma.get("nome", "").lower()
        if "uber" in plataforma_nome:
            session_path = f"/tmp/uber_sessao_{parceiro_id}.json"
        elif "bolt" in plataforma_nome:
            session_path = f"/tmp/bolt_sessao_{parceiro_id}.json"
        elif "via verde" in plataforma_nome or "viaverde" in plataforma_nome:
            session_path = f"/tmp/viaverde_sessao_{parceiro_id}.json"
        elif "prio" in plataforma_nome:
            session_path = f"/tmp/prio_sessao_{parceiro_id}.json"
        else:
            session_path = f"/tmp/sessao_{parceiro_id}.json"
        
        if os.path.exists(session_path):
            usar_sessao_parceiro = {
                "parceiro_id": parceiro_id,
                "session_path": session_path
            }
            logger.info(f"Usando sessão do parceiro {parceiro_id}: {session_path}")
        else:
            logger.warning(f"Sessão do parceiro {parceiro_id} não encontrada: {session_path}")
        
    session_id = str(uuid.uuid4())
    
    # Criar sessão
    active_design_sessions[session_id] = {
        "id": session_id,
        "plataforma_id": plataforma_id,
        "plataforma": {k: v for k, v in plataforma.items() if k != "_id"},
        "semana_offset": semana_offset,
        "admin_id": current_user["id"],
        "passos": [],
        "gravando": False,
        "browser": None,
        "page": None,
        "playwright": None,
        "usar_sessao_parceiro": usar_sessao_parceiro,
        "credenciais_teste": credenciais_teste,  # Guardar credenciais de teste
        "url_inicial": url_inicial or plataforma["url_base"],
        "criado_em": datetime.now(timezone.utc).isoformat()
    }
    
    return {
        "session_id": session_id,
        "plataforma": plataforma["nome"],
        "url_base": plataforma["url_base"],
        "url_inicial": url_inicial or plataforma["url_base"],
        "semana_offset": semana_offset,
        "usando_sessao_parceiro": usar_sessao_parceiro is not None,
        "usando_credenciais_teste": credenciais_teste is not None,
        "parceiro_id": parceiro_id
    }


@router.post("/sessao/{session_id}/gravar-passo")
async def gravar_passo(
    session_id: str,
    passo: GravarPassoRequest,
    current_user: dict = Depends(get_current_user)
):
    """Gravar um passo na sessão atual"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode gravar passos")
        
    if session_id not in active_design_sessions:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
    session = active_design_sessions[session_id]
    
    # Criar passo
    novo_passo = {
        "ordem": len(session["passos"]) + 1,
        "tipo": passo.tipo.value,
        "seletor": passo.seletor,
        "seletor_tipo": passo.seletor_tipo,
        "valor": passo.valor,
        "coordenadas": passo.coordenadas,
        "screenshot_antes": passo.screenshot,
        "descricao": f"{passo.tipo.value}: {passo.seletor or passo.valor or ''}"
    }
    
    session["passos"].append(novo_passo)
    
    return {
        "sucesso": True,
        "passo_ordem": novo_passo["ordem"],
        "total_passos": len(session["passos"])
    }


@router.get("/sessao/{session_id}/passos")
async def obter_passos_sessao(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter passos gravados na sessão"""
    if session_id not in active_design_sessions:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
    session = active_design_sessions[session_id]
    return {
        "passos": session["passos"],
        "total": len(session["passos"])
    }


@router.delete("/sessao/{session_id}/passos/{ordem}")
async def remover_passo(
    session_id: str,
    ordem: int,
    current_user: dict = Depends(get_current_user)
):
    """Remover um passo da sessão"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode editar passos")
        
    if session_id not in active_design_sessions:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
    session = active_design_sessions[session_id]
    session["passos"] = [p for p in session["passos"] if p["ordem"] != ordem]
    
    # Reordenar
    for i, p in enumerate(session["passos"]):
        p["ordem"] = i + 1
        
    return {"sucesso": True, "total_passos": len(session["passos"])}


@router.post("/sessao/{session_id}/guardar")
async def guardar_sessao_como_design(
    session_id: str,
    nome: str,
    current_user: dict = Depends(get_current_user)
):
    """Guardar sessão como design"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode guardar designs")
        
    if session_id not in active_design_sessions:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
    session = active_design_sessions[session_id]
    
    # Permitir guardar mesmo sem passos (design vazio)
    now = datetime.now(timezone.utc).isoformat()
    
    # Verificar se já existe design para esta semana
    existente = await db.designs_rpa.find_one({
        "plataforma_id": session["plataforma_id"],
        "semana_offset": session["semana_offset"],
        "ativo": True
    })
    
    if existente:
        # Atualizar existente
        await db.designs_rpa.update_one(
            {"id": existente["id"]},
            {"$set": {
                "nome": nome,
                "passos": session["passos"],
                "versao": existente.get("versao", 0) + 1,
                "testado": False,
                "atualizado_em": now
            }}
        )
        design_id = existente["id"]
    else:
        # Criar novo
        design_id = str(uuid.uuid4())
        design = {
            "id": design_id,
            "plataforma_id": session["plataforma_id"],
            "nome": nome,
            "semana_offset": session["semana_offset"],
            "passos": session["passos"],
            "variaveis": ["SEMANA_INICIO", "SEMANA_FIM", "SEMANA_OFFSET"],
            "versao": 1,
            "testado": False,
            "ativo": True,
            "criado_por": current_user["id"],
            "criado_em": now,
            "atualizado_em": now,
            "total_execucoes": 0,
            "execucoes_sucesso": 0,
            "ultima_execucao": None
        }
        await db.designs_rpa.insert_one(design)
        
    # Limpar sessão
    del active_design_sessions[session_id]
    
    return {
        "sucesso": True,
        "design_id": design_id,
        "passos_gravados": len(session["passos"])
    }


@router.delete("/sessao/{session_id}")
async def cancelar_sessao(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancelar sessão de design"""
    if session_id in active_design_sessions:
        session = active_design_sessions[session_id]
        # Fechar browser se existir
        if session.get("browser"):
            await session["browser"].close()
        if session.get("playwright"):
            await session["playwright"].stop()
        del active_design_sessions[session_id]
        
    return {"sucesso": True, "mensagem": "Sessão cancelada"}


# ==================== SESSÃO LOGIN PARCEIRO (para evitar CAPTCHA) ====================

# Armazenar sessões de login ativas
active_login_sessions: Dict[str, Any] = {}

class IniciarLoginRequest(BaseModel):
    plataforma: str  # uber, bolt, viaverde, prio

@router.post("/parceiro/iniciar-login")
async def iniciar_sessao_login_parceiro(
    data: IniciarLoginRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Inicia uma sessão de browser para o parceiro fazer login manual.
    O parceiro faz login, resolve o CAPTCHA, e depois guardamos os cookies.
    """
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    # URLs de login por plataforma
    login_urls = {
        "uber": "https://auth.uber.com/v2/",
        "bolt": "https://fleets.bolt.eu/login",
        "viaverde": "https://www.viaverde.pt/particulares/area-cliente",
        "prio": "https://www.myprio.com/MyPrioReactiveTheme/Login"
    }
    
    if data.plataforma not in login_urls:
        raise HTTPException(status_code=400, detail=f"Plataforma '{data.plataforma}' não suportada")
    
    session_id = str(uuid.uuid4())
    
    active_login_sessions[session_id] = {
        "id": session_id,
        "parceiro_id": parceiro_id,
        "plataforma": data.plataforma,
        "url_login": login_urls[data.plataforma],
        "criado_em": datetime.now(timezone.utc).isoformat(),
        "status": "aguardando_login"
    }
    
    return {
        "session_id": session_id,
        "url_login": login_urls[data.plataforma],
        "plataforma": data.plataforma,
        "instrucoes": "Faça login normalmente. Quando terminar, clique em 'Guardar Sessão'."
    }


@router.post("/parceiro/guardar-sessao/{session_id}")
async def guardar_sessao_login(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Guarda os cookies da sessão de login do parceiro.
    Chamado via WebSocket quando o login é concluído.
    """
    if session_id not in active_login_sessions:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    session = active_login_sessions[session_id]
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    if session["parceiro_id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Sessão não pertence a este parceiro")
    
    # Os cookies são guardados pelo WebSocket
    if session.get("cookies_guardados"):
        return {
            "sucesso": True,
            "mensagem": f"Sessão {session['plataforma']} guardada com sucesso!",
            "validade_dias": 7
        }
    else:
        raise HTTPException(status_code=400, detail="Sessão ainda não tem cookies guardados")


@router.get("/parceiro/sessoes")
async def listar_sessoes_parceiro(
    current_user: dict = Depends(get_current_user)
):
    """Lista as sessões de login guardadas do parceiro"""
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    sessoes = []
    plataformas = ["uber", "bolt", "viaverde", "prio"]
    
    for plat in plataformas:
        session_path = f"/tmp/{plat}_sessao_{parceiro_id}.json"
        if os.path.exists(session_path):
            try:
                stat = os.stat(session_path)
                idade_dias = (datetime.now().timestamp() - stat.st_mtime) / 86400
                sessoes.append({
                    "plataforma": plat,
                    "guardada_em": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "idade_dias": round(idade_dias, 1),
                    "valida": idade_dias < 7,
                    "path": session_path
                })
            except Exception as e:
                logger.error(f"Erro ao verificar sessão {plat}: {e}")
    
    return {"sessoes": sessoes}


@router.websocket("/ws/parceiro-login/{session_id}")
async def websocket_parceiro_login(websocket: WebSocket, session_id: str):
    """
    WebSocket para sessão de login do parceiro.
    Abre um browser para o parceiro fazer login manual.
    """
    await websocket.accept()
    
    if session_id not in active_login_sessions:
        await websocket.send_json({"erro": "Sessão não encontrada"})
        await websocket.close()
        return
    
    session = active_login_sessions[session_id]
    parceiro_id = session["parceiro_id"]
    plataforma = session["plataforma"]
    url_login = session["url_login"]
    
    browser = None
    playwright_instance = None
    
    try:
        from playwright.async_api import async_playwright
        
        playwright_instance = await async_playwright().start()
        
        # Usar browser com UI visível (não headless) para o utilizador interagir
        browser = await playwright_instance.chromium.launch(
            headless=True,  # Headless porque vamos mostrar screenshots
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        page = await context.new_page()
        
        logger.info(f"Parceiro {parceiro_id} a iniciar login em {plataforma}")
        
        # Navegar para a página de login
        await page.goto(url_login, wait_until="domcontentloaded", timeout=30000)
        
        # Enviar screenshot inicial
        screenshot = await page.screenshot(type="jpeg", quality=50)
        await websocket.send_json({
            "tipo": "screenshot",
            "data": base64.b64encode(screenshot).decode(),
            "url": page.url,
            "status": "aguardando_login"
        })
        
        # Loop de interação
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=2.0)
                logger.info(f"Login parceiro - comando: {data}")
                
                if data.get("tipo") == "click":
                    x, y = data.get("x", 0), data.get("y", 0)
                    await page.mouse.click(x, y)
                    await asyncio.sleep(0.5)
                    
                elif data.get("tipo") == "type" or data.get("tipo") == "inserir_texto":
                    texto = data.get("texto", "")
                    await page.keyboard.type(texto, delay=50)
                    
                elif data.get("tipo") == "press" or data.get("tipo") == "tecla":
                    tecla = data.get("tecla", "Enter")
                    await page.keyboard.press(tecla)
                    
                elif data.get("tipo") == "scroll":
                    direcao = data.get("direcao", "down")
                    delta = 300 if direcao == "down" else -300
                    await page.mouse.wheel(0, delta)
                    
                elif data.get("tipo") == "guardar_sessao":
                    # Guardar cookies e estado da sessão
                    cookies = await context.cookies()
                    storage = await context.storage_state()
                    
                    session_data = {
                        "cookies": cookies,
                        "storage_state": storage,
                        "url_atual": page.url,
                        "guardado_em": datetime.now(timezone.utc).isoformat(),
                        "parceiro_id": parceiro_id,
                        "plataforma": plataforma
                    }
                    
                    # Guardar em ficheiro
                    session_path = f"/tmp/{plataforma}_sessao_{parceiro_id}.json"
                    with open(session_path, 'w') as f:
                        json.dump(session_data, f)
                    
                    session["cookies_guardados"] = True
                    session["session_path"] = session_path
                    
                    logger.info(f"Sessão {plataforma} guardada para parceiro {parceiro_id}")
                    
                    await websocket.send_json({
                        "tipo": "sessao_guardada",
                        "sucesso": True,
                        "mensagem": f"Sessão {plataforma} guardada! Válida por ~7 dias.",
                        "path": session_path
                    })
                    break
                
                # Enviar screenshot atualizado
                await asyncio.sleep(0.3)
                screenshot = await page.screenshot(type="jpeg", quality=50)
                
                # Verificar se login foi bem sucedido (URL mudou da página de login)
                login_concluido = False
                if plataforma == "uber" and "auth.uber.com" not in page.url:
                    login_concluido = True
                elif plataforma == "bolt" and "/login" not in page.url:
                    login_concluido = True
                elif plataforma == "viaverde" and "area-cliente" in page.url and "login" not in page.url.lower():
                    login_concluido = True
                elif plataforma == "prio" and "/Login" not in page.url:
                    login_concluido = True
                
                await websocket.send_json({
                    "tipo": "screenshot",
                    "data": base64.b64encode(screenshot).decode(),
                    "url": page.url,
                    "status": "login_concluido" if login_concluido else "aguardando_login",
                    "pode_guardar": login_concluido
                })
                
            except asyncio.TimeoutError:
                # Enviar screenshot periódico
                try:
                    screenshot = await page.screenshot(type="jpeg", quality=50)
                    
                    login_concluido = False
                    if plataforma == "uber" and "auth.uber.com" not in page.url:
                        login_concluido = True
                    elif plataforma == "bolt" and "/login" not in page.url:
                        login_concluido = True
                    elif plataforma == "viaverde" and "area-cliente" in page.url:
                        login_concluido = True
                    elif plataforma == "prio" and "/Login" not in page.url:
                        login_concluido = True
                    
                    await websocket.send_json({
                        "tipo": "screenshot",
                        "data": base64.b64encode(screenshot).decode(),
                        "url": page.url,
                        "status": "login_concluido" if login_concluido else "aguardando_login",
                        "pode_guardar": login_concluido
                    })
                except Exception:
                    pass
                    
    except WebSocketDisconnect:
        logger.info(f"WebSocket login desconectado: {session_id}")
    except Exception as e:
        logger.error(f"Erro no WebSocket login: {e}")
        try:
            await websocket.send_json({"erro": str(e)})
        except:
            pass
    finally:
        if browser:
            await browser.close()
        if playwright_instance:
            await playwright_instance.stop()
        if session_id in active_login_sessions:
            del active_login_sessions[session_id]


# ==================== MOTOR DE EXECUÇÃO RPA ====================

class ExecutarDesignRequest(BaseModel):
    design_id: str
    parceiro_id: str
    usar_sessao: bool = True

@router.post("/executar-design")
async def executar_design_rpa(
    data: ExecutarDesignRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Inicia a execução de um design RPA.
    Retorna um execution_id para acompanhar via WebSocket.
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode executar designs")
    
    # Verificar design
    design = await db.rpa_designs.find_one({"id": data.design_id})
    if not design:
        raise HTTPException(status_code=404, detail="Design não encontrado")
    
    # Verificar plataforma
    plataforma = await db.plataformas_rpa.find_one({"id": design["plataforma_id"]})
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    # Verificar sessão do parceiro
    session_path = None
    if data.usar_sessao:
        plat_nome = plataforma.get("nome", "").lower()
        if "uber" in plat_nome:
            session_path = f"/tmp/uber_sessao_{data.parceiro_id}.json"
        elif "bolt" in plat_nome:
            session_path = f"/tmp/bolt_sessao_{data.parceiro_id}.json"
        elif "viaverde" in plat_nome or "via verde" in plat_nome:
            session_path = f"/tmp/viaverde_sessao_{data.parceiro_id}.json"
        elif "prio" in plat_nome:
            session_path = f"/tmp/prio_sessao_{data.parceiro_id}.json"
        
        if session_path and not os.path.exists(session_path):
            return {
                "erro": True,
                "mensagem": f"Sessão do parceiro não encontrada. O parceiro precisa fazer login em /login-plataformas primeiro.",
                "session_path": session_path
            }
    
    execution_id = str(uuid.uuid4())
    
    return {
        "execution_id": execution_id,
        "design_id": data.design_id,
        "design_nome": design.get("nome"),
        "plataforma": plataforma.get("nome"),
        "parceiro_id": data.parceiro_id,
        "session_path": session_path,
        "total_passos": len(design.get("passos", []))
    }


@router.websocket("/ws/executar/{execution_id}")
async def websocket_executar_design(
    websocket: WebSocket, 
    execution_id: str
):
    """
    WebSocket para executar um design RPA com visualização em tempo real.
    O frontend envia os parâmetros de execução após conectar.
    """
    await websocket.accept()
    
    browser = None
    playwright_instance = None
    
    try:
        # Receber parâmetros de execução
        params = await websocket.receive_json()
        design_id = params.get("design_id")
        parceiro_id = params.get("parceiro_id")
        session_path = params.get("session_path")
        
        # Buscar design
        design = await db.rpa_designs.find_one({"id": design_id})
        if not design:
            await websocket.send_json({"erro": "Design não encontrado"})
            await websocket.close()
            return
        
        # Buscar plataforma
        plataforma = await db.plataformas_rpa.find_one({"id": design["plataforma_id"]})
        
        passos = design.get("passos", [])
        
        await websocket.send_json({
            "tipo": "inicio",
            "design": design.get("nome"),
            "total_passos": len(passos),
            "plataforma": plataforma.get("nome") if plataforma else "Desconhecida"
        })
        
        from playwright.async_api import async_playwright
        
        playwright_instance = await async_playwright().start()
        
        # Carregar sessão se disponível
        storage_state = None
        if session_path and os.path.exists(session_path):
            try:
                with open(session_path, 'r') as f:
                    session_data = json.load(f)
                    storage_state = session_data.get("storage_state")
                logger.info(f"Sessão carregada de {session_path}")
                await websocket.send_json({
                    "tipo": "info",
                    "mensagem": "Sessão do parceiro carregada"
                })
            except Exception as e:
                logger.error(f"Erro ao carregar sessão: {e}")
        
        # Iniciar browser
        browser = await playwright_instance.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        )
        
        # Configurar diretório de downloads
        download_dir = garantir_diretorio(parceiro_id)
        
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            storage_state=storage_state,
            accept_downloads=True
        )
        
        page = await context.new_page()
        
        # Lista para guardar downloads
        downloads_capturados = []
        
        # Handler para downloads
        async def handle_download(download):
            filepath = os.path.join(download_dir, download.suggested_filename)
            await download.save_as(filepath)
            downloads_capturados.append(filepath)
            logger.info(f"Download guardado: {filepath}")
            await websocket.send_json({
                "tipo": "download_capturado",
                "ficheiro": download.suggested_filename,
                "path": filepath
            })
        
        page.on("download", handle_download)
        
        # Navegar para URL base da plataforma
        url_base = plataforma.get("url_base", "https://www.google.com") if plataforma else "https://www.google.com"
        
        await websocket.send_json({
            "tipo": "progresso",
            "passo": 0,
            "total": len(passos),
            "descricao": f"A navegar para {url_base}..."
        })
        
        await page.goto(url_base, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(2)
        
        # Screenshot inicial
        screenshot = await page.screenshot(type="jpeg", quality=50)
        await websocket.send_json({
            "tipo": "screenshot",
            "data": base64.b64encode(screenshot).decode(),
            "url": page.url,
            "passo": 0
        })
        
        # Executar cada passo
        for i, passo in enumerate(passos):
            tipo = passo.get("tipo")
            
            await websocket.send_json({
                "tipo": "progresso",
                "passo": i + 1,
                "total": len(passos),
                "descricao": passo.get("descricao", f"Passo {i+1}: {tipo}")
            })
            
            try:
                if tipo == "click":
                    coords = passo.get("coordenadas", {})
                    x, y = coords.get("x", 0), coords.get("y", 0)
                    seletor = passo.get("seletor")
                    
                    # Tentar clicar por seletor primeiro
                    if seletor and seletor not in ["html", "body", "div"]:
                        try:
                            await page.click(seletor, timeout=3000)
                        except:
                            await page.mouse.click(x, y)
                    else:
                        await page.mouse.click(x, y)
                    
                    await asyncio.sleep(0.5)
                    
                elif tipo == "type":
                    texto = passo.get("valor", "")
                    await page.keyboard.type(texto, delay=50)
                    await asyncio.sleep(0.3)
                    
                elif tipo == "press":
                    tecla = passo.get("valor", "Enter")
                    await page.keyboard.press(tecla)
                    await asyncio.sleep(0.3)
                    
                elif tipo == "scroll":
                    delta = passo.get("valor", 300)
                    await page.mouse.wheel(0, delta)
                    await asyncio.sleep(0.3)
                    
                elif tipo == "wait":
                    timeout = passo.get("timeout", 3000)
                    await asyncio.sleep(timeout / 1000)
                    
                elif tipo == "goto":
                    url = passo.get("valor", "")
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await asyncio.sleep(1)
                    
                elif tipo == "download":
                    # Aguardar download com timeout
                    await websocket.send_json({
                        "tipo": "info",
                        "mensagem": "A aguardar download..."
                    })
                    await asyncio.sleep(10)  # Esperar mais tempo para download
                
                # Screenshot após cada passo
                await asyncio.sleep(0.5)
                screenshot = await page.screenshot(type="jpeg", quality=50)
                await websocket.send_json({
                    "tipo": "screenshot",
                    "data": base64.b64encode(screenshot).decode(),
                    "url": page.url,
                    "passo": i + 1
                })
                
            except Exception as e:
                logger.error(f"Erro no passo {i+1}: {e}")
                await websocket.send_json({
                    "tipo": "erro_passo",
                    "passo": i + 1,
                    "erro": str(e)
                })
        
        # Aguardar um pouco mais para downloads pendentes
        await asyncio.sleep(3)
        
        # Processar downloads capturados
        dados_extraidos = []
        plataforma_nome = plataforma.get("nome", "") if plataforma else ""
        semana_offset = design.get("semana_offset", 0)
        semana, ano = calcular_semana_ano(semana_offset)
        
        for filepath in downloads_capturados:
            await websocket.send_json({
                "tipo": "info",
                "mensagem": f"A processar: {os.path.basename(filepath)}..."
            })
            
            resultado = processar_download(filepath, plataforma_nome)
            dados_extraidos.append(resultado)
            
            if resultado["sucesso"]:
                await websocket.send_json({
                    "tipo": "dados_extraidos",
                    "plataforma": resultado["plataforma"],
                    "dados": resultado["dados"]
                })
                
                # Guardar no resumo semanal
                # Nota: precisamos do motorista_id - por agora usar o parceiro_id
                resultado_guardar = await guardar_no_resumo_semanal(
                    db,
                    parceiro_id=parceiro_id,
                    motorista_id=parceiro_id,  # TODO: obter motorista correto
                    semana=semana,
                    ano=ano,
                    dados=resultado["dados"],
                    plataforma=plataforma_nome
                )
                
                if resultado_guardar["sucesso"]:
                    await websocket.send_json({
                        "tipo": "resumo_atualizado",
                        "semana": semana,
                        "ano": ano,
                        "campos": resultado_guardar["campos_atualizados"]
                    })
            else:
                await websocket.send_json({
                    "tipo": "erro_processamento",
                    "erro": resultado["erro"]
                })
        
        # Finalizado
        await websocket.send_json({
            "tipo": "concluido",
            "sucesso": True,
            "mensagem": f"Design '{design.get('nome')}' executado com sucesso!",
            "total_passos": len(passos),
            "downloads": len(downloads_capturados),
            "dados_extraidos": len([d for d in dados_extraidos if d["sucesso"]]),
            "semana": semana,
            "ano": ano
        })
        
        # Atualizar estatísticas do design
        await db.rpa_designs.update_one(
            {"id": design_id},
            {
                "$inc": {"total_execucoes": 1, "execucoes_sucesso": 1},
                "$set": {"ultima_execucao": datetime.now(timezone.utc).isoformat()}
            }
        )
        
    except WebSocketDisconnect:
        logger.info(f"WebSocket execução desconectado: {execution_id}")
    except Exception as e:
        logger.error(f"Erro na execução: {e}")
        try:
            await websocket.send_json({"tipo": "erro", "mensagem": str(e)})
        except:
            pass
    finally:
        if browser:
            await browser.close()
        if playwright_instance:
            await playwright_instance.stop()


# ==================== AGENDAMENTOS ====================

@router.get("/agendamentos")
async def listar_agendamentos(
    current_user: dict = Depends(get_current_user)
):
    """Listar agendamentos do parceiro atual"""
    if current_user["role"] == "admin":
        # Admin vê todos
        agendamentos = await db.agendamentos_rpa.find(
            {},
            {"_id": 0}
        ).to_list(length=100)
    else:
        parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
        agendamentos = await db.agendamentos_rpa.find(
            {"parceiro_id": parceiro_id},
            {"_id": 0}
        ).to_list(length=100)
        
    # Enriquecer com nome da plataforma
    for ag in agendamentos:
        plataforma = await db.plataformas_rpa.find_one({"id": ag["plataforma_id"]})
        ag["plataforma_nome"] = plataforma["nome"] if plataforma else "Desconhecida"
        ag["plataforma_icone"] = plataforma.get("icone", "🔗") if plataforma else "🔗"
        
    return agendamentos


@router.post("/agendamentos")
async def configurar_agendamento(
    data: ConfigurarAgendamentoRequest,
    current_user: dict = Depends(get_current_user)
):
    """Configurar agendamento de sincronização"""
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    # Verificar se plataforma existe
    plataforma = await db.plataformas_rpa.find_one({"id": data.plataforma_id})
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
        
    now = datetime.now(timezone.utc)
    
    # Calcular próxima execução
    proxima_execucao = None
    if data.modo == "automatico":
        proxima_execucao = _calcular_proxima_execucao(
            data.frequencia,
            data.dia_semana,
            data.dia_mes,
            data.hora
        )
        
    # Verificar se já existe agendamento
    existente = await db.agendamentos_rpa.find_one({
        "parceiro_id": parceiro_id,
        "plataforma_id": data.plataforma_id
    })
    
    if existente:
        # Atualizar
        await db.agendamentos_rpa.update_one(
            {"id": existente["id"]},
            {"$set": {
                "modo": data.modo,
                "frequencia": data.frequencia,
                "dia_semana": data.dia_semana,
                "dia_mes": data.dia_mes,
                "hora": data.hora,
                "semanas_ativas": data.semanas_ativas,
                "ativo": data.ativo,
                "proxima_execucao": proxima_execucao.isoformat() if proxima_execucao else None,
                "atualizado_em": now.isoformat()
            }}
        )
        return {"sucesso": True, "mensagem": "Agendamento atualizado"}
    else:
        # Criar novo
        agendamento = {
            "id": str(uuid.uuid4()),
            "parceiro_id": parceiro_id,
            "plataforma_id": data.plataforma_id,
            "modo": data.modo,
            "frequencia": data.frequencia,
            "dia_semana": data.dia_semana,
            "dia_mes": data.dia_mes,
            "hora": data.hora,
            "semanas_ativas": data.semanas_ativas,
            "ativo": data.ativo,
            "ultima_execucao": None,
            "proxima_execucao": proxima_execucao.isoformat() if proxima_execucao else None,
            "ultimo_resultado": None,
            "ultimo_erro": None,
            "criado_em": now.isoformat(),
            "atualizado_em": now.isoformat()
        }
        await db.agendamentos_rpa.insert_one(agendamento)
        return {"sucesso": True, "mensagem": "Agendamento criado"}


def _calcular_proxima_execucao(frequencia: str, dia_semana: int, dia_mes: int, hora: str) -> datetime:
    """Calcular próxima data de execução"""
    agora = datetime.now(timezone.utc)
    hora_parts = hora.split(":")
    hora_int = int(hora_parts[0])
    minuto_int = int(hora_parts[1]) if len(hora_parts) > 1 else 0
    
    if frequencia == "diario":
        proxima = agora.replace(hour=hora_int, minute=minuto_int, second=0, microsecond=0)
        if proxima <= agora:
            proxima += timedelta(days=1)
            
    elif frequencia == "semanal":
        dias_ate_dia = (dia_semana - agora.weekday()) % 7
        if dias_ate_dia == 0:
            proxima = agora.replace(hour=hora_int, minute=minuto_int, second=0, microsecond=0)
            if proxima <= agora:
                dias_ate_dia = 7
        proxima = agora + timedelta(days=dias_ate_dia)
        proxima = proxima.replace(hour=hora_int, minute=minuto_int, second=0, microsecond=0)
        
    elif frequencia == "mensal":
        proxima = agora.replace(day=dia_mes, hour=hora_int, minute=minuto_int, second=0, microsecond=0)
        if proxima <= agora:
            # Próximo mês
            if agora.month == 12:
                proxima = proxima.replace(year=agora.year + 1, month=1)
            else:
                proxima = proxima.replace(month=agora.month + 1)
                
    else:
        proxima = agora + timedelta(days=1)
        
    return proxima


# ==================== EXECUÇÃO ====================

@router.post("/executar")
async def executar_design_manual(
    data: ExecutarDesignRequest,
    current_user: dict = Depends(get_current_user)
):
    """Executar design manualmente (parceiro)"""
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    # Buscar design
    design = await db.designs_rpa.find_one({
        "plataforma_id": data.plataforma_id,
        "semana_offset": data.semana_offset,
        "ativo": True
    })
    
    if not design:
        raise HTTPException(
            status_code=404, 
            detail=f"Design não encontrado para semana {data.semana_offset}"
        )
        
    # Buscar credenciais do parceiro
    plataforma = await db.plataformas_rpa.find_one({"id": data.plataforma_id})
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
        
    # Buscar credenciais
    cred = await db.credenciais_plataformas.find_one({
        "parceiro_id": parceiro_id,
        "plataforma_id": data.plataforma_id
    })
    
    if not cred:
        raise HTTPException(
            status_code=400, 
            detail="Configure primeiro as credenciais desta plataforma"
        )
        
    # Criar registo de execução
    now = datetime.now(timezone.utc)
    execucao = {
        "id": str(uuid.uuid4()),
        "design_id": design["id"],
        "plataforma_id": data.plataforma_id,
        "parceiro_id": parceiro_id,
        "status": "a_executar",
        "erro": None,
        "ficheiro_download": None,
        "registos_importados": 0,
        "dados_extraidos": None,
        "iniciado_em": now.isoformat(),
        "terminado_em": None,
        "duracao_segundos": None,
        "screenshots": [],
        "logs": []
    }
    await db.execucoes_rpa.insert_one(execucao)
    
    # Executar em background
    try:
        from services.rpa_executor import executar_design_parceiro
        
        credenciais = {
            "email": cred.get("email", ""),
            "password": cred.get("password", ""),
            "telefone": cred.get("telefone", "")
        }
        
        resultado = await executar_design_parceiro(
            parceiro_id,
            data.plataforma_id,
            {k: v for k, v in design.items() if k != "_id"},
            credenciais
        )
        
        # Atualizar execução
        fim = datetime.now(timezone.utc)
        duracao = (fim - now).total_seconds()
        
        await db.execucoes_rpa.update_one(
            {"id": execucao["id"]},
            {"$set": {
                "status": "sucesso" if resultado.get("sucesso") else "erro",
                "erro": resultado.get("erro"),
                "ficheiro_download": resultado.get("ficheiro"),
                "terminado_em": fim.isoformat(),
                "duracao_segundos": duracao,
                "screenshots": resultado.get("screenshots", []),
                "logs": resultado.get("logs", [])
            }}
        )
        
        # Atualizar estatísticas do design
        await db.designs_rpa.update_one(
            {"id": design["id"]},
            {
                "$inc": {
                    "total_execucoes": 1,
                    "execucoes_sucesso": 1 if resultado.get("sucesso") else 0
                },
                "$set": {"ultima_execucao": now.isoformat()}
            }
        )
        
        return {
            "sucesso": resultado.get("sucesso", False),
            "execucao_id": execucao["id"],
            "ficheiro": resultado.get("ficheiro"),
            "logs": resultado.get("logs", [])[-10:],  # Últimos 10 logs
            "erro": resultado.get("erro")
        }
        
    except Exception as e:
        # Atualizar execução com erro
        await db.execucoes_rpa.update_one(
            {"id": execucao["id"]},
            {"$set": {
                "status": "erro",
                "erro": str(e),
                "terminado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/execucoes")
async def listar_execucoes(
    plataforma_id: Optional[str] = None,
    limite: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Listar histórico de execuções"""
    if current_user["role"] == "admin":
        filtro = {}
    else:
        parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
        filtro = {"parceiro_id": parceiro_id}
        
    if plataforma_id:
        filtro["plataforma_id"] = plataforma_id
        
    execucoes = await db.execucoes_rpa.find(
        filtro,
        {"_id": 0, "logs": 0}  # Excluir logs pesados
    ).sort("iniciado_em", -1).limit(limite).to_list(length=limite)
    
    return execucoes


@router.get("/execucoes/{execucao_id}")
async def obter_execucao(
    execucao_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de uma execução"""
    execucao = await db.execucoes_rpa.find_one(
        {"id": execucao_id},
        {"_id": 0}
    )
    
    if not execucao:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
        
    # Verificar permissão
    if current_user["role"] != "admin":
        parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
        if execucao["parceiro_id"] != parceiro_id:
            raise HTTPException(status_code=403, detail="Não autorizado")
            
    return execucao


# ==================== CREDENCIAIS POR PLATAFORMA ====================

@router.get("/credenciais/{plataforma_id}")
async def obter_credenciais_plataforma(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter credenciais do parceiro para uma plataforma"""
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    cred = await db.credenciais_plataformas.find_one(
        {"parceiro_id": parceiro_id, "plataforma_id": plataforma_id},
        {"_id": 0, "password": 0}  # Não retornar password
    )
    
    return cred or {}


@router.post("/credenciais/{plataforma_id}")
async def guardar_credenciais_plataforma(
    plataforma_id: str,
    credenciais: dict,
    current_user: dict = Depends(get_current_user)
):
    """Guardar credenciais do parceiro para uma plataforma"""
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    now = datetime.now(timezone.utc).isoformat()
    
    await db.credenciais_plataformas.update_one(
        {"parceiro_id": parceiro_id, "plataforma_id": plataforma_id},
        {"$set": {
            **credenciais,
            "parceiro_id": parceiro_id,
            "plataforma_id": plataforma_id,
            "atualizado_em": now
        },
        "$setOnInsert": {"criado_em": now}},
        upsert=True
    )
    
    return {"sucesso": True, "mensagem": "Credenciais guardadas"}


# ==================== SEED DE PLATAFORMAS PREDEFINIDAS ====================

@router.post("/seed-plataformas")
async def seed_plataformas_predefinidas(
    current_user: dict = Depends(get_current_user)
):
    """Criar plataformas predefinidas (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode executar seed")
        
    now = datetime.now(timezone.utc).isoformat()
    
    plataformas_predefinidas = [
        {
            "nome": "Uber Fleet",
            "url_base": "https://supplier.uber.com",
            "icone": "🚗",
            "descricao": "Extração de rendimentos do portal Uber Fleet",
            "campos_credenciais": ["email", "password", "telefone"],
            "tipo_ficheiro": "csv"
        },
        {
            "nome": "Via Verde Empresas",
            "url_base": "https://www.viaverde.pt/empresas",
            "icone": "🛣️",
            "descricao": "Extração de portagens do portal Via Verde Empresas",
            "campos_credenciais": ["email", "password"],
            "tipo_ficheiro": "xlsx"
        },
        {
            "nome": "Bolt Partner",
            "url_base": "https://fleets.bolt.eu",
            "icone": "⚡",
            "descricao": "Extração de rendimentos do portal Bolt Fleet",
            "campos_credenciais": ["email", "password"],
            "tipo_ficheiro": "csv"
        },
        {
            "nome": "Prio Energy",
            "url_base": "https://www.myprio.com/MyPrioReactiveTheme/Login",
            "icone": "⛽",
            "descricao": "Extração de consumos e faturas do portal MyPRIO",
            "campos_credenciais": ["username", "password"],
            "tipo_ficheiro": "xlsx"
        }
    ]
    
    criadas = 0
    for plat in plataformas_predefinidas:
        # Verificar se já existe
        existente = await db.plataformas_rpa.find_one({"nome": plat["nome"]})
        if not existente:
            await db.plataformas_rpa.insert_one({
                "id": str(uuid.uuid4()),
                **plat,
                "ativo": True,
                "suporta_semanas": True,
                "max_semanas": 4,
                "mapeamento_campos": None,
                "criado_por": current_user["id"],
                "criado_em": now,
                "atualizado_em": now,
                "total_execucoes": 0,
                "ultima_execucao": None
            })
            criadas += 1
            
    return {"sucesso": True, "plataformas_criadas": criadas}


# ==================== PARCEIROS COM SESSÕES ATIVAS ====================

@router.get("/sessoes-parceiros")
async def listar_sessoes_parceiros(
    plataforma: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar parceiros com sessões ativas (admin only)
    
    Retorna parceiros que já fizeram login manual e têm sessões válidas
    que podem ser usadas para gravar designs sem CAPTCHA
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode ver sessões")
    
    import os
    from datetime import datetime, timezone
    
    sessoes = []
    
    # Buscar todos os parceiros
    parceiros = await db.parceiros.find({}, {"_id": 0, "id": 1, "nome": 1, "nome_empresa": 1, "email": 1}).to_list(100)
    users_parceiros = await db.users.find({"role": "parceiro"}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(100)
    
    # Combinar listas
    todos_parceiros = {}
    for p in parceiros:
        todos_parceiros[p["id"]] = {"nome": p.get("nome_empresa") or p.get("nome"), "email": p.get("email")}
    for u in users_parceiros:
        if u["id"] not in todos_parceiros:
            todos_parceiros[u["id"]] = {"nome": u.get("name"), "email": u.get("email")}
    
    # Verificar sessões existentes
    for parceiro_id, info in todos_parceiros.items():
        # Verificar Uber
        uber_session_path = f"/tmp/uber_sessao_{parceiro_id}.json"
        if os.path.exists(uber_session_path):
            mtime = os.path.getmtime(uber_session_path)
            idade_dias = (datetime.now().timestamp() - mtime) / 86400
            
            if idade_dias < 30:  # Sessão válida por 30 dias
                sessoes.append({
                    "parceiro_id": parceiro_id,
                    "parceiro_nome": info["nome"],
                    "parceiro_email": info["email"],
                    "plataforma": "uber",
                    "plataforma_nome": "Uber Fleet",
                    "session_path": uber_session_path,
                    "idade_dias": round(idade_dias, 1),
                    "valida": True
                })
        
        # Verificar Bolt (se existir)
        bolt_session_path = f"/tmp/bolt_sessao_{parceiro_id}.json"
        if os.path.exists(bolt_session_path):
            mtime = os.path.getmtime(bolt_session_path)
            idade_dias = (datetime.now().timestamp() - mtime) / 86400
            
            if idade_dias < 30:
                sessoes.append({
                    "parceiro_id": parceiro_id,
                    "parceiro_nome": info["nome"],
                    "parceiro_email": info["email"],
                    "plataforma": "bolt",
                    "plataforma_nome": "Bolt Partner",
                    "session_path": bolt_session_path,
                    "idade_dias": round(idade_dias, 1),
                    "valida": True
                })
        
        # Verificar Via Verde (se existir)
        viaverde_session_path = f"/tmp/viaverde_sessao_{parceiro_id}.json"
        if os.path.exists(viaverde_session_path):
            mtime = os.path.getmtime(viaverde_session_path)
            idade_dias = (datetime.now().timestamp() - mtime) / 86400
            
            if idade_dias < 30:
                sessoes.append({
                    "parceiro_id": parceiro_id,
                    "parceiro_nome": info["nome"],
                    "parceiro_email": info["email"],
                    "plataforma": "viaverde",
                    "plataforma_nome": "Via Verde Empresas",
                    "session_path": viaverde_session_path,
                    "idade_dias": round(idade_dias, 1),
                    "valida": True
                })
    
    # Filtrar por plataforma se especificado
    if plataforma:
        sessoes = [s for s in sessoes if s["plataforma"] == plataforma]
    
    return {
        "sessoes": sessoes,
        "total": len(sessoes),
        "mensagem": f"{len(sessoes)} sessões ativas encontradas"
    }


# ==================== WEBSOCKET PARA BROWSER INTERATIVO ====================

@router.websocket("/ws/design/{session_id}")
async def websocket_design_browser(
    websocket: WebSocket,
    session_id: str
):
    """WebSocket para controlar browser interativo durante gravação de design"""
    await websocket.accept()
    
    if session_id not in active_design_sessions:
        await websocket.send_json({"erro": "Sessão não encontrada"})
        await websocket.close()
        return
        
    session = active_design_sessions[session_id]
    playwright_instance = None
    browser = None
    
    try:
        from playwright.async_api import async_playwright
        import os
        os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'
        
        logger.info(f"A iniciar browser para sessão {session_id}")
        
        # Verificar se deve usar sessão de um parceiro
        usar_sessao_parceiro = session.get("usar_sessao_parceiro")
        storage_state = None
        
        if usar_sessao_parceiro:
            session_path = usar_sessao_parceiro.get("session_path")
            if session_path and os.path.exists(session_path):
                storage_state = session_path
                logger.info(f"Usando sessão do parceiro: {session_path}")
        
        # Iniciar browser com configurações anti-detecção avançadas
        playwright_instance = await async_playwright().start()
        browser = await playwright_instance.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1280,720',
                '--disable-extensions',
                '--disable-plugins-discovery',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-default-apps'
            ]
        )
        
        # Contexto com configurações anti-detecção E sessão do parceiro (se disponível)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            locale="pt-PT",
            timezone_id="Europe/Lisbon",
            geolocation={"latitude": 38.7223, "longitude": -9.1393},
            permissions=["geolocation"],
            color_scheme="light",
            java_script_enabled=True,
            has_touch=False,
            is_mobile=False,
            storage_state=storage_state  # Usar cookies do parceiro se disponível
        )
        
        # Scripts anti-detecção avançados
        await context.add_init_script("""
            // Esconder webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Esconder automação - Chrome
            delete Object.getPrototypeOf(navigator).webdriver;
            
            // Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const plugins = [
                        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                        { name: 'Native Client', filename: 'internal-nacl-plugin' }
                    ];
                    plugins.length = 3;
                    return plugins;
                }
            });
            
            // Chrome runtime
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
            
            // Permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['pt-PT', 'pt', 'en-US', 'en']
            });
            
            // Platform
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32'
            });
            
            // Hardware concurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 8
            });
            
            // Device memory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8
            });
            
            // Connection
            Object.defineProperty(navigator, 'connection', {
                get: () => ({
                    effectiveType: '4g',
                    rtt: 50,
                    downlink: 10,
                    saveData: false
                })
            });
        """)
        
        page = await context.new_page()
        
        session["playwright"] = playwright_instance
        session["browser"] = browser
        session["page"] = page
        
        # Navegar para URL inicial (pode ser diferente da URL base se usar sessão pós-login)
        url_inicial = session.get("url_inicial") or session["plataforma"]["url_base"]
        usando_sessao = session.get("usar_sessao_parceiro") is not None
        
        logger.info(f"A navegar para: {url_inicial} (usando sessão parceiro: {usando_sessao})")
        
        await page.goto(url_inicial, wait_until="domcontentloaded", timeout=30000)
        
        # Pequena espera para parecer mais humano
        await asyncio.sleep(1)
        
        # Enviar screenshot inicial
        screenshot = await page.screenshot(type="jpeg", quality=50)
        await websocket.send_json({
            "tipo": "screenshot",
            "data": base64.b64encode(screenshot).decode(),
            "url": page.url
        })
        
        logger.info("Screenshot inicial enviado")
        
        # Loop de eventos
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=2.0)
                logger.info(f"Comando recebido: {data}")
                
                if data.get("tipo") == "click":
                    x, y = data.get("x", 0), data.get("y", 0)
                    await page.mouse.click(x, y)
                    await asyncio.sleep(0.5)
                    
                    # Tentar capturar seletor do elemento
                    seletor = await page.evaluate(f"""
                        (function() {{
                            const el = document.elementFromPoint({x}, {y});
                            if (!el) return null;
                            if (el.id) return '#' + el.id;
                            if (el.className && typeof el.className === 'string') return el.tagName.toLowerCase() + '.' + el.className.split(' ').join('.');
                            return el.tagName.toLowerCase();
                        }})()
                    """)
                    
                    # Guardar passo na sessão
                    novo_passo = {
                        "ordem": len(session["passos"]) + 1,
                        "tipo": "click",
                        "seletor": seletor,
                        "coordenadas": {"x": x, "y": y},
                        "descricao": f"click: {seletor or f'({x},{y})'}"
                    }
                    session["passos"].append(novo_passo)
                    
                    await websocket.send_json({
                        "tipo": "passo_detectado",
                        "passo": novo_passo
                    })
                    
                elif data.get("tipo") == "type" or data.get("tipo") == "inserir_texto":
                    texto = data.get("texto", "")
                    
                    # Verificar se é um código SMS de 4 dígitos
                    if len(texto) == 4 and texto.isdigit():
                        # Tentar encontrar campos de input para SMS (4 campos separados)
                        sms_inputs = await page.locator('input[type="text"], input[type="tel"], input[type="number"]').all()
                        
                        # Filtrar apenas inputs visíveis e pequenos (campos de dígitos)
                        valid_inputs = []
                        for inp in sms_inputs:
                            try:
                                if await inp.is_visible():
                                    box = await inp.bounding_box()
                                    if box and box['width'] < 100:
                                        valid_inputs.append(inp)
                            except:
                                continue
                        
                        if len(valid_inputs) >= 4:
                            # 4 campos separados - inserir um dígito em cada
                            logger.info(f"WebSocket: A preencher 4 campos SMS com: {texto}")
                            for i, digit in enumerate(texto[:4]):
                                if i < len(valid_inputs):
                                    await valid_inputs[i].click()
                                    await asyncio.sleep(0.1)
                                    await valid_inputs[i].fill(digit)
                                    await asyncio.sleep(0.15)
                        elif len(valid_inputs) >= 1:
                            # Campo único
                            await valid_inputs[0].click()
                            await asyncio.sleep(0.1)
                            await valid_inputs[0].fill(texto)
                        else:
                            # Fallback: digitar normalmente
                            await page.keyboard.type(texto, delay=100)
                    else:
                        # Digitar letra a letra com delay para parecer humano
                        await page.keyboard.type(texto, delay=100)
                    
                    await asyncio.sleep(0.3)
                    
                    # Guardar passo na sessão
                    novo_passo = {
                        "ordem": len(session["passos"]) + 1,
                        "tipo": "type",
                        "valor": texto,
                        "descricao": f"type: {texto[:20]}..."
                    }
                    session["passos"].append(novo_passo)
                    
                    await websocket.send_json({
                        "tipo": "passo_detectado",
                        "passo": novo_passo
                    })
                    
                elif data.get("tipo") == "press" or data.get("tipo") == "tecla":
                    tecla = data.get("tecla", "Enter")
                    await page.keyboard.press(tecla)
                    
                    # Guardar passo na sessão
                    novo_passo = {
                        "ordem": len(session["passos"]) + 1,
                        "tipo": "press",
                        "valor": tecla,
                        "descricao": f"press: {tecla}"
                    }
                    session["passos"].append(novo_passo)
                    
                elif data.get("tipo") == "goto":
                    url = data.get("url", "")
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    
                    # Guardar passo na sessão
                    novo_passo = {
                        "ordem": len(session["passos"]) + 1,
                        "tipo": "goto",
                        "valor": url,
                        "descricao": f"goto: {url}"
                    }
                    session["passos"].append(novo_passo)
                    
                elif data.get("tipo") == "scroll":
                    delta = data.get("delta", 0)
                    direcao = data.get("direcao", "")
                    logger.info(f"Scroll: delta={delta}, direcao={direcao}")
                    if direcao == "down":
                        delta = 300
                    elif direcao == "up":
                        delta = -300
                    # Usar mouse wheel para scroll mais confiável
                    logger.info(f"Executando scroll com delta={delta}")
                    await page.mouse.wheel(0, delta)
                    await asyncio.sleep(0.3)
                    
                    # Guardar passo na sessão
                    novo_passo = {
                        "ordem": len(session["passos"]) + 1,
                        "tipo": "scroll",
                        "valor": delta,
                        "descricao": f"scroll: {direcao or delta}"
                    }
                    session["passos"].append(novo_passo)
                
                elif data.get("tipo") == "espera":
                    segundos = data.get("segundos", 3)
                    await asyncio.sleep(segundos)
                    
                    # Guardar passo na sessão
                    novo_passo = {
                        "ordem": len(session["passos"]) + 1,
                        "tipo": "wait",
                        "timeout": segundos * 1000,
                        "descricao": f"wait: {segundos}s"
                    }
                    session["passos"].append(novo_passo)
                
                elif data.get("tipo") == "aguardar_download":
                    # Aguardar download - apenas um placeholder por agora
                    await asyncio.sleep(2)
                    
                    # Guardar passo na sessão
                    novo_passo = {
                        "ordem": len(session["passos"]) + 1,
                        "tipo": "download",
                        "timeout": 60000,
                        "descricao": "download: aguardar"
                    }
                    session["passos"].append(novo_passo)
                    
                # Enviar screenshot atualizado
                await asyncio.sleep(0.3)
                screenshot = await page.screenshot(type="jpeg", quality=50)
                await websocket.send_json({
                    "tipo": "screenshot",
                    "data": base64.b64encode(screenshot).decode(),
                    "url": page.url
                })
                
            except asyncio.TimeoutError:
                # Enviar screenshot periódico
                try:
                    screenshot = await page.screenshot(type="jpeg", quality=50)
                    await websocket.send_json({
                        "tipo": "screenshot",
                        "data": base64.b64encode(screenshot).decode(),
                        "url": page.url
                    })
                except Exception:
                    pass
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket desconectado: {session_id}")
    except Exception as e:
        logger.error(f"Erro no WebSocket: {e}")
        try:
            await websocket.send_json({"erro": str(e)})
        except Exception:
            pass
    finally:
        # Limpar recursos
        logger.info(f"A limpar recursos da sessão {session_id}")
        if browser:
            try:
                await browser.close()
            except Exception:
                pass
        if playwright_instance:
            try:
                await playwright_instance.stop()
            except Exception:
                pass
