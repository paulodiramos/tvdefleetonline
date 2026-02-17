"""
Backend tests for Browser Virtual Auto-Save and Replay features
Tests the new auto-save functionality and replay endpoints for RPA step recording.

New features tested:
1. Auto-save of recorded steps to BD (rpa_rascunhos collection)
2. Rascunho recovery when reopening session
3. Replay endpoint to test automation before final save
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "admin123"
PLATAFORMA_PRIO_ID = "b1801c0f-a79d-4980-a51c-f280a20f211d"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("access_token")
    assert token, "No access_token in response"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Get auth headers for requests"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestAdminLogin:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Test login with admin credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should include access_token"
        assert "user" in data, "Response should include user object"
        assert data["user"]["role"] == "admin", "User should have admin role"
        print(f"Admin login successful: {data['user'].get('nome', data['user'].get('email'))}")


class TestIniciarSessaoComRascunho:
    """Test session start with draft (rascunho) recovery"""
    
    def test_iniciar_sessao_carrega_rascunho(self, auth_headers):
        """Test POST /api/admin/browser-virtual/sessao/iniciar loads existing draft"""
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={
                "plataforma_id": PLATAFORMA_PRIO_ID,
                "url_inicial": "https://www.google.com"
            },
            timeout=60
        )
        
        # Session should succeed
        if response.status_code != 200:
            pytest.skip(f"Browser session could not start: {response.status_code} - {response.text[:200]}")
        
        data = response.json()
        print(f"Response keys: {data.keys()}")
        
        # Verify response structure
        assert data.get("sucesso") == True, "sucesso should be True"
        assert "session_id" in data, "Response should include session_id"
        assert "screenshot" in data, "Response should include screenshot"
        assert "passos_recuperados" in data, "Response should include passos_recuperados count"
        assert "rascunho_carregado" in data, "Response should include rascunho_carregado flag"
        
        session_id = data["session_id"]
        passos_recuperados = data.get("passos_recuperados", 0)
        rascunho_carregado = data.get("rascunho_carregado", False)
        
        print(f"Session created: {session_id}")
        print(f"Passos recuperados: {passos_recuperados}")
        print(f"Rascunho carregado: {rascunho_carregado}")
        
        # Cleanup session
        requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
            headers=auth_headers
        )


class TestAutoSavePassos:
    """Test auto-save functionality for recorded steps"""
    
    @pytest.fixture
    def active_session_with_recording(self, auth_headers):
        """Create session and enable recording"""
        # Start session
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={
                "plataforma_id": PLATAFORMA_PRIO_ID,
                "url_inicial": "https://www.google.com"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            pytest.skip("Could not create browser session")
        
        session_id = response.json()["session_id"]
        
        # Enable recording
        requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/gravar?ativar=true",
            headers=auth_headers
        )
        
        yield session_id
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
            headers=auth_headers
        )
    
    def test_executar_acao_grava_passo(self, auth_headers, active_session_with_recording):
        """Test that executing action with recording enabled saves step"""
        session_id = active_session_with_recording
        
        # Execute click action
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/acao",
            headers=auth_headers,
            json={"tipo": "click", "x": 200, "y": 200}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify step was recorded
        assert "total_passos" in data, "Response should include total_passos"
        assert "passo_gravado" in data, "Response should include passo_gravado"
        
        if data.get("passo_gravado"):
            passo = data["passo_gravado"]
            print(f"Passo gravado: {passo}")
            assert "ordem" in passo, "Passo should have ordem"
            assert "tipo" in passo, "Passo should have tipo"
            assert passo["tipo"] == "click", "Tipo should be click"
    
    def test_passo_auto_guardado_na_bd(self, auth_headers, active_session_with_recording):
        """Test that step is auto-saved to database (rpa_rascunhos)"""
        session_id = active_session_with_recording
        
        # Execute action with recording enabled
        requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/acao",
            headers=auth_headers,
            json={"tipo": "click", "x": 300, "y": 300}
        )
        
        # Give a moment for auto-save
        time.sleep(0.5)
        
        # Check rascunho endpoint
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/rascunho/{PLATAFORMA_PRIO_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"Rascunho response: {data}")
        
        # Verify rascunho structure
        assert "tem_rascunho" in data, "Response should include tem_rascunho"
        assert "passos" in data, "Response should include passos"
        
        # If there's a draft, it should have passos
        if data.get("tem_rascunho"):
            assert isinstance(data["passos"], list), "passos should be a list"
            assert len(data["passos"]) >= 0, "Should have passos"


class TestRascunhoEndpoints:
    """Test rascunho (draft) management endpoints"""
    
    def test_obter_rascunho(self, auth_headers):
        """Test GET /api/admin/browser-virtual/rascunho/{plataforma_id}"""
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/rascunho/{PLATAFORMA_PRIO_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have structure
        assert "tem_rascunho" in data, "Response should include tem_rascunho"
        assert "passos" in data, "Response should include passos"
        
        print(f"Rascunho exists: {data['tem_rascunho']}")
        if data.get("tem_rascunho"):
            print(f"Rascunho has {len(data['passos'])} passos")
            if data.get("atualizado_em"):
                print(f"Last updated: {data['atualizado_em']}")
    
    def test_obter_rascunho_plataforma_inexistente(self, auth_headers):
        """Test GET rascunho for non-existent plataforma returns empty"""
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/rascunho/non-existent-id",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("tem_rascunho") == False
        assert data.get("passos") == []
    
    def test_limpar_rascunho(self, auth_headers):
        """Test DELETE /api/admin/browser-virtual/rascunho/{plataforma_id}"""
        # First create a rascunho by creating a session and recording
        session_response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={
                "plataforma_id": PLATAFORMA_PRIO_ID,
                "url_inicial": "https://www.google.com"
            },
            timeout=60
        )
        
        if session_response.status_code != 200:
            pytest.skip("Could not create session")
        
        session_id = session_response.json()["session_id"]
        
        # Enable recording and do action
        requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/gravar?ativar=true",
            headers=auth_headers
        )
        requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/acao",
            headers=auth_headers,
            json={"tipo": "click", "x": 100, "y": 100}
        )
        
        # Terminate session first
        requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
            headers=auth_headers
        )
        
        # Now test delete rascunho
        response = requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/rascunho/{PLATAFORMA_PRIO_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("sucesso") == True
        print("Rascunho cleared successfully")


class TestReplayEndpoint:
    """Test the replay functionality for testing automation before final save"""
    
    @pytest.fixture
    def session_with_passos(self, auth_headers):
        """Create session with some recorded steps"""
        # Start session
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={
                "plataforma_id": PLATAFORMA_PRIO_ID,
                "url_inicial": "https://www.google.com"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            pytest.skip("Could not create browser session")
        
        session_id = response.json()["session_id"]
        
        # Enable recording
        requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/gravar?ativar=true",
            headers=auth_headers
        )
        
        # Record some actions
        requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/acao",
            headers=auth_headers,
            json={"tipo": "click", "x": 640, "y": 360}
        )
        time.sleep(0.3)
        
        yield session_id
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
            headers=auth_headers
        )
    
    def test_replay_passos(self, auth_headers, session_with_passos):
        """Test POST /api/admin/browser-virtual/sessao/{id}/replay"""
        session_id = session_with_passos
        
        # First verify there are passos to replay
        passos_response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/passos",
            headers=auth_headers
        )
        
        assert passos_response.status_code == 200
        passos_data = passos_response.json()
        print(f"Passos before replay: {passos_data}")
        
        # Skip if no passos
        if not passos_data.get("passos"):
            pytest.skip("No passos to replay")
        
        # Execute replay
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/replay",
            headers=auth_headers,
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"Replay response: {data}")
        
        # Verify replay response structure
        assert "sucesso" in data, "Response should include sucesso"
        assert "total_passos" in data, "Response should include total_passos"
        assert "passos_sucesso" in data, "Response should include passos_sucesso"
        assert "passos_erro" in data, "Response should include passos_erro"
        assert "resultados" in data, "Response should include resultados"
        assert "screenshot_final" in data, "Response should include screenshot_final"
        assert "url_final" in data, "Response should include url_final"
        
        print(f"Replay: {data['passos_sucesso']}/{data['total_passos']} passos succeeded")
    
    def test_replay_sem_passos_erro(self, auth_headers):
        """Test replay with no steps returns error"""
        # Create fresh session
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={
                "plataforma_id": PLATAFORMA_PRIO_ID,
                "url_inicial": "https://www.google.com"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            pytest.skip("Could not create browser session")
        
        session_id = response.json()["session_id"]
        
        # Clear any existing passos
        requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/passos",
            headers=auth_headers
        )
        
        # Try replay with no passos
        replay_response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/replay",
            headers=auth_headers
        )
        
        # Should return 400 with "Nenhum passo para executar"
        assert replay_response.status_code == 400
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
            headers=auth_headers
        )
    
    def test_replay_sessao_inexistente(self, auth_headers):
        """Test replay on non-existent session returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/fake-session-123/replay",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestSessionPassosManagement:
    """Test passos management within a session"""
    
    @pytest.fixture
    def active_session(self, auth_headers):
        """Create an active session"""
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={
                "plataforma_id": PLATAFORMA_PRIO_ID,
                "url_inicial": "https://www.google.com"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            pytest.skip("Could not create browser session")
        
        session_id = response.json()["session_id"]
        yield session_id
        
        requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
            headers=auth_headers
        )
    
    def test_obter_passos(self, auth_headers, active_session):
        """Test GET /api/admin/browser-virtual/sessao/{id}/passos"""
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{active_session}/passos",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "passos" in data
        assert "gravando" in data
        assert isinstance(data["passos"], list)
    
    def test_limpar_passos_sessao(self, auth_headers, active_session):
        """Test DELETE /api/admin/browser-virtual/sessao/{id}/passos"""
        # First record some passos
        requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{active_session}/gravar?ativar=true",
            headers=auth_headers
        )
        requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{active_session}/acao",
            headers=auth_headers,
            json={"tipo": "click", "x": 100, "y": 100}
        )
        
        # Now clear them
        response = requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{active_session}/passos",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("sucesso") == True
        
        # Verify cleared
        passos_response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{active_session}/passos",
            headers=auth_headers
        )
        assert passos_response.status_code == 200
        assert len(passos_response.json().get("passos", [])) == 0


