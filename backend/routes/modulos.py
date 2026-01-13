"""Modules and feature access management routes"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)


class ModuloAtribuicao(BaseModel):
    """Model for assigning modules to user"""
    modulos: List[str]


@router.get("/modulos")
async def get_modulos_disponiveis(
    tipo_usuario: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Lista todos os módulos disponíveis no sistema"""
    try:
        from models.modulo import MODULOS_SISTEMA
    except ImportError:
        # Fallback if MODULOS_SISTEMA doesn't exist
        return []
    
    modulos = []
    for codigo, info in MODULOS_SISTEMA.items():
        # Filtrar por tipo de usuário se especificado
        if tipo_usuario and info.get("tipo_usuario") != tipo_usuario:
            continue
            
        modulos.append({
            "id": codigo,
            "codigo": codigo,
            "nome": info["nome"],
            "descricao": info["descricao"],
            "tipo_usuario": info.get("tipo_usuario", "parceiro"),
            "ordem": info["ordem"],
            "ativo": True
        })
    
    return sorted(modulos, key=lambda x: x["ordem"])


@router.post("/users/{user_id}/atribuir-modulos")
async def atribuir_modulos_usuario(
    user_id: str,
    data: ModuloAtribuicao,
    current_user: Dict = Depends(get_current_user)
):
    """Atribuir módulos a um utilizador"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    # Verificar se o utilizador existe
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Atualizar módulos do utilizador
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "modulos_atribuidos": data.modulos,
                "modulos_updated_at": datetime.now(timezone.utc).isoformat(),
                "modulos_updated_by": current_user["id"]
            }
        }
    )
    
    logger.info(f"Modules assigned to user {user_id}: {data.modulos}")
    return {"message": "Módulos atribuídos com sucesso", "modulos": data.modulos}


@router.post("/users/{user_id}/modulos")
async def add_modulos_usuario(
    user_id: str,
    data: ModuloAtribuicao,
    current_user: Dict = Depends(get_current_user)
):
    """Adicionar módulos a um utilizador (sem substituir os existentes)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Combinar módulos existentes com novos
    existing = set(user.get("modulos_atribuidos", []))
    new_modulos = existing.union(set(data.modulos))
    
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "modulos_atribuidos": list(new_modulos),
                "modulos_updated_at": datetime.now(timezone.utc).isoformat(),
                "modulos_updated_by": current_user["id"]
            }
        }
    )
    
    return {"message": "Módulos adicionados", "modulos": list(new_modulos)}


@router.get("/users/{user_id}/modulos")
async def get_modulos_usuario(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter módulos de um utilizador"""
    # Admin pode ver todos, utilizador só pode ver os próprios
    if current_user["role"] != UserRole.ADMIN and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    return {
        "user_id": user_id,
        "modulos": user.get("modulos_atribuidos", []),
        "updated_at": user.get("modulos_updated_at")
    }


@router.delete("/users/{user_id}/modulos/{modulo_id}")
async def remove_modulo_usuario(
    user_id: str,
    modulo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remover um módulo de um utilizador"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    result = await db.users.update_one(
        {"id": user_id},
        {
            "$pull": {"modulos_atribuidos": modulo_id},
            "$set": {
                "modulos_updated_at": datetime.now(timezone.utc).isoformat(),
                "modulos_updated_by": current_user["id"]
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utilizador ou módulo não encontrado")
    
    return {"message": f"Módulo {modulo_id} removido"}


@router.get("/modulos/parceiro/{parceiro_id}")
async def get_modulos_parceiro(
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter módulos disponíveis para um parceiro específico"""
    # Verificar permissões
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Buscar parceiro
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
    
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    # Buscar módulos do plano do parceiro
    plano_id = parceiro.get("plano_id")
    modulos_plano = []
    
    if plano_id:
        plano = await db.planos.find_one({"id": plano_id}, {"_id": 0})
        if plano:
            modulos_plano = plano.get("modulos", [])
    
    # Combinar com módulos individuais
    modulos_individuais = parceiro.get("modulos_atribuidos", [])
    
    return {
        "parceiro_id": parceiro_id,
        "plano_id": plano_id,
        "modulos_plano": modulos_plano,
        "modulos_individuais": modulos_individuais,
        "modulos_totais": list(set(modulos_plano + modulos_individuais))
    }
