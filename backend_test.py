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
        """🎯 MAIN TEST: FleeTrack Backend APIs after Route Refactoring"""
        print("\n🎯 MAIN TEST: FleeTrack Backend APIs after Route Refactoring")
        print("=" * 80)
        print("CREDENCIAIS:")
        print("- Admin: admin@tvdefleet.com / 123456")
        print("\nTESTES A REALIZAR:")
        print("1. Authentication API")
        print("2. Vehicles API (Refactored)")
        print("3. Automação RPA API (New Module)")
        print("4. CSV Config API (New Module)")
        print("=" * 80)
        
        # Execute all tests
        self.test_authentication_api()
        self.test_vehicles_api_refactored()
        self.test_automacao_rpa_api()
        self.test_csv_config_api()
        
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
                    self.log_result("Auth-Login", True, 
                                  f"✅ Login successful - Token received, User: {user_data.get('name', user_data.get('email'))}")
                else:
                    self.log_result("Auth-Login", False, "❌ Login response missing token or user data")
            else:
                self.log_result("Auth-Login", False, 
                              f"❌ Login failed: {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Auth-Login", False, f"❌ Authentication error: {str(e)}")
    
    def test_vehicles_api_refactored(self):
        """2. Test Vehicles API (Refactored to routes/vehicles.py)"""
        print("\n📋 2. Test Vehicles API (Refactored)")
        print("-" * 60)
        print("TESTES:")
        print("- GET /api/vehicles - List vehicles")
        print("- POST /api/vehicles/{vehicle_id}/atribuir-motorista - Vehicle assignment")
        
        # Get auth headers
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Vehicles-API-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            # Test 1: GET /api/vehicles
            print("\nTestando GET /api/vehicles")
            response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
            
            if response.status_code == 200:
                vehicles = response.json()
                vehicle_count = len(vehicles)
                self.log_result("Vehicles-API-GET", True, 
                              f"✅ GET /api/vehicles works: {vehicle_count} vehicles found")
                
                # Test 2: Vehicle assignment if vehicles exist
                if vehicle_count > 0:
                    test_vehicle = vehicles[0]
                    vehicle_id = test_vehicle['id']
                    vehicle_info = f"{test_vehicle.get('marca', 'N/A')} {test_vehicle.get('modelo', 'N/A')} - {test_vehicle.get('matricula', 'N/A')}"
                    
                    print(f"\nTestando POST /api/vehicles/{vehicle_id}/atribuir-motorista")
                    
                    # Test assignment data
                    assignment_data = {
                        "motorista_id": None,  # Remove assignment
                        "via_verde_id": "VV123456",
                        "cartao_frota_id": "CF789012"
                    }
                    
                    assignment_response = requests.post(
                        f"{BACKEND_URL}/vehicles/{vehicle_id}/atribuir-motorista",
                        json=assignment_data,
                        headers=headers
                    )
                    
                    if assignment_response.status_code == 200:
                        self.log_result("Vehicles-API-Assignment", True, 
                                      f"✅ Vehicle assignment API works for {vehicle_info}")
                    else:
                        self.log_result("Vehicles-API-Assignment", False, 
                                      f"❌ Vehicle assignment failed: {assignment_response.status_code}")
                        print(f"   Error: {assignment_response.text}")
                else:
                    self.log_result("Vehicles-API-Assignment", True, 
                                  "ℹ️ No vehicles to test assignment (normal if database empty)")
            else:
                self.log_result("Vehicles-API-GET", False, 
                              f"❌ GET /api/vehicles failed: {response.status_code}")
                print(f"   Error: {response.text}")
            
            return True
            
        except Exception as e:
            self.log_result("Vehicles-API-Error", False, f"❌ Error during vehicles test: {str(e)}")
            return False
    
    def test_automacao_rpa_api(self):
        """3. Test Automação RPA API (New Module routes/automacao.py)"""
        print("\n📋 3. Test Automação RPA API (New Module)")
        print("-" * 60)
        print("TESTES:")
        print("- GET /api/automacao/dashboard - Dashboard stats")
        print("- GET /api/automacao/fornecedores - List providers")
        print("- GET /api/automacao/fornecedores/tipos - Provider types")
        
        # Get auth headers
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("Automacao-API-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            # Test 1: GET /api/automacao/dashboard
            print("\nTestando GET /api/automacao/dashboard")
            dashboard_response = requests.get(f"{BACKEND_URL}/automacao/dashboard", headers=headers)
            
            if dashboard_response.status_code == 200:
                dashboard_data = dashboard_response.json()
                fornecedores_count = dashboard_data.get("total_fornecedores", 0)
                automacoes_count = dashboard_data.get("total_automacoes", 0)
                
                self.log_result("Automacao-Dashboard", True, 
                              f"✅ Dashboard API works: {fornecedores_count} fornecedores, {automacoes_count} automações")
            else:
                self.log_result("Automacao-Dashboard", False, 
                              f"❌ Dashboard API failed: {dashboard_response.status_code}")
                print(f"   Error: {dashboard_response.text}")
            
            # Test 2: GET /api/automacao/fornecedores
            print("\nTestando GET /api/automacao/fornecedores")
            fornecedores_response = requests.get(f"{BACKEND_URL}/automacao/fornecedores", headers=headers)
            
            if fornecedores_response.status_code == 200:
                fornecedores = fornecedores_response.json()
                expected_providers = ["Uber", "Bolt", "Via Verde"]
                provider_names = [f.get("nome") for f in fornecedores]
                
                found_providers = [p for p in expected_providers if p in provider_names]
                
                if len(found_providers) >= 2:  # At least 2 of the expected providers
                    self.log_result("Automacao-Fornecedores", True, 
                                  f"✅ Fornecedores API works: {len(fornecedores)} providers ({', '.join(provider_names)})")
                else:
                    self.log_result("Automacao-Fornecedores", False, 
                                  f"❌ Expected providers missing. Found: {provider_names}")
            else:
                self.log_result("Automacao-Fornecedores", False, 
                              f"❌ Fornecedores API failed: {fornecedores_response.status_code}")
                print(f"   Error: {fornecedores_response.text}")
            
            # Test 3: GET /api/automacao/fornecedores/tipos
            print("\nTestando GET /api/automacao/fornecedores/tipos")
            tipos_response = requests.get(f"{BACKEND_URL}/automacao/fornecedores/tipos", headers=headers)
            
            if tipos_response.status_code == 200:
                tipos = tipos_response.json()
                expected_types = ["uber", "bolt", "via_verde", "gps", "combustivel"]
                type_ids = [t.get("id") for t in tipos]
                
                found_types = [t for t in expected_types if t in type_ids]
                
                if len(found_types) >= 3:  # At least 3 expected types
                    self.log_result("Automacao-Tipos", True, 
                                  f"✅ Provider types API works: {len(tipos)} types ({', '.join(type_ids)})")
                else:
                    self.log_result("Automacao-Tipos", False, 
                                  f"❌ Expected types missing. Found: {type_ids}")
            else:
                self.log_result("Automacao-Tipos", False, 
                              f"❌ Provider types API failed: {tipos_response.status_code}")
                print(f"   Error: {tipos_response.text}")
            
            return True
            
        except Exception as e:
            self.log_result("Automacao-API-Error", False, f"❌ Error during automação test: {str(e)}")
            return False
    
    def test_csv_config_api(self):
        """4. Test CSV Config API (New Module routes/csv_config.py)"""
        print("\n📋 4. Test CSV Config API (New Module)")
        print("-" * 60)
        print("TESTES:")
        print("- GET /api/csv-config/plataformas - Available platforms")
        print("- GET /api/csv-config/campos-sistema - System fields")
        
        # Get auth headers
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
                
                found_platforms = [p for p in expected_platforms if p in platform_ids]
                
                if len(found_platforms) >= 3:  # At least 3 expected platforms
                    self.log_result("CSV-Config-Platforms", True, 
                                  f"✅ Platforms API works: {len(platforms)} platforms ({', '.join(platform_ids)})")
                else:
                    self.log_result("CSV-Config-Platforms", False, 
                                  f"❌ Expected platforms missing. Found: {platform_ids}")
            else:
                self.log_result("CSV-Config-Platforms", False, 
                              f"❌ Platforms API failed: {platforms_response.status_code}")
                print(f"   Error: {platforms_response.text}")
            
            # Test 2: GET /api/csv-config/campos-sistema (test with uber)
            print("\nTestando GET /api/csv-config/campos-sistema")
            # Test with uber platform
            campos_response = requests.get(f"{BACKEND_URL}/csv-config/campos-sistema/uber", headers=headers)
            
            if campos_response.status_code == 200:
                campos_data = campos_response.json()
                campos = campos_data.get("campos", [])
                
                if len(campos) > 0:
                    self.log_result("CSV-Config-System-Fields", True, 
                                  f"✅ System fields API works: {len(campos)} fields for uber")
                else:
                    self.log_result("CSV-Config-System-Fields", False, 
                                  "❌ No system fields found for uber")
            else:
                self.log_result("CSV-Config-System-Fields", False, 
                              f"❌ System fields API failed: {campos_response.status_code}")
                print(f"   Error: {campos_response.text}")
            
            return True
            
        except Exception as e:
            self.log_result("CSV-Config-Error", False, f"❌ Error during CSV config test: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence - Focus on FleeTrack Backend APIs"""
        print("🚀 INICIANDO TESTES - FleeTrack Backend APIs após Refatorização")
        print("=" * 80)
        
        # Authenticate required users
        print("\n🔐 AUTENTICAÇÃO DE UTILIZADORES")
        print("-" * 40)
        for role in ["admin"]:
            self.authenticate_user(role)
        
        # PRIORITY: FleeTrack Backend API Tests
        print("\n🎯 TESTES PRINCIPAIS: FleeTrack Backend APIs")
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
        
        print(f"\n🎯 RESUMO FINAL - FleeTrack Backend API Tests")
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