"""
Test Suite for Contabilista System - TVDEFleet
==============================================
Tests for:
- POST /api/contabilistas/criar - parceiro/admin creates contabilista
- GET /api/contabilistas/lista - list contabilistas
- PUT /api/contabilistas/{id}/atribuir-parceiros - admin assigns parceiros
- POST /api/contabilistas/{id}/selecionar-parceiro - contabilista selects active parceiro
- GET /api/contabilidade/* - verify contabilista sees filtered data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "Admin123!"
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "Admin123!"
TEST_CONTABILISTA_EMAIL = "maria.contabilista@test.com"
TEST_CONTABILISTA_PASSWORD = "Test123!"


class TestContabilistasSystem:
    """Tests for Contabilistas CRUD and permissions"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed - cannot proceed")
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro (Zeny) auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Parceiro login failed - cannot proceed")
    
    @pytest.fixture(scope="class")
    def parceiro_user(self, parceiro_token):
        """Get parceiro user data"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {parceiro_token}"
        })
        if response.status_code == 200:
            return response.json()
        pytest.skip("Could not get parceiro user data")
    
    # ===================
    # Test Login Flows
    # ===================
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("role") == "admin"
        print(f"SUCCESS: Admin login - role={data.get('user', {}).get('role')}")
    
    def test_parceiro_login(self):
        """Test parceiro (Zeny) can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("role") == "parceiro"
        print(f"SUCCESS: Parceiro login - name={data.get('user', {}).get('name')}")
    
    # ============================
    # Test Contabilista CRUD
    # ============================
    
    def test_parceiro_create_contabilista(self, parceiro_token, parceiro_user):
        """Test parceiro can create a contabilista"""
        import uuid
        unique_email = f"TEST_contab_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(
            f"{BASE_URL}/api/contabilistas/criar",
            json={
                "name": "TEST Contabilista Created by Parceiro",
                "email": unique_email,
                "phone": "+351912345678",
                "password": "Test123!"
            },
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200, f"Create contabilista failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "contabilista" in data
        contabilista = data["contabilista"]
        
        # Verify contabilista is associated with parceiro
        assert parceiro_user.get("id") in contabilista.get("parceiros_associados", []), \
            "Contabilista should be associated with creating parceiro"
        assert contabilista.get("parceiro_ativo_id") == parceiro_user.get("id"), \
            "Contabilista parceiro_ativo should be set to creating parceiro"
        
        print(f"SUCCESS: Parceiro created contabilista - id={contabilista.get('id')}, parceiros_associados={contabilista.get('parceiros_associados')}")
        
        # Store for cleanup
        self.__class__.created_contabilista_id = contabilista.get("id")
        return contabilista
    
    def test_parceiro_list_contabilistas(self, parceiro_token):
        """Test parceiro can list their contabilistas"""
        response = requests.get(
            f"{BASE_URL}/api/contabilistas/lista",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200, f"List contabilistas failed: {response.text}"
        data = response.json()
        assert "contabilistas" in data
        assert "total" in data
        
        # Should see at least the one we just created (or existing ones)
        print(f"SUCCESS: Parceiro listed contabilistas - total={data.get('total')}")
        return data
    
    def test_admin_list_all_contabilistas(self, admin_token):
        """Test admin can list all contabilistas"""
        response = requests.get(
            f"{BASE_URL}/api/contabilistas/lista",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Admin list contabilistas failed: {response.text}"
        data = response.json()
        assert "contabilistas" in data
        print(f"SUCCESS: Admin listed all contabilistas - total={data.get('total')}")
        return data
    
    # ===============================
    # Test Admin Assign Parceiros
    # ===============================
    
    def test_admin_get_parceiros_list(self, admin_token):
        """Test admin can get list of parceiros"""
        response = requests.get(
            f"{BASE_URL}/api/parceiros",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Get parceiros failed: {response.text}"
        parceiros = response.json()
        assert isinstance(parceiros, list), "Should return list of parceiros"
        print(f"SUCCESS: Admin got parceiros list - count={len(parceiros)}")
        
        if parceiros:
            self.__class__.parceiro_ids = [p.get("id") for p in parceiros[:2]]
        return parceiros
    
    def test_admin_assign_parceiros_to_contabilista(self, admin_token):
        """Test admin can assign parceiros to a contabilista"""
        # First get a contabilista to assign parceiros
        list_response = requests.get(
            f"{BASE_URL}/api/contabilistas/lista",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if list_response.status_code != 200:
            pytest.skip("Could not get contabilistas list")
        
        contabilistas = list_response.json().get("contabilistas", [])
        if not contabilistas:
            pytest.skip("No contabilistas available for assignment test")
        
        contabilista_id = contabilistas[0].get("id")
        
        # Get parceiros to assign
        parceiros_response = requests.get(
            f"{BASE_URL}/api/parceiros",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if parceiros_response.status_code != 200:
            pytest.skip("Could not get parceiros list")
        
        parceiros = parceiros_response.json()
        if not parceiros:
            pytest.skip("No parceiros available for assignment")
        
        parceiro_ids = [p.get("id") for p in parceiros[:2] if p.get("id")]
        
        # Assign parceiros
        response = requests.put(
            f"{BASE_URL}/api/contabilistas/{contabilista_id}/atribuir-parceiros",
            json={"parceiros_ids": parceiro_ids},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Assign parceiros failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("parceiros_atribuidos") == parceiro_ids
        
        print(f"SUCCESS: Admin assigned {len(parceiro_ids)} parceiros to contabilista {contabilista_id}")
        return data
    
    def test_non_admin_cannot_assign_parceiros(self, parceiro_token):
        """Test that non-admin cannot assign parceiros"""
        # Try to assign parceiros as parceiro (should fail)
        response = requests.put(
            f"{BASE_URL}/api/contabilistas/some-id/atribuir-parceiros",
            json={"parceiros_ids": []},
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        # Should get 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Non-admin correctly blocked from assigning parceiros")
    
    # =====================================
    # Test Contabilista Select Parceiro
    # =====================================
    
    def test_contabilista_login_and_select_parceiro(self):
        """Test contabilista can login and select active parceiro"""
        # First try to login with test contabilista
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CONTABILISTA_EMAIL,
            "password": TEST_CONTABILISTA_PASSWORD
        })
        
        if login_response.status_code != 200:
            # Try with alternate credentials or skip
            print(f"INFO: Test contabilista login returned {login_response.status_code} - may not exist yet")
            pytest.skip("Test contabilista does not exist yet")
        
        data = login_response.json()
        assert data.get("user", {}).get("role") == "contabilista"
        token = data.get("access_token")
        user_id = data.get("user", {}).get("id")
        
        print(f"SUCCESS: Contabilista logged in - id={user_id}")
        
        # Get contabilista's parceiros
        parceiros_response = requests.get(
            f"{BASE_URL}/api/contabilistas/{user_id}/parceiros",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if parceiros_response.status_code == 200:
            parceiros = parceiros_response.json().get("parceiros", [])
            print(f"INFO: Contabilista has {len(parceiros)} parceiros associados")
            
            if parceiros:
                # Test selecting a parceiro
                parceiro_to_select = parceiros[0]
                select_response = requests.post(
                    f"{BASE_URL}/api/contabilistas/{user_id}/selecionar-parceiro",
                    json={"parceiro_id": parceiro_to_select.get("id")},
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                assert select_response.status_code == 200, f"Select parceiro failed: {select_response.text}"
                select_data = select_response.json()
                assert select_data.get("parceiro_ativo_id") == parceiro_to_select.get("id")
                print(f"SUCCESS: Contabilista selected parceiro - {parceiro_to_select.get('nome_empresa')}")
    
    # =====================================
    # Test Contabilidade Access
    # =====================================
    
    def test_contabilista_access_faturas_fornecedores(self):
        """Test contabilista can access faturas fornecedores endpoint"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CONTABILISTA_EMAIL,
            "password": TEST_CONTABILISTA_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Test contabilista does not exist")
        
        token = login_response.json().get("access_token")
        
        response = requests.get(
            f"{BASE_URL}/api/contabilidade/faturas-fornecedores",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Faturas fornecedores access failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list of faturas"
        print(f"SUCCESS: Contabilista accessed faturas fornecedores - count={len(data)}")
    
    def test_contabilista_access_recibos_motoristas(self):
        """Test contabilista can access recibos motoristas endpoint"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CONTABILISTA_EMAIL,
            "password": TEST_CONTABILISTA_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Test contabilista does not exist")
        
        token = login_response.json().get("access_token")
        
        response = requests.get(
            f"{BASE_URL}/api/contabilidade/recibos-motoristas",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Recibos motoristas access failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list of recibos"
        print(f"SUCCESS: Contabilista accessed recibos motoristas - count={len(data)}")
    
    def test_contabilista_access_resumo(self):
        """Test contabilista can access contabilidade resumo"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CONTABILISTA_EMAIL,
            "password": TEST_CONTABILISTA_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Test contabilista does not exist")
        
        token = login_response.json().get("access_token")
        
        response = requests.get(
            f"{BASE_URL}/api/contabilidade/resumo",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Resumo access failed: {response.text}"
        data = response.json()
        assert "total_faturas" in data
        assert "total_recibos" in data
        print(f"SUCCESS: Contabilista accessed resumo - faturas={data.get('total_faturas')}, recibos={data.get('total_recibos')}")
    
    # =====================================
    # Test Edit and Delete
    # =====================================
    
    def test_parceiro_edit_contabilista(self, parceiro_token):
        """Test parceiro can edit a contabilista they created"""
        # Get list to find a contabilista
        list_response = requests.get(
            f"{BASE_URL}/api/contabilistas/lista",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        if list_response.status_code != 200:
            pytest.skip("Could not get contabilistas list")
        
        contabilistas = list_response.json().get("contabilistas", [])
        # Find a TEST_ contabilista
        test_contabilistas = [c for c in contabilistas if c.get("name", "").startswith("TEST")]
        
        if not test_contabilistas:
            pytest.skip("No TEST contabilista to edit")
        
        contabilista = test_contabilistas[0]
        
        # Edit the contabilista
        response = requests.put(
            f"{BASE_URL}/api/contabilistas/{contabilista['id']}/editar",
            json={
                "name": "TEST Contabilista Edited",
                "phone": "+351987654321"
            },
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200, f"Edit contabilista failed: {response.text}"
        print(f"SUCCESS: Parceiro edited contabilista {contabilista['id']}")
    
    def test_cleanup_test_contabilistas(self, parceiro_token):
        """Cleanup - delete TEST contabilistas"""
        list_response = requests.get(
            f"{BASE_URL}/api/contabilistas/lista",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        if list_response.status_code != 200:
            return
        
        contabilistas = list_response.json().get("contabilistas", [])
        test_contabilistas = [c for c in contabilistas if c.get("name", "").startswith("TEST") or c.get("email", "").startswith("TEST")]
        
        deleted_count = 0
        for contabilista in test_contabilistas:
            response = requests.delete(
                f"{BASE_URL}/api/contabilistas/{contabilista['id']}",
                headers={"Authorization": f"Bearer {parceiro_token}"}
            )
            if response.status_code == 200:
                deleted_count += 1
        
        print(f"CLEANUP: Deleted {deleted_count} TEST contabilistas")


class TestContabilidadeEndpoints:
    """Tests for /api/contabilidade/* endpoints with role filtering"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Parceiro login failed")
    
    def test_admin_faturas_fornecedores(self, admin_token):
        """Test admin can access faturas fornecedores"""
        response = requests.get(
            f"{BASE_URL}/api/contabilidade/faturas-fornecedores",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        print(f"SUCCESS: Admin accessed faturas-fornecedores")
    
    def test_admin_recibos_motoristas(self, admin_token):
        """Test admin can access recibos motoristas"""
        response = requests.get(
            f"{BASE_URL}/api/contabilidade/recibos-motoristas",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        print(f"SUCCESS: Admin accessed recibos-motoristas")
    
    def test_admin_faturas_veiculos(self, admin_token):
        """Test admin can access faturas veiculos"""
        response = requests.get(
            f"{BASE_URL}/api/contabilidade/faturas-veiculos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        print(f"SUCCESS: Admin accessed faturas-veiculos")
    
    def test_parceiro_faturas_fornecedores(self, parceiro_token):
        """Test parceiro can access their own faturas fornecedores"""
        response = requests.get(
            f"{BASE_URL}/api/contabilidade/faturas-fornecedores",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        print(f"SUCCESS: Parceiro accessed faturas-fornecedores")
    
    def test_parceiro_resumo(self, parceiro_token):
        """Test parceiro can access contabilidade resumo"""
        response = requests.get(
            f"{BASE_URL}/api/contabilidade/resumo",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_faturas" in data
        assert "total_recibos" in data
        print(f"SUCCESS: Parceiro accessed resumo")


class TestGestorParceiroSelectorForContabilista:
    """Tests for GestorParceiroSelector component endpoint support"""
    
    def test_contabilista_get_parceiros_endpoint(self):
        """Test /api/contabilistas/{id}/parceiros endpoint exists"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CONTABILISTA_EMAIL,
            "password": TEST_CONTABILISTA_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Test contabilista not available")
        
        token = login_response.json().get("access_token")
        user_id = login_response.json().get("user", {}).get("id")
        
        response = requests.get(
            f"{BASE_URL}/api/contabilistas/{user_id}/parceiros",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Get parceiros failed: {response.text}"
        data = response.json()
        assert "parceiros" in data
        assert "total" in data
        print(f"SUCCESS: Contabilista parceiros endpoint works - total={data.get('total')}")
    
    def test_contabilista_get_parceiro_ativo_endpoint(self):
        """Test /api/contabilistas/{id}/parceiro-ativo endpoint exists"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CONTABILISTA_EMAIL,
            "password": TEST_CONTABILISTA_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Test contabilista not available")
        
        token = login_response.json().get("access_token")
        user_id = login_response.json().get("user", {}).get("id")
        
        response = requests.get(
            f"{BASE_URL}/api/contabilistas/{user_id}/parceiro-ativo",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Get parceiro ativo failed: {response.text}"
        data = response.json()
        # May or may not have parceiro_ativo_id
        assert "parceiro_ativo_id" in data
        print(f"SUCCESS: Contabilista parceiro-ativo endpoint works")
    
    def test_contabilista_selecionar_parceiro_endpoint(self):
        """Test /api/contabilistas/{id}/selecionar-parceiro endpoint exists"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CONTABILISTA_EMAIL,
            "password": TEST_CONTABILISTA_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Test contabilista not available")
        
        token = login_response.json().get("access_token")
        user_id = login_response.json().get("user", {}).get("id")
        
        # Get parceiros first
        parceiros_response = requests.get(
            f"{BASE_URL}/api/contabilistas/{user_id}/parceiros",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if parceiros_response.status_code != 200:
            pytest.skip("Could not get parceiros")
        
        parceiros = parceiros_response.json().get("parceiros", [])
        
        if not parceiros:
            # Test clearing selection
            response = requests.post(
                f"{BASE_URL}/api/contabilistas/{user_id}/selecionar-parceiro",
                json={"parceiro_id": None},
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            print("SUCCESS: Contabilista selecionar-parceiro endpoint works (cleared)")
        else:
            # Test selecting first parceiro
            response = requests.post(
                f"{BASE_URL}/api/contabilistas/{user_id}/selecionar-parceiro",
                json={"parceiro_id": parceiros[0].get("id")},
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            print(f"SUCCESS: Contabilista selecionar-parceiro endpoint works - selected {parceiros[0].get('nome_empresa')}")
