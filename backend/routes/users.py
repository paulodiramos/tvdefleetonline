"""User management routes"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import logging

from models.user import UserRole
from utils.auth import get_current_user, get_password_hash
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)


class UserStatusUpdate(BaseModel):
    status: str  # 'active' or 'blocked'


class UserRoleUpdate(BaseModel):
    role: str


class PasswordReset(BaseModel):
    new_password: str


class ApproveUserRequest(BaseModel):
    plano_id: Optional[str] = None
    preco_especial_id: Optional[str] = None
    parceiro_id: Optional[str] = None
    classificacao: Optional[str] = None


@router.get("/users/pending")
async def get_pending_users(current_user: Dict = Depends(get_current_user)):
    """Listar utilizadores pendentes de aprovação"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    users = await db.users.find(
        {"approved": False},
        {"_id": 0, "password": 0}
    ).to_list(length=None)
    
    return users


@router.get("/users/all")
async def get_all_users(current_user: Dict = Depends(get_current_user)):
    """Listar todos os utilizadores"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Build query based on role
    query = {}
    if current_user["role"] == UserRole.GESTAO:
        # Gestores só veem parceiros e motoristas
        query["role"] = {"$in": ["parceiro", "motorista"]}
    
    users = await db.users.find(
        query,
        {"_id": 0, "password": 0}
    ).to_list(length=None)
    
    # Enrich with additional data
    for user in users:
        if user.get("role") == "parceiro":
            parceiro = await db.parceiros.find_one(
                {"$or": [{"id": user["id"]}, {"email": user.get("email")}]},
                {"_id": 0, "nome_empresa": 1}
            )
            if parceiro:
                user["nome_empresa"] = parceiro.get("nome_empresa")
        
        if user.get("role") == "motorista":
            motorista = await db.motoristas.find_one(
                {"$or": [{"id": user["id"]}, {"email": user.get("email")}]},
                {"_id": 0, "parceiro_id": 1}
            )
            if motorista:
                user["parceiro_id"] = motorista.get("parceiro_id")
    
    return users


@router.get("/users/{user_id}")
async def get_user_by_id(user_id: str, current_user: Dict = Depends(get_current_user)):
    """Obter dados de um utilizador específico"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, "admin", "gestao"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Enrich with additional data
    if user.get("role") == "parceiro":
        parceiro = await db.parceiros.find_one(
            {"$or": [{"id": user["id"]}, {"email": user.get("email")}]},
            {"_id": 0, "nome_empresa": 1}
        )
        if parceiro:
            user["parceiro_name"] = parceiro.get("nome_empresa")
    
    if user.get("role") == "motorista":
        motorista = await db.motoristas.find_one(
            {"$or": [{"id": user["id"]}, {"email": user.get("email")}]},
            {"_id": 0, "parceiro_id": 1}
        )
        if motorista:
            user["parceiro_id"] = motorista.get("parceiro_id")
            # Get partner name
            if motorista.get("parceiro_id"):
                parceiro = await db.parceiros.find_one(
                    {"id": motorista["parceiro_id"]},
                    {"_id": 0, "nome_empresa": 1, "name": 1}
                )
                if parceiro:
                    user["parceiro_name"] = parceiro.get("nome_empresa") or parceiro.get("name")
    
    return user



