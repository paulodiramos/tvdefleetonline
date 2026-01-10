"""Public routes (no authentication required)"""

from fastapi import APIRouter
from typing import Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)


@router.get("/public/veiculos")
async def get_public_veiculos():
    """Get public vehicles available for sale or rent (including vehicles without assigned driver)"""
    veiculos = await db.vehicles.find({
        "$or": [
            {"disponivel_venda": True},
            {"disponivel_aluguer": True},
            # Veículos sem motorista atribuído que estão disponíveis
            {
                "disponivel_para_aluguer": True,
                "$or": [
                    {"motorista_atribuido": None},
                    {"motorista_atribuido": ""},
                    {"motorista_atribuido": {"$exists": False}}
                ]
            }
        ]
    }, {"_id": 0}).to_list(length=None)
    
    # Enricher com dados e condições contratuais
    for v in veiculos:
        # Convert datetime fields
        if isinstance(v.get("created_at"), str):
            v["created_at"] = datetime.fromisoformat(v["created_at"])
        if isinstance(v.get("updated_at"), str):
            v["updated_at"] = datetime.fromisoformat(v["updated_at"])
        
        # Adicionar resumo das condições contratuais
        tipo_contrato = v.get("tipo_contrato", {})
        v["condicoes_resumo"] = {
            "tipo": tipo_contrato.get("tipo", "aluguer_sem_caucao"),
            "valor_semanal": tipo_contrato.get("valor_aluguer"),
            "valor_caucao": tipo_contrato.get("valor_caucao"),
            "periodicidade": tipo_contrato.get("periodicidade", "semanal"),
            "km_incluidos": tipo_contrato.get("km_limite_mensal"),
            "km_extra_preco": tipo_contrato.get("km_extra_preco"),
            "com_slot": tipo_contrato.get("com_slot", False),
            "slot_valor_semanal": tipo_contrato.get("slot_valor_semanal"),
            "slot_valor_mensal": tipo_contrato.get("slot_valor_mensal"),
            "tem_garantia": tipo_contrato.get("tem_garantia", False),
            "data_limite_garantia": tipo_contrato.get("data_limite_garantia")
        }
        
        # Flag para indicar se está disponível sem motorista
        v["disponivel_sem_motorista"] = (
            not v.get("motorista_atribuido") and 
            v.get("disponivel_para_aluguer", False)
        )
    
    return veiculos


