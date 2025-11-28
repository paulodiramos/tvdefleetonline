"""Report and financial models for FleeTrack application"""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class ExpenseCreate(BaseModel):
    """Model for creating an expense"""
    vehicle_id: str
    tipo: str
    descricao: str
    valor: float
    data: str
    categoria: str


class Expense(BaseModel):
    """Expense record"""
    model_config = ConfigDict(extra="ignore")
    id: str
    vehicle_id: str
    tipo: str
    descricao: str
    valor: float
    data: str
    categoria: str
    created_at: datetime


class RevenueCreate(BaseModel):
    """Model for creating revenue"""
    vehicle_id: str
    motorista_id: Optional[str] = None
    tipo: str
    valor: float
    data: str
    km_percorridos: Optional[int] = None


class Revenue(BaseModel):
    """Revenue record"""
    model_config = ConfigDict(extra="ignore")
    id: str
    vehicle_id: str
    motorista_id: Optional[str] = None
    tipo: str
    valor: float
    data: str
    km_percorridos: Optional[int] = None
    created_at: datetime


class RelatorioCreate(BaseModel):
    """Model for creating weekly report"""
    parceiro_id: str
    motorista_id: str
    data_inicio: str
    data_fim: str
    total_ganhos: float
    total_combustivel: float
    total_via_verde: float
    total_extras: float
    valor_a_pagar: float
    observacoes: Optional[str] = None


class RelatorioSemanal(BaseModel):
    """Weekly report model"""
    model_config = ConfigDict(extra="ignore")
    id: str
    parceiro_id: str
    motorista_id: str
    motorista_nome: str
    semana: Optional[str] = None
    data_inicio: str
    data_fim: str
    total_ganhos: float
    total_combustivel: float
    total_via_verde: float
    total_extras: float
    valor_a_pagar: float
    estado: str = "pendente"
    comprovativo_url: Optional[str] = None
    data_pagamento: Optional[str] = None
    metodo_pagamento: Optional[str] = None
    observacoes: Optional[str] = None
    created_at: str
    updated_at: str


class RelatorioGanhos(BaseModel):
    """Earnings report model (alias for RelatorioSemanal)"""
    model_config = ConfigDict(extra="ignore")
    id: str
    parceiro_id: str
    motorista_id: str
    motorista_nome: str
    semana: Optional[str] = None
    data_inicio: str
    data_fim: str
    total_ganhos: float
    total_combustivel: float
    total_via_verde: float
    total_extras: float
    valor_a_pagar: float
    estado: str = "pendente"
    comprovativo_url: Optional[str] = None
    data_pagamento: Optional[str] = None
    metodo_pagamento: Optional[str] = None
    observacoes: Optional[str] = None
    created_at: str
    updated_at: str


class ReciboMotorista(BaseModel):
    """Motorista receipt model"""
    model_config = ConfigDict(extra="ignore")
    id: str
    motorista_id: str
    parceiro_id: str
    data_inicio: str
    data_fim: str
    valor_total: float
    valor_iva: Optional[float] = None
    estado: str = "pendente"
    recibo_url: Optional[str] = None
    observacoes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
