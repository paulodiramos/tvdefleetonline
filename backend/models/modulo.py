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
    "upload_csv_ganhos": {
        "nome": "Upload CSV Ganhos",
        "descricao": "Importar ganhos Uber e Bolt via CSV",
        "ordem": 1
    },
    "combustivel_manual": {
        "nome": "Combustível Manual",
        "descricao": "Registro manual de despesas de combustível",
        "ordem": 2
    },
    "viaverde_manual": {
        "nome": "Via Verde Manual",
        "descricao": "Registro manual de despesas Via Verde",
        "ordem": 3
    },
    "upload_csv_km": {
        "nome": "Upload CSV KM",
        "descricao": "Importar quilometragem via CSV",
        "ordem": 4
    },
    "gestao_veiculos": {
        "nome": "Gestão de Veículos",
        "descricao": "Gerenciamento completo de veículos",
        "ordem": 5
    },
    "gestao_manutencoes": {
        "nome": "Gestão de Manutenções",
        "descricao": "Controle de manutenções e revisões",
        "ordem": 6
    },
    "gestao_seguros": {
        "nome": "Gestão de Seguros",
        "descricao": "Gerenciamento de apólices e sinistros",
        "ordem": 7
    },
    "integracoes_fornecedores": {
        "nome": "Integrações Fornecedores",
        "descricao": "Integração com fornecedores externos",
        "ordem": 8
    },
    "relatorios": {
        "nome": "Relatórios",
        "descricao": "Relatórios e análises detalhadas",
        "ordem": 9
    },
    "gestao_contas": {
        "nome": "Gestão de Contas",
        "descricao": "Gerenciamento de contas e usuários",
        "ordem": 10
    },
    "gestao_manutencao": {
        "nome": "Gestão de Manutenção",
        "descricao": "Sistema avançado de manutenção",
        "ordem": 11
    },
    "financeiro": {
        "nome": "Financeiro",
        "descricao": "Módulo financeiro completo",
        "ordem": 12
    },
    "upload_csv": {
        "nome": "Upload CSV",
        "descricao": "Upload genérico de arquivos CSV",
        "ordem": 13
    },
    "gestao_motoristas": {
        "nome": "Gestão de Motoristas",
        "descricao": "Gerenciamento completo de motoristas",
        "ordem": 14
    },
    "gestao_pagamentos": {
        "nome": "Gestão de Pagamentos",
        "descricao": "Sistema de pagamentos e recibos",
        "ordem": 15
    },
    "gestao_eventos_veiculo": {
        "nome": "Gestão de Eventos de Veículos",
        "descricao": "Editar e gerir eventos na agenda do veículo",
        "ordem": 16
    },
    "vistorias_veiculos": {
        "nome": "Vistorias de Veículos",
        "descricao": "Sistema completo de vistorias e inspeções",
        "ordem": 17
    },
    "importar_csv": {
        "nome": "Importar CSV",
        "descricao": "Importação de dados via CSV (ganhos, KM, etc.)",
        "ordem": 18
    },
    "sincronizacao_automatica": {
        "nome": "Sincronização Automática",
        "descricao": "Sincronização automática com plataformas (Uber/Bolt)",
        "ordem": 19
    },
    "envio_email": {
        "nome": "Envio de Email",
        "descricao": "Módulo de envio de emails e notificações",
        "ordem": 20
    },
    "envio_whatsapp": {
        "nome": "Envio de WhatsApp",
        "descricao": "Envio de mensagens via WhatsApp",
        "ordem": 21
    },
    "avisos_documentos": {
        "nome": "Avisos de Documentos",
        "descricao": "Alertas automáticos de documentos fora de prazo",
        "ordem": 22
    },
    "avisos_revisoes": {
        "nome": "Avisos de Revisões",
        "descricao": "Alertas de veículos próximos da revisão",
        "ordem": 23
    },
    "dashboard_ganhos": {
        "nome": "Dashboard de Ganhos",
        "descricao": "Visualização detalhada de ganhos e estatísticas (Motorista)",
        "ordem": 24
    },
    "gestao_documentos_pessoais": {
        "nome": "Gestão de Documentos Pessoais",
        "descricao": "Upload e gestão de documentos pessoais (Motorista)",
        "ordem": 25
    },
    "envio_recibos": {
        "nome": "Envio de Recibos",
        "descricao": "Enviar recibos de ganhos para aprovação (Motorista)",
        "ordem": 26
    },
    "relatorios_performance": {
        "nome": "Relatórios de Performance",
        "descricao": "Relatórios detalhados de performance e produtividade (Motorista)",
        "ordem": 27
    },
    "alertas_personalizados": {
        "nome": "Alertas Personalizados",
        "descricao": "Sistema de alertas customizados (Motorista)",
        "ordem": 28
    },
    "historico_financeiro": {
        "nome": "Histórico Financeiro",
        "descricao": "Acesso completo ao histórico financeiro (Motorista)",
        "ordem": 29
    },
    "suporte_prioritario": {
        "nome": "Suporte Prioritário",
        "descricao": "Atendimento prioritário e suporte dedicado",
        "ordem": 30
    }
}