@router.post("/public/contacto")
async def public_contacto(contacto_data: Dict[str, Any]):
    """Receive public contact form - sends internal message to partner/manager"""
    
    # Get email config
    config = await db.configuracoes.find_one({"tipo": "email"}, {"_id": 0})
    email_destino = config.get("email_contacto", "info@tvdefleet.com") if config else "info@tvdefleet.com"
    
    # Save contact to database
    contacto_id = f"contacto-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    contacto_data["id"] = contacto_id
    contacto_data["created_at"] = datetime.now(timezone.utc).isoformat()
    contacto_data["status"] = "pendente"
    contacto_data["email_destino"] = email_destino
    
    await db.contactos.insert_one(contacto_data)
    
    # Se for interesse em veículo, criar mensagem interna para o parceiro
    if contacto_data.get("veiculo_id"):
        vehicle = await db.vehicles.find_one({"id": contacto_data["veiculo_id"]}, {"_id": 0})
        
        if vehicle:
            parceiro_id = vehicle.get("parceiro_id")
            destinatarios = []
            
            if parceiro_id:
                # Verificar se parceiro_id existe na colecção de users
                parceiro_user = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
                
                if parceiro_user:
                    # parceiro_id é o ID do utilizador
                    destinatarios.append(parceiro_id)
                    
                    # Buscar dados do parceiro na colecção parceiros pelo mesmo ID
                    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
                    if parceiro and parceiro.get("gestor_associado_id"):
                        destinatarios.append(parceiro["gestor_associado_id"])
                else:
                    # parceiro_id pode ser ID da colecção parceiros
                    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
                    if parceiro:
                        # Adicionar o próprio parceiro_id (pode ter user com mesmo ID)
                        destinatarios.append(parceiro_id)
                        
                        # Verificar se existe user associado a este parceiro
                        parceiro_user = await db.users.find_one({
                            "$or": [
                                {"id": parceiro_id},
                                {"email": parceiro.get("email")}
                            ],
                            "role": "parceiro"
                        }, {"_id": 0})
                        
                        if parceiro_user and parceiro_user["id"] not in destinatarios:
                            destinatarios.append(parceiro_user["id"])
                        
                        # Adicionar gestor associado
                        if parceiro.get("gestor_associado_id"):
                            destinatarios.append(parceiro["gestor_associado_id"])
            
            # Se não tiver parceiro, enviar para admins
            if not destinatarios:
                admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(None)
                destinatarios = [a["id"] for a in admins]
            
            # Criar conversa/mensagem para cada destinatário
            for destinatario_id in destinatarios:
                # Criar conversa
                conversa_id = str(uuid.uuid4())
                conversa = {
                    "id": conversa_id,
                    "tipo": "interesse_veiculo",
                    "assunto": f"🚗 Interesse em Veículo: {vehicle.get('marca')} {vehicle.get('modelo')} ({vehicle.get('matricula')})",
                    "participantes": [destinatario_id, "sistema"],
                    "veiculo_id": vehicle.get("id"),
                    "contacto_externo": {
                        "nome": contacto_data.get("nome"),
                        "email": contacto_data.get("email"),
                        "telefone": contacto_data.get("telefone")
                    },
                    "criada_em": datetime.now(timezone.utc).isoformat(),
                    "ultima_mensagem_em": datetime.now(timezone.utc).isoformat(),
                    "status": "ativo"
                }
                await db.conversas.insert_one(conversa)
                
                # Criar mensagem
                mensagem_texto = f"""📬 **Novo Interesse em Veículo**

**Veículo:** {vehicle.get('marca')} {vehicle.get('modelo')} ({vehicle.get('matricula')})

**Dados do Interessado:**
• Nome: {contacto_data.get('nome')}
• Email: {contacto_data.get('email')}
• Telefone: {contacto_data.get('telefone')}

**Mensagem:**
{contacto_data.get('mensagem', 'Sem mensagem adicional.')}

---
_Este contacto foi recebido através da página pública de veículos._
"""
                
                mensagem = {
                    "id": str(uuid.uuid4()),
                    "conversa_id": conversa_id,
                    "remetente_id": "sistema",
                    "remetente_nome": "Sistema TVDEFleet",
                    "conteudo": mensagem_texto,
                    "tipo": "interesse_veiculo",
                    "lida": False,
                    "criada_em": datetime.now(timezone.utc).isoformat()
                }
                await db.mensagens.insert_one(mensagem)
                
                # Criar notificação
                notificacao = {
                    "id": str(uuid.uuid4()),
                    "user_id": destinatario_id,
                    "tipo": "interesse_veiculo",
                    "titulo": f"Novo interesse: {vehicle.get('marca')} {vehicle.get('modelo')}",
                    "mensagem": f"{contacto_data.get('nome')} demonstrou interesse no veículo {vehicle.get('matricula')}",
                    "link": f"/mensagens?conversa={conversa_id}",
                    "lida": False,
                    "criada_em": datetime.now(timezone.utc).isoformat()
                }
                await db.notificacoes.insert_one(notificacao)
            
            logger.info(f"📧 INTERESSE EM VEÍCULO - Mensagem interna enviada para: {destinatarios}")
    
    # Send notification email to admin (placeholder)
    await enviar_notificacao_contacto(contacto_data, email_destino)
    
    return {"message": "Mensagem enviada com sucesso! Entraremos em contacto em breve.", "id": contacto_id}


async def enviar_notificacao_contacto(contacto: Dict[str, Any], email_destino: str):
    """Send email notification about new contact (placeholder for email service)"""
    # This is a placeholder. In production, integrate with email service like SendGrid, AWS SES, etc.
    logger.info("📧 NOVO CONTACTO RECEBIDO:")
    logger.info(f"   Para: {email_destino}")
    logger.info(f"   De: {contacto.get('nome')} ({contacto.get('email')})")
    logger.info(f"   Assunto: {contacto.get('assunto', 'Contacto do Website')}")
    logger.info(f"   Mensagem: {contacto.get('mensagem')}")
    logger.info(f"   Telefone: {contacto.get('telefone')}")
    
    # Save to email queue for manual sending or integration later
    await db.email_queue.insert_one({
        "to": email_destino,
        "from": "noreply@tvdefleet.com",
        "subject": f"Novo Contacto: {contacto.get('assunto', 'Website')}",
        "body": f"""
        Novo contacto recebido através do website:
        
        Nome: {contacto.get('nome')}
        Email: {contacto.get('email')}
        Telefone: {contacto.get('telefone')}
        Assunto: {contacto.get('assunto', 'N/A')}
        
        Mensagem:
        {contacto.get('mensagem')}
        
        ---
        ID: {contacto.get('id')}
        Data: {contacto.get('created_at')}
        """,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "tipo": "notificacao_contacto"
    })


@router.get("/public/parceiros")
async def get_public_parceiros():
    """Get public list of partners"""
    parceiros = await db.parceiros.find({}, {"_id": 0}).to_list(length=None)
    return parceiros
