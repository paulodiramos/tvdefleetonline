"""
API Routes para Sistema RPA Completo
Gestão de credenciais, execução de automações e agendamento
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
import uuid
import logging
import asyncio
import os
from cryptography.fernet import Fernet

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rpa-auto", tags=["rpa-automacao"])

db = get_database()

# Chave de encriptação (deve estar no .env em produção)
ENCRYPTION_KEY = os.environ.get("RPA_ENCRYPTION_KEY", Fernet.generate_key().decode())
cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)


# ==================== MODELOS ====================

class CredenciaisCreate(BaseModel):
    plataforma: str  # uber, bolt, viaverde, prio
    email: str
    password: str
    dados_extra: Optional[Dict] = None


class CredenciaisUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    dados_extra: Optional[Dict] = None


class ExecucaoCreate(BaseModel):
    plataforma: str
    tipo_extracao: str = "todos"  # ganhos, portagens, combustivel, eletrico, todos
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None


class AgendamentoCreate(BaseModel):
    plataforma: str
    tipo_extracao: str = "todos"
    frequencia: str = "semanal"  # diario, semanal, mensal
    dia_semana: Optional[int] = 1  # 0=Segunda, 6=Domingo
    hora: str = "06:00"
    ativo: bool = True


class PlataformaCreate(BaseModel):
    """Modelo para criar nova plataforma"""
    nome: str
    icone: str = "🔧"
    cor: str = "#6B7280"
    descricao: str = ""
    url_login: str = ""
    tipos_extracao: List[str] = ["todos"]
    campos_credenciais: List[str] = ["email", "password"]
    requer_2fa: bool = False
    notas: str = ""


class PlataformaUpdate(BaseModel):
    """Modelo para actualizar plataforma"""
    nome: Optional[str] = None
    icone: Optional[str] = None
    cor: Optional[str] = None
    descricao: Optional[str] = None
    url_login: Optional[str] = None
    tipos_extracao: Optional[List[str]] = None
    campos_credenciais: Optional[List[str]] = None
    requer_2fa: Optional[bool] = None
    notas: Optional[str] = None
    ativo: Optional[bool] = None


# ==================== PLATAFORMAS PRÉ-DEFINIDAS ====================

PLATAFORMAS_PREDEFINIDAS = [
    {
        "id": "uber",
        "nome": "Uber Driver",
        "icone": "🚗",
        "cor": "#000000",
        "descricao": "Extrair ganhos semanais/mensais dos motoristas Uber",
        "tipos_extracao": ["ganhos"],
        "campos_credenciais": ["email", "password"],
        "requer_2fa": True,
        "url_login": "https://auth.uber.com/",
        "tipo": "predefinida"
    },
    {
        "id": "bolt",
        "nome": "Bolt Fleet",
        "icone": "⚡",
        "cor": "#34D399",
        "descricao": "Extrair ganhos semanais/mensais da frota Bolt",
        "tipos_extracao": ["ganhos"],
        "campos_credenciais": ["email", "password"],
        "requer_2fa": False,
        "url_login": "https://fleets.bolt.eu/login",
        "tipo": "predefinida"
    },
    {
        "id": "viaverde",
        "nome": "Via Verde Empresas",
        "icone": "🛣️",
        "cor": "#22C55E",
        "descricao": "Extrair portagens com data/hora, local e matrícula",
        "tipos_extracao": ["portagens", "consumos_matricula"],
        "campos_credenciais": ["email", "password"],
        "requer_2fa": False,
        "url_login": "https://www.viaverde.pt/empresas",
        "nota": "Login via popup - inserir email e password da conta Via Verde",
        "tipo": "predefinida"
    },
    {
        "id": "prio",
        "nome": "Prio Energy",
        "icone": "⛽",
        "cor": "#F59E0B",
        "descricao": "Extrair abastecimentos de combustível e carregamentos elétricos",
        "tipos_extracao": ["combustivel", "eletrico", "todos"],
        "campos_credenciais": ["email", "password"],
        "requer_2fa": False,
        "url_login": "https://areaprivada.prio.pt/login",
        "tipo": "predefinida"
    }
]


async def get_todas_plataformas():
    """Obter todas as plataformas (pré-definidas + personalizadas)"""
    # Buscar plataformas personalizadas da base de dados
    plataformas_custom = await db.rpa_plataformas.find(
        {"ativo": {"$ne": False}},
        {"_id": 0}
    ).to_list(100)
    
    # Combinar pré-definidas com personalizadas
    todas = list(PLATAFORMAS_PREDEFINIDAS) + plataformas_custom
    return todas


async def get_plataforma_by_id(plataforma_id: str):
    """Obter uma plataforma específica por ID"""
    # Primeiro verificar nas pré-definidas
    for p in PLATAFORMAS_PREDEFINIDAS:
        if p["id"] == plataforma_id:
            return p
    
    # Se não encontrou, buscar nas personalizadas
    plataforma = await db.rpa_plataformas.find_one(
        {"id": plataforma_id},
        {"_id": 0}
    )
    return plataforma


def encrypt_value(value: str) -> str:
    """Encriptar valor sensível"""
    return cipher.encrypt(value.encode()).decode()


def decrypt_value(encrypted: str) -> str:
    """Desencriptar valor"""
    return cipher.decrypt(encrypted.encode()).decode()


# ==================== ENDPOINTS PLATAFORMAS ====================

@router.get("/plataformas")
async def listar_plataformas():
    """Listar todas as plataformas disponíveis para automação"""
    return await get_todas_plataformas()


@router.get("/plataformas/{plataforma_id}")
async def get_plataforma_endpoint(plataforma_id: str):
    """Obter detalhes de uma plataforma"""
    plataforma = await get_plataforma_by_id(plataforma_id)
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    return plataforma


@router.post("/plataformas")
async def criar_plataforma(
    dados: PlataformaCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Criar nova plataforma personalizada (apenas admin)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem criar plataformas")
    
    # Gerar ID único baseado no nome
    plataforma_id = dados.nome.lower().replace(" ", "_").replace("-", "_")
    
    # Verificar se já existe
    existente = await get_plataforma_by_id(plataforma_id)
    if existente:
        raise HTTPException(status_code=400, detail="Já existe uma plataforma com este nome")
    
    nova_plataforma = {
        "id": plataforma_id,
        "nome": dados.nome,
        "icone": dados.icone,
        "cor": dados.cor,
        "descricao": dados.descricao,
        "url_login": dados.url_login,
        "tipos_extracao": dados.tipos_extracao,
        "campos_credenciais": dados.campos_credenciais,
        "requer_2fa": dados.requer_2fa,
        "notas": dados.notas,
        "tipo": "personalizada",
        "ativo": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.rpa_plataformas.insert_one(nova_plataforma)
    
    return {"success": True, "plataforma": nova_plataforma}


@router.put("/plataformas/{plataforma_id}")
async def actualizar_plataforma(
    plataforma_id: str,
    dados: PlataformaUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Actualizar plataforma personalizada (apenas admin)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar plataformas")
    
    # Verificar se é uma plataforma personalizada
    plataforma = await db.rpa_plataformas.find_one({"id": plataforma_id})
    if not plataforma:
        # Verificar se é pré-definida
        predefinida = next((p for p in PLATAFORMAS_PREDEFINIDAS if p["id"] == plataforma_id), None)
        if predefinida:
            raise HTTPException(status_code=400, detail="Plataformas pré-definidas não podem ser editadas")
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    # Actualizar campos fornecidos
    update_data = {k: v for k, v in dados.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.rpa_plataformas.update_one(
        {"id": plataforma_id},
        {"$set": update_data}
    )
    
    plataforma_actualizada = await db.rpa_plataformas.find_one({"id": plataforma_id}, {"_id": 0})
    return {"success": True, "plataforma": plataforma_actualizada}


@router.delete("/plataformas/{plataforma_id}")
async def eliminar_plataforma(
    plataforma_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar plataforma personalizada (apenas admin)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem eliminar plataformas")
    
    # Verificar se é uma plataforma personalizada
    plataforma = await db.rpa_plataformas.find_one({"id": plataforma_id})
    if not plataforma:
        # Verificar se é pré-definida
        predefinida = next((p for p in PLATAFORMAS_PREDEFINIDAS if p["id"] == plataforma_id), None)
        if predefinida:
            raise HTTPException(status_code=400, detail="Plataformas pré-definidas não podem ser eliminadas")
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    # Verificar se há credenciais associadas
    credenciais_count = await db.rpa_credenciais.count_documents({"plataforma": plataforma_id})
    if credenciais_count > 0:
        # Desactivar em vez de eliminar
        await db.rpa_plataformas.update_one(
            {"id": plataforma_id},
            {"$set": {"ativo": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "message": f"Plataforma desactivada (tinha {credenciais_count} credenciais associadas)"}
    
    await db.rpa_plataformas.delete_one({"id": plataforma_id})
    return {"success": True, "message": "Plataforma eliminada com sucesso"}


# ==================== ENDPOINTS CREDENCIAIS ====================

@router.post("/credenciais")
async def guardar_credenciais(
    dados: CredenciaisCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Guardar credenciais de acesso a uma plataforma (encriptadas)"""
    
    # Verificar plataforma válida
    plataforma = await get_plataforma_by_id(dados.plataforma)
    if not plataforma:
        raise HTTPException(status_code=400, detail="Plataforma inválida")
    
    # Determinar parceiro_id
    parceiro_id = current_user["id"] if current_user["role"] == "parceiro" else current_user.get("associated_partner_id", current_user["id"])
    
    # Verificar se já existem credenciais
    existente = await db.rpa_credenciais.find_one({
        "parceiro_id": parceiro_id,
        "plataforma": dados.plataforma
    })
    
    now = datetime.now(timezone.utc)
    
    credenciais = {
        "parceiro_id": parceiro_id,
        "plataforma": dados.plataforma,
        "email_encrypted": encrypt_value(dados.email),
        "password_encrypted": encrypt_value(dados.password),
        "dados_extra": dados.dados_extra or {},
        "ativo": True,
        "updated_at": now.isoformat(),
        "updated_by": current_user["id"]
    }
    
    if existente:
        await db.rpa_credenciais.update_one(
            {"id": existente["id"]},
            {"$set": credenciais}
        )
        logger.info(f"✅ Credenciais {dados.plataforma} atualizadas para parceiro {parceiro_id}")
        return {"message": "Credenciais atualizadas com sucesso", "id": existente["id"]}
    else:
        credenciais["id"] = str(uuid.uuid4())
        credenciais["created_at"] = now.isoformat()
        credenciais["created_by"] = current_user["id"]
        await db.rpa_credenciais.insert_one(credenciais)
        logger.info(f"✅ Credenciais {dados.plataforma} criadas para parceiro {parceiro_id}")
        return {"message": "Credenciais guardadas com sucesso", "id": credenciais["id"]}


