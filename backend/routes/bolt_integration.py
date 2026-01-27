"""
Rotas para Integração Bolt (Scraping e Sincronização)
Extraído do server.py para melhor organização
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Optional
from datetime import datetime, timezone
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bolt", tags=["bolt-integration"])
db = get_database()


@router.post("/test-connection")
async def test_bolt_connection(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Testar conexão com Bolt Partner usando credenciais fornecidas"""
    try:
        if current_user["role"] not in ["admin", "gestao", "parceiro"]:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        email = request.get("email")
        password = request.get("password")
        
        if not email or not password:
            raise HTTPException(status_code=400, detail="Email e password são obrigatórios")
        
        logger.info(f"🧪 Testando conexão Bolt para: {email}")
        
        try:
            from integrations.bolt_scraper import test_bolt_connection as bolt_test
            result = await bolt_test(email, password)
            return result
        except ImportError:
            return {
                "success": False,
                "message": "Módulo de integração Bolt não disponível"
            }
        
    except Exception as e:
        logger.error(f"Erro ao testar conexão Bolt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-earnings")
async def sync_bolt_earnings(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Sincronizar ganhos da Bolt para um parceiro"""
    try:
        if current_user["role"] not in ["admin", "gestao", "parceiro"]:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        parceiro_id = request.get("parceiro_id")
        email = request.get("email")
        password = request.get("password")
        
        if not all([parceiro_id, email, password]):
            raise HTTPException(status_code=400, detail="Dados incompletos")
        
        logger.info(f"🔄 Iniciando sincronização Bolt para parceiro: {parceiro_id}")
        
        # Buscar parceiro
        parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
        if not parceiro:
            # Tentar buscar na collection users
            parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
        
        if not parceiro:
            raise HTTPException(status_code=404, detail="Parceiro não encontrado")
        
        # Criar log de sincronização
        log_id = str(uuid.uuid4())
        log = {
            "id": log_id,
            "parceiro_id": parceiro_id,
            "plataforma": "bolt",
            "tipo": "manual",
            "status": "em_progresso",
            "data_inicio": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user["id"]
        }
        await db.logs_sincronizacao_parceiro.insert_one(log)
        
        try:
            from integrations.bolt_scraper import BoltScraper
            
            async with BoltScraper(headless=True) as scraper:
                login_success = await scraper.login(email, password)
                
                if not login_success:
                    await db.logs_sincronizacao_parceiro.update_one(
                        {"id": log_id},
                        {"$set": {
                            "status": "erro",
                            "mensagem_erro": "Falha no login. Verifique as credenciais.",
                            "data_fim": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    return {
                        "success": False,
                        "message": "Falha no login. Verifique as credenciais."
                    }
                
                await scraper.navigate_to_earnings()
                earnings_data = await scraper.extract_earnings_data()
                
                if earnings_data.get("success"):
                    ganho_bolt = {
                        "id": str(uuid.uuid4()),
                        "parceiro_id": parceiro_id,
                        "plataforma": "bolt",
                        "periodo_inicio": earnings_data.get("period_start"),
                        "periodo_fim": earnings_data.get("period_end"),
                        "valor_total": earnings_data.get("total_earnings", 0),
                        "num_viagens": earnings_data.get("trips_count", 0),
                        "data_extracao": earnings_data.get("extracted_at"),
                        "dados_completos": earnings_data,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.ganhos_bolt.insert_one(ganho_bolt)
                    
                    await db.logs_sincronizacao_parceiro.update_one(
                        {"id": log_id},
                        {"$set": {
                            "status": "sucesso",
                            "data_fim": datetime.now(timezone.utc).isoformat(),
                            "registos_extraidos": 1,
                            "valor_total": earnings_data.get("total_earnings", 0)
                        }}
                    )
                    
                    await db.configuracoes_sincronizacao.update_one(
                        {"parceiro_id": parceiro_id},
                        {"$set": {
                            "ultima_sincronizacao": datetime.now(timezone.utc).isoformat(),
                            "status": "sucesso"
                        }},
                        upsert=True
                    )
                    
                    return {
                        "success": True,
                        "message": f"Sincronização concluída! Ganhos: €{earnings_data.get('total_earnings', 0)}",
                        "data": earnings_data
                    }
                else:
                    await db.logs_sincronizacao_parceiro.update_one(
                        {"id": log_id},
                        {"$set": {
                            "status": "erro",
                            "mensagem_erro": earnings_data.get("error", "Erro desconhecido"),
                            "data_fim": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    return {
                        "success": False,
                        "message": f"Erro ao extrair dados: {earnings_data.get('error')}"
                    }
                    
        except ImportError:
            await db.logs_sincronizacao_parceiro.update_one(
                {"id": log_id},
                {"$set": {
                    "status": "erro",
                    "mensagem_erro": "Módulo de integração Bolt não disponível",
                    "data_fim": datetime.now(timezone.utc).isoformat()
                }}
            )
            return {
                "success": False,
                "message": "Módulo de integração Bolt não disponível"
            }
        
    except Exception as e:
        logger.error(f"Erro na sincronização Bolt: {e}")
        if 'log_id' in locals():
            await db.logs_sincronizacao_parceiro.update_one(
                {"id": log_id},
                {"$set": {
                    "status": "erro",
                    "mensagem_erro": str(e),
                    "data_fim": datetime.now(timezone.utc).isoformat()
                }}
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-credentials")
async def save_bolt_credentials(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Guardar credenciais da Bolt para um parceiro"""
    try:
        if current_user["role"] not in ["admin", "gestao", "parceiro"]:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        parceiro_id = request.get("parceiro_id")
        email = request.get("email")
        password = request.get("password")
        
        if not all([parceiro_id, email, password]):
            raise HTTPException(status_code=400, detail="Dados incompletos")
        
        # Verificar se parceiro existe
        parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
        if not parceiro:
            parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
        
        if not parceiro:
            raise HTTPException(status_code=404, detail="Parceiro não encontrado")
        
        cred = {
            "parceiro_id": parceiro_id,
            "plataforma": "bolt",
            "email": email,
            "password": password,
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        existing = await db.credenciais_bolt.find_one({
            "parceiro_id": parceiro_id,
            "plataforma": "bolt"
        })
        
        if existing:
            await db.credenciais_bolt.update_one(
                {"parceiro_id": parceiro_id, "plataforma": "bolt"},
                {"$set": cred}
            )
            message = "Credenciais atualizadas"
        else:
            await db.credenciais_bolt.insert_one(cred)
            message = "Credenciais guardadas"
        
        return {"success": True, "message": message}
        
    except Exception as e:
        logger.error(f"Erro ao guardar credenciais: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/credentials/{parceiro_id}")
async def get_bolt_credentials(
    parceiro_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter credenciais da Bolt de um parceiro"""
    if current_user["role"] not in ["admin", "gestao"]:
        if current_user["role"] == "parceiro" and current_user["id"] != parceiro_id:
            raise HTTPException(status_code=403, detail="Acesso negado")
    
    cred = await db.credenciais_bolt.find_one(
        {"parceiro_id": parceiro_id, "plataforma": "bolt"},
        {"_id": 0, "password": 0}
    )
    
    return cred or {"message": "Credenciais não configuradas"}


@router.get("/sync-logs/{parceiro_id}")
async def get_bolt_sync_logs(
    parceiro_id: str,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Obter logs de sincronização Bolt de um parceiro"""
    if current_user["role"] not in ["admin", "gestao"]:
        if current_user["role"] == "parceiro" and current_user["id"] != parceiro_id:
            raise HTTPException(status_code=403, detail="Acesso negado")
    
    logs = await db.logs_sincronizacao_parceiro.find(
        {"parceiro_id": parceiro_id, "plataforma": "bolt"},
        {"_id": 0}
    ).sort("data_inicio", -1).limit(limit).to_list(limit)
    
    return logs
