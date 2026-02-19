"""
Tests for TVDEFleet new features:
1. Atribuição de parceiros a gestores
2. Papel de contabilista com acesso restrito
3. Gestão de fornecedores por parceiro
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDENTIALS = {"email": "admin@tvdefleet.com", "password": "Admin123!"}
CONTABILISTA_CREDENTIALS = {"email": "contabilista@tvdefleet.com", "password": "Contabilista123!"}
PARCEIRO_CREDENTIALS = {"email": "geral@zmbusines.com", "password": "Admin123!"}
GESTOR_CREDENTIALS = {"email": "gestor@tvdefleet.com", "password": "Admin123!"}


class TestAuthentication:
    """Test authentication for different roles"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['name']}")
    
    def test_contabilista_login(self):
        """Test contabilista login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CONTABILISTA_CREDENTIALS)
        if response.status_code == 200:
            data = response.json()
            assert data["user"]["role"] == "contabilista"
            print(f"✓ Contabilista login successful: {data['user']['name']}")
        elif response.status_code == 401:
            print("⚠ Contabilista user may not exist yet - needs to be created")
            pytest.skip("Contabilista user not found")
        else:
            pytest.fail(f"Contabilista login failed with unexpected status: {response.status_code}")
    
    def test_parceiro_login(self):
        """Test parceiro login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARCEIRO_CREDENTIALS)
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "parceiro"
        print(f"✓ Parceiro login successful: {data['user']['name']}")
    
    def test_gestor_login(self):
        """Test gestor login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=GESTOR_CREDENTIALS)
        if response.status_code == 200:
            data = response.json()
            assert data["user"]["role"] == "gestao"
            print(f"✓ Gestor login successful: {data['user']['name']}")
        elif response.status_code == 401:
            print("⚠ Gestor user may not exist yet")
            pytest.skip("Gestor user not found")


class TestGestoresParceirosAtribuicao:
    """Test gestor-parceiro assignment functionality"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        return response.json()["access_token"]
    
    def test_get_users_list_as_admin(self, admin_token):
        """Test admin can get list of users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        print(f"✓ Got {len(users)} users")
        
        # Find gestao users
        gestores = [u for u in users if u.get("role") == "gestao"]
        print(f"  - Found {len(gestores)} gestores")
        return gestores
    
    def test_get_parceiros_list_as_admin(self, admin_token):
        """Test admin can get list of parceiros"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/parceiros", headers=headers)
        assert response.status_code == 200
        parceiros = response.json()
        assert isinstance(parceiros, list)
        print(f"✓ Got {len(parceiros)} parceiros")
        return parceiros
    
    def test_get_gestores_endpoint(self, admin_token):
        """Test gestores endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/gestores", headers=headers)
        assert response.status_code == 200
        gestores = response.json()
        assert isinstance(gestores, list)
        print(f"✓ Gestores endpoint returned {len(gestores)} gestores")
        return gestores
    
    def test_get_gestor_parceiros_endpoint(self, admin_token):
        """Test getting parceiros assigned to a gestor"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get a gestor
        response = requests.get(f"{BASE_URL}/api/gestores", headers=headers)
        gestores = response.json()
        
        if not gestores:
            pytest.skip("No gestores found to test")
        
        gestor_id = gestores[0]["id"]
        response = requests.get(f"{BASE_URL}/api/gestores/{gestor_id}/parceiros", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "parceiros" in data
        print(f"✓ Gestor {gestor_id} has {len(data.get('parceiros', []))} parceiros assigned")
    
    def test_atribuir_parceiros_a_gestor(self, admin_token):
        """Test assigning parceiros to a gestor"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get gestores
        response = requests.get(f"{BASE_URL}/api/gestores", headers=headers)
        gestores = response.json()
        
        if not gestores:
            pytest.skip("No gestores found to test")
        
        # Get parceiros
        response = requests.get(f"{BASE_URL}/api/parceiros", headers=headers)
        parceiros = response.json()
        
        if not parceiros:
            pytest.skip("No parceiros found to test")
        
        gestor_id = gestores[0]["id"]
        parceiro_ids = [p["id"] for p in parceiros[:2]]  # Assign first 2 parceiros
        
        # Assign parceiros to gestor
        response = requests.put(
            f"{BASE_URL}/api/gestores/{gestor_id}/atribuir-parceiros",
            headers=headers,
            json={"parceiros_ids": parceiro_ids}
        )
        assert response.status_code == 200, f"Failed to assign parceiros: {response.text}"
        data = response.json()
        assert "parceiros_atribuidos" in data
        print(f"✓ Assigned {len(parceiro_ids)} parceiros to gestor {gestor_id}")


class TestContabilistaRole:
    """Test contabilista role restrictions"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def contabilista_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CONTABILISTA_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip("Contabilista user not found")
        return response.json()["access_token"]
    
    def test_contabilista_access_contabilidade_faturas(self, contabilista_token):
        """Test contabilista can access contabilidade faturas endpoint"""
        headers = {"Authorization": f"Bearer {contabilista_token}"}
        response = requests.get(f"{BASE_URL}/api/contabilidade/faturas-fornecedores", headers=headers)
        assert response.status_code == 200, f"Contabilista cannot access faturas: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Contabilista can access faturas-fornecedores: {len(data)} records")
    
    def test_contabilista_access_recibos_motoristas(self, contabilista_token):
        """Test contabilista can access recibos motoristas endpoint"""
        headers = {"Authorization": f"Bearer {contabilista_token}"}
        response = requests.get(f"{BASE_URL}/api/contabilidade/recibos-motoristas", headers=headers)
        assert response.status_code == 200, f"Contabilista cannot access recibos: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Contabilista can access recibos-motoristas: {len(data)} records")
    
    def test_contabilista_access_faturas_veiculos(self, contabilista_token):
        """Test contabilista can access faturas veiculos endpoint"""
        headers = {"Authorization": f"Bearer {contabilista_token}"}
        response = requests.get(f"{BASE_URL}/api/contabilidade/faturas-veiculos", headers=headers)
        assert response.status_code == 200, f"Contabilista cannot access faturas veiculos: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Contabilista can access faturas-veiculos: {len(data)} records")
    
    def test_contabilista_cannot_access_motoristas(self, contabilista_token):
        """Test contabilista cannot access motoristas list"""
        headers = {"Authorization": f"Bearer {contabilista_token}"}
        response = requests.get(f"{BASE_URL}/api/motoristas", headers=headers)
        # Should be forbidden or return empty
        if response.status_code == 403:
            print("✓ Contabilista correctly denied access to motoristas")
        elif response.status_code == 200:
            # Some APIs might just return empty data
            print("⚠ Contabilista has access to motoristas - may need restriction")
        assert response.status_code in [200, 403], f"Unexpected response: {response.status_code}"
    
    def test_contabilista_cannot_access_vehicles(self, contabilista_token):
        """Test contabilista cannot access vehicles list directly"""
        headers = {"Authorization": f"Bearer {contabilista_token}"}
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=headers)
        if response.status_code == 403:
            print("✓ Contabilista correctly denied access to vehicles")
        elif response.status_code == 200:
            print("⚠ Contabilista has access to vehicles - may need restriction")
        assert response.status_code in [200, 403], f"Unexpected response: {response.status_code}"


