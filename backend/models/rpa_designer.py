"""
Modelos para o RPA Designer Visual
- Plataformas RPA (Uber, Via Verde, etc.)
- Designs de automação (passos gravados)
- Agendamentos de parceiros
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class TipoPasso(str, Enum):
    """Tipos de passos suportados no RPA Designer"""
    GOTO = "goto"           # Navegar para URL
    CLICK = "click"         # Clicar em elemento
    TYPE = "type"           # Escrever texto
    SELECT = "select"       # Selecionar opção
    WAIT = "wait"           # Esperar X ms
    WAIT_SELECTOR = "wait_selector"  # Esperar elemento aparecer
    DOWNLOAD = "download"   # Aguardar download
    SCREENSHOT = "screenshot"  # Tirar screenshot
    SCROLL = "scroll"       # Scroll na página
    HOVER = "hover"         # Hover sobre elemento
    PRESS = "press"         # Pressionar tecla
    VARIABLE = "variable"   # Usar variável dinâmica
    FILL_CREDENTIAL = "fill_credential"  # Preencher com credencial do parceiro


class PassoRPA(BaseModel):
    """Um passo individual no design RPA"""
    ordem: int
    tipo: TipoPasso
    descricao: Optional[str] = None
    
    # Para clicks, types, selects
    seletor: Optional[str] = None
    seletor_tipo: Optional[str] = "css"  # css, xpath, text, role
    
    # Para type/fill
    valor: Optional[str] = None
    
    # Para variáveis
    nome_variavel: Optional[str] = None  # ex: SEMANA_INICIO
    
    # Para credenciais
    campo_credencial: Optional[str] = None  # ex: email, password
    
    # Para wait
    timeout: Optional[int] = 5000  # ms
    
    # Para scroll
    direcao: Optional[str] = "down"  # up, down, left, right
    pixels: Optional[int] = 300
    
    # Para press
    tecla: Optional[str] = None  # Enter, Tab, etc.
    
    # Metadados de gravação
    screenshot_antes: Optional[str] = None
    screenshot_depois: Optional[str] = None
    coordenadas: Optional[Dict[str, int]] = None  # {x, y} do click


class PlataformaRPA(BaseModel):
    """Uma plataforma de extração de dados"""
    id: Optional[str] = None
    nome: str
    url_base: str
    icone: Optional[str] = "🔗"
    descricao: Optional[str] = None
    
    # Configurações
    ativo: bool = True
    suporta_semanas: bool = True
    max_semanas: int = 4
    
    # Campos de credenciais necessários
    campos_credenciais: List[str] = ["email", "password"]
    
    # Parser de dados
    tipo_ficheiro: str = "csv"  # csv, xlsx, json
    mapeamento_campos: Optional[Dict[str, str]] = None
    
    # Metadados
    criado_por: Optional[str] = None
    criado_em: Optional[str] = None
    atualizado_em: Optional[str] = None
    
    # Estatísticas
    total_execucoes: int = 0
    ultima_execucao: Optional[str] = None


class DesignRPA(BaseModel):
    """Um design de automação completo"""
    id: Optional[str] = None
    plataforma_id: str
    
    # Identificação
    nome: str
    semana_offset: int = 0  # 0=atual, 1=semana-1, 2=semana-2, 3=semana-3
    
    # Passos gravados
    passos: List[PassoRPA] = []
    
    # Variáveis disponíveis
    variaveis: List[str] = []  # ["SEMANA_INICIO", "SEMANA_FIM"]
    
    # Estado
    versao: int = 1
    testado: bool = False
    ativo: bool = True
    
    # Metadados
    criado_por: Optional[str] = None
    criado_em: Optional[str] = None
    atualizado_em: Optional[str] = None
    
    # Estatísticas
    total_execucoes: int = 0
    execucoes_sucesso: int = 0
    ultima_execucao: Optional[str] = None


class AgendamentoRPA(BaseModel):
    """Configuração de agendamento de um parceiro"""
    id: Optional[str] = None
    parceiro_id: str
    plataforma_id: str
    
    # Configuração
    modo: str = "manual"  # manual, automatico
    ativo: bool = True
    
    # Agendamento automático
    frequencia: Optional[str] = "semanal"  # diario, semanal, mensal
    dia_semana: Optional[int] = 0  # 0=Segunda, 6=Domingo
    dia_mes: Optional[int] = 1  # Para frequência mensal
    hora: Optional[str] = "08:00"
    
    # Semanas a sincronizar (quais designs executar)
    semanas_ativas: List[int] = [0]  # [0] = só semana atual, [0,1,2,3] = todas
    
    # Estado
    ultima_execucao: Optional[str] = None
    proxima_execucao: Optional[str] = None
    ultimo_resultado: Optional[str] = None  # sucesso, erro
    ultimo_erro: Optional[str] = None
    
    # Metadados
    criado_em: Optional[str] = None
    atualizado_em: Optional[str] = None


class ExecucaoRPA(BaseModel):
    """Registo de uma execução de RPA"""
    id: Optional[str] = None
    design_id: str
    plataforma_id: str
    parceiro_id: str
    
    # Resultado
    status: str = "pendente"  # pendente, a_executar, sucesso, erro
    erro: Optional[str] = None
    
    # Dados extraídos
    ficheiro_download: Optional[str] = None
    registos_importados: int = 0
    dados_extraidos: Optional[Dict[str, Any]] = None
    
    # Timing
    iniciado_em: Optional[str] = None
    terminado_em: Optional[str] = None
    duracao_segundos: Optional[float] = None
    
    # Debug
    screenshots: List[str] = []
    logs: List[str] = []


# ============ Request/Response Models ============

class CriarPlataformaRequest(BaseModel):
    nome: str
    url_base: str
    icone: Optional[str] = "🔗"
    descricao: Optional[str] = None
    suporta_semanas: bool = True
    max_semanas: int = 4
    campos_credenciais: List[str] = ["email", "password"]
    tipo_ficheiro: str = "csv"


class AtualizarPlataformaRequest(BaseModel):
    nome: Optional[str] = None
    url_base: Optional[str] = None
    icone: Optional[str] = None
    descricao: Optional[str] = None
    ativo: Optional[bool] = None
    suporta_semanas: Optional[bool] = None
    max_semanas: Optional[int] = None
    campos_credenciais: Optional[List[str]] = None
    tipo_ficheiro: Optional[str] = None
    mapeamento_campos: Optional[Dict[str, str]] = None


class CriarDesignRequest(BaseModel):
    plataforma_id: str
    nome: str
    semana_offset: int = 0
    passos: List[PassoRPA] = []
    variaveis: List[str] = []


class AtualizarDesignRequest(BaseModel):
    nome: Optional[str] = None
    passos: Optional[List[PassoRPA]] = None
    variaveis: Optional[List[str]] = None
    testado: Optional[bool] = None
    ativo: Optional[bool] = None


class ConfigurarAgendamentoRequest(BaseModel):
    plataforma_id: str
    modo: str = "manual"
    frequencia: Optional[str] = "semanal"
    dia_semana: Optional[int] = 0
    dia_mes: Optional[int] = 1
    hora: Optional[str] = "08:00"
    semanas_ativas: List[int] = [0]
    ativo: bool = True


class GravarPassoRequest(BaseModel):
    """Request para gravar um passo durante a sessão de design"""
    tipo: TipoPasso
    seletor: Optional[str] = None
    seletor_tipo: Optional[str] = "css"
    valor: Optional[str] = None
    coordenadas: Optional[Dict[str, int]] = None
    screenshot: Optional[str] = None


class ExecutarDesignRequest(BaseModel):
    """Request para executar um design específico"""
    plataforma_id: str
    semana_offset: int = 0
