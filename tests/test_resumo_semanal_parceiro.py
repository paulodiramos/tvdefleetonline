"""
Test Resumo Semanal Parceiro - Verificação dos dados para Semana 51/2025

Valores esperados (conforme especificação do utilizador):
- Nelson Francisco:
  - Uber: €607.54
  - Bolt: €136.74
  - Via Verde: AS-83-NX ID 601073900511
  - Cartão Combustível: 7824731736480002
  - Aluguer: €249.99

- Jorge Macaia:
  - Uber: €677.00
  - Bolt: €299.61
  - Via Verde: BQ-32-RS
  - Cartão Elétrico: PTPRIO6087131736480002
  - Aluguer: €249.99
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://partner-portal-47.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "123456"

# Test week/year
TEST_SEMANA = 51
TEST_ANO = 2025


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def parceiro_token():
    """Get parceiro authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASSWORD}
    )
    assert response.status_code == 200, f"Parceiro login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    """Create authenticated admin session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    })
    return session


@pytest.fixture(scope="module")
def parceiro_client(parceiro_token):
    """Create authenticated parceiro session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {parceiro_token}",
        "Content-Type": "application/json"
    })
    return session


class TestResumoSemanalEndpoint:
    """Test /api/relatorios/parceiro/resumo-semanal endpoint"""
    
    def test_endpoint_returns_200(self, admin_client):
        """Endpoint should return 200 for week 51/2025"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200, f"Endpoint failed: {response.text}"
    
    def test_response_structure(self, admin_client):
        """Response should have correct structure"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "semana" in data, "Missing 'semana' field"
        assert "ano" in data, "Missing 'ano' field"
        assert "periodo" in data, "Missing 'periodo' field"
        assert "motoristas" in data, "Missing 'motoristas' field"
        assert "totais" in data, "Missing 'totais' field"
        
        # Check semana/ano values
        assert data["semana"] == TEST_SEMANA, f"Wrong semana: {data['semana']}"
        assert data["ano"] == TEST_ANO, f"Wrong ano: {data['ano']}"
    
    def test_totais_structure(self, admin_client):
        """Totais should have all required fields"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        totais = data.get("totais", {})
        
        required_fields = [
            "total_ganhos_uber",
            "total_ganhos_bolt",
            "total_ganhos",
            "total_combustivel",
            "total_eletrico",
            "total_via_verde",
            "total_aluguer",
            "total_despesas",
            "total_liquido"
        ]
        
        for field in required_fields:
            assert field in totais, f"Missing totais field: {field}"


class TestNelsonFranciscoData:
    """Test Nelson Francisco data for week 51/2025"""
    
    def test_nelson_uber_value(self, admin_client):
        """Nelson Uber should be €607.54"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find Nelson in motoristas list
        nelson = None
        for m in data.get("motoristas", []):
            nome = m.get("motorista_nome") or ""
            if "Nelson" in nome:
                nelson = m
                break
        
        assert nelson is not None, "Nelson Francisco not found in motoristas list"
        
        # Check Uber value
        uber_value = nelson.get("ganhos_uber", 0)
        assert uber_value == 607.54, f"Nelson Uber should be €607.54, got €{uber_value}"
        print(f"✓ Nelson Uber: €{uber_value}")
    
    def test_nelson_bolt_value(self, admin_client):
        """Nelson Bolt should be €136.74"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        nelson = None
        for m in data.get("motoristas", []):
            nome = m.get("motorista_nome") or ""
            if "Nelson" in nome:
                nelson = m
                break
        
        assert nelson is not None, "Nelson Francisco not found"
        
        bolt_value = nelson.get("ganhos_bolt", 0)
        assert bolt_value == 136.74, f"Nelson Bolt should be €136.74, got €{bolt_value}"
        print(f"✓ Nelson Bolt: €{bolt_value}")
    
    def test_nelson_aluguer_value(self, admin_client):
        """Nelson Aluguer should be €249.99"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        nelson = None
        for m in data.get("motoristas", []):
            nome = m.get("motorista_nome") or ""
            if "Nelson" in nome:
                nelson = m
                break
        
        assert nelson is not None, "Nelson Francisco not found"
        
        aluguer_value = nelson.get("aluguer_veiculo", 0)
        assert aluguer_value == 249.99, f"Nelson Aluguer should be €249.99, got €{aluguer_value}"
        print(f"✓ Nelson Aluguer: €{aluguer_value}")
    
    def test_nelson_vehicle_matricula(self, admin_client):
        """Nelson vehicle should be AS-83-NX"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        nelson = None
        for m in data.get("motoristas", []):
            nome = m.get("motorista_nome") or ""
            if "Nelson" in nome:
                nelson = m
                break
        
        assert nelson is not None, "Nelson Francisco not found"
        
        matricula = nelson.get("veiculo_matricula")
        assert matricula == "AS-83-NX", f"Nelson vehicle should be AS-83-NX, got {matricula}"
        print(f"✓ Nelson Vehicle: {matricula}")


