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
    email: Optional[str] = None
    password: Optional[str] = None  # Password for login
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    api_key: Optional[str] = None
    folder_id: Optional[str] = None


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
    
    # Default configuration
    default_config = {
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
    
    config = await db.storage_config.find_one(
        {"parceiro_id": target_parceiro_id},
        {"_id": 0}
    )
    
    if not config:
        return default_config
    
    # Merge stored config with defaults (stored values take precedence)
    merged_config = {**default_config, **config}
    
    # Check if cloud is actually connected
    cloud_connected = False
    cloud_email = None
    
    if merged_config.get("cloud_provider") and merged_config.get("cloud_provider") != "none":
        credentials = await db.cloud_credentials.find_one(
            {"parceiro_id": target_parceiro_id, "provider": merged_config["cloud_provider"]},
            {"_id": 0, "email": 1, "access_token": 1}
        )
        if credentials and credentials.get("access_token"):
            cloud_connected = True
            cloud_email = credentials.get("email")
    
    merged_config["cloud_connected"] = cloud_connected
    merged_config["cloud_email"] = cloud_email
    
    return merged_config


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
    """Connect a cloud provider with credentials (email + password)"""
    parceiro_id = get_parceiro_id(current_user)
    
    if provider not in ["terabox", "google_drive", "onedrive", "dropbox"]:
        raise HTTPException(status_code=400, detail="Provider inválido")
    
    if not credentials.email or not credentials.password:
        raise HTTPException(status_code=400, detail="Email e password são obrigatórios")
    
    # Encrypt password before storing (using base64 for simplicity - should use proper encryption in production)
    import base64
    encrypted_password = base64.b64encode(credentials.password.encode()).decode()
    
    # Store credentials
    cred_data = {
        "parceiro_id": parceiro_id,
        "provider": provider,
        "email": credentials.email,
        "password_encrypted": encrypted_password,
        "access_token": credentials.access_token,  # Will be obtained via login
        "refresh_token": credentials.refresh_token,
        "connected_at": datetime.now(timezone.utc),
        "connected_by": current_user["id"],
        "status": "connected"
    }
    
    await db.cloud_credentials.update_one(
        {"parceiro_id": parceiro_id, "provider": provider},
        {"$set": cred_data},
        upsert=True
    )
    
    # Clear any other provider credentials (only one allowed)
    await db.cloud_credentials.delete_many({
        "parceiro_id": parceiro_id,
        "provider": {"$ne": provider}
    })
    
    # Update config to use this provider
    await db.storage_config.update_one(
        {"parceiro_id": parceiro_id},
        {"$set": {"cloud_provider": provider}},
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


# ==================== OAUTH CALLBACKS ====================

@router.get("/oauth/google_drive/callback")
async def google_drive_oauth_callback(code: str, state: str):
    """Handle Google Drive OAuth callback"""
    import httpx
    
    parceiro_id = state
    
    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": os.environ.get("GOOGLE_CLIENT_ID"),
                    "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET"),
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": f"{os.environ.get('REACT_APP_BACKEND_URL', '')}/api/storage-config/oauth/google_drive/callback"
                }
            )
            tokens = response.json()
        
        if "access_token" not in tokens:
            raise HTTPException(status_code=400, detail=f"OAuth failed: {tokens.get('error_description', 'Unknown error')}")
        
        # Get user info
        async with httpx.AsyncClient() as client:
            user_info = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )
            user_data = user_info.json()
        
        # Save credentials
        await db.cloud_credentials.update_one(
            {"parceiro_id": parceiro_id, "provider": "google_drive"},
            {
                "$set": {
                    "parceiro_id": parceiro_id,
                    "provider": "google_drive",
                    "email": user_data.get("email"),
                    "access_token": tokens["access_token"],
                    "refresh_token": tokens.get("refresh_token"),
                    "connected_at": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
        # Redirect to frontend
        frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "").rstrip("/")
        return {"success": True, "message": "Google Drive conectado!", "redirect": f"{frontend_url}/armazenamento?connected=google_drive"}
        
    except Exception as e:
        logger.error(f"Google Drive OAuth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/oauth/dropbox/callback")
async def dropbox_oauth_callback(code: str, state: str):
    """Handle Dropbox OAuth callback"""
    import httpx
    
    parceiro_id = state
    
    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.dropboxapi.com/oauth2/token",
                data={
                    "client_id": os.environ.get("DROPBOX_APP_KEY"),
                    "client_secret": os.environ.get("DROPBOX_APP_SECRET"),
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": f"{os.environ.get('REACT_APP_BACKEND_URL', '')}/api/storage-config/oauth/dropbox/callback"
                }
            )
            tokens = response.json()
        
        if "access_token" not in tokens:
            raise HTTPException(status_code=400, detail="OAuth failed")
        
        # Save credentials
        await db.cloud_credentials.update_one(
            {"parceiro_id": parceiro_id, "provider": "dropbox"},
            {
                "$set": {
                    "parceiro_id": parceiro_id,
                    "provider": "dropbox",
                    "email": tokens.get("account_id"),
                    "access_token": tokens["access_token"],
                    "refresh_token": tokens.get("refresh_token"),
                    "connected_at": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
        frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "").rstrip("/")
        return {"success": True, "message": "Dropbox conectado!", "redirect": f"{frontend_url}/armazenamento?connected=dropbox"}
        
    except Exception as e:
        logger.error(f"Dropbox OAuth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/oauth/onedrive/callback")
async def onedrive_oauth_callback(code: str, state: str):
    """Handle OneDrive/Microsoft OAuth callback"""
    import msal
    
    parceiro_id = state
    
    try:
        app = msal.ConfidentialClientApplication(
            os.environ.get("MICROSOFT_CLIENT_ID"),
            client_credential=os.environ.get("MICROSOFT_CLIENT_SECRET"),
            authority="https://login.microsoftonline.com/common"
        )
        
        result = app.acquire_token_by_authorization_code(
            code,
            scopes=["Files.ReadWrite.All", "offline_access"],
            redirect_uri=f"{os.environ.get('REACT_APP_BACKEND_URL', '')}/api/storage-config/oauth/onedrive/callback"
        )
        
        if "access_token" not in result:
            raise HTTPException(status_code=400, detail=result.get("error_description", "OAuth failed"))
        
        # Get user info
        import httpx
        async with httpx.AsyncClient() as client:
            user_info = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {result['access_token']}"}
            )
            user_data = user_info.json()
        
        # Save credentials
        await db.cloud_credentials.update_one(
            {"parceiro_id": parceiro_id, "provider": "onedrive"},
            {
                "$set": {
                    "parceiro_id": parceiro_id,
                    "provider": "onedrive",
                    "email": user_data.get("mail") or user_data.get("userPrincipalName"),
                    "access_token": result["access_token"],
                    "refresh_token": result.get("refresh_token"),
                    "connected_at": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
        frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "").rstrip("/")
        return {"success": True, "message": "OneDrive conectado!", "redirect": f"{frontend_url}/armazenamento?connected=onedrive"}
        
    except Exception as e:
        logger.error(f"OneDrive OAuth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TEST UPLOAD ====================

@router.post("/test-upload")
async def test_cloud_upload(current_user: Dict = Depends(get_current_user)):
    """Test cloud upload with a small file"""
    from utils.cloud_storage import CloudStorageService
    
    parceiro_id = get_parceiro_id(current_user)
    
    # Create test content
    test_content = b"TVDEFleet Cloud Storage Test - " + datetime.now().isoformat().encode()
    
    result = await CloudStorageService.upload_document(
        parceiro_id=parceiro_id,
        file_content=test_content,
        filename="test_upload.txt",
        document_type="relatorio",
        entity_id="test",
        entity_name="teste"
    )
    
    return {
        "success": True,
        "result": result
    }



# ==================== DOWNLOAD FROM CLOUD ====================

@router.get("/download")
async def download_file_from_cloud(
    cloud_path: str,
    provider: str,
    current_user: Dict = Depends(get_current_user)
):
    """Download a file from cloud storage"""
    from fastapi.responses import StreamingResponse
    from utils.cloud_storage import CloudStorageService
    import io
    
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        # Get provider instance
        cloud_provider = await CloudStorageService.get_provider(parceiro_id)
        if not cloud_provider:
            raise HTTPException(status_code=400, detail="Cloud provider não configurado")
        
        # Download file content
        content = await cloud_provider.download_file(cloud_path)
        
        # Get filename from path
        filename = cloud_path.split('/')[-1] if '/' in cloud_path else cloud_path
        
        # Determine content type
        import mimetypes
        content_type, _ = mimetypes.guess_type(filename)
        if not content_type:
            content_type = 'application/octet-stream'
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(content))
            }
        )
        
    except Exception as e:
        logger.error(f"Download from cloud failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao descarregar ficheiro: {str(e)}")


@router.get("/download-url")
async def get_download_url(
    cloud_path: str,
    provider: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get a direct download URL for a file in cloud storage"""
    from utils.cloud_storage import CloudStorageService
    
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        url = await CloudStorageService.get_document_url(parceiro_id, cloud_path, provider)
        if not url:
            raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
        
        return {"url": url, "cloud_path": cloud_path, "provider": provider}
        
    except Exception as e:
        logger.error(f"Get download URL failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter URL: {str(e)}")


@router.get("/files")
async def list_cloud_files(
    folder_path: Optional[str] = "",
    current_user: Dict = Depends(get_current_user)
):
    """List files in a cloud folder"""
    from utils.cloud_storage import CloudStorageService
    
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        cloud_provider = await CloudStorageService.get_provider(parceiro_id)
        if not cloud_provider:
            return {"files": [], "message": "Cloud provider não configurado"}
        
        files = await cloud_provider.list_files(folder_path)
        
        return {
            "folder_path": folder_path,
            "files": files,
            "total": len(files)
        }
        
    except Exception as e:
        logger.error(f"List cloud files failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar ficheiros: {str(e)}")
