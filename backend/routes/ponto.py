"""
Rotas para Relógio de Ponto dos Motoristas
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/ponto", tags=["Relógio de Ponto"])
logger = logging.getLogger(__name__)
db = get_database()


class CheckInRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    hora: Optional[str] = None


class CheckOutRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    hora: Optional[str] = None


class PausaRequest(BaseModel):
    tipo: str  # 'iniciar' ou 'retomar'
    hora: Optional[str] = None


@router.get("/estado-atual")
async def get_estado_atual(current_user: dict = Depends(get_current_user)):
    """Obter estado atual do ponto do motorista"""
    
    # Procurar registo de ponto ativo (sem check-out)
    ponto_ativo = await db.registos_ponto.find_one({
        "user_id": current_user["id"],
        "check_out": None
    }, sort=[("check_in", -1)])
    
    if not ponto_ativo:
        return {
            "ativo": False,
            "em_pausa": False,
            "hora_inicio": None
        }
    
    # Verificar se está em pausa
    ultima_pausa = None
    if ponto_ativo.get("pausas"):
        for pausa in reversed(ponto_ativo["pausas"]):
            if pausa.get("fim") is None:
                ultima_pausa = pausa
                break
    
    return {
        "ativo": True,
        "em_pausa": ultima_pausa is not None,
        "hora_inicio": ponto_ativo.get("check_in"),
        "ponto_id": ponto_ativo.get("id")
    }


@router.post("/check-in")
async def registar_check_in(
    request: CheckInRequest,
    current_user: dict = Depends(get_current_user)
):
    """Registar check-in (início de turno)"""
    
    # Verificar se já tem ponto ativo
    ponto_ativo = await db.registos_ponto.find_one({
        "user_id": current_user["id"],
        "check_out": None
    })
    
    if ponto_ativo:
        raise HTTPException(
            status_code=400,
            detail="Já tem um turno ativo. Faça check-out primeiro."
        )
    
    hora = request.hora or datetime.now(timezone.utc).isoformat()
    
    ponto = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "parceiro_id": current_user.get("parceiro_id"),
        "check_in": hora,
        "check_in_location": {
            "latitude": request.latitude,
            "longitude": request.longitude
        } if request.latitude else None,
        "check_out": None,
        "check_out_location": None,
        "pausas": [],
        "total_pausas_minutos": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.registos_ponto.insert_one(ponto)
    logger.info(f"Check-in registado para user {current_user['id']}")
    
    return {
        "success": True,
        "ponto_id": ponto["id"],
        "hora_inicio": hora,
        "message": "Check-in registado com sucesso"
    }


@router.post("/check-out")
async def registar_check_out(
    request: CheckOutRequest,
    current_user: dict = Depends(get_current_user)
):
    """Registar check-out (fim de turno)"""
    
    # Procurar ponto ativo
    ponto_ativo = await db.registos_ponto.find_one({
        "user_id": current_user["id"],
        "check_out": None
    })
    
    if not ponto_ativo:
        raise HTTPException(
            status_code=400,
            detail="Não tem nenhum turno ativo."
        )
    
    hora = request.hora or datetime.now(timezone.utc).isoformat()
    
    # Calcular tempo total
    check_in = datetime.fromisoformat(ponto_ativo["check_in"].replace("Z", "+00:00"))
    check_out = datetime.fromisoformat(hora.replace("Z", "+00:00"))
    
    total_minutos = int((check_out - check_in).total_seconds() / 60)
    tempo_trabalho = total_minutos - ponto_ativo.get("total_pausas_minutos", 0)
    
    # Fechar pausas abertas
    pausas = ponto_ativo.get("pausas", [])
    for pausa in pausas:
        if pausa.get("fim") is None:
            pausa["fim"] = hora
    
    # Atualizar registo
    await db.registos_ponto.update_one(
        {"id": ponto_ativo["id"]},
        {"$set": {
            "check_out": hora,
            "check_out_location": {
                "latitude": request.latitude,
                "longitude": request.longitude
            } if request.latitude else None,
            "pausas": pausas,
            "total_minutos": total_minutos,
            "tempo_trabalho_minutos": tempo_trabalho
        }}
    )
    
    logger.info(f"Check-out registado para user {current_user['id']}, total: {tempo_trabalho} min")
    
    return {
        "success": True,
        "hora_fim": hora,
        "total_minutos": total_minutos,
        "tempo_trabalho_minutos": tempo_trabalho,
        "message": "Check-out registado com sucesso"
    }


@router.post("/pausa")
async def registar_pausa(
    request: PausaRequest,
    current_user: dict = Depends(get_current_user)
):
    """Registar início ou fim de pausa"""
    
    # Procurar ponto ativo
    ponto_ativo = await db.registos_ponto.find_one({
        "user_id": current_user["id"],
        "check_out": None
    })
    
    if not ponto_ativo:
        raise HTTPException(
            status_code=400,
            detail="Não tem nenhum turno ativo."
        )
    
    hora = request.hora or datetime.now(timezone.utc).isoformat()
    pausas = ponto_ativo.get("pausas", [])
    total_pausas = ponto_ativo.get("total_pausas_minutos", 0)
    
    if request.tipo == "iniciar":
        # Verificar se já está em pausa
        for pausa in pausas:
            if pausa.get("fim") is None:
                raise HTTPException(
                    status_code=400,
                    detail="Já está em pausa."
                )
        
        pausas.append({
            "inicio": hora,
            "fim": None
        })
        
    elif request.tipo == "retomar":
        # Encontrar e fechar pausa ativa
        pausa_fechada = False
        for pausa in pausas:
            if pausa.get("fim") is None:
                pausa["fim"] = hora
                
                # Calcular duração da pausa
                inicio = datetime.fromisoformat(pausa["inicio"].replace("Z", "+00:00"))
                fim = datetime.fromisoformat(hora.replace("Z", "+00:00"))
                duracao = int((fim - inicio).total_seconds() / 60)
                total_pausas += duracao
                
                pausa_fechada = True
                break
        
        if not pausa_fechada:
            raise HTTPException(
                status_code=400,
                detail="Não está em pausa."
            )
    
    # Atualizar registo
    await db.registos_ponto.update_one(
        {"id": ponto_ativo["id"]},
        {"$set": {
            "pausas": pausas,
            "total_pausas_minutos": total_pausas
        }}
    )
    
    return {
        "success": True,
        "tipo": request.tipo,
        "hora": hora,
        "total_pausas_minutos": total_pausas,
        "message": f"Pausa {'iniciada' if request.tipo == 'iniciar' else 'terminada'} com sucesso"
    }


@router.get("/historico")
async def get_historico(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obter histórico de registos de ponto"""
    
    query = {"user_id": current_user["id"]}
    
    if data_inicio:
        query["check_in"] = {"$gte": data_inicio}
    if data_fim:
        if "check_in" in query:
            query["check_in"]["$lte"] = data_fim
        else:
            query["check_in"] = {"$lte": data_fim}
    
    registos = await db.registos_ponto.find(
        query,
        {"_id": 0}
    ).sort("check_in", -1).limit(50).to_list(50)
    
    return registos


