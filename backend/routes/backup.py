"""
Rotas para Sistema de Backup Completo (Admin Only)
Permite exportar e importar TODOS os dados do sistema
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
from bson import ObjectId
import logging
import uuid
import json

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/backup", tags=["Backup"])
logger = logging.getLogger(__name__)
db = get_database()


def convert_objectid(obj):
    """Converter ObjectId e outros tipos não serializáveis para JSON"""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: convert_objectid(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectid(item) for item in obj]
    elif isinstance(obj, bytes):
        return obj.decode('utf-8', errors='ignore')
    return obj


# Lista de todas as coleções importantes para backup
COLECOES_BACKUP = [
    # Utilizadores e Autenticação
    "users",
    "motoristas",
    "parceiros",
    "gestor_parceiro",
    
    # Veículos
    "vehicles",
    "cartoes_frota",
    "historico_custos_veiculo",
    "turnos_veiculos",
    
    # Contratos
    "contratos",
    "contratos_motorista",
    "templates_contrato",
    "templates_contratos",
    
    # Plataformas e RPA
    "plataformas",
    "plataformas_rpa",
    "rpa_plataformas",
    "rpa_rascunhos",
    "rpa_designs",
    "designs_rpa",
    "rpa_scripts",
    "rpa_credenciais",
    "rpa_credenciais_central",
    "rpa_execucoes",
    "rpa_agendamentos",
    "rpa_importacoes",
    "registos_rpa",
    "execucoes_rpa",
    "execucoes_rpa_uber",
    "execucoes_rpa_viaverde",
    "importacoes_rpa",
    "rpa_combustivel",
    "rpa_gps",
    "rpa_outro",
    "rpa_dados_bolt",
    "rpa_carregamento_eletrico",
    
    # Credenciais Plataformas
    "credenciais_plataforma",
    "credenciais_plataformas",
    "credenciais_parceiro",
    "credenciais_bolt_api",
    "credenciais_uber",
    
    # Configurações
    "configuracoes",
    "configuracoes_sistema",
    "configuracoes_api",
    "configuracoes_sincronizacao",
    "config_alertas_custos",
    "config_comissoes_parceiro",
    "csv_configuracoes",
    "relatorio_config",
    "sincronizacao_auto_config",
    
    # Planos e Subscriçoes
    "planos",
    "planos_sistema",
    "planos_motorista",
    "planos_usuarios",
    "categorias_plano",
    "subscricoes",
    "subscriptions",
    "motorista_plano_assinaturas",
    "faturas_subscricao",
    
    # Comissões
    "escalas_comissao",
    "classificacoes_motoristas",
    
    # Tickets
    "tickets",
    "mensagens",
    "conversas",
    
    # Despesas e Receitas
    "despesas",
    "despesas_combustivel",
    "despesas_fornecedor",
    "combustivel_eletrico",
    "abastecimentos_combustivel",
    "expenses",
    "revenues",
    "partner_expenses",
    "partner_revenues",
    
    # Via Verde
    "portagens_viaverde",
    "viaverde_movimentos",
    "viaverde_acumulado",
    "dados_via_verde",
    
    # Ganhos e Viagens
    "ganhos_bolt",
    "ganhos_uber_historico",
    "viagens_bolt",
    "viagens_uber",
    "dados_bolt",
    "dados_uber",
    "bolt_api_sync_data",
    
    # Relatórios
    "relatorios_semanais",
    "resumos_semanais",
    "resumos_semanais_rpa",
    "historico_relatorios",
    "relatorios_ganhos",
    "status_relatorios",
    "totais_empresa",
    
    # Ajustes e Extras
    "ajustes_semanais",
    "extras_motorista",
    
    # Pagamentos e Recibos
    "pagamentos",
    "pagamentos_recibos",
    "recibos",
    
    # Alertas e Notificações
    "alertas",
    "notificacoes",
    
    # Automações
    "automacoes",
    "execucoes_automacao",
    "sincronizacao_auto_execucoes",
    
    # Fornecedores
    "fornecedores",
    
    # Vistorias
    "vistorias",
    "vistorias_mobile",
    
    # GPS
    "trajetos_gps",
    
    # Logs
    "logs_sincronizacao",
    "logs_sincronizacao_parceiro",
    "logs_importacao",
    "logs_importacao_csv",
    "logs_auditoria",
    
    # Histórico
    "historico_atribuicoes",
    
    # Ficheiros e Importações
    "ficheiros_importados",
    "importacoes_despesas",
    
    # Ponto
    "registos_ponto",
    "definicoes_motorista",
    
    # Terabox
    "terabox_credentials",
    "terabox_pastas",
    "terabox_ficheiros",
    "terabox_sync_logs",
    
    # WhatsApp
    "whatsapp_log",
    "whatsapp_logs",
    
    # Contactos
    "contactos",
    
    # Pedidos
    "pedidos_adicao",
    
    # Email
    "email_queue",
    
    # Parceiro Config
    "parceiro_funcionalidades",
    "parceiro_plataformas",
    
    # Módulos
    "modulos_sistema",
    
    # Backups anteriores
    "backups"
]


@router.get("/completo")
async def exportar_backup_completo(
    current_user: dict = Depends(get_current_user)
):
    """Exportar backup COMPLETO de TODA a base de dados (Admin only)
    
    Inclui:
    - Utilizadores, motoristas, parceiros, gestores
    - Veículos e cartões frota
    - Contratos e templates
    - Plataformas e configurações RPA
    - Credenciais de plataformas
    - Configurações do sistema
    - Planos, subscriçoes e comissões
    - Tickets e mensagens
    - Despesas, receitas, combustíveis
    - Portagens Via Verde
    - Ganhos e viagens (Uber, Bolt)
    - Relatórios e resumos semanais
    - Pagamentos e recibos
    - Alertas e notificações
    - Automações
    - Vistorias e GPS
    - Logs e histórico
    - TUDO!
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode exportar backup completo")
    
    logger.info(f"Iniciando backup completo por {current_user['id']}")
    
    backup_data = {
        "versao": "2.0",
        "tipo": "backup_sistema_completo",
        "exportado_em": datetime.now(timezone.utc).isoformat(),
        "exportado_por": {
            "id": current_user["id"],
            "email": current_user.get("email"),
            "nome": current_user.get("name")
        },
        "dados": {},
        "metadados": {
            "total_colecoes": 0,
            "total_documentos": 0,
            "colecoes_exportadas": []
        }
    }
    
    total_docs = 0
    
    for colecao in COLECOES_BACKUP:
        try:
            # Verificar se a coleção existe e tem documentos
            count = await db[colecao].count_documents({})
            if count > 0:
                # Exportar todos os documentos (excluindo _id do MongoDB)
                docs = await db[colecao].find({}).to_list(None)
                # Converter ObjectId e outros tipos
                docs_clean = []
                for doc in docs:
                    doc.pop('_id', None)  # Remover _id
                    docs_clean.append(convert_objectid(doc))
                backup_data["dados"][colecao] = docs_clean
                backup_data["metadados"]["colecoes_exportadas"].append({
                    "nome": colecao,
                    "documentos": count
                })
                total_docs += count
                logger.debug(f"Exportado {colecao}: {count} documentos")
        except Exception as e:
            logger.warning(f"Erro ao exportar {colecao}: {str(e)}")
            continue
    
    backup_data["metadados"]["total_colecoes"] = len(backup_data["metadados"]["colecoes_exportadas"])
    backup_data["metadados"]["total_documentos"] = total_docs
    
    # Registar backup
    await db.backups.insert_one({
        "id": str(uuid.uuid4()),
        "tipo": "completo",
        "exportado_em": datetime.now(timezone.utc).isoformat(),
        "exportado_por": current_user["id"],
        "total_colecoes": backup_data["metadados"]["total_colecoes"],
        "total_documentos": total_docs
    })
    
    logger.info(f"Backup completo concluído: {backup_data['metadados']['total_colecoes']} coleções, {total_docs} documentos")
    
    return backup_data


