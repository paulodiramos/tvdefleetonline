#!/usr/bin/env python3
"""
Debug Via Verde Import - Check what's happening
"""

import requests
import json

# Get backend URL from frontend .env
BACKEND_URL = "https://dev-timeline-7.preview.emergentagent.com/api"

# Test credentials
TEST_CREDENTIALS = {
    "parceiro": {"email": "parceiro@tvdefleet.com", "password": "UQ1B6DXU"}
}

def authenticate():
    """Authenticate and get token"""
    creds = TEST_CREDENTIALS["parceiro"]
    response = requests.post(f"{BACKEND_URL}/auth/login", json=creds)
    
    if response.status_code == 200:
        data = response.json()
        return data["access_token"]
    else:
        print(f"❌ Auth failed: {response.status_code}")
        return None

def test_simple_import():
    """Test with a simple CSV to debug"""
    token = authenticate()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Download the real CSV
    csv_url = "https://customer-assets.emergentagent.com/job_weeklyfleethub-1/artifacts/55m8eo52_Transa%C3%A7%C3%B5es%20Detalhadas.csv"
    
    try:
        csv_response = requests.get(csv_url)
        if csv_response.status_code == 200:
            csv_content = csv_response.content
            print(f"✅ CSV downloaded: {len(csv_content)} bytes")
        else:
            print(f"❌ CSV download failed: {csv_response.status_code}")
            return
        
        # Prepare import request
        files = {
            'file': ('via_verde_charging.csv', csv_content, 'text/csv')
        }
        
        data = {
            'periodo_inicio': '2025-12-01',
            'periodo_fim': '2025-12-31'
        }
        
        # Execute import
        response = requests.post(
            f"{BACKEND_URL}/importar/viaverde",
            files=files,
            data=data,
            headers=headers
        )
        
        print(f"\n📊 Import Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"📋 Import Results:")
            for key, value in result.items():
                if key == "erros_detalhes" and isinstance(value, list):
                    print(f"  {key}: {len(value)} errors")
                    for i, error in enumerate(value[:5]):  # Show first 5
                        print(f"    {i+1}. {error}")
                else:
                    print(f"  {key}: {value}")
        else:
            print(f"❌ Import failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_simple_import()