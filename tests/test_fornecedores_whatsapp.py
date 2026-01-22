"""
Backend tests for P1 features:
1. Admin Fornecedores (Suppliers) CRUD
2. WhatsApp Business messaging for Parceiros
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fleetconnect-3.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"
PARCEIRO_EMAIL = "parceiro@tvdefleet.com"
PARCEIRO_PASSWORD = "123456"


class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("role") == "admin", "User is not admin"
        print(f"✓ Admin login successful, role: {data['user']['role']}")
        return data["access_token"]
    
    def test_parceiro_login(self):
        """Test parceiro login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("role") == "parceiro", "User is not parceiro"
        print(f"✓ Parceiro login successful, role: {data['user']['role']}")
        return data["access_token"], data["user"]["id"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Admin login failed")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def parceiro_data():
    """Get parceiro token and ID"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": PARCEIRO_EMAIL,
        "password": PARCEIRO_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Parceiro login failed")
    data = response.json()
    return {"token": data["access_token"], "id": data["user"]["id"]}


# ==================== FORNECEDORES TESTS ====================

class TestFornecedoresListar:
    """Test listing fornecedores"""
    
    def test_listar_fornecedores_admin(self, admin_token):
        """Admin can list all fornecedores"""
        response = requests.get(
            f"{BASE_URL}/api/fornecedores",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to list fornecedores: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Listed {len(data)} fornecedores")
        return data
    
    def test_listar_fornecedores_parceiro(self, parceiro_data):
        """Parceiro can list fornecedores"""
        response = requests.get(
            f"{BASE_URL}/api/fornecedores",
            headers={"Authorization": f"Bearer {parceiro_data['token']}"}
        )
        assert response.status_code == 200, f"Failed to list fornecedores: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Parceiro listed {len(data)} fornecedores")
    
    def test_listar_fornecedores_no_auth(self):
        """Unauthenticated request should fail"""
        response = requests.get(f"{BASE_URL}/api/fornecedores")
        assert response.status_code in [401, 403], "Should require authentication"
        print(f"✓ Unauthenticated request correctly rejected with {response.status_code}")


class TestFornecedoresCRUD:
    """Test CRUD operations for fornecedores"""
    
    created_fornecedor_id = None
    
    def test_criar_fornecedor_admin(self, admin_token):
        """Admin can create a fornecedor"""
        payload = {
            "nome": "TEST_Fornecedor Teste",
            "tipo": "combustivel_fossil",
            "descricao": "Fornecedor criado para testes",
            "contacto_email": "teste@fornecedor.pt",
            "contacto_telefone": "+351912345678",
            "website": "https://teste.pt",
            "ativo": True
        }
        response = requests.post(
            f"{BASE_URL}/api/fornecedores",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to create fornecedor: {response.text}"
        data = response.json()
        assert "id" in data, "No ID in response"
        TestFornecedoresCRUD.created_fornecedor_id = data["id"]
        print(f"✓ Created fornecedor with ID: {data['id']}")
        
        # Verify creation by GET
        get_response = requests.get(
            f"{BASE_URL}/api/fornecedores/{data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200, "Failed to get created fornecedor"
        fornecedor = get_response.json()
        assert fornecedor["nome"] == payload["nome"], "Nome doesn't match"
        assert fornecedor["tipo"] == payload["tipo"], "Tipo doesn't match"
        print(f"✓ Verified fornecedor creation: {fornecedor['nome']}")
    
    def test_criar_fornecedor_parceiro_forbidden(self, parceiro_data):
        """Parceiro cannot create fornecedor"""
        payload = {
            "nome": "TEST_Fornecedor Parceiro",
            "tipo": "gps",
            "ativo": True
        }
        response = requests.post(
            f"{BASE_URL}/api/fornecedores",
            json=payload,
            headers={"Authorization": f"Bearer {parceiro_data['token']}"}
        )
        assert response.status_code == 403, f"Parceiro should not be able to create fornecedor: {response.status_code}"
        print("✓ Parceiro correctly forbidden from creating fornecedor")
    
    def test_atualizar_fornecedor_admin(self, admin_token):
        """Admin can update a fornecedor"""
        if not TestFornecedoresCRUD.created_fornecedor_id:
            pytest.skip("No fornecedor created")
        
        payload = {
            "nome": "TEST_Fornecedor Atualizado",
            "descricao": "Descrição atualizada"
        }
        response = requests.put(
            f"{BASE_URL}/api/fornecedores/{TestFornecedoresCRUD.created_fornecedor_id}",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to update fornecedor: {response.text}"
        print("✓ Updated fornecedor successfully")
        
        # Verify update by GET
        get_response = requests.get(
            f"{BASE_URL}/api/fornecedores/{TestFornecedoresCRUD.created_fornecedor_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        fornecedor = get_response.json()
        assert fornecedor["nome"] == payload["nome"], "Nome not updated"
        assert fornecedor["descricao"] == payload["descricao"], "Descricao not updated"
        print(f"✓ Verified fornecedor update: {fornecedor['nome']}")
    
    def test_eliminar_fornecedor_admin(self, admin_token):
        """Admin can delete a fornecedor"""
        if not TestFornecedoresCRUD.created_fornecedor_id:
            pytest.skip("No fornecedor created")
        
        response = requests.delete(
            f"{BASE_URL}/api/fornecedores/{TestFornecedoresCRUD.created_fornecedor_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to delete fornecedor: {response.text}"
        print("✓ Deleted fornecedor successfully")
        
        # Verify deletion by GET (should return 404)
        get_response = requests.get(
            f"{BASE_URL}/api/fornecedores/{TestFornecedoresCRUD.created_fornecedor_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 404, "Fornecedor should not exist after deletion"
        print("✓ Verified fornecedor deletion (404)")


class TestFornecedoresTipos:
    """Test fornecedores tipos endpoint"""
    
    def test_listar_tipos(self, admin_token):
        """List available fornecedor types"""
        response = requests.get(
            f"{BASE_URL}/api/fornecedores/tipos/lista",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to list tipos: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one tipo"
        
        # Check expected tipos
        tipo_ids = [t["id"] for t in data]
        expected_tipos = ["combustivel_fossil", "combustivel_eletrico", "gps", "seguros"]
        for tipo in expected_tipos:
            assert tipo in tipo_ids, f"Missing tipo: {tipo}"
        
        print(f"✓ Listed {len(data)} tipos: {tipo_ids}")


class TestFornecedoresSeed:
    """Test seed fornecedores endpoint"""
    
    def test_seed_fornecedores_admin(self, admin_token):
        """Admin can seed default fornecedores"""
        response = requests.post(
            f"{BASE_URL}/api/admin/seed-fornecedores",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to seed fornecedores: {response.text}"
        data = response.json()
        assert "message" in data, "No message in response"
        print(f"✓ Seed response: {data['message']}")


# ==================== WHATSAPP TESTS ====================

class TestWhatsAppConfig:
    """Test WhatsApp configuration endpoints"""
    
    def test_get_whatsapp_config(self, parceiro_data):
        """Parceiro can get WhatsApp config"""
        response = requests.get(
            f"{BASE_URL}/api/parceiros/{parceiro_data['id']}/config-whatsapp",
            headers={"Authorization": f"Bearer {parceiro_data['token']}"}
        )
        assert response.status_code == 200, f"Failed to get WhatsApp config: {response.text}"
        data = response.json()
        print(f"✓ WhatsApp config retrieved: ativo={data.get('ativo', False)}")


class TestWhatsAppHistorico:
    """Test WhatsApp history endpoint"""
    
    def test_get_whatsapp_historico(self, parceiro_data):
        """Parceiro can get WhatsApp message history"""
        response = requests.get(
            f"{BASE_URL}/api/parceiros/{parceiro_data['id']}/whatsapp-historico",
            headers={"Authorization": f"Bearer {parceiro_data['token']}"}
        )
        assert response.status_code == 200, f"Failed to get WhatsApp historico: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ WhatsApp historico retrieved: {len(data)} messages")


class TestWhatsAppEnvio:
    """Test WhatsApp sending endpoint"""
    
    def test_get_motoristas_with_phone(self, parceiro_data):
        """Get motoristas with phone/WhatsApp"""
        response = requests.get(
            f"{BASE_URL}/api/motoristas",
            headers={"Authorization": f"Bearer {parceiro_data['token']}"}
        )
        assert response.status_code == 200, f"Failed to get motoristas: {response.text}"
        data = response.json()
        
        # Filter motoristas with phone
        motoristas_com_telefone = [m for m in data if m.get("whatsapp") or m.get("phone")]
        print(f"✓ Found {len(motoristas_com_telefone)} motoristas with phone/WhatsApp")
        
        if motoristas_com_telefone:
            print(f"  First motorista: {motoristas_com_telefone[0].get('name')} - {motoristas_com_telefone[0].get('whatsapp') or motoristas_com_telefone[0].get('phone')}")
        
        return motoristas_com_telefone
    
    def test_enviar_whatsapp_motoristas(self, parceiro_data):
        """Test sending WhatsApp to motoristas"""
        # First get motoristas with phone
        response = requests.get(
            f"{BASE_URL}/api/motoristas",
            headers={"Authorization": f"Bearer {parceiro_data['token']}"}
        )
        motoristas = response.json()
        motoristas_com_telefone = [m for m in motoristas if m.get("whatsapp") or m.get("phone")]
        
        if not motoristas_com_telefone:
            pytest.skip("No motoristas with phone/WhatsApp")
        
        # Send WhatsApp to first motorista
        motorista_id = motoristas_com_telefone[0]["id"]
        payload = {
            "motorista_ids": [motorista_id],
            "mensagem": "TEST_Mensagem de teste do sistema TVDEFleet",
            "template_id": "personalizado"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/parceiros/{parceiro_data['id']}/whatsapp/enviar-motoristas",
            json=payload,
            headers={"Authorization": f"Bearer {parceiro_data['token']}"}
        )
        assert response.status_code == 200, f"Failed to send WhatsApp: {response.text}"
        data = response.json()
        
        assert "resultados" in data, "No resultados in response"
        assert len(data["resultados"]) > 0, "No results returned"
        
        result = data["resultados"][0]
        print(f"✓ WhatsApp send result: success={result.get('success')}, mode={result.get('mode', 'N/A')}")
        
        # Check if link was generated (fallback mode)
        if result.get("link"):
            print(f"  Link generated: {result['link'][:50]}...")
    
    def test_enviar_whatsapp_no_motoristas(self, parceiro_data):
        """Test sending WhatsApp with empty motorista list"""
        payload = {
            "motorista_ids": [],
            "mensagem": "TEST_Mensagem vazia",
            "template_id": "personalizado"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/parceiros/{parceiro_data['id']}/whatsapp/enviar-motoristas",
            json=payload,
            headers={"Authorization": f"Bearer {parceiro_data['token']}"}
        )
        # Should return 200 with empty results or 422 validation error
        assert response.status_code in [200, 422], f"Unexpected status: {response.status_code}"
        print(f"✓ Empty motorista list handled correctly: {response.status_code}")


# ==================== CLEANUP ====================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_fornecedores(self, admin_token):
        """Delete any TEST_ prefixed fornecedores"""
        response = requests.get(
            f"{BASE_URL}/api/fornecedores",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code != 200:
            return
        
        fornecedores = response.json()
        test_fornecedores = [f for f in fornecedores if f.get("nome", "").startswith("TEST_")]
        
        for f in test_fornecedores:
            requests.delete(
                f"{BASE_URL}/api/fornecedores/{f['id']}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            print(f"  Deleted test fornecedor: {f['nome']}")
        
        print(f"✓ Cleaned up {len(test_fornecedores)} test fornecedores")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
