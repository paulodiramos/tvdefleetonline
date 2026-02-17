"""
Rotas para Gestão Manual de Ganhos Uber
- Edição de valores individuais
- Atualização em lote
- Histórico de alterações
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ganhos-uber", tags=["ganhos-uber-manual"])
security = HTTPBearer()
db = get_database()


class GanhoUberUpdate(BaseModel):
    """Modelo para atualização de ganho Uber"""
    pago_total: Optional[float] = None
    rendimentos_total: Optional[float] = None
    tarifa_total: Optional[float] = None
    gratificacao: Optional[float] = None
    portagens: Optional[float] = None
    taxa_servico: Optional[float] = None
    nota: Optional[str] = None


class GanhoUberCreate(BaseModel):
    """Modelo para criação manual de ganho Uber"""
    motorista_id: str
    nome_motorista: str
    semana: int
    ano: int
    pago_total: float
    rendimentos_total: Optional[float] = 0
    tarifa_total: Optional[float] = 0
    gratificacao: Optional[float] = 0
    portagens: Optional[float] = 0
    taxa_servico: Optional[float] = 0
    nota: Optional[str] = None


@router.get("")
async def listar_ganhos_uber(
    parceiro_id: Optional[str] = Query(None),
    motorista_id: Optional[str] = Query(None),
    semana: Optional[int] = Query(None),
    ano: Optional[int] = Query(None),
    limit: int = Query(100, le=500),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Lista ganhos Uber com filtros"""
    try:
        user = await get_current_user(credentials)
        
        query = {}
        
        # Filtros baseados na role
        if user['role'] == 'parceiro':
            query['parceiro_id'] = user['id']
        elif parceiro_id:
            query['parceiro_id'] = parceiro_id
            
        if motorista_id:
            query['motorista_id'] = motorista_id
        if semana:
            query['semana'] = semana
        if ano:
            query['ano'] = ano
            
        ganhos = await db.ganhos_uber.find(query, {"_id": 0}).sort([("ano", -1), ("semana", -1)]).limit(limit).to_list(limit)
        
        # Serializar datas
        for g in ganhos:
            for k, v in g.items():
                if isinstance(v, datetime):
                    g[k] = v.isoformat()
        
        return ganhos
        
    except Exception as e:
        logger.error(f"Erro ao listar ganhos Uber: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ganho_id}")
