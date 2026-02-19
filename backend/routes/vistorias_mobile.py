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
    motorista_id: Optional[str] = None  # ID do motorista (para inspetor/parceiro)
    veiculo_id: Optional[str] = None  # ID do veículo


@router.get("/minhas")
async def get_minhas_vistorias(
    current_user: dict = Depends(get_current_user)
):
    """Listar vistorias - para inspetor mostra as que criou, para motorista as do seu veículo"""
    
    user_id = current_user["id"]
    user_role = current_user["role"]
    
    # Determinar query baseado no role
    if user_role == "inspetor":
        query = {"inspetor_id": user_id}
    elif user_role in ["gestao", "parceiro"]:
        query = {"inspetor_id": user_id}
    else:
        query = {"motorista_id": user_id}
    
    vistorias = await db.vistorias_mobile.find(
        query,
        {"_id": 0, "fotos_base64": 0, "assinatura_base64": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Formatar dados
    resultado = []
    for v in vistorias:
        try:
            created = datetime.fromisoformat(v["created_at"].replace("Z", "+00:00"))
            data_str = created.strftime("%d/%m/%Y %H:%M")
        except:
            data_str = v.get("created_at", "N/A")
        
        resultado.append({
            "id": v["id"],
            "tipo": v["tipo"],
            "data": data_str,
            "km": v.get("km", 0),
            "nivel_combustivel": v.get("nivel_combustivel", 0),
            "total_danos": len(v.get("danos", [])),
            "status": v.get("status", "pendente"),
            "veiculo_matricula": v.get("veiculo_matricula"),
            "motorista_nome": v.get("motorista_nome"),
            "motorista_aceite": v.get("motorista_aceite")
        })
    
    return {
        "vistorias": resultado,
        "total": len(resultado)
    }


class OcrMatriculaRequest(BaseModel):
    imagem_base64: str


@router.post("/ocr-matricula")
async def ocr_matricula(
    data: OcrMatriculaRequest,
    current_user: dict = Depends(get_current_user)
):
    """Fazer OCR de uma imagem para ler a matrícula do veículo"""
    
    try:
        from services.vistoria_ia import ler_matricula_imagem
        resultado = await ler_matricula_imagem(data.imagem_base64)
        
        matricula = resultado.get("matricula")
        if matricula:
            # Procurar veículo e motorista com esta matrícula
            veiculo = await db.vehicles.find_one(
                {"matricula": {"$regex": matricula.replace("-", "").replace(" ", ""), "$options": "i"}},
                {"_id": 0, "id": 1, "matricula": 1}
            )
            
            motorista = None
            if veiculo:
                motorista = await db.motoristas.find_one(
                    {"veiculo_atribuido": veiculo["id"]},
                    {"_id": 0, "id": 1, "name": 1, "email": 1, "veiculo_matricula": 1}
                )
            
            return {
                "matricula": matricula,
                "confianca": resultado.get("confianca", 0),
                "veiculo": veiculo,
                "motorista": motorista
            }
        
        return {"matricula": None, "confianca": 0, "message": "Não foi possível ler a matrícula"}
        
    except Exception as e:
        logger.error(f"Erro no OCR: {e}")
        return {"matricula": None, "error": str(e)}


@router.get("/pendentes-aceitacao")
async def listar_vistorias_pendentes_aceitacao(
    current_user: dict = Depends(get_current_user)
):
    """Listar vistorias pendentes de aceitação pelo motorista"""
    
    if current_user["role"] != "motorista":
        raise HTTPException(status_code=403, detail="Apenas motoristas podem ver vistorias pendentes de aceitação")
    
    # Buscar motorista pelo email do user atual
    motorista = await db.motoristas.find_one(
        {"email": current_user["email"]},
        {"_id": 0, "id": 1}
    )
    
    motorista_id = motorista["id"] if motorista else current_user["id"]
    
    # Buscar vistorias pendentes de aceitação pelo motorista
    # Vistorias com status=pendente e motorista_aceite=None são as que aguardam aceitação
    vistorias = await db.vistorias_mobile.find(
        {
            "motorista_id": {"$in": [motorista_id, current_user["id"]]},
            "status": "pendente",
            "$or": [
                {"motorista_aceite": None},
                {"motorista_aceite": {"$exists": False}}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    resultado = []
    for v in vistorias:
        try:
            created = datetime.fromisoformat(v["created_at"].replace("Z", "+00:00"))
            data_str = created.strftime("%d/%m/%Y %H:%M")
        except:
            data_str = v.get("created_at", "N/A")
        
        # Formatar fotos
        fotos_formatadas = {}
        for foto_tipo, foto_data in v.get("fotos", {}).items():
            if isinstance(foto_data, dict):
                fotos_formatadas[foto_tipo] = {
                    "url": foto_data.get("url", ""),
                    "filename": foto_data.get("filename", "")
                }
            elif isinstance(foto_data, str):
                fotos_formatadas[foto_tipo] = {"url": foto_data}
        
        resultado.append({
            "id": v["id"],
            "tipo": v["tipo"],
            "veiculo_matricula": v.get("veiculo_matricula"),
            "data": data_str,
            "km": v.get("km"),
            "nivel_combustivel": v.get("nivel_combustivel"),
            "danos": v.get("danos", []),
            "observacoes": v.get("observacoes"),
            "analise_ia": v.get("analise_ia"),
            "inspetor_nome": v.get("inspetor_nome"),
            "fotos": fotos_formatadas,
            "assinatura_url": v.get("assinatura_url"),
            "created_at": v.get("created_at")
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
    
    # Inspetores, Gestores e Parceiros podem criar vistorias
    allowed_roles = ["inspetor", "gestao", "parceiro"]
    if current_user["role"] not in allowed_roles:
        raise HTTPException(status_code=403, detail="Apenas inspetores, gestores ou parceiros podem criar vistorias")
    
    inspetor_id = current_user["id"]
    now = datetime.now(timezone.utc)
    
    # Para inspetor/gestor/parceiro, precisamos identificar o motorista e veículo
    # Isso pode vir do request ou ser selecionado na app
    motorista_id = data.motorista_id if hasattr(data, 'motorista_id') and data.motorista_id else None
    veiculo_id = data.veiculo_id if hasattr(data, 'veiculo_id') and data.veiculo_id else None
    
    motorista_nome = None
    motorista_telefone = None
    veiculo_matricula = None
    
    # Se temos motorista_id, buscar info
    if motorista_id:
        motorista = await db.motoristas.find_one(
            {"id": motorista_id},
            {"_id": 0, "name": 1, "veiculo_atribuido": 1, "telefone": 1}
        )
        if motorista:
            motorista_nome = motorista.get("name")
            motorista_telefone = motorista.get("telefone")
            if not veiculo_id and motorista.get("veiculo_atribuido"):
                veiculo_id = motorista["veiculo_atribuido"]
    
    # Buscar info do veículo
    if veiculo_id:
        veiculo = await db.vehicles.find_one(
            {"id": veiculo_id},
            {"_id": 0, "id": 1, "matricula": 1}
        )
        if veiculo:
            veiculo_matricula = veiculo.get("matricula")
    
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
    
    # Processar danos (manuais + IA)
    danos_processados = [d.dict() for d in data.danos]
    
    # Buscar vistoria anterior para comparação
    comparacao = None
    vistoria_anterior = await db.vistorias_mobile.find_one(
        {"veiculo_id": veiculo_id, "id": {"$ne": vistoria_id}},
        {"_id": 0}
    )
    if vistoria_anterior:
        try:
            from services.vistoria_ia import comparar_vistorias
            comparacao = await comparar_vistorias(vistoria_anterior, {
                "km": data.km,
                "nivel_combustivel": data.nivel_combustivel,
                "danos": danos_processados,
                "analise_ia": analise_ia
            })
        except Exception as e:
            logger.warning(f"Erro na comparação: {e}")
    
    # Gerar token de confirmação
    token_confirmacao = str(uuid.uuid4())[:8]
    
    # Buscar nome do inspetor
    inspetor_nome = current_user.get("name", "Inspetor")
    
    # Criar vistoria
    vistoria = {
        "id": vistoria_id,
        "tipo": data.tipo,
        "inspetor_id": inspetor_id,
        "inspetor_nome": inspetor_nome,
        "motorista_id": motorista_id,
        "motorista_nome": motorista_nome,
        "motorista_telefone": motorista_telefone,
        "veiculo_id": veiculo_id,
        "veiculo_matricula": veiculo_matricula,
        "km": data.km,
        "nivel_combustivel": data.nivel_combustivel,
        "fotos": fotos_salvas,
        "danos": danos_processados,
        "danos_ia": analise_ia.get('danos_detetados', []),
        "matricula_ocr": analise_ia.get('matricula_lida'),
        "analise_ia": analise_ia,
        "comparacao_anterior": comparacao,
        "observacoes": data.observacoes,
        "assinatura_url": assinatura_url,
        "token_confirmacao": token_confirmacao,
        "confirmado": False,
        "status": "pendente",
        "motorista_aceite": None,  # Aguarda aceitação do motorista
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.vistorias_mobile.insert_one(vistoria)
    
    # Gerar relatório para WhatsApp/Email
    relatorio = None
    try:
        from services.vistoria_ia import gerar_relatorio_vistoria
        vistoria_relatorio = {**vistoria, "data": now.strftime("%d/%m/%Y %H:%M")}
        relatorio = await gerar_relatorio_vistoria(vistoria_relatorio, comparacao)
        # Substituir placeholder do link
        link_confirmacao = f"https://supplier-management-2.preview.emergentagent.com/confirmar-vistoria/{vistoria_id}?token={token_confirmacao}"
        relatorio = relatorio.replace("[LINK_CONFIRMACAO]", link_confirmacao)
    except Exception as e:
        logger.warning(f"Erro ao gerar relatório: {e}")
    
    logger.info(f"Vistoria mobile {vistoria_id} criada por motorista {motorista_id}")
    
    return {
        "success": True,
        "message": "Vistoria criada com sucesso",
        "vistoria_id": vistoria_id,
        "analise_ia": analise_ia,
        "comparacao": comparacao,
        "relatorio_whatsapp": relatorio,
        "link_confirmacao": f"https://supplier-management-2.preview.emergentagent.com/confirmar-vistoria/{vistoria_id}?token={token_confirmacao}"
    }


@router.get("/frota")
async def listar_vistorias_frota(
    current_user: dict = Depends(get_current_user)
):
    """Listar todas as vistorias da frota do parceiro com fotos e dados completos"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro", "inspetor"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {}
    
    if current_user["role"] in ["parceiro", "inspetor"]:
        # Buscar motoristas associados ao parceiro
        if current_user["role"] == "parceiro":
            parceiro_id = current_user["id"]
        else:
            # Inspetor - buscar parceiros associados
            parceiros_associados = current_user.get("parceiros_associados", [])
            if not parceiros_associados:
                return {"vistorias": [], "total": 0}
            parceiro_id = {"$in": parceiros_associados}
        
        motoristas = await db.motoristas.find(
            {"parceiro_atribuido": parceiro_id},
            {"_id": 0, "id": 1}
        ).to_list(500)
        motorista_ids = [m["id"] for m in motoristas]
        query["motorista_id"] = {"$in": motorista_ids}
    
    vistorias = await db.vistorias_mobile.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    resultado = []
    for v in vistorias:
        try:
            created = datetime.fromisoformat(v.get("created_at", "").replace("Z", "+00:00"))
            data_str = created.strftime("%d/%m/%Y %H:%M")
        except:
            data_str = v.get("created_at", "N/A")
        
        # Construir URLs completas das fotos
        fotos_formatadas = {}
        for foto_tipo, foto_data in v.get("fotos", {}).items():
            if isinstance(foto_data, dict):
                fotos_formatadas[foto_tipo] = {
                    "url": foto_data.get("url", ""),
                    "filename": foto_data.get("filename", "")
                }
        
        resultado.append({
            "id": v["id"],
            "tipo": v.get("tipo"),
            "status": v.get("status"),
            "data": data_str,
            "motorista_id": v.get("motorista_id"),
            "motorista_nome": v.get("motorista_nome"),
            "veiculo_id": v.get("veiculo_id"),
            "veiculo_matricula": v.get("veiculo_matricula"),
            "km": v.get("km"),
            "nivel_combustivel": v.get("nivel_combustivel"),
            "danos": v.get("danos", []),
            "danos_ia": v.get("danos_ia", []),
            "observacoes": v.get("observacoes"),
            "fotos": fotos_formatadas,
            "assinatura_url": v.get("assinatura_url"),
            "inspetor_nome": v.get("inspetor_nome"),
            "motorista_aceite": v.get("motorista_aceite"),
            "motorista_aceite_em": v.get("motorista_aceite_em"),
            "created_at": v.get("created_at")
        })
    
    return {
        "vistorias": resultado,
        "total": len(resultado)
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


@router.get("/aprovadas")
async def listar_vistorias_aprovadas(
    current_user: dict = Depends(get_current_user)
):
    """Listar vistorias aprovadas"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {"status": "aprovada"}
    
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
    ).sort("created_at", -1).to_list(200)
    
    return {
        "vistorias": await _formatar_vistorias(vistorias),
        "total": len(vistorias)
    }


@router.get("/rejeitadas")
async def listar_vistorias_rejeitadas(
    current_user: dict = Depends(get_current_user)
):
    """Listar vistorias rejeitadas"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {"status": "rejeitada"}
    
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
    ).sort("created_at", -1).to_list(200)
    
    return {
        "vistorias": await _formatar_vistorias(vistorias),
        "total": len(vistorias)
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
    
    # Associar vistoria ao veículo na coleção de veículos
    if vistoria.get("veiculo_id"):
        await db.vehicles.update_one(
            {"id": vistoria["veiculo_id"]},
            {"$push": {
                "vistorias": {
                    "vistoria_id": vistoria_id,
                    "tipo": vistoria.get("tipo"),
                    "data": vistoria.get("created_at"),
                    "km": vistoria.get("km"),
                    "danos_count": len(vistoria.get("danos", [])),
                    "status": "aprovada"
                }
            },
            "$set": {
                "ultima_vistoria": vistoria_id,
                "ultima_vistoria_data": vistoria.get("created_at"),
                "ultima_vistoria_km": vistoria.get("km"),
                "updated_at": now.isoformat()
            }}
        )
        logger.info(f"Vistoria {vistoria_id} associada ao veículo {vistoria['veiculo_id']}")
    
    return {"success": True, "message": "Vistoria aprovada e associada ao veículo"}


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


# ============ ENDPOINTS PARA MOTORISTA ACEITAR/REJEITAR VISTORIA ============

class ConfirmarMotoristaSchema(BaseModel):
    aceitar: bool


@router.post("/{vistoria_id}/confirmar-motorista")
async def confirmar_vistoria_motorista(
    vistoria_id: str,
    data: ConfirmarMotoristaSchema,
    current_user: dict = Depends(get_current_user)
):
    """Motorista confirma ou rejeita a vistoria"""
    
    if current_user["role"] != "motorista":
        raise HTTPException(status_code=403, detail="Apenas motoristas podem confirmar vistorias")
    
    # Buscar motorista pelo email para obter o ID correto
    motorista = await db.motoristas.find_one(
        {"email": current_user["email"]},
        {"_id": 0, "id": 1}
    )
    motorista_id = motorista["id"] if motorista else current_user["id"]
    
    vistoria = await db.vistorias_mobile.find_one(
        {"id": vistoria_id, "motorista_id": {"$in": [motorista_id, current_user["id"]]}},
        {"_id": 0}
    )
    
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")
    
    now = datetime.now(timezone.utc)
    
    # Atualizar status baseado na decisão do motorista
    novo_status = "aprovada" if data.aceitar else "rejeitada_motorista"
    
    update_data = {
        "motorista_aceite": data.aceitar,
        "motorista_aceite_em": now.isoformat(),
        "status": novo_status,
        "updated_at": now.isoformat()
    }
    
    await db.vistorias_mobile.update_one(
        {"id": vistoria_id},
        {"$set": update_data}
    )
    
    # Se aceite, enviar email com relatório (simulado)
    if data.aceitar:
        try:
            # Buscar email do motorista
            motorista = await db.users.find_one(
                {"id": current_user["id"]},
                {"_id": 0, "email": 1, "name": 1}
            )
            
            if motorista and motorista.get("email"):
                # Em produção, aqui enviaria o email real
                logger.info(f"[EMAIL SIMULADO] Relatório de vistoria enviado para {motorista['email']}")
                
                # Registar envio
                await db.vistorias_mobile.update_one(
                    {"id": vistoria_id},
                    {"$set": {
                        "relatorio_enviado": True,
                        "relatorio_enviado_em": now.isoformat(),
                        "relatorio_enviado_para": motorista["email"]
                    }}
                )
        except Exception as e:
            logger.error(f"Erro ao simular envio de email: {e}")
    
    return {
        "success": True, 
        "message": "Vistoria aceite! Relatório enviado para o seu email." if data.aceitar else "Vistoria rejeitada. O parceiro será notificado."
    }

