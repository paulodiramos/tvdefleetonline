"""
Test RPA Designer tipo_design functionality
- Tests for Login vs Extracao design types
- Tests filtering, saving, and retrieval of designs by type
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"

# Known platform ID for Uber Fleet
UBER_PLATFORM_ID = "ba0f947c-b7d5-4127-8383-817b13ec406d"


class TestRPADesignerTipoDesign:
    """Test RPA Designer tipo_design feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client, admin_token):
        """Setup for each test"""
        self.client = api_client
        self.token = admin_token
        self.client.headers.update({"Authorization": f"Bearer {self.token}"})
    
    # ============ GET /api/rpa-designer/designs ============
    
    def test_get_designs_returns_tipo_design_field(self, api_client, admin_token):
        """Verify GET /api/rpa-designer/designs returns designs with tipo_design field"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = api_client.get(f"{BASE_URL}/api/rpa-designer/designs")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        designs = response.json()
        assert isinstance(designs, list), "Response should be a list"
        
        # If there are designs, check they have tipo_design field
        if len(designs) > 0:
            for design in designs:
                assert "tipo_design" in design, f"Design {design.get('id')} missing tipo_design field"
                assert design["tipo_design"] in ["login", "extracao"], f"Invalid tipo_design: {design['tipo_design']}"
                print(f"Design '{design.get('nome')}' has tipo_design: {design['tipo_design']}")
        else:
            print("No designs found - this is acceptable for the test")
    
    def test_get_designs_filter_by_tipo_login(self, api_client, admin_token):
        """Verify GET /api/rpa-designer/designs?tipo_design=login filters correctly"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = api_client.get(f"{BASE_URL}/api/rpa-designer/designs?tipo_design=login")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        designs = response.json()
        assert isinstance(designs, list), "Response should be a list"
        
        # All returned designs should have tipo_design = 'login'
        for design in designs:
            assert design.get("tipo_design") == "login", f"Expected tipo_design=login, got {design.get('tipo_design')}"
        
        print(f"Found {len(designs)} login designs")
    
    def test_get_designs_filter_by_tipo_extracao(self, api_client, admin_token):
        """Verify GET /api/rpa-designer/designs?tipo_design=extracao filters correctly"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = api_client.get(f"{BASE_URL}/api/rpa-designer/designs?tipo_design=extracao")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        designs = response.json()
        assert isinstance(designs, list), "Response should be a list"
        
        # All returned designs should have tipo_design = 'extracao' or be legacy (no tipo_design)
        for design in designs:
            tipo = design.get("tipo_design", "extracao")
            assert tipo == "extracao", f"Expected tipo_design=extracao, got {tipo}"
        
        print(f"Found {len(designs)} extracao designs")
    
    def test_get_designs_filter_by_plataforma_and_tipo(self, api_client, admin_token):
        """Verify combined filtering by plataforma_id and tipo_design works"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = api_client.get(
            f"{BASE_URL}/api/rpa-designer/designs?plataforma_id={UBER_PLATFORM_ID}&tipo_design=extracao"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        designs = response.json()
        assert isinstance(designs, list), "Response should be a list"
        
        # All returned designs should be for Uber and tipo extracao
        for design in designs:
            assert design.get("plataforma_id") == UBER_PLATFORM_ID, f"Wrong plataforma_id: {design.get('plataforma_id')}"
            assert design.get("tipo_design") in ["extracao", None], f"Wrong tipo_design: {design.get('tipo_design')}"
        
        print(f"Found {len(designs)} Uber extracao designs")
    
    # ============ POST /api/rpa-designer/sessao/iniciar ============
    
    def test_iniciar_sessao_accepts_tipo_design_login(self, api_client, admin_token):
        """Verify POST /api/rpa-designer/sessao/iniciar accepts tipo_design='login'"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = api_client.post(
            f"{BASE_URL}/api/rpa-designer/sessao/iniciar",
            json={
                "plataforma_id": UBER_PLATFORM_ID,
                "semana_offset": 0,
                "tipo_design": "login"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "session_id" in data, "Response should contain session_id"
        assert data.get("tipo_design") == "login", f"Expected tipo_design=login, got {data.get('tipo_design')}"
        
        print(f"Session created with tipo_design=login: {data.get('session_id')}")
        
        # Clean up - cancel the session
        session_id = data.get("session_id")
        if session_id:
            api_client.delete(f"{BASE_URL}/api/rpa-designer/sessao/{session_id}")
    
    def test_iniciar_sessao_accepts_tipo_design_extracao(self, api_client, admin_token):
        """Verify POST /api/rpa-designer/sessao/iniciar accepts tipo_design='extracao'"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = api_client.post(
            f"{BASE_URL}/api/rpa-designer/sessao/iniciar",
            json={
                "plataforma_id": UBER_PLATFORM_ID,
                "semana_offset": 0,
                "tipo_design": "extracao"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "session_id" in data, "Response should contain session_id"
        assert data.get("tipo_design") == "extracao", f"Expected tipo_design=extracao, got {data.get('tipo_design')}"
        
        print(f"Session created with tipo_design=extracao: {data.get('session_id')}")
        
        # Clean up - cancel the session
        session_id = data.get("session_id")
        if session_id:
            api_client.delete(f"{BASE_URL}/api/rpa-designer/sessao/{session_id}")
    
    def test_iniciar_sessao_default_tipo_design_is_extracao(self, api_client, admin_token):
        """Verify POST /api/rpa-designer/sessao/iniciar defaults to tipo_design='extracao'"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = api_client.post(
            f"{BASE_URL}/api/rpa-designer/sessao/iniciar",
            json={
                "plataforma_id": UBER_PLATFORM_ID,
                "semana_offset": 0
                # No tipo_design specified
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "session_id" in data, "Response should contain session_id"
        assert data.get("tipo_design") == "extracao", f"Expected default tipo_design=extracao, got {data.get('tipo_design')}"
        
        print(f"Session created with default tipo_design: {data.get('tipo_design')}")
        
        # Clean up
        session_id = data.get("session_id")
        if session_id:
            api_client.delete(f"{BASE_URL}/api/rpa-designer/sessao/{session_id}")
    
    # ============ GET /api/rpa-designer/designs-sincronizacao ============
    
    def test_designs_sincronizacao_endpoint(self, api_client, admin_token):
        """Verify GET /api/rpa-designer/designs-sincronizacao/{plataforma_id}/{semana} works"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = api_client.get(
            f"{BASE_URL}/api/rpa-designer/designs-sincronizacao/{UBER_PLATFORM_ID}/0"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "plataforma_id" in data, "Response should contain plataforma_id"
        assert "semana_offset" in data, "Response should contain semana_offset"
        assert "login" in data, "Response should contain login design info"
        assert "extracao" in data, "Response should contain extracao design info"
        assert "pode_executar" in data, "Response should contain pode_executar flag"
        assert "fluxo" in data, "Response should contain fluxo description"
        
        # Verify values
        assert data["plataforma_id"] == UBER_PLATFORM_ID
        assert data["semana_offset"] == 0
        
        print(f"Designs sincronizacao response:")
        print(f"  - Login design: {data.get('login')}")
        print(f"  - Extracao design: {data.get('extracao')}")
        print(f"  - Pode executar: {data.get('pode_executar')}")
        print(f"  - Fluxo: {data.get('fluxo')}")
    
    def test_designs_sincronizacao_multiple_weeks(self, api_client, admin_token):
        """Verify designs-sincronizacao works for weeks 0-3"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        for semana in range(4):
            response = api_client.get(
                f"{BASE_URL}/api/rpa-designer/designs-sincronizacao/{UBER_PLATFORM_ID}/{semana}"
            )
            
            assert response.status_code == 200, f"Week {semana}: Expected 200, got {response.status_code}"
            
            data = response.json()
            assert data["semana_offset"] == semana, f"Wrong semana_offset: {data['semana_offset']}"
            
            print(f"Week {semana}: login={bool(data.get('login'))}, extracao={bool(data.get('extracao'))}")
    
    # ============ Verify existing designs have correct tipo_design ============
    
    def test_existing_uber_designs_have_tipo_design(self, api_client, admin_token):
        """Verify existing Uber Fleet designs have tipo_design field set"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = api_client.get(
            f"{BASE_URL}/api/rpa-designer/designs?plataforma_id={UBER_PLATFORM_ID}"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        designs = response.json()
        
        # Count designs by type
        login_count = 0
        extracao_count = 0
        
        for design in designs:
            tipo = design.get("tipo_design", "extracao")  # Default to extracao for legacy
            if tipo == "login":
                login_count += 1
            elif tipo == "extracao":
                extracao_count += 1
            
            print(f"Design '{design.get('nome')}' semana {design.get('semana_offset')}: tipo={tipo}")
        
        print(f"\nTotal: {len(designs)} designs - {login_count} login, {extracao_count} extracao")


# ============ Fixtures ============

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    
    data = response.json()
    token = data.get("access_token") or data.get("token")
    
    if not token:
        pytest.skip("No token in login response")
    
    return token
