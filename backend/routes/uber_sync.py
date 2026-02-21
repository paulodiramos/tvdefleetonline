"""
Rotas para Sincronização Uber
- Parceiro: configura credenciais e mantém sessão
- Admin: executa extração automática
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging
import os
import uuid

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/uber", tags=["Uber Sync"])
db = get_database()


class CredenciaisUber(BaseModel):
    email: str
    password: str
    telefone: Optional[str] = None


class SMSCode(BaseModel):
    codigo: str


# ==================== ENDPOINTS PARA PARCEIRO ====================

@router.get("/minhas-credenciais")
async def get_minhas_credenciais(
    current_user: dict = Depends(get_current_user),
    incluir_password: bool = False
):
    """Parceiro obtém as suas credenciais Uber
    
    Args:
        incluir_password: Se True, inclui a password na resposta
    """
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    # 1. Tentar da colecção dedicada primeiro
    projection = {"_id": 0}
    if not incluir_password:
        projection["password"] = 0
    
    cred = await db.credenciais_uber.find_one(
        {"parceiro_id": parceiro_id},
        projection
    )
    
    # 2. Se não encontrou, tentar das credenciais_plataformas
    if not cred or not cred.get("email"):
        parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
        if not parceiro:
            parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
        
        if parceiro and parceiro.get("credenciais_plataformas"):
            cp = parceiro["credenciais_plataformas"]
            cred = {
                "email": cp.get("uber_email", ""),
                "telefone": cp.get("uber_telefone", ""),
            }
            if incluir_password:
                cred["password"] = cp.get("uber_password", "")
    
    return cred or {}


@router.post("/minhas-credenciais")
async def salvar_minhas_credenciais(
    data: CredenciaisUber,
    current_user: dict = Depends(get_current_user)
):
    """Parceiro guarda as suas credenciais Uber"""
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    now = datetime.now(timezone.utc)
    
    # Guardar na colecção dedicada credenciais_uber
    await db.credenciais_uber.update_one(
        {"parceiro_id": parceiro_id},
        {"$set": {
            "email": data.email,
            "password": data.password,
            "telefone": data.telefone,
            "updated_at": now.isoformat()
        },
        "$setOnInsert": {
            "parceiro_id": parceiro_id,
            "created_at": now.isoformat()
        }},
        upsert=True
    )
    
    # Sincronizar com credenciais_plataformas no parceiro/user
    creds_update = {
        "credenciais_plataformas.uber_email": data.email,
        "credenciais_plataformas.uber_password": data.password,
        "credenciais_plataformas.uber_telefone": data.telefone
    }
    
    # Tentar actualizar em parceiros primeiro
    result = await db.parceiros.update_one(
        {"id": parceiro_id},
        {"$set": creds_update}
    )
    
    # Se não encontrou em parceiros, tentar em users
    if result.matched_count == 0:
        await db.users.update_one(
            {"id": parceiro_id},
            {"$set": creds_update}
        )
    
    return {"sucesso": True, "mensagem": "Credenciais guardadas"}


@router.get("/minha-sessao")
async def verificar_minha_sessao(
    current_user: dict = Depends(get_current_user)
):
    """Parceiro verifica o estado da sua sessão Uber"""
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    # 1. Verificar na base de dados
    sessao_db = await db.uber_sessions.find_one({"parceiro_id": parceiro_id})
    if sessao_db and sessao_db.get("active"):
        expires_at = sessao_db.get("expires_at")
        if expires_at:
            try:
                if isinstance(expires_at, str):
                    expira = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                else:
                    expira = expires_at
                
                now = datetime.now(timezone.utc)
                if expira.tzinfo is None:
                    expira = expira.replace(tzinfo=timezone.utc)
                    
                if expira > now:
                    dias_restantes = (expira - now).days
                    return {
                        "ativa": True,
                        "expira": expira.isoformat(),
                        "dias_restantes": dias_restantes,
                        "logged_in_at": sessao_db.get("logged_in_at")
                    }
            except Exception as e:
                logger.warning(f"Erro ao verificar expiração: {e}")
    
    # 2. Verificar directório de sessão persistente
    session_dir = f"/app/data/uber_sessions/parceiro_{parceiro_id}"
    if os.path.exists(session_dir):
        cookies_file = os.path.join(session_dir, "Default", "Cookies")
        if os.path.exists(cookies_file):
            mtime = os.path.getmtime(cookies_file)
            idade_dias = (datetime.now().timestamp() - mtime) / 86400
            
            if idade_dias < 30:
                expira = datetime.fromtimestamp(mtime + (30 * 86400))
                return {
                    "ativa": True,
                    "expira": expira.isoformat(),
                    "dias_restantes": round(30 - idade_dias, 1),
                    "tipo": "persistente"
                }
    
    # 3. Fallback para ficheiro antigo (compatibilidade)
    session_path = f"/tmp/uber_sessao_{parceiro_id}.json"
    if os.path.exists(session_path):
        mtime = os.path.getmtime(session_path)
        idade_dias = (datetime.now().timestamp() - mtime) / 86400
        
        if idade_dias < 30:
            expira = datetime.fromtimestamp(mtime + (30 * 86400))
            return {
                "ativa": True,
                "expira": expira.isoformat(),
                "dias_restantes": round(30 - idade_dias, 1)
            }
    
    return {"ativa": False}


@router.post("/fazer-login")
async def fazer_login_uber(
    current_user: dict = Depends(get_current_user)
):
    """Parceiro inicia login na Uber"""
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    # Buscar credenciais
    cred = await db.credenciais_uber.find_one({"parceiro_id": parceiro_id})
    if not cred:
        return {"sucesso": False, "erro": "Configure primeiro as credenciais"}
    
    try:
        from services.uber_extractor import UberExtractor
        
        extractor = UberExtractor(parceiro_id, cred["email"], cred["password"])
        await extractor.iniciar(usar_sessao=False)
        
        result = await extractor.fazer_login()
        await extractor.fechar()
        
        return result
        
    except Exception as e:
        logger.error(f"Erro no login: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/confirmar-sms")
async def confirmar_sms_uber(
    data: SMSCode,
    current_user: dict = Depends(get_current_user)
):
    """Parceiro confirma código SMS"""
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    cred = await db.credenciais_uber.find_one({"parceiro_id": parceiro_id})
    if not cred:
        return {"sucesso": False, "erro": "Credenciais não encontradas"}
    
    try:
        from services.uber_extractor import UberExtractor
        
        extractor = UberExtractor(parceiro_id, cred["email"], cred["password"])
        await extractor.iniciar(usar_sessao=False)
        
        result = await extractor.fazer_login(sms_code=data.codigo)
        await extractor.fechar()
        
        return result
        
    except Exception as e:
        logger.error(f"Erro no SMS: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.get("/meu-historico")
async def get_meu_historico(
    current_user: dict = Depends(get_current_user)
):
    """Parceiro obtém o seu histórico de importações"""
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    
    cursor = db.importacoes_uber.find(
        {"parceiro_id": parceiro_id},
        {"_id": 0, "motoristas": 0}
    ).sort("created_at", -1).limit(10)
    
    return await cursor.to_list(length=10)


class SincronizarRequest(BaseModel):
    semana_index: int = 0


@router.post("/sincronizar")
async def sincronizar_uber(
    data: SincronizarRequest,
    current_user: dict = Depends(get_current_user)
):
    """Parceiro sincroniza rendimentos Uber usando sessão guardada"""
    if current_user["role"] not in ["parceiro", "admin"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
    session_path = f"/tmp/uber_sessao_{parceiro_id}.json"
    
    # Verificar se tem sessão
    if not os.path.exists(session_path):
        return {"sucesso": False, "erro": "Sessão não encontrada. Faça login manual primeiro."}
    
    # Verificar se sessão não expirou
    mtime = os.path.getmtime(session_path)
    idade_dias = (datetime.now().timestamp() - mtime) / 86400
    if idade_dias >= 30:
        return {"sucesso": False, "erro": "Sessão expirada. Faça login manual novamente."}
    
    # Buscar credenciais
    cred = await db.credenciais_uber.find_one({"parceiro_id": parceiro_id})
    if not cred:
        return {"sucesso": False, "erro": "Credenciais não configuradas"}
    
    try:
        from services.uber_extractor import UberExtractor
        
        logger.info(f"Iniciando sincronização Uber para parceiro {parceiro_id}, semana {data.semana_index}")
        
        extractor = UberExtractor(parceiro_id, cred["email"], cred["password"])
        await extractor.iniciar(usar_sessao=True)
        
        # Verificar login
        status = await extractor.verificar_login()
        if not status.get("logado"):
            await extractor.fechar()
            return {"sucesso": False, "erro": "Sessão expirada. Faça login manual novamente."}
        
        # Extrair rendimentos
        resultado = await extractor.extrair_rendimentos()
        
        await extractor.fechar()
        
        if resultado.get("sucesso"):
            now = datetime.now(timezone.utc)
            motoristas_importados = resultado.get("motoristas", [])
            
            # Calcular período baseado na semana selecionada
            # A Uber usa semanas de pagamento de DOMINGO a SÁBADO
            # Exemplo: 1 de fevereiro (Domingo) a 7 de fevereiro (Sábado)
            # Mas na interface mostra até dia 8 (Domingo seguinte) como fim inclusivo
            hoje = datetime.now().date()
            
            # Encontrar o último domingo (início da semana Uber)
            # weekday(): 0=segunda, 6=domingo
            # Para Domingo: se hoje é domingo (6), dias_desde_domingo = 0
            # Se hoje é segunda (0), dias_desde_domingo = 1, etc.
            dias_desde_domingo = (hoje.weekday() + 1) % 7
            domingo_atual = hoje - timedelta(days=dias_desde_domingo)
            
            # Retroceder N semanas conforme semana_index
            domingo_da_semana = domingo_atual - timedelta(weeks=data.semana_index)
            # A Uber mostra o intervalo até o domingo seguinte (8 dias no display)
            domingo_seguinte = domingo_da_semana + timedelta(days=7)
            
            periodo_inicio = domingo_da_semana.strftime('%Y-%m-%d')
            periodo_fim = domingo_seguinte.strftime('%Y-%m-%d')
            
            logger.info(f"Período Uber calculado: {periodo_inicio} a {periodo_fim} (semana_index={data.semana_index})")
            
            # Guardar cada motorista em ganhos_uber
            for mot in motoristas_importados:
                nome_motorista = mot.get("nome", "")
                
                motorista_db = await db.motoristas.find_one({
                    "$or": [
                        {"nome": {"$regex": nome_motorista, "$options": "i"}},
                        {"name": {"$regex": nome_motorista, "$options": "i"}}
                    ]
                })
                
                motorista_id = motorista_db.get("id") if motorista_db else None
                
                ganho = {
                    "id": str(uuid.uuid4()),
                    "motorista_id": motorista_id,
                    "nome_motorista": nome_motorista,
                    "parceiro_id": parceiro_id,
                    "periodo_inicio": periodo_inicio,
                    "periodo_fim": periodo_fim,
                    "pago_total": mot.get("rendimentos_liquidos", 0),
                    "rendimentos_total": mot.get("rendimentos_totais", 0),
                    "reembolsos": mot.get("reembolsos", 0),
                    "ajustes": mot.get("ajustes", 0),
                    "data_importacao": now,
                    "importado_por": current_user["id"],
                    "fonte": "sincronizacao_manual"
                }
                
                await db.ganhos_uber.insert_one(ganho)
            
            # Guardar resumo
            await db.importacoes_uber.insert_one({
                "parceiro_id": parceiro_id,
                "periodo_inicio": periodo_inicio,
                "periodo_fim": periodo_fim,
                "motoristas": motoristas_importados,
                "total_motoristas": len(motoristas_importados),
                "total_rendimentos": resultado.get("total_rendimentos", 0),
                "ficheiro_csv": resultado.get("ficheiro"),
                "semana_index": data.semana_index,
                "created_at": now.isoformat(),
                "created_by": current_user["id"]
            })
            
            logger.info(f"Sincronização concluída: {len(motoristas_importados)} motoristas")
            
            return {
                "sucesso": True,
                "motoristas": motoristas_importados,
                "total_motoristas": len(motoristas_importados),
                "total_rendimentos": resultado.get("total_rendimentos", 0),
                "periodo_inicio": periodo_inicio,
                "periodo_fim": periodo_fim
            }
        else:
            return resultado
            
    except Exception as e:
        logger.error(f"Erro na sincronização: {e}")
        return {"sucesso": False, "erro": str(e)}


# ==================== ENDPOINTS PARA ADMIN ====================

@router.get("/admin/parceiros")
async def listar_parceiros_uber(
    current_user: dict = Depends(get_current_user)
):
    """Admin lista todos os parceiros e estado das sessões"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Buscar todos os parceiros
    parceiros = await db.users.find(
        {"role": "parceiro"},
        {"_id": 0, "id": 1, "name": 1, "email": 1}
    ).to_list(length=100)
    
    # Verificar estado de cada um
    for p in parceiros:
        session_path = f"/tmp/uber_sessao_{p['id']}.json"
        
        if os.path.exists(session_path):
            mtime = os.path.getmtime(session_path)
            idade_dias = (datetime.now().timestamp() - mtime) / 86400
            p["sessao_ativa"] = idade_dias < 30
            p["sessao_dias"] = round(30 - idade_dias, 1) if idade_dias < 30 else 0
        else:
            p["sessao_ativa"] = False
            p["sessao_dias"] = 0
        
        # Verificar se tem credenciais
        cred = await db.credenciais_uber.find_one({"parceiro_id": p["id"]})
        p["tem_credenciais"] = cred is not None
    
    return parceiros


