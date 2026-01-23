"""Configurações do Sistema - Routes"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from datetime import datetime, timezone
import logging

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/configuracoes", tags=["configuracoes"])
# Router adicional para compatibilidade com endpoints legados
router_legacy = APIRouter(prefix="/configuracao", tags=["configuracao"])

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


# ==================== MAPEAMENTO DE CAMPOS ====================

async def _obter_mapeamento_campos(current_user: dict):
    """Função interna para obter mapeamento de campos"""
    if current_user['role'] not in ['admin', 'gestao']:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    config = await db.configuracoes.find_one(
        {'tipo': 'mapeamento_campos'},
        {'_id': 0}
    )
    
    return config.get('mapeamentos', {}) if config else {}


async def _salvar_mapeamento_campos(mapeamentos: Dict[str, Any], current_user: dict):
    """Função interna para salvar mapeamento de campos"""
    if current_user['role'] not in ['admin', 'gestao']:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    await db.configuracoes.update_one(
        {'tipo': 'mapeamento_campos'},
        {'$set': {
            'tipo': 'mapeamento_campos',
            'mapeamentos': mapeamentos,
            'updated_at': datetime.now(timezone.utc),
            'updated_by': current_user['id']
        }},
        upsert=True
    )
    
    return {'success': True, 'message': 'Mapeamento salvo com sucesso'}


@router.get("/mapeamento-campos")
async def obter_mapeamento_campos(current_user: dict = Depends(get_current_user)):
    """Obtém configuração de mapeamento de campos para importação"""
    try:
        return await _obter_mapeamento_campos(current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter mapeamento: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router_legacy.get("/mapeamento-campos")
async def obter_mapeamento_campos_legacy(current_user: dict = Depends(get_current_user)):
    """Obtém configuração de mapeamento de campos (endpoint legado)"""
    try:
        return await _obter_mapeamento_campos(current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter mapeamento: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mapeamento-campos")
async def salvar_mapeamento_campos(
    mapeamentos: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Salva configuração de mapeamento de campos"""
    try:
        return await _salvar_mapeamento_campos(mapeamentos, current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao salvar mapeamento: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router_legacy.post("/mapeamento-campos")
async def salvar_mapeamento_campos_legacy(
    mapeamentos: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Salva configuração de mapeamento de campos (endpoint legado)"""
    try:
        return await _salvar_mapeamento_campos(mapeamentos, current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao salvar mapeamento: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SINCRONIZAÇÃO AUTOMÁTICA ====================

async def _obter_config_sincronizacao(current_user: dict):
    """Função interna para obter config de sincronização"""
    if current_user['role'] not in ['admin', 'gestao']:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    config = await db.configuracoes.find_one(
        {'tipo': 'sincronizacao_auto'},
        {'_id': 0}
    )
    
    return config.get('plataformas', {}) if config else {}


async def _salvar_config_sincronizacao(config: Dict[str, Any], current_user: dict):
    """Função interna para salvar config de sincronização"""
    if current_user['role'] not in ['admin', 'gestao']:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    await db.configuracoes.update_one(
        {'tipo': 'sincronizacao_auto'},
        {'$set': {
            'tipo': 'sincronizacao_auto',
            'plataformas': config,
            'updated_at': datetime.now(timezone.utc),
            'updated_by': current_user['id']
        }},
        upsert=True
    )
    
    return {'success': True, 'message': 'Configuração salva com sucesso'}


@router.get("/sincronizacao-auto")
async def obter_config_sincronizacao(current_user: dict = Depends(get_current_user)):
    """Obtém configuração de sincronização automática"""
    try:
        return await _obter_config_sincronizacao(current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter config sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router_legacy.get("/sincronizacao-auto")
async def obter_config_sincronizacao_legacy(current_user: dict = Depends(get_current_user)):
    """Obtém configuração de sincronização automática (endpoint legado)"""
    try:
        return await _obter_config_sincronizacao(current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter config sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sincronizacao-auto")
async def salvar_config_sincronizacao(
    config: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Salva configuração de sincronização automática"""
    try:
        return await _salvar_config_sincronizacao(config, current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao salvar config sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router_legacy.post("/sincronizacao-auto")
async def salvar_config_sincronizacao_legacy(
    config: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Salva configuração de sincronização automática (endpoint legado)"""
    try:
        return await _salvar_config_sincronizacao(config, current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao salvar config sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))
