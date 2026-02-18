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
    "tecnico",
    "esclarecimentos",
    "relatorios",
    "documentos",
    "veiculo",
    "contrato",
    "acidente",
    "avaria",
    "revisao",
    "multas",
    "seguro",
    "manutencao",
    "outro"
]

# Categorias que requerem fotos obrigatórias
CATEGORIAS_COM_FOTOS = ["acidente", "avaria"]

# Dias para auto-fechamento sem resposta
AUTO_CLOSE_DAYS = 7


class FotoBase64(BaseModel):
    base64: Optional[str] = None
    uri: Optional[str] = None


class TicketCreate(BaseModel):
    titulo: str
    categoria: str
    descricao: str
    prioridade: Optional[str] = "normal"  # baixa, normal, alta, urgente
    destinatario_tipo: Optional[str] = "admin"  # admin, gestor, parceiro, motorista
    destinatario_id: Optional[str] = None  # ID específico do destinatário
    veiculo_id: Optional[str] = None  # ID do veículo afetado
    motorista_id: Optional[str] = None  # ID do motorista afetado
    fotos: Optional[List[FotoBase64]] = []


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    prioridade: Optional[str] = None


class MensagemCreate(BaseModel):
    conteudo: str


@router.get("/destinatarios-disponiveis")
async def listar_destinatarios_disponiveis(
    current_user: dict = Depends(get_current_user)
):
    """Listar destinatários disponíveis para criar tickets com base no role do utilizador
    
    Permissões:
    - Parceiro: gestor, admin e motoristas associados
    - Gestor: todos os parceiros e motoristas associados
    - Admin: todos os utilizadores
    - Motorista: parceiro associado, gestor e admin
    """
    
    destinatarios = {
        "admins": [],
        "gestores": [],
        "parceiros": [],
        "motoristas": []
    }
    
    if current_user["role"] == "admin":
        # Admin pode contactar todos
        users = await db.users.find({"status": {"$ne": "blocked"}}, {"_id": 0, "password": 0}).to_list(1000)
        for u in users:
            if u.get("role") == "admin" and u.get("id") != current_user["id"]:
                destinatarios["admins"].append({"id": u["id"], "nome": u.get("name"), "email": u.get("email")})
            elif u.get("role") == "gestao":
                destinatarios["gestores"].append({"id": u["id"], "nome": u.get("name"), "email": u.get("email")})
            elif u.get("role") == "parceiro":
                destinatarios["parceiros"].append({"id": u["id"], "nome": u.get("name"), "email": u.get("email")})
            elif u.get("role") == "motorista":
                destinatarios["motoristas"].append({"id": u["id"], "nome": u.get("name"), "email": u.get("email")})
    
    elif current_user["role"] == "gestao":
        # Gestor pode contactar admins, parceiros e motoristas associados
        admins = await db.users.find({"role": "admin", "status": {"$ne": "blocked"}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(100)
        destinatarios["admins"] = [{"id": a["id"], "nome": a.get("name"), "email": a.get("email")} for a in admins]
        
        # Buscar parceiros e motoristas associados ao gestor
        parceiros = await db.parceiros.find({"gestor_associado_id": current_user["id"]}, {"_id": 0}).to_list(100)
        for p in parceiros:
            destinatarios["parceiros"].append({"id": p.get("id"), "nome": p.get("nome_empresa") or p.get("name"), "email": p.get("email")})
            # Motoristas do parceiro
            motoristas = await db.motoristas.find({
                "$or": [{"parceiro_id": p.get("id")}, {"parceiro_atribuido": p.get("id")}],
                "ativo": True
            }, {"_id": 0}).to_list(100)
            for m in motoristas:
                destinatarios["motoristas"].append({"id": m.get("id"), "nome": m.get("name"), "email": m.get("email")})
    
    elif current_user["role"] == "parceiro":
        # Parceiro pode contactar admin, gestor e motoristas associados
        admins = await db.users.find({"role": "admin", "status": {"$ne": "blocked"}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(100)
        destinatarios["admins"] = [{"id": a["id"], "nome": a.get("name"), "email": a.get("email")} for a in admins]
        
        # Buscar gestor associado
        parceiro = await db.parceiros.find_one({"id": current_user["id"]}, {"_id": 0})
        if parceiro and parceiro.get("gestor_associado_id"):
            gestor = await db.users.find_one({"id": parceiro["gestor_associado_id"]}, {"_id": 0, "id": 1, "name": 1, "email": 1})
            if gestor:
                destinatarios["gestores"].append({"id": gestor["id"], "nome": gestor.get("name"), "email": gestor.get("email")})
        
        # Motoristas associados ao parceiro
        motoristas = await db.motoristas.find({
            "$or": [{"parceiro_id": current_user["id"]}, {"parceiro_atribuido": current_user["id"]}],
            "ativo": True
        }, {"_id": 0}).to_list(100)
        for m in motoristas:
            destinatarios["motoristas"].append({"id": m.get("id"), "nome": m.get("name"), "email": m.get("email")})
    
    elif current_user["role"] == "motorista":
        # Motorista pode contactar admin, gestor e parceiro associado
        admins = await db.users.find({"role": "admin", "status": {"$ne": "blocked"}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(100)
        destinatarios["admins"] = [{"id": a["id"], "nome": a.get("name"), "email": a.get("email")} for a in admins]
        
        # Buscar parceiro e gestor associados
        motorista = await db.motoristas.find_one({"id": current_user["id"]}, {"_id": 0})
        if motorista:
            parceiro_id = motorista.get("parceiro_id") or motorista.get("parceiro_atribuido")
            if parceiro_id:
                parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
                if parceiro:
                    destinatarios["parceiros"].append({"id": parceiro.get("id"), "nome": parceiro.get("nome_empresa") or parceiro.get("name"), "email": parceiro.get("email")})
                    if parceiro.get("gestor_associado_id"):
                        gestor = await db.users.find_one({"id": parceiro["gestor_associado_id"]}, {"_id": 0, "id": 1, "name": 1, "email": 1})
                        if gestor:
                            destinatarios["gestores"].append({"id": gestor["id"], "nome": gestor.get("name"), "email": gestor.get("email")})
    
    return destinatarios


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
    
    # Processar fotos em base64
    fotos_salvas = []
    if data.fotos:
        import base64
        for idx, foto in enumerate(data.fotos):
            if foto.base64:
                try:
                    # Decodificar base64 e salvar ficheiro
                    foto_data = base64.b64decode(foto.base64)
                    foto_id = str(uuid.uuid4())
                    foto_filename = f"{foto_id}.jpg"
                    foto_path = TICKETS_UPLOAD_DIR / foto_filename
                    
                    with open(foto_path, 'wb') as f:
                        f.write(foto_data)
                    
                    fotos_salvas.append({
                        "id": foto_id,
                        "filename": foto_filename,
                        "url": f"/uploads/tickets/{foto_filename}",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                except Exception as e:
                    logger.warning(f"Erro ao salvar foto {idx}: {e}")
    
    # Criar ticket
    veiculo_info = None
    motorista_info = None
    
    # Buscar informações do veículo se fornecido
    if data.veiculo_id:
        veiculo = await db.vehicles.find_one({"id": data.veiculo_id}, {"_id": 0})
        if veiculo:
            veiculo_info = {
                "id": veiculo["id"],
                "matricula": veiculo.get("matricula"),
                "marca": veiculo.get("marca"),
                "modelo": veiculo.get("modelo")
            }
    
    # Buscar informações do motorista se fornecido
    if data.motorista_id:
        motorista = await db.motoristas.find_one({"id": data.motorista_id}, {"_id": 0})
        if motorista:
            motorista_info = {
                "id": motorista["id"],
                "nome": motorista.get("name"),
                "email": motorista.get("email")
            }
    
    ticket = {
        "id": str(uuid.uuid4()),
        "numero": await _gerar_numero_ticket(),
        "titulo": data.titulo,
        "categoria": data.categoria,
        "descricao": data.descricao,
        "prioridade": "urgente" if data.categoria in CATEGORIAS_COM_FOTOS else data.prioridade,
        "requer_fotos": data.categoria in CATEGORIAS_COM_FOTOS,
        "fotos": fotos_salvas,
        "tem_anexos": len(fotos_salvas) > 0,
        "status": "aberto",
        "criado_por_id": current_user["id"],
        "criado_por_nome": current_user.get("name"),
        "criado_por_role": current_user["role"],
        "destinatario_tipo": data.destinatario_tipo,
        "destinatario_id": data.destinatario_id or destinatario_id,
        "destinatario_nome": destinatario_nome,
        # Associação com veículo e motorista
        "veiculo_id": data.veiculo_id,
        "veiculo_info": veiculo_info,
        "motorista_id": data.motorista_id,
        "motorista_info": motorista_info,
        # Intervenientes (quem pode ver este ticket)
        "intervenientes": [current_user["id"]],
        # Estado de leitura
        "lido_por": [{
            "user_id": current_user["id"],
            "data_leitura": datetime.now(timezone.utc).isoformat()
        }],
        "ultima_comunicacao": {
            "data": datetime.now(timezone.utc).isoformat(),
            "por_id": current_user["id"],
            "por_nome": current_user.get("name"),
            "tipo": "criacao"
        },
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
        "updated_at": datetime.now(timezone.utc).isoformat(),
        # Arquivo (após fechado)
        "arquivado": False,
        "data_arquivo": None
    }
    
    # Adicionar destinatário aos intervenientes
    if data.destinatario_id or destinatario_id:
        ticket["intervenientes"].append(data.destinatario_id or destinatario_id)
    
    await db.tickets.insert_one(ticket)
    logger.info(f"Ticket {ticket['numero']} criado por {current_user['id']} com {len(fotos_salvas)} fotos")
    
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


@router.get("/por-veiculo/{veiculo_id}")
async def listar_tickets_por_veiculo(
    veiculo_id: str,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar tickets associados a um veículo"""
    
    query = {"veiculo_id": veiculo_id}
    
    if status:
        query["status"] = status
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
    
    return tickets


@router.get("/por-motorista/{motorista_id}")
async def listar_tickets_por_motorista(
    motorista_id: str,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar tickets associados a um motorista"""
    
    query = {"$or": [
        {"motorista_id": motorista_id},
        {"criado_por_id": motorista_id}
    ]}
    
    if status:
        query["status"] = status
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
    
    return tickets


@router.get("/categorias")
async def listar_categorias():
    """Listar categorias disponíveis para tickets"""
    return {
        "categorias": TICKET_CATEGORIES,
        "categorias_com_fotos_obrigatorias": CATEGORIAS_COM_FOTOS
    }


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
