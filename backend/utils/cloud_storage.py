"""Unified Cloud Storage Service
Supports: Terabox, Google Drive, OneDrive, Dropbox
Each partner can configure their preferred cloud storage
"""

import os
import io
import logging
import httpx
import aiofiles
from typing import Dict, Optional, List, Any
from datetime import datetime, timezone
from abc import ABC, abstractmethod

# Google Drive
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

# Dropbox
import dropbox
from dropbox.files import WriteMode

# Microsoft (OneDrive)
import msal

from utils.database import get_database

logger = logging.getLogger(__name__)
db = get_database()


class CloudStorageProvider(ABC):
    """Abstract base class for cloud storage providers"""
    
    @abstractmethod
    async def upload_file(self, file_content: bytes, filename: str, folder_path: str) -> Dict:
        """Upload a file to cloud storage"""
        pass
    
    @abstractmethod
    async def download_file(self, file_id: str) -> bytes:
        """Download a file from cloud storage"""
        pass
    
    @abstractmethod
    async def delete_file(self, file_id: str) -> bool:
        """Delete a file from cloud storage"""
        pass
    
    @abstractmethod
    async def list_files(self, folder_path: str) -> List[Dict]:
        """List files in a folder"""
        pass
    
    @abstractmethod
    async def create_folder(self, folder_name: str, parent_path: str) -> Dict:
        """Create a folder"""
        pass
    
    @abstractmethod
    async def get_file_url(self, file_id: str) -> str:
        """Get a shareable/download URL for a file"""
        pass


class GoogleDriveProvider(CloudStorageProvider):
    """Google Drive implementation"""
    
    def __init__(self, credentials: Dict):
        self.credentials = credentials
        self._service = None
    
    def _get_service(self):
        if self._service:
            return self._service
        
        creds = Credentials(
            token=self.credentials.get('access_token'),
            refresh_token=self.credentials.get('refresh_token'),
            token_uri='https://oauth2.googleapis.com/token',
            client_id=os.environ.get('GOOGLE_CLIENT_ID'),
            client_secret=os.environ.get('GOOGLE_CLIENT_SECRET')
        )
        
        # Refresh if expired
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
        
        self._service = build('drive', 'v3', credentials=creds)
        return self._service
    
    async def _ensure_folder_exists(self, folder_path: str, parent_id: str = None) -> str:
        """Create folder structure if it doesn't exist, return folder ID"""
        service = self._get_service()
        
        folders = folder_path.strip('/').split('/')
        current_parent = parent_id or 'root'
        
        for folder_name in folders:
            if not folder_name:
                continue
                
            # Search for existing folder
            query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and '{current_parent}' in parents and trashed=false"
            results = service.files().list(q=query, fields="files(id, name)").execute()
            files = results.get('files', [])
            
            if files:
                current_parent = files[0]['id']
            else:
                # Create folder
                file_metadata = {
                    'name': folder_name,
                    'mimeType': 'application/vnd.google-apps.folder',
                    'parents': [current_parent]
                }
                folder = service.files().create(body=file_metadata, fields='id').execute()
                current_parent = folder['id']
        
        return current_parent
    
    async def upload_file(self, file_content: bytes, filename: str, folder_path: str) -> Dict:
        service = self._get_service()
        
        # Ensure folder exists
        folder_id = await self._ensure_folder_exists(folder_path)
        
        file_metadata = {
            'name': filename,
            'parents': [folder_id]
        }
        
        media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype='application/octet-stream')
        file = service.files().create(
            body=file_metadata, 
            media_body=media, 
            fields='id, name, webViewLink, webContentLink'
        ).execute()
        
        return {
            'id': file['id'],
            'name': file['name'],
            'url': file.get('webContentLink') or file.get('webViewLink'),
            'provider': 'google_drive'
        }
    
    async def download_file(self, file_id: str) -> bytes:
        service = self._get_service()
        request = service.files().get_media(fileId=file_id)
        
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        
        return fh.getvalue()
    
    async def delete_file(self, file_id: str) -> bool:
        service = self._get_service()
        service.files().delete(fileId=file_id).execute()
        return True
    
    async def list_files(self, folder_path: str) -> List[Dict]:
        service = self._get_service()
        folder_id = await self._ensure_folder_exists(folder_path)
        
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType, size, createdTime, webViewLink)"
        ).execute()
        
        return [{
            'id': f['id'],
            'name': f['name'],
            'type': 'folder' if f['mimeType'] == 'application/vnd.google-apps.folder' else 'file',
            'size': f.get('size', 0),
            'created': f.get('createdTime'),
            'url': f.get('webViewLink')
        } for f in results.get('files', [])]
    
    async def create_folder(self, folder_name: str, parent_path: str) -> Dict:
        folder_id = await self._ensure_folder_exists(f"{parent_path}/{folder_name}")
        return {'id': folder_id, 'name': folder_name, 'provider': 'google_drive'}
    
    async def get_file_url(self, file_id: str) -> str:
        service = self._get_service()
        file = service.files().get(fileId=file_id, fields='webContentLink, webViewLink').execute()
        return file.get('webContentLink') or file.get('webViewLink')