@router.post("/admin/extrair/{parceiro_id}")
async def extrair_rendimentos_parceiro(
    parceiro_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Admin extrai rendimentos de um parceiro"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Buscar credenciais do parceiro
    cred = await db.credenciais_uber.find_one({"parceiro_id": parceiro_id})
    if not cred:
        return {"sucesso": False, "erro": "Parceiro não tem credenciais configuradas"}
    
    try:
        from services.uber_extractor import extrair_rendimentos_parceiro as extrair
        import uuid
        
        resultado = await extrair(parceiro_id, cred["email"], cred["password"])
        
        if resultado.get("sucesso"):
            now = datetime.now(timezone.utc)
            motoristas_importados = resultado.get("motoristas", [])
            
            # Calcular período (última semana completa por defeito)
            # Semanas da Uber: Segunda a Domingo
            hoje = datetime.now().date()
            dias_desde_segunda = hoje.weekday()  # 0=segunda, 6=domingo
            segunda_atual = hoje - timedelta(days=dias_desde_segunda)
            # Última semana completa
            segunda_da_semana = segunda_atual - timedelta(weeks=1)
            domingo_da_semana = segunda_da_semana + timedelta(days=6)
            
            periodo_inicio = segunda_da_semana.strftime('%Y-%m-%d')
            periodo_fim = domingo_da_semana.strftime('%Y-%m-%d')
            
            logger.info(f"Admin: Período calculado: {periodo_inicio} a {periodo_fim}")
            
            # Guardar cada motorista em ganhos_uber (para o resumo semanal)
            for mot in motoristas_importados:
                nome_motorista = mot.get("nome", "")
                
                # Tentar encontrar motorista na base de dados
                motorista_db = await db.motoristas.find_one({
                    "$or": [
                        {"nome": {"$regex": nome_motorista, "$options": "i"}},
                        {"name": {"$regex": nome_motorista, "$options": "i"}}
                    ]
                })
                
                motorista_id = motorista_db.get("id") if motorista_db else None
                
                ganho = {
                    "id": str(uuid.uuid4()),
                    "motorista_id": motorista_id,
                    "nome_motorista": nome_motorista,
                    "parceiro_id": parceiro_id,
                    "periodo_inicio": periodo_inicio,
                    "periodo_fim": periodo_fim,
                    "pago_total": mot.get("rendimentos_liquidos", 0),
                    "rendimentos_total": mot.get("rendimentos_totais", 0),
                    "reembolsos": mot.get("reembolsos", 0),
                    "ajustes": mot.get("ajustes", 0),
                    "data_importacao": now,
                    "importado_por": current_user["id"],
                    "fonte": "rpa_automatico"
                }
                
                await db.ganhos_uber.insert_one(ganho)
            
            # Também guardar resumo em importacoes_uber
            await db.importacoes_uber.insert_one({
                "parceiro_id": parceiro_id,
                "motoristas": motoristas_importados,
                "total_motoristas": resultado.get("total_motoristas", 0),
                "total_rendimentos": resultado.get("total_rendimentos", 0),
                "ficheiro": resultado.get("ficheiro"),
                "periodo_inicio": periodo_inicio,
                "periodo_fim": periodo_fim,
                "created_at": now.isoformat(),
                "created_by": current_user["id"]
            })
            
            logger.info(f"Importados {len(motoristas_importados)} motoristas para ganhos_uber")
        
        return resultado
        
    except Exception as e:
        logger.error(f"Erro na extração: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.post("/admin/extrair-todos")
async def extrair_todos_parceiros(
    current_user: dict = Depends(get_current_user)
):
    """Admin extrai rendimentos de todos os parceiros com sessão ativa"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Buscar parceiros com credenciais
    credenciais = await db.credenciais_uber.find({}).to_list(length=100)
    
    resultados = []
    
    for cred in credenciais:
        parceiro_id = cred["parceiro_id"]
        session_path = f"/tmp/uber_sessao_{parceiro_id}.json"
        
        # Verificar se tem sessão ativa
        if not os.path.exists(session_path):
            resultados.append({
                "parceiro_id": parceiro_id,
                "sucesso": False,
                "erro": "Sessão não encontrada"
            })
            continue
        
        mtime = os.path.getmtime(session_path)
        idade_dias = (datetime.now().timestamp() - mtime) / 86400
        
        if idade_dias >= 30:
            resultados.append({
                "parceiro_id": parceiro_id,
                "sucesso": False,
                "erro": "Sessão expirada"
            })
            continue
        
        try:
            from services.uber_extractor import extrair_rendimentos_parceiro as extrair
            
            resultado = await extrair(parceiro_id, cred["email"], cred["password"])
            
            if resultado.get("sucesso"):
                now = datetime.now(timezone.utc)
                
                await db.importacoes_uber.insert_one({
                    "parceiro_id": parceiro_id,
                    "motoristas": resultado.get("motoristas", []),
                    "total_motoristas": resultado.get("total_motoristas", 0),
                    "total_rendimentos": resultado.get("total_rendimentos", 0),
                    "ficheiro": resultado.get("ficheiro"),
                    "created_at": now.isoformat(),
                    "created_by": current_user["id"]
                })
            
            resultados.append({
                "parceiro_id": parceiro_id,
                **resultado
            })
            
        except Exception as e:
            resultados.append({
                "parceiro_id": parceiro_id,
                "sucesso": False,
                "erro": str(e)
            })
    
    # Resumo
    sucesso = sum(1 for r in resultados if r.get("sucesso"))
    falha = len(resultados) - sucesso
    
    return {
        "total": len(resultados),
        "sucesso": sucesso,
        "falha": falha,
        "detalhes": resultados
    }


@router.get("/admin/historico")
async def get_historico_geral(
    current_user: dict = Depends(get_current_user)
):
    """Admin obtém histórico geral de importações"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    cursor = db.importacoes_uber.find(
        {},
        {"_id": 0, "motoristas": 0}
    ).sort("created_at", -1).limit(50)
    
    return await cursor.to_list(length=50)
