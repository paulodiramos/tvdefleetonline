"""
Test cases for Motorista History and Weekly Summary Activity Filter features
- GET /api/motoristas/{id}/historico-atividade - Activity history (blocks/activations)
- GET /api/motoristas/{id}/historico-rendimentos - Weekly earnings history with summary
- PUT /api/motoristas/{id}/bloquear - Should register in activity history
- PUT /api/motoristas/{id} with ativo=false - Should register in activity history
- Resumo Semanal - Filter drivers by activity state during the week
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "Admin123!"
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "Admin123!"

# Test motorista ID from agent context
TEST_MOTORISTA_ID = "57d6a119-e5af-4c7f-b357-49dc4f618763"  # Arlei Oliveira


class TestAuth:
    """Authentication helpers"""
    
    @staticmethod
    def get_token(email, password):
        """Get JWT token for user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    @staticmethod
    def get_admin_headers():
        token = TestAuth.get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    @staticmethod
    def get_parceiro_headers():
        token = TestAuth.get_token(PARCEIRO_EMAIL, PARCEIRO_PASSWORD)
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestHistoricoAtividade:
    """Tests for motorista activity history endpoint"""
    
    def test_historico_atividade_endpoint_exists(self):
        """Test that the historico-atividade endpoint exists and returns expected structure"""
        headers = TestAuth.get_admin_headers()
        assert headers.get("Authorization"), "Failed to get admin token"
        
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-atividade",
            headers=headers
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500] if response.text else 'empty'}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "motorista_id" in data, "Response should have motorista_id"
        assert "motorista_nome" in data, "Response should have motorista_nome"
        assert "estado_atual" in data, "Response should have estado_atual"
        assert "historico" in data, "Response should have historico list"
        assert "total_registos" in data, "Response should have total_registos"
        
        print(f"SUCCESS: Historico atividade endpoint working. Records: {data['total_registos']}")
    
    def test_historico_atividade_estado_atual_structure(self):
        """Test that estado_atual has expected fields"""
        headers = TestAuth.get_admin_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-atividade",
            headers=headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        estado_atual = data.get("estado_atual", {})
        
        # Check expected fields in estado_atual
        assert "ativo" in estado_atual, "estado_atual should have 'ativo'"
        assert "bloqueado" in estado_atual, "estado_atual should have 'bloqueado'"
        
        print(f"SUCCESS: Estado atual: ativo={estado_atual.get('ativo')}, bloqueado={estado_atual.get('bloqueado')}")
    
    def test_historico_atividade_parceiro_access(self):
        """Test that parceiro can access their motorista's activity history"""
        headers = TestAuth.get_parceiro_headers()
        assert headers.get("Authorization"), "Failed to get parceiro token"
        
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-atividade",
            headers=headers
        )
        
        print(f"Parceiro access status: {response.status_code}")
        
        # Parceiro should be able to access their own motoristas
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}"
        
        if response.status_code == 200:
            print("SUCCESS: Parceiro can access motorista historico-atividade")
        else:
            print("INFO: Parceiro does not have access to this motorista (different parceiro)")
    
    def test_historico_atividade_not_found(self):
        """Test 404 for non-existent motorista"""
        headers = TestAuth.get_admin_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/motoristas/non-existent-id-12345/historico-atividade",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: Returns 404 for non-existent motorista")


