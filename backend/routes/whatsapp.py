"""WhatsApp Web Integration for TVDEFleet
Multi-session support - Each partner has their own WhatsApp connection
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
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

# WhatsApp Web Service Configuration (Node.js service)
WHATSAPP_SERVICE_URL = os.environ.get("WHATSAPP_SERVICE_URL", "http://localhost:3001")


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


# ==================== STATUS & QR CODE ====================

@router.get("/whatsapp/status")
async def get_whatsapp_status(current_user: Dict = Depends(get_current_user)):
    """Obter estado da conexão WhatsApp do parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/status/{parceiro_id}", timeout=10.0)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "parceiro_id": parceiro_id,
                    "conectado": data.get("connected", False),
                    "pronto": data.get("ready", False),
                    "temQrCode": data.get("hasQrCode", False),
                    "erro": data.get("error"),
                    "info": data.get("clientInfo"),
                    "servico_ativo": True
                }
            else:
                return {
                    "parceiro_id": parceiro_id,
                    "conectado": False,
                    "pronto": False,
                    "servico_ativo": False,
                    "erro": "Serviço WhatsApp não respondeu"
                }
    except Exception as e:
        logger.error(f"Erro ao verificar status WhatsApp: {e}")
        return {
            "parceiro_id": parceiro_id,
            "conectado": False,
            "pronto": False,
            "servico_ativo": False,
            "erro": f"Serviço WhatsApp indisponível: {str(e)}"
        }


@router.get("/whatsapp/qr")
async def get_qr_code(current_user: Dict = Depends(get_current_user)):
    """Obter QR Code para escanear com WhatsApp"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/qr/{parceiro_id}", timeout=15.0)
            
            if response.status_code == 200:
                data = response.json()
                data["parceiro_id"] = parceiro_id
                return data
            else:
                raise HTTPException(status_code=500, detail="Erro ao obter QR Code")
                
    except httpx.RequestError as e:
        logger.error(f"Erro ao obter QR Code: {e}")
        raise HTTPException(
            status_code=503, 
            detail="Serviço WhatsApp indisponível. Verifique se está a correr."
        )


@router.post("/whatsapp/logout")
async def logout_whatsapp(current_user: Dict = Depends(get_current_user)):
    """Desconectar do WhatsApp"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/logout/{parceiro_id}", timeout=30.0)
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/whatsapp/restart")
async def restart_whatsapp(current_user: Dict = Depends(get_current_user)):
    """Reiniciar serviço WhatsApp"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/restart/{parceiro_id}", timeout=30.0)
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SEND MESSAGES ====================

async def send_whatsapp_message(phone_number: str, message: str, parceiro_id: str) -> Dict:
    """Enviar mensagem via WhatsApp Web Service usando sessão do parceiro"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send/{parceiro_id}",
                json={"phone": phone_number, "message": message},
                timeout=30.0
            )
            
            data = response.json()
            
            if response.status_code == 200 and data.get("success"):
                # Registar envio
                await db.whatsapp_logs.insert_one({
                    "tipo": "envio",
                    "parceiro_id": parceiro_id,
                    "telefone": phone_number,
                    "mensagem": message[:500],
                    "status": "enviado",
                    "message_id": data.get("messageId"),
                    "data": datetime.now(timezone.utc)
                })
                
                return {"success": True, "message_id": data.get("messageId")}
            else:
                error_msg = data.get("error", "Erro desconhecido")
                
                await db.whatsapp_logs.insert_one({
                    "tipo": "envio",
                    "parceiro_id": parceiro_id,
                    "telefone": phone_number,
                    "mensagem": message[:500],
                    "status": "erro",
                    "erro": error_msg,
                    "data": datetime.now(timezone.utc)
                })
                
                return {"success": False, "error": error_msg}
                
    except httpx.RequestError as e:
        logger.error(f"Erro ao enviar WhatsApp: {e}")
        return {"success": False, "error": f"Serviço indisponível: {str(e)}"}
    except Exception as e:
        logger.error(f"Erro inesperado WhatsApp: {e}")
        return {"success": False, "error": str(e)}


