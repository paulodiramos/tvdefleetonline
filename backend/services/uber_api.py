"""
Uber Fleet API Integration
Integração com a API oficial da Uber para obter pagamentos de motoristas.

Documentação: API Get Driver Payments
- Endpoint: GET /v1/vehicle-suppliers/earners/payments
- Scope: supplier.partner.payments
- Dados limitados às últimas 24 horas
"""

import logging
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import base64

logger = logging.getLogger(__name__)

# Configurações da API Uber
UBER_AUTH_URL = "https://login.uber.com/oauth/v2/token"
UBER_API_BASE = "https://api.uber.com"


class UberAPI:
    """Cliente para a API oficial da Uber Fleet"""
    
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token = None
        self.token_expires_at = None
    
    async def _get_access_token(self) -> str:
        """Obter token de acesso OAuth 2.0 usando Client Credentials"""
        
        # Verificar se token ainda é válido
        if self.access_token and self.token_expires_at:
            if datetime.now(timezone.utc) < self.token_expires_at:
                return self.access_token
        
        logger.info("🔐 A obter novo access token da Uber...")
        
        # Preparar credenciais para Basic Auth
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {encoded_credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "client_credentials",
            "scope": "supplier.partner.payments"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                UBER_AUTH_URL,
                headers=headers,
                data=data,
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"❌ Erro ao obter token: {response.status_code} - {response.text}")
                raise Exception(f"Falha na autenticação Uber: {response.status_code}")
            
            token_data = response.json()
            self.access_token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 3600)
            self.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)
            
            logger.info(f"✅ Token obtido com sucesso (expira em {expires_in}s)")
            return self.access_token
    
    async def get_organizations(self, supplier_id: str) -> List[Dict[str, Any]]:
        """
        Obter lista de organizações associadas ao supplier.
        
        Args:
            supplier_id: UUID do Fleet Supplier
            
        Returns:
            Lista de organizações com org_id encriptado
        """
        token = await self._get_access_token()
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        url = f"{UBER_API_BASE}/v1/vehicle-suppliers/{supplier_id}/organizations"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=30.0)
            
            if response.status_code != 200:
                logger.error(f"❌ Erro ao obter organizações: {response.status_code} - {response.text}")
                return []
            
            data = response.json()
            organizations = data.get("organizations", [])
            logger.info(f"✅ Encontradas {len(organizations)} organizações")
            return organizations
    
    async def get_driver_payments(
        self,
        org_id: str,
        start_time: datetime = None,
        end_time: datetime = None,
        driver_id: str = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Obter pagamentos de motoristas.
        
        Args:
            org_id: UUID encriptado da organização
            start_time: Início do período (máx 24h atrás)
            end_time: Fim do período (máx agora)
            driver_id: UUID do motorista (opcional, para filtrar)
            page_size: Número de registos por página (1-100)
            
        Returns:
            Dicionário com pagamentos e informações de paginação
        """
        token = await self._get_access_token()
        
        # Definir período (últimas 24 horas por defeito)
        now = datetime.now(timezone.utc)
        if not end_time:
            end_time = now
        if not start_time:
            start_time = now - timedelta(hours=24)
        
        # Converter para timestamp em milissegundos
        start_ms = int(start_time.timestamp() * 1000)
        end_ms = int(end_time.timestamp() * 1000)
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        params = {
            "org_id": org_id,
            "page_size": min(page_size, 100),
            "start_time": start_ms,
            "end_time": end_ms
        }
        
        if driver_id:
            params["driver_id"] = driver_id
        
        url = f"{UBER_API_BASE}/v1/vehicle-suppliers/earners/payments"
        
        all_payments = []
        page_token = None
        
        async with httpx.AsyncClient() as client:
            while True:
                if page_token:
                    params["page_token"] = page_token
                
                response = await client.get(
                    url,
                    headers=headers,
                    params=params,
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    logger.error(f"❌ Erro ao obter pagamentos: {response.status_code} - {response.text}")
                    break
                
                data = response.json()
                body = data.get("body", data)
                
                breakdowns = body.get("earnerPaymentBreakdowns", [])
                all_payments.extend(breakdowns)
                
                logger.info(f"📊 Obtidos {len(breakdowns)} registos de pagamento")
                
                # Verificar paginação
                pagination = body.get("paginationResult", {})
                page_token = pagination.get("nextPageToken")
                
                if not page_token:
                    break
        
        logger.info(f"✅ Total: {len(all_payments)} pagamentos de motoristas")
        
        return {
            "payments": all_payments,
            "total": len(all_payments),
            "period": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            }
        }
    
    def parse_payment_amount(self, amount_obj: Dict) -> float:
        """Converter amountE5 para valor decimal"""
        if not amount_obj:
            return 0.0
        amount_e5 = amount_obj.get("amountE5", 0)
        return amount_e5 / 100000  # E5 = 5 casas decimais
    
    def extract_driver_data(self, payment_breakdown: Dict) -> Dict[str, Any]:
        """
        Extrair dados estruturados de um registo de pagamento.
        
        Args:
            payment_breakdown: Objeto EarnerPaymentBreakdown da API
            
        Returns:
            Dicionário com dados do motorista e valores
        """
        earner_info = payment_breakdown.get("earnerInfo", {})
        breakdowns = payment_breakdown.get("paymentBreakdowns", [])
        
        # Encontrar total de ganhos
        total_earnings = 0.0
        net_fare = 0.0
        currency = "EUR"
        
        for breakdown in breakdowns:
            if breakdown.get("categoryName") == "earnings":
                amount = breakdown.get("amount", {})
                total_earnings = self.parse_payment_amount(amount)
                currency = amount.get("currencyCode", "EUR")
                
                # Procurar net_fare nos children
                for child in breakdown.get("children", []) or []:
                    if child.get("categoryName") == "net_fare":
                        net_fare = self.parse_payment_amount(child.get("amount", {}))
        
        return {
            "uuid": earner_info.get("uuid"),
            "nome": f"{earner_info.get('firstName', '')} {earner_info.get('lastName', '')}".strip(),
            "primeiro_nome": earner_info.get("firstName"),
            "ultimo_nome": earner_info.get("lastName"),
            "telefone": earner_info.get("phoneNumber"),
            "email": earner_info.get("email"),
            "total_ganhos": total_earnings,
            "valor_liquido": net_fare,
            "moeda": currency
        }


async def sincronizar_pagamentos_uber(
    client_id: str,
    client_secret: str,
    org_id: str,
    parceiro_id: str = None
) -> Dict[str, Any]:
    """
    Sincronizar pagamentos da Uber para o sistema.
    
    Args:
        client_id: Client ID da aplicação Uber
        client_secret: Client Secret da aplicação
        org_id: Organization ID encriptado
        parceiro_id: ID do parceiro no sistema (opcional)
        
    Returns:
        Resultado da sincronização
    """
    resultado = {
        "sucesso": False,
        "motoristas": [],
        "total_motoristas": 0,
        "total_ganhos": 0.0,
        "mensagem": None,
        "logs": []
    }
    
    try:
        api = UberAPI(client_id, client_secret)
        resultado["logs"].append("Cliente API Uber iniciado")
        
        # Obter pagamentos das últimas 24 horas
        payments_data = await api.get_driver_payments(org_id)
        resultado["logs"].append(f"Obtidos {payments_data['total']} pagamentos")
        
        # Processar dados
        motoristas = []
        total_ganhos = 0.0
        
        for payment in payments_data.get("payments", []):
            driver_data = api.extract_driver_data(payment)
            motoristas.append(driver_data)
            total_ganhos += driver_data.get("total_ganhos", 0)
        
        resultado["motoristas"] = motoristas
        resultado["total_motoristas"] = len(motoristas)
        resultado["total_ganhos"] = total_ganhos
        resultado["periodo"] = payments_data.get("period")
        resultado["sucesso"] = True
        resultado["mensagem"] = f"Sincronização Uber concluída: {len(motoristas)} motoristas, total €{total_ganhos:.2f}"
        resultado["logs"].append(resultado["mensagem"])
        
    except Exception as e:
        resultado["mensagem"] = f"Erro: {str(e)}"
        resultado["logs"].append(f"Erro: {str(e)}")
        logger.error(f"❌ Erro na sincronização Uber API: {e}")
    
    return resultado
