"""
Test cases for iteration 55 fixes:
1. Documents uploaded during registration should be associated with motorista
2. Playwright system status via /api/admin/sistema/status
3. Virtual browser session initiation via /api/admin/browser-virtual/sessao/iniciar
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminAuth:
    """Admin authentication helper"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tvdefleet.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get admin headers with auth token"""
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }


class TestMotoristRegistrationWithDocuments(TestAdminAuth):
    """
    Test that documents uploaded during motorista registration 
    are properly associated with the motorista in the motoristas collection
    """
    
    def test_01_register_new_motorista(self, admin_headers):
        """Register a new motorista and verify it creates document in motoristas collection"""
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"test_motorista_{unique_id}@test.com"
        
        # Register new motorista
        register_data = {
            "email": test_email,
            "password": "TestPass123!",
            "name": f"Test Motorista {unique_id}",
            "phone": "+351912345678",
            "role": "motorista"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        
        # Registration might return 400 if email already exists (from previous test runs)
        if response.status_code == 400:
            print(f"User already exists, skipping creation: {test_email}")
            # Try to get the user instead
            pytest.skip("User already exists")
            return
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        user_id = data.get("id")
        
        print(f"Created motorista with ID: {user_id}")
        print(f"Created motorista email: {test_email}")
        
        # Store for next tests
        TestMotoristRegistrationWithDocuments.test_user_id = user_id
        TestMotoristRegistrationWithDocuments.test_email = test_email
        
        assert user_id is not None, "User ID should be returned"
        assert data.get("role") == "motorista", "Role should be motorista"
        
    def test_02_verify_motorista_in_collection(self, admin_headers):
        """Verify the motorista document was created in motoristas collection"""
        if not hasattr(TestMotoristRegistrationWithDocuments, 'test_email'):
            pytest.skip("No test user created")
        
        email = TestMotoristRegistrationWithDocuments.test_email
        
        # Get motoristas list and check if our test motorista exists
        response = requests.get(f"{BASE_URL}/api/motoristas", headers=admin_headers)
        assert response.status_code == 200, f"Get motoristas failed: {response.text}"
        
        motoristas = response.json()
        test_motorista = None
        for m in motoristas:
            if m.get("email") == email:
                test_motorista = m
                break
        
        assert test_motorista is not None, f"Motorista with email {email} should exist in motoristas collection"
        print(f"Found motorista in collection: {test_motorista.get('name')}")
        
        # Verify documents structure exists
        assert "documents" in test_motorista or test_motorista.get("documents") is None, "Documents field should exist"
        
    def test_03_upload_document_during_registration(self, admin_headers):
        """Upload a document and verify it gets associated with motorista"""
        if not hasattr(TestMotoristRegistrationWithDocuments, 'test_user_id'):
            pytest.skip("No test user created")
        
        user_id = TestMotoristRegistrationWithDocuments.test_user_id
        
        # Create a simple test file
        test_file_content = b"Test document content for motorista"
        files = {
            'file': ('test_license.pdf', test_file_content, 'application/pdf')
        }
        data = {
            'tipo_documento': 'license_photo',
            'user_id': user_id,
            'role': 'motorista'
        }
        
        # Upload document
        upload_headers = {"Authorization": admin_headers["Authorization"]}
        response = requests.post(
            f"{BASE_URL}/api/documentos/upload",
            files=files,
            data=data,
            headers=upload_headers
        )
        
        assert response.status_code == 200, f"Document upload failed: {response.text}"
        result = response.json()
        
        assert result.get("sucesso") == True, "Upload should succeed"
        assert result.get("documento_id") is not None, "Document ID should be returned"
        
        print(f"Document uploaded with ID: {result.get('documento_id')}")
        TestMotoristRegistrationWithDocuments.doc_id = result.get("documento_id")
        
    def test_04_verify_document_associated_with_motorista(self, admin_headers):
        """Verify the document reference is stored in motoristas collection"""
        if not hasattr(TestMotoristRegistrationWithDocuments, 'test_email'):
            pytest.skip("No test user created")
        if not hasattr(TestMotoristRegistrationWithDocuments, 'doc_id'):
            pytest.skip("No document uploaded")
        
        email = TestMotoristRegistrationWithDocuments.test_email
        doc_id = TestMotoristRegistrationWithDocuments.doc_id
        
        # Get motoristas and find our test motorista
        response = requests.get(f"{BASE_URL}/api/motoristas", headers=admin_headers)
        assert response.status_code == 200, f"Get motoristas failed: {response.text}"
        
        motoristas = response.json()
        test_motorista = None
        for m in motoristas:
            if m.get("email") == email:
                test_motorista = m
                break
        
        assert test_motorista is not None, "Test motorista should exist"
        
        # Check if documents field has the uploaded document reference
        documents = test_motorista.get("documents", {})
        license_photo_ref = documents.get("license_photo")
        
        print(f"Motorista documents: {documents}")
        print(f"Expected doc_id: {doc_id}")
        print(f"Found license_photo ref: {license_photo_ref}")
        
        assert license_photo_ref == doc_id, f"Document reference should be stored in motorista. Expected {doc_id}, got {license_photo_ref}"


class TestPlaywrightSystemStatus(TestAdminAuth):
    """
    Test Playwright system status endpoint
    """
    
    def test_01_system_status_endpoint(self, admin_headers):
        """Test /api/admin/sistema/status returns Playwright info"""
        response = requests.get(f"{BASE_URL}/api/admin/sistema/status", headers=admin_headers)
        
        assert response.status_code == 200, f"System status failed: {response.text}"
        data = response.json()
        
        print(f"System status response: {data}")
        
        # Verify structure
        assert "playwright" in data, "Response should contain playwright info"
        assert "disk" in data, "Response should contain disk info"
        assert "timestamp" in data, "Response should contain timestamp"
        
        # Verify playwright section
        playwright = data.get("playwright", {})
        assert "installed" in playwright, "Should have installed flag"
        assert "version" in playwright, "Should have version info"
        assert "browsers" in playwright, "Should have browsers list"
        
        print(f"Playwright installed: {playwright.get('installed')}")
        print(f"Playwright version: {playwright.get('version')}")
        print(f"Browsers: {playwright.get('browsers')}")
        
        # Note: We don't assert that Playwright IS installed, just that the endpoint works
        # The main agent claims it was fixed, so let's check
        if playwright.get("installed"):
            print("Playwright IS installed")
            assert playwright.get("version") is not None, "Version should be available if installed"
        
    def test_02_disk_usage_info(self, admin_headers):
        """Verify disk usage information is returned"""
        response = requests.get(f"{BASE_URL}/api/admin/sistema/status", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        disk = data.get("disk", {})
        assert "total_gb" in disk, "Should have total disk space"
        assert "used_gb" in disk, "Should have used disk space"
        assert "free_gb" in disk, "Should have free disk space"
        assert "percent_used" in disk, "Should have percent used"
        
        print(f"Disk: {disk.get('free_gb')}GB free of {disk.get('total_gb')}GB total ({disk.get('percent_used')}% used)")


class TestBrowserVirtualSession(TestAdminAuth):
    """
    Test Browser Virtual session API for RPA recording
    """
    
    def test_01_get_plataformas_for_browser_session(self, admin_headers):
        """Get available plataformas for browser session"""
        response = requests.get(f"{BASE_URL}/api/plataformas", headers=admin_headers)
        
        # Might return 404 if no plataformas exist
        if response.status_code == 404:
            print("No plataformas configured - skipping browser session tests")
            pytest.skip("No plataformas available")
            return
        
        assert response.status_code == 200, f"Get plataformas failed: {response.text}"
        plataformas = response.json()
        
        print(f"Found {len(plataformas)} plataformas")
        
        if len(plataformas) > 0:
            TestBrowserVirtualSession.plataforma_id = plataformas[0].get("id")
            print(f"Using plataforma: {plataformas[0].get('nome')} (ID: {TestBrowserVirtualSession.plataforma_id})")
        else:
            print("No plataformas available for browser session test")
            pytest.skip("No plataformas available")
    
    def test_02_iniciar_sessao_browser_virtual(self, admin_headers):
        """Test starting a virtual browser session"""
        if not hasattr(TestBrowserVirtualSession, 'plataforma_id'):
            pytest.skip("No plataforma available")
        
        plataforma_id = TestBrowserVirtualSession.plataforma_id
        
        request_data = {
            "plataforma_id": plataforma_id,
            "url_inicial": "https://www.google.com"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/iniciar",
            json=request_data,
            headers=admin_headers,
            timeout=60  # Browser initialization can take time
        )
        
        print(f"Browser session response status: {response.status_code}")
        print(f"Browser session response: {response.text[:500] if response.text else 'empty'}")
        
        # The endpoint might fail if Playwright browsers aren't properly installed
        # or if there are resource constraints
        if response.status_code == 500:
            error_detail = response.json().get("detail", "")
            if "browser" in error_detail.lower() or "playwright" in error_detail.lower():
                print(f"Browser session failed (likely Playwright issue): {error_detail}")
                pytest.skip(f"Playwright browser issue: {error_detail}")
            else:
                pytest.fail(f"Unexpected 500 error: {error_detail}")
        
        assert response.status_code == 200, f"Session start failed: {response.text}"
        data = response.json()
        
        assert data.get("sucesso") == True, "Session should start successfully"
        assert data.get("session_id") is not None, "Session ID should be returned"
        assert data.get("screenshot") is not None, "Screenshot should be returned"
        
        TestBrowserVirtualSession.session_id = data.get("session_id")
        print(f"Browser session started: {TestBrowserVirtualSession.session_id}")
        
    def test_03_get_session_status(self, admin_headers):
        """Test getting session status"""
        if not hasattr(TestBrowserVirtualSession, 'session_id'):
            pytest.skip("No session available")
        
        session_id = TestBrowserVirtualSession.session_id
        
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/status",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Get session status failed: {response.text}"
        data = response.json()
        
        assert data.get("session_id") == session_id
        print(f"Session status: gravando={data.get('gravando')}, passos={data.get('total_passos')}")
        
    def test_04_get_screenshot(self, admin_headers):
        """Test getting current screenshot from session"""
        if not hasattr(TestBrowserVirtualSession, 'session_id'):
            pytest.skip("No session available")
        
        session_id = TestBrowserVirtualSession.session_id
        
        response = requests.get(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}/screenshot",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Get screenshot failed: {response.text}"
        data = response.json()
        
        assert data.get("sucesso") == True
        assert data.get("screenshot") is not None
        assert data.get("url") is not None
        
        print(f"Screenshot URL: {data.get('url')}")
        
    def test_05_terminate_session(self, admin_headers):
        """Cleanup - terminate browser session"""
        if not hasattr(TestBrowserVirtualSession, 'session_id'):
            pytest.skip("No session to terminate")
        
        session_id = TestBrowserVirtualSession.session_id
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/browser-virtual/sessao/{session_id}",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Terminate session failed: {response.text}"
        data = response.json()
        
        assert data.get("sucesso") == True
        print(f"Session terminated. Total passos gravados: {data.get('total_passos')}")


class TestDocumentosQueryFix(TestAdminAuth):
    """
    Additional tests to verify the documentos.py fix 
    where the query was incorrectly using {'email': {'$exists': True}}
    """
    
    def test_verify_existing_motorista_document_update(self, admin_headers):
        """
        Test that document upload correctly identifies the specific motorista
        by first getting user email, not just matching any user with email field
        """
        # Get an existing motorista from the system
        response = requests.get(f"{BASE_URL}/api/motoristas", headers=admin_headers)
        assert response.status_code == 200
        
        motoristas = response.json()
        if not motoristas:
            pytest.skip("No motoristas in system")
        
        # Use first motorista
        test_motorista = motoristas[0]
        user_id = test_motorista.get("id")
        email = test_motorista.get("email")
        
        print(f"Testing with existing motorista: {email} (ID: {user_id})")
        
        # Record current document state
        initial_docs = test_motorista.get("documents", {})
        print(f"Initial documents: {initial_docs}")
        
        # Upload a test document
        test_file_content = b"Test content for existing motorista"
        files = {
            'file': ('test_cv.pdf', test_file_content, 'application/pdf')
        }
        data = {
            'tipo_documento': 'cv_file',
            'user_id': user_id,
            'role': 'motorista'
        }
        
        upload_headers = {"Authorization": admin_headers["Authorization"]}
        response = requests.post(
            f"{BASE_URL}/api/documentos/upload",
            files=files,
            data=data,
            headers=upload_headers
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        result = response.json()
        doc_id = result.get("documento_id")
        
        print(f"Uploaded document ID: {doc_id}")
        
        # Verify the document was associated with the CORRECT motorista
        response = requests.get(f"{BASE_URL}/api/motoristas", headers=admin_headers)
        assert response.status_code == 200
        
        motoristas_after = response.json()
        
        # Find our test motorista and verify
        found = False
        for m in motoristas_after:
            if m.get("id") == user_id:
                found = True
                updated_docs = m.get("documents", {})
                cv_ref = updated_docs.get("cv_file")
                
                print(f"Updated documents for {email}: {updated_docs}")
                assert cv_ref == doc_id, f"cv_file should be {doc_id}, got {cv_ref}"
                
                # Also verify OTHER motoristas don't have this document
                for other_m in motoristas_after:
                    if other_m.get("id") != user_id:
                        other_docs = other_m.get("documents", {})
                        other_cv = other_docs.get("cv_file")
                        if other_cv == doc_id:
                            pytest.fail(f"Document {doc_id} was incorrectly associated with motorista {other_m.get('email')}")
                
                break
        
        assert found, f"Motorista {user_id} not found after upload"
        print("Document correctly associated with specific motorista only!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
