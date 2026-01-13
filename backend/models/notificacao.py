"""Notification models for FleeTrack application"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class ContactoEmissor(BaseModel):
    """Contact info of notification sender/interested party"""
    nome: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    role: Optional[str] = None


class NotificacaoCreate(BaseModel):
    """Model for creating notification"""
    user_id: str
    tipo: str  # documento_expirando, recibo_pendente, documento_aprovado, contrato_gerado, etc
    titulo: str
    mensagem: str
    prioridade: str = "normal"  # baixa, normal, alta, urgente
    link: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    # Novo: dados de contacto do emissor/interessado
    emissor_id: Optional[str] = None
    contacto_emissor: Optional[ContactoEmissor] = None


class Notificacao(BaseModel):
    """Complete notification model"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tipo: str
    titulo: str
    mensagem: str
    prioridade: str = "normal"
    lida: bool = False
    link: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    criada_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lida_em: Optional[datetime] = None
    enviada_email: bool = False
    enviada_whatsapp: bool = False
    # Novo: dados de contacto do emissor/interessado
    emissor_id: Optional[str] = None
    contacto_emissor: Optional[ContactoEmissor] = None
    # Novo: notas/observações editáveis
    notas: Optional[str] = None
    notas_updated_at: Optional[datetime] = None
    notas_updated_by: Optional[str] = None


class NotificacaoStats(BaseModel):
    """Notification statistics"""
    total: int
    nao_lidas: int
    por_tipo: Dict[str, int]


class NotificacaoUpdate(BaseModel):
    """Model for updating notification"""
    notas: Optional[str] = None
    lida: Optional[bool] = None
