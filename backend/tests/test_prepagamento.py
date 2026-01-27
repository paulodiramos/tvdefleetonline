"""
Test Suite for Prepagamento (Pre-Payment Pro-Rata) System
Tests the complete flow of adding vehicles/drivers with payment blocking
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


class TestPrepagamentoAuth:
    """Test authentication for prepagamento endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_admin_login(self, admin_token):
        """Test admin can login"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print(f"✓ Admin login successful, token length: {len(admin_token)}")
    
    def test_parceiro_login(self, parceiro_token):
        """Test parceiro can login"""
        assert parceiro_token is not None
        assert len(parceiro_token) > 0
        print(f"✓ Parceiro login successful, token length: {len(parceiro_token)}")


class TestPrepagamentoMeusPedidos:
    """Test /api/prepagamento/meus-pedidos endpoint"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_meus_pedidos_returns_list(self, parceiro_token):
        """Test that meus-pedidos returns a list of orders"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(f"{BASE_URL}/api/prepagamento/meus-pedidos", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "pedidos" in data, "Response should contain 'pedidos' key"
        assert isinstance(data["pedidos"], list), "pedidos should be a list"
        print(f"✓ meus-pedidos returned {len(data['pedidos'])} orders")
    
    def test_meus_pedidos_apenas_pendentes(self, parceiro_token):
        """Test filtering only pending orders"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/prepagamento/meus-pedidos?apenas_pendentes=true", 
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "pedidos" in data
        
        # All returned orders should be pending
        for pedido in data["pedidos"]:
            assert pedido["status"] in ["pendente_pagamento", "pagamento_iniciado"], \
                f"Expected pending status, got {pedido['status']}"
        
        print(f"✓ meus-pedidos (apenas_pendentes) returned {len(data['pedidos'])} pending orders")


class TestPrepagamentoAdminEndpoints:
    """Test admin-only prepagamento endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_admin_pedidos_pendentes(self, admin_token):
        """Test admin can list all pending orders"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/prepagamento/admin/pedidos-pendentes", 
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "pedidos" in data
        assert "total" in data
        assert isinstance(data["pedidos"], list)
        print(f"✓ Admin pedidos-pendentes returned {data['total']} pending orders")
    
    def test_parceiro_cannot_access_admin_endpoint(self, parceiro_token):
        """Test parceiro cannot access admin-only endpoint"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/prepagamento/admin/pedidos-pendentes", 
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Parceiro correctly denied access to admin endpoint")
    
    def test_admin_pedidos_user(self, admin_token):
        """Test admin can list orders for a specific user"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/prepagamento/admin/pedidos/user/{PARCEIRO_ID}", 
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "pedidos" in data
        assert data["user_id"] == PARCEIRO_ID
        print(f"✓ Admin can view orders for user {PARCEIRO_ID}: {len(data['pedidos'])} orders")


