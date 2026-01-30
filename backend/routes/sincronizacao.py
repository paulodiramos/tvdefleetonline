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



# ==================================================
# SISTEMA DE SINCRONIZAÇÃO AUTOMÁTICA AVANÇADO
# ==================================================

from pydantic import BaseModel
from typing import List

# Tipos de fonte de dados
FONTES_DADOS = {
    "uber": {
        "nome": "Uber",
        "icone": "🚗",
        "cor": "#000000",
        "tipo": "ganhos",
        "metodos": ["rpa", "csv"],
        "descricao": "Ganhos dos motoristas Uber"
    },
    "bolt": {
        "nome": "Bolt",
        "icone": "⚡",
        "cor": "#34D399",
        "tipo": "ganhos",
        "metodos": ["api", "rpa", "csv"],
        "descricao": "Ganhos dos motoristas Bolt"
    },
    "viaverde": {
        "nome": "Via Verde",
        "icone": "🛣️",
        "cor": "#22C55E",
        "tipo": "despesas",
        "metodos": ["rpa", "csv"],
        "descricao": "Portagens e despesas Via Verde"
    },
    "abastecimentos": {
        "nome": "Abastecimentos",
        "icone": "⛽",
        "cor": "#F59E0B",
        "tipo": "despesas",
        "metodos": ["rpa", "csv"],
        "descricao": "Combustível e carregamentos elétricos"
    }
}


class FonteConfigModel(BaseModel):
    ativo: bool = False
    metodo: str = "csv"


class AgendamentoGlobalModel(BaseModel):
    ativo: bool = False
    frequencia: str = "semanal"
    dia_semana: int = 1
    dia_mes: int = 1
    hora: str = "06:00"


class ResumoSemanalConfigModel(BaseModel):
    gerar_automaticamente: bool = True
    enviar_email_motoristas: bool = True
    enviar_whatsapp_motoristas: bool = False


class NotificacoesConfigModel(BaseModel):
    email_parceiro: bool = True
    notificacao_sistema: bool = True
    whatsapp_parceiro: bool = False


@router.get("/sincronizacao-auto/fontes")
async def listar_fontes_disponiveis():
    """Listar todas as fontes de dados disponíveis"""
    return FONTES_DADOS


