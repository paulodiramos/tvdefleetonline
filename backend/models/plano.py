"""Plan models for FleeTrack application"""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class PlanoPromocao(BaseModel):
    """Promotion configuration for plans"""
    ativa: bool = False
    nome: str = ""
    desconto_percentagem: float = 0
    valida_ate: Optional[str] = None


class PlanoMotorista(BaseModel):
    """Plan for motoristas"""
    model_config = ConfigDict(extra="ignore")
    id: str
    nome: str
    descricao: str
    preco_semanal: float
    preco_mensal: float
    features: List[str] = []
    ativo: bool = True
    created_at: datetime
    updated_at: datetime


class PlanoParceiro(BaseModel):
    """Plan for parceiros"""
    model_config = ConfigDict(extra="ignore")
    id: str
    nome: str
    descricao: str
    preco_mensal: float
    features: List[str] = []
    max_veiculos: int = 0
    max_motoristas: int = 0
    ativo: bool = True
    created_at: datetime
    updated_at: datetime


class PlanoMotoristaCreate(BaseModel):
    """Model for creating motorista plan"""
    nome: str
    descricao: str
    preco_semanal: float
    preco_mensal: float
    features: List[str] = []


class PlanoMotoristaUpdate(BaseModel):
    """Model for updating motorista plan"""
    nome: Optional[str] = None
    descricao: Optional[str] = None
    preco_semanal: Optional[float] = None
    preco_mensal: Optional[float] = None
    features: Optional[List[str]] = None
    ativo: Optional[bool] = None


class MotoristaPlanoAssinatura(BaseModel):
    """Motorista plan subscription"""
    model_config = ConfigDict(extra="ignore")
    id: str
    motorista_id: str
    plano_id: str
    periodicidade: str
    data_inicio: str
    data_fim: str
    auto_renovacao: bool = False
    ativo: bool = True
    created_at: datetime
