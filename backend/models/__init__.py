"""Pydantic models for FleeTrack application"""

# User models
from .user import (
    User, UserRole, UserCreate, UserLogin, UserBase,
    UserProfileUpdate, TokenResponse
)

# Motorista models
from .motorista import (
    Motorista, MotoristaCreate, MotoristaDocuments, DocumentoValidacao
)

# Vehicle models
from .veiculo import (
    Vehicle, VehicleCreate, TipoContrato, CaucaoVeiculo,
    VehicleInsurance, VehicleMaintenance, VehicleExtinguisher,
    VehicleInspection, VehicleAvailability, CategoriasUber, CategoriasBolt
)

# Contract models
from .contrato import (
    ContratoCreate, ContratoMotoristaCreate, ContratoMotorista,
    TemplateContratoCreate, Contrato
)

# Report models
from .relatorio import (
    RelatorioSemanal, RelatorioCreate, RelatorioGanhos,
    ExpenseCreate, Expense, RevenueCreate, Revenue, ReciboMotorista
)

# Plan models
from .plano import (
    PlanoMotorista, PlanoParceiro, PlanoPromocao,
    PlanoMotoristaCreate, PlanoMotoristaUpdate, MotoristaPlanoAssinatura
)

# Parceiro models
from .parceiro import (
    Parceiro, ParceiroCreate, AdminSettings
)

# Ganhos/Earnings models
from .ganhos import (
    GanhoUber, GanhoUberImportResponse, GanhoBolt,
    ViaVerdeMovimento, GPSDistancia, CombustivelEletrico, CombustivelFossil
)

# Sincronização models
from .sincronizacao import (
    CredenciaisPlataforma, LogSincronizacao
)

__all__ = [
    # User
    'User', 'UserRole', 'UserCreate', 'UserLogin', 'UserBase',
    'UserProfileUpdate', 'TokenResponse',
    # Motorista
    'Motorista', 'MotoristaCreate', 'MotoristaDocuments', 'DocumentoValidacao',
    # Vehicle
    'Vehicle', 'VehicleCreate', 'TipoContrato', 'CaucaoVeiculo',
    'VehicleInsurance', 'VehicleMaintenance', 'VehicleExtinguisher',
    'VehicleInspection', 'VehicleAvailability', 'CategoriasUber', 'CategoriasBolt',
    # Contract
    'ContratoCreate', 'ContratoMotoristaCreate', 'ContratoMotorista',
    'TemplateContratoCreate', 'Contrato',
    # Report
    'RelatorioSemanal', 'RelatorioCreate', 'RelatorioGanhos',
    'ExpenseCreate', 'Expense', 'RevenueCreate', 'Revenue', 'ReciboMotorista',
    # Plan
    'PlanoMotorista', 'PlanoParceiro', 'PlanoPromocao',
    'PlanoMotoristaCreate', 'PlanoMotoristaUpdate', 'MotoristaPlanoAssinatura',
    # Parceiro
    'Parceiro', 'ParceiroCreate', 'AdminSettings',
    # Ganhos
    'GanhoUber', 'GanhoUberImportResponse', 'GanhoBolt',
    'ViaVerdeMovimento', 'GPSDistancia', 'CombustivelEletrico', 'CombustivelFossil',
    # Sincronização
    'CredenciaisPlataforma', 'LogSincronizacao'
]
