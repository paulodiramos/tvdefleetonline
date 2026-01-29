"""
Test suite for Exportação de Dados (CSV Export) functionality
Tests: /api/exportacao/campos, /api/exportacao/motoristas, /api/exportacao/veiculos, /api/exportacao/completa
"""

import pytest
import requests
import os
import zipfile
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "zeny123"
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"


def get_auth_token(email, password):
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    if response.status_code == 200:
        return response.json().get("token")
    return None


@pytest.fixture(scope="module")
def parceiro_token():
    """Get parceiro authentication token"""
    token = get_auth_token(PARCEIRO_EMAIL, PARCEIRO_PASSWORD)
    if not token:
        pytest.skip("Parceiro authentication failed")
    return token


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    token = get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not token:
        pytest.skip("Admin authentication failed")
    return token


class TestExportacaoCampos:
    """Tests for GET /api/exportacao/campos - List available fields"""
    
    def test_campos_returns_motoristas_and_veiculos(self, parceiro_token):
        """Test that campos endpoint returns both motoristas and veiculos fields"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/campos",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "motoristas" in data
        assert "veiculos" in data
        assert isinstance(data["motoristas"], list)
        assert isinstance(data["veiculos"], list)
        
    def test_campos_motoristas_structure(self, parceiro_token):
        """Test motoristas fields have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/campos",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check motoristas fields structure
        assert len(data["motoristas"]) >= 10  # Should have at least 10 fields
        
        for campo in data["motoristas"]:
            assert "id" in campo
            assert "label" in campo
            assert "default" in campo
            assert isinstance(campo["default"], bool)
            
    def test_campos_veiculos_structure(self, parceiro_token):
        """Test veiculos fields have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/campos",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check veiculos fields structure
        assert len(data["veiculos"]) >= 10  # Should have at least 10 fields
        
        for campo in data["veiculos"]:
            assert "id" in campo
            assert "label" in campo
            assert "default" in campo
            assert isinstance(campo["default"], bool)
            
    def test_campos_has_expected_motorista_fields(self, parceiro_token):
        """Test that expected motorista fields are present"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/campos",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        motorista_ids = [c["id"] for c in data["motoristas"]]
        
        # Check expected fields exist
        expected_fields = ["nome", "email", "telefone", "nif", "carta_conducao", "estado"]
        for field in expected_fields:
            assert field in motorista_ids, f"Expected field '{field}' not found in motoristas"
            
    def test_campos_has_expected_veiculo_fields(self, parceiro_token):
        """Test that expected veiculo fields are present"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/campos",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        veiculo_ids = [c["id"] for c in data["veiculos"]]
        
        # Check expected fields exist
        expected_fields = ["matricula", "marca", "modelo", "ano", "estado"]
        for field in expected_fields:
            assert field in veiculo_ids, f"Expected field '{field}' not found in veiculos"
            
    def test_campos_unauthorized_without_token(self):
        """Test that campos endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/exportacao/campos")
        assert response.status_code in [401, 403]


