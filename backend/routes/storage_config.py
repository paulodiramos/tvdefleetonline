"""Storage Configuration - Per Partner Storage Settings
Allows each partner to choose their storage strategy:
- Local: Files stored on server only
- Cloud: Files stored on partner's cloud (Terabox/Drive/OneDrive/Dropbox)
- Both: Files stored locally AND synced to cloud
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone
from enum import Enum
import logging

from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter(prefix="/storage-config", tags=["storage-config"])
db = get_database()
logger = logging.getLogger(__name__)


class StorageMode(str, Enum):
    LOCAL = "local"      # Files only on server
    CLOUD = "cloud"      # Files only on partner's cloud
    BOTH = "both"        # Files on server + synced to cloud


class CloudProvider(str, Enum):
    NONE = "none"
    TERABOX = "terabox"
    GOOGLE_DRIVE = "google_drive"
    ONEDRIVE = "onedrive"
    DROPBOX = "dropbox"


class StorageConfigUpdate(BaseModel):
    """Model for updating storage configuration"""
    modo: StorageMode = StorageMode.LOCAL
    cloud_provider: CloudProvider = CloudProvider.NONE
    
    # What to sync
    sync_relatorios: bool = True
    sync_recibos: bool = True
    sync_vistorias: bool = True
    sync_documentos_veiculos: bool = True
    sync_documentos_motoristas: bool = True
    sync_contratos: bool = True
    sync_comprovativos: bool = True
    
    # Cloud folder structure
    pasta_raiz: str = "/TVDEFleet"


class CloudCredentials(BaseModel):
    """Cloud provider credentials"""
    provider: CloudProvider
    # Generic fields - used differently per provider
    email: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    api_key: Optional[str] = None
    folder_id: Optional[str] = None  # Root folder ID in cloud


def get_parceiro_id(current_user: Dict) -> str:
    """Extract parceiro_id from current user"""
    role = current_user.get("role", "")
    if role in ["parceiro", "operacional"]:
        return current_user["id"]
    elif role in ["gestao"]:
        return current_user.get("parceiro_ativo") or current_user.get("associated_partner_id") or current_user["id"]
    elif role == "admin":
        return current_user.get("parceiro_ativo") or "admin"
    return current_user["id"]


# ==================== GET CONFIGURATION ====================

@router.get("")
async def get_storage_config(
    parceiro_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Get storage configuration for current partner or specified partner (admin/gestao)"""
    # If parceiro_id is specified and user is admin/gestao, use that
    if parceiro_id and current_user.get("role") in ["admin", "gestao"]:
        target_parceiro_id = parceiro_id
    else:
        target_parceiro_id = get_parceiro_id(current_user)
    
    config = await db.storage_config.find_one(
        {"parceiro_id": target_parceiro_id},
        {"_id": 0}
    )
    
    if not config:
        # Return default configuration
        return {
            "parceiro_id": target_parceiro_id,
            "modo": StorageMode.LOCAL,
            "cloud_provider": CloudProvider.NONE,
            "cloud_connected": False,
            "cloud_email": None,
            "sync_relatorios": True,
            "sync_recibos": True,
            "sync_vistorias": True,
            "sync_documentos_veiculos": True,
            "sync_documentos_motoristas": True,
            "sync_contratos": True,
            "sync_comprovativos": True,
            "pasta_raiz": "/TVDEFleet",
            "espaco_usado_local": 0,
            "espaco_usado_cloud": 0,
            "ultimo_sync": None
        }
    
    # Check if cloud is actually connected
    cloud_connected = False
    cloud_email = None
    
    if config.get("cloud_provider") and config.get("cloud_provider") != "none":
        credentials = await db.cloud_credentials.find_one(
            {"parceiro_id": target_parceiro_id, "provider": config["cloud_provider"]},
            {"_id": 0, "email": 1, "access_token": 1}
        )
        if credentials and credentials.get("access_token"):
            cloud_connected = True
            cloud_email = credentials.get("email")
    
    config["cloud_connected"] = cloud_connected
    config["cloud_email"] = cloud_email
    
    return config


