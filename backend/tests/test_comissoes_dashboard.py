"""
Test suite for Comissoes Dashboard APIs
Tests /api/comissoes/dashboard/resumo and /api/comissoes/dashboard/por-motorista endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASS = "Admin123!"
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASS = "Admin123!"


class TestComissoesDashboard:
    """Test Comissões Dashboard APIs"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Login as parceiro and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASS}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip(f"Parceiro login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    
    def test_dashboard_resumo_semanal_parceiro(self, parceiro_token):
        """Test GET /api/comissoes/dashboard/resumo with semanal period as parceiro"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/comissoes/dashboard/resumo",
            params={"periodo": "semanal", "ano": 2026, "semana": 1},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "periodo" in data, "Response should contain 'periodo'"
        assert "totais" in data, "Response should contain 'totais'"
        assert data["periodo"] == "semanal"
        
        # Validate totais structure
        totais = data.get("totais", {})
        assert "total_comissoes" in totais or totais.get("total_comissoes") is not None
        assert "total_ganhos" in totais or totais.get("total_ganhos") is not None
        assert "total_despesas" in totais or totais.get("total_despesas") is not None
        assert "total_motoristas" in totais or totais.get("total_motoristas") is not None
        
        print(f"✅ Dashboard resumo semanal: {totais}")
    
    def test_dashboard_resumo_mensal_parceiro(self, parceiro_token):
        """Test GET /api/comissoes/dashboard/resumo with mensal period as parceiro"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/comissoes/dashboard/resumo",
            params={"periodo": "mensal", "ano": 2026, "mes": 1},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["periodo"] == "mensal"
        assert "totais" in data
        assert "evolucao_semanal" in data
        assert "top_motoristas" in data
        
        print(f"✅ Dashboard resumo mensal OK: totais={data.get('totais', {})}")
    
    def test_dashboard_por_motorista_parceiro(self, parceiro_token):
        """Test GET /api/comissoes/dashboard/por-motorista as parceiro"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/comissoes/dashboard/por-motorista",
            params={"ano": 2026, "semana": 1},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "motoristas" in data, "Response should contain 'motoristas'"
        assert "semana" in data
        assert "ano" in data
        
        motoristas = data.get("motoristas", [])
        print(f"✅ Dashboard por motorista: {len(motoristas)} motoristas encontrados")
        
        # Validate motorista data structure if any exist
        for m in motoristas[:2]:  # Check first 2
            assert "motorista_id" in m or m.get("motorista_id") is not None
            assert "total_ganhos" in m or m.get("total_ganhos") is not None
    
    def test_dashboard_resumo_admin(self, admin_token):
        """Test GET /api/comissoes/dashboard/resumo as admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/comissoes/dashboard/resumo",
            params={"periodo": "mensal", "ano": 2026, "mes": 1},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "totais" in data
        print(f"✅ Dashboard resumo admin OK")
    
    def test_dashboard_resumo_unauthorized(self):
        """Test GET /api/comissoes/dashboard/resumo without authentication"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/dashboard/resumo",
            params={"periodo": "mensal"}
        )
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Unauthorized access correctly blocked")


class TestConfigComissoesParceiro:
    """Test Comissões Configuration for Parceiro"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Login as parceiro and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASS}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip(f"Parceiro login failed: {response.status_code}")
    
    def test_get_config_parceiro(self, parceiro_token):
        """Test GET /api/comissoes/parceiro/config"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/comissoes/parceiro/config",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should have parceiro_id or config fields
        assert "parceiro_id" in data or "usar_escala_propria" in data or "percentagem_fixa" in data
        print(f"✅ Config parceiro retrieved: percentagem={data.get('percentagem_fixa', 'N/A')}")
    
    def test_update_config_parceiro(self, parceiro_token):
        """Test PUT /api/comissoes/parceiro/config"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        config_update = {
            "usar_escala_propria": False,
            "usar_valor_fixo": False,
            "percentagem_fixa": 70,
            "valor_fixo_comissao": 0
        }
        
        response = requests.put(
            f"{BASE_URL}/api/comissoes/parceiro/config",
            json=config_update,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("sucesso") == True or "mensagem" in data
        print(f"✅ Config parceiro updated successfully")


class TestConfiguracaoRelatoriosNIF:
    """Test NIF checkbox in reports configuration"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Login as parceiro and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASS}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip(f"Parceiro login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def parceiro_id(self, parceiro_token):
        """Get parceiro ID"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=headers
        )
        if response.status_code == 200:
            return response.json().get("id")
        pytest.skip("Could not get parceiro ID")
    
    def test_get_relatorio_config(self, parceiro_token, parceiro_id):
        """Test GET /api/parceiros/{parceiro_id}/config-relatorio"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/config-relatorio",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check if NIF field exists in config
        print(f"✅ Relatorio config retrieved. incluir_nif_parceiro={data.get('incluir_nif_parceiro', 'N/A')}")
    
    def test_update_relatorio_config_with_nif(self, parceiro_token, parceiro_id):
        """Test PUT /api/parceiros/{parceiro_id}/config-relatorio with NIF enabled"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        # First get current config
        get_response = requests.get(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/config-relatorio",
            headers=headers
        )
        
        current_config = get_response.json() if get_response.status_code == 200 else {}
        
        # Update with NIF enabled
        config_update = {
            **current_config,
            "incluir_nif_parceiro": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/config-relatorio",
            json=config_update,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ Relatorio config updated with incluir_nif_parceiro=True")
        
        # Verify the update persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/config-relatorio",
            headers=headers
        )
        
        if verify_response.status_code == 200:
            verify_data = verify_response.json()
            assert verify_data.get("incluir_nif_parceiro") == True, "NIF setting should be True after update"
            print(f"✅ NIF setting verified as enabled")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
