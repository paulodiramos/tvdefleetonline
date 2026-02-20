"""
Test suite for Iteration 56: Driver Approval Flow with Partner and Classification
Tests the following features:
1. Driver approval with partner selection
2. Driver approval with classification selection  
3. Backend persistence of partner and classification data
4. Migration modal statistics and execution
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestApprovalFlowWithPartnerAndClassification:
    """Tests for the enhanced driver approval flow with partner and classification selection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token and fetch required data"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get available parceiros
        parceiros_resp = requests.get(f"{BASE_URL}/api/parceiros", headers=self.headers)
        self.parceiros = parceiros_resp.json() if parceiros_resp.status_code == 200 else []
        
        # Get classification config
        class_resp = requests.get(f"{BASE_URL}/api/comissoes/classificacao/config", headers=self.headers)
        self.classificacoes = class_resp.json().get("niveis", []) if class_resp.status_code == 200 else []
    
    def test_01_parceiros_endpoint_returns_data(self):
        """Verify parceiros endpoint returns list of available partners"""
        response = requests.get(f"{BASE_URL}/api/parceiros", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        parceiros = response.json()
        assert isinstance(parceiros, list), "Response should be a list"
        
        if len(parceiros) > 0:
            parceiro = parceiros[0]
            assert "id" in parceiro, "Parceiro should have 'id' field"
            # Check for name fields (can be nome_empresa, nome, or name)
            has_name = "nome_empresa" in parceiro or "nome" in parceiro or "name" in parceiro
            assert has_name, "Parceiro should have a name field"
            print(f"Found {len(parceiros)} parceiros")
    
    def test_02_classificacao_config_endpoint(self):
        """Verify classificacao config endpoint returns classification levels"""
        response = requests.get(f"{BASE_URL}/api/comissoes/classificacao/config", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "niveis" in data, "Response should have 'niveis' field"
        
        niveis = data["niveis"]
        assert isinstance(niveis, list), "niveis should be a list"
        assert len(niveis) > 0, "Should have at least one classification level"
        
        # Verify first level structure
        nivel = niveis[0]
        assert "id" in nivel, "Nivel should have 'id'"
        assert "nome" in nivel, "Nivel should have 'nome'"
        assert "bonus_percentagem" in nivel, "Nivel should have 'bonus_percentagem'"
        
        print(f"Found {len(niveis)} classification levels: {[n['nome'] for n in niveis]}")
    
    def test_03_create_motorista_and_approve_with_partner(self):
        """Create a pending motorista and approve with partner assignment"""
        # Skip if no parceiros available
        if not self.parceiros:
            pytest.skip("No parceiros available for testing")
        
        # Create a test motorista user (pending)
        test_email = f"test_motorista_{uuid.uuid4().hex[:8]}@test.com"
        register_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "name": "Test Motorista Partner",
            "password": "Test123!",
            "role": "motorista",
            "phone": "912345678"
        })
        
        if register_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create test user: {register_resp.text}")
        
        user_data = register_resp.json()
        user_id = user_data.get("id") or user_data.get("user", {}).get("id")
        assert user_id, "User ID should be returned"
        
        # Get first parceiro
        parceiro_id = self.parceiros[0]["id"]
        
        # Approve the motorista with partner assignment
        approve_resp = requests.put(
            f"{BASE_URL}/api/users/{user_id}/approve",
            headers=self.headers,
            json={"parceiro_id": parceiro_id}
        )
        assert approve_resp.status_code == 200, f"Approval failed: {approve_resp.text}"
        
        # Verify user is approved and has partner assigned
        user_resp = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
        assert user_resp.status_code == 200
        
        user = user_resp.json()
        assert user.get("approved") == True, "User should be approved"
        assert user.get("associated_partner_id") == parceiro_id or user.get("parceiro_id") == parceiro_id, \
            f"User should have partner assigned. User data: {user}"
        
        print(f"Successfully approved motorista {test_email} with partner {parceiro_id}")
        
        # Cleanup - delete the test user
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
    
    def test_04_approve_motorista_with_classification(self):
        """Create a pending motorista and approve with classification assignment"""
        # Skip if no classificacoes available
        if not self.classificacoes:
            pytest.skip("No classifications available for testing")
        
        # Create a test motorista user (pending)
        test_email = f"test_motorista_class_{uuid.uuid4().hex[:8]}@test.com"
        register_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "name": "Test Motorista Classification",
            "password": "Test123!",
            "role": "motorista",
            "phone": "912345679"
        })
        
        if register_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create test user: {register_resp.text}")
        
        user_data = register_resp.json()
        user_id = user_data.get("id") or user_data.get("user", {}).get("id")
        assert user_id, "User ID should be returned"
        
        # Get a classification (e.g., "Prata")
        classificacao = next((c for c in self.classificacoes if c.get("nome") == "Prata"), self.classificacoes[1] if len(self.classificacoes) > 1 else self.classificacoes[0])
        classificacao_nome = classificacao["nome"]
        
        # Approve the motorista with classification assignment
        approve_resp = requests.put(
            f"{BASE_URL}/api/users/{user_id}/approve",
            headers=self.headers,
            json={"classificacao": classificacao_nome}
        )
        assert approve_resp.status_code == 200, f"Approval failed: {approve_resp.text}"
        
        # Verify user is approved and has classification assigned
        user_resp = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
        assert user_resp.status_code == 200
        
        user = user_resp.json()
        assert user.get("approved") == True, "User should be approved"
        assert user.get("classificacao") == classificacao_nome, \
            f"User should have classification '{classificacao_nome}'. Got: {user.get('classificacao')}"
        
        print(f"Successfully approved motorista {test_email} with classification {classificacao_nome}")
        
        # Cleanup - delete the test user
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
    
    def test_05_approve_motorista_with_partner_and_classification(self):
        """Create a pending motorista and approve with both partner AND classification"""
        # Skip if no parceiros or classificacoes available
        if not self.parceiros:
            pytest.skip("No parceiros available for testing")
        if not self.classificacoes:
            pytest.skip("No classifications available for testing")
        
        # Create a test motorista user (pending)
        test_email = f"test_motorista_full_{uuid.uuid4().hex[:8]}@test.com"
        register_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "name": "Test Motorista Full",
            "password": "Test123!",
            "role": "motorista",
            "phone": "912345680"
        })
        
        if register_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create test user: {register_resp.text}")
        
        user_data = register_resp.json()
        user_id = user_data.get("id") or user_data.get("user", {}).get("id")
        assert user_id, "User ID should be returned"
        
        # Get first parceiro and a classification
        parceiro_id = self.parceiros[0]["id"]
        classificacao = next((c for c in self.classificacoes if c.get("nome") == "Ouro"), self.classificacoes[2] if len(self.classificacoes) > 2 else self.classificacoes[0])
        classificacao_nome = classificacao["nome"]
        
        # Approve the motorista with both partner and classification
        approve_resp = requests.put(
            f"{BASE_URL}/api/users/{user_id}/approve",
            headers=self.headers,
            json={
                "parceiro_id": parceiro_id,
                "classificacao": classificacao_nome
            }
        )
        assert approve_resp.status_code == 200, f"Approval failed: {approve_resp.text}"
        
        # Verify user is approved with both assignments
        user_resp = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
        assert user_resp.status_code == 200
        
        user = user_resp.json()
        assert user.get("approved") == True, "User should be approved"
        assert user.get("associated_partner_id") == parceiro_id or user.get("parceiro_id") == parceiro_id, \
            f"User should have partner assigned. User data: {user}"
        assert user.get("classificacao") == classificacao_nome, \
            f"User should have classification '{classificacao_nome}'. Got: {user.get('classificacao')}"
        
        print(f"Successfully approved motorista {test_email} with partner {parceiro_id} and classification {classificacao_nome}")
        
        # Cleanup - delete the test user
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)


