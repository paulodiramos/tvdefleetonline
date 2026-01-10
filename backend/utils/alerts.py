"""Alert checking utilities for FleeTrack application"""

import uuid
import logging
from datetime import datetime, timezone, date, timedelta

from utils.database import get_database
from utils.file_handlers import safe_parse_date

logger = logging.getLogger(__name__)
db = get_database()


async def auto_add_to_agenda(vehicle_id: str, tipo: str, data_vencimento: str, titulo: str):
    """Automatically add event to vehicle agenda when date is filled"""
    try:
        # Parse date
        vencimento_date = datetime.strptime(data_vencimento, "%Y-%m-%d")
        # Set reminder for 30 days before
        reminder_date = (vencimento_date - timedelta(days=30)).strftime("%Y-%m-%d")
        
        evento = {
            "id": str(uuid.uuid4()),
            "tipo": tipo,
            "titulo": titulo,
            "data": reminder_date,
            "hora": "09:00",
            "descricao": f"Lembrete: {titulo} vence em {data_vencimento}",
            "auto_gerado": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Add to vehicle agenda
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$push": {"agenda": evento}}
        )
        
        logger.info(f"Auto-added to agenda: {titulo} for vehicle {vehicle_id}")
    except Exception as e:
        logger.error(f"Error auto-adding to agenda: {e}")


async def check_and_create_alerts():
    """
    Check all vehicles and drivers for expiring documents/maintenance
    and create alerts if needed
    """
    # Get admin settings for thresholds
    admin_settings = await db.admin_settings.find_one({"id": "admin_settings"})
    if not admin_settings:
        # Default settings
        km_aviso_manutencao = 5000
    else:
        km_aviso_manutencao = admin_settings.get("km_aviso_manutencao", 5000)
    
    today = date.today()
    
    # Check vehicles
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(None)
    
    for vehicle in vehicles:
        vehicle_id = vehicle["id"]
        
        # Check registration expiry
        if vehicle.get("validade_matricula"):
            await _check_vehicle_registration(vehicle, vehicle_id, today)
        
        # Check insurance expiry
        if vehicle.get("insurance") and vehicle["insurance"].get("data_validade"):
            await _check_vehicle_insurance(vehicle, vehicle_id, today)
        
        # Check next inspection
        if vehicle.get("inspection") and vehicle["inspection"].get("proxima_inspecao"):
            await _check_vehicle_inspection(vehicle, vehicle_id, today)
        
        # Check fire extinguisher expiry
        if vehicle.get("extintor") and vehicle["extintor"].get("data_validade"):
            await _check_vehicle_extinguisher(vehicle, vehicle_id, today)
        
        # Check maintenance (based on km)
        if vehicle.get("maintenance_history"):
            await _check_vehicle_maintenance(vehicle, vehicle_id, km_aviso_manutencao)
    
    # Check motoristas
    motoristas = await db.motoristas.find({}, {"_id": 0}).to_list(None)
    
    for motorista in motoristas:
        motorista_id = motorista["id"]
        
        # Check TVDE license expiry
        if motorista.get("licenca_tvde_validade"):
            await _check_motorista_tvde_license(motorista, motorista_id, today)
        
        # Check driver's license expiry
        if motorista.get("carta_conducao_validade"):
            await _check_motorista_driving_license(motorista, motorista_id, today)


async def _check_vehicle_registration(vehicle: dict, vehicle_id: str, today: date):
    """Check vehicle registration expiry"""
    try:
        parsed_date = safe_parse_date(vehicle["validade_matricula"])
        if not parsed_date:
            return
        validade_date = parsed_date.date()
        days_until_expiry = (validade_date - today).days
        
        if 0 <= days_until_expiry <= 30:
            existing_alert = await db.alertas.find_one({
                "tipo": "validade_matricula",
                "entidade_id": vehicle_id,
                "status": "ativo"
            })
            
            if not existing_alert:
                alert = {
                    "id": str(uuid.uuid4()),
                    "tipo": "validade_matricula",
                    "entidade_id": vehicle_id,
                    "entidade_tipo": "veiculo",
                    "titulo": f"Matrícula expira em breve - {vehicle['matricula']}",
                    "descricao": f"A matrícula do veículo {vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']}) expira em {days_until_expiry} dias.",
                    "data_vencimento": vehicle["validade_matricula"],
                    "prioridade": "alta" if days_until_expiry <= 7 else "media",
                    "dias_antecedencia": 30,
                    "status": "ativo",
                    "criado_em": datetime.now(timezone.utc).isoformat()
                }
                await db.alertas.insert_one(alert)
    except Exception as e:
        logger.error(f"Error creating registration alert: {e}")


