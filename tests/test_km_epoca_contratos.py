"""
Test suite for KM por Época and Contratos features in TVDEFleet
Tests:
- KM por Época fields (km_por_epoca, km_epoca_alta, km_epoca_baixa, meses_epoca_alta)
- Upload de contrato assinado via POST /api/vehicles/{id}/upload-contrato
- Listagem de contratos via GET /api/vehicles/{id}/contratos
"""

import pytest
import requests
import os
import io
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"
TEST_VEHICLE_ID = "c89c2b6b-2804-4044-b479-f51a91530466"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    # API returns access_token, not token
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestKMPorEpoca:
    """Tests for KM por Época feature"""
    
    def test_get_vehicle_with_km_epoca_fields(self, auth_headers):
        """Test that vehicle endpoint returns km_por_epoca fields"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get vehicle: {response.text}"
        
        vehicle = response.json()
        assert "tipo_contrato" in vehicle, "tipo_contrato field missing"
        
        # Check that km_por_epoca fields exist in tipo_contrato
        tipo_contrato = vehicle.get("tipo_contrato") or {}
        # These fields should exist (even if null/empty)
        print(f"tipo_contrato fields: {tipo_contrato.keys()}")
    
    def test_update_km_por_epoca_enabled(self, auth_headers):
        """Test enabling KM por época with values"""
        payload = {
            "tipo_contrato": {
                "km_por_epoca": True,
                "km_epoca_alta": 2000,
                "km_epoca_baixa": 1200,
                "meses_epoca_alta": [6, 7, 8, 9],  # Jun-Set
                "meses_epoca_baixa": [1, 2, 3, 4, 5, 10, 11, 12]  # Rest of year
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200, f"Failed to update vehicle: {response.text}"
        
        # Verify the update
        get_response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        
        vehicle = get_response.json()
        tipo_contrato = vehicle.get("tipo_contrato") or {}
        
        assert tipo_contrato.get("km_por_epoca") == True, "km_por_epoca should be True"
        assert tipo_contrato.get("km_epoca_alta") == 2000, f"km_epoca_alta should be 2000, got {tipo_contrato.get('km_epoca_alta')}"
        assert tipo_contrato.get("km_epoca_baixa") == 1200, f"km_epoca_baixa should be 1200, got {tipo_contrato.get('km_epoca_baixa')}"
        assert tipo_contrato.get("meses_epoca_alta") == [6, 7, 8, 9], f"meses_epoca_alta should be [6,7,8,9], got {tipo_contrato.get('meses_epoca_alta')}"
        
        print(f"✅ KM por Época enabled successfully: Alta={tipo_contrato.get('km_epoca_alta')}km, Baixa={tipo_contrato.get('km_epoca_baixa')}km")
    
    def test_update_km_por_epoca_disabled(self, auth_headers):
        """Test disabling KM por época"""
        payload = {
            "tipo_contrato": {
                "km_por_epoca": False,
                "km_epoca_alta": None,
                "km_epoca_baixa": None,
                "meses_epoca_alta": [],
                "meses_epoca_baixa": []
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200, f"Failed to update vehicle: {response.text}"
        
        # Verify the update
        get_response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        
        vehicle = get_response.json()
        tipo_contrato = vehicle.get("tipo_contrato") or {}
        
        assert tipo_contrato.get("km_por_epoca") == False, "km_por_epoca should be False"
        print(f"✅ KM por Época disabled successfully")
    
    def test_update_km_por_epoca_partial(self, auth_headers):
        """Test updating only some KM por época fields"""
        # First enable with all fields
        payload = {
            "tipo_contrato": {
                "km_por_epoca": True,
                "km_epoca_alta": 1800,
                "km_epoca_baixa": 1000,
                "meses_epoca_alta": [5, 6, 7, 8, 9, 10]  # May-Oct
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200, f"Failed to update vehicle: {response.text}"
        
        # Verify
        get_response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers=auth_headers
        )
        vehicle = get_response.json()
        tipo_contrato = vehicle.get("tipo_contrato") or {}
        
        assert tipo_contrato.get("km_epoca_alta") == 1800
        assert tipo_contrato.get("km_epoca_baixa") == 1000
        assert 5 in tipo_contrato.get("meses_epoca_alta", [])
        assert 10 in tipo_contrato.get("meses_epoca_alta", [])
        
        print(f"✅ Partial KM por Época update successful")


class TestContratosUpload:
    """Tests for Contratos upload and listing"""
    
    def test_get_contratos_empty(self, auth_headers):
        """Test getting contratos list (may be empty initially)"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/contratos",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get contratos: {response.text}"
        
        data = response.json()
        assert "contratos" in data, "Response should have 'contratos' field"
        assert "total" in data, "Response should have 'total' field"
        assert "veiculo_id" in data, "Response should have 'veiculo_id' field"
        
        print(f"✅ Contratos list retrieved: {data.get('total')} contratos")
    
    def test_upload_contrato_pdf(self, auth_headers):
        """Test uploading a contract PDF"""
        # Create a simple PDF-like content (for testing purposes)
        pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
        
        files = {
            'file': ('contrato_teste.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        data = {
            'tipo': 'contrato_aluguer'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/upload-contrato",
            headers=auth_headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Failed to upload contrato: {response.text}"
        
        result = response.json()
        assert "contrato" in result, "Response should have 'contrato' field"
        assert "message" in result, "Response should have 'message' field"
        
        contrato = result.get("contrato", {})
        assert contrato.get("tipo") == "contrato_aluguer", f"Tipo should be 'contrato_aluguer', got {contrato.get('tipo')}"
        assert contrato.get("documento_url"), "documento_url should not be empty"
        assert contrato.get("id"), "contrato should have an id"
        
        print(f"✅ Contrato uploaded successfully: {contrato.get('id')}")
        return contrato.get("id")
    
    def test_get_contratos_after_upload(self, auth_headers):
        """Test getting contratos list after upload"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/contratos",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get contratos: {response.text}"
        
        data = response.json()
        contratos = data.get("contratos", [])
        
        # Should have at least one contrato after upload
        assert len(contratos) >= 1, f"Should have at least 1 contrato, got {len(contratos)}"
        
        # Check contrato structure
        if contratos:
            contrato = contratos[0]
            assert "id" in contrato, "Contrato should have 'id'"
            assert "tipo" in contrato, "Contrato should have 'tipo'"
            assert "documento_url" in contrato, "Contrato should have 'documento_url'"
            assert "data" in contrato, "Contrato should have 'data'"
            
            print(f"✅ Contratos list has {len(contratos)} items")
            print(f"   Latest contrato: tipo={contrato.get('tipo')}, data={contrato.get('data')[:10] if contrato.get('data') else 'N/A'}")
    
    def test_upload_contrato_with_motorista(self, auth_headers):
        """Test uploading a contract with motorista_id"""
        # First get the vehicle to check if it has a motorista
        vehicle_response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers=auth_headers
        )
        vehicle = vehicle_response.json()
        motorista_id = vehicle.get("motorista_atribuido")
        
        pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
        
        files = {
            'file': ('contrato_motorista.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        data = {
            'tipo': 'contrato_veiculo'
        }
        if motorista_id:
            data['motorista_id'] = motorista_id
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/upload-contrato",
            headers=auth_headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Failed to upload contrato: {response.text}"
        
        result = response.json()
        contrato = result.get("contrato", {})
        
        if motorista_id:
            assert contrato.get("motorista_id") == motorista_id, "motorista_id should match"
            print(f"✅ Contrato with motorista uploaded: motorista_id={motorista_id}")
        else:
            print(f"✅ Contrato uploaded (no motorista assigned to vehicle)")
    
    def test_delete_contrato(self, auth_headers):
        """Test deleting a contract"""
        # First get the list of contratos
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/contratos",
            headers=auth_headers
        )
        data = response.json()
        contratos = data.get("contratos", [])
        
        if not contratos:
            pytest.skip("No contratos to delete")
        
        # Delete the first contrato
        contrato_id = contratos[0].get("id")
        
        delete_response = requests.delete(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/contratos/{contrato_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == 200, f"Failed to delete contrato: {delete_response.text}"
        
        # Verify deletion
        verify_response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/contratos",
            headers=auth_headers
        )
        verify_data = verify_response.json()
        
        # Check that the deleted contrato is no longer in the list
        remaining_ids = [c.get("id") for c in verify_data.get("contratos", [])]
        assert contrato_id not in remaining_ids, "Deleted contrato should not be in list"
        
        print(f"✅ Contrato deleted successfully: {contrato_id}")


class TestVehicleDataPersistence:
    """Tests for data persistence after save"""
    
    def test_full_km_epoca_save_and_load(self, auth_headers):
        """Test complete save and reload of KM por Época data"""
        # Save complete KM por Época configuration
        payload = {
            "tipo_contrato": {
                "tipo": "aluguer_sem_caucao",
                "periodicidade": "semanal",
                "valor_aluguer": 250,
                "tem_limite_km": True,
                "km_semanais_disponiveis": 1500,
                "valor_extra_km": 0.15,
                "km_acumula_semanal": True,
                "km_por_epoca": True,
                "km_epoca_alta": 2000,
                "km_epoca_baixa": 1200,
                "meses_epoca_alta": [6, 7, 8, 9],
                "meses_epoca_baixa": [1, 2, 3, 4, 5, 10, 11, 12]
            }
        }
        
        # Save
        save_response = requests.put(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers=auth_headers,
            json=payload
        )
        assert save_response.status_code == 200, f"Failed to save: {save_response.text}"
        
        # Reload
        load_response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}",
            headers=auth_headers
        )
        assert load_response.status_code == 200
        
        vehicle = load_response.json()
        tipo_contrato = vehicle.get("tipo_contrato") or {}
        
        # Verify all fields
        assert tipo_contrato.get("km_por_epoca") == True
        assert tipo_contrato.get("km_epoca_alta") == 2000
        assert tipo_contrato.get("km_epoca_baixa") == 1200
        assert tipo_contrato.get("meses_epoca_alta") == [6, 7, 8, 9]
        assert tipo_contrato.get("tem_limite_km") == True
        assert tipo_contrato.get("km_semanais_disponiveis") == 1500
        assert tipo_contrato.get("valor_extra_km") == 0.15
        assert tipo_contrato.get("km_acumula_semanal") == True
        
        print(f"✅ Full KM por Época configuration saved and loaded correctly")
        print(f"   - km_por_epoca: {tipo_contrato.get('km_por_epoca')}")
        print(f"   - km_epoca_alta: {tipo_contrato.get('km_epoca_alta')}")
        print(f"   - km_epoca_baixa: {tipo_contrato.get('km_epoca_baixa')}")
        print(f"   - meses_epoca_alta: {tipo_contrato.get('meses_epoca_alta')}")


class TestUnauthorizedAccess:
    """Tests for unauthorized access"""
    
    def test_contratos_without_auth(self):
        """Test that contratos endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/contratos"
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print(f"✅ Contratos endpoint correctly requires authentication")
    
    def test_upload_contrato_without_auth(self):
        """Test that upload endpoint requires authentication"""
        pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
        
        files = {
            'file': ('test.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        data = {'tipo': 'contrato_teste'}
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/upload-contrato",
            files=files,
            data=data
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print(f"✅ Upload contrato endpoint correctly requires authentication")


class TestVehicleNotFound:
    """Tests for non-existent vehicle"""
    
    def test_contratos_vehicle_not_found(self, auth_headers):
        """Test contratos endpoint with non-existent vehicle"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/vehicles/{fake_id}/contratos",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Should return 404, got {response.status_code}"
        print(f"✅ Contratos endpoint correctly returns 404 for non-existent vehicle")
    
    def test_upload_contrato_vehicle_not_found(self, auth_headers):
        """Test upload endpoint with non-existent vehicle"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
        
        files = {
            'file': ('test.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        data = {'tipo': 'contrato_teste'}
        
        response = requests.post(
            f"{BASE_URL}/api/vehicles/{fake_id}/upload-contrato",
            headers=auth_headers,
            files=files,
            data=data
        )
        assert response.status_code == 404, f"Should return 404, got {response.status_code}"
        print(f"✅ Upload contrato endpoint correctly returns 404 for non-existent vehicle")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
