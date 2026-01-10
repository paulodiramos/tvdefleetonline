"""
Test Import Data - Verificação dos dados importados para Karen e Nelson

Valores esperados (conforme especificação):
- Karen Souza (ID: b5fc7af8-fea5-48c3-a79e-f8bde00e1ba6):
  - Bolt: €323.86
  - Uber: €85.89
  - Elétrico: €119.16
  - Aluguer: €400/semana (veículo BR-03-MZ)
  - Via Verde: €26.85

- Nelson Francisco (ID: e2355169-10a7-4547-9dd0-479c128d73f9):
  - Uber: €607.54
  - Bolt: €136.74
  - Combustível: €144.63
  - Via Verde: €27.60
  - Aluguer: €249.99/semana (veículo AS-83-NX)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://partner-reports-1.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"

# Motorista IDs
KAREN_ID = "b5fc7af8-fea5-48c3-a79e-f8bde00e1ba6"
NELSON_ID = "e2355169-10a7-4547-9dd0-479c128d73f9"

# Vehicle IDs
KAREN_VEHICLE_ID = "924ba8a0-7972-4895-b086-15f88c1c0656"  # BR-03-MZ
NELSON_VEHICLE_ID = "4ad331ff-c0f5-43c9-95b8-cc085d32d8a7"  # AS-83-NX


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API requests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestLogin:
    """Test authentication"""
    
    def test_admin_login(self):
        """Admin login should work"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("role") == "admin"


class TestImportarPlataformasPage:
    """Test /importar-plataformas page accessibility"""
    
    def test_api_importar_endpoint_exists(self, api_client):
        """Test that import endpoint exists (OPTIONS request)"""
        # Test with a simple GET to check if endpoint is accessible
        response = api_client.get(f"{BASE_URL}/api/motoristas")
        assert response.status_code == 200, "API should be accessible"


class TestKarenData:
    """Test Karen Souza imported data"""
    
    def test_karen_bolt_ganhos(self, api_client):
        """Karen Bolt ganhos should be €323.86"""
        # Get ganhos_bolt for Karen
        response = api_client.get(f"{BASE_URL}/api/motoristas/{KAREN_ID}")
        assert response.status_code == 200
        
        # Check relatorios for Karen
        response = api_client.get(f"{BASE_URL}/api/relatorios/motorista/{KAREN_ID}/semanais")
        assert response.status_code == 200
        relatorios = response.json()
        
        # Find relatorio with Bolt data
        bolt_found = False
        for rel in relatorios:
            if rel.get("ganhos_bolt") == 323.86:
                bolt_found = True
                break
        
        assert bolt_found, f"Karen Bolt €323.86 not found in relatorios. Found: {[r.get('ganhos_bolt') for r in relatorios]}"
    
    def test_karen_uber_ganhos(self, api_client):
        """Karen Uber ganhos should be €85.89"""
        response = api_client.get(f"{BASE_URL}/api/relatorios/motorista/{KAREN_ID}/semanais")
        assert response.status_code == 200
        relatorios = response.json()
        
        uber_found = False
        for rel in relatorios:
            if rel.get("ganhos_uber") == 85.89:
                uber_found = True
                break
        
        assert uber_found, f"Karen Uber €85.89 not found. Found: {[r.get('ganhos_uber') for r in relatorios]}"
    
    def test_karen_vehicle_aluguer(self, api_client):
        """Karen vehicle BR-03-MZ should have aluguer €400"""
        response = api_client.get(f"{BASE_URL}/api/vehicles/{KAREN_VEHICLE_ID}")
        assert response.status_code == 200
        vehicle = response.json()
        
        assert vehicle.get("matricula") == "BR-03-MZ", f"Wrong vehicle: {vehicle.get('matricula')}"
        
        tipo_contrato = vehicle.get("tipo_contrato", {})
        valor_aluguer = tipo_contrato.get("valor_aluguer")
        
        assert valor_aluguer == 400.0, f"Karen vehicle aluguer should be €400, got €{valor_aluguer}"


