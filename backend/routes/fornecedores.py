"""Suppliers management routes (fuel, GPS, etc.)"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)


class FornecedorCreate(BaseModel):
    """Model for creating a supplier"""
    nome: str
    tipo: str  # combustivel_fossil, combustivel_eletrico, gps, manutencao, seguros
    descricao: Optional[str] = None
    contacto_email: Optional[str] = None
    contacto_telefone: Optional[str] = None
    website: Optional[str] = None
    ativo: bool = True


class FornecedorUpdate(BaseModel):
    """Model for updating a supplier"""
    nome: Optional[str] = None
    descricao: Optional[str] = None
    contacto_email: Optional[str] = None
    contacto_telefone: Optional[str] = None
    website: Optional[str] = None
    ativo: Optional[bool] = None


# ==================== FORNECEDORES CRUD ====================

@router.get("/fornecedores")
async def listar_fornecedores(
    tipo: Optional[str] = None,
    ativo: Optional[bool] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List all suppliers"""
    query = {}
    
    if tipo:
        query["tipo"] = tipo
    
    if ativo is not None:
        query["ativo"] = ativo
    
    fornecedores = await db.fornecedores.find(
        query,
        {"_id": 0}
    ).sort("nome", 1).to_list(500)
    
    return fornecedores


@router.get("/fornecedores/{fornecedor_id}")
async def get_fornecedor(
    fornecedor_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get a specific supplier"""
    fornecedor = await db.fornecedores.find_one({"id": fornecedor_id}, {"_id": 0})
    
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    
    return fornecedor


@router.post("/fornecedores")
async def criar_fornecedor(
    fornecedor: FornecedorCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new supplier (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    fornecedor_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    fornecedor_doc = {
        "id": fornecedor_id,
        "nome": fornecedor.nome,
        "tipo": fornecedor.tipo,
        "descricao": fornecedor.descricao,
        "contacto_email": fornecedor.contacto_email,
        "contacto_telefone": fornecedor.contacto_telefone,
        "website": fornecedor.website,
        "ativo": fornecedor.ativo,
        "criado_por": current_user["id"],
        "criado_em": now
    }
    
    await db.fornecedores.insert_one(fornecedor_doc)
    
    logger.info(f"Supplier created: {fornecedor.nome} by {current_user['id']}")
    return {"id": fornecedor_id, "message": "Fornecedor criado com sucesso"}


@router.put("/fornecedores/{fornecedor_id}")
async def atualizar_fornecedor(
    fornecedor_id: str,
    data: FornecedorUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Update a supplier (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    update_fields = {k: v for k, v in data.dict().items() if v is not None}
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    
    update_fields["atualizado_por"] = current_user["id"]
    update_fields["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.fornecedores.update_one(
        {"id": fornecedor_id},
        {"$set": update_fields}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    
    return {"message": "Fornecedor atualizado com sucesso"}


@router.delete("/fornecedores/{fornecedor_id}")
async def eliminar_fornecedor(
    fornecedor_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a supplier (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    result = await db.fornecedores.delete_one({"id": fornecedor_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    
    logger.info(f"Supplier deleted: {fornecedor_id} by {current_user['id']}")
    return {"message": "Fornecedor eliminado"}


# ==================== TIPOS DE FORNECEDORES ====================

@router.get("/fornecedores/tipos/lista")
async def listar_tipos_fornecedores(current_user: Dict = Depends(get_current_user)):
    """List available supplier types"""
    tipos = [
        {"id": "combustivel_fossil", "nome": "Combustível Fóssil", "descricao": "Gasolina, Gasóleo"},
        {"id": "combustivel_eletrico", "nome": "Combustível Elétrico", "descricao": "Carregamento elétrico"},
        {"id": "gps", "nome": "GPS/Tracking", "descricao": "Sistemas de localização"},
        {"id": "manutencao", "nome": "Manutenção", "descricao": "Oficinas, peças"},
        {"id": "seguros", "nome": "Seguros", "descricao": "Seguradoras"},
        {"id": "lavagem", "nome": "Lavagem", "descricao": "Serviços de limpeza"},
        {"id": "pneus", "nome": "Pneus", "descricao": "Fornecedores de pneus"},
        {"id": "outros", "nome": "Outros", "descricao": "Outros fornecedores"}
    ]
    
    return tipos


@router.get("/fornecedores/por-tipo/{tipo}")
async def get_fornecedores_por_tipo(
    tipo: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get suppliers by type"""
    fornecedores = await db.fornecedores.find(
        {"tipo": tipo, "ativo": True},
        {"_id": 0}
    ).sort("nome", 1).to_list(100)
    
    return fornecedores


# ==================== FORNECEDORES PRE-DEFINIDOS ====================

@router.post("/admin/seed-fornecedores")
async def seed_fornecedores(current_user: Dict = Depends(get_current_user)):
    """Seed database with default suppliers (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    # Check if already seeded
    existing = await db.fornecedores.count_documents({})
    if existing > 0:
        return {"message": "Fornecedores já existem", "total": existing}
    
    now = datetime.now(timezone.utc).isoformat()
    
    fornecedores_default = [
        # Combustível Fóssil
        {"nome": "Galp", "tipo": "combustivel_fossil", "descricao": "Rede Galp"},
        {"nome": "BP", "tipo": "combustivel_fossil", "descricao": "Rede BP Portugal"},
        {"nome": "Repsol", "tipo": "combustivel_fossil", "descricao": "Rede Repsol"},
        {"nome": "Cepsa", "tipo": "combustivel_fossil", "descricao": "Rede Cepsa"},
        {"nome": "Prio", "tipo": "combustivel_fossil", "descricao": "Rede Prio"},
        
        # Combustível Elétrico
        {"nome": "Mobi.E", "tipo": "combustivel_eletrico", "descricao": "Rede nacional Mobi.E"},
        {"nome": "Galp Electric", "tipo": "combustivel_eletrico", "descricao": "Postos Galp Electric"},
        {"nome": "EDP", "tipo": "combustivel_eletrico", "descricao": "Rede EDP"},
        {"nome": "Tesla Supercharger", "tipo": "combustivel_eletrico", "descricao": "Rede Tesla"},
        {"nome": "Ionity", "tipo": "combustivel_eletrico", "descricao": "Rede Ionity"},
        
        # GPS
        {"nome": "Frotcom", "tipo": "gps", "descricao": "Gestão de frotas Frotcom"},
        {"nome": "Cartrack", "tipo": "gps", "descricao": "Tracking Cartrack"},
        {"nome": "Vodafone Fleet", "tipo": "gps", "descricao": "Vodafone Fleet Analytics"},
        {"nome": "TomTom Telematics", "tipo": "gps", "descricao": "TomTom Webfleet"},
        
        # Seguros
        {"nome": "Fidelidade", "tipo": "seguros", "descricao": "Seguros Fidelidade"},
        {"nome": "Tranquilidade", "tipo": "seguros", "descricao": "Seguros Tranquilidade"},
        {"nome": "Allianz", "tipo": "seguros", "descricao": "Seguros Allianz"},
        {"nome": "Ageas", "tipo": "seguros", "descricao": "Seguros Ageas"},
    ]
    
    for f in fornecedores_default:
        f["id"] = str(uuid.uuid4())
        f["ativo"] = True
        f["criado_por"] = current_user["id"]
        f["criado_em"] = now
    
    await db.fornecedores.insert_many(fornecedores_default)
    
    logger.info(f"Seeded {len(fornecedores_default)} suppliers")
    return {"message": f"Criados {len(fornecedores_default)} fornecedores", "total": len(fornecedores_default)}
