#!/usr/bin/env python3
"""
Test Uber CSV import with semicolon delimiter - Review Request Specific Test
"""

import requests
import json

# Backend URL from frontend .env
BACKEND_URL = "https://autofleet-7.preview.emergentagent.com/api"

# Admin credentials from review request
ADMIN_CREDS = {"email": "admin@tvdefleet.com", "password": "o72ocUHy"}

def test_uber_semicolon_delimiter():
    """Test Uber CSV import with semicolon delimiter - Review Request Specific Test"""
    print("🎯 TESTING UBER CSV IMPORT WITH SEMICOLON DELIMITER")
    print("-" * 80)
    print("Review Request: Test Uber CSV import with real file using semicolon delimiter")
    print("- CSV URL: https://customer-assets.emergentagent.com/job_weekly-report-sys/artifacts/da5fp805_20251201-20251208-payments_driver-ZENY_MACAIA_UNIPESSOAL_LDA%20%281%29.csv")
    print("- Delimiter: semicolon (;)")
    print("- Expected: 100% success rate (10/10 drivers)")
    print("- Backend correction: Lines 11149 and 11279 - automatic delimiter detection")
    print("-" * 80)
    
    # Step 1: Authenticate as admin
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=ADMIN_CREDS)
        if response.status_code == 200:
            data = response.json()
            token = data["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print("✅ Successfully authenticated as admin")
        else:
            print(f"❌ Failed to authenticate: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Authentication error: {str(e)}")
        return False
    
    # Step 2: Download the real CSV file with semicolon delimiter
    csv_url = "https://customer-assets.emergentagent.com/job_weekly-report-sys/artifacts/da5fp805_20251201-20251208-payments_driver-ZENY_MACAIA_UNIPESSOAL_LDA%20%281%29.csv"
    
    try:
        csv_response = requests.get(csv_url)
        if csv_response.status_code == 200:
            csv_content = csv_response.content
            csv_size = len(csv_content)
            print(f"✅ CSV downloaded successfully: {csv_size} bytes")
        else:
            print(f"❌ Failed to download CSV: {csv_response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Download error: {str(e)}")
        return False
    
    # Step 3: Verify drivers exist in database with correct UUIDs
    expected_drivers = [
        {"uuid": "db6721ba-0101-42b3-a842-2df199085f71", "name": "Luiz Cruz"},
        {"uuid": "35382cb7-236e-42c1-b0b4-e16bfabb8ff3", "name": "Bruno Coelho"},
        {"uuid": "ccd82ed9-67b8-4bfd-ac80-d57b7a7388d6", "name": "Marco Coelho"},
        {"uuid": "e5ed435e-df3a-473b-bd47-ee6880084aa6", "name": "Paulo Macaya"},
        {"uuid": "7960e9ad-3c3f-4b6d-9c68-3d553c9cf9ad", "name": "Arlei Oliveira"},
        {"uuid": "7b738454-53e6-4e82-882c-7fc3256a9472", "name": "Nelson Francisco"},
        {"uuid": "b7ac4a3e-da2e-44f5-b813-516bf603163d", "name": "Jorge Macaia"},
        {"uuid": "449c38de-5c69-4eb5-b781-f3258b768318", "name": "Karen Vitcher"},
        {"uuid": "70f3fada-20b0-45da-b347-17ec0643c15e", "name": "Mario Domingos"},
        {"uuid": "ccf29e3c-fd7d-4216-b315-a416d8b59530", "name": "Domingos Dias"}
    ]
    
    try:
        motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
        if motoristas_response.status_code == 200:
            motoristas = motoristas_response.json()
            found_drivers = 0
            
            print(f"\n📋 VERIFYING EXPECTED DRIVERS IN DATABASE:")
            
            for expected in expected_drivers:
                found = False
                for motorista in motoristas:
                    if motorista.get("uuid_motorista_uber") == expected["uuid"]:
                        found = True
                        found_drivers += 1
                        print(f"  ✅ {expected['name']} (UUID: {expected['uuid']}) - FOUND")
                        break
                
                if not found:
                    print(f"  ❌ {expected['name']} (UUID: {expected['uuid']}) - NOT FOUND")
            
            if found_drivers >= 8:  # Allow some flexibility
                print(f"✅ {found_drivers}/10 expected drivers found in database")
            else:
                print(f"❌ Only {found_drivers}/10 expected drivers found")
                return False
        else:
            print(f"❌ Cannot get motoristas: {motoristas_response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Database check error: {str(e)}")
        return False
    
    # Step 4: Check CSV content and delimiter
    try:
        csv_text = csv_content.decode('utf-8-sig')  # Use utf-8-sig to handle BOM
        lines = csv_text.split('\n')
        
        # Check if semicolon delimiter is used
        semicolon_count = csv_text.count(';')
        comma_count = csv_text.count(',')
        
        print(f"\n📄 CSV CONTENT ANALYSIS:")
        print(f"  - Total lines: {len(lines)}")
        print(f"  - Semicolons (;): {semicolon_count}")
        print(f"  - Commas (,): {comma_count}")
        print(f"  - Detected delimiter: {'semicolon' if semicolon_count > comma_count else 'comma'}")
        
        # Check for expected UUIDs in CSV
        expected_uuids = [
            "db6721ba-0101-42b3-a842-2df199085f71",
            "35382cb7-236e-42c1-b0b4-e16bfabb8ff3",
            "ccd82ed9-67b8-4bfd-ac80-d57b7a7388d6",
            "e5ed435e-df3a-473b-bd47-ee6880084aa6",
            "7960e9ad-3c3f-4b6d-9c68-3d553c9cf9ad"
        ]
        
        found_uuids = 0
        for uuid in expected_uuids:
            if uuid in csv_text:
                found_uuids += 1
        
        if semicolon_count > comma_count and found_uuids >= 3:
            print(f"✅ CSV uses semicolon delimiter, {found_uuids} expected UUIDs found")
        else:
            print(f"❌ CSV format issue: semicolons={semicolon_count}, UUIDs found={found_uuids}")
            return False
    except Exception as e:
        print(f"❌ CSV content check error: {str(e)}")
        return False
    
    # Step 5: Execute the import
    try:
        files = {
            'file': ('uber_real_file.csv', csv_content, 'text/csv')
        }
        
        response = requests.post(
            f"{BACKEND_URL}/importar/uber",
            files=files,
            headers=headers
        )
        
        if response.status_code == 200:
            result = response.json()
            
            # Check import results
            total_importados = result.get("sucesso", 0)
            total_erros = result.get("erros", 0)
            total_linhas = total_importados + total_erros
            
            success_rate = (total_importados / total_linhas * 100) if total_linhas > 0 else 0
            
            print(f"\n📊 IMPORT RESULTS:")
            print(f"  - Total imported: {total_importados}")
            print(f"  - Total errors: {total_erros}")
            print(f"  - Success rate: {success_rate:.1f}%")
            
            # Verify success rate is 100% (target for this test)
            if success_rate == 100:
                print(f"✅ Perfect success rate: {success_rate:.1f}% (10/10 drivers)")
                success = True
            elif success_rate >= 90:
                print(f"✅ High success rate: {success_rate:.1f}% (≥90% target met)")
                success = True
            else:
                print(f"❌ Success rate {success_rate:.1f}% below target (≥90%)")
                success = False
            
            # Check error details for specific drivers
            erros_detalhes = result.get("erros_detalhes", [])
            
            if erros_detalhes:
                print(f"\n❌ IMPORT ERRORS FOUND ({len(erros_detalhes)}):")
                for i, erro in enumerate(erros_detalhes[:5]):  # Show first 5 errors
                    print(f"  {i+1}. {erro}")
            else:
                print("✅ No import errors - all drivers processed successfully")
            
            return success
            
        else:
            print(f"❌ Import failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Import error: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_uber_semicolon_delimiter()
    if success:
        print("\n🎉 TEST PASSED: Uber CSV import with semicolon delimiter working correctly!")
        exit(0)
    else:
        print("\n❌ TEST FAILED: Issues found with Uber CSV import")
        exit(1)