class TestJorgeMacaiaData:
    """Test Jorge Macaia data for week 51/2025"""
    
    def test_jorge_uber_value(self, admin_client):
        """Jorge Uber should be €677.00"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find Jorge in motoristas list
        jorge = None
        for m in data.get("motoristas", []):
            nome = m.get("motorista_nome") or ""
            if "Jorge" in nome:
                jorge = m
                break
        
        assert jorge is not None, "Jorge Macaia not found in motoristas list"
        
        uber_value = jorge.get("ganhos_uber", 0)
        assert uber_value == 677.00, f"Jorge Uber should be €677.00, got €{uber_value}"
        print(f"✓ Jorge Uber: €{uber_value}")
    
    def test_jorge_bolt_value(self, admin_client):
        """Jorge Bolt should be €299.61"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        jorge = None
        for m in data.get("motoristas", []):
            nome = m.get("motorista_nome") or ""
            if "Jorge" in nome:
                jorge = m
                break
        
        assert jorge is not None, "Jorge Macaia not found"
        
        bolt_value = jorge.get("ganhos_bolt", 0)
        assert bolt_value == 299.61, f"Jorge Bolt should be €299.61, got €{bolt_value}"
        print(f"✓ Jorge Bolt: €{bolt_value}")
    
    def test_jorge_aluguer_value(self, admin_client):
        """Jorge Aluguer should be €249.99"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        jorge = None
        for m in data.get("motoristas", []):
            nome = m.get("motorista_nome") or ""
            if "Jorge" in nome:
                jorge = m
                break
        
        assert jorge is not None, "Jorge Macaia not found"
        
        aluguer_value = jorge.get("aluguer_veiculo", 0)
        assert aluguer_value == 249.99, f"Jorge Aluguer should be €249.99, got €{aluguer_value}"
        print(f"✓ Jorge Aluguer: €{aluguer_value}")
    
    def test_jorge_vehicle_matricula(self, admin_client):
        """Jorge vehicle should be BQ-32-RS"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        jorge = None
        for m in data.get("motoristas", []):
            nome = m.get("motorista_nome") or ""
            if "Jorge" in nome:
                jorge = m
                break
        
        assert jorge is not None, "Jorge Macaia not found"
        
        matricula = jorge.get("veiculo_matricula")
        assert matricula == "BQ-32-RS", f"Jorge vehicle should be BQ-32-RS, got {matricula}"
        print(f"✓ Jorge Vehicle: {matricula}")


class TestTotaisCalculation:
    """Test that totals are calculated correctly"""
    
    def test_totais_ganhos_sum(self, admin_client):
        """Total ganhos should equal sum of all motoristas ganhos"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        motoristas = data.get("motoristas", [])
        totais = data.get("totais", {})
        
        # Calculate sum from motoristas
        sum_uber = sum(m.get("ganhos_uber", 0) for m in motoristas)
        sum_bolt = sum(m.get("ganhos_bolt", 0) for m in motoristas)
        sum_ganhos = sum(m.get("total_ganhos", 0) for m in motoristas)
        
        # Compare with totais
        assert abs(totais.get("total_ganhos_uber", 0) - sum_uber) < 0.01, \
            f"Total Uber mismatch: {totais.get('total_ganhos_uber')} vs {sum_uber}"
        assert abs(totais.get("total_ganhos_bolt", 0) - sum_bolt) < 0.01, \
            f"Total Bolt mismatch: {totais.get('total_ganhos_bolt')} vs {sum_bolt}"
        assert abs(totais.get("total_ganhos", 0) - sum_ganhos) < 0.01, \
            f"Total Ganhos mismatch: {totais.get('total_ganhos')} vs {sum_ganhos}"
        
        print(f"✓ Totais Uber: €{totais.get('total_ganhos_uber')}")
        print(f"✓ Totais Bolt: €{totais.get('total_ganhos_bolt')}")
        print(f"✓ Totais Ganhos: €{totais.get('total_ganhos')}")
    
    def test_totais_despesas_sum(self, admin_client):
        """Total despesas should equal sum of all motoristas despesas"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200
        data = response.json()
        
        motoristas = data.get("motoristas", [])
        totais = data.get("totais", {})
        
        # Calculate sum from motoristas
        sum_despesas = sum(m.get("total_despesas", 0) for m in motoristas)
        sum_aluguer = sum(m.get("aluguer_veiculo", 0) for m in motoristas)
        
        # Compare with totais
        assert abs(totais.get("total_despesas", 0) - sum_despesas) < 0.01, \
            f"Total Despesas mismatch: {totais.get('total_despesas')} vs {sum_despesas}"
        assert abs(totais.get("total_aluguer", 0) - sum_aluguer) < 0.01, \
            f"Total Aluguer mismatch: {totais.get('total_aluguer')} vs {sum_aluguer}"
        
        print(f"✓ Totais Despesas: €{totais.get('total_despesas')}")
        print(f"✓ Totais Aluguer: €{totais.get('total_aluguer')}")


class TestParceiroAccess:
    """Test parceiro access to resumo-semanal"""
    
    def test_parceiro_can_access_endpoint(self, parceiro_client):
        """Parceiro should be able to access resumo-semanal"""
        response = parceiro_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={TEST_SEMANA}&ano={TEST_ANO}"
        )
        assert response.status_code == 200, f"Parceiro access failed: {response.text}"
        data = response.json()
        assert "motoristas" in data
        print(f"✓ Parceiro can access endpoint, found {len(data.get('motoristas', []))} motoristas")


class TestWeekSelection:
    """Test week/year selection functionality"""
    
    def test_different_week_returns_different_data(self, admin_client):
        """Different weeks should return different data"""
        response_51 = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=51&ano=2025"
        )
        response_50 = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=50&ano=2025"
        )
        
        assert response_51.status_code == 200
        assert response_50.status_code == 200
        
        data_51 = response_51.json()
        data_50 = response_50.json()
        
        # Verify different weeks
        assert data_51["semana"] == 51
        assert data_50["semana"] == 50
        
        print(f"✓ Week 51 has {len(data_51.get('motoristas', []))} motoristas")
        print(f"✓ Week 50 has {len(data_50.get('motoristas', []))} motoristas")
    
    def test_default_week_when_not_specified(self, admin_client):
        """When week not specified, should use current week"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have semana and ano
        assert "semana" in data
        assert "ano" in data
        print(f"✓ Default week: {data['semana']}/{data['ano']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
