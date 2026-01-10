"""Sincronização e Credenciais routes"""

from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Optional, Dict
from datetime import datetime, timezone
import uuid
import logging
import asyncio

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)


# ==================================================
# CONFIGURAÇÕES DE SINCRONIZAÇÃO
# ==================================================

@router.get("/sincronizacao/configuracoes")
async def obter_configuracoes_sincronizacao(
    current_user: dict = Depends(get_current_user)
):
    """Obter configurações de sincronização de todos os parceiros"""
    try:
        if current_user["role"] not in ["admin", "gestao"]:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Buscar todas as configurações de sincronização
        configs = await db.configuracoes_sincronizacao.find({}, {"_id": 0}).to_list(1000)
        
        # Se não houver configs, criar configs vazias para cada parceiro
        if not configs or len(configs) == 0:
            parceiros = await db.parceiros.find({}, {"_id": 0, "id": 1}).to_list(1000)
            configs = []
            for parceiro in parceiros:
                config = {
                    "parceiro_id": parceiro["id"],
                    "dia_semana": 1,  # Segunda-feira por padrão
                    "hora": "00:00",
                    "ativo": True,
                    "ultima_sincronizacao": None,
                    "status": None,
                    "mensagem_erro": None,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.configuracoes_sincronizacao.insert_one(config)
                configs.append(config)
        
        return configs
        
    except Exception as e:
        logger.error(f"Erro ao obter configurações: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sincronizacao/configurar-dia")
async def configurar_dia_sincronizacao(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Configurar o dia da semana para sincronização automática"""
    try:
        if current_user["role"] not in ["admin", "gestao"]:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        parceiro_id = request.get("parceiro_id")
        dia_semana = request.get("dia_semana")
        
        if parceiro_id is None or dia_semana is None:
            raise HTTPException(status_code=400, detail="Dados inválidos")
        
        # Verificar se já existe configuração
        config_existente = await db.configuracoes_sincronizacao.find_one(
            {"parceiro_id": parceiro_id},
            {"_id": 0}
        )
        
        if config_existente:
            # Atualizar
            await db.configuracoes_sincronizacao.update_one(
                {"parceiro_id": parceiro_id},
                {"$set": {
                    "dia_semana": dia_semana,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # Criar nova
            config = {
                "parceiro_id": parceiro_id,
                "dia_semana": dia_semana,
                "hora": "00:00",
                "ativo": True,
                "ultima_sincronizacao": None,
                "status": None,
                "mensagem_erro": None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.configuracoes_sincronizacao.insert_one(config)
        
        return {"message": "Configuração atualizada com sucesso"}
        
    except Exception as e:
        logger.error(f"Erro ao configurar dia: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sincronizacao/forcar")
async def forcar_sincronizacao(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Forçar sincronização manual imediata"""
    parceiro_id = None
    try:
        if current_user["role"] not in ["admin", "gestao"]:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        parceiro_id = request.get("parceiro_id")
        
        if not parceiro_id:
            raise HTTPException(status_code=400, detail="parceiro_id é obrigatório")
        
        # Buscar parceiro
        parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
        if not parceiro:
            raise HTTPException(status_code=404, detail="Parceiro não encontrado")
        
        # Atualizar status da configuração para "em_progresso"
        await db.configuracoes_sincronizacao.update_one(
            {"parceiro_id": parceiro_id},
            {"$set": {
                "status": "em_progresso",
                "mensagem_erro": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        # Simular sincronização (em produção, aqui seria feita a integração real)
        await asyncio.sleep(1)  # Simular processamento
        
        # Atualizar status para sucesso
        await db.configuracoes_sincronizacao.update_one(
            {"parceiro_id": parceiro_id},
            {"$set": {
                "status": "sucesso",
                "ultima_sincronizacao": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Registar log
        log = {
            "id": str(uuid.uuid4()),
            "parceiro_id": parceiro_id,
            "tipo": "manual",
            "status": "sucesso",
            "data": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user["id"]
        }
        await db.logs_sincronizacao_parceiro.insert_one(log)
        
        return {
            "message": f"Sincronização concluída para {parceiro.get('nome_empresa', 'parceiro')}",
            "status": "sucesso"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao forçar sincronização: {e}")
        
        # Atualizar status para erro
        if parceiro_id:
            await db.configuracoes_sincronizacao.update_one(
                {"parceiro_id": parceiro_id},
                {"$set": {
                    "status": "erro",
                    "mensagem_erro": str(e),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
        
        raise HTTPException(status_code=500, detail=str(e))


# ==================================================
# GESTÃO DE CREDENCIAIS DE PLATAFORMAS
# ==================================================

@router.get("/credenciais-plataforma")
async def listar_credenciais(
    parceiro_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar credenciais de plataformas"""
    try:
        query = {}
        
        # Filtrar por parceiro se fornecido
        if parceiro_id:
            query['parceiro_id'] = parceiro_id
        
        # Se não for admin/gestao, mostrar apenas suas próprias credenciais
        if current_user['role'] not in ['admin', 'gestao']:
            query['parceiro_id'] = current_user['id']
        
        credenciais = await db.credenciais_plataforma.find(
            query,
            {"_id": 0, "password": 0, "password_encrypted": 0}  # Não retornar passwords
        ).to_list(1000)
        
        return credenciais
        
    except Exception as e:
        logger.error(f"Erro ao listar credenciais: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/credenciais-plataforma")
async def criar_credencial(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Criar nova credencial de plataforma"""
    try:
        if current_user['role'] not in ['admin', 'gestao', 'parceiro']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Validar dados obrigatórios
        required_fields = ['plataforma', 'email', 'password']
        for field in required_fields:
            if not request.get(field):
                raise HTTPException(status_code=400, detail=f"Campo {field} é obrigatório")
        
        # Se não for admin/gestao, usar próprio ID como parceiro
        parceiro_id = request.get('parceiro_id')
        if current_user['role'] == 'parceiro':
            parceiro_id = current_user['id']
        
        # Verificar se já existe credencial para esta plataforma/parceiro
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
            "password": request['password'],  # TODO: Encriptar em produção
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


@router.put("/credenciais-plataforma/{cred_id}")
async def atualizar_credencial(
    cred_id: str,
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Atualizar credencial existente"""
    try:
        # Buscar credencial
        credencial = await db.credenciais_plataforma.find_one({"id": cred_id}, {"_id": 0})
        if not credencial:
            raise HTTPException(status_code=404, detail="Credencial não encontrada")
        
        # Verificar permissão
        if current_user['role'] not in ['admin', 'gestao']:
            if credencial['parceiro_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Atualizar campos
        update_data = {
            "email": request.get('email', credencial['email']),
            "ativo": request.get('ativo', credencial['ativo']),
            "sincronizacao_automatica": request.get('sincronizacao_automatica', credencial.get('sincronizacao_automatica', True)),
            "frequencia_dias": request.get('frequencia_dias', credencial.get('frequencia_dias', 7)),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Atualizar password apenas se fornecida
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


@router.delete("/credenciais-plataforma/{cred_id}")
async def deletar_credencial(
    cred_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deletar credencial"""
    try:
        # Buscar credencial
        credencial = await db.credenciais_plataforma.find_one({"id": cred_id}, {"_id": 0})
        if not credencial:
            raise HTTPException(status_code=404, detail="Credencial não encontrada")
        
        # Verificar permissão
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


@router.post("/credenciais-plataforma/{cred_id}/testar")
async def testar_credencial(
    cred_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Testar conexão com credencial"""
    try:
        logger.info(f"🔍 Buscando credencial com ID: {cred_id}")
        
        # Buscar credencial
        credencial = await db.credenciais_plataforma.find_one({"id": cred_id}, {"_id": 0})
        if not credencial:
            raise HTTPException(status_code=404, detail="Credencial não encontrada")
        
        # Verificar permissão
        if current_user['role'] not in ['admin', 'gestao']:
            if credencial['parceiro_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Simular teste de conexão (em produção, aqui seria feito o teste real)
        plataforma = credencial.get('plataforma', 'unknown')
        email = credencial.get('email', 'unknown')
        
        logger.info(f"🧪 Testando conexão: {plataforma} ({email})")
        
        # Simular tempo de teste
        await asyncio.sleep(0.5)
        
        # Atualizar último teste
        await db.credenciais_plataforma.update_one(
            {"id": cred_id},
            {"$set": {
                "ultimo_teste": datetime.now(timezone.utc).isoformat(),
                "teste_status": "sucesso"
            }}
        )
        
        return {
            "success": True,
            "message": f"Conexão com {plataforma} testada com sucesso",
            "plataforma": plataforma
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao testar credencial: {e}")
        
        # Atualizar status de erro
        if cred_id:
            await db.credenciais_plataforma.update_one(
                {"id": cred_id},
                {"$set": {
                    "ultimo_teste": datetime.now(timezone.utc).isoformat(),
                    "teste_status": "erro",
                    "teste_erro": str(e)
                }}
            )
        
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/credenciais-plataforma/{cred_id}/sincronizar")
async def sincronizar_credencial(
    cred_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Sincronizar dados usando esta credencial"""
    try:
        # Buscar credencial
        credencial = await db.credenciais_plataforma.find_one({"id": cred_id}, {"_id": 0})
        if not credencial:
            raise HTTPException(status_code=404, detail="Credencial não encontrada")
        
        # Verificar permissão
        if current_user['role'] not in ['admin', 'gestao']:
            if credencial['parceiro_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Acesso negado")
        
        plataforma = credencial.get('plataforma', 'unknown')
        
        # Atualizar status para em_progresso
        await db.credenciais_plataforma.update_one(
            {"id": cred_id},
            {"$set": {
                "sync_status": "em_progresso",
                "sync_iniciado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Simular sincronização (em produção, aqui seria feita a sincronização real)
        await asyncio.sleep(1)
        
        # Atualizar status para sucesso
        await db.credenciais_plataforma.update_one(
            {"id": cred_id},
            {"$set": {
                "sync_status": "sucesso",
                "ultima_sincronizacao": datetime.now(timezone.utc).isoformat(),
                "sync_finalizado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Registar log
        log = {
            "id": str(uuid.uuid4()),
            "credencial_id": cred_id,
            "parceiro_id": credencial.get('parceiro_id'),
            "plataforma": plataforma,
            "tipo": "manual",
            "status": "sucesso",
            "data": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user['id']
        }
        await db.logs_sincronizacao.insert_one(log)
        
        return {
            "success": True,
            "message": f"Sincronização com {plataforma} concluída",
            "plataforma": plataforma
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao sincronizar: {e}")
        
        # Atualizar status para erro
        if cred_id:
            await db.credenciais_plataforma.update_one(
                {"id": cred_id},
                {"$set": {
                    "sync_status": "erro",
                    "sync_erro": str(e),
                    "sync_finalizado_em": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        raise HTTPException(status_code=500, detail=str(e))


# ==================================================
# CONFIGURAÇÃO DE SINCRONIZAÇÃO AUTOMÁTICA
# ==================================================

@router.get("/configuracao/sincronizacao-auto")
async def get_config_sincronizacao_auto(
    current_user: dict = Depends(get_current_user)
):
    """Obter configuração de sincronização automática"""
    try:
        if current_user['role'] not in ['admin', 'gestao']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        config = await db.configuracoes_sistema.find_one(
            {"tipo": "sincronizacao_auto"},
            {"_id": 0}
        )
        
        if not config:
            # Retornar config padrão
            config = {
                "tipo": "sincronizacao_auto",
                "ativo": False,
                "horario": "00:00",
                "dias_semana": [1],  # Segunda-feira
                "ultima_execucao": None
            }
        
        return config
        
    except Exception as e:
        logger.error(f"Erro ao obter config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/configuracao/sincronizacao-auto")
async def set_config_sincronizacao_auto(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Definir configuração de sincronização automática"""
    try:
        if current_user['role'] not in ['admin', 'gestao']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        config = {
            "tipo": "sincronizacao_auto",
            "ativo": request.get('ativo', False),
            "horario": request.get('horario', "00:00"),
            "dias_semana": request.get('dias_semana', [1]),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user['id']
        }
        
        await db.configuracoes_sistema.update_one(
            {"tipo": "sincronizacao_auto"},
            {"$set": config},
            upsert=True
        )
        
        return {"success": True, "message": "Configuração atualizada"}
        
    except Exception as e:
        logger.error(f"Erro ao definir config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================================================
# LOGS DE SINCRONIZAÇÃO
# ==================================================

@router.get("/logs-sincronizacao")
async def listar_logs_sincronizacao(
    parceiro_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Listar logs de sincronização"""
    try:
        query = {}
        
        if parceiro_id:
            query['parceiro_id'] = parceiro_id
        
        # Se não for admin/gestao, mostrar apenas seus próprios logs
        if current_user['role'] not in ['admin', 'gestao']:
            query['parceiro_id'] = current_user['id']
        
        logs = await db.logs_sincronizacao.find(
            query,
            {"_id": 0}
        ).sort("data", -1).limit(limit).to_list(limit)
        
        return logs
        
    except Exception as e:
        logger.error(f"Erro ao listar logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))
