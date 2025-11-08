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
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import mimetypes
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Upload directories
UPLOAD_DIR = ROOT_DIR / "uploads"
MOTORISTAS_UPLOAD_DIR = UPLOAD_DIR / "motoristas"
PAGAMENTOS_UPLOAD_DIR = UPLOAD_DIR / "pagamentos"

# Ensure directories exist
UPLOAD_DIR.mkdir(exist_ok=True)
MOTORISTAS_UPLOAD_DIR.mkdir(exist_ok=True)
PAGAMENTOS_UPLOAD_DIR.mkdir(exist_ok=True)

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

# ==================== FILE UPLOAD UTILITIES ====================

async def convert_image_to_pdf(image_path: Path, output_path: Path) -> Path:
    """Convert an image file to PDF format"""
    try:
        img = Image.open(image_path)
        
        # Convert RGBA to RGB if necessary
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        
        # Get image dimensions
        img_width, img_height = img.size
        
        # Calculate scaling to fit A4 page
        a4_width, a4_height = A4
        scale = min(a4_width / img_width, a4_height / img_height) * 0.9
        
        new_width = img_width * scale
        new_height = img_height * scale
        
        # Create PDF
        c = canvas.Canvas(str(output_path), pagesize=A4)
        
        # Center image on page
        x = (a4_width - new_width) / 2
        y = (a4_height - new_height) / 2
        
        c.drawImage(str(image_path), x, y, width=new_width, height=new_height)
        c.save()
        
        return output_path
    except Exception as e:
        logging.error(f"Error converting image to PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to convert image to PDF: {str(e)}")

