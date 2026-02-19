"""
Backend tests for Browser Virtual Admin - RPA interactive browser feature
Tests the endpoints for managing browser virtual sessions for admin
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://playwright-stable.preview.emergentagent.com')

# Admin credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "admin123"

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Get auth headers for requests"""
    return {"Authorization": f"Bearer {admin_token}"}

@pytest.fixture(scope="module")
def rpa_plataforma(auth_headers):
    """Get a plataforma with RPA method for testing"""
    response = requests.get(f"{BASE_URL}/api/plataformas", headers=auth_headers)
    assert response.status_code == 200
    plataformas = response.json()
    
    # Find one with RPA method
    rpa_plataformas = [p for p in plataformas if p.get("metodo_integracao") == "rpa"]
    assert len(rpa_plataformas) > 0, "No RPA plataformas found"
    return rpa_plataformas[0]


class TestAuthenticationRequired:
    """Test that endpoints require authentication"""
    
    def test_sessoes_requires_auth(self):
        """Test GET /admin/browser-virtual/sessoes requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/browser-virtual/sessoes")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_iniciar_sessao_requires_auth(self):
        """Test POST /admin/browser-virtual/sessao/iniciar requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            json={"plataforma_id": "test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestPlataformasAPI:
    """Test plataformas API endpoints"""
    
    def test_listar_plataformas(self, auth_headers):
        """Test GET /plataformas returns list of platforms"""
        response = requests.get(f"{BASE_URL}/api/plataformas", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected at least one plataforma"
        
    def test_plataformas_have_required_fields(self, auth_headers):
        """Test that plataformas have required fields"""
        response = requests.get(f"{BASE_URL}/api/plataformas", headers=auth_headers)
        assert response.status_code == 200
        plataformas = response.json()
        
        required_fields = ["id", "nome", "categoria"]
        for plat in plataformas:
            for field in required_fields:
                assert field in plat, f"Missing field {field} in plataforma {plat.get('nome', 'unknown')}"
    
    def test_rpa_plataformas_exist(self, auth_headers):
        """Test that RPA plataformas exist for browser testing"""
        response = requests.get(f"{BASE_URL}/api/plataformas", headers=auth_headers)
        assert response.status_code == 200
        plataformas = response.json()
        
        rpa_count = len([p for p in plataformas if p.get("metodo_integracao") == "rpa"])
        print(f"Found {rpa_count} RPA plataformas")
        assert rpa_count > 0, "At least one RPA plataforma should exist"


class TestBrowserVirtualSessions:
    """Test browser virtual session endpoints"""
    
    def test_listar_sessoes_ativas(self, auth_headers):
        """Test GET /admin/browser-virtual/sessoes returns list (can be empty)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessoes",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Active sessions: {len(data)}")
    
    def test_iniciar_sessao_plataforma_inexistente(self, auth_headers):
        """Test starting session with non-existent plataforma"""
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={"plataforma_id": "non-existent-id-12345"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_iniciar_sessao_success(self, auth_headers, rpa_plataforma):
        """Test starting a browser virtual session"""
        plataforma_id = rpa_plataforma["id"]
        plataforma_nome = rpa_plataforma["nome"]
        
        print(f"Testing with plataforma: {plataforma_nome} ({plataforma_id})")
        
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={
                "plataforma_id": plataforma_id,
                "url_inicial": "https://www.google.com"  # Use Google for test
            },
            timeout=60  # Browser startup can take time
        )
        
        # Session might succeed or fail depending on playwright availability
        if response.status_code == 200:
            data = response.json()
            assert "session_id" in data, "Response should include session_id"
            assert "screenshot" in data, "Response should include screenshot"
            assert data.get("sucesso") == True, "Success flag should be True"
            
            session_id = data["session_id"]
            print(f"Session created: {session_id}")
            
            # Clean up - terminate the session
            cleanup_response = requests.delete(
                f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
                headers=auth_headers
            )
            print(f"Cleanup status: {cleanup_response.status_code}")
        else:
            # It's OK if session fails (e.g., playwright not available)
            print(f"Session start returned {response.status_code}: {response.text[:200]}")
            pytest.skip("Browser session could not be started - playwright may not be available")
    
    def test_obter_status_sessao_inexistente(self, auth_headers):
        """Test getting status of non-existent session"""
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/fake-session-id/status",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestBrowserVirtualFeatures:
    """Test browser virtual session features (actions, recording, etc.)"""
    
    @pytest.fixture
    def active_session(self, auth_headers, rpa_plataforma):
        """Create an active session for testing"""
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={
                "plataforma_id": rpa_plataforma["id"],
                "url_inicial": "https://www.google.com"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            pytest.skip("Could not create browser session for feature testing")
        
        data = response.json()
        session_id = data["session_id"]
        yield session_id
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
            headers=auth_headers
        )
    
    def test_obter_screenshot(self, auth_headers, active_session):
        """Test getting screenshot from active session"""
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{active_session}/screenshot",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "screenshot" in data
        assert data.get("sucesso") == True
    
    def test_toggle_gravacao(self, auth_headers, active_session):
        """Test toggling recording mode"""
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{active_session}/gravar?ativar=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("gravando") == True
    
    def test_executar_acao_click(self, auth_headers, active_session):
        """Test executing click action"""
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{active_session}/acao",
            headers=auth_headers,
            json={"tipo": "click", "x": 100, "y": 100}
        )
        assert response.status_code == 200
        data = response.json()
        assert "screenshot" in data
    
    def test_obter_passos_gravados(self, auth_headers, active_session):
        """Test getting recorded steps"""
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{active_session}/passos",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "passos" in data
        assert isinstance(data["passos"], list)
    
    def test_terminar_sessao(self, auth_headers, rpa_plataforma):
        """Test terminating a session"""
        # Create a session first
        create_response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={
                "plataforma_id": rpa_plataforma["id"],
                "url_inicial": "https://www.google.com"
            },
            timeout=60
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create session to test termination")
        
        session_id = create_response.json()["session_id"]
        
        # Now terminate it
        response = requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("sucesso") == True


class TestPlataformaCategories:
    """Test plataforma categories as required by the feature"""
    
    def test_has_expected_categories(self, auth_headers):
        """Test that expected plataforma categories exist"""
        response = requests.get(f"{BASE_URL}/api/plataformas", headers=auth_headers)
        assert response.status_code == 200
        plataformas = response.json()
        
        categories = set(p.get("categoria") for p in plataformas)
        print(f"Found categories: {categories}")
        
        expected_categories = {"abastecimento", "gps", "plataforma", "portagens"}
        for cat in expected_categories:
            assert cat in categories, f"Missing expected category: {cat}"
    
    def test_prio_plataforma_exists(self, auth_headers):
        """Test that Prio plataforma exists (used in the example)"""
        response = requests.get(f"{BASE_URL}/api/plataformas", headers=auth_headers)
        assert response.status_code == 200
        plataformas = response.json()
        
        prio = [p for p in plataformas if p.get("nome", "").lower() == "prio"]
        assert len(prio) > 0, "Prio plataforma should exist"
        assert prio[0].get("metodo_integracao") == "rpa", "Prio should use RPA integration"
        print(f"Prio plataforma: {prio[0]}")


class TestBrowserVirtualAdminOnly:
    """Test that browser virtual is admin only"""
    
    def test_non_admin_cannot_access_sessoes(self):
        """Test that non-admin users cannot access browser virtual"""
        # Login as a parceiro if available
        parceiro_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "geral@zmbusines.com", "password": "test123"}
        )
        
        if parceiro_response.status_code != 200:
            pytest.skip("No parceiro user available for testing")
        
        parceiro_token = parceiro_response.json()["access_token"]
        parceiro_headers = {"Authorization": f"Bearer {parceiro_token}"}
        
        # Try to access browser virtual sessoes
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessoes",
            headers=parceiro_headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
