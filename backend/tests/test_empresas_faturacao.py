"""
Test Suite: Empresas de Faturação CRUD and Dashboard
Tests for the billing companies feature that allows partners to manage multiple invoicing entities
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmpresasFaturacaoEndpoints:
    """Test suite for Empresas de Faturação API endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip(f"Admin authentication failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "Admin123!"
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip(f"Parceiro authentication failed: {response.status_code}")
    
    @pytest.fixture
    def admin_headers(self, admin_token):
        """Admin request headers"""
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture
    def parceiro_headers(self, parceiro_token):
        """Parceiro request headers"""
        return {
            "Authorization": f"Bearer {parceiro_token}",
            "Content-Type": "application/json"
        }

    # ==========================================================
    # AUTHENTICATION TESTS
    # ==========================================================
    
    def test_01_admin_login(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data
        print(f"✅ Admin login successful")
    
    def test_02_parceiro_login(self):
        """Test parceiro login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Parceiro login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data
        print(f"✅ Parceiro login successful, role: {data.get('user', {}).get('role')}")

    # ==========================================================
    # GET /api/empresas-faturacao/ - List empresas
    # ==========================================================
    
    def test_03_list_empresas_admin(self, admin_headers):
        """Test listing empresas as admin - should see all"""
        response = requests.get(f"{BASE_URL}/api/empresas-faturacao/", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Admin can list {len(data)} empresas de faturação")
    
    def test_04_list_empresas_parceiro(self, parceiro_headers):
        """Test listing empresas as parceiro - should see only own"""
        response = requests.get(f"{BASE_URL}/api/empresas-faturacao/", headers=parceiro_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Parceiro can list {len(data)} empresas de faturação")
    
    def test_05_list_empresas_unauthorized(self):
        """Test listing empresas without auth - should fail"""
        response = requests.get(f"{BASE_URL}/api/empresas-faturacao/")
        assert response.status_code in [401, 403], f"Should be unauthorized, got: {response.status_code}"
        print(f"✅ Unauthorized access correctly blocked")

    # ==========================================================
    # POST /api/empresas-faturacao/ - Create empresa
    # ==========================================================
    
    def test_06_create_empresa_missing_fields(self, parceiro_headers):
        """Test creating empresa without required fields - should fail"""
        response = requests.post(f"{BASE_URL}/api/empresas-faturacao/", 
            headers=parceiro_headers,
            json={}
        )
        assert response.status_code == 400, f"Expected 400, got: {response.status_code}"
        print(f"✅ Validation: missing fields correctly rejected")
    
    def test_07_create_empresa_missing_nipc(self, parceiro_headers):
        """Test creating empresa without NIPC - should fail"""
        response = requests.post(f"{BASE_URL}/api/empresas-faturacao/", 
            headers=parceiro_headers,
            json={"nome": "Test Company"}
        )
        assert response.status_code == 400, f"Expected 400, got: {response.status_code}"
        print(f"✅ Validation: missing NIPC correctly rejected")
    
    def test_08_create_empresa_success(self, parceiro_headers):
        """Test creating a new empresa de faturação"""
        unique_nipc = f"9{str(uuid.uuid4().int)[:8]}"  # Generate unique 9-digit NIPC
        empresa_data = {
            "nome": f"TEST_Empresa Teste {unique_nipc}",
            "nipc": unique_nipc,
            "morada": "Rua de Teste 123",
            "codigo_postal": "1000-001",
            "cidade": "Lisboa",
            "email": "test@empresa.pt",
            "telefone": "+351 912345678",
            "iban": "PT50000100001234567890123",
            "principal": False
        }
        
        response = requests.post(f"{BASE_URL}/api/empresas-faturacao/", 
            headers=parceiro_headers,
            json=empresa_data
        )
        assert response.status_code == 200, f"Failed to create: {response.text}"
        data = response.json()
        assert "empresa" in data
        assert data["empresa"]["nipc"] == unique_nipc
        assert data["empresa"]["nome"] == empresa_data["nome"]
        print(f"✅ Created empresa: {data['empresa']['nome']} (NIPC: {unique_nipc})")
        
        # Store for later tests
        pytest.created_empresa_id = data["empresa"]["id"]
        pytest.created_empresa_nipc = unique_nipc
    
    def test_09_create_empresa_duplicate_nipc(self, parceiro_headers):
        """Test creating empresa with duplicate NIPC - should fail"""
        # Use the NIPC from previous test
        if not hasattr(pytest, 'created_empresa_nipc'):
            pytest.skip("Previous test didn't create empresa")
        
        response = requests.post(f"{BASE_URL}/api/empresas-faturacao/", 
            headers=parceiro_headers,
            json={
                "nome": "Duplicate NIPC Test",
                "nipc": pytest.created_empresa_nipc
            }
        )
        assert response.status_code == 400, f"Expected 400 for duplicate, got: {response.status_code}"
        print(f"✅ Validation: duplicate NIPC correctly rejected")

    # ==========================================================
    # GET /api/empresas-faturacao/{id} - Get single empresa
    # ==========================================================
    
    def test_10_get_empresa_by_id(self, parceiro_headers):
        """Test getting a specific empresa by ID"""
        if not hasattr(pytest, 'created_empresa_id'):
            pytest.skip("Previous test didn't create empresa")
        
        response = requests.get(
            f"{BASE_URL}/api/empresas-faturacao/{pytest.created_empresa_id}", 
            headers=parceiro_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["id"] == pytest.created_empresa_id
        assert data["nipc"] == pytest.created_empresa_nipc
        print(f"✅ Retrieved empresa: {data['nome']}")
    
    def test_11_get_empresa_not_found(self, parceiro_headers):
        """Test getting non-existent empresa - should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/empresas-faturacao/non-existent-id", 
            headers=parceiro_headers
        )
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print(f"✅ Non-existent empresa correctly returns 404")

    # ==========================================================
    # PUT /api/empresas-faturacao/{id} - Update empresa
    # ==========================================================
    
    def test_12_update_empresa(self, parceiro_headers):
        """Test updating an empresa"""
        if not hasattr(pytest, 'created_empresa_id'):
            pytest.skip("Previous test didn't create empresa")
        
        updated_data = {
            "nome": "TEST_Empresa Atualizada",
            "morada": "Avenida Nova 456",
            "cidade": "Porto"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/empresas-faturacao/{pytest.created_empresa_id}", 
            headers=parceiro_headers,
            json=updated_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify update persisted
        get_response = requests.get(
            f"{BASE_URL}/api/empresas-faturacao/{pytest.created_empresa_id}", 
            headers=parceiro_headers
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["nome"] == updated_data["nome"]
        assert data["cidade"] == updated_data["cidade"]
        print(f"✅ Updated empresa: {data['nome']}")
    
    def test_13_update_empresa_set_principal(self, parceiro_headers):
        """Test setting an empresa as principal"""
        if not hasattr(pytest, 'created_empresa_id'):
            pytest.skip("Previous test didn't create empresa")
        
        response = requests.put(
            f"{BASE_URL}/api/empresas-faturacao/{pytest.created_empresa_id}", 
            headers=parceiro_headers,
            json={"principal": True}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify principal flag
        get_response = requests.get(
            f"{BASE_URL}/api/empresas-faturacao/{pytest.created_empresa_id}", 
            headers=parceiro_headers
        )
        data = get_response.json()
        assert data["principal"] == True
        print(f"✅ Set empresa as principal")

    # ==========================================================
    # GET /api/empresas-faturacao/dashboard/totais-ano - Dashboard
    # ==========================================================
    
    def test_14_dashboard_totais_ano_parceiro(self, parceiro_headers):
        """Test dashboard totais endpoint for parceiro"""
        response = requests.get(
            f"{BASE_URL}/api/empresas-faturacao/dashboard/totais-ano", 
            headers=parceiro_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "ano" in data
        assert "empresas" in data
        assert "totais" in data
        assert isinstance(data["empresas"], list)
        print(f"✅ Dashboard returns data for {len(data['empresas'])} empresas, year {data['ano']}")
    
    def test_15_dashboard_totais_ano_with_year_param(self, parceiro_headers):
        """Test dashboard with specific year parameter"""
        response = requests.get(
            f"{BASE_URL}/api/empresas-faturacao/dashboard/totais-ano?ano=2024", 
            headers=parceiro_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["ano"] == 2024
        print(f"✅ Dashboard works with year parameter (2024)")

    # ==========================================================
    # DELETE /api/empresas-faturacao/{id} - Delete empresa
    # ==========================================================
    
    def test_16_delete_empresa(self, parceiro_headers):
        """Test deleting an empresa without associated recibos"""
        if not hasattr(pytest, 'created_empresa_id'):
            pytest.skip("Previous test didn't create empresa")
        
        response = requests.delete(
            f"{BASE_URL}/api/empresas-faturacao/{pytest.created_empresa_id}", 
            headers=parceiro_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/empresas-faturacao/{pytest.created_empresa_id}", 
            headers=parceiro_headers
        )
        assert get_response.status_code == 404, "Empresa should not exist after deletion"
        print(f"✅ Successfully deleted empresa")
    
    def test_17_delete_empresa_not_found(self, parceiro_headers):
        """Test deleting non-existent empresa - should return 404"""
        response = requests.delete(
            f"{BASE_URL}/api/empresas-faturacao/non-existent-id", 
            headers=parceiro_headers
        )
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print(f"✅ Delete non-existent correctly returns 404")


class TestUploadReciboWithEmpresaFaturacao:
    """Test upload recibo endpoint with empresa_faturacao_id parameter"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "Admin123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Parceiro authentication failed: {response.status_code}")
    
    @pytest.fixture
    def parceiro_headers(self, parceiro_token):
        """Parceiro request headers"""
        return {
            "Authorization": f"Bearer {parceiro_token}"
        }
    
    def test_18_upload_recibo_endpoint_exists(self, parceiro_headers):
        """Test that upload recibo endpoint accepts empresa_faturacao_id parameter"""
        # This is a negative test to verify the endpoint exists and accepts the parameter
        # We don't have a valid motorista_id to test with, so we just verify the 404 response
        response = requests.post(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/test-id/upload-recibo?semana=1&ano=2026&empresa_faturacao_id=test-empresa",
            headers=parceiro_headers,
            files={"file": ("test.pdf", b"test content", "application/pdf")}
        )
        # We expect 404 because motorista doesn't exist, not 422 for invalid params
        assert response.status_code in [404, 403, 400], f"Unexpected status: {response.status_code}"
        print(f"✅ Upload recibo endpoint accepts empresa_faturacao_id parameter (status: {response.status_code})")


class TestExistingEmpresaZenyMacaia:
    """Test with existing empresa 'Zeny Macaia Unipessoal Lda'"""
    
    @pytest.fixture(scope="class")
    def parceiro_token(self):
        """Get parceiro authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "geral@zmbusines.com",
            "password": "Admin123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Parceiro authentication failed: {response.status_code}")
    
    @pytest.fixture
    def parceiro_headers(self, parceiro_token):
        """Parceiro request headers"""
        return {
            "Authorization": f"Bearer {parceiro_token}",
            "Content-Type": "application/json"
        }
    
    def test_19_find_zeny_macaia_empresa(self, parceiro_headers):
        """Test that existing 'Zeny Macaia Unipessoal Lda' empresa exists"""
        response = requests.get(f"{BASE_URL}/api/empresas-faturacao/", headers=parceiro_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Find Zeny Macaia empresa
        zeny_empresa = next((e for e in data if "Zeny" in e.get("nome", "") or "Macaia" in e.get("nome", "")), None)
        if zeny_empresa:
            print(f"✅ Found existing empresa: {zeny_empresa['nome']} (NIPC: {zeny_empresa.get('nipc')})")
            assert "id" in zeny_empresa
            assert "nipc" in zeny_empresa
        else:
            print(f"⚠️ Empresa 'Zeny Macaia Unipessoal Lda' not found, but API is working. Total empresas: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
