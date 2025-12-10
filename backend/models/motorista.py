"""Motorista models for FleeTrack application"""

from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime


class MotoristaDocuments(BaseModel):
    """Documents uploaded by motorista"""
    cc_frente: Optional[str] = None
    cc_verso: Optional[str] = None
    carta_conducao_frente: Optional[str] = None
    carta_conducao_verso: Optional[str] = None
    licenca_tvde_frente: Optional[str] = None
    licenca_tvde_verso: Optional[str] = None
    registo_criminal: Optional[str] = None
    contrato_assinado: Optional[str] = None
    iban_documento: Optional[str] = None
    seguro_acidentes: Optional[str] = None
    nif_documento: Optional[str] = None


class DocumentoValidacao(BaseModel):
    """Validation status for each document"""
    validado: bool = False
    validado_por: Optional[str] = None
    validado_em: Optional[datetime] = None
    observacoes: Optional[str] = None


class MotoristaCreate(BaseModel):
    """Model for creating a new motorista"""
    email: EmailStr
    password: Optional[str] = None
    name: str
    phone: str
    morada_completa: str
    codigo_postal: str
    data_nascimento: str
    nacionalidade: str
    tipo_documento: str
    numero_documento: str
    validade_documento: str
    nif: str
    carta_conducao_numero: str
    carta_conducao_validade: str
    licenca_tvde_numero: str
    licenca_tvde_validade: str
    codigo_registo_criminal: Optional[str] = None
    parceiro_atribuido: Optional[str] = None
    veiculo_atribuido: Optional[str] = None
    tipo_motorista: Optional[str] = "independente"
    regime: str
    iban: Optional[str] = None
    email_uber: Optional[str] = None
    telefone_uber: Optional[str] = None
    uuid_motorista_uber: Optional[str] = None
    email_bolt: Optional[str] = None
    telefone_bolt: Optional[str] = None
    identificador_motorista_bolt: Optional[str] = None
    whatsapp: str
    tipo_pagamento: str
    senha_provisoria: bool = False


class Motorista(BaseModel):
    """Complete motorista model with all fields"""
    model_config = ConfigDict(extra="ignore")
    
    # Basic Info
    id: str
    email: str
    name: str
    phone: str
    morada_completa: Optional[str] = None
    codigo_postal: Optional[str] = None
    localidade: Optional[str] = None
    data_nascimento: Optional[str] = None
    nacionalidade: Optional[str] = None
    
    # Documents
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    validade_documento: Optional[str] = None
    numero_documento_identificacao: Optional[str] = None
    validade_documento_identificacao: Optional[str] = None
    numero_cc: Optional[str] = None
    validade_cc: Optional[str] = None
    numero_passaporte: Optional[str] = None
    validade_passaporte: Optional[str] = None
    
    # Tax & Social
    nif: Optional[str] = None
    numero_seguranca_social: Optional[str] = None
    numero_cartao_utente: Optional[str] = None
    
    # Driving License
    carta_conducao_numero: Optional[str] = None
    numero_carta_conducao: Optional[str] = None
    carta_conducao_validade: Optional[str] = None
    validade_carta_conducao: Optional[str] = None
    categoria_carta_conducao: Optional[str] = None
    emissao_carta: Optional[str] = None
    data_emissao_carta: Optional[str] = None
    
    # TVDE License
    licenca_tvde_numero: Optional[str] = None
    numero_licenca_tvde: Optional[str] = None
    licenca_tvde_validade: Optional[str] = None
    validade_licenca_tvde: Optional[str] = None
    
    # Criminal Record
    codigo_registo_criminal: Optional[str] = None
    validade_registo_criminal: Optional[str] = None
    data_limite_registo_criminal: Optional[str] = None
    dias_aviso_renovacao_registo: int = 30
    
    # Assignment
    parceiro_atribuido: Optional[str] = None
    veiculo_atribuido: Optional[str] = None
    status_motorista: Optional[str] = "pendente_documentos"
    tipo_motorista: Optional[str] = None
    regime: Optional[str] = None
    
    # Banking
    iban: Optional[str] = None
    nome_banco: Optional[str] = None
    
    # Platform Integration
    email_uber: Optional[str] = None
    telefone_uber: Optional[str] = None
    uuid_motorista_uber: Optional[str] = None
    email_bolt: Optional[str] = None
    telefone_bolt: Optional[str] = None
    identificador_motorista_bolt: Optional[str] = None
    whatsapp: Optional[str] = None
    
    # Payment
    tipo_pagamento: Optional[str] = None
    tipo_pagamento_outro: Optional[str] = None
    id_cartao_frota_combustivel: Optional[str] = None
    
    # Emergency Contact
    emergencia_nome: Optional[str] = None
    emergencia_telefone: Optional[str] = None
    emergencia_email: Optional[str] = None
    emergencia_morada: Optional[str] = None
    emergencia_codigo_postal: Optional[str] = None
    emergencia_localidade: Optional[str] = None
    emergencia_ligacao: Optional[str] = None
    
    # Insurance
    seguro_numero_apolice: Optional[str] = None
    seguro_seguradora: Optional[str] = None
    seguro_validade: Optional[str] = None
    
    # Documents & Validation
    documents: Optional[MotoristaDocuments] = None
    documents_validacao: Dict[str, DocumentoValidacao] = {}
    documentos_aprovados: bool = False
    observacoes_internas: Optional[str] = None
    
    # Plan Assignment (Unified Plan System)
    plano_id: Optional[str] = None
    plano_nome: Optional[str] = None
    plano_valida_ate: Optional[str] = None
    
    # System
    approved: bool = False
    senha_provisoria: bool = False
    campos_customizados: Dict[str, Any] = {}
    created_at: datetime
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
