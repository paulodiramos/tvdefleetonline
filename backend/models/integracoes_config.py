"""
Modelos para configurações de integrações externas
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class IntegracaoStatus(str, Enum):
    """Status da integração"""
    ATIVA = "ativa"
    INATIVA = "inativa"
    ERRO = "erro"
    PENDENTE = "pendente"


class IfthenpayConfig(BaseModel):
    """Configuração da integração Ifthenpay"""
    # Chaves principais
    backoffice_key: Optional[str] = None  # Formato: 1111-2222-3333-4444
    gateway_key: Optional[str] = None     # Formato: AAAA-999999
    anti_phishing_key: Optional[str] = None  # Mínimo 50 caracteres
    
    # Chaves por método de pagamento
    mbway_key: Optional[str] = None
    multibanco_key: Optional[str] = None
    multibanco_entidade: Optional[str] = None
    multibanco_subentidade: Optional[str] = None
    cartao_key: Optional[str] = None
    payshop_key: Optional[str] = None
    
    # Configurações
    sandbox_mode: bool = True
    webhook_url: Optional[str] = None
    
    # Status
    status: IntegracaoStatus = IntegracaoStatus.INATIVA
    ultima_verificacao: Optional[datetime] = None
    erro_mensagem: Optional[str] = None


class MoloniConfig(BaseModel):
    """Configuração da integração Moloni"""
    # Credenciais OAuth2
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    
    # Identificação da empresa
    company_id: Optional[str] = None
    
    # Tokens (gerados automaticamente)
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    
    # Configurações
    sandbox_mode: bool = True
    
    # Status
    status: IntegracaoStatus = IntegracaoStatus.INATIVA
    ultima_verificacao: Optional[datetime] = None
    erro_mensagem: Optional[str] = None


class ConfiguracoesIntegracoes(BaseModel):
    """Documento completo de configurações de integrações"""
    id: str = "config_integracoes"
    ifthenpay: IfthenpayConfig = Field(default_factory=IfthenpayConfig)
    moloni: MoloniConfig = Field(default_factory=MoloniConfig)
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


# Requests
class IfthenpayConfigRequest(BaseModel):
    """Request para atualizar configuração Ifthenpay"""
    backoffice_key: Optional[str] = None
    gateway_key: Optional[str] = None
    anti_phishing_key: Optional[str] = None
    mbway_key: Optional[str] = None
    multibanco_key: Optional[str] = None
    multibanco_entidade: Optional[str] = None
    multibanco_subentidade: Optional[str] = None
    cartao_key: Optional[str] = None
    payshop_key: Optional[str] = None
    sandbox_mode: bool = True


class MoloniConfigRequest(BaseModel):
    """Request para atualizar configuração Moloni"""
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    company_id: Optional[str] = None
    sandbox_mode: bool = True
