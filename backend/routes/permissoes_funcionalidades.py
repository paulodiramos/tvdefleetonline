"""
API de Gestão de Permissões de Funcionalidades por Parceiro
Permite ao admin configurar quais funcionalidades cada parceiro tem acesso
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import logging

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter(prefix="/permissoes", tags=["permissoes"])
db = get_database()
logger = logging.getLogger(__name__)


# Definição de todas as funcionalidades disponíveis
FUNCIONALIDADES_DISPONIVEIS = [
    {
        "id": "whatsapp",
        "nome": "WhatsApp",
        "descricao": "Enviar mensagens via WhatsApp Cloud API",
        "icone": "📱",
        "categoria": "comunicacao"
    },
    {
        "id": "email",
        "nome": "Email",
        "descricao": "Enviar emails e relatórios por email",
        "icone": "📧",
        "categoria": "comunicacao"
    },
    {
        "id": "vistorias",
        "nome": "Vistorias",
        "descricao": "Gestão de vistorias de veículos",
        "icone": "🔍",
        "categoria": "veiculos"
    },
    {
        "id": "contratos",
        "nome": "Contratos",
        "descricao": "Gestão de contratos com motoristas",
        "icone": "📄",
        "categoria": "documentos"
    },
    {
        "id": "rpa_automacao",
        "nome": "RPA Automação",
        "descricao": "Executar scripts de automação RPA",
        "icone": "🤖",
        "categoria": "automacao"
    },
    {
        "id": "importacao_csv",
        "nome": "Importação CSV",
        "descricao": "Importar dados via ficheiros CSV",
        "icone": "📥",
        "categoria": "automacao"
    },
    {
        "id": "agenda_veiculos",
        "nome": "Agenda de Veículos",
        "descricao": "Calendário e agendamento de veículos",
        "icone": "📅",
        "categoria": "veiculos"
    },
    {
        "id": "alertas",
        "nome": "Alertas",
        "descricao": "Sistema de alertas e notificações",
        "icone": "🔔",
        "categoria": "sistema"
    },
    {
        "id": "anuncios_venda",
        "nome": "Anúncios de Venda",
        "descricao": "Publicar anúncios de veículos para venda",
        "icone": "🏷️",
        "categoria": "veiculos"
    },
    {
        "id": "relatorios",
        "nome": "Relatórios",
        "descricao": "Visualizar e gerar relatórios",
        "icone": "📊",
        "categoria": "financeiro"
    },
    {
        "id": "financeiro",
        "nome": "Financeiro",
        "descricao": "Gestão financeira e pagamentos",
        "icone": "💰",
        "categoria": "financeiro"
    },
    {
        "id": "motoristas",
        "nome": "Motoristas",
        "descricao": "Gestão de motoristas",
        "icone": "👤",
        "categoria": "gestao"
    },
    {
        "id": "veiculos",
        "nome": "Veículos",
        "descricao": "Gestão de frota de veículos",
        "icone": "🚗",
        "categoria": "veiculos"
    },
    {
        "id": "documentos",
        "nome": "Documentos",
        "descricao": "Gestão de documentos",
        "icone": "📁",
        "categoria": "documentos"
    },
    {
        "id": "terabox",
        "nome": "Terabox",
        "descricao": "Integração com armazenamento Terabox",
        "icone": "☁️",
        "categoria": "integracao"
    }
]

# Categorias de funcionalidades
CATEGORIAS = {
    "comunicacao": {"nome": "Comunicação", "cor": "green"},
    "veiculos": {"nome": "Veículos", "cor": "blue"},
    "documentos": {"nome": "Documentos", "cor": "purple"},
    "automacao": {"nome": "Automação", "cor": "orange"},
    "financeiro": {"nome": "Financeiro", "cor": "yellow"},
    "gestao": {"nome": "Gestão", "cor": "slate"},
    "sistema": {"nome": "Sistema", "cor": "red"},
    "integracao": {"nome": "Integração", "cor": "cyan"}
}


class PermissoesFuncionalidades(BaseModel):
    """Modelo de permissões de funcionalidades"""
    funcionalidades: List[str]


# ==================== ENDPOINTS ====================

@router.get("/funcionalidades")
async def listar_funcionalidades(current_user: Dict = Depends(get_current_user)):
    """Lista todas as funcionalidades disponíveis"""
    return {
        "funcionalidades": FUNCIONALIDADES_DISPONIVEIS,
        "categorias": CATEGORIAS
    }


@router.get("/parceiro/{parceiro_id}")
async def get_permissoes_parceiro(
    parceiro_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter permissões de funcionalidades de um parceiro"""
    # Parceiro pode ver as suas próprias permissões, admin pode ver todas
    if current_user["role"] != "admin" and current_user["id"] != parceiro_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    permissoes = await db.parceiro_funcionalidades.find_one(
        {"parceiro_id": parceiro_id},
        {"_id": 0}
    )
    
    if not permissoes:
        # Retornar permissões padrão (todas ativas para novos parceiros)
        return {
            "parceiro_id": parceiro_id,
            "funcionalidades": [f["id"] for f in FUNCIONALIDADES_DISPONIVEIS]
        }
    
    return permissoes


