"""
RPA Automation Routes for FleeTrack
- Fornecedores management
- Automation scripts management
- Credentials management (encrypted)
- Execution management
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
import logging
import base64
import asyncio
from cryptography.fernet import Fernet
import os

from utils.database import get_database
from utils.auth import get_current_user
from models.automacao import (
    TipoFornecedor, TipoAcao,
    Fornecedor, FornecedorCreate,
    Automacao, AutomacaoCreate, PassoAutomacao,
    CredenciaisParceiro, CredenciaisParceiroCreate,
    ExecucaoAutomacao,
    DEFAULT_UBER_AUTOMATION, DEFAULT_BOLT_AUTOMATION, DEFAULT_VIAVERDE_AUTOMATION
)
from services.automacao_executor import run_automation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/automacao", tags=["automacao"])

db = get_database()

# Encryption key (should be in .env in production)
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", Fernet.generate_key().decode())
cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"


def encrypt_password(password: str) -> str:
    """Encrypt a password"""
    return cipher_suite.encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    """Decrypt a password"""
    return cipher_suite.decrypt(encrypted.encode()).decode()


# ==================== FORNECEDORES ====================

@router.get("/fornecedores/tipos")
async def get_tipos_fornecedor():
    """Get available provider types"""
    return [
        {"id": "uber", "nome": "Uber", "icone": "🚗", "cor": "#000000"},
        {"id": "bolt", "nome": "Bolt", "icone": "⚡", "cor": "#34D399"},
        {"id": "via_verde", "nome": "Via Verde", "icone": "🛣️", "cor": "#22C55E"},
        {"id": "gps", "nome": "GPS/Rastreamento", "icone": "📍", "cor": "#3B82F6"},
        {"id": "combustivel", "nome": "Combustível", "icone": "⛽", "cor": "#F59E0B"},
        {"id": "carregamento_eletrico", "nome": "Carregamento Elétrico", "icone": "🔌", "cor": "#8B5CF6"},
    ]


@router.post("/fornecedores")
async def criar_fornecedor(
    fornecedor_data: FornecedorCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new provider (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create providers")
    
    fornecedor_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    fornecedor = {
        "id": fornecedor_id,
        **fornecedor_data.model_dump(),
        "ativo": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.fornecedores.insert_one(fornecedor)
    
    logger.info(f"✅ Fornecedor criado: {fornecedor_data.nome} ({fornecedor_data.tipo})")
    
    return {"message": "Fornecedor criado com sucesso", "fornecedor_id": fornecedor_id}


@router.get("/fornecedores")
async def listar_fornecedores(
    tipo: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List all providers"""
    query = {"ativo": True}
    if tipo:
        query["tipo"] = tipo
    
    fornecedores = await db.fornecedores.find(query, {"_id": 0}).to_list(100)
    return fornecedores


@router.get("/fornecedores/{fornecedor_id}")
async def get_fornecedor(fornecedor_id: str, current_user: Dict = Depends(get_current_user)):
    """Get provider details"""
    fornecedor = await db.fornecedores.find_one({"id": fornecedor_id}, {"_id": 0})
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    return fornecedor


