"""WhatsApp Business API service for sending messages"""

import httpx
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class WhatsAppService:
    """
    Service for sending WhatsApp messages using WhatsApp Business API
    
    Two modes supported:
    1. WhatsApp Business Cloud API (official Meta API)
    2. WhatsApp Web Link (fallback - generates wa.me links)
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize WhatsApp service
        
        config should contain:
        - api_mode: 'cloud_api' or 'web_link'
        - access_token: Meta Business access token (for cloud_api)
        - phone_number_id: WhatsApp Business phone number ID (for cloud_api)
        - business_phone: Business phone number for display
        """
        self.api_mode = config.get('api_mode', 'web_link')
        self.access_token = config.get('access_token')
        self.phone_number_id = config.get('phone_number_id')
        self.business_phone = config.get('business_phone', '')
        self.api_version = config.get('api_version', 'v18.0')
        self.base_url = f"https://graph.facebook.com/{self.api_version}"
    
    def validate_config(self) -> bool:
        """Validate configuration based on API mode"""
        if self.api_mode == 'cloud_api':
            return bool(self.access_token and self.phone_number_id)
        return True  # web_link mode doesn't require credentials
    
    def format_phone_number(self, phone: str) -> str:
        """Format phone number to international format (remove +, spaces, etc)"""
        # Remove all non-digit characters
        cleaned = ''.join(filter(str.isdigit, phone))
        
        # Add country code if missing (assuming Portugal +351)
        if len(cleaned) == 9 and cleaned.startswith('9'):
            cleaned = '351' + cleaned
        
        return cleaned
    
    async def send_message(
        self,
        to_phone: str,
        message: str,
        template_name: Optional[str] = None,
        template_params: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp message
        
        Args:
            to_phone: Recipient phone number
            message: Message text (for text messages)
            template_name: Template name (for template messages)
            template_params: Template parameters
        
        Returns:
            Dict with success status and details
        """
        formatted_phone = self.format_phone_number(to_phone)
        
        if self.api_mode == 'cloud_api':
            return await self._send_cloud_api(formatted_phone, message, template_name, template_params)
        else:
            return self._generate_web_link(formatted_phone, message)
    
    async def _send_cloud_api(
        self,
        to_phone: str,
        message: str,
        template_name: Optional[str] = None,
        template_params: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Send message via WhatsApp Cloud API"""
        if not self.validate_config():
            return {"success": False, "error": "Configuração da API WhatsApp incompleta"}
        
        url = f"{self.base_url}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        # Build payload based on message type
        if template_name:
            # Template message
            payload = {
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": "pt_PT"},
                    "components": []
                }
            }
            
            if template_params:
                payload["template"]["components"].append({
                    "type": "body",
                    "parameters": [{"type": "text", "text": p} for p in template_params]
                })
        else:
            # Text message
            payload = {
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "text",
                "text": {"body": message}
            }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"✓ WhatsApp message sent to {to_phone}")
                    return {
                        "success": True,
                        "message_id": data.get("messages", [{}])[0].get("id"),
                        "details": data
                    }
                else:
                    error_data = response.json()
                    logger.error(f"WhatsApp API error: {error_data}")
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Unknown error"),
                        "details": error_data
                    }
                    
        except Exception as e:
            logger.error(f"Error sending WhatsApp message: {e}")
            return {"success": False, "error": str(e)}
    
    def _generate_web_link(self, to_phone: str, message: str) -> Dict[str, Any]:
        """Generate WhatsApp Web link (fallback mode)"""
        import urllib.parse
        
        encoded_message = urllib.parse.quote(message)
        link = f"https://wa.me/{to_phone}?text={encoded_message}"
        
        return {
            "success": True,
            "mode": "web_link",
            "link": link,
            "message": "Link gerado. Abra o link para enviar a mensagem via WhatsApp Web."
        }
    
    async def send_template(
        self,
        to_phone: str,
        template_name: str,
        params: List[str]
    ) -> Dict[str, Any]:
        """Send a template message"""
        return await self.send_message(to_phone, "", template_name, params)


