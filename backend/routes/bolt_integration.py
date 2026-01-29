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


# ==================== BOLT OFFICIAL API ENDPOINTS ====================

@router.post("/api/test-connection")
async def test_bolt_api_connection(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Testar conexão com Bolt API oficial usando client_id e client_secret"""
    try:
        if current_user["role"] not in ["admin", "gestao", "parceiro"]:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        client_id = request.get("client_id")
        client_secret = request.get("client_secret")
        
        if not client_id or not client_secret:
            raise HTTPException(status_code=400, detail="Client ID e Client Secret são obrigatórios")
        
        logger.info(f"🧪 Testando conexão Bolt API para client_id: {client_id[:8]}...")
        
        from services.bolt_api_service import test_bolt_api_credentials
        result = await test_bolt_api_credentials(client_id, client_secret)
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao testar conexão Bolt API: {e}")
        return {
            "success": False,
            "message": str(e)
        }


@router.post("/api/save-credentials")
async def save_bolt_api_credentials(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Guardar credenciais da Bolt API oficial"""
    try:
        if current_user["role"] not in ["admin", "gestao", "parceiro"]:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        parceiro_id = current_user["id"] if current_user["role"] == "parceiro" else request.get("parceiro_id")
        client_id = request.get("client_id")
        client_secret = request.get("client_secret")
        
        if not all([parceiro_id, client_id, client_secret]):
            raise HTTPException(status_code=400, detail="Dados incompletos")
        
        cred = {
            "parceiro_id": parceiro_id,
            "plataforma": "bolt_api",
            "client_id": client_id,
            "client_secret": client_secret,
            "tipo": "api_oficial",
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        existing = await db.credenciais_bolt_api.find_one({
            "parceiro_id": parceiro_id,
            "plataforma": "bolt_api"
        })
        
        if existing:
            await db.credenciais_bolt_api.update_one(
                {"parceiro_id": parceiro_id, "plataforma": "bolt_api"},
                {"$set": cred}
            )
            message = "Credenciais API atualizadas"
        else:
            await db.credenciais_bolt_api.insert_one(cred)
            message = "Credenciais API guardadas"
        
        logger.info(f"✅ Credenciais Bolt API guardadas para parceiro {parceiro_id}")
        return {"success": True, "message": message}
        
    except Exception as e:
        logger.error(f"Erro ao guardar credenciais Bolt API: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/credentials")
async def get_bolt_api_credentials(
    current_user: dict = Depends(get_current_user)
):
    """Obter credenciais da Bolt API do parceiro atual"""
    parceiro_id = current_user["id"]
    
    cred = await db.credenciais_bolt_api.find_one(
        {"parceiro_id": parceiro_id, "plataforma": "bolt_api"},
        {"_id": 0, "client_secret": 0}  # Não retorna o secret
    )
    
    if cred:
        # Mascarar client_id parcialmente
        cred["client_id_masked"] = cred.get("client_id", "")[:8] + "..." if cred.get("client_id") else None
        cred["has_secret"] = True
    
    return cred or {"configured": False, "message": "Credenciais API não configuradas"}


@router.post("/api/sync-data")
async def sync_bolt_api_data(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Sincronizar dados via Bolt API oficial"""
    try:
        if current_user["role"] not in ["admin", "gestao", "parceiro"]:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        parceiro_id = current_user["id"] if current_user["role"] == "parceiro" else request.get("parceiro_id")
        start_date = request.get("start_date")
        end_date = request.get("end_date")
        
        # Buscar credenciais
        cred = await db.credenciais_bolt_api.find_one({
            "parceiro_id": parceiro_id,
            "plataforma": "bolt_api",
            "ativo": True
        })
        
        if not cred:
            raise HTTPException(status_code=400, detail="Credenciais Bolt API não configuradas")
        
        # Criar log de sincronização
        log_id = str(uuid.uuid4())
        log = {
            "id": log_id,
            "parceiro_id": parceiro_id,
            "plataforma": "bolt_api",
            "tipo": "api_oficial",
            "status": "em_progresso",
            "data_inicio": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user["id"]
        }
        await db.logs_sincronizacao_parceiro.insert_one(log)
        
        try:
            from services.bolt_api_service import sync_bolt_data
            
            result = await sync_bolt_data(
                cred["client_id"],
                cred["client_secret"],
                start_date or (datetime.now(timezone.utc).replace(day=1)).isoformat(),
                end_date or datetime.now(timezone.utc).isoformat()
            )
            
            if result.get("success"):
                # Guardar dados sincronizados
                sync_record = {
                    "id": str(uuid.uuid4()),
                    "parceiro_id": parceiro_id,
                    "plataforma": "bolt_api",
                    "tipo_dados": "sync_completo",
                    "companies_data": result.get("companies"),
                    "drivers_data": result.get("drivers"),
                    "vehicles_data": result.get("vehicles"),
                    "orders_data": result.get("orders"),
                    "synced_at": result.get("synced_at"),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.bolt_api_sync_data.insert_one(sync_record)
                
                # Atualizar log
                drivers_list = result.get("drivers", {}).get("rows", result.get("drivers", {}).get("data", []))
                vehicles_list = result.get("vehicles", {}).get("rows", result.get("vehicles", {}).get("data", []))
                orders_list = result.get("orders", {}).get("rows", result.get("orders", {}).get("data", []))
                
                await db.logs_sincronizacao_parceiro.update_one(
                    {"id": log_id},
                    {"$set": {
                        "status": "sucesso",
                        "data_fim": datetime.now(timezone.utc).isoformat(),
                        "dados_sincronizados": {
                            "drivers": len(drivers_list) if isinstance(drivers_list, list) else 0,
                            "vehicles": len(vehicles_list) if isinstance(vehicles_list, list) else 0,
                            "orders": len(orders_list) if isinstance(orders_list, list) else 0,
                        }
                    }}
                )
                
                return {
                    "success": True,
                    "message": "Dados sincronizados com sucesso via Bolt API",
                    "summary": {
                        "drivers": len(drivers_list) if isinstance(drivers_list, list) else 0,
                        "vehicles": len(vehicles_list) if isinstance(vehicles_list, list) else 0,
                        "orders": len(orders_list) if isinstance(orders_list, list) else 0,
                    }
                }
            else:
                await db.logs_sincronizacao_parceiro.update_one(
                    {"id": log_id},
                    {"$set": {
                        "status": "erro",
                        "mensagem_erro": result.get("error", "Erro desconhecido"),
                        "data_fim": datetime.now(timezone.utc).isoformat()
                    }}
                )
                return {
                    "success": False,
                    "message": result.get("error", "Erro na sincronização")
                }
                
        except Exception as e:
            await db.logs_sincronizacao_parceiro.update_one(
                {"id": log_id},
                {"$set": {
                    "status": "erro",
                    "mensagem_erro": str(e),
                    "data_fim": datetime.now(timezone.utc).isoformat()
                }}
            )
            raise
        
    except Exception as e:
        logger.error(f"Erro na sincronização Bolt API: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/fleet-info")
async def get_bolt_fleet_info(
    current_user: dict = Depends(get_current_user)
):
    """Obter informações das empresas/frotas via Bolt API"""
    try:
        parceiro_id = current_user["id"]
        
        cred = await db.credenciais_bolt_api.find_one({
            "parceiro_id": parceiro_id,
            "plataforma": "bolt_api",
            "ativo": True
        })
        
        if not cred:
            raise HTTPException(status_code=400, detail="Credenciais Bolt API não configuradas")
        
        from services.bolt_api_service import BoltAPIClient
        
        client = BoltAPIClient(cred["client_id"], cred["client_secret"])
        try:
            companies = await client.get_companies()
            return {
                "success": True,
                "data": companies
            }
        finally:
            await client.close()
        
    except Exception as e:
        logger.error(f"Erro ao obter info da frota Bolt: {e}")
        return {
            "success": False,
            "message": str(e)
        }


@router.get("/api/drivers")
async def get_bolt_api_drivers(
    page: int = 1,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Obter lista de motoristas via Bolt API"""
    try:
        parceiro_id = current_user["id"]
        
        cred = await db.credenciais_bolt_api.find_one({
            "parceiro_id": parceiro_id,
            "plataforma": "bolt_api",
            "ativo": True
        })
        
        if not cred:
            raise HTTPException(status_code=400, detail="Credenciais Bolt API não configuradas")
        
        from services.bolt_api_service import BoltAPIClient
        
        client = BoltAPIClient(cred["client_id"], cred["client_secret"])
        try:
            # First get company ID
            companies = await client.get_companies()
            if companies.get("code") != 0:
                return {"success": False, "message": f"Erro: {companies.get('message')}"}
            
            company_ids = companies.get("data", {}).get("company_ids", [])
            if not company_ids:
                return {"success": False, "message": "Nenhuma empresa encontrada"}
            
            company_id = company_ids[0]
            drivers = await client.get_drivers(company_id, limit=limit, offset=(page-1)*limit)
            return {
                "success": True,
                "company_id": company_id,
                "data": drivers
            }
        finally:
            await client.close()
        
    except Exception as e:
        logger.error(f"Erro ao obter motoristas Bolt: {e}")
        return {
            "success": False,
            "message": str(e)
        }