async def save_uploaded_file(file: UploadFile, destination_dir: Path, filename: str) -> Path:
    """Save uploaded file to destination directory"""
    try:
        file_path = destination_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return file_path
    except Exception as e:
        logging.error(f"Error saving file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

async def process_uploaded_file(file: UploadFile, destination_dir: Path, file_id: str) -> Dict[str, str]:
    """
    Process uploaded file: save it and convert to PDF if it's an image
    Returns dict with 'original_path' and 'pdf_path' (if converted)
    """
    file_extension = Path(file.filename).suffix.lower()
    original_filename = f"{file_id}_original{file_extension}"
    
    # Save original file
    original_path = await save_uploaded_file(file, destination_dir, original_filename)
    
    result = {
        "original_path": str(original_path.relative_to(ROOT_DIR)),
        "pdf_path": None
    }
    
    # Check if file is an image
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.heic', '.heif'}
    
    if file_extension in image_extensions:
        # Convert image to PDF
        pdf_filename = f"{file_id}.pdf"
        pdf_path = destination_dir / pdf_filename
        
        await convert_image_to_pdf(original_path, pdf_path)
        result["pdf_path"] = str(pdf_path.relative_to(ROOT_DIR))
    elif file_extension == '.pdf':
        # If already PDF, just reference it
        result["pdf_path"] = result["original_path"]
    
    return result

# ==================== ALERT CHECKING UTILITIES ====================

async def check_and_create_alerts():
    """
    Check all vehicles and drivers for expiring documents/maintenance
    and create alerts if needed
    """
    from datetime import date, timedelta
    
    # Get admin settings for thresholds
    admin_settings = await db.admin_settings.find_one({"id": "admin_settings"})
    if not admin_settings:
        # Default settings
        anos_validade_matricula = 20
        km_aviso_manutencao = 5000
    else:
        anos_validade_matricula = admin_settings.get("anos_validade_matricula", 20)
        km_aviso_manutencao = admin_settings.get("km_aviso_manutencao", 5000)
    
    today = date.today()
    
    # Check vehicles
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(None)
    
    for vehicle in vehicles:
        vehicle_id = vehicle["id"]
        
        # Check registration expiry
        if vehicle.get("validade_matricula"):
            try:
                validade_date = datetime.strptime(vehicle["validade_matricula"], "%Y-%m-%d").date()
                days_until_expiry = (validade_date - today).days
                
                if 0 <= days_until_expiry <= 30:
                    # Check if alert already exists
                    existing_alert = await db.alertas.find_one({
                        "tipo": "validade_matricula",
                        "entidade_id": vehicle_id,
                        "status": "ativo"
                    })
                    
                    if not existing_alert:
                        alert = {
                            "id": str(uuid.uuid4()),
                            "tipo": "validade_matricula",
                            "entidade_id": vehicle_id,
                            "entidade_tipo": "veiculo",
                            "titulo": f"Matrícula expira em breve - {vehicle['matricula']}",
                            "descricao": f"A matrícula do veículo {vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']}) expira em {days_until_expiry} dias.",
                            "data_vencimento": vehicle["validade_matricula"],
                            "prioridade": "alta" if days_until_expiry <= 7 else "media",
                            "dias_antecedencia": 30,
                            "status": "ativo",
                            "criado_em": datetime.now(timezone.utc).isoformat()
                        }
                        await db.alertas.insert_one(alert)
            except Exception as e:
                logger.error(f"Error creating alert: {e}")
                pass
        
        # Check insurance expiry
        if vehicle.get("insurance"):
            try:
                validade_date = datetime.strptime(vehicle["insurance"]["data_validade"], "%Y-%m-%d").date()
                days_until_expiry = (validade_date - today).days
                
                if 0 <= days_until_expiry <= 30:
                    existing_alert = await db.alertas.find_one({
                        "tipo": "seguro",
                        "entidade_id": vehicle_id,
                        "status": "ativo"
                    })
                    
                    if not existing_alert:
                        alert = {
                            "id": str(uuid.uuid4()),
                            "tipo": "seguro",
                            "entidade_id": vehicle_id,
                            "entidade_tipo": "veiculo",
                            "titulo": f"Seguro expira em breve - {vehicle['matricula']}",
                            "descricao": f"O seguro do veículo {vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']}) expira em {days_until_expiry} dias.",
                            "data_vencimento": vehicle["insurance"]["data_validade"],
                            "prioridade": "alta",
                            "dias_antecedencia": 30,
                            "status": "ativo",
                            "criado_em": datetime.now(timezone.utc).isoformat()
                        }
                        await db.alertas.insert_one(alert)
            except Exception as e:
                logger.error(f"Error creating alert: {e}")
                pass
        
        # Check next inspection
        if vehicle.get("inspection"):
            try:
                proxima_date = datetime.strptime(vehicle["inspection"]["proxima_inspecao"], "%Y-%m-%d").date()
                days_until_inspection = (proxima_date - today).days
                
                if 0 <= days_until_inspection <= 30:
                    existing_alert = await db.alertas.find_one({
                        "tipo": "inspecao",
                        "entidade_id": vehicle_id,
                        "status": "ativo"
                    })
                    
                    if not existing_alert:
                        alert = {
                            "id": str(uuid.uuid4()),
                            "tipo": "inspecao",
                            "entidade_id": vehicle_id,
                            "entidade_tipo": "veiculo",
                            "titulo": f"Inspeção em breve - {vehicle['matricula']}",
                            "descricao": f"A próxima inspeção do veículo {vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']}) está marcada para {days_until_inspection} dias.",
                            "data_vencimento": vehicle["inspection"]["proxima_inspecao"],
                            "prioridade": "media",
                            "dias_antecedencia": 30,
                            "status": "ativo",
                            "criado_em": datetime.now(timezone.utc).isoformat()
                        }
                        await db.alertas.insert_one(alert)
            except Exception as e:
                logger.error(f"Error creating alert: {e}")
                pass
        
        # Check maintenance (based on km)
        if vehicle.get("maintenance_history"):
            for maintenance in vehicle["maintenance_history"]:
                if maintenance.get("km_proxima"):
                    km_atual = vehicle.get("km_atual", 0)
                    km_restantes = maintenance["km_proxima"] - km_atual
                    
                    if 0 <= km_restantes <= km_aviso_manutencao:
                        existing_alert = await db.alertas.find_one({
                            "tipo": "manutencao",
                            "entidade_id": vehicle_id,
                            "status": "ativo",
                            "descricao": {"$regex": maintenance.get("tipo_manutencao", "")}
                        })
                        
                        if not existing_alert:
                            alert = {
                                "id": str(uuid.uuid4()),
                                "tipo": "manutencao",
                                "entidade_id": vehicle_id,
                                "entidade_tipo": "veiculo",
                                "titulo": f"Manutenção necessária - {vehicle['matricula']}",
                                "descricao": f"O veículo {vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']}) precisa de {maintenance.get('tipo_manutencao', 'manutenção')} em {km_restantes} km.",
                                "data_vencimento": "",
                                "prioridade": "alta" if km_restantes <= 500 else "media",
                                "dias_antecedencia": 0,
                                "status": "ativo",
                                "criado_em": datetime.now(timezone.utc).isoformat()
                            }
                            await db.alertas.insert_one(alert)
    
    # Check motoristas
    motoristas = await db.motoristas.find({}, {"_id": 0}).to_list(None)
    
    for motorista in motoristas:
        motorista_id = motorista["id"]
        
        # Check TVDE license expiry
        if motorista.get("licenca_tvde_validade"):
            try:
                validade_date = datetime.strptime(motorista["licenca_tvde_validade"], "%Y-%m-%d").date()
                days_until_expiry = (validade_date - today).days
                
                if 0 <= days_until_expiry <= 30:
                    existing_alert = await db.alertas.find_one({
                        "tipo": "licenca_tvde",
                        "entidade_id": motorista_id,
                        "status": "ativo"
                    })
                    
                    if not existing_alert:
                        alert = {
                            "id": str(uuid.uuid4()),
                            "tipo": "licenca_tvde",
                            "entidade_id": motorista_id,
                            "entidade_tipo": "motorista",
                            "titulo": f"Licença TVDE expira em breve - {motorista['name']}",
                            "descricao": f"A licença TVDE do motorista {motorista['name']} expira em {days_until_expiry} dias.",
                            "data_vencimento": motorista["licenca_tvde_validade"],
                            "prioridade": "alta",
                            "dias_antecedencia": 30,
                            "status": "ativo",
                            "criado_em": datetime.now(timezone.utc).isoformat()
                        }
                        await db.alertas.insert_one(alert)
            except Exception as e:
                logger.error(f"Error creating alert: {e}")
                pass
        
        # Check driver's license expiry
        if motorista.get("carta_conducao_validade"):
            try:
                validade_date = datetime.strptime(motorista["carta_conducao_validade"], "%Y-%m-%d").date()
                days_until_expiry = (validade_date - today).days
                
                if 0 <= days_until_expiry <= 30:
                    existing_alert = await db.alertas.find_one({
                        "tipo": "carta_conducao",
                        "entidade_id": motorista_id,
                        "status": "ativo"
                    })
                    
                    if not existing_alert:
                        alert = {
                            "id": str(uuid.uuid4()),
                            "tipo": "carta_conducao",
                            "entidade_id": motorista_id,
                            "entidade_tipo": "motorista",
                            "titulo": f"Carta de condução expira em breve - {motorista['name']}",
                            "descricao": f"A carta de condução do motorista {motorista['name']} expira em {days_until_expiry} dias.",
                            "data_vencimento": motorista["carta_conducao_validade"],
                            "prioridade": "alta",
                            "dias_antecedencia": 30,
                            "status": "ativo",
                            "criado_em": datetime.now(timezone.utc).isoformat()
                        }
                        await db.alertas.insert_one(alert)
            except Exception as e:
                logger.error(f"Error creating alert: {e}")
                pass

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

# Parceiro Model - EXPANDED
class ParceiroCreate(BaseModel):
    nome_empresa: str
    contribuinte_empresa: str  # NIF da empresa
    morada_completa: str
    codigo_postal: str  # Formato: xxxx-xxx
    localidade: str
    nome_manager: str
    telefone: str
    telemovel: str
    email: EmailStr
    codigo_certidao_comercial: str
    validade_certidao_comercial: str  # Data validade
    gestor_associado_id: Optional[str] = None

class Parceiro(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    nome_empresa: str
    contribuinte_empresa: str
    morada_completa: str
    codigo_postal: str
    localidade: str
    nome_manager: str
    telefone: str
    telemovel: str
    email: str
    codigo_certidao_comercial: str
    validade_certidao_comercial: str
    gestor_associado_id: Optional[str] = None
    total_vehicles: int = 0
    campos_customizados: Dict[str, Any] = {}  # Campos adicionais customizáveis
    created_at: datetime
    # Campos antigos mantidos como opcionais para compatibilidade
    name: Optional[str] = None
    phone: Optional[str] = None
    empresa: Optional[str] = None
    nif: Optional[str] = None
    morada: Optional[str] = None

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
    subscription_id: Optional[str] = None  # ID da subscrição ativa
    campos_customizados: Dict[str, Any] = {}  # Campos adicionais customizáveis

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

# Motorista Models - EXPANDED
class MotoristaDocuments(BaseModel):
    # Documentos principais com foto (convertidos para PDF)
    cartao_cidadao_foto: Optional[str] = None  # Cartão de Cidadão (foto)
    carta_conducao_foto: Optional[str] = None  # Carta de Condução (foto)
    licenca_tvde_foto: Optional[str] = None    # Licença TVDE (foto)
    comprovativo_morada: Optional[str] = None  # Comprovativo de morada
    iban_comprovativo: Optional[str] = None    # Comprovativo de IBAN
    # Documentos antigos (mantidos para compatibilidade)
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
    campos_customizados: Dict[str, Any] = {}  # Campos adicionais customizáveis
    created_at: datetime
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

# Vehicle Models - COMPLETE EXPANDED
class TipoContrato(BaseModel):
    tipo: str  # aluguer, comissao, motorista_privado
    valor_aluguer: Optional[float] = None
    comissao_parceiro: Optional[float] = None  # % da comissão para o parceiro
    comissao_motorista: Optional[float] = None  # % da comissão para o motorista (soma deve ser 100%)
    inclui_combustivel: bool = False
    inclui_via_verde: bool = False
    regime: Optional[str] = None  # full_time, part_time
    # Part-time: 4 turnos livres configuráveis (opcionais)
    horario_turno_1: Optional[str] = None  # Ex: "09:00-13:00"
    horario_turno_2: Optional[str] = None  # Ex: "14:00-18:00"
    horario_turno_3: Optional[str] = None  # Ex: "19:00-23:00"
    horario_turno_4: Optional[str] = None  # Ex: "00:00-06:00"

class CategoriasUber(BaseModel):
    uberx: bool = False
    share: bool = False
    electric: bool = False
    black: bool = False
    comfort: bool = False
    xl: bool = False
    xxl: bool = False
    pet: bool = False
    package: bool = False

class CategoriasBolt(BaseModel):
    economy: bool = False
    comfort: bool = False
    executive: bool = False
    xl: bool = False
    green: bool = False
    xxl: bool = False
    motorista_privado: bool = False
    pet: bool = False

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

class VehicleAvailability(BaseModel):
    status: str  # disponivel, atribuido, manutencao, seguro, sinistro, venda
    motoristas_atribuidos: List[str] = []
    data_entrega_manutencao: Optional[str] = None
    tipo_manutencao: Optional[str] = None

class VehicleCreate(BaseModel):
    marca: str
    modelo: str
    matricula: str
    data_matricula: str
    validade_matricula: str
    cor: str
    combustivel: str  # gasolina, diesel, eletrico, hibrido, gnv
    caixa: str  # manual, automatica
    lugares: int
    tipo_contrato: TipoContrato
    categorias_uber: CategoriasUber
    categorias_bolt: CategoriasBolt
    via_verde_disponivel: bool = False
    cartao_frota_disponivel: bool = False
    parceiro_id: str

class Vehicle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    marca: str
    modelo: str
    matricula: str
    data_matricula: str
    validade_matricula: str
    alerta_validade: bool = False  # True se falta menos de 30 dias
    cor: str
    combustivel: str
    caixa: str
    lugares: int
    tipo_contrato: TipoContrato
    categorias_uber: CategoriasUber
    categorias_bolt: CategoriasBolt
    via_verde_disponivel: bool = False
    cartao_frota_disponivel: bool = False
    seguro: Optional[VehicleInsurance] = None
    manutencoes: List[VehicleMaintenance] = []
    extintor: Optional[VehicleExtinguisher] = None
    inspecoes: List[VehicleInspection] = []
    disponibilidade: VehicleAvailability
    km_atual: int = 0
    km_aviso_manutencao: int = 5000
    alertas_manutencao: List[str] = []
    fotos: List[str] = []  # URLs das fotos (máximo 3, convertidas para PDF)
    caucao: Optional[CaucaoVeiculo] = None  # Caução do veículo
    campos_customizados: Dict[str, Any] = {}  # Campos adicionais customizáveis
    created_at: datetime
    updated_at: datetime
    parceiro_id: str

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

# Pagamentos Models
class PagamentoCreate(BaseModel):
    motorista_id: str
    valor: float
    periodo_inicio: str
    periodo_fim: str
    tipo_documento: str  # fatura, recibo_verde, outro
    notas: Optional[str] = None

class Pagamento(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    motorista_id: str
    parceiro_id: str
    valor: float
    periodo_inicio: str
    periodo_fim: str
    tipo_documento: str
    documento_url: Optional[str] = None
    documento_analisado: bool = False
    analise_documento: Optional[Dict[str, Any]] = None

# ==================== SUBSCRIPTION MODELS ====================

class PlanoAssinatura(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    nome: str  # Ex: "Parceiro Base", "Operacional Premium"
    tipo_usuario: str  # "parceiro", "operacional"
    preco_por_unidade: float  # Por veículo (parceiro) ou por motorista (operacional)
    descricao: str
    features: List[str]  # Lista de features habilitadas
    ativo: bool = True
    created_at: datetime
    updated_at: datetime

class PlanoCreate(BaseModel):
    nome: str
    tipo_usuario: str
    preco_por_unidade: float
    descricao: str
    features: List[str]

class UserSubscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    plano_id: str
    status: str  # "ativo", "cancelado", "suspenso", "pagamento_pendente"
    data_inicio: str
    data_fim: Optional[str] = None
    unidades_ativas: int = 0  # Número de veículos (parceiro) ou motoristas (operacional)
    valor_mensal: float = 0.0  # Calculado: preco_por_unidade * unidades_ativas
    created_at: datetime
    updated_at: datetime

class SubscriptionCreate(BaseModel):
    user_id: str
    plano_id: str

# Caução Model (para veículos)
class CaucaoVeiculo(BaseModel):
    caucao_total: float = 0.0
    caucao_divisao: str = "total"  # "semanal", "mensal", "total"
    caucao_valor_semanal: float = 0.0  # Calculado automaticamente
    caucao_pago: float = 0.0
    caucao_restante: float = 0.0  # Calculado automaticamente

# Alertas Models
class AlertaCreate(BaseModel):
    tipo: str  # seguro, inspecao, licenca_tvde, manutencao, validade_matricula
    entidade_id: str  # vehicle_id or motorista_id
    entidade_tipo: str  # veiculo, motorista
    titulo: str
    descricao: str
    data_vencimento: str
    prioridade: str  # alta, media, baixa
    dias_antecedencia: int = 30

class Alerta(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    tipo: str
    entidade_id: str
    entidade_tipo: str
    titulo: str
    descricao: str
    data_vencimento: str
    prioridade: str
    dias_antecedencia: int
    status: str  # ativo, resolvido, ignorado
    criado_em: datetime
    resolvido_em: Optional[datetime] = None

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

async def check_feature_access(user: Dict, feature_name: str) -> bool:
    """Check if user has access to a specific feature based on their subscription"""
    # Admin always has access
    if user["role"] == UserRole.ADMIN:
        return True
    
    # Get user's subscription
    subscription_id = user.get("subscription_id")
    if not subscription_id:
        # No subscription = no access to premium features
        return False
    
    subscription = await db.subscriptions.find_one({"id": subscription_id, "status": "ativo"}, {"_id": 0})
    if not subscription:
        return False
    
    # Get plan features
    plano = await db.planos.find_one({"id": subscription["plano_id"]}, {"_id": 0})
    if not plano:
        return False
    
    return feature_name in plano.get("features", [])

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
async def upload_document(
    motorista_id: str, 
    file: UploadFile = File(...), 
    doc_type: str = Form(...),
    current_user: Dict = Depends(get_current_user)
):
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Process file: save and convert to PDF if image
    file_id = f"{motorista_id}_{doc_type}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, MOTORISTAS_UPLOAD_DIR, file_id)
    
    # Store file path in database (prefer PDF version if available)
    file_url = file_info["pdf_path"] if file_info["pdf_path"] else file_info["original_path"]
    
    update_field = f"documents.{doc_type}"
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {update_field: file_url}}
    )
    
    return {
        "message": "Document uploaded successfully",
        "doc_type": doc_type,
        "file_url": file_url,
        "converted_to_pdf": file_info["pdf_path"] is not None
    }

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
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
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
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle_dict = vehicle_data.model_dump()
    vehicle_dict["id"] = str(uuid.uuid4())
    vehicle_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    vehicle_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Calculate alerta_validade (30 days before expiry)
    validade = datetime.fromisoformat(vehicle_data.validade_matricula).replace(tzinfo=timezone.utc)
    dias_restantes = (validade - datetime.now(timezone.utc)).days
    vehicle_dict["alerta_validade"] = dias_restantes <= 30
    
    vehicle_dict["manutencoes"] = []
    vehicle_dict["inspecoes"] = []
    vehicle_dict["km_atual"] = 0
    vehicle_dict["km_aviso_manutencao"] = 5000
    vehicle_dict["alertas_manutencao"] = []
    vehicle_dict["disponibilidade"] = {
        "status": "disponivel",
        "motoristas_atribuidos": [],
        "data_entrega_manutencao": None,
        "tipo_manutencao": None
    }
    
    # Set parceiro_id from current user if parceiro/operacional
    if current_user["role"] in [UserRole.PARCEIRO, UserRole.OPERACIONAL]:
        vehicle_dict["parceiro_id"] = current_user["id"]
    
    await db.vehicles.insert_one(vehicle_dict)
    
    if isinstance(vehicle_dict["created_at"], str):
        vehicle_dict["created_at"] = datetime.fromisoformat(vehicle_dict["created_at"])
    if isinstance(vehicle_dict["updated_at"], str):
        vehicle_dict["updated_at"] = datetime.fromisoformat(vehicle_dict["updated_at"])
    
    return Vehicle(**vehicle_dict)

@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(current_user: Dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] in [UserRole.PARCEIRO, UserRole.OPERACIONAL]:
        query["parceiro_id"] = current_user["id"]
    
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
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": updates})
    return {"message": "Vehicle updated"}

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.vehicles.delete_one({"id": vehicle_id})
    return {"message": "Vehicle deleted"}

@api_router.post("/vehicles/{vehicle_id}/upload-photo")
async def upload_vehicle_photo(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload vehicle photo (max 3 photos, converted to PDF)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if vehicle exists
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check photo limit (max 3)
    current_photos = vehicle.get("fotos", [])
    if len(current_photos) >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 photos allowed per vehicle")
    
    # Process file: save and convert to PDF
    file_id = f"vehicle_{vehicle_id}_photo_{len(current_photos) + 1}_{uuid.uuid4()}"
    
    # Create vehicle photos directory if not exists
    vehicle_photos_dir = UPLOAD_DIR / "vehicles"
    vehicle_photos_dir.mkdir(exist_ok=True)
    
    file_info = await process_uploaded_file(file, vehicle_photos_dir, file_id)
    
    # Store PDF path in database
    photo_url = file_info["pdf_path"] if file_info["pdf_path"] else file_info["original_path"]
    
    # Update vehicle with new photo
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$push": {"fotos": photo_url}}
    )
    
    return {
        "message": "Photo uploaded successfully",
        "photo_url": photo_url,
        "converted_to_pdf": file_info["pdf_path"] is not None,
        "total_photos": len(current_photos) + 1
    }

@api_router.delete("/vehicles/{vehicle_id}/photos/{photo_index}")
async def delete_vehicle_photo(
    vehicle_id: str,
    photo_index: int,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a vehicle photo by index (0-2)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    fotos = vehicle.get("fotos", [])
    if photo_index < 0 or photo_index >= len(fotos):
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Remove photo from array
    photo_to_remove = fotos[photo_index]
    fotos.pop(photo_index)
    
    # Update database
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"fotos": fotos}}
    )
    
    # Try to delete file from disk
    try:
        photo_path = ROOT_DIR / photo_to_remove
        if photo_path.exists():
            photo_path.unlink()
    except Exception as e:
        logger.error(f"Error deleting photo file: {e}")
    
    return {"message": "Photo deleted successfully"}

# ==================== FINANCIAL ENDPOINTS ====================

@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense_data: ExpenseCreate, current_user: Dict = Depends(get_current_user)):
    # Parceiros não podem criar despesas - apenas visualizar e confirmar pagamentos
    if current_user["role"] == UserRole.PARCEIRO:
        raise HTTPException(
            status_code=403, 
            detail="Parceiros não podem criar despesas. Apenas confirmar pagamentos."
        )
    
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
    # Parceiros não podem criar receitas - apenas visualizar e confirmar valores recebidos
    if current_user["role"] == UserRole.PARCEIRO:
        raise HTTPException(
            status_code=403, 
            detail="Parceiros não podem criar receitas. Apenas confirmar valores recebidos."
        )
    
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

