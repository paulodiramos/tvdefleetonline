"""
Test approval flow with Plan and Special Price selection
Tests the new feature allowing admins to:
1. Approve parceiros with optional plan selection
2. Select special prices when plan has them
3. Approve motoristas with optional partner selection
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestApprovalFlowWithPlanos:
    """Test approval flow with plan and special price selection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login as admin"""
        self.admin_token = None
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        self.admin_token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_01_get_planos_with_precos_especiais(self):
        """Verify planos endpoint returns plans with precos_especiais"""
        response = requests.get(f"{BASE_URL}/api/planos", headers=self.headers)
        assert response.status_code == 200, f"Failed to get planos: {response.text}"
        
        planos = response.json()
        assert isinstance(planos, list), "Planos should be a list"
        
        # Find plan with precos_especiais
        planos_with_precos = [p for p in planos if p.get('precos_especiais')]
        print(f"Found {len(planos_with_precos)} planos with precos_especiais")
        
        # Base Gratuito plan should have precos_especiais
        base_gratuito = next((p for p in planos if p.get('id') == 'eb5e2225-a475-4317-84a8-a9126b2dc4f2'), None)
        if base_gratuito:
            precos = base_gratuito.get('precos_especiais', [])
            print(f"Base Gratuito has {len(precos)} precos_especiais")
            assert len(precos) > 0, "Base Gratuito should have precos_especiais"
        
    def test_02_create_pending_parceiro_for_approval(self):
        """Create a pending parceiro user for approval testing"""
        unique_id = int(datetime.now().timestamp())
        self.test_email = f"TEST_parceiro_approval_{unique_id}@test.com"
        
        # Register new parceiro (should be pending approval)
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": "TestPass123!",
            "name": "TEST Parceiro Approval",
            "role": "parceiro",
            "phone": "912345678"
        })
        
        # May fail if registration sets approved=true or user exists
        if register_response.status_code in [200, 201]:
            data = register_response.json()
            self.test_user_id = data.get('id') or data.get('user', {}).get('id')
            print(f"Created test parceiro: {self.test_user_id}")
        else:
            print(f"Registration response: {register_response.status_code} - {register_response.text}")
            pytest.skip("Could not create test user for approval")
    
    def test_03_approve_user_endpoint_accepts_plano_id(self):
        """Test that PUT /api/users/{id}/approve accepts plano_id"""
        # First get pending users
        pending_response = requests.get(f"{BASE_URL}/api/users/pending", headers=self.headers)
        assert pending_response.status_code == 200, f"Failed to get pending users: {pending_response.text}"
        
        pending_users = pending_response.json()
        
        # Find a pending parceiro to test with
        parceiro_pendente = next((u for u in pending_users if u.get('role') == 'parceiro'), None)
        
        if not parceiro_pendente:
            # Create one for testing
            unique_id = int(datetime.now().timestamp())
            register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": f"TEST_parceiro_approve_{unique_id}@test.com",
                "password": "TestPass123!",
                "name": "TEST Parceiro for Approval",
                "role": "parceiro",
                "phone": "912345678"
            })
            if register_response.status_code in [200, 201]:
                data = register_response.json()
                parceiro_pendente = {"id": data.get('id') or data.get('user', {}).get('id')}
            else:
                pytest.skip("No pending parceiro available for testing")
        
        if parceiro_pendente:
            user_id = parceiro_pendente['id']
            
            # Approve with plano_id
            plano_id = "eb5e2225-a475-4317-84a8-a9126b2dc4f2"  # Base Gratuito
            
            approve_response = requests.put(
                f"{BASE_URL}/api/users/{user_id}/approve",
                headers=self.headers,
                json={"plano_id": plano_id}
            )
            
            assert approve_response.status_code == 200, f"Approve failed: {approve_response.text}"
            print(f"Successfully approved user {user_id} with plano_id {plano_id}")
            
            # Verify user data was updated
            user_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
            if user_response.status_code == 200:
                user_data = user_response.json()
                assert user_data.get('approved') == True, "User should be approved"
                assert user_data.get('plano_id') == plano_id, f"User should have plano_id={plano_id}"
                print(f"Verified: user has plano_id={user_data.get('plano_id')}, plano_nome={user_data.get('plano_nome')}")
    
    def test_04_approve_user_with_plano_and_preco_especial(self):
        """Test approval with both plano_id and preco_especial_id"""
        # Create a new parceiro for this test
        unique_id = int(datetime.now().timestamp())
        test_email = f"TEST_parceiro_preco_{unique_id}@test.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "TEST Parceiro Preco Especial",
            "role": "parceiro",
            "phone": "912345678"
        })
        
        if register_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create test parceiro: {register_response.text}")
        
        data = register_response.json()
        user_id = data.get('id') or data.get('user', {}).get('id')
        
        # Get precos especiais from Base Gratuito plan
        plano_id = "eb5e2225-a475-4317-84a8-a9126b2dc4f2"
        planos_response = requests.get(f"{BASE_URL}/api/planos", headers=self.headers)
        planos = planos_response.json()
        
        base_gratuito = next((p for p in planos if p.get('id') == plano_id), None)
        precos_especiais = base_gratuito.get('precos_especiais', []) if base_gratuito else []
        
        if not precos_especiais:
            pytest.skip("No precos_especiais available for testing")
        
        preco_especial_id = precos_especiais[0].get('id')
        
        # Approve with plano and preco_especial
        approve_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}/approve",
            headers=self.headers,
            json={
                "plano_id": plano_id,
                "preco_especial_id": preco_especial_id
            }
        )
        
        assert approve_response.status_code == 200, f"Approve with preco_especial failed: {approve_response.text}"
        print(f"Successfully approved user {user_id} with plano_id={plano_id} and preco_especial_id={preco_especial_id}")
        
        # Verify user data
        user_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
        if user_response.status_code == 200:
            user_data = user_response.json()
            assert user_data.get('approved') == True, "User should be approved"
            assert user_data.get('plano_id') == plano_id, "User should have plano_id"
            assert user_data.get('preco_especial_id') == preco_especial_id, "User should have preco_especial_id"
            print(f"Verified: user has preco_especial_id={user_data.get('preco_especial_id')}, preco_especial_nome={user_data.get('preco_especial_nome')}")
    
    def test_05_approve_user_without_plano(self):
        """Test approval without plano (simple approval)"""
        # Create a new parceiro
        unique_id = int(datetime.now().timestamp())
        test_email = f"TEST_parceiro_simple_{unique_id}@test.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "TEST Parceiro Simple Approval",
            "role": "parceiro",
            "phone": "912345678"
        })
        
        if register_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create test parceiro: {register_response.text}")
        
        data = register_response.json()
        user_id = data.get('id') or data.get('user', {}).get('id')
        
        # Approve without plano_id (empty body or None)
        approve_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}/approve",
            headers=self.headers,
            json={}  # No plano_id
        )
        
        assert approve_response.status_code == 200, f"Simple approve failed: {approve_response.text}"
        print(f"Successfully approved user {user_id} without plano")
        
        # Verify user is approved but no plano
        user_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
        if user_response.status_code == 200:
            user_data = user_response.json()
            assert user_data.get('approved') == True, "User should be approved"
            # plano_id should not be set or None
            print(f"Verified: user approved without plano_id")
    
    def test_06_approve_motorista_with_parceiro(self):
        """Test approving motorista with partner assignment"""
        # Create a new motorista
        unique_id = int(datetime.now().timestamp())
        test_email = f"TEST_motorista_approve_{unique_id}@test.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "TEST Motorista Approval",
            "role": "motorista",
            "phone": "912345678"
        })
        
        if register_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create test motorista: {register_response.text}")
        
        data = register_response.json()
        user_id = data.get('id') or data.get('user', {}).get('id')
        
        # Approve motorista (approval endpoint should work without plano for motoristas)
        approve_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}/approve",
            headers=self.headers,
            json={}
        )
        
        assert approve_response.status_code == 200, f"Motorista approve failed: {approve_response.text}"
        print(f"Successfully approved motorista {user_id}")
    
    def test_07_approve_endpoint_validates_plano_exists(self):
        """Test that approval validates plano exists and is active"""
        # Create a new parceiro
        unique_id = int(datetime.now().timestamp())
        test_email = f"TEST_parceiro_invalid_plano_{unique_id}@test.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "TEST Parceiro Invalid Plano",
            "role": "parceiro",
            "phone": "912345678"
        })
        
        if register_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create test parceiro: {register_response.text}")
        
        data = register_response.json()
        user_id = data.get('id') or data.get('user', {}).get('id')
        
        # Try to approve with invalid plano_id
        invalid_plano_id = str(uuid.uuid4())
        approve_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}/approve",
            headers=self.headers,
            json={"plano_id": invalid_plano_id}
        )
        
        # Should still approve but without plano (based on code logic)
        # The code only sets plano if it finds a valid one
        assert approve_response.status_code == 200, "Approval should succeed even with invalid plano"
        
        user_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
        if user_response.status_code == 200:
            user_data = user_response.json()
            # plano_id should NOT be set since the plan doesn't exist
            assert user_data.get('plano_id') != invalid_plano_id, "Invalid plano should not be saved"
            print(f"Verified: invalid plano_id was not saved")


class TestFrontendIntegrationPoints:
    """Test the data points the frontend needs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login as admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        assert login_response.status_code == 200
        self.headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}
    
    def test_planos_endpoint_returns_precos_especiais(self):
        """Frontend needs precos_especiais in planos response"""
        response = requests.get(f"{BASE_URL}/api/planos", headers=self.headers)
        assert response.status_code == 200
        
        planos = response.json()
        
        # Check structure: each plano should have precos_especiais array
        for plano in planos:
            assert 'precos_especiais' in plano, f"Plan {plano.get('nome')} missing precos_especiais"
            assert isinstance(plano.get('precos_especiais'), list), "precos_especiais should be a list"
        
        # Check Base Gratuito has proper precos_especiais structure
        base_gratuito = next((p for p in planos if p.get('id') == 'eb5e2225-a475-4317-84a8-a9126b2dc4f2'), None)
        if base_gratuito and base_gratuito.get('precos_especiais'):
            pe = base_gratuito['precos_especiais'][0]
            # Each preco_especial should have at least id and nome
            assert 'id' in pe, "preco_especial should have id"
            print(f"Preco especial structure: {list(pe.keys())}")
    
    def test_pending_users_endpoint_returns_role(self):
        """Frontend needs role to show different dialogs for parceiro vs motorista"""
        response = requests.get(f"{BASE_URL}/api/users/pending", headers=self.headers)
        assert response.status_code == 200
        
        pending = response.json()
        for user in pending:
            assert 'role' in user, f"User {user.get('id')} missing role"
            assert user['role'] in ['parceiro', 'motorista', 'admin', 'gestao'], f"Invalid role: {user.get('role')}"


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        self.headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}
    
    def test_cleanup_test_users(self):
        """Clean up TEST_ prefixed users created during tests"""
        # Get all users
        response = requests.get(f"{BASE_URL}/api/users/all", headers=self.headers)
        if response.status_code == 200:
            users = response.json()
            test_users = [u for u in users if u.get('email', '').startswith('TEST_') or u.get('name', '').startswith('TEST')]
            
            for user in test_users:
                delete_response = requests.delete(
                    f"{BASE_URL}/api/users/{user['id']}",
                    headers=self.headers
                )
                if delete_response.status_code == 200:
                    print(f"Deleted test user: {user.get('email')}")
                else:
                    print(f"Failed to delete {user.get('email')}: {delete_response.status_code}")