class ImportarBackupRequest(BaseModel):
    versao: str
    dados: Dict[str, List[Dict[str, Any]]]
    substituir_existente: bool = False
    colecoes_selecionadas: Optional[List[str]] = None  # Se None, importa tudo


@router.post("/importar")
async def importar_backup_completo(
    data: ImportarBackupRequest,
    current_user: dict = Depends(get_current_user)
):
    """Importar backup completo (Admin only)
    
    Opções:
    - substituir_existente: True para apagar dados existentes antes de importar
    - colecoes_selecionadas: Lista de coleções específicas para importar (None = todas)
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode importar backup")
    
    logger.info(f"Iniciando importação de backup por {current_user['id']}")
    
    resultados = {
        "sucesso": True,
        "colecoes_importadas": [],
        "total_documentos_importados": 0,
        "erros": []
    }
    
    colecoes_para_importar = data.colecoes_selecionadas or list(data.dados.keys())
    
    for colecao in colecoes_para_importar:
        if colecao not in data.dados:
            continue
            
        docs = data.dados[colecao]
        if not docs:
            continue
        
        try:
            # Se substituir existente, apagar primeiro
            if data.substituir_existente:
                await db[colecao].delete_many({})
            
            # Importar documentos
            if docs:
                # Adicionar metadados de importação
                for doc in docs:
                    doc["_importado_em"] = datetime.now(timezone.utc).isoformat()
                    doc["_importado_por"] = current_user["id"]
                
                result = await db[colecao].insert_many(docs)
                count = len(result.inserted_ids)
                resultados["colecoes_importadas"].append({
                    "nome": colecao,
                    "documentos": count
                })
                resultados["total_documentos_importados"] += count
                logger.info(f"Importado {colecao}: {count} documentos")
                
        except Exception as e:
            error_msg = f"Erro ao importar {colecao}: {str(e)}"
            logger.error(error_msg)
            resultados["erros"].append(error_msg)
    
    if resultados["erros"]:
        resultados["sucesso"] = len(resultados["erros"]) < len(colecoes_para_importar)
    
    # Registar importação
    await db.backups.insert_one({
        "id": str(uuid.uuid4()),
        "tipo": "importacao",
        "importado_em": datetime.now(timezone.utc).isoformat(),
        "importado_por": current_user["id"],
        "total_colecoes": len(resultados["colecoes_importadas"]),
        "total_documentos": resultados["total_documentos_importados"],
        "erros": resultados["erros"]
    })
    
    logger.info(f"Importação concluída: {len(resultados['colecoes_importadas'])} coleções, {resultados['total_documentos_importados']} documentos")
    
    return resultados


@router.get("/colecoes")
async def listar_colecoes_disponiveis(
    current_user: dict = Depends(get_current_user)
):
    """Listar todas as coleções disponíveis para backup"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    colecoes_info = []
    
    for colecao in COLECOES_BACKUP:
        try:
            count = await db[colecao].count_documents({})
            colecoes_info.append({
                "nome": colecao,
                "documentos": count,
                "tem_dados": count > 0
            })
        except:
            continue
    
    # Ordenar por número de documentos
    colecoes_info.sort(key=lambda x: x["documentos"], reverse=True)
    
    return {
        "total_colecoes": len(colecoes_info),
        "colecoes_com_dados": len([c for c in colecoes_info if c["tem_dados"]]),
        "colecoes": colecoes_info
    }


