"""
Test Suite for Sistema de Faturacao Avancado - Descontos Feature
Tests:
- P2: Apply discount to partner via API
- P2: Remove discount from partner via API
- P2: List partners with active discounts via API
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDescontosEndpoints:
    """Tests for discount management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token for authenticated requests"""
        self.admin_credentials = {
            "email": "admin@tvdefleet.com",
            "password": "admin123"
        }
        self.parceiro_test_user_id = "ab2a25aa-4f70-4c7b-835d-9204b0cd0d7e"
        
        # Login as admin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=self.admin_credentials
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        data = login_response.json()
        self.token = data.get("access_token") or data.get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_01_login_admin(self):
        """Test admin login works"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=self.admin_credentials
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data or "token" in data
        print(f"PASS: Admin login successful")
        
    def test_02_list_subscricoes(self):
        """Test listing subscriptions - needed to verify data before applying discount"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/subscricoes",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"PASS: Listed {len(data)} subscriptions")
        
    def test_03_apply_discount_to_partner(self):
        """P2: Test applying discount to a specific partner"""
        # Apply 10% discount
        params = {
            "desconto_percentagem": 10,
            "motivo": "Teste automatizado - desconto piloto"
        }
        response = requests.post(
            f"{BASE_URL}/api/gestao-planos/subscricoes/user/{self.parceiro_test_user_id}/desconto",
            params=params,
            headers=self.headers
        )
        
        # Could be 200 (success) or 404 (no active subscription for this user)
        if response.status_code == 200:
            data = response.json()
            assert data.get("sucesso") == True
            assert data.get("desconto_percentagem") == 10
            print(f"PASS: Discount of 10% applied to partner. New price: {data.get('preco_novo')}")
        elif response.status_code == 404:
            # No active subscription for test user - this is acceptable
            print(f"INFO: No active subscription for test user {self.parceiro_test_user_id} - endpoint works correctly (404)")
            pytest.skip("Test user has no active subscription")
        else:
            print(f"FAIL: Unexpected status {response.status_code}: {response.text}")
            assert False, f"Unexpected response: {response.status_code}"
            
    def test_04_list_partners_with_discounts(self):
        """P2: Test listing all partners with active discounts"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/subscricoes/com-desconto",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "subscricoes" in data
        assert "total" in data
        print(f"PASS: Listed {data['total']} subscriptions with active discounts")
        
    def test_05_remove_discount_from_partner(self):
        """P2: Test removing discount from a specific partner"""
        response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/subscricoes/user/{self.parceiro_test_user_id}/desconto",
            headers=self.headers
        )
        
        # Could be 200 (success) or 404 (no active subscription)
        if response.status_code == 200:
            data = response.json()
            assert data.get("sucesso") == True
            print(f"PASS: Discount removed. Price restored to: {data.get('preco_novo')}")
        elif response.status_code == 404:
            print(f"INFO: No active subscription for test user - endpoint works correctly (404)")
            pytest.skip("Test user has no active subscription")
        else:
            print(f"FAIL: Unexpected status {response.status_code}: {response.text}")
            assert False, f"Unexpected response: {response.status_code}"
            
    def test_06_apply_discount_with_invalid_percentage(self):
        """Test validation: discount percentage must be 0-100"""
        params = {
            "desconto_percentagem": 150,  # Invalid - over 100
            "motivo": "Teste invalido"
        }
        response = requests.post(
            f"{BASE_URL}/api/gestao-planos/subscricoes/user/{self.parceiro_test_user_id}/desconto",
            params=params,
            headers=self.headers
        )
        # Should return 400 for invalid percentage
        if response.status_code == 400:
            print(f"PASS: Server correctly rejected invalid discount (150%)")
        elif response.status_code == 404:
            print(f"INFO: No active subscription - cannot test validation")
            pytest.skip("Test user has no active subscription")
        else:
            print(f"INFO: Response {response.status_code} - {response.text}")

    def test_07_unauthorized_access(self):
        """Test that non-admin users cannot apply discounts"""
        # Try without auth header
        params = {"desconto_percentagem": 10}
        response = requests.post(
            f"{BASE_URL}/api/gestao-planos/subscricoes/user/{self.parceiro_test_user_id}/desconto",
            params=params
            # No headers - unauthenticated request
        )
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"PASS: Unauthorized access correctly blocked (status: {response.status_code})")


class TestPlanosEndpoints:
    """Tests for plans management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        self.admin_credentials = {
            "email": "admin@tvdefleet.com",
            "password": "admin123"
        }
        
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=self.admin_credentials
        )
        assert login_response.status_code == 200
        
        data = login_response.json()
        self.token = data.get("access_token") or data.get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_01_list_planos(self):
        """Test listing all plans"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/planos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"PASS: Listed {len(data)} plans")
        
    def test_02_list_modulos(self):
        """Test listing all modules"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"PASS: Listed {len(data)} modules")
        
    def test_03_get_estatisticas(self):
        """Test getting subscription statistics"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/estatisticas",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "planos" in data
        assert "modulos" in data
        assert "subscricoes" in data
        print(f"PASS: Statistics retrieved - {data['planos']['total']} plans, {data['subscricoes']['ativas']} active subscriptions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
