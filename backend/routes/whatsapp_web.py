"""WhatsApp Web Integration for TVDEFleet
Uses local Node.js WhatsApp Web service with QR Code authentication
Each partner has their own WhatsApp session
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import httpx
import logging
import os

from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter(prefix="/whatsapp-web", tags=["whatsapp-web"])
db = get_database()
logger = logging.getLogger(__name__)

# WhatsApp Web Service URL (Node.js microservice)
WHATSAPP_SERVICE_URL = os.environ.get("WHATSAPP_SERVICE_URL", "http://localhost:3001")


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"


class WhatsAppSendMessage(BaseModel):
    """Model for sending WhatsApp message"""
    phone: str
    message: str
    motorista_id: Optional[str] = None


class WhatsAppBulkMessage(BaseModel):
    """Model for bulk WhatsApp messages"""
    recipients: List[Dict]  # [{"phone": "...", "name": "...", "motorista_id": "..."}]
    message: str  # Use {nome} for personalization


class WhatsAppAlertConfig(BaseModel):
    """Configuration for automatic WhatsApp alerts"""
    alertas_documentos: bool = False
    alertas_manutencao: bool = False
    alertas_vencimentos: bool = False
    relatorio_semanal: bool = False
    dias_antecedencia: int = 7


def get_parceiro_id(current_user: Dict) -> str:
    """Get parceiro_id from current user"""
    if current_user["role"] in [UserRole.PARCEIRO, "parceiro"]:
        return current_user["id"]
    elif current_user["role"] in [UserRole.GESTAO, "gestao"]:
        return current_user.get("parceiro_ativo") or current_user.get("associated_partner_id") or current_user["id"]
    elif current_user["role"] in [UserRole.ADMIN, "admin"]:
        return current_user.get("parceiro_ativo") or "admin"
    return current_user["id"]


# ==================== SERVICE STATUS ====================

@router.get("/health")
async def whatsapp_service_health():
    """Check WhatsApp Web Service health"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/health")
            return response.json()
    except Exception as e:
        return {
            "status": "offline",
            "error": str(e),
            "service_url": WHATSAPP_SERVICE_URL
        }


@router.get("/system-info")
async def whatsapp_system_info(current_user: Dict = Depends(get_current_user)):
    """Get WhatsApp service system info (admin only)"""
    if current_user["role"] not in ["admin"]:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/system-info")
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Serviço indisponível: {str(e)}")


# ==================== SESSION MANAGEMENT ====================

@router.get("/status")
async def get_whatsapp_status(current_user: Dict = Depends(get_current_user)):
    """Get WhatsApp connection status for current partner"""
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/status/{parceiro_id}")
            data = response.json()
            
            # Add parceiro_id to response
            data["parceiro_id"] = parceiro_id
            return data
            
    except httpx.ConnectError:
        return {
            "connected": False,
            "ready": False,
            "hasQrCode": False,
            "error": "Serviço WhatsApp não está em execução",
            "parceiro_id": parceiro_id,
            "service_status": "offline"
        }
    except Exception as e:
        return {
            "connected": False,
            "ready": False,
            "hasQrCode": False,
            "error": str(e),
            "parceiro_id": parceiro_id
        }


@router.get("/qr")
async def get_qr_code(current_user: Dict = Depends(get_current_user)):
    """Get QR code for WhatsApp authentication"""
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/qr/{parceiro_id}")
            data = response.json()
            data["parceiro_id"] = parceiro_id
            return data
            
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503, 
            detail="Serviço WhatsApp não está em execução. Contacte o administrador."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logout")
async def logout_whatsapp(current_user: Dict = Depends(get_current_user)):
    """Disconnect WhatsApp session"""
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/logout/{parceiro_id}")
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restart")
async def restart_whatsapp(current_user: Dict = Depends(get_current_user)):
    """Restart WhatsApp session"""
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/restart/{parceiro_id}")
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
async def list_all_sessions(current_user: Dict = Depends(get_current_user)):
    """List all active WhatsApp sessions (admin only)"""
    if current_user["role"] not in ["admin"]:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/sessions")
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


# ==================== MESSAGING ====================

