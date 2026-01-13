"""
Test suite for Alertas de Custos feature
Tests the cost alerts configuration, verification, and history endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARCEIRO_CREDENTIALS = {
    "email": "parceiro@tvdefleet.com",
    "password": "123456"
}


class TestAuth:
    """Authentication tests for alertas endpoints"""
    
    def test_parceiro_login(self):
        """Test parceiro can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=PARCEIRO_CREDENTIALS
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "parceiro"
        print(f"✓ Parceiro login successful: {data['user']['email']}")


class TestAlertasConfigLimites:
    """Tests for GET/POST /api/alertas/config-limites"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=PARCEIRO_CREDENTIALS
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_config_limites_default(self):
        """Test getting default config when none exists"""
        response = requests.get(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify default structure
        assert "ativo" in data
        assert "limites" in data
        assert "periodo" in data
        assert "notificar_email" in data
        assert "notificar_app" in data
        assert "percentual_aviso" in data
        print(f"✓ Config limites retrieved: ativo={data['ativo']}, periodo={data['periodo']}")
    
    def test_post_config_limites(self):
        """Test saving config limites"""
        config = {
            "ativo": True,
            "limites": {
                "combustivel_fossil": 500,
                "combustivel_eletrico": 300,
                "via_verde": 100,
                "portagem": 50,
                "gps": 30,
                "seguros": 200,
                "manutencao": 150,
                "lavagem": 40,
                "pneus": 100,
                "estacionamento": 60,
                "outros": 80
            },
            "periodo": "semanal",
            "notificar_email": True,
            "notificar_app": True,
            "percentual_aviso": 75
        }
        
        response = requests.post(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers,
            json=config
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Configuração guardada com sucesso"
        print("✓ Config limites saved successfully")
    
    def test_verify_config_persisted(self):
        """Test that saved config is persisted correctly"""
        # First save a config
        config = {
            "ativo": True,
            "limites": {"combustivel_fossil": 600},
            "periodo": "mensal",
            "notificar_email": False,
            "notificar_app": True,
            "percentual_aviso": 85
        }
        
        requests.post(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers,
            json=config
        )
        
        # Then verify it was saved
        response = requests.get(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["ativo"] == True
        assert data["limites"]["combustivel_fossil"] == 600
        assert data["periodo"] == "mensal"
        assert data["percentual_aviso"] == 85
        print("✓ Config persisted correctly with all values")
    
    def test_config_limites_unauthorized(self):
        """Test that unauthorized access is rejected"""
        response = requests.get(
            f"{BASE_URL}/api/alertas/config-limites"
        )
        assert response.status_code in [401, 403]
        print("✓ Unauthorized access correctly rejected")


class TestAlertasCustosVerificar:
    """Tests for GET /api/alertas/custos/verificar"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=PARCEIRO_CREDENTIALS
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_verificar_custos_inactive(self):
        """Test verificar when alerts are inactive"""
        # First deactivate alerts
        config = {
            "ativo": False,
            "limites": {},
            "periodo": "semanal",
            "notificar_email": False,
            "notificar_app": True,
            "percentual_aviso": 80
        }
        requests.post(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers,
            json=config
        )
        
        response = requests.get(
            f"{BASE_URL}/api/alertas/custos/verificar",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "alertas" in data
        assert data["alertas"] == []
        print("✓ Verificar returns empty when alerts inactive")
    
    def test_verificar_custos_active(self):
        """Test verificar when alerts are active"""
        # First activate alerts with limits
        config = {
            "ativo": True,
            "limites": {"combustivel_fossil": 500, "manutencao": 200},
            "periodo": "semanal",
            "notificar_email": False,
            "notificar_app": True,
            "percentual_aviso": 80
        }
        requests.post(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers,
            json=config
        )
        
        response = requests.get(
            f"{BASE_URL}/api/alertas/custos/verificar",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "periodo" in data
        assert "alertas" in data
        assert "resumo" in data
        
        # Verify periodo structure
        assert "tipo" in data["periodo"]
        assert "inicio" in data["periodo"]
        assert "fim" in data["periodo"]
        
        # Verify resumo structure
        assert "total_alertas" in data["resumo"]
        assert "criticos" in data["resumo"]
        assert "avisos" in data["resumo"]
        
        print(f"✓ Verificar returns correct structure: {data['resumo']}")
    
    def test_verificar_custos_periodo_semanal(self):
        """Test verificar with weekly period"""
        config = {
            "ativo": True,
            "limites": {"combustivel_fossil": 500},
            "periodo": "semanal",
            "notificar_email": False,
            "notificar_app": True,
            "percentual_aviso": 80
        }
        requests.post(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers,
            json=config
        )
        
        response = requests.get(
            f"{BASE_URL}/api/alertas/custos/verificar",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["periodo"]["tipo"] == "semanal"
        print(f"✓ Verificar with semanal period: {data['periodo']['inicio']} to {data['periodo']['fim']}")
    
    def test_verificar_custos_periodo_mensal(self):
        """Test verificar with monthly period"""
        config = {
            "ativo": True,
            "limites": {"combustivel_fossil": 500},
            "periodo": "mensal",
            "notificar_email": False,
            "notificar_app": True,
            "percentual_aviso": 80
        }
        requests.post(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers,
            json=config
        )
        
        response = requests.get(
            f"{BASE_URL}/api/alertas/custos/verificar",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["periodo"]["tipo"] == "mensal"
        print(f"✓ Verificar with mensal period: {data['periodo']['inicio']} to {data['periodo']['fim']}")


class TestAlertasCustosHistorico:
    """Tests for GET /api/alertas/custos/historico"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=PARCEIRO_CREDENTIALS
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_historico(self):
        """Test getting alert history"""
        response = requests.get(
            f"{BASE_URL}/api/alertas/custos/historico",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list)
        print(f"✓ Historico retrieved: {len(data)} alerts in history")
    
    def test_historico_unauthorized(self):
        """Test that unauthorized access is rejected"""
        response = requests.get(
            f"{BASE_URL}/api/alertas/custos/historico"
        )
        assert response.status_code in [401, 403]
        print("✓ Unauthorized access to historico correctly rejected")


class TestAlertasIntegration:
    """Integration tests for the complete alertas flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=PARCEIRO_CREDENTIALS
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_full_config_flow(self):
        """Test complete configuration flow"""
        # 1. Get initial config
        response = requests.get(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers
        )
        assert response.status_code == 200
        initial_config = response.json()
        print(f"✓ Step 1: Got initial config (ativo={initial_config['ativo']})")
        
        # 2. Save new config
        new_config = {
            "ativo": True,
            "limites": {
                "combustivel_fossil": 450,
                "combustivel_eletrico": 250,
                "via_verde": 80,
                "manutencao": 180
            },
            "periodo": "semanal",
            "notificar_email": True,
            "notificar_app": True,
            "percentual_aviso": 70
        }
        response = requests.post(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers,
            json=new_config
        )
        assert response.status_code == 200
        print("✓ Step 2: Saved new config")
        
        # 3. Verify config was saved
        response = requests.get(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers
        )
        assert response.status_code == 200
        saved_config = response.json()
        assert saved_config["ativo"] == True
        assert saved_config["limites"]["combustivel_fossil"] == 450
        assert saved_config["percentual_aviso"] == 70
        print("✓ Step 3: Verified config was saved correctly")
        
        # 4. Check current alerts
        response = requests.get(
            f"{BASE_URL}/api/alertas/custos/verificar",
            headers=self.headers
        )
        assert response.status_code == 200
        alertas = response.json()
        assert "alertas" in alertas
        assert "resumo" in alertas
        print(f"✓ Step 4: Checked current alerts (total={alertas['resumo']['total_alertas']})")
        
        # 5. Check history
        response = requests.get(
            f"{BASE_URL}/api/alertas/custos/historico",
            headers=self.headers
        )
        assert response.status_code == 200
        historico = response.json()
        assert isinstance(historico, list)
        print(f"✓ Step 5: Checked history ({len(historico)} items)")
        
        print("✓ Full config flow completed successfully!")


class TestCleanup:
    """Cleanup test data after tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=PARCEIRO_CREDENTIALS
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_reset_config(self):
        """Reset config to default state"""
        config = {
            "ativo": False,
            "limites": {},
            "periodo": "semanal",
            "notificar_email": False,
            "notificar_app": True,
            "percentual_aviso": 80
        }
        response = requests.post(
            f"{BASE_URL}/api/alertas/config-limites",
            headers=self.headers,
            json=config
        )
        assert response.status_code == 200
        print("✓ Config reset to default state")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
