"""Contract models for FleeTrack application"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class TemplateContratoCreate(BaseModel):
    """Model for creating contract template"""
    nome_template: str
    tipo_contrato: str
    periodicidade_padrao: str = "semanal"
    valor_base: Optional[float] = None
    valor_caucao: Optional[float] = None
    numero_parcelas_caucao: Optional[int] = None
    valor_epoca_alta: Optional[float] = None
    valor_epoca_baixa: Optional[float] = None
    percentagem_motorista: Optional[float] = None
    percentagem_parceiro: Optional[float] = None
    combustivel_incluido: bool = False
    regime_trabalho: Optional[str] = None
    valor_compra_veiculo: Optional[float] = None
    numero_semanas_compra: Optional[int] = None
    com_slot: bool = False
    extra_seguro: bool = False
    valor_extra_seguro: Optional[float] = None
    clausulas_texto: Optional[str] = None


class ContratoMotoristaCreate(BaseModel):
    """Model for creating motorista contract"""
    template_id: str
    motorista_id: str
    veiculo_id: Optional[str] = None
    periodicidade: str
    valor_aplicado: float
    valor_caucao_aplicado: Optional[float] = None
    numero_parcelas_caucao_aplicado: Optional[int] = None
    epoca_atual: Optional[str] = None
    valor_epoca_alta_aplicado: Optional[float] = None
    valor_epoca_baixa_aplicado: Optional[float] = None
    percentagem_motorista_aplicado: Optional[float] = None
    percentagem_parceiro_aplicado: Optional[float] = None
    combustivel_incluido_aplicado: bool = False
    regime_trabalho_aplicado: Optional[str] = None
    valor_compra_aplicado: Optional[float] = None
    numero_semanas_aplicado: Optional[int] = None
    com_slot_aplicado: bool = False
    extra_seguro_aplicado: bool = False
    valor_extra_seguro_aplicado: Optional[float] = None
    data_inicio: str


class ContratoMotorista(BaseModel):
    """Individual contract for motorista"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    template_id: str
    parceiro_id: str
    motorista_id: str
    veiculo_id: Optional[str] = None
    nome_template: str
    tipo_contrato: str
    periodicidade: str
    valor_aplicado: float
    valor_caucao_aplicado: Optional[float] = None
    numero_parcelas_caucao_aplicado: Optional[int] = None
    valor_parcela_caucao_aplicado: Optional[float] = None
    epoca_atual: Optional[str] = None
    valor_epoca_alta_aplicado: Optional[float] = None
    valor_epoca_baixa_aplicado: Optional[float] = None
    percentagem_motorista_aplicado: Optional[float] = None
    percentagem_parceiro_aplicado: Optional[float] = None
    combustivel_incluido_aplicado: bool = False
    regime_trabalho_aplicado: Optional[str] = None
    valor_compra_aplicado: Optional[float] = None
    numero_semanas_aplicado: Optional[int] = None
    com_slot_aplicado: bool = False
    extra_seguro_aplicado: bool = False
    valor_extra_seguro_aplicado: Optional[float] = None
    clausulas_texto: Optional[str] = None
    data_inicio: str
    data_fim: Optional[str] = None
    data_emissao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "ativo"
    pdf_url: Optional[str] = None
    assinado_motorista: bool = False
    data_assinatura_motorista: Optional[datetime] = None
    assinado_parceiro: bool = False
    data_assinatura_parceiro: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str


class ContratoCreate(BaseModel):
    """Model for creating general contract (from /contratos/gerar)"""
    parceiro_id: str
    motorista_id: str
    vehicle_id: str
    data_inicio: str
    tipo_contrato: str = "comissao"
    valor_semanal: float = 230.0
    comissao_percentual: Optional[float] = None
    caucao_total: float = 300.0
    caucao_lavagem: float = 90.0
    tem_caucao: bool = True
    caucao_parcelada: bool = False
    caucao_parcelas: Optional[int] = None
    caucao_texto: Optional[str] = None
    tem_epoca: bool = False
    data_inicio_epoca_alta: Optional[str] = None
    data_fim_epoca_alta: Optional[str] = None
    valor_epoca_alta: Optional[float] = None
    texto_epoca_alta: Optional[str] = None
    data_inicio_epoca_baixa: Optional[str] = None
    data_fim_epoca_baixa: Optional[str] = None
    valor_epoca_baixa: Optional[float] = None
    texto_epoca_baixa: Optional[str] = None
    condicoes_veiculo: Optional[str] = None
    template_texto: Optional[str] = None


class Contrato(BaseModel):
    """Complete contract model"""
    model_config = ConfigDict(extra="ignore")
    id: str
    referencia: str
    parceiro_id: str
    motorista_id: str
    vehicle_id: Optional[str] = None
    parceiro_nome: str
    parceiro_nif: str
    parceiro_morada: str
    parceiro_codigo_postal: Optional[str] = None
    parceiro_localidade: Optional[str] = None
    parceiro_telefone: Optional[str] = None
    parceiro_email: str
    parceiro_representante_legal_nome: Optional[str] = None
    parceiro_representante_legal_contribuinte: Optional[str] = None
    parceiro_representante_legal_cc: Optional[str] = None
    parceiro_representante_legal_cc_validade: Optional[str] = None
    parceiro_representante_legal_telefone: Optional[str] = None
    parceiro_representante_legal_email: Optional[str] = None
    motorista_nome: str
    motorista_cc: str
    motorista_cc_validade: Optional[str] = None
    motorista_nif: str
    motorista_morada: str
    motorista_codigo_postal: Optional[str] = None
    motorista_localidade: Optional[str] = None
    motorista_telefone: Optional[str] = None
    motorista_carta_conducao: Optional[str] = None
    motorista_carta_conducao_validade: Optional[str] = None
    motorista_licenca_tvde: Optional[str] = None
    motorista_licenca_tvde_validade: Optional[str] = None
    motorista_seguranca_social: Optional[str] = None
    motorista_email: str
    vehicle_marca: Optional[str] = None
    vehicle_modelo: Optional[str] = None
    vehicle_matricula: Optional[str] = None
    tipo_contrato: str
    valor_semanal: float
    comissao_percentual: Optional[float] = None
    caucao_total: float
    caucao_lavagem: float
    tem_caucao: bool
    caucao_parcelada: bool
    caucao_parcelas: Optional[int] = None
    caucao_texto: Optional[str] = None
    tem_epoca: bool
    data_inicio_epoca_alta: Optional[str] = None
    data_fim_epoca_alta: Optional[str] = None
    valor_epoca_alta: Optional[float] = None
    texto_epoca_alta: Optional[str] = None
    data_inicio_epoca_baixa: Optional[str] = None
    data_fim_epoca_baixa: Optional[str] = None
    valor_epoca_baixa: Optional[float] = None
    texto_epoca_baixa: Optional[str] = None
    condicoes_veiculo: Optional[str] = None
    data_inicio: str
    data_emissao: datetime
    texto_contrato_completo: str
    pdf_url: Optional[str] = None
    status: str = "pendente"
    assinado_motorista: bool = False
    data_assinatura_motorista: Optional[datetime] = None
    assinado_parceiro: bool = False
    data_assinatura_parceiro: Optional[datetime] = None
    created_at: datetime
    created_by: str