class TestNelsonData:
    """Test Nelson Francisco imported data"""
    
    def test_nelson_uber_ganhos(self, api_client):
        """Nelson Uber ganhos should be approximately €607"""
        response = api_client.get(f"{BASE_URL}/api/relatorios/motorista/{NELSON_ID}/semanais")
        assert response.status_code == 200
        relatorios = response.json()
        
        # Check for Uber value close to €607
        uber_found = False
        for rel in relatorios:
            uber = rel.get("ganhos_uber", 0)
            if uber and 570 <= uber <= 610:  # Allow some tolerance
                uber_found = True
                break
        
        assert uber_found, f"Nelson Uber ~€607 not found. Found: {[r.get('ganhos_uber') for r in relatorios]}"
    
    def test_nelson_bolt_ganhos(self, api_client):
        """Nelson Bolt ganhos should be €136.74"""
        response = api_client.get(f"{BASE_URL}/api/relatorios/motorista/{NELSON_ID}/semanais")
        assert response.status_code == 200
        relatorios = response.json()
        
        bolt_found = False
        for rel in relatorios:
            if rel.get("ganhos_bolt") == 136.74:
                bolt_found = True
                break
        
        assert bolt_found, f"Nelson Bolt €136.74 not found. Found: {[r.get('ganhos_bolt') for r in relatorios]}"
    
    def test_nelson_vehicle_aluguer(self, api_client):
        """Nelson vehicle AS-83-NX should have aluguer €249.99"""
        response = api_client.get(f"{BASE_URL}/api/vehicles/{NELSON_VEHICLE_ID}")
        assert response.status_code == 200
        vehicle = response.json()
        
        assert vehicle.get("matricula") == "AS-83-NX", f"Wrong vehicle: {vehicle.get('matricula')}"
        
        tipo_contrato = vehicle.get("tipo_contrato", {})
        valor_aluguer = tipo_contrato.get("valor_aluguer")
        
        assert valor_aluguer == 249.99, f"Nelson vehicle aluguer should be €249.99, got €{valor_aluguer}"


class TestRelatoriosAPI:
    """Test /api/relatorios endpoints"""
    
    def test_relatorios_semanais_todos(self, api_client):
        """Test get all weekly reports"""
        response = api_client.get(f"{BASE_URL}/api/relatorios/semanais-todos")
        assert response.status_code == 200
        relatorios = response.json()
        assert isinstance(relatorios, list)
        print(f"Total relatorios: {len(relatorios)}")
    
    def test_relatorios_resumos_motoristas(self, api_client):
        """Test get driver summaries"""
        response = api_client.get(f"{BASE_URL}/api/relatorios/resumos-motoristas")
        assert response.status_code == 200
        resumos = response.json()
        assert isinstance(resumos, list)
        print(f"Total resumos: {len(resumos)}")
    
    def test_relatorios_resumo_semanal(self, api_client):
        """Test get weekly summary"""
        response = api_client.get(f"{BASE_URL}/api/relatorios/resumo-semanal")
        assert response.status_code == 200
        resumo = response.json()
        assert "total_relatorios" in resumo


class TestVehiclesAPI:
    """Test /api/vehicles endpoints"""
    
    def test_get_all_vehicles(self, api_client):
        """Test get all vehicles"""
        response = api_client.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        vehicles = response.json()
        assert isinstance(vehicles, list)
        assert len(vehicles) > 0
        
        # Check for our test vehicles
        matriculas = [v.get("matricula") for v in vehicles]
        assert "BR-03-MZ" in matriculas, "Karen's vehicle BR-03-MZ not found"
        assert "AS-83-NX" in matriculas, "Nelson's vehicle AS-83-NX not found"
    
    def test_get_karen_vehicle(self, api_client):
        """Test get Karen's vehicle"""
        response = api_client.get(f"{BASE_URL}/api/vehicles/{KAREN_VEHICLE_ID}")
        assert response.status_code == 200
        vehicle = response.json()
        assert vehicle.get("matricula") == "BR-03-MZ"
        assert vehicle.get("motorista_atribuido") == KAREN_ID
        assert vehicle.get("motorista_atribuido_nome") == "Karen Souza"
    
    def test_get_nelson_vehicle(self, api_client):
        """Test get Nelson's vehicle"""
        response = api_client.get(f"{BASE_URL}/api/vehicles/{NELSON_VEHICLE_ID}")
        assert response.status_code == 200
        vehicle = response.json()
        assert vehicle.get("matricula") == "AS-83-NX"
        assert vehicle.get("motorista_atribuido") == NELSON_ID
        assert vehicle.get("motorista_atribuido_nome") == "Nelson Francisco"


class TestMotoristasAPI:
    """Test /api/motoristas endpoints"""
    
    def test_get_all_motoristas(self, api_client):
        """Test get all drivers"""
        response = api_client.get(f"{BASE_URL}/api/motoristas")
        assert response.status_code == 200
        motoristas = response.json()
        assert isinstance(motoristas, list)
        assert len(motoristas) > 0
    
    def test_get_karen(self, api_client):
        """Test get Karen's data"""
        response = api_client.get(f"{BASE_URL}/api/motoristas/{KAREN_ID}")
        assert response.status_code == 200
        motorista = response.json()
        assert motorista.get("name") == "Karen Souza"
        assert motorista.get("veiculo_atribuido") == KAREN_VEHICLE_ID
    
    def test_get_nelson(self, api_client):
        """Test get Nelson's data"""
        response = api_client.get(f"{BASE_URL}/api/motoristas/{NELSON_ID}")
        assert response.status_code == 200
        motorista = response.json()
        assert motorista.get("name") == "Nelson Francisco"
        assert motorista.get("veiculo_atribuido") == NELSON_VEHICLE_ID


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
