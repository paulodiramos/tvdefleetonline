"""
Tests for Gestão de Planos TVDE - Iteration 33
Features tested:
1. Downgrade de plano (solicitar, verificar, cancelar)
2. Módulos adicionais com 3 tipos de cobrança
3. Cálculo avançado de preços (veículos + motoristas)
4. Módulo de Histórico para recursos desativados
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "admin123"


class TestGestaoPlanosDonwgradeModulos:
    """Tests for plan management - downgrade, modules, and price calculation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        
    def authenticate(self):
        """Authenticate and get token"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return True
        return False

    # ==================== BASIC API TESTS ====================
    
    def test_01_authentication(self):
        """Test authentication with admin credentials"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "No token in response"
        print(f"PASS: Authentication successful")
        
    def test_02_get_public_planos(self):
        """Test GET /api/gestao-planos/planos/public"""
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/planos/public?tipo_usuario=parceiro"
        )
        assert response.status_code == 200, f"Failed to get planos: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: Got {len(data)} planos")
        return data

    def test_03_get_modulos(self):
        """Test GET /api/gestao-planos/modulos - requires auth"""
        assert self.authenticate(), "Failed to authenticate"
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/modulos?tipo_usuario=parceiro"
        )
        assert response.status_code == 200, f"Failed to get modulos: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: Got {len(data)} modulos")

    # ==================== DOWNGRADE TESTS ====================
    
    def test_10_downgrade_agendado_without_subscription(self):
        """Test GET /api/gestao-planos/subscricoes/downgrade-agendado"""
        assert self.authenticate(), "Failed to authenticate"
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/subscricoes/downgrade-agendado"
        )
        # Should return 200 even without subscription (null response)
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"PASS: Downgrade agendado endpoint works, response: {response.json()}")

    def test_11_solicitar_downgrade_without_subscription(self):
        """Test POST /api/gestao-planos/subscricoes/solicitar-downgrade without active subscription"""
        assert self.authenticate(), "Failed to authenticate"
        
        # Get a plan to downgrade to
        planos = self.test_02_get_public_planos()
        if not planos:
            pytest.skip("No planos available")
            
        plano_id = planos[0].get("id")
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/subscricoes/solicitar-downgrade",
            json={"plano_novo_id": plano_id, "motivo": "Test downgrade"}
        )
        # Expected: 404 since admin user likely has no active subscription
        # Or could be 400 if validation catches it differently
        assert response.status_code in [404, 400, 403], f"Unexpected status: {response.status_code}, {response.text}"
        print(f"PASS: Downgrade correctly requires active subscription, status: {response.status_code}")

    def test_12_cancelar_downgrade_without_scheduled(self):
        """Test DELETE /api/gestao-planos/subscricoes/cancelar-downgrade without scheduled downgrade"""
        assert self.authenticate(), "Failed to authenticate"
        
        response = self.session.delete(
            f"{BASE_URL}/api/gestao-planos/subscricoes/cancelar-downgrade"
        )
        # Expected: 404 since no downgrade is scheduled
        assert response.status_code == 404, f"Unexpected status: {response.status_code}, {response.text}"
        data = response.json()
        assert "detail" in data, "Error response should have detail"
        print(f"PASS: Cancel downgrade correctly handles no scheduled downgrade")

    # ==================== PRICE CALCULATION TESTS ====================
    
    def test_20_calcular_preco_avancado_basic(self):
        """Test POST /api/gestao-planos/calcular-preco-avancado with basic request"""
        assert self.authenticate(), "Failed to authenticate"
        
        # Get a plan to calculate price
        planos = self.test_02_get_public_planos()
        if not planos:
            pytest.skip("No planos available")
        
        plano_id = planos[0].get("id")
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/calcular-preco-avancado",
            json={
                "plano_id": plano_id,
                "num_veiculos": 5,
                "num_motoristas": 3,
                "periodicidade": "mensal",
                "modulos_adicionais": []
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "plano" in data, "Response should have 'plano'"
        assert "recursos" in data, "Response should have 'recursos'"
        assert "custos" in data, "Response should have 'custos'"
        assert "totais" in data, "Response should have 'totais'"
        
        # Validate data values
        assert data["recursos"]["veiculos"] == 5, "Should show 5 vehicles"
        assert data["recursos"]["motoristas"] == 3, "Should show 3 drivers"
        assert data["periodicidade"] == "mensal", "Should be mensal"
        
        print(f"PASS: Price calculation working. Total: €{data['totais']['recorrente']}")
        return data

    def test_21_calcular_preco_avancado_anual(self):
        """Test price calculation with annual periodicity"""
        assert self.authenticate(), "Failed to authenticate"
        
        planos = self.test_02_get_public_planos()
        if not planos:
            pytest.skip("No planos available")
        
        plano_id = planos[0].get("id")
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/calcular-preco-avancado",
            json={
                "plano_id": plano_id,
                "num_veiculos": 10,
                "num_motoristas": 8,
                "periodicidade": "anual",
                "modulos_adicionais": []
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["periodicidade"] == "anual", "Should be anual"
        
        print(f"PASS: Annual price calculation working. Total: €{data['totais']['recorrente']}")

    def test_22_calcular_preco_avancado_with_modules(self):
        """Test price calculation with additional modules"""
        assert self.authenticate(), "Failed to authenticate"
        
        planos = self.test_02_get_public_planos()
        modulos = self.test_03_get_modulos()
        
        if not planos:
            pytest.skip("No planos available")
        
        plano_id = planos[0].get("id")
        
        # Prepare modules if available
        modulos_request = []
        if modulos and len(modulos) > 0:
            modulo = modulos[0]
            modulos_request.append({
                "modulo_id": modulo.get("id") or modulo.get("codigo"),
                "tipo_cobranca": "preco_unico",
                "num_veiculos": 5,
                "num_motoristas": 3
            })
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/calcular-preco-avancado",
            json={
                "plano_id": plano_id,
                "num_veiculos": 5,
                "num_motoristas": 3,
                "periodicidade": "mensal",
                "modulos_adicionais": modulos_request
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check structure
        assert "custos" in data, "Should have custos"
        assert "modulos_adicionais" in data["custos"], "Should have modulos_adicionais in custos"
        
        print(f"PASS: Price calculation with modules working. Total modules cost: €{data['custos']['total_modulos']}")

    def test_23_calcular_preco_invalid_plano(self):
        """Test price calculation with invalid plan ID"""
        assert self.authenticate(), "Failed to authenticate"
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/calcular-preco-avancado",
            json={
                "plano_id": "invalid-plan-id-12345",
                "num_veiculos": 1,
                "num_motoristas": 1,
                "periodicidade": "mensal",
                "modulos_adicionais": []
            }
        )
        assert response.status_code == 404, f"Should return 404 for invalid plan: {response.status_code}"
        print(f"PASS: Price calculation correctly rejects invalid plan")

    # ==================== MÓDULO HISTÓRICO TESTS ====================
    
    def test_30_modulo_historico_status(self):
        """Test GET /api/gestao-planos/modulo-historico/status"""
        assert self.authenticate(), "Failed to authenticate"
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/modulo-historico/status"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate structure
        assert "modulo_ativo" in data, "Should have modulo_ativo"
        assert "veiculos_inativos" in data, "Should have veiculos_inativos"
        assert "motoristas_inativos" in data, "Should have motoristas_inativos"
        assert "precos" in data, "Should have precos"
        assert "custo_mensal_estimado" in data, "Should have custo_mensal_estimado"
        
        # Validate data types
        assert isinstance(data["modulo_ativo"], bool), "modulo_ativo should be boolean"
        assert isinstance(data["veiculos_inativos"], int), "veiculos_inativos should be int"
        assert isinstance(data["motoristas_inativos"], int), "motoristas_inativos should be int"
        
        print(f"PASS: Histórico status - Ativo: {data['modulo_ativo']}, Veículos inativos: {data['veiculos_inativos']}, Motoristas inativos: {data['motoristas_inativos']}")
        return data

    # ==================== RECURSOS INATIVOS TESTS ====================
    
    def test_40_listar_recursos_inativos(self):
        """Test GET /api/gestao-planos/recursos/inativos"""
        assert self.authenticate(), "Failed to authenticate"
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/recursos/inativos"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate structure
        assert "veiculos_inativos" in data, "Should have veiculos_inativos"
        assert "motoristas_inativos" in data, "Should have motoristas_inativos"
        assert "totais" in data, "Should have totais"
        
        # Validate totais
        assert "veiculos" in data["totais"], "totais should have veiculos"
        assert "motoristas" in data["totais"], "totais should have motoristas"
        
        print(f"PASS: Recursos inativos - {data['totais']['veiculos']} veículos, {data['totais']['motoristas']} motoristas")
        return data

    # ==================== MÓDULOS ADICIONAIS TESTS ====================
    
    def test_50_listar_modulos_adicionais(self):
        """Test GET /api/gestao-planos/subscricoes/modulos-adicionais"""
        assert self.authenticate(), "Failed to authenticate"
        
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/subscricoes/modulos-adicionais"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: Got {len(data)} módulos adicionais")

    def test_51_adicionar_modulo_sem_subscricao(self):
        """Test adding additional module without subscription"""
        assert self.authenticate(), "Failed to authenticate"
        
        modulos = self.test_03_get_modulos()
        if not modulos:
            pytest.skip("No modules available")
        
        modulo = modulos[0]
        modulo_id = modulo.get("id") or modulo.get("codigo")
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/subscricoes/adicionar-modulo",
            json={
                "modulo_id": modulo_id,
                "tipo_cobranca": "preco_unico",
                "periodicidade": "mensal"
            }
        )
        # Expected: 404 since no subscription
        assert response.status_code in [404, 400, 403], f"Unexpected status: {response.status_code}"
        print(f"PASS: Adding module correctly requires subscription, status: {response.status_code}")

    # ==================== ATIVAR MÓDULO HISTÓRICO ====================
    
    def test_60_ativar_modulo_historico_sem_subscricao(self):
        """Test POST /api/gestao-planos/modulo-historico/ativar without subscription"""
        assert self.authenticate(), "Failed to authenticate"
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/modulo-historico/ativar"
        )
        # Expected: 404 since no subscription
        assert response.status_code in [404, 400], f"Unexpected: {response.status_code}, {response.text}"
        print(f"PASS: Ativar módulo histórico correctly requires subscription")


