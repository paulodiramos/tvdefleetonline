"""File Upload Handler with Cloud Storage Integration
Centralizes all file upload operations and automatically syncs to cloud if configured
"""

import os
import aiofiles
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Tuple
from pathlib import Path
from fastapi import UploadFile
import logging

from utils.cloud_storage import CloudStorageService
from utils.database import get_database

logger = logging.getLogger(__name__)
db = get_database()

# Base upload directory
UPLOAD_BASE = Path("/app/backend/uploads")


class FileUploadHandler:
    """Centralized file upload handler that integrates with cloud storage"""
    
    # Document type mappings to folders
    TYPE_FOLDERS = {
        "documento": "documentos",
        "documento_motorista": "documentos_motoristas",
        "documento_veiculo": "vehicle_documents",
        "foto_veiculo": "vehicle_photos_info",
        "foto_motorista": "motoristas",
        "vistoria": "vistorias",
        "contrato": "contratos",
        "recibo": "recibos",
        "comprovativo": "comprovativos_pagamento",
        "relatorio": "relatorios",
        "extintor": "extintor_docs",
        "backup": "backups",
        "csv": "csv_imports",
        "outro": "outros"
    }
    
    @staticmethod
    def get_folder_for_type(doc_type: str) -> str:
        """Get folder name for document type"""
        return FileUploadHandler.TYPE_FOLDERS.get(doc_type, "outros")
    
    @staticmethod
    def generate_filename(original_filename: str, prefix: str = None) -> str:
        """Generate unique filename with timestamp"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        ext = Path(original_filename).suffix.lower()
        
        if prefix:
            return f"{prefix}_{timestamp}_{unique_id}{ext}"
        return f"{timestamp}_{unique_id}{ext}"
    
    @staticmethod
    async def save_file(
        file: UploadFile,
        parceiro_id: str,
        document_type: str,
        entity_id: Optional[str] = None,
        entity_name: Optional[str] = None,
        custom_filename: Optional[str] = None,
        subfolder: Optional[str] = None
    ) -> Dict:
        """
        Save uploaded file locally and sync to cloud if configured.
        
        Args:
            file: The uploaded file
            parceiro_id: Partner ID
            document_type: Type of document (see TYPE_FOLDERS)
            entity_id: Related entity ID (e.g., motorista_id, veiculo_id)
            entity_name: Related entity name (e.g., matrícula, nome)
            custom_filename: Optional custom filename
            subfolder: Optional subfolder within type folder
            
        Returns:
            Dict with local_path, cloud_url, filename, etc.
        """
        # Get storage config for partner
        config = await db.storage_config.find_one(
            {"parceiro_id": parceiro_id},
            {"_id": 0}
        )
        
        modo = config.get("modo", "local") if config else "local"
        
        # Generate filename
        filename = custom_filename or FileUploadHandler.generate_filename(
            file.filename,
            prefix=entity_name or entity_id
        )
        
        # Build local path
        folder = FileUploadHandler.get_folder_for_type(document_type)
        if subfolder:
            folder = f"{folder}/{subfolder}"
        if entity_id:
            folder = f"{folder}/{entity_id}"
        
        local_folder = UPLOAD_BASE / folder
        local_folder.mkdir(parents=True, exist_ok=True)
        local_path = local_folder / filename
        
        # Read file content
        content = await file.read()
        
        result = {
            "filename": filename,
            "original_filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
            "local_path": None,
            "local_url": None,
            "cloud_path": None,
            "cloud_url": None,
            "provider": None,
            "modo": modo,
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Save locally if mode is 'local' or 'both'
        if modo in ["local", "both"]:
            async with aiofiles.open(local_path, 'wb') as f:
                await f.write(content)
            
            relative_path = str(local_path.relative_to(UPLOAD_BASE))
            result["local_path"] = str(local_path)
            result["local_url"] = f"/api/uploads/{relative_path}"
            
            logger.info(f"File saved locally: {local_path}")
        
        # Sync to cloud if mode is 'cloud' or 'both'
        if modo in ["cloud", "both"]:
            try:
                cloud_result = await CloudStorageService.upload_document(
                    parceiro_id=parceiro_id,
                    file_content=content,
                    filename=filename,
                    document_type=document_type,
                    entity_id=entity_id,
                    entity_name=entity_name
                )
                
                result["cloud_path"] = cloud_result.get("cloud_path")
                result["cloud_url"] = cloud_result.get("cloud_url")
                result["provider"] = cloud_result.get("provider")
                
                logger.info(f"File uploaded to cloud: {result['cloud_path']}")
                
            except Exception as e:
                logger.error(f"Cloud upload failed: {e}")
                result["cloud_error"] = str(e)
                
                # If mode is cloud-only and it failed, we need to save locally as fallback
                if modo == "cloud" and not result["local_path"]:
                    async with aiofiles.open(local_path, 'wb') as f:
                        await f.write(content)
                    
                    relative_path = str(local_path.relative_to(UPLOAD_BASE))
                    result["local_path"] = str(local_path)
                    result["local_url"] = f"/api/uploads/{relative_path}"
                    result["fallback"] = True
        
        # Log upload in database
        await db.upload_log.insert_one({
            "parceiro_id": parceiro_id,
            "document_type": document_type,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "filename": filename,
            "original_filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
            "local_path": result.get("local_path"),
            "cloud_path": result.get("cloud_path"),
            "cloud_url": result.get("cloud_url"),
            "provider": result.get("provider"),
            "modo": modo,
            "uploaded_at": datetime.now(timezone.utc)
        })
        
        return result
    
    @staticmethod
    async def get_file_url(
        parceiro_id: str,
        local_path: Optional[str] = None,
        cloud_path: Optional[str] = None,
        provider: Optional[str] = None
    ) -> str:
        """Get the best URL for a file based on storage configuration"""
        
        # If cloud URL exists and partner uses cloud
        if cloud_path and provider:
            config = await db.storage_config.find_one(
                {"parceiro_id": parceiro_id},
                {"_id": 0, "modo": 1}
            )
            
            if config and config.get("modo") in ["cloud", "both"]:
                try:
                    url = await CloudStorageService.get_document_url(
                        parceiro_id, cloud_path, provider
                    )
                    if url:
                        return url
                except Exception as e:
                    logger.warning(f"Failed to get cloud URL: {e}")
        
        # Fallback to local URL
        if local_path:
            relative_path = local_path.replace("/app/backend/uploads/", "")
            return f"/api/uploads/{relative_path}"
        
        return None
    
    @staticmethod
    async def delete_file(
        parceiro_id: str,
        local_path: Optional[str] = None,
        cloud_path: Optional[str] = None,
        provider: Optional[str] = None
    ) -> bool:
        """Delete file from local and/or cloud storage"""
        
        deleted = False
        
        # Delete from local
        if local_path and os.path.exists(local_path):
            try:
                os.remove(local_path)
                deleted = True
                logger.info(f"Deleted local file: {local_path}")
            except Exception as e:
                logger.error(f"Failed to delete local file: {e}")
        
        # Delete from cloud
        if cloud_path and provider:
            try:
                cloud_provider = await CloudStorageService.get_provider(parceiro_id)
                if cloud_provider:
                    await cloud_provider.delete_file(cloud_path)
                    deleted = True
                    logger.info(f"Deleted cloud file: {cloud_path}")
            except Exception as e:
                logger.error(f"Failed to delete cloud file: {e}")
        
        return deleted
    
    @staticmethod
    async def migrate_to_cloud(parceiro_id: str, document_type: str = None) -> Dict:
        """
        Migrate existing local files to cloud storage.
        Use this to move old files to cloud after partner enables cloud mode.
        """
        
        # Get partner's cloud provider
        provider = await CloudStorageService.get_provider(parceiro_id)
        if not provider:
            return {"error": "Cloud provider not configured", "migrated": 0}
        
        # Find files to migrate
        query = {"parceiro_id": parceiro_id, "cloud_path": None}
        if document_type:
            query["document_type"] = document_type
        
        files = await db.upload_log.find(query).to_list(None)
        
        migrated = 0
        errors = 0
        
        for file_record in files:
            local_path = file_record.get("local_path")
            if not local_path or not os.path.exists(local_path):
                continue
            
            try:
                async with aiofiles.open(local_path, 'rb') as f:
                    content = await f.read()
                
                result = await CloudStorageService.upload_document(
                    parceiro_id=parceiro_id,
                    file_content=content,
                    filename=file_record.get("filename"),
                    document_type=file_record.get("document_type"),
                    entity_id=file_record.get("entity_id"),
                    entity_name=file_record.get("entity_name")
                )
                
                # Update record with cloud info
                await db.upload_log.update_one(
                    {"_id": file_record["_id"]},
                    {"$set": {
                        "cloud_path": result.get("cloud_path"),
                        "cloud_url": result.get("cloud_url"),
                        "provider": result.get("provider"),
                        "migrated_at": datetime.now(timezone.utc)
                    }}
                )
                
                migrated += 1
                
            except Exception as e:
                logger.error(f"Migration failed for {local_path}: {e}")
                errors += 1
        
        return {
            "total": len(files),
            "migrated": migrated,
            "errors": errors
        }
