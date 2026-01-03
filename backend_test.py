#!/usr/bin/env python3
"""
TVDEFleet Backend Testing Suite - Refactored Backend & CSV Config System Tests
Tests for Phase 3 (P3) refactoring and CSV configuration system
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
BACKEND_URL = "https://fleetmanager-24.preview.emergentagent.com/api"

# Test credentials (from review request)
TEST_CREDENTIALS = {
    "admin": {"email": "admin@tvdefleet.com", "password": "123456"},
    "parceiro": {"email": "parceiro@tvdefleet.com", "password": "123456"}
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
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*80)
        print("📋 RESUMO DOS TESTES")
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
    
    def test_refactored_backend_and_csv_config(self):
        """🎯 MAIN TEST: Refactored Backend & CSV Configuration System"""
        print("\n🎯 MAIN TEST: Refactored Backend & CSV Configuration System")
        print("=" * 80)
        print("CREDENCIAIS:")
        print("- Admin: admin@tvdefleet.com / 123456")
        print("\nTESTES A REALIZAR:")
        print("1. Vehicles Router (Refactored)")
        print("2. CSV Configuration System")
        print("=" * 80)
        
        # Execute all tests
        self.test_vehicles_router_refactored()
        self.test_csv_configuration_system()
        
        return True
    
    def test_vehicles_router_refactored(self):
        """1. Test Vehicles Router (Refactored from server.py)"""
        print("\n📋 1. Test Vehicles Router (Refactored)")
        print("-" * 60)
        print("TESTES:")
        print("- GET /api/vehicles - List vehicles via new modular router")
        print("- GET /api/vehicles/{vehicle_id} - Get specific vehicle")
        print("- PUT /api/vehicles/{vehicle_id} - Update vehicle")
        
        # Authenticate as admin
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicles-Router-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            # Test 1: GET /api/vehicles
            print("\nTestando GET /api/vehicles (via new router)")
            response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
            
            if response.status_code == 200:
                vehicles = response.json()
                self.log_result("Vehicles-Router-GET-List", True, 
                              f"✅ GET /api/vehicles funciona via router: {len(vehicles)} veículos encontrados")
                
                if len(vehicles) > 0:
                    # Test 2: GET /api/vehicles/{vehicle_id}
                    test_vehicle = vehicles[0]
                    vehicle_id = test_vehicle['id']
                    vehicle_info = f"{test_vehicle.get('marca', 'N/A')} {test_vehicle.get('modelo', 'N/A')} - {test_vehicle.get('matricula', 'N/A')}"
                    
                    print(f"\nTestando GET /api/vehicles/{vehicle_id}")
                    single_response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}", headers=headers)
                    
                    if single_response.status_code == 200:
                        vehicle_data = single_response.json()
                        self.log_result("Vehicles-Router-GET-Single", True, 
                                      f"✅ GET /api/vehicles/{{id}} funciona: {vehicle_info}")
                        
                        # Test 3: PUT /api/vehicles/{vehicle_id} - Update vehicle
                        print(f"\nTestando PUT /api/vehicles/{vehicle_id}")
                        update_data = {
                            "km_atual": vehicle_data.get("km_atual", 0) + 100,
                            "updated_by_test": "backend_test_refactored"
                        }
                        
                        update_response = requests.put(
                            f"{BACKEND_URL}/vehicles/{vehicle_id}", 
                            json=update_data,
                            headers=headers
                        )
                        
                        if update_response.status_code == 200:
                            self.log_result("Vehicles-Router-PUT", True, 
                                          "✅ PUT /api/vehicles/{id} funciona via router")
                        else:
                            self.log_result("Vehicles-Router-PUT", False, 
                                          f"❌ PUT /api/vehicles/{{id}} falhou: {update_response.status_code}")
                            print(f"   Erro: {update_response.text}")
                    else:
                        self.log_result("Vehicles-Router-GET-Single", False, 
                                      f"❌ GET /api/vehicles/{{id}} falhou: {single_response.status_code}")
                        print(f"   Erro: {single_response.text}")
                else:
                    self.log_result("Vehicles-Router-No-Vehicles", True, 
                                  "ℹ️ Nenhum veículo encontrado (normal se base de dados vazia)")
            else:
                self.log_result("Vehicles-Router-GET-List", False, 
                              f"❌ GET /api/vehicles falhou: {response.status_code}")
                print(f"   Erro: {response.text}")
            
            return True
            
        except Exception as e:
            self.log_result("Vehicles-Router-Error", False, f"❌ Erro durante teste: {str(e)}")
            return False
    
    def test_csv_configuration_system(self):
        """2. Test CSV Configuration System"""
        print("\n📋 2. Test CSV Configuration System")
        print("-" * 60)
        print("TESTES:")
        print("- GET /api/csv-config/plataformas - List available platforms")
        print("- GET /api/csv-config/campos-sistema/uber - Get system fields for Uber")
        print("- GET /api/csv-config/mapeamentos-padrao/uber - Get default mappings for Uber")
        print("- POST /api/csv-config - Create new CSV configuration")
        print("- GET /api/csv-config - List configurations")
        print("- POST /api/csv-config/analisar-ficheiro - Analyze CSV file")
        
        # Authenticate as admin
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("CSV-Config-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            # Test 1: GET /api/csv-config/plataformas
            print("\nTestando GET /api/csv-config/plataformas")
            platforms_response = requests.get(f"{BACKEND_URL}/csv-config/plataformas", headers=headers)
            
            if platforms_response.status_code == 200:
                platforms = platforms_response.json()
                expected_platforms = ["uber", "bolt", "via_verde", "combustivel", "gps"]
                platform_ids = [p.get("id") for p in platforms]
                
                all_platforms_present = all(platform in platform_ids for platform in expected_platforms)
                
                if all_platforms_present:
                    self.log_result("CSV-Config-Platforms", True, 
                                  f"✅ GET /api/csv-config/plataformas funciona: {len(platforms)} plataformas ({', '.join(platform_ids)})")
                else:
                    self.log_result("CSV-Config-Platforms", False, 
                                  f"❌ Plataformas em falta. Esperado: {expected_platforms}, Encontrado: {platform_ids}")
            else:
                self.log_result("CSV-Config-Platforms", False, 
                              f"❌ GET /api/csv-config/plataformas falhou: {platforms_response.status_code}")
                print(f"   Erro: {platforms_response.text}")
                return False
            
            # Test 2: GET /api/csv-config/campos-sistema/uber
            print("\nTestando GET /api/csv-config/campos-sistema/uber")
            fields_response = requests.get(f"{BACKEND_URL}/csv-config/campos-sistema/uber", headers=headers)
            
            if fields_response.status_code == 200:
                fields_data = fields_response.json()
                campos = fields_data.get("campos", [])
                
                if len(campos) > 0:
                    self.log_result("CSV-Config-System-Fields", True, 
                                  f"✅ GET /api/csv-config/campos-sistema/uber funciona: {len(campos)} campos disponíveis")
                else:
                    self.log_result("CSV-Config-System-Fields", False, 
                                  "❌ Nenhum campo de sistema encontrado para Uber")
            else:
                self.log_result("CSV-Config-System-Fields", False, 
                              f"❌ GET /api/csv-config/campos-sistema/uber falhou: {fields_response.status_code}")
                print(f"   Erro: {fields_response.text}")
            
            # Test 3: GET /api/csv-config/mapeamentos-padrao/uber
            print("\nTestando GET /api/csv-config/mapeamentos-padrao/uber")
            mappings_response = requests.get(f"{BACKEND_URL}/csv-config/mapeamentos-padrao/uber", headers=headers)
            
            if mappings_response.status_code == 200:
                mappings_data = mappings_response.json()
                mapeamentos = mappings_data.get("mapeamentos", [])
                
                if len(mapeamentos) > 0:
                    self.log_result("CSV-Config-Default-Mappings", True, 
                                  f"✅ GET /api/csv-config/mapeamentos-padrao/uber funciona: {len(mapeamentos)} mapeamentos padrão")
                else:
                    self.log_result("CSV-Config-Default-Mappings", False, 
                                  "❌ Nenhum mapeamento padrão encontrado para Uber")
            else:
                self.log_result("CSV-Config-Default-Mappings", False, 
                              f"❌ GET /api/csv-config/mapeamentos-padrao/uber falhou: {mappings_response.status_code}")
                print(f"   Erro: {mappings_response.text}")
            
            # Get user ID for creating configuration
            user_response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
            user_id = None
            if user_response.status_code == 200:
                user_data = user_response.json()
                user_id = user_data.get("id")
            
            if not user_id:
                self.log_result("CSV-Config-User-ID", False, "❌ Não foi possível obter user_id")
                return False
            
            # Test 4: POST /api/csv-config - Create new CSV configuration
            print("\nTestando POST /api/csv-config")
            config_data = {
                "parceiro_id": user_id,
                "plataforma": "uber",
                "nome_configuracao": "Test Config",
                "descricao": "Test configuration",
                "delimitador": ",",
                "encoding": "utf-8",
                "skip_linhas": 0,
                "mapeamentos": [
                    {
                        "csv_column": "UUID",
                        "system_field": "uuid_motorista",
                        "transform": "text",
                        "required": True
                    }
                ]
            }
            
            create_response = requests.post(
                f"{BACKEND_URL}/csv-config", 
                json=config_data,
                headers=headers
            )
            
            config_id = None
            if create_response.status_code == 200:
                create_result = create_response.json()
                config_id = create_result.get("config_id")
                
                if config_id:
                    self.log_result("CSV-Config-Create", True, 
                                  f"✅ POST /api/csv-config funciona: configuração criada com ID {config_id}")
                else:
                    self.log_result("CSV-Config-Create", False, 
                                  "❌ Configuração criada mas sem config_id na resposta")
            else:
                self.log_result("CSV-Config-Create", False, 
                              f"❌ POST /api/csv-config falhou: {create_response.status_code}")
                print(f"   Erro: {create_response.text}")
            
            # Test 5: GET /api/csv-config - List configurations
            print("\nTestando GET /api/csv-config")
            list_response = requests.get(f"{BACKEND_URL}/csv-config", headers=headers)
            
            if list_response.status_code == 200:
                configs = list_response.json()
                
                # Check if our created config is in the list
                created_config_found = False
                if config_id:
                    created_config_found = any(c.get("id") == config_id for c in configs)
                
                if created_config_found:
                    self.log_result("CSV-Config-List", True, 
                                  f"✅ GET /api/csv-config funciona: {len(configs)} configurações (incluindo a criada)")
                else:
                    self.log_result("CSV-Config-List", True, 
                                  f"✅ GET /api/csv-config funciona: {len(configs)} configurações")
            else:
                self.log_result("CSV-Config-List", False, 
                              f"❌ GET /api/csv-config falhou: {list_response.status_code}")
                print(f"   Erro: {list_response.text}")
            
            # Test 6: POST /api/csv-config/analisar-ficheiro - Analyze CSV file
            print("\nTestando POST /api/csv-config/analisar-ficheiro")
            
            # Create a simple test CSV file
            csv_content = "UUID,Nome,Valor\ntest-uuid-123,João Silva,25.50\ntest-uuid-456,Maria Santos,30.75"
            
            files = {
                'file': ('test.csv', csv_content.encode('utf-8'), 'text/csv')
            }
            
            data = {
                'delimitador': ',',
                'encoding': 'utf-8'
            }
            
            analyze_response = requests.post(
                f"{BACKEND_URL}/csv-config/analisar-ficheiro", 
                files=files,
                data=data,
                headers=headers
            )
            
            if analyze_response.status_code == 200:
                analyze_result = analyze_response.json()
                colunas = analyze_result.get("colunas", [])
                
                if len(colunas) == 3:  # UUID, Nome, Valor
                    self.log_result("CSV-Config-Analyze", True, 
                                  f"✅ POST /api/csv-config/analisar-ficheiro funciona: {len(colunas)} colunas detectadas")
                else:
                    self.log_result("CSV-Config-Analyze", False, 
                                  f"❌ Análise incorreta: esperado 3 colunas, encontrado {len(colunas)}")
            else:
                self.log_result("CSV-Config-Analyze", False, 
                              f"❌ POST /api/csv-config/analisar-ficheiro falhou: {analyze_response.status_code}")
                print(f"   Erro: {analyze_response.text}")
            
            return True
            
        except Exception as e:
            self.log_result("CSV-Config-Error", False, f"❌ Erro durante teste: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence - Focus on Refactored Backend & CSV Config Tests"""
        print("🚀 INICIANDO TESTES - BACKEND REFATORIZADO & SISTEMA CSV CONFIG")
        print("=" * 80)
        
        # Authenticate required users
        print("\n🔐 AUTENTICAÇÃO DE UTILIZADORES")
        print("-" * 40)
        for role in ["admin"]:
            self.authenticate_user(role)
        
        # PRIORITY: REFACTORED BACKEND & CSV CONFIG TESTS
        print("\n🎯 TESTES PRINCIPAIS: Backend Refatorizado & Sistema CSV Config")
        print("=" * 80)
        self.test_refactored_backend_and_csv_config()
        
        # Print final summary
        self.print_summary()
        
        return self.get_test_summary()


def main():
    """Main function to run tests"""
    tester = TVDEFleetTester()
    
    try:
        summary = tester.run_all_tests()
        
        print(f"\n🎯 RESUMO FINAL")
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