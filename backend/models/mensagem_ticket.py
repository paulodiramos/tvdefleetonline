"""Mensagens e Tickets models"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class Mensagem(BaseModel):
    id: str
    conversa_id: str
    remetente_id: str
    remetente_nome: str
    destinatario_id: str
    conteudo: str
    lida: bool = False
    created_at: datetime

class Ticket(BaseModel):
    id: str
    user_id: str
    user_nome: str
    assunto: str
    descricao: str
    tipo: str  # "tecnico", "comercial", "suporte"
    status: str  # "aberto", "em_andamento", "fechado"
    prioridade: str  # "baixa", "media", "alta"
    mensagens: List[dict] = []
    atribuido_a: Optional[str] = None
    created_at: datetime
    updated_at: datetime
