"""Authentication and profile routes"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict
from datetime import datetime, timezone
import uuid

from models.user import User, UserCreate, UserLogin, TokenResponse, UserRole
from utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from utils.database import get_database

router = APIRouter()
db = get_database()


async def enviar_email_boas_vindas(user: Dict):
    """Send welcome email to new user"""
    role_labels = {
        "motorista": "Motorista",
        "parceiro": "Parceiro",
        "operacional": "Operacional",
        "gestao": "Gestor",
        "admin": "Administrador"
    }
    
    role_label = role_labels.get(user.get("role"), "Utilizador")
    
    # Get email config
    config = await db.configuracoes.find_one({"tipo": "email"}, {"_id": 0})
    email_from = config.get("email_contacto", "info@tvdefleet.com") if config else "info@tvdefleet.com"
    
    print(f"📧 ENVIAR EMAIL DE BOAS-VINDAS:")
    print(f"   Para: {user.get('email')}")
    print(f"   Nome: {user.get('name')}")
    print(f"   Role: {role_label}")
    
    # Queue email for sending
    await db.email_queue.insert_one({
        "to": user.get("email"),
        "from": email_from,
        "subject": f"Bem-vindo à TVDEFleet - Registo de {role_label}",
        "body": f"""
        Olá {user.get('name')},
        
        Bem-vindo à TVDEFleet!
        
        O seu registo como {role_label} foi recebido com sucesso.
        
        A nossa equipa irá analisar os seus dados e entrará em contacto em breve.
        Após aprovação, receberá as suas credenciais de acesso definitivas.
        
        Dados do registo:
        - Email: {user.get('email')}
        - Telefone: {user.get('phone', 'N/A')}
        - Data de registo: {user.get('created_at')}
        
        Se tiver alguma dúvida, entre em contacto connosco:
        Email: {email_from}
        Telefone: +351 912 345 678
        WhatsApp: https://wa.me/351912345678
        
        Obrigado,
        Equipa TVDEFleet
        """,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "tipo": "boas_vindas",
        "user_id": user.get("id")
    })


@router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    """Register a new user"""
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user_data.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["id"] = str(uuid.uuid4())
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    user_dict["approved"] = user_data.role == UserRole.ADMIN
    
    await db.users.insert_one(user_dict)
    
    # Send welcome email
    await enviar_email_boas_vindas(user_dict)
    
    user_dict.pop("password")
    if isinstance(user_dict["created_at"], str):
        user_dict["created_at"] = datetime.fromisoformat(user_dict["created_at"])
    
    return User(**user_dict)


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login user"""
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user["role"] == UserRole.MOTORISTA and not user.get("approved", False):
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    token = create_access_token(user["id"], user["email"], user["role"])
    
    user.pop("password")
    if isinstance(user["created_at"], str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    
    return TokenResponse(access_token=token, user=User(**user))


@router.get("/auth/me", response_model=User)
async def get_me(current_user: Dict = Depends(get_current_user)):
    """Get current user info"""
    if isinstance(current_user["created_at"], str):
        current_user["created_at"] = datetime.fromisoformat(current_user["created_at"])
    return User(**current_user)


@router.put("/profile/update")
async def update_profile(update_data: Dict, current_user: Dict = Depends(get_current_user)):
    """Update user profile"""
    allowed_fields = ["name", "phone", "morada", "campos_customizados"]
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_dict})
    
    return {"message": "Profile updated successfully"}


@router.post("/profile/change-password")
async def change_password(
    password_data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Change user password"""
    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Missing password fields")
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not verify_password(current_password, user["password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    hashed_new = hash_password(new_password)
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"password": hashed_new}})
    
    return {"message": "Password changed successfully"}


@router.get("/profile/permissions")
async def get_permissions(current_user: Dict = Depends(get_current_user)):
    """Get user permissions based on role and subscription"""
    permissions = {
        "can_add_motoristas": False,
        "can_add_vehicles": False,
        "can_view_financeiro": False,
        "can_create_contracts": False,
        "can_manage_planos": False,
        "can_view_alertas": False,
        "max_motoristas": 0,
        "max_vehicles": 0
    }
    
    role = current_user["role"]
    
    if role == UserRole.ADMIN or role == UserRole.GESTAO:
        # Full permissions
        permissions.update({
            "can_add_motoristas": True,
            "can_add_vehicles": True,
            "can_view_financeiro": True,
            "can_create_contracts": True,
            "can_manage_planos": True,
            "can_view_alertas": True,
            "max_motoristas": 999,
            "max_vehicles": 999
        })
    elif role == UserRole.PARCEIRO:
        # Parceiro has access based on their setup
        permissions.update({
            "can_add_motoristas": True,
            "can_add_vehicles": True,
            "can_view_financeiro": True,
            "can_create_contracts": True,
            "can_manage_planos": False,
            "can_view_alertas": True,
            "max_motoristas": 999,
            "max_vehicles": 999
        })
    elif role == UserRole.OPERACIONAL:
        # Check subscription for operacional
        subscription_id = current_user.get("subscription_id")
        if subscription_id:
            subscription = await db.motorista_plano_assinaturas.find_one(
                {"id": subscription_id}, {"_id": 0}
            )
            if subscription and subscription.get("status") == "ativo":
                plano_id = subscription.get("plano_id")
                plano = await db.planos_motorista.find_one({"id": plano_id}, {"_id": 0})
                if plano:
                    permissions.update({
                        "can_add_motoristas": plano.get("permite_adicionar_motoristas", False),
                        "can_add_vehicles": plano.get("permite_adicionar_veiculos", False),
                        "can_view_financeiro": plano.get("acesso_relatorios_financeiros", False),
                        "can_create_contracts": plano.get("permite_criar_contratos", False),
                        "can_view_alertas": plano.get("alertas_manutencao", False),
                        "max_motoristas": plano.get("limite_motoristas", 0),
                        "max_vehicles": plano.get("limite_veiculos", 0)
                    })
    
    return permissions


@router.post("/auth/forgot-password")
async def forgot_password(email_data: Dict):
    """Send password reset email"""
    email = email_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a reset link will be sent"}
    
    # TODO: Generate reset token and send email
    print(f"📧 Password reset requested for: {email}")
    
    return {"message": "If the email exists, a reset link will be sent"}
