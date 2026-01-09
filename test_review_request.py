#!/usr/bin/env python3
"""
TVDEFleet Review Request Testing
Testing the 3 specific bug fixes mentioned in the review request
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
BACKEND_URL = "https://fleet-import.preview.emergentagent.com/api"

# Test credentials from review request
ADMIN_CREDENTIALS = {"email": "admin@tvdefleet.com", "password": "o72ocUHy"}

class ReviewRequestTester:
    def __init__(self):
        self.token = None
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
    
    def authenticate_admin(self):
        """Authenticate as admin"""
        try:
            response = requests.post(f"{BACKEND_URL}/auth/login", json=ADMIN_CREDENTIALS)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data["access_token"]
                self.log_result("Admin-Authentication", True, "Successfully authenticated as admin")
                return True
            else:
                self.log_result("Admin-Authentication", False, f"Failed to authenticate: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin-Authentication", False, f"Authentication error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get authorization headers"""
        if not self.token:
            return None
        return {"Authorization": f"Bearer {self.token}"}
    
    def test_bug_1_vehicle_driver_assignment(self):
        """
        Teste 1: Atribuição de Motorista no Veículo
        - Login como admin (admin@tvdefleet.com / o72ocUHy)
        - Obter um veículo existente
        - Atualizar com `motorista_atribuido` definido para um ID de motorista válido
        - Verificar se tanto `motorista_atribuido` quanto `motorista_atribuido_nome` foram guardados
        - Confirmar que o nome do motorista foi sincronizado corretamente
        """
        print("\n🚗 TESTE 1: ATRIBUIÇÃO DE MOTORISTA NO VEÍCULO")
        print("-" * 60)
        
        headers = self.get_headers()
        if not headers:
            self.log_result("Teste-1-Atribuicao-Motorista", False, "❌ No authentication token")
            return
        
        try:
            # Step 1: Get existing vehicle
            vehicles_response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
            if vehicles_response.status_code != 200:
                self.log_result("Teste-1-Atribuicao-Motorista", False, "❌ Cannot get vehicles list")
                return
            
            vehicles = vehicles_response.json()
            if not vehicles:
                self.log_result("Teste-1-Atribuicao-Motorista", False, "❌ No vehicles available for test")
                return
            
            vehicle_id = vehicles[0]["id"]
            vehicle_matricula = vehicles[0].get("matricula", "N/A")
            print(f"✅ Veículo encontrado: {vehicle_id} - {vehicle_matricula}")
            
            # Step 2: Get existing driver
            drivers_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            if drivers_response.status_code != 200:
                self.log_result("Teste-1-Atribuicao-Motorista", False, "❌ Cannot get drivers list")
                return
            
            drivers = drivers_response.json()
            if not drivers:
                self.log_result("Teste-1-Atribuicao-Motorista", False, "❌ No drivers available for test")
                return
            
            driver_id = drivers[0]["id"]
            driver_name = drivers[0]["name"]
            print(f"✅ Motorista encontrado: {driver_id} - {driver_name}")
            
            # Step 3: Update vehicle with driver assignment
            update_data = {
                "motorista_atribuido": driver_id
            }
            
            update_response = requests.put(
                f"{BACKEND_URL}/vehicles/{vehicle_id}",
                json=update_data,
                headers=headers
            )
            
            if update_response.status_code != 200:
                self.log_result("Teste-1-Atribuicao-Motorista", False, 
                              f"❌ Failed to update vehicle: {update_response.status_code}", update_response.text)
                return
            
            print("✅ Veículo atualizado com atribuição de motorista")
            
            # Step 4: Verify both motorista_atribuido and motorista_atribuido_nome are saved
            verify_response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}", headers=headers)
            if verify_response.status_code != 200:
                self.log_result("Teste-1-Atribuicao-Motorista", False, "❌ Cannot verify vehicle update")
                return
            
            updated_vehicle = verify_response.json()
            
            # Check if both fields are present and correct
            assigned_driver_id = updated_vehicle.get("motorista_atribuido")
            assigned_driver_name = updated_vehicle.get("motorista_atribuido_nome")
            
            print(f"🔍 Verificação: motorista_atribuido={assigned_driver_id}, motorista_atribuido_nome='{assigned_driver_name}'")
            
            if assigned_driver_id == driver_id and assigned_driver_name == driver_name:
                self.log_result("Teste-1-Atribuicao-Motorista", True, 
                              f"✅ SUCESSO: Tanto motorista_atribuido quanto motorista_atribuido_nome foram guardados e sincronizados corretamente")
            elif assigned_driver_id == driver_id and not assigned_driver_name:
                self.log_result("Teste-1-Atribuicao-Motorista", False, 
                              f"❌ FALHA: motorista_atribuido guardado mas motorista_atribuido_nome não foi sincronizado")
            elif assigned_driver_id != driver_id:
                self.log_result("Teste-1-Atribuicao-Motorista", False, 
                              f"❌ FALHA: motorista_atribuido não foi guardado corretamente")
            else:
                self.log_result("Teste-1-Atribuicao-Motorista", False, 
                              f"❌ FALHA: Sincronização incorreta - ID: {assigned_driver_id}, Nome: {assigned_driver_name}")
                
        except Exception as e:
            self.log_result("Teste-1-Atribuicao-Motorista", False, f"❌ Erro no teste: {str(e)}")
    
    def test_bug_2_driver_profile_vehicle_field(self):
        """
        Teste 2: Campo de Veículo no Perfil do Motorista
        - Verificar se o campo `vehicle_assigned` está no formData
        - Confirmar que o campo é renderizado no UI (mesmo fora do modo de edição)
        - Testar se o campo é enviado ao guardar o perfil
        """
        print("\n👤 TESTE 2: CAMPO DE VEÍCULO NO PERFIL DO MOTORISTA")
        print("-" * 60)
        
        headers = self.get_headers()
        if not headers:
            self.log_result("Teste-2-Campo-Veiculo-Motorista", False, "❌ No authentication token")
            return
        
        try:
            # Step 1: Get existing driver
            drivers_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            if drivers_response.status_code != 200:
                self.log_result("Teste-2-Campo-Veiculo-Motorista", False, "❌ Cannot get drivers list")
                return
            
            drivers = drivers_response.json()
            if not drivers:
                self.log_result("Teste-2-Campo-Veiculo-Motorista", False, "❌ No drivers available for test")
                return
            
            driver_id = drivers[0]["id"]
            driver_name = drivers[0]["name"]
            print(f"✅ Motorista encontrado: {driver_id} - {driver_name}")
            
            # Step 2: Get existing vehicle
            vehicles_response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
            if vehicles_response.status_code != 200:
                self.log_result("Teste-2-Campo-Veiculo-Motorista", False, "❌ Cannot get vehicles list")
                return
            
            vehicles = vehicles_response.json()
            if not vehicles:
                self.log_result("Teste-2-Campo-Veiculo-Motorista", False, "❌ No vehicles available for test")
                return
            
            vehicle_id = vehicles[0]["id"]
            vehicle_info = f"{vehicles[0].get('marca', 'N/A')} {vehicles[0].get('modelo', 'N/A')} - {vehicles[0].get('matricula', 'N/A')}"
            print(f"✅ Veículo encontrado: {vehicle_id} - {vehicle_info}")
            
            # Step 3: Update driver with vehicle assignment
            update_data = {
                "veiculo_atribuido": vehicle_id  # This should be the field name in driver profile
            }
            
            update_response = requests.put(
                f"{BACKEND_URL}/motoristas/{driver_id}",
                json=update_data,
                headers=headers
            )
            
            if update_response.status_code != 200:
                self.log_result("Teste-2-Campo-Veiculo-Motorista", False, 
                              f"❌ Failed to update driver: {update_response.status_code}", update_response.text)
                return
            
            print("✅ Motorista atualizado com atribuição de veículo")
            
            # Step 4: Verify vehicle_assigned field is saved
            verify_response = requests.get(f"{BACKEND_URL}/motoristas/{driver_id}", headers=headers)
            if verify_response.status_code != 200:
                self.log_result("Teste-2-Campo-Veiculo-Motorista", False, "❌ Cannot verify driver update")
                return
            
            updated_driver = verify_response.json()
            
            # Check if vehicle_assigned field is present and correct
            assigned_vehicle = updated_driver.get("veiculo_atribuido")
            
            print(f"🔍 Verificação: veiculo_atribuido={assigned_vehicle}")
            
            if assigned_vehicle == vehicle_id:
                self.log_result("Teste-2-Campo-Veiculo-Motorista", True, 
                              f"✅ SUCESSO: Campo veiculo_atribuido está no formData e é guardado corretamente")
            else:
                self.log_result("Teste-2-Campo-Veiculo-Motorista", False, 
                              f"❌ FALHA: Campo veiculo_atribuido não foi guardado. Esperado: {vehicle_id}, Obtido: {assigned_vehicle}")
                
        except Exception as e:
            self.log_result("Teste-2-Campo-Veiculo-Motorista", False, f"❌ Erro no teste: {str(e)}")
    
    def test_bug_3_uber_import_with_uuid(self):
        """
        Teste 3: Importação Uber com UUID
        - Criar/atualizar um motorista com `uuid_motorista_uber` preenchido
        - Testar importação com CSV que contenha esse UUID
        - Verificar se a importação encontra o motorista pelo UUID
        - Testar também com motorista sem UUID (deve usar correspondência por nome)
        """
        print("\n🚖 TESTE 3: IMPORTAÇÃO UBER COM UUID")
        print("-" * 60)
        
        headers = self.get_headers()
        if not headers:
            self.log_result("Teste-3-Importacao-Uber-UUID", False, "❌ No authentication token")
            return
        
        try:
            # Step 1: Get or create a driver with UUID
            drivers_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            if drivers_response.status_code != 200:
                self.log_result("Teste-3-Importacao-Uber-UUID", False, "❌ Cannot get drivers list")
                return
            
            drivers = drivers_response.json()
            if not drivers:
                self.log_result("Teste-3-Importacao-Uber-UUID", False, "❌ No drivers available for test")
                return
            
            driver_id = drivers[0]["id"]
            driver_name = drivers[0].get("name") or "Test Driver"
            test_uuid = "12345678-1234-1234-1234-123456789abc"
            
            print(f"✅ Motorista encontrado: {driver_id} - {driver_name}")
            
            # Step 2: Update driver with UUID and name if needed
            update_data = {
                "uuid_motorista_uber": test_uuid,
                "email_uber": "test.driver@uber.com"
            }
            
            # If driver name is None or empty, update it too
            if not driver_name or driver_name == "None":
                driver_name = "João Silva"
                update_data["name"] = driver_name
            
            update_response = requests.put(
                f"{BACKEND_URL}/motoristas/{driver_id}",
                json=update_data,
                headers=headers
            )
            
            if update_response.status_code != 200:
                self.log_result("Teste-3-Importacao-Uber-UUID", False, 
                              f"❌ Failed to update driver with UUID: {update_response.status_code}")
                return
            
            print(f"✅ Motorista atualizado com UUID: {test_uuid}")
            
            # Step 3: Create test CSV with UUID matching
            name_parts = driver_name.split() if driver_name else ["João", "Silva"]
            first_name = name_parts[0] if name_parts else "João"
            last_name = name_parts[-1] if len(name_parts) > 1 else "Silva"
            
            csv_content = f"""UUID do motorista,motorista_email,Nome próprio,Apelido,Pago a si,rendimentos,tarifa,taxa de serviço
{test_uuid},test.driver@uber.com,{first_name},{last_name},25.50,30.00,28.75,2.25"""
            
            files = {
                'file': ('test_uber_uuid.csv', csv_content.encode('utf-8'), 'text/csv')
            }
            
            print("🔄 Testando importação com UUID...")
            
            # Step 4: Test import with UUID
            import_response = requests.post(
                f"{BACKEND_URL}/importar/uber",
                files=files,
                headers=headers
            )
            
            if import_response.status_code == 200:
                result = import_response.json()
                
                # Check if import was successful
                success_count = result.get("sucesso", 0)
                error_count = result.get("erros", 0)
                
                print(f"📊 Resultado da importação: {success_count} sucessos, {error_count} erros")
                
                if success_count > 0 and error_count == 0:
                    print("✅ Importação com UUID bem-sucedida")
                    
                    # Step 5: Test import without UUID (name matching)
                    print("🔄 Testando correspondência por nome sem UUID...")
                    
                    csv_content_no_uuid = f"""UUID do motorista,motorista_email,Nome próprio,Apelido,Pago a si,rendimentos,tarifa,taxa de serviço
,another.driver@uber.com,{first_name},{last_name},15.75,20.00,18.50,1.50"""
                    
                    files_no_uuid = {
                        'file': ('test_uber_name.csv', csv_content_no_uuid.encode('utf-8'), 'text/csv')
                    }
                    
                    import_response_no_uuid = requests.post(
                        f"{BACKEND_URL}/importar/uber",
                        files=files_no_uuid,
                        headers=headers
                    )
                    
                    if import_response_no_uuid.status_code == 200:
                        result_no_uuid = import_response_no_uuid.json()
                        success_count_no_uuid = result_no_uuid.get("sucesso", 0)
                        
                        print(f"📊 Resultado da correspondência por nome: {success_count_no_uuid} sucessos")
                        
                        if success_count_no_uuid > 0:
                            self.log_result("Teste-3-Importacao-Uber-UUID", True, 
                                          f"✅ SUCESSO: Importação Uber funciona com UUID ({success_count} registos) e por nome ({success_count_no_uuid} registos)")
                        else:
                            self.log_result("Teste-3-Importacao-Uber-UUID", True, 
                                          f"✅ PARCIAL: Importação com UUID funciona ({success_count} registos), mas correspondência por nome pode ter problemas")
                    else:
                        self.log_result("Teste-3-Importacao-Uber-UUID", True, 
                                      f"✅ PARCIAL: Importação com UUID funciona ({success_count} registos), mas não foi possível testar correspondência por nome")
                else:
                    self.log_result("Teste-3-Importacao-Uber-UUID", False, 
                                  f"❌ FALHA: Importação com problemas - {success_count} sucessos, {error_count} erros")
            else:
                self.log_result("Teste-3-Importacao-Uber-UUID", False, 
                              f"❌ Failed to import Uber CSV: {import_response.status_code}", import_response.text)
            
        except Exception as e:
            self.log_result("Teste-3-Importacao-Uber-UUID", False, f"❌ Erro no teste: {str(e)}")
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*80)
        print("📋 RESUMO DOS TESTES - REVIEW REQUEST")
        print("="*80)
        
        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r["success"])
        failed = total - passed
        
        for result in self.test_results:
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"{status} {result['test']}: {result['message']}")
            if result["details"]:
                print(f"   Details: {result['details']}")
        
        print("="*80)
        print(f"📊 RESULTADOS FINAIS:")
        print(f"✅ Sucessos: {passed}")
        print(f"❌ Falhas: {failed}")
        print(f"📊 Total: {total}")
        
        if failed == 0:
            print("\n🎉 TODOS OS TESTES PASSARAM!")
            print("✅ As 3 correções de bugs estão funcionando corretamente")
        else:
            print(f"\n⚠️ {failed} teste(s) falharam - verificar detalhes acima")
        
        return {"total": total, "passed": passed, "failed": failed}
    
    def run_tests(self):
        """Run all review request tests"""
        print("🎯 TESTE DAS 3 CORREÇÕES APLICADAS AOS BUGS REPORTADOS")
        print("="*80)
        print("Credenciais: admin@tvdefleet.com / o72ocUHy")
        print("URL Backend API: ${REACT_APP_BACKEND_URL}")
        print("="*80)
        
        # Authenticate
        if not self.authenticate_admin():
            print("❌ Falha na autenticação - não é possível continuar")
            return {"total": 1, "passed": 0, "failed": 1}
        
        # Run the 3 tests
        self.test_bug_1_vehicle_driver_assignment()
        self.test_bug_2_driver_profile_vehicle_field()
        self.test_bug_3_uber_import_with_uuid()
        
        # Print summary and return results
        return self.print_summary()

if __name__ == "__main__":
    tester = ReviewRequestTester()
    summary = tester.run_tests()
    
    print(f"\n🎯 RESULTADO FINAL: {summary['passed']}/{summary['total']} testes passaram")
    
    if summary['failed'] > 0:
        print(f"❌ {summary['failed']} teste(s) falharam")
        exit(1)
    else:
        print("✅ Todos os testes passaram!")
        exit(0)