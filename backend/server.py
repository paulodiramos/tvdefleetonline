from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from io import BytesIO
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"  # Gestor Associado - pode gerir múltiplos parceiros
    PARCEIRO = "parceiro"
    OPERACIONAL = "operacional"  # Parceiro com gestão de frota própria
    MOTORISTA = "motorista"

# User Profile Models
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    empresa: Optional[str] = None
    nif: Optional[str] = None
    morada: Optional[str] = None
    niveis_servico: Optional[List[str]] = None  # For operacional role

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

# Parceiro Model
class ParceiroCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    empresa: Optional[str] = None
    nif: Optional[str] = None
    morada: Optional[str] = None
    gestor_associado_id: Optional[str] = None

class Parceiro(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    phone: str
    empresa: Optional[str] = None
    nif: Optional[str] = None
    morada: Optional[str] = None
    gestor_associado_id: Optional[str] = None
    total_vehicles: int = 0
    created_at: datetime

# Admin Settings Model
class AdminSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "admin_settings"
    anos_validade_matricula: int = 20
    km_aviso_manutencao: int = 5000
    updated_at: datetime
    updated_by: str

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: datetime
    approved: bool = False
    associated_partner_id: Optional[str] = None
    associated_gestor_id: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

# Motorista Models - EXPANDED
class MotoristaDocuments(BaseModel):
    license_photo: Optional[str] = None
    cv_file: Optional[str] = None
    profile_photo: Optional[str] = None
    documento_identificacao: Optional[str] = None
    licenca_tvde: Optional[str] = None
    registo_criminal: Optional[str] = None
    contrato: Optional[str] = None
    additional_docs: List[str] = []

class MotoristaCreate(BaseModel):
    email: EmailStr
    password: Optional[str] = None  # Optional for admin creation
    name: str
    phone: str
    morada_completa: str
    codigo_postal: str
    data_nascimento: str
    nacionalidade: str
    tipo_documento: str  # CC, Passaporte, Residencia
    numero_documento: str
    validade_documento: str
    nif: str
    carta_conducao_numero: str
    carta_conducao_validade: str
    licenca_tvde_numero: str
    licenca_tvde_validade: str
    codigo_registo_criminal: Optional[str] = None
    parceiro_atribuido: Optional[str] = None
    veiculo_atribuido: Optional[str] = None
    regime: str  # aluguer, comissao, carro_proprio
    iban: Optional[str] = None
    email_uber: Optional[str] = None
    telefone_uber: Optional[str] = None
    email_bolt: Optional[str] = None
    telefone_bolt: Optional[str] = None
    whatsapp: str
    tipo_pagamento: str  # fatura, recibo_verde, sem_recibo
    senha_provisoria: bool = False

class Motorista(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    phone: str
    morada_completa: Optional[str] = None
    codigo_postal: Optional[str] = None
    data_nascimento: Optional[str] = None
    nacionalidade: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    validade_documento: Optional[str] = None
    nif: Optional[str] = None
    carta_conducao_numero: Optional[str] = None
    carta_conducao_validade: Optional[str] = None
    licenca_tvde_numero: Optional[str] = None
    licenca_tvde_validade: Optional[str] = None
    codigo_registo_criminal: Optional[str] = None
    parceiro_atribuido: Optional[str] = None
    veiculo_atribuido: Optional[str] = None
    regime: Optional[str] = None
    iban: Optional[str] = None
    email_uber: Optional[str] = None
    telefone_uber: Optional[str] = None
    email_bolt: Optional[str] = None
    telefone_bolt: Optional[str] = None
    whatsapp: Optional[str] = None
    tipo_pagamento: Optional[str] = None
    documents: MotoristaDocuments
    approved: bool = False
    senha_provisoria: bool = False
    created_at: datetime
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

# Vehicle Models - EXPANDED
class VehicleInsurance(BaseModel):
    seguradora: str
    apolice: str
    data_inicio: str
    data_validade: str
    preco: float
    carta_verde_url: Optional[str] = None
    condicoes: Optional[str] = None
    notas: Optional[str] = None

class VehicleMaintenance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data_intervencao: str
    tipo_manutencao: str
    descricao: str
    descricao_detalhada: Optional[str] = None
    custos: float
    oficina: str
    tempo_intervencao: str
    km_intervencao: int
    data_proxima: Optional[str] = None
    km_proxima: Optional[int] = None
    o_que_fazer: Optional[str] = None

class VehiclePart(BaseModel):
    fornecedor: str
    peca: str
    preco: float
    km_intervencao: int
    data_instalacao: str

class VehicleTires(BaseModel):
    fornecedor: str
    preco: float
    km_intervencao: int
    data_instalacao: str

class VehicleExtinguisher(BaseModel):
    fornecedor: str
    preco: float
    data_entrega: str
    data_validade: str
    certificado_url: Optional[str] = None

class VehicleInspection(BaseModel):
    fornecedor: str
    data_inspecao: str
    proxima_inspecao: str
    custo: float

class VehicleGPS(BaseModel):
    fornecedor: str
    preco_mensal: float
    numero_dispositivo: str

class VehicleViaVerde(BaseModel):
    numero: str
    data_ativacao: str
    custo_mensal: float

class VehicleFuelCard(BaseModel):
    fornecedor: str
    numero_cartao: str
    codigo: str
    plafon: float

class RegimeAluguer(BaseModel):
    valor_aluguer: float
    comissao_motorista: float
    comissao_parceiro: float
    via_verde_incluida: bool = False
    combustivel_incluido: bool = False
    outras_condicoes: Optional[str] = None

class VehicleAvailability(BaseModel):
    status: str  # disponivel, atribuido, manutencao, seguro, sinistro, venda
    motoristas_atribuidos: List[str] = []
    data_entrega_manutencao: Optional[str] = None
    tipo_manutencao: Optional[str] = None
    regime_aluguer: Optional[RegimeAluguer] = None

class VehicleCreate(BaseModel):
    marca: str
    modelo: str
    matricula: str
    matricula_dia: int
    matricula_mes: int
    matricula_ano: int
    matricula_validade: str  # calculated based on admin config
    cor: str
    tipo: str
    km_atual: int = 0
    seguro: Optional[VehicleInsurance] = None
    disponibilidade: VehicleAvailability
    parceiro_id: Optional[str] = None

class Vehicle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    marca: str
    modelo: str
    matricula: str
    matricula_dia: int
    matricula_mes: int
    matricula_ano: int
    matricula_validade: str
    cor: str
    tipo: str
    seguro: Optional[VehicleInsurance] = None
    manutencoes: List[VehicleMaintenance] = []
    pecas: List[VehiclePart] = []
    pneus: List[VehicleTires] = []
    extintor: Optional[VehicleExtinguisher] = None
    inspecoes: List[VehicleInspection] = []
    gps: Optional[VehicleGPS] = None
    via_verde: Optional[VehicleViaVerde] = None
    cartao_combustivel: Optional[VehicleFuelCard] = None
    disponibilidade: VehicleAvailability
    tem_triangulo_colete: bool = False
    km_atual: int = 0
    km_aviso_manutencao: int = 5000  # configurable by admin
    alertas_manutencao: List[str] = []
    created_at: datetime
    updated_at: datetime
    owner_id: Optional[str] = None
    parceiro_id: Optional[str] = None

# Financial Models
class ExpenseCreate(BaseModel):
    vehicle_id: str
    tipo: str  # seguro, manutencao, combustivel, portagem, multa, etc
    descricao: str
    valor: float
    data: str
    categoria: str

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    vehicle_id: str
    tipo: str
    descricao: str
    valor: float
    data: str
    categoria: str
    created_at: datetime

class RevenueCreate(BaseModel):
    vehicle_id: str
    motorista_id: Optional[str] = None
    tipo: str  # uber, bolt, aluguer, outro
    valor: float
    data: str
    km_percorridos: Optional[int] = None

class Revenue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    vehicle_id: str
    motorista_id: Optional[str] = None
    tipo: str
    valor: float
    data: str
    km_percorridos: Optional[int] = None
    created_at: datetime

# Reports
class ROIReport(BaseModel):
    vehicle_id: str
    periodo: str
    total_receitas: float
    total_despesas: float
    roi: float
    km_percorridos: int
    utilizacao_percentual: float

# ==================== AUTH UTILITIES ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(user_id: str, email: str, role: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user_data.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["id"] = str(uuid.uuid4())
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    user_dict["approved"] = user_data.role == UserRole.ADMIN
    
    await db.users.insert_one(user_dict)
    
    user_dict.pop("password")
    if isinstance(user_dict["created_at"], str):
        user_dict["created_at"] = datetime.fromisoformat(user_dict["created_at"])
    
    return User(**user_dict)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user["role"] == UserRole.MOTORISTA and not user.get("approved", False):
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    token = create_access_token(user["id"], user["email"], user["role"])
    
    user.pop("password")
    if isinstance(user["created_at"], str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    
    return TokenResponse(access_token=token, user=User(**user))

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: Dict = Depends(get_current_user)):
    if isinstance(current_user["created_at"], str):
        current_user["created_at"] = datetime.fromisoformat(current_user["created_at"])
    return User(**current_user)

# ==================== USER PROFILE ENDPOINTS ====================

@api_router.put("/profile/update")
async def update_profile(profile_data: UserProfileUpdate, current_user: Dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No data to update")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_dict}
    )
    
    return {"message": "Profile updated successfully"}

@api_router.post("/profile/change-password")
async def change_password(password_data: ChangePasswordRequest, current_user: Dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]})
    
    if not verify_password(password_data.old_password, user["password"]):
        raise HTTPException(status_code=400, detail="Senha antiga incorreta")
    
    new_hashed = hash_password(password_data.new_password)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password": new_hashed, "senha_provisoria": False}}
    )
    
    # Update motorista record if exists
    await db.motoristas.update_one(
        {"id": current_user["id"]},
        {"$set": {"senha_provisoria": False}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/profile/permissions")
async def get_user_permissions(current_user: Dict = Depends(get_current_user)):
    role = current_user["role"]
    
    permissions = {
        UserRole.ADMIN: {
            "can_manage_users": True,
            "can_manage_all_vehicles": True,
            "can_manage_all_motoristas": True,
            "can_manage_parceiros": True,
            "can_view_all_reports": True,
            "can_configure_system": True,
            "description": "Acesso total ao sistema"
        },
        UserRole.GESTAO: {
            "can_manage_users": False,
            "can_manage_all_vehicles": True,
            "can_manage_all_motoristas": True,
            "can_manage_parceiros": True,
            "can_view_all_reports": True,
            "can_configure_system": False,
            "description": "Gestão de múltiplos parceiros e frotas"
        },
        UserRole.PARCEIRO: {
            "can_manage_users": False,
            "can_manage_all_vehicles": False,
            "can_manage_all_motoristas": False,
            "can_manage_parceiros": False,
            "can_view_all_reports": False,
            "can_configure_system": False,
            "description": "Gestão de frota atribuída e motoristas associados"
        },
        UserRole.OPERACIONAL: {
            "can_manage_users": False,
            "can_manage_all_vehicles": False,
            "can_manage_all_motoristas": False,
            "can_manage_parceiros": False,
            "can_view_all_reports": False,
            "can_configure_system": False,
            "can_manage_own_fleet": True,
            "can_set_service_levels": True,
            "description": "Gestão operacional de frota própria com níveis de serviço"
        },
        UserRole.MOTORISTA: {
            "can_manage_users": False,
            "can_manage_all_vehicles": False,
            "can_manage_all_motoristas": False,
            "can_manage_parceiros": False,
            "can_view_all_reports": False,
            "can_configure_system": False,
            "description": "Acesso a veículos atribuídos e dados pessoais"
        }
    }
    
    return {
        "role": role,
        "permissions": permissions.get(role, {}),
        "user": current_user
    }

# ==================== MOTORISTA ENDPOINTS ====================

@api_router.post("/motoristas/register", response_model=Motorista)
async def register_motorista(motorista_data: MotoristaCreate):
    existing = await db.users.find_one({"email": motorista_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate provisional password if needed
    if motorista_data.senha_provisoria or not motorista_data.password:
        provisional_pass = motorista_data.phone.replace(" ", "")[-9:]
        password_to_hash = provisional_pass
        senha_provisoria = True
    else:
        password_to_hash = motorista_data.password
        senha_provisoria = False
    
    user_dict = {
        "id": str(uuid.uuid4()),
        "email": motorista_data.email,
        "name": motorista_data.name,
        "role": UserRole.MOTORISTA,
        "password": hash_password(password_to_hash),
        "phone": motorista_data.phone,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved": False
    }
    await db.users.insert_one(user_dict)
    
    motorista_dict = motorista_data.model_dump()
    motorista_dict.pop("password", None)
    motorista_dict["id"] = user_dict["id"]
    motorista_dict["documents"] = {
        "license_photo": None, 
        "cv_file": None, 
        "profile_photo": None,
        "documento_identificacao": None,
        "licenca_tvde": None,
        "registo_criminal": None,
        "contrato": None,
        "additional_docs": []
    }
    motorista_dict["approved"] = False
    motorista_dict["senha_provisoria"] = senha_provisoria
    motorista_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.motoristas.insert_one(motorista_dict)
    
    if isinstance(motorista_dict["created_at"], str):
        motorista_dict["created_at"] = datetime.fromisoformat(motorista_dict["created_at"])
    
    return Motorista(**motorista_dict)

@api_router.post("/motoristas/{motorista_id}/upload-document")
async def upload_document(motorista_id: str, file: UploadFile = File(...), doc_type: str = Form(...)):
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    file_content = await file.read()
    file_base64 = base64.b64encode(file_content).decode('utf-8')
    
    update_field = f"documents.{doc_type}"
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {update_field: file_base64}}
    )
    
    return {"message": "Document uploaded successfully", "doc_type": doc_type}

@api_router.get("/motoristas", response_model=List[Motorista])
async def get_motoristas(current_user: Dict = Depends(get_current_user)):
    motoristas = await db.motoristas.find({}, {"_id": 0}).to_list(1000)
    for m in motoristas:
        if isinstance(m["created_at"], str):
            m["created_at"] = datetime.fromisoformat(m["created_at"])
        if m.get("approved_at") and isinstance(m["approved_at"], str):
            m["approved_at"] = datetime.fromisoformat(m["approved_at"])
    return motoristas

@api_router.put("/motoristas/{motorista_id}/approve")
async def approve_motorista(motorista_id: str, current_user: Dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTOR, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {"approved": True, "approved_by": current_user["id"], "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await db.users.update_one(
        {"id": motorista_id},
        {"$set": {"approved": True}}
    )
    
    return {"message": "Motorista approved"}

# ==================== VEHICLE ENDPOINTS ====================

@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle_data: VehicleCreate, current_user: Dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTOR, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle_dict = vehicle_data.model_dump()
    vehicle_dict["id"] = str(uuid.uuid4())
    vehicle_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    vehicle_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    vehicle_dict["owner_id"] = current_user["id"]
    vehicle_dict["manutencoes"] = []
    vehicle_dict["pecas"] = []
    vehicle_dict["pneus"] = []
    vehicle_dict["inspecoes"] = []
    vehicle_dict["tem_triangulo_colete"] = False
    vehicle_dict["km_atual"] = 0
    
    await db.vehicles.insert_one(vehicle_dict)
    
    if isinstance(vehicle_dict["created_at"], str):
        vehicle_dict["created_at"] = datetime.fromisoformat(vehicle_dict["created_at"])
    if isinstance(vehicle_dict["updated_at"], str):
        vehicle_dict["updated_at"] = datetime.fromisoformat(vehicle_dict["updated_at"])
    
    return Vehicle(**vehicle_dict)

@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(current_user: Dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["owner_id"] = current_user["id"]
    
    vehicles = await db.vehicles.find(query, {"_id": 0}).to_list(1000)
    for v in vehicles:
        if isinstance(v["created_at"], str):
            v["created_at"] = datetime.fromisoformat(v["created_at"])
        if isinstance(v["updated_at"], str):
            v["updated_at"] = datetime.fromisoformat(v["updated_at"])
    return vehicles

@api_router.get("/vehicles/available", response_model=List[Vehicle])
async def get_available_vehicles():
    vehicles = await db.vehicles.find({"disponibilidade.status": "disponivel"}, {"_id": 0}).to_list(1000)
    for v in vehicles:
        if isinstance(v["created_at"], str):
            v["created_at"] = datetime.fromisoformat(v["created_at"])
        if isinstance(v["updated_at"], str):
            v["updated_at"] = datetime.fromisoformat(v["updated_at"])
    return vehicles

@api_router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if isinstance(vehicle["created_at"], str):
        vehicle["created_at"] = datetime.fromisoformat(vehicle["created_at"])
    if isinstance(vehicle["updated_at"], str):
        vehicle["updated_at"] = datetime.fromisoformat(vehicle["updated_at"])
    
    return Vehicle(**vehicle)

@api_router.put("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, updates: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTOR, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": updates})
    return {"message": "Vehicle updated"}

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTOR]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.vehicles.delete_one({"id": vehicle_id})
    return {"message": "Vehicle deleted"}

# ==================== FINANCIAL ENDPOINTS ====================

@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense_data: ExpenseCreate, current_user: Dict = Depends(get_current_user)):
    expense_dict = expense_data.model_dump()
    expense_dict["id"] = str(uuid.uuid4())
    expense_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.expenses.insert_one(expense_dict)
    
    if isinstance(expense_dict["created_at"], str):
        expense_dict["created_at"] = datetime.fromisoformat(expense_dict["created_at"])
    
    return Expense(**expense_dict)

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(vehicle_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    query = {}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    expenses = await db.expenses.find(query, {"_id": 0}).to_list(1000)
    for e in expenses:
        if isinstance(e["created_at"], str):
            e["created_at"] = datetime.fromisoformat(e["created_at"])
    return expenses

@api_router.post("/revenues", response_model=Revenue)
async def create_revenue(revenue_data: RevenueCreate, current_user: Dict = Depends(get_current_user)):
    revenue_dict = revenue_data.model_dump()
    revenue_dict["id"] = str(uuid.uuid4())
    revenue_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.revenues.insert_one(revenue_dict)
    
    if isinstance(revenue_dict["created_at"], str):
        revenue_dict["created_at"] = datetime.fromisoformat(revenue_dict["created_at"])
    
    return Revenue(**revenue_dict)

@api_router.get("/revenues", response_model=List[Revenue])
async def get_revenues(vehicle_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    query = {}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    revenues = await db.revenues.find(query, {"_id": 0}).to_list(1000)
    for r in revenues:
        if isinstance(r["created_at"], str):
            r["created_at"] = datetime.fromisoformat(r["created_at"])
    return revenues

@api_router.get("/reports/roi/{vehicle_id}")
async def get_vehicle_roi(vehicle_id: str, periodo: str = "mensal", current_user: Dict = Depends(get_current_user)):
    revenues = await db.revenues.find({"vehicle_id": vehicle_id}, {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find({"vehicle_id": vehicle_id}, {"_id": 0}).to_list(1000)
    
    total_receitas = sum([r["valor"] for r in revenues])
    total_despesas = sum([e["valor"] for e in expenses])
    roi = total_receitas - total_despesas
    km_percorridos = sum([r.get("km_percorridos", 0) for r in revenues])
    
    return {
        "vehicle_id": vehicle_id,
        "periodo": periodo,
        "total_receitas": total_receitas,
        "total_despesas": total_despesas,
        "roi": roi,
        "km_percorridos": km_percorridos,
        "utilizacao_percentual": 0
    }

@api_router.get("/reports/dashboard")
async def get_dashboard_stats(current_user: Dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["owner_id"] = current_user["id"]
    
    total_vehicles = await db.vehicles.count_documents(query)
    available_vehicles = await db.vehicles.count_documents({**query, "disponibilidade.status": "disponivel"})
    total_motoristas = await db.motoristas.count_documents({})
    pending_motoristas = await db.motoristas.count_documents({"approved": False})
    
    revenues = await db.revenues.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    
    total_receitas = sum([r["valor"] for r in revenues])
    total_despesas = sum([e["valor"] for e in expenses])
    
    return {
        "total_vehicles": total_vehicles,
        "available_vehicles": available_vehicles,
        "total_motoristas": total_motoristas,
        "pending_motoristas": pending_motoristas,
        "total_receitas": total_receitas,
        "total_despesas": total_despesas,
        "roi": total_receitas - total_despesas
    }

# ==================== CSV IMPORT ENDPOINTS ====================

@api_router.post("/import/csv")
async def import_csv(file: UploadFile = File(...), import_type: str = Form(...), current_user: Dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTOR]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    content = await file.read()
    
    return {"message": f"CSV import for {import_type} will be processed", "filename": file.filename}

# ==================== PARCEIROS ENDPOINTS ====================

@api_router.post("/parceiros")
async def create_parceiro(parceiro_data: ParceiroCreate, current_user: Dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTOR]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    parceiro_dict = parceiro_data.model_dump()
    parceiro_dict["id"] = str(uuid.uuid4())
    parceiro_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    parceiro_dict["total_vehicles"] = 0
    
    if current_user["role"] == UserRole.GESTOR:
        parceiro_dict["gestor_associado_id"] = current_user["id"]
    
    await db.parceiros.insert_one(parceiro_dict)
    
    # Create user account for parceiro
    user_dict = {
        "id": parceiro_dict["id"],
        "email": parceiro_data.email,
        "name": parceiro_data.name,
        "role": UserRole.PARCEIRO,
        "password": hash_password("parceiro123"),  # Default password
        "phone": parceiro_data.phone,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved": True,
        "associated_gestor_id": parceiro_dict.get("gestor_associado_id")
    }
    await db.users.insert_one(user_dict)
    
    if isinstance(parceiro_dict["created_at"], str):
        parceiro_dict["created_at"] = datetime.fromisoformat(parceiro_dict["created_at"])
    
    return Parceiro(**parceiro_dict)

@api_router.get("/parceiros", response_model=List[Parceiro])
async def get_parceiros(current_user: Dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == UserRole.GESTOR:
        query["gestor_associado_id"] = current_user["id"]
    elif current_user["role"] not in [UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    parceiros = await db.parceiros.find(query, {"_id": 0}).to_list(1000)
    for p in parceiros:
        if isinstance(p["created_at"], str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
        # Count vehicles
        p["total_vehicles"] = await db.vehicles.count_documents({"parceiro_id": p["id"]})
    
    return parceiros

# ==================== DOCUMENT SEND ENDPOINTS ====================

@api_router.post("/documents/send-email")
async def send_document_email(
    document_url: str = Form(...), 
    recipient_email: str = Form(...),
    document_type: str = Form(...),
    current_user: Dict = Depends(get_current_user)
):
    # In production, implement actual email sending
    return {
        "message": "Email would be sent",
        "recipient": recipient_email,
        "document": document_type
    }

@api_router.post("/documents/send-whatsapp")
async def send_document_whatsapp(
    document_url: str = Form(...), 
    recipient_phone: str = Form(...),
    document_type: str = Form(...),
    current_user: Dict = Depends(get_current_user)
):
    # In production, implement actual WhatsApp API integration
    return {
        "message": "WhatsApp message would be sent",
        "recipient": recipient_phone,
        "document": document_type
    }

# ==================== VEHICLE MAINTENANCE DETAILED ====================

@api_router.post("/vehicles/{vehicle_id}/manutencoes")
async def add_vehicle_maintenance(
    vehicle_id: str,
    manutencao: VehicleMaintenance,
    current_user: Dict = Depends(get_current_user)
):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTOR, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    manutencao_dict = manutencao.model_dump()
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {
            "$push": {"manutencoes": manutencao_dict},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Maintenance added", "manutencao_id": manutencao.id}

@api_router.get("/vehicles/{vehicle_id}/manutencoes/{manutencao_id}")
async def get_maintenance_detail(
    vehicle_id: str,
    manutencao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    for manutencao in vehicle.get("manutencoes", []):
        if manutencao.get("id") == manutencao_id:
            return manutencao
    
    raise HTTPException(status_code=404, detail="Maintenance not found")

# ==================== ADMIN SETTINGS ====================

@api_router.get("/admin/settings")
async def get_admin_settings(current_user: Dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"id": "admin_settings"}, {"_id": 0})
    if not settings:
        # Create default settings
        default_settings = {
            "id": "admin_settings",
            "anos_validade_matricula": 20,
            "km_aviso_manutencao": 5000,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": "system"
        }
        await db.settings.insert_one(default_settings)
        settings = default_settings
    
    if isinstance(settings.get("updated_at"), str):
        settings["updated_at"] = datetime.fromisoformat(settings["updated_at"])
    
    return settings

@api_router.put("/admin/settings")
async def update_admin_settings(
    anos_validade_matricula: Optional[int] = None,
    km_aviso_manutencao: Optional[int] = None,
    current_user: Dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user["id"]}
    
    if anos_validade_matricula is not None:
        update_data["anos_validade_matricula"] = anos_validade_matricula
    
    if km_aviso_manutencao is not None:
        update_data["km_aviso_manutencao"] = km_aviso_manutencao
    
    await db.settings.update_one(
        {"id": "admin_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Settings updated", "settings": update_data}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()