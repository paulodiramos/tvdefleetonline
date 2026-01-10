"""Relatórios routes for FleeTrack application - Refactored from server.py"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
import uuid
import logging
from io import BytesIO

from utils.database import get_database
from utils.auth import get_current_user
from services.envio_relatorios import (
    enviar_relatorio_motorista,
    generate_whatsapp_link,
    generate_relatorio_motorista_text,
    generate_relatorio_motorista_html,
    send_email_sendgrid
)

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
    
    # NOTA: Sem atraso da Via Verde (dados da semana X para relatório da semana X)
    via_verde_atraso = 0
    data_inicio_via_verde = data_inicio
    data_fim_via_verde = data_fim
    
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
        # NOTA: Sem atraso - usar mesma semana do relatório
        semana_via_verde = semana_relatorio
        ano_via_verde = ano_relatorio
        
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
        
        # REGRA DE NEGÓCIO: 
        # 1. APENAS documentos que têm market_description preenchido (importação nova)
        # 2. INCLUIR APENAS transações onde market_description = "portagens" ou "parques"
        included_market_descriptions = {"portagens", "parques"}
        
        # Adicionar aos registos e somar valores (apenas documentos válidos)
        for pv in portagens_viaverde:
            market_desc = str(pv.get("market_description", "")).strip().lower()
            
            # Se não houver market_description, ignorar (dados antigos)
            if not market_desc:
                continue
            
            # Se houver, só incluir se for "portagens" ou "parques"
            if market_desc not in included_market_descriptions:
                logger.debug(f"📍 Excluído Via Verde: {pv.get('entry_point')} → {pv.get('exit_point')} (market_description={market_desc})")
                continue
            
            valor = float(pv.get("liquid_value") or pv.get("value") or 0)
            via_verde_records.append({
                "data": pv.get("entry_date") or pv.get("data"),
                "valor": valor,
                "local": f"{pv.get('entry_point', '')} → {pv.get('exit_point', '')}",
                "tipo": "importado_excel",
                "service": pv.get("service"),
                "matricula": pv.get("matricula"),
                "market_description": pv.get("market_description")
            })
            total_via_verde += valor
        
        logger.info(f"📍 Via Verde portagens: {len(portagens_viaverde)} registos totais, {len(via_verde_records)} após filtro, total: €{total_via_verde:.2f}")
        
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
        "via_verde_semana_referencia": f"Semana {semana_via_verde}/{ano_via_verde}",
        "via_verde_semana": semana_via_verde,
        "via_verde_ano": ano_via_verde,
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
            "via_verde_semana_referencia": f"Semana {semana_via_verde}/{ano_via_verde}",
            "via_verde_semana": semana_via_verde,
            "via_verde_ano": ano_via_verde,
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


@router.get("/parceiro/resumo-semanal")
async def get_resumo_semanal_parceiro(
    semana: Optional[int] = None,
    ano: Optional[int] = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Vista consolidada do resumo semanal para parceiros.
    Calcula dados em tempo real a partir das coleções de importação.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Default to current week if not specified
    now = datetime.now()
    if not semana:
        semana = now.isocalendar()[1]
    if not ano:
        ano = now.year
    
    # Calculate date range for the week
    # Week starts on Monday (ISO week)
    first_day_of_year = datetime(ano, 1, 1)
    if first_day_of_year.weekday() <= 3:  # Mon-Thu
        first_monday = first_day_of_year - timedelta(days=first_day_of_year.weekday())
    else:
        first_monday = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
    
    week_start = first_monday + timedelta(weeks=semana - 1)
    week_end = week_start + timedelta(days=6)
    
    data_inicio = week_start.strftime("%Y-%m-%d")
    data_fim = week_end.strftime("%Y-%m-%d")
    
    logger.info(f"📊 Resumo Semanal: Semana {semana}/{ano} ({data_inicio} a {data_fim})")
    
    # Get all motoristas for the parceiro
    motoristas_query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        motoristas_query["$or"] = [
            {"parceiro_id": current_user["id"]},
            {"parceiro_atribuido": current_user["id"]}
        ]
    
    motoristas = await db.motoristas.find(
        motoristas_query, 
        {"_id": 0, "id": 1, "name": 1, "email": 1, "veiculo_atribuido": 1, 
         "uuid_motorista_uber": 1, "identificador_motorista_bolt": 1,
         "valor_aluguer_semanal": 1}
    ).to_list(1000)
    
    logger.info(f"📊 Encontrados {len(motoristas)} motoristas")
    
    # Build consolidated view
    resumo_motoristas = []
    totais = {
        "total_ganhos_uber": 0,
        "total_ganhos_bolt": 0,
        "total_ganhos": 0,
        "total_combustivel": 0,
        "total_eletrico": 0,
        "total_via_verde": 0,
        "total_aluguer": 0,
        "total_despesas": 0,
        "total_liquido": 0
    }
    
    for motorista in motoristas:
        motorista_id = motorista["id"]
        motorista_email = motorista.get("email", "")
        uuid_uber = motorista.get("uuid_motorista_uber", "")
        id_bolt = motorista.get("identificador_motorista_bolt", "")
        veiculo_id = motorista.get("veiculo_atribuido")
        
        # Get vehicle info
        veiculo = None
        via_verde_id = None
        obu = None
        cartao_combustivel = None
        cartao_eletrico = None
        aluguer_semanal = motorista.get("valor_aluguer_semanal") or 0
        km_atribuidos = None
        valor_km_extra = None
        
        if veiculo_id:
            veiculo = await db.vehicles.find_one({"id": veiculo_id}, {"_id": 0})
            if veiculo:
                via_verde_id = veiculo.get("via_verde_id")
                obu = veiculo.get("obu")
                cartao_combustivel = veiculo.get("cartao_frota_id")
                cartao_eletrico = veiculo.get("cartao_frota_eletric_id")
                km_atribuidos = veiculo.get("km_atribuidos")
                valor_km_extra = veiculo.get("valor_km_extra")
                if aluguer_semanal == 0:
                    # Get from vehicle valor_semanal
                    aluguer_semanal = veiculo.get("valor_semanal") or 0
        
        # ============ GANHOS UBER ============
        # Buscar por UUID ou email
        ganhos_uber = 0.0
        uber_query_conditions = [{"motorista_id": motorista_id}]
        if uuid_uber:
            uber_query_conditions.append({"uuid_motorista": uuid_uber})
        if motorista_email:
            uber_query_conditions.append({"motorista_email": motorista_email})
        
        uber_query = {
            "$or": uber_query_conditions,
            "$and": [
                {"$or": [
                    {"semana": semana, "ano": ano},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]}
            ]
        }
        
        uber_records = await db.ganhos_uber.find(uber_query, {"_id": 0}).to_list(100)
        for r in uber_records:
            ganhos_uber += float(r.get("pago_total") or r.get("rendimentos_total") or r.get("ganhos") or 0)
        
        logger.info(f"  {motorista.get('name')}: Uber query returned {len(uber_records)} records, total €{ganhos_uber:.2f}")
        
        # ============ GANHOS BOLT ============
        ganhos_bolt = 0.0
        bolt_query_conditions = [{"motorista_id": motorista_id}]
        if id_bolt:
            bolt_query_conditions.append({"identificador_motorista_bolt": id_bolt})
        if motorista_email:
            bolt_query_conditions.append({"email_motorista": motorista_email})
        
        bolt_query = {
            "$or": bolt_query_conditions,
            "$and": [
                {"$or": [
                    {"periodo_semana": semana, "periodo_ano": ano},
                    {"semana": semana, "ano": ano},
                    {"periodo_inicio": data_inicio},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]}
            ]
        }
        
        bolt_records = await db.ganhos_bolt.find(bolt_query, {"_id": 0}).to_list(100)
        for r in bolt_records:
            ganhos_bolt += float(r.get("ganhos_liquidos") or r.get("ganhos") or r.get("earnings") or 0)
        
        logger.info(f"  {motorista.get('name')}: Bolt query returned {len(bolt_records)} records, total €{ganhos_bolt:.2f}")
        
        # ============ VIA VERDE ============
        via_verde_total = 0.0
        vv_query_conditions = [{"motorista_id": motorista_id}]
        if via_verde_id:
            vv_query_conditions.append({"via_verde_id": via_verde_id})
        if obu:
            vv_query_conditions.append({"obu": obu})
        if veiculo_id:
            vv_query_conditions.append({"vehicle_id": veiculo_id})
        if veiculo and veiculo.get("matricula"):
            vv_query_conditions.append({"matricula": veiculo.get("matricula")})
        
        vv_query = {
            "$or": vv_query_conditions,
            "$and": [
                {"$or": [
                    {"semana": semana, "ano": ano},
                    {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]}
            ]
        }
        
        vv_records = await db.portagens_viaverde.find(vv_query, {"_id": 0}).to_list(1000)
        # Incluir:
        # 1. Registos com market_description = "portagens" ou "parques" (novos dados)
        # 2. Registos sem market_description (dados antigos) - assumir que são portagens
        for r in vv_records:
            market_desc = str(r.get("market_description", "")).strip().lower()
            # Se não tem market_description ou é portagens/parques, incluir
            if not market_desc or market_desc in ["portagens", "parques"]:
                via_verde_total += float(r.get("liquid_value") or r.get("value") or 0)
        
        logger.info(f"  {motorista.get('name')}: Via Verde query returned {len(vv_records)} records, total €{via_verde_total:.2f}")
        
        # ============ COMBUSTÍVEL FÓSSIL ============
        combustivel_total = 0.0
        comb_query_conditions = [{"motorista_id": motorista_id}]
        if cartao_combustivel:
            comb_query_conditions.append({"cartao_via_verde": cartao_combustivel})
        if veiculo_id:
            comb_query_conditions.append({"vehicle_id": veiculo_id})
        if veiculo and veiculo.get("matricula"):
            comb_query_conditions.append({"matricula": veiculo.get("matricula")})
        
        comb_query = {
            "$or": comb_query_conditions,
            "data": {"$gte": data_inicio, "$lte": data_fim}
        }
        
        comb_records = await db.abastecimentos_combustivel.find(comb_query, {"_id": 0}).to_list(100)
        for r in comb_records:
            combustivel_total += float(r.get("valor_liquido") or r.get("total") or r.get("valor") or 0)
            
            logger.info(f"  {motorista.get('name')}: Combustível query returned {len(comb_records)} records, total €{combustivel_total:.2f}")
        
        # ============ CARREGAMENTO ELÉTRICO ============
        eletrico_total = 0.0
        elet_query_conditions = [{"motorista_id": motorista_id}]
        if cartao_eletrico:
            elet_query_conditions.append({"card_code": cartao_eletrico})
        if veiculo_id:
            elet_query_conditions.append({"vehicle_id": veiculo_id})
        if veiculo and veiculo.get("matricula"):
            elet_query_conditions.append({"matricula": veiculo.get("matricula")})
        
        elet_query = {
            "$or": elet_query_conditions,
            "$and": [
                {"$or": [
                    {"semana": semana, "ano": ano},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]}
            ]
        }
        
        elet_records = await db.despesas_combustivel.find(elet_query, {"_id": 0}).to_list(100)
        for r in elet_records:
            eletrico_total += float(r.get("valor_total") or r.get("TotalValueWithTaxes") or r.get("valor") or 0)
        
        logger.info(f"  {motorista.get('name')}: Elétrico query returned {len(elet_records)} records, total €{eletrico_total:.2f}")
        
        # ============ EXTRAS DO MOTORISTA ============
        # Buscar extras (dívidas, caução parcelada, danos, etc.)
        extras_total = 0.0
        extras_query = {
            "motorista_id": motorista_id,
            "pago": False,  # Apenas não pagos
            "$or": [
                {"semana": semana, "ano": ano},
                {"data": {"$gte": data_inicio, "$lte": data_fim}}
            ]
        }
        extras_records = await db.extras_motorista.find(extras_query, {"_id": 0}).to_list(100)
        for r in extras_records:
            extras_total += float(r.get("valor") or 0)
        
        logger.info(f"  {motorista.get('name')}: Extras query returned {len(extras_records)} records, total €{extras_total:.2f}")
        
        # ============ OBTER DADOS DO CONTRATO ============
        tipo_contrato_veiculo = None
        
        if veiculo:
            tipo_contrato_veiculo = veiculo.get("tipo_contrato_veiculo", "aluguer")
        
        # ============ CALCULAR TOTAIS ============
        total_ganhos = ganhos_uber + ganhos_bolt
        total_despesas_operacionais = combustivel_total + eletrico_total + via_verde_total
        
        # RECEITAS DO PARCEIRO:
        # 1. Aluguer semanal (se contrato de aluguer)
        # 2. Extras cobrados ao motorista (dívidas, caução, danos)
        receita_aluguer = aluguer_semanal if tipo_contrato_veiculo == "aluguer" else 0
        receita_extras = extras_total
        
        # Total receitas do parceiro por este motorista
        receitas_parceiro = receita_aluguer + receita_extras
        
        # Líquido do motorista = Ganhos - Despesas - Aluguer - Extras
        valor_liquido_motorista = total_ganhos - total_despesas_operacionais - receita_aluguer - receita_extras
        
        motorista_resumo = {
            "motorista_id": motorista_id,
            "motorista_nome": motorista.get("name"),
            "motorista_email": motorista_email,
            "motorista_telefone": motorista.get("telefone") or motorista.get("phone"),
            "veiculo_matricula": veiculo.get("matricula") if veiculo else None,
            "veiculo_id": veiculo_id,
            "tem_relatorio": True if (ganhos_uber > 0 or ganhos_bolt > 0) else False,
            "relatorio_id": None,
            "status": "calculado",
            # Ganhos do Motorista
            "ganhos_uber": round(ganhos_uber, 2),
            "ganhos_bolt": round(ganhos_bolt, 2),
            "total_ganhos": round(total_ganhos, 2),
            # Despesas Operacionais
            "combustivel": round(combustivel_total, 2),
            "carregamento_eletrico": round(eletrico_total, 2),
            "via_verde": round(via_verde_total, 2),
            "via_verde_semana_referencia": f"Semana {semana}/{ano}",
            "total_despesas_operacionais": round(total_despesas_operacionais, 2),
            # Receitas do Parceiro
            "aluguer_veiculo": round(receita_aluguer, 2),
            "extras": round(receita_extras, 2),
            "receitas_parceiro": round(receitas_parceiro, 2),
            # Contrato
            "tipo_contrato": tipo_contrato_veiculo,
            # Líquido do Motorista
            "valor_liquido_motorista": round(valor_liquido_motorista, 2),
            # Detalhes dos cartões
            "cartao_combustivel": cartao_combustivel,
            "cartao_eletrico": cartao_eletrico,
            "via_verde_id": via_verde_id,
            # Detalhes do contrato
            "km_atribuidos": km_atribuidos,
            "valor_km_extra": valor_km_extra
        }
        
        resumo_motoristas.append(motorista_resumo)
        
        # Update totals
        totais["total_ganhos_uber"] += ganhos_uber
        totais["total_ganhos_bolt"] += ganhos_bolt
        totais["total_ganhos"] += total_ganhos
        totais["total_combustivel"] += combustivel_total
        totais["total_eletrico"] += eletrico_total
        totais["total_via_verde"] += via_verde_total
        totais["total_despesas_operacionais"] = totais.get("total_despesas_operacionais", 0) + total_despesas_operacionais
        totais["total_aluguer"] = totais.get("total_aluguer", 0) + receita_aluguer
        totais["total_extras"] = totais.get("total_extras", 0) + receita_extras
        totais["total_receitas_parceiro"] = totais.get("total_receitas_parceiro", 0) + receitas_parceiro
    
    # ============ VENDAS DE VEÍCULOS NA SEMANA ============
    vendas_query = {
        "data_venda": {"$gte": data_inicio, "$lte": data_fim}
    }
    if current_user["role"] == UserRole.PARCEIRO:
        vendas_query["parceiro_id"] = current_user["id"]
    
    vendas = await db.vehicles.find(
        {**vendas_query, "vendido": True},
        {"_id": 0, "matricula": 1, "valor_venda": 1, "data_venda": 1, "comprador_nome": 1}
    ).to_list(100)
    
    total_vendas = sum(float(v.get("valor_venda") or 0) for v in vendas)
    totais["total_vendas"] = round(total_vendas, 2)
    totais["total_receitas_parceiro"] = totais.get("total_receitas_parceiro", 0) + total_vendas
    
    # ============ LÍQUIDO FINAL DO PARCEIRO ============
    # Líquido = Receitas (Aluguer + Extras + Vendas) - Despesas Operacionais
    totais["total_liquido_parceiro"] = round(
        totais.get("total_receitas_parceiro", 0) - totais.get("total_despesas_operacionais", 0),
        2
    )
    
    # Round totals
    for key in totais:
        totais[key] = round(totais[key], 2)
    
    # Sort by name
    resumo_motoristas.sort(key=lambda x: x.get("motorista_nome", "") or "")
    
    return {
        "semana": semana,
        "ano": ano,
        "periodo": f"Semana {semana}/{ano} ({data_inicio} a {data_fim})",
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "total_motoristas": len(motoristas),
        "motoristas_com_relatorio": len([m for m in resumo_motoristas if m["tem_relatorio"]]),
        "motoristas": resumo_motoristas,
        "vendas_semana": vendas,
        "totais": totais
    }


# ==================== HISTÓRICO SEMANAL (GRÁFICOS) ====================

@router.get("/parceiro/historico-semanal")
async def get_historico_semanal_parceiro(
    semanas: int = 6,
    semana_atual: Optional[int] = None,
    ano_atual: Optional[int] = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Retorna histórico das últimas N semanas para gráficos de evolução.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now()
    if not semana_atual:
        semana_atual = now.isocalendar()[1]
    if not ano_atual:
        ano_atual = now.year
    
    historico = []
    
    # Calcular semanas anteriores
    for i in range(semanas - 1, -1, -1):
        semana = semana_atual - i
        ano = ano_atual
        
        # Ajustar para ano anterior se necessário
        while semana <= 0:
            semana += 52
            ano -= 1
        
        # Buscar resumo desta semana (simplificado para performance)
        # Calcular datas da semana
        first_day_of_year = datetime(ano, 1, 1)
        if first_day_of_year.weekday() <= 3:
            first_monday = first_day_of_year - timedelta(days=first_day_of_year.weekday())
        else:
            first_monday = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
        
        week_start = first_monday + timedelta(weeks=semana - 1)
        week_end = week_start + timedelta(days=6)
        
        data_inicio = week_start.strftime("%Y-%m-%d")
        data_fim = week_end.strftime("%Y-%m-%d")
        
        # Build query for motoristas
        motoristas_query = {}
        if current_user["role"] == UserRole.PARCEIRO:
            motoristas_query["$or"] = [
                {"parceiro_id": current_user["id"]},
                {"parceiro_atribuido": current_user["id"]}
            ]
        
        motoristas = await db.motoristas.find(
            motoristas_query, 
            {"_id": 0, "id": 1, "veiculo_atribuido": 1}
        ).to_list(1000)
        
        motorista_ids = [m["id"] for m in motoristas]
        
        # Calcular totais simplificados
        total_ganhos = 0.0
        total_despesas = 0.0
        total_comissoes = 0.0
        
        if motorista_ids:
            # Uber
            uber_records = await db.ganhos_uber.find({
                "motorista_id": {"$in": motorista_ids},
                "$or": [
                    {"semana": semana, "ano": ano},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]
            }, {"_id": 0, "pago_total": 1}).to_list(1000)
            total_ganhos += sum(float(r.get("pago_total") or 0) for r in uber_records)
            
            # Bolt
            bolt_records = await db.ganhos_bolt.find({
                "motorista_id": {"$in": motorista_ids},
                "$or": [
                    {"periodo_semana": semana, "periodo_ano": ano},
                    {"semana": semana, "ano": ano}
                ]
            }, {"_id": 0, "ganhos_liquidos": 1}).to_list(1000)
            total_ganhos += sum(float(r.get("ganhos_liquidos") or 0) for r in bolt_records)
            
            # Despesas (Via Verde + Combustível + Elétrico)
            # Obter veículos e matrículas
            veiculo_ids = [m["veiculo_atribuido"] for m in motoristas if m.get("veiculo_atribuido")]
            matriculas = []
            if veiculo_ids:
                veiculos = await db.vehicles.find({"id": {"$in": veiculo_ids}}, {"_id": 0, "matricula": 1}).to_list(100)
                matriculas = [v["matricula"] for v in veiculos if v.get("matricula")]
            
            # Via Verde
            if matriculas:
                vv_records = await db.portagens_viaverde.find({
                    "$and": [
                        {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}},
                        {"$or": [
                            {"motorista_id": {"$in": motorista_ids}},
                            {"matricula": {"$in": matriculas}}
                        ]}
                    ]
                }, {"_id": 0, "liquid_value": 1}).to_list(5000)
                total_despesas += sum(float(r.get("liquid_value") or 0) for r in vv_records)
            
            # Combustível
            if matriculas:
                comb_records = await db.abastecimentos_combustivel.find({
                    "$and": [
                        {"data": {"$gte": data_inicio, "$lte": data_fim}},
                        {"$or": [
                            {"motorista_id": {"$in": motorista_ids}},
                            {"matricula": {"$in": matriculas}}
                        ]}
                    ]
                }, {"_id": 0, "valor_liquido": 1}).to_list(1000)
                total_despesas += sum(float(r.get("valor_liquido") or 0) for r in comb_records)
            
            # Elétrico
            elet_records = await db.despesas_combustivel.find({
                "motorista_id": {"$in": motorista_ids},
                "$or": [
                    {"semana": semana, "ano": ano},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]
            }, {"_id": 0, "valor_total": 1}).to_list(1000)
            total_despesas += sum(float(r.get("valor_total") or 0) for r in elet_records)
            
            # Comissões (simplificado - assume 70% para motoristas)
            total_comissoes = total_ganhos * 0.7
        
        total_liquido = total_ganhos - total_despesas - total_comissoes
        
        historico.append({
            "semana": semana,
            "ano": ano,
            "periodo": f"S{semana}/{ano}",
            "ganhos": round(total_ganhos, 2),
            "despesas": round(total_despesas, 2),
            "comissoes": round(total_comissoes, 2),
            "liquido": round(total_liquido, 2)
        })
    
    return {
        "historico": historico,
        "semana_atual": semana_atual,
        "ano_atual": ano_atual
    }


# ==================== EDIÇÃO E ELIMINAÇÃO DE DADOS SEMANAIS ====================

@router.put("/parceiro/resumo-semanal/motorista/{motorista_id}")
async def update_motorista_weekly_data(
    motorista_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """
    Atualizar valores semanais de um motorista.
    Cria ou atualiza um registo de ajuste manual.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    semana = data.get("semana")
    ano = data.get("ano")
    
    if not semana or not ano:
        raise HTTPException(status_code=400, detail="Semana e ano são obrigatórios")
    
    # Verificar se o motorista pertence ao parceiro
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    if current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_id") != current_user["id"] and motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado a editar este motorista")
    
    # Criar ou atualizar registo de ajuste manual
    ajuste = {
        "motorista_id": motorista_id,
        "motorista_nome": motorista.get("name"),
        "semana": semana,
        "ano": ano,
        "ganhos_uber": float(data.get("ganhos_uber", 0)),
        "ganhos_bolt": float(data.get("ganhos_bolt", 0)),
        "via_verde": float(data.get("via_verde", 0)),
        "combustivel": float(data.get("combustivel", 0)),
        "eletrico": float(data.get("eletrico", 0)),
        "aluguer": float(data.get("aluguer", 0)),
        "extras": float(data.get("extras", 0)),
        "parceiro_id": current_user["id"] if current_user["role"] == UserRole.PARCEIRO else motorista.get("parceiro_id"),
        "editado_por": current_user["id"],
        "editado_em": datetime.now(timezone.utc).isoformat(),
        "is_manual_adjustment": True
    }
    
    # Upsert - atualiza se existir, cria se não existir
    await db.ajustes_semanais.update_one(
        {"motorista_id": motorista_id, "semana": semana, "ano": ano},
        {"$set": ajuste},
        upsert=True
    )
    
    logger.info(f"✅ Valores semanais atualizados para {motorista.get('name')} - S{semana}/{ano}")
    
    return {"message": "Valores atualizados com sucesso"}


