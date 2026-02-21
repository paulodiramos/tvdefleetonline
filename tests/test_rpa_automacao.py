"""
RPA Automação API Tests
Tests for the complete RPA automation system for extracting data from platforms without API
(Uber, Bolt, Via Verde, Prio)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vps-preview.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestPlataformas:
    """Tests for GET /api/rpa-auto/plataformas - List available platforms"""
    
    def test_list_plataformas_returns_4_platforms(self):
        """Should return exactly 4 platforms: uber, bolt, viaverde, prio"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/plataformas")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 4
        
        platform_ids = [p["id"] for p in data]
        assert "uber" in platform_ids
        assert "bolt" in platform_ids
        assert "viaverde" in platform_ids
        assert "prio" in platform_ids
    
    def test_plataformas_have_required_fields(self):
        """Each platform should have all required fields"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/plataformas")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["id", "nome", "icone", "cor", "descricao", "tipos_extracao", "campos_credenciais", "requer_2fa", "url_login"]
        
        for platform in data:
            for field in required_fields:
                assert field in platform, f"Platform {platform.get('id')} missing field: {field}"
    
    def test_uber_platform_details(self):
        """Uber platform should have correct configuration"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/plataformas")
        assert response.status_code == 200
        
        data = response.json()
        uber = next((p for p in data if p["id"] == "uber"), None)
        
        assert uber is not None
        assert uber["nome"] == "Uber Driver"
        assert uber["requer_2fa"] == True
        assert "ganhos" in uber["tipos_extracao"]
    
    def test_prio_platform_details(self):
        """Prio platform should have correct configuration"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/plataformas")
        assert response.status_code == 200
        
        data = response.json()
        prio = next((p for p in data if p["id"] == "prio"), None)
        
        assert prio is not None
        assert prio["nome"] == "Prio Energy"
        assert prio["requer_2fa"] == False
        assert "combustivel" in prio["tipos_extracao"]
        assert "eletrico" in prio["tipos_extracao"]


class TestCredenciais:
    """Tests for credentials management endpoints"""
    
    def test_create_credentials(self, auth_headers):
        """POST /api/rpa-auto/credenciais - Should create encrypted credentials"""
        # Create credentials for viaverde (not used by other tests)
        response = requests.post(
            f"{BASE_URL}/api/rpa-auto/credenciais",
            headers=auth_headers,
            json={
                "plataforma": "viaverde",
                "email": "test_viaverde@test.com",
                "password": "testpassword123"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "id" in data
        assert data["message"] in ["Credenciais guardadas com sucesso", "Credenciais atualizadas com sucesso"]
    
    def test_list_credentials_without_password(self, auth_headers):
        """GET /api/rpa-auto/credenciais - Should list credentials without showing password"""
        response = requests.get(
            f"{BASE_URL}/api/rpa-auto/credenciais",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check that password is not exposed
        for cred in data:
            assert "password" not in cred
            assert "password_encrypted" not in cred
            assert "email" in cred  # Email should be decrypted and shown
    
    def test_get_credential_status_for_platform(self, auth_headers):
        """GET /api/rpa-auto/credenciais/{plataforma} - Should return configuration status"""
        # Check prio (should be configured from previous tests)
        response = requests.get(
            f"{BASE_URL}/api/rpa-auto/credenciais/prio",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "configurado" in data
        assert isinstance(data["configurado"], bool)
    
    def test_delete_credentials(self, auth_headers):
        """DELETE /api/rpa-auto/credenciais/{plataforma} - Should delete credentials"""
        # First create credentials to delete
        requests.post(
            f"{BASE_URL}/api/rpa-auto/credenciais",
            headers=auth_headers,
            json={
                "plataforma": "uber",
                "email": "test_delete@test.com",
                "password": "testpassword"
            }
        )
        
        # Delete the credentials
        response = requests.delete(
            f"{BASE_URL}/api/rpa-auto/credenciais/uber",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["message"] == "Credenciais eliminadas"
        
        # Verify deletion
        check_response = requests.get(
            f"{BASE_URL}/api/rpa-auto/credenciais/uber",
            headers=auth_headers
        )
        assert check_response.json()["configurado"] == False
    
    def test_create_credentials_invalid_platform(self, auth_headers):
        """POST /api/rpa-auto/credenciais - Should reject invalid platform"""
        response = requests.post(
            f"{BASE_URL}/api/rpa-auto/credenciais",
            headers=auth_headers,
            json={
                "plataforma": "invalid_platform",
                "email": "test@test.com",
                "password": "testpassword"
            }
        )
        assert response.status_code == 400
        assert "Plataforma inválida" in response.json()["detail"]


class TestExecucoes:
    """Tests for execution management endpoints"""
    
    def test_execute_automation(self, auth_headers):
        """POST /api/rpa-auto/executar - Should start automation execution"""
        response = requests.post(
            f"{BASE_URL}/api/rpa-auto/executar",
            headers=auth_headers,
            json={
                "plataforma": "prio",
                "tipo_extracao": "todos"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["message"] == "Execução iniciada"
        assert "execucao_id" in data
        assert data["status"] == "pendente"
    
    def test_execute_without_credentials(self, auth_headers):
        """POST /api/rpa-auto/executar - Should fail if no credentials configured"""
        # First ensure bolt has no credentials
        requests.delete(
            f"{BASE_URL}/api/rpa-auto/credenciais/bolt",
            headers=auth_headers
        )
        
        response = requests.post(
            f"{BASE_URL}/api/rpa-auto/executar",
            headers=auth_headers,
            json={
                "plataforma": "bolt",
                "tipo_extracao": "ganhos"
            }
        )
        assert response.status_code == 400
        assert "Credenciais não configuradas" in response.json()["detail"]
    
    def test_list_executions(self, auth_headers):
        """GET /api/rpa-auto/execucoes - Should list execution history"""
        response = requests.get(
            f"{BASE_URL}/api/rpa-auto/execucoes",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check structure of executions
        if len(data) > 0:
            exec_item = data[0]
            assert "id" in exec_item
            assert "plataforma" in exec_item
            assert "status" in exec_item
            assert "created_at" in exec_item
    
    def test_get_execution_details_with_logs(self, auth_headers):
        """GET /api/rpa-auto/execucoes/{id} - Should return execution details with logs"""
        # First get list of executions
        list_response = requests.get(
            f"{BASE_URL}/api/rpa-auto/execucoes",
            headers=auth_headers
        )
        executions = list_response.json()
        
        if len(executions) > 0:
            exec_id = executions[0]["id"]
            
            response = requests.get(
                f"{BASE_URL}/api/rpa-auto/execucoes/{exec_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            
            data = response.json()
            assert "logs" in data  # Detailed logs should be included
            assert "screenshots" in data
            assert "erros" in data
    
    def test_get_execution_not_found(self, auth_headers):
        """GET /api/rpa-auto/execucoes/{id} - Should return 404 for invalid ID"""
        fake_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/rpa-auto/execucoes/{fake_id}",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestAgendamentos:
    """Tests for scheduling management endpoints"""
    
    def test_create_agendamento(self, auth_headers):
        """POST /api/rpa-auto/agendamentos - Should create automatic schedule"""
        # First ensure viaverde has credentials
        requests.post(
            f"{BASE_URL}/api/rpa-auto/credenciais",
            headers=auth_headers,
            json={
                "plataforma": "viaverde",
                "email": "test@viaverde.pt",
                "password": "testpass"
            }
        )
        
        response = requests.post(
            f"{BASE_URL}/api/rpa-auto/agendamentos",
            headers=auth_headers,
            json={
                "plataforma": "viaverde",
                "tipo_extracao": "portagens",
                "frequencia": "semanal",
                "dia_semana": 1,
                "hora": "06:00",
                "ativo": True
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["message"] == "Agendamento criado"
        assert "id" in data
    
    def test_list_agendamentos(self, auth_headers):
        """GET /api/rpa-auto/agendamentos - Should list active schedules"""
        response = requests.get(
            f"{BASE_URL}/api/rpa-auto/agendamentos",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check structure
        if len(data) > 0:
            agend = data[0]
            assert "id" in agend
            assert "plataforma" in agend
            assert "frequencia" in agend
            assert "hora" in agend
            assert "proxima_execucao" in agend
    
    def test_delete_agendamento(self, auth_headers):
        """DELETE /api/rpa-auto/agendamentos/{id} - Should delete schedule"""
        # Get list of agendamentos
        list_response = requests.get(
            f"{BASE_URL}/api/rpa-auto/agendamentos",
            headers=auth_headers
        )
        agendamentos = list_response.json()
        
        if len(agendamentos) > 0:
            agend_id = agendamentos[0]["id"]
            
            response = requests.delete(
                f"{BASE_URL}/api/rpa-auto/agendamentos/{agend_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            assert response.json()["message"] == "Agendamento eliminado"
    
    def test_create_duplicate_agendamento_fails(self, auth_headers):
        """POST /api/rpa-auto/agendamentos - Should fail for duplicate platform schedule"""
        # Create first schedule
        requests.post(
            f"{BASE_URL}/api/rpa-auto/agendamentos",
            headers=auth_headers,
            json={
                "plataforma": "prio",
                "tipo_extracao": "todos",
                "frequencia": "diario",
                "hora": "08:00",
                "ativo": True
            }
        )
        
        # Try to create duplicate
        response = requests.post(
            f"{BASE_URL}/api/rpa-auto/agendamentos",
            headers=auth_headers,
            json={
                "plataforma": "prio",
                "tipo_extracao": "combustivel",
                "frequencia": "semanal",
                "dia_semana": 3,
                "hora": "10:00",
                "ativo": True
            }
        )
        assert response.status_code == 400
        assert "Já existe um agendamento" in response.json()["detail"]


class TestEstatisticas:
    """Tests for statistics endpoint"""
    
    def test_get_estatisticas(self, auth_headers):
        """GET /api/rpa-auto/estatisticas - Should return RPA statistics"""
        response = requests.get(
            f"{BASE_URL}/api/rpa-auto/estatisticas",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        assert "total_execucoes" in data
        assert "execucoes_sucesso" in data
        assert "execucoes_erro" in data
        assert "taxa_sucesso" in data
        assert "credenciais_configuradas" in data
        assert "agendamentos_ativos" in data
        assert "ultimas_execucoes" in data
        assert "por_plataforma" in data
        
        # Check data types
        assert isinstance(data["total_execucoes"], int)
        assert isinstance(data["taxa_sucesso"], (int, float))
        assert isinstance(data["ultimas_execucoes"], list)


class TestAuthRequired:
    """Tests to verify authentication is required"""
    
    def test_credenciais_requires_auth(self):
        """GET /api/rpa-auto/credenciais - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/credenciais")
        assert response.status_code in [401, 403]  # 403 is also valid for unauthorized
    
    def test_execucoes_requires_auth(self):
        """GET /api/rpa-auto/execucoes - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/execucoes")
        assert response.status_code in [401, 403]
    
    def test_agendamentos_requires_auth(self):
        """GET /api/rpa-auto/agendamentos - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/agendamentos")
        assert response.status_code in [401, 403]
    
    def test_estatisticas_requires_auth(self):
        """GET /api/rpa-auto/estatisticas - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/estatisticas")
        assert response.status_code in [401, 403]
    
    def test_plataformas_public(self):
        """GET /api/rpa-auto/plataformas - Should be public (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/plataformas")
        assert response.status_code == 200


# Cleanup fixture to run after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup(auth_headers):
    """Cleanup test data after all tests"""
    yield
    # Clean up test credentials
    for platform in ["viaverde", "uber", "bolt"]:
        try:
            requests.delete(
                f"{BASE_URL}/api/rpa-auto/credenciais/{platform}",
                headers=auth_headers
            )
        except:
            pass
    
    # Clean up test agendamentos
    try:
        agend_response = requests.get(
            f"{BASE_URL}/api/rpa-auto/agendamentos",
            headers=auth_headers
        )
        for agend in agend_response.json():
            requests.delete(
                f"{BASE_URL}/api/rpa-auto/agendamentos/{agend['id']}",
                headers=auth_headers
            )
    except:
        pass