@router.post("/whatsapp/send")
async def send_single_message(
    message: WhatsAppMessage,
    current_user: Dict = Depends(get_current_user)
):
    """Enviar mensagem WhatsApp individual usando sessão do parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    result = await send_whatsapp_message(message.phone_number, message.message, parceiro_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Erro ao enviar"))
    
    return result


@router.post("/whatsapp/send-relatorio/{motorista_id}")
async def send_relatorio_whatsapp(
    motorista_id: str,
    semana: int,
    ano: int,
    current_user: Dict = Depends(get_current_user)
):
    """Enviar relatório semanal via WhatsApp usando sessão do parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    # Buscar motorista
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Buscar telefone - ordem de prioridade: whatsapp > phone > telefone
    telefone = motorista.get("whatsapp") or motorista.get("phone") or motorista.get("telefone")
    if not telefone:
        raise HTTPException(status_code=400, detail="Motorista não tem telefone registado")
    
    # Buscar dados do relatório
    relatorio = await db.relatorios_semanais.find_one({
        "motorista_id": motorista_id,
        "semana": semana,
        "ano": ano
    }, {"_id": 0})
    
    # Construir mensagem
    nome = motorista.get("name", "Motorista")
    
    if relatorio:
        ganhos_uber = relatorio.get("ganhos_uber", 0)
        ganhos_bolt = relatorio.get("ganhos_bolt", 0)
        total_ganhos = ganhos_uber + ganhos_bolt
        despesas = relatorio.get("total_despesas", 0)
        liquido = total_ganhos - despesas
        
        mensagem = f"""📊 *Relatório Semanal - S{semana}/{ano}*

Olá {nome}! 👋

Aqui está o seu resumo semanal:

💰 *Ganhos:*
• Uber: €{ganhos_uber:.2f}
• Bolt: €{ganhos_bolt:.2f}
• Total: €{total_ganhos:.2f}

📉 *Despesas:* €{despesas:.2f}

✅ *Líquido:* €{liquido:.2f}

Para mais detalhes, consulte a app TVDEFleet.

_Mensagem automática - TVDEFleet_"""
    else:
        mensagem = f"""📊 *Relatório Semanal - S{semana}/{ano}*

Olá {nome}! 👋

O seu relatório semanal está disponível para consulta na app TVDEFleet.

_Mensagem automática - TVDEFleet_"""
    
    result = await send_whatsapp_message(telefone, mensagem, parceiro_id)
    
    return {
        "success": result["success"],
        "motorista": nome,
        "telefone": telefone[:6] + "***",
        "parceiro_id": parceiro_id,
        "message": "Relatório enviado via WhatsApp" if result["success"] else result.get("error")
    }


@router.post("/whatsapp/send-bulk")
async def send_bulk_whatsapp(
    data: WhatsAppBulkMessage,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
):
    """Enviar mensagens em massa via WhatsApp usando sessão do parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if not data.motorista_ids:
        raise HTTPException(status_code=400, detail="Nenhum motorista selecionado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    # Processar em background para não bloquear
    background_tasks.add_task(
        process_bulk_whatsapp,
        data.motorista_ids,
        data.message_type,
        data.custom_message,
        data.semana,
        data.ano,
        current_user["id"],
        parceiro_id
    )
    
    return {
        "success": True,
        "parceiro_id": parceiro_id,
        "message": f"Envio de {len(data.motorista_ids)} mensagens iniciado em background"
    }


async def process_bulk_whatsapp(
    motorista_ids: List[str],
    message_type: str,
    custom_message: str,
    semana: int,
    ano: int,
    user_id: str,
    parceiro_id: str
):
    """Processar envio em massa em background usando sessão do parceiro"""
    success_count = 0
    error_count = 0
    
    for motorista_id in motorista_ids:
        try:
            motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
            if not motorista:
                error_count += 1
                continue
            
            # Buscar telefone - ordem de prioridade: whatsapp > phone > telefone
            telefone = motorista.get("whatsapp") or motorista.get("phone") or motorista.get("telefone")
            if not telefone:
                error_count += 1
                continue
            
            nome = motorista.get("name", "Motorista")
            
            # Construir mensagem baseada no tipo
            if message_type == "relatorio" and semana and ano:
                relatorio = await db.relatorios_semanais.find_one({
                    "motorista_id": motorista_id,
                    "semana": semana,
                    "ano": ano
                }, {"_id": 0})
                
                if relatorio:
                    ganhos = relatorio.get("ganhos_uber", 0) + relatorio.get("ganhos_bolt", 0)
                    despesas = relatorio.get("total_despesas", 0)
                    liquido = ganhos - despesas
                    
                    mensagem = f"""📊 *Relatório S{semana}/{ano}*

