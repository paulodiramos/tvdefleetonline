"""
Rotas para Sistema de Tickets/Suporte
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import logging
import os
import shutil
from pathlib import Path

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/tickets", tags=["Tickets/Suporte"])
logger = logging.getLogger(__name__)
db = get_database()

# Upload directory for ticket attachments
ROOT_DIR = Path(__file__).parent.parent
TICKETS_UPLOAD_DIR = ROOT_DIR / "uploads" / "tickets"
TICKETS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Estados possíveis do ticket
TICKET_STATUS = {
    "aberto": "Aberto",
    "em_analise": "Em Análise", 
    "a_processar": "A Processar",
    "aguardar_resposta": "Aguardar Resposta",
    "resolvido": "Resolvido",
    "fechado": "Fechado"
}

# Categorias de tickets
TICKET_CATEGORIES = [
    "problema_tecnico",
    "pagamentos",
    "documentos",
    "veiculo",
    "contrato",
    "acidente",
    "avaria",
    "outro"
]

# Categorias que requerem fotos obrigatórias
CATEGORIAS_COM_FOTOS = ["acidente", "avaria"]

# Dias para auto-fechamento sem resposta
AUTO_CLOSE_DAYS = 7


class TicketCreate(BaseModel):
    titulo: str
    categoria: str
    descricao: str
    prioridade: Optional[str] = "normal"  # baixa, normal, alta, urgente
    destinatario_tipo: Optional[str] = "admin"  # admin, gestor, parceiro


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    prioridade: Optional[str] = None


class MensagemCreate(BaseModel):
    conteudo: str


@router.post("/criar")
async def criar_ticket(
    data: TicketCreate,
    current_user: dict = Depends(get_current_user)
):
    """Criar novo ticket de suporte"""
    
    # Validar categoria
    if data.categoria not in TICKET_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Categoria inválida. Use: {TICKET_CATEGORIES}")
    
    # Determinar destinatário baseado no role do utilizador
    destinatario_id = None
    destinatario_nome = None
    
    if current_user["role"] == "motorista":
        # Motorista pode abrir para parceiro ou admin
        if data.destinatario_tipo == "parceiro":
            # Buscar parceiro atribuído
            motorista = await db.motoristas.find_one({"id": current_user["id"]}, {"_id": 0})
            if motorista and motorista.get("parceiro_atribuido"):
                parceiro = await db.parceiros.find_one({"id": motorista["parceiro_atribuido"]}, {"_id": 0})
                if parceiro:
                    destinatario_id = parceiro["id"]
                    destinatario_nome = parceiro.get("nome_empresa") or parceiro.get("name")
        elif data.destinatario_tipo == "gestor":
            # Buscar gestor atribuído ao parceiro
            motorista = await db.motoristas.find_one({"id": current_user["id"]}, {"_id": 0})
            if motorista and motorista.get("parceiro_atribuido"):
                parceiro = await db.parceiros.find_one({"id": motorista["parceiro_atribuido"]}, {"_id": 0})
                if parceiro and parceiro.get("gestor_associado_id"):
                    gestor = await db.users.find_one({"id": parceiro["gestor_associado_id"]}, {"_id": 0})
                    if gestor:
                        destinatario_id = gestor["id"]
                        destinatario_nome = gestor.get("name")
    
    elif current_user["role"] == "parceiro":
        # Parceiro pode abrir para gestor (se atribuído) ou admin
        if data.destinatario_tipo == "gestor":
            parceiro = await db.parceiros.find_one({"id": current_user["id"]}, {"_id": 0})
            if parceiro and parceiro.get("gestor_associado_id"):
                gestor = await db.users.find_one({"id": parceiro["gestor_associado_id"]}, {"_id": 0})
                if gestor:
                    destinatario_id = gestor["id"]
                    destinatario_nome = gestor.get("name")
    
    # Criar ticket
    ticket = {
        "id": str(uuid.uuid4()),
        "numero": await _gerar_numero_ticket(),
        "titulo": data.titulo,
        "categoria": data.categoria,
        "descricao": data.descricao,
        "prioridade": "urgente" if data.categoria in CATEGORIAS_COM_FOTOS else data.prioridade,
        "requer_fotos": data.categoria in CATEGORIAS_COM_FOTOS,
        "fotos": [],
        "status": "aberto",
        "criado_por_id": current_user["id"],
        "criado_por_nome": current_user.get("name"),
        "criado_por_role": current_user["role"],
        "destinatario_tipo": data.destinatario_tipo,
        "destinatario_id": destinatario_id,
        "destinatario_nome": destinatario_nome,
        "mensagens": [{
            "id": str(uuid.uuid4()),
            "autor_id": current_user["id"],
            "autor_nome": current_user.get("name"),
            "autor_role": current_user["role"],
            "conteudo": data.descricao,
            "anexos": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }],
        "anexos": [],
        "ultima_resposta": datetime.now(timezone.utc).isoformat(),
        "data_auto_fecho": (datetime.now(timezone.utc) + timedelta(days=AUTO_CLOSE_DAYS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tickets.insert_one(ticket)
    logger.info(f"Ticket {ticket['numero']} criado por {current_user['id']}")
    
    return {
        "success": True,
        "ticket_id": ticket["id"],
        "numero": ticket["numero"],
        "message": f"Ticket #{ticket['numero']} criado com sucesso"
    }


async def _gerar_numero_ticket():
    """Gerar número sequencial do ticket"""
    ano = datetime.now().year
    
    # Contar tickets do ano
    count = await db.tickets.count_documents({
        "created_at": {"$regex": f"^{ano}"}
    })
    
    return f"{ano}{str(count + 1).zfill(5)}"


@router.get("/meus")
async def listar_meus_tickets(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar tickets do utilizador (criados ou destinados)"""
    
    query = {
        "$or": [
            {"criado_por_id": current_user["id"]},
            {"destinatario_id": current_user["id"]}
        ]
    }
    
    # Admin e gestor veem tickets destinados ao suporte
    if current_user["role"] in ["admin", "gestao"]:
        query["$or"].append({"destinatario_tipo": "admin"})
    
    if status:
        query["status"] = status
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
    
    return tickets


