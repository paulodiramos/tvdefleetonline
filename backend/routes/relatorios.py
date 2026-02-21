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
    send_email_smtp
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/relatorios", tags=["relatorios"])

db = get_database()

def calcular_aluguer_semanal(veiculo: dict, semana: int, ano: int) -> float:
    """
    Calcula o valor do aluguer semanal baseado no tipo de contrato e época.
    
    Args:
        veiculo: Dicionário com dados do veículo
        semana: Número da semana (1-53)
        ano: Ano
    
    Returns:
        Valor do aluguer semanal
    """
    if not veiculo:
        return 0.0
    
    tipo_contrato = veiculo.get("tipo_contrato", {})
    if not tipo_contrato:
        # Fallback para campos no nível raiz do veículo
        return float(veiculo.get("valor_aluguer_semanal") or veiculo.get("valor_semanal") or 0)
    
    # Verificar se é contrato de aluguer
    tipo = tipo_contrato.get("tipo", "").lower()
    if tipo == "comissao":
        return 0.0  # Contrato de comissão não tem aluguer
    
    # Obter o mês correspondente à semana
    from datetime import datetime, timedelta
    # Calcular a data do início da semana
    primeiro_dia_ano = datetime(ano, 1, 1)
    dias_ate_segunda = (7 - primeiro_dia_ano.weekday()) % 7
    primeira_segunda = primeiro_dia_ano + timedelta(days=dias_ate_segunda)
    data_semana = primeira_segunda + timedelta(weeks=semana - 1)
    mes_semana = data_semana.month
    
    # Verificar se tem época alta/baixa configurada
    meses_epoca_alta = tipo_contrato.get("meses_epoca_alta", [])
    valor_epoca_alta = float(tipo_contrato.get("valor_epoca_alta") or 0)
    valor_epoca_baixa = float(tipo_contrato.get("valor_epoca_baixa") or 0)
    valor_padrao = float(tipo_contrato.get("valor_aluguer") or tipo_contrato.get("valor_semanal") or 0)
    
    # Se tem configuração de épocas
    if meses_epoca_alta and (valor_epoca_alta > 0 or valor_epoca_baixa > 0):
        if mes_semana in meses_epoca_alta:
            return valor_epoca_alta if valor_epoca_alta > 0 else valor_padrao
        else:
            return valor_epoca_baixa if valor_epoca_baixa > 0 else valor_padrao
    
    # Fallback para valor padrão
    return valor_padrao

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
    # Combina identificação do motorista com período
    uber_query = {
        "$and": [
            # Identificação do motorista (pelo menos uma deve corresponder)
            {"$or": [
                {"motorista_id": motorista_id},
                {"email_motorista": motorista.get("email")},
                {"email": motorista.get("email")},
                {"uuid_motorista": motorista.get("uuid_motorista_uber")}
            ]},
            # Período (pelo menos uma deve corresponder)
            {"$or": [
                {"data": {"$gte": data_inicio, "$lte": data_fim}},
                {"periodo_inicio": {"$gte": data_inicio, "$lte": data_fim}},
                {"$and": [{"semana": semana}, {"ano": ano}]}
            ]}
        ]
    }
    
    # 1. Check ganhos_uber collection (main import collection)
    ganhos_uber_records = await db.ganhos_uber.find(uber_query, {"_id": 0}).to_list(1000)
    for record in ganhos_uber_records:
        total_ganhos_uber += record.get("rendimentos", 0) or record.get("pago_total", 0) or record.get("rendimentos_total", 0) or record.get("ganhos", 0) or 0
        total_viagens_uber += record.get("viagens", 1)
    
    # 2. Check dados_uber collection (fallback/legacy)
    dados_uber_records = await db.dados_uber.find(uber_query, {"_id": 0}).to_list(1000)
    for record in dados_uber_records:
        total_ganhos_uber += record.get("rendimentos", 0) or record.get("pago_total", 0) or record.get("rendimentos_total", 0) or 0
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
        # Use ganhos field (que inclui campanha) ou ganhos_liquidos + ganhos_campanha
        ganhos_base = record.get("ganhos_liquidos", 0) or 0
        ganhos_campanha = record.get("ganhos_campanha", 0) or 0
        ganhos_total = record.get("ganhos", 0) or (ganhos_base + ganhos_campanha)
        total_ganhos_bolt += ganhos_total or record.get("earnings", 0) or 0
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
        # Construir query com OR para incluir vehicle_id E motorista_id
        or_conditions = []
        if veiculo_id:
            or_conditions.append({"vehicle_id": veiculo_id})
        if motorista_id:
            or_conditions.append({"motorista_id": motorista_id})
        
        if or_conditions:
            comb_query_new = {
                "$or": or_conditions,
                "data": {"$gte": data_inicio, "$lte": data_fim}
            }
            new_records = await db.abastecimentos_combustivel.find(comb_query_new, {"_id": 0}).to_list(1000)
            for r in new_records:
                valor = r.get("valor_total", 0) or r.get("valor", 0) or r.get("valor_liquido", 0) or 0
                total_combustivel += valor
                combustivel_records.append({
                    "data": r.get("data"),
                    "valor": valor,
                    "posto": r.get("posto", ""),
                    "combustivel": r.get("combustivel", ""),
                    "litros": r.get("litros", 0),
                    "tipo": "importado",
                    "veiculo_id": r.get("vehicle_id"),
                    "motorista_id": r.get("motorista_id")
                })
    
    # Get carregamentos elétricos data
    total_eletrico = 0.0
    eletrico_records = []
    if config.get("incluir_eletrico", True):
        # Construir query com OR para incluir vehicle_id E motorista_id
        or_conditions_elet = []
        if veiculo_id:
            or_conditions_elet.append({"vehicle_id": veiculo_id})
        if motorista_id:
            or_conditions_elet.append({"motorista_id": motorista_id})
        
        if or_conditions_elet:
            elet_query = {
                "$or": or_conditions_elet,
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
                    "tipo": "carregamento_eletrico",
                    "veiculo_id": r.get("vehicle_id"),
                    "motorista_id": r.get("motorista_id")
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
        # Construir condições de associação: motorista_id OU vehicle_id OU matrícula do veículo
        associacao_conditions = [{"motorista_id": motorista_id}]
        if veiculo_id:
            associacao_conditions.append({"vehicle_id": veiculo_id})
        
        # Se temos veículo, buscar também pela matrícula
        if veiculo and veiculo.get("matricula"):
            matricula_veiculo = veiculo.get("matricula", "").upper().replace(" ", "")
            associacao_conditions.append({"matricula": matricula_veiculo})
            # Também aceitar variações da matrícula (com/sem traços)
            matricula_sem_tracos = matricula_veiculo.replace("-", "")
            if matricula_sem_tracos != matricula_veiculo:
                associacao_conditions.append({"matricula": matricula_sem_tracos})
        
        portagens_vv_query = {
            "$or": associacao_conditions,
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
            
            valor = float(pv.get("valor") or pv.get("value") or 0)
            via_verde_records.append({
                "data": pv.get("entry_date") or pv.get("data"),
                "data_detalhe": pv.get("data_detalhe", ""),
                "hora_detalhe": pv.get("hora_detalhe", ""),
                "valor": valor,
                "local": f"{pv.get('entry_point', '')} → {pv.get('exit_point', '')}",
                "exit_point": pv.get("exit_point", ""),
                "entry_point": pv.get("entry_point", ""),
                "exit_date": pv.get("exit_date", ""),
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
                "data_detalhe": desp.get("data_detalhe", ""),
                "hora_detalhe": desp.get("hora_detalhe", ""),
                "valor": desp.get("valor_liquido", 0.0),
                "local": f"{desp.get('ponto_entrada', '')} → {desp.get('ponto_saida', '')}",
                "exit_point": desp.get("ponto_saida", ""),
                "entry_point": desp.get("ponto_entrada", ""),
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
    
    # Get all motoristas for the parceiro (only active ones)
    parceiro_id_query = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else None
    
    if parceiro_id_query:
        # Query para parceiro específico
        motoristas_query = {
            "$and": [
                # Filtro de parceiro
                {"$or": [
                    {"parceiro_id": parceiro_id_query},
                    {"parceiro_atribuido": parceiro_id_query}
                ]},
                # Filtro de status - activos ou sem status definido (legacy)
                # Verifica tanto o campo "ativo" como o campo "status"
                {"$or": [
                    # Motoristas activos (ativo=true OU status=ativo/null)
                    {"$and": [
                        {"ativo": {"$ne": False}},
                        {"status": {"$nin": ["inativo", "revoked", "desativado"]}}
                    ]},
                    {"ativo": True},
                    # Legacy - sem campos definidos
                    {"$and": [
                        {"ativo": {"$exists": False}},
                        {"status": {"$exists": False}}
                    ]},
                    # Incluir motoristas desativados se a data_desativacao for depois do início da semana
                    {"$and": [
                        {"$or": [
                            {"ativo": False},
                            {"status": {"$in": ["inativo", "revoked", "desativado"]}}
                        ]},
                        {"data_desativacao": {"$gte": data_inicio}}
                    ]}
                ]}
            ]
        }
    else:
        # Admin - todos os motoristas activos
        motoristas_query = {
            "$or": [
                # Motoristas activos
                {"$and": [
                    {"ativo": {"$ne": False}},
                    {"status": {"$nin": ["inativo", "revoked", "desativado"]}}
                ]},
                {"ativo": True},
                # Legacy
                {"$and": [
                    {"ativo": {"$exists": False}},
                    {"status": {"$exists": False}}
                ]},
                # Desativados recentemente
                {"$and": [
                    {"$or": [
                        {"ativo": False},
                        {"status": {"$in": ["inativo", "revoked", "desativado"]}}
                    ]},
                    {"data_desativacao": {"$gte": data_inicio}}
                ]}
            ]
        }
    
    logger.info(f"📊 Query motoristas: parceiro={parceiro_id_query}, data_inicio={data_inicio}")
    
    motoristas = await db.motoristas.find(
        motoristas_query, 
        {"_id": 0, "id": 1, "name": 1, "email": 1, "veiculo_atribuido": 1, 
         "uuid_motorista_uber": 1, "identificador_motorista_bolt": 1,
         "valor_aluguer_semanal": 1, "config_financeira": 1,
         "ativo": 1, "status": 1, "data_desativacao": 1, "parceiro_id": 1, "parceiro_atribuido": 1}
    ).to_list(1000)
    
    # Filtrar motoristas que estavam activos durante a semana selecionada
    # Um motorista deve aparecer se:
    # 1. Está atualmente ativo
    # 2. OU foi desativado DEPOIS do início da semana (trabalhou durante a semana)
    # 3. E não foi ativado DEPOIS do fim da semana (não era motorista ainda)
    motoristas_filtrados = []
    for m in motoristas:
        nome = m.get("name", "Sem nome")
        # CORRIGIDO: parceiro_atribuido tem prioridade sobre parceiro_id (é o campo mais recente/correcto)
        motorista_parceiro = m.get("parceiro_atribuido") or m.get("parceiro_id")
        
        # Verificar se pertence ao parceiro correcto
        if parceiro_id_query and motorista_parceiro != parceiro_id_query:
            logger.debug(f"  {nome}: Excluído - parceiro diferente ({motorista_parceiro} != {parceiro_id_query})")
            continue
        
        # Obter datas de ativação e desativação
        data_ativacao = m.get("data_ativacao") or m.get("created_at", "")
        if isinstance(data_ativacao, str) and len(data_ativacao) > 10:
            data_ativacao = data_ativacao[:10]  # Apenas YYYY-MM-DD
        
        data_desativacao = m.get("data_desativacao")
        
        # Se motorista foi criado/ativado DEPOIS do fim da semana, excluir
        if data_ativacao and data_ativacao > data_fim:
            logger.debug(f"  {nome}: Excluído - ativado em {data_ativacao} (depois de {data_fim})")
            continue
        
        # Verificar se está activo (campo ativo=True E status não é inativo/revoked)
        motorista_ativo = m.get("ativo") == True or m.get("ativo") is None
        motorista_status_inativo = m.get("status") in ["inativo", "revoked", "desativado"]
        
        # Se motorista está activo (e não tem status inactivo), incluir sempre
        if motorista_ativo and not motorista_status_inativo:
            motoristas_filtrados.append(m)
            logger.debug(f"  {nome}: Incluído - ativo")
        # Se motorista está inativo (por ativo=False OU status=inativo) mas foi desativado DURANTE ou DEPOIS da semana
        elif (not motorista_ativo or motorista_status_inativo) and data_desativacao:
            if isinstance(data_desativacao, str) and data_desativacao >= data_inicio:
                motoristas_filtrados.append(m)
                logger.info(f"  {nome}: Incluído - desativado em {data_desativacao}, trabalhou na semana {data_inicio}")
            else:
                logger.debug(f"  {nome}: Excluído - desativado em {data_desativacao} (antes de {data_inicio})")
        # Se está inativo mas não tem data de desativação, verificar se tem dados na semana
        elif (not motorista_ativo or motorista_status_inativo) and not data_desativacao:
            # Verificar se tem status_relatorio para esta semana (indica que trabalhou)
            status_semana = await db.status_relatorios.find_one({
                "motorista_id": m["id"],
                "semana": semana,
                "ano": ano
            })
            if status_semana:
                motoristas_filtrados.append(m)
                logger.info(f"  {nome}: Incluído - inativo mas tem dados para semana {semana}/{ano}")
    
    motoristas = motoristas_filtrados
    logger.info(f"📊 Encontrados {len(motoristas)} motoristas activos para parceiro {parceiro_id_query}")
    
    # Set para rastrear matrículas já processadas (evitar duplicação Via Verde)
    matriculas_processadas_viaverde = set()
    
    # Build consolidated view
    resumo_motoristas = []
    totais = {
        "total_ganhos_uber": 0,
        "total_uber_portagens": 0,  # uPort total
        "total_uber_gratificacoes": 0,  # uGrat total
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
        
        # ============ CONFIGURAÇÃO FINANCEIRA DO MOTORISTA ============
        config_financeira = motorista.get("config_financeira", {})
        acumular_viaverde = config_financeira.get("acumular_viaverde", False)
        viaverde_acumulado = config_financeira.get("viaverde_acumulado", 0)
        
        # Get vehicle info
        veiculo = None
        via_verde_id = None
        obu = None
        cartao_combustivel = None
        cartao_eletrico = None
        # Múltiplos cartões elétricos
        cartoes_eletricos = []
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
                    # Calcular aluguer com base na época alta/baixa
                    aluguer_semanal = calcular_aluguer_semanal(veiculo, semana, ano)
                
                # Recolher todos os cartões elétricos (6 fornecedores)
                if veiculo.get("cartao_prio_eletric"):
                    cartoes_eletricos.append({"fornecedor": "Prio Electric", "cartao": veiculo.get("cartao_prio_eletric")})
                if veiculo.get("cartao_prio_online"):
                    cartoes_eletricos.append({"fornecedor": "Prio Online", "cartao": veiculo.get("cartao_prio_online")})
                if veiculo.get("cartao_mio"):
                    cartoes_eletricos.append({"fornecedor": "Mio", "cartao": veiculo.get("cartao_mio")})
                if veiculo.get("cartao_galp"):
                    cartoes_eletricos.append({"fornecedor": "Galp", "cartao": veiculo.get("cartao_galp")})
                if veiculo.get("cartao_atlante"):
                    cartoes_eletricos.append({"fornecedor": "Atlante", "cartao": veiculo.get("cartao_atlante")})
                if veiculo.get("cartao_eletrico_outro"):
                    cartoes_eletricos.append({"fornecedor": veiculo.get("cartao_eletrico_outro_nome", "Outro"), "cartao": veiculo.get("cartao_eletrico_outro")})
                # Legacy - cartao_frota_eletric_id (Prio)
                if cartao_eletrico and not any(c["cartao"] == cartao_eletrico for c in cartoes_eletricos):
                    cartoes_eletricos.append({"fornecedor": "Prio Electric (legacy)", "cartao": cartao_eletrico})
        
        # ============ GANHOS UBER ============
        # Buscar por UUID ou email
        ganhos_uber = 0.0
        uber_query_conditions = [{"motorista_id": motorista_id}]
        if uuid_uber:
            uber_query_conditions.append({"uuid_motorista": uuid_uber})
            uber_query_conditions.append({"uuid_motorista_uber": uuid_uber})
        if motorista_email:
            uber_query_conditions.append({"motorista_email": motorista_email})
        
        # Adicionar nome do motorista como critério adicional (útil para importações CSV)
        if motorista.get("name"):
            motorista_name = motorista.get("name", "").upper()
            # Dividir nome em partes e tentar match parcial
            name_parts = motorista_name.split()
            for part in name_parts:
                if len(part) > 2:  # Ignorar partes muito curtas
                    uber_query_conditions.append({"nome_motorista": {"$regex": part, "$options": "i"}})
        
        # Query combinando identificação E período
        uber_query = {
            "$and": [
                {"$or": uber_query_conditions},
                {"$or": [
                    {"$and": [{"semana": semana}, {"ano": ano}]},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}},
                    {"periodo_inicio": {"$gte": data_inicio, "$lte": data_fim}}
                ]}
            ]
        }
        
        uber_records = await db.ganhos_uber.find(uber_query, {"_id": 0}).to_list(100)
        uber_portagens = 0.0  # uPort - Portagens que a Uber paga
        uber_gratificacoes = 0.0  # uGrat - Gratificações/gorjetas que a Uber paga ao motorista
        for r in uber_records:
            # Extrair portagens Uber (uPort)
            uber_portagens += float(r.get("portagens") or r.get("uber_portagens") or 0)
            # Extrair gratificações Uber (uGrat) - gorjetas, bónus, promoções
            uber_gratificacoes += float(r.get("gratificacao") or r.get("gratificacoes") or r.get("uber_gratificacoes") or r.get("gorjetas") or r.get("bonus") or 0)
            
            # Ganhos Uber = rendimentos líquidos SEM portagens e SEM gratificações
            # Valor base que entra na comissão (portagens e gratificações tratadas separadamente)
            valor_base = float(r.get("rendimentos") or r.get("pago_total") or r.get("rendimentos_total") or r.get("total_pago") or r.get("ganhos") or 0)
            
            # Se o campo 'rendimentos_sem_extras' existir, usar diretamente
            if r.get("rendimentos_sem_extras"):
                ganhos_uber += float(r.get("rendimentos_sem_extras"))
            else:
                # Subtrair portagens e gratificações do valor base para obter rendimentos líquidos
                port = float(r.get("portagens") or r.get("uber_portagens") or 0)
                grat = float(r.get("gratificacao") or r.get("gratificacoes") or r.get("uber_gratificacoes") or r.get("gorjetas") or r.get("bonus") or 0)
                ganhos_uber += valor_base - port - grat
        
        logger.info(f"  {motorista.get('name')}: Uber query returned {len(uber_records)} records, total €{ganhos_uber:.2f}, uPort €{uber_portagens:.2f}, uGrat €{uber_gratificacoes:.2f}")
        
        # ============ GANHOS BOLT ============
        ganhos_bolt = 0.0
        ganhos_campanha_bolt = 0.0  # Ganhos de campanha/bónus (não disponível via API)
        bolt_query_conditions = [{"motorista_id": motorista_id}]
        if id_bolt:
            bolt_query_conditions.append({"identificador_motorista_bolt": id_bolt})
        if motorista_email:
            bolt_query_conditions.append({"email_motorista": motorista_email})
        
        # Query para encontrar registos por semana/ano
        # Suporta múltiplos formatos: semana/ano, periodo_semana/periodo_ano, periodo_inicio
        bolt_query = {
            "$and": [
                {"$or": bolt_query_conditions},
                {"$or": [
                    {"semana": semana, "ano": ano},
                    {"periodo_semana": semana, "periodo_ano": ano},
                    {"periodo_inicio": {"$regex": f"^{data_inicio[:7]}"}},
                    {"periodo_inicio": data_inicio}
                ]}
            ]
        }
        
        # Buscar de ganhos_bolt
        bolt_records = await db.ganhos_bolt.find(bolt_query, {"_id": 0}).to_list(100)
        for r in bolt_records:
            # Nova fórmula: ganhos = ganhos_brutos - comissões (inclui gorjetas, bónus, campanhas, portagens)
            ganhos_brutos = float(r.get("ganhos_brutos_total") or r.get("total_earnings") or 0)
            comissao = float(r.get("comissoes") or r.get("comissao_bolt") or r.get("commission") or 0)
            
            if ganhos_brutos > 0 and comissao > 0:
                # Usar fórmula: brutos - comissão
                ganhos_bolt += ganhos_brutos - comissao
            else:
                # Fallback para campo ganhos_liquidos se não houver brutos/comissão
                ganhos_bolt += float(r.get("ganhos_liquidos") or r.get("ganhos") or r.get("earnings") or 0)
        
        # Buscar também de viagens_bolt (coleção alternativa)
        viagens_bolt_query = {
            "$and": [
                {"$or": [{"motorista_id": motorista_id}]},
                {"semana": semana, "ano": ano}
            ]
        }
        if id_bolt:
            viagens_bolt_query["$and"][0]["$or"].append({"identificador_motorista_bolt": id_bolt})
        
        viagens_bolt_records = await db.viagens_bolt.find(viagens_bolt_query, {"_id": 0}).to_list(100)
        for r in viagens_bolt_records:
            # Nova fórmula: ganhos = ganhos_brutos - comissão
            ganhos_brutos = float(r.get("ganhos_brutos_total") or r.get("total_earnings") or 0)
            comissao = float(r.get("comissoes") or r.get("comissao_bolt") or r.get("commission") or 0)
            
            if ganhos_brutos > 0 and comissao > 0:
                ganhos_bolt += ganhos_brutos - comissao
            else:
                ganhos_bolt += float(r.get("ganhos_liquidos") or r.get("total_ganhos") or r.get("valor_liquido") or 0)
        
        logger.info(f"  {motorista.get('name')}: Bolt query returned {len(bolt_records)} ganhos + {len(viagens_bolt_records)} viagens, total €{ganhos_bolt:.2f}")
        
        # ============ VIA VERDE ============
        via_verde_total = 0.0
        matricula_veiculo = None
        
        # Via Verde: Buscar apenas pela matrícula do veículo atribuído ao motorista
        # Evitar duplicação: se a matrícula já foi processada para outro motorista, não contar novamente
        vv_query = None
        vv_records = []
        
        if veiculo and veiculo.get("matricula"):
            matricula_veiculo = veiculo.get("matricula", "").upper().strip()
            # Normalizar matrícula (remover hífens e espaços) para buscar no Via Verde
            matricula_normalizada = matricula_veiculo.replace("-", "").replace(" ", "")
            
            # Verificar se esta matrícula já foi processada
            if matricula_normalizada in matriculas_processadas_viaverde:
                logger.info(f"  {motorista.get('name')}: Via Verde matrícula {matricula_veiculo} já processada, ignorando duplicação")
            else:
                # Marcar matrícula como processada
                matriculas_processadas_viaverde.add(matricula_normalizada)
                
                # Query com matrícula normalizada (sem hífens)
                vv_query = {
                    "$or": [
                        {"matricula": matricula_veiculo},       # Formato original com hífens
                        {"matricula": matricula_normalizada}    # Formato normalizado sem hífens
                    ],
                    "$and": [
                        {"$or": [
                            {"semana": semana, "ano": ano},
                            {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}},
                            {"data": {"$gte": data_inicio, "$lte": data_fim}}
                        ]}
                    ]
                }
        elif motorista_id:
            # Fallback: buscar por motorista_id se não tiver veículo
            vv_query = {
                "motorista_id": motorista_id,
                "$or": [
                    {"semana": semana, "ano": ano},
                    {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]
            }
        
        if vv_query:
            vv_records = await db.portagens_viaverde.find(vv_query, {"_id": 0}).to_list(1000)
        
        # Incluir:
        # 1. Registos com market_description = "portagens" ou "parques" (novos dados)
        # 2. Registos com "mensalidade" ou "mobilidade" (taxas mensais)
        # 3. Registos sem market_description (dados antigos) - assumir que são portagens
        for r in vv_records:
            market_desc = str(r.get("market_description", "")).strip().lower()
            # Se não tem market_description ou é portagens/parques/mensalidade, incluir
            if not market_desc or market_desc in ["portagens", "parques"] or "mensalidade" in market_desc or "mobilidade" in market_desc:
                via_verde_total += float(r.get("valor") or r.get("value") or 0)
        
        logger.info(f"  {motorista.get('name')}: Via Verde query returned {len(vv_records)} records, total €{via_verde_total:.2f}")
        
        # ============ COMBUSTÍVEL FÓSSIL ============
        combustivel_total = 0.0
        parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else None
        
        comb_query_conditions = [{"motorista_id": motorista_id}]
        if cartao_combustivel:
            comb_query_conditions.append({"cartao_via_verde": cartao_combustivel})
        if veiculo_id:
            comb_query_conditions.append({"vehicle_id": veiculo_id})
        if veiculo and veiculo.get("matricula"):
            comb_query_conditions.append({"matricula": veiculo.get("matricula")})
            # Para dados Prio RPA, adicionar condição de matrícula normalizada
            matricula_norm = veiculo.get("matricula", "").upper().replace(" ", "").replace("-", "")
            if matricula_norm:
                comb_query_conditions.append({"matricula_normalizada": matricula_norm})
        
        # Buscar por data OU por semana/ano
        comb_query = {
            "$and": [
                {"$or": comb_query_conditions},
                {"$or": [
                    {"data": {"$gte": data_inicio, "$lte": data_fim}},
                    {"semana": semana, "ano": ano}
                ]}
            ]
        }
        
        comb_records = await db.abastecimentos_combustivel.find(comb_query, {"_id": 0}).to_list(100)
        for r in comb_records:
            # CORRIGIDO: Incluir IVA no total de combustível
            valor_sem_iva = float(r.get("valor_liquido") or r.get("valor") or r.get("total") or 0)
            iva_valor = float(r.get("iva") or 0)
            combustivel_total += valor_sem_iva + iva_valor
        
        if comb_records:
            logger.info(f"  {motorista.get('name')}: Combustível (abastecimentos) query returned {len(comb_records)} records, total €{combustivel_total:.2f}")
        
        # ============ BUSCAR TAMBÉM DE DESPESAS_COMBUSTIVEL (dados via RPA) ============
        # Query para despesas_combustivel (dados importados via RPA da Prio - colecção diferente)
        despesas_comb_query_conditions = [{"motorista_id": motorista_id}]
        if veiculo_id:
            # Suportar ambos os nomes de campo: veiculo_id e vehicle_id
            despesas_comb_query_conditions.append({"veiculo_id": veiculo_id})
            despesas_comb_query_conditions.append({"vehicle_id": veiculo_id})
        # Buscar pelo cartão Prio associado ao veículo
        if cartao_combustivel:
            despesas_comb_query_conditions.append({"cartao": cartao_combustivel})
            despesas_comb_query_conditions.append({"cartao_frota_id": cartao_combustivel})
        if veiculo and veiculo.get("matricula"):
            despesas_comb_query_conditions.append({"matricula": veiculo.get("matricula")})
            # Para dados Prio RPA, adicionar condição de matrícula normalizada
            matricula_norm = veiculo.get("matricula", "").upper().replace(" ", "").replace("-", "")
            if matricula_norm:
                despesas_comb_query_conditions.append({"matricula_normalizada": matricula_norm})
        
        despesas_comb_query = {
            "$and": [
                {"$or": despesas_comb_query_conditions},
                {"$or": [
                    {"semana": semana, "ano": ano},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]},
                # Garantir que é combustível fóssil (litros > 0 ou kwh = 0)
                {"$or": [
                    {"litros": {"$gt": 0}},
                    {"kwh": {"$in": [0, None]}}
                ]}
            ]
        }
        
        despesas_comb_records = await db.despesas_combustivel.find(despesas_comb_query, {"_id": 0}).to_list(100)
        for r in despesas_comb_records:
            combustivel_total += float(r.get("valor_total") or r.get("valor") or 0)
        
        if despesas_comb_records:
            logger.info(f"  {motorista.get('name')}: Combustível (despesas_combustivel) query returned {len(despesas_comb_records)} records, adicionado €{sum(float(r.get('valor_total') or r.get('valor') or 0) for r in despesas_comb_records):.2f}, total €{combustivel_total:.2f}")
        
        # ============ CARREGAMENTO ELÉTRICO ============
        eletrico_total = 0.0
        eletrico_discriminacao = []  # Discriminação por fornecedor
        elet_query_conditions = [{"motorista_id": motorista_id}]
        
        # Adicionar todos os cartões elétricos às condições de busca
        for cartao_info in cartoes_eletricos:
            cartao_id = cartao_info["cartao"]
            elet_query_conditions.append({"cartao_frota_id": cartao_id})
            elet_query_conditions.append({"card_code": cartao_id})
            elet_query_conditions.append({"cartao": cartao_id})
        
        # Legacy - cartao_eletrico único
        if cartao_eletrico and not cartoes_eletricos:
            elet_query_conditions.append({"cartao_frota_id": cartao_eletrico})
            elet_query_conditions.append({"card_code": cartao_eletrico})
            elet_query_conditions.append({"cartao": cartao_eletrico})
        
        if veiculo_id:
            elet_query_conditions.append({"vehicle_id": veiculo_id})
            elet_query_conditions.append({"veiculo_id": veiculo_id})
        if veiculo and veiculo.get("matricula"):
            elet_query_conditions.append({"matricula": veiculo.get("matricula")})
            # Para dados Prio RPA, adicionar condição de matrícula normalizada
            matricula_norm = veiculo.get("matricula", "").upper().replace(" ", "").replace("-", "")
            if matricula_norm:
                elet_query_conditions.append({"matricula_normalizada": matricula_norm})
        
        elet_query = {
            "$or": elet_query_conditions,
            "$and": [
                {"$or": [
                    {"semana": semana, "ano": ano},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]}
            ]
        }
        
        # Buscar de combustivel_eletrico (carregamentos elétricos)
        elet_records = await db.combustivel_eletrico.find(elet_query, {"_id": 0}).to_list(100)
        for r in elet_records:
            valor = float(r.get("valor") or r.get("valor_total") or r.get("TotalValueWithTaxes") or 0)
            eletrico_total += valor
            fornecedor = r.get("fornecedor") or r.get("provider") or "Desconhecido"
            eletrico_discriminacao.append({"fornecedor": fornecedor, "valor": valor, "data": r.get("data")})
        
        # Buscar também de despesas_combustivel mas APENAS se tiver kWh > 0 (elétrico)
        elet_despesas_query = {
            "$and": [
                {"$or": elet_query_conditions},
                {"$or": [
                    {"semana": semana, "ano": ano},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]},
                {"kwh": {"$gt": 0}}  # APENAS registos elétricos (kWh > 0)
            ]
        }
        elet_despesas_records = await db.despesas_combustivel.find(elet_despesas_query, {"_id": 0}).to_list(100)
        for r in elet_despesas_records:
            valor = float(r.get("valor_total") or r.get("valor") or 0)
            eletrico_total += valor
            fornecedor = r.get("fornecedor") or r.get("provider") or "Desconhecido"
            eletrico_discriminacao.append({"fornecedor": fornecedor, "valor": valor, "data": r.get("data")})
        
        # Buscar de rpa_carregamento_eletrico
        rpa_elet_records = await db.rpa_carregamento_eletrico.find(elet_query, {"_id": 0}).to_list(100)
        for r in rpa_elet_records:
            valor = float(r.get("valor_total") or r.get("valor") or 0)
            eletrico_total += valor
            fornecedor = r.get("fornecedor") or r.get("provider") or "Prio Electric"
            eletrico_discriminacao.append({"fornecedor": fornecedor, "valor": valor, "data": r.get("data")})
        
        total_elet_records = len(elet_records) + len(elet_despesas_records) + len(rpa_elet_records)
        logger.info(f"  {motorista.get('name')}: Elétrico query returned {total_elet_records} records (combustivel_eletrico: {len(elet_records)}, despesas_combustivel(kWh): {len(elet_despesas_records)}, rpa: {len(rpa_elet_records)}), total €{eletrico_total:.2f}")
        
        # ============ EXTRAS DO MOTORISTA ============
        # Buscar extras (dívidas, caução parcelada, danos, etc.)
        extras_total = 0.0
        extras_query = {
            "motorista_id": motorista_id,
            "$or": [
                {"semana": semana, "ano": ano},
                {"semana": None},  # Extras sem semana específica
            ]
        }
        extras_records = await db.despesas_extras.find(extras_query, {"_id": 0}).to_list(100)
        for r in extras_records:
            # Só somar extras não pagos ou pendentes
            if r.get("status", "pendente") != "cancelado":
                valor_extra = float(r.get("valor") or 0)
                # Se for crédito, subtrair; se for débito, somar
                if r.get("tipo") == "credito":
                    extras_total -= valor_extra
                else:
                    extras_total += valor_extra
        
        logger.info(f"  {motorista.get('name')}: Extras query returned {len(extras_records)} records, total €{extras_total:.2f}")
        
        # ============ OBTER DADOS DO CONTRATO ============
        tipo_contrato_veiculo = None
        
        if veiculo:
            tipo_contrato_veiculo = veiculo.get("tipo_contrato_veiculo", "aluguer")
        
        # ============ VERIFICAR AJUSTES MANUAIS ============
        ajuste_manual = await db.ajustes_semanais.find_one(
            {"motorista_id": motorista_id, "semana": semana, "ano": ano},
            {"_id": 0}
        )
        
        has_manual_adjustment = False
        if ajuste_manual:
            has_manual_adjustment = True
            # Substituir valores pelos valores do ajuste manual
            ganhos_uber = ajuste_manual.get("ganhos_uber", ganhos_uber)
            uber_portagens = ajuste_manual.get("uber_portagens", uber_portagens)
            uber_gratificacoes = ajuste_manual.get("uber_gratificacoes", uber_gratificacoes)
            ganhos_bolt = ajuste_manual.get("ganhos_bolt", ganhos_bolt)
            ganhos_campanha_bolt = ajuste_manual.get("ganhos_campanha_bolt", ganhos_campanha_bolt)
            via_verde_total = ajuste_manual.get("via_verde", via_verde_total)
            combustivel_total = ajuste_manual.get("combustivel", combustivel_total)
            eletrico_total = ajuste_manual.get("eletrico", eletrico_total)
            aluguer_semanal = ajuste_manual.get("aluguer", aluguer_semanal)
            extras_total = ajuste_manual.get("extras", extras_total)
            logger.info(f"📝 Ajuste manual aplicado para {motorista.get('name')} - S{semana}/{ano}")
        
        # ============ CALCULAR TOTAIS ============
        # Total Ganhos = Rendimentos Uber + uPort + uGrat + Ganhos Bolt + Campanha Bolt
        # (uPort e uGrat são reembolsos/gorjetas que o motorista recebe)
        total_ganhos = ganhos_uber + uber_portagens + uber_gratificacoes + ganhos_bolt + ganhos_campanha_bolt
        
        # Se acumular_viaverde está activo, Via Verde vai para o acumulado (não desconta)
        via_verde_a_descontar = 0.0 if acumular_viaverde else via_verde_total
        total_despesas_operacionais = combustivel_total + eletrico_total + via_verde_a_descontar
        
        # RECEITAS DO PARCEIRO:
        # 1. Aluguer semanal (se contrato de aluguer)
        # 2. Extras cobrados ao motorista (dívidas, caução, danos)
        receita_aluguer = aluguer_semanal if tipo_contrato_veiculo == "aluguer" else 0
        receita_extras = extras_total
        
        # Total receitas do parceiro por este motorista
        receitas_parceiro = receita_aluguer + receita_extras
        
        # Líquido do motorista = (Rendimentos + Uber Portagens + Bolt) - Despesas - Aluguer - Extras
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
            "status": "editado_manual" if has_manual_adjustment else "calculado",
            "tem_ajuste_manual": has_manual_adjustment,
            # Ganhos do Motorista
            "ganhos_uber": round(ganhos_uber, 2),
            "uber_portagens": round(uber_portagens, 2),  # uPort: Portagens reembolsadas pela Uber
            "uber_gratificacoes": round(uber_gratificacoes, 2),  # uGrat: Gratificações/gorjetas Uber
            "ganhos_bolt": round(ganhos_bolt, 2),
            "ganhos_campanha_bolt": round(ganhos_campanha_bolt, 2),  # Ganhos de campanha Bolt (manual)
            "total_ganhos": round(total_ganhos, 2),
            # Valores reais recebidos (introduzidos manualmente para comparação)
            "valor_real_uber": round(ajuste_manual.get("valor_real_uber", 0) if ajuste_manual else 0, 2),
            "valor_real_bolt": round(ajuste_manual.get("valor_real_bolt", 0) if ajuste_manual else 0, 2),
            # Despesas Operacionais
            "combustivel": round(combustivel_total, 2),
            "carregamento_eletrico": round(eletrico_total, 2),
            "carregamentos_discriminacao": eletrico_discriminacao,  # Discriminação por fornecedor
            "cartoes_eletricos": cartoes_eletricos,  # Lista de cartões elétricos do veículo
            "via_verde": round(via_verde_a_descontar, 2),  # Valor a descontar (0 se acumular)
            "via_verde_total_importado": round(via_verde_total, 2),  # Valor total importado
            "via_verde_semana_referencia": f"Semana {semana}/{ano}",
            "total_despesas_operacionais": round(total_despesas_operacionais, 2),
            # Via Verde Acumulado
            "acumular_viaverde": acumular_viaverde,
            "viaverde_acumulado": round(viaverde_acumulado, 2),
            "viaverde_semana_acumulado": round(uber_portagens, 2) if acumular_viaverde else 0,  # Portagens Uber da semana
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
        totais["total_uber_portagens"] = totais.get("total_uber_portagens", 0) + uber_portagens
        totais["total_uber_gratificacoes"] = totais.get("total_uber_gratificacoes", 0) + uber_gratificacoes
        totais["total_ganhos_bolt"] += ganhos_bolt
        totais["total_ganhos_campanha_bolt"] = totais.get("total_ganhos_campanha_bolt", 0) + ganhos_campanha_bolt
        totais["total_ganhos"] += total_ganhos
        totais["total_combustivel"] += combustivel_total
        totais["total_eletrico"] += eletrico_total
        totais["total_via_verde"] += via_verde_total
        totais["total_despesas_operacionais"] = totais.get("total_despesas_operacionais", 0) + total_despesas_operacionais
        totais["total_aluguer"] = totais.get("total_aluguer", 0) + receita_aluguer
        totais["total_extras"] = totais.get("total_extras", 0) + receita_extras
        totais["total_receitas_parceiro"] = totais.get("total_receitas_parceiro", 0) + receitas_parceiro
        # NOVO: Total líquido de todos os motoristas (soma de valor_liquido_motorista)
        totais["total_liquido_motoristas"] = totais.get("total_liquido_motoristas", 0) + valor_liquido_motorista
    
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
            }, {"_id": 0, "rendimentos": 1, "pago_total": 1}).to_list(1000)
            total_ganhos += sum(float(r.get("rendimentos") or r.get("pago_total") or 0) for r in uber_records)
            
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
                }, {"_id": 0, "value": 1}).to_list(5000)
                total_despesas += sum(float(r.get("value") or 0) for r in vv_records)
            
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


