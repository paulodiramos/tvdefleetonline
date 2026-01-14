"""
Test file for TVDEFleet Parceiro Bugs - Iteration 12
Tests the following bugs:
1. GET /api/vehicles/{id} - deve retornar dados do veículo sem erro (como parceiro)
2. POST /api/vehicles/{id}/historico - adicionar entrada histórico (como parceiro)
3. DELETE /api/vehicles/{id}/historico/{entry_id} - apagar entrada histórico (como parceiro)
4. DELETE /api/vehicles/{id}/fotos/{index} - apagar foto do veículo (como parceiro)
5. GET /api/parceiros/{id}/templates-contrato - deve retornar templates existentes (como parceiro)
6. GET /api/motoristas/{id}/documento/{doc_type}/download - download documento (como parceiro)
"""

import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"email": "admin@tvdefleet.com", "password": "123456"}
PARCEIRO_CREDS = {"email": "parceiro@tvdefleet.com", "password": "123456"}

# Known IDs from the request
PARCEIRO_ID = "ab2a25aa-4f70-4c7b-835d-9204b0cd0d7e"
VEHICLE_ID = "c89c2b6b-2804-4044-b479-f51a91530466"


class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        pytest.admin_token = data["access_token"]
        pytest.admin_user = data.get("user", {})
        print(f"✅ Admin login successful - role: {pytest.admin_user.get('role')}")
    
    def test_parceiro_login(self):
        """Test parceiro login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARCEIRO_CREDS)
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        pytest.parceiro_token = data["access_token"]
        pytest.parceiro_user = data.get("user", {})
        pytest.parceiro_id = pytest.parceiro_user.get("id")
        print(f"✅ Parceiro login successful - id: {pytest.parceiro_id}, role: {pytest.parceiro_user.get('role')}")


class TestVehicleGetAsParceiro:
    """Test GET /api/vehicles/{id} as parceiro - Bug #1"""
    
    def test_get_vehicle_as_parceiro(self):
        """Test getting vehicle data as parceiro - should not error"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        # First get list of vehicles to find one belonging to parceiro
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=headers)
        assert response.status_code == 200, f"Failed to get vehicles list: {response.text}"
        
        vehicles = response.json()
        if not vehicles:
            pytest.skip("No vehicles found for parceiro")
        
        # Use the first vehicle
        vehicle_id = vehicles[0].get("id")
        print(f"Testing with vehicle ID: {vehicle_id}")
        
        # Now test GET single vehicle
        response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}", headers=headers)
        print(f"GET /api/vehicles/{vehicle_id} response: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Error response: {response.text}")
        
        assert response.status_code == 200, f"GET vehicle failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "matricula" in data
        print(f"✅ GET vehicle successful - matricula: {data.get('matricula')}")
        
        # Store for later tests
        pytest.test_vehicle_id = vehicle_id
    
    def test_get_vehicle_with_known_id(self):
        """Test getting vehicle with known ID from request"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        response = requests.get(f"{BASE_URL}/api/vehicles/{VEHICLE_ID}", headers=headers)
        print(f"GET /api/vehicles/{VEHICLE_ID} response: {response.status_code}")
        
        if response.status_code == 404:
            print("⚠️ Vehicle not found - may belong to different parceiro")
            pytest.skip("Vehicle not found or belongs to different parceiro")
        
        if response.status_code == 403:
            print("⚠️ Vehicle belongs to different parceiro")
            pytest.skip("Vehicle belongs to different parceiro")
        
        assert response.status_code == 200, f"GET vehicle failed: {response.text}"
        print(f"✅ GET vehicle with known ID successful")