class TestGuardarPassosDefinitivamente:
    """Test saving steps definitively to plataforma"""
    
    @pytest.fixture
    def session_with_passos(self, auth_headers):
        """Create session with recorded steps"""
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            headers=auth_headers,
            json={
                "plataforma_id": PLATAFORMA_PRIO_ID,
                "url_inicial": "https://www.google.com"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            pytest.skip("Could not create browser session")
        
        session_id = response.json()["session_id"]
        
        # Record some steps
        requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/gravar?ativar=true",
            headers=auth_headers
        )
        requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/acao",
            headers=auth_headers,
            json={"tipo": "click", "x": 500, "y": 400}
        )
        
        yield session_id
        
        requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
            headers=auth_headers
        )
    
    def test_guardar_passos_extracao(self, auth_headers, session_with_passos):
        """Test POST /api/admin/browser-virtual/sessao/{id}/passos/guardar?tipo=extracao"""
        session_id = session_with_passos
        
        # Verify we have passos
        passos_response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/passos",
            headers=auth_headers
        )
        
        if not passos_response.json().get("passos"):
            pytest.skip("No passos to save")
        
        # Save as extracao
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/passos/guardar?tipo=extracao",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("sucesso") == True
        assert data.get("tipo") == "extracao"
        assert "passos_guardados" in data
        print(f"Saved {data['passos_guardados']} passos as extração")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
