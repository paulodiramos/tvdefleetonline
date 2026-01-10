"""Configurações do Sistema - Routes"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from datetime import datetime, timezone
import logging

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/configuracoes", tags=["configuracoes"])

db = get_database()


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== CATEGORIAS DE PLATAFORMAS ====================

@router.post("/categorias-plataformas")
async def save_categorias_plataformas(
    config_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Save platform categories configuration (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can configure categories")
    
    try:
        plataforma = config_data.get("plataforma")  # 'uber' ou 'bolt'
        categorias = config_data.get("categorias", [])
        
        if not plataforma or not categorias:
            raise HTTPException(status_code=400, detail="Platform and categories are required")
        
        # Update or create config
        await db.configuracoes_sistema.update_one(
            {"tipo": f"categorias_{plataforma}"},
            {
                "$set": {
                    "tipo": f"categorias_{plataforma}",
                    "categorias": categorias,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "updated_by": current_user["id"]
                }
            },
            upsert=True
        )
        
        logger.info(f"{plataforma.capitalize()} categories updated by {current_user['email']}")
        return {"message": f"{plataforma.capitalize()} categories saved successfully"}
        
    except Exception as e:
        logger.error(f"Error saving platform categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categorias-plataformas")
async def get_categorias_plataformas(current_user: Dict = Depends(get_current_user)):
    """Get platform categories configuration"""
    try:
        # Default categories
        default_uber = [
            "UberX", "Share", "Electric", "Black", "Comfort",
            "XL", "XXL", "Pet", "Package"
        ]
        
        default_bolt = [
            "Economy", "Comfort", "Executive", "XL", "Green",
            "XXL", "Motorista Privado", "Pet"
        ]
        
        # Fetch custom categories
        uber_config = await db.configuracoes_sistema.find_one(
            {"tipo": "categorias_uber"},
            {"_id": 0}
        )
        
        bolt_config = await db.configuracoes_sistema.find_one(
            {"tipo": "categorias_bolt"},
            {"_id": 0}
        )
        
        return {
            "uber": uber_config.get("categorias") if uber_config else default_uber,
            "bolt": bolt_config.get("categorias") if bolt_config else default_bolt
        }
        
    except Exception as e:
        logger.error(f"Error getting platform categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== OUTRAS CONFIGURAÇÕES ====================

@router.get("/geral")
async def get_configuracoes_gerais(current_user: Dict = Depends(get_current_user)):
    """Get general system configurations"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can view configurations")
    
    configs = await db.configuracoes_sistema.find({}, {"_id": 0}).to_list(100)
    return configs


@router.put("/geral/{config_tipo}")
async def update_configuracao_geral(
    config_tipo: str,
    config_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update a general system configuration"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can update configurations")
    
    await db.configuracoes_sistema.update_one(
        {"tipo": config_tipo},
        {
            "$set": {
                **config_data,
                "tipo": config_tipo,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user["id"]
            }
        },
        upsert=True
    )
    
    return {"message": f"Configuration {config_tipo} updated successfully"}
