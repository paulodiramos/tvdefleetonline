"""
TVDEFleet Regression Test Suite - Test Backend APIs
Tests: Auth, Comissões Dashboard, Gestão Planos, Storage Config, WhatsApp
"""

import pytest
import requests
import os
from datetime import datetime

# Base URL from environment variable
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fleet-reports-dash.preview.emergentagent.com')

# Test credentials
PARCEIRO_CREDENTIALS = {
    "email": "geral@zmbusines.com",
    "password": "Admin123!"
}

ADMIN_CREDENTIALS = {
    "email": "admin@tvdefleet.com",
    "password": "Admin123!"
}


@pytest.fixture(scope="module")
def parceiro_token():
    """Get authentication token for parceiro user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=PARCEIRO_CREDENTIALS,
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Parceiro authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def admin_token():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=ADMIN_CREDENTIALS,
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed - skipping admin tests")


@pytest.fixture
def parceiro_headers(parceiro_token):
    """Headers with parceiro auth token"""
    return {
        "Authorization": f"Bearer {parceiro_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


# ============ AUTH TESTS ============

class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_parceiro_success(self):
        """Test parceiro login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=PARCEIRO_CREDENTIALS,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == PARCEIRO_CREDENTIALS["email"]
        assert data["user"]["role"] == "parceiro"
        
    def test_login_admin_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDENTIALS,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_CREDENTIALS["email"]
        assert data["user"]["role"] == "admin"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 400, 404]
    
    def test_get_current_user(self, parceiro_headers):
        """Test getting current user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "role" in data


# ============ COMISSÕES DASHBOARD TESTS ============

class TestComissoesDashboard:
    """Comissões Dashboard API tests"""
    
    def test_dashboard_resumo(self, parceiro_headers):
        """Test comissões dashboard resumo endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/dashboard/resumo",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "periodo" in data
        assert "totais" in data
        assert "evolucao_semanal" in data
        assert "por_motorista" in data
        
        # Verify totais structure
        totais = data["totais"]
        assert "total_ganhos" in totais
        assert "total_despesas" in totais
        assert "total_comissoes" in totais
        assert "percentagem_comissao" in totais
        
    def test_dashboard_resumo_semanal(self, parceiro_headers):
        """Test comissões dashboard with semanal period"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/dashboard/resumo?periodo=semanal",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["periodo"] == "semanal"
        
    def test_dashboard_por_motorista(self, parceiro_headers):
        """Test comissões por motorista endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/dashboard/por-motorista",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "motoristas" in data
        assert "semana" in data
        assert "ano" in data


# ============ GESTÃO PLANOS & MÓDULOS TESTS ============

class TestGestaoPlanosModulos:
    """Gestão Planos e Módulos API tests"""
    
    def test_modulos_extras_list(self, parceiro_headers):
        """Test listing available extra modules"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos-extras",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "modulos_extras" in data
        assert "modulos_ativos" in data
        assert "total" in data
        assert isinstance(data["modulos_extras"], list)
        
    def test_modulos_list(self, parceiro_headers):
        """Test listing all modules"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
    def test_planos_list(self, parceiro_headers):
        """Test listing all plans"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/planos",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
    def test_minha_subscricao(self, parceiro_headers):
        """Test getting current user subscription"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/subscricoes/minha",
            headers=parceiro_headers
        )
        # May return 200 with null/None if no subscription
        assert response.status_code == 200


# ============ STORAGE CONFIG TESTS ============

class TestStorageConfig:
    """Storage Configuration API tests"""
    
    def test_get_storage_config(self, parceiro_headers):
        """Test getting storage configuration"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "parceiro_id" in data
        assert "modo" in data
        assert data["modo"] in ["local", "cloud", "both"]
        
    def test_list_cloud_providers(self, parceiro_headers):
        """Test listing cloud providers"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config/providers",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "providers" in data
        
        providers = data["providers"]
        assert isinstance(providers, list)
        
        # Verify expected providers
        provider_ids = [p["id"] for p in providers]
        assert "google_drive" in provider_ids
        assert "dropbox" in provider_ids
        assert "onedrive" in provider_ids
        
    def test_get_oauth_url_google(self, parceiro_headers):
        """Test getting OAuth URL for Google Drive - should fail without config"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config/oauth/google_drive/url",
            headers=parceiro_headers
        )
        # Expected 500 because OAuth not configured
        assert response.status_code == 500
        data = response.json()
        assert "não configurado" in data.get("detail", "").lower() or "not configured" in data.get("detail", "").lower()
        
    def test_get_sync_status(self, parceiro_headers):
        """Test getting sync status"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config/sync-status",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "pending_files" in data


# ============ WHATSAPP TESTS ============

class TestWhatsApp:
    """WhatsApp API tests"""
    
    def test_whatsapp_status(self, parceiro_headers):
        """Test getting WhatsApp connection status"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp-web/status",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "connected" in data
        assert "ready" in data
        assert isinstance(data["connected"], bool)


# ============ MOTORISTAS TESTS ============

class TestMotoristas:
    """Motoristas API tests"""
    
    def test_list_motoristas(self, parceiro_headers):
        """Test listing motoristas"""
        response = requests.get(
            f"{BASE_URL}/api/motoristas",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


# ============ VEHICLES TESTS ============

class TestVehicles:
    """Vehicles API tests"""
    
    def test_list_vehicles(self, parceiro_headers):
        """Test listing vehicles"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers=parceiro_headers
        )
        assert response.status_code == 200


# ============ COMISSÕES CONFIG TESTS ============

class TestComissoesConfig:
    """Comissões Configuration API tests"""
    
    def test_parceiro_config(self, parceiro_headers):
        """Test getting parceiro comissões config"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/parceiro/config",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "parceiro_id" in data
        assert "usar_escala_propria" in data or "usar_valor_fixo" in data
        
    def test_escalas_ativa(self, parceiro_headers):
        """Test getting active comissões scale"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/escalas/ativa",
            headers=parceiro_headers
        )
        assert response.status_code == 200


# ============ CONFIGURAÇÃO RELATÓRIOS TESTS ============

class TestConfiguracaoRelatorios:
    """Configuração Relatórios API tests"""
    
    def test_get_relatorio_config(self, parceiro_headers):
        """Test getting report configuration"""
        response = requests.get(
            f"{BASE_URL}/api/configuracoes/relatorios",
            headers=parceiro_headers
        )
        # May return 200 or 404 if not configured
        assert response.status_code in [200, 404]


# ============ MEU PLANO TESTS ============

class TestMeuPlano:
    """Meu Plano (parceiro plan) API tests"""
    
    def test_subscricao_minha(self, parceiro_headers):
        """Test getting current subscription"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/subscricoes/minha",
            headers=parceiro_headers
        )
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