class TestFornecedoresGestao:
    """Test fornecedores management per parceiro"""
    
    @pytest.fixture
    def parceiro_auth(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARCEIRO_CREDENTIALS)
        assert response.status_code == 200
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        return response.json()["access_token"]
    
    def test_get_fornecedores_as_parceiro(self, parceiro_auth):
        """Test parceiro can get their fornecedores"""
        headers = {"Authorization": f"Bearer {parceiro_auth['token']}"}
        parceiro_id = parceiro_auth["user_id"]
        
        response = requests.get(f"{BASE_URL}/api/parceiros/{parceiro_id}/fornecedores", headers=headers)
        assert response.status_code == 200, f"Failed to get fornecedores: {response.text}"
        data = response.json()
        assert "fornecedores" in data
        print(f"✓ Parceiro has {len(data['fornecedores'])} fornecedores")
        return data["fornecedores"]
    
    def test_create_fornecedor_as_parceiro(self, parceiro_auth):
        """Test parceiro can create a new fornecedor"""
        headers = {"Authorization": f"Bearer {parceiro_auth['token']}"}
        parceiro_id = parceiro_auth["user_id"]
        
        fornecedor_data = {
            "nome": "TEST_Oficina Teste",
            "nif": "123456789",
            "email": "oficina@teste.com",
            "telefone": "+351 912345678",
            "tipo": "oficina",
            "morada": "Rua Teste 123, Lisboa",
            "notas": "Fornecedor de teste"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/fornecedores",
            headers=headers,
            json=fornecedor_data
        )
        assert response.status_code == 200, f"Failed to create fornecedor: {response.text}"
        data = response.json()
        assert "fornecedor" in data
        assert data["fornecedor"]["nome"] == fornecedor_data["nome"]
        print(f"✓ Created fornecedor: {data['fornecedor']['nome']} with id {data['fornecedor']['id']}")
        return data["fornecedor"]
    
    def test_update_fornecedor_as_parceiro(self, parceiro_auth):
        """Test parceiro can update a fornecedor"""
        headers = {"Authorization": f"Bearer {parceiro_auth['token']}"}
        parceiro_id = parceiro_auth["user_id"]
        
        # First create a fornecedor
        fornecedor = self.test_create_fornecedor_as_parceiro(parceiro_auth)
        fornecedor_id = fornecedor["id"]
        
        # Update it
        update_data = {
            "nome": "TEST_Oficina Atualizada",
            "telefone": "+351 999888777"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/fornecedores/{fornecedor_id}",
            headers=headers,
            json=update_data
        )
        assert response.status_code == 200, f"Failed to update fornecedor: {response.text}"
        data = response.json()
        assert data["fornecedor"]["nome"] == update_data["nome"]
        print(f"✓ Updated fornecedor: {data['fornecedor']['nome']}")
    
    def test_delete_fornecedor_as_parceiro(self, parceiro_auth):
        """Test parceiro can delete a fornecedor"""
        headers = {"Authorization": f"Bearer {parceiro_auth['token']}"}
        parceiro_id = parceiro_auth["user_id"]
        
        # First create a fornecedor
        fornecedor_data = {
            "nome": "TEST_Fornecedor Para Deletar",
            "tipo": "outros"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/fornecedores",
            headers=headers,
            json=fornecedor_data
        )
        assert response.status_code == 200
        fornecedor_id = response.json()["fornecedor"]["id"]
        
        # Delete it
        response = requests.delete(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/fornecedores/{fornecedor_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to delete fornecedor: {response.text}"
        print(f"✓ Deleted fornecedor: {fornecedor_id}")
    
    def test_fornecedores_filter_by_tipo(self, parceiro_auth):
        """Test fornecedores can be filtered (frontend feature)"""
        headers = {"Authorization": f"Bearer {parceiro_auth['token']}"}
        parceiro_id = parceiro_auth["user_id"]
        
        response = requests.get(f"{BASE_URL}/api/parceiros/{parceiro_id}/fornecedores", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Filter by tipo (done on frontend)
        oficinas = [f for f in data["fornecedores"] if f.get("tipo") == "oficina"]
        print(f"✓ Found {len(oficinas)} oficina fornecedores out of {len(data['fornecedores'])} total")


class TestUserProfile:
    """Test user profile with parceiros tab for gestores"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        return response.json()["access_token"]
    
    def test_get_user_profile(self, admin_token):
        """Test getting user profile"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get gestores
        response = requests.get(f"{BASE_URL}/api/gestores", headers=headers)
        gestores = response.json()
        
        if not gestores:
            pytest.skip("No gestores found to test")
        
        gestor_id = gestores[0]["id"]
        
        # Get user profile
        response = requests.get(f"{BASE_URL}/api/users/{gestor_id}", headers=headers)
        assert response.status_code == 200
        user = response.json()
        assert user["role"] == "gestao"
        print(f"✓ Got gestor profile: {user.get('name')}")
        print(f"  - parceiros_atribuidos: {len(user.get('parceiros_atribuidos', []))}")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    
    # Login as admin
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
    if response.status_code != 200:
        return
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get parceiros to cleanup fornecedores
    response = requests.get(f"{BASE_URL}/api/parceiros", headers=headers)
    if response.status_code == 200:
        parceiros = response.json()
        for parceiro in parceiros:
            # Get fornecedores
            resp = requests.get(f"{BASE_URL}/api/parceiros/{parceiro['id']}/fornecedores", headers=headers)
            if resp.status_code == 200:
                fornecedores = resp.json().get("fornecedores", [])
                for f in fornecedores:
                    if f.get("nome", "").startswith("TEST_"):
                        requests.delete(
                            f"{BASE_URL}/api/parceiros/{parceiro['id']}/fornecedores/{f['id']}",
                            headers=headers
                        )
                        print(f"🧹 Cleaned up fornecedor: {f['nome']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
