"""
Test UI/UX Improvements - Iteration 45
Tests for:
1. Lista de utilizadores compacta (/usuarios)
2. Dashboard Faturação com totais por motorista (/dashboard-faturacao)
3. Preços Especiais com info box (/admin/precos-especiais)
4. Backend endpoint /api/empresas-faturacao/dashboard/totais-ano
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthAndUsers:
    """Test authentication and user endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.admin_email = "admin@tvdefleet.com"
        self.admin_password = "Admin123!"
        self.parceiro_email = "geral@zmbusines.com"
        self.parceiro_password = "Admin123!"
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
    
    def test_parceiro_login(self):
        """Test parceiro login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.parceiro_email,
            "password": self.parceiro_password
        })
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
    
    def get_admin_token(self):
        """Helper to get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        return response.json()["access_token"]
    
    def test_get_all_users(self):
        """Test GET /api/users/all endpoint for user list page"""
        token = self.get_admin_token()
        response = requests.get(f"{BASE_URL}/api/users/all", 
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check that users have required fields for compact display
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "name" in user or "email" in user
            assert "role" in user


class TestDashboardFaturacao:
    """Test Dashboard Faturação endpoints - totais por motorista"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.admin_email = "admin@tvdefleet.com"
        self.admin_password = "Admin123!"
    
    def get_admin_token(self):
        """Helper to get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        return response.json()["access_token"]
    
    def test_dashboard_totais_ano_structure(self):
        """Test dashboard endpoint returns correct structure with motoristas"""
        token = self.get_admin_token()
        response = requests.get(f"{BASE_URL}/api/empresas-faturacao/dashboard/totais-ano?ano=2025",
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Dashboard endpoint failed: {response.text}"
        data = response.json()
        
        # Check required keys
        assert "ano" in data
        assert "empresas" in data
        assert "motoristas" in data, "Missing 'motoristas' key in response"
        assert "totais" in data
        
        # Check totais structure
        assert "valor" in data["totais"]
        assert "recibos" in data["totais"]
        
        # Motoristas should be a list
        assert isinstance(data["motoristas"], list)
    
    def test_dashboard_totais_ano_with_ano_param(self):
        """Test dashboard endpoint accepts ano parameter"""
        token = self.get_admin_token()
        for ano in [2024, 2025, 2026]:
            response = requests.get(f"{BASE_URL}/api/empresas-faturacao/dashboard/totais-ano?ano={ano}",
                                   headers={"Authorization": f"Bearer {token}"})
            assert response.status_code == 200
            data = response.json()
            assert data["ano"] == ano
    
    def test_dashboard_totais_ano_default_year(self):
        """Test dashboard endpoint uses current year when no ano param"""
        import datetime
        current_year = datetime.datetime.now().year
        
        token = self.get_admin_token()
        response = requests.get(f"{BASE_URL}/api/empresas-faturacao/dashboard/totais-ano",
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["ano"] == current_year
    
    def test_dashboard_empresas_list(self):
        """Test that empresas list contains correct structure"""
        token = self.get_admin_token()
        response = requests.get(f"{BASE_URL}/api/empresas-faturacao/dashboard/totais-ano?ano=2025",
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        
        # If there are empresas, check their structure
        if len(data["empresas"]) > 0:
            empresa = data["empresas"][0]
            assert "empresa_id" in empresa
            assert "empresa_nome" in empresa
            assert "total_valor" in empresa
            assert "total_recibos" in empresa
    
    def test_dashboard_motoristas_structure(self):
        """Test motoristas list has correct structure when present"""
        token = self.get_admin_token()
        response = requests.get(f"{BASE_URL}/api/empresas-faturacao/dashboard/totais-ano?ano=2025",
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        
        # Motoristas should have percentagem field
        if len(data["motoristas"]) > 0:
            motorista = data["motoristas"][0]
            assert "motorista_id" in motorista
            assert "motorista_nome" in motorista
            assert "total_valor" in motorista
            assert "total_recibos" in motorista
            assert "percentagem" in motorista, "Missing percentagem in motorista data"
            assert "empresas" in motorista, "Missing empresas breakdown in motorista"


class TestEmpresasFaturacao:
    """Test Empresas Faturação endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_email = "admin@tvdefleet.com"
        self.admin_password = "Admin123!"
    
    def get_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        return response.json()["access_token"]
    
    def test_list_empresas_faturacao(self):
        """Test GET /api/empresas-faturacao/ endpoint"""
        token = self.get_admin_token()
        response = requests.get(f"{BASE_URL}/api/empresas-faturacao/",
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestPrecosEspeciaisBackend:
    """Test Preços Especiais backend endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_email = "admin@tvdefleet.com"
        self.admin_password = "Admin123!"
    
    def get_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        return response.json()["access_token"]
    
    def test_list_planos_for_precos_especiais(self):
        """Test GET /api/gestao-planos/planos endpoint (used by PrecosEspeciais page)"""
        token = self.get_admin_token()
        response = requests.get(f"{BASE_URL}/api/gestao-planos/planos",
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_list_parceiros_for_precos_especiais(self):
        """Test GET /api/uber/admin/parceiros endpoint (used by PrecosEspeciais page)"""
        token = self.get_admin_token()
        response = requests.get(f"{BASE_URL}/api/uber/admin/parceiros",
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestUserModulosAccess:
    """Test User Modulos and Access endpoints (for GestaoUtilizadores)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_email = "admin@tvdefleet.com"
        self.admin_password = "Admin123!"
    
    def get_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        return response.json()["access_token"]
    
    def test_get_user_modulos(self):
        """Test GET /api/users/{id}/modulos endpoint"""
        token = self.get_admin_token()
        # First get list of users
        users_response = requests.get(f"{BASE_URL}/api/users/all",
                                      headers={"Authorization": f"Bearer {token}"})
        assert users_response.status_code == 200
        users = users_response.json()
        
        if len(users) > 0:
            user_id = users[0]["id"]
            response = requests.get(f"{BASE_URL}/api/users/{user_id}/modulos",
                                   headers={"Authorization": f"Bearer {token}"})
            # Should return 200 or 404 depending on if user has modulos
            assert response.status_code in [200, 404]
    
    def test_get_planos_list(self):
        """Test GET /api/planos endpoint (for plano dropdown in GestaoUtilizadores)"""
        token = self.get_admin_token()
        response = requests.get(f"{BASE_URL}/api/planos",
                               headers={"Authorization": f"Bearer {token}"})
        # May return 200 or 404 depending on if planos exist
        assert response.status_code in [200, 404]
    
    def test_get_modulos_list(self):
        """Test GET /api/gestao-planos/modulos endpoint (for acesso dialog)"""
        token = self.get_admin_token()
        response = requests.get(f"{BASE_URL}/api/gestao-planos/modulos",
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
