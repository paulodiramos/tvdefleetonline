"""
Test User Management Features - Iteration 53
Tests for new user management features:
1. Admin can assign partner to approved motoristas
2. Admin can change user role (motorista->gestor, parceiro)
3. Admin can view motorista documents
4. Approving motorista creates document in motoristas collection
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "Admin123!"


class TestAdminSetRole:
    """Test PUT /api/users/{id}/set-role endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Admin authentication failed")
    
    def test_set_role_same_role_returns_message(self, admin_token):
        """Test setting same role returns appropriate message"""
        # Get a motorista user
        users_response = requests.get(
            f"{BASE_URL}/api/users/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert users_response.status_code == 200
        
        motoristas = [u for u in users_response.json() if u.get("role") == "motorista"]
        if not motoristas:
            pytest.skip("No motoristas found")
        
        motorista = motoristas[0]
        
        # Set same role
        response = requests.put(
            f"{BASE_URL}/api/users/{motorista['id']}/set-role",
            json={"role": "motorista"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        assert "motorista" in response.json().get("message", "").lower()
        print(f"✓ Set-role same role returns: {response.json()['message']}")
    
    def test_set_role_change_role(self, admin_token):
        """Test changing user role works correctly"""
        # Create a test user to avoid modifying real data
        timestamp = int(time.time())
        test_email = f"test_role_{timestamp}@test.com"
        
        # Create motorista
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": f"Test Role User {timestamp}",
                "email": test_email,
                "password": "testpass123",
                "role": "motorista",
                "approved": True
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Change role to gestor
        response = requests.put(
            f"{BASE_URL}/api/users/{user_id}/set-role",
            json={"role": "gestao"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        assert "gestao" in response.json().get("message", "").lower()
        
        # Verify role was changed
        user_response = requests.get(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert user_response.status_code == 200
        assert user_response.json()["role"] == "gestao"
        
        print(f"✓ Role changed from motorista to gestao")
        
        # Change to parceiro
        response = requests.put(
            f"{BASE_URL}/api/users/{user_id}/set-role",
            json={"role": "parceiro"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        user_response = requests.get(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert user_response.json()["role"] == "parceiro"
        print(f"✓ Role changed from gestao to parceiro")
        
        # Cleanup - delete test user
        requests.delete(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_set_role_invalid_role(self, admin_token):
        """Test setting invalid role returns error"""
        users_response = requests.get(
            f"{BASE_URL}/api/users/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if not users_response.json():
            pytest.skip("No users found")
        
        user_id = users_response.json()[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/users/{user_id}/set-role",
            json={"role": "invalid_role"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400
        print(f"✓ Invalid role rejected with 400")
    
    def test_set_role_user_not_found(self, admin_token):
        """Test setting role for non-existent user"""
        fake_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/users/{fake_id}/set-role",
            json={"role": "motorista"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 404
        print(f"✓ Non-existent user returns 404")


class TestAtribuirParceiro:
    """Test PUT /api/motoristas/{id}/atribuir-parceiro endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def test_motorista_and_parceiro(self, admin_token):
        """Create test motorista and get a parceiro for testing"""
        # Get existing parceiro
        parceiros_response = requests.get(
            f"{BASE_URL}/api/parceiros",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert parceiros_response.status_code == 200
        parceiros = parceiros_response.json()
        if not parceiros:
            pytest.skip("No parceiros found")
        
        parceiro_id = parceiros[0]["id"]
        
        # Create test motorista via motoristas/register (this creates both user and motorista doc)
        timestamp = int(time.time())
        test_email = f"test_parceiro_assign_{timestamp}@test.com"
        
        create_response = requests.post(
            f"{BASE_URL}/api/motoristas/register",
            json={
                "name": f"Test Motorista {timestamp}",
                "email": test_email,
                "password": "testpass123",
                "phone": "912345678"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200, f"Failed to create motorista: {create_response.text}"
        motorista_id = create_response.json()["id"]
        
        # Approve the motorista to make sure it's ready
        requests.put(
            f"{BASE_URL}/api/users/{motorista_id}/approve",
            json={},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        yield {"motorista_id": motorista_id, "parceiro_id": parceiro_id}
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{motorista_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_atribuir_parceiro_success(self, admin_token, test_motorista_and_parceiro):
        """Test assigning partner to motorista"""
        motorista_id = test_motorista_and_parceiro["motorista_id"]
        parceiro_id = test_motorista_and_parceiro["parceiro_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{motorista_id}/atribuir-parceiro",
            json={"parceiro_id": parceiro_id},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Parceiro atribuído com sucesso"
        assert data["motorista_id"] == motorista_id
        assert data["parceiro_id"] == parceiro_id
        
        print(f"✓ Partner assigned successfully")
        
        # Verify in motoristas collection
        motorista_response = requests.get(
            f"{BASE_URL}/api/motoristas/{motorista_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert motorista_response.status_code == 200
        motorista_data = motorista_response.json()
        assert motorista_data.get("parceiro_atribuido") == parceiro_id or motorista_data.get("parceiro_id") == parceiro_id
        print(f"✓ Partner verified in motoristas collection")
    
    def test_atribuir_parceiro_missing_id(self, admin_token, test_motorista_and_parceiro):
        """Test assigning partner without parceiro_id fails"""
        motorista_id = test_motorista_and_parceiro["motorista_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{motorista_id}/atribuir-parceiro",
            json={},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400
        print(f"✓ Missing parceiro_id returns 400")
    
    def test_atribuir_parceiro_invalid_parceiro(self, admin_token, test_motorista_and_parceiro):
        """Test assigning invalid partner returns error"""
        motorista_id = test_motorista_and_parceiro["motorista_id"]
        fake_parceiro_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{motorista_id}/atribuir-parceiro",
            json={"parceiro_id": fake_parceiro_id},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 404
        print(f"✓ Invalid parceiro_id returns 404")
    
    def test_atribuir_parceiro_motorista_not_found(self, admin_token, test_motorista_and_parceiro):
        """Test assigning partner to non-existent motorista"""
        parceiro_id = test_motorista_and_parceiro["parceiro_id"]
        fake_motorista_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{fake_motorista_id}/atribuir-parceiro",
            json={"parceiro_id": parceiro_id},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 404
        print(f"✓ Non-existent motorista returns 404")


class TestApproveUserCreatesMotoristDoc:
    """Test that approving a motorista creates document in motoristas collection"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Admin authentication failed")
    
    def test_approve_motorista_creates_document(self, admin_token):
        """Test approving motorista creates document in motoristas collection"""
        # Create unapproved motorista
        timestamp = int(time.time())
        test_email = f"test_approve_{timestamp}@test.com"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": f"Test Approve Motorista {timestamp}",
                "email": test_email,
                "password": "testpass123",
                "role": "motorista",
                "approved": False,
                "phone": "912345678"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        print(f"✓ Created unapproved motorista: {user_id}")
        
        # Check motorista doc doesn't exist yet
        motorista_response = requests.get(
            f"{BASE_URL}/api/motoristas/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # It might return 404 or a basic doc from registration
        initial_exists = motorista_response.status_code == 200
        print(f"  Motorista doc exists before approval: {initial_exists}")
        
        # Approve the user
        approve_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}/approve",
            json={},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert approve_response.status_code == 200
        print(f"✓ User approved successfully")
        
        # Verify motorista document was created
        motorista_response = requests.get(
            f"{BASE_URL}/api/motoristas/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert motorista_response.status_code == 200
        motorista_data = motorista_response.json()
        
        assert motorista_data.get("approved") == True
        assert motorista_data.get("id") == user_id
        assert motorista_data.get("email") == test_email
        assert "id_cartao_frota_combustivel" in motorista_data
        
        print(f"✓ Motorista document created with id_cartao_frota: {motorista_data.get('id_cartao_frota_combustivel')}")
        
        # Verify motorista appears in motoristas list
        motoristas_response = requests.get(
            f"{BASE_URL}/api/motoristas",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert motoristas_response.status_code == 200
        motoristas = motoristas_response.json()
        
        found = any(m.get("id") == user_id for m in motoristas)
        assert found, "Approved motorista should appear in motoristas list"
        print(f"✓ Motorista appears in /api/motoristas list")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )


class TestViewMotoristaDocuments:
    """Test viewing motorista documents via navigation to /motoristas/{id}"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Admin authentication failed")
    
    def test_get_motorista_details(self, admin_token):
        """Test getting motorista details including documents"""
        # Get a motorista
        motoristas_response = requests.get(
            f"{BASE_URL}/api/motoristas",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert motoristas_response.status_code == 200
        motoristas = motoristas_response.json()
        
        if not motoristas:
            pytest.skip("No motoristas found")
        
        motorista = motoristas[0]
        motorista_id = motorista.get("id")
        
        # Get detailed motorista info
        detail_response = requests.get(
            f"{BASE_URL}/api/motoristas/{motorista_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert detail_response.status_code == 200
        detail_data = detail_response.json()
        
        # Verify documents field exists
        assert "documents" in detail_data or "documentos" in detail_data
        print(f"✓ Motorista details endpoint returns documents field")
        print(f"  Motorista: {detail_data.get('name')}")
        
        docs = detail_data.get("documents") or detail_data.get("documentos") or {}
        print(f"  Documents: {list(docs.keys()) if isinstance(docs, dict) else 'N/A'}")


class TestNelsonFranciscoSpecific:
    """Specific tests for Nelson Francisco (nemafra4@gmail.com) as mentioned in requirements"""
    
    NELSON_EMAIL = "nemafra4@gmail.com"
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Admin authentication failed")
    
    def test_nelson_exists_and_approved(self, admin_token):
        """Test Nelson Francisco exists and is approved"""
        users_response = requests.get(
            f"{BASE_URL}/api/users/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert users_response.status_code == 200
        
        nelson = next((u for u in users_response.json() if u.get("email") == self.NELSON_EMAIL), None)
        
        if not nelson:
            pytest.skip(f"Nelson Francisco ({self.NELSON_EMAIL}) not found")
        
        assert nelson["role"] == "motorista"
        assert nelson["approved"] == True
        print(f"✓ Nelson Francisco found: approved={nelson['approved']}, role={nelson['role']}")
        
        return nelson["id"]
    
    def test_nelson_in_motoristas_collection(self, admin_token):
        """Test Nelson appears in motoristas collection after approval"""
        users_response = requests.get(
            f"{BASE_URL}/api/users/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        nelson = next((u for u in users_response.json() if u.get("email") == self.NELSON_EMAIL), None)
        
        if not nelson:
            pytest.skip(f"Nelson Francisco ({self.NELSON_EMAIL}) not found")
        
        motorista_response = requests.get(
            f"{BASE_URL}/api/motoristas/{nelson['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert motorista_response.status_code == 200
        motorista_data = motorista_response.json()
        
        assert motorista_data.get("email") == self.NELSON_EMAIL
        print(f"✓ Nelson in motoristas collection")
        print(f"  parceiro_atribuido: {motorista_data.get('parceiro_atribuido')}")
        print(f"  parceiro_id: {motorista_data.get('parceiro_id')}")
    
    def test_nelson_partner_assignment(self, admin_token):
        """Test Nelson can have partner assigned/changed"""
        users_response = requests.get(
            f"{BASE_URL}/api/users/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        nelson = next((u for u in users_response.json() if u.get("email") == self.NELSON_EMAIL), None)
        
        if not nelson:
            pytest.skip(f"Nelson Francisco ({self.NELSON_EMAIL}) not found")
        
        # Get a parceiro
        parceiros_response = requests.get(
            f"{BASE_URL}/api/parceiros",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        parceiros = parceiros_response.json()
        if not parceiros:
            pytest.skip("No parceiros found")
        
        parceiro_id = parceiros[0]["id"]
        parceiro_name = parceiros[0].get("nome_empresa") or parceiros[0].get("name")
        
        # Assign partner to Nelson
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{nelson['id']}/atribuir-parceiro",
            json={"parceiro_id": parceiro_id},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        print(f"✓ Partner '{parceiro_name}' assigned to Nelson")
        
        # Verify assignment
        motorista_response = requests.get(
            f"{BASE_URL}/api/motoristas/{nelson['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        motorista_data = motorista_response.json()
        
        assert motorista_data.get("parceiro_id") == parceiro_id or motorista_data.get("parceiro_atribuido") == parceiro_id
        print(f"✓ Partner assignment verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
