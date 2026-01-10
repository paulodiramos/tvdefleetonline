"""Gestores routes for FleeTrack application - Refactored from server.py"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import logging

from utils.database import get_database
from utils.auth import get_current_user

# Setup logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/gestores", tags=["gestores"])

# Get database
db = get_database()


class UserRole:
    """User roles for authorization"""
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== GESTORES ROUTES ====================

@router.put("/{gestor_id}/atribuir-parceiros")
async def atribuir_parceiros_a_gestor(
    gestor_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Assign parceiros to a gestor (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can assign parceiros to gestores")
    
    parceiros_ids = data.get("parceiros_ids", [])
    
    # Verify gestor exists and is a gestor
    gestor = await db.users.find_one({"id": gestor_id, "role": UserRole.GESTAO}, {"_id": 0})
    if not gestor:
        raise HTTPException(status_code=404, detail="Gestor not found")
    
    # Verify all parceiros exist
    for parceiro_id in parceiros_ids:
        parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
        if not parceiro:
            raise HTTPException(status_code=404, detail=f"Parceiro {parceiro_id} not found")
    
    # Update gestor with parceiros list
    await db.users.update_one(
        {"id": gestor_id},
        {"$set": {
            "parceiros_atribuidos": parceiros_ids,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update each parceiro with gestor reference
    for parceiro_id in parceiros_ids:
        await db.parceiros.update_one(
            {"id": parceiro_id},
            {"$set": {
                "gestor_associado_id": gestor_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {
        "message": f"Parceiros atribuídos ao gestor {gestor.get('name')}",
        "gestor_id": gestor_id,
        "parceiros_atribuidos": parceiros_ids
    }


@router.get("/{gestor_id}/parceiros")
async def get_parceiros_do_gestor(
    gestor_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get all parceiros assigned to a gestor"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Gestor can only see their own parceiros
    if current_user["role"] == UserRole.GESTAO and current_user["id"] != gestor_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    gestor = await db.users.find_one({"id": gestor_id, "role": UserRole.GESTAO}, {"_id": 0})
    if not gestor:
        raise HTTPException(status_code=404, detail="Gestor not found")
    
    parceiros_ids = gestor.get("parceiros_atribuidos", [])
    
    if not parceiros_ids:
        return {
            "gestor_id": gestor_id,
            "gestor_nome": gestor.get("name"),
            "parceiros": [],
            "total": 0
        }
    
    parceiros = await db.parceiros.find(
        {"id": {"$in": parceiros_ids}},
        {"_id": 0}
    ).to_list(1000)
    
    # Enrich with vehicle and motorista counts
    for p in parceiros:
        p["total_veiculos"] = await db.vehicles.count_documents({"parceiro_id": p["id"]})
        p["total_motoristas"] = await db.motoristas.count_documents({"parceiro_atribuido": p["id"]})
    
    return {
        "gestor_id": gestor_id,
        "gestor_nome": gestor.get("name"),
        "parceiros": parceiros,
        "total": len(parceiros)
    }


@router.get("")
async def get_gestores(current_user: Dict = Depends(get_current_user)):
    """Get all gestores (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can view all gestores")
    
    gestores = await db.users.find(
        {"role": UserRole.GESTAO},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    
    # Enrich with parceiro counts
    for g in gestores:
        parceiros_ids = g.get("parceiros_atribuidos", [])
        g["total_parceiros"] = len(parceiros_ids)
        
        # Count total vehicles and motoristas under this gestor
        total_veiculos = 0
        total_motoristas = 0
        for parceiro_id in parceiros_ids:
            total_veiculos += await db.vehicles.count_documents({"parceiro_id": parceiro_id})
            total_motoristas += await db.motoristas.count_documents({"parceiro_atribuido": parceiro_id})
        
        g["total_veiculos"] = total_veiculos
        g["total_motoristas"] = total_motoristas
    
    return gestores


@router.get("/{gestor_id}")
async def get_gestor(
    gestor_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get specific gestor by ID"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Gestor can only see their own data
    if current_user["role"] == UserRole.GESTAO and current_user["id"] != gestor_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    gestor = await db.users.find_one(
        {"id": gestor_id, "role": UserRole.GESTAO},
        {"_id": 0, "password": 0}
    )
    
    if not gestor:
        raise HTTPException(status_code=404, detail="Gestor not found")
    
    # Enrich with statistics
    parceiros_ids = gestor.get("parceiros_atribuidos", [])
    gestor["total_parceiros"] = len(parceiros_ids)
    
    total_veiculos = 0
    total_motoristas = 0
    for parceiro_id in parceiros_ids:
        total_veiculos += await db.vehicles.count_documents({"parceiro_id": parceiro_id})
        total_motoristas += await db.motoristas.count_documents({"parceiro_atribuido": parceiro_id})
    
    gestor["total_veiculos"] = total_veiculos
    gestor["total_motoristas"] = total_motoristas
    
    return gestor


@router.delete("/{gestor_id}/parceiros/{parceiro_id}")
async def remover_parceiro_do_gestor(
    gestor_id: str,
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remove parceiro from gestor (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can remove parceiros from gestores")
    
    gestor = await db.users.find_one({"id": gestor_id, "role": UserRole.GESTAO}, {"_id": 0})
    if not gestor:
        raise HTTPException(status_code=404, detail="Gestor not found")
    
    parceiros_atuais = gestor.get("parceiros_atribuidos", [])
    
    if parceiro_id not in parceiros_atuais:
        raise HTTPException(status_code=400, detail="Parceiro not assigned to this gestor")
    
    parceiros_atuais.remove(parceiro_id)
    
    # Update gestor
    await db.users.update_one(
        {"id": gestor_id},
        {"$set": {
            "parceiros_atribuidos": parceiros_atuais,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update parceiro
    await db.parceiros.update_one(
        {"id": parceiro_id},
        {"$set": {
            "gestor_associado_id": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": f"Parceiro removido do gestor",
        "gestor_id": gestor_id,
        "parceiro_id": parceiro_id
    }


@router.get("/{gestor_id}/dashboard")
async def get_gestor_dashboard(
    gestor_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get dashboard data for a gestor"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Gestor can only see their own dashboard
    if current_user["role"] == UserRole.GESTAO and current_user["id"] != gestor_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    gestor = await db.users.find_one({"id": gestor_id, "role": UserRole.GESTAO}, {"_id": 0})
    if not gestor:
        raise HTTPException(status_code=404, detail="Gestor not found")
    
    parceiros_ids = gestor.get("parceiros_atribuidos", [])
    
    # Aggregate statistics
    total_parceiros = len(parceiros_ids)
    total_veiculos = 0
    veiculos_atribuidos = 0
    total_motoristas = 0
    motoristas_ativos = 0
    
    for parceiro_id in parceiros_ids:
        total_veiculos += await db.vehicles.count_documents({"parceiro_id": parceiro_id})
        veiculos_atribuidos += await db.vehicles.count_documents({
            "parceiro_id": parceiro_id,
            "motorista_atribuido": {"$ne": None}
        })
        total_motoristas += await db.motoristas.count_documents({"parceiro_atribuido": parceiro_id})
        motoristas_ativos += await db.motoristas.count_documents({
            "parceiro_atribuido": parceiro_id,
            "status_motorista": "ativo"
        })
    
    # Get alerts for parceiros
    total_alertas = await db.alertas.count_documents({
        "status": "ativo",
        "$or": [
            {"parceiro_id": {"$in": parceiros_ids}},
            {"entidade_id": {"$in": parceiros_ids}}
        ]
    })
    
    return {
        "gestor_id": gestor_id,
        "gestor_nome": gestor.get("name"),
        "parceiros": {
            "total": total_parceiros
        },
        "veiculos": {
            "total": total_veiculos,
            "atribuidos": veiculos_atribuidos,
            "disponiveis": total_veiculos - veiculos_atribuidos
        },
        "motoristas": {
            "total": total_motoristas,
            "ativos": motoristas_ativos,
            "inativos": total_motoristas - motoristas_ativos
        },
        "alertas": {
            "total": total_alertas
        }
    }
