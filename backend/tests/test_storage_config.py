"""
Backend tests for Storage Configuration APIs
Testing: /api/storage-config endpoints for Cloud Storage Integration
"""
import pytest
import requests
import os

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDENTIALS = {"email": "admin@tvdefleet.com", "password": "Admin123!"}
PARCEIRO_CREDENTIALS = {"email": "geral@zmbusines.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=ADMIN_CREDENTIALS
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def parceiro_token():
    """Get parceiro authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=PARCEIRO_CREDENTIALS
    )
    assert response.status_code == 200, f"Parceiro login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def parceiro_headers(parceiro_token):
    """Headers with parceiro auth"""
    return {"Authorization": f"Bearer {parceiro_token}"}


class TestStorageConfigGet:
    """Tests for GET /api/storage-config"""
    
    def test_get_config_as_admin(self, admin_headers):
        """Admin can get their storage config"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "modo" in data
        assert "cloud_provider" in data
        assert "cloud_connected" in data
        assert data["modo"] in ["local", "cloud", "both"]
        print(f"Admin config: modo={data['modo']}, provider={data.get('cloud_provider')}")
    
    def test_get_config_as_parceiro(self, parceiro_headers):
        """Parceiro can get their storage config"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify default structure
        assert "modo" in data
        assert "cloud_provider" in data
        assert "parceiro_id" in data
        print(f"Parceiro config: modo={data['modo']}, provider={data.get('cloud_provider')}")
    
    def test_get_config_without_auth(self):
        """Unauthenticated request should fail"""
        response = requests.get(f"{BASE_URL}/api/storage-config")
        assert response.status_code in [401, 403]


class TestStorageProviders:
    """Tests for GET /api/storage-config/providers"""
    
    def test_list_providers(self, admin_headers):
        """List available cloud providers"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config/providers",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "providers" in data
        providers = data["providers"]
        assert len(providers) >= 4  # terabox, google_drive, onedrive, dropbox
        
        # Verify provider structure
        provider_ids = [p["id"] for p in providers]
        assert "terabox" in provider_ids
        assert "google_drive" in provider_ids
        assert "onedrive" in provider_ids
        assert "dropbox" in provider_ids
        
        # Check provider structure
        for provider in providers:
            assert "id" in provider
            assert "nome" in provider
            assert "descricao" in provider
            assert "connected" in provider
            print(f"Provider: {provider['id']} - {provider['nome']} - Connected: {provider['connected']}")
    
    def test_list_providers_as_parceiro(self, parceiro_headers):
        """Parceiro can list providers"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config/providers",
            headers=parceiro_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "providers" in data


class TestStorageConfigUpdate:
    """Tests for PUT /api/storage-config"""
    
    def test_update_config_to_local(self, admin_headers):
        """Update config to local mode"""
        response = requests.put(
            f"{BASE_URL}/api/storage-config",
            headers=admin_headers,
            json={
                "modo": "local",
                "cloud_provider": "none",
                "sync_relatorios": True,
                "sync_recibos": True,
                "sync_vistorias": True,
                "sync_documentos_veiculos": True,
                "sync_documentos_motoristas": True,
                "sync_contratos": True,
                "sync_comprovativos": True,
                "pasta_raiz": "/TVDEFleet"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["modo"] == "local"
        print(f"Config updated to local mode")
    
    def test_update_config_cloud_requires_provider(self, parceiro_headers):
        """Setting cloud mode without provider should fail"""
        response = requests.put(
            f"{BASE_URL}/api/storage-config",
            headers=parceiro_headers,
            json={
                "modo": "cloud",
                "cloud_provider": "none"  # Invalid - cloud mode needs provider
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Expected error: {data['detail']}")


class TestCloudConnection:
    """Tests for cloud provider connection endpoints"""
    
    def test_connect_provider_without_credentials(self, admin_headers):
        """Connecting without credentials should fail"""
        response = requests.post(
            f"{BASE_URL}/api/storage-config/connect/terabox",
            headers=admin_headers,
            json={
                "provider": "terabox"
                # Missing email and password
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Expected error: {data['detail']}")
    
    def test_connect_invalid_provider(self, admin_headers):
        """Connecting to invalid provider should fail"""
        response = requests.post(
            f"{BASE_URL}/api/storage-config/connect/invalid_provider",
            headers=admin_headers,
            json={
                "provider": "invalid_provider",
                "email": "test@test.com",
                "password": "testpassword"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Expected error for invalid provider: {data['detail']}")
    
    def test_connect_terabox_with_credentials(self, parceiro_headers):
        """Connect terabox provider with credentials (MOCKED - saves creds but doesn't actually authenticate)"""
        response = requests.post(
            f"{BASE_URL}/api/storage-config/connect/terabox",
            headers=parceiro_headers,
            json={
                "provider": "terabox",
                "email": "test@terabox.com",
                "password": "testpassword123"
            }
        )
        # This should succeed as it stores credentials (mocked auth)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["provider"] == "terabox"
        assert data["email"] == "test@terabox.com"
        print(f"Terabox connected (MOCKED): {data['email']}")


class TestAdminAllConfigs:
    """Tests for GET /api/storage-config/admin/all - Admin only"""
    
    def test_get_all_configs_as_admin(self, admin_headers):
        """Admin can view all partner configs"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config/admin/all",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "total" in data
        assert "configs" in data
        assert isinstance(data["configs"], list)
        
        print(f"Total partner configs: {data['total']}")
        
        # Check structure of configs
        if data["configs"]:
            config = data["configs"][0]
            assert "parceiro_id" in config
            assert "modo" in config
            print(f"Sample config: parceiro_id={config.get('parceiro_id')}, modo={config.get('modo')}")
    
    def test_get_all_configs_as_parceiro_forbidden(self, parceiro_headers):
        """Parceiro cannot view all partner configs"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config/admin/all",
            headers=parceiro_headers
        )
        assert response.status_code == 403
        data = response.json()
        assert "detail" in data
        print(f"Expected forbidden for parceiro: {data['detail']}")


class TestSyncStatus:
    """Tests for sync status endpoints"""
    
    def test_get_sync_status(self, admin_headers):
        """Get sync status"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config/sync-status",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "pending_files" in data
        assert "failed_last_24h" in data
        print(f"Sync status: pending={data['pending_files']}, failed_24h={data['failed_last_24h']}")
    
    def test_trigger_sync_local_mode_fails(self, admin_headers):
        """Triggering sync in local mode should fail"""
        # First ensure we're in local mode
        requests.put(
            f"{BASE_URL}/api/storage-config",
            headers=admin_headers,
            json={"modo": "local", "cloud_provider": "none"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/storage-config/sync-now",
            headers=admin_headers
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Expected error for sync in local mode: {data['detail']}")


class TestDisconnectProvider:
    """Tests for disconnecting cloud providers"""
    
    def test_disconnect_provider_not_found(self, admin_headers):
        """Disconnecting non-existent provider should return 404"""
        response = requests.delete(
            f"{BASE_URL}/api/storage-config/disconnect/google_drive",
            headers=admin_headers
        )
        # May return 404 if not connected, or 400 if in use
        assert response.status_code in [400, 404]
        print(f"Disconnect response: {response.status_code}")


class TestDownloadEndpoints:
    """Tests for cloud download endpoints"""
    
    def test_download_no_provider_configured(self, admin_headers):
        """Download without cloud provider should fail gracefully"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config/download",
            headers=admin_headers,
            params={"cloud_path": "/test/file.pdf", "provider": "terabox"}
        )
        # Should fail as no cloud provider is fully configured
        assert response.status_code in [400, 500]
        print(f"Download without provider: status={response.status_code}")
    
    def test_list_cloud_files_no_provider(self, admin_headers):
        """List files without cloud provider"""
        response = requests.get(
            f"{BASE_URL}/api/storage-config/files",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Should return empty or message
        assert "files" in data or "message" in data
        print(f"List files response: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