@router.put("/users/{user_id}/approve")
async def approve_user(
    user_id: str,
    request: ApproveUserRequest = None,
    current_user: Dict = Depends(get_current_user)
):
    """Aprovar um utilizador com atribuição opcional de plano e preço especial"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Prepare update data
    update_data = {
        "approved": True,
        "approved_by": current_user["id"],
        "approved_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add plano_id if provided
    if request and request.plano_id:
        # Verify the plan exists
        plano = await db.planos_sistema.find_one({"id": request.plano_id, "ativo": True})
        if plano:
            update_data["plano_id"] = request.plano_id
            update_data["plano_nome"] = plano.get("nome")
            logger.info(f"Assigning plan {request.plano_id} to user {user_id}")
            
            # Add preco_especial_id if provided and valid
            if request.preco_especial_id:
                precos_especiais = plano.get("precos_especiais", [])
                preco_especial = next(
                    (p for p in precos_especiais if p.get("id") == request.preco_especial_id),
                    None
                )
                if preco_especial:
                    update_data["preco_especial_id"] = request.preco_especial_id
                    update_data["preco_especial_nome"] = preco_especial.get("nome")
                    logger.info(f"Assigning special price {request.preco_especial_id} to user {user_id}")
    
    # Add parceiro_id if provided (for motoristas)
    if request and request.parceiro_id:
        parceiro = await db.parceiros.find_one({"id": request.parceiro_id})
        if parceiro:
            update_data["associated_partner_id"] = request.parceiro_id
            update_data["parceiro_nome"] = parceiro.get("nome") or parceiro.get("name")
            logger.info(f"Assigning partner {request.parceiro_id} to user {user_id}")
    
    # Add classificacao if provided
    if request and request.classificacao:
        update_data["classificacao"] = request.classificacao
        logger.info(f"Assigning classification {request.classificacao} to user {user_id}")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    # Also approve in motoristas/parceiros if applicable
    if user.get("role") == "motorista":
        # Check if motorista document exists
        motorista_exists = await db.motoristas.find_one(
            {"$or": [{"id": user_id}, {"email": user.get("email")}]}
        )
        
        if motorista_exists:
            # Update existing motorista
            await db.motoristas.update_one(
                {"$or": [{"id": user_id}, {"email": user.get("email")}]},
                {
                    "$set": {
                        "approved": True,
                        "approved_by": current_user["id"],
                        "approved_at": datetime.now(timezone.utc).isoformat(),
                        "ativo": True,
                        "status_motorista": "ativo"
                    }
                }
            )
        else:
            # Create motorista document if it doesn't exist
            import uuid as uuid_module
            motorista_doc = {
                "id": user_id,
                "email": user.get("email"),
                "name": user.get("name"),
                "nome": user.get("name"),
                "phone": user.get("phone"),
                "telefone": user.get("phone"),
                "approved": True,
                "approved_by": current_user["id"],
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "ativo": True,
                "status_motorista": "ativo",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "id_cartao_frota_combustivel": f"FROTA-{str(uuid_module.uuid4())[:8].upper()}",
                "documents": {
                    "license_photo": None,
                    "cv_file": None,
                    "profile_photo": None,
                    "documento_identificacao": None,
                    "licenca_tvde": None,
                    "registo_criminal": None,
                    "contrato": None,
                    "additional_docs": []
                }
            }
            await db.motoristas.insert_one(motorista_doc)
            logger.info(f"Created motorista document for user {user_id}")
            
    elif user.get("role") == "parceiro":
        # Check if parceiro document exists
        parceiro_exists = await db.parceiros.find_one(
            {"$or": [{"id": user_id}, {"email": user.get("email")}]}
        )
        
        parceiro_update = {
            "approved": True,
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }
        if request and request.plano_id:
            parceiro_update["plano_id"] = request.plano_id
            if request.preco_especial_id:
                parceiro_update["preco_especial_id"] = request.preco_especial_id
        
        if parceiro_exists:
            await db.parceiros.update_one(
                {"$or": [{"id": user_id}, {"email": user.get("email")}]},
                {"$set": parceiro_update}
            )
        else:
            # Create parceiro document if it doesn't exist
            parceiro_doc = {
                "id": user_id,
                "email": user.get("email"),
                "name": user.get("name"),
                "nome_empresa": user.get("name"),
                "phone": user.get("phone"),
                "telefone": user.get("phone"),
                **parceiro_update,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.parceiros.insert_one(parceiro_doc)
            logger.info(f"Created parceiro document for user {user_id}")
    
    logger.info(f"User {user_id} approved by {current_user['id']}")
    return {"message": "Utilizador aprovado com sucesso"}


@router.put("/users/{user_id}/set-role")
async def set_user_role(
    user_id: str,
    role_data: UserRoleUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Alterar role de um utilizador"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    valid_roles = ["admin", "gestao", "parceiro", "motorista"]
    if role_data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Role inválido. Valores válidos: {valid_roles}")
    
    # First check if user exists
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Don't update if role is already the same
    if user.get("role") == role_data.role:
        return {"message": f"Role já é {role_data.role}"}
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": role_data.role}}
    )
    
    logger.info(f"Role changed for user {user_id} from {user.get('role')} to {role_data.role}")
    return {"message": f"Role alterado para {role_data.role}"}


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status_data: UserStatusUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Bloquear/desbloquear um utilizador
    
    Permissões:
    - Admin: pode bloquear qualquer utilizador
    - Gestor: pode bloquear parceiros e motoristas sob sua gestão
    - Parceiro: pode bloquear motoristas associados a si
    """
    # Buscar utilizador alvo
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    target_role = target_user.get("role", "")
    
    # Verificar permissões
    if current_user["role"] == UserRole.ADMIN:
        # Admin pode bloquear qualquer um
        pass
    elif current_user["role"] == UserRole.GESTAO:
        # Gestor pode bloquear parceiros e motoristas
        if target_role not in [UserRole.PARCEIRO, UserRole.MOTORISTA]:
            raise HTTPException(status_code=403, detail="Gestor só pode bloquear parceiros e motoristas")
    elif current_user["role"] == UserRole.PARCEIRO:
        # Parceiro pode bloquear apenas motoristas associados a si
        if target_role != UserRole.MOTORISTA:
            raise HTTPException(status_code=403, detail="Parceiro só pode bloquear motoristas")
        # Verificar se o motorista está associado ao parceiro
        motorista = await db.motoristas.find_one({
            "$or": [{"id": user_id}, {"email": target_user.get("email")}]
        })
        if motorista:
            parceiro_id = motorista.get("parceiro_id") or motorista.get("parceiro_atribuido")
            if parceiro_id != current_user["id"]:
                raise HTTPException(status_code=403, detail="Motorista não está associado a si")
        else:
            raise HTTPException(status_code=403, detail="Motorista não encontrado")
    else:
        raise HTTPException(status_code=403, detail="Não tem permissão para bloquear utilizadores")
    
    # Validate status
    if status_data.status not in ['active', 'blocked']:
        raise HTTPException(status_code=400, detail="Status inválido. Use 'active' ou 'blocked'")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": status_data.status}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Se for motorista, atualizar também na coleção motoristas
    if target_role == UserRole.MOTORISTA:
        await db.motoristas.update_one(
            {"$or": [{"id": user_id}, {"email": target_user.get("email")}]},
            {"$set": {"status": status_data.status, "ativo": status_data.status == "active"}}
        )
    
    status_str = "bloqueado" if status_data.status == 'blocked' else "ativado"
    logger.info(f"User {user_id} status changed to {status_data.status} by {current_user['id']} (role: {current_user['role']})")
    return {"message": f"Utilizador {status_str}"}


