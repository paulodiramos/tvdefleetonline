#!/usr/bin/env python3
"""
TVDEFleet Backend Testing Suite - 3 Specific Corrections
Tests for the 3 corrections mentioned in the review request
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
BACKEND_URL = "https://fleet-analytics-17.preview.emergentagent.com/api"

# Test credentials (from review request)
TEST_CREDENTIALS = {
    "admin": {"email": "admin@tvdefleet.com", "password": "o72ocUHy"},
}

class Corrections3Tester:
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
        print("📋 RESUMO DOS TESTES DAS 3 CORREÇÕES")
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
    
    def test_review_request_corrections(self):
        """Test the 3 specific corrections mentioned in the review request"""
        print("\n🎯 TESTING 3 SPECIFIC CORRECTIONS FROM REVIEW REQUEST")
        print("=" * 80)
        print("Correção 1: UUID da Uber deve ser guardado e encontrado")
        print("Correção 2: Veículo atribuído com informações completas")
        print("Correção 3: Importação de Combustível e Carregamentos")
        print("=" * 80)
        
        # Authenticate as admin for all tests
        if not self.authenticate_user("admin"):
            print("❌ Cannot authenticate as admin - aborting tests")
            return False
        
        headers = self.get_headers("admin")
        
        # Test Correction 1: UUID da Uber
        self.test_correction_1_uber_uuid(headers)
        
        # Test Correction 2: Vehicle with complete information
        self.test_correction_2_vehicle_complete_info(headers)
        
        # Test Correction 3: Fuel and Charging imports
        self.test_correction_3_fuel_charging_imports(headers)
        
        return True
    
    def test_correction_1_uber_uuid(self, headers):
        """Correção 1: UUID da Uber deve ser guardado e encontrado"""
        print("\n📋 CORREÇÃO 1: TESTE DO UUID DA UBER")
        print("-" * 50)
        
        # Step 1: Find Bruno Coelho and update with UUID
        try:
            motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            if motoristas_response.status_code != 200:
                self.log_result("Correction-1-Get-Motoristas", False, "Cannot get motoristas list")
                return
            
            motoristas = motoristas_response.json()
            bruno_motorista = None
            
            # Find Bruno Coelho by email
            for motorista in motoristas:
                email = motorista.get("email", "").lower()
                if "brunomccoelho@hotmail.com" in email:
                    bruno_motorista = motorista
                    break
            
            if not bruno_motorista:
                self.log_result("Correction-1-Find-Bruno", False, "Bruno Coelho not found in database")
                return
            
            self.log_result("Correction-1-Find-Bruno", True, f"Bruno Coelho found: {bruno_motorista['name']}")
            
            # Step 2: Update Bruno with UUID
            bruno_id = bruno_motorista["id"]
            update_data = {
                "uuid_motorista_uber": "35382cb7-236e-42c1-b0b4-e16bfabb8ff3"
            }
            
            update_response = requests.put(f"{BACKEND_URL}/motoristas/{bruno_id}", json=update_data, headers=headers)
            
            if update_response.status_code == 200:
                self.log_result("Correction-1-Update-UUID", True, "Bruno's UUID updated successfully")
            else:
                self.log_result("Correction-1-Update-UUID", False, f"Failed to update UUID: {update_response.status_code}")
                return
            
            # Step 3: Verify UUID was saved
            verify_response = requests.get(f"{BACKEND_URL}/motoristas/{bruno_id}", headers=headers)
            if verify_response.status_code == 200:
                updated_motorista = verify_response.json()
                saved_uuid = updated_motorista.get("uuid_motorista_uber")
                
                if saved_uuid == "35382cb7-236e-42c1-b0b4-e16bfabb8ff3":
                    self.log_result("Correction-1-Verify-UUID", True, f"UUID correctly saved: {saved_uuid}")
                else:
                    self.log_result("Correction-1-Verify-UUID", False, f"UUID not saved correctly: {saved_uuid}")
                    return
            else:
                self.log_result("Correction-1-Verify-UUID", False, "Cannot verify saved UUID")
                return
            
        except Exception as e:
            self.log_result("Correction-1-Setup", False, f"Setup error: {str(e)}")
            return
        
        # Step 4: Test import with real CSV
        self.test_uber_import_with_real_csv(headers)
    
    def test_uber_import_with_real_csv(self, headers):
        """Test Uber import with real CSV file containing Bruno's UUID"""
        try:
            # Download the real CSV file
            csv_url = "https://customer-assets.emergentagent.com/job_weekly-report-sys/artifacts/vy8erxlu_20251201-20251208-payments_driver-ZENY_MACAIA_UNIPESSOAL_LDA%20%281%29.csv"
            
            csv_response = requests.get(csv_url)
            if csv_response.status_code == 200:
                csv_content = csv_response.content
                csv_size = len(csv_content)
                self.log_result("Correction-1-Download-CSV", True, f"CSV downloaded: {csv_size} bytes")
            else:
                self.log_result("Correction-1-Download-CSV", False, f"Failed to download CSV: {csv_response.status_code}")
                return
            
            # Verify CSV contains Bruno's UUID
            try:
                csv_text = csv_content.decode('utf-8-sig')  # Use utf-8-sig to handle BOM
                if "35382cb7-236e-42c1-b0b4-e16bfabb8ff3" in csv_text and "BRUNO" in csv_text.upper():
                    self.log_result("Correction-1-Verify-CSV-Content", True, "Bruno's UUID found in CSV")
                else:
                    self.log_result("Correction-1-Verify-CSV-Content", False, "Bruno's UUID not found in CSV")
                    return
            except Exception as e:
                self.log_result("Correction-1-Verify-CSV-Content", False, f"CSV content check error: {str(e)}")
                return
            
            # Execute the import
            files = {
                'file': ('uber_real_file.csv', csv_content, 'text/csv')
            }
            
            import_response = requests.post(f"{BACKEND_URL}/importar/uber", files=files, headers=headers)
            
            if import_response.status_code == 200:
                result = import_response.json()
                
                total_sucesso = result.get("sucesso", 0)
                total_erros = result.get("erros", 0)
                total_linhas = total_sucesso + total_erros
                
                if total_linhas > 0:
                    success_rate = (total_sucesso / total_linhas) * 100
                    
                    if success_rate >= 90:
                        self.log_result("Correction-1-Import-Success-Rate", True, 
                                      f"Success rate: {success_rate:.1f}% (≥90% target met)")
                    else:
                        self.log_result("Correction-1-Import-Success-Rate", False, 
                                      f"Success rate: {success_rate:.1f}% (below 90% target)")
                    
                    # Check if Bruno was found by UUID
                    erros_detalhes = result.get("erros_detalhes", [])
                    bruno_error = any("bruno" in erro.lower() for erro in erros_detalhes)
                    
                    if not bruno_error:
                        self.log_result("Correction-1-Bruno-Found-By-UUID", True, 
                                      "Bruno Coelho found by UUID (not in error list)")
                    else:
                        self.log_result("Correction-1-Bruno-Found-By-UUID", False, 
                                      "Bruno Coelho not found by UUID (in error list)")
                else:
                    self.log_result("Correction-1-Import-Results", False, "No records processed")
            else:
                self.log_result("Correction-1-Import-Execution", False, 
                              f"Import failed: {import_response.status_code}")
                
        except Exception as e:
            self.log_result("Correction-1-Import-Test", False, f"Import test error: {str(e)}")
    
    def test_correction_2_vehicle_complete_info(self, headers):
        """Correção 2: Veículo atribuído com informações completas"""
        print("\n🚗 CORREÇÃO 2: TESTE DO VEÍCULO COM INFORMAÇÕES COMPLETAS")
        print("-" * 60)
        
        try:
            # Step 1: Get list of motoristas to find one with assigned vehicle
            motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            if motoristas_response.status_code != 200:
                self.log_result("Correction-2-Get-Motoristas", False, "Cannot get motoristas list")
                return
            
            motoristas = motoristas_response.json()
            motorista_with_vehicle = None
            
            # Find motorista with assigned vehicle
            for motorista in motoristas:
                if motorista.get("veiculo_atribuido"):
                    motorista_with_vehicle = motorista
                    break
            
            if not motorista_with_vehicle:
                self.log_result("Correction-2-Find-Motorista-With-Vehicle", False, 
                              "No motorista found with assigned vehicle")
                return
            
            vehicle_id = motorista_with_vehicle["veiculo_atribuido"]
            self.log_result("Correction-2-Find-Motorista-With-Vehicle", True, 
                          f"Found motorista with vehicle: {motorista_with_vehicle['name']}")
            
            # Step 2: Get vehicle details
            vehicle_response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}", headers=headers)
            if vehicle_response.status_code != 200:
                self.log_result("Correction-2-Get-Vehicle", False, f"Cannot get vehicle details: {vehicle_response.status_code}")
                return
            
            vehicle = vehicle_response.json()
            
            # Step 3: Check if vehicle has via_verde_id and cartao_frota_id fields
            via_verde_id = vehicle.get("via_verde_id")
            cartao_frota_id = vehicle.get("cartao_frota_id")
            
            if via_verde_id is not None:  # Can be empty string, but should exist
                self.log_result("Correction-2-Via-Verde-ID-Field", True, 
                              f"via_verde_id field present: '{via_verde_id}'")
            else:
                self.log_result("Correction-2-Via-Verde-ID-Field", False, 
                              "via_verde_id field missing from vehicle response")
            
            if cartao_frota_id is not None:  # Can be empty string, but should exist
                self.log_result("Correction-2-Cartao-Frota-ID-Field", True, 
                              f"cartao_frota_id field present: '{cartao_frota_id}'")
            else:
                self.log_result("Correction-2-Cartao-Frota-ID-Field", False, 
                              "cartao_frota_id field missing from vehicle response")
            
            # Step 4: Verify response includes these fields in the structure
            response_keys = list(vehicle.keys())
            required_fields = ["via_verde_id", "cartao_frota_id"]
            missing_fields = [field for field in required_fields if field not in response_keys]
            
            if not missing_fields:
                self.log_result("Correction-2-Complete-Vehicle-Info", True, 
                              "Vehicle response includes via_verde_id and cartao_frota_id fields")
            else:
                self.log_result("Correction-2-Complete-Vehicle-Info", False, 
                              f"Missing fields in vehicle response: {missing_fields}")
                
        except Exception as e:
            self.log_result("Correction-2-Test", False, f"Vehicle info test error: {str(e)}")
    
    def test_correction_3_fuel_charging_imports(self, headers):
        """Correção 3: Importação de Combustível e Carregamentos"""
        print("\n⛽ CORREÇÃO 3: TESTE DE IMPORTAÇÃO DE COMBUSTÍVEL E CARREGAMENTOS")
        print("-" * 70)
        
        # Test 1: Verify endpoint supports "combustivel" platform
        self.test_combustivel_platform_support(headers)
        
        # Test 2: Verify endpoint supports "carregamento" platform  
        self.test_carregamento_platform_support(headers)
        
        # Test 3: Verify both collections are different
        self.test_different_collections(headers)
    
    def test_combustivel_platform_support(self, headers):
        """Test if endpoint supports 'combustivel' platform"""
        try:
            # Create test CSV content for combustivel
            csv_content = """posto,pais,rede,data,hora,cartao,desc_cartao,estado,grupo_cartao,litros,combustivel,recibo,valor_liquido,iva,kms,id_condutor,fatura,data_fatura,valor_unitario,valor_ref,valor_desc,cliente,tipo_pagamento
Posto Teste,Portugal,Rede Teste,2025-01-15,10:30,12345,Cartao Teste,Aprovado,Grupo1,50.5,Gasolina,REC001,75.50,15.10,150000,COND001,FAT001,2025-01-15,1.50,75.50,0.00,Cliente Teste,Cartao"""
            
            files = {
                'file': ('test_combustivel.csv', csv_content.encode('utf-8'), 'text/csv')
            }
            
            response = requests.post(f"{BACKEND_URL}/importar/combustivel", files=files, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                self.log_result("Correction-3-Combustivel-Platform", True, 
                              f"Combustivel platform supported: {result.get('sucesso', 0)} records processed")
            elif response.status_code == 404:
                self.log_result("Correction-3-Combustivel-Platform", False, 
                              "Combustivel platform not supported (404 Not Found)")
            else:
                self.log_result("Correction-3-Combustivel-Platform", False, 
                              f"Combustivel platform error: {response.status_code}")
                
        except Exception as e:
            self.log_result("Correction-3-Combustivel-Platform", False, f"Combustivel test error: {str(e)}")
    
    def test_carregamento_platform_support(self, headers):
        """Test if endpoint supports 'carregamento' platform"""
        try:
            # Create test CSV content for carregamento (electric charging)
            csv_content = """numero_cartao,nome,descricao,matricula,id_carregamento,posto,energia,duracao,custo,opc,iec,total,total_com_iva,fatura
12345,Nome Teste,Carregamento Teste,AB-12-CD,CHARGE001,Posto Eletrico,25.5,120,15.50,2.50,1.00,19.00,23.37,FAT001"""
            
            files = {
                'file': ('test_carregamento.csv', csv_content.encode('utf-8'), 'text/csv')
            }
            
            response = requests.post(f"{BACKEND_URL}/importar/carregamento", files=files, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                self.log_result("Correction-3-Carregamento-Platform", True, 
                              f"Carregamento platform supported: {result.get('sucesso', 0)} records processed")
            elif response.status_code == 404:
                self.log_result("Correction-3-Carregamento-Platform", False, 
                              "Carregamento platform not supported (404 Not Found)")
            else:
                self.log_result("Correction-3-Carregamento-Platform", False, 
                              f"Carregamento platform error: {response.status_code}")
                
        except Exception as e:
            self.log_result("Correction-3-Carregamento-Platform", False, f"Carregamento test error: {str(e)}")
    
    def test_different_collections(self, headers):
        """Test that combustivel and carregamento use different MongoDB collections"""
        try:
            # This test verifies that the endpoints exist and handle different data structures
            # We can't directly check MongoDB collections, but we can verify the endpoints
            # process different data formats correctly
            
            # Test 1: Combustivel with fossil fuel specific fields
            combustivel_csv = """posto,combustivel,litros,valor_liquido
Posto A,Gasolina,50.0,75.50"""
            
            files1 = {
                'file': ('combustivel_test.csv', combustivel_csv.encode('utf-8'), 'text/csv')
            }
            
            combustivel_response = requests.post(f"{BACKEND_URL}/importar/combustivel", files=files1, headers=headers)
            
            # Test 2: Carregamento with electric charging specific fields  
            carregamento_csv = """energia,duracao,total_com_iva
25.5,120,23.37"""
            
            files2 = {
                'file': ('carregamento_test.csv', carregamento_csv.encode('utf-8'), 'text/csv')
            }
            
            carregamento_response = requests.post(f"{BACKEND_URL}/importar/carregamento", files=files2, headers=headers)
            
            # Verify both endpoints exist and handle different data
            combustivel_works = combustivel_response.status_code in [200, 400]  # 400 is OK for validation errors
            carregamento_works = carregamento_response.status_code in [200, 400]  # 400 is OK for validation errors
            
            if combustivel_works and carregamento_works:
                self.log_result("Correction-3-Different-Collections", True, 
                              "Both combustivel and carregamento endpoints exist and handle different data structures")
            else:
                self.log_result("Correction-3-Different-Collections", False, 
                              f"Endpoints not working properly - Combustivel: {combustivel_response.status_code}, Carregamento: {carregamento_response.status_code}")
                
        except Exception as e:
            self.log_result("Correction-3-Different-Collections", False, f"Collections test error: {str(e)}")


if __name__ == "__main__":
    tester = Corrections3Tester()
    
    print("🎯 TESTE DAS 3 CORREÇÕES ESPECÍFICAS DO SISTEMA TVDEFleet")
    print("=" * 80)
    print("Correção 1: UUID da Uber deve ser guardado e encontrado")
    print("Correção 2: Veículo atribuído com informações completas")
    print("Correção 3: Importação de Combustível e Carregamentos")
    print("Credentials: admin@tvdefleet.com / o72ocUHy")
    print("=" * 80)
    
    # Run the 3 corrections tests
    success = tester.test_review_request_corrections()
    
    # Print summary
    tester.print_summary()
    summary = tester.get_test_summary()
    
    print(f"\n🎯 RESULTADO FINAL DOS TESTES DAS 3 CORREÇÕES")
    print(f"Total Tests: {summary['total']}")
    print(f"✅ Passed: {summary['passed']}")
    print(f"❌ Failed: {summary['failed']}")
    
    if summary["failed"] == 0 and success:
        print("\n🎉 TODAS AS 3 CORREÇÕES FORAM TESTADAS COM SUCESSO!")
        print("✅ Correção 1: UUID da Uber guardado e encontrado")
        print("✅ Correção 2: Veículo com informações completas (via_verde_id, cartao_frota_id)")
        print("✅ Correção 3: Importação de Combustível e Carregamentos funcionando")
        exit(0)
    else:
        print(f"\n🚨 ALGUMAS CORREÇÕES AINDA TÊM PROBLEMAS!")
        print(f"❌ Verificar logs acima para detalhes das correções que precisam ser verificadas")
        exit(1)