@router.put("")
async def update_storage_config(
    config: StorageConfigUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Update storage configuration for current partner"""
    parceiro_id = get_parceiro_id(current_user)
    
    # Validate: If mode is cloud or both, must have provider
    if config.modo in [StorageMode.CLOUD, StorageMode.BOTH]:
        if config.cloud_provider == CloudProvider.NONE:
            raise HTTPException(
                status_code=400,
                detail="Deve selecionar um serviço de cloud para este modo"
            )
        
        # Check if credentials exist
        credentials = await db.cloud_credentials.find_one(
            {"parceiro_id": parceiro_id, "provider": config.cloud_provider}
        )
        if not credentials or not credentials.get("access_token"):
            raise HTTPException(
                status_code=400,
                detail=f"Primeiro conecte a sua conta {config.cloud_provider}"
            )
    
    update_data = {
        "parceiro_id": parceiro_id,
        "modo": config.modo,
        "cloud_provider": config.cloud_provider,
        "sync_relatorios": config.sync_relatorios,
        "sync_recibos": config.sync_recibos,
        "sync_vistorias": config.sync_vistorias,
        "sync_documentos_veiculos": config.sync_documentos_veiculos,
        "sync_documentos_motoristas": config.sync_documentos_motoristas,
        "sync_contratos": config.sync_contratos,
        "sync_comprovativos": config.sync_comprovativos,
        "pasta_raiz": config.pasta_raiz,
        "atualizado_em": datetime.now(timezone.utc),
        "atualizado_por": current_user["id"]
    }
    
    await db.storage_config.update_one(
        {"parceiro_id": parceiro_id},
        {"$set": update_data},
        upsert=True
    )
    
    logger.info(f"Storage config updated for partner {parceiro_id}: mode={config.modo}, provider={config.cloud_provider}")
    
    return {
        "success": True,
        "message": "Configuração de armazenamento guardada",
        "modo": config.modo,
        "cloud_provider": config.cloud_provider
    }


# ==================== CLOUD PROVIDER CONNECTION ====================

@router.get("/providers")
async def list_cloud_providers(current_user: Dict = Depends(get_current_user)):
    """List available cloud providers and their connection status"""
    parceiro_id = get_parceiro_id(current_user)
    
    providers = [
        {
            "id": "terabox",
            "nome": "Terabox",
            "descricao": "1TB gratuito, ideal para documentos",
            "icon": "cloud",
            "connected": False,
            "email": None
        },
        {
            "id": "google_drive",
            "nome": "Google Drive",
            "descricao": "15GB gratuito, integração Google",
            "icon": "google-drive",
            "connected": False,
            "email": None
        },
        {
            "id": "onedrive",
            "nome": "OneDrive",
            "descricao": "5GB gratuito, integração Microsoft",
            "icon": "microsoft",
            "connected": False,
            "email": None
        },
        {
            "id": "dropbox",
            "nome": "Dropbox",
            "descricao": "2GB gratuito, partilha fácil",
            "icon": "dropbox",
            "connected": False,
            "email": None
        }
    ]
    
    # Check connection status for each
    credentials = await db.cloud_credentials.find(
        {"parceiro_id": parceiro_id},
        {"_id": 0, "provider": 1, "email": 1, "access_token": 1}
    ).to_list(None)
    
    creds_map = {c["provider"]: c for c in credentials}
    
    for provider in providers:
        if provider["id"] in creds_map:
            cred = creds_map[provider["id"]]
            if cred.get("access_token"):
                provider["connected"] = True
                provider["email"] = cred.get("email")
    
    return {"providers": providers}


@router.post("/connect/{provider}")
async def connect_cloud_provider(
    provider: str,
    credentials: CloudCredentials,
    current_user: Dict = Depends(get_current_user)
):
    """Connect a cloud provider with credentials"""
    parceiro_id = get_parceiro_id(current_user)
    
    if provider not in ["terabox", "google_drive", "onedrive", "dropbox"]:
        raise HTTPException(status_code=400, detail="Provider inválido")
    
    # Store credentials
    cred_data = {
        "parceiro_id": parceiro_id,
        "provider": provider,
        "email": credentials.email,
        "access_token": credentials.access_token,
        "refresh_token": credentials.refresh_token,
        "api_key": credentials.api_key,
        "folder_id": credentials.folder_id,
        "connected_at": datetime.now(timezone.utc),
        "connected_by": current_user["id"]
    }
    
    await db.cloud_credentials.update_one(
        {"parceiro_id": parceiro_id, "provider": provider},
        {"$set": cred_data},
        upsert=True
    )
    
    logger.info(f"Cloud provider {provider} connected for partner {parceiro_id}")
    
    return {
        "success": True,
        "message": f"{provider} conectado com sucesso",
        "provider": provider,
        "email": credentials.email
    }


@router.delete("/disconnect/{provider}")
async def disconnect_cloud_provider(
    provider: str,
    current_user: Dict = Depends(get_current_user)
):
    """Disconnect a cloud provider"""
    parceiro_id = get_parceiro_id(current_user)
    
    # Check if this provider is currently in use
    config = await db.storage_config.find_one({"parceiro_id": parceiro_id})
    if config and config.get("cloud_provider") == provider:
        if config.get("modo") in ["cloud", "both"]:
            raise HTTPException(
                status_code=400,
                detail="Não pode desconectar este serviço enquanto está em uso. Altere o modo para 'Local' primeiro."
            )
    
    result = await db.cloud_credentials.delete_one(
        {"parceiro_id": parceiro_id, "provider": provider}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Provider não encontrado")
    
    logger.info(f"Cloud provider {provider} disconnected for partner {parceiro_id}")
    
    return {
        "success": True,
        "message": f"{provider} desconectado"
    }


# ==================== OAUTH FLOWS ====================

@router.get("/oauth/{provider}/url")
async def get_oauth_url(
    provider: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get OAuth authorization URL for a provider"""
    parceiro_id = get_parceiro_id(current_user)
    
    # Base redirect URL
    import os
    base_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
    redirect_uri = f"{base_url}/api/storage-config/oauth/{provider}/callback"
    
    if provider == "google_drive":
        # Google Drive OAuth
        client_id = os.environ.get("GOOGLE_CLIENT_ID")
        if not client_id:
            raise HTTPException(status_code=500, detail="Google Drive não configurado pelo administrador")
        
        scope = "https://www.googleapis.com/auth/drive.file"
        auth_url = (
            f"https://accounts.google.com/o/oauth2/auth"
            f"?client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope={scope}"
            f"&access_type=offline"
            f"&state={parceiro_id}"
            f"&prompt=consent"
        )
        return {"authorization_url": auth_url, "provider": provider}
    
    elif provider == "dropbox":
        # Dropbox OAuth
        client_id = os.environ.get("DROPBOX_APP_KEY")
        if not client_id:
            raise HTTPException(status_code=500, detail="Dropbox não configurado pelo administrador")
        
        auth_url = (
            f"https://www.dropbox.com/oauth2/authorize"
            f"?client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&state={parceiro_id}"
            f"&token_access_type=offline"
        )
        return {"authorization_url": auth_url, "provider": provider}
    
    elif provider == "onedrive":
        # OneDrive/Microsoft OAuth
        client_id = os.environ.get("MICROSOFT_CLIENT_ID")
        if not client_id:
            raise HTTPException(status_code=500, detail="OneDrive não configurado pelo administrador")
        
        scope = "Files.ReadWrite.All offline_access"
        auth_url = (
            f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
            f"?client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope={scope}"
            f"&state={parceiro_id}"
        )
        return {"authorization_url": auth_url, "provider": provider}
    
    elif provider == "terabox":
        # Terabox doesn't use standard OAuth - uses API key or session
        return {
            "provider": provider,
            "method": "api_key",
            "message": "Terabox usa autenticação por API key ou sessão. Configure manualmente."
        }
    
    raise HTTPException(status_code=400, detail="Provider não suportado para OAuth")


# ==================== SYNC STATUS ====================

@router.get("/sync-status")
async def get_sync_status(current_user: Dict = Depends(get_current_user)):
    """Get synchronization status"""
    parceiro_id = get_parceiro_id(current_user)
    
    # Get pending syncs
    pending = await db.sync_queue.count_documents({
        "parceiro_id": parceiro_id,
        "status": "pending"
    })
    
    # Get last sync info
    last_sync = await db.sync_log.find_one(
        {"parceiro_id": parceiro_id},
        sort=[("data", -1)]
    )
    
    # Get failed syncs (last 24h)
    from datetime import timedelta
    failed = await db.sync_log.count_documents({
        "parceiro_id": parceiro_id,
        "status": "error",
        "data": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)}
    })
    
    return {
        "pending_files": pending,
        "failed_last_24h": failed,
        "last_sync": last_sync.get("data") if last_sync else None,
        "last_sync_status": last_sync.get("status") if last_sync else None,
        "last_sync_files": last_sync.get("files_synced", 0) if last_sync else 0
    }