@router.get("/historico")
async def listar_historico_backups(
    current_user: dict = Depends(get_current_user)
):
    """Listar histórico de backups e importações"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    backups = await db.backups.find({}, {"_id": 0}).sort("exportado_em", -1).limit(50).to_list(50)
    
    return backups


@router.get("/parcial/{categoria}")
async def exportar_backup_parcial(
    categoria: str,
    current_user: dict = Depends(get_current_user)
):
    """Exportar backup parcial por categoria (Admin only)
    
    Categorias disponíveis:
    - utilizadores: users, motoristas, parceiros, gestores
    - veiculos: vehicles, cartoes_frota, historico_custos
    - contratos: contratos, templates
    - rpa: plataformas, rpa_*, designs, scripts, credenciais
    - financeiro: despesas, receitas, pagamentos, recibos
    - viaverde: portagens, movimentos, acumulado
    - uber_bolt: ganhos, viagens, dados
    - relatorios: relatorios_semanais, resumos, historico
    - configuracoes: todas as configs do sistema
    - tickets: tickets, mensagens, conversas
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode exportar")
    
    categorias_map = {
        "utilizadores": ["users", "motoristas", "parceiros", "gestor_parceiro"],
        "veiculos": ["vehicles", "cartoes_frota", "historico_custos_veiculo", "turnos_veiculos"],
        "contratos": ["contratos", "contratos_motorista", "templates_contrato", "templates_contratos"],
        "rpa": [
            "plataformas", "plataformas_rpa", "rpa_plataformas", "rpa_rascunhos", 
            "rpa_designs", "designs_rpa", "rpa_scripts", "rpa_credenciais",
            "rpa_credenciais_central", "rpa_execucoes", "rpa_agendamentos",
            "rpa_importacoes", "registos_rpa", "execucoes_rpa", "execucoes_rpa_uber",
            "execucoes_rpa_viaverde", "importacoes_rpa", "credenciais_plataforma",
            "credenciais_plataformas", "credenciais_parceiro"
        ],
        "financeiro": [
            "despesas", "despesas_combustivel", "despesas_fornecedor", "combustivel_eletrico",
            "abastecimentos_combustivel", "expenses", "revenues", "partner_expenses",
            "partner_revenues", "pagamentos", "pagamentos_recibos", "recibos"
        ],
        "viaverde": ["portagens_viaverde", "viaverde_movimentos", "viaverde_acumulado", "dados_via_verde"],
        "uber_bolt": [
            "ganhos_bolt", "ganhos_uber_historico", "viagens_bolt", "viagens_uber",
            "dados_bolt", "dados_uber", "bolt_api_sync_data", "credenciais_bolt_api", "credenciais_uber"
        ],
        "relatorios": [
            "relatorios_semanais", "resumos_semanais", "resumos_semanais_rpa",
            "historico_relatorios", "relatorios_ganhos", "status_relatorios", "totais_empresa"
        ],
        "configuracoes": [
            "configuracoes", "configuracoes_sistema", "configuracoes_api",
            "configuracoes_sincronizacao", "config_alertas_custos", "config_comissoes_parceiro",
            "csv_configuracoes", "relatorio_config", "sincronizacao_auto_config"
        ],
        "tickets": ["tickets", "mensagens", "conversas"],
        "planos": [
            "planos", "planos_sistema", "planos_motorista", "planos_usuarios",
            "categorias_plano", "subscricoes", "subscriptions", "motorista_plano_assinaturas",
            "escalas_comissao"
        ]
    }
    
    if categoria not in categorias_map:
        raise HTTPException(
            status_code=400, 
            detail=f"Categoria inválida. Categorias disponíveis: {list(categorias_map.keys())}"
        )
    
    colecoes = categorias_map[categoria]
    
    backup_data = {
        "versao": "2.0",
        "tipo": f"backup_parcial_{categoria}",
        "categoria": categoria,
        "exportado_em": datetime.now(timezone.utc).isoformat(),
        "exportado_por": current_user["id"],
        "dados": {},
        "metadados": {
            "total_colecoes": 0,
            "total_documentos": 0
        }
    }
    
    total_docs = 0
    
    for colecao in colecoes:
        try:
            count = await db[colecao].count_documents({})
            if count > 0:
                docs = await db[colecao].find({}).to_list(None)
                # Converter ObjectId e remover _id
                docs_clean = []
                for doc in docs:
                    doc.pop('_id', None)
                    docs_clean.append(convert_objectid(doc))
                backup_data["dados"][colecao] = docs_clean
                total_docs += count
        except:
            continue
    
    backup_data["metadados"]["total_colecoes"] = len(backup_data["dados"])
    backup_data["metadados"]["total_documentos"] = total_docs
    
    return backup_data



