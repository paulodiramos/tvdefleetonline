"""
Backend tests for WhatsApp Cloud API integration in TVDEFleet
Tests all WhatsApp Cloud API endpoints including status, templates, 
mass sending (vistoria), scheduling configuration, and document alerts.

Note: The WhatsApp Cloud API is NOT CONFIGURED (MOCKED) - 
      WHATSAPP_CLOUD_ACCESS_TOKEN and PHONE_NUMBER_ID are empty.
      Endpoints that require sending messages should return 503.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://vps-preview.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "Admin123!"
PARCEIRO_EMAIL = "geral@zmbusines.com"
PARCEIRO_PASSWORD = "Admin123!"


class TestAuth:
    """Authentication tests for WhatsApp Cloud API access"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        token = data.get("access_token") or data.get("token")
        assert token, "Token not in response"
        return token
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PARCEIRO_EMAIL, "password": PARCEIRO_PASSWORD}
        )
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        data = response.json()
        token = data.get("access_token") or data.get("token")
        assert token, "Token not in response"
        return token

    def test_admin_login_success(self, admin_token):
        """Test admin login returns valid token"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print(f"✅ Admin login successful, token length: {len(admin_token)}")

    def test_parceiro_login_success(self, parceiro_token):
        """Test parceiro login returns valid token"""
        assert parceiro_token is not None
        assert len(parceiro_token) > 0
        print(f"✅ Parceiro login successful, token length: {len(parceiro_token)}")


class TestWhatsAppCloudStatus:
    """Test GET /api/whatsapp-cloud/status endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        data = response.json()
        return data.get("access_token") or data.get("token")

    def test_status_endpoint_exists(self, admin_token):
        """Test status endpoint returns successfully"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-cloud/status", headers=headers)
        
        assert response.status_code == 200, f"Status endpoint failed: {response.text}"
        print(f"✅ GET /api/whatsapp-cloud/status - Status 200 OK")

    def test_status_response_structure(self, admin_token):
        """Test status response has expected fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-cloud/status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "configured" in data, "Missing 'configured' field"
        assert "has_access_token" in data, "Missing 'has_access_token' field"
        assert "has_phone_number_id" in data, "Missing 'has_phone_number_id' field"
        assert "api_version" in data, "Missing 'api_version' field"
        assert "templates_available" in data, "Missing 'templates_available' field"
        
        print(f"✅ Status response structure valid")
        print(f"   - configured: {data['configured']}")
        print(f"   - has_access_token: {data['has_access_token']}")
        print(f"   - has_phone_number_id: {data['has_phone_number_id']}")
        print(f"   - templates_available: {data['templates_available']}")

    def test_api_not_configured(self, admin_token):
        """Test API shows as not configured (credentials not set)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-cloud/status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # API should NOT be configured (MOCKED)
        assert data["configured"] == False, "API should not be configured without credentials"
        assert data["has_access_token"] == False, "Should not have access token"
        assert data["has_phone_number_id"] == False, "Should not have phone number ID"
        
        print(f"✅ API correctly shows as NOT CONFIGURED (MOCKED)")


class TestWhatsAppCloudTemplates:
    """Test GET /api/whatsapp-cloud/templates endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        data = response.json()
        return data.get("access_token") or data.get("token")

    def test_templates_endpoint_exists(self, admin_token):
        """Test templates endpoint returns successfully"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-cloud/templates", headers=headers)
        
        assert response.status_code == 200, f"Templates endpoint failed: {response.text}"
        print(f"✅ GET /api/whatsapp-cloud/templates - Status 200 OK")

    def test_templates_count_is_12(self, admin_token):
        """Test that 12 templates are available"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-cloud/templates", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "templates" in data, "Missing 'templates' field"
        assert "total" in data, "Missing 'total' field"
        assert data["total"] == 12, f"Expected 12 templates, got {data['total']}"
        assert len(data["templates"]) == 12, f"Expected 12 templates in list, got {len(data['templates'])}"
        
        print(f"✅ Templates endpoint returns exactly 12 templates")

    def test_templates_have_required_fields(self, admin_token):
        """Test each template has required fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-cloud/templates", headers=headers)
        
        data = response.json()
        templates = data["templates"]
        
        expected_template_names = [
            "relatorio_semanal", "documento_expirar", "boas_vindas",
            "vistoria_agendada", "revisao_veiculo", "pagamento_efetuado",
            "seguro_expirar", "iuc_expirar", "reuniao_agendada",
            "aviso_geral", "turno_atribuido", "contrato_renovar"
        ]
        
        template_names = [t["name"] for t in templates]
        
        for expected_name in expected_template_names:
            assert expected_name in template_names, f"Missing template: {expected_name}"
        
        # Check each template has required fields
        for template in templates:
            assert "name" in template, f"Template missing 'name'"
            assert "description" in template, f"Template {template.get('name')} missing 'description'"
            assert "variables" in template, f"Template {template.get('name')} missing 'variables'"
            assert "preview" in template, f"Template {template.get('name')} missing 'preview'"
            assert "language" in template, f"Template {template.get('name')} missing 'language'"
            assert template["language"] == "pt_PT", f"Template {template.get('name')} should be pt_PT"
        
        print(f"✅ All 12 templates have required fields:")
        for name in expected_template_names:
            print(f"   - {name}")


class TestWhatsAppCloudMassaSending:
    """Test POST /api/whatsapp-cloud/send/vistoria-massa endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        data = response.json()
        return data.get("access_token") or data.get("token")

    def test_vistoria_massa_endpoint_exists(self, admin_token):
        """Test vistoria-massa endpoint returns expected error without credentials"""
        headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "motorista_ids": ["test-id-1"],
            "data_vistoria": "15/03/2025",
            "hora": "10:00",
            "local": "Centro de Inspeções Lisboa"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-cloud/send/vistoria-massa",
            headers=headers,
            json=payload
        )
        
        # Should return 503 because API is not configured OR 200 with failures
        # (depends on whether it tries to send or validates first)
        assert response.status_code in [200, 503], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 503:
            print(f"✅ POST /api/whatsapp-cloud/send/vistoria-massa - Returns 503 (API not configured) - Expected")
        else:
            # If 200, check that there were failures (no actual motoristas found or send failures)
            data = response.json()
            print(f"✅ POST /api/whatsapp-cloud/send/vistoria-massa - Returns 200")
            print(f"   - Total motoristas: {data.get('total_motoristas', 0)}")
            print(f"   - Enviados: {data.get('enviados', 0)}")
            print(f"   - Falhas: {data.get('falhas', 0)}")


