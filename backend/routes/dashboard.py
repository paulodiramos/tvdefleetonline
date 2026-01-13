"""Dashboard and statistics routes"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List, Optional
from datetime import datetime, timedelta, timezone
import logging

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)


@router.get("/reports/dashboard")
async def get_dashboard_stats(current_user: Dict = Depends(get_current_user)):
    """Get main dashboard statistics"""
    query = {}
    motorista_query = {}
    
    # Filter by role
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
        motorista_query["parceiro_atribuido"] = current_user["id"]
    
    total_vehicles = await db.vehicles.count_documents(query)
    available_vehicles = await db.vehicles.count_documents({**query, "status": "disponivel"})
    total_motoristas = await db.motoristas.count_documents(motorista_query)
    pending_motoristas = await db.motoristas.count_documents({**motorista_query, "approved": False})
    
    # Filter revenues and expenses by parceiro's vehicles
    if current_user["role"] == UserRole.PARCEIRO:
        vehicles = await db.vehicles.find({"parceiro_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(10000)
        vehicle_ids = [v["id"] for v in vehicles]
        revenues = await db.revenues.find({"vehicle_id": {"$in": vehicle_ids}}, {"_id": 0}).to_list(10000)
        expenses = await db.expenses.find({"vehicle_id": {"$in": vehicle_ids}}, {"_id": 0}).to_list(10000)
    else:
        revenues = await db.revenues.find({}, {"_id": 0}).to_list(10000)
        expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    
    total_receitas = sum([r.get("valor", 0) for r in revenues])
    total_despesas = sum([e.get("valor", 0) for e in expenses])
    
    return {
        "total_vehicles": total_vehicles,
        "available_vehicles": available_vehicles,
        "total_motoristas": total_motoristas,
        "pending_motoristas": pending_motoristas,
        "total_receitas": total_receitas,
        "total_despesas": total_despesas,
        "roi": total_receitas - total_despesas
    }


@router.get("/reports/parceiro/semanal")
async def get_parceiro_weekly_report(current_user: Dict = Depends(get_current_user)):
    """Get weekly report for parceiro"""
    if current_user["role"] != UserRole.PARCEIRO:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get vehicles do parceiro
    vehicles = await db.vehicles.find({"parceiro_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(1000)
    vehicle_ids = [v["id"] for v in vehicles]
    
    # Get data from last 7 days
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    
    # Revenues
    revenues = await db.revenues.find({
        "vehicle_id": {"$in": vehicle_ids},
        "data": {"$gte": seven_days_ago}
    }, {"_id": 0}).to_list(10000)
    
    # Expenses
    expenses = await db.expenses.find({
        "vehicle_id": {"$in": vehicle_ids},
        "data": {"$gte": seven_days_ago}
    }, {"_id": 0}).to_list(10000)
    
    total_receitas = sum([r.get("valor", 0) for r in revenues])
    total_despesas = sum([e.get("valor", 0) for e in expenses])
    
    return {
        "periodo": f"{seven_days_ago} - {datetime.now().strftime('%Y-%m-%d')}",
        "total_veiculos": len(vehicle_ids),
        "total_receitas": total_receitas,
        "total_despesas": total_despesas,
        "lucro": total_receitas - total_despesas,
        "receitas_por_dia": {},
        "despesas_por_dia": {}
    }


@router.get("/parceiros/{parceiro_id}/estatisticas")
async def get_parceiro_estatisticas(
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get statistics for a specific parceiro"""
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Count vehicles
    total_veiculos = await db.vehicles.count_documents({"parceiro_id": parceiro_id})
    veiculos_disponiveis = await db.vehicles.count_documents({"parceiro_id": parceiro_id, "status": "disponivel"})
    veiculos_atribuidos = await db.vehicles.count_documents({"parceiro_id": parceiro_id, "motorista_atribuido": {"$ne": None}})
    
    # Count motoristas
    total_motoristas = await db.motoristas.count_documents({"parceiro_atribuido": parceiro_id})
    motoristas_ativos = await db.motoristas.count_documents({"parceiro_atribuido": parceiro_id, "approved": True})
    
    # Get vehicles for revenue/expense calculation
    vehicles = await db.vehicles.find({"parceiro_id": parceiro_id}, {"_id": 0, "id": 1}).to_list(1000)
    vehicle_ids = [v["id"] for v in vehicles]
    
    # Calculate revenues and expenses
    revenues = await db.revenues.find({"vehicle_id": {"$in": vehicle_ids}}, {"_id": 0, "valor": 1}).to_list(10000)
    expenses = await db.expenses.find({"vehicle_id": {"$in": vehicle_ids}}, {"_id": 0, "valor": 1}).to_list(10000)
    
    total_receitas = sum([r.get("valor", 0) for r in revenues])
    total_despesas = sum([e.get("valor", 0) for e in expenses])
    
    return {
        "parceiro_id": parceiro_id,
        "veiculos": {
            "total": total_veiculos,
            "disponiveis": veiculos_disponiveis,
            "atribuidos": veiculos_atribuidos,
            "ocupacao_percentual": round((veiculos_atribuidos / total_veiculos * 100) if total_veiculos > 0 else 0, 1)
        },
        "motoristas": {
            "total": total_motoristas,
            "ativos": motoristas_ativos,
            "pendentes": total_motoristas - motoristas_ativos
        },
        "financeiro": {
            "total_receitas": total_receitas,
            "total_despesas": total_despesas,
            "lucro_bruto": total_receitas - total_despesas,
            "margem_percentual": round(((total_receitas - total_despesas) / total_receitas * 100) if total_receitas > 0 else 0, 1)
        }
    }


