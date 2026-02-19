"""Contabilidade routes for TVDEFleet - Faturas e Recibos"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter(prefix="/contabilidade", tags=["contabilidade"])

# Get database reference
db = get_database()


@router.get("/faturas-fornecedores")
async def get_faturas_fornecedores(
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    parceiro_id: Optional[str] = Query(None),
    current_user: Dict = Depends(get_current_user)
):
    """Obter faturas de fornecedores (manutenções de veículos)"""
    
    # Verificar permissão - admin, contabilista, ou parceiro próprio
    if current_user["role"] not in [UserRole.ADMIN, UserRole.CONTABILISTA, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    faturas = []
    
    # Query para veículos
    query = {}
    if parceiro_id:
        query["parceiro_id"] = parceiro_id
    elif current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    elif current_user["role"] == UserRole.GESTAO:
        # Gestor vê veículos dos parceiros atribuídos
        gestor = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "parceiros_atribuidos": 1})
        parceiros_ids = gestor.get("parceiros_atribuidos", []) if gestor else []
        if parceiros_ids:
            query["parceiro_id"] = {"$in": parceiros_ids}
    elif current_user["role"] == UserRole.CONTABILISTA:
        # Contabilista vê veículos dos parceiros associados
        contabilista = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "parceiros_associados": 1, "parceiro_ativo_id": 1})
        parceiro_ativo = contabilista.get("parceiro_ativo_id") if contabilista else None
        if parceiro_ativo:
            # Se tem parceiro ativo, mostra apenas esse
            query["parceiro_id"] = parceiro_ativo
        else:
            # Senão, mostra todos os associados
            parceiros_ids = contabilista.get("parceiros_associados", []) if contabilista else []
            if parceiros_ids:
                query["parceiro_id"] = {"$in": parceiros_ids}
            else:
                return []  # Sem parceiros associados, retorna vazio
    
    # Buscar veículos com manutenções que têm faturas
    async for veiculo in db.vehicles.find(query, {"_id": 0}):
        manutencoes = veiculo.get("manutencoes", [])
        
        for manut in manutencoes:
            # Só incluir se tiver dados de fatura
            if manut.get("fatura_numero") or manut.get("fatura_url"):
                data_manut = manut.get("data", manut.get("created_at", ""))
                
                # Filtrar por data
                if data_inicio and data_manut < data_inicio:
                    continue
                if data_fim and data_manut > data_fim:
                    continue
                
                faturas.append({
                    "numero": manut.get("fatura_numero", ""),
                    "fornecedor": manut.get("fatura_fornecedor") or manut.get("fornecedor") or manut.get("oficina", ""),
                    "data": manut.get("fatura_data") or data_manut,
                    "descricao": manut.get("descricao", manut.get("tipo", "")),
                    "valor": manut.get("valor", 0),
                    "url": manut.get("fatura_url", ""),
                    "veiculo_matricula": veiculo.get("plate") or veiculo.get("matricula", ""),
                    "veiculo_id": veiculo.get("id", ""),
                    "tipo": "manutencao"
                })
    
    # Ordenar por data (mais recente primeiro)
    faturas.sort(key=lambda x: x.get("data", ""), reverse=True)
    
    return faturas


@router.get("/recibos-motoristas")
async def get_recibos_motoristas(
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    parceiro_id: Optional[str] = Query(None),
    current_user: Dict = Depends(get_current_user)
):
    """Obter recibos de motoristas"""
    
    # Verificar permissão
    if current_user["role"] not in [UserRole.ADMIN, UserRole.CONTABILISTA, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    recibos = []
    
    # Query base
    query = {}
    if parceiro_id:
        query["parceiro_id"] = parceiro_id
    elif current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    elif current_user["role"] == UserRole.GESTAO:
        gestor = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "parceiros_atribuidos": 1})
        parceiros_ids = gestor.get("parceiros_atribuidos", []) if gestor else []
        if parceiros_ids:
            query["parceiro_id"] = {"$in": parceiros_ids}
    elif current_user["role"] == UserRole.CONTABILISTA:
        # Contabilista vê recibos dos parceiros associados
        contabilista = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "parceiros_associados": 1, "parceiro_ativo_id": 1})
        parceiro_ativo = contabilista.get("parceiro_ativo_id") if contabilista else None
        if parceiro_ativo:
            query["parceiro_id"] = parceiro_ativo
        else:
            parceiros_ids = contabilista.get("parceiros_associados", []) if contabilista else []
            if parceiros_ids:
                query["parceiro_id"] = {"$in": parceiros_ids}
            else:
                return []
    
    # Buscar na coleção de recibos (se existir)
    if await db.list_collection_names():
        if "recibos" in await db.list_collection_names():
            async for recibo in db.recibos.find(query, {"_id": 0}):
                data_recibo = recibo.get("data", recibo.get("created_at", ""))
                
                if data_inicio and data_recibo < data_inicio:
                    continue
                if data_fim and data_recibo > data_fim:
                    continue
                
                recibos.append({
                    "numero": recibo.get("numero", ""),
                    "motorista_nome": recibo.get("motorista_nome", ""),
                    "motorista_id": recibo.get("motorista_id", ""),
                    "data": data_recibo,
                    "tipo": recibo.get("tipo", ""),
                    "valor": recibo.get("valor", 0),
                    "url": recibo.get("url", recibo.get("file_url", ""))
                })
    
    # Também buscar recibos em ganhos/pagamentos
    ganhos_query = dict(query)
    if "recibo_url" in ganhos_query:
        del ganhos_query["recibo_url"]
    
    # Buscar ganhos com recibos
    async for ganho in db.ganhos.find(ganhos_query, {"_id": 0}):
        if ganho.get("recibo_url") or ganho.get("comprovativo_url"):
            data_ganho = ganho.get("data", ganho.get("created_at", ""))
            
            if data_inicio and data_ganho < data_inicio:
                continue
            if data_fim and data_ganho > data_fim:
                continue
            
            # Buscar nome do motorista
            motorista_nome = ganho.get("motorista_nome", "")
            if not motorista_nome and ganho.get("motorista_id"):
                motorista = await db.motoristas.find_one({"id": ganho["motorista_id"]}, {"_id": 0, "name": 1})
                motorista_nome = motorista.get("name", "") if motorista else ""
            
            recibos.append({
                "numero": ganho.get("recibo_numero", ""),
                "motorista_nome": motorista_nome,
                "motorista_id": ganho.get("motorista_id", ""),
                "data": data_ganho,
                "tipo": ganho.get("plataforma", "Ganhos"),
                "valor": ganho.get("valor", ganho.get("total", 0)),
                "url": ganho.get("recibo_url") or ganho.get("comprovativo_url", "")
            })
    
    # Ordenar por data
    recibos.sort(key=lambda x: x.get("data", ""), reverse=True)
    
    return recibos


@router.get("/faturas-veiculos")
async def get_faturas_veiculos(
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    parceiro_id: Optional[str] = Query(None),
    current_user: Dict = Depends(get_current_user)
):
    """Obter todas as faturas relacionadas com veículos (manutenção e seguros)"""
    
    # Verificar permissão
    if current_user["role"] not in [UserRole.ADMIN, UserRole.CONTABILISTA, UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    faturas = []
    
    # Query para veículos
    query = {}
    if parceiro_id:
        query["parceiro_id"] = parceiro_id
    elif current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    elif current_user["role"] == UserRole.GESTAO:
        gestor = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "parceiros_atribuidos": 1})
        parceiros_ids = gestor.get("parceiros_atribuidos", []) if gestor else []
        if parceiros_ids:
            query["parceiro_id"] = {"$in": parceiros_ids}
    elif current_user["role"] == UserRole.CONTABILISTA:
        # Contabilista vê faturas dos parceiros associados
        contabilista = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "parceiros_associados": 1, "parceiro_ativo_id": 1})
        parceiro_ativo = contabilista.get("parceiro_ativo_id") if contabilista else None
        if parceiro_ativo:
            query["parceiro_id"] = parceiro_ativo
        else:
            parceiros_ids = contabilista.get("parceiros_associados", []) if contabilista else []
            if parceiros_ids:
                query["parceiro_id"] = {"$in": parceiros_ids}
            else:
                return []
    
    async for veiculo in db.vehicles.find(query, {"_id": 0}):
        matricula = veiculo.get("plate") or veiculo.get("matricula", "")
        
        # Faturas de manutenção
        manutencoes = veiculo.get("manutencoes", [])
        for manut in manutencoes:
            if manut.get("fatura_numero") or manut.get("fatura_url") or manut.get("valor"):
                data_manut = manut.get("fatura_data") or manut.get("data", "")
                
                if data_inicio and data_manut < data_inicio:
                    continue
                if data_fim and data_manut > data_fim:
                    continue
                
                faturas.append({
                    "matricula": matricula,
                    "veiculo_id": veiculo.get("id", ""),
                    "tipo": "manutencao",
                    "fatura_numero": manut.get("fatura_numero", ""),
                    "fatura_data": data_manut,
                    "fatura_fornecedor": manut.get("fatura_fornecedor") or manut.get("fornecedor") or manut.get("oficina", ""),
                    "valor": manut.get("valor", 0),
                    "fatura_url": manut.get("fatura_url", ""),
                    "descricao": manut.get("descricao", manut.get("tipo", ""))
                })
        
        # Faturas de seguro
        seguro = veiculo.get("seguro", {})
        if seguro and (seguro.get("fatura_numero") or seguro.get("fatura_url") or seguro.get("valor_premio")):
            data_seguro = seguro.get("fatura_data") or seguro.get("data_inicio", "")
            
            if not (data_inicio and data_seguro < data_inicio) and not (data_fim and data_seguro > data_fim):
                faturas.append({
                    "matricula": matricula,
                    "veiculo_id": veiculo.get("id", ""),
                    "tipo": "seguro",
                    "fatura_numero": seguro.get("fatura_numero", seguro.get("apolice", "")),
                    "fatura_data": data_seguro,
                    "fatura_fornecedor": seguro.get("seguradora", ""),
                    "valor": seguro.get("valor_premio", 0),
                    "fatura_url": seguro.get("fatura_url", ""),
                    "descricao": f"Seguro - {seguro.get('seguradora', 'N/A')}"
                })
    
    # Ordenar por data
    faturas.sort(key=lambda x: x.get("fatura_data", ""), reverse=True)
    
    return faturas


@router.get("/resumo")
async def get_resumo_contabilidade(
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    parceiro_id: Optional[str] = Query(None),
    current_user: Dict = Depends(get_current_user)
):
    """Obter resumo de contabilidade"""
    
    if current_user["role"] not in [UserRole.ADMIN, "contabilista", UserRole.PARCEIRO, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Buscar dados
    faturas = await get_faturas_fornecedores(data_inicio, data_fim, parceiro_id, current_user)
    recibos = await get_recibos_motoristas(data_inicio, data_fim, parceiro_id, current_user)
    
    return {
        "total_faturas": len(faturas),
        "total_recibos": len(recibos),
        "valor_faturas": sum(f.get("valor", 0) for f in faturas),
        "valor_recibos": sum(r.get("valor", 0) for r in recibos),
        "periodo": {
            "inicio": data_inicio,
            "fim": data_fim
        }
    }
