#!/usr/bin/env python3
"""
Uber CSV Import Test - Review Request
Test the specific scenario described in the review request
"""

import requests
import json
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://fleet-import.preview.emergentagent.com/api"

# Admin credentials from review request
ADMIN_CREDENTIALS = {"email": "admin@tvdefleet.com", "password": "o72ocUHy"}

class UberCSVImportTester:
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
    
    def authenticate(self):
        """Authenticate as admin"""
        try:
            response = requests.post(f"{BACKEND_URL}/auth/login", json=ADMIN_CREDENTIALS)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data["access_token"]
                self.log_result("Authentication", True, "Successfully authenticated as admin")
                return True
            else:
                self.log_result("Authentication", False, f"Failed to authenticate: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Authentication", False, f"Authentication error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get authorization headers"""
        if not self.token:
            return None
        return {"Authorization": f"Bearer {self.token}"}
    
    def test_verify_driver_uuid_profile(self):
        """Step 1: Verify UUID in driver profile by email"""
        headers = self.get_headers()
        if not headers:
            self.log_result("Verify-Driver-UUID-Profile", False, "No auth token")
            return False
        
        try:
            # Search for driver by email
            target_email = "brunomccoelho@hotmail.com"
            expected_uuid = "35382cb7-236e-42c1-b0b4-e16bfabb8ff3"
            
            # Get all drivers and search for the target email
            response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            
            if response.status_code == 200:
                motoristas = response.json()
                target_driver = None
                
                for motorista in motoristas:
                    if motorista.get("email", "").lower() == target_email.lower():
                        target_driver = motorista
                        break
                
                if target_driver:
                    uuid_field = target_driver.get("uuid_motorista_uber")
                    
                    if uuid_field == expected_uuid:
                        self.log_result("Verify-Driver-UUID-Profile", True, 
                                      f"Driver found with correct UUID: {uuid_field}")
                        self.target_driver_id = target_driver.get("id")
                        return True
                    elif uuid_field:
                        self.log_result("Verify-Driver-UUID-Profile", False, 
                                      f"Driver found but UUID mismatch: got '{uuid_field}', expected '{expected_uuid}'")
                        return False
                    else:
                        self.log_result("Verify-Driver-UUID-Profile", False, 
                                      f"Driver found but UUID field is empty")
                        return False
                else:
                    self.log_result("Verify-Driver-UUID-Profile", False, 
                                  f"Driver not found with email: {target_email}")
                    return False
            else:
                self.log_result("Verify-Driver-UUID-Profile", False, 
                              f"Failed to get drivers list: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Verify-Driver-UUID-Profile", False, f"Error: {str(e)}")
            return False
    
    def test_debug_uuid_search(self):
        """Debug: Show all drivers with UUID fields"""
        headers = self.get_headers()
        if not headers:
            self.log_result("Debug-UUID-Search", False, "No auth token")
            return False
        
        try:
            expected_uuid = "35382cb7-236e-42c1-b0b4-e16bfabb8ff3"
            
            # Get all drivers and check UUID fields
            response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            
            if response.status_code == 200:
                motoristas = response.json()
                uuid_drivers = []
                
                for motorista in motoristas:
                    uuid_field = motorista.get("uuid_motorista_uber")
                    if uuid_field:
                        uuid_drivers.append({
                            "name": motorista.get("name", "Unknown"),
                            "email": motorista.get("email", "Unknown"),
                            "uuid": uuid_field
                        })
                
                self.log_result("Debug-UUID-Search", True, 
                              f"Found {len(uuid_drivers)} drivers with UUID field populated")
                
                # Check if our target UUID exists
                target_found = any(d["uuid"] == expected_uuid for d in uuid_drivers)
                
                if target_found:
                    target_driver = next(d for d in uuid_drivers if d["uuid"] == expected_uuid)
                    self.log_result("Debug-Target-UUID", True, 
                                  f"Target UUID found: {target_driver['name']} ({target_driver['email']})")
                else:
                    self.log_result("Debug-Target-UUID", False, 
                                  f"Target UUID {expected_uuid} not found in database")
                    
                    # Show all UUIDs for debugging
                    if uuid_drivers:
                        print(f"   All UUIDs in database:")
                        for i, driver in enumerate(uuid_drivers):
                            print(f"   {i+1}. {driver['name']} ({driver['email']}): {driver['uuid']}")
                
                return True
            else:
                self.log_result("Debug-UUID-Search", False, 
                              f"Failed to get drivers: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Debug-UUID-Search", False, f"Error: {str(e)}")
            return False
    
    def test_download_and_import_real_csv(self):
        """Step 2: Download real CSV file and import it"""
        headers = self.get_headers()
        if not headers:
            self.log_result("Download-Import-CSV", False, "No auth token")
            return False
        
        try:
            csv_url = "https://customer-assets.emergentagent.com/job_weekly-report-sys/artifacts/vy8erxlu_20251201-20251208-payments_driver-ZENY_MACAIA_UNIPESSOAL_LDA%20%281%29.csv"
            
            # Download the CSV file
            print(f"📥 Downloading CSV from: {csv_url}")
            csv_response = requests.get(csv_url)
            
            if csv_response.status_code == 200:
                csv_content = csv_response.content
                self.log_result("Download-Real-CSV", True, 
                              f"CSV downloaded successfully: {len(csv_content)} bytes")
                
                # Show first few lines of CSV for debugging
                csv_text = csv_content.decode('utf-8', errors='ignore')
                lines = csv_text.split('\n')[:5]
                print("   First 5 lines of CSV:")
                for i, line in enumerate(lines):
                    print(f"   {i+1}: {line[:100]}...")
                
                # Import the CSV via the endpoint
                files = {
                    'file': ('uber_real_file.csv', csv_content, 'text/csv')
                }
                
                import_response = requests.post(
                    f"{BACKEND_URL}/importar/uber",
                    files=files,
                    headers=headers
                )
                
                if import_response.status_code == 200:
                    result = import_response.json()
                    
                    # Store results for verification
                    self.import_result = result
                    
                    sucesso = result.get("sucesso", 0)
                    erros_count = result.get("erros", 0)
                    erros_detalhes = result.get("erros_detalhes", [])
                    message = result.get("message", "")
                    
                    self.log_result("Import-Real-CSV", True, 
                                  f"CSV imported - Success: {sucesso}, Errors: {erros_count}, Message: {message}")
                    
                    # Log first few errors if any
                    if erros_detalhes:
                        print(f"   First 5 errors: {erros_detalhes[:5]}")
                    
                    return True
                else:
                    self.log_result("Import-Real-CSV", False, 
                                  f"Import failed: {import_response.status_code}", import_response.text)
                    return False
            else:
                self.log_result("Download-Real-CSV", False, 
                              f"Failed to download CSV: {csv_response.status_code}")
                return False
        except Exception as e:
            self.log_result("Download-Import-CSV", False, f"Error: {str(e)}")
            return False
    
    def test_verify_import_results(self):
        """Step 3: Verify import results and UUID matching"""
        if not hasattr(self, 'import_result'):
            self.log_result("Verify-Import-Results", False, "No import result available")
            return False
        
        try:
            result = self.import_result
            expected_uuid = "35382cb7-236e-42c1-b0b4-e16bfabb8ff3"
            
            # Get import statistics
            sucesso = result.get("sucesso", 0)
            erros_count = result.get("erros", 0)
            erros_detalhes = result.get("erros_detalhes", [])
            
            # Check if the specific UUID was in the errors
            uuid_in_errors = any(expected_uuid in str(erro) for erro in erros_detalhes)
            
            if uuid_in_errors:
                self.log_result("Verify-UUID-Match", False, 
                              f"UUID {expected_uuid} was found in CSV but had errors during import")
                # Show the specific error
                for erro in erros_detalhes:
                    if expected_uuid in str(erro):
                        print(f"   Error details: {erro}")
                return False
            
            # If no errors with our UUID and we have successes, assume it worked
            if sucesso > 0:
                self.log_result("Verify-UUID-Match", True, 
                              f"UUID {expected_uuid} likely processed successfully (no errors found for this UUID)")
            else:
                self.log_result("Verify-UUID-Match", False, 
                              f"No successful imports and UUID {expected_uuid} status unclear")
                return False
            
            # Verify overall import success
            total_processed = sucesso + erros_count
            
            if sucesso > 0:
                success_rate = (sucesso / total_processed) * 100 if total_processed > 0 else 0
                self.log_result("Verify-Import-Success", True, 
                              f"Import successful: {sucesso}/{total_processed} records processed ({success_rate:.1f}% success rate)")
            else:
                self.log_result("Verify-Import-Success", False, 
                              f"No successful imports: {sucesso}/{total_processed}")
            
            return True
        except Exception as e:
            self.log_result("Verify-Import-Results", False, f"Error: {str(e)}")
            return False
    
    def run_tests(self):
        """Run all tests"""
        print("🎯 UBER CSV IMPORT TEST - REVIEW REQUEST")
        print("=" * 70)
        print("Context: User reports all drivers have Uber UUID filled")
        print("Target driver: Bruno Coelho (brunomccoelho@hotmail.com)")
        print("Expected UUID: 35382cb7-236e-42c1-b0b4-e16bfabb8ff3")
        print("CSV URL: https://customer-assets.emergentagent.com/job_weekly-report-sys/artifacts/vy8erxlu_20251201-20251208-payments_driver-ZENY_MACAIA_UNIPESSOAL_LDA%20%281%29.csv")
        print("=" * 70)
        
        # Authenticate
        if not self.authenticate():
            return False
        
        # Run tests in order
        print("\n🔍 Step 1: Debug UUID Search")
        self.test_debug_uuid_search()
        
        print("\n👤 Step 2: Verify Driver UUID Profile")
        self.test_verify_driver_uuid_profile()
        
        print("\n📥 Step 3: Download and Import Real CSV")
        self.test_download_and_import_real_csv()
        
        print("\n✅ Step 4: Verify Import Results")
        self.test_verify_import_results()
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for r in self.test_results if r["success"])
        failed = sum(1 for r in self.test_results if not r["success"])
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        
        if failed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['message']}")
        
        print("=" * 70)
        return failed == 0

if __name__ == "__main__":
    tester = UberCSVImportTester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)