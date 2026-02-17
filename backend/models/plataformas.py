"""
Modelos para o Sistema de Plataformas e Sincronização
- Categorias: plataforma (TVDE), gps, portagens, abastecimento
- Métodos: RPA, API, Upload Manual
- Configuração de Admin + Credenciais de Parceiro
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid


class CategoriaPlataforma(str, Enum):
    """Categorias de plataformas disponíveis"""
    PLATAFORMA = "plataforma"      # Uber, Bolt, etc.
    GPS = "gps"                    # Verizon, Cartrack, Radius
    PORTAGENS = "portagens"        # Via Verde
    ABASTECIMENTO = "abastecimento"  # Prio, Galp, Radius


class MetodoIntegracao(str, Enum):
    """Método de integração com a plataforma"""
    RPA = "rpa"                    # Automação com Playwright
    API = "api"                    # API disponível
    UPLOAD_MANUAL = "upload_manual"  # Upload de ficheiro Excel/CSV


class TipoLogin(str, Enum):
    """Tipo de login necessário"""
    MANUAL = "manual"              # Parceiro faz login manualmente
    AUTOMATICO = "automatico"      # Sistema faz login com credenciais


class SubcategoriaAbastecimento(str, Enum):
    """Subcategoria para abastecimento"""
    FOSSIL = "fossil"
    ELETRICO = "eletrico"
    AMBOS = "ambos"


class TipoPasso(str, Enum):
    """Tipos de passos para automação RPA"""
    GOTO = "goto"
    CLICK = "click"
    TYPE = "type"
    FILL_CREDENTIAL = "fill_credential"
    SELECT = "select"
    WAIT = "wait"
    WAIT_SELECTOR = "wait_selector"
    PRESS = "press"
    SCROLL = "scroll"
    DOWNLOAD = "download"
    SCREENSHOT = "screenshot"


class PassoRPA(BaseModel):
    """Um passo individual no design RPA"""
    ordem: int
    tipo: TipoPasso
    descricao: Optional[str] = None
    seletor: Optional[str] = None
    seletor_tipo: str = "css"  # css, xpath, text, role
    valor: Optional[str] = None
    campo_credencial: Optional[str] = None  # email, password, etc.
    timeout: int = 5000
    tecla: Optional[str] = None
    screenshot_antes: Optional[str] = None
    screenshot_depois: Optional[str] = None


class MapeamentoCampo(BaseModel):
    """Mapeamento de campo do ficheiro para campo do sistema"""
    campo_sistema: str           # Campo interno: matricula, data, valor, etc.
    coluna_ficheiro: str         # Nome ou índice da coluna no ficheiro
    tipo_dados: str = "texto"    # texto, numero, data, moeda
    formato_data: Optional[str] = None  # Ex: "%d/%m/%Y"
    obrigatorio: bool = False


class ConfiguracaoImportacao(BaseModel):
    """Configuração de importação de ficheiros"""
    tipo_ficheiro: str = "xlsx"  # xlsx, csv, xls
    linha_cabecalho: int = 1
    linha_inicio_dados: int = 2
    encoding: str = "utf-8"
    separador_csv: str = ";"
    mapeamento_campos: List[MapeamentoCampo] = []


class Plataforma(BaseModel):
    """Modelo completo de uma plataforma/fornecedor"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Identificação
    nome: str
    icone: str = "🔗"
    descricao: Optional[str] = None
    categoria: CategoriaPlataforma
    subcategoria_abastecimento: Optional[SubcategoriaAbastecimento] = None
    
    # URLs
    url_base: Optional[str] = None
    url_login: Optional[str] = None
    
    # Método de integração
    metodo_integracao: MetodoIntegracao = MetodoIntegracao.UPLOAD_MANUAL
    tipo_login: TipoLogin = TipoLogin.AUTOMATICO
    
    # Configuração de autenticação
    requer_2fa: bool = False
    tipo_2fa: Optional[str] = None  # sms, email, app
    campos_credenciais: List[str] = ["email", "password"]
    
    # Configuração RPA (se metodo = RPA)
    passos_login: List[PassoRPA] = []
    passos_extracao: List[PassoRPA] = []
    
    # Configuração de importação
    config_importacao: Optional[ConfiguracaoImportacao] = None
    
    # Estado
    ativo: bool = True
    testado: bool = False
    
    # Metadados
    criado_por: Optional[str] = None
    criado_em: Optional[str] = None
    atualizado_em: Optional[str] = None
    
    # Estatísticas
    total_sincronizacoes: int = 0
    ultima_sincronizacao: Optional[str] = None


