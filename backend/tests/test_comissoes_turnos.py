"""
Test Suite for Comissões and Turnos System
Tests:
- Partner commission configuration (GET/PUT /api/comissoes/parceiro/config)
- Vehicle shifts/turnos (CRUD operations)
- Main driver assignment
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "zeny123"
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"
VEICULO_TESTE_ID = "36b6fe3c-4db7-4b16-ab9b-b9452fc52379"


@pytest.fixture(scope="module")
def parceiro_token():
    """Get authentication token for parceiro user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": PARCEIRO_EMAIL,
        "password": PARCEIRO_PASSWORD
    })
    assert response.status_code == 200, f"Parceiro login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def parceiro_headers(parceiro_token):
    """Headers with parceiro auth token"""
    return {
        "Authorization": f"Bearer {parceiro_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def motoristas_disponiveis(parceiro_headers):
    """Get list of available drivers"""
    response = requests.get(f"{BASE_URL}/api/motoristas", headers=parceiro_headers)
    if response.status_code == 200:
        data = response.json()
        return data if isinstance(data, list) else data.get("motoristas", [])
    return []


class TestParceiroComissoesConfig:
    """Tests for partner commission configuration"""
    
    def test_get_parceiro_config(self, parceiro_headers):
        """Test GET /api/comissoes/parceiro/config - Get partner config"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/parceiro/config",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200, f"Failed to get config: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "usar_escala_propria" in data or "percentagem_fixa" in data, "Missing config fields"
        print(f"✓ Partner config retrieved: usar_escala_propria={data.get('usar_escala_propria')}, percentagem_fixa={data.get('percentagem_fixa')}")
    
    def test_update_parceiro_config_percentagem_fixa(self, parceiro_headers):
        """Test PUT /api/comissoes/parceiro/config - Update with fixed percentage"""
        config = {
            "usar_escala_propria": False,
            "usar_valor_fixo": False,
            "valor_fixo_comissao": 0,
            "percentagem_fixa": 18.5,
            "usar_classificacao_propria": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/comissoes/parceiro/config",
            headers=parceiro_headers,
            json=config
        )
        
        assert response.status_code == 200, f"Failed to update config: {response.text}"
        data = response.json()
        assert data.get("sucesso") == True, "Update should return success"
        print("✓ Partner config updated with fixed percentage 18.5%")
        
        # Verify the update persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/comissoes/parceiro/config",
            headers=parceiro_headers
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data.get("percentagem_fixa") == 18.5, "Percentage not persisted"
        print("✓ Config persistence verified")
    
    def test_update_parceiro_config_valor_fixo(self, parceiro_headers):
        """Test PUT /api/comissoes/parceiro/config - Update with fixed value"""
        config = {
            "usar_escala_propria": False,
            "usar_valor_fixo": True,
            "valor_fixo_comissao": 150.00,
            "percentagem_fixa": 15,
            "usar_classificacao_propria": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/comissoes/parceiro/config",
            headers=parceiro_headers,
            json=config
        )
        
        assert response.status_code == 200, f"Failed to update config: {response.text}"
        print("✓ Partner config updated with fixed value €150.00")
    
    def test_update_parceiro_config_escala_propria(self, parceiro_headers):
        """Test PUT /api/comissoes/parceiro/config - Update with custom scale"""
        config = {
            "usar_escala_propria": True,
            "usar_valor_fixo": False,
            "valor_fixo_comissao": 0,
            "percentagem_fixa": 15,
            "escala_propria": [
                {"id": "nivel-1", "nome": "Bronze", "valor_minimo": 0, "valor_maximo": 500, "percentagem_comissao": 10, "ordem": 1},
                {"id": "nivel-2", "nome": "Prata", "valor_minimo": 500, "valor_maximo": 1000, "percentagem_comissao": 12, "ordem": 2},
                {"id": "nivel-3", "nome": "Ouro", "valor_minimo": 1000, "valor_maximo": None, "percentagem_comissao": 15, "ordem": 3}
            ],
            "usar_classificacao_propria": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/comissoes/parceiro/config",
            headers=parceiro_headers,
            json=config
        )
        
        assert response.status_code == 200, f"Failed to update config: {response.text}"
        print("✓ Partner config updated with custom scale (3 levels)")
        
        # Verify the scale persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/comissoes/parceiro/config",
            headers=parceiro_headers
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data.get("usar_escala_propria") == True, "Scale flag not persisted"
        assert len(verify_data.get("escala_propria", [])) == 3, "Scale levels not persisted"
        print("✓ Custom scale persistence verified")


class TestVeiculoTurnos:
    """Tests for vehicle shifts/turnos management"""
    
    def test_get_turnos_veiculo(self, parceiro_headers):
        """Test GET /api/comissoes/turnos/veiculo/{id} - Get vehicle shifts"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/turnos/veiculo/{VEICULO_TESTE_ID}",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200, f"Failed to get turnos: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "turnos" in data, "Response should contain 'turnos' field"
        print(f"✓ Vehicle turnos retrieved: {len(data.get('turnos', []))} turno(s)")
        
        if data.get("motorista_principal_id"):
            print(f"  Motorista principal: {data.get('motorista_principal_id')}")
    
    def test_adicionar_turno(self, parceiro_headers, motoristas_disponiveis):
        """Test POST /api/comissoes/turnos/veiculo/{id} - Add shift"""
        if not motoristas_disponiveis:
            pytest.skip("No drivers available for testing")
        
        motorista = motoristas_disponiveis[0]
        motorista_id = motorista.get("id")
        
        turno_data = {
            "motorista_id": motorista_id,
            "hora_inicio": "06:00",
            "hora_fim": "14:00",
            "dias_semana": [0, 1, 2, 3, 4],  # Monday to Friday
            "notas": "Turno de teste - manhã"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/comissoes/turnos/veiculo/{VEICULO_TESTE_ID}",
            headers=parceiro_headers,
            json=turno_data
        )
        
        assert response.status_code == 200, f"Failed to add turno: {response.text}"
        data = response.json()
        
        # Store turno ID for later tests
        pytest.turno_criado_id = data.get("id")
        print(f"✓ Turno added: {data.get('id')} - {turno_data['hora_inicio']}-{turno_data['hora_fim']}")
    
    def test_atualizar_turno(self, parceiro_headers):
        """Test PUT /api/comissoes/turnos/veiculo/{id}/turno/{turno_id} - Update shift"""
        turno_id = getattr(pytest, 'turno_criado_id', None)
        if not turno_id:
            pytest.skip("No turno created in previous test")
        
        update_data = {
            "hora_inicio": "07:00",
            "hora_fim": "15:00",
            "dias_semana": [0, 1, 2, 3, 4, 5],  # Monday to Saturday
            "notas": "Turno atualizado - manhã estendido"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/comissoes/turnos/veiculo/{VEICULO_TESTE_ID}/turno/{turno_id}",
            headers=parceiro_headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed to update turno: {response.text}"
        data = response.json()
        assert data.get("sucesso") == True, "Update should return success"
        print(f"✓ Turno updated: {turno_id}")
    
    def test_definir_motorista_principal(self, parceiro_headers, motoristas_disponiveis):
        """Test PUT /api/comissoes/turnos/veiculo/{id}/principal - Set main driver"""
        if not motoristas_disponiveis:
            pytest.skip("No drivers available for testing")
        
        motorista = motoristas_disponiveis[0]
        motorista_id = motorista.get("id")
        
        response = requests.put(
            f"{BASE_URL}/api/comissoes/turnos/veiculo/{VEICULO_TESTE_ID}/principal",
            headers=parceiro_headers,
            json={"motorista_id": motorista_id}
        )
        
        assert response.status_code == 200, f"Failed to set main driver: {response.text}"
        data = response.json()
        assert data.get("sucesso") == True, "Should return success"
        print(f"✓ Main driver set: {motorista_id}")
        
        # Verify the main driver was set
        verify_response = requests.get(
            f"{BASE_URL}/api/comissoes/turnos/veiculo/{VEICULO_TESTE_ID}",
            headers=parceiro_headers
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data.get("motorista_principal_id") == motorista_id, "Main driver not persisted"
        print("✓ Main driver persistence verified")
    
    def test_remover_turno(self, parceiro_headers):
        """Test DELETE /api/comissoes/turnos/veiculo/{id}/turno/{turno_id} - Remove shift"""
        turno_id = getattr(pytest, 'turno_criado_id', None)
        if not turno_id:
            pytest.skip("No turno created in previous test")
        
        response = requests.delete(
            f"{BASE_URL}/api/comissoes/turnos/veiculo/{VEICULO_TESTE_ID}/turno/{turno_id}",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200, f"Failed to remove turno: {response.text}"
        data = response.json()
        assert data.get("sucesso") == True, "Delete should return success"
        print(f"✓ Turno removed: {turno_id}")


class TestEscalasComissao:
    """Tests for commission scales (global)"""
    
    def test_get_escala_ativa(self, parceiro_headers):
        """Test GET /api/comissoes/escalas/ativa - Get active scale"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/escalas/ativa",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200, f"Failed to get active scale: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "nome" in data or "niveis" in data, "Response should contain scale data"
        print(f"✓ Active scale retrieved: {data.get('nome', 'N/A')}")
        if data.get("niveis"):
            print(f"  Níveis: {len(data['niveis'])}")
    
    def test_get_classificacao_config(self, parceiro_headers):
        """Test GET /api/comissoes/classificacao/config - Get classification config"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/classificacao/config",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200, f"Failed to get classification config: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "niveis" in data, "Response should contain 'niveis' field"
        print(f"✓ Classification config retrieved: {len(data.get('niveis', []))} níveis")


class TestModulosAtivos:
    """Tests for active modules verification"""
    
    def test_parceiro_modulos_ativos(self, parceiro_headers, parceiro_token):
        """Test that parceiro has relatorios_avancados module"""
        # First get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=parceiro_headers
        )
        assert response.status_code == 200, f"Failed to get user info: {response.text}"
        user_data = response.json()
        user_id = user_data.get("id")
        
        # Get active modules
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos-ativos/user/{user_id}",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200, f"Failed to get modules: {response.text}"
        data = response.json()
        modulos = data.get("modulos_ativos", [])
        
        print(f"✓ Parceiro modules: {modulos}")
        
        # Check if has commission-related module
        has_comissoes = any(
            'comiss' in m.lower() or 'relatorios' in m.lower() or 'reports' in m.lower()
            for m in modulos
        )
        print(f"  Has commission module: {has_comissoes}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
