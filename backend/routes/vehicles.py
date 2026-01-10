"""Vehicle routes for FleeTrack application - Refactored from server.py"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
import uuid
import logging
import shutil

from utils.database import get_database
from utils.auth import get_current_user
from models.veiculo import (
    Vehicle, VehicleCreate, VehicleMaintenance, VehicleVistoria, VistoriaCreate
)

# Setup logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/vehicles", tags=["vehicles"])

# Get database
db = get_database()

# Upload directories
ROOT_DIR = Path(__file__).parent.parent
UPLOAD_DIR = ROOT_DIR / "uploads"
VEHICLE_DOCS_UPLOAD_DIR = UPLOAD_DIR / "vehicle_documents"


class UserRole:
    """User roles for authorization"""
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== FILE UPLOAD UTILITIES ====================

async def process_uploaded_file(file: UploadFile, destination_dir: Path, file_id: str) -> Dict[str, str]:
    """Process uploaded file: save it and convert to PDF if it's an image"""
    from PIL import Image
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    
    file_extension = Path(file.filename).suffix.lower()
    original_filename = f"{file_id}_original{file_extension}"
    
    # Create directory if not exists
    destination_dir.mkdir(parents=True, exist_ok=True)
    
    # Save original file
    file_path = destination_dir / original_filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    result = {
        "original_path": str(file_path.relative_to(ROOT_DIR)),
        "pdf_path": None,
        "saved_path": str(file_path.relative_to(ROOT_DIR))
    }
    
    # Check if file is an image - convert to PDF
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.heic', '.heif'}
    
    if file_extension in image_extensions:
        try:
            pdf_filename = f"{file_id}.pdf"
            pdf_path = destination_dir / pdf_filename
            
            img = Image.open(file_path)
            if img.mode == 'RGBA':
                img = img.convert('RGB')
            
            img_width, img_height = img.size
            a4_width, a4_height = A4
            scale = min(a4_width / img_width, a4_height / img_height) * 0.9
            
            new_width = img_width * scale
            new_height = img_height * scale
            
            c = canvas.Canvas(str(pdf_path), pagesize=A4)
            x = (a4_width - new_width) / 2
            y = (a4_height - new_height) / 2
            c.drawImage(str(file_path), x, y, width=new_width, height=new_height)
            c.save()
            
            result["pdf_path"] = str(pdf_path.relative_to(ROOT_DIR))
            result["saved_path"] = result["pdf_path"]
        except Exception as e:
            logger.error(f"Error converting image to PDF: {e}")
    elif file_extension == '.pdf':
        result["pdf_path"] = result["original_path"]
    
    return result


# ==================== FILE DOWNLOAD ====================

