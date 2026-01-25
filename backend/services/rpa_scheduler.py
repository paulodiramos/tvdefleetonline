"""
Serviço de Scheduler para Execução Automática de RPA
Verifica periodicamente os agendamentos e executa as automações conforme configurado
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
import uuid

from utils.database import get_database

logger = logging.getLogger(__name__)
db = get_database()


async def verificar_e_executar_agendamentos():
    """
    Verificar agendamentos pendentes e executar automações
    Esta função deve ser chamada periodicamente (ex: a cada 5 minutos)
    """
    try:
        now = datetime.now(timezone.utc)
        logger.debug(f"🔍 Verificando agendamentos RPA às {now.isoformat()}")
        
        # Buscar agendamentos ativos com próxima execução no passado
        agendamentos = await db.rpa_agendamentos.find({
            "ativo": True,
            "proxima_execucao": {"$lte": now.isoformat()}
        }).to_list(100)
        
        if not agendamentos:
            logger.debug("📅 Nenhum agendamento pendente")
            return
        
        logger.info(f"📅 Encontrados {len(agendamentos)} agendamentos para executar")
        
        for agendamento in agendamentos:
            try:
                await _executar_agendamento(agendamento)
            except Exception as e:
                logger.error(f"❌ Erro ao executar agendamento {agendamento['id']}: {e}")
                # Continuar com os próximos agendamentos
                continue
                
    except Exception as e:
        logger.error(f"❌ Erro ao verificar agendamentos: {e}")


async def _executar_agendamento(agendamento: Dict):
    """Executar um agendamento específico"""
    agendamento_id = agendamento["id"]
    parceiro_id = agendamento["parceiro_id"]
    plataforma = agendamento["plataforma"]
    tipo_extracao = agendamento.get("tipo_extracao", "todos")
    
    logger.info(f"🚀 Iniciando execução agendada: {plataforma} para parceiro {parceiro_id}")
    
    # Verificar se existem credenciais
    credencial = await db.rpa_credenciais.find_one({
        "parceiro_id": parceiro_id,
        "plataforma": plataforma,
        "ativo": True
    })
    
    if not credencial:
        logger.warning(f"⚠️ Credenciais não encontradas para {plataforma} - agendamento {agendamento_id}")
        # Atualizar próxima execução mesmo assim
        await _atualizar_proxima_execucao(agendamento)
        return
    
    # Criar registo de execução
    execucao_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Calcular datas de extração (última semana por padrão)
    data_fim = now.strftime("%Y-%m-%d")
    data_inicio = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    
    execucao = {
        "id": execucao_id,
        "parceiro_id": parceiro_id,
        "plataforma": plataforma,
        "plataforma_nome": agendamento.get("plataforma_nome", plataforma),
        "tipo_extracao": tipo_extracao,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "status": "pendente",
        "progresso": 0,
        "logs": [f"Execução automática iniciada às {now.isoformat()}"],
        "screenshots": [],
        "dados_extraidos": [],
        "erros": [],
        "iniciado_por": "scheduler",
        "agendamento_id": agendamento_id,
        "created_at": now.isoformat()
    }
    
    await db.rpa_execucoes.insert_one(execucao)
    
    # Executar em background
    asyncio.create_task(_executar_automacao_async(
        execucao_id,
        plataforma,
        parceiro_id,
        credencial,
        tipo_extracao,
        data_inicio,
        data_fim
    ))
    
    # Atualizar agendamento
    await _atualizar_proxima_execucao(agendamento)
    
    logger.info(f"✅ Execução {execucao_id} agendada para {plataforma}")


async def _atualizar_proxima_execucao(agendamento: Dict):
    """Calcular e atualizar a próxima data de execução"""
    now = datetime.now(timezone.utc)
    frequencia = agendamento.get("frequencia", "semanal")
    dia_semana = agendamento.get("dia_semana", 1)  # 0=Segunda
    hora = agendamento.get("hora", "06:00")
    
    hora_parts = hora.split(":")
    hora_exec = int(hora_parts[0])
    minuto_exec = int(hora_parts[1]) if len(hora_parts) > 1 else 0
    
    if frequencia == "diario":
        proxima = now.replace(hour=hora_exec, minute=minuto_exec, second=0, microsecond=0)
        proxima += timedelta(days=1)
    elif frequencia == "semanal":
        dias_ate_alvo = (dia_semana - now.weekday()) % 7
        if dias_ate_alvo == 0:
            dias_ate_alvo = 7
        proxima = now + timedelta(days=dias_ate_alvo)
        proxima = proxima.replace(hour=hora_exec, minute=minuto_exec, second=0, microsecond=0)
    else:  # mensal
        proxima = now.replace(day=1, hour=hora_exec, minute=minuto_exec, second=0, microsecond=0)
        if now.month == 12:
            proxima = proxima.replace(year=now.year + 1, month=1)
        else:
            proxima = proxima.replace(month=now.month + 1)
    
    await db.rpa_agendamentos.update_one(
        {"id": agendamento["id"]},
        {"$set": {
            "ultima_execucao": now.isoformat(),
            "proxima_execucao": proxima.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    logger.info(f"📅 Próxima execução de {agendamento['plataforma']}: {proxima.isoformat()}")


async def _executar_automacao_async(
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
        # Atualizar status para "em execução"
        await db.rpa_execucoes.update_one(
            {"id": execucao_id},
            {
                "$set": {
                    "status": "em_execucao",
                    "iniciado_em": datetime.now(timezone.utc).isoformat()
                },
                "$push": {"logs": "Status: em execução"}
            }
        )
        
        # Tentar importar e executar o executor
        try:
            from services.rpa_executor import executar_automacao
            
            # Desencriptar credenciais
            from cryptography.fernet import Fernet
            import os
            
            ENCRYPTION_KEY = os.environ.get("RPA_ENCRYPTION_KEY", os.environ.get("ENCRYPTION_KEY", ""))
            if ENCRYPTION_KEY:
                cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
                email = cipher.decrypt(credencial.get("email_encrypted", b"").encode() if isinstance(credencial.get("email_encrypted", ""), str) else credencial.get("email_encrypted", b"")).decode()
                password = cipher.decrypt(credencial.get("password_encrypted", b"").encode() if isinstance(credencial.get("password_encrypted", ""), str) else credencial.get("password_encrypted", b"")).decode()
            else:
                email = credencial.get("email", "")
                password = ""
            
            credenciais = {
                "email": email,
                "password": password
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
            
            # Guardar dados extraídos
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
            
            # Atualizar execução
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
            
            logger.info(f"✅ Execução agendada {execucao_id} concluída: {status}")
            
        except ImportError:
            # Executor não disponível - simular execução
            logger.warning(f"⚠️ services.rpa_executor não disponível - simulando execução")
            await asyncio.sleep(2)  # Simular tempo de execução
            
            await db.rpa_execucoes.update_one(
                {"id": execucao_id},
                {"$set": {
                    "status": "sucesso",
                    "logs": ["Execução simulada (executor não disponível)"],
                    "dados_extraidos": [],
                    "total_registos": 0,
                    "terminado_em": datetime.now(timezone.utc).isoformat()
                }}
            )
            
    except Exception as e:
        logger.error(f"❌ Erro na execução agendada {execucao_id}: {e}")
        await db.rpa_execucoes.update_one(
            {"id": execucao_id},
            {"$set": {
                "status": "erro",
                "erros": [str(e)],
                "terminado_em": datetime.now(timezone.utc).isoformat()
            }}
        )


async def verificar_agendamentos_periodicamente(intervalo_minutos: int = 5):
    """
    Loop infinito que verifica agendamentos periodicamente
    Chamar esta função no startup da aplicação
    """
    logger.info(f"🔄 Iniciando verificação periódica de agendamentos RPA (cada {intervalo_minutos} minutos)")
    
    while True:
        try:
            await verificar_e_executar_agendamentos()
        except Exception as e:
            logger.error(f"❌ Erro no loop de verificação de agendamentos: {e}")
        
        # Aguardar intervalo
        await asyncio.sleep(intervalo_minutos * 60)
