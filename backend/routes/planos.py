"""Planos routes for FleeTrack application - Refactored from server.py"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user

# Setup logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(tags=["planos"])

# Get database
db = get_database()


class UserRole:
    """User roles for authorization"""
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== PYDANTIC MODELS ====================

class PlanoPromocao(BaseModel):
    ativa: bool = False
    nome: str = ""
    desconto_percentagem: float = 0
    valida_ate: Optional[str] = None


class PlanoCreate(BaseModel):
    nome: str
    descricao: str
    features: List[str] = []
    perfis_permitidos: List[str] = []
    tipo_cobranca: str = "por_veiculo"
    preco_semanal_sem_iva: float
    iva_percentagem: float = 23
    preco_mensal_sem_iva: float
    desconto_mensal_percentagem: float = 0
    promocao: PlanoPromocao = PlanoPromocao()


class PlanoAssinatura(BaseModel):
    id: str
    nome: str
    descricao: str
    preco_mensal: float
    preco_anual: Optional[float] = None
    features: List[str] = []
    tipo_usuario: str = "parceiro"
    modulos: List[str] = []
    ativo: bool = True
    permite_trial: bool = False
    dias_trial: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ==================== PUBLIC ROUTES ====================

@router.get("/planos/public")
async def get_planos_public():
    """Get all active plans (public endpoint)"""
    planos = await db.planos_sistema.find(
        {"ativo": True},
        {"_id": 0}
    ).to_list(100)
    
    return planos


@router.get("/planos")
async def get_planos(current_user: Dict = Depends(get_current_user)):
    """Get all plans"""
    planos = await db.planos_sistema.find({}, {"_id": 0}).to_list(100)
    return planos


@router.get("/planos-motorista")
async def get_planos_motorista(current_user: Dict = Depends(get_current_user)):
    """Get plans available for motoristas"""
    planos = await db.planos_sistema.find(
        {"tipo_usuario": "motorista", "ativo": True},
        {"_id": 0}
    ).to_list(100)
    
    return planos


# ==================== ADMIN ROUTES ====================

@router.post("/planos")
async def create_plano(
    plano_data: PlanoCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new plan (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc).isoformat()
    
    plano_dict = plano_data.model_dump()
    plano_dict["id"] = str(uuid.uuid4())
    plano_dict["ativo"] = True
    plano_dict["created_at"] = now
    plano_dict["updated_at"] = now
    
    await db.planos.insert_one(plano_dict)
    
    return plano_dict


@router.put("/planos/{plano_id}")
async def update_plano(
    plano_id: str,
    updates: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update a plan (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.planos.update_one(
        {"id": plano_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        # Try planos_sistema collection
        result = await db.planos_sistema.update_one(
            {"id": plano_id},
            {"$set": updates}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Plano not found")
    
    return {"message": "Plano updated successfully"}


@router.delete("/planos/{plano_id}")
async def delete_plano(
    plano_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a plan (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Soft delete - mark as inactive
    result = await db.planos.update_one(
        {"id": plano_id},
        {"$set": {"ativo": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        result = await db.planos_sistema.update_one(
            {"id": plano_id},
            {"$set": {"ativo": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Plano not found")
    
    return {"message": "Plano deleted successfully"}


# ==================== ADMIN PLANOS SISTEMA ====================

@router.post("/admin/planos")
async def admin_create_plano(
    plano_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Create a plan in planos_sistema collection (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc).isoformat()
    
    plano = {
        "id": str(uuid.uuid4()),
        "nome": plano_data.get("nome"),
        "descricao": plano_data.get("descricao", ""),
        "preco_mensal": plano_data.get("preco_mensal", 0),
        "preco_anual": plano_data.get("preco_anual"),
        "features": plano_data.get("features", []),
        "tipo_usuario": plano_data.get("tipo_usuario", "parceiro"),
        "modulos": plano_data.get("modulos", []),
        "ativo": True,
        "permite_trial": plano_data.get("permite_trial", False),
        "dias_trial": plano_data.get("dias_trial", 0),
        "created_at": now,
        "updated_at": now
    }
    
    await db.planos_sistema.insert_one(plano)
    
    return plano


@router.get("/admin/planos")
async def admin_get_planos(current_user: Dict = Depends(get_current_user)):
    """Get all plans from planos_sistema (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    planos = await db.planos_sistema.find({}, {"_id": 0}).to_list(100)
    return planos


@router.put("/admin/planos/{plano_id}")
async def admin_update_plano(
    plano_id: str,
    updates: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update a plan in planos_sistema (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.planos_sistema.update_one(
        {"id": plano_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plano not found")
    
    return {"message": "Plano updated successfully"}


# ==================== PROMOCOES ====================

@router.post("/admin/planos/{plano_id}/promocao")
async def add_promocao(
    plano_id: str,
    promocao_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Add promotion to a plan (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    plano = await db.planos.find_one({"id": plano_id}, {"_id": 0})
    if not plano:
        plano = await db.planos_sistema.find_one({"id": plano_id}, {"_id": 0})
    
    if not plano:
        raise HTTPException(status_code=404, detail="Plano not found")
    
    promocao = {
        "ativa": True,
        "nome": promocao_data.get("nome", "Promoção"),
        "desconto_percentagem": promocao_data.get("desconto_percentagem", 0),
        "valida_ate": promocao_data.get("valida_ate"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update in appropriate collection
    if await db.planos.find_one({"id": plano_id}):
        await db.planos.update_one(
            {"id": plano_id},
            {"$set": {"promocao": promocao}}
        )
    else:
        await db.planos_sistema.update_one(
            {"id": plano_id},
            {"$set": {"promocao": promocao}}
        )
    
    return {"message": "Promocao added successfully", "promocao": promocao}


@router.delete("/admin/planos/{plano_id}/promocao")
async def remove_promocao(
    plano_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remove promotion from a plan (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    promocao_desativada = {
        "ativa": False,
        "nome": "",
        "desconto_percentagem": 0,
        "valida_ate": None
    }
    
    result = await db.planos.update_one(
        {"id": plano_id},
        {"$set": {"promocao": promocao_desativada}}
    )
    
    if result.matched_count == 0:
        result = await db.planos_sistema.update_one(
            {"id": plano_id},
            {"$set": {"promocao": promocao_desativada}}
        )
    
    return {"message": "Promocao removed successfully"}


# ==================== SEED PLANOS ====================

@router.post("/admin/seed-planos")
async def seed_planos(current_user: Dict = Depends(get_current_user)):
    """Seed default plans (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc).isoformat()
    
    default_planos = [
        {
            "id": str(uuid.uuid4()),
            "nome": "Base Gratuito",
            "descricao": "Plano base gratuito para todos os parceiros",
            "preco_mensal": 0,
            "tipo_usuario": "parceiro",
            "modulos": ["dashboard", "gestao_veiculos", "gestao_motoristas"],
            "ativo": True,
            "permite_trial": False,
            "dias_trial": 0,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "nome": "Profissional",
            "descricao": "Plano profissional com funcionalidades avançadas",
            "preco_mensal": 29.99,
            "tipo_usuario": "parceiro",
            "modulos": [
                "dashboard", "gestao_veiculos", "gestao_motoristas",
                "relatorios", "alertas", "importacao_dados"
            ],
            "ativo": True,
            "permite_trial": True,
            "dias_trial": 14,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "nome": "Enterprise",
            "descricao": "Plano enterprise com todas as funcionalidades",
            "preco_mensal": 99.99,
            "tipo_usuario": "parceiro",
            "modulos": [
                "dashboard", "gestao_veiculos", "gestao_motoristas",
                "relatorios", "alertas", "importacao_dados",
                "api_acesso", "suporte_prioritario", "automacao"
            ],
            "ativo": True,
            "permite_trial": True,
            "dias_trial": 30,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "nome": "Base Gratuito",
            "descricao": "Plano base gratuito para todos os motoristas",
            "preco_mensal": 0,
            "tipo_usuario": "motorista",
            "modulos": ["dashboard_ganhos", "gestao_documentos"],
            "ativo": True,
            "permite_trial": False,
            "dias_trial": 0,
            "created_at": now,
            "updated_at": now
        }
    ]
    
    # Insert only if collection is empty
    existing_count = await db.planos_sistema.count_documents({})
    if existing_count > 0:
        return {"message": f"Planos already seeded ({existing_count} existing)", "skipped": True}
    
    for plano in default_planos:
        await db.planos_sistema.insert_one(plano)
    
    return {
        "message": f"Seeded {len(default_planos)} planos successfully",
        "planos_criados": len(default_planos)
    }


# ==================== PARCEIRO PLANO MANAGEMENT ====================

@router.post("/parceiros/{parceiro_id}/solicitar-plano")
async def solicitar_plano(
    parceiro_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Request a plan for parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    plano_id = data.get("plano_id")
    if not plano_id:
        raise HTTPException(status_code=400, detail="plano_id is required")
    
    plano = await db.planos_sistema.find_one({"id": plano_id}, {"_id": 0})
    if not plano:
        raise HTTPException(status_code=404, detail="Plano not found")
    
    # Create subscription request
    solicitacao = {
        "id": str(uuid.uuid4()),
        "parceiro_id": parceiro_id,
        "plano_id": plano_id,
        "plano_nome": plano.get("nome"),
        "status": "pendente",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.solicitacoes_plano.insert_one(solicitacao)
    
    return {
        "message": "Solicitação de plano criada",
        "solicitacao_id": solicitacao["id"]
    }


@router.post("/admin/parceiros/{parceiro_id}/aprovar-plano")
async def aprovar_plano(
    parceiro_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Approve plan for parceiro (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    solicitacao_id = data.get("solicitacao_id")
    
    # Find solicitation
    solicitacao = await db.solicitacoes_plano.find_one(
        {"id": solicitacao_id, "parceiro_id": parceiro_id},
        {"_id": 0}
    )
    
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação not found")
    
    plano_id = solicitacao.get("plano_id")
    plano = await db.planos_sistema.find_one({"id": plano_id}, {"_id": 0})
    
    if not plano:
        raise HTTPException(status_code=404, detail="Plano not found")
    
    # Calculate validity
    dias_validade = data.get("dias_validade", 30)
    plano_valida_ate = (datetime.now(timezone.utc) + timedelta(days=dias_validade)).isoformat()
    
    # Update parceiro
    await db.parceiros.update_one(
        {"id": parceiro_id},
        {"$set": {
            "plano_id": plano_id,
            "plano_nome": plano.get("nome"),
            "plano_valida_ate": plano_valida_ate,
            "plano_status": "ativo"
        }}
    )
    
    # Update solicitation
    await db.solicitacoes_plano.update_one(
        {"id": solicitacao_id},
        {"$set": {
            "status": "aprovado",
            "aprovado_por": current_user["id"],
            "aprovado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Plano aprovado com sucesso",
        "plano_valida_ate": plano_valida_ate
    }


@router.post("/admin/parceiros/{parceiro_id}/atribuir-plano")
async def atribuir_plano(
    parceiro_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Directly assign plan to parceiro (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    plano_id = data.get("plano_id")
    if not plano_id:
        raise HTTPException(status_code=400, detail="plano_id is required")
    
    plano = await db.planos_sistema.find_one({"id": plano_id}, {"_id": 0})
    if not plano:
        raise HTTPException(status_code=404, detail="Plano not found")
    
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro not found")
    
    # Calculate validity
    dias_validade = data.get("dias_validade", 30)
    plano_valida_ate = (datetime.now(timezone.utc) + timedelta(days=dias_validade)).isoformat()
    
    # Update parceiro
    await db.parceiros.update_one(
        {"id": parceiro_id},
        {"$set": {
            "plano_id": plano_id,
            "plano_nome": plano.get("nome"),
            "plano_valida_ate": plano_valida_ate,
            "plano_status": "ativo",
            "plano_atribuido_por": current_user["id"],
            "plano_atribuido_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": f"Plano '{plano.get('nome')}' atribuído com sucesso",
        "plano_valida_ate": plano_valida_ate
    }


@router.post("/parceiros/{parceiro_id}/comprar-plano-motorista")
async def comprar_plano_motorista(
    parceiro_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Buy motorista plan through parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista_id = data.get("motorista_id")
    plano_id = data.get("plano_id")
    
    if not motorista_id or not plano_id:
        raise HTTPException(status_code=400, detail="motorista_id and plano_id are required")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    plano = await db.planos_sistema.find_one({"id": plano_id}, {"_id": 0})
    if not plano:
        raise HTTPException(status_code=404, detail="Plano not found")
    
    # Calculate validity
    dias_validade = data.get("dias_validade", 30)
    plano_valida_ate = (datetime.now(timezone.utc) + timedelta(days=dias_validade)).isoformat()
    
    # Update motorista
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {
            "plano_id": plano_id,
            "plano_nome": plano.get("nome"),
            "plano_valida_ate": plano_valida_ate,
            "plano_comprado_por": parceiro_id,
            "plano_comprado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": f"Plano '{plano.get('nome')}' atribuído ao motorista",
        "motorista_id": motorista_id,
        "plano_valida_ate": plano_valida_ate
    }


# ==================== MODULOS ====================

@router.get("/modulos")
async def get_modulos(current_user: Dict = Depends(get_current_user)):
    """Get all available modules"""
    modulos = await db.modulos.find({}, {"_id": 0}).to_list(100)
    
    if not modulos:
        # Return default modules if none exist
        modulos = [
            {"id": "dashboard", "nome": "Dashboard", "descricao": "Dashboard principal"},
            {"id": "gestao_veiculos", "nome": "Gestão de Veículos", "descricao": "Gerir veículos da frota"},
            {"id": "gestao_motoristas", "nome": "Gestão de Motoristas", "descricao": "Gerir motoristas"},
            {"id": "relatorios", "nome": "Relatórios", "descricao": "Relatórios e analytics"},
            {"id": "alertas", "nome": "Alertas", "descricao": "Sistema de alertas"},
            {"id": "importacao_dados", "nome": "Importação de Dados", "descricao": "Importar dados de plataformas"},
            {"id": "api_acesso", "nome": "API Access", "descricao": "Acesso à API"},
            {"id": "suporte_prioritario", "nome": "Suporte Prioritário", "descricao": "Suporte prioritário"},
            {"id": "automacao", "nome": "Automação", "descricao": "Automação de processos"},
        ]
    
    return modulos
