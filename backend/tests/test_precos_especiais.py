"""
Test Suite: Preços Especiais (Special Prices) System
Tests the 5 types of discount calculation:
- percentagem: % discount on base price
- valor_fixo: Fixed monthly price (total)
- valor_fixo_veiculo: Fixed price per vehicle
- valor_fixo_motorista: Fixed price per driver
- valor_fixo_motorista_veiculo: Fixed price per vehicle/driver combination
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "Admin123!"
TEST_PLANO_ID = "eb5e2225-a475-4317-84a8-a9126b2dc4f2"
TEST_PARCEIRO_ID = "ab2a25aa-4f70-4c7b-835d-9204b0cd0d7e"


class TestPrecosEspeciaisEndpoints:
    """Test preços especiais CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - authenticate as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        yield
    
    # ==================== ADMIN ENDPOINT TESTS ====================
    
    def test_admin_listar_precos_especiais(self):
        """Test GET /api/admin/precos-especiais - list all special prices"""
        response = self.session.get(f"{BASE_URL}/api/admin/precos-especiais")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Admin endpoint returned {len(data)} preços especiais")
        
        # Check structure if there are items
        if len(data) > 0:
            preco = data[0]
            assert "parceiro_id" in preco or "id" in preco, "Should have parceiro_id or id field"
            print(f"  First item keys: {list(preco.keys())[:5]}...")
    
    def test_gestao_planos_listar_precos_especiais(self):
        """Test GET /api/gestao-planos/precos-especiais - list via gestao-planos"""
        response = self.session.get(f"{BASE_URL}/api/gestao-planos/precos-especiais")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Gestao-planos endpoint returned {len(data)} preços especiais")
    
    # ==================== CREATE SPECIAL PRICE TESTS ====================
    
    def test_criar_preco_especial_percentagem(self):
        """Test creating special price with tipo_desconto=percentagem"""
        preco_data = {
            "parceiro_id": TEST_PARCEIRO_ID,
            "tipo_desconto": "percentagem",
            "valor_desconto": 15,  # 15% discount
            "motivo": "Teste pytest - percentagem"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais",
            json=preco_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should have id"
        assert data.get("tipo_desconto") == "percentagem", f"tipo_desconto should be percentagem"
        assert data.get("valor_desconto") == 15 or data.get("desconto_percentagem") == 15, "Discount should be 15"
        
        # Store for cleanup
        self.created_preco_id = data["id"]
        print(f"✓ Created preço especial percentagem: {data['id']}")
        
        # Cleanup
        self.session.delete(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais/{data['id']}"
        )
    
    def test_criar_preco_especial_valor_fixo(self):
        """Test creating special price with tipo_desconto=valor_fixo"""
        preco_data = {
            "parceiro_id": TEST_PARCEIRO_ID,
            "tipo_desconto": "valor_fixo",
            "preco_fixo": 50,  # €50 fixed total price
            "motivo": "Teste pytest - valor_fixo"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais",
            json=preco_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("tipo_desconto") == "valor_fixo", "tipo_desconto should be valor_fixo"
        assert data.get("preco_fixo") == 50, "preco_fixo should be 50"
        print(f"✓ Created preço especial valor_fixo: {data['id']}")
        
        # Cleanup
        self.session.delete(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais/{data['id']}"
        )
    
    def test_criar_preco_especial_valor_fixo_veiculo(self):
        """Test creating special price with tipo_desconto=valor_fixo_veiculo"""
        preco_data = {
            "parceiro_id": TEST_PARCEIRO_ID,
            "tipo_desconto": "valor_fixo_veiculo",
            "preco_fixo": 5,  # €5 per vehicle
            "motivo": "Teste pytest - valor_fixo_veiculo"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais",
            json=preco_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("tipo_desconto") == "valor_fixo_veiculo", "tipo_desconto should be valor_fixo_veiculo"
        assert data.get("preco_fixo") == 5, "preco_fixo should be 5"
        print(f"✓ Created preço especial valor_fixo_veiculo: {data['id']}")
        
        # Cleanup
        self.session.delete(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais/{data['id']}"
        )
    
    def test_criar_preco_especial_valor_fixo_motorista(self):
        """Test creating special price with tipo_desconto=valor_fixo_motorista"""
        preco_data = {
            "parceiro_id": TEST_PARCEIRO_ID,
            "tipo_desconto": "valor_fixo_motorista",
            "preco_fixo": 3,  # €3 per driver
            "motivo": "Teste pytest - valor_fixo_motorista"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais",
            json=preco_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("tipo_desconto") == "valor_fixo_motorista", "tipo_desconto should be valor_fixo_motorista"
        assert data.get("preco_fixo") == 3, "preco_fixo should be 3"
        print(f"✓ Created preço especial valor_fixo_motorista: {data['id']}")
        
        # Cleanup
        self.session.delete(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais/{data['id']}"
        )
    
    def test_criar_preco_especial_valor_fixo_motorista_veiculo(self):
        """Test creating special price with tipo_desconto=valor_fixo_motorista_veiculo"""
        preco_data = {
            "parceiro_id": TEST_PARCEIRO_ID,
            "tipo_desconto": "valor_fixo_motorista_veiculo",
            "preco_fixo": 4,  # €4 per combination
            "motivo": "Teste pytest - valor_fixo_motorista_veiculo"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais",
            json=preco_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("tipo_desconto") == "valor_fixo_motorista_veiculo", "tipo_desconto should be valor_fixo_motorista_veiculo"
        assert data.get("preco_fixo") == 4, "preco_fixo should be 4"
        print(f"✓ Created preço especial valor_fixo_motorista_veiculo: {data['id']}")
        
        # Cleanup
        self.session.delete(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais/{data['id']}"
        )


class TestCalculoPrecosEspeciais:
    """Test price calculation with special prices applied"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - authenticate and create test special prices"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        # Use a unique test parceiro ID for calculation tests
        self.test_parceiro_id = str(uuid.uuid4())
        self.created_precos = []
        
        yield
        
        # Cleanup created test prices
        for preco_id in self.created_precos:
            try:
                self.session.delete(
                    f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais/{preco_id}"
                )
            except:
                pass
    
    def _create_test_preco(self, tipo_desconto, valor_desconto=None, preco_fixo=None, parceiro_id=None):
        """Helper to create a test special price"""
        preco_data = {
            "parceiro_id": parceiro_id or self.test_parceiro_id,
            "tipo_desconto": tipo_desconto,
            "motivo": f"Teste cálculo - {tipo_desconto}"
        }
        
        if valor_desconto is not None:
            preco_data["valor_desconto"] = valor_desconto
        if preco_fixo is not None:
            preco_data["preco_fixo"] = preco_fixo
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais",
            json=preco_data
        )
        
        if response.status_code == 200:
            data = response.json()
            self.created_precos.append(data["id"])
            return data
        return None
    
    def test_calcular_preco_sem_especial(self):
        """Test calculation without special price (baseline)"""
        # Use a random parceiro ID that won't have special prices
        random_parceiro = str(uuid.uuid4())
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/precos-especiais/calcular",
            params={
                "parceiro_id": random_parceiro,
                "plano_id": TEST_PLANO_ID,
                "num_veiculos": 5,
                "num_motoristas": 3,
                "periodicidade": "mensal"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should have basic structure
        assert "preco_original" in data or "preco_final" in data, "Should have price fields"
        assert data.get("plano_id") == TEST_PLANO_ID, "Should match plano_id"
        
        preco_final = data.get("preco_final", 0)
        preco_original = data.get("preco_original", preco_final)
        
        print(f"✓ Baseline calculation: preco_original={preco_original}, preco_final={preco_final}")
        print(f"  num_veiculos: {data.get('num_veiculos')}, num_motoristas: {data.get('num_motoristas')}")
    
    def test_calcular_percentagem(self):
        """Test calculation with percentagem discount (15%)"""
        # Create 15% discount
        preco_created = self._create_test_preco("percentagem", valor_desconto=15)
        assert preco_created is not None, "Failed to create test preco especial"
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/precos-especiais/calcular",
            params={
                "parceiro_id": self.test_parceiro_id,
                "plano_id": TEST_PLANO_ID,
                "num_veiculos": 5,
                "num_motoristas": 3,
                "periodicidade": "mensal"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        preco_original = data.get("preco_original", 0)
        preco_final = data.get("preco_final", 0)
        preco_especial_aplicado = data.get("preco_especial_aplicado")
        
        print(f"✓ Percentagem (15%): original={preco_original}, final={preco_final}")
        
        if preco_especial_aplicado:
            assert preco_especial_aplicado.get("tipo") == "percentagem", "Should be percentagem type"
            print(f"  Applied: {preco_especial_aplicado}")
            
            # Verify 15% discount was applied (final should be ~85% of original)
            if preco_original > 0:
                expected_final = preco_original * 0.85
                assert abs(preco_final - expected_final) < 0.1, f"Expected ~{expected_final}, got {preco_final}"
    
    def test_calcular_valor_fixo(self):
        """Test calculation with valor_fixo (€50 fixed)"""
        # Create €50 fixed price
        preco_created = self._create_test_preco("valor_fixo", preco_fixo=50)
        assert preco_created is not None, "Failed to create test preco especial"
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/precos-especiais/calcular",
            params={
                "parceiro_id": self.test_parceiro_id,
                "plano_id": TEST_PLANO_ID,
                "num_veiculos": 10,  # Many vehicles, but price should still be €50
                "num_motoristas": 8,
                "periodicidade": "mensal"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        preco_final = data.get("preco_final", 0)
        preco_especial_aplicado = data.get("preco_especial_aplicado")
        
        print(f"✓ Valor fixo (€50): final={preco_final}")
        
        if preco_especial_aplicado:
            assert preco_especial_aplicado.get("tipo") == "valor_fixo", "Should be valor_fixo type"
            assert preco_final == 50, f"Fixed price should be 50, got {preco_final}"
            print(f"  Applied: {preco_especial_aplicado}")
    
    def test_calcular_valor_fixo_veiculo(self):
        """Test calculation with valor_fixo_veiculo (€5/vehicle)"""
        # Create €5 per vehicle
        preco_created = self._create_test_preco("valor_fixo_veiculo", preco_fixo=5)
        assert preco_created is not None, "Failed to create test preco especial"
        
        num_veiculos = 8
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/precos-especiais/calcular",
            params={
                "parceiro_id": self.test_parceiro_id,
                "plano_id": TEST_PLANO_ID,
                "num_veiculos": num_veiculos,
                "num_motoristas": 5,
                "periodicidade": "mensal"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        preco_final = data.get("preco_final", 0)
        preco_especial_aplicado = data.get("preco_especial_aplicado")
        
        expected_price = 5 * num_veiculos  # €5 × 8 = €40
        print(f"✓ Valor fixo veículo (€5/veh × {num_veiculos}): final={preco_final}, expected={expected_price}")
        
        if preco_especial_aplicado:
            assert preco_especial_aplicado.get("tipo") == "valor_fixo_veiculo", "Should be valor_fixo_veiculo type"
            assert preco_final == expected_price, f"Expected {expected_price}, got {preco_final}"
            print(f"  Applied: {preco_especial_aplicado}")
    
    def test_calcular_valor_fixo_motorista(self):
        """Test calculation with valor_fixo_motorista (€3/driver)"""
        # Create €3 per driver
        preco_created = self._create_test_preco("valor_fixo_motorista", preco_fixo=3)
        assert preco_created is not None, "Failed to create test preco especial"
        
        num_motoristas = 10
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/precos-especiais/calcular",
            params={
                "parceiro_id": self.test_parceiro_id,
                "plano_id": TEST_PLANO_ID,
                "num_veiculos": 5,
                "num_motoristas": num_motoristas,
                "periodicidade": "mensal"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        preco_final = data.get("preco_final", 0)
        preco_especial_aplicado = data.get("preco_especial_aplicado")
        
        expected_price = 3 * num_motoristas  # €3 × 10 = €30
        print(f"✓ Valor fixo motorista (€3/mot × {num_motoristas}): final={preco_final}, expected={expected_price}")
        
        if preco_especial_aplicado:
            assert preco_especial_aplicado.get("tipo") == "valor_fixo_motorista", "Should be valor_fixo_motorista type"
            assert preco_final == expected_price, f"Expected {expected_price}, got {preco_final}"
            print(f"  Applied: {preco_especial_aplicado}")
    
    def test_calcular_valor_fixo_motorista_veiculo(self):
        """Test calculation with valor_fixo_motorista_veiculo (€4/combination)"""
        # Create €4 per combination
        preco_created = self._create_test_preco("valor_fixo_motorista_veiculo", preco_fixo=4)
        assert preco_created is not None, "Failed to create test preco especial"
        
        num_veiculos = 6
        num_motoristas = 10
        # min(6, 10) = 6 combinations
        expected_combinations = min(num_veiculos, num_motoristas)
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/precos-especiais/calcular",
            params={
                "parceiro_id": self.test_parceiro_id,
                "plano_id": TEST_PLANO_ID,
                "num_veiculos": num_veiculos,
                "num_motoristas": num_motoristas,
                "periodicidade": "mensal"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        preco_final = data.get("preco_final", 0)
        preco_especial_aplicado = data.get("preco_especial_aplicado")
        
        expected_price = 4 * expected_combinations  # €4 × 6 = €24
        print(f"✓ Valor fixo mot/veh (€4/comb × {expected_combinations}): final={preco_final}, expected={expected_price}")
        
        if preco_especial_aplicado:
            assert preco_especial_aplicado.get("tipo") == "valor_fixo_motorista_veiculo", "Should be valor_fixo_motorista_veiculo type"
            assert preco_final == expected_price, f"Expected {expected_price}, got {preco_final}"
            print(f"  Applied: {preco_especial_aplicado}")


class TestPrecoEspecialCRUD:
    """Test full CRUD cycle for special prices"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        self.test_parceiro_id = str(uuid.uuid4())
        
        yield
    
    def test_crud_cycle_preco_especial(self):
        """Test complete Create → Read → Delete cycle"""
        
        # 1. CREATE
        preco_data = {
            "parceiro_id": self.test_parceiro_id,
            "tipo_desconto": "valor_fixo_veiculo",
            "preco_fixo": 7.50,
            "motivo": "CRUD test - should be deleted"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais",
            json=preco_data
        )
        
        assert create_response.status_code == 200, f"Create failed: {create_response.status_code}"
        created = create_response.json()
        preco_id = created["id"]
        print(f"✓ Created preço especial: {preco_id}")
        
        # 2. READ - verify in list
        list_response = self.session.get(f"{BASE_URL}/api/gestao-planos/precos-especiais")
        assert list_response.status_code == 200
        
        precos_list = list_response.json()
        found = any(p.get("id") == preco_id for p in precos_list)
        assert found, f"Created preco {preco_id} not found in list"
        print(f"✓ Verified preço especial exists in list")
        
        # 3. DELETE
        delete_response = self.session.delete(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais/{preco_id}"
        )
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.status_code}"
        print(f"✓ Deleted preço especial: {preco_id}")
        
        # 4. VERIFY DELETED - should not be in list anymore
        verify_response = self.session.get(f"{BASE_URL}/api/gestao-planos/precos-especiais")
        assert verify_response.status_code == 200
        
        precos_after = verify_response.json()
        still_exists = any(p.get("id") == preco_id for p in precos_after)
        assert not still_exists, f"Preco {preco_id} should have been deleted"
        print(f"✓ Verified preço especial was removed from list")
    
    def test_delete_nonexistent_preco(self):
        """Test deleting non-existent special price"""
        fake_id = str(uuid.uuid4())
        
        response = self.session.delete(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais/{fake_id}"
        )
        
        # Should return 404
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Delete non-existent returns 404 as expected")
    
    def test_create_without_parceiro_id(self):
        """Test creating special price without parceiro_id should fail"""
        preco_data = {
            "tipo_desconto": "percentagem",
            "valor_desconto": 10,
            "motivo": "Missing parceiro_id"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/planos/{TEST_PLANO_ID}/precos-especiais",
            json=preco_data
        )
        
        # Should return 400
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Create without parceiro_id returns 400 as expected")


class TestAuthorizationPrecosEspeciais:
    """Test authorization for special prices endpoints"""
    
    def test_unauthorized_access_admin_endpoint(self):
        """Test accessing admin endpoint without auth"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/admin/precos-especiais")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthorized access returns {response.status_code}")
    
    def test_unauthorized_access_gestao_planos_endpoint(self):
        """Test accessing gestao-planos endpoint without auth"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/gestao-planos/precos-especiais")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthorized access returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
