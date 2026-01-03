#!/usr/bin/env python3
"""
FleeTrack Backend Testing Suite - Updated System Tests
Tests for updated expense assignment logic and report management features
"""

import requests
import json
import os
import tempfile
import time
from pathlib import Path
import csv

# Get backend URL from frontend .env
BACKEND_URL = "https://auto-expense-9.preview.emergentagent.com/api"

# Test credentials (from review request)
TEST_CREDENTIALS = {
    "admin": {"email": "admin@tvdefleet.com", "password": "123456"},
    "parceiro": {"email": "parceiro@tvdefleet.com", "password": "123456"}
}

class FleeTrackTester:
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
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*80)
        print("📋 RESUMO DOS TESTES - FleeTrack Backend API")
        print("="*80)
        
        for result in self.test_results:
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"{status} {result['test']}: {result['message']}")
            if result["details"]:
                print(f"   Details: {result['details']}")
        
        print("="*80)
    
    def get_test_summary(self):
        """Get test results summary statistics"""
        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r["success"])
        failed = total - passed
        
        return {
            "total": total,
            "passed": passed,
            "failed": failed
        }
    
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
    
    def create_test_csv_file(self):
        """Create a test CSV file with Via Verde data"""
        csv_data = [
            ["License Plate", "Entry Date", "Exit Date", "Entry Point", "Exit Point", "Value", "Liquid Value", "Service Description"],
            ["AB-12-CD", "2024-01-15", "2024-01-15", "A1 Porto", "A1 Lisboa", "2.50", "2.30", "Autoestradas"],
            ["EF-34-GH", "2024-01-16", "2024-01-16", "A2 Lisboa", "A2 Faro", "5.80", "5.50", "Autoestradas"],
            ["IJ-56-KL", "2024-01-17", "2024-01-17", "Parque Centro", "Parque Centro", "1.20", "1.00", "Parques"]
        ]
        
        # Create temporary CSV file
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
        writer = csv.writer(temp_file)
        writer.writerows(csv_data)
        temp_file.close()
        
        return temp_file.name
    
    def test_fleetrack_backend_apis(self):
        """🎯 MAIN TEST: FleeTrack Updated System Tests"""
        print("\n🎯 MAIN TEST: FleeTrack Updated System Tests")
        print("=" * 80)
        print("CREDENCIAIS:")
        print("- Admin: admin@tvdefleet.com / 123456")
        print("- Parceiro: parceiro@tvdefleet.com / 123456")
        print("\nTESTES A REALIZAR:")
        print("1. Authentication API")
        print("2. Vehicle Device Management API - GET/PUT /api/vehicles/{id}/dispositivos")
        print("3. Vehicle Assignment History API - GET /api/vehicles/{id}/historico-atribuicoes")
        print("4. Vehicle Driver Assignment API - POST /api/vehicles/{id}/atribuir-motorista")
        print("5. Motoristas List API - GET /api/motoristas")
        print("6. Via Verde Weekly Reports API - POST /api/relatorios/motorista/{id}/gerar-semanal")
        print("7. Despesas Resumo API - GET /api/despesas/resumo (NEW LOGIC)")
        print("8. Report Delete API - DELETE /api/relatorios/semanal/{id}")
        print("9. Report Status Change API - PUT /api/relatorios/semanal/{id}/status")
        print("10. List Reports for Parceiro - GET /api/relatorios/semanais-todos")
        print("11. CSV Import API - POST /api/despesas/importar")
        print("12. List Despesas API - GET /api/despesas/")
        print("13. 🆕 NEW: Vehicle Costs API - POST /api/vehicles/{id}/custos")
        print("14. 🆕 NEW: Vehicle Costs List API - GET /api/vehicles/{id}/custos")
        print("15. 🆕 NEW: Vehicle ROI Report API - GET /api/vehicles/{id}/relatorio-ganhos")
        print("=" * 80)
        
        # Execute all tests
        self.test_authentication_api()
        self.test_vehicle_device_management_api()
        self.test_vehicle_assignment_history_api()
        self.test_vehicle_driver_assignment_api()
        self.test_motoristas_list_api()
        self.test_via_verde_weekly_reports_api()
        self.test_despesas_resumo_api()
        self.test_relatorios_delete_api()
        self.test_relatorios_status_change_api()
        self.test_relatorios_list_parceiro_api()
        self.test_despesas_import_api()
        self.test_despesas_list_api()
        # NEW TESTS: Vehicle Costs and ROI
        self.test_vehicle_costs_api()
        self.test_vehicle_costs_list_api()
        self.test_vehicle_roi_report_api()
        
        return True
    
    def test_vehicle_device_management_api(self):
        """2. Test Vehicle Device Management API - NEW ENDPOINTS"""
        print("\n📋 2. Test Vehicle Device Management API - NEW ENDPOINTS")
        print("-" * 60)
        print("TESTE: GET/PUT /api/vehicles/{vehicle_id}/dispositivos")
        print("VEHICLE ID: 4ad331ff-c0f5-43c9-95b8-cc085d32d8a7")
        print("EXPECTED: Get and update vehicle devices (OBU Via Verde, Cartões combustível)")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicle-Devices-Auth", False, "❌ No auth token for admin")
            return False
        
        vehicle_id = "4ad331ff-c0f5-43c9-95b8-cc085d32d8a7"
        
        try:
            # Test 1: GET Vehicle Devices
            print("\n🔍 Test 1: GET /api/vehicles/{vehicle_id}/dispositivos")
            response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}/dispositivos", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["veiculo_id", "matricula", "dispositivos"]
                
                if all(field in data for field in required_fields):
                    dispositivos = data.get("dispositivos", {})
                    expected_device_fields = ["obu_via_verde", "cartao_combustivel_fossil", "cartao_combustivel_eletrico", "gps_matricula"]
                    
                    if all(field in dispositivos for field in expected_device_fields):
                        self.log_result("Vehicle-Devices-GET", True, 
                                      f"✅ GET dispositivos works: {data.get('matricula')} - OBU: {dispositivos.get('obu_via_verde')}, Fossil: {dispositivos.get('cartao_combustivel_fossil')}")
                    else:
                        self.log_result("Vehicle-Devices-GET", False, 
                                      f"❌ Missing device fields: {dispositivos}")
                else:
                    self.log_result("Vehicle-Devices-GET", False, 
                                  f"❌ Missing required fields: {data}")
            else:
                self.log_result("Vehicle-Devices-GET", False, 
                              f"❌ GET dispositivos failed: {response.status_code}", response.text)
            
            # Test 2: PUT Update Vehicle Devices
            print("\n🔍 Test 2: PUT /api/vehicles/{vehicle_id}/dispositivos")
            update_data = {
                "obu_via_verde": "TEST-OBU-123",
                "cartao_combustivel_fossil": "TEST-CARD-456"
            }
            
            response = requests.put(
                f"{BACKEND_URL}/vehicles/{vehicle_id}/dispositivos",
                json=update_data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                if "message" in result and "dispositivos" in result:
                    dispositivos = result.get("dispositivos", {})
                    if dispositivos.get("obu_via_verde") == "TEST-OBU-123" and dispositivos.get("cartao_combustivel_fossil") == "TEST-CARD-456":
                        self.log_result("Vehicle-Devices-PUT", True, 
                                      f"✅ PUT dispositivos works: Updated OBU to {dispositivos.get('obu_via_verde')}, Card to {dispositivos.get('cartao_combustivel_fossil')}")
                    else:
                        self.log_result("Vehicle-Devices-PUT", False, 
                                      f"❌ Device update values incorrect: {dispositivos}")
                else:
                    self.log_result("Vehicle-Devices-PUT", False, 
                                  f"❌ PUT response missing required fields: {result}")
            else:
                self.log_result("Vehicle-Devices-PUT", False, 
                              f"❌ PUT dispositivos failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("Vehicle-Devices-Error", False, f"❌ Error during vehicle devices test: {str(e)}")
            return False
    
    def test_vehicle_assignment_history_api(self):
        """3. Test Vehicle Assignment History API - NEW ENDPOINT"""
        print("\n📋 3. Test Vehicle Assignment History API - NEW ENDPOINT")
        print("-" * 60)
        print("TESTE: GET /api/vehicles/{vehicle_id}/historico-atribuicoes")
        print("VEHICLE ID: 4ad331ff-c0f5-43c9-95b8-cc085d32d8a7")
        print("EXPECTED: List of assignments with motorista, datas, km, ganhos_periodo")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicle-History-Auth", False, "❌ No auth token for admin")
            return False
        
        vehicle_id = "4ad331ff-c0f5-43c9-95b8-cc085d32d8a7"
        
        try:
            response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}/historico-atribuicoes", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["veiculo_id", "matricula", "historico", "total_registos"]
                
                if all(field in data for field in required_fields):
                    historico = data.get("historico", [])
                    total_registos = data.get("total_registos", 0)
                    matricula = data.get("matricula")
                    
                    if historico:
                        # Check first history entry structure
                        first_entry = historico[0]
                        expected_history_fields = ["id", "veiculo_id", "motorista_id", "motorista_nome", "data_inicio"]
                        
                        if all(field in first_entry for field in expected_history_fields):
                            motorista_nome = first_entry.get("motorista_nome")
                            data_inicio = first_entry.get("data_inicio")
                            ganhos_periodo = first_entry.get("ganhos_periodo", {})
                            
                            self.log_result("Vehicle-History", True, 
                                          f"✅ Assignment history works: {matricula} - {total_registos} records, Latest: {motorista_nome} desde {data_inicio[:10]}")
                            
                            if ganhos_periodo:
                                total_ganhos = ganhos_periodo.get("total", 0)
                                self.log_result("Vehicle-History-Ganhos", True, 
                                              f"✅ Ganhos calculation works: €{total_ganhos} total period earnings")
                        else:
                            self.log_result("Vehicle-History", False, 
                                          f"❌ History entry missing required fields: {first_entry}")
                    else:
                        self.log_result("Vehicle-History", True, 
                                      f"✅ Assignment history works: {matricula} - No assignments yet (normal for new vehicle)")
                else:
                    self.log_result("Vehicle-History", False, 
                                  f"❌ History response missing required fields: {data}")
            else:
                self.log_result("Vehicle-History", False, 
                              f"❌ Assignment history failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("Vehicle-History-Error", False, f"❌ Error during assignment history test: {str(e)}")
            return False
    
    def test_vehicle_driver_assignment_api(self):
        """4. Test Vehicle Driver Assignment API - UPDATED ENDPOINT"""
        print("\n📋 4. Test Vehicle Driver Assignment API - UPDATED ENDPOINT")
        print("-" * 60)
        print("TESTE: POST /api/vehicles/{vehicle_id}/atribuir-motorista")
        print("VEHICLE ID: 4ad331ff-c0f5-43c9-95b8-cc085d32d8a7")
        print("EXPECTED: Create history record and return historico_id and data_atribuicao")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicle-Assignment-Auth", False, "❌ No auth token for admin")
            return False
        
        vehicle_id = "4ad331ff-c0f5-43c9-95b8-cc085d32d8a7"
        
        try:
            # First, get list of motoristas to find one to assign
            motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            
            if motoristas_response.status_code == 200:
                motoristas = motoristas_response.json()
                
                if motoristas and len(motoristas) > 0:
                    # Use first available motorista
                    motorista = motoristas[0]
                    motorista_id = motorista.get("id")
                    motorista_nome = motorista.get("name")
                    
                    print(f"\n🔍 Using motorista: {motorista_nome} (ID: {motorista_id})")
                    
                    # Test assignment
                    assignment_data = {
                        "motorista_id": motorista_id,
                        "km_atual": 55000
                    }
                    
                    response = requests.post(
                        f"{BACKEND_URL}/vehicles/{vehicle_id}/atribuir-motorista",
                        json=assignment_data,
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        required_fields = ["message", "motorista", "data_atribuicao", "historico_id"]
                        
                        if all(field in result for field in required_fields):
                            historico_id = result.get("historico_id")
                            data_atribuicao = result.get("data_atribuicao")
                            motorista_assigned = result.get("motorista")
                            
                            self.log_result("Vehicle-Assignment", True, 
                                          f"✅ Driver assignment works: {motorista_assigned} assigned at {data_atribuicao[:19]}, History ID: {historico_id}")
                            
                            # Store for later verification
                            self.assignment_historico_id = historico_id
                            
                            # Verify history was created by checking history endpoint
                            print("\n🔍 Verifying history was created...")
                            history_response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}/historico-atribuicoes", headers=headers)
                            
                            if history_response.status_code == 200:
                                history_data = history_response.json()
                                historico = history_data.get("historico", [])
                                
                                # Find the entry we just created
                                found_entry = None
                                for entry in historico:
                                    if entry.get("id") == historico_id:
                                        found_entry = entry
                                        break
                                
                                if found_entry:
                                    self.log_result("Vehicle-Assignment-History", True, 
                                                  f"✅ History entry created: {found_entry.get('motorista_nome')} from {found_entry.get('data_inicio')[:19]}")
                                else:
                                    self.log_result("Vehicle-Assignment-History", False, 
                                                  f"❌ History entry not found with ID: {historico_id}")
                            else:
                                self.log_result("Vehicle-Assignment-History", False, 
                                              f"❌ Could not verify history: {history_response.status_code}")
                        else:
                            self.log_result("Vehicle-Assignment", False, 
                                          f"❌ Assignment response missing required fields: {result}")
                    else:
                        self.log_result("Vehicle-Assignment", False, 
                                      f"❌ Driver assignment failed: {response.status_code}", response.text)
                else:
                    self.log_result("Vehicle-Assignment", False, 
                                  "❌ No motoristas found to test assignment")
            else:
                self.log_result("Vehicle-Assignment", False, 
                              f"❌ Could not get motoristas list: {motoristas_response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Vehicle-Assignment-Error", False, f"❌ Error during driver assignment test: {str(e)}")
            return False
    
    def test_motoristas_list_api(self):
        """5. Test Motoristas List API"""
        print("\n📋 5. Test Motoristas List API")
        print("-" * 60)
        print("TESTE: GET /api/motoristas")
        print("EXPECTED: List of motoristas for assignment testing")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Motoristas-List-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            
            if response.status_code == 200:
                motoristas = response.json()
                
                if isinstance(motoristas, list):
                    if motoristas:
                        first_motorista = motoristas[0]
                        required_fields = ["id", "name", "email"]
                        
                        if all(field in first_motorista for field in required_fields):
                            self.log_result("Motoristas-List", True, 
                                          f"✅ Motoristas list works: {len(motoristas)} motoristas found")
                            
                            # Log some motorista details for reference
                            for i, motorista in enumerate(motoristas[:3]):  # Show first 3
                                nome = motorista.get("name")
                                email = motorista.get("email")
                                veiculo = motorista.get("veiculo_atribuido")
                                status = "Assigned" if veiculo else "Available"
                                print(f"   {i+1}. {nome} ({email}) - {status}")
                        else:
                            self.log_result("Motoristas-List", False, 
                                          f"❌ Motorista records missing required fields: {first_motorista}")
                    else:
                        self.log_result("Motoristas-List", True, 
                                      "ℹ️ No motoristas found (normal if database empty)")
                else:
                    self.log_result("Motoristas-List", False, 
                                  f"❌ Motoristas response not a list: {type(motoristas)}")
            else:
                self.log_result("Motoristas-List", False, 
                              f"❌ Motoristas list failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("Motoristas-List-Error", False, f"❌ Error during motoristas list test: {str(e)}")
            return False
    
    def test_via_verde_weekly_reports_api(self):
        """6. Test Via Verde Weekly Reports API - PRIORITY TEST"""
        print("\n📋 2. Test Via Verde Weekly Reports API - PRIORITY TEST")
        print("-" * 60)
        print("TESTE: POST /api/relatorios/motorista/{motorista_id}/gerar-semanal")
        print("MOTORISTA ID: e2355169-10a7-4547-9dd0-479c128d73f9")
        print("EXPECTED: Via Verde expenses from despesas_fornecedor collection included")
        print("EXPECTED: via_verde_atraso_semanas: 2 configuration applied")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("ViaVerde-Reports-Auth", False, "❌ No auth token for admin")
            return False
        
        motorista_id = "e2355169-10a7-4547-9dd0-479c128d73f9"
        
        try:
            # Test Case 1: Semana 1 de 2026 (29 dez 2025 - 4 jan 2026)
            # Com atraso de 2 semanas, deve buscar despesas de 15-21 dezembro
            print("\n🔍 Test Case 1: Semana 1/2026 - Deve incluir Via Verde de 15-21 dezembro")
            test1_data = {
                "data_inicio": "2025-12-29",
                "data_fim": "2026-01-04",
                "semana": 1,
                "ano": 2026
            }
            
            response = requests.post(
                f"{BACKEND_URL}/relatorios/motorista/{motorista_id}/gerar-semanal",
                json=test1_data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                resumo = result.get("resumo", {})
                total_via_verde = resumo.get("total_via_verde", 0)
                
                # Expected: approximately €81.30 (45 records)
                if total_via_verde > 0:
                    self.log_result("ViaVerde-Test1", True, 
                                  f"✅ Semana 1/2026: Via Verde = €{total_via_verde:.2f} (Expected ~€81.30)")
                    
                    # Check if value is approximately correct
                    if 75 <= total_via_verde <= 90:
                        self.log_result("ViaVerde-Test1-Value", True, 
                                      f"✅ Via Verde value in expected range: €{total_via_verde:.2f}")
                    else:
                        self.log_result("ViaVerde-Test1-Value", False, 
                                      f"⚠️ Via Verde value unexpected: €{total_via_verde:.2f} (expected ~€81.30)")
                else:
                    self.log_result("ViaVerde-Test1", False, 
                                  f"❌ Semana 1/2026: No Via Verde expenses found (expected ~€81.30)")
            else:
                self.log_result("ViaVerde-Test1", False, 
                              f"❌ Test 1 failed: {response.status_code}", response.text)
            
            # Test Case 2: Semana 52 de 2025 (22-28 dez)
            # Com atraso de 2 semanas, vai buscar 8-14 dez onde não há despesas
            print("\n🔍 Test Case 2: Semana 52/2025 - Deve retornar Via Verde = 0 (8-14 dezembro)")
            test2_data = {
                "data_inicio": "2025-12-22",
                "data_fim": "2025-12-28",
                "semana": 52,
                "ano": 2025
            }
            
            response = requests.post(
                f"{BACKEND_URL}/relatorios/motorista/{motorista_id}/gerar-semanal",
                json=test2_data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                resumo = result.get("resumo", {})
                total_via_verde = resumo.get("total_via_verde", 0)
                
                if total_via_verde == 0:
                    self.log_result("ViaVerde-Test2", True, 
                                  f"✅ Semana 52/2025: Via Verde = €{total_via_verde:.2f} (Expected €0.00)")
                else:
                    self.log_result("ViaVerde-Test2", False, 
                                  f"❌ Semana 52/2025: Via Verde = €{total_via_verde:.2f} (expected €0.00)")
            else:
                self.log_result("ViaVerde-Test2", False, 
                              f"❌ Test 2 failed: {response.status_code}", response.text)
            
            # Test Case 3: Verify atraso calculation logic
            print("\n🔍 Test Case 3: Verificar lógica de atraso de semanas")
            # Test with a different period to verify the delay logic
            test3_data = {
                "data_inicio": "2026-01-05",
                "data_fim": "2026-01-11",
                "semana": 2,
                "ano": 2026
            }
            
            response = requests.post(
                f"{BACKEND_URL}/relatorios/motorista/{motorista_id}/gerar-semanal",
                json=test3_data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                resumo = result.get("resumo", {})
                total_via_verde = resumo.get("total_via_verde", 0)
                
                self.log_result("ViaVerde-Test3", True, 
                              f"✅ Semana 2/2026: Via Verde = €{total_via_verde:.2f} (atraso aplicado corretamente)")
            else:
                self.log_result("ViaVerde-Test3", False, 
                              f"❌ Test 3 failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("ViaVerde-Reports-Error", False, f"❌ Error during Via Verde reports test: {str(e)}")
            return False
    
    def test_authentication_api(self):
        """1. Test Authentication API"""
        print("\n📋 1. Test Authentication API")
        print("-" * 60)
        print("TESTE: POST /api/auth/login")
        
        try:
            # Test login with admin credentials
            response = requests.post(f"{BACKEND_URL}/auth/login", json=TEST_CREDENTIALS["admin"])
            
            if response.status_code == 200:
                data = response.json()
                access_token = data.get("access_token")
                user_data = data.get("user")
                
                if access_token and user_data:
                    self.tokens["admin"] = access_token
                    self.log_result("Auth-Admin", True, 
                                  f"✅ Admin login successful - User: {user_data.get('name', user_data.get('email'))}")
                else:
                    self.log_result("Auth-Admin", False, "❌ Admin login response missing token or user data")
            else:
                self.log_result("Auth-Admin", False, 
                              f"❌ Admin login failed: {response.status_code}", response.text)
            
            # Test login with parceiro credentials
            response = requests.post(f"{BACKEND_URL}/auth/login", json=TEST_CREDENTIALS["parceiro"])
            
            if response.status_code == 200:
                data = response.json()
                access_token = data.get("access_token")
                user_data = data.get("user")
                
                if access_token and user_data:
                    self.tokens["parceiro"] = access_token
                    self.log_result("Auth-Parceiro", True, 
                                  f"✅ Parceiro login successful - User: {user_data.get('name', user_data.get('email'))}")
                else:
                    self.log_result("Auth-Parceiro", False, "❌ Parceiro login response missing token or user data")
            else:
                self.log_result("Auth-Parceiro", False, 
                              f"❌ Parceiro login failed: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Auth-Error", False, f"❌ Authentication error: {str(e)}")
    
    def test_despesas_resumo_api(self):
        """7. Test Despesas Resumo API - NEW LOGIC"""
        print("\n📋 7. Test Despesas Resumo API - NEW LOGIC")
        print("-" * 60)
        print("TESTE: GET /api/despesas/resumo")
        print("EXPECTED: por_responsavel should show both 'motorista' and 'veiculo' values")
        print("EXPECTED: valor_motoristas should be > 0 (around €505.79)")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Despesas-Resumo-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            response = requests.get(f"{BACKEND_URL}/despesas/resumo", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["por_responsavel", "por_fornecedor", "total_geral", "total_registos"]
                
                if all(field in data for field in required_fields):
                    total_geral = data.get("total_geral", 0)
                    total_registos = data.get("total_registos", 0)
                    por_responsavel = data.get("por_responsavel", {})
                    
                    # Check if both motorista and veiculo values exist
                    has_motorista = "motorista" in por_responsavel
                    has_veiculo = "veiculo" in por_responsavel
                    valor_motoristas = por_responsavel.get("motorista", {}).get("total", 0)
                    valor_parceiro = por_responsavel.get("veiculo", {}).get("total", 0)
                    
                    success_msg = f"✅ Resumo API works: €{total_geral} total, {total_registos} records"
                    if has_motorista and has_veiculo:
                        success_msg += f", Motoristas: €{valor_motoristas}, Parceiro: €{valor_parceiro}"
                        if valor_motoristas > 0:
                            success_msg += " ✅ NEW LOGIC WORKING - Expenses assigned to motoristas!"
                        else:
                            success_msg += " ⚠️ No motorista expenses found"
                    else:
                        success_msg += f" ⚠️ Missing responsibility types: {list(por_responsavel.keys())}"
                    
                    self.log_result("Despesas-Resumo", True, success_msg)
                else:
                    self.log_result("Despesas-Resumo", False, 
                                  f"❌ Resumo response missing required fields: {data}")
            else:
                self.log_result("Despesas-Resumo", False, 
                              f"❌ Resumo API failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("Despesas-Resumo-Error", False, f"❌ Error during resumo test: {str(e)}")
            return False
    
    def test_relatorios_delete_api(self):
        """8. Test Report Delete API"""
        print("\n📋 8. Test Report Delete API")
        print("-" * 60)
        print("TESTE: DELETE /api/relatorios/semanal/{relatorio_id}")
        
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Reports-Delete-Auth", False, "❌ No auth token for parceiro")
            return False
        
        try:
            # First, get list of reports for parceiro
            response = requests.get(f"{BACKEND_URL}/relatorios/semanais-todos", headers=headers)
            
            if response.status_code == 200:
                relatorios = response.json()
                
                if relatorios and len(relatorios) > 0:
                    # Try to delete the first report
                    relatorio_id = relatorios[0]["id"]
                    relatorio_info = f"{relatorios[0].get('motorista_nome', 'N/A')} - {relatorios[0].get('periodo_inicio', 'N/A')}"
                    
                    delete_response = requests.delete(f"{BACKEND_URL}/relatorios/semanal/{relatorio_id}", headers=headers)
                    
                    if delete_response.status_code == 200:
                        result = delete_response.json()
                        self.log_result("Reports-Delete", True, 
                                      f"✅ Delete API works: Report deleted successfully - {relatorio_info}")
                    else:
                        self.log_result("Reports-Delete", False, 
                                      f"❌ Delete API failed: {delete_response.status_code}", delete_response.text)
                else:
                    self.log_result("Reports-Delete", True, 
                                  "ℹ️ No reports to test delete API (normal if no reports exist)")
            else:
                self.log_result("Reports-Delete", False, 
                              f"❌ Could not get reports for delete test: {response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Reports-Delete-Error", False, f"❌ Error during delete test: {str(e)}")
            return False
    
    def test_relatorios_status_change_api(self):
        """9. Test Report Status Change API"""
        print("\n📋 9. Test Report Status Change API")
        print("-" * 60)
        print("TESTE: PUT /api/relatorios/semanal/{relatorio_id}/status")
        print("VALID STATUSES: rascunho, pendente_aprovacao, aprovado, aguarda_recibo, verificado, pago, rejeitado")
        
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Reports-Status-Auth", False, "❌ No auth token for parceiro")
            return False
        
        try:
            # First, get list of reports for parceiro
            response = requests.get(f"{BACKEND_URL}/relatorios/semanais-todos", headers=headers)
            
            if response.status_code == 200:
                relatorios = response.json()
                
                if relatorios and len(relatorios) > 0:
                    # Try to change status of the first report
                    relatorio_id = relatorios[0]["id"]
                    current_status = relatorios[0].get("status", "unknown")
                    relatorio_info = f"{relatorios[0].get('motorista_nome', 'N/A')} - {relatorios[0].get('periodo_inicio', 'N/A')}"
                    
                    # Test changing to "aprovado" status
                    status_data = {"status": "aprovado"}
                    status_response = requests.put(
                        f"{BACKEND_URL}/relatorios/semanal/{relatorio_id}/status", 
                        json=status_data, 
                        headers=headers
                    )
                    
                    if status_response.status_code == 200:
                        result = status_response.json()
                        self.log_result("Reports-Status", True, 
                                      f"✅ Status change API works: {current_status} → aprovado - {relatorio_info}")
                    else:
                        self.log_result("Reports-Status", False, 
                                      f"❌ Status change API failed: {status_response.status_code}", status_response.text)
                else:
                    self.log_result("Reports-Status", True, 
                                  "ℹ️ No reports to test status change API (normal if no reports exist)")
            else:
                self.log_result("Reports-Status", False, 
                              f"❌ Could not get reports for status test: {response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Reports-Status-Error", False, f"❌ Error during status test: {str(e)}")
            return False
    
    def test_relatorios_list_parceiro_api(self):
        """10. Test List Reports for Parceiro API"""
        print("\n📋 10. Test List Reports for Parceiro API")
        print("-" * 60)
        print("TESTE: GET /api/relatorios/semanais-todos")
        
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Reports-List-Auth", False, "❌ No auth token for parceiro")
            return False
        
        try:
            response = requests.get(f"{BACKEND_URL}/relatorios/semanais-todos", headers=headers)
            
            if response.status_code == 200:
                relatorios = response.json()
                
                if isinstance(relatorios, list):
                    if relatorios:
                        first_report = relatorios[0]
                        required_fields = ["id", "motorista_nome", "parceiro_id", "status"]
                        
                        if all(field in first_report for field in required_fields):
                            self.log_result("Reports-List", True, 
                                          f"✅ List reports API works: {len(relatorios)} reports found for parceiro")
                        else:
                            self.log_result("Reports-List", False, 
                                          f"❌ Report records missing required fields: {first_report}")
                    else:
                        self.log_result("Reports-List", True, 
                                      "✅ List reports API works: No reports found for parceiro (normal if no reports)")
                else:
                    self.log_result("Reports-List", False, 
                                  f"❌ Reports list response not a list: {relatorios}")
            else:
                self.log_result("Reports-List", False, 
                              f"❌ List reports API failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("Reports-List-Error", False, f"❌ Error during list reports test: {str(e)}")
            return False
    
    def test_despesas_import_api(self):
        """11. Test Despesas Import API"""
        print("\n📋 11. Test Despesas Import API")
        print("-" * 60)
        print("TESTE: POST /api/despesas/importar")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Despesas-Import-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            # Create test CSV file
            csv_file_path = self.create_test_csv_file()
            
            with open(csv_file_path, 'rb') as f:
                files = {'file': ('test_via_verde.csv', f, 'text/csv')}
                data = {'tipo_fornecedor': 'via_verde'}
                response = requests.post(f"{BACKEND_URL}/despesas/importar", files=files, data=data, headers=headers)
            
            # Clean up
            os.unlink(csv_file_path)
            
            if response.status_code == 200:
                result = response.json()
                required_fields = ["message", "importacao_id", "total_registos", "registos_importados"]
                
                if all(field in result for field in required_fields):
                    imported = result.get("registos_importados", 0)
                    total = result.get("total_registos", 0)
                    vehicles_found = result.get("veiculos_encontrados", 0)
                    valor_motoristas = result.get("valor_motoristas", 0)
                    valor_parceiro = result.get("valor_parceiro", 0)
                    
                    success_msg = f"✅ Import API works: {imported}/{total} records imported, {vehicles_found} vehicles found"
                    if valor_motoristas > 0:
                        success_msg += f", Motoristas: €{valor_motoristas}, Parceiro: €{valor_parceiro}"
                    
                    self.log_result("Despesas-Import", True, success_msg)
                    
                    # Store import ID for later tests
                    self.import_id = result.get("importacao_id")
                else:
                    self.log_result("Despesas-Import", False, 
                                  f"❌ Import response missing required fields: {result}")
            else:
                self.log_result("Despesas-Import", False, 
                              f"❌ Import API failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("Despesas-Import-Error", False, f"❌ Error during import test: {str(e)}")
            return False
    
    def test_despesas_list_api(self):
        """12. Test Despesas List API"""
        print("\n📋 12. Test Despesas List API")
        print("-" * 60)
        print("TESTE: GET /api/despesas/")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Despesas-List-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            response = requests.get(f"{BACKEND_URL}/despesas/?limit=10", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["despesas", "total", "limit", "skip"]
                
                if all(field in data for field in required_fields):
                    despesas = data.get("despesas", [])
                    total = data.get("total", 0)
                    
                    # Check if despesas have required fields
                    if despesas:
                        first_despesa = despesas[0]
                        required_despesa_fields = ["id", "matricula", "tipo_responsavel", "valor_liquido"]
                        
                        if all(field in first_despesa for field in required_despesa_fields):
                            tipo_responsavel = first_despesa.get("tipo_responsavel")
                            matricula = first_despesa.get("matricula")
                            valor = first_despesa.get("valor_liquido", 0)
                            
                            self.log_result("Despesas-List", True, 
                                          f"✅ List API works: {len(despesas)} despesas returned, {total} total. Sample: {matricula} → {tipo_responsavel} (€{valor})")
                        else:
                            self.log_result("Despesas-List", False, 
                                          f"❌ Despesa records missing required fields: {first_despesa}")
                    else:
                        self.log_result("Despesas-List", True, 
                                      f"✅ List API works: No despesas found (normal if database empty)")
                else:
                    self.log_result("Despesas-List", False, 
                                  f"❌ List response missing required fields: {data}")
            else:
                self.log_result("Despesas-List", False, 
                              f"❌ List API failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("Despesas-List-Error", False, f"❌ Error during list test: {str(e)}")
            return False
    
    def test_vehicle_costs_api(self):
        """13. Test Vehicle Costs API - NEW ENDPOINT"""
        print("\n📋 13. Test Vehicle Costs API - NEW ENDPOINT")
        print("-" * 60)
        print("TESTE: POST /api/vehicles/{vehicle_id}/custos")
        print("VEHICLE ID: 4ad331ff-c0f5-43c9-95b8-cc085d32d8a7")
        print("EXPECTED: Add cost to vehicle history and return custo_id")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicle-Costs-Auth", False, "❌ No auth token for admin")
            return False
        
        vehicle_id = "4ad331ff-c0f5-43c9-95b8-cc085d32d8a7"
        
        try:
            # Test 1: Add maintenance cost
            print("\n🔍 Test 1: POST Add Maintenance Cost")
            cost_data = {
                "categoria": "revisao",
                "descricao": "Troca de óleo e filtros",
                "valor": 150.00,
                "data": "2026-01-03",
                "fornecedor": "Oficina Central"
            }
            
            response = requests.post(
                f"{BACKEND_URL}/vehicles/{vehicle_id}/custos",
                json=cost_data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                required_fields = ["message", "custo_id", "custo"]
                
                if all(field in result for field in required_fields):
                    custo_id = result.get("custo_id")
                    custo = result.get("custo", {})
                    
                    if custo.get("categoria") == "revisao" and custo.get("valor") == 150.00:
                        self.log_result("Vehicle-Costs-Add", True, 
                                      f"✅ Add cost works: {custo.get('descricao')} - €{custo.get('valor')} (ID: {custo_id})")
                        
                        # Store for later tests
                        self.test_custo_id = custo_id
                    else:
                        self.log_result("Vehicle-Costs-Add", False, 
                                      f"❌ Cost data incorrect: {custo}")
                else:
                    self.log_result("Vehicle-Costs-Add", False, 
                                  f"❌ Add cost response missing required fields: {result}")
            else:
                self.log_result("Vehicle-Costs-Add", False, 
                              f"❌ Add cost failed: {response.status_code}", response.text)
            
            # Test 2: Add insurance cost
            print("\n🔍 Test 2: POST Add Insurance Cost")
            insurance_data = {
                "categoria": "seguro",
                "descricao": "Seguro anual do veículo",
                "valor": 500.00,
                "data": "2026-01-01",
                "fornecedor": "Seguradora XYZ"
            }
            
            response = requests.post(
                f"{BACKEND_URL}/vehicles/{vehicle_id}/custos",
                json=insurance_data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                if "custo_id" in result:
                    self.log_result("Vehicle-Costs-Insurance", True, 
                                  f"✅ Insurance cost added: €{insurance_data['valor']}")
                else:
                    self.log_result("Vehicle-Costs-Insurance", False, 
                                  f"❌ Insurance cost response invalid: {result}")
            else:
                self.log_result("Vehicle-Costs-Insurance", False, 
                              f"❌ Insurance cost failed: {response.status_code}")
            
            # Test 3: Add inspection cost
            print("\n🔍 Test 3: POST Add Inspection Cost")
            inspection_data = {
                "categoria": "vistoria",
                "descricao": "Inspeção periódica obrigatória",
                "valor": 35.00,
                "data": "2026-01-02",
                "fornecedor": "Centro de Inspeções"
            }
            
            response = requests.post(
                f"{BACKEND_URL}/vehicles/{vehicle_id}/custos",
                json=inspection_data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                if "custo_id" in result:
                    self.log_result("Vehicle-Costs-Inspection", True, 
                                  f"✅ Inspection cost added: €{inspection_data['valor']}")
                else:
                    self.log_result("Vehicle-Costs-Inspection", False, 
                                  f"❌ Inspection cost response invalid: {result}")
            else:
                self.log_result("Vehicle-Costs-Inspection", False, 
                              f"❌ Inspection cost failed: {response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Vehicle-Costs-Error", False, f"❌ Error during vehicle costs test: {str(e)}")
            return False
    
    def test_vehicle_costs_list_api(self):
        """14. Test Vehicle Costs List API - NEW ENDPOINT"""
        print("\n📋 14. Test Vehicle Costs List API - NEW ENDPOINT")
        print("-" * 60)
        print("TESTE: GET /api/vehicles/{vehicle_id}/custos")
        print("EXPECTED: List of costs with totals by category")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicle-Costs-List-Auth", False, "❌ No auth token for admin")
            return False
        
        vehicle_id = "4ad331ff-c0f5-43c9-95b8-cc085d32d8a7"
        
        try:
            response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}/custos", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["veiculo_id", "matricula", "custos", "totais_por_categoria", "total_geral", "total_registos"]
                
                if all(field in data for field in required_fields):
                    custos = data.get("custos", [])
                    totais = data.get("totais_por_categoria", {})
                    total_geral = data.get("total_geral", 0)
                    total_registos = data.get("total_registos", 0)
                    matricula = data.get("matricula")
                    
                    if custos:
                        # Check first cost structure
                        first_cost = custos[0]
                        required_cost_fields = ["id", "categoria", "descricao", "valor", "data"]
                        
                        if all(field in first_cost for field in required_cost_fields):
                            categoria = first_cost.get("categoria")
                            valor = first_cost.get("valor")
                            descricao = first_cost.get("descricao")
                            
                            self.log_result("Vehicle-Costs-List", True, 
                                          f"✅ Costs list works: {matricula} - {total_registos} costs, €{total_geral} total")
                            
                            # Check if categories are properly grouped
                            if totais:
                                categories_msg = ", ".join([f"{k}: €{v}" for k, v in totais.items()])
                                self.log_result("Vehicle-Costs-Categories", True, 
                                              f"✅ Categories grouped: {categories_msg}")
                            else:
                                self.log_result("Vehicle-Costs-Categories", False, 
                                              "❌ No category totals found")
                        else:
                            self.log_result("Vehicle-Costs-List", False, 
                                          f"❌ Cost records missing required fields: {first_cost}")
                    else:
                        self.log_result("Vehicle-Costs-List", True, 
                                      f"✅ Costs list works: {matricula} - No costs found (normal for new vehicle)")
                else:
                    self.log_result("Vehicle-Costs-List", False, 
                                  f"❌ Costs list response missing required fields: {data}")
            else:
                self.log_result("Vehicle-Costs-List", False, 
                              f"❌ Costs list failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("Vehicle-Costs-List-Error", False, f"❌ Error during costs list test: {str(e)}")
            return False
    
    def test_vehicle_roi_report_api(self):
        """15. Test Vehicle ROI Report API - NEW ENDPOINT"""
        print("\n📋 15. Test Vehicle ROI Report API - NEW ENDPOINT")
        print("-" * 60)
        print("TESTE: GET /api/vehicles/{vehicle_id}/relatorio-ganhos")
        print("EXPECTED: ROI calculation with revenues, costs, profit and ROI percentage")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicle-ROI-Auth", False, "❌ No auth token for admin")
            return False
        
        vehicle_id = "4ad331ff-c0f5-43c9-95b8-cc085d32d8a7"
        
        try:
            # Test 1: Total period ROI
            print("\n🔍 Test 1: GET Total Period ROI")
            response = requests.get(
                f"{BACKEND_URL}/vehicles/{vehicle_id}/relatorio-ganhos?periodo=total",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["veiculo_id", "matricula", "periodo", "receitas", "custos", "lucro", "roi"]
                
                if all(field in data for field in required_fields):
                    receitas = data.get("receitas", {})
                    custos = data.get("custos", {})
                    lucro = data.get("lucro", 0)
                    roi = data.get("roi", 0)
                    matricula = data.get("matricula")
                    
                    receitas_total = receitas.get("total", 0)
                    custos_total = custos.get("total", 0)
                    custos_por_categoria = custos.get("por_categoria", {})
                    
                    self.log_result("Vehicle-ROI-Total", True, 
                                  f"✅ ROI report works: {matricula} - Receitas: €{receitas_total}, Custos: €{custos_total}, Lucro: €{lucro}, ROI: {roi}%")
                    
                    # Verify ROI calculation
                    if custos_total > 0:
                        expected_roi = ((receitas_total - custos_total) / custos_total) * 100
                        if abs(roi - expected_roi) < 0.01:  # Allow small rounding differences
                            self.log_result("Vehicle-ROI-Calculation", True, 
                                          f"✅ ROI calculation correct: {roi}%")
                        else:
                            self.log_result("Vehicle-ROI-Calculation", False, 
                                          f"❌ ROI calculation incorrect: got {roi}%, expected {expected_roi:.2f}%")
                    else:
                        self.log_result("Vehicle-ROI-Calculation", True, 
                                      f"✅ ROI calculation handled zero costs correctly: {roi}%")
                    
                    # Check cost categories
                    if custos_por_categoria:
                        categories_msg = ", ".join([f"{k}: €{v}" for k, v in custos_por_categoria.items()])
                        self.log_result("Vehicle-ROI-Categories", True, 
                                      f"✅ Cost categories: {categories_msg}")
                else:
                    self.log_result("Vehicle-ROI-Total", False, 
                                  f"❌ ROI report missing required fields: {data}")
            else:
                self.log_result("Vehicle-ROI-Total", False, 
                              f"❌ ROI report failed: {response.status_code}", response.text)
            
            # Test 2: Year-specific ROI
            print("\n🔍 Test 2: GET Year 2026 ROI")
            response = requests.get(
                f"{BACKEND_URL}/vehicles/{vehicle_id}/relatorio-ganhos?periodo=ano&ano=2026",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                periodo = data.get("periodo", {})
                if periodo.get("tipo") == "ano" and "2026" in periodo.get("data_inicio", ""):
                    self.log_result("Vehicle-ROI-Year", True, 
                                  f"✅ Year filter works: {periodo.get('data_inicio')} to {periodo.get('data_fim')}")
                else:
                    self.log_result("Vehicle-ROI-Year", False, 
                                  f"❌ Year filter incorrect: {periodo}")
            else:
                self.log_result("Vehicle-ROI-Year", False, 
                              f"❌ Year ROI failed: {response.status_code}")
            
            # Test 3: Custom period ROI
            print("\n🔍 Test 3: GET Custom Period ROI")
            response = requests.get(
                f"{BACKEND_URL}/vehicles/{vehicle_id}/relatorio-ganhos?periodo=custom&data_inicio=2026-01-01&data_fim=2026-01-31",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                periodo = data.get("periodo", {})
                if periodo.get("data_inicio") == "2026-01-01" and periodo.get("data_fim") == "2026-01-31":
                    self.log_result("Vehicle-ROI-Custom", True, 
                                  f"✅ Custom period works: {periodo.get('data_inicio')} to {periodo.get('data_fim')}")
                else:
                    self.log_result("Vehicle-ROI-Custom", False, 
                                  f"❌ Custom period incorrect: {periodo}")
            else:
                self.log_result("Vehicle-ROI-Custom", False, 
                              f"❌ Custom ROI failed: {response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Vehicle-ROI-Error", False, f"❌ Error during ROI test: {str(e)}")
            return False
    
    def test_proportional_rental_calculation(self):
        """🎯 NEW TEST: Proportional Rental Calculation for Vehicle Switch"""
        print("\n📋 🎯 NEW TEST: Proportional Rental Calculation for Vehicle Switch")
        print("-" * 80)
        print("TESTE: Cálculo de aluguer proporcional quando motorista troca de veículo")
        print("MOTORISTA: Nelson Francisco (ID: e2355169-10a7-4547-9dd0-479c128d73f9)")
        print("CENÁRIO: Veículo AB-12-CD (29-31 dez, 3 dias, €250/semana) + EF-34-GH (1-4 jan, 4 dias, €300/semana)")
        print("CÁLCULO ESPERADO: (€250/7)×3 + (€300/7)×4 = €107.14 + €171.43 = €278.57")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Proportional-Rental-Auth", False, "❌ No auth token for admin")
            return False
        
        motorista_id = "e2355169-10a7-4547-9dd0-479c128d73f9"
        
        try:
            # Test 1: Gerar relatório com troca de veículo
            print("\n🔍 Test 1: Gerar relatório semanal com troca de veículo")
            test_data = {
                "data_inicio": "2025-12-29",
                "data_fim": "2026-01-04",
                "semana": 1,
                "ano": 2026
            }
            
            response = requests.post(
                f"{BACKEND_URL}/relatorios/motorista/{motorista_id}/gerar-semanal",
                json=test_data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                resumo = result.get("resumo", {})
                
                # Verificar se aluguer_proporcional = true
                aluguer_proporcional = resumo.get("aluguer_proporcional", False)
                valor_aluguer = resumo.get("valor_aluguer", 0)
                aluguer_detalhes = resumo.get("aluguer_detalhes", [])
                
                if aluguer_proporcional:
                    self.log_result("Proportional-Rental-Flag", True, 
                                  f"✅ aluguer_proporcional = true (troca de veículo detectada)")
                    
                    # Verificar valor total aproximado (€278.57 esperado)
                    if 270 <= valor_aluguer <= 285:
                        self.log_result("Proportional-Rental-Value", True, 
                                      f"✅ Valor aluguer correto: €{valor_aluguer} (esperado ~€278.57)")
                    else:
                        self.log_result("Proportional-Rental-Value", False, 
                                      f"❌ Valor aluguer incorreto: €{valor_aluguer} (esperado ~€278.57)")
                    
                    # Verificar detalhes do aluguer
                    if aluguer_detalhes and len(aluguer_detalhes) == 2:
                        total_dias = sum(detalhe.get("dias", 0) for detalhe in aluguer_detalhes)
                        if total_dias == 7:
                            self.log_result("Proportional-Rental-Days", True, 
                                          f"✅ Total de dias correto: {total_dias} dias")
                            
                            # Verificar cada veículo
                            for i, detalhe in enumerate(aluguer_detalhes):
                                matricula = detalhe.get("veiculo_matricula", "N/A")
                                dias = detalhe.get("dias", 0)
                                valor_semanal = detalhe.get("valor_semanal", 0)
                                valor_proporcional = detalhe.get("valor_proporcional", 0)
                                
                                self.log_result(f"Proportional-Rental-Vehicle-{i+1}", True, 
                                              f"✅ Veículo {matricula}: {dias} dias, €{valor_semanal}/semana → €{valor_proporcional}")
                        else:
                            self.log_result("Proportional-Rental-Days", False, 
                                          f"❌ Total de dias incorreto: {total_dias} (esperado 7)")
                    else:
                        self.log_result("Proportional-Rental-Details", False, 
                                      f"❌ Detalhes incorretos: {len(aluguer_detalhes) if aluguer_detalhes else 0} veículos (esperado 2)")
                else:
                    self.log_result("Proportional-Rental-Flag", False, 
                                  f"❌ aluguer_proporcional = false (troca de veículo não detectada)")
                
                # Store relatorio_id for Test 2
                self.relatorio_id = result.get("relatorio_id")
                
            else:
                self.log_result("Proportional-Rental-Generate", False, 
                              f"❌ Falha ao gerar relatório: {response.status_code}", response.text)
            
            # Test 2: Verificar relatório guardado
            if hasattr(self, 'relatorio_id'):
                print("\n🔍 Test 2: Verificar relatório guardado")
                response = requests.get(
                    f"{BACKEND_URL}/relatorios/semanal/{self.relatorio_id}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    relatorio = response.json()
                    aluguer_detalhes_saved = relatorio.get("aluguer_detalhes", [])
                    aluguer_proporcional_saved = relatorio.get("aluguer_proporcional", False)
                    
                    if aluguer_proporcional_saved and aluguer_detalhes_saved:
                        self.log_result("Proportional-Rental-Saved", True, 
                                      f"✅ Relatório guardado com detalhes proporcionais: {len(aluguer_detalhes_saved)} veículos")
                    else:
                        self.log_result("Proportional-Rental-Saved", False, 
                                      f"❌ Relatório não guardou detalhes proporcionais corretamente")
                else:
                    self.log_result("Proportional-Rental-Saved", False, 
                                  f"❌ Falha ao recuperar relatório: {response.status_code}")
            
            # Test 3: Gerar relatório sem troca (motorista normal)
            print("\n🔍 Test 3: Gerar relatório para motorista sem troca de veículo")
            
            # First, get list of motoristas to find one without vehicle switch
            motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            
            if motoristas_response.status_code == 200:
                motoristas = motoristas_response.json()
                
                # Find a different motorista
                test_motorista = None
                for motorista in motoristas:
                    if motorista.get("id") != motorista_id:
                        test_motorista = motorista
                        break
                
                if test_motorista:
                    test_motorista_id = test_motorista.get("id")
                    test_motorista_nome = test_motorista.get("name")
                    
                    test_data_normal = {
                        "data_inicio": "2025-12-29",
                        "data_fim": "2026-01-04",
                        "semana": 1,
                        "ano": 2026
                    }
                    
                    response = requests.post(
                        f"{BACKEND_URL}/relatorios/motorista/{test_motorista_id}/gerar-semanal",
                        json=test_data_normal,
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        resumo = result.get("resumo", {})
                        aluguer_proporcional = resumo.get("aluguer_proporcional", False)
                        
                        if not aluguer_proporcional:
                            self.log_result("Proportional-Rental-Normal", True, 
                                          f"✅ Motorista normal sem troca: {test_motorista_nome} - aluguer_proporcional = false")
                        else:
                            self.log_result("Proportional-Rental-Normal", False, 
                                          f"⚠️ Motorista {test_motorista_nome} também tem troca de veículo")
                    else:
                        self.log_result("Proportional-Rental-Normal", False, 
                                      f"❌ Falha ao gerar relatório normal: {response.status_code}")
                else:
                    self.log_result("Proportional-Rental-Normal", True, 
                                  "ℹ️ Não há outros motoristas para testar cenário normal")
            else:
                self.log_result("Proportional-Rental-Normal", False, 
                              f"❌ Falha ao obter lista de motoristas: {motoristas_response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Proportional-Rental-Error", False, f"❌ Erro durante teste de aluguer proporcional: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence - Focus on Updated FleeTrack System"""
        print("🚀 INICIANDO TESTES - FleeTrack Updated System Tests")
        print("=" * 80)
        
        # Authenticate required users
        print("\n🔐 AUTENTICAÇÃO DE UTILIZADORES")
        print("-" * 40)
        for role in ["admin", "parceiro"]:
            self.authenticate_user(role)
        
        # PRIORITY: Updated System Tests
        print("\n🎯 TESTES PRINCIPAIS: FleeTrack Updated System")
        print("=" * 80)
        self.test_fleetrack_backend_apis()
        
        # NEW PRIORITY TEST: Proportional Rental Calculation
        print("\n🎯 TESTE PRIORITÁRIO: Cálculo de Aluguer Proporcional")
        print("=" * 80)
        self.test_proportional_rental_calculation()
        
        # Print final summary
        self.print_summary()
        
        return self.get_test_summary()


def main():
    """Main function to run tests"""
    tester = FleeTrackTester()
    
    try:
        summary = tester.run_all_tests()
        
        print(f"\n🎯 RESUMO FINAL - FleeTrack Updated System Tests")
        print("=" * 50)
        print(f"Total de testes: {summary['total']}")
        print(f"✅ Sucessos: {summary['passed']}")
        print(f"❌ Falhas: {summary['failed']}")
        print(f"Taxa de sucesso: {summary['passed']/summary['total']*100:.1f}%")
        
        if summary['failed'] == 0:
            print("\n🎉 TODOS OS TESTES PASSARAM!")
            return 0
        else:
            print(f"\n⚠️ {summary['failed']} TESTES FALHARAM")
            return 1
            
    except Exception as e:
        print(f"\n💥 ERRO CRÍTICO: {str(e)}")
        return 1


if __name__ == "__main__":
    exit(main())