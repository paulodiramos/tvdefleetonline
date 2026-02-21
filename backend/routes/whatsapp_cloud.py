"""
WhatsApp Cloud API Integration - Meta Official
Suporta envio de mensagens template com variáveis dinâmicas
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import PlainTextResponse
from typing import Dict, List, Optional, Any
from datetime import datetime
import httpx
import hmac
import hashlib
import json
import os
import logging
import uuid

from utils.auth import get_current_user

router = APIRouter(prefix="/whatsapp-cloud", tags=["WhatsApp Cloud API"])

# Configuração
WHATSAPP_API_URL = "https://graph.facebook.com/v21.0"
ACCESS_TOKEN = os.environ.get("WHATSAPP_CLOUD_ACCESS_TOKEN", "")
PHONE_NUMBER_ID = os.environ.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID", "")
WABA_ID = os.environ.get("WHATSAPP_CLOUD_WABA_ID", "")
VERIFY_TOKEN = os.environ.get("WHATSAPP_CLOUD_VERIFY_TOKEN", "tvdefleet-webhook-verify-2025")
APP_SECRET = os.environ.get("WHATSAPP_CLOUD_APP_SECRET", "")

logger = logging.getLogger(__name__)

# Templates pré-definidos para TVDEFleet
TEMPLATES = {
    "relatorio_semanal": {
        "name": "relatorio_semanal",
        "description": "Relatório semanal com valores detalhados",
        "language": "pt_PT",
        "category": "UTILITY",
        "variables": ["nome", "semana", "total_viagens", "valor_bruto", "comissoes", "valor_liquido"],
        "preview": """Olá {nome}! 📊

O seu relatório da Semana {semana} está disponível:

🚗 Total de viagens: {total_viagens}
💵 Valor bruto: €{valor_bruto}
📉 Comissões/Descontos: €{comissoes}
💰 Valor líquido: €{valor_liquido}

Aceda à plataforma para ver detalhes completos."""
    },
    "documento_expirar": {
        "name": "documento_expirar",
        "description": "Alerta de documento a expirar",
        "language": "pt_PT",
        "category": "UTILITY",
        "variables": ["nome", "tipo_documento", "dias", "data_expiracao"],
        "preview": """⚠️ Aviso Importante, {nome}!

O seu documento {tipo_documento} expira em {dias} dias ({data_expiracao}).

Por favor actualize na plataforma para evitar bloqueios na sua actividade."""
    },
    "boas_vindas": {
        "name": "boas_vindas",
        "description": "Boas-vindas a novo motorista",
        "language": "pt_PT",
        "category": "UTILITY",
        "variables": ["nome", "empresa", "link_plataforma"],
        "preview": """Bem-vindo(a), {nome}! 🚗

A sua conta na {empresa} foi aprovada com sucesso.

Aceda à plataforma em: {link_plataforma}

Qualquer dúvida, contacte o seu gestor de frota."""
    },
    "vistoria_agendada": {
        "name": "vistoria_agendada",
        "description": "Notificação de vistoria agendada",
        "language": "pt_PT",
        "category": "UTILITY",
        "variables": ["nome", "data_vistoria", "hora", "local", "veiculo"],
        "preview": """📋 Vistoria Agendada, {nome}!

O seu veículo {veiculo} tem vistoria marcada:
📅 Data: {data_vistoria}
🕐 Hora: {hora}
📍 Local: {local}

Não se esqueça de levar toda a documentação necessária."""
    },
    "revisao_veiculo": {
        "name": "revisao_veiculo",
        "description": "Alerta de revisão do veículo",
        "language": "pt_PT",
        "category": "UTILITY",
        "variables": ["nome", "veiculo", "km_actual", "km_revisao", "tipo_revisao"],
        "preview": """🔧 Revisão Necessária, {nome}!

O veículo {veiculo} está a aproximar-se da {tipo_revisao}:
📊 Km actual: {km_actual}
🎯 Km revisão: {km_revisao}

Por favor agende a revisão o mais brevemente possível."""
    },
    "pagamento_efetuado": {
        "name": "pagamento_efetuado",
        "description": "Confirmação de pagamento",
        "language": "pt_PT",
        "category": "UTILITY",
        "variables": ["nome", "valor", "referencia", "data_pagamento"],
        "preview": """✅ Pagamento Confirmado, {nome}!

