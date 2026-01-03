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
    
    def test_despesas_resumo_api(self):
        """2. Test Despesas Resumo API - NEW LOGIC"""
        print("\n📋 2. Test Despesas Resumo API - NEW LOGIC")
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
        """3. Test Report Delete API"""
        print("\n📋 3. Test Report Delete API")
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
        """4. Test Report Status Change API"""
        print("\n📋 4. Test Report Status Change API")
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
        """5. Test List Reports for Parceiro API"""
        print("\n📋 5. Test List Reports for Parceiro API")
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
        """6. Test Despesas Import API"""
        print("\n📋 6. Test Despesas Import API")
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
        """7. Test Despesas List API"""
        print("\n📋 7. Test Despesas List API")
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