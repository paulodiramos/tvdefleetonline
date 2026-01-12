"""Parceiros routes for FleeTrack application - Refactored from server.py"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
from pydantic import BaseModel, EmailStr
import uuid
import logging
import re
import shutil

from utils.database import get_database
from utils.auth import get_current_user, hash_password

# Setup logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/parceiros", tags=["parceiros"])

# Get database
db = get_database()

# Upload directories
ROOT_DIR = Path(__file__).parent.parent
UPLOAD_DIR = ROOT_DIR / "uploads"


class UserRole:
    """User roles for authorization"""
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== PYDANTIC MODELS ====================

class ParceiroCreate(BaseModel):
    nome_empresa: str
    contribuinte_empresa: str
    morada_completa: str
    codigo_postal: str
    localidade: str
    nome_manager: str
    email_manager: EmailStr
    email_empresa: EmailStr
    telefone: str
    telemovel: str
    email: EmailStr
    certidao_permanente: str
    codigo_certidao_comercial: str
    validade_certidao_comercial: str
    seguro_responsabilidade_civil: Optional[str] = None
    seguro_acidentes_trabalho: Optional[str] = None
    licenca_tvde: Optional[str] = None
    plano_id: Optional[str] = None
    gestor_associado_id: Optional[str] = None


# ==================== CRUD ROUTES ====================

@router.post("")
async def create_parceiro(parceiro_data: ParceiroCreate, current_user: Dict = Depends(get_current_user)):
    """Create a new parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    parceiro_dict = parceiro_data.model_dump()
    parceiro_dict["id"] = str(uuid.uuid4())
    parceiro_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    parceiro_dict["total_vehicles"] = 0
    
    if current_user["role"] == UserRole.GESTAO:
        parceiro_dict["gestor_associado_id"] = current_user["id"]
    
    # Assign base free plan for parceiro
    plano_base = await db.planos_sistema.find_one({
        "preco_mensal": 0, 
        "ativo": True, 
        "tipo_usuario": "parceiro"
    }, {"_id": 0})
    
    if plano_base:
        plano_valida_ate = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        parceiro_dict["plano_id"] = plano_base["id"]
        parceiro_dict["plano_nome"] = plano_base["nome"]
        parceiro_dict["plano_valida_ate"] = plano_valida_ate
        parceiro_dict["plano_status"] = "ativo"
        logger.info(f"Assigned base plan {plano_base['id']} to new parceiro")
    
    await db.parceiros.insert_one(parceiro_dict)
    
    # Create user account for parceiro
    user_dict = {
        "id": parceiro_dict["id"],
        "email": parceiro_data.email,
        "name": parceiro_data.nome_manager,
        "role": UserRole.PARCEIRO,
        "password": hash_password("parceiro123"),
        "phone": parceiro_data.telefone,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved": True,
        "associated_gestor_id": parceiro_dict.get("gestor_associado_id")
    }
    await db.users.insert_one(user_dict)
    
    return parceiro_dict


@router.post("/register-public")
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
    
    return {
        "success": True,
        "message": "Parceiro registado com sucesso. Aguarde aprovação.",
        "parceiro_id": parceiro_id
    }


