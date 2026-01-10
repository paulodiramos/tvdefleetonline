"""API routes for FleeTrack application"""

from .auth import router as auth_router
from .motoristas import router as motoristas_router
from .notificacoes import router as notificacoes_router
from .mensagens import router as mensagens_router
from .parceiros import router as parceiros_router
from .planos import router as planos_router
from .pagamentos import router as pagamentos_router
from .reports import router as reports_router
from .gestores import router as gestores_router
from .vehicles import router as vehicles_router
from .csv_config import router as csv_config_router
from .relatorios import router as relatorios_router
from .automacao import router as automacao_router
from .despesas import router as despesas_router
from .extras import router as extras_router
from .configuracoes import router as configuracoes_router
from .importacoes import router as importacoes_router
from .ifthenpay import router as ifthenpay_router
# New refactored routers
from .admin import router as admin_router
from .alertas import router as alertas_router
from .contratos import router as contratos_router
from .sincronizacao import router as sincronizacao_router
from .public import router as public_router

__all__ = [
    'auth_router',
    'motoristas_router',
    'notificacoes_router',
    'mensagens_router',
    'parceiros_router',
    'planos_router',
    'pagamentos_router',
    'reports_router',
    'gestores_router',
    'vehicles_router',
    'csv_config_router',
    'relatorios_router',
    'automacao_router',
    'despesas_router',
    'extras_router',
    'configuracoes_router',
    'importacoes_router',
    'ifthenpay_router',
    'admin_router',
    'alertas_router',
    'contratos_router',
    'sincronizacao_router',
    'public_router'
]
