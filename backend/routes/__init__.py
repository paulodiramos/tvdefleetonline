"""API routes for FleeTrack application"""

from .auth import router as auth_router
from .motoristas import router as motoristas_router
from .notificacoes import router as notificacoes_router

__all__ = [
    'auth_router',
    'motoristas_router',
    'notificacoes_router'
]
