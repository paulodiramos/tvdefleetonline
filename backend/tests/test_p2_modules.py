"""
Test cases for P2 Features:
- gestao_documentos module (tipo_cobranca: por_veiculo_motorista)
- alertas_avancados module (tipo_cobranca: fixo)
- comissoes_avancadas module (tipo_cobranca: por_motorista)
- Dashboard statistics for Módulos and Categorias tabs
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestP2Modules:
    """Test P2 Module features - gestao_documentos, alertas_avancados, comissoes_avancadas"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    # ============ gestao_documentos Module Tests ============
    
    def test_gestao_documentos_exists_in_db(self):
        """Verify gestao_documentos module exists with tipo_cobranca 'por_veiculo_motorista'"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        modules = response.json()
        gestao_doc = next((m for m in modules if m.get("codigo") == "gestao_documentos"), None)
        
        assert gestao_doc is not None, "gestao_documentos module not found"
        assert gestao_doc["tipo_cobranca"] == "por_veiculo_motorista", f"Expected tipo_cobranca 'por_veiculo_motorista', got '{gestao_doc['tipo_cobranca']}'"
        assert gestao_doc["nome"] == "Gestão de Documentos"
        assert gestao_doc["ativo"] == True
        print(f"✅ gestao_documentos: tipo_cobranca={gestao_doc['tipo_cobranca']}")
    
    def test_gestao_documentos_has_correct_pricing(self):
        """Verify gestao_documentos has pricing for base, por_veiculo and por_motorista"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        modules = response.json()
        gestao_doc = next((m for m in modules if m.get("codigo") == "gestao_documentos"), None)
        assert gestao_doc is not None
        
        precos = gestao_doc.get("precos", {})
        
        # Check base prices
        assert "mensal" in precos, "Missing base mensal price"
        assert precos["mensal"] > 0, "Base mensal price should be > 0"
        
        # Check per vehicle prices
        assert "por_veiculo_mensal" in precos, "Missing por_veiculo_mensal price"
        assert precos["por_veiculo_mensal"] > 0, "por_veiculo_mensal price should be > 0"
        
        # Check per driver prices
        assert "por_motorista_mensal" in precos, "Missing por_motorista_mensal price"
        assert precos["por_motorista_mensal"] > 0, "por_motorista_mensal price should be > 0"
        
        print(f"✅ gestao_documentos pricing: base={precos['mensal']}, por_veiculo={precos['por_veiculo_mensal']}, por_motorista={precos['por_motorista_mensal']}")
    
    def test_gestao_documentos_has_funcionalidades(self):
        """Verify gestao_documentos has funcionalidades defined"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        modules = response.json()
        gestao_doc = next((m for m in modules if m.get("codigo") == "gestao_documentos"), None)
        assert gestao_doc is not None
        
        funcionalidades = gestao_doc.get("funcionalidades", [])
        assert len(funcionalidades) > 0, "gestao_documentos should have funcionalidades"
        
        # Check for expected features
        expected_features = ["upload_documentos", "validacao_documentos", "alertas_expiracao"]
        for feature in expected_features:
            assert feature in funcionalidades, f"Missing expected funcionalidade: {feature}"
        
        print(f"✅ gestao_documentos funcionalidades: {funcionalidades}")
    
    # ============ alertas_avancados Module Tests ============
    
    def test_alertas_avancados_exists_in_db(self):
        """Verify alertas_avancados module exists with tipo_cobranca 'fixo'"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        modules = response.json()
        alertas = next((m for m in modules if m.get("codigo") == "alertas_avancados"), None)
        
        assert alertas is not None, "alertas_avancados module not found"
        assert alertas["tipo_cobranca"] == "fixo", f"Expected tipo_cobranca 'fixo', got '{alertas['tipo_cobranca']}'"
        assert alertas["nome"] == "Alertas Avançados"
        assert alertas["ativo"] == True
        print(f"✅ alertas_avancados: tipo_cobranca={alertas['tipo_cobranca']}")
    
    def test_alertas_avancados_has_correct_pricing(self):
        """Verify alertas_avancados has fixed pricing"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        modules = response.json()
        alertas = next((m for m in modules if m.get("codigo") == "alertas_avancados"), None)
        assert alertas is not None
        
        precos = alertas.get("precos", {})
        
        # Check fixed prices
        assert "semanal" in precos, "Missing semanal price"
        assert "mensal" in precos, "Missing mensal price"
        assert "anual" in precos, "Missing anual price"
        assert precos["mensal"] > 0, "Mensal price should be > 0"
        
        print(f"✅ alertas_avancados pricing: semanal={precos['semanal']}, mensal={precos['mensal']}, anual={precos['anual']}")
    
    def test_alertas_avancados_has_funcionalidades(self):
        """Verify alertas_avancados has funcionalidades defined"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        modules = response.json()
        alertas = next((m for m in modules if m.get("codigo") == "alertas_avancados"), None)
        assert alertas is not None
        
        funcionalidades = alertas.get("funcionalidades", [])
        assert len(funcionalidades) > 0, "alertas_avancados should have funcionalidades"
        
        # Check for expected features
        expected_features = ["alertas_email", "alertas_sms", "alertas_push"]
        for feature in expected_features:
            assert feature in funcionalidades, f"Missing expected funcionalidade: {feature}"
        
        print(f"✅ alertas_avancados funcionalidades: {funcionalidades}")
    
    # ============ comissoes_avancadas Module Tests ============
    
    def test_comissoes_avancadas_exists_in_db(self):
        """Verify comissoes_avancadas module exists with tipo_cobranca 'por_motorista'"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        modules = response.json()
        comissoes = next((m for m in modules if m.get("codigo") == "comissoes_avancadas"), None)
        
        assert comissoes is not None, "comissoes_avancadas module not found"
        assert comissoes["tipo_cobranca"] == "por_motorista", f"Expected tipo_cobranca 'por_motorista', got '{comissoes['tipo_cobranca']}'"
        assert comissoes["nome"] == "Comissões Avançadas"
        assert comissoes["ativo"] == True
        print(f"✅ comissoes_avancadas: tipo_cobranca={comissoes['tipo_cobranca']}")
    
    def test_comissoes_avancadas_has_correct_pricing(self):
        """Verify comissoes_avancadas has per-driver pricing"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        modules = response.json()
        comissoes = next((m for m in modules if m.get("codigo") == "comissoes_avancadas"), None)
        assert comissoes is not None
        
        precos = comissoes.get("precos", {})
        
        # Check base prices
        assert "mensal" in precos, "Missing base mensal price"
        
        # Check per driver prices
        assert "por_motorista_mensal" in precos, "Missing por_motorista_mensal price"
        assert precos["por_motorista_mensal"] > 0, "por_motorista_mensal price should be > 0"
        
        print(f"✅ comissoes_avancadas pricing: base={precos.get('mensal', 0)}, por_motorista={precos['por_motorista_mensal']}")
    
    def test_comissoes_avancadas_has_funcionalidades(self):
        """Verify comissoes_avancadas has funcionalidades defined"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        modules = response.json()
        comissoes = next((m for m in modules if m.get("codigo") == "comissoes_avancadas"), None)
        assert comissoes is not None
        
        funcionalidades = comissoes.get("funcionalidades", [])
        assert len(funcionalidades) > 0, "comissoes_avancadas should have funcionalidades"
        
        # Check for expected features
        expected_features = ["escalas_comissao", "calculo_automatico", "bonus_performance"]
        for feature in expected_features:
            assert feature in funcionalidades, f"Missing expected funcionalidade: {feature}"
        
        print(f"✅ comissoes_avancadas funcionalidades: {funcionalidades}")
    
    # ============ API Returns P2 Modules Tests ============
    
    def test_api_returns_all_three_p2_modules(self):
        """Verify GET /api/gestao-planos/modulos returns all 3 new P2 modules"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/modulos?apenas_ativos=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        modules = response.json()
        module_codes = [m.get("codigo") for m in modules]
        
        p2_modules = ["gestao_documentos", "alertas_avancados", "comissoes_avancadas"]
        
        for code in p2_modules:
            assert code in module_codes, f"P2 module {code} not found in API response"
        
        print(f"✅ All 3 P2 modules found in API response")
    
    # ============ Statistics API Tests ============
    
    def test_statistics_endpoint_returns_modulos_count(self):
        """Verify GET /api/gestao-planos/estatisticas returns módulos count"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/estatisticas",
            headers=self.headers
        )
        assert response.status_code == 200
        
        stats = response.json()
        
        assert "modulos" in stats, "Statistics should include modulos"
        assert "total" in stats["modulos"], "Modulos should have total count"
        assert stats["modulos"]["total"] >= 3, "Should have at least 3 modules (P2 modules)"
        
        print(f"✅ Statistics: modulos.total={stats['modulos']['total']}")
    
    def test_statistics_endpoint_returns_planos_count(self):
        """Verify GET /api/gestao-planos/estatisticas returns planos count"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/estatisticas",
            headers=self.headers
        )
        assert response.status_code == 200
        
        stats = response.json()
        
        assert "planos" in stats, "Statistics should include planos"
        assert "total" in stats["planos"], "Planos should have total count"
        
        print(f"✅ Statistics: planos.total={stats['planos']['total']}")
    
    # ============ Categorias Tests ============
    
    def test_categorias_endpoint_works(self):
        """Verify GET /api/gestao-planos/categorias returns categories"""
        response = requests.get(
            f"{BASE_URL}/api/gestao-planos/categorias?apenas_ativas=false",
            headers=self.headers
        )
        assert response.status_code == 200
        
        categorias = response.json()
        assert isinstance(categorias, list), "Categorias should be a list"
        
        print(f"✅ Categorias endpoint works, returned {len(categorias)} categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
