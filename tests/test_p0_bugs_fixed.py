"""
Test P0 Bugs Fixed - TVDEFleet
Tests for the following P0 bugs that were fixed:
1. Motoristas - erro ao carregar documento (POST /api/motoristas/{id}/documentos/upload)
2. Veículos - upload de foto 'não autorizado' (POST /api/vehicles/{id}/upload-photo)
3. Veículos - erro ao adicionar/excluir evento na agenda (POST/DELETE /api/vehicles/{id}/agenda)
4. Gerar contrato não funciona (POST /api/contratos/gerar)
5. Ver documentos pendentes (GET /api/documentos/pendentes)
6. GET/PUT notificações (GET/PUT /api/notificacoes/{id})
"""

import pytest
import requests
import os
import io
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Fallback for testing
    BASE_URL = "https://autofleet-7.preview.emergentagent.com"

print(f"Testing against: {BASE_URL}")


class TestAuth:
    """Authentication tests"""
    
    def test_login_admin(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "123456"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        return data["access_token"]
    
    def test_login_parceiro(self):
        """Test parceiro login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "parceiro@tvdefleet.com",
            "password": "123456"
        })
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "parceiro"
        return data["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@tvdefleet.com",
        "password": "123456"
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Admin login failed")


@pytest.fixture(scope="module")
def parceiro_token():
    """Get parceiro token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "parceiro@tvdefleet.com",
        "password": "123456"
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Parceiro login failed")


@pytest.fixture(scope="module")
def parceiro_user(parceiro_token):
    """Get parceiro user data"""
    response = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {parceiro_token}"}
    )
    if response.status_code == 200:
        return response.json()
    pytest.skip("Could not get parceiro user data")


@pytest.fixture(scope="module")
def test_motorista(parceiro_token, parceiro_user):
    """Get or create a test motorista for the parceiro"""
    headers = {"Authorization": f"Bearer {parceiro_token}"}
    
    # First try to get existing motoristas
    response = requests.get(f"{BASE_URL}/api/motoristas", headers=headers)
    if response.status_code == 200:
        motoristas = response.json()
        if motoristas:
            return motoristas[0]
    
    # If no motoristas, skip the test
    pytest.skip("No motoristas available for testing")


@pytest.fixture(scope="module")
def test_vehicle(parceiro_token, parceiro_user):
    """Get or create a test vehicle for the parceiro"""
    headers = {"Authorization": f"Bearer {parceiro_token}"}
    
    # First try to get existing vehicles
    response = requests.get(f"{BASE_URL}/api/vehicles", headers=headers)
    if response.status_code == 200:
        vehicles = response.json()
        if vehicles:
            return vehicles[0]
    
    # If no vehicles, skip the test
    pytest.skip("No vehicles available for testing")


class TestMotoristasDocumentoUpload:
    """Test P0 Bug #1: Motoristas - erro ao carregar documento"""
    
    def test_upload_documento_as_parceiro(self, parceiro_token, test_motorista):
        """Test uploading document to motorista as parceiro - should work now"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        motorista_id = test_motorista["id"]
        
        # Create a simple test file
        files = {
            'file': ('test_doc.txt', io.BytesIO(b'Test document content'), 'text/plain')
        }
        data = {
            'tipo_documento': 'documento_teste',
            'converter_pdf': 'false'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/motoristas/{motorista_id}/documentos/upload",
            headers=headers,
            files=files,
            data=data
        )
        
        # Should return 200 (success) - bug was returning 403 for parceiro role
        assert response.status_code == 200, f"Upload failed with status {response.status_code}: {response.text}"
        result = response.json()
        assert "message" in result
        assert "url" in result
        print(f"✅ Document upload successful: {result}")
    
    def test_upload_documento_unauthorized(self, test_motorista):
        """Test uploading document without auth - should fail"""
        motorista_id = test_motorista["id"]
        
        files = {
            'file': ('test_doc.txt', io.BytesIO(b'Test document content'), 'text/plain')
        }
        data = {
            'tipo_documento': 'documento_teste',
            'converter_pdf': 'false'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/motoristas/{motorista_id}/documentos/upload",
            files=files,
            data=data
        )
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestVehiclePhotoUpload:
    """Test P0 Bug #2: Veículos - upload de foto 'não autorizado'"""
    
    def test_upload_photo_as_parceiro(self, parceiro_token, test_vehicle):
        """Test uploading photo to vehicle as parceiro - should work now"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        vehicle_id = test_vehicle["id"]
        
        # Create a simple test image (1x1 pixel PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            'file': ('test_photo.png', io.BytesIO(png_data), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/upload-photo",
            headers=headers,
            files=files
        )
        
        # Should return 200 (success) - bug was returning 403 for parceiro role
        # Note: May return 400 if max photos reached, which is acceptable
        assert response.status_code in [200, 400], f"Upload failed with status {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            result = response.json()
            assert "message" in result
            print(f"✅ Photo upload successful: {result}")
        else:
            # 400 means max photos reached - still proves authorization works
            print(f"✅ Authorization works, but max photos reached: {response.text}")
    
    def test_upload_foto_alt_endpoint(self, parceiro_token, test_vehicle):
        """Test alternative upload-foto endpoint as parceiro"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        vehicle_id = test_vehicle["id"]
        
        # Create a simple test image
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            'file': ('test_photo.png', io.BytesIO(png_data), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/upload-foto",
            headers=headers,
            files=files
        )
        
        # Should return 200 or 400 (max photos)
        assert response.status_code in [200, 400], f"Upload failed with status {response.status_code}: {response.text}"
        print(f"✅ Alternative upload-foto endpoint works: status {response.status_code}")


