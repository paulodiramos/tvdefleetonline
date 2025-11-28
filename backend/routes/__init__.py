"""API routes for FleeTrack application"""

from .auth import router as auth_router
from .users import router as users_router
from .motoristas import router as motoristas_router
from .veiculos import router as veiculos_router
from .contratos import router as contratos_router
from .relatorios import router as relatorios_router
from .planos import router as planos_router

__all__ = [
    'auth_router',
    'users_router',
    'motoristas_router',
    'veiculos_router',
    'contratos_router',
    'relatorios_router',
    'planos_router'
]
