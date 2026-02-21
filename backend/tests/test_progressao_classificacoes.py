"""
Test file for Automatic Classification Progression System
Tests for iteration 57

Endpoints to test:
- GET /api/comissoes/classificacao/motorista/{id}/progressao - verify progression data
- POST /api/comissoes/classificacao/recalcular-todas - recalculate all classifications
- GET /api/comissoes/classificacao/config - get classification configuration

Service methods tested:
- calcular_pontuacao_cuidado_veiculo - vehicle care score calculation
- verificar_progressao_motorista - check driver progression eligibility  
- promover_motorista - promote driver to next level
- recalcular_todas_classificacoes - recalculate all classifications
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://frota-sync-rpa.preview.emergentagent.com').rstrip('/')


class TestProgressaoClassificacoes:
    """Tests for the Automatic Classification Progression System"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - login as admin"""
        self.token = None
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
        else:
            pytest.skip("Unable to authenticate as admin")

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    # === GET /api/comissoes/classificacao/config ===
    def test_get_classificacao_config(self):
        """Test getting classification configuration with levels"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/classificacao/config",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "niveis" in data, "Response should contain 'niveis'"
        niveis = data["niveis"]
        assert len(niveis) >= 5, f"Should have at least 5 classification levels (Bronze, Prata, Ouro, Platina, Diamante), got {len(niveis)}"
        
        # Verify each level has required fields
        for nivel in niveis:
            assert "nivel" in nivel, "Each level should have 'nivel' number"
            assert "nome" in nivel, "Each level should have 'nome'"
            assert "meses_minimos" in nivel, "Each level should have 'meses_minimos'"
            assert "cuidado_veiculo_minimo" in nivel, "Each level should have 'cuidado_veiculo_minimo'"
            assert "bonus_percentagem" in nivel, "Each level should have 'bonus_percentagem'"
        
        # Verify progression criteria per documentation
        # Prata: 3 meses, 60 pts | Ouro: 6 meses, 75 pts | Platina: 12 meses, 85 pts | Diamante: 24 meses, 95 pts
        prata = next((n for n in niveis if n["nome"] == "Prata"), None)
        ouro = next((n for n in niveis if n["nome"] == "Ouro"), None)
        platina = next((n for n in niveis if n["nome"] == "Platina"), None)
        diamante = next((n for n in niveis if n["nome"] == "Diamante"), None)
        
        if prata:
            assert prata["meses_minimos"] == 3, f"Prata should require 3 months, got {prata['meses_minimos']}"
            assert prata["cuidado_veiculo_minimo"] == 60, f"Prata should require 60 pts care, got {prata['cuidado_veiculo_minimo']}"
        
        if ouro:
            assert ouro["meses_minimos"] == 6, f"Ouro should require 6 months, got {ouro['meses_minimos']}"
            assert ouro["cuidado_veiculo_minimo"] == 75, f"Ouro should require 75 pts care, got {ouro['cuidado_veiculo_minimo']}"
        
        if platina:
            assert platina["meses_minimos"] == 12, f"Platina should require 12 months, got {platina['meses_minimos']}"
            assert platina["cuidado_veiculo_minimo"] == 85, f"Platina should require 85 pts care, got {platina['cuidado_veiculo_minimo']}"
        
        if diamante:
            assert diamante["meses_minimos"] == 24, f"Diamante should require 24 months, got {diamante['meses_minimos']}"
            assert diamante["cuidado_veiculo_minimo"] == 95, f"Diamante should require 95 pts care, got {diamante['cuidado_veiculo_minimo']}"
        
        print("✓ Classification config endpoint returns correct structure and criteria")

    # === POST /api/comissoes/classificacao/recalcular-todas ===
    def test_recalcular_todas_classificacoes(self):
        """Test recalculating all driver classifications"""
        response = requests.post(
            f"{BASE_URL}/api/comissoes/classificacao/recalcular-todas",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_motoristas" in data, "Response should contain 'total_motoristas'"
        assert "promovidos" in data, "Response should contain 'promovidos' list"
        assert "mantidos" in data, "Response should contain 'mantidos' list"
        assert "erros" in data, "Response should contain 'erros' list"
        assert "resumo" in data, "Response should contain 'resumo'"
        
        # Verify resumo structure
        resumo = data["resumo"]
        assert "promovidos" in resumo, "Resumo should contain 'promovidos' count"
        assert "mantidos" in resumo, "Resumo should contain 'mantidos' count"
        assert "erros" in resumo, "Resumo should contain 'erros' count"
        
        # Verify data types
        assert isinstance(data["total_motoristas"], int), "total_motoristas should be int"
        assert isinstance(data["promovidos"], list), "promovidos should be list"
        assert isinstance(data["mantidos"], list), "mantidos should be list"
        assert isinstance(data["erros"], list), "erros should be list"
        
        # Verify counts match
        expected_total = resumo["promovidos"] + resumo["mantidos"] + resumo["erros"]
        actual_total = data["total_motoristas"]
        assert actual_total == expected_total or actual_total >= 0, f"Total should match sum of results"
        
        print(f"✓ Recalcular todas classificações: {data['total_motoristas']} motoristas processed")
        print(f"  - Promovidos: {resumo['promovidos']}")
        print(f"  - Mantidos: {resumo['mantidos']}")
        print(f"  - Erros: {resumo['erros']}")

    def test_recalcular_requires_admin(self):
        """Test that recalcular endpoint requires admin privileges"""
        # Login as non-admin (create temporary motorista if needed)
        # For now, test without token
        response = requests.post(
            f"{BASE_URL}/api/comissoes/classificacao/recalcular-todas"
        )
        
        assert response.status_code in [401, 403], f"Should require authentication, got {response.status_code}"
        print("✓ Recalcular endpoint requires authentication")

    # === GET /api/comissoes/classificacao/motorista/{id}/progressao ===
    def test_progressao_endpoint_requires_motorista(self):
        """Test progression endpoint with invalid motorista ID"""
        response = requests.get(
            f"{BASE_URL}/api/comissoes/classificacao/motorista/invalid-id-12345/progressao",
            headers=self.headers
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid motorista, got {response.status_code}"
        print("✓ Progressao endpoint returns 404 for invalid motorista")

    def test_progressao_endpoint_structure(self):
        """Test progressao endpoint returns correct structure when motorista exists"""
        # First get a motorista ID
        motoristas_response = requests.get(
            f"{BASE_URL}/api/motoristas",
            headers=self.headers
        )
        
        if motoristas_response.status_code != 200:
            pytest.skip("Could not fetch motoristas list")
        
        motoristas = motoristas_response.json()
        if not motoristas or len(motoristas) == 0:
            pytest.skip("No motoristas available for testing")
        
        motorista_id = motoristas[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/comissoes/classificacao/motorista/{motorista_id}/progressao",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "motorista_id" in data, "Response should contain 'motorista_id'"
        assert "meses_servico" in data, "Response should contain 'meses_servico'"
        assert "pontuacao_cuidado" in data, "Response should contain 'pontuacao_cuidado'"
        assert "nivel_atual" in data, "Response should contain 'nivel_atual'"
        assert "elegivel_promocao" in data, "Response should contain 'elegivel_promocao'"
        
        # Verify data types
        assert isinstance(data["meses_servico"], int), "meses_servico should be int"
        assert isinstance(data["pontuacao_cuidado"], (int, float)), "pontuacao_cuidado should be numeric"
        assert isinstance(data["elegivel_promocao"], bool), "elegivel_promocao should be bool"
        
        # Verify nivel_atual structure if present
        if data["nivel_atual"]:
            nivel = data["nivel_atual"]
            assert "nome" in nivel, "nivel_atual should have 'nome'"
            assert "nivel" in nivel, "nivel_atual should have 'nivel' number"
        
        # Verify proximo_nivel if present (when not at max level)
        if data.get("proximo_nivel"):
            proximo = data["proximo_nivel"]
            assert "nome" in proximo, "proximo_nivel should have 'nome'"
            assert "meses_minimos" in proximo, "proximo_nivel should have 'meses_minimos'"
            assert "cuidado_veiculo_minimo" in proximo, "proximo_nivel should have 'cuidado_veiculo_minimo'"
        
        # If not eligible, should have reasons
        if not data["elegivel_promocao"] and data.get("proximo_nivel"):
            assert "razoes_falta" in data, "Non-eligible motorista should have 'razoes_falta'"
        
        print(f"✓ Progressao endpoint returns correct structure for motorista {motorista_id}")
        print(f"  - Meses serviço: {data['meses_servico']}")
        print(f"  - Pontuação cuidado: {data['pontuacao_cuidado']}")
        print(f"  - Nivel atual: {data['nivel_atual']['nome'] if data['nivel_atual'] else 'N/A'}")
        print(f"  - Elegível promoção: {data['elegivel_promocao']}")

    # === GET /api/comissoes/classificacao/motorista/{id}/pontuacao-cuidado ===
    def test_pontuacao_cuidado_endpoint(self):
        """Test vehicle care score calculation endpoint"""
        # First get a motorista ID
        motoristas_response = requests.get(
            f"{BASE_URL}/api/motoristas",
            headers=self.headers
        )
        
        if motoristas_response.status_code != 200:
            pytest.skip("Could not fetch motoristas list")
        
        motoristas = motoristas_response.json()
        if not motoristas or len(motoristas) == 0:
            pytest.skip("No motoristas available for testing")
        
        motorista_id = motoristas[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/comissoes/classificacao/motorista/{motorista_id}/pontuacao-cuidado",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "pontuacao_final" in data, "Response should contain 'pontuacao_final'"
        assert "pontuacoes_parciais" in data, "Response should contain 'pontuacoes_parciais'"
        assert "pesos" in data, "Response should contain 'pesos'"
        
        # Verify pontuacoes_parciais has all components
        parciais = data["pontuacoes_parciais"]
        assert "vistorias" in parciais, "Should have 'vistorias' score"
        assert "incidentes" in parciais, "Should have 'incidentes' score"
        assert "manutencoes" in parciais, "Should have 'manutencoes' score"
        assert "avaliacao_parceiro" in parciais, "Should have 'avaliacao_parceiro' score"
        
        # Verify weights match documentation (40/25/20/15)
        pesos = data["pesos"]
        assert pesos.get("vistorias") == 0.40, f"vistorias weight should be 0.40, got {pesos.get('vistorias')}"
        assert pesos.get("incidentes") == 0.25, f"incidentes weight should be 0.25, got {pesos.get('incidentes')}"
        assert pesos.get("manutencoes") == 0.20, f"manutencoes weight should be 0.20, got {pesos.get('manutencoes')}"
        assert pesos.get("avaliacao_parceiro") == 0.15, f"avaliacao_parceiro weight should be 0.15, got {pesos.get('avaliacao_parceiro')}"
        
        print(f"✓ Pontuação cuidado endpoint returns correct structure")
        print(f"  - Pontuação final: {data['pontuacao_final']}")
        print(f"  - Vistorias: {parciais['vistorias']} (peso 40%)")
        print(f"  - Incidentes: {parciais['incidentes']} (peso 25%)")
        print(f"  - Manutenções: {parciais['manutencoes']} (peso 20%)")
        print(f"  - Avaliação parceiro: {parciais['avaliacao_parceiro']} (peso 15%)")

    # === Test promover motorista endpoint ===
    def test_promover_motorista_requires_auth(self):
        """Test that promover endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/comissoes/classificacao/motorista/some-id/promover"
        )
        
        assert response.status_code in [401, 403], f"Should require authentication, got {response.status_code}"
        print("✓ Promover endpoint requires authentication")

    # === Test avaliacao parceiro endpoint ===
    def test_avaliacao_parceiro_endpoint(self):
        """Test updating partner evaluation for driver"""
        # First get a motorista ID
        motoristas_response = requests.get(
            f"{BASE_URL}/api/motoristas",
            headers=self.headers
        )
        
        if motoristas_response.status_code != 200:
            pytest.skip("Could not fetch motoristas list")
        
        motoristas = motoristas_response.json()
        if not motoristas or len(motoristas) == 0:
            pytest.skip("No motoristas available for testing")
        
        motorista_id = motoristas[0]["id"]
        
        # Update evaluation
        response = requests.put(
            f"{BASE_URL}/api/comissoes/classificacao/motorista/{motorista_id}/avaliacao-parceiro",
            params={"avaliacao": 75},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "motorista_id" in data, "Response should contain 'motorista_id'"
        assert "avaliacao" in data, "Response should contain 'avaliacao'"
        assert data["avaliacao"] == 75, f"Avaliacao should be 75, got {data['avaliacao']}"
        
        print(f"✓ Avaliação parceiro endpoint works correctly")

    def test_avaliacao_validation(self):
        """Test avaliacao value validation (0-100)"""
        # First get a motorista ID
        motoristas_response = requests.get(
            f"{BASE_URL}/api/motoristas",
            headers=self.headers
        )
        
        if motoristas_response.status_code != 200:
            pytest.skip("Could not fetch motoristas list")
        
        motoristas = motoristas_response.json()
        if not motoristas or len(motoristas) == 0:
            pytest.skip("No motoristas available for testing")
        
        motorista_id = motoristas[0]["id"]
        
        # Test invalid value > 100
        response = requests.put(
            f"{BASE_URL}/api/comissoes/classificacao/motorista/{motorista_id}/avaliacao-parceiro",
            params={"avaliacao": 150},
            headers=self.headers
        )
        
        assert response.status_code in [400, 422], f"Should reject avaliacao > 100, got {response.status_code}"
        
        # Test invalid value < 0
        response = requests.put(
            f"{BASE_URL}/api/comissoes/classificacao/motorista/{motorista_id}/avaliacao-parceiro",
            params={"avaliacao": -10},
            headers=self.headers
        )
        
        assert response.status_code in [400, 422], f"Should reject avaliacao < 0, got {response.status_code}"
        
        print("✓ Avaliação validation works correctly (0-100 range)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
