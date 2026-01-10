"""Ganhos routes - Uber, Bolt earnings"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import logging

from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)
security = HTTPBearer()


@router.get("/ganhos-bolt")
async def listar_ganhos_bolt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    motorista_id: Optional[str] = None,
    parceiro_id: Optional[str] = None,
    periodo_ano: Optional[str] = None,
    periodo_semana: Optional[str] = None
):
    """Lista ganhos importados da Bolt"""
    try:
        user = await get_current_user(credentials)
        
        query = {}
        if motorista_id:
            query['motorista_id'] = motorista_id
        if parceiro_id:
            query['parceiro_id'] = parceiro_id
        if periodo_ano:
            query['periodo_ano'] = periodo_ano
        if periodo_semana:
            query['periodo_semana'] = periodo_semana
        
        ganhos = await db.ganhos_bolt.find(query, {"_id": 0}).sort('data_importacao', -1).to_list(length=None)
        return ganhos
        
    except Exception as e:
        logger.error(f"Erro ao listar ganhos Bolt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ganhos-uber")
async def listar_ganhos_uber(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    motorista_id: Optional[str] = None,
    periodo_inicio: Optional[str] = None,
    periodo_fim: Optional[str] = None
):
    """Lista ganhos importados da Uber"""
    try:
        user = await get_current_user(credentials)
        
        query = {}
        if motorista_id:
            query['motorista_id'] = motorista_id
        if periodo_inicio:
            query['periodo_inicio'] = periodo_inicio
        if periodo_fim:
            query['periodo_fim'] = periodo_fim
        
        ganhos = await db.ganhos_uber.find(query, {"_id": 0}).sort('data_importacao', -1).to_list(length=None)
        return ganhos
        
    except Exception as e:
        logger.error(f"Erro ao listar ganhos Uber: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dados/{plataforma}")
async def obter_dados_plataforma(
    plataforma: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    motorista_id: Optional[str] = None,
    semana: Optional[int] = None,
    ano: Optional[int] = None
):
    """Obter dados agregados por plataforma"""
    try:
        user = await get_current_user(credentials)
        
        if plataforma.lower() == "uber":
            query = {}
            if motorista_id:
                query['motorista_id'] = motorista_id
            if semana:
                query['semana'] = semana
            if ano:
                query['ano'] = ano
            
            dados = await db.ganhos_uber.find(query, {"_id": 0}).to_list(100)
            
        elif plataforma.lower() == "bolt":
            query = {}
            if motorista_id:
                query['motorista_id'] = motorista_id
            if semana:
                query['periodo_semana'] = semana
            if ano:
                query['periodo_ano'] = ano
            
            dados = await db.ganhos_bolt.find(query, {"_id": 0}).to_list(100)
            
        elif plataforma.lower() == "viaverde":
            query = {}
            if motorista_id:
                query['motorista_id'] = motorista_id
            
            dados = await db.portagens_viaverde.find(query, {"_id": 0}).to_list(100)
            
        elif plataforma.lower() == "combustivel":
            query = {}
            if motorista_id:
                query['motorista_id'] = motorista_id
            
            dados = await db.abastecimentos_combustivel.find(query, {"_id": 0}).to_list(100)
            
        else:
            raise HTTPException(status_code=400, detail=f"Plataforma '{plataforma}' não suportada")
        
        return {
            "plataforma": plataforma,
            "total_registos": len(dados),
            "dados": dados
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter dados {plataforma}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