Olá {nome}!

💰 Ganhos: €{ganhos:.2f}
📉 Despesas: €{despesas:.2f}
✅ Líquido: €{liquido:.2f}

_TVDEFleet_"""
                else:
                    mensagem = f"📊 Olá {nome}! O seu relatório S{semana}/{ano} está disponível. - TVDEFleet"
            
            elif message_type == "status":
                mensagem = f"📋 Olá {nome}! O status do seu relatório foi atualizado. Consulte a app TVDEFleet para mais detalhes."
            
            elif message_type == "vistoria":
                mensagem = f"🚗 Olá {nome}! Tem uma vistoria agendada. Consulte a app TVDEFleet para ver os detalhes."
            
            elif message_type == "custom" and custom_message:
                mensagem = custom_message.replace("{nome}", nome)
            
            else:
                mensagem = f"📱 Olá {nome}! Tem uma nova notificação na app TVDEFleet."
            
            result = await send_whatsapp_message(telefone, mensagem, parceiro_id)
            
            if result["success"]:
                success_count += 1
            else:
                error_count += 1
                
        except Exception as e:
            logger.error(f"Erro ao enviar WhatsApp para {motorista_id}: {e}")
            error_count += 1
    
    # Registar resultado do envio em massa
    await db.whatsapp_logs.insert_one({
        "tipo": "envio_massa",
        "parceiro_id": parceiro_id,
        "message_type": message_type,
        "total": len(motorista_ids),
        "sucesso": success_count,
        "erro": error_count,
        "iniciado_por": user_id,
        "data": datetime.now(timezone.utc)
    })
    
    logger.info(f"[{parceiro_id}] Envio em massa concluído: {success_count} sucesso, {error_count} erros")


@router.post("/whatsapp/notify-status-change")
async def notify_status_change(
    motorista_id: str,
    novo_status: str,
    semana: int,
    ano: int,
    current_user: Dict = Depends(get_current_user)
):
    """Notificar motorista sobre mudança de status via WhatsApp do parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Buscar telefone - ordem de prioridade: whatsapp > phone > telefone
    telefone = motorista.get("whatsapp") or motorista.get("phone") or motorista.get("telefone")
    if not telefone:
        return {"success": False, "message": "Motorista sem telefone"}
    
    nome = motorista.get("name", "Motorista")
    
    status_messages = {
        "aprovado": f"✅ Olá {nome}! O seu relatório S{semana}/{ano} foi *aprovado*.",
        "aguardar_recibo": f"📝 Olá {nome}! Aguardamos o envio do seu recibo verde para S{semana}/{ano}.",
        "a_pagamento": f"💳 Olá {nome}! O pagamento de S{semana}/{ano} está a ser processado.",
        "liquidado": f"💰 Olá {nome}! O pagamento de S{semana}/{ano} foi *efetuado*. Obrigado!"
    }
    
    mensagem = status_messages.get(novo_status, f"📋 Olá {nome}! O status do relatório S{semana}/{ano} foi atualizado para: {novo_status}")
    mensagem += "\n\n_TVDEFleet_"
    
    result = await send_whatsapp_message(telefone, mensagem, parceiro_id)
    
    return {
        "success": result["success"],
        "parceiro_id": parceiro_id,
        "message": "Notificação enviada" if result["success"] else result.get("error")
    }