async def obter_ganho_uber(
    ganho_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Obtém um ganho Uber específico"""
    try:
        user = await get_current_user(credentials)
        
        ganho = await db.ganhos_uber.find_one({"id": ganho_id}, {"_id": 0})
        
        if not ganho:
            raise HTTPException(status_code=404, detail="Ganho não encontrado")
            
        # Verificar permissões
        if user['role'] == 'parceiro' and ganho.get('parceiro_id') != user['id']:
            raise HTTPException(status_code=403, detail="Acesso negado")
            
        # Serializar datas
        for k, v in ganho.items():
            if isinstance(v, datetime):
                ganho[k] = v.isoformat()
        
        return ganho
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter ganho Uber: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{ganho_id}")
async def atualizar_ganho_uber(
    ganho_id: str,
    dados: GanhoUberUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Atualiza um ganho Uber existente"""
    try:
        user = await get_current_user(credentials)
        
        if user['role'] not in ['admin', 'manager', 'parceiro']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Verificar se existe
        ganho = await db.ganhos_uber.find_one({"id": ganho_id})
        if not ganho:
            raise HTTPException(status_code=404, detail="Ganho não encontrado")
            
        # Verificar permissões
        if user['role'] == 'parceiro' and ganho.get('parceiro_id') != user['id']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Guardar histórico
        historico = {
            "id": str(uuid.uuid4()),
            "ganho_id": ganho_id,
            "valores_anteriores": {
                "pago_total": ganho.get('pago_total'),
                "rendimentos_total": ganho.get('rendimentos_total'),
                "tarifa_total": ganho.get('tarifa_total'),
                "gratificacao": ganho.get('gratificacao'),
                "portagens": ganho.get('portagens'),
                "taxa_servico": ganho.get('taxa_servico'),
            },
            "alterado_por": user['id'],
            "alterado_em": datetime.now(timezone.utc),
            "nota": dados.nota
        }
        await db.ganhos_uber_historico.insert_one(historico)
        
        # Preparar atualização
        update_data = {"updated_at": datetime.now(timezone.utc)}
        
        if dados.pago_total is not None:
            update_data['pago_total'] = dados.pago_total
        if dados.rendimentos_total is not None:
            update_data['rendimentos_total'] = dados.rendimentos_total
        if dados.tarifa_total is not None:
            update_data['tarifa_total'] = dados.tarifa_total
        if dados.gratificacao is not None:
            update_data['gratificacao'] = dados.gratificacao
        if dados.portagens is not None:
            update_data['portagens'] = dados.portagens
        if dados.taxa_servico is not None:
            update_data['taxa_servico'] = dados.taxa_servico
        if dados.nota:
            update_data['nota_edicao'] = dados.nota
            
        update_data['editado_manualmente'] = True
        update_data['editado_por'] = user['id']
        
        # Atualizar
        await db.ganhos_uber.update_one(
            {"id": ganho_id},
            {"$set": update_data}
        )
        
        logger.info(f"Ganho Uber {ganho_id} atualizado por {user['id']}")
        
        # Retornar ganho atualizado
        ganho_atualizado = await db.ganhos_uber.find_one({"id": ganho_id}, {"_id": 0})
        for k, v in ganho_atualizado.items():
            if isinstance(v, datetime):
                ganho_atualizado[k] = v.isoformat()
        
        return {
            "success": True,
            "message": "Ganho atualizado com sucesso",
            "ganho": ganho_atualizado
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar ganho Uber: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def criar_ganho_uber(
    dados: GanhoUberCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Cria um novo ganho Uber manualmente"""
    try:
        user = await get_current_user(credentials)
        
        if user['role'] not in ['admin', 'manager', 'parceiro']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Obter parceiro_id
        parceiro_id = user['id'] if user['role'] == 'parceiro' else user.get('parceiro_id')
        
        # Verificar se já existe para este motorista/semana/ano
        existe = await db.ganhos_uber.find_one({
            "motorista_id": dados.motorista_id,
            "semana": dados.semana,
            "ano": dados.ano
        })
        
        if existe:
            raise HTTPException(
                status_code=400, 
                detail=f"Já existe um registo para este motorista na semana {dados.semana}/{dados.ano}. Use o endpoint de atualização."
            )
        
        ganho = {
            "id": str(uuid.uuid4()),
            "motorista_id": dados.motorista_id,
            "nome_motorista": dados.nome_motorista,
            "parceiro_id": parceiro_id,
            "semana": dados.semana,
            "ano": dados.ano,
            "pago_total": dados.pago_total,
            "rendimentos_total": dados.rendimentos_total,
            "tarifa_total": dados.tarifa_total,
            "gratificacao": dados.gratificacao,
            "portagens": dados.portagens,
            "taxa_servico": dados.taxa_servico,
            "plataforma": "uber",
            "fonte": "manual",
            "criado_manualmente": True,
            "criado_por": user['id'],
            "nota_criacao": dados.nota,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.ganhos_uber.insert_one(ganho)
        
        logger.info(f"Ganho Uber criado manualmente por {user['id']}: {ganho['id']}")
        
        # Remover _id para resposta
        ganho_resposta = {k: v for k, v in ganho.items() if k != '_id'}
        for k, v in ganho_resposta.items():
            if isinstance(v, datetime):
                ganho_resposta[k] = v.isoformat()
        
        return {
            "success": True,
            "message": "Ganho criado com sucesso",
            "ganho": ganho_resposta
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar ganho Uber: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{ganho_id}")
async def eliminar_ganho_uber(
    ganho_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Elimina um ganho Uber (apenas admin)"""
    try:
        user = await get_current_user(credentials)
        
        if user['role'] != 'admin':
            raise HTTPException(status_code=403, detail="Apenas administradores podem eliminar registos")
        
        # Verificar se existe
        ganho = await db.ganhos_uber.find_one({"id": ganho_id})
        if not ganho:
            raise HTTPException(status_code=404, detail="Ganho não encontrado")
        
        # Mover para arquivo
        ganho['deleted_at'] = datetime.now(timezone.utc)
        ganho['deleted_by'] = user['id']
        await db.ganhos_uber_arquivo.insert_one(ganho)
        
        # Eliminar
        await db.ganhos_uber.delete_one({"id": ganho_id})
        
        logger.info(f"Ganho Uber {ganho_id} eliminado por {user['id']}")
        
        return {
            "success": True,
            "message": "Ganho eliminado com sucesso"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao eliminar ganho Uber: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ganho_id}/historico")
async def obter_historico_ganho(
    ganho_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Obtém o histórico de alterações de um ganho"""
    try:
        user = await get_current_user(credentials)
        
        historico = await db.ganhos_uber_historico.find(
            {"ganho_id": ganho_id}, 
            {"_id": 0}
        ).sort("alterado_em", -1).to_list(100)
        
        for h in historico:
            for k, v in h.items():
                if isinstance(v, datetime):
                    h[k] = v.isoformat()
        
        return historico
        
    except Exception as e:
        logger.error(f"Erro ao obter histórico: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/atualizar-lote")
async def atualizar_ganhos_lote(
    atualizacoes: List[dict],
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Atualiza múltiplos ganhos em lote"""
    try:
        user = await get_current_user(credentials)
        
        if user['role'] not in ['admin', 'manager']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        atualizados = 0
        erros = []
        
        for item in atualizacoes:
            try:
                ganho_id = item.get('id')
                if not ganho_id:
                    erros.append(f"Item sem ID: {item}")
                    continue
                
                update_data = {
                    "updated_at": datetime.now(timezone.utc),
                    "editado_manualmente": True,
                    "editado_por": user['id']
                }
                
                for campo in ['pago_total', 'rendimentos_total', 'tarifa_total', 'gratificacao', 'portagens', 'taxa_servico']:
                    if campo in item and item[campo] is not None:
                        update_data[campo] = float(item[campo])
                
                result = await db.ganhos_uber.update_one(
                    {"id": ganho_id},
                    {"$set": update_data}
                )
                
                if result.modified_count > 0:
                    atualizados += 1
                    
            except Exception as e:
                erros.append(f"Erro no ID {item.get('id')}: {str(e)}")
        
        logger.info(f"Atualização em lote: {atualizados} registos atualizados, {len(erros)} erros")
        
        return {
            "success": True,
            "atualizados": atualizados,
            "total": len(atualizacoes),
            "erros": erros
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na atualização em lote: {e}")
        raise HTTPException(status_code=500, detail=str(e))
