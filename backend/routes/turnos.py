"""
Rotas para Sistema de Turnos/Horários de Motoristas
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/turnos", tags=["Turnos"])
logger = logging.getLogger(__name__)
db = get_database()

DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]


class TurnoConfig(BaseModel):
    dia_semana: int  # 0=Segunda, 6=Domingo
    hora_inicio: str  # HH:MM
    hora_fim: str  # HH:MM
    ativo: bool = True


class TurnosUpdate(BaseModel):
    motorista_id: str
    turnos: List[TurnoConfig]
    veiculo_id: Optional[str] = None


class TurnosVeiculoUpdate(BaseModel):
    veiculo_id: str
    turnos: List[TurnoConfig]


# ============ ENDPOINTS MOTORISTA ============

@router.get("/meus")
async def get_meus_turnos(current_user: dict = Depends(get_current_user)):
    """Obter turnos configurados para o motorista atual"""
    
    motorista_id = current_user["id"]
    
    # Buscar turnos atuais do motorista
    turnos_config = await db.turnos_motorista.find_one(
        {"motorista_id": motorista_id, "ativo": True},
        {"_id": 0}
    )
    
    turnos_atuais = []
    veiculo_info = None
    
    if turnos_config:
        turnos_atuais = turnos_config.get("turnos", [])
        
        # Adicionar info do veículo se existir
        if turnos_config.get("veiculo_id"):
            veiculo = await db.vehicles.find_one(
                {"id": turnos_config["veiculo_id"]},
                {"_id": 0, "matricula": 1, "marca": 1, "modelo": 1}
            )
            if veiculo:
                veiculo_info = veiculo
                for turno in turnos_atuais:
                    turno["veiculo_matricula"] = veiculo.get("matricula")
        
        # Adicionar data de validade
        for turno in turnos_atuais:
            turno["valido_desde"] = turnos_config.get("valido_desde")
    
    # Se não tem turnos próprios, verificar turnos do veículo atribuído
    if not turnos_atuais:
        motorista = await db.motoristas.find_one(
            {"id": motorista_id},
            {"_id": 0, "veiculo_atribuido": 1}
        )
        
        if motorista and motorista.get("veiculo_atribuido"):
            turnos_veiculo = await db.turnos_veiculo.find_one(
                {"veiculo_id": motorista["veiculo_atribuido"], "ativo": True},
                {"_id": 0}
            )
            
            if turnos_veiculo:
                turnos_atuais = turnos_veiculo.get("turnos", [])
                
                veiculo = await db.vehicles.find_one(
                    {"id": motorista["veiculo_atribuido"]},
                    {"_id": 0, "matricula": 1, "marca": 1, "modelo": 1}
                )
                if veiculo:
                    veiculo_info = veiculo
                    for turno in turnos_atuais:
                        turno["veiculo_matricula"] = veiculo.get("matricula")
                        turno["valido_desde"] = turnos_veiculo.get("valido_desde")
    
    # Buscar histórico
    historico = await db.turnos_motorista.find(
        {"motorista_id": motorista_id, "ativo": False},
        {"_id": 0}
    ).sort("data_fim", -1).to_list(10)
    
    historico_formatado = []
    for h in historico:
        historico_formatado.append({
            "data_inicio": h.get("valido_desde"),
            "data_fim": h.get("data_fim"),
            "dias_semana": [t["dia_semana"] for t in h.get("turnos", []) if t.get("ativo")]
        })
    
    return {
        "turnos_atuais": turnos_atuais,
        "veiculo": veiculo_info,
        "historico": historico_formatado
    }


# ============ ENDPOINTS PARCEIRO/ADMIN ============

@router.post("/configurar")
async def configurar_turnos_motorista(
    data: TurnosUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Configurar turnos para um motorista específico"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Verificar se o parceiro tem acesso a este motorista
    if current_user["role"] == "parceiro":
        motorista = await db.motoristas.find_one(
            {"id": data.motorista_id},
            {"_id": 0}
        )
        if not motorista or motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Motorista não pertence a este parceiro")
    
    now = datetime.now(timezone.utc)
    
    # Arquivar turnos anteriores
    await db.turnos_motorista.update_many(
        {"motorista_id": data.motorista_id, "ativo": True},
        {"$set": {"ativo": False, "data_fim": now.strftime("%Y-%m-%d")}}
    )
    
    # Criar novos turnos
    turnos_doc = {
        "id": str(uuid.uuid4()),
        "motorista_id": data.motorista_id,
        "veiculo_id": data.veiculo_id,
        "turnos": [t.dict() for t in data.turnos],
        "ativo": True,
        "valido_desde": now.strftime("%Y-%m-%d"),
        "configurado_por": current_user["id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.turnos_motorista.insert_one(turnos_doc)
    
    logger.info(f"Turnos configurados para motorista {data.motorista_id} por {current_user['id']}")
    
    return {
        "success": True,
        "message": "Turnos configurados com sucesso"
    }


@router.post("/configurar-veiculo")
async def configurar_turnos_veiculo(
    data: TurnosVeiculoUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Configurar turnos para um veículo (afeta todos os motoristas do veículo)"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Verificar se o parceiro tem acesso a este veículo
    if current_user["role"] == "parceiro":
        veiculo = await db.vehicles.find_one(
            {"id": data.veiculo_id},
            {"_id": 0}
        )
        if not veiculo or veiculo.get("parceiro_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Veículo não pertence a este parceiro")
    
    now = datetime.now(timezone.utc)
    
    # Arquivar turnos anteriores
    await db.turnos_veiculo.update_many(
        {"veiculo_id": data.veiculo_id, "ativo": True},
        {"$set": {"ativo": False, "data_fim": now.strftime("%Y-%m-%d")}}
    )
    
    # Criar novos turnos
    turnos_doc = {
        "id": str(uuid.uuid4()),
        "veiculo_id": data.veiculo_id,
        "turnos": [t.dict() for t in data.turnos],
        "ativo": True,
        "valido_desde": now.strftime("%Y-%m-%d"),
        "configurado_por": current_user["id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.turnos_veiculo.insert_one(turnos_doc)
    
    logger.info(f"Turnos configurados para veículo {data.veiculo_id} por {current_user['id']}")
    
    return {
        "success": True,
        "message": "Turnos do veículo configurados com sucesso"
    }


@router.get("/motorista/{motorista_id}")
async def get_turnos_motorista(
    motorista_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter turnos de um motorista específico (para parceiro/admin)"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Verificar acesso
    if current_user["role"] == "parceiro":
        motorista = await db.motoristas.find_one(
            {"id": motorista_id},
            {"_id": 0}
        )
        if not motorista or motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Motorista não pertence a este parceiro")
    
    turnos_config = await db.turnos_motorista.find_one(
        {"motorista_id": motorista_id, "ativo": True},
        {"_id": 0}
    )
    
    return {
        "motorista_id": motorista_id,
        "turnos": turnos_config.get("turnos", []) if turnos_config else [],
        "veiculo_id": turnos_config.get("veiculo_id") if turnos_config else None,
        "valido_desde": turnos_config.get("valido_desde") if turnos_config else None
    }


@router.get("/veiculo/{veiculo_id}")
async def get_turnos_veiculo(
    veiculo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter turnos de um veículo específico"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    turnos_config = await db.turnos_veiculo.find_one(
        {"veiculo_id": veiculo_id, "ativo": True},
        {"_id": 0}
    )
    
    return {
        "veiculo_id": veiculo_id,
        "turnos": turnos_config.get("turnos", []) if turnos_config else [],
        "valido_desde": turnos_config.get("valido_desde") if turnos_config else None
    }


@router.get("/parceiro/motoristas")
async def get_turnos_todos_motoristas(
    current_user: dict = Depends(get_current_user)
):
    """Listar turnos de todos os motoristas do parceiro"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Buscar motoristas
    if current_user["role"] == "parceiro":
        motoristas = await db.motoristas.find(
            {"parceiro_atribuido": current_user["id"]},
            {"_id": 0, "id": 1, "name": 1, "veiculo_atribuido": 1}
        ).to_list(500)
    else:
        motoristas = await db.motoristas.find(
            {},
            {"_id": 0, "id": 1, "name": 1, "veiculo_atribuido": 1}
        ).to_list(500)
    
    resultado = []
    for mot in motoristas:
        turnos_config = await db.turnos_motorista.find_one(
            {"motorista_id": mot["id"], "ativo": True},
            {"_id": 0}
        )
        
        resultado.append({
            "motorista_id": mot["id"],
            "motorista_nome": mot.get("name"),
            "veiculo_atribuido": mot.get("veiculo_atribuido"),
            "tem_turnos": turnos_config is not None,
            "turnos": turnos_config.get("turnos", []) if turnos_config else []
        })
    
    return {
        "motoristas": resultado,
        "total": len(resultado)
    }
