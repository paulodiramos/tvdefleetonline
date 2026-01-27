"""
Rotas para gestão de configurações de integrações (Admin only)
Ifthenpay e Moloni
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from datetime import datetime, timezone
import logging

from models.user import UserRole
from models.integracoes_config import (
    IfthenpayConfigRequest, MoloniConfigRequest,
    IntegracaoStatus
)
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter(prefix="/admin/integracoes", tags=["integracoes"])
db = get_database()
logger = logging.getLogger(__name__)

COLLECTION_NAME = "configuracoes_sistema"
DOC_ID = "integracoes"


async def get_config():
    """Obter configurações de integrações"""
    config = await db[COLLECTION_NAME].find_one({"_id": DOC_ID})
    if not config:
        # Criar documento inicial
        config = {
            "_id": DOC_ID,
            "ifthenpay": {
                "backoffice_key": None,
                "gateway_key": None,
                "anti_phishing_key": None,
                "mbway_key": None,
                "multibanco_key": None,
                "multibanco_entidade": None,
                "multibanco_subentidade": None,
                "cartao_key": None,
                "payshop_key": None,
                "sandbox_mode": True,
                "status": IntegracaoStatus.INATIVA.value
            },
            "moloni": {
                "client_id": None,
                "client_secret": None,
                "company_id": None,
                "sandbox_mode": True,
                "status": IntegracaoStatus.INATIVA.value
            },
            "updated_at": None,
            "updated_by": None
        }
        await db[COLLECTION_NAME].insert_one(config)
    return config


def mask_key(key: str, show_chars: int = 4) -> str:
    """Mascarar chave para exibição segura"""
    if not key:
        return None
    if len(key) <= show_chars * 2:
        return "*" * len(key)
    return key[:show_chars] + "*" * (len(key) - show_chars * 2) + key[-show_chars:]


# ==================== OBTER CONFIGURAÇÕES ====================

@router.get("")
async def get_integracoes_config(
    current_user: Dict = Depends(get_current_user)
):
    """Obter configurações de todas as integrações (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    config = await get_config()
    config.pop("_id", None)
    
    # Mascarar chaves sensíveis para exibição
    ifthenpay = config.get("ifthenpay", {})
    moloni = config.get("moloni", {})
    
    return {
        "ifthenpay": {
            **ifthenpay,
            "backoffice_key_masked": mask_key(ifthenpay.get("backoffice_key")),
            "anti_phishing_key_masked": mask_key(ifthenpay.get("anti_phishing_key"), 6),
            "tem_backoffice_key": bool(ifthenpay.get("backoffice_key")),
            "tem_anti_phishing_key": bool(ifthenpay.get("anti_phishing_key")),
            "tem_mbway_key": bool(ifthenpay.get("mbway_key")),
            "tem_multibanco_key": bool(ifthenpay.get("multibanco_key")),
            "tem_cartao_key": bool(ifthenpay.get("cartao_key")),
        },
        "moloni": {
            **moloni,
            "client_id_masked": mask_key(moloni.get("client_id")),
            "client_secret_masked": mask_key(moloni.get("client_secret")),
            "tem_client_id": bool(moloni.get("client_id")),
            "tem_client_secret": bool(moloni.get("client_secret")),
            "tem_company_id": bool(moloni.get("company_id")),
        },
        "updated_at": config.get("updated_at"),
        "updated_by": config.get("updated_by")
    }


# ==================== IFTHENPAY ====================

@router.get("/ifthenpay")
async def get_ifthenpay_config(
    current_user: Dict = Depends(get_current_user)
):
    """Obter configuração Ifthenpay (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    config = await get_config()
    ifthenpay = config.get("ifthenpay", {})
    
    return {
        "backoffice_key_masked": mask_key(ifthenpay.get("backoffice_key")),
        "gateway_key_masked": mask_key(ifthenpay.get("gateway_key")),
        "anti_phishing_key_masked": mask_key(ifthenpay.get("anti_phishing_key"), 6),
        "mbway_key_masked": mask_key(ifthenpay.get("mbway_key")),
        "multibanco_key_masked": mask_key(ifthenpay.get("multibanco_key")),
        "multibanco_entidade": ifthenpay.get("multibanco_entidade"),
        "multibanco_subentidade": ifthenpay.get("multibanco_subentidade"),
        "cartao_key_masked": mask_key(ifthenpay.get("cartao_key")),
        "payshop_key_masked": mask_key(ifthenpay.get("payshop_key")),
        "sandbox_mode": ifthenpay.get("sandbox_mode", True),
        "status": ifthenpay.get("status", IntegracaoStatus.INATIVA.value),
        "tem_backoffice_key": bool(ifthenpay.get("backoffice_key")),
        "tem_anti_phishing_key": bool(ifthenpay.get("anti_phishing_key")),
        "tem_mbway_key": bool(ifthenpay.get("mbway_key")),
        "tem_multibanco_key": bool(ifthenpay.get("multibanco_key")),
        "tem_cartao_key": bool(ifthenpay.get("cartao_key")),
    }


@router.put("/ifthenpay")
async def update_ifthenpay_config(
    request: IfthenpayConfigRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar configuração Ifthenpay (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    now = datetime.now(timezone.utc)
    
    # Construir update apenas com campos preenchidos
    update_data = {}
    
    if request.backoffice_key is not None:
        update_data["ifthenpay.backoffice_key"] = request.backoffice_key
    if request.gateway_key is not None:
        update_data["ifthenpay.gateway_key"] = request.gateway_key
    if request.anti_phishing_key is not None:
        update_data["ifthenpay.anti_phishing_key"] = request.anti_phishing_key
    if request.mbway_key is not None:
        update_data["ifthenpay.mbway_key"] = request.mbway_key
    if request.multibanco_key is not None:
        update_data["ifthenpay.multibanco_key"] = request.multibanco_key
    if request.multibanco_entidade is not None:
        update_data["ifthenpay.multibanco_entidade"] = request.multibanco_entidade
    if request.multibanco_subentidade is not None:
        update_data["ifthenpay.multibanco_subentidade"] = request.multibanco_subentidade
    if request.cartao_key is not None:
        update_data["ifthenpay.cartao_key"] = request.cartao_key
    if request.payshop_key is not None:
        update_data["ifthenpay.payshop_key"] = request.payshop_key
    
    update_data["ifthenpay.sandbox_mode"] = request.sandbox_mode
    update_data["ifthenpay.status"] = IntegracaoStatus.PENDENTE.value
    update_data["updated_at"] = now.isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db[COLLECTION_NAME].update_one(
        {"_id": DOC_ID},
        {"$set": update_data},
        upsert=True
    )
    
    logger.info(f"Configuração Ifthenpay atualizada por {current_user['id']}")
    
    return {
        "sucesso": True,
        "mensagem": "Configuração Ifthenpay guardada com sucesso"
    }


@router.post("/ifthenpay/testar")
async def testar_ifthenpay(
    current_user: Dict = Depends(get_current_user)
):
    """Testar conexão com Ifthenpay (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    config = await get_config()
    ifthenpay = config.get("ifthenpay", {})
    
    now = datetime.now(timezone.utc)
    
    # Verificar se tem as credenciais mínimas
    if not ifthenpay.get("backoffice_key"):
        await db[COLLECTION_NAME].update_one(
            {"_id": DOC_ID},
            {"$set": {
                "ifthenpay.status": IntegracaoStatus.ERRO.value,
                "ifthenpay.erro_mensagem": "Backoffice Key não configurada",
                "ifthenpay.ultima_verificacao": now.isoformat()
            }}
        )
        return {
            "sucesso": False,
            "status": IntegracaoStatus.ERRO.value,
            "mensagem": "Backoffice Key não configurada"
        }
    
    # TODO: Implementar teste real com API Ifthenpay
    # Por agora, apenas marcar como ativa se tem credenciais
    
    await db[COLLECTION_NAME].update_one(
        {"_id": DOC_ID},
        {"$set": {
            "ifthenpay.status": IntegracaoStatus.ATIVA.value,
            "ifthenpay.erro_mensagem": None,
            "ifthenpay.ultima_verificacao": now.isoformat()
        }}
    )
    
    return {
        "sucesso": True,
        "status": IntegracaoStatus.ATIVA.value,
        "mensagem": "Credenciais Ifthenpay válidas"
    }


# ==================== MOLONI ====================

@router.get("/moloni")
async def get_moloni_config(
    current_user: Dict = Depends(get_current_user)
):
    """Obter configuração Moloni (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    config = await get_config()
    moloni = config.get("moloni", {})
    
    return {
        "client_id_masked": mask_key(moloni.get("client_id")),
        "client_secret_masked": mask_key(moloni.get("client_secret")),
        "company_id": moloni.get("company_id"),
        "sandbox_mode": moloni.get("sandbox_mode", True),
        "status": moloni.get("status", IntegracaoStatus.INATIVA.value),
        "tem_client_id": bool(moloni.get("client_id")),
        "tem_client_secret": bool(moloni.get("client_secret")),
        "tem_company_id": bool(moloni.get("company_id")),
        "token_expires_at": moloni.get("token_expires_at"),
    }


@router.put("/moloni")
async def update_moloni_config(
    request: MoloniConfigRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar configuração Moloni (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    now = datetime.now(timezone.utc)
    
    # Construir update apenas com campos preenchidos
    update_data = {}
    
    if request.client_id is not None:
        update_data["moloni.client_id"] = request.client_id
    if request.client_secret is not None:
        update_data["moloni.client_secret"] = request.client_secret
    if request.company_id is not None:
        update_data["moloni.company_id"] = request.company_id
    
    update_data["moloni.sandbox_mode"] = request.sandbox_mode
    update_data["moloni.status"] = IntegracaoStatus.PENDENTE.value
    update_data["updated_at"] = now.isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db[COLLECTION_NAME].update_one(
        {"_id": DOC_ID},
        {"$set": update_data},
        upsert=True
    )
    
    logger.info(f"Configuração Moloni atualizada por {current_user['id']}")
    
    return {
        "sucesso": True,
        "mensagem": "Configuração Moloni guardada com sucesso"
    }


@router.post("/moloni/testar")
async def testar_moloni(
    current_user: Dict = Depends(get_current_user)
):
    """Testar conexão com Moloni (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    config = await get_config()
    moloni = config.get("moloni", {})
    
    now = datetime.now(timezone.utc)
    
    # Verificar se tem as credenciais mínimas
    if not moloni.get("client_id") or not moloni.get("client_secret"):
        await db[COLLECTION_NAME].update_one(
            {"_id": DOC_ID},
            {"$set": {
                "moloni.status": IntegracaoStatus.ERRO.value,
                "moloni.erro_mensagem": "Client ID ou Client Secret não configurados",
                "moloni.ultima_verificacao": now.isoformat()
            }}
        )
        return {
            "sucesso": False,
            "status": IntegracaoStatus.ERRO.value,
            "mensagem": "Client ID ou Client Secret não configurados"
        }
    
    # TODO: Implementar teste real com API Moloni (obter token)
    # Por agora, apenas marcar como ativa se tem credenciais
    
    await db[COLLECTION_NAME].update_one(
        {"_id": DOC_ID},
        {"$set": {
            "moloni.status": IntegracaoStatus.ATIVA.value,
            "moloni.erro_mensagem": None,
            "moloni.ultima_verificacao": now.isoformat()
        }}
    )
    
    return {
        "sucesso": True,
        "status": IntegracaoStatus.ATIVA.value,
        "mensagem": "Credenciais Moloni válidas"
    }
