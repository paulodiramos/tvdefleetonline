"""Relatórios routes for FleeTrack application - Refactored from server.py"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
import uuid
import logging
from io import BytesIO

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/relatorios", tags=["relatorios"])

db = get_database()

# Upload directory
ROOT_DIR = Path(__file__).parent.parent
UPLOAD_DIR = ROOT_DIR / "uploads"


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== RELATÓRIOS SEMANAIS ====================

@router.post("/motorista/{motorista_id}/gerar-semanal")
async def gerar_relatorio_semanal(
    motorista_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Gerar relatório semanal para motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data_inicio = data.get("data_inicio")
    data_fim = data.get("data_fim")
    
    if not data_inicio or not data_fim:
        raise HTTPException(status_code=400, detail="data_inicio e data_fim são obrigatórios")
    
    # Get motorista data
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    parceiro_id = motorista.get("parceiro_atribuido") or motorista.get("parceiro_id")
    if not parceiro_id:
        raise HTTPException(status_code=400, detail="Motorista não tem parceiro atribuído")
    
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get parceiro data
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        parceiro = await db.users.find_one({"id": parceiro_id}, {"_id": 0})
    
    # Get vehicle data
    veiculo_id = motorista.get("veiculo_atribuido")
    veiculo = None
    if veiculo_id:
        veiculo = await db.vehicles.find_one({"id": veiculo_id}, {"_id": 0})
    
    # Get contrato data
    contrato = await db.contratos.find_one({
        "motorista_id": motorista_id,
        "ativo": True
    }, {"_id": 0})
    
    # Get relatorio configuration
    config = await db.relatorio_config.find_one({"parceiro_id": parceiro_id}, {"_id": 0})
    if not config:
        config = get_default_relatorio_config()
    
    # Calculate via verde dates with delay
    via_verde_atraso = config.get("via_verde_atraso_semanas", 1)
    data_inicio_via_verde = (datetime.fromisoformat(data_inicio) - timedelta(weeks=via_verde_atraso)).strftime("%Y-%m-%d")
    data_fim_via_verde = (datetime.fromisoformat(data_fim) - timedelta(weeks=via_verde_atraso)).strftime("%Y-%m-%d")
    
    # Calculate totals from uber and bolt collections
    total_ganhos_uber = 0.0
    total_ganhos_bolt = 0.0
    total_viagens_uber = 0
    total_viagens_bolt = 0
    total_gorjetas_bolt = 0.0
    total_portagens_bolt = 0.0
    
    # Query Uber from multiple collections
    uber_query = {
        "$or": [
            {"motorista_id": motorista_id},
            {"email_motorista": motorista.get("email")},
            {"email": motorista.get("email")},
            {"uuid_motorista": motorista.get("uuid_motorista_uber")}
        ],
        "data": {"$gte": data_inicio, "$lte": data_fim}
    }
    
    # 1. Check ganhos_uber collection (main import collection)
    ganhos_uber_records = await db.ganhos_uber.find(uber_query, {"_id": 0}).to_list(1000)
    for record in ganhos_uber_records:
        total_ganhos_uber += record.get("pago_total", 0) or record.get("rendimentos_total", 0) or record.get("ganhos", 0) or 0
        total_viagens_uber += record.get("viagens", 1)
    
    # 2. Check dados_uber collection (fallback/legacy)
    dados_uber_records = await db.dados_uber.find(uber_query, {"_id": 0}).to_list(1000)
    for record in dados_uber_records:
        total_ganhos_uber += record.get("pago_total", 0) or record.get("rendimentos_total", 0) or 0
        total_viagens_uber += record.get("viagens", 1)
    
    # Query dados_bolt from multiple collections
    # Use multiple criteria: data range, periodo range, or semana/ano
    semana_relatorio = data.get("semana", 1)
    ano_relatorio = data.get("ano", datetime.now(timezone.utc).year)
    
    bolt_query = {
        "$or": [
            {"motorista_id": motorista_id},
            {"email_motorista": motorista.get("email")},
            {"email": motorista.get("email")}
        ],
        "$or": [
            # Match by data field
            {"data": {"$gte": data_inicio, "$lte": data_fim}},
            # Match by periodo fields
            {"periodo_inicio": data_inicio, "periodo_fim": data_fim},
            # Match by semana/ano
            {"semana": semana_relatorio, "ano": ano_relatorio}
        ]
    }
    
    # Simplified query for motorista + period matching
    bolt_query_simple = {
        "$and": [
            {"$or": [
                {"motorista_id": motorista_id},
                {"email_motorista": motorista.get("email")},
                {"email": motorista.get("email")}
            ]},
            {"$or": [
                {"data": {"$gte": data_inicio, "$lte": data_fim}},
                {"periodo_inicio": data_inicio},
                {"semana": semana_relatorio, "ano": ano_relatorio}
            ]}
        ]
    }
    
    # 1. Check ganhos_bolt collection (new imports from CSV)
    ganhos_bolt_records = await db.ganhos_bolt.find(bolt_query_simple, {"_id": 0}).to_list(1000)
    for record in ganhos_bolt_records:
        # Use ganhos_liquidos field from Bolt CSV import
        total_ganhos_bolt += record.get("ganhos_liquidos", 0) or record.get("ganhos", 0) or record.get("earnings", 0) or 0
        total_viagens_bolt += record.get("viagens", 1)
    
    # 2. Check viagens_bolt collection (legacy or individual trips)
    viagens_bolt_records = await db.viagens_bolt.find(bolt_query_simple, {"_id": 0}).to_list(1000)
    for record in viagens_bolt_records:
        total_ganhos_bolt += record.get("ganhos_liquidos", 0) or record.get("ganhos", 0) or record.get("valor_liquido", 0) or 0
        total_gorjetas_bolt += record.get("gorjetas", 0) or 0
        total_portagens_bolt += record.get("portagens", 0) or 0
        total_viagens_bolt += 1
    
    # 3. Check dados_bolt collection (fallback)
    dados_bolt_records = await db.dados_bolt.find(bolt_query_simple, {"_id": 0}).to_list(1000)
    for record in dados_bolt_records:
        total_ganhos_bolt += record.get("ganhos", 0) or record.get("earnings", 0) or 0
        total_viagens_bolt += record.get("viagens", 1)
    
    # Get combustivel data (fossil)
    total_combustivel = 0.0
    combustivel_records = []
    if config.get("incluir_combustivel", True):
        # Try to get from multiple sources
        # 1. Legacy abastecimentos collection (by vehicle)
        if veiculo_id:
            comb_query = {
                "veiculo_id": veiculo_id,
                "data": {"$gte": data_inicio, "$lte": data_fim}
            }
            legacy_records = await db.abastecimentos.find(comb_query, {"_id": 0}).to_list(1000)
            combustivel_records.extend(legacy_records)
            total_combustivel += sum(r.get("valor_com_iva", 0) or r.get("valor", 0) or 0 for r in legacy_records)
        
        # 2. New imported combustivel collection (by vehicle or motorista)
        comb_query_new = {
            "$or": [
                {"vehicle_id": veiculo_id} if veiculo_id else {"vehicle_id": None},
                {"motorista_id": motorista_id}
            ],
            "data": {"$gte": data_inicio, "$lte": data_fim}
        }
        if not veiculo_id:
            comb_query_new = {
                "motorista_id": motorista_id,
                "data": {"$gte": data_inicio, "$lte": data_fim}
            }
        new_records = await db.abastecimentos_combustivel.find(comb_query_new, {"_id": 0}).to_list(1000)
        for r in new_records:
            valor = r.get("valor_liquido", 0) or r.get("valor", 0) or 0
            total_combustivel += valor
            combustivel_records.append({
                "data": r.get("data"),
                "valor": valor,
                "posto": r.get("posto", ""),
                "combustivel": r.get("combustivel", ""),
                "litros": r.get("litros", 0),
                "tipo": "importado"
            })
    
    # Get carregamentos elétricos data
    total_eletrico = 0.0
    eletrico_records = []
    if config.get("incluir_eletrico", True):
        elet_query = {
            "$or": [
                {"vehicle_id": veiculo_id} if veiculo_id else {"vehicle_id": None},
                {"motorista_id": motorista_id}
            ],
            "data": {"$gte": data_inicio, "$lte": data_fim}
        }
        if not veiculo_id:
            elet_query = {
                "motorista_id": motorista_id,
                "data": {"$gte": data_inicio, "$lte": data_fim}
            }
        elet_records = await db.abastecimentos_eletrico.find(elet_query, {"_id": 0}).to_list(1000)
        for r in elet_records:
            valor = r.get("valor_total_com_taxas", 0) or r.get("custo_base", 0) or 0
            total_eletrico += valor
            eletrico_records.append({
                "data": r.get("data"),
                "valor": valor,
                "estacao": r.get("estacao_id", ""),
                "energia_kwh": r.get("energia_kwh", 0),
                "duracao": r.get("duracao_minutos", 0),
                "tipo": "carregamento_eletrico"
            })
    
    # Get GPS/KM data
    total_km = 0.0
    gps_records = []
    if config.get("incluir_gps", True):
        gps_query = {
            "$or": [
                {"vehicle_id": veiculo_id} if veiculo_id else {"vehicle_id": None},
                {"motorista_id": motorista_id},
                {"matricula": veiculo.get("matricula")} if veiculo else {"matricula": None}
            ],
            "data": {"$gte": data_inicio, "$lte": data_fim}
        }
        if not veiculo_id and not veiculo:
            gps_query = {
                "motorista_id": motorista_id,
                "data": {"$gte": data_inicio, "$lte": data_fim}
            }
        gps_data = await db.viagens_gps.find(gps_query, {"_id": 0}).to_list(1000)
        for r in gps_data:
            km = r.get("km", 0) or r.get("distancia", 0) or 0
            total_km += km
            gps_records.append({
                "data": r.get("data"),
                "km": km,
                "origem": r.get("origem", ""),
                "destino": r.get("destino", ""),
                "tipo": "gps"
            })
    
    # Get via verde data
    total_via_verde = 0.0
    via_verde_records = []
    incluir_via_verde = config.get("incluir_via_verde", True)
    
    # Get semana/ano from request data
    semana_relatorio = data.get("semana", 1)
    ano_relatorio = data.get("ano", datetime.now().year)
    
    if incluir_via_verde:
        # Legacy via_verde collection (by vehicle)
        if veiculo_id:
            vv_query = {
                "veiculo_id": veiculo_id,
                "data": {"$gte": data_inicio_via_verde, "$lte": data_fim_via_verde}
            }
            via_verde_records = await db.via_verde.find(vv_query, {"_id": 0}).to_list(1000)
            total_via_verde = sum(r.get("valor", 0) or 0 for r in via_verde_records)
        
        # ======= NOVA LÓGICA: Buscar da coleção portagens_viaverde =======
        # Esta coleção é preenchida pelo import de Excel Via Verde
        # IMPORTANTE: Considerar o atraso da Via Verde (semana dos dados = semana_relatorio - via_verde_atraso)
        semana_via_verde = semana_relatorio - via_verde_atraso if semana_relatorio > via_verde_atraso else semana_relatorio
        ano_via_verde = ano_relatorio if semana_relatorio > via_verde_atraso else ano_relatorio - 1
        
        portagens_vv_query = {
            "motorista_id": motorista_id,
            "$or": [
                # Buscar por semana/ano ajustado para o atraso
                {"semana": semana_via_verde, "ano": ano_via_verde},
                # Fallback: buscar por data de entrada
                {
                    "entry_date": {"$gte": data_inicio_via_verde, "$lte": data_fim_via_verde},
                    "semana": None
                },
                {
                    "data": {"$gte": data_inicio_via_verde, "$lte": data_fim_via_verde},
                    "semana": None
                }
            ]
        }
        
        # Também buscar por veículo se o motorista estiver atribuído
        if veiculo_id:
            portagens_vv_query = {
                "$or": [
                    {"motorista_id": motorista_id},
                    {"vehicle_id": veiculo_id}
                ],
                "$and": [
                    {
                        "$or": [
                            {"semana": semana_via_verde, "ano": ano_via_verde},
                            {
                                "entry_date": {"$gte": data_inicio_via_verde, "$lte": data_fim_via_verde}
                            },
                            {
                                "data": {"$gte": data_inicio_via_verde, "$lte": data_fim_via_verde}
                            }
                        ]
                    }
                ]
            }
        
        logger.info(f"📍 Via Verde query: motorista={motorista_id}, semana={semana_via_verde}, ano={ano_via_verde}, veiculo={veiculo_id}")
        
        portagens_viaverde = await db.portagens_viaverde.find(portagens_vv_query, {"_id": 0}).to_list(1000)
        
        # Adicionar aos registos e somar valores
        for pv in portagens_viaverde:
            valor = float(pv.get("liquid_value") or pv.get("value") or 0)
            via_verde_records.append({
                "data": pv.get("entry_date") or pv.get("data"),
                "valor": valor,
                "local": f"{pv.get('entry_point', '')} → {pv.get('exit_point', '')}",
                "tipo": "importado_excel",
                "service": pv.get("service"),
                "matricula": pv.get("matricula")
            })
            total_via_verde += valor
        
        logger.info(f"📍 Via Verde portagens: {len(portagens_viaverde)} registos, total: €{total_via_verde:.2f}")
        
        # Check imported despesas from CSV (Via Verde)
        # Priority 1: Use semana_relatorio field if available (new import system)
        despesas_vv_query_semana = {
            "motorista_id": motorista_id,
            "tipo_fornecedor": "via_verde",
            "tipo_responsavel": "motorista",
            "semana_relatorio": semana_relatorio,
            "ano_relatorio": ano_relatorio
        }
        
        despesas_via_verde_semana = await db.despesas_fornecedor.find(despesas_vv_query_semana, {"_id": 0}).to_list(1000)
        
        # Priority 2: Fallback to date-based query (legacy imports without semana_relatorio)
        data_fim_vv_next = (datetime.fromisoformat(data_fim_via_verde) + timedelta(days=1)).strftime("%Y-%m-%d")
        
        despesas_vv_query_data = {
            "motorista_id": motorista_id,
            "tipo_fornecedor": "via_verde",
            "tipo_responsavel": "motorista",
            "semana_relatorio": None,  # Only get legacy records
            "data_entrada": {"$gte": data_inicio_via_verde, "$lt": data_fim_vv_next}
        }
        
        despesas_via_verde_data = await db.despesas_fornecedor.find(despesas_vv_query_data, {"_id": 0}).to_list(1000)
        
        # Combine both results
        despesas_via_verde = despesas_via_verde_semana + despesas_via_verde_data
        
        # Add imported despesas to records for display
        for desp in despesas_via_verde:
            via_verde_records.append({
                "data": desp.get("data_entrada"),
                "valor": desp.get("valor_liquido", 0.0),
                "local": f"{desp.get('ponto_entrada', '')} → {desp.get('ponto_saida', '')}",
                "tipo": "importado_csv",
                "semana_dados": desp.get("semana_dados"),
                "semana_relatorio": desp.get("semana_relatorio")
            })
        
        # Sum imported despesas
        via_verde_importado = sum(desp.get("valor_liquido", 0.0) for desp in despesas_via_verde)
        total_via_verde += via_verde_importado
    
    # ==================== CÁLCULO DE ALUGUER PROPORCIONAL ====================
    # Verificar se houve troca de veículo na semana do relatório
    valor_aluguer = 0.0
    aluguer_detalhes = []
    
    # Buscar histórico de atribuições do motorista nesta semana
    historico_semana = await db.historico_atribuicoes.find({
        "motorista_id": motorista_id,
        "$or": [
            # Atribuição começou antes ou durante a semana e ainda estava ativa
            {
                "data_inicio": {"$lte": data_fim + "T23:59:59"},
                "$or": [
                    {"data_fim": None},
                    {"data_fim": {"$gte": data_inicio + "T00:00:00"}}
                ]
            }
        ]
    }, {"_id": 0}).to_list(100)
    
    if historico_semana:
        # Calcular aluguer proporcional para cada veículo usado na semana
        dt_inicio_semana = datetime.fromisoformat(data_inicio)
        dt_fim_semana = datetime.fromisoformat(data_fim) + timedelta(days=1)  # Incluir último dia
        total_dias_semana = 7
        
        for hist in historico_semana:
            hist_inicio_str = hist["data_inicio"].replace("Z", "").split("+")[0]
            hist_inicio = datetime.fromisoformat(hist_inicio_str[:19])  # Remove microseconds
            
            if hist.get("data_fim"):
                hist_fim_str = hist["data_fim"].replace("Z", "").split("+")[0]
                hist_fim = datetime.fromisoformat(hist_fim_str[:19])
                # Se termina às 23:59, considerar como fim do dia seguinte para contagem
                if hist_fim.hour >= 23:
                    hist_fim = hist_fim.replace(hour=0, minute=0, second=0) + timedelta(days=1)
            else:
                hist_fim = dt_fim_semana  # Ainda ativo
            
            # Calcular sobreposição com a semana do relatório
            periodo_inicio = max(hist_inicio, dt_inicio_semana)
            periodo_fim = min(hist_fim, dt_fim_semana)
            
            if periodo_fim > periodo_inicio:
                # Calcular dias completos
                dias_com_veiculo = (periodo_fim.date() - periodo_inicio.date()).days
                if dias_com_veiculo < 1:
                    dias_com_veiculo = 1  # Mínimo 1 dia
                
                valor_semanal = hist.get("valor_aluguer_semanal", 0) or 0
                valor_diario = valor_semanal / 7
                valor_proporcional = valor_diario * dias_com_veiculo
                
                valor_aluguer += valor_proporcional
                aluguer_detalhes.append({
                    "veiculo_id": hist.get("veiculo_id"),
                    "veiculo_matricula": hist.get("veiculo_matricula"),
                    "dias": dias_com_veiculo,
                    "valor_semanal": valor_semanal,
                    "valor_proporcional": round(valor_proporcional, 2),
                    "periodo": f"{periodo_inicio.strftime('%d/%m')} - {(periodo_fim - timedelta(days=1)).strftime('%d/%m') if periodo_fim > periodo_inicio else periodo_inicio.strftime('%d/%m')}"
                })
        
        valor_aluguer = round(valor_aluguer, 2)
    else:
        # Fallback: usar valor do contrato/veículo atual (sem histórico)
        if contrato:
            valor_aluguer = contrato.get("valor_semanal", 0) or 0
        elif veiculo:
            valor_aluguer = veiculo.get("valor_semanal", 0) or 0
    
    # Calculate totals
    valor_bruto = total_ganhos_uber + total_ganhos_bolt
    valor_descontos = total_combustivel + total_eletrico + total_via_verde + valor_aluguer
    valor_liquido = valor_bruto - valor_descontos
    
    # Generate relatorio ID
    relatorio_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    relatorio = {
        "id": relatorio_id,
        "motorista_id": motorista_id,
        "motorista_nome": motorista.get("name"),
        "motorista_email": motorista.get("email"),
        "parceiro_id": parceiro_id,
        "parceiro_nome": parceiro.get("name") if parceiro else None,
        "veiculo_id": veiculo_id,
        "veiculo_matricula": veiculo.get("matricula") if veiculo else None,
        
        "periodo_inicio": data_inicio,
        "periodo_fim": data_fim,
        "semana": data.get("semana", 1),
        "ano": data.get("ano", now.year),
        
        # Ganhos
        "ganhos_uber": total_ganhos_uber,
        "ganhos_bolt": total_ganhos_bolt,
        "gorjetas_bolt": total_gorjetas_bolt,
        "portagens_bolt": total_portagens_bolt,
        "total_ganhos": valor_bruto,
        "viagens_uber": total_viagens_uber,
        "viagens_bolt": total_viagens_bolt,
        "total_viagens": total_viagens_uber + total_viagens_bolt,
        
        # Despesas
        "total_combustivel": total_combustivel,
        "total_eletrico": total_eletrico,
        "total_via_verde": total_via_verde,
        "valor_aluguer": valor_aluguer,
        "aluguer_proporcional": len(aluguer_detalhes) > 1,  # True se houve troca de veículo
        "aluguer_detalhes": aluguer_detalhes if aluguer_detalhes else None,
        
        # GPS/KM
        "total_km": total_km,
        "total_viagens_gps": len(gps_records),
        
        # Records detail (optional)
        "combustivel_records": combustivel_records if combustivel_records else None,
        "eletrico_records": eletrico_records if eletrico_records else None,
        "gps_records": gps_records if gps_records else None,
        
        # Totais
        "valor_bruto": valor_bruto,
        "valor_descontos": valor_descontos,
        "valor_liquido": valor_liquido,
        
        # Status
        "status": "rascunho",
        "created_by": current_user["id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.relatorios_semanais.insert_one(relatorio)
    
    logger.info(f"✅ Relatório semanal gerado: {relatorio_id} para motorista {motorista.get('name')}")
    
    return {
        "message": "Relatório gerado com sucesso",
        "relatorio_id": relatorio_id,
        "resumo": {
            "ganhos_uber": total_ganhos_uber,
            "ganhos_bolt": total_ganhos_bolt,
            "gorjetas_bolt": total_gorjetas_bolt,
            "portagens_bolt": total_portagens_bolt,
            "total_combustivel": total_combustivel,
            "total_eletrico": total_eletrico,
            "total_via_verde": total_via_verde,
            "total_km": total_km,
            "valor_aluguer": valor_aluguer,
            "aluguer_proporcional": len(aluguer_detalhes) > 1,
            "aluguer_detalhes": aluguer_detalhes if aluguer_detalhes else None,
            "valor_liquido": valor_liquido
        }
    }



@router.get("/resumos-motoristas")
async def get_resumos_motoristas(
    current_user: Dict = Depends(get_current_user)
):
    """
    Get summary of latest weekly reports for all drivers.
    Returns ganhos, despesas, and total for each driver's most recent report.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build query based on user role
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    # Get all reports, grouped by motorista, taking the most recent one
    pipeline = [
        {"$match": query},
        {"$sort": {"ano": -1, "semana": -1}},
        {"$group": {
            "_id": "$motorista_id",
            "motorista_id": {"$first": "$motorista_id"},
            "motorista_nome": {"$first": "$motorista_nome"},
            "semana": {"$first": "$semana"},
            "ano": {"$first": "$ano"},
            "ganhos_uber": {"$first": "$ganhos_uber"},
            "ganhos_bolt": {"$first": "$ganhos_bolt"},
            "gorjetas_uber": {"$first": "$gorjetas_uber"},
            "gorjetas_bolt": {"$first": "$gorjetas_bolt"},
            "portagens_uber": {"$first": "$portagens_uber"},
            "portagens_bolt": {"$first": "$portagens_bolt"},
            "total_ganhos": {"$first": "$total_ganhos"},
            "total_combustivel": {"$first": {"$ifNull": ["$combustivel_total", 0]}},
            "total_via_verde": {"$first": {"$ifNull": ["$portagens_viaverde", 0]}},
            "total_eletrico": {"$first": {"$ifNull": ["$carregamentos_eletricos", 0]}},
            "valor_aluguer": {"$first": {"$ifNull": ["$valor_aluguer", 0]}},
            "status": {"$first": "$status"}
        }},
        {"$project": {
            "_id": 0,
            "motorista_id": 1,
            "motorista_nome": 1,
            "semana": 1,
            "ano": 1,
            "ganhos_uber": 1,
            "ganhos_bolt": 1,
            "gorjetas_uber": 1,
            "gorjetas_bolt": 1,
            "portagens_uber": 1,
            "portagens_bolt": 1,
            "total_ganhos": 1,
            "total_despesas": {
                "$add": [
                    {"$ifNull": ["$total_combustivel", 0]},
                    {"$ifNull": ["$total_via_verde", 0]},
                    {"$ifNull": ["$total_eletrico", 0]},
                    {"$ifNull": ["$valor_aluguer", 0]}
                ]
            },
            "valor_liquido": {
                "$subtract": [
                    {"$ifNull": ["$total_ganhos", 0]},
                    {"$add": [
                        {"$ifNull": ["$total_combustivel", 0]},
                        {"$ifNull": ["$total_via_verde", 0]},
                        {"$ifNull": ["$total_eletrico", 0]},
                        {"$ifNull": ["$valor_aluguer", 0]}
                    ]}
                ]
            },
            "status": 1
        }}
    ]
    
    resumos = await db.relatorios_semanais.aggregate(pipeline).to_list(1000)
    
    return resumos



