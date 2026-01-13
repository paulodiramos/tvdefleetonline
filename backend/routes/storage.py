"""Google Drive Storage integration routes"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Dict, Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone
import logging
import os

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)


class GoogleDriveConfig(BaseModel):
    """Google Drive configuration"""
    client_id: str
    client_secret: str
    redirect_uri: str


@router.get("/storage/drive/connect")
async def connect_google_drive(current_user: Dict = Depends(get_current_user)):
    """Initiate Google Drive OAuth flow"""
    try:
        from google_auth_oauthlib.flow import Flow
        
        # Get configuration
        config = await db.configuracoes_sistema.find_one({"tipo": "storage_google_drive"})
        if not config:
            raise HTTPException(
                status_code=400,
                detail="Google Drive not configured. Admin must configure it first."
            )
        
        client_id = config.get("client_id")
        client_secret = config.get("client_secret")
        redirect_uri = config.get("redirect_uri")
        
        if not all([client_id, client_secret, redirect_uri]):
            raise HTTPException(
                status_code=400,
                detail="Google Drive configuration is incomplete"
            )
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=['https://www.googleapis.com/auth/drive.file'],
            redirect_uri=redirect_uri
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=current_user["id"]
        )
        
        logger.info(f"Drive OAuth initiated for user {current_user['id']}")
        return {"authorization_url": authorization_url}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to initiate Drive OAuth: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/drive/callback")
async def drive_callback(code: str, state: str):
    """Handle Google Drive OAuth callback"""
    try:
        from google_auth_oauthlib.flow import Flow
        
        # Get configuration
        config = await db.configuracoes_sistema.find_one({"tipo": "storage_google_drive"})
        if not config:
            raise HTTPException(status_code=400, detail="Google Drive not configured")
        
        client_id = config.get("client_id")
        client_secret = config.get("client_secret")
        redirect_uri = config.get("redirect_uri")
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=None,
            redirect_uri=redirect_uri
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Store credentials for user
        user_id = state  # We passed user_id as state
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "drive_credentials": {
                        "token": credentials.token,
                        "refresh_token": credentials.refresh_token,
                        "token_uri": credentials.token_uri,
                        "client_id": credentials.client_id,
                        "client_secret": credentials.client_secret,
                        "scopes": list(credentials.scopes) if credentials.scopes else [],
                        "expiry": credentials.expiry.isoformat() if credentials.expiry else None
                    },
                    "drive_connected": True,
                    "drive_connected_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logger.info(f"Drive connected for user {user_id}")
        
        # Return HTML that closes the popup
        return """
        <html>
            <body>
                <h2>Google Drive Connected Successfully!</h2>
                <p>You can close this window.</p>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({type: 'drive_connected', success: true}, '*');
                        window.close();
                    }
                </script>
            </body>
        </html>
        """
    
    except Exception as e:
        logger.error(f"Drive callback failed: {e}")
        return f"""
        <html>
            <body>
                <h2>Connection Failed</h2>
                <p>Error: {str(e)}</p>
                <script>
                    if (window.opener) {{
                        window.opener.postMessage({{type: 'drive_connected', success: false, error: '{str(e)}'}}, '*');
                    }}
                </script>
            </body>
        </html>
        """


@router.get("/storage/drive/status")
async def get_drive_status(current_user: Dict = Depends(get_current_user)):
    """Get Google Drive connection status"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    return {
        "connected": user.get("drive_connected", False),
        "connected_at": user.get("drive_connected_at"),
        "has_credentials": bool(user.get("drive_credentials"))
    }


@router.post("/storage/drive/upload")
async def upload_to_drive(
    file: UploadFile = File(...),
    folder_name: str = "TVDEFleet",
    current_user: Dict = Depends(get_current_user)
):
    """Upload file to Google Drive"""
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseUpload
        import io
        
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
        creds_data = user.get("drive_credentials")
        
        if not creds_data:
            raise HTTPException(status_code=400, detail="Google Drive not connected")
        
        credentials = Credentials(
            token=creds_data["token"],
            refresh_token=creds_data.get("refresh_token"),
            token_uri=creds_data["token_uri"],
            client_id=creds_data["client_id"],
            client_secret=creds_data["client_secret"]
        )
        
        service = build('drive', 'v3', credentials=credentials)
        
        # Find or create folder
        folder_query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(q=folder_query, spaces='drive').execute()
        folders = results.get('files', [])
        
        if folders:
            folder_id = folders[0]['id']
        else:
            # Create folder
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            folder = service.files().create(body=folder_metadata, fields='id').execute()
            folder_id = folder.get('id')
        
        # Upload file
        file_content = await file.read()
        media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=file.content_type)
        
        file_metadata = {
            'name': file.filename,
            'parents': [folder_id]
        }
        
        uploaded_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink'
        ).execute()
        
        logger.info(f"File uploaded to Drive: {uploaded_file.get('name')}")
        
        return {
            "success": True,
            "file_id": uploaded_file.get('id'),
            "file_name": uploaded_file.get('name'),
            "web_link": uploaded_file.get('webViewLink')
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Drive upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/drive/files/{entity_type}/{entity_id}")
async def get_drive_files(
    entity_type: str,
    entity_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get files from Google Drive for an entity (motorista, vehicle, etc)"""
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
        creds_data = user.get("drive_credentials")
        
        if not creds_data:
            return {"files": [], "connected": False}
        
        credentials = Credentials(
            token=creds_data["token"],
            refresh_token=creds_data.get("refresh_token"),
            token_uri=creds_data["token_uri"],
            client_id=creds_data["client_id"],
            client_secret=creds_data["client_secret"]
        )
        
        service = build('drive', 'v3', credentials=credentials)
        
        # Search for files with entity tag in name or description
        query = f"name contains '{entity_type}_{entity_id}' and trashed=false"
        results = service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name, mimeType, webViewLink, createdTime)'
        ).execute()
        
        return {
            "files": results.get('files', []),
            "connected": True
        }
    
    except Exception as e:
        logger.error(f"Failed to get Drive files: {e}")
        return {"files": [], "connected": True, "error": str(e)}


@router.post("/configuracoes/storage/google-drive")
async def configure_google_drive(
    config: GoogleDriveConfig,
    current_user: Dict = Depends(get_current_user)
):
    """Configure Google Drive integration (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    await db.configuracoes_sistema.update_one(
        {"tipo": "storage_google_drive"},
        {
            "$set": {
                "tipo": "storage_google_drive",
                "client_id": config.client_id,
                "client_secret": config.client_secret,
                "redirect_uri": config.redirect_uri,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user["id"]
            }
        },
        upsert=True
    )
    
    logger.info(f"Google Drive configured by {current_user['id']}")
    return {"message": "Google Drive configurado com sucesso"}


@router.get("/configuracoes/storage/google-drive")
async def get_google_drive_config(current_user: Dict = Depends(get_current_user)):
    """Get Google Drive configuration (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    config = await db.configuracoes_sistema.find_one(
        {"tipo": "storage_google_drive"},
        {"_id": 0}
    )
    
    if config:
        # Mask client secret
        if config.get("client_secret"):
            config["client_secret"] = "********"
    
    return config or {}
