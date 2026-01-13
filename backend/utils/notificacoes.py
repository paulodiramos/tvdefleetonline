"""Notification utilities and automated notification generation"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any
import uuid
import logging

logger = logging.getLogger(__name__)


async def criar_notificacao(
    db,
    user_id: str,
    tipo: str,
    titulo: str,
    mensagem: str,
    prioridade: str = "normal",
    link: str = None,
    metadata: Dict[str, Any] = None,
    enviar_email: bool = False,
    emissor_id: str = None,
    contacto_emissor: Dict[str, Any] = None
):
    """Create a notification with optional sender contact info"""
    notificacao = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "tipo": tipo,
        "titulo": titulo,
        "mensagem": mensagem,
        "prioridade": prioridade,
        "lida": False,
        "link": link,
        "metadata": metadata or {},
        "criada_em": datetime.now(timezone.utc).isoformat(),
        "lida_em": None,
        "enviada_email": False,
        "enviada_whatsapp": False,
        "emissor_id": emissor_id,
        "contacto_emissor": contacto_emissor,
        "notas": None,
        "notas_updated_at": None,
        "notas_updated_by": None
    }
    
    # If emissor_id provided but no contacto_emissor, fetch from DB
    if emissor_id and not contacto_emissor:
        emissor = await db.users.find_one(
            {"id": emissor_id}, 
            {"_id": 0, "name": 1, "email": 1, "phone": 1, "role": 1}
        )
        if emissor:
            notificacao["contacto_emissor"] = {
                "nome": emissor.get("name"),
                "email": emissor.get("email"),
                "telefone": emissor.get("phone"),
                "role": emissor.get("role")
            }
    
    await db.notificacoes.insert_one(notificacao)
    logger.info(f"✓ Notification created: {tipo} for user {user_id}")
    
    # Queue email if requested
    if enviar_email:
        await enviar_email_notificacao(db, user_id, titulo, mensagem, link)
    
    return notificacao


async def enviar_email_notificacao(db, user_id: str, titulo: str, mensagem: str, link: str = None):
    """Queue email notification"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    
    email_body = f"""
    {mensagem}
    
    {f'Ver mais: https://seu-dominio.com{link}' if link else ''}
    
    ---
    Esta é uma notificação automática do sistema TVDEFleet.
    """
    
    await db.email_queue.insert_one({
        "to": user["email"],
        "from": "noreply@tvdefleet.com",
        "subject": titulo,
        "body": email_body,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "tipo": "notificacao",
        "user_id": user_id
    })
    
    logger.info(f"✓ Email queued for user {user_id}")


