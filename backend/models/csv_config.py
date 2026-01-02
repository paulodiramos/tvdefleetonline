"""
CSV Configuration models for FleeTrack application
Allows users to configure custom mappings for CSV imports from different platforms
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class CSVColumnMapping(BaseModel):
    """Mapping between CSV column and system field"""
    csv_column: str = Field(..., description="Nome da coluna no CSV")
    system_field: str = Field(..., description="Campo do sistema para mapear")
    transform: Optional[str] = None  # "money", "date", "number", "text"
    default_value: Optional[str] = None
    required: bool = False


class CSVConfiguracao(BaseModel):
    """Configuration for CSV extraction from a specific platform"""
    id: Optional[str] = None
    parceiro_id: str
    plataforma: str  # uber, bolt, via_verde, combustivel, gps
    nome_configuracao: str
    descricao: Optional[str] = None
    
    # File settings
    delimitador: str = ","  # , ; \t
    encoding: str = "utf-8"  # utf-8, latin-1, windows-1252
    skip_linhas: int = 0  # Skip header lines
    
    # Column mappings
    mapeamentos: List[CSVColumnMapping] = []
    
    # Platform-specific settings
    configuracoes_especificas: Dict[str, Any] = {}
    
    # Active state
    ativo: bool = True
    
    # Audit
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None


class CSVConfiguracaoCreate(BaseModel):
    """Model for creating a CSV configuration"""
    parceiro_id: str
    plataforma: str
    nome_configuracao: str
    descricao: Optional[str] = None
    delimitador: str = ","
    encoding: str = "utf-8"
    skip_linhas: int = 0
    mapeamentos: List[CSVColumnMapping] = []
    configuracoes_especificas: Dict[str, Any] = {}


class CSVConfiguracaoUpdate(BaseModel):
    """Model for updating a CSV configuration"""
    nome_configuracao: Optional[str] = None
    descricao: Optional[str] = None
    delimitador: Optional[str] = None
    encoding: Optional[str] = None
    skip_linhas: Optional[int] = None
    mapeamentos: Optional[List[CSVColumnMapping]] = None
    configuracoes_especificas: Optional[Dict[str, Any]] = None
    ativo: Optional[bool] = None


# Default mappings for common platforms
DEFAULT_UBER_MAPPINGS = [
    CSVColumnMapping(csv_column="UUID do motorista", system_field="uuid_motorista", required=True),
    CSVColumnMapping(csv_column="Nome próprio do motorista", system_field="nome_proprio"),
    CSVColumnMapping(csv_column="Apelido do motorista", system_field="apelido"),
    CSVColumnMapping(csv_column="Pago a si", system_field="pago_total", transform="money"),
    CSVColumnMapping(csv_column="Pago a si : Os seus rendimentos", system_field="rendimentos_total", transform="money"),
    CSVColumnMapping(csv_column="Pago a si : Os seus rendimentos : Tarifa", system_field="tarifa", transform="money"),
    CSVColumnMapping(csv_column="Pago a si:Os seus rendimentos:Gratificação", system_field="gratificacao", transform="money"),
]

DEFAULT_BOLT_MAPPINGS = [
    CSVColumnMapping(csv_column="Date", system_field="data", transform="date"),
    CSVColumnMapping(csv_column="Driver", system_field="motorista"),
    CSVColumnMapping(csv_column="Earnings", system_field="ganhos", transform="money"),
    CSVColumnMapping(csv_column="Distance", system_field="distancia", transform="number"),
    CSVColumnMapping(csv_column="Duration", system_field="duracao", transform="number"),
]

DEFAULT_VIAVERDE_MAPPINGS = [
    CSVColumnMapping(csv_column="License Plate", system_field="matricula", required=True),
    CSVColumnMapping(csv_column="Entry Date", system_field="data_entrada", transform="date"),
    CSVColumnMapping(csv_column="Exit Date", system_field="data_saida", transform="date"),
    CSVColumnMapping(csv_column="Entry Point", system_field="ponto_entrada"),
    CSVColumnMapping(csv_column="Exit Point", system_field="ponto_saida"),
    CSVColumnMapping(csv_column="Value", system_field="valor", transform="money"),
    CSVColumnMapping(csv_column="Liquid Value", system_field="valor_liquido", transform="money"),
]

DEFAULT_COMBUSTIVEL_MAPPINGS = [
    CSVColumnMapping(csv_column="Data", system_field="data", transform="date"),
    CSVColumnMapping(csv_column="Matrícula", system_field="matricula", required=True),
    CSVColumnMapping(csv_column="Valor", system_field="valor", transform="money"),
    CSVColumnMapping(csv_column="Litros", system_field="litros", transform="number"),
    CSVColumnMapping(csv_column="Posto", system_field="posto"),
    CSVColumnMapping(csv_column="Tipo", system_field="tipo_combustivel"),
]

DEFAULT_GPS_MAPPINGS = [
    CSVColumnMapping(csv_column="Data", system_field="data", transform="date"),
    CSVColumnMapping(csv_column="Matrícula", system_field="matricula", required=True),
    CSVColumnMapping(csv_column="Distância", system_field="distancia", transform="number"),
    CSVColumnMapping(csv_column="Velocidade", system_field="velocidade", transform="number"),
    CSVColumnMapping(csv_column="Latitude", system_field="latitude"),
    CSVColumnMapping(csv_column="Longitude", system_field="longitude"),
]


def get_default_mappings(plataforma: str) -> List[CSVColumnMapping]:
    """Get default column mappings for a platform"""
    mappings_map = {
        "uber": DEFAULT_UBER_MAPPINGS,
        "bolt": DEFAULT_BOLT_MAPPINGS,
        "via_verde": DEFAULT_VIAVERDE_MAPPINGS,
        "combustivel": DEFAULT_COMBUSTIVEL_MAPPINGS,
        "gps": DEFAULT_GPS_MAPPINGS,
    }
    return mappings_map.get(plataforma.lower(), [])


# System fields available for mapping
SYSTEM_FIELDS = {
    "uber": [
        {"field": "uuid_motorista", "label": "UUID do Motorista", "type": "text"},
        {"field": "nome_proprio", "label": "Nome Próprio", "type": "text"},
        {"field": "apelido", "label": "Apelido", "type": "text"},
        {"field": "nome_completo", "label": "Nome Completo", "type": "text"},
        {"field": "pago_total", "label": "Pago Total", "type": "money"},
        {"field": "rendimentos_total", "label": "Rendimentos Total", "type": "money"},
        {"field": "tarifa", "label": "Tarifa", "type": "money"},
        {"field": "gratificacao", "label": "Gratificação", "type": "money"},
        {"field": "taxa_servico", "label": "Taxa de Serviço", "type": "money"},
        {"field": "comissao", "label": "Comissão", "type": "money"},
    ],
    "bolt": [
        {"field": "data", "label": "Data", "type": "date"},
        {"field": "motorista", "label": "Motorista", "type": "text"},
        {"field": "ganhos", "label": "Ganhos", "type": "money"},
        {"field": "distancia", "label": "Distância (km)", "type": "number"},
        {"field": "duracao", "label": "Duração (min)", "type": "number"},
        {"field": "viagem_id", "label": "ID da Viagem", "type": "text"},
        {"field": "comissao", "label": "Comissão", "type": "money"},
    ],
    "via_verde": [
        {"field": "matricula", "label": "Matrícula", "type": "text"},
        {"field": "data_entrada", "label": "Data Entrada", "type": "date"},
        {"field": "data_saida", "label": "Data Saída", "type": "date"},
        {"field": "ponto_entrada", "label": "Ponto Entrada", "type": "text"},
        {"field": "ponto_saida", "label": "Ponto Saída", "type": "text"},
        {"field": "valor", "label": "Valor", "type": "money"},
        {"field": "valor_liquido", "label": "Valor Líquido", "type": "money"},
    ],
    "combustivel": [
        {"field": "data", "label": "Data", "type": "date"},
        {"field": "matricula", "label": "Matrícula", "type": "text"},
        {"field": "valor", "label": "Valor", "type": "money"},
        {"field": "litros", "label": "Litros", "type": "number"},
        {"field": "preco_litro", "label": "Preço/Litro", "type": "money"},
        {"field": "posto", "label": "Posto", "type": "text"},
        {"field": "tipo_combustivel", "label": "Tipo Combustível", "type": "text"},
        {"field": "kwh", "label": "kWh (elétrico)", "type": "number"},
    ],
    "gps": [
        {"field": "data", "label": "Data", "type": "date"},
        {"field": "matricula", "label": "Matrícula", "type": "text"},
        {"field": "distancia", "label": "Distância (km)", "type": "number"},
        {"field": "velocidade", "label": "Velocidade (km/h)", "type": "number"},
        {"field": "latitude", "label": "Latitude", "type": "text"},
        {"field": "longitude", "label": "Longitude", "type": "text"},
        {"field": "localizacao", "label": "Localização", "type": "text"},
    ],
}
