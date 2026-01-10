"""Reports routes for FleeTrack application - Refactored from server.py"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import logging

from utils.database import get_database
from utils.auth import get_current_user

# Setup logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/reports", tags=["reports"])

# Get database
db = get_database()


class UserRole:
    """User roles for authorization"""
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== ROI REPORTS ====================

@router.get("/roi/{vehicle_id}")
async def get_vehicle_roi(
    vehicle_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get ROI report for a specific vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check authorization for parceiro
    if current_user["role"] == UserRole.PARCEIRO and vehicle.get("parceiro_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Calculate revenues
    receitas = 0.0
    
    # Get alugueres from relatorios semanais
    relatorios = await db.relatorios_semanais.find(
        {"veiculo_id": vehicle_id},
        {"_id": 0}
    ).to_list(1000)
    
    for rel in relatorios:
        receitas += rel.get("valor_aluguer", 0) or 0
    
    # Calculate costs
    custos = 0.0
    
    # Insurance
    if vehicle.get("insurance"):
        custos += vehicle["insurance"].get("valor", 0) or 0
    
    # Maintenance
    for man in vehicle.get("manutencoes", []):
        custos += man.get("custos", 0) or man.get("valor", 0) or 0
    
    # Inspection
    if vehicle.get("inspection"):
        custos += vehicle["inspection"].get("custo", 0) or vehicle["inspection"].get("valor", 0) or 0
    
    # Extintor
    if vehicle.get("extintor"):
        custos += vehicle["extintor"].get("preco", 0) or 0
    
    # Calculate ROI
    lucro = receitas - custos
    roi = 0.0
    if custos > 0:
        roi = ((receitas - custos) / custos) * 100
    
    return {
        "vehicle_id": vehicle_id,
        "matricula": vehicle.get("matricula"),
        "receitas": round(receitas, 2),
        "custos": round(custos, 2),
        "lucro": round(lucro, 2),
        "roi": round(roi, 2)
    }


# ==================== DASHBOARD REPORTS ====================

@router.get("/dashboard")
async def get_dashboard_report(current_user: Dict = Depends(get_current_user)):
    """Get dashboard summary report"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    # Count vehicles
    total_veiculos = await db.vehicles.count_documents(query)
    veiculos_atribuidos = await db.vehicles.count_documents({
        **query,
        "motorista_atribuido": {"$ne": None}
    })
    
    # Count motoristas
    motoristas_query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        motoristas_query["parceiro_atribuido"] = current_user["id"]
    
    total_motoristas = await db.motoristas.count_documents(motoristas_query)
    motoristas_ativos = await db.motoristas.count_documents({
        **motoristas_query,
        "status_motorista": "ativo"
    })
    
    # Get current week earnings
    now = datetime.now(timezone.utc)
    semana_atual = now.isocalendar()[1]
    ano_atual = now.year
    
    relatorios_query = {"semana": semana_atual, "ano": ano_atual}
    if current_user["role"] == UserRole.PARCEIRO:
        relatorios_query["parceiro_id"] = current_user["id"]
    
    relatorios_semana = await db.relatorios_semanais.find(
        relatorios_query,
        {"_id": 0}
    ).to_list(1000)
    
    ganhos_semana = sum(r.get("total_ganhos", 0) or 0 for r in relatorios_semana)
    despesas_semana = sum(r.get("total_despesas", 0) or 0 for r in relatorios_semana)
    
    # Get alerts count
    alertas_query = {"status": "ativo"}
    if current_user["role"] == UserRole.PARCEIRO:
        # Get vehicle IDs for this parceiro
        vehicles = await db.vehicles.find({"parceiro_id": current_user["id"]}, {"id": 1}).to_list(1000)
        vehicle_ids = [v["id"] for v in vehicles]
        alertas_query["entidade_id"] = {"$in": vehicle_ids}
    
    total_alertas = await db.alertas.count_documents(alertas_query)
    
    return {
        "veiculos": {
            "total": total_veiculos,
            "atribuidos": veiculos_atribuidos,
            "disponiveis": total_veiculos - veiculos_atribuidos
        },
        "motoristas": {
            "total": total_motoristas,
            "ativos": motoristas_ativos,
            "inativos": total_motoristas - motoristas_ativos
        },
        "semana_atual": {
            "semana": semana_atual,
            "ano": ano_atual,
            "ganhos": round(ganhos_semana, 2),
            "despesas": round(despesas_semana, 2),
            "lucro": round(ganhos_semana - despesas_semana, 2)
        },
        "alertas": {
            "total": total_alertas
        }
    }


