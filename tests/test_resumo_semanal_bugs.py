"""
Test cases for Resumo Semanal bug fixes:
1. Uber Portagens column should be editable
2. Extras column should affect Líquido calculation in real-time
3. PDF should show correct vehicle rental (aluguer)
4. PDF should show correct totals (Ganhos, Despesas, Aluguer, Extras, Líquido)
5. Manual adjustments should be applied when generating PDF
6. PUT endpoint should save uber_portagens
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://autofleet-7.preview.emergentagent.com')

# Test credentials
PARCEIRO_EMAIL = "parceiro@tvdefleet.com"
PARCEIRO_PASSWORD = "123456"
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"

# Test data - Arlei Oliveira (motorista with vehicle AX-38-FH and aluguer €200)
TEST_MOTORISTA_ID = "57d6a119-e5af-4c7f-b357-49dc4f618763"
TEST_MOTORISTA_NAME = "Arlei Oliveira"
TEST_SEMANA = 2
TEST_ANO = 2026


@pytest.fixture(scope="module")
def parceiro_token():
    """Get authentication token for parceiro user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


class TestResumoSemanalAPI:
    """Test the resumo semanal API endpoint"""
    
    def test_get_resumo_semanal(self, parceiro_token):
        """Test GET resumo semanal returns correct data structure"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": TEST_SEMANA, "ano": TEST_ANO},
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "motoristas" in data
        assert "totais" in data
        assert "semana" in data
        assert "ano" in data
        
        # Find test motorista
        motorista = next((m for m in data["motoristas"] if m["motorista_id"] == TEST_MOTORISTA_ID), None)
        assert motorista is not None, f"Motorista {TEST_MOTORISTA_NAME} not found"
        
        # Check motorista has all required fields
        required_fields = [
            "ganhos_uber", "uber_portagens", "ganhos_bolt", "via_verde",
            "combustivel", "carregamento_eletrico", "aluguer_veiculo", "extras",
            "valor_liquido_motorista"
        ]
        for field in required_fields:
            assert field in motorista, f"Field {field} missing from motorista data"
    
    def test_motorista_has_aluguer(self, parceiro_token):
        """Test that motorista Arlei Oliveira has aluguer €200"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": TEST_SEMANA, "ano": TEST_ANO},
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        motorista = next((m for m in data["motoristas"] if m["motorista_id"] == TEST_MOTORISTA_ID), None)
        assert motorista is not None
        
        # Arlei Oliveira should have aluguer €200
        assert motorista["aluguer_veiculo"] == 200, f"Expected aluguer 200, got {motorista['aluguer_veiculo']}"