@router.delete("/parceiro/resumo-semanal/motorista/{motorista_id}")
async def delete_motorista_weekly_data(
    motorista_id: str,
    semana: int,
    ano: int,
    current_user: Dict = Depends(get_current_user)
):
    """
    Eliminar todos os dados semanais de um motorista específico.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verificar se o motorista pertence ao parceiro
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    if current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_id") != current_user["id"] and motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado a eliminar dados deste motorista")
    
    # Calcular datas da semana
    first_day_of_year = datetime(ano, 1, 1)
    if first_day_of_year.weekday() <= 3:
        first_monday = first_day_of_year - timedelta(days=first_day_of_year.weekday())
    else:
        first_monday = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
    
    week_start = first_monday + timedelta(weeks=semana - 1)
    week_end = week_start + timedelta(days=6)
    
    data_inicio = week_start.strftime("%Y-%m-%d")
    data_fim = week_end.strftime("%Y-%m-%d")
    
    deleted_counts = {}
    
    # Eliminar ganhos Uber
    result = await db.ganhos_uber.delete_many({
        "motorista_id": motorista_id,
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    })
    deleted_counts["ganhos_uber"] = result.deleted_count
    
    # Eliminar ganhos Bolt
    result = await db.ganhos_bolt.delete_many({
        "motorista_id": motorista_id,
        "$or": [
            {"periodo_semana": semana, "periodo_ano": ano},
            {"semana": semana, "ano": ano}
        ]
    })
    deleted_counts["ganhos_bolt"] = result.deleted_count
    
    # Eliminar Via Verde
    result = await db.portagens_viaverde.delete_many({
        "motorista_id": motorista_id,
        "$or": [
            {"semana": semana, "ano": ano},
            {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}}
        ]
    })
    deleted_counts["via_verde"] = result.deleted_count
    
    # Eliminar combustível
    result = await db.abastecimentos_combustivel.delete_many({
        "motorista_id": motorista_id,
        "data": {"$gte": data_inicio, "$lte": data_fim}
    })
    deleted_counts["combustivel"] = result.deleted_count
    
    # Eliminar elétrico
    result = await db.despesas_combustivel.delete_many({
        "motorista_id": motorista_id,
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    })
    deleted_counts["eletrico"] = result.deleted_count
    
    # Eliminar extras
    result = await db.extras_motorista.delete_many({
        "motorista_id": motorista_id,
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    })
    deleted_counts["extras"] = result.deleted_count
    
    # Eliminar ajustes manuais
    result = await db.ajustes_semanais.delete_many({
        "motorista_id": motorista_id,
        "semana": semana,
        "ano": ano
    })
    deleted_counts["ajustes"] = result.deleted_count
    
    logger.info(f"🗑️ Dados eliminados para {motorista.get('name')} - S{semana}/{ano}: {deleted_counts}")
    
    return {
        "message": f"Dados da semana {semana}/{ano} eliminados com sucesso",
        "deleted_counts": deleted_counts
    }


@router.delete("/parceiro/resumo-semanal/all")
async def delete_all_weekly_data(
    semana: int,
    ano: int,
    current_user: Dict = Depends(get_current_user)
):
    """
    Eliminar TODOS os dados semanais de todos os motoristas do parceiro.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Obter motoristas do parceiro
    motoristas_query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        motoristas_query["$or"] = [
            {"parceiro_id": current_user["id"]},
            {"parceiro_atribuido": current_user["id"]}
        ]
    
    motoristas = await db.motoristas.find(motoristas_query, {"_id": 0, "id": 1}).to_list(1000)
    motorista_ids = [m["id"] for m in motoristas]
    
    if not motorista_ids:
        return {"message": "Nenhum motorista encontrado", "deleted_counts": {}}
    
    # Calcular datas da semana
    first_day_of_year = datetime(ano, 1, 1)
    if first_day_of_year.weekday() <= 3:
        first_monday = first_day_of_year - timedelta(days=first_day_of_year.weekday())
    else:
        first_monday = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
    
    week_start = first_monday + timedelta(weeks=semana - 1)
    week_end = week_start + timedelta(days=6)
    
    data_inicio = week_start.strftime("%Y-%m-%d")
    data_fim = week_end.strftime("%Y-%m-%d")
    
    deleted_counts = {}
    
    # Eliminar ganhos Uber
    result = await db.ganhos_uber.delete_many({
        "motorista_id": {"$in": motorista_ids},
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    })
    deleted_counts["ganhos_uber"] = result.deleted_count
    
    # Eliminar ganhos Bolt
    result = await db.ganhos_bolt.delete_many({
        "motorista_id": {"$in": motorista_ids},
        "$or": [
            {"periodo_semana": semana, "periodo_ano": ano},
            {"semana": semana, "ano": ano}
        ]
    })
    deleted_counts["ganhos_bolt"] = result.deleted_count
    
    # Eliminar Via Verde
    result = await db.portagens_viaverde.delete_many({
        "motorista_id": {"$in": motorista_ids},
        "$or": [
            {"semana": semana, "ano": ano},
            {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}}
        ]
    })
    deleted_counts["via_verde"] = result.deleted_count
    
    # Eliminar combustível
    result = await db.abastecimentos_combustivel.delete_many({
        "motorista_id": {"$in": motorista_ids},
        "data": {"$gte": data_inicio, "$lte": data_fim}
    })
    deleted_counts["combustivel"] = result.deleted_count
    
    # Eliminar elétrico
    result = await db.despesas_combustivel.delete_many({
        "motorista_id": {"$in": motorista_ids},
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    })
    deleted_counts["eletrico"] = result.deleted_count
    
    # Eliminar extras
    result = await db.extras_motorista.delete_many({
        "motorista_id": {"$in": motorista_ids},
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    })
    deleted_counts["extras"] = result.deleted_count
    
    # Eliminar ajustes manuais
    result = await db.ajustes_semanais.delete_many({
        "motorista_id": {"$in": motorista_ids},
        "semana": semana,
        "ano": ano
    })
    deleted_counts["ajustes"] = result.deleted_count
    
    total_deleted = sum(deleted_counts.values())
    logger.info(f"🗑️ Todos os dados eliminados para S{semana}/{ano}: {total_deleted} registos")
    
    return {
        "message": f"Todos os dados da semana {semana}/{ano} eliminados com sucesso",
        "total_deleted": total_deleted,
        "deleted_counts": deleted_counts
    }


