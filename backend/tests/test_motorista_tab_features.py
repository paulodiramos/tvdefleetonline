"""
Test Motorista Tab Features in User Profile
Tests for:
- PUT /api/motoristas/{id}/atribuir-parceiro - Assign partner to motorista
- PUT /api/users/{id}/plano - Assign plan to user
- GET /api/parceiros - List available partners
- GET /api/planos - List available plans
- Verify motorista appears in list after partner assignment
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = 'https://cloud-fleet-manager.preview.emergentagent.com'

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "Admin123!"

# Test motorista ID
TEST_MOTORISTA_ID = "57d6a119-e5af-4c7f-b357-49dc4f618763"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestMotoristaParceirosAPI:
    """Test partner-related APIs for motoristas"""
    
    def test_get_parceiros_list(self, headers):
        """Test GET /api/parceiros - List available partners"""
        response = requests.get(f"{BASE_URL}/api/parceiros", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify parceiro structure
        parceiro = data[0]
        assert "id" in parceiro
        print(f"Found {len(data)} parceiros")
    
    def test_get_motorista_details(self, headers):
        """Test GET /api/motoristas/{id} - Get motorista details"""
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == TEST_MOTORISTA_ID
        assert "name" in data
        assert "email" in data
        print(f"Motorista: {data['name']}, parceiro_atribuido: {data.get('parceiro_atribuido')}")
    
    def test_get_user_details(self, headers):
        """Test GET /api/users/{id} - Get user details for motorista"""
        response = requests.get(
            f"{BASE_URL}/api/users/{TEST_MOTORISTA_ID}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == TEST_MOTORISTA_ID
        assert data["role"] == "motorista"
        print(f"User role: {data['role']}, parceiro_id: {data.get('parceiro_id')}")
    
    def test_atribuir_parceiro_to_motorista(self, headers):
        """Test PUT /api/motoristas/{id}/atribuir-parceiro"""
        # First get list of parceiros
        parceiros_response = requests.get(f"{BASE_URL}/api/parceiros", headers=headers)
        parceiros = parceiros_response.json()
        assert len(parceiros) > 0
        
        # Select a parceiro to assign
        parceiro_id = parceiros[0]["id"]
        
        # Assign parceiro to motorista
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/atribuir-parceiro",
            headers=headers,
            json={"parceiro_id": parceiro_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["motorista_id"] == TEST_MOTORISTA_ID
        assert data["parceiro_id"] == parceiro_id
        print(f"Assigned parceiro {parceiro_id} to motorista")
        
        # Verify the assignment
        motorista_response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}",
            headers=headers
        )
        motorista_data = motorista_response.json()
        assert motorista_data["parceiro_atribuido"] == parceiro_id
        assert motorista_data["parceiro_id"] == parceiro_id
        print(f"Verified: parceiro_atribuido = {motorista_data['parceiro_atribuido']}")
    
    def test_atribuir_parceiro_invalid_parceiro(self, headers):
        """Test assigning invalid parceiro returns error"""
        invalid_parceiro_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/atribuir-parceiro",
            headers=headers,
            json={"parceiro_id": invalid_parceiro_id}
        )
        
        assert response.status_code == 404
        print("Correctly rejected invalid parceiro_id")
    
    def test_atribuir_parceiro_missing_parceiro_id(self, headers):
        """Test missing parceiro_id returns error"""
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/atribuir-parceiro",
            headers=headers,
            json={}
        )
        
        assert response.status_code == 400
        print("Correctly rejected missing parceiro_id")


class TestMotoristaPlanoAPI:
    """Test plan assignment APIs"""
    
    def test_get_planos_list(self, headers):
        """Test GET /api/planos - List available plans"""
        response = requests.get(f"{BASE_URL}/api/planos", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify plano structure
        plano = data[0]
        assert "id" in plano
        assert "nome" in plano
        print(f"Found {len(data)} planos")
    
    def test_atribuir_plano_to_user(self, headers):
        """Test PUT /api/users/{id}/plano"""
        # First get list of planos
        planos_response = requests.get(f"{BASE_URL}/api/planos", headers=headers)
        planos = planos_response.json()
        assert len(planos) > 0
        
        # Select a plano to assign
        plano_id = planos[0]["id"]
        plano_nome = planos[0]["nome"]
        
        # Assign plano to user
        response = requests.put(
            f"{BASE_URL}/api/users/{TEST_MOTORISTA_ID}/plano",
            headers=headers,
            json={"plano_id": plano_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Assigned plano {plano_nome} to user")
        
        # Verify the assignment
        user_response = requests.get(
            f"{BASE_URL}/api/users/{TEST_MOTORISTA_ID}",
            headers=headers
        )
        user_data = user_response.json()
        assert user_data["plano_id"] == plano_id
        print(f"Verified: plano_id = {user_data['plano_id']}, plano_nome = {user_data.get('plano_nome')}")
    
    def test_atribuir_plano_invalid_plano(self, headers):
        """Test assigning invalid plano returns error"""
        invalid_plano_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/users/{TEST_MOTORISTA_ID}/plano",
            headers=headers,
            json={"plano_id": invalid_plano_id}
        )
        
        assert response.status_code == 404
        print("Correctly rejected invalid plano_id")


class TestMotoristaInList:
    """Test motorista appears correctly in list after assignment"""
    
    def test_motorista_in_list(self, headers):
        """Test GET /api/motoristas - Motorista appears in list"""
        response = requests.get(f"{BASE_URL}/api/motoristas", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Find our test motorista
        motorista = next((m for m in data if m["id"] == TEST_MOTORISTA_ID), None)
        assert motorista is not None, f"Motorista {TEST_MOTORISTA_ID} not found in list"
        
        print(f"Found motorista: {motorista['name']}")
        print(f"  parceiro_atribuido: {motorista.get('parceiro_atribuido')}")
        print(f"  approved: {motorista.get('approved')}")
    
    def test_motorista_has_parceiro_name(self, headers):
        """Test motorista includes parceiro name in response"""
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check parceiro_atribuido_nome is present
        assert "parceiro_atribuido" in data
        if data["parceiro_atribuido"]:
            assert "parceiro_atribuido_nome" in data
            print(f"Parceiro nome: {data['parceiro_atribuido_nome']}")


class TestApproveUserCreatesMotoristaDoc:
    """Test that approving a user creates motorista document if not exists"""
    
    def test_approve_user_endpoint(self, headers):
        """Test PUT /api/users/{id}/approve endpoint exists and works for approved user"""
        # Get current user status
        user_response = requests.get(
            f"{BASE_URL}/api/users/{TEST_MOTORISTA_ID}",
            headers=headers
        )
        user_data = user_response.json()
        
        # If already approved, re-approving should still work
        response = requests.put(
            f"{BASE_URL}/api/users/{TEST_MOTORISTA_ID}/approve",
            headers=headers,
            json={}
        )
        
        # Should succeed (200) since already approved
        assert response.status_code == 200
        print(f"Approve endpoint works, user approved status: {user_data.get('approved')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
