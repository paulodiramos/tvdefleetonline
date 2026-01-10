"""Pagamentos routes for FleeTrack application - Refactored from server.py"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
from pydantic import BaseModel
import uuid
import logging
import shutil

from utils.database import get_database
from utils.auth import get_current_user

# Setup logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/pagamentos", tags=["pagamentos"])

# Get database
db = get_database()

# Upload directories
ROOT_DIR = Path(__file__).parent.parent
UPLOAD_DIR = ROOT_DIR / "uploads"
PAGAMENTOS_UPLOAD_DIR = UPLOAD_DIR / "pagamentos"
PAGAMENTOS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class UserRole:
    """User roles for authorization"""
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== PYDANTIC MODELS ====================

class Pagamento(BaseModel):
    id: str
    motorista_id: str
    motorista_nome: str
    parceiro_id: Optional[str] = None
    valor: float
    tipo: str  # aluguer, comissao, extras
    semana: int
    ano: int
    status: str = "pendente"  # pendente, pago, cancelado
    data_emissao: str
    data_pagamento: Optional[str] = None
    comprovativo_url: Optional[str] = None
    notas: Optional[str] = None


class PagamentoCreate(BaseModel):
    motorista_id: str
    valor: float
    tipo: str = "aluguer"
    semana: int
    ano: int
    notas: Optional[str] = None


# ==================== CRUD ROUTES ====================

@router.post("")
async def create_pagamento(
    pagamento_data: PagamentoCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new payment record"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": pagamento_data.motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    now = datetime.now(timezone.utc)
    
    pagamento = {
        "id": str(uuid.uuid4()),
        "motorista_id": pagamento_data.motorista_id,
        "motorista_nome": motorista.get("name"),
        "parceiro_id": current_user["id"] if current_user["role"] == UserRole.PARCEIRO else motorista.get("parceiro_atribuido"),
        "valor": pagamento_data.valor,
        "tipo": pagamento_data.tipo,
        "semana": pagamento_data.semana,
        "ano": pagamento_data.ano,
        "status": "pendente",
        "data_emissao": now.isoformat(),
        "notas": pagamento_data.notas,
        "created_at": now.isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.pagamentos.insert_one(pagamento)
    
    return Pagamento(**pagamento)


@router.get("/semana-atual")
async def get_pagamentos_semana_atual(current_user: Dict = Depends(get_current_user)):
    """Get payments for current week"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc)
    semana_atual = now.isocalendar()[1]
    ano_atual = now.year
    
    query = {
        "semana": semana_atual,
        "ano": ano_atual
    }
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    pagamentos = await db.pagamentos.find(query, {"_id": 0}).to_list(1000)
    
    # Calculate totals
    total_pendente = sum(p["valor"] for p in pagamentos if p["status"] == "pendente")
    total_pago = sum(p["valor"] for p in pagamentos if p["status"] == "pago")
    
    return {
        "semana": semana_atual,
        "ano": ano_atual,
        "pagamentos": pagamentos,
        "total_pendente": round(total_pendente, 2),
        "total_pago": round(total_pago, 2),
        "total_geral": round(total_pendente + total_pago, 2)
    }