O pagamento de €{valor} foi processado com sucesso.
📝 Referência: {referencia}
📅 Data: {data_pagamento}

Obrigado pela sua pontualidade!"""
    }
}


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Valida assinatura HMAC-SHA256 do webhook"""
    if not APP_SECRET:
        logger.warning("APP_SECRET não configurado - a ignorar validação de assinatura")
        return True
    
    expected_signature = "sha256=" + hmac.new(
        APP_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)


def format_phone_number(phone: str) -> str:
    """Formata número de telefone para formato E.164 (sem +)"""
    phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if phone.startswith("+"):
        phone = phone[1:]
    if phone.startswith("00"):
        phone = phone[2:]
    # Se começar com 9 (PT móvel), adicionar 351
    if phone.startswith("9") and len(phone) == 9:
        phone = "351" + phone
    return phone


async def send_template_message(
    recipient_phone: str,
    template_name: str,
    template_language: str = "pt_PT",
    parameters: Optional[List[Dict]] = None,
    header_parameters: Optional[List[Dict]] = None
) -> Dict:
    """
    Envia mensagem template via WhatsApp Cloud API
    
    Args:
        recipient_phone: Número em formato E.164 (ex: "351912345678")
        template_name: Nome do template aprovado no Meta
        template_language: Código do idioma (ex: "pt_PT")
        parameters: Lista de parâmetros para o corpo da mensagem
        header_parameters: Lista de parâmetros para o cabeçalho (opcional)
    
    Returns:
        Resposta da API com message_id em caso de sucesso
    """
    if not ACCESS_TOKEN or not PHONE_NUMBER_ID:
        raise HTTPException(
            status_code=503,
            detail="WhatsApp Cloud API não configurada. Configure ACCESS_TOKEN e PHONE_NUMBER_ID no .env"
        )
    
    formatted_phone = format_phone_number(recipient_phone)
    
    components = []
    
    # Adicionar parâmetros do header se existirem
    if header_parameters:
        components.append({
            "type": "header",
            "parameters": header_parameters
        })
    
    # Adicionar parâmetros do body
    if parameters:
        components.append({
            "type": "body",
            "parameters": parameters
        })
    
    payload = {
        "messaging_product": "whatsapp",
        "to": formatted_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": template_language
            }
        }
    }
    
    if components:
        payload["template"]["components"] = components
    
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    
    url = f"{WHATSAPP_API_URL}/{PHONE_NUMBER_ID}/messages"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"Mensagem enviada com sucesso para {formatted_phone}")
                return {
                    "success": True,
                    "message_id": result.get("messages", [{}])[0].get("id"),
                    "recipient": formatted_phone,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                error_data = response.json()
                logger.error(f"Erro ao enviar mensagem: {error_data}")
                return {
                    "success": False,
                    "error": error_data,
                    "recipient": formatted_phone
                }
                
    except httpx.ConnectError as e:
        logger.error(f"Erro de conexão com WhatsApp API: {e}")
        raise HTTPException(status_code=503, detail="Não foi possível conectar à API do WhatsApp")
    except Exception as e:
        logger.error(f"Erro ao enviar mensagem WhatsApp: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ENDPOINTS ====================

@router.get("/status")
async def get_status(current_user: Dict = Depends(get_current_user)):
    """Verifica estado da configuração da API"""
    is_configured = bool(ACCESS_TOKEN and PHONE_NUMBER_ID)
    
    return {
        "configured": is_configured,
        "has_access_token": bool(ACCESS_TOKEN),
        "has_phone_number_id": bool(PHONE_NUMBER_ID),
        "has_waba_id": bool(WABA_ID),
        "has_app_secret": bool(APP_SECRET),
        "api_version": "v21.0",
        "templates_available": len(TEMPLATES)
    }


@router.get("/templates")
async def get_templates(current_user: Dict = Depends(get_current_user)):
    """Lista todos os templates disponíveis"""
    return {
        "templates": list(TEMPLATES.values()),
        "total": len(TEMPLATES)
    }


@router.get("/templates/{template_name}")
async def get_template(template_name: str, current_user: Dict = Depends(get_current_user)):
    """Obtém detalhes de um template específico"""
    if template_name not in TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Template '{template_name}' não encontrado")
    
    return TEMPLATES[template_name]


@router.post("/send/relatorio-semanal")
async def send_relatorio_semanal(
    telefone: str,
    nome: str,
    semana: str,
    total_viagens: int,
    valor_bruto: float,
    comissoes: float,
    valor_liquido: float,
    current_user: Dict = Depends(get_current_user)
):
    """
    Envia relatório semanal por WhatsApp
    
    Exemplo de uso:
    POST /api/whatsapp-cloud/send/relatorio-semanal
    {
        "telefone": "912345678",
        "nome": "João Silva",
        "semana": "8/2025",
        "total_viagens": 45,
        "valor_bruto": 850.50,
        "comissoes": 170.10,
        "valor_liquido": 680.40
    }
    """
    parameters = [
        {"type": "text", "text": nome},
        {"type": "text", "text": semana},
        {"type": "text", "text": str(total_viagens)},
        {"type": "text", "text": f"{valor_bruto:.2f}"},
        {"type": "text", "text": f"{comissoes:.2f}"},
        {"type": "text", "text": f"{valor_liquido:.2f}"}
    ]
    
    return await send_template_message(
        recipient_phone=telefone,
        template_name="relatorio_semanal",
        parameters=parameters
    )


@router.post("/send/documento-expirar")
async def send_documento_expirar(
    telefone: str,
    nome: str,
    tipo_documento: str,
    dias: int,
    data_expiracao: str,
    current_user: Dict = Depends(get_current_user)
):
    """Envia alerta de documento a expirar"""
    parameters = [
        {"type": "text", "text": nome},
        {"type": "text", "text": tipo_documento},
        {"type": "text", "text": str(dias)},
        {"type": "text", "text": data_expiracao}
    ]
    
    return await send_template_message(
        recipient_phone=telefone,
        template_name="documento_expirar",
        parameters=parameters
    )


@router.post("/send/boas-vindas")
async def send_boas_vindas(
    telefone: str,
    nome: str,
    empresa: str,
    link_plataforma: str,
    current_user: Dict = Depends(get_current_user)
):
    """Envia mensagem de boas-vindas a novo motorista"""
    parameters = [
        {"type": "text", "text": nome},
        {"type": "text", "text": empresa},
        {"type": "text", "text": link_plataforma}
    ]
    
    return await send_template_message(
        recipient_phone=telefone,
        template_name="boas_vindas",
        parameters=parameters
    )


@router.post("/send/vistoria")
async def send_vistoria(
    telefone: str,
    nome: str,
    data_vistoria: str,
    hora: str,
    local: str,
    veiculo: str,
    current_user: Dict = Depends(get_current_user)
):
    """Envia notificação de vistoria agendada"""
    parameters = [
        {"type": "text", "text": nome},
        {"type": "text", "text": data_vistoria},
        {"type": "text", "text": hora},
        {"type": "text", "text": local},
        {"type": "text", "text": veiculo}
    ]
    
    return await send_template_message(
        recipient_phone=telefone,
        template_name="vistoria_agendada",
        parameters=parameters
    )


@router.post("/send/revisao")
async def send_revisao(
    telefone: str,
    nome: str,
    veiculo: str,
    km_actual: int,
    km_revisao: int,
    tipo_revisao: str,
    current_user: Dict = Depends(get_current_user)
):
    """Envia alerta de revisão do veículo"""
    parameters = [
        {"type": "text", "text": nome},
        {"type": "text", "text": veiculo},
        {"type": "text", "text": str(km_actual)},
        {"type": "text", "text": str(km_revisao)},
        {"type": "text", "text": tipo_revisao}
    ]
    
    return await send_template_message(
        recipient_phone=telefone,
        template_name="revisao_veiculo",
        parameters=parameters
    )


@router.post("/send/pagamento")
async def send_pagamento(
    telefone: str,
    nome: str,
    valor: float,
    referencia: str,
    data_pagamento: str,
    current_user: Dict = Depends(get_current_user)
):
    """Envia confirmação de pagamento"""
    parameters = [
        {"type": "text", "text": nome},
        {"type": "text", "text": f"{valor:.2f}"},
        {"type": "text", "text": referencia},
        {"type": "text", "text": data_pagamento}
    ]
    
    return await send_template_message(
        recipient_phone=telefone,
        template_name="pagamento_efetuado",
        parameters=parameters
    )


@router.post("/send/custom")
async def send_custom_template(
    telefone: str,
    template_name: str,
    parameters: List[str],
    language: str = "pt_PT",
    current_user: Dict = Depends(get_current_user)
):
    """
    Envia template personalizado
    
    Exemplo:
    POST /api/whatsapp-cloud/send/custom
    {
        "telefone": "912345678",
        "template_name": "meu_template",
        "parameters": ["valor1", "valor2", "valor3"],
        "language": "pt_PT"
    }
    """
    formatted_params = [{"type": "text", "text": p} for p in parameters]
    
    return await send_template_message(
        recipient_phone=telefone,
        template_name=template_name,
        template_language=language,
        parameters=formatted_params
    )


# ==================== ENVIO EM MASSA ====================

from pydantic import BaseModel
from utils.database import get_database

db = get_database()


class EnvioMassaRequest(BaseModel):
    motorista_ids: List[str]
    template_name: str
    parameters: List[str]
    language: str = "pt_PT"


class VistoriaEmMassaRequest(BaseModel):
    motorista_ids: List[str]
    data_vistoria: str
    hora: str
    local: str


class MensagemPersonalizadaRequest(BaseModel):
    motorista_ids: List[str]
    mensagem: str


@router.post("/send/massa")
async def send_massa(
    request: EnvioMassaRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Envia template para múltiplos motoristas
    
    Exemplo:
    POST /api/whatsapp-cloud/send/massa
    {
        "motorista_ids": ["id1", "id2", "id3"],
        "template_name": "vistoria_agendada",
        "parameters": ["15/03/2025", "10:00", "Centro de Inspeções Lisboa"],
        "language": "pt_PT"
    }
    """
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Obter dados dos motoristas
    motoristas = await db.motoristas.find(
        {"id": {"$in": request.motorista_ids}},
        {"_id": 0, "id": 1, "name": 1, "nome": 1, "phone": 1, "whatsapp": 1}
    ).to_list(100)
    
    resultados = {
        "enviados": [],
        "falhas": [],
        "sem_telefone": []
    }
    
    for motorista in motoristas:
        telefone = motorista.get("whatsapp") or motorista.get("phone")
        nome = motorista.get("name") or motorista.get("nome", "Motorista")
        
        if not telefone:
            resultados["sem_telefone"].append({
                "id": motorista["id"],
                "nome": nome
            })
            continue
        
        # Substituir {nome} nos parâmetros se existir
        params_formatados = []
        for p in request.parameters:
            if "{nome}" in p.lower():
                p = p.replace("{nome}", nome).replace("{NOME}", nome)
            params_formatados.append({"type": "text", "text": p})
        
        # Adicionar nome como primeiro parâmetro se o template espera
        if request.template_name in ["vistoria_agendada", "documento_expirar", "revisao_veiculo"]:
            params_formatados.insert(0, {"type": "text", "text": nome})
        
        try:
            result = await send_template_message(
                recipient_phone=telefone,
                template_name=request.template_name,
                template_language=request.language,
                parameters=params_formatados
            )
            
            if result.get("success"):
                resultados["enviados"].append({
                    "id": motorista["id"],
                    "nome": nome,
                    "telefone": telefone,
                    "message_id": result.get("message_id")
                })
            else:
                resultados["falhas"].append({
                    "id": motorista["id"],
                    "nome": nome,
                    "erro": result.get("error")
                })
        except Exception as e:
            resultados["falhas"].append({
                "id": motorista["id"],
                "nome": nome,
                "erro": str(e)
            })
    
    # Registar envio em massa na BD
    await db.whatsapp_envios_massa.insert_one({
        "id": str(uuid.uuid4()),
        "template_name": request.template_name,
        "parameters": request.parameters,
        "motorista_ids": request.motorista_ids,
        "enviados": len(resultados["enviados"]),
        "falhas": len(resultados["falhas"]),
        "sem_telefone": len(resultados["sem_telefone"]),
        "enviado_por": current_user["id"],
        "created_at": datetime.now().isoformat()
    })
    
    return {
        "success": True,
        "total_motoristas": len(request.motorista_ids),
        "enviados": len(resultados["enviados"]),
        "falhas": len(resultados["falhas"]),
        "sem_telefone": len(resultados["sem_telefone"]),
        "detalhes": resultados
    }


@router.post("/send/vistoria-massa")
async def send_vistoria_massa(
    request: VistoriaEmMassaRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Envia notificação de vistoria para múltiplos motoristas
    
    Exemplo:
    POST /api/whatsapp-cloud/send/vistoria-massa
    {
        "motorista_ids": ["id1", "id2", "id3"],
        "data_vistoria": "15/03/2025",
        "hora": "10:00",
        "local": "Centro de Inspeções Lisboa"
    }
    """
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Obter dados dos motoristas com veículos
    motoristas = await db.motoristas.find(
        {"id": {"$in": request.motorista_ids}},
        {"_id": 0, "id": 1, "name": 1, "nome": 1, "phone": 1, "whatsapp": 1, "veiculo_id": 1}
    ).to_list(100)
    
    resultados = {
        "enviados": [],
        "falhas": [],
        "sem_telefone": []
    }
    
    for motorista in motoristas:
        telefone = motorista.get("whatsapp") or motorista.get("phone")
        nome = motorista.get("name") or motorista.get("nome", "Motorista")
        
        if not telefone:
            resultados["sem_telefone"].append({"id": motorista["id"], "nome": nome})
            continue
        
        # Obter matrícula do veículo
        veiculo_info = "Veículo"
        if motorista.get("veiculo_id"):
            veiculo = await db.vehicles.find_one(
                {"id": motorista["veiculo_id"]},
                {"_id": 0, "matricula": 1, "marca": 1, "modelo": 1}
            )
            if veiculo:
                veiculo_info = f"{veiculo.get('matricula', '')} ({veiculo.get('marca', '')} {veiculo.get('modelo', '')})"
        
        parameters = [
            {"type": "text", "text": nome},
            {"type": "text", "text": request.data_vistoria},
            {"type": "text", "text": request.hora},
            {"type": "text", "text": request.local},
            {"type": "text", "text": veiculo_info}
        ]
        
        try:
            result = await send_template_message(
                recipient_phone=telefone,
                template_name="vistoria_agendada",
                parameters=parameters
            )
            
            if result.get("success"):
                resultados["enviados"].append({
                    "id": motorista["id"],
                    "nome": nome,
                    "telefone": telefone,
                    "message_id": result.get("message_id")
                })
            else:
                resultados["falhas"].append({
                    "id": motorista["id"],
                    "nome": nome,
                    "erro": result.get("error")
                })
        except Exception as e:
            resultados["falhas"].append({
                "id": motorista["id"],
                "nome": nome,
                "erro": str(e)
            })
    
    return {
        "success": True,
        "total_motoristas": len(request.motorista_ids),
        "enviados": len(resultados["enviados"]),
        "falhas": len(resultados["falhas"]),
        "sem_telefone": len(resultados["sem_telefone"]),
        "detalhes": resultados
    }


@router.get("/historico-envios")
async def get_historico_envios(
    limite: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    """Lista histórico de envios em massa"""
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    envios = await db.whatsapp_envios_massa.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limite)
    
    return {"envios": envios, "total": len(envios)}


# ==================== AGENDAMENTO AUTOMÁTICO ====================

class ConfiguracaoAgendamento(BaseModel):
    hora: int = 9
    dias_antecedencia: int = 30
    habilitado: bool = False


@router.get("/agendamento/config")
async def get_agendamento_config(current_user: Dict = Depends(get_current_user)):
    """Obtém configuração de agendamento automático"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    config = await db.configuracoes.find_one({"tipo": "agendamento_whatsapp"}, {"_id": 0})
    if not config:
        config = {
            "tipo": "agendamento_whatsapp",
            "hora": 9,
            "dias_antecedencia": 30,
            "habilitado": False,
            "ultima_execucao": None
        }
    
    return config


@router.post("/agendamento/config")
async def update_agendamento_config(
    config: ConfiguracaoAgendamento,
    current_user: Dict = Depends(get_current_user)
):
    """Atualiza configuração de agendamento automático"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    await db.configuracoes.update_one(
        {"tipo": "agendamento_whatsapp"},
        {"$set": {
            "tipo": "agendamento_whatsapp",
            "hora": config.hora,
            "dias_antecedencia": config.dias_antecedencia,
            "habilitado": config.habilitado,
            "atualizado_em": datetime.now().isoformat(),
            "atualizado_por": current_user["id"]
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Configuração atualizada"}


@router.get("/agendamento/historico")
async def get_agendamento_historico(
    limite: int = 20,
    current_user: Dict = Depends(get_current_user)
):
    """Lista histórico de execuções automáticas"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    historico = await db.tarefas_agendadas_log.find(
        {"tarefa": "alertas_documentos"},
        {"_id": 0}
    ).sort("executado_em", -1).to_list(limite)
    
    return {"historico": historico, "total": len(historico)}


@router.post("/agendamento/executar-agora")
async def executar_alertas_agora(current_user: Dict = Depends(get_current_user)):
    """Executa envio de alertas imediatamente (manual)"""
    if current_user["role"] not in ["admin", "gestao"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Buscar configuração
    config = await db.configuracoes.find_one({"tipo": "agendamento_whatsapp"}, {"_id": 0})
    dias = config.get("dias_antecedencia", 30) if config else 30
    
    # Reutilizar o endpoint existente de alertas
    from routes.alertas import enviar_alertas_documentos_whatsapp
    
    # Criar um mock do current_user com o role correto
    result = await enviar_alertas_documentos_whatsapp(
        dias=dias,
        apenas_motoristas=True,
        current_user=current_user
    )
    
    # Registar execução manual
    await db.tarefas_agendadas_log.insert_one({
        "tarefa": "alertas_documentos",
        "tipo": "manual",
        "executado_em": datetime.now().isoformat(),
        "executado_por": current_user["id"],
        "enviados": result.get("enviados", 0),
        "falhas": result.get("falhas", 0),
        "dias_antecedencia": dias
    })
    
    return result


# ==================== WEBHOOK ENDPOINTS ====================

@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """
    Endpoint de verificação de webhook chamado pelo Meta
    Retorna o challenge token se a verificação for bem sucedida
    """
    logger.info(f"Webhook verification: mode={hub_mode}, token={hub_verify_token}")
    
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        logger.info("Webhook verified successfully")
        return PlainTextResponse(hub_challenge)
    
    logger.warning("Webhook verification failed")
    return PlainTextResponse("Forbidden", status_code=403)


@router.post("/webhook")
async def handle_webhook(request: Request):
    """
    Recebe eventos de webhook do Meta WhatsApp
    Processa mensagens recebidas e actualizações de estado
    """
    raw_body = await request.body()
    signature = request.headers.get("x-hub-signature-256", "")
    
    # Validar assinatura
    if APP_SECRET and not verify_webhook_signature(raw_body, signature):
        logger.warning("Webhook signature validation failed")
        return {"status": "error", "message": "Invalid signature"}, 401
    
    try:
        body = json.loads(raw_body)
        
        # Processar eventos
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                
                # Processar mensagens recebidas
                for message in value.get("messages", []):
                    sender = message.get("from")
                    message_id = message.get("id")
                    message_type = message.get("type", "unknown")
                    timestamp = message.get("timestamp")
                    
                    logger.info(f"Mensagem recebida de {sender}: tipo={message_type}")
                    
                    if message_type == "text":
                        text_content = message.get("text", {}).get("body", "")
                        logger.info(f"Texto: {text_content}")
                        # TODO: Processar resposta do cliente
                
                # Processar actualizações de estado
                for status in value.get("statuses", []):
                    message_id = status.get("id")
                    delivery_status = status.get("status")
                    recipient_id = status.get("recipient_id")
                    
                    logger.info(f"Status update: {message_id} -> {delivery_status} para {recipient_id}")
                    # TODO: Actualizar estado da mensagem na BD
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Erro ao processar webhook: {e}")
        return {"status": "error", "message": str(e)}


# ==================== GESTÃO DE TEMPLATES ====================

@router.post("/templates/add")
async def add_custom_template(
    name: str,
    description: str,
    variables: List[str],
    preview: str,
    language: str = "pt_PT",
    category: str = "UTILITY",
    current_user: Dict = Depends(get_current_user)
):
    """
    Adiciona um template personalizado à lista local
    Nota: O template deve ser criado e aprovado no Meta Business Manager
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem adicionar templates")
    
    TEMPLATES[name] = {
        "name": name,
        "description": description,
        "language": language,
        "category": category,
        "variables": variables,
        "preview": preview
    }
    
    return {
        "success": True,
        "message": f"Template '{name}' adicionado. Certifique-se de criar o mesmo template no Meta Business Manager.",
        "template": TEMPLATES[name]
    }
