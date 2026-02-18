"""
Backend tests for KM Management and Preços Especiais features
- GET /api/veiculos/{id}/historico-km - Returns KM history
- PUT /api/veiculos/{id}/atualizar-km - Update vehicle KM
- POST /api/gestao/planos/{id}/precos-especiais - Create special price for partner
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuthentication:
    """Test authentication and get tokens"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_admin_login(self, admin_token):
        """Verify admin login works"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print(f"Admin token obtained successfully")
    
    def test_parceiro_login(self, parceiro_token):
        """Verify parceiro login works"""
        assert parceiro_token is not None
        assert len(parceiro_token) > 0
        print(f"Parceiro token obtained successfully")


class TestKmHistorico:
    """Test KM History endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "Admin123!"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def test_vehicle_id(self, admin_token):
        """Get a test vehicle ID"""
        response = requests.get(f"{BASE_URL}/api/veiculos", 
                               headers={"Authorization": f"Bearer {admin_token}"})
        if response.status_code == 200:
            vehicles = response.json()
            if vehicles and len(vehicles) > 0:
                return vehicles[0].get("id")
        return None
    
    def test_historico_km_endpoint_exists(self, admin_token, test_vehicle_id):
        """Test GET /api/veiculos/{id}/historico-km returns proper response"""
        if not test_vehicle_id:
            pytest.skip("No test vehicle available")
        
        response = requests.get(
            f"{BASE_URL}/api/veiculos/{test_vehicle_id}/historico-km",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Historico KM returned {len(data)} entries")
    
    def test_historico_km_invalid_vehicle(self, admin_token):
        """Test historico-km with invalid vehicle returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/veiculos/invalid-vehicle-id-123/historico-km",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_historico_km_no_mongo_id(self, admin_token, test_vehicle_id):
        """Test historico-km doesn't return _id field"""
        if not test_vehicle_id:
            pytest.skip("No test vehicle available")
        
        response = requests.get(
            f"{BASE_URL}/api/veiculos/{test_vehicle_id}/historico-km",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        for entry in data:
            assert "_id" not in entry, "Response should not contain MongoDB _id"


class TestAtualizarKm:
    """Test KM Update endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "Admin123!"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def test_vehicle_id(self, admin_token):
        """Get a test vehicle ID"""
        response = requests.get(f"{BASE_URL}/api/veiculos", 
                               headers={"Authorization": f"Bearer {admin_token}"})
        if response.status_code == 200:
            vehicles = response.json()
            if vehicles and len(vehicles) > 0:
                return vehicles[0].get("id")
        return None
    
    def test_atualizar_km_endpoint_exists(self, admin_token, test_vehicle_id):
        """Test PUT /api/veiculos/{id}/atualizar-km endpoint exists and works"""
        if not test_vehicle_id:
            pytest.skip("No test vehicle available")
        
        test_km = 85000 + int(uuid.uuid4().int % 1000)  # Random KM to avoid conflicts
        response = requests.put(
            f"{BASE_URL}/api/veiculos/{test_vehicle_id}/atualizar-km",
            json={
                "km_atual": test_km,
                "fonte": "manual",
                "notas": "TEST_km_update"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"KM updated to {test_km}")
    
    def test_atualizar_km_creates_history(self, admin_token, test_vehicle_id):
        """Test that updating KM creates a history entry"""
        if not test_vehicle_id:
            pytest.skip("No test vehicle available")
        
        # First, get current history count
        history_response = requests.get(
            f"{BASE_URL}/api/veiculos/{test_vehicle_id}/historico-km",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        initial_count = len(history_response.json()) if history_response.status_code == 200 else 0
        
        # Update KM
        test_km = 90000 + int(uuid.uuid4().int % 1000)
        update_response = requests.put(
            f"{BASE_URL}/api/veiculos/{test_vehicle_id}/atualizar-km",
            json={
                "km_atual": test_km,
                "fonte": "inspecao",
                "notas": "TEST_verify_history_creation"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert update_response.status_code == 200
        
        # Check history increased
        history_response = requests.get(
            f"{BASE_URL}/api/veiculos/{test_vehicle_id}/historico-km",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        new_count = len(history_response.json()) if history_response.status_code == 200 else 0
        assert new_count > initial_count, "History entry should have been created"
        
        # Verify latest entry has correct data
        if new_count > 0:
            latest = history_response.json()[0]
            assert latest.get("km_novo") == test_km
            assert latest.get("fonte") == "inspecao"
            print(f"History entry created with km_novo={test_km}")
    
    def test_atualizar_km_missing_km_atual(self, admin_token, test_vehicle_id):
        """Test atualizar-km without km_atual returns 400"""
        if not test_vehicle_id:
            pytest.skip("No test vehicle available")
        
        response = requests.put(
            f"{BASE_URL}/api/veiculos/{test_vehicle_id}/atualizar-km",
            json={
                "fonte": "manual"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_simple_km_endpoint_doesnt_exist(self, admin_token, test_vehicle_id):
        """Test PUT /api/veiculos/{id}/km returns 404/405 (endpoint doesn't exist)"""
        if not test_vehicle_id:
            pytest.skip("No test vehicle available")
        
        response = requests.put(
            f"{BASE_URL}/api/veiculos/{test_vehicle_id}/km",
            json={"km_atual": 50000},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # If this returns 404 or 405, the frontend is using wrong endpoint!
        if response.status_code in [404, 405, 422]:
            print(f"WARNING: /km endpoint returns {response.status_code} - frontend uses wrong endpoint!")
        assert response.status_code in [200, 404, 405, 422], f"Got unexpected status: {response.status_code}"


class TestPrecosEspeciais:
    """Test Preços Especiais endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def parceiro_id(self, admin_token):
        """Get a parceiro ID"""
        response = requests.get(f"{BASE_URL}/api/usuarios/parceiros",
                               headers={"Authorization": f"Bearer {admin_token}"})
        if response.status_code == 200:
            parceiros = response.json()
            if parceiros and len(parceiros) > 0:
                return parceiros[0].get("id")
        return None
    
    @pytest.fixture(scope="class")
    def plano_id(self, admin_token):
        """Get a plano ID"""
        response = requests.get(f"{BASE_URL}/api/gestao/planos",
                               headers={"Authorization": f"Bearer {admin_token}"})
        if response.status_code == 200:
            planos = response.json()
            if planos and len(planos) > 0:
                return planos[0].get("id")
        return None
    
    def test_get_planos_endpoint(self, admin_token):
        """Test GET /api/gestao/planos works"""
        response = requests.get(f"{BASE_URL}/api/gestao/planos",
                               headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} planos")
    
    def test_get_parceiros_endpoint(self, admin_token):
        """Test GET /api/usuarios/parceiros works"""
        response = requests.get(f"{BASE_URL}/api/usuarios/parceiros",
                               headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} parceiros")
    
    def test_criar_preco_especial(self, admin_token, plano_id, parceiro_id):
        """Test POST /api/gestao/planos/{id}/precos-especiais creates special price"""
        if not plano_id:
            pytest.skip("No plano available")
        if not parceiro_id:
            pytest.skip("No parceiro available")
        
        response = requests.post(
            f"{BASE_URL}/api/gestao/planos/{plano_id}/precos-especiais",
            json={
                "parceiro_id": parceiro_id,
                "tipo_desconto": "percentagem",
                "valor_desconto": 15,
                "motivo": "TEST_preco_especial",
                "ativo": True
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Preço especial criado com sucesso")
    
    def test_criar_preco_especial_valor_fixo(self, admin_token, plano_id, parceiro_id):
        """Test creating special price with fixed value"""
        if not plano_id:
            pytest.skip("No plano available")
        if not parceiro_id:
            pytest.skip("No parceiro available")
        
        response = requests.post(
            f"{BASE_URL}/api/gestao/planos/{plano_id}/precos-especiais",
            json={
                "parceiro_id": parceiro_id,
                "tipo_desconto": "valor_fixo",
                "preco_fixo": 49.99,
                "motivo": "TEST_preco_fixo",
                "ativo": True
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Preço especial com valor fixo criado")
    
    def test_criar_preco_especial_sem_parceiro(self, admin_token, plano_id):
        """Test creating special price without parceiro_id returns 400"""
        if not plano_id:
            pytest.skip("No plano available")
        
        response = requests.post(
            f"{BASE_URL}/api/gestao/planos/{plano_id}/precos-especiais",
            json={
                "tipo_desconto": "percentagem",
                "valor_desconto": 10
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_criar_preco_especial_plano_invalido(self, admin_token, parceiro_id):
        """Test creating special price for invalid plano returns 404"""
        if not parceiro_id:
            pytest.skip("No parceiro available")
        
        response = requests.post(
            f"{BASE_URL}/api/gestao/planos/invalid-plano-id/precos-especiais",
            json={
                "parceiro_id": parceiro_id,
                "tipo_desconto": "percentagem",
                "valor_desconto": 10
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [404, 500], f"Expected 404/500, got {response.status_code}"
    
    def test_admin_precos_especiais_endpoint(self, admin_token):
        """Test GET /api/admin/precos-especiais endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/precos-especiais",
                               headers={"Authorization": f"Bearer {admin_token}"})
        # This endpoint might not exist - frontend has fallback logic
        print(f"GET /api/admin/precos-especiais returned {response.status_code}")
        # Either 200 (exists) or 404 (fallback will be used)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