class CredenciaisParceiroPlataforma(BaseModel):
    """Credenciais de um parceiro para uma plataforma específica"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parceiro_id: str
    plataforma_id: str
    
    # Credenciais (encriptadas na BD)
    email: Optional[str] = None
    password_encrypted: Optional[str] = None
    dados_extra: Dict[str, str] = {}  # Outros campos: telefone, cartao_frota, etc.
    
    # Estado
    ativo: bool = True
    sessao_ativa: bool = False
    ultima_sessao: Optional[str] = None
    
    # Sincronização
    sincronizacao_automatica: bool = False
    frequencia_dias: int = 7
    proxima_sincronizacao: Optional[str] = None
    
    # Metadados
    criado_em: Optional[str] = None
    atualizado_em: Optional[str] = None


class LogSincronizacao(BaseModel):
    """Log de uma sincronização executada"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parceiro_id: str
    plataforma_id: str
    
    # Resultado
    status: str = "pendente"  # pendente, em_progresso, sucesso, erro
    erro: Optional[str] = None
    
    # Dados
    tipo_dados: Optional[str] = None  # fossil, eletrico, ganhos, gps, portagens
    registos_importados: int = 0
    ficheiro_origem: Optional[str] = None
    
    # Timing
    iniciado_em: Optional[str] = None
    terminado_em: Optional[str] = None
    duracao_segundos: Optional[float] = None
    
    # Debug
    screenshots: List[str] = []
    logs: List[str] = []


# ============ Request Models ============

class CriarPlataformaRequest(BaseModel):
    nome: str
    categoria: CategoriaPlataforma
    subcategoria_abastecimento: Optional[SubcategoriaAbastecimento] = None
    icone: str = "🔗"
    descricao: Optional[str] = None
    url_base: Optional[str] = None
    url_login: Optional[str] = None
    metodo_integracao: MetodoIntegracao = MetodoIntegracao.UPLOAD_MANUAL
    tipo_login: TipoLogin = TipoLogin.AUTOMATICO
    requer_2fa: bool = False
    tipo_2fa: Optional[str] = None
    campos_credenciais: List[str] = ["email", "password"]


class AtualizarPlataformaRequest(BaseModel):
    nome: Optional[str] = None
    icone: Optional[str] = None
    descricao: Optional[str] = None
    subcategoria_abastecimento: Optional[SubcategoriaAbastecimento] = None
    url_base: Optional[str] = None
    url_login: Optional[str] = None
    metodo_integracao: Optional[MetodoIntegracao] = None
    tipo_login: Optional[TipoLogin] = None
    requer_2fa: Optional[bool] = None
    tipo_2fa: Optional[str] = None
    campos_credenciais: Optional[List[str]] = None
    ativo: Optional[bool] = None


class ConfigurarRPARequest(BaseModel):
    passos_login: Optional[List[Dict[str, Any]]] = None
    passos_extracao: Optional[List[Dict[str, Any]]] = None


class ConfigurarImportacaoRequest(BaseModel):
    tipo_ficheiro: str = "xlsx"
    linha_cabecalho: int = 1
    linha_inicio_dados: int = 2
    encoding: str = "utf-8"
    separador_csv: str = ";"
    mapeamento_campos: List[Dict[str, Any]] = []


class CredenciaisParceiroRequest(BaseModel):
    plataforma_id: str
    email: Optional[str] = None
    password: Optional[str] = None
    dados_extra: Dict[str, str] = {}
    ativo: bool = True
    sincronizacao_automatica: bool = False
    frequencia_dias: int = 7


# ============ Campos de destino por categoria ============