async def _check_vehicle_insurance(vehicle: dict, vehicle_id: str, today: date):
    """Check vehicle insurance expiry"""
    try:
        parsed_date = safe_parse_date(vehicle["insurance"]["data_validade"])
        if not parsed_date:
            return
        validade_date = parsed_date.date()
        days_until_expiry = (validade_date - today).days
        
        if 0 <= days_until_expiry <= 30:
            existing_alert = await db.alertas.find_one({
                "tipo": "seguro",
                "entidade_id": vehicle_id,
                "status": "ativo"
            })
            
            if not existing_alert:
                alert = {
                    "id": str(uuid.uuid4()),
                    "tipo": "seguro",
                    "entidade_id": vehicle_id,
                    "entidade_tipo": "veiculo",
                    "titulo": f"Seguro expira em breve - {vehicle['matricula']}",
                    "descricao": f"O seguro do veículo {vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']}) expira em {days_until_expiry} dias.",
                    "data_vencimento": vehicle["insurance"]["data_validade"],
                    "prioridade": "alta",
                    "dias_antecedencia": 30,
                    "status": "ativo",
                    "criado_em": datetime.now(timezone.utc).isoformat()
                }
                await db.alertas.insert_one(alert)
    except Exception as e:
        logger.error(f"Error creating insurance alert: {e}")


async def _check_vehicle_inspection(vehicle: dict, vehicle_id: str, today: date):
    """Check vehicle inspection date"""
    try:
        parsed_date = safe_parse_date(vehicle["inspection"]["proxima_inspecao"])
        if not parsed_date:
            return
        proxima_date = parsed_date.date()
        days_until_inspection = (proxima_date - today).days
        
        if 0 <= days_until_inspection <= 30:
            existing_alert = await db.alertas.find_one({
                "tipo": "inspecao",
                "entidade_id": vehicle_id,
                "status": "ativo"
            })
            
            if not existing_alert:
                alert = {
                    "id": str(uuid.uuid4()),
                    "tipo": "inspecao",
                    "entidade_id": vehicle_id,
                    "entidade_tipo": "veiculo",
                    "titulo": f"Inspeção em breve - {vehicle['matricula']}",
                    "descricao": f"A próxima inspeção do veículo {vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']}) está marcada para {days_until_inspection} dias.",
                    "data_vencimento": vehicle["inspection"]["proxima_inspecao"],
                    "prioridade": "media",
                    "dias_antecedencia": 30,
                    "status": "ativo",
                    "criado_em": datetime.now(timezone.utc).isoformat()
                }
                await db.alertas.insert_one(alert)
    except Exception as e:
        logger.error(f"Error creating inspection alert: {e}")


async def _check_vehicle_extinguisher(vehicle: dict, vehicle_id: str, today: date):
    """Check vehicle fire extinguisher expiry"""
    try:
        parsed_date = safe_parse_date(vehicle["extintor"]["data_validade"])
        if not parsed_date:
            return
        validade_date = parsed_date.date()
        days_until_expiry = (validade_date - today).days
        
        if 0 <= days_until_expiry <= 30:
            existing_alert = await db.alertas.find_one({
                "tipo": "extintor",
                "entidade_id": vehicle_id,
                "status": "ativo"
            })
            
            if not existing_alert:
                alert = {
                    "id": str(uuid.uuid4()),
                    "tipo": "extintor",
                    "entidade_id": vehicle_id,
                    "entidade_tipo": "veiculo",
                    "titulo": f"Extintor expira em breve - {vehicle['matricula']}",
                    "descricao": f"O extintor do veículo {vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']}) expira em {days_until_expiry} dias.",
                    "data_vencimento": vehicle["extintor"]["data_validade"],
                    "prioridade": "alta",
                    "dias_antecedencia": 30,
                    "status": "ativo",
                    "criado_em": datetime.now(timezone.utc).isoformat()
                }
                await db.alertas.insert_one(alert)
    except Exception as e:
        logger.error(f"Error creating extinguisher alert: {e}")


