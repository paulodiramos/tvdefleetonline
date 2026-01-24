"""WhatsApp Cloud API Integration for TVDEFleet
Official Meta/Facebook WhatsApp Business Cloud API
Each partner configures their own WhatsApp Business credentials
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import httpx
import logging
import os

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)

# WhatsApp Cloud API Base URL
WHATSAPP_API_URL = "https://graph.facebook.com/v18.0"


class WhatsAppCloudConfig(BaseModel):
    """Configuration for WhatsApp Cloud API"""
    phone_number_id: str
    access_token: str
    business_account_id: Optional[str] = None
    waba_id: Optional[str] = None
    ativo: bool = False


class WhatsAppMessage(BaseModel):
    """Model for sending WhatsApp message"""
    phone_number: str
    message: str


class WhatsAppBulkMessage(BaseModel):
    """Model for bulk WhatsApp messages"""
    motorista_ids: List[str]
    message_type: str  # relatorio, status, vistoria, custom
    custom_message: Optional[str] = None
    semana: Optional[int] = None
    ano: Optional[int] = None


def get_parceiro_id(current_user: Dict) -> str:
    """Get parceiro_id from current user"""
    if current_user["role"] in [UserRole.PARCEIRO, "parceiro"]:
        return current_user["id"]
    elif current_user["role"] in [UserRole.GESTAO, "gestao"]:
        return current_user.get("parceiro_id") or current_user["id"]
    else:  # Admin
        return current_user.get("parceiro_id") or "admin"


async def get_whatsapp_credentials(parceiro_id: str) -> Optional[Dict]:
    """Get WhatsApp Cloud API credentials for a partner"""
    # Try parceiros collection first
    parceiro = await db.parceiros.find_one(
        {"id": parceiro_id},
        {"_id": 0, "config_whatsapp_cloud": 1}
    )
    if parceiro and parceiro.get("config_whatsapp_cloud"):
        return parceiro["config_whatsapp_cloud"]
    
    # Try users collection
    user = await db.users.find_one(
        {"id": parceiro_id},
        {"_id": 0, "config_whatsapp_cloud": 1}
    )
    if user and user.get("config_whatsapp_cloud"):
        return user["config_whatsapp_cloud"]
    
    return None


async def send_whatsapp_cloud_message(
    phone_number: str,
    message: str,
    parceiro_id: str
) -> Dict:
    """Send message via WhatsApp Cloud API"""
    
    # Get credentials
    config = await get_whatsapp_credentials(parceiro_id)
    
    if not config:
        return {
            "success": False,
            "error": "WhatsApp não configurado. Configure as credenciais da Cloud API nas definições."
        }
    
    if not config.get("ativo"):
        return {
            "success": False,
            "error": "WhatsApp está desativado. Ative nas definições."
        }
    
    phone_number_id = config.get("phone_number_id")
    access_token = config.get("access_token")
    
    if not phone_number_id or not access_token:
        return {
            "success": False,
            "error": "Credenciais WhatsApp incompletas. Configure Phone Number ID e Access Token."
        }
    
    # Format phone number (remove spaces, dashes, and ensure country code)
    phone = phone_number.replace(" ", "").replace("-", "").replace("+", "")
    if phone.startswith("9") and len(phone) == 9:
        phone = "351" + phone
    elif not phone.startswith("351") and len(phone) == 9:
        phone = "351" + phone
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_API_URL}/{phone_number_id}/messages",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": phone,
                    "type": "text",
                    "text": {
                        "preview_url": False,
                        "body": message
                    }
                },
                timeout=30.0
            )
            
            data = response.json()
            
            if response.status_code == 200 and data.get("messages"):
                message_id = data["messages"][0].get("id")
                
                # Log success
                await db.whatsapp_logs.insert_one({
                    "tipo": "envio",
                    "parceiro_id": parceiro_id,
                    "telefone": phone,
                    "mensagem": message[:500],
                    "status": "enviado",
                    "message_id": message_id,
                    "api": "cloud",
                    "data": datetime.now(timezone.utc)
                })
                
                logger.info(f"WhatsApp Cloud message sent to {phone}, ID: {message_id}")
                return {"success": True, "message_id": message_id}
            else:
                error_msg = data.get("error", {}).get("message", "Erro desconhecido")
                error_code = data.get("error", {}).get("code", 0)
                
                # Log error
                await db.whatsapp_logs.insert_one({
                    "tipo": "envio",
                    "parceiro_id": parceiro_id,
                    "telefone": phone,
                    "mensagem": message[:500],
                    "status": "erro",
                    "erro": f"[{error_code}] {error_msg}",
                    "api": "cloud",
                    "data": datetime.now(timezone.utc)
                })
                
                logger.error(f"WhatsApp Cloud error: {error_code} - {error_msg}")
                return {"success": False, "error": error_msg, "code": error_code}
                
    except httpx.RequestError as e:
        logger.error(f"WhatsApp Cloud request error: {e}")
        return {"success": False, "error": f"Erro de conexão: {str(e)}"}
    except Exception as e:
        logger.error(f"WhatsApp Cloud error: {e}")
        return {"success": False, "error": str(e)}


# ==================== API ENDPOINTS ====================

@router.get("/whatsapp/config")
async def get_whatsapp_config(current_user: Dict = Depends(get_current_user)):
    """Get WhatsApp Cloud API configuration for current partner"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    config = await get_whatsapp_credentials(parceiro_id)
    
    if config:
        # Don't return full access token for security
        safe_config = {
            "phone_number_id": config.get("phone_number_id", ""),
            "access_token_configured": bool(config.get("access_token")),
            "business_account_id": config.get("business_account_id", ""),
            "ativo": config.get("ativo", False)
        }
        return safe_config
    
    return {
        "phone_number_id": "",
        "access_token_configured": False,
        "business_account_id": "",
        "ativo": False
    }


