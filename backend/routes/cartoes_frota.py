"""
Cartões de Frota (Fleet Cards) Router
Handles fuel cards, Via Verde, and other fleet cards management
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/cartoes-frota", tags=["cartoes-frota"])
db = get_database()
logger = logging.getLogger(__name__)


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# Pydantic models
class CartaoFrotaCreate(BaseModel):
    numero_cartao: str
    tipo: str  # combustivel, via_verde, estacionamento
    fornecedor: str
    motorista_atribuido: Optional[str] = None
    observacoes: Optional[str] = None


class CartaoFrota(BaseModel):
    id: str
    numero_cartao: str
    tipo: str
    fornecedor: Optional[str] = None
    status: str
    motorista_atribuido: Optional[str] = None
    motorista_nome: Optional[str] = None
    observacoes: Optional[str] = None
    created_at: str
    created_by: str
    updated_at: Optional[str] = None


# ==================== CRUD ====================

@router.post("", response_model=CartaoFrota)
async def criar_cartao_frota(cartao: CartaoFrotaCreate, current_user: Dict = Depends(get_current_user)):
    """Criar novo cartão de frota"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Verificar se cartão já existe
    existe = await db.cartoes_frota.find_one({"numero_cartao": cartao.numero_cartao}, {"_id": 0})
    if existe:
        raise HTTPException(status_code=400, detail=f"Cartão {cartao.numero_cartao} já existe")
    
    # Se motorista foi especificado, buscar nome
    motorista_nome = None
    if cartao.motorista_atribuido:
        motorista = await db.motoristas.find_one({"id": cartao.motorista_atribuido}, {"_id": 0, "name": 1})
        if motorista:
            motorista_nome = motorista.get("name")
    
    cartao_dict = {
        "id": str(uuid.uuid4()),
        "numero_cartao": cartao.numero_cartao,
        "tipo": cartao.tipo,
        "fornecedor": cartao.fornecedor,
        "status": "ativo",
        "motorista_atribuido": cartao.motorista_atribuido,
        "motorista_nome": motorista_nome,
        "observacoes": cartao.observacoes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
        "updated_at": None
    }
    
    await db.cartoes_frota.insert_one(cartao_dict)
    logger.info(f"✅ Cartão de frota criado: {cartao.numero_cartao} ({cartao.tipo}) -> Motorista: {motorista_nome}")
    return cartao_dict


@router.get("", response_model=List[CartaoFrota])
async def listar_cartoes_frota(current_user: Dict = Depends(get_current_user)):
    """Listar todos os cartões de frota"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    cartoes = await db.cartoes_frota.find({}, {"_id": 0}).to_list(None)
    return cartoes


@router.get("/disponiveis/{tipo}")
async def listar_cartoes_disponiveis(tipo: str, current_user: Dict = Depends(get_current_user)):
    """Listar cartões disponíveis (não atribuídos) de um tipo específico"""
    cartoes = await db.cartoes_frota.find(
        {
            "tipo": tipo,
            "status": "ativo",
            "$or": [
                {"motorista_atribuido": None},
                {"motorista_atribuido": ""}
            ]
        },
        {"_id": 0}
    ).to_list(None)
    return cartoes


@router.get("/{cartao_id}", response_model=CartaoFrota)
async def obter_cartao_frota(cartao_id: str, current_user: Dict = Depends(get_current_user)):
    """Obter detalhes de um cartão"""
    cartao = await db.cartoes_frota.find_one({"id": cartao_id}, {"_id": 0})
    if not cartao:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")
    return cartao


@router.put("/{cartao_id}")
async def atualizar_cartao_frota(cartao_id: str, updates: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    """Atualizar cartão de frota"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    cartao = await db.cartoes_frota.find_one({"id": cartao_id}, {"_id": 0})
    if not cartao:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")
    
    # Se motorista foi atribuído/removido, atualizar nome
    if "motorista_atribuido" in updates:
        if updates["motorista_atribuido"]:
            motorista = await db.motoristas.find_one({"id": updates["motorista_atribuido"]}, {"_id": 0, "name": 1})
            if motorista:
                updates["motorista_nome"] = motorista.get("name")
            else:
                updates["motorista_nome"] = None
        else:
            updates["motorista_nome"] = None
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.cartoes_frota.update_one({"id": cartao_id}, {"$set": updates})
    
    logger.info(f"✅ Cartão {cartao['numero_cartao']} atualizado")
    return {"message": "Cartão atualizado com sucesso"}


