#!/usr/bin/env python3
"""
FleeTrack Backend Testing Suite - CSV Import for Despesas (Via Verde)
Tests for new CSV Import feature for Via Verde expenses with automatic association
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
import csv

# Get backend URL from frontend .env
BACKEND_URL = "https://fleetmanager-24.preview.emergentagent.com/api"

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
    
    def test_fleetrack_backend_apis(self):
        """🎯 MAIN TEST: FleeTrack Updated System Tests"""
        print("\n🎯 MAIN TEST: FleeTrack Updated System Tests")
        print("=" * 80)
        print("CREDENCIAIS:")
        print("- Admin: admin@tvdefleet.com / 123456")
        print("- Parceiro: parceiro@tvdefleet.com / 123456")
        print("\nTESTES A REALIZAR:")
        print("1. Authentication API")
        print("2. Despesas Resumo API - GET /api/despesas/resumo (NEW LOGIC)")
        print("3. Report Delete API - DELETE /api/relatorios/semanal/{id}")
        print("4. Report Status Change API - PUT /api/relatorios/semanal/{id}/status")
        print("5. List Reports for Parceiro - GET /api/relatorios/semanais-todos")
        print("6. CSV Import API - POST /api/despesas/importar")
        print("7. List Despesas API - GET /api/despesas/")
        print("=" * 80)
        
        # Execute all tests
        self.test_authentication_api()
        self.test_despesas_resumo_api()
        self.test_relatorios_delete_api()
        self.test_relatorios_status_change_api()
        self.test_relatorios_list_parceiro_api()
        self.test_despesas_import_api()
        self.test_despesas_list_api()
        
        return True
    
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
    
    def test_despesas_preview_api(self):
        """2. Test Despesas Preview API"""
        print("\n📋 2. Test Despesas Preview API")
        print("-" * 60)
        print("TESTE: POST /api/despesas/preview")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Despesas-Preview-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            # Create test CSV file
            csv_file_path = self.create_test_csv_file()
            
            with open(csv_file_path, 'rb') as f:
                files = {'file': ('test_via_verde.csv', f, 'text/csv')}
                response = requests.post(f"{BACKEND_URL}/despesas/preview", files=files, headers=headers)
            
            # Clean up
            os.unlink(csv_file_path)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["nome_ficheiro", "total_registos", "colunas", "colunas_identificadas", "matriculas_unicas"]
                
                if all(field in data for field in required_fields):
                    matriculas_count = len(data.get("matriculas_unicas", []))
                    total_registos = data.get("total_registos", 0)
                    self.log_result("Despesas-Preview", True, 
                                  f"✅ Preview API works: {total_registos} records, {matriculas_count} unique matriculas")
                else:
                    self.log_result("Despesas-Preview", False, 
                                  f"❌ Preview response missing required fields: {data}")
            else:
                self.log_result("Despesas-Preview", False, 
                              f"❌ Preview API failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("Despesas-Preview-Error", False, f"❌ Error during preview test: {str(e)}")
            return False
    
    def test_despesas_import_api(self):
        """3. Test Despesas Import API"""
        print("\n📋 3. Test Despesas Import API")
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
                    self.log_result("Despesas-Import", True, 
                                  f"✅ Import API works: {imported}/{total} records imported, {vehicles_found} vehicles found")
                    
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
        """4. Test Despesas List API"""
        print("\n📋 4. Test Despesas List API")
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
                            self.log_result("Despesas-List", True, 
                                          f"✅ List API works: {len(despesas)} despesas returned, {total} total")
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
    
    def test_despesas_resumo_api(self):
        """5. Test Despesas Resumo API"""
        print("\n📋 5. Test Despesas Resumo API")
        print("-" * 60)
        print("TESTE: GET /api/despesas/resumo")
        
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
                    
                    self.log_result("Despesas-Resumo", True, 
                                  f"✅ Resumo API works: €{total_geral} total, {total_registos} records, {len(por_responsavel)} responsibility types")
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
    
    def test_despesas_importacoes_api(self):
        """6. Test Despesas Import History API"""
        print("\n📋 6. Test Despesas Import History API")
        print("-" * 60)
        print("TESTE: GET /api/despesas/importacoes")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Despesas-Importacoes-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            response = requests.get(f"{BACKEND_URL}/despesas/importacoes", headers=headers)
            
            if response.status_code == 200:
                importacoes = response.json()
                
                if isinstance(importacoes, list):
                    if importacoes:
                        first_import = importacoes[0]
                        required_fields = ["id", "nome_ficheiro", "tipo_fornecedor", "status", "total_registos"]
                        
                        if all(field in first_import for field in required_fields):
                            self.log_result("Despesas-Importacoes", True, 
                                          f"✅ Import history API works: {len(importacoes)} imports found")
                        else:
                            self.log_result("Despesas-Importacoes", False, 
                                          f"❌ Import records missing required fields: {first_import}")
                    else:
                        self.log_result("Despesas-Importacoes", True, 
                                      f"✅ Import history API works: No imports found (normal if no imports)")
                else:
                    self.log_result("Despesas-Importacoes", False, 
                                  f"❌ Import history response not a list: {importacoes}")
            else:
                self.log_result("Despesas-Importacoes", False, 
                              f"❌ Import history API failed: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_result("Despesas-Importacoes-Error", False, f"❌ Error during import history test: {str(e)}")
            return False
    
    def test_despesas_por_veiculo_api(self):
        """7. Test Despesas By Vehicle API"""
        print("\n📋 7. Test Despesas By Vehicle API")
        print("-" * 60)
        print("TESTE: GET /api/despesas/por-veiculo/{id}")
        
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Despesas-ByVehicle-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            # First get a vehicle ID
            vehicles_response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
            
            if vehicles_response.status_code == 200:
                vehicles = vehicles_response.json()
                
                if vehicles:
                    test_vehicle = vehicles[0]
                    vehicle_id = test_vehicle['id']
                    vehicle_info = f"{test_vehicle.get('marca', 'N/A')} {test_vehicle.get('modelo', 'N/A')} - {test_vehicle.get('matricula', 'N/A')}"
                    
                    # Test expenses for this vehicle
                    response = requests.get(f"{BACKEND_URL}/despesas/por-veiculo/{vehicle_id}", headers=headers)
                    
                    if response.status_code == 200:
                        data = response.json()
                        required_fields = ["despesas", "resumo"]
                        
                        if all(field in data for field in required_fields):
                            despesas = data.get("despesas", [])
                            resumo = data.get("resumo", {})
                            
                            self.log_result("Despesas-ByVehicle", True, 
                                          f"✅ By vehicle API works: {len(despesas)} expenses for {vehicle_info}")
                        else:
                            self.log_result("Despesas-ByVehicle", False, 
                                          f"❌ By vehicle response missing required fields: {data}")
                    else:
                        self.log_result("Despesas-ByVehicle", False, 
                                      f"❌ By vehicle API failed: {response.status_code}", response.text)
                else:
                    self.log_result("Despesas-ByVehicle", True, 
                                  "ℹ️ No vehicles to test by vehicle API (normal if database empty)")
            else:
                self.log_result("Despesas-ByVehicle", False, 
                              f"❌ Could not get vehicles for by vehicle test: {vehicles_response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Despesas-ByVehicle-Error", False, f"❌ Error during by vehicle test: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence - Focus on CSV Import for Despesas"""
        print("🚀 INICIANDO TESTES - FleeTrack CSV Import for Despesas (Via Verde)")
        print("=" * 80)
        
        # Authenticate required users
        print("\n🔐 AUTENTICAÇÃO DE UTILIZADORES")
        print("-" * 40)
        for role in ["admin"]:
            self.authenticate_user(role)
        
        # PRIORITY: CSV Import for Despesas Tests
        print("\n🎯 TESTES PRINCIPAIS: CSV Import for Despesas (Via Verde)")
        print("=" * 80)
        self.test_fleetrack_backend_apis()
        
        # Print final summary
        self.print_summary()
        
        return self.get_test_summary()


def main():
    """Main function to run tests"""
    tester = FleeTrackTester()
    
    try:
        summary = tester.run_all_tests()
        
        print(f"\n🎯 RESUMO FINAL - FleeTrack CSV Import for Despesas Tests")
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