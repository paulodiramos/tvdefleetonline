"""
Rotas de Gestão de Planos e Módulos
API para administração de planos, módulos, promoções e subscrições
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import logging

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database
from services.planos_modulos_service import PlanosModulosService
from models.planos_modulos import (
    ModuloCreate, ModuloUpdate, PlanoCreate, PlanoUpdate,
    AtribuirPlanoRequest, AtribuirModuloRequest,
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
    current_user: Dict = Depends(get_current_user)
):
    """Desativar plano (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
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
    """Adicionar preço especial para parceiro específico (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    if not preco_data.get("parceiro_id"):
        raise HTTPException(status_code=400, detail="parceiro_id é obrigatório")
    
    service = get_service()
    preco = await service.adicionar_preco_especial_plano(plano_id, preco_data, current_user["id"])
    return preco


# ==================== CÁLCULO DE PREÇOS ====================

@router.get("/planos/{plano_id}/calcular-preco")
async def calcular_preco(
    plano_id: str,
    periodicidade: str = Query("mensal", description="semanal, mensal, anual"),
    num_veiculos: int = Query(1),
    num_motoristas: int = Query(1),
    codigo_promocional: Optional[str] = Query(None),
    current_user: Dict = Depends(get_current_user)
):
    """Calcular preço de um plano para o utilizador atual"""
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
