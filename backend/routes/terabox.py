"""Terabox - File Storage System for Partners"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging
import os
import shutil
import mimetypes
from pathlib import Path

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)

# Base directory for Terabox storage
TERABOX_BASE = "/app/backend/uploads/terabox"
os.makedirs(TERABOX_BASE, exist_ok=True)


class PastaCreate(BaseModel):
    """Model for creating a folder"""
    nome: str
    descricao: Optional[str] = None
    pasta_pai_id: Optional[str] = None


class FicheiroMove(BaseModel):
    """Model for moving a file"""
    pasta_destino_id: str


class FicheiroRename(BaseModel):
    """Model for renaming a file"""
    novo_nome: str


# ==================== UTILITY FUNCTIONS ====================

def get_parceiro_path(parceiro_id: str) -> str:
    """Get the storage path for a parceiro"""
    path = os.path.join(TERABOX_BASE, parceiro_id)
    os.makedirs(path, exist_ok=True)
    return path


def get_file_size_formatted(size_bytes: int) -> str:
    """Format file size to human readable"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def get_mime_type(filename: str) -> str:
    """Get MIME type from filename"""
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/octet-stream"


async def get_pasta_path(parceiro_id: str, pasta_id: str) -> str:
    """Get the full path for a pasta"""
    if not pasta_id or pasta_id == "root":
        return get_parceiro_path(parceiro_id)
    
    pasta = await db.terabox_pastas.find_one({"id": pasta_id, "parceiro_id": parceiro_id})
    if not pasta:
        raise HTTPException(status_code=404, detail="Pasta não encontrada")
    
    return pasta.get("caminho_completo", get_parceiro_path(parceiro_id))


# ==================== STORAGE STATS ====================

@router.get("/terabox/stats")
async def get_terabox_stats(current_user: Dict = Depends(get_current_user)):
    """Get storage statistics for current user/parceiro"""
    if current_user["role"] == UserRole.PARCEIRO:
        parceiro_id = current_user["id"]
    elif current_user["role"] in [UserRole.ADMIN, UserRole.GESTAO]:
        parceiro_id = None  # Admin sees all
    else:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {"parceiro_id": parceiro_id} if parceiro_id else {}
    
    # Count files and folders
    total_ficheiros = await db.terabox_ficheiros.count_documents(query)
    total_pastas = await db.terabox_pastas.count_documents(query)
    
    # Calculate total size
    pipeline = [
        {"$match": query},
        {"$group": {"_id": None, "total_size": {"$sum": "$tamanho"}}}
    ]
    
    size_result = await db.terabox_ficheiros.aggregate(pipeline).to_list(1)
    total_size = size_result[0]["total_size"] if size_result else 0
    
    # Get recent files
    recent_files = await db.terabox_ficheiros.find(
        query,
        {"_id": 0, "id": 1, "nome": 1, "tamanho": 1, "criado_em": 1}
    ).sort("criado_em", -1).limit(5).to_list(5)
    
    return {
        "total_ficheiros": total_ficheiros,
        "total_pastas": total_pastas,
        "espaco_usado": total_size,
        "espaco_usado_formatado": get_file_size_formatted(total_size),
        "ficheiros_recentes": recent_files
    }


# ==================== PASTA (FOLDER) MANAGEMENT ====================

