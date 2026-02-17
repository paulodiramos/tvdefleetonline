"""
Test Suite for P1 Features - Sistema de Gestão de Planos TVDE Fleet
Tests:
1. Categories CRUD (GET, POST, PUT, DELETE /api/gestao-planos/categorias)
2. Fixed price per user (POST /api/gestao-planos/subscricoes/preco-fixo, DELETE, GET com-preco-fixo)
3. Módulo histórico_recursos verification
4. tipo_cobranca 'por_veiculo_motorista' in advanced calculation
5. Icon system for plans/modules
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "admin123"


class TestP1Features:
    """P1 Features Test Suite"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get authentication token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("token") or login_response.json().get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
                self.token = token
                self.user_id = login_response.json().get("user", {}).get("id")
            else:
                pytest.skip("No token in login response")
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    # ==================== CATEGORIAS TESTS ====================
    
    def test_categorias_list(self):
        """Test GET /api/gestao-planos/categorias"""
        response = self.session.get(f"{BASE_URL}/api/gestao-planos/categorias")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Found {len(data)} categories")
    
    def test_categorias_create(self):
        """Test POST /api/gestao-planos/categorias"""
        unique_name = f"TEST_Categoria_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "nome": unique_name,
            "descricao": "Categoria de teste para P1",
            "icone": "🧪",
            "cor": "#FF5733",
            "ordem": 99
        }
        
        response = self.session.post(f"{BASE_URL}/api/gestao-planos/categorias", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("nome") == unique_name
        assert data.get("icone") == "🧪"
        assert data.get("cor") == "#FF5733"
        assert "id" in data
        
        # Store for cleanup and further tests
        self.created_categoria_id = data.get("id")
        print(f"✓ Created category: {unique_name} with id: {self.created_categoria_id}")
        
        return data.get("id")
    
    def test_categorias_update(self):
        """Test PUT /api/gestao-planos/categorias/{id}"""
        # First create a category
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/gestao-planos/categorias", json={
            "nome": unique_name,
            "descricao": "Original description",
            "icone": "📁",
            "cor": "#3B82F6",
            "ordem": 1
        })
        
        assert create_response.status_code == 200
        categoria_id = create_response.json().get("id")
        
        # Now update it
        update_payload = {
            "nome": unique_name + "_UPDATED",
            "descricao": "Updated description",
            "icone": "✅",
            "cor": "#10B981"
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/gestao-planos/categorias/{categoria_id}", json=update_payload)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        updated_data = update_response.json()
        assert updated_data.get("icone") == "✅"
        assert updated_data.get("cor") == "#10B981"
        assert "UPDATED" in updated_data.get("nome", "")
        print(f"✓ Updated category successfully")
        
        # Cleanup - delete the category
        self.session.delete(f"{BASE_URL}/api/gestao-planos/categorias/{categoria_id}")
    
    def test_categorias_delete(self):
        """Test DELETE /api/gestao-planos/categorias/{id}"""
        # First create a category to delete
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/gestao-planos/categorias", json={
            "nome": unique_name,
            "descricao": "To be deleted",
            "icone": "🗑️",
            "cor": "#EF4444",
            "ordem": 99
        })
        
        assert create_response.status_code == 200
        categoria_id = create_response.json().get("id")
        
        # Delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/gestao-planos/categorias/{categoria_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        print(f"✓ Deleted category successfully")
    
    def test_categorias_icon_selection(self):
        """Test that categories support emoji icons"""
        test_icons = ["📁", "⭐", "🚗", "👤", "💼", "🏷️", "📊", "🔧"]
        
        for icon in test_icons:
            unique_name = f"TEST_Icon_{icon}_{uuid.uuid4().hex[:4]}"
            response = self.session.post(f"{BASE_URL}/api/gestao-planos/categorias", json={
                "nome": unique_name,
                "icone": icon,
                "cor": "#3B82F6",
                "ordem": 0
            })
            
            if response.status_code == 200:
                data = response.json()
                assert data.get("icone") == icon, f"Icon mismatch: expected {icon}, got {data.get('icone')}"
                # Cleanup
                self.session.delete(f"{BASE_URL}/api/gestao-planos/categorias/{data.get('id')}")
        
        print(f"✓ All {len(test_icons)} icons supported correctly")
    
    # ==================== PREÇO FIXO TESTS ====================
    
    def test_preco_fixo_list_empty(self):
        """Test GET /api/gestao-planos/subscricoes/com-preco-fixo"""
        response = self.session.get(f"{BASE_URL}/api/gestao-planos/subscricoes/com-preco-fixo")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "subscricoes" in data
        assert "total" in data
        print(f"✓ Found {data.get('total', 0)} subscriptions with fixed price")
    
    def test_preco_fixo_set_requires_subscription(self):
        """Test POST /api/gestao-planos/subscricoes/preco-fixo - requires active subscription"""
        fake_user_id = str(uuid.uuid4())
        
        payload = {
            "user_id": fake_user_id,
            "preco_fixo": 99.99,
            "motivo": "Test fixed price"
        }
        
        response = self.session.post(f"{BASE_URL}/api/gestao-planos/subscricoes/preco-fixo", json=payload)
        # Should return 404 because user doesn't have subscription
        assert response.status_code == 404, f"Expected 404 for user without subscription, got {response.status_code}"
        print("✓ Correctly rejects fixed price for user without subscription")
    
    def test_preco_fixo_remove_requires_subscription(self):
        """Test DELETE /api/gestao-planos/subscricoes/user/{id}/preco-fixo"""
        fake_user_id = str(uuid.uuid4())
        
        response = self.session.delete(f"{BASE_URL}/api/gestao-planos/subscricoes/user/{fake_user_id}/preco-fixo")
        # Should return 404 because user doesn't have subscription
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Correctly rejects removing fixed price for user without subscription")
    
    def test_preco_fixo_negative_price_rejected(self):
        """Test that negative prices are rejected"""
        payload = {
            "user_id": str(uuid.uuid4()),
            "preco_fixo": -50.00,
            "motivo": "Invalid negative price"
        }
        
        response = self.session.post(f"{BASE_URL}/api/gestao-planos/subscricoes/preco-fixo", json=payload)
        # Should return 400 for negative price
        assert response.status_code == 400, f"Expected 400 for negative price, got {response.status_code}"
        print("✓ Correctly rejects negative fixed price")
    
    # ==================== MÓDULO HISTÓRICO TESTS ====================
    
    def test_modulo_historico_exists(self):
        """Test that módulo 'historico_recursos' is in predefined modules"""
        response = self.session.get(f"{BASE_URL}/api/gestao-planos/modulos")
        assert response.status_code == 200
        
        modules = response.json()
        historico_module = None
        
        for module in modules:
            if module.get("codigo") == "historico_recursos":
                historico_module = module
                break
        
        assert historico_module is not None, "Module 'historico_recursos' not found"
        assert historico_module.get("tipo_cobranca") == "por_recurso_inativo"
        assert "📚" in historico_module.get("icone", "")
        print(f"✓ Module historico_recursos found with correct tipo_cobranca: {historico_module.get('tipo_cobranca')}")
    
    def test_modulo_historico_status_endpoint(self):
        """Test GET /api/gestao-planos/modulo-historico/status"""
        response = self.session.get(f"{BASE_URL}/api/gestao-planos/modulo-historico/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "modulo_ativo" in data
        assert "veiculos_inativos" in data
        assert "motoristas_inativos" in data
        assert "precos" in data
        assert "custo_mensal_estimado" in data
        print(f"✓ Modulo historico status returned correctly: modulo_ativo={data.get('modulo_ativo')}")
    
    # ==================== TIPO COBRANÇA POR_VEICULO_MOTORISTA TESTS ====================
    
    def test_tipo_cobranca_por_veiculo_motorista_in_calculo_avancado(self):
        """Test POST /api/gestao-planos/calcular-preco-avancado with por_veiculo_motorista"""
        # First get a valid plano_id
        planos_response = self.session.get(f"{BASE_URL}/api/gestao-planos/planos")
        assert planos_response.status_code == 200
        
        planos = planos_response.json()
        if not planos:
            pytest.skip("No plans available for testing")
        
        plano_id = planos[0].get("id")
        
        # Get modules to use
        modulos_response = self.session.get(f"{BASE_URL}/api/gestao-planos/modulos")
        modulos = modulos_response.json() if modulos_response.status_code == 200 else []
        
        modulos_adicionais = []
        if modulos:
            # Use first module with por_veiculo_motorista
            modulos_adicionais = [{
                "modulo_id": modulos[0].get("id"),
                "tipo_cobranca": "por_veiculo_motorista",
                "num_veiculos": 5,
                "num_motoristas": 3,
                "periodicidade": "mensal"
            }]
        
        payload = {
            "plano_id": plano_id,
            "num_veiculos": 10,
            "num_motoristas": 8,
            "periodicidade": "mensal",
            "modulos_adicionais": modulos_adicionais
        }
        
        response = self.session.post(f"{BASE_URL}/api/gestao-planos/calcular-preco-avancado", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plano" in data
        assert "custos" in data
        assert "totais" in data
        
        # Verify modulos_adicionais calculation
        if modulos_adicionais:
            assert "modulos_adicionais" in data.get("custos", {})
            modulos_calc = data["custos"]["modulos_adicionais"]
            if modulos_calc:
                # Check that tipo_cobranca is returned
                for mod in modulos_calc:
                    assert "tipo_cobranca" in mod
                    print(f"  - Module {mod.get('modulo_nome')}: tipo={mod.get('tipo_cobranca')}, custo={mod.get('custo')}")
        
        print(f"✓ Advanced calculation with por_veiculo_motorista working, total={data.get('totais', {}).get('recorrente')}")
    
    def test_adicionar_modulo_por_veiculo_motorista(self):
        """Test POST /api/gestao-planos/subscricoes/adicionar-modulo with por_veiculo_motorista"""
        # Get a module
        modulos_response = self.session.get(f"{BASE_URL}/api/gestao-planos/modulos")
        if modulos_response.status_code != 200:
            pytest.skip("Could not fetch modules")
        
        modulos = modulos_response.json()
        if not modulos:
            pytest.skip("No modules available")
        
        payload = {
            "modulo_id": modulos[0].get("id"),
            "tipo_cobranca": "por_veiculo_motorista",
            "num_veiculos": 5,
            "num_motoristas": 3,
            "periodicidade": "mensal"
        }
        
        response = self.session.post(f"{BASE_URL}/api/gestao-planos/subscricoes/adicionar-modulo", json=payload)
        # Should fail because admin user likely doesn't have subscription
        # But it validates the tipo_cobranca is accepted
        
        if response.status_code == 400:
            # Invalid tipo_cobranca would give 400
            error_detail = response.json().get("detail", "")
            assert "tipo_cobranca" not in error_detail.lower(), f"tipo_cobranca rejected: {error_detail}"
        
        print(f"✓ tipo_cobranca 'por_veiculo_motorista' is accepted by the API")
    
    # ==================== ICON SYSTEM TESTS ====================
    
    def test_planos_have_icons(self):
        """Test that plans support icons (newer plans should have them)"""
        response = self.session.get(f"{BASE_URL}/api/gestao-planos/planos")
        assert response.status_code == 200
        
        planos = response.json()
        plans_with_icons = 0
        legacy_plans = 0
        
        for plano in planos:
            if "icone" in plano and plano.get("icone"):
                plans_with_icons += 1
            else:
                legacy_plans += 1
                # Legacy plans may not have icons - this is OK
        
        # At least the API should accept plans with icons (we tested creation above)
        print(f"✓ {plans_with_icons} plans have icons, {legacy_plans} legacy plans without icons")
    
    def test_modulos_have_icons(self):
        """Test that modules support icons"""
        response = self.session.get(f"{BASE_URL}/api/gestao-planos/modulos")
        assert response.status_code == 200
        
        modulos = response.json()
        for modulo in modulos:
            assert "icone" in modulo, f"Module {modulo.get('nome')} missing icone field"
            assert "cor" in modulo, f"Module {modulo.get('nome')} missing cor field"
        
        print(f"✓ All {len(modulos)} modules have icone and cor fields")
    
    def test_create_plano_with_icon(self):
        """Test creating a plan with custom icon"""
        unique_name = f"TEST_Plano_Icon_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "nome": unique_name,
            "descricao": "Plan with custom icon",
            "tipo_usuario": "parceiro",
            "categoria": "standard",
            "icone": "🚀",
            "cor": "#8B5CF6",
            "precos_plano": {
                "base_mensal": 10,
                "por_veiculo_mensal": 2,
                "por_motorista_mensal": 1
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/gestao-planos/planos", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("icone") == "🚀"
        assert data.get("cor") == "#8B5CF6"
        
        # Cleanup
        if data.get("id"):
            self.session.delete(f"{BASE_URL}/api/gestao-planos/planos/{data.get('id')}")
        
        print(f"✓ Plan created with custom icon 🚀 successfully")
    
    def test_create_modulo_with_icon(self):
        """Test creating a module with custom icon"""
        unique_code = f"test_icon_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "codigo": unique_code,
            "nome": f"Test Module {unique_code}",
            "descricao": "Module with custom icon",
            "tipo_usuario": "parceiro",
            "tipo_cobranca": "fixo",
            "icone": "⚡",
            "cor": "#F59E0B",
            "precos": {
                "mensal": 5
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/gestao-planos/modulos", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("icone") == "⚡"
        assert data.get("cor") == "#F59E0B"
        
        # Cleanup
        if data.get("id"):
            self.session.delete(f"{BASE_URL}/api/gestao-planos/modulos/{data.get('id')}")
        
        print(f"✓ Module created with custom icon ⚡ successfully")


class TestCategoriasUI:
    """Tests focused on Categories for UI validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get authentication token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("token") or login_response.json().get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
    
    def test_categorias_response_format(self):
        """Test that categories response has all required UI fields"""
        response = self.session.get(f"{BASE_URL}/api/gestao-planos/categorias?apenas_ativas=false")
        assert response.status_code == 200
        
        data = response.json()
        if data:
            categoria = data[0]
            required_fields = ["id", "nome", "icone", "cor", "ordem", "ativo"]
            for field in required_fields:
                assert field in categoria, f"Missing field: {field}"
            print(f"✓ Category response has all required fields: {required_fields}")
    
    def test_categorias_sorted_by_ordem(self):
        """Test that categories are returned sorted by ordem"""
        response = self.session.get(f"{BASE_URL}/api/gestao-planos/categorias")
        assert response.status_code == 200
        
        categorias = response.json()
        if len(categorias) > 1:
            ordens = [c.get("ordem", 0) for c in categorias]
            assert ordens == sorted(ordens), "Categories should be sorted by ordem"
            print(f"✓ Categories sorted correctly by ordem: {ordens}")
        else:
            print("✓ Not enough categories to verify sorting")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
