"""
Models for RPA Automation System
- Fornecedores (providers for GPS, Fuel, etc.)
- Automação Scripts (automation workflows)
- Credenciais dos Parceiros (encrypted credentials)
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class TipoFornecedor(str, Enum):
    """Tipos de fornecedores suportados"""
    UBER = "uber"
    BOLT = "bolt"
    VIA_VERDE = "via_verde"
    GPS = "gps"
    COMBUSTIVEL = "combustivel"
    CARREGAMENTO_ELETRICO = "carregamento_eletrico"
    OUTRO = "outro"


class TipoAcao(str, Enum):
    """Tipos de ações na automação"""
    NAVEGAR = "navegar"  # Ir para URL
    CLICAR = "clicar"  # Clicar em elemento
    PREENCHER = "preencher"  # Preencher campo
    SELECIONAR = "selecionar"  # Selecionar dropdown
    ESPERAR = "esperar"  # Esperar elemento/tempo
    DOWNLOAD = "download"  # Fazer download
    SCREENSHOT = "screenshot"  # Tirar screenshot
    EXTRAIR_TEXTO = "extrair_texto"  # Extrair texto de elemento
    EXTRAIR_TABELA = "extrair_tabela"  # Extrair tabela
    CONDICAO = "condicao"  # If/else
    LOOP = "loop"  # Repetir ações
    CODIGO_2FA = "codigo_2fa"  # Inserir código 2FA
    ESPERAR_EMAIL = "esperar_email"  # Esperar email com código


class Fornecedor(BaseModel):
    """Modelo de Fornecedor (GPS, Combustível, etc.)"""
    id: Optional[str] = None
    nome: str  # Ex: "Frotcom", "Galp", "Prio"
    tipo: TipoFornecedor
    url_login: str  # URL da página de login
    url_base: Optional[str] = None
    logo_url: Optional[str] = None
    descricao: Optional[str] = None
    
    # Configurações de login
    campo_email_seletor: str = 'input[type="email"]'
    campo_password_seletor: str = 'input[type="password"]'
    botao_login_seletor: str = 'button[type="submit"]'
    
    # Configurações específicas
    requer_2fa: bool = False
    tipo_2fa: Optional[str] = None  # "email", "sms", "app"
    
    # Automação associada
    automacao_id: Optional[str] = None
    
    # Metadata
    ativo: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None


class FornecedorCreate(BaseModel):
    """Modelo para criar fornecedor"""
    nome: str
    tipo: TipoFornecedor
    url_login: str
    url_base: Optional[str] = None
    descricao: Optional[str] = None
    campo_email_seletor: str = 'input[type="email"]'
    campo_password_seletor: str = 'input[type="password"]'
    botao_login_seletor: str = 'button[type="submit"]'
    requer_2fa: bool = False
    tipo_2fa: Optional[str] = None


class PassoAutomacao(BaseModel):
    """Um passo individual na automação"""
    id: Optional[str] = None
    ordem: int
    tipo: TipoAcao
    nome: str  # Nome descritivo do passo
    
    # Configurações do passo
    seletor: Optional[str] = None  # CSS selector ou XPath
    valor: Optional[str] = None  # Valor a preencher/URL a navegar
    variavel: Optional[str] = None  # Nome da variável (ex: {{email}}, {{password}})
    timeout: int = 30000  # Timeout em ms
    
    # Para condições
    condicao: Optional[str] = None
    passos_se_verdadeiro: Optional[List["PassoAutomacao"]] = None
    passos_se_falso: Optional[List["PassoAutomacao"]] = None
    
    # Para extrações
    nome_ficheiro: Optional[str] = None
    formato_saida: Optional[str] = None  # csv, xlsx, json
    
    # Opções
    opcional: bool = False  # Se falhar, continuar
    screenshot_antes: bool = False
    screenshot_depois: bool = False


class Automacao(BaseModel):
    """Modelo de Automação/Script RPA"""
    id: Optional[str] = None
    nome: str  # Ex: "Download Uber Pagamentos"
    descricao: Optional[str] = None
    fornecedor_id: str
    tipo_fornecedor: TipoFornecedor
    
    # Configuração
    versao: str = "1.0"
    passos: List[PassoAutomacao] = []
    
    # Variáveis disponíveis
    variaveis: List[str] = ["email", "password", "codigo_2fa", "data_inicio", "data_fim"]
    
    # Resultado esperado
    tipo_resultado: str = "csv"  # csv, xlsx, json, pdf
    colunas_esperadas: List[str] = []
    
    # Metadata
    ativo: bool = True
    testada: bool = False
    ultima_execucao: Optional[datetime] = None
    taxa_sucesso: float = 0.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None


class AutomacaoCreate(BaseModel):
    """Modelo para criar automação"""
    nome: str
    descricao: Optional[str] = None
    fornecedor_id: str
    tipo_fornecedor: TipoFornecedor
    passos: List[Dict[str, Any]] = []
    variaveis: List[str] = ["email", "password"]
    tipo_resultado: str = "csv"


class CredenciaisParceiro(BaseModel):
    """Credenciais do parceiro para uma plataforma"""
    id: Optional[str] = None
    parceiro_id: str
    fornecedor_id: str
    
    # Credenciais (encriptadas no BD)
    email: str
    password_encrypted: str  # Encriptado
    codigo_2fa_secret: Optional[str] = None  # Para TOTP
    
    # Dados adicionais
    dados_extra: Dict[str, str] = {}  # Outros campos necessários
    
    # Status
    ativo: bool = True
    ultima_validacao: Optional[datetime] = None
    validacao_sucesso: bool = False
    
    # Metadata
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CredenciaisParceiroCreate(BaseModel):
    """Modelo para criar credenciais"""
    parceiro_id: str
    fornecedor_id: str
    email: str
    password: Optional[str] = None  # Optional for updates - will be encrypted
    codigo_2fa_secret: Optional[str] = None
    dados_extra: Dict[str, str] = {}


class ExecucaoAutomacao(BaseModel):
    """Registo de execução de automação"""
    id: Optional[str] = None
    automacao_id: str
    parceiro_id: str
    fornecedor_id: str
    
    # Período de dados
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    
    # Status
    status: str = "pendente"  # pendente, em_execucao, sucesso, erro, cancelado
    progresso: int = 0  # 0-100
    passo_atual: Optional[str] = None
    
    # Resultados
    ficheiro_resultado: Optional[str] = None
    registos_extraidos: int = 0
    erro_mensagem: Optional[str] = None
    screenshots: List[str] = []
    logs: List[Dict[str, Any]] = []
    
    # Timing
    iniciado_em: Optional[datetime] = None
    terminado_em: Optional[datetime] = None
    duracao_segundos: Optional[int] = None
    
    # Metadata
    criado_por: Optional[str] = None
    created_at: Optional[datetime] = None


# Default automations for common platforms
DEFAULT_UBER_AUTOMATION = {
    "nome": "Download Pagamentos Uber",
    "tipo_fornecedor": "uber",
    "descricao": "Automação para download de relatórios de pagamentos da Uber",
    "passos": [
        {"ordem": 1, "tipo": "navegar", "nome": "Ir para login Uber", "valor": "https://auth.uber.com/login/"},
        {"ordem": 2, "tipo": "preencher", "nome": "Inserir email", "seletor": "#email", "variavel": "{{email}}"},
        {"ordem": 3, "tipo": "clicar", "nome": "Continuar", "seletor": "#next-button"},
        {"ordem": 4, "tipo": "esperar", "nome": "Esperar campo password", "seletor": "#password", "timeout": 10000},
        {"ordem": 5, "tipo": "preencher", "nome": "Inserir password", "seletor": "#password", "variavel": "{{password}}"},
        {"ordem": 6, "tipo": "clicar", "nome": "Login", "seletor": "#next-button"},
        {"ordem": 7, "tipo": "esperar", "nome": "Esperar dashboard", "timeout": 15000},
        {"ordem": 8, "tipo": "navegar", "nome": "Ir para pagamentos", "valor": "https://drivers.uber.com/p3/payments/statements"},
        {"ordem": 9, "tipo": "esperar", "nome": "Esperar tabela", "seletor": "table", "timeout": 10000},
        {"ordem": 10, "tipo": "clicar", "nome": "Selecionar período", "seletor": "[data-testid='date-picker']"},
        {"ordem": 11, "tipo": "clicar", "nome": "Download CSV", "seletor": "[data-testid='download-csv']"},
        {"ordem": 12, "tipo": "download", "nome": "Guardar ficheiro", "nome_ficheiro": "uber_pagamentos_{{data}}.csv"}
    ],
    "variaveis": ["email", "password", "data_inicio", "data_fim"],
    "tipo_resultado": "csv"
}

DEFAULT_BOLT_AUTOMATION = {
    "nome": "Download Ganhos Bolt",
    "tipo_fornecedor": "bolt",
    "descricao": "Automação para download de relatórios de ganhos da Bolt",
    "passos": [
        {"ordem": 1, "tipo": "navegar", "nome": "Ir para login Bolt", "valor": "https://fleets.bolt.eu/login"},
        {"ordem": 2, "tipo": "preencher", "nome": "Inserir email", "seletor": "input[name='email']", "variavel": "{{email}}"},
        {"ordem": 3, "tipo": "preencher", "nome": "Inserir password", "seletor": "input[name='password']", "variavel": "{{password}}"},
        {"ordem": 4, "tipo": "clicar", "nome": "Login", "seletor": "button[type='submit']"},
        {"ordem": 5, "tipo": "esperar", "nome": "Esperar dashboard", "timeout": 10000},
        {"ordem": 6, "tipo": "navegar", "nome": "Ir para relatórios", "valor": "https://fleets.bolt.eu/reports"},
        {"ordem": 7, "tipo": "clicar", "nome": "Exportar", "seletor": "[data-testid='export-button']"},
        {"ordem": 8, "tipo": "download", "nome": "Guardar ficheiro", "nome_ficheiro": "bolt_ganhos_{{data}}.csv"}
    ],
    "variaveis": ["email", "password", "data_inicio", "data_fim"],
    "tipo_resultado": "csv"
}

DEFAULT_VIAVERDE_AUTOMATION = {
    "nome": "Download Portagens Via Verde",
    "tipo_fornecedor": "via_verde",
    "descricao": "Automação para download de extratos Via Verde Empresas",
    "passos": [
        {"ordem": 1, "tipo": "navegar", "nome": "Ir para login Via Verde", "valor": "https://www.viaverde.pt/empresas/login"},
        {"ordem": 2, "tipo": "preencher", "nome": "Inserir NIF", "seletor": "#nif", "variavel": "{{nif}}"},
        {"ordem": 3, "tipo": "preencher", "nome": "Inserir password", "seletor": "#password", "variavel": "{{password}}"},
        {"ordem": 4, "tipo": "clicar", "nome": "Login", "seletor": "#login-button"},
        {"ordem": 5, "tipo": "esperar", "nome": "Esperar área cliente", "timeout": 10000},
        {"ordem": 6, "tipo": "navegar", "nome": "Ir para movimentos", "valor": "https://www.viaverde.pt/empresas/movimentos"},
        {"ordem": 7, "tipo": "clicar", "nome": "Exportar CSV", "seletor": ".export-csv"},
        {"ordem": 8, "tipo": "download", "nome": "Guardar ficheiro", "nome_ficheiro": "viaverde_{{data}}.csv"}
    ],
    "variaveis": ["nif", "password", "data_inicio", "data_fim"],
    "tipo_resultado": "csv"
}
