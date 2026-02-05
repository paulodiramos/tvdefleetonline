"""
Rotas para o RPA Designer Visual
- Admin: criar/editar plataformas e designs
- Parceiro: configurar agendamentos e executar
"""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
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

@router.post("/sessao/iniciar")
async def iniciar_sessao_design(
    plataforma_id: str,
    semana_offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Iniciar sessão de gravação de design (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode criar designs")
        
    # Verificar plataforma
    plataforma = await db.plataformas_rpa.find_one({"id": plataforma_id})
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
        
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
        "criado_em": datetime.now(timezone.utc).isoformat()
    }
    
    return {
        "session_id": session_id,
        "plataforma": plataforma["nome"],
        "url_base": plataforma["url_base"],
        "semana_offset": semana_offset
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
    
    if len(session["passos"]) == 0:
        raise HTTPException(status_code=400, detail="Sessão não tem passos gravados")
        
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
        
        # Iniciar browser
        playwright_instance = await async_playwright().start()
        browser = await playwright_instance.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        )
        
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        session["playwright"] = playwright_instance
        session["browser"] = browser
        session["page"] = page
        
        # Navegar para URL base
        url_base = session["plataforma"]["url_base"]
        logger.info(f"A navegar para: {url_base}")
        
        await page.goto(url_base, wait_until="domcontentloaded", timeout=30000)
        
        # Enviar screenshot inicial
        screenshot = await page.screenshot(type="jpeg", quality=50)
        await websocket.send_json({
            "tipo": "screenshot",
            "data": base64.b64encode(screenshot).decode(),
            "url": page.url
        })
        
        logger.info(f"Screenshot inicial enviado")
        
        # Loop de eventos
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=2.0)
                
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
                    
                    await websocket.send_json({
                        "tipo": "passo_detectado",
                        "passo": {
                            "tipo": "click",
                            "seletor": seletor,
                            "coordenadas": {"x": x, "y": y}
                        }
                    })
                    
                elif data.get("tipo") == "type":
                    texto = data.get("texto", "")
                    await page.keyboard.type(texto)
                    
                elif data.get("tipo") == "press":
                    tecla = data.get("tecla", "Enter")
                    await page.keyboard.press(tecla)
                    
                elif data.get("tipo") == "goto":
                    url = data.get("url", "")
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    
                elif data.get("tipo") == "scroll":
                    delta = data.get("delta", 0)
                    await page.evaluate(f"window.scrollBy(0, {delta})")
                    
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
