"""
Serviço de Gestão de Comissões e Classificação de Motoristas
Inclui Sistema de Progressão Automática
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
import uuid
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.comissoes import (
    NivelEscalaComissao, NivelClassificacaoMotorista,
    ResultadoCalculoComissao
)

logger = logging.getLogger(__name__)


# Pesos para cálculo da pontuação de cuidado com veículo
PESOS_CUIDADO_VEICULO = {
    "vistorias": 0.40,       # 40% - Pontuação das vistorias
    "incidentes": 0.25,      # 25% - Ausência de incidentes/multas
    "manutencoes": 0.20,     # 20% - Manutenções em dia
    "avaliacao_parceiro": 0.15  # 15% - Avaliação manual do parceiro
}


# Níveis de classificação padrão
NIVEIS_CLASSIFICACAO_PADRAO = [
    {
        "nivel": 1,
        "nome": "Bronze",
        "descricao": "Nível inicial",
        "icone": "🥉",
        "cor": "#CD7F32",
        "meses_minimos": 0,
        "cuidado_veiculo_minimo": 0,
        "bonus_percentagem": 0.0
    },
    {
        "nivel": 2,
        "nome": "Prata",
        "descricao": "Motorista experiente",
        "icone": "🥈",
        "cor": "#C0C0C0",
        "meses_minimos": 3,
        "cuidado_veiculo_minimo": 60,
        "bonus_percentagem": 1.0
    },
    {
        "nivel": 3,
        "nome": "Ouro",
        "descricao": "Motorista dedicado",
        "icone": "🥇",
        "cor": "#FFD700",
        "meses_minimos": 6,
        "cuidado_veiculo_minimo": 75,
        "bonus_percentagem": 2.0
    },
    {
        "nivel": 4,
        "nome": "Platina",
        "descricao": "Motorista de excelência",
        "icone": "💎",
        "cor": "#E5E4E2",
        "meses_minimos": 12,
        "cuidado_veiculo_minimo": 85,
        "bonus_percentagem": 3.5
    },
    {
        "nivel": 5,
        "nome": "Diamante",
        "descricao": "Motorista de elite",
        "icone": "👑",
        "cor": "#B9F2FF",
        "meses_minimos": 24,
        "cuidado_veiculo_minimo": 95,
        "bonus_percentagem": 5.0
    }
]


# Escala de comissão padrão
ESCALA_COMISSAO_PADRAO = {
    "nome": "Escala Padrão",
    "descricao": "Escala de comissões baseada no valor faturado semanal",
    "niveis": [
        {"nome": "Nível 1", "valor_minimo": 0, "valor_maximo": 500, "percentagem_comissao": 10.0},
        {"nome": "Nível 2", "valor_minimo": 500, "valor_maximo": 1000, "percentagem_comissao": 12.0},
        {"nome": "Nível 3", "valor_minimo": 1000, "valor_maximo": 1500, "percentagem_comissao": 14.0},
        {"nome": "Nível 4", "valor_minimo": 1500, "valor_maximo": 2000, "percentagem_comissao": 16.0},
        {"nome": "Nível 5", "valor_minimo": 2000, "valor_maximo": None, "percentagem_comissao": 18.0}
    ]
}


class ComissoesService:
    """Serviço para gestão de comissões e classificações"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    # ==================== ESCALAS DE COMISSÃO ====================
    
    async def seed_escala_padrao(self) -> Dict:
        """Criar escala de comissão padrão se não existir"""
        escala_existente = await self.db.escalas_comissao.find_one({"nome": "Escala Padrão"})
        if escala_existente:
            return {"existente": True}
        
        now = datetime.now(timezone.utc)
        escala = {
            "id": str(uuid.uuid4()),
            "nome": ESCALA_COMISSAO_PADRAO["nome"],
            "descricao": ESCALA_COMISSAO_PADRAO["descricao"],
            "niveis": [],
            "ativo": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "created_by": "sistema"
        }
        
        for i, nivel_data in enumerate(ESCALA_COMISSAO_PADRAO["niveis"]):
            nivel = {
                "id": str(uuid.uuid4()),
                "nome": nivel_data["nome"],
                "valor_minimo": nivel_data["valor_minimo"],
                "valor_maximo": nivel_data["valor_maximo"],
                "percentagem_comissao": nivel_data["percentagem_comissao"],
                "ordem": i + 1
            }
            escala["niveis"].append(nivel)
        
        await self.db.escalas_comissao.insert_one(escala)
        escala.pop("_id", None)
        
        logger.info("Escala de comissão padrão criada")
        return escala
    
    async def listar_escalas(self) -> List[Dict]:
        """Listar todas as escalas de comissão"""
        escalas = await self.db.escalas_comissao.find(
            {}, {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        return escalas
    
    async def obter_escala(self, escala_id: str) -> Optional[Dict]:
        """Obter uma escala por ID"""
        return await self.db.escalas_comissao.find_one(
            {"id": escala_id}, {"_id": 0}
        )
    
    async def obter_escala_ativa(self) -> Optional[Dict]:
        """Obter a escala ativa (primeira ativa encontrada)"""
        return await self.db.escalas_comissao.find_one(
            {"ativo": True}, {"_id": 0}
        )
    
    async def criar_escala(self, nome: str, descricao: str, niveis: List[Dict], created_by: str) -> Dict:
        """Criar nova escala de comissão"""
        now = datetime.now(timezone.utc)
        
        escala = {
            "id": str(uuid.uuid4()),
            "nome": nome,
            "descricao": descricao,
            "niveis": [],
            "ativo": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "created_by": created_by
        }
        
        for i, nivel_data in enumerate(niveis):
            nivel = {
                "id": str(uuid.uuid4()),
                "nome": nivel_data.get("nome", f"Nível {i+1}"),
                "valor_minimo": float(nivel_data.get("valor_minimo", 0)),
                "valor_maximo": float(nivel_data["valor_maximo"]) if nivel_data.get("valor_maximo") else None,
                "percentagem_comissao": float(nivel_data.get("percentagem_comissao", 0)),
                "ordem": i + 1
            }
            escala["niveis"].append(nivel)
        
        await self.db.escalas_comissao.insert_one(escala)
        escala.pop("_id", None)
        
        logger.info(f"Escala de comissão '{nome}' criada por {created_by}")
        return escala
    
    async def atualizar_niveis_escala(self, escala_id: str, niveis: List[Dict], updated_by: str) -> Dict:
        """Atualizar níveis de uma escala"""
        now = datetime.now(timezone.utc)
        
        niveis_formatados = []
        for i, nivel_data in enumerate(niveis):
            nivel = {
                "id": nivel_data.get("id") or str(uuid.uuid4()),
                "nome": nivel_data.get("nome", f"Nível {i+1}"),
                "valor_minimo": float(nivel_data.get("valor_minimo", 0)),
                "valor_maximo": float(nivel_data["valor_maximo"]) if nivel_data.get("valor_maximo") else None,
                "percentagem_comissao": float(nivel_data.get("percentagem_comissao", 0)),
                "ordem": i + 1
            }
            niveis_formatados.append(nivel)
        
        await self.db.escalas_comissao.update_one(
            {"id": escala_id},
            {"$set": {
                "niveis": niveis_formatados,
                "updated_at": now.isoformat(),
                "updated_by": updated_by
            }}
        )
        
        return await self.obter_escala(escala_id)
    
    async def eliminar_escala(self, escala_id: str) -> bool:
        """Eliminar uma escala"""
        result = await self.db.escalas_comissao.delete_one({"id": escala_id})
        return result.deleted_count > 0
    
    def obter_nivel_escala_para_valor(self, escala: Dict, valor: float) -> Optional[Dict]:
        """Obter o nível de escala aplicável para um valor faturado"""
        niveis = sorted(escala.get("niveis", []), key=lambda x: x.get("ordem", 0))
        
        for nivel in niveis:
            valor_min = nivel.get("valor_minimo", 0)
            valor_max = nivel.get("valor_maximo")
            
            if valor >= valor_min:
                if valor_max is None or valor < valor_max:
                    return nivel
        
        # Se não encontrar, retorna o último nível (sem limite máximo)
        for nivel in reversed(niveis):
            if nivel.get("valor_maximo") is None:
                return nivel
        
        return niveis[-1] if niveis else None
    
    # ==================== CLASSIFICAÇÃO DE MOTORISTAS ====================
    
    async def seed_niveis_classificacao(self) -> Dict:
        """Criar níveis de classificação padrão se não existirem"""
        config = await self.db.configuracoes_sistema.find_one({"_id": "classificacao_motoristas"})
        if config and config.get("niveis"):
            return {"existente": True}
        
        now = datetime.now(timezone.utc)
        niveis = []
        
        for nivel_data in NIVEIS_CLASSIFICACAO_PADRAO:
            nivel = {
                "id": str(uuid.uuid4()),
                **nivel_data,
                "ordem": nivel_data["nivel"]
            }
            niveis.append(nivel)
        
        config = {
            "_id": "classificacao_motoristas",
            "niveis": niveis,
            "criterio_automatico": True,
            "updated_at": now.isoformat(),
            "updated_by": "sistema"
        }
        
        await self.db.configuracoes_sistema.update_one(
            {"_id": "classificacao_motoristas"},
            {"$set": config},
            upsert=True
        )
        
        logger.info("Níveis de classificação de motoristas criados")
        return {"niveis": niveis}
    
    async def obter_config_classificacao(self) -> Dict:
        """Obter configuração de classificação de motoristas"""
        config = await self.db.configuracoes_sistema.find_one(
            {"_id": "classificacao_motoristas"}
        )
        if not config:
            await self.seed_niveis_classificacao()
            config = await self.db.configuracoes_sistema.find_one(
                {"_id": "classificacao_motoristas"}
            )
        
        config.pop("_id", None)
        return config
    
    async def atualizar_niveis_classificacao(self, niveis: List[Dict], updated_by: str) -> Dict:
        """Atualizar níveis de classificação"""
        now = datetime.now(timezone.utc)
        
        niveis_formatados = []
        for nivel_data in niveis:
            nivel = {
                "id": nivel_data.get("id") or str(uuid.uuid4()),
                "nivel": int(nivel_data.get("nivel", 1)),
                "nome": nivel_data.get("nome", ""),
                "descricao": nivel_data.get("descricao", ""),
                "icone": nivel_data.get("icone", "⭐"),
                "cor": nivel_data.get("cor", "#6B7280"),
                "meses_minimos": int(nivel_data.get("meses_minimos", 0)),
                "cuidado_veiculo_minimo": int(nivel_data.get("cuidado_veiculo_minimo", 0)),
                "bonus_percentagem": float(nivel_data.get("bonus_percentagem", 0)),
                "ordem": int(nivel_data.get("nivel", 1))
            }
            niveis_formatados.append(nivel)
        
        await self.db.configuracoes_sistema.update_one(
            {"_id": "classificacao_motoristas"},
            {"$set": {
                "niveis": niveis_formatados,
                "updated_at": now.isoformat(),
                "updated_by": updated_by
            }},
            upsert=True
        )
        
        return await self.obter_config_classificacao()
    
    async def obter_classificacao_motorista(self, motorista_id: str) -> Optional[Dict]:
        """Obter classificação atual de um motorista"""
        return await self.db.classificacoes_motoristas.find_one(
            {"motorista_id": motorista_id}, {"_id": 0}
        )
    
    async def calcular_classificacao_motorista(self, motorista_id: str) -> Dict:
        """Calcular automaticamente a classificação de um motorista"""
        config = await self.obter_config_classificacao()
        niveis = sorted(config.get("niveis", []), key=lambda x: x.get("nivel", 0), reverse=True)
        
        # Obter dados do motorista
        motorista = await self.db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
        if not motorista:
            raise ValueError("Motorista não encontrado")
        
        # Calcular meses de serviço
        data_inicio = motorista.get("data_inicio") or motorista.get("created_at")
        meses_servico = 0
        if data_inicio:
            try:
                if isinstance(data_inicio, str):
                    data_inicio = datetime.fromisoformat(data_inicio.replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                diff = now - data_inicio
                meses_servico = diff.days // 30
            except (ValueError, TypeError):
                pass
        
        # Obter pontuação de cuidado do veículo (se existir)
        classificacao_atual = await self.obter_classificacao_motorista(motorista_id)
        pontuacao_cuidado = classificacao_atual.get("pontuacao_cuidado_veiculo", 50) if classificacao_atual else 50
        
        # Encontrar nível aplicável
        nivel_aplicavel = niveis[-1] if niveis else None  # Começa com o mais baixo
        
        for nivel in niveis:
            meses_req = nivel.get("meses_minimos", 0)
            cuidado_req = nivel.get("cuidado_veiculo_minimo", 0)
            
            if meses_servico >= meses_req and pontuacao_cuidado >= cuidado_req:
                nivel_aplicavel = nivel
                break
        
        return {
            "nivel": nivel_aplicavel,
            "meses_servico": meses_servico,
            "pontuacao_cuidado_veiculo": pontuacao_cuidado
        }
    
    async def atribuir_classificacao_motorista(
        self,
        motorista_id: str,
        nivel_id: Optional[str] = None,
        nivel_manual: bool = False,
        pontuacao_cuidado_veiculo: Optional[int] = None,
        atribuido_por: str = "sistema",
        motivo: Optional[str] = None
    ) -> Dict:
        """Atribuir ou atualizar classificação de um motorista"""
        now = datetime.now(timezone.utc)
        
        config = await self.obter_config_classificacao()
        niveis = config.get("niveis", [])
        
        # Se manual, usar o nível especificado
        if nivel_manual and nivel_id:
            nivel = next((n for n in niveis if n["id"] == nivel_id), None)
            if not nivel:
                raise ValueError("Nível não encontrado")
            meses_servico = 0
            pontuacao = pontuacao_cuidado_veiculo or 0
        else:
            # Calcular automaticamente
            calc = await self.calcular_classificacao_motorista(motorista_id)
            nivel = calc["nivel"]
            meses_servico = calc["meses_servico"]
            pontuacao = pontuacao_cuidado_veiculo if pontuacao_cuidado_veiculo is not None else calc["pontuacao_cuidado_veiculo"]
        
        classificacao = {
            "motorista_id": motorista_id,
            "nivel_id": nivel["id"],
            "nivel_numero": nivel["nivel"],
            "nivel_nome": nivel["nome"],
            "bonus_percentagem": nivel["bonus_percentagem"],
            "meses_servico": meses_servico,
            "pontuacao_cuidado_veiculo": pontuacao,
            "data_atribuicao": now.isoformat(),
            "atribuido_por": atribuido_por,
            "motivo": motivo,
            "nivel_manual": nivel_manual
        }
        
        await self.db.classificacoes_motoristas.update_one(
            {"motorista_id": motorista_id},
            {"$set": classificacao},
            upsert=True
        )
        
        # Atualizar também no documento do motorista
        await self.db.motoristas.update_one(
            {"id": motorista_id},
            {"$set": {
                "classificacao": {
                    "nivel": nivel["nivel"],
                    "nome": nivel["nome"],
                    "icone": nivel.get("icone", "⭐"),
                    "bonus_percentagem": nivel["bonus_percentagem"]
                },
                "pontuacao_cuidado_veiculo": pontuacao
            }}
        )
        
        logger.info(f"Classificação '{nivel['nome']}' atribuída ao motorista {motorista_id}")
        return classificacao
    
    # ==================== CÁLCULO DE COMISSÃO ====================
    
    async def calcular_comissao(
        self,
        motorista_id: str,
        valor_faturado: float,
        escala_id: Optional[str] = None
    ) -> ResultadoCalculoComissao:
        """Calcular comissão total de um motorista (escala + bónus classificação)"""
        
        # Obter motorista
        motorista = await self.db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
        if not motorista:
            raise ValueError("Motorista não encontrado")
        
        # Obter escala (usar a especificada ou a ativa)
        if escala_id:
            escala = await self.obter_escala(escala_id)
        else:
            escala = await self.obter_escala_ativa()
        
        if not escala:
            # Criar escala padrão se não existir
            await self.seed_escala_padrao()
            escala = await self.obter_escala_ativa()
        
        # Obter nível da escala para o valor
        nivel_escala = self.obter_nivel_escala_para_valor(escala, valor_faturado)
        if not nivel_escala:
            raise ValueError("Não foi possível determinar o nível de comissão")
        
        percentagem_base = nivel_escala["percentagem_comissao"]
        valor_comissao_base = valor_faturado * (percentagem_base / 100)
        
        # Obter classificação do motorista
        classificacao = await self.obter_classificacao_motorista(motorista_id)
        if not classificacao:
            # Calcular e atribuir classificação
            classificacao = await self.atribuir_classificacao_motorista(motorista_id)
        
        bonus_classificacao = classificacao.get("bonus_percentagem", 0)
        valor_bonus = valor_faturado * (bonus_classificacao / 100)
        
        # Totais
        percentagem_total = percentagem_base + bonus_classificacao
        valor_comissao_total = valor_comissao_base + valor_bonus
        
        return ResultadoCalculoComissao(
            motorista_id=motorista_id,
            motorista_nome=motorista.get("nome") or motorista.get("name"),
            valor_faturado=round(valor_faturado, 2),
            escala_id=escala["id"],
            escala_nome=escala["nome"],
            nivel_escala_nome=nivel_escala["nome"],
            percentagem_base=percentagem_base,
            valor_comissao_base=round(valor_comissao_base, 2),
            nivel_classificacao=classificacao.get("nivel_nome", "Sem classificação"),
            bonus_classificacao=bonus_classificacao,
            valor_bonus=round(valor_bonus, 2),
            percentagem_total=percentagem_total,
            valor_comissao_total=round(valor_comissao_total, 2),
            detalhes=f"Base {percentagem_base}% (€{valor_comissao_base:.2f}) + Bónus {bonus_classificacao}% (€{valor_bonus:.2f})"
        )
    
    # ==================== TURNOS ====================
    
    async def obter_turnos_veiculo(self, veiculo_id: str) -> Dict:
        """Obter turnos de um veículo"""
        turnos = await self.db.turnos_veiculos.find_one(
            {"veiculo_id": veiculo_id}, {"_id": 0}
        )
        return turnos or {"veiculo_id": veiculo_id, "turnos": [], "motorista_principal_id": None}
    
    async def adicionar_turno(
        self,
        veiculo_id: str,
        motorista_id: str,
        hora_inicio: str,
        hora_fim: str,
        dias_semana: List[int] = None,
        notas: str = None
    ) -> Dict:
        """Adicionar turno a um veículo"""
        now = datetime.now(timezone.utc)
        
        # Buscar nome do motorista
        motorista = await self.db.motoristas.find_one({"id": motorista_id}, {"_id": 0, "nome": 1, "name": 1})
        motorista_nome = motorista.get("nome") or motorista.get("name") if motorista else None
        
        turno = {
            "id": str(uuid.uuid4()),
            "motorista_id": motorista_id,
            "motorista_nome": motorista_nome,
            "hora_inicio": hora_inicio,
            "hora_fim": hora_fim,
            "dias_semana": dias_semana if dias_semana is not None else [0, 1, 2, 3, 4, 5, 6],
            "ativo": True,
            "notas": notas,
            "created_at": now.isoformat()
        }
        
        await self.db.turnos_veiculos.update_one(
            {"veiculo_id": veiculo_id},
            {
                "$push": {"turnos": turno},
                "$setOnInsert": {"veiculo_id": veiculo_id, "motorista_principal_id": None}
            },
            upsert=True
        )
        
        return turno
    
    async def atualizar_turno(
        self,
        veiculo_id: str,
        turno_id: str,
        updates: Dict
    ) -> bool:
        """Atualizar um turno"""
        set_fields = {}
        for key, value in updates.items():
            if key in ["hora_inicio", "hora_fim", "dias_semana", "ativo", "notas"]:
                set_fields[f"turnos.$.{key}"] = value
        
        if not set_fields:
            return False
        
        result = await self.db.turnos_veiculos.update_one(
            {"veiculo_id": veiculo_id, "turnos.id": turno_id},
            {"$set": set_fields}
        )
        return result.modified_count > 0
    
    async def remover_turno(self, veiculo_id: str, turno_id: str) -> bool:
        """Remover um turno"""
        result = await self.db.turnos_veiculos.update_one(
            {"veiculo_id": veiculo_id},
            {"$pull": {"turnos": {"id": turno_id}}}
        )
        return result.modified_count > 0
    
    async def definir_motorista_principal(self, veiculo_id: str, motorista_id: str) -> bool:
        """Definir motorista principal de um veículo"""
        await self.db.turnos_veiculos.update_one(
            {"veiculo_id": veiculo_id},
            {"$set": {"motorista_principal_id": motorista_id}},
            upsert=True
        )
        return True
    
    # ==================== SISTEMA DE PROGRESSÃO AUTOMÁTICA ====================
    
    async def calcular_pontuacao_cuidado_veiculo(self, motorista_id: str) -> Dict:
        """
        Calcular pontuação de cuidado com veículo baseada em múltiplos factores:
        - Vistorias realizadas (40%)
        - Incidentes/multas (25%)
        - Manutenções em dia (20%)
        - Avaliação manual do parceiro (15%)
        """
        pontuacoes = {
            "vistorias": 50,  # Default se não houver dados
            "incidentes": 100,  # Default: sem incidentes = 100
            "manutencoes": 50,
            "avaliacao_parceiro": 50
        }
        detalhes = {}
        
        # 1. VISTORIAS - Calcular média das últimas vistorias
        vistorias = await self.db.vistorias.find(
            {"motorista_id": motorista_id}
        ).sort("data", -1).limit(10).to_list(10)
        
        if vistorias:
            # Calcular pontuação média das vistorias
            total_pontos = 0
            for vistoria in vistorias:
                # Se a vistoria tem pontuação explícita
                if "pontuacao" in vistoria:
                    total_pontos += vistoria["pontuacao"]
                else:
                    # Calcular baseado em problemas encontrados
                    problemas = len(vistoria.get("problemas", []))
                    pontos_vistoria = max(0, 100 - (problemas * 10))
                    total_pontos += pontos_vistoria
            
            pontuacoes["vistorias"] = total_pontos // len(vistorias)
            detalhes["vistorias"] = f"{len(vistorias)} vistorias analisadas"
        else:
            detalhes["vistorias"] = "Sem vistorias registadas"
        
        # 2. INCIDENTES - Verificar multas e incidentes nos últimos 6 meses
        seis_meses_atras = datetime.now(timezone.utc).replace(month=max(1, datetime.now().month - 6))
        
        incidentes = await self.db.incidentes.count_documents({
            "motorista_id": motorista_id,
            "created_at": {"$gte": seis_meses_atras.isoformat()}
        })
        
        multas = await self.db.multas.count_documents({
            "motorista_id": motorista_id,
            "data": {"$gte": seis_meses_atras.isoformat()}
        })
        
        total_problemas = incidentes + multas
        if total_problemas == 0:
            pontuacoes["incidentes"] = 100
        elif total_problemas <= 2:
            pontuacoes["incidentes"] = 80
        elif total_problemas <= 4:
            pontuacoes["incidentes"] = 60
        else:
            pontuacoes["incidentes"] = max(0, 100 - (total_problemas * 15))
        
        detalhes["incidentes"] = f"{incidentes} incidentes, {multas} multas nos últimos 6 meses"
        
        # 3. MANUTENÇÕES - Verificar se o motorista reporta problemas e cuida do veículo
        # Verificar veículos atribuídos ao motorista
        veiculos = await self.db.vehicles.find(
            {"motorista_id": motorista_id}
        ).to_list(10)
        
        if veiculos:
            manutencoes_em_dia = 0
            total_veiculos = len(veiculos)
            
            for veiculo in veiculos:
                # Verificar se documentos estão em dia
                docs_em_dia = 0
                
                # Seguro válido
                seguro_val = veiculo.get("seguro", {}).get("data_validade")
                if seguro_val:
                    try:
                        val_date = datetime.fromisoformat(seguro_val.replace('Z', '+00:00'))
                        if val_date > datetime.now(timezone.utc):
                            docs_em_dia += 1
                    except (ValueError, TypeError):
                        pass
                
                # Inspeção válida
                insp_val = veiculo.get("inspecao", {}).get("validade")
                if insp_val:
                    try:
                        val_date = datetime.fromisoformat(insp_val.replace('Z', '+00:00'))
                        if val_date > datetime.now(timezone.utc):
                            docs_em_dia += 1
                    except (ValueError, TypeError):
                        pass
                
                # Extintor válido
                ext_val = veiculo.get("extintor", {}).get("data_validade")
                if ext_val:
                    try:
                        val_date = datetime.fromisoformat(ext_val.replace('Z', '+00:00'))
                        if val_date > datetime.now(timezone.utc):
                            docs_em_dia += 1
                    except (ValueError, TypeError):
                        pass
                
                if docs_em_dia >= 2:  # Pelo menos 2 dos 3 em dia
                    manutencoes_em_dia += 1
            
            pontuacoes["manutencoes"] = (manutencoes_em_dia / total_veiculos) * 100 if total_veiculos > 0 else 50
            detalhes["manutencoes"] = f"{manutencoes_em_dia}/{total_veiculos} veículos com documentos em dia"
        else:
            detalhes["manutencoes"] = "Sem veículos atribuídos"
        
        # 4. AVALIAÇÃO DO PARCEIRO - Valor manual guardado
        motorista = await self.db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
        if motorista:
            avaliacao = motorista.get("avaliacao_parceiro")
            if avaliacao is not None:
                pontuacoes["avaliacao_parceiro"] = avaliacao
                detalhes["avaliacao_parceiro"] = f"Avaliação: {avaliacao}/100"
            else:
                detalhes["avaliacao_parceiro"] = "Sem avaliação manual"
        
        # Calcular pontuação final ponderada
        pontuacao_final = sum(
            pontuacoes[key] * PESOS_CUIDADO_VEICULO[key]
            for key in PESOS_CUIDADO_VEICULO
        )
        
        return {
            "pontuacao_final": round(pontuacao_final),
            "pontuacoes_parciais": pontuacoes,
            "detalhes": detalhes,
            "pesos": PESOS_CUIDADO_VEICULO
        }
    
    async def verificar_progressao_motorista(self, motorista_id: str) -> Dict:
        """
        Verificar se um motorista é elegível para subir de nível
        Retorna informação sobre o nível actual e o potencial próximo nível
        """
        # Obter classificação actual
        classificacao_atual = await self.obter_classificacao_motorista(motorista_id)
        
        # Calcular dados atuais
        motorista = await self.db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
        if not motorista:
            raise ValueError("Motorista não encontrado")
        
        # Calcular meses de serviço
        data_inicio = motorista.get("data_inicio") or motorista.get("created_at")
        meses_servico = 0
        if data_inicio:
            try:
                if isinstance(data_inicio, str):
                    data_inicio = datetime.fromisoformat(data_inicio.replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                diff = now - data_inicio
                meses_servico = diff.days // 30
            except (ValueError, TypeError):
                pass
        
        # Calcular pontuação de cuidado actualizada
        calc_cuidado = await self.calcular_pontuacao_cuidado_veiculo(motorista_id)
        pontuacao_cuidado = calc_cuidado["pontuacao_final"]
        
        # Obter configuração de níveis
        config = await self.obter_config_classificacao()
        niveis = sorted(config.get("niveis", []), key=lambda x: x.get("nivel", 0))
        
        nivel_atual = None
        proximo_nivel = None
        
        if classificacao_atual:
            nivel_atual_num = classificacao_atual.get("nivel_numero", 1)
            nivel_atual = next((n for n in niveis if n["nivel"] == nivel_atual_num), niveis[0])
            proximo_nivel = next((n for n in niveis if n["nivel"] == nivel_atual_num + 1), None)
        else:
            nivel_atual = niveis[0] if niveis else None
            proximo_nivel = niveis[1] if len(niveis) > 1 else None
        
        # Verificar elegibilidade para o próximo nível
        elegivel = False
        razoes_falta = []
        
        if proximo_nivel:
            meses_req = proximo_nivel.get("meses_minimos", 0)
            cuidado_req = proximo_nivel.get("cuidado_veiculo_minimo", 0)
            
            if meses_servico >= meses_req and pontuacao_cuidado >= cuidado_req:
                elegivel = True
            else:
                if meses_servico < meses_req:
                    razoes_falta.append(f"Faltam {meses_req - meses_servico} meses de serviço")
                if pontuacao_cuidado < cuidado_req:
                    razoes_falta.append(f"Pontuação de cuidado {pontuacao_cuidado}/{cuidado_req}")
        
        return {
            "motorista_id": motorista_id,
            "motorista_nome": motorista.get("nome") or motorista.get("name"),
            "meses_servico": meses_servico,
            "pontuacao_cuidado": pontuacao_cuidado,
            "detalhes_cuidado": calc_cuidado,
            "nivel_atual": nivel_atual,
            "proximo_nivel": proximo_nivel,
            "elegivel_promocao": elegivel,
            "razoes_falta": razoes_falta if not elegivel else []
        }
    
    async def criar_notificacao(
        self,
        user_id: str,
        titulo: str,
        mensagem: str,
        tipo: str = "info",
        dados: Optional[Dict] = None
    ):
        """Criar uma notificação para o utilizador"""
        now = datetime.now(timezone.utc)
        notificacao = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "titulo": titulo,
            "mensagem": mensagem,
            "tipo": tipo,
            "lida": False,
            "criada_em": now.isoformat(),
            "dados": dados or {}
        }
        await self.db.notificacoes.insert_one(notificacao)
        return notificacao
    
    async def promover_motorista(self, motorista_id: str, atribuido_por: str = "sistema") -> Tuple[bool, Dict]:
        """
        Tentar promover um motorista para o próximo nível
        Retorna (sucesso, detalhes)
        """
        verificacao = await self.verificar_progressao_motorista(motorista_id)
        
        if not verificacao["elegivel_promocao"]:
            return False, {
                "mensagem": "Motorista não elegível para promoção",
                "razoes": verificacao["razoes_falta"],
                "nivel_atual": verificacao["nivel_atual"],
                "proximo_nivel": verificacao["proximo_nivel"]
            }
        
        proximo_nivel = verificacao["proximo_nivel"]
        nivel_atual = verificacao["nivel_atual"]
        
        if not proximo_nivel:
            return False, {
                "mensagem": "Motorista já está no nível máximo",
                "nivel_atual": nivel_atual
            }
        
        # Promover o motorista
        classificacao = await self.atribuir_classificacao_motorista(
            motorista_id=motorista_id,
            nivel_id=proximo_nivel["id"],
            nivel_manual=False,
            pontuacao_cuidado_veiculo=verificacao["pontuacao_cuidado"],
            atribuido_por=atribuido_por,
            motivo=f"Promoção automática: {nivel_atual['nome']} → {proximo_nivel['nome']}"
        )
        
        # Obter user_id do motorista para notificação
        motorista = await self.db.motoristas.find_one({"id": motorista_id}, {"_id": 0, "user_id": 1})
        if motorista and motorista.get("user_id"):
            bonus_diferenca = proximo_nivel.get("bonus_percentagem", 0) - nivel_atual.get("bonus_percentagem", 0)
            await self.criar_notificacao(
                user_id=motorista["user_id"],
                titulo=f"🎉 Parabéns! Subiu para {proximo_nivel['nome']}!",
                mensagem=f"O seu excelente desempenho foi reconhecido! Passou de {nivel_atual['nome']} para {proximo_nivel['nome']}. "
                         f"O seu bónus de comissão aumentou +{bonus_diferenca}%.",
                tipo="promocao",
                dados={
                    "nivel_anterior": nivel_atual,
                    "nivel_novo": proximo_nivel,
                    "bonus_aumento": bonus_diferenca
                }
            )
        
        logger.info(f"Motorista {motorista_id} promovido de {nivel_atual['nome']} para {proximo_nivel['nome']}")
        
        return True, {
            "mensagem": "Promoção realizada com sucesso!",
            "nivel_anterior": nivel_atual,
            "nivel_novo": proximo_nivel,
            "classificacao": classificacao
        }
    
    async def recalcular_todas_classificacoes(self, atribuido_por: str = "sistema") -> Dict:
        """
        Recalcular classificações de todos os motoristas
        Usado pelo job automático e pelo botão manual do admin
        """
        resultados = {
            "total_motoristas": 0,
            "promovidos": [],
            "mantidos": [],
            "erros": [],
            "iniciado_em": datetime.now(timezone.utc).isoformat()
        }
        
        # Obter todos os motoristas activos
        motoristas = await self.db.motoristas.find(
            {"status": {"$ne": "inativo"}},
            {"_id": 0, "id": 1, "nome": 1, "name": 1}
        ).to_list(None)
        
        resultados["total_motoristas"] = len(motoristas)
        
        for motorista in motoristas:
            motorista_id = motorista["id"]
            nome = motorista.get("nome") or motorista.get("name") or motorista_id
            
            try:
                # Verificar elegibilidade para promoção
                sucesso, detalhes = await self.promover_motorista(motorista_id, atribuido_por)
                
                if sucesso:
                    resultados["promovidos"].append({
                        "motorista_id": motorista_id,
                        "nome": nome,
                        "nivel_anterior": detalhes["nivel_anterior"]["nome"],
                        "nivel_novo": detalhes["nivel_novo"]["nome"]
                    })
                else:
                    resultados["mantidos"].append({
                        "motorista_id": motorista_id,
                        "nome": nome,
                        "nivel_atual": detalhes.get("nivel_atual", {}).get("nome", "N/A"),
                        "razao": detalhes.get("mensagem", "Não elegível")
                    })
                    
            except Exception as e:
                logger.error(f"Erro ao recalcular classificação do motorista {motorista_id}: {str(e)}")
                resultados["erros"].append({
                    "motorista_id": motorista_id,
                    "nome": nome,
                    "erro": str(e)
                })
        
        resultados["finalizado_em"] = datetime.now(timezone.utc).isoformat()
        resultados["resumo"] = {
            "promovidos": len(resultados["promovidos"]),
            "mantidos": len(resultados["mantidos"]),
            "erros": len(resultados["erros"])
        }
        
        # Guardar registo da execução
        await self.db.logs_sistema.insert_one({
            "tipo": "recalculo_classificacoes",
            "data": resultados["iniciado_em"],
            "atribuido_por": atribuido_por,
            "resultados": resultados["resumo"]
        })
        
        logger.info(f"Recálculo de classificações concluído: {resultados['resumo']}")
        
        return resultados
    
    async def atualizar_avaliacao_parceiro(
        self,
        motorista_id: str,
        avaliacao: int,
        avaliado_por: str
    ) -> Dict:
        """
        Atualizar a avaliação manual do parceiro para um motorista
        Valor de 0 a 100
        """
        if avaliacao < 0 or avaliacao > 100:
            raise ValueError("Avaliação deve estar entre 0 e 100")
        
        now = datetime.now(timezone.utc)
        
        await self.db.motoristas.update_one(
            {"id": motorista_id},
            {"$set": {
                "avaliacao_parceiro": avaliacao,
                "avaliacao_parceiro_data": now.isoformat(),
                "avaliacao_parceiro_por": avaliado_por
            }}
        )
        
        # Recalcular pontuação de cuidado
        calc = await self.calcular_pontuacao_cuidado_veiculo(motorista_id)
        
        # Atualizar classificação se necessário
        await self.db.classificacoes_motoristas.update_one(
            {"motorista_id": motorista_id},
            {"$set": {"pontuacao_cuidado_veiculo": calc["pontuacao_final"]}}
        )
        
        return {
            "motorista_id": motorista_id,
            "avaliacao": avaliacao,
            "pontuacao_cuidado_atualizada": calc["pontuacao_final"],
            "detalhes": calc
        }
