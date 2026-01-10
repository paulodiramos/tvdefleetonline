"""
Rotas para gestão de Extras dos Motoristas (Dívidas, Caução, Danos)
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/extras-motorista", tags=["Extras Motorista"])


def get_db():
    """Get database connection from server module"""
    from server import db
    return db


async def get_current_user(credentials=None):
    """Import get_current_user from server"""
    from server import get_current_user as server_get_current_user
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
    from fastapi import Depends
    
    security = HTTPBearer()
    # This will be handled by the actual dependency injection
    pass


# Re-import the actual dependency
from server import get_current_user


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
        db = get_db()
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
        db = get_db()
        
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
        db = get_db()
        
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
        db = get_db()
        
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
