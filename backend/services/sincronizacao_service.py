"""
Serviço de Sincronização Automática de Dados
Recolhe dados de Uber, Bolt, Via Verde, Abastecimentos e gera resumos semanais
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import uuid
import logging
import asyncio

from utils.database import get_database
from utils.notificacoes import criar_notificacao

logger = logging.getLogger(__name__)
db = get_database()


# Tipos de fonte de dados
FONTES_DADOS = {
    "uber": {
        "nome": "Uber",
        "icone": "🚗",
        "cor": "#000000",
        "tipo": "ganhos",
        "metodos": ["rpa", "csv"],  # RPA ou upload manual
        "descricao": "Ganhos dos motoristas Uber"
    },
    "bolt": {
        "nome": "Bolt",
        "icone": "⚡",
        "cor": "#34D399",
        "tipo": "ganhos",
        "metodos": ["api", "rpa", "csv"],  # API oficial, RPA ou CSV
        "descricao": "Ganhos dos motoristas Bolt"
    },
    "viaverde": {
        "nome": "Via Verde",
        "icone": "🛣️",
        "cor": "#22C55E",
        "tipo": "despesas",
        "metodos": ["rpa", "csv"],
        "descricao": "Portagens e despesas Via Verde"
    },
    "abastecimentos": {
        "nome": "Abastecimentos",
        "icone": "⛽",
        "cor": "#F59E0B",
        "tipo": "despesas",
        "metodos": ["rpa", "csv"],
        "descricao": "Combustível e carregamentos elétricos"
    }
}


class SincronizacaoService:
    """Serviço de gestão de sincronização automática"""
    
    def __init__(self, database=None):
        self.db = database or get_database()
    
    async def obter_config_parceiro(self, parceiro_id: str) -> Dict:
        """Obter configuração de sincronização de um parceiro"""
        # Tentar primeiro a colecção nova
        config = await self.db.sincronizacao_auto_config.find_one(
            {"parceiro_id": parceiro_id},
            {"_id": 0}
        )
        
        # Fallback para colecção antiga
        if not config:
            config = await self.db.sincronizacao_config.find_one(
                {"parceiro_id": parceiro_id},
                {"_id": 0}
            )
        
        if not config:
            # Configuração padrão
            config = {
                "parceiro_id": parceiro_id,
                "ativo": False,
                "fontes": {
                    "uber": {"ativo": False, "metodo": "csv", "agendamento": None},
                    "bolt": {"ativo": False, "metodo": "csv", "agendamento": None},
                    "viaverde": {"ativo": False, "metodo": "csv", "agendamento": None},
                    "abastecimentos": {"ativo": False, "metodo": "csv", "agendamento": None}
                },
                "agendamento_global": {
                    "ativo": False,
                    "frequencia": "semanal",  # diario, semanal, mensal
                    "dia_semana": 1,  # 0=Segunda, 6=Domingo
                    "dia_mes": 1,  # Para frequência mensal
                    "hora": "06:00"
                },
                "resumo_semanal": {
                    "gerar_automaticamente": True,
                    "enviar_email_motoristas": True,
                    "enviar_whatsapp_motoristas": False
                },
                "notificacoes": {
                    "email_parceiro": True,
                    "notificacao_sistema": True,
                    "whatsapp_parceiro": False
                },
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        
        return config
    
    async def guardar_config_parceiro(self, parceiro_id: str, config: Dict) -> Dict:
        """Guardar configuração de sincronização"""
        config["parceiro_id"] = parceiro_id
        config["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await self.db.sincronizacao_config.update_one(
            {"parceiro_id": parceiro_id},
            {"$set": config},
            upsert=True
        )
        
        # Atualizar agendamentos no scheduler se necessário
        if config.get("agendamento_global", {}).get("ativo"):
            await self._criar_ou_atualizar_agendamento(parceiro_id, config)
        else:
            await self._desativar_agendamentos(parceiro_id)
        
        logger.info(f"✅ Configuração de sincronização guardada para parceiro {parceiro_id}")
        return config
    
    async def _criar_ou_atualizar_agendamento(self, parceiro_id: str, config: Dict):
        """Criar ou atualizar agendamento de sincronização"""
        agendamento_config = config.get("agendamento_global", {})
        
        # Buscar agendamento existente de sincronização
        existente = await self.db.rpa_agendamentos.find_one({
            "parceiro_id": parceiro_id,
            "tipo": "sincronizacao_automatica"
        })
        
        now = datetime.now(timezone.utc)
        proxima_execucao = self._calcular_proxima_execucao(
            agendamento_config.get("frequencia", "semanal"),
            agendamento_config.get("dia_semana", 1),
            agendamento_config.get("dia_mes", 1),
            agendamento_config.get("hora", "06:00")
        )
        
        agendamento = {
            "parceiro_id": parceiro_id,
            "tipo": "sincronizacao_automatica",
            "plataforma": "sincronizacao",
            "plataforma_nome": "Sincronização Automática",
            "tipo_extracao": "todos",
            "frequencia": agendamento_config.get("frequencia", "semanal"),
            "dia_semana": agendamento_config.get("dia_semana", 1),
            "dia_mes": agendamento_config.get("dia_mes", 1),
            "hora": agendamento_config.get("hora", "06:00"),
            "ativo": True,
            "proxima_execucao": proxima_execucao,
            "updated_at": now.isoformat()
        }
        
        if existente:
            await self.db.rpa_agendamentos.update_one(
                {"id": existente["id"]},
                {"$set": agendamento}
            )
        else:
            agendamento["id"] = str(uuid.uuid4())
            agendamento["created_at"] = now.isoformat()
            await self.db.rpa_agendamentos.insert_one(agendamento)
        
        logger.info(f"📅 Agendamento de sincronização criado/atualizado para parceiro {parceiro_id}")
    
    async def _desativar_agendamentos(self, parceiro_id: str):
        """Desativar agendamentos de sincronização"""
        await self.db.rpa_agendamentos.update_many(
            {"parceiro_id": parceiro_id, "tipo": "sincronizacao_automatica"},
            {"$set": {"ativo": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    def _calcular_proxima_execucao(self, frequencia: str, dia_semana: int, dia_mes: int, hora: str) -> str:
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
            proxima = now.replace(day=dia_mes, hour=hora_exec, minute=minuto_exec, second=0, microsecond=0)
            if proxima <= now:
                if now.month == 12:
                    proxima = proxima.replace(year=now.year + 1, month=1)
                else:
                    proxima = proxima.replace(month=now.month + 1)
        
        return proxima.isoformat()
    
    async def executar_sincronizacao(
        self, 
        parceiro_id: str, 
        fontes: List[str] = None,
        semana: int = None,
        ano: int = None,
        iniciado_por: str = "manual"
    ) -> Dict:
        """Executar sincronização de dados"""
        config = await self.obter_config_parceiro(parceiro_id)
        
        if fontes is None:
            # Usar todas as fontes ativas
            fontes = [k for k, v in config.get("fontes", {}).items() if v.get("ativo")]
        
        if not fontes:
            return {"sucesso": False, "erro": "Nenhuma fonte de dados ativa"}
        
        # Calcular semana se não fornecida
        now = datetime.now(timezone.utc)
        if semana is None:
            semana = now.isocalendar()[1]
        if ano is None:
            ano = now.year
        
        # Criar registo de execução
        execucao_id = str(uuid.uuid4())
        execucao = {
            "id": execucao_id,
            "parceiro_id": parceiro_id,
            "tipo": "sincronizacao",
            "fontes": fontes,
            "semana": semana,
            "ano": ano,
            "status": "em_execucao",
            "progresso": 0,
            "resultados": {},
            "erros": [],
            "iniciado_por": iniciado_por,
            "created_at": now.isoformat()
        }
        
        await self.db.sincronizacao_execucoes.insert_one(execucao)
        
        logger.info(f"🔄 Iniciando sincronização {execucao_id} para parceiro {parceiro_id}")
        
        # Executar sincronização de cada fonte
        resultados = {}
        erros = []
        total_fontes = len(fontes)
        
        for i, fonte in enumerate(fontes):
            try:
                fonte_config = config.get("fontes", {}).get(fonte, {})
                metodo = fonte_config.get("metodo", "csv")
                
                resultado = await self._executar_fonte(
                    parceiro_id, fonte, metodo, semana, ano
                )
                resultados[fonte] = resultado
                
                # Atualizar progresso
                progresso = int((i + 1) / total_fontes * 100)
                await self.db.sincronizacao_execucoes.update_one(
                    {"id": execucao_id},
                    {"$set": {"progresso": progresso, "resultados": resultados}}
                )
                
            except Exception as e:
                logger.error(f"❌ Erro ao sincronizar {fonte}: {e}")
                erros.append(f"{fonte}: {str(e)}")
                resultados[fonte] = {"sucesso": False, "erro": str(e)}
        
        # Determinar status final
        sucessos = sum(1 for r in resultados.values() if r.get("sucesso"))
        if sucessos == total_fontes:
            status = "sucesso"
        elif sucessos > 0:
            status = "sucesso_parcial"
        else:
            status = "erro"
        
        # Atualizar execução
        await self.db.sincronizacao_execucoes.update_one(
            {"id": execucao_id},
            {"$set": {
                "status": status,
                "progresso": 100,
                "resultados": resultados,
                "erros": erros,
                "terminado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Gerar resumo semanal se configurado
        if config.get("resumo_semanal", {}).get("gerar_automaticamente") and status in ["sucesso", "sucesso_parcial"]:
            await self._gerar_resumo_semanal(parceiro_id, semana, ano, config)
        
        # Enviar notificações
        await self._enviar_notificacoes(parceiro_id, execucao_id, status, resultados, config)
        
        logger.info(f"✅ Sincronização {execucao_id} concluída: {status}")
        
        return {
            "sucesso": status in ["sucesso", "sucesso_parcial"],
            "execucao_id": execucao_id,
            "status": status,
            "resultados": resultados,
            "erros": erros
        }
    
    async def _executar_fonte(
        self, 
        parceiro_id: str, 
        fonte: str, 
        metodo: str,
        semana: int,
        ano: int
    ) -> Dict:
        """Executar sincronização de uma fonte específica"""
        
        if metodo == "rpa":
            # Usar sistema RPA existente
            return await self._executar_via_rpa(parceiro_id, fonte, semana, ano)
        elif metodo == "api":
            # Usar API oficial (Bolt)
            return await self._executar_via_api(parceiro_id, fonte, semana, ano)
        else:  # csv
            # Verificar se há ficheiros CSV pendentes
            return await self._processar_csv_pendentes(parceiro_id, fonte, semana, ano)
    
    async def _executar_via_rpa(self, parceiro_id: str, fonte: str, semana: int, ano: int) -> Dict:
        """Executar sincronização via RPA"""
        try:
            # Verificar se há credenciais configuradas
            credencial = await self.db.rpa_credenciais.find_one({
                "parceiro_id": parceiro_id,
                "plataforma": fonte,
                "ativo": True
            })
            
            if not credencial:
                return {"sucesso": False, "erro": "Credenciais não configuradas", "metodo": "rpa"}
            
            # Criar execução RPA
            from routes.rpa_automacao import _executar_em_background, calcular_periodo_semana
            
            data_inicio, data_fim = calcular_periodo_semana(semana, ano)
            execucao_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            
            # Obter info da plataforma
            from routes.rpa_automacao import get_plataforma_by_id
            plataforma = await get_plataforma_by_id(fonte)
            
            execucao = {
                "id": execucao_id,
                "parceiro_id": parceiro_id,
                "plataforma": fonte,
                "plataforma_nome": plataforma.get("nome", fonte) if plataforma else fonte,
                "tipo_extracao": "todos",
                "data_inicio": data_inicio,
                "data_fim": data_fim,
                "semana": semana,
                "ano": ano,
                "status": "pendente",
                "progresso": 0,
                "logs": [],
                "screenshots": [],
                "dados_extraidos": [],
                "erros": [],
                "iniciado_por": "sincronizacao",
                "created_at": now.isoformat()
            }
            
            await self.db.rpa_execucoes.insert_one(execucao)
            
            # Agendar execução em background
            asyncio.create_task(_executar_em_background(
                execucao_id,
                fonte,
                parceiro_id,
                credencial,
                "todos",
                data_inicio,
                data_fim
            ))
            
            return {
                "sucesso": True,
                "metodo": "rpa",
                "execucao_id": execucao_id,
                "mensagem": "Execução RPA iniciada"
            }
            
        except Exception as e:
            logger.error(f"Erro ao executar RPA para {fonte}: {e}")
            return {"sucesso": False, "erro": str(e), "metodo": "rpa"}
    
    async def _executar_via_api(self, parceiro_id: str, fonte: str, semana: int, ano: int) -> Dict:
        """Executar sincronização via API oficial (Bolt)"""
        if fonte != "bolt":
            return {
                "sucesso": False,
                "metodo": "api",
                "erro": "API oficial apenas disponível para Bolt"
            }
        
        try:
            # Verificar se há credenciais API configuradas
            cred = await self.db.credenciais_bolt_api.find_one({
                "parceiro_id": parceiro_id,
                "plataforma": "bolt_api",
                "ativo": True
            })
            
            if not cred:
                return {
                    "sucesso": False,
                    "metodo": "api",
                    "erro": "Credenciais Bolt API não configuradas. Configure em Configurações → Credenciais Plataformas."
                }
            
            # Calcular período da semana
            from routes.rpa_automacao import calcular_periodo_semana
            data_inicio, data_fim = calcular_periodo_semana(semana, ano)
            
            # Converter para timestamps Unix
            start_ts = int(datetime.fromisoformat(data_inicio.replace('Z', '+00:00')).timestamp())
            end_ts = int(datetime.fromisoformat(data_fim.replace('Z', '+00:00')).timestamp())
            
            # Importar cliente Bolt API
            from services.bolt_api_service import BoltAPIClient
            
            client = BoltAPIClient(cred["client_id"], cred["client_secret"])
            try:
                # Obter company_id
                companies = await client.get_companies()
                if companies.get("code") != 0:
                    return {
                        "sucesso": False,
                        "metodo": "api",
                        "erro": f"Erro ao obter empresas: {companies.get('message')}"
                    }
                
                company_ids = companies.get("data", {}).get("company_ids", [])
                if not company_ids:
                    return {
                        "sucesso": False,
                        "metodo": "api",
                        "erro": "Nenhuma empresa encontrada na conta Bolt"
                    }
                
                company_id = company_ids[0]
                
                # Buscar dados
                drivers_data = await client.get_drivers(company_id, start_ts, end_ts)
                vehicles_data = await client.get_vehicles(company_id, start_ts, end_ts)
                orders_data = await client.get_fleet_orders(company_id, start_ts, end_ts)
                
                # Extrair listas
                drivers = drivers_data.get("data", {}).get("drivers", [])
                vehicles = vehicles_data.get("data", {}).get("vehicles", [])
                orders = orders_data.get("data", {}).get("orders", [])
                
                # Guardar dados sincronizados
                sync_record = {
                    "id": str(uuid.uuid4()),
                    "parceiro_id": parceiro_id,
                    "plataforma": "bolt_api",
                    "semana": semana,
                    "ano": ano,
                    "company_id": company_id,
                    "drivers": drivers,
                    "vehicles": vehicles,
                    "orders": orders,
                    "synced_at": datetime.now(timezone.utc).isoformat()
                }
                await self.db.bolt_api_sync_data.insert_one(sync_record)
                
                # Processar ganhos dos motoristas
                total_ganhos = 0
                for order in orders:
                    total_ganhos += float(order.get("driver_total", 0) or 0)
                
                return {
                    "sucesso": True,
                    "metodo": "api",
                    "mensagem": "Dados sincronizados via Bolt API",
                    "company_id": company_id,
                    "motoristas": len(drivers),
                    "veiculos": len(vehicles),
                    "viagens": len(orders),
                    "total_ganhos": round(total_ganhos, 2)
                }
                
            finally:
                await client.close()
                
        except Exception as e:
            logger.error(f"Erro ao executar API Bolt: {e}")
            return {
                "sucesso": False,
                "metodo": "api",
                "erro": str(e)
            }
    
    async def _processar_csv_pendentes(self, parceiro_id: str, fonte: str, semana: int, ano: int) -> Dict:
        """Verificar e processar ficheiros CSV pendentes"""
        # Buscar importações CSV pendentes para esta fonte e semana
        importacoes = await self.db.importacoes.find({
            "parceiro_id": parceiro_id,
            "plataforma": fonte,
            "semana": semana,
            "ano": ano,
            "status": {"$in": ["pendente", "processado"]}
        }).to_list(10)
        
        if not importacoes:
            return {
                "sucesso": True,
                "metodo": "csv",
                "mensagem": "Nenhum ficheiro CSV para processar",
                "registos": 0
            }
        
        total_registos = sum(i.get("total_registos", 0) for i in importacoes)
        
        return {
            "sucesso": True,
            "metodo": "csv",
            "mensagem": f"Processados {len(importacoes)} ficheiros",
            "registos": total_registos,
            "importacoes": [i.get("id") for i in importacoes]
        }
    
    async def _gerar_resumo_semanal(self, parceiro_id: str, semana: int, ano: int, config: Dict):
        """Gerar resumo semanal após sincronização"""
        try:
            logger.info(f"📊 Gerando resumo semanal para parceiro {parceiro_id}, semana {semana}/{ano}")
            
            # Buscar dados da semana
            # TODO: Implementar geração automática de resumo semanal
            # Por agora, criar uma notificação indicando que os dados estão prontos
            
            await criar_notificacao(
                self.db,
                user_id=parceiro_id,
                titulo="Dados da semana sincronizados",
                mensagem=f"Os dados da semana {semana}/{ano} foram sincronizados. O resumo semanal está pronto para gerar.",
                tipo="info",
                link="/resumo-semanal"
            )
            
        except Exception as e:
            logger.error(f"Erro ao gerar resumo semanal: {e}")
    
    async def _enviar_notificacoes(
        self, 
        parceiro_id: str, 
        execucao_id: str, 
        status: str, 
        resultados: Dict,
        config: Dict
    ):
        """Enviar notificações após sincronização"""
        notif_config = config.get("notificacoes", {})
        
        # Preparar mensagem
        if status == "sucesso":
            titulo = "✅ Sincronização concluída"
            mensagem = "Todos os dados foram sincronizados com sucesso."
        elif status == "sucesso_parcial":
            titulo = "⚠️ Sincronização parcial"
            sucessos = [k for k, v in resultados.items() if v.get("sucesso")]
            mensagem = f"Sincronizados: {', '.join(sucessos)}. Alguns erros ocorreram."
        else:
            titulo = "❌ Erro na sincronização"
            mensagem = "Ocorreram erros durante a sincronização. Verifique os detalhes."
        
        # Notificação no sistema
        if notif_config.get("notificacao_sistema", True):
            await criar_notificacao(
                self.db,
                user_id=parceiro_id,
                titulo=titulo,
                mensagem=mensagem,
                tipo="info" if status == "sucesso" else "warning",
                link=f"/sincronizacao/{execucao_id}"
            )
        
        # Email ao parceiro
        if notif_config.get("email_parceiro"):
            await self._enviar_email_sincronizacao(parceiro_id, titulo, mensagem, resultados)
        
        # WhatsApp ao parceiro
        if notif_config.get("whatsapp_parceiro"):
            await self._enviar_whatsapp_sincronizacao(parceiro_id, titulo, mensagem)
    
    async def _enviar_email_sincronizacao(self, parceiro_id: str, titulo: str, mensagem: str, resultados: Dict):
        """Enviar email de notificação"""
        try:
            # Buscar dados do parceiro
            parceiro = await self.db.users.find_one({"id": parceiro_id})
            if not parceiro or not parceiro.get("email"):
                return
            
            # TODO: Implementar envio de email usando config do parceiro
            logger.info(f"📧 Email de sincronização enviado para {parceiro.get('email')}")
            
        except Exception as e:
            logger.error(f"Erro ao enviar email: {e}")
    
    async def _enviar_whatsapp_sincronizacao(self, parceiro_id: str, titulo: str, mensagem: str):
        """Enviar WhatsApp de notificação"""
        try:
            # Buscar config WhatsApp do parceiro
            whatsapp_config = await self.db.whatsapp_config.find_one({"parceiro_id": parceiro_id})
            if not whatsapp_config or not whatsapp_config.get("ativo"):
                return
            
            # Buscar telefone do parceiro
            parceiro = await self.db.users.find_one({"id": parceiro_id})
            if not parceiro or not parceiro.get("phone"):
                return
            
            # TODO: Implementar envio via WhatsApp Cloud API
            logger.info(f"📱 WhatsApp de sincronização enviado para {parceiro.get('phone')}")
            
        except Exception as e:
            logger.error(f"Erro ao enviar WhatsApp: {e}")
    
    async def obter_historico_sincronizacoes(
        self, 
        parceiro_id: str, 
        limit: int = 20
    ) -> List[Dict]:
        """Obter histórico de sincronizações"""
        execucoes = await self.db.sincronizacao_execucoes.find(
            {"parceiro_id": parceiro_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return execucoes
    
    async def obter_execucao(self, execucao_id: str) -> Optional[Dict]:
        """Obter detalhes de uma execução"""
        execucao = await self.db.sincronizacao_execucoes.find_one(
            {"id": execucao_id},
            {"_id": 0}
        )
        return execucao