# ==================== PARCEIRO REPORTS ====================

@router.get("/parceiro/semanal")
async def get_parceiro_report_semanal(
    semana: Optional[int] = None,
    ano: Optional[int] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Get weekly report for parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc)
    semana = semana or now.isocalendar()[1]
    ano = ano or now.year
    
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else None
    
    # Get relatorios for this week
    query = {"semana": semana, "ano": ano}
    if parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    relatorios = await db.relatorios_semanais.find(query, {"_id": 0}).to_list(1000)
    
    # Aggregate data
    total_ganhos = sum(r.get("total_ganhos", 0) or 0 for r in relatorios)
    total_despesas = sum(r.get("total_despesas", 0) or 0 for r in relatorios)
    total_alugueres = sum(r.get("valor_aluguer", 0) or 0 for r in relatorios)
    total_comissoes = sum(r.get("comissao_motorista", 0) or 0 for r in relatorios)
    
    return {
        "semana": semana,
        "ano": ano,
        "total_relatorios": len(relatorios),
        "financeiro": {
            "ganhos": round(total_ganhos, 2),
            "despesas": round(total_despesas, 2),
            "alugueres": round(total_alugueres, 2),
            "comissoes": round(total_comissoes, 2),
            "lucro": round(total_ganhos - total_despesas - total_comissoes, 2)
        },
        "relatorios": relatorios
    }


@router.get("/parceiro/por-veiculo")
async def get_parceiro_report_por_veiculo(
    current_user: Dict = Depends(get_current_user)
):
    """Get report grouped by vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    vehicles = await db.vehicles.find(query, {"_id": 0}).to_list(1000)
    
    resultado = []
    for v in vehicles:
        # Get relatorios for this vehicle
        relatorios = await db.relatorios_semanais.find(
            {"veiculo_id": v["id"]},
            {"_id": 0}
        ).to_list(100)
        
        total_ganhos = sum(r.get("total_ganhos", 0) or 0 for r in relatorios)
        total_alugueres = sum(r.get("valor_aluguer", 0) or 0 for r in relatorios)
        
        resultado.append({
            "veiculo_id": v["id"],
            "matricula": v.get("matricula"),
            "marca": v.get("marca"),
            "modelo": v.get("modelo"),
            "motorista_atribuido": v.get("motorista_atribuido_nome"),
            "total_relatorios": len(relatorios),
            "total_ganhos": round(total_ganhos, 2),
            "total_alugueres": round(total_alugueres, 2)
        })
    
    return resultado


@router.get("/parceiro/por-motorista")
async def get_parceiro_report_por_motorista(
    current_user: Dict = Depends(get_current_user)
):
    """Get report grouped by motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_atribuido"] = current_user["id"]
    
    motoristas = await db.motoristas.find(query, {"_id": 0}).to_list(1000)
    
    resultado = []
    for m in motoristas:
        # Get relatorios for this motorista
        relatorios = await db.relatorios_semanais.find(
            {"motorista_id": m["id"]},
            {"_id": 0}
        ).to_list(100)
        
        total_ganhos = sum(r.get("total_ganhos", 0) or 0 for r in relatorios)
        total_comissoes = sum(r.get("comissao_motorista", 0) or 0 for r in relatorios)
        
        # Get vehicle info
        veiculo = None
        if m.get("veiculo_atribuido"):
            veiculo = await db.vehicles.find_one(
                {"id": m["veiculo_atribuido"]},
                {"_id": 0, "matricula": 1, "marca": 1, "modelo": 1}
            )
        
        resultado.append({
            "motorista_id": m["id"],
            "nome": m.get("name"),
            "status": m.get("status_motorista"),
            "veiculo": veiculo.get("matricula") if veiculo else None,
            "total_relatorios": len(relatorios),
            "total_ganhos": round(total_ganhos, 2),
            "total_comissoes": round(total_comissoes, 2)
        })
    
    return resultado


