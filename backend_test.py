#!/usr/bin/env python3
"""
FleeTrack Backend Testing Suite - Via Verde Calculation Fix Validation
Tests for Via Verde calculation endpoint with specific test scenarios:
1. Marco Coelho Via Verde (OBU 601104486167) - Expected €53.00 (30 registos)
2. Luiz Cruz Via Verde - Expected €14.50 (30 registos) 
3. Mário Domingues Via Verde - Expected €323.00 (284 registos)
4. Multiple week test (different data week)
"""

import requests
import json
import os
import tempfile
import time
from pathlib import Path
import csv

# Get backend URL from frontend .env
BACKEND_URL = "https://driver-expenses-1.preview.emergentagent.com/api"

# Test credentials (from review request)
TEST_CREDENTIALS = {
    "admin": {"email": "admin@tvdefleet.com", "password": "123456"},
    "parceiro": {"email": "parceiro@tvdefleet.com", "password": "123456"}
}

# Via Verde test scenarios from review request
VIA_VERDE_TEST_SCENARIOS = [
    {
        "name": "Marco Coelho Via Verde",
        "motorista_id": "36b1d8b4-dbf4-4857-acea-9580aeaaf98c",
        "obu": "601104486167",
        "semana": 52,
        "ano": 2025,
        "expected_total": 53.00,
        "expected_registos": 30,
        "description": "Tests data week 50/2025 (due to 2-week delay)"
    },
    {
        "name": "Luiz Cruz Via Verde",
        "motorista_id": "086afba0-2007-43c7-a60b-c6d60ad9f3dd",
        "semana": 52,
        "ano": 2025,
        "expected_total": 14.50,
        "expected_registos": 30,
        "description": "Tests data week 50/2025 (due to 2-week delay)"
    },
    {
        "name": "Mário Domingues Via Verde",
        "motorista_id": "0f0c1c6a-49f6-48d4-98ba-46bf8e3617ed",
        "semana": 52,
        "ano": 2025,
        "expected_total": 323.00,
        "expected_registos": 284,
        "description": "Tests data week 50/2025 (due to 2-week delay)"
    },
    {
        "name": "Marco Coelho Via Verde (Week 51)",
        "motorista_id": "36b1d8b4-dbf4-4857-acea-9580aeaaf98c",
        "semana": 51,
        "ano": 2025,
        "expected_different": True,
        "description": "Should get data from week 49 (different from test 1)"
    }
]

