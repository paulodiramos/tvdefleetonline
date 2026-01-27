"""
Serviço de Gestão de Planos e Módulos
Lógica de negócio para planos, módulos, subscrições e preços
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from calendar import monthrange
import uuid
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.planos_modulos import (
    ModuloSistema, ModuloCreate, ModuloUpdate,
    PlanoSistema, PlanoCreate, PlanoUpdate,
    Subscricao, SubscricaoCreate, ModuloSubscrito,
    AtribuirModuloRequest, AtribuirPlanoRequest, AtualizarRecursosRequest,
    Promocao, PrecoEspecial, TrialInfo, DescontoEspecial,
    TipoUsuario, Periodicidade, StatusSubscricao, PrecosPlano,
    MODULOS_PREDEFINIDOS, PLANOS_PREDEFINIDOS, Precos, LimitesPlano
)

logger = logging.getLogger(__name__)


class PlanosModulosService:
    """Serviço para gestão de planos e módulos"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    # ==================== MÓDULOS ====================
    
    async def get_all_modulos(self, tipo_usuario: Optional[str] = None, apenas_ativos: bool = True) -> List[Dict]:
        """Obter todos os módulos"""
        filtro = {}
        if tipo_usuario:
            filtro["tipo_usuario"] = {"$in": [tipo_usuario, "ambos"]}
        if apenas_ativos:
            filtro["ativo"] = True
        
        modulos = await self.db.modulos_sistema.find(filtro, {"_id": 0}).sort("ordem", 1).to_list(100)
        return modulos
    
    async def get_modulo(self, modulo_id: str) -> Optional[Dict]:
        """Obter módulo por ID ou código"""
        modulo = await self.db.modulos_sistema.find_one(
            {"$or": [{"id": modulo_id}, {"codigo": modulo_id}]},
            {"_id": 0}
        )
        return modulo
    
    async def criar_modulo(self, data: ModuloCreate, criado_por: str) -> Dict:
        """Criar novo módulo"""
        now = datetime.now(timezone.utc).isoformat()
        
        modulo = {
            "id": str(uuid.uuid4()),
            "codigo": data.codigo,
            "nome": data.nome,
            "descricao": data.descricao,
            "tipo_usuario": data.tipo_usuario.value if hasattr(data.tipo_usuario, 'value') else data.tipo_usuario,
            "tipo_cobranca": data.tipo_cobranca.value if hasattr(data.tipo_cobranca, 'value') else data.tipo_cobranca,
            "precos": data.precos.model_dump() if hasattr(data.precos, 'model_dump') else data.precos,
            "icone": data.icone,
            "cor": data.cor,
            "ordem": data.ordem,
            "ativo": True,
            "destaque": False,
            "funcionalidades": data.funcionalidades,
            "requer_modulos": data.requer_modulos,
            "promocoes": [],
            "precos_especiais": [],
            "created_at": now,
            "updated_at": now,
            "created_by": criado_por
        }
        
        await self.db.modulos_sistema.insert_one(modulo)
        logger.info(f"Módulo criado: {modulo['nome']} por {criado_por}")
        return modulo
    
    async def atualizar_modulo(self, modulo_id: str, updates: ModuloUpdate, atualizado_por: str) -> Dict:
        """Atualizar módulo"""
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_data["updated_by"] = atualizado_por
        
        # Converter enums
        if "tipo_cobranca" in update_data and hasattr(update_data["tipo_cobranca"], 'value'):
            update_data["tipo_cobranca"] = update_data["tipo_cobranca"].value
        if "precos" in update_data and hasattr(update_data["precos"], 'model_dump'):
            update_data["precos"] = update_data["precos"].model_dump()
        
        result = await self.db.modulos_sistema.find_one_and_update(
            {"$or": [{"id": modulo_id}, {"codigo": modulo_id}]},
            {"$set": update_data},
            return_document=True
        )
        
        if result:
            result.pop("_id", None)
        return result
    
    async def eliminar_modulo(self, modulo_id: str) -> bool:
        """Desativar módulo (soft delete)"""
        result = await self.db.modulos_sistema.update_one(
            {"$or": [{"id": modulo_id}, {"codigo": modulo_id}]},
            {"$set": {"ativo": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count > 0
    
    async def seed_modulos_predefinidos(self) -> int:
        """Criar módulos predefinidos se não existirem"""
        count = 0
        now = datetime.now(timezone.utc).isoformat()
        
        for codigo, info in MODULOS_PREDEFINIDOS.items():
            existing = await self.db.modulos_sistema.find_one({"codigo": codigo})
            if not existing:
                modulo = {
                    "id": str(uuid.uuid4()),
                    "codigo": codigo,
                    "nome": info["nome"],
                    "descricao": info["descricao"],
                    "tipo_usuario": info["tipo_usuario"],
                    "tipo_cobranca": info["tipo_cobranca"],
                    "precos": {"semanal": None, "mensal": None, "anual": None},
                    "icone": info["icone"],
                    "cor": info["cor"],
                    "ordem": info["ordem"],
                    "ativo": True,
                    "destaque": False,
                    "funcionalidades": info.get("funcionalidades", []),
                    "requer_modulos": [],
                    "promocoes": [],
                    "precos_especiais": [],
                    "brevemente": info.get("brevemente", False),
                    "created_at": now,
                    "updated_at": now
                }
                await self.db.modulos_sistema.insert_one(modulo)
                count += 1
        
        return count
    
    # ==================== PLANOS ====================
    
    async def get_all_planos(self, tipo_usuario: Optional[str] = None, apenas_ativos: bool = True) -> List[Dict]:
        """Obter todos os planos"""
        filtro = {}
        if tipo_usuario:
            filtro["tipo_usuario"] = {"$in": [tipo_usuario, "ambos"]}
        if apenas_ativos:
            filtro["ativo"] = True
        
        planos = await self.db.planos_sistema.find(filtro, {"_id": 0}).sort("ordem", 1).to_list(100)
        return planos
    
    async def get_plano(self, plano_id: str) -> Optional[Dict]:
        """Obter plano por ID"""
        plano = await self.db.planos_sistema.find_one({"id": plano_id}, {"_id": 0})
        return plano
    
    async def criar_plano(self, data: PlanoCreate, criado_por: str) -> Dict:
        """Criar novo plano"""
        now = datetime.now(timezone.utc).isoformat()
        
        plano = {
            "id": str(uuid.uuid4()),
            "nome": data.nome,
            "descricao": data.descricao,
            "tipo_usuario": data.tipo_usuario.value if hasattr(data.tipo_usuario, 'value') else data.tipo_usuario,
            "categoria": data.categoria,
            "precos_plano": data.precos_plano.model_dump() if hasattr(data.precos_plano, 'model_dump') else (dict(data.precos_plano) if data.precos_plano else {}),
            "precos": data.precos.model_dump() if hasattr(data.precos, 'model_dump') else (dict(data.precos) if data.precos else {}),
            "limites": data.limites.model_dump() if data.limites and hasattr(data.limites, 'model_dump') else (dict(data.limites) if data.limites else None),
            "modulos_incluidos": data.modulos_incluidos,
            "icone": data.icone,
            "cor": data.cor,
            "ordem": data.ordem,
            "ativo": True,
            "destaque": False,
            "permite_trial": data.permite_trial,
            "dias_trial": data.dias_trial,
            "features_destaque": data.features_destaque,
            "promocoes": [],
            "precos_especiais": [],
            "created_at": now,
            "updated_at": now,
            "created_by": criado_por
        }
        
        await self.db.planos_sistema.insert_one(plano)
        logger.info(f"Plano criado: {plano['nome']} por {criado_por}")
        return plano
    
    async def atualizar_plano(self, plano_id: str, updates: Dict, atualizado_por: str) -> Dict:
        """Atualizar plano"""
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        updates["updated_by"] = atualizado_por
        
        # Limpar valores None
        updates = {k: v for k, v in updates.items() if v is not None}
        
        result = await self.db.planos_sistema.find_one_and_update(
            {"id": plano_id},
            {"$set": updates},
            return_document=True
        )
        
        if result:
            result.pop("_id", None)
        return result
    
    async def eliminar_plano(self, plano_id: str) -> bool:
        """Desativar plano (soft delete)"""
        result = await self.db.planos_sistema.update_one(
            {"id": plano_id},
            {"$set": {"ativo": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count > 0
    
    async def seed_planos_predefinidos(self) -> int:
        """Criar planos predefinidos se não existirem"""
        count = 0
        now = datetime.now(timezone.utc).isoformat()
        
        for codigo, info in PLANOS_PREDEFINIDOS.items():
            existing = await self.db.planos_sistema.find_one({"categoria": info["categoria"], "tipo_usuario": info["tipo_usuario"]})
            if not existing:
                plano = {
                    "id": str(uuid.uuid4()),
                    "nome": info["nome"],
                    "descricao": info["descricao"],
                    "tipo_usuario": info["tipo_usuario"],
                    "categoria": info["categoria"],
                    "precos_plano": info.get("precos_plano", {}),
                    "precos": info.get("precos", {}),
                    "limites": info.get("limites"),
                    "modulos_incluidos": info["modulos_incluidos"],
                    "icone": info["icone"],
                    "cor": info["cor"],
                    "ordem": info["ordem"],
                    "ativo": True,
                    "destaque": info.get("destaque", False),
                    "permite_trial": info.get("permite_trial", False),
                    "dias_trial": info.get("dias_trial", 0),
                    "features_destaque": info.get("features_destaque", []),
                    "promocoes": [],
                    "precos_especiais": [],
                    "created_at": now,
                    "updated_at": now
                }
                await self.db.planos_sistema.insert_one(plano)
                count += 1
        
        return count
    
    # ==================== PROMOÇÕES ====================
    
    async def adicionar_promocao_plano(self, plano_id: str, promocao_data: Dict, criado_por: str) -> Dict:
        """Adicionar promoção a um plano"""
        promocao = {
            "id": str(uuid.uuid4()),
            "nome": promocao_data.get("nome"),
            "descricao": promocao_data.get("descricao"),
            "tipo": promocao_data.get("tipo", "normal"),
            "desconto_percentagem": promocao_data.get("desconto_percentagem", 0),
            "preco_fixo": promocao_data.get("preco_fixo"),
            "data_inicio": promocao_data.get("data_inicio", datetime.now(timezone.utc).isoformat()),
            "data_fim": promocao_data.get("data_fim"),
            "max_utilizacoes": promocao_data.get("max_utilizacoes"),
            "utilizacoes_atuais": 0,
            "codigo_promocional": promocao_data.get("codigo_promocional"),
            "ativa": True,
            "created_by": criado_por,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.planos_sistema.update_one(
            {"id": plano_id},
            {"$push": {"promocoes": promocao}}
        )
        
        return promocao
    
    async def adicionar_preco_especial_plano(self, plano_id: str, preco_data: Dict, criado_por: str) -> Dict:
        """Adicionar preço especial para parceiro específico"""
        preco_especial = {
            "id": str(uuid.uuid4()),
            "parceiro_id": preco_data["parceiro_id"],
            "parceiro_nome": preco_data.get("parceiro_nome"),
            "desconto_percentagem": preco_data.get("desconto_percentagem"),
            "preco_fixo_semanal": preco_data.get("preco_fixo_semanal"),
            "preco_fixo_mensal": preco_data.get("preco_fixo_mensal"),
            "preco_fixo_anual": preco_data.get("preco_fixo_anual"),
            "motivo": preco_data.get("motivo"),
            "data_inicio": preco_data.get("data_inicio", datetime.now(timezone.utc).isoformat()),
            "data_fim": preco_data.get("data_fim"),
            "criado_por": criado_por,
            "criado_em": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.planos_sistema.update_one(
            {"id": plano_id},
            {"$push": {"precos_especiais": preco_especial}}
        )
        
        return preco_especial
    
    # ==================== CÁLCULO DE PREÇOS ====================
    
    async def calcular_preco_plano(
        self, 
        plano_id: str, 
        periodicidade: str,
        user_id: Optional[str] = None,
        num_veiculos: int = 0,
        num_motoristas: int = 0,
        codigo_promocional: Optional[str] = None
    ) -> Dict:
        """Calcular preço final de um plano para parceiros (base + veículos + motoristas)"""
        plano = await self.get_plano(plano_id)
        if not plano:
            return {"erro": "Plano não encontrado"}
        
        tipo_usuario = plano.get("tipo_usuario", "parceiro")
        
        # Para motoristas, usar preços simples
        if tipo_usuario == "motorista":
            precos = plano.get("precos", {})
            preco_base = precos.get(periodicidade, 0) or 0
            return {
                "plano_id": plano_id,
                "plano_nome": plano.get("nome"),
                "periodicidade": periodicidade,
                "tipo_usuario": tipo_usuario,
                "num_veiculos": 0,
                "num_motoristas": 0,
                "preco_base": round(preco_base, 2),
                "preco_veiculos": 0,
                "preco_motoristas": 0,
                "preco_total": round(preco_base, 2),
                "desconto_aplicado": None,
                "preco_final": round(preco_base, 2)
            }
        
        # Para parceiros, usar precos_plano (base + por veículo + por motorista)
        precos_plano = plano.get("precos_plano", {})
        
        # Mapear periodicidade para campo
        periodo_map = {
            "semanal": "semanal",
            "mensal": "mensal", 
            "anual": "anual"
        }
        periodo = periodo_map.get(periodicidade, "mensal")
        
        preco_base = precos_plano.get(f"base_{periodo}", 0) or 0
        preco_por_veiculo = precos_plano.get(f"por_veiculo_{periodo}", 0) or 0
        preco_por_motorista = precos_plano.get(f"por_motorista_{periodo}", 0) or 0
        
        # Calcular totais
        preco_veiculos = preco_por_veiculo * num_veiculos
        preco_motoristas = preco_por_motorista * num_motoristas
        preco_total = preco_base + preco_veiculos + preco_motoristas
        
        preco_final = preco_total
        desconto_aplicado = None
        promocao_aplicada = None
        
        # Verificar preço especial para parceiro
        if user_id:
            precos_especiais = plano.get("precos_especiais", [])
            for pe in precos_especiais:
                if pe.get("parceiro_id") == user_id:
                    if pe.get("desconto_percentagem"):
                        desconto = pe["desconto_percentagem"] / 100
                        preco_final = preco_total * (1 - desconto)
                        desconto_aplicado = {
                            "tipo": "desconto_especial", 
                            "percentagem": pe["desconto_percentagem"],
                            "motivo": pe.get("motivo")
                        }
                    break
        
        # Verificar código promocional
        if codigo_promocional and not desconto_aplicado:
            promocoes = plano.get("promocoes", [])
            for promo in promocoes:
                if promo.get("codigo_promocional") == codigo_promocional and promo.get("ativa"):
                    # Verificar validade
                    now = datetime.now(timezone.utc)
                    data_fim = promo.get("data_fim")
                    if data_fim:
                        if isinstance(data_fim, str):
                            data_fim = datetime.fromisoformat(data_fim.replace('Z', '+00:00'))
                        if now > data_fim:
                            continue
                    
                    # Verificar limite de utilizações
                    if promo.get("max_utilizacoes"):
                        if promo.get("utilizacoes_atuais", 0) >= promo["max_utilizacoes"]:
                            continue
                    
                    desconto = promo.get("desconto_percentagem", 0) / 100
                    preco_final = preco_total * (1 - desconto)
                    promocao_aplicada = promo
                    desconto_aplicado = {
                        "tipo": "promocao",
                        "percentagem": promo.get("desconto_percentagem"),
                        "nome": promo.get("nome")
                    }
                    break
        
        return {
            "plano_id": plano_id,
            "plano_nome": plano.get("nome"),
            "periodicidade": periodicidade,
            "tipo_usuario": tipo_usuario,
            "num_veiculos": num_veiculos,
            "num_motoristas": num_motoristas,
            "preco_base": round(preco_base, 2),
            "preco_por_veiculo": round(preco_por_veiculo, 2),
            "preco_por_motorista": round(preco_por_motorista, 2),
            "preco_veiculos": round(preco_veiculos, 2),
            "preco_motoristas": round(preco_motoristas, 2),
            "preco_total": round(preco_total, 2),
            "desconto_aplicado": desconto_aplicado,
            "promocao_aplicada": promocao_aplicada,
            "preco_final": round(preco_final, 2)
        }
    
    async def calcular_prorata(
        self,
        user_id: str,
        novo_num_veiculos: Optional[int] = None,
        novo_num_motoristas: Optional[int] = None
    ) -> Dict:
        """Calcular valor pro-rata quando parceiro adiciona veículos/motoristas"""
        subscricao = await self.get_subscricao_user(user_id)
        if not subscricao:
            return {"erro": "Subscrição não encontrada"}
        
        if not subscricao.get("plano_id"):
            return {"erro": "Utilizador não tem plano ativo"}
        
        plano = await self.get_plano(subscricao["plano_id"])
        if not plano:
            return {"erro": "Plano não encontrado"}
        
        periodicidade = subscricao.get("periodicidade", "mensal")
        num_veiculos_atual = subscricao.get("num_veiculos", 0)
        num_motoristas_atual = subscricao.get("num_motoristas", 0)
        
        novo_veiculos = novo_num_veiculos if novo_num_veiculos is not None else num_veiculos_atual
        novo_motoristas = novo_num_motoristas if novo_num_motoristas is not None else num_motoristas_atual
        
        # Calcular preço atual
        preco_atual = await self.calcular_preco_plano(
            subscricao["plano_id"], periodicidade, user_id,
            num_veiculos_atual, num_motoristas_atual
        )
        
        # Calcular novo preço
        preco_novo = await self.calcular_preco_plano(
            subscricao["plano_id"], periodicidade, user_id,
            novo_veiculos, novo_motoristas
        )
        
        # Calcular dias restantes até próxima cobrança
        now = datetime.now(timezone.utc)
        proxima_cobranca = subscricao.get("proxima_cobranca")
        if proxima_cobranca:
            if isinstance(proxima_cobranca, str):
                proxima_cobranca = datetime.fromisoformat(proxima_cobranca.replace('Z', '+00:00'))
            dias_restantes = (proxima_cobranca - now).days
        else:
            # Se não tem próxima cobrança, assumir fim do mês
            _, dias_mes = monthrange(now.year, now.month)
            dias_restantes = dias_mes - now.day
        
        dias_restantes = max(0, dias_restantes)
        
        # Dias do período
        if periodicidade == "semanal":
            dias_periodo = 7
        elif periodicidade == "anual":
            dias_periodo = 365
        else:
            _, dias_periodo = monthrange(now.year, now.month)
        
        # Calcular diferença
        diferenca_mensal = preco_novo["preco_final"] - preco_atual["preco_final"]
        
        # Pro-rata: diferença × (dias restantes / dias período)
        valor_prorata = diferenca_mensal * (dias_restantes / dias_periodo) if dias_periodo > 0 else 0
        
        return {
            "user_id": user_id,
            "veiculos_atual": num_veiculos_atual,
            "motoristas_atual": num_motoristas_atual,
            "veiculos_novo": novo_veiculos,
            "motoristas_novo": novo_motoristas,
            "dias_restantes": dias_restantes,
            "dias_periodo": dias_periodo,
            "preco_mensal_anterior": round(preco_atual["preco_final"], 2),
            "preco_mensal_novo": round(preco_novo["preco_final"], 2),
            "diferenca_mensal": round(diferenca_mensal, 2),
            "valor_prorata": round(max(0, valor_prorata), 2),  # Só cobra se aumentou
            "nova_mensalidade": round(preco_novo["preco_final"], 2),
            "data_proxima_cobranca": proxima_cobranca.isoformat() if proxima_cobranca else None,
            "detalhes_novo": preco_novo
        }
    
    # ==================== SUBSCRIÇÕES ====================
    
    async def get_subscricao_user(self, user_id: str) -> Optional[Dict]:
        """Obter subscrição ativa de um utilizador"""
        subscricao = await self.db.subscricoes.find_one(
            {"user_id": user_id, "status": {"$in": ["ativo", "trial"]}},
            {"_id": 0}
        )
        return subscricao
    
    async def get_modulos_ativos_user(self, user_id: str) -> List[str]:
        """Obter lista de códigos de módulos ativos para um utilizador"""
        modulos = []
        
        # Buscar subscrição
        subscricao = await self.get_subscricao_user(user_id)
        
        if subscricao:
            # Módulos do plano
            if subscricao.get("plano_id"):
                plano = await self.get_plano(subscricao["plano_id"])
                if plano:
                    modulos.extend(plano.get("modulos_incluidos", []))
            
            # Módulos individuais
            for mod in subscricao.get("modulos_individuais", []):
                if mod.get("status") in ["ativo", "trial"]:
                    modulos.append(mod.get("modulo_codigo"))
        
        return list(set(modulos))
    
    async def atribuir_plano(self, request: AtribuirPlanoRequest, atribuido_por: str) -> Dict:
        """Atribuir plano a um utilizador"""
        now = datetime.now(timezone.utc)
        
        # Buscar plano
        plano = await self.get_plano(request.plano_id)
        if not plano:
            raise ValueError("Plano não encontrado")
        
        # Buscar utilizador
        user = await self.db.users.find_one({"id": request.user_id})
        if not user:
            user = await self.db.parceiros.find_one({"id": request.user_id})
        if not user:
            user = await self.db.motoristas.find_one({"id": request.user_id})
        
        user_nome = user.get("name") or user.get("nome") if user else None
        user_tipo = user.get("role", "parceiro") if user else "parceiro"
        
        # Calcular datas
        if request.trial_dias and request.trial_dias > 0:
            status = StatusSubscricao.TRIAL.value
            data_fim = (now + timedelta(days=request.trial_dias)).isoformat()
            proxima_cobranca = (now + timedelta(days=request.trial_dias)).isoformat()
            trial_info = {
                "ativo": True,
                "data_inicio": now.isoformat(),
                "data_fim": data_fim,
                "convertido": False
            }
        elif request.oferta and request.oferta_dias:
            status = StatusSubscricao.ATIVO.value
            data_fim = (now + timedelta(days=request.oferta_dias)).isoformat()
            proxima_cobranca = (now + timedelta(days=request.oferta_dias)).isoformat()
            trial_info = {"ativo": False}
        else:
            status = StatusSubscricao.ATIVO.value
            data_fim = None
            # Próxima cobrança = próximo mês
            if now.month == 12:
                proxima_cobranca = now.replace(year=now.year + 1, month=1, day=1).isoformat()
            else:
                proxima_cobranca = now.replace(month=now.month + 1, day=1).isoformat()
            trial_info = {"ativo": False}
        
        # Calcular preço com veículos e motoristas
        periodicidade = request.periodicidade.value if hasattr(request.periodicidade, 'value') else request.periodicidade
        preco_info = await self.calcular_preco_plano(
            request.plano_id,
            periodicidade,
            request.user_id,
            request.num_veiculos,
            request.num_motoristas
        )
        
        preco_base = preco_info.get("preco_base", 0)
        preco_veiculos = preco_info.get("preco_veiculos", 0)
        preco_motoristas = preco_info.get("preco_motoristas", 0)
        preco_total = preco_info.get("preco_total", 0)
        preco_final = preco_info.get("preco_final", preco_total)
        
        # Aplicar desconto especial se definido
        if request.desconto_percentagem:
            preco_final = preco_total * (1 - request.desconto_percentagem / 100)
        
        if request.oferta:
            preco_final = 0
        
        # Cancelar subscrição anterior
        await self.db.subscricoes.update_many(
            {"user_id": request.user_id, "status": {"$in": ["ativo", "trial"]}},
            {"$set": {"status": "substituido", "updated_at": now.isoformat()}}
        )
        
        # Criar nova subscrição
        subscricao = {
            "id": str(uuid.uuid4()),
            "user_id": request.user_id,
            "user_tipo": user_tipo,
            "user_nome": user_nome,
            "plano_id": request.plano_id,
            "plano_nome": plano.get("nome"),
            "plano_categoria": plano.get("categoria"),
            "num_veiculos": request.num_veiculos,
            "num_motoristas": request.num_motoristas,
            "modulos_individuais": [],
            "periodicidade": periodicidade,
            "preco_base": round(preco_base, 2),
            "preco_veiculos": round(preco_veiculos, 2),
            "preco_motoristas": round(preco_motoristas, 2),
            "preco_modulos": 0,
            "preco_final": round(preco_final, 2),
            "data_inicio": now.isoformat(),
            "data_fim": data_fim,
            "proxima_cobranca": proxima_cobranca,
            "status": status,
            "auto_renovacao": True,
            "trial": trial_info,
            "historico_ajustes": [],
            "desconto_especial": {
                "ativo": request.desconto_percentagem is not None or request.oferta,
                "percentagem": request.desconto_percentagem,
                "motivo": request.oferta_motivo if request.oferta else None
            },
            "metodo_pagamento": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "created_by": atribuido_por,
            "notas_admin": request.oferta_motivo if request.oferta else None
        }
        
        await self.db.subscricoes.insert_one(subscricao)
        
        # Atualizar utilizador
        update_user = {
            "plano_id": request.plano_id,
            "plano_nome": plano.get("nome"),
            "subscricao_id": subscricao["id"],
            "subscricao_status": status
        }
        
        await self.db.users.update_one({"id": request.user_id}, {"$set": update_user})
        await self.db.parceiros.update_one({"id": request.user_id}, {"$set": update_user})
        await self.db.motoristas.update_one({"id": request.user_id}, {"$set": update_user})
        
        logger.info(f"Plano {plano['nome']} atribuído a {request.user_id} por {atribuido_por}")
        
        return subscricao
    
    async def atribuir_modulo(self, request: AtribuirModuloRequest, atribuido_por: str) -> Dict:
        """Atribuir módulo individual a um utilizador"""
        now = datetime.now(timezone.utc)
        
        # Buscar módulo
        modulo = await self.get_modulo(request.modulo_codigo)
        if not modulo:
            raise ValueError("Módulo não encontrado")
        
        # Calcular preço
        precos = modulo.get("precos", {})
        periodicidade = request.periodicidade.value if hasattr(request.periodicidade, 'value') else request.periodicidade
        preco = precos.get(periodicidade, 0) or 0
        
        if request.oferta or request.trial_dias:
            preco = 0
        elif request.desconto_percentagem:
            preco = preco * (1 - request.desconto_percentagem / 100)
        
        # Calcular datas
        if request.trial_dias and request.trial_dias > 0:
            status = StatusSubscricao.TRIAL.value
            data_fim = (now + timedelta(days=request.trial_dias)).isoformat()
            is_trial = True
        elif request.oferta and request.oferta_dias:
            status = StatusSubscricao.ATIVO.value
            data_fim = (now + timedelta(days=request.oferta_dias)).isoformat()
            is_trial = False
        else:
            status = StatusSubscricao.PENDENTE_PAGAMENTO.value
            data_fim = None
            is_trial = False
        
        modulo_subscrito = {
            "modulo_id": modulo["id"],
            "modulo_codigo": modulo["codigo"],
            "modulo_nome": modulo["nome"],
            "periodicidade": periodicidade,
            "preco_pago": round(preco, 2),
            "data_inicio": now.isoformat(),
            "data_fim": data_fim,
            "auto_renovacao": True,
            "status": status,
            "trial": is_trial,
            "oferta": request.oferta,
            "oferta_motivo": request.oferta_motivo,
            "atribuido_por": atribuido_por,
            "atribuido_em": now.isoformat()
        }
        
        # Verificar se utilizador já tem subscrição
        subscricao = await self.get_subscricao_user(request.user_id)
        
        if subscricao:
            # Adicionar módulo à subscrição existente
            await self.db.subscricoes.update_one(
                {"id": subscricao["id"]},
                {
                    "$push": {"modulos_individuais": modulo_subscrito},
                    "$set": {"updated_at": now.isoformat()}
                }
            )
        else:
            # Criar subscrição apenas com módulo
            user = await self.db.users.find_one({"id": request.user_id})
            user_nome = user.get("name") if user else None
            user_tipo = user.get("role", "parceiro") if user else "parceiro"
            
            nova_subscricao = {
                "id": str(uuid.uuid4()),
                "user_id": request.user_id,
                "user_tipo": user_tipo,
                "user_nome": user_nome,
                "plano_id": None,
                "modulos_individuais": [modulo_subscrito],
                "periodicidade": periodicidade,
                "preco_base": preco,
                "preco_final": preco,
                "data_inicio": now.isoformat(),
                "data_fim": data_fim,
                "status": status,
                "auto_renovacao": True,
                "trial": {"ativo": is_trial, "data_fim": data_fim if is_trial else None},
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "created_by": atribuido_por
            }
            
            await self.db.subscricoes.insert_one(nova_subscricao)
        
        logger.info(f"Módulo {modulo['nome']} atribuído a {request.user_id} por {atribuido_por}")
        
        return modulo_subscrito
    
    async def remover_modulo_user(self, user_id: str, modulo_codigo: str, removido_por: str) -> bool:
        """Remover módulo de um utilizador"""
        result = await self.db.subscricoes.update_one(
            {"user_id": user_id},
            {
                "$pull": {"modulos_individuais": {"modulo_codigo": modulo_codigo}},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        return result.modified_count > 0
    
    async def cancelar_subscricao(self, user_id: str, cancelado_por: str, motivo: Optional[str] = None) -> bool:
        """Cancelar subscrição de um utilizador"""
        now = datetime.now(timezone.utc).isoformat()
        
        result = await self.db.subscricoes.update_one(
            {"user_id": user_id, "status": {"$in": ["ativo", "trial"]}},
            {
                "$set": {
                    "status": "cancelado",
                    "cancelado_em": now,
                    "cancelado_por": cancelado_por,
                    "motivo_cancelamento": motivo,
                    "updated_at": now
                }
            }
        )
        
        # Atualizar utilizador
        await self.db.users.update_one({"id": user_id}, {"$set": {"subscricao_status": "cancelado"}})
        await self.db.parceiros.update_one({"id": user_id}, {"$set": {"subscricao_status": "cancelado"}})
        
        return result.modified_count > 0
    
    async def atualizar_recursos_subscricao(
        self, 
        request: AtualizarRecursosRequest,
        atualizado_por: str
    ) -> Dict:
        """Atualizar número de veículos/motoristas e gerar fatura pro-rata"""
        now = datetime.now(timezone.utc)
        
        subscricao = await self.get_subscricao_user(request.user_id)
        if not subscricao:
            raise ValueError("Subscrição não encontrada")
        
        if not subscricao.get("plano_id"):
            raise ValueError("Utilizador não tem plano ativo")
        
        # Calcular pro-rata
        prorata = await self.calcular_prorata(
            request.user_id,
            request.num_veiculos,
            request.num_motoristas
        )
        
        if "erro" in prorata:
            raise ValueError(prorata["erro"])
        
        # Registar ajuste no histórico
        ajuste = {
            "id": str(uuid.uuid4()),
            "data": now.isoformat(),
            "tipo": "alteracao_recursos",
            "veiculos_anterior": prorata["veiculos_atual"],
            "motoristas_anterior": prorata["motoristas_atual"],
            "veiculos_novo": prorata["veiculos_novo"],
            "motoristas_novo": prorata["motoristas_novo"],
            "valor_prorata": prorata["valor_prorata"],
            "nova_mensalidade": prorata["nova_mensalidade"],
            "motivo": request.motivo,
            "atualizado_por": atualizado_por
        }
        
        # Atualizar subscrição
        updates = {
            "num_veiculos": prorata["veiculos_novo"],
            "num_motoristas": prorata["motoristas_novo"],
            "preco_veiculos": prorata["detalhes_novo"]["preco_veiculos"],
            "preco_motoristas": prorata["detalhes_novo"]["preco_motoristas"],
            "preco_final": prorata["nova_mensalidade"],
            "updated_at": now.isoformat()
        }
        
        await self.db.subscricoes.update_one(
            {"id": subscricao["id"]},
            {
                "$set": updates,
                "$push": {"historico_ajustes": ajuste}
            }
        )
        
        logger.info(f"Recursos atualizados para {request.user_id}: {prorata['veiculos_novo']} veículos, {prorata['motoristas_novo']} motoristas")
        
        # Criar fatura pro-rata se houver valor a pagar
        fatura_prorata = None
        if prorata["valor_prorata"] > 0:
            fatura_prorata = {
                "id": str(uuid.uuid4()),
                "tipo": "prorata",
                "user_id": request.user_id,
                "subscricao_id": subscricao["id"],
                "valor": prorata["valor_prorata"],
                "descricao": f"Ajuste pro-rata: +{prorata['veiculos_novo'] - prorata['veiculos_atual']} veículos, +{prorata['motoristas_novo'] - prorata['motoristas_atual']} motoristas",
                "status": "pendente",
                "created_at": now.isoformat(),
                "created_by": atualizado_por
            }
            await self.db.faturas_subscricao.insert_one(fatura_prorata)
            fatura_prorata.pop("_id", None)
        
        return {
            "sucesso": True,
            "prorata": prorata,
            "fatura_prorata": fatura_prorata,
            "nova_mensalidade": prorata["nova_mensalidade"]
        }
    
    # ==================== VERIFICAÇÃO DE LIMITES ====================
    
    async def verificar_limites_user(self, user_id: str) -> Dict:
        """Verificar se utilizador está dentro dos limites do plano"""
        subscricao = await self.get_subscricao_user(user_id)
        
        if not subscricao or not subscricao.get("plano_id"):
            return {"dentro_limites": True, "limites": None}
        
        plano = await self.get_plano(subscricao["plano_id"])
        if not plano:
            return {"dentro_limites": True, "limites": None}
        
        limites = plano.get("limites", {})
        
        # Contar veículos e motoristas
        num_veiculos = await self.db.veiculos.count_documents({"parceiro_id": user_id})
        num_motoristas = await self.db.motoristas.count_documents({"parceiro_atribuido": user_id})
        
        resultado = {
            "dentro_limites": True,
            "limites": limites,
            "uso_atual": {
                "veiculos": num_veiculos,
                "motoristas": num_motoristas
            },
            "alertas": []
        }
        
        if limites.get("max_veiculos") and num_veiculos >= limites["max_veiculos"]:
            resultado["dentro_limites"] = False
            resultado["alertas"].append(f"Limite de veículos atingido ({num_veiculos}/{limites['max_veiculos']})")
        
        if limites.get("max_motoristas") and num_motoristas >= limites["max_motoristas"]:
            resultado["dentro_limites"] = False
            resultado["alertas"].append(f"Limite de motoristas atingido ({num_motoristas}/{limites['max_motoristas']})")
        
        return resultado
