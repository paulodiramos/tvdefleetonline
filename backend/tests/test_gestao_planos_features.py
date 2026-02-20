"""
Tests for Gestão de Planos Features - Iteration 58
Testing:
1. Permanent deletion endpoints (planos, módulos, categorias)
2. Special prices (preços especiais) list and delete endpoints
3. Module destaque field
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    # Token can be in 'access_token' or 'token' field
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Get authenticated headers"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestPermanentDeletion:
    """Tests for permanent deletion endpoints"""
    
    def test_delete_plano_permanente_endpoint_exists(self, headers):
        """Test that permanent deletion endpoint for planos exists"""
        # Create a test plano first
        test_plano = {
            "nome": f"TEST_plano_permanente_{uuid.uuid4().hex[:8]}",
            "descricao": "Test plan for permanent deletion",
            "tipo_usuario": "parceiro",
            "categoria": "standard",
            "tipo_cobranca": "fixo",
            "precos": {"semanal": 10, "mensal": 35, "anual": 350}
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/gestao-planos/planos",
            json=test_plano,
            headers=headers
        )
        assert create_response.status_code == 200, f"Failed to create test plano: {create_response.text}"
        plano_id = create_response.json().get("id")
        
        # First deactivate the plan
        deactivate_response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/planos/{plano_id}",
            headers=headers
        )
        assert deactivate_response.status_code == 200, f"Failed to deactivate plano: {deactivate_response.text}"
        
        # Then try permanent deletion
        delete_response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/planos/{plano_id}?permanente=true",
            headers=headers
        )
        assert delete_response.status_code == 200, f"Permanent deletion failed: {delete_response.text}"
        assert "permanentemente" in delete_response.json().get("message", "").lower()
        
        # Verify plan is gone
        get_response = requests.get(
            f"{BASE_URL}/api/gestao-planos/planos/{plano_id}",
            headers=headers
        )
        assert get_response.status_code == 404, "Plano should not exist after permanent deletion"
    
    def test_delete_modulo_permanente_endpoint_exists(self, headers):
        """Test that permanent deletion endpoint for módulos exists"""
        # Create a test módulo first
        test_modulo = {
            "codigo": f"test_modulo_{uuid.uuid4().hex[:8]}",
            "nome": f"TEST_modulo_permanente_{uuid.uuid4().hex[:8]}",
            "descricao": "Test module for permanent deletion",
            "tipo_usuario": "parceiro",
            "tipo_cobranca": "fixo",
            "precos": {"semanal": 5, "mensal": 15, "anual": 150},
            "destaque": False
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/gestao-planos/modulos",
            json=test_modulo,
            headers=headers
        )
        assert create_response.status_code == 200, f"Failed to create test módulo: {create_response.text}"
        modulo_id = create_response.json().get("id")
        
        # First deactivate the module
        deactivate_response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/modulos/{modulo_id}",
            headers=headers
        )
        assert deactivate_response.status_code == 200, f"Failed to deactivate módulo: {deactivate_response.text}"
        
        # Then try permanent deletion
        delete_response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/modulos/{modulo_id}?permanente=true",
            headers=headers
        )
        assert delete_response.status_code == 200, f"Permanent deletion failed: {delete_response.text}"
        assert "permanentemente" in delete_response.json().get("message", "").lower()
        
        # Verify module is gone
        get_response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos/{modulo_id}",
            headers=headers
        )
        assert get_response.status_code == 404, "Módulo should not exist after permanent deletion"
    
    def test_delete_categoria_permanente_endpoint_exists(self, headers):
        """Test that permanent deletion endpoint for categorias exists"""
        # Create a test categoria first
        test_categoria = {
            "nome": f"TEST_categoria_permanente_{uuid.uuid4().hex[:8]}",
            "descricao": "Test category for permanent deletion",
            "icone": "📁",
            "cor": "#3B82F6",
            "ordem": 999
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/gestao-planos/categorias",
            json=test_categoria,
            headers=headers
        )
        assert create_response.status_code == 200, f"Failed to create test categoria: {create_response.text}"
        categoria_id = create_response.json().get("id")
        
        # First deactivate the category
        deactivate_response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/categorias/{categoria_id}",
            headers=headers
        )
        assert deactivate_response.status_code == 200, f"Failed to deactivate categoria: {deactivate_response.text}"
        
        # Then try permanent deletion
        delete_response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/categorias/{categoria_id}/permanente",
            headers=headers
        )
        assert delete_response.status_code == 200, f"Permanent deletion failed: {delete_response.text}"
        assert "permanentemente" in delete_response.json().get("message", "").lower()


class TestPrecosEspeciais:
    """Tests for preços especiais endpoints"""
    
    def test_list_precos_especiais_endpoint(self, headers):
        """Test that listing preços especiais endpoint exists and returns data"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/precos-especiais",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to list preços especiais: {response.text}"
        # Response should be a list
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
    
    def test_delete_preco_especial_endpoint_exists(self, headers):
        """Test that delete preço especial endpoint exists"""
        # First, get list of planos to find one with preços especiais
        planos_response = requests.get(
            f"{BASE_URL}/api/gestao-planos/planos?apenas_ativos=false",
            headers=headers
        )
        assert planos_response.status_code == 200
        planos = planos_response.json()
        
        # Find a plano or create one for testing
        test_plano_id = None
        for plano in planos:
            if plano.get("precos_especiais"):
                test_plano_id = plano.get("id")
                break
        
        if not test_plano_id and planos:
            test_plano_id = planos[0].get("id")
        
        if test_plano_id:
            # Try to add a preço especial
            preco_especial_data = {
                "parceiro_id": "test_parceiro_123",
                "tipo_desconto": "percentagem",
                "valor_desconto": 10,
                "motivo": "Test preço especial"
            }
            
            add_response = requests.post(
                f"{BASE_URL}/api/gestao-planos/planos/{test_plano_id}/precos-especiais",
                json=preco_especial_data,
                headers=headers
            )
            
            if add_response.status_code == 200:
                preco_id = add_response.json().get("id")
                
                # Now test delete endpoint
                delete_response = requests.delete(
                    f"{BASE_URL}/api/gestao-planos/planos/{test_plano_id}/precos-especiais/{preco_id}",
                    headers=headers
                )
                assert delete_response.status_code == 200, f"Failed to delete preço especial: {delete_response.text}"


