"""
TVDEFleet Feature Tests - Iteration 18
Testing: GestaoPlanos, RPA Designer, RPA Automação, WhatsApp, Terabox
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://subscription-mgr-4.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "zmpt2024"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def parceiro_token():
    """Get parceiro authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": PARCEIRO_EMAIL,
        "password": PARCEIRO_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Parceiro login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def parceiro_headers(parceiro_token):
    return {"Authorization": f"Bearer {parceiro_token}"}


# ==================== GESTAO PLANOS TESTS ====================

class TestGestaoPlanos:
    """Tests for unified plan management system at /gestao-planos"""
    
    def test_get_planos_list(self, admin_headers):
        """Test GET /api/planos - should return list of plans"""
        response = requests.get(f"{BASE_URL}/api/planos", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/planos - Found {len(data)} plans")
    
    def test_get_modulos_parceiro(self, admin_headers):
        """Test GET /api/modulos?tipo_usuario=parceiro - modules for partners"""
        response = requests.get(f"{BASE_URL}/api/modulos?tipo_usuario=parceiro", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/modulos?tipo_usuario=parceiro - Found {len(data)} modules")
    
    def test_get_modulos_gestao(self, admin_headers):
        """Test GET /api/modulos?tipo_usuario=gestao - modules for managers"""
        response = requests.get(f"{BASE_URL}/api/modulos?tipo_usuario=gestao", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/modulos?tipo_usuario=gestao - Found {len(data)} modules")
    
    def test_get_modulos_motorista(self, admin_headers):
        """Test GET /api/modulos?tipo_usuario=motorista - modules for drivers"""
        response = requests.get(f"{BASE_URL}/api/modulos?tipo_usuario=motorista", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/modulos?tipo_usuario=motorista - Found {len(data)} modules")
    
    def test_get_parceiros_list(self, admin_headers):
        """Test GET /api/parceiros - list partners for plan assignment"""
        response = requests.get(f"{BASE_URL}/api/parceiros", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/parceiros - Found {len(data)} partners")
    
    def test_get_motoristas_list(self, admin_headers):
        """Test GET /api/motoristas - list drivers for plan assignment"""
        response = requests.get(f"{BASE_URL}/api/motoristas", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/motoristas - Found {len(data)} drivers")
    
    def test_get_gestores_list(self, admin_headers):
        """Test GET /api/gestores - list managers for plan assignment"""
        response = requests.get(f"{BASE_URL}/api/gestores", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/gestores - Found {len(data)} managers")


# ==================== RPA DESIGNER TESTS ====================

class TestRPADesigner:
    """Tests for RPA Designer at /rpa-designer (admin only)"""
    
    def test_get_scripts_list(self, admin_headers):
        """Test GET /api/rpa-designer/scripts - list automation scripts"""
        response = requests.get(f"{BASE_URL}/api/rpa-designer/scripts", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/rpa-designer/scripts - Found {len(data)} scripts")
    
    def test_get_scripts_with_inactive(self, admin_headers):
        """Test GET /api/rpa-designer/scripts?incluir_inativos=true"""
        response = requests.get(f"{BASE_URL}/api/rpa-designer/scripts?incluir_inativos=true", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/rpa-designer/scripts?incluir_inativos=true - Found {len(data)} scripts")
    
    def test_get_designer_estatisticas(self, admin_headers):
        """Test GET /api/rpa-designer/estatisticas - designer statistics"""
        response = requests.get(f"{BASE_URL}/api/rpa-designer/estatisticas", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_scripts" in data or isinstance(data, dict)
        print(f"✅ GET /api/rpa-designer/estatisticas - Stats retrieved")
    
    def test_get_template_script(self, admin_headers):
        """Test GET /api/rpa-designer/template - get script template"""
        response = requests.get(f"{BASE_URL}/api/rpa-designer/template", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "template" in data or "codigo" in data or isinstance(data, dict)
        print(f"✅ GET /api/rpa-designer/template - Template retrieved")
    
    def test_designer_access_denied_for_parceiro(self, parceiro_headers):
        """Test that parceiro cannot access RPA Designer"""
        response = requests.get(f"{BASE_URL}/api/rpa-designer/scripts", headers=parceiro_headers)
        # Should be 403 Forbidden for non-admin
        assert response.status_code in [403, 401]
        print(f"✅ RPA Designer correctly denies access to parceiro (status: {response.status_code})")


# ==================== RPA AUTOMACAO TESTS ====================

class TestRPAAutomacao:
    """Tests for RPA Automation at /rpa-automacao"""
    
    def test_get_plataformas(self, admin_headers):
        """Test GET /api/rpa-auto/plataformas - list available platforms"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/plataformas", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have platforms like uber, bolt, viaverde, prio
        print(f"✅ GET /api/rpa-auto/plataformas - Found {len(data)} platforms")
        for p in data:
            print(f"   - {p.get('id', p.get('nome', 'unknown'))}")
    
    def test_get_credenciais(self, admin_headers):
        """Test GET /api/rpa-auto/credenciais - list configured credentials"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/credenciais", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/rpa-auto/credenciais - Found {len(data)} credentials")
    
    def test_get_execucoes(self, admin_headers):
        """Test GET /api/rpa-auto/execucoes - list execution history"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/execucoes", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/rpa-auto/execucoes - Found {len(data)} executions")
    
    def test_get_agendamentos(self, admin_headers):
        """Test GET /api/rpa-auto/agendamentos - list schedules"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/agendamentos", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/rpa-auto/agendamentos - Found {len(data)} schedules")
    
    def test_get_estatisticas(self, admin_headers):
        """Test GET /api/rpa-auto/estatisticas - automation statistics"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/estatisticas", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✅ GET /api/rpa-auto/estatisticas - Stats: {data}")
    
    def test_parceiro_can_access_automacao(self, parceiro_headers):
        """Test that parceiro CAN access RPA Automação"""
        response = requests.get(f"{BASE_URL}/api/rpa-auto/plataformas", headers=parceiro_headers)
        assert response.status_code == 200
        print(f"✅ Parceiro can access RPA Automação")


# ==================== WHATSAPP TESTS ====================

class TestWhatsApp:
    """Tests for WhatsApp integration at /whatsapp"""
    
    def test_get_whatsapp_status(self, admin_headers):
        """Test GET /api/whatsapp/status - check WhatsApp service status"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/status", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✅ GET /api/whatsapp/status - Status: {data}")
    
    def test_get_whatsapp_templates(self, admin_headers):
        """Test GET /api/whatsapp/templates - list message templates"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/templates", headers=admin_headers)
        # May return 200 or 404 if no templates
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            print(f"✅ GET /api/whatsapp/templates - Found {len(data) if isinstance(data, list) else 'N/A'} templates")
        else:
            print(f"✅ GET /api/whatsapp/templates - No templates configured (404)")
    
    def test_get_whatsapp_historico(self, admin_headers):
        """Test GET /api/whatsapp/historico - message history"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/historico", headers=admin_headers)
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            print(f"✅ GET /api/whatsapp/historico - Found {len(data) if isinstance(data, list) else 'N/A'} messages")
        else:
            print(f"✅ GET /api/whatsapp/historico - No history (404)")
    
    def test_parceiro_can_access_whatsapp(self, parceiro_headers):
        """Test that parceiro can access WhatsApp"""
        response = requests.get(f"{BASE_URL}/api/whatsapp/status", headers=parceiro_headers)
        assert response.status_code == 200
        print(f"✅ Parceiro can access WhatsApp status")


# ==================== TERABOX TESTS ====================

class TestTerabox:
    """Tests for Terabox file management at /terabox"""
    
    def test_get_terabox_stats(self, admin_headers):
        """Test GET /api/terabox/stats - storage statistics"""
        response = requests.get(f"{BASE_URL}/api/terabox/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✅ GET /api/terabox/stats - Stats: {data}")
    
    def test_get_terabox_credentials(self, admin_headers):
        """Test GET /api/terabox/credentials - Terabox credentials"""
        response = requests.get(f"{BASE_URL}/api/terabox/credentials", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✅ GET /api/terabox/credentials - Credentials retrieved")
    
    def test_get_terabox_ficheiros(self, admin_headers):
        """Test GET /api/terabox/ficheiros - list files"""
        response = requests.get(f"{BASE_URL}/api/terabox/ficheiros", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/terabox/ficheiros - Found {len(data)} files")
    
    def test_get_terabox_pastas(self, admin_headers):
        """Test GET /api/terabox/pastas - list folders"""
        response = requests.get(f"{BASE_URL}/api/terabox/pastas", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/terabox/pastas - Found {len(data)} folders")
    
    def test_get_terabox_categorias(self, admin_headers):
        """Test GET /api/terabox/categorias - file categories"""
        response = requests.get(f"{BASE_URL}/api/terabox/categorias", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/terabox/categorias - Found {len(data)} categories")
    
    def test_parceiro_can_access_terabox(self, parceiro_headers):
        """Test that parceiro can access Terabox"""
        response = requests.get(f"{BASE_URL}/api/terabox/stats", headers=parceiro_headers)
        assert response.status_code == 200
        print(f"✅ Parceiro can access Terabox")


# ==================== REMOVED ROUTES TESTS ====================

class TestRemovedRoutes:
    """Tests to verify removed routes redirect properly"""
    
    def test_automacao_route_removed(self, admin_headers):
        """Test that /api/automacao is removed or redirects"""
        response = requests.get(f"{BASE_URL}/api/automacao", headers=admin_headers)
        # Should be 404 (removed) or redirect
        assert response.status_code in [404, 301, 302, 307, 308]
        print(f"✅ /api/automacao correctly removed (status: {response.status_code})")
    
    def test_cartoes_frota_route_removed(self, admin_headers):
        """Test that /api/cartoes-frota is removed"""
        response = requests.get(f"{BASE_URL}/api/cartoes-frota", headers=admin_headers)
        # Should be 404 (removed)
        assert response.status_code in [404, 301, 302, 307, 308]
        print(f"✅ /api/cartoes-frota correctly removed (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