class TestPriceCalculationEdgeCases:
    """Edge case tests for price calculation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def authenticate(self):
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return True
        return False
    
    def get_first_plan_id(self):
        response = self.session.get(
            f"{BASE_URL}/api/gestao-planos/planos/public?tipo_usuario=parceiro"
        )
        if response.status_code == 200:
            planos = response.json()
            if planos:
                return planos[0].get("id")
        return None

    def test_price_with_zero_vehicles(self):
        """Test price calculation with zero vehicles"""
        assert self.authenticate(), "Failed to authenticate"
        plano_id = self.get_first_plan_id()
        if not plano_id:
            pytest.skip("No plans available")
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/calcular-preco-avancado",
            json={
                "plano_id": plano_id,
                "num_veiculos": 0,
                "num_motoristas": 0,
                "periodicidade": "mensal",
                "modulos_adicionais": []
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should calculate with 0 vehicles and motorists
        assert data["recursos"]["veiculos"] == 0, "Should allow 0 vehicles"
        assert data["recursos"]["motoristas"] == 0, "Should allow 0 drivers"
        print(f"PASS: Price calculation works with 0 resources. Total: €{data['totais']['recorrente']}")

    def test_price_with_large_numbers(self):
        """Test price calculation with large resource numbers"""
        assert self.authenticate(), "Failed to authenticate"
        plano_id = self.get_first_plan_id()
        if not plano_id:
            pytest.skip("No plans available")
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/calcular-preco-avancado",
            json={
                "plano_id": plano_id,
                "num_veiculos": 1000,
                "num_motoristas": 500,
                "periodicidade": "mensal",
                "modulos_adicionais": []
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["recursos"]["veiculos"] == 1000, "Should handle 1000 vehicles"
        print(f"PASS: Price calculation works with large numbers. Total: €{data['totais']['recorrente']}")

    def test_price_semanal_periodicidade(self):
        """Test price calculation with weekly periodicity"""
        assert self.authenticate(), "Failed to authenticate"
        plano_id = self.get_first_plan_id()
        if not plano_id:
            pytest.skip("No plans available")
        
        response = self.session.post(
            f"{BASE_URL}/api/gestao-planos/calcular-preco-avancado",
            json={
                "plano_id": plano_id,
                "num_veiculos": 3,
                "num_motoristas": 2,
                "periodicidade": "semanal",
                "modulos_adicionais": []
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["periodicidade"] == "semanal", "Should be semanal"
        print(f"PASS: Weekly price calculation working. Total: €{data['totais']['recorrente']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
