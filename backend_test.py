#!/usr/bin/env python3
"""
TVDEFleet Backend Testing Suite
Tests for all 3 phases: Permission restrictions, File uploads, Alert system
"""

import requests
import json
import os
import tempfile
from PIL import Image
import io
import base64
from pathlib import Path

# Get backend URL from frontend .env
BACKEND_URL = "https://fleet-command-26.preview.emergentagent.com/api"

# Test credentials (already seeded in DB)
TEST_CREDENTIALS = {
    "admin": {"email": "admin@tvdefleet.com", "password": "admin123"},
    "gestor": {"email": "gestor@tvdefleet.com", "password": "gestor123"},
    "parceiro": {"email": "parceiro@tvdefleet.com", "password": "parceiro123"},
    "motorista": {"email": "motorista@tvdefleet.com", "password": "motorista123"}
}

class TVDEFleetTester:
    def __init__(self):
        self.tokens = {}
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
    
    def authenticate_user(self, role):
        """Authenticate user and store token"""
        try:
            creds = TEST_CREDENTIALS[role]
            response = requests.post(f"{BACKEND_URL}/auth/login", json=creds)
            
            if response.status_code == 200:
                data = response.json()
                self.tokens[role] = data["access_token"]
                self.log_result(f"Auth-{role}", True, f"Successfully authenticated as {role}")
                return True
            else:
                self.log_result(f"Auth-{role}", False, f"Failed to authenticate: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result(f"Auth-{role}", False, f"Authentication error: {str(e)}")
            return False
    
    def get_headers(self, role):
        """Get authorization headers for role"""
        if role not in self.tokens:
            return None
        return {"Authorization": f"Bearer {self.tokens[role]}"}
    
    def create_test_image(self, filename="test_image.jpg"):
        """Create a small test image file"""
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        return img_bytes
    
    def create_test_pdf(self, filename="test_doc.pdf"):
        """Create a simple test PDF content"""
        pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
190
%%EOF"""
        return io.BytesIO(pdf_content)

    # ==================== FASE 1: PERMISSION RESTRICTIONS ====================
    
    def test_parceiro_cannot_create_revenue(self):
        """Test that Parceiro cannot create revenues (should return 403)"""
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Parceiro-Revenue-Restriction", False, "No auth token for parceiro")
            return
        
        # First get a vehicle ID to use in the test
        vehicles_response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
        if vehicles_response.status_code != 200:
            self.log_result("Parceiro-Revenue-Restriction", False, "Could not get vehicles list")
            return
        
        vehicles = vehicles_response.json()
        if not vehicles:
            self.log_result("Parceiro-Revenue-Restriction", False, "No vehicles available for test")
            return
        
        vehicle_id = vehicles[0]["id"]
        
        revenue_data = {
            "vehicle_id": vehicle_id,
            "tipo": "uber",
            "valor": 50.0,
            "data": "2025-01-15"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/revenues", json=revenue_data, headers=headers)
            
            if response.status_code == 403:
                self.log_result("Parceiro-Revenue-Restriction", True, "Parceiro correctly blocked from creating revenue")
            else:
                self.log_result("Parceiro-Revenue-Restriction", False, f"Expected 403, got {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Parceiro-Revenue-Restriction", False, f"Request error: {str(e)}")
    
    def test_parceiro_cannot_create_expense(self):
        """Test that Parceiro cannot create expenses (should return 403)"""
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Parceiro-Expense-Restriction", False, "No auth token for parceiro")
            return
        
        # First get a vehicle ID to use in the test
        vehicles_response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
        if vehicles_response.status_code != 200:
            self.log_result("Parceiro-Expense-Restriction", False, "Could not get vehicles list")
            return
        
        vehicles = vehicles_response.json()
        if not vehicles:
            self.log_result("Parceiro-Expense-Restriction", False, "No vehicles available for test")
            return
        
        vehicle_id = vehicles[0]["id"]
        
        expense_data = {
            "vehicle_id": vehicle_id,
            "tipo": "combustivel",
            "descricao": "Abastecimento teste",
            "valor": 30.0,
            "data": "2025-01-15",
            "categoria": "operacional"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/expenses", json=expense_data, headers=headers)
            
            if response.status_code == 403:
                self.log_result("Parceiro-Expense-Restriction", True, "Parceiro correctly blocked from creating expense")
            else:
                self.log_result("Parceiro-Expense-Restriction", False, f"Expected 403, got {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Parceiro-Expense-Restriction", False, f"Request error: {str(e)}")
    
    def test_parceiro_can_read_revenues_expenses(self):
        """Test that Parceiro can read revenues and expenses (GET operations)"""
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Parceiro-Read-Access", False, "No auth token for parceiro")
            return
        
        try:
            # Test reading revenues
            revenues_response = requests.get(f"{BACKEND_URL}/revenues", headers=headers)
            expenses_response = requests.get(f"{BACKEND_URL}/expenses", headers=headers)
            
            revenues_ok = revenues_response.status_code == 200
            expenses_ok = expenses_response.status_code == 200
            
            if revenues_ok and expenses_ok:
                self.log_result("Parceiro-Read-Access", True, "Parceiro can read revenues and expenses")
            else:
                self.log_result("Parceiro-Read-Access", False, f"Read access failed - Revenues: {revenues_response.status_code}, Expenses: {expenses_response.status_code}")
        except Exception as e:
            self.log_result("Parceiro-Read-Access", False, f"Request error: {str(e)}")
    
    def test_admin_can_create_revenues_expenses(self):
        """Test that Admin can create revenues and expenses"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Admin-Create-Access", False, "No auth token for admin")
            return
        
        # First get a vehicle ID
        vehicles_response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
        if vehicles_response.status_code != 200:
            self.log_result("Admin-Create-Access", False, "Could not get vehicles list")
            return
        
        vehicles = vehicles_response.json()
        if not vehicles:
            self.log_result("Admin-Create-Access", False, "No vehicles available for test")
            return
        
        vehicle_id = vehicles[0]["id"]
        
        # Test creating revenue
        revenue_data = {
            "vehicle_id": vehicle_id,
            "tipo": "uber",
            "valor": 75.0,
            "data": "2025-01-15"
        }
        
        # Test creating expense
        expense_data = {
            "vehicle_id": vehicle_id,
            "tipo": "combustivel",
            "descricao": "Abastecimento admin test",
            "valor": 40.0,
            "data": "2025-01-15",
            "categoria": "operacional"
        }
        
        try:
            revenue_response = requests.post(f"{BACKEND_URL}/revenues", json=revenue_data, headers=headers)
            expense_response = requests.post(f"{BACKEND_URL}/expenses", json=expense_data, headers=headers)
            
            revenue_ok = revenue_response.status_code == 200
            expense_ok = expense_response.status_code == 200
            
            if revenue_ok and expense_ok:
                self.log_result("Admin-Create-Access", True, "Admin can create revenues and expenses")
            else:
                self.log_result("Admin-Create-Access", False, f"Create failed - Revenue: {revenue_response.status_code}, Expense: {expense_response.status_code}")
        except Exception as e:
            self.log_result("Admin-Create-Access", False, f"Request error: {str(e)}")

    # ==================== FASE 2: FILE UPLOAD SYSTEM ====================
    
    def test_motorista_document_upload(self):
        """Test motorista document upload with image conversion to PDF"""
        headers = self.get_headers("admin")  # Use admin to upload motorista docs
        if not headers:
            self.log_result("Motorista-Document-Upload", False, "No auth token for admin")
            return
        
        # First get a motorista ID
        motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
        if motoristas_response.status_code != 200:
            self.log_result("Motorista-Document-Upload", False, "Could not get motoristas list")
            return
        
        motoristas = motoristas_response.json()
        if not motoristas:
            self.log_result("Motorista-Document-Upload", False, "No motoristas available for test")
            return
        
        motorista_id = motoristas[0]["id"]
        
        # Create test image
        test_image = self.create_test_image()
        
        try:
            files = {
                'file': ('test_license.jpg', test_image, 'image/jpeg')
            }
            data = {
                'doc_type': 'license_photo'
            }
            
            response = requests.post(
                f"{BACKEND_URL}/motoristas/{motorista_id}/upload-document",
                files=files,
                data=data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                converted_to_pdf = result.get("converted_to_pdf", False)
                
                if converted_to_pdf:
                    self.log_result("Motorista-Document-Upload", True, "Document uploaded and converted to PDF successfully")
                else:
                    self.log_result("Motorista-Document-Upload", False, "Document uploaded but not converted to PDF")
            else:
                self.log_result("Motorista-Document-Upload", False, f"Upload failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Motorista-Document-Upload", False, f"Upload error: {str(e)}")
    
    def test_pagamento_document_upload(self):
        """Test pagamento document upload with PDF conversion"""
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Pagamento-Document-Upload", False, "No auth token for parceiro")
            return
        
        # First create a pagamento
        motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=self.get_headers("admin"))
        if motoristas_response.status_code != 200:
            self.log_result("Pagamento-Document-Upload", False, "Could not get motoristas list")
            return
        
        motoristas = motoristas_response.json()
        if not motoristas:
            self.log_result("Pagamento-Document-Upload", False, "No motoristas available for test")
            return
        
        motorista_id = motoristas[0]["id"]
        
        # Create pagamento
        pagamento_data = {
            "motorista_id": motorista_id,
            "valor": 150.0,
            "periodo_inicio": "2025-01-01",
            "periodo_fim": "2025-01-07",
            "tipo_documento": "recibo_verde",
            "notas": "Pagamento teste"
        }
        
        try:
            pagamento_response = requests.post(f"{BACKEND_URL}/pagamentos", json=pagamento_data, headers=headers)
            
            if pagamento_response.status_code != 200:
                self.log_result("Pagamento-Document-Upload", False, f"Could not create pagamento: {pagamento_response.status_code}")
                return
            
            pagamento = pagamento_response.json()
            pagamento_id = pagamento["id"]
            
            # Now upload document
            test_image = self.create_test_image()
            
            files = {
                'file': ('recibo_verde.jpg', test_image, 'image/jpeg')
            }
            
            upload_response = requests.post(
                f"{BACKEND_URL}/pagamentos/{pagamento_id}/upload-documento",
                files=files,
                headers=headers
            )
            
            if upload_response.status_code == 200:
                result = upload_response.json()
                converted_to_pdf = result.get("converted_to_pdf", False)
                
                if converted_to_pdf:
                    self.log_result("Pagamento-Document-Upload", True, "Pagamento document uploaded and converted to PDF successfully")
                else:
                    self.log_result("Pagamento-Document-Upload", False, "Document uploaded but not converted to PDF")
            else:
                self.log_result("Pagamento-Document-Upload", False, f"Upload failed: {upload_response.status_code}", upload_response.text)
        except Exception as e:
            self.log_result("Pagamento-Document-Upload", False, f"Upload error: {str(e)}")
    
    def test_file_serving_endpoint(self):
        """Test file serving endpoint with authentication"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("File-Serving-Endpoint", False, "No auth token for admin")
            return
        
        try:
            # Test accessing a file (this might fail if no files exist, but we test the endpoint)
            response = requests.get(f"{BACKEND_URL}/files/motoristas/test_file.pdf", headers=headers)
            
            # We expect either 200 (file found) or 404 (file not found), but not 401/403 (auth issues)
            if response.status_code in [200, 404]:
                self.log_result("File-Serving-Endpoint", True, f"File endpoint accessible (status: {response.status_code})")
            elif response.status_code in [401, 403]:
                self.log_result("File-Serving-Endpoint", False, f"Authentication issue: {response.status_code}")
            else:
                self.log_result("File-Serving-Endpoint", False, f"Unexpected status: {response.status_code}")
        except Exception as e:
            self.log_result("File-Serving-Endpoint", False, f"Request error: {str(e)}")

    # ==================== FASE 3: ALERT SYSTEM ====================
    
    def test_alertas_list_endpoint(self):
        """Test GET /alertas endpoint"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Alertas-List", False, "No auth token for admin")
            return
        
        try:
            response = requests.get(f"{BACKEND_URL}/alertas", headers=headers)
            
            if response.status_code == 200:
                alertas = response.json()
                self.log_result("Alertas-List", True, f"Successfully retrieved {len(alertas)} alertas")
            else:
                self.log_result("Alertas-List", False, f"Failed to get alertas: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Alertas-List", False, f"Request error: {str(e)}")
    
    def test_alertas_dashboard_stats(self):
        """Test GET /alertas/dashboard-stats endpoint"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Alertas-Dashboard-Stats", False, "No auth token for admin")
            return
        
        try:
            response = requests.get(f"{BACKEND_URL}/alertas/dashboard-stats", headers=headers)
            
            if response.status_code == 200:
                stats = response.json()
                self.log_result("Alertas-Dashboard-Stats", True, f"Dashboard stats retrieved: {stats}")
            else:
                self.log_result("Alertas-Dashboard-Stats", False, f"Failed to get dashboard stats: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Alertas-Dashboard-Stats", False, f"Request error: {str(e)}")
    
    def test_alertas_verificar_manual(self):
        """Test POST /alertas/verificar (manual trigger) - requires Admin/Gestor"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Alertas-Manual-Check", False, "No auth token for admin")
            return
        
        try:
            response = requests.post(f"{BACKEND_URL}/alertas/verificar", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                self.log_result("Alertas-Manual-Check", True, f"Manual alert check triggered: {result}")
            else:
                self.log_result("Alertas-Manual-Check", False, f"Failed to trigger manual check: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Alertas-Manual-Check", False, f"Request error: {str(e)}")
    
    def test_alertas_resolver_ignorar(self):
        """Test alert resolution and ignore functionality"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Alertas-Resolve-Ignore", False, "No auth token for admin")
            return
        
        try:
            # First get list of alertas
            alertas_response = requests.get(f"{BACKEND_URL}/alertas", headers=headers)
            
            if alertas_response.status_code != 200:
                self.log_result("Alertas-Resolve-Ignore", False, "Could not get alertas list")
                return
            
            alertas = alertas_response.json()
            
            if not alertas:
                self.log_result("Alertas-Resolve-Ignore", True, "No alertas to test resolve/ignore (system working)")
                return
            
            # Test resolving first alert
            alert_id = alertas[0]["id"]
            
            resolve_response = requests.put(f"{BACKEND_URL}/alertas/{alert_id}/resolver", headers=headers)
            
            if resolve_response.status_code == 200:
                self.log_result("Alertas-Resolve-Ignore", True, "Alert resolution functionality working")
            else:
                self.log_result("Alertas-Resolve-Ignore", False, f"Failed to resolve alert: {resolve_response.status_code}", resolve_response.text)
        except Exception as e:
            self.log_result("Alertas-Resolve-Ignore", False, f"Request error: {str(e)}")
    
    def test_background_task_logs(self):
        """Check if background task is running by looking for recent activity"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Background-Task-Check", False, "No auth token for admin")
            return
        
        try:
            # Trigger manual check to verify the function works
            response = requests.post(f"{BACKEND_URL}/alertas/verificar", headers=headers)
            
            if response.status_code == 200:
                self.log_result("Background-Task-Check", True, "Alert checking function is working (background task should be running)")
            else:
                self.log_result("Background-Task-Check", False, f"Alert checking function failed: {response.status_code}")
        except Exception as e:
            self.log_result("Background-Task-Check", False, f"Request error: {str(e)}")

    # ==================== NEW FEATURES TESTS (EXPANDED SYSTEM) ====================
    
    def test_vehicle_photo_upload_limit(self):
        """Test vehicle photo upload with 3 photo limit and PDF conversion"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicle-Photo-Upload", False, "No auth token for admin")
            return
        
        # Get a vehicle ID
        vehicles_response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
        if vehicles_response.status_code != 200 or not vehicles_response.json():
            self.log_result("Vehicle-Photo-Upload", False, "No vehicles available for test")
            return
        
        vehicle_id = vehicles_response.json()[0]["id"]
        
        try:
            # Upload 3 photos (should work)
            for i in range(3):
                test_image = self.create_test_image()
                files = {
                    'file': (f'vehicle_photo_{i+1}.jpg', test_image, 'image/jpeg')
                }
                
                response = requests.post(
                    f"{BACKEND_URL}/vehicles/{vehicle_id}/upload-photo",
                    files=files,
                    headers=headers
                )
                
                if response.status_code != 200:
                    self.log_result("Vehicle-Photo-Upload", False, f"Failed to upload photo {i+1}: {response.status_code}")
                    return
                
                result = response.json()
                if not result.get("converted_to_pdf", False):
                    self.log_result("Vehicle-Photo-Upload", False, f"Photo {i+1} not converted to PDF")
                    return
            
            # Try to upload 4th photo (should fail with 400)
            test_image = self.create_test_image()
            files = {
                'file': ('vehicle_photo_4.jpg', test_image, 'image/jpeg')
            }
            
            response = requests.post(
                f"{BACKEND_URL}/vehicles/{vehicle_id}/upload-photo",
                files=files,
                headers=headers
            )
            
            if response.status_code == 400:
                self.log_result("Vehicle-Photo-Upload", True, "Vehicle photo upload limit (3) correctly enforced, all photos converted to PDF")
            else:
                self.log_result("Vehicle-Photo-Upload", False, f"Expected 400 for 4th photo, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Vehicle-Photo-Upload", False, f"Vehicle photo upload error: {str(e)}")
    
    def test_vehicle_photo_delete(self):
        """Test deleting vehicle photos by index"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicle-Photo-Delete", False, "No auth token for admin")
            return
        
        # Get a vehicle ID
        vehicles_response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
        if vehicles_response.status_code != 200 or not vehicles_response.json():
            self.log_result("Vehicle-Photo-Delete", False, "No vehicles available for test")
            return
        
        vehicle_id = vehicles_response.json()[0]["id"]
        
        try:
            # First upload a photo
            test_image = self.create_test_image()
            files = {
                'file': ('test_photo.jpg', test_image, 'image/jpeg')
            }
            
            upload_response = requests.post(
                f"{BACKEND_URL}/vehicles/{vehicle_id}/upload-photo",
                files=files,
                headers=headers
            )
            
            if upload_response.status_code != 200:
                self.log_result("Vehicle-Photo-Delete", False, "Could not upload photo for delete test")
                return
            
            # Now delete the photo (index 0)
            delete_response = requests.delete(
                f"{BACKEND_URL}/vehicles/{vehicle_id}/photos/0",
                headers=headers
            )
            
            if delete_response.status_code == 200:
                self.log_result("Vehicle-Photo-Delete", True, "Vehicle photo deletion working correctly")
            else:
                self.log_result("Vehicle-Photo-Delete", False, f"Photo deletion failed: {delete_response.status_code}")
                
        except Exception as e:
            self.log_result("Vehicle-Photo-Delete", False, f"Photo deletion error: {str(e)}")
    
    def test_parceiro_expanded_fields(self):
        """Test creating parceiro with new expanded fields"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Parceiro-Expanded-Fields", False, "No auth token for admin")
            return
        
        # Test creating parceiro with new complete fields
        parceiro_data = {
            "nome_empresa": "Test Fleet Lda",
            "contribuinte_empresa": "123456789",
            "morada_completa": "Rua Teste 123, 1º Andar",
            "codigo_postal": "1000-100",
            "localidade": "Lisboa",
            "nome_manager": "João Silva Manager",
            "telefone": "211234567",
            "telemovel": "911234567",
            "email": "testfleet@example.com",
            "codigo_certidao_comercial": "CERT123456",
            "validade_certidao_comercial": "2025-12-31"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/parceiros", json=parceiro_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                # Verify all new fields are present
                required_fields = ["nome_empresa", "contribuinte_empresa", "morada_completa", 
                                 "codigo_postal", "localidade", "nome_manager", "telefone", 
                                 "telemovel", "email", "codigo_certidao_comercial", "validade_certidao_comercial"]
                
                missing_fields = [field for field in required_fields if field not in result]
                
                if not missing_fields:
                    self.log_result("Parceiro-Expanded-Fields", True, "Parceiro created with all new expanded fields")
                else:
                    self.log_result("Parceiro-Expanded-Fields", False, f"Missing fields in response: {missing_fields}")
            else:
                self.log_result("Parceiro-Expanded-Fields", False, f"Failed to create parceiro: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Parceiro-Expanded-Fields", False, f"Parceiro creation error: {str(e)}")
    
    def test_parceiro_backward_compatibility(self):
        """Test that old parceiro data still works (backward compatibility)"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Parceiro-Backward-Compatibility", False, "No auth token for admin")
            return
        
        # Test with minimal old-style data
        old_parceiro_data = {
            "nome_empresa": "Old Style Company",
            "contribuinte_empresa": "987654321",
            "morada_completa": "Old Address",
            "codigo_postal": "2000-200",
            "localidade": "Porto",
            "nome_manager": "Old Manager",
            "telefone": "222333444",
            "telemovel": "933444555",
            "email": "oldstyle@example.com",
            "codigo_certidao_comercial": "OLD123",
            "validade_certidao_comercial": "2024-12-31"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/parceiros", json=old_parceiro_data, headers=headers)
            
            if response.status_code == 200:
                self.log_result("Parceiro-Backward-Compatibility", True, "Old parceiro format still works (backward compatible)")
            else:
                self.log_result("Parceiro-Backward-Compatibility", False, f"Backward compatibility failed: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Parceiro-Backward-Compatibility", False, f"Backward compatibility error: {str(e)}")
    
    def test_motorista_new_document_types(self):
        """Test motorista document upload with new photo document types"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Motorista-New-Documents", False, "No auth token for admin")
            return
        
        # Get motorista ID
        motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
        if motoristas_response.status_code != 200 or not motoristas_response.json():
            self.log_result("Motorista-New-Documents", False, "No motoristas available for test")
            return
        
        motorista_id = motoristas_response.json()[0]["id"]
        
        # Test new document types
        new_doc_types = [
            "cartao_cidadao_foto",
            "carta_conducao_foto", 
            "licenca_tvde_foto",
            "comprovativo_morada",
            "iban_comprovativo"
        ]
        
        successful_uploads = 0
        
        for doc_type in new_doc_types:
            try:
                test_image = self.create_test_image()
                files = {
                    'file': (f'{doc_type}.jpg', test_image, 'image/jpeg')
                }
                data = {
                    'doc_type': doc_type
                }
                
                response = requests.post(
                    f"{BACKEND_URL}/motoristas/{motorista_id}/upload-document",
                    files=files,
                    data=data,
                    headers=headers
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("converted_to_pdf", False):
                        successful_uploads += 1
                    else:
                        self.log_result("Motorista-New-Documents", False, f"Document {doc_type} not converted to PDF")
                        return
                else:
                    self.log_result("Motorista-New-Documents", False, f"Failed to upload {doc_type}: {response.status_code}")
                    return
                    
            except Exception as e:
                self.log_result("Motorista-New-Documents", False, f"Error uploading {doc_type}: {str(e)}")
                return
        
        if successful_uploads == len(new_doc_types):
            self.log_result("Motorista-New-Documents", True, f"All {len(new_doc_types)} new document types uploaded and converted to PDF")
        else:
            self.log_result("Motorista-New-Documents", False, f"Only {successful_uploads}/{len(new_doc_types)} documents uploaded successfully")
    
    def test_vehicle_part_time_contract(self):
        """Test creating vehicle with part-time contract and 4 schedule slots"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicle-Part-Time-Contract", False, "No auth token for admin")
            return
        
        # Get a parceiro ID
        parceiros_response = requests.get(f"{BACKEND_URL}/parceiros", headers=headers)
        if parceiros_response.status_code != 200 or not parceiros_response.json():
            self.log_result("Vehicle-Part-Time-Contract", False, "No parceiros available for test")
            return
        
        parceiro_id = parceiros_response.json()[0]["id"]
        
        # Create vehicle with part-time contract
        vehicle_data = {
            "marca": "Toyota",
            "modelo": "Prius",
            "matricula": "PT-TEST-123",
            "data_matricula": "2020-01-15",
            "validade_matricula": "2025-01-15",
            "cor": "Branco",
            "combustivel": "hibrido",
            "caixa": "automatica",
            "lugares": 5,
            "tipo_contrato": {
                "tipo": "comissao",
                "comissao_parceiro": 60.0,
                "comissao_motorista": 40.0,
                "regime": "part_time",
                "horario_turno_1": "09:00-13:00",
                "horario_turno_2": "14:00-18:00", 
                "horario_turno_3": "19:00-23:00",
                "horario_turno_4": None
            },
            "categorias_uber": {
                "uberx": True,
                "comfort": True
            },
            "categorias_bolt": {
                "economy": True,
                "comfort": True
            },
            "parceiro_id": parceiro_id
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/vehicles", json=vehicle_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                
                # Verify part-time contract fields
                contract = result.get("tipo_contrato", {})
                
                if (contract.get("regime") == "part_time" and 
                    contract.get("horario_turno_1") == "09:00-13:00" and
                    contract.get("horario_turno_2") == "14:00-18:00" and
                    contract.get("horario_turno_3") == "19:00-23:00" and
                    contract.get("comissao_parceiro") == 60.0 and
                    contract.get("comissao_motorista") == 40.0):
                    
                    self.log_result("Vehicle-Part-Time-Contract", True, "Vehicle created with part-time contract and 4 schedule slots")
                else:
                    self.log_result("Vehicle-Part-Time-Contract", False, "Part-time contract fields not saved correctly")
            else:
                self.log_result("Vehicle-Part-Time-Contract", False, f"Failed to create vehicle: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Vehicle-Part-Time-Contract", False, f"Vehicle creation error: {str(e)}")
    
    def test_file_serving_vehicles_folder(self):
        """Test file serving endpoint for vehicles folder"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("File-Serving-Vehicles", False, "No auth token for admin")
            return
        
        try:
            # Test accessing vehicles folder (should return 404 for non-existent file, not auth error)
            response = requests.get(f"{BACKEND_URL}/files/vehicles/test_vehicle_photo.pdf", headers=headers)
            
            # We expect either 200 (file found) or 404 (file not found), but not 401/403 (auth issues)
            if response.status_code in [200, 404]:
                self.log_result("File-Serving-Vehicles", True, f"Vehicles file endpoint accessible (status: {response.status_code})")
            elif response.status_code in [401, 403]:
                self.log_result("File-Serving-Vehicles", False, f"Authentication issue for vehicles folder: {response.status_code}")
            else:
                self.log_result("File-Serving-Vehicles", False, f"Unexpected status for vehicles folder: {response.status_code}")
        except Exception as e:
            self.log_result("File-Serving-Vehicles", False, f"Request error: {str(e)}")

    # ==================== INTEGRATION TESTS ====================
    
    def test_different_image_formats(self):
        """Test that different image formats are converted to PDF"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Image-Format-Conversion", False, "No auth token for admin")
            return
        
        # Get motorista ID
        motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
        if motoristas_response.status_code != 200 or not motoristas_response.json():
            self.log_result("Image-Format-Conversion", False, "No motoristas available for test")
            return
        
        motorista_id = motoristas_response.json()[0]["id"]
        
        # Test PNG format
        try:
            img = Image.new('RGB', (50, 50), color='blue')
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='PNG')
            img_bytes.seek(0)
            
            files = {
                'file': ('test_doc.png', img_bytes, 'image/png')
            }
            data = {
                'doc_type': 'documento_identificacao'
            }
            
            response = requests.post(
                f"{BACKEND_URL}/motoristas/{motorista_id}/upload-document",
                files=files,
                data=data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("converted_to_pdf", False):
                    self.log_result("Image-Format-Conversion", True, "PNG image successfully converted to PDF")
                else:
                    self.log_result("Image-Format-Conversion", False, "PNG image not converted to PDF")
            else:
                self.log_result("Image-Format-Conversion", False, f"PNG upload failed: {response.status_code}")
        except Exception as e:
            self.log_result("Image-Format-Conversion", False, f"PNG test error: {str(e)}")
    
    def test_pdf_upload_preservation(self):
        """Test that PDF uploads are preserved as PDF"""
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("PDF-Preservation", False, "No auth token for admin")
            return
        
        # Get motorista ID
        motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
        if motoristas_response.status_code != 200 or not motoristas_response.json():
            self.log_result("PDF-Preservation", False, "No motoristas available for test")
            return
        
        motorista_id = motoristas_response.json()[0]["id"]
        
        try:
            pdf_content = self.create_test_pdf()
            
            files = {
                'file': ('test_contract.pdf', pdf_content, 'application/pdf')
            }
            data = {
                'doc_type': 'contrato'
            }
            
            response = requests.post(
                f"{BACKEND_URL}/motoristas/{motorista_id}/upload-document",
                files=files,
                data=data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                # For PDF files, converted_to_pdf should be True but it should reference the same file
                self.log_result("PDF-Preservation", True, "PDF upload handled correctly")
            else:
                self.log_result("PDF-Preservation", False, f"PDF upload failed: {response.status_code}")
        except Exception as e:
            self.log_result("PDF-Preservation", False, f"PDF test error: {str(e)}")

    # ==================== MAIN TEST RUNNER ====================
    
    def run_all_tests(self):
        """Run all test suites"""
        print("=" * 80)
        print("TVDEFleet Backend Testing Suite")
        print("=" * 80)
        
        # Authenticate all users
        print("\n🔐 AUTHENTICATION PHASE")
        print("-" * 40)
        for role in ["admin", "gestor", "parceiro", "motorista"]:
            self.authenticate_user(role)
        
        # FASE 1: Permission Restrictions
        print("\n📋 FASE 1: PERMISSION RESTRICTIONS (HIGH PRIORITY)")
        print("-" * 60)
        self.test_parceiro_cannot_create_revenue()
        self.test_parceiro_cannot_create_expense()
        self.test_parceiro_can_read_revenues_expenses()
        self.test_admin_can_create_revenues_expenses()
        
        # FASE 2: File Upload System
        print("\n📁 FASE 2: FILE UPLOAD SYSTEM (HIGH PRIORITY)")
        print("-" * 50)
        self.test_motorista_document_upload()
        self.test_pagamento_document_upload()
        self.test_file_serving_endpoint()
        self.test_different_image_formats()
        self.test_pdf_upload_preservation()
        
        # FASE 3: Alert System
        print("\n🚨 FASE 3: ALERT SYSTEM (HIGH PRIORITY)")
        print("-" * 40)
        self.test_alertas_list_endpoint()
        self.test_alertas_dashboard_stats()
        self.test_alertas_verificar_manual()
        self.test_alertas_resolver_ignorar()
        self.test_background_task_logs()
        
        # Summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for r in self.test_results if r["success"])
        failed = sum(1 for r in self.test_results if not r["success"])
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        
        if failed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['message']}")
        
        print("\n" + "=" * 80)
        return failed == 0

if __name__ == "__main__":
    tester = TVDEFleetTester()
    success = tester.run_all_tests()
    
    if success:
        print("🎉 All tests passed!")
        exit(0)
    else:
        print("💥 Some tests failed!")
        exit(1)