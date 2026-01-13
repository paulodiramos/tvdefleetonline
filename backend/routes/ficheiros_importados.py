"""
Ficheiros Importados Router
Handles imported files management (Uber, Bolt, etc.)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import logging

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/ficheiros-importados", tags=["ficheiros-importados"])
db = get_database()
logger = logging.getLogger(__name__)


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# Pydantic models
class FicheiroImportado(BaseModel):
    id: str
    nome_ficheiro: str
    plataforma: str
    tipo: Optional[str] = None
    status: str
    data_importacao: str
    importado_por: Optional[str] = None
    importado_por_nome: Optional[str] = None
    periodo_inicio: Optional[str] = None
    periodo_fim: Optional[str] = None
    total_registos: Optional[int] = None
    total_valor: Optional[float] = None
    registos_sucesso: Optional[int] = None
    registos_erro: Optional[int] = None
    aprovado_por: Optional[str] = None
    aprovado_por_nome: Optional[str] = None
    data_aprovacao: Optional[str] = None
    observacoes: Optional[str] = None


# ==================== CRUD ====================

@router.get("", response_model=List[FicheiroImportado])
async def listar_ficheiros_importados(
    plataforma: Optional[str] = None,
    status: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Listar todos os ficheiros importados com filtros opcionais"""
    filtro = {}
    
    if plataforma:
        filtro["plataforma"] = plataforma
    if status:
        filtro["status"] = status
    
    ficheiros = await db.ficheiros_importados.find(filtro, {"_id": 0}).sort("data_importacao", -1).to_list(None)
    return ficheiros


@router.get("/{ficheiro_id}", response_model=FicheiroImportado)
async def obter_ficheiro_importado(ficheiro_id: str, current_user: Dict = Depends(get_current_user)):
    """Obter detalhes de um ficheiro importado"""
    ficheiro = await db.ficheiros_importados.find_one({"id": ficheiro_id}, {"_id": 0})
    if not ficheiro:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    return ficheiro