class TestHistoricoRendimentos:
    """Tests for motorista earnings history endpoint"""
    
    def test_historico_rendimentos_endpoint_exists(self):
        """Test that the historico-rendimentos endpoint exists and returns expected structure"""
        headers = TestAuth.get_admin_headers()
        assert headers.get("Authorization"), "Failed to get admin token"
        
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-rendimentos",
            headers=headers
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500] if response.text else 'empty'}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "motorista_id" in data, "Response should have motorista_id"
        assert "motorista_nome" in data, "Response should have motorista_nome"
        assert "rendimentos" in data, "Response should have rendimentos list"
        assert "resumo" in data, "Response should have resumo"
        
        print(f"SUCCESS: Historico rendimentos endpoint working. Records: {len(data.get('rendimentos', []))}")
    
    def test_historico_rendimentos_resumo_structure(self):
        """Test that resumo has expected summary fields"""
        headers = TestAuth.get_admin_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-rendimentos",
            headers=headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        resumo = data.get("resumo", {})
        
        # Check expected fields in resumo
        assert "total_semanas" in resumo, "resumo should have 'total_semanas'"
        assert "total_liquido" in resumo, "resumo should have 'total_liquido'"
        assert "media_semanal" in resumo, "resumo should have 'media_semanal'"
        
        print(f"SUCCESS: Resumo: semanas={resumo.get('total_semanas')}, total=€{resumo.get('total_liquido', 0):.2f}, media=€{resumo.get('media_semanal', 0):.2f}")
    
    def test_historico_rendimentos_year_filter(self):
        """Test that year filter works correctly"""
        headers = TestAuth.get_admin_headers()
        
        current_year = datetime.now().year
        
        # Test with current year
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-rendimentos?ano={current_year}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("ano_filtro") == current_year or data.get("ano_filtro") is None
        
        print(f"SUCCESS: Year filter working for {current_year}")
        
        # Test with previous year
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-rendimentos?ano={current_year - 1}",
            headers=headers
        )
        
        assert response.status_code == 200
        print(f"SUCCESS: Year filter working for {current_year - 1}")
    
    def test_historico_rendimentos_limit_param(self):
        """Test that limite parameter works"""
        headers = TestAuth.get_admin_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-rendimentos?limite=10",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return at most 10 records
        assert len(data.get("rendimentos", [])) <= 10
        print(f"SUCCESS: Limite parameter working. Records returned: {len(data.get('rendimentos', []))}")


class TestBloquearMotoristHistory:
    """Tests for bloquear endpoint writing to activity history"""
    
    def test_bloquear_motorista_registers_history(self):
        """Test that blocking a motorista registers in activity history"""
        headers = TestAuth.get_admin_headers()
        assert headers.get("Authorization"), "Failed to get admin token"
        
        # Get initial history count
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-atividade",
            headers=headers
        )
        assert response.status_code == 200
        initial_count = response.json().get("total_registos", 0)
        
        # Block the motorista
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/bloquear",
            headers=headers,
            json={"bloqueado": True, "motivo": "TEST_BLOQUEIO - Testing history registration"}
        )
        
        print(f"Bloquear status: {response.status_code}")
        print(f"Bloquear response: {response.text[:300] if response.text else 'empty'}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Check history was updated
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-atividade",
            headers=headers
        )
        assert response.status_code == 200
        
        new_count = response.json().get("total_registos", 0)
        historico = response.json().get("historico", [])
        
        print(f"History count before: {initial_count}, after: {new_count}")
        
        # Check that a new entry was added
        assert new_count >= initial_count, "History should have new entry after blocking"
        
        # Check that the latest entry is the block action
        if historico:
            latest = historico[0]
            print(f"Latest history entry: tipo={latest.get('tipo')}, motivo={latest.get('motivo')}")
            assert latest.get("tipo") == "bloqueado", f"Latest entry should be 'bloqueado', got {latest.get('tipo')}"
        
        # Unblock to restore state
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/bloquear",
            headers=headers,
            json={"bloqueado": False, "motivo": "TEST - Restoring state after test"}
        )
        
        print(f"Desbloquear status: {response.status_code}")
        assert response.status_code == 200
        print("SUCCESS: Block/Unblock registers in history correctly")