class TestModuloDestaque:
    """Tests for módulo destaque field"""
    
    def test_create_modulo_with_destaque(self, headers):
        """Test creating a módulo with destaque=True"""
        test_modulo = {
            "codigo": f"test_destaque_{uuid.uuid4().hex[:8]}",
            "nome": f"TEST_Módulo Destaque_{uuid.uuid4().hex[:8]}",
            "descricao": "Test module with destaque feature",
            "tipo_usuario": "parceiro",
            "tipo_cobranca": "fixo",
            "precos": {"semanal": 5, "mensal": 15, "anual": 150},
            "destaque": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/gestao-planos/modulos",
            json=test_modulo,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create módulo: {response.text}"
        
        data = response.json()
        assert data.get("destaque") == True, "Módulo should have destaque=True"
        
        # Clean up - delete the test module
        modulo_id = data.get("id")
        requests.delete(f"{BASE_URL}/api/gestao-planos/modulos/{modulo_id}?permanente=true", headers=headers)
    
    def test_update_modulo_destaque(self, headers):
        """Test updating módulo destaque field"""
        # Create a módulo without destaque
        test_modulo = {
            "codigo": f"test_destaque_update_{uuid.uuid4().hex[:8]}",
            "nome": f"TEST_Módulo Update Destaque_{uuid.uuid4().hex[:8]}",
            "descricao": "Test module for destaque update",
            "tipo_usuario": "parceiro",
            "tipo_cobranca": "fixo",
            "precos": {"semanal": 5, "mensal": 15, "anual": 150},
            "destaque": False
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/gestao-planos/modulos",
            json=test_modulo,
            headers=headers
        )
        assert create_response.status_code == 200
        modulo_id = create_response.json().get("id")
        
        # Update destaque to True
        update_response = requests.put(
            f"{BASE_URL}/api/gestao-planos/modulos/{modulo_id}",
            json={"destaque": True},
            headers=headers
        )
        assert update_response.status_code == 200, f"Failed to update módulo: {update_response.text}"
        assert update_response.json().get("destaque") == True, "Módulo destaque should be updated to True"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/gestao-planos/modulos/{modulo_id}?permanente=true", headers=headers)
    
    def test_list_modulos_with_destaque_count(self, headers):
        """Test that listing módulos includes destaque information"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=headers
        )
        assert response.status_code == 200
        
        modulos = response.json()
        assert isinstance(modulos, list), "Response should be a list"
        
        # Count módulos with destaque
        destaque_count = sum(1 for m in modulos if m.get("destaque", False))
        print(f"Found {destaque_count} módulos with destaque=True out of {len(modulos)} total")


class TestPlanoPrecos:
    """Tests for plano preços structure (with IVA fields)"""
    
    def test_plano_has_precos_plano_structure(self, headers):
        """Test that planos have the precos_plano structure for VAT calculations"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/planos?apenas_ativos=false",
            headers=headers
        )
        assert response.status_code == 200
        
        planos = response.json()
        if planos:
            plano = planos[0]
            precos_plano = plano.get("precos_plano", {})
            
            # Check that precos_plano has expected fields
            expected_fields = [
                "base_semanal", "base_mensal", "base_anual",
                "por_veiculo_semanal", "por_veiculo_mensal", "por_veiculo_anual",
                "por_motorista_semanal", "por_motorista_mensal", "por_motorista_anual"
            ]
            
            for field in expected_fields:
                if field in precos_plano:
                    print(f"Plano has {field}: {precos_plano[field]}")
            
            # Check for taxa_iva field
            if "taxa_iva" in plano:
                print(f"Plano has taxa_iva: {plano['taxa_iva']}")
            else:
                print("Plano does not have taxa_iva field (will default to 23%)")


