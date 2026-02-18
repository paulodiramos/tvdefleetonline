"""
Empresas de Faturação - Router separado para evitar conflitos
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Optional
from datetime import datetime, timezone
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user
from models.user import UserRole

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/empresas-faturacao", tags=["Empresas de Faturação"])
db = get_database()


@router.get("/")
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
    
    # Adicionar info do parceiro
    for empresa in empresas:
        parceiro = await db.users.find_one({"id": empresa.get("parceiro_id")}, {"_id": 0, "name": 1, "email": 1})
        if not parceiro:
            parceiro = await db.parceiros.find_one({"id": empresa.get("parceiro_id")}, {"_id": 0, "nome_empresa": 1, "email": 1})
        empresa["parceiro_nome"] = parceiro.get("name") or parceiro.get("nome_empresa") if parceiro else "Desconhecido"
    
    return empresas


@router.post("/")
async def criar_empresa_faturacao(
    data: Dict,
    current_user: dict = Depends(get_current_user)
):
    """Criar nova empresa de faturação para o parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if not data.get("nome") or not data.get("nipc"):
        raise HTTPException(status_code=400, detail="Nome e NIPC são obrigatórios")
    
    parceiro_id = data.get("parceiro_id") if current_user["role"] == UserRole.ADMIN else current_user["id"]
    
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
    
    if empresa["principal"]:
        await db.empresas_faturacao.update_many(
            {"parceiro_id": parceiro_id},
            {"$set": {"principal": False}}
        )
    
    await db.empresas_faturacao.insert_one(empresa)
    logger.info(f"Empresa de faturação criada: {empresa['nome']} por {current_user['id']}")
    
    # Remove MongoDB _id before returning
    empresa.pop("_id", None)
    return {"message": "Empresa criada com sucesso", "empresa": empresa}


@router.get("/{empresa_id}")
async def obter_empresa_faturacao(
    empresa_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de uma empresa de faturação"""
    empresa = await db.empresas_faturacao.find_one({"id": empresa_id}, {"_id": 0})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    if current_user["role"] == UserRole.PARCEIRO:
        if empresa["parceiro_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Esta empresa não lhe pertence")
    elif current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    return empresa


@router.put("/{empresa_id}")
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
    
    if data.get("principal"):
        await db.empresas_faturacao.update_many(
            {"parceiro_id": empresa["parceiro_id"], "id": {"$ne": empresa_id}},
            {"$set": {"principal": False}}
        )
    
    campos_permitidos = ["nome", "nipc", "morada", "codigo_postal", "cidade", 
                         "email", "telefone", "iban", "ativa", "principal"]
    update_data = {k: v for k, v in data.items() if k in campos_permitidos}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.empresas_faturacao.update_one({"id": empresa_id}, {"$set": update_data})
    
    return {"message": "Empresa atualizada com sucesso"}


@router.delete("/{empresa_id}")
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


@router.get("/dashboard/totais-ano")
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
    motoristas_data = {}  # Acumulador por motorista
    
    for empresa in empresas:
        # Buscar em recibos
        recibos = await db.recibos.find({
            "empresa_faturacao_id": empresa["id"]
        }, {"_id": 0}).to_list(1000)
        
        # Buscar em pagamentos_recibos
        pagamentos = await db.pagamentos_recibos.find({
            "empresa_faturacao_id": empresa["id"]
        }, {"_id": 0}).to_list(1000)
        
        # Acumular por motorista
        for recibo in recibos:
            motorista_id = recibo.get("motorista_id")
            motorista_nome = recibo.get("motorista_nome", "Desconhecido")
            valor = recibo.get("valor", 0)
            
            if motorista_id:
                if motorista_id not in motoristas_data:
                    motoristas_data[motorista_id] = {
                        "motorista_id": motorista_id,
                        "motorista_nome": motorista_nome,
                        "total_valor": 0,
                        "total_recibos": 0,
                        "empresas": {}
                    }
                motoristas_data[motorista_id]["total_valor"] += valor
                motoristas_data[motorista_id]["total_recibos"] += 1
                
                # Por empresa
                if empresa["id"] not in motoristas_data[motorista_id]["empresas"]:
                    motoristas_data[motorista_id]["empresas"][empresa["id"]] = {
                        "empresa_nome": empresa["nome"],
                        "total_valor": 0,
                        "total_recibos": 0
                    }
                motoristas_data[motorista_id]["empresas"][empresa["id"]]["total_valor"] += valor
                motoristas_data[motorista_id]["empresas"][empresa["id"]]["total_recibos"] += 1
        
        total_recibos = sum(r.get("valor", 0) for r in recibos)
        total_pagamentos = sum(p.get("valor_total", 0) for p in pagamentos)
        
        resultado.append({
            "empresa_id": empresa["id"],
            "empresa_nome": empresa["nome"],
            "empresa_nipc": empresa["nipc"],
            "ano": ano,
            "total_valor": total_recibos + total_pagamentos,
            "total_recibos": len(recibos),
            "total_pagamentos": len(pagamentos)
        })
    
    # Converter motoristas para lista e calcular percentagens
    total_geral = sum(e["total_valor"] for e in resultado) or 1
    motoristas_list = []
    for m in motoristas_data.values():
        m["percentagem"] = round((m["total_valor"] / total_geral) * 100, 1)
        # Converter empresas dict para lista
        m["empresas"] = list(m["empresas"].values())
        motoristas_list.append(m)
    
    # Ordenar por total_valor descendente
    motoristas_list.sort(key=lambda x: x["total_valor"], reverse=True)
    
    return {
        "ano": ano,
        "empresas": resultado,
        "motoristas": motoristas_list,
        "totais": {
            "valor": sum(e["total_valor"] for e in resultado),
            "recibos": sum(e["total_recibos"] for e in resultado)
        }
    }