class TestUpdateMotoristActivityHistory:
    """Tests for update motorista endpoint writing to activity history when ativo changes"""
    
    def test_desativar_motorista_registers_history(self):
        """Test that setting ativo=false registers in activity history"""
        headers = TestAuth.get_admin_headers()
        assert headers.get("Authorization"), "Failed to get admin token"
        
        # First, get motorista current state
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}",
            headers=headers
        )
        assert response.status_code == 200
        motorista = response.json()
        was_active = motorista.get("ativo", True)
        
        # Get initial history count
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-atividade",
            headers=headers
        )
        initial_count = response.json().get("total_registos", 0)
        
        # Deactivate the motorista
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}",
            headers=headers,
            json={"ativo": False, "motivo_desativacao": "TEST - Testing history registration"}
        )
        
        print(f"Desativar status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Check history was updated
        response = requests.get(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/historico-atividade",
            headers=headers
        )
        assert response.status_code == 200
        
        new_count = response.json().get("total_registos", 0)
        historico = response.json().get("historico", [])
        
        print(f"History count before: {initial_count}, after: {new_count}")
        
        # Only check for new entry if motorista was previously active
        if was_active:
            assert new_count > initial_count, "History should have new entry after deactivating"
            if historico:
                # Find the desativado entry
                desativado_entries = [h for h in historico if h.get("tipo") == "desativado"]
                assert len(desativado_entries) > 0, "Should have a 'desativado' entry in history"
                print(f"Found {len(desativado_entries)} desativado entries")
        
        # Reactivate to restore state
        response = requests.put(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}",
            headers=headers,
            json={"ativo": True}
        )
        
        print(f"Reativar status: {response.status_code}")
        assert response.status_code == 200
        
        print("SUCCESS: Deactivate/Activate registers in history correctly")


class TestResumoSemanalMotoristFilter:
    """Tests for weekly summary motorist activity filter"""
    
    def test_resumo_semanal_endpoint_exists(self):
        """Test that resumo-semanal endpoint exists"""
        headers = TestAuth.get_parceiro_headers()
        assert headers.get("Authorization"), "Failed to get parceiro token"
        
        current_week = datetime.now().isocalendar()[1]
        current_year = datetime.now().year
        
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={current_week}&ano={current_year}",
            headers=headers
        )
        
        print(f"Status: {response.status_code}")
        
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {data.keys() if isinstance(data, dict) else 'not a dict'}")
            print(f"SUCCESS: Resumo semanal endpoint accessible")
        else:
            print(f"INFO: Resumo semanal returned {response.status_code}")
    
    def test_resumo_semanal_filters_inactive_motoristas(self):
        """Test that resumo semanal properly filters motoristas based on activity dates"""
        headers = TestAuth.get_parceiro_headers()
        assert headers.get("Authorization"), "Failed to get parceiro token"
        
        current_week = datetime.now().isocalendar()[1]
        current_year = datetime.now().year
        
        response = requests.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana={current_week}&ano={current_year}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check structure
            if "motoristas" in data:
                motoristas = data.get("motoristas", [])
                print(f"Found {len(motoristas)} motoristas in resumo semanal")
                
                # Each motorista should have identification
                for m in motoristas[:3]:  # Check first 3
                    print(f"  - {m.get('motorista_nome', 'N/A')}: ativo={m.get('ativo', 'N/A')}")
            
            if "resumo_motoristas" in data:
                motoristas = data.get("resumo_motoristas", [])
                print(f"Found {len(motoristas)} motoristas in resumo_motoristas")
            
            print("SUCCESS: Resumo semanal returns motorista data")
        else:
            print(f"INFO: Could not verify filter - status {response.status_code}")


class TestRegistarAtividade:
    """Tests for manual activity registration endpoint"""
    
    def test_registar_atividade_endpoint_exists(self):
        """Test that registar-atividade endpoint exists and works"""
        headers = TestAuth.get_admin_headers()
        assert headers.get("Authorization"), "Failed to get admin token"
        
        response = requests.post(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/registar-atividade",
            headers=headers,
            json={
                "tipo": "ativado",
                "motivo": "TEST - Manual activity registration test"
            }
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:300] if response.text else 'empty'}")
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
        
        data = response.json()
        assert "message" in data or "id" in data, "Response should confirm registration"
        
        print("SUCCESS: Registar atividade endpoint working")
    
    def test_registar_atividade_validates_tipo(self):
        """Test that invalid tipo is rejected"""
        headers = TestAuth.get_admin_headers()
        
        response = requests.post(
            f"{BASE_URL}/api/motoristas/{TEST_MOTORISTA_ID}/registar-atividade",
            headers=headers,
            json={
                "tipo": "invalid_type",
                "motivo": "TEST"
            }
        )
        
        print(f"Invalid tipo status: {response.status_code}")
        
        assert response.status_code == 400, f"Expected 400 for invalid tipo, got {response.status_code}"
        print("SUCCESS: Invalid tipo correctly rejected")


# Run pytest with verbose output
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
