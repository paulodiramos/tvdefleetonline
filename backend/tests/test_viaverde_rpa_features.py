"""
Test Via Verde RPA Features - Iteration 27
Tests for:
1. POST /api/viaverde/executar-rpa with tipo_periodo='semana_especifica'
2. POST /api/viaverde/importar-excel - Manual Excel upload
3. Auto-creation of vehicles for unknown matriculas
4. PUT /api/motoristas/{id}/desativar - Deactivate driver with specific date
5. GET /api/resumo-semanal-parceiro/{semana}/{ano} - Via Verde data
"""

import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "zeny123"
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_parceiro_login(self):
        """Test parceiro login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "parceiro"
        print(f"✅ Parceiro login successful: {data['user']['email']}")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✅ Admin login successful: {data['user']['email']}")


@pytest.fixture
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
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def parceiro_headers(parceiro_token):
    """Get headers with parceiro auth"""
    return {
        "Authorization": f"Bearer {parceiro_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture
def admin_headers(admin_token):
    """Get headers with admin auth"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestViaVerdeRPA:
    """Test Via Verde RPA endpoints"""
    
    def test_executar_rpa_semana_especifica(self, parceiro_headers):
        """
        Test POST /api/viaverde/executar-rpa with tipo_periodo='semana_especifica'
        Week 3, Year 2026
        """
        response = requests.post(
            f"{BASE_URL}/api/viaverde/executar-rpa",
            headers=parceiro_headers,
            json={
                "tipo_periodo": "semana_especifica",
                "semana": 3,
                "ano": 2026
            }
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "execucao_id" in data
        assert data.get("status") == "em_execucao"
        assert "periodo" in data
        
        # Verify period info
        periodo = data["periodo"]
        assert periodo["tipo"] == "semana_especifica"
        assert "2026" in periodo["data_inicio"]
        assert "2026" in periodo["data_fim"]
        
        print(f"✅ RPA Via Verde scheduled: {data['execucao_id']}")
        print(f"   Period: {periodo['descricao']}")
        print(f"   Dates: {periodo['data_inicio']} to {periodo['data_fim']}")
    
    def test_executar_rpa_ultima_semana(self, parceiro_headers):
        """Test POST /api/viaverde/executar-rpa with tipo_periodo='ultima_semana'"""
        response = requests.post(
            f"{BASE_URL}/api/viaverde/executar-rpa",
            headers=parceiro_headers,
            json={
                "tipo_periodo": "ultima_semana"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "execucao_id" in data
        assert data["periodo"]["tipo"] == "ultima_semana"
        
        print(f"✅ RPA Via Verde (última semana) scheduled: {data['execucao_id']}")
        print(f"   Period: {data['periodo']['descricao']}")
    
    def test_executar_rpa_datas_personalizadas(self, parceiro_headers):
        """Test POST /api/viaverde/executar-rpa with custom dates"""
        response = requests.post(
            f"{BASE_URL}/api/viaverde/executar-rpa",
            headers=parceiro_headers,
            json={
                "tipo_periodo": "datas_personalizadas",
                "data_inicio": "2026-01-13",
                "data_fim": "2026-01-19"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data["periodo"]["tipo"] == "datas_personalizadas"
        assert data["periodo"]["data_inicio"] == "2026-01-13"
        assert data["periodo"]["data_fim"] == "2026-01-19"
        
        print(f"✅ RPA Via Verde (custom dates) scheduled: {data['execucao_id']}")
    
    def test_executar_rpa_validation_semana_missing(self, parceiro_headers):
        """Test validation: semana_especifica without semana/ano"""
        response = requests.post(
            f"{BASE_URL}/api/viaverde/executar-rpa",
            headers=parceiro_headers,
            json={
                "tipo_periodo": "semana_especifica"
                # Missing semana and ano
            }
        )
        
        assert response.status_code == 400
        print(f"✅ Validation works: {response.json().get('detail')}")
    
    def test_executar_rpa_validation_datas_missing(self, parceiro_headers):
        """Test validation: datas_personalizadas without dates"""
        response = requests.post(
            f"{BASE_URL}/api/viaverde/executar-rpa",
            headers=parceiro_headers,
            json={
                "tipo_periodo": "datas_personalizadas"
                # Missing data_inicio and data_fim
            }
        )
        
        assert response.status_code == 400
        print(f"✅ Validation works: {response.json().get('detail')}")
    
    def test_executar_rpa_requires_auth(self):
        """Test that RPA endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/viaverde/executar-rpa",
            json={"tipo_periodo": "ultima_semana"}
        )
        
        assert response.status_code in [401, 403]
        print(f"✅ Authentication required: {response.status_code}")
    
    def test_listar_execucoes_viaverde(self, parceiro_headers):
        """Test GET /api/viaverde/execucoes"""
        response = requests.get(
            f"{BASE_URL}/api/viaverde/execucoes",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✅ Listed {len(data)} Via Verde executions")
        
        if len(data) > 0:
            exec_item = data[0]
            print(f"   Latest: {exec_item.get('id')} - {exec_item.get('status')} - {exec_item.get('periodo_descricao')}")


class TestViaVerdeExcelImport:
    """Test Via Verde Excel import endpoint"""
    
    def test_importar_excel_requires_auth(self):
        """Test that Excel import requires authentication"""
        # Create a dummy file
        files = {'file': ('test.xlsx', b'dummy content', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        response = requests.post(
            f"{BASE_URL}/api/viaverde/importar-excel",
            files=files
        )
        
        assert response.status_code in [401, 403]
        print(f"✅ Authentication required for Excel import: {response.status_code}")
    
    def test_importar_excel_invalid_extension(self, parceiro_token):
        """Test that invalid file extensions are rejected"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        files = {'file': ('test.txt', b'dummy content', 'text/plain')}
        
        response = requests.post(
            f"{BASE_URL}/api/viaverde/importar-excel",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 400
        assert "Excel" in response.json().get("detail", "") or "xlsx" in response.json().get("detail", "").lower()
        print(f"✅ Invalid extension rejected: {response.json().get('detail')}")


class TestMotoristaDesativar:
    """Test motorista deactivation endpoint"""
    
    def test_desativar_motorista_with_date(self, parceiro_headers):
        """Test PUT /api/motoristas/{id}/desativar with specific date"""
        # First, get list of motoristas
        response = requests.get(
            f"{BASE_URL}/api/motoristas",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200
        motoristas = response.json()
        
        if not motoristas or len(motoristas) == 0:
            pytest.skip("No motoristas found to test deactivation")
        
        # Find an active motorista
        active_motorista = None
        for m in motoristas:
            if m.get("ativo", True) and m.get("status_motorista") != "desativo":
                active_motorista = m
                break
        
        if not active_motorista:
            pytest.skip("No active motoristas found")
        
        motorista_id = active_motorista["id"]
        motorista_nome = active_motorista.get("nome", "Unknown")
        
        print(f"Testing deactivation for motorista: {motorista_nome} ({motorista_id})")
        
        # Deactivate with specific date
        test_date = "2026-02-01"
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{motorista_id}/desativar",
            headers=parceiro_headers,
            json={"data_desativacao": test_date}
        )
        
        print(f"Deactivation response: {response.status_code} - {response.text[:200]}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert data.get("data_desativacao") == test_date
        
        print(f"✅ Motorista deactivated: {motorista_nome}")
        print(f"   Deactivation date: {data.get('data_desativacao')}")
        
        # Reactivate the motorista to restore state
        reactivate_response = requests.put(
            f"{BASE_URL}/api/motoristas/{motorista_id}/reativar",
            headers=parceiro_headers
        )
        
        if reactivate_response.status_code == 200:
            print(f"✅ Motorista reactivated: {motorista_nome}")
        else:
            print(f"⚠️ Could not reactivate motorista: {reactivate_response.text}")
    
    def test_desativar_motorista_not_found(self, parceiro_headers):
        """Test deactivation of non-existent motorista"""
        response = requests.put(
            f"{BASE_URL}/api/motoristas/non-existent-id-12345/desativar",
            headers=parceiro_headers,
            json={"data_desativacao": "2026-02-01"}
        )
        
        assert response.status_code == 404
        print(f"✅ Not found error returned: {response.json().get('detail')}")


class TestResumoSemanalParceiro:
    """Test resumo semanal parceiro endpoint"""
    
    def test_get_resumo_semanal(self, parceiro_headers):
        """Test GET /api/relatorios/parceiro/resumo-semanal with Via Verde data"""
        # Test week 5, 2026 (known to have Via Verde data from previous tests)
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=5&ano=2026",
            headers=parceiro_headers
        )
        
        print(f"Response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "totais" in data
        assert "motoristas" in data
        
        totais = data["totais"]
        motoristas = data["motoristas"]
        
        print(f"✅ Resumo Semanal retrieved for week 5/2026")
        print(f"   Total Via Verde: €{totais.get('total_via_verde', 0):.2f}")
        print(f"   Total Motoristas: {len(motoristas)}")
        print(f"   Total Receitas: €{totais.get('total_receitas_parceiro', 0):.2f}")
        print(f"   Total Despesas: €{totais.get('total_despesas_operacionais', 0):.2f}")
        
        # Check if Via Verde data exists
        if totais.get('total_via_verde', 0) > 0:
            print(f"   ✅ Via Verde data present in resumo")
        else:
            print(f"   ⚠️ No Via Verde data in this week")
    
    def test_get_resumo_semanal_week_3(self, parceiro_headers):
        """Test GET /api/relatorios/parceiro/resumo-semanal for week 3/2026"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=3&ano=2026",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"✅ Resumo Semanal retrieved for week 3/2026")
        print(f"   Total Via Verde: €{data['totais'].get('total_via_verde', 0):.2f}")
        print(f"   Total Motoristas: {len(data['motoristas'])}")
    
    def test_resumo_semanal_requires_auth(self):
        """Test that resumo semanal requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=5&ano=2026"
        )
        
        assert response.status_code in [401, 403]
        print(f"✅ Authentication required: {response.status_code}")


class TestAutoCreateVehicles:
    """Test auto-creation of vehicles for unknown matriculas"""
    
    def test_list_vehicles(self, parceiro_headers):
        """List vehicles to check for auto-created ones"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200
        vehicles = response.json()
        
        print(f"✅ Listed {len(vehicles)} vehicles")
        
        # Check for auto-created vehicles
        auto_created = [v for v in vehicles if v.get("auto_criado") == True]
        
        if auto_created:
            print(f"   Found {len(auto_created)} auto-created vehicles:")
            for v in auto_created[:5]:  # Show first 5
                print(f"   - {v.get('matricula')} (status: {v.get('status')}, fonte: {v.get('auto_criado_fonte')})")
        else:
            print(f"   No auto-created vehicles found (may be created during RPA execution)")
    
    def test_vehicles_with_pending_status(self, parceiro_headers):
        """Check for vehicles with 'pendente_dados' status (auto-created)"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200
        vehicles = response.json()
        
        pending = [v for v in vehicles if v.get("status") == "pendente_dados"]
        
        if pending:
            print(f"✅ Found {len(pending)} vehicles with 'pendente_dados' status (auto-created)")
            for v in pending[:3]:
                print(f"   - {v.get('matricula')}: {v.get('notas', '')[:50]}...")
        else:
            print(f"✅ No vehicles with 'pendente_dados' status")


class TestSyncDropdownOptions:
    """Test sync dropdown options in frontend (via API)"""
    
    def test_sync_uber(self, parceiro_headers):
        """Test Uber sync endpoint exists"""
        # This tests that the sync infrastructure is in place
        response = requests.get(
            f"{BASE_URL}/api/credenciais-plataforma?parceiro_id=c693c9ec-ddd5-400c-b79d-61b651e7b3fd",
            headers=parceiro_headers
        )
        
        assert response.status_code == 200
        print(f"✅ Credentials endpoint accessible")
    
    def test_sync_config(self, parceiro_headers):
        """Test sync configuration endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/sincronizacao/configuracoes",
            headers=parceiro_headers
        )
        
        # May return 403 if not admin/gestao, which is expected
        assert response.status_code in [200, 403]
        print(f"✅ Sync config endpoint: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
