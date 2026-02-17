"""
Test P0 Features for Gestão de Planos:
1. Bidirectional price calculation (frontend logic, not tested here)
2. Trial configuration (trial_config)
3. Referência de faturação (referencia_faturacao)

Tests the backend API endpoints for these features.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@tvdefleet.com", "password": "admin123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    })
    return session


class TestTrialConfig:
    """Test P0 Feature: Trial Configuration"""
    
    def test_create_plan_with_trial_config(self, admin_client):
        """Test creating a plan with full trial_config"""
        unique_name = f"TEST_Trial_Config_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "nome": unique_name,
            "descricao": "Plano para testar trial_config",
            "tipo_usuario": "parceiro",
            "categoria": "standard",
            "precos": {"semanal": 10, "mensal": 40, "anual": 520},
            "precos_plano": {
                "base_semanal": 10,
                "base_mensal": 40,
                "base_anual": 520,
                "por_veiculo_semanal": 0,
                "por_veiculo_mensal": 0,
                "por_veiculo_anual": 0,
                "por_motorista_semanal": 0,
                "por_motorista_mensal": 0,
                "por_motorista_anual": 0,
                "setup": 0
            },
            "permite_trial": True,
            "dias_trial": 21,
            "trial_config": {
                "ativo": True,
                "dias": 21,
                "requer_cartao": True,
                "automatico": True
            },
            "features_destaque": [],
            "modulos_incluidos": []
        }
        
        response = admin_client.post(f"{BASE_URL}/api/gestao-planos/planos", json=payload)
        assert response.status_code == 200, f"Create plan failed: {response.text}"
        
        data = response.json()
        
        # Verify trial_config was saved
        assert "trial_config" in data, "trial_config not in response"
        assert data["trial_config"]["ativo"] == True, "trial_config.ativo should be True"
        assert data["trial_config"]["dias"] == 21, "trial_config.dias should be 21"
        assert data["trial_config"]["requer_cartao"] == True, "trial_config.requer_cartao should be True"
        assert data["trial_config"]["automatico"] == True, "trial_config.automatico should be True"
        
        # Verify data persistence via GET
        plan_id = data["id"]
        get_response = admin_client.get(f"{BASE_URL}/api/gestao-planos/planos/{plan_id}")
        assert get_response.status_code == 200, f"GET plan failed: {get_response.text}"
        
        fetched_plan = get_response.json()
        assert fetched_plan["trial_config"]["ativo"] == True
        assert fetched_plan["trial_config"]["requer_cartao"] == True
        
        print(f"✓ Plan '{unique_name}' created with trial_config successfully")


class TestReferenciaFaturacao:
    """Test P0 Feature: Referência Interna de Faturação"""
    
    def test_create_plan_with_referencia_faturacao(self, admin_client):
        """Test creating a plan with referencia_faturacao"""
        unique_name = f"TEST_Ref_Faturacao_{uuid.uuid4().hex[:8]}"
        ref_code = f"REF-{uuid.uuid4().hex[:6].upper()}"
        
        payload = {
            "nome": unique_name,
            "descricao": "Plano para testar referencia_faturacao",
            "tipo_usuario": "parceiro",
            "categoria": "standard",
            "precos": {"semanal": 15, "mensal": 60, "anual": 780},
            "precos_plano": {
                "base_semanal": 15,
                "base_mensal": 60,
                "base_anual": 780,
                "por_veiculo_semanal": 0,
                "por_veiculo_mensal": 0,
                "por_veiculo_anual": 0,
                "por_motorista_semanal": 0,
                "por_motorista_mensal": 0,
                "por_motorista_anual": 0,
                "setup": 0
            },
            "permite_trial": False,
            "dias_trial": 0,
            "referencia_faturacao": ref_code,
            "features_destaque": [],
            "modulos_incluidos": []
        }
        
        response = admin_client.post(f"{BASE_URL}/api/gestao-planos/planos", json=payload)
        assert response.status_code == 200, f"Create plan failed: {response.text}"
        
        data = response.json()
        
        # Verify referencia_faturacao was saved
        assert "referencia_faturacao" in data, "referencia_faturacao not in response"
        assert data["referencia_faturacao"] == ref_code, f"referencia_faturacao should be {ref_code}"
        
        # Verify data persistence via GET
        plan_id = data["id"]
        get_response = admin_client.get(f"{BASE_URL}/api/gestao-planos/planos/{plan_id}")
        assert get_response.status_code == 200, f"GET plan failed: {get_response.text}"
        
        fetched_plan = get_response.json()
        assert fetched_plan["referencia_faturacao"] == ref_code
        
        print(f"✓ Plan '{unique_name}' created with referencia_faturacao '{ref_code}' successfully")


class TestTaxaIVA:
    """Test P0 Feature: Taxa de IVA configurável"""
    
    def test_create_plan_with_custom_taxa_iva(self, admin_client):
        """Test creating a plan with custom taxa_iva"""
        unique_name = f"TEST_IVA_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "nome": unique_name,
            "descricao": "Plano para testar taxa_iva",
            "tipo_usuario": "parceiro",
            "categoria": "standard",
            "precos": {"semanal": 20, "mensal": 80, "anual": 1040},
            "precos_plano": {
                "base_semanal": 20,
                "base_mensal": 80,
                "base_anual": 1040,
                "por_veiculo_semanal": 0,
                "por_veiculo_mensal": 0,
                "por_veiculo_anual": 0,
                "por_motorista_semanal": 0,
                "por_motorista_mensal": 0,
                "por_motorista_anual": 0,
                "setup": 0
            },
            "taxa_iva": 15,  # Custom IVA rate
            "permite_trial": False,
            "dias_trial": 0,
            "features_destaque": [],
            "modulos_incluidos": []
        }
        
        response = admin_client.post(f"{BASE_URL}/api/gestao-planos/planos", json=payload)
        assert response.status_code == 200, f"Create plan failed: {response.text}"
        
        data = response.json()
        
        # Verify taxa_iva was saved
        assert "taxa_iva" in data, "taxa_iva not in response"
        assert data["taxa_iva"] == 15, "taxa_iva should be 15"
        
        # Verify data persistence via GET
        plan_id = data["id"]
        get_response = admin_client.get(f"{BASE_URL}/api/gestao-planos/planos/{plan_id}")
        assert get_response.status_code == 200, f"GET plan failed: {get_response.text}"
        
        fetched_plan = get_response.json()
        assert fetched_plan["taxa_iva"] == 15
        
        print(f"✓ Plan '{unique_name}' created with taxa_iva 15% successfully")


class TestPrecosPlano:
    """Test P0 Feature: Bidirectional price structure (precos_plano)"""
    
    def test_create_plan_with_full_precos_plano(self, admin_client):
        """Test creating a plan with full precos_plano structure"""
        unique_name = f"TEST_Precos_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "nome": unique_name,
            "descricao": "Plano para testar precos_plano",
            "tipo_usuario": "parceiro",
            "categoria": "standard",
            "precos": {"semanal": 25, "mensal": 100, "anual": 1300},
            "precos_plano": {
                "base_semanal": 25,
                "base_mensal": 100,
                "base_anual": 1300,
                "por_veiculo_semanal": 5,
                "por_veiculo_mensal": 20,
                "por_veiculo_anual": 260,
                "por_motorista_semanal": 3,
                "por_motorista_mensal": 12,
                "por_motorista_anual": 156,
                "setup": 50
            },
            "permite_trial": False,
            "dias_trial": 0,
            "features_destaque": [],
            "modulos_incluidos": []
        }
        
        response = admin_client.post(f"{BASE_URL}/api/gestao-planos/planos", json=payload)
        assert response.status_code == 200, f"Create plan failed: {response.text}"
        
        data = response.json()
        
        # Verify precos_plano was saved correctly
        assert "precos_plano" in data, "precos_plano not in response"
        
        precos = data["precos_plano"]
        assert precos["base_semanal"] == 25
        assert precos["base_mensal"] == 100
        assert precos["base_anual"] == 1300
        assert precos["por_veiculo_semanal"] == 5
        assert precos["por_veiculo_mensal"] == 20
        assert precos["por_veiculo_anual"] == 260
        assert precos["por_motorista_semanal"] == 3
        assert precos["por_motorista_mensal"] == 12
        assert precos["por_motorista_anual"] == 156
        assert precos["setup"] == 50
        
        # Verify persistence
        plan_id = data["id"]
        get_response = admin_client.get(f"{BASE_URL}/api/gestao-planos/planos/{plan_id}")
        fetched = get_response.json()["precos_plano"]
        
        assert fetched["base_semanal"] == 25
        assert fetched["por_veiculo_anual"] == 260
        
        print(f"✓ Plan '{unique_name}' created with full precos_plano successfully")


class TestCombinedFeatures:
    """Test all P0 features combined"""
    
    def test_create_plan_with_all_p0_features(self, admin_client):
        """Test creating a plan with ALL P0 features enabled"""
        unique_name = f"TEST_All_P0_{uuid.uuid4().hex[:8]}"
        ref_code = f"ALL-P0-{uuid.uuid4().hex[:6].upper()}"
        
        payload = {
            "nome": unique_name,
            "descricao": "Plano com todas as funcionalidades P0",
            "tipo_usuario": "parceiro",
            "categoria": "profissional",
            "precos": {"semanal": 50, "mensal": 200, "anual": 2600},
            "precos_plano": {
                "base_semanal": 50,
                "base_mensal": 200,
                "base_anual": 2600,
                "por_veiculo_semanal": 10,
                "por_veiculo_mensal": 40,
                "por_veiculo_anual": 520,
                "por_motorista_semanal": 5,
                "por_motorista_mensal": 20,
                "por_motorista_anual": 260,
                "setup": 100
            },
            "permite_trial": True,
            "dias_trial": 30,
            "trial_config": {
                "ativo": True,
                "dias": 30,
                "requer_cartao": True,
                "automatico": False
            },
            "referencia_faturacao": ref_code,
            "taxa_iva": 23,
            "features_destaque": ["Feature 1", "Feature 2"],
            "modulos_incluidos": []
        }
        
        response = admin_client.post(f"{BASE_URL}/api/gestao-planos/planos", json=payload)
        assert response.status_code == 200, f"Create plan failed: {response.text}"
        
        data = response.json()
        
        # Verify ALL P0 features
        # 1. trial_config
        assert data["trial_config"]["ativo"] == True
        assert data["trial_config"]["dias"] == 30
        assert data["trial_config"]["requer_cartao"] == True
        assert data["trial_config"]["automatico"] == False
        
        # 2. referencia_faturacao
        assert data["referencia_faturacao"] == ref_code
        
        # 3. taxa_iva
        assert data["taxa_iva"] == 23
        
        # 4. precos_plano (bidirectional price structure)
        assert data["precos_plano"]["base_semanal"] == 50
        assert data["precos_plano"]["por_veiculo_mensal"] == 40
        assert data["precos_plano"]["por_motorista_anual"] == 260
        
        # Verify persistence
        plan_id = data["id"]
        get_response = admin_client.get(f"{BASE_URL}/api/gestao-planos/planos/{plan_id}")
        fetched = get_response.json()
        
        assert fetched["trial_config"]["ativo"] == True
        assert fetched["referencia_faturacao"] == ref_code
        assert fetched["taxa_iva"] == 23
        
        print(f"✓ Plan '{unique_name}' created with ALL P0 features successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
