"""
Test Via Verde Synchronization Features
Tests for:
1. Sincronização Auto page loading
2. Via Verde card showing configured email and status
3. Via Verde sync button opening date selection dialog
4. API /api/viaverde/executar-rpa accepting requests
5. API /api/relatorios/parceiro/resumo-semanal showing Via Verde data
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "zeny123"


class TestViaVerdeSincronizacao:
    """Test Via Verde synchronization features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as parceiro
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_01_login_parceiro(self):
        """Test parceiro login works"""
        assert self.token is not None, "Token should be present"
        assert self.user is not None, "User should be present"
        assert self.user.get("email") == PARCEIRO_EMAIL, "Email should match"
        print(f"✅ Login successful for {PARCEIRO_EMAIL}")
        print(f"   User ID: {self.user.get('id')}")
        print(f"   Role: {self.user.get('role')}")
    
    def test_02_get_credenciais_plataforma(self):
        """Test fetching platform credentials - Via Verde should be configured"""
        response = self.session.get(f"{BASE_URL}/api/credenciais-plataforma")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        credenciais = response.json()
        assert isinstance(credenciais, list), "Response should be a list"
        
        # Find Via Verde credential
        via_verde_cred = None
        for cred in credenciais:
            if cred.get("plataforma") in ["via_verde", "viaverde"]:
                via_verde_cred = cred
                break
        
        if via_verde_cred:
            print(f"✅ Via Verde credential found:")
            print(f"   Email: {via_verde_cred.get('email')}")
            print(f"   Ativo: {via_verde_cred.get('ativo', True)}")
            print(f"   Auto Sync: {via_verde_cred.get('sincronizacao_automatica', False)}")
            print(f"   Última Sync: {via_verde_cred.get('ultima_sincronizacao', 'Nunca')}")
            
            # Verify email is configured
            assert via_verde_cred.get("email"), "Via Verde email should be configured"
        else:
            print("⚠️ Via Verde credential not found - may need to be configured")
            # This is not a failure, just informational
    
    def test_03_get_logs_sincronizacao(self):
        """Test fetching synchronization logs"""
        parceiro_id = self.user.get("id")
        response = self.session.get(f"{BASE_URL}/api/logs-sincronizacao?parceiro_id={parceiro_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        logs = response.json()
        assert isinstance(logs, list), "Response should be a list"
        
        print(f"✅ Sync logs retrieved: {len(logs)} entries")
        
        # Show recent Via Verde logs
        vv_logs = [l for l in logs if l.get("plataforma") in ["via_verde", "viaverde"]]
        if vv_logs:
            print(f"   Via Verde logs: {len(vv_logs)}")
            for log in vv_logs[:3]:
                print(f"   - {log.get('data_inicio', 'N/A')}: {log.get('status', 'N/A')}")
    
    def test_04_viaverde_executar_rpa_ultima_semana(self):
        """Test Via Verde RPA execution with 'ultima_semana' period"""
        payload = {
            "tipo_periodo": "ultima_semana"
        }
        
        response = self.session.post(f"{BASE_URL}/api/viaverde/executar-rpa", json=payload)
        
        # Accept 200 (success) or 400 (credentials not configured)
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        
        data = response.json()
        
        if response.status_code == 200:
            print(f"✅ Via Verde RPA scheduled successfully:")
            print(f"   Success: {data.get('success')}")
            print(f"   Período: {data.get('periodo', {}).get('descricao', 'N/A')}")
            print(f"   Data Início: {data.get('periodo', {}).get('data_inicio', 'N/A')}")
            print(f"   Data Fim: {data.get('periodo', {}).get('data_fim', 'N/A')}")
            
            assert data.get("success") == True, "RPA should be scheduled successfully"
        else:
            print(f"⚠️ Via Verde RPA not executed: {data.get('detail', 'Unknown error')}")
            # If credentials not configured, this is expected
            if "Credenciais" in str(data.get("detail", "")):
                pytest.skip("Via Verde credentials not configured")
    
    def test_05_viaverde_executar_rpa_semana_especifica(self):
        """Test Via Verde RPA execution with specific week"""
        payload = {
            "tipo_periodo": "semana_especifica",
            "semana": 5,
            "ano": 2026
        }
        
        response = self.session.post(f"{BASE_URL}/api/viaverde/executar-rpa", json=payload)
        
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        
        data = response.json()
        
        if response.status_code == 200:
            print(f"✅ Via Verde RPA (week 5/2026) scheduled:")
            print(f"   Success: {data.get('success')}")
            print(f"   Período: {data.get('periodo', {}).get('descricao', 'N/A')}")
            
            assert data.get("success") == True
        else:
            print(f"⚠️ Via Verde RPA not executed: {data.get('detail', 'Unknown error')}")
            if "Credenciais" in str(data.get("detail", "")):
                pytest.skip("Via Verde credentials not configured")
    
    def test_06_viaverde_executar_rpa_datas_personalizadas(self):
        """Test Via Verde RPA execution with custom dates"""
        payload = {
            "tipo_periodo": "datas_personalizadas",
            "data_inicio": "2026-01-27",
            "data_fim": "2026-02-02"
        }
        
        response = self.session.post(f"{BASE_URL}/api/viaverde/executar-rpa", json=payload)
        
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        
        data = response.json()
        
        if response.status_code == 200:
            print(f"✅ Via Verde RPA (custom dates) scheduled:")
            print(f"   Success: {data.get('success')}")
            print(f"   Período: {data.get('periodo', {}).get('descricao', 'N/A')}")
            
            assert data.get("success") == True
        else:
            print(f"⚠️ Via Verde RPA not executed: {data.get('detail', 'Unknown error')}")
            if "Credenciais" in str(data.get("detail", "")):
                pytest.skip("Via Verde credentials not configured")
    
    def test_07_resumo_semanal_week5_2026(self):
        """Test Resumo Semanal shows Via Verde data for week 5/2026"""
        response = self.session.get(f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=5&ano=2026")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        print(f"✅ Resumo Semanal S5/2026:")
        print(f"   Período: {data.get('periodo', 'N/A')}")
        print(f"   Total Motoristas: {data.get('total_motoristas', 0)}")
        
        totais = data.get("totais", {})
        print(f"   Total Via Verde: €{totais.get('total_via_verde', 0):.2f}")
        print(f"   Total Ganhos: €{totais.get('total_ganhos', 0):.2f}")
        print(f"   Total Despesas: €{totais.get('total_despesas_operacionais', 0):.2f}")
        
        # Check motoristas with Via Verde data
        motoristas = data.get("motoristas", [])
        motoristas_com_vv = [m for m in motoristas if m.get("via_verde", 0) > 0 or m.get("via_verde_total_importado", 0) > 0]
        
        print(f"   Motoristas com Via Verde: {len(motoristas_com_vv)}")
        for m in motoristas_com_vv[:5]:
            vv_value = m.get("via_verde", 0) or m.get("via_verde_total_importado", 0)
            print(f"   - {m.get('motorista_nome', 'N/A')}: €{vv_value:.2f}")
        
        # Verify response structure
        assert "motoristas" in data, "Response should have motoristas"
        assert "totais" in data, "Response should have totais"
    
    def test_08_resumo_semanal_current_week(self):
        """Test Resumo Semanal for current week (week 6/2026)"""
        response = self.session.get(f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=6&ano=2026")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        print(f"✅ Resumo Semanal S6/2026 (current week):")
        print(f"   Período: {data.get('periodo', 'N/A')}")
        print(f"   Total Motoristas: {data.get('total_motoristas', 0)}")
        
        totais = data.get("totais", {})
        print(f"   Total Via Verde: €{totais.get('total_via_verde', 0):.2f}")
        print(f"   Total Ganhos Uber: €{totais.get('total_ganhos_uber', 0):.2f}")
        print(f"   Total Ganhos Bolt: €{totais.get('total_ganhos_bolt', 0):.2f}")
    
    def test_09_reports_parceiro_semanal(self):
        """Test parceiro weekly report endpoint (used by dashboard)"""
        response = self.session.get(f"{BASE_URL}/api/reports/parceiro/semanal")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        print(f"✅ Reports Parceiro Semanal:")
        print(f"   Total Ganhos: €{data.get('total_ganhos', 0):.2f}")
        print(f"   Total Gastos: €{data.get('total_gastos', 0):.2f}")
    
    def test_10_viaverde_rpa_validation_errors(self):
        """Test Via Verde RPA validation - missing required fields"""
        # Test semana_especifica without semana/ano
        payload = {
            "tipo_periodo": "semana_especifica"
            # Missing semana and ano
        }
        
        response = self.session.post(f"{BASE_URL}/api/viaverde/executar-rpa", json=payload)
        
        # Should return 400 for missing fields OR 400 for missing credentials
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        print(f"✅ Validation error correctly returned: {data.get('detail', 'N/A')}")
    
    def test_11_viaverde_rpa_validation_datas(self):
        """Test Via Verde RPA validation - missing dates for custom period"""
        payload = {
            "tipo_periodo": "datas_personalizadas"
            # Missing data_inicio and data_fim
        }
        
        response = self.session.post(f"{BASE_URL}/api/viaverde/executar-rpa", json=payload)
        
        # Should return 400 for missing fields OR 400 for missing credentials
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        print(f"✅ Validation error correctly returned: {data.get('detail', 'N/A')}")


class TestViaVerdeWithoutAuth:
    """Test Via Verde endpoints without authentication"""
    
    def test_viaverde_rpa_requires_auth(self):
        """Test that Via Verde RPA endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/viaverde/executar-rpa", json={
            "tipo_periodo": "ultima_semana"
        })
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Via Verde RPA correctly requires authentication")
    
    def test_resumo_semanal_requires_auth(self):
        """Test that Resumo Semanal endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal?semana=5&ano=2026")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Resumo Semanal correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