# ==================== RELATÓRIO INDIVIDUAL DO MOTORISTA ====================

@router.get("/parceiro/resumo-semanal/motorista/{motorista_id}/pdf")
async def generate_motorista_pdf(
    motorista_id: str,
    semana: int,
    ano: int,
    mostrar_matricula: bool = True,
    mostrar_via_verde: bool = False,
    mostrar_abastecimentos: bool = False,
    mostrar_carregamentos: bool = False,
    current_user: Dict = Depends(get_current_user)
):
    """
    Gerar PDF do relatório semanal individual de um motorista.
    
    Query params:
    - mostrar_matricula: Exibir matrícula do veículo no cabeçalho
    - mostrar_via_verde: Listar detalhes das transações Via Verde
    - mostrar_abastecimentos: Listar detalhes dos abastecimentos de combustível
    - mostrar_carregamentos: Listar detalhes dos carregamentos elétricos
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    except ImportError:
        raise HTTPException(status_code=500, detail="ReportLab not installed")
    
    # Buscar motorista
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Buscar veículo atribuído
    veiculo = None
    matricula = ""
    if motorista.get("veiculo_atribuido"):
        veiculo = await db.vehicles.find_one({"id": motorista.get("veiculo_atribuido")}, {"_id": 0})
        if veiculo:
            matricula = veiculo.get("matricula", "")
    
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
    
    # Buscar dados do motorista
    ganhos_uber = 0.0
    uber_portagens = 0.0
    uber_gratificacoes = 0.0
    uber_records = await db.ganhos_uber.find({
        "motorista_id": motorista_id,
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}},
            {"periodo_inicio": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    }, {"_id": 0}).to_list(100)
    for r in uber_records:
        # Usar 'rendimentos' (campo da nova importação) ou fallback para campos antigos
        valor_base = float(r.get("rendimentos") or r.get("pago_total") or r.get("rendimentos_total") or 0)
        port = float(r.get("portagens") or r.get("uber_portagens") or 0)
        grat = float(r.get("gratificacao") or r.get("gratificacoes") or r.get("uber_gratificacoes") or r.get("gorjetas") or r.get("bonus") or 0)
        # Ganhos Uber = valor base menos portagens e gratificações
        ganhos_uber += valor_base - port - grat
        uber_portagens += port
        uber_gratificacoes += grat
    
    ganhos_bolt = 0.0
    # Buscar em ganhos_bolt
    bolt_records = await db.ganhos_bolt.find({
        "motorista_id": motorista_id,
        "$or": [{"periodo_semana": semana, "periodo_ano": ano}, {"semana": semana, "ano": ano}]
    }, {"_id": 0}).to_list(100)
    for r in bolt_records:
        ganhos_bolt += float(r.get("ganhos_liquidos") or r.get("ganhos") or 0)
    
    # Também buscar em viagens_bolt
    viagens_bolt_records = await db.viagens_bolt.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0}).to_list(100)
    for r in viagens_bolt_records:
        ganhos_bolt += float(r.get("ganhos_liquidos") or r.get("ganhos") or r.get("valor_liquido") or 0)
    
    via_verde = 0.0
    vv_transacoes = []  # Lista para as transações Via Verde
    
    # Via Verde - buscar APENAS por vehicle_id ou matrícula do veículo do motorista
    # NÃO buscar por parceiro_id pois isso traria todas as transações da frota
    vehicle_id = motorista.get("veiculo_atribuido")
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else motorista.get("parceiro_id")
    
    vv_query_conditions = []
    if vehicle_id:
        vv_query_conditions.append({"vehicle_id": vehicle_id})
    if matricula:
        # Normalizar matrícula para busca (remover hífens)
        matricula_norm = matricula.replace("-", "")
        vv_query_conditions.append({"matricula": matricula})
        if matricula_norm != matricula:
            vv_query_conditions.append({"matricula": matricula_norm})
    # NOTA: NÃO adicionar parceiro_id às condições - isso traria toda a frota
    # Buscar apenas por motorista_id se disponível
    if motorista_id:
        vv_query_conditions.append({"motorista_id": motorista_id})
    
    if vv_query_conditions:
        vv_records = await db.portagens_viaverde.find({
            "$and": [
                {"$or": vv_query_conditions},
                {"$or": [
                    {"$and": [{"semana": semana}, {"ano": ano}]},
                    {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]}
            ]
        }, {"_id": 0}).to_list(1000)
        
        for r in vv_records:
            valor = float(r.get("valor") or r.get("value") or 0)
            via_verde += valor
            if valor > 0:
                vv_transacoes.append({
                    "data": r.get("data") or r.get("entry_date", ""),
                    "hora": r.get("hora", ""),
                    "local": r.get("local") or f"{r.get('local_entrada', '')} → {r.get('local_saida', '')}",
                    "matricula": r.get("matricula", matricula),
                    "valor": valor
                })
    
    combustivel = 0.0
    comb_transacoes = []  # Lista para os abastecimentos
    
    # Combustível - buscar por parceiro_id (dados Prio são por parceiro/cartão)
    if parceiro_id:
        comb_query = {
            "$and": [
                {"parceiro_id": parceiro_id},
                {"$or": [
                    {"$and": [{"semana": semana}, {"ano": ano}]},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]},
                {"$or": [
                    {"litros": {"$gt": 0}},
                    {"kwh": {"$in": [0, None]}}
                ]}
            ]
        }
        
        comb_records = await db.despesas_combustivel.find(comb_query, {"_id": 0}).to_list(100)
        
        for r in comb_records:
            transacoes = r.get("transacoes", [])
            if transacoes:
                for t in transacoes:
                    valor = float(t.get("valor", 0) or 0)
                    combustivel += valor
                    if valor > 0:
                        data_trans = t.get("data", "")
                        comb_transacoes.append({
                            "data": data_trans.split(" ")[0] if " " in data_trans else data_trans,
                            "hora": data_trans.split(" ")[1] if " " in data_trans else "",
                            "posto": t.get("posto", "Prio"),
                            "litros": t.get("litros", 0),
                            "valor": valor
                        })
            else:
                valor = float(r.get("valor_total") or r.get("valor") or 0)
                if valor > 0:
                    combustivel += valor
                    comb_transacoes.append({
                        "data": r.get("data", ""),
                        "hora": r.get("hora", ""),
                        "posto": r.get("posto", "Prio"),
                        "litros": r.get("litros", 0),
                        "valor": valor
                    })
    
    # Também buscar em abastecimentos_combustivel (formato antigo)
    old_comb_records = await db.abastecimentos_combustivel.find({
        "$or": [
            {"motorista_id": motorista_id},
            {"vehicle_id": vehicle_id} if vehicle_id else {"motorista_id": "none"}
        ],
        "data": {"$gte": data_inicio, "$lte": data_fim}
    }, {"_id": 0}).to_list(100)
    
    for r in old_comb_records:
        valor_sem_iva = float(r.get("valor_liquido") or r.get("valor") or r.get("total") or 0)
        iva_valor = float(r.get("iva") or 0)
        total_valor = valor_sem_iva + iva_valor
        combustivel += total_valor
        if total_valor > 0:
            comb_transacoes.append({
                "data": r.get("data", ""),
                "hora": r.get("hora", ""),
                "posto": r.get("posto", "N/A"),
                "litros": r.get("litros", 0),
                "valor": total_valor
            })
    
    eletrico = 0.0
    elet_records = await db.despesas_combustivel.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0}).to_list(100)
    for r in elet_records:
        eletrico += float(r.get("valor_total") or r.get("TotalValueWithTaxes") or 0)
    
    # Buscar valor do aluguer
    aluguer = float(motorista.get("valor_aluguer_semanal") or 0)
    
    # Se não tiver no motorista, buscar do veículo associado
    if aluguer == 0 and veiculo:
        # Usar função que calcula com base na época alta/baixa
        aluguer = calcular_aluguer_semanal(veiculo, semana, ano)
        logger.info(f"PDF Motorista {motorista.get('name')}: aluguer calculado do veículo={aluguer}")
    elif aluguer == 0:
        # Tentar buscar veículo por outros campos
        veiculo_id = motorista.get("veiculo_atribuido") or motorista.get("veiculo_id") or motorista.get("vehicle_id")
        logger.info(f"PDF Motorista {motorista.get('name')}: veiculo_id={veiculo_id}")
        if veiculo_id:
            veiculo_aluguer = await db.vehicles.find_one({"id": veiculo_id}, {"_id": 0})
            if veiculo_aluguer:
                # Usar função que calcula com base na época alta/baixa
                aluguer = calcular_aluguer_semanal(veiculo_aluguer, semana, ano)
                logger.info(f"PDF Motorista {motorista.get('name')}: aluguer calculado={aluguer}")
            else:
                logger.warning(f"PDF Motorista {motorista.get('name')}: veículo não encontrado")
        else:
            logger.warning(f"PDF Motorista {motorista.get('name')}: sem veiculo_id")
    
    extras = 0.0
    extras_records = await db.despesas_extras.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0}).to_list(100)
    for r in extras_records:
        # Só somar extras não pagos ou pendentes
        if r.get("status", "pendente") != "cancelado":
            valor_extra = float(r.get("valor") or 0)
            # Se for crédito, subtrair; se for débito, somar
            if r.get("tipo") == "credito":
                extras -= valor_extra
            else:
                extras += valor_extra
    
    # ============ VERIFICAR AJUSTES MANUAIS PARA PDF ============
    ajuste_manual = await db.ajustes_semanais.find_one(
        {"motorista_id": motorista_id, "semana": semana, "ano": ano},
        {"_id": 0}
    )
    
    if ajuste_manual:
        # Substituir valores pelos valores do ajuste manual
        ganhos_uber = ajuste_manual.get("ganhos_uber", ganhos_uber)
        uber_portagens = ajuste_manual.get("uber_portagens", uber_portagens)
        uber_gratificacoes = ajuste_manual.get("uber_gratificacoes", uber_gratificacoes)
        ganhos_bolt = ajuste_manual.get("ganhos_bolt", ganhos_bolt)
        via_verde = ajuste_manual.get("via_verde", via_verde)
        combustivel = ajuste_manual.get("combustivel", combustivel)
        eletrico = ajuste_manual.get("eletrico", eletrico)
        aluguer = ajuste_manual.get("aluguer", aluguer)
        extras = ajuste_manual.get("extras", extras)
        logger.info(f"📝 PDF: Ajuste manual aplicado para {motorista.get('name')} - S{semana}/{ano}")
    
    # Total Ganhos = Rendimentos Uber + uPort + uGrat + Ganhos Bolt
    # (uPort e uGrat são reembolsos/gorjetas que o motorista recebe)
    total_ganhos = ganhos_uber + uber_portagens + uber_gratificacoes + ganhos_bolt
    total_despesas = via_verde + combustivel + eletrico
    liquido = total_ganhos - total_despesas - aluguer - extras
    
    # Gerar PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.grey)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=11, textColor=colors.HexColor('#1e3a5f'))
    
    elements = []
    
    # Cabeçalho
    elements.append(Paragraph(f"Relatório Semanal", title_style))
    elements.append(Paragraph(f"{motorista.get('name', 'Motorista')}", subtitle_style))
    
    # Mostrar matrícula se configurado
    if mostrar_matricula and matricula:
        elements.append(Paragraph(f"Veículo: {matricula}", subtitle_style))
    
    elements.append(Paragraph(f"Semana {semana}/{ano} ({week_start.strftime('%d/%m/%Y')} a {week_end.strftime('%d/%m/%Y')})", subtitle_style))
    elements.append(Spacer(1, 10*mm))
    
    # Tabela de resumo
    data_table = [
        ["Descrição", "Valor"],
        ["Ganhos Uber", f"€{ganhos_uber:.2f}"],
        ["uPort (Portagens Uber)", f"€{uber_portagens:.2f}"],
        ["uGrat (Gratificações Uber)", f"€{uber_gratificacoes:.2f}"],
        ["Ganhos Bolt", f"€{ganhos_bolt:.2f}"],
        ["Total Ganhos", f"€{total_ganhos:.2f}"],
        ["", ""],
        ["Via Verde", f"-€{via_verde:.2f}"],
        ["Combustível", f"-€{combustivel:.2f}"],
        ["Carregamento Elétrico", f"-€{eletrico:.2f}"],
        ["Total Despesas", f"-€{total_despesas:.2f}"],
        ["", ""],
        ["Aluguer Veículo", f"-€{aluguer:.2f}"],
        ["Extras/Dívidas", f"-€{extras:.2f}"],
        ["", ""],
        ["VALOR LÍQUIDO MOTORISTA", f"€{liquido:.2f}"],
    ]
    
    table = Table(data_table, colWidths=[100*mm, 50*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        # Estilo para "Total Ganhos" (linha 5)
        ('FONTNAME', (0, 5), (-1, 5), 'Helvetica-Bold'),
        # Estilo para "Total Despesas" (linha 10)
        ('FONTNAME', (0, 10), (-1, 10), 'Helvetica-Bold'),
        # Estilo para "VALOR LÍQUIDO MOTORISTA" (última linha - 15)
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#d4edda') if liquido >= 0 else colors.HexColor('#f8d7da')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 10*mm))
    
    # ==================== LISTAS DETALHADAS ====================
    
    # Lista de Via Verde
    if mostrar_via_verde and vv_transacoes:
        elements.append(Spacer(1, 5*mm))
        elements.append(Paragraph("Detalhes Via Verde", section_style))
        elements.append(Spacer(1, 3*mm))
        
        vv_table_data = [["Data", "Hora", "Local", "Matrícula", "Valor"]]
        for t in sorted(vv_transacoes, key=lambda x: (x.get("data", ""), x.get("hora", ""))):
            data_str = t.get("data", "-")
            # Formatar data de "2026-01-04" para "04/01/26"
            if data_str and "-" in data_str:
                try:
                    date_parts = data_str.split("-")
                    if len(date_parts) == 3:
                        data_str = f"{date_parts[2]}/{date_parts[1]}/{date_parts[0][2:]}"
                except:
                    pass
            
            hora_str = t.get("hora", "-") or "-"
            local = str(t.get("local", "-"))[:30]
            matricula_vv = t.get("matricula", "-")
            valor = t.get("valor", 0)
            
            vv_table_data.append([data_str, hora_str, local, matricula_vv, f"€{valor:.2f}"])
        
        # Linha de total
        vv_table_data.append(["", "", "", "TOTAL", f"€{via_verde:.2f}"])
        
        vv_table = Table(vv_table_data, colWidths=[22*mm, 18*mm, 70*mm, 25*mm, 25*mm])
        vv_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6c757d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),  # Coluna Valor alinhada à direita
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e9ecef')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(vv_table)
    
    # Lista de Abastecimentos
    if mostrar_abastecimentos and comb_transacoes:
        elements.append(Spacer(1, 8*mm))
        elements.append(Paragraph("Detalhes Abastecimentos", section_style))
        elements.append(Spacer(1, 3*mm))
        
        comb_table_data = [["Data", "Hora", "Posto", "Litros", "Valor"]]
        for t in sorted(comb_transacoes, key=lambda x: x.get("data", "")):
            data_str = t.get("data", "-")
            # Formatar data de "2026-01-04" para "04/01/26"
            if data_str and "-" in data_str:
                try:
                    date_parts = data_str.split("-")
                    if len(date_parts) == 3:
                        data_str = f"{date_parts[2]}/{date_parts[1]}/{date_parts[0][2:]}"
                except:
                    pass
            
            hora_str = t.get("hora", "-") or "-"
            posto = str(t.get("posto", "-"))[:20]
            litros = float(t.get("litros", 0) or 0)
            valor = t.get("valor", 0)
            
            comb_table_data.append([data_str, hora_str, posto, f"{litros:.1f}L" if litros else "-", f"€{valor:.2f}"])
        
        comb_table_data.append(["", "", "", "TOTAL", f"€{combustivel:.2f}"])
        
        comb_table = Table(comb_table_data, colWidths=[22*mm, 18*mm, 65*mm, 25*mm, 25*mm])
        comb_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6c757d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (3, 0), (4, -1), 'RIGHT'),  # Litros e Valor alinhados à direita
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e9ecef')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(comb_table)
    
    # Lista de Carregamentos Elétricos
    if mostrar_carregamentos and elet_records:
        elements.append(Spacer(1, 8*mm))
        elements.append(Paragraph("Detalhes Carregamentos Elétricos", section_style))
        elements.append(Spacer(1, 3*mm))
        
        # Colunas: Data, Hora, Posto, Tempo, kWh, Valor
        elet_table_data = [["Data", "Hora", "Posto", "Tempo", "kWh", "Valor"]]
        for r in sorted(elet_records, key=lambda x: x.get("data", x.get("StartDate", ""))):
            # Usar campos data_detalhe e hora_detalhe se existirem
            data_str = r.get("data_detalhe", "")
            hora_str = r.get("hora_detalhe", r.get("hora", ""))
            
            # Fallback: extrair de data se campos não existirem
            if not data_str:
                data_raw = r.get("data", r.get("StartDate", "-"))
                if data_raw and data_raw != "-":
                    try:
                        data_raw_str = str(data_raw)
                        if "T" in data_raw_str:
                            data_raw_str = data_raw_str.replace("T", " ")
                        
                        parts = data_raw_str.split(" ")
                        if len(parts) >= 1:
                            date_part = parts[0]
                            if "-" in date_part:
                                date_nums = date_part.split("-")
                                if len(date_nums) == 3:
                                    data_str = f"{date_nums[2]}/{date_nums[1]}/{date_nums[0][2:]}"
                            elif "/" in date_part:
                                date_nums = date_part.split("/")
                                if len(date_nums) >= 2:
                                    data_str = f"{date_nums[0].zfill(2)}/{date_nums[1].zfill(2)}"
                                    if len(date_nums) == 3:
                                        data_str += f"/{date_nums[2][-2:]}"
                            else:
                                data_str = date_part[:10]
                        
                        if len(parts) >= 2 and not hora_str:
                            hora_str = parts[1][:5]
                    except:
                        data_str = str(data_raw)[:10]
            else:
                # Formatar data_detalhe de "2026-01-04" para "04/01/26"
                try:
                    date_parts = data_str.split("-")
                    if len(date_parts) == 3:
                        data_str = f"{date_parts[2]}/{date_parts[1]}/{date_parts[0][2:]}"
                except:
                    pass
            
            if not data_str:
                data_str = "-"
            if not hora_str:
                hora_str = "-"
            
            # Posto/Local/Operador - usar estacao_id que é onde POSTO é guardado
            posto = r.get("estacao_id", r.get("estacao", r.get("posto", r.get("OperatorName", r.get("local", "-")))))
            if posto:
                posto = str(posto)[:18]
            else:
                posto = "-"
            
            # Tempo/Duração - usar duracao_minutos que é onde DURAÇÃO é guardado
            duracao = r.get("duracao_minutos", r.get("duracao", r.get("Duration", r.get("tempo", ""))))
            if duracao:
                # Converter minutos para formato legível se for número
                try:
                    if isinstance(duracao, (int, float)):
                        mins = int(duracao)
                        if mins >= 60:
                            tempo_str = f"{mins // 60}h{mins % 60:02d}m"
                        else:
                            tempo_str = f"{mins}m"
                    else:
                        tempo_str = str(duracao)[:10]
                except:
                    tempo_str = str(duracao)[:10]
            else:
                tempo_str = "-"
            
            # kWh/Energia - usar energia_kwh que é onde ENERGIA é guardado
            kwh = float(r.get("energia_kwh", r.get("energia", r.get("TotalEnergy", r.get("kwh", 0)))) or 0)
            
            # Valor
            valor = float(r.get("valor_total") or r.get("TotalValueWithTaxes") or 0)
            
            elet_table_data.append([data_str, hora_str, posto, tempo_str, f"{kwh:.2f}", f"€{valor:.2f}"])
        
        elet_table_data.append(["", "", "", "", "TOTAL", f"€{eletrico:.2f}"])
        
        elet_table = Table(elet_table_data, colWidths=[22*mm, 16*mm, 50*mm, 18*mm, 18*mm, 25*mm])
        elet_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6c757d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (3, 0), (5, -1), 'RIGHT'),  # Tempo, kWh, Valor alinhados à direita
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e9ecef')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(elet_table)
    
    # Rodapé
    elements.append(Spacer(1, 10*mm))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=colors.grey)
    elements.append(Paragraph(f"Gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')} - TVDEFleet", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    nome_ficheiro = motorista.get('name', 'motorista').replace(' ', '_')
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=relatorio_{nome_ficheiro}_S{semana}_{ano}.pdf"}
    )


@router.get("/parceiro/resumo-semanal/motorista/{motorista_id}/whatsapp")
async def get_motorista_whatsapp_link(
    motorista_id: str,
    semana: int,
    ano: int,
    current_user: Dict = Depends(get_current_user)
):
    """Gerar link de WhatsApp com resumo do motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
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
    
    # Buscar dados
    ganhos_uber = 0.0
    uber_portagens = 0.0
    uber_records = await db.ganhos_uber.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0, "rendimentos": 1, "pago_total": 1, "uber_portagens": 1}).to_list(100)
    ganhos_uber = sum(float(r.get("rendimentos") or r.get("pago_total") or 0) for r in uber_records)
    uber_portagens = sum(float(r.get("uber_portagens") or 0) for r in uber_records)
    
    ganhos_bolt = 0.0
    bolt_records = await db.ganhos_bolt.find({
        "motorista_id": motorista_id,
        "$or": [{"periodo_semana": semana, "periodo_ano": ano}, {"semana": semana, "ano": ano}]
    }, {"_id": 0, "ganhos_liquidos": 1}).to_list(100)
    ganhos_bolt = sum(float(r.get("ganhos_liquidos") or 0) for r in bolt_records)
    
    # Também buscar em viagens_bolt
    viagens_bolt_records = await db.viagens_bolt.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0, "ganhos_liquidos": 1, "valor_liquido": 1}).to_list(100)
    ganhos_bolt += sum(float(r.get("ganhos_liquidos") or r.get("valor_liquido") or 0) for r in viagens_bolt_records)
    
    via_verde = 0.0
    vv_records = await db.portagens_viaverde.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}}]
    }, {"_id": 0, "value": 1}).to_list(1000)
    via_verde = sum(float(r.get("value") or 0) for r in vv_records)
    
    combustivel = 0.0
    comb_records = await db.abastecimentos_combustivel.find({
        "motorista_id": motorista_id, "data": {"$gte": data_inicio, "$lte": data_fim}
    }, {"_id": 0, "valor_total": 1, "valor": 1, "valor_liquido": 1}).to_list(100)
    combustivel = sum(float(r.get("valor_total") or r.get("valor") or r.get("valor_liquido") or 0) for r in comb_records)
    
    eletrico = 0.0
    elet_records = await db.despesas_combustivel.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0, "valor_total": 1}).to_list(100)
    eletrico = sum(float(r.get("valor_total") or 0) for r in elet_records)
    
    # Buscar valor do aluguer
    aluguer = float(motorista.get("valor_aluguer_semanal") or 0)
    
    # Se não tiver no motorista, buscar do veículo associado
    if aluguer == 0:
        veiculo_id = motorista.get("veiculo_id") or motorista.get("vehicle_id")
        if veiculo_id:
            veiculo = await db.vehicles.find_one({"id": veiculo_id}, {"_id": 0})
            if veiculo:
                aluguer = calcular_aluguer_semanal(veiculo, semana, ano)
    
    # Initialize extras (for consistency with other functions)
    extras = 0.0
    
    # Total Ganhos = Rendimentos Uber + Uber Portagens + Ganhos Bolt
    total_ganhos = ganhos_uber + uber_portagens + ganhos_bolt
    total_despesas = via_verde + combustivel + eletrico
    liquido = total_ganhos - total_despesas - aluguer - extras
    
    # Criar mensagem
    msg = f"""*📊 Relatório Semanal - TVDEFleet*
*Semana {semana}/{ano}*
━━━━━━━━━━━━━━━━

👤 *{motorista.get('name')}*

*💰 GANHOS*
• Uber: €{ganhos_uber:.2f}
• Bolt: €{ganhos_bolt:.2f}
• *Total: €{total_ganhos:.2f}*

*💸 DESPESAS*
• Via Verde: €{via_verde:.2f}
• Combustível: €{combustivel:.2f}
• Elétrico: €{eletrico:.2f}
• *Total: €{total_despesas:.2f}*

*🚗 ALUGUER*
• Valor: €{aluguer:.2f}

━━━━━━━━━━━━━━━━
*{'✅' if liquido >= 0 else '⚠️'} LÍQUIDO: €{liquido:.2f}*
━━━━━━━━━━━━━━━━

_Gerado por TVDEFleet_"""
    
    import urllib.parse
    telefone = motorista.get("telefone", "").replace(" ", "").replace("+", "")
    if telefone and not telefone.startswith("351"):
        telefone = "351" + telefone
    
    encoded_msg = urllib.parse.quote(msg)
    whatsapp_link = f"https://wa.me/{telefone}?text={encoded_msg}" if telefone else f"https://wa.me/?text={encoded_msg}"
    
    return {
        "whatsapp_link": whatsapp_link,
        "telefone": telefone,
        "motorista_nome": motorista.get("name"),
        "mensagem": msg
    }


