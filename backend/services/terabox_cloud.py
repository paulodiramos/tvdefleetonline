"""
Terabox Official Cloud Integration Service
Sincroniza ficheiros com a conta Terabox do parceiro
"""

import os
import hashlib
import httpx
import logging
from typing import Dict, Optional, List
from pathlib import Path

logger = logging.getLogger(__name__)

TERABOX_API_BASE = "https://www.terabox.com/api"
TERABOX_PAN_API = "https://pan.terabox.com/rest/2.0"


class TeraboxCloudService:
    """Serviço para integração com Terabox Cloud"""
    
    def __init__(self, access_token: str = None, cookie: str = None):
        """
        Inicializa o serviço Terabox
        
        Args:
            access_token: Token de acesso da API Terabox (se disponível)
            cookie: Cookie de sessão do Terabox (alternativa ao token)
        """
        self.access_token = access_token
        self.cookie = cookie
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        }
        
        if cookie:
            self.headers["Cookie"] = cookie
    
    async def test_connection(self) -> Dict:
        """Testa a conexão com o Terabox"""
        try:
            async with httpx.AsyncClient() as client:
                # Tentar obter informação do utilizador
                url = f"{TERABOX_PAN_API}/xpan/nas"
                params = {"method": "uinfo"}
                
                if self.access_token:
                    params["access_token"] = self.access_token
                
                response = await client.get(url, params=params, headers=self.headers, timeout=30.0)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("errno") == 0:
                        return {
                            "success": True,
                            "message": "Conexão estabelecida",
                            "user_info": data.get("user_info", {})
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Erro Terabox: {data.get('errmsg', 'Desconhecido')}"
                        }
                else:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status_code}"
                    }
                    
        except Exception as e:
            logger.error(f"Erro ao testar conexão Terabox: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_quota(self) -> Dict:
        """Obter informação de quota/espaço"""
        try:
            async with httpx.AsyncClient() as client:
                url = f"{TERABOX_PAN_API}/xpan/nas"
                params = {"method": "uinfo"}
                
                if self.access_token:
                    params["access_token"] = self.access_token
                
                response = await client.get(url, params=params, headers=self.headers, timeout=30.0)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("errno") == 0:
                        return {
                            "success": True,
                            "total": data.get("total", 0),
                            "used": data.get("used", 0),
                            "free": data.get("total", 0) - data.get("used", 0)
                        }
                
                return {"success": False, "error": "Não foi possível obter quota"}
                
        except Exception as e:
            logger.error(f"Erro ao obter quota: {e}")
            return {"success": False, "error": str(e)}
    
    async def list_files(self, path: str = "/") -> Dict:
        """Listar ficheiros numa pasta"""
        try:
            async with httpx.AsyncClient() as client:
                url = f"{TERABOX_PAN_API}/xpan/file"
                params = {
                    "method": "list",
                    "dir": path,
                    "order": "name",
                    "start": 0,
                    "limit": 100
                }
                
                if self.access_token:
                    params["access_token"] = self.access_token
                
                response = await client.get(url, params=params, headers=self.headers, timeout=30.0)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("errno") == 0:
                        return {
                            "success": True,
                            "files": data.get("list", [])
                        }
                    else:
                        return {
                            "success": False,
                            "error": data.get("errmsg", "Erro desconhecido")
                        }
                
                return {"success": False, "error": f"HTTP {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Erro ao listar ficheiros: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_folder(self, path: str) -> Dict:
        """Criar pasta no Terabox"""
        try:
            async with httpx.AsyncClient() as client:
                url = f"{TERABOX_PAN_API}/xpan/file"
                params = {"method": "create"}
                
                if self.access_token:
                    params["access_token"] = self.access_token
                
                data = {
                    "path": path,
                    "isdir": 1,
                    "size": 0,
                    "block_list": "[]"
                }
                
                response = await client.post(url, params=params, data=data, headers=self.headers, timeout=30.0)
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("errno") == 0:
                        return {
                            "success": True,
                            "path": result.get("path"),
                            "fs_id": result.get("fs_id")
                        }
                    elif result.get("errno") == -8:
                        # Pasta já existe
                        return {"success": True, "path": path, "exists": True}
                    else:
                        return {
                            "success": False,
                            "error": result.get("errmsg", f"Errno: {result.get('errno')}")
                        }
                
                return {"success": False, "error": f"HTTP {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Erro ao criar pasta: {e}")
            return {"success": False, "error": str(e)}
    
    async def upload_file(self, local_path: str, remote_path: str) -> Dict:
        """
        Upload de ficheiro para o Terabox
        
        Args:
            local_path: Caminho local do ficheiro
            remote_path: Caminho destino no Terabox
        """
        try:
            if not os.path.exists(local_path):
                return {"success": False, "error": "Ficheiro local não encontrado"}
            
            file_size = os.path.getsize(local_path)
            
            # Calcular MD5 do ficheiro
            with open(local_path, "rb") as f:
                file_md5 = hashlib.md5(f.read()).hexdigest()
            
            async with httpx.AsyncClient() as client:
                # Passo 1: Pre-create
                precreate_url = f"{TERABOX_PAN_API}/xpan/file"
                precreate_params = {"method": "precreate"}
                
                if self.access_token:
                    precreate_params["access_token"] = self.access_token
                
                precreate_data = {
                    "path": remote_path,
                    "size": file_size,
                    "isdir": 0,
                    "autoinit": 1,
                    "block_list": f'["{file_md5}"]'
                }
                
                precreate_response = await client.post(
                    precreate_url,
                    params=precreate_params,
                    data=precreate_data,
                    headers=self.headers,
                    timeout=30.0
                )
                
                if precreate_response.status_code != 200:
                    return {"success": False, "error": f"Precreate failed: HTTP {precreate_response.status_code}"}
                
                precreate_result = precreate_response.json()
                
                if precreate_result.get("errno") != 0:
                    return {"success": False, "error": f"Precreate error: {precreate_result.get('errmsg')}"}
                
                upload_id = precreate_result.get("uploadid")
                
                # Passo 2: Upload do ficheiro
                upload_url = f"{TERABOX_PAN_API}/pcs/superfile2"
                upload_params = {
                    "method": "upload",
                    "type": "tmpfile",
                    "path": remote_path,
                    "uploadid": upload_id,
                    "partseq": 0
                }
                
                if self.access_token:
                    upload_params["access_token"] = self.access_token
                
                with open(local_path, "rb") as f:
                    files = {"file": (os.path.basename(local_path), f)}
                    upload_response = await client.post(
                        upload_url,
                        params=upload_params,
                        files=files,
                        headers=self.headers,
                        timeout=300.0  # 5 minutos para ficheiros grandes
                    )
                
                if upload_response.status_code != 200:
                    return {"success": False, "error": f"Upload failed: HTTP {upload_response.status_code}"}
                
                upload_result = upload_response.json()
                
                if upload_result.get("errno") and upload_result.get("errno") != 0:
                    return {"success": False, "error": f"Upload error: {upload_result.get('errmsg')}"}
                
                # Passo 3: Create (finalizar upload)
                create_url = f"{TERABOX_PAN_API}/xpan/file"
                create_params = {"method": "create"}
                
                if self.access_token:
                    create_params["access_token"] = self.access_token
                
                create_data = {
                    "path": remote_path,
                    "size": file_size,
                    "isdir": 0,
                    "uploadid": upload_id,
                    "block_list": f'["{upload_result.get("md5", file_md5)}"]'
                }
                
                create_response = await client.post(
                    create_url,
                    params=create_params,
                    data=create_data,
                    headers=self.headers,
                    timeout=30.0
                )
                
                if create_response.status_code != 200:
                    return {"success": False, "error": f"Create failed: HTTP {create_response.status_code}"}
                
                create_result = create_response.json()
                
                if create_result.get("errno") == 0:
                    return {
                        "success": True,
                        "path": create_result.get("path"),
                        "fs_id": create_result.get("fs_id"),
                        "size": file_size
                    }
                else:
                    return {
                        "success": False,
                        "error": create_result.get("errmsg", f"Errno: {create_result.get('errno')}")
                    }
                    
        except Exception as e:
            logger.error(f"Erro ao fazer upload: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_folder_structure(self, base_path: str, folders: List[str]) -> Dict:
        """Criar estrutura de pastas"""
        results = []
        
        for folder in folders:
            full_path = f"{base_path}/{folder}".replace("//", "/")
            result = await self.create_folder(full_path)
            results.append({
                "path": full_path,
                "success": result.get("success", False),
                "error": result.get("error")
            })
        
        success_count = sum(1 for r in results if r["success"])
        
        return {
            "success": success_count == len(folders),
            "total": len(folders),
            "created": success_count,
            "results": results
        }


async def get_terabox_service(db, parceiro_id: str) -> Optional[TeraboxCloudService]:
    """
    Obter serviço Terabox configurado para um parceiro
    
    Args:
        db: Base de dados
        parceiro_id: ID do parceiro
    
    Returns:
        TeraboxCloudService configurado ou None
    """
    # Buscar credenciais do parceiro
    credentials = await db.terabox_credentials.find_one(
        {"parceiro_id": parceiro_id},
        {"_id": 0}
    )
    
    if not credentials:
        return None
    
    # Verificar se tem access_token ou cookie
    access_token = credentials.get("access_token")
    cookie = credentials.get("cookie") or credentials.get("session_cookie")
    
    if not access_token and not cookie:
        return None
    
    return TeraboxCloudService(access_token=access_token, cookie=cookie)
