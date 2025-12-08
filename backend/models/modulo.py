"""Módulos e Planos models"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class ModuloBase(BaseModel):
    """Módulo disponível no sistema"""
    id: str
    nome: str
    descricao: str
    codigo: str  # identificador único
    ativo: bool = True
    ordem: int = 0  # para ordenação na UI


class PlanoBase(BaseModel):
    """Plano de subscrição"""
    id: str
    nome: str
    descricao: Optional[str] = None
    modulos: List[str]  # lista de códigos de módulos
    tipo_pagamento: str  # "mensal", "anual", "vitalicio"
    preco_mensal: Optional[float] = None
    preco_anual: Optional[float] = None
    preco_vitalicio: Optional[float] = None
    ativo: bool = True
    destaque: bool = False  # plano em destaque
    created_at: datetime
    updated_at: datetime


class PlanoUsuario(BaseModel):
    """Plano atribuído a um usuário"""
    id: str
    user_id: str
    plano_id: Optional[str] = None  # None = módulos individuais
    modulos_ativos: List[str]  # módulos que o usuário tem acesso
    tipo_pagamento: Optional[str] = None
    valor_pago: Optional[float] = None
    data_inicio: datetime
    data_fim: Optional[datetime] = None  # None = vitalício
    status: str  # "ativo", "expirado", "cancelado"
    renovacao_automatica: bool = False
    created_at: datetime
    updated_at: datetime
    created_by: str


# Módulos disponíveis no sistema
MODULOS_SISTEMA = {
    # ============ MÓDULOS PARA PARCEIROS ============
    "gestao_veiculos": {
        "nome": "Gestão de Veículos",
        "descricao": "Gerenciamento completo de veículos",
        "tipo_usuario": "parceiro",
        "ordem": 1
    },
    "gestao_motoristas": {
        "nome": "Gestão de Motoristas",
        "descricao": "Gerenciamento completo de motoristas",
        "tipo_usuario": "parceiro",
        "ordem": 2
    },
    "gestao_eventos_veiculo": {
        "nome": "Gestão de Eventos de Veículos",
        "descricao": "Editar e gerir eventos na agenda do veículo",
        "tipo_usuario": "parceiro",
        "ordem": 3
    },
    "vistorias_veiculos": {
        "nome": "Vistorias de Veículos",
        "descricao": "Sistema completo de vistorias e inspeções",
        "tipo_usuario": "parceiro",
        "ordem": 4
    },
    "gestao_manutencoes": {
        "nome": "Gestão de Manutenções",
        "descricao": "Controle de manutenções e revisões",
        "tipo_usuario": "parceiro",
        "ordem": 5
    },
    "gestao_seguros": {
        "nome": "Gestão de Seguros",
        "descricao": "Gerenciamento de apólices e sinistros",
        "tipo_usuario": "parceiro",
        "ordem": 6
    },
    "gestao_pagamentos": {
        "nome": "Gestão de Pagamentos",
        "descricao": "Sistema de pagamentos e recibos a motoristas",
        "tipo_usuario": "parceiro",
        "ordem": 7
    },
    "importar_csv": {
        "nome": "Importar CSV",
        "descricao": "Importação de dados via CSV (ganhos, KM, etc.)",
        "tipo_usuario": "parceiro",
        "ordem": 8
    },
    "sincronizacao_automatica": {
        "nome": "Sincronização Automática",
        "descricao": "Sincronização automática com plataformas (Uber/Bolt)",
        "tipo_usuario": "parceiro",
        "ordem": 9
    },
    "relatorios": {
        "nome": "Relatórios Avançados",
        "descricao": "Relatórios e análises detalhadas da frota",
        "tipo_usuario": "parceiro",
        "ordem": 10
    },
    "financeiro": {
        "nome": "Módulo Financeiro",
        "descricao": "Gestão financeira completa",
        "tipo_usuario": "parceiro",
        "ordem": 11
    },
    "envio_email": {
        "nome": "Envio de Email",
        "descricao": "Módulo de envio de emails e notificações",
        "tipo_usuario": "parceiro",
        "ordem": 12
    },
    "envio_whatsapp": {
        "nome": "Envio de WhatsApp",
        "descricao": "Envio de mensagens via WhatsApp",
        "tipo_usuario": "parceiro",
        "ordem": 13
    },
    "avisos_documentos": {
        "nome": "Avisos de Documentos",
        "descricao": "Alertas automáticos de documentos fora de prazo",
        "tipo_usuario": "parceiro",
        "ordem": 14
    },
    "avisos_revisoes": {
        "nome": "Avisos de Revisões",
        "descricao": "Alertas de veículos próximos da revisão",
        "tipo_usuario": "parceiro",
        "ordem": 15
    },
    "gestao_contratos": {
        "nome": "Gestão de Contratos",
        "descricao": "Criar e gerir contratos com motoristas",
        "tipo_usuario": "parceiro",
        "ordem": 16
    },
    "integracao_moloni": {
        "nome": "Integração Moloni",
        "descricao": "Faturação automática com Moloni",
        "tipo_usuario": "parceiro",
        "ordem": 17
    },
    
    # ============ MÓDULOS PARA MOTORISTAS ============
    "dashboard_ganhos": {
        "nome": "Dashboard de Ganhos",
        "descricao": "Visualização detalhada de ganhos e estatísticas",
        "tipo_usuario": "motorista",
        "ordem": 1
    },
    "gestao_documentos_pessoais": {
        "nome": "Gestão de Documentos Pessoais",
        "descricao": "Upload e gestão de documentos pessoais",
        "tipo_usuario": "motorista",
        "ordem": 2
    },
    "envio_recibos": {
        "nome": "Envio de Recibos",
        "descricao": "Enviar recibos de ganhos para aprovação",
        "tipo_usuario": "motorista",
        "ordem": 3
    },
    "relatorios_performance": {
        "nome": "Relatórios de Performance",
        "descricao": "Relatórios detalhados de performance e produtividade",
        "tipo_usuario": "motorista",
        "ordem": 4
    },
    "alertas_personalizados": {
        "nome": "Alertas Personalizados",
        "descricao": "Sistema de alertas customizados",
        "tipo_usuario": "motorista",
        "ordem": 5
    },
    "historico_financeiro": {
        "nome": "Histórico Financeiro",
        "descricao": "Acesso completo ao histórico financeiro",
        "tipo_usuario": "motorista",
        "ordem": 6
    },
    "oportunidades_veiculo": {
        "nome": "Oportunidades de Veículo",
        "descricao": "Visualizar veículos disponíveis para conduzir",
        "tipo_usuario": "motorista",
        "ordem": 7
    },
    "chat_parceiro": {
        "nome": "Chat com Parceiro",
        "descricao": "Comunicação direta com o parceiro",
        "tipo_usuario": "motorista",
        "ordem": 8
    },
    "suporte_prioritario": {
        "nome": "Suporte Prioritário",
        "descricao": "Atendimento prioritário e suporte dedicado",
        "tipo_usuario": "motorista",
        "ordem": 9
    }
}
