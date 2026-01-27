"""
Sistema de Planos e Módulos - TVDEFleet
Suporta:
- Cobrança por veículo, por motorista ou preço fixo
- Limites de veículos/motoristas por plano
- Preços semanais, mensais e anuais
- Preços especiais por parceiro
- Campanhas promocionais (normais e pioneiro)
- Módulos individuais compráveis
- Trial/ofertas temporárias
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class TipoCobranca(str, Enum):
    """Tipo de cobrança do plano/módulo"""
    POR_VEICULO = "por_veiculo"
    POR_MOTORISTA = "por_motorista"
    FIXO = "fixo"  # Preço único independente da quantidade


class TipoUsuario(str, Enum):
    """Tipo de utilizador alvo"""
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"
    AMBOS = "ambos"


class Periodicidade(str, Enum):
    """Periodicidade de cobrança"""
    SEMANAL = "semanal"
    MENSAL = "mensal"
    ANUAL = "anual"


class TipoPromocao(str, Enum):
    """Tipo de promoção"""
    NORMAL = "normal"
    PIONEIRO = "pioneiro"  # Para primeiros clientes
    LANCAMENTO = "lancamento"


class StatusSubscricao(str, Enum):
    """Status da subscrição"""
    ATIVO = "ativo"
    PENDENTE_PAGAMENTO = "pendente_pagamento"
    TRIAL = "trial"
    EXPIRADO = "expirado"
    CANCELADO = "cancelado"
    SUSPENSO = "suspenso"


# ==================== PROMOÇÕES ====================

class Promocao(BaseModel):
    """Promoção aplicável a planos/módulos"""
    id: str
    nome: str
    descricao: Optional[str] = None
    tipo: TipoPromocao = TipoPromocao.NORMAL
    desconto_percentagem: float = 0  # Ex: 20 = 20% desconto
    preco_fixo: Optional[float] = None  # Alternativa: preço fixo em vez de desconto
    data_inicio: datetime
    data_fim: Optional[datetime] = None  # None = sem fim
    max_utilizacoes: Optional[int] = None  # None = ilimitado
    utilizacoes_atuais: int = 0
    codigo_promocional: Optional[str] = None  # Código para aplicar
    ativa: bool = True


class PrecoEspecial(BaseModel):
    """Preço especial para parceiro específico"""
    parceiro_id: str
    parceiro_nome: Optional[str] = None
    desconto_percentagem: Optional[float] = None
    preco_fixo_semanal: Optional[float] = None
    preco_fixo_mensal: Optional[float] = None
    preco_fixo_anual: Optional[float] = None
    motivo: Optional[str] = None
    data_inicio: datetime
    data_fim: Optional[datetime] = None
    criado_por: str
    criado_em: datetime


# ==================== LIMITES ====================

class LimitesPlano(BaseModel):
    """Limites do plano"""
    max_veiculos: Optional[int] = None  # None = ilimitado
    max_motoristas: Optional[int] = None
    max_contratos: Optional[int] = None
    max_relatorios_mes: Optional[int] = None
    max_emails_mes: Optional[int] = None
    max_whatsapp_mes: Optional[int] = None
    armazenamento_gb: Optional[float] = None


# ==================== PREÇOS ====================

class Precos(BaseModel):
    """Estrutura de preços"""
    semanal: Optional[float] = None
    mensal: Optional[float] = None
    anual: Optional[float] = None
    setup: Optional[float] = None  # Taxa única de setup


class PrecosPlano(BaseModel):
    """Estrutura de preços para planos de parceiros (base + por veículo + por motorista)"""
    # Preço base do plano
    base_semanal: Optional[float] = 0
    base_mensal: Optional[float] = 0
    base_anual: Optional[float] = 0
    # Custo adicional por veículo
    por_veiculo_semanal: Optional[float] = 0
    por_veiculo_mensal: Optional[float] = 0
    por_veiculo_anual: Optional[float] = 0
    # Custo adicional por motorista
    por_motorista_semanal: Optional[float] = 0
    por_motorista_mensal: Optional[float] = 0
    por_motorista_anual: Optional[float] = 0
    # Taxa única de setup
    setup: Optional[float] = 0


# ==================== MÓDULO ====================

class ModuloSistema(BaseModel):
    """Módulo individual do sistema"""
    id: str
    codigo: str  # Identificador único (ex: "contratos", "emails")
    nome: str
    descricao: str
    tipo_usuario: TipoUsuario = TipoUsuario.PARCEIRO
    tipo_cobranca: TipoCobranca = TipoCobranca.FIXO
    precos: Precos = Precos()
    icone: str = "📦"
    cor: str = "#6B7280"
    ordem: int = 0
    ativo: bool = True
    destaque: bool = False
    funcionalidades: List[str] = []  # Lista de features incluídas
    requer_modulos: List[str] = []  # Módulos pré-requisitos
    promocoes: List[Promocao] = []
    precos_especiais: List[PrecoEspecial] = []
    created_at: datetime
    updated_at: datetime


class ModuloCreate(BaseModel):
    """Modelo para criar módulo"""
    codigo: str
    nome: str
    descricao: str
    tipo_usuario: TipoUsuario = TipoUsuario.PARCEIRO
    tipo_cobranca: TipoCobranca = TipoCobranca.FIXO
    precos: Precos = Precos()
    icone: str = "📦"
    cor: str = "#6B7280"
    ordem: int = 0
    funcionalidades: List[str] = []
    requer_modulos: List[str] = []


class ModuloUpdate(BaseModel):
    """Modelo para atualizar módulo"""
    nome: Optional[str] = None
    descricao: Optional[str] = None
    tipo_cobranca: Optional[TipoCobranca] = None
    precos: Optional[Precos] = None
    icone: Optional[str] = None
    cor: Optional[str] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None
    destaque: Optional[bool] = None
    funcionalidades: Optional[List[str]] = None


# ==================== PLANO ====================

class PlanoSistema(BaseModel):
    """Plano de subscrição"""
    id: str
    nome: str
    descricao: str
    tipo_usuario: TipoUsuario = TipoUsuario.PARCEIRO
    categoria: str = "standard"  # "gratuito", "basico", "profissional", "enterprise"
    # Nova estrutura de preços para parceiros
    precos_plano: Optional[PrecosPlano] = PrecosPlano()
    # Preços simples para motoristas (mantém compatibilidade)
    precos: Precos = Precos()
    # Limites só aplicam a parceiros
    limites: Optional[LimitesPlano] = None
    modulos_incluidos: List[str] = []  # Códigos dos módulos incluídos
    icone: str = "📦"
    cor: str = "#3B82F6"
    ordem: int = 0
    ativo: bool = True
    destaque: bool = False
    permite_trial: bool = False
    dias_trial: int = 0
    features_destaque: List[str] = []  # Features para mostrar na UI
    promocoes: List[Promocao] = []
    precos_especiais: List[PrecoEspecial] = []
    created_at: datetime
    updated_at: datetime


class PlanoCreate(BaseModel):
    """Modelo para criar plano"""
    nome: str
    descricao: str
    tipo_usuario: TipoUsuario = TipoUsuario.PARCEIRO
    categoria: str = "standard"
    precos_plano: Optional[PrecosPlano] = PrecosPlano()
    precos: Precos = Precos()
    limites: Optional[LimitesPlano] = None
    modulos_incluidos: List[str] = []
    icone: str = "📦"
    cor: str = "#3B82F6"
    ordem: int = 0
    permite_trial: bool = False
    dias_trial: int = 0
    features_destaque: List[str] = []


class PlanoUpdate(BaseModel):
    """Modelo para atualizar plano"""
    nome: Optional[str] = None
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    precos_plano: Optional[PrecosPlano] = None
    precos: Optional[Precos] = None
    limites: Optional[LimitesPlano] = None
    modulos_incluidos: Optional[List[str]] = None
    icone: Optional[str] = None
    cor: Optional[str] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None
    destaque: Optional[bool] = None
    permite_trial: Optional[bool] = None
    dias_trial: Optional[int] = None
    features_destaque: Optional[List[str]] = None


# ==================== SUBSCRIÇÃO ====================

class ModuloSubscrito(BaseModel):
    """Módulo individual subscrito"""
    modulo_id: str
    modulo_codigo: str
    modulo_nome: str
    periodicidade: Periodicidade
    preco_pago: float
    data_inicio: datetime
    data_fim: Optional[datetime] = None
    auto_renovacao: bool = True
    status: StatusSubscricao = StatusSubscricao.ATIVO
    trial: bool = False
    oferta: bool = False  # Se foi oferecido pelo admin
    oferta_motivo: Optional[str] = None
    promocao_aplicada: Optional[str] = None


class TrialInfo(BaseModel):
    """Informação de trial"""
    ativo: bool = False
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None
    convertido: bool = False


class DescontoEspecial(BaseModel):
    """Desconto especial aplicado"""
    ativo: bool = False
    percentagem: Optional[float] = None
    preco_fixo: Optional[float] = None
    motivo: Optional[str] = None
    aplicado_por: Optional[str] = None
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None


class Subscricao(BaseModel):
    """Subscrição de utilizador (plano + módulos)"""
    id: str
    user_id: str
    user_tipo: TipoUsuario
    user_nome: Optional[str] = None
    
    # Plano principal (opcional - pode ter só módulos individuais)
    plano_id: Optional[str] = None
    plano_nome: Optional[str] = None
    plano_categoria: Optional[str] = None
    
    # Quantidade de recursos (para cálculo de preço)
    num_veiculos: int = 0
    num_motoristas: int = 0
    
    # Módulos individuais adicionais
    modulos_individuais: List[ModuloSubscrito] = []
    
    # Cobrança
    periodicidade: Periodicidade = Periodicidade.MENSAL
    preco_base: float = 0  # Base do plano
    preco_veiculos: float = 0  # Custo total veículos
    preco_motoristas: float = 0  # Custo total motoristas
    preco_modulos: float = 0  # Custo módulos individuais
    preco_final: float = 0  # Total após descontos
    
    # Datas
    data_inicio: datetime
    data_fim: Optional[datetime] = None
    proxima_cobranca: Optional[datetime] = None
    
    # Status
    status: StatusSubscricao = StatusSubscricao.ATIVO
    auto_renovacao: bool = True
    
    # Trial e descontos
    trial: TrialInfo = TrialInfo()
    desconto_especial: DescontoEspecial = DescontoEspecial()
    promocao_aplicada: Optional[Promocao] = None
    
    # Pagamento
    metodo_pagamento: Optional[str] = None  # "multibanco", "mbway", "cartao", "debito_direto"
    ultimo_pagamento: Optional[datetime] = None
    
    # Histórico de ajustes (pro-rata)
    historico_ajustes: List[Dict] = []
    
    # Metadata
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    notas_admin: Optional[str] = None


class SubscricaoCreate(BaseModel):
    """Modelo para criar subscrição"""
    user_id: str
    user_tipo: TipoUsuario
    plano_id: Optional[str] = None
    num_veiculos: int = 0
    num_motoristas: int = 0
    modulos_individuais: List[str] = []  # Lista de códigos de módulos
    periodicidade: Periodicidade = Periodicidade.MENSAL
    trial_dias: Optional[int] = None
    desconto_percentagem: Optional[float] = None
    oferta: bool = False
    oferta_motivo: Optional[str] = None
    metodo_pagamento: Optional[str] = None


class AtribuirModuloRequest(BaseModel):
    """Request para atribuir módulo a utilizador"""
    user_id: str
    modulo_codigo: str
    periodicidade: Periodicidade = Periodicidade.MENSAL
    trial_dias: Optional[int] = None  # Se > 0, é trial
    oferta: bool = False  # Se True, é grátis
    oferta_dias: Optional[int] = None  # Duração da oferta
    oferta_motivo: Optional[str] = None
    desconto_percentagem: Optional[float] = None


class AtribuirPlanoRequest(BaseModel):
    """Request para atribuir plano a utilizador"""
    user_id: str
    plano_id: str
    num_veiculos: int = 0
    num_motoristas: int = 0
    periodicidade: Periodicidade = Periodicidade.MENSAL
    trial_dias: Optional[int] = None
    oferta: bool = False
    oferta_dias: Optional[int] = None
    oferta_motivo: Optional[str] = None
    desconto_percentagem: Optional[float] = None


class AtualizarRecursosRequest(BaseModel):
    """Request para atualizar número de veículos/motoristas (gera pro-rata)"""
    user_id: str
    num_veiculos: Optional[int] = None
    num_motoristas: Optional[int] = None
    motivo: Optional[str] = None


class CalculoPrecoResponse(BaseModel):
    """Resposta do cálculo de preço"""
    plano_id: str
    plano_nome: str
    periodicidade: str
    num_veiculos: int
    num_motoristas: int
    preco_base: float
    preco_veiculos: float
    preco_motoristas: float
    preco_total: float
    desconto_aplicado: Optional[float] = None
    preco_final: float


class ProRataResponse(BaseModel):
    """Resposta do cálculo pro-rata"""
    dias_restantes: int
    dias_periodo: int
    preco_mensal_anterior: float
    preco_mensal_novo: float
    diferenca_mensal: float
    valor_prorata: float  # O que precisa pagar agora
    nova_mensalidade: float  # Próxima mensalidade
    data_proxima_cobranca: str


# ==================== MÓDULOS PREDEFINIDOS ====================

MODULOS_PREDEFINIDOS = {
    # Módulos para Parceiros
    "emails": {
        "nome": "Envio de Emails",
        "descricao": "Envio de emails automáticos e manuais para motoristas",
        "tipo_usuario": "parceiro",
        "tipo_cobranca": "fixo",
        "icone": "📧",
        "cor": "#EF4444",
        "ordem": 1,
        "funcionalidades": ["email_manual", "email_automatico", "templates_email"]
    },
    "manutencao_veiculos": {
        "nome": "Manutenção de Veículos",
        "descricao": "Gestão completa de manutenções, revisões e alertas",
        "tipo_usuario": "parceiro",
        "tipo_cobranca": "por_veiculo",
        "icone": "🔧",
        "cor": "#F59E0B",
        "ordem": 2,
        "funcionalidades": ["registar_manutencao", "alertas_revisao", "historico_manutencoes"]
    },
    "agenda": {
        "nome": "Agenda de Veículos",
        "descricao": "Calendário e agendamento de eventos para veículos",
        "tipo_usuario": "parceiro",
        "tipo_cobranca": "fixo",
        "icone": "📅",
        "cor": "#10B981",
        "ordem": 3,
        "funcionalidades": ["calendario_veiculos", "eventos_automaticos", "lembretes"]
    },
    "publicidade_veiculos": {
        "nome": "Publicidade de Veículos",
        "descricao": "Publicar veículos para aluguer ou venda no website",
        "tipo_usuario": "parceiro",
        "tipo_cobranca": "por_veiculo",
        "icone": "📢",
        "cor": "#8B5CF6",
        "ordem": 4,
        "funcionalidades": ["anuncio_aluguer", "anuncio_venda", "galeria_fotos"]
    },
    "contratos": {
        "nome": "Gestão de Contratos",
        "descricao": "Criar e gerir contratos com motoristas",
        "tipo_usuario": "parceiro",
        "tipo_cobranca": "fixo",
        "icone": "📄",
        "cor": "#3B82F6",
        "ordem": 5,
        "funcionalidades": ["criar_contrato", "templates_contrato", "assinatura_digital", "historico_contratos"]
    },
    "whatsapp": {
        "nome": "WhatsApp Business",
        "descricao": "Envio de mensagens via WhatsApp Business API",
        "tipo_usuario": "parceiro",
        "tipo_cobranca": "fixo",
        "icone": "💬",
        "cor": "#25D366",
        "ordem": 6,
        "funcionalidades": ["whatsapp_manual", "whatsapp_automatico", "templates_whatsapp"]
    },
    "relatorios_avancados": {
        "nome": "Relatórios Avançados",
        "descricao": "Relatórios detalhados e analytics da frota",
        "tipo_usuario": "parceiro",
        "tipo_cobranca": "fixo",
        "icone": "📊",
        "cor": "#EC4899",
        "ordem": 7,
        "funcionalidades": ["relatorios_financeiros", "analytics", "exportacao_dados"]
    },
    "rpa_automacao": {
        "nome": "Automação RPA",
        "descricao": "Extração automática de dados de plataformas (Uber, Bolt, etc)",
        "tipo_usuario": "parceiro",
        "tipo_cobranca": "fixo",
        "icone": "🤖",
        "cor": "#6366F1",
        "ordem": 8,
        "funcionalidades": ["extracao_uber", "extracao_bolt", "importacao_csv", "agendamento"]
    },
    "vistorias": {
        "nome": "Vistorias de Veículos",
        "descricao": "Sistema de vistorias e inspeções de veículos",
        "tipo_usuario": "parceiro",
        "tipo_cobranca": "por_veiculo",
        "icone": "🔍",
        "cor": "#14B8A6",
        "ordem": 9,
        "funcionalidades": ["criar_vistoria", "checklist", "fotos_vistoria", "relatorio_vistoria"]
    },
    
    # Módulos para Motoristas
    "autofaturacao": {
        "nome": "Autofaturação",
        "descricao": "Emissão automática de faturas/recibos verdes",
        "tipo_usuario": "motorista",
        "tipo_cobranca": "fixo",
        "icone": "🧾",
        "cor": "#0EA5E9",
        "ordem": 1,
        "funcionalidades": ["emitir_fatura", "integracao_at", "historico_faturas"],
        "brevemente": True
    },
    "dashboard_ganhos": {
        "nome": "Dashboard de Ganhos",
        "descricao": "Visualização detalhada de ganhos e estatísticas",
        "tipo_usuario": "motorista",
        "tipo_cobranca": "fixo",
        "icone": "💰",
        "cor": "#22C55E",
        "ordem": 2,
        "funcionalidades": ["ver_ganhos", "graficos", "comparativos"]
    },
}


# ==================== PLANOS PREDEFINIDOS ====================

PLANOS_PREDEFINIDOS = {
    # ===== PLANOS PARCEIROS =====
    "parceiro_gratuito": {
        "nome": "Gratuito",
        "descricao": "Plano básico gratuito para começar",
        "tipo_usuario": "parceiro",
        "categoria": "gratuito",
        "precos_plano": {
            "base_mensal": 0,
            "por_veiculo_mensal": 0,
            "por_motorista_mensal": 0,
        },
        "limites": {"max_veiculos": 3, "max_motoristas": 5},
        "modulos_incluidos": ["dashboard_basico"],
        "icone": "🆓",
        "cor": "#6B7280",
        "ordem": 1,
        "features_destaque": ["Até 3 veículos", "Até 5 motoristas", "Dashboard básico"]
    },
    "parceiro_profissional": {
        "nome": "Profissional",
        "descricao": "Para frotas em crescimento",
        "tipo_usuario": "parceiro",
        "categoria": "profissional",
        "precos_plano": {
            "base_mensal": 19.99,
            "base_anual": 199.99,
            "por_veiculo_mensal": 4.99,
            "por_veiculo_anual": 49.99,
            "por_motorista_mensal": 2.99,
            "por_motorista_anual": 29.99,
        },
        "limites": None,  # Sem limites
        "modulos_incluidos": ["emails", "agenda", "contratos", "relatorios_avancados"],
        "icone": "⭐",
        "cor": "#3B82F6",
        "ordem": 2,
        "permite_trial": True,
        "dias_trial": 14,
        "features_destaque": ["Base €19.99/mês", "+€4.99/veículo", "+€2.99/motorista", "Emails, Contratos, Relatórios"]
    },
    "parceiro_enterprise": {
        "nome": "Enterprise",
        "descricao": "Para grandes frotas com todas as funcionalidades",
        "tipo_usuario": "parceiro",
        "categoria": "enterprise",
        "precos_plano": {
            "base_mensal": 49.99,
            "base_anual": 499.99,
            "por_veiculo_mensal": 3.99,
            "por_veiculo_anual": 39.99,
            "por_motorista_mensal": 1.99,
            "por_motorista_anual": 19.99,
        },
        "limites": None,  # Sem limites
        "modulos_incluidos": ["emails", "agenda", "contratos", "relatorios_avancados", "whatsapp", "rpa_automacao", "vistorias", "manutencao_veiculos"],
        "icone": "🏆",
        "cor": "#8B5CF6",
        "ordem": 3,
        "permite_trial": True,
        "dias_trial": 30,
        "features_destaque": ["Base €49.99/mês", "+€3.99/veículo", "+€1.99/motorista", "Todos os módulos", "Suporte prioritário"]
    },
    
    # ===== PLANOS MOTORISTAS (sem limites) =====
    "motorista_gratuito": {
        "nome": "Gratuito",
        "descricao": "Acesso básico para motoristas",
        "tipo_usuario": "motorista",
        "categoria": "gratuito",
        "precos": {"semanal": 0, "mensal": 0, "anual": 0},
        "modulos_incluidos": ["dashboard_ganhos"],
        "icone": "🆓",
        "cor": "#6B7280",
        "ordem": 1,
        "features_destaque": ["Dashboard de ganhos", "Perfil básico"]
    },
    "motorista_premium": {
        "nome": "Premium",
        "descricao": "Funcionalidades avançadas para motoristas",
        "tipo_usuario": "motorista",
        "categoria": "premium",
        "precos": {"semanal": 1.99, "mensal": 4.99, "anual": 49.99},
        "modulos_incluidos": ["dashboard_ganhos", "autofaturacao"],
        "icone": "⭐",
        "cor": "#F59E0B",
        "ordem": 2,
        "permite_trial": True,
        "dias_trial": 7,
        "features_destaque": ["Dashboard avançado", "Autofaturação", "Relatórios detalhados"]
    }
}
