"""Admin routes for FleeTrack application"""

from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Dict, Any, List
from datetime import datetime, timezone
import logging

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])
db = get_database()


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


@router.get("/settings")
async def get_admin_settings(current_user: dict = Depends(get_current_user)):
    """Obtém configurações do admin"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    if not settings:
        settings = {
            "id": "admin_settings",
            "anos_validade_matricula": 20,
            "km_aviso_manutencao": 5000
        }
    return settings


@router.put("/settings")
async def update_admin_settings(
    settings: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Atualiza configurações do admin"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    settings["updated_at"] = datetime.now(timezone.utc)
    settings["updated_by"] = current_user["id"]
    
    await db.admin_settings.update_one(
        {"id": "admin_settings"},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Configurações atualizadas com sucesso"}


@router.get("/config/textos-legais")
async def get_textos_legais(current_user: dict = Depends(get_current_user)):
    """Obtém textos legais (termos, privacidade, etc)"""
    config = await db.configuracoes.find_one({"tipo": "textos_legais"}, {"_id": 0})
    return config or {}


@router.put("/config/textos-legais")
async def update_textos_legais(
    textos: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Atualiza textos legais"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.configuracoes.update_one(
        {"tipo": "textos_legais"},
        {"$set": {
            "tipo": "textos_legais",
            **textos,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"message": "Textos legais atualizados"}


@router.put("/config/comunicacoes")
async def update_config_comunicacoes(
    config: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Atualiza configurações de comunicações"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.configuracoes.update_one(
        {"tipo": "comunicacoes"},
        {"$set": {
            "tipo": "comunicacoes",
            **config,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"message": "Configurações de comunicações atualizadas"}


@router.put("/config/integracoes")
async def update_config_integracoes(
    config: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Atualiza configurações de integrações"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.configuracoes.update_one(
        {"tipo": "integracoes"},
        {"$set": {
            "tipo": "integracoes",
            **config,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"message": "Configurações de integrações atualizadas"}


@router.get("/credenciais-parceiros")
async def get_credenciais_parceiros(current_user: dict = Depends(get_current_user)):
    """Obtém todas as credenciais de parceiros (apenas admin)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    credenciais = await db.credenciais_plataforma.find({}, {"_id": 0}).to_list(None)
    
    # Adicionar info do parceiro
    for cred in credenciais:
        parceiro = await db.parceiros.find_one(
            {"id": cred.get("parceiro_id")},
            {"_id": 0, "nome_empresa": 1, "email": 1}
        )
        if not parceiro:
            parceiro = await db.users.find_one(
                {"id": cred.get("parceiro_id")},
                {"_id": 0, "name": 1, "email": 1}
            )
        cred["parceiro_info"] = parceiro
    
    return credenciais


@router.post("/corrigir-caminhos-fotos")
async def corrigir_caminhos_fotos(current_user: dict = Depends(get_current_user)):
    """Corrige caminhos de fotos nos veículos - adiciona / inicial se necessário"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    corrigidos = 0
    
    # Corrigir veículos
    vehicles = await db.vehicles.find({"fotos_veiculo": {"$exists": True, "$ne": []}}).to_list(None)
    
    for vehicle in vehicles:
        fotos = vehicle.get("fotos_veiculo", [])
        fotos_corrigidas = []
        alterado = False
        
        for foto in fotos:
            if foto and not foto.startswith("/") and not foto.startswith("http"):
                fotos_corrigidas.append("/" + foto)
                alterado = True
            else:
                fotos_corrigidas.append(foto)
        
        if alterado:
            await db.vehicles.update_one(
                {"id": vehicle["id"]},
                {"$set": {"fotos_veiculo": fotos_corrigidas}}
            )
            corrigidos += 1
    
    # Corrigir campo fotos também (legacy)
    vehicles_fotos = await db.vehicles.find({"fotos": {"$exists": True, "$ne": []}}).to_list(None)
    
    for vehicle in vehicles_fotos:
        fotos = vehicle.get("fotos", [])
        fotos_corrigidas = []
        alterado = False
        
        for foto in fotos:
            if foto and not foto.startswith("/") and not foto.startswith("http"):
                fotos_corrigidas.append("/" + foto)
                alterado = True
            else:
                fotos_corrigidas.append(foto)
        
        if alterado:
            await db.vehicles.update_one(
                {"id": vehicle["id"]},
                {"$set": {"fotos": fotos_corrigidas}}
            )
            corrigidos += 1
    
    return {"message": f"Corrigidos {corrigidos} veículos", "total_corrigidos": corrigidos}


@router.post("/reindexar-fotos-veiculos")
async def reindexar_fotos_veiculos(current_user: dict = Depends(get_current_user)):
    """Reindexa fotos dos veículos baseado nos ficheiros existentes"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas admin")
    
    import os
    from pathlib import Path
    
    upload_dir = Path("/app/backend/uploads/vehicle_photos_info")
    
    if not upload_dir.exists():
        return {"message": "Directório de uploads não existe", "total_atualizados": 0}
    
    # Mapear ficheiros por vehicle_id
    files_by_vehicle = {}
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    
    for file in os.listdir(upload_dir):
        file_path = upload_dir / file
        if not file_path.is_file():
            continue
        
        # Extrair vehicle_id do nome: photo_{vehicle_id}_{uuid}...
        parts = file.split('_')
        if len(parts) >= 3 and parts[0] == 'photo':
            vehicle_id = parts[1]
            file_lower = file.lower()
            
            # Preferir originais e imagens sobre PDFs
            is_original = '_original' in file_lower
            is_image = any(file_lower.endswith(ext) for ext in image_extensions)
            
            if vehicle_id not in files_by_vehicle:
                files_by_vehicle[vehicle_id] = []
            
            # Adicionar apenas imagens, não PDFs
            if is_image:
                files_by_vehicle[vehicle_id].append({
                    'path': f"/uploads/vehicle_photos_info/{file}",
                    'is_original': is_original,
                    'size': file_path.stat().st_size
                })
    
    # Atualizar veículos
    atualizados = 0
    
    for vehicle_id, photos in files_by_vehicle.items():
        # Filtrar fotos muito pequenas (menos de 1KB provavelmente corrompidas)
        valid_photos = [p for p in photos if p['size'] > 1024]
        
        # Ordenar: originais primeiro, depois por tamanho
        valid_photos.sort(key=lambda x: (not x['is_original'], -x['size']))
        
        photo_paths = [p['path'] for p in valid_photos[:3]]  # Máximo 3 fotos
        
        if photo_paths:
            result = await db.vehicles.update_one(
                {"id": vehicle_id},
                {"$set": {"fotos_veiculo": photo_paths}}
            )
            if result.modified_count > 0:
                atualizados += 1
    
    return {
        "message": f"Reindexadas fotos de {atualizados} veículos",
        "total_atualizados": atualizados,
        "veiculos_com_fotos": list(files_by_vehicle.keys())
    }
