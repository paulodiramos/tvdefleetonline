#!/usr/bin/env python3
"""
Test the por-motorista endpoint for despesas
"""

import requests
import json

BACKEND_URL = "https://fleetmanager-24.preview.emergentagent.com/api"
TEST_CREDENTIALS = {"email": "admin@tvdefleet.com", "password": "123456"}

def test_por_motorista():
    # Authenticate
    response = requests.post(f"{BACKEND_URL}/auth/login", json=TEST_CREDENTIALS)
    if response.status_code != 200:
        print("❌ Failed to authenticate")
        return
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get motoristas
    response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
    if response.status_code != 200:
        print("❌ Failed to get motoristas")
        return
    
    motoristas = response.json()
    if not motoristas:
        print("ℹ️ No motoristas found")
        return
    
    # Test with first motorista
    motorista = motoristas[0]
    motorista_id = motorista['id']
    motorista_name = motorista.get('name', 'N/A')
    
    print(f"🧪 Testing despesas por motorista: {motorista_name}")
    
    response = requests.get(f"{BACKEND_URL}/despesas/por-motorista/{motorista_id}", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        despesas = data.get("despesas", [])
        resumo = data.get("resumo", {})
        
        print(f"✅ Por motorista API works: {len(despesas)} expenses for {motorista_name}")
        print(f"   Total: €{resumo.get('total_despesas', 0):.2f}")
        
        if despesas:
            print("   Sample expenses:")
            for despesa in despesas[:3]:
                matricula = despesa.get("matricula", "N/A")
                valor = despesa.get("valor_liquido", 0)
                print(f"     {matricula}: €{valor:.2f}")
    else:
        print(f"❌ Por motorista API failed: {response.status_code}")
        print(f"Response: {response.text}")

if __name__ == "__main__":
    test_por_motorista()