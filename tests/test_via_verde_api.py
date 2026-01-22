"""
Test Via Verde API - Cálculo de despesas Via Verde por motorista/semana

Regras de negócio testadas:
1. Incluir APENAS transações onde market_description = 'portagens' ou 'parques'
2. Usar coluna Liquid Value para soma
3. Sem atraso de semanas (dados da semana X para relatório da semana X)

Valores esperados:
- Marco Coelho (OBU 601104486167): €23,20 total
  - Semana 47: €3.20
  - Semana 48: €10.80
  - Semana 50: €5.30
  - Semana 51: €3.90
- Arlei Oliveira (OBU 601108925822): €0 (qualquer semana)
"""

import pytest
import requests
import os

# Use environment variable for API URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fleetconnect-3.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"

# Motorista IDs
MARCO_COELHO_ID = "36b1d8b4-dbf4-4857-acea-9580aeaaf98c"
ARLEI_OLIVEIRA_ID = "57d6a119-e5af-4c7f-b357-49dc4f618763"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API requests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestViaVerdeAPI:
    """Test Via Verde total calculation API"""
    
    def test_marco_coelho_semana_47(self, api_client):
        """Marco Coelho semana 47 deve ser €3.20"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/{MARCO_COELHO_ID}/via-verde-total",
            params={"semana": 47, "ano": 2025}
        )
        
        assert response.status_code == 200, f"API error: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "motorista_id" in data
        assert "total_via_verde" in data
        assert "semana_relatorio" in data
        assert "ano_relatorio" in data
        
        # Validate expected value
        assert data["motorista_id"] == MARCO_COELHO_ID
        assert data["semana_relatorio"] == 47
        assert data["ano_relatorio"] == 2025
        assert data["total_via_verde"] == 3.2, f"Expected €3.20, got €{data['total_via_verde']}"
        
        # Validate no week delay
        assert data.get("via_verde_atraso_semanas", 0) == 0, "Should have no week delay"
    
    def test_marco_coelho_semana_48(self, api_client):
        """Marco Coelho semana 48 deve ser €10.80"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/{MARCO_COELHO_ID}/via-verde-total",
            params={"semana": 48, "ano": 2025}
        )
        
        assert response.status_code == 200, f"API error: {response.text}"
        data = response.json()
        
        assert data["motorista_id"] == MARCO_COELHO_ID
        assert data["semana_relatorio"] == 48
        assert data["ano_relatorio"] == 2025
        assert data["total_via_verde"] == 10.8, f"Expected €10.80, got €{data['total_via_verde']}"
    
    def test_marco_coelho_semana_50(self, api_client):
        """Marco Coelho semana 50 deve ser €5.30"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/{MARCO_COELHO_ID}/via-verde-total",
            params={"semana": 50, "ano": 2025}
        )
        
        assert response.status_code == 200, f"API error: {response.text}"
        data = response.json()
        
        assert data["motorista_id"] == MARCO_COELHO_ID
        assert data["semana_relatorio"] == 50
        assert data["ano_relatorio"] == 2025
        assert data["total_via_verde"] == 5.3, f"Expected €5.30, got €{data['total_via_verde']}"
    
    def test_marco_coelho_semana_51(self, api_client):
        """Marco Coelho semana 51 deve ser €3.90"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/{MARCO_COELHO_ID}/via-verde-total",
            params={"semana": 51, "ano": 2025}
        )
        
        assert response.status_code == 200, f"API error: {response.text}"
        data = response.json()
        
        assert data["motorista_id"] == MARCO_COELHO_ID
        assert data["semana_relatorio"] == 51
        assert data["ano_relatorio"] == 2025
        assert data["total_via_verde"] == 3.9, f"Expected €3.90, got €{data['total_via_verde']}"
    
    def test_arlei_oliveira_semana_48_zero(self, api_client):
        """Arlei Oliveira qualquer semana deve ser €0"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/{ARLEI_OLIVEIRA_ID}/via-verde-total",
            params={"semana": 48, "ano": 2025}
        )
        
        assert response.status_code == 200, f"API error: {response.text}"
        data = response.json()
        
        assert data["motorista_id"] == ARLEI_OLIVEIRA_ID
        assert data["semana_relatorio"] == 48
        assert data["ano_relatorio"] == 2025
        assert data["total_via_verde"] == 0, f"Expected €0, got €{data['total_via_verde']}"
    
    def test_arlei_oliveira_semana_47_zero(self, api_client):
        """Arlei Oliveira semana 47 deve ser €0"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/{ARLEI_OLIVEIRA_ID}/via-verde-total",
            params={"semana": 47, "ano": 2025}
        )
        
        assert response.status_code == 200, f"API error: {response.text}"
        data = response.json()
        
        assert data["total_via_verde"] == 0, f"Expected €0, got €{data['total_via_verde']}"
    
    def test_marco_coelho_total_all_weeks(self, api_client):
        """Marco Coelho total de todas as semanas deve ser €23.20"""
        total = 0
        weeks = [47, 48, 50, 51]
        
        for week in weeks:
            response = api_client.get(
                f"{BASE_URL}/api/relatorios/motorista/{MARCO_COELHO_ID}/via-verde-total",
                params={"semana": week, "ano": 2025}
            )
            assert response.status_code == 200
            data = response.json()
            total += data["total_via_verde"]
        
        # Total should be €23.20 (3.20 + 10.80 + 5.30 + 3.90)
        assert total == 23.2, f"Expected total €23.20, got €{total}"


