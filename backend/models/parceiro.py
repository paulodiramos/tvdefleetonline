"""Parceiro models for FleeTrack application"""

from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime


class ConfiguracaoEmailSMTP(BaseModel):
    """Configuração de email SMTP do parceiro"""
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_usuario: Optional[str] = None
    smtp_password: Optional[str] = None
    email_remetente: Optional[str] = None
    nome_remetente: Optional[str] = None
    usar_tls: bool = True
    ativo: bool = False


class ConfiguracaoWhatsApp(BaseModel):
    """Configuração de WhatsApp do parceiro"""
    telefone: Optional[str] = None  # Número com código país (+351...)
    nome_exibicao: Optional[str] = None  # Nome que aparece nas mensagens
    mensagem_boas_vindas: Optional[str] = None
    mensagem_relatorio: Optional[str] = None  # Template para relatórios
    ativo: bool = False
    # Opções de envio
    enviar_relatorios_semanais: bool = True
    enviar_alertas_documentos: bool = True
    enviar_alertas_veiculos: bool = True


class CredenciaisPlataforma(BaseModel):
    """Credenciais de acesso às plataformas"""
    # Uber
    uber_email: Optional[str] = None
    uber_telefone: Optional[str] = None
    uber_password: Optional[str] = None
    # Bolt
    bolt_email: Optional[str] = None
    bolt_password: Optional[str] = None
    # Via Verde
    viaverde_usuario: Optional[str] = None
    viaverde_password: Optional[str] = None


class ParceiroCreate(BaseModel):
    """Model for creating a new parceiro"""
    nome_empresa: str
    contribuinte_empresa: str  # NIF da empresa (9 dígitos)
    morada_completa: str
    codigo_postal: str  # Formato: xxxx-xxx
    localidade: str
    nome_manager: str
    email_manager: EmailStr
    email_empresa: EmailStr
    telefone: str
    telemovel: str
    email: EmailStr  # Mantido para compatibilidade
    certidao_permanente: str  # Formato: xxxx-xxxx-xxxx (só dígitos)
    codigo_certidao_comercial: str
    validade_certidao_comercial: str  # Data validade
    seguro_responsabilidade_civil: Optional[str] = None
    seguro_acidentes_trabalho: Optional[str] = None
    licenca_tvde: Optional[str] = None
    plano_id: Optional[str] = None  # ID do plano de assinatura
    gestor_associado_id: Optional[str] = None


class Parceiro(BaseModel):
    """Complete parceiro model"""
    model_config = ConfigDict(extra="ignore")
    id: str
    # Campos flexíveis - suporta ambas as estruturas (antiga e nova)
    nome_empresa: Optional[str] = None
    nome: Optional[str] = None  # Estrutura nova
    contribuinte_empresa: Optional[str] = None
    nif: Optional[str] = None  # Estrutura nova
    morada_completa: Optional[str] = None
    morada: Optional[str] = None  # Estrutura nova
    codigo_postal: str
    localidade: Optional[str] = None
    nome_manager: Optional[str] = None
    responsavel_nome: Optional[str] = None  # Estrutura nova
    email_manager: Optional[str] = None
    email_empresa: Optional[str] = None
    telefone: Optional[str] = None
    telemovel: Optional[str] = None
    responsavel_contacto: Optional[str] = None  # Estrutura nova
    email: str
    certidao_permanente: Optional[str] = None
    codigo_certidao_comercial: Optional[str] = None
    validade_certidao_comercial: Optional[str] = None
    seguro_responsabilidade_civil: Optional[str] = None
    seguro_acidentes_trabalho: Optional[str] = None
    licenca_tvde: Optional[str] = None
    plano_id: Optional[str] = None
    plano_nome: Optional[str] = None
    plano_valida_ate: Optional[str] = None
    plano_status: str = "pendente"  # "pendente", "ativo", "suspenso"
    gestor_associado_id: Optional[str] = None
    total_vehicles: int = 0
    approved: Optional[bool] = None
    status: Optional[str] = None
    # Contrato único do parceiro com múltiplos tipos
    contrato_texto: Optional[str] = None  # Texto base do contrato
    contratos_tipos: List[Dict[str, Any]] = []  # Lista de tipos de contrato disponíveis
    representante_legal_nome: Optional[str] = None
    representante_legal_contribuinte: Optional[str] = None
    representante_legal_cc: Optional[str] = None
    representante_legal_cc_validade: Optional[str] = None
    representante_legal_telefone: Optional[str] = None
    representante_legal_email: Optional[str] = None
    campos_customizados: Dict[str, Any] = {}
    # Configurações de Alertas
    dias_aviso_seguro: int = 30
    dias_aviso_inspecao: int = 30
    km_aviso_revisao: int = 5000
    # Configuração de Email SMTP
    config_email: Optional[ConfiguracaoEmailSMTP] = None
    # Configuração de WhatsApp
    config_whatsapp: Optional[ConfiguracaoWhatsApp] = None
    # Credenciais de Plataformas
    credenciais_plataformas: Optional[CredenciaisPlataforma] = None
    created_at: datetime
    # Campos antigos mantidos como opcionais para compatibilidade
    name: Optional[str] = None
    phone: Optional[str] = None
    empresa: Optional[str] = None


class AdminSettings(BaseModel):
    """Admin settings model"""
    model_config = ConfigDict(extra="ignore")
    id: str = "admin_settings"
    anos_validade_matricula: int = 20
    km_aviso_manutencao: int = 5000
    updated_at: datetime
    updated_by: str