class DropboxProvider(CloudStorageProvider):
    """Dropbox implementation"""
    
    def __init__(self, credentials: Dict):
        self.credentials = credentials
        self._client = None
    
    def _get_client(self):
        if self._client:
            return self._client
        
        self._client = dropbox.Dropbox(
            oauth2_access_token=self.credentials.get('access_token'),
            oauth2_refresh_token=self.credentials.get('refresh_token'),
            app_key=os.environ.get('DROPBOX_APP_KEY'),
            app_secret=os.environ.get('DROPBOX_APP_SECRET')
        )
        return self._client
    
    async def upload_file(self, file_content: bytes, filename: str, folder_path: str) -> Dict:
        dbx = self._get_client()
        
        # Ensure path starts with /
        full_path = f"/{folder_path.strip('/')}/{filename}"
        
        result = dbx.files_upload(file_content, full_path, mode=WriteMode.overwrite)
        
        # Create shared link
        try:
            shared = dbx.sharing_create_shared_link_with_settings(full_path)
            url = shared.url.replace('?dl=0', '?dl=1')  # Direct download link
        except dropbox.exceptions.ApiError:
            # Link might already exist
            links = dbx.sharing_list_shared_links(path=full_path)
            url = links.links[0].url.replace('?dl=0', '?dl=1') if links.links else None
        
        return {
            'id': result.id,
            'name': result.name,
            'path': result.path_display,
            'url': url,
            'provider': 'dropbox'
        }
    
    async def download_file(self, file_id: str) -> bytes:
        dbx = self._get_client()
        _, response = dbx.files_download(file_id)
        return response.content
    
    async def delete_file(self, file_id: str) -> bool:
        dbx = self._get_client()
        dbx.files_delete_v2(file_id)
        return True
    
    async def list_files(self, folder_path: str) -> List[Dict]:
        dbx = self._get_client()
        path = f"/{folder_path.strip('/')}" if folder_path else ""
        
        try:
            result = dbx.files_list_folder(path)
        except dropbox.exceptions.ApiError:
            return []
        
        files = []
        for entry in result.entries:
            files.append({
                'id': entry.path_lower,
                'name': entry.name,
                'type': 'folder' if isinstance(entry, dropbox.files.FolderMetadata) else 'file',
                'size': getattr(entry, 'size', 0),
                'path': entry.path_display
            })
        
        return files
    
    async def create_folder(self, folder_name: str, parent_path: str) -> Dict:
        dbx = self._get_client()
        full_path = f"/{parent_path.strip('/')}/{folder_name}"
        
        try:
            result = dbx.files_create_folder_v2(full_path)
            return {'id': result.metadata.id, 'name': folder_name, 'path': full_path, 'provider': 'dropbox'}
        except dropbox.exceptions.ApiError as e:
            if 'path/conflict/folder' in str(e):
                return {'id': full_path, 'name': folder_name, 'path': full_path, 'provider': 'dropbox'}
            raise
    
    async def get_file_url(self, file_id: str) -> str:
        dbx = self._get_client()
        try:
            shared = dbx.sharing_create_shared_link_with_settings(file_id)
            return shared.url.replace('?dl=0', '?dl=1')
        except dropbox.exceptions.ApiError:
            links = dbx.sharing_list_shared_links(path=file_id)
            if links.links:
                return links.links[0].url.replace('?dl=0', '?dl=1')
        return None