@router.get("/download/{file_path:path}")
async def download_vehicle_document(
    file_path: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Download vehicle document with correct content-type
    """
    import mimetypes
    
    # Construir caminho completo
    full_path = ROOT_DIR / file_path
    
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determinar mime type
    mime_type, _ = mimetypes.guess_type(str(full_path))
    if mime_type is None:
        # Default para PDF se não conseguir determinar
        if str(full_path).endswith('.pdf'):
            mime_type = 'application/pdf'
        else:
            mime_type = 'application/octet-stream'
    
    return FileResponse(
        path=str(full_path),
        media_type=mime_type,
        filename=full_path.name
    )


async def auto_add_to_agenda(vehicle_id: str, tipo: str, data_vencimento: str, titulo: str):
    """Automatically add event to vehicle agenda when date is filled"""
    try:
        vencimento_date = datetime.strptime(data_vencimento, "%Y-%m-%d")
        reminder_date = (vencimento_date - timedelta(days=30)).strftime("%Y-%m-%d")
        
        evento = {
            "id": str(uuid.uuid4()),
            "tipo": tipo,
            "titulo": titulo,
            "data": reminder_date,
            "hora": "09:00",
            "descricao": f"Lembrete: {titulo} vence em {data_vencimento}",
            "auto_gerado": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$push": {"agenda": evento}}
        )
        
        logger.info(f"Auto-added to agenda: {titulo} for vehicle {vehicle_id}")
    except Exception as e:
        logger.error(f"Error auto-adding to agenda: {e}")


# ==================== VEHICLE CRUD ====================

@router.post("", response_model=Vehicle)
async def create_vehicle(vehicle_data: VehicleCreate, current_user: Dict = Depends(get_current_user)):
    """Create a new vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle_dict = vehicle_data.model_dump()
    vehicle_dict["id"] = str(uuid.uuid4())
    vehicle_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    vehicle_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Calculate alerta_validade (30 days before expiry)
    validade = datetime.fromisoformat(vehicle_data.validade_matricula).replace(tzinfo=timezone.utc)
    dias_restantes = (validade - datetime.now(timezone.utc)).days
    vehicle_dict["alerta_validade"] = dias_restantes <= 30
    
    vehicle_dict["manutencoes"] = []
    vehicle_dict["inspecoes"] = []
    vehicle_dict["km_atual"] = 0
    vehicle_dict["km_aviso_manutencao"] = 5000
    vehicle_dict["alertas_manutencao"] = []
    vehicle_dict["disponibilidade"] = {
        "status": "disponivel",
        "motoristas_atribuidos": [],
        "data_entrega_manutencao": None,
        "tipo_manutencao": None
    }
    
    # Set parceiro_id from current user if parceiro
    if current_user["role"] in [UserRole.PARCEIRO]:
        vehicle_dict["parceiro_id"] = current_user["id"]
    
    await db.vehicles.insert_one(vehicle_dict)
    
    if isinstance(vehicle_dict["created_at"], str):
        vehicle_dict["created_at"] = datetime.fromisoformat(vehicle_dict["created_at"])
    if isinstance(vehicle_dict["updated_at"], str):
        vehicle_dict["updated_at"] = datetime.fromisoformat(vehicle_dict["updated_at"])
    
    return Vehicle(**vehicle_dict)


@router.get("", response_model=List[Vehicle])
async def get_vehicles(current_user: Dict = Depends(get_current_user)):
    """Get all vehicles (filtered by role)"""
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    elif current_user["role"] == UserRole.GESTAO:
        parceiros_ids = current_user.get("parceiros_atribuidos", [])
        if parceiros_ids:
            query["parceiro_id"] = {"$in": parceiros_ids}
        else:
            query["parceiro_id"] = None
    
    vehicles = await db.vehicles.find(query, {"_id": 0}).to_list(1000)
    for v in vehicles:
        if isinstance(v["created_at"], str):
            v["created_at"] = datetime.fromisoformat(v["created_at"])
        if isinstance(v["updated_at"], str):
            v["updated_at"] = datetime.fromisoformat(v["updated_at"])
        if "km_atual" in v:
            if isinstance(v["km_atual"], str):
                v["km_atual"] = int(v["km_atual"]) if v["km_atual"].strip().isdigit() else 0
    return vehicles


@router.get("/available", response_model=List[Vehicle])
async def get_available_vehicles():
    """Get all available vehicles"""
    vehicles = await db.vehicles.find({"disponibilidade.status": "disponivel"}, {"_id": 0}).to_list(1000)
    for v in vehicles:
        if isinstance(v["created_at"], str):
            v["created_at"] = datetime.fromisoformat(v["created_at"])
        if isinstance(v["updated_at"], str):
            v["updated_at"] = datetime.fromisoformat(v["updated_at"])
    return vehicles


@router.post("/{vehicle_id}/request")
async def request_vehicle(vehicle_id: str, request_data: Dict[str, str], current_user: Dict = Depends(get_current_user)):
    """Motorista requests a vehicle"""
    if current_user["role"] != UserRole.MOTORISTA:
        raise HTTPException(status_code=403, detail="Only motoristas can request vehicles")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if vehicle.get("disponibilidade", {}).get("status") != "disponivel":
        raise HTTPException(status_code=400, detail="Vehicle not available")
    
    request_id = str(uuid.uuid4())
    vehicle_request = {
        "id": request_id,
        "vehicle_id": vehicle_id,
        "motorista_id": request_data.get("motorista_id", current_user["id"]),
        "status": "pendente",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vehicle_requests.insert_one(vehicle_request)
    
    return {"message": "Vehicle request submitted successfully", "request_id": request_id}


@router.get("/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    """Get a specific vehicle by ID"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if isinstance(vehicle["created_at"], str):
        vehicle["created_at"] = datetime.fromisoformat(vehicle["created_at"])
    if isinstance(vehicle["updated_at"], str):
        vehicle["updated_at"] = datetime.fromisoformat(vehicle["updated_at"])
    if "km_atual" in vehicle:
        if isinstance(vehicle["km_atual"], str):
            vehicle["km_atual"] = int(vehicle["km_atual"]) if vehicle["km_atual"].strip().isdigit() else 0
    
    return Vehicle(**vehicle)


@router.put("/{vehicle_id}")
async def update_vehicle(vehicle_id: str, updates: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    """Update a vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Se motorista_atribuido foi alterado, sincronizar o nome do motorista
    if "motorista_atribuido" in updates and updates["motorista_atribuido"]:
        motorista = await db.motoristas.find_one({"id": updates["motorista_atribuido"]}, {"_id": 0})
        if motorista:
            updates["motorista_atribuido_nome"] = motorista.get("name")
            
            # Atualizar veiculo_atribuido no motorista
            await db.motoristas.update_one(
                {"id": updates["motorista_atribuido"]},
                {"$set": {"veiculo_atribuido": vehicle_id}}
            )
            logger.info(f"✅ Veículo {vehicle_id} atribuído a motorista {motorista.get('name')}")
        else:
            updates["motorista_atribuido_nome"] = None
    elif "motorista_atribuido" in updates and not updates["motorista_atribuido"]:
        updates["motorista_atribuido_nome"] = None
    
    # Auto-add to agenda when dates are filled
    if updates.get("insurance") and updates["insurance"].get("data_validade"):
        await auto_add_to_agenda(
            vehicle_id, 
            "seguro", 
            updates["insurance"]["data_validade"],
            "Renovação de Seguro"
        )
    
    if updates.get("inspection") and updates["inspection"].get("proxima_inspecao"):
        await auto_add_to_agenda(
            vehicle_id,
            "inspecao",
            updates["inspection"]["proxima_inspecao"],
            "Inspeção do Veículo"
        )
    
    if updates.get("extintor") and updates["extintor"].get("data_validade"):
        await auto_add_to_agenda(
            vehicle_id,
            "extintor",
            updates["extintor"]["data_validade"],
            "Renovação de Extintor"
        )
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": updates})
    return {"message": "Vehicle updated"}


@router.delete("/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    """Delete a vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.vehicles.delete_one({"id": vehicle_id})
    return {"message": "Vehicle deleted"}


# ==================== VEHICLE PHOTOS ====================

@router.post("/{vehicle_id}/upload-photo")
async def upload_vehicle_photo(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload vehicle photo (max 3 photos)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    current_photos = vehicle.get("fotos", [])
    if len(current_photos) >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 photos allowed per vehicle")
    
    file_id = f"vehicle_{vehicle_id}_photo_{len(current_photos) + 1}_{uuid.uuid4()}"
    vehicle_photos_dir = UPLOAD_DIR / "vehicles"
    vehicle_photos_dir.mkdir(exist_ok=True)
    
    file_info = await process_uploaded_file(file, vehicle_photos_dir, file_id)
    photo_url = file_info["pdf_path"] if file_info["pdf_path"] else file_info["original_path"]
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$push": {"fotos": photo_url}}
    )
    
    return {"message": "Photo uploaded successfully", "photo_url": photo_url}


@router.post("/{vehicle_id}/upload-foto")
async def upload_vehicle_photo_alt(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload vehicle photo (alternative endpoint, max 3)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    current_photos = vehicle.get("fotos_veiculo", [])
    if len(current_photos) >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 photos allowed")
    
    photos_dir = UPLOAD_DIR / "vehicle_photos_info"
    photos_dir.mkdir(exist_ok=True)
    
    file_id = f"photo_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, photos_dir, file_id)
    photo_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$push": {"fotos_veiculo": photo_path}}
    )
    
    return {"message": "Photo uploaded successfully", "url": photo_path}


@router.delete("/{vehicle_id}/fotos/{foto_index}")
async def delete_vehicle_photo(
    vehicle_id: str,
    foto_index: int,
    current_user: Dict = Depends(get_current_user)
):
    """Delete vehicle photo by index"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    fotos = vehicle.get("fotos_veiculo", [])
    if foto_index < 0 or foto_index >= len(fotos):
        raise HTTPException(status_code=400, detail="Invalid photo index")
    
    fotos.pop(foto_index)
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"fotos_veiculo": fotos}}
    )
    
    return {"message": "Photo deleted successfully"}


@router.delete("/{vehicle_id}/photos/{photo_index}")
async def delete_vehicle_photo_alt(
    vehicle_id: str,
    photo_index: int,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a vehicle photo by index (0-2)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    fotos = vehicle.get("fotos", [])
    if photo_index < 0 or photo_index >= len(fotos):
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo_to_remove = fotos[photo_index]
    fotos.pop(photo_index)
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"fotos": fotos}}
    )
    
    try:
        photo_path = ROOT_DIR / photo_to_remove
        if photo_path.exists():
            photo_path.unlink()
    except Exception as e:
        logger.error(f"Error deleting photo file: {e}")
    
    return {"message": "Photo deleted successfully"}


# ==================== VEHICLE AGENDA ====================

@router.post("/{vehicle_id}/agenda")
async def add_vehicle_agenda(
    vehicle_id: str,
    agenda_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Add event to vehicle agenda"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    evento_id = str(uuid.uuid4())
    evento = {
        "id": evento_id,
        "tipo": agenda_data.get("tipo"),
        "titulo": agenda_data.get("titulo"),
        "data": agenda_data.get("data"),
        "hora": agenda_data.get("hora"),
        "descricao": agenda_data.get("descricao"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$push": {"agenda": evento}}
    )
    
    return {"message": "Event added to agenda", "evento_id": evento_id}


@router.get("/{vehicle_id}/agenda")
async def get_vehicle_agenda(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    """Get vehicle agenda"""
    vehicle = await db.vehicles.find_one(
        {"id": vehicle_id},
        {"_id": 0, "agenda": 1, "matricula": 1}
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return vehicle.get("agenda", [])


@router.put("/{vehicle_id}/agenda/{evento_id}")
async def update_vehicle_agenda(
    vehicle_id: str,
    evento_id: str,
    agenda_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update event in vehicle agenda"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    await db.vehicles.update_one(
        {"id": vehicle_id, "agenda.id": evento_id},
        {"$set": {
            "agenda.$.tipo": agenda_data.get("tipo"),
            "agenda.$.titulo": agenda_data.get("titulo"),
            "agenda.$.data": agenda_data.get("data"),
            "agenda.$.hora": agenda_data.get("hora"),
            "agenda.$.descricao": agenda_data.get("descricao"),
            "agenda.$.updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Event updated successfully"}


@router.delete("/{vehicle_id}/agenda/{evento_id}")
async def delete_vehicle_agenda(
    vehicle_id: str,
    evento_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete event from vehicle agenda"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$pull": {"agenda": {"id": evento_id}}}
    )
    
    return {"message": "Event deleted successfully"}


# ==================== VEHICLE HISTORICO ====================

@router.get("/{vehicle_id}/historico")
async def get_vehicle_historico(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    """Get vehicle history (maintenance, inspections, etc)"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    historico = []
    
    # Add maintenance history
    if vehicle.get("manutencoes"):
        for man in vehicle["manutencoes"]:
            historico.append({
                "tipo": "manutencao",
                "data": man.get("data"),
                "descricao": f"{man.get('tipo_manutencao')}: {man.get('descricao')}",
                "valor": man.get("valor"),
                "km": man.get("km_realizada")
            })
    
    # Add inspection history
    if vehicle.get("inspecoes"):
        for insp in vehicle["inspecoes"]:
            historico.append({
                "tipo": "inspecao",
                "data": insp.get("ultima_inspecao"),
                "descricao": f"Inspeção - {insp.get('resultado', 'N/A')}",
                "valor": insp.get("valor"),
                "observacoes": insp.get("observacoes")
            })
    
    # Add damages history
    if vehicle.get("danos"):
        for dano in vehicle["danos"]:
            historico.append({
                "tipo": "dano",
                "data": dano.get("data"),
                "descricao": f"{dano.get('tipo')}: {dano.get('descricao')}",
                "valor": dano.get("valor_reparacao"),
                "responsavel": dano.get("responsavel")
            })
    
    historico.sort(key=lambda x: x.get("data", ""), reverse=True)
    
    return historico


@router.post("/{vehicle_id}/historico")
async def add_historico_entry(
    vehicle_id: str,
    entry_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Add editable history entry to vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    entry = {
        "id": str(uuid.uuid4()),
        "data": entry_data.get("data"),
        "titulo": entry_data.get("titulo"),
        "descricao": entry_data.get("descricao"),
        "tipo": entry_data.get("tipo", "observacao"),
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", current_user.get("email")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$push": {"historico_editavel": entry}}
    )
    
    return {"message": "History entry added", "entry_id": entry["id"]}


@router.put("/{vehicle_id}/historico/{entry_id}")
async def update_historico_entry(
    vehicle_id: str,
    entry_id: str,
    entry_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update editable history entry"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    historico = vehicle.get("historico_editavel", [])
    for entry in historico:
        if entry["id"] == entry_id:
            entry["data"] = entry_data.get("data", entry["data"])
            entry["titulo"] = entry_data.get("titulo", entry["titulo"])
            entry["descricao"] = entry_data.get("descricao", entry["descricao"])
            entry["tipo"] = entry_data.get("tipo", entry["tipo"])
            entry["updated_at"] = datetime.now(timezone.utc).isoformat()
            break
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"historico_editavel": historico}}
    )
    
    return {"message": "History entry updated"}


@router.delete("/{vehicle_id}/historico/{entry_id}")
async def delete_historico_entry(
    vehicle_id: str,
    entry_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete editable history entry"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$pull": {"historico_editavel": {"id": entry_id}}}
    )
    
    return {"message": "History entry deleted"}


# ==================== VEHICLE FINANCIAL ====================

@router.get("/{vehicle_id}/relatorio-ganhos")
async def get_vehicle_relatorio_ganhos(
    vehicle_id: str, 
    periodo: str = "total",  # total, ano, mes, custom
    ano: int = None,
    mes: int = None,
    data_inicio: str = None,
    data_fim: str = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Get vehicle financial report with ROI calculation
    
    Periods:
    - total: desde aquisição
    - ano: ano específico
    - mes: mês específico
    - custom: datas personalizadas
    """
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    now = datetime.now(timezone.utc)
    
    # Definir período de análise
    if periodo == "ano" and ano:
        filtro_data_inicio = f"{ano}-01-01"
        filtro_data_fim = f"{ano}-12-31"
    elif periodo == "mes" and ano and mes:
        from calendar import monthrange
        ultimo_dia = monthrange(ano, mes)[1]
        filtro_data_inicio = f"{ano}-{mes:02d}-01"
        filtro_data_fim = f"{ano}-{mes:02d}-{ultimo_dia}"
    elif periodo == "custom" and data_inicio and data_fim:
        filtro_data_inicio = data_inicio
        filtro_data_fim = data_fim
    else:
        # Total - desde sempre
        filtro_data_inicio = "2000-01-01"
        filtro_data_fim = now.strftime("%Y-%m-%d")
    
    # ==================== RECEITAS ====================
    receitas_total = 0.0
    receitas_detalhes = []
    
    # 1. Alugueres cobrados (do histórico de atribuições)
    historico = await db.historico_atribuicoes.find(
        {"veiculo_id": vehicle_id},
        {"_id": 0}
    ).to_list(1000)
    
    for entry in historico:
        valor_semanal = entry.get("valor_aluguer_semanal", 0) or 0
        data_inicio_attr = entry.get("data_inicio", "")[:10]
        data_fim_attr = (entry.get("data_fim") or now.isoformat())[:10]
        
        # Verificar se está no período
        if data_inicio_attr >= filtro_data_inicio and data_inicio_attr <= filtro_data_fim:
            # Calcular semanas
            try:
                dt_inicio = datetime.fromisoformat(data_inicio_attr)
                dt_fim = datetime.fromisoformat(data_fim_attr)
                semanas = max(1, (dt_fim - dt_inicio).days // 7)
                valor_total = valor_semanal * semanas
                
                if valor_total > 0:
                    receitas_total += valor_total
                    receitas_detalhes.append({
                        "tipo": "ganho",
                        "categoria": "aluguer",
                        "descricao": f"Aluguer - {entry.get('motorista_nome', 'N/A')} ({semanas} semanas)",
                        "data": data_inicio_attr,
                        "valor": valor_total
                    })
            except:
                pass
    
    # 2. Relatórios semanais pagos (se houver)
    relatorios = await db.relatorios_semanais.find(
        {
            "veiculo_id": vehicle_id,
            "estado": "pago",
            "data_emissao": {"$gte": filtro_data_inicio, "$lte": filtro_data_fim}
        },
        {"_id": 0}
    ).to_list(1000)
    
    for rel in relatorios:
        valor = rel.get("valor_aluguer", 0) or 0
        if valor > 0:
            receitas_total += valor
            receitas_detalhes.append({
                "tipo": "ganho",
                "categoria": "relatorio",
                "descricao": f"Relatório Semana {rel.get('semana', '')}/{rel.get('ano', '')}",
                "data": rel.get("data_emissao", "")[:10],
                "valor": valor
            })
    
    # ==================== CUSTOS ====================
    custos_total = 0.0
    custos_por_categoria = {}
    custos_detalhes = []
    
    # 1. Manutenções/Revisões
    if vehicle.get("manutencoes"):
        for man in vehicle["manutencoes"]:
            data_man = man.get("data", "")[:10] if man.get("data") else ""
            if data_man >= filtro_data_inicio and data_man <= filtro_data_fim:
                valor = float(man.get("valor", 0) or 0)
                custos_total += valor
                categoria = "revisao" if "revisão" in man.get("tipo_manutencao", "").lower() else "manutencao"
                custos_por_categoria[categoria] = custos_por_categoria.get(categoria, 0) + valor
                custos_detalhes.append({
                    "tipo": "despesa",
                    "categoria": categoria,
                    "descricao": f"Manutenção: {man.get('tipo_manutencao', 'N/A')}",
                    "data": data_man,
                    "valor": valor
                })
    
    # 2. Seguro
    if vehicle.get("insurance") or vehicle.get("seguro"):
        seguro = vehicle.get("insurance") or vehicle.get("seguro") or {}
        valor = float(seguro.get("valor", 0) or 0)
        data_seguro = (seguro.get("data_inicio") or "")[:10]
        if valor > 0 and data_seguro >= filtro_data_inicio and data_seguro <= filtro_data_fim:
            custos_total += valor
            custos_por_categoria["seguro"] = custos_por_categoria.get("seguro", 0) + valor
            custos_detalhes.append({
                "tipo": "despesa",
                "categoria": "seguro",
                "descricao": f"Seguro - {seguro.get('seguradora', 'N/A')}",
                "data": data_seguro,
                "valor": valor
            })
    
    # 3. Inspeções/Vistorias
    if vehicle.get("inspection") or vehicle.get("inspecoes"):
        inspecao = vehicle.get("inspection") or {}
        valor = float(inspecao.get("valor", 0) or inspecao.get("custo", 0) or 0)
        data_insp = (inspecao.get("ultima_inspecao") or inspecao.get("data_inspecao") or "")[:10]
        if valor > 0 and data_insp >= filtro_data_inicio and data_insp <= filtro_data_fim:
            custos_total += valor
            custos_por_categoria["vistoria"] = custos_por_categoria.get("vistoria", 0) + valor
            custos_detalhes.append({
                "tipo": "despesa",
                "categoria": "vistoria",
                "descricao": "Inspeção/Vistoria",
                "data": data_insp,
                "valor": valor
            })
        
        # Também verificar lista de inspeções
        if vehicle.get("inspecoes"):
            for insp in vehicle["inspecoes"]:
                valor = float(insp.get("custo", 0) or 0)
                data_insp = (insp.get("data_inspecao") or "")[:10]
                if valor > 0 and data_insp >= filtro_data_inicio and data_insp <= filtro_data_fim:
                    custos_total += valor
                    custos_por_categoria["vistoria"] = custos_por_categoria.get("vistoria", 0) + valor
                    custos_detalhes.append({
                        "tipo": "despesa",
                        "categoria": "vistoria",
                        "descricao": f"Inspeção - {insp.get('centro_inspecao', 'N/A')}",
                        "data": data_insp,
                        "valor": valor
                    })
    
    # 4. Extintor
    if vehicle.get("extintor"):
        extintor = vehicle["extintor"]
        valor = float(extintor.get("preco", 0) or 0)
        data_ext = (extintor.get("data_instalacao") or "")[:10]
        if valor > 0 and data_ext >= filtro_data_inicio and data_ext <= filtro_data_fim:
            custos_total += valor
            custos_por_categoria["outros"] = custos_por_categoria.get("outros", 0) + valor
            custos_detalhes.append({
                "tipo": "despesa",
                "categoria": "outros",
                "descricao": "Extintor",
                "data": data_ext,
                "valor": valor
            })
    
    # 5. Custos do histórico de custos (nova coleção)
    custos_historico = await db.historico_custos_veiculo.find(
        {
            "veiculo_id": vehicle_id,
            "data": {"$gte": filtro_data_inicio, "$lte": filtro_data_fim}
        },
        {"_id": 0}
    ).to_list(1000)
    
    for custo in custos_historico:
        valor = float(custo.get("valor", 0) or 0)
        categoria = custo.get("categoria", "outros")
        custos_total += valor
        custos_por_categoria[categoria] = custos_por_categoria.get(categoria, 0) + valor
        custos_detalhes.append({
            "tipo": "despesa",
            "categoria": categoria,
            "descricao": custo.get("descricao", "Custo"),
            "data": custo.get("data", "")[:10],
            "valor": valor,
            "fornecedor": custo.get("fornecedor")
        })
    
    # ==================== CÁLCULO ROI ====================
    lucro = receitas_total - custos_total
    roi = 0.0
    if custos_total > 0:
        roi = ((receitas_total - custos_total) / custos_total) * 100
    
    # Combinar detalhes
    detalhes = receitas_detalhes + custos_detalhes
    detalhes_sorted = sorted(detalhes, key=lambda x: x.get("data", ""), reverse=True)
    
    return {
        "veiculo_id": vehicle_id,
        "matricula": vehicle.get("matricula"),
        "periodo": {
            "tipo": periodo,
            "data_inicio": filtro_data_inicio,
            "data_fim": filtro_data_fim
        },
        "receitas": {
            "total": round(receitas_total, 2),
            "detalhes": receitas_detalhes
        },
        "custos": {
            "total": round(custos_total, 2),
            "por_categoria": {k: round(v, 2) for k, v in custos_por_categoria.items()},
            "detalhes": custos_detalhes
        },
        "ganhos_total": round(receitas_total, 2),
        "despesas_total": round(custos_total, 2),
        "lucro": round(lucro, 2),
        "roi": round(roi, 2),
        "detalhes": detalhes_sorted
    }


# ==================== HISTÓRICO DE CUSTOS ====================

@router.post("/{vehicle_id}/custos")
async def add_custo_veiculo(
    vehicle_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """
    Adicionar custo ao histórico do veículo
    
    Body:
    - categoria: revisao, vistoria, seguro, pneus, reparacao, combustivel, lavagem, multa, outros
    - descricao: Descrição do custo
    - valor: Valor em euros
    - data: Data do custo (YYYY-MM-DD)
    - fornecedor: Nome do fornecedor/oficina (opcional)
    - documento_url: URL do documento/fatura (opcional)
    - observacoes: Notas adicionais (opcional)
    - responsavel: 'parceiro' ou 'motorista' (opcional, default: parceiro)
    - atribuir_motorista: bool - se true, registar para dedução do motorista
    - motorista_id: ID do motorista responsável (opcional)
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Validar campos obrigatórios
    categoria = data.get("categoria")
    descricao = data.get("descricao")
    valor = data.get("valor")
    data_custo = data.get("data")
    
    if not all([categoria, descricao, valor, data_custo]):
        raise HTTPException(status_code=400, detail="categoria, descricao, valor e data são obrigatórios")
    
    categorias_validas = ["revisao", "vistoria", "seguro", "pneus", "reparacao", 
                         "combustivel", "lavagem", "multa", "outros"]
    if categoria not in categorias_validas:
        raise HTTPException(status_code=400, detail=f"Categoria inválida. Use: {', '.join(categorias_validas)}")
    
    custo_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    custo = {
        "id": custo_id,
        "veiculo_id": vehicle_id,
        "veiculo_matricula": vehicle.get("matricula"),
        "parceiro_id": vehicle.get("parceiro_id"),
        "categoria": categoria,
        "descricao": descricao,
        "valor": float(valor),
        "data": data_custo,
        "fornecedor": data.get("fornecedor"),
        "documento_url": data.get("documento_url"),
        "observacoes": data.get("observacoes"),
        "responsavel": data.get("responsavel", "parceiro"),
        "atribuir_motorista": data.get("atribuir_motorista", False),
        "motorista_id": data.get("motorista_id"),
        "created_at": now.isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.historico_custos_veiculo.insert_one(custo)
    
    logger.info(f"✅ Custo adicionado ao veículo {vehicle.get('matricula')}: {categoria} - €{valor}")
    
    return {
        "message": "Custo adicionado com sucesso",
        "custo_id": custo_id,
        "custo": {
            "id": custo_id,
            "categoria": categoria,
            "descricao": descricao,
            "valor": float(valor),
            "data": data_custo
        }
    }


@router.get("/{vehicle_id}/custos")
async def get_custos_veiculo(
    vehicle_id: str,
    categoria: str = None,
    ano: int = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Obter histórico de custos do veículo
    Filtros opcionais: categoria, ano
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    query = {"veiculo_id": vehicle_id}
    
    if categoria:
        query["categoria"] = categoria
    
    if ano:
        query["data"] = {"$gte": f"{ano}-01-01", "$lte": f"{ano}-12-31"}
    
    custos = await db.historico_custos_veiculo.find(
        query, {"_id": 0}
    ).sort("data", -1).to_list(1000)
    
    # Calcular totais por categoria
    totais = {}
    total_geral = 0.0
    for custo in custos:
        cat = custo.get("categoria", "outros")
        valor = custo.get("valor", 0)
        totais[cat] = totais.get(cat, 0) + valor
        total_geral += valor
    
    return {
        "veiculo_id": vehicle_id,
        "matricula": vehicle.get("matricula"),
        "custos": custos,
        "totais_por_categoria": {k: round(v, 2) for k, v in totais.items()},
        "total_geral": round(total_geral, 2),
        "total_registos": len(custos)
    }


@router.put("/{vehicle_id}/custos/{custo_id}")
async def update_custo_veiculo(
    vehicle_id: str,
    custo_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar custo do veículo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    custo = await db.historico_custos_veiculo.find_one(
        {"id": custo_id, "veiculo_id": vehicle_id},
        {"_id": 0}
    )
    if not custo:
        raise HTTPException(status_code=404, detail="Custo não encontrado")
    
    allowed_fields = ["categoria", "descricao", "valor", "data", "fornecedor", 
                      "documento_url", "observacoes"]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.historico_custos_veiculo.update_one(
        {"id": custo_id},
        {"$set": update_data}
    )
    
    return {"message": "Custo atualizado com sucesso"}


@router.delete("/{vehicle_id}/custos/{custo_id}")
async def delete_custo_veiculo(
    vehicle_id: str,
    custo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar custo do veículo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.historico_custos_veiculo.delete_one(
        {"id": custo_id, "veiculo_id": vehicle_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custo não encontrado")
    
    return {"message": "Custo eliminado com sucesso"}



@router.post("/{vehicle_id}/atribuir-motorista")
async def atribuir_motorista_vehicle(
    vehicle_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """
    Atribuir motorista a um veículo com Via Verde e Cartão Frota
    Regista histórico de atribuição com data/hora para cálculo de aluguer proporcional
    
    Body:
    - motorista_id: ID do motorista (ou null para remover)
    - via_verde_id: ID/número do OBU Via Verde (opcional)
    - cartao_frota_id: ID/número do cartão frota combustível fóssil (opcional)
    - cartao_frota_eletric_id: ID/número do cartão frota elétrico (opcional)
    - km_atual: KM atual do veículo no momento da atribuição (opcional)
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista_id = data.get("motorista_id")
    via_verde_id = data.get("via_verde_id")
    cartao_frota_id = data.get("cartao_frota_id")
    cartao_frota_eletric_id = data.get("cartao_frota_eletric_id")
    km_atribuicao = data.get("km_atual")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
    # Fechar atribuição anterior no histórico (se existir)
    old_motorista_id = vehicle.get("motorista_atribuido")
    if old_motorista_id:
        # Atualizar a última entrada do histórico com data_fim
        await db.historico_atribuicoes.update_one(
            {
                "veiculo_id": vehicle_id,
                "motorista_id": old_motorista_id,
                "data_fim": None
            },
            {
                "$set": {
                    "data_fim": now_iso,
                    "km_final": km_atribuicao or vehicle.get("km_atual", 0)
                }
            }
        )
        logger.info(f"📋 Fechado histórico de atribuição anterior: motorista {old_motorista_id}")
    
    if motorista_id:
        motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
        if not motorista:
            raise HTTPException(status_code=404, detail="Motorista not found")
        
        # Criar nova entrada no histórico de atribuições
        historico_entry = {
            "id": str(uuid.uuid4()),
            "veiculo_id": vehicle_id,
            "veiculo_matricula": vehicle.get("matricula"),
            "motorista_id": motorista_id,
            "motorista_nome": motorista.get("name"),
            "parceiro_id": vehicle.get("parceiro_id"),
            "data_inicio": now_iso,
            "data_fim": None,  # Será preenchido quando trocar de motorista
            "km_inicial": km_atribuicao or vehicle.get("km_atual", 0),
            "km_final": None,
            "valor_aluguer_semanal": vehicle.get("tipo_contrato", {}).get("valor_aluguer", 0),
            "tipo_contrato": vehicle.get("tipo_contrato", {}).get("tipo"),
            "dispositivos": {
                "obu_via_verde": via_verde_id or vehicle.get("via_verde_id"),
                "cartao_combustivel_fossil": cartao_frota_id or vehicle.get("cartao_frota_id"),
                "cartao_combustivel_eletrico": cartao_frota_eletric_id or vehicle.get("cartao_frota_eletric_id"),
                "gps_matricula": vehicle.get("matricula")
            },
            "created_at": now_iso,
            "created_by": current_user["id"]
        }
        
        await db.historico_atribuicoes.insert_one(historico_entry)
        logger.info(f"📋 Criado histórico de atribuição: {motorista.get('name')} -> {vehicle.get('matricula')}")
        
        # Atualizar veículo
        vehicle_update = {
            "motorista_atribuido": motorista_id,
            "motorista_atribuido_nome": motorista.get("name"),
            "motorista_atribuido_desde": now_iso,  # Nova data/hora de atribuição
            "status": "atribuido",
            "updated_at": now_iso
        }
        
        # Atualizar KM se fornecido
        if km_atribuicao:
            vehicle_update["km_atual"] = km_atribuicao
        
        # Atualizar cartões se fornecidos
        if via_verde_id is not None:
            vehicle_update["via_verde_id"] = via_verde_id
            vehicle_update["via_verde_disponivel"] = bool(via_verde_id)
        
        if cartao_frota_id is not None:
            vehicle_update["cartao_frota_id"] = cartao_frota_id
            vehicle_update["cartao_frota_disponivel"] = bool(cartao_frota_id)
        
        if cartao_frota_eletric_id is not None:
            vehicle_update["cartao_frota_eletric_id"] = cartao_frota_eletric_id
        
        await db.vehicles.update_one({"id": vehicle_id}, {"$set": vehicle_update})
        
        # Atualizar motorista com os cartões associados
        motorista_update = {
            "veiculo_atribuido": vehicle_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Associar cartões ao motorista
        if cartao_frota_id or vehicle.get("cartao_frota_id"):
            motorista_update["cartao_combustivel_id"] = cartao_frota_id or vehicle.get("cartao_frota_id")
            motorista_update["id_cartao_frota_combustivel"] = cartao_frota_id or vehicle.get("cartao_frota_id")
        
        if cartao_frota_eletric_id or vehicle.get("cartao_frota_eletric_id"):
            motorista_update["cartao_eletrico_id"] = cartao_frota_eletric_id or vehicle.get("cartao_frota_eletric_id")
        
        if via_verde_id or vehicle.get("via_verde_id"):
            motorista_update["cartao_viaverde_id"] = via_verde_id or vehicle.get("via_verde_id")
        
        await db.motoristas.update_one({"id": motorista_id}, {"$set": motorista_update})
        
        logger.info(f"✅ Motorista {motorista.get('name')} atribuído ao veículo {vehicle.get('matricula')} com cartões: VV={via_verde_id}, Comb={cartao_frota_id}, Elec={cartao_frota_eletric_id}")
        
        return {
            "message": "Motorista atribuído com sucesso",
            "motorista": motorista.get("name"),
            "via_verde_id": via_verde_id or vehicle.get("via_verde_id"),
            "cartao_frota_id": cartao_frota_id or vehicle.get("cartao_frota_id"),
            "cartao_frota_eletric_id": cartao_frota_eletric_id or vehicle.get("cartao_frota_eletric_id"),
            "data_atribuicao": now_iso,
            "historico_id": historico_entry["id"]
        }
    else:
        # Remover motorista - fechar histórico e limpar associações
        km_remocao = data.get("km_atual")
        
        # Fechar histórico de atribuição atual
        if old_motorista_id:
            await db.historico_atribuicoes.update_one(
                {
                    "veiculo_id": vehicle_id,
                    "motorista_id": old_motorista_id,
                    "data_fim": None
                },
                {
                    "$set": {
                        "data_fim": now_iso,
                        "km_final": km_remocao or vehicle.get("km_atual", 0)
                    }
                }
            )
        
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {
                "motorista_atribuido": None,
                "motorista_atribuido_nome": None,
                "motorista_atribuido_desde": None,
                "status": "disponivel",
                "updated_at": now_iso
            }}
        )
        
        # Limpar associações do motorista anterior
        if old_motorista_id:
            await db.motoristas.update_one(
                {"id": old_motorista_id},
                {"$set": {
                    "veiculo_atribuido": None,
                    "cartao_combustivel_id": None,
                    "cartao_eletrico_id": None,
                    "cartao_viaverde_id": None,
                    "id_cartao_frota_combustivel": None,
                    "updated_at": now_iso
                }}
            )
            logger.info(f"✅ Motorista removido do veículo {vehicle.get('matricula')}")
        
        return {"message": "Motorista removido com sucesso", "data_remocao": now_iso}


# ==================== HISTÓRICO DE ATRIBUIÇÕES ====================

@router.get("/{vehicle_id}/historico-atribuicoes")
async def get_historico_atribuicoes(
    vehicle_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Obter histórico de atribuições de motoristas ao veículo
    Inclui dados de KM, datas e ganhos por período
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Se parceiro, só pode ver histórico dos seus veículos
    if current_user["role"] == UserRole.PARCEIRO and vehicle.get("parceiro_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    historico = await db.historico_atribuicoes.find(
        {"veiculo_id": vehicle_id},
        {"_id": 0}
    ).sort("data_inicio", -1).to_list(100)
    
    # Enriquecer com dados adicionais (ganhos por período)
    for entry in historico:
        motorista_id = entry.get("motorista_id")
        data_inicio = entry.get("data_inicio")
        data_fim = entry.get("data_fim")
        
        if motorista_id and data_inicio:
            # Calcular ganhos do motorista neste período
            ganhos_query = {
                "motorista_id": motorista_id,
                "data": {"$gte": data_inicio[:10]}  # Usar apenas a data (YYYY-MM-DD)
            }
            if data_fim:
                ganhos_query["data"]["$lte"] = data_fim[:10]
            
            # Somar ganhos de Uber e Bolt
            ganhos_uber = await db.dados_uber.find(ganhos_query, {"_id": 0}).to_list(1000)
            ganhos_bolt = await db.dados_bolt.find(ganhos_query, {"_id": 0}).to_list(1000)
            
            total_uber = sum(r.get("pago_total", 0) or r.get("rendimentos_total", 0) or 0 for r in ganhos_uber)
            total_bolt = sum(r.get("ganhos", 0) or r.get("earnings", 0) or 0 for r in ganhos_bolt)
            
            entry["ganhos_periodo"] = {
                "uber": round(total_uber, 2),
                "bolt": round(total_bolt, 2),
                "total": round(total_uber + total_bolt, 2)
            }
            
            # Calcular KM percorridos
            if entry.get("km_inicial") and entry.get("km_final"):
                entry["km_percorridos"] = entry["km_final"] - entry["km_inicial"]
    
    return {
        "veiculo_id": vehicle_id,
        "matricula": vehicle.get("matricula"),
        "historico": historico,
        "total_registos": len(historico)
    }


@router.put("/{vehicle_id}/historico-atribuicoes/{historico_id}")
async def update_historico_atribuicao(
    vehicle_id: str,
    historico_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """
    Atualizar entrada do histórico de atribuições
    Permite corrigir KM, datas, ou adicionar ganhos semanais
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    entry = await db.historico_atribuicoes.find_one(
        {"id": historico_id, "veiculo_id": vehicle_id},
        {"_id": 0}
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Histórico não encontrado")
    
    # Campos permitidos para atualização
    allowed_fields = [
        "km_inicial", "km_final", "data_inicio", "data_fim",
        "ganhos_semanais", "observacoes"
    ]
    
    update_data = {
        k: v for k, v in data.items() if k in allowed_fields
    }
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.historico_atribuicoes.update_one(
        {"id": historico_id},
        {"$set": update_data}
    )
    
    return {"message": "Histórico atualizado com sucesso"}


@router.post("/{vehicle_id}/historico-atribuicoes/{historico_id}/ganhos-semanais")
async def add_ganhos_semanais(
    vehicle_id: str,
    historico_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """
    Adicionar registo de ganhos semanais ao histórico
    Usado para tracking de performance do motorista com este veículo
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    entry = await db.historico_atribuicoes.find_one(
        {"id": historico_id, "veiculo_id": vehicle_id},
        {"_id": 0}
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Histórico não encontrado")
    
    semana = data.get("semana")
    ano = data.get("ano")
    if not semana or not ano:
        raise HTTPException(status_code=400, detail="Semana e ano são obrigatórios")
    
    ganho_semanal = {
        "id": str(uuid.uuid4()),
        "semana": semana,
        "ano": ano,
        "km_semana": data.get("km_semana", 0),
        "ganhos_uber": data.get("ganhos_uber", 0),
        "ganhos_bolt": data.get("ganhos_bolt", 0),
        "total_ganhos": data.get("ganhos_uber", 0) + data.get("ganhos_bolt", 0),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.historico_atribuicoes.update_one(
        {"id": historico_id},
        {"$push": {"ganhos_semanais": ganho_semanal}}
    )
    
    return {"message": "Ganhos semanais adicionados", "ganho": ganho_semanal}


@router.put("/{vehicle_id}/dispositivos")
async def update_dispositivos_veiculo(
    vehicle_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """
    Atualizar dispositivos associados ao veículo
    - OBU Via Verde
    - Cartão combustível fóssil
    - Cartão combustível elétrico
    - GPS (matrícula - apenas leitura)
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Atualizar OBU Via Verde
    if "obu_via_verde" in data:
        update_data["via_verde_id"] = data["obu_via_verde"]
        update_data["obu"] = data["obu_via_verde"]  # Guardar também no campo obu para importação
        update_data["via_verde_disponivel"] = bool(data["obu_via_verde"])
    
    # Atualizar cartão combustível fóssil
    if "cartao_combustivel_fossil" in data:
        update_data["cartao_frota_id"] = data["cartao_combustivel_fossil"]
        update_data["cartao_frota_disponivel"] = bool(data["cartao_combustivel_fossil"])
    
    # Atualizar cartão combustível elétrico
    if "cartao_combustivel_eletrico" in data:
        update_data["cartao_frota_eletric_id"] = data["cartao_combustivel_eletrico"]
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": update_data}
    )
    
    # Se veículo tem motorista atribuído, atualizar também os cartões do motorista
    motorista_id = vehicle.get("motorista_atribuido")
    if motorista_id:
        motorista_update = {
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if "obu_via_verde" in data:
            motorista_update["cartao_viaverde_id"] = data["obu_via_verde"]
        
        if "cartao_combustivel_fossil" in data:
            motorista_update["cartao_combustivel_id"] = data["cartao_combustivel_fossil"]
            motorista_update["id_cartao_frota_combustivel"] = data["cartao_combustivel_fossil"]
        
        if "cartao_combustivel_eletrico" in data:
            motorista_update["cartao_eletrico_id"] = data["cartao_combustivel_eletrico"]
        
        await db.motoristas.update_one(
            {"id": motorista_id},
            {"$set": motorista_update}
        )
        logger.info(f"✅ Dispositivos do motorista {motorista_id} atualizados automaticamente")
    
    return {
        "message": "Dispositivos atualizados com sucesso",
        "dispositivos": {
            "obu_via_verde": data.get("obu_via_verde") or vehicle.get("via_verde_id"),
            "cartao_combustivel_fossil": data.get("cartao_combustivel_fossil") or vehicle.get("cartao_frota_id"),
            "cartao_combustivel_eletrico": data.get("cartao_combustivel_eletrico") or vehicle.get("cartao_frota_eletric_id"),
            "gps_matricula": vehicle.get("matricula")
        }
    }


@router.get("/{vehicle_id}/dispositivos")
async def get_dispositivos_veiculo(
    vehicle_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Obter dispositivos associados ao veículo
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Se parceiro, só pode ver dispositivos dos seus veículos
    if current_user["role"] == UserRole.PARCEIRO and vehicle.get("parceiro_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "veiculo_id": vehicle_id,
        "matricula": vehicle.get("matricula"),
        "dispositivos": {
            "obu_via_verde": vehicle.get("via_verde_id"),
            "cartao_combustivel_fossil": vehicle.get("cartao_frota_id"),
            "cartao_combustivel_eletrico": vehicle.get("cartao_frota_eletric_id"),
            "gps_matricula": vehicle.get("matricula")
        },
        "motorista_atribuido": {
            "id": vehicle.get("motorista_atribuido"),
            "nome": vehicle.get("motorista_atribuido_nome"),
            "desde": vehicle.get("motorista_atribuido_desde")
        }
    }



# ==================== VEHICLE DOCUMENT UPLOADS ====================

@router.post("/{vehicle_id}/upload-seguro-doc")
async def upload_seguro_document(
    vehicle_id: str,
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload insurance documents (carta verde, condições, fatura)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    insurance_docs_dir = UPLOAD_DIR / "insurance_docs"
    insurance_docs_dir.mkdir(exist_ok=True)
    
    file_id = f"insurance_{doc_type}_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, insurance_docs_dir, file_id)
    
    field_map = {
        "carta_verde": "insurance.carta_verde_url",
        "condicoes": "insurance.condicoes_url",
        "fatura": "insurance.fatura_url"
    }
    
    if doc_type not in field_map:
        raise HTTPException(status_code=400, detail="Invalid doc_type")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    insurance = vehicle.get("insurance", {})
    if doc_type == "carta_verde":
        insurance["carta_verde_url"] = file_info["saved_path"]
    elif doc_type == "condicoes":
        insurance["condicoes_url"] = file_info["saved_path"]
    elif doc_type == "fatura":
        insurance["fatura_url"] = file_info["saved_path"]
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"insurance": insurance}}
    )
    
    return {"message": "Document uploaded successfully", "url": file_info["saved_path"]}


@router.post("/{vehicle_id}/upload-inspecao-doc")
async def upload_inspecao_document(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload inspection document"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    inspection_docs_dir = UPLOAD_DIR / "inspection_docs"
    inspection_docs_dir.mkdir(exist_ok=True)
    
    file_id = f"inspection_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, inspection_docs_dir, file_id)
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    inspection = vehicle.get("inspection", {})
    inspection["ficha_inspecao_url"] = file_info["saved_path"]
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"inspection": inspection}}
    )
    
    return {"message": "Document uploaded successfully", "url": file_info["saved_path"]}


@router.post("/{vehicle_id}/upload-extintor-doc")
async def upload_extintor_document(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload fire extinguisher certificate"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    extintor_docs_dir = UPLOAD_DIR / "extintor_docs"
    extintor_docs_dir.mkdir(exist_ok=True)
    
    file_id = f"extintor_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, extintor_docs_dir, file_id)
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    extintor = vehicle.get("extintor", {})
    file_url = file_info.get("pdf_path") or file_info.get("original_path")
    extintor["certificado_url"] = file_url
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"extintor": extintor}}
    )
    
    return {"message": "Document uploaded successfully", "certificado_url": file_url, "file_info": file_info}


@router.post("/{vehicle_id}/upload-carta-verde")
async def upload_carta_verde(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload carta verde document"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    file_id = f"carta_verde_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, VEHICLE_DOCS_UPLOAD_DIR, file_id)
    document_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"documento_carta_verde": document_path}}
    )
    
    return {"message": "Carta verde uploaded successfully", "url": document_path}


@router.post("/{vehicle_id}/upload-condicoes")
async def upload_condicoes(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload condições document"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    file_id = f"condicoes_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, VEHICLE_DOCS_UPLOAD_DIR, file_id)
    document_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"documento_condicoes": document_path}}
    )
    
    return {"message": "Condições document uploaded successfully", "url": document_path}


