"""Message and conversation models for FleeTrack application"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid


class MensagemCreate(BaseModel):
    """Model for creating message"""
    conversa_id: str
    conteudo: str
    anexo_url: Optional[str] = None


class Mensagem(BaseModel):
    """Complete message model"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversa_id: str
    remetente_id: str
    remetente_nome: str
    conteudo: str
    anexo_url: Optional[str] = None
    lida: bool = False
    criada_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lida_em: Optional[datetime] = None


class ConversaCreate(BaseModel):
    """Model for creating conversation"""
    participante_id: str
    assunto: Optional[str] = None


class Conversa(BaseModel):
    """Complete conversation model"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    participantes: List[str]  # List of user IDs
    participantes_info: Optional[List[dict]] = None  # User info for display
    assunto: Optional[str] = None
    ultima_mensagem: Optional[str] = None
    ultima_mensagem_em: Optional[datetime] = None
    criada_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    criada_por: Optional[str] = None  # Made optional for system-created conversations
    mensagens_nao_lidas: int = 0
    # Campos para conversas de interesse em veículos
    tipo: Optional[str] = None  # 'normal', 'interesse_veiculo', etc.
    veiculo_id: Optional[str] = None
    contacto_externo: Optional[dict] = None  # Dados de contacto externo
    status: Optional[str] = None  # 'ativo', 'arquivado', etc.


class ConversaStats(BaseModel):
    """Conversation statistics"""
    total: int
    com_nao_lidas: int
    total_nao_lidas: int
