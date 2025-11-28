"""User models for FleeTrack application"""

from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime


class UserRole:
    """User role constants"""
    ADMIN = "admin"
    GESTAO = "gestao"  # Gestor Associado - pode gerir múltiplos parceiros
    PARCEIRO = "parceiro"
    OPERACIONAL = "operacional"  # Parceiro com gestão de frota própria
    MOTORISTA = "motorista"


class UserProfileUpdate(BaseModel):
    """Model for updating user profile"""
    name: Optional[str] = None
    phone: Optional[str] = None
    empresa: Optional[str] = None
    nif: Optional[str] = None
    morada: Optional[str] = None


class UserBase(BaseModel):
    """Base user model"""
    email: EmailStr
    name: str
    role: str
    phone: Optional[str] = None


class UserCreate(UserBase):
    """Model for creating a new user"""
    password: str


class UserLogin(BaseModel):
    """Model for user login"""
    email: EmailStr
    password: str


class User(UserBase):
    """Complete user model"""
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: datetime
    approved: bool = False
    associated_partner_id: Optional[str] = None
    associated_gestor_id: Optional[str] = None
    subscription_id: Optional[str] = None  # ID da subscrição ativa
    plano_manutencao_ativo: bool = False  # Plano adicional para editar manutenções (Operacional)
    plano_alertas_ativo: bool = False  # Plano adicional para editar alertas (Operacional)
    campos_customizados: Dict[str, Any] = {}  # Campos adicionais customizáveis


class TokenResponse(BaseModel):
    """Model for authentication token response"""
    access_token: str
    token_type: str = "bearer"
    user: User