@router.put("/fornecedores/{fornecedor_id}")
async def atualizar_fornecedor(
    fornecedor_id: str,
    updates: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update provider (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update providers")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.fornecedores.update_one({"id": fornecedor_id}, {"$set": updates})
    
    return {"message": "Fornecedor atualizado com sucesso"}


@router.delete("/fornecedores/{fornecedor_id}")
async def eliminar_fornecedor(fornecedor_id: str, current_user: Dict = Depends(get_current_user)):
    """Delete provider (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete providers")
    
    # Soft delete
    await db.fornecedores.update_one(
        {"id": fornecedor_id},
        {"$set": {"ativo": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Fornecedor eliminado com sucesso"}


# ==================== FORNECEDORES PADRÃO ====================

@router.post("/fornecedores/inicializar-padrao")
async def inicializar_fornecedores_padrao(current_user: Dict = Depends(get_current_user)):
    """Initialize default providers (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can initialize providers")
    
    now = datetime.now(timezone.utc)
    
    default_fornecedores = [
        {
            "id": str(uuid.uuid4()),
            "nome": "Uber",
            "tipo": "uber",
            "url_login": "https://auth.uber.com/login/",
            "url_base": "https://drivers.uber.com",
            "descricao": "Plataforma Uber Driver",
            "campo_email_seletor": "#email",
            "campo_password_seletor": "#password",
            "botao_login_seletor": "#next-button",
            "requer_2fa": True,
            "tipo_2fa": "sms",
            "ativo": True,
            "created_at": now.isoformat(),
            "created_by": current_user["id"]
        },
        {
            "id": str(uuid.uuid4()),
            "nome": "Bolt",
            "tipo": "bolt",
            "url_login": "https://fleets.bolt.eu/login",
            "url_base": "https://fleets.bolt.eu",
            "descricao": "Plataforma Bolt Fleet",
            "campo_email_seletor": "input[name='email']",
            "campo_password_seletor": "input[name='password']",
            "botao_login_seletor": "button[type='submit']",
            "requer_2fa": False,
            "ativo": True,
            "created_at": now.isoformat(),
            "created_by": current_user["id"]
        },
        {
            "id": str(uuid.uuid4()),
            "nome": "Via Verde Empresas",
            "tipo": "via_verde",
            "url_login": "https://www.viaverde.pt/empresas/login",
            "url_base": "https://www.viaverde.pt/empresas",
            "descricao": "Portal Via Verde Empresas",
            "campo_email_seletor": "#username",
            "campo_password_seletor": "#password",
            "botao_login_seletor": "#kc-login",
            "requer_2fa": False,
            "ativo": True,
            "created_at": now.isoformat(),
            "created_by": current_user["id"]
        }
    ]
    
    # Insert only if not exists
    for fornecedor in default_fornecedores:
        existing = await db.fornecedores.find_one({"tipo": fornecedor["tipo"], "nome": fornecedor["nome"]})
        if not existing:
            await db.fornecedores.insert_one(fornecedor)
    
    return {"message": "Fornecedores padrão inicializados", "total": len(default_fornecedores)}


# ==================== AUTOMAÇÕES ====================

@router.post("/scripts")
async def criar_automacao(
    automacao_data: AutomacaoCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create automation script (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create automations")
    
    automacao_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    automacao = {
        "id": automacao_id,
        **automacao_data.model_dump(),
        "versao": "1.0",
        "ativo": True,
        "testada": False,
        "taxa_sucesso": 0.0,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.automacoes.insert_one(automacao)
    
    # Link to fornecedor
    await db.fornecedores.update_one(
        {"id": automacao_data.fornecedor_id},
        {"$set": {"automacao_id": automacao_id}}
    )
    
    logger.info(f"✅ Automação criada: {automacao_data.nome}")
    
    return {"message": "Automação criada com sucesso", "automacao_id": automacao_id}


@router.get("/scripts")
async def listar_automacoes(
    fornecedor_id: Optional[str] = None,
    tipo: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List all automation scripts"""
    query = {"ativo": True}
    if fornecedor_id:
        query["fornecedor_id"] = fornecedor_id
    if tipo:
        query["tipo_fornecedor"] = tipo
    
    automacoes = await db.automacoes.find(query, {"_id": 0}).to_list(100)
    return automacoes


@router.get("/scripts/{automacao_id}")
async def get_automacao(automacao_id: str, current_user: Dict = Depends(get_current_user)):
    """Get automation script details"""
    automacao = await db.automacoes.find_one({"id": automacao_id}, {"_id": 0})
    if not automacao:
        raise HTTPException(status_code=404, detail="Automação não encontrada")
    return automacao


@router.put("/scripts/{automacao_id}")
async def atualizar_automacao(
    automacao_id: str,
    updates: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update automation script (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update automations")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Increment version if passos changed
    if "passos" in updates:
        automacao = await db.automacoes.find_one({"id": automacao_id}, {"_id": 0})
        if automacao:
            current_version = automacao.get("versao", "1.0")
            major, minor = current_version.split(".")
            updates["versao"] = f"{major}.{int(minor) + 1}"
    
    await db.automacoes.update_one({"id": automacao_id}, {"$set": updates})
    
    return {"message": "Automação atualizada com sucesso"}


@router.post("/scripts/{automacao_id}/adicionar-passo")
async def adicionar_passo(
    automacao_id: str,
    passo: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Add step to automation (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can modify automations")
    
    automacao = await db.automacoes.find_one({"id": automacao_id}, {"_id": 0})
    if not automacao:
        raise HTTPException(status_code=404, detail="Automação não encontrada")
    
    passos = automacao.get("passos", [])
    passo["id"] = str(uuid.uuid4())
    passo["ordem"] = len(passos) + 1
    passos.append(passo)
    
    await db.automacoes.update_one(
        {"id": automacao_id},
        {"$set": {"passos": passos, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Passo adicionado", "passo_id": passo["id"]}


@router.delete("/scripts/{automacao_id}/passos/{passo_id}")
async def remover_passo(
    automacao_id: str,
    passo_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remove step from automation (Admin only)"""
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can modify automations")
    
    await db.automacoes.update_one(
        {"id": automacao_id},
        {
            "$pull": {"passos": {"id": passo_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Passo removido"}


@router.get("/scripts/tipos-acao")
async def get_tipos_acao():
    """Get available action types for automation steps"""
    return [
        {"id": "navegar", "nome": "Navegar para URL", "icone": "🌐", "requer_valor": True},
        {"id": "clicar", "nome": "Clicar em Elemento", "icone": "👆", "requer_seletor": True},
        {"id": "preencher", "nome": "Preencher Campo", "icone": "✏️", "requer_seletor": True, "requer_valor": True},
        {"id": "selecionar", "nome": "Selecionar Opção", "icone": "📋", "requer_seletor": True, "requer_valor": True},
        {"id": "esperar", "nome": "Esperar", "icone": "⏱️", "requer_seletor": False},
        {"id": "download", "nome": "Fazer Download", "icone": "⬇️", "requer_seletor": False},
        {"id": "screenshot", "nome": "Tirar Screenshot", "icone": "📸", "requer_seletor": False},
        {"id": "extrair_texto", "nome": "Extrair Texto", "icone": "📝", "requer_seletor": True},
        {"id": "extrair_tabela", "nome": "Extrair Tabela", "icone": "📊", "requer_seletor": True},
        {"id": "codigo_2fa", "nome": "Inserir Código 2FA", "icone": "🔐", "requer_seletor": True},
    ]


# ==================== CREDENCIAIS DO PARCEIRO ====================

@router.post("/credenciais")
async def guardar_credenciais(
    credenciais_data: CredenciaisParceiroCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Save partner credentials (encrypted)"""
    # Parceiro só pode guardar as suas próprias credenciais
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != credenciais_data.parceiro_id:
        raise HTTPException(status_code=403, detail="Can only save your own credentials")
    
    # Check if credentials already exist
    existing = await db.credenciais_parceiro.find_one({
        "parceiro_id": credenciais_data.parceiro_id,
        "fornecedor_id": credenciais_data.fornecedor_id
    })
    
    credenciais_id = existing["id"] if existing else str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Encrypt password
    password_encrypted = encrypt_password(credenciais_data.password)
    
    credenciais = {
        "id": credenciais_id,
        "parceiro_id": credenciais_data.parceiro_id,
        "fornecedor_id": credenciais_data.fornecedor_id,
        "email": credenciais_data.email,
        "password_encrypted": password_encrypted,
        "codigo_2fa_secret": credenciais_data.codigo_2fa_secret,
        "dados_extra": credenciais_data.dados_extra,
        "ativo": True,
        "updated_at": now.isoformat()
    }
    
    if existing:
        await db.credenciais_parceiro.update_one(
            {"id": credenciais_id},
            {"$set": credenciais}
        )
        return {"message": "Credenciais atualizadas com sucesso", "credenciais_id": credenciais_id}
    else:
        credenciais["created_at"] = now.isoformat()
        await db.credenciais_parceiro.insert_one(credenciais)
        return {"message": "Credenciais guardadas com sucesso", "credenciais_id": credenciais_id}


@router.get("/credenciais")
async def listar_credenciais(
    parceiro_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List credentials (without passwords)"""
    query = {"ativo": True}
    
    # Parceiro só vê as suas próprias credenciais
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    credenciais = await db.credenciais_parceiro.find(
        query,
        {"_id": 0, "password_encrypted": 0, "codigo_2fa_secret": 0}
    ).to_list(100)
    
    # Add fornecedor info
    for cred in credenciais:
        fornecedor = await db.fornecedores.find_one({"id": cred["fornecedor_id"]}, {"_id": 0, "nome": 1, "tipo": 1})
        cred["fornecedor_nome"] = fornecedor.get("nome") if fornecedor else "N/A"
        cred["fornecedor_tipo"] = fornecedor.get("tipo") if fornecedor else "N/A"
    
    return credenciais


@router.get("/credenciais/{parceiro_id}/{fornecedor_id}")
async def get_credenciais(
    parceiro_id: str,
    fornecedor_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get credentials (Admin/Gestao can see all, Parceiro only their own)"""
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    credenciais = await db.credenciais_parceiro.find_one(
        {"parceiro_id": parceiro_id, "fornecedor_id": fornecedor_id},
        {"_id": 0}
    )
    
    if not credenciais:
        raise HTTPException(status_code=404, detail="Credenciais não encontradas")
    
    # Remove sensitive data for non-admin
    if current_user["role"] != UserRole.ADMIN:
        credenciais.pop("password_encrypted", None)
        credenciais.pop("codigo_2fa_secret", None)
    
    return credenciais


@router.delete("/credenciais/{credenciais_id}")
async def eliminar_credenciais(
    credenciais_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete credentials"""
    credenciais = await db.credenciais_parceiro.find_one({"id": credenciais_id}, {"_id": 0})
    if not credenciais:
        raise HTTPException(status_code=404, detail="Credenciais não encontradas")
    
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != credenciais["parceiro_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.credenciais_parceiro.delete_one({"id": credenciais_id})
    
    return {"message": "Credenciais eliminadas com sucesso"}


# ==================== EXECUÇÃO DE AUTOMAÇÃO ====================

@router.post("/executar")
async def executar_automacao(
    data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
):
    """Start automation execution"""
    automacao_id = data.get("automacao_id")
    parceiro_id = data.get("parceiro_id")
    data_inicio = data.get("data_inicio")
    data_fim = data.get("data_fim")
    
    if not automacao_id or not parceiro_id:
        raise HTTPException(status_code=400, detail="automacao_id e parceiro_id são obrigatórios")
    
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get automacao
    automacao = await db.automacoes.find_one({"id": automacao_id}, {"_id": 0})
    if not automacao:
        raise HTTPException(status_code=404, detail="Automação não encontrada")
    
    # Get credenciais
    credenciais = await db.credenciais_parceiro.find_one({
        "parceiro_id": parceiro_id,
        "fornecedor_id": automacao["fornecedor_id"]
    }, {"_id": 0})
    
    if not credenciais:
        raise HTTPException(status_code=400, detail="Credenciais não configuradas para este fornecedor")
    
    # Create execution record
    execucao_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    execucao = {
        "id": execucao_id,
        "automacao_id": automacao_id,
        "automacao_nome": automacao.get("nome"),
        "parceiro_id": parceiro_id,
        "fornecedor_id": automacao["fornecedor_id"],
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "status": "pendente",
        "progresso": 0,
        "screenshots": [],
        "logs": [],
        "criado_por": current_user["id"],
        "created_at": now.isoformat()
    }
    
    await db.execucoes_automacao.insert_one(execucao)
    
    # Queue execution in background
    # background_tasks.add_task(run_automation, execucao_id)
    
    logger.info(f"🤖 Execução de automação agendada: {execucao_id}")
    
    return {
        "message": "Execução agendada com sucesso",
        "execucao_id": execucao_id,
        "status": "pendente"
    }


@router.get("/execucoes")
async def listar_execucoes(
    parceiro_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List automation executions"""
    query = {}
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    if status:
        query["status"] = status
    
    execucoes = await db.execucoes_automacao.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return execucoes


@router.get("/execucoes/{execucao_id}")
async def get_execucao(execucao_id: str, current_user: Dict = Depends(get_current_user)):
    """Get execution details"""
    execucao = await db.execucoes_automacao.find_one({"id": execucao_id}, {"_id": 0})
    if not execucao:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO and current_user["id"] != execucao["parceiro_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return execucao


@router.post("/execucoes/{execucao_id}/cancelar")
async def cancelar_execucao(execucao_id: str, current_user: Dict = Depends(get_current_user)):
    """Cancel execution"""
    execucao = await db.execucoes_automacao.find_one({"id": execucao_id}, {"_id": 0})
    if not execucao:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    
    if execucao["status"] not in ["pendente", "em_execucao"]:
        raise HTTPException(status_code=400, detail="Esta execução não pode ser cancelada")
    
    await db.execucoes_automacao.update_one(
        {"id": execucao_id},
        {"$set": {
            "status": "cancelado",
            "terminado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Execução cancelada"}


# ==================== DASHBOARD ====================

@router.get("/dashboard")
async def get_dashboard_automacao(current_user: Dict = Depends(get_current_user)):
    """Get automation dashboard stats"""
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    # Count fornecedores
    total_fornecedores = await db.fornecedores.count_documents({"ativo": True})
    
    # Count automacoes
    total_automacoes = await db.automacoes.count_documents({"ativo": True})
    
    # Count execuções
    execucoes_query = query.copy()
    total_execucoes = await db.execucoes_automacao.count_documents(execucoes_query)
    
    execucoes_query["status"] = "sucesso"
    execucoes_sucesso = await db.execucoes_automacao.count_documents(execucoes_query)
    
    execucoes_query["status"] = "erro"
    execucoes_erro = await db.execucoes_automacao.count_documents(execucoes_query)
    
    execucoes_query["status"] = "pendente"
    execucoes_pendentes = await db.execucoes_automacao.count_documents(execucoes_query)
    
    # Recent executions
    execucoes_recentes = await db.execucoes_automacao.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "total_fornecedores": total_fornecedores,
        "total_automacoes": total_automacoes,
        "total_execucoes": total_execucoes,
        "execucoes_sucesso": execucoes_sucesso,
        "execucoes_erro": execucoes_erro,
        "execucoes_pendentes": execucoes_pendentes,
        "taxa_sucesso": (execucoes_sucesso / total_execucoes * 100) if total_execucoes > 0 else 0,
        "execucoes_recentes": execucoes_recentes
    }
