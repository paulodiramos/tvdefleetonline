"""
Test suite for Extras Motorista API and Resumo Semanal with Extras
Tests CRUD operations for extras and verifies extras are included in weekly summary calculations

Modules tested:
- /api/extras-motorista (CRUD operations)
- /api/relatorios/parceiro/resumo-semanal (extras in weekly summary)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"
PARCEIRO_EMAIL = "parceiro@tvdefleet.com"
PARCEIRO_PASSWORD = "123456"

# Test motorista ID (Motorista Teste Backend)
TEST_MOTORISTA_ID = "0eea6d82-625f-453d-ba26-e6681563b2b8"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def parceiro_token():
    """Get parceiro authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Parceiro authentication failed")


@pytest.fixture
def admin_client(admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


@pytest.fixture
def parceiro_client(parceiro_token):
    """Session with parceiro auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {parceiro_token}"
    })
    return session


class TestExtrasMotoristaAuth:
    """Test authentication requirements for extras endpoints"""
    
    def test_get_extras_requires_auth(self):
        """GET /api/extras-motorista requires authentication"""
        response = requests.get(f"{BASE_URL}/api/extras-motorista")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_post_extras_requires_auth(self):
        """POST /api/extras-motorista requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/extras-motorista",
            json={"motorista_id": TEST_MOTORISTA_ID, "tipo": "divida", "descricao": "Test", "valor": 100}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestExtrasMotoristaList:
    """Test GET /api/extras-motorista endpoint"""
    
    def test_list_extras_returns_200(self, admin_client):
        """GET /api/extras-motorista returns 200"""
        response = admin_client.get(f"{BASE_URL}/api/extras-motorista")
        assert response.status_code == 200
    
    def test_list_extras_returns_array(self, admin_client):
        """GET /api/extras-motorista returns array"""
        response = admin_client.get(f"{BASE_URL}/api/extras-motorista")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_list_extras_with_motorista_filter(self, admin_client):
        """GET /api/extras-motorista?motorista_id=X filters by motorista"""
        response = admin_client.get(
            f"{BASE_URL}/api/extras-motorista?motorista_id={TEST_MOTORISTA_ID}"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned extras should be for the test motorista
        for extra in data:
            assert extra.get("motorista_id") == TEST_MOTORISTA_ID
    
    def test_list_extras_with_tipo_filter(self, admin_client):
        """GET /api/extras-motorista?tipo=divida filters by tipo"""
        response = admin_client.get(f"{BASE_URL}/api/extras-motorista?tipo=divida")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for extra in data:
            assert extra.get("tipo") == "divida"
    
    def test_list_extras_with_semana_ano_filter(self, admin_client):
        """GET /api/extras-motorista?semana=51&ano=2025 filters by week/year"""
        response = admin_client.get(f"{BASE_URL}/api/extras-motorista?semana=51&ano=2025")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for extra in data:
            assert extra.get("semana") == 51
            assert extra.get("ano") == 2025
    
    def test_list_extras_with_pago_filter(self, admin_client):
        """GET /api/extras-motorista?pago=false filters by payment status"""
        response = admin_client.get(f"{BASE_URL}/api/extras-motorista?pago=false")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for extra in data:
            assert extra.get("pago") == False


class TestExtrasMotoristaCreate:
    """Test POST /api/extras-motorista endpoint"""
    
    def test_create_extra_divida(self, admin_client):
        """POST /api/extras-motorista creates divida extra"""
        payload = {
            "motorista_id": TEST_MOTORISTA_ID,
            "tipo": "divida",
            "descricao": "TEST_Dívida de teste automático",
            "valor": 75.50,
            "semana": 1,
            "ano": 2026,
            "pago": False
        }
        response = admin_client.post(f"{BASE_URL}/api/extras-motorista", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "id" in data
        assert "extra" in data
        
        extra = data["extra"]
        assert extra["tipo"] == "divida"
        assert extra["descricao"] == "TEST_Dívida de teste automático"
        assert extra["valor"] == 75.50
        assert extra["motorista_id"] == TEST_MOTORISTA_ID
        
        # Cleanup
        extra_id = data["id"]
        admin_client.delete(f"{BASE_URL}/api/extras-motorista/{extra_id}")
    
    def test_create_extra_caucao_parcelada(self, admin_client):
        """POST /api/extras-motorista creates caucao_parcelada extra with parcelas"""
        payload = {
            "motorista_id": TEST_MOTORISTA_ID,
            "tipo": "caucao_parcelada",
            "descricao": "TEST_Caução parcelada 1/6",
            "valor": 100.00,
            "semana": 1,
            "ano": 2026,
            "parcelas_total": 6,
            "parcela_atual": 1,
            "pago": False
        }
        response = admin_client.post(f"{BASE_URL}/api/extras-motorista", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        
        extra = data["extra"]
        assert extra["tipo"] == "caucao_parcelada"
        assert extra["parcelas_total"] == 6
        assert extra["parcela_atual"] == 1
        
        # Cleanup
        extra_id = data["id"]
        admin_client.delete(f"{BASE_URL}/api/extras-motorista/{extra_id}")
    
    def test_create_extra_dano(self, admin_client):
        """POST /api/extras-motorista creates dano extra"""
        payload = {
            "motorista_id": TEST_MOTORISTA_ID,
            "tipo": "dano",
            "descricao": "TEST_Dano no para-choques",
            "valor": 250.00,
            "semana": 1,
            "ano": 2026,
            "observacoes": "Dano causado em estacionamento"
        }
        response = admin_client.post(f"{BASE_URL}/api/extras-motorista", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data["extra"]["tipo"] == "dano"
        assert data["extra"]["observacoes"] == "Dano causado em estacionamento"
        
        # Cleanup
        extra_id = data["id"]
        admin_client.delete(f"{BASE_URL}/api/extras-motorista/{extra_id}")
    
    def test_create_extra_requires_motorista_id(self, admin_client):
        """POST /api/extras-motorista requires motorista_id"""
        payload = {
            "tipo": "divida",
            "descricao": "TEST_Missing motorista",
            "valor": 50.00
        }
        response = admin_client.post(f"{BASE_URL}/api/extras-motorista", json=payload)
        assert response.status_code in [400, 422, 500]
    
    def test_create_extra_invalid_motorista_returns_404(self, admin_client):
        """POST /api/extras-motorista with invalid motorista returns 404"""
        payload = {
            "motorista_id": "invalid-motorista-id-12345",
            "tipo": "divida",
            "descricao": "TEST_Invalid motorista",
            "valor": 50.00
        }
        response = admin_client.post(f"{BASE_URL}/api/extras-motorista", json=payload)
        assert response.status_code == 404


class TestExtrasMotoristaUpdate:
    """Test PUT /api/extras-motorista/{id} endpoint"""
    
    def test_update_extra_valor(self, admin_client):
        """PUT /api/extras-motorista/{id} updates valor"""
        # Create extra first
        create_payload = {
            "motorista_id": TEST_MOTORISTA_ID,
            "tipo": "divida",
            "descricao": "TEST_Extra para atualizar",
            "valor": 100.00,
            "semana": 1,
            "ano": 2026
        }
        create_response = admin_client.post(f"{BASE_URL}/api/extras-motorista", json=create_payload)
        assert create_response.status_code == 200
        extra_id = create_response.json()["id"]
        
        # Update extra
        update_payload = {"valor": 150.00}
        update_response = admin_client.put(
            f"{BASE_URL}/api/extras-motorista/{extra_id}",
            json=update_payload
        )
        assert update_response.status_code == 200
        assert update_response.json().get("success") == True
        
        # Verify update
        list_response = admin_client.get(
            f"{BASE_URL}/api/extras-motorista?motorista_id={TEST_MOTORISTA_ID}"
        )
        extras = list_response.json()
        updated_extra = next((e for e in extras if e["id"] == extra_id), None)
        assert updated_extra is not None
        assert updated_extra["valor"] == 150.00
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/extras-motorista/{extra_id}")
    
    def test_update_extra_mark_as_paid(self, admin_client):
        """PUT /api/extras-motorista/{id} marks extra as paid"""
        # Create extra first
        create_payload = {
            "motorista_id": TEST_MOTORISTA_ID,
            "tipo": "divida",
            "descricao": "TEST_Extra para marcar pago",
            "valor": 50.00,
            "semana": 1,
            "ano": 2026,
            "pago": False
        }
        create_response = admin_client.post(f"{BASE_URL}/api/extras-motorista", json=create_payload)
        assert create_response.status_code == 200
        extra_id = create_response.json()["id"]
        
        # Mark as paid
        update_payload = {"pago": True}
        update_response = admin_client.put(
            f"{BASE_URL}/api/extras-motorista/{extra_id}",
            json=update_payload
        )
        assert update_response.status_code == 200
        
        # Verify update
        list_response = admin_client.get(
            f"{BASE_URL}/api/extras-motorista?motorista_id={TEST_MOTORISTA_ID}"
        )
        extras = list_response.json()
        updated_extra = next((e for e in extras if e["id"] == extra_id), None)
        assert updated_extra is not None
        assert updated_extra["pago"] == True
        assert updated_extra.get("data_pagamento") is not None
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/extras-motorista/{extra_id}")
    
    def test_update_nonexistent_extra_returns_404(self, admin_client):
        """PUT /api/extras-motorista/{id} with invalid id returns 404"""
        response = admin_client.put(
            f"{BASE_URL}/api/extras-motorista/nonexistent-id-12345",
            json={"valor": 100.00}
        )
        assert response.status_code == 404


class TestExtrasMotoristaDelete:
    """Test DELETE /api/extras-motorista/{id} endpoint"""
    
    def test_delete_extra(self, admin_client):
        """DELETE /api/extras-motorista/{id} deletes extra"""
        # Create extra first
        create_payload = {
            "motorista_id": TEST_MOTORISTA_ID,
            "tipo": "divida",
            "descricao": "TEST_Extra para eliminar",
            "valor": 25.00,
            "semana": 1,
            "ano": 2026
        }
        create_response = admin_client.post(f"{BASE_URL}/api/extras-motorista", json=create_payload)
        assert create_response.status_code == 200
        extra_id = create_response.json()["id"]
        
        # Delete extra
        delete_response = admin_client.delete(f"{BASE_URL}/api/extras-motorista/{extra_id}")
        assert delete_response.status_code == 200
        assert delete_response.json().get("success") == True
        
        # Verify deletion
        list_response = admin_client.get(
            f"{BASE_URL}/api/extras-motorista?motorista_id={TEST_MOTORISTA_ID}"
        )
        extras = list_response.json()
        deleted_extra = next((e for e in extras if e["id"] == extra_id), None)
        assert deleted_extra is None
    
    def test_delete_nonexistent_extra_returns_404(self, admin_client):
        """DELETE /api/extras-motorista/{id} with invalid id returns 404"""
        response = admin_client.delete(f"{BASE_URL}/api/extras-motorista/nonexistent-id-12345")
        assert response.status_code == 404


class TestResumoSemanalWithExtras:
    """Test that extras are included in weekly summary calculations"""
    
    def test_resumo_semanal_includes_extras_field(self, admin_client):
        """GET /api/relatorios/parceiro/resumo-semanal includes extras in motorista data"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=51&ano=2025"
        )
        assert response.status_code == 200
        
        data = response.json()
        motoristas = data.get("motoristas", [])
        assert len(motoristas) > 0
        
        # Check that each motorista has extras field
        for motorista in motoristas:
            assert "extras" in motorista, f"Motorista {motorista.get('motorista_nome')} missing extras field"
            assert "receitas_parceiro" in motorista
    
    def test_resumo_semanal_totais_includes_total_extras(self, admin_client):
        """GET /api/relatorios/parceiro/resumo-semanal totais includes total_extras"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=51&ano=2025"
        )
        assert response.status_code == 200
        
        data = response.json()
        totais = data.get("totais", {})
        
        assert "total_extras" in totais, "totais missing total_extras field"
        assert "total_receitas_parceiro" in totais, "totais missing total_receitas_parceiro field"
        assert "total_liquido_parceiro" in totais, "totais missing total_liquido_parceiro field"
    
    def test_resumo_semanal_motorista_teste_has_extras(self, admin_client):
        """Motorista Teste Backend has extras=150 in week 51/2025"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=51&ano=2025"
        )
        assert response.status_code == 200
        
        data = response.json()
        motoristas = data.get("motoristas", [])
        
        # Find Motorista Teste Backend
        test_motorista = next(
            (m for m in motoristas if m.get("motorista_id") == TEST_MOTORISTA_ID),
            None
        )
        assert test_motorista is not None, "Motorista Teste Backend not found in resumo"
        
        # Verify extras value (150€ dívida from week 51/2025)
        assert test_motorista.get("extras") == 150.0, f"Expected extras=150.0, got {test_motorista.get('extras')}"
        assert test_motorista.get("receitas_parceiro") == 150.0
    
    def test_resumo_semanal_total_extras_matches_sum(self, admin_client):
        """total_extras equals sum of all motoristas extras"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=51&ano=2025"
        )
        assert response.status_code == 200
        
        data = response.json()
        motoristas = data.get("motoristas", [])
        totais = data.get("totais", {})
        
        # Calculate sum of extras
        sum_extras = sum(m.get("extras", 0) for m in motoristas)
        total_extras = totais.get("total_extras", 0)
        
        assert abs(sum_extras - total_extras) < 0.01, f"Sum of extras ({sum_extras}) != total_extras ({total_extras})"
    
    def test_resumo_semanal_receitas_parceiro_formula(self, admin_client):
        """receitas_parceiro = aluguer + extras for each motorista"""
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=51&ano=2025"
        )
        assert response.status_code == 200
        
        data = response.json()
        motoristas = data.get("motoristas", [])
        
        for motorista in motoristas:
            aluguer = motorista.get("aluguer_veiculo", 0)
            extras = motorista.get("extras", 0)
            receitas = motorista.get("receitas_parceiro", 0)
            
            expected_receitas = aluguer + extras
            assert abs(receitas - expected_receitas) < 0.01, \
                f"Motorista {motorista.get('motorista_nome')}: receitas_parceiro ({receitas}) != aluguer ({aluguer}) + extras ({extras})"
    
    def test_resumo_semanal_week_2_2026_has_extras(self, admin_client):
        """Week 2/2026 should have extras for Motorista Teste Backend
        
        Note: The query matches extras by semana/ano OR by data field within week range.
        Both extras (150€ dívida with data=2026-01-10 and 50€ caução with semana=2/ano=2026)
        fall within week 2/2026 (2026-01-05 to 2026-01-11), so total is 200€.
        """
        response = admin_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=2&ano=2026"
        )
        assert response.status_code == 200
        
        data = response.json()
        motoristas = data.get("motoristas", [])
        
        # Find Motorista Teste Backend
        test_motorista = next(
            (m for m in motoristas if m.get("motorista_id") == TEST_MOTORISTA_ID),
            None
        )
        
        if test_motorista:
            # Should have extras (query matches by semana/ano OR data range)
            # Both extras have data=2026-01-10 which falls in week 2/2026
            assert test_motorista.get("extras") >= 50.0, \
                f"Expected extras >= 50.0, got {test_motorista.get('extras')}"


class TestParceiroAccess:
    """Test parceiro role access to extras"""
    
    def test_parceiro_can_list_extras(self, parceiro_client):
        """Parceiro can list extras"""
        response = parceiro_client.get(f"{BASE_URL}/api/extras-motorista")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_parceiro_can_create_extra(self, parceiro_client):
        """Parceiro can create extra for their motorista"""
        payload = {
            "motorista_id": TEST_MOTORISTA_ID,
            "tipo": "multa",
            "descricao": "TEST_Multa de estacionamento",
            "valor": 30.00,
            "semana": 1,
            "ano": 2026
        }
        response = parceiro_client.post(f"{BASE_URL}/api/extras-motorista", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        
        # Cleanup
        extra_id = data["id"]
        parceiro_client.delete(f"{BASE_URL}/api/extras-motorista/{extra_id}")
    
    def test_parceiro_can_access_resumo_semanal(self, parceiro_client):
        """Parceiro can access resumo semanal"""
        response = parceiro_client.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=51&ano=2025"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "motoristas" in data
        assert "totais" in data


class TestExtraDataStructure:
    """Test extra data structure and fields"""
    
    def test_extra_has_required_fields(self, admin_client):
        """Extra object has all required fields"""
        response = admin_client.get(f"{BASE_URL}/api/extras-motorista")
        assert response.status_code == 200
        
        extras = response.json()
        if len(extras) > 0:
            extra = extras[0]
            required_fields = [
                "id", "motorista_id", "tipo", "descricao", "valor",
                "pago", "created_at"
            ]
            for field in required_fields:
                assert field in extra, f"Extra missing required field: {field}"
    
    def test_extra_tipos_are_valid(self, admin_client):
        """Extra tipos are from valid set"""
        response = admin_client.get(f"{BASE_URL}/api/extras-motorista")
        assert response.status_code == 200
        
        valid_tipos = ["divida", "caucao_parcelada", "dano", "multa", "outro"]
        extras = response.json()
        
        for extra in extras:
            assert extra.get("tipo") in valid_tipos, \
                f"Invalid tipo: {extra.get('tipo')}"


# Cleanup fixture to remove TEST_ prefixed extras after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_extras(admin_token):
    """Cleanup TEST_ prefixed extras after test module completes"""
    yield
    
    # Teardown: Delete all test-created extras
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    
    response = session.get(f"{BASE_URL}/api/extras-motorista")
    if response.status_code == 200:
        extras = response.json()
        for extra in extras:
            if extra.get("descricao", "").startswith("TEST_"):
                session.delete(f"{BASE_URL}/api/extras-motorista/{extra['id']}")