async def check_documentos_expirando(db):
    """Check for expiring documents and create notifications"""
    logger.info("Checking expiring documents...")
    
    hoje = datetime.now(timezone.utc)
    limite_alerta = hoje + timedelta(days=7)  # Alert 7 days before expiration
    
    def parse_date(date_str):
        """Parse date string supporting multiple formats"""
        if not date_str:
            return None
        
        formats = [
            "%Y-%m-%d",      # 2025-12-31
            "%d/%m/%Y",      # 31/12/2025
            "%d-%m-%Y",      # 31-12-2025
            "%Y/%m/%d",      # 2025/12/31
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        
        logger.error(f"Error parsing date {date_str}: no valid format found")
        return None
    
    # Check motoristas documents
    motoristas = await db.motoristas.find({}, {"_id": 0}).to_list(None)
    
    for motorista in motoristas:
        user_id = motorista["id"]
        
        # Check each document type
        docs_to_check = [
            ("cc_validade", "Cartão de Cidadão"),
            ("carta_conducao_validade", "Carta de Condução"),
            ("licenca_tvde_validade", "Licença TVDE")
        ]
        
        for field, doc_name in docs_to_check:
            validade_str = motorista.get(field)
            if not validade_str:
                continue
            
            validade = parse_date(validade_str)
            if not validade:
                continue
            
            if hoje <= validade <= limite_alerta:
                # Check if notification already exists
                existing = await db.notificacoes.find_one({
                    "user_id": user_id,
                    "tipo": "documento_expirando",
                    "metadata.documento": doc_name,
                    "criada_em": {"$gte": (hoje - timedelta(days=1)).isoformat()}
                })
                
                if not existing:
                    dias_restantes = (validade - hoje).days
                    await criar_notificacao(
                        db,
                        user_id=user_id,
                        tipo="documento_expirando",
                        titulo=f"⚠️ {doc_name} a expirar",
                        mensagem=f"O seu {doc_name} expira em {dias_restantes} dias ({validade_str}). Por favor, renove o documento.",
                        prioridade="alta" if dias_restantes <= 3 else "normal",
                        link="/perfil",
                        metadata={"documento": doc_name, "validade": validade_str, "dias_restantes": dias_restantes},
                        enviar_email=True
                    )
                    logger.info(f"✓ Created expiring doc notification for {motorista['name']}: {doc_name}")
            
            except (ValueError, TypeError) as e:
                logger.error(f"Error parsing date {validade_str}: {e}")
                continue
    
    # Check vehicle documents
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(None)
    
    for vehicle in vehicles:
        parceiro_id = vehicle.get("parceiro_id")
        if not parceiro_id:
            continue
        
        docs_to_check = [
            ("seguro_validade", "Seguro"),
            ("inspecao_validade", "Inspeção"),
            ("iuc_validade", "IUC")
        ]
        
        for field, doc_name in docs_to_check:
            validade_str = vehicle.get(field)
            if not validade_str:
                continue
            
            try:
                validade = datetime.strptime(validade_str, "%Y-%m-%d")
                validade = validade.replace(tzinfo=timezone.utc)
                
                if hoje <= validade <= limite_alerta:
                    existing = await db.notificacoes.find_one({
                        "user_id": parceiro_id,
                        "tipo": "documento_veiculo_expirando",
                        "metadata.veiculo_id": vehicle["id"],
                        "metadata.documento": doc_name,
                        "criada_em": {"$gte": (hoje - timedelta(days=1)).isoformat()}
                    })
                    
                    if not existing:
                        dias_restantes = (validade - hoje).days
                        await criar_notificacao(
                            db,
                            user_id=parceiro_id,
                            tipo="documento_veiculo_expirando",
                            titulo=f"⚠️ {doc_name} do veículo {vehicle.get('matricula', 'N/A')}",
                            mensagem=f"O {doc_name} do veículo {vehicle.get('matricula')} expira em {dias_restantes} dias.",
                            prioridade="alta" if dias_restantes <= 3 else "normal",
                            link=f"/veiculos/{vehicle['id']}",
                            metadata={
                                "veiculo_id": vehicle["id"],
                                "matricula": vehicle.get("matricula"),
                                "documento": doc_name,
                                "validade": validade_str
                            },
                            enviar_email=True
                        )
            
            except (ValueError, TypeError) as e:
                logger.error(f"Error parsing vehicle date {validade_str}: {e}")
                continue
    
    logger.info("✓ Finished checking expiring documents")


async def check_recibos_pendentes(db):
    """Check for pending receipts and create notifications"""
    logger.info("Checking pending receipts...")
    
    # Find relatorios with pending receipt status
    relatorios = await db.relatorios_ganhos.find(
        {"status": "pendente_recibo"},
        {"_id": 0}
    ).to_list(None)
    
    for relatorio in relatorios:
        motorista_id = relatorio.get("motorista_id")
        if not motorista_id:
            continue
        
        # Check if notification already created today
        hoje = datetime.now(timezone.utc)
        existing = await db.notificacoes.find_one({
            "user_id": motorista_id,
            "tipo": "recibo_pendente",
            "metadata.relatorio_id": relatorio["id"],
            "criada_em": {"$gte": (hoje - timedelta(days=1)).isoformat()}
        })
        
        if not existing:
            await criar_notificacao(
                db,
                user_id=motorista_id,
                tipo="recibo_pendente",
                titulo="📄 Recibo Pendente",
                mensagem=f"Tem um recibo pendente de envio referente ao período {relatorio.get('periodo_inicio')} - {relatorio.get('periodo_fim')}.",
                prioridade="normal",
                link="/recibos-ganhos",
                metadata={"relatorio_id": relatorio["id"]},
                enviar_email=False
            )
    
    logger.info(f"✓ Checked {len(relatorios)} pending receipts")


async def notificar_documento_validado(db, motorista_id: str, documento: str, status: str):
    """Notify motorista about document validation"""
    emoji = "✅" if status == "aprovado" else "❌"
    titulo = f"{emoji} Documento {status.title()}"
    mensagem = f"O seu documento '{documento}' foi {status}."
    
    await criar_notificacao(
        db,
        user_id=motorista_id,
        tipo="documento_validado",
        titulo=titulo,
        mensagem=mensagem,
        prioridade="normal",
        link="/perfil",
        metadata={"documento": documento, "status": status},
        enviar_email=True
    )


async def notificar_contrato_gerado(db, motorista_id: str, contrato_id: str):
    """Notify motorista about new contract"""
    await criar_notificacao(
        db,
        user_id=motorista_id,
        tipo="contrato_gerado",
        titulo="📝 Novo Contrato Disponível",
        mensagem="Um novo contrato foi gerado para si. Por favor, reveja e assine.",
        prioridade="alta",
        link=f"/contratos/{contrato_id}",
        metadata={"contrato_id": contrato_id},
        enviar_email=True
    )


async def notificar_pagamento_processado(db, motorista_id: str, valor: float, relatorio_id: str):
    """Notify motorista about processed payment"""
    await criar_notificacao(
        db,
        user_id=motorista_id,
        tipo="pagamento_processado",
        titulo="💰 Pagamento Processado",
        mensagem=f"O seu pagamento de €{valor:.2f} foi processado com sucesso.",
        prioridade="normal",
        link="/pagamentos",
        metadata={"valor": valor, "relatorio_id": relatorio_id},
        enviar_email=True
    )