class PlanoAssignment(BaseModel):
    plano_id: str


@router.put("/users/{user_id}/plano")
async def assign_plano_to_user(
    user_id: str,
    plano_data: PlanoAssignment,
    current_user: Dict = Depends(get_current_user)
):
    """Atribuir plano a um utilizador (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin pode atribuir planos")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Verificar se o plano existe
    plano = await db.planos_sistema.find_one({"id": plano_data.plano_id, "ativo": True})
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado ou inativo")
    
    update_data = {
        "plano_id": plano_data.plano_id,
        "plano_nome": plano.get("nome")
    }
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    # Se for motorista, atualizar também na coleção motoristas
    if user.get("role") == "motorista":
        await db.motoristas.update_one(
            {"$or": [{"id": user_id}, {"email": user.get("email")}]},
            {"$set": update_data}
        )
    # Se for parceiro, atualizar também na coleção parceiros
    elif user.get("role") == "parceiro":
        await db.parceiros.update_one(
            {"$or": [{"id": user_id}, {"email": user.get("email")}]},
            {"$set": update_data}
        )
    
    logger.info(f"Plano {plano.get('nome')} atribuído ao utilizador {user_id} por {current_user['id']}")
    return {"message": f"Plano {plano.get('nome')} atribuído com sucesso"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar um utilizador"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    # Delete related data based on role
    if user.get("role") == "motorista":
        await db.motoristas.delete_one({"$or": [{"id": user_id}, {"email": user.get("email")}]})
    elif user.get("role") == "parceiro":
        await db.parceiros.delete_one({"$or": [{"id": user_id}, {"email": user.get("email")}]})
    
    logger.info(f"User {user_id} deleted by {current_user['id']}")
    return {"message": "Utilizador eliminado"}


@router.post("/users/sync-motoristas")
async def sync_motoristas_collection(
    current_user: Dict = Depends(get_current_user)
):
    """Sincronizar motoristas (aprovados E pendentes) que não existem na collection motoristas.
    
    Este endpoint cria documentos na collection motoristas para todos os utilizadores
    com role='motorista' que ainda não têm documento na collection motoristas.
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    import uuid as uuid_module
    
    # Buscar TODOS os utilizadores motoristas (aprovados E pendentes)
    motorista_users = await db.users.find({
        "role": "motorista"
    }, {"_id": 0}).to_list(length=None)
    
    synced = 0
    already_exists = 0
    errors = []
    
    for user in motorista_users:
        user_id = user.get("id")
        email = user.get("email")
        
        # Verificar se já existe na collection motoristas
        existing = await db.motoristas.find_one({
            "$or": [{"id": user_id}, {"email": email}]
        })
        
        if existing:
            already_exists += 1
            continue
        
        try:
            is_approved = user.get("approved", False)
            
            # Criar documento na collection motoristas
            motorista_doc = {
                "id": user_id,
                "email": email,
                "name": user.get("name"),
                "nome": user.get("name"),
                "phone": user.get("phone"),
                "telefone": user.get("phone"),
                "approved": is_approved,
                "approved_by": user.get("approved_by") if is_approved else None,
                "approved_at": user.get("approved_at") if is_approved else None,
                "ativo": is_approved,  # Só ativo se aprovado
                "status_motorista": "ativo" if is_approved else "pendente",
                "created_at": user.get("created_at") or datetime.now(timezone.utc).isoformat(),
                "id_cartao_frota_combustivel": f"FROTA-{str(uuid_module.uuid4())[:8].upper()}",
                "parceiro_id": user.get("associated_partner_id"),
                "parceiro_atribuido": user.get("associated_partner_id"),
                "documents": {
                    "license_photo": None,
                    "cv_file": None,
                    "profile_photo": None,
                    "documento_identificacao": None,
                    "licenca_tvde": None,
                    "registo_criminal": None,
                    "contrato": None,
                    "additional_docs": []
                }
            }
            
            await db.motoristas.insert_one(motorista_doc)
            synced += 1
            logger.info(f"Synced motorista: {user.get('name')} ({email}) - Approved: {is_approved}")
            
        except Exception as e:
            errors.append(f"{email}: {str(e)}")
            logger.error(f"Error syncing motorista {email}: {e}")
    
    return {
        "message": "Sincronização concluída",
        "total_motoristas_users": len(motorista_users),
        "synced": synced,
        "already_exists": already_exists,
        "errors": errors
    }


