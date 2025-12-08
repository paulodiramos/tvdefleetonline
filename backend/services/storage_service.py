"""
Storage Service using Google Drive
Handles document and photo storage for the fleet management system
"""

import logging
import os
import io
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload, MediaInMemoryUpload
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class StorageService:
    """Service for Google Drive storage operations"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def get_storage_config(self) -> Optional[Dict[str, Any]]:
        """Get storage configuration from database"""
        try:
            config = await self.db.configuracoes_sistema.find_one(
                {"tipo": "storage_google_drive"},
                {"_id": 0}
            )
            return config
        except Exception as e:
            logger.error(f"Error fetching storage config: {e}")
            return None
    
    async def get_user_credentials(self, user_id: str) -> Optional[Credentials]:
        """Get and refresh user's Google Drive credentials"""
        try:
            creds_doc = await self.db.drive_credentials.find_one({"user_id": user_id})
            if not creds_doc:
                return None
            
            # Create credentials object
            creds = Credentials(
                token=creds_doc["access_token"],
                refresh_token=creds_doc.get("refresh_token"),
                token_uri=creds_doc["token_uri"],
                client_id=creds_doc["client_id"],
                client_secret=creds_doc["client_secret"],
                scopes=creds_doc["scopes"]
            )
            
            # Auto-refresh if expired
            if creds.expired and creds.refresh_token:
                logger.info(f"Refreshing expired token for user {user_id}")
                creds.refresh(GoogleRequest())
                
                # Update in database
                await self.db.drive_credentials.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "access_token": creds.token,
                        "expiry": creds.expiry.isoformat() if creds.expiry else None,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
            
            return creds
            
        except Exception as e:
            logger.error(f"Error getting user credentials: {e}")
            return None
    
    async def get_drive_service(self, user_id: str):
        """Get Google Drive service for user"""
        creds = await self.get_user_credentials(user_id)
        if not creds:
            raise Exception("Google Drive not connected for this user")
        
        return build('drive', 'v3', credentials=creds)
    
    async def create_folder_structure(self, user_id: str, entity_type: str, entity_id: str) -> Dict[str, Any]:
        """
        Create folder structure in Google Drive
        
        Structure:
        TVDEFleet/
        ├── Motoristas/
        │   └── {motorista_id}/
        │       ├── Documentos/
        │       └── Fotos/
        └── Veiculos/
            └── {veiculo_id}/
                ├── Documentos/
                └── Vistorias/
        """
        try:
            service = await self.get_drive_service(user_id)
            
            # Get or create root folder
            root_folder_id = await self._get_or_create_folder(service, "TVDEFleet", None)
            
            # Get or create entity type folder (Motoristas/Veiculos)
            entity_folder_id = await self._get_or_create_folder(
                service, 
                entity_type.capitalize(), 
                root_folder_id
            )
            
            # Get or create entity folder (specific motorista/veiculo)
            entity_instance_folder_id = await self._get_or_create_folder(
                service, 
                entity_id, 
                entity_folder_id
            )
            
            # Create subfolders
            if entity_type == "motoristas":
                docs_folder_id = await self._get_or_create_folder(
                    service, "Documentos", entity_instance_folder_id
                )
                photos_folder_id = await self._get_or_create_folder(
                    service, "Fotos", entity_instance_folder_id
                )
                return {
                    "root": root_folder_id,
                    "entity": entity_folder_id,
                    "instance": entity_instance_folder_id,
                    "documentos": docs_folder_id,
                    "fotos": photos_folder_id
                }
            
            elif entity_type == "veiculos":
                docs_folder_id = await self._get_or_create_folder(
                    service, "Documentos", entity_instance_folder_id
                )
                vistorias_folder_id = await self._get_or_create_folder(
                    service, "Vistorias", entity_instance_folder_id
                )
                return {
                    "root": root_folder_id,
                    "entity": entity_folder_id,
                    "instance": entity_instance_folder_id,
                    "documentos": docs_folder_id,
                    "vistorias": vistorias_folder_id
                }
            
            return {
                "root": root_folder_id,
                "entity": entity_folder_id,
                "instance": entity_instance_folder_id
            }
            
        except Exception as e:
            logger.error(f"Error creating folder structure: {e}")
            raise
    
    async def _get_or_create_folder(self, service, folder_name: str, parent_id: Optional[str]) -> str:
        """Get existing folder or create new one"""
        try:
            # Search for existing folder
            query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            if parent_id:
                query += f" and '{parent_id}' in parents"
            
            results = service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)'
            ).execute()
            
            files = results.get('files', [])
            
            if files:
                return files[0]['id']
            
            # Create new folder
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            
            if parent_id:
                file_metadata['parents'] = [parent_id]
            
            folder = service.files().create(
                body=file_metadata,
                fields='id'
            ).execute()
            
            logger.info(f"Created folder: {folder_name} (ID: {folder['id']})")
            return folder['id']
            
        except Exception as e:
            logger.error(f"Error getting/creating folder {folder_name}: {e}")
            raise
    
    async def upload_file(
        self,
        user_id: str,
        file_content: bytes,
        file_name: str,
        folder_id: str,
        mime_type: str = 'application/octet-stream'
    ) -> Dict[str, Any]:
        """
        Upload file to Google Drive
        Returns: {"success": bool, "file_id": str, "web_view_link": str, "error": str}
        """
        try:
            service = await self.get_drive_service(user_id)
            
            # Create file metadata
            file_metadata = {
                'name': file_name,
                'parents': [folder_id]
            }
            
            # Create media
            media = MediaInMemoryUpload(file_content, mimetype=mime_type, resumable=True)
            
            # Upload file
            file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink, webContentLink'
            ).execute()
            
            logger.info(f"File uploaded: {file_name} (ID: {file['id']})")
            
            return {
                "success": True,
                "file_id": file['id'],
                "file_name": file['name'],
                "web_view_link": file.get('webViewLink'),
                "web_content_link": file.get('webContentLink')
            }
            
        except Exception as e:
            logger.error(f"Error uploading file {file_name}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def download_file(self, user_id: str, file_id: str) -> Optional[bytes]:
        """Download file from Google Drive"""
        try:
            service = await self.get_drive_service(user_id)
            
            request = service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
                logger.info(f"Download progress: {int(status.progress() * 100)}%")
            
            fh.seek(0)
            return fh.read()
            
        except Exception as e:
            logger.error(f"Error downloading file {file_id}: {e}")
            return None
    
    async def list_files(self, user_id: str, folder_id: str) -> List[Dict[str, Any]]:
        """List files in a folder"""
        try:
            service = await self.get_drive_service(user_id)
            
            results = service.files().list(
                q=f"'{folder_id}' in parents and trashed=false",
                spaces='drive',
                fields='files(id, name, mimeType, size, createdTime, webViewLink)',
                orderBy='createdTime desc'
            ).execute()
            
            files = results.get('files', [])
            
            return [
                {
                    "id": file['id'],
                    "name": file['name'],
                    "mime_type": file.get('mimeType'),
                    "size": int(file.get('size', 0)),
                    "created_time": file.get('createdTime'),
                    "web_view_link": file.get('webViewLink')
                }
                for file in files
            ]
            
        except Exception as e:
            logger.error(f"Error listing files in folder {folder_id}: {e}")
            return []
    
    async def delete_file(self, user_id: str, file_id: str) -> Dict[str, Any]:
        """Delete file from Google Drive"""
        try:
            service = await self.get_drive_service(user_id)
            
            service.files().delete(fileId=file_id).execute()
            
            logger.info(f"File deleted: {file_id}")
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Error deleting file {file_id}: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_storage_usage(self, user_id: str) -> Dict[str, Any]:
        """Get storage usage information"""
        try:
            service = await self.get_drive_service(user_id)
            
            about = service.about().get(fields='storageQuota').execute()
            quota = about.get('storageQuota', {})
            
            return {
                "total": int(quota.get('limit', 0)),
                "used": int(quota.get('usage', 0)),
                "used_in_drive": int(quota.get('usageInDrive', 0)),
                "used_in_trash": int(quota.get('usageInDriveTrash', 0))
            }
            
        except Exception as e:
            logger.error(f"Error getting storage usage: {e}")
            return {
                "total": 0,
                "used": 0,
                "used_in_drive": 0,
                "used_in_trash": 0
            }