@router.get("/parceiro/resumo-semanal/pdf")
async def generate_resumo_semanal_pdf(
    semana: int,
    ano: int,
    current_user: Dict = Depends(get_current_user)
):
    """
    Gerar PDF do resumo semanal do parceiro.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    except ImportError:
        raise HTTPException(status_code=500, detail="ReportLab not installed")
    
    # Calcular datas da semana
    first_day_of_year = datetime(ano, 1, 1)
    if first_day_of_year.weekday() <= 3:
        first_monday = first_day_of_year - timedelta(days=first_day_of_year.weekday())
    else:
        first_monday = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
    
    week_start = first_monday + timedelta(weeks=semana - 1)
    week_end = week_start + timedelta(days=6)
    
    data_inicio = week_start.strftime("%Y-%m-%d")
    data_fim = week_end.strftime("%Y-%m-%d")
    
    # Obter motoristas do parceiro
    motoristas_query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        motoristas_query["$or"] = [
            {"parceiro_id": current_user["id"]},
            {"parceiro_atribuido": current_user["id"]}
        ]
    
    motoristas = await db.motoristas.find(
        motoristas_query, 
        {"_id": 0, "id": 1, "name": 1, "veiculo_atribuido": 1, "valor_aluguer_semanal": 1}
    ).to_list(1000)
    
    # Calcular dados por motorista (simplificado)
    motoristas_data = []
    totais = {
        "ganhos_uber": 0, "ganhos_bolt": 0, "via_verde": 0,
        "combustivel": 0, "eletrico": 0, "aluguer": 0, "extras": 0
    }
    
    for m in motoristas:
        motorista_id = m["id"]
        
        # Ganhos Uber
        uber_records = await db.ganhos_uber.find({
            "motorista_id": motorista_id,
            "$or": [
                {"semana": semana, "ano": ano},
                {"data": {"$gte": data_inicio, "$lte": data_fim}}
            ]
        }, {"_id": 0, "pago_total": 1}).to_list(100)
        ganhos_uber = sum(float(r.get("pago_total") or 0) for r in uber_records)
        
        # Ganhos Bolt
        bolt_records = await db.ganhos_bolt.find({
            "motorista_id": motorista_id,
            "$or": [
                {"periodo_semana": semana, "periodo_ano": ano},
                {"semana": semana, "ano": ano}
            ]
        }, {"_id": 0, "ganhos_liquidos": 1}).to_list(100)
        ganhos_bolt = sum(float(r.get("ganhos_liquidos") or 0) for r in bolt_records)
        
        # Via Verde
        vv_records = await db.portagens_viaverde.find({
            "motorista_id": motorista_id,
            "$or": [
                {"semana": semana, "ano": ano},
                {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}}
            ]
        }, {"_id": 0, "liquid_value": 1}).to_list(1000)
        via_verde = sum(float(r.get("liquid_value") or 0) for r in vv_records)
        
        # Combustível
        comb_records = await db.abastecimentos_combustivel.find({
            "motorista_id": motorista_id,
            "data": {"$gte": data_inicio, "$lte": data_fim}
        }, {"_id": 0, "valor_liquido": 1}).to_list(100)
        combustivel = sum(float(r.get("valor_liquido") or 0) for r in comb_records)
        
        # Elétrico
        elet_records = await db.despesas_combustivel.find({
            "motorista_id": motorista_id,
            "$or": [
                {"semana": semana, "ano": ano},
                {"data": {"$gte": data_inicio, "$lte": data_fim}}
            ]
        }, {"_id": 0, "valor_total": 1}).to_list(100)
        eletrico = sum(float(r.get("valor_total") or 0) for r in elet_records)
        
        aluguer = float(m.get("valor_aluguer_semanal") or 0)
        
        # Extras
        extras_records = await db.extras_motorista.find({
            "motorista_id": motorista_id,
            "$or": [
                {"semana": semana, "ano": ano},
                {"data": {"$gte": data_inicio, "$lte": data_fim}}
            ]
        }, {"_id": 0, "valor": 1}).to_list(100)
        extras = sum(float(r.get("valor") or 0) for r in extras_records)
        
        liquido = ganhos_uber + ganhos_bolt - via_verde - combustivel - eletrico - aluguer
        
        motoristas_data.append({
            "nome": m.get("name", ""),
            "uber": ganhos_uber,
            "bolt": ganhos_bolt,
            "via_verde": via_verde,
            "combustivel": combustivel,
            "eletrico": eletrico,
            "aluguer": aluguer,
            "extras": extras,
            "liquido": liquido
        })
        
        totais["ganhos_uber"] += ganhos_uber
        totais["ganhos_bolt"] += ganhos_bolt
        totais["via_verde"] += via_verde
        totais["combustivel"] += combustivel
        totais["eletrico"] += eletrico
        totais["aluguer"] += aluguer
        totais["extras"] += extras
    
    totais["liquido"] = (
        totais["ganhos_uber"] + totais["ganhos_bolt"] - 
        totais["via_verde"] - totais["combustivel"] - totais["eletrico"] - totais["aluguer"]
    )
    
    # Gerar PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.grey)
    
    elements = []
    
    # Título
    elements.append(Paragraph(f"Resumo Semanal do Parceiro", title_style))
    elements.append(Paragraph(f"Semana {semana}/{ano} ({week_start.strftime('%d/%m/%Y')} a {week_end.strftime('%d/%m/%Y')})", subtitle_style))
    elements.append(Spacer(1, 10*mm))
    
    # Tabela de motoristas
    table_data = [
        ["Motorista", "Uber", "Bolt", "Via Verde", "Comb.", "Elétr.", "Aluguer", "Extras", "Líquido"]
    ]
    
    for m in sorted(motoristas_data, key=lambda x: x["nome"]):
        table_data.append([
            m["nome"][:20],
            f"€{m['uber']:.2f}",
            f"€{m['bolt']:.2f}",
            f"€{m['via_verde']:.2f}",
            f"€{m['combustivel']:.2f}",
            f"€{m['eletrico']:.2f}",
            f"€{m['aluguer']:.2f}",
            f"€{m['extras']:.2f}",
            f"€{m['liquido']:.2f}"
        ])
    
    # Linha de totais
    table_data.append([
        "TOTAIS",
        f"€{totais['ganhos_uber']:.2f}",
        f"€{totais['ganhos_bolt']:.2f}",
        f"€{totais['via_verde']:.2f}",
        f"€{totais['combustivel']:.2f}",
        f"€{totais['eletrico']:.2f}",
        f"€{totais['aluguer']:.2f}",
        f"€{totais['extras']:.2f}",
        f"€{totais['liquido']:.2f}"
    ])
    
    col_widths = [45*mm, 18*mm, 18*mm, 20*mm, 18*mm, 18*mm, 18*mm, 18*mm, 20*mm]
    table = Table(table_data, colWidths=col_widths)
    
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f4fc')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f9f9f9')]),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 10*mm))
    
    # Resumo
    receitas = totais["aluguer"] + totais["extras"]
    despesas = totais["via_verde"] + totais["combustivel"] + totais["eletrico"]
    liquido_parceiro = receitas - despesas
    
    summary_data = [
        ["Receitas do Parceiro", f"€{receitas:.2f}"],
        ["  Aluguer", f"€{totais['aluguer']:.2f}"],
        ["  Extras", f"€{totais['extras']:.2f}"],
        ["Despesas Operacionais", f"€{despesas:.2f}"],
        ["  Via Verde", f"€{totais['via_verde']:.2f}"],
        ["  Combustível", f"€{totais['combustivel']:.2f}"],
        ["  Elétrico", f"€{totais['eletrico']:.2f}"],
        ["LÍQUIDO PARCEIRO", f"€{liquido_parceiro:.2f}"],
    ]
    
    summary_table = Table(summary_data, colWidths=[80*mm, 40*mm])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 3), (0, 3), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#d4edda') if liquido_parceiro >= 0 else colors.HexColor('#f8d7da')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    
    elements.append(summary_table)
    
    # Rodapé
    elements.append(Spacer(1, 15*mm))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=colors.grey)
    elements.append(Paragraph(f"Gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')} - TVDEFleet", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=resumo_semanal_S{semana}_{ano}.pdf"
        }
    )


@router.get("/importacoes/historico")
async def get_historico_importacoes(
    semana: Optional[int] = None,
    ano: Optional[int] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Retorna o histórico de importações com resumo por plataforma.
    Pode filtrar por semana/ano ou por período de datas.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build date range
    if semana and ano:
        # Calculate date range for the week
        first_day_of_year = datetime(ano, 1, 1)
        if first_day_of_year.weekday() <= 3:
            first_monday = first_day_of_year - timedelta(days=first_day_of_year.weekday())
        else:
            first_monday = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
        
        week_start = first_monday + timedelta(weeks=semana - 1)
        week_end = week_start + timedelta(days=6)
        
        data_inicio = week_start.strftime("%Y-%m-%d")
        data_fim = week_end.strftime("%Y-%m-%d")
    elif not data_inicio or not data_fim:
        # Default to current week
        now = datetime.now()
        semana = now.isocalendar()[1]
        ano = now.year
        first_day_of_year = datetime(ano, 1, 1)
        if first_day_of_year.weekday() <= 3:
            first_monday = first_day_of_year - timedelta(days=first_day_of_year.weekday())
        else:
            first_monday = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
        
        week_start = first_monday + timedelta(weeks=semana - 1)
        week_end = week_start + timedelta(days=6)
        
        data_inicio = week_start.strftime("%Y-%m-%d")
        data_fim = week_end.strftime("%Y-%m-%d")
    
    logger.info(f"📋 Histórico importações: {data_inicio} a {data_fim}")
    
    # Build parceiro filter based on motoristas and their vehicles
    parceiro_motorista_ids = []
    parceiro_veiculo_ids = []
    parceiro_matriculas = []
    
    if current_user["role"] == UserRole.PARCEIRO:
        # Get motoristas of this parceiro
        motoristas = await db.motoristas.find(
            {"$or": [
                {"parceiro_id": current_user["id"]},
                {"parceiro_atribuido": current_user["id"]}
            ]},
            {"_id": 0, "id": 1, "veiculo_atribuido": 1}
        ).to_list(1000)
        parceiro_motorista_ids = [m["id"] for m in motoristas]
        parceiro_veiculo_ids = [m["veiculo_atribuido"] for m in motoristas if m.get("veiculo_atribuido")]
        
        # Get matriculas for these vehicles
        if parceiro_veiculo_ids:
            veiculos = await db.vehicles.find(
                {"id": {"$in": parceiro_veiculo_ids}},
                {"_id": 0, "id": 1, "matricula": 1}
            ).to_list(1000)
            parceiro_matriculas = [v["matricula"] for v in veiculos if v.get("matricula")]
        
        logger.info(f"📋 Parceiro tem {len(parceiro_motorista_ids)} motoristas, {len(parceiro_veiculo_ids)} veículos, {len(parceiro_matriculas)} matrículas")
    
    importacoes = []
    resumo_por_plataforma = {
        "uber": {"total": 0, "registos": 0, "ficheiros": 0},
        "bolt": {"total": 0, "registos": 0, "ficheiros": 0},
        "viaverde": {"total": 0, "registos": 0, "ficheiros": 0},
        "combustivel": {"total": 0, "registos": 0, "ficheiros": 0},
        "eletrico": {"total": 0, "registos": 0, "ficheiros": 0}
    }
    
    # ===== UBER =====
    uber_query = {
        "$or": [
            {"semana": semana, "ano": ano} if semana and ano else {},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    }
    uber_query["$or"] = [q for q in uber_query["$or"] if q]
    if parceiro_motorista_ids:
        uber_query["motorista_id"] = {"$in": parceiro_motorista_ids}
    if not uber_query["$or"]:
        uber_query.pop("$or")
    
    uber_records = await db.ganhos_uber.find(uber_query, {"_id": 0}).to_list(1000)
    
    # Group by ficheiro_nome
    uber_by_file = {}
    for r in uber_records:
        fname = r.get("ficheiro_nome", "uber_import")
        if fname not in uber_by_file:
            uber_by_file[fname] = {
                "plataforma": "uber",
                "ficheiro_nome": fname,
                "data_importacao": r.get("created_at") or r.get("data_importacao"),
                "total_registos": 0,
                "total_valor": 0,
                "semana": r.get("semana"),
                "ano": r.get("ano")
            }
        uber_by_file[fname]["total_registos"] += 1
        uber_by_file[fname]["total_valor"] += float(r.get("pago_total") or r.get("ganhos") or 0)
    
    for f in uber_by_file.values():
        importacoes.append(f)
        resumo_por_plataforma["uber"]["total"] += f["total_valor"]
        resumo_por_plataforma["uber"]["registos"] += f["total_registos"]
        resumo_por_plataforma["uber"]["ficheiros"] += 1
    
    # ===== BOLT =====
    bolt_query = {
        "$or": [
            {"periodo_semana": semana, "periodo_ano": ano} if semana and ano else {},
            {"semana": semana, "ano": ano} if semana and ano else {},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    }
    bolt_query["$or"] = [q for q in bolt_query["$or"] if q]
    if not bolt_query["$or"]:
        bolt_query.pop("$or")
    if parceiro_motorista_ids:
        bolt_query["motorista_id"] = {"$in": parceiro_motorista_ids}
    
    bolt_records = await db.ganhos_bolt.find(bolt_query, {"_id": 0}).to_list(1000)
    
    bolt_by_file = {}
    for r in bolt_records:
        fname = r.get("ficheiro_nome", "bolt_import")
        if fname not in bolt_by_file:
            bolt_by_file[fname] = {
                "plataforma": "bolt",
                "ficheiro_nome": fname,
                "data_importacao": r.get("created_at") or r.get("data_importacao"),
                "total_registos": 0,
                "total_valor": 0,
                "semana": r.get("periodo_semana") or r.get("semana"),
                "ano": r.get("periodo_ano") or r.get("ano")
            }
        bolt_by_file[fname]["total_registos"] += 1
        bolt_by_file[fname]["total_valor"] += float(r.get("ganhos_liquidos") or r.get("ganhos") or 0)
    
    for f in bolt_by_file.values():
        importacoes.append(f)
        resumo_por_plataforma["bolt"]["total"] += f["total_valor"]
        resumo_por_plataforma["bolt"]["registos"] += f["total_registos"]
        resumo_por_plataforma["bolt"]["ficheiros"] += 1
    
    # ===== VIA VERDE =====
    # Para Via Verde, filtrar por período E por veículos/matrículas do parceiro
    vv_date_filter = {"$or": [
        {"semana": semana, "ano": ano} if semana and ano else {},
        {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}}
    ]}
    vv_date_filter["$or"] = [q for q in vv_date_filter["$or"] if q]
    
    vv_query = {}
    if vv_date_filter.get("$or"):
        vv_query = vv_date_filter
    
    # Filter by motorista_id, vehicle_id, or matricula
    if parceiro_motorista_ids or parceiro_veiculo_ids or parceiro_matriculas:
        vv_filter_conditions = []
        if parceiro_motorista_ids:
            vv_filter_conditions.append({"motorista_id": {"$in": parceiro_motorista_ids}})
        if parceiro_veiculo_ids:
            vv_filter_conditions.append({"vehicle_id": {"$in": parceiro_veiculo_ids}})
        if parceiro_matriculas:
            vv_filter_conditions.append({"matricula": {"$in": parceiro_matriculas}})
        
        if vv_filter_conditions:
            # Combine date filter AND parceiro filter
            if vv_query:
                vv_query = {
                    "$and": [
                        vv_query,
                        {"$or": vv_filter_conditions}
                    ]
                }
            else:
                vv_query = {"$or": vv_filter_conditions}
    
    vv_records = await db.portagens_viaverde.find(vv_query, {"_id": 0}).to_list(5000)
    
    vv_by_file = {}
    for r in vv_records:
        fname = r.get("ficheiro_nome", "viaverde_import")
        if fname not in vv_by_file:
            vv_by_file[fname] = {
                "plataforma": "viaverde",
                "ficheiro_nome": fname,
                "data_importacao": r.get("created_at") or r.get("data_importacao"),
                "total_registos": 0,
                "total_valor": 0,
                "semana": r.get("semana") or semana,
                "ano": r.get("ano") or ano
            }
        vv_by_file[fname]["total_registos"] += 1
        vv_by_file[fname]["total_valor"] += float(r.get("liquid_value") or r.get("value") or 0)
    
    for f in vv_by_file.values():
        importacoes.append(f)
        resumo_por_plataforma["viaverde"]["total"] += f["total_valor"]
        resumo_por_plataforma["viaverde"]["registos"] += f["total_registos"]
        resumo_por_plataforma["viaverde"]["ficheiros"] += 1
    
    # ===== COMBUSTÍVEL =====
    comb_query = {
        "data": {"$gte": data_inicio, "$lte": data_fim}
    }
    
    # Filter by motorista_id, vehicle_id, or matricula
    if parceiro_motorista_ids or parceiro_veiculo_ids or parceiro_matriculas:
        comb_filter_conditions = []
        if parceiro_motorista_ids:
            comb_filter_conditions.append({"motorista_id": {"$in": parceiro_motorista_ids}})
        if parceiro_veiculo_ids:
            comb_filter_conditions.append({"vehicle_id": {"$in": parceiro_veiculo_ids}})
        if parceiro_matriculas:
            comb_filter_conditions.append({"matricula": {"$in": parceiro_matriculas}})
        
        if comb_filter_conditions:
            comb_query = {
                "$and": [
                    {"data": {"$gte": data_inicio, "$lte": data_fim}},
                    {"$or": comb_filter_conditions}
                ]
            }
    
    comb_records = await db.abastecimentos_combustivel.find(comb_query, {"_id": 0}).to_list(1000)
    
    comb_by_file = {}
    for r in comb_records:
        fname = r.get("ficheiro_nome", "combustivel_import")
        if fname not in comb_by_file:
            comb_by_file[fname] = {
                "plataforma": "combustivel",
                "ficheiro_nome": fname,
                "data_importacao": r.get("created_at") or r.get("data_importacao"),
                "total_registos": 0,
                "total_valor": 0,
                "semana": semana,
                "ano": ano
            }
        comb_by_file[fname]["total_registos"] += 1
        comb_by_file[fname]["total_valor"] += float(r.get("valor_liquido") or r.get("total") or 0)
    
    for f in comb_by_file.values():
        importacoes.append(f)
        resumo_por_plataforma["combustivel"]["total"] += f["total_valor"]
        resumo_por_plataforma["combustivel"]["registos"] += f["total_registos"]
        resumo_por_plataforma["combustivel"]["ficheiros"] += 1
    
    # ===== ELÉTRICO =====
    elet_query = {
        "$or": [
            {"semana": semana, "ano": ano} if semana and ano else {},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    }
    elet_query["$or"] = [q for q in elet_query["$or"] if q]
    if not elet_query["$or"]:
        elet_query.pop("$or")
    
    # Filter by motorista_id, vehicle_id, or matricula
    if parceiro_motorista_ids or parceiro_veiculo_ids or parceiro_matriculas:
        elet_filter_conditions = []
        if parceiro_motorista_ids:
            elet_filter_conditions.append({"motorista_id": {"$in": parceiro_motorista_ids}})
        if parceiro_veiculo_ids:
            elet_filter_conditions.append({"vehicle_id": {"$in": parceiro_veiculo_ids}})
        if parceiro_matriculas:
            elet_filter_conditions.append({"matricula": {"$in": parceiro_matriculas}})
        if elet_filter_conditions:
            if "$or" in elet_query:
                # Combine with existing $or
                elet_query = {
                    "$and": [
                        {"$or": elet_query["$or"]},
                        {"$or": elet_filter_conditions}
                    ]
                }
            else:
                elet_query["$or"] = elet_filter_conditions
    
    elet_records = await db.despesas_combustivel.find(elet_query, {"_id": 0}).to_list(1000)
    
    elet_by_file = {}
    for r in elet_records:
        fname = r.get("ficheiro_nome", "eletrico_import")
        if fname not in elet_by_file:
            elet_by_file[fname] = {
                "plataforma": "eletrico",
                "ficheiro_nome": fname,
                "data_importacao": r.get("created_at") or r.get("data_importacao"),
                "total_registos": 0,
                "total_valor": 0,
                "semana": r.get("semana") or semana,
                "ano": r.get("ano") or ano
            }
        elet_by_file[fname]["total_registos"] += 1
        elet_by_file[fname]["total_valor"] += float(r.get("valor_total") or r.get("TotalValueWithTaxes") or 0)
    
    for f in elet_by_file.values():
        importacoes.append(f)
        resumo_por_plataforma["eletrico"]["total"] += f["total_valor"]
        resumo_por_plataforma["eletrico"]["registos"] += f["total_registos"]
        resumo_por_plataforma["eletrico"]["ficheiros"] += 1
    
    # Sort by date (convert all dates to strings for consistent sorting)
    def get_sort_key(x):
        d = x.get("data_importacao")
        if d is None:
            return ""
        if isinstance(d, datetime):
            return d.isoformat()
        return str(d)
    
    importacoes.sort(key=get_sort_key, reverse=True)
    
    # Round values
    for plat in resumo_por_plataforma:
        resumo_por_plataforma[plat]["total"] = round(resumo_por_plataforma[plat]["total"], 2)
    
    return {
        "importacoes": importacoes,
        "resumo_por_plataforma": resumo_por_plataforma,
        "filtro": {
            "semana": semana,
            "ano": ano,
            "data_inicio": data_inicio,
            "data_fim": data_fim
        }
    }
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
    Uses portagens_viaverde collection.
    
    REGRAS DE NEGÓCIO:
    - Excluir transações onde market_description = "portagens" ou "parques"
    - Usar liquid_value para a soma
    - Sem atraso de semanas (dados da semana X para relatório da semana X)
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # NOTA: via_verde_atraso = 0 (sem atraso - relatório semana X usa dados da semana X)
    via_verde_atraso = 0
    
    # Calculate the data week (sem atraso)
    semana_via_verde = semana
    ano_via_verde = ano
    
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
    # REGRA DE NEGÓCIO: 
    # 1. APENAS documentos que têm market_description preenchido (importação nova)
    # 2. INCLUIR APENAS transações onde market_description = "portagens" ou "parques"
    filtered_portagens = []
    included_market_descriptions = {"portagens", "parques"}
    
    for p in portagens:
        # Verificar market_description - OBRIGATÓRIO para novos dados
        market_desc = str(p.get("market_description", "")).strip().lower()
        
        # Se não houver market_description, ignorar (dados antigos sem este campo)
        if not market_desc:
            continue
        
        # Se houver market_description, só incluir se for "portagens" ou "parques"
        if market_desc not in included_market_descriptions:
            logger.debug(f"📍 Excluído: {p.get('entry_point')} → {p.get('exit_point')} (market_description={market_desc})")
            continue
        
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
        "semana_referencia": f"Semana {semana_via_verde}/{ano_via_verde}",
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



# ==================== ENVIO DE RELATÓRIOS (WhatsApp + Email) ====================

@router.post("/enviar-relatorio/{motorista_id}")
async def enviar_relatorio_para_motorista(
    motorista_id: str,
    semana: int,
    ano: int,
    enviar_email: bool = True,
    enviar_whatsapp: bool = True,
    background_tasks: BackgroundTasks = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Envia relatório semanal para um motorista específico via Email e/ou WhatsApp.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Buscar dados do motorista
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Verificar se parceiro tem acesso a este motorista
    if current_user["role"] == UserRole.PARCEIRO:
        parceiro_id = current_user["id"]
        if motorista.get("parceiro_id") != parceiro_id and motorista.get("parceiro_atribuido") != parceiro_id:
            raise HTTPException(status_code=403, detail="Não autorizado para este motorista")
    
    # Buscar resumo semanal deste motorista
    # Calcular datas da semana
    first_day_of_year = datetime(ano, 1, 1)
    if first_day_of_year.weekday() <= 3:
        first_monday = first_day_of_year - timedelta(days=first_day_of_year.weekday())
    else:
        first_monday = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
    
    week_start = first_monday + timedelta(weeks=semana - 1)
    week_end = week_start + timedelta(days=6)
    data_inicio = week_start.strftime("%Y-%m-%d")
    data_fim = week_end.strftime("%Y-%m-%d")
    
    # Construir dados do relatório
    veiculo = None
    if motorista.get("veiculo_atribuido"):
        veiculo = await db.vehicles.find_one({"id": motorista["veiculo_atribuido"]}, {"_id": 0})
    
    # Buscar ganhos Uber
    ganhos_uber = 0.0
    uber_records = await db.ganhos_uber.find({
        "motorista_id": motorista_id,
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    }, {"_id": 0}).to_list(100)
    ganhos_uber = sum(float(r.get("pago_total") or 0) for r in uber_records)
    
    # Buscar ganhos Bolt
    ganhos_bolt = 0.0
    bolt_records = await db.ganhos_bolt.find({
        "motorista_id": motorista_id,
        "$or": [
            {"periodo_semana": semana, "periodo_ano": ano},
            {"semana": semana, "ano": ano}
        ]
    }, {"_id": 0}).to_list(100)
    ganhos_bolt = sum(float(r.get("ganhos_liquidos") or 0) for r in bolt_records)
    
    # Buscar despesas
    combustivel = 0.0
    eletrico = 0.0
    via_verde = 0.0
    
    if veiculo:
        matricula = veiculo.get("matricula")
        veiculo_id = veiculo.get("id")
        
        # Via Verde
        vv_records = await db.portagens_viaverde.find({
            "$or": [{"motorista_id": motorista_id}, {"matricula": matricula}],
            "entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}
        }, {"_id": 0}).to_list(500)
        via_verde = sum(float(r.get("liquid_value") or 0) for r in vv_records)
        
        # Combustível
        comb_records = await db.abastecimentos_combustivel.find({
            "$or": [{"motorista_id": motorista_id}, {"matricula": matricula}],
            "data": {"$gte": data_inicio, "$lte": data_fim}
        }, {"_id": 0}).to_list(100)
        combustivel = sum(float(r.get("valor_liquido") or 0) for r in comb_records)
        
        # Elétrico
        elet_records = await db.despesas_combustivel.find({
            "motorista_id": motorista_id,
            "$or": [
                {"semana": semana, "ano": ano},
                {"data": {"$gte": data_inicio, "$lte": data_fim}}
            ]
        }, {"_id": 0}).to_list(100)
        eletrico = sum(float(r.get("valor_total") or 0) for r in elet_records)
    
    total_ganhos = ganhos_uber + ganhos_bolt
    total_despesas = combustivel + via_verde + eletrico
    valor_liquido = total_ganhos - total_despesas
    
    motorista_data = {
        "motorista_id": motorista_id,
        "motorista_nome": motorista.get("name"),
        "motorista_email": motorista.get("email"),
        "motorista_telefone": motorista.get("telefone") or motorista.get("phone"),
        "veiculo_matricula": veiculo.get("matricula") if veiculo else None,
        "ganhos_uber": ganhos_uber,
        "ganhos_bolt": ganhos_bolt,
        "total_ganhos": total_ganhos,
        "combustivel": combustivel,
        "carregamento_eletrico": eletrico,
        "via_verde": via_verde,
        "total_despesas_operacionais": total_despesas,
        "valor_liquido_motorista": valor_liquido
    }
    
    # Enviar relatório
    result = await enviar_relatorio_motorista(motorista_data, semana, ano, enviar_email, enviar_whatsapp)
    
    return result


@router.get("/gerar-link-whatsapp/{motorista_id}")
async def gerar_link_whatsapp_motorista(
    motorista_id: str,
    semana: int,
    ano: int,
    current_user: Dict = Depends(get_current_user)
):
    """
    Gera link do WhatsApp para enviar relatório manualmente.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Buscar motorista
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    telefone = motorista.get("telefone") or motorista.get("phone")
    if not telefone:
        raise HTTPException(status_code=400, detail="Motorista não tem telefone cadastrado")
    
    # Criar resumo simplificado para WhatsApp
    # Calcular datas da semana
    first_day_of_year = datetime(ano, 1, 1)
    if first_day_of_year.weekday() <= 3:
        first_monday = first_day_of_year - timedelta(days=first_day_of_year.weekday())
    else:
        first_monday = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
    
    week_start = first_monday + timedelta(weeks=semana - 1)
    week_end = week_start + timedelta(days=6)
    data_inicio = week_start.strftime("%Y-%m-%d")
    data_fim = week_end.strftime("%Y-%m-%d")
    
    # Buscar dados básicos
    veiculo = None
    if motorista.get("veiculo_atribuido"):
        veiculo = await db.vehicles.find_one({"id": motorista["veiculo_atribuido"]}, {"_id": 0})
    
    # Ganhos
    uber_records = await db.ganhos_uber.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0}).to_list(100)
    ganhos_uber = sum(float(r.get("pago_total") or 0) for r in uber_records)
    
    bolt_records = await db.ganhos_bolt.find({
        "motorista_id": motorista_id,
        "$or": [{"periodo_semana": semana, "periodo_ano": ano}, {"semana": semana, "ano": ano}]
    }, {"_id": 0}).to_list(100)
    ganhos_bolt = sum(float(r.get("ganhos_liquidos") or 0) for r in bolt_records)
    
    motorista_data = {
        "motorista_nome": motorista.get("name"),
        "veiculo_matricula": veiculo.get("matricula") if veiculo else "N/A",
        "ganhos_uber": ganhos_uber,
        "ganhos_bolt": ganhos_bolt,
        "total_ganhos": ganhos_uber + ganhos_bolt,
        "combustivel": 0,
        "carregamento_eletrico": 0,
        "via_verde": 0,
        "total_despesas_operacionais": 0,
        "valor_liquido_motorista": ganhos_uber + ganhos_bolt
    }
    
    # Gerar mensagem
    message = generate_relatorio_motorista_text(motorista_data, semana, ano)
    
    # Gerar link
    whatsapp_link = generate_whatsapp_link(telefone, message)
    
    return {
        "motorista_nome": motorista.get("name"),
        "telefone": telefone,
        "whatsapp_link": whatsapp_link,
        "semana": semana,
        "ano": ano
    }


