"""Alertas routes for FleeTrack application"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user
from utils.alerts import check_and_create_alerts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alertas", tags=["alertas"])
db = get_database()


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


@router.get("")
async def get_alertas(current_user: dict = Depends(get_current_user)):
    """Obtém lista de alertas"""
    query = {"status": "ativo"}
    
    # Filtrar por parceiro se não for admin
    if current_user["role"] == UserRole.PARCEIRO:
        # Obter veículos e motoristas do parceiro
        vehicles = await db.vehicles.find(
            {"parceiro_id": current_user["id"]},
            {"_id": 0, "id": 1}
        ).to_list(None)
        vehicle_ids = [v["id"] for v in vehicles]
        
        motoristas = await db.motoristas.find(
            {"$or": [
                {"parceiro_id": current_user["id"]},
                {"parceiro_atribuido": current_user["id"]}
            ]},
            {"_id": 0, "id": 1}
        ).to_list(None)
        motorista_ids = [m["id"] for m in motoristas]
        
        query["entidade_id"] = {"$in": vehicle_ids + motorista_ids}
    
    alertas = await db.alertas.find(query, {"_id": 0}).to_list(None)
    return alertas


@router.post("/verificar")
async def verificar_alertas(current_user: dict = Depends(get_current_user)):
    """Executa verificação de alertas (cron manual)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await check_and_create_alerts()
    return {"message": "Verificação de alertas executada"}