@router.post("/send")
async def send_whatsapp_message(
    data: WhatsAppSendMessage,
    current_user: Dict = Depends(get_current_user)
):
    """Send a WhatsApp message"""
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send/{parceiro_id}",
                json={"phone": data.phone, "message": data.message}
            )
            result = response.json()
            
            # Log the message
            await db.whatsapp_logs.insert_one({
                "tipo": "envio",
                "parceiro_id": parceiro_id,
                "telefone": data.phone,
                "motorista_id": data.motorista_id,
                "mensagem": data.message[:500],
                "status": "enviado" if result.get("success") else "erro",
                "erro": result.get("error"),
                "api": "web",
                "enviado_por": current_user["id"],
                "data": datetime.now(timezone.utc)
            })
            
            return result
            
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Serviço WhatsApp não disponível")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-bulk")
async def send_bulk_whatsapp(
    data: WhatsAppBulkMessage,
    current_user: Dict = Depends(get_current_user)
):
    """Send WhatsApp messages to multiple recipients"""
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send-bulk/{parceiro_id}",
                json={
                    "recipients": data.recipients,
                    "message": data.message
                }
            )
            result = response.json()
            
            # Log bulk send
            await db.whatsapp_logs.insert_one({
                "tipo": "envio_massa",
                "parceiro_id": parceiro_id,
                "total_destinatarios": len(data.recipients),
                "enviados": result.get("sent", 0),
                "falhados": result.get("failed", 0),
                "mensagem": data.message[:500],
                "api": "web",
                "enviado_por": current_user["id"],
                "data": datetime.now(timezone.utc)
            })
            
            return result
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SEND TO MOTORISTAS ====================

@router.post("/send-to-motorista/{motorista_id}")
async def send_to_motorista(
    motorista_id: str,
    message: str = Body(..., embed=True),
    current_user: Dict = Depends(get_current_user)
):
    """Send WhatsApp message to a specific motorista"""
    parceiro_id = get_parceiro_id(current_user)
    
    # Get motorista phone
    motorista = await db.motoristas.find_one(
        {"id": motorista_id},
        {"_id": 0, "whatsapp": 1, "phone": 1, "nome": 1, "parceiro_id": 1}
    )
    
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    phone = motorista.get("whatsapp") or motorista.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Motorista sem número de WhatsApp/telefone")
    
    # Send message
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send/{parceiro_id}",
                json={"phone": phone, "message": message}
            )
            result = response.json()
            
            # Log
            await db.whatsapp_logs.insert_one({
                "tipo": "envio_motorista",
                "parceiro_id": parceiro_id,
                "motorista_id": motorista_id,
                "motorista_nome": motorista.get("nome"),
                "telefone": phone,
                "mensagem": message[:500],
                "status": "enviado" if result.get("success") else "erro",
                "erro": result.get("error"),
                "api": "web",
                "enviado_por": current_user["id"],
                "data": datetime.now(timezone.utc)
            })
            
            return result
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-to-all-motoristas")
async def send_to_all_motoristas(
    message: str = Body(..., embed=True),
    current_user: Dict = Depends(get_current_user)
):
    """Send WhatsApp message to all motoristas of the partner"""
    parceiro_id = get_parceiro_id(current_user)
    
    # Get all motoristas with phone
    motoristas = await db.motoristas.find(
        {
            "$or": [
                {"parceiro_id": parceiro_id},
                {"parceiro_atribuido": parceiro_id}
            ],
            "deleted": {"$ne": True},
            "$or": [
                {"whatsapp": {"$exists": True, "$ne": ""}},
                {"phone": {"$exists": True, "$ne": ""}}
            ]
        },
        {"_id": 0, "id": 1, "nome": 1, "whatsapp": 1, "phone": 1}
    ).to_list(None)
    
    if not motoristas:
        raise HTTPException(status_code=400, detail="Nenhum motorista com WhatsApp/telefone encontrado")
    
    # Build recipients list
    recipients = []
    for m in motoristas:
        phone = m.get("whatsapp") or m.get("phone")
        if phone:
            recipients.append({
                "phone": phone,
                "name": m.get("nome", ""),
                "motorista_id": m.get("id")
            })
    
    # Send bulk
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send-bulk/{parceiro_id}",
                json={
                    "recipients": recipients,
                    "message": message
                }
            )
            result = response.json()
            
            # Log
            await db.whatsapp_logs.insert_one({
                "tipo": "envio_todos_motoristas",
                "parceiro_id": parceiro_id,
                "total_destinatarios": len(recipients),
                "enviados": result.get("sent", 0),
                "falhados": result.get("failed", 0),
                "mensagem": message[:500],
                "api": "web",
                "enviado_por": current_user["id"],
                "data": datetime.now(timezone.utc)
            })
            
            return result
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ALERTS CONFIGURATION ====================

