"""Notifications routes"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Optional
from datetime import datetime, timezone

from models.notificacao import Notificacao, NotificacaoCreate, NotificacaoStats
from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()


@router.get("/notificacoes", response_model=List[Notificacao])
async def get_notificacoes(
    lida: Optional[bool] = None,
    tipo: Optional[str] = None,
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    """Get user notifications"""
    query = {"user_id": current_user["id"]}
    
    if lida is not None:
        query["lida"] = lida
    if tipo:
        query["tipo"] = tipo
    
    notificacoes = await db.notificacoes.find(
        query, 
        {"_id": 0}
    ).sort("criada_em", -1).limit(limit).to_list(limit)
    
    # Convert datetime strings to datetime objects
    for notif in notificacoes:
        if isinstance(notif.get("criada_em"), str):
            notif["criada_em"] = datetime.fromisoformat(notif["criada_em"])
        if notif.get("lida_em") and isinstance(notif["lida_em"], str):
            notif["lida_em"] = datetime.fromisoformat(notif["lida_em"])
    
    return [Notificacao(**n) for n in notificacoes]


@router.get("/notificacoes/stats", response_model=NotificacaoStats)
async def get_notificacoes_stats(current_user: Dict = Depends(get_current_user)):
    """Get notification statistics"""
    query = {"user_id": current_user["id"]}
    
    total = await db.notificacoes.count_documents(query)
    nao_lidas = await db.notificacoes.count_documents({**query, "lida": False})
    
    # Count by type
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$tipo", "count": {"$sum": 1}}}
    ]
    tipo_counts = await db.notificacoes.aggregate(pipeline).to_list(None)
    por_tipo = {item["_id"]: item["count"] for item in tipo_counts}
    
    return NotificacaoStats(
        total=total,
        nao_lidas=nao_lidas,
        por_tipo=por_tipo
    )


@router.put("/notificacoes/{notificacao_id}/marcar-lida")
async def marcar_notificacao_lida(
    notificacao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Mark notification as read"""
    notif = await db.notificacoes.find_one({"id": notificacao_id})
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notif["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.notificacoes.update_one(
        {"id": notificacao_id},
        {"$set": {"lida": True, "lida_em": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Notification marked as read"}


@router.put("/notificacoes/marcar-todas-lidas")
async def marcar_todas_lidas(current_user: Dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    result = await db.notificacoes.update_many(
        {"user_id": current_user["id"], "lida": False},
        {"$set": {"lida": True, "lida_em": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Marked {result.modified_count} notifications as read"}


@router.delete("/notificacoes/{notificacao_id}")
async def delete_notificacao(
    notificacao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete notification"""
    notif = await db.notificacoes.find_one({"id": notificacao_id})
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notif["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.notificacoes.delete_one({"id": notificacao_id})
    
    return {"message": "Notification deleted"}


@router.post("/notificacoes", response_model=Notificacao)
async def create_notificacao(
    notificacao_data: NotificacaoCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create notification (Admin/Gestao only)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    notif = Notificacao(**notificacao_data.model_dump())
    notif_dict = notif.model_dump()
    notif_dict["criada_em"] = notif_dict["criada_em"].isoformat()
    
    await db.notificacoes.insert_one(notif_dict)
    
    return notif