class OneDriveProvider(CloudStorageProvider):
    """OneDrive/Microsoft Graph implementation"""
    
    def __init__(self, credentials: Dict):
        self.credentials = credentials
        self._access_token = credentials.get('access_token')
        self._refresh_token = credentials.get('refresh_token')
    
    async def _get_token(self) -> str:
        """Get or refresh access token"""
        # Try to refresh if we have refresh token
        if self._refresh_token:
            app = msal.ConfidentialClientApplication(
                os.environ.get('MICROSOFT_CLIENT_ID'),
                client_credential=os.environ.get('MICROSOFT_CLIENT_SECRET'),
                authority="https://login.microsoftonline.com/common"
            )
            
            result = app.acquire_token_by_refresh_token(
                self._refresh_token,
                scopes=["Files.ReadWrite.All"]
            )
            
            if 'access_token' in result:
                self._access_token = result['access_token']
                self._refresh_token = result.get('refresh_token', self._refresh_token)
        
        return self._access_token
    
    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make authenticated request to Graph API"""
        token = await self._get_token()
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        async with httpx.AsyncClient() as client:
            url = f"https://graph.microsoft.com/v1.0{endpoint}"
            response = await client.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            
            if response.content:
                return response.json()
            return {}
    
    async def _ensure_folder_exists(self, folder_path: str) -> str:
        """Create folder structure if it doesn't exist, return folder ID"""
        folders = folder_path.strip('/').split('/')
        current_path = ""
        
        for folder_name in folders:
            if not folder_name:
                continue
            
            parent_path = current_path or "/me/drive/root"
            current_path = f"{parent_path}:/{folder_name}:"
            
            try:
                # Check if folder exists
                result = await self._request('GET', f"/me/drive/root:/{'/'.join(folders[:folders.index(folder_name)+1])}")
                continue
            except httpx.HTTPStatusError:
                # Create folder
                parent_endpoint = f"/me/drive/root" if not current_path else f"/me/drive/root:/{'/'.join(folders[:folders.index(folder_name)])}:"
                body = {
                    "name": folder_name,
                    "folder": {},
                    "@microsoft.graph.conflictBehavior": "replace"
                }
                await self._request('POST', f"{parent_endpoint}/children", json=body)
        
        return folder_path
    
    async def upload_file(self, file_content: bytes, filename: str, folder_path: str) -> Dict:
        await self._ensure_folder_exists(folder_path)
        
        file_path = f"{folder_path.strip('/')}/{filename}"
        
        # For files < 4MB, use simple upload
        if len(file_content) < 4 * 1024 * 1024:
            token = await self._get_token()
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    f"https://graph.microsoft.com/v1.0/me/drive/root:/{file_path}:/content",
                    headers={'Authorization': f'Bearer {token}'},
                    content=file_content
                )
                response.raise_for_status()
                result = response.json()
        else:
            # TODO: Implement resumable upload for larger files
            raise Exception("Files larger than 4MB require resumable upload (not implemented)")
        
        # Create sharing link
        share_result = await self._request(
            'POST',
            f"/me/drive/items/{result['id']}/createLink",
            json={"type": "view", "scope": "anonymous"}
        )
        
        return {
            'id': result['id'],
            'name': result['name'],
            'path': file_path,
            'url': share_result.get('link', {}).get('webUrl'),
            'provider': 'onedrive'
        }
    
    async def download_file(self, file_id: str) -> bytes:
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.microsoft.com/v1.0/me/drive/items/{file_id}/content",
                headers={'Authorization': f'Bearer {token}'},
                follow_redirects=True
            )
            response.raise_for_status()
            return response.content
    
    async def delete_file(self, file_id: str) -> bool:
        await self._request('DELETE', f"/me/drive/items/{file_id}")
        return True
    
    async def list_files(self, folder_path: str) -> List[Dict]:
        try:
            result = await self._request('GET', f"/me/drive/root:/{folder_path}:/children")
        except httpx.HTTPStatusError:
            return []
        
        return [{
            'id': f['id'],
            'name': f['name'],
            'type': 'folder' if 'folder' in f else 'file',
            'size': f.get('size', 0),
            'created': f.get('createdDateTime'),
            'url': f.get('webUrl')
        } for f in result.get('value', [])]
    
    async def create_folder(self, folder_name: str, parent_path: str) -> Dict:
        await self._ensure_folder_exists(f"{parent_path}/{folder_name}")
        return {'name': folder_name, 'path': f"{parent_path}/{folder_name}", 'provider': 'onedrive'}
    
    async def get_file_url(self, file_id: str) -> str:
        result = await self._request(
            'POST',
            f"/me/drive/items/{file_id}/createLink",
            json={"type": "view", "scope": "anonymous"}
        )
        return result.get('link', {}).get('webUrl')