class TestViaVerdeAPIValidation:
    """Test API validation and error handling"""
    
    def test_missing_semana_parameter(self, api_client):
        """API should handle missing semana parameter"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/{MARCO_COELHO_ID}/via-verde-total",
            params={"ano": 2025}
        )
        # Should return 422 (validation error) or handle gracefully
        assert response.status_code in [422, 400], f"Expected validation error, got {response.status_code}"
    
    def test_missing_ano_parameter(self, api_client):
        """API should handle missing ano parameter"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/{MARCO_COELHO_ID}/via-verde-total",
            params={"semana": 48}
        )
        # Should return 422 (validation error) or handle gracefully
        assert response.status_code in [422, 400], f"Expected validation error, got {response.status_code}"
    
    def test_invalid_motorista_id(self, api_client):
        """API should handle invalid motorista ID"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/invalid-id-12345/via-verde-total",
            params={"semana": 48, "ano": 2025}
        )
        # Should return 200 with 0 total (no data found) or 404
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            assert data["total_via_verde"] == 0
    
    def test_unauthorized_access(self):
        """API should reject unauthorized requests"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/motorista/{MARCO_COELHO_ID}/via-verde-total",
            params={"semana": 48, "ano": 2025}
        )
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"


class TestViaVerdeBusinessRules:
    """Test business rules for Via Verde calculation"""
    
    def test_no_week_delay(self, api_client):
        """Verify no week delay is applied (semana X data for semana X report)"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/{MARCO_COELHO_ID}/via-verde-total",
            params={"semana": 48, "ano": 2025}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # semana_dados should equal semana_relatorio (no delay)
        assert data["semana_dados"] == data["semana_relatorio"], \
            f"Week delay detected: report week {data['semana_relatorio']}, data week {data['semana_dados']}"
        assert data.get("via_verde_atraso_semanas", 0) == 0
    
    def test_response_structure(self, api_client):
        """Verify API response has all required fields"""
        response = api_client.get(
            f"{BASE_URL}/api/relatorios/motorista/{MARCO_COELHO_ID}/via-verde-total",
            params={"semana": 48, "ano": 2025}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "motorista_id",
            "semana_relatorio",
            "ano_relatorio",
            "semana_dados",
            "ano_dados",
            "total_via_verde",
            "registos_portagens",
            "registos_legacy",
            "via_verde_atraso_semanas"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
