"""Receipts management routes"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging
import os

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads/recibos"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ReciboCreate(BaseModel):
    """Model for creating receipt"""
    motorista_id: str
    tipo: str  # pagamento_motorista, recibo_verde, etc
    valor: float
    descricao: Optional[str] = None
    periodo: Optional[str] = None


class ReciboVerificar(BaseModel):
    """Model for verifying receipt"""
    verificado: bool
    observacoes: Optional[str] = None


@router.post("/recibos/upload-ficheiro")
async def upload_ficheiro_recibo(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload a receipt file"""
    try:
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1]
        filename = f"recibo_{current_user['id']}_{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        # Save file
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        
        return {
            "success": True,
            "filename": filename,
            "filepath": filepath,
            "original_name": file.filename
        }
    
    except Exception as e:
        logger.error(f"Error uploading receipt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recibos")
async def criar_recibo(
    recibo: ReciboCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new receipt record"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    recibo_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    recibo_doc = {
        "id": recibo_id,
        "motorista_id": recibo.motorista_id,
        "tipo": recibo.tipo,
        "valor": recibo.valor,
        "descricao": recibo.descricao,
        "periodo": recibo.periodo,
        "verificado": False,
        "criado_por": current_user["id"],
        "criado_em": now
    }
    
    await db.recibos.insert_one(recibo_doc)
    
    return {"id": recibo_id, "message": "Recibo criado com sucesso"}


@router.get("/recibos/meus")
async def get_meus_recibos(current_user: Dict = Depends(get_current_user)):
    """Get receipts for current user (motorista)"""
    recibos = await db.recibos.find(
        {"motorista_id": current_user["id"]},
        {"_id": 0}
    ).sort("criado_em", -1).to_list(100)
    
    return recibos


@router.get("/recibos")
async def listar_recibos(
    motorista_id: Optional[str] = None,
    verificado: Optional[bool] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List all receipts (Admin/Gestao/Parceiro)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Build query
    query = {}
    
    if motorista_id:
        query["motorista_id"] = motorista_id
    
    if verificado is not None:
        query["verificado"] = verificado
    
    # Parceiros só veem recibos dos seus motoristas
    if current_user["role"] == UserRole.PARCEIRO:
        motoristas = await db.motoristas.find(
            {"parceiro_id": current_user["id"]},
            {"_id": 0, "id": 1}
        ).to_list(None)
        motorista_ids = [m["id"] for m in motoristas]
        query["motorista_id"] = {"$in": motorista_ids}
    
    recibos = await db.recibos.find(
        query,
        {"_id": 0}
    ).sort("criado_em", -1).to_list(500)
    
    return recibos


@router.put("/recibos/{recibo_id}/verificar")
async def verificar_recibo(
    recibo_id: str,
    data: ReciboVerificar,
    current_user: Dict = Depends(get_current_user)
):
    """Verify a receipt"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    result = await db.recibos.update_one(
        {"id": recibo_id},
        {
            "$set": {
                "verificado": data.verificado,
                "observacoes_verificacao": data.observacoes,
                "verificado_por": current_user["id"],
                "verificado_em": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    
    return {"message": "Recibo verificado com sucesso"}


@router.get("/recibos/{recibo_id}")
async def get_recibo(
    recibo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get a specific receipt"""
    recibo = await db.recibos.find_one({"id": recibo_id}, {"_id": 0})
    
    if not recibo:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    
    # Check permissions
    if current_user["role"] == UserRole.MOTORISTA:
        if recibo["motorista_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    elif current_user["role"] == UserRole.PARCEIRO:
        motorista = await db.motoristas.find_one({"id": recibo["motorista_id"]}, {"_id": 0})
        if motorista and motorista.get("parceiro_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    return recibo


@router.delete("/recibos/{recibo_id}")
async def delete_recibo(
    recibo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a receipt"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Apenas Admin/Gestão")
    
    result = await db.recibos.delete_one({"id": recibo_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    
    return {"message": "Recibo eliminado"}


# ==================== PAGAMENTOS E RECIBOS ====================

@router.get("/pagamentos-recibos")
async def get_pagamentos_recibos(
    motorista_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Get payment receipts"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {}
    
    if motorista_id:
        query["motorista_id"] = motorista_id
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    registros = await db.pagamentos_recibos.find(
        query,
        {"_id": 0}
    ).sort("data_criacao", -1).to_list(500)
    
    return registros


@router.get("/pagamentos-recibos/{registro_id}/recibo")
async def get_recibo_pagamento(
    registro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get receipt file for a payment"""
    registro = await db.pagamentos_recibos.find_one(
        {"id": registro_id},
        {"_id": 0}
    )
    
    if not registro:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    
    if not registro.get("recibo_path"):
        raise HTTPException(status_code=404, detail="Recibo não disponível")
    
    return {"recibo_path": registro["recibo_path"]}


@router.post("/pagamentos-recibos/{registro_id}/pagamento")
async def registar_pagamento(
    registro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Mark a payment as paid"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    result = await db.pagamentos_recibos.update_one(
        {"id": registro_id},
        {
            "$set": {
                "pago": True,
                "pago_por": current_user["id"],
                "pago_em": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    
    return {"message": "Pagamento registado"}


@router.patch("/pagamentos-recibos/{registro_id}/estado")
async def atualizar_estado_pagamento(
    registro_id: str,
    estado: str,
    current_user: Dict = Depends(get_current_user)
):
    """Update payment status"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    result = await db.pagamentos_recibos.update_one(
        {"id": registro_id},
        {
            "$set": {
                "estado": estado,
                "estado_updated_by": current_user["id"],
                "estado_updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    
    return {"message": f"Estado atualizado para {estado}"}
