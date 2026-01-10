"""Admin routes for FleeTrack application"""

from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Dict, Any, List
from datetime import datetime, timezone
import logging

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])
db = get_database()


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


@router.get("/settings")
async def get_admin_settings(current_user: dict = Depends(get_current_user)):
    """Obtém configurações do admin"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    if not settings:
        settings = {
            "id": "admin_settings",
            "anos_validade_matricula": 20,
            "km_aviso_manutencao": 5000
        }
    return settings


@router.put("/settings")
async def update_admin_settings(
    settings: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Atualiza configurações do admin"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    settings["updated_at"] = datetime.now(timezone.utc)
    settings["updated_by"] = current_user["id"]
    
    await db.admin_settings.update_one(
        {"id": "admin_settings"},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Configurações atualizadas com sucesso"}


@router.get("/config/textos-legais")
async def get_textos_legais(current_user: dict = Depends(get_current_user)):
    """Obtém textos legais (termos, privacidade, etc)"""
    config = await db.configuracoes.find_one({"tipo": "textos_legais"}, {"_id": 0})
    return config or {}


@router.put("/config/textos-legais")
async def update_textos_legais(
    textos: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Atualiza textos legais"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.configuracoes.update_one(
        {"tipo": "textos_legais"},
        {"$set": {
            "tipo": "textos_legais",
            **textos,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"message": "Textos legais atualizados"}


@router.put("/config/comunicacoes")
async def update_config_comunicacoes(
    config: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Atualiza configurações de comunicações"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.configuracoes.update_one(
        {"tipo": "comunicacoes"},
        {"$set": {
            "tipo": "comunicacoes",
            **config,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"message": "Configurações de comunicações atualizadas"}


@router.put("/config/integracoes")
async def update_config_integracoes(
    config: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Atualiza configurações de integrações"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.configuracoes.update_one(
        {"tipo": "integracoes"},
        {"$set": {
            "tipo": "integracoes",
            **config,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"message": "Configurações de integrações atualizadas"}


@router.get("/credenciais-parceiros")
async def get_credenciais_parceiros(current_user: dict = Depends(get_current_user)):
    """Obtém todas as credenciais de parceiros (apenas admin)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    credenciais = await db.credenciais_plataforma.find({}, {"_id": 0}).to_list(None)
    
    # Adicionar info do parceiro
    for cred in credenciais:
        parceiro = await db.parceiros.find_one(
            {"id": cred.get("parceiro_id")},
            {"_id": 0, "nome_empresa": 1, "email": 1}
        )
        if not parceiro:
            parceiro = await db.users.find_one(
                {"id": cred.get("parceiro_id")},
                {"_id": 0, "name": 1, "email": 1}
            )
        cred["parceiro_info"] = parceiro
    
    return credenciais