@router.post("/sync-now")
async def trigger_sync(current_user: Dict = Depends(get_current_user)):
    """Manually trigger sync for pending files"""
    parceiro_id = get_parceiro_id(current_user)
    
    # Get config
    config = await db.storage_config.find_one({"parceiro_id": parceiro_id})
    if not config or config.get("modo") == "local":
        raise HTTPException(status_code=400, detail="Modo de armazenamento não requer sincronização")
    
    # Count pending
    pending = await db.sync_queue.count_documents({
        "parceiro_id": parceiro_id,
        "status": "pending"
    })
    
    if pending == 0:
        return {"message": "Não há ficheiros pendentes para sincronizar", "pending": 0}
    
    # TODO: Trigger actual sync job
    # For now, just return info
    return {
        "message": f"Sincronização iniciada para {pending} ficheiros",
        "pending": pending,
        "status": "started"
    }


# ==================== ADMIN: VIEW ALL PARTNERS CONFIG ====================

@router.get("/admin/all")
async def get_all_partners_storage_config(current_user: Dict = Depends(get_current_user)):
    """Admin: Get storage configuration for all partners"""
    if current_user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    configs = await db.storage_config.find(
        {},
        {"_id": 0}
    ).to_list(None)
    
    # Enrich with partner names
    for config in configs:
        partner = await db.users.find_one(
            {"id": config["parceiro_id"]},
            {"_id": 0, "name": 1, "email": 1, "empresa": 1}
        )
        if partner:
            config["parceiro_nome"] = partner.get("empresa") or partner.get("name")
            config["parceiro_email"] = partner.get("email")
    
    # Get partners without config (using default local)
    all_partners = await db.users.find(
        {"role": {"$in": ["parceiro", "operacional"]}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "empresa": 1}
    ).to_list(None)
    
    configured_ids = {c["parceiro_id"] for c in configs}
    
    for partner in all_partners:
        if partner["id"] not in configured_ids:
            configs.append({
                "parceiro_id": partner["id"],
                "parceiro_nome": partner.get("empresa") or partner.get("name"),
                "parceiro_email": partner.get("email"),
                "modo": "local",
                "cloud_provider": "none",
                "default": True
            })
    
    return {
        "total": len(configs),
        "configs": configs
    }
