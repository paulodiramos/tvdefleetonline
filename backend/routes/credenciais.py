"""
API Routes para Gestão de Credenciais de Plataformas
Movido de server.py durante refatoração
"""

from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/credenciais-plataforma", tags=["credenciais-plataforma"])

db = get_database()


@router.get("")
async def listar_credenciais(
    parceiro_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar credenciais de plataformas"""
    try:
        query = {}
        
        if parceiro_id:
            query['parceiro_id'] = parceiro_id
        
        if current_user['role'] not in ['admin', 'gestao']:
            query['parceiro_id'] = current_user['id']
        
        credenciais = await db.credenciais_plataforma.find(
            query,
            {"_id": 0, "password": 0, "password_encrypted": 0}
        ).to_list(1000)
        
        return credenciais
        
    except Exception as e:
        logger.error(f"Erro ao listar credenciais: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def criar_credencial(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Criar nova credencial de plataforma"""
    try:
        if current_user['role'] not in ['admin', 'gestao', 'parceiro']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        required_fields = ['plataforma', 'email', 'password']
        for field in required_fields:
            if not request.get(field):
                raise HTTPException(status_code=400, detail=f"Campo {field} é obrigatório")
        
        parceiro_id = request.get('parceiro_id')
        if current_user['role'] == 'parceiro':
            parceiro_id = current_user['id']
        
        existing = await db.credenciais_plataforma.find_one({
            'plataforma': request['plataforma'],
            'parceiro_id': parceiro_id
        })
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail="Já existe credencial para esta plataforma e parceiro"
            )
        
        credencial = {
            "id": str(uuid.uuid4()),
            "parceiro_id": parceiro_id,
            "plataforma": request['plataforma'],
            "email": request['email'],
            "password": request['password'],
            "ativo": request.get('ativo', True),
            "sincronizacao_automatica": request.get('sincronizacao_automatica', True),
            "frequencia_dias": request.get('frequencia_dias', 7),
            "ultima_sincronizacao": None,
            "proximo_sincronizacao": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user['id']
        }
        
        await db.credenciais_plataforma.insert_one(credencial)
        
        logger.info(f"✅ Credencial criada: {credencial['plataforma']} para {credencial.get('email')}")
        
        return {"success": True, "message": "Credencial criada com sucesso", "id": credencial['id']}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar credencial: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{cred_id}")
async def atualizar_credencial(
    cred_id: str,
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Atualizar credencial existente"""
    try:
        credencial = await db.credenciais_plataforma.find_one({"id": cred_id}, {"_id": 0})
        if not credencial:
            raise HTTPException(status_code=404, detail="Credencial não encontrada")
        
        if current_user['role'] not in ['admin', 'gestao']:
            if credencial['parceiro_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Acesso negado")
        
        update_data = {
            "email": request.get('email', credencial['email']),
            "ativo": request.get('ativo', credencial['ativo']),
            "sincronizacao_automatica": request.get('sincronizacao_automatica', credencial.get('sincronizacao_automatica', True)),
            "frequencia_dias": request.get('frequencia_dias', credencial.get('frequencia_dias', 7)),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if request.get('password'):
            update_data['password'] = request['password']
        
        await db.credenciais_plataforma.update_one(
            {"id": cred_id},
            {"$set": update_data}
        )
        
        return {"success": True, "message": "Credencial atualizada"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar credencial: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{cred_id}")
async def deletar_credencial(
    cred_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deletar credencial"""
    try:
        credencial = await db.credenciais_plataforma.find_one({"id": cred_id}, {"_id": 0})
        if not credencial:
            raise HTTPException(status_code=404, detail="Credencial não encontrada")
        
        if current_user['role'] not in ['admin', 'gestao']:
            if credencial['parceiro_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Acesso negado")
        
        await db.credenciais_plataforma.delete_one({"id": cred_id})
        
        return {"success": True, "message": "Credencial removida"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao deletar credencial: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{cred_id}/testar")
async def testar_credencial(
    cred_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Testar conexão com credencial"""
    try:
        logger.info(f"🔍 Buscando credencial com ID: {cred_id}")
        
        credencial = await db.credenciais_plataforma.find_one({"id": cred_id}, {"_id": 0})
        if not credencial:
            raise HTTPException(status_code=404, detail="Credencial não encontrada")
        
        if current_user['role'] not in ['admin', 'gestao']:
            if credencial['parceiro_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Simular teste de conexão (em produção, fazer teste real)
        return {
            "success": True, 
            "message": "Conexão testada com sucesso",
            "plataforma": credencial['plataforma']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao testar credencial: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{cred_id}/sincronizar")
async def sincronizar_credencial(
    cred_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Sincronizar dados usando credencial"""
    try:
        credencial = await db.credenciais_plataforma.find_one({"id": cred_id}, {"_id": 0})
        if not credencial:
            raise HTTPException(status_code=404, detail="Credencial não encontrada")
        
        if current_user['role'] not in ['admin', 'gestao']:
            if credencial['parceiro_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Criar log de sincronização
        log = {
            'id': str(uuid.uuid4()),
            'parceiro_id': credencial['parceiro_id'],
            'plataforma': credencial['plataforma'],
            'tipo_sincronizacao': 'manual',
            'status': 'em_progresso',
            'data_inicio': datetime.now(timezone.utc).isoformat(),
            'executado_por': current_user['id']
        }
        await db.logs_sincronizacao.insert_one(log)
        
        # Atualizar última sincronização
        await db.credenciais_plataforma.update_one(
            {"id": cred_id},
            {"$set": {"ultima_sincronizacao": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Atualizar log
        await db.logs_sincronizacao.update_one(
            {'id': log['id']},
            {'$set': {
                'status': 'sucesso',
                'data_fim': datetime.now(timezone.utc).isoformat(),
                'mensagem': 'Sincronização iniciada'
            }}
        )
        
        return {
            "success": True, 
            "message": "Sincronização iniciada",
            "log_id": log['id']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao sincronizar: {e}")
        raise HTTPException(status_code=500, detail=str(e))