@router.get("/para-gerir")
async def listar_tickets_para_gerir(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar tickets para gestão (admin, gestor, parceiro)"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {}
    
    if current_user["role"] == "admin":
        # Admin vê todos os tickets destinados ao suporte
        query["destinatario_tipo"] = "admin"
    elif current_user["role"] == "gestao":
        # Gestor vê tickets dos parceiros que gere
        query["$or"] = [
            {"destinatario_id": current_user["id"]},
            {"destinatario_tipo": "admin"}
        ]
    elif current_user["role"] == "parceiro":
        # Parceiro vê tickets dos seus motoristas
        query["destinatario_id"] = current_user["id"]
    
    if status:
        query["status"] = status
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("updated_at", -1).to_list(200)
    
    return tickets


@router.get("/{ticket_id}")
async def obter_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de um ticket"""
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    
    # Verificar permissões
    pode_ver = (
        ticket["criado_por_id"] == current_user["id"] or
        ticket.get("destinatario_id") == current_user["id"] or
        current_user["role"] == "admin" or
        (current_user["role"] == "gestao" and ticket.get("destinatario_tipo") in ["admin", "gestor"])
    )
    
    if not pode_ver:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    return ticket


@router.post("/{ticket_id}/mensagem")
async def adicionar_mensagem(
    ticket_id: str,
    data: MensagemCreate,
    current_user: dict = Depends(get_current_user)
):
    """Adicionar mensagem ao ticket (chat)"""
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    
    # Verificar se pode responder
    pode_responder = (
        ticket["criado_por_id"] == current_user["id"] or
        ticket.get("destinatario_id") == current_user["id"] or
        current_user["role"] == "admin" or
        (current_user["role"] == "gestao" and ticket.get("destinatario_tipo") in ["admin", "gestor"]) or
        (current_user["role"] == "parceiro" and ticket.get("destinatario_id") == current_user["id"])
    )
    
    if not pode_responder:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Verificar se ticket está fechado
    if ticket["status"] == "fechado":
        raise HTTPException(status_code=400, detail="Ticket já está fechado")
    
    # Criar mensagem
    mensagem = {
        "id": str(uuid.uuid4()),
        "autor_id": current_user["id"],
        "autor_nome": current_user.get("name"),
        "autor_role": current_user["role"],
        "conteudo": data.conteudo,
        "anexos": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Determinar novo status
    novo_status = ticket["status"]
    if ticket["criado_por_id"] == current_user["id"]:
        # Utilizador respondeu - aguardar resposta do suporte
        if ticket["status"] == "aguardar_resposta":
            novo_status = "em_analise"
    else:
        # Suporte respondeu - aguardar resposta do utilizador
        novo_status = "aguardar_resposta"
    
    # Atualizar ticket
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"mensagens": mensagem},
            "$set": {
                "status": novo_status,
                "ultima_resposta": datetime.now(timezone.utc).isoformat(),
                "data_auto_fecho": (datetime.now(timezone.utc) + timedelta(days=AUTO_CLOSE_DAYS)).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"Mensagem adicionada ao ticket {ticket['numero']} por {current_user['id']}")
    
    return {
        "success": True,
        "mensagem_id": mensagem["id"],
        "novo_status": novo_status
    }


@router.post("/{ticket_id}/foto")
async def adicionar_foto_ticket(
    ticket_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Adicionar foto ao ticket (especialmente para acidentes e avarias)
    Suporta múltiplas fotos por ticket
    """
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    
    # Verificar se é o criador do ticket
    if ticket["criado_por_id"] != current_user["id"] and current_user["role"] not in ["admin", "gestao"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Validar tipo de ficheiro (apenas imagens)
    allowed_extensions = [".jpg", ".jpeg", ".png", ".heic", ".heif"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Apenas imagens são permitidas: {allowed_extensions}")
    
    # Criar diretório para fotos do ticket
    ticket_fotos_dir = TICKETS_UPLOAD_DIR / "fotos" / ticket_id
    ticket_fotos_dir.mkdir(parents=True, exist_ok=True)
    
    # Guardar foto
    foto_id = str(uuid.uuid4())
    file_name = f"{foto_id}{file_ext}"
    file_path = ticket_fotos_dir / file_name
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    foto = {
        "id": foto_id,
        "nome": file.filename,
        "path": str(file_path),
        "url": f"/api/tickets/{ticket_id}/foto/{foto_id}",
        "enviado_por": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Adicionar foto ao ticket
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"fotos": foto},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    logger.info(f"Foto adicionada ao ticket {ticket['numero']} por {current_user['id']}")
    
    return {
        "success": True,
        "foto_id": foto_id,
        "url": foto["url"],
        "message": "Foto adicionada com sucesso"
    }


@router.get("/{ticket_id}/foto/{foto_id}")
async def get_foto_ticket(
    ticket_id: str,
    foto_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter foto de um ticket"""
    from fastapi.responses import FileResponse
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    
    # Verificar permissões
    pode_ver = (
        ticket["criado_por_id"] == current_user["id"] or
        ticket.get("destinatario_id") == current_user["id"] or
        current_user["role"] in ["admin", "gestao", "parceiro"]
    )
    
    if not pode_ver:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Encontrar foto
    foto = next((f for f in ticket.get("fotos", []) if f["id"] == foto_id), None)
    
    if not foto:
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    
    file_path = Path(foto["path"])
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
    
    return FileResponse(
        path=str(file_path),
        filename=foto["nome"],
        media_type="image/jpeg"
    )


@router.post("/{ticket_id}/anexo")
async def adicionar_anexo(
    ticket_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Adicionar anexo ao ticket"""
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    
    # Verificar permissões
    pode_anexar = (
        ticket["criado_por_id"] == current_user["id"] or
        ticket.get("destinatario_id") == current_user["id"] or
        current_user["role"] in ["admin", "gestao"]
    )
    
    if not pode_anexar:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Validar ficheiro
    max_size = 10 * 1024 * 1024  # 10MB
    allowed_extensions = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx"]
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Tipo de ficheiro não permitido. Use: {allowed_extensions}")
    
    # Guardar ficheiro
    file_id = str(uuid.uuid4())
    file_path = TICKETS_UPLOAD_DIR / f"{file_id}{file_ext}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    anexo = {
        "id": file_id,
        "nome": file.filename,
        "tipo": file_ext,
        "path": str(file_path),
        "enviado_por": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Atualizar ticket
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"anexos": anexo},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {
        "success": True,
        "anexo_id": file_id,
        "nome": file.filename
    }


@router.patch("/{ticket_id}/status")
async def atualizar_status(
    ticket_id: str,
    data: TicketUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar status do ticket"""
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    
    # Verificar permissões (apenas quem gere pode mudar status)
    pode_atualizar = (
        current_user["role"] == "admin" or
        ticket.get("destinatario_id") == current_user["id"] or
        (current_user["role"] == "gestao" and ticket.get("destinatario_tipo") in ["admin", "gestor"]) or
        (current_user["role"] == "parceiro" and ticket.get("destinatario_id") == current_user["id"])
    )
    
    if not pode_atualizar:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.status:
        if data.status not in TICKET_STATUS:
            raise HTTPException(status_code=400, detail=f"Status inválido. Use: {list(TICKET_STATUS.keys())}")
        update_data["status"] = data.status
        
        if data.status == "fechado":
            update_data["fechado_por"] = current_user["id"]
            update_data["fechado_em"] = datetime.now(timezone.utc).isoformat()
    
    if data.prioridade:
        update_data["prioridade"] = data.prioridade
    
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_data})
    
    logger.info(f"Ticket {ticket['numero']} atualizado para status={data.status} por {current_user['id']}")
    
    return {"success": True, "message": "Ticket atualizado"}


@router.post("/{ticket_id}/fechar")
async def fechar_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Fechar ticket"""
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    
    # Quem pode fechar: criador, destinatário, admin, gestor, parceiro
    pode_fechar = (
        ticket["criado_por_id"] == current_user["id"] or
        ticket.get("destinatario_id") == current_user["id"] or
        current_user["role"] in ["admin", "gestao", "parceiro"]
    )
    
    if not pode_fechar:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "fechado",
            "fechado_por": current_user["id"],
            "fechado_em": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": f"Ticket #{ticket['numero']} fechado"}


@router.get("/estatisticas/resumo")
async def estatisticas_tickets(
    current_user: dict = Depends(get_current_user)
):
    """Obter estatísticas de tickets"""
    
    if current_user["role"] not in ["admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Build query based on role
    query = {}
    if current_user["role"] == "parceiro":
        query["destinatario_id"] = current_user["id"]
    elif current_user["role"] == "gestao":
        query["$or"] = [
            {"destinatario_id": current_user["id"]},
            {"destinatario_tipo": "admin"}
        ]
    
    # Count by status
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    
    status_counts = await db.tickets.aggregate(pipeline).to_list(10)
    
    # Count by category
    pipeline_cat = [
        {"$match": query},
        {"$group": {"_id": "$categoria", "count": {"$sum": 1}}}
    ]
    
    category_counts = await db.tickets.aggregate(pipeline_cat).to_list(20)
    
    # Total e abertos
    total = await db.tickets.count_documents(query)
    abertos = await db.tickets.count_documents({**query, "status": {"$nin": ["fechado", "resolvido"]}})
    
    return {
        "total": total,
        "abertos": abertos,
        "por_status": {s["_id"]: s["count"] for s in status_counts},
        "por_categoria": {c["_id"]: c["count"] for c in category_counts}
    }
