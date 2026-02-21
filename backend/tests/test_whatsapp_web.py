"""Test WhatsApp Web Integration APIs for TVDEFleet"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vps-preview.preview.emergentagent.com').rstrip('/')

class TestWhatsAppWebAPI:
    """Test WhatsApp Web API endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        print(f"Admin login response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            # Try both token field names
            token = data.get("access_token") or data.get("token")
            if token:
                return token
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "Admin123!"
        })
        print(f"Parceiro login response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                return token
        pytest.skip("Parceiro authentication failed")
    
    def test_health_endpoint(self):
        """Test WhatsApp service health endpoint (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/whatsapp-web/health")
        print(f"Health response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"WhatsApp service status: {data.get('status')}")
        print(f"Chromium available: {data.get('chromium', {}).get('available')}")
    
    def test_status_endpoint_admin(self, admin_token):
        """Test WhatsApp status for admin user"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-web/status", headers=headers)
        print(f"Status response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        assert "ready" in data
        assert "parceiro_id" in data
        print(f"Admin session - connected: {data.get('connected')}, ready: {data.get('ready')}")
    
    def test_status_endpoint_parceiro(self, parceiro_token):
        """Test WhatsApp status for parceiro user"""
        headers = {"Authorization": f"Bearer {parceiro_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-web/status", headers=headers)
        print(f"Parceiro status response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        assert "ready" in data
        assert "parceiro_id" in data
        print(f"Parceiro session - parceiro_id: {data.get('parceiro_id')}")
    
    def test_qr_endpoint(self, admin_token):
        """Test QR code generation endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-web/qr", headers=headers)
        print(f"QR response: {response.status_code} - {response.text[:200] if response.text else 'empty'}...")
        
        # QR endpoint should work (may return QR or indicate already connected)
        assert response.status_code in [200, 503]
        data = response.json()
        
        # Should have either qr, qrCode, connected, or error
        has_valid_response = any([
            data.get("qr"),
            data.get("qrCode"),
            data.get("connected"),
            data.get("message"),
            data.get("success") is not None
        ])
        assert has_valid_response, f"Unexpected QR response: {data}"
        print(f"QR endpoint working - has qr: {bool(data.get('qr') or data.get('qrCode'))}, connected: {data.get('connected')}")
    
    def test_templates_endpoint(self, admin_token):
        """Test message templates endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-web/templates", headers=headers)
        print(f"Templates response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert "templates" in data
        assert isinstance(data["templates"], list)
        assert len(data["templates"]) > 0
        
        # Check template structure
        template = data["templates"][0]
        assert "id" in template
        assert "nome" in template
        assert "mensagem" in template
        print(f"Found {len(data['templates'])} templates")
        for t in data["templates"]:
            print(f"  - {t['id']}: {t['nome']}")
    
    def test_alerts_config_endpoint(self, admin_token):
        """Test alerts configuration endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-web/alerts-config", headers=headers)
        print(f"Alerts config response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have config fields
        expected_fields = ["alertas_documentos", "alertas_manutencao", "alertas_vencimentos", 
                         "relatorio_semanal", "dias_antecedencia"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        print(f"Alerts config: documentos={data.get('alertas_documentos')}, manutencao={data.get('alertas_manutencao')}")
    
    def test_history_endpoint(self, admin_token):
        """Test message history endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-web/history?limit=10", headers=headers)
        print(f"History response: {response.status_code} - {response.text[:500] if response.text else 'empty'}...")
        
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert isinstance(data["logs"], list)
        print(f"Found {len(data['logs'])} history logs")
    
    def test_update_alerts_config(self, admin_token):
        """Test updating alerts configuration"""
        headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
        
        # Update config
        new_config = {
            "alertas_documentos": True,
            "alertas_manutencao": True,
            "alertas_vencimentos": True,
            "relatorio_semanal": False,
            "dias_antecedencia": 7
        }
        
        response = requests.put(f"{BASE_URL}/api/whatsapp-web/alerts-config", 
                               headers=headers, json=new_config)
        print(f"Update alerts config response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        
        # Verify update
        response = requests.get(f"{BASE_URL}/api/whatsapp-web/alerts-config", headers=headers)
        updated_config = response.json()
        assert updated_config.get("alertas_documentos") == True
        assert updated_config.get("alertas_manutencao") == True
        print("Alerts config updated successfully")
    
    def test_unauthorized_access(self):
        """Test that endpoints require authentication"""
        endpoints = [
            "/api/whatsapp-web/status",
            "/api/whatsapp-web/qr",
            "/api/whatsapp-web/templates",
            "/api/whatsapp-web/alerts-config",
            "/api/whatsapp-web/history"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            print(f"Unauthorized {endpoint}: {response.status_code}")
            # Should return 401/403 without auth
            assert response.status_code in [401, 403, 422], \
                f"Endpoint {endpoint} should require auth, got {response.status_code}"
        
        print("All protected endpoints require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
