"""
Test User Management Features - Iteration 28
Tests for user creation, listing, filtering, and login flows
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"
PARCEIRO_EMAIL = "parceiro.criado.ui@example.com"
PARCEIRO_PASSWORD = "parceiro123"


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")
    
    def test_parceiro_login_success(self):
        """Test parceiro login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "parceiro"
        print(f"✓ Parceiro login successful: {data['user']['name']}")


class TestUserManagementEndpoints:
    """Test user management endpoints"""
    
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
    
    def test_get_all_users(self, admin_token):
        """Test GET /api/users/all endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/users/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one user"
        
        # Verify user structure
        user = data[0]
        assert "id" in user
        assert "email" in user
        assert "name" in user
        assert "role" in user
        
        # Count users by role
        roles = {}
        for u in data:
            role = u.get("role", "unknown")
            roles[role] = roles.get(role, 0) + 1
        
        print(f"✓ GET /api/users/all returned {len(data)} users")
        print(f"  Roles breakdown: {roles}")
    
    def test_get_all_users_unauthorized(self):
        """Test GET /api/users/all without auth"""
        response = requests.get(f"{BASE_URL}/api/users/all")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthorized access correctly rejected")
    
    def test_get_pending_users(self, admin_token):
        """Test GET /api/users/pending endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/users/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/users/pending returned {len(data)} pending users")


class TestUserCreation:
    """Test user creation via API"""
    
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
    
    def test_create_parceiro_user(self, admin_token):
        """Test creating a new parceiro user"""
        timestamp = int(time.time())
        test_email = f"test.parceiro.{timestamp}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": f"Test Parceiro {timestamp}",
                "email": test_email,
                "password": "testpass123",
                "role": "parceiro",
                "approved": True
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == test_email
        assert data["role"] == "parceiro"
        assert data["approved"] == True
        
        print(f"✓ Created parceiro user: {test_email}")
        
        # Verify user can login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "testpass123"
        })
        
        assert login_response.status_code == 200, f"New user login failed: {login_response.text}"
        print(f"✓ New parceiro can login successfully")
    
    def test_create_gestor_user(self, admin_token):
        """Test creating a new gestor user with associated parceiros"""
        timestamp = int(time.time())
        test_email = f"test.gestor.{timestamp}@example.com"
        
        # First get list of parceiros to associate
        parceiros_response = requests.get(
            f"{BASE_URL}/api/parceiros",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        parceiro_ids = []
        if parceiros_response.status_code == 200:
            parceiros = parceiros_response.json()
            if parceiros:
                parceiro_ids = [p["id"] for p in parceiros[:2]]  # Get first 2 parceiros
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": f"Test Gestor {timestamp}",
                "email": test_email,
                "password": "testpass123",
                "role": "gestao",
                "approved": True,
                "parceiros_associados": parceiro_ids
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == test_email
        assert data["role"] == "gestao"
        
        print(f"✓ Created gestor user: {test_email}")
        print(f"  Associated with {len(parceiro_ids)} parceiros")
    
    def test_create_motorista_user(self, admin_token):
        """Test creating a new motorista user"""
        timestamp = int(time.time())
        test_email = f"test.motorista.{timestamp}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": f"Test Motorista {timestamp}",
                "email": test_email,
                "password": "testpass123",
                "role": "motorista",
                "approved": True
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == test_email
        assert data["role"] == "motorista"
        
        print(f"✓ Created motorista user: {test_email}")
    
    def test_create_duplicate_email_fails(self, admin_token):
        """Test that creating user with duplicate email fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": "Duplicate User",
                "email": ADMIN_EMAIL,  # Already exists
                "password": "testpass123",
                "role": "parceiro",
                "approved": True
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Duplicate email correctly rejected")


class TestUserModules:
    """Test user modules/planos endpoints"""
    
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
    
    def test_get_user_modulos(self, admin_token):
        """Test GET /api/users/{id}/modulos endpoint"""
        # First get a user ID
        users_response = requests.get(
            f"{BASE_URL}/api/users/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if users_response.status_code != 200 or not users_response.json():
            pytest.skip("No users available")
        
        user_id = users_response.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/modulos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/users/{user_id}/modulos successful")
    
    def test_get_planos(self, admin_token):
        """Test GET /api/planos endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/planos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/planos returned {len(data)} planos")


class TestParceirosEndpoint:
    """Test parceiros endpoint"""
    
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
    
    def test_get_parceiros(self, admin_token):
        """Test GET /api/parceiros endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/parceiros",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/parceiros returned {len(data)} parceiros")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