@router.get("/motoristas-pendentes-sync")
async def get_motoristas_pendentes_sync(
    current_user: Dict = Depends(get_current_user)
):
    """Obter lista de motoristas aprovados que não existem na collection motoristas."""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    # Buscar todos os utilizadores motoristas aprovados
    motorista_users = await db.users.find({
        "role": "motorista",
        "approved": True
    }, {"_id": 0}).to_list(length=None)
    
    pendentes = []
    
    for user in motorista_users:
        user_id = user.get("id")
        email = user.get("email")
        
        # Verificar se já existe na collection motoristas
        existing = await db.motoristas.find_one({
            "$or": [{"id": user_id}, {"email": email}]
        })
        
        if not existing:
            pendentes.append({
                "id": user_id,
                "name": user.get("name"),
                "email": email,
                "created_at": user.get("created_at")
            })
    
    return {
        "total_pendentes": len(pendentes),
        "motoristas": pendentes
    }


@router.put("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    password_data: PasswordReset,
    current_user: Dict = Depends(get_current_user)
):
    """Reset password de um utilizador"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password deve ter pelo menos 6 caracteres")
    
    hashed_password = get_password_hash(password_data.new_password)
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password": hashed_password}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    logger.info(f"Password reset for user {user_id} by {current_user['id']}")
    return {"message": "Password alterada com sucesso"}


class ValidateDocumentRequest(BaseModel):
    campo: str
    validado: bool


@router.put("/users/{user_id}/validate-document")
async def validate_user_document(
    user_id: str,
    request: ValidateDocumentRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Validar ou invalidar documento de um utilizador"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    campo = request.campo
    validado = request.validado
    
    # Atualizar em motoristas
    motorista_update = await db.motoristas.update_one(
        {"id": user_id},
        {"$set": {f"documentos_validados.{campo}": validado}}
    )
    
    # Atualizar em parceiros
    parceiro_update = await db.parceiros.update_one(
        {"id": user_id},
        {"$set": {f"documentos_validados.{campo}": validado}}
    )
    
    # Atualizar em users
    user_update = await db.users.update_one(
        {"id": user_id},
        {"$set": {f"documentos_validados.{campo}": validado}}
    )
    
    # Atualizar documento específico na collection documentos
    doc_update = await db.documentos.update_one(
        {"id": campo},
        {"$set": {"validado": validado, "validado_por": current_user["id"], "validado_em": datetime.now(timezone.utc).isoformat()}}
    )
    
    total_updates = motorista_update.modified_count + parceiro_update.modified_count + user_update.modified_count + doc_update.modified_count
    
    if total_updates == 0:
        logger.warning(f"No documents updated for user {user_id}, campo {campo}")
    
    logger.info(f"Document {campo} {'validated' if validado else 'invalidated'} for user {user_id} by {current_user['id']}")
    
    return {"message": "Documento atualizado com sucesso", "validado": validado}


@router.put("/users/{user_id}/revoke")
async def revoke_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Revogar utilizador - desativar completamente o acesso"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Set status to revoked and approved to False
    result = await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "status": "revoked",
                "approved": False,
                "revoked_by": current_user["id"],
                "revoked_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Also update in related collections
    if user.get("role") == "motorista":
        await db.motoristas.update_one(
            {"$or": [{"id": user_id}, {"email": user.get("email")}]},
            {"$set": {"status": "revoked", "ativo": False}}
        )
    elif user.get("role") == "parceiro":
        await db.parceiros.update_one(
            {"$or": [{"id": user_id}, {"email": user.get("email")}]},
            {"$set": {"status": "revoked", "ativo": False}}
        )
    
    logger.info(f"User {user_id} revoked by {current_user['id']}")
    return {"message": "Utilizador revogado com sucesso"}



class AcessoUpdate(BaseModel):
    acesso_gratis: bool = False
    acesso_gratis_inicio: Optional[str] = None
    acesso_gratis_fim: Optional[str] = None
    modulos_ativos: List[str] = []


@router.put("/users/{user_id}/acesso")
async def update_user_acesso(
    user_id: str,
    acesso_data: AcessoUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar acesso de um utilizador - período grátis e módulos"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Preparar dados de atualização
    update_data = {
        "acesso_gratis": acesso_data.acesso_gratis,
        "acesso_gratis_inicio": acesso_data.acesso_gratis_inicio,
        "acesso_gratis_fim": acesso_data.acesso_gratis_fim,
        "modulos_manuais": acesso_data.modulos_ativos,
        "acesso_atualizado_por": current_user["id"],
        "acesso_atualizado_em": datetime.now(timezone.utc).isoformat()
    }
    
    # Atualizar na coleção users
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    # Se for parceiro, atualizar também na coleção parceiros
    if user.get("role") == "parceiro":
        await db.parceiros.update_one(
            {"$or": [{"id": user_id}, {"email": user.get("email")}]},
            {"$set": update_data}
        )
    
    logger.info(f"Acesso updated for user {user_id} by {current_user['id']}: gratis={acesso_data.acesso_gratis}, modulos={acesso_data.modulos_ativos}")
    
    return {
        "message": "Acesso atualizado com sucesso",
        "acesso_gratis": acesso_data.acesso_gratis,
        "modulos_ativos": acesso_data.modulos_ativos
    }