@router.delete("/{cartao_id}")
async def deletar_cartao_frota(cartao_id: str, current_user: Dict = Depends(get_current_user)):
    """Deletar cartão de frota"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Apenas admin/gestão pode deletar cartões")
    
    cartao = await db.cartoes_frota.find_one({"id": cartao_id}, {"_id": 0})
    if not cartao:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")
    
    # Verificar se cartão está atribuído
    if cartao.get("motorista_atribuido"):
        raise HTTPException(status_code=400, detail=f"Cartão está atribuído a {cartao.get('motorista_nome')}. Remova a atribuição primeiro.")
    
    await db.cartoes_frota.delete_one({"id": cartao_id})
    logger.info(f"🗑️ Cartão {cartao['numero_cartao']} deletado")
    return {"message": "Cartão deletado com sucesso"}


# ==================== ATRIBUIÇÕES ====================

@router.post("/{cartao_id}/atribuir")
async def atribuir_cartao(
    cartao_id: str,
    atribuicao: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Atribuir cartão a um motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    cartao = await db.cartoes_frota.find_one({"id": cartao_id}, {"_id": 0})
    if not cartao:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")
    
    motorista_id = atribuicao.get("motorista_id")
    if not motorista_id:
        raise HTTPException(status_code=400, detail="motorista_id é obrigatório")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0, "name": 1})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    await db.cartoes_frota.update_one(
        {"id": cartao_id},
        {"$set": {
            "motorista_atribuido": motorista_id,
            "motorista_nome": motorista.get("name"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"✅ Cartão {cartao['numero_cartao']} atribuído a {motorista.get('name')}")
    return {"message": f"Cartão atribuído a {motorista.get('name')}"}


@router.post("/{cartao_id}/remover-atribuicao")
async def remover_atribuicao_cartao(
    cartao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remover atribuição de cartão"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    cartao = await db.cartoes_frota.find_one({"id": cartao_id}, {"_id": 0})
    if not cartao:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")
    
    await db.cartoes_frota.update_one(
        {"id": cartao_id},
        {"$set": {
            "motorista_atribuido": None,
            "motorista_nome": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"✅ Atribuição do cartão {cartao['numero_cartao']} removida")
    return {"message": "Atribuição removida"}


# ==================== ESTATÍSTICAS ====================

@router.get("/stats/resumo")
async def estatisticas_cartoes(current_user: Dict = Depends(get_current_user)):
    """Obter estatísticas dos cartões de frota"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Total por tipo
    pipeline_tipo = [
        {"$group": {"_id": "$tipo", "count": {"$sum": 1}}}
    ]
    por_tipo = await db.cartoes_frota.aggregate(pipeline_tipo).to_list(10)
    
    # Total atribuídos vs disponíveis
    total = await db.cartoes_frota.count_documents({})
    atribuidos = await db.cartoes_frota.count_documents({"motorista_atribuido": {"$ne": None, "$ne": ""}})
    disponiveis = total - atribuidos
    
    # Por fornecedor
    pipeline_fornecedor = [
        {"$group": {"_id": "$fornecedor", "count": {"$sum": 1}}}
    ]
    por_fornecedor = await db.cartoes_frota.aggregate(pipeline_fornecedor).to_list(20)
    
    return {
        "total": total,
        "atribuidos": atribuidos,
        "disponiveis": disponiveis,
        "por_tipo": {item["_id"]: item["count"] for item in por_tipo},
        "por_fornecedor": {item["_id"]: item["count"] for item in por_fornecedor}
    }
