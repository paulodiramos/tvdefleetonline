"""
Expense/Cost models for FleeTrack
- Despesas de fornecedores (Via Verde, Combustível, etc.)
- Associação automática a veículos e motoristas
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class TipoFornecedorDespesa(str, Enum):
    VIA_VERDE = "via_verde"
    COMBUSTIVEL = "combustivel"
    MANUTENCAO = "manutencao"
    SEGURO = "seguro"
    OUTRO = "outro"


class TipoResponsavel(str, Enum):
    MOTORISTA = "motorista"  # Despesa do motorista (aluguer ou comissão)
    VEICULO = "veiculo"      # Despesa do veículo (parceiro)
    PARCEIRO = "parceiro"    # Despesa geral do parceiro


class DespesaFornecedor(BaseModel):
    """Modelo de despesa importada de fornecedor"""
    id: Optional[str] = None
    
    # Origem da despesa
    tipo_fornecedor: TipoFornecedorDespesa = TipoFornecedorDespesa.VIA_VERDE
    importacao_id: Optional[str] = None  # ID do batch de importação
    
    # Identificação do veículo/motorista
    matricula: str
    veiculo_id: Optional[str] = None
    motorista_id: Optional[str] = None
    parceiro_id: str
    
    # Responsabilidade da despesa
    tipo_responsavel: TipoResponsavel = TipoResponsavel.VEICULO
    motivo_responsabilidade: Optional[str] = None  # Ex: "Veículo aluguer", "Via Verde associada ao motorista"
    
    # Dados da despesa
    data_entrada: Optional[datetime] = None
    data_saida: Optional[datetime] = None
    data_pagamento: Optional[datetime] = None
    
    # Localização (para Via Verde)
    ponto_entrada: Optional[str] = None
    ponto_saida: Optional[str] = None
    
    # Valores
    valor_bruto: float = 0.0
    desconto: float = 0.0
    valor_liquido: float = 0.0
    
    # Descrição
    descricao_servico: Optional[str] = None
    tipo_servico: Optional[str] = None  # Autoestradas, Parques, etc.
    
    # Dados extras do ficheiro original
    dados_originais: Dict[str, Any] = {}
    
    # Metadata
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ImportacaoDespesas(BaseModel):
    """Modelo de batch de importação"""
    id: Optional[str] = None
    
    # Info da importação
    nome_ficheiro: str
    tipo_fornecedor: TipoFornecedorDespesa
    parceiro_id: str
    
    # Estatísticas
    total_registos: int = 0
    registos_importados: int = 0
    registos_erro: int = 0
    registos_duplicados: int = 0
    
    # Associações
    veiculos_encontrados: int = 0
    motoristas_associados: int = 0
    
    # Valores totais
    valor_total: float = 0.0
    valor_motoristas: float = 0.0  # Total a cargo dos motoristas
    valor_parceiro: float = 0.0    # Total a cargo do parceiro
    
    # Erros
    erros: List[Dict[str, Any]] = []
    
    # Status
    status: str = "pendente"  # pendente, processando, concluido, erro
    
    # Metadata
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None


class DespesaCreate(BaseModel):
    """Modelo para criar despesa manualmente"""
    tipo_fornecedor: TipoFornecedorDespesa
    matricula: str
    data_entrada: datetime
    valor_bruto: float
    descricao_servico: Optional[str] = None
    ponto_entrada: Optional[str] = None
    ponto_saida: Optional[str] = None


# Mapeamento de colunas Via Verde (PT/EN)
VIA_VERDE_COLUMN_MAPPING = {
    # Colunas em inglês (do ficheiro de exemplo)
    "License Plate": "matricula",
    "Entry Date": "data_entrada",
    "Exit Date": "data_saida",
    "Payment Date": "data_pagamento",
    "Entry Point": "ponto_entrada",
    "Exit Point": "ponto_saida",
    "Value": "valor_bruto",
    "Liquid Value": "valor_liquido",
    "Discount VV": "desconto",
    "Service Description": "tipo_servico",
    "Market Description": "descricao_servico",
    
    # Colunas em português (alternativas)
    "Matrícula": "matricula",
    "Data Entrada": "data_entrada",
    "Data Saída": "data_saida",
    "Data Pagamento": "data_pagamento",
    "Ponto Entrada": "ponto_entrada",
    "Ponto Saída": "ponto_saida",
    "Valor": "valor_bruto",
    "Valor Líquido": "valor_liquido",
    "Desconto": "desconto",
    "Descrição Serviço": "tipo_servico",
    "Descrição Mercado": "descricao_servico",
}
