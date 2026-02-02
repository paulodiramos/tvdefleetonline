"""
Test User Management Features - Iteration 15
Tests for /usuarios page admin features:
- Filters (role, parceiro, date)
- Block/Unblock users
- Revoke users
- Reset password
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fleet-track-19.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"


class TestUserManagementAPIs:
    """Test user management API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        self.token = data["access_token"]
        self.admin_id = data["user"]["id"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        print(f"✓ Admin logged in: {ADMIN_EMAIL}")
    
    # ==================== GET ALL USERS ====================
    def test_get_all_users(self):
        """Test GET /api/users/all - List all users"""
        response = self.session.get(f"{BASE_URL}/api/users/all")
        
        assert response.status_code == 200, f"Failed to get users: {response.text}"
        
        users = response.json()
        assert isinstance(users, list), "Response should be a list"
        assert len(users) > 0, "Should have at least one user"
        
        # Verify user structure
        user = users[0]
        assert "id" in user, "User should have id"
        assert "email" in user, "User should have email"
        assert "role" in user, "User should have role"
        
        print(f"✓ GET /api/users/all - Found {len(users)} users")
        
        # Count by role for filter testing
        roles = {}
        for u in users:
            role = u.get("role", "unknown")
            roles[role] = roles.get(role, 0) + 1
        print(f"  Users by role: {roles}")
        
        return users
    
    # ==================== GET PARCEIROS ====================
    def test_get_parceiros(self):
        """Test GET /api/parceiros - List all parceiros for filter dropdown"""
        response = self.session.get(f"{BASE_URL}/api/parceiros")
        
        assert response.status_code == 200, f"Failed to get parceiros: {response.text}"
        
        parceiros = response.json()
        assert isinstance(parceiros, list), "Response should be a list"
        
        print(f"✓ GET /api/parceiros - Found {len(parceiros)} parceiros")
        
        if len(parceiros) > 0:
            parceiro = parceiros[0]
            assert "id" in parceiro, "Parceiro should have id"
            print(f"  First parceiro: {parceiro.get('nome_empresa', parceiro.get('name', 'N/A'))}")
        
        return parceiros
    
    # ==================== BLOCK/UNBLOCK USER ====================
    def test_block_user(self):
        """Test PUT /api/users/{id}/status - Block a user"""
        # First get a user to block (not admin)
        users = self.test_get_all_users()
        
        # Find a non-admin user to test with
        test_user = None
        for u in users:
            if u.get("role") != "admin" and u.get("id") != self.admin_id:
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No non-admin user found to test blocking")
        
        user_id = test_user["id"]
        original_status = test_user.get("status", "active")
        
        # Block the user
        response = self.session.put(
            f"{BASE_URL}/api/users/{user_id}/status",
            json={"status": "blocked"}
        )
        
        assert response.status_code == 200, f"Failed to block user: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"✓ PUT /api/users/{user_id}/status (blocked) - {data.get('message')}")
        
        # Verify user is blocked
        users_after = self.session.get(f"{BASE_URL}/api/users/all").json()
        blocked_user = next((u for u in users_after if u["id"] == user_id), None)
        assert blocked_user is not None, "User should still exist"
        assert blocked_user.get("status") == "blocked", "User status should be 'blocked'"
        print(f"  Verified: User {user_id} is now blocked")
        
        return user_id
    
    def test_unblock_user(self):
        """Test PUT /api/users/{id}/status - Unblock a user"""
        # First block a user
        user_id = self.test_block_user()
        
        # Unblock the user
        response = self.session.put(
            f"{BASE_URL}/api/users/{user_id}/status",
            json={"status": "active"}
        )
        
        assert response.status_code == 200, f"Failed to unblock user: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"✓ PUT /api/users/{user_id}/status (active) - {data.get('message')}")
        
        # Verify user is unblocked
        users_after = self.session.get(f"{BASE_URL}/api/users/all").json()
        unblocked_user = next((u for u in users_after if u["id"] == user_id), None)
        assert unblocked_user is not None, "User should still exist"
        assert unblocked_user.get("status") in ["active", None], "User status should be 'active' or None"
        print(f"  Verified: User {user_id} is now active")
    
    def test_block_invalid_status(self):
        """Test PUT /api/users/{id}/status with invalid status"""
        users = self.session.get(f"{BASE_URL}/api/users/all").json()
        
        test_user = None
        for u in users:
            if u.get("role") != "admin":
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No non-admin user found")
        
        response = self.session.put(
            f"{BASE_URL}/api/users/{test_user['id']}/status",
            json={"status": "invalid_status"}
        )
        
        assert response.status_code == 400, f"Should return 400 for invalid status: {response.status_code}"
        print(f"✓ PUT /api/users/{test_user['id']}/status (invalid) - Correctly rejected")
    
    # ==================== REVOKE USER ====================
    def test_revoke_user(self):
        """Test PUT /api/users/{id}/revoke - Revoke a user"""
        users = self.session.get(f"{BASE_URL}/api/users/all").json()
        
        # Find a user that's not admin and not already revoked
        test_user = None
        for u in users:
            if u.get("role") != "admin" and u.get("status") != "revoked":
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No suitable user found to test revoke")
        
        user_id = test_user["id"]
        
        response = self.session.put(f"{BASE_URL}/api/users/{user_id}/revoke")
        
        assert response.status_code == 200, f"Failed to revoke user: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"✓ PUT /api/users/{user_id}/revoke - {data.get('message')}")
        
        # Verify user is revoked
        users_after = self.session.get(f"{BASE_URL}/api/users/all").json()
        revoked_user = next((u for u in users_after if u["id"] == user_id), None)
        assert revoked_user is not None, "User should still exist"
        assert revoked_user.get("status") == "revoked", "User status should be 'revoked'"
        print(f"  Verified: User {user_id} is now revoked")
    
    def test_revoke_nonexistent_user(self):
        """Test PUT /api/users/{id}/revoke with non-existent user"""
        response = self.session.put(f"{BASE_URL}/api/users/nonexistent-user-id/revoke")
        
        assert response.status_code == 404, f"Should return 404 for non-existent user: {response.status_code}"
        print(f"✓ PUT /api/users/nonexistent-user-id/revoke - Correctly returned 404")
    
    # ==================== RESET PASSWORD ====================
    def test_reset_password(self):
        """Test PUT /api/users/{id}/reset-password - Reset user password"""
        users = self.session.get(f"{BASE_URL}/api/users/all").json()
        
        # Find a non-admin user
        test_user = None
        for u in users:
            if u.get("role") != "admin":
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No non-admin user found")
        
        user_id = test_user["id"]
        new_password = "TestPassword123"
        
        response = self.session.put(
            f"{BASE_URL}/api/users/{user_id}/reset-password",
            json={"new_password": new_password}
        )
        
        assert response.status_code == 200, f"Failed to reset password: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"✓ PUT /api/users/{user_id}/reset-password - {data.get('message')}")
        
        # Restore original password (123456)
        restore_response = self.session.put(
            f"{BASE_URL}/api/users/{user_id}/reset-password",
            json={"new_password": "123456"}
        )
        assert restore_response.status_code == 200, "Failed to restore password"
        print(f"  Password restored to original")
    
    def test_reset_password_too_short(self):
        """Test PUT /api/users/{id}/reset-password with short password"""
        users = self.session.get(f"{BASE_URL}/api/users/all").json()
        
        test_user = None
        for u in users:
            if u.get("role") != "admin":
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No non-admin user found")
        
        response = self.session.put(
            f"{BASE_URL}/api/users/{test_user['id']}/reset-password",
            json={"new_password": "123"}  # Too short
        )
        
        assert response.status_code == 400, f"Should return 400 for short password: {response.status_code}"
        print(f"✓ PUT /api/users/{test_user['id']}/reset-password (short) - Correctly rejected")
    
    # ==================== SET ROLE ====================
    def test_set_user_role(self):
        """Test PUT /api/users/{id}/set-role - Change user role"""
        users = self.session.get(f"{BASE_URL}/api/users/all").json()
        
        # Find a motorista to change role
        test_user = None
        for u in users:
            if u.get("role") == "motorista":
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No motorista found to test role change")
        
        user_id = test_user["id"]
        original_role = test_user["role"]
        
        # Change to parceiro
        response = self.session.put(
            f"{BASE_URL}/api/users/{user_id}/set-role",
            json={"role": "parceiro"}
        )
        
        assert response.status_code == 200, f"Failed to change role: {response.text}"
        print(f"✓ PUT /api/users/{user_id}/set-role (parceiro) - Success")
        
        # Restore original role
        restore_response = self.session.put(
            f"{BASE_URL}/api/users/{user_id}/set-role",
            json={"role": original_role}
        )
        assert restore_response.status_code == 200, "Failed to restore role"
        print(f"  Role restored to {original_role}")
    
    def test_set_invalid_role(self):
        """Test PUT /api/users/{id}/set-role with invalid role"""
        users = self.session.get(f"{BASE_URL}/api/users/all").json()
        
        test_user = None
        for u in users:
            if u.get("role") != "admin":
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No non-admin user found")
        
        response = self.session.put(
            f"{BASE_URL}/api/users/{test_user['id']}/set-role",
            json={"role": "invalid_role"}
        )
        
        assert response.status_code == 400, f"Should return 400 for invalid role: {response.status_code}"
        print(f"✓ PUT /api/users/{test_user['id']}/set-role (invalid) - Correctly rejected")
    
    # ==================== PENDING USERS ====================
    def test_get_pending_users(self):
        """Test GET /api/users/pending - List pending users"""
        response = self.session.get(f"{BASE_URL}/api/users/pending")
        
        assert response.status_code == 200, f"Failed to get pending users: {response.text}"
        
        users = response.json()
        assert isinstance(users, list), "Response should be a list"
        
        print(f"✓ GET /api/users/pending - Found {len(users)} pending users")
        
        # All returned users should have approved=False
        for u in users:
            assert u.get("approved") == False, f"User {u.get('id')} should be pending"
    
    # ==================== AUTHORIZATION TESTS ====================
    def test_non_admin_cannot_block(self):
        """Test that non-admin users cannot block users"""
        # Login as gestor
        gestor_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "gestor@tvdefleet.com",
            "password": "123456"
        })
        
        if gestor_response.status_code != 200:
            pytest.skip("Gestor login failed")
        
        gestor_token = gestor_response.json()["access_token"]
        
        # Try to block a user
        users = self.session.get(f"{BASE_URL}/api/users/all").json()
        test_user = next((u for u in users if u.get("role") == "motorista"), None)
        
        if not test_user:
            pytest.skip("No motorista found")
        
        response = requests.put(
            f"{BASE_URL}/api/users/{test_user['id']}/status",
            json={"status": "blocked"},
            headers={"Authorization": f"Bearer {gestor_token}", "Content-Type": "application/json"}
        )
        
        assert response.status_code == 403, f"Non-admin should get 403: {response.status_code}"
        print(f"✓ Non-admin cannot block users - Correctly returned 403")


