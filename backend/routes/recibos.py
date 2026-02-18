"""Receipts management routes"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging
import os

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads/recibos"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ReciboCreate(BaseModel):
    """Model for creating receipt"""
    motorista_id: str
    tipo: str  # pagamento_motorista, recibo_verde, etc
    valor: float
    descricao: Optional[str] = None
    periodo: Optional[str] = None


class ReciboVerificar(BaseModel):
    """Model for verifying receipt"""
    verificado: bool
    observacoes: Optional[str] = None


@router.post("/recibos/upload-ficheiro")
async def upload_ficheiro_recibo(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload a receipt file"""
    try:
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1]
        filename = f"recibo_{current_user['id']}_{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        # Save file
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        
        return {
            "success": True,
            "filename": filename,
            "filepath": filepath,
            "original_name": file.filename
        }
    
    except Exception as e:
        logger.error(f"Error uploading receipt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recibos")
async def criar_recibo(
    recibo: ReciboCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new receipt record"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    recibo_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    recibo_doc = {
        "id": recibo_id,
        "motorista_id": recibo.motorista_id,
        "tipo": recibo.tipo,
        "valor": recibo.valor,
        "descricao": recibo.descricao,
        "periodo": recibo.periodo,
        "verificado": False,
        "criado_por": current_user["id"],
        "criado_em": now
    }
    
    await db.recibos.insert_one(recibo_doc)
    
    return {"id": recibo_id, "message": "Recibo criado com sucesso"}


@router.get("/recibos/meus")
async def get_meus_recibos(current_user: Dict = Depends(get_current_user)):
    """Get receipts for current user (motorista)"""
    recibos = await db.recibos.find(
        {"motorista_id": current_user["id"]},
        {"_id": 0}
    ).sort("criado_em", -1).to_list(100)
    
    return recibos


