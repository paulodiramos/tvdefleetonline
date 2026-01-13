"""
Agenda Router
Handles vehicle agenda/calendar events (maintenance, inspections, etc.)
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/vehicles", tags=["agenda"])
db = get_database()
logger = logging.getLogger(__name__)


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== AGENDA CRUD ====================

@router.post("/{vehicle_id}/agenda")
async def criar_evento_agenda(
    vehicle_id: str,
    evento_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Criar novo evento na agenda do veículo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Verificar se veículo existe
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    
    evento_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    evento = {
        "id": evento_id,
        "veiculo_id": vehicle_id,
        "parceiro_id": vehicle.get("parceiro_id"),
        "titulo": evento_data.get("titulo"),
        "descricao": evento_data.get("descricao"),
        "tipo": evento_data.get("tipo", "outro"),  # manutencao, vistoria, seguro, iuc, outro
        "data_inicio": evento_data.get("data_inicio"),
        "data_fim": evento_data.get("data_fim"),
        "hora": evento_data.get("hora"),
        "local": evento_data.get("local"),
        "status": evento_data.get("status", "agendado"),  # agendado, concluido, cancelado
        "prioridade": evento_data.get("prioridade", "normal"),  # baixa, normal, alta, urgente
        "notificar": evento_data.get("notificar", True),
        "notificar_dias_antes": evento_data.get("notificar_dias_antes", 3),
        "notas": evento_data.get("notas"),
        "criado_por": current_user["id"],
        "criado_por_nome": current_user.get("name"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.agenda_veiculos.insert_one(evento)
    logger.info(f"✅ Evento '{evento['titulo']}' criado para veículo {vehicle_id}")
    
    return {"message": "Evento criado com sucesso", "evento_id": evento_id}


@router.get("/{vehicle_id}/agenda")
async def listar_eventos_agenda(
    vehicle_id: str,
    tipo: Optional[str] = None,
    status: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Listar eventos da agenda do veículo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    filtro = {"veiculo_id": vehicle_id}
    
    if tipo:
        filtro["tipo"] = tipo
    if status:
        filtro["status"] = status
    
    eventos = await db.agenda_veiculos.find(filtro, {"_id": 0}).sort("data_inicio", 1).to_list(100)
    return eventos


@router.get("/{vehicle_id}/agenda/{evento_id}")
async def obter_evento_agenda(
    vehicle_id: str,
    evento_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter detalhes de um evento específico"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    evento = await db.agenda_veiculos.find_one(
        {"id": evento_id, "veiculo_id": vehicle_id},
        {"_id": 0}
    )
    
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    
    return evento


@router.put("/{vehicle_id}/agenda/{evento_id}")
async def atualizar_evento_agenda(
    vehicle_id: str,
    evento_id: str,
    evento_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar evento da agenda"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    evento = await db.agenda_veiculos.find_one({"id": evento_id, "veiculo_id": vehicle_id})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    
    evento_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.agenda_veiculos.update_one(
        {"id": evento_id},
        {"$set": evento_data}
    )
    
    logger.info(f"✅ Evento {evento_id} atualizado")
    return {"message": "Evento atualizado com sucesso"}


@router.delete("/{vehicle_id}/agenda/{evento_id}")
async def deletar_evento_agenda(
    vehicle_id: str,
    evento_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Deletar evento da agenda"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    evento = await db.agenda_veiculos.find_one({"id": evento_id, "veiculo_id": vehicle_id})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    
    await db.agenda_veiculos.delete_one({"id": evento_id})
    logger.info(f"🗑️ Evento {evento_id} deletado")
    
    return {"message": "Evento deletado com sucesso"}


# ==================== CONCLUIR/CANCELAR ====================

@router.put("/{vehicle_id}/agenda/{evento_id}/concluir")
async def concluir_evento(
    vehicle_id: str,
    evento_id: str,
    dados: Optional[Dict[str, Any]] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Marcar evento como concluído"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    evento = await db.agenda_veiculos.find_one({"id": evento_id, "veiculo_id": vehicle_id})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    
    updates = {
        "status": "concluido",
        "concluido_em": datetime.now(timezone.utc).isoformat(),
        "concluido_por": current_user["id"],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if dados and dados.get("notas"):
        updates["notas_conclusao"] = dados.get("notas")
    
    await db.agenda_veiculos.update_one({"id": evento_id}, {"$set": updates})
    
    return {"message": "Evento marcado como concluído"}


@router.put("/{vehicle_id}/agenda/{evento_id}/cancelar")
async def cancelar_evento(
    vehicle_id: str,
    evento_id: str,
    dados: Optional[Dict[str, Any]] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Cancelar evento"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    evento = await db.agenda_veiculos.find_one({"id": evento_id, "veiculo_id": vehicle_id})
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    
    updates = {
        "status": "cancelado",
        "cancelado_em": datetime.now(timezone.utc).isoformat(),
        "cancelado_por": current_user["id"],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if dados and dados.get("motivo"):
        updates["motivo_cancelamento"] = dados.get("motivo")
    
    await db.agenda_veiculos.update_one({"id": evento_id}, {"$set": updates})
    
    return {"message": "Evento cancelado"}


# ==================== CONSULTAS GLOBAIS ====================

@router.get("/agenda/proximos")
async def proximos_eventos(
    dias: int = 30,
    tipo: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Listar próximos eventos de todos os veículos"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    from datetime import timedelta
    
    hoje = datetime.now(timezone.utc)
    data_limite = (hoje + timedelta(days=dias)).isoformat()
    
    filtro = {
        "status": "agendado",
        "data_inicio": {"$lte": data_limite}
    }
    
    # Filtrar por parceiro se não for admin
    if current_user["role"] == UserRole.PARCEIRO:
        filtro["parceiro_id"] = current_user["id"]
    
    if tipo:
        filtro["tipo"] = tipo
    
    eventos = await db.agenda_veiculos.find(filtro, {"_id": 0}).sort("data_inicio", 1).to_list(100)
    
    # Enriquecer com info do veículo
    for evento in eventos:
        veiculo = await db.vehicles.find_one(
            {"id": evento["veiculo_id"]},
            {"_id": 0, "matricula": 1, "marca": 1, "modelo": 1}
        )
        evento["veiculo"] = veiculo
    
    return eventos


@router.get("/agenda/por-tipo")
async def eventos_por_tipo(
    current_user: Dict = Depends(get_current_user)
):
    """Estatísticas de eventos por tipo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    filtro = {}
    if current_user["role"] == UserRole.PARCEIRO:
        filtro["parceiro_id"] = current_user["id"]
    
    pipeline = [
        {"$match": filtro},
        {"$group": {
            "_id": {"tipo": "$tipo", "status": "$status"},
            "count": {"$sum": 1}
        }}
    ]
    
    resultados = await db.agenda_veiculos.aggregate(pipeline).to_list(50)
    
    # Organizar por tipo
    por_tipo = {}
    for r in resultados:
        tipo = r["_id"]["tipo"]
        status = r["_id"]["status"]
        if tipo not in por_tipo:
            por_tipo[tipo] = {"total": 0, "por_status": {}}
        por_tipo[tipo]["total"] += r["count"]
        por_tipo[tipo]["por_status"][status] = r["count"]
    
    return por_tipo