@router.get("/parceiro/proximas-despesas")
async def get_proximas_despesas(current_user: Dict = Depends(get_current_user)):
    """Get upcoming expenses (insurance renewals, inspections, etc.)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    from datetime import date
    
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    vehicles = await db.vehicles.find(query, {"_id": 0}).to_list(1000)
    
    today = date.today()
    proximos_30_dias = today + timedelta(days=30)
    proximos_90_dias = today + timedelta(days=90)
    
    despesas_proximas = []
    
    for v in vehicles:
        # Check insurance renewal
        if v.get("insurance") and v["insurance"].get("data_validade"):
            try:
                data_validade = datetime.strptime(v["insurance"]["data_validade"], "%Y-%m-%d").date()
                if today <= data_validade <= proximos_90_dias:
                    despesas_proximas.append({
                        "tipo": "seguro",
                        "veiculo_id": v["id"],
                        "matricula": v.get("matricula"),
                        "descricao": f"Renovação seguro - {v.get('matricula')}",
                        "data_vencimento": v["insurance"]["data_validade"],
                        "valor_estimado": v["insurance"].get("valor", 0),
                        "dias_restantes": (data_validade - today).days
                    })
            except Exception:
                pass
        
        # Check inspection
        if v.get("inspection") and v["inspection"].get("proxima_inspecao"):
            try:
                data_inspecao = datetime.strptime(v["inspection"]["proxima_inspecao"], "%Y-%m-%d").date()
                if today <= data_inspecao <= proximos_90_dias:
                    despesas_proximas.append({
                        "tipo": "inspecao",
                        "veiculo_id": v["id"],
                        "matricula": v.get("matricula"),
                        "descricao": f"Inspeção - {v.get('matricula')}",
                        "data_vencimento": v["inspection"]["proxima_inspecao"],
                        "valor_estimado": v["inspection"].get("custo", 30),
                        "dias_restantes": (data_inspecao - today).days
                    })
            except Exception:
                pass
        
        # Check next revision
        if v.get("proxima_revisao_data"):
            try:
                data_revisao = datetime.strptime(v["proxima_revisao_data"], "%Y-%m-%d").date()
                if today <= data_revisao <= proximos_90_dias:
                    despesas_proximas.append({
                        "tipo": "revisao",
                        "veiculo_id": v["id"],
                        "matricula": v.get("matricula"),
                        "descricao": f"Revisão - {v.get('matricula')}",
                        "data_vencimento": v["proxima_revisao_data"],
                        "valor_estimado": v.get("proxima_revisao_valor_previsto", 200),
                        "dias_restantes": (data_revisao - today).days
                    })
            except Exception:
                pass
        
        # Check extintor
        if v.get("extintor") and v["extintor"].get("data_validade"):
            try:
                data_extintor = datetime.strptime(v["extintor"]["data_validade"], "%Y-%m-%d").date()
                if today <= data_extintor <= proximos_90_dias:
                    despesas_proximas.append({
                        "tipo": "extintor",
                        "veiculo_id": v["id"],
                        "matricula": v.get("matricula"),
                        "descricao": f"Extintor - {v.get('matricula')}",
                        "data_vencimento": v["extintor"]["data_validade"],
                        "valor_estimado": v["extintor"].get("preco", 50),
                        "dias_restantes": (data_extintor - today).days
                    })
            except Exception:
                pass
    
    # Sort by date
    despesas_proximas.sort(key=lambda x: x.get("dias_restantes", 999))
    
    # Calculate totals
    total_30_dias = sum(d["valor_estimado"] for d in despesas_proximas if d["dias_restantes"] <= 30)
    total_90_dias = sum(d["valor_estimado"] for d in despesas_proximas)
    
    return {
        "despesas": despesas_proximas,
        "total_proximos_30_dias": round(total_30_dias, 2),
        "total_proximos_90_dias": round(total_90_dias, 2),
        "total_itens": len(despesas_proximas)
    }


# ==================== EVOLUTION REPORTS ====================

@router.get("/parceiro/evolucao-semanal")
async def get_evolucao_semanal(
    semanas: int = 12,
    current_user: Dict = Depends(get_current_user)
):
    """Get weekly evolution report for charts"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc)
    
    evolucao = []
    
    for i in range(semanas - 1, -1, -1):
        # Calculate week and year for i weeks ago
        data_semana = now - timedelta(weeks=i)
        semana = data_semana.isocalendar()[1]
        ano = data_semana.isocalendar()[0]
        
        query = {"semana": semana, "ano": ano}
        if current_user["role"] == UserRole.PARCEIRO:
            query["parceiro_id"] = current_user["id"]
        
        relatorios = await db.relatorios_semanais.find(query, {"_id": 0}).to_list(1000)
        
        total_ganhos = sum(r.get("total_ganhos", 0) or 0 for r in relatorios)
        total_despesas = sum(r.get("total_despesas", 0) or 0 for r in relatorios)
        total_lucro = total_ganhos - total_despesas
        
        evolucao.append({
            "semana": semana,
            "ano": ano,
            "label": f"S{semana}/{ano}",
            "ganhos": round(total_ganhos, 2),
            "despesas": round(total_despesas, 2),
            "lucro": round(total_lucro, 2),
            "total_relatorios": len(relatorios)
        })
    
    return evolucao