@router.get("/recibos")
async def listar_recibos(
    motorista_id: Optional[str] = None,
    verificado: Optional[bool] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List all receipts (Admin/Gestao/Parceiro)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Build query
    query = {}
    
    if motorista_id:
        query["motorista_id"] = motorista_id
    
    if verificado is not None:
        query["verificado"] = verificado
    
    # Parceiros só veem recibos dos seus motoristas
    if current_user["role"] == UserRole.PARCEIRO:
        motoristas = await db.motoristas.find(
            {"parceiro_id": current_user["id"]},
            {"_id": 0, "id": 1}
        ).to_list(None)
        motorista_ids = [m["id"] for m in motoristas]
        query["motorista_id"] = {"$in": motorista_ids}
    
    recibos = await db.recibos.find(
        query,
        {"_id": 0}
    ).sort("criado_em", -1).to_list(500)
    
    return recibos


@router.put("/recibos/{recibo_id}/verificar")
async def verificar_recibo(
    recibo_id: str,
    data: ReciboVerificar,
    current_user: Dict = Depends(get_current_user)
):
    """Verify a receipt"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    result = await db.recibos.update_one(
        {"id": recibo_id},
        {
            "$set": {
                "verificado": data.verificado,
                "observacoes_verificacao": data.observacoes,
                "verificado_por": current_user["id"],
                "verificado_em": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    
    return {"message": "Recibo verificado com sucesso"}


@router.get("/recibos/{recibo_id}")
async def get_recibo(
    recibo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get a specific receipt"""
    recibo = await db.recibos.find_one({"id": recibo_id}, {"_id": 0})
    
    if not recibo:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    
    # Check permissions
    if current_user["role"] == UserRole.MOTORISTA:
        if recibo["motorista_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    elif current_user["role"] == UserRole.PARCEIRO:
        motorista = await db.motoristas.find_one({"id": recibo["motorista_id"]}, {"_id": 0})
        if motorista and motorista.get("parceiro_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Não autorizado")
    
    return recibo


@router.delete("/recibos/{recibo_id}")
async def delete_recibo(
    recibo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a receipt"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Apenas Admin/Gestão")
    
    result = await db.recibos.delete_one({"id": recibo_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    
    return {"message": "Recibo eliminado"}


# ==================== PAGAMENTOS E RECIBOS ====================

@router.get("/pagamentos-recibos")
async def get_pagamentos_recibos(
    motorista_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Get payment receipts"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {}
    
    if motorista_id:
        query["motorista_id"] = motorista_id
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    registros = await db.pagamentos_recibos.find(
        query,
        {"_id": 0}
    ).sort("data_criacao", -1).to_list(500)
    
    return registros


@router.get("/pagamentos-recibos/{registro_id}/recibo")
async def get_recibo_pagamento(
    registro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get receipt file for a payment"""
    registro = await db.pagamentos_recibos.find_one(
        {"id": registro_id},
        {"_id": 0}
    )
    
    if not registro:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    
    if not registro.get("recibo_path"):
        raise HTTPException(status_code=404, detail="Recibo não disponível")
    
    return {"recibo_path": registro["recibo_path"]}


@router.post("/pagamentos-recibos/{registro_id}/pagamento")
async def registar_pagamento(
    registro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Mark a payment as paid"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    result = await db.pagamentos_recibos.update_one(
        {"id": registro_id},
        {
            "$set": {
                "pago": True,
                "pago_por": current_user["id"],
                "pago_em": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    
    return {"message": "Pagamento registado"}


@router.patch("/pagamentos-recibos/{registro_id}/estado")
async def atualizar_estado_pagamento(
    registro_id: str,
    estado: str,
    current_user: Dict = Depends(get_current_user)
):
    """Update payment status"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    result = await db.pagamentos_recibos.update_one(
        {"id": registro_id},
        {
            "$set": {
                "estado": estado,
                "estado_updated_by": current_user["id"],
                "estado_updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    
    return {"message": f"Estado atualizado para {estado}"}



# ==================== EMPRESAS DE FATURAÇÃO ====================

@router.get("/empresas-faturacao")
async def listar_empresas_faturacao(
    current_user: dict = Depends(get_current_user)
):
    """Listar empresas de faturação do parceiro atual ou todas (admin)"""
    if current_user["role"] == UserRole.ADMIN:
        empresas = await db.empresas_faturacao.find({}, {"_id": 0}).to_list(1000)
    elif current_user["role"] == UserRole.PARCEIRO:
        empresas = await db.empresas_faturacao.find(
            {"parceiro_id": current_user["id"]}, 
            {"_id": 0}
        ).to_list(100)
    else:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    return empresas


@router.post("/empresas-faturacao")
async def criar_empresa_faturacao(
    data: Dict,
    current_user: dict = Depends(get_current_user)
):
    """Criar nova empresa de faturação para o parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Validar campos obrigatórios
    if not data.get("nome") or not data.get("nipc"):
        raise HTTPException(status_code=400, detail="Nome e NIPC são obrigatórios")
    
    parceiro_id = data.get("parceiro_id") if current_user["role"] == UserRole.ADMIN else current_user["id"]
    
    # Verificar se NIPC já existe para este parceiro
    existente = await db.empresas_faturacao.find_one({
        "parceiro_id": parceiro_id,
        "nipc": data["nipc"]
    })
    if existente:
        raise HTTPException(status_code=400, detail="Já existe uma empresa com este NIPC")
    
    empresa = {
        "id": str(uuid.uuid4()),
        "parceiro_id": parceiro_id,
        "nome": data["nome"],
        "nipc": data["nipc"],
        "morada": data.get("morada", ""),
        "codigo_postal": data.get("codigo_postal", ""),
        "cidade": data.get("cidade", ""),
        "email": data.get("email", ""),
        "telefone": data.get("telefone", ""),
        "iban": data.get("iban", ""),
        "ativa": True,
        "principal": data.get("principal", False),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.empresas_faturacao.insert_one(empresa)
    logger.info(f"Empresa de faturação criada: {empresa['nome']} por {current_user['id']}")
    
    return {"message": "Empresa criada com sucesso", "empresa": empresa}


@router.put("/empresas-faturacao/{empresa_id}")
async def atualizar_empresa_faturacao(
    empresa_id: str,
    data: Dict,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar empresa de faturação"""
    empresa = await db.empresas_faturacao.find_one({"id": empresa_id})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    if current_user["role"] == UserRole.PARCEIRO:
        if empresa["parceiro_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Esta empresa não lhe pertence")
    elif current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    campos_permitidos = ["nome", "nipc", "morada", "codigo_postal", "cidade", 
                         "email", "telefone", "iban", "ativa", "principal"]
    update_data = {k: v for k, v in data.items() if k in campos_permitidos}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.empresas_faturacao.update_one({"id": empresa_id}, {"$set": update_data})
    
    return {"message": "Empresa atualizada com sucesso"}


@router.delete("/empresas-faturacao/{empresa_id}")
async def eliminar_empresa_faturacao(
    empresa_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar empresa de faturação"""
    empresa = await db.empresas_faturacao.find_one({"id": empresa_id})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    if current_user["role"] == UserRole.PARCEIRO:
        if empresa["parceiro_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Esta empresa não lhe pertence")
    elif current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    recibos_count = await db.recibos.count_documents({"empresa_faturacao_id": empresa_id})
    if recibos_count > 0:
        raise HTTPException(status_code=400, detail=f"Existem {recibos_count} recibos associados")
    
    await db.empresas_faturacao.delete_one({"id": empresa_id})
    return {"message": "Empresa eliminada com sucesso"}


@router.put("/recibos/{recibo_id}/atribuir-empresa")
async def atribuir_empresa_recibo(
    recibo_id: str,
    data: Dict,
    current_user: dict = Depends(get_current_user)
):
    """Atribuir empresa de faturação a um recibo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    empresa_id = data.get("empresa_faturacao_id")
    if not empresa_id:
        raise HTTPException(status_code=400, detail="empresa_faturacao_id é obrigatório")
    
    empresa = await db.empresas_faturacao.find_one({"id": empresa_id})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    if current_user["role"] == UserRole.PARCEIRO and empresa["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Esta empresa não lhe pertence")
    
    await db.recibos.update_one(
        {"id": recibo_id},
        {"$set": {"empresa_faturacao_id": empresa_id, "empresa_atribuida_em": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Empresa atribuída ao recibo"}


@router.get("/dashboard/totais-empresa")
async def dashboard_totais_empresa(
    ano: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Dashboard com totais por empresa de faturação ao ano"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    ano = ano or datetime.now().year
    
    empresas_query = {"parceiro_id": current_user["id"]} if current_user["role"] == UserRole.PARCEIRO else {}
    empresas = await db.empresas_faturacao.find(empresas_query, {"_id": 0}).to_list(100)
    
    resultado = []
    for empresa in empresas:
        recibos = await db.recibos.find({
            "empresa_faturacao_id": empresa["id"],
            "criado_em": {"$regex": f"^{ano}"}
        }, {"_id": 0}).to_list(1000)
        
        total_valor = sum(r.get("valor", 0) for r in recibos)
        resultado.append({
            "empresa_id": empresa["id"],
            "empresa_nome": empresa["nome"],
            "empresa_nipc": empresa["nipc"],
            "ano": ano,
            "total_valor": total_valor,
            "total_recibos": len(recibos)
        })
    
    return {
        "ano": ano,
        "empresas": resultado,
        "totais": {"valor": sum(e["total_valor"] for e in resultado), "recibos": sum(e["total_recibos"] for e in resultado)}
    }


@router.get("/motorista/{motorista_id}/historico-recibos")
async def historico_recibos_motorista(
    motorista_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Histórico de recibos de um motorista com empresas associadas"""
    if current_user["role"] == UserRole.MOTORISTA and motorista_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    recibos = await db.recibos.find({"motorista_id": motorista_id}, {"_id": 0}).sort("criado_em", -1).to_list(500)
    
    for recibo in recibos:
        if recibo.get("empresa_faturacao_id"):
            empresa = await db.empresas_faturacao.find_one({"id": recibo["empresa_faturacao_id"]}, {"_id": 0, "nome": 1})
            recibo["empresa_nome"] = empresa.get("nome") if empresa else "Não encontrada"
        else:
            recibo["empresa_nome"] = "Não atribuída"
    
    por_empresa = {}
    for recibo in recibos:
        emp = recibo.get("empresa_nome", "Não atribuída")
        if emp not in por_empresa:
            por_empresa[emp] = {"total": 0, "count": 0}
        por_empresa[emp]["total"] += recibo.get("valor", 0)
        por_empresa[emp]["count"] += 1
    
    return {"motorista_id": motorista_id, "total_recibos": len(recibos), "recibos": recibos, "por_empresa": por_empresa}