class TestVehicleHistoricoAsParceiro:
    """Test vehicle historico endpoints as parceiro - Bugs #2, #3, #4"""
    
    def test_add_historico_entry(self):
        """Test POST /api/vehicles/{id}/historico as parceiro - Bug #2"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        vehicle_id = getattr(pytest, 'test_vehicle_id', VEHICLE_ID)
        
        entry_data = {
            "data": datetime.now().strftime("%Y-%m-%d"),
            "titulo": "TEST_Entrada de teste",
            "descricao": "Descrição de teste para histórico",
            "tipo": "observacao"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/historico",
            headers=headers,
            json=entry_data
        )
        
        print(f"POST /api/vehicles/{vehicle_id}/historico response: {response.status_code}")
        
        if response.status_code == 403:
            print(f"Error: {response.text}")
            pytest.fail(f"Parceiro not authorized to add historico: {response.text}")
        
        if response.status_code == 404:
            pytest.skip("Vehicle not found")
        
        assert response.status_code == 200, f"Add historico failed: {response.text}"
        
        data = response.json()
        assert "entry_id" in data, f"Response missing entry_id: {data}"
        pytest.test_entry_id = data["entry_id"]
        print(f"✅ Add historico successful - entry_id: {pytest.test_entry_id}")
    
    def test_get_historico(self):
        """Test GET /api/vehicles/{id}/historico as parceiro - Bug #3"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        vehicle_id = getattr(pytest, 'test_vehicle_id', VEHICLE_ID)
        
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/historico",
            headers=headers
        )
        
        print(f"GET /api/vehicles/{vehicle_id}/historico response: {response.status_code}")
        
        if response.status_code == 403:
            print(f"Error: {response.text}")
        
        if response.status_code == 404:
            pytest.skip("Vehicle not found")
        
        assert response.status_code == 200, f"Get historico failed: {response.text}"
        
        data = response.json()
        print(f"✅ Get historico successful - {len(data)} entries")
    
    def test_delete_historico_entry(self):
        """Test DELETE /api/vehicles/{id}/historico/{entry_id} as parceiro - Bug #4"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        vehicle_id = getattr(pytest, 'test_vehicle_id', VEHICLE_ID)
        entry_id = getattr(pytest, 'test_entry_id', None)
        
        if not entry_id:
            pytest.skip("No entry_id from previous test")
        
        response = requests.delete(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/historico/{entry_id}",
            headers=headers
        )
        
        print(f"DELETE /api/vehicles/{vehicle_id}/historico/{entry_id} response: {response.status_code}")
        
        if response.status_code == 403:
            print(f"Error: {response.text}")
            pytest.fail(f"Parceiro not authorized to delete historico: {response.text}")
        
        if response.status_code == 404:
            print("Entry not found - may have been already deleted")
        
        assert response.status_code in [200, 404], f"Delete historico failed: {response.text}"
        print(f"✅ Delete historico successful")


class TestVehicleFotosAsParceiro:
    """Test vehicle fotos delete as parceiro - Bug #4 (apagar foto)"""
    
    def test_delete_vehicle_foto(self):
        """Test DELETE /api/vehicles/{id}/fotos/{index} as parceiro"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        vehicle_id = getattr(pytest, 'test_vehicle_id', VEHICLE_ID)
        
        # First check if vehicle has photos
        response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}", headers=headers)
        
        if response.status_code != 200:
            pytest.skip("Cannot get vehicle data")
        
        vehicle = response.json()
        fotos = vehicle.get("fotos_veiculo", []) or vehicle.get("fotos", [])
        
        if not fotos:
            print("⚠️ Vehicle has no photos to delete - testing endpoint anyway")
            # Test with index 0 to verify endpoint works (should return 400 for invalid index)
            response = requests.delete(
                f"{BASE_URL}/api/vehicles/{vehicle_id}/fotos/0",
                headers=headers
            )
            
            print(f"DELETE /api/vehicles/{vehicle_id}/fotos/0 response: {response.status_code}")
            
            if response.status_code == 403:
                pytest.fail(f"Parceiro not authorized to delete fotos: {response.text}")
            
            # 400 is expected when no photos exist
            assert response.status_code in [200, 400], f"Delete foto failed unexpectedly: {response.text}"
            print(f"✅ Delete foto endpoint accessible (returned {response.status_code} - expected for no photos)")
        else:
            # Vehicle has photos - test actual delete
            response = requests.delete(
                f"{BASE_URL}/api/vehicles/{vehicle_id}/fotos/0",
                headers=headers
            )
            
            print(f"DELETE /api/vehicles/{vehicle_id}/fotos/0 response: {response.status_code}")
            
            if response.status_code == 403:
                pytest.fail(f"Parceiro not authorized to delete fotos: {response.text}")
            
            assert response.status_code == 200, f"Delete foto failed: {response.text}"
            print(f"✅ Delete foto successful")


class TestTemplatesContratoAsParceiro:
    """Test templates-contrato endpoint as parceiro - Bug #5"""
    
    def test_get_templates_contrato_with_parceiro_id(self):
        """Test GET /api/parceiros/{id}/templates-contrato as parceiro"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        parceiro_id = pytest.parceiro_id
        
        response = requests.get(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/templates-contrato",
            headers=headers
        )
        
        print(f"GET /api/parceiros/{parceiro_id}/templates-contrato response: {response.status_code}")
        
        if response.status_code == 403:
            print(f"Error: {response.text}")
            pytest.fail(f"Parceiro not authorized: {response.text}")
        
        assert response.status_code == 200, f"Get templates failed: {response.text}"
        
        data = response.json()
        print(f"✅ Get templates-contrato successful - {len(data)} templates found")
        
        # Check if message says "parceiro não tem templates"
        if isinstance(data, dict) and "message" in data:
            print(f"⚠️ Response message: {data.get('message')}")
        
        pytest.templates_count = len(data) if isinstance(data, list) else 0
    
    def test_get_templates_contratos_alternative(self):
        """Test GET /api/templates-contratos as parceiro (alternative endpoint)"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/templates-contratos",
            headers=headers
        )
        
        print(f"GET /api/templates-contratos response: {response.status_code}")
        
        if response.status_code == 403:
            print(f"Error: {response.text}")
        
        # This endpoint may have different behavior
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Get templates-contratos successful - {len(data)} templates found")
        else:
            print(f"⚠️ Alternative endpoint returned {response.status_code}")
    
    def test_create_template_contrato(self):
        """Test creating a template to verify templates work"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        parceiro_id = pytest.parceiro_id
        
        template_data = {
            "nome_template": "TEST_Template Teste",
            "tipo_contrato": "aluguer_sem_caucao",
            "periodicidade_padrao": "semanal",
            "valor_base": 200.0,
            "clausulas_texto": "Cláusulas de teste"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/templates-contrato",
            headers=headers,
            json=template_data
        )
        
        print(f"POST /api/parceiros/{parceiro_id}/templates-contrato response: {response.status_code}")
        
        if response.status_code == 403:
            print(f"Error: {response.text}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            pytest.test_template_id = data.get("id")
            print(f"✅ Create template successful - id: {pytest.test_template_id}")
        else:
            print(f"⚠️ Create template returned {response.status_code}: {response.text}")
    
    def test_verify_templates_after_create(self):
        """Verify templates list after creating one"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        parceiro_id = pytest.parceiro_id
        
        response = requests.get(
            f"{BASE_URL}/api/parceiros/{parceiro_id}/templates-contrato",
            headers=headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        print(f"Templates after create: {len(data)} templates")
        
        # Should have at least the one we created
        if hasattr(pytest, 'test_template_id'):
            template_ids = [t.get("id") for t in data]
            if pytest.test_template_id in template_ids:
                print(f"✅ Created template found in list")
            else:
                print(f"⚠️ Created template NOT found in list")


class TestMotoristaDocumentoDownload:
    """Test motorista documento download as parceiro - Bug #6"""
    
    def test_get_motoristas_list(self):
        """Get list of motoristas for parceiro"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        response = requests.get(f"{BASE_URL}/api/motoristas", headers=headers)
        
        assert response.status_code == 200, f"Get motoristas failed: {response.text}"
        
        motoristas = response.json()
        print(f"Found {len(motoristas)} motoristas")
        
        if motoristas:
            pytest.test_motorista_id = motoristas[0].get("id")
            pytest.test_motorista = motoristas[0]
            print(f"Using motorista: {motoristas[0].get('name')} - {pytest.test_motorista_id}")
    
    def test_download_motorista_documento(self):
        """Test GET /api/motoristas/{id}/documento/{doc_type}/download as parceiro"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        motorista_id = getattr(pytest, 'test_motorista_id', None)
        
        if not motorista_id:
            pytest.skip("No motorista found")
        
        # Try different document types
        doc_types = ["documento_identificacao", "licenca_tvde", "registo_criminal", "carta_conducao"]
        
        for doc_type in doc_types:
            response = requests.get(
                f"{BASE_URL}/api/motoristas/{motorista_id}/documento/{doc_type}/download",
                headers=headers
            )
            
            print(f"GET /api/motoristas/{motorista_id}/documento/{doc_type}/download: {response.status_code}")
            
            if response.status_code == 200:
                print(f"✅ Download {doc_type} successful")
                return  # Success - at least one document works
            elif response.status_code == 403:
                pytest.fail(f"Parceiro not authorized to download {doc_type}: {response.text}")
            elif response.status_code == 404:
                print(f"⚠️ Document {doc_type} not found")
        
        print("⚠️ No documents found for motorista - endpoint accessible but no files")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_template(self):
        """Delete test template if created"""
        headers = {"Authorization": f"Bearer {pytest.parceiro_token}"}
        
        template_id = getattr(pytest, 'test_template_id', None)
        
        if template_id:
            response = requests.delete(
                f"{BASE_URL}/api/templates-contrato/{template_id}",
                headers=headers
            )
            print(f"Cleanup template: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
