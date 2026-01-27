"""
Modelos para Sistema de Comissões e Classificação de Motoristas
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, time
from enum import Enum


# ==================== TURNOS DE MOTORISTAS ====================

class TurnoMotorista(BaseModel):
    """Turno de um motorista num veículo"""
    id: str
    motorista_id: str
    motorista_nome: Optional[str] = None
    hora_inicio: str  # Formato "HH:MM"
    hora_fim: str     # Formato "HH:MM"
    dias_semana: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])  # 0=Segunda, 6=Domingo
    ativo: bool = True
    notas: Optional[str] = None
    created_at: Optional[datetime] = None


class VeiculoTurnos(BaseModel):
    """Turnos atribuídos a um veículo"""
    veiculo_id: str
    turnos: List[TurnoMotorista] = Field(default_factory=list)
    motorista_principal_id: Optional[str] = None  # Responsável principal


# ==================== ESCALAS DE COMISSÃO ====================

class NivelEscalaComissao(BaseModel):
    """Um nível na escala de comissões"""
    id: str
    nome: str  # Ex: "Nível 1", "Bronze", etc.
    valor_minimo: float  # Valor mínimo faturado
    valor_maximo: Optional[float] = None  # None = sem limite
    percentagem_comissao: float  # % de comissão
    ordem: int  # Ordem de exibição


class EscalaComissao(BaseModel):
    """Escala completa de comissões"""
    id: str
    nome: str  # Ex: "Escala Padrão", "Escala Premium"
    descricao: Optional[str] = None
    niveis: List[NivelEscalaComissao] = Field(default_factory=list)
    ativo: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None


class CriarEscalaRequest(BaseModel):
    """Request para criar escala de comissão"""
    nome: str
    descricao: Optional[str] = None
    niveis: List[dict] = Field(default_factory=list)


class AtualizarNiveisEscalaRequest(BaseModel):
    """Request para atualizar níveis de uma escala"""
    niveis: List[dict]


# ==================== CLASSIFICAÇÃO DE MOTORISTAS ====================

class NivelClassificacaoMotorista(BaseModel):
    """Nível de classificação de motorista"""
    id: str
    nivel: int  # 1 a 5
    nome: str  # Ex: "Bronze", "Prata", "Ouro", "Platina", "Diamante"
    descricao: Optional[str] = None
    icone: str = "⭐"
    cor: str = "#6B7280"
    
    # Critérios para atingir este nível
    meses_minimos: int = 0  # Antiguidade mínima em meses
    cuidado_veiculo_minimo: int = 0  # Pontuação mínima de cuidado (0-100)
    
    # Bónus
    bonus_percentagem: float = 0.0  # % a adicionar à comissão base
    
    # Ordem
    ordem: int = 1


class ConfiguracaoClassificacao(BaseModel):
    """Configuração global de classificação de motoristas"""
    id: str = "config_classificacao_motoristas"
    niveis: List[NivelClassificacaoMotorista] = Field(default_factory=list)
    criterio_automatico: bool = True  # Calcular automaticamente ou apenas manual
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class ClassificacaoMotorista(BaseModel):
    """Classificação atual de um motorista"""
    motorista_id: str
    nivel_id: str
    nivel_numero: int
    nivel_nome: str
    bonus_percentagem: float
    
    # Dados para cálculo
    meses_servico: int = 0
    pontuacao_cuidado_veiculo: int = 0  # 0-100
    
    # Histórico
    data_atribuicao: Optional[datetime] = None
    atribuido_por: Optional[str] = None  # "sistema" ou user_id
    motivo: Optional[str] = None
    
    # Flags
    nivel_manual: bool = False  # Se foi definido manualmente pelo admin


class AtualizarClassificacaoRequest(BaseModel):
    """Request para atualizar classificação de um motorista"""
    nivel_id: Optional[str] = None
    nivel_manual: bool = False
    pontuacao_cuidado_veiculo: Optional[int] = None
    motivo: Optional[str] = None


class CriarNivelClassificacaoRequest(BaseModel):
    """Request para criar/atualizar nível de classificação"""
    nivel: int  # 1-5
    nome: str
    descricao: Optional[str] = None
    icone: str = "⭐"
    cor: str = "#6B7280"
    meses_minimos: int = 0
    cuidado_veiculo_minimo: int = 0
    bonus_percentagem: float = 0.0


# ==================== CÁLCULO DE COMISSÃO ====================

class ResultadoCalculoComissao(BaseModel):
    """Resultado do cálculo de comissão de um motorista"""
    motorista_id: str
    motorista_nome: Optional[str] = None
    
    # Valores base
    valor_faturado: float
    escala_id: str
    escala_nome: str
    nivel_escala_nome: str
    
    # Comissão base (da escala)
    percentagem_base: float
    valor_comissao_base: float
    
    # Bónus classificação
    nivel_classificacao: str
    bonus_classificacao: float
    valor_bonus: float
    
    # Total
    percentagem_total: float
    valor_comissao_total: float
    
    # Detalhes
    detalhes: Optional[str] = None