@router.post("/parceiro/resumo-semanal/motorista/{motorista_id}/email")
async def send_motorista_email(
    motorista_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Enviar relatório por email ao motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    semana = data.get("semana")
    ano = data.get("ano")
    
    if not semana or not ano:
        raise HTTPException(status_code=400, detail="Semana e ano são obrigatórios")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    email_destino = motorista.get("email")
    if not email_destino:
        raise HTTPException(status_code=400, detail="Motorista não tem email configurado")
    
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
    
    # Buscar dados
    uber_records = await db.ganhos_uber.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0, "rendimentos": 1, "pago_total": 1, "uber_portagens": 1}).to_list(100)
    ganhos_uber = sum(float(r.get("rendimentos") or r.get("pago_total") or 0) for r in uber_records)
    uber_portagens = sum(float(r.get("uber_portagens") or 0) for r in uber_records)
    
    bolt_records = await db.ganhos_bolt.find({
        "motorista_id": motorista_id,
        "$or": [{"periodo_semana": semana, "periodo_ano": ano}, {"semana": semana, "ano": ano}]
    }, {"_id": 0, "ganhos_liquidos": 1}).to_list(100)
    ganhos_bolt = sum(float(r.get("ganhos_liquidos") or 0) for r in bolt_records)
    
    # Também buscar em viagens_bolt
    viagens_bolt_records = await db.viagens_bolt.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0, "ganhos_liquidos": 1, "valor_liquido": 1}).to_list(100)
    ganhos_bolt += sum(float(r.get("ganhos_liquidos") or r.get("valor_liquido") or 0) for r in viagens_bolt_records)
    
    via_verde = sum(float(r.get("value") or 0) for r in await db.portagens_viaverde.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}}]
    }, {"_id": 0, "value": 1}).to_list(1000))
    
    combustivel = sum(float(r.get("valor_total") or r.get("valor") or r.get("valor_liquido") or 0) for r in await db.abastecimentos_combustivel.find({
        "motorista_id": motorista_id, "data": {"$gte": data_inicio, "$lte": data_fim}
    }, {"_id": 0, "valor_total": 1, "valor": 1, "valor_liquido": 1}).to_list(100))
    
    eletrico = sum(float(r.get("valor_total") or 0) for r in await db.despesas_combustivel.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0, "valor_total": 1}).to_list(100))
    
    # Buscar valor do aluguer
    aluguer = float(motorista.get("valor_aluguer_semanal") or 0)
    
    # Se não tiver no motorista, buscar do veículo associado
    if aluguer == 0:
        veiculo_id = motorista.get("veiculo_id") or motorista.get("vehicle_id")
        if veiculo_id:
            veiculo = await db.vehicles.find_one({"id": veiculo_id}, {"_id": 0})
            if veiculo:
                aluguer = calcular_aluguer_semanal(veiculo, semana, ano)
    
    # Initialize extras (for consistency with other functions)
    extras = 0.0
    
    # Total Ganhos = Rendimentos Uber + Uber Portagens + Ganhos Bolt
    total_ganhos = ganhos_uber + uber_portagens + ganhos_bolt
    total_despesas = via_verde + combustivel + eletrico
    liquido = total_ganhos - total_despesas - aluguer - extras
    
    # Criar HTML do email
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1e3a5f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">📊 Relatório Semanal</h1>
            <p style="margin: 5px 0 0 0;">Semana {semana}/{ano}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6;">
            <h2 style="color: #1e3a5f; margin-top: 0;">Olá, {motorista.get('name')}!</h2>
            
            <h3 style="color: #28a745;">💰 Ganhos</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td>Uber:</td><td style="text-align: right;"><strong>€{ganhos_uber:.2f}</strong></td></tr>
                <tr><td>Bolt:</td><td style="text-align: right;"><strong>€{ganhos_bolt:.2f}</strong></td></tr>
                <tr style="background: #d4edda;"><td><strong>Total Ganhos:</strong></td><td style="text-align: right;"><strong>€{total_ganhos:.2f}</strong></td></tr>
            </table>
            
            <h3 style="color: #dc3545;">💸 Despesas</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td>Via Verde:</td><td style="text-align: right;">€{via_verde:.2f}</td></tr>
                <tr><td>Combustível:</td><td style="text-align: right;">€{combustivel:.2f}</td></tr>
                <tr><td>Elétrico:</td><td style="text-align: right;">€{eletrico:.2f}</td></tr>
                <tr style="background: #f8d7da;"><td><strong>Total Despesas:</strong></td><td style="text-align: right;"><strong>€{total_despesas:.2f}</strong></td></tr>
            </table>
            
            <h3 style="color: #007bff;">🚗 Aluguer: €{aluguer:.2f}</h3>
            
            <div style="background: {'#d4edda' if liquido >= 0 else '#f8d7da'}; padding: 15px; border-radius: 8px; text-align: center; margin-top: 20px;">
                <h2 style="margin: 0; color: {'#155724' if liquido >= 0 else '#721c24'};">
                    {'✅' if liquido >= 0 else '⚠️'} Valor Líquido: €{liquido:.2f}
                </h2>
            </div>
        </div>
        
        <div style="background: #e9ecef; padding: 10px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d;">
            Gerado automaticamente por TVDEFleet
        </div>
    </body>
    </html>
    """
    
    # Obter parceiro_id para usar SMTP do parceiro
    # Prioridade: current_user (se parceiro) > motorista.parceiro_id > motorista.parceiro_atribuido
    parceiro_id = None
    
    # Se o utilizador atual é parceiro, usar o seu ID primeiro
    if current_user.get("role") == UserRole.PARCEIRO or current_user.get("role") == "parceiro":
        parceiro_id = current_user.get("id")
    elif current_user.get("parceiro_id"):
        parceiro_id = current_user.get("parceiro_id")
    
    # Fallback para o parceiro do motorista
    if not parceiro_id:
        parceiro_id = motorista.get("parceiro_id") or motorista.get("parceiro_atribuido")
    
    logger.info(f"Enviando email para motorista {motorista_id}, parceiro_id={parceiro_id}, user_id={current_user.get('id')}, user_role={current_user.get('role')}")
    
    # Tentar enviar email via SMTP do parceiro primeiro
    try:
        email_result = None
        
        # Usar SMTP do parceiro se disponível
        if parceiro_id:
            from utils.email_service import get_parceiro_email_service
            email_service = await get_parceiro_email_service(db, parceiro_id)
            logger.info(f"Email service obtido: {email_service is not None}")
            if email_service:
                email_result = email_service.send_email(
                    to_email=email_destino,
                    subject=f"Relatório Semanal - Semana {semana}/{ano}",
                    body_html=html_content
                )
                logger.info(f"Email enviado via SMTP do parceiro para {email_destino}: {email_result}")
        else:
            logger.warning(f"Parceiro ID não encontrado para motorista {motorista_id}")
        
        # Fallback para SMTP do sistema se SMTP do parceiro não disponível
        if email_result is None:
            logger.info("Usando fallback SMTP do sistema")
            email_result = send_email_smtp(
                to_email=email_destino,
                subject=f"Relatório Semanal - Semana {semana}/{ano}",
                html_content=html_content
            )
        
        if email_result.get("success"):
            return {"message": f"Email enviado para {email_destino}", "success": True}
        else:
            error_msg = email_result.get("error") or email_result.get("message", "Configuração de email não encontrada")
            return {"message": f"Email não enviado - {error_msg}", "success": False, "error": error_msg}
    except Exception as e:
        logger.error(f"Erro ao enviar email: {e}")
        return {"message": f"Erro ao enviar email: {str(e)}", "success": False}


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
        "uber_portagens": float(data.get("uber_portagens", 0)),
        "uber_gratificacoes": float(data.get("uber_gratificacoes", 0)),
        "ganhos_bolt": float(data.get("ganhos_bolt", 0)),
        "ganhos_campanha_bolt": float(data.get("ganhos_campanha_bolt", 0)),  # Ganhos de campanha Bolt
        "via_verde": float(data.get("via_verde", 0)),
        "combustivel": float(data.get("combustivel", 0)),
        "eletrico": float(data.get("eletrico", 0)),
        "aluguer": float(data.get("aluguer", 0)),
        "extras": float(data.get("extras", 0)),
        # Novos campos para valores reais recebidos
        "valor_real_uber": float(data.get("valor_real_uber", 0)),
        "valor_real_bolt": float(data.get("valor_real_bolt", 0)),
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
    
    # Buscar veículo para obter via_verde_id
    veiculo = None
    via_verde_id = None
    if motorista.get("veiculo_atribuido"):
        veiculo = await db.vehicles.find_one({"id": motorista["veiculo_atribuido"]}, {"_id": 0, "via_verde_id": 1, "obu": 1, "matricula": 1, "cartao_frota_id": 1, "cartao_frota_eletric_id": 1})
        if veiculo:
            via_verde_id = veiculo.get("via_verde_id")
    
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
    # Suporta motorista_id e também nome_motorista + parceiro_id (dados RPA)
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else motorista.get("parceiro_id")
    nome_motorista = motorista.get("name", "")
    
    uber_query = {
        "$or": [
            {"motorista_id": motorista_id},
            # Suporte para dados RPA que usam nome_motorista + parceiro_id
            {"nome_motorista": nome_motorista, "parceiro_id": parceiro_id} if nome_motorista and parceiro_id else {"motorista_id": motorista_id}
        ],
        "$and": [
            {"$or": [
                {"semana": semana, "ano": ano},
                {"data": {"$gte": data_inicio, "$lte": data_fim}}
            ]}
        ]
    }
    
    result = await db.ganhos_uber.delete_many(uber_query)
    deleted_counts["ganhos_uber"] = result.deleted_count
    
    logger.info(f"🗑️ Eliminados {result.deleted_count} ganhos Uber para motorista {motorista_id} S{semana}/{ano}")
    
    # Eliminar ganhos Bolt (de ganhos_bolt)
    result = await db.ganhos_bolt.delete_many({
        "motorista_id": motorista_id,
        "$or": [
            {"periodo_semana": semana, "periodo_ano": ano},
            {"semana": semana, "ano": ano}
        ]
    })
    deleted_counts["ganhos_bolt"] = result.deleted_count
    
    # Eliminar ganhos Bolt (de viagens_bolt - coleção alternativa)
    result = await db.viagens_bolt.delete_many({
        "motorista_id": motorista_id,
        "semana": semana,
        "ano": ano
    })
    deleted_counts["viagens_bolt"] = result.deleted_count
    
    # Eliminar Via Verde - buscar por motorista_id OU via_verde_id do veículo
    via_verde_query_conditions = [
        {"motorista_id": motorista_id}
    ]
    if via_verde_id:
        via_verde_query_conditions.append({"via_verde_id": via_verde_id})
    if veiculo and veiculo.get("obu"):
        via_verde_query_conditions.append({"obu": veiculo.get("obu")})
    if veiculo and veiculo.get("matricula"):
        via_verde_query_conditions.append({"matricula": veiculo.get("matricula")})
    
    result = await db.portagens_viaverde.delete_many({
        "$and": [
            {"$or": via_verde_query_conditions},
            {"$or": [
                {"semana": semana, "ano": ano},
                {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}}
            ]}
        ]
    })
    deleted_counts["via_verde"] = result.deleted_count
    
    # Eliminar combustível - buscar por motorista_id, matrícula, cartão frota ou veiculo_id
    combustivel_query_conditions = [{"motorista_id": motorista_id}]
    if veiculo and veiculo.get("matricula"):
        combustivel_query_conditions.append({"matricula": veiculo.get("matricula")})
    if veiculo and veiculo.get("cartao_frota_id"):
        combustivel_query_conditions.append({"cartao_frota_id": veiculo.get("cartao_frota_id")})
    if motorista.get("veiculo_atribuido"):
        combustivel_query_conditions.append({"veiculo_id": motorista.get("veiculo_atribuido")})
    
    result = await db.abastecimentos_combustivel.delete_many({
        "$and": [
            {"$or": combustivel_query_conditions},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    })
    deleted_counts["combustivel"] = result.deleted_count
    
    # Eliminar despesas combustível (Prio RPA) - buscar por motorista_id, matrícula, cartão elétrico ou veiculo_id
    despesas_comb_query_conditions = [{"motorista_id": motorista_id}]
    if veiculo and veiculo.get("matricula"):
        despesas_comb_query_conditions.append({"matricula": veiculo.get("matricula")})
    if veiculo and veiculo.get("cartao_frota_eletric_id"):
        despesas_comb_query_conditions.append({"cartao_frota_id": veiculo.get("cartao_frota_eletric_id")})
    if motorista.get("veiculo_atribuido"):
        despesas_comb_query_conditions.append({"veiculo_id": motorista.get("veiculo_atribuido")})
        despesas_comb_query_conditions.append({"vehicle_id": motorista.get("veiculo_atribuido")})
    
    result = await db.despesas_combustivel.delete_many({
        "$and": [
            {"$or": despesas_comb_query_conditions},
            {"$or": [
                {"semana": semana, "ano": ano},
                {"data": {"$gte": data_inicio, "$lte": data_fim}}
            ]}
        ]
    })
    deleted_counts["despesas_combustivel"] = result.deleted_count
    
    # Eliminar extras
    result = await db.despesas_extras.delete_many({
        "motorista_id": motorista_id,
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    })
    deleted_counts["extras"] = result.deleted_count
    



# ==================== TOTAIS EMPRESA (Verificação Uber/Bolt) ====================

@router.get("/parceiro/totais-empresa")
async def get_totais_empresa(
    semana: int,
    ano: int,
    current_user: dict = Depends(get_current_user)
):
    """Obter totais recebidos da empresa para uma semana"""
    if current_user["role"] not in [UserRole.PARCEIRO, UserRole.ADMIN, UserRole.GESTAO, "parceiro", "admin", "gestao"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user["id"] if current_user["role"] in [UserRole.PARCEIRO, "parceiro"] else None
    
    query = {"semana": semana, "ano": ano}
    if parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    totais = await db.totais_empresa.find_one(query, {"_id": 0})
    
    return totais or {"uber_recebido": 0, "bolt_recebido": 0}


@router.post("/parceiro/totais-empresa")
async def save_totais_empresa(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Guardar totais recebidos da empresa para uma semana"""
    if current_user["role"] not in [UserRole.PARCEIRO, UserRole.ADMIN, UserRole.GESTAO, "parceiro", "admin", "gestao"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    semana = data.get("semana")
    ano = data.get("ano")
    
    if not semana or not ano:
        raise HTTPException(status_code=400, detail="Semana e ano são obrigatórios")
    
    parceiro_id = current_user["id"] if current_user["role"] in [UserRole.PARCEIRO, "parceiro"] else data.get("parceiro_id") or current_user["id"]
    
    doc = {
        "parceiro_id": parceiro_id,
        "semana": semana,
        "ano": ano,
        "uber_recebido": float(data.get("uber_recebido", 0)),
        "bolt_recebido": float(data.get("bolt_recebido", 0)),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.totais_empresa.update_one(
        {"parceiro_id": parceiro_id, "semana": semana, "ano": ano},
        {"$set": doc},
        upsert=True
    )
    
    return {"success": True, "message": "Totais guardados"}


@router.post("/parceiro/aplicar-totais-empresa")
async def aplicar_totais_empresa(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Aplicar os valores 'Recebido da Empresa' aos ganhos dos motoristas.
    
    Quando há apenas 1 motorista: aplica o valor total ao motorista.
    Quando há múltiplos motoristas: distribui proporcionalmente (ou mantém igual).
    
    Fórmula Bolt: ganhos = total_earnings - comissao (já inclui gorjetas, bónus, etc.)
    """
    if current_user["role"] not in [UserRole.PARCEIRO, UserRole.ADMIN, UserRole.GESTAO, "parceiro", "admin", "gestao"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    semana = data.get("semana")
    ano = data.get("ano")
    uber_recebido = float(data.get("uber_recebido", 0))
    bolt_recebido = float(data.get("bolt_recebido", 0))
    
    if not semana or not ano:
        raise HTTPException(status_code=400, detail="Semana e ano são obrigatórios")
    
    parceiro_id = current_user["id"] if current_user["role"] in [UserRole.PARCEIRO, "parceiro"] else data.get("parceiro_id") or current_user["id"]
    
    # Buscar motoristas do parceiro
    motoristas = await db.motoristas.find({
        "$or": [
            {"parceiro_id": parceiro_id},
            {"parceiro_atribuido": parceiro_id}
        ],
        "$or": [
            {"ativo": True},
            {"status_motorista": "ativo"},
            {"ativo": {"$exists": False}}
        ]
    }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    if not motoristas:
        raise HTTPException(status_code=404, detail="Nenhum motorista encontrado")
    
    resultados = []
    now = datetime.now(timezone.utc)
    
    # Se há apenas 1 motorista, aplica os valores directamente
    if len(motoristas) == 1:
        motorista = motoristas[0]
        motorista_id = motorista["id"]
        
        # Criar/atualizar ajuste semanal com os valores da empresa
        ajuste = {
            "motorista_id": motorista_id,
            "parceiro_id": parceiro_id,
            "semana": semana,
            "ano": ano,
            "ganhos_uber": uber_recebido if uber_recebido > 0 else None,
            "ganhos_bolt": bolt_recebido if bolt_recebido > 0 else None,
            "fonte": "totais_empresa",
            "updated_at": now.isoformat(),
            "updated_by": current_user["id"]
        }
        
        # Remover campos None
        ajuste = {k: v for k, v in ajuste.items() if v is not None}
        
        await db.ajustes_semanais.update_one(
            {"motorista_id": motorista_id, "semana": semana, "ano": ano},
            {"$set": ajuste},
            upsert=True
        )
        
        # Também criar/atualizar registo em ganhos_bolt se bolt_recebido > 0
        if bolt_recebido > 0:
            ganho_bolt = {
                "id": str(uuid.uuid4()),
                "motorista_id": motorista_id,
                "nome_motorista": motorista.get("name"),
                "parceiro_id": parceiro_id,
                "semana": semana,
                "ano": ano,
                "ganhos_liquidos": bolt_recebido,
                "ganhos": bolt_recebido,
                "fonte": "totais_empresa",
                "updated_at": now.isoformat()
            }
            
            await db.ganhos_bolt.update_one(
                {"motorista_id": motorista_id, "semana": semana, "ano": ano},
                {"$set": ganho_bolt},
                upsert=True
            )
        
        # Também criar/atualizar registo em ganhos_uber se uber_recebido > 0
        if uber_recebido > 0:
            ganho_uber = {
                "id": str(uuid.uuid4()),
                "motorista_id": motorista_id,
                "nome_motorista": motorista.get("name"),
                "parceiro_id": parceiro_id,
                "semana": semana,
                "ano": ano,
                "rendimentos": uber_recebido,
                "pago_total": uber_recebido,
                "fonte": "totais_empresa",
                "updated_at": now.isoformat()
            }
            
            await db.ganhos_uber.update_one(
                {"motorista_id": motorista_id, "semana": semana, "ano": ano},
                {"$set": ganho_uber},
                upsert=True
            )
        
        resultados.append({
            "motorista_id": motorista_id,
            "motorista_nome": motorista.get("name"),
            "uber_aplicado": uber_recebido,
            "bolt_aplicado": bolt_recebido
        })
        
        logger.info(f"💰 Totais aplicados a {motorista.get('name')}: Uber={uber_recebido}€, Bolt={bolt_recebido}€")
    
    else:
        # Múltiplos motoristas - por agora, apenas guardar os totais
        # TODO: Implementar distribuição proporcional se necessário
        logger.info(f"⚠️ {len(motoristas)} motoristas - totais guardados mas não distribuídos automaticamente")
    
    # Guardar também na coleção totais_empresa
    await db.totais_empresa.update_one(
        {"parceiro_id": parceiro_id, "semana": semana, "ano": ano},
        {"$set": {
            "parceiro_id": parceiro_id,
            "semana": semana,
            "ano": ano,
            "uber_recebido": uber_recebido,
            "bolt_recebido": bolt_recebido,
            "aplicado": True,
            "motoristas_aplicados": len(resultados),
            "updated_at": now.isoformat(),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"Totais aplicados a {len(resultados)} motorista(s)",
        "resultados": resultados
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
    # Suporta tanto motorista_id como parceiro_id (dados RPA usam parceiro_id)
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else None
    
    # Query simplificada para eliminar por semana/ano
    uber_conditions = [
        {"motorista_id": {"$in": motorista_ids}, "semana": semana, "ano": ano},
    ]
    
    # Adicionar condição para dados RPA que usam parceiro_id
    if parceiro_id:
        uber_conditions.append({"parceiro_id": parceiro_id, "semana": semana, "ano": ano})
    
    uber_query = {"$or": uber_conditions}
    
    result = await db.ganhos_uber.delete_many(uber_query)
    deleted_counts["ganhos_uber"] = result.deleted_count
    
    logger.info(f"🗑️ Eliminados {result.deleted_count} ganhos Uber para S{semana}/{ano}")
    
    # Eliminar ganhos Bolt (de ganhos_bolt)
    # Bolt pode ter motorista_id, identificador_motorista_bolt, ou nome_motorista
    bolt_motorista_ids = []
    bolt_nomes = []
    for m in await db.motoristas.find(motoristas_query, {"_id": 0, "id": 1, "name": 1, "bolt_driver_id": 1}).to_list(1000):
        bolt_motorista_ids.append(m.get("id"))
        if m.get("bolt_driver_id"):
            bolt_motorista_ids.append(m.get("bolt_driver_id"))
        if m.get("name"):
            bolt_nomes.append(m.get("name"))
    
    result = await db.ganhos_bolt.delete_many({
        "$or": [
            {"motorista_id": {"$in": motorista_ids}},
            {"identificador_motorista_bolt": {"$in": bolt_motorista_ids}},
            {"nome_motorista": {"$in": bolt_nomes}}
        ],
        "$and": [
            {"$or": [
                {"periodo_semana": semana, "periodo_ano": ano},
                {"semana": semana, "ano": ano}
            ]}
        ]
    })
    deleted_counts["ganhos_bolt"] = result.deleted_count
    
    # Eliminar ganhos Bolt (de viagens_bolt - coleção alternativa)
    result = await db.viagens_bolt.delete_many({
        "$or": [
            {"motorista_id": {"$in": motorista_ids}},
            {"nome_motorista": {"$in": bolt_nomes}}
        ],
        "semana": semana,
        "ano": ano
    })
    deleted_counts["viagens_bolt"] = result.deleted_count
    
    # Eliminar Via Verde - CORRIGIDO: Usar parceiro_id pois os registos Via Verde são por veículo/parceiro
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else None
    
    # Buscar veículos do parceiro para associar
    veiculos_query = {}
    if parceiro_id:
        veiculos_query["parceiro_id"] = parceiro_id
    
    veiculos = await db.vehicles.find(veiculos_query, {"_id": 0, "id": 1}).to_list(1000)
    vehicle_ids = [v["id"] for v in veiculos]
    
    # Construir query Via Verde
    vv_query = {
        "$or": [
            {"semana": semana, "ano": ano},
            {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    }
    
    # Filtrar por parceiro ou veículos
    if parceiro_id:
        vv_query["$and"] = [
            {"$or": [
                {"parceiro_id": parceiro_id},
                {"vehicle_id": {"$in": vehicle_ids}},
                {"motorista_id": {"$in": motorista_ids}}
            ]}
        ]
    
    result = await db.portagens_viaverde.delete_many(vv_query)
    deleted_counts["via_verde"] = result.deleted_count
    
    # Eliminar combustível (coleção abastecimentos_combustivel)
    # Inclui dados por motorista_id E dados Prio RPA por parceiro_id
    combustivel_conditions = [
        {"motorista_id": {"$in": motorista_ids}, "data": {"$gte": data_inicio, "$lte": data_fim}}
    ]
    
    # Adicionar condição para dados Prio RPA que usam parceiro_id e semana/ano
    if parceiro_id:
        combustivel_conditions.append({
            "parceiro_id": parceiro_id,
            "fonte": "rpa_prio",
            "$or": [
                {"semana": semana, "ano": ano},
                {"data": {"$gte": data_inicio, "$lte": data_fim}}
            ]
        })
    
    result = await db.abastecimentos_combustivel.delete_many({"$or": combustivel_conditions})
    deleted_counts["combustivel"] = result.deleted_count
    
    logger.info(f"🗑️ Eliminados {result.deleted_count} registos de combustível para S{semana}/{ano}")
    
    # Eliminar despesas combustível (Prio RPA) - pode ter motorista_id OU parceiro_id
    despesas_comb_query = {
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    }
    
    # Adicionar filtro por parceiro_id ou motorista_id
    if parceiro_id:
        despesas_comb_query["$and"] = [
            {"$or": [
                {"parceiro_id": parceiro_id},
                {"motorista_id": {"$in": motorista_ids}},
                {"veiculo_id": {"$in": vehicle_ids}},
                {"vehicle_id": {"$in": vehicle_ids}}  # Suportar ambos os nomes
            ]}
        ]
    else:
        despesas_comb_query["motorista_id"] = {"$in": motorista_ids}
    
    result = await db.despesas_combustivel.delete_many(despesas_comb_query)
    deleted_counts["despesas_combustivel"] = result.deleted_count
    
    # Eliminar extras
    result = await db.despesas_extras.delete_many({
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
    todos_abastecimentos = []  # Lista de todos os abastecimentos da semana
    todas_portagens = []  # Lista de todas as portagens Via Verde da semana
    totais = {
        "ganhos_uber": 0, "ganhos_bolt": 0, "via_verde": 0,
        "combustivel": 0, "eletrico": 0, "aluguer": 0, "extras": 0
    }
    
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else None
    
    # ============ BUSCAR DADOS DO PARCEIRO E CONFIGURAÇÃO DO RELATÓRIO ============
    parceiro_dados = None
    config_relatorio = None
    
    if parceiro_id:
        # Buscar dados do parceiro (nome, NIF, etc.)
        parceiro_dados = await db.parceiros.find_one(
            {"id": parceiro_id},
            {"_id": 0, "name": 1, "nif": 1, "email": 1, "morada": 1}
        )
        
        # Se não encontrar em parceiros, buscar em users
        if not parceiro_dados:
            parceiro_dados = await db.users.find_one(
                {"id": parceiro_id},
                {"_id": 0, "name": 1, "nif": 1, "email": 1}
            )
        
        # Buscar configuração do relatório
        config_relatorio = await db.relatorio_config.find_one(
            {"parceiro_id": parceiro_id},
            {"_id": 0}
        )
    
    # ============ BUSCAR PORTAGENS VIA VERDE POR PARCEIRO (fora do loop de motoristas) ============
    # Os dados da Via Verde são por veículo/parceiro, não por motorista individual
    if parceiro_id:
        vv_query = {
            "$and": [
                {"parceiro_id": parceiro_id},
                {"$or": [
                    {"$and": [{"semana": semana}, {"ano": ano}]},
                    {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]}
            ]
        }
        
        vv_records_global = await db.portagens_viaverde.find(vv_query, {"_id": 0}).to_list(1000)
        
        for r in vv_records_global:
            valor = float(r.get("valor") or r.get("value") or 0)
            if valor > 0:
                # Nota: Não somar ao total aqui, será somado por motorista no loop
                todas_portagens.append({
                    "motorista": r.get("matricula", "Frota"),
                    "data": r.get("data") or r.get("entry_date", ""),
                    "hora": r.get("hora", ""),
                    "local": r.get("local") or f"{r.get('local_entrada', '')} → {r.get('local_saida', '')}",
                    "matricula": r.get("matricula", ""),
                    "valor": valor
                })
    
    # ============ BUSCAR COMBUSTÍVEL POR PARCEIRO (fora do loop de motoristas) ============
    # Os dados da Prio são por parceiro/cartão, não por motorista individual
    if parceiro_id:
        despesas_comb_query = {
            "$and": [
                {"parceiro_id": parceiro_id},
                {"$or": [
                    {"$and": [{"semana": semana}, {"ano": ano}]},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]},
                {"$or": [
                    {"litros": {"$gt": 0}},
                    {"kwh": {"$in": [0, None]}}
                ]}
            ]
        }
        
        despesas_comb_records = await db.despesas_combustivel.find(despesas_comb_query, {"_id": 0}).to_list(100)
        
        for r in despesas_comb_records:
            transacoes = r.get("transacoes", [])
            if transacoes:
                # Se tem transações detalhadas, adicionar à lista (mas NÃO somar aos totais aqui)
                for t in transacoes:
                    valor = float(t.get("valor", 0) or 0)
                    # Nota: Não somar ao totais["combustivel"] aqui - será somado por motorista no loop
                    todos_abastecimentos.append({
                        "motorista": "Frota",
                        "data": t.get("data", "").split(" ")[0] if t.get("data") else "",
                        "hora": t.get("data", "").split(" ")[1] if " " in t.get("data", "") else "",
                        "posto": t.get("posto", "Prio"),
                        "valor": valor
                    })
            else:
                # Registo simples sem transações detalhadas
                valor = float(r.get("valor_total") or r.get("valor") or 0)
                if valor > 0:
                    # Nota: Não somar ao totais["combustivel"] aqui - será somado por motorista no loop
                    todos_abastecimentos.append({
                        "motorista": "Frota",
                        "data": r.get("data", ""),
                        "hora": r.get("hora", ""),
                        "posto": r.get("posto", "Prio"),
                        "valor": valor
                    })
    
    for m in motoristas:
        motorista_id = m["id"]
        motorista_nome = m.get("name", "")
        veiculo_id = m.get("veiculo_atribuido")
        
        # Buscar veículo para obter matrícula e outros dados
        veiculo = None
        matricula_veiculo = None
        if veiculo_id:
            veiculo = await db.vehicles.find_one({"id": veiculo_id}, {"_id": 0})
            if veiculo:
                matricula_veiculo = veiculo.get("matricula", "").upper().strip()
        
        # ============ VERIFICAR AJUSTE MANUAL ============
        # Se existir um ajuste manual para este motorista/semana, usar esses valores
        ajuste_manual = await db.ajustes_semanais.find_one({
            "motorista_id": motorista_id,
            "semana": semana,
            "ano": ano
        }, {"_id": 0})
        
        if ajuste_manual:
            # Usar valores do ajuste manual
            ganhos_uber = float(ajuste_manual.get("ganhos_uber") or 0)
            uber_portagens = float(ajuste_manual.get("uber_portagens") or 0)
            uber_gratificacoes = float(ajuste_manual.get("uber_gratificacoes") or 0)
            ganhos_bolt = float(ajuste_manual.get("ganhos_bolt") or 0)
            via_verde = float(ajuste_manual.get("via_verde") or 0)
            combustivel = float(ajuste_manual.get("combustivel") or 0)
            eletrico = float(ajuste_manual.get("eletrico") or 0)
            aluguer = float(ajuste_manual.get("aluguer") or 0)
            extras = float(ajuste_manual.get("extras") or 0)
            
            logger.info(f"📝 PDF: Usando ajuste manual para {motorista_nome} - S{semana}/{ano}")
        else:
            # ============ BUSCAR DADOS AUTOMATICAMENTE ============
            # Ganhos Uber
            uber_records = await db.ganhos_uber.find({
                "motorista_id": motorista_id,
                "$or": [
                    {"semana": semana, "ano": ano},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]
            }, {"_id": 0, "rendimentos": 1, "pago_total": 1, "portagens": 1, "gratificacao": 1, "uber_portagens": 1, "uber_gratificacoes": 1}).to_list(100)
            
            ganhos_uber = 0.0
            uber_portagens = 0.0
            uber_gratificacoes = 0.0
            for r in uber_records:
                valor_base = float(r.get("rendimentos") or r.get("pago_total") or 0)
                port = float(r.get("portagens") or r.get("uber_portagens") or 0)
                grat = float(r.get("gratificacao") or r.get("uber_gratificacoes") or 0)
                # Ganhos Uber = valor base menos portagens e gratificações
                ganhos_uber += valor_base - port - grat
                uber_portagens += port
                uber_gratificacoes += grat
            
            # Ganhos Bolt
            bolt_records = await db.ganhos_bolt.find({
                "motorista_id": motorista_id,
                "$or": [
                    {"periodo_semana": semana, "periodo_ano": ano},
                    {"semana": semana, "ano": ano}
                ]
            }, {"_id": 0, "ganhos_liquidos": 1}).to_list(100)
            ganhos_bolt = sum(float(r.get("ganhos_liquidos") or 0) for r in bolt_records)
            
            # Via Verde - buscar pela matrícula do veículo do motorista
            via_verde = 0.0
            if matricula_veiculo:
                matricula_normalizada = matricula_veiculo.replace("-", "").replace(" ", "")
                vv_query = {
                    "$or": [
                        {"matricula": matricula_veiculo},
                        {"matricula": matricula_normalizada}
                    ],
                    "$and": [
                        {"$or": [
                            {"semana": semana, "ano": ano},
                            {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}},
                            {"data": {"$gte": data_inicio, "$lte": data_fim}}
                        ]}
                    ]
                }
                vv_records = await db.portagens_viaverde.find(vv_query, {"_id": 0}).to_list(100)
                for r in vv_records:
                    market_desc = str(r.get("market_description", "")).strip().lower()
                    if not market_desc or market_desc in ["portagens", "parques"] or "mensalidade" in market_desc or "mobilidade" in market_desc:
                        via_verde += float(r.get("valor") or r.get("value") or 0)
            
            # Combustível - buscar também detalhes para a lista
            comb_records = await db.abastecimentos_combustivel.find({
                "motorista_id": motorista_id,
                "data": {"$gte": data_inicio, "$lte": data_fim}
            }, {"_id": 0, "valor_total": 1, "valor": 1, "valor_liquido": 1, "data": 1, "hora": 1, "posto": 1}).to_list(100)
            combustivel = sum(float(r.get("valor_total") or r.get("valor") or r.get("valor_liquido") or 0) for r in comb_records)
            
            # Adicionar abastecimentos à lista global
            for r in comb_records:
                todos_abastecimentos.append({
                    "motorista": motorista_nome,
                    "data": r.get("data", ""),
                    "hora": r.get("hora", ""),
                    "posto": r.get("posto", "N/A"),
                    "valor": float(r.get("valor_total") or r.get("valor") or r.get("valor_liquido") or 0)
                })
            
            # Nota: Combustível (Prio) é buscado fora do loop de motoristas porque é por parceiro
            
            # Elétrico
            elet_records = await db.despesas_combustivel.find({
                "motorista_id": motorista_id,
                "$or": [
                    {"semana": semana, "ano": ano},
                    {"data": {"$gte": data_inicio, "$lte": data_fim}}
                ]
            }, {"_id": 0, "valor_total": 1}).to_list(100)
            eletrico = sum(float(r.get("valor_total") or 0) for r in elet_records)
            
            # Aluguer - buscar do veículo se não estiver definido no motorista
            aluguer = float(m.get("valor_aluguer_semanal") or 0)
            if aluguer == 0 and veiculo_id:
                if veiculo:
                    aluguer = calcular_aluguer_semanal(veiculo, semana, ano)
            
            # Extras
            extras_records = await db.despesas_extras.find({
                "motorista_id": motorista_id,
                "$or": [
                    {"semana": semana, "ano": ano},
                    {"semana": None}
                ]
            }, {"_id": 0, "valor": 1, "tipo": 1, "status": 1}).to_list(100)
            extras = 0.0
            for r in extras_records:
                # Só somar extras não pagos ou pendentes
                if r.get("status", "pendente") != "cancelado":
                    valor_extra = float(r.get("valor") or 0)
                    # Se for crédito, subtrair; se for débito, somar
                    if r.get("tipo") == "credito":
                        extras -= valor_extra
                    else:
                        extras += valor_extra
        
        # Líquido = (Uber + uPort + uGrat + Bolt) - (Via Verde + Comb. + Elétr. + Aluguer + Extras)
        liquido = ganhos_uber + uber_portagens + uber_gratificacoes + ganhos_bolt - via_verde - combustivel - eletrico - aluguer - extras
        
        # Lucro do Parceiro para este motorista
        # Regra: Se saldo do motorista (liquido) >= 0, lucro = aluguer + extras
        # Se saldo < 0, lucro = aluguer + extras + liquido (diminuído pela dívida)
        lucro_parc_mot = (aluguer + extras) if liquido >= 0 else (aluguer + extras + liquido)
        
        motoristas_data.append({
            "nome": m.get("name", ""),
            "uber": ganhos_uber,
            "uber_portagens": uber_portagens,
            "uber_gratificacoes": uber_gratificacoes,
            "bolt": ganhos_bolt,
            "via_verde": via_verde,
            "combustivel": combustivel,
            "eletrico": eletrico,
            "aluguer": aluguer,
            "extras": extras,
            "liquido": liquido,
            "lucro_parceiro": lucro_parc_mot
        })
        
        totais["ganhos_uber"] += ganhos_uber
        totais["uber_portagens"] = totais.get("uber_portagens", 0) + uber_portagens
        totais["uber_gratificacoes"] = totais.get("uber_gratificacoes", 0) + uber_gratificacoes
        totais["ganhos_bolt"] += ganhos_bolt
        totais["via_verde"] += via_verde  # Somar via verde por motorista
        totais["combustivel"] += combustivel  # Somar combustível por motorista
        totais["eletrico"] += eletrico
        totais["aluguer"] += aluguer
        totais["extras"] += extras
        totais["lucro_parceiro"] = totais.get("lucro_parceiro", 0) + lucro_parc_mot
    
    totais["liquido"] = (
        totais["ganhos_uber"] + totais.get("uber_portagens", 0) + totais.get("uber_gratificacoes", 0) + totais["ganhos_bolt"] - 
        totais["via_verde"] - totais["combustivel"] - totais["eletrico"] - totais["aluguer"] - totais["extras"]
    )
    
    # Gerar PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.grey)
    info_style = ParagraphStyle('Info', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor('#333333'))
    
    elements = []
    
    # Título
    elements.append(Paragraph(f"Resumo Semanal do Parceiro", title_style))
    elements.append(Paragraph(f"Semana {semana}/{ano} ({week_start.strftime('%d/%m/%Y')} a {week_end.strftime('%d/%m/%Y')})", subtitle_style))
    
    # ============ CABEÇALHO COM DADOS DO PARCEIRO ============
    header_lines = []
    
    # Nome do Parceiro
    if config_relatorio and config_relatorio.get("incluir_nome_parceiro", True):
        if parceiro_dados and parceiro_dados.get("name"):
            header_lines.append(f"<b>Parceiro:</b> {parceiro_dados['name']}")
    
    # NIF do Parceiro
    if config_relatorio and config_relatorio.get("incluir_nif_parceiro", False):
        if parceiro_dados and parceiro_dados.get("nif"):
            header_lines.append(f"<b>NIF:</b> {parceiro_dados['nif']}")
    
    # Número do Relatório
    if config_relatorio and config_relatorio.get("incluir_numero_relatorio", False):
        formato = config_relatorio.get("formato_numero_relatorio", "xxxxx/ano")
        # Gerar número sequencial simples baseado na semana/ano
        numero_seq = str(semana).zfill(5)
        numero_relatorio = formato.replace("xxxxx", numero_seq).replace("ano", str(ano))
        header_lines.append(f"<b>Nº Relatório:</b> {numero_relatorio}")
    
    # Data de emissão
    if config_relatorio and config_relatorio.get("incluir_data_emissao", True):
        header_lines.append(f"<b>Data de Emissão:</b> {datetime.now().strftime('%d/%m/%Y')}")
    
    if header_lines:
        elements.append(Spacer(1, 5*mm))
        elements.append(Paragraph(" | ".join(header_lines), info_style))
    
    elements.append(Spacer(1, 10*mm))
    
    # Tabela de motoristas
    table_data = [
        ["Motorista", "Uber", "uPort", "uGrat", "Bolt", "V.Verde", "Comb.", "Elétr.", "Alug.", "Extras", "Líquido", "L.Parc."]
    ]
    
    for m in sorted(motoristas_data, key=lambda x: x["nome"]):
        table_data.append([
            m["nome"][:18],
            f"€{m['uber']:.2f}",
            f"€{m.get('uber_portagens', 0):.2f}",
            f"€{m.get('uber_gratificacoes', 0):.2f}",
            f"€{m['bolt']:.2f}",
            f"€{m['via_verde']:.2f}",
            f"€{m['combustivel']:.2f}",
            f"€{m['eletrico']:.2f}",
            f"€{m['aluguer']:.2f}",
            f"€{m['extras']:.2f}",
            f"€{m['liquido']:.2f}",
            f"€{m.get('lucro_parceiro', 0):.2f}"
        ])
    
    # Linha de totais
    table_data.append([
        "TOTAIS",
        f"€{totais['ganhos_uber']:.2f}",
        f"€{totais.get('uber_portagens', 0):.2f}",
        f"€{totais.get('uber_gratificacoes', 0):.2f}",
        f"€{totais['ganhos_bolt']:.2f}",
        f"€{totais['via_verde']:.2f}",
        f"€{totais['combustivel']:.2f}",
        f"€{totais['eletrico']:.2f}",
        f"€{totais['aluguer']:.2f}",
        f"€{totais['extras']:.2f}",
        f"€{totais['liquido']:.2f}",
        f"€{totais.get('lucro_parceiro', 0):.2f}"
    ])
    
    col_widths = [32*mm, 12*mm, 11*mm, 11*mm, 12*mm, 13*mm, 12*mm, 12*mm, 12*mm, 12*mm, 15*mm, 15*mm]
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
    
    # Resumo - usando a nova lógica de lucro do parceiro
    lucro_parceiro_total = totais.get("lucro_parceiro", 0)
    
    summary_data = [
        ["Receitas do Parceiro", ""],
        ["  Alugueres", f"€{totais['aluguer']:.2f}"],
        ["  Extras", f"€{totais['extras']:.2f}"],
        ["Despesas Operacionais", ""],
        ["  Via Verde", f"€{totais['via_verde']:.2f}"],
        ["  Combustível", f"€{totais['combustivel']:.2f}"],
        ["  Elétrico", f"€{totais['eletrico']:.2f}"],
        ["", ""],
        ["LUCRO TOTAL DO PARCEIRO", f"€{lucro_parceiro_total:.2f}"],
    ]
    
    summary_table = Table(summary_data, colWidths=[80*mm, 40*mm])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 3), (0, 3), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e9d8fd') if lucro_parceiro_total >= 0 else colors.HexColor('#f8d7da')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#6b21a8')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    
    elements.append(summary_table)
    
    # ============ LISTA DE ABASTECIMENTOS ============
    if todos_abastecimentos:
        elements.append(Spacer(1, 10*mm))
        
        section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor('#1e3a5f'))
        elements.append(Paragraph("Detalhes dos Abastecimentos", section_style))
        elements.append(Spacer(1, 3*mm))
        
        # Ordenar por data
        todos_abastecimentos_sorted = sorted(todos_abastecimentos, key=lambda x: (x.get("data", ""), x.get("hora", "")))
        
        # Criar tabela de abastecimentos
        abast_table_data = [
            ["Motorista", "Data", "Hora", "Posto", "Valor"]
        ]
        
        for ab in todos_abastecimentos_sorted:
            # Formatar data
            data_str = ab.get("data", "")
            if data_str:
                try:
                    if "T" in data_str:
                        data_str = data_str.split("T")[0]
                    data_obj = datetime.strptime(data_str, "%Y-%m-%d")
                    data_str = data_obj.strftime("%d/%m/%Y")
                except:
                    pass
            
            abast_table_data.append([
                ab.get("motorista", "")[:18],
                data_str,
                ab.get("hora", "")[:5] if ab.get("hora") else "",
                ab.get("posto", "")[:15],
                f"€{ab.get('valor', 0):.2f}"
            ])
        
        # Linha de total
        total_abastecimentos = sum(ab.get("valor", 0) for ab in todos_abastecimentos)
        abast_table_data.append([
            "TOTAL",
            "",
            "",
            f"{len(todos_abastecimentos)} abastecimentos",
            f"€{total_abastecimentos:.2f}"
        ])
        
        abast_col_widths = [40*mm, 22*mm, 15*mm, 35*mm, 20*mm]
        abast_table = Table(abast_table_data, colWidths=abast_col_widths)
        
        abast_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f97316')),  # Laranja para combustível
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fed7aa')),  # Laranja claro para total
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('ALIGN', (1, 1), (2, -1), 'CENTER'),
            ('ALIGN', (4, 1), (4, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#fff7ed')]),
        ]))
        
        elements.append(abast_table)
    
    # ============ LISTA DE PORTAGENS VIA VERDE ============
    if todas_portagens:
        elements.append(Spacer(1, 10*mm))
        
        section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor('#1e3a5f'))
        elements.append(Paragraph("Detalhes das Portagens Via Verde", section_style))
        elements.append(Spacer(1, 3*mm))
        
        # Ordenar por data
        todas_portagens_sorted = sorted(todas_portagens, key=lambda x: (x.get("data", ""), x.get("hora", "")))
        
        # Criar tabela de portagens
        portagens_table_data = [
            ["Motorista", "Data", "Hora", "Local", "Valor"]
        ]
        
        for pg in todas_portagens_sorted:
            # Formatar data
            data_str = pg.get("data", "")
            if data_str:
                try:
                    if "T" in data_str:
                        data_str = data_str.split("T")[0]
                    data_obj = datetime.strptime(data_str, "%Y-%m-%d")
                    data_str = data_obj.strftime("%d/%m/%Y")
                except:
                    pass
            
            portagens_table_data.append([
                pg.get("motorista", "")[:18],
                data_str,
                pg.get("hora", "")[:5] if pg.get("hora") else "",
                pg.get("local", "")[:25],
                f"€{pg.get('valor', 0):.2f}"
            ])
        
        # Linha de total
        total_portagens_valor = sum(pg.get("valor", 0) for pg in todas_portagens)
        portagens_table_data.append([
            "TOTAL",
            "",
            "",
            f"{len(todas_portagens)} portagens",
            f"€{total_portagens_valor:.2f}"
        ])
        
        portagens_col_widths = [40*mm, 22*mm, 15*mm, 40*mm, 18*mm]
        portagens_table = Table(portagens_table_data, colWidths=portagens_col_widths)
        
        portagens_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#22c55e')),  # Verde para Via Verde
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#bbf7d0')),  # Verde claro para total
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('ALIGN', (1, 1), (2, -1), 'CENTER'),
            ('ALIGN', (4, 1), (4, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f0fdf4')]),
        ]))
        
        elements.append(portagens_table)
    
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
                "id": fname,  # Use ficheiro_nome as ID for delete/update operations
                "plataforma": "uber",
                "ficheiro_nome": fname,
                "data_importacao": r.get("created_at") or r.get("data_importacao"),
                "total_registos": 0,
                "total_valor": 0,
                "semana": r.get("semana"),
                "ano": r.get("ano"),
                "estado": r.get("estado", "processado")
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
                "id": fname,  # Use ficheiro_nome as ID for delete/update operations
                "plataforma": "bolt",
                "ficheiro_nome": fname,
                "data_importacao": r.get("created_at") or r.get("data_importacao"),
                "total_registos": 0,
                "total_valor": 0,
                "semana": r.get("periodo_semana") or r.get("semana"),
                "ano": r.get("periodo_ano") or r.get("ano"),
                "estado": r.get("estado", "processado")
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
                "id": fname,  # Use ficheiro_nome as ID for delete/update operations
                "plataforma": "viaverde",
                "ficheiro_nome": fname,
                "data_importacao": r.get("created_at") or r.get("data_importacao"),
                "total_registos": 0,
                "total_valor": 0,
                "semana": r.get("semana") or semana,
                "ano": r.get("ano") or ano,
                "estado": r.get("estado", "processado")
            }
        vv_by_file[fname]["total_registos"] += 1
        vv_by_file[fname]["total_valor"] += float(r.get("value") or 0)
    
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
                "id": fname,  # Use ficheiro_nome as ID for delete/update operations
                "plataforma": "combustivel",
                "ficheiro_nome": fname,
                "data_importacao": r.get("created_at") or r.get("data_importacao"),
                "total_registos": 0,
                "total_valor": 0,
                "semana": semana,
                "ano": ano,
                "estado": r.get("estado", "processado")
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
                "id": fname,  # Use ficheiro_nome as ID for delete/update operations
                "plataforma": "eletrico",
                "ficheiro_nome": fname,
                "data_importacao": r.get("created_at") or r.get("data_importacao"),
                "total_registos": 0,
                "total_valor": 0,
                "semana": r.get("semana") or semana,
                "ano": r.get("ano") or ano,
                "estado": r.get("estado", "processado")
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
    - Usar value para a soma
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
    total = sum(float(p.get("value") or 0) for p in filtered_portagens)
    
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
    uber_portagens = 0.0
    uber_records = await db.ganhos_uber.find({
        "motorista_id": motorista_id,
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    }, {"_id": 0}).to_list(100)
    ganhos_uber = sum(float(r.get("rendimentos") or r.get("pago_total") or 0) for r in uber_records)
    uber_portagens = sum(float(r.get("uber_portagens") or 0) for r in uber_records)
    
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
    
    # Também buscar em viagens_bolt
    viagens_bolt_records = await db.viagens_bolt.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0}).to_list(100)
    ganhos_bolt += sum(float(r.get("ganhos_liquidos") or r.get("valor_liquido") or 0) for r in viagens_bolt_records)
    
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
        via_verde = sum(float(r.get("value") or 0) for r in vv_records)
        
        # Combustível
        comb_records = await db.abastecimentos_combustivel.find({
            "$or": [{"motorista_id": motorista_id}, {"matricula": matricula}],
            "data": {"$gte": data_inicio, "$lte": data_fim}
        }, {"_id": 0}).to_list(100)
        combustivel = sum(float(r.get("valor_total") or r.get("valor") or r.get("valor_liquido") or 0) for r in comb_records)
        
        # Elétrico
        elet_records = await db.despesas_combustivel.find({
            "motorista_id": motorista_id,
            "$or": [
                {"semana": semana, "ano": ano},
                {"data": {"$gte": data_inicio, "$lte": data_fim}}
            ]
        }, {"_id": 0}).to_list(100)
        eletrico = sum(float(r.get("valor_total") or 0) for r in elet_records)
    
    # Total Ganhos = Rendimentos Uber + Uber Portagens + Ganhos Bolt
    total_ganhos = ganhos_uber + uber_portagens + ganhos_bolt
    total_despesas = combustivel + via_verde + eletrico
    valor_liquido = total_ganhos - total_despesas
    
    motorista_data = {
        "motorista_id": motorista_id,
        "motorista_nome": motorista.get("name"),
        "motorista_email": motorista.get("email"),
        "motorista_telefone": motorista.get("telefone") or motorista.get("phone"),
        "veiculo_matricula": veiculo.get("matricula") if veiculo else None,
        "ganhos_uber": ganhos_uber,
        "uber_portagens": uber_portagens,
        "ganhos_bolt": ganhos_bolt,
        "total_ganhos": total_ganhos,
        "combustivel": combustivel,
        "carregamento_eletrico": eletrico,
        "via_verde": via_verde,
        "total_despesas_operacionais": total_despesas,
        "valor_liquido_motorista": valor_liquido
    }
    
    # Obter parceiro_id para envio de email via SMTP do parceiro
    # Prioridade: current_user (se parceiro) > motorista.parceiro_id
    parceiro_id_para_email = None
    if current_user.get("role") == UserRole.PARCEIRO or current_user.get("role") == "parceiro":
        parceiro_id_para_email = current_user.get("id")
    if not parceiro_id_para_email:
        parceiro_id_para_email = motorista.get("parceiro_id") or motorista.get("parceiro_atribuido")
    
    # Enviar relatório
    result = await enviar_relatorio_motorista(
        motorista_data, 
        semana, 
        ano, 
        enviar_email, 
        enviar_whatsapp,
        db=db,
        parceiro_id=parceiro_id_para_email
    )
    
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
    ganhos_uber = sum(float(r.get("rendimentos") or r.get("pago_total") or 0) for r in uber_records)
    uber_portagens = sum(float(r.get("uber_portagens") or 0) for r in uber_records)
    
    bolt_records = await db.ganhos_bolt.find({
        "motorista_id": motorista_id,
        "$or": [{"periodo_semana": semana, "periodo_ano": ano}, {"semana": semana, "ano": ano}]
    }, {"_id": 0}).to_list(100)
    ganhos_bolt = sum(float(r.get("ganhos_liquidos") or 0) for r in bolt_records)
    
    # Também buscar em viagens_bolt
    viagens_bolt_records = await db.viagens_bolt.find({
        "motorista_id": motorista_id,
        "$or": [{"semana": semana, "ano": ano}, {"data": {"$gte": data_inicio, "$lte": data_fim}}]
    }, {"_id": 0}).to_list(100)
    ganhos_bolt += sum(float(r.get("ganhos_liquidos") or r.get("valor_liquido") or 0) for r in viagens_bolt_records)
    
    motorista_data = {
        "motorista_nome": motorista.get("name"),
        "veiculo_matricula": veiculo.get("matricula") if veiculo else "N/A",
        "ganhos_uber": ganhos_uber,
        "uber_portagens": uber_portagens,
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



# ==================== FLUXO DE APROVAÇÃO DE RELATÓRIOS ====================
# Estados: pendente -> aprovado -> aguardar_recibo -> a_pagamento -> liquidado

@router.put("/parceiro/resumo-semanal/motorista/{motorista_id}/status")
async def update_motorista_relatorio_status(
    motorista_id: str,
    status_data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """
    Atualizar o status do relatório semanal de um motorista.
    Estados: pendente -> aprovado -> aguardar_recibo -> a_pagamento -> liquidado
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    novo_status = status_data.get("status")
    semana = status_data.get("semana")
    ano = status_data.get("ano")
    
    if not novo_status or not semana or not ano:
        raise HTTPException(status_code=400, detail="status, semana e ano são obrigatórios")
    
    valid_statuses = ["pendente", "aprovado", "aguardar_recibo", "a_pagamento", "liquidado"]
    if novo_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Valores válidos: {valid_statuses}")
    
    # Verificar se o motorista pertence ao parceiro
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    if current_user["role"] in [UserRole.PARCEIRO, "parceiro"]:
        if motorista.get("parceiro_id") != current_user["id"] and motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Atualizar ou criar registro de status
    status_update = {
        "motorista_id": motorista_id,
        "semana": int(semana),
        "ano": int(ano),
        "status_aprovacao": novo_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    # Adicionar campos específicos por status
    if novo_status == "aprovado":
        status_update["data_aprovacao"] = datetime.now(timezone.utc).isoformat()
    elif novo_status == "aguardar_recibo":
        status_update["data_envio_relatorio"] = datetime.now(timezone.utc).isoformat()
    elif novo_status == "a_pagamento":
        status_update["data_recibo_uploaded"] = status_data.get("data_recibo") or datetime.now(timezone.utc).isoformat()
    elif novo_status == "liquidado":
        status_update["data_liquidacao"] = datetime.now(timezone.utc).isoformat()
    
    await db.status_relatorios.update_one(
        {"motorista_id": motorista_id, "semana": int(semana), "ano": int(ano)},
        {"$set": status_update},
        upsert=True
    )
    
    logger.info(f"Status relatório {motorista.get('name')} S{semana}/{ano} -> {novo_status}")
    
    return {"message": f"Status atualizado para {novo_status}", "status": novo_status}


@router.post("/parceiro/resumo-semanal/motorista/{motorista_id}/upload-recibo")
async def upload_recibo_motorista(
    motorista_id: str,
    semana: int,
    ano: int,
    empresa_faturacao_id: Optional[str] = None,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """
    Upload de recibo verde ou autofaturação para um relatório semanal.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verificar se o motorista pertence ao parceiro
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    if current_user["role"] in [UserRole.PARCEIRO, "parceiro"]:
        if motorista.get("parceiro_id") != current_user["id"] and motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Verificar empresa de faturação se fornecida
    empresa_faturacao_info = None
    if empresa_faturacao_id:
        empresa = await db.empresas_faturacao.find_one({"id": empresa_faturacao_id}, {"_id": 0})
        if empresa:
            empresa_faturacao_info = {
                "id": empresa.get("id"),
                "nome": empresa.get("nome"),
                "nipc": empresa.get("nipc")
            }
    
    # Salvar arquivo
    upload_dir = Path("/app/uploads/recibos")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
    file_id = str(uuid.uuid4())
    filename = f"recibo_{motorista_id}_S{semana}_{ano}_{file_id}.{file_ext}"
    file_path = upload_dir / filename
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Atualizar status para a_pagamento
    status_update = {
        "motorista_id": motorista_id,
        "semana": int(semana),
        "ano": int(ano),
        "status_aprovacao": "a_pagamento",
        "recibo_path": str(file_path),
        "recibo_filename": file.filename,
        "empresa_faturacao_id": empresa_faturacao_id,
        "empresa_faturacao_info": empresa_faturacao_info,
        "data_recibo_uploaded": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.status_relatorios.update_one(
        {"motorista_id": motorista_id, "semana": int(semana), "ano": int(ano)},
        {"$set": status_update},
        upsert=True
    )
    
    logger.info(f"Recibo uploaded para {motorista.get('name')} S{semana}/{ano} - Empresa: {empresa_faturacao_info.get('nome') if empresa_faturacao_info else 'N/A'}")
    
    return {
        "message": "Recibo uploaded com sucesso",
        "filename": filename,
        "status": "a_pagamento",
        "empresa_faturacao": empresa_faturacao_info
    }


@router.get("/parceiro/resumo-semanal/status")
async def get_relatorios_status(
    semana: int,
    ano: int,
    current_user: Dict = Depends(get_current_user)
):
    """
    Obter status de aprovação de todos os relatórios de uma semana.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"semana": int(semana), "ano": int(ano)}
    
    if current_user["role"] in [UserRole.PARCEIRO, "parceiro"]:
        # Buscar motoristas do parceiro
        motoristas = await db.motoristas.find({
            "$or": [
                {"parceiro_id": current_user["id"]},
                {"parceiro_atribuido": current_user["id"]}
            ]
        }, {"_id": 0, "id": 1}).to_list(1000)
        motorista_ids = [m["id"] for m in motoristas]
        query["motorista_id"] = {"$in": motorista_ids}
    
    status_list = await db.status_relatorios.find(query, {"_id": 0}).to_list(1000)
    
    # Converter para dicionário por motorista_id
    status_dict = {s["motorista_id"]: s for s in status_list}
    
    return status_dict


@router.post("/parceiro/resumo-semanal/motorista/{motorista_id}/upload-comprovativo")
async def upload_comprovativo_pagamento(
    motorista_id: str,
    semana: int,
    ano: int,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """
    Upload de comprovativo de pagamento para um relatório semanal.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verificar se o motorista pertence ao parceiro
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    if current_user["role"] in [UserRole.PARCEIRO, "parceiro"]:
        if motorista.get("parceiro_id") != current_user["id"] and motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Salvar arquivo
    upload_dir = Path("/app/uploads/comprovativos")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
    file_id = str(uuid.uuid4())
    filename = f"comprovativo_{motorista_id}_S{semana}_{ano}_{file_id}.{file_ext}"
    file_path = upload_dir / filename
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Atualizar status com comprovativo
    status_update = {
        "comprovativo_path": str(file_path),
        "comprovativo_filename": file.filename,
        "data_comprovativo_uploaded": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.status_relatorios.update_one(
        {"motorista_id": motorista_id, "semana": int(semana), "ano": int(ano)},
        {"$set": status_update},
        upsert=True
    )
    
    logger.info(f"Comprovativo uploaded para {motorista.get('name')} S{semana}/{ano}")
    
    return {
        "message": "Comprovativo de pagamento enviado com sucesso",
        "filename": filename
    }


# ==================== ENDPOINTS PARA DOWNLOAD DE FICHEIROS ====================

@router.get("/files/recibos/{filename}")
async def download_recibo_file(
    filename: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Download de ficheiro de recibo.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    file_path = Path("/app/uploads/recibos") / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream"
    )


@router.get("/files/comprovativos/{filename}")
async def download_comprovativo_file(
    filename: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Download de ficheiro de comprovativo de pagamento.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    file_path = Path("/app/uploads/comprovativos") / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream"
    )
