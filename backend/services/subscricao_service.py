"""
Serviço para atualizar subscrições automaticamente
quando veículos ou motoristas são adicionados/removidos
"""

from utils.database import get_database
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
db = get_database()


async def atualizar_contagem_subscricao(parceiro_id: str):
    """
    Atualiza a contagem de veículos e motoristas na subscrição do parceiro
    e recalcula o preço final automaticamente.
    """
    try:
        # Buscar subscrição ativa do parceiro
        subscricao = await db.subscricoes.find_one({
            "user_id": parceiro_id,
            "status": {"$in": ["ativo", "trial", "pendente"]}
        })
        
        if not subscricao:
            logger.info(f"Parceiro {parceiro_id} não tem subscrição ativa")
            return None
        
        # Contar veículos ativos do parceiro
        num_veiculos = await db.vehicles.count_documents({
            "parceiro_id": parceiro_id,
            "ativo": {"$ne": False}
        })
        
        # Contar motoristas ativos do parceiro
        num_motoristas = await db.motoristas.count_documents({
            "parceiro_id": parceiro_id,
            "ativo": {"$ne": False}
        })
        
        # Buscar plano para obter preços
        plano = await db.planos_sistema.find_one({"id": subscricao["plano_id"]})
        if not plano:
            logger.error(f"Plano {subscricao['plano_id']} não encontrado")
            return None
        
        precos_plano = plano.get("precos_plano", {})
        periodicidade = subscricao.get("periodicidade", "mensal")
        
        # Obter preços baseados na periodicidade
        if periodicidade == "anual":
            preco_base = precos_plano.get("base_anual", 0)
            preco_por_veiculo = precos_plano.get("por_veiculo_anual", 0)
            preco_por_motorista = precos_plano.get("por_motorista_anual", 0)
        elif periodicidade == "semanal":
            preco_base = precos_plano.get("base_semanal", 0)
            preco_por_veiculo = precos_plano.get("por_veiculo_semanal", 0)
            preco_por_motorista = precos_plano.get("por_motorista_semanal", 0)
        else:  # mensal
            preco_base = precos_plano.get("base_mensal", 0)
            preco_por_veiculo = precos_plano.get("por_veiculo_mensal", 0)
            preco_por_motorista = precos_plano.get("por_motorista_mensal", 0)
        
        # Calcular custos
        preco_veiculos = num_veiculos * preco_por_veiculo
        preco_motoristas = num_motoristas * preco_por_motorista
        preco_modulos = subscricao.get("preco_modulos", 0)
        
        # Calcular preço final
        preco_final = preco_base + preco_veiculos + preco_motoristas + preco_modulos
        
        # Aplicar desconto se existir
        desconto = subscricao.get("desconto_especial", {})
        if desconto.get("ativo") and desconto.get("percentagem"):
            preco_final = preco_final * (1 - desconto["percentagem"] / 100)
        
        # Atualizar subscrição
        old_veiculos = subscricao.get("num_veiculos", 0)
        old_motoristas = subscricao.get("num_motoristas", 0)
        old_preco = subscricao.get("preco_final", 0)
        
        result = await db.subscricoes.update_one(
            {"id": subscricao["id"]},
            {
                "$set": {
                    "num_veiculos": num_veiculos,
                    "num_motoristas": num_motoristas,
                    "preco_base": round(preco_base, 2),
                    "preco_veiculos": round(preco_veiculos, 2),
                    "preco_motoristas": round(preco_motoristas, 2),
                    "preco_final": round(preco_final, 2),
                    "updated_at": datetime.now(timezone.utc)
                },
                "$push": {
                    "historico_ajustes": {
                        "data": datetime.now(timezone.utc),
                        "tipo": "atualizacao_automatica",
                        "descricao": f"Atualização automática: {old_veiculos}→{num_veiculos} veículos, {old_motoristas}→{num_motoristas} motoristas",
                        "preco_anterior": round(old_preco, 2),
                        "preco_novo": round(preco_final, 2)
                    }
                }
            }
        )
        
        logger.info(f"Subscrição {subscricao['id']} atualizada: {num_veiculos} veículos, {num_motoristas} motoristas, €{preco_final:.2f}")
        
        return {
            "subscricao_id": subscricao["id"],
            "num_veiculos": num_veiculos,
            "num_motoristas": num_motoristas,
            "preco_base": round(preco_base, 2),
            "preco_veiculos": round(preco_veiculos, 2),
            "preco_motoristas": round(preco_motoristas, 2),
            "preco_final": round(preco_final, 2),
            "periodicidade": periodicidade
        }
        
    except Exception as e:
        logger.error(f"Erro ao atualizar subscrição do parceiro {parceiro_id}: {e}")
        return None


async def calcular_preco_estimado(plano_id: str, num_veiculos: int, num_motoristas: int, periodicidade: str = "mensal"):
    """
    Calcula o preço estimado para um plano com determinado número de veículos e motoristas.
    Útil para mostrar ao utilizador antes de confirmar.
    """
    plano = await db.planos_sistema.find_one({"id": plano_id})
    if not plano:
        return None
    
    precos_plano = plano.get("precos_plano", {})
    setup = precos_plano.get("setup", 0)
    
    # Obter preços baseados na periodicidade
    if periodicidade == "anual":
        preco_base = precos_plano.get("base_anual", 0)
        preco_por_veiculo = precos_plano.get("por_veiculo_anual", 0)
        preco_por_motorista = precos_plano.get("por_motorista_anual", 0)
    elif periodicidade == "semanal":
        preco_base = precos_plano.get("base_semanal", 0)
        preco_por_veiculo = precos_plano.get("por_veiculo_semanal", 0)
        preco_por_motorista = precos_plano.get("por_motorista_semanal", 0)
    else:  # mensal
        preco_base = precos_plano.get("base_mensal", 0)
        preco_por_veiculo = precos_plano.get("por_veiculo_mensal", 0)
        preco_por_motorista = precos_plano.get("por_motorista_mensal", 0)
    
    preco_veiculos = num_veiculos * preco_por_veiculo
    preco_motoristas = num_motoristas * preco_por_motorista
    preco_recorrente = preco_base + preco_veiculos + preco_motoristas
    
    return {
        "plano": plano.get("nome"),
        "setup": round(setup, 2),
        "preco_base": round(preco_base, 2),
        "preco_por_veiculo": round(preco_por_veiculo, 2),
        "preco_por_motorista": round(preco_por_motorista, 2),
        "num_veiculos": num_veiculos,
        "num_motoristas": num_motoristas,
        "preco_veiculos": round(preco_veiculos, 2),
        "preco_motoristas": round(preco_motoristas, 2),
        "preco_recorrente": round(preco_recorrente, 2),
        "preco_primeira_cobranca": round(setup + preco_recorrente, 2),
        "periodicidade": periodicidade,
        "detalhes": f"Setup: €{setup:.2f} (único) + €{preco_base:.2f} (base) + {num_veiculos} × €{preco_por_veiculo:.2f}/veículo + {num_motoristas} × €{preco_por_motorista:.2f}/motorista"
    }
