"""Messages and conversations routes"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Optional
from datetime import datetime, timezone

from models.mensagem import Mensagem, MensagemCreate, Conversa, ConversaCreate, ConversaStats
from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()


@router.get("/conversas", response_model=List[Conversa])
async def get_conversas(current_user: Dict = Depends(get_current_user)):
    """Get all conversations for current user"""
    conversas = await db.conversas.find(
        {"participantes": current_user["id"]},
        {"_id": 0}
    ).sort("ultima_mensagem_em", -1).to_list(length=None)
    
    # Get participant info and count unread messages
    for conversa in conversas:
        # Get other participants info
        participantes_info = []
        for participante_id in conversa["participantes"]:
            if participante_id != current_user["id"]:
                user = await db.users.find_one(
                    {"id": participante_id}, 
                    {"_id": 0, "id": 1, "name": 1, "role": 1, "email": 1, "phone": 1}
                )
                if user:
                    participantes_info.append(user)
        
        conversa["participantes_info"] = participantes_info
        
        # Count unread messages
        unread_count = await db.mensagens.count_documents({
            "conversa_id": conversa["id"],
            "remetente_id": {"$ne": current_user["id"]},
            "lida": False
        })
        conversa["mensagens_nao_lidas"] = unread_count
        
        # Convert datetime strings
        if isinstance(conversa.get("criada_em"), str):
            conversa["criada_em"] = datetime.fromisoformat(conversa["criada_em"])
        if conversa.get("ultima_mensagem_em") and isinstance(conversa["ultima_mensagem_em"], str):
            conversa["ultima_mensagem_em"] = datetime.fromisoformat(conversa["ultima_mensagem_em"])
    
    return [Conversa(**c) for c in conversas]


@router.get("/conversas/stats", response_model=ConversaStats)
async def get_conversas_stats(current_user: Dict = Depends(get_current_user)):
    """Get conversation statistics"""
    query = {"participantes": current_user["id"]}
    
    total = await db.conversas.count_documents(query)
    
    # Count conversations with unread messages
    conversas = await db.conversas.find(query, {"_id": 0, "id": 1}).to_list(None)
    com_nao_lidas = 0
    total_nao_lidas = 0
    
    for conversa in conversas:
        unread_count = await db.mensagens.count_documents({
            "conversa_id": conversa["id"],
            "remetente_id": {"$ne": current_user["id"]},
            "lida": False
        })
        if unread_count > 0:
            com_nao_lidas += 1
            total_nao_lidas += unread_count
    
    return ConversaStats(
        total=total,
        com_nao_lidas=com_nao_lidas,
        total_nao_lidas=total_nao_lidas
    )


@router.post("/conversas", response_model=Conversa)
async def create_conversa(
    conversa_data: ConversaCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new conversation"""
    # Check if conversation already exists between these participants
    existing = await db.conversas.find_one({
        "participantes": {"$all": [current_user["id"], conversa_data.participante_id]}
    })
    
    if existing:
        # Return existing conversation
        if isinstance(existing.get("criada_em"), str):
            existing["criada_em"] = datetime.fromisoformat(existing["criada_em"])
        if existing.get("ultima_mensagem_em") and isinstance(existing["ultima_mensagem_em"], str):
            existing["ultima_mensagem_em"] = datetime.fromisoformat(existing["ultima_mensagem_em"])
        
        # Get participant info
        participantes_info = []
        for participante_id in existing["participantes"]:
            if participante_id != current_user["id"]:
                user = await db.users.find_one({"id": participante_id}, {"_id": 0, "id": 1, "name": 1, "role": 1})
                if user:
                    participantes_info.append(user)
        existing["participantes_info"] = participantes_info
        existing["mensagens_nao_lidas"] = 0
        
        return Conversa(**existing)
    
    # Get participant info
    participante = await db.users.find_one({"id": conversa_data.participante_id}, {"_id": 0})
    if not participante:
        raise HTTPException(status_code=404, detail="Participant not found")
    
    # Create new conversation
    conversa = Conversa(
        participantes=[current_user["id"], conversa_data.participante_id],
        participantes_info=[{"id": participante["id"], "name": participante["name"], "role": participante["role"]}],
        assunto=conversa_data.assunto,
        criada_por=current_user["id"],
        mensagens_nao_lidas=0
    )
    
    conversa_dict = conversa.model_dump()
    conversa_dict["criada_em"] = conversa_dict["criada_em"].isoformat()
    if conversa_dict.get("ultima_mensagem_em"):
        conversa_dict["ultima_mensagem_em"] = conversa_dict["ultima_mensagem_em"].isoformat()
    
    await db.conversas.insert_one(conversa_dict)
    
    return conversa


