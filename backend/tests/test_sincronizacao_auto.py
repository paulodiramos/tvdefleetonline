"""
Test Suite for Sincronização Automática APIs
Tests: GET/PUT config, POST executar, GET historico, GET estatisticas
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "zeny123"
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"


@pytest.fixture(scope="module")
def parceiro_token():
    """Get parceiro authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


class TestSincronizacaoAutoConfig:
    """Tests for GET/PUT /api/sincronizacao-auto/config"""
    
    def test_get_config_success(self, parceiro_token):
        """Test GET config returns valid structure"""
        response = requests.get(
            f"{BASE_URL}/api/sincronizacao-auto/config",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "parceiro_id" in data
        assert "fontes" in data
        assert "agendamento_global" in data
        assert "fontes_info" in data
        
        # Verify fontes_info has all 4 sources
        fontes_info = data["fontes_info"]
        assert "uber" in fontes_info
        assert "bolt" in fontes_info
        assert "viaverde" in fontes_info
        assert "abastecimentos" in fontes_info
        
        # Verify each fonte has required fields
        for fonte_key, fonte_data in fontes_info.items():
            assert "nome" in fonte_data
            assert "icone" in fonte_data
            assert "cor" in fonte_data
            assert "tipo" in fonte_data
            assert "metodos" in fonte_data
            assert "descricao" in fonte_data
    
    def test_get_config_unauthorized(self):
        """Test GET config without token returns 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/sincronizacao-auto/config")
        assert response.status_code in [401, 403]
    
    def test_put_config_update_fontes(self, parceiro_token):
        """Test PUT config updates fontes correctly"""
        config_update = {
            "fontes": {
                "uber": {"ativo": True, "metodo": "rpa"},
                "bolt": {"ativo": True, "metodo": "csv"},
                "viaverde": {"ativo": False, "metodo": "csv"},
                "abastecimentos": {"ativo": False, "metodo": "csv"}
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sincronizacao-auto/config",
            headers={
                "Authorization": f"Bearer {parceiro_token}",
                "Content-Type": "application/json"
            },
            json=config_update
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] == True
        assert "mensagem" in data
        
        # Verify update persisted
        get_response = requests.get(
            f"{BASE_URL}/api/sincronizacao-auto/config",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert get_response.status_code == 200
        config = get_response.json()
        assert config["fontes"]["uber"]["ativo"] == True
        assert config["fontes"]["uber"]["metodo"] == "rpa"
        assert config["fontes"]["bolt"]["ativo"] == True
        assert config["fontes"]["bolt"]["metodo"] == "csv"
    
    def test_put_config_update_agendamento(self, parceiro_token):
        """Test PUT config updates agendamento correctly"""
        config_update = {
            "agendamento_global": {
                "ativo": True,
                "frequencia": "semanal",
                "dia_semana": 1,
                "hora": "06:00"
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sincronizacao-auto/config",
            headers={
                "Authorization": f"Bearer {parceiro_token}",
                "Content-Type": "application/json"
            },
            json=config_update
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] == True
        
        # Verify update persisted
        get_response = requests.get(
            f"{BASE_URL}/api/sincronizacao-auto/config",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        config = get_response.json()
        assert config["agendamento_global"]["ativo"] == True
        assert config["agendamento_global"]["frequencia"] == "semanal"
        assert config["agendamento_global"]["dia_semana"] == 1
    
    def test_put_config_update_resumo_semanal(self, parceiro_token):
        """Test PUT config updates resumo_semanal correctly"""
        config_update = {
            "resumo_semanal": {
                "gerar_automaticamente": True,
                "enviar_email_motoristas": True,
                "enviar_whatsapp_motoristas": False
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sincronizacao-auto/config",
            headers={
                "Authorization": f"Bearer {parceiro_token}",
                "Content-Type": "application/json"
            },
            json=config_update
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] == True
    
    def test_put_config_update_notificacoes(self, parceiro_token):
        """Test PUT config updates notificacoes correctly"""
        config_update = {
            "notificacoes": {
                "email_parceiro": True,
                "notificacao_sistema": True,
                "whatsapp_parceiro": False
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sincronizacao-auto/config",
            headers={
                "Authorization": f"Bearer {parceiro_token}",
                "Content-Type": "application/json"
            },
            json=config_update
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] == True


class TestSincronizacaoAutoExecutar:
    """Tests for POST /api/sincronizacao-auto/executar"""
    
    def test_executar_single_fonte(self, parceiro_token):
        """Test manual sync execution for single fonte"""
        response = requests.post(
            f"{BASE_URL}/api/sincronizacao-auto/executar",
            headers={
                "Authorization": f"Bearer {parceiro_token}",
                "Content-Type": "application/json"
            },
            json={"fontes": ["bolt"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "sucesso" in data
        assert "execucao_id" in data
        assert "status" in data
        assert "resultados" in data
        
        # Verify bolt result
        assert "bolt" in data["resultados"]
        bolt_result = data["resultados"]["bolt"]
        assert "sucesso" in bolt_result
        assert "metodo" in bolt_result
    
    def test_executar_multiple_fontes(self, parceiro_token):
        """Test manual sync execution for multiple fontes"""
        response = requests.post(
            f"{BASE_URL}/api/sincronizacao-auto/executar",
            headers={
                "Authorization": f"Bearer {parceiro_token}",
                "Content-Type": "application/json"
            },
            json={"fontes": ["uber", "bolt"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "resultados" in data
        assert "uber" in data["resultados"]
        assert "bolt" in data["resultados"]
    
    def test_executar_no_fontes_ativas(self, parceiro_token):
        """Test sync with no active fontes returns error"""
        # First disable all fontes
        requests.put(
            f"{BASE_URL}/api/sincronizacao-auto/config",
            headers={
                "Authorization": f"Bearer {parceiro_token}",
                "Content-Type": "application/json"
            },
            json={
                "fontes": {
                    "uber": {"ativo": False, "metodo": "csv"},
                    "bolt": {"ativo": False, "metodo": "csv"},
                    "viaverde": {"ativo": False, "metodo": "csv"},
                    "abastecimentos": {"ativo": False, "metodo": "csv"}
                }
            }
        )
        
        # Try to execute without specifying fontes
        response = requests.post(
            f"{BASE_URL}/api/sincronizacao-auto/executar",
            headers={
                "Authorization": f"Bearer {parceiro_token}",
                "Content-Type": "application/json"
            },
            json={}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] == False
        assert "erro" in data
        
        # Re-enable fontes for other tests
        requests.put(
            f"{BASE_URL}/api/sincronizacao-auto/config",
            headers={
                "Authorization": f"Bearer {parceiro_token}",
                "Content-Type": "application/json"
            },
            json={
                "fontes": {
                    "uber": {"ativo": True, "metodo": "rpa"},
                    "bolt": {"ativo": True, "metodo": "csv"}
                }
            }
        )
    
    def test_executar_unauthorized(self):
        """Test executar without token returns 401 or 403"""
        response = requests.post(
            f"{BASE_URL}/api/sincronizacao-auto/executar",
            json={"fontes": ["bolt"]}
        )
        assert response.status_code in [401, 403]


class TestSincronizacaoAutoHistorico:
    """Tests for GET /api/sincronizacao-auto/historico"""
    
    def test_get_historico_success(self, parceiro_token):
        """Test GET historico returns list of executions"""
        response = requests.get(
            f"{BASE_URL}/api/sincronizacao-auto/historico?limit=10",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        # If there are executions, verify structure
        if len(data) > 0:
            exec_item = data[0]
            assert "id" in exec_item
            assert "parceiro_id" in exec_item
            assert "fontes" in exec_item
            assert "status" in exec_item
            assert "created_at" in exec_item
    
    def test_get_historico_with_limit(self, parceiro_token):
        """Test GET historico respects limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/sincronizacao-auto/historico?limit=5",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5
    
    def test_get_historico_unauthorized(self):
        """Test GET historico without token returns 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/sincronizacao-auto/historico")
        assert response.status_code in [401, 403]


class TestSincronizacaoAutoEstatisticas:
    """Tests for GET /api/sincronizacao-auto/estatisticas"""
    
    def test_get_estatisticas_success(self, parceiro_token):
        """Test GET estatisticas returns valid structure"""
        response = requests.get(
            f"{BASE_URL}/api/sincronizacao-auto/estatisticas",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "total_sincronizacoes" in data
        assert "sucessos" in data
        assert "taxa_sucesso" in data
        assert "ultima_sincronizacao" in data
        assert "ultimo_status" in data
        assert "sincronizacao_ativa" in data
        assert "agendamento_ativo" in data
        assert "proxima_execucao" in data
        
        # Verify types
        assert isinstance(data["total_sincronizacoes"], int)
        assert isinstance(data["sucessos"], int)
        assert isinstance(data["taxa_sucesso"], (int, float))
        assert isinstance(data["sincronizacao_ativa"], bool)
        assert isinstance(data["agendamento_ativo"], bool)
    
    def test_get_estatisticas_unauthorized(self):
        """Test GET estatisticas without token returns 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/sincronizacao-auto/estatisticas")
        assert response.status_code in [401, 403]


class TestSincronizacaoAutoFontes:
    """Tests for GET /api/sincronizacao-auto/fontes"""
    
    def test_get_fontes_disponiveis(self):
        """Test GET fontes returns all available data sources"""
        response = requests.get(f"{BASE_URL}/api/sincronizacao-auto/fontes")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all 4 fontes are present
        assert "uber" in data
        assert "bolt" in data
        assert "viaverde" in data
        assert "abastecimentos" in data
        
        # Verify Uber config
        uber = data["uber"]
        assert uber["nome"] == "Uber"
        assert uber["tipo"] == "ganhos"
        assert "rpa" in uber["metodos"]
        assert "csv" in uber["metodos"]
        
        # Verify Bolt config (has API option)
        bolt = data["bolt"]
        assert bolt["nome"] == "Bolt"
        assert bolt["tipo"] == "ganhos"
        assert "api" in bolt["metodos"]
        assert "rpa" in bolt["metodos"]
        assert "csv" in bolt["metodos"]
        
        # Verify Via Verde config
        viaverde = data["viaverde"]
        assert viaverde["nome"] == "Via Verde"
        assert viaverde["tipo"] == "despesas"
        
        # Verify Abastecimentos config
        abast = data["abastecimentos"]
        assert abast["nome"] == "Abastecimentos"
        assert abast["tipo"] == "despesas"


class TestSincronizacaoAutoExecucaoDetails:
    """Tests for GET /api/sincronizacao-auto/execucao/{id}"""
    
    def test_get_execucao_details(self, parceiro_token):
        """Test GET execucao details for existing execution"""
        # First create an execution
        exec_response = requests.post(
            f"{BASE_URL}/api/sincronizacao-auto/executar",
            headers={
                "Authorization": f"Bearer {parceiro_token}",
                "Content-Type": "application/json"
            },
            json={"fontes": ["bolt"]}
        )
        
        assert exec_response.status_code == 200
        exec_data = exec_response.json()
        execucao_id = exec_data["execucao_id"]
        
        # Get execution details
        response = requests.get(
            f"{BASE_URL}/api/sincronizacao-auto/execucao/{execucao_id}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == execucao_id
        assert "parceiro_id" in data
        assert "fontes" in data
        assert "status" in data
        assert "resultados" in data
    
    def test_get_execucao_not_found(self, parceiro_token):
        """Test GET execucao for non-existent ID returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/sincronizacao-auto/execucao/non-existent-id",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        
        assert response.status_code == 404
