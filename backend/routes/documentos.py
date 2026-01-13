"""Document validation and management routes"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Dict, Optional
from datetime import datetime, timezone
import uuid
import logging
import os

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads/documentos"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/documentos/pendentes")
async def get_documentos_pendentes(current_user: Dict = Depends(get_current_user)):
    """Listar todos os utilizadores não aprovados (com ou sem documentos pendentes) (Admin/Gestao/Parceiro)"""
    user_role = current_user["role"]
    allowed_roles = [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # Filtro base
        base_query = {"approved": False}
        
        # Se for parceiro, só mostra motoristas do próprio parceiro
        if user_role in [UserRole.PARCEIRO, "parceiro"]:
            base_query["$or"] = [
                {"parceiro_id": current_user["id"]},
                {"parceiro_associado": current_user["id"]},
                {"parceiro_atribuido": current_user["id"]}
            ]
        
        # Buscar todos os utilizadores não aprovados
        users_nao_aprovados = await db.users.find(
            base_query,
            {"_id": 0, "password": 0}
        ).to_list(length=None)
        
        users_pendentes = {}
        
        # Adicionar utilizadores não aprovados
        for user in users_nao_aprovados:
            user_id = user["id"]
            
            # Se for parceiro, buscar dados adicionais
            parceiro_data = None
            if user.get("role") == "parceiro":
                parceiro_data = await db.parceiros.find_one(
                    {"email": user.get("email")},
                    {"_id": 0}
                )
            
            # Se for motorista, buscar dados adicionais
            motorista_data = None
            if user.get("role") == "motorista":
                motorista_data = await db.motoristas.find_one(
                    {"email": user.get("email")},
                    {"_id": 0}
                )
            
            # Buscar documentos deste utilizador
            documentos = await db.documentos_validacao.find(
                {"user_id": user_id},
                {"_id": 0}
            ).to_list(length=None)
            
            users_pendentes[user_id] = {
                "user": user,
                "parceiro_data": parceiro_data,
                "motorista_data": motorista_data,
                "documentos": documentos
            }
        
        # Adicionar também utilizadores com documentos pendentes (mesmo que approved=true)
        documentos_pendentes = await db.documentos_validacao.find(
            {"status": "pendente"},
            {"_id": 0}
        ).to_list(length=None)
        
        for doc in documentos_pendentes:
            user_id = doc["user_id"]
            if user_id not in users_pendentes:
                # Buscar informações do utilizador
                user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
                if user:
                    # Se for parceiro, buscar dados adicionais
                    parceiro_data = None
                    if user.get("role") == "parceiro":
                        parceiro_data = await db.parceiros.find_one(
                            {"email": user.get("email")},
                            {"_id": 0}
                        )
                    
                    # Se for motorista, buscar dados adicionais
                    motorista_data = None
                    if user.get("role") == "motorista":
                        motorista_data = await db.motoristas.find_one(
                            {"email": user.get("email")},
                            {"_id": 0}
                        )
                    
                    # Buscar todos os documentos
                    documentos = await db.documentos_validacao.find(
                        {"user_id": user_id},
                        {"_id": 0}
                    ).to_list(length=None)
                    
                    users_pendentes[user_id] = {
                        "user": user,
                        "parceiro_data": parceiro_data,
                        "motorista_data": motorista_data,
                        "documentos": documentos
                    }
        
        return list(users_pendentes.values())
        
    except Exception as e:
        logger.error(f"Erro ao listar documentos pendentes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documentos/user/{user_id}")
async def get_documentos_user(user_id: str, current_user: Dict = Depends(get_current_user)):
    """Listar documentos de um utilizador específico"""
    # Admin pode ver todos, utilizador só pode ver os próprios
    if current_user["role"] != UserRole.ADMIN and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    try:
        documentos = await db.documentos_validacao.find(
            {"user_id": user_id},
            {"_id": 0}
        ).to_list(length=None)
        
        return documentos
        
    except Exception as e:
        logger.error(f"Erro ao listar documentos do utilizador: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/documentos/{documento_id}/aprovar")
async def aprovar_documento(
    documento_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Aprovar um documento pendente (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    try:
        resultado = await db.documentos_validacao.update_one(
            {"id": documento_id},
            {
                "$set": {
                    "status": "aprovado",
                    "aprovado_por": current_user["id"],
                    "aprovado_em": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if resultado.modified_count == 0:
            raise HTTPException(status_code=404, detail="Documento não encontrado")
        
        return {"message": "Documento aprovado com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao aprovar documento: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/documentos/{documento_id}/rejeitar")
async def rejeitar_documento(
    documento_id: str,
    motivo: str = "",
    current_user: Dict = Depends(get_current_user)
):
    """Rejeitar um documento pendente (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    try:
        resultado = await db.documentos_validacao.update_one(
            {"id": documento_id},
            {
                "$set": {
                    "status": "rejeitado",
                    "rejeitado_por": current_user["id"],
                    "rejeitado_em": datetime.now(timezone.utc).isoformat(),
                    "motivo_rejeicao": motivo
                }
            }
        )
        
        if resultado.modified_count == 0:
            raise HTTPException(status_code=404, detail="Documento não encontrado")
        
        return {"message": "Documento rejeitado"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao rejeitar documento: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/documentos/user/{user_id}/aprovar-todos")
async def aprovar_todos_documentos_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Aprovar todos os documentos de um utilizador e o próprio utilizador (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    try:
        # Aprovar todos os documentos
        await db.documentos_validacao.update_many(
            {"user_id": user_id, "status": "pendente"},
            {
                "$set": {
                    "status": "aprovado",
                    "aprovado_por": current_user["id"],
                    "aprovado_em": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Aprovar o utilizador
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "approved": True,
                    "approved_by": current_user["id"],
                    "approved_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {"message": "Utilizador e todos os documentos aprovados com sucesso"}
        
    except Exception as e:
        logger.error(f"Erro ao aprovar utilizador e documentos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/complete-details")
async def get_user_complete_details(user_id: str, current_user: Dict = Depends(get_current_user)):
    """Obter TODOS os dados de um utilizador (user + parceiro/motorista + documentos)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    try:
        # Buscar utilizador
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=404, detail="Utilizador não encontrado")
        
        result = {"user": user}
        
        # Buscar dados de parceiro se aplicável
        if user.get("role") == "parceiro":
            parceiro = await db.parceiros.find_one(
                {"$or": [{"id": user_id}, {"email": user.get("email")}]},
                {"_id": 0}
            )
            result["parceiro_data"] = parceiro
        
        # Buscar dados de motorista se aplicável
        if user.get("role") == "motorista":
            motorista = await db.motoristas.find_one(
                {"$or": [{"id": user_id}, {"email": user.get("email")}]},
                {"_id": 0}
            )
            result["motorista_data"] = motorista
        
        # Buscar documentos
        documentos = await db.documentos_validacao.find(
            {"user_id": user_id},
            {"_id": 0}
        ).to_list(length=None)
        result["documentos"] = documentos
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter detalhes do utilizador: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents/send-email")
async def send_document_email(current_user: Dict = Depends(get_current_user)):
    """Placeholder for sending documents via email"""
    return {"message": "Email sending not yet implemented"}


@router.post("/documents/send-whatsapp")
async def send_document_whatsapp(current_user: Dict = Depends(get_current_user)):
    """Placeholder for sending documents via WhatsApp"""
    return {"message": "WhatsApp sending not yet implemented"}
