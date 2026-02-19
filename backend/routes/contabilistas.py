"""
Rotas para Gestão de Contabilistas
- Contabilistas são criados por Parceiros, Gestores ou Admin
- Têm acesso apenas a consulta de faturas e recibos dos parceiros atribuídos
- Associados automaticamente ao parceiro que os cria
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user, hash_password
from models.user import UserRole

router = APIRouter(prefix="/contabilistas", tags=["Contabilistas"])
logger = logging.getLogger(__name__)
db = get_database()


class ContabilistaCreate(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None
    password: str


class ContabilistaUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    ativo: Optional[bool] = None


@router.post("/criar")
async def criar_contabilista(
    data: ContabilistaCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Criar novo contabilista
    - Parceiro: contabilista fica associado apenas a esse parceiro
    - Gestor: contabilista fica associado a TODOS os parceiros do gestor
    - Admin: pode especificar parceiros manualmente
    """
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Sem permissão para criar contabilistas")
    
    # Verificar se email já existe
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email já registado")
    
    now = datetime.now(timezone.utc)
    contabilista_id = str(uuid.uuid4())
    
    # Determinar parceiros associados
    parceiros_associados = []
    
    if current_user["role"] == UserRole.PARCEIRO:
        # Parceiro cria: associado apenas a ele
        parceiros_associados = [current_user["id"]]
        
    elif current_user["role"] == UserRole.GESTAO:
        # Gestor cria: associado a todos os parceiros do gestor
        gestor = await db.users.find_one(
            {"id": current_user["id"]},
            {"_id": 0, "parceiros_atribuidos": 1}
        )
        parceiros_associados = gestor.get("parceiros_atribuidos", []) if gestor else []
        
        if not parceiros_associados:
            raise HTTPException(status_code=400, detail="Gestor não tem parceiros associados")
    
    elif current_user["role"] == UserRole.ADMIN:
        # Admin pode criar sem parceiro específico (associar depois)
        parceiros_associados = []
    
    # Criar utilizador contabilista
    contabilista = {
        "id": contabilista_id,
        "email": data.email,
        "name": data.name,
        "phone": data.phone,
        "password": hash_password(data.password),
        "role": UserRole.CONTABILISTA,
        "approved": True,  # Contabilistas são auto-aprovados
        "ativo": True,
        "parceiros_associados": parceiros_associados,
        "parceiro_ativo_id": parceiros_associados[0] if parceiros_associados else None,
        "criado_por": current_user["id"],
        "criado_por_role": current_user["role"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.users.insert_one(contabilista)
    
    # Remover password da resposta
    del contabilista["password"]
    contabilista.pop("_id", None)
    
    logger.info(f"Contabilista {contabilista_id} criado por {current_user['email']} ({current_user['role']})")
    
    return {
        "success": True,
        "message": "Contabilista criado com sucesso",
        "contabilista": contabilista
    }


@router.get("/lista")
async def listar_contabilistas(
    current_user: dict = Depends(get_current_user)
):
    """Listar contabilistas do parceiro/gestor"""
    
    query = {"role": UserRole.CONTABILISTA}
    
    if current_user["role"] == UserRole.ADMIN:
        # Admin vê todos
        pass
    elif current_user["role"] == UserRole.PARCEIRO:
        # Parceiro vê apenas seus contabilistas
        query["parceiros_associados"] = current_user["id"]
    elif current_user["role"] == UserRole.GESTAO:
        # Gestor vê contabilistas dos seus parceiros
        gestor = await db.users.find_one(
            {"id": current_user["id"]},
            {"_id": 0, "parceiros_atribuidos": 1}
        )
        parceiro_ids = gestor.get("parceiros_atribuidos", []) if gestor else []
        query["parceiros_associados"] = {"$in": parceiro_ids}
    else:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    contabilistas = await db.users.find(
        query,
        {"_id": 0, "password": 0}
    ).to_list(1000)
    
    # Enriquecer com nomes dos parceiros
    for cont in contabilistas:
        parceiros_ids = cont.get("parceiros_associados", [])
        parceiros = await db.parceiros.find(
            {"id": {"$in": parceiros_ids}},
            {"_id": 0, "id": 1, "nome_empresa": 1, "name": 1}
        ).to_list(100)
        cont["parceiros_nomes"] = [p.get("nome_empresa") or p.get("name", "") for p in parceiros]
    
    return {
        "contabilistas": contabilistas,
        "total": len(contabilistas)
    }


@router.get("/{contabilista_id}")
async def obter_contabilista(
    contabilista_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de um contabilista"""
    
    contabilista = await db.users.find_one(
        {"id": contabilista_id, "role": UserRole.CONTABILISTA},
        {"_id": 0, "password": 0}
    )
    
    if not contabilista:
        raise HTTPException(status_code=404, detail="Contabilista não encontrado")
    
    # Verificar permissão
    if current_user["role"] == UserRole.PARCEIRO:
        if current_user["id"] not in contabilista.get("parceiros_associados", []):
            raise HTTPException(status_code=403, detail="Não autorizado")
    elif current_user["role"] == UserRole.GESTAO:
        gestor = await db.users.find_one(
            {"id": current_user["id"]},
            {"_id": 0, "parceiros_atribuidos": 1}
        )
        parceiro_ids = gestor.get("parceiros_atribuidos", []) if gestor else []
        if not any(p in parceiro_ids for p in contabilista.get("parceiros_associados", [])):
            raise HTTPException(status_code=403, detail="Não autorizado")
    elif current_user["role"] not in [UserRole.ADMIN, UserRole.CONTABILISTA]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Enriquecer com nomes dos parceiros
    parceiros_ids = contabilista.get("parceiros_associados", [])
    parceiros = await db.parceiros.find(
        {"id": {"$in": parceiros_ids}},
        {"_id": 0, "id": 1, "nome_empresa": 1, "name": 1}
    ).to_list(100)
    contabilista["parceiros_detalhes"] = parceiros
    
    return contabilista


@router.put("/{contabilista_id}")
async def atualizar_contabilista(
    contabilista_id: str,
    data: ContabilistaUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar contabilista"""
    
    contabilista = await db.users.find_one(
        {"id": contabilista_id, "role": UserRole.CONTABILISTA},
        {"_id": 0}
    )
    
    if not contabilista:
        raise HTTPException(status_code=404, detail="Contabilista não encontrado")
    
    # Verificar permissão
    if current_user["role"] == UserRole.PARCEIRO:
        if current_user["id"] not in contabilista.get("parceiros_associados", []):
            raise HTTPException(status_code=403, detail="Não autorizado")
    elif current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Atualizar apenas campos fornecidos
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"id": contabilista_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Contabilista atualizado"}


@router.put("/{contabilista_id}/editar")
async def editar_contabilista_completo(
    contabilista_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Editar contabilista - nome, email, telefone e password"""
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    contabilista = await db.users.find_one(
        {"id": contabilista_id, "role": UserRole.CONTABILISTA},
        {"_id": 0}
    )
    
    if not contabilista:
        raise HTTPException(status_code=404, detail="Contabilista não encontrado")
    
    # Verificar permissão
    if current_user["role"] == UserRole.PARCEIRO:
        if current_user["id"] not in contabilista.get("parceiros_associados", []):
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    update_data = {}
    
    if "name" in data and data["name"]:
        update_data["name"] = data["name"]
    
    if "email" in data and data["email"]:
        # Verificar se email já existe
        existing = await db.users.find_one(
            {"email": data["email"], "id": {"$ne": contabilista_id}},
            {"_id": 0}
        )
        if existing:
            raise HTTPException(status_code=400, detail="Email já registado")
        update_data["email"] = data["email"]
    
    if "phone" in data:
        update_data["phone"] = data["phone"]
    
    if "password" in data and data["password"]:
        update_data["password"] = hash_password(data["password"])
    
    if "ativo" in data:
        update_data["ativo"] = data["ativo"]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"id": contabilista_id},
        {"$set": update_data}
    )
    
    logger.info(f"Contabilista {contabilista_id} editado por {current_user['email']}")
    
    return {"success": True, "message": "Contabilista atualizado com sucesso"}


@router.delete("/{contabilista_id}")
async def eliminar_contabilista(
    contabilista_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar contabilista"""
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    contabilista = await db.users.find_one(
        {"id": contabilista_id, "role": UserRole.CONTABILISTA},
        {"_id": 0}
    )
    
    if not contabilista:
        raise HTTPException(status_code=404, detail="Contabilista não encontrado")
    
    # Verificar permissão
    if current_user["role"] == UserRole.PARCEIRO:
        if current_user["id"] not in contabilista.get("parceiros_associados", []):
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    await db.users.delete_one({"id": contabilista_id})
    
    logger.info(f"Contabilista {contabilista_id} eliminado por {current_user['email']}")
    
    return {"success": True, "message": "Contabilista eliminado"}


@router.put("/{contabilista_id}/atribuir-parceiros")
async def atribuir_parceiros_a_contabilista(
    contabilista_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Atribuir parceiros a um contabilista (Admin apenas)"""
    
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas admin pode atribuir parceiros a contabilistas")
    
    parceiros_ids = data.get("parceiros_ids", [])
    
    # Verificar que contabilista existe
    contabilista = await db.users.find_one(
        {"id": contabilista_id, "role": UserRole.CONTABILISTA},
        {"_id": 0}
    )
    if not contabilista:
        raise HTTPException(status_code=404, detail="Contabilista não encontrado")
    
    # Verificar que todos os parceiros existem
    for parceiro_id in parceiros_ids:
        parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
        if not parceiro:
            raise HTTPException(status_code=404, detail=f"Parceiro {parceiro_id} não encontrado")
    
    # Atualizar contabilista
    await db.users.update_one(
        {"id": contabilista_id},
        {"$set": {
            "parceiros_associados": parceiros_ids,
            "parceiro_ativo_id": parceiros_ids[0] if parceiros_ids else None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": f"Parceiros atribuídos ao contabilista {contabilista.get('name')}",
        "contabilista_id": contabilista_id,
        "parceiros_atribuidos": parceiros_ids
    }


@router.post("/{contabilista_id}/selecionar-parceiro")
async def selecionar_parceiro_ativo_contabilista(
    contabilista_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Contabilista seleciona qual parceiro quer visualizar ativamente"""
    
    if current_user["role"] != UserRole.CONTABILISTA:
        raise HTTPException(status_code=403, detail="Apenas contabilistas podem selecionar parceiro ativo")
    
    if current_user["id"] != contabilista_id:
        raise HTTPException(status_code=403, detail="Contabilista só pode selecionar para si próprio")
    
    parceiro_id = data.get("parceiro_id")
    
    if not parceiro_id:
        # Limpar parceiro ativo
        await db.users.update_one(
            {"id": contabilista_id},
            {"$set": {
                "parceiro_ativo_id": None,
                "parceiro_ativo_nome": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Parceiro ativo removido", "parceiro_ativo_id": None}
    
    # Verificar que contabilista tem acesso a este parceiro
    contabilista = await db.users.find_one(
        {"id": contabilista_id, "role": UserRole.CONTABILISTA},
        {"_id": 0}
    )
    if not contabilista:
        raise HTTPException(status_code=404, detail="Contabilista não encontrado")
    
    parceiros_associados = contabilista.get("parceiros_associados", [])
    if parceiro_id not in parceiros_associados:
        raise HTTPException(status_code=403, detail="Parceiro não atribuído a este contabilista")
    
    # Obter detalhes do parceiro
    parceiro = await db.parceiros.find_one(
        {"id": parceiro_id},
        {"_id": 0, "nome_empresa": 1, "name": 1, "email": 1}
    )
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    # Atualizar contabilista com parceiro ativo
    await db.users.update_one(
        {"id": contabilista_id},
        {"$set": {
            "parceiro_ativo_id": parceiro_id,
            "parceiro_ativo_nome": parceiro.get("nome_empresa") or parceiro.get("name"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": f"Parceiro {parceiro.get('nome_empresa') or parceiro.get('name')} selecionado",
        "parceiro_ativo_id": parceiro_id,
        "parceiro_ativo_nome": parceiro.get("nome_empresa") or parceiro.get("name")
    }


@router.get("/{contabilista_id}/parceiro-ativo")
async def get_parceiro_ativo_contabilista(
    contabilista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter parceiro ativo atual do contabilista"""
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.CONTABILISTA]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] == UserRole.CONTABILISTA and current_user["id"] != contabilista_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    contabilista = await db.users.find_one(
        {"id": contabilista_id, "role": UserRole.CONTABILISTA},
        {"_id": 0}
    )
    if not contabilista:
        raise HTTPException(status_code=404, detail="Contabilista não encontrado")
    
    parceiro_ativo_id = contabilista.get("parceiro_ativo_id")
    
    if not parceiro_ativo_id:
        return {
            "parceiro_ativo_id": None,
            "parceiro_ativo_nome": None,
            "parceiro": None
        }
    
    # Obter dados completos do parceiro
    parceiro = await db.parceiros.find_one({"id": parceiro_ativo_id}, {"_id": 0})
    
    return {
        "parceiro_ativo_id": parceiro_ativo_id,
        "parceiro_ativo_nome": contabilista.get("parceiro_ativo_nome"),
        "parceiro": parceiro
    }


@router.get("/{contabilista_id}/parceiros")
async def get_parceiros_do_contabilista(
    contabilista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter lista de parceiros associados ao contabilista"""
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.CONTABILISTA]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] == UserRole.CONTABILISTA and current_user["id"] != contabilista_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    contabilista = await db.users.find_one(
        {"id": contabilista_id, "role": UserRole.CONTABILISTA},
        {"_id": 0}
    )
    if not contabilista:
        raise HTTPException(status_code=404, detail="Contabilista não encontrado")
    
    parceiros_ids = contabilista.get("parceiros_associados", [])
    
    if not parceiros_ids:
        return {
            "contabilista_id": contabilista_id,
            "contabilista_nome": contabilista.get("name"),
            "parceiros": [],
            "total": 0
        }
    
    parceiros = await db.parceiros.find(
        {"id": {"$in": parceiros_ids}},
        {"_id": 0}
    ).to_list(1000)
    
    return {
        "contabilista_id": contabilista_id,
        "contabilista_nome": contabilista.get("name"),
        "parceiros": parceiros,
        "total": len(parceiros)
    }
