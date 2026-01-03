#!/usr/bin/env python3
"""
Additional validation tests for Despesas CSV Import
Tests edge cases and validation logic
"""

import requests
import json
import tempfile
import csv
import os

BACKEND_URL = "https://fleetmanager-24.preview.emergentagent.com/api"
TEST_CREDENTIALS = {"email": "admin@tvdefleet.com", "password": "123456"}

def authenticate():
    """Get auth token"""
    response = requests.post(f"{BACKEND_URL}/auth/login", json=TEST_CREDENTIALS)
    if response.status_code == 200:
        return response.json()["access_token"]
    return None

def create_invalid_csv():
    """Create CSV with invalid data"""
    csv_data = [
        ["License Plate", "Entry Date", "Exit Date", "Value", "Liquid Value"],
        ["", "2024-01-15", "2024-01-15", "2.50", "2.30"],  # Empty matricula
        ["INVALID-PLATE", "invalid-date", "2024-01-15", "abc", "2.30"],  # Invalid data
        ["XY-99-ZZ", "2024-01-15", "2024-01-15", "5.80", "5.50"],  # Non-existent vehicle
    ]
    
    temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
    writer = csv.writer(temp_file)
    writer.writerows(csv_data)
    temp_file.close()
    return temp_file.name

def create_csv_no_matricula():
    """Create CSV without matricula column"""
    csv_data = [
        ["Date", "Value", "Description"],
        ["2024-01-15", "2.50", "Test expense"],
        ["2024-01-16", "5.80", "Another expense"],
    ]
    
    temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
    writer = csv.writer(temp_file)
    writer.writerows(csv_data)
    temp_file.close()
    return temp_file.name

def test_validation_scenarios():
    """Test various validation scenarios"""
    token = authenticate()
    if not token:
        print("❌ Failed to authenticate")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print("🧪 Testing Validation Scenarios")
    print("=" * 50)
    
    # Test 1: CSV without matricula column
    print("\n1. Testing CSV without matricula column...")
    csv_file = create_csv_no_matricula()
    
    try:
        with open(csv_file, 'rb') as f:
            files = {'file': ('no_matricula.csv', f, 'text/csv')}
            data = {'tipo_fornecedor': 'via_verde'}
            response = requests.post(f"{BACKEND_URL}/despesas/importar", files=files, data=data, headers=headers)
        
        if response.status_code == 400:
            print("✅ Correctly rejected CSV without matricula column")
        else:
            print(f"❌ Expected 400 error, got {response.status_code}")
            print(f"Response: {response.text}")
    finally:
        os.unlink(csv_file)
    
    # Test 2: CSV with invalid data
    print("\n2. Testing CSV with invalid data...")
    csv_file = create_invalid_csv()
    
    try:
        with open(csv_file, 'rb') as f:
            files = {'file': ('invalid_data.csv', f, 'text/csv')}
            data = {'tipo_fornecedor': 'via_verde'}
            response = requests.post(f"{BACKEND_URL}/despesas/importar", files=files, data=data, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Import handled gracefully: {result['registos_importados']} imported, {result['registos_erro']} errors")
            if result['erros']:
                print(f"   Errors: {result['erros'][:2]}")  # Show first 2 errors
        else:
            print(f"❌ Import failed unexpectedly: {response.status_code}")
            print(f"Response: {response.text}")
    finally:
        os.unlink(csv_file)
    
    # Test 3: Test unsupported file format
    print("\n3. Testing unsupported file format...")
    temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
    temp_file.write("This is not a CSV file")
    temp_file.close()
    
    try:
        with open(temp_file.name, 'rb') as f:
            files = {'file': ('test.txt', f, 'text/plain')}
            data = {'tipo_fornecedor': 'via_verde'}
            response = requests.post(f"{BACKEND_URL}/despesas/importar", files=files, data=data, headers=headers)
        
        if response.status_code == 400:
            print("✅ Correctly rejected unsupported file format")
        else:
            print(f"❌ Expected 400 error, got {response.status_code}")
    finally:
        os.unlink(temp_file.name)
    
    # Test 4: Test responsibility logic
    print("\n4. Testing responsibility assignment logic...")
    response = requests.get(f"{BACKEND_URL}/despesas/?limit=5", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        despesas = data.get("despesas", [])
        
        if despesas:
            print("✅ Sample responsibility assignments:")
            for despesa in despesas[:3]:
                matricula = despesa.get("matricula", "N/A")
                tipo_responsavel = despesa.get("tipo_responsavel", "N/A")
                motivo = despesa.get("motivo_responsabilidade", "N/A")
                valor = despesa.get("valor_liquido", 0)
                print(f"   {matricula}: {tipo_responsavel} - €{valor:.2f} ({motivo})")
        else:
            print("ℹ️ No despesas found to check responsibility logic")
    
    print("\n✅ Validation tests completed!")

if __name__ == "__main__":
    test_validation_scenarios()