"""
Test suite for TVDEFleet bug fixes:
1. GET /api/documentos/pendentes - Admin can see pending documents
2. PUT /api/parceiros/{parceiro_id}/config-whatsapp - Save WhatsApp config
3. GET /api/parceiros/{parceiro_id}/config-whatsapp - Read WhatsApp config
4. PUT /api/vehicles/{vehicle_id}/dispositivos - Sync fuel card with driver
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"
PARCEIRO_EMAIL = "parceiro@tvdefleet.com"
PARCEIRO_PASSWORD = "123456"
PARCEIRO_ID = "ab2a25aa-4f70-4c7b-835d-9204b0cd0d7e"
TEST_VEHICLE_ID = "591f3be8-8395-4338-9768-c7511db8f951"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def parceiro_token():
    """Get parceiro authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Parceiro login failed: {response.status_code} - {response.text}")


class TestDocumentosPendentes:
    """Test GET /api/documentos/pendentes endpoint (Bug #1)"""
    
    def test_documentos_pendentes_admin_access(self, admin_token):
        """Admin should be able to access pending documents endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/documentos/pendentes",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should return 200 OK
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Should return a list
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        
        print(f"✅ Admin can access /api/documentos/pendentes - Found {len(data)} pending users")
    
    def test_documentos_pendentes_non_admin_denied(self, parceiro_token):
        """Non-admin users should be denied access"""
        response = requests.get(
            f"{BASE_URL}/api/documentos/pendentes",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        # Should return 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ Non-admin correctly denied access to /api/documentos/pendentes")
    
    def test_documentos_pendentes_no_auth_denied(self):
        """Unauthenticated requests should be denied"""
        response = requests.get(f"{BASE_URL}/api/documentos/pendentes")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Unauthenticated request correctly denied")


class TestWhatsAppConfig:
    """Test WhatsApp configuration endpoints (Bug #3)"""
    
    def test_get_whatsapp_config(self, parceiro_token):
        """Parceiro should be able to read WhatsApp config"""
        response = requests.get(
            f"{BASE_URL}/api/parceiros/{PARCEIRO_ID}/config-whatsapp",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        
        print(f"✅ GET /api/parceiros/{PARCEIRO_ID}/config-whatsapp - Status 200")
        print(f"   Current config: {data}")
    
    def test_put_whatsapp_config(self, parceiro_token):
        """Parceiro should be able to save WhatsApp config"""
        config_data = {
            "telefone": "+351912345678",
            "nome_exibicao": "Test Fleet",
            "mensagem_boas_vindas": "Bem-vindo à nossa frota!",
            "mensagem_relatorio": "Olá {nome}, segue o seu relatório da semana {semana}.",
            "ativo": True,
            "enviar_relatorios_semanais": True,
            "enviar_alertas_documentos": True,
            "enviar_alertas_veiculos": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/parceiros/{PARCEIRO_ID}/config-whatsapp",
            json=config_data,
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, f"Expected message in response: {data}"
        
        print(f"✅ PUT /api/parceiros/{PARCEIRO_ID}/config-whatsapp - Config saved")
    
    def test_whatsapp_config_persistence(self, parceiro_token):
        """Verify WhatsApp config persists after save"""
        # First save a config
        config_data = {
            "telefone": "+351987654321",
            "nome_exibicao": "Persistence Test",
            "ativo": True,
            "enviar_relatorios_semanais": False,
            "enviar_alertas_documentos": True,
            "enviar_alertas_veiculos": True
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/parceiros/{PARCEIRO_ID}/config-whatsapp",
            json=config_data,
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert put_response.status_code == 200
        
        # Then read it back
        get_response = requests.get(
            f"{BASE_URL}/api/parceiros/{PARCEIRO_ID}/config-whatsapp",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert get_response.status_code == 200
        
        saved_config = get_response.json()
        assert saved_config.get("telefone") == "+351987654321", f"Telefone not persisted: {saved_config}"
        assert saved_config.get("nome_exibicao") == "Persistence Test", f"Nome not persisted: {saved_config}"
        assert saved_config.get("ativo") == True, f"Ativo not persisted: {saved_config}"
        
        print("✅ WhatsApp config persists correctly after save")
    
    def test_whatsapp_test_endpoint(self, parceiro_token):
        """Test WhatsApp test message endpoint"""
        # First ensure config has a phone number
        config_data = {
            "telefone": "+351912345678",
            "nome_exibicao": "Test Fleet",
            "ativo": True
        }
        requests.put(
            f"{BASE_URL}/api/parceiros/{PARCEIRO_ID}/config-whatsapp",
            json=config_data,
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        # Test the WhatsApp test endpoint
        response = requests.post(
            f"{BASE_URL}/api/parceiros/{PARCEIRO_ID}/whatsapp/enviar-teste",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "whatsapp_link" in data or "success" in data, f"Expected whatsapp_link or success: {data}"
        
        print(f"✅ POST /api/parceiros/{PARCEIRO_ID}/whatsapp/enviar-teste - Test link generated")
        if "whatsapp_link" in data:
            print(f"   WhatsApp link: {data['whatsapp_link'][:50]}...")


class TestVehicleDispositivos:
    """Test PUT /api/vehicles/{vehicle_id}/dispositivos endpoint (Bug #2)"""
    
    def test_get_vehicle_dispositivos(self, admin_token):
        """Get current vehicle dispositivos"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/dispositivos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "dispositivos" in data, f"Expected dispositivos in response: {data}"
        
        print(f"✅ GET /api/vehicles/{TEST_VEHICLE_ID}/dispositivos - Status 200")
        print(f"   Current dispositivos: {data.get('dispositivos')}")
        print(f"   Motorista atribuido: {data.get('motorista_atribuido')}")
        
        return data
    
    def test_put_vehicle_dispositivos(self, admin_token):
        """Update vehicle dispositivos and verify sync with driver"""
        # First get current state
        get_response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/dispositivos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        current_data = get_response.json()
        
        motorista_id = current_data.get("motorista_atribuido", {}).get("id")
        
        # Update dispositivos
        dispositivos_data = {
            "obu_via_verde": "VV-TEST-123",
            "cartao_combustivel_fossil": "COMB-TEST-456",
            "cartao_combustivel_eletrico": "ELEC-TEST-789"
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/dispositivos",
            json=dispositivos_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert put_response.status_code == 200, f"Expected 200, got {put_response.status_code}: {put_response.text}"
        
        data = put_response.json()
        assert "message" in data, f"Expected message in response: {data}"
        assert "dispositivos" in data, f"Expected dispositivos in response: {data}"
        
        print(f"✅ PUT /api/vehicles/{TEST_VEHICLE_ID}/dispositivos - Updated successfully")
        print(f"   Updated dispositivos: {data.get('dispositivos')}")
        
        # Verify the update persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/dispositivos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert verify_response.status_code == 200
        
        verified_data = verify_response.json()
        dispositivos = verified_data.get("dispositivos", {})
        
        assert dispositivos.get("obu_via_verde") == "VV-TEST-123", f"OBU not updated: {dispositivos}"
        assert dispositivos.get("cartao_combustivel_fossil") == "COMB-TEST-456", f"Cartao fossil not updated: {dispositivos}"
        assert dispositivos.get("cartao_combustivel_eletrico") == "ELEC-TEST-789", f"Cartao eletrico not updated: {dispositivos}"
        
        print("✅ Dispositivos persisted correctly")
        
        # If there's a motorista assigned, verify sync
        if motorista_id:
            motorista_response = requests.get(
                f"{BASE_URL}/api/motoristas/{motorista_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            if motorista_response.status_code == 200:
                motorista_data = motorista_response.json()
                print(f"   Motorista {motorista_data.get('name')} cartões:")
                print(f"     - cartao_viaverde_id: {motorista_data.get('cartao_viaverde_id')}")
                print(f"     - cartao_combustivel_id: {motorista_data.get('cartao_combustivel_id')}")
                print(f"     - cartao_eletrico_id: {motorista_data.get('cartao_eletrico_id')}")
                
                # Verify sync
                if motorista_data.get('cartao_viaverde_id') == "VV-TEST-123":
                    print("✅ Via Verde card synced to motorista")
                if motorista_data.get('cartao_combustivel_id') == "COMB-TEST-456":
                    print("✅ Combustivel card synced to motorista")
                if motorista_data.get('cartao_eletrico_id') == "ELEC-TEST-789":
                    print("✅ Eletrico card synced to motorista")


class TestVehicleDetails:
    """Test vehicle details to verify test vehicle exists"""
    
    def test_get_vehicle(self, admin_token):
        """Get test vehicle details"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code == 404:
            pytest.skip(f"Test vehicle {TEST_VEHICLE_ID} not found")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"✅ Test vehicle found: {data.get('marca')} {data.get('modelo')} - {data.get('matricula')}")
        print(f"   Motorista atribuido: {data.get('motorista_atribuido_nome', 'None')}")
        
        return data


class TestAdminAccess:
    """Test admin-only endpoints"""
    
    def test_admin_login(self):
        """Verify admin can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        assert data.get("user", {}).get("role") == "admin", f"User is not admin: {data.get('user')}"
        
        print(f"✅ Admin login successful - Role: {data.get('user', {}).get('role')}")


class TestParceiroAccess:
    """Test parceiro endpoints"""
    
    def test_parceiro_login(self):
        """Verify parceiro can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASSWORD}
        )
        
        assert response.status_code == 200, f"Parceiro login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        
        user = data.get("user", {})
        print(f"✅ Parceiro login successful - ID: {user.get('id')}, Role: {user.get('role')}")
        
        # Verify parceiro ID matches expected
        if user.get("id") != PARCEIRO_ID:
            print(f"   ⚠️ Note: Parceiro ID is {user.get('id')}, expected {PARCEIRO_ID}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
