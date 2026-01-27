"""
Rotas de Pré-Pagamento Pro-Rata
API para sistema de bloqueio até pagamento na adição de veículos/motoristas
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import logging

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database
from services.prepagamento_service import PrepagamentoService
from models.planos_modulos import (
    SolicitarAdicaoRequest, IniciarPagamentoRequest,
    ConfirmarPagamentoRequest, MetodoPagamento
)

router = APIRouter(prefix="/prepagamento", tags=["prepagamento"])
db = get_database()
logger = logging.getLogger(__name__)


def get_service():
    return PrepagamentoService(db)


# ==================== PARCEIRO/USER ====================

@router.post("/solicitar-adicao")
async def solicitar_adicao(
    request: SolicitarAdicaoRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Solicitar adição de veículos/motoristas.
    Cria um pedido pendente de pagamento que bloqueia até ser pago.
    """
    service = get_service()
    
    try:
        resultado = await service.solicitar_adicao(
            user_id=current_user["id"],
            veiculos_adicionar=request.veiculos_adicionar,
            motoristas_adicionar=request.motoristas_adicionar
        )
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/meus-pedidos")
async def listar_meus_pedidos(
    apenas_pendentes: bool = Query(False),
    current_user: Dict = Depends(get_current_user)
):
    """Listar pedidos do utilizador atual"""
    service = get_service()
    
    if apenas_pendentes:
        pedidos = await service.obter_pedidos_pendentes_user(current_user["id"])
    else:
        pedidos = await service.obter_historico_pedidos_user(current_user["id"])
    
    return {"pedidos": pedidos}


@router.get("/pedido/{pedido_id}")
async def obter_pedido(
    pedido_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter detalhes de um pedido"""
    service = get_service()
    
    pedido = await service.obter_pedido(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    # Verificar se o utilizador tem acesso
    if current_user["role"] != UserRole.ADMIN and pedido["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    return pedido


@router.post("/iniciar-pagamento")
async def iniciar_pagamento(
    pedido_id: str,
    metodo: MetodoPagamento,
    telefone: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Iniciar processo de pagamento para um pedido.
    Retorna dados necessários para o método escolhido.
    """
    service = get_service()
    
    # Verificar se o pedido pertence ao utilizador
    pedido = await service.obter_pedido(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if current_user["role"] != UserRole.ADMIN and pedido["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    try:
        dados_pagamento = {"telefone": telefone} if telefone else None
        resultado = await service.iniciar_pagamento(
            pedido_id=pedido_id,
            metodo=metodo,
            dados_pagamento=dados_pagamento
        )
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancelar-pedido/{pedido_id}")
async def cancelar_pedido(
    pedido_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Cancelar um pedido pendente"""
    service = get_service()
    
    # Verificar se o pedido pertence ao utilizador
    pedido = await service.obter_pedido(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if current_user["role"] != UserRole.ADMIN and pedido["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    try:
        resultado = await service.cancelar_pedido(
            pedido_id=pedido_id,
            cancelado_por=current_user["id"]
        )
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== ADMIN ====================

@router.get("/admin/pedidos-pendentes")
async def listar_pedidos_pendentes(
    current_user: Dict = Depends(get_current_user)
):
    """Listar todos os pedidos pendentes de pagamento (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    pedidos = await service.obter_todos_pedidos_pendentes()
    
    return {"pedidos": pedidos, "total": len(pedidos)}


@router.get("/admin/pedidos/user/{user_id}")
async def listar_pedidos_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Listar pedidos de um utilizador específico (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    pedidos = await service.obter_historico_pedidos_user(user_id)
    
    return {"pedidos": pedidos, "user_id": user_id}


@router.post("/admin/confirmar-pagamento/{pedido_id}")
async def confirmar_pagamento_manual(
    pedido_id: str,
    pagamento_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Confirmar pagamento manualmente (Admin only).
    Usar quando pagamento foi verificado fora do sistema.
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    
    try:
        resultado = await service.confirmar_pagamento(
            pedido_id=pedido_id,
            pagamento_id=pagamento_id,
            confirmado_por=current_user["id"]
        )
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/expirar-pedidos")
async def expirar_pedidos_vencidos(
    current_user: Dict = Depends(get_current_user)
):
    """Forçar verificação e expiração de pedidos vencidos (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    count = await service.verificar_pedidos_expirados()
    
    return {"pedidos_expirados": count}


# ==================== WEBHOOK (para gateway de pagamento) ====================

@router.post("/webhook/pagamento-confirmado")
async def webhook_pagamento(
    pedido_id: str,
    pagamento_id: Optional[str] = None,
    referencia: Optional[str] = None,
    status: str = "pago"
):
    """
    Webhook para receber confirmação de pagamento da gateway.
    Nota: Em produção, adicionar validação de assinatura/IP da gateway.
    """
    if status != "pago":
        return {"recebido": True, "processado": False, "motivo": f"Status {status} não é 'pago'"}
    
    service = get_service()
    
    try:
        resultado = await service.confirmar_pagamento(
            pedido_id=pedido_id,
            pagamento_id=pagamento_id,
            confirmado_por="webhook_ifthenpay"
        )
        return {"recebido": True, "processado": True, "resultado": resultado}
    except ValueError as e:
        logger.error(f"Erro no webhook de pagamento: {str(e)}")
        return {"recebido": True, "processado": False, "erro": str(e)}


# ==================== VERIFICAÇÃO ====================

@router.get("/verificar-bloqueio")
async def verificar_bloqueio(
    current_user: Dict = Depends(get_current_user)
):
    """
    Verificar se o utilizador tem pedidos pendentes de pagamento
    que bloqueiam a adição de novos recursos.
    """
    service = get_service()
    
    pedidos_pendentes = await service.obter_pedidos_pendentes_user(current_user["id"])
    
    bloqueado = len(pedidos_pendentes) > 0
    
    return {
        "bloqueado": bloqueado,
        "pedidos_pendentes": pedidos_pendentes,
        "mensagem": "Tem pedidos pendentes de pagamento. Conclua o pagamento para adicionar novos recursos." if bloqueado else "Pode adicionar novos recursos."
    }
