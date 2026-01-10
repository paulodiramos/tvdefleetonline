"""Vehicle models for FleeTrack application"""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class CaucaoVeiculo(BaseModel):
    """Vehicle caution/deposit model"""
    caucao_total: float = 0.0
    caucao_divisao: str = "total"
    caucao_valor_semanal: float = 0.0
    caucao_pago: float = 0.0
    caucao_restante: float = 0.0


class TipoContrato(BaseModel):
    """Contract type configuration"""
    tipo: Optional[str] = "aluguer"
    valor_aluguer: Optional[float] = None
    periodicidade: Optional[str] = "semanal"
    valor_caucao: Optional[float] = None
    numero_parcelas_caucao: Optional[int] = None
    valor_epoca_alta: Optional[float] = None
    valor_epoca_baixa: Optional[float] = None
    comissao_parceiro: Optional[float] = None
    comissao_motorista: Optional[float] = None
    inclui_combustivel: bool = False
    regime: Optional[str] = None
    valor_compra_veiculo: Optional[float] = None
    numero_semanas_compra: Optional[int] = None
    valor_semanal_compra: Optional[float] = None
    periodo_compra: Optional[int] = None
    valor_acumulado: Optional[float] = None
    valor_falta_cobrar: Optional[float] = None
    com_slot: bool = False
    custo_slot: Optional[float] = None
    extra_seguro: bool = False
    valor_extra_seguro: Optional[float] = None
    inclui_via_verde: bool = False
    horario_turno_1: Optional[str] = None
    horario_turno_2: Optional[str] = None
    horario_turno_3: Optional[str] = None
    horario_turno_4: Optional[str] = None


class CategoriasUber(BaseModel):
    """Uber categories for vehicle"""
    uberx: bool = False
    share: bool = False
    electric: bool = False
    black: bool = False
    comfort: bool = False
    xl: bool = False
    xxl: bool = False


class CategoriasBolt(BaseModel):
    """Bolt categories for vehicle"""
    economy: bool = False
    comfort: bool = False
    xl: bool = False
    electric: bool = False


class VehicleInsurance(BaseModel):
    """Vehicle insurance information"""
    seguradora: Optional[str] = None
    apolice: Optional[str] = None
    data_inicio: Optional[str] = None
    data_validade: Optional[str] = None
    valor_franquia: Optional[float] = None
    coberturas: List[str] = []


class VehicleMaintenance(BaseModel):
    """Vehicle maintenance record"""
    tipo: str
    descricao: str
    data: str
    km: int
    valor: float
    oficina: Optional[str] = None
    notas: Optional[str] = None


class VehicleExtinguisher(BaseModel):
    """Vehicle fire extinguisher information"""
    numero_serie: Optional[str] = None
    data_validade: Optional[str] = None
    proxima_recarga: Optional[str] = None
    certificado_url: Optional[str] = None  # URL do certificado/documento


class VehicleInspection(BaseModel):
    """Vehicle inspection information"""
    data_inspecao: Optional[str] = None
    proxima_inspecao: Optional[str] = None
    resultado: Optional[str] = None
    km_inspecao: Optional[int] = None
    valor: Optional[float] = None
    documento_url: Optional[str] = None  # URL do documento de inspeção


class VehicleAvailability(BaseModel):
    """Vehicle availability status"""
    disponivel: bool = True
    motivo_indisponibilidade: Optional[str] = None
    data_prevista_disponibilidade: Optional[str] = None


class VehicleCreate(BaseModel):
    """Model for creating a new vehicle"""
    marca: str
    modelo: str
    versao: Optional[str] = None
    ano: Optional[int] = None
    matricula: str
    data_matricula: Optional[str] = ""
    validade_matricula: Optional[str] = ""
    cor: Optional[str] = ""
    combustivel: Optional[str] = ""
    caixa: Optional[str] = ""
    lugares: Optional[int] = 5
    parceiro_id: str


class DanoVeiculo(BaseModel):
    """Dano identificado em vistoria"""
    descricao: str
    localizacao: str
    gravidade: str  # "leve", "moderado", "grave"
    fotos: List[str] = []
    custo_estimado: Optional[float] = None
    custo_real: Optional[float] = None
    responsavel: Optional[str] = None  # "motorista", "terceiros", "desgaste"
    motorista_id: Optional[str] = None
    motorista_nome: Optional[str] = None
    reparado: bool = False
    data_reparacao: Optional[datetime] = None


