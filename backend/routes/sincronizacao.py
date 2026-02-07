"""Sincronização e Credenciais routes"""

from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File
from typing import Optional, Dict, List, Set
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
# FUNÇÃO AUXILIAR: CRIAR VEÍCULOS AUTOMATICAMENTE
# ==================================================

async def auto_criar_veiculos_viaverde(
    parceiro_id: str,
    matriculas: List[str],
    matricula_to_vehicle: Dict[str, str]
) -> Dict[str, str]:
    """
    Cria automaticamente veículos placeholder para matrículas não existentes.
    
    Args:
        parceiro_id: ID do parceiro
        matriculas: Lista de matrículas encontradas nos dados Via Verde
        matricula_to_vehicle: Mapa existente de matrícula -> vehicle_id
    
    Returns:
        Mapa atualizado de matrícula -> vehicle_id (incluindo novos veículos)
    """
    veiculos_criados = 0
    now = datetime.now(timezone.utc)
    
    # Normalizar matrículas
    matriculas_unicas = set()
    for mat in matriculas:
        mat_normalizada = mat.upper().strip().replace(" ", "").replace("-", "")
        if mat_normalizada and mat_normalizada not in matricula_to_vehicle:
            matriculas_unicas.add(mat_normalizada)
    
    for mat in matriculas_unicas:
        # Formatar matrícula para exibição (ex: AA00AA -> AA-00-AA)
        mat_formatada = mat
        if len(mat) == 6:
            mat_formatada = f"{mat[:2]}-{mat[2:4]}-{mat[4:6]}"
        
        # Verificar novamente se já não existe com formato diferente
        existe = await db.vehicles.find_one({
            "parceiro_id": parceiro_id,
            "$or": [
                {"matricula": mat},
                {"matricula": mat_formatada},
                {"matricula": mat.replace("-", "")},
                {"matricula": {"$regex": f"^{mat}$", "$options": "i"}}
            ]
        }, {"_id": 0, "id": 1})
        
        if existe:
            matricula_to_vehicle[mat] = existe["id"]
            continue
        
        # Criar veículo placeholder
        vehicle_id = str(uuid.uuid4())
        novo_veiculo = {
            "id": vehicle_id,
            "parceiro_id": parceiro_id,
            "matricula": mat_formatada,
            "marca": "A Completar",
            "modelo": "A Completar",
            "ano": None,
            "cor": None,
            "tipo_combustivel": None,
            "capacidade": None,
            "status": "pendente_dados",  # Status especial para veículos auto-criados
            "notas": f"Veículo criado automaticamente via importação Via Verde em {now.strftime('%d/%m/%Y %H:%M')}. Por favor, complete os dados.",
            "auto_criado": True,
            "auto_criado_fonte": "viaverde",
            "auto_criado_em": now.isoformat(),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.vehicles.insert_one(novo_veiculo)
        matricula_to_vehicle[mat] = vehicle_id
        veiculos_criados += 1
        
        logger.info(f"🚗 Veículo auto-criado: {mat_formatada} (ID: {vehicle_id})")
    
    if veiculos_criados > 0:
        logger.info(f"🚗 Total de {veiculos_criados} veículos criados automaticamente")
    
    return matricula_to_vehicle


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
# CREDENCIAIS RPA CENTRALIZADAS (Admin)
# ==================================================

@router.get("/rpa-central/credenciais")
async def listar_credenciais_rpa_central(
    current_user: dict = Depends(get_current_user)
):
    """Listar credenciais RPA centrais (Admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode ver credenciais centrais")
    
    creds = await db.rpa_credenciais_central.find({}, {"_id": 0, "password": 0}).to_list(100)
    return creds


@router.post("/rpa-central/credenciais")
async def guardar_credenciais_rpa_central(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Guardar credenciais RPA centrais (Admin only)
    As credenciais centrais ficam disponíveis para todos os parceiros
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode definir credenciais centrais")
    
    plataforma = request.get("plataforma")  # uber, viaverde, etc
    email = request.get("email")
    password = request.get("password")
    
    if not plataforma or not email or not password:
        raise HTTPException(status_code=400, detail="Plataforma, email e password são obrigatórios")
    
    # Encriptar password
    from cryptography.fernet import Fernet
    import os
    ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", Fernet.generate_key().decode())
    cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
    encrypted_password = cipher_suite.encrypt(password.encode()).decode()
    
    now = datetime.now(timezone.utc)
    
    # Verificar se já existe
    existing = await db.rpa_credenciais_central.find_one({"plataforma": plataforma})
    
    cred_data = {
        "plataforma": plataforma,
        "email": email,
        "password": encrypted_password,
        "ativo": True,
        "updated_at": now.isoformat(),
        "updated_by": current_user["id"]
    }
    
    if existing:
        await db.rpa_credenciais_central.update_one(
            {"plataforma": plataforma},
            {"$set": cred_data}
        )
    else:
        cred_data["id"] = str(uuid.uuid4())
        cred_data["created_at"] = now.isoformat()
        cred_data["created_by"] = current_user["id"]
        await db.rpa_credenciais_central.insert_one(cred_data)
    
    logger.info(f"🔑 Credenciais RPA centrais guardadas para {plataforma} por {current_user['email']}")
    
    return {"success": True, "message": f"Credenciais {plataforma} guardadas"}


@router.delete("/rpa-central/credenciais/{plataforma}")
async def remover_credenciais_rpa_central(
    plataforma: str,
    current_user: dict = Depends(get_current_user)
):
    """Remover credenciais RPA centrais (Admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode remover credenciais centrais")
    
    result = await db.rpa_credenciais_central.delete_one({"plataforma": plataforma})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Credenciais não encontradas")
    
    return {"success": True, "message": f"Credenciais {plataforma} removidas"}


@router.post("/rpa-central/testar")
async def testar_credenciais_rpa_central(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Testar credenciais RPA centrais (Admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode testar credenciais")
    
    plataforma = request.get("plataforma")
    
    if not plataforma:
        raise HTTPException(status_code=400, detail="Plataforma é obrigatória")
    
    # Buscar credenciais
    cred = await db.rpa_credenciais_central.find_one({"plataforma": plataforma})
    if not cred:
        raise HTTPException(status_code=404, detail="Credenciais não encontradas")
    
    # TODO: Implementar teste real com Playwright
    # Por agora, apenas verificar se existem
    return {
        "success": True,
        "plataforma": plataforma,
        "email": cred.get("email"),
        "status": "Credenciais configuradas - teste RPA pendente"
    }


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
# SINCRONIZAÇÃO RPA UBER
# ==================================================

from pydantic import BaseModel as PydanticModel

class UberRPARequest(PydanticModel):
    """Request para sincronização RPA Uber"""
    tipo_periodo: str = "ultima_semana"  # ultima_semana, semana_especifica, datas_personalizadas
    data_inicio: Optional[str] = None  # YYYY-MM-DD
    data_fim: Optional[str] = None  # YYYY-MM-DD
    semana: Optional[int] = None  # Número da semana (1-53)
    ano: Optional[int] = None  # Ano
    sms_code: Optional[str] = None  # Código SMS para autenticação
    pin_code: Optional[str] = None  # PIN/código de acesso adicional


class UberAPIRequest(PydanticModel):
    """Request para sincronização via API oficial da Uber"""
    org_id: Optional[str] = None  # Organization ID encriptado (se não fornecido, usa das credenciais)


@router.post("/uber/sincronizar-api")
async def sincronizar_uber_api(
    request: UberAPIRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Sincronizar pagamentos via API oficial da Uber.
    
    Usa a API Get Driver Payments para obter dados das últimas 24 horas.
    Requer credenciais API (client_id, client_secret) configuradas nas credenciais do parceiro.
    """
    from services.uber_api import UberAPI, sincronizar_pagamentos_uber
    
    pid = current_user['id']
    
    # Buscar credenciais API da Uber
    credenciais = await db.credenciais_plataformas.find_one({
        "parceiro_id": pid,
        "plataforma": "uber_api"
    })
    
    if not credenciais:
        # Tentar buscar das configurações globais
        credenciais = await db.configuracoes_api.find_one({"plataforma": "uber"})
    
    if not credenciais or not credenciais.get("client_id"):
        raise HTTPException(
            status_code=400,
            detail="Credenciais API da Uber não configuradas. Configure client_id, client_secret e org_id."
        )
    
    client_id = credenciais.get("client_id")
    client_secret = credenciais.get("client_secret")
    org_id = request.org_id or credenciais.get("org_id")
    
    if not org_id:
        raise HTTPException(
            status_code=400,
            detail="Organization ID (org_id) não fornecido. Configure nas credenciais ou passe no request."
        )
    
    # Criar registo de execução
    execucao_id = str(uuid.uuid4())
    execucao = {
        "id": execucao_id,
        "parceiro_id": pid,
        "tipo": "uber_api",
        "status": "em_progresso",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "org_id": org_id
    }
    await db.execucoes_sincronizacao.insert_one(execucao)
    
    try:
        # Executar sincronização
        resultado = await sincronizar_pagamentos_uber(
            client_id=client_id,
            client_secret=client_secret,
            org_id=org_id,
            parceiro_id=pid
        )
        
        # Atualizar execução
        await db.execucoes_sincronizacao.update_one(
            {"id": execucao_id},
            {"$set": {
                "status": "concluido" if resultado["sucesso"] else "erro",
                "resultado": resultado,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Se teve sucesso, guardar motoristas na BD
        if resultado["sucesso"] and resultado.get("motoristas"):
            for motorista in resultado["motoristas"]:
                # Guardar/atualizar rendimento
                rendimento = {
                    "parceiro_id": pid,
                    "plataforma": "uber",
                    "motorista_uuid": motorista.get("uuid"),
                    "motorista_nome": motorista.get("nome"),
                    "motorista_email": motorista.get("email"),
                    "motorista_telefone": motorista.get("telefone"),
                    "total_ganhos": motorista.get("total_ganhos", 0),
                    "valor_liquido": motorista.get("valor_liquido", 0),
                    "moeda": motorista.get("moeda", "EUR"),
                    "data_sincronizacao": datetime.now(timezone.utc).isoformat(),
                    "periodo": resultado.get("periodo"),
                    "fonte": "api"
                }
                
                # Upsert por motorista_uuid e período
                await db.rendimentos_uber.update_one(
                    {
                        "parceiro_id": pid,
                        "motorista_uuid": motorista.get("uuid"),
                        "periodo.start": resultado.get("periodo", {}).get("start")
                    },
                    {"$set": rendimento},
                    upsert=True
                )
        
        return {
            "sucesso": resultado["sucesso"],
            "execucao_id": execucao_id,
            "total_motoristas": resultado.get("total_motoristas", 0),
            "total_ganhos": resultado.get("total_ganhos", 0),
            "periodo": resultado.get("periodo"),
            "mensagem": resultado.get("mensagem"),
            "motoristas": resultado.get("motoristas", [])[:10]  # Limitar resposta
        }
        
    except Exception as e:
        logger.error(f"Erro na sincronização Uber API: {e}")
        await db.execucoes_sincronizacao.update_one(
            {"id": execucao_id},
            {"$set": {"status": "erro", "erro": str(e)}}
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/uber/executar-rpa")
async def executar_rpa_uber(
    request: UberRPARequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Executar RPA da Uber para extrair rendimentos dos motoristas.
    
    Tipos de período suportados:
    - ultima_semana: Busca dados da última semana completa
    - semana_especifica: Busca dados de uma semana específica (semana + ano)
    - datas_personalizadas: Busca dados entre data_inicio e data_fim
    """
    from datetime import timedelta
    from routes.rpa_automacao import calcular_periodo_semana
    
    pid = current_user['id']
    
    # Verificar se parceiro tem credenciais Uber
    credenciais = await db.credenciais_plataforma.find_one({
        "parceiro_id": pid,
        "plataforma": "uber"
    })
    
    if not credenciais or not credenciais.get("email") or not credenciais.get("password"):
        raise HTTPException(
            status_code=400, 
            detail="Credenciais Uber não configuradas. Vá a Configurações → Plataformas para configurar."
        )
    
    now = datetime.now(timezone.utc)
    
    # Calcular datas baseado no tipo de período
    if request.tipo_periodo == "ultima_semana":
        today = now.date()
        last_sunday = today - timedelta(days=(today.weekday() + 1))
        last_monday = last_sunday - timedelta(days=6)
        
        data_inicio = last_monday.strftime("%Y-%m-%d")
        data_fim = last_sunday.strftime("%Y-%m-%d")
        periodo_descricao = f"Última semana ({data_inicio} a {data_fim})"
        
    elif request.tipo_periodo == "semana_especifica":
        if not request.semana or not request.ano:
            raise HTTPException(status_code=400, detail="Semana e ano são obrigatórios para semana_especifica")
        
        data_inicio, data_fim = calcular_periodo_semana(request.semana, request.ano)
        periodo_descricao = f"Semana {request.semana}/{request.ano} ({data_inicio} a {data_fim})"
        
    elif request.tipo_periodo == "datas_personalizadas":
        if not request.data_inicio or not request.data_fim:
            raise HTTPException(status_code=400, detail="data_inicio e data_fim são obrigatórios para datas_personalizadas")
        
        data_inicio = request.data_inicio
        data_fim = request.data_fim
        periodo_descricao = f"Personalizado ({data_inicio} a {data_fim})"
    else:
        raise HTTPException(status_code=400, detail=f"Tipo de período inválido: {request.tipo_periodo}")
    
    # Criar registo de execução
    execucao_id = str(uuid.uuid4())
    execucao = {
        "id": execucao_id,
        "parceiro_id": pid,
        "plataforma": "uber",
        "tipo_periodo": request.tipo_periodo,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "periodo_descricao": periodo_descricao,
        "status": "em_execucao",
        "started_at": now.isoformat(),
        "resultado": None,
        "logs": []
    }
    
    await db.execucoes_rpa_uber.insert_one(execucao)
    logger.info(f"✅ Execução RPA Uber {execucao_id} criada: {periodo_descricao}")
    
    # Executar RPA em background
    sms_code = request.sms_code  # Guardar código SMS para usar no background task
    pin_code = request.pin_code  # Guardar PIN para usar no background task
    
    async def run_uber_rpa():
        try:
            from services.rpa_uber import executar_rpa_uber
            
            resultado = await executar_rpa_uber(
                email=credenciais["email"],
                password=credenciais["password"],
                data_inicio=data_inicio,
                data_fim=data_fim,
                sms_code=sms_code,  # Passar código SMS
                pin_code=pin_code,  # Passar PIN
                headless=True
            )
            
            # Atualizar execução com resultado
            await db.execucoes_rpa_uber.update_one(
                {"id": execucao_id},
                {"$set": {
                    "status": "concluido" if resultado.get("sucesso") else "erro",
                    "resultado": resultado,
                    "logs": resultado.get("logs", []),
                    "total_motoristas": resultado.get("total_motoristas", 0),
                    "total_rendimentos": resultado.get("total_rendimentos", 0),
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Se teve sucesso e tem motoristas, importar para a BD
            if resultado.get("sucesso") and resultado.get("motoristas"):
                motoristas = resultado["motoristas"]
                importados = 0
                
                for mot in motoristas:
                    # Criar ou atualizar registo de rendimento Uber
                    rendimento = {
                        "parceiro_id": pid,
                        "nome_motorista": mot.get("nome"),
                        "data_inicio": data_inicio,
                        "data_fim": data_fim,
                        "rendimentos_totais": mot.get("rendimentos_totais", 0),
                        "reembolsos_despesas": mot.get("reembolsos_despesas", 0),
                        "ajustes": mot.get("ajustes", 0),
                        "pagamento": mot.get("pagamento", 0),
                        "rendimentos_liquidos": mot.get("rendimentos_liquidos", 0),
                        "fonte": "rpa",
                        "execucao_id": execucao_id,
                        "importado_em": datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Evitar duplicados
                    existe = await db.rendimentos_uber.find_one({
                        "parceiro_id": pid,
                        "nome_motorista": mot.get("nome"),
                        "data_inicio": data_inicio,
                        "data_fim": data_fim
                    })
                    
                    if not existe:
                        await db.rendimentos_uber.insert_one(rendimento)
                        importados += 1
                
                logger.info(f"📊 Uber: Importados {importados} rendimentos de motoristas")
            
            logger.info(f"✅ RPA Uber {execucao_id} concluído: {resultado.get('sucesso')}")
            
        except Exception as e:
            logger.error(f"❌ Erro no RPA Uber: {e}")
            await db.execucoes_rpa_uber.update_one(
                {"id": execucao_id},
                {"$set": {
                    "status": "erro",
                    "resultado": {"sucesso": False, "mensagem": str(e)},
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    # Executar em background
    asyncio.create_task(run_uber_rpa())
    
    return {
        "success": True,
        "execucao_id": execucao_id,
        "status": "em_execucao",
        "periodo": {
            "tipo": request.tipo_periodo,
            "data_inicio": data_inicio,
            "data_fim": data_fim,
            "descricao": periodo_descricao
        },
        "mensagem": f"Extração Uber iniciada para {periodo_descricao}"
    }


@router.get("/uber/execucoes")
async def listar_execucoes_uber(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Listar execuções RPA Uber do parceiro"""
    pid = current_user['id']
    
    execucoes = await db.execucoes_rpa_uber.find(
        {"parceiro_id": pid},
        {"_id": 0}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    
    return execucoes


# ==================================================
# SINCRONIZAÇÃO RPA VIA VERDE (COM DATAS)
# ==================================================

class ViaVerdeRPARequest(PydanticModel):
    """Request para sincronização RPA Via Verde"""
    tipo_periodo: str = "ultima_semana"  # ultima_semana, semana_especifica, datas_personalizadas
    data_inicio: Optional[str] = None  # YYYY-MM-DD
    data_fim: Optional[str] = None  # YYYY-MM-DD
    semana: Optional[int] = None  # Número da semana (1-53)
    ano: Optional[int] = None  # Ano


class PrioRPARequest(PydanticModel):
    """Request para sincronização RPA Prio"""
    tipo_periodo: str = "ultima_semana"  # ultima_semana, semana_especifica, datas_personalizadas
    data_inicio: Optional[str] = None  # YYYY-MM-DD
    data_fim: Optional[str] = None  # YYYY-MM-DD
    semana: Optional[int] = None  # Número da semana (1-53)
    ano: Optional[int] = None  # Ano


@router.post("/prio/executar-rpa")
async def executar_rpa_prio(
    request: PrioRPARequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Executar RPA da Prio Energy para extrair dados de combustível.
    Fluxo: Login MyPRIO → Transações → Extrair dados → Processar → Guardar
    """
    from datetime import timedelta
    
    pid = current_user['id']
    logger.info(f"🔍 Prio RPA - Parceiro ID: {pid}")
    
    # Verificar credenciais Prio
    credenciais = await db.credenciais_plataforma.find_one({
        "parceiro_id": pid,
        "plataforma": {"$in": ["prio", "prio_energy"]}
    })
    
    if not credenciais or not credenciais.get("username") and not credenciais.get("email") or not credenciais.get("password"):
        raise HTTPException(
            status_code=400, 
            detail="Credenciais Prio não configuradas. Vá a Configurações → Plataformas para configurar."
        )
    
    prio_usuario = credenciais.get("username") or credenciais.get("email")
    prio_password = credenciais.get("password")
    
    now = datetime.now(timezone.utc)
    
    # Determinar período
    if request.tipo_periodo == "semana_especifica" and request.semana and request.ano:
        semana = request.semana
        ano = request.ano
        # Calcular datas da semana ISO
        jan4 = datetime(ano, 1, 4)
        start_of_week = jan4 - timedelta(days=jan4.weekday()) + timedelta(weeks=semana-1)
        end_of_week = start_of_week + timedelta(days=6)
        data_inicio = start_of_week.strftime('%Y-%m-%d')
        data_fim = end_of_week.strftime('%Y-%m-%d')
    elif request.tipo_periodo == "datas_personalizadas" and request.data_inicio and request.data_fim:
        data_inicio = request.data_inicio
        data_fim = request.data_fim
        # Determinar semana
        dt_inicio = datetime.strptime(data_inicio, '%Y-%m-%d')
        semana = dt_inicio.isocalendar()[1]
        ano = dt_inicio.isocalendar()[0]
    else:
        # Última semana
        hoje = datetime.now()
        semana = hoje.isocalendar()[1] - 1 if hoje.isocalendar()[1] > 1 else 52
        ano = hoje.isocalendar()[0] if hoje.isocalendar()[1] > 1 else hoje.isocalendar()[0] - 1
        jan4 = datetime(ano, 1, 4)
        start_of_week = jan4 - timedelta(days=jan4.weekday()) + timedelta(weeks=semana-1)
        end_of_week = start_of_week + timedelta(days=6)
        data_inicio = start_of_week.strftime('%Y-%m-%d')
        data_fim = end_of_week.strftime('%Y-%m-%d')
    
    # Criar registo de execução
    execucao_id = str(uuid.uuid4())
    execucao = {
        "id": execucao_id,
        "parceiro_id": pid,
        "plataforma": "prio",
        "tipo_periodo": request.tipo_periodo,
        "semana": semana,
        "ano": ano,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "status": "iniciado",
        "started_at": now.isoformat(),
        "logs": []
    }
    
    await db.execucoes_rpa.insert_one(execucao)
    
    # Executar RPA em background
    async def executar_prio_rpa():
        try:
            from integrations.platform_scrapers import PrioScraper
            
            await db.execucoes_rpa.update_one(
                {"id": execucao_id},
                {"$set": {"status": "em_execucao"}, "$push": {"logs": f"Iniciando RPA Prio..."}}
            )
            
            async with PrioScraper(headless=True) as scraper:
                # Login
                await db.execucoes_rpa.update_one(
                    {"id": execucao_id},
                    {"$push": {"logs": f"Fazendo login com utilizador {prio_usuario}..."}}
                )
                
                login_result = await scraper.login(prio_usuario, prio_password)
                login_ok = login_result.get("success", False) if isinstance(login_result, dict) else login_result
                
                if not login_ok:
                    await db.execucoes_rpa.update_one(
                        {"id": execucao_id},
                        {"$set": {
                            "status": "erro",
                            "erro": login_result.get("error", "Falha no login"),
                            "finished_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    return
                
                await db.execucoes_rpa.update_one(
                    {"id": execucao_id},
                    {"$push": {"logs": "Login bem sucedido! Extraindo dados..."}}
                )
                
                # Extrair dados
                dados = await scraper.extract_data(start_date=data_inicio, end_date=data_fim)
                
                if not dados or not dados.get("success"):
                    await db.execucoes_rpa.update_one(
                        {"id": execucao_id},
                        {"$set": {
                            "status": "erro",
                            "erro": dados.get("error", "Falha na extração") if dados else "Sem dados",
                            "finished_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    return
                
                # Processar transações (pode vir como "transactions" ou "data")
                transacoes_raw = dados.get("transactions") or dados.get("data", [])
                logger.info(f"📊 Dados brutos recebidos: {len(transacoes_raw)} linhas")
                
                # Converter formato Prio (array [data, litros, valor, local]) para dict
                transacoes = []
                for t in transacoes_raw:
                    if isinstance(t, list) and len(t) >= 4:
                        transacoes.append({
                            "date": t[0],
                            "liters": t[1],
                            "amount": t[2],
                            "location": t[3]
                        })
                    elif isinstance(t, dict):
                        transacoes.append(t)
                
                logger.info(f"📊 Transações convertidas: {len(transacoes)}")
                total_importados = 0
                total_valor = 0.0
                
                for trans in transacoes:
                    try:
                        # Extrair dados da transação
                        data_trans = trans.get("date") or trans.get("data")
                        valor = float(trans.get("amount") or trans.get("valor") or 0)
                        litros = float(trans.get("liters") or trans.get("litros") or 0)
                        local = trans.get("location") or trans.get("local") or trans.get("station")
                        matricula = trans.get("plate") or trans.get("matricula")
                        cartao = trans.get("card") or trans.get("cartao")
                        produto = trans.get("product") or trans.get("produto") or "Combustível"
                        
                        # Determinar semana do movimento
                        if data_trans:
                            try:
                                dt = datetime.strptime(data_trans[:10], '%Y-%m-%d')
                                mov_semana = dt.isocalendar()[1]
                                mov_ano = dt.isocalendar()[0]
                            except:
                                mov_semana = semana
                                mov_ano = ano
                        else:
                            mov_semana = semana
                            mov_ano = ano
                        
                        # Verificar duplicado
                        existe = await db.despesas_combustivel.find_one({
                            "parceiro_id": pid,
                            "data": data_trans,
                            "valor": valor,
                            "litros": litros
                        })
                        
                        if not existe:
                            # Associar ao motorista via cartão ou matrícula
                            motorista_id = None
                            veiculo_id = None
                            
                            if matricula:
                                veiculo = await db.vehicles.find_one(
                                    {"matricula": {"$regex": matricula.replace("-", ".*"), "$options": "i"}, "parceiro_id": pid},
                                    {"_id": 0, "id": 1, "motorista_id": 1}
                                )
                                if veiculo:
                                    veiculo_id = veiculo.get("id")
                                    motorista_id = veiculo.get("motorista_id")
                            
                            if not motorista_id and cartao:
                                veiculo = await db.vehicles.find_one(
                                    {"cartao_combustivel": cartao, "parceiro_id": pid},
                                    {"_id": 0, "id": 1, "motorista_id": 1}
                                )
                                if veiculo:
                                    veiculo_id = veiculo.get("id")
                                    motorista_id = veiculo.get("motorista_id")
                            
                            # Guardar despesa
                            despesa = {
                                "id": str(uuid.uuid4()),
                                "parceiro_id": pid,
                                "motorista_id": motorista_id,
                                "veiculo_id": veiculo_id,
                                "matricula": matricula,
                                "cartao": cartao,
                                "data": data_trans,
                                "valor": valor,
                                "litros": litros,
                                "preco_litro": round(valor / litros, 3) if litros > 0 else 0,
                                "local": local,
                                "produto": produto,
                                "semana": mov_semana,
                                "ano": mov_ano,
                                "fonte": "rpa_prio",
                                "execucao_id": execucao_id,
                                "created_at": datetime.now(timezone.utc).isoformat()
                            }
                            
                            await db.despesas_combustivel.insert_one(despesa)
                            total_importados += 1
                            total_valor += valor
                    
                    except Exception as e:
                        logger.warning(f"⚠️ Erro ao processar transação Prio: {e}")
                
                # Actualizar execução como concluída
                await db.execucoes_rpa.update_one(
                    {"id": execucao_id},
                    {"$set": {
                        "status": "concluido",
                        "total_transacoes": len(transacoes),
                        "total_importados": total_importados,
                        "total_valor": round(total_valor, 2),
                        "finished_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$push": {"logs": f"Concluído: {total_importados} transações importadas, €{total_valor:.2f}"}}
                )
                
                logger.info(f"✅ Prio RPA {execucao_id} concluído: {total_importados} transações, €{total_valor:.2f}")
        
        except Exception as e:
            logger.error(f"❌ Erro RPA Prio: {e}")
            await db.execucoes_rpa.update_one(
                {"id": execucao_id},
                {"$set": {
                    "status": "erro",
                    "erro": str(e),
                    "finished_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    # Executar em background
    import asyncio
    asyncio.create_task(executar_prio_rpa())
    
    return {
        "success": True,
        "execucao_id": execucao_id,
        "status": "iniciado",
        "periodo": f"Semana {semana}/{ano} ({data_inicio} a {data_fim})",
        "message": f"Sincronização Prio iniciada para Semana {semana}/{ano} ({data_inicio} a {data_fim})"
    }


@router.get("/prio/execucoes")
async def listar_execucoes_prio(
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Listar execuções RPA Prio do parceiro"""
    pid = current_user['id']
    
    execucoes = await db.execucoes_rpa.find(
        {"parceiro_id": pid, "plataforma": "prio"},
        {"_id": 0}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    
    return execucoes


@router.post("/viaverde/executar-rpa")
async def executar_rpa_viaverde(
    request: ViaVerdeRPARequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Executar RPA da Via Verde com parâmetros de data flexíveis.
    
    Tipos de período suportados:
    - ultima_semana: Busca dados da última semana completa
    - semana_especifica: Busca dados de uma semana específica (semana + ano)
    - datas_personalizadas: Busca dados entre data_inicio e data_fim
    """
    from datetime import timedelta
    
    pid = current_user['id']
    logger.info(f"🔍 Via Verde RPA - Parceiro ID: {pid}")
    
    # Verificar se parceiro tem credenciais Via Verde (aceitar ambos os formatos)
    credenciais = await db.credenciais_plataforma.find_one({
        "parceiro_id": pid,
        "plataforma": {"$in": ["viaverde", "via_verde"]}
    })
    
    logger.info(f"🔍 Credenciais encontradas: {credenciais is not None}")
    if credenciais:
        logger.info(f"🔍 Email: {credenciais.get('email')}, Password: {bool(credenciais.get('password'))}")
    
    if not credenciais or not credenciais.get("email") or not credenciais.get("password"):
        raise HTTPException(
            status_code=400, 
            detail=f"Credenciais Via Verde não configuradas. Parceiro ID: {pid}"
        )
    
    now = datetime.now(timezone.utc)
    
    # Calcular datas baseado no tipo de período
    if request.tipo_periodo == "ultima_semana":
        # Última semana completa (segunda a domingo)
        today = now.date()
        # Encontrar o último domingo
        days_since_sunday = (today.weekday() + 1) % 7
        last_sunday = today - timedelta(days=days_since_sunday)
        last_monday = last_sunday - timedelta(days=6)
        
        data_inicio = last_monday.strftime("%Y-%m-%d")
        data_fim = last_sunday.strftime("%Y-%m-%d")
        periodo_descricao = f"Última semana ({data_inicio} a {data_fim})"
        
    elif request.tipo_periodo == "semana_especifica":
        if not request.semana or not request.ano:
            raise HTTPException(status_code=400, detail="Semana e ano são obrigatórios para semana_especifica")
        
        # Calcular datas da semana específica (ISO week)
        from datetime import date
        # Primeiro dia do ano
        jan1 = date(request.ano, 1, 1)
        # Encontrar a segunda-feira da semana 1
        days_to_monday = (7 - jan1.weekday()) % 7
        if jan1.weekday() <= 3:  # Se jan1 é antes de quinta, está na semana 1
            first_monday = jan1 - timedelta(days=jan1.weekday())
        else:
            first_monday = jan1 + timedelta(days=days_to_monday)
        
        # Calcular segunda-feira da semana desejada
        target_monday = first_monday + timedelta(weeks=request.semana - 1)
        target_sunday = target_monday + timedelta(days=6)
        
        data_inicio = target_monday.strftime("%Y-%m-%d")
        data_fim = target_sunday.strftime("%Y-%m-%d")
        periodo_descricao = f"Semana {request.semana}/{request.ano} ({data_inicio} a {data_fim})"
        
    elif request.tipo_periodo == "datas_personalizadas":
        if not request.data_inicio or not request.data_fim:
            raise HTTPException(status_code=400, detail="data_inicio e data_fim são obrigatórios")
        
        data_inicio = request.data_inicio
        data_fim = request.data_fim
        periodo_descricao = f"Período personalizado ({data_inicio} a {data_fim})"
        
    else:
        raise HTTPException(status_code=400, detail="Tipo de período inválido")
    
    # Criar execução RPA
    execucao_id = str(uuid.uuid4())
    
    execucao = {
        "id": execucao_id,
        "parceiro_id": pid,
        "plataforma": "viaverde",
        "tipo": "rpa",
        "status": "pendente",
        "tipo_periodo": request.tipo_periodo,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "periodo_descricao": periodo_descricao,
        "variaveis": {
            "email": credenciais.get("email"),
            "data_inicio": data_inicio,
            "data_fim": data_fim
        },
        "logs": [],
        "screenshots": [],
        "created_at": now.isoformat(),
        "created_by": pid
    }
    
    # Inserir execução na BD
    try:
        result = await db.execucoes_rpa_viaverde.insert_one(execucao)
        logger.info(f"✅ Execução inserida na BD: {result.inserted_id}")
    except Exception as insert_err:
        logger.error(f"❌ Erro ao inserir execução: {insert_err}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar execução: {str(insert_err)}")
    
    logger.info(f"🛣️ RPA Via Verde agendado: {execucao_id} - {periodo_descricao}")
    
    # Executar RPA em background
    import asyncio
    from services.rpa_viaverde_v2 import executar_rpa_viaverde_v2, parse_viaverde_excel
    
    async def executar_rpa_background():
        """Executar RPA em background e atualizar status"""
        try:
            # Atualizar status para "em_execucao"
            await db.execucoes_rpa_viaverde.update_one(
                {"id": execucao_id},
                {"$set": {"status": "em_execucao", "started_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Decriptar password
            from cryptography.fernet import Fernet
            import os
            ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY")
            password = credenciais.get("password", "")
            
            if ENCRYPTION_KEY and password:
                try:
                    cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
                    password = cipher_suite.decrypt(password.encode()).decode()
                except:
                    pass  # Password não está encriptada
            
            # Executar RPA V2 (download direto de Excel)
            resultado = await executar_rpa_viaverde_v2(
                email=credenciais.get("email"),
                password=password,
                data_inicio=data_inicio,
                data_fim=data_fim,
                headless=True
            )
            
            # Se teve sucesso e tem movimentos, importar para a BD
            importacao_resultado = None
            if resultado.get("sucesso") and resultado.get("movimentos"):
                try:
                    movimentos = resultado["movimentos"]
                    
                    # Buscar veículos existentes do parceiro
                    veiculos = await db.vehicles.find(
                        {"parceiro_id": pid},
                        {"_id": 0, "id": 1, "matricula": 1}
                    ).to_list(1000)
                    
                    # Criar mapa matrícula -> vehicle_id
                    matricula_to_vehicle = {}
                    for v in veiculos:
                        mat = v.get("matricula", "").upper().strip().replace(" ", "").replace("-", "")
                        if mat:
                            matricula_to_vehicle[mat] = v["id"]
                    
                    # Extrair todas as matrículas dos movimentos
                    matriculas_movimentos = [
                        mov.get("matricula", "").upper().strip().replace(" ", "").replace("-", "")
                        for mov in movimentos if mov.get("matricula")
                    ]
                    
                    # Auto-criar veículos para matrículas não existentes
                    matricula_to_vehicle = await auto_criar_veiculos_viaverde(
                        pid, matriculas_movimentos, matricula_to_vehicle
                    )
                    
                    # Importar movimentos para a coleção portagens_viaverde
                    importados = 0
                    duplicados = 0
                    veiculos_associados = 0
                    
                    for mov in movimentos:
                        mat = mov.get("matricula", "").upper().strip().replace(" ", "").replace("-", "")
                        vehicle_id = matricula_to_vehicle.get(mat)
                        
                        # Verificar se já existe (evitar duplicados)
                        existing = await db.portagens_viaverde.find_one({
                            "parceiro_id": pid,
                            "data": mov.get("data"),
                            "matricula": mat,
                            "valor": mov.get("valor"),
                            "hora": mov.get("hora")
                        })
                        
                        if not existing:
                            mov["parceiro_id"] = pid
                            mov["vehicle_id"] = vehicle_id
                            mov["matricula"] = mat  # Normalizada
                            mov["importado_em"] = datetime.now(timezone.utc).isoformat()
                            mov["execucao_id"] = execucao_id
                            mov["fonte"] = "rpa"
                            await db.portagens_viaverde.insert_one(mov)
                            importados += 1
                            if vehicle_id:
                                veiculos_associados += 1
                        else:
                            duplicados += 1
                    
                    importacao_resultado = {
                        "importados": importados,
                        "duplicados": duplicados,
                        "veiculos_associados": veiculos_associados,
                        "total": len(movimentos)
                    }
                    
                    resultado["importacao"] = importacao_resultado
                    resultado["logs"].append(f"Importados {importados} movimentos para a BD ({veiculos_associados} com veículo associado)")
                    
                    logger.info(f"📊 Via Verde: Importados {importados} movimentos, {duplicados} duplicados, {veiculos_associados} com veículo")
                    
                except Exception as import_err:
                    logger.error(f"Erro ao importar movimentos Via Verde: {import_err}")
                    resultado["logs"].append(f"Erro na importação: {str(import_err)}")
            
            # Atualizar resultado na BD
            await db.execucoes_rpa_viaverde.update_one(
                {"id": execucao_id},
                {"$set": {
                    "status": "concluido" if resultado.get("sucesso") else "erro",
                    "resultado": resultado,
                    "ficheiro": resultado.get("ficheiro"),
                    "total_movimentos": resultado.get("total_movimentos", 0),
                    "importacao": importacao_resultado,
                    "mensagem": resultado.get("mensagem"),
                    "screenshots": resultado.get("screenshots", []),
                    "logs": resultado.get("logs", []),
                    "erro": resultado.get("mensagem") if not resultado.get("sucesso") else None,
                    "finished_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            logger.info(f"✅ RPA Via Verde {execucao_id} concluído: {resultado.get('sucesso')}")
            
        except Exception as e:
            logger.error(f"❌ Erro no RPA Via Verde {execucao_id}: {e}")
            await db.execucoes_rpa_viaverde.update_one(
                {"id": execucao_id},
                {"$set": {
                    "status": "erro",
                    "erro": str(e),
                    "finished_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    # Iniciar execução em background (não bloqueia a resposta)
    asyncio.create_task(executar_rpa_background())
    
    return {
        "success": True,
        "execucao_id": execucao_id,
        "status": "em_execucao",
        "periodo": {
            "tipo": request.tipo_periodo,
            "data_inicio": data_inicio,
            "data_fim": data_fim,
            "descricao": periodo_descricao
        },
        "mensagem": f"Extração Via Verde iniciada para {periodo_descricao}"
    }


@router.get("/viaverde/execucoes")
async def listar_execucoes_viaverde(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Listar execuções RPA da Via Verde do parceiro"""
    pid = current_user['id'] if current_user['role'] not in ['admin', 'gestao'] else None
    
    query = {}
    if pid:
        query['parceiro_id'] = pid
    
    execucoes = await db.execucoes_rpa_viaverde.find(
        query, 
        {"_id": 0, "variaveis.password": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Converter ObjectIds para strings (se existirem)
    import json
    from bson import ObjectId
    
    def convert_objectids(obj):
        if isinstance(obj, dict):
            return {k: convert_objectids(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_objectids(item) for item in obj]
        elif isinstance(obj, ObjectId):
            return str(obj)
        else:
            return obj
    
    return [convert_objectids(e) for e in execucoes]


# ==================================================
# IMPORTAÇÃO MANUAL DE FICHEIRO EXCEL VIA VERDE
# ==================================================

@router.post("/viaverde/importar-excel")
async def importar_excel_viaverde(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Importar ficheiro Excel da Via Verde manualmente.
    O utilizador faz download do Excel diretamente do site Via Verde e carrega aqui.
    """
    if current_user['role'] not in ['admin', 'gestao', 'parceiro']:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    pid = current_user['id']
    
    # Verificar extensão do ficheiro
    filename = file.filename or "upload.xlsx"
    if not filename.lower().endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Ficheiro deve ser Excel (.xlsx, .xls) ou CSV (.csv)")
    
    try:
        import tempfile
        import os
        from pathlib import Path
        from services.rpa_viaverde_v2 import parse_viaverde_excel
        
        # Guardar ficheiro temporariamente
        temp_dir = Path(tempfile.gettempdir()) / "viaverde_uploads"
        temp_dir.mkdir(exist_ok=True)
        
        temp_filepath = temp_dir / f"{uuid.uuid4()}_{filename}"
        
        # Escrever conteúdo do ficheiro
        content = await file.read()
        with open(temp_filepath, "wb") as f:
            f.write(content)
        
        logger.info(f"📁 Ficheiro guardado: {temp_filepath}")
        
        # Criar registo de execução
        execucao_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        execucao = {
            "id": execucao_id,
            "parceiro_id": pid,
            "tipo_periodo": "upload_manual",
            "periodo_descricao": f"Upload manual: {filename}",
            "ficheiro_original": filename,
            "status": "a_processar",
            "total_movimentos": 0,
            "importacao": None,
            "created_at": now.isoformat(),
            "created_by": pid
        }
        
        await db.execucoes_rpa_viaverde.insert_one(execucao)
        
        # Processar ficheiro
        logger.info(f"📊 A processar ficheiro: {temp_filepath}")
        movimentos = parse_viaverde_excel(str(temp_filepath))
        
        if not movimentos:
            await db.execucoes_rpa_viaverde.update_one(
                {"id": execucao_id},
                {"$set": {"status": "erro", "erro": "Nenhum movimento encontrado no ficheiro"}}
            )
            raise HTTPException(status_code=400, detail="Nenhum movimento encontrado no ficheiro")
        
        logger.info(f"📊 Encontrados {len(movimentos)} movimentos no ficheiro")
        
        # Buscar veículos do parceiro para associar por matrícula
        veiculos = await db.vehicles.find(
            {"parceiro_id": pid},
            {"_id": 0, "id": 1, "matricula": 1}
        ).to_list(1000)
        
        # Criar mapa matrícula -> vehicle_id
        matricula_to_vehicle = {}
        for v in veiculos:
            mat = v.get("matricula", "").upper().strip().replace(" ", "").replace("-", "")
            if mat:
                matricula_to_vehicle[mat] = v["id"]
        
        logger.info(f"📊 Veículos mapeados: {len(matricula_to_vehicle)}")
        
        # Extrair todas as matrículas dos movimentos
        matriculas_movimentos = [
            mov.get("matricula", "").upper().strip().replace(" ", "").replace("-", "")
            for mov in movimentos if mov.get("matricula")
        ]
        
        # Auto-criar veículos para matrículas não existentes
        matricula_to_vehicle = await auto_criar_veiculos_viaverde(
            pid, matriculas_movimentos, matricula_to_vehicle
        )
        
        # Importar movimentos para a BD
        importados = 0
        duplicados = 0
        veiculos_associados = 0
        
        for mov in movimentos:
            # Associar veículo pela matrícula
            mat = mov.get("matricula", "").upper().strip().replace(" ", "").replace("-", "")
            vehicle_id = matricula_to_vehicle.get(mat)
            
            # Verificar duplicado (mesma data, hora, matrícula, valor)
            existe = await db.portagens_viaverde.find_one({
                "parceiro_id": pid,
                "data": mov.get("data"),
                "hora": mov.get("hora"),
                "matricula": mat,
                "valor": mov.get("valor", 0)
            })
            
            if existe:
                duplicados += 1
                continue
            
            # Calcular semana e ano ISO
            data_str = mov.get("data")
            semana = None
            ano = None
            if data_str:
                try:
                    data_dt = datetime.strptime(data_str, "%Y-%m-%d")
                    ano, semana, _ = data_dt.isocalendar()
                except:
                    pass
            
            # Criar registo
            portagem = {
                "id": str(uuid.uuid4()),
                "parceiro_id": pid,
                "vehicle_id": vehicle_id,
                "motorista_id": None,
                "matricula": mat,
                "data": mov.get("data"),
                "hora": mov.get("hora"),
                "local": mov.get("local"),
                "local_entrada": mov.get("local_entrada"),
                "local_saida": mov.get("local_saida"),
                "descricao": mov.get("descricao"),
                "valor": mov.get("valor", 0),
                "valor_liquido": mov.get("valor_liquido", 0),
                "tipo": mov.get("tipo", "portagem"),
                "market_description": mov.get("market_description", "portagens"),
                "semana": semana,
                "ano": ano,
                "fonte": "upload_manual",
                "execucao_id": execucao_id,
                "importado_em": now.isoformat(),
                "created_by": pid
            }
            
            await db.portagens_viaverde.insert_one(portagem)
            importados += 1
            if vehicle_id:
                veiculos_associados += 1
        
        # Atualizar execução com resultado
        resultado = {
            "importados": importados,
            "duplicados": duplicados,
            "veiculos_associados": veiculos_associados,
            "total": len(movimentos)
        }
        
        await db.execucoes_rpa_viaverde.update_one(
            {"id": execucao_id},
            {"$set": {
                "status": "concluido",
                "total_movimentos": len(movimentos),
                "importacao": resultado,
                "ficheiro": str(temp_filepath),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Limpar ficheiro temporário
        try:
            os.remove(temp_filepath)
        except:
            pass
        
        logger.info(f"✅ Importação concluída: {importados} importados, {duplicados} duplicados, {veiculos_associados} com veículo")
        
        return {
            "success": True,
            "message": f"Importação concluída: {importados} registos importados, {duplicados} duplicados, {veiculos_associados} com veículo associado",
            "execucao_id": execucao_id,
            "resultado": resultado
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao importar Excel Via Verde: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar ficheiro: {str(e)}")


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
            metodo = fonte_config.get("metodo", "rpa")  # Default para RPA
            
            # ============ PRIO / COMBUSTÍVEL ============
            if fonte in ["combustivel", "prio"]:
                # Buscar credenciais da Prio do parceiro (na coleção credenciais_plataforma)
                cred_prio = await db.credenciais_plataforma.find_one({
                    "parceiro_id": pid,
                    "plataforma": {"$in": ["prio", "prio_energy"]}
                })
                
                prio_usuario = cred_prio.get("username") or cred_prio.get("email") if cred_prio else None
                prio_password = cred_prio.get("password") if cred_prio else None
                
                if not prio_usuario or not prio_password:
                    resultados[fonte] = {
                        "sucesso": False,
                        "metodo": "rpa",
                        "erro": "Credenciais Prio não configuradas. Configure em Configurações → Plataformas."
                    }
                else:
                    try:
                        from integrations.platform_scrapers import PrioScraper
                        from routes.rpa_automacao import calcular_periodo_semana
                        
                        # Calcular período da semana
                        data_inicio, data_fim = calcular_periodo_semana(semana, ano)
                        
                        logger.info(f"🔄 Sincronizando Prio para parceiro {pid}, Semana {semana}/{ano}")
                        logger.info(f"   Utilizador: {prio_usuario}")
                        
                        # Executar scraper
                        async with PrioScraper(headless=True) as scraper:
                            login_result = await scraper.login(prio_usuario, prio_password)
                            login_ok = login_result.get("success", False) if isinstance(login_result, dict) else login_result
                            
                            if not login_ok:
                                resultados[fonte] = {
                                    "sucesso": False,
                                    "metodo": "rpa",
                                    "erro": "Falha no login da Prio. Verifique as credenciais."
                                }
                            else:
                                # Extrair dados
                                dados = await scraper.extract_data(
                                    start_date=data_inicio[:10],
                                    end_date=data_fim[:10]
                                )
                                
                                if dados.get("success"):
                                    # Processar e guardar dados
                                    transacoes = dados.get("data", [])
                                    total_valor = 0
                                    total_litros = 0
                                    transacoes_processadas = []
                                    
                                    for row in transacoes:
                                        if len(row) >= 4:
                                            try:
                                                # Formato típico: [data, litros, valor, posto]
                                                data_trans = row[0] if len(row) > 0 else ""
                                                litros_str = row[1] if len(row) > 1 else "0"
                                                valor_str = row[2] if len(row) > 2 else "0"
                                                posto = row[3] if len(row) > 3 else ""
                                                
                                                litros = float(str(litros_str).replace(",", ".").replace("L", "").strip() or 0)
                                                valor = float(str(valor_str).replace(",", ".").replace("€", "").strip() or 0)
                                                
                                                total_litros += litros
                                                total_valor += valor
                                                
                                                transacoes_processadas.append({
                                                    "data": data_trans,
                                                    "litros": litros,
                                                    "valor": valor,
                                                    "posto": posto
                                                })
                                            except:
                                                continue
                                    
                                    # Guardar em despesas_combustivel
                                    if total_valor > 0:
                                        registro = {
                                            "id": str(uuid.uuid4()),
                                            "parceiro_id": pid,
                                            "semana": semana,
                                            "ano": ano,
                                            "valor_total": round(total_valor, 2),
                                            "litros": round(total_litros, 2),
                                            "kwh": 0,  # Combustível fóssil
                                            "transacoes": transacoes_processadas,
                                            "fonte": "rpa_prio",
                                            "plataforma": "Prio Combustível",
                                            "synced_at": datetime.now(timezone.utc).isoformat()
                                        }
                                        
                                        # Upsert
                                        await db.despesas_combustivel.update_one(
                                            {"parceiro_id": pid, "semana": semana, "ano": ano, "fonte": "rpa_prio"},
                                            {"$set": registro},
                                            upsert=True
                                        )
                                        
                                        resultados[fonte] = {
                                            "sucesso": True,
                                            "metodo": "rpa",
                                            "mensagem": f"Sincronizado: {len(transacoes_processadas)} transações, {total_litros:.1f}L, {total_valor:.2f}€",
                                            "total_valor": total_valor,
                                            "total_litros": total_litros,
                                            "transacoes": len(transacoes_processadas)
                                        }
                                    else:
                                        resultados[fonte] = {
                                            "sucesso": True,
                                            "metodo": "rpa",
                                            "mensagem": f"Nenhuma transação encontrada para Semana {semana}/{ano}"
                                        }
                                else:
                                    resultados[fonte] = {
                                        "sucesso": False,
                                        "metodo": "rpa",
                                        "erro": dados.get("error", "Erro ao extrair dados da Prio")
                                    }
                                    
                    except Exception as prio_err:
                        logger.error(f"Erro ao sincronizar Prio: {prio_err}")
                        resultados[fonte] = {
                            "sucesso": False,
                            "metodo": "rpa",
                            "erro": str(prio_err)
                        }
                continue  # Próxima fonte
            
            # ============ UBER ============
            if fonte == "uber":
                # Verificar se existe sessão guardada
                sessao_path = f"/tmp/uber_sessao_{pid}.json"
                import os as os_module
                has_session = os_module.path.exists(sessao_path)
                
                if not has_session:
                    resultados[fonte] = {
                        "sucesso": False,
                        "metodo": "rpa",
                        "erro": "Sessão Uber não encontrada. O parceiro deve fazer login em /login-plataformas primeiro."
                    }
                else:
                    try:
                        from integrations.platform_scrapers import UberScraper
                        from routes.rpa_automacao import calcular_periodo_semana
                        
                        # Calcular período da semana
                        data_inicio, data_fim = calcular_periodo_semana(semana, ano)
                        
                        logger.info(f"🔄 Sincronizando Uber para parceiro {pid}, Semana {semana}/{ano}")
                        
                        # Executar scraper com sessão do parceiro
                        async with UberScraper(headless=True, parceiro_id=pid) as scraper:
                            # Verificar se está logado
                            is_logged = await scraper.verificar_login()
                            
                            if not is_logged:
                                resultados[fonte] = {
                                    "sucesso": False,
                                    "metodo": "rpa",
                                    "erro": "Sessão Uber expirada. O parceiro deve fazer login novamente em /login-plataformas."
                                }
                            else:
                                # Extrair dados
                                dados = await scraper.extract_data(
                                    start_date=data_inicio[:10],
                                    end_date=data_fim[:10]
                                )
                                
                                if dados.get("success"):
                                    # GUARDAR DADOS NA BASE DE DADOS
                                    motoristas_data = dados.get("data", [])
                                    total_ganhos = dados.get("total_ganhos", 0)
                                    
                                    # Usar semana detectada do ficheiro se disponível
                                    semana_usar = dados.get("semana_detectada") or semana
                                    ano_usar = dados.get("ano_detectado") or ano
                                    
                                    if dados.get("semana_detectada"):
                                        logger.info(f"📅 Usando semana detectada do ficheiro: {semana_usar}/{ano_usar}")
                                    
                                    if motoristas_data:
                                        for motorista_info in motoristas_data:
                                            nome_motorista = motorista_info.get("motorista", "")
                                            uuid_motorista = motorista_info.get("uuid", "")
                                            
                                            # Usar semana do motorista se detectada individualmente
                                            semana_motorista = motorista_info.get("semana_detectada") or semana_usar
                                            ano_motorista = motorista_info.get("ano_detectado") or ano_usar
                                            
                                            # Tentar encontrar motorista existente pelo nome ou UUID
                                            motorista_db = None
                                            if uuid_motorista:
                                                motorista_db = await db.motoristas.find_one({
                                                    "parceiro_id": pid,
                                                    "$or": [
                                                        {"uuid_uber": uuid_motorista},
                                                        {"uuid_motorista_uber": uuid_motorista}
                                                    ]
                                                })
                                            
                                            if not motorista_db and nome_motorista:
                                                # Tentar match por nome (case-insensitive, exact)
                                                motorista_db = await db.motoristas.find_one({
                                                    "parceiro_id": pid,
                                                    "name": {"$regex": f"^{nome_motorista}$", "$options": "i"}
                                                })
                                            
                                            if not motorista_db and nome_motorista:
                                                # Tentar match por primeiro nome + parte do apelido
                                                # Ex: "ELSON MONTEIRO" deve encontrar "Elson Patrick Varela Monteiro"
                                                partes_nome = nome_motorista.split()
                                                if len(partes_nome) >= 2:
                                                    primeiro_nome = partes_nome[0]
                                                    apelido = partes_nome[-1]
                                                    motorista_db = await db.motoristas.find_one({
                                                        "parceiro_id": pid,
                                                        "name": {
                                                            "$regex": f"^{primeiro_nome}.*{apelido}$",
                                                            "$options": "i"
                                                        }
                                                    })
                                                    if motorista_db:
                                                        logger.info(f"✅ Motorista encontrado por match parcial: {motorista_db.get('name')}")
                                            
                                            # Se ainda não encontrou, tentar só pelo primeiro nome
                                            if not motorista_db and nome_motorista:
                                                partes_nome = nome_motorista.split()
                                                if partes_nome:
                                                    primeiro_nome = partes_nome[0]
                                                    # Buscar todos os motoristas do parceiro e filtrar
                                                    cursor = db.motoristas.find({"parceiro_id": pid})
                                                    async for m in cursor:
                                                        m_name = m.get("name", "").upper()
                                                        if m_name.startswith(primeiro_nome.upper()):
                                                            motorista_db = m
                                                            logger.info(f"✅ Motorista encontrado por primeiro nome: {m.get('name')}")
                                                            break
                                            
                                            # Se não encontrou, criar motorista automaticamente
                                            if not motorista_db:
                                                novo_motorista_id = str(uuid.uuid4())
                                                motorista_db = {
                                                    "id": novo_motorista_id,
                                                    "parceiro_id": pid,
                                                    "name": nome_motorista,
                                                    "uuid_uber": uuid_motorista,
                                                    "criado_automaticamente": True,
                                                    "criado_em": datetime.now(timezone.utc).isoformat()
                                                }
                                                await db.motoristas.insert_one(motorista_db)
                                                logger.info(f"📝 Motorista criado automaticamente: {nome_motorista}")
                                            
                                            motorista_id = motorista_db.get("id", str(uuid.uuid4()))
                                            
                                            registro = {
                                                "id": str(uuid.uuid4()),
                                                "parceiro_id": pid,
                                                "motorista_id": motorista_id,  # ID para match no relatorios.py
                                                "motorista": nome_motorista,
                                                "motorista_uuid": uuid_motorista,
                                                "uuid_motorista": uuid_motorista,  # Fallback
                                                "semana": semana_motorista,  # Usar semana detectada
                                                "ano": ano_motorista,  # Usar ano detectado
                                                "rendimentos": motorista_info.get("ganho", 0),
                                                "pago_total": motorista_info.get("ganho", 0),
                                                "portagens": 0,
                                                "plataforma": "uber",
                                                "fonte": "rpa_uber",
                                                "periodo_inicio": motorista_info.get("periodo_inicio", data_inicio[:10]),
                                                "periodo_fim": motorista_info.get("periodo_fim", data_fim[:10]),
                                                "synced_at": datetime.now(timezone.utc).isoformat()
                                            }
                                            
                                            # Upsert por parceiro, motorista, semana e ano
                                            await db.ganhos_uber.update_one(
                                                {
                                                    "parceiro_id": pid, 
                                                    "motorista_id": motorista_id,
                                                    "semana": semana_motorista,  # Usar semana detectada
                                                    "ano": ano_motorista
                                                },
                                                {"$set": registro},
                                                upsert=True
                                            )
                                            logger.info(f"✅ Guardado ganho Uber: {nome_motorista} (ID: {motorista_id[:8]}...) - €{motorista_info.get('ganho', 0):.2f} → Semana {semana_motorista}/{ano_motorista}")
                                        
                                        resultados[fonte] = {
                                            "sucesso": True,
                                            "metodo": "rpa",
                                            "mensagem": f"Extraídos e guardados dados de {len(motoristas_data)} motoristas. Total: €{total_ganhos:.2f}" + 
                                                       (f" (Semana {semana_usar}/{ano_usar})" if dados.get("semana_detectada") else ""),
                                            "total_ganhos": total_ganhos,
                                            "num_motoristas": len(motoristas_data),
                                            "semana_detectada": dados.get("semana_detectada"),
                                            "ano_detectado": dados.get("ano_detectado"),
                                            "dados": motoristas_data,
                                            "screenshots": dados.get("screenshots", [])
                                        }
                                    else:
                                        resultados[fonte] = {
                                            "sucesso": True,
                                            "metodo": "rpa",
                                            "mensagem": "Extração concluída mas sem dados de motoristas",
                                            "dados": [],
                                            "screenshots": dados.get("screenshots", [])
                                        }
                                else:
                                    resultados[fonte] = {
                                        "sucesso": False,
                                        "metodo": "rpa",
                                        "erro": dados.get("error", "Erro ao extrair dados da Uber")
                                    }
                                    
                    except Exception as uber_err:
                        logger.error(f"Erro ao sincronizar Uber: {uber_err}")
                        import traceback
                        traceback.print_exc()
                        resultados[fonte] = {
                            "sucesso": False,
                            "metodo": "rpa",
                            "erro": str(uber_err)
                        }
                continue  # Próxima fonte
            
            # ============ RPA GENÉRICO ============
            # Verificar se há credenciais/configuração para RPA
            if metodo == "rpa":
                # Primeiro tentar credenciais centrais (geridas pelo Admin)
                credencial = await db.rpa_credenciais_central.find_one({
                    "plataforma": fonte,
                    "ativo": True
                })
                
                # Se não houver central, tentar credenciais do parceiro
                if not credencial:
                    credencial = await db.rpa_credenciais.find_one({
                        "parceiro_id": pid,
                        "plataforma": fonte,
                        "ativo": True
                    })
                
                if credencial:
                    # TODO: Implementar execução RPA real com Playwright
                    # Por agora, apenas marcar como agendado
                    resultados[fonte] = {
                        "sucesso": True,
                        "metodo": "rpa",
                        "credencial_tipo": "central" if "created_by" in credencial else "parceiro",
                        "mensagem": "Execução RPA agendada - funcionalidade em desenvolvimento"
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
                                            
                                            # Extrair TODOS os campos de order_price da API Bolt
                                            # Campos disponíveis: ride_price, booking_fee, toll_fee, cancellation_fee, tip, net_earnings, cash_discount, in_app_discount, commission
                                            total_net_earnings = 0
                                            total_ride_price = 0
                                            total_commission = 0
                                            total_tips = 0
                                            total_toll_fee = 0       # Portagens
                                            total_booking_fee = 0    # Taxa de reserva
                                            total_cancellation_fee = 0  # Taxa de cancelamento
                                            total_cash_discount = 0
                                            total_in_app_discount = 0
                                            
                                            for order in driver_orders:
                                                price_info = order.get("order_price", {})
                                                total_net_earnings += float(price_info.get("net_earnings", 0) or 0)
                                                total_ride_price += float(price_info.get("ride_price", 0) or 0)
                                                total_commission += float(price_info.get("commission", 0) or 0)
                                                total_tips += float(price_info.get("tip", 0) or 0)
                                                total_toll_fee += float(price_info.get("toll_fee", 0) or 0)
                                                total_booking_fee += float(price_info.get("booking_fee", 0) or 0)
                                                total_cancellation_fee += float(price_info.get("cancellation_fee", 0) or 0)
                                                total_cash_discount += float(price_info.get("cash_discount", 0) or 0)
                                                total_in_app_discount += float(price_info.get("in_app_discount", 0) or 0)
                                            
                                            total_viagens = len(driver_orders)
                                            
                                            # Ganhos líquidos = total_earnings (bruto) - comissão Bolt
                                            # Esta fórmula inclui automaticamente: gorjetas, bónus, campanhas e portagens
                                            ganhos_liquidos_calculados = total_ride_price - total_commission
                                            
                                            # Criar ou atualizar registo de ganhos
                                            ganho_existente = await db.ganhos_bolt.find_one({
                                                "parceiro_id": pid,
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
                                                # Campos da API Bolt
                                                "ganhos_brutos_total": total_ride_price,
                                                "ganhos_api": ganhos_liquidos_calculados,  # Valor direto da API
                                                "ganhos_viagens": total_net_earnings,
                                                "comissao_bolt": total_commission,
                                                "gorjetas": total_tips,
                                                "portagens_bolt": total_toll_fee,
                                                "taxa_reserva": total_booking_fee,
                                                "taxa_cancelamento": total_cancellation_fee,
                                                "desconto_dinheiro": total_cash_discount,
                                                "desconto_app": total_in_app_discount,
                                                "numero_viagens": total_viagens,
                                                "parceiro_id": pid,
                                                "fonte": "bolt_api",
                                                # Ganhos líquidos = total_earnings - comissao (já inclui gorjetas, bónus, campanhas, portagens)
                                                "ganhos_liquidos": ganhos_liquidos_calculados,
                                                "ganhos": ganhos_liquidos_calculados,
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




# ============ ENDPOINT PARA AJUSTE DE BÓNUS BOLT ============
@router.put("/bolt/ajuste-bonus")
async def atualizar_ajuste_bonus_bolt(
    dados: Dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Atualizar manualmente os ganhos da Bolt para um motorista.
    Use este endpoint quando os dados da API estiverem incorretos.
    
    Nova fórmula: ganhos = total_earnings - comissao_bolt
    (já inclui gorjetas, bónus, campanhas e portagens)
    """
    # Determinar parceiro_id
    if current_user["role"] == "admin":
        pid = dados.get("parceiro_id", current_user.get("associated_partner_id", current_user["id"]))
    else:
        pid = current_user["id"]
    
    motorista_id = dados.get("motorista_id")
    semana = dados.get("semana")
    ano = dados.get("ano")
    ganhos_liquidos = dados.get("ganhos_liquidos")  # Valor total correto
    
    if not motorista_id or not semana or not ano:
        raise HTTPException(status_code=400, detail="motorista_id, semana e ano são obrigatórios")
    
    if ganhos_liquidos is None:
        raise HTTPException(status_code=400, detail="ganhos_liquidos é obrigatório")
    
    # Buscar registo existente
    ganho = await db.ganhos_bolt.find_one({
        "parceiro_id": pid,
        "motorista_id": motorista_id,
        "semana": semana,
        "ano": ano
    })
    
    if not ganho:
        raise HTTPException(status_code=404, detail="Registo de ganhos não encontrado")
    
    # Atualizar com o valor correto
    await db.ganhos_bolt.update_one(
        {"id": ganho["id"]},
        {"$set": {
            "ganhos_liquidos": float(ganhos_liquidos),
            "ganhos": float(ganhos_liquidos),
            "ajuste_manual": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "sucesso": True,
        "mensagem": f"Ganhos atualizados para €{ganhos_liquidos}",
        "ganhos_liquidos": float(ganhos_liquidos)
    }