@router.get("/motorista/{motorista_id}/semanais")
async def get_relatorios_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get all weekly reports for a driver"""
    # Check permissions
    if current_user["role"] == UserRole.MOTORISTA and current_user["id"] != motorista_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    relatorios = await db.relatorios_semanais.find(
        {"motorista_id": motorista_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return relatorios


@router.get("/semanal/{relatorio_id}")
async def get_relatorio_semanal(
    relatorio_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get specific weekly report"""
    relatorio = await db.relatorios_semanais.find_one(
        {"id": relatorio_id},
        {"_id": 0}
    )
    
    if not relatorio:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    
    # Check permissions
    if current_user["role"] == UserRole.MOTORISTA and current_user["id"] != relatorio["motorista_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != relatorio["parceiro_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return relatorio


@router.get("/motorista/{motorista_id}/via-verde-total")
async def get_motorista_via_verde_total(
    motorista_id: str,
    semana: int,
    ano: int,
    current_user: Dict = Depends(get_current_user)
):
    """
    Calculate total Via Verde expenses for a driver for a specific week.
    Uses portagens_viaverde collection and considers via_verde_atraso_semanas from config.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get Via Verde delay from config
    config = await db.relatorio_config.find_one({}, {"_id": 0})
    via_verde_atraso = config.get("via_verde_atraso_semanas", 1) if config else 1
    
    # Calculate the data week (semana - atraso)
    semana_via_verde = semana - via_verde_atraso if semana > via_verde_atraso else semana
    ano_via_verde = ano if semana > via_verde_atraso else ano - 1
    
    logger.info(f"📍 Calculating Via Verde total for motorista {motorista_id}, report week {semana}/{ano}, data week {semana_via_verde}/{ano_via_verde}")
    
    # Get motorist data
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    veiculo_id = motorista.get("veiculo_id") if motorista else None
    
    # Get vehicle assigned to this driver (from vehicles collection)
    vehicle = await db.vehicles.find_one({"motorista_atribuido": motorista_id}, {"_id": 0})
    if vehicle:
        veiculo_id = vehicle.get("id")
        obu = vehicle.get("obu") or vehicle.get("via_verde_id")
        logger.info(f"📍 Found vehicle for motorista: {vehicle.get('matricula')}, OBU: {obu}")
    else:
        obu = None
    
    # Calculate date range for the data week
    # ISO week: Monday to Sunday
    from datetime import datetime
    jan4 = datetime(ano_via_verde, 1, 4)
    start_of_week1 = jan4 - timedelta(days=jan4.weekday())
    data_inicio = start_of_week1 + timedelta(weeks=semana_via_verde - 1)
    data_fim = data_inicio + timedelta(days=6)
    
    data_inicio_str = data_inicio.strftime("%Y-%m-%d")
    data_fim_str = data_fim.strftime("%Y-%m-%d")
    
    logger.info(f"📍 Date range for week {semana_via_verde}/{ano_via_verde}: {data_inicio_str} to {data_fim_str}")
    
    # Build query - search by multiple criteria
    query_conditions = []
    
    # 1. By motorista_id
    query_conditions.append({"motorista_id": motorista_id})
    
    # 2. By vehicle_id
    if veiculo_id:
        query_conditions.append({"vehicle_id": veiculo_id})
    
    # 3. By OBU (obu or via_verde_id fields)
    if obu:
        query_conditions.append({"obu": obu})
        query_conditions.append({"via_verde_id": obu})
    
    # Date filter - either by semana/ano or by entry_date
    date_filter = {
        "$or": [
            {"semana": semana_via_verde, "ano": ano_via_verde},
            {
                "entry_date": {"$gte": data_inicio_str, "$lte": data_fim_str}
            }
        ]
    }
    
    # Final query - must match (one of the identifiers) AND (date filter)
    # Use explicit $and to combine identifier match with date filter
    query = {
        "$and": [
            {"$or": query_conditions},
            date_filter
        ]
    }
    
    logger.info(f"📍 Query OBU: {obu}, vehicle_id: {veiculo_id}")
    
    portagens = await db.portagens_viaverde.find(query, {"_id": 0}).to_list(5000)
    
    # Filter by date if semana is None (manual check)
    filtered_portagens = []
    for p in portagens:
        entry_date = p.get("entry_date", "")
        if entry_date:
            try:
                if isinstance(entry_date, str):
                    entry_dt = datetime.strptime(entry_date[:10], "%Y-%m-%d")
                else:
                    entry_dt = entry_date
                    
                # Check if within date range
                if data_inicio <= entry_dt <= data_fim:
                    filtered_portagens.append(p)
            except:
                pass
        elif p.get("semana") == semana_via_verde and p.get("ano") == ano_via_verde:
            filtered_portagens.append(p)
    
    # Calculate total
    total = sum(float(p.get("liquid_value") or p.get("value") or 0) for p in filtered_portagens)
    
    # Also check despesas_fornecedor for legacy imports
    despesas_vv = await db.despesas_fornecedor.find({
        "motorista_id": motorista_id,
        "tipo_fornecedor": "via_verde",
        "$or": [
            {"semana_relatorio": semana_via_verde, "ano_relatorio": ano_via_verde},
            {"semana_dados": semana_via_verde, "ano": ano_via_verde}
        ]
    }, {"_id": 0}).to_list(1000)
    
    total_legacy = sum(float(d.get("valor_liquido") or d.get("valor") or 0) for d in despesas_vv)
    
    total_via_verde = total + total_legacy
    
    logger.info(f"📍 Via Verde total: €{total_via_verde:.2f} (portagens: {len(filtered_portagens)} = €{total:.2f}, legacy: €{total_legacy:.2f})")
    
    return {
        "motorista_id": motorista_id,
        "semana_relatorio": semana,
        "ano_relatorio": ano,
        "semana_dados": semana_via_verde,
        "ano_dados": ano_via_verde,
        "total_via_verde": round(total_via_verde, 2),
        "registos_portagens": len(portagens),
        "registos_legacy": len(despesas_vv),
        "via_verde_atraso_semanas": via_verde_atraso
    }


@router.put("/semanal/{relatorio_id}")
async def update_relatorio_semanal(
    relatorio_id: str,
    updates: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update weekly report"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    relatorio = await db.relatorios_semanais.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    
    # Check parceiro permissions
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != relatorio["parceiro_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Recalculate totals if values changed
    if any(k in updates for k in ["ganhos_uber", "ganhos_bolt", "total_combustivel", "total_via_verde", "valor_aluguer"]):
        ganhos_uber = updates.get("ganhos_uber", relatorio.get("ganhos_uber", 0))
        ganhos_bolt = updates.get("ganhos_bolt", relatorio.get("ganhos_bolt", 0))
        combustivel = updates.get("total_combustivel", relatorio.get("total_combustivel", 0))
        via_verde = updates.get("total_via_verde", relatorio.get("total_via_verde", 0))
        aluguer = updates.get("valor_aluguer", relatorio.get("valor_aluguer", 0))
        
        updates["total_ganhos"] = ganhos_uber + ganhos_bolt
        updates["valor_bruto"] = ganhos_uber + ganhos_bolt
        updates["valor_descontos"] = combustivel + via_verde + aluguer
        updates["valor_liquido"] = updates["valor_bruto"] - updates["valor_descontos"]
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.relatorios_semanais.update_one(
        {"id": relatorio_id},
        {"$set": updates}
    )
    
    return {"message": "Relatório atualizado com sucesso"}


@router.delete("/{relatorio_id}")
async def delete_relatorio(
    relatorio_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a report"""
    # Obter o relatório primeiro para verificar permissões
    relatorio = await db.relatorios_semanais.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    
    # Admin e Gestao podem eliminar qualquer relatório
    if current_user["role"] in [UserRole.ADMIN, UserRole.GESTAO]:
        pass
    # Parceiro só pode eliminar relatórios dos seus motoristas
    elif current_user["role"] == UserRole.PARCEIRO:
        if relatorio.get("parceiro_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado - este relatório não pertence ao seu parceiro")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.relatorios_semanais.delete_one({"id": relatorio_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    
    return {"message": "Relatório eliminado com sucesso"}


# ==================== LISTAS DE RELATÓRIOS ====================

@router.get("/semanais-todos")
async def get_all_relatorios_semanais(
    current_user: Dict = Depends(get_current_user)
):
    """Get all weekly reports (filtered by role)"""
    query = {}
    
    if current_user["role"] == UserRole.MOTORISTA:
        query["motorista_id"] = current_user["id"]
    elif current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    # Admin and Gestao can see all
    
    relatorios = await db.relatorios_semanais.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return relatorios


@router.get("/para-verificar")
async def get_relatorios_para_verificar(
    current_user: Dict = Depends(get_current_user)
):
    """Get reports pending verification"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"status": {"$in": ["recibo_emitido", "recibo_gerado"]}}
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    relatorios = await db.relatorios_semanais.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    return relatorios


@router.get("/para-pagar")
async def get_relatorios_para_pagar(
    current_user: Dict = Depends(get_current_user)
):
    """Get reports pending payment"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"status": "aprovado", "pago": False}
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    relatorios = await db.relatorios_semanais.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    return relatorios


@router.get("/historico")
async def get_relatorios_historico(
    current_user: Dict = Depends(get_current_user)
):
    """Get historical reports"""
    query = {"status": "pago"}
    
    if current_user["role"] == UserRole.MOTORISTA:
        query["motorista_id"] = current_user["id"]
    elif current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    relatorios = await db.relatorios_semanais.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return relatorios


# ==================== AÇÕES DE RELATÓRIO ====================

@router.post("/semanal/{relatorio_id}/enviar")
async def enviar_relatorio(
    relatorio_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Send report to driver"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    relatorio = await db.relatorios_semanais.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    
    await db.relatorios_semanais.update_one(
        {"id": relatorio_id},
        {"$set": {
            "status": "enviado",
            "enviado_em": datetime.now(timezone.utc).isoformat(),
            "enviado_por": current_user["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Relatório enviado com sucesso"}


@router.post("/semanal/{relatorio_id}/aprovar")
async def aprovar_relatorio(
    relatorio_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Approve report for payment"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    relatorio = await db.relatorios_semanais.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    
    await db.relatorios_semanais.update_one(
        {"id": relatorio_id},
        {"$set": {
            "status": "aprovado",
            "aprovado_pagamento": True,
            "aprovado_pagamento_por": current_user["id"],
            "aprovado_pagamento_em": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Relatório aprovado para pagamento"}


@router.post("/semanal/{relatorio_id}/rejeitar")
async def rejeitar_relatorio(
    relatorio_id: str,
    data: Dict[str, str],
    current_user: Dict = Depends(get_current_user)
):
    """Reject report"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    relatorio = await db.relatorios_semanais.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    
    await db.relatorios_semanais.update_one(
        {"id": relatorio_id},
        {"$set": {
            "status": "rejeitado",
            "motivo_rejeicao": data.get("motivo", ""),
            "rejeitado_por": current_user["id"],
            "rejeitado_em": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Relatório rejeitado"}


@router.post("/semanal/{relatorio_id}/marcar-pago")
async def marcar_relatorio_pago(
    relatorio_id: str,
    data: Dict[str, Any] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Mark report as paid"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    relatorio = await db.relatorios_semanais.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    
    update_data = {
        "status": "pago",
        "pago": True,
        "pago_por": current_user["id"],
        "pago_em": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if data and data.get("comprovativo_url"):
        update_data["comprovativo_pagamento_url"] = data.get("comprovativo_url")
    
    await db.relatorios_semanais.update_one(
        {"id": relatorio_id},
        {"$set": update_data}
    )
    
    return {"message": "Relatório marcado como pago"}


# ==================== UPLOAD DE RECIBOS ====================

@router.post("/semanal/{relatorio_id}/upload-recibo")
async def upload_recibo_semanal(
    relatorio_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload receipt for weekly report"""
    relatorio = await db.relatorios_semanais.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    
    # Check permissions
    if current_user["role"] == UserRole.MOTORISTA and current_user["id"] != relatorio["motorista_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        recibos_dir = UPLOAD_DIR / "recibos_semanais"
        recibos_dir.mkdir(exist_ok=True)
        
        file_ext = Path(file.filename).suffix.lower()
        file_id = f"recibo_{relatorio_id}_{uuid.uuid4()}"
        file_path = recibos_dir / f"{file_id}{file_ext}"
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        relative_path = str(file_path.relative_to(ROOT_DIR))
        
        await db.relatorios_semanais.update_one(
            {"id": relatorio_id},
            {"$set": {
                "status": "recibo_emitido",
                "recibo_url": relative_path,
                "recibo_emitido_em": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Recibo enviado com sucesso", "url": relative_path}
        
    except Exception as e:
        logger.error(f"Erro ao enviar recibo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/semanal/{relatorio_id}/upload-comprovativo")
async def upload_comprovativo_pagamento(
    relatorio_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload payment proof"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    relatorio = await db.relatorios_semanais.find_one({"id": relatorio_id}, {"_id": 0})
    if not relatorio:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    
    try:
        comprovativos_dir = UPLOAD_DIR / "comprovativos_pagamento"
        comprovativos_dir.mkdir(exist_ok=True)
        
        file_ext = Path(file.filename).suffix.lower()
        file_id = f"comprovativo_{relatorio_id}_{uuid.uuid4()}"
        file_path = comprovativos_dir / f"{file_id}{file_ext}"
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        relative_path = str(file_path.relative_to(ROOT_DIR))
        
        await db.relatorios_semanais.update_one(
            {"id": relatorio_id},
            {"$set": {
                "comprovativo_pagamento_url": relative_path,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Comprovativo enviado com sucesso", "url": relative_path}
        
    except Exception as e:
        logger.error(f"Erro ao enviar comprovativo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== RESUMO E ESTATÍSTICAS ====================

@router.get("/resumo-semanal")
async def get_resumo_semanal(
    current_user: Dict = Depends(get_current_user)
):
    """Get weekly summary statistics"""
    query = {}
    
    if current_user["role"] == UserRole.MOTORISTA:
        query["motorista_id"] = current_user["id"]
    elif current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    # Get all reports
    relatorios = await db.relatorios_semanais.find(query, {"_id": 0}).to_list(1000)
    
    # Calculate statistics
    total_relatorios = len(relatorios)
    total_valor = sum(r.get("valor_liquido", 0) or 0 for r in relatorios)
    total_pendentes = len([r for r in relatorios if r.get("status") in ["rascunho", "enviado"]])
    total_aprovados = len([r for r in relatorios if r.get("status") == "aprovado"])
    total_pagos = len([r for r in relatorios if r.get("status") == "pago"])
    
    return {
        "total_relatorios": total_relatorios,
        "total_valor": total_valor,
        "pendentes": total_pendentes,
        "aprovados": total_aprovados,
        "pagos": total_pagos
    }


# ==================== HELPER FUNCTIONS ====================

def get_default_relatorio_config():
    """Get default report configuration"""
    return {
        "incluir_numero_relatorio": True,
        "incluir_data_emissao": True,
        "incluir_periodo": True,
        "incluir_nome_parceiro": True,
        "incluir_nome_motorista": True,
        "incluir_veiculo": True,
        "incluir_viagens_bolt": True,
        "incluir_viagens_uber": True,
        "incluir_viagens_totais": True,
        "incluir_horas_bolt": True,
        "incluir_horas_uber": True,
        "incluir_horas_totais": True,
        "incluir_ganhos_uber": True,
        "incluir_ganhos_bolt": True,
        "incluir_ganhos_totais": True,
        "incluir_valor_aluguer": True,
        "incluir_combustivel": True,
        "incluir_via_verde": True,
        "via_verde_atraso_semanas": 1,
        "incluir_caucao": True,
        "incluir_caucao_parcelada": True,
        "incluir_danos": True,
        "incluir_extras": True,
        "incluir_total_recibo": True,
        "incluir_tabela_combustivel": True,
        "formato_numero_relatorio": "xxxxx/ano"
    }