@router.put("/whatsapp/config")
async def update_whatsapp_config(
    config: WhatsAppCloudConfig,
    current_user: Dict = Depends(get_current_user)
):
    """Update WhatsApp Cloud API configuration"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    config_data = {
        "phone_number_id": config.phone_number_id,
        "access_token": config.access_token,
        "business_account_id": config.business_account_id,
        "waba_id": config.waba_id,
        "ativo": config.ativo,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user["id"]
    }
    
    # Update in parceiros collection
    result = await db.parceiros.update_one(
        {"id": parceiro_id},
        {"$set": {"config_whatsapp_cloud": config_data}}
    )
    
    # If not found in parceiros, try users
    if result.matched_count == 0:
        await db.users.update_one(
            {"id": parceiro_id},
            {"$set": {"config_whatsapp_cloud": config_data}}
        )
    
    return {"message": "Configuração WhatsApp guardada com sucesso"}


@router.post("/whatsapp/test")
async def test_whatsapp_connection(
    current_user: Dict = Depends(get_current_user)
):
    """Test WhatsApp Cloud API connection by checking phone number status"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    config = await get_whatsapp_credentials(parceiro_id)
    
    if not config:
        raise HTTPException(status_code=400, detail="WhatsApp não configurado")
    
    phone_number_id = config.get("phone_number_id")
    access_token = config.get("access_token")
    
    if not phone_number_id or not access_token:
        raise HTTPException(status_code=400, detail="Credenciais incompletas")
    
    try:
        async with httpx.AsyncClient() as client:
            # Verify phone number
            response = await client.get(
                f"{WHATSAPP_API_URL}/{phone_number_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=15.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "message": "Conexão verificada com sucesso!",
                    "phone_number": data.get("display_phone_number", ""),
                    "verified_name": data.get("verified_name", ""),
                    "quality_rating": data.get("quality_rating", ""),
                    "status": data.get("status", "")
                }
            else:
                error_data = response.json()
                error_msg = error_data.get("error", {}).get("message", "Erro desconhecido")
                raise HTTPException(status_code=400, detail=f"Erro na API: {error_msg}")
                
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Erro de conexão: {str(e)}")


