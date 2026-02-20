"""
Rotas de Gestão de Planos e Módulos
API para administração de planos, módulos, promoções e subscrições
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import logging
import uuid

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database
from services.planos_modulos_service import PlanosModulosService
from models.planos_modulos import (
    ModuloCreate, ModuloUpdate, PlanoCreate, PlanoUpdate,
    AtribuirPlanoRequest, AtribuirModuloRequest, AtualizarRecursosRequest,
    Periodicidade, TipoUsuario
)

router = APIRouter(prefix="/gestao-planos", tags=["gestao-planos"])
db = get_database()
logger = logging.getLogger(__name__)


def get_service():
    return PlanosModulosService(db)


# ==================== MÓDULOS ====================

@router.get("/modulos")
async def listar_modulos(
    tipo_usuario: Optional[str] = Query(None, description="Filtrar por tipo: parceiro, motorista"),
    apenas_ativos: bool = Query(True),
    current_user: Dict = Depends(get_current_user)
):
    """Listar todos os módulos disponíveis"""
    service = get_service()
    modulos = await service.get_all_modulos(tipo_usuario, apenas_ativos)
    return modulos


@router.get("/modulos/{modulo_id}")
async def obter_modulo(
    modulo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter detalhes de um módulo"""
    service = get_service()
    modulo = await service.get_modulo(modulo_id)
    if not modulo:
        raise HTTPException(status_code=404, detail="Módulo não encontrado")
    return modulo