@router.get("/terabox/pastas")
async def listar_pastas(
    pasta_pai_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List folders for current parceiro"""
    if current_user["role"] == UserRole.PARCEIRO:
        parceiro_id = current_user["id"]
    elif current_user["role"] in [UserRole.ADMIN, UserRole.GESTAO]:
        parceiro_id = None
    else:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {}
    if parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    if pasta_pai_id:
        query["pasta_pai_id"] = pasta_pai_id
    else:
        query["pasta_pai_id"] = None  # Root folders
    
    pastas = await db.terabox_pastas.find(
        query,
        {"_id": 0}
    ).sort("nome", 1).to_list(500)
    
    return pastas


@router.post("/terabox/pastas")
async def criar_pasta(
    pasta: PastaCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new folder"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else current_user.get("parceiro_id", current_user["id"])
    
    pasta_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Build full path
    base_path = get_parceiro_path(parceiro_id)
    
    if pasta.pasta_pai_id:
        pasta_pai = await db.terabox_pastas.find_one({"id": pasta.pasta_pai_id})
        if pasta_pai:
            base_path = pasta_pai.get("caminho_completo", base_path)
    
    caminho_completo = os.path.join(base_path, pasta.nome)
    
    # Create physical folder
    os.makedirs(caminho_completo, exist_ok=True)
    
    pasta_doc = {
        "id": pasta_id,
        "parceiro_id": parceiro_id,
        "nome": pasta.nome,
        "descricao": pasta.descricao,
        "pasta_pai_id": pasta.pasta_pai_id,
        "caminho_completo": caminho_completo,
        "criado_por": current_user["id"],
        "criado_em": now
    }
    
    await db.terabox_pastas.insert_one(pasta_doc)
    
    logger.info(f"Terabox folder created: {pasta.nome} for parceiro {parceiro_id}")
    return {"id": pasta_id, "message": "Pasta criada com sucesso", "caminho": caminho_completo}


@router.delete("/terabox/pastas/{pasta_id}")
async def eliminar_pasta(
    pasta_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a folder and all its contents"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    pasta = await db.terabox_pastas.find_one({"id": pasta_id})
    if not pasta:
        raise HTTPException(status_code=404, detail="Pasta não encontrada")
    
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO and pasta["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Delete physical folder
    caminho = pasta.get("caminho_completo")
    if caminho and os.path.exists(caminho):
        shutil.rmtree(caminho, ignore_errors=True)
    
    # Delete subfolders from DB
    await db.terabox_pastas.delete_many({"caminho_completo": {"$regex": f"^{caminho}"}})
    
    # Delete files in folder from DB
    await db.terabox_ficheiros.delete_many({"pasta_id": pasta_id})
    
    # Delete the folder itself
    await db.terabox_pastas.delete_one({"id": pasta_id})
    
    logger.info(f"Terabox folder deleted: {pasta_id}")
    return {"message": "Pasta eliminada com sucesso"}


# ==================== FILE UPLOAD ====================

@router.post("/terabox/upload")
async def upload_ficheiro(
    file: UploadFile = File(...),
    pasta_id: Optional[str] = Form(None),
    descricao: Optional[str] = Form(None),
    categoria: Optional[str] = Form(None),
    entidade_tipo: Optional[str] = Form(None),
    entidade_id: Optional[str] = Form(None),
    current_user: Dict = Depends(get_current_user)
):
    """Upload a file to Terabox"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else current_user.get("parceiro_id", current_user["id"])
    
    try:
        ficheiro_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Determine destination path
        if pasta_id and pasta_id != "root":
            dest_path = await get_pasta_path(parceiro_id, pasta_id)
        else:
            dest_path = get_parceiro_path(parceiro_id)
        
        # Create safe filename
        original_name = file.filename
        ext = os.path.splitext(original_name)[1]
        safe_name = f"{ficheiro_id}{ext}"
        
        filepath = os.path.join(dest_path, safe_name)
        
        # Save file
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        
        tamanho = len(content)
        
        # Save to database
        ficheiro_doc = {
            "id": ficheiro_id,
            "parceiro_id": parceiro_id,
            "pasta_id": pasta_id if pasta_id != "root" else None,
            "nome": original_name,
            "nome_ficheiro": safe_name,
            "caminho_completo": filepath,
            "tamanho": tamanho,
            "tamanho_formatado": get_file_size_formatted(tamanho),
            "mime_type": get_mime_type(original_name),
            "descricao": descricao,
            "categoria": categoria,
            "entidade_tipo": entidade_tipo,
            "entidade_id": entidade_id,
            "criado_por": current_user["id"],
            "criado_em": now,
            "downloads": 0
        }
        
        await db.terabox_ficheiros.insert_one(ficheiro_doc)
        
        logger.info(f"Terabox file uploaded: {original_name} ({get_file_size_formatted(tamanho)})")
        
        return {
            "id": ficheiro_id,
            "nome": original_name,
            "tamanho": tamanho,
            "tamanho_formatado": get_file_size_formatted(tamanho),
            "message": "Ficheiro carregado com sucesso"
        }
    
    except Exception as e:
        logger.error(f"Terabox upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/terabox/upload-multiplo")
async def upload_multiplos_ficheiros(
    files: List[UploadFile] = File(...),
    pasta_id: Optional[str] = Form(None),
    current_user: Dict = Depends(get_current_user)
):
    """Upload multiple files at once"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    resultados = []
    total_size = 0
    
    for file in files:
        try:
            # Reuse single upload logic
            result = await upload_ficheiro(
                file=file,
                pasta_id=pasta_id,
                descricao=None,
                categoria=None,
                entidade_tipo=None,
                entidade_id=None,
                current_user=current_user
            )
            resultados.append({"nome": file.filename, "success": True, "id": result["id"]})
            total_size += result["tamanho"]
        except Exception as e:
            resultados.append({"nome": file.filename, "success": False, "error": str(e)})
    
    sucessos = sum(1 for r in resultados if r["success"])
    
    return {
        "message": f"{sucessos}/{len(files)} ficheiros carregados",
        "total_size": get_file_size_formatted(total_size),
        "resultados": resultados
    }


# ==================== FILE LISTING ====================

@router.get("/terabox/ficheiros")
async def listar_ficheiros(
    pasta_id: Optional[str] = None,
    categoria: Optional[str] = None,
    entidade_tipo: Optional[str] = None,
    entidade_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List files in Terabox"""
    if current_user["role"] == UserRole.PARCEIRO:
        parceiro_id = current_user["id"]
    elif current_user["role"] in [UserRole.ADMIN, UserRole.GESTAO]:
        parceiro_id = None
    else:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {}
    if parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    if pasta_id:
        query["pasta_id"] = pasta_id if pasta_id != "root" else None
    
    if categoria:
        query["categoria"] = categoria
    
    if entidade_tipo:
        query["entidade_tipo"] = entidade_tipo
    
    if entidade_id:
        query["entidade_id"] = entidade_id
    
    ficheiros = await db.terabox_ficheiros.find(
        query,
        {"_id": 0}
    ).sort("criado_em", -1).to_list(500)
    
    return ficheiros


@router.get("/terabox/ficheiros/{ficheiro_id}")
async def get_ficheiro_info(
    ficheiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get file information"""
    ficheiro = await db.terabox_ficheiros.find_one({"id": ficheiro_id}, {"_id": 0})
    
    if not ficheiro:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO and ficheiro["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    return ficheiro


# ==================== FILE DOWNLOAD ====================

@router.get("/terabox/download/{ficheiro_id}")
async def download_ficheiro(
    ficheiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Download a file from Terabox"""
    ficheiro = await db.terabox_ficheiros.find_one({"id": ficheiro_id})
    
    if not ficheiro:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO and ficheiro["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    caminho = ficheiro.get("caminho_completo")
    
    if not caminho or not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado no sistema")
    
    # Increment download counter
    await db.terabox_ficheiros.update_one(
        {"id": ficheiro_id},
        {"$inc": {"downloads": 1}}
    )
    
    return FileResponse(
        path=caminho,
        filename=ficheiro["nome"],
        media_type=ficheiro.get("mime_type", "application/octet-stream")
    )


@router.get("/terabox/preview/{ficheiro_id}")
async def preview_ficheiro(
    ficheiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get file preview/thumbnail"""
    ficheiro = await db.terabox_ficheiros.find_one({"id": ficheiro_id})
    
    if not ficheiro:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO and ficheiro["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    caminho = ficheiro.get("caminho_completo")
    mime_type = ficheiro.get("mime_type", "")
    
    if not caminho or not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    # Only allow preview for images and PDFs
    if mime_type.startswith("image/") or mime_type == "application/pdf":
        return FileResponse(
            path=caminho,
            media_type=mime_type
        )
    
    return {"message": "Preview não disponível para este tipo de ficheiro", "mime_type": mime_type}


# ==================== FILE OPERATIONS ====================

@router.put("/terabox/ficheiros/{ficheiro_id}/mover")
async def mover_ficheiro(
    ficheiro_id: str,
    data: FicheiroMove,
    current_user: Dict = Depends(get_current_user)
):
    """Move a file to another folder"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    ficheiro = await db.terabox_ficheiros.find_one({"id": ficheiro_id})
    if not ficheiro:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    if current_user["role"] == UserRole.PARCEIRO and ficheiro["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Get new destination path
    parceiro_id = ficheiro["parceiro_id"]
    nova_pasta_path = await get_pasta_path(parceiro_id, data.pasta_destino_id)
    
    # Move physical file
    old_path = ficheiro["caminho_completo"]
    new_path = os.path.join(nova_pasta_path, ficheiro["nome_ficheiro"])
    
    if os.path.exists(old_path):
        shutil.move(old_path, new_path)
    
    # Update database
    await db.terabox_ficheiros.update_one(
        {"id": ficheiro_id},
        {
            "$set": {
                "pasta_id": data.pasta_destino_id if data.pasta_destino_id != "root" else None,
                "caminho_completo": new_path
            }
        }
    )
    
    return {"message": "Ficheiro movido com sucesso"}


@router.put("/terabox/ficheiros/{ficheiro_id}/renomear")
async def renomear_ficheiro(
    ficheiro_id: str,
    data: FicheiroRename,
    current_user: Dict = Depends(get_current_user)
):
    """Rename a file"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    ficheiro = await db.terabox_ficheiros.find_one({"id": ficheiro_id})
    if not ficheiro:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    if current_user["role"] == UserRole.PARCEIRO and ficheiro["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    await db.terabox_ficheiros.update_one(
        {"id": ficheiro_id},
        {"$set": {"nome": data.novo_nome}}
    )
    
    return {"message": "Ficheiro renomeado com sucesso"}


@router.delete("/terabox/ficheiros/{ficheiro_id}")
async def eliminar_ficheiro(
    ficheiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a file"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    ficheiro = await db.terabox_ficheiros.find_one({"id": ficheiro_id})
    if not ficheiro:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    if current_user["role"] == UserRole.PARCEIRO and ficheiro["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Delete physical file
    caminho = ficheiro.get("caminho_completo")
    if caminho and os.path.exists(caminho):
        os.remove(caminho)
    
    # Delete from database
    await db.terabox_ficheiros.delete_one({"id": ficheiro_id})
    
    logger.info(f"Terabox file deleted: {ficheiro_id}")
    return {"message": "Ficheiro eliminado com sucesso"}


# ==================== SEARCH ====================

@router.get("/terabox/pesquisar")
async def pesquisar_ficheiros(
    q: str,
    current_user: Dict = Depends(get_current_user)
):
    """Search files by name"""
    if current_user["role"] == UserRole.PARCEIRO:
        parceiro_id = current_user["id"]
    elif current_user["role"] in [UserRole.ADMIN, UserRole.GESTAO]:
        parceiro_id = None
    else:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {"nome": {"$regex": q, "$options": "i"}}
    if parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    ficheiros = await db.terabox_ficheiros.find(
        query,
        {"_id": 0}
    ).limit(50).to_list(50)
    
    return ficheiros


# ==================== CATEGORIES ====================

@router.get("/terabox/categorias")
async def listar_categorias(current_user: Dict = Depends(get_current_user)):
    """List available file categories"""
    categorias = [
        {"id": "documentos_motorista", "nome": "Documentos de Motorista", "icon": "user"},
        {"id": "documentos_veiculo", "nome": "Documentos de Veículo", "icon": "car"},
        {"id": "contratos", "nome": "Contratos", "icon": "file-text"},
        {"id": "faturas", "nome": "Faturas", "icon": "receipt"},
        {"id": "recibos", "nome": "Recibos", "icon": "file-check"},
        {"id": "relatorios", "nome": "Relatórios", "icon": "bar-chart"},
        {"id": "comprovativos", "nome": "Comprovativos", "icon": "check-circle"},
        {"id": "outros", "nome": "Outros", "icon": "folder"}
    ]
    
    return categorias