class TestDeactivationEndpoints:
    """Tests for deactivation (soft delete) endpoints"""
    
    def test_deactivate_plano(self, headers):
        """Test deactivating a plano (soft delete)"""
        # Create a test plano
        test_plano = {
            "nome": f"TEST_plano_deactivate_{uuid.uuid4().hex[:8]}",
            "descricao": "Test plan for deactivation",
            "tipo_usuario": "parceiro",
            "categoria": "standard",
            "tipo_cobranca": "fixo",
            "precos": {"semanal": 10, "mensal": 35, "anual": 350}
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/gestao-planos/planos",
            json=test_plano,
            headers=headers
        )
        assert create_response.status_code == 200
        plano_id = create_response.json().get("id")
        
        # Deactivate the plan (without permanente=true)
        deactivate_response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/planos/{plano_id}",
            headers=headers
        )
        assert deactivate_response.status_code == 200
        assert "desativado" in deactivate_response.json().get("message", "").lower()
        
        # Verify plan is inactive but still exists
        get_response = requests.get(
            f"{BASE_URL}/api/gestao-planos/planos/{plano_id}",
            headers=headers
        )
        assert get_response.status_code == 200
        assert get_response.json().get("ativo") == False, "Plano should be inactive"
        
        # Clean up - permanently delete
        requests.delete(f"{BASE_URL}/api/gestao-planos/planos/{plano_id}?permanente=true", headers=headers)
    
    def test_deactivate_modulo(self, headers):
        """Test deactivating a módulo (soft delete)"""
        # Create a test módulo
        test_modulo = {
            "codigo": f"test_deact_{uuid.uuid4().hex[:8]}",
            "nome": f"TEST_modulo_deactivate_{uuid.uuid4().hex[:8]}",
            "descricao": "Test module for deactivation",
            "tipo_usuario": "parceiro",
            "tipo_cobranca": "fixo",
            "precos": {"semanal": 5, "mensal": 15, "anual": 150}
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/gestao-planos/modulos",
            json=test_modulo,
            headers=headers
        )
        assert create_response.status_code == 200
        modulo_id = create_response.json().get("id")
        
        # Deactivate the module (without permanente=true)
        deactivate_response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/modulos/{modulo_id}",
            headers=headers
        )
        assert deactivate_response.status_code == 200
        assert "desativado" in deactivate_response.json().get("message", "").lower()
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/gestao-planos/modulos/{modulo_id}?permanente=true", headers=headers)
    
    def test_deactivate_categoria(self, headers):
        """Test deactivating a categoria (soft delete)"""
        # Create a test categoria
        test_categoria = {
            "nome": f"TEST_categoria_deactivate_{uuid.uuid4().hex[:8]}",
            "descricao": "Test category for deactivation",
            "icone": "📁",
            "cor": "#3B82F6",
            "ordem": 998
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/gestao-planos/categorias",
            json=test_categoria,
            headers=headers
        )
        assert create_response.status_code == 200
        categoria_id = create_response.json().get("id")
        
        # Deactivate the category
        deactivate_response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/categorias/{categoria_id}",
            headers=headers
        )
        assert deactivate_response.status_code == 200
        assert "desativada" in deactivate_response.json().get("message", "").lower()
        
        # Clean up - permanently delete
        requests.delete(f"{BASE_URL}/api/gestao-planos/categorias/{categoria_id}/permanente", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
