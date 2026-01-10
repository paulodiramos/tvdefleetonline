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

__all__ = [
    'auth_router',
    'motoristas_router',
    'notificacoes_router',
    'mensagens_router',
    'parceiros_router',
    'planos_router',
    'pagamentos_router',
    'reports_router',
    'gestores_router'
]
