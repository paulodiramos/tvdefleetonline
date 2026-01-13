"""
Terabox API Tests - File Storage System for Partners
Tests: Stats, Folders (CRUD), Files (Upload/Download/Delete), Search
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARCEIRO_EMAIL = "parceiro@tvdefleet.com"
PARCEIRO_PASSWORD = "123456"
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"


class TestTeraboxAuth:
    """Authentication tests for Terabox access"""
    
    def test_parceiro_login(self):
        """Test parceiro can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("role") == "parceiro", "User is not parceiro"
        print(f"✓ Parceiro login successful, role: {data['user']['role']}")
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        print(f"✓ Admin login successful, role: {data['user']['role']}")


@pytest.fixture
def parceiro_token():
    """Get parceiro authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": PARCEIRO_EMAIL,
        "password": PARCEIRO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Parceiro authentication failed")


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


class TestTeraboxStats:
    """Test Terabox statistics endpoint"""
    
    def test_get_stats_parceiro(self, parceiro_token):
        """Test parceiro can get their storage stats"""
        response = requests.get(
            f"{BASE_URL}/api/terabox/stats",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "total_ficheiros" in data, "Missing total_ficheiros"
        assert "total_pastas" in data, "Missing total_pastas"
        assert "espaco_usado" in data, "Missing espaco_usado"
        assert "espaco_usado_formatado" in data, "Missing espaco_usado_formatado"
        
        print(f"✓ Stats: {data['total_pastas']} pastas, {data['total_ficheiros']} ficheiros, {data['espaco_usado_formatado']}")
    
    def test_get_stats_admin(self, admin_token):
        """Test admin can get storage stats"""
        response = requests.get(
            f"{BASE_URL}/api/terabox/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        assert "total_ficheiros" in data
        print(f"✓ Admin stats: {data['total_pastas']} pastas, {data['total_ficheiros']} ficheiros")
    
    def test_get_stats_no_auth(self):
        """Test stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/terabox/stats")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Stats correctly requires authentication")