class ViaVerdeTester:
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
        print("📋 RESUMO DOS TESTES - Via Verde Calculation Fix Validation")
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
    
    def test_via_verde_calculation_scenarios(self):
        """🎯 PRIORITY TEST SCENARIOS: Via Verde Calculation Fix Validation"""
        print("\n🎯 PRIORITY TEST SCENARIOS: Via Verde Calculation Fix Validation")
        print("=" * 80)
        print("CONTEXT: Testing Via Verde calculation endpoint fix with specific scenarios:")
        print("1. Marco Coelho Via Verde (OBU 601104486167)")
        print("   - Endpoint: GET /api/relatorios/motorista/36b1d8b4-dbf4-4857-acea-9580aeaaf98c/via-verde-total?semana=52&ano=2025")
        print("   - Expected: total_via_verde = €53.00 (30 registos)")
        print("2. Luiz Cruz Via Verde")
        print("   - Endpoint: GET /api/relatorios/motorista/086afba0-2007-43c7-a60b-c6d60ad9f3dd/via-verde-total?semana=52&ano=2025")
        print("   - Expected: total_via_verde = €14.50 (30 registos)")
        print("3. Mário Domingues Via Verde")
        print("   - Endpoint: GET /api/relatorios/motorista/0f0c1c6a-49f6-48d4-98ba-46bf8e3617ed/via-verde-total?semana=52&ano=2025")
        print("   - Expected: total_via_verde = €323.00 (284 registos)")
        print("4. Multiple week test (different data week)")
        print("   - Test same endpoint with semana=51 (should get data from week 49)")
        print("\nCREDENCIAIS:")
        print("- Admin: admin@tvdefleet.com / 123456")
        print("=" * 80)
        
        # Execute Via Verde calculation tests
        self.test_via_verde_scenarios()
        
        return True

    def test_via_verde_scenarios(self):
        """Test all Via Verde calculation scenarios"""
        print("\n📋 VIA VERDE CALCULATION SCENARIOS")
        print("-" * 60)
        print("GOAL: Test Via Verde calculation endpoint with specific test cases")
        print("STEPS:")
        print("1. Login as admin")
        print("2. Test each Via Verde scenario")
        print("3. Verify expected totals and registos")
        print("4. Check 2-week delay calculation")
        
        # Step 1: Login as admin
        if not self.authenticate_user("admin"):
            self.log_result("ViaVerde-Auth", False, "❌ Failed to authenticate as admin")
            return False
        
        headers = self.get_headers("admin")
        
        # Store results for comparison
        scenario_results = {}
        
        # Step 2: Test each scenario
        for i, scenario in enumerate(VIA_VERDE_TEST_SCENARIOS, 1):
            try:
                print(f"\n🔍 Test {i}: {scenario['name']}")
                print(f"   Motorista ID: {scenario['motorista_id']}")
                print(f"   Parameters: semana={scenario['semana']}, ano={scenario['ano']}")
                if 'expected_total' in scenario:
                    print(f"   Expected: €{scenario['expected_total']} ({scenario['expected_registos']} registos)")
                print(f"   Description: {scenario['description']}")
                
                via_verde_url = f"{BACKEND_URL}/relatorios/motorista/{scenario['motorista_id']}/via-verde-total"
                params = {
                    "semana": scenario['semana'],
                    "ano": scenario['ano']
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
                    
                    # Store result for comparison
                    scenario_results[scenario['name']] = {
                        'total_via_verde': total_via_verde,
                        'registos_portagens': registos_portagens,
                        'semana_dados': semana_dados,
                        'ano_dados': ano_dados
                    }
                    
                    self.log_result(f"Test{i}-EndpointSuccess", True, 
                                  f"✅ {scenario['name']} endpoint working")
                    
                    # Check expected values if provided
                    if 'expected_total' in scenario:
                        if abs(total_via_verde - scenario['expected_total']) < 0.01:  # Allow small floating point differences
                            self.log_result(f"Test{i}-TotalMatch", True, 
                                          f"✅ Total Via Verde matches: €{total_via_verde} (expected €{scenario['expected_total']})")
                        else:
                            self.log_result(f"Test{i}-TotalMismatch", False, 
                                          f"❌ Total Via Verde mismatch: €{total_via_verde} (expected €{scenario['expected_total']})")
                        
                        # Check registos count (allow some tolerance)
                        registos_total = registos_portagens + registos_legacy
                        if abs(registos_total - scenario['expected_registos']) <= 5:  # Allow 5 record tolerance
                            self.log_result(f"Test{i}-RegistosMatch", True, 
                                          f"✅ Registos count acceptable: {registos_total} (expected ~{scenario['expected_registos']})")
                        else:
                            self.log_result(f"Test{i}-RegistosMismatch", False, 
                                          f"❌ Registos count mismatch: {registos_total} (expected ~{scenario['expected_registos']})")
                    
                    # Check 2-week delay calculation
                    expected_semana_dados = scenario['semana'] - via_verde_atraso
                    if expected_semana_dados <= 0:
                        expected_semana_dados += 52
                        expected_ano_dados = scenario['ano'] - 1
                    else:
                        expected_ano_dados = scenario['ano']
                    
                    if semana_dados == expected_semana_dados and ano_dados == expected_ano_dados:
                        self.log_result(f"Test{i}-DelayCalculation", True, 
                                      f"✅ 2-week delay calculation correct: data from week {semana_dados}/{ano_dados}")
                    else:
                        self.log_result(f"Test{i}-DelayCalculation", False, 
                                      f"❌ Delay calculation issue: got week {semana_dados}/{ano_dados}, expected {expected_semana_dados}/{expected_ano_dados}")
                    
                    # Log detailed results
                    self.log_result(f"Test{i}-Details", True, 
                                  f"✅ Details: Total=€{total_via_verde}, Portagens={registos_portagens}, Legacy={registos_legacy}, Data={semana_dados}/{ano_dados}")
                    
                else:
                    self.log_result(f"Test{i}-EndpointFailed", False, 
                                  f"❌ {scenario['name']} endpoint failed: {response.status_code} - {response.text}")
                    
            except Exception as e:
                self.log_result(f"Test{i}-Error", False, f"❌ Error in {scenario['name']}: {str(e)}")
        
        # Step 4: Compare results for multiple week test
        if len(scenario_results) >= 2:
            marco_week52 = scenario_results.get("Marco Coelho Via Verde")
            marco_week51 = scenario_results.get("Marco Coelho Via Verde (Week 51)")
            
            if marco_week52 and marco_week51:
                if (marco_week52['total_via_verde'] != marco_week51['total_via_verde'] or
                    marco_week52['semana_dados'] != marco_week51['semana_dados']):
                    self.log_result("MultiWeek-Comparison", True, 
                                  f"✅ Multiple week test passed: Week 52 (€{marco_week52['total_via_verde']}, data week {marco_week52['semana_dados']}) vs Week 51 (€{marco_week51['total_via_verde']}, data week {marco_week51['semana_dados']})")
                else:
                    self.log_result("MultiWeek-Comparison", False, 
                                  f"❌ Multiple week test failed: Same values for different weeks")
        
        return True

    def run_all_tests(self):
        """Run all Via Verde calculation tests"""
        print("\n🚀 STARTING VIA VERDE CALCULATION FIX VALIDATION")
        print("=" * 80)
        
        # Run Via Verde calculation scenarios
        self.test_via_verde_calculation_scenarios()
        
        # Print summary
        self.print_summary()
        
        return self.get_test_summary()


if __name__ == "__main__":
    tester = ViaVerdeTester()
    summary = tester.run_all_tests()
    
    print(f"\n📊 FINAL RESULTS: {summary['passed']}/{summary['total']} tests passed")
    
    if summary['failed'] > 0:
        print(f"❌ {summary['failed']} tests failed")
        exit(1)
    else:
        print("✅ All tests passed!")
        exit(0)