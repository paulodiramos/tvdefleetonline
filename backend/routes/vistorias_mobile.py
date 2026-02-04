"""
Rotas para Sistema de Vistorias de Veículos Mobile (tipo WeProov)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid
import logging
import base64
from pathlib import Path

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/vistorias", tags=["Vistorias Mobile"])
logger = logging.getLogger(__name__)
db = get_database()

# Diretório para uploads
VISTORIAS_UPLOAD_DIR = Path("/app/backend/uploads/vistorias")
VISTORIAS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class DanoSchema(BaseModel):
    id: str
    x: float
    y: float
    tipo: str
    descricao: Optional[str] = ""


class VistoriaCreate(BaseModel):
    tipo: str  # "entrada" ou "saida"
    fotos: Dict[str, str]  # { "frente": "base64...", ... }
    danos: List[DanoSchema] = []
    km: int
    nivel_combustivel: int
    observacoes: Optional[str] = ""
    assinatura: Optional[str] = None  # base64


@router.get("/minhas")
async def get_minhas_vistorias(
    current_user: dict = Depends(get_current_user)
):
    """Listar vistorias do motorista atual"""
    
    motorista_id = current_user["id"]
    
    vistorias = await db.vistorias_mobile.find(
        {"motorista_id": motorista_id},
        {"_id": 0, "fotos_base64": 0, "assinatura_base64": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Formatar dados
    resultado = []
    for v in vistorias:
        created = datetime.fromisoformat(v["created_at"].replace("Z", "+00:00"))
        resultado.append({
            "id": v["id"],
            "tipo": v["tipo"],
            "data": created.strftime("%d/%m/%Y %H:%M"),
            "km": v.get("km", 0),
            "nivel_combustivel": v.get("nivel_combustivel", 0),
            "total_danos": len(v.get("danos", [])),
            "status": v.get("status", "pendente"),
            "veiculo_matricula": v.get("veiculo_matricula")
        })
    
    return {
        "vistorias": resultado,
        "total": len(resultado)
    }


@router.post("/criar")
async def criar_vistoria(
    data: VistoriaCreate,
    current_user: dict = Depends(get_current_user)
):
    """Criar nova vistoria de entrada ou saída com análise IA"""
    
    if current_user["role"] != "motorista":
        raise HTTPException(status_code=403, detail="Apenas motoristas podem criar vistorias")
    
    motorista_id = current_user["id"]
    now = datetime.now(timezone.utc)
    
    # Buscar info do motorista e veículo
    motorista = await db.motoristas.find_one(
        {"id": motorista_id},
        {"_id": 0, "name": 1, "veiculo_atribuido": 1, "telefone": 1}
    )
    
    veiculo_matricula = None
    veiculo_id = None
    if motorista and motorista.get("veiculo_atribuido"):
        veiculo = await db.vehicles.find_one(
            {"id": motorista["veiculo_atribuido"]},
            {"_id": 0, "id": 1, "matricula": 1}
        )
        if veiculo:
            veiculo_matricula = veiculo.get("matricula")
            veiculo_id = veiculo.get("id")
    
    # Salvar fotos
    fotos_salvas = {}
    vistoria_id = str(uuid.uuid4())
    vistoria_dir = VISTORIAS_UPLOAD_DIR / vistoria_id
    vistoria_dir.mkdir(parents=True, exist_ok=True)
    
    # Análise IA
    analise_ia = {"danos_detetados": [], "matricula_lida": None}
    
    for foto_tipo, foto_base64 in data.fotos.items():
        if foto_base64:
            try:
                foto_data = base64.b64decode(foto_base64)
                foto_filename = f"{foto_tipo}.jpg"
                foto_path = vistoria_dir / foto_filename
                
                with open(foto_path, 'wb') as f:
                    f.write(foto_data)
                
                fotos_salvas[foto_tipo] = {
                    "filename": foto_filename,
                    "url": f"/uploads/vistorias/{vistoria_id}/{foto_filename}",
                    "created_at": now.isoformat()
                }
                
                # Análise IA das fotos exteriores
                if foto_tipo in ['frente', 'traseira', 'lateral_esq', 'lateral_dir']:
                    try:
                        from services.vistoria_ia import analisar_danos_imagem
                        resultado_ia = await analisar_danos_imagem(foto_base64, f"Foto: {foto_tipo}")
                        if resultado_ia.get('danos_encontrados'):
                            for dano in resultado_ia['danos_encontrados']:
                                dano['foto_origem'] = foto_tipo
                                analise_ia['danos_detetados'].append(dano)
                        fotos_salvas[foto_tipo]['analise_ia'] = resultado_ia
                    except Exception as e:
                        logger.warning(f"Erro na análise IA de {foto_tipo}: {e}")
                
                # OCR da matrícula
                if foto_tipo == 'frente' and not analise_ia.get('matricula_lida'):
                    try:
                        from services.vistoria_ia import ler_matricula_imagem
                        resultado_ocr = await ler_matricula_imagem(foto_base64)
                        if resultado_ocr.get('matricula'):
                            analise_ia['matricula_lida'] = resultado_ocr
                    except Exception as e:
                        logger.warning(f"Erro no OCR: {e}")
                        
            except Exception as e:
                logger.warning(f"Erro ao salvar foto {foto_tipo}: {e}")
    
    # Salvar assinatura
    assinatura_url = None
    if data.assinatura:
        try:
            assinatura_data = base64.b64decode(data.assinatura)
            assinatura_path = vistoria_dir / "assinatura.jpg"
            with open(assinatura_path, 'wb') as f:
                f.write(assinatura_data)
            assinatura_url = f"/uploads/vistorias/{vistoria_id}/assinatura.jpg"
        except Exception as e:
            logger.warning(f"Erro ao salvar assinatura: {e}")
    
    # Processar danos
    danos_processados = [d.dict() for d in data.danos]
    
    # Criar vistoria
    vistoria = {
        "id": vistoria_id,
        "tipo": data.tipo,
        "motorista_id": motorista_id,
        "motorista_nome": motorista.get("name") if motorista else None,
        "veiculo_id": veiculo_id,
        "veiculo_matricula": veiculo_matricula,
        "km": data.km,
        "nivel_combustivel": data.nivel_combustivel,
        "fotos": fotos_salvas,
        "danos": danos_processados,
        "observacoes": data.observacoes,
        "assinatura_url": assinatura_url,
        "status": "pendente",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.vistorias_mobile.insert_one(vistoria)
    
    logger.info(f"Vistoria mobile {vistoria_id} criada por motorista {motorista_id}")
    
    return {
        "success": True,
        "message": "Vistoria criada com sucesso",
        "vistoria_id": vistoria_id
    }


@router.get("/{vistoria_id}")
async def get_vistoria(
    vistoria_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de uma vistoria"""
    
    vistoria = await db.vistorias_mobile.find_one(
        {"id": vistoria_id},
        {"_id": 0}
    )
    
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")
    
    # Verificar permissão
    if current_user["role"] == "motorista" and vistoria["motorista_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    return vistoria


# ============ ENDPOINTS PARA PARCEIROS/GESTORES ============

@router.get("/pendentes/lista")
async def listar_vistorias_pendentes(
    current_user: dict = Depends(get_current_user)
):
    """Listar vistorias pendentes de aprovação"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {"status": "pendente"}
    
    # Filtrar por parceiro
    if current_user["role"] == "parceiro":
        motoristas = await db.motoristas.find(
            {"parceiro_atribuido": current_user["id"]},
            {"_id": 0, "id": 1}
        ).to_list(500)
        motorista_ids = [m["id"] for m in motoristas]
        query["motorista_id"] = {"$in": motorista_ids}
    
    vistorias = await db.vistorias_mobile.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Formatar
    resultado = []
    for v in vistorias:
        created = datetime.fromisoformat(v["created_at"].replace("Z", "+00:00"))
        resultado.append({
            "id": v["id"],
            "tipo": v["tipo"],
            "motorista_nome": v.get("motorista_nome"),
            "veiculo_matricula": v.get("veiculo_matricula"),
            "data": created.strftime("%d/%m/%Y %H:%M"),
            "km": v.get("km"),
            "total_danos": len(v.get("danos", [])),
            "total_fotos": len(v.get("fotos", {}))
        })
    
    return {
        "vistorias": resultado,
        "total": len(resultado)
    }


@router.post("/{vistoria_id}/aprovar")
async def aprovar_vistoria(
    vistoria_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Aprovar uma vistoria"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    vistoria = await db.vistorias_mobile.find_one({"id": vistoria_id}, {"_id": 0})
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")
    
    now = datetime.now(timezone.utc)
    
    await db.vistorias_mobile.update_one(
        {"id": vistoria_id},
        {"$set": {
            "status": "aprovada",
            "aprovada_por": current_user["id"],
            "aprovada_em": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    return {"success": True, "message": "Vistoria aprovada"}


class RejeitarVistoriaRequest(BaseModel):
    motivo: str


@router.post("/{vistoria_id}/rejeitar")
async def rejeitar_vistoria(
    vistoria_id: str,
    data: RejeitarVistoriaRequest,
    current_user: dict = Depends(get_current_user)
):
    """Rejeitar uma vistoria"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    vistoria = await db.vistorias_mobile.find_one({"id": vistoria_id}, {"_id": 0})
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")
    
    now = datetime.now(timezone.utc)
    
    await db.vistorias_mobile.update_one(
        {"id": vistoria_id},
        {"$set": {
            "status": "rejeitada",
            "motivo_rejeicao": data.motivo,
            "rejeitada_por": current_user["id"],
            "rejeitada_em": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    return {"success": True, "message": "Vistoria rejeitada"}
