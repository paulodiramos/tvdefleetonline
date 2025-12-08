"""
Moloni Auto-Invoicing Service
Handles automatic invoice generation when earnings reports are created
"""

import logging
import httpx
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class MoloniService:
    """Service for Moloni API integration and automatic invoicing"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.moloni_api_url = "https://api.moloni.pt/v1"
        self.http_client = httpx.AsyncClient(timeout=30.0)
    
    async def get_driver_moloni_config(self, motorista_id: str) -> Optional[Dict[str, Any]]:
        """Get Moloni configuration for a driver"""
        try:
            config = await self.db.users.find_one(
                {"id": motorista_id, "moloni_config": {"$exists": True}},
                {"_id": 0, "moloni_config": 1}
            )
            
            if config and "moloni_config" in config:
                return config["moloni_config"]
            return None
            
        except Exception as e:
            logger.error(f"Error fetching Moloni config for driver {motorista_id}: {e}")
            return None
    
    async def check_driver_has_moloni_feature(self, motorista_id: str) -> bool:
        """Check if driver's plan includes Moloni auto-invoicing feature"""
        try:
            # Get motorista data
            motorista = await self.db.motoristas.find_one(
                {"id": motorista_id},
                {"_id": 0, "plano_id": 1}
            )
            
            if not motorista or not motorista.get("plano_id"):
                return False
            
            # Get plan features
            plano = await self.db.planos_sistema.find_one(
                {"id": motorista["plano_id"]},
                {"_id": 0, "features": 1}
            )
            
            if not plano:
                return False
            
            features = plano.get("features", [])
            return "moloni_auto_faturacao" in features
            
        except Exception as e:
            logger.error(f"Error checking Moloni feature for driver {motorista_id}: {e}")
            return False
    
    async def get_or_refresh_token(self, driver_id: str, moloni_config: Dict[str, Any]) -> Optional[str]:
        """Get valid access token, refreshing if necessary"""
        try:
            # Check if we have a stored token
            token_doc = await self.db.moloni_tokens.find_one({"driver_id": driver_id})
            
            if token_doc:
                # Check if token is still valid (with 5 min buffer)
                expires_at = token_doc.get("expires_at")
                if expires_at:
                    if isinstance(expires_at, str):
                        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    
                    if datetime.now(timezone.utc) < expires_at - timedelta(minutes=5):
                        return token_doc["access_token"]
            
            # Need to refresh or get new token
            return await self.refresh_or_acquire_token(driver_id, moloni_config)
            
        except Exception as e:
            logger.error(f"Error getting token for driver {driver_id}: {e}")
            return None
    
    async def refresh_or_acquire_token(self, driver_id: str, moloni_config: Dict[str, Any]) -> Optional[str]:
        """Refresh existing token or acquire new one"""
        try:
            # Try to get existing token for refresh
            token_doc = await self.db.moloni_tokens.find_one({"driver_id": driver_id})
            
            if token_doc and token_doc.get("refresh_token"):
                # Try refresh flow
                response = await self.http_client.post(
                    f"{self.moloni_api_url}/grant/",
                    params={
                        "grant_type": "refresh_token",
                        "client_id": moloni_config["client_id"],
                        "client_secret": moloni_config["client_secret"],
                        "refresh_token": token_doc["refresh_token"]
                    }
                )
                
                if response.status_code == 200:
                    token_data = response.json()
                    await self._store_token(driver_id, token_data)
                    return token_data["access_token"]
            
            # Fall back to password grant (initial setup)
            response = await self.http_client.post(
                f"{self.moloni_api_url}/grant/",
                params={
                    "grant_type": "password",
                    "client_id": moloni_config["client_id"],
                    "client_secret": moloni_config["client_secret"],
                    "username": moloni_config.get("username", ""),
                    "password": moloni_config.get("password", "")
                }
            )
            
            if response.status_code == 200:
                token_data = response.json()
                await self._store_token(driver_id, token_data)
                return token_data["access_token"]
            
            logger.error(f"Failed to acquire token for driver {driver_id}: {response.text}")
            return None
            
        except Exception as e:
            logger.error(f"Error refreshing token for driver {driver_id}: {e}")
            return None
    
    async def _store_token(self, driver_id: str, token_data: Dict[str, Any]):
        """Store access token in database"""
        try:
            expires_in = token_data.get("expires_in", 3600)
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            
            await self.db.moloni_tokens.update_one(
                {"driver_id": driver_id},
                {
                    "$set": {
                        "access_token": token_data["access_token"],
                        "refresh_token": token_data.get("refresh_token", ""),
                        "expires_at": expires_at.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$setOnInsert": {
                        "driver_id": driver_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                upsert=True
            )
        except Exception as e:
            logger.error(f"Error storing token for driver {driver_id}: {e}")
    
    async def create_invoice_for_report(
        self,
        motorista_id: str,
        relatorio_id: str,
        valor_total: float,
        periodo_inicio: str,
        periodo_fim: str
    ) -> Dict[str, Any]:
        """
        Create Moloni invoice for an earnings report
        Returns: {"success": bool, "moloni_invoice_id": int, "error": str}
        """
        try:
            # 1. Check if driver has Moloni feature enabled
            has_feature = await self.check_driver_has_moloni_feature(motorista_id)
            if not has_feature:
                logger.info(f"Driver {motorista_id} does not have Moloni feature enabled")
                return {
                    "success": False,
                    "error": "Moloni auto-invoicing not enabled in driver's plan"
                }
            
            # 2. Get driver's Moloni configuration
            moloni_config = await self.get_driver_moloni_config(motorista_id)
            if not moloni_config:
                logger.info(f"No Moloni config found for driver {motorista_id}")
                return {
                    "success": False,
                    "error": "Moloni credentials not configured for this driver"
                }
            
            # 3. Get motorista and parceiro data
            motorista = await self.db.motoristas.find_one(
                {"id": motorista_id},
                {"_id": 0, "name": 1, "parceiro_atribuido": 1, "nif": 1}
            )
            
            if not motorista or not motorista.get("parceiro_atribuido"):
                return {
                    "success": False,
                    "error": "Driver has no associated partner for invoicing"
                }
            
            parceiro = await self.db.parceiros.find_one(
                {"id": motorista["parceiro_atribuido"]},
                {"_id": 0, "nome_empresa": 1, "contribuinte_empresa": 1, "email_empresa": 1}
            )
            
            if not parceiro:
                return {
                    "success": False,
                    "error": "Partner not found"
                }
            
            # 4. Get or refresh access token
            access_token = await self.get_or_refresh_token(motorista_id, moloni_config)
            if not access_token:
                return {
                    "success": False,
                    "error": "Failed to obtain Moloni access token"
                }
            
            # 5. Get company_id from config
            company_id = moloni_config.get("company_id")
            if not company_id:
                return {
                    "success": False,
                    "error": "Moloni company_id not configured"
                }
            
            # 6. Check if partner (client) exists in Moloni or create it
            customer_id = await self._ensure_customer_exists(
                access_token,
                company_id,
                parceiro
            )
            
            if not customer_id:
                return {
                    "success": False,
                    "error": "Failed to create or find customer in Moloni"
                }
            
            # 7. Create invoice in Moloni
            invoice_id = await self._create_moloni_invoice(
                access_token=access_token,
                company_id=company_id,
                customer_id=customer_id,
                valor_total=valor_total,
                periodo_inicio=periodo_inicio,
                periodo_fim=periodo_fim,
                motorista_nome=motorista.get("name", ""),
                relatorio_id=relatorio_id
            )
            
            if invoice_id:
                # Store invoice reference
                await self.db.moloni_invoices.insert_one({
                    "relatorio_id": relatorio_id,
                    "motorista_id": motorista_id,
                    "parceiro_id": motorista["parceiro_atribuido"],
                    "moloni_invoice_id": invoice_id,
                    "valor_total": valor_total,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                return {
                    "success": True,
                    "moloni_invoice_id": invoice_id
                }
            
            return {
                "success": False,
                "error": "Failed to create invoice in Moloni"
            }
            
        except Exception as e:
            logger.error(f"Error creating invoice for report {relatorio_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _ensure_customer_exists(
        self,
        access_token: str,
        company_id: int,
        parceiro: Dict[str, Any]
    ) -> Optional[int]:
        """Ensure customer exists in Moloni, create if not exists"""
        try:
            # Search for customer by taxpayer ID (NIF)
            nif = parceiro.get("contribuinte_empresa", "")
            
            response = await self.http_client.post(
                f"{self.moloni_api_url}/customers/getByVat/",
                params={
                    "access_token": access_token,
                    "company_id": company_id,
                    "vat": nif
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    return data[0].get("customer_id")
            
            # Customer doesn't exist, create it
            create_response = await self.http_client.post(
                f"{self.moloni_api_url}/customers/insert/",
                params={
                    "access_token": access_token,
                    "company_id": company_id,
                    "vat": nif,
                    "number": nif,
                    "name": parceiro.get("nome_empresa", ""),
                    "email": parceiro.get("email_empresa", ""),
                    "country_id": 1  # Portugal
                }
            )
            
            if create_response.status_code == 200:
                create_data = create_response.json()
                return create_data.get("customer_id")
            
            logger.error(f"Failed to create customer: {create_response.text}")
            return None
            
        except Exception as e:
            logger.error(f"Error ensuring customer exists: {e}")
            return None
    
    async def _create_moloni_invoice(
        self,
        access_token: str,
        company_id: int,
        customer_id: int,
        valor_total: float,
        periodo_inicio: str,
        periodo_fim: str,
        motorista_nome: str,
        relatorio_id: str
    ) -> Optional[int]:
        """Create invoice in Moloni"""
        try:
            # Get document set (use default invoice document set)
            doc_set_response = await self.http_client.post(
                f"{self.moloni_api_url}/documentSets/getAll/",
                params={
                    "access_token": access_token,
                    "company_id": company_id
                }
            )
            
            document_set_id = 1  # Default
            if doc_set_response.status_code == 200:
                doc_sets = doc_set_response.json()
                # Find invoice document set
                for doc_set in doc_sets:
                    if doc_set.get("document_type_id") == 1:  # Invoice type
                        document_set_id = doc_set.get("document_set_id")
                        break
            
            # Create invoice
            invoice_data = {
                "access_token": access_token,
                "company_id": company_id,
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "expiration_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "document_set_id": document_set_id,
                "customer_id": customer_id,
                "our_reference": relatorio_id[:20],  # Limit to 20 chars
                "your_reference": f"Relatório {periodo_inicio} - {periodo_fim}",
                "products": [
                    {
                        "name": f"Serviços TVDE - {motorista_nome}",
                        "summary": f"Relatório de ganhos período {periodo_inicio} a {periodo_fim}",
                        "qty": 1,
                        "price": valor_total,
                        "discount": 0,
                        "order": 0,
                        "exemption_reason": "",
                        "taxes": [
                            {
                                "tax_id": 1,  # IVA normal (Portugal)
                                "value": 23,
                                "order": 0,
                                "cumulative": 0
                            }
                        ]
                    }
                ],
                "status": 1  # Draft status
            }
            
            response = await self.http_client.post(
                f"{self.moloni_api_url}/invoices/insert/",
                params=invoice_data
            )
            
            if response.status_code == 200:
                result = response.json()
                invoice_id = result.get("document_id")
                logger.info(f"Successfully created Moloni invoice {invoice_id} for report {relatorio_id}")
                return invoice_id
            
            logger.error(f"Failed to create Moloni invoice: {response.text}")
            return None
            
        except Exception as e:
            logger.error(f"Error creating Moloni invoice: {e}")
            return None
    
    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()