class TestPutEndpointUberPortagens:
    """Test PUT endpoint saves uber_portagens correctly"""
    
    def test_put_saves_uber_portagens(self, parceiro_token):
        """Test that PUT endpoint saves uber_portagens field"""
        # First, get current values
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": TEST_SEMANA, "ano": TEST_ANO},
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        motorista = next((m for m in data["motoristas"] if m["motorista_id"] == TEST_MOTORISTA_ID), None)
        assert motorista is not None
        
        # Save with uber_portagens value
        test_uber_portagens = 15.50
        update_data = {
            "semana": TEST_SEMANA,
            "ano": TEST_ANO,
            "ganhos_uber": motorista["ganhos_uber"],
            "uber_portagens": test_uber_portagens,
            "ganhos_bolt": motorista["ganhos_bolt"],
            "via_verde": motorista["via_verde"],
            "combustivel": motorista["combustivel"],
            "eletrico": motorista["carregamento_eletrico"],
            "aluguer": motorista["aluguer_veiculo"],
            "extras": motorista["extras"]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{TEST_MOTORISTA_ID}",
            json=update_data,
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200, f"PUT failed: {response.text}"
        
        # Verify uber_portagens was saved
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": TEST_SEMANA, "ano": TEST_ANO},
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        motorista = next((m for m in data["motoristas"] if m["motorista_id"] == TEST_MOTORISTA_ID), None)
        assert motorista is not None
        assert motorista["tem_ajuste_manual"] == True, "Manual adjustment flag should be True"
        assert motorista["uber_portagens"] == test_uber_portagens, f"Expected uber_portagens {test_uber_portagens}, got {motorista['uber_portagens']}"
    
    def test_put_saves_extras_and_affects_liquido(self, parceiro_token):
        """Test that PUT endpoint saves extras and it affects líquido calculation"""
        # Get current values
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": TEST_SEMANA, "ano": TEST_ANO},
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        motorista = next((m for m in data["motoristas"] if m["motorista_id"] == TEST_MOTORISTA_ID), None)
        assert motorista is not None
        
        # Save with extras value
        test_extras = 25.00
        update_data = {
            "semana": TEST_SEMANA,
            "ano": TEST_ANO,
            "ganhos_uber": motorista["ganhos_uber"],
            "uber_portagens": motorista["uber_portagens"],
            "ganhos_bolt": motorista["ganhos_bolt"],
            "via_verde": motorista["via_verde"],
            "combustivel": motorista["combustivel"],
            "eletrico": motorista["carregamento_eletrico"],
            "aluguer": motorista["aluguer_veiculo"],
            "extras": test_extras
        }
        
        response = requests.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{TEST_MOTORISTA_ID}",
            json=update_data,
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200, f"PUT failed: {response.text}"
        
        # Verify extras was saved and affects líquido
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": TEST_SEMANA, "ano": TEST_ANO},
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        motorista = next((m for m in data["motoristas"] if m["motorista_id"] == TEST_MOTORISTA_ID), None)
        assert motorista is not None
        assert motorista["extras"] == test_extras, f"Expected extras {test_extras}, got {motorista['extras']}"
        
        # Calculate expected líquido: ganhos - despesas - aluguer - extras
        expected_liquido = (
            motorista["ganhos_uber"] + motorista["ganhos_bolt"] 
            - motorista["via_verde"] - motorista["combustivel"] - motorista["carregamento_eletrico"]
            - motorista["aluguer_veiculo"] - motorista["extras"]
        )
        assert abs(motorista["valor_liquido_motorista"] - expected_liquido) < 0.01, \
            f"Expected líquido {expected_liquido}, got {motorista['valor_liquido_motorista']}"


class TestPDFGeneration:
    """Test PDF generation with correct values"""
    
    def test_pdf_endpoint_returns_pdf(self, parceiro_token):
        """Test that PDF endpoint returns a PDF file"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{TEST_MOTORISTA_ID}/pdf",
            params={
                "semana": TEST_SEMANA,
                "ano": TEST_ANO,
                "mostrar_matricula": True,
                "mostrar_via_verde": False,
                "mostrar_abastecimentos": False,
                "mostrar_carregamentos": False
            },
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200, f"PDF generation failed: {response.text}"
        assert response.headers.get("content-type") == "application/pdf" or "pdf" in response.headers.get("content-type", "").lower()
    
    def test_pdf_uses_manual_adjustments(self, parceiro_token):
        """Test that PDF uses manual adjustments when available"""
        # First, set manual adjustments
        test_ganhos_uber = 100.00
        test_aluguer = 200.00
        test_extras = 30.00
        
        update_data = {
            "semana": TEST_SEMANA,
            "ano": TEST_ANO,
            "ganhos_uber": test_ganhos_uber,
            "uber_portagens": 10.00,
            "ganhos_bolt": 50.00,
            "via_verde": 5.00,
            "combustivel": 20.00,
            "eletrico": 0,
            "aluguer": test_aluguer,
            "extras": test_extras
        }
        
        response = requests.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{TEST_MOTORISTA_ID}",
            json=update_data,
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200, f"PUT failed: {response.text}"
        
        # Generate PDF - should use manual adjustments
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{TEST_MOTORISTA_ID}/pdf",
            params={
                "semana": TEST_SEMANA,
                "ano": TEST_ANO,
                "mostrar_matricula": True
            },
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200, f"PDF generation failed: {response.text}"
        
        # PDF should be generated successfully (we can't easily verify content without parsing PDF)
        assert len(response.content) > 1000, "PDF content seems too small"


class TestManualAdjustmentsPersistence:
    """Test that manual adjustments are persisted and applied correctly"""
    
    def test_manual_adjustments_persist_after_reload(self, parceiro_token):
        """Test that manual adjustments persist after page reload (re-fetching data)"""
        # Set manual adjustments
        test_values = {
            "semana": TEST_SEMANA,
            "ano": TEST_ANO,
            "ganhos_uber": 150.00,
            "uber_portagens": 12.50,
            "ganhos_bolt": 75.00,
            "via_verde": 8.00,
            "combustivel": 45.00,
            "eletrico": 5.00,
            "aluguer": 200.00,
            "extras": 20.00
        }
        
        response = requests.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{TEST_MOTORISTA_ID}",
            json=test_values,
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        
        # Wait a moment for DB to persist
        time.sleep(0.5)
        
        # Fetch data again (simulating page reload)
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": TEST_SEMANA, "ano": TEST_ANO},
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        motorista = next((m for m in data["motoristas"] if m["motorista_id"] == TEST_MOTORISTA_ID), None)
        assert motorista is not None
        
        # Verify all values persisted
        assert motorista["tem_ajuste_manual"] == True
        assert motorista["ganhos_uber"] == test_values["ganhos_uber"]
        assert motorista["uber_portagens"] == test_values["uber_portagens"]
        assert motorista["ganhos_bolt"] == test_values["ganhos_bolt"]
        assert motorista["via_verde"] == test_values["via_verde"]
        assert motorista["combustivel"] == test_values["combustivel"]
        assert motorista["carregamento_eletrico"] == test_values["eletrico"]
        assert motorista["aluguer_veiculo"] == test_values["aluguer"]
        assert motorista["extras"] == test_values["extras"]


class TestLiquidoCalculation:
    """Test that Líquido is calculated correctly"""
    
    def test_liquido_formula(self, parceiro_token):
        """Test that Líquido = Ganhos - Despesas - Aluguer - Extras"""
        # Set known values
        test_values = {
            "semana": TEST_SEMANA,
            "ano": TEST_ANO,
            "ganhos_uber": 500.00,
            "uber_portagens": 0,
            "ganhos_bolt": 300.00,
            "via_verde": 50.00,
            "combustivel": 100.00,
            "eletrico": 25.00,
            "aluguer": 200.00,
            "extras": 50.00
        }
        
        response = requests.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{TEST_MOTORISTA_ID}",
            json=test_values,
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        
        # Fetch and verify
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": TEST_SEMANA, "ano": TEST_ANO},
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        motorista = next((m for m in data["motoristas"] if m["motorista_id"] == TEST_MOTORISTA_ID), None)
        assert motorista is not None
        
        # Expected: 500 + 300 - 50 - 100 - 25 - 200 - 50 = 375
        expected_liquido = 375.00
        assert abs(motorista["valor_liquido_motorista"] - expected_liquido) < 0.01, \
            f"Expected líquido {expected_liquido}, got {motorista['valor_liquido_motorista']}"


class TestCleanup:
    """Cleanup test data after tests"""
    
    def test_cleanup_manual_adjustments(self, parceiro_token):
        """Delete manual adjustments created during tests"""
        # Delete the motorista's weekly data to clean up
        response = requests.delete(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{TEST_MOTORISTA_ID}",
            params={"semana": TEST_SEMANA, "ano": TEST_ANO},
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        # It's OK if this fails (404) - means no data to delete
        assert response.status_code in [200, 404], f"Cleanup failed: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