@router.get("/conversas/{conversa_id}/mensagens", response_model=List[Mensagem])
async def get_mensagens(
    conversa_id: str,
    limit: int = 100,
    current_user: Dict = Depends(get_current_user)
):
    """Get messages from a conversation"""
    # Check if user is participant
    conversa = await db.conversas.find_one({"id": conversa_id})
    if not conversa:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if current_user["id"] not in conversa["participantes"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get messages
    mensagens = await db.mensagens.find(
        {"conversa_id": conversa_id},
        {"_id": 0}
    ).sort("criada_em", 1).limit(limit).to_list(limit)
    
    # Convert datetime strings
    for msg in mensagens:
        if isinstance(msg.get("criada_em"), str):
            msg["criada_em"] = datetime.fromisoformat(msg["criada_em"])
        if msg.get("lida_em") and isinstance(msg["lida_em"], str):
            msg["lida_em"] = datetime.fromisoformat(msg["lida_em"])
    
    # Mark messages as read
    await db.mensagens.update_many(
        {
            "conversa_id": conversa_id,
            "remetente_id": {"$ne": current_user["id"]},
            "lida": False
        },
        {"$set": {"lida": True, "lida_em": datetime.now(timezone.utc).isoformat()}}
    )
    
    return [Mensagem(**m) for m in mensagens]


@router.post("/mensagens", response_model=Mensagem)
async def send_mensagem(
    mensagem_data: MensagemCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Send a message"""
    # Check if user is participant
    conversa = await db.conversas.find_one({"id": mensagem_data.conversa_id})
    if not conversa:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if current_user["id"] not in conversa["participantes"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create message
    mensagem = Mensagem(
        conversa_id=mensagem_data.conversa_id,
        remetente_id=current_user["id"],
        remetente_nome=current_user["name"],
        conteudo=mensagem_data.conteudo,
        anexo_url=mensagem_data.anexo_url
    )
    
    mensagem_dict = mensagem.model_dump()
    mensagem_dict["criada_em"] = mensagem_dict["criada_em"].isoformat()
    
    await db.mensagens.insert_one(mensagem_dict)
    
    # Update conversation
    await db.conversas.update_one(
        {"id": mensagem_data.conversa_id},
        {
            "$set": {
                "ultima_mensagem": mensagem_data.conteudo[:100],
                "ultima_mensagem_em": mensagem_dict["criada_em"]
            }
        }
    )
    
    # Create notification for other participants
    from utils.notificacoes import criar_notificacao
    
    for participante_id in conversa["participantes"]:
        if participante_id != current_user["id"]:
            await criar_notificacao(
                db,
                user_id=participante_id,
                tipo="nova_mensagem",
                titulo=f"💬 Nova mensagem de {current_user['name']}",
                mensagem=mensagem_data.conteudo[:100],
                prioridade="normal",
                link=f"/mensagens?conversa={mensagem_data.conversa_id}",
                metadata={"conversa_id": mensagem_data.conversa_id, "remetente_id": current_user["id"]},
                enviar_email=False
            )
    
    return mensagem


@router.delete("/conversas/{conversa_id}")
async def delete_conversa(
    conversa_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete conversation (soft delete - just remove user from participants)"""
    conversa = await db.conversas.find_one({"id": conversa_id})
    if not conversa:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if current_user["id"] not in conversa["participantes"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # If only 2 participants, delete conversation and messages
    if len(conversa["participantes"]) == 2:
        await db.conversas.delete_one({"id": conversa_id})
        await db.mensagens.delete_many({"conversa_id": conversa_id})
    else:
        # Remove user from participants
        await db.conversas.update_one(
            {"id": conversa_id},
            {"$pull": {"participantes": current_user["id"]}}
        )
    
    return {"message": "Conversation deleted successfully"}


@router.get("/mensagens/destinatarios")
async def get_destinatarios_disponiveis(current_user: Dict = Depends(get_current_user)):
    """
    Get available recipients for messaging based on user role hierarchy:
    - Admin: all users
    - Parceiro: drivers in their fleet + managers + admin
    - Gestor: partners assigned to them + admin + drivers from their fleets
    - Motorista: partner of their fleet + manager of their fleet + admin (support)
    """
    user_role = current_user["role"]
    user_id = current_user["id"]
    destinatarios = []
    
    # Base projection for users
    projection = {"_id": 0, "id": 1, "name": 1, "role": 1, "email": 1, "phone": 1}
    
    if user_role == UserRole.ADMIN or user_role == "admin":
        # Admin can message anyone
        users = await db.users.find(
            {"id": {"$ne": user_id}, "approved": True},
            projection
        ).to_list(length=None)
        destinatarios = users
        
    elif user_role == UserRole.PARCEIRO or user_role == "parceiro":
        # Parceiro can message:
        # 1. Motoristas da sua frota
        # 2. Gestores atribuídos a este parceiro
        # 3. Admin (suporte)
        
        # Get motoristas from their fleet
        motoristas = await db.motoristas.find(
            {"parceiro_id": user_id},
            {"_id": 0, "id": 1}
        ).to_list(length=None)
        motorista_ids = [m["id"] for m in motoristas]
        
        # Get gestor info for this parceiro
        parceiro = await db.parceiros.find_one(
            {"id": user_id},
            {"_id": 0, "gestores_ids": 1}
        )
        gestor_ids = parceiro.get("gestores_ids", []) if parceiro else []
        
        # Get all relevant users
        all_ids = motorista_ids + gestor_ids
        
        # Get users with motorista, gestor or admin role
        query = {
            "id": {"$ne": user_id},
            "approved": True,
            "$or": [
                {"id": {"$in": all_ids}},
                {"role": {"$in": [UserRole.ADMIN, "admin", UserRole.GESTAO, "gestao"]}}
            ]
        }
        users = await db.users.find(query, projection).to_list(length=None)
        
        # Filter to only include:
        # - Motoristas from their fleet
        # - Gestores from gestores_ids
        # - Admin
        for user in users:
            if user["role"] in [UserRole.ADMIN, "admin"]:
                destinatarios.append(user)
            elif user["role"] in [UserRole.GESTAO, "gestao"] and user["id"] in gestor_ids:
                destinatarios.append(user)
            elif user["id"] in motorista_ids:
                destinatarios.append(user)
                
    elif user_role == UserRole.GESTAO or user_role == "gestao":
        # Gestor can message:
        # 1. Parceiros associados a sua conta
        # 2. Admin
        # 3. Motoristas das frotas dos parceiros atribuídos
        
        # Get parceiros atribuídos to this gestor
        parceiros_atribuidos = current_user.get("parceiros_atribuidos", [])
        
        # Get all motoristas from the assigned parceiros
        motoristas = await db.motoristas.find(
            {"parceiro_id": {"$in": parceiros_atribuidos}},
            {"_id": 0, "id": 1}
        ).to_list(length=None)
        motorista_ids = [m["id"] for m in motoristas]
        
        all_ids = parceiros_atribuidos + motorista_ids
        
        # Get all relevant users
        query = {
            "id": {"$ne": user_id},
            "approved": True,
            "$or": [
                {"id": {"$in": all_ids}},
                {"role": {"$in": [UserRole.ADMIN, "admin"]}}
            ]
        }
        users = await db.users.find(query, projection).to_list(length=None)
        
        # Filter appropriately
        for user in users:
            if user["role"] in [UserRole.ADMIN, "admin"]:
                destinatarios.append(user)
            elif user["id"] in parceiros_atribuidos or user["id"] in motorista_ids:
                destinatarios.append(user)
                
    elif user_role == UserRole.MOTORISTA or user_role == "motorista":
        # Motorista can message:
        # 1. Parceiro da sua frota
        # 2. Gestor da sua frota
        # 3. Admin (suporte)
        
        # Get motorista info to find parceiro_id
        motorista = await db.motoristas.find_one(
            {"id": user_id},
            {"_id": 0, "parceiro_id": 1}
        )
        parceiro_id = motorista.get("parceiro_id") if motorista else None
        
        gestor_ids = []
        if parceiro_id:
            # Get gestor for this parceiro
            parceiro = await db.parceiros.find_one(
                {"id": parceiro_id},
                {"_id": 0, "gestores_ids": 1}
            )
            gestor_ids = parceiro.get("gestores_ids", []) if parceiro else []
        
        # Build list of allowed IDs
        allowed_ids = []
        if parceiro_id:
            allowed_ids.append(parceiro_id)
        allowed_ids.extend(gestor_ids)
        
        # Get all relevant users
        query = {
            "id": {"$ne": user_id},
            "approved": True,
            "$or": [
                {"id": {"$in": allowed_ids}},
                {"role": {"$in": [UserRole.ADMIN, "admin"]}}
            ]
        }
        users = await db.users.find(query, projection).to_list(length=None)
        
        for user in users:
            if user["role"] in [UserRole.ADMIN, "admin"]:
                destinatarios.append(user)
            elif user["id"] in allowed_ids:
                destinatarios.append(user)
    else:
        # Other roles (operacional, inspetor, contabilista) - only admin
        users = await db.users.find(
            {"role": {"$in": [UserRole.ADMIN, "admin"]}, "id": {"$ne": user_id}, "approved": True},
            projection
        ).to_list(length=None)
        destinatarios = users
    
    return destinatarios