@router.get("")
async def get_parceiros(current_user: Dict = Depends(get_current_user)):
    """Get all parceiros (filtered by role)"""
    query = {}
    
    # Only show approved parceiros (except for admin)
    if current_user["role"] != UserRole.ADMIN:
        query["approved"] = True
    
    if current_user["role"] == UserRole.GESTAO:
        query["gestor_associado_id"] = current_user["id"]
    elif current_user["role"] == "parceiro":
        query["id"] = current_user["id"]
    elif current_user["role"] not in [UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    parceiros = await db.parceiros.find(query, {"_id": 0}).to_list(1000)
    
    for p in parceiros:
        # Fix created_at
        if "created_at" in p and isinstance(p["created_at"], str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
        elif "created_at" not in p:
            p["created_at"] = datetime.now(timezone.utc)
        
        # Backward compatibility mapping
        if "nome_empresa" not in p:
            p["nome_empresa"] = p.get("empresa") or p.get("nome") or "N/A"
        if "nome_manager" not in p:
            p["nome_manager"] = p.get("name") or p.get("responsavel_nome") or "N/A"
        if "contribuinte_empresa" not in p and "nif" in p:
            p["contribuinte_empresa"] = p["nif"]
        if "morada_completa" not in p and "morada" in p:
            p["morada_completa"] = p["morada"]
        if "codigo_postal" not in p:
            p["codigo_postal"] = "0000-000"
        if "localidade" not in p:
            p["localidade"] = "N/A"
        if "telefone" not in p and "phone" in p:
            p["telefone"] = p["phone"]
        if "telemovel" not in p:
            p["telemovel"] = p.get("responsavel_contacto") or p.get("phone") or "N/A"
        if "email" not in p:
            p["email"] = "noemail@example.com"
        if "codigo_certidao_comercial" not in p:
            p["codigo_certidao_comercial"] = "N/A"
        if "validade_certidao_comercial" not in p:
            p["validade_certidao_comercial"] = "2099-12-31"
        
        # Count vehicles and motoristas
        p["total_vehicles"] = await db.vehicles.count_documents({"parceiro_id": p["id"]})
        p["total_motoristas"] = await db.motoristas.count_documents({"parceiro_id": p["id"]})
    
    return parceiros


@router.get("/meu-plano")
async def get_meu_plano(current_user: Dict = Depends(get_current_user)):
    """Get current parceiro's plan details"""
    if current_user["role"] != UserRole.PARCEIRO:
        raise HTTPException(status_code=403, detail="Only parceiros can access this")
    
    parceiro = await db.parceiros.find_one({"id": current_user["id"]}, {"_id": 0})
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    plano_id = parceiro.get("plano_id")
    if not plano_id:
        return {
            "plano": None,
            "message": "Nenhum plano atribuído"
        }
    
    plano = await db.planos_sistema.find_one({"id": plano_id}, {"_id": 0})
    
    return {
        "plano": plano,
        "plano_nome": parceiro.get("plano_nome"),
        "plano_valida_ate": parceiro.get("plano_valida_ate"),
        "plano_status": parceiro.get("plano_status", "pendente")
    }


@router.get("/{parceiro_id}")
async def get_parceiro(parceiro_id: str, current_user: Dict = Depends(get_current_user)):
    """Get specific parceiro by ID"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Can only view your own data")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    
    if not parceiro:
        parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
    
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    # Backward compatibility
    if isinstance(parceiro.get("created_at"), str):
        parceiro["created_at"] = datetime.fromisoformat(parceiro["created_at"])
    
    if "nome_empresa" not in parceiro and "nome" in parceiro:
        parceiro["nome_empresa"] = parceiro["nome"]
    if "contribuinte_empresa" not in parceiro and "nif" in parceiro:
        parceiro["contribuinte_empresa"] = parceiro["nif"]
    if "morada_completa" not in parceiro and "morada" in parceiro:
        parceiro["morada_completa"] = parceiro["morada"]
    if "nome_manager" not in parceiro and "responsavel_nome" in parceiro:
        parceiro["nome_manager"] = parceiro["responsavel_nome"]
    if "telemovel" not in parceiro and "responsavel_contacto" in parceiro:
        parceiro["telemovel"] = parceiro["responsavel_contacto"]
    if "localidade" not in parceiro:
        parceiro["localidade"] = "N/A"
    if "validade_certidao_comercial" not in parceiro:
        parceiro["validade_certidao_comercial"] = "2099-12-31"
    
    return parceiro


@router.put("/{parceiro_id}")
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


@router.delete("/{parceiro_id}")
async def delete_parceiro(
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete parceiro (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin pode eliminar parceiros")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    # Unassign all vehicles
    vehicles_result = await db.vehicles.update_many(
        {"parceiro_id": parceiro_id},
        {"$set": {"parceiro_id": None, "parceiro_nome": None}}
    )
    
    # Unassign all motoristas
    motoristas_result = await db.motoristas.update_many(
        {"parceiro_atribuido": parceiro_id},
        {"$set": {"parceiro_atribuido": None}}
    )
    
    # Delete user account if exists
    if parceiro.get("user_id"):
        await db.users.delete_one({"id": parceiro["user_id"]})
    
    # Delete parceiro
    delete_result = await db.parceiros.delete_one({"id": parceiro_id})
    
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Erro ao eliminar parceiro")
    
    return {
        "message": f"Parceiro '{parceiro.get('nome_empresa', 'N/A')}' eliminado com sucesso",
        "parceiro_id": parceiro_id,
        "vehicles_unassigned": vehicles_result.modified_count,
        "motoristas_unassigned": motoristas_result.modified_count,
        "deleted_by": current_user["id"],
        "deleted_at": datetime.now(timezone.utc).isoformat()
    }


# ==================== ESTATÍSTICAS ====================

@router.get("/{parceiro_id}/estatisticas")
async def get_parceiro_estatisticas(
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get statistics for a parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Count vehicles
    total_veiculos = await db.vehicles.count_documents({"parceiro_id": parceiro_id})
    veiculos_atribuidos = await db.vehicles.count_documents({
        "parceiro_id": parceiro_id,
        "motorista_atribuido": {"$ne": None}
    })
    veiculos_disponiveis = await db.vehicles.count_documents({
        "parceiro_id": parceiro_id,
        "motorista_atribuido": None
    })
    
    # Count motoristas
    total_motoristas = await db.motoristas.count_documents({"parceiro_atribuido": parceiro_id})
    motoristas_ativos = await db.motoristas.count_documents({
        "parceiro_atribuido": parceiro_id,
        "status_motorista": "ativo"
    })
    
    return {
        "veiculos": {
            "total": total_veiculos,
            "atribuidos": veiculos_atribuidos,
            "disponiveis": veiculos_disponiveis
        },
        "motoristas": {
            "total": total_motoristas,
            "ativos": motoristas_ativos
        }
    }


# ==================== ALERTAS ====================

@router.get("/{parceiro_id}/alertas")
async def get_parceiro_alertas(parceiro_id: str, current_user: Dict = Depends(get_current_user)):
    """Get all alerts for a specific partner's vehicles and drivers"""
    from datetime import date
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    # Get configuration
    dias_aviso_seguro = parceiro.get("dias_aviso_seguro", 30)
    dias_aviso_inspecao = parceiro.get("dias_aviso_inspecao", 30)
    km_aviso_revisao = parceiro.get("km_aviso_revisao", 5000)
    
    today = date.today()
    alertas = []
    
    # Get all vehicles for this parceiro
    vehicles = await db.vehicles.find({"parceiro_id": parceiro_id}, {"_id": 0}).to_list(1000)
    
    for v in vehicles:
        # Check seguro expiry
        if v.get("insurance") and v["insurance"].get("data_validade"):
            try:
                validade = datetime.strptime(v["insurance"]["data_validade"], "%Y-%m-%d").date()
                dias_restantes = (validade - today).days
                if 0 <= dias_restantes <= dias_aviso_seguro:
                    alertas.append({
                        "tipo": "seguro",
                        "entidade": "veiculo",
                        "entidade_id": v["id"],
                        "matricula": v.get("matricula"),
                        "descricao": f"Seguro expira em {dias_restantes} dias",
                        "data_vencimento": v["insurance"]["data_validade"],
                        "prioridade": "alta" if dias_restantes <= 7 else "media"
                    })
            except Exception:
                pass
        
        # Check inspeção expiry
        if v.get("inspection") and v["inspection"].get("proxima_inspecao"):
            try:
                proxima = datetime.strptime(v["inspection"]["proxima_inspecao"], "%Y-%m-%d").date()
                dias_restantes = (proxima - today).days
                if 0 <= dias_restantes <= dias_aviso_inspecao:
                    alertas.append({
                        "tipo": "inspecao",
                        "entidade": "veiculo",
                        "entidade_id": v["id"],
                        "matricula": v.get("matricula"),
                        "descricao": f"Inspeção em {dias_restantes} dias",
                        "data_vencimento": v["inspection"]["proxima_inspecao"],
                        "prioridade": "alta" if dias_restantes <= 7 else "media"
                    })
            except Exception:
                pass
        
        # Check extintor expiry
        if v.get("extintor") and v["extintor"].get("data_validade"):
            try:
                validade = datetime.strptime(v["extintor"]["data_validade"], "%Y-%m-%d").date()
                dias_restantes = (validade - today).days
                if 0 <= dias_restantes <= 30:
                    alertas.append({
                        "tipo": "extintor",
                        "entidade": "veiculo",
                        "entidade_id": v["id"],
                        "matricula": v.get("matricula"),
                        "descricao": f"Extintor expira em {dias_restantes} dias",
                        "data_vencimento": v["extintor"]["data_validade"],
                        "prioridade": "alta" if dias_restantes <= 7 else "media"
                    })
            except Exception:
                pass
        
        # Check revisão por KM
        km_atual = v.get("km_atual", 0)
        proxima_revisao_km = v.get("proxima_revisao_km")
        if proxima_revisao_km and km_atual:
            km_restantes = proxima_revisao_km - km_atual
            if 0 <= km_restantes <= km_aviso_revisao:
                alertas.append({
                    "tipo": "revisao",
                    "entidade": "veiculo",
                    "entidade_id": v["id"],
                    "matricula": v.get("matricula"),
                    "descricao": f"Revisão em {km_restantes} km",
                    "km_atual": km_atual,
                    "km_proxima": proxima_revisao_km,
                    "prioridade": "alta" if km_restantes <= 1000 else "media"
                })
    
    # Get motoristas alerts
    motoristas = await db.motoristas.find({"parceiro_atribuido": parceiro_id}, {"_id": 0}).to_list(1000)
    
    for m in motoristas:
        # Check licença TVDE
        if m.get("licenca_tvde_validade"):
            try:
                validade = datetime.strptime(m["licenca_tvde_validade"], "%Y-%m-%d").date()
                dias_restantes = (validade - today).days
                if 0 <= dias_restantes <= 30:
                    alertas.append({
                        "tipo": "licenca_tvde",
                        "entidade": "motorista",
                        "entidade_id": m["id"],
                        "nome": m.get("name"),
                        "descricao": f"Licença TVDE expira em {dias_restantes} dias",
                        "data_vencimento": m["licenca_tvde_validade"],
                        "prioridade": "alta"
                    })
            except Exception:
                pass
        
        # Check carta de condução
        if m.get("carta_conducao_validade"):
            try:
                validade = datetime.strptime(m["carta_conducao_validade"], "%Y-%m-%d").date()
                dias_restantes = (validade - today).days
                if 0 <= dias_restantes <= 30:
                    alertas.append({
                        "tipo": "carta_conducao",
                        "entidade": "motorista",
                        "entidade_id": m["id"],
                        "nome": m.get("name"),
                        "descricao": f"Carta de condução expira em {dias_restantes} dias",
                        "data_vencimento": m["carta_conducao_validade"],
                        "prioridade": "alta"
                    })
            except Exception:
                pass
    
    # Sort by priority
    alertas.sort(key=lambda x: (0 if x["prioridade"] == "alta" else 1))
    
    return {
        "parceiro_id": parceiro_id,
        "total_alertas": len(alertas),
        "alertas": alertas
    }


# ==================== CERTIDÃO PERMANENTE ====================

@router.post("/{parceiro_id}/certidao-permanente/upload")
async def upload_certidao_permanente(
    parceiro_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload certidão permanente document"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    # Save file
    docs_dir = UPLOAD_DIR / "certidoes"
    docs_dir.mkdir(exist_ok=True)
    
    file_extension = Path(file.filename).suffix.lower()
    filename = f"certidao_{parceiro_id}_{uuid.uuid4()}{file_extension}"
    file_path = docs_dir / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    relative_path = str(file_path.relative_to(ROOT_DIR))
    
    await db.parceiros.update_one(
        {"id": parceiro_id},
        {"$set": {"certidao_permanente_url": relative_path}}
    )
    
    return {"message": "Certidão permanente uploaded", "url": relative_path}


@router.get("/{parceiro_id}/certidao-permanente")
async def get_certidao_permanente(
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get certidão permanente info"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    return {
        "certidao_permanente": parceiro.get("certidao_permanente"),
        "certidao_permanente_url": parceiro.get("certidao_permanente_url"),
        "codigo_certidao_comercial": parceiro.get("codigo_certidao_comercial"),
        "validade_certidao_comercial": parceiro.get("validade_certidao_comercial")
    }


@router.put("/{parceiro_id}/certidao-permanente")
async def update_certidao_permanente(
    parceiro_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update certidão permanente info"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    update_data = {}
    if "certidao_permanente" in data:
        update_data["certidao_permanente"] = data["certidao_permanente"]
    if "codigo_certidao_comercial" in data:
        update_data["codigo_certidao_comercial"] = data["codigo_certidao_comercial"]
    if "validade_certidao_comercial" in data:
        update_data["validade_certidao_comercial"] = data["validade_certidao_comercial"]
    
    if update_data:
        await db.parceiros.update_one(
            {"id": parceiro_id},
            {"$set": update_data}
        )
    
    return {"message": "Certidão permanente updated"}



# ==================== CONFIGURAÇÃO DE EMAIL SMTP ====================

class ConfiguracaoEmailSMTP(BaseModel):
    """Configuração de email SMTP do parceiro"""
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_usuario: Optional[str] = None
    smtp_password: Optional[str] = None
    email_remetente: Optional[str] = None
    nome_remetente: Optional[str] = None
    usar_tls: bool = True
    ativo: bool = False


@router.get("/{parceiro_id}/config-email")
async def get_config_email(
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter configuração de email SMTP do parceiro"""
    # Parceiros podem ver sua própria config, gestores/admin podem ver qualquer uma
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        # Tentar buscar em users (parceiros podem estar em users)
        parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
    
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    config = parceiro.get("config_email", {})
    # Não retornar a password por segurança
    if config.get("smtp_password"):
        config["smtp_password"] = "********"
    
    return config


@router.put("/{parceiro_id}/config-email")
async def update_config_email(
    parceiro_id: str,
    config: ConfiguracaoEmailSMTP,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar configuração de email SMTP do parceiro"""
    # Parceiros podem editar sua própria config, gestores/admin podem editar qualquer uma
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Verificar se parceiro existe em parceiros ou users
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    collection = db.parceiros
    if not parceiro:
        parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
        collection = db.users
    
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    # Se a password for "********", manter a existente
    config_data = config.model_dump()
    if config_data.get("smtp_password") == "********":
        existing_config = parceiro.get("config_email", {})
        config_data["smtp_password"] = existing_config.get("smtp_password")
    
    await collection.update_one(
        {"id": parceiro_id},
        {"$set": {"config_email": config_data}}
    )
    
    logger.info(f"📧 Config email atualizada para parceiro {parceiro_id}")
    return {"message": "Configuração de email atualizada com sucesso"}


@router.post("/{parceiro_id}/config-email/testar")
async def testar_config_email(
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Testar configuração de email SMTP enviando email de teste"""
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
    
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    config = parceiro.get("config_email", {})
    if not config.get("smtp_host") or not config.get("smtp_usuario"):
        raise HTTPException(status_code=400, detail="Configuração SMTP incompleta")
    
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        msg = MIMEMultipart()
        msg['From'] = f"{config.get('nome_remetente', 'TVDEFleet')} <{config.get('email_remetente', config['smtp_usuario'])}>"
        msg['To'] = config.get('email_remetente', config['smtp_usuario'])
        msg['Subject'] = "TVDEFleet - Teste de Email"
        
        body = """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2>✅ Configuração de Email Funcionando!</h2>
            <p>Este é um email de teste do TVDEFleet.</p>
            <p>A sua configuração SMTP está correta.</p>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(config['smtp_host'], config.get('smtp_port', 587))
        if config.get('usar_tls', True):
            server.starttls()
        server.login(config['smtp_usuario'], config['smtp_password'])
        server.send_message(msg)
        server.quit()
        
        return {"success": True, "message": "Email de teste enviado com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao testar email: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Erro ao enviar email: {str(e)}")


# ==================== CREDENCIAIS DE PLATAFORMAS ====================

class CredenciaisPlataforma(BaseModel):
    """Credenciais de acesso às plataformas"""
    # Uber
    uber_email: Optional[str] = None
    uber_telefone: Optional[str] = None
    uber_password: Optional[str] = None
    # Bolt
    bolt_email: Optional[str] = None
    bolt_password: Optional[str] = None
    # Via Verde
    viaverde_usuario: Optional[str] = None
    viaverde_password: Optional[str] = None


@router.get("/{parceiro_id}/credenciais-plataformas")
async def get_credenciais_plataformas(
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter credenciais de plataformas do parceiro"""
    # Parceiros podem ver suas próprias credenciais, gestores/admin podem ver qualquer uma
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
    
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    creds = parceiro.get("credenciais_plataformas", {})
    # Mascarar passwords
    if creds.get("uber_password"):
        creds["uber_password"] = "********"
    if creds.get("bolt_password"):
        creds["bolt_password"] = "********"
    if creds.get("viaverde_password"):
        creds["viaverde_password"] = "********"
    
    return creds


@router.put("/{parceiro_id}/credenciais-plataformas")
async def update_credenciais_plataformas(
    parceiro_id: str,
    creds: CredenciaisPlataforma,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar credenciais de plataformas do parceiro"""
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    collection = db.parceiros
    if not parceiro:
        parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
        collection = db.users
    
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    creds_data = creds.model_dump()
    existing_creds = parceiro.get("credenciais_plataformas", {})
    
    # Se as passwords forem "********", manter as existentes
    if creds_data.get("uber_password") == "********":
        creds_data["uber_password"] = existing_creds.get("uber_password")
    if creds_data.get("bolt_password") == "********":
        creds_data["bolt_password"] = existing_creds.get("bolt_password")
    if creds_data.get("viaverde_password") == "********":
        creds_data["viaverde_password"] = existing_creds.get("viaverde_password")
    
    await collection.update_one(
        {"id": parceiro_id},
        {"$set": {"credenciais_plataformas": creds_data}}
    )
    
    logger.info(f"🔐 Credenciais plataformas atualizadas para parceiro {parceiro_id}")
    return {"message": "Credenciais atualizadas com sucesso"}