@router.get("/vehicles/proximas-datas/dashboard")
async def get_proximas_datas_dashboard(current_user: Dict = Depends(get_current_user)):
    """Get upcoming important dates for vehicles (inspections, insurance, etc)"""
    query = {}
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    vehicles = await db.vehicles.find(query, {"_id": 0}).to_list(1000)
    
    hoje = datetime.now()
    proximos_30_dias = hoje + timedelta(days=30)
    
    alertas = []
    
    for vehicle in vehicles:
        matricula = vehicle.get("matricula", "N/A")
        
        # Check inspection
        if vehicle.get("inspecao_validade"):
            try:
                inspecao = datetime.strptime(vehicle["inspecao_validade"], "%Y-%m-%d")
                if inspecao <= proximos_30_dias:
                    dias = (inspecao - hoje).days
                    alertas.append({
                        "tipo": "inspecao",
                        "veiculo": matricula,
                        "veiculo_id": vehicle["id"],
                        "data": vehicle["inspecao_validade"],
                        "dias_restantes": dias,
                        "urgente": dias <= 7
                    })
            except:
                pass
        
        # Check insurance
        if vehicle.get("seguro_validade"):
            try:
                seguro = datetime.strptime(vehicle["seguro_validade"], "%Y-%m-%d")
                if seguro <= proximos_30_dias:
                    dias = (seguro - hoje).days
                    alertas.append({
                        "tipo": "seguro",
                        "veiculo": matricula,
                        "veiculo_id": vehicle["id"],
                        "data": vehicle["seguro_validade"],
                        "dias_restantes": dias,
                        "urgente": dias <= 7
                    })
            except:
                pass
        
        # Check IUC
        if vehicle.get("iuc_validade"):
            try:
                iuc = datetime.strptime(vehicle["iuc_validade"], "%Y-%m-%d")
                if iuc <= proximos_30_dias:
                    dias = (iuc - hoje).days
                    alertas.append({
                        "tipo": "iuc",
                        "veiculo": matricula,
                        "veiculo_id": vehicle["id"],
                        "data": vehicle["iuc_validade"],
                        "dias_restantes": dias,
                        "urgente": dias <= 7
                    })
            except:
                pass
    
    # Sort by days remaining
    alertas.sort(key=lambda x: x["dias_restantes"])
    
    return {
        "total_alertas": len(alertas),
        "alertas_urgentes": len([a for a in alertas if a["urgente"]]),
        "alertas": alertas[:20]  # Limit to 20
    }


@router.get("/alertas/dashboard-stats")
async def get_alertas_dashboard_stats(current_user: Dict = Depends(get_current_user)):
    """Get alert statistics for dashboard"""
    query = {}
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    # Count different types of alerts
    total_alertas = await db.alertas.count_documents(query)
    alertas_nao_lidos = await db.alertas.count_documents({**query, "lido": False})
    alertas_urgentes = await db.alertas.count_documents({**query, "prioridade": "urgente"})
    
    # Group by type
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$tipo", "count": {"$sum": 1}}}
    ]
    
    alertas_por_tipo = {}
    async for doc in db.alertas.aggregate(pipeline):
        alertas_por_tipo[doc["_id"]] = doc["count"]
    
    return {
        "total": total_alertas,
        "nao_lidos": alertas_nao_lidos,
        "urgentes": alertas_urgentes,
        "por_tipo": alertas_por_tipo
    }


@router.get("/dashboard/resumo-geral")
async def get_resumo_geral(current_user: Dict = Depends(get_current_user)):
    """Get general summary for dashboard"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Apenas Admin/Gestão")
    
    # Count all entities
    total_parceiros = await db.parceiros.count_documents({})
    total_motoristas = await db.motoristas.count_documents({})
    total_veiculos = await db.vehicles.count_documents({})
    total_users = await db.users.count_documents({})
    
    # Pending approvals
    users_pendentes = await db.users.count_documents({"approved": False})
    motoristas_pendentes = await db.motoristas.count_documents({"approved": False})
    
    # Active users (logged in last 7 days)
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    users_ativos = await db.users.count_documents({"last_login": {"$gte": seven_days_ago}})
    
    return {
        "entidades": {
            "parceiros": total_parceiros,
            "motoristas": total_motoristas,
            "veiculos": total_veiculos,
            "utilizadores": total_users
        },
        "pendentes": {
            "utilizadores": users_pendentes,
            "motoristas": motoristas_pendentes
        },
        "atividade": {
            "users_ativos_7d": users_ativos
        }
    }
