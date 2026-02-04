"""
Rotas para Gestão de Inspetores
- Inspetores são criados por Parceiros ou Gestores
- Apenas fazem vistorias na app móvel
- Associados automaticamente ao parceiro/parceiros
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user, hash_password
from models.user import UserRole

router = APIRouter(prefix="/inspetores", tags=["Inspetores"])
logger = logging.getLogger(__name__)
db = get_database()


class InspetorCreate(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None
    password: str


class InspetorUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    ativo: Optional[bool] = None


@router.post("/criar")
async def criar_inspetor(
    data: InspetorCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Criar novo inspetor
    - Parceiro: inspetor fica associado apenas a esse parceiro
    - Gestor: inspetor fica associado a TODOS os parceiros do gestor
    - Admin: pode especificar parceiros manualmente
    """
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Sem permissão para criar inspetores")
    
    # Verificar se email já existe
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email já registado")
    
    now = datetime.now(timezone.utc)
    inspetor_id = str(uuid.uuid4())
    
    # Determinar parceiros associados
    parceiros_associados = []
    
    if current_user["role"] == UserRole.PARCEIRO:
        # Parceiro cria: associado apenas a ele
        parceiros_associados = [current_user["id"]]
        
    elif current_user["role"] == UserRole.GESTAO:
        # Gestor cria: associado a todos os parceiros do gestor
        gestor_parceiros = await db.gestor_parceiro.find(
            {"gestor_id": current_user["id"]},
            {"_id": 0, "parceiro_id": 1}
        ).to_list(100)
        parceiros_associados = [gp["parceiro_id"] for gp in gestor_parceiros]
        
        if not parceiros_associados:
            raise HTTPException(status_code=400, detail="Gestor não tem parceiros associados")
    
    elif current_user["role"] == UserRole.ADMIN:
        # Admin pode criar sem parceiro específico (associar depois)
        parceiros_associados = []
    
    # Criar utilizador inspetor
    inspetor = {
        "id": inspetor_id,
        "email": data.email,
        "name": data.name,
        "phone": data.phone,
        "password": hash_password(data.password),
        "role": UserRole.INSPETOR,
        "approved": True,  # Inspetores são auto-aprovados
        "ativo": True,
        "parceiros_associados": parceiros_associados,
        "criado_por": current_user["id"],
        "criado_por_role": current_user["role"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.users.insert_one(inspetor)
    
    # Remover password da resposta
    del inspetor["password"]
    inspetor.pop("_id", None)
    
    logger.info(f"Inspetor {inspetor_id} criado por {current_user['email']} ({current_user['role']})")
    
    return {
        "success": True,
        "message": "Inspetor criado com sucesso",
        "inspetor": inspetor
    }


@router.get("/lista")
async def listar_inspetores(
    current_user: dict = Depends(get_current_user)
):
    """Listar inspetores do parceiro/gestor"""
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    query = {"role": UserRole.INSPETOR}
    
    if current_user["role"] == UserRole.PARCEIRO:
        # Parceiro vê apenas seus inspetores
        query["parceiros_associados"] = current_user["id"]
        
    elif current_user["role"] == UserRole.GESTAO:
        # Gestor vê inspetores dos seus parceiros
        gestor_parceiros = await db.gestor_parceiro.find(
            {"gestor_id": current_user["id"]},
            {"_id": 0, "parceiro_id": 1}
        ).to_list(100)
        parceiro_ids = [gp["parceiro_id"] for gp in gestor_parceiros]
        query["parceiros_associados"] = {"$in": parceiro_ids}
    
    # Admin vê todos
    
    inspetores = await db.users.find(
        query,
        {"_id": 0, "password": 0}
    ).sort("created_at", -1).to_list(200)
    
    # Enriquecer com nomes dos parceiros
    for insp in inspetores:
        if insp.get("parceiros_associados"):
            parceiros = await db.users.find(
                {"id": {"$in": insp["parceiros_associados"]}, "role": UserRole.PARCEIRO},
                {"_id": 0, "id": 1, "name": 1}
            ).to_list(50)
            insp["parceiros_nomes"] = [p["name"] for p in parceiros]
        else:
            insp["parceiros_nomes"] = []
    
    return {
        "inspetores": inspetores,
        "total": len(inspetores)
    }


@router.get("/{inspetor_id}")
async def obter_inspetor(
    inspetor_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de um inspetor"""
    
    inspetor = await db.users.find_one(
        {"id": inspetor_id, "role": UserRole.INSPETOR},
        {"_id": 0, "password": 0}
    )
    
    if not inspetor:
        raise HTTPException(status_code=404, detail="Inspetor não encontrado")
    
    # Verificar permissão
    if current_user["role"] == UserRole.PARCEIRO:
        if current_user["id"] not in inspetor.get("parceiros_associados", []):
            raise HTTPException(status_code=403, detail="Sem permissão")
    elif current_user["role"] == UserRole.GESTAO:
        gestor_parceiros = await db.gestor_parceiro.find(
            {"gestor_id": current_user["id"]},
            {"_id": 0, "parceiro_id": 1}
        ).to_list(100)
        parceiro_ids = [gp["parceiro_id"] for gp in gestor_parceiros]
        if not any(p in parceiro_ids for p in inspetor.get("parceiros_associados", [])):
            raise HTTPException(status_code=403, detail="Sem permissão")
    
    # Buscar estatísticas de vistorias
    vistorias_count = await db.vistorias_mobile.count_documents(
        {"inspetor_id": inspetor_id}
    )
    inspetor["total_vistorias"] = vistorias_count
    
    return inspetor


@router.put("/{inspetor_id}")
async def atualizar_inspetor(
    inspetor_id: str,
    data: InspetorUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar inspetor"""
    
    inspetor = await db.users.find_one(
        {"id": inspetor_id, "role": UserRole.INSPETOR},
        {"_id": 0}
    )
    
    if not inspetor:
        raise HTTPException(status_code=404, detail="Inspetor não encontrado")
    
    # Verificar permissão
    if current_user["role"] == UserRole.PARCEIRO:
        if current_user["id"] not in inspetor.get("parceiros_associados", []):
            raise HTTPException(status_code=403, detail="Sem permissão")
    elif current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.ativo is not None:
        update_data["ativo"] = data.ativo
    
    await db.users.update_one(
        {"id": inspetor_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Inspetor atualizado"}


class InspetorEditSchema(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: Optional[str] = None


@router.put("/{inspetor_id}/editar")
async def editar_inspetor_completo(
    inspetor_id: str,
    data: InspetorEditSchema,
    current_user: dict = Depends(get_current_user)
):
    """Editar inspetor - nome, email, telefone e password"""
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    inspetor = await db.users.find_one(
        {"id": inspetor_id, "role": UserRole.INSPETOR},
        {"_id": 0}
    )
    
    if not inspetor:
        raise HTTPException(status_code=404, detail="Inspetor não encontrado")
    
    # Verificar permissão
    if current_user["role"] == UserRole.PARCEIRO:
        if current_user["id"] not in inspetor.get("parceiros_associados", []):
            raise HTTPException(status_code=403, detail="Sem permissão")
    
    # Verificar se email já existe (se foi alterado)
    if data.email != inspetor.get("email"):
        existing = await db.users.find_one(
            {"email": data.email, "id": {"$ne": inspetor_id}},
            {"_id": 0}
        )
        if existing:
            raise HTTPException(status_code=400, detail="Email já está em uso")
    
    update_data = {
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Se password foi fornecida, atualizar
    if data.password and len(data.password) >= 6:
        update_data["password"] = hash_password(data.password)
    
    await db.users.update_one(
        {"id": inspetor_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Inspetor atualizado com sucesso"}


@router.delete("/{inspetor_id}")
async def eliminar_inspetor(
    inspetor_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar/Desativar inspetor"""
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    inspetor = await db.users.find_one(
        {"id": inspetor_id, "role": UserRole.INSPETOR},
        {"_id": 0}
    )
    
    if not inspetor:
        raise HTTPException(status_code=404, detail="Inspetor não encontrado")
    
    # Verificar permissão
    if current_user["role"] == UserRole.PARCEIRO:
        if current_user["id"] not in inspetor.get("parceiros_associados", []):
            raise HTTPException(status_code=403, detail="Sem permissão")
    
    # Soft delete - apenas desativar
    await db.users.update_one(
        {"id": inspetor_id},
        {"$set": {
            "ativo": False,
            "desativado_em": datetime.now(timezone.utc).isoformat(),
            "desativado_por": current_user["id"]
        }}
    )
    
    return {"success": True, "message": "Inspetor desativado"}


@router.post("/{inspetor_id}/associar-parceiro")
async def associar_parceiro(
    inspetor_id: str,
    parceiro_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Associar inspetor a um parceiro adicional (apenas admin)"""
    
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas admin pode associar parceiros")
    
    inspetor = await db.users.find_one(
        {"id": inspetor_id, "role": UserRole.INSPETOR},
        {"_id": 0}
    )
    
    if not inspetor:
        raise HTTPException(status_code=404, detail="Inspetor não encontrado")
    
    parceiro = await db.users.find_one(
        {"id": parceiro_id, "role": UserRole.PARCEIRO},
        {"_id": 0}
    )
    
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    parceiros_atuais = inspetor.get("parceiros_associados", [])
    if parceiro_id not in parceiros_atuais:
        parceiros_atuais.append(parceiro_id)
        
        await db.users.update_one(
            {"id": inspetor_id},
            {"$set": {"parceiros_associados": parceiros_atuais}}
        )
    
    return {"success": True, "message": "Parceiro associado ao inspetor"}