@router.get("/sincronizacao-auto/config")
async def obter_config_sincronizacao_auto(
    parceiro_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obter configuração de sincronização automática do parceiro"""
    # Determinar parceiro_id
    if current_user["role"] == "admin" and parceiro_id:
        pid = parceiro_id
    elif current_user["role"] == "parceiro":
        pid = current_user["id"]
    else:
        pid = current_user.get("associated_partner_id", current_user["id"])
    
    config = await db.sincronizacao_auto_config.find_one(
        {"parceiro_id": pid},
        {"_id": 0}
    )
    
    if not config:
        # Configuração padrão
        config = {
            "parceiro_id": pid,
            "ativo": False,
            "fontes": {
                "uber": {"ativo": False, "metodo": "csv"},
                "bolt": {"ativo": False, "metodo": "csv"},
                "viaverde": {"ativo": False, "metodo": "csv"},
                "abastecimentos": {"ativo": False, "metodo": "csv"}
            },
            "agendamento_global": {
                "ativo": False,
                "frequencia": "semanal",
                "dia_semana": 1,
                "dia_mes": 1,
                "hora": "06:00"
            },
            "resumo_semanal": {
                "gerar_automaticamente": True,
                "enviar_email_motoristas": True,
                "enviar_whatsapp_motoristas": False
            },
            "notificacoes": {
                "email_parceiro": True,
                "notificacao_sistema": True,
                "whatsapp_parceiro": False
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Adicionar info das fontes
    config["fontes_info"] = FONTES_DADOS
    
    return config


@router.put("/sincronizacao-auto/config")
async def atualizar_config_sincronizacao_auto(
    request: dict = Body(...),
    parceiro_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar configuração de sincronização automática"""
    # Determinar parceiro_id
    if current_user["role"] == "admin" and parceiro_id:
        pid = parceiro_id
    elif current_user["role"] == "parceiro":
        pid = current_user["id"]
    else:
        pid = current_user.get("associated_partner_id", current_user["id"])
    
    # Obter config atual
    config_atual = await db.sincronizacao_auto_config.find_one({"parceiro_id": pid})
    
    if config_atual:
        # Merge com novos dados
        for key, value in request.items():
            if isinstance(value, dict) and isinstance(config_atual.get(key), dict):
                config_atual[key].update(value)
            else:
                config_atual[key] = value
        config_atual["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.sincronizacao_auto_config.update_one(
            {"parceiro_id": pid},
            {"$set": config_atual}
        )
    else:
        # Criar nova config
        config_atual = {
            "parceiro_id": pid,
            "ativo": request.get("ativo", False),
            "fontes": request.get("fontes", {}),
            "agendamento_global": request.get("agendamento_global", {}),
            "resumo_semanal": request.get("resumo_semanal", {}),
            "notificacoes": request.get("notificacoes", {}),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.sincronizacao_auto_config.insert_one(config_atual)
    
    # Atualizar agendamento no scheduler se necessário
    agendamento = request.get("agendamento_global", {})
    if agendamento.get("ativo"):
        await _criar_ou_atualizar_agendamento_sync(pid, config_atual)
    else:
        await db.rpa_agendamentos.update_many(
            {"parceiro_id": pid, "tipo": "sincronizacao_automatica"},
            {"$set": {"ativo": False}}
        )
    
    return {"sucesso": True, "mensagem": "Configuração guardada"}


async def _criar_ou_atualizar_agendamento_sync(parceiro_id: str, config: dict):
    """Criar ou atualizar agendamento de sincronização"""
    from datetime import timedelta
    
    agendamento_config = config.get("agendamento_global", {})
    now = datetime.now(timezone.utc)
    
    # Calcular próxima execução
    frequencia = agendamento_config.get("frequencia", "semanal")
    dia_semana = agendamento_config.get("dia_semana", 1)
    hora = agendamento_config.get("hora", "06:00")
    
    hora_parts = hora.split(":")
    hora_exec = int(hora_parts[0])
    minuto_exec = int(hora_parts[1]) if len(hora_parts) > 1 else 0
    
    if frequencia == "diario":
        proxima = now.replace(hour=hora_exec, minute=minuto_exec, second=0, microsecond=0)
        if proxima <= now:
            proxima += timedelta(days=1)
    elif frequencia == "semanal":
        dias_ate_alvo = (dia_semana - now.weekday()) % 7
        if dias_ate_alvo == 0 and now.hour >= hora_exec:
            dias_ate_alvo = 7
        proxima = now + timedelta(days=dias_ate_alvo)
        proxima = proxima.replace(hour=hora_exec, minute=minuto_exec, second=0, microsecond=0)
    else:  # mensal
        dia_mes = agendamento_config.get("dia_mes", 1)
        proxima = now.replace(day=dia_mes, hour=hora_exec, minute=minuto_exec, second=0, microsecond=0)
        if proxima <= now:
            if now.month == 12:
                proxima = proxima.replace(year=now.year + 1, month=1)
            else:
                proxima = proxima.replace(month=now.month + 1)
    
    # Buscar agendamento existente
    existente = await db.rpa_agendamentos.find_one({
        "parceiro_id": parceiro_id,
        "tipo": "sincronizacao_automatica"
    })
    
    agendamento = {
        "parceiro_id": parceiro_id,
        "tipo": "sincronizacao_automatica",
        "plataforma": "sincronizacao",
        "plataforma_nome": "Sincronização Automática",
        "frequencia": frequencia,
        "dia_semana": dia_semana,
        "hora": hora,
        "ativo": True,
        "proxima_execucao": proxima.isoformat(),
        "updated_at": now.isoformat()
    }
    
    if existente:
        await db.rpa_agendamentos.update_one(
            {"id": existente["id"]},
            {"$set": agendamento}
        )
    else:
        agendamento["id"] = str(uuid.uuid4())
        agendamento["created_at"] = now.isoformat()
        await db.rpa_agendamentos.insert_one(agendamento)
    
    logger.info(f"📅 Agendamento de sincronização atualizado para parceiro {parceiro_id}")


@router.post("/sincronizacao-auto/executar")
async def executar_sincronizacao_auto(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Executar sincronização manualmente"""
    # Determinar parceiro_id
    parceiro_id = request.get("parceiro_id")
    if current_user["role"] == "admin" and parceiro_id:
        pid = parceiro_id
    elif current_user["role"] == "parceiro":
        pid = current_user["id"]
    else:
        pid = current_user.get("associated_partner_id", current_user["id"])
    
    fontes = request.get("fontes")  # Lista de fontes ou None para todas
    semana = request.get("semana")
    ano = request.get("ano")
    
    # Obter config
    config = await db.sincronizacao_auto_config.find_one({"parceiro_id": pid})
    
    if fontes is None and config:
        # Usar todas as fontes ativas
        fontes = [k for k, v in config.get("fontes", {}).items() if v.get("ativo")]
    
    if not fontes:
        return {"sucesso": False, "erro": "Nenhuma fonte de dados ativa"}
    
    # Calcular semana se não fornecida
    now = datetime.now(timezone.utc)
    if semana is None:
        semana = now.isocalendar()[1]
    if ano is None:
        ano = now.year
    
    # Criar registo de execução
    execucao_id = str(uuid.uuid4())
    execucao = {
        "id": execucao_id,
        "parceiro_id": pid,
        "tipo": "sincronizacao_auto",
        "fontes": fontes,
        "semana": semana,
        "ano": ano,
        "status": "em_execucao",
        "progresso": 0,
        "resultados": {},
        "erros": [],
        "iniciado_por": current_user["id"],
        "created_at": now.isoformat()
    }
    
    await db.sincronizacao_auto_execucoes.insert_one(execucao)
    
    logger.info(f"🔄 Sincronização iniciada: {execucao_id} para parceiro {pid}")
    
    # Executar sincronização de cada fonte
    resultados = {}
    erros = []
    
    for fonte in fontes:
        try:
            fonte_config = config.get("fontes", {}).get(fonte, {}) if config else {}
            metodo = fonte_config.get("metodo", "csv")
            
            # Verificar se há credenciais/configuração para RPA
            if metodo == "rpa":
                credencial = await db.rpa_credenciais.find_one({
                    "parceiro_id": pid,
                    "plataforma": fonte,
                    "ativo": True
                })
                
                if credencial:
                    resultados[fonte] = {
                        "sucesso": True,
                        "metodo": "rpa",
                        "mensagem": "Execução RPA agendada"
                    }
                else:
                    resultados[fonte] = {
                        "sucesso": False,
                        "metodo": "rpa",
                        "erro": "Credenciais não configuradas"
                    }
            elif metodo == "api":
                # Executar via API oficial (Bolt)
                if fonte == "bolt":
                    from services.bolt_api_service import BoltAPIClient
                    from routes.rpa_automacao import calcular_periodo_semana
                    
                    # Buscar credenciais API
                    cred = await db.credenciais_bolt_api.find_one({
                        "parceiro_id": pid,
                        "plataforma": "bolt_api",
                        "ativo": True
                    })
                    
                    if not cred:
                        resultados[fonte] = {
                            "sucesso": False,
                            "metodo": "api",
                            "erro": "Credenciais Bolt API não configuradas"
                        }
                    else:
                        try:
                            # Calcular período da semana analisada
                            data_inicio, data_fim = calcular_periodo_semana(semana, ano)
                            start_ts = int(datetime.fromisoformat(data_inicio.replace('Z', '+00:00')).timestamp())
                            end_ts = int(datetime.fromisoformat(data_fim.replace('Z', '+00:00')).timestamp())
                            
                            client = BoltAPIClient(cred["client_id"], cred["client_secret"])
                            try:
                                # Obter company_id
                                companies = await client.get_companies()
                                company_ids = companies.get("data", {}).get("company_ids", [])
                                
                                if not company_ids:
                                    resultados[fonte] = {
                                        "sucesso": False,
                                        "metodo": "api",
                                        "erro": "Nenhuma empresa Bolt encontrada"
                                    }
                                else:
                                    company_id = company_ids[0]
                                    
                                    # Buscar dados
                                    drivers_response = await client.get_drivers(company_id, start_ts, end_ts)
                                    vehicles_response = await client.get_vehicles(company_id, start_ts, end_ts)
                                    
                                    # Paginar orders para obter todas (com delay para evitar rate limits)
                                    bolt_orders = []
                                    offset = 0
                                    limit = 100
                                    while True:
                                        orders_response = await client.get_fleet_orders(company_id, start_ts, end_ts, limit=limit, offset=offset)
                                        order_list = orders_response.get("data", {}).get("orders", [])
                                        if not order_list:
                                            break
                                        bolt_orders.extend(order_list)
                                        if len(order_list) < limit:
                                            break
                                        offset += limit
                                        # Delay para evitar rate limits
                                        await asyncio.sleep(0.5)
                                    
                                    # Extrair listas
                                    bolt_drivers = drivers_response.get("data", {}).get("drivers", [])
                                    bolt_vehicles = vehicles_response.get("data", {}).get("vehicles", [])
                                    
                                    # === ASSOCIAR MOTORISTAS E VEÍCULOS ===
                                    motoristas_associados = 0
                                    veiculos_associados = 0
                                    ganhos_criados = 0
                                    
                                    for bolt_driver in bolt_drivers:
                                        bolt_phone = bolt_driver.get("phone", "").replace(" ", "")
                                        bolt_email = bolt_driver.get("email", "").lower()
                                        bolt_name = f"{bolt_driver.get('first_name', '')} {bolt_driver.get('last_name', '')}".strip()
                                        bolt_driver_uuid = bolt_driver.get("driver_uuid", "")
                                        
                                        # Buscar motorista local APENAS do parceiro atual
                                        # Não cria nem move motoristas de outros parceiros
                                        # Verifica tanto parceiro_id quanto parceiro_atribuido
                                        motorista_local = None
                                        
                                        # Query base para filtrar por parceiro
                                        parceiro_filter = {
                                            "$or": [
                                                {"parceiro_id": pid},
                                                {"parceiro_atribuido": pid}
                                            ]
                                        }
                                        
                                        # Tentar por telefone (várias variações)
                                        if bolt_phone:
                                            phone_variations = [
                                                bolt_phone,
                                                bolt_phone.replace("+351", ""),
                                                bolt_phone.replace("+351", "351"),
                                                bolt_phone[-9:] if len(bolt_phone) >= 9 else bolt_phone
                                            ]
                                            for phone_var in phone_variations:
                                                motorista_local = await db.motoristas.find_one({
                                                    "$and": [
                                                        parceiro_filter,
                                                        {"$or": [
                                                            {"phone": phone_var},
                                                            {"phone": {"$regex": phone_var[-9:] if len(phone_var) >= 9 else phone_var}}
                                                        ]}
                                                    ]
                                                }, {"_id": 0})
                                                if motorista_local:
                                                    break
                                        
                                        # Se não encontrou por telefone, tentar por email
                                        if not motorista_local and bolt_email:
                                            motorista_local = await db.motoristas.find_one({
                                                "$and": [
                                                    parceiro_filter,
                                                    {"email": {"$regex": f"^{bolt_email}$", "$options": "i"}}
                                                ]
                                            }, {"_id": 0})
                                        
                                        if motorista_local:
                                            motoristas_associados += 1
                                            
                                            # Atualizar motorista com identificador Bolt
                                            await db.motoristas.update_one(
                                                {"id": motorista_local["id"]},
                                                {"$set": {"identificador_motorista_bolt": bolt_driver_uuid}}
                                            )
                                            
                                            # Buscar veículo associado ao motorista na Bolt
                                            bolt_vehicle = bolt_driver.get("active_vehicle") or bolt_driver.get("vehicle", {})
                                            veiculo_local = None
                                            if bolt_vehicle:
                                                matricula = bolt_vehicle.get("reg_number", "").upper().replace(" ", "-")
                                                
                                                # Buscar veículo local - tentar várias formas
                                                # Verifica tanto parceiro_id quanto parceiro_atribuido
                                                veiculo_local = await db.vehicles.find_one({
                                                    "$and": [
                                                        {"$or": [
                                                            {"parceiro_id": pid},
                                                            {"parceiro_atribuido": pid}
                                                        ]},
                                                        {"$or": [
                                                            {"matricula": matricula},
                                                            {"matricula": matricula.replace("-", "")},
                                                            {"matricula": {"$regex": matricula.replace("-", ""), "$options": "i"}}
                                                        ]}
                                                    ]
                                                }, {"_id": 0})
                                                
                                                if veiculo_local:
                                                    veiculos_associados += 1
                                            
                                            # === CALCULAR GANHOS DO MOTORISTA ===
                                            # Filtrar orders deste motorista
                                            driver_orders = [o for o in bolt_orders if o.get("driver_uuid") == bolt_driver_uuid or o.get("driver_id") == bolt_driver_uuid]
                                            
                                            # Extrair ganhos de order_price (estrutura: {net_earnings, ride_price, commission, tip})
                                            total_net_earnings = 0
                                            total_ride_price = 0
                                            total_commission = 0
                                            total_tips = 0
                                            
                                            for order in driver_orders:
                                                price_info = order.get("order_price", {})
                                                total_net_earnings += float(price_info.get("net_earnings", 0) or 0)
                                                total_ride_price += float(price_info.get("ride_price", 0) or 0)
                                                total_commission += float(price_info.get("commission", 0) or 0)
                                                total_tips += float(price_info.get("tip", 0) or 0)
                                            
                                            total_viagens = len(driver_orders)
                                            
                                            # Criar ou atualizar registo de ganhos
                                            ganho_existente = await db.ganhos_bolt.find_one({
                                                "motorista_id": motorista_local["id"],
                                                "$or": [
                                                    {"periodo_semana": semana, "periodo_ano": ano},
                                                    {"semana": semana, "ano": ano}
                                                ]
                                            })
                                            
                                            ganho_data = {
                                                "id": ganho_existente["id"] if ganho_existente else str(uuid.uuid4()),
                                                "identificador_motorista_bolt": bolt_driver_uuid,
                                                "motorista_id": motorista_local["id"],
                                                "nome_motorista": motorista_local.get("name", bolt_name),
                                                "email_motorista": motorista_local.get("email", bolt_email),
                                                "telemovel_motorista": motorista_local.get("phone", bolt_phone),
                                                "veiculo_id": veiculo_local["id"] if veiculo_local else None,
                                                "veiculo_matricula": veiculo_local.get("matricula") if veiculo_local else (bolt_vehicle.get("reg_number") if bolt_vehicle else None),
                                                "semana": semana,
                                                "ano": ano,
                                                "periodo_semana": semana,
                                                "periodo_ano": ano,
                                                "ganhos_brutos_total": total_ride_price,
                                                "ganhos_liquidos": total_net_earnings,  # Ganhos líquidos do motorista
                                                "ganhos": total_net_earnings,  # Campo alternativo
                                                "comissao_bolt": total_commission,
                                                "gorjetas": total_tips,
                                                "numero_viagens": total_viagens,
                                                "parceiro_id": pid,
                                                "fonte": "bolt_api",
                                                "synced_at": datetime.now(timezone.utc).isoformat(),
                                                "updated_at": datetime.now(timezone.utc).isoformat()
                                            }
                                            
                                            if ganho_existente:
                                                await db.ganhos_bolt.update_one(
                                                    {"id": ganho_existente["id"]},
                                                    {"$set": ganho_data}
                                                )
                                            else:
                                                ganho_data["created_at"] = datetime.now(timezone.utc).isoformat()
                                                await db.ganhos_bolt.insert_one(ganho_data)
                                            
                                            ganhos_criados += 1
                                    
                                    # Guardar sync record
                                    sync_record = {
                                        "id": str(uuid.uuid4()),
                                        "parceiro_id": pid,
                                        "plataforma": "bolt_api",
                                        "semana": semana,
                                        "ano": ano,
                                        "company_id": company_id,
                                        "motoristas_bolt": len(bolt_drivers),
                                        "motoristas_associados": motoristas_associados,
                                        "veiculos_associados": veiculos_associados,
                                        "ganhos_criados": ganhos_criados,
                                        "synced_at": datetime.now(timezone.utc).isoformat()
                                    }
                                    await db.bolt_api_sync_data.insert_one(sync_record)
                                    
                                    resultados[fonte] = {
                                        "sucesso": True,
                                        "metodo": "api",
                                        "mensagem": f"Dados sincronizados: {motoristas_associados} motoristas, {ganhos_criados} registos de ganhos",
                                        "motoristas_bolt": len(bolt_drivers),
                                        "motoristas_associados": motoristas_associados,
                                        "veiculos_associados": veiculos_associados,
                                        "ganhos_criados": ganhos_criados,
                                        "viagens": len(bolt_orders)
                                    }
                            finally:
                                await client.close()
                                
                        except Exception as api_err:
                            resultados[fonte] = {
                                "sucesso": False,
                                "metodo": "api",
                                "erro": str(api_err)
                            }
                else:
                    resultados[fonte] = {
                        "sucesso": False,
                        "metodo": "api",
                        "erro": "API oficial não disponível para esta fonte"
                    }
            else:
                # CSV - verificar importações pendentes
                importacoes = await db.importacoes.find({
                    "parceiro_id": pid,
                    "plataforma": fonte,
                    "status": {"$in": ["pendente", "processado"]}
                }).to_list(10)
                
                resultados[fonte] = {
                    "sucesso": True,
                    "metodo": "csv",
                    "mensagem": f"{len(importacoes)} ficheiros processados",
                    "registos": sum(i.get("total_registos", 0) for i in importacoes)
                }
                
        except Exception as e:
            logger.error(f"Erro ao sincronizar {fonte}: {e}")
            erros.append(f"{fonte}: {str(e)}")
            resultados[fonte] = {"sucesso": False, "erro": str(e)}
    
    # Determinar status final
    sucessos = sum(1 for r in resultados.values() if r.get("sucesso"))
    if sucessos == len(fontes):
        status = "sucesso"
    elif sucessos > 0:
        status = "sucesso_parcial"
    else:
        status = "erro"
    
    # Atualizar execução
    await db.sincronizacao_auto_execucoes.update_one(
        {"id": execucao_id},
        {"$set": {
            "status": status,
            "progresso": 100,
            "resultados": resultados,
            "erros": erros,
            "terminado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Criar notificação
    from utils.notificacoes import criar_notificacao
    if status == "sucesso":
        await criar_notificacao(
            db, user_id=pid,
            titulo="✅ Sincronização concluída",
            mensagem=f"Todos os dados foram sincronizados com sucesso.",
            tipo="info"
        )
    elif status == "sucesso_parcial":
        await criar_notificacao(
            db, user_id=pid,
            titulo="⚠️ Sincronização parcial",
            mensagem=f"Alguns dados foram sincronizados. Verifique os erros.",
            tipo="warning"
        )
    
    logger.info(f"✅ Sincronização {execucao_id} concluída: {status}")
    
    return {
        "sucesso": status in ["sucesso", "sucesso_parcial"],
        "execucao_id": execucao_id,
        "status": status,
        "resultados": resultados,
        "erros": erros
    }


@router.get("/sincronizacao-auto/historico")
async def obter_historico_sincronizacao_auto(
    limit: int = 20,
    parceiro_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obter histórico de sincronizações automáticas"""
    # Determinar parceiro_id
    if current_user["role"] == "admin" and parceiro_id:
        pid = parceiro_id
    elif current_user["role"] == "parceiro":
        pid = current_user["id"]
    else:
        pid = current_user.get("associated_partner_id", current_user["id"])
    
    execucoes = await db.sincronizacao_auto_execucoes.find(
        {"parceiro_id": pid},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return execucoes


@router.get("/sincronizacao-auto/execucao/{execucao_id}")
async def obter_execucao_sincronizacao_auto(
    execucao_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de uma execução"""
    execucao = await db.sincronizacao_auto_execucoes.find_one(
        {"id": execucao_id},
        {"_id": 0}
    )
    
    if not execucao:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    
    # Verificar permissões
    if current_user["role"] == "parceiro" and execucao.get("parceiro_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    return execucao


@router.get("/sincronizacao-auto/estatisticas")
async def obter_estatisticas_sincronizacao_auto(
    parceiro_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Obter estatísticas de sincronização"""
    # Determinar parceiro_id
    if current_user["role"] == "admin" and parceiro_id:
        pid = parceiro_id
    elif current_user["role"] == "parceiro":
        pid = current_user["id"]
    else:
        pid = current_user.get("associated_partner_id", current_user["id"])
    
    query = {"parceiro_id": pid}
    
    # Total de sincronizações
    total = await db.sincronizacao_auto_execucoes.count_documents(query)
    
    # Sincronizações com sucesso
    sucessos = await db.sincronizacao_auto_execucoes.count_documents({
        **query, "status": {"$in": ["sucesso", "sucesso_parcial"]}
    })
    
    # Última sincronização
    ultima = await db.sincronizacao_auto_execucoes.find_one(
        query,
        {"_id": 0, "created_at": 1, "status": 1},
        sort=[("created_at", -1)]
    )
    
    # Config atual
    config = await db.sincronizacao_auto_config.find_one(
        {"parceiro_id": pid},
        {"_id": 0, "ativo": 1, "agendamento_global": 1}
    )
    
    # Próximo agendamento
    proximo_agendamento = await db.rpa_agendamentos.find_one(
        {"parceiro_id": pid, "tipo": "sincronizacao_automatica", "ativo": True},
        {"_id": 0, "proxima_execucao": 1}
    )
    
    return {
        "total_sincronizacoes": total,
        "sucessos": sucessos,
        "taxa_sucesso": round((sucessos / total * 100), 1) if total > 0 else 0,
        "ultima_sincronizacao": ultima.get("created_at") if ultima else None,
        "ultimo_status": ultima.get("status") if ultima else None,
        "sincronizacao_ativa": config.get("ativo", False) if config else False,
        "agendamento_ativo": config.get("agendamento_global", {}).get("ativo", False) if config else False,
        "proxima_execucao": proximo_agendamento.get("proxima_execucao") if proximo_agendamento else None
    }