@router.post("/whatsapp/send")
async def send_whatsapp_message_endpoint(
    message: WhatsAppMessage,
    current_user: Dict = Depends(get_current_user)
):
    """Send a WhatsApp message"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    result = await send_whatsapp_cloud_message(
        message.phone_number,
        message.message,
        parceiro_id
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.post("/whatsapp/send-relatorio/{motorista_id}")
async def send_relatorio_whatsapp(
    motorista_id: str,
    semana: Optional[int] = None,
    ano: Optional[int] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Send weekly report to a driver via WhatsApp"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    # Get driver info
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Get phone number
    telefone = motorista.get("whatsapp") or motorista.get("phone") or motorista.get("telefone")
    if not telefone:
        raise HTTPException(status_code=400, detail="Motorista não tem número de telefone")
    
    nome = motorista.get("name") or motorista.get("nome", "Motorista")
    
    # Get current week if not specified
    if not semana or not ano:
        from datetime import date
        today = date.today()
        semana = today.isocalendar()[1]
        ano = today.year
    
    # Build message
    mensagem = f"""📊 *Relatório Semanal - Semana {semana}/{ano}*

Olá {nome}!

O seu relatório semanal já está disponível na plataforma TVDEFleet.

Aceda à sua conta para ver os detalhes completos das suas corridas e ganhos.

Qualquer dúvida, entre em contacto connosco.

_Mensagem enviada automaticamente pelo TVDEFleet_"""
    
    result = await send_whatsapp_cloud_message(telefone, mensagem, parceiro_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {
        "success": True,
        "message": f"Relatório enviado para {nome}",
        "motorista": nome,
        "message_id": result.get("message_id")
    }


@router.post("/whatsapp/send-bulk")
async def send_bulk_whatsapp(
    request: WhatsAppBulkMessage,
    current_user: Dict = Depends(get_current_user)
):
    """Send WhatsApp messages to multiple drivers"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    results = {
        "total": len(request.motorista_ids),
        "enviados": 0,
        "erros": 0,
        "detalhes": []
    }
    
    for motorista_id in request.motorista_ids:
        motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
        if not motorista:
            results["erros"] += 1
            results["detalhes"].append({"id": motorista_id, "erro": "Não encontrado"})
            continue
        
        telefone = motorista.get("whatsapp") or motorista.get("phone") or motorista.get("telefone")
        if not telefone:
            results["erros"] += 1
            results["detalhes"].append({"id": motorista_id, "erro": "Sem telefone"})
            continue
        
        nome = motorista.get("name") or motorista.get("nome", "Motorista")
        
        # Build message based on type
        if request.message_type == "custom" and request.custom_message:
            mensagem = request.custom_message.replace("{nome}", nome)
        else:
            mensagem = f"Olá {nome}! Mensagem do TVDEFleet."
        
        result = await send_whatsapp_cloud_message(telefone, mensagem, parceiro_id)
        
        if result["success"]:
            results["enviados"] += 1
            results["detalhes"].append({"id": motorista_id, "nome": nome, "sucesso": True})
        else:
            results["erros"] += 1
            results["detalhes"].append({"id": motorista_id, "nome": nome, "erro": result["error"]})
    
    return results


@router.get("/whatsapp/status")
async def get_whatsapp_status(current_user: Dict = Depends(get_current_user)):
    """Get WhatsApp integration status"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    config = await get_whatsapp_credentials(parceiro_id)
    
    if not config:
        return {
            "configured": False,
            "active": False,
            "message": "WhatsApp não configurado"
        }
    
    return {
        "configured": bool(config.get("phone_number_id") and config.get("access_token")),
        "active": config.get("ativo", False),
        "message": "WhatsApp configurado" if config.get("ativo") else "WhatsApp desativado"
    }


@router.get("/whatsapp/logs")
async def get_whatsapp_logs(
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    """Get WhatsApp send logs"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    query = {"parceiro_id": parceiro_id} if parceiro_id != "admin" else {}
    
    logs = await db.whatsapp_logs.find(
        query,
        {"_id": 0}
    ).sort("data", -1).limit(limit).to_list(length=limit)
    
    return logs
