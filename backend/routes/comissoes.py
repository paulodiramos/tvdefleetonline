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


# ==================== DASHBOARD DE COMISSÕES ====================

@router.get("/dashboard/resumo")
async def obter_dashboard_resumo(
    periodo: str = Query("mensal", description="diario, semanal, mensal"),
    semana: Optional[int] = None,
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Obter resumo de comissões para o dashboard
    Retorna totais, médias e métricas por período
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    
    # Determinar ano e período
    if not ano:
        ano = now.year
    if not mes:
        mes = now.month
    if not semana:
        semana = now.isocalendar()[1]
    
    # Build parceiro filter
    parceiro_filter = {}
    if current_user["role"] == UserRole.PARCEIRO:
        parceiro_filter["parceiro_id"] = current_user["id"]
    
    # Get all motoristas for this parceiro
    motoristas_query = {
        "$or": [
            {"parceiro_id": parceiro_filter.get("parceiro_id")},
            {"parceiro_atribuido": parceiro_filter.get("parceiro_id")}
        ]
    } if parceiro_filter else {}
    
    motoristas = await db.motoristas.find(
        motoristas_query,
        {"_id": 0, "id": 1, "name": 1, "classificacao": 1, "comissao_percentagem": 1}
    ).to_list(1000)
    
    motorista_ids = [m["id"] for m in motoristas]
    
    # Query relatórios semanais para obter dados de comissões
    relatorio_query = {"motorista_id": {"$in": motorista_ids}}
    
    if periodo == "semanal":
        relatorio_query["semana"] = semana
        relatorio_query["ano"] = ano
    elif periodo == "mensal":
        # Aproximação: semanas do mês
        primeiro_dia = datetime(ano, mes, 1)
        if mes == 12:
            ultimo_dia = datetime(ano + 1, 1, 1) - timedelta(days=1)
        else:
            ultimo_dia = datetime(ano, mes + 1, 1) - timedelta(days=1)
        
        semana_inicio = primeiro_dia.isocalendar()[1]
        semana_fim = ultimo_dia.isocalendar()[1]
        relatorio_query["ano"] = ano
        relatorio_query["semana"] = {"$gte": semana_inicio, "$lte": semana_fim}
    else:  # diario - usar última semana
        relatorio_query["semana"] = semana
        relatorio_query["ano"] = ano
    
    relatorios = await db.relatorios_semanais.find(
        relatorio_query,
        {"_id": 0}
    ).to_list(5000)
    
    # Calcular métricas
    total_ganhos = sum(r.get("total_ganhos", 0) or 0 for r in relatorios)
    total_despesas = sum(
        (r.get("total_combustivel", 0) or 0) + 
        (r.get("total_via_verde", 0) or 0) + 
        (r.get("total_eletrico", 0) or 0) +
        (r.get("valor_aluguer", 0) or 0)
        for r in relatorios
    )
    total_liquido = sum(r.get("valor_liquido", 0) or 0 for r in relatorios)
    
    # Comissões estimadas (baseado em config do parceiro ou padrão 70%)
    config_comissoes = await db.config_comissoes_parceiro.find_one(
        {"parceiro_id": current_user["id"]},
        {"_id": 0}
    )
    
    percentagem_comissao = 70  # Default
    if config_comissoes:
        if config_comissoes.get("usar_valor_fixo"):
            percentagem_comissao = 0  # Valor fixo, não percentagem
        else:
            percentagem_comissao = config_comissoes.get("percentagem_fixa", 70)
    
    total_comissoes = total_ganhos * (percentagem_comissao / 100) if percentagem_comissao > 0 else 0
    
    # Calcular por motorista
    comissoes_por_motorista = {}
    for r in relatorios:
        mid = r.get("motorista_id")
        if mid not in comissoes_por_motorista:
            comissoes_por_motorista[mid] = {
                "motorista_id": mid,
                "motorista_nome": r.get("motorista_nome", ""),
                "ganhos": 0,
                "despesas": 0,
                "liquido": 0,
                "comissao_estimada": 0,
                "semanas": 0
            }
        
        comissoes_por_motorista[mid]["ganhos"] += r.get("total_ganhos", 0) or 0
        comissoes_por_motorista[mid]["despesas"] += (
            (r.get("total_combustivel", 0) or 0) + 
            (r.get("total_via_verde", 0) or 0) +
            (r.get("total_eletrico", 0) or 0) +
            (r.get("valor_aluguer", 0) or 0)
        )
        comissoes_por_motorista[mid]["liquido"] += r.get("valor_liquido", 0) or 0
        comissoes_por_motorista[mid]["semanas"] += 1
    
    # Calcular comissão estimada por motorista
    for mid, dados in comissoes_por_motorista.items():
        dados["comissao_estimada"] = round(dados["ganhos"] * (percentagem_comissao / 100), 2)
    
    # Top 5 motoristas por comissão
    top_motoristas = sorted(
        comissoes_por_motorista.values(),
        key=lambda x: x["comissao_estimada"],
        reverse=True
    )[:5]
    
    # Evolução semanal (últimas 8 semanas)
    evolucao = []
    semana_atual = semana
    ano_atual = ano
    
    for i in range(8):
        s = semana_atual - i
        a = ano_atual
        if s <= 0:
            s = 52 + s
            a -= 1
        
        rels_semana = [r for r in relatorios if r.get("semana") == s and r.get("ano") == a]
        ganhos_semana = sum(r.get("total_ganhos", 0) or 0 for r in rels_semana)
        comissao_semana = ganhos_semana * (percentagem_comissao / 100)
        
        evolucao.insert(0, {
            "semana": s,
            "ano": a,
            "label": f"S{s}",
            "ganhos": round(ganhos_semana, 2),
            "comissao": round(comissao_semana, 2)
        })
    
    return {
        "periodo": periodo,
        "semana": semana,
        "mes": mes,
        "ano": ano,
        "totais": {
            "total_ganhos": round(total_ganhos, 2),
            "total_despesas": round(total_despesas, 2),
            "total_liquido": round(total_liquido, 2),
            "total_comissoes": round(total_comissoes, 2),
            "percentagem_comissao": percentagem_comissao,
            "total_motoristas": len(comissoes_por_motorista),
            "total_relatorios": len(relatorios)
        },
        "top_motoristas": top_motoristas,
        "evolucao_semanal": evolucao,
        "por_motorista": list(comissoes_por_motorista.values())
    }


@router.get("/dashboard/por-motorista")
async def obter_comissoes_por_motorista(
    motorista_id: Optional[str] = None,
    semana: Optional[int] = None,
    ano: Optional[int] = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Obter detalhes de comissões por motorista
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    now = datetime.now(timezone.utc)
    if not ano:
        ano = now.year
    if not semana:
        semana = now.isocalendar()[1]
    
    query = {"semana": semana, "ano": ano}
    
    if motorista_id:
        query["motorista_id"] = motorista_id
    elif current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    relatorios = await db.relatorios_semanais.find(
        query,
        {"_id": 0}
    ).to_list(1000)
    
    # Obter config de comissões
    config_comissoes = await db.config_comissoes_parceiro.find_one(
        {"parceiro_id": current_user["id"] if current_user["role"] == UserRole.PARCEIRO else None},
        {"_id": 0}
    )
    
    percentagem = 70
    if config_comissoes:
        percentagem = config_comissoes.get("percentagem_fixa", 70)
    
    resultado = []
    for r in relatorios:
        ganhos = r.get("total_ganhos", 0) or 0
        comissao = ganhos * (percentagem / 100)
        
        resultado.append({
            "motorista_id": r.get("motorista_id"),
            "motorista_nome": r.get("motorista_nome"),
            "semana": r.get("semana"),
            "ano": r.get("ano"),
            "ganhos_uber": r.get("ganhos_uber", 0),
            "ganhos_bolt": r.get("ganhos_bolt", 0),
            "total_ganhos": ganhos,
            "despesas": {
                "combustivel": r.get("total_combustivel", 0),
                "via_verde": r.get("total_via_verde", 0),
                "eletrico": r.get("total_eletrico", 0),
                "aluguer": r.get("valor_aluguer", 0)
            },
            "valor_liquido": r.get("valor_liquido", 0),
            "comissao_estimada": round(comissao, 2),
            "percentagem_comissao": percentagem
        })
    
    return {"motoristas": resultado, "semana": semana, "ano": ano}