@router.put("/parceiro/{parceiro_id}")
async def update_permissoes_parceiro(
    parceiro_id: str,
    permissoes: PermissoesFuncionalidades,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar permissões de funcionalidades de um parceiro (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    # Validar funcionalidades
    ids_validos = [f["id"] for f in FUNCIONALIDADES_DISPONIVEIS]
    for func_id in permissoes.funcionalidades:
        if func_id not in ids_validos:
            raise HTTPException(status_code=400, detail=f"Funcionalidade inválida: {func_id}")
    
    await db.parceiro_funcionalidades.update_one(
        {"parceiro_id": parceiro_id},
        {"$set": {
            "parceiro_id": parceiro_id,
            "funcionalidades": permissoes.funcionalidades,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"success": True, "message": f"Permissões atualizadas ({len(permissoes.funcionalidades)} funcionalidades)"}


@router.get("/admin/todos-parceiros")
async def listar_permissoes_todos_parceiros(current_user: Dict = Depends(get_current_user)):
    """Listar permissões de todos os parceiros (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    # Buscar todos os parceiros
    parceiros = await db.users.find(
        {"role": "parceiro"},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "empresa": 1}
    ).to_list(100)
    
    resultado = []
    for parceiro in parceiros:
        permissoes = await db.parceiro_funcionalidades.find_one({"parceiro_id": parceiro["id"]})
        
        # Se não tem permissões configuradas, usar todas por padrão
        if not permissoes:
            funcionalidades = [f["id"] for f in FUNCIONALIDADES_DISPONIVEIS]
        else:
            funcionalidades = permissoes.get("funcionalidades", [])
        
        resultado.append({
            "parceiro_id": parceiro["id"],
            "nome": parceiro.get("name") or parceiro.get("empresa", "Sem nome"),
            "email": parceiro.get("email", ""),
            "funcionalidades": funcionalidades,
            "total_funcionalidades": len(funcionalidades)
        })
    
    return resultado


@router.get("/minhas")
async def get_minhas_permissoes(current_user: Dict = Depends(get_current_user)):
    """Obter as permissões do utilizador atual"""
    # Admin tem todas as permissões
    if current_user["role"] == "admin":
        return {
            "funcionalidades": [f["id"] for f in FUNCIONALIDADES_DISPONIVEIS],
            "is_admin": True
        }
    
    parceiro_id = current_user["id"] if current_user["role"] == "parceiro" else current_user.get("parceiro_id")
    
    if not parceiro_id:
        return {"funcionalidades": [], "is_admin": False}
    
    permissoes = await db.parceiro_funcionalidades.find_one({"parceiro_id": parceiro_id})
    
    if not permissoes:
        # Por padrão, todas as funcionalidades ativas
        return {
            "funcionalidades": [f["id"] for f in FUNCIONALIDADES_DISPONIVEIS],
            "is_admin": False
        }
    
    return {
        "funcionalidades": permissoes.get("funcionalidades", []),
        "is_admin": False
    }


@router.post("/verificar")
async def verificar_permissao(
    funcionalidade_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Verificar se o utilizador tem permissão para uma funcionalidade específica"""
    # Admin tem todas as permissões
    if current_user["role"] == "admin":
        return {"permitido": True}
    
    parceiro_id = current_user["id"] if current_user["role"] == "parceiro" else current_user.get("parceiro_id")
    
    if not parceiro_id:
        return {"permitido": False}
    
    permissoes = await db.parceiro_funcionalidades.find_one({"parceiro_id": parceiro_id})
    
    if not permissoes:
        # Por padrão, permitido
        return {"permitido": True}
    
    permitido = funcionalidade_id in permissoes.get("funcionalidades", [])
    return {"permitido": permitido}