# ==================== PARCEIRO REPORTS ENDPOINTS ====================

@api_router.get("/reports/parceiro/semanal")
async def get_parceiro_weekly_report(current_user: Dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.PARCEIRO:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get vehicles do parceiro
    vehicles = await db.vehicles.find({"parceiro_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(1000)
    vehicle_ids = [v["id"] for v in vehicles]
    
    # Get data from last 7 days
    from datetime import datetime, timedelta
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    
    # Revenues
    revenues = await db.revenues.find({
        "vehicle_id": {"$in": vehicle_ids},
        "data": {"$gte": seven_days_ago}
    }, {"_id": 0}).to_list(10000)
    
    # Expenses
    expenses = await db.expenses.find({
        "vehicle_id": {"$in": vehicle_ids},
        "data": {"$gte": seven_days_ago}
    }, {"_id": 0}).to_list(10000)
    
    total_ganhos = sum([r["valor"] for r in revenues])
    total_gastos = sum([e["valor"] for e in expenses])
    lucro = total_ganhos - total_gastos
    
    return {
        "periodo": "ultima_semana",
        "total_ganhos": total_ganhos,
        "total_gastos": total_gastos,
        "lucro": lucro,
        "roi_percentual": (lucro / total_ganhos * 100) if total_ganhos > 0 else 0
    }

@api_router.get("/reports/parceiro/por-veiculo")
async def get_parceiro_vehicle_report(current_user: Dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.PARCEIRO:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicles = await db.vehicles.find({"parceiro_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    report = []
    for vehicle in vehicles:
        revenues = await db.revenues.find({"vehicle_id": vehicle["id"]}, {"_id": 0}).to_list(10000)
        expenses = await db.expenses.find({"vehicle_id": vehicle["id"]}, {"_id": 0}).to_list(10000)
        
        total_ganhos = sum([r["valor"] for r in revenues])
        total_gastos = sum([e["valor"] for e in expenses])
        
        report.append({
            "vehicle_id": vehicle["id"],
            "marca": vehicle["marca"],
            "modelo": vehicle["modelo"],
            "matricula": vehicle["matricula"],
            "total_ganhos": total_ganhos,
            "total_gastos": total_gastos,
            "lucro": total_ganhos - total_gastos
        })
    
    return report

@api_router.get("/reports/parceiro/por-motorista")
async def get_parceiro_motorista_report(current_user: Dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.PARCEIRO:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get vehicles do parceiro
    vehicles = await db.vehicles.find({"parceiro_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(1000)
    vehicle_ids = [v["id"] for v in vehicles]
    
    # Get all revenues with motorista
    revenues = await db.revenues.find({
        "vehicle_id": {"$in": vehicle_ids},
        "motorista_id": {"$ne": None}
    }, {"_id": 0}).to_list(10000)
    
    # Group by motorista
    motorista_totals = {}
    for rev in revenues:
        mid = rev["motorista_id"]
        if mid not in motorista_totals:
            motorista_totals[mid] = {"ganhos": 0, "corridas": 0}
        motorista_totals[mid]["ganhos"] += rev["valor"]
        motorista_totals[mid]["corridas"] += 1
    
    # Get motorista details
    report = []
    for mid, data in motorista_totals.items():
        motorista = await db.motoristas.find_one({"id": mid}, {"_id": 0})
        if motorista:
            # Calculate lucro (assuming commission split)
            lucro_parceiro = data["ganhos"] * 0.2  # Example: 20% for parceiro
            
            report.append({
                "motorista_id": mid,
                "nome": motorista["name"],
                "email": motorista["email"],
                "total_ganhos": data["ganhos"],
                "total_corridas": data["corridas"],
                "lucro_parceiro": lucro_parceiro
            })
    
    return report

@api_router.get("/reports/parceiro/proximas-despesas")
async def get_parceiro_upcoming_expenses(current_user: Dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.PARCEIRO:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    from datetime import datetime, timedelta
    
    vehicles = await db.vehicles.find({"parceiro_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    upcoming = []
    today = datetime.now()
    
    for vehicle in vehicles:
        # Check seguro
        if vehicle.get("seguro") and vehicle["seguro"].get("data_validade"):
            validade = datetime.fromisoformat(vehicle["seguro"]["data_validade"])
            if validade > today and (validade - today).days <= 60:
                upcoming.append({
                    "tipo": "seguro",
                    "veiculo": f"{vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']})",
                    "descricao": f"Renovação seguro - {vehicle['seguro']['seguradora']}",
                    "valor": vehicle["seguro"]["preco"],
                    "data": vehicle["seguro"]["data_validade"],
                    "dias_restantes": (validade - today).days
                })
        
        # Check matricula validade
        if vehicle.get("validade_matricula"):
            validade = datetime.fromisoformat(vehicle["validade_matricula"])
            if validade > today and (validade - today).days <= 60:
                upcoming.append({
                    "tipo": "matricula",
                    "veiculo": f"{vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']})",
                    "descricao": "Renovação matrícula",
                    "valor": 50.00,  # Estimativa
                    "data": vehicle["validade_matricula"],
                    "dias_restantes": (validade - today).days
                })
        
        # Check manutencoes agendadas
        for manutencao in vehicle.get("manutencoes", []):
            if manutencao.get("data_proxima"):
                data_proxima = datetime.fromisoformat(manutencao["data_proxima"])
                if data_proxima > today and (data_proxima - today).days <= 30:
                    upcoming.append({
                        "tipo": "manutencao",
                        "veiculo": f"{vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']})",
                        "descricao": manutencao.get("o_que_fazer", "Manutenção agendada"),
                        "valor": manutencao.get("custos", 0),
                        "data": manutencao["data_proxima"],
                        "dias_restantes": (data_proxima - today).days
                    })
    
    # Sort by dias_restantes
    upcoming.sort(key=lambda x: x["dias_restantes"])
    
    return upcoming

# ==================== PAGAMENTOS ENDPOINTS ====================

@api_router.post("/pagamentos", response_model=Pagamento)
async def create_pagamento(pagamento_data: PagamentoCreate, current_user: Dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.PARCEIRO:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pagamento_dict = pagamento_data.model_dump()
    pagamento_dict["id"] = str(uuid.uuid4())
    pagamento_dict["parceiro_id"] = current_user["id"]
    pagamento_dict["documento_url"] = None
    pagamento_dict["documento_analisado"] = False
    pagamento_dict["analise_documento"] = None
    pagamento_dict["status"] = "pendente"
    pagamento_dict["pago_em"] = None
    pagamento_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.pagamentos.insert_one(pagamento_dict)
    
    if isinstance(pagamento_dict["created_at"], str):
        pagamento_dict["created_at"] = datetime.fromisoformat(pagamento_dict["created_at"])
    
    return Pagamento(**pagamento_dict)

@api_router.post("/pagamentos/{pagamento_id}/upload-documento")
async def upload_pagamento_documento(
    pagamento_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.PARCEIRO:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pagamento = await db.pagamentos.find_one({"id": pagamento_id, "parceiro_id": current_user["id"]})
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento not found")
    
    # Process file: save and convert to PDF if image
    file_id = f"pagamento_{pagamento_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, PAGAMENTOS_UPLOAD_DIR, file_id)
    
    # Store file path in database (prefer PDF version if available)
    file_url = file_info["pdf_path"] if file_info["pdf_path"] else file_info["original_path"]
    
    # Mock document analysis (in production, use OCR/AI service)
    analise = {
        "tipo_detectado": pagamento["tipo_documento"],
        "valor_detectado": pagamento["valor"],
        "confianca": 0.95,
        "campos_extraidos": {
            "nif": "123456789",
            "nome": "Motorista",
            "valor": pagamento["valor"],
            "data": datetime.now().strftime('%Y-%m-%d')
        }
    }
    
    await db.pagamentos.update_one(
        {"id": pagamento_id},
        {
            "$set": {
                "documento_url": file_url,
                "documento_analisado": True,
                "analise_documento": analise
            }
        }
    )
    
    return {
        "message": "Documento carregado e analisado",
        "analise": analise,
        "file_url": file_url,
        "converted_to_pdf": file_info["pdf_path"] is not None
    }

@api_router.put("/pagamentos/{pagamento_id}/marcar-pago")
async def marcar_pagamento_pago(pagamento_id: str, current_user: Dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.PARCEIRO:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.pagamentos.update_one(
        {"id": pagamento_id, "parceiro_id": current_user["id"]},
        {
            "$set": {
                "status": "pago",
                "pago_em": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Pagamento not found")
    
    return {"message": "Pagamento marcado como pago"}

@api_router.get("/pagamentos/semana-atual")
async def get_pagamentos_semana(current_user: Dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.PARCEIRO:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    from datetime import datetime, timedelta
    
    # Get current week
    today = datetime.now()
    start_week = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
    end_week = (today + timedelta(days=6-today.weekday())).strftime('%Y-%m-%d')
    
    pagamentos = await db.pagamentos.find({
        "parceiro_id": current_user["id"],
        "periodo_fim": {"$gte": start_week, "$lte": end_week}
    }, {"_id": 0}).to_list(1000)
    
    for p in pagamentos:
        if isinstance(p.get("created_at"), str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
        if p.get("pago_em") and isinstance(p["pago_em"], str):
            p["pago_em"] = datetime.fromisoformat(p["pago_em"])
        
        # Get motorista info
        motorista = await db.motoristas.find_one({"id": p["motorista_id"]}, {"_id": 0, "name": 1, "email": 1})
        if motorista:
            p["motorista_nome"] = motorista["name"]
    
    total_pagar = sum([p["valor"] for p in pagamentos if p["status"] == "pendente"])
    total_pago = sum([p["valor"] for p in pagamentos if p["status"] == "pago"])
    
    return {
        "pagamentos": pagamentos,
        "total_pagar": total_pagar,
        "total_pago": total_pago,
        "periodo": f"{start_week} a {end_week}"
    }

# ==================== CSV IMPORT ENDPOINTS ====================

@api_router.post("/import/csv")
async def import_csv(file: UploadFile = File(...), import_type: str = Form(...), current_user: Dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # TODO: Implement CSV parsing and import logic
    # content = await file.read()
    
    return {"message": f"CSV import for {import_type} will be processed", "filename": file.filename}

# ==================== PARCEIROS ENDPOINTS ====================

@api_router.post("/parceiros")
async def create_parceiro(parceiro_data: ParceiroCreate, current_user: Dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    parceiro_dict = parceiro_data.model_dump()
    parceiro_dict["id"] = str(uuid.uuid4())
    parceiro_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    parceiro_dict["total_vehicles"] = 0
    
    if current_user["role"] == UserRole.GESTAO:
        parceiro_dict["gestor_associado_id"] = current_user["id"]
    
    await db.parceiros.insert_one(parceiro_dict)
    
    # Create user account for parceiro
    user_dict = {
        "id": parceiro_dict["id"],
        "email": parceiro_data.email,
        "name": parceiro_data.nome_manager,  # Use nome_manager as the user name
        "role": UserRole.PARCEIRO,
        "password": hash_password("parceiro123"),  # Default password
        "phone": parceiro_data.telefone,  # Use telefone as the phone
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
    if current_user["role"] == UserRole.GESTAO:
        query["gestor_associado_id"] = current_user["id"]
    elif current_user["role"] not in [UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    parceiros = await db.parceiros.find(query, {"_id": 0}).to_list(1000)
    for p in parceiros:
        if isinstance(p["created_at"], str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
        
        # Backward compatibility: map old fields to new fields if new fields are missing
        if "nome_empresa" not in p and "empresa" in p:
            p["nome_empresa"] = p["empresa"]
        if "contribuinte_empresa" not in p and "nif" in p:
            p["contribuinte_empresa"] = p["nif"]
        if "morada_completa" not in p and "morada" in p:
            p["morada_completa"] = p["morada"]
        if "codigo_postal" not in p:
            p["codigo_postal"] = "0000-000"  # Default value
        if "localidade" not in p:
            p["localidade"] = "N/A"  # Default value
        if "nome_manager" not in p and "name" in p:
            p["nome_manager"] = p["name"]
        if "telefone" not in p and "phone" in p:
            p["telefone"] = p["phone"]
        if "telemovel" not in p:
            p["telemovel"] = p.get("phone", "N/A")  # Use phone as fallback
        if "email" not in p:
            p["email"] = "noemail@example.com"  # Default value
        if "codigo_certidao_comercial" not in p:
            p["codigo_certidao_comercial"] = "N/A"  # Default value
        if "validade_certidao_comercial" not in p:
            p["validade_certidao_comercial"] = "2099-12-31"  # Default future date
        
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
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
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

# ==================== SUBSCRIPTION/PLANOS ENDPOINTS ====================

@api_router.post("/admin/planos", response_model=PlanoAssinatura)
async def create_plano(plano_data: PlanoCreate, current_user: Dict = Depends(get_current_user)):
    """Admin: Create new subscription plan"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    plano_dict = plano_data.model_dump()
    plano_dict["id"] = str(uuid.uuid4())
    plano_dict["ativo"] = True
    plano_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    plano_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.planos.insert_one(plano_dict)
    
    if isinstance(plano_dict["created_at"], str):
        plano_dict["created_at"] = datetime.fromisoformat(plano_dict["created_at"])
    if isinstance(plano_dict["updated_at"], str):
        plano_dict["updated_at"] = datetime.fromisoformat(plano_dict["updated_at"])
    
    return PlanoAssinatura(**plano_dict)

@api_router.get("/admin/planos", response_model=List[PlanoAssinatura])
async def get_planos(current_user: Dict = Depends(get_current_user)):
    """Admin: Get all subscription plans"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    planos = await db.planos.find({}, {"_id": 0}).to_list(100)
    
    for plano in planos:
        if isinstance(plano["created_at"], str):
            plano["created_at"] = datetime.fromisoformat(plano["created_at"])
        if isinstance(plano["updated_at"], str):
            plano["updated_at"] = datetime.fromisoformat(plano["updated_at"])
    
    return planos

@api_router.put("/admin/planos/{plano_id}")
async def update_plano(
    plano_id: str,
    updates: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Admin: Update subscription plan"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.planos.update_one(
        {"id": plano_id},
        {"$set": updates}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Plano not found")
    
    return {"message": "Plano updated successfully"}

@api_router.get("/planos/public", response_model=List[PlanoAssinatura])
async def get_public_planos(tipo_usuario: Optional[str] = None):
    """Public: Get active subscription plans (no auth required)"""
    query = {"ativo": True}
    if tipo_usuario:
        query["tipo_usuario"] = tipo_usuario
    
    planos = await db.planos.find(query, {"_id": 0}).to_list(100)
    
    for plano in planos:
        if isinstance(plano["created_at"], str):
            plano["created_at"] = datetime.fromisoformat(plano["created_at"])
        if isinstance(plano["updated_at"], str):
            plano["updated_at"] = datetime.fromisoformat(plano["updated_at"])
    
    return planos

@api_router.post("/subscriptions", response_model=UserSubscription)
async def create_subscription(
    subscription_data: SubscriptionCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create or update user subscription"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        # Users can only subscribe themselves
        if subscription_data.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if plan exists
    plano = await db.planos.find_one({"id": subscription_data.plano_id}, {"_id": 0})
    if not plano:
        raise HTTPException(status_code=404, detail="Plano not found")
    
    # Check if user already has a subscription
    existing = await db.subscriptions.find_one({"user_id": subscription_data.user_id, "status": "ativo"})
    
    if existing:
        # Update existing subscription
        await db.subscriptions.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "plano_id": subscription_data.plano_id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Update user's subscription_id
        await db.users.update_one(
            {"id": subscription_data.user_id},
            {"$set": {"subscription_id": existing["id"]}}
        )
        
        return UserSubscription(**{**existing, "plano_id": subscription_data.plano_id})
    
    # Create new subscription
    subscription_dict = {
        "id": str(uuid.uuid4()),
        "user_id": subscription_data.user_id,
        "plano_id": subscription_data.plano_id,
        "status": "ativo",
        "data_inicio": datetime.now().strftime("%Y-%m-%d"),
        "data_fim": None,
        "unidades_ativas": 0,
        "valor_mensal": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.subscriptions.insert_one(subscription_dict)
    
    # Update user's subscription_id
    await db.users.update_one(
        {"id": subscription_data.user_id},
        {"$set": {"subscription_id": subscription_dict["id"]}}
    )
    
    if isinstance(subscription_dict["created_at"], str):
        subscription_dict["created_at"] = datetime.fromisoformat(subscription_dict["created_at"])
    if isinstance(subscription_dict["updated_at"], str):
        subscription_dict["updated_at"] = datetime.fromisoformat(subscription_dict["updated_at"])
    
    return UserSubscription(**subscription_dict)

@api_router.get("/subscriptions/me", response_model=Dict[str, Any])
async def get_my_subscription(current_user: Dict = Depends(get_current_user)):
    """Get current user's subscription details"""
    subscription_id = current_user.get("subscription_id")
    
    if not subscription_id:
        return {
            "has_subscription": False,
            "message": "Nenhuma subscrição ativa"
        }
    
    subscription = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not subscription:
        return {
            "has_subscription": False,
            "message": "Subscrição não encontrada"
        }
    
    # Get plan details
    plano = await db.planos.find_one({"id": subscription["plano_id"]}, {"_id": 0})
    
    if isinstance(subscription.get("created_at"), str):
        subscription["created_at"] = datetime.fromisoformat(subscription["created_at"])
    if isinstance(subscription.get("updated_at"), str):
        subscription["updated_at"] = datetime.fromisoformat(subscription["updated_at"])
    
    return {
        "has_subscription": True,
        "subscription": subscription,
        "plano": plano
    }

@api_router.put("/subscriptions/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Cancel a subscription"""
    subscription = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Only admin, gestor, or the subscription owner can cancel
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        if subscription["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.subscriptions.update_one(
        {"id": subscription_id},
        {
            "$set": {
                "status": "cancelado",
                "data_fim": datetime.now().strftime("%Y-%m-%d"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Subscription cancelled successfully"}

# ==================== ALERTAS ENDPOINTS ====================

@api_router.get("/alertas", response_model=List[Alerta])
async def get_alertas(
    status: Optional[str] = "ativo",
    prioridade: Optional[str] = None,
    tipo: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Get all active alerts"""
    query = {}
    
    if status:
        query["status"] = status
    if prioridade:
        query["prioridade"] = prioridade
    if tipo:
        query["tipo"] = tipo
    
    alertas = await db.alertas.find(query, {"_id": 0}).sort("criado_em", -1).to_list(1000)
    
    for alerta in alertas:
        if isinstance(alerta["criado_em"], str):
            alerta["criado_em"] = datetime.fromisoformat(alerta["criado_em"])
        if alerta.get("resolvido_em") and isinstance(alerta["resolvido_em"], str):
            alerta["resolvido_em"] = datetime.fromisoformat(alerta["resolvido_em"])
    
    return alertas

@api_router.post("/alertas/verificar")
async def verificar_alertas(current_user: Dict = Depends(get_current_user)):
    """Manually trigger alert checking"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await check_and_create_alerts()
    
    return {"message": "Alertas verificados e atualizados"}

@api_router.put("/alertas/{alerta_id}/resolver")
async def resolver_alerta(alerta_id: str, current_user: Dict = Depends(get_current_user)):
    """Mark an alert as resolved"""
    result = await db.alertas.update_one(
        {"id": alerta_id},
        {
            "$set": {
                "status": "resolvido",
                "resolvido_em": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alerta not found")
    
    return {"message": "Alerta marcado como resolvido"}

@api_router.put("/alertas/{alerta_id}/ignorar")
async def ignorar_alerta(alerta_id: str, current_user: Dict = Depends(get_current_user)):
    """Mark an alert as ignored"""
    result = await db.alertas.update_one(
        {"id": alerta_id},
        {"$set": {"status": "ignorado"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alerta not found")
    
    return {"message": "Alerta ignorado"}

@api_router.get("/alertas/dashboard-stats")
async def get_alertas_stats(current_user: Dict = Depends(get_current_user)):
    """Get alert statistics for dashboard"""
    alertas_ativos = await db.alertas.count_documents({"status": "ativo"})
    alertas_alta_prioridade = await db.alertas.count_documents({"status": "ativo", "prioridade": "alta"})
    
    # Get count by type
    tipos = ["seguro", "inspecao", "licenca_tvde", "manutencao", "validade_matricula", "carta_conducao"]
    por_tipo = {}
    
    for tipo in tipos:
        count = await db.alertas.count_documents({"status": "ativo", "tipo": tipo})
        por_tipo[tipo] = count
    
    return {
        "total_ativos": alertas_ativos,
        "alta_prioridade": alertas_alta_prioridade,
        "por_tipo": por_tipo
    }

# ==================== FILE SERVING ENDPOINT ====================
from fastapi.responses import FileResponse

@api_router.get("/files/{folder}/{filename}")
async def serve_file(folder: str, filename: str, current_user: Dict = Depends(get_current_user)):
    """Serve uploaded files"""
    allowed_folders = ["motoristas", "pagamentos", "vehicles"]
    
    if folder not in allowed_folders:
        raise HTTPException(status_code=400, detail="Invalid folder")
    
    file_path = UPLOAD_DIR / folder / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)

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

# Background task for checking alerts
import asyncio
from typing import AsyncGenerator

async def check_alerts_periodically():
    """Background task to check alerts every 6 hours"""
    while True:
        try:
            logger.info("Running periodic alert check...")
            await check_and_create_alerts()
            logger.info("Alert check completed successfully")
        except Exception as e:
            logger.error(f"Error during periodic alert check: {e}")
        
        # Wait 6 hours before next check
        await asyncio.sleep(6 * 60 * 60)

@app.on_event("startup")
async def startup_event():
    """Run startup tasks"""
    # Run initial alert check
    try:
        logger.info("Running initial alert check...")
        await check_and_create_alerts()
        logger.info("Initial alert check completed")
    except Exception as e:
        logger.error(f"Error during initial alert check: {e}")
    
    # Start background task for periodic checks
    asyncio.create_task(check_alerts_periodically())
    logger.info("Background alert checker started")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()