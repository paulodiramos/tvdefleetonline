"""
Serviço de Pré-Pagamento Pro-Rata
Sistema de bloqueio até pagamento quando parceiro adiciona veículos/motoristas
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import uuid
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.planos_modulos import (
    StatusPedidoAdicao, MetodoPagamento
)
from services.planos_modulos_service import PlanosModulosService

logger = logging.getLogger(__name__)

# Tempo de expiração do pedido (24 horas)
EXPIRACAO_PEDIDO_HORAS = 24


class PrepagamentoService:
    """Serviço para gestão de pré-pagamento pro-rata"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.planos_service = PlanosModulosService(db)
    
    async def solicitar_adicao(
        self,
        user_id: str,
        veiculos_adicionar: int = 0,
        motoristas_adicionar: int = 0
    ) -> Dict:
        """
        Solicitar adição de veículos/motoristas.
        Cria um pedido pendente que bloqueia até pagamento.
        """
        now = datetime.now(timezone.utc)
        
        # Validar que está a adicionar algo
        if veiculos_adicionar <= 0 and motoristas_adicionar <= 0:
            raise ValueError("Deve adicionar pelo menos 1 veículo ou 1 motorista")
        
        # Buscar subscrição ativa
        subscricao = await self.planos_service.get_subscricao_user(user_id)
        if not subscricao:
            raise ValueError("Utilizador não tem subscrição ativa")
        
        if not subscricao.get("plano_id"):
            raise ValueError("Utilizador não tem plano ativo")
        
        # Verificar se já existe pedido pendente
        pedido_existente = await self.db.pedidos_adicao.find_one({
            "user_id": user_id,
            "status": {"$in": [
                StatusPedidoAdicao.PENDENTE_PAGAMENTO.value,
                StatusPedidoAdicao.PAGAMENTO_INICIADO.value
            ]}
        })
        
        if pedido_existente:
            raise ValueError("Já existe um pedido pendente de pagamento. Conclua ou cancele o pedido anterior.")
        
        # Calcular valores
        veiculos_atual = subscricao.get("num_veiculos", 0)
        motoristas_atual = subscricao.get("num_motoristas", 0)
        
        veiculos_novo = veiculos_atual + veiculos_adicionar
        motoristas_novo = motoristas_atual + motoristas_adicionar
        
        # Calcular pro-rata
        prorata = await self.planos_service.calcular_prorata(
            user_id,
            veiculos_novo,
            motoristas_novo
        )
        
        if "erro" in prorata:
            raise ValueError(prorata["erro"])
        
        if prorata["valor_prorata"] <= 0:
            raise ValueError("Valor pro-rata inválido")
        
        # Buscar nome do utilizador
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "nome": 1})
        if not user:
            user = await self.db.parceiros.find_one({"id": user_id}, {"_id": 0, "name": 1, "nome": 1})
        user_nome = user.get("name") or user.get("nome") if user else None
        
        # Criar pedido
        pedido = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "user_nome": user_nome,
            "subscricao_id": subscricao["id"],
            "veiculos_atual": veiculos_atual,
            "motoristas_atual": motoristas_atual,
            "veiculos_adicionar": veiculos_adicionar,
            "motoristas_adicionar": motoristas_adicionar,
            "veiculos_novo": veiculos_novo,
            "motoristas_novo": motoristas_novo,
            "valor_prorata": round(prorata["valor_prorata"], 2),
            "nova_mensalidade": round(prorata["nova_mensalidade"], 2),
            "dias_restantes": prorata["dias_restantes"],
            "dias_periodo": prorata["dias_periodo"],
            "status": StatusPedidoAdicao.PENDENTE_PAGAMENTO.value,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=EXPIRACAO_PEDIDO_HORAS)).isoformat(),
            "metodo_pagamento": None,
            "pagamento_id": None,
            "pagamento_referencia": None,
            "pagamento_entidade": None,
            "pagamento_data": None,
            "aplicado_em": None,
            "aplicado_por": None,
            "notas": None
        }
        
        await self.db.pedidos_adicao.insert_one(pedido)
        pedido.pop("_id", None)
        
        logger.info(f"Pedido de adição criado: {pedido['id']} para user {user_id} - €{pedido['valor_prorata']}")
        
        return {
            "sucesso": True,
            "pedido": pedido,
            "mensagem": f"Pedido criado. Pague €{pedido['valor_prorata']:.2f} para desbloquear a adição de {veiculos_adicionar} veículo(s) e {motoristas_adicionar} motorista(s)."
        }
    
    async def obter_pedido(self, pedido_id: str) -> Optional[Dict]:
        """Obter detalhes de um pedido"""
        pedido = await self.db.pedidos_adicao.find_one({"id": pedido_id}, {"_id": 0})
        return pedido
    
    async def obter_pedidos_pendentes_user(self, user_id: str) -> List[Dict]:
        """Obter pedidos pendentes de pagamento de um utilizador"""
        pedidos = await self.db.pedidos_adicao.find({
            "user_id": user_id,
            "status": {"$in": [
                StatusPedidoAdicao.PENDENTE_PAGAMENTO.value,
                StatusPedidoAdicao.PAGAMENTO_INICIADO.value
            ]}
        }, {"_id": 0}).sort("created_at", -1).to_list(10)
        return pedidos
    
    async def obter_historico_pedidos_user(self, user_id: str, limit: int = 20) -> List[Dict]:
        """Obter histórico de pedidos de um utilizador"""
        pedidos = await self.db.pedidos_adicao.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(limit)
        return pedidos
    
    async def iniciar_pagamento(
        self,
        pedido_id: str,
        metodo: MetodoPagamento,
        dados_pagamento: Optional[Dict] = None
    ) -> Dict:
        """
        Iniciar processo de pagamento para um pedido.
        Retorna dados necessários para o método escolhido.
        """
        now = datetime.now(timezone.utc)
        
        pedido = await self.obter_pedido(pedido_id)
        if not pedido:
            raise ValueError("Pedido não encontrado")
        
        if pedido["status"] not in [
            StatusPedidoAdicao.PENDENTE_PAGAMENTO.value,
            StatusPedidoAdicao.PAGAMENTO_INICIADO.value
        ]:
            raise ValueError(f"Pedido não está pendente de pagamento. Status: {pedido['status']}")
        
        # Verificar expiração
        expires_at = datetime.fromisoformat(pedido["expires_at"].replace('Z', '+00:00'))
        if now > expires_at:
            await self.expirar_pedido(pedido_id)
            raise ValueError("Pedido expirado. Crie um novo pedido.")
        
        # Preparar dados de pagamento baseado no método
        pagamento_info = {
            "pedido_id": pedido_id,
            "metodo": metodo.value,
            "valor": pedido["valor_prorata"]
        }
        
        if metodo == MetodoPagamento.MULTIBANCO:
            # Gerar referência Multibanco (simulado - integrar com Ifthenpay)
            pagamento_info["entidade"] = "11111"  # Placeholder - será da Ifthenpay
            pagamento_info["referencia"] = self._gerar_referencia_mb(pedido_id)
            pagamento_info["instrucoes"] = f"Pague €{pedido['valor_prorata']:.2f} usando:\n- Entidade: {pagamento_info['entidade']}\n- Referência: {pagamento_info['referencia']}"
            
        elif metodo == MetodoPagamento.MBWAY:
            # Iniciar pagamento MB WAY (simulado - integrar com Ifthenpay)
            telefone = dados_pagamento.get("telefone") if dados_pagamento else None
            if not telefone:
                raise ValueError("Número de telefone é obrigatório para MB WAY")
            pagamento_info["telefone"] = telefone
            pagamento_info["instrucoes"] = f"Confirme o pagamento de €{pedido['valor_prorata']:.2f} na app MB WAY no telefone {telefone}"
            
        elif metodo == MetodoPagamento.CARTAO:
            # URL de pagamento por cartão (simulado)
            pagamento_info["url_pagamento"] = f"/api/pagamento/cartao/{pedido_id}"
            pagamento_info["instrucoes"] = "Será redirecionado para a página de pagamento seguro."
            
        elif metodo == MetodoPagamento.DEBITO_DIRETO:
            pagamento_info["instrucoes"] = "O débito será processado na sua conta nos próximos 3 dias úteis."
        
        # Atualizar pedido
        await self.db.pedidos_adicao.update_one(
            {"id": pedido_id},
            {"$set": {
                "status": StatusPedidoAdicao.PAGAMENTO_INICIADO.value,
                "metodo_pagamento": metodo.value,
                "pagamento_referencia": pagamento_info.get("referencia"),
                "pagamento_entidade": pagamento_info.get("entidade"),
                "updated_at": now.isoformat()
            }}
        )
        
        logger.info(f"Pagamento iniciado para pedido {pedido_id} via {metodo.value}")
        
        return {
            "sucesso": True,
            "pagamento": pagamento_info,
            "mensagem": pagamento_info["instrucoes"]
        }
    
    async def confirmar_pagamento(
        self,
        pedido_id: str,
        pagamento_id: Optional[str] = None,
        confirmado_por: Optional[str] = None
    ) -> Dict:
        """
        Confirmar pagamento e aplicar a adição de recursos.
        Pode ser chamado por webhook da gateway ou manualmente pelo admin.
        """
        now = datetime.now(timezone.utc)
        
        pedido = await self.obter_pedido(pedido_id)
        if not pedido:
            raise ValueError("Pedido não encontrado")
        
        if pedido["status"] == StatusPedidoAdicao.APLICADO.value:
            return {
                "sucesso": True,
                "ja_aplicado": True,
                "mensagem": "Este pedido já foi processado anteriormente."
            }
        
        if pedido["status"] not in [
            StatusPedidoAdicao.PENDENTE_PAGAMENTO.value,
            StatusPedidoAdicao.PAGAMENTO_INICIADO.value
        ]:
            raise ValueError(f"Pedido não está em estado válido para confirmação. Status: {pedido['status']}")
        
        # Marcar como pago
        await self.db.pedidos_adicao.update_one(
            {"id": pedido_id},
            {"$set": {
                "status": StatusPedidoAdicao.PAGO.value,
                "pagamento_id": pagamento_id,
                "pagamento_data": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        
        # Aplicar a adição de recursos
        resultado_aplicacao = await self._aplicar_adicao(pedido_id, confirmado_por)
        
        logger.info(f"Pagamento confirmado e recursos aplicados para pedido {pedido_id}")
        
        return {
            "sucesso": True,
            "pedido_id": pedido_id,
            "valor_pago": pedido["valor_prorata"],
            "veiculos_adicionados": pedido["veiculos_adicionar"],
            "motoristas_adicionados": pedido["motoristas_adicionar"],
            "nova_mensalidade": pedido["nova_mensalidade"],
            "mensagem": f"Pagamento confirmado! Adicionados {pedido['veiculos_adicionar']} veículo(s) e {pedido['motoristas_adicionar']} motorista(s). Nova mensalidade: €{pedido['nova_mensalidade']:.2f}"
        }
    
    async def _aplicar_adicao(self, pedido_id: str, aplicado_por: Optional[str] = None) -> Dict:
        """Aplicar a adição de recursos à subscrição"""
        now = datetime.now(timezone.utc)
        
        pedido = await self.obter_pedido(pedido_id)
        if not pedido:
            raise ValueError("Pedido não encontrado")
        
        # Atualizar subscrição
        subscricao_id = pedido["subscricao_id"]
        
        # Buscar subscrição atual para recalcular preços
        subscricao = await self.db.subscricoes.find_one({"id": subscricao_id}, {"_id": 0})
        if not subscricao:
            raise ValueError("Subscrição não encontrada")
        
        # Recalcular preços com novos valores
        plano_id = subscricao.get("plano_id")
        periodicidade = subscricao.get("periodicidade", "mensal")
        
        if plano_id:
            preco_info = await self.planos_service.calcular_preco_plano(
                plano_id,
                periodicidade,
                pedido["user_id"],
                pedido["veiculos_novo"],
                pedido["motoristas_novo"]
            )
            preco_veiculos = preco_info.get("preco_veiculos", 0)
            preco_motoristas = preco_info.get("preco_motoristas", 0)
            preco_final = preco_info.get("preco_final", pedido["nova_mensalidade"])
        else:
            preco_veiculos = 0
            preco_motoristas = 0
            preco_final = pedido["nova_mensalidade"]
        
        # Registar ajuste no histórico
        ajuste = {
            "id": str(uuid.uuid4()),
            "data": now.isoformat(),
            "tipo": "adicao_recursos_prepago",
            "pedido_id": pedido_id,
            "veiculos_anterior": pedido["veiculos_atual"],
            "motoristas_anterior": pedido["motoristas_atual"],
            "veiculos_novo": pedido["veiculos_novo"],
            "motoristas_novo": pedido["motoristas_novo"],
            "valor_prorata_pago": pedido["valor_prorata"],
            "nova_mensalidade": round(preco_final, 2),
            "aplicado_por": aplicado_por or "sistema"
        }
        
        # Atualizar subscrição
        await self.db.subscricoes.update_one(
            {"id": subscricao_id},
            {
                "$set": {
                    "num_veiculos": pedido["veiculos_novo"],
                    "num_motoristas": pedido["motoristas_novo"],
                    "preco_veiculos": round(preco_veiculos, 2),
                    "preco_motoristas": round(preco_motoristas, 2),
                    "preco_final": round(preco_final, 2),
                    "updated_at": now.isoformat()
                },
                "$push": {"historico_ajustes": ajuste}
            }
        )
        
        # Marcar pedido como aplicado
        await self.db.pedidos_adicao.update_one(
            {"id": pedido_id},
            {"$set": {
                "status": StatusPedidoAdicao.APLICADO.value,
                "aplicado_em": now.isoformat(),
                "aplicado_por": aplicado_por or "sistema",
                "updated_at": now.isoformat()
            }}
        )
        
        # Criar registo de fatura/pagamento
        fatura = {
            "id": str(uuid.uuid4()),
            "tipo": "prorata_prepago",
            "user_id": pedido["user_id"],
            "subscricao_id": subscricao_id,
            "pedido_adicao_id": pedido_id,
            "valor": pedido["valor_prorata"],
            "descricao": f"Adição de recursos: +{pedido['veiculos_adicionar']} veículo(s), +{pedido['motoristas_adicionar']} motorista(s)",
            "metodo_pagamento": pedido.get("metodo_pagamento"),
            "status": "pago",
            "pago_em": now.isoformat(),
            "created_at": now.isoformat()
        }
        await self.db.faturas_subscricao.insert_one(fatura)
        
        logger.info(f"Adição aplicada: {pedido['veiculos_adicionar']} veículos, {pedido['motoristas_adicionar']} motoristas para user {pedido['user_id']}")
        
        return {
            "sucesso": True,
            "subscricao_atualizada": True
        }
    
    async def cancelar_pedido(self, pedido_id: str, cancelado_por: Optional[str] = None) -> Dict:
        """Cancelar um pedido pendente"""
        now = datetime.now(timezone.utc)
        
        pedido = await self.obter_pedido(pedido_id)
        if not pedido:
            raise ValueError("Pedido não encontrado")
        
        if pedido["status"] not in [
            StatusPedidoAdicao.PENDENTE_PAGAMENTO.value,
            StatusPedidoAdicao.PAGAMENTO_INICIADO.value
        ]:
            raise ValueError("Apenas pedidos pendentes podem ser cancelados")
        
        await self.db.pedidos_adicao.update_one(
            {"id": pedido_id},
            {"$set": {
                "status": StatusPedidoAdicao.CANCELADO.value,
                "cancelado_por": cancelado_por,
                "updated_at": now.isoformat()
            }}
        )
        
        logger.info(f"Pedido {pedido_id} cancelado por {cancelado_por}")
        
        return {
            "sucesso": True,
            "mensagem": "Pedido cancelado com sucesso."
        }
    
    async def expirar_pedido(self, pedido_id: str) -> bool:
        """Marcar pedido como expirado"""
        now = datetime.now(timezone.utc)
        
        result = await self.db.pedidos_adicao.update_one(
            {"id": pedido_id},
            {"$set": {
                "status": StatusPedidoAdicao.EXPIRADO.value,
                "updated_at": now.isoformat()
            }}
        )
        
        return result.modified_count > 0
    
    async def verificar_pedidos_expirados(self) -> int:
        """Verificar e expirar pedidos que passaram do prazo"""
        now = datetime.now(timezone.utc)
        
        result = await self.db.pedidos_adicao.update_many(
            {
                "status": {"$in": [
                    StatusPedidoAdicao.PENDENTE_PAGAMENTO.value,
                    StatusPedidoAdicao.PAGAMENTO_INICIADO.value
                ]},
                "expires_at": {"$lt": now.isoformat()}
            },
            {"$set": {
                "status": StatusPedidoAdicao.EXPIRADO.value,
                "updated_at": now.isoformat()
            }}
        )
        
        if result.modified_count > 0:
            logger.info(f"Expirados {result.modified_count} pedidos de adição")
        
        return result.modified_count
    
    async def obter_todos_pedidos_pendentes(self) -> List[Dict]:
        """Obter todos os pedidos pendentes (admin)"""
        pedidos = await self.db.pedidos_adicao.find({
            "status": {"$in": [
                StatusPedidoAdicao.PENDENTE_PAGAMENTO.value,
                StatusPedidoAdicao.PAGAMENTO_INICIADO.value
            ]}
        }, {"_id": 0}).sort("created_at", -1).to_list(100)
        return pedidos
    
    def _gerar_referencia_mb(self, pedido_id: str) -> str:
        """Gerar referência Multibanco (placeholder - integrar com Ifthenpay)"""
        # Formato: XXX XXX XXX (9 dígitos)
        import hashlib
        hash_obj = hashlib.md5(pedido_id.encode())
        num = int(hash_obj.hexdigest()[:9], 16) % 1000000000
        ref = f"{num:09d}"
        return f"{ref[:3]} {ref[3:6]} {ref[6:]}"
