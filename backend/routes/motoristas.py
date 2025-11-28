"""Motoristas routes"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List, Dict, Optional
from datetime import datetime, timezone
from pathlib import Path
import uuid
import logging
import mimetypes

from models.motorista import Motorista, MotoristaCreate
from models.user import UserRole
from utils.auth import hash_password, get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)

# Upload directories
ROOT_DIR = Path(__file__).parent.parent
UPLOAD_DIR = ROOT_DIR / "uploads"
MOTORISTAS_UPLOAD_DIR = UPLOAD_DIR / "motoristas"
MOTORISTAS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/motoristas/register", response_model=Motorista)
async def register_motorista(motorista_data: MotoristaCreate):
    """Register a new motorista"""
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
    # Generate automatic ID for fleet card
    motorista_dict["id_cartao_frota_combustivel"] = f"FROTA-{str(uuid.uuid4())[:8].upper()}"
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


@router.get("/motoristas", response_model=List[Motorista])
async def get_motoristas(current_user: Dict = Depends(get_current_user)):
    """Get all motoristas (filtered by role)"""
    query = {}
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_atribuido"] = current_user["id"]
    elif current_user["role"] == UserRole.OPERACIONAL:
        query["parceiro_atribuido"] = current_user["id"]
    
    motoristas = await db.motoristas.find(query, {"_id": 0}).to_list(length=None)
    
    for m in motoristas:
        if isinstance(m.get("created_at"), str):
            m["created_at"] = datetime.fromisoformat(m["created_at"])
    
    return [Motorista(**m) for m in motoristas]


@router.get("/motoristas/{motorista_id}")
async def get_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get motorista by ID"""
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] == UserRole.MOTORISTA:
        if motorista["id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    if isinstance(motorista.get("created_at"), str):
        motorista["created_at"] = datetime.fromisoformat(motorista["created_at"])
    
    return Motorista(**motorista)


@router.put("/motoristas/{motorista_id}/approve")
async def approve_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Approve motorista account"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    await db.motoristas.update_one({"id": motorista_id}, {"$set": {"approved": True}})
    await db.users.update_one({"id": motorista_id}, {"$set": {"approved": True}})
    
    return {"message": "Motorista approved successfully"}


@router.put("/motoristas/{motorista_id}")
async def update_motorista(
    motorista_id: str,
    update_data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Update motorista information"""
    motorista = await db.motoristas.find_one({"id": motorista_id})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Check permissions
    if current_user["role"] == UserRole.MOTORISTA:
        if motorista["id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        # Motorista can only update certain fields
        allowed_fields = ["phone", "morada", "documents", "dados_bancarios"]
        update_data = {k: v for k, v in update_data.items() if k in allowed_fields}
    elif current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.motoristas.update_one({"id": motorista_id}, {"$set": update_data})
    
    # Update user table if name or email changed
    user_update = {}
    if "name" in update_data:
        user_update["name"] = update_data["name"]
    if "email" in update_data:
        user_update["email"] = update_data["email"]
    if "phone" in update_data:
        user_update["phone"] = update_data["phone"]
    
    if user_update:
        await db.users.update_one({"id": motorista_id}, {"$set": user_update})
    
    return {"message": "Motorista updated successfully"}


@router.delete("/motoristas/{motorista_id}")
async def delete_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Soft delete
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.users.update_one(
        {"id": motorista_id},
        {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Motorista deleted successfully"}


@router.put("/motoristas/{motorista_id}/aprovar-todos-documentos")
async def aprovar_todos_documentos(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Approve all motorista documents"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Update all document statuses
    update_docs = {}
    for doc_key in ["documento_identificacao_status", "licenca_tvde_status", "registo_criminal_status"]:
        update_docs[doc_key] = "aprovado"
    
    await db.motoristas.update_one({"id": motorista_id}, {"$set": update_docs})
    
    return {"message": "All documents approved successfully"}


@router.get("/motoristas/{motorista_id}/documento/{doc_type}/download")
async def download_motorista_document(
    motorista_id: str,
    doc_type: str,
    current_user: Dict = Depends(get_current_user)
):
    """Download motorista document"""
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Check permissions
    if current_user["role"] == UserRole.MOTORISTA:
        if motorista["id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get document path
    doc_path_key = f"{doc_type}"
    doc_url = motorista.get("documents", {}).get(doc_path_key) or motorista.get(doc_path_key)
    
    if not doc_url:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Convert URL to file path
    if doc_url.startswith("/uploads/"):
        file_path = ROOT_DIR / doc_url.lstrip("/")
    else:
        file_path = ROOT_DIR / "uploads" / doc_url
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found")
    
    media_type, _ = mimetypes.guess_type(str(file_path))
    
    return FileResponse(
        path=file_path,
        media_type=media_type or "application/octet-stream",
        filename=file_path.name
    )


@router.get("/motoristas/{motorista_id}/contrato/download")
async def download_motorista_contrato(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Download motorista contract"""
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Check permissions
    if current_user["role"] == UserRole.MOTORISTA:
        if motorista["id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    contrato_url = motorista.get("documents", {}).get("contrato")
    if not contrato_url:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Convert URL to file path
    if contrato_url.startswith("/uploads/"):
        file_path = ROOT_DIR / contrato_url.lstrip("/")
    else:
        file_path = ROOT_DIR / "uploads" / contrato_url
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Contract file not found")
    
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=f"contrato_{motorista['name']}.pdf"
    )
