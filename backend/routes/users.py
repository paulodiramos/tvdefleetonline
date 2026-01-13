"""User management routes"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import logging

from models.user import UserRole
from utils.auth import get_current_user, get_password_hash
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)


class UserStatusUpdate(BaseModel):
    ativo: bool


class UserRoleUpdate(BaseModel):
    role: str


class PasswordReset(BaseModel):
    new_password: str


@router.get("/users/pending")
async def get_pending_users(current_user: Dict = Depends(get_current_user)):
    """Listar utilizadores pendentes de aprovação"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    users = await db.users.find(
        {"approved": False},
        {"_id": 0, "password": 0}
    ).to_list(length=None)
    
    return users


@router.get("/users/all")
async def get_all_users(current_user: Dict = Depends(get_current_user)):
    """Listar todos os utilizadores"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Build query based on role
    query = {}
    if current_user["role"] == UserRole.GESTAO:
        # Gestores só veem parceiros e motoristas
        query["role"] = {"$in": ["parceiro", "motorista"]}
    
    users = await db.users.find(
        query,
        {"_id": 0, "password": 0}
    ).to_list(length=None)
    
    # Enrich with additional data
    for user in users:
        if user.get("role") == "parceiro":
            parceiro = await db.parceiros.find_one(
                {"$or": [{"id": user["id"]}, {"email": user.get("email")}]},
                {"_id": 0, "nome_empresa": 1}
            )
            if parceiro:
                user["nome_empresa"] = parceiro.get("nome_empresa")
        
        if user.get("role") == "motorista":
            motorista = await db.motoristas.find_one(
                {"$or": [{"id": user["id"]}, {"email": user.get("email")}]},
                {"_id": 0, "parceiro_id": 1}
            )
            if motorista:
                user["parceiro_id"] = motorista.get("parceiro_id")
    
    return users


@router.put("/users/{user_id}/approve")
async def approve_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Aprovar um utilizador"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "approved": True,
                "approved_by": current_user["id"],
                "approved_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Also approve in motoristas/parceiros if applicable
    if user.get("role") == "motorista":
        await db.motoristas.update_one(
            {"$or": [{"id": user_id}, {"email": user.get("email")}]},
            {
                "$set": {
                    "approved": True,
                    "approved_by": current_user["id"],
                    "approved_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    elif user.get("role") == "parceiro":
        await db.parceiros.update_one(
            {"$or": [{"id": user_id}, {"email": user.get("email")}]},
            {
                "$set": {
                    "approved": True,
                    "approved_by": current_user["id"],
                    "approved_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    logger.info(f"User {user_id} approved by {current_user['id']}")
    return {"message": "Utilizador aprovado com sucesso"}


@router.put("/users/{user_id}/set-role")
async def set_user_role(
    user_id: str,
    role_data: UserRoleUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Alterar role de um utilizador"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    valid_roles = ["admin", "gestao", "parceiro", "motorista"]
    if role_data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Role inválido. Valores válidos: {valid_roles}")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": role_data.role}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    return {"message": f"Role alterado para {role_data.role}"}


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status_data: UserStatusUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Ativar/desativar um utilizador"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"ativo": status_data.ativo}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    status_str = "ativado" if status_data.ativo else "desativado"
    return {"message": f"Utilizador {status_str}"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar um utilizador"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    # Delete related data based on role
    if user.get("role") == "motorista":
        await db.motoristas.delete_one({"$or": [{"id": user_id}, {"email": user.get("email")}]})
    elif user.get("role") == "parceiro":
        await db.parceiros.delete_one({"$or": [{"id": user_id}, {"email": user.get("email")}]})
    
    logger.info(f"User {user_id} deleted by {current_user['id']}")
    return {"message": "Utilizador eliminado"}


@router.put("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    password_data: PasswordReset,
    current_user: Dict = Depends(get_current_user)
):
    """Reset password de um utilizador"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password deve ter pelo menos 6 caracteres")
    
    hashed_password = get_password_hash(password_data.new_password)
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password": hashed_password}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    logger.info(f"Password reset for user {user_id} by {current_user['id']}")
    return {"message": "Password alterada com sucesso"}
