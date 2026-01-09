#!/usr/bin/env python3
"""
Weekly Reports System Testing Suite
Tests for the complete weekly reports management flow as per review request
"""

import requests
import json
import os
import tempfile
import time
from PIL import Image
import io
import base64
from pathlib import Path

# Get backend URL from frontend .env
BACKEND_URL = "https://driver-expenses-1.preview.emergentagent.com/api"

# Test credentials (from review request)
TEST_CREDENTIALS = {
    "parceiro": {"email": "parceiro@tvdefleet.com", "password": "UQ1B6DXU"}
}

class WeeklyReportsTester:
    def __init__(self):
        self.tokens = {}
        self.test_results = []
        self.created_report_id = None
        self.recibo_filename = None
        self.comprovativo_filename = None
        
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
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*80)
        print("📋 RESUMO DOS TESTES - SISTEMA DE RELATÓRIOS SEMANAIS")
        print("="*80)
        
        passed = 0
        failed = 0
        
        for result in self.test_results:
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"{status} {result['test']}: {result['message']}")
            if result["details"]:
                print(f"   Details: {result['details']}")
            
            if result["success"]:
                passed += 1
            else:
                failed += 1
        
        print("="*80)
        print(f"📊 ESTATÍSTICAS FINAIS:")
        print(f"Total de testes: {passed + failed}")
        print(f"✅ Passou: {passed}")
        print(f"❌ Falhou: {failed}")
        print(f"Taxa de sucesso: {(passed/(passed+failed)*100):.1f}%")
        
        if failed > 0:
            print(f"\n⚠️  {failed} testes falharam. Sistema requer correções.")
        else:
            print(f"\n🎉 TODOS OS TESTES PASSARAM! Sistema 100% funcional!")
        
        print("="*80)
    
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

    # ==================== 8 CRITICAL STEPS TEST ====================
    
    def test_step_1_login_navigation(self, headers):
        """STEP 1: Login and Navigation to /relatorios-hub"""
        try:
            # Test if we can access the reports list endpoint (backend equivalent of /relatorios-hub)
            response = requests.get(f"{BACKEND_URL}/relatorios/semanais-todos", headers=headers)
            
            if response.status_code == 200:
                reports = response.json()
                self.log_result("Step-1-Login-Navigation", True, 
                              f"✅ Login successful, can access reports hub (found {len(reports)} reports)")
            else:
                self.log_result("Step-1-Login-Navigation", False, 
                              f"❌ Cannot access reports hub: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Step-1-Login-Navigation", False, f"❌ Navigation error: {str(e)}")
    
    def test_step_2_create_quick_report(self, headers):
        """STEP 2: Create Quick Report via POST /api/relatorios/criar-manual"""
        try:
            # First get available drivers
            motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            if motoristas_response.status_code != 200:
                self.log_result("Step-2-Create-Report", False, "❌ Cannot get motoristas list")
                return
            
            motoristas = motoristas_response.json()
            if not motoristas:
                self.log_result("Step-2-Create-Report", False, "❌ No motoristas available")
                return
            
            motorista_id = motoristas[0]["id"]
            
            # Create manual report
            report_data = {
                "motorista_id": motorista_id,
                "data_inicio": "2025-12-02",
                "data_fim": "2025-12-08",
                "semana": 49,
                "ano": 2025,
                "extras": 0.0
            }
            
            response = requests.post(f"{BACKEND_URL}/relatorios/criar-manual", json=report_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                self.created_report_id = result.get("relatorio_id")
                self.log_result("Step-2-Create-Report", True, 
                              f"✅ Report created successfully: {result.get('numero_relatorio', 'N/A')}")
            else:
                self.log_result("Step-2-Create-Report", False, 
                              f"❌ Failed to create report: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Step-2-Create-Report", False, f"❌ Create report error: {str(e)}")
    
    def test_step_3_upload_receipt(self, headers):
        """STEP 3: Upload Receipt via POST /api/relatorios/{relatorio_id}/upload-recibo"""
        if not self.created_report_id:
            self.log_result("Step-3-Upload-Receipt", False, "❌ No report ID from previous step")
            return
        
        try:
            # Create test PDF file
            test_pdf = self.create_test_pdf()
            
            files = {
                'file': ('recibo_teste.pdf', test_pdf, 'application/pdf')
            }
            
            response = requests.post(
                f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}/upload-recibo",
                files=files,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                # Extract filename from response - could be in different fields
                self.recibo_filename = result.get("filename") or result.get("recibo_filename")
                
                # If still no filename, try to extract from recibo_url in the report
                if not self.recibo_filename:
                    report_response = requests.get(f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}", headers=headers)
                    if report_response.status_code == 200:
                        report = report_response.json()
                        recibo_url = report.get("recibo_url", "")
                        if recibo_url and "/api/relatorios/recibos/" in recibo_url:
                            self.recibo_filename = recibo_url.split("/api/relatorios/recibos/")[-1]
                
                # Verify state changed to 'em_analise'
                report_response = requests.get(f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}", headers=headers)
                if report_response.status_code == 200:
                    report = report_response.json()
                    estado = report.get("estado", report.get("status"))
                    
                    if estado == "em_analise":
                        self.log_result("Step-3-Upload-Receipt", True, 
                                      f"✅ Receipt uploaded, state changed to 'em_analise'")
                    else:
                        self.log_result("Step-3-Upload-Receipt", False, 
                                      f"❌ Receipt uploaded but state is '{estado}', expected 'em_analise'")
                else:
                    self.log_result("Step-3-Upload-Receipt", False, "❌ Cannot verify report state after upload")
            else:
                self.log_result("Step-3-Upload-Receipt", False, 
                              f"❌ Failed to upload receipt: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Step-3-Upload-Receipt", False, f"❌ Upload receipt error: {str(e)}")
    
    def test_step_4_download_receipt(self, headers):
        """STEP 4: Download Receipt via GET /api/relatorios/recibos/{filename}"""
        if not self.recibo_filename:
            self.log_result("Step-4-Download-Receipt", False, "❌ No receipt filename from previous step")
            return
        
        try:
            response = requests.get(f"{BACKEND_URL}/relatorios/recibos/{self.recibo_filename}", headers=headers)
            
            if response.status_code == 200:
                content_type = response.headers.get('Content-Type', '')
                content_length = len(response.content)
                
                if content_length > 0 and ('pdf' in content_type.lower() or 'octet-stream' in content_type.lower()):
                    self.log_result("Step-4-Download-Receipt", True, 
                                  f"✅ Receipt downloaded successfully: {content_length} bytes")
                else:
                    self.log_result("Step-4-Download-Receipt", False, 
                                  f"❌ Invalid file response: Content-Type={content_type}, Size={content_length}")
            else:
                self.log_result("Step-4-Download-Receipt", False, 
                              f"❌ Failed to download receipt: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Step-4-Download-Receipt", False, f"❌ Download receipt error: {str(e)}")
    
    def test_step_5_approve_analysis(self, headers):
        """STEP 5: Approve Analysis via POST /api/relatorios/semanal/{relatorio_id}/aprovar-analise"""
        if not self.created_report_id:
            self.log_result("Step-5-Approve-Analysis", False, "❌ No report ID from previous step")
            return
        
        try:
            response = requests.post(
                f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}/aprovar-analise",
                headers=headers
            )
            
            if response.status_code == 200:
                # Verify state changed to 'aguarda_pagamento' (NOT 'verificado')
                report_response = requests.get(f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}", headers=headers)
                if report_response.status_code == 200:
                    report = report_response.json()
                    estado = report.get("estado", report.get("status"))
                    
                    if estado == "aguarda_pagamento":
                        self.log_result("Step-5-Approve-Analysis", True, 
                                      f"✅ Analysis approved, state changed to 'aguarda_pagamento' (CORRECT)")
                    elif estado == "verificado":
                        self.log_result("Step-5-Approve-Analysis", False, 
                                      f"❌ State is 'verificado' but should be 'aguarda_pagamento' (BUG)")
                    else:
                        self.log_result("Step-5-Approve-Analysis", False, 
                                      f"❌ Unexpected state '{estado}', expected 'aguarda_pagamento'")
                else:
                    self.log_result("Step-5-Approve-Analysis", False, "❌ Cannot verify report state after approval")
            else:
                self.log_result("Step-5-Approve-Analysis", False, 
                              f"❌ Failed to approve analysis: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Step-5-Approve-Analysis", False, f"❌ Approve analysis error: {str(e)}")
    
    def test_step_6_upload_payment_proof(self, headers):
        """STEP 6: Upload Payment Proof via POST /api/relatorios/semanal/{relatorio_id}/upload-comprovativo"""
        if not self.created_report_id:
            self.log_result("Step-6-Upload-Payment-Proof", False, "❌ No report ID from previous step")
            return
        
        try:
            # Create test image file for payment proof
            test_image = self.create_test_image()
            
            files = {
                'file': ('comprovativo_teste.jpg', test_image, 'image/jpeg')
            }
            
            response = requests.post(
                f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}/upload-comprovativo",
                files=files,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                # Extract filename from response - could be in different fields
                self.comprovativo_filename = result.get("filename") or result.get("comprovativo_filename")
                
                # If still no filename, try to extract from comprovativo_url in the report
                if not self.comprovativo_filename:
                    report_response = requests.get(f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}", headers=headers)
                    if report_response.status_code == 200:
                        report = report_response.json()
                        comprovativo_url = report.get("comprovativo_pagamento_url", "")
                        if comprovativo_url and "/api/relatorios/comprovativos/" in comprovativo_url:
                            self.comprovativo_filename = comprovativo_url.split("/api/relatorios/comprovativos/")[-1]
                
                # Verify comprovativo_pagamento_url is filled
                report_response = requests.get(f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}", headers=headers)
                if report_response.status_code == 200:
                    report = report_response.json()
                    comprovativo_url = report.get("comprovativo_pagamento_url")
                    
                    if comprovativo_url and "/api/relatorios/comprovativos/" in comprovativo_url:
                        self.log_result("Step-6-Upload-Payment-Proof", True, 
                                      f"✅ Payment proof uploaded, URL: {comprovativo_url}")
                    else:
                        self.log_result("Step-6-Upload-Payment-Proof", False, 
                                      f"❌ Payment proof uploaded but URL incorrect: {comprovativo_url}")
                else:
                    self.log_result("Step-6-Upload-Payment-Proof", False, "❌ Cannot verify report after upload")
            else:
                self.log_result("Step-6-Upload-Payment-Proof", False, 
                              f"❌ Failed to upload payment proof: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Step-6-Upload-Payment-Proof", False, f"❌ Upload payment proof error: {str(e)}")
    
    def test_step_7_mark_as_paid(self, headers):
        """STEP 7: Mark as Paid via POST /api/relatorios/semanal/{relatorio_id}/marcar-pago"""
        if not self.created_report_id:
            self.log_result("Step-7-Mark-As-Paid", False, "❌ No report ID from previous step")
            return
        
        try:
            response = requests.post(
                f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}/marcar-pago",
                json={},  # Empty body as per endpoint
                headers=headers
            )
            
            if response.status_code == 200:
                # Verify state changed to 'pago'
                report_response = requests.get(f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}", headers=headers)
                if report_response.status_code == 200:
                    report = report_response.json()
                    estado = report.get("estado", report.get("status"))
                    
                    if estado == "pago":
                        self.log_result("Step-7-Mark-As-Paid", True, 
                                      f"✅ Report marked as paid, state changed to 'pago'")
                    else:
                        self.log_result("Step-7-Mark-As-Paid", False, 
                                      f"❌ State is '{estado}', expected 'pago'")
                else:
                    self.log_result("Step-7-Mark-As-Paid", False, "❌ Cannot verify report state after marking paid")
            else:
                self.log_result("Step-7-Mark-As-Paid", False, 
                              f"❌ Failed to mark as paid: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Step-7-Mark-As-Paid", False, f"❌ Mark as paid error: {str(e)}")
    
    def test_step_8_download_payment_proof(self, headers):
        """STEP 8: Download Payment Proof via GET /api/relatorios/comprovativos/{filename}"""
        if not self.comprovativo_filename:
            self.log_result("Step-8-Download-Payment-Proof", False, "❌ No comprovativo filename from previous step")
            return
        
        try:
            response = requests.get(f"{BACKEND_URL}/relatorios/comprovativos/{self.comprovativo_filename}", headers=headers)
            
            if response.status_code == 200:
                content_type = response.headers.get('Content-Type', '')
                content_length = len(response.content)
                
                if content_length > 0:
                    self.log_result("Step-8-Download-Payment-Proof", True, 
                                  f"✅ Payment proof downloaded successfully: {content_length} bytes")
                else:
                    self.log_result("Step-8-Download-Payment-Proof", False, 
                                  f"❌ Empty file response: Content-Type={content_type}")
            else:
                self.log_result("Step-8-Download-Payment-Proof", False, 
                              f"❌ Failed to download payment proof: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Step-8-Download-Payment-Proof", False, f"❌ Download payment proof error: {str(e)}")
    
    def test_list_all_reports(self, headers):
        """Additional Test: GET /api/relatorios/semanais-todos"""
        try:
            response = requests.get(f"{BACKEND_URL}/relatorios/semanais-todos", headers=headers)
            
            if response.status_code == 200:
                reports = response.json()
                
                # Verify report structure
                if reports and len(reports) > 0:
                    first_report = reports[0]
                    required_fields = ["id", "numero_relatorio", "estado"]
                    missing_fields = [field for field in required_fields if field not in first_report]
                    
                    if not missing_fields:
                        # Check for correct URL formats
                        recibo_url = first_report.get("recibo_url", "")
                        comprovativo_url = first_report.get("comprovativo_pagamento_url", "")
                        
                        url_check = True
                        if recibo_url and not recibo_url.startswith("/api/relatorios/recibos/"):
                            url_check = False
                        if comprovativo_url and not comprovativo_url.startswith("/api/relatorios/comprovativos/"):
                            url_check = False
                        
                        if url_check:
                            self.log_result("List-All-Reports", True, 
                                          f"✅ Retrieved {len(reports)} reports with correct URL formats")
                        else:
                            self.log_result("List-All-Reports", False, 
                                          f"❌ Reports have incorrect URL formats")
                    else:
                        self.log_result("List-All-Reports", False, f"❌ Missing fields: {missing_fields}")
                else:
                    self.log_result("List-All-Reports", True, "✅ No reports found (expected for new system)")
            else:
                self.log_result("List-All-Reports", False, f"❌ Failed to list reports: {response.status_code}")
        except Exception as e:
            self.log_result("List-All-Reports", False, f"❌ List reports error: {str(e)}")
    
    def test_get_specific_report_backend(self, headers):
        """Additional Test: GET /api/relatorios/semanal/{relatorio_id}"""
        if not self.created_report_id:
            self.log_result("Get-Specific-Report-Backend", False, "❌ No report ID available")
            return
        
        try:
            response = requests.get(f"{BACKEND_URL}/relatorios/semanal/{self.created_report_id}", headers=headers)
            
            if response.status_code == 200:
                report = response.json()
                
                # Verify complete report structure
                required_fields = ["numero_relatorio", "motorista_nome", "estado", "total_recibo"]
                present_fields = [field for field in required_fields if field in report]
                
                if len(present_fields) >= len(required_fields) * 0.8:  # At least 80% of fields
                    self.log_result("Get-Specific-Report-Backend", True, 
                                  f"✅ Report details retrieved with {len(present_fields)}/{len(required_fields)} expected fields")
                else:
                    self.log_result("Get-Specific-Report-Backend", False, 
                                  f"❌ Incomplete report: {len(present_fields)}/{len(required_fields)} fields")
            else:
                self.log_result("Get-Specific-Report-Backend", False, 
                              f"❌ Failed to get report: {response.status_code}")
        except Exception as e:
            self.log_result("Get-Specific-Report-Backend", False, f"❌ Get report error: {str(e)}")
    
    def test_report_history(self, headers):
        """Additional Test: GET /api/relatorios/historico"""
        try:
            response = requests.get(f"{BACKEND_URL}/relatorios/historico", headers=headers)
            
            if response.status_code == 200:
                history = response.json()
                self.log_result("Report-History", True, 
                              f"✅ Report history retrieved: {len(history)} entries")
            else:
                self.log_result("Report-History", False, 
                              f"❌ Failed to get history: {response.status_code}")
        except Exception as e:
            self.log_result("Report-History", False, f"❌ Get history error: {str(e)}")

    def run_complete_test_suite(self):
        """Run the complete weekly reports test suite"""
        print("🚀 INICIANDO TESTES CRÍTICOS DO SISTEMA DE RELATÓRIOS SEMANAIS")
        print("=" * 80)
        print("📋 REVIEW REQUEST: Teste completo do fluxo de gestão de relatórios semanais")
        print("🔧 4 bugs já corrigidos pelo agente anterior:")
        print("   ✅ Estado em_analise → aguarda_pagamento (não verificado)")
        print("   ✅ Endpoint GET /api/relatorios/recibos/{filename}")
        print("   ✅ Endpoint GET /api/relatorios/comprovativos/{filename}")
        print("   ✅ URLs corrigidas no backend e frontend")
        print("=" * 80)
        
        # Authenticate parceiro user
        print("\n🔐 AUTENTICAÇÃO")
        print("-" * 40)
        if not self.authenticate_user("parceiro"):
            print("❌ FALHA NA AUTENTICAÇÃO - ABORTANDO TESTES")
            return False
        
        headers = self.get_headers("parceiro")
        
        # Execute the complete 8-step flow
        print("\n📊 TESTE COMPLETO DO FLUXO DE RELATÓRIOS SEMANAIS")
        print("-" * 60)
        
        # 8 Critical Steps
        self.test_step_1_login_navigation(headers)
        self.test_step_2_create_quick_report(headers)
        self.test_step_3_upload_receipt(headers)
        self.test_step_4_download_receipt(headers)
        self.test_step_5_approve_analysis(headers)
        self.test_step_6_upload_payment_proof(headers)
        self.test_step_7_mark_as_paid(headers)
        self.test_step_8_download_payment_proof(headers)
        
        # Additional backend tests
        print("\n🔧 TESTES ADICIONAIS DO BACKEND")
        print("-" * 40)
        self.test_list_all_reports(headers)
        self.test_get_specific_report_backend(headers)
        self.test_report_history(headers)
        
        # Print final summary
        self.print_summary()
        
        return True

if __name__ == "__main__":
    tester = WeeklyReportsTester()
    tester.run_complete_test_suite()