@router.post("/modulos")
async def criar_modulo(
    data: ModuloCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Criar novo módulo (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    
    # Verificar se código já existe
    existing = await service.get_modulo(data.codigo)
    if existing:
        raise HTTPException(status_code=400, detail="Código de módulo já existe")
    
    modulo = await service.criar_modulo(data, current_user["id"])
    return modulo


@router.put("/modulos/{modulo_id}")
async def atualizar_modulo(
    modulo_id: str,
    updates: ModuloUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar módulo (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    modulo = await service.atualizar_modulo(modulo_id, updates, current_user["id"])
    if not modulo:
        raise HTTPException(status_code=404, detail="Módulo não encontrado")
    return modulo


@router.delete("/modulos/{modulo_id}")
async def eliminar_modulo(
    modulo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Desativar módulo (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    success = await service.eliminar_modulo(modulo_id)
    if not success:
        raise HTTPException(status_code=404, detail="Módulo não encontrado")
    return {"message": "Módulo desativado com sucesso"}


@router.post("/modulos/{modulo_id}/precos")
async def definir_precos_modulo(
    modulo_id: str,
    precos: Dict[str, float],
    current_user: Dict = Depends(get_current_user)
):
    """Definir preços de um módulo (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    modulo = await service.atualizar_modulo(
        modulo_id, 
        ModuloUpdate(precos=precos),
        current_user["id"]
    )
    if not modulo:
        raise HTTPException(status_code=404, detail="Módulo não encontrado")
    return modulo


# ==================== PLANOS ====================

@router.get("/planos")
async def listar_planos(
    tipo_usuario: Optional[str] = Query(None, description="Filtrar por tipo: parceiro, motorista"),
    apenas_ativos: bool = Query(True),
    current_user: Dict = Depends(get_current_user)
):
    """Listar todos os planos disponíveis"""
    service = get_service()
    planos = await service.get_all_planos(tipo_usuario, apenas_ativos)
    return planos


@router.get("/planos/public")
async def listar_planos_public(
    tipo_usuario: Optional[str] = Query(None)
):
    """Listar planos públicos (sem autenticação)"""
    service = get_service()
    planos = await service.get_all_planos(tipo_usuario, apenas_ativos=True)
    # Remover informações sensíveis
    for plano in planos:
        plano.pop("precos_especiais", None)
    return planos


@router.get("/planos/{plano_id}")
async def obter_plano(
    plano_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter detalhes de um plano"""
    service = get_service()
    plano = await service.get_plano(plano_id)
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    return plano


@router.post("/planos")
async def criar_plano(
    data: PlanoCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Criar novo plano (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    plano = await service.criar_plano(data, current_user["id"])
    return plano


@router.put("/planos/{plano_id}")
async def atualizar_plano(
    plano_id: str,
    updates: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar plano (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    plano = await service.atualizar_plano(plano_id, updates, current_user["id"])
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    return plano


@router.delete("/planos/{plano_id}")
async def eliminar_plano(
    plano_id: str,
    permanente: bool = False,
    current_user: Dict = Depends(get_current_user)
):
    """Desativar ou eliminar permanentemente um plano (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    
    if permanente:
        # Eliminação permanente
        result = await service.db.planos.delete_one({"id": plano_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Plano não encontrado")
        return {"message": "Plano eliminado permanentemente"}
    else:
        # Apenas desativar
        success = await service.eliminar_plano(plano_id)
        if not success:
            raise HTTPException(status_code=404, detail="Plano não encontrado")
        return {"message": "Plano desativado com sucesso"}


# ==================== PROMOÇÕES ====================

@router.post("/planos/{plano_id}/promocoes")
async def adicionar_promocao(
    plano_id: str,
    promocao_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Adicionar promoção a um plano (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    promocao = await service.adicionar_promocao_plano(plano_id, promocao_data, current_user["id"])
    return promocao


@router.post("/planos/{plano_id}/precos-especiais")
async def adicionar_preco_especial(
    plano_id: str,
    preco_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Adicionar preço especial para parceiro específico (Admin only)
    
    Tipos de preço especial suportados:
    - percentagem: Aplica desconto % sobre o preço base do plano
    - valor_fixo: Preço fixo mensal total para o parceiro
    - valor_fixo_veiculo: Preço fixo por cada veículo
    - valor_fixo_motorista: Preço fixo por cada motorista
    - valor_fixo_motorista_veiculo: Preço fixo por cada combinação motorista/veículo
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    if not preco_data.get("parceiro_id"):
        raise HTTPException(status_code=400, detail="parceiro_id é obrigatório")
    
    service = get_service()
    preco = await service.adicionar_preco_especial_plano(plano_id, preco_data, current_user["id"])
    return preco


# ==================== PREÇOS ESPECIAIS (ADMIN) ====================

@router.get("/precos-especiais")
async def listar_todos_precos_especiais(
    current_user: Dict = Depends(get_current_user)
):
    """Listar todos os preços especiais de todos os planos (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    precos = await service.listar_precos_especiais()
    return precos


@router.get("/precos-especiais/calcular")
async def calcular_preco_especial(
    parceiro_id: str = Query(..., description="ID do parceiro"),
    plano_id: str = Query(..., description="ID do plano"),
    num_veiculos: int = Query(0, description="Número de veículos"),
    num_motoristas: int = Query(0, description="Número de motoristas"),
    periodicidade: str = Query("mensal", description="Periodicidade: semanal, mensal, anual"),
    current_user: Dict = Depends(get_current_user)
):
    """
    Calcular preço para um parceiro, aplicando preço especial se existir.
    Útil para simulações e preview de faturação.
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    resultado = await service.calcular_preco_com_especial(
        parceiro_id, plano_id, num_veiculos, num_motoristas, periodicidade
    )
    
    if "erro" in resultado:
        raise HTTPException(status_code=400, detail=resultado["erro"])
    
    return resultado


@router.delete("/planos/{plano_id}/precos-especiais/{preco_id}")
async def remover_preco_especial(
    plano_id: str,
    preco_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remover preço especial de um plano (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    result = await db.planos_sistema.update_one(
        {"id": plano_id},
        {"$pull": {"precos_especiais": {"id": preco_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Preço especial não encontrado")
    
    return {"message": "Preço especial removido com sucesso"}


@router.put("/planos/{plano_id}/precos-especiais/{preco_id}")
async def atualizar_preco_especial(
    plano_id: str,
    preco_id: str,
    preco_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar preço especial de um plano (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    # Preparar dados de atualização
    update_fields = {}
    for key in ["tipo_desconto", "valor_desconto", "preco_fixo", "validade_inicio", 
                "validade_fim", "motivo", "ativo"]:
        if key in preco_data:
            update_fields[f"precos_especiais.$.{key}"] = preco_data[key]
    
    update_fields["precos_especiais.$.updated_at"] = datetime.now(timezone.utc).isoformat()
    update_fields["precos_especiais.$.updated_by"] = current_user["id"]
    
    result = await db.planos_sistema.update_one(
        {"id": plano_id, "precos_especiais.id": preco_id},
        {"$set": update_fields}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Preço especial não encontrado")
    
    return {"message": "Preço especial atualizado com sucesso"}


# ==================== CÁLCULO DE PREÇOS ====================

@router.get("/planos/{plano_id}/calcular-preco")
async def calcular_preco(
    plano_id: str,
    periodicidade: str = Query("mensal", description="semanal, mensal, anual"),
    num_veiculos: int = Query(0),
    num_motoristas: int = Query(0),
    codigo_promocional: Optional[str] = Query(None),
    current_user: Dict = Depends(get_current_user)
):
    """Calcular preço de um plano (base + veículos + motoristas)"""
    service = get_service()
    resultado = await service.calcular_preco_plano(
        plano_id,
        periodicidade,
        current_user["id"],
        num_veiculos,
        num_motoristas,
        codigo_promocional
    )
    return resultado


@router.get("/subscricoes/user/{user_id}/calcular-prorata")
async def calcular_prorata(
    user_id: str,
    num_veiculos: Optional[int] = Query(None),
    num_motoristas: Optional[int] = Query(None),
    current_user: Dict = Depends(get_current_user)
):
    """Calcular valor pro-rata para alteração de recursos"""
    if current_user["role"] != UserRole.ADMIN and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    service = get_service()
    resultado = await service.calcular_prorata(user_id, num_veiculos, num_motoristas)
    
    if "erro" in resultado:
        raise HTTPException(status_code=400, detail=resultado["erro"])
    
    return resultado


@router.post("/subscricoes/user/{user_id}/atualizar-recursos")
async def atualizar_recursos(
    user_id: str,
    num_veiculos: Optional[int] = None,
    num_motoristas: Optional[int] = None,
    motivo: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar número de veículos/motoristas e gerar fatura pro-rata"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    try:
        request = AtualizarRecursosRequest(
            user_id=user_id,
            num_veiculos=num_veiculos,
            num_motoristas=num_motoristas,
            motivo=motivo
        )
        resultado = await service.atualizar_recursos_subscricao(request, current_user["id"])
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== SUBSCRIÇÕES ====================

@router.get("/subscricoes")
async def listar_subscricoes(
    status: Optional[str] = Query(None),
    tipo_usuario: Optional[str] = Query(None),
    current_user: Dict = Depends(get_current_user)
):
    """Listar todas as subscrições (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    filtro = {}
    if status:
        filtro["status"] = status
    if tipo_usuario:
        filtro["user_tipo"] = tipo_usuario
    
    subscricoes = await db.subscricoes.find(filtro, {"_id": 0}).sort("created_at", -1).to_list(100)
    return subscricoes


@router.get("/subscricoes/minha")
async def obter_minha_subscricao(
    current_user: Dict = Depends(get_current_user)
):
    """Obter subscrição do utilizador atual"""
    service = get_service()
    subscricao = await service.get_subscricao_user(current_user["id"])
    
    if subscricao:
        # Incluir detalhes do plano
        if subscricao.get("plano_id"):
            plano = await service.get_plano(subscricao["plano_id"])
            subscricao["plano_detalhes"] = plano
    
    return subscricao


@router.get("/subscricoes/user/{user_id}")
async def obter_subscricao_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter subscrição de um utilizador específico (Admin only)"""
    if current_user["role"] != UserRole.ADMIN and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    service = get_service()
    subscricao = await service.get_subscricao_user(user_id)
    
    if subscricao:
        if subscricao.get("plano_id"):
            plano = await service.get_plano(subscricao["plano_id"])
            subscricao["plano_detalhes"] = plano
    
    return subscricao


@router.get("/modulos-ativos/user/{user_id}")
async def obter_modulos_ativos_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter módulos ativos de um utilizador"""
    if current_user["role"] != UserRole.ADMIN and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    service = get_service()
    modulos = await service.get_modulos_ativos_user(user_id)
    return {"user_id": user_id, "modulos_ativos": modulos}


@router.post("/subscricoes/atribuir-plano")
async def atribuir_plano(
    request: AtribuirPlanoRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Atribuir plano a um utilizador (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    try:
        subscricao = await service.atribuir_plano(request, current_user["id"])
        return subscricao
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/subscricoes/atribuir-modulo")
async def atribuir_modulo(
    request: AtribuirModuloRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Atribuir módulo individual a um utilizador (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    try:
        modulo = await service.atribuir_modulo(request, current_user["id"])
        return modulo
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/subscricoes/user/{user_id}/modulo/{modulo_codigo}")
async def remover_modulo(
    user_id: str,
    modulo_codigo: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remover módulo de um utilizador (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    success = await service.remover_modulo_user(user_id, modulo_codigo, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Módulo não encontrado")
    return {"message": "Módulo removido com sucesso"}


@router.post("/subscricoes/user/{user_id}/cancelar")
async def cancelar_subscricao(
    user_id: str,
    motivo: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Cancelar subscrição de um utilizador (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    success = await service.cancelar_subscricao(user_id, current_user["id"], motivo)
    if not success:
        raise HTTPException(status_code=404, detail="Subscrição não encontrada")
    return {"message": "Subscrição cancelada com sucesso"}


# ==================== DESCONTOS ESPECIAIS ====================

@router.post("/subscricoes/user/{user_id}/desconto")
async def aplicar_desconto_especial(
    user_id: str,
    desconto_percentagem: float = Query(..., description="Percentagem de desconto (0-100)"),
    motivo: Optional[str] = Query(None, description="Motivo do desconto"),
    data_inicio: Optional[str] = Query(None, description="Data de início do desconto (YYYY-MM-DD)"),
    data_fim: Optional[str] = Query(None, description="Data de fim do desconto (YYYY-MM-DD)"),
    current_user: Dict = Depends(get_current_user)
):
    """Aplicar desconto especial à subscrição de um parceiro/gestor (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    if desconto_percentagem < 0 or desconto_percentagem > 100:
        raise HTTPException(status_code=400, detail="Desconto deve estar entre 0 e 100")
    
    now = datetime.now(timezone.utc)
    
    # Buscar subscrição ativa
    subscricao = await db.subscricoes.find_one(
        {"user_id": user_id, "status": {"$in": ["ativo", "trial", "oferta"]}},
        {"_id": 0}
    )
    
    if not subscricao:
        raise HTTPException(status_code=404, detail="Subscrição ativa não encontrada")
    
    # Calcular novo preço com desconto
    preco_base = subscricao.get("preco_base", 0)
    preco_veiculos = subscricao.get("preco_veiculos", 0)
    preco_motoristas = subscricao.get("preco_motoristas", 0)
    preco_modulos = subscricao.get("preco_modulos", 0)
    preco_total = preco_base + preco_veiculos + preco_motoristas + preco_modulos
    
    preco_com_desconto = preco_total * (1 - desconto_percentagem / 100)
    
    # Atualizar subscrição
    desconto_especial = {
        "ativo": desconto_percentagem > 0,
        "percentagem": desconto_percentagem,
        "motivo": motivo,
        "data_inicio": data_inicio or now.isoformat()[:10],
        "data_fim": data_fim,
        "aplicado_por": current_user["id"],
        "aplicado_em": now.isoformat()
    }
    
    await db.subscricoes.update_one(
        {"id": subscricao["id"]},
        {
            "$set": {
                "desconto_especial": desconto_especial,
                "preco_final": round(preco_com_desconto, 2),
                "updated_at": now.isoformat()
            },
            "$push": {
                "historico_ajustes": {
                    "data": now.isoformat(),
                    "tipo": "desconto_especial",
                    "descricao": f"Desconto de {desconto_percentagem}% aplicado" + (f" - {motivo}" if motivo else ""),
                    "preco_anterior": subscricao.get("preco_final", 0),
                    "preco_novo": round(preco_com_desconto, 2),
                    "aplicado_por": current_user["id"]
                }
            }
        }
    )
    
    # Buscar nome do parceiro
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1})
    if not user:
        user = await db.parceiros.find_one({"id": user_id}, {"_id": 0, "nome": 1, "nome_empresa": 1})
    user_nome = user.get("name") or user.get("nome") or user.get("nome_empresa") if user else user_id
    
    logger.info(f"Desconto de {desconto_percentagem}% aplicado à subscrição de {user_nome} por {current_user['id']}")
    
    return {
        "sucesso": True,
        "user_id": user_id,
        "user_nome": user_nome,
        "desconto_percentagem": desconto_percentagem,
        "preco_anterior": subscricao.get("preco_final", 0),
        "preco_novo": round(preco_com_desconto, 2),
        "motivo": motivo,
        "mensagem": f"Desconto de {desconto_percentagem}% aplicado com sucesso. Novo preço: €{preco_com_desconto:.2f}"
    }


@router.delete("/subscricoes/user/{user_id}/desconto")
async def remover_desconto_especial(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remover desconto especial da subscrição de um parceiro (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    now = datetime.now(timezone.utc)
    
    # Buscar subscrição ativa
    subscricao = await db.subscricoes.find_one(
        {"user_id": user_id, "status": {"$in": ["ativo", "trial"]}},
        {"_id": 0}
    )
    
    if not subscricao:
        raise HTTPException(status_code=404, detail="Subscrição ativa não encontrada")
    
    # Recalcular preço sem desconto
    preco_base = subscricao.get("preco_base", 0)
    preco_veiculos = subscricao.get("preco_veiculos", 0)
    preco_motoristas = subscricao.get("preco_motoristas", 0)
    preco_modulos = subscricao.get("preco_modulos", 0)
    preco_total = preco_base + preco_veiculos + preco_motoristas + preco_modulos
    
    await db.subscricoes.update_one(
        {"id": subscricao["id"]},
        {
            "$set": {
                "desconto_especial": {"ativo": False},
                "preco_final": round(preco_total, 2),
                "updated_at": now.isoformat()
            },
            "$push": {
                "historico_ajustes": {
                    "data": now.isoformat(),
                    "tipo": "remocao_desconto",
                    "descricao": "Desconto especial removido",
                    "preco_anterior": subscricao.get("preco_final", 0),
                    "preco_novo": round(preco_total, 2),
                    "aplicado_por": current_user["id"]
                }
            }
        }
    )
    
    return {
        "sucesso": True,
        "user_id": user_id,
        "preco_anterior": subscricao.get("preco_final", 0),
        "preco_novo": round(preco_total, 2),
        "mensagem": f"Desconto removido. Preço atualizado para €{preco_total:.2f}"
    }


@router.get("/subscricoes/com-desconto")
async def listar_subscricoes_com_desconto(
    current_user: Dict = Depends(get_current_user)
):
    """Listar todas as subscrições com desconto especial ativo (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    subscricoes = await db.subscricoes.find(
        {
            "status": {"$in": ["ativo", "trial"]},
            "desconto_especial.ativo": True
        },
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    return {"subscricoes": subscricoes, "total": len(subscricoes)}


# ==================== PREÇO FIXO POR UTILIZADOR ====================

class PrecoFixoRequest(BaseModel):
    user_id: str
    preco_fixo: float
    motivo: Optional[str] = None


@router.post("/subscricoes/preco-fixo")
async def definir_preco_fixo(
    data: PrecoFixoRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Definir preço fixo para um utilizador específico (Admin only)
    
    O preço fixo sobrepõe-se a qualquer cálculo de preço baseado em plano, 
    veículos, motoristas ou descontos.
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    if data.preco_fixo < 0:
        raise HTTPException(status_code=400, detail="O preço não pode ser negativo")
    
    now = datetime.now(timezone.utc)
    
    # Buscar subscrição ativa
    subscricao = await db.subscricoes.find_one(
        {"user_id": data.user_id, "status": {"$in": ["ativo", "trial"]}},
        {"_id": 0}
    )
    
    if not subscricao:
        raise HTTPException(status_code=404, detail="Subscrição ativa não encontrada")
    
    # Buscar informações do utilizador
    user = await db.users.find_one({"id": data.user_id}, {"_id": 0, "name": 1, "nome": 1, "nome_empresa": 1})
    user_nome = user.get("name") or user.get("nome") or user.get("nome_empresa") if user else data.user_id
    
    preco_anterior = subscricao.get("preco_final", 0)
    
    await db.subscricoes.update_one(
        {"id": subscricao["id"]},
        {
            "$set": {
                "preco_fixo": {
                    "ativo": True,
                    "valor": round(data.preco_fixo, 2),
                    "motivo": data.motivo,
                    "aplicado_em": now.isoformat(),
                    "aplicado_por": current_user["id"]
                },
                "preco_final": round(data.preco_fixo, 2),
                "updated_at": now.isoformat()
            },
            "$push": {
                "historico_ajustes": {
                    "data": now.isoformat(),
                    "tipo": "preco_fixo",
                    "descricao": f"Preço fixo de €{data.preco_fixo:.2f} definido",
                    "preco_anterior": preco_anterior,
                    "preco_novo": round(data.preco_fixo, 2),
                    "motivo": data.motivo,
                    "aplicado_por": current_user["id"]
                }
            }
        }
    )
    
    logger.info(f"Preço fixo de €{data.preco_fixo:.2f} definido para {user_nome} por {current_user['id']}")
    
    return {
        "sucesso": True,
        "user_id": data.user_id,
        "user_nome": user_nome,
        "preco_anterior": preco_anterior,
        "preco_fixo": round(data.preco_fixo, 2),
        "motivo": data.motivo,
        "mensagem": f"Preço fixo de €{data.preco_fixo:.2f} definido com sucesso"
    }


@router.delete("/subscricoes/user/{user_id}/preco-fixo")
async def remover_preco_fixo(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remover preço fixo e restaurar cálculo normal (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    now = datetime.now(timezone.utc)
    
    # Buscar subscrição ativa
    subscricao = await db.subscricoes.find_one(
        {"user_id": user_id, "status": {"$in": ["ativo", "trial"]}},
        {"_id": 0}
    )
    
    if not subscricao:
        raise HTTPException(status_code=404, detail="Subscrição ativa não encontrada")
    
    # Recalcular preço normal
    preco_base = subscricao.get("preco_base", 0)
    preco_veiculos = subscricao.get("preco_veiculos", 0)
    preco_motoristas = subscricao.get("preco_motoristas", 0)
    preco_modulos = subscricao.get("preco_modulos", 0)
    preco_total = preco_base + preco_veiculos + preco_motoristas + preco_modulos
    
    # Verificar se há desconto especial ativo
    desconto_especial = subscricao.get("desconto_especial", {})
    if desconto_especial.get("ativo"):
        percentagem = desconto_especial.get("percentagem", 0)
        preco_total = preco_total * (1 - percentagem / 100)
    
    preco_anterior = subscricao.get("preco_final", 0)
    
    await db.subscricoes.update_one(
        {"id": subscricao["id"]},
        {
            "$set": {
                "preco_fixo": {"ativo": False},
                "preco_final": round(preco_total, 2),
                "updated_at": now.isoformat()
            },
            "$push": {
                "historico_ajustes": {
                    "data": now.isoformat(),
                    "tipo": "remocao_preco_fixo",
                    "descricao": "Preço fixo removido, cálculo normal restaurado",
                    "preco_anterior": preco_anterior,
                    "preco_novo": round(preco_total, 2),
                    "aplicado_por": current_user["id"]
                }
            }
        }
    )
    
    return {
        "sucesso": True,
        "user_id": user_id,
        "preco_anterior": preco_anterior,
        "preco_novo": round(preco_total, 2),
        "mensagem": f"Preço fixo removido. Preço calculado: €{preco_total:.2f}"
    }


@router.get("/subscricoes/com-preco-fixo")
async def listar_subscricoes_com_preco_fixo(
    current_user: Dict = Depends(get_current_user)
):
    """Listar todas as subscrições com preço fixo definido (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    subscricoes = await db.subscricoes.find(
        {
            "status": {"$in": ["ativo", "trial"]},
            "preco_fixo.ativo": True
        },
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Buscar nomes dos utilizadores
    for sub in subscricoes:
        user = await db.users.find_one({"id": sub.get("user_id")}, {"_id": 0, "name": 1, "nome": 1, "nome_empresa": 1, "email": 1})
        if user:
            sub["user_nome"] = user.get("name") or user.get("nome") or user.get("nome_empresa")
            sub["user_email"] = user.get("email")
    
    return {"subscricoes": subscricoes, "total": len(subscricoes)}


# ==================== OFERTAS DE PLANO GRATUITO ====================

class OfertaPlanoRequest(BaseModel):
    user_id: str
    plano_id: str
    dias_gratis: int = 30
    motivo: Optional[str] = None


@router.post("/ofertas/plano-gratuito")
async def oferecer_plano_gratuito(
    oferta: OfertaPlanoRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Oferecer plano gratuito a um parceiro/gestor por período de tempo (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    if oferta.dias_gratis < 1 or oferta.dias_gratis > 365:
        raise HTTPException(status_code=400, detail="Dias grátis deve estar entre 1 e 365")
    
    now = datetime.now(timezone.utc)
    data_fim = now + timedelta(days=oferta.dias_gratis)
    
    # Buscar o plano
    plano = await db.planos.find_one({"id": oferta.plano_id}, {"_id": 0})
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    # Buscar o utilizador
    user = await db.users.find_one({"id": oferta.user_id}, {"_id": 0, "name": 1, "email": 1})
    if not user:
        user = await db.parceiros.find_one({"id": oferta.user_id}, {"_id": 0, "nome": 1, "nome_empresa": 1})
    
    user_nome = user.get("name") or user.get("nome") or user.get("nome_empresa") if user else oferta.user_id
    
    # Verificar se já tem subscrição ativa
    subscricao_atual = await db.subscricoes.find_one(
        {"user_id": oferta.user_id, "status": {"$in": ["ativo", "trial", "oferta"]}},
        {"_id": 0}
    )
    
    import uuid
    subscricao_id = str(uuid.uuid4())
    
    if subscricao_atual:
        # Suspender subscrição atual
        await db.subscricoes.update_one(
            {"id": subscricao_atual["id"]},
            {
                "$set": {
                    "status": "suspenso_oferta",
                    "updated_at": now.isoformat()
                },
                "$push": {
                    "historico_ajustes": {
                        "data": now.isoformat(),
                        "tipo": "suspenso_oferta",
                        "descricao": f"Plano suspenso devido a oferta gratuita de {plano['nome']}",
                        "aplicado_por": current_user["id"]
                    }
                }
            }
        )
    
    # Criar nova subscrição de oferta
    nova_subscricao = {
        "id": subscricao_id,
        "user_id": oferta.user_id,
        "user_nome": user_nome,
        "user_tipo": plano.get("tipo_usuario", "parceiro"),
        "plano_id": oferta.plano_id,
        "plano_nome": plano.get("nome"),
        "tipo": "oferta",
        "status": "oferta",
        "periodicidade": "oferta",
        "preco_base": 0,
        "preco_veiculos": 0,
        "preco_motoristas": 0,
        "preco_modulos": 0,
        "preco_final": 0,
        "oferta_gratuita": {
            "ativo": True,
            "dias_gratis": oferta.dias_gratis,
            "data_inicio": now.isoformat(),
            "data_fim": data_fim.isoformat(),
            "motivo": oferta.motivo,
            "oferecido_por": current_user["id"],
            "subscricao_anterior_id": subscricao_atual.get("id") if subscricao_atual else None
        },
        "data_inicio": now.isoformat(),
        "data_fim_oferta": data_fim.isoformat(),
        "proxima_cobranca": data_fim.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "historico_ajustes": [{
            "data": now.isoformat(),
            "tipo": "oferta_plano",
            "descricao": f"Plano {plano['nome']} oferecido por {oferta.dias_gratis} dias - {oferta.motivo or 'Sem motivo'}",
            "aplicado_por": current_user["id"]
        }]
    }
    
    await db.subscricoes.insert_one(nova_subscricao)
    
    logger.info(f"Plano {plano['nome']} oferecido a {user_nome} por {oferta.dias_gratis} dias por {current_user['id']}")
    
    return {
        "sucesso": True,
        "subscricao_id": subscricao_id,
        "user_id": oferta.user_id,
        "user_nome": user_nome,
        "plano_nome": plano.get("nome"),
        "dias_gratis": oferta.dias_gratis,
        "data_inicio": now.isoformat()[:10],
        "data_fim": data_fim.isoformat()[:10],
        "mensagem": f"Plano {plano['nome']} oferecido gratuitamente por {oferta.dias_gratis} dias até {data_fim.strftime('%d/%m/%Y')}"
    }


@router.get("/ofertas/ativas")
async def listar_ofertas_ativas(
    current_user: Dict = Depends(get_current_user)
):
    """Listar todas as ofertas de plano gratuito ativas (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    ofertas = await db.subscricoes.find(
        {
            "status": "oferta",
            "oferta_gratuita.ativo": True
        },
        {"_id": 0}
    ).sort("data_fim_oferta", 1).to_list(100)
    
    return {"ofertas": ofertas, "total": len(ofertas)}




# ==================== VERIFICAÇÕES ====================

@router.get("/limites/user/{user_id}")
async def verificar_limites(
    user_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Verificar limites do plano de um utilizador"""
    if current_user["role"] != UserRole.ADMIN and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    service = get_service()
    resultado = await service.verificar_limites_user(user_id)
    return resultado


# ==================== SEED ====================

@router.post("/seed")
async def seed_dados(
    current_user: Dict = Depends(get_current_user)
):
    """Criar planos e módulos predefinidos (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    modulos_criados = await service.seed_modulos_predefinidos()
    planos_criados = await service.seed_planos_predefinidos()
    
    return {
        "message": "Seed executado com sucesso",
        "modulos_criados": modulos_criados,
        "planos_criados": planos_criados
    }


# ==================== CATEGORIAS DE PLANO ====================

class CategoriaPlanoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    icone: str = "📁"
    cor: str = "#3B82F6"
    ordem: int = 0


class CategoriaPlanoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    icone: Optional[str] = None
    cor: Optional[str] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None


@router.get("/categorias/public")
async def listar_categorias_public():
    """Listar categorias públicas (sem autenticação)"""
    categorias = await db.categorias_plano.find({"ativo": True}, {"_id": 0}).sort("ordem", 1).to_list(100)
    return categorias


@router.get("/categorias")
async def listar_categorias(
    apenas_ativas: bool = Query(True),
    current_user: Dict = Depends(get_current_user)
):
    """Listar todas as categorias de plano"""
    filtro = {}
    if apenas_ativas:
        filtro["ativo"] = True
    
    categorias = await db.categorias_plano.find(filtro, {"_id": 0}).sort("ordem", 1).to_list(100)
    return categorias


@router.post("/categorias")
async def criar_categoria(
    data: CategoriaPlanoCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Criar nova categoria de plano (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    # Verificar se já existe com o mesmo nome
    existing = await db.categorias_plano.find_one({"nome": data.nome, "ativo": True})
    if existing:
        raise HTTPException(status_code=400, detail="Já existe uma categoria com esse nome")
    
    now = datetime.now(timezone.utc).isoformat()
    categoria = {
        "id": str(uuid.uuid4()),
        "nome": data.nome,
        "descricao": data.descricao,
        "icone": data.icone,
        "cor": data.cor,
        "ordem": data.ordem,
        "ativo": True,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"]
    }
    
    await db.categorias_plano.insert_one(categoria)
    categoria.pop("_id", None)
    
    logger.info(f"Categoria criada: {categoria['nome']} por {current_user['id']}")
    return categoria


@router.put("/categorias/{categoria_id}")
async def atualizar_categoria(
    categoria_id: str,
    data: CategoriaPlanoUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar categoria de plano (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.categorias_plano.find_one_and_update(
        {"id": categoria_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    result.pop("_id", None)
    return result


@router.delete("/categorias/{categoria_id}")
async def eliminar_categoria(
    categoria_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Desativar categoria de plano (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    # Verificar se há planos usando esta categoria
    planos_com_categoria = await db.planos_sistema.count_documents({
        "categoria_id": categoria_id,
        "ativo": True
    })
    
    if planos_com_categoria > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Não é possível eliminar: {planos_com_categoria} plano(s) usam esta categoria"
        )
    
    result = await db.categorias_plano.update_one(
        {"id": categoria_id},
        {
            "$set": {
                "ativo": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    return {"message": "Categoria desativada com sucesso"}


# ==================== ESTATÍSTICAS ====================

@router.get("/estatisticas")
async def obter_estatisticas(
    current_user: Dict = Depends(get_current_user)
):
    """Obter estatísticas de planos e subscrições (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    # Contar planos
    total_planos = await db.planos_sistema.count_documents({"ativo": True})
    planos_parceiro = await db.planos_sistema.count_documents({"ativo": True, "tipo_usuario": "parceiro"})
    planos_motorista = await db.planos_sistema.count_documents({"ativo": True, "tipo_usuario": "motorista"})
    
    # Contar módulos
    total_modulos = await db.modulos_sistema.count_documents({"ativo": True})
    
    # Contar subscrições
    subscricoes_ativas = await db.subscricoes.count_documents({"status": {"$in": ["ativo", "trial"]}})
    subscricoes_trial = await db.subscricoes.count_documents({"status": "trial"})
    
    # Receita mensal estimada
    pipeline = [
        {"$match": {"status": "ativo"}},
        {"$group": {"_id": None, "total": {"$sum": "$preco_final"}}}
    ]
    receita = await db.subscricoes.aggregate(pipeline).to_list(1)
    receita_mensal = receita[0]["total"] if receita else 0
    
    return {
        "planos": {
            "total": total_planos,
            "parceiros": planos_parceiro,
            "motoristas": planos_motorista
        },
        "modulos": {
            "total": total_modulos
        },
        "subscricoes": {
            "ativas": subscricoes_ativas,
            "trial": subscricoes_trial
        },
        "receita_mensal_estimada": round(receita_mensal, 2)
    }


# ==================== CALCULADORA DE PREÇOS ====================

@router.get("/calcular-preco")
async def calcular_preco_plano(
    plano_id: str = Query(..., description="ID do plano"),
    num_veiculos: int = Query(0, description="Número de veículos"),
    num_motoristas: int = Query(0, description="Número de motoristas"),
    periodicidade: str = Query("mensal", description="mensal, semanal, anual"),
    current_user: Dict = Depends(get_current_user)
):
    """
    Calcular preço estimado de um plano com determinado número de veículos e motoristas.
    Útil para mostrar ao utilizador antes de confirmar assinatura.
    """
    plano = await db.planos_sistema.find_one({"id": plano_id}, {"_id": 0})
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    precos_plano = plano.get("precos_plano", {})
    setup = precos_plano.get("setup", 0)
    
    # Obter preços baseados na periodicidade
    if periodicidade == "anual":
        preco_base = precos_plano.get("base_anual", 0)
        preco_por_veiculo = precos_plano.get("por_veiculo_anual", 0)
        preco_por_motorista = precos_plano.get("por_motorista_anual", 0)
        label_periodo = "ano"
    elif periodicidade == "semanal":
        preco_base = precos_plano.get("base_semanal", 0)
        preco_por_veiculo = precos_plano.get("por_veiculo_semanal", 0)
        preco_por_motorista = precos_plano.get("por_motorista_semanal", 0)
        label_periodo = "semana"
    else:  # mensal
        preco_base = precos_plano.get("base_mensal", 0)
        preco_por_veiculo = precos_plano.get("por_veiculo_mensal", 0)
        preco_por_motorista = precos_plano.get("por_motorista_mensal", 0)
        label_periodo = "mês"
    
    preco_veiculos = num_veiculos * preco_por_veiculo
    preco_motoristas = num_motoristas * preco_por_motorista
    preco_recorrente = preco_base + preco_veiculos + preco_motoristas
    
    return {
        "plano_id": plano_id,
        "plano_nome": plano.get("nome"),
        "periodicidade": periodicidade,
        "setup": {
            "valor": round(setup, 2),
            "descricao": "Taxa única de ativação"
        },
        "preco_base": {
            "valor": round(preco_base, 2),
            "descricao": f"Preço base/{label_periodo}"
        },
        "veiculos": {
            "quantidade": num_veiculos,
            "preco_unitario": round(preco_por_veiculo, 2),
            "subtotal": round(preco_veiculos, 2),
            "descricao": f"{num_veiculos} × €{preco_por_veiculo:.2f}"
        },
        "motoristas": {
            "quantidade": num_motoristas,
            "preco_unitario": round(preco_por_motorista, 2),
            "subtotal": round(preco_motoristas, 2),
            "descricao": f"{num_motoristas} × €{preco_por_motorista:.2f}"
        },
        "preco_recorrente": {
            "valor": round(preco_recorrente, 2),
            "descricao": f"Total/{label_periodo}"
        },
        "primeira_cobranca": {
            "valor": round(setup + preco_recorrente, 2),
            "descricao": "Setup + primeira mensalidade"
        },
        "resumo": f"€{setup:.2f} (setup) + €{preco_recorrente:.2f}/{label_periodo}"
    }


# ==================== SISTEMA DE DOWNGRADE ====================

class DowngradeRequest(BaseModel):
    plano_novo_id: str
    motivo: Optional[str] = None


@router.post("/subscricoes/solicitar-downgrade")
async def solicitar_downgrade(
    request: DowngradeRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Solicitar downgrade de plano. O downgrade só será aplicado quando o ciclo atual terminar.
    """
    user_id = current_user["id"]
    
    # Obter subscrição atual
    subscricao = await db.subscricoes.find_one({"user_id": user_id, "status": {"$in": ["ativo", "trial"]}})
    if not subscricao:
        raise HTTPException(status_code=404, detail="Subscrição ativa não encontrada")
    
    # Verificar se já tem downgrade agendado
    downgrade_existente = await db.pedidos_downgrade.find_one({
        "user_id": user_id,
        "status": "agendado"
    })
    if downgrade_existente:
        raise HTTPException(status_code=400, detail="Já existe um downgrade agendado. Cancele o anterior primeiro.")
    
    # Obter plano atual
    plano_atual = await db.planos_sistema.find_one({"id": subscricao.get("plano_id")}, {"_id": 0})
    if not plano_atual:
        raise HTTPException(status_code=404, detail="Plano atual não encontrado")
    
    # Obter plano novo
    plano_novo = await db.planos_sistema.find_one({"id": request.plano_novo_id}, {"_id": 0})
    if not plano_novo:
        raise HTTPException(status_code=404, detail="Plano de destino não encontrado")
    
    # Verificar se é realmente um downgrade (plano novo tem ordem menor)
    if plano_novo.get("ordem", 0) >= plano_atual.get("ordem", 0):
        raise HTTPException(status_code=400, detail="O plano selecionado não é um downgrade. Use upgrade para planos superiores.")
    
    now = datetime.now(timezone.utc)
    
    # Data de aplicação = fim do ciclo atual
    data_fim = subscricao.get("proxima_cobranca") or subscricao.get("data_fim")
    if not data_fim:
        data_fim = now + timedelta(days=30)  # Fallback
    
    # Criar pedido de downgrade
    pedido = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_nome": current_user.get("name"),
        "subscricao_id": subscricao.get("id"),
        "plano_atual_id": plano_atual.get("id"),
        "plano_atual_nome": plano_atual.get("nome"),
        "preco_atual": subscricao.get("preco_final", 0),
        "plano_novo_id": plano_novo.get("id"),
        "plano_novo_nome": plano_novo.get("nome"),
        "preco_novo": plano_novo.get("precos_plano", {}).get("base_mensal", 0),
        "data_solicitacao": now.isoformat(),
        "data_aplicacao": data_fim if isinstance(data_fim, str) else data_fim.isoformat(),
        "status": "agendado",
        "motivo": request.motivo,
        "created_at": now.isoformat()
    }
    
    await db.pedidos_downgrade.insert_one(pedido)
    pedido.pop("_id", None)
    
    logger.info(f"Downgrade agendado: {user_id} de {plano_atual.get('nome')} para {plano_novo.get('nome')}")
    
    return {
        "message": "Downgrade agendado com sucesso",
        "downgrade": pedido,
        "info": f"O seu plano será alterado para {plano_novo.get('nome')} a partir de {pedido['data_aplicacao'][:10]}"
    }


@router.get("/subscricoes/downgrade-agendado")
async def obter_downgrade_agendado(
    current_user: Dict = Depends(get_current_user)
):
    """Obter downgrade agendado do utilizador atual"""
    downgrade = await db.pedidos_downgrade.find_one(
        {"user_id": current_user["id"], "status": "agendado"},
        {"_id": 0}
    )
    return downgrade


@router.delete("/subscricoes/cancelar-downgrade")
async def cancelar_downgrade(
    current_user: Dict = Depends(get_current_user)
):
    """Cancelar downgrade agendado"""
    result = await db.pedidos_downgrade.update_one(
        {"user_id": current_user["id"], "status": "agendado"},
        {
            "$set": {
                "status": "cancelado",
                "cancelado_por": current_user["id"],
                "cancelado_em": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Nenhum downgrade agendado encontrado")
    
    return {"message": "Downgrade cancelado com sucesso"}


# ==================== MÓDULOS ADICIONAIS ====================

class AdicionarModuloExtraRequest(BaseModel):
    modulo_id: str
    tipo_cobranca: str  # "preco_unico", "por_veiculo", "por_motorista", "por_veiculo_motorista"
    num_veiculos: Optional[int] = None
    num_motoristas: Optional[int] = None
    periodicidade: str = "mensal"


@router.post("/subscricoes/adicionar-modulo")
async def adicionar_modulo_extra(
    request: AdicionarModuloExtraRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Adicionar módulo extra à subscrição com tipo de cobrança escolhido pelo utilizador.
    """
    user_id = current_user["id"]
    
    # Obter subscrição atual
    subscricao = await db.subscricoes.find_one({"user_id": user_id, "status": {"$in": ["ativo", "trial"]}})
    if not subscricao:
        raise HTTPException(status_code=404, detail="Subscrição ativa não encontrada")
    
    # Obter módulo
    modulo = await db.modulos_sistema.find_one({"id": request.modulo_id}, {"_id": 0})
    if not modulo:
        modulo = await db.modulos_sistema.find_one({"codigo": request.modulo_id}, {"_id": 0})
    if not modulo:
        raise HTTPException(status_code=404, detail="Módulo não encontrado")
    
    # Verificar se já tem este módulo
    modulos_existentes = await db.modulos_adicionais.find_one({
        "user_id": user_id,
        "modulo_id": modulo.get("id"),
        "ativo": True
    })
    if modulos_existentes:
        raise HTTPException(status_code=400, detail="Este módulo já está ativo na sua subscrição")
    
    # Calcular preço baseado no tipo de cobrança
    precos = modulo.get("precos", {})
    sufixo = request.periodicidade
    
    # Obter preços específicos do módulo
    preco_base_modulo = precos.get(sufixo, precos.get("mensal", 0)) or 0
    preco_por_veiculo = precos.get(f"por_veiculo_{sufixo}", precos.get("por_veiculo_mensal", preco_base_modulo)) or 0
    preco_por_motorista = precos.get(f"por_motorista_{sufixo}", precos.get("por_motorista_mensal", preco_base_modulo)) or 0
    
    preco_base = 0
    custo_veiculos = 0
    custo_motoristas = 0
    
    if request.tipo_cobranca == "preco_unico":
        preco_base = preco_base_modulo
        custo_mensal = preco_base
    elif request.tipo_cobranca == "por_veiculo":
        if request.num_veiculos is None or request.num_veiculos < 1:
            raise HTTPException(status_code=400, detail="Número de veículos é obrigatório para cobrança por veículo")
        custo_veiculos = preco_por_veiculo * request.num_veiculos
        custo_mensal = custo_veiculos
    elif request.tipo_cobranca == "por_motorista":
        if request.num_motoristas is None or request.num_motoristas < 1:
            raise HTTPException(status_code=400, detail="Número de motoristas é obrigatório para cobrança por motorista")
        custo_motoristas = preco_por_motorista * request.num_motoristas
        custo_mensal = custo_motoristas
    elif request.tipo_cobranca == "por_veiculo_motorista":
        # Cobrança combinada: por veículo + por motorista
        if request.num_veiculos is None or request.num_veiculos < 1:
            raise HTTPException(status_code=400, detail="Número de veículos é obrigatório para cobrança combinada")
        if request.num_motoristas is None or request.num_motoristas < 1:
            raise HTTPException(status_code=400, detail="Número de motoristas é obrigatório para cobrança combinada")
        custo_veiculos = preco_por_veiculo * request.num_veiculos
        custo_motoristas = preco_por_motorista * request.num_motoristas
        custo_mensal = custo_veiculos + custo_motoristas
    else:
        raise HTTPException(status_code=400, detail="Tipo de cobrança inválido")
    
    now = datetime.now(timezone.utc)
    
    # Criar registo do módulo adicional
    modulo_adicional = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "subscricao_id": subscricao.get("id"),
        "modulo_id": modulo.get("id"),
        "modulo_codigo": modulo.get("codigo"),
        "modulo_nome": modulo.get("nome"),
        "tipo_cobranca": request.tipo_cobranca,
        "preco_base": preco_base,
        "preco_por_veiculo": preco_por_veiculo if request.tipo_cobranca in ["por_veiculo", "por_veiculo_motorista"] else 0,
        "preco_por_motorista": preco_por_motorista if request.tipo_cobranca in ["por_motorista", "por_veiculo_motorista"] else 0,
        "custo_veiculos": round(custo_veiculos, 2),
        "custo_motoristas": round(custo_motoristas, 2),
        "num_veiculos": request.num_veiculos or 0,
        "num_motoristas": request.num_motoristas or 0,
        "custo_mensal": round(custo_mensal, 2),
        "periodicidade": request.periodicidade,
        "ativo": True,
        "data_inicio": now.isoformat(),
        "proxima_cobranca": (now + timedelta(days=30)).isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.modulos_adicionais.insert_one(modulo_adicional)
    modulo_adicional.pop("_id", None)
    
    # Atualizar preco_modulos na subscrição
    modulos_ativos = await db.modulos_adicionais.find({"user_id": user_id, "ativo": True}).to_list(100)
    total_modulos = sum(m.get("custo_mensal", 0) for m in modulos_ativos)
    
    await db.subscricoes.update_one(
        {"id": subscricao.get("id")},
        {"$set": {"preco_modulos": round(total_modulos, 2), "updated_at": now.isoformat()}}
    )
    
    logger.info(f"Módulo adicional adicionado: {modulo.get('nome')} para {user_id}")
    
    return {
        "message": f"Módulo {modulo.get('nome')} adicionado com sucesso",
        "modulo": modulo_adicional,
        "custo_adicional": round(custo_mensal, 2)
    }


@router.get("/subscricoes/modulos-adicionais")
async def listar_modulos_adicionais(
    current_user: Dict = Depends(get_current_user)
):
    """Listar módulos adicionais do utilizador"""
    modulos = await db.modulos_adicionais.find(
        {"user_id": current_user["id"], "ativo": True},
        {"_id": 0}
    ).to_list(100)
    return modulos


@router.delete("/subscricoes/modulos-adicionais/{modulo_id}")
async def remover_modulo_adicional(
    modulo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remover módulo adicional da subscrição"""
    result = await db.modulos_adicionais.update_one(
        {"id": modulo_id, "user_id": current_user["id"], "ativo": True},
        {
            "$set": {
                "ativo": False,
                "data_fim": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Módulo não encontrado ou já removido")
    
    return {"message": "Módulo removido com sucesso"}


# ==================== CÁLCULO AVANÇADO DE PREÇOS ====================

class CalculoAvancadoRequest(BaseModel):
    plano_id: str
    num_veiculos: int
    num_motoristas: int
    periodicidade: str = "mensal"
    modulos_adicionais: List[AdicionarModuloExtraRequest] = []


@router.post("/calcular-preco-avancado")
async def calcular_preco_avancado(
    request: CalculoAvancadoRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Calcular preço completo incluindo plano + recursos + módulos adicionais.
    Ideal para checkout/preview antes de confirmar subscrição.
    """
    # Obter plano
    plano = await db.planos_sistema.find_one({"id": request.plano_id}, {"_id": 0})
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    precos_plano = plano.get("precos_plano", {})
    
    # Calcular preços do plano baseado na periodicidade
    if request.periodicidade == "anual":
        preco_base = precos_plano.get("base_anual", 0) or 0
        preco_por_veiculo = precos_plano.get("por_veiculo_anual", 0) or 0
        preco_por_motorista = precos_plano.get("por_motorista_anual", 0) or 0
    elif request.periodicidade == "semanal":
        preco_base = precos_plano.get("base_semanal", 0) or 0
        preco_por_veiculo = precos_plano.get("por_veiculo_semanal", 0) or 0
        preco_por_motorista = precos_plano.get("por_motorista_semanal", 0) or 0
    else:
        preco_base = precos_plano.get("base_mensal", 0) or 0
        preco_por_veiculo = precos_plano.get("por_veiculo_mensal", 0) or 0
        preco_por_motorista = precos_plano.get("por_motorista_mensal", 0) or 0
    
    setup = precos_plano.get("setup", 0) or 0
    
    # Calcular custos de recursos
    custo_veiculos = request.num_veiculos * preco_por_veiculo
    custo_motoristas = request.num_motoristas * preco_por_motorista
    subtotal_plano = preco_base + custo_veiculos + custo_motoristas
    
    # Calcular módulos adicionais
    modulos_detalhes = []
    total_modulos = 0
    
    for mod_req in request.modulos_adicionais:
        modulo = await db.modulos_sistema.find_one(
            {"$or": [{"id": mod_req.modulo_id}, {"codigo": mod_req.modulo_id}]},
            {"_id": 0}
        )
        if modulo:
            precos_mod = modulo.get("precos", {})
            # Obter preços específicos para veículo e motorista
            preco_mod_base = precos_mod.get(request.periodicidade, precos_mod.get("mensal", 0)) or 0
            preco_mod_veiculo = precos_mod.get(f"por_veiculo_{request.periodicidade}", precos_mod.get("por_veiculo_mensal", preco_mod_base)) or 0
            preco_mod_motorista = precos_mod.get(f"por_motorista_{request.periodicidade}", precos_mod.get("por_motorista_mensal", preco_mod_base)) or 0
            
            if mod_req.tipo_cobranca == "preco_unico":
                custo = preco_mod_base
            elif mod_req.tipo_cobranca == "por_veiculo":
                custo = preco_mod_veiculo * (mod_req.num_veiculos or request.num_veiculos)
            elif mod_req.tipo_cobranca == "por_motorista":
                custo = preco_mod_motorista * (mod_req.num_motoristas or request.num_motoristas)
            elif mod_req.tipo_cobranca == "por_veiculo_motorista":
                # Cobrança combinada
                custo_veic = preco_mod_veiculo * (mod_req.num_veiculos or request.num_veiculos)
                custo_mot = preco_mod_motorista * (mod_req.num_motoristas or request.num_motoristas)
                custo = custo_veic + custo_mot
            else:
                custo = preco_mod_base
            
            modulos_detalhes.append({
                "modulo_id": modulo.get("id"),
                "modulo_nome": modulo.get("nome"),
                "tipo_cobranca": mod_req.tipo_cobranca,
                "preco_por_veiculo": round(preco_mod_veiculo, 2) if mod_req.tipo_cobranca in ["por_veiculo", "por_veiculo_motorista"] else 0,
                "preco_por_motorista": round(preco_mod_motorista, 2) if mod_req.tipo_cobranca in ["por_motorista", "por_veiculo_motorista"] else 0,
                "custo": round(custo, 2)
            })
            total_modulos += custo
    
    preco_total = subtotal_plano + total_modulos
    
    return {
        "plano": {
            "id": plano.get("id"),
            "nome": plano.get("nome"),
            "categoria": plano.get("categoria")
        },
        "periodicidade": request.periodicidade,
        "recursos": {
            "veiculos": request.num_veiculos,
            "motoristas": request.num_motoristas
        },
        "custos": {
            "setup": round(setup, 2),
            "base": round(preco_base, 2),
            "veiculos": {
                "quantidade": request.num_veiculos,
                "preco_unitario": round(preco_por_veiculo, 2),
                "subtotal": round(custo_veiculos, 2)
            },
            "motoristas": {
                "quantidade": request.num_motoristas,
                "preco_unitario": round(preco_por_motorista, 2),
                "subtotal": round(custo_motoristas, 2)
            },
            "subtotal_plano": round(subtotal_plano, 2),
            "modulos_adicionais": modulos_detalhes,
            "total_modulos": round(total_modulos, 2)
        },
        "totais": {
            "primeira_cobranca": round(setup + preco_total, 2),
            "recorrente": round(preco_total, 2)
        }
    }


# ==================== MÓDULO DE HISTÓRICO ====================

@router.get("/modulo-historico/status")
async def obter_status_modulo_historico(
    current_user: Dict = Depends(get_current_user)
):
    """
    Verificar se o utilizador tem o módulo de histórico ativo e obter detalhes.
    """
    user_id = current_user["id"]
    
    # Verificar se tem módulo de histórico ativo
    modulo_historico = await db.modulos_adicionais.find_one({
        "user_id": user_id,
        "modulo_codigo": "historico_recursos",
        "ativo": True
    }, {"_id": 0})
    
    # Contar recursos inativos
    veiculos_inativos = await db.veiculos.count_documents({
        "parceiro_id": user_id,
        "ativo": False
    })
    
    motoristas_inativos = await db.motoristas.count_documents({
        "parceiro_id": user_id,
        "ativo": False
    })
    
    # Obter preços do módulo
    modulo_def = await db.modulos_sistema.find_one({"codigo": "historico_recursos"}, {"_id": 0})
    preco_veiculo = modulo_def.get("preco_por_veiculo_inativo", 0.99) if modulo_def else 0.99
    preco_motorista = modulo_def.get("preco_por_motorista_inativo", 0.49) if modulo_def else 0.49
    
    custo_mensal = (veiculos_inativos * preco_veiculo) + (motoristas_inativos * preco_motorista)
    
    return {
        "modulo_ativo": modulo_historico is not None,
        "veiculos_inativos": veiculos_inativos,
        "motoristas_inativos": motoristas_inativos,
        "precos": {
            "por_veiculo_inativo": preco_veiculo,
            "por_motorista_inativo": preco_motorista
        },
        "custo_mensal_estimado": round(custo_mensal, 2),
        "info": "Com o módulo de histórico, recursos desativados não contam na cobrança do plano principal. Sem o módulo, cada recurso desativado conta como recurso ativo."
    }


@router.post("/modulo-historico/ativar")
async def ativar_modulo_historico(
    current_user: Dict = Depends(get_current_user)
):
    """
    Ativar módulo de histórico para o utilizador.
    """
    user_id = current_user["id"]
    
    # Verificar se já tem ativo
    existente = await db.modulos_adicionais.find_one({
        "user_id": user_id,
        "modulo_codigo": "historico_recursos",
        "ativo": True
    })
    if existente:
        raise HTTPException(status_code=400, detail="Módulo de histórico já está ativo")
    
    # Obter subscrição
    subscricao = await db.subscricoes.find_one({"user_id": user_id, "status": {"$in": ["ativo", "trial"]}})
    if not subscricao:
        raise HTTPException(status_code=404, detail="Subscrição ativa não encontrada")
    
    # Obter módulo
    modulo = await db.modulos_sistema.find_one({"codigo": "historico_recursos"}, {"_id": 0})
    if not modulo:
        raise HTTPException(status_code=404, detail="Módulo de histórico não configurado no sistema")
    
    now = datetime.now(timezone.utc)
    
    # Criar registo
    modulo_adicional = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "subscricao_id": subscricao.get("id"),
        "modulo_id": modulo.get("id"),
        "modulo_codigo": "historico_recursos",
        "modulo_nome": "Histórico de Recursos",
        "tipo_cobranca": "por_recurso_inativo",
        "preco_por_veiculo_inativo": modulo.get("preco_por_veiculo_inativo", 0.99),
        "preco_por_motorista_inativo": modulo.get("preco_por_motorista_inativo", 0.49),
        "ativo": True,
        "data_inicio": now.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.modulos_adicionais.insert_one(modulo_adicional)
    modulo_adicional.pop("_id", None)
    
    return {
        "message": "Módulo de histórico ativado com sucesso",
        "modulo": modulo_adicional
    }


# ==================== ELIMINAÇÃO DE RECURSOS DESATIVADOS ====================

@router.delete("/recursos/veiculos-inativos/{veiculo_id}")
async def eliminar_veiculo_inativo(
    veiculo_id: str,
    confirmar: bool = Query(False, description="Confirmar eliminação permanente"),
    current_user: Dict = Depends(get_current_user)
):
    """
    Eliminar permanentemente um veículo desativado.
    ATENÇÃO: Esta ação é irreversível e elimina todo o histórico do veículo.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Sem permissão para eliminar veículos")
    
    if not confirmar:
        raise HTTPException(
            status_code=400, 
            detail="Confirme a eliminação adicionando ?confirmar=true. Esta ação é IRREVERSÍVEL."
        )
    
    # Verificar se veículo existe e está inativo
    veiculo = await db.veiculos.find_one({
        "id": veiculo_id,
        "parceiro_id": current_user["id"] if current_user["role"] != UserRole.ADMIN else {"$exists": True},
        "ativo": False
    })
    
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo inativo não encontrado ou não tem permissão")
    
    # Eliminar permanentemente
    await db.veiculos.delete_one({"id": veiculo_id})
    
    # Log para auditoria
    await db.audit_log.insert_one({
        "tipo": "ELIMINACAO_VEICULO",
        "user_id": current_user["id"],
        "veiculo_id": veiculo_id,
        "matricula": veiculo.get("matricula"),
        "data": datetime.now(timezone.utc).isoformat()
    })
    
    logger.warning(f"Veículo eliminado permanentemente: {veiculo_id} por {current_user['id']}")
    
    return {
        "message": f"Veículo {veiculo.get('matricula', veiculo_id)} eliminado permanentemente",
        "aviso": "Todo o histórico foi eliminado"
    }


@router.delete("/recursos/motoristas-inativos/{motorista_id}")
async def eliminar_motorista_inativo(
    motorista_id: str,
    confirmar: bool = Query(False, description="Confirmar eliminação permanente"),
    current_user: Dict = Depends(get_current_user)
):
    """
    Eliminar permanentemente um motorista desativado.
    ATENÇÃO: Esta ação é irreversível e elimina todo o histórico do motorista.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Sem permissão para eliminar motoristas")
    
    if not confirmar:
        raise HTTPException(
            status_code=400, 
            detail="Confirme a eliminação adicionando ?confirmar=true. Esta ação é IRREVERSÍVEL."
        )
    
    # Verificar se motorista existe e está inativo
    motorista = await db.motoristas.find_one({
        "id": motorista_id,
        "parceiro_id": current_user["id"] if current_user["role"] != UserRole.ADMIN else {"$exists": True},
        "ativo": False
    })
    
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista inativo não encontrado ou não tem permissão")
    
    # Eliminar permanentemente
    await db.motoristas.delete_one({"id": motorista_id})
    
    # Log para auditoria
    await db.audit_log.insert_one({
        "tipo": "ELIMINACAO_MOTORISTA",
        "user_id": current_user["id"],
        "motorista_id": motorista_id,
        "nome": motorista.get("nome"),
        "data": datetime.now(timezone.utc).isoformat()
    })
    
    logger.warning(f"Motorista eliminado permanentemente: {motorista_id} por {current_user['id']}")
    
    return {
        "message": f"Motorista {motorista.get('nome', motorista_id)} eliminado permanentemente",
        "aviso": "Todo o histórico foi eliminado"
    }


@router.get("/recursos/inativos")
async def listar_recursos_inativos(
    current_user: Dict = Depends(get_current_user)
):
    """Listar todos os veículos e motoristas inativos do utilizador"""
    user_id = current_user["id"]
    
    veiculos = await db.veiculos.find(
        {"parceiro_id": user_id, "ativo": False},
        {"_id": 0, "id": 1, "matricula": 1, "marca": 1, "modelo": 1, "desativado_em": 1}
    ).to_list(100)
    
    motoristas = await db.motoristas.find(
        {"parceiro_id": user_id, "ativo": False},
        {"_id": 0, "id": 1, "nome": 1, "email": 1, "telefone": 1, "desativado_em": 1}
    ).to_list(100)
    
    return {
        "veiculos_inativos": veiculos,
        "motoristas_inativos": motoristas,
        "totais": {
            "veiculos": len(veiculos),
            "motoristas": len(motoristas)
        }
    }