@router.post("/{vehicle_id}/upload-recibo-seguro")
async def upload_recibo_seguro(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload recibo de pagamento do seguro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    file_id = f"recibo_seguro_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, VEHICLE_DOCS_UPLOAD_DIR, file_id)
    document_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"documento_recibo_seguro": document_path}}
    )
    
    return {"message": "Recibo de seguro uploaded successfully", "url": document_path}


@router.post("/{vehicle_id}/upload-documento-inspecao")
async def upload_documento_inspecao(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload documento/certificado da inspeção"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    file_id = f"doc_inspecao_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, VEHICLE_DOCS_UPLOAD_DIR, file_id)
    document_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"documento_inspecao": document_path}}
    )
    
    return {"message": "Documento de inspeção uploaded successfully", "url": document_path}


@router.post("/{vehicle_id}/upload-dua-frente")
async def upload_dua_frente(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload DUA (Documento Único Automóvel) - Frente"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    file_id = f"dua_frente_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, VEHICLE_DOCS_UPLOAD_DIR, file_id)
    document_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"documento_dua_frente": document_path}}
    )
    
    return {"message": "DUA (frente) uploaded successfully", "url": document_path}


@router.post("/{vehicle_id}/upload-dua-verso")
async def upload_dua_verso(
    vehicle_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload DUA (Documento Único Automóvel) - Verso"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    file_id = f"dua_verso_{vehicle_id}_{uuid.uuid4()}"
    file_info = await process_uploaded_file(file, VEHICLE_DOCS_UPLOAD_DIR, file_id)
    document_path = file_info.get("pdf_path") or file_info.get("original_path")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"documento_dua_verso": document_path}}
    )
    
    return {"message": "DUA (verso) uploaded successfully", "url": document_path}


