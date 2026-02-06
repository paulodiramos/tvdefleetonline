"""
Bolt Fleet API Integration Service
Official API documentation: https://fleets.bolt.eu/api-docs
"""
import aiohttp
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, List
import logging

logger = logging.getLogger(__name__)

class BoltAPIClient:
    """Client for Bolt Fleet API with OAuth2 authentication"""
    
    TOKEN_URL = "https://oidc.bolt.eu/token"
    API_BASE_URL = "https://node.bolt.eu/fleet-integration-gateway"
    
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._session is None or self._session.closed:
            # Use headers that mimic a real browser/application
            connector = aiohttp.TCPConnector(ssl=False)
            self._session = aiohttp.ClientSession(
                connector=connector,
                headers={
                    'User-Agent': 'BoltFleetIntegration/1.0',
                    'Accept': 'application/json',
                }
            )
        return self._session
    
    async def close(self):
        """Close the session"""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def _get_access_token(self) -> str:
        """Get access token, refreshing if needed"""
        # Check if we have a valid token
        if self._access_token and self._token_expires_at:
            # Refresh 1 minute before expiration
            if datetime.now(timezone.utc) < (self._token_expires_at - timedelta(minutes=1)):
                return self._access_token
        
        # Get new token
        session = await self._get_session()
        
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'client_credentials',
            'scope': 'fleet-integration:api'
        }
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        try:
            async with session.post(self.TOKEN_URL, data=data, headers=headers) as response:
                response_text = await response.text()
                
                if response.status == 401:
                    logger.error(f"Bolt auth failed (401): {response_text}")
                    raise Exception("Credenciais inválidas. Verifique o Client ID e Client Secret.")
                
                if response.status == 403:
                    logger.error(f"Bolt auth forbidden (403): {response_text}")
                    raise Exception("Acesso negado. Verifique se a sua conta Bolt tem acesso à API Fleet Integration.")
                
                if response.status == 400:
                    logger.error(f"Bolt bad request (400): {response_text}")
                    try:
                        error_json = await response.json()
                        error_desc = error_json.get('error_description', error_json.get('error', response_text))
                        raise Exception(f"Erro na requisição: {error_desc}")
                    except:
                        raise Exception(f"Erro na requisição: {response_text}")
                
                if response.status != 200:
                    logger.error(f"Bolt token error: {response.status} - {response_text}")
                    raise Exception(f"Erro ao obter token Bolt (HTTP {response.status})")
                
                try:
                    token_data = await response.json()
                except:
                    token_data = None
                    # Try to parse the text response
                    import json
                    token_data = json.loads(response_text)
                
                self._access_token = token_data['access_token']
                expires_in = token_data.get('expires_in', 600)  # Default 10 minutes
                self._token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                
                logger.info(f"Bolt token obtained, expires in {expires_in}s")
                return self._access_token
                
        except aiohttp.ClientError as e:
            logger.error(f"Bolt token request failed: {e}")
            raise Exception(f"Connection error getting Bolt token: {e}")
    
    async def _make_request(self, method: str, endpoint: str, params: Dict = None, json_data: Dict = None) -> Dict:
        """Make authenticated request to Bolt API"""
        token = await self._get_access_token()
        session = await self._get_session()
        
        url = f"{self.API_BASE_URL}{endpoint}"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        try:
            async with session.request(method, url, headers=headers, params=params, json=json_data) as response:
                if response.status == 401:
                    # Token expired, clear and retry once
                    self._access_token = None
                    self._token_expires_at = None
                    token = await self._get_access_token()
                    headers['Authorization'] = f'Bearer {token}'
                    async with session.request(method, url, headers=headers, params=params, json=json_data) as retry_response:
                        if retry_response.status != 200:
                            error_text = await retry_response.text()
                            raise Exception(f"Bolt API error after retry: {retry_response.status} - {error_text}")
                        return await retry_response.json()
                
                if response.status == 429:
                    # Rate limited - wait and retry
                    logger.warning("Bolt API rate limited, waiting 2 seconds...")
                    await asyncio.sleep(2)
                    async with session.request(method, url, headers=headers, params=params, json=json_data) as retry_response:
                        if retry_response.status != 200:
                            error_text = await retry_response.text()
                            raise Exception(f"Bolt API error: {retry_response.status} - {error_text}")
                        return await retry_response.json()
                
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Bolt API error: {response.status} - {error_text}")
                
                return await response.json()
                
        except aiohttp.ClientError as e:
            logger.error(f"Bolt API request failed: {e}")
            raise Exception(f"Connection error to Bolt API: {e}")
    
    async def test_connection(self) -> Dict:
        """Test API connection by getting a token"""
        try:
            token = await self._get_access_token()
            return {
                "success": True,
                "message": "Conexão com Bolt API estabelecida com sucesso",
                "token_expires_at": self._token_expires_at.isoformat() if self._token_expires_at else None
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e)
            }
    
    # ==================== Fleet Endpoints ====================
    # Based on https://apidocs.bolt.eu/fleetIntegration/fleetIntegrationGatewayAuth/
    
    async def test_api(self) -> Dict:
        """Test API endpoint - POST /fleetIntegration/v1/test"""
        return await self._make_request('POST', '/fleetIntegration/v1/test', json_data={})
    
    async def get_companies(self) -> Dict:
        """Get fleet companies - GET /fleetIntegration/v1/getCompanies"""
        return await self._make_request('GET', '/fleetIntegration/v1/getCompanies')
    
    async def get_drivers(self, company_id: int, start_ts: int = None, end_ts: int = None, limit: int = 100, offset: int = 0) -> Dict:
        """Get list of drivers - POST /fleetIntegration/v1/getDrivers"""
        if not start_ts:
            # Default: last 30 days (Unix timestamp in seconds)
            start_ts = int((datetime.now(timezone.utc) - timedelta(days=30)).timestamp())
        if not end_ts:
            end_ts = int(datetime.now(timezone.utc).timestamp())
            
        json_data = {
            "company_id": company_id,
            "start_ts": start_ts,
            "end_ts": end_ts,
            "limit": limit,
            "offset": offset
        }
        return await self._make_request('POST', '/fleetIntegration/v1/getDrivers', json_data=json_data)
    
    async def get_vehicles(self, company_id: int, start_ts: int = None, end_ts: int = None, limit: int = 100, offset: int = 0) -> Dict:
        """Get list of vehicles - POST /fleetIntegration/v1/getVehicles"""
        if not start_ts:
            start_ts = int((datetime.now(timezone.utc) - timedelta(days=30)).timestamp())
        if not end_ts:
            end_ts = int(datetime.now(timezone.utc).timestamp())
            
        json_data = {
            "company_id": company_id,
            "start_ts": start_ts,
            "end_ts": end_ts,
            "limit": limit,
            "offset": offset
        }
        return await self._make_request('POST', '/fleetIntegration/v1/getVehicles', json_data=json_data)
    
    async def get_fleet_orders(self, company_id: int, start_ts: int, end_ts: int, limit: int = 100, offset: int = 0) -> Dict:
        """
        Get fleet orders (rides/trips) - POST /fleetIntegration/v1/getFleetOrders
        Note: company_ids must be an array according to API validation
        """
        json_data = {
            "company_ids": [company_id],  # Must be array
            "start_ts": start_ts,
            "end_ts": end_ts,
            "limit": limit,
            "offset": offset
        }
        return await self._make_request('POST', '/fleetIntegration/v1/getFleetOrders', json_data=json_data)
    
    async def get_fleet_state_logs(self, company_id: int, start_ts: int, end_ts: int, limit: int = 100, offset: int = 0) -> Dict:
        """
        Get driver state logs - POST /fleetIntegration/v1/getFleetStateLogs
        """
        json_data = {
            "company_id": company_id,
            "start_ts": start_ts,
            "end_ts": end_ts,
            "limit": limit,
            "offset": offset
        }
        return await self._make_request('POST', '/fleetIntegration/v1/getFleetStateLogs', json_data=json_data)
    
    async def get_driver_earnings(self, company_id: int, start_ts: int, end_ts: int) -> Dict:
        """
        Try to get driver earnings - POST /fleetIntegration/v1/getDriverEarnings
        Note: This endpoint may not exist in all Bolt API versions
        """
        json_data = {
            "company_id": company_id,
            "start_ts": start_ts,
            "end_ts": end_ts
        }
        try:
            return await self._make_request('POST', '/fleetIntegration/v1/getDriverEarnings', json_data=json_data)
        except Exception as e:
            logger.warning(f"getDriverEarnings endpoint not available: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_weekly_reports(self, company_id: int, start_ts: int, end_ts: int) -> Dict:
        """
        Try to get weekly reports - POST /fleetIntegration/v1/getWeeklyReports
        Note: This endpoint may not exist in all Bolt API versions
        """
        json_data = {
            "company_id": company_id,
            "start_ts": start_ts,
            "end_ts": end_ts
        }
        try:
            return await self._make_request('POST', '/fleetIntegration/v1/getWeeklyReports', json_data=json_data)
        except Exception as e:
            logger.warning(f"getWeeklyReports endpoint not available: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_driver_compensations(self, company_id: int, start_ts: int, end_ts: int) -> Dict:
        """
        Try to get driver compensations/bonuses - POST /fleetIntegration/v1/getDriverCompensations
        Note: This endpoint may not exist in all Bolt API versions
        """
        json_data = {
            "company_id": company_id,
            "start_ts": start_ts,
            "end_ts": end_ts
        }
        try:
            return await self._make_request('POST', '/fleetIntegration/v1/getDriverCompensations', json_data=json_data)
        except Exception as e:
            logger.warning(f"getDriverCompensations endpoint not available: {e}")
            return {"success": False, "error": str(e)}


# ==================== Helper Functions ====================

async def test_bolt_api_credentials(client_id: str, client_secret: str) -> Dict:
    """Test Bolt API credentials"""
    client = BoltAPIClient(client_id, client_secret)
    try:
        result = await client.test_connection()
        return result
    finally:
        await client.close()


async def sync_bolt_data(client_id: str, client_secret: str, start_date: str, end_date: str) -> Dict:
    """
    Sync data from Bolt API
    Returns drivers, vehicles and orders data
    """
    client = BoltAPIClient(client_id, client_secret)
    try:
        # Get companies first
        companies_data = await client.get_companies()
        
        if companies_data.get("code") != 0:
            return {
                "success": False,
                "error": f"Erro ao obter empresas: {companies_data.get('message')}"
            }
        
        company_ids = companies_data.get("data", {}).get("company_ids", [])
        if not company_ids:
            return {
                "success": False,
                "error": "Nenhuma empresa encontrada na conta Bolt"
            }
        
        company_id = company_ids[0]  # Use first company
        
        # Convert dates to Unix timestamps
        try:
            start_ts = int(datetime.fromisoformat(start_date.replace('Z', '+00:00')).timestamp())
        except:
            start_ts = int((datetime.now(timezone.utc) - timedelta(days=30)).timestamp())
        
        try:
            end_ts = int(datetime.fromisoformat(end_date.replace('Z', '+00:00')).timestamp())
        except:
            end_ts = int(datetime.now(timezone.utc).timestamp())
        
        # Get drivers
        drivers_data = await client.get_drivers(company_id, start_ts, end_ts)
        
        # Get vehicles
        vehicles_data = await client.get_vehicles(company_id, start_ts, end_ts)
        
        # Get orders (rides) for the date range
        orders_data = await client.get_fleet_orders(company_id, start_ts, end_ts)
        
        return {
            "success": True,
            "company_id": company_id,
            "companies": companies_data,
            "drivers": drivers_data,
            "vehicles": vehicles_data,
            "orders": orders_data,
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        await client.close()
