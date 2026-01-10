"""Ganhos/Earnings models for FleeTrack application - Uber, Bolt, etc."""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import uuid


class GanhoUber(BaseModel):
    """Modelo para ganhos importados da Uber"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    uuid_motorista_uber: str  # UUID do motorista na Uber
    motorista_id: Optional[str] = None  # ID do motorista no sistema (se encontrado)
    nome_motorista: str
    apelido_motorista: str
    # Período do ficheiro
    periodo_inicio: Optional[str] = None
    periodo_fim: Optional[str] = None
    # Valores principais
    pago_total: float
    rendimentos_total: float
    dinheiro_recebido: Optional[float] = None
    # Tarifas
    tarifa_total: float
    tarifa_base: Optional[float] = None
    tarifa_ajuste: Optional[float] = None
    tarifa_cancelamento: Optional[float] = None
    tarifa_dinamica: Optional[float] = None
    taxa_reserva: Optional[float] = None
    uber_priority: Optional[float] = None
    tempo_espera: Optional[float] = None
    # Taxas e impostos
    taxa_servico: Optional[float] = None
    imposto_tarifa: Optional[float] = None
    taxa_aeroporto: Optional[float] = None
    # Outros
    gratificacao: Optional[float] = None
    portagens: Optional[float] = None
    ajustes: Optional[float] = None
    # Metadata
    ficheiro_nome: str
    data_importacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    importado_por: str
    

class GanhoUberImportResponse(BaseModel):
    """Response for Uber import"""
    total_linhas: int
    motoristas_encontrados: int
    motoristas_nao_encontrados: int
    total_ganhos: float
    ganhos_importados: List[Dict[str, Any]]
    erros: List[str] = []


class GanhoBolt(BaseModel):
    """Modelo para ganhos importados da Bolt"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    identificador_motorista_bolt: str  # Identificador do motorista na Bolt
    identificador_individual: str  # Identificador individual
    motorista_id: Optional[str] = None  # ID do motorista no sistema (se encontrado)
    nome_motorista: str
    email_motorista: str
    telemovel_motorista: Optional[str] = None
    # Período do ficheiro (extraído do nome: 2025W45)
    periodo_semana: Optional[str] = None
    periodo_ano: Optional[str] = None
    # Ganhos brutos
    ganhos_brutos_total: float
    ganhos_brutos_app: float
    iva_ganhos_app: float
    ganhos_brutos_dinheiro: float
    iva_ganhos_dinheiro: float
    dinheiro_recebido: float
    # Extras
    gorjetas: float
    ganhos_campanha: float
    reembolsos_despesas: float
    # Taxas
    taxas_cancelamento: float
    iva_taxas_cancelamento: float
    portagens: float
    taxas_reserva: float
    iva_taxas_reserva: float
    total_taxas: float
    # Comissões e deduções
    comissoes: float
    reembolsos_passageiros: float
    outras_taxas: float
    # Ganhos líquidos
    ganhos_liquidos: float
    pagamento_previsto: float
    # Produtividade
    ganhos_brutos_por_hora: float
    ganhos_liquidos_por_hora: float
    # Metadata
    ficheiro_nome: str
    parceiro_id: Optional[str] = None
    data_importacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    importado_por: str


class ViaVerdeMovimento(BaseModel):
    """Modelo para movimentos Via Verde"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parceiro_id: str
    license_plate: str
    obu: Optional[str] = None
    service: Optional[str] = None
    service_description: Optional[str] = None
    market: Optional[str] = None
    entry_date: Optional[str] = None
    exit_date: Optional[str] = None
    entry_point: Optional[str] = None
    exit_point: Optional[str] = None
    value: Optional[float] = None
    is_payed: Optional[str] = None
    payment_date: Optional[str] = None
    contract_number: Optional[str] = None
    liquid_value: Optional[float] = None
    ficheiro_nome: str
    data_importacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    importado_por: str


class GPSDistancia(BaseModel):
    """Modelo para relatórios GPS de distância"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parceiro_id: str
    veiculo: str  # Matrícula
    condutor: Optional[str] = None
    distancia_percorrida: Optional[float] = None  # KM
    motor_ligado_tempo: Optional[str] = None  # Ex: "13h 16m 34s"
    motor_ligado_minutos: Optional[int] = None
    ficheiro_nome: str
    data_importacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    importado_por: str


class CombustivelEletrico(BaseModel):
    """Modelo para transações de combustível elétrico"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parceiro_id: str
    numero_cartao: Optional[str] = None
    nome: Optional[str] = None
    descricao: Optional[str] = None
    matricula: Optional[str] = None
    id_carregamento: Optional[str] = None
    posto: Optional[str] = None
    energia: Optional[float] = None  # kWh
    duracao: Optional[float] = None  # minutos
    custo: Optional[float] = None
    opc: Optional[float] = None
    iec: Optional[float] = None
    total: Optional[float] = None
    total_com_iva: Optional[float] = None
    fatura: Optional[str] = None
    ficheiro_nome: str
    data_importacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    importado_por: str


class CombustivelFossil(BaseModel):
    """Modelo para transações de combustível fóssil"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parceiro_id: str
    posto: Optional[str] = None
    pais: Optional[str] = None
    rede: Optional[str] = None
    data: Optional[str] = None
    hora: Optional[str] = None
    cartao: Optional[str] = None
    desc_cartao: Optional[str] = None
    estado: Optional[str] = None
    grupo_cartao: Optional[str] = None
    litros: Optional[float] = None
    combustivel: Optional[str] = None
    recibo: Optional[str] = None
    valor_liquido: Optional[float] = None
    iva: Optional[float] = None
    kms: Optional[int] = None
    id_condutor: Optional[str] = None
    fatura: Optional[str] = None
    data_fatura: Optional[str] = None
    valor_unitario: Optional[float] = None
    valor_ref: Optional[float] = None
    valor_desc: Optional[float] = None
    cliente: Optional[str] = None
    tipo_pagamento: Optional[str] = None
    ficheiro_nome: str
    data_importacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    importado_por: str
