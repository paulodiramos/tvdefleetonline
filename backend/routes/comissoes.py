"""
Rotas para Gestão de Comissões, Classificações e Turnos
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import logging

from models.user import UserRole
from models.comissoes import (
    CriarEscalaRequest, AtualizarNiveisEscalaRequest,
    CriarNivelClassificacaoRequest, AtualizarClassificacaoRequest,
    AdicionarTurnoRequest, AtualizarTurnoRequest, DefinirMotoristaPrincipalRequest
)
from utils.auth import get_current_user
from utils.database import get_database
from services.comissoes_service import ComissoesService

router = APIRouter(prefix="/comissoes", tags=["comissoes"])
db = get_database()
logger = logging.getLogger(__name__)


def get_service():
    return ComissoesService(db)


# ==================== ESCALAS DE COMISSÃO ====================

@router.get("/escalas")
async def listar_escalas(
    current_user: Dict = Depends(get_current_user)
):
    """Listar todas as escalas de comissão"""
    service = get_service()
    escalas = await service.listar_escalas()
    return {"escalas": escalas}


@router.get("/escalas/ativa")
async def obter_escala_ativa(
    current_user: Dict = Depends(get_current_user)
):
    """Obter a escala de comissão ativa"""
    service = get_service()
    escala = await service.obter_escala_ativa()
    if not escala:
        # Criar escala padrão
        escala = await service.seed_escala_padrao()
        if escala.get("existente"):
            escala = await service.obter_escala_ativa()
    return escala


@router.get("/escalas/{escala_id}")
async def obter_escala(
    escala_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter uma escala por ID"""
    service = get_service()
    escala = await service.obter_escala(escala_id)
    if not escala:
        raise HTTPException(status_code=404, detail="Escala não encontrada")
    return escala


