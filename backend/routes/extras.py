"""
Rotas para gestão de Extras dos Motoristas (Dívidas, Caução, Danos)
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging
import os
import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/extras-motorista", tags=["Extras Motorista"])

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

security = HTTPBearer()

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'tvdefleet_db')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate JWT token and return current user"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilizador não encontrado")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


@router.get("")
async def listar_extras_motorista(
    motorista_id: Optional[str] = None,
    semana: Optional[int] = None,
    ano: Optional[int] = None,
    tipo: Optional[str] = None,
    pago: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Lista extras de motoristas com filtros"""
    try:
        query = {}
        
        # Filtro por parceiro
        if current_user['role'] == 'parceiro':
            query['parceiro_id'] = current_user['id']
        
        # Filtros opcionais
        if motorista_id:
            query['motorista_id'] = motorista_id
        if semana is not None:
            query['semana'] = semana
        if ano is not None:
            query['ano'] = ano
        if tipo:
            query['tipo'] = tipo
        if pago is not None:
            query['pago'] = pago
        
        extras = await db.extras_motorista.find(query, {'_id': 0}).to_list(1000)
        
        return extras
        
    except Exception as e:
        logger.error(f"Erro ao listar extras: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def criar_extra_motorista(
    extra: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Cria um novo extra para motorista"""
    try:
        if current_user['role'] not in ['admin', 'gestao', 'parceiro']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Determinar parceiro_id
        parceiro_id = current_user['id'] if current_user['role'] == 'parceiro' else extra.get('parceiro_id')
        
        # Verificar se motorista existe
        motorista = await db.motoristas.find_one({'id': extra['motorista_id']})
        if not motorista:
            raise HTTPException(status_code=404, detail="Motorista não encontrado")
        
        # Criar extra
        extra_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        extra_doc = {
            'id': extra_id,
            'motorista_id': extra['motorista_id'],
            'parceiro_id': parceiro_id,
            'tipo': extra['tipo'],  # divida, caucao_parcelada, dano, multa, outro
            'descricao': extra['descricao'],
            'valor': float(extra['valor']),
            'data': extra.get('data', now.strftime('%Y-%m-%d')),
            'semana': extra.get('semana'),
            'ano': extra.get('ano'),
            'parcelas_total': extra.get('parcelas_total'),
            'parcela_atual': extra.get('parcela_atual'),
            'pago': extra.get('pago', False),
            'data_pagamento': None,
            'observacoes': extra.get('observacoes'),
            'created_by': current_user['id'],
            'created_at': now.isoformat()
        }
        
        await db.extras_motorista.insert_one(extra_doc)
        
        return {'success': True, 'id': extra_id, 'extra': extra_doc}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar extra: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{extra_id}")
async def atualizar_extra_motorista(
    extra_id: str,
    extra: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Atualiza um extra"""
    try:
        if current_user['role'] not in ['admin', 'gestao', 'parceiro']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Verificar se extra existe
        existing = await db.extras_motorista.find_one({'id': extra_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Extra não encontrado")
        
        # Verificar permissão
        if current_user['role'] == 'parceiro' and existing.get('parceiro_id') != current_user['id']:
            raise HTTPException(status_code=403, detail="Sem permissão para este extra")
        
        # Atualizar
        update_data = {
            'tipo': extra.get('tipo', existing.get('tipo')),
            'descricao': extra.get('descricao', existing.get('descricao')),
            'valor': float(extra.get('valor', existing.get('valor'))),
            'pago': extra.get('pago', existing.get('pago')),
            'observacoes': extra.get('observacoes', existing.get('observacoes')),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        if extra.get('pago') and not existing.get('pago'):
            update_data['data_pagamento'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        await db.extras_motorista.update_one(
            {'id': extra_id},
            {'$set': update_data}
        )
        
        return {'success': True, 'message': 'Extra atualizado'}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar extra: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{extra_id}")
async def eliminar_extra_motorista(
    extra_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Elimina um extra"""
    try:
        if current_user['role'] not in ['admin', 'gestao', 'parceiro']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Verificar se extra existe
        existing = await db.extras_motorista.find_one({'id': extra_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Extra não encontrado")
        
        # Verificar permissão
        if current_user['role'] == 'parceiro' and existing.get('parceiro_id') != current_user['id']:
            raise HTTPException(status_code=403, detail="Sem permissão para este extra")
        
        await db.extras_motorista.delete_one({'id': extra_id})
        
        return {'success': True, 'message': 'Extra eliminado'}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao eliminar extra: {e}")
        raise HTTPException(status_code=500, detail=str(e))