class TeraboxProvider(CloudStorageProvider):
    """Terabox implementation using their API or local storage fallback"""
    
    def __init__(self, credentials: Dict, parceiro_id: str):
        self.credentials = credentials
        self.parceiro_id = parceiro_id
        self.base_path = f"/app/backend/uploads/terabox/{parceiro_id}"
        os.makedirs(self.base_path, exist_ok=True)
    
    async def upload_file(self, file_content: bytes, filename: str, folder_path: str) -> Dict:
        # Create folder structure
        full_folder = os.path.join(self.base_path, folder_path.strip('/'))
        os.makedirs(full_folder, exist_ok=True)
        
        # Save file
        file_path = os.path.join(full_folder, filename)
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_content)
        
        # Generate relative path for URL
        relative_path = os.path.relpath(file_path, "/app/backend/uploads")
        
        return {
            'id': relative_path,
            'name': filename,
            'path': file_path,
            'url': f"/api/uploads/{relative_path}",
            'provider': 'terabox'
        }
    
    async def download_file(self, file_id: str) -> bytes:
        file_path = os.path.join("/app/backend/uploads", file_id)
        async with aiofiles.open(file_path, 'rb') as f:
            return await f.read()
    
    async def delete_file(self, file_id: str) -> bool:
        file_path = os.path.join("/app/backend/uploads", file_id)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    
    async def list_files(self, folder_path: str) -> List[Dict]:
        full_path = os.path.join(self.base_path, folder_path.strip('/'))
        
        if not os.path.exists(full_path):
            return []
        
        files = []
        for entry in os.listdir(full_path):
            entry_path = os.path.join(full_path, entry)
            stat = os.stat(entry_path)
            files.append({
                'id': os.path.relpath(entry_path, "/app/backend/uploads"),
                'name': entry,
                'type': 'folder' if os.path.isdir(entry_path) else 'file',
                'size': stat.st_size,
                'created': datetime.fromtimestamp(stat.st_ctime).isoformat()
            })
        
        return files
    
    async def create_folder(self, folder_name: str, parent_path: str) -> Dict:
        full_path = os.path.join(self.base_path, parent_path.strip('/'), folder_name)
        os.makedirs(full_path, exist_ok=True)
        return {'name': folder_name, 'path': full_path, 'provider': 'terabox'}
    
    async def get_file_url(self, file_id: str) -> str:
        return f"/api/uploads/{file_id}"


