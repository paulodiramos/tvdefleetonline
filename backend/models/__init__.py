"""Pydantic models for FleeTrack application"""

from .user import User, UserRole, UserCreate
from .motorista import Motorista, MotoristaCreate
from .veiculo import Vehicle, VehicleCreate
from .contrato import ContratoCreate, ContratoMotoristaCreate
from .relatorio import RelatorioSemanal, RelatorioCreate
from .plano import PlanoMotorista, PlanoParceiro

__all__ = [
    'User',
    'UserRole',
    'UserCreate',
    'Motorista',
    'MotoristaCreate',
    'Vehicle',
    'VehicleCreate',
    'ContratoCreate',
    'ContratoMotoristaCreate',
    'RelatorioSemanal',
    'RelatorioCreate',
    'PlanoMotorista',
    'PlanoParceiro'
]