class TestTeraboxPastas:
    """Test Terabox folder (pasta) management"""
    
    def test_list_pastas_root(self, parceiro_token):
        """Test listing root folders"""
        response = requests.get(
            f"{BASE_URL}/api/terabox/pastas",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200, f"List pastas failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Listed {len(data)} root folders")
    
    def test_create_pasta(self, parceiro_token):
        """Test creating a new folder"""
        pasta_name = "TEST_Pasta_Pytest"
        response = requests.post(
            f"{BASE_URL}/api/terabox/pastas",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            json={"nome": pasta_name, "pasta_pai_id": None}
        )
        assert response.status_code == 200, f"Create pasta failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        assert "message" in data, "No message in response"
        print(f"✓ Created folder: {pasta_name}, id: {data['id']}")
        return data["id"]
    
    def test_create_and_delete_pasta(self, parceiro_token):
        """Test creating and deleting a folder"""
        # Create folder
        pasta_name = "TEST_Delete_Pasta"
        create_response = requests.post(
            f"{BASE_URL}/api/terabox/pastas",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            json={"nome": pasta_name, "pasta_pai_id": None}
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        pasta_id = create_response.json()["id"]
        print(f"✓ Created folder for deletion: {pasta_id}")
        
        # Delete folder
        delete_response = requests.delete(
            f"{BASE_URL}/api/terabox/pastas/{pasta_id}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"✓ Deleted folder: {pasta_id}")
    
    def test_create_nested_pasta(self, parceiro_token):
        """Test creating a nested folder"""
        # First create parent folder
        parent_response = requests.post(
            f"{BASE_URL}/api/terabox/pastas",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            json={"nome": "TEST_Parent_Folder", "pasta_pai_id": None}
        )
        assert parent_response.status_code == 200
        parent_id = parent_response.json()["id"]
        
        # Create child folder
        child_response = requests.post(
            f"{BASE_URL}/api/terabox/pastas",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            json={"nome": "TEST_Child_Folder", "pasta_pai_id": parent_id}
        )
        assert child_response.status_code == 200, f"Create child failed: {child_response.text}"
        child_id = child_response.json()["id"]
        print(f"✓ Created nested folder: parent={parent_id}, child={child_id}")
        
        # Verify child appears in parent listing
        list_response = requests.get(
            f"{BASE_URL}/api/terabox/pastas",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            params={"pasta_pai_id": parent_id}
        )
        assert list_response.status_code == 200
        children = list_response.json()
        assert any(p["id"] == child_id for p in children), "Child folder not found in parent"
        print(f"✓ Verified child folder appears in parent listing")
        
        # Cleanup - delete parent (should delete child too)
        requests.delete(
            f"{BASE_URL}/api/terabox/pastas/{parent_id}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )


class TestTeraboxFicheiros:
    """Test Terabox file management"""
    
    def test_list_ficheiros_root(self, parceiro_token):
        """Test listing files in root"""
        response = requests.get(
            f"{BASE_URL}/api/terabox/ficheiros",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            params={"pasta_id": "root"}
        )
        assert response.status_code == 200, f"List ficheiros failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Listed {len(data)} files in root")
    
    def test_upload_file(self, parceiro_token):
        """Test uploading a file"""
        # Create a test file in memory
        file_content = b"Test file content for Terabox upload test"
        files = {
            'file': ('TEST_upload_file.txt', io.BytesIO(file_content), 'text/plain')
        }
        data = {'pasta_id': 'root'}
        
        response = requests.post(
            f"{BASE_URL}/api/terabox/upload",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            files=files,
            data=data
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        result = response.json()
        assert "id" in result, "No file id in response"
        assert "nome" in result, "No nome in response"
        print(f"✓ Uploaded file: {result['nome']}, id: {result['id']}, size: {result.get('tamanho_formatado', 'N/A')}")
        return result["id"]
    
    def test_upload_and_download_file(self, parceiro_token):
        """Test uploading and downloading a file"""
        # Upload
        original_content = b"Test content for download verification - Terabox pytest"
        files = {
            'file': ('TEST_download_test.txt', io.BytesIO(original_content), 'text/plain')
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/terabox/upload",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            files=files,
            data={'pasta_id': 'root'}
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        file_id = upload_response.json()["id"]
        print(f"✓ Uploaded file for download test: {file_id}")
        
        # Download
        download_response = requests.get(
            f"{BASE_URL}/api/terabox/download/{file_id}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert download_response.status_code == 200, f"Download failed: {download_response.text}"
        assert download_response.content == original_content, "Downloaded content doesn't match"
        print(f"✓ Downloaded file content matches original")
        
        # Cleanup - delete file
        requests.delete(
            f"{BASE_URL}/api/terabox/ficheiros/{file_id}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        print(f"✓ Cleaned up test file")
    
    def test_upload_and_delete_file(self, parceiro_token):
        """Test uploading and deleting a file"""
        # Upload
        files = {
            'file': ('TEST_delete_file.txt', io.BytesIO(b"Delete me"), 'text/plain')
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/terabox/upload",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            files=files,
            data={'pasta_id': 'root'}
        )
        assert upload_response.status_code == 200
        file_id = upload_response.json()["id"]
        print(f"✓ Uploaded file for deletion: {file_id}")
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/terabox/ficheiros/{file_id}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"✓ Deleted file: {file_id}")
        
        # Verify file is gone
        get_response = requests.get(
            f"{BASE_URL}/api/terabox/ficheiros/{file_id}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert get_response.status_code == 404, "File should not exist after deletion"
        print(f"✓ Verified file no longer exists")


class TestTeraboxSearch:
    """Test Terabox search functionality"""
    
    def test_search_files(self, parceiro_token):
        """Test searching for files"""
        # First upload a file with a unique name
        unique_name = "TEST_SearchableFile_Pytest.txt"
        files = {
            'file': (unique_name, io.BytesIO(b"Searchable content"), 'text/plain')
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/terabox/upload",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            files=files,
            data={'pasta_id': 'root'}
        )
        assert upload_response.status_code == 200
        file_id = upload_response.json()["id"]
        print(f"✓ Uploaded searchable file: {file_id}")
        
        # Search for the file
        search_response = requests.get(
            f"{BASE_URL}/api/terabox/pesquisar",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            params={"q": "SearchableFile"}
        )
        assert search_response.status_code == 200, f"Search failed: {search_response.text}"
        results = search_response.json()
        assert isinstance(results, list), "Search results should be a list"
        assert any(f["id"] == file_id for f in results), "Uploaded file not found in search results"
        print(f"✓ Search found {len(results)} results, including our test file")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/terabox/ficheiros/{file_id}",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
    
    def test_search_empty_query(self, parceiro_token):
        """Test search with empty query returns empty or all"""
        response = requests.get(
            f"{BASE_URL}/api/terabox/pesquisar",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            params={"q": ""}
        )
        # Empty search might return empty list or all files
        assert response.status_code == 200, f"Empty search failed: {response.text}"
        print(f"✓ Empty search handled correctly")
    
    def test_search_no_results(self, parceiro_token):
        """Test search with non-existent term"""
        response = requests.get(
            f"{BASE_URL}/api/terabox/pesquisar",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            params={"q": "NonExistentFileXYZ123456"}
        )
        assert response.status_code == 200
        results = response.json()
        assert len(results) == 0, "Should return empty list for non-existent search"
        print(f"✓ Non-existent search returns empty list")


class TestTeraboxCategorias:
    """Test Terabox categories endpoint"""
    
    def test_list_categorias(self, parceiro_token):
        """Test listing available categories"""
        response = requests.get(
            f"{BASE_URL}/api/terabox/categorias",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        assert response.status_code == 200, f"List categorias failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one category"
        
        # Verify category structure
        for cat in data:
            assert "id" in cat, "Category missing id"
            assert "nome" in cat, "Category missing nome"
        
        print(f"✓ Listed {len(data)} categories: {[c['nome'] for c in data[:3]]}...")


class TestTeraboxCleanup:
    """Cleanup test data created during tests"""
    
    def test_cleanup_test_pastas(self, parceiro_token):
        """Clean up TEST_ prefixed folders"""
        # List all root folders
        response = requests.get(
            f"{BASE_URL}/api/terabox/pastas",
            headers={"Authorization": f"Bearer {parceiro_token}"}
        )
        if response.status_code == 200:
            pastas = response.json()
            test_pastas = [p for p in pastas if p.get("nome", "").startswith("TEST_")]
            
            for pasta in test_pastas:
                requests.delete(
                    f"{BASE_URL}/api/terabox/pastas/{pasta['id']}",
                    headers={"Authorization": f"Bearer {parceiro_token}"}
                )
                print(f"  Cleaned up folder: {pasta['nome']}")
            
            print(f"✓ Cleaned up {len(test_pastas)} test folders")
    
    def test_cleanup_test_ficheiros(self, parceiro_token):
        """Clean up TEST_ prefixed files"""
        # Search for test files
        response = requests.get(
            f"{BASE_URL}/api/terabox/pesquisar",
            headers={"Authorization": f"Bearer {parceiro_token}"},
            params={"q": "TEST_"}
        )
        if response.status_code == 200:
            ficheiros = response.json()
            
            for ficheiro in ficheiros:
                requests.delete(
                    f"{BASE_URL}/api/terabox/ficheiros/{ficheiro['id']}",
                    headers={"Authorization": f"Bearer {parceiro_token}"}
                )
                print(f"  Cleaned up file: {ficheiro['nome']}")
            
            print(f"✓ Cleaned up {len(ficheiros)} test files")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
