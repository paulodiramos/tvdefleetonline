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


@router.get("/relatorio-diario")
async def get_relatorio_diario(
    data: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obter relatório diário de horas trabalhadas"""
    
    if data:
        dia = datetime.fromisoformat(data)
    else:
        dia = datetime.now(timezone.utc)
    
    inicio_dia = dia.replace(hour=0, minute=0, second=0, microsecond=0)
    fim_dia = dia.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    registos = await db.registos_ponto.find({
        "user_id": current_user["id"],
        "check_in": {
            "$gte": inicio_dia.isoformat(),
            "$lte": fim_dia.isoformat()
        }
    }, {"_id": 0}).sort("check_in", 1).to_list(50)
    
    total_minutos = sum(r.get("tempo_trabalho_minutos", 0) for r in registos)
    total_pausas = sum(r.get("total_pausas_minutos", 0) for r in registos)
    
    return {
        "data": dia.strftime("%Y-%m-%d"),
        "registos": registos,
        "total_turnos": len(registos),
        "total_minutos_trabalhados": total_minutos,
        "total_minutos_pausas": total_pausas,
        "horas_formatadas": f"{total_minutos // 60}h {total_minutos % 60}m"
    }


@router.get("/ganhos-semana")
async def get_ganhos_semana(
    semana: Optional[int] = None,
    ano: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obter ganhos e despesas da semana (igual ao relatório semanal)"""
    
    # Calcular semana atual se não especificada
    hoje = datetime.now(timezone.utc)
    if not semana:
        semana = hoje.isocalendar()[1]
    if not ano:
        ano = hoje.year
    
    # Calcular datas da semana
    primeiro_dia_ano = datetime(ano, 1, 1)
    if primeiro_dia_ano.weekday() <= 3:
        primeira_segunda = primeiro_dia_ano - timedelta(days=primeiro_dia_ano.weekday())
    else:
        primeira_segunda = primeiro_dia_ano + timedelta(days=(7 - primeiro_dia_ano.weekday()))
    
    inicio_semana = primeira_segunda + timedelta(weeks=semana - 1)
    fim_semana = inicio_semana + timedelta(days=6)
    
    data_inicio = inicio_semana.strftime("%Y-%m-%d")
    data_fim = fim_semana.strftime("%Y-%m-%d")
    
    motorista_id = current_user["id"]
    
    # Buscar motorista para obter IDs das plataformas
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        # Tentar buscar user e verificar se é motorista
        motorista = await db.users.find_one({"id": motorista_id}, {"_id": 0})
    
    # Ganhos Uber
    ganhos_uber = 0.0
    uber_records = await db.ganhos_uber.find({
        "$or": [
            {"motorista_id": motorista_id},
            {"email_motorista": current_user.get("email")}
        ],
        "$and": [{"$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]}]
    }, {"_id": 0}).to_list(100)
    
    for r in uber_records:
        ganhos_uber += float(r.get("rendimentos") or r.get("pago_total") or 0)
    
    # Ganhos Bolt
    ganhos_bolt = 0.0
    bolt_records = await db.ganhos_bolt.find({
        "$or": [
            {"motorista_id": motorista_id},
            {"email_motorista": current_user.get("email")}
        ],
        "$and": [{"$or": [
            {"semana": semana, "ano": ano},
            {"periodo_semana": semana, "periodo_ano": ano}
        ]}]
    }, {"_id": 0}).to_list(100)
    
    for r in bolt_records:
        ganhos_bolt += float(r.get("ganhos_liquidos") or r.get("ganhos") or 0)
    
    # Buscar veículo atribuído
    veiculo_id = motorista.get("veiculo_atribuido") if motorista else None
    veiculo = None
    if veiculo_id:
        veiculo = await db.vehicles.find_one({"id": veiculo_id}, {"_id": 0})
    
    # Via Verde
    via_verde_total = 0.0
    if veiculo and veiculo.get("matricula"):
        vv_records = await db.portagens_viaverde.find({
            "matricula": veiculo.get("matricula"),
            "$or": [
                {"semana": semana, "ano": ano},
                {"entry_date": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}}
            ]
        }, {"_id": 0}).to_list(500)
        
        for r in vv_records:
            market_desc = str(r.get("market_description", "")).strip().lower()
            if not market_desc or market_desc in ["portagens", "parques"]:
                via_verde_total += float(r.get("valor") or r.get("value") or 0)
    
    # Combustível
    combustivel_total = 0.0
    comb_records = await db.abastecimentos_combustivel.find({
        "$or": [
            {"motorista_id": motorista_id},
            {"vehicle_id": veiculo_id} if veiculo_id else {"vehicle_id": None}
        ],
        "$and": [{"$or": [
            {"data": {"$gte": data_inicio, "$lte": data_fim}},
            {"semana": semana, "ano": ano}
        ]}]
    }, {"_id": 0}).to_list(100)
    
    for r in comb_records:
        valor = float(r.get("valor_liquido") or r.get("valor") or 0)
        iva = float(r.get("iva") or 0)
        combustivel_total += valor + iva
    
    # Carregamento elétrico
    eletrico_total = 0.0
    elet_records = await db.despesas_combustivel.find({
        "motorista_id": motorista_id,
        "$or": [
            {"semana": semana, "ano": ano},
            {"data": {"$gte": data_inicio, "$lte": data_fim}}
        ]
    }, {"_id": 0}).to_list(100)
    
    for r in elet_records:
        eletrico_total += float(r.get("valor_total") or 0)
    
    # Valor aluguer
    valor_aluguer = 0.0
    if veiculo:
        valor_aluguer = float(veiculo.get("valor_semanal") or 0)
    
    # Horas trabalhadas
    registos_ponto = await db.registos_ponto.find({
        "user_id": motorista_id,
        "check_in": {"$gte": data_inicio, "$lte": data_fim + "T23:59:59"}
    }, {"_id": 0}).to_list(100)
    
    total_minutos = sum(r.get("tempo_trabalho_minutos", 0) for r in registos_ponto)
    
    # Calcular totais
    total_ganhos = ganhos_uber + ganhos_bolt
    total_despesas = via_verde_total + combustivel_total + eletrico_total + valor_aluguer
    valor_liquido = total_ganhos - total_despesas
    
    return {
        "semana": semana,
        "ano": ano,
        "periodo": f"Semana {semana}/{ano}",
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "ganhos": {
            "uber": round(ganhos_uber, 2),
            "bolt": round(ganhos_bolt, 2),
            "total": round(total_ganhos, 2)
        },
        "despesas": {
            "via_verde": round(via_verde_total, 2),
            "combustivel": round(combustivel_total, 2),
            "eletrico": round(eletrico_total, 2),
            "aluguer": round(valor_aluguer, 2),
            "total": round(total_despesas, 2)
        },
        "valor_liquido": round(valor_liquido, 2),
        "horas_trabalhadas": {
            "total_minutos": total_minutos,
            "formatado": f"{total_minutos // 60}h {total_minutos % 60}m",
            "total_turnos": len(registos_ponto)
        },
        "veiculo": {
            "matricula": veiculo.get("matricula") if veiculo else None,
            "marca_modelo": f"{veiculo.get('marca')} {veiculo.get('modelo')}" if veiculo else None
        } if veiculo else None
    }


@router.get("/historico-semanas")
async def get_historico_semanas(
    num_semanas: int = 6,
    current_user: dict = Depends(get_current_user)
):
    """Obter histórico das últimas N semanas"""
    
    hoje = datetime.now(timezone.utc)
    semana_atual = hoje.isocalendar()[1]
    ano_atual = hoje.year
    
    historico = []
    
    for i in range(num_semanas):
        semana = semana_atual - i
        ano = ano_atual
        
        while semana <= 0:
            semana += 52
            ano -= 1
        
        # Buscar resumo simplificado
        ganhos_semana = await get_ganhos_semana(semana, ano, current_user)
        
        historico.append({
            "semana": semana,
            "ano": ano,
            "periodo": f"S{semana}/{ano}",
            "total_ganhos": ganhos_semana["ganhos"]["total"],
            "total_despesas": ganhos_semana["despesas"]["total"],
            "valor_liquido": ganhos_semana["valor_liquido"],
            "horas": ganhos_semana["horas_trabalhadas"]["formatado"]
        })
    
    return {"historico": historico}


# ============ RECIBOS SEMANAIS ============

from fastapi import UploadFile, File, Form
import shutil
from pathlib import Path

RECIBOS_UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "recibos_semanais"
RECIBOS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/recibo-semanal/upload")
async def upload_recibo_semanal(
    semana: int = Form(...),
    ano: int = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload de recibo semanal pelo motorista.
    - Apenas 1 recibo por semana
    - Após upload, não pode ser trocado pelo motorista
    - Apenas gestor, admin ou parceiro podem apagar
    """
    
    if current_user["role"] != "motorista":
        raise HTTPException(status_code=403, detail="Apenas motoristas podem fazer upload de recibos")
    
    motorista_id = current_user["id"]
    
    # Verificar se já existe recibo para esta semana
    recibo_existente = await db.recibos_semanais.find_one({
        "motorista_id": motorista_id,
        "semana": semana,
        "ano": ano
    }, {"_id": 0})
    
    if recibo_existente:
        raise HTTPException(
            status_code=400, 
            detail=f"Já existe um recibo para a semana {semana}/{ano}. Contacte o seu parceiro ou gestor para alterar."
        )
    
    # Validar ficheiro
    allowed_extensions = [".pdf", ".jpg", ".jpeg", ".png"]
    import os
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Tipo de ficheiro não permitido. Use: {allowed_extensions}")
    
    # Guardar ficheiro
    recibo_id = str(uuid.uuid4())
    file_name = f"{motorista_id}_{ano}_{semana}_{recibo_id}{file_ext}"
    file_path = RECIBOS_UPLOAD_DIR / file_name
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    now = datetime.now(timezone.utc)
    
    # Criar registo do recibo
    recibo = {
        "id": recibo_id,
        "motorista_id": motorista_id,
        "motorista_nome": current_user.get("name"),
        "semana": semana,
        "ano": ano,
        "nome_ficheiro": file.filename,
        "path": str(file_path),
        "file_url": f"/api/ponto/recibo-semanal/ficheiro/{recibo_id}",
        "created_at": now.isoformat(),
        "created_by": motorista_id
    }
    
    await db.recibos_semanais.insert_one(recibo)
    
    logger.info(f"Recibo semanal {semana}/{ano} carregado por motorista {motorista_id}")
    
    return {
        "success": True,
        "recibo_id": recibo_id,
        "message": f"Recibo da semana {semana}/{ano} carregado com sucesso"
    }


@router.get("/recibo-semanal/{semana}/{ano}")
async def get_recibo_semanal(
    semana: int,
    ano: int,
    motorista_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obter recibo de uma semana específica"""
    
    # Se motorista_id não especificado, usar o do utilizador atual
    if not motorista_id:
        motorista_id = current_user["id"]
    
    # Verificar permissões
    if current_user["role"] == "motorista" and motorista_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    recibo = await db.recibos_semanais.find_one({
        "motorista_id": motorista_id,
        "semana": semana,
        "ano": ano
    }, {"_id": 0})
    
    return {
        "existe": recibo is not None,
        "recibo": recibo
    }


@router.get("/recibo-semanal/ficheiro/{recibo_id}")
async def get_ficheiro_recibo(
    recibo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download do ficheiro do recibo"""
    from fastapi.responses import FileResponse
    
    recibo = await db.recibos_semanais.find_one({"id": recibo_id}, {"_id": 0})
    
    if not recibo:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    
    # Verificar permissões
    if current_user["role"] == "motorista" and recibo["motorista_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    file_path = Path(recibo["path"])
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    return FileResponse(
        path=str(file_path),
        filename=recibo["nome_ficheiro"],
        media_type="application/octet-stream"
    )


@router.get("/recibos-semanais/meus")
async def listar_meus_recibos(
    current_user: dict = Depends(get_current_user)
):
    """Listar todos os recibos do motorista"""
    
    recibos = await db.recibos_semanais.find({
        "motorista_id": current_user["id"]
    }, {"_id": 0}).sort([("ano", -1), ("semana", -1)]).to_list(100)
    
    return {"recibos": recibos}


@router.delete("/recibo-semanal/{recibo_id}")
async def apagar_recibo(
    recibo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Apagar recibo - APENAS gestor, admin ou parceiro podem apagar
    """
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(
            status_code=403, 
            detail="Apenas administradores, gestores ou parceiros podem apagar recibos"
        )
    
    recibo = await db.recibos_semanais.find_one({"id": recibo_id}, {"_id": 0})
    
    if not recibo:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    
    # Se parceiro, verificar se motorista pertence ao parceiro
    if current_user["role"] == "parceiro":
        motorista = await db.motoristas.find_one({"id": recibo["motorista_id"]}, {"_id": 0})
        if not motorista or motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Apagar ficheiro físico
    file_path = Path(recibo["path"])
    if file_path.exists():
        file_path.unlink()
    
    # Apagar registo
    await db.recibos_semanais.delete_one({"id": recibo_id})
    
    logger.info(f"Recibo {recibo_id} apagado por {current_user['id']}")
    
    return {"success": True, "message": "Recibo apagado com sucesso"}


@router.get("/recibos-semanais/motorista/{motorista_id}")
async def listar_recibos_motorista(
    motorista_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Listar recibos de um motorista (para parceiros, gestores, admin)"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Se parceiro, verificar se motorista pertence ao parceiro
    if current_user["role"] == "parceiro":
        motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
        if not motorista or motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    recibos = await db.recibos_semanais.find({
        "motorista_id": motorista_id
    }, {"_id": 0}).sort([("ano", -1), ("semana", -1)]).to_list(200)
    
    return {"motorista_id": motorista_id, "recibos": recibos}


@router.get("/semanas-disponiveis")
async def get_semanas_disponiveis(
    num_semanas: int = 12,
    current_user: dict = Depends(get_current_user)
):
    """Obter lista de semanas disponíveis para seleção"""
    
    hoje = datetime.now(timezone.utc)
    semana_atual = hoje.isocalendar()[1]
    ano_atual = hoje.year
    
    semanas = []
    
    for i in range(num_semanas):
        semana = semana_atual - i
        ano = ano_atual
        
        while semana <= 0:
            semana += 52
            ano -= 1
        
        # Calcular datas da semana
        primeiro_dia_ano = datetime(ano, 1, 1)
        if primeiro_dia_ano.weekday() <= 3:
            primeira_segunda = primeiro_dia_ano - timedelta(days=primeiro_dia_ano.weekday())
        else:
            primeira_segunda = primeiro_dia_ano + timedelta(days=(7 - primeiro_dia_ano.weekday()))
        
        inicio_semana = primeira_segunda + timedelta(weeks=semana - 1)
        fim_semana = inicio_semana + timedelta(days=6)
        
        semanas.append({
            "semana": semana,
            "ano": ano,
            "label": f"Semana {semana}/{ano}",
            "periodo": f"{inicio_semana.strftime('%d/%m')} - {fim_semana.strftime('%d/%m/%Y')}",
            "data_inicio": inicio_semana.strftime("%Y-%m-%d"),
            "data_fim": fim_semana.strftime("%Y-%m-%d")
        })
    
    return {"semanas": semanas}