class VehicleVistoria(BaseModel):
    """Vehicle vistoria/inspection record"""
    id: str
    veiculo_id: str
    data_vistoria: datetime
    agendada: bool = False  # Se foi agendada antecipadamente
    data_agendamento: Optional[datetime] = None
    recorrencia: Optional[str] = None  # "mensal", "trimestral", "semestral", "anual"
    proxima_vistoria_auto: Optional[datetime] = None
    tipo: str  # "entrada", "saida", "periodica", "danos"
    km_veiculo: Optional[int] = None
    responsavel_nome: Optional[str] = None
    responsavel_id: Optional[str] = None
    observacoes: Optional[str] = None
    estado_geral: Optional[str] = "bom"  # "excelente", "bom", "razoavel", "mau"
    fotos: List[str] = []
    itens_verificados: Dict[str, Any] = {}  # checklist items
    danos_encontrados: List[DanoVeiculo] = []
    custo_total_danos: Optional[float] = None
    pdf_relatorio: Optional[str] = None
    assinatura_responsavel: Optional[str] = None
    assinatura_motorista: Optional[str] = None
    motorista_associado_id: Optional[str] = None
    motorista_associado_nome: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class VistoriaCreate(BaseModel):
    """Model for creating a new vistoria"""
    veiculo_id: str
    data_vistoria: Optional[datetime] = None
    tipo: str = "periodica"
    km_veiculo: Optional[int] = None
    observacoes: Optional[str] = None
    estado_geral: str = "bom"
    itens_verificados: Dict[str, Any] = {}


class Vehicle(BaseModel):
    """Complete vehicle model"""
    model_config = ConfigDict(extra="ignore")
    id: str
    marca: str
    modelo: str
    versao: Optional[str] = None
    ano: Optional[int] = None
    matricula: str
    data_matricula: Optional[str] = ""
    validade_matricula: Optional[str] = ""
    alerta_validade: bool = False
    cor: Optional[str] = ""
    combustivel: Optional[str] = ""
    caixa: Optional[str] = ""
    lugares: Optional[int] = 5
    tipo_contrato: Optional[TipoContrato] = None
    categorias_uber: Optional[CategoriasUber] = None
    categorias_bolt: Optional[CategoriasBolt] = None
    via_verde_disponivel: bool = False
    via_verde_id: Optional[str] = None
    obu: Optional[str] = None  # OBU Via Verde identifier
    cartao_frota_disponivel: bool = False
    cartao_frota_id: Optional[str] = None  # Cartão Frota Combustível ID
    cartao_frota_eletric_id: Optional[str] = None  # Cartão Frota Elétrico ID
    tem_garantia: bool = False
    stand_responsavel: Optional[str] = None
    data_limite_garantia: Optional[str] = None
    seguro: Optional[VehicleInsurance] = None
    manutencoes: List[VehicleMaintenance] = []
    extintor: Optional[VehicleExtinguisher] = None
    inspecoes: List[VehicleInspection] = []
    inspection: Optional[VehicleInspection] = None
    proxima_vistoria: Optional[datetime] = None
    disponibilidade: Optional[VehicleAvailability] = None
    km_atual: Optional[int] = None
    km_aviso_manutencao: int = 5000
    alertas_manutencao: List[str] = []
    fotos: List[str] = []
    caucao: Optional[CaucaoVeiculo] = None
    danos: List[Dict[str, Any]] = []
    agenda: List[Dict[str, Any]] = []
    historico_editavel: List[Dict[str, Any]] = []
    fotos_veiculo: List[str] = []
    proxima_revisao_km: Optional[int] = None
    proxima_revisao_data: Optional[str] = None
    proxima_revisao_notas: Optional[str] = None
    proxima_revisao_valor_previsto: Optional[float] = None
    motorista_atribuido: Optional[str] = None
    motorista_atribuido_nome: Optional[str] = None
    status: str = "disponivel"
    
    # Contrato de Aluguer/Comissão do Veículo
    tipo_contrato_veiculo: Optional[str] = None  # "aluguer" | "comissao" | "slot"
    valor_semanal: Optional[float] = None  # Valor semanal (€)
    comissao_parceiro: Optional[float] = None  # Percentagem de comissão do parceiro
    tem_caucao: bool = False  # Se tem caução
    valor_caucao: Optional[float] = None  # Valor da caução (€)
    condicoes_contrato: Optional[str] = None  # Condições do contrato
    
    ultima_revisao_km: Optional[int] = None
    data_seguro_ate: Optional[str] = None
    data_inspecao_ate: Optional[str] = None
    plano_manutencoes: List[Dict[str, Any]] = []
    alertas_configuracao: Dict[str, int] = {}
    verificacao_danos_ativa: bool = False
    campos_customizados: Dict[str, Any] = {}
    disponivel_venda: bool = False
    disponivel_aluguer: bool = False
    preco_venda: Optional[float] = None
    preco_aluguer_mensal: Optional[float] = None
    descricao_marketplace: Optional[str] = None
    documento_carta_verde: Optional[str] = None
    documento_condicoes: Optional[str] = None
    documento_recibo_seguro: Optional[str] = None
    documento_inspecao: Optional[str] = None
    documento_dua_frente: Optional[str] = None  # DUA frente
    documento_dua_verso: Optional[str] = None  # DUA verso
    financiamento: Optional[Dict[str, Any]] = None  # Dados de financiamento/prestações
    created_at: datetime
    updated_at: datetime
    parceiro_id: str
