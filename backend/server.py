from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
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
import openpyxl
import csv
import io
import tempfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Upload directories
UPLOAD_DIR = ROOT_DIR / "uploads"
MOTORISTAS_UPLOAD_DIR = UPLOAD_DIR / "motoristas"
PAGAMENTOS_UPLOAD_DIR = UPLOAD_DIR / "pagamentos"
VEHICLE_DOCS_UPLOAD_DIR = UPLOAD_DIR / "vehicle_documents"

# Ensure directories exist
UPLOAD_DIR.mkdir(exist_ok=True)
MOTORISTAS_UPLOAD_DIR.mkdir(exist_ok=True)
PAGAMENTOS_UPLOAD_DIR.mkdir(exist_ok=True)
VEHICLE_DOCS_UPLOAD_DIR.mkdir(exist_ok=True)

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

async def merge_images_to_pdf_a4(image1_path: Path, image2_path: Path, output_pdf_path: Path):
    """Merge two images (frente e verso) into a single A4 PDF"""
    from PIL import Image
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    
    # A4 size in points (72 DPI)
    a4_width, a4_height = A4
    
    # Create PDF
    c = canvas.Canvas(str(output_pdf_path), pagesize=A4)
    
    # Process first image (frente) - Page 1
    img1 = Image.open(image1_path)
    img1_width, img1_height = img1.size
    
    # Calculate scaling to fit A4 while maintaining aspect ratio
    scale1 = min(a4_width / img1_width, a4_height / img1_height) * 0.9  # 90% to leave margins
    new_width1 = img1_width * scale1
    new_height1 = img1_height * scale1
    
    # Center on page
    x1 = (a4_width - new_width1) / 2
    y1 = (a4_height - new_height1) / 2
    
    c.drawImage(str(image1_path), x1, y1, new_width1, new_height1)
    c.showPage()
    
    # Process second image (verso) - Page 2
    img2 = Image.open(image2_path)
    img2_width, img2_height = img2.size
    
    scale2 = min(a4_width / img2_width, a4_height / img2_height) * 0.9
    new_width2 = img2_width * scale2
    new_height2 = img2_height * scale2
    
    x2 = (a4_width - new_width2) / 2
    y2 = (a4_height - new_height2) / 2
    
    c.drawImage(str(image2_path), x2, y2, new_width2, new_height2)
    c.save()

# ==================== ALERT CHECKING UTILITIES ====================


async def auto_add_to_agenda(vehicle_id: str, tipo: str, data_vencimento: str, titulo: str):
    """Automatically add event to vehicle agenda when date is filled"""
    from datetime import datetime, timedelta
    
    try:
        # Parse date
        vencimento_date = datetime.strptime(data_vencimento, "%Y-%m-%d")
        # Set reminder for 30 days before
        reminder_date = (vencimento_date - timedelta(days=30)).strftime("%Y-%m-%d")
        
        evento = {
            "id": str(uuid.uuid4()),
            "tipo": tipo,
            "titulo": titulo,
            "data": reminder_date,
            "hora": "09:00",
            "descricao": f"Lembrete: {titulo} vence em {data_vencimento}",
            "auto_gerado": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Add to vehicle agenda
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$push": {"agenda": evento}}
        )
        
        logger.info(f"Auto-added to agenda: {titulo} for vehicle {vehicle_id}")
    except Exception as e:
        logger.error(f"Error auto-adding to agenda: {e}")



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
        
        # Check fire extinguisher expiry
        if vehicle.get("extintor"):
            try:
                validade_date = datetime.strptime(vehicle["extintor"]["data_validade"], "%Y-%m-%d").date()
                days_until_expiry = (validade_date - today).days
                
                if 0 <= days_until_expiry <= 30:
                    existing_alert = await db.alertas.find_one({
                        "tipo": "extintor",
                        "entidade_id": vehicle_id,
                        "status": "ativo"
                    })
                    
                    if not existing_alert:
                        alert = {
                            "id": str(uuid.uuid4()),
                            "tipo": "extintor",
                            "entidade_id": vehicle_id,
                            "entidade_tipo": "veiculo",
                            "titulo": f"Extintor expira em breve - {vehicle['matricula']}",
                            "descricao": f"O extintor do veículo {vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']}) expira em {days_until_expiry} dias.",
                            "data_vencimento": vehicle["extintor"]["data_validade"],
                            "prioridade": "alta",
                            "dias_antecedencia": 30,
                            "status": "ativo",
                            "criado_em": datetime.now(timezone.utc).isoformat()
                        }
                        await db.alertas.insert_one(alert)
            except Exception as e:
                logger.error(f"Error creating extintor alert: {e}")
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
    contribuinte_empresa: str  # NIF da empresa (9 dígitos)
    morada_completa: str
    codigo_postal: str  # Formato: xxxx-xxx
    localidade: str
    nome_manager: str
    email_manager: EmailStr
    email_empresa: EmailStr
    telefone: str
    telemovel: str
    email: EmailStr  # Mantido para compatibilidade
    certidao_permanente: str  # Formato: xxxx-xxxx-xxxx (só dígitos)
    codigo_certidao_comercial: str
    validade_certidao_comercial: str  # Data validade
    seguro_responsabilidade_civil: Optional[str] = None
    seguro_acidentes_trabalho: Optional[str] = None
    licenca_tvde: Optional[str] = None
    plano_id: Optional[str] = None  # ID do plano de assinatura
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
    email_manager: Optional[str] = None  # Opcional para retrocompatibilidade
    email_empresa: Optional[str] = None  # Opcional para retrocompatibilidade
    telefone: str
    telemovel: str
    email: str
    certidao_permanente: Optional[str] = None  # Opcional para retrocompatibilidade
    codigo_certidao_comercial: str
    validade_certidao_comercial: str
    seguro_responsabilidade_civil: Optional[str] = None
    seguro_acidentes_trabalho: Optional[str] = None
    licenca_tvde: Optional[str] = None
    plano_id: Optional[str] = None
    plano_status: str = "pendente"  # "pendente", "ativo", "suspenso"
    gestor_associado_id: Optional[str] = None
    total_vehicles: int = 0
    localidade: Optional[str] = None
    tipo_contrato_padrao: Optional[str] = None  # Tipo de contrato predefinido
    template_contrato_padrao: Optional[str] = None  # Template de contrato com variáveis
    texto_caucao_padrao: Optional[str] = None  # Texto padrão sobre caução
    texto_epoca_padrao: Optional[str] = None  # Texto padrão sobre épocas
    template_caucao: Optional[str] = None  # Texto padrão para cláusula de caução
    template_epoca_alta: Optional[str] = None  # Texto padrão para cláusula de época alta
    template_epoca_baixa: Optional[str] = None  # Texto padrão para cláusula de época baixa
    representante_legal_nome: Optional[str] = None
    representante_legal_contribuinte: Optional[str] = None
    representante_legal_cc: Optional[str] = None
    representante_legal_cc_validade: Optional[str] = None
    representante_legal_telefone: Optional[str] = None
    representante_legal_email: Optional[str] = None
    campos_customizados: Dict[str, Any] = {}
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