@router.put("/{pagamento_id}/marcar-pago")
async def marcar_pagamento_pago(
    pagamento_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Mark payment as paid"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pagamento = await db.pagamentos.find_one({"id": pagamento_id}, {"_id": 0})
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento not found")
    
    # Check authorization for parceiro
    if current_user["role"] == UserRole.PARCEIRO and pagamento.get("parceiro_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "status": "pago",
        "data_pagamento": datetime.now(timezone.utc).isoformat(),
        "pago_por": current_user["id"],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if data.get("notas"):
        update_data["notas"] = data["notas"]
    
    await db.pagamentos.update_one(
        {"id": pagamento_id},
        {"$set": update_data}
    )
    
    return {"message": "Pagamento marcado como pago"}


@router.post("/{pagamento_id}/upload-documento")
async def upload_documento_pagamento(
    pagamento_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload payment document/receipt"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pagamento = await db.pagamentos.find_one({"id": pagamento_id}, {"_id": 0})
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento not found")
    
    # Check authorization for parceiro
    if current_user["role"] == UserRole.PARCEIRO and pagamento.get("parceiro_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save file
    file_extension = Path(file.filename).suffix.lower()
    filename = f"pagamento_{pagamento_id}_{uuid.uuid4()}{file_extension}"
    file_path = PAGAMENTOS_UPLOAD_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    relative_path = str(file_path.relative_to(ROOT_DIR))
    
    await db.pagamentos.update_one(
        {"id": pagamento_id},
        {"$set": {
            "documento_url": relative_path,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Documento uploaded", "url": relative_path}


@router.post("/{pagamento_id}/comprovativo")
async def upload_comprovativo_pagamento(
    pagamento_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload payment proof/comprovativo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pagamento = await db.pagamentos.find_one({"id": pagamento_id}, {"_id": 0})
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento not found")
    
    # Check authorization
    if current_user["role"] == UserRole.PARCEIRO and pagamento.get("parceiro_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save file
    comprovativos_dir = UPLOAD_DIR / "comprovativos_pagamento"
    comprovativos_dir.mkdir(exist_ok=True)
    
    file_extension = Path(file.filename).suffix.lower()
    filename = f"comprovativo_{pagamento_id}_{uuid.uuid4()}{file_extension}"
    file_path = comprovativos_dir / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    relative_path = str(file_path.relative_to(ROOT_DIR))
    
    await db.pagamentos.update_one(
        {"id": pagamento_id},
        {"$set": {
            "comprovativo_url": relative_path,
            "status": "pago",
            "data_pagamento": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Comprovativo uploaded", "url": relative_path}


@router.get("")
async def get_pagamentos(
    motorista_id: Optional[str] = None,
    semana: Optional[int] = None,
    ano: Optional[int] = None,
    status: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Get all payments with optional filters"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    if motorista_id:
        query["motorista_id"] = motorista_id
    if semana:
        query["semana"] = semana
    if ano:
        query["ano"] = ano
    if status:
        query["status"] = status
    
    pagamentos = await db.pagamentos.find(query, {"_id": 0}).sort("data_emissao", -1).to_list(1000)
    
    return pagamentos


@router.get("/{pagamento_id}")
async def get_pagamento(
    pagamento_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get specific payment by ID"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pagamento = await db.pagamentos.find_one({"id": pagamento_id}, {"_id": 0})
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento not found")
    
    # Check authorization
    if current_user["role"] == UserRole.PARCEIRO and pagamento.get("parceiro_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user["role"] == UserRole.MOTORISTA and pagamento.get("motorista_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return pagamento


@router.put("/{pagamento_id}")
async def update_pagamento(
    pagamento_id: str,
    updates: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update payment"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pagamento = await db.pagamentos.find_one({"id": pagamento_id}, {"_id": 0})
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento not found")
    
    # Don't allow updating certain fields
    updates.pop("id", None)
    updates.pop("created_at", None)
    updates.pop("_id", None)
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = current_user["id"]
    
    await db.pagamentos.update_one(
        {"id": pagamento_id},
        {"$set": updates}
    )
    
    return {"message": "Pagamento updated"}


@router.delete("/{pagamento_id}")
async def delete_pagamento(
    pagamento_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete payment"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pagamento = await db.pagamentos.find_one({"id": pagamento_id}, {"_id": 0})
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento not found")
    
    # Only allow deleting pending payments
    if pagamento.get("status") == "pago":
        raise HTTPException(status_code=400, detail="Cannot delete paid payments")
    
    await db.pagamentos.delete_one({"id": pagamento_id})
    
    return {"message": "Pagamento deleted"}