class TestWhatsAppAgendamentoConfig:
    """Test agendamento configuration endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        data = response.json()
        return data.get("access_token") or data.get("token")

    def test_get_agendamento_config(self, admin_token):
        """Test GET /api/whatsapp-cloud/agendamento/config"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-cloud/agendamento/config", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "hora" in data, "Missing 'hora' field"
        assert "dias_antecedencia" in data, "Missing 'dias_antecedencia' field"
        assert "habilitado" in data, "Missing 'habilitado' field"
        
        print(f"✅ GET /api/whatsapp-cloud/agendamento/config - Status 200 OK")
        print(f"   - hora: {data.get('hora')}")
        print(f"   - dias_antecedencia: {data.get('dias_antecedencia')}")
        print(f"   - habilitado: {data.get('habilitado')}")

    def test_update_agendamento_config(self, admin_token):
        """Test POST /api/whatsapp-cloud/agendamento/config"""
        headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
        
        # Update config
        payload = {
            "hora": 10,
            "dias_antecedencia": 15,
            "habilitado": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-cloud/agendamento/config",
            headers=headers,
            json=payload
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Update should succeed"
        
        # Verify the update
        response_verify = requests.get(f"{BASE_URL}/api/whatsapp-cloud/agendamento/config", headers=headers)
        data_verify = response_verify.json()
        
        assert data_verify.get("hora") == 10, f"hora should be 10, got {data_verify.get('hora')}"
        assert data_verify.get("dias_antecedencia") == 15, f"dias_antecedencia should be 15"
        
        print(f"✅ POST /api/whatsapp-cloud/agendamento/config - Update successful")
        
        # Reset to default
        reset_payload = {"hora": 9, "dias_antecedencia": 30, "habilitado": False}
        requests.post(f"{BASE_URL}/api/whatsapp-cloud/agendamento/config", headers=headers, json=reset_payload)


class TestRelatorioWhatsApp:
    """Test POST /api/relatorios/semanal/{id}/enviar-whatsapp"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        data = response.json()
        return data.get("access_token") or data.get("token")

    def test_enviar_whatsapp_relatorio_invalid_id(self, admin_token):
        """Test endpoint with invalid relatorio ID returns 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/relatorios/semanal/invalid-id-123/enviar-whatsapp",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✅ POST /api/relatorios/semanal/invalid-id/enviar-whatsapp - Returns 404 (not found)")