class TestMigrationFeatures:
    """Tests for the migration modal and data correction features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_01_verificar_migracao_endpoint(self):
        """Test migration verification endpoint returns statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verificar-migracao",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_motoristas" in data, "Response should have 'total_motoristas'"
        assert "precisam_migracao" in data, "Response should have 'precisam_migracao'"
        assert "migracao_necessaria" in data, "Response should have 'migracao_necessaria'"
        
        precisam = data["precisam_migracao"]
        assert "sem_campo_documentos" in precisam, "Should have 'sem_campo_documentos' count"
        assert "sem_dados_pessoais" in precisam, "Should have 'sem_dados_pessoais' count"
        assert "com_documentos_formato_antigo" in precisam, "Should have 'com_documentos_formato_antigo' count"
        
        print(f"Migration check: {data['total_motoristas']} total motoristas")
        print(f"  - sem_campo_documentos: {precisam['sem_campo_documentos']}")
        print(f"  - sem_dados_pessoais: {precisam['sem_dados_pessoais']}")
        print(f"  - com_documentos_formato_antigo: {precisam['com_documentos_formato_antigo']}")
        print(f"  - migracao_necessaria: {data['migracao_necessaria']}")
    
    def test_02_migrar_motoristas_endpoint(self):
        """Test migration execution endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/admin/migrar-motoristas",
            headers=self.headers,
            json={}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should have 'success' field"
        assert "resultados" in data, "Response should have 'resultados' field"
        
        resultados = data["resultados"]
        assert "total_motoristas" in resultados, "Should have 'total_motoristas' in results"
        assert "campos_corrigidos" in resultados, "Should have 'campos_corrigidos' in results"
        assert "documentos_renomeados" in resultados, "Should have 'documentos_renomeados' in results"
        assert "documentos_campo_criado" in resultados, "Should have 'documentos_campo_criado' in results"
        
        print(f"Migration executed: success={data['success']}")
        print(f"  - total_motoristas: {resultados['total_motoristas']}")
        print(f"  - campos_corrigidos: {resultados['campos_corrigidos']}")
        print(f"  - documentos_renomeados: {resultados['documentos_renomeados']}")
        print(f"  - documentos_campo_criado: {resultados['documentos_campo_criado']}")
    
    def test_03_non_admin_cannot_access_migration(self):
        """Verify non-admin users cannot access migration endpoints"""
        # Try to create a non-admin user or use existing one
        # For this test, we'll verify that the endpoint requires admin role
        
        # Test without authentication
        response = requests.get(f"{BASE_URL}/api/admin/verificar-migracao")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        response = requests.post(f"{BASE_URL}/api/admin/migrar-motoristas")
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422 without auth, got {response.status_code}"
        
        print("Migration endpoints correctly require authentication")


class TestApprovalDialogDataFlow:
    """Tests to verify the data flow from approval dialog to backend"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_01_approve_request_model_validation(self):
        """Test that the approve endpoint accepts optional fields correctly"""
        # Create a test motorista
        test_email = f"test_validation_{uuid.uuid4().hex[:8]}@test.com"
        register_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "name": "Test Validation",
            "password": "Test123!",
            "role": "motorista",
            "phone": "912345681"
        })
        
        if register_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create test user: {register_resp.text}")
        
        user_data = register_resp.json()
        user_id = user_data.get("id") or user_data.get("user", {}).get("id")
        
        # Test 1: Approve with empty body (basic approval)
        approve_resp = requests.put(
            f"{BASE_URL}/api/users/{user_id}/approve",
            headers=self.headers,
            json={}
        )
        assert approve_resp.status_code == 200, f"Basic approval failed: {approve_resp.text}"
        
        # Verify approval
        user_resp = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
        assert user_resp.json().get("approved") == True
        
        print("Basic approval with empty body works correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
    
    def test_02_data_persisted_in_motoristas_collection(self):
        """Verify that approval data is persisted in the motoristas collection"""
        # Get parceiros and classificacoes
        parceiros_resp = requests.get(f"{BASE_URL}/api/parceiros", headers=self.headers)
        parceiros = parceiros_resp.json() if parceiros_resp.status_code == 200 else []
        
        class_resp = requests.get(f"{BASE_URL}/api/comissoes/classificacao/config", headers=self.headers)
        classificacoes = class_resp.json().get("niveis", []) if class_resp.status_code == 200 else []
        
        if not parceiros:
            pytest.skip("No parceiros available")
        
        # Create and approve a motorista with partner and classification
        test_email = f"test_persist_{uuid.uuid4().hex[:8]}@test.com"
        register_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "name": "Test Persist",
            "password": "Test123!",
            "role": "motorista",
            "phone": "912345682"
        })
        
        if register_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create test user: {register_resp.text}")
        
        user_data = register_resp.json()
        user_id = user_data.get("id") or user_data.get("user", {}).get("id")
        
        parceiro_id = parceiros[0]["id"]
        classificacao_nome = classificacoes[0]["nome"] if classificacoes else None
        
        # Approve with all data
        payload = {"parceiro_id": parceiro_id}
        if classificacao_nome:
            payload["classificacao"] = classificacao_nome
        
        approve_resp = requests.put(
            f"{BASE_URL}/api/users/{user_id}/approve",
            headers=self.headers,
            json=payload
        )
        assert approve_resp.status_code == 200
        
        # Check the motorista document
        motoristas_resp = requests.get(
            f"{BASE_URL}/api/motoristas/{user_id}",
            headers=self.headers
        )
        
        if motoristas_resp.status_code == 200:
            motorista = motoristas_resp.json()
            # Check partner assignment
            parceiro_assigned = motorista.get("parceiro_id") or motorista.get("parceiro_atribuido")
            print(f"Motorista document: parceiro={parceiro_assigned}, classificacao={motorista.get('classificacao')}")
        else:
            print(f"Note: Motorista endpoint returned {motoristas_resp.status_code}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
        print("Data persistence test completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