class TestVehicleAgenda:
    """Test P0 Bug #3: Veículos - erro ao adicionar/excluir evento na agenda"""
    
    def test_add_agenda_event_as_parceiro(self, parceiro_token, test_vehicle):
        """Test adding event to vehicle agenda as parceiro - should work now"""
        headers = {
            "Authorization": f"Bearer {parceiro_token}",
            "Content-Type": "application/json"
        }
        vehicle_id = test_vehicle["id"]
        
        evento_data = {
            "tipo": "manutencao",
            "titulo": "TEST_Manutenção Teste",
            "data": "2025-01-15",
            "hora": "10:00",
            "descricao": "Teste de adição de evento à agenda",
            "oficina": "Oficina Teste",
            "local": "Lisboa"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/agenda",
            headers=headers,
            json=evento_data
        )
        
        # Should return 200 (success) - bug was returning 403 for parceiro role
        assert response.status_code == 200, f"Add agenda failed with status {response.status_code}: {response.text}"
        result = response.json()
        assert "evento_id" in result
        print(f"✅ Agenda event added successfully: {result}")
        return result["evento_id"]
    
    def test_get_agenda(self, parceiro_token, test_vehicle):
        """Test getting vehicle agenda"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        vehicle_id = test_vehicle["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/agenda",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get agenda failed: {response.text}"
        agenda = response.json()
        assert isinstance(agenda, list)
        print(f"✅ Got agenda with {len(agenda)} events")
        return agenda
    
    def test_delete_agenda_event_as_parceiro(self, parceiro_token, test_vehicle):
        """Test deleting event from vehicle agenda as parceiro - should work now"""
        headers = {
            "Authorization": f"Bearer {parceiro_token}",
            "Content-Type": "application/json"
        }
        vehicle_id = test_vehicle["id"]
        
        # First add an event to delete
        evento_data = {
            "tipo": "outro",
            "titulo": "TEST_Evento para Eliminar",
            "data": "2025-01-20",
            "hora": "14:00",
            "descricao": "Este evento será eliminado"
        }
        
        add_response = requests.post(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/agenda",
            headers=headers,
            json=evento_data
        )
        
        assert add_response.status_code == 200, f"Failed to add event for deletion test: {add_response.text}"
        evento_id = add_response.json()["evento_id"]
        
        # Now delete the event
        delete_response = requests.delete(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/agenda/{evento_id}",
            headers=headers
        )
        
        # Should return 200 (success) - bug was returning 403 for parceiro role
        assert delete_response.status_code == 200, f"Delete agenda failed with status {delete_response.status_code}: {delete_response.text}"
        print(f"✅ Agenda event deleted successfully")


class TestDocumentosPendentes:
    """Test P0 Bug #5: Parceiro - não consegue ver documentos para aprovação"""
    
    def test_get_documentos_pendentes_as_parceiro(self, parceiro_token):
        """Test getting pending documents as parceiro - should work now"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/documentos/pendentes",
            headers=headers
        )
        
        # Should return 200 (success) - bug was returning 403 for parceiro role
        assert response.status_code == 200, f"Get documentos pendentes failed with status {response.status_code}: {response.text}"
        result = response.json()
        # Result should be a dict with user_id keys
        assert isinstance(result, dict)
        print(f"✅ Got documentos pendentes: {len(result)} users with pending docs")
    
    def test_get_documentos_pendentes_as_admin(self, admin_token):
        """Test getting pending documents as admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/documentos/pendentes",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get documentos pendentes failed: {response.text}"
        result = response.json()
        # Result can be a list or dict depending on implementation
        assert isinstance(result, (dict, list))
        count = len(result) if isinstance(result, list) else len(result.keys())
        print(f"✅ Admin got documentos pendentes: {count} users")
    
    def test_get_documentos_pendentes_unauthorized(self):
        """Test getting pending documents without auth - should fail"""
        response = requests.get(f"{BASE_URL}/api/documentos/pendentes")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestContratosGerar:
    """Test P0 Bug #6: Contratos - gerar contrato não funciona"""
    
    def test_gerar_contrato_as_parceiro(self, parceiro_token, parceiro_user, test_motorista, test_vehicle):
        """Test generating contract as parceiro - should work now"""
        headers = {
            "Authorization": f"Bearer {parceiro_token}",
            "Content-Type": "application/json"
        }
        
        contrato_data = {
            "parceiro_id": parceiro_user["id"],
            "motorista_id": test_motorista["id"],
            "vehicle_id": test_vehicle["id"],
            "data_inicio": "2025-01-01",
            "tipo_contrato": "comissao",
            "valor_semanal": 200.0,
            "comissao_percentual": 30.0,
            "caucao_total": 300.0,
            "caucao_lavagem": 90.0,
            "tem_caucao": True,
            "caucao_parcelada": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/contratos/gerar",
            headers=headers,
            json=contrato_data
        )
        
        # Should return 200 (success) - bug was returning 403 for parceiro role
        assert response.status_code == 200, f"Gerar contrato failed with status {response.status_code}: {response.text}"
        result = response.json()
        # API returns contrato_id or id depending on version
        assert "contrato_id" in result or "id" in result, f"Expected contrato_id or id in response: {result}"
        assert "referencia" in result
        contrato_id = result.get("contrato_id") or result.get("id")
        print(f"✅ Contract generated successfully: {result.get('referencia')} (id: {contrato_id})")
        return result
    
    def test_gerar_contrato_unauthorized(self, test_motorista, test_vehicle):
        """Test generating contract without auth - should fail"""
        contrato_data = {
            "parceiro_id": "some-id",
            "motorista_id": test_motorista["id"],
            "vehicle_id": test_vehicle["id"],
            "data_inicio": "2025-01-01",
            "tipo_contrato": "comissao",
            "valor_semanal": 200.0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/contratos/gerar",
            json=contrato_data
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestNotificacoes:
    """Test GET/PUT notificações endpoints"""
    
    def test_get_notificacoes_list(self, parceiro_token):
        """Test getting list of notifications"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/notificacoes",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get notificacoes failed: {response.text}"
        notificacoes = response.json()
        assert isinstance(notificacoes, list)
        print(f"✅ Got {len(notificacoes)} notifications")
        return notificacoes
    
    def test_get_notificacao_detalhe(self, parceiro_token):
        """Test getting single notification detail"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        # First get list of notifications
        list_response = requests.get(
            f"{BASE_URL}/api/notificacoes",
            headers=headers
        )
        
        if list_response.status_code != 200:
            pytest.skip("Could not get notifications list")
        
        notificacoes = list_response.json()
        if not notificacoes:
            pytest.skip("No notifications available to test")
        
        notificacao_id = notificacoes[0]["id"]
        
        # Get single notification
        response = requests.get(
            f"{BASE_URL}/api/notificacoes/{notificacao_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get notificacao detalhe failed: {response.text}"
        notificacao = response.json()
        assert notificacao["id"] == notificacao_id
        print(f"✅ Got notification detail: {notificacao.get('titulo', notificacao.get('mensagem', 'N/A'))[:50]}")
    
    def test_update_notificacao_notas(self, parceiro_token):
        """Test updating notification with notes"""
        headers = {
            "Authorization": f"Bearer {parceiro_token}",
            "Content-Type": "application/json"
        }
        
        # First get list of notifications
        list_response = requests.get(
            f"{BASE_URL}/api/notificacoes",
            headers=headers
        )
        
        if list_response.status_code != 200:
            pytest.skip("Could not get notifications list")
        
        notificacoes = list_response.json()
        if not notificacoes:
            pytest.skip("No notifications available to test")
        
        notificacao_id = notificacoes[0]["id"]
        
        # Update notification with notes
        update_data = {
            "notas": f"TEST_Nota de teste - {datetime.now().isoformat()}",
            "lida": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/notificacoes/{notificacao_id}",
            headers=headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Update notificacao failed: {response.text}"
        print(f"✅ Notification updated successfully")


class TestNotificacoesStats:
    """Test notification statistics endpoint"""
    
    def test_get_notificacoes_stats(self, parceiro_token):
        """Test getting notification statistics"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/notificacoes/stats",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get notificacoes stats failed: {response.text}"
        stats = response.json()
        assert "total" in stats
        assert "nao_lidas" in stats
        print(f"✅ Got notification stats: total={stats['total']}, unread={stats['nao_lidas']}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_agenda_events(self, parceiro_token, test_vehicle):
        """Clean up test agenda events"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        vehicle_id = test_vehicle["id"]
        
        # Get agenda
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/agenda",
            headers=headers
        )
        
        if response.status_code == 200:
            agenda = response.json()
            for evento in agenda:
                if evento.get("titulo", "").startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/vehicles/{vehicle_id}/agenda/{evento['id']}",
                        headers=headers
                    )
                    print(f"Cleaned up test event: {evento['titulo']}")
        
        print("✅ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