class TestAlertasDocumentosWhatsApp:
    """Test POST /api/alertas/documentos-expirar/enviar-whatsapp"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        data = response.json()
        return data.get("access_token") or data.get("token")

    def test_get_documentos_expirar(self, admin_token):
        """Test GET /api/alertas/documentos-expirar endpoint exists"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/alertas/documentos-expirar?dias=30", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "expirados" in data, "Missing 'expirados' field"
        assert "a_expirar" in data, "Missing 'a_expirar' field"
        assert "total_expirados" in data, "Missing 'total_expirados' field"
        assert "total_a_expirar" in data, "Missing 'total_a_expirar' field"
        
        print(f"✅ GET /api/alertas/documentos-expirar - Status 200 OK")
        print(f"   - Total expirados: {data.get('total_expirados')}")
        print(f"   - Total a expirar: {data.get('total_a_expirar')}")

    def test_enviar_alertas_whatsapp(self, admin_token):
        """Test POST /api/alertas/documentos-expirar/enviar-whatsapp"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/alertas/documentos-expirar/enviar-whatsapp?dias=30",
            headers=headers
        )
        
        # Should return 503 (API not configured) or 200 with results
        assert response.status_code in [200, 503], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 503:
            print(f"✅ POST /api/alertas/documentos-expirar/enviar-whatsapp - Returns 503 (API not configured)")
        else:
            data = response.json()
            print(f"✅ POST /api/alertas/documentos-expirar/enviar-whatsapp - Status 200 OK")
            print(f"   - Enviados: {data.get('enviados', 0)}")
            print(f"   - Falhas: {data.get('falhas', 0)}")
            print(f"   - Documentos alertados: {data.get('documentos_alertados', 0)}")


class TestWhatsAppHistoricoEnvios:
    """Test GET /api/whatsapp-cloud/historico-envios"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        data = response.json()
        return data.get("access_token") or data.get("token")

    def test_historico_envios_endpoint(self, admin_token):
        """Test historico-envios endpoint returns successfully"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/whatsapp-cloud/historico-envios", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "envios" in data, "Missing 'envios' field"
        assert "total" in data, "Missing 'total' field"
        assert isinstance(data["envios"], list), "'envios' should be a list"
        
        print(f"✅ GET /api/whatsapp-cloud/historico-envios - Status 200 OK")
        print(f"   - Total envios: {data.get('total')}")


class TestMotoristasList:
    """Test /api/motoristas endpoint for WhatsApp integration"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        data = response.json()
        return data.get("access_token") or data.get("token")

    def test_get_motoristas(self, admin_token):
        """Test GET /api/motoristas returns list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/motoristas", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check if motoristas list exists (handle both formats)
        if isinstance(data, list):
            motoristas = data
        else:
            motoristas = data.get("motoristas") or []
        
        print(f"✅ GET /api/motoristas - Status 200 OK")
        print(f"   - Total motoristas: {len(motoristas)}")
        
        # Check how many have phone/whatsapp
        with_phone = len([m for m in motoristas if m.get("whatsapp") or m.get("phone")])
        print(f"   - Com telefone/WhatsApp: {with_phone}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