class TestExportacaoMotoristas:
    """Tests for GET /api/exportacao/motoristas - Export drivers to CSV"""
    
    def test_exportar_motoristas_default_fields(self, parceiro_token):
        """Test exporting motoristas with default fields"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/motoristas",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        # Check CSV content
        content = response.text
        assert len(content) > 0
        
        # Should have BOM for Excel UTF-8 compatibility
        assert content.startswith('\ufeff') or 'Nome' in content or 'Email' in content
        
    def test_exportar_motoristas_with_selected_fields(self, parceiro_token):
        """Test exporting motoristas with specific fields"""
        campos = "nome,email,telefone"
        response = requests.get(
            f"{BASE_URL}/api/exportacao/motoristas?campos={campos}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        content = response.text
        # Check that header contains selected fields
        first_line = content.split('\n')[0]
        assert "Nome" in first_line or "nome" in first_line.lower()
        
    def test_exportar_motoristas_semicolon_delimiter(self, parceiro_token):
        """Test exporting motoristas with semicolon delimiter (Portuguese Excel)"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/motoristas?delimitador=;",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        content = response.text
        
        # Should use semicolon as delimiter
        first_line = content.split('\n')[0]
        assert ';' in first_line
        
    def test_exportar_motoristas_comma_delimiter(self, parceiro_token):
        """Test exporting motoristas with comma delimiter (international)"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/motoristas?delimitador=,",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        content = response.text
        
        # Should use comma as delimiter
        first_line = content.split('\n')[0]
        assert ',' in first_line
        
    def test_exportar_motoristas_content_disposition(self, parceiro_token):
        """Test that response has correct Content-Disposition header"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/motoristas",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition
        assert "motoristas" in content_disposition
        assert ".csv" in content_disposition
        
    def test_exportar_motoristas_invalid_fields(self, parceiro_token):
        """Test exporting with invalid field names"""
        campos = "invalid_field_xyz"
        response = requests.get(
            f"{BASE_URL}/api/exportacao/motoristas?campos={campos}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        # Should return 400 for invalid fields
        assert response.status_code == 400


class TestExportacaoVeiculos:
    """Tests for GET /api/exportacao/veiculos - Export vehicles to CSV"""
    
    def test_exportar_veiculos_default_fields(self, parceiro_token):
        """Test exporting veiculos with default fields"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/veiculos",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        content = response.text
        assert len(content) > 0
        
    def test_exportar_veiculos_with_selected_fields(self, parceiro_token):
        """Test exporting veiculos with specific fields"""
        campos = "matricula,marca,modelo"
        response = requests.get(
            f"{BASE_URL}/api/exportacao/veiculos?campos={campos}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        content = response.text
        first_line = content.split('\n')[0]
        assert "Matrícula" in first_line or "matricula" in first_line.lower() or "Matr" in first_line
        
    def test_exportar_veiculos_semicolon_delimiter(self, parceiro_token):
        """Test exporting veiculos with semicolon delimiter"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/veiculos?delimitador=;",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        content = response.text
        first_line = content.split('\n')[0]
        assert ';' in first_line
        
    def test_exportar_veiculos_comma_delimiter(self, parceiro_token):
        """Test exporting veiculos with comma delimiter"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/veiculos?delimitador=,",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        content = response.text
        first_line = content.split('\n')[0]
        assert ',' in first_line
        
    def test_exportar_veiculos_content_disposition(self, parceiro_token):
        """Test that response has correct Content-Disposition header"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/veiculos",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition
        assert "veiculos" in content_disposition
        assert ".csv" in content_disposition
        
    def test_exportar_veiculos_invalid_fields(self, parceiro_token):
        """Test exporting with invalid field names"""
        campos = "invalid_field_xyz"
        response = requests.get(
            f"{BASE_URL}/api/exportacao/veiculos?campos={campos}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 400


class TestExportacaoCompleta:
    """Tests for GET /api/exportacao/completa - Export all data as ZIP"""
    
    def test_exportar_completa_returns_zip(self, parceiro_token):
        """Test that complete export returns a ZIP file"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/completa",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        assert "application/zip" in response.headers.get("Content-Type", "")
        
    def test_exportar_completa_content_disposition(self, parceiro_token):
        """Test that ZIP has correct Content-Disposition header"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/completa",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition
        assert "exportacao_completa" in content_disposition
        assert ".zip" in content_disposition
        
    def test_exportar_completa_zip_contains_csvs(self, parceiro_token):
        """Test that ZIP contains motoristas and veiculos CSV files"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/completa",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        
        # Parse ZIP content
        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
            file_names = zip_file.namelist()
            
            # Should contain motoristas and veiculos CSVs
            motoristas_csv = [f for f in file_names if 'motoristas' in f.lower() and f.endswith('.csv')]
            veiculos_csv = [f for f in file_names if 'veiculos' in f.lower() and f.endswith('.csv')]
            
            assert len(motoristas_csv) >= 1, "ZIP should contain motoristas CSV"
            assert len(veiculos_csv) >= 1, "ZIP should contain veiculos CSV"
            
    def test_exportar_completa_with_selected_fields(self, parceiro_token):
        """Test complete export with specific fields for both"""
        campos_mot = "nome,email"
        campos_veic = "matricula,marca"
        
        response = requests.get(
            f"{BASE_URL}/api/exportacao/completa?campos_motoristas={campos_mot}&campos_veiculos={campos_veic}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        assert "application/zip" in response.headers.get("Content-Type", "")
        
    def test_exportar_completa_with_delimiter(self, parceiro_token):
        """Test complete export with custom delimiter"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/completa?delimitador=,",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        
        # Parse ZIP and check CSV delimiter
        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
            for file_name in zip_file.namelist():
                if file_name.endswith('.csv'):
                    content = zip_file.read(file_name).decode('utf-8-sig')
                    first_line = content.split('\n')[0]
                    assert ',' in first_line, f"CSV {file_name} should use comma delimiter"


class TestExportacaoAccessControl:
    """Tests for access control on exportacao endpoints"""
    
    def test_admin_can_access_campos(self, admin_token):
        """Test that admin can access campos endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/campos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
    def test_admin_can_export_motoristas(self, admin_token):
        """Test that admin can export motoristas"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/motoristas",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
    def test_admin_can_export_veiculos(self, admin_token):
        """Test that admin can export veiculos"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/veiculos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
    def test_admin_can_export_completa(self, admin_token):
        """Test that admin can do complete export"""
        response = requests.get(
            f"{BASE_URL}/api/exportacao/completa",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