@router.get("/alerts-config")
async def get_alerts_config(current_user: Dict = Depends(get_current_user)):
    """Get WhatsApp alerts configuration"""
    parceiro_id = get_parceiro_id(current_user)
    
    config = await db.whatsapp_config.find_one(
        {"parceiro_id": parceiro_id},
        {"_id": 0}
    )
    
    return config or {
        "parceiro_id": parceiro_id,
        "alertas_documentos": False,
        "alertas_manutencao": False,
        "alertas_vencimentos": False,
        "relatorio_semanal": False,
        "dias_antecedencia": 7
    }


@router.put("/alerts-config")
async def update_alerts_config(
    config: WhatsAppAlertConfig,
    current_user: Dict = Depends(get_current_user)
):
    """Update WhatsApp alerts configuration"""
    parceiro_id = get_parceiro_id(current_user)
    
    await db.whatsapp_config.update_one(
        {"parceiro_id": parceiro_id},
        {
            "$set": {
                "parceiro_id": parceiro_id,
                "alertas_documentos": config.alertas_documentos,
                "alertas_manutencao": config.alertas_manutencao,
                "alertas_vencimentos": config.alertas_vencimentos,
                "relatorio_semanal": config.relatorio_semanal,
                "dias_antecedencia": config.dias_antecedencia,
                "updated_at": datetime.now(timezone.utc),
                "updated_by": current_user["id"]
            }
        },
        upsert=True
    )
    
    return {"message": "Configuração de alertas guardada"}


# ==================== MESSAGE HISTORY ====================

@router.get("/history")
async def get_message_history(
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    """Get WhatsApp message history"""
    parceiro_id = get_parceiro_id(current_user)
    
    # Admin can see all, others see only their own
    query = {}
    if current_user["role"] not in ["admin"]:
        query["parceiro_id"] = parceiro_id
    
    logs = await db.whatsapp_logs.find(
        query,
        {"_id": 0}
    ).sort("data", -1).limit(limit).to_list(None)
    
    return {
        "total": len(logs),
        "logs": logs
    }


# ==================== MESSAGE TEMPLATES ====================

@router.get("/templates")
async def get_message_templates(current_user: Dict = Depends(get_current_user)):
    """Get predefined message templates"""
    return {
        "templates": [
            {
                "id": "relatorio_semanal",
                "nome": "Relatório Semanal",
                "mensagem": "Olá {nome}! O seu relatório semanal já está disponível na plataforma TVDEFleet. Aceda para consultar os seus ganhos e despesas."
            },
            {
                "id": "documento_expirando",
                "nome": "Documento a Expirar",
                "mensagem": "⚠️ Olá {nome}! O seu documento {documento} expira em {dias} dias. Por favor, renove-o para evitar interrupções."
            },
            {
                "id": "manutencao_agendada",
                "nome": "Manutenção Agendada",
                "mensagem": "🔧 Olá {nome}! O veículo {matricula} tem manutenção agendada para {data}. Confirme a sua disponibilidade."
            },
            {
                "id": "boas_vindas",
                "nome": "Boas-vindas",
                "mensagem": "👋 Bem-vindo à TVDEFleet, {nome}! O seu registo foi concluído. Aceda à plataforma para começar."
            },
            {
                "id": "comunicado_geral",
                "nome": "Comunicado Geral",
                "mensagem": "📢 Olá {nome}! {mensagem}"
            },
            {
                "id": "vistoria_pendente",
                "nome": "Vistoria Pendente",
                "mensagem": "🚗 Olá {nome}! O veículo {matricula} tem uma vistoria pendente. Por favor, agende a sua realização."
            }
        ]
    }