@router.put("/{alerta_id}/resolver")
async def resolver_alerta(
    alerta_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Marca um alerta como resolvido"""
    result = await db.alertas.update_one(
        {"id": alerta_id},
        {"$set": {
            "status": "resolvido",
            "resolvido_por": current_user["id"],
            "resolvido_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    
    return {"message": "Alerta resolvido"}


@router.put("/{alerta_id}/ignorar")
async def ignorar_alerta(
    alerta_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Marca um alerta como ignorado"""
    result = await db.alertas.update_one(
        {"id": alerta_id},
        {"$set": {
            "status": "ignorado",
            "ignorado_por": current_user["id"],
            "ignorado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    
    return {"message": "Alerta ignorado"}


@router.get("/dashboard-stats")
async def get_alertas_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Obtém estatísticas de alertas para o dashboard"""
    query = {"status": "ativo"}
    
    # Filtrar por parceiro se não for admin
    if current_user["role"] == UserRole.PARCEIRO:
        vehicles = await db.vehicles.find(
            {"parceiro_id": current_user["id"]},
            {"_id": 0, "id": 1}
        ).to_list(None)
        vehicle_ids = [v["id"] for v in vehicles]
        
        motoristas = await db.motoristas.find(
            {"$or": [
                {"parceiro_id": current_user["id"]},
                {"parceiro_atribuido": current_user["id"]}
            ]},
            {"_id": 0, "id": 1}
        ).to_list(None)
        motorista_ids = [m["id"] for m in motoristas]
        
        query["entidade_id"] = {"$in": vehicle_ids + motorista_ids}
    
    alertas = await db.alertas.find(query, {"_id": 0}).to_list(None)
    
    # Agrupar por prioridade
    stats = {
        "total": len(alertas),
        "alta": len([a for a in alertas if a.get("prioridade") == "alta"]),
        "media": len([a for a in alertas if a.get("prioridade") == "media"]),
        "baixa": len([a for a in alertas if a.get("prioridade") == "baixa"])
    }
    
    # Agrupar por tipo
    tipos = {}
    for alerta in alertas:
        tipo = alerta.get("tipo", "outro")
        tipos[tipo] = tipos.get(tipo, 0) + 1
    
    stats["por_tipo"] = tipos
    
    return stats


# ==================== ALERTAS DE CUSTOS ====================

CATEGORIAS_CUSTO = [
    "combustivel_fossil",
    "combustivel_eletrico", 
    "via_verde",
    "portagem",
    "gps",
    "seguros",
    "manutencao",
    "lavagem",
    "pneus",
    "estacionamento",
    "outros"
]


@router.get("/config-limites")
async def get_config_limites_custos(current_user: dict = Depends(get_current_user)):
    """Obter configuração de limites de custos do parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else current_user.get("parceiro_id")
    
    config = await db.config_alertas_custos.find_one(
        {"parceiro_id": parceiro_id},
        {"_id": 0}
    )
    
    if not config:
        # Retornar configuração padrão
        config = {
            "parceiro_id": parceiro_id,
            "ativo": False,
            "limites": {},
            "periodo": "semanal",  # semanal, mensal
            "notificar_email": False,
            "notificar_app": True,
            "percentual_aviso": 80  # Avisar quando atingir 80% do limite
        }
    
    return config


@router.post("/config-limites")
async def salvar_config_limites_custos(
    config_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Salvar configuração de limites de custos"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else current_user.get("parceiro_id")
    
    now = datetime.now(timezone.utc).isoformat()
    
    config = {
        "parceiro_id": parceiro_id,
        "ativo": config_data.get("ativo", True),
        "limites": config_data.get("limites", {}),
        "periodo": config_data.get("periodo", "semanal"),
        "notificar_email": config_data.get("notificar_email", False),
        "notificar_app": config_data.get("notificar_app", True),
        "percentual_aviso": config_data.get("percentual_aviso", 80),
        "updated_at": now
    }
    
    await db.config_alertas_custos.update_one(
        {"parceiro_id": parceiro_id},
        {"$set": config, "$setOnInsert": {"created_at": now}},
        upsert=True
    )
    
    logger.info(f"Config limites custos atualizada para parceiro {parceiro_id}")
    return {"message": "Configuração guardada com sucesso"}


@router.get("/custos/verificar")
async def verificar_alertas_custos(current_user: dict = Depends(get_current_user)):
    """Verificar custos atuais vs limites configurados"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else current_user.get("parceiro_id")
    
    # Obter configuração
    config = await db.config_alertas_custos.find_one(
        {"parceiro_id": parceiro_id},
        {"_id": 0}
    )
    
    if not config or not config.get("ativo"):
        return {"message": "Alertas de custos não configurados", "alertas": []}
    
    # Calcular período
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    
    if config.get("periodo") == "semanal":
        data_inicio = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    else:  # mensal
        data_inicio = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    
    data_fim = now.strftime("%Y-%m-%d")
    
    # Buscar despesas por categoria
    pipeline = [
        {"$match": {
            "parceiro_id": parceiro_id,
            "data_entrada": {"$gte": data_inicio, "$lte": data_fim}
        }},
        {"$group": {
            "_id": "$tipo_fornecedor",
            "total": {"$sum": "$valor_liquido"},
            "count": {"$sum": 1}
        }}
    ]
    
    despesas_por_categoria = await db.despesas_fornecedor.aggregate(pipeline).to_list(20)
    
    # Comparar com limites
    limites = config.get("limites", {})
    percentual_aviso = config.get("percentual_aviso", 80)
    alertas = []
    
    for despesa in despesas_por_categoria:
        categoria = despesa["_id"] or "outros"
        total = despesa["total"]
        limite = limites.get(categoria, 0)
        
        if limite > 0:
            percentual = (total / limite) * 100
            
            if percentual >= 100:
                # Limite ultrapassado
                alertas.append({
                    "categoria": categoria,
                    "tipo": "limite_ultrapassado",
                    "severidade": "critico",
                    "total_atual": round(total, 2),
                    "limite": limite,
                    "percentual": round(percentual, 1),
                    "excesso": round(total - limite, 2),
                    "periodo": config.get("periodo")
                })
            elif percentual >= percentual_aviso:
                # Próximo do limite
                alertas.append({
                    "categoria": categoria,
                    "tipo": "proximo_limite",
                    "severidade": "aviso",
                    "total_atual": round(total, 2),
                    "limite": limite,
                    "percentual": round(percentual, 1),
                    "restante": round(limite - total, 2),
                    "periodo": config.get("periodo")
                })
    
    # Criar notificações para alertas críticos
    for alerta in alertas:
        if alerta["severidade"] == "critico":
            await _criar_notificacao_alerta_custo(parceiro_id, alerta, config)
    
    return {
        "periodo": {
            "tipo": config.get("periodo"),
            "inicio": data_inicio,
            "fim": data_fim
        },
        "alertas": alertas,
        "resumo": {
            "total_alertas": len(alertas),
            "criticos": len([a for a in alertas if a["severidade"] == "critico"]),
            "avisos": len([a for a in alertas if a["severidade"] == "aviso"])
        }
    }


async def _criar_notificacao_alerta_custo(parceiro_id: str, alerta: Dict, config: Dict):
    """Criar notificação para alerta de custo"""
    from utils.notificacoes import criar_notificacao
    
    categoria_nomes = {
        "combustivel_fossil": "Combustível Fóssil",
        "combustivel_eletrico": "Combustível Elétrico",
        "via_verde": "Via Verde",
        "portagem": "Portagens",
        "gps": "GPS/Tracking",
        "seguros": "Seguros",
        "manutencao": "Manutenção",
        "lavagem": "Lavagem",
        "pneus": "Pneus",
        "estacionamento": "Estacionamento",
        "outros": "Outros"
    }
    
    categoria_nome = categoria_nomes.get(alerta["categoria"], alerta["categoria"])
    
    if alerta["tipo"] == "limite_ultrapassado":
        titulo = f"⚠️ Limite de {categoria_nome} ultrapassado!"
        mensagem = f"O limite de €{alerta['limite']} para {categoria_nome} foi ultrapassado. Gasto atual: €{alerta['total_atual']} ({alerta['percentual']}%)"
    else:
        titulo = f"📊 Próximo do limite de {categoria_nome}"
        mensagem = f"Atenção: {alerta['percentual']}% do limite de {categoria_nome} já foi utilizado. Restam €{alerta['restante']}"
    
    # Verificar se já existe notificação recente para evitar spam
    from datetime import timedelta
    uma_hora_atras = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    
    notificacao_existente = await db.notificacoes.find_one({
        "user_id": parceiro_id,
        "tipo": "alerta_custo",
        "metadata.categoria": alerta["categoria"],
        "criada_em": {"$gte": uma_hora_atras}
    })
    
    if notificacao_existente:
        return  # Já existe notificação recente
    
    if config.get("notificar_app", True):
        await criar_notificacao(
            db=db,
            user_id=parceiro_id,
            tipo="alerta_custo",
            titulo=titulo,
            mensagem=mensagem,
            prioridade="alta" if alerta["severidade"] == "critico" else "media",
            link="/alertas-custos",
            metadata={
                "categoria": alerta["categoria"],
                "total_atual": alerta["total_atual"],
                "limite": alerta["limite"],
                "percentual": alerta["percentual"]
            }
        )


@router.get("/custos/historico")
async def get_historico_alertas_custos(
    limite: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Obter histórico de alertas de custos"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user["id"] if current_user["role"] == UserRole.PARCEIRO else current_user.get("parceiro_id")
    
    alertas = await db.notificacoes.find(
        {
            "destinatario_id": parceiro_id,
            "tipo": "alerta_custo"
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limite).to_list(limite)
    
    return alertas



@router.get("/documentos-expirar")
async def get_documentos_expirar(
    dias: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Obter lista de documentos a expirar nos próximos X dias"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    limite_data = now + timedelta(days=dias)
    
    expirados = []
    a_expirar = []
    
    # Filtro de parceiro
    parceiro_filter = {}
    if current_user["role"] == UserRole.PARCEIRO:
        parceiro_filter = {"$or": [
            {"parceiro_id": current_user["id"]},
            {"parceiro_atribuido": current_user["id"]}
        ]}
    
    # Documentos de motoristas
    motorista_docs = [
        ("carta_conducao", "carta_conducao_validade", "Carta de Condução"),
        ("cartao_cidadao", "cartao_cidadao_validade", "Cartão de Cidadão"),
        ("certificado_tvde", "certificado_tvde_validade", "Certificado TVDE"),
        ("registo_criminal", "registo_criminal_validade", "Registo Criminal"),
    ]
    
    motoristas = await db.motoristas.find(
        {**parceiro_filter, "ativo": True},
        {"_id": 0, "id": 1, "nome": 1, "email": 1, 
         "carta_conducao": 1, "carta_conducao_validade": 1,
         "cartao_cidadao": 1, "cartao_cidadao_validade": 1,
         "certificado_tvde": 1, "certificado_tvde_validade": 1,
         "registo_criminal": 1, "registo_criminal_validade": 1}
    ).to_list(500)
    
    for m in motoristas:
        for doc_field, validade_field, doc_nome in motorista_docs:
            if m.get(doc_field) and m.get(validade_field):
                try:
                    validade = datetime.fromisoformat(m[validade_field].replace('Z', '+00:00')) if isinstance(m[validade_field], str) else m[validade_field]
                    if validade.tzinfo is None:
                        validade = validade.replace(tzinfo=timezone.utc)
                    
                    doc_info = {
                        "id": m["id"],
                        "tipo": "motorista",
                        "nome": m.get("nome", ""),
                        "email": m.get("email", ""),
                        "documento": doc_nome,
                        "validade": validade.isoformat()
                    }
                    
                    if validade < now:
                        expirados.append(doc_info)
                    elif validade < limite_data:
                        a_expirar.append(doc_info)
                except Exception:
                    pass
    
    # Documentos de veículos
    veiculo_docs = [
        ("inspecao", "inspecao_validade", "Inspeção"),
        ("seguro", "seguro_validade", "Seguro"),
        ("licenca_tvde", "licenca_tvde_validade", "Licença TVDE"),
    ]
    
    veiculo_filter = {"parceiro_id": current_user["id"]} if current_user["role"] == UserRole.PARCEIRO else {}
    
    veiculos = await db.vehicles.find(
        {**veiculo_filter, "ativo": {"$ne": False}},
        {"_id": 0, "id": 1, "matricula": 1, "marca": 1, "modelo": 1,
         "inspecao": 1, "inspecao_validade": 1,
         "seguro": 1, "seguro_validade": 1,
         "licenca_tvde": 1, "licenca_tvde_validade": 1}
    ).to_list(500)
    
    for v in veiculos:
        for doc_field, validade_field, doc_nome in veiculo_docs:
            if v.get(doc_field) and v.get(validade_field):
                try:
                    validade = datetime.fromisoformat(v[validade_field].replace('Z', '+00:00')) if isinstance(v[validade_field], str) else v[validade_field]
                    if validade.tzinfo is None:
                        validade = validade.replace(tzinfo=timezone.utc)
                    
                    doc_info = {
                        "id": v["id"],
                        "tipo": "veiculo",
                        "matricula": v.get("matricula", ""),
                        "marca": v.get("marca", ""),
                        "modelo": v.get("modelo", ""),
                        "documento": doc_nome,
                        "validade": validade.isoformat()
                    }
                    
                    if validade < now:
                        expirados.append(doc_info)
                    elif validade < limite_data:
                        a_expirar.append(doc_info)
                except Exception:
                    pass
    
    # Ordenar por data de validade
    expirados.sort(key=lambda x: x["validade"])
    a_expirar.sort(key=lambda x: x["validade"])
    
    return {
        "expirados": expirados,
        "a_expirar": a_expirar,
        "total_expirados": len(expirados),
        "total_a_expirar": len(a_expirar)
    }


@router.post("/documentos-expirar/enviar-whatsapp")
async def enviar_alertas_documentos_whatsapp(
    dias: int = 30,
    apenas_motoristas: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Envia alertas de documentos a expirar por WhatsApp
    
    Args:
        dias: Quantos dias de antecedência para alertar
        apenas_motoristas: Se True, envia apenas para motoristas (ignora veículos)
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    from routes.whatsapp_cloud import send_template_message
    
    now = datetime.now(timezone.utc)
    limite_data = now + timedelta(days=dias)
    
    # Filtro de parceiro
    parceiro_filter = {}
    if current_user["role"] == UserRole.PARCEIRO:
        parceiro_filter = {"$or": [
            {"parceiro_id": current_user["id"]},
            {"parceiro_atribuido": current_user["id"]}
        ]}
    
    # Documentos de motoristas
    motorista_docs = [
        ("carta_conducao", "carta_conducao_validade", "Carta de Condução"),
        ("cartao_cidadao", "cartao_cidadao_validade", "Cartão de Cidadão"),
        ("certificado_tvde", "certificado_tvde_validade", "Certificado TVDE"),
        ("registo_criminal", "registo_criminal_validade", "Registo Criminal"),
    ]
    
    motoristas = await db.motoristas.find(
        {**parceiro_filter, "ativo": True},
        {"_id": 0, "id": 1, "name": 1, "nome": 1, "email": 1, "phone": 1, "whatsapp": 1,
         "carta_conducao": 1, "carta_conducao_validade": 1,
         "cartao_cidadao": 1, "cartao_cidadao_validade": 1,
         "certificado_tvde": 1, "certificado_tvde_validade": 1,
         "registo_criminal": 1, "registo_criminal_validade": 1}
    ).to_list(500)
    
    resultados = {
        "enviados": [],
        "falhas": [],
        "sem_telefone": [],
        "documentos_alertados": 0
    }
    
    for m in motoristas:
        telefone = m.get("whatsapp") or m.get("phone")
        nome = m.get("name") or m.get("nome", "Motorista")
        
        if not telefone:
            continue
        
        for doc_field, validade_field, doc_nome in motorista_docs:
            if m.get(doc_field) and m.get(validade_field):
                try:
                    validade = datetime.fromisoformat(m[validade_field].replace('Z', '+00:00')) if isinstance(m[validade_field], str) else m[validade_field]
                    if validade.tzinfo is None:
                        validade = validade.replace(tzinfo=timezone.utc)
                    
                    # Apenas documentos a expirar (não já expirados)
                    if now < validade < limite_data:
                        dias_restantes = (validade - now).days
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
                                resultados["enviados"].append({
                                    "motorista_id": m["id"],
                                    "nome": nome,
                                    "documento": doc_nome,
                                    "dias_restantes": dias_restantes,
                                    "message_id": result.get("message_id")
                                })
                                resultados["documentos_alertados"] += 1
                            else:
                                resultados["falhas"].append({
                                    "motorista_id": m["id"],
                                    "nome": nome,
                                    "documento": doc_nome,
                                    "erro": result.get("error")
                                })
                        except Exception as e:
                            resultados["falhas"].append({
                                "motorista_id": m["id"],
                                "nome": nome,
                                "documento": doc_nome,
                                "erro": str(e)
                            })
                except Exception:
                    pass
    
    # Registar na BD
    await db.whatsapp_alertas_enviados.insert_one({
        "id": str(uuid.uuid4()),
        "tipo": "documentos_expirar",
        "dias_antecedencia": dias,
        "enviados": len(resultados["enviados"]),
        "falhas": len(resultados["falhas"]),
        "documentos_alertados": resultados["documentos_alertados"],
        "enviado_por": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "mensagem": f"Alertas enviados para documentos a expirar nos próximos {dias} dias",
        "enviados": len(resultados["enviados"]),
        "falhas": len(resultados["falhas"]),
        "documentos_alertados": resultados["documentos_alertados"],
        "detalhes": resultados
    }