async def get_parceiro_whatsapp_service(db, parceiro_id: str) -> Optional[WhatsAppService]:
    """
    Get WhatsAppService configured with partner settings
    
    Args:
        db: Database instance
        parceiro_id: Partner ID
    
    Returns:
        WhatsAppService instance or None if not configured
    """
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
    
    if not parceiro:
        return None
    
    whatsapp_config = parceiro.get("config_whatsapp", {})
    if not whatsapp_config.get("ativo"):
        return None
    
    # Check if Cloud API is configured
    if whatsapp_config.get("access_token") and whatsapp_config.get("phone_number_id"):
        return WhatsAppService({
            "api_mode": "cloud_api",
            "access_token": whatsapp_config["access_token"],
            "phone_number_id": whatsapp_config["phone_number_id"],
            "business_phone": whatsapp_config.get("telefone", "")
        })
    
    # Fallback to web link mode
    return WhatsAppService({
        "api_mode": "web_link",
        "business_phone": whatsapp_config.get("telefone", "")
    })


async def send_whatsapp_to_motorista(
    db,
    parceiro_id: str,
    motorista_id: str,
    message: str
) -> Dict[str, Any]:
    """
    Send WhatsApp message to a motorista
    
    Args:
        db: Database instance
        parceiro_id: Partner ID
        motorista_id: Motorista ID
        message: Message text
    
    Returns:
        Dict with success status
    """
    # Get motorista phone
    motorista = await db.motoristas.find_one(
        {"id": motorista_id},
        {"_id": 0, "whatsapp": 1, "phone": 1, "name": 1}
    )
    
    if not motorista:
        return {"success": False, "error": "Motorista não encontrado"}
    
    phone = motorista.get("whatsapp") or motorista.get("phone")
    if not phone:
        return {"success": False, "error": "Motorista sem número de telefone/WhatsApp"}
    
    # Get WhatsApp service
    whatsapp_service = await get_parceiro_whatsapp_service(db, parceiro_id)
    if not whatsapp_service:
        return {"success": False, "error": "WhatsApp não configurado para este parceiro"}
    
    # Send message
    result = await whatsapp_service.send_message(phone, message)
    
    # Log the message
    if result.get("success"):
        await db.whatsapp_log.insert_one({
            "parceiro_id": parceiro_id,
            "motorista_id": motorista_id,
            "to_phone": phone,
            "message": message[:500],  # Truncate for storage
            "status": "sent" if result.get("mode") != "web_link" else "link_generated",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "api_mode": whatsapp_service.api_mode,
            "message_id": result.get("message_id"),
            "link": result.get("link")
        })
    
    return result


# Message templates
def get_whatsapp_template_relatorio_semanal(
    motorista_name: str,
    periodo: str,
    total_ganhos: float,
    total_despesas: float,
    liquido: float
) -> str:
    """Generate WhatsApp message for weekly report"""
    return f"""📊 *Relatório Semanal TVDEFleet*

Olá {motorista_name}! 👋

Aqui está o seu resumo do período *{periodo}*:

💰 *Ganhos Brutos:* €{total_ganhos:.2f}
📉 *Despesas:* €{total_despesas:.2f}
✅ *Valor Líquido:* €{liquido:.2f}

Aceda à plataforma para ver o relatório completo.

_TVDEFleet - Gestão de Frotas TVDE_"""


def get_whatsapp_template_documento_expirando(
    motorista_name: str,
    documento_tipo: str,
    data_expiracao: str,
    dias_restantes: int
) -> str:
    """Generate WhatsApp message for expiring document"""
    urgencia = "🔴 URGENTE" if dias_restantes <= 3 else "⚠️ Atenção"
    
    return f"""{urgencia} *Documento a Expirar*

Olá {motorista_name}! 👋

O seu documento *{documento_tipo}* expira em *{dias_restantes} dias* ({data_expiracao}).

Por favor, renove o documento o mais rapidamente possível para evitar interrupções.

📱 Aceda à plataforma TVDEFleet para submeter o novo documento.

_TVDEFleet - Gestão de Frotas TVDE_"""


def get_whatsapp_template_boas_vindas(motorista_name: str, parceiro_nome: str) -> str:
    """Generate WhatsApp welcome message"""
    return f"""👋 *Bem-vindo à TVDEFleet!*

Olá {motorista_name}!

O seu registo com *{parceiro_nome}* foi concluído com sucesso.

Através desta plataforma poderá:
✅ Consultar os seus ganhos semanais
📄 Submeter documentos
📊 Acompanhar relatórios

Se tiver alguma dúvida, contacte o seu parceiro.

_TVDEFleet - Gestão de Frotas TVDE_"""