@router.post("/enviar-relatorios-em-massa")
async def enviar_relatorios_em_massa(
    semana: int,
    ano: int,
    enviar_email: bool = True,
    enviar_whatsapp: bool = False,
    background_tasks: BackgroundTasks = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Envia relatórios semanais para todos os motoristas do parceiro.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Buscar motoristas
    motoristas_query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        motoristas_query["$or"] = [
            {"parceiro_id": current_user["id"]},
            {"parceiro_atribuido": current_user["id"]}
        ]
    
    motoristas = await db.motoristas.find(motoristas_query, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(1000)
    
    results = {
        "total_motoristas": len(motoristas),
        "emails_enviados": 0,
        "whatsapp_links_gerados": 0,
        "erros": [],
        "detalhes": []
    }
    
    for motorista in motoristas:
        try:
            # Chamar endpoint individual
            # (simplificado - em produção usar background tasks)
            result = await enviar_relatorio_para_motorista(
                motorista["id"], semana, ano, enviar_email, enviar_whatsapp, None, current_user
            )
            
            if result.get("email", {}).get("enviado"):
                results["emails_enviados"] += 1
            if result.get("whatsapp", {}).get("link"):
                results["whatsapp_links_gerados"] += 1
            
            results["detalhes"].append({
                "motorista": motorista.get("name"),
                "resultado": result
            })
        except Exception as e:
            results["erros"].append({
                "motorista": motorista.get("name"),
                "erro": str(e)
            })
    
    return results
