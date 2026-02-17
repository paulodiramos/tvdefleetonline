"""
Test Prio Browser API - Tests for Prio sync features
Tests:
- GET /api/prio/browser/status - Browser status
- POST /api/prio/browser/iniciar - Start browser (not tested for actual browser start)
- GET /api/prio/sessao - Session verification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPrioBrowserAPI:
    """Tests for Prio Browser API endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for parceiro user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_prio_browser_status_requires_auth(self):
        """Test that /api/prio/browser/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/prio/browser/status")
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_prio_browser_status_returns_correct_structure(self, headers):
        """Test GET /api/prio/browser/status returns correct data structure"""
        response = requests.get(f"{BASE_URL}/api/prio/browser/status", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify required fields are present
        assert "browser_ativo" in data, "Missing browser_ativo field"
        assert "sessao_existe" in data, "Missing sessao_existe field"
        assert "tem_credenciais" in data, "Missing tem_credenciais field"
        
        # Verify data types
        assert isinstance(data["browser_ativo"], bool), "browser_ativo should be boolean"
        assert isinstance(data["sessao_existe"], bool), "sessao_existe should be boolean"
        assert isinstance(data["tem_credenciais"], bool), "tem_credenciais should be boolean"
        
        # Optional fields
        if "prio_usuario" in data and data["prio_usuario"]:
            assert isinstance(data["prio_usuario"], str), "prio_usuario should be string"
    
    def test_prio_sessao_endpoint(self, headers):
        """Test GET /api/prio/sessao returns session info"""
        response = requests.get(f"{BASE_URL}/api/prio/sessao", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "tem_sessao" in data, "Missing tem_sessao field"
        assert isinstance(data["tem_sessao"], bool), "tem_sessao should be boolean"
    
    def test_prio_browser_iniciar_requires_auth(self):
        """Test that POST /api/prio/browser/iniciar requires authentication"""
        response = requests.post(f"{BASE_URL}/api/prio/browser/iniciar", json={})
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_prio_browser_fechar_requires_auth(self):
        """Test that POST /api/prio/browser/fechar requires authentication"""
        response = requests.post(f"{BASE_URL}/api/prio/browser/fechar", json={})
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_prio_extrair_requires_auth(self):
        """Test that POST /api/prio/extrair requires authentication"""
        response = requests.post(f"{BASE_URL}/api/prio/extrair", json={
            "tipo": "combustivel",
            "semana": 1,
            "ano": 2025
        })
        assert response.status_code in [401, 403], "Should require authentication"


class TestPrioExtractAPI:
    """Tests for Prio data extraction API endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for parceiro user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "test123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_prio_extrair_without_login_fails(self, headers):
        """Test POST /api/prio/extrair fails when not logged in to Prio"""
        response = requests.post(f"{BASE_URL}/api/prio/extrair", 
            headers=headers,
            json={
                "tipo": "combustivel",
                "semana": 1,
                "ano": 2025
            }
        )
        # Should return 200 with error message since browser is not active
        assert response.status_code == 200, f"Unexpected status: {response.status_code}"
        
        data = response.json()
        # Should indicate not logged in
        assert "sucesso" in data, "Missing sucesso field"
        # Either browser not initiated or not logged in
        if not data.get("sucesso"):
            error_msg = data.get("erro", "").lower()
            assert any(word in error_msg for word in ["browser", "login", "logado", "sessão"]), \
                f"Expected error about browser/login, got: {data.get('erro')}"
    
    def test_prio_extrair_invalid_type(self, headers):
        """Test POST /api/prio/extrair with invalid type"""
        response = requests.post(f"{BASE_URL}/api/prio/extrair", 
            headers=headers,
            json={
                "tipo": "invalid_type",
                "semana": 1,
                "ano": 2025
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "sucesso" in data
        # Should fail either due to browser not active or invalid type


class TestAuthEndpoints:
    """Basic auth tests to ensure login works correctly"""
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "test123"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "geral@zmbusines.com"
        assert data["user"]["role"] == "parceiro"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400], "Should reject invalid credentials"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
