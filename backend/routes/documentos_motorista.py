"""
Rotas para Upload e Gestão de Documentos dos Motoristas (com histórico)
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging
import os
import shutil
from pathlib import Path

from utils.database import get_database
from utils.auth import get_current_user
from utils.file_upload_handler import FileUploadHandler

router = APIRouter(prefix="/documentos-motorista", tags=["Documentos Motorista"])
logger = logging.getLogger(__name__)
db = get_database()

# Upload directory (fallback)
ROOT_DIR = Path(__file__).parent.parent
DOCS_UPLOAD_DIR = ROOT_DIR / "uploads" / "documentos_motoristas"
DOCS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Tipos de documentos
TIPOS_DOCUMENTOS = {
    "recibo": "Recibo de Vencimento",
    "registo_criminal": "Registo Criminal",
    "carta_conducao": "Carta de Condução",
    "certificado_tvde": "Certificado TVDE",
    "cc_cidadao": "Cartão de Cidadão",
    "comprovativo_morada": "Comprovativo de Morada",
    "iban": "Comprovativo IBAN",
    "seguro": "Comprovativo de Seguro",
    "outro": "Outro"
}


class DocumentoUploadResponse(BaseModel):
    success: bool
    documento_id: str
    message: str


@router.post("/upload")
async def upload_documento(
    tipo: str = Form(...),
    descricao: Optional[str] = Form(None),
    data_validade: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload de documento pelo motorista.
    O documento anterior do mesmo tipo é arquivado no histórico.
    Integra automaticamente com cloud storage se configurado.
    """
    
    if current_user["role"] != "motorista":
        raise HTTPException(status_code=403, detail="Apenas motoristas podem fazer upload de documentos")
    
    # Validar tipo
    if tipo not in TIPOS_DOCUMENTOS:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Use: {list(TIPOS_DOCUMENTOS.keys())}")
    
    # Validar ficheiro
    max_size = 10 * 1024 * 1024  # 10MB
    allowed_extensions = [".pdf", ".jpg", ".jpeg", ".png"]
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Tipo de ficheiro não permitido. Use: {allowed_extensions}")
    
    # Get motorista's parceiro_id
    motorista = await db.motoristas.find_one(
        {"id": current_user["id"]},
        {"_id": 0, "parceiro_id": 1, "parceiro_atribuido": 1, "nome": 1}
    )
    parceiro_id = motorista.get("parceiro_id") or motorista.get("parceiro_atribuido") if motorista else None
    
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Use FileUploadHandler for cloud integration
    if parceiro_id:
        upload_result = await FileUploadHandler.save_file(
            file=file,
            parceiro_id=parceiro_id,
            document_type="documento_motorista",
            entity_id=current_user["id"],
            entity_name=motorista.get("nome") if motorista else None,
            subfolder=tipo
        )
        file_path = upload_result.get("local_path") or ""
        file_url = upload_result.get("cloud_url") or upload_result.get("local_url")
        cloud_path = upload_result.get("cloud_path")
        provider = upload_result.get("provider")
    else:
        # Fallback to local-only storage
        file_name = f"{current_user['id']}_{tipo}_{doc_id}{file_ext}"
        file_path = str(DOCS_UPLOAD_DIR / file_name)
        
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        file_url = f"/api/documentos-motorista/ficheiro/{doc_id}"
        cloud_path = None
        provider = None
    
    # Buscar documento atual do mesmo tipo (para arquivar)
    documento_atual = await db.documentos_motorista.find_one({
        "motorista_id": current_user["id"],
        "tipo": tipo,
        "ativo": True
    }, {"_id": 0})
    
    # Se existe documento anterior, marcar como inativo (vai para histórico)
    if documento_atual:
        await db.documentos_motorista.update_one(
            {"id": documento_atual["id"]},
            {"$set": {
                "ativo": False,
                "arquivado_em": now.isoformat(),
                "substituido_por": doc_id
            }}
        )
        logger.info(f"Documento {documento_atual['id']} arquivado, substituído por {doc_id}")
    
    # Criar novo documento
    documento = {
        "id": doc_id,
        "motorista_id": current_user["id"],
        "parceiro_id": parceiro_id,
        "tipo": tipo,
        "tipo_nome": TIPOS_DOCUMENTOS[tipo],
        "nome_ficheiro": file.filename,
        "path": file_path,
        "file_url": file_url,
        "cloud_path": cloud_path,
        "cloud_provider": provider,
        "descricao": descricao,
        "data_validade": data_validade,
        "ativo": True,
        "validado": False,
        "validado_por": None,
        "validado_em": None,
        "documento_anterior_id": documento_atual["id"] if documento_atual else None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.documentos_motorista.insert_one(documento)
    
    # Atualizar motorista com referência ao documento
    update_field = f"documents.{tipo}_pdf"
    await db.motoristas.update_one(
        {"id": current_user["id"]},
        {"$set": {update_field: documento["file_url"]}}
    )
    
    logger.info(f"Documento {tipo} carregado por motorista {current_user['id']}")
    
    return {
        "success": True,
        "documento_id": doc_id,
        "message": f"Documento '{TIPOS_DOCUMENTOS[tipo]}' carregado com sucesso"
    }


@router.get("/meus")
async def listar_meus_documentos(
    incluir_historico: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Listar documentos do motorista atual"""
    
    if current_user["role"] != "motorista":
        raise HTTPException(status_code=403, detail="Apenas motoristas")
    
    query = {"motorista_id": current_user["id"]}
    
    if not incluir_historico:
        query["ativo"] = True
    
    documentos = await db.documentos_motorista.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Agrupar por tipo
    por_tipo = {}
    historico = []
    
    for doc in documentos:
        if doc.get("ativo"):
            por_tipo[doc["tipo"]] = doc
        else:
            historico.append(doc)
    
    return {
        "documentos_ativos": por_tipo,
        "historico": historico if incluir_historico else None,
        "tipos_disponiveis": TIPOS_DOCUMENTOS
    }


@router.get("/motorista/{motorista_id}")
async def listar_documentos_motorista(
    motorista_id: str,
    incluir_historico: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Listar documentos de um motorista (para parceiros, gestores, admin)"""
    
    # Verificar permissões
    if current_user["role"] == "motorista" and current_user["id"] != motorista_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] == "parceiro":
        # Verificar se motorista pertence ao parceiro
        motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
        if not motorista or motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Motorista não pertence a este parceiro")
    
    query = {"motorista_id": motorista_id}
    
    if not incluir_historico:
        query["ativo"] = True
    
    documentos = await db.documentos_motorista.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    # Agrupar
    ativos = {}
    historico = []
    
    for doc in documentos:
        if doc.get("ativo"):
            ativos[doc["tipo"]] = doc
        else:
            historico.append(doc)
    
    return {
        "motorista_id": motorista_id,
        "documentos_ativos": ativos,
        "historico": historico,
        "tipos_disponiveis": TIPOS_DOCUMENTOS
    }


@router.get("/ficheiro/{documento_id}")
async def obter_ficheiro(
    documento_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter ficheiro do documento"""
    from fastapi.responses import FileResponse
    
    documento = await db.documentos_motorista.find_one({"id": documento_id}, {"_id": 0})
    
    if not documento:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    
    # Verificar permissões
    if current_user["role"] == "motorista" and documento["motorista_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if current_user["role"] == "parceiro":
        motorista = await db.motoristas.find_one({"id": documento["motorista_id"]}, {"_id": 0})
        if not motorista or motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    file_path = Path(documento["path"])
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    return FileResponse(
        path=str(file_path),
        filename=documento["nome_ficheiro"],
        media_type="application/octet-stream"
    )


@router.post("/{documento_id}/validar")
async def validar_documento(
    documento_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Validar documento (parceiro, gestor ou admin)"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    documento = await db.documentos_motorista.find_one({"id": documento_id}, {"_id": 0})
    
    if not documento:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    
    # Verificar se parceiro pode validar
    if current_user["role"] == "parceiro":
        motorista = await db.motoristas.find_one({"id": documento["motorista_id"]}, {"_id": 0})
        if not motorista or motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    now = datetime.now(timezone.utc)
    
    await db.documentos_motorista.update_one(
        {"id": documento_id},
        {"$set": {
            "validado": True,
            "validado_por": current_user["id"],
            "validado_em": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    logger.info(f"Documento {documento_id} validado por {current_user['id']}")
    
    return {"success": True, "message": "Documento validado com sucesso"}


@router.post("/{documento_id}/rejeitar")
async def rejeitar_documento(
    documento_id: str,
    motivo: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Rejeitar documento e solicitar novo upload"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    documento = await db.documentos_motorista.find_one({"id": documento_id}, {"_id": 0})
    
    if not documento:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    
    now = datetime.now(timezone.utc)
    
    await db.documentos_motorista.update_one(
        {"id": documento_id},
        {"$set": {
            "validado": False,
            "rejeitado": True,
            "rejeitado_por": current_user["id"],
            "rejeitado_em": now.isoformat(),
            "motivo_rejeicao": motivo,
            "updated_at": now.isoformat()
        }}
    )
    
    logger.info(f"Documento {documento_id} rejeitado por {current_user['id']}: {motivo}")
    
    return {"success": True, "message": "Documento rejeitado. Motorista será notificado para enviar novo documento."}


@router.get("/historico/{motorista_id}/{tipo}")
async def obter_historico_tipo(
    motorista_id: str,
    tipo: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter histórico completo de um tipo de documento"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Verificar permissões se parceiro
    if current_user["role"] == "parceiro":
        motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
        if not motorista or motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    documentos = await db.documentos_motorista.find({
        "motorista_id": motorista_id,
        "tipo": tipo
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {
        "motorista_id": motorista_id,
        "tipo": tipo,
        "tipo_nome": TIPOS_DOCUMENTOS.get(tipo, tipo),
        "documentos": documentos,
        "total": len(documentos)
    }


@router.get("/pendentes")
async def documentos_pendentes_validacao(
    current_user: dict = Depends(get_current_user)
):
    """Listar documentos pendentes de validação (para parceiros, gestores, admin)"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Build query based on role
    if current_user["role"] == "parceiro":
        # Buscar motoristas do parceiro
        motoristas = await db.motoristas.find(
            {"parceiro_atribuido": current_user["id"]},
            {"_id": 0, "id": 1}
        ).to_list(500)
        motorista_ids = [m["id"] for m in motoristas]
        
        query = {
            "motorista_id": {"$in": motorista_ids},
            "ativo": True,
            "validado": False,
            "rejeitado": {"$ne": True}
        }
    else:
        query = {
            "ativo": True,
            "validado": False,
            "rejeitado": {"$ne": True}
        }
    
    documentos = await db.documentos_motorista.find(
        query, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    
    # Adicionar info do motorista
    for doc in documentos:
        motorista = await db.motoristas.find_one(
            {"id": doc["motorista_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        doc["motorista_nome"] = motorista.get("name") if motorista else "Desconhecido"
        doc["motorista_email"] = motorista.get("email") if motorista else None
    
    return {
        "pendentes": documentos,
        "total": len(documentos)
    }


# ============ RECIBOS SEMANAIS ============

class ReciboSemanalRequest(BaseModel):
    semana: int
    ano: int
    valor_liquido: Optional[float] = None


@router.post("/recibo-semanal")
async def enviar_recibo_semanal(
    data: ReciboSemanalRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Motorista envia/reenvia recibo semanal para aprovação do parceiro.
    Estados: pendente, aprovado, rejeitado
    """
    
    if current_user["role"] != "motorista":
        raise HTTPException(status_code=403, detail="Apenas motoristas podem enviar recibos")
    
    motorista_id = current_user["id"]
    now = datetime.now(timezone.utc)
    
    # Verificar se já existe recibo
    recibo_existente = await db.recibos_semanais.find_one({
        "motorista_id": motorista_id,
        "semana": data.semana,
        "ano": data.ano
    }, {"_id": 0})
    
    if recibo_existente:
        # Se já foi aprovado, não pode alterar
        if recibo_existente.get("status") == "aprovado":
            raise HTTPException(
                status_code=400, 
                detail="Este recibo já foi aprovado e não pode ser alterado"
            )
        
        # Atualizar para pendente (reenvio)
        await db.recibos_semanais.update_one(
            {"motorista_id": motorista_id, "semana": data.semana, "ano": data.ano},
            {"$set": {
                "status": "pendente",
                "valor_liquido": data.valor_liquido,
                "reenviado_em": now.isoformat(),
                "motivo_rejeicao": None,
                "updated_at": now.isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": "Recibo reenviado para aprovação"
        }
    
    # Criar novo recibo
    recibo = {
        "id": str(uuid.uuid4()),
        "motorista_id": motorista_id,
        "semana": data.semana,
        "ano": data.ano,
        "valor_liquido": data.valor_liquido,
        "status": "pendente",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.recibos_semanais.insert_one(recibo)
    
    logger.info(f"Recibo semanal {data.semana}/{data.ano} enviado por motorista {motorista_id}")
    
    return {
        "success": True,
        "message": "Recibo enviado para aprovação"
    }


@router.get("/recibos-pendentes")
async def listar_recibos_pendentes(
    current_user: dict = Depends(get_current_user)
):
    """Listar recibos semanais pendentes (para parceiros)"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Build query based on role
    if current_user["role"] == "parceiro":
        motoristas = await db.motoristas.find(
            {"parceiro_atribuido": current_user["id"]},
            {"_id": 0, "id": 1}
        ).to_list(500)
        motorista_ids = [m["id"] for m in motoristas]
        
        query = {
            "motorista_id": {"$in": motorista_ids},
            "status": "pendente"
        }
    else:
        query = {"status": "pendente"}
    
    recibos = await db.recibos_semanais.find(
        query, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    
    # Adicionar info do motorista
    for recibo in recibos:
        motorista = await db.motoristas.find_one(
            {"id": recibo["motorista_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        recibo["motorista_nome"] = motorista.get("name") if motorista else "Desconhecido"
    
    return {
        "recibos": recibos,
        "total": len(recibos)
    }


@router.post("/recibo/{recibo_id}/aprovar")
async def aprovar_recibo(
    recibo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Aprovar recibo semanal"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    recibo = await db.recibos_semanais.find_one({"id": recibo_id}, {"_id": 0})
    if not recibo:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    
    now = datetime.now(timezone.utc)
    
    await db.recibos_semanais.update_one(
        {"id": recibo_id},
        {"$set": {
            "status": "aprovado",
            "aprovado_por": current_user["id"],
            "aprovado_em": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    return {"success": True, "message": "Recibo aprovado"}


class RejeitarReciboRequest(BaseModel):
    motivo: str


@router.post("/recibo/{recibo_id}/rejeitar")
async def rejeitar_recibo(
    recibo_id: str,
    data: RejeitarReciboRequest,
    current_user: dict = Depends(get_current_user)
):
    """Rejeitar recibo semanal"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    recibo = await db.recibos_semanais.find_one({"id": recibo_id}, {"_id": 0})
    if not recibo:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    
    now = datetime.now(timezone.utc)
    
    await db.recibos_semanais.update_one(
        {"id": recibo_id},
        {"$set": {
            "status": "rejeitado",
            "motivo_rejeicao": data.motivo,
            "rejeitado_por": current_user["id"],
            "rejeitado_em": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    return {"success": True, "message": "Recibo rejeitado"}