# ==================== LIMPEZA DE DADOS ====================

# Colecções que podem ser limpas com segurança (logs, caches, etc.)
COLECOES_LIMPEZA = {
    "logs_execucao": {
        "colecoes": ["execucoes_rpa_viaverde", "rpa_execucoes", "sincronizacao_auto_execucoes", "logs_sistema", "logs_auditoria", "logs_importacao", "logs_sincronizacao_parceiro"],
        "descricao": "Logs de execução de RPA e sincronização",
        "manter_ultimos": 50
    },
    "emails_processados": {
        "colecoes": ["email_queue"],
        "descricao": "Fila de emails já processados",
        "filtro": {"status": {"$in": ["sent", "failed"]}}
    },
    "notificacoes_lidas": {
        "colecoes": ["notificacoes"],
        "descricao": "Notificações já lidas",
        "filtro": {"lida": True}
    },
    "trajetos_antigos": {
        "colecoes": ["trajetos_gps"],
        "descricao": "Trajetos GPS antigos (mais de 90 dias)",
        "dias_antigos": 90
    },
    "colecoes_vazias": {
        "colecoes": [],  # Dinâmico
        "descricao": "Colecções sem dados"
    },
    "health_checks": {
        "colecoes": ["playwright_health_checks"],
        "descricao": "Logs de health checks do Playwright",
        "manter_ultimos": 10
    }
}