# ==================== LOGS & STATS ====================

@router.get("/whatsapp/logs")
async def get_whatsapp_logs(
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    """Obter histórico de envios WhatsApp do parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    # Admin vê todos, parceiro/gestor vê apenas os seus
    query = {}
    if current_user["role"] not in [UserRole.ADMIN, "admin"]:
        query["parceiro_id"] = parceiro_id
    
    logs = await db.whatsapp_logs.find(
        query,
        {"_id": 0}
    ).sort("data", -1).limit(limit).to_list(limit)
    
    return logs


@router.get("/whatsapp/stats")
async def get_whatsapp_stats(current_user: Dict = Depends(get_current_user)):
    """Obter estatísticas de envio WhatsApp"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    # Verificar status da conexão
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/status/{parceiro_id}", timeout=5.0)
            status_data = response.json() if response.status_code == 200 else {}
    except:
        status_data = {}
    
    # Admin vê todos, parceiro/gestor vê apenas os seus
    query = {"tipo": "envio"}
    if current_user["role"] not in [UserRole.ADMIN, "admin"]:
        query["parceiro_id"] = parceiro_id
    
    total_enviados = await db.whatsapp_logs.count_documents({**query, "status": "enviado"})
    total_erros = await db.whatsapp_logs.count_documents({**query, "status": "erro"})
    
    # Últimas 24 horas
    from datetime import timedelta
    ontem = datetime.now(timezone.utc) - timedelta(days=1)
    
    enviados_24h = await db.whatsapp_logs.count_documents({
        **query,
        "status": "enviado",
        "data": {"$gte": ontem}
    })
    
    return {
        "parceiro_id": parceiro_id,
        "conectado": status_data.get("connected", False),
        "pronto": status_data.get("ready", False),
        "info": status_data.get("clientInfo"),
        "total_enviados": total_enviados,
        "total_erros": total_erros,
        "enviados_24h": enviados_24h,
        "taxa_sucesso": round(total_enviados / (total_enviados + total_erros) * 100, 1) if (total_enviados + total_erros) > 0 else 0
    }


@router.get("/whatsapp/sessions")
async def get_all_sessions(current_user: Dict = Depends(get_current_user)):
    """Obter todas as sessões WhatsApp ativas (apenas admin)"""
    if current_user["role"] not in [UserRole.ADMIN, "admin"]:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/sessions", timeout=10.0)
            return response.json()
    except Exception as e:
        return {"total": 0, "sessions": [], "error": str(e)}


# ==================== LEGACY CONFIG ENDPOINTS ====================

@router.get("/whatsapp/config")
async def get_whatsapp_config(current_user: Dict = Depends(get_current_user)):
    """Obter configuração - agora retorna status da conexão do parceiro"""
    status = await get_whatsapp_status(current_user)
    
    return {
        "configurado": status.get("pronto", False),
        "ativo": status.get("conectado", False),
        "modo": "whatsapp_web_multisession",
        "parceiro_id": status.get("parceiro_id"),
        "mensagem": "Conectado ao WhatsApp Web" if status.get("pronto") else "Escaneie o QR Code para conectar"
    }


@router.post("/whatsapp/config")
async def save_whatsapp_config(current_user: Dict = Depends(get_current_user)):
    """Endpoint mantido para compatibilidade - redireciona para QR"""
    parceiro_id = get_parceiro_id(current_user)
    return {
        "success": True, 
        "parceiro_id": parceiro_id,
        "message": "Use o endpoint /whatsapp/qr para escanear o QR Code e conectar"
    }