class CloudStorageService:
    """Unified service for cloud storage operations"""
    
    @staticmethod
    async def get_provider(parceiro_id: str) -> Optional[CloudStorageProvider]:
        """Get the configured cloud provider for a partner"""
        # Get partner's storage config
        config = await db.storage_config.find_one(
            {"parceiro_id": parceiro_id},
            {"_id": 0}
        )
        
        if not config or config.get("modo") == "local":
            return None
        
        provider_name = config.get("cloud_provider")
        if not provider_name or provider_name == "none":
            return None
        
        # Get credentials
        credentials = await db.cloud_credentials.find_one(
            {"parceiro_id": parceiro_id, "provider": provider_name},
            {"_id": 0}
        )
        
        if not credentials or not credentials.get("access_token"):
            return None
        
        # Create provider instance
        if provider_name == "google_drive":
            return GoogleDriveProvider(credentials)
        elif provider_name == "dropbox":
            return DropboxProvider(credentials)
        elif provider_name == "onedrive":
            return OneDriveProvider(credentials)
        elif provider_name == "terabox":
            return TeraboxProvider(credentials, parceiro_id)
        
        return None
    
    @staticmethod
    async def upload_document(
        parceiro_id: str,
        file_content: bytes,
        filename: str,
        document_type: str,  # 'relatorio', 'recibo', 'vistoria', 'documento_veiculo', etc.
        entity_id: Optional[str] = None,  # e.g., veiculo_id, motorista_id
        entity_name: Optional[str] = None  # e.g., matrícula, nome do motorista
    ) -> Dict:
        """Upload a document using the partner's configured storage"""
        
        # Get config
        config = await db.storage_config.find_one({"parceiro_id": parceiro_id}, {"_id": 0})
        modo = config.get("modo", "local") if config else "local"
        
        # Build folder path based on document type
        folder_mapping = {
            'relatorio': 'Relatorios',
            'recibo': 'Recibos',
            'vistoria': 'Vistorias',
            'documento_veiculo': f'Veiculos/{entity_name or entity_id}',
            'documento_motorista': f'Motoristas/{entity_name or entity_id}',
            'contrato': 'Contratos',
            'comprovativo': 'Comprovativos'
        }
        
        base_folder = config.get("pasta_raiz", "/TVDEFleet") if config else "/TVDEFleet"
        folder_path = f"{base_folder}/{folder_mapping.get(document_type, 'Outros')}"
        
        result = {
            'local_path': None,
            'cloud_path': None,
            'cloud_url': None,
            'provider': None,
            'modo': modo
        }
        
        # Save locally if mode is 'local' or 'both'
        if modo in ['local', 'both']:
            local_folder = f"/app/backend/uploads/documentos/{parceiro_id}/{document_type}"
            os.makedirs(local_folder, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            local_filename = f"{timestamp}_{filename}"
            local_path = os.path.join(local_folder, local_filename)
            
            async with aiofiles.open(local_path, 'wb') as f:
                await f.write(file_content)
            
            result['local_path'] = local_path
        
        # Upload to cloud if mode is 'cloud' or 'both'
        if modo in ['cloud', 'both']:
            provider = await CloudStorageService.get_provider(parceiro_id)
            
            if provider:
                try:
                    cloud_result = await provider.upload_file(file_content, filename, folder_path)
                    result['cloud_path'] = cloud_result.get('path') or cloud_result.get('id')
                    result['cloud_url'] = cloud_result.get('url')
                    result['provider'] = cloud_result.get('provider')
                    
                    # Log sync
                    await db.sync_log.insert_one({
                        "parceiro_id": parceiro_id,
                        "tipo": "upload",
                        "documento_tipo": document_type,
                        "filename": filename,
                        "cloud_path": result['cloud_path'],
                        "status": "success",
                        "data": datetime.now(timezone.utc)
                    })
                    
                except Exception as e:
                    logger.error(f"Cloud upload failed for {parceiro_id}: {e}")
                    
                    # Add to sync queue for retry
                    if modo == 'cloud':
                        await db.sync_queue.insert_one({
                            "parceiro_id": parceiro_id,
                            "tipo": "upload",
                            "documento_tipo": document_type,
                            "filename": filename,
                            "local_path": result.get('local_path'),
                            "folder_path": folder_path,
                            "status": "pending",
                            "error": str(e),
                            "retries": 0,
                            "created_at": datetime.now(timezone.utc)
                        })
                    
                    result['error'] = str(e)
        
        return result
    
    @staticmethod
    async def get_document_url(parceiro_id: str, document_path: str, provider: str = None) -> str:
        """Get download URL for a document"""
        if not provider or provider == 'local':
            return f"/api/uploads/{document_path}"
        
        cloud_provider = await CloudStorageService.get_provider(parceiro_id)
        if cloud_provider:
            try:
                return await cloud_provider.get_file_url(document_path)
            except Exception as e:
                logger.error(f"Failed to get URL for {document_path}: {e}")
        
        return None
