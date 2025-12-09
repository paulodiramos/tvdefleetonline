#!/usr/bin/env python3
"""
Debug script to test motorista approval
"""

import requests
import json

# Get backend URL from frontend .env
BACKEND_URL = "https://tvdefleet.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDS = {"email": "admin@tvdefleet.com", "password": "o72ocUHy"}

def authenticate_admin():
    """Authenticate admin user"""
    response = requests.post(f"{BACKEND_URL}/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        data = response.json()
        return data["access_token"]
    else:
        print(f"Failed to authenticate: {response.status_code}")
        return None

def test_motorista_approval():
    """Test motorista approval and plan assignment"""
    token = authenticate_admin()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get motoristas
    motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
    print(f"Get motoristas: {motoristas_response.status_code}")
    
    if motoristas_response.status_code == 200:
        motoristas = motoristas_response.json()
        print(f"Found {len(motoristas)} motoristas")
        
        if motoristas:
            motorista = motoristas[0]
            motorista_id = motorista["id"]
            print(f"Testing with motorista: {motorista.get('name')} (ID: {motorista_id})")
            
            # Check current state
            print(f"Current state - Approved: {motorista.get('approved')}, Plan ID: {motorista.get('plano_id')}")
            
            # Unapprove first
            unapprove_data = {"approved": False, "plano_id": None, "plano_nome": None, "plano_valida_ate": None}
            unapprove_response = requests.put(f"{BACKEND_URL}/motoristas/{motorista_id}", 
                                            json=unapprove_data, headers=headers)
            print(f"Unapprove: {unapprove_response.status_code}")
            
            # Approve motorista
            approve_response = requests.put(f"{BACKEND_URL}/motoristas/{motorista_id}/approve", headers=headers)
            print(f"Approve: {approve_response.status_code}")
            
            if approve_response.status_code == 200:
                approval_result = approve_response.json()
                print(f"Approval result: {json.dumps(approval_result, indent=2)}")
                
                # Get updated motorista
                updated_response = requests.get(f"{BACKEND_URL}/motoristas/{motorista_id}", headers=headers)
                print(f"Get updated motorista: {updated_response.status_code}")
                
                if updated_response.status_code == 200:
                    updated_motorista = updated_response.json()
                    print(f"Updated motorista plan fields:")
                    print(f"  - plano_id: {updated_motorista.get('plano_id')}")
                    print(f"  - plano_nome: {updated_motorista.get('plano_nome')}")
                    print(f"  - plano_valida_ate: {updated_motorista.get('plano_valida_ate')}")
                    print(f"  - approved: {updated_motorista.get('approved')}")
                else:
                    print(f"Failed to get updated motorista: {updated_response.text}")
            else:
                print(f"Approval failed: {approve_response.text}")
        else:
            print("No motoristas found")
    else:
        print(f"Failed to get motoristas: {motoristas_response.text}")

if __name__ == "__main__":
    test_motorista_approval()