async def _check_vehicle_maintenance(vehicle: dict, vehicle_id: str, km_aviso_manutencao: int):
    """Check vehicle maintenance needs based on km"""
    for maintenance in vehicle["maintenance_history"]:
        if maintenance.get("km_proxima"):
            km_atual = vehicle.get("km_atual", 0)
            km_restantes = maintenance["km_proxima"] - km_atual
            
            if 0 <= km_restantes <= km_aviso_manutencao:
                existing_alert = await db.alertas.find_one({
                    "tipo": "manutencao",
                    "entidade_id": vehicle_id,
                    "status": "ativo",
                    "descricao": {"$regex": maintenance.get("tipo_manutencao", "")}
                })
                
                if not existing_alert:
                    alert = {
                        "id": str(uuid.uuid4()),
                        "tipo": "manutencao",
                        "entidade_id": vehicle_id,
                        "entidade_tipo": "veiculo",
                        "titulo": f"Manutenção necessária - {vehicle['matricula']}",
                        "descricao": f"O veículo {vehicle['marca']} {vehicle['modelo']} ({vehicle['matricula']}) precisa de {maintenance.get('tipo_manutencao', 'manutenção')} em {km_restantes} km.",
                        "data_vencimento": "",
                        "prioridade": "alta" if km_restantes <= 500 else "media",
                        "dias_antecedencia": 0,
                        "status": "ativo",
                        "criado_em": datetime.now(timezone.utc).isoformat()
                    }
                    await db.alertas.insert_one(alert)


async def _check_motorista_tvde_license(motorista: dict, motorista_id: str, today: date):
    """Check motorista TVDE license expiry"""
    try:
        parsed_date = safe_parse_date(motorista["licenca_tvde_validade"])
        if not parsed_date:
            return
        validade_date = parsed_date.date()
        days_until_expiry = (validade_date - today).days
        
        if 0 <= days_until_expiry <= 30:
            existing_alert = await db.alertas.find_one({
                "tipo": "licenca_tvde",
                "entidade_id": motorista_id,
                "status": "ativo"
            })
            
            if not existing_alert:
                alert = {
                    "id": str(uuid.uuid4()),
                    "tipo": "licenca_tvde",
                    "entidade_id": motorista_id,
                    "entidade_tipo": "motorista",
                    "titulo": f"Licença TVDE expira em breve - {motorista['name']}",
                    "descricao": f"A licença TVDE do motorista {motorista['name']} expira em {days_until_expiry} dias.",
                    "data_vencimento": motorista["licenca_tvde_validade"],
                    "prioridade": "alta",
                    "dias_antecedencia": 30,
                    "status": "ativo",
                    "criado_em": datetime.now(timezone.utc).isoformat()
                }
                await db.alertas.insert_one(alert)
    except Exception as e:
        logger.error(f"Error creating TVDE license alert: {e}")


async def _check_motorista_driving_license(motorista: dict, motorista_id: str, today: date):
    """Check motorista driving license expiry"""
    try:
        parsed_date = safe_parse_date(motorista["carta_conducao_validade"])
        if not parsed_date:
            return
        validade_date = parsed_date.date()
        days_until_expiry = (validade_date - today).days
        
        if 0 <= days_until_expiry <= 30:
            existing_alert = await db.alertas.find_one({
                "tipo": "carta_conducao",
                "entidade_id": motorista_id,
                "status": "ativo"
            })
            
            if not existing_alert:
                alert = {
                    "id": str(uuid.uuid4()),
                    "tipo": "carta_conducao",
                    "entidade_id": motorista_id,
                    "entidade_tipo": "motorista",
                    "titulo": f"Carta de condução expira em breve - {motorista['name']}",
                    "descricao": f"A carta de condução do motorista {motorista['name']} expira em {days_until_expiry} dias.",
                    "data_vencimento": motorista["carta_conducao_validade"],
                    "prioridade": "alta",
                    "dias_antecedencia": 30,
                    "status": "ativo",
                    "criado_em": datetime.now(timezone.utc).isoformat()
                }
                await db.alertas.insert_one(alert)
    except Exception as e:
        logger.error(f"Error creating driving license alert: {e}")