# Modelo para ganhos importados da Uber
class GanhoUber(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    uuid_motorista_uber: str  # UUID do motorista na Uber
    motorista_id: Optional[str] = None  # ID do motorista no sistema (se encontrado)
    nome_motorista: str
    apelido_motorista: str
    # Período do ficheiro
    periodo_inicio: Optional[str] = None
    periodo_fim: Optional[str] = None
    # Valores principais
    pago_total: float
    rendimentos_total: float
    dinheiro_recebido: Optional[float] = None
    # Tarifas
    tarifa_total: float
    tarifa_base: Optional[float] = None
    tarifa_ajuste: Optional[float] = None
    tarifa_cancelamento: Optional[float] = None
    tarifa_dinamica: Optional[float] = None
    taxa_reserva: Optional[float] = None
    uber_priority: Optional[float] = None
    tempo_espera: Optional[float] = None
    # Taxas e impostos
    taxa_servico: Optional[float] = None
    imposto_tarifa: Optional[float] = None
    taxa_aeroporto: Optional[float] = None
    # Outros
    gratificacao: Optional[float] = None
    portagens: Optional[float] = None
    ajustes: Optional[float] = None
    # Metadata
    ficheiro_nome: str
    data_importacao: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    importado_por: str
    
class GanhoUberImportResponse(BaseModel):
    total_linhas: int
    motoristas_encontrados: int
    motoristas_nao_encontrados: int
    total_ganhos: float
    ganhos_importados: List[Dict[str, Any]]
    erros: List[str] = []

# Modelos para Sincronização Automática
class CredenciaisPlataforma(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parceiro_id: str  # Cada parceiro tem suas próprias credenciais
    plataforma: str  # uber, bolt, via_verde, combustivel, gps
    email: str
    password_encrypted: str  # Encriptado
    ativo: bool = True
    ultima_sincronizacao: Optional[datetime] = None
    proxima_sincronizacao: Optional[datetime] = None
    sincronizacao_automatica: bool = False
    horario_sincronizacao: Optional[str] = None  # ex: "09:00"
    frequencia_dias: int = 7  # Semanal por padrão
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
class LogSincronizacao(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    plataforma: str
    tipo_sincronizacao: str  # manual, automatico
    status: str  # sucesso, erro, parcial
    data_inicio: datetime
    data_fim: Optional[datetime] = None
    registos_importados: int = 0
    registos_erro: int = 0
    mensagem: Optional[str] = None
    detalhes: Dict[str, Any] = {}
    executado_por: Optional[str] = None  # user_id se manual

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
    # Documentos principais com foto (convertidos para PDF A4)
    comprovativo_morada_pdf: Optional[str] = None  # Comprovativo de morada (PDF)
    cc_frente_verso_pdf: Optional[str] = None  # CC frente e verso juntos em PDF A4
    carta_frente_verso_pdf: Optional[str] = None  # Carta frente e verso juntos em PDF A4
    licenca_tvde_pdf: Optional[str] = None  # Licença TVDE (PDF)
    registo_criminal_pdf: Optional[str] = None  # Registo criminal (PDF)
    iban_comprovativo_pdf: Optional[str] = None  # Comprovativo de IBAN (PDF)
    # Documentos antigos (mantidos para compatibilidade)
    cartao_cidadao_foto: Optional[str] = None
    carta_conducao_foto: Optional[str] = None
    licenca_tvde_foto: Optional[str] = None
    comprovativo_morada: Optional[str] = None
    iban_comprovativo: Optional[str] = None
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
    tipo_motorista: Optional[str] = "independente"  # tempo_integral, meio_periodo, independente, parceiro
    regime: str  # aluguer, comissao, carro_proprio
    iban: Optional[str] = None
    email_uber: Optional[str] = None
    telefone_uber: Optional[str] = None
    uuid_motorista_uber: Optional[str] = None  # UUID do motorista na Uber para identificar ganhos
    email_bolt: Optional[str] = None
    telefone_bolt: Optional[str] = None
    identificador_motorista_bolt: Optional[str] = None  # Identificador do motorista na Bolt para ganhos
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
    codigo_registo_criminal: Optional[str] = None  # Formato: xxxx-xxxx-xxxx
    parceiro_atribuido: Optional[str] = None  # ID do parceiro
    veiculo_atribuido: Optional[str] = None  # ID do veículo
    status_motorista: Optional[str] = "pendente_documentos"  # aguarda_carro, ferias, ativo, pendente_documentos, desativo
    tipo_motorista: Optional[str] = None  # tempo_integral, meio_periodo, independente, parceiro
    regime: Optional[str] = None
    iban: Optional[str] = None
    email_uber: Optional[str] = None
    telefone_uber: Optional[str] = None
    uuid_motorista_uber: Optional[str] = None  # UUID do motorista na Uber para identificar ganhos
    email_bolt: Optional[str] = None
    telefone_bolt: Optional[str] = None
    identificador_motorista_bolt: Optional[str] = None  # Identificador do motorista na Bolt para ganhos
    whatsapp: Optional[str] = None
    tipo_pagamento: Optional[str] = None
    documents: MotoristaDocuments
    approved: bool = False
    senha_provisoria: bool = False
    campos_customizados: Dict[str, Any] = {}  # Campos adicionais customizáveis
    created_at: datetime
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

# Caução Model (para veículos) - deve vir antes de Vehicle
class CaucaoVeiculo(BaseModel):
    caucao_total: float = 0.0
    caucao_divisao: str = "total"  # "semanal", "mensal", "total"
    caucao_valor_semanal: float = 0.0  # Calculado automaticamente
    caucao_pago: float = 0.0
    caucao_restante: float = 0.0  # Calculado automaticamente

# Vehicle Models - COMPLETE EXPANDED
class TipoContrato(BaseModel):
    tipo: Optional[str] = "aluguer"  # aluguer, comissao, motorista_privado, compra_veiculo
    # Para Aluguer
    valor_aluguer: Optional[float] = None
    # Para Comissão
    comissao_parceiro: Optional[float] = None  # % da comissão para o parceiro
    comissao_motorista: Optional[float] = None  # % da comissão para o motorista (soma deve ser 100%)
    # Para Compra do Veículo
    valor_semanal_compra: Optional[float] = None
    periodo_compra: Optional[int] = None  # Número de semanas
    valor_acumulado: Optional[float] = None
    valor_falta_cobrar: Optional[float] = None
    custo_slot: Optional[float] = None
    # Geral
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
    seguradora: Optional[str] = None  # Renomeado de companhia
    companhia: Optional[str] = None  # Mantido para retrocompatibilidade
    numero_apolice: Optional[str] = None
    apolice: Optional[str] = None  # Mantido para retrocompatibilidade
    agente_seguros: Optional[str] = None
    data_inicio: Optional[str] = None
    data_validade: Optional[str] = None
    valor: Optional[float] = None
    valor_anual: Optional[float] = None  # Mantido para retrocompatibilidade
    preco: Optional[float] = None  # Mantido para retrocompatibilidade
    periodicidade: Optional[str] = "anual"
    carta_verde_url: Optional[str] = None
    condicoes_url: Optional[str] = None
    fatura_url: Optional[str] = None
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
    numeracao: Optional[str] = None  # Número de série/identificação do extintor
    fornecedor: Optional[str] = None
    empresa_certificacao: Optional[str] = None
    preco: Optional[float] = None
    data_instalacao: Optional[str] = None  # Data de instalação do extintor
    data_entrega: Optional[str] = None  # Mantido para retrocompatibilidade
    data_validade: Optional[str] = None
    proxima_intervencao: Optional[str] = None
    certificado_url: Optional[str] = None

class VehicleInspection(BaseModel):
    fornecedor: Optional[str] = None
    data_inspecao: Optional[str] = None
    proxima_inspecao: Optional[str] = None
    custo: Optional[float] = None
    # New fields for inspection value
    ultima_inspecao: Optional[str] = None
    resultado: Optional[str] = None
    valor: Optional[float] = None
    centro_inspecao: Optional[str] = None
    observacoes: Optional[str] = None
    ficha_inspecao_url: Optional[str] = None

class VehicleAvailability(BaseModel):
    status: str  # disponivel, atribuido, manutencao, seguro, sinistro, venda
    motoristas_atribuidos: List[str] = []
    data_entrega_manutencao: Optional[str] = None
    tipo_manutencao: Optional[str] = None

class VehicleCreate(BaseModel):
    marca: str
    modelo: str
    versao: Optional[str] = None  # Ex: "Sport", "Exclusive", "Comfort"
    ano: Optional[int] = None
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
    versao: Optional[str] = None
    ano: Optional[int] = None
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
    inspection: Optional[VehicleInspection] = None  # Single inspection field with valor
    disponibilidade: VehicleAvailability
    km_atual: int = 0
    km_aviso_manutencao: int = 5000
    alertas_manutencao: List[str] = []
    fotos: List[str] = []  # URLs das fotos (máximo 3, convertidas para PDF)
    caucao: Optional[CaucaoVeiculo] = None  # Caução do veículo
    danos: List[Dict[str, Any]] = []  # Histórico de danos
    agenda: List[Dict[str, Any]] = []  # Agenda do veículo
    historico_editavel: List[Dict[str, Any]] = []  # Histórico editável/observações
    fotos_veiculo: List[str] = []  # URLs das fotos do veículo (max 3)
    proxima_revisao_km: Optional[int] = None
    proxima_revisao_data: Optional[str] = None
    proxima_revisao_notas: Optional[str] = None
    proxima_revisao_valor_previsto: Optional[float] = None
    motorista_atribuido: Optional[str] = None  # ID do motorista
    motorista_atribuido_nome: Optional[str] = None  # Nome do motorista
    status: str = "disponivel"  # disponivel, atribuido, manutencao, venda, condicoes
    km_atual: Optional[int] = None  # KM atual do veículo
    campos_customizados: Dict[str, Any] = {}  # Campos adicionais customizáveis
    # Marketplace fields
    disponivel_venda: bool = False  # Se está disponível para venda no marketplace
    disponivel_aluguer: bool = False  # Se está disponível para aluguer no marketplace
    preco_venda: Optional[float] = None  # Preço de venda
    preco_aluguer_mensal: Optional[float] = None  # Preço de aluguer mensal
    descricao_marketplace: Optional[str] = None  # Descrição para marketplace
    # Documentos do veículo
    documento_carta_verde: Optional[str] = None  # Carta verde do seguro
    documento_condicoes: Optional[str] = None  # Documento de condições
    documento_recibo_seguro: Optional[str] = None  # Recibo de pagamento do seguro
    documento_inspecao: Optional[str] = None  # Documento/certificado da inspeção
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


# ==================== CONTRACT MODELS ====================

class ContratoCreate(BaseModel):
    parceiro_id: str
    motorista_id: str
    vehicle_id: str
    data_inicio: str
    tipo_contrato: str = "comissao"  # "comissao", "aluguer_normal", "aluguer_epocas", "compra", "motorista_privado"
    
    # Valores financeiros
    valor_semanal: float = 230.0
    comissao_percentual: Optional[float] = None  # Para tipo comissão
    caucao_total: float = 300.0
    caucao_lavagem: float = 90.0
    
    # Campos de caução
    tem_caucao: bool = True
    caucao_parcelada: bool = False
    caucao_parcelas: Optional[int] = None
    caucao_texto: Optional[str] = None  # Texto personalizado sobre caução
    
    # Campos para época (opcional)
    tem_epoca: bool = False
    data_inicio_epoca_alta: Optional[str] = None
    data_fim_epoca_alta: Optional[str] = None
    valor_epoca_alta: Optional[float] = None
    texto_epoca_alta: Optional[str] = None  # Texto/observações época alta
    data_inicio_epoca_baixa: Optional[str] = None
    data_fim_epoca_baixa: Optional[str] = None
    valor_epoca_baixa: Optional[float] = None
    texto_epoca_baixa: Optional[str] = None  # Texto/observações época baixa
    
    # Condições do veículo (editáveis na emissão)
    condicoes_veiculo: Optional[str] = None
    
    # Template/texto do contrato
    template_texto: Optional[str] = None

class Contrato(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    referencia: str  # Ex: "001/2024"
    parceiro_id: str
    motorista_id: str
    vehicle_id: Optional[str] = None
    
    # Dados Parceiro Completos
    parceiro_nome: str
    parceiro_nif: str
    parceiro_morada: str
    parceiro_codigo_postal: Optional[str] = None
    parceiro_localidade: Optional[str] = None
    parceiro_telefone: Optional[str] = None
    parceiro_email: str
    parceiro_representante_legal_nome: Optional[str] = None
    parceiro_representante_legal_contribuinte: Optional[str] = None
    parceiro_representante_legal_cc: Optional[str] = None
    parceiro_representante_legal_cc_validade: Optional[str] = None
    parceiro_representante_legal_telefone: Optional[str] = None
    parceiro_representante_legal_email: Optional[str] = None
    
    # Dados Motorista Completos
    motorista_nome: str
    motorista_cc: str
    motorista_cc_validade: Optional[str] = None
    motorista_nif: str
    motorista_morada: str
    motorista_codigo_postal: Optional[str] = None
    motorista_localidade: Optional[str] = None
    motorista_telefone: Optional[str] = None
    motorista_carta_conducao: Optional[str] = None
    motorista_carta_conducao_validade: Optional[str] = None
    motorista_licenca_tvde: Optional[str] = None
    motorista_licenca_tvde_validade: Optional[str] = None
    motorista_seguranca_social: Optional[str] = None
    motorista_email: str
    
    # Dados Veículo
    vehicle_marca: Optional[str] = None
    vehicle_modelo: Optional[str] = None
    vehicle_matricula: Optional[str] = None
    
    # Termos Financeiros
    tipo_contrato: str  # "comissao", "aluguer_normal", "aluguer_epocas", "compra", "motorista_privado"
    valor_semanal: float = 230.0
    comissao_percentual: Optional[float] = None
    caucao_total: float = 300.0
    caucao_lavagem: float = 90.0
    
    # Campos de caução
    tem_caucao: bool = True
    caucao_parcelada: bool = False
    caucao_parcelas: Optional[int] = None
    caucao_texto: Optional[str] = None  # Texto personalizado sobre caução
    
    # Campos de Época (opcional)
    tem_epoca: bool = False
    data_inicio_epoca_alta: Optional[str] = None
    data_fim_epoca_alta: Optional[str] = None
    valor_epoca_alta: Optional[float] = None
    texto_epoca_alta: Optional[str] = None
    data_inicio_epoca_baixa: Optional[str] = None
    data_fim_epoca_baixa: Optional[str] = None
    valor_epoca_baixa: Optional[float] = None
    texto_epoca_baixa: Optional[str] = None
    
    # Condições do veículo
    condicoes_veiculo: Optional[str] = None
    
    # Template do contrato
    template_texto: Optional[str] = None
    
    # Datas
    data_inicio: str
    data_emissao: str  # Data em que o contrato foi gerado/emitido
    data_assinatura: str
    local_assinatura: str = "Lisboa"
    
    # Status e Assinaturas
    status: str  # "rascunho", "ativo", "terminado"
    parceiro_assinado: bool = False
    motorista_assinado: bool = False
    parceiro_assinatura_data: Optional[str] = None
    motorista_assinatura_data: Optional[str] = None
    pdf_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime



# ==================== MINUTAS DE CONTRATO ====================

class MinutaContrato(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    parceiro_id: str
    nome: str  # Ex: "Contrato Aluguer Padrão", "Contrato Comissão"
    tipo_contrato: str  # "comissao", "aluguer", "compra", "motorista_privado"
    texto_minuta: str  # Texto com variáveis
    ativa: bool = True
    created_at: datetime
    updated_at: datetime
    created_by: str

class MinutaContratoCreate(BaseModel):
    parceiro_id: str
    nome: str
    tipo_contrato: str
    texto_minuta: str

# ==================== CONFIGURAÇÕES DO SISTEMA ====================

class ConfiguracaoSistema(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "config_sistema"
    condicoes_gerais: str = ""
    politica_privacidade: str = ""
    updated_at: datetime
    updated_by: str

class ConfiguracaoUpdate(BaseModel):
    condicoes_gerais: Optional[str] = None
    politica_privacidade: Optional[str] = None

# ==================== RECIBOS E PAGAMENTOS MODELS ====================

class RelatorioGanhosCreate(BaseModel):
    motorista_id: str
    periodo_inicio: str
    periodo_fim: str
    valor_total: float
    detalhes: Dict[str, Any]  # Breakdown de ganhos (uber, bolt, etc)
    notas: Optional[str] = None

class RelatorioGanhos(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    motorista_id: str
    motorista_nome: str
    periodo_inicio: str
    periodo_fim: str
    valor_total: float
    detalhes: Dict[str, Any]
    notas: Optional[str] = None
    status: str  # "pendente_recibo", "recibo_emitido", "aguardando_pagamento", "pago"
    recibo_url: Optional[str] = None
    recibo_emitido_em: Optional[str] = None
    aprovado_pagamento: bool = False
    aprovado_pagamento_por: Optional[str] = None  # user_id
    aprovado_pagamento_em: Optional[str] = None
    pago: bool = False
    pago_por: Optional[str] = None  # user_id
    pago_em: Optional[str] = None
    comprovativo_pagamento_url: Optional[str] = None
    created_by: str  # user_id (admin, gestor, operacional)
    created_at: datetime
    updated_at: datetime

class ReciboMotorista(BaseModel):
    """Recibo emitido pelo motorista"""
    model_config = ConfigDict(extra="ignore")
    id: str
    relatorio_ganhos_id: str
    motorista_id: str
    motorista_nome: str
    motorista_nif: str
    periodo_inicio: str
    periodo_fim: str
    valor_total: float
    descricao_servicos: str
    pdf_url: str
    emitido_em: datetime
    created_at: datetime

class SubscriptionCreate(BaseModel):
    user_id: str
    plano_id: str

# ==================== CSV DATA MODELS ====================

class GanhoUber(BaseModel):
    """Dados processados de CSV Uber"""
    model_config = ConfigDict(extra="ignore")
    id: str
    motorista_id: str
    uuid_motorista_uber: str
    nome_motorista: str
    periodo_inicio: str
    periodo_fim: str
    total_pago: float
    created_at: datetime

class GanhoBolt(BaseModel):
    """Dados processados de CSV Bolt"""
    model_config = ConfigDict(extra="ignore")
    id: str
    motorista_id: str
    email_motorista: str
    nome_motorista: str
    periodo_inicio: str
    periodo_fim: str
    ganhos_brutos: float
    ganhos_liquidos: float
    viagens_terminadas: int
    created_at: datetime

class TransacaoCombustivel(BaseModel):
    """Dados processados de Excel Prio/Combustível"""
    model_config = ConfigDict(extra="ignore")
    id: str
    motorista_id: str
    cartao: str
    data_transacao: str
    hora_transacao: str
    posto: str
    combustivel: str
    litros: float
    valor_liquido: float
    iva: float
    total: float
    kms: Optional[int] = None
    created_at: datetime

class ContratoGerado(BaseModel):
    """Contrato gerado em PDF"""
    model_config = ConfigDict(extra="ignore")
    id: str
    parceiro_id: str
    motorista_id: str
    veiculo_id: str
    tipo_contrato: str  # aluguer, comissao
    pdf_url: str
    dados_contrato: Dict[str, Any]
    status: str  # gerado, assinado, cancelado
    created_at: datetime
    assinado_em: Optional[datetime] = None

class Fatura(BaseModel):
    """Fatura de subscrição"""
    model_config = ConfigDict(extra="ignore")
    id: str
    subscription_id: str
    user_id: str
    periodo_referencia: str  # "2025-11"
    valor_total: float
    unidades_cobradas: int
    status: str  # pendente, paga, cancelada
    pdf_url: Optional[str] = None
    data_emissao: str
    data_vencimento: str
    data_pagamento: Optional[str] = None
    created_at: datetime

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

# ==================== CSV PROCESSING UTILITIES ====================

async def process_uber_csv(file_content: bytes, parceiro_id: str, periodo_inicio: str, periodo_fim: str) -> Dict[str, Any]:
    """Process Uber CSV file and extract earnings data (for parceiro/operacional)"""
    try:
        # Save original CSV file for audit/backup
        csv_dir = UPLOAD_DIR / "csv" / "uber"
        csv_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_filename = f"uber_{parceiro_id}_{timestamp}.csv"
        csv_path = csv_dir / csv_filename
        
        with open(csv_path, 'wb') as f:
            f.write(file_content)
        
        # Decode CSV
        csv_text = file_content.decode('utf-8-sig')  # Handle BOM
        csv_reader = csv.DictReader(io.StringIO(csv_text))
        
        # Process CSV rows (can have multiple motoristas)
        total_registos = 0
        total_pago_all = 0
        
        for row in csv_reader:
            uuid_uber = row.get("UUID do motorista", "")
            nome = f"{row.get('Nome próprio do motorista', '')} {row.get('Apelido do motorista', '')}".strip()
            total_pago = float(row.get("Pago a si", "0").replace(",", ".") or 0)
            
            if nome:  # Only process if there's a name
                # Store in database
                ganho = {
                    "id": str(uuid.uuid4()),
                    "parceiro_id": parceiro_id,
                    "uuid_motorista_uber": uuid_uber,
                    "nome_motorista": nome,
                    "periodo_inicio": periodo_inicio,
                    "periodo_fim": periodo_fim,
                    "total_pago": total_pago,
                    "csv_original": f"uploads/csv/uber/{csv_filename}",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                await db.ganhos_uber.insert_one(ganho)
                total_registos += 1
                total_pago_all += total_pago
        
        return {
            "success": True,
            "registos_importados": total_registos,
            "total_pago": total_pago_all,
            "periodo": f"{periodo_inicio} a {periodo_fim}",
            "csv_salvo": csv_filename
        }
    
    except Exception as e:
        logger.error(f"Error processing Uber CSV: {e}")
        return {"success": False, "error": str(e)}

async def process_bolt_csv(file_content: bytes, parceiro_id: str, periodo_inicio: str, periodo_fim: str) -> Dict[str, Any]:
    """Process Bolt CSV file and extract earnings data (for parceiro/operacional)"""
    try:
        # Save original CSV file for audit/backup
        csv_dir = UPLOAD_DIR / "csv" / "bolt"
        csv_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_filename = f"bolt_{parceiro_id}_{timestamp}.csv"
        csv_path = csv_dir / csv_filename
        
        with open(csv_path, 'wb') as f:
            f.write(file_content)
        
        # Decode CSV
        csv_text = file_content.decode('utf-8-sig')
        csv_reader = csv.DictReader(io.StringIO(csv_text))
        
        # Process CSV rows (can have multiple motoristas)
        total_registos = 0
        total_ganhos_liquidos = 0
        total_viagens = 0
        
        for row in csv_reader:
            nome = row.get("Motorista", "").strip()
            email = row.get("Email", "").strip()
            ganhos_brutos = float(row.get("Ganhos brutos (total)|€", "0").replace(",", ".") or 0)
            ganhos_liquidos = float(row.get("Ganhos líquidos|€", "0").replace(",", ".") or 0)
            viagens = int(row.get("Viagens terminadas", "0") or 0)
            
            if nome:  # Only process if there's a name
                # Store in database
                ganho = {
                    "id": str(uuid.uuid4()),
                    "parceiro_id": parceiro_id,
                    "email_motorista": email,
                    "nome_motorista": nome,
                    "periodo_inicio": periodo_inicio,
                    "periodo_fim": periodo_fim,
                    "ganhos_brutos": ganhos_brutos,
                    "ganhos_liquidos": ganhos_liquidos,
                    "viagens_terminadas": viagens,
                    "csv_original": f"uploads/csv/bolt/{csv_filename}",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                await db.ganhos_bolt.insert_one(ganho)
                total_registos += 1
                total_ganhos_liquidos += ganhos_liquidos
                total_viagens += viagens
        
        return {
            "success": True,
            "registos_importados": total_registos,
            "ganhos_liquidos": total_ganhos_liquidos,
            "viagens": total_viagens,
            "periodo": f"{periodo_inicio} a {periodo_fim}",
            "csv_salvo": csv_filename
        }
    
    except Exception as e:
        logger.error(f"Error processing Bolt CSV: {e}")
        return {"success": False, "error": str(e)}

async def process_prio_excel(file_content: bytes, parceiro_id: str) -> Dict[str, Any]:
    """Process Prio Excel file and extract fuel transactions (for parceiro/operacional)"""
    try:
        # Save original Excel file for audit/backup
        excel_dir = UPLOAD_DIR / "csv" / "combustivel"
        excel_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        excel_filename = f"prio_{parceiro_id}_{timestamp}.xlsx"
        excel_path = excel_dir / excel_filename
        
        with open(excel_path, 'wb') as f:
            f.write(file_content)
        
        # Read with openpyxl
        wb = openpyxl.load_workbook(excel_path)
        sheet = wb.active
        
        # Skip header rows (first 3 rows are empty/header)
        transactions = []
        for row in sheet.iter_rows(min_row=5, values_only=True):
            if not row[3]:  # Skip if no date
                continue
            
            data_transacao = row[3].strftime('%Y-%m-%d') if hasattr(row[3], 'strftime') else str(row[3])
            hora_transacao = row[4].strftime('%H:%M:%S') if hasattr(row[4], 'strftime') else str(row[4])
            
            transacao = {
                "id": str(uuid.uuid4()),
                "parceiro_id": parceiro_id,
                "cartao": str(row[5] or ""),
                "data_transacao": data_transacao,
                "hora_transacao": hora_transacao,
                "posto": str(row[0] or ""),
                "combustivel": str(row[10] or ""),
                "litros": float(row[9] or 0),
                "valor_liquido": float(row[12] or 0),
                "iva": float(row[13] or 0),
                "total": float(row[18] or 0),
                "kms": int(row[14] or 0) if row[14] else None,
                "excel_original": f"uploads/csv/combustivel/{excel_filename}",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            transactions.append(transacao)
        
        # Store in database
        if transactions:
            await db.transacoes_combustivel.insert_many(transactions)
        
        total_litros = sum(t["litros"] for t in transactions)
        total_valor = sum(t["total"] for t in transactions)
        
        return {
            "success": True,
            "transacoes_importadas": len(transactions),
            "total_litros": total_litros,
            "total_valor": total_valor,
            "excel_salvo": excel_filename
        }
    
    except Exception as e:
        logger.error(f"Error processing Prio Excel: {e}")
        return {"success": False, "error": str(e)}

async def generate_contrato_pdf(parceiro: Dict, motorista: Dict, veiculo: Dict) -> str:
    """Generate contract PDF and return file path"""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import cm
    
    # Create contracts directory
    contratos_dir = UPLOAD_DIR / "contratos"
    contratos_dir.mkdir(exist_ok=True)
    
    # Generate filename
    contrato_id = str(uuid.uuid4())
    pdf_filename = f"contrato_{contrato_id}.pdf"
    pdf_path = contratos_dir / pdf_filename
    
    # Create PDF
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    
    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, height - 2*cm, "CONTRATO DE EXPLORAÇÃO DE VEÍCULO TVDE")
    
    # Date
    c.setFont("Helvetica", 10)
    data_hoje = datetime.now().strftime("%d/%m/%Y")
    c.drawCentredString(width/2, height - 3*cm, f"Data: {data_hoje}")
    
    y = height - 5*cm
    
    # Section 1: Parceiro/Empresa
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2*cm, y, "1. IDENTIFICAÇÃO DA EMPRESA")
    y -= 0.8*cm
    
    c.setFont("Helvetica", 10)
    c.drawString(2.5*cm, y, f"Empresa: {parceiro.get('nome_empresa', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"NIF: {parceiro.get('contribuinte_empresa', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Morada: {parceiro.get('morada_completa', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Código Postal: {parceiro.get('codigo_postal', 'N/A')} {parceiro.get('localidade', '')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Manager: {parceiro.get('nome_manager', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Contacto: {parceiro.get('telefone', 'N/A')} / {parceiro.get('telemovel', 'N/A')}")
    y -= 1*cm
    
    # Section 2: Motorista
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2*cm, y, "2. IDENTIFICAÇÃO DO MOTORISTA")
    y -= 0.8*cm
    
    c.setFont("Helvetica", 10)
    c.drawString(2.5*cm, y, f"Nome: {motorista.get('name', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"NIF: {motorista.get('nif', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Morada: {motorista.get('morada_completa', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Licença TVDE: {motorista.get('licenca_tvde_numero', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Contacto: {motorista.get('phone', 'N/A')} / {motorista.get('whatsapp', 'N/A')}")
    y -= 1*cm
    
    # Section 3: Veículo
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2*cm, y, "3. IDENTIFICAÇÃO DO VEÍCULO")
    y -= 0.8*cm
    
    c.setFont("Helvetica", 10)
    c.drawString(2.5*cm, y, f"Marca/Modelo: {veiculo.get('marca', 'N/A')} {veiculo.get('modelo', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Matrícula: {veiculo.get('matricula', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Cor: {veiculo.get('cor', 'N/A')}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Combustível: {veiculo.get('combustivel', 'N/A')}")
    y -= 1*cm
    
    # Section 4: Condições
    tipo_contrato = veiculo.get('tipo_contrato', {})
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2*cm, y, "4. CONDIÇÕES DE EXPLORAÇÃO")
    y -= 0.8*cm
    
    c.setFont("Helvetica", 10)
    c.drawString(2.5*cm, y, f"Tipo de Contrato: {tipo_contrato.get('tipo', 'N/A').upper()}")
    y -= 0.6*cm
    
    if tipo_contrato.get('tipo') == 'aluguer':
        c.drawString(2.5*cm, y, f"Valor de Aluguer: €{tipo_contrato.get('valor_aluguer', 0):.2f} / mês")
        y -= 0.6*cm
    elif tipo_contrato.get('tipo') == 'comissao':
        c.drawString(2.5*cm, y, f"Comissão Parceiro: {tipo_contrato.get('comissao_parceiro', 0)}%")
        y -= 0.6*cm
        c.drawString(2.5*cm, y, f"Comissão Motorista: {tipo_contrato.get('comissao_motorista', 0)}%")
        y -= 0.6*cm
    
    c.drawString(2.5*cm, y, f"Regime: {tipo_contrato.get('regime', 'full_time').upper()}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Inclui Combustível: {'Sim' if tipo_contrato.get('inclui_combustivel') else 'Não'}")
    y -= 0.6*cm
    c.drawString(2.5*cm, y, f"Inclui Via Verde: {'Sim' if tipo_contrato.get('inclui_via_verde') else 'Não'}")
    y -= 1*cm
    
    # Caução
    caucao = veiculo.get('caucao', {})
    if caucao and caucao.get('caucao_total', 0) > 0:
        c.setFont("Helvetica-Bold", 12)
        c.drawString(2*cm, y, "5. CAUÇÃO")
        y -= 0.8*cm
        
        c.setFont("Helvetica", 10)
        c.drawString(2.5*cm, y, f"Valor Total: €{caucao.get('caucao_total', 0):.2f}")
        y -= 0.6*cm
        c.drawString(2.5*cm, y, f"Divisão: {caucao.get('caucao_divisao', 'total').upper()}")
        y -= 0.6*cm
        if caucao.get('caucao_divisao') == 'semanal':
            c.drawString(2.5*cm, y, f"Valor Semanal: €{caucao.get('caucao_valor_semanal', 0):.2f}")
            y -= 0.6*cm
        y -= 0.5*cm
    
    # Signatures
    y -= 1*cm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(3*cm, y, "Assinatura da Empresa:")
    c.drawString(12*cm, y, "Assinatura do Motorista:")
    y -= 0.5*cm
    c.line(3*cm, y, 8*cm, y)
    c.line(12*cm, y, 17*cm, y)
    
    # Save PDF
    c.save()
    
    return f"uploads/contratos/{pdf_filename}"

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
    
    # Send welcome email
    await enviar_email_boas_vindas(user_dict)
    
    user_dict.pop("password")
    if isinstance(user_dict["created_at"], str):
        user_dict["created_at"] = datetime.fromisoformat(user_dict["created_at"])
    
    return User(**user_dict)

async def enviar_email_boas_vindas(user: Dict[str, Any]):
    """Send welcome email to new user"""
    role_labels = {
        "motorista": "Motorista",
        "parceiro": "Parceiro",
        "operacional": "Operacional",
        "gestao": "Gestor",
        "admin": "Administrador"
    }
    
    role_label = role_labels.get(user.get("role"), "Utilizador")
    
    # Get email config
    config = await db.configuracoes.find_one({"tipo": "email"}, {"_id": 0})
    email_from = config.get("email_contacto", "info@tvdefleet.com") if config else "info@tvdefleet.com"
    
    print(f"📧 ENVIAR EMAIL DE BOAS-VINDAS:")
    print(f"   Para: {user.get('email')}")
    print(f"   Nome: {user.get('name')}")
    print(f"   Role: {role_label}")
    
    # Queue email for sending
    await db.email_queue.insert_one({
        "to": user.get("email"),
        "from": email_from,
        "subject": f"Bem-vindo à TVDEFleet - Registo de {role_label}",
        "body": f"""
        Olá {user.get('name')},
        
        Bem-vindo à TVDEFleet!
        
        O seu registo como {role_label} foi recebido com sucesso.
        
        A nossa equipa irá analisar os seus dados e entrará em contacto em breve.
        Após aprovação, receberá as suas credenciais de acesso definitivas.
        
        Dados do registo:
        - Email: {user.get('email')}
        - Telefone: {user.get('phone', 'N/A')}
        - Data de registo: {user.get('created_at')}
        
        Se tiver alguma dúvida, entre em contacto connosco:
        Email: {email_from}
        Telefone: +351 912 345 678
        WhatsApp: https://wa.me/351912345678
        
        Obrigado,
        Equipa TVDEFleet
        """,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "tipo": "boas_vindas",
        "user_id": user.get("id")
    })

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

@api_router.get("/motoristas/{motorista_id}", response_model=Motorista)
async def get_motorista_by_id(motorista_id: str, current_user: Dict = Depends(get_current_user)):
    """Get a specific motorista by ID"""
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Convert datetime strings
    if isinstance(motorista.get("created_at"), str):
        motorista["created_at"] = datetime.fromisoformat(motorista["created_at"])
    if motorista.get("approved_at") and isinstance(motorista["approved_at"], str):
        motorista["approved_at"] = datetime.fromisoformat(motorista["approved_at"])
    
    return Motorista(**motorista)

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

@api_router.put("/motoristas/{motorista_id}")
async def update_motorista(
    motorista_id: str, 
    update_data: Dict[str, Any], 
    current_user: Dict = Depends(get_current_user)
):
    """Update motorista data (partial updates allowed)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if motorista exists
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Remove fields that shouldn't be updated directly
    update_data.pop("id", None)
    update_data.pop("created_at", None)
    update_data.pop("_id", None)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    # Update motorista
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": update_data}
    )
    
    return {"message": "Motorista updated successfully"}

@api_router.delete("/motoristas/{motorista_id}")
async def delete_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a motorista (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Delete from motoristas collection
    result = await db.motoristas.delete_one({"id": motorista_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Also delete from users collection if exists
    await db.users.delete_one({"id": motorista_id})
    
    return {"message": "Motorista deleted successfully"}

@api_router.post("/motoristas/{motorista_id}/upload-documento")
async def upload_motorista_documento(
    motorista_id: str,
    tipo_documento: str = Form(...),  # comprovativo_morada, cc_frente_verso, carta_frente_verso, licenca_tvde, registo_criminal, iban
    file: UploadFile = File(...),
    file2: Optional[UploadFile] = File(None),  # Para frente e verso
    current_user: Dict = Depends(get_current_user)
):
    """Upload document for motorista (converts images to PDF)"""
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    motoristas_docs_dir = UPLOAD_DIR / "motoristas" / motorista_id
    motoristas_docs_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        if tipo_documento in ['cc_frente_verso', 'carta_frente_verso'] and file2:
            # Process frente e verso together
            # Save first image
            file_id1 = str(uuid.uuid4())
            file_ext1 = Path(file.filename).suffix.lower()
            temp_path1 = motoristas_docs_dir / f"{file_id1}_temp{file_ext1}"
            with open(temp_path1, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Save second image
            file_id2 = str(uuid.uuid4())
            file_ext2 = Path(file2.filename).suffix.lower()
            temp_path2 = motoristas_docs_dir / f"{file_id2}_temp{file_ext2}"
            with open(temp_path2, "wb") as buffer:
                shutil.copyfileobj(file2.file, buffer)
            
            # Merge to PDF A4
            pdf_filename = f"{tipo_documento}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            pdf_path = motoristas_docs_dir / pdf_filename
            
            await merge_images_to_pdf_a4(temp_path1, temp_path2, pdf_path)
            
            # Clean up temp files
            temp_path1.unlink()
            temp_path2.unlink()
            
            doc_url = str(pdf_path.relative_to(ROOT_DIR))
        else:
            # Single file (convert to PDF if image)
            file_id = f"{tipo_documento}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            result = await process_uploaded_file(file, motoristas_docs_dir, file_id)
            doc_url = result.get("pdf_path") or result.get("original_path")
        
        # Update motorista documents
        field_name = f"documents.{tipo_documento}_pdf"
        await db.motoristas.update_one(
            {"id": motorista_id},
            {"$set": {field_name: doc_url}}
        )
        
        return {"message": "Document uploaded successfully", "document_url": doc_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

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
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Auto-add to agenda when dates are filled
    if updates.get("insurance") and updates["insurance"].get("data_validade"):
        await auto_add_to_agenda(
            vehicle_id, 
            "seguro", 
            updates["insurance"]["data_validade"],
            "Renovação de Seguro"
        )
    
    if updates.get("inspection") and updates["inspection"].get("proxima_inspecao"):
        await auto_add_to_agenda(
            vehicle_id,
            "inspecao",
            updates["inspection"]["proxima_inspecao"],
            "Inspeção do Veículo"
        )
    
    if updates.get("extintor") and updates["extintor"].get("data_validade"):
        await auto_add_to_agenda(
            vehicle_id,
            "extintor",
            updates["extintor"]["data_validade"],
            "Renovação de Extintor"
        )
    
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
        "photo_url": photo_url
    }

@api_router.post("/vehicles/{vehicle_id}/agenda")
async def add_vehicle_agenda(
    vehicle_id: str,
    agenda_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Add event to vehicle agenda"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if vehicle exists
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    evento_id = str(uuid.uuid4())
    evento = {
        "id": evento_id,
        "tipo": agenda_data.get("tipo"),
        "titulo": agenda_data.get("titulo"),
        "data": agenda_data.get("data"),
        "hora": agenda_data.get("hora"),
        "descricao": agenda_data.get("descricao"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$push": {"agenda": evento}}
    )
    
    return {"message": "Event added to agenda", "evento_id": evento_id}

@api_router.get("/vehicles/{vehicle_id}/agenda")
async def get_vehicle_agenda(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    """Get vehicle agenda"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0, "agenda": 1})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return vehicle.get("agenda", [])

@api_router.put("/vehicles/{vehicle_id}/agenda/{evento_id}")
async def update_vehicle_agenda(
    vehicle_id: str,
    evento_id: str,
    agenda_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update event in vehicle agenda"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Update the specific event in agenda array
    await db.vehicles.update_one(
        {"id": vehicle_id, "agenda.id": evento_id},
        {"$set": {
            "agenda.$.tipo": agenda_data.get("tipo"),
            "agenda.$.titulo": agenda_data.get("titulo"),
            "agenda.$.data": agenda_data.get("data"),
            "agenda.$.hora": agenda_data.get("hora"),
            "agenda.$.descricao": agenda_data.get("descricao"),
            "agenda.$.updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Event updated successfully"}

@api_router.delete("/vehicles/{vehicle_id}/agenda/{evento_id}")
async def delete_vehicle_agenda(
    vehicle_id: str,
    evento_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete event from vehicle agenda"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Remove the event from agenda array
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$pull": {"agenda": {"id": evento_id}}}
    )
    
    return {"message": "Event deleted successfully"}

@api_router.get("/vehicles/{vehicle_id}/historico")
async def get_vehicle_historico(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    """Get vehicle history (maintenance, inspections, etc)"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Compile history from different sources
    historico = []
    
    # Add maintenance history
    if vehicle.get("manutencoes"):
        for man in vehicle["manutencoes"]:
            historico.append({
                "tipo": "manutencao",
                "data": man.get("data"),
                "descricao": f"{man.get('tipo_manutencao')}: {man.get('descricao')}",
                "valor": man.get("valor"),
                "km": man.get("km_realizada")
            })
    
    # Add inspection history
    if vehicle.get("inspecoes"):
        for insp in vehicle["inspecoes"]:
            historico.append({
                "tipo": "inspecao",
                "data": insp.get("ultima_inspecao"),
                "descricao": f"Inspeção - {insp.get('resultado', 'N/A')}",
                "valor": insp.get("valor"),
                "observacoes": insp.get("observacoes")
            })
    
    # Add damages history
    if vehicle.get("danos"):
        for dano in vehicle["danos"]:
            historico.append({
                "tipo": "dano",
                "data": dano.get("data"),
                "descricao": f"{dano.get('tipo')}: {dano.get('descricao')}",
                "valor": dano.get("valor_reparacao"),
                "responsavel": dano.get("responsavel")
            })
    
    # Sort by date (most recent first)
    historico.sort(key=lambda x: x.get("data", ""), reverse=True)
    
    return historico


@api_router.post("/vehicles/{vehicle_id}/historico")
async def add_historico_entry(
    vehicle_id: str,
    entry_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Add editable history entry to vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    entry = {
        "id": str(uuid.uuid4()),
        "data": entry_data.get("data"),
        "titulo": entry_data.get("titulo"),
        "descricao": entry_data.get("descricao"),
        "tipo": entry_data.get("tipo", "observacao"),  # observacao, manutencao, incidente, etc
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", current_user.get("email")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$push": {"historico_editavel": entry}}
    )
    
    return {"message": "History entry added", "entry_id": entry["id"]}

@api_router.put("/vehicles/{vehicle_id}/historico/{entry_id}")
async def update_historico_entry(
    vehicle_id: str,
    entry_id: str,
    entry_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update editable history entry"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get vehicle
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Update specific entry
    historico = vehicle.get("historico_editavel", [])
    for entry in historico:
        if entry["id"] == entry_id:
            entry["data"] = entry_data.get("data", entry["data"])
            entry["titulo"] = entry_data.get("titulo", entry["titulo"])
            entry["descricao"] = entry_data.get("descricao", entry["descricao"])
            entry["tipo"] = entry_data.get("tipo", entry["tipo"])
            entry["updated_at"] = datetime.now(timezone.utc).isoformat()
            break
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"historico_editavel": historico}}
    )
    
    return {"message": "History entry updated"}

@api_router.delete("/vehicles/{vehicle_id}/historico/{entry_id}")
async def delete_historico_entry(
    vehicle_id: str,
    entry_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete editable history entry"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$pull": {"historico_editavel": {"id": entry_id}}}
    )
    
    return {"message": "History entry deleted"}



@api_router.get("/vehicles/{vehicle_id}/relatorio-ganhos")
async def get_vehicle_relatorio_ganhos(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    """Get vehicle financial report (earnings vs expenses)"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Calculate ganhos (earnings) - would come from trips data
    # For now, return placeholder structure
    ganhos_total = 0.0
    despesas_total = 0.0
    detalhes = []
    
    # Calculate despesas from maintenance, insurance, etc
    if vehicle.get("manutencoes"):
        for man in vehicle["manutencoes"]:
            valor = man.get("valor", 0)
            despesas_total += valor
            detalhes.append({
                "tipo": "despesa",
                "descricao": f"Manutenção: {man.get('tipo_manutencao')}",
                "data": man.get("data"),
                "valor": valor
            })
    
    if vehicle.get("insurance"):
        valor = vehicle["insurance"].get("valor", 0)
        despesas_total += valor
        detalhes.append({
            "tipo": "despesa",
            "descricao": "Seguro",
            "data": vehicle["insurance"].get("data_inicio"),
            "valor": valor
        })
    
    if vehicle.get("inspection"):
        valor = vehicle["inspection"].get("valor", 0)
        if valor:
            despesas_total += valor
            detalhes.append({
                "tipo": "despesa",
                "descricao": "Inspeção",
                "data": vehicle["inspection"].get("ultima_inspecao"),
                "valor": valor
            })
    
    lucro = ganhos_total - despesas_total
    
    return {
        "ganhos_total": ganhos_total,
        "despesas_total": despesas_total,
        "lucro": lucro,
        "detalhes": sorted(detalhes, key=lambda x: x.get("data", ""), reverse=True)
    }

@api_router.post("/vehicles/{vehicle_id}/atribuir-motorista")
async def atribuir_motorista_vehicle(
    vehicle_id: str,
    data: Dict[str, str],
    current_user: Dict = Depends(get_current_user)
):
    """Atribuir motorista a um veículo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista_id = data.get("motorista_id")
    
    if motorista_id:
        # Get motorista data
        motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
        if not motorista:
            raise HTTPException(status_code=404, detail="Motorista not found")
        
        # Update vehicle
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {
                "motorista_atribuido": motorista_id,
                "motorista_atribuido_nome": motorista.get("name"),
                "status": "atribuido",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Motorista atribuído com sucesso"}
    else:
        # Remove assignment
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {
                "motorista_atribuido": None,
                "motorista_atribuido_nome": None,
                "status": "disponivel",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Motorista removido com sucesso"}

# ==================== VEHICLE DOCUMENT UPLOADS ====================

@api_router.post("/vehicles/{vehicle_id}/upload-seguro-doc")
async def upload_seguro_document(
    vehicle_id: str,
    doc_type: str = Form(...),  # carta_verde, condicoes, fatura
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload insurance documents (carta verde, condições, fatura)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create directory
    insurance_docs_dir = UPLOAD_DIR / "insurance_docs"
    insurance_docs_dir.mkdir(exist_ok=True)
    
    # Process file
    file_id = f"insurance_{doc_type}_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, insurance_docs_dir, file_id)
    
    # Update vehicle
    field_map = {
        "carta_verde": "insurance.carta_verde_url",
        "condicoes": "insurance.condicoes_url",
        "fatura": "insurance.fatura_url"
    }
    
    if doc_type not in field_map:
        raise HTTPException(status_code=400, detail="Invalid doc_type")
    
    # Get current insurance data
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    insurance = vehicle.get("insurance", {})
    if doc_type == "carta_verde":
        insurance["carta_verde_url"] = file_info["saved_path"]
    elif doc_type == "condicoes":
        insurance["condicoes_url"] = file_info["saved_path"]
    elif doc_type == "fatura":
        insurance["fatura_url"] = file_info["saved_path"]
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"insurance": insurance}}
    )
    
    return {"message": "Document uploaded successfully", "url": file_info["saved_path"]}

@api_router.post("/vehicles/{vehicle_id}/upload-inspecao-doc")
async def upload_inspecao_document(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload inspection document"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create directory
    inspection_docs_dir = UPLOAD_DIR / "inspection_docs"
    inspection_docs_dir.mkdir(exist_ok=True)
    
    # Process file
    file_id = f"inspection_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, inspection_docs_dir, file_id)
    
    # Update vehicle
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    inspection = vehicle.get("inspection", {})
    inspection["ficha_inspecao_url"] = file_info["saved_path"]
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"inspection": inspection}}
    )
    
    return {"message": "Document uploaded successfully", "url": file_info["saved_path"]}

@api_router.post("/vehicles/{vehicle_id}/upload-extintor-doc")
async def upload_extintor_document(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload fire extinguisher certificate"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create directory
    extintor_docs_dir = UPLOAD_DIR / "extintor_docs"
    extintor_docs_dir.mkdir(exist_ok=True)
    
    # Process file
    file_id = f"extintor_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, extintor_docs_dir, file_id)
    
    # Update vehicle
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    extintor = vehicle.get("extintor", {})
    # Use pdf_path if available (converted file), otherwise use original_path
    file_url = file_info.get("pdf_path") or file_info.get("original_path")
    extintor["certificado_url"] = file_url
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"extintor": extintor}}
    )
    
    return {"message": "Document uploaded successfully", "certificado_url": file_url, "file_info": file_info}

@api_router.post("/vehicles/{vehicle_id}/upload-foto")
async def upload_vehicle_photo(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload vehicle photo (max 3)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    current_photos = vehicle.get("fotos_veiculo", [])
    if len(current_photos) >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 photos allowed")
    
    # Create directory
    photos_dir = UPLOAD_DIR / "vehicle_photos_info"
    photos_dir.mkdir(exist_ok=True)
    
    # Process file
    file_id = f"photo_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, photos_dir, file_id)
    
    # Use pdf_path (converted file) or original_path if not converted
    photo_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    # Add to vehicle
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$push": {"fotos_veiculo": photo_path}}
    )
    
    return {"message": "Photo uploaded successfully", "url": photo_path}

@api_router.delete("/vehicles/{vehicle_id}/fotos/{foto_index}")
async def delete_vehicle_photo(
    vehicle_id: str,
    foto_index: int,
    current_user: Dict = Depends(get_current_user)
):
    """Delete vehicle photo by index"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    fotos = vehicle.get("fotos_veiculo", [])
    if foto_index < 0 or foto_index >= len(fotos):
        raise HTTPException(status_code=400, detail="Invalid photo index")
    
    # Remove photo
    fotos.pop(foto_index)
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"fotos_veiculo": fotos}}
    )
    
    return {"message": "Photo deleted successfully"}

# ==================== VEHICLE DOCUMENTS UPLOAD ENDPOINTS ====================

@api_router.post("/vehicles/{vehicle_id}/upload-carta-verde")
async def upload_carta_verde(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload carta verde document"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Process and save file
    file_id = f"carta_verde_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, VEHICLE_DOCS_UPLOAD_DIR, file_id)
    
    # Use pdf_path (converted file) or original_path if not converted
    document_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    # Update vehicle with document path
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"documento_carta_verde": document_path}}
    )
    
    return {"message": "Carta verde uploaded successfully", "url": document_path}

@api_router.post("/vehicles/{vehicle_id}/upload-condicoes")
async def upload_condicoes(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload condições document"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Process and save file
    file_id = f"condicoes_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, VEHICLE_DOCS_UPLOAD_DIR, file_id)
    
    # Use pdf_path (converted file) or original_path if not converted
    document_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    # Update vehicle with document path
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"documento_condicoes": document_path}}
    )
    
    return {"message": "Condições document uploaded successfully", "url": document_path}

@api_router.post("/vehicles/{vehicle_id}/upload-recibo-seguro")
async def upload_recibo_seguro(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload recibo de pagamento do seguro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Process and save file
    file_id = f"recibo_seguro_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, VEHICLE_DOCS_UPLOAD_DIR, file_id)
    
    # Use pdf_path (converted file) or original_path if not converted
    document_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    # Update vehicle with document path
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"documento_recibo_seguro": document_path}}
    )
    
    return {"message": "Recibo de seguro uploaded successfully", "url": document_path}

@api_router.post("/vehicles/{vehicle_id}/upload-documento-inspecao")
async def upload_documento_inspecao(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload documento/certificado da inspeção"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Process and save file
    file_id = f"doc_inspecao_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, VEHICLE_DOCS_UPLOAD_DIR, file_id)
    
    # Use pdf_path (converted file) or original_path if not converted
    document_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    # Update vehicle with document path
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"documento_inspecao": document_path}}
    )
    
    return {"message": "Documento de inspeção uploaded successfully", "url": document_path}

@api_router.put("/vehicles/{vehicle_id}/update-km")
async def update_vehicle_km(
    vehicle_id: str,
    data: Dict[str, int],
    current_user: Dict = Depends(get_current_user)
):
    """Update vehicle KM (can be automatic from GPS)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    km_atual = data.get("km_atual")
    if not km_atual or km_atual < 0:
        raise HTTPException(status_code=400, detail="Invalid KM value")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {
            "km_atual": km_atual,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "KM updated successfully", "km_atual": km_atual}

@api_router.put("/vehicles/{vehicle_id}/status")
async def update_vehicle_status(
    vehicle_id: str,
    data: Dict[str, str],
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar status do veículo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    status = data.get("status")
    valid_statuses = ["disponivel", "atribuido", "manutencao", "venda", "condicoes"]
    
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {', '.join(valid_statuses)}")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Status atualizado com sucesso", "status": status}

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

@api_router.post("/parceiros/register-public")
async def create_parceiro_public(parceiro_data: Dict[str, Any]):
    """Create parceiro from public registration (no auth required)"""
    parceiro_id = f"parceiro-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # Validate codigo_certidao_comercial format
    codigo_certidao = parceiro_data.get("codigo_certidao_comercial", "")
    if not codigo_certidao or not re.match(r'^\d{4}-\d{4}-\d{4}$', codigo_certidao):
        raise HTTPException(
            status_code=400, 
            detail="Código de Certidão Comercial é obrigatório e deve estar no formato xxxx-xxxx-xxxx"
        )
    
    new_parceiro = {
        "id": parceiro_id,
        "nome": parceiro_data.get("nome"),
        "email": parceiro_data.get("email"),
        "telefone": parceiro_data.get("telefone"),
        "nif": parceiro_data.get("nif"),
        "morada": parceiro_data.get("morada"),
        "codigo_postal": parceiro_data.get("codigo_postal"),
        "codigo_certidao_comercial": codigo_certidao,
        "responsavel_nome": parceiro_data.get("responsavel_nome"),
        "responsavel_contacto": parceiro_data.get("responsavel_contacto"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved": False,
        "status": "pendente"
    }
    
    await db.parceiros.insert_one(new_parceiro)
    
    return {"message": "Parceiro registered successfully", "id": parceiro_id}

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
        if "nome_empresa" not in p:
            if "empresa" in p:
                p["nome_empresa"] = p["empresa"]
            elif "nome" in p:
                p["nome_empresa"] = p["nome"]
            else:
                p["nome_empresa"] = "N/A"
        
        if "nome_manager" not in p:
            if "name" in p:
                p["nome_manager"] = p["name"]
            elif "responsavel_nome" in p:
                p["nome_manager"] = p["responsavel_nome"]
            else:
                p["nome_manager"] = "N/A"
        
        if "contribuinte_empresa" not in p and "nif" in p:
            p["contribuinte_empresa"] = p["nif"]
        if "morada_completa" not in p and "morada" in p:
            p["morada_completa"] = p["morada"]
        if "codigo_postal" not in p:
            p["codigo_postal"] = "0000-000"  # Default value
        if "localidade" not in p:
            p["localidade"] = "N/A"  # Default value
        if "telefone" not in p and "phone" in p:
            p["telefone"] = p["phone"]
        if "telemovel" not in p:
            if "responsavel_contacto" in p:
                p["telemovel"] = p["responsavel_contacto"]
            elif "phone" in p:
                p["telemovel"] = p["phone"]
            else:
                p["telemovel"] = "N/A"
        if "email" not in p:
            p["email"] = "noemail@example.com"  # Default value
        if "codigo_certidao_comercial" not in p:
            p["codigo_certidao_comercial"] = "N/A"  # Default value
        if "validade_certidao_comercial" not in p:
            p["validade_certidao_comercial"] = "2099-12-31"  # Default future date
        
        # Count vehicles and motoristas
        p["total_vehicles"] = await db.vehicles.count_documents({"parceiro_id": p["id"]})
        p["total_motoristas"] = await db.motoristas.count_documents({"parceiro_id": p["id"]})
    
    return parceiros

@api_router.get("/parceiros/{parceiro_id}")
async def get_parceiro(parceiro_id: str, current_user: Dict = Depends(get_current_user)):
    """Get specific parceiro by ID"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    # Backward compatibility
    if isinstance(parceiro.get("created_at"), str):
        parceiro["created_at"] = datetime.fromisoformat(parceiro["created_at"])
    
    return parceiro

@api_router.put("/parceiros/{parceiro_id}")
async def update_parceiro(
    parceiro_id: str,
    updates: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update parceiro data (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update parceiros")
    
    result = await db.parceiros.update_one(
        {"id": parceiro_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    return {"message": "Parceiro updated successfully"}

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

@api_router.get("/vehicles/{vehicle_id}/relatorio-intervencoes")
async def get_vehicle_interventions_report(
    vehicle_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Get comprehensive interventions report for a vehicle including:
    - Insurance (Seguro)
    - Inspection (Inspeção)
    - Fire Extinguisher (Extintor)
    - Maintenance/Revisions (Revisões)
    All with dates for past and future interventions
    """
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    interventions = []
    today = datetime.now(timezone.utc).date()
    
    # Add insurance interventions
    seguro = vehicle.get("seguro", {})
    if seguro:
        if seguro.get("data_validade"):
            interventions.append({
                "id": f"seguro_{vehicle_id}",
                "tipo": "Seguro",
                "descricao": f"Renovação de Seguro - {seguro.get('seguradora', 'N/A')}",
                "data": seguro.get("data_validade"),
                "categoria": "seguro",
                "status": "pending" if datetime.fromisoformat(seguro.get("data_validade")).date() >= today else "completed",
                "criado_por": seguro.get("criado_por"),
                "editado_por": seguro.get("editado_por")
            })
    
    # Add inspection interventions
    inspection = vehicle.get("inspection", {})
    if inspection:
        if inspection.get("data_inspecao"):
            interventions.append({
                "tipo": "Inspeção",
                "descricao": "Inspeção realizada",
                "data": inspection.get("data_inspecao"),
                "categoria": "inspecao",
                "status": "completed"
            })
        if inspection.get("proxima_inspecao"):
            interventions.append({
                "tipo": "Inspeção",
                "descricao": "Próxima Inspeção",
                "data": inspection.get("proxima_inspecao"),
                "categoria": "inspecao",
                "status": "pending" if datetime.fromisoformat(inspection.get("proxima_inspecao")).date() >= today else "completed"
            })
    
    # Add fire extinguisher interventions
    extintor = vehicle.get("extintor", {})
    if extintor:
        if extintor.get("data_instalacao") or extintor.get("data_entrega"):
            data_inst = extintor.get("data_instalacao") or extintor.get("data_entrega")
            interventions.append({
                "tipo": "Extintor",
                "descricao": "Instalação do Extintor",
                "data": data_inst,
                "categoria": "extintor",
                "status": "completed"
            })
        if extintor.get("data_validade"):
            interventions.append({
                "tipo": "Extintor",
                "descricao": "Validade do Extintor",
                "data": extintor.get("data_validade"),
                "categoria": "extintor",
                "status": "pending" if datetime.fromisoformat(extintor.get("data_validade")).date() >= today else "completed"
            })
    
    # Add maintenance/revision interventions
    manutencoes = vehicle.get("manutencoes", [])
    for manutencao in manutencoes:
        if manutencao.get("data_intervencao"):
            interventions.append({
                "tipo": "Revisão",
                "descricao": f"{manutencao.get('tipo_manutencao', 'Manutenção')} - {manutencao.get('descricao', '')}",
                "data": manutencao.get("data_intervencao"),
                "km": manutencao.get("km_intervencao"),
                "categoria": "revisao",
                "status": "completed"
            })
        if manutencao.get("data_proxima"):
            interventions.append({
                "tipo": "Revisão",
                "descricao": f"Próxima {manutencao.get('tipo_manutencao', 'Manutenção')} - {manutencao.get('o_que_fazer', '')}",
                "data": manutencao.get("data_proxima"),
                "km": manutencao.get("km_proxima"),
                "categoria": "revisao",
                "status": "pending" if datetime.fromisoformat(manutencao.get("data_proxima")).date() >= today else "completed"
            })
    
    # Sort interventions by date (most recent first)
    interventions.sort(key=lambda x: x.get("data", ""), reverse=True)
    
    return {
        "vehicle_id": vehicle_id,
        "interventions": interventions,
        "total": len(interventions)
    }

@api_router.put("/vehicles/{vehicle_id}/intervencao/{intervencao_id}")
async def update_vehicle_intervention(
    vehicle_id: str,
    intervencao_id: str,
    update_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update intervention status"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    new_status = update_data.get("status")
    user_name = current_user.get("name", current_user.get("email"))
    
    # Update based on intervention type
    if intervencao_id.startswith("seguro_"):
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {
                "seguro.status": new_status,
                "seguro.editado_por": user_name,
                "seguro.editado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
    elif intervencao_id.startswith("inspecao_"):
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {
                "inspection.status": new_status,
                "inspection.editado_por": user_name,
                "inspection.editado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
    elif intervencao_id.startswith("extintor_"):
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {
                "extintor.status": new_status,
                "extintor.editado_por": user_name,
                "extintor.editado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {"message": "Intervention updated successfully"}

@api_router.get("/vehicles/proximas-datas/dashboard")
async def get_proximas_datas_dashboard(current_user: Dict = Depends(get_current_user)):
    """
    Get dashboard with upcoming dates for all vehicles:
    - Next inspection date
    - Next revision date/km
    - Insurance renewal date
    - Fire extinguisher revision date
    """
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(length=None)
    
    dashboard_data = []
    today = datetime.now(timezone.utc).date()
    
    for vehicle in vehicles:
        # Get parceiro info
        parceiro_id = vehicle.get("parceiro_id")
        parceiro_nome = "N/A"
        if parceiro_id:
            parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0, "nome": 1})
            if parceiro:
                parceiro_nome = parceiro.get("nome", "N/A")
        
        proximas_datas = {
            "vehicle_id": vehicle.get("id"),
            "matricula": vehicle.get("matricula"),
            "marca": vehicle.get("marca"),
            "modelo": vehicle.get("modelo"),
            "parceiro_nome": parceiro_nome,
            "datas": []
        }
        
        # Próxima inspeção
        inspection = vehicle.get("inspection", {})
        if inspection.get("proxima_inspecao"):
            data_inspecao = datetime.fromisoformat(inspection.get("proxima_inspecao")).date()
            dias_restantes = (data_inspecao - today).days
            proximas_datas["datas"].append({
                "tipo": "Inspeção",
                "data": inspection.get("proxima_inspecao"),
                "dias_restantes": dias_restantes,
                "urgente": dias_restantes <= 30
            })
        
        # Renovação de seguro
        seguro = vehicle.get("seguro", {})
        if seguro.get("data_validade"):
            data_seguro = datetime.fromisoformat(seguro.get("data_validade")).date()
            dias_restantes = (data_seguro - today).days
            proximas_datas["datas"].append({
                "tipo": "Seguro",
                "data": seguro.get("data_validade"),
                "seguradora": seguro.get("seguradora"),
                "dias_restantes": dias_restantes,
                "urgente": dias_restantes <= 30
            })
        
        # Revisão do extintor
        extintor = vehicle.get("extintor", {})
        if extintor.get("data_validade"):
            data_extintor = datetime.fromisoformat(extintor.get("data_validade")).date()
            dias_restantes = (data_extintor - today).days
            proximas_datas["datas"].append({
                "tipo": "Extintor",
                "data": extintor.get("data_validade"),
                "dias_restantes": dias_restantes,
                "urgente": dias_restantes <= 30
            })
        
        # Próxima revisão
        if vehicle.get("proxima_revisao_data"):
            data_revisao = datetime.fromisoformat(vehicle.get("proxima_revisao_data")).date()
            dias_restantes = (data_revisao - today).days
            proximas_datas["datas"].append({
                "tipo": "Revisão",
                "data": vehicle.get("proxima_revisao_data"),
                "km": vehicle.get("proxima_revisao_km"),
                "dias_restantes": dias_restantes,
                "urgente": dias_restantes <= 15
            })
        
        if proximas_datas["datas"]:
            dashboard_data.append(proximas_datas)
    
    # Sort by most urgent first
    dashboard_data.sort(key=lambda x: min([d["dias_restantes"] for d in x["datas"]]) if x["datas"] else 9999)
    
    return {
        "total_vehicles": len(dashboard_data),
        "dashboard": dashboard_data
    }

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

# ==================== EXEMPLOS DE CONTRATO ====================

@api_router.get("/contratos/exemplos")
async def get_exemplos_contratos():
    """Get list of available contract examples"""
    exemplos = [
        {
            "id": "aluguer",
            "nome": "Contrato de Aluguer de Veículo TVDE",
            "tipo": "aluguer",
            "descricao": "Contrato completo de aluguer de veículo para atividade TVDE com caução e condições",
            "arquivo": "exemplo_contrato_aluguer.txt"
        },
        {
            "id": "comissao",
            "nome": "Contrato de Comissão TVDE",
            "tipo": "comissao",
            "descricao": "Contrato de prestação de serviços por comissão (percentual sobre ganhos)",
            "arquivo": "exemplo_contrato_comissao.txt"
        },
        {
            "id": "motorista_privado",
            "nome": "Contrato de Motorista Privado",
            "tipo": "motorista_privado",
            "descricao": "Contrato para motorista que conduz veículo da empresa (regime privado)",
            "arquivo": "exemplo_contrato_motorista_privado.txt"
        }
    ]
    return exemplos

@api_router.get("/contratos/exemplos/{tipo}/download")
async def download_exemplo_contrato(tipo: str):
    """Download contract example file"""
    import os
    from fastapi.responses import FileResponse
    
    arquivos = {
        "aluguer": "/app/exemplo_contrato_aluguer.txt",
        "comissao": "/app/exemplo_contrato_comissao.txt",
        "motorista_privado": "/app/exemplo_contrato_motorista_privado.txt"
    }
    
    if tipo not in arquivos:
        raise HTTPException(status_code=404, detail="Exemplo não encontrado")
    
    filepath = arquivos[tipo]
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    
    return FileResponse(
        filepath,
        media_type="text/plain",
        filename=f"exemplo_contrato_{tipo}.txt"
    )

# ==================== MINUTAS DE CONTRATO ENDPOINTS ====================

@api_router.get("/parceiros/{parceiro_id}/minutas")
async def get_minutas_parceiro(parceiro_id: str, current_user: Dict = Depends(get_current_user)):
    """Get all contract templates for a parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    minutas = await db.minutas_contrato.find({"parceiro_id": parceiro_id}, {"_id": 0}).to_list(length=None)
    return minutas

@api_router.post("/parceiros/{parceiro_id}/minutas")
async def create_minuta(parceiro_id: str, minuta_data: MinutaContratoCreate, current_user: Dict = Depends(get_current_user)):
    """Create new contract template for parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    minuta_dict = minuta_data.model_dump()
    minuta_dict["id"] = str(uuid.uuid4())
    minuta_dict["parceiro_id"] = parceiro_id
    minuta_dict["ativa"] = True
    minuta_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    minuta_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    minuta_dict["created_by"] = current_user["id"]
    
    await db.minutas_contrato.insert_one(minuta_dict)
    
    return {"message": "Minuta criada com sucesso", "id": minuta_dict["id"]}

@api_router.put("/minutas/{minuta_id}")
async def update_minuta(minuta_id: str, updates: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    """Update contract template"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.minutas_contrato.update_one(
        {"id": minuta_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Minuta not found")
    
    return {"message": "Minuta atualizada com sucesso"}

@api_router.delete("/minutas/{minuta_id}")
async def delete_minuta(minuta_id: str, current_user: Dict = Depends(get_current_user)):
    """Delete contract template"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.minutas_contrato.delete_one({"id": minuta_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Minuta not found")
    
    return {"message": "Minuta excluída com sucesso"}

# ==================== CONFIGURAÇÕES TEXTOS LEGAIS ====================

@api_router.get("/config/textos-legais")
async def get_textos_legais():
    """Public: Get legal texts (terms and privacy policy)"""
    config = await db.configuracoes.find_one({"id": "config_sistema"}, {"_id": 0})
    if not config:
        # Create default config
        default_config = {
            "id": "config_sistema",
            "condicoes_gerais": "Condições Gerais a definir...",
            "politica_privacidade": "Política de Privacidade a definir...",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": "system"
        }
        await db.configuracoes.insert_one(default_config)
        return default_config
    return config

@api_router.put("/admin/config/textos-legais")
async def update_textos_legais(config_data: ConfiguracaoUpdate, current_user: Dict = Depends(get_current_user)):
    """Admin only: Update legal texts"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized - Admin only")
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    if config_data.condicoes_gerais is not None:
        update_data["condicoes_gerais"] = config_data.condicoes_gerais
    
    if config_data.politica_privacidade is not None:
        update_data["politica_privacidade"] = config_data.politica_privacidade
    
    await db.configuracoes.update_one(
        {"id": "config_sistema"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Textos legais atualizados com sucesso", "data": update_data}

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

@api_router.post("/admin/seed-planos")
async def seed_planos(current_user: Dict = Depends(get_current_user)):
    """Admin: Seed default subscription plans"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if plans already exist
    existing_count = await db.planos.count_documents({})
    if existing_count > 0:
        return {"message": f"Planos already exist ({existing_count} planos found). Skipping seed."}
    
    default_planos = [
        # PARCEIRO PLANS
        {
            "id": str(uuid.uuid4()),
            "nome": "Parceiro Base",
            "tipo_usuario": "parceiro",
            "preco_por_unidade": 50.0,
            "descricao": "Acesso a relatórios e gestão de pagamentos",
            "features": ["relatorios", "pagamentos"],
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "nome": "Parceiro Premium",
            "tipo_usuario": "parceiro",
            "preco_por_unidade": 80.0,
            "descricao": "Base + Gestão de seguros",
            "features": ["relatorios", "pagamentos", "seguros"],
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "nome": "Parceiro Executive",
            "tipo_usuario": "parceiro",
            "preco_por_unidade": 120.0,
            "descricao": "Gestão completa: seguros, manutenções, contas e emissão de contratos",
            "features": ["relatorios", "pagamentos", "seguros", "manutencoes", "contas", "contratos"],
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        # OPERACIONAL PLANS
        {
            "id": str(uuid.uuid4()),
            "nome": "Operacional Base",
            "tipo_usuario": "operacional",
            "preco_por_unidade": 30.0,
            "descricao": "Upload CSV de ganhos Uber/Bolt, inserção manual de combustível e via verde",
            "features": ["upload_csv_ganhos", "combustivel_manual", "viaverde_manual"],
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "nome": "Operacional Premium",
            "tipo_usuario": "operacional",
            "preco_por_unidade": 50.0,
            "descricao": "Base + Upload CSV de KM + Gestão de veículos, manutenções e seguros",
            "features": ["upload_csv_ganhos", "combustivel_manual", "viaverde_manual", "upload_csv_km", "gestao_veiculos", "gestao_manutencoes", "gestao_seguros"],
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "nome": "Operacional Executive",
            "tipo_usuario": "operacional",
            "preco_por_unidade": 80.0,
            "descricao": "Premium + Ligação automática com fornecedores",
            "features": ["upload_csv_ganhos", "combustivel_manual", "viaverde_manual", "upload_csv_km", "gestao_veiculos", "gestao_manutencoes", "gestao_seguros", "integracoes_fornecedores"],
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.planos.insert_many(default_planos)
    
    return {
        "message": "Default subscription plans created successfully",
        "planos_created": len(default_planos)
    }



@api_router.post("/parceiros/{parceiro_id}/solicitar-plano")
async def solicitar_plano_parceiro(
    parceiro_id: str,
    plano_data: Dict[str, str],
    current_user: Dict = Depends(get_current_user)
):
    """Parceiro: Request a subscription plan (pending admin approval)"""
    # Check if user is the parceiro or admin
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    plano_id = plano_data.get("plano_id")
    if not plano_id:
        raise HTTPException(status_code=400, detail="plano_id required")
    
    # Check if plano exists
    plano = await db.planos.find_one({"id": plano_id}, {"_id": 0})
    if not plano:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Update parceiro with pending plan
    result = await db.parceiros.update_one(
        {"id": parceiro_id},
        {
            "$set": {
                "plano_id": plano_id,
                "plano_status": "pendente",
                "plano_solicitado_em": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    return {"message": "Plano solicitado com sucesso. Aguardando aprovação do admin.", "plano_status": "pendente"}

@api_router.post("/admin/parceiros/{parceiro_id}/aprovar-plano")
async def aprovar_plano_parceiro(
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Admin: Approve parceiro's plan request"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get parceiro
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    if not parceiro.get("plano_id"):
        raise HTTPException(status_code=400, detail="Parceiro has no plan request")
    
    # Approve plan
    result = await db.parceiros.update_one(
        {"id": parceiro_id},
        {
            "$set": {
                "plano_status": "ativo",
                "plano_aprovado_em": datetime.now(timezone.utc).isoformat(),
                "plano_aprovado_por": current_user["id"]
            }
        }
    )
    
    return {"message": "Plano aprovado com sucesso!", "plano_status": "ativo"}

@api_router.post("/admin/parceiros/{parceiro_id}/atribuir-plano")
async def atribuir_plano_parceiro(
    parceiro_id: str,
    plano_data: Dict[str, str],
    current_user: Dict = Depends(get_current_user)
):
    """Admin: Assign subscription plan to parceiro (direct assignment, auto-approved)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    plano_id = plano_data.get("plano_id")
    if not plano_id:
        raise HTTPException(status_code=400, detail="plano_id required")
    
    # Check if plano exists
    plano = await db.planos.find_one({"id": plano_id}, {"_id": 0})
    if not plano:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Update parceiro
    result = await db.users.update_one(
        {"id": parceiro_id, "role": "parceiro"},
        {"$set": {
            "plano_id": plano_id,
            "plano_status": "ativo",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    return {"message": "Plan assigned successfully", "plano_id": plano_id}

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

# ==================== CSV UPLOAD ENDPOINTS ====================

@api_router.post("/operacional/upload-csv-uber")
async def upload_csv_uber(
    file: UploadFile = File(...),
    parceiro_id: str = Form(...),
    periodo_inicio: str = Form(...),
    periodo_fim: str = Form(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload Uber CSV earnings file (parceiro/operacional data)"""
    # Check feature access
    if not await check_feature_access(current_user, "upload_csv_ganhos"):
        raise HTTPException(
            status_code=403,
            detail="Upgrade para plano com acesso a upload de CSVs"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Process CSV (parceiro_id instead of motorista_id)
    result = await process_uber_csv(file_content, parceiro_id, periodo_inicio, periodo_fim)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@api_router.post("/operacional/upload-csv-bolt")
async def upload_csv_bolt(
    file: UploadFile = File(...),
    parceiro_id: str = Form(...),
    periodo_inicio: str = Form(...),
    periodo_fim: str = Form(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload Bolt CSV earnings file (parceiro/operacional data)"""
    # Check feature access
    if not await check_feature_access(current_user, "upload_csv_ganhos"):
        raise HTTPException(
            status_code=403,
            detail="Upgrade para plano com acesso a upload de CSVs"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Process CSV (parceiro_id instead of motorista_id)
    result = await process_bolt_csv(file_content, parceiro_id, periodo_inicio, periodo_fim)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@api_router.post("/operacional/upload-excel-combustivel")
async def upload_excel_combustivel(
    file: UploadFile = File(...),
    parceiro_id: str = Form(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload Prio/Combustível Excel file (parceiro/operacional data)"""
    # Check feature access (manual input is allowed in base plan)
    if not await check_feature_access(current_user, "combustivel_manual"):
        raise HTTPException(
            status_code=403,
            detail="Sem acesso a gestão de combustível"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Process Excel (parceiro_id instead of motorista_id)
    result = await process_prio_excel(file_content, parceiro_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@api_router.get("/operacional/ganhos-motorista/{motorista_id}")
async def get_ganhos_motorista(
    motorista_id: str,
    periodo_inicio: Optional[str] = None,
    periodo_fim: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Get motorista earnings from Uber and Bolt"""
    query = {"motorista_id": motorista_id}
    
    if periodo_inicio and periodo_fim:
        # Filter by period
        query["periodo_inicio"] = {"$gte": periodo_inicio}
        query["periodo_fim"] = {"$lte": periodo_fim}
    
    # Get Uber earnings
    ganhos_uber = await db.ganhos_uber.find(query, {"_id": 0}).to_list(100)
    total_uber = sum(g["total_pago"] for g in ganhos_uber)
    
    # Get Bolt earnings
    ganhos_bolt = await db.ganhos_bolt.find(query, {"_id": 0}).to_list(100)
    total_bolt = sum(g["ganhos_liquidos"] for g in ganhos_bolt)
    
    # Get fuel transactions
    fuel_query = {"motorista_id": motorista_id}
    if periodo_inicio and periodo_fim:
        fuel_query["data_transacao"] = {"$gte": periodo_inicio, "$lte": periodo_fim}
    
    transacoes_combustivel = await db.transacoes_combustivel.find(fuel_query, {"_id": 0}).to_list(500)
    total_combustivel = sum(t["total"] for t in transacoes_combustivel)
    
    return {
        "motorista_id": motorista_id,
        "periodo": {
            "inicio": periodo_inicio,
            "fim": periodo_fim
        },
        "uber": {
            "registos": len(ganhos_uber),
            "total": total_uber
        },
        "bolt": {
            "registos": len(ganhos_bolt),
            "total": total_bolt
        },
        "combustivel": {
            "transacoes": len(transacoes_combustivel),
            "total": total_combustivel
        },
        "resumo": {
            "ganhos_totais": total_uber + total_bolt,
            "despesas_combustivel": total_combustivel,
            "liquido": (total_uber + total_bolt) - total_combustivel
        }
    }

@api_router.get("/operacional/csv-importados/{motorista_id}")
async def listar_csv_importados(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """List all imported CSVs for a motorista"""
    # Get Uber CSVs
    uber_imports = await db.ganhos_uber.find(
        {"motorista_id": motorista_id},
        {"_id": 0, "id": 1, "periodo_inicio": 1, "periodo_fim": 1, "total_pago": 1, "csv_original": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    
    # Get Bolt CSVs
    bolt_imports = await db.ganhos_bolt.find(
        {"motorista_id": motorista_id},
        {"_id": 0, "id": 1, "periodo_inicio": 1, "periodo_fim": 1, "ganhos_liquidos": 1, "csv_original": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    
    # Get Combustivel Excel
    combustivel_imports = await db.transacoes_combustivel.aggregate([
        {"$match": {"motorista_id": motorista_id}},
        {"$group": {
            "_id": "$excel_original",
            "data_primeiro": {"$min": "$data_transacao"},
            "data_ultimo": {"$max": "$data_transacao"},
            "total_transacoes": {"$sum": 1},
            "total_valor": {"$sum": "$total"}
        }},
        {"$sort": {"data_ultimo": -1}}
    ]).to_list(100)
    
    return {
        "motorista_id": motorista_id,
        "uber": {
            "total_imports": len(uber_imports),
            "imports": uber_imports
        },
        "bolt": {
            "total_imports": len(bolt_imports),
            "imports": bolt_imports
        },
        "combustivel": {
            "total_imports": len(combustivel_imports),
            "imports": combustivel_imports
        }
    }

# ==================== CONTRATOS ENDPOINTS ====================

@api_router.post("/contratos/gerar")
async def gerar_contrato(
    parceiro_id: str = Form(...),
    motorista_id: str = Form(...),
    veiculo_id: str = Form(...),
    current_user: Dict = Depends(get_current_user)
):
    """Generate contract PDF (Parceiro Executive feature)"""
    # Check feature access
    if not await check_feature_access(current_user, "contratos"):
        raise HTTPException(
            status_code=403,
            detail="Upgrade para Parceiro Executive para emitir contratos"
        )
    
    # Get data
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    veiculo = await db.vehicles.find_one({"id": veiculo_id}, {"_id": 0})
    
    if not parceiro or not motorista or not veiculo:
        raise HTTPException(status_code=404, detail="Dados não encontrados")
    
    # Generate PDF
    pdf_path = await generate_contrato_pdf(parceiro, motorista, veiculo)
    
    # Store contract record
    contrato = {
        "id": str(uuid.uuid4()),
        "parceiro_id": parceiro_id,
        "motorista_id": motorista_id,
        "veiculo_id": veiculo_id,
        "tipo_contrato": veiculo["tipo_contrato"]["tipo"],
        "pdf_url": pdf_path,
        "dados_contrato": {
            "parceiro": parceiro.get("nome_empresa"),
            "motorista": motorista.get("name"),
            "veiculo": f"{veiculo.get('marca')} {veiculo.get('modelo')} - {veiculo.get('matricula')}"
        },
        "status": "gerado",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "assinado_em": None
    }
    
    await db.contratos.insert_one(contrato)
    
    return {
        "success": True,
        "contrato_id": contrato["id"],
        "pdf_url": pdf_path,
        "message": "Contrato gerado com sucesso"
    }

@api_router.get("/contratos")
async def listar_contratos(
    status: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List all contracts"""
    query = {}
    if status:
        query["status"] = status
    
    contratos = await db.contratos.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return contratos

@api_router.put("/contratos/{contrato_id}/assinar")
async def assinar_contrato(
    contrato_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Mark contract as signed"""
    result = await db.contratos.update_one(
        {"id": contrato_id},
        {
            "$set": {
                "status": "assinado",
                "assinado_em": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contrato not found")
    
    return {"message": "Contrato marcado como assinado"}

# ==================== BILLING/FATURAS ENDPOINTS ====================

@api_router.post("/admin/gerar-faturas-mensais")
async def gerar_faturas_mensais(
    mes_referencia: str = Form(...),  # Format: "2025-11"
    current_user: Dict = Depends(get_current_user)
):
    """Admin: Generate monthly invoices for all active subscriptions"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all active subscriptions
    subscriptions = await db.subscriptions.find({"status": "ativo"}, {"_id": 0}).to_list(1000)
    
    faturas_geradas = []
    
    for sub in subscriptions:
        # Get plan details
        plano = await db.planos.find_one({"id": sub["plano_id"]}, {"_id": 0})
        if not plano:
            continue
        
        # Calculate units (vehicles for parceiro, motoristas for operacional)
        user = await db.users.find_one({"id": sub["user_id"]}, {"_id": 0})
        
        if user["role"] == "parceiro":
            # Count vehicles
            unidades = await db.vehicles.count_documents({"parceiro_id": sub["user_id"]})
        elif user["role"] == "operacional":
            # Count motoristas
            unidades = await db.motoristas.count_documents({"parceiro_atribuido": sub["user_id"]})
        else:
            unidades = 0
        
        valor_total = plano["preco_por_unidade"] * unidades
        
        # Update subscription units
        await db.subscriptions.update_one(
            {"id": sub["id"]},
            {"$set": {"unidades_ativas": unidades, "valor_mensal": valor_total}}
        )
        
        # Create invoice
        data_emissao = datetime.now().strftime("%Y-%m-%d")
        data_vencimento = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        fatura = {
            "id": str(uuid.uuid4()),
            "subscription_id": sub["id"],
            "user_id": sub["user_id"],
            "periodo_referencia": mes_referencia,
            "valor_total": valor_total,
            "unidades_cobradas": unidades,
            "status": "pendente",
            "pdf_url": None,  # TODO: Generate invoice PDF
            "data_emissao": data_emissao,
            "data_vencimento": data_vencimento,
            "data_pagamento": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.faturas.insert_one(fatura)
        faturas_geradas.append(fatura)
    
    return {
        "message": "Faturas mensais geradas",
        "total_faturas": len(faturas_geradas),
        "valor_total": sum(f["valor_total"] for f in faturas_geradas)
    }

@api_router.get("/faturas/me")
async def minhas_faturas(current_user: Dict = Depends(get_current_user)):
    """Get my invoices"""
    faturas = await db.faturas.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return faturas

@api_router.put("/admin/faturas/{fatura_id}/marcar-paga")
async def marcar_fatura_paga(
    fatura_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Admin: Mark invoice as paid"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.faturas.update_one(
        {"id": fatura_id},
        {
            "$set": {
                "status": "paga",
                "data_pagamento": datetime.now().strftime("%Y-%m-%d")
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Fatura not found")
    
    return {"message": "Fatura marcada como paga"}

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

@api_router.get("/files/{folder}/{filename:path}")
async def serve_file(folder: str, filename: str, current_user: Dict = Depends(get_current_user)):
    """Serve uploaded files (supports subfolders)"""
    allowed_folders = ["motoristas", "pagamentos", "vehicles", "vehicle_documents", "vehicle_photos_info", "extintor_docs"]
    
    if folder not in allowed_folders:
        raise HTTPException(status_code=400, detail="Invalid folder")
    
    # Build file path (filename can include subfolders like "motorista-001/file.pdf")
    file_path = UPLOAD_DIR / folder / filename
    
    # Security check: ensure path is within allowed folder
    try:
        file_path = file_path.resolve()
        allowed_base = (UPLOAD_DIR / folder).resolve()
        if not str(file_path).startswith(str(allowed_base)):
            raise HTTPException(status_code=403, detail="Access denied")
    except:
        raise HTTPException(status_code=400, detail="Invalid file path")
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)


@api_router.get("/users/pending")
async def get_pending_users(current_user: Dict = Depends(get_current_user)):
    """Get all pending users waiting for approval (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Get motoristas with status pending
    pending_motoristas = await db.motoristas.find(
        {"status": "pending"},
        {"_id": 0}
    ).to_list(length=None)
    
    return {
        "pending_count": len(pending_motoristas),
        "pending_users": pending_motoristas
    }

@api_router.get("/users/all")
async def get_all_users(current_user: Dict = Depends(get_current_user)):
    """Get all users (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Get all users from users collection
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(length=None)
    
    # Separate pending and approved users
    pending_users = []
    registered_users = []
    
    for user in users:
        # Convert created_at to datetime if string
        if isinstance(user.get("created_at"), str):
            user["created_at"] = datetime.fromisoformat(user["created_at"])
        
        if user.get("approved", False):
            registered_users.append(user)
        else:
            pending_users.append(user)
    
    return {
        "pending_users": pending_users,
        "registered_users": registered_users,
        "pending_count": len(pending_users),
        "registered_count": len(registered_users)
    }

@api_router.put("/users/{user_id}/approve")
async def approve_user(
    user_id: str,
    approval_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Approve a pending user and optionally set role (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")
    
    new_role = approval_data.get("role")
    valid_roles = ["motorista", "operacional", "gestao", "parceiro", "admin"]
    
    if new_role and new_role not in valid_roles:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Build update document
    update_doc = {"approved": True, "approved_at": datetime.now(timezone.utc).isoformat()}
    
    if new_role:
        update_doc["role"] = new_role
    
    # Update in users collection
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": update_doc}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If user has motorista role, also update motoristas collection
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user and user.get("role") == "motorista":
        await db.motoristas.update_one(
            {"id": user_id},
            {"$set": {"status": "approved", "approved": True}}
        )
    
    return {"message": "User approved successfully"}

@api_router.put("/users/{user_id}/set-role")
async def set_user_role(
    user_id: str,
    role_data: Dict[str, str],
    current_user: Dict = Depends(get_current_user)
):
    """Set role for a user (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")
    
    new_role = role_data.get("role")
    valid_roles = ["motorista", "operacional", "gestao", "parceiro", "admin"]
    
    if new_role not in valid_roles:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Update in users collection
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": new_role}}
    )
    
    # If user is motorista, also update motoristas collection
    if new_role == "motorista":
        await db.motoristas.update_one(
            {"id": user_id},
            {"$set": {"role": new_role}}
        )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Role updated successfully"}

@api_router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status_data: Dict[str, str],
    current_user: Dict = Depends(get_current_user)
):
    """Update user status - block/unblock (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")
    
    new_status = status_data.get("status")
    valid_statuses = ["active", "blocked", "pendente"]
    
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Update in users collection
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": new_status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User status updated to {new_status}"}

@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete/reject a user (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Check if trying to delete self
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Delete from users collection
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete from motoristas collection if exists
    await db.motoristas.delete_one({"id": user_id})
    
    return {"message": "User deleted successfully"}


# ==================== CONFIGURAÇÕES ====================
@api_router.get("/configuracoes/email")
async def get_email_config(current_user: Dict = Depends(get_current_user)):
    """Get email configuration (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")
    
    config = await db.configuracoes.find_one({"tipo": "email"}, {"_id": 0})
    if not config:
        # Return default config
        return {
            "email_contacto": "info@tvdefleet.com",
            "telefone_contacto": "",
            "morada_empresa": "Lisboa, Portugal",
            "nome_empresa": "TVDEFleet"
        }
    return config

@api_router.post("/configuracoes/email")
async def save_email_config(
    config_data: Dict[str, str],
    current_user: Dict = Depends(get_current_user)
):
    """Save email configuration (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")
    
    config_data["tipo"] = "email"
    config_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    config_data["updated_by"] = current_user["id"]
    
    await db.configuracoes.update_one(
        {"tipo": "email"},
        {"$set": config_data},
        upsert=True
    )
    
    return {"message": "Configuration saved successfully"}


# ==================== PUBLIC ENDPOINTS (NO AUTH) ====================
# =============================================================================
# SINCRONIZAÇÃO AUTOMÁTICA DE PLATAFORMAS
# =============================================================================

from sync_platforms import encrypt_password, decrypt_password, sync_platform
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# Scheduler global
scheduler = AsyncIOScheduler()

@app.post("/api/credenciais-plataforma")
async def salvar_credenciais_plataforma(
    plataforma: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    sincronizacao_automatica: bool = Form(False),
    horario_sincronizacao: Optional[str] = Form(None),
    frequencia_dias: int = Form(7),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Salva credenciais de uma plataforma"""
    try:
        user = await verify_token(credentials)
        if user['role'] not in ['admin', 'manager']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Encriptar password
        password_encrypted = encrypt_password(password)
        
        # Verificar se já existe
        existing = await db.credenciais_plataforma.find_one({'plataforma': plataforma})
        
        if existing:
            # Atualizar
            await db.credenciais_plataforma.update_one(
                {'plataforma': plataforma},
                {'$set': {
                    'email': email,
                    'password_encrypted': password_encrypted,
                    'sincronizacao_automatica': sincronizacao_automatica,
                    'horario_sincronizacao': horario_sincronizacao,
                    'frequencia_dias': frequencia_dias,
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
            cred_id = existing['id']
        else:
            # Criar novo
            credencial = {
                'id': str(uuid.uuid4()),
                'plataforma': plataforma,
                'email': email,
                'password_encrypted': password_encrypted,
                'ativo': True,
                'sincronizacao_automatica': sincronizacao_automatica,
                'horario_sincronizacao': horario_sincronizacao,
                'frequencia_dias': frequencia_dias,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }
            await db.credenciais_plataforma.insert_one(credencial)
            cred_id = credencial['id']
        
        # Se sincronização automática ativada, agendar job
        if sincronizacao_automatica and horario_sincronizacao:
            await agendar_sincronizacao(plataforma, horario_sincronizacao, frequencia_dias)
        
        return {'success': True, 'message': 'Credenciais salvas com sucesso', 'id': cred_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/credenciais-plataforma")
async def listar_credenciais_plataformas(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Lista todas as credenciais de plataformas (sem passwords)"""
    try:
        user = await verify_token(credentials)
        if user['role'] not in ['admin', 'manager']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        credenciais = await db.credenciais_plataforma.find().to_list(length=None)
        
        # Remover passwords encriptadas da resposta
        for cred in credenciais:
            cred.pop('password_encrypted', None)
        
        return credenciais
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sincronizar/{plataforma}")
async def sincronizar_plataforma_manual(
    plataforma: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Sincroniza manualmente uma plataforma"""
    try:
        user = await verify_token(credentials)
        if user['role'] not in ['admin', 'manager']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Buscar credenciais
        cred = await db.credenciais_plataforma.find_one({'plataforma': plataforma})
        if not cred:
            raise HTTPException(status_code=404, detail="Credenciais não configuradas")
        
        # Criar log de sincronização
        log = {
            'id': str(uuid.uuid4()),
            'plataforma': plataforma,
            'tipo_sincronizacao': 'manual',
            'status': 'em_progresso',
            'data_inicio': datetime.now(timezone.utc),
            'executado_por': user['id']
        }
        await db.logs_sincronizacao.insert_one(log)
        
        # Executar sincronização
        sucesso, file_path, mensagem = await sync_platform(
            plataforma, 
            cred['email'], 
            cred['password_encrypted'],
            headless=True
        )
        
        if sucesso:
            # Processar ficheiro baixado
            if plataforma == 'uber':
                # Importar usando a função existente de import Uber
                with open(file_path, 'rb') as f:
                    contents = f.read()
                    decoded = contents.decode('utf-8')
                    csv_reader = csv.DictReader(io.StringIO(decoded))
                    
                    registos_importados = 0
                    for row in csv_reader:
                        # Processar igual ao endpoint de import manual
                        registos_importados += 1
            
            # Atualizar log
            await db.logs_sincronizacao.update_one(
                {'id': log['id']},
                {'$set': {
                    'status': 'sucesso',
                    'data_fim': datetime.now(timezone.utc),
                    'registos_importados': registos_importados if 'registos_importados' in locals() else 0,
                    'mensagem': mensagem
                }}
            )
            
            # Atualizar última sincronização
            await db.credenciais_plataforma.update_one(
                {'plataforma': plataforma},
                {'$set': {'ultima_sincronizacao': datetime.now(timezone.utc)}}
            )
            
            # Limpar ficheiro temporário
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
            
            return {'success': True, 'message': 'Sincronização concluída com sucesso'}
        else:
            # Atualizar log com erro
            await db.logs_sincronizacao.update_one(
                {'id': log['id']},
                {'$set': {
                    'status': 'erro',
                    'data_fim': datetime.now(timezone.utc),
                    'mensagem': mensagem
                }}
            )
            return {'success': False, 'message': mensagem}
            
    except Exception as e:
        logger.error(f"Erro ao sincronizar {plataforma}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs-sincronizacao")
async def listar_logs_sincronizacao(
    plataforma: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Lista histórico de sincronizações"""
    try:
        user = await verify_token(credentials)
        
        query = {}
        if plataforma:
            query['plataforma'] = plataforma
        
        logs = await db.logs_sincronizacao.find(query).sort('data_inicio', -1).limit(100).to_list(length=None)
        return logs
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def agendar_sincronizacao(plataforma: str, horario: str, frequencia_dias: int):
    """Agenda sincronização automática"""
    try:
        # Parse horário (ex: "09:00")
        hora, minuto = map(int, horario.split(':'))
        
        # Criar job ID único
        job_id = f"sync_{plataforma}"
        
        # Remover job existente se houver
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
        
        # Adicionar novo job
        scheduler.add_job(
            executar_sincronizacao_automatica,
            CronTrigger(hour=hora, minute=minuto, day_of_week='*/' + str(frequencia_dias)),
            id=job_id,
            args=[plataforma],
            replace_existing=True
        )
        
        logger.info(f"Sincronização agendada para {plataforma} às {horario} a cada {frequencia_dias} dias")
        
    except Exception as e:
        logger.error(f"Erro ao agendar sincronização: {e}")

async def executar_sincronizacao_automatica(plataforma: str):
    """Executa sincronização automática agendada"""
    try:
        logger.info(f"Executando sincronização automática: {plataforma}")
        
        # Buscar credenciais
        cred = await db.credenciais_plataforma.find_one({'plataforma': plataforma})
        if not cred or not cred.get('ativo'):
            logger.warning(f"Credenciais inativas ou não encontradas: {plataforma}")
            return
        
        # Criar log
        log = {
            'id': str(uuid.uuid4()),
            'plataforma': plataforma,
            'tipo_sincronizacao': 'automatico',
            'status': 'em_progresso',
            'data_inicio': datetime.now(timezone.utc)
        }
        await db.logs_sincronizacao.insert_one(log)
        
        # Executar sincronização
        sucesso, file_path, mensagem = await sync_platform(
            plataforma, 
            cred['email'], 
            cred['password_encrypted'],
            headless=True
        )
        
        if sucesso:
            # Processar ficheiro (igual ao manual)
            await db.logs_sincronizacao.update_one(
                {'id': log['id']},
                {'$set': {
                    'status': 'sucesso',
                    'data_fim': datetime.now(timezone.utc),
                    'mensagem': mensagem
                }}
            )
            await db.credenciais_plataforma.update_one(
                {'plataforma': plataforma},
                {'$set': {'ultima_sincronizacao': datetime.now(timezone.utc)}}
            )
            
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
        else:
            await db.logs_sincronizacao.update_one(
                {'id': log['id']},
                {'$set': {
                    'status': 'erro',
                    'data_fim': datetime.now(timezone.utc),
                    'mensagem': mensagem
                }}
            )
            
    except Exception as e:
        logger.error(f"Erro na sincronização automática de {plataforma}: {e}")

# =============================================================================
# IMPORTAÇÃO DE GANHOS UBER
# =============================================================================

@app.post("/api/import/uber/ganhos")
async def importar_ganhos_uber(
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Importa ficheiro CSV de ganhos da Uber"""
    try:
        # Verificar autenticação
        user = await verify_token(credentials)
        if user['role'] not in ['admin', 'manager']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Ler conteúdo do ficheiro
        contents = await file.read()
        decoded = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded))
        
        ganhos_importados = []
        motoristas_encontrados = 0
        motoristas_nao_encontrados = 0
        erros = []
        total_ganhos = 0.0
        
        # Extrair período do nome do ficheiro (ex: 20251110-20251116)
        periodo_match = re.search(r'(\d{8})-(\d{8})', file.filename)
        periodo_inicio = None
        periodo_fim = None
        if periodo_match:
            periodo_inicio = periodo_match.group(1)
            periodo_fim = periodo_match.group(2)
        
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                uuid_motorista = row.get('UUID do motorista', '').strip()
                if not uuid_motorista:
                    continue
                
                # Procurar motorista pelo UUID
                motorista = await db.motoristas.find_one({'uuid_motorista_uber': uuid_motorista})
                motorista_id = motorista['id'] if motorista else None
                
                if motorista:
                    motoristas_encontrados += 1
                else:
                    motoristas_nao_encontrados += 1
                
                # Função helper para converter valores
                def parse_float(value):
                    if not value or value == '':
                        return 0.0
                    try:
                        return float(value.replace(',', '.'))
                    except:
                        return 0.0
                
                # Extrair valores do CSV
                pago_total = parse_float(row.get('Pago a si', '0'))
                rendimentos_total = parse_float(row.get('Pago a si : Os seus rendimentos', '0'))
                
                ganho = {
                    'id': str(uuid.uuid4()),
                    'uuid_motorista_uber': uuid_motorista,
                    'motorista_id': motorista_id,
                    'nome_motorista': row.get('Nome próprio do motorista', ''),
                    'apelido_motorista': row.get('Apelido do motorista', ''),
                    'periodo_inicio': periodo_inicio,
                    'periodo_fim': periodo_fim,
                    'pago_total': pago_total,
                    'rendimentos_total': rendimentos_total,
                    'dinheiro_recebido': parse_float(row.get('Pago a si : Saldo da viagem : Pagamentos : Dinheiro recebido', '0')),
                    'tarifa_total': parse_float(row.get('Pago a si : Os seus rendimentos : Tarifa', '0')),
                    'tarifa_base': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Tarifa', '0')),
                    'tarifa_ajuste': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Ajuste', '0')),
                    'tarifa_cancelamento': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Cancelamento', '0')),
                    'tarifa_dinamica': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Tarifa dinâmica', '0')),
                    'taxa_reserva': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Taxa de reserva', '0')),
                    'uber_priority': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:UberX Priority', '0')),
                    'tempo_espera': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Tempo de espera na recolha', '0')),
                    'taxa_servico': parse_float(row.get('Pago a si:Os seus rendimentos:Taxa de serviço', '0')),
                    'imposto_tarifa': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Imposto sobre a tarifa', '0')),
                    'taxa_aeroporto': parse_float(row.get('Pago a si:Os seus rendimentos:Outros rendimentos:Taxa de aeroporto', '0')),
                    'gratificacao': parse_float(row.get('Pago a si:Os seus rendimentos:Gratificação', '0')),
                    'portagens': parse_float(row.get('Pago a si:Saldo da viagem:Reembolsos:Portagem', '0')),
                    'ajustes': parse_float(row.get('Pago a si:Os seus rendimentos:Outros rendimentos:Ajuste', '0')),
                    'ficheiro_nome': file.filename,
                    'data_importacao': datetime.now(timezone.utc),
                    'importado_por': user['id']
                }
                
                # Salvar no banco
                await db.ganhos_uber.insert_one(ganho)
                ganhos_importados.append(ganho)
                total_ganhos += pago_total
                
            except Exception as e:
                erros.append(f"Linha {row_num}: {str(e)}")
        
        return {
            'success': True,
            'total_linhas': len(ganhos_importados),
            'motoristas_encontrados': motoristas_encontrados,
            'motoristas_nao_encontrados': motoristas_nao_encontrados,
            'total_ganhos': round(total_ganhos, 2),
            'ganhos_importados': ganhos_importados[:10],  # Primeiros 10 para preview
            'erros': erros
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao importar ficheiro: {str(e)}")

@app.get("/api/ganhos-uber")
async def listar_ganhos_uber(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    motorista_id: Optional[str] = None,
    periodo_inicio: Optional[str] = None,
    periodo_fim: Optional[str] = None
):
    """Lista ganhos importados da Uber"""
    try:
        user = await verify_token(credentials)
        
        query = {}
        if motorista_id:
            query['motorista_id'] = motorista_id
        if periodo_inicio:
            query['periodo_inicio'] = periodo_inicio
        if periodo_fim:
            query['periodo_fim'] = periodo_fim
        
        ganhos = await db.ganhos_uber.find(query).sort('data_importacao', -1).to_list(length=None)
        return ganhos
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/public/veiculos")
async def get_public_veiculos():
    """Get public vehicles available for sale or rent"""
    veiculos = await db.vehicles.find({
        "$or": [
            {"disponivel_venda": True},
            {"disponivel_aluguer": True}
        ]
    }, {"_id": 0}).to_list(length=None)
    
    # Convert datetime fields
    for v in veiculos:
        if isinstance(v.get("created_at"), str):
            v["created_at"] = datetime.fromisoformat(v["created_at"])
        if isinstance(v.get("updated_at"), str):
            v["updated_at"] = datetime.fromisoformat(v["updated_at"])
    
    return veiculos

@app.post("/api/public/contacto")
async def public_contacto(contacto_data: Dict[str, Any]):
    """Receive public contact form (sends email to configured address)"""
    # Get email config
    config = await db.configuracoes.find_one({"tipo": "email"}, {"_id": 0})
    email_destino = config.get("email_contacto", "info@tvdefleet.com") if config else "info@tvdefleet.com"
    
    # Save contact to database
    contacto_id = f"contacto-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    contacto_data["id"] = contacto_id
    contacto_data["created_at"] = datetime.now(timezone.utc).isoformat()
    contacto_data["status"] = "pendente"
    contacto_data["email_destino"] = email_destino
    
    await db.contactos.insert_one(contacto_data)
    
    # Send notification email to admin
    await enviar_notificacao_contacto(contacto_data, email_destino)
    
    return {"message": "Contact received successfully", "id": contacto_id}

async def enviar_notificacao_contacto(contacto: Dict[str, Any], email_destino: str):
    """Send email notification about new contact (placeholder for email service)"""
    # This is a placeholder. In production, integrate with email service like SendGrid, AWS SES, etc.
    # For now, we just log it
    print(f"📧 NOVO CONTACTO RECEBIDO:")
    print(f"   Para: {email_destino}")
    print(f"   De: {contacto.get('nome')} ({contacto.get('email')})")
    print(f"   Assunto: {contacto.get('assunto', 'Contacto do Website')}")
    print(f"   Mensagem: {contacto.get('mensagem')}")
    print(f"   Telefone: {contacto.get('telefone')}")
    
    # Save to email queue for manual sending or integration later
    await db.email_queue.insert_one({
        "to": email_destino,
        "from": "noreply@tvdefleet.com",
        "subject": f"Novo Contacto: {contacto.get('assunto', 'Website')}",
        "body": f"""
        Novo contacto recebido através do website:
        
        Nome: {contacto.get('nome')}
        Email: {contacto.get('email')}
        Telefone: {contacto.get('telefone')}
        Assunto: {contacto.get('assunto', 'N/A')}
        
        Mensagem:
        {contacto.get('mensagem')}
        
        ---
        ID: {contacto.get('id')}
        Data: {contacto.get('created_at')}
        """,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "tipo": "notificacao_contacto"
    })

@app.get("/api/public/parceiros")
async def get_public_parceiros():
    """Get public list of partners"""
    parceiros = await db.parceiros.find({}, {"_id": 0}).to_list(length=None)
    return parceiros

# ==================== CONTRACT ENDPOINTS ====================

@api_router.post("/contratos/gerar")
async def gerar_contrato(contrato_data: ContratoCreate, current_user: Dict = Depends(get_current_user)):
    """Generate a new contract between parceiro, motorista and vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # Get parceiro data
        parceiro_user = await db.users.find_one({"id": contrato_data.parceiro_id}, {"_id": 0})
        parceiro = await db.parceiros.find_one({"id": contrato_data.parceiro_id}, {"_id": 0})
        if not parceiro and not parceiro_user:
            raise HTTPException(status_code=404, detail="Parceiro not found")
        
        # Get motorista data
        motorista = await db.motoristas.find_one({"id": contrato_data.motorista_id}, {"_id": 0})
        if not motorista:
            raise HTTPException(status_code=404, detail="Motorista not found")
        
        # Get vehicle data
        vehicle = await db.vehicles.find_one({"id": contrato_data.vehicle_id}, {"_id": 0})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        # Generate referencia (count existing contracts + 1)
        contract_count = await db.contratos.count_documents({})
        ano = datetime.now().year
        referencia = f"{str(contract_count + 1).zfill(3)}/{ano}"
        
        # Create contract
        contrato_id = str(uuid.uuid4())
        
        # Use parceiro data (prefer parceiros collection, fallback to users)
        parceiro_data = parceiro if parceiro else parceiro_user
        
        contrato = {
            "id": contrato_id,
            "referencia": referencia,
            "parceiro_id": contrato_data.parceiro_id,
            "motorista_id": contrato_data.motorista_id,
            "vehicle_id": contrato_data.vehicle_id,
            
            # Dados Parceiro Completos
            "parceiro_nome": parceiro_data.get("nome_empresa") or parceiro_data.get("nome") or parceiro_data.get("name"),
            "parceiro_nif": parceiro_data.get("contribuinte_empresa") or parceiro_data.get("nif"),
            "parceiro_morada": parceiro_data.get("morada_completa") or parceiro_data.get("morada") or "",
            "parceiro_codigo_postal": parceiro_data.get("codigo_postal") or "",
            "parceiro_localidade": parceiro_data.get("localidade") or "",
            "parceiro_telefone": parceiro_data.get("telefone") or parceiro_data.get("telemovel") or "",
            "parceiro_email": parceiro_data.get("email_empresa") or parceiro_data.get("email"),
            "parceiro_representante_legal_nome": parceiro_data.get("representante_legal_nome") or parceiro_data.get("nome_manager") or "",
            "parceiro_representante_legal_contribuinte": parceiro_data.get("representante_legal_contribuinte") or "",
            "parceiro_representante_legal_cc": parceiro_data.get("representante_legal_cc") or "",
            "parceiro_representante_legal_cc_validade": parceiro_data.get("representante_legal_cc_validade") or "",
            "parceiro_representante_legal_telefone": parceiro_data.get("representante_legal_telefone") or "",
            "parceiro_representante_legal_email": parceiro_data.get("representante_legal_email") or "",
            
            # Dados Motorista Completos
            "motorista_nome": motorista.get("name"),
            "motorista_cc": motorista.get("cc_numero") or motorista.get("numero_cc") or "",
            "motorista_cc_validade": motorista.get("cc_validade") or "",
            "motorista_nif": motorista.get("nif") or "",
            "motorista_morada": motorista.get("morada") or "",
            "motorista_codigo_postal": motorista.get("codigo_postal") or "",
            "motorista_localidade": motorista.get("localidade") or "",
            "motorista_telefone": motorista.get("telefone") or motorista.get("telemovel") or "",
            "motorista_carta_conducao": motorista.get("carta_conducao") or motorista.get("numero_carta") or "",
            "motorista_carta_conducao_validade": motorista.get("carta_validade") or motorista.get("carta_conducao_validade") or "",
            "motorista_licenca_tvde": motorista.get("licenca_tvde") or motorista.get("numero_tvde") or "",
            "motorista_licenca_tvde_validade": motorista.get("licenca_tvde_validade") or motorista.get("tvde_validade") or "",
            "motorista_seguranca_social": motorista.get("seguranca_social") or motorista.get("numero_ss") or "",
            "motorista_email": motorista.get("email") or "",
            
            # Dados Veículo
            "vehicle_marca": vehicle.get("marca"),
            "vehicle_modelo": vehicle.get("modelo"),
            "vehicle_matricula": vehicle.get("matricula"),
            
            # Termos Financeiros
            "tipo_contrato": contrato_data.tipo_contrato,
            "valor_semanal": contrato_data.valor_semanal,
            "comissao_percentual": contrato_data.comissao_percentual,
            "caucao_total": contrato_data.caucao_total,
            "caucao_lavagem": contrato_data.caucao_lavagem,
            
            # Campos de caução
            "tem_caucao": contrato_data.tem_caucao,
            "caucao_parcelada": contrato_data.caucao_parcelada,
            "caucao_parcelas": contrato_data.caucao_parcelas,
            "caucao_texto": contrato_data.caucao_texto,
            
            # Campos de Época
            "tem_epoca": contrato_data.tem_epoca,
            "data_inicio_epoca_alta": contrato_data.data_inicio_epoca_alta,
            "data_fim_epoca_alta": contrato_data.data_fim_epoca_alta,
            "valor_epoca_alta": contrato_data.valor_epoca_alta,
            "texto_epoca_alta": contrato_data.texto_epoca_alta,
            "data_inicio_epoca_baixa": contrato_data.data_inicio_epoca_baixa,
            "data_fim_epoca_baixa": contrato_data.data_fim_epoca_baixa,
            "valor_epoca_baixa": contrato_data.valor_epoca_baixa,
            "texto_epoca_baixa": contrato_data.texto_epoca_baixa,
            
            # Condições do veículo
            "condicoes_veiculo": contrato_data.condicoes_veiculo or vehicle.get("observacoes") or "",
            
            # Template do contrato (usar do parceiro se não enviado)
            "template_texto": contrato_data.template_texto or parceiro_data.get("template_contrato_padrao") or "",
            
            # Datas
            "data_inicio": contrato_data.data_inicio,
            "data_emissao": datetime.now(timezone.utc).strftime("%d/%m/%Y"),
            "data_assinatura": datetime.now(timezone.utc).strftime("%d/%m/%Y"),
            "local_assinatura": "Lisboa",
            
            # Status
            "status": "rascunho",
            "parceiro_assinado": False,
            "motorista_assinado": False,
            "parceiro_assinatura_data": None,
            "motorista_assinatura_data": None,
            "pdf_url": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.contratos.insert_one(contrato)
        
        return {
            "message": "Contract generated successfully",
            "contrato_id": contrato_id,
            "referencia": referencia
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating contract: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/contratos")
async def list_contratos(current_user: Dict = Depends(get_current_user)):
    """List all contracts"""
    try:
        query = {}
        
        # Filter by user role
        if current_user["role"] == UserRole.PARCEIRO:
            query["parceiro_id"] = current_user["id"]
        elif current_user["role"] == UserRole.MOTORISTA:
            query["motorista_id"] = current_user["id"]
        
        contratos = await db.contratos.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        return contratos
        
    except Exception as e:
        logger.error(f"Error listing contracts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/contratos/{contrato_id}")
async def get_contrato(contrato_id: str, current_user: Dict = Depends(get_current_user)):
    """Get contract details"""
    contrato = await db.contratos.find_one({"id": contrato_id}, {"_id": 0})
    if not contrato:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    return contrato

@api_router.post("/contratos/{contrato_id}/assinar")
async def assinar_contrato(contrato_id: str, signer_data: Dict[str, str], current_user: Dict = Depends(get_current_user)):
    """Sign a contract (parceiro or motorista)"""
    contrato = await db.contratos.find_one({"id": contrato_id}, {"_id": 0})
    if not contrato:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    signer_type = signer_data.get("signer_type")  # "parceiro" or "motorista"
    
    if signer_type == "parceiro":
        if current_user["role"] != UserRole.PARCEIRO or current_user["id"] != contrato["parceiro_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to sign as parceiro")
        
        update_data = {
            "parceiro_assinado": True,
            "parceiro_assinatura_data": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Check if both signed
        if contrato.get("motorista_assinado"):
            update_data["status"] = "completo"
        else:
            update_data["status"] = "parceiro_assinado"
            
    elif signer_type == "motorista":
        if current_user["role"] != UserRole.MOTORISTA or current_user["id"] != contrato["motorista_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to sign as motorista")
        
        update_data = {
            "motorista_assinado": True,
            "motorista_assinatura_data": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Check if both signed
        if contrato.get("parceiro_assinado"):
            update_data["status"] = "completo"
        else:
            update_data["status"] = "motorista_assinado"
    else:
        raise HTTPException(status_code=400, detail="Invalid signer_type")
    
    await db.contratos.update_one({"id": contrato_id}, {"$set": update_data})
    
    return {"message": "Contract signed successfully", "status": update_data.get("status")}

@api_router.get("/contratos/{contrato_id}/download")
async def download_contrato(contrato_id: str, current_user: Dict = Depends(get_current_user)):
    """Download contract PDF"""
    contrato = await db.contratos.find_one({"id": contrato_id}, {"_id": 0})
    if not contrato:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Generate PDF on-the-fly
    try:
        # Get full data
        parceiro = await db.users.find_one({"id": contrato["parceiro_id"]}, {"_id": 0})
        motorista = await db.motoristas.find_one({"id": contrato["motorista_id"]}, {"_id": 0})
        vehicle = await db.vehicles.find_one({"id": contrato["vehicle_id"]}, {"_id": 0})
        
        # Create PDF in memory
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        
        # Title
        c.setFont("Helvetica-Bold", 18)
        c.drawString(50, 800, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS TVDE")
        
        # Contract ID and Date
        c.setFont("Helvetica", 10)
        c.drawString(50, 780, f"Contrato ID: {contrato_id}")
        c.drawString(50, 765, f"Data: {datetime.fromisoformat(contrato['created_at']).strftime('%d/%m/%Y')}")
        
        # Parceiro section
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, 730, "PARCEIRO (Contratante)")
        c.setFont("Helvetica", 10)
        y_pos = 710
        c.drawString(50, y_pos, f"Nome/Empresa: {parceiro.get('nome_empresa', parceiro.get('name', 'N/A'))}")
        y_pos -= 15
        c.drawString(50, y_pos, f"NIF: {parceiro.get('contribuinte_empresa', 'N/A')}")
        y_pos -= 15
        c.drawString(50, y_pos, f"Morada: {parceiro.get('morada_completa', 'N/A')}")
        y_pos -= 15
        c.drawString(50, y_pos, f"Email: {parceiro.get('email', 'N/A')}")
        y_pos -= 15
        c.drawString(50, y_pos, f"Telefone: {parceiro.get('telefone', 'N/A')}")
        
        # Motorista section
        y_pos -= 30
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y_pos, "MOTORISTA (Contratado)")
        c.setFont("Helvetica", 10)
        y_pos -= 20
        c.drawString(50, y_pos, f"Nome: {motorista.get('name', 'N/A')}")
        y_pos -= 15
        c.drawString(50, y_pos, f"Email: {motorista.get('email', 'N/A')}")
        y_pos -= 15
        c.drawString(50, y_pos, f"NIF: {motorista.get('professional', {}).get('nif', 'N/A')}")
        y_pos -= 15
        c.drawString(50, y_pos, f"Licença TVDE: {motorista.get('professional', {}).get('licenca_tvde', 'N/A')}")
        
        # Vehicle section
        y_pos -= 30
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y_pos, "VEÍCULO")
        c.setFont("Helvetica", 10)
        y_pos -= 20
        c.drawString(50, y_pos, f"Matrícula: {vehicle.get('matricula', 'N/A')}")
        y_pos -= 15
        c.drawString(50, y_pos, f"Marca/Modelo: {vehicle.get('marca', 'N/A')} {vehicle.get('modelo', 'N/A')}")
        y_pos -= 15
        c.drawString(50, y_pos, f"Ano: {vehicle.get('ano', 'N/A')}")
        
        # Contract terms
        y_pos -= 40
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y_pos, "CLÁUSULAS DO CONTRATO")
        c.setFont("Helvetica", 9)
        y_pos -= 20
        
        clauses = [
            "1. O MOTORISTA compromete-se a prestar serviços de transporte de passageiros através de plataformas TVDE.",
            "2. O veículo identificado permanecerá sob responsabilidade do MOTORISTA durante o período de vigência.",
            "3. O MOTORISTA deverá manter em dia toda a documentação necessária (licença TVDE, seguro, inspeção).",
            "4. As despesas de manutenção e combustível serão partilhadas conforme acordado entre as partes.",
            "5. Este contrato é válido por tempo indeterminado, podendo ser rescindido por qualquer parte.",
        ]
        
        for clause in clauses:
            c.drawString(50, y_pos, clause)
            y_pos -= 20
        
        # Signatures section
        y_pos -= 40
        c.setFont("Helvetica-Bold", 10)
        
        # Parceiro signature
        c.drawString(80, y_pos, "PARCEIRO")
        c.line(50, y_pos - 5, 250, y_pos - 5)
        if contrato.get("parceiro_assinado"):
            c.setFont("Helvetica", 8)
            c.drawString(50, y_pos - 20, f"Assinado em: {datetime.fromisoformat(contrato['parceiro_assinatura_data']).strftime('%d/%m/%Y %H:%M')}")
        
        # Motorista signature
        c.setFont("Helvetica-Bold", 10)
        c.drawString(350, y_pos, "MOTORISTA")
        c.line(320, y_pos - 5, 520, y_pos - 5)
        if contrato.get("motorista_assinado"):
            c.setFont("Helvetica", 8)
            c.drawString(320, y_pos - 20, f"Assinado em: {datetime.fromisoformat(contrato['motorista_assinatura_data']).strftime('%d/%m/%Y %H:%M')}")
        
        c.save()
        buffer.seek(0)
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=contrato_{contrato_id}.pdf"}
        )
        
    except Exception as e:
        logger.error(f"Error generating contract PDF: {e}")
        raise HTTPException(status_code=500, detail="Error generating PDF")



# ==================== RECIBOS E PAGAMENTOS ENDPOINTS ====================

@api_router.post("/relatorios-ganhos")
async def criar_relatorio_ganhos(relatorio_data: RelatorioGanhosCreate, current_user: Dict = Depends(get_current_user)):
    """Create earnings report for a driver (Admin, Gestor, Operacional only)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # Get motorista data
        motorista = await db.motoristas.find_one({"id": relatorio_data.motorista_id}, {"_id": 0})
        if not motorista:
            raise HTTPException(status_code=404, detail="Motorista not found")
        
        # Create relatorio
        relatorio_id = str(uuid.uuid4())
        relatorio = {
            "id": relatorio_id,
            "motorista_id": relatorio_data.motorista_id,
            "motorista_nome": motorista.get("name"),
            "periodo_inicio": relatorio_data.periodo_inicio,
            "periodo_fim": relatorio_data.periodo_fim,
            "valor_total": relatorio_data.valor_total,
            "detalhes": relatorio_data.detalhes,
            "notas": relatorio_data.notas,
            "status": "pendente_recibo",
            "recibo_url": None,
            "recibo_emitido_em": None,
            "aprovado_pagamento": False,
            "aprovado_pagamento_por": None,
            "aprovado_pagamento_em": None,
            "pago": False,
            "pago_por": None,
            "pago_em": None,
            "comprovativo_pagamento_url": None,
            "created_by": current_user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.relatorios_ganhos.insert_one(relatorio)
        
        return {"message": "Earnings report created successfully", "relatorio_id": relatorio_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating earnings report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/relatorios-ganhos")
async def list_relatorios_ganhos(current_user: Dict = Depends(get_current_user)):
    """List earnings reports"""
    try:
        query = {}
        
        # Filter based on role
        if current_user["role"] == UserRole.MOTORISTA:
            query["motorista_id"] = current_user["id"]
        elif current_user["role"] == UserRole.PARCEIRO:
            # Get motoristas do parceiro
            motoristas = await db.motoristas.find({"parceiro_atribuido": current_user["id"]}, {"_id": 0, "id": 1}).to_list(100)
            motorista_ids = [m["id"] for m in motoristas]
            query["motorista_id"] = {"$in": motorista_ids}
        
        relatorios = await db.relatorios_ganhos.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
        return relatorios
        
    except Exception as e:
        logger.error(f"Error listing earnings reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/relatorios-ganhos/{relatorio_id}/upload-recibo")
async def upload_recibo(
    relatorio_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload receipt PDF (Motorista only)"""
    relatorio = await db.relatorios_ganhos.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if current_user["role"] != UserRole.MOTORISTA or current_user["id"] != relatorio["motorista_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # Create recibos directory
        recibos_dir = UPLOAD_DIR / "recibos"
        recibos_dir.mkdir(exist_ok=True)
        
        # Process file
        file_id = f"recibo_{relatorio_id}_{uuid.uuid4()}"
        file_info = await process_uploaded_file(file, recibos_dir, file_id)
        
        # Update relatorio
        update_data = {
            "status": "recibo_emitido",
            "recibo_url": file_info["saved_path"],
            "recibo_emitido_em": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.relatorios_ganhos.update_one({"id": relatorio_id}, {"$set": update_data})
        
        return {"message": "Receipt uploaded successfully", "file_url": file_info["saved_path"]}
        
    except Exception as e:
        logger.error(f"Error uploading receipt: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/relatorios-ganhos/{relatorio_id}/aprovar-pagamento")
async def aprovar_pagamento(relatorio_id: str, current_user: Dict = Depends(get_current_user)):
    """Approve payment (Admin, Gestor, Operacional, Parceiro)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    relatorio = await db.relatorios_ganhos.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if relatorio["status"] != "recibo_emitido":
        raise HTTPException(status_code=400, detail="Receipt not yet issued")
    
    update_data = {
        "status": "aguardando_pagamento",
        "aprovado_pagamento": True,
        "aprovado_pagamento_por": current_user["id"],
        "aprovado_pagamento_em": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.relatorios_ganhos.update_one({"id": relatorio_id}, {"$set": update_data})
    
    return {"message": "Payment approved successfully"}

@api_router.post("/relatorios-ganhos/{relatorio_id}/marcar-pago")
async def marcar_pago(
    relatorio_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Mark as paid with payment proof (Admin, Gestor, Operacional, Parceiro)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.OPERACIONAL, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    relatorio = await db.relatorios_ganhos.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if not relatorio["aprovado_pagamento"]:
        raise HTTPException(status_code=400, detail="Payment not yet approved")
    
    try:
        # Create comprovativos directory
        comprova_dir = UPLOAD_DIR / "comprovativos_pagamento"
        comprova_dir.mkdir(exist_ok=True)
        
        # Process file
        file_id = f"comprovativo_{relatorio_id}_{uuid.uuid4()}"
        file_info = await process_uploaded_file(file, comprova_dir, file_id)
        
        # Update relatorio
        update_data = {
            "status": "pago",
            "pago": True,
            "pago_por": current_user["id"],
            "pago_em": datetime.now(timezone.utc).isoformat(),
            "comprovativo_pagamento_url": file_info["saved_path"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.relatorios_ganhos.update_one({"id": relatorio_id}, {"$set": update_data})
        
        return {"message": "Marked as paid successfully", "comprovativo_url": file_info["saved_path"]}
        
    except Exception as e:
        logger.error(f"Error marking as paid: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CSV TEMPLATE DOWNLOADS ====================

@api_router.get("/templates/csv/{template_name}")
async def download_csv_template(template_name: str, current_user: Dict = Depends(get_current_user)):
    """Download CSV template examples"""
    templates_dir = ROOT_DIR / "templates" / "csv_examples"
    
    # Map template names to filenames
    template_files = {
        "uber": "uber_example.csv",
        "bolt": "bolt_example.csv",
        "prio": "prio_example.xlsx",
        "viaverde": "viaverde_example.csv",
        "gps": "gps_example.csv"
    }
    
    if template_name not in template_files:
        raise HTTPException(status_code=404, detail="Template not found")
    
    file_path = templates_dir / template_files[template_name]
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Template file not found")
    
    # Set appropriate media type
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if template_name == "prio" else "text/csv"
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=template_files[template_name]
    )

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

# CSV template endpoint moved to correct location before app.include_router

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
    
    # Start scheduler for automatic sync
    scheduler.start()
    logger.info("Scheduler started for automatic platform sync")
    
    # Carregar jobs agendados do banco
    try:
        credenciais = await db.credenciais_plataforma.find({'sincronizacao_automatica': True, 'ativo': True}).to_list(length=None)
        for cred in credenciais:
            if cred.get('horario_sincronizacao'):
                await agendar_sincronizacao(
                    cred['plataforma'],
                    cred['horario_sincronizacao'],
                    cred.get('frequencia_dias', 7)
                )
        logger.info(f"Carregados {len(credenciais)} agendamentos de sincronização")
    except Exception as e:
        logger.error(f"Erro ao carregar agendamentos: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()