class TestPrepagamentoSolicitarAdicao:
    """Test solicitar-adicao endpoint (create new order)"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_solicitar_adicao_validation_zero_values(self, parceiro_token):
        """Test that zero values are rejected"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.post(
            f"{BASE_URL}/api/prepagamento/solicitar-adicao",
            json={"veiculos_adicionar": 0, "motoristas_adicionar": 0},
            headers=headers
        )
        
        # Should fail with 400 - must add at least 1 vehicle or driver
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Zero values correctly rejected")
    
    def test_solicitar_adicao_validation_negative_values(self, parceiro_token):
        """Test that negative values are rejected"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.post(
            f"{BASE_URL}/api/prepagamento/solicitar-adicao",
            json={"veiculos_adicionar": -1, "motoristas_adicionar": 0},
            headers=headers
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Negative values correctly rejected")


class TestPrepagamentoVerificarBloqueio:
    """Test verificar-bloqueio endpoint"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_verificar_bloqueio(self, parceiro_token):
        """Test checking if user is blocked from adding resources"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/prepagamento/verificar-bloqueio",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "bloqueado" in data, "Response should contain 'bloqueado' key"
        assert "pedidos_pendentes" in data, "Response should contain 'pedidos_pendentes' key"
        assert "mensagem" in data, "Response should contain 'mensagem' key"
        assert isinstance(data["bloqueado"], bool)
        
        print(f"✓ verificar-bloqueio: bloqueado={data['bloqueado']}, pending={len(data['pedidos_pendentes'])}")


class TestPrepagamentoFullFlow:
    """Test complete prepagamento flow: create order -> check blocking -> admin confirm"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_flow_check_existing_pending_orders(self, parceiro_token, admin_token):
        """Check and cancel any existing pending orders before testing flow"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        # Get pending orders
        response = requests.get(
            f"{BASE_URL}/api/prepagamento/meus-pedidos?apenas_pendentes=true",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        pending_count = len(data["pedidos"])
        print(f"✓ Found {pending_count} existing pending orders")
        
        # If there are pending orders, we can test the blocking mechanism
        if pending_count > 0:
            # Try to create another order - should fail due to blocking
            response = requests.post(
                f"{BASE_URL}/api/prepagamento/solicitar-adicao",
                json={"veiculos_adicionar": 1, "motoristas_adicionar": 0},
                headers=headers
            )
            
            # Should fail with 400 - already has pending order
            assert response.status_code == 400, f"Expected 400 (blocked), got {response.status_code}"
            assert "pendente" in response.json().get("detail", "").lower(), \
                "Error message should mention pending order"
            print("✓ Blocking mechanism works - cannot create new order while pending exists")
            
            # Get the first pending order for confirmation test
            pedido = data["pedidos"][0]
            pedido_id = pedido["id"]
            
            # Test admin can confirm payment
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            response = requests.post(
                f"{BASE_URL}/api/prepagamento/admin/confirmar-pagamento/{pedido_id}",
                headers=admin_headers
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            confirm_data = response.json()
            assert confirm_data.get("sucesso") == True
            print(f"✓ Admin confirmed payment for order {pedido_id}")
            print(f"  - Veículos adicionados: {confirm_data.get('veiculos_adicionados', 0)}")
            print(f"  - Motoristas adicionados: {confirm_data.get('motoristas_adicionados', 0)}")
            print(f"  - Nova mensalidade: €{confirm_data.get('nova_mensalidade', 0):.2f}")
        else:
            print("✓ No pending orders - flow test skipped (create order first via UI)")


class TestPrepagamentoIniciarPagamento:
    """Test iniciar-pagamento endpoint"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_iniciar_pagamento_requires_pedido(self, parceiro_token):
        """Test that iniciar-pagamento requires valid pedido_id"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        # Try with invalid pedido_id
        response = requests.post(
            f"{BASE_URL}/api/prepagamento/iniciar-pagamento?pedido_id=invalid-id&metodo=multibanco",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid pedido_id correctly returns 404")


class TestPrepagamentoCancelarPedido:
    """Test cancelar-pedido endpoint"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_cancelar_pedido_invalid_id(self, parceiro_token):
        """Test canceling with invalid pedido_id"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/prepagamento/cancelar-pedido/invalid-id",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid pedido_id correctly returns 404 for cancel")


class TestPrepagamentoWebhook:
    """Test webhook endpoint for payment confirmation"""
    
    def test_webhook_pagamento_confirmado(self):
        """Test webhook endpoint accepts payment confirmation"""
        # Webhook doesn't require auth (would be called by payment gateway)
        response = requests.post(
            f"{BASE_URL}/api/prepagamento/webhook/pagamento-confirmado",
            params={
                "pedido_id": "test-invalid-id",
                "status": "pago"
            }
        )
        
        # Should return 200 even for invalid pedido (webhook should not fail)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("recebido") == True
        # Should indicate it wasn't processed due to invalid pedido
        assert data.get("processado") == False or "erro" in data
        print("✓ Webhook endpoint responds correctly")
    
    def test_webhook_non_pago_status(self):
        """Test webhook ignores non-pago status"""
        response = requests.post(
            f"{BASE_URL}/api/prepagamento/webhook/pagamento-confirmado",
            params={
                "pedido_id": "test-id",
                "status": "pendente"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("recebido") == True
        assert data.get("processado") == False
        print("✓ Webhook correctly ignores non-pago status")


class TestPrepagamentoSubscricaoIntegration:
    """Test integration with subscription system"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_subscricao_user_endpoint(self, parceiro_token):
        """Test getting user subscription"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/subscricoes/user/{PARCEIRO_ID}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify subscription data structure
        assert "id" in data, "Subscription should have id"
        assert "num_veiculos" in data, "Subscription should have num_veiculos"
        assert "num_motoristas" in data, "Subscription should have num_motoristas"
        
        print(f"✓ User subscription: {data.get('num_veiculos')} vehicles, {data.get('num_motoristas')} drivers")
        print(f"  - Preço final: €{data.get('preco_final', 0):.2f}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
