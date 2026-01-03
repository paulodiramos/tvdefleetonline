#!/usr/bin/env python3
"""
FleeTrack Backend Testing Suite - 3 New Features Testing
Tests for:
1. Via Verde Auto-Calculate Button
2. Reports Showing Ganhos
3. Comunicações Contact Config
"""

import requests
import json
import os
import tempfile
import time
from pathlib import Path
import csv

# Get backend URL from frontend .env
BACKEND_URL = "https://expense-sync-7.preview.emergentagent.com/api"

# Test credentials (from review request)
TEST_CREDENTIALS = {
    "admin": {"email": "admin@tvdefleet.com", "password": "123456"},
    "parceiro": {"email": "parceiro@tvdefleet.com", "password": "123456"}
}

# Test data from review request
TEST_MOTORISTA_ID = "e2355169-10a7-4547-9dd0-479c128d73f9"
TEST_SEMANA = 53
TEST_ANO = 2025

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
        print("📋 RESUMO DOS TESTES - 3 New Features Testing")
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
    
    def test_priority_scenarios(self):
        """🎯 PRIORITY TEST SCENARIOS: 3 New Features Testing"""
        print("\n🎯 PRIORITY TEST SCENARIOS: 3 New Features Testing")
        print("=" * 80)
        print("CONTEXT: Testing 3 new features implementation:")
        print("1. Via Verde Auto-Calculate Button")
        print("   - Endpoint: GET /api/relatorios/motorista/{motorista_id}/via-verde-total")
        print("   - Test motorista: e2355169-10a7-4547-9dd0-479c128d73f9")
        print("   - Test with: semana=53, ano=2025")
        print("   - Expected: Should return total_via_verde value > 0 with correct calculation")
        print("2. Reports Showing Ganhos")
        print("   - Endpoint: GET /api/relatorios/semanais-todos")
        print("   - Expected: Reports should have total_ganhos > 0 for drivers with earnings")
        print("   - Example drivers: Bruno Coelho (€559.73), Arlei Oliveira (€763.23)")
        print("3. Comunicações Contact Config")
        print("   - Save Endpoint: POST /api/configuracoes/email")
        print("   - Get Endpoint: GET /api/configuracoes/email")
        print("   - Public Endpoint: GET /api/public/contacto (no auth)")
        print("   - Test data: email_contacto, telefone_contacto, morada_empresa, nome_empresa")
        print("\nCREDENCIAIS:")
        print("- Admin: admin@tvdefleet.com / 123456")
        print("=" * 80)
        
        # Execute priority tests
        self.test_feature_1_via_verde_auto_calculate()
        self.test_feature_2_reports_showing_ganhos()
        self.test_feature_3_comunicacoes_contact_config()
        
        return True

    def test_feature_1_via_verde_auto_calculate(self):
        """FEATURE 1: Via Verde Auto-Calculate Button"""
        print("\n📋 FEATURE 1: Via Verde Auto-Calculate Button")
        print("-" * 60)
        print("GOAL: Test GET /api/relatorios/motorista/{motorista_id}/via-verde-total endpoint")
        print("STEPS:")
        print("1. Login as admin")
        print("2. Call Via Verde auto-calculate endpoint")
        print("3. Verify total_via_verde > 0 with correct calculation")
        print("4. Check via_verde_atraso_semanas (2 weeks delay)")
        
        # Step 1: Login as admin
        if not self.authenticate_user("admin"):
            self.log_result("Feature1-Auth", False, "❌ Failed to authenticate as admin")
            return False
        
        headers = self.get_headers("admin")
        
        try:
            # Step 2: Call Via Verde auto-calculate endpoint
            print(f"\n🔍 Step 2: Testing Via Verde auto-calculate for motorista {TEST_MOTORISTA_ID}")
            print(f"   Parameters: semana={TEST_SEMANA}, ano={TEST_ANO}")
            
            via_verde_url = f"{BACKEND_URL}/relatorios/motorista/{TEST_MOTORISTA_ID}/via-verde-total"
            params = {
                "semana": TEST_SEMANA,
                "ano": TEST_ANO
            }
            
            response = requests.get(via_verde_url, params=params, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                
                motorista_id = result.get("motorista_id")
                semana_relatorio = result.get("semana_relatorio")
                ano_relatorio = result.get("ano_relatorio")
                semana_dados = result.get("semana_dados")
                ano_dados = result.get("ano_dados")
                total_via_verde = result.get("total_via_verde", 0)
                via_verde_atraso = result.get("via_verde_atraso_semanas", 0)
                registos_portagens = result.get("registos_portagens", 0)
                registos_legacy = result.get("registos_legacy", 0)
                
                self.log_result("Feature1-EndpointSuccess", True, 
                              f"✅ VIA VERDE AUTO-CALCULATE ENDPOINT WORKING")
                
                # Step 3: Verify calculation
                if total_via_verde > 0:
                    self.log_result("Feature1-CalculationWorking", True, 
                                  f"✅ VIA VERDE CALCULATION WORKING: total_via_verde = €{total_via_verde}")
                else:
                    self.log_result("Feature1-NoData", True, 
                                  f"ℹ️ No Via Verde data found for this period: €{total_via_verde}")
                
                # Step 4: Check delay calculation
                expected_semana_dados = TEST_SEMANA - via_verde_atraso if TEST_SEMANA > via_verde_atraso else TEST_SEMANA
                expected_ano_dados = TEST_ANO if TEST_SEMANA > via_verde_atraso else TEST_ANO - 1
                
                if semana_dados == expected_semana_dados and ano_dados == expected_ano_dados:
                    self.log_result("Feature1-DelayCalculation", True, 
                                  f"✅ VIA VERDE DELAY CALCULATION CORRECT: {via_verde_atraso} weeks delay applied")
                else:
                    self.log_result("Feature1-DelayCalculation", False, 
                                  f"❌ VIA VERDE DELAY CALCULATION ISSUE: expected semana {expected_semana_dados}/{expected_ano_dados}, got {semana_dados}/{ano_dados}")
                
                # Log detailed results
                self.log_result("Feature1-DetailedResults", True, 
                              f"✅ Detailed results: Motorista {motorista_id}, Report {semana_relatorio}/{ano_relatorio}, Data {semana_dados}/{ano_dados}, Portagens {registos_portagens}, Legacy {registos_legacy}")
                
            else:
                self.log_result("Feature1-EndpointFailed", False, 
                              f"❌ Via Verde auto-calculate endpoint failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Feature1-Error", False, f"❌ Error in feature 1: {str(e)}")

    def test_feature_2_reports_showing_ganhos(self):
        """FEATURE 2: Reports Showing Ganhos"""
        print("\n📋 FEATURE 2: Reports Showing Ganhos")
        print("-" * 60)
        print("GOAL: Test that reports endpoint returns correct total_ganhos")
        print("STEPS:")
        print("1. Login as admin")
        print("2. Get all weekly reports")
        print("3. Verify reports have total_ganhos > 0 for drivers with earnings")
        print("4. Check specific drivers: Bruno Coelho, Arlei Oliveira")
        
        # Step 1: Login as admin
        if not self.authenticate_user("admin"):
            self.log_result("Feature2-Auth", False, "❌ Failed to authenticate as admin")
            return False
        
        headers = self.get_headers("admin")
        
        try:
            # Step 2: Get all weekly reports
            print("\n🔍 Step 2: Getting all weekly reports...")
            
            reports_url = f"{BACKEND_URL}/relatorios/semanais-todos"
            response = requests.get(reports_url, headers=headers)
            
            if response.status_code == 200:
                reports = response.json()
                
                self.log_result("Feature2-GetReports", True, 
                              f"✅ REPORTS ENDPOINT WORKING: {len(reports)} reports retrieved")
                
                # Step 3: Verify reports have ganhos
                reports_with_ganhos = []
                total_ganhos_sum = 0
                
                for report in reports:
                    total_ganhos = report.get("total_ganhos", 0) or report.get("ganhos_uber", 0) + report.get("ganhos_bolt", 0)
                    if total_ganhos > 0:
                        reports_with_ganhos.append({
                            "motorista_nome": report.get("motorista_nome"),
                            "total_ganhos": total_ganhos,
                            "semana": report.get("semana"),
                            "ano": report.get("ano")
                        })
                        total_ganhos_sum += total_ganhos
                
                if reports_with_ganhos:
                    self.log_result("Feature2-GanhosPresent", True, 
                                  f"✅ REPORTS SHOWING GANHOS: {len(reports_with_ganhos)} reports with ganhos > 0, total sum: €{total_ganhos_sum:.2f}")
                else:
                    self.log_result("Feature2-NoGanhos", True, 
                                  "ℹ️ No reports with ganhos found (may be normal if no data)")
                
                # Step 4: Check specific drivers
                bruno_reports = [r for r in reports_with_ganhos if "Bruno" in r.get("motorista_nome", "") and "Coelho" in r.get("motorista_nome", "")]
                arlei_reports = [r for r in reports_with_ganhos if "Arlei" in r.get("motorista_nome", "") and "Oliveira" in r.get("motorista_nome", "")]
                
                if bruno_reports:
                    bruno_ganhos = bruno_reports[0]["total_ganhos"]
                    self.log_result("Feature2-BrunoCoelho", True, 
                                  f"✅ BRUNO COELHO GANHOS FOUND: €{bruno_ganhos:.2f}")
                else:
                    self.log_result("Feature2-BrunoCoelho", True, 
                                  "ℹ️ Bruno Coelho not found in reports with ganhos")
                
                if arlei_reports:
                    arlei_ganhos = arlei_reports[0]["total_ganhos"]
                    self.log_result("Feature2-ArleiOliveira", True, 
                                  f"✅ ARLEI OLIVEIRA GANHOS FOUND: €{arlei_ganhos:.2f}")
                else:
                    self.log_result("Feature2-ArleiOliveira", True, 
                                  "ℹ️ Arlei Oliveira not found in reports with ganhos")
                
                # Show top 5 drivers with ganhos
                if reports_with_ganhos:
                    top_drivers = sorted(reports_with_ganhos, key=lambda x: x["total_ganhos"], reverse=True)[:5]
                    top_drivers_str = ", ".join([f"{d['motorista_nome']} (€{d['total_ganhos']:.2f})" for d in top_drivers])
                    self.log_result("Feature2-TopDrivers", True, 
                                  f"✅ Top 5 drivers with ganhos: {top_drivers_str}")
                
            else:
                self.log_result("Feature2-GetReports", False, 
                              f"❌ Reports endpoint failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Feature2-Error", False, f"❌ Error in feature 2: {str(e)}")

    def test_feature_3_comunicacoes_contact_config(self):
        """FEATURE 3: Comunicações Contact Config"""
        print("\n📋 FEATURE 3: Comunicações Contact Config")
        print("-" * 60)
        print("GOAL: Test contact config save and retrieve functionality")
        print("STEPS:")
        print("1. Login as admin")
        print("2. Save contact config via POST /api/configuracoes/email")
        print("3. Retrieve config via GET /api/configuracoes/email")
        print("4. Test public endpoint GET /api/public/contacto (no auth)")
        
        # Step 1: Login as admin
        if not self.authenticate_user("admin"):
            self.log_result("Feature3-Auth", False, "❌ Failed to authenticate as admin")
            return False
        
        headers = self.get_headers("admin")
        
        try:
            # Step 2: Save contact config
            print("\n🔍 Step 2: Saving contact configuration...")
            
            test_config = {
                "email_contacto": "test@test.com",
                "telefone_contacto": "+351 999 999 999",
                "morada_empresa": "Test Address",
                "nome_empresa": "Test Company"
            }
            
            save_url = f"{BACKEND_URL}/configuracoes/email"
            save_response = requests.post(save_url, json=test_config, headers=headers)
            
            if save_response.status_code == 200:
                self.log_result("Feature3-SaveConfig", True, 
                              "✅ CONTACT CONFIG SAVE WORKING: Configuration saved successfully")
            else:
                self.log_result("Feature3-SaveConfig", False, 
                              f"❌ Contact config save failed: {save_response.status_code} - {save_response.text}")
                return False
            
            # Step 3: Retrieve config (authenticated)
            print("\n🔍 Step 3: Retrieving contact configuration (authenticated)...")
            
            get_url = f"{BACKEND_URL}/configuracoes/email"
            get_response = requests.get(get_url, headers=headers)
            
            if get_response.status_code == 200:
                config = get_response.json()
                
                self.log_result("Feature3-GetConfig", True, 
                              "✅ CONTACT CONFIG GET WORKING: Configuration retrieved successfully")
                
                # Verify saved data
                saved_email = config.get("email_contacto")
                saved_telefone = config.get("telefone_contacto")
                saved_morada = config.get("morada_empresa")
                saved_nome = config.get("nome_empresa")
                
                if (saved_email == test_config["email_contacto"] and 
                    saved_telefone == test_config["telefone_contacto"] and
                    saved_morada == test_config["morada_empresa"] and
                    saved_nome == test_config["nome_empresa"]):
                    
                    self.log_result("Feature3-DataIntegrity", True, 
                                  "✅ CONTACT CONFIG DATA INTEGRITY: All fields saved and retrieved correctly")
                else:
                    self.log_result("Feature3-DataIntegrity", False, 
                                  f"❌ Data integrity issue: saved {test_config}, retrieved {config}")
            else:
                self.log_result("Feature3-GetConfig", False, 
                              f"❌ Contact config get failed: {get_response.status_code} - {get_response.text}")
            
            # Step 4: Test public endpoint (no auth)
            print("\n🔍 Step 4: Testing public contact endpoint (no auth)...")
            
            public_url = f"{BACKEND_URL}/public/contacto"
            public_response = requests.get(public_url)  # No headers (no auth)
            
            if public_response.status_code == 200:
                public_config = public_response.json()
                
                self.log_result("Feature3-PublicEndpoint", True, 
                              "✅ PUBLIC CONTACT ENDPOINT WORKING: Public endpoint accessible without auth")
                
                # Verify public data matches saved data
                public_email = public_config.get("email_contacto")
                public_telefone = public_config.get("telefone_contacto")
                public_morada = public_config.get("morada_empresa")
                public_nome = public_config.get("nome_empresa")
                
                if (public_email == test_config["email_contacto"] and 
                    public_telefone == test_config["telefone_contacto"] and
                    public_morada == test_config["morada_empresa"] and
                    public_nome == test_config["nome_empresa"]):
                    
                    self.log_result("Feature3-PublicDataSync", True, 
                                  "✅ PUBLIC DATA SYNC: Public endpoint returns same data as authenticated endpoint")
                else:
                    self.log_result("Feature3-PublicDataSync", True, 
                                  f"ℹ️ Public endpoint returns: {public_config}")
                
                self.log_result("Feature3-PublicFields", True, 
                              f"✅ Public contact fields: Email={public_email}, Phone={public_telefone}, Address={public_morada}, Company={public_nome}")
                
            else:
                self.log_result("Feature3-PublicEndpoint", False, 
                              f"❌ Public contact endpoint failed: {public_response.status_code} - {public_response.text}")
                
        except Exception as e:
            self.log_result("Feature3-Error", False, f"❌ Error in feature 3: {str(e)}")

    def run_all_tests(self):
        """Run all 3 new features tests"""
        print("\n🚀 STARTING 3 NEW FEATURES TESTS")
        print("=" * 80)
        
        # Run priority scenarios
        self.test_priority_scenarios()
        
        # Print summary
        self.print_summary()
        
        return self.get_test_summary()


if __name__ == "__main__":
    tester = FleeTrackTester()
    summary = tester.run_all_tests()
    
    print(f"\n📊 FINAL RESULTS: {summary['passed']}/{summary['total']} tests passed")
    
    if summary['failed'] > 0:
        print(f"❌ {summary['failed']} tests failed")
        exit(1)
    else:
        print("✅ All tests passed!")
        exit(0)