@router.post("/escalas")
async def criar_escala(
    request: CriarEscalaRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Criar nova escala de comissão (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    escala = await service.criar_escala(
        nome=request.nome,
        descricao=request.descricao,
        niveis=request.niveis,
        created_by=current_user["id"]
    )
    return escala


@router.put("/escalas/{escala_id}/niveis")
async def atualizar_niveis_escala(
    escala_id: str,
    request: AtualizarNiveisEscalaRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar níveis de uma escala (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    escala = await service.atualizar_niveis_escala(
        escala_id=escala_id,
        niveis=request.niveis,
        updated_by=current_user["id"]
    )
    return escala


@router.delete("/escalas/{escala_id}")
async def eliminar_escala(
    escala_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar uma escala (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    sucesso = await service.eliminar_escala(escala_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Escala não encontrada")
    return {"sucesso": True}


@router.post("/escalas/seed")
async def seed_escala_padrao(
    current_user: Dict = Depends(get_current_user)
):
    """Criar escala padrão (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    result = await service.seed_escala_padrao()
    return result


# ==================== CLASSIFICAÇÃO DE MOTORISTAS ====================

@router.get("/classificacao/config")
async def obter_config_classificacao(
    current_user: Dict = Depends(get_current_user)
):
    """Obter configuração de classificação de motoristas"""
    service = get_service()
    config = await service.obter_config_classificacao()
    return config


@router.put("/classificacao/config")
async def atualizar_config_classificacao(
    niveis: List[dict],
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar níveis de classificação (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    config = await service.atualizar_niveis_classificacao(
        niveis=niveis,
        updated_by=current_user["id"]
    )
    return config


@router.post("/classificacao/seed")
async def seed_classificacao(
    current_user: Dict = Depends(get_current_user)
):
    """Criar níveis de classificação padrão (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    result = await service.seed_niveis_classificacao()
    return result


@router.get("/classificacao/motorista/{motorista_id}")
async def obter_classificacao_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter classificação de um motorista"""
    service = get_service()
    classificacao = await service.obter_classificacao_motorista(motorista_id)
    if not classificacao:
        # Calcular e atribuir
        classificacao = await service.atribuir_classificacao_motorista(motorista_id)
    return classificacao


@router.put("/classificacao/motorista/{motorista_id}")
async def atualizar_classificacao_motorista(
    motorista_id: str,
    request: AtualizarClassificacaoRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar classificação de um motorista (Admin ou Parceiro)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    service = get_service()
    
    try:
        classificacao = await service.atribuir_classificacao_motorista(
            motorista_id=motorista_id,
            nivel_id=request.nivel_id,
            nivel_manual=request.nivel_manual,
            pontuacao_cuidado_veiculo=request.pontuacao_cuidado_veiculo,
            atribuido_por=current_user["id"],
            motivo=request.motivo
        )
        return classificacao
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/classificacao/motorista/{motorista_id}/recalcular")
async def recalcular_classificacao(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Recalcular classificação automaticamente"""
    service = get_service()
    
    try:
        classificacao = await service.atribuir_classificacao_motorista(
            motorista_id=motorista_id,
            nivel_manual=False,
            atribuido_por="sistema"
        )
        return classificacao
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== CÁLCULO DE COMISSÃO ====================

@router.post("/calcular")
async def calcular_comissao(
    motorista_id: str,
    valor_faturado: float,
    escala_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Calcular comissão de um motorista"""
    service = get_service()
    
    try:
        resultado = await service.calcular_comissao(
            motorista_id=motorista_id,
            valor_faturado=valor_faturado,
            escala_id=escala_id
        )
        return resultado.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/simular")
async def simular_comissao(
    valor_faturado: float,
    nivel_classificacao: int = 1,
    current_user: Dict = Depends(get_current_user)
):
    """Simular cálculo de comissão (sem motorista específico)"""
    service = get_service()
    
    escala = await service.obter_escala_ativa()
    if not escala:
        await service.seed_escala_padrao()
        escala = await service.obter_escala_ativa()
    
    config = await service.obter_config_classificacao()
    niveis = config.get("niveis", [])
    nivel = next((n for n in niveis if n["nivel"] == nivel_classificacao), niveis[0] if niveis else None)
    
    nivel_escala = service.obter_nivel_escala_para_valor(escala, valor_faturado)
    
    percentagem_base = nivel_escala["percentagem_comissao"] if nivel_escala else 0
    bonus = nivel["bonus_percentagem"] if nivel else 0
    
    valor_base = valor_faturado * (percentagem_base / 100)
    valor_bonus = valor_faturado * (bonus / 100)
    
    return {
        "valor_faturado": valor_faturado,
        "escala_nome": escala["nome"],
        "nivel_escala": nivel_escala["nome"] if nivel_escala else "N/A",
        "percentagem_base": percentagem_base,
        "valor_comissao_base": round(valor_base, 2),
        "nivel_classificacao": nivel["nome"] if nivel else "N/A",
        "bonus_percentagem": bonus,
        "valor_bonus": round(valor_bonus, 2),
        "percentagem_total": percentagem_base + bonus,
        "valor_total": round(valor_base + valor_bonus, 2)
    }


# ==================== CONFIGURAÇÃO DO PARCEIRO ====================

@router.get("/parceiro/config")
async def obter_config_parceiro(
    current_user: Dict = Depends(get_current_user)
):
    """Obter configuração de comissões do parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    config = await db.config_comissoes_parceiro.find_one(
        {"parceiro_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not config:
        # Retornar configuração padrão
        service = get_service()
        escala_global = await service.obter_escala_ativa()
        classificacao_global = await service.obter_config_classificacao()
        
        config = {
            "parceiro_id": current_user["id"],
            "usar_escala_propria": False,
            "usar_valor_fixo": False,
            "valor_fixo_comissao": 0,
            "percentagem_fixa": 15,
            "escala_propria": escala_global.get("niveis", []) if escala_global else [],
            "usar_classificacao_propria": False,
            "niveis_classificacao": classificacao_global.get("niveis", []) if classificacao_global else []
        }
    
    return config


@router.put("/parceiro/config")
async def atualizar_config_parceiro(
    config: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar configuração de comissões do parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    now = datetime.now(timezone.utc)
    
    config_update = {
        "parceiro_id": current_user["id"],
        "usar_escala_propria": config.get("usar_escala_propria", False),
        "usar_valor_fixo": config.get("usar_valor_fixo", False),
        "valor_fixo_comissao": float(config.get("valor_fixo_comissao", 0)),
        "percentagem_fixa": float(config.get("percentagem_fixa", 15)),
        "escala_propria": config.get("escala_propria", []),
        "usar_classificacao_propria": config.get("usar_classificacao_propria", False),
        "niveis_classificacao": config.get("niveis_classificacao", []),
        "updated_at": now.isoformat()
    }
    
    await db.config_comissoes_parceiro.update_one(
        {"parceiro_id": current_user["id"]},
        {"$set": config_update},
        upsert=True
    )
    
    logger.info(f"Configuração de comissões do parceiro {current_user['id']} atualizada")
    
    return {"sucesso": True, "mensagem": "Configuração guardada"}


# ==================== TURNOS ====================

@router.get("/turnos/veiculo/{veiculo_id}")
async def obter_turnos_veiculo(
    veiculo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter turnos de um veículo"""
    service = get_service()
    turnos = await service.obter_turnos_veiculo(veiculo_id)
    return turnos


@router.post("/turnos/veiculo/{veiculo_id}")
async def adicionar_turno(
    veiculo_id: str,
    request: AdicionarTurnoRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Adicionar turno a um veículo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    service = get_service()
    turno = await service.adicionar_turno(
        veiculo_id=veiculo_id,
        motorista_id=request.motorista_id,
        hora_inicio=request.hora_inicio,
        hora_fim=request.hora_fim,
        dias_semana=request.dias_semana,
        notas=request.notas
    )
    return turno


@router.put("/turnos/veiculo/{veiculo_id}/turno/{turno_id}")
async def atualizar_turno(
    veiculo_id: str,
    turno_id: str,
    request: AtualizarTurnoRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar um turno"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    updates = {}
    if request.hora_inicio is not None:
        updates["hora_inicio"] = request.hora_inicio
    if request.hora_fim is not None:
        updates["hora_fim"] = request.hora_fim
    if request.dias_semana is not None:
        updates["dias_semana"] = request.dias_semana
    if request.ativo is not None:
        updates["ativo"] = request.ativo
    if request.notas is not None:
        updates["notas"] = request.notas
    
    service = get_service()
    sucesso = await service.atualizar_turno(veiculo_id, turno_id, updates)
    
    if not sucesso:
        raise HTTPException(status_code=404, detail="Turno não encontrado")
    
    return {"sucesso": True}


@router.delete("/turnos/veiculo/{veiculo_id}/turno/{turno_id}")
async def remover_turno(
    veiculo_id: str,
    turno_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remover um turno"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    service = get_service()
    sucesso = await service.remover_turno(veiculo_id, turno_id)
    
    if not sucesso:
        raise HTTPException(status_code=404, detail="Turno não encontrado")
    
    return {"sucesso": True}


@router.put("/turnos/veiculo/{veiculo_id}/principal")
async def definir_motorista_principal(
    veiculo_id: str,
    request: DefinirMotoristaPrincipalRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Definir motorista principal de um veículo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    service = get_service()
    await service.definir_motorista_principal(veiculo_id, request.motorista_id)
    
    return {"sucesso": True}


# ==================== SISTEMA DE PROGRESSÃO AUTOMÁTICA ====================

@router.get("/classificacao/motorista/{motorista_id}/progressao")
async def verificar_progressao(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Verificar elegibilidade de um motorista para promoção
    Retorna detalhes sobre nível actual, pontuação de cuidado e requisitos para próximo nível
    """
    service = get_service()
    
    try:
        resultado = await service.verificar_progressao_motorista(motorista_id)
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/classificacao/motorista/{motorista_id}/pontuacao-cuidado")
async def obter_pontuacao_cuidado(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Obter pontuação detalhada de cuidado com veículo
    Mostra breakdown de todos os factores (vistorias, incidentes, manutenções, avaliação)
    """
    service = get_service()
    resultado = await service.calcular_pontuacao_cuidado_veiculo(motorista_id)
    return resultado


@router.post("/classificacao/motorista/{motorista_id}/promover")
async def promover_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Tentar promover um motorista para o próximo nível
    Verifica automaticamente a elegibilidade antes de promover
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Apenas administradores ou parceiros podem promover motoristas")
    
    service = get_service()
    
    try:
        sucesso, detalhes = await service.promover_motorista(
            motorista_id=motorista_id,
            atribuido_por=current_user["id"]
        )
        
        if sucesso:
            return {"sucesso": True, **detalhes}
        else:
            raise HTTPException(status_code=400, detail=detalhes)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/classificacao/recalcular-todas")
async def recalcular_todas_classificacoes(
    current_user: Dict = Depends(get_current_user)
):
    """
    Recalcular classificações de todos os motoristas
    Endpoint manual para o admin executar quando quiser
    Também usado pelo job automático (semanal/diário)
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    service = get_service()
    resultado = await service.recalcular_todas_classificacoes(
        atribuido_por=current_user["id"]
    )
    
    return resultado


@router.put("/classificacao/motorista/{motorista_id}/avaliacao-parceiro")
async def atualizar_avaliacao_parceiro(
    motorista_id: str,
    avaliacao: int = Query(..., ge=0, le=100, description="Avaliação de 0 a 100"),
    current_user: Dict = Depends(get_current_user)
):
    """
    Atualizar a avaliação manual do parceiro para um motorista
    Esta avaliação contribui 15% para a pontuação de cuidado com veículo
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Apenas administradores ou parceiros")
    
    service = get_service()
    
    try:
        resultado = await service.atualizar_avaliacao_parceiro(
            motorista_id=motorista_id,
            avaliacao=avaliacao,
            avaliado_por=current_user["id"]
        )
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