CAMPOS_DESTINO = {
    "plataforma": [
        {"campo": "motorista_nome", "label": "Nome Motorista", "tipo": "texto"},
        {"campo": "motorista_email", "label": "Email Motorista", "tipo": "texto"},
        {"campo": "data", "label": "Data", "tipo": "data"},
        {"campo": "valor_bruto", "label": "Valor Bruto", "tipo": "moeda"},
        {"campo": "valor_liquido", "label": "Valor Líquido", "tipo": "moeda"},
        {"campo": "comissao", "label": "Comissão Plataforma", "tipo": "moeda"},
        {"campo": "gorjetas", "label": "Gorjetas", "tipo": "moeda"},
        {"campo": "viagens", "label": "Nº Viagens", "tipo": "numero"},
        {"campo": "horas_online", "label": "Horas Online", "tipo": "numero"},
        {"campo": "km_total", "label": "Km Total", "tipo": "numero"},
    ],
    "gps": [
        {"campo": "matricula", "label": "Matrícula", "tipo": "texto"},
        {"campo": "motorista_nome", "label": "Nome Motorista", "tipo": "texto"},
        {"campo": "data", "label": "Data", "tipo": "data"},
        {"campo": "km_total", "label": "Km Total", "tipo": "numero"},
        {"campo": "km_privado", "label": "Km Privado", "tipo": "numero"},
        {"campo": "km_servico", "label": "Km Serviço", "tipo": "numero"},
        {"campo": "tempo_conducao", "label": "Tempo Condução", "tipo": "texto"},
        {"campo": "velocidade_media", "label": "Velocidade Média", "tipo": "numero"},
    ],
    "portagens": [
        {"campo": "matricula", "label": "Matrícula", "tipo": "texto"},
        {"campo": "data", "label": "Data", "tipo": "data"},
        {"campo": "hora", "label": "Hora", "tipo": "texto"},
        {"campo": "local_entrada", "label": "Local Entrada", "tipo": "texto"},
        {"campo": "local_saida", "label": "Local Saída", "tipo": "texto"},
        {"campo": "valor", "label": "Valor", "tipo": "moeda"},
        {"campo": "via", "label": "Via", "tipo": "texto"},
    ],
    "abastecimento": [
        {"campo": "matricula", "label": "Matrícula", "tipo": "texto"},
        {"campo": "motorista_nome", "label": "Nome Motorista", "tipo": "texto"},
        {"campo": "data", "label": "Data", "tipo": "data"},
        {"campo": "hora", "label": "Hora", "tipo": "texto"},
        {"campo": "local", "label": "Local/Posto", "tipo": "texto"},
        {"campo": "tipo_combustivel", "label": "Tipo Combustível", "tipo": "texto"},
        {"campo": "litros", "label": "Litros", "tipo": "numero"},
        {"campo": "valor", "label": "Valor", "tipo": "moeda"},
        {"campo": "preco_litro", "label": "Preço/Litro", "tipo": "moeda"},
        {"campo": "km_veiculo", "label": "Km Veículo", "tipo": "numero"},
        {"campo": "kwh", "label": "kWh (Elétrico)", "tipo": "numero"},
    ],
}


# Plataformas pré-definidas
PLATAFORMAS_DEFAULT = [
    # Plataformas TVDE
    {
        "nome": "Uber",
        "icone": "🚗",
        "categoria": "plataforma",
        "descricao": "Plataforma Uber",
        "url_login": "https://drivers.uber.com",
        "metodo_integracao": "rpa",
        "tipo_login": "manual",
        "requer_2fa": True,
        "tipo_2fa": "sms",
        "campos_credenciais": ["email", "password", "telefone"]
    },
    {
        "nome": "Bolt",
        "icone": "⚡",
        "categoria": "plataforma",
        "descricao": "Plataforma Bolt",
        "url_login": "https://partners.bolt.eu",
        "metodo_integracao": "rpa",
        "tipo_login": "automatico",
        "campos_credenciais": ["email", "password"]
    },
    # GPS
    {
        "nome": "Verizon",
        "icone": "📍",
        "categoria": "gps",
        "descricao": "GPS Verizon Connect",
        "metodo_integracao": "api",
        "tipo_login": "automatico",
        "campos_credenciais": ["api_key", "account_id"]
    },
    {
        "nome": "Cartrack",
        "icone": "📍",
        "categoria": "gps",
        "descricao": "GPS Cartrack",
        "metodo_integracao": "rpa",
        "tipo_login": "automatico",
        "campos_credenciais": ["email", "password"]
    },
    {
        "nome": "Radius",
        "icone": "📍",
        "categoria": "gps",
        "descricao": "GPS Radius",
        "metodo_integracao": "rpa",
        "tipo_login": "automatico",
        "campos_credenciais": ["email", "password"]
    },
    # Portagens
    {
        "nome": "Via Verde",
        "icone": "🛣️",
        "categoria": "portagens",
        "descricao": "Via Verde Portugal",
        "url_login": "https://www.viaverde.pt",
        "metodo_integracao": "rpa",
        "tipo_login": "automatico",
        "campos_credenciais": ["email", "password"]
    },
    # Abastecimento
    {
        "nome": "Prio",
        "icone": "⛽",
        "categoria": "abastecimento",
        "subcategoria_abastecimento": "ambos",
        "descricao": "Rede Prio - Combustível e Elétrico",
        "url_login": "https://www.pfrota.pt",
        "metodo_integracao": "rpa",
        "tipo_login": "manual",
        "requer_2fa": True,
        "tipo_2fa": "sms",
        "campos_credenciais": ["email", "password", "telefone"]
    },
    {
        "nome": "Galp",
        "icone": "⛽",
        "categoria": "abastecimento",
        "subcategoria_abastecimento": "ambos",
        "descricao": "Rede Galp",
        "metodo_integracao": "upload_manual",
        "tipo_login": "automatico",
        "campos_credenciais": ["cartao_frota"]
    },
    {
        "nome": "Radius Fuel",
        "icone": "⛽",
        "categoria": "abastecimento",
        "subcategoria_abastecimento": "fossil",
        "descricao": "Radius Fuel Card",
        "metodo_integracao": "rpa",
        "tipo_login": "automatico",
        "campos_credenciais": ["email", "password"]
    },
]