class TestUserFiltering:
    """Test user filtering functionality (frontend logic verification)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        self.token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_users_have_role_field(self):
        """Verify users have role field for filtering"""
        response = self.session.get(f"{BASE_URL}/api/users/all")
        users = response.json()
        
        roles_found = set()
        for u in users:
            assert "role" in u, f"User {u.get('id')} missing role field"
            roles_found.add(u["role"])
        
        print(f"✓ All users have role field. Roles found: {roles_found}")
        
        # Verify expected roles exist
        expected_roles = {"admin", "gestao", "parceiro", "motorista"}
        assert roles_found.intersection(expected_roles), "Should have at least one expected role"
    
    def test_users_have_created_at_field(self):
        """Verify users have created_at field for date filtering"""
        response = self.session.get(f"{BASE_URL}/api/users/all")
        users = response.json()
        
        for u in users:
            assert "created_at" in u, f"User {u.get('id')} missing created_at field"
            # Verify it's a valid date
            try:
                datetime.fromisoformat(u["created_at"].replace("Z", "+00:00"))
            except:
                pytest.fail(f"Invalid date format for user {u.get('id')}: {u['created_at']}")
        
        print(f"✓ All users have valid created_at field for date filtering")
    
    def test_motoristas_have_parceiro_id(self):
        """Verify motoristas have parceiro_id for parceiro filtering"""
        response = self.session.get(f"{BASE_URL}/api/users/all")
        users = response.json()
        
        motoristas = [u for u in users if u.get("role") == "motorista"]
        
        if not motoristas:
            pytest.skip("No motoristas found")
        
        motoristas_with_parceiro = [m for m in motoristas if m.get("parceiro_id")]
        print(f"✓ {len(motoristas_with_parceiro)}/{len(motoristas)} motoristas have parceiro_id")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
