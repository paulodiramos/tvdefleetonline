"""
Test Suite for Permissions System (Permissões de Funcionalidades)
Tests:
- GET /api/permissoes/minhas - Get current user's permissions
- PUT /api/permissoes/parceiro/{id} - Update partner permissions (admin only)
- GET /api/rpa-auto/plataformas - Get RPA platforms filtered by permissions
- Authentication: Login/logout for admin and parceiro
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "zeny123"
PARCEIRO_ID = "c693c9ec-ddd5-400c-b79d-61b651e7b3fd"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✅ Admin login successful: {data['user']['name']}")
    
    def test_parceiro_login_success(self):
        """Test parceiro login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == PARCEIRO_EMAIL
        assert data["user"]["role"] == "parceiro"
        print(f"✅ Parceiro login successful: {data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid credentials correctly rejected")


class TestPermissoesFuncionalidades:
    """Test permissions endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Parceiro login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_admin_get_minhas_permissoes(self, admin_token):
        """Test GET /api/permissoes/minhas for admin - should return all permissions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/permissoes/minhas", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Admin should have is_admin=True and all funcionalidades
        assert data.get("is_admin") == True, "Admin should have is_admin=True"
        assert "funcionalidades" in data, "Missing funcionalidades in response"
        assert isinstance(data["funcionalidades"], list), "funcionalidades should be a list"
        
        # Admin should have all available funcionalidades
        expected_funcs = ["whatsapp", "email", "vistorias", "contratos", "rpa_automacao", 
                         "importacao_csv", "agenda_veiculos", "alertas", "anuncios_venda",
                         "relatorios", "financeiro", "motoristas", "veiculos", "documentos", "terabox"]
        
        for func in expected_funcs:
            assert func in data["funcionalidades"], f"Admin missing funcionalidade: {func}"
        
        print(f"✅ Admin has {len(data['funcionalidades'])} funcionalidades (all)")
    
    def test_parceiro_get_minhas_permissoes(self, parceiro_token):
        """Test GET /api/permissoes/minhas for parceiro"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(f"{BASE_URL}/api/permissoes/minhas", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Parceiro should have is_admin=False
        assert data.get("is_admin") == False, "Parceiro should have is_admin=False"
        assert "funcionalidades" in data, "Missing funcionalidades in response"
        assert isinstance(data["funcionalidades"], list), "funcionalidades should be a list"
        
        print(f"✅ Parceiro has {len(data['funcionalidades'])} funcionalidades: {data['funcionalidades']}")
    
    def test_admin_update_parceiro_permissoes(self, admin_token):
        """Test PUT /api/permissoes/parceiro/{id} - admin can update permissions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Set limited permissions for parceiro
        limited_permissions = ["whatsapp", "vistorias", "motoristas", "veiculos"]
        
        response = requests.put(
            f"{BASE_URL}/api/permissoes/parceiro/{PARCEIRO_ID}",
            headers=headers,
            json={"funcionalidades": limited_permissions}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Expected success=True"
        print(f"✅ Admin updated parceiro permissions to {len(limited_permissions)} funcionalidades")
        
        # Verify the update by getting parceiro permissions
        response = requests.get(
            f"{BASE_URL}/api/permissoes/parceiro/{PARCEIRO_ID}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get permissions: {response.text}"
        data = response.json()
        
        assert set(data.get("funcionalidades", [])) == set(limited_permissions), \
            f"Permissions not updated correctly. Expected {limited_permissions}, got {data.get('funcionalidades')}"
        
        print(f"✅ Verified parceiro permissions: {data.get('funcionalidades')}")
    
    def test_parceiro_cannot_update_permissions(self, parceiro_token):
        """Test that parceiro cannot update permissions (403)"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        response = requests.put(
            f"{BASE_URL}/api/permissoes/parceiro/{PARCEIRO_ID}",
            headers=headers,
            json={"funcionalidades": ["whatsapp"]}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✅ Parceiro correctly denied from updating permissions")
    
    def test_get_all_funcionalidades(self, admin_token):
        """Test GET /api/permissoes/funcionalidades - list all available funcionalidades"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/permissoes/funcionalidades", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "funcionalidades" in data, "Missing funcionalidades in response"
        assert "categorias" in data, "Missing categorias in response"
        
        # Verify funcionalidades structure
        funcs = data["funcionalidades"]
        assert len(funcs) > 0, "Should have at least one funcionalidade"
        
        # Check first funcionalidade has required fields
        first_func = funcs[0]
        assert "id" in first_func, "Funcionalidade missing id"
        assert "nome" in first_func, "Funcionalidade missing nome"
        assert "descricao" in first_func, "Funcionalidade missing descricao"
        
        print(f"✅ Found {len(funcs)} funcionalidades available")
    
    def test_admin_list_all_parceiros_permissoes(self, admin_token):
        """Test GET /api/permissoes/admin/todos-parceiros - admin can list all"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/permissoes/admin/todos-parceiros", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            # Check structure of first item
            first = data[0]
            assert "parceiro_id" in first, "Missing parceiro_id"
            assert "nome" in first, "Missing nome"
            assert "funcionalidades" in first, "Missing funcionalidades"
        
        print(f"✅ Admin can list {len(data)} parceiros with their permissions")


class TestRPAPlataformasPermissoes:
    """Test RPA platforms filtered by permissions"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Parceiro login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_admin_get_all_plataformas(self, admin_token):
        """Test GET /api/rpa-auto/plataformas - admin sees all platforms"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/rpa-auto/plataformas", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        # Admin should see predefined platforms
        platform_ids = [p["id"] for p in data]
        expected_platforms = ["uber", "bolt", "viaverde", "prio"]
        
        for platform in expected_platforms:
            assert platform in platform_ids, f"Admin missing platform: {platform}"
        
        print(f"✅ Admin sees {len(data)} RPA platforms: {platform_ids}")
    
    def test_parceiro_get_filtered_plataformas(self, parceiro_token, admin_token):
        """Test GET /api/rpa-auto/plataformas - parceiro sees only permitted platforms"""
        # First, set specific platform permissions for parceiro
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Set only uber and bolt as permitted
        permitted_platforms = ["uber", "bolt"]
        response = requests.put(
            f"{BASE_URL}/api/rpa-auto/parceiro-plataformas/{PARCEIRO_ID}",
            headers=admin_headers,
            json=permitted_platforms
        )
        
        assert response.status_code == 200, f"Failed to set platform permissions: {response.text}"
        
        # Now test parceiro access
        parceiro_headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(f"{BASE_URL}/api/rpa-auto/plataformas", headers=parceiro_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        platform_ids = [p["id"] for p in data]
        
        # Parceiro should only see permitted platforms
        for platform_id in platform_ids:
            assert platform_id in permitted_platforms, \
                f"Parceiro sees unauthorized platform: {platform_id}"
        
        print(f"✅ Parceiro sees only {len(data)} permitted platforms: {platform_ids}")
    
    def test_admin_update_parceiro_plataformas(self, admin_token):
        """Test PUT /api/rpa-auto/parceiro-plataformas/{id} - admin can update"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Set all platforms as permitted
        all_platforms = ["uber", "bolt", "viaverde", "prio"]
        
        response = requests.put(
            f"{BASE_URL}/api/rpa-auto/parceiro-plataformas/{PARCEIRO_ID}",
            headers=headers,
            json=all_platforms
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Expected success=True"
        print(f"✅ Admin updated parceiro platform permissions to {len(all_platforms)} platforms")
        
        # Verify the update
        response = requests.get(
            f"{BASE_URL}/api/rpa-auto/parceiro-plataformas/{PARCEIRO_ID}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get permissions: {response.text}"
        data = response.json()
        
        assert set(data.get("plataformas_permitidas", [])) == set(all_platforms), \
            f"Platform permissions not updated correctly"
        
        print(f"✅ Verified parceiro platform permissions: {data.get('plataformas_permitidas')}")


class TestPermissoesIntegration:
    """Integration tests for permissions affecting menu filtering"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Parceiro login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_permissions_flow_complete(self, admin_token, parceiro_token):
        """Test complete flow: admin sets permissions, parceiro sees filtered menu"""
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        parceiro_headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        # Step 1: Admin sets limited permissions
        limited_funcs = ["whatsapp", "motoristas", "veiculos"]
        response = requests.put(
            f"{BASE_URL}/api/permissoes/parceiro/{PARCEIRO_ID}",
            headers=admin_headers,
            json={"funcionalidades": limited_funcs}
        )
        assert response.status_code == 200, f"Failed to set permissions: {response.text}"
        print(f"✅ Step 1: Admin set limited permissions: {limited_funcs}")
        
        # Step 2: Parceiro gets their permissions
        response = requests.get(f"{BASE_URL}/api/permissoes/minhas", headers=parceiro_headers)
        assert response.status_code == 200, f"Failed to get permissions: {response.text}"
        data = response.json()
        
        # Verify parceiro sees only limited permissions
        assert set(data.get("funcionalidades", [])) == set(limited_funcs), \
            f"Parceiro should see limited permissions. Got: {data.get('funcionalidades')}"
        print(f"✅ Step 2: Parceiro sees limited permissions: {data.get('funcionalidades')}")
        
        # Step 3: Admin restores all permissions
        all_funcs = ["whatsapp", "email", "vistorias", "contratos", "rpa_automacao", 
                     "importacao_csv", "agenda_veiculos", "alertas", "anuncios_venda",
                     "relatorios", "financeiro", "motoristas", "veiculos", "documentos", "terabox"]
        
        response = requests.put(
            f"{BASE_URL}/api/permissoes/parceiro/{PARCEIRO_ID}",
            headers=admin_headers,
            json={"funcionalidades": all_funcs}
        )
        assert response.status_code == 200, f"Failed to restore permissions: {response.text}"
        print(f"✅ Step 3: Admin restored all permissions")
        
        # Step 4: Verify parceiro now sees all permissions
        response = requests.get(f"{BASE_URL}/api/permissoes/minhas", headers=parceiro_headers)
        assert response.status_code == 200, f"Failed to get permissions: {response.text}"
        data = response.json()
        
        assert len(data.get("funcionalidades", [])) == len(all_funcs), \
            f"Parceiro should see all permissions. Got {len(data.get('funcionalidades', []))} instead of {len(all_funcs)}"
        print(f"✅ Step 4: Parceiro now sees all {len(data.get('funcionalidades', []))} permissions")
    
    def test_invalid_funcionalidade_rejected(self, admin_token):
        """Test that invalid funcionalidade IDs are rejected"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Try to set invalid funcionalidade
        response = requests.put(
            f"{BASE_URL}/api/permissoes/parceiro/{PARCEIRO_ID}",
            headers=headers,
            json={"funcionalidades": ["invalid_func", "whatsapp"]}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid funcionalidade, got {response.status_code}"
        print("✅ Invalid funcionalidade correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