@router.put("/{ficheiro_id}/aprovar")
async def aprovar_ficheiro_importado(
    ficheiro_id: str, 
    dados: Optional[Dict[str, Any]] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Aprovar um ficheiro importado e criar relatórios de rascunho"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    ficheiro = await db.ficheiros_importados.find_one({"id": ficheiro_id}, {"_id": 0})
    if not ficheiro:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    if ficheiro["status"] == "aprovado":
        raise HTTPException(status_code=400, detail="Ficheiro já está aprovado")
    
    observacoes = dados.get("observacoes") if dados else None
    
    updates = {
        "status": "aprovado",
        "aprovado_por": current_user["id"],
        "aprovado_por_nome": current_user.get("name", current_user["email"]),
        "data_aprovacao": datetime.now(timezone.utc).isoformat()
    }
    
    if observacoes:
        updates["observacoes"] = observacoes
    
    await db.ficheiros_importados.update_one({"id": ficheiro_id}, {"$set": updates})
    
    # Criar relatórios de rascunho após aprovação (se tiver período definido)
    info_rascunhos = None
    if ficheiro.get("periodo_inicio") and ficheiro.get("periodo_fim"):
        try:
            from server import criar_relatorios_rascunho_apos_importacao
            info_rascunhos = await criar_relatorios_rascunho_apos_importacao(
                plataforma=ficheiro.get("plataforma"),
                periodo_inicio=ficheiro.get("periodo_inicio"),
                periodo_fim=ficheiro.get("periodo_fim"),
                parceiro_id=ficheiro.get("importado_por"),
                db=db
            )
            logger.info(f"📊 Relatórios criados após aprovação: {info_rascunhos}")
        except Exception as e:
            logger.warning(f"Não foi possível criar relatórios de rascunho: {e}")
    
    logger.info(f"✅ Ficheiro {ficheiro['nome_ficheiro']} aprovado por {current_user.get('name')}")
    return {
        "message": "Ficheiro aprovado com sucesso", 
        "ficheiro": {**ficheiro, **updates},
        "rascunhos": info_rascunhos
    }


@router.put("/{ficheiro_id}/rejeitar")
async def rejeitar_ficheiro_importado(
    ficheiro_id: str, 
    dados: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Rejeitar um ficheiro importado"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    ficheiro = await db.ficheiros_importados.find_one({"id": ficheiro_id}, {"_id": 0})
    if not ficheiro:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    observacoes = dados.get("observacoes", "")
    if not observacoes:
        raise HTTPException(status_code=400, detail="Observações são obrigatórias para rejeitar")
    
    updates = {
        "status": "rejeitado",
        "aprovado_por": current_user["id"],
        "aprovado_por_nome": current_user.get("name", current_user["email"]),
        "data_aprovacao": datetime.now(timezone.utc).isoformat(),
        "observacoes": observacoes
    }
    
    await db.ficheiros_importados.update_one({"id": ficheiro_id}, {"$set": updates})
    
    logger.info(f"❌ Ficheiro {ficheiro['nome_ficheiro']} rejeitado por {current_user.get('name')}")
    return {"message": "Ficheiro rejeitado", "ficheiro": {**ficheiro, **updates}}


@router.delete("/{ficheiro_id}")
async def deletar_ficheiro_importado(ficheiro_id: str, current_user: Dict = Depends(get_current_user)):
    """Deletar um ficheiro importado (apenas admin/gestão)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Apenas admin/gestão pode deletar")
    
    ficheiro = await db.ficheiros_importados.find_one({"id": ficheiro_id}, {"_id": 0})
    if not ficheiro:
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    await db.ficheiros_importados.delete_one({"id": ficheiro_id})
    logger.info(f"🗑️ Ficheiro {ficheiro['nome_ficheiro']} deletado")
    return {"message": "Ficheiro deletado com sucesso"}


# ==================== ESTATÍSTICAS ====================

@router.get("/stats/resumo")
async def estatisticas_ficheiros(current_user: Dict = Depends(get_current_user)):
    """Obter estatísticas dos ficheiros importados"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Total por status
    pipeline_status = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    por_status = await db.ficheiros_importados.aggregate(pipeline_status).to_list(10)
    
    # Total por plataforma
    pipeline_plataforma = [
        {"$group": {"_id": "$plataforma", "count": {"$sum": 1}, "total_valor": {"$sum": "$total_valor"}}}
    ]
    por_plataforma = await db.ficheiros_importados.aggregate(pipeline_plataforma).to_list(20)
    
    # Totais gerais
    total = await db.ficheiros_importados.count_documents({})
    pendentes = await db.ficheiros_importados.count_documents({"status": "pendente"})
    aprovados = await db.ficheiros_importados.count_documents({"status": "aprovado"})
    
    return {
        "total": total,
        "pendentes": pendentes,
        "aprovados": aprovados,
        "por_status": {item["_id"]: item["count"] for item in por_status},
        "por_plataforma": {
            item["_id"]: {
                "count": item["count"],
                "total_valor": round(item.get("total_valor", 0) or 0, 2)
            } for item in por_plataforma
        }
    }


# ==================== FILTROS AVANÇADOS ====================

@router.get("/por-periodo")
async def ficheiros_por_periodo(
    data_inicio: str,
    data_fim: str,
    plataforma: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Listar ficheiros importados num período específico"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    filtro = {
        "data_importacao": {
            "$gte": data_inicio,
            "$lte": data_fim
        }
    }
    
    if plataforma:
        filtro["plataforma"] = plataforma
    
    ficheiros = await db.ficheiros_importados.find(filtro, {"_id": 0}).sort("data_importacao", -1).to_list(None)
    return ficheiros


@router.get("/pendentes-aprovacao")
async def ficheiros_pendentes_aprovacao(current_user: Dict = Depends(get_current_user)):
    """Listar ficheiros pendentes de aprovação"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    ficheiros = await db.ficheiros_importados.find(
        {"status": "pendente"},
        {"_id": 0}
    ).sort("data_importacao", -1).to_list(None)
    
    return ficheiros
