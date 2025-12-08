#!/usr/bin/env python3
"""
Detailed test for extintor system and relatório de intervenções
Testing all specific requirements from the review request
"""

import requests
import json
import io
from PIL import Image

BACKEND_URL = "https://tvdemanager-1.preview.emergentagent.com/api"
ADMIN_CREDS = {"email": "admin@tvdefleet.com", "password": "admin123"}

def authenticate():
    """Get admin token"""
    response = requests.post(f"{BACKEND_URL}/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json()["access_token"]
    return None

def create_test_pdf():
    """Create a simple test PDF"""
    pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
190
%%EOF"""
    return io.BytesIO(pdf_content)

def test_detailed_requirements():
    """Test all specific requirements from review request"""
    
    print("🔐 Authenticating...")
    token = authenticate()
    if not token:
        print("❌ Authentication failed")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get a vehicle for testing
    vehicles_response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
    if vehicles_response.status_code != 200 or not vehicles_response.json():
        print("❌ No vehicles available")
        return False
    
    vehicle_id = vehicles_response.json()[0]["id"]
    print(f"📋 Using vehicle ID: {vehicle_id}")
    
    # 1. Test Sistema de Extintor - PUT /api/vehicles/{vehicle_id}
    print("\n1️⃣ Testing Sistema de Extintor - PUT endpoint")
    extintor_data = {
        "extintor": {
            "data_instalacao": "2025-01-15",
            "data_validade": "2026-01-15", 
            "fornecedor": "Extintores Premium Lda",
            "empresa_certificacao": "Certificadora Nacional SA",
            "preco": 89.50
        }
    }
    
    update_response = requests.put(f"{BACKEND_URL}/vehicles/{vehicle_id}", json=extintor_data, headers=headers)
    if update_response.status_code == 200:
        print("✅ Extintor data saved successfully")
        
        # Verify data was saved
        get_response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}", headers=headers)
        if get_response.status_code == 200:
            vehicle = get_response.json()
            extintor = vehicle.get("extintor", {})
            
            required_fields = ["data_instalacao", "data_validade", "fornecedor", "empresa_certificacao", "preco"]
            all_present = all(field in extintor for field in required_fields)
            
            if all_present:
                print("✅ All extintor fields present and saved correctly")
                print(f"   - data_instalacao: {extintor.get('data_instalacao')}")
                print(f"   - data_validade: {extintor.get('data_validade')}")
                print(f"   - fornecedor: {extintor.get('fornecedor')}")
                print(f"   - empresa_certificacao: {extintor.get('empresa_certificacao')}")
                print(f"   - preco: {extintor.get('preco')}")
            else:
                print("❌ Some extintor fields missing")
                return False
        else:
            print("❌ Could not retrieve vehicle data")
            return False
    else:
        print(f"❌ Failed to update extintor data: {update_response.status_code}")
        return False
    
    # 2. Test Upload Certificado Extintor - POST /api/vehicles/{vehicle_id}/upload-extintor-doc
    print("\n2️⃣ Testing Upload Certificado Extintor")
    test_pdf = create_test_pdf()
    files = {'file': ('certificado_extintor.pdf', test_pdf, 'application/pdf')}
    
    upload_response = requests.post(f"{BACKEND_URL}/vehicles/{vehicle_id}/upload-extintor-doc", files=files, headers=headers)
    if upload_response.status_code == 200:
        result = upload_response.json()
        print("✅ Certificate uploaded successfully")
        print(f"   - Response: {result}")
        
        # Verify certificado_url was updated
        get_response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}", headers=headers)
        if get_response.status_code == 200:
            vehicle = get_response.json()
            extintor = vehicle.get("extintor", {})
            certificado_url = extintor.get("certificado_url")
            
            if certificado_url:
                print(f"✅ certificado_url updated: {certificado_url}")
                
                # Verify file is saved in extintor_docs/
                if "extintor_docs" in certificado_url:
                    print("✅ File saved in extintor_docs/ folder")
                else:
                    print("❌ File not saved in extintor_docs/ folder")
                    return False
            else:
                print("❌ certificado_url not updated")
                return False
        else:
            print("❌ Could not retrieve updated vehicle")
            return False
    else:
        print(f"❌ Certificate upload failed: {upload_response.status_code}")
        return False
    
    # 3. Test Servir Arquivo Extintor - GET /api/files/extintor_docs/{filename}
    print("\n3️⃣ Testing Servir Arquivo Extintor")
    # Test with a non-existent file (should return 404, not auth error)
    file_response = requests.get(f"{BACKEND_URL}/files/extintor_docs/test_file.pdf", headers=headers)
    
    if file_response.status_code == 404:
        print("✅ extintor_docs folder accessible (404 for non-existent file)")
    elif file_response.status_code in [401, 403]:
        print("❌ Authentication issue with extintor_docs folder")
        return False
    elif file_response.status_code == 200:
        print("✅ extintor_docs folder accessible (file found)")
    else:
        print(f"❌ Unexpected response: {file_response.status_code}")
        return False
    
    # 4. Test Relatório de Intervenções - GET /api/vehicles/{vehicle_id}/relatorio-intervencoes
    print("\n4️⃣ Testing Relatório de Intervenções")
    
    # First ensure vehicle has seguro and inspeção data
    vehicle_data = {
        "seguro": {
            "seguradora": "Seguradora Teste SA",
            "numero_apolice": "POL789123",
            "data_validade": "2025-08-30",
            "valor": 650.0
        },
        "inspection": {
            "ultima_inspecao": "2024-05-20",
            "proxima_inspecao": "2025-05-20",
            "resultado": "aprovado",
            "valor": 55.0
        }
    }
    
    update_response = requests.put(f"{BACKEND_URL}/vehicles/{vehicle_id}", json=vehicle_data, headers=headers)
    if update_response.status_code != 200:
        print("❌ Could not update vehicle with test data")
        return False
    
    # Now test the relatório endpoint
    relatorio_response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}/relatorio-intervencoes", headers=headers)
    
    if relatorio_response.status_code == 200:
        result = relatorio_response.json()
        print("✅ Relatório de intervenções endpoint accessible")
        
        # Check required structure: {vehicle_id, interventions[], total}
        required_keys = ["vehicle_id", "interventions", "total"]
        missing_keys = [key for key in required_keys if key not in result]
        
        if missing_keys:
            print(f"❌ Missing required keys: {missing_keys}")
            return False
        
        print(f"✅ Required structure present: {required_keys}")
        print(f"   - vehicle_id: {result.get('vehicle_id')}")
        print(f"   - total interventions: {result.get('total')}")
        
        # Check interventions array
        interventions = result.get("interventions", [])
        if not isinstance(interventions, list):
            print("❌ interventions should be an array")
            return False
        
        print(f"✅ interventions is array with {len(interventions)} items")
        
        # Check intervention structure
        if len(interventions) > 0:
            first_intervention = interventions[0]
            required_fields = ["tipo", "descricao", "data", "categoria", "status"]
            missing_fields = [field for field in required_fields if field not in first_intervention]
            
            if missing_fields:
                print(f"❌ Missing intervention fields: {missing_fields}")
                return False
            
            print("✅ Intervention structure correct:")
            print(f"   - tipo: {first_intervention.get('tipo')}")
            print(f"   - descricao: {first_intervention.get('descricao')}")
            print(f"   - data: {first_intervention.get('data')}")
            print(f"   - categoria: {first_intervention.get('categoria')}")
            print(f"   - status: {first_intervention.get('status')}")
            
            # Check status values
            status = first_intervention.get("status")
            valid_statuses = ["pending", "completed"]
            if status in valid_statuses:
                print(f"✅ Status '{status}' is valid")
            else:
                print(f"❌ Invalid status '{status}', should be one of {valid_statuses}")
                return False
            
            # Check for different intervention types
            intervention_types = [i.get("tipo") for i in interventions]
            print(f"✅ Found intervention types: {intervention_types}")
            
        else:
            print("⚠️  No interventions found (this might be expected)")
        
    else:
        print(f"❌ Relatório endpoint failed: {relatorio_response.status_code}")
        return False
    
    print("\n🎉 ALL TESTS PASSED - Sistema de Extintor e Relatório de Intervenções working correctly!")
    return True

if __name__ == "__main__":
    print("=" * 80)
    print("DETAILED TEST - SISTEMA DE EXTINTOR E RELATÓRIO DE INTERVENÇÕES")
    print("=" * 80)
    
    success = test_detailed_requirements()
    
    if success:
        print("\n✅ ALL REQUIREMENTS VERIFIED SUCCESSFULLY!")
    else:
        print("\n❌ SOME REQUIREMENTS FAILED!")
    
    print("=" * 80)