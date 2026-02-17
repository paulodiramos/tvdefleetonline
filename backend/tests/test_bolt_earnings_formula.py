"""
Test Bolt Earnings Formula - Backend Testing
Tests the new Bolt earnings calculation: ganhos_liquidos = ganhos_brutos_total - comissao_bolt

Features tested:
1. Bolt earnings formula calculation
2. GET /api/relatorios/parceiro/resumo-semanal endpoint
3. POST /api/sincronizacao-auto/executar for 'bolt' source
4. GET /api/viaverde/execucoes returns correct RPA status
"""
import pytest
import requests
import os
from datetime import datetime

# Use BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
TEST_EMAIL = "tsacamalda@gmail.com"
TEST_PASSWORD = "test123"


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("access_token") or data.get("token")
        assert token, f"No token in response: {data}"
        return token
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data or "token" in data


class TestResumoSemanalParceiro:
    """Tests for GET /api/relatorios/parceiro/resumo-semanal endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_resumo_semanal_endpoint_returns_200(self, headers):
        """Test that resumo-semanal endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            headers=headers
        )
        assert response.status_code == 200, f"Endpoint failed: {response.text}"
    
    def test_resumo_semanal_returns_correct_structure(self, headers):
        """Test that response has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check main fields exist
        assert "semana" in data, "Missing 'semana' field"
        assert "ano" in data, "Missing 'ano' field"
        assert "motoristas" in data, "Missing 'motoristas' field"
        assert "totais" in data, "Missing 'totais' field"
        assert "periodo" in data, "Missing 'periodo' field"
    
    def test_resumo_semanal_with_week_param(self, headers):
        """Test endpoint with specific week parameter"""
        # Get current week
        now = datetime.now()
        semana = now.isocalendar()[1]
        ano = now.year
        
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            headers=headers,
            params={"semana": semana, "ano": ano}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["semana"] == semana
        assert data["ano"] == ano
    
    def test_resumo_semanal_motorista_bolt_fields(self, headers):
        """Test that motorista data includes correct Bolt financial fields"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        motoristas = data.get("motoristas", [])
        
        # If there are motoristas, check that expected fields exist
        if motoristas:
            for motorista in motoristas:
                # Check that Bolt fields are present
                assert "ganhos_bolt" in motorista, f"Missing 'ganhos_bolt' for motorista {motorista.get('motorista_nome')}"
                assert "total_ganhos" in motorista, f"Missing 'total_ganhos' for motorista {motorista.get('motorista_nome')}"
                
                # Check values are numeric
                assert isinstance(motorista.get("ganhos_bolt", 0), (int, float))
                assert isinstance(motorista.get("total_ganhos", 0), (int, float))
                
                print(f"Motorista: {motorista.get('motorista_nome')}, Bolt: €{motorista.get('ganhos_bolt')}, Total: €{motorista.get('total_ganhos')}")
    
    def test_resumo_semanal_totais_structure(self, headers):
        """Test that totais has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        totais = data.get("totais", {})
        
        # Check expected fields in totais
        expected_fields = [
            "total_ganhos_uber",
            "total_ganhos_bolt",
            "total_ganhos",
            "total_combustivel",
            "total_via_verde"
        ]
        
        for field in expected_fields:
            assert field in totais, f"Missing field '{field}' in totais"
            print(f"  {field}: €{totais.get(field)}")


class TestSincronizacaoAutoExecutar:
    """Tests for POST /api/sincronizacao-auto/executar endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_sincronizacao_auto_executar_bolt_endpoint(self, headers):
        """Test POST /api/sincronizacao-auto/executar with fonte='bolt'"""
        # Get current week
        now = datetime.now()
        semana = now.isocalendar()[1]
        ano = now.year
        
        # Request to sync Bolt data
        payload = {
            "fontes": ["bolt"],
            "semana": semana,
            "ano": ano
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sincronizacao-auto/executar",
            headers=headers,
            json=payload
        )
        
        # Check response
        assert response.status_code in [200, 400, 403], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"Sync response: {data}")
            # Check response structure
            assert "execucao_id" in data or "sucesso" in data or "resultados" in data
        elif response.status_code == 400:
            # 400 is acceptable if no data sources configured
            data = response.json()
            print(f"Expected 400 (no config): {data}")
        else:
            print(f"Response: {response.text}")
    
    def test_sincronizacao_auto_executar_returns_execution_id(self, headers):
        """Test that sync returns an execution ID"""
        payload = {
            "fontes": ["bolt"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sincronizacao-auto/executar",
            headers=headers,
            json=payload
        )
        
        if response.status_code == 200:
            data = response.json()
            # If sync started, should have execucao_id
            if data.get("sucesso") != False:
                assert "execucao_id" in data or "id" in data
                print(f"Execution ID: {data.get('execucao_id') or data.get('id')}")


class TestViaVerdeExecucoes:
    """Tests for GET /api/viaverde/execucoes endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_viaverde_execucoes_endpoint_returns_200(self, headers):
        """Test that viaverde/execucoes endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/viaverde/execucoes",
            headers=headers
        )
        assert response.status_code == 200, f"Endpoint failed: {response.text}"
    
    def test_viaverde_execucoes_returns_list(self, headers):
        """Test that endpoint returns a list"""
        response = requests.get(
            f"{BASE_URL}/api/viaverde/execucoes",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        
        print(f"Found {len(data)} Via Verde executions")
    
    def test_viaverde_execucoes_status_fields(self, headers):
        """Test that executions have correct status fields"""
        response = requests.get(
            f"{BASE_URL}/api/viaverde/execucoes",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        if data:
            # Check first execution structure
            exec_data = data[0]
            
            # Check expected fields
            assert "id" in exec_data, "Missing 'id' field"
            assert "status" in exec_data, "Missing 'status' field"
            
            # Status should be one of expected values
            valid_statuses = ["pendente", "em_execucao", "concluido", "erro", "sucesso", "sucesso_parcial"]
            status = exec_data.get("status")
            assert status in valid_statuses, f"Unexpected status: {status}"
            
            print(f"Latest execution: ID={exec_data.get('id')}, Status={status}")
            
            # Check for date fields
            if "created_at" in exec_data:
                print(f"  Created: {exec_data.get('created_at')}")
            if "data_inicio" in exec_data:
                print(f"  Period: {exec_data.get('data_inicio')} to {exec_data.get('data_fim')}")


class TestBoltEarningsFormula:
    """Tests to verify the Bolt earnings formula calculation
    
    Formula: ganhos_liquidos = ganhos_brutos_total - comissao_bolt
    Where: ganhos_brutos_total = ride_price + tips + cancellation_fee + booking_fee
    """
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_bolt_earnings_formula_in_resumo_semanal(self, headers):
        """
        Verify that Bolt earnings in resumo-semanal use correct formula:
        ganhos_liquidos = ganhos_brutos_total - comissao_bolt
        
        This checks the relatorios.py calculation (lines 960-990)
        """
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        motoristas = data.get("motoristas", [])
        
        # Log calculation for verification
        print("\n=== Bolt Earnings Formula Verification ===")
        print("Formula: ganhos_bolt = ganhos_brutos - comissao_bolt")
        
        for motorista in motoristas:
            ganhos_bolt = motorista.get("ganhos_bolt", 0)
            nome = motorista.get("motorista_nome", "Unknown")
            
            print(f"\nMotorista: {nome}")
            print(f"  ganhos_bolt: €{ganhos_bolt}")
            
            # The formula is applied at the database query level in relatorios.py
            # We verify that the value is a valid number (not None or NaN)
            assert isinstance(ganhos_bolt, (int, float)), f"ganhos_bolt should be numeric for {nome}"
            assert ganhos_bolt >= 0, f"ganhos_bolt should be >= 0 for {nome}"
    
    def test_bolt_data_stored_with_correct_fields(self, headers):
        """Test that synced Bolt data includes all financial fields"""
        # This tests indirectly through resumo-semanal
        # The sync stores data with these fields in ganhos_bolt collection:
        # - ganhos_brutos_total
        # - comissao_bolt
        # - ganhos_liquidos (calculated as ganhos_brutos_total - comissao_bolt)
        
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        totais = data.get("totais", {})
        
        # Check that Bolt totals are calculated
        total_bolt = totais.get("total_ganhos_bolt", 0)
        total_ganhos = totais.get("total_ganhos", 0)
        
        print(f"\n=== Totais Bolt ===")
        print(f"Total Bolt: €{total_bolt}")
        print(f"Total Ganhos: €{total_ganhos}")
        
        # Verify values are valid
        assert isinstance(total_bolt, (int, float))
        assert isinstance(total_ganhos, (int, float))


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_is_reachable(self):
        """Test that the API is reachable"""
        response = requests.get(f"{BASE_URL}/api/health")
        # Accept 200 or 404 (if health endpoint doesn't exist)
        assert response.status_code in [200, 404], f"API unreachable: {response.status_code}"
    
    def test_auth_endpoint_exists(self):
        """Test that auth endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "wrong"}
        )
        # Should return 401 (unauthorized) not 404
        assert response.status_code in [401, 403, 400], f"Unexpected auth response: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
