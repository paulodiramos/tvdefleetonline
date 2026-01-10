"""Alertas routes for FleeTrack application"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from datetime import datetime, timezone
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user
from utils.alerts import check_and_create_alerts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alertas", tags=["alertas"])
db = get_database()


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


@router.get("")
async def get_alertas(current_user: dict = Depends(get_current_user)):
    """Obtém lista de alertas"""
    query = {"status": "ativo"}
    
    # Filtrar por parceiro se não for admin
    if current_user["role"] == UserRole.PARCEIRO:
        # Obter veículos e motoristas do parceiro
        vehicles = await db.vehicles.find(
            {"parceiro_id": current_user["id"]},
            {"_id": 0, "id": 1}
        ).to_list(None)
        vehicle_ids = [v["id"] for v in vehicles]
        
        motoristas = await db.motoristas.find(
            {"$or": [
                {"parceiro_id": current_user["id"]},
                {"parceiro_atribuido": current_user["id"]}
            ]},
            {"_id": 0, "id": 1}
        ).to_list(None)
        motorista_ids = [m["id"] for m in motoristas]
        
        query["entidade_id"] = {"$in": vehicle_ids + motorista_ids}
    
    alertas = await db.alertas.find(query, {"_id": 0}).to_list(None)
    return alertas


@router.post("/verificar")
async def verificar_alertas(current_user: dict = Depends(get_current_user)):
    """Executa verificação de alertas (cron manual)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await check_and_create_alerts()
    return {"message": "Verificação de alertas executada"}


@router.put("/{alerta_id}/resolver")
async def resolver_alerta(
    alerta_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Marca um alerta como resolvido"""
    result = await db.alertas.update_one(
        {"id": alerta_id},
        {"$set": {
            "status": "resolvido",
            "resolvido_por": current_user["id"],
            "resolvido_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    
    return {"message": "Alerta resolvido"}


@router.put("/{alerta_id}/ignorar")
async def ignorar_alerta(
    alerta_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Marca um alerta como ignorado"""
    result = await db.alertas.update_one(
        {"id": alerta_id},
        {"$set": {
            "status": "ignorado",
            "ignorado_por": current_user["id"],
            "ignorado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    
    return {"message": "Alerta ignorado"}


@router.get("/dashboard-stats")
async def get_alertas_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Obtém estatísticas de alertas para o dashboard"""
    query = {"status": "ativo"}
    
    # Filtrar por parceiro se não for admin
    if current_user["role"] == UserRole.PARCEIRO:
        vehicles = await db.vehicles.find(
            {"parceiro_id": current_user["id"]},
            {"_id": 0, "id": 1}
        ).to_list(None)
        vehicle_ids = [v["id"] for v in vehicles]
        
        motoristas = await db.motoristas.find(
            {"$or": [
                {"parceiro_id": current_user["id"]},
                {"parceiro_atribuido": current_user["id"]}
            ]},
            {"_id": 0, "id": 1}
        ).to_list(None)
        motorista_ids = [m["id"] for m in motoristas]
        
        query["entidade_id"] = {"$in": vehicle_ids + motorista_ids}
    
    alertas = await db.alertas.find(query, {"_id": 0}).to_list(None)
    
    # Agrupar por prioridade
    stats = {
        "total": len(alertas),
        "alta": len([a for a in alertas if a.get("prioridade") == "alta"]),
        "media": len([a for a in alertas if a.get("prioridade") == "media"]),
        "baixa": len([a for a in alertas if a.get("prioridade") == "baixa"])
    }
    
    # Agrupar por tipo
    tipos = {}
    for alerta in alertas:
        tipo = alerta.get("tipo", "outro")
        tipos[tipo] = tipos.get(tipo, 0) + 1
    
    stats["por_tipo"] = tipos
    
    return stats