# ==================== VEHICLE KM AND STATUS ====================

@router.put("/{vehicle_id}/update-km")
async def update_vehicle_km(
    vehicle_id: str,
    data: Dict[str, int],
    current_user: Dict = Depends(get_current_user)
):
    """Update vehicle KM"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    km_atual = data.get("km_atual")
    if not km_atual or km_atual < 0:
        raise HTTPException(status_code=400, detail="Invalid KM value")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {
            "km_atual": km_atual,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "KM updated successfully", "km_atual": km_atual}


@router.put("/{vehicle_id}/status")
async def update_vehicle_status(
    vehicle_id: str,
    data: Dict[str, str],
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar status do veículo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    status = data.get("status")
    valid_statuses = ["disponivel", "atribuido", "manutencao", "venda", "condicoes"]
    
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {', '.join(valid_statuses)}")
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Status atualizado com sucesso", "status": status}


# ==================== VEHICLE MAINTENANCE ====================

@router.post("/{vehicle_id}/manutencoes")
async def add_vehicle_maintenance(
    vehicle_id: str,
    manutencao: VehicleMaintenance,
    current_user: Dict = Depends(get_current_user)
):
    """Add maintenance record to vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    manutencao_dict = manutencao.model_dump()
    
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {
            "$push": {"manutencoes": manutencao_dict},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Maintenance added", "manutencao_id": manutencao.id if hasattr(manutencao, 'id') else None}


@router.get("/{vehicle_id}/manutencoes/{manutencao_id}")
async def get_maintenance_detail(
    vehicle_id: str,
    manutencao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get maintenance detail"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    for manutencao in vehicle.get("manutencoes", []):
        if manutencao.get("id") == manutencao_id:
            return manutencao
    
    raise HTTPException(status_code=404, detail="Maintenance not found")


@router.get("/{vehicle_id}/relatorio-intervencoes")
async def get_vehicle_interventions_report(
    vehicle_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get comprehensive interventions report for a vehicle"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    interventions = []
    today = datetime.now(timezone.utc).date()
    
    # Add insurance interventions
    seguro = vehicle.get("seguro", {})
    if seguro and seguro.get("data_validade"):
        try:
            validade_date = datetime.fromisoformat(seguro.get("data_validade")).date()
            interventions.append({
                "id": f"seguro_{vehicle_id}",
                "tipo": "Seguro",
                "descricao": f"Renovação de Seguro - {seguro.get('seguradora', 'N/A')}",
                "data": seguro.get("data_validade"),
                "categoria": "seguro",
                "status": "pending" if validade_date >= today else "completed",
                "criado_por": seguro.get("criado_por"),
                "editado_por": seguro.get("editado_por")
            })
        except:
            pass
    
    # Add inspection interventions
    inspection = vehicle.get("inspection", {})
    if inspection:
        if inspection.get("data_inspecao"):
            interventions.append({
                "tipo": "Inspeção",
                "descricao": "Inspeção realizada",
                "data": inspection.get("data_inspecao"),
                "categoria": "inspecao",
                "status": "completed"
            })
        if inspection.get("proxima_inspecao"):
            try:
                proxima_date = datetime.fromisoformat(inspection.get("proxima_inspecao")).date()
                interventions.append({
                    "tipo": "Inspeção",
                    "descricao": "Próxima Inspeção",
                    "data": inspection.get("proxima_inspecao"),
                    "categoria": "inspecao",
                    "status": "pending" if proxima_date >= today else "completed"
                })
            except:
                pass
    
    # Add fire extinguisher interventions
    extintor = vehicle.get("extintor", {})
    if extintor:
        if extintor.get("data_instalacao") or extintor.get("data_entrega"):
            data_inst = extintor.get("data_instalacao") or extintor.get("data_entrega")
            interventions.append({
                "tipo": "Extintor",
                "descricao": "Instalação do Extintor",
                "data": data_inst,
                "categoria": "extintor",
                "status": "completed"
            })
        if extintor.get("data_validade"):
            try:
                validade_date = datetime.fromisoformat(extintor.get("data_validade")).date()
                interventions.append({
                    "tipo": "Extintor",
                    "descricao": "Validade do Extintor",
                    "data": extintor.get("data_validade"),
                    "categoria": "extintor",
                    "status": "pending" if validade_date >= today else "completed"
                })
            except:
                pass
    
    # Add maintenance interventions
    manutencoes = vehicle.get("manutencoes", [])
    for manutencao in manutencoes:
        if manutencao.get("data_intervencao"):
            interventions.append({
                "tipo": "Revisão",
                "descricao": f"{manutencao.get('tipo_manutencao', 'Manutenção')} - {manutencao.get('descricao', '')}",
                "data": manutencao.get("data_intervencao"),
                "km": manutencao.get("km_intervencao"),
                "categoria": "revisao",
                "status": "completed"
            })
        if manutencao.get("data_proxima"):
            try:
                proxima_date = datetime.fromisoformat(manutencao.get("data_proxima")).date()
                interventions.append({
                    "tipo": "Revisão",
                    "descricao": f"Próxima {manutencao.get('tipo_manutencao', 'Manutenção')} - {manutencao.get('o_que_fazer', '')}",
                    "data": manutencao.get("data_proxima"),
                    "km": manutencao.get("km_proxima"),
                    "categoria": "revisao",
                    "status": "pending" if proxima_date >= today else "completed"
                })
            except:
                pass
    
    interventions.sort(key=lambda x: x.get("data", ""), reverse=True)
    
    return {
        "vehicle_id": vehicle_id,
        "interventions": interventions,
        "total": len(interventions)
    }


@router.put("/{vehicle_id}/intervencao/{intervencao_id}")
async def update_vehicle_intervention(
    vehicle_id: str,
    intervencao_id: str,
    update_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update intervention status"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    new_status = update_data.get("status")
    user_name = current_user.get("name", current_user.get("email"))
    
    if intervencao_id.startswith("seguro_"):
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {
                "seguro.status": new_status,
                "seguro.editado_por": user_name,
                "seguro.editado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
    elif intervencao_id.startswith("inspecao_"):
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {
                "inspection.status": new_status,
                "inspection.editado_por": user_name,
                "inspection.editado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
    elif intervencao_id.startswith("extintor_"):
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {
                "extintor.status": new_status,
                "extintor.editado_por": user_name,
                "extintor.editado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {"message": "Intervention updated successfully"}


@router.get("/proximas-datas/dashboard")
async def get_proximas_datas_dashboard(current_user: Dict = Depends(get_current_user)):
    """Get dashboard with upcoming dates for all vehicles"""
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    elif current_user["role"] == UserRole.GESTAO:
        parceiros_ids = current_user.get("parceiros_atribuidos", [])
        if parceiros_ids:
            query["parceiro_id"] = {"$in": parceiros_ids}
    
    vehicles = await db.vehicles.find(query, {"_id": 0}).to_list(1000)
    
    proximas_datas = []
    today = datetime.now(timezone.utc).date()
    
    for vehicle in vehicles:
        vehicle_info = {
            "vehicle_id": vehicle["id"],
            "matricula": vehicle.get("matricula"),
            "marca": vehicle.get("marca"),
            "modelo": vehicle.get("modelo")
        }
        
        # Check inspection
        if vehicle.get("inspection", {}).get("proxima_inspecao"):
            try:
                proxima = datetime.fromisoformat(vehicle["inspection"]["proxima_inspecao"]).date()
                dias_restantes = (proxima - today).days
                if dias_restantes <= 60:
                    proximas_datas.append({
                        **vehicle_info,
                        "tipo": "inspecao",
                        "data": vehicle["inspection"]["proxima_inspecao"],
                        "dias_restantes": dias_restantes,
                        "urgente": dias_restantes <= 15
                    })
            except:
                pass
        
        # Check insurance
        if vehicle.get("insurance", {}).get("data_validade"):
            try:
                validade = datetime.fromisoformat(vehicle["insurance"]["data_validade"]).date()
                dias_restantes = (validade - today).days
                if dias_restantes <= 60:
                    proximas_datas.append({
                        **vehicle_info,
                        "tipo": "seguro",
                        "data": vehicle["insurance"]["data_validade"],
                        "dias_restantes": dias_restantes,
                        "urgente": dias_restantes <= 15
                    })
            except:
                pass
        
        # Check extintor
        if vehicle.get("extintor", {}).get("data_validade"):
            try:
                validade = datetime.fromisoformat(vehicle["extintor"]["data_validade"]).date()
                dias_restantes = (validade - today).days
                if dias_restantes <= 60:
                    proximas_datas.append({
                        **vehicle_info,
                        "tipo": "extintor",
                        "data": vehicle["extintor"]["data_validade"],
                        "dias_restantes": dias_restantes,
                        "urgente": dias_restantes <= 15
                    })
            except:
                pass
    
    proximas_datas.sort(key=lambda x: x.get("dias_restantes", 999))
    
    return {
        "proximas_datas": proximas_datas,
        "total": len(proximas_datas),
        "urgentes": len([d for d in proximas_datas if d.get("urgente")])
    }


# ==================== VEHICLE VISTORIAS ====================

@router.post("/{vehicle_id}/vistorias")
async def create_vistoria(
    vehicle_id: str,
    vistoria_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Create a new vehicle vistoria/inspection"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vistoria_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    vistoria = {
        "id": vistoria_id,
        "veiculo_id": vehicle_id,
        "parceiro_id": vistoria_data.get("parceiro_id"),
        "data_vistoria": vistoria_data.get("data_vistoria", now.isoformat()),
        "tipo": vistoria_data.get("tipo", "periodica"),
        "km_veiculo": vistoria_data.get("km_veiculo"),
        "responsavel_nome": current_user.get("name"),
        "responsavel_id": current_user.get("id"),
        "observacoes": vistoria_data.get("observacoes"),
        "estado_geral": vistoria_data.get("estado_geral", "bom"),
        "status": vistoria_data.get("status", "fechada"),
        "fotos": vistoria_data.get("fotos", []),
        "itens_verificados": vistoria_data.get("itens_verificados", {}),
        "danos_encontrados": vistoria_data.get("danos_encontrados", []),
        "pdf_relatorio": None,
        "assinatura_responsavel": vistoria_data.get("assinatura_responsavel"),
        "assinatura_motorista": vistoria_data.get("assinatura_motorista"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.vistorias.insert_one(vistoria)
    
    if vistoria_data.get("proxima_vistoria"):
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {"proxima_vistoria": vistoria_data.get("proxima_vistoria")}}
        )
    
    return {"message": "Vistoria created successfully", "vistoria_id": vistoria_id}


@router.get("/{vehicle_id}/vistorias")
async def get_vehicle_vistorias(
    vehicle_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get all vistorias for a vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vistorias = await db.vistorias.find(
        {"veiculo_id": vehicle_id},
        {"_id": 0}
    ).sort("data_vistoria", -1).to_list(100)
    
    return vistorias


@router.get("/{vehicle_id}/vistorias/{vistoria_id}")
async def get_vistoria(
    vehicle_id: str,
    vistoria_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get a specific vistoria"""
    vistoria = await db.vistorias.find_one(
        {"id": vistoria_id, "veiculo_id": vehicle_id},
        {"_id": 0}
    )
    
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    return vistoria


@router.put("/{vehicle_id}/vistorias/{vistoria_id}")
async def update_vistoria(
    vehicle_id: str,
    vistoria_id: str,
    update_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update a vistoria"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.vistorias.update_one(
        {"id": vistoria_id, "veiculo_id": vehicle_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    return {"message": "Vistoria updated successfully"}


@router.delete("/{vehicle_id}/vistorias/{vistoria_id}")
async def delete_vistoria(
    vehicle_id: str,
    vistoria_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a vistoria"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.vistorias.delete_one({"id": vistoria_id, "veiculo_id": vehicle_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    return {"message": "Vistoria deleted successfully"}


@router.post("/{vehicle_id}/vistorias/{vistoria_id}/upload-foto")
async def upload_vistoria_foto(
    vehicle_id: str,
    vistoria_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload a photo for a vistoria"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vistoria = await db.vistorias.find_one({"id": vistoria_id, "veiculo_id": vehicle_id}, {"_id": 0})
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    try:
        vistorias_dir = UPLOAD_DIR / "vistorias" / vehicle_id
        vistorias_dir.mkdir(parents=True, exist_ok=True)
        
        file_id = f"vistoria_{vistoria_id}_{uuid.uuid4()}"
        file_info = await process_uploaded_file(file, vistorias_dir, file_id)
        
        photo_url = file_info.get("pdf_path") or file_info.get("original_path")
        
        await db.vistorias.update_one(
            {"id": vistoria_id},
            {"$push": {"fotos": photo_url}, "$set": {"updated_at": datetime.now(timezone.utc)}}
        )
        
        return {"message": "Photo uploaded successfully", "photo_url": photo_url}
    
    except Exception as e:
        logger.error(f"Error uploading vistoria photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{vehicle_id}/agendar-vistoria")
async def agendar_vistoria(
    vehicle_id: str,
    agendamento: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Schedule a future inspection for a vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        agenda_item = {
            "id": str(uuid.uuid4()),
            "tipo": "vistoria",
            "data_agendada": agendamento.get("data_agendada"),
            "hora_agendada": agendamento.get("hora_agendada"),
            "tipo_vistoria": agendamento.get("tipo_vistoria", "periodica"),
            "notas": agendamento.get("notas", ""),
            "parceiro_id": agendamento.get("parceiro_id"),
            "status": "agendada",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user["id"]
        }
        
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$push": {"agenda": agenda_item}}
        )
        
        logger.info(f"Inspection scheduled for vehicle {vehicle_id} on {agenda_item['data_agendada']}")
        return {"message": "Vistoria agendada com sucesso", "agenda_item": agenda_item}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scheduling inspection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CONTRATOS ASSINADOS ====================

@router.post("/{vehicle_id}/upload-contrato")
async def upload_contrato_veiculo(
    vehicle_id: str,
    file: UploadFile = File(...),
    tipo: str = Form("contrato_veiculo"),
    motorista_id: Optional[str] = Form(None),
    current_user: Dict = Depends(get_current_user)
):
    """
    Upload de contrato assinado para o veículo
    
    Form data:
    - file: PDF do contrato assinado
    - tipo: Tipo do contrato (contrato_veiculo, contrato_aluguer, etc.)
    - motorista_id: ID do motorista associado (opcional)
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Verificar permissão de parceiro
    if current_user["role"] == UserRole.PARCEIRO and vehicle.get("parceiro_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to modify this vehicle")
    
    try:
        contratos_dir = UPLOAD_DIR / "contratos" / vehicle_id
        contratos_dir.mkdir(parents=True, exist_ok=True)
        
        file_id = f"contrato_{vehicle_id}_{uuid.uuid4()}"
        file_info = await process_uploaded_file(file, contratos_dir, file_id)
        
        documento_url = file_info.get("pdf_path") or file_info.get("original_path")
        now = datetime.now(timezone.utc)
        
        # Buscar nome do motorista se fornecido
        motorista_nome = None
        if motorista_id:
            motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0, "name": 1})
            if motorista:
                motorista_nome = motorista.get("name")
        
        # Criar registo do contrato
        contrato = {
            "id": str(uuid.uuid4()),
            "tipo": tipo,
            "documento_url": documento_url,
            "motorista_id": motorista_id or vehicle.get("motorista_atribuido"),
            "motorista_nome": motorista_nome or vehicle.get("motorista_atribuido_nome"),
            "assinado_motorista": True,
            "assinado_parceiro": True,
            "data": now.isoformat(),
            "uploaded_by": current_user["id"],
            "uploaded_at": now.isoformat()
        }
        
        # Adicionar contrato à lista de contratos do veículo
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {
                "$push": {"contratos": contrato},
                "$set": {"updated_at": now.isoformat()}
            }
        )
        
        logger.info(f"✅ Contrato carregado para veículo {vehicle.get('matricula')}: {tipo}")
        
        return {
            "message": "Contrato carregado com sucesso",
            "contrato": contrato
        }
    
    except Exception as e:
        logger.error(f"Error uploading contract: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{vehicle_id}/contratos")
async def get_contratos_veiculo(
    vehicle_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Obter lista de contratos do veículo
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Verificar permissão de parceiro
    if current_user["role"] == UserRole.PARCEIRO and vehicle.get("parceiro_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this vehicle's contracts")
    
    contratos = vehicle.get("contratos", [])
    
    return {
        "veiculo_id": vehicle_id,
        "matricula": vehicle.get("matricula"),
        "contratos": contratos,
        "total": len(contratos)
    }


@router.delete("/{vehicle_id}/contratos/{contrato_id}")
async def delete_contrato_veiculo(
    vehicle_id: str,
    contrato_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Eliminar contrato do veículo
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$pull": {"contratos": {"id": contrato_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    return {"message": "Contrato eliminado com sucesso"}