@router.get("/resumo-semanal")
async def get_resumo_semanal(current_user: dict = Depends(get_current_user)):
    """Obter resumo semanal de horas trabalhadas"""
    
    # Calcular início da semana (segunda-feira)
    hoje = datetime.now(timezone.utc)
    inicio_semana = hoje - timedelta(days=hoje.weekday())
    inicio_semana = inicio_semana.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Buscar registos da semana
    registos = await db.registos_ponto.find({
        "user_id": current_user["id"],
        "check_in": {"$gte": inicio_semana.isoformat()}
    }, {"_id": 0}).to_list(100)
    
    # Calcular totais
    total_minutos = 0
    total_turnos = 0
    dias_trabalhados = set()
    
    for reg in registos:
        if reg.get("tempo_trabalho_minutos"):
            total_minutos += reg["tempo_trabalho_minutos"]
            total_turnos += 1
            
            # Extrair dia
            check_in = datetime.fromisoformat(reg["check_in"].replace("Z", "+00:00"))
            dias_trabalhados.add(check_in.date().isoformat())
    
    num_dias = len(dias_trabalhados) or 1
    media_diaria = total_minutos // num_dias if num_dias > 0 else 0
    
    return {
        "total_minutos": total_minutos,
        "total_turnos": total_turnos,
        "dias_trabalhados": len(dias_trabalhados),
        "media_diaria": media_diaria,
        "semana_inicio": inicio_semana.isoformat()
    }
