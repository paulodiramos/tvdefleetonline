"""Sincronização/Sync models for FleeTrack application"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class CredenciaisPlataforma(BaseModel):
    """Credenciais para sincronização com plataformas"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parceiro_id: str  # Cada parceiro tem suas próprias credenciais
    plataforma: str  # uber, bolt, via_verde, combustivel, gps
    email: str
    password_encrypted: str  # Encriptado
    ativo: bool = True
    ultima_sincronizacao: Optional[datetime] = None
    proxima_sincronizacao: Optional[datetime] = None
    sincronizacao_automatica: bool = False
    horario_sincronizacao: Optional[str] = None  # ex: "09:00"
    frequencia_dias: int = 7  # Semanal por padrão
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    

class LogSincronizacao(BaseModel):
    """Log de sincronização"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parceiro_id: str  # Log associado ao parceiro
    plataforma: str
    tipo_sincronizacao: str  # manual, automatico
    status: str  # sucesso, erro, parcial
    data_inicio: datetime
    data_fim: Optional[datetime] = None
    registos_importados: int = 0
    registos_erro: int = 0
    mensagem: Optional[str] = None
    detalhes: Dict[str, Any] = {}
    executado_por: Optional[str] = None  # user_id se manual