@router.get("/limpeza/analise")
async def analisar_dados_para_limpeza(
    current_user: dict = Depends(get_current_user)
):
    """Analisar dados que podem ser limpos com segurança"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    analise = {
        "categorias": [],
        "total_documentos_limpaveis": 0,
        "espaco_estimado_mb": 0
    }
    
    for categoria_id, config in COLECOES_LIMPEZA.items():
        categoria_info = {
            "id": categoria_id,
            "nome": config["descricao"],
            "colecoes": [],
            "total_documentos": 0
        }
        
        for colecao in config["colecoes"]:
            try:
                if config.get("filtro"):
                    count = await db[colecao].count_documents(config["filtro"])
                elif config.get("manter_ultimos"):
                    total = await db[colecao].count_documents({})
                    count = max(0, total - config["manter_ultimos"])
                elif config.get("dias_antigos"):
                    from datetime import timedelta
                    data_limite = datetime.now(timezone.utc) - timedelta(days=config["dias_antigos"])
                    count = await db[colecao].count_documents({
                        "$or": [
                            {"created_at": {"$lt": data_limite}},
                            {"data": {"$lt": data_limite.isoformat()}}
                        ]
                    })
                else:
                    count = await db[colecao].count_documents({})
                
                if count > 0:
                    categoria_info["colecoes"].append({
                        "nome": colecao,
                        "documentos": count
                    })
                    categoria_info["total_documentos"] += count
            except:
                continue
        
        # Verificar coleções vazias
        if categoria_id == "colecoes_vazias":
            for colecao in COLECOES_BACKUP:
                try:
                    count = await db[colecao].count_documents({})
                    if count == 0:
                        categoria_info["colecoes"].append({
                            "nome": colecao,
                            "documentos": 0
                        })
                except:
                    continue
        
        if categoria_info["colecoes"]:
            analise["categorias"].append(categoria_info)
            analise["total_documentos_limpaveis"] += categoria_info["total_documentos"]
    
    # Estimar espaço (aproximado)
    analise["espaco_estimado_mb"] = round(analise["total_documentos_limpaveis"] * 0.001, 2)
    
    return analise


@router.post("/limpeza/executar/{categoria_id}")
async def executar_limpeza(
    categoria_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Executar limpeza de uma categoria específica"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    if categoria_id not in COLECOES_LIMPEZA and categoria_id != "colecoes_vazias":
        raise HTTPException(status_code=400, detail="Categoria inválida")
    
    config = COLECOES_LIMPEZA.get(categoria_id, {})
    resultado = {
        "categoria": categoria_id,
        "documentos_removidos": 0,
        "colecoes_afetadas": [],
        "erros": []
    }
    
    colecoes = config.get("colecoes", [])
    
    # Colecções vazias - dinâmico
    if categoria_id == "colecoes_vazias":
        for colecao in COLECOES_BACKUP:
            try:
                count = await db[colecao].count_documents({})
                if count == 0:
                    await db.drop_collection(colecao)
                    resultado["colecoes_afetadas"].append(colecao)
            except Exception as e:
                resultado["erros"].append(f"{colecao}: {str(e)}")
        return resultado
    
    for colecao in colecoes:
        try:
            if config.get("filtro"):
                result = await db[colecao].delete_many(config["filtro"])
                count = result.deleted_count
            elif config.get("manter_ultimos"):
                # Manter apenas os últimos N documentos
                total = await db[colecao].count_documents({})
                if total > config["manter_ultimos"]:
                    # Obter IDs dos documentos a manter
                    docs_manter = await db[colecao].find({}, {"_id": 1}).sort("_id", -1).limit(config["manter_ultimos"]).to_list(config["manter_ultimos"])
                    ids_manter = [d["_id"] for d in docs_manter]
                    result = await db[colecao].delete_many({"_id": {"$nin": ids_manter}})
                    count = result.deleted_count
                else:
                    count = 0
            elif config.get("dias_antigos"):
                from datetime import timedelta
                data_limite = datetime.now(timezone.utc) - timedelta(days=config["dias_antigos"])
                result = await db[colecao].delete_many({
                    "$or": [
                        {"created_at": {"$lt": data_limite}},
                        {"data": {"$lt": data_limite.isoformat()}}
                    ]
                })
                count = result.deleted_count
            else:
                result = await db[colecao].delete_many({})
                count = result.deleted_count
            
            if count > 0:
                resultado["colecoes_afetadas"].append({
                    "nome": colecao,
                    "documentos_removidos": count
                })
                resultado["documentos_removidos"] += count
                
        except Exception as e:
            resultado["erros"].append(f"{colecao}: {str(e)}")
    
    # Registar limpeza
    await db.backups.insert_one({
        "id": str(uuid.uuid4()),
        "tipo": "limpeza",
        "categoria": categoria_id,
        "executado_em": datetime.now(timezone.utc).isoformat(),
        "executado_por": current_user["id"],
        "documentos_removidos": resultado["documentos_removidos"],
        "colecoes": [c["nome"] if isinstance(c, dict) else c for c in resultado["colecoes_afetadas"]]
    })
    
    return resultado


@router.post("/limpeza/reset-dados-teste")
async def reset_dados_teste(
    confirmar: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Reset completo de dados de teste (PERIGOSO - apenas para ambiente de teste)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    if not confirmar:
        return {
            "aviso": "ATENÇÃO: Esta operação irá remover TODOS os dados de teste!",
            "instrucoes": "Adicione ?confirmar=true para executar",
            "colecoes_afetadas": list(COLECOES_LIMPEZA.keys())
        }
    
    resultado = {
        "categorias_limpas": [],
        "total_documentos_removidos": 0,
        "erros": []
    }
    
    # Limpar todas as categorias de limpeza
    for categoria_id in COLECOES_LIMPEZA.keys():
        try:
            res = await executar_limpeza(categoria_id, current_user)
            resultado["categorias_limpas"].append(categoria_id)
            resultado["total_documentos_removidos"] += res.get("documentos_removidos", 0)
        except Exception as e:
            resultado["erros"].append(f"{categoria_id}: {str(e)}")
    
    return resultado


@router.get("/armazenamento/estatisticas")
async def estatisticas_armazenamento(
    current_user: dict = Depends(get_current_user)
):
    """Obter estatísticas de armazenamento da base de dados"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    stats = {
        "base_dados": "tvdefleet_db",
        "colecoes": [],
        "totais": {
            "total_colecoes": 0,
            "total_documentos": 0,
            "tamanho_dados_mb": 0,
            "tamanho_indices_mb": 0
        },
        "top_colecoes": [],
        "colecoes_vazias": 0
    }
    
    try:
        # Estatísticas gerais da DB
        db_stats = await db.command("dbStats")
        stats["totais"]["tamanho_dados_mb"] = round(db_stats.get("dataSize", 0) / 1024 / 1024, 2)
        stats["totais"]["tamanho_indices_mb"] = round(db_stats.get("indexSize", 0) / 1024 / 1024, 2)
        stats["totais"]["total_colecoes"] = db_stats.get("collections", 0)
        stats["totais"]["total_documentos"] = db_stats.get("objects", 0)
    except:
        pass
    
    # Estatísticas por coleção
    colecoes_stats = []
    for colecao in COLECOES_BACKUP:
        try:
            col_stats = await db.command("collStats", colecao)
            count = col_stats.get("count", 0)
            size_mb = round(col_stats.get("size", 0) / 1024 / 1024, 2)
            
            if count == 0:
                stats["colecoes_vazias"] += 1
            
            colecoes_stats.append({
                "nome": colecao,
                "documentos": count,
                "tamanho_mb": size_mb
            })
        except:
            continue
    
    # Ordenar por tamanho
    colecoes_stats.sort(key=lambda x: x["tamanho_mb"], reverse=True)
    stats["colecoes"] = colecoes_stats
    stats["top_colecoes"] = colecoes_stats[:10]
    
    return stats
