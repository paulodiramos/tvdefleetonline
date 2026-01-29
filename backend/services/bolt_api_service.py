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
    
    async def get_drivers(self, page: int = 1, limit: int = 100) -> Dict:
        """Get list of drivers - POST /fleetIntegration/v1/getDrivers"""
        json_data = {
            "pager": {
                "page": page,
                "pageSize": limit
            }
        }
        return await self._make_request('POST', '/fleetIntegration/v1/getDrivers', json_data=json_data)
    
    async def get_vehicles(self, page: int = 1, limit: int = 100) -> Dict:
        """Get list of vehicles - POST /fleetIntegration/v1/getVehicles"""
        json_data = {
            "pager": {
                "page": page,
                "pageSize": limit
            }
        }
        return await self._make_request('POST', '/fleetIntegration/v1/getVehicles', json_data=json_data)
    
    async def get_fleet_orders(self, start_date: str, end_date: str, page: int = 1, limit: int = 100) -> Dict:
        """
        Get fleet orders (rides/trips) - POST /fleetIntegration/v1/getFleetOrders
        Args:
            start_date: ISO format datetime
            end_date: ISO format datetime
        """
        json_data = {
            "pager": {
                "page": page,
                "pageSize": limit
            },
            "timeRange": {
                "start": start_date,
                "end": end_date
            }
        }
        return await self._make_request('POST', '/fleetIntegration/v1/getFleetOrders', json_data=json_data)
    
    async def get_fleet_state_logs(self, start_date: str, end_date: str, page: int = 1, limit: int = 100) -> Dict:
        """
        Get driver state logs - POST /fleetIntegration/v1/getFleetStateLogs
        """
        json_data = {
            "pager": {
                "page": page,
                "pageSize": limit
            },
            "timeRange": {
                "start": start_date,
                "end": end_date
            }
        }
        return await self._make_request('POST', '/fleetIntegration/v1/getFleetStateLogs', json_data=json_data)
    
    async def get_vehicle(self, vehicle_id: str) -> Dict:
        """Get vehicle details"""
        return await self._make_request('GET', f'/v1/vehicles/{vehicle_id}')
    
    # ==================== Earnings/Reports Endpoints ====================
    
    async def get_earnings_report(self, start_date: str, end_date: str, driver_id: str = None) -> Dict:
        """
        Get earnings report for a date range
        Args:
            start_date: ISO format date (YYYY-MM-DD)
            end_date: ISO format date (YYYY-MM-DD)
            driver_id: Optional driver ID to filter by
        """
        params = {
            'start_date': start_date,
            'end_date': end_date
        }
        if driver_id:
            params['driver_id'] = driver_id
        
        return await self._make_request('GET', '/v1/reports/earnings', params=params)
    
    async def get_rides_report(self, start_date: str, end_date: str, driver_id: str = None) -> Dict:
        """
        Get rides/trips report for a date range
        """
        params = {
            'start_date': start_date,
            'end_date': end_date
        }
        if driver_id:
            params['driver_id'] = driver_id
        
        return await self._make_request('GET', '/v1/reports/rides', params=params)
    
    async def get_weekly_report(self, week_start: str, driver_id: str = None) -> Dict:
        """
        Get weekly summary report
        Args:
            week_start: Start of week date (YYYY-MM-DD)
        """
        params = {'week_start': week_start}
        if driver_id:
            params['driver_id'] = driver_id
        
        return await self._make_request('GET', '/v1/reports/weekly', params=params)


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
    Returns earnings and driver data
    """
    client = BoltAPIClient(client_id, client_secret)
    try:
        # Get fleet info
        fleet_info = await client.get_fleet_info()
        
        # Get drivers
        drivers_data = await client.get_drivers()
        
        # Get vehicles
        vehicles_data = await client.get_vehicles()
        
        # Get earnings report
        earnings_data = await client.get_earnings_report(start_date, end_date)
        
        return {
            "success": True,
            "fleet": fleet_info,
            "drivers": drivers_data,
            "vehicles": vehicles_data,
            "earnings": earnings_data,
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        await client.close()
