"""
Terabox Official Cloud Integration Service
Sincroniza ficheiros com a conta Terabox do parceiro
"""

import os
import hashlib
import httpx
import logging
import json
from typing import Dict, Optional, List
from pathlib import Path

logger = logging.getLogger(__name__)

# URLs da API do Terabox
TERABOX_API_BASE = "https://www.terabox.com/api"
TERABOX_WEB_API = "https://www.terabox.com"
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
        self.cookie = self._format_cookie(cookie) if cookie else None
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Origin": "https://www.terabox.com",
            "Referer": "https://www.terabox.com/",
        }
        
        if self.cookie:
            self.headers["Cookie"] = self.cookie
    
    def _format_cookie(self, cookie: str) -> str:
        """Formata o cookie para o formato correto"""
        if not cookie:
            return ""
        
        cookie = cookie.strip()
        
        # Se o cookie já está no formato completo
        if "ndus=" in cookie or "BDUSS=" in cookie:
            return cookie
        
        # Se é só o valor do ndus
        if not "=" in cookie:
            return f"ndus={cookie}"
        
        return cookie
    
    async def test_connection(self) -> Dict:
        """Testa a conexão com o Terabox"""
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                # Método 1: Tentar endpoint de quota (mais simples)
                url = f"{TERABOX_WEB_API}/api/quota"
                params = {"checkfree": 1, "checkexpire": 1}
                
                response = await client.get(url, params=params, headers=self.headers, timeout=30.0)
                
                logger.info(f"Terabox test_connection response: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Terabox quota response: {data}")
                    
                    if data.get("errno") == 0:
                        return {
                            "success": True,
                            "message": "Conexão estabelecida com sucesso!",
                            "quota": {
                                "total": data.get("total", 0),
                                "used": data.get("used", 0),
                                "free": data.get("total", 0) - data.get("used", 0)
                            }
                        }
                    elif data.get("errno") == -6:
                        return {
                            "success": False,
                            "error": "Sessão expirada. Por favor, obtenha um novo cookie de sessão."
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Erro Terabox (código {data.get('errno')}): {data.get('errmsg', 'Desconhecido')}"
                        }
                else:
                    return {
                        "success": False,
                        "error": f"Erro HTTP {response.status_code}"
                    }
                    
        except httpx.TimeoutException:
            return {"success": False, "error": "Timeout ao conectar ao Terabox. Tente novamente."}
        except Exception as e:
            logger.error(f"Erro ao testar conexão Terabox: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_quota(self) -> Dict:
        """Obter informação de quota/espaço"""
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                url = f"{TERABOX_WEB_API}/api/quota"
                params = {"checkfree": 1, "checkexpire": 1}
                
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
            async with httpx.AsyncClient(follow_redirects=True) as client:
                url = f"{TERABOX_WEB_API}/api/list"
                params = {
                    "dir": path,
                    "order": "name",
                    "desc": 0,
                    "num": 100,
                    "page": 1
                }
                
                response = await client.get(url, params=params, headers=self.headers, timeout=30.0)
                
                logger.info(f"Terabox list_files response: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("errno") == 0:
                        return {
                            "success": True,
                            "files": data.get("list", [])
                        }
                    elif data.get("errno") == -6:
                        return {
                            "success": False,
                            "error": "Sessão expirada"
                        }
                    else:
                        return {
                            "success": False,
                            "error": data.get("errmsg", f"Erro código {data.get('errno')}")
                        }
                
                return {"success": False, "error": f"HTTP {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Erro ao listar ficheiros: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_folder(self, path: str) -> Dict:
        """Criar pasta no Terabox"""
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                url = f"{TERABOX_WEB_API}/api/create"
                params = {"a": "commit"}
                
                data = {
                    "path": path,
                    "isdir": "1",
                    "block_list": "[]"
                }
                
                response = await client.post(url, params=params, data=data, headers=self.headers, timeout=30.0)
                
                logger.info(f"Terabox create_folder response: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"Terabox create_folder result: {result}")
                    
                    if result.get("errno") == 0:
                        return {
                            "success": True,
                            "path": result.get("path") or path,
                            "fs_id": result.get("fs_id")
                        }
                    elif result.get("errno") == -8:
                        # Pasta já existe - não é erro
                        return {"success": True, "path": path, "exists": True}
                    elif result.get("errno") == -6:
                        return {
                            "success": False,
                            "error": "Sessão expirada"
                        }
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
            file_name = os.path.basename(local_path)
            
            # Calcular MD5 do ficheiro
            with open(local_path, "rb") as f:
                file_content = f.read()
                file_md5 = hashlib.md5(file_content).hexdigest()
            
            logger.info(f"Terabox upload: {file_name}, size={file_size}, md5={file_md5}")
            
            async with httpx.AsyncClient(follow_redirects=True, timeout=300.0) as client:
                # Passo 1: Pre-create (registar intenção de upload)
                precreate_url = f"{TERABOX_WEB_API}/api/precreate"
                
                precreate_data = {
                    "path": remote_path,
                    "size": file_size,
                    "path": remote_path,
                    "size": str(file_size),
                    "isdir": "0",
                    "autoinit": "1",
                    "block_list": json.dumps([file_md5])
                }
                
                precreate_response = await client.post(
                    precreate_url,
                    data=precreate_data,
                    headers=self.headers
                )
                
                logger.info(f"Terabox precreate response: {precreate_response.status_code}")
                
                if precreate_response.status_code != 200:
                    return {"success": False, "error": f"Precreate failed: HTTP {precreate_response.status_code}"}
                
                precreate_result = precreate_response.json()
                logger.info(f"Terabox precreate result: {precreate_result}")
                
                if precreate_result.get("errno") != 0:
                    if precreate_result.get("errno") == -6:
                        return {"success": False, "error": "Sessão expirada"}
                    return {"success": False, "error": f"Precreate error: {precreate_result.get('errmsg', precreate_result.get('errno'))}"}
                
                upload_id = precreate_result.get("uploadid")
                
                if not upload_id:
                    # Ficheiro pode já existir ou foi aceite diretamente
                    if precreate_result.get("return_type") == 2:
                        return {
                            "success": True,
                            "path": remote_path,
                            "message": "Ficheiro já existe",
                            "exists": True
                        }
                    return {"success": False, "error": "Upload ID não recebido"}
                
                # Passo 2: Upload do ficheiro
                upload_url = f"https://c-jp.terabox.com/rest/2.0/pcs/superfile2"
                upload_params = {
                    "method": "upload",
                    "type": "tmpfile",
                    "path": remote_path,
                    "uploadid": upload_id,
                    "partseq": "0"
                }
                
                # Para upload de ficheiro, precisamos enviar sem Content-Type no header
                upload_headers = {**self.headers}
                upload_headers.pop("Accept", None)
                
                with open(local_path, "rb") as f:
                    files = {"file": (file_name, f, "application/octet-stream")}
                    upload_response = await client.post(
                        upload_url,
                        params=upload_params,
                        files=files,
                        headers=upload_headers,
                        timeout=300.0
                    )
                
                logger.info(f"Terabox upload response: {upload_response.status_code}")
                
                if upload_response.status_code != 200:
                    return {"success": False, "error": f"Upload failed: HTTP {upload_response.status_code}"}
                
                upload_result = upload_response.json()
                logger.info(f"Terabox upload result: {upload_result}")
                
                if upload_result.get("errno") and upload_result.get("errno") != 0:
                    return {"success": False, "error": f"Upload error: {upload_result.get('errmsg')}"}
                
                # Passo 3: Create (finalizar upload)
                create_url = f"{TERABOX_WEB_API}/api/create"
                params = {"a": "commit"}
                
                create_data = {
                    "path": remote_path,
                    "size": str(file_size),
                    "isdir": "0",
                    "uploadid": upload_id,
                    "block_list": json.dumps([upload_result.get("md5", file_md5)])
                }
                
                create_response = await client.post(
                    create_url,
                    params=params,
                    data=create_data,
                    headers=self.headers
                )
                
                logger.info(f"Terabox create response: {create_response.status_code}")
                
                if create_response.status_code != 200:
                    return {"success": False, "error": f"Create failed: HTTP {create_response.status_code}"}
                
                create_result = create_response.json()
                logger.info(f"Terabox create result: {create_result}")
                
                if create_result.get("errno") == 0:
                    return {
                        "success": True,
                        "path": create_result.get("path") or remote_path,
                        "fs_id": create_result.get("fs_id"),
                        "size": file_size
                    }
                elif create_result.get("errno") == -8:
                    return {
                        "success": True,
                        "path": remote_path,
                        "message": "Ficheiro já existe",
                        "exists": True
                    }
                else:
                    return {
                        "success": False,
                        "error": create_result.get("errmsg", f"Errno: {create_result.get('errno')}")
                    }
                    
        except httpx.TimeoutException:
            return {"success": False, "error": "Timeout durante upload"}
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
