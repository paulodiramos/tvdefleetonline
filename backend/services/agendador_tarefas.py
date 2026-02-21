"""
Sistema de Tarefas Agendadas para TVDEFleet
Executa tarefas automáticas como envio de alertas de documentos
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import os

logger = logging.getLogger(__name__)

# Configuração
ALERTAS_HORA = int(os.environ.get("ALERTAS_HORA", "9"))  # Hora do dia para enviar alertas
ALERTAS_DIAS_ANTECEDENCIA = int(os.environ.get("ALERTAS_DIAS_ANTECEDENCIA", "30"))
ALERTAS_HABILITADOS = os.environ.get("ALERTAS_AUTOMATICOS", "false").lower() == "true"


class AgendadorTarefas:
    """Classe para gerir tarefas agendadas"""
    
    def __init__(self):
        self.running = False
        self.task: Optional[asyncio.Task] = None
        self.ultima_execucao_alertas: Optional[datetime] = None
    
    async def start(self):
        """Inicia o agendador de tarefas"""
        if self.running:
            logger.warning("Agendador já está em execução")
            return
        
        self.running = True
        self.task = asyncio.create_task(self._loop_principal())
        logger.info("✅ Agendador de tarefas iniciado")
    
    async def stop(self):
        """Para o agendador de tarefas"""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("⏹️ Agendador de tarefas parado")
    
    async def _loop_principal(self):
        """Loop principal que verifica e executa tarefas"""
        while self.running:
            try:
                await self._verificar_tarefas()
                # Verificar a cada 5 minutos
                await asyncio.sleep(300)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Erro no loop do agendador: {e}")
                await asyncio.sleep(60)
    
    async def _verificar_tarefas(self):
        """Verifica se há tarefas para executar"""
        agora = datetime.now(timezone.utc)
        hora_local = agora.hour  # Simplificado, usar hora UTC
        
        # Verificar se deve enviar alertas de documentos
        if ALERTAS_HABILITADOS:
            if hora_local == ALERTAS_HORA:
                # Verificar se já executou hoje
                if self.ultima_execucao_alertas is None or \
                   self.ultima_execucao_alertas.date() < agora.date():
                    await self._enviar_alertas_documentos()
                    self.ultima_execucao_alertas = agora
    
    async def _enviar_alertas_documentos(self):
        """Envia alertas de documentos a expirar por WhatsApp"""
        logger.info("📤 Iniciando envio automático de alertas de documentos...")
        
        try:
            from utils.database import get_database
            from routes.whatsapp_cloud import send_template_message
            
            db = get_database()
            
            agora = datetime.now(timezone.utc)
            limite_data = agora + timedelta(days=ALERTAS_DIAS_ANTECEDENCIA)
            
            # Documentos de motoristas
            motorista_docs = [
                ("carta_conducao", "carta_conducao_validade", "Carta de Condução"),
                ("cartao_cidadao", "cartao_cidadao_validade", "Cartão de Cidadão"),
                ("certificado_tvde", "certificado_tvde_validade", "Certificado TVDE"),
                ("registo_criminal", "registo_criminal_validade", "Registo Criminal"),
            ]
            
            motoristas = await db.motoristas.find(
                {"ativo": True},
                {"_id": 0, "id": 1, "name": 1, "nome": 1, "phone": 1, "whatsapp": 1,
                 "carta_conducao": 1, "carta_conducao_validade": 1,
                 "cartao_cidadao": 1, "cartao_cidadao_validade": 1,
                 "certificado_tvde": 1, "certificado_tvde_validade": 1,
                 "registo_criminal": 1, "registo_criminal_validade": 1}
            ).to_list(500)
            
            enviados = 0
            falhas = 0
            
            for m in motoristas:
                telefone = m.get("whatsapp") or m.get("phone")
                nome = m.get("name") or m.get("nome", "Motorista")
                
                if not telefone:
                    continue
                
                for doc_field, validade_field, doc_nome in motorista_docs:
                    if m.get(doc_field) and m.get(validade_field):
                        try:
                            validade_str = m[validade_field]
                            if isinstance(validade_str, str):
                                validade = datetime.fromisoformat(validade_str.replace('Z', '+00:00'))
                            else:
                                validade = validade_str
                            
                            if validade.tzinfo is None:
                                validade = validade.replace(tzinfo=timezone.utc)
                            
                            # Apenas documentos a expirar (não já expirados)
                            if agora < validade < limite_data:
                                dias_restantes = (validade - agora).days
                                data_formatada = validade.strftime("%d/%m/%Y")
                                
                                parameters = [
                                    {"type": "text", "text": nome},
                                    {"type": "text", "text": doc_nome},
                                    {"type": "text", "text": str(dias_restantes)},
                                    {"type": "text", "text": data_formatada}
                                ]
                                
                                try:
                                    result = await send_template_message(
                                        recipient_phone=telefone,
                                        template_name="documento_expirar",
                                        parameters=parameters
                                    )
                                    
                                    if result.get("success"):
                                        enviados += 1
                                    else:
                                        falhas += 1
                                except Exception as e:
                                    logger.error(f"Erro ao enviar alerta para {nome}: {e}")
                                    falhas += 1
                        except Exception:
                            pass
            
            # Registar execução na BD
            await db.tarefas_agendadas_log.insert_one({
                "tarefa": "alertas_documentos",
                "executado_em": agora.isoformat(),
                "enviados": enviados,
                "falhas": falhas,
                "dias_antecedencia": ALERTAS_DIAS_ANTECEDENCIA
            })
            
            logger.info(f"✅ Alertas enviados: {enviados} sucesso, {falhas} falhas")
            
        except Exception as e:
            logger.error(f"❌ Erro ao enviar alertas de documentos: {e}")


# Instância global do agendador
agendador = AgendadorTarefas()


async def iniciar_agendador():
    """Função para iniciar o agendador (chamar no startup da app)"""
    await agendador.start()


async def parar_agendador():
    """Função para parar o agendador (chamar no shutdown da app)"""
    await agendador.stop()