@router.get("/credenciais")
async def listar_credenciais(
    parceiro_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Listar credenciais configuradas (sem mostrar passwords)"""
    
    query = {"ativo": True}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    credenciais = await db.rpa_credenciais.find(
        query,
        {"_id": 0, "password_encrypted": 0}  # Nunca retornar password
    ).to_list(100)
    
    # Desencriptar email para mostrar
    for cred in credenciais:
        try:
            cred["email"] = decrypt_value(cred.get("email_encrypted", ""))
        except:
            cred["email"] = "***"
        del cred["email_encrypted"]
        
        # Adicionar info da plataforma
        plataforma = await get_plataforma_by_id(cred["plataforma"])
        if plataforma:
            cred["plataforma_nome"] = plataforma["nome"]
            cred["plataforma_icone"] = plataforma["icone"]
    
    return credenciais


@router.get("/credenciais/{plataforma}")
async def get_credenciais_plataforma(
    plataforma: str,
    current_user: Dict = Depends(get_current_user)
):
    """Verificar se existem credenciais para uma plataforma"""
    
    parceiro_id = current_user["id"] if current_user["role"] == "parceiro" else current_user.get("associated_partner_id", current_user["id"])
    
    credencial = await db.rpa_credenciais.find_one({
        "parceiro_id": parceiro_id,
        "plataforma": plataforma,
        "ativo": True
    })
    
    if not credencial:
        return {"configurado": False}
    
    return {
        "configurado": True,
        "email": decrypt_value(credencial.get("email_encrypted", ""))[:3] + "***",
        "updated_at": credencial.get("updated_at")
    }


@router.delete("/credenciais/{plataforma}")
async def eliminar_credenciais(
    plataforma: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar credenciais de uma plataforma"""
    
    parceiro_id = current_user["id"] if current_user["role"] == "parceiro" else current_user.get("associated_partner_id", current_user["id"])
    
    result = await db.rpa_credenciais.update_one(
        {"parceiro_id": parceiro_id, "plataforma": plataforma},
        {"$set": {"ativo": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Credenciais não encontradas")
    
    return {"message": "Credenciais eliminadas"}


# ==================== ENDPOINTS EXECUÇÃO ====================

@router.post("/executar")
async def executar_automacao(
    dados: ExecucaoCreate,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
):
    """Iniciar execução de automação RPA"""
    
    # Verificar plataforma válida
    plataforma = await get_plataforma_by_id(dados.plataforma)
    if not plataforma:
        raise HTTPException(status_code=400, detail="Plataforma inválida")
    
    # Determinar parceiro_id
    parceiro_id = current_user["id"] if current_user["role"] == "parceiro" else current_user.get("associated_partner_id", current_user["id"])
    
    # Verificar se existem credenciais
    credencial = await db.rpa_credenciais.find_one({
        "parceiro_id": parceiro_id,
        "plataforma": dados.plataforma,
        "ativo": True
    })
    
    if not credencial:
        raise HTTPException(
            status_code=400, 
            detail=f"Credenciais não configuradas para {plataforma['nome']}. Configure primeiro em Configurações."
        )
    
    # Criar registo de execução
    execucao_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    execucao = {
        "id": execucao_id,
        "parceiro_id": parceiro_id,
        "plataforma": dados.plataforma,
        "plataforma_nome": plataforma["nome"],
        "tipo_extracao": dados.tipo_extracao,
        "data_inicio": dados.data_inicio,
        "data_fim": dados.data_fim,
        "status": "pendente",
        "progresso": 0,
        "logs": [],
        "screenshots": [],
        "dados_extraidos": [],
        "erros": [],
        "iniciado_por": current_user["id"],
        "created_at": now.isoformat()
    }
    
    await db.rpa_execucoes.insert_one(execucao)
    
    # Agendar execução em background
    background_tasks.add_task(
        _executar_em_background,
        execucao_id,
        dados.plataforma,
        parceiro_id,
        credencial,
        dados.tipo_extracao,
        dados.data_inicio,
        dados.data_fim
    )
    
    logger.info(f"🤖 Execução RPA agendada: {execucao_id} ({dados.plataforma})")
    
    return {
        "message": "Execução iniciada",
        "execucao_id": execucao_id,
        "status": "pendente"
    }


async def _executar_em_background(
    execucao_id: str,
    plataforma: str,
    parceiro_id: str,
    credencial: Dict,
    tipo_extracao: str,
    data_inicio: str,
    data_fim: str
):
    """Executar automação em background"""
    try:
        # Importar executor
        from services.rpa_executor import executar_automacao
        
        # Atualizar status para "em execução"
        await db.rpa_execucoes.update_one(
            {"id": execucao_id},
            {"$set": {
                "status": "em_execucao",
                "iniciado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Desencriptar credenciais
        credenciais = {
            "email": decrypt_value(credencial.get("email_encrypted", "")),
            "password": decrypt_value(credencial.get("password_encrypted", ""))
        }
        
        # Executar automação
        resultado = await executar_automacao(
            plataforma=plataforma,
            parceiro_id=parceiro_id,
            execucao_id=execucao_id,
            credenciais=credenciais,
            tipo_extracao=tipo_extracao,
            data_inicio=data_inicio,
            data_fim=data_fim
        )
        
        # Guardar dados extraídos na collection apropriada
        dados_extraidos = resultado.get("dados_extraidos", [])
        if dados_extraidos:
            for dado in dados_extraidos:
                dado["parceiro_id"] = parceiro_id
                dado["execucao_id"] = execucao_id
                dado["created_at"] = datetime.now(timezone.utc).isoformat()
            
            collection_name = f"rpa_dados_{plataforma}"
            await db[collection_name].insert_many(dados_extraidos)
        
        # Determinar status final
        erros = resultado.get("erros", [])
        status = "sucesso" if not erros else ("sucesso_parcial" if dados_extraidos else "erro")
        
        # Atualizar execução com resultado
        await db.rpa_execucoes.update_one(
            {"id": execucao_id},
            {"$set": {
                "status": status,
                "logs": resultado.get("logs", []),
                "screenshots": resultado.get("screenshots", []),
                "dados_extraidos": dados_extraidos,
                "erros": erros,
                "total_registos": len(dados_extraidos),
                "terminado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"✅ Execução {execucao_id} concluída: {status} ({len(dados_extraidos)} registos)")
        
    except Exception as e:
        logger.error(f"❌ Erro na execução {execucao_id}: {e}")
        await db.rpa_execucoes.update_one(
            {"id": execucao_id},
            {"$set": {
                "status": "erro",
                "erros": [str(e)],
                "terminado_em": datetime.now(timezone.utc).isoformat()
            }}
        )


@router.get("/execucoes")
async def listar_execucoes(
    parceiro_id: Optional[str] = None,
    plataforma: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    """Listar histórico de execuções"""
    
    query = {}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    if plataforma:
        query["plataforma"] = plataforma
    
    if status:
        query["status"] = status
    
    execucoes = await db.rpa_execucoes.find(
        query,
        {"_id": 0, "logs": 0}  # Excluir logs detalhados na listagem
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return execucoes


@router.get("/execucoes/{execucao_id}")
async def get_execucao(
    execucao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter detalhes de uma execução"""
    
    execucao = await db.rpa_execucoes.find_one({"id": execucao_id}, {"_id": 0})
    
    if not execucao:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    
    # Verificar permissões
    if current_user["role"] == "parceiro" and execucao["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    return execucao


@router.post("/execucoes/{execucao_id}/cancelar")
async def cancelar_execucao(
    execucao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Cancelar execução em curso"""
    
    execucao = await db.rpa_execucoes.find_one({"id": execucao_id})
    
    if not execucao:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    
    if execucao["status"] not in ["pendente", "em_execucao"]:
        raise HTTPException(status_code=400, detail="Esta execução não pode ser cancelada")
    
    await db.rpa_execucoes.update_one(
        {"id": execucao_id},
        {"$set": {
            "status": "cancelado",
            "terminado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Execução cancelada"}


# ==================== ENDPOINTS AGENDAMENTO ====================

@router.post("/agendamentos")
async def criar_agendamento(
    dados: AgendamentoCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Criar agendamento de execução automática"""
    
    # Verificar plataforma válida
    plataforma = next((p for p in PLATAFORMAS if p["id"] == dados.plataforma), None)
    if not plataforma:
        raise HTTPException(status_code=400, detail="Plataforma inválida")
    
    parceiro_id = current_user["id"] if current_user["role"] == "parceiro" else current_user.get("associated_partner_id", current_user["id"])
    
    # Verificar se já existe agendamento para esta plataforma
    existente = await db.rpa_agendamentos.find_one({
        "parceiro_id": parceiro_id,
        "plataforma": dados.plataforma,
        "ativo": True
    })
    
    if existente:
        raise HTTPException(status_code=400, detail="Já existe um agendamento para esta plataforma")
    
    agendamento_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    agendamento = {
        "id": agendamento_id,
        "parceiro_id": parceiro_id,
        "plataforma": dados.plataforma,
        "plataforma_nome": plataforma["nome"],
        "tipo_extracao": dados.tipo_extracao,
        "frequencia": dados.frequencia,
        "dia_semana": dados.dia_semana,
        "hora": dados.hora,
        "ativo": dados.ativo,
        "ultima_execucao": None,
        "proxima_execucao": _calcular_proxima_execucao(dados.frequencia, dados.dia_semana, dados.hora),
        "created_at": now.isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.rpa_agendamentos.insert_one(agendamento)
    
    logger.info(f"📅 Agendamento criado: {agendamento_id} ({dados.plataforma} - {dados.frequencia})")
    
    return {"message": "Agendamento criado", "id": agendamento_id}


def _calcular_proxima_execucao(frequencia: str, dia_semana: int, hora: str) -> str:
    """Calcular próxima data de execução"""
    now = datetime.now(timezone.utc)
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
        proxima = now.replace(day=1, hour=hora_exec, minute=minuto_exec, second=0, microsecond=0)
        if proxima <= now:
            if now.month == 12:
                proxima = proxima.replace(year=now.year + 1, month=1)
            else:
                proxima = proxima.replace(month=now.month + 1)
    
    return proxima.isoformat()


@router.get("/agendamentos")
async def listar_agendamentos(
    parceiro_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Listar agendamentos configurados"""
    
    query = {"ativo": True}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    agendamentos = await db.rpa_agendamentos.find(query, {"_id": 0}).to_list(100)
    
    return agendamentos


@router.put("/agendamentos/{agendamento_id}")
async def atualizar_agendamento(
    agendamento_id: str,
    dados: AgendamentoCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar agendamento"""
    
    agendamento = await db.rpa_agendamentos.find_one({"id": agendamento_id})
    
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    updates = {
        "tipo_extracao": dados.tipo_extracao,
        "frequencia": dados.frequencia,
        "dia_semana": dados.dia_semana,
        "hora": dados.hora,
        "ativo": dados.ativo,
        "proxima_execucao": _calcular_proxima_execucao(dados.frequencia, dados.dia_semana, dados.hora),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.rpa_agendamentos.update_one({"id": agendamento_id}, {"$set": updates})
    
    return {"message": "Agendamento atualizado"}


@router.delete("/agendamentos/{agendamento_id}")
async def eliminar_agendamento(
    agendamento_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar agendamento"""
    
    result = await db.rpa_agendamentos.update_one(
        {"id": agendamento_id},
        {"$set": {"ativo": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    return {"message": "Agendamento eliminado"}


# ==================== ENDPOINTS DADOS EXTRAÍDOS ====================

@router.get("/dados/{plataforma}")
async def get_dados_extraidos(
    plataforma: str,
    parceiro_id: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    limit: int = 100,
    current_user: Dict = Depends(get_current_user)
):
    """Obter dados extraídos de uma plataforma"""
    
    query = {}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    if data_inicio:
        query["created_at"] = {"$gte": data_inicio}
    if data_fim:
        if "created_at" in query:
            query["created_at"]["$lte"] = data_fim
        else:
            query["created_at"] = {"$lte": data_fim}
    
    collection_name = f"rpa_dados_{plataforma}"
    
    dados = await db[collection_name].find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return dados


# ==================== ESTATÍSTICAS ====================

@router.get("/estatisticas")
async def get_estatisticas(
    parceiro_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Obter estatísticas do sistema RPA"""
    
    query = {}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    # Contar execuções
    total_execucoes = await db.rpa_execucoes.count_documents(query)
    
    query_sucesso = {**query, "status": {"$in": ["sucesso", "sucesso_parcial"]}}
    execucoes_sucesso = await db.rpa_execucoes.count_documents(query_sucesso)
    
    query_erro = {**query, "status": "erro"}
    execucoes_erro = await db.rpa_execucoes.count_documents(query_erro)
    
    # Credenciais configuradas
    cred_query = {"ativo": True}
    if current_user["role"] == "parceiro":
        cred_query["parceiro_id"] = current_user["id"]
    credenciais_config = await db.rpa_credenciais.count_documents(cred_query)
    
    # Agendamentos ativos
    agend_query = {"ativo": True}
    if current_user["role"] == "parceiro":
        agend_query["parceiro_id"] = current_user["id"]
    agendamentos_ativos = await db.rpa_agendamentos.count_documents(agend_query)
    
    # Últimas execuções
    ultimas = await db.rpa_execucoes.find(
        query,
        {"_id": 0, "logs": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Estatísticas por plataforma
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$plataforma",
            "total": {"$sum": 1},
            "sucesso": {"$sum": {"$cond": [{"$in": ["$status", ["sucesso", "sucesso_parcial"]]}, 1, 0]}},
            "registos": {"$sum": "$total_registos"}
        }}
    ]
    por_plataforma = await db.rpa_execucoes.aggregate(pipeline).to_list(10)
    
    return {
        "total_execucoes": total_execucoes,
        "execucoes_sucesso": execucoes_sucesso,
        "execucoes_erro": execucoes_erro,
        "taxa_sucesso": (execucoes_sucesso / total_execucoes * 100) if total_execucoes > 0 else 0,
        "credenciais_configuradas": credenciais_config,
        "agendamentos_ativos": agendamentos_ativos,
        "ultimas_execucoes": ultimas,
        "por_plataforma": por_plataforma
    }
