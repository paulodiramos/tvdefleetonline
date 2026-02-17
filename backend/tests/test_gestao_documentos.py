"""
Test module for GestaoDocumentos feature (P2)
Tests the documentos-expirar endpoint and related functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "admin123"
PARCEIRO_EMAIL = "parceiro@tvdefleet.com"
PARCEIRO_PASSWORD = "parceiro123"


class TestDocumentosExpirar:
    """Tests for /api/alertas/documentos-expirar endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_token(self, email: str, password: str) -> str:
        """Get authentication token"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed for {email}")
        return ""

    def test_documentos_expirar_admin_auth(self):
        """Test admin can access documentos-expirar endpoint"""
        token = self.get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        
        response = self.session.get(
            f"{BASE_URL}/api/alertas/documentos-expirar?dias=30",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "expirados" in data
        assert "a_expirar" in data
        assert "total_expirados" in data
        assert "total_a_expirar" in data
        assert isinstance(data["expirados"], list)
        assert isinstance(data["a_expirar"], list)
        print(f"✓ Admin access: Found {data['total_expirados']} expired, {data['total_a_expirar']} expiring")

    def test_documentos_expirar_parceiro_auth(self):
        """Test parceiro can access documentos-expirar endpoint"""
        token = self.get_token(PARCEIRO_EMAIL, PARCEIRO_PASSWORD)
        
        response = self.session.get(
            f"{BASE_URL}/api/alertas/documentos-expirar?dias=30",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "expirados" in data
        assert "a_expirar" in data
        print(f"✓ Parceiro access: Found {data['total_expirados']} expired, {data['total_a_expirar']} expiring")

    def test_documentos_expirar_dias_parameter(self):
        """Test dias parameter works correctly"""
        token = self.get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        
        # Test with different dias values
        for dias in [7, 15, 30, 60, 90]:
            response = self.session.get(
                f"{BASE_URL}/api/alertas/documentos-expirar?dias={dias}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "expirados" in data
            assert "a_expirar" in data
        print("✓ dias parameter works for all values: 7, 15, 30, 60, 90")

    def test_documentos_expirar_no_auth(self):
        """Test endpoint requires authentication"""
        response = self.session.get(
            f"{BASE_URL}/api/alertas/documentos-expirar?dias=30"
        )
        
        assert response.status_code == 401 or response.status_code == 403
        print("✓ Endpoint correctly requires authentication")

    def test_documentos_expirar_response_structure(self):
        """Test response structure for documents"""
        token = self.get_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        
        response = self.session.get(
            f"{BASE_URL}/api/alertas/documentos-expirar?dias=90",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that if there are documents, they have correct structure
        for doc in data.get("expirados", []) + data.get("a_expirar", []):
            assert "id" in doc
            assert "tipo" in doc  # 'motorista' or 'veiculo'
            assert "documento" in doc  # document name
            assert "validade" in doc  # expiry date
            # Either nome (for motorista) or matricula (for veiculo)
            assert "nome" in doc or "matricula" in doc
        print(f"✓ Response structure is correct")


class TestMotoristasVeiculosEndpoints:
    """Tests for motoristas and vehicles endpoints used by GestaoDocumentos"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_token(self, email: str, password: str) -> str:
        """Get authentication token"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed for {email}")
        return ""

    def test_motoristas_endpoint(self):
        """Test GET /api/motoristas endpoint"""
        token = self.get_token(PARCEIRO_EMAIL, PARCEIRO_PASSWORD)
        
        response = self.session.get(
            f"{BASE_URL}/api/motoristas",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/motoristas returns list with {len(data)} motoristas")

    def test_vehicles_endpoint(self):
        """Test GET /api/vehicles endpoint"""
        token = self.get_token(PARCEIRO_EMAIL, PARCEIRO_PASSWORD)
        
        response = self.session.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/vehicles returns list with {len(data)} vehicles")

    def test_terabox_stats_endpoint(self):
        """Test GET /api/terabox/stats endpoint"""
        token = self.get_token(PARCEIRO_EMAIL, PARCEIRO_PASSWORD)
        
        response = self.session.get(
            f"{BASE_URL}/api/terabox/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Endpoint may return 200 with data or 404 if not configured
        assert response.status_code in [200, 404]
        print(f"✓ GET /api/terabox/stats returns status {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
