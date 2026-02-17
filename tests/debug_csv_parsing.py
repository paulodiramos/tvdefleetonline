#!/usr/bin/env python3
"""
Debug CSV parsing to understand the UUID field issue
"""

import requests
import csv
import io

def debug_csv_parsing():
    """Debug the CSV parsing to understand field names and values"""
    
    # Download the CSV file
    csv_url = "https://customer-assets.emergentagent.com/job_weekly-report-sys/artifacts/vy8erxlu_20251201-20251208-payments_driver-ZENY_MACAIA_UNIPESSOAL_LDA%20%281%29.csv"
    
    print("🔍 DEBUGGING CSV PARSING")
    print("=" * 50)
    
    try:
        # Download CSV
        response = requests.get(csv_url)
        if response.status_code != 200:
            print(f"❌ Failed to download CSV: {response.status_code}")
            return
        
        csv_content = response.content
        print(f"✅ CSV downloaded: {len(csv_content)} bytes")
        
        # Decode and check for BOM
        decoded = csv_content.decode('utf-8-sig')  # This removes BOM if present
        print(f"✅ CSV decoded (BOM removed): {len(decoded)} characters")
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(decoded))
        
        # Show field names
        print(f"\n📋 CSV Field Names ({len(csv_reader.fieldnames)} fields):")
        for i, field in enumerate(csv_reader.fieldnames):
            print(f"   {i+1:2d}. '{field}' (len: {len(field)})")
        
        # Show first few rows
        print(f"\n📊 First 3 Data Rows:")
        for row_num, row in enumerate(csv_reader, start=1):
            if row_num > 3:
                break
            
            print(f"\n   Row {row_num}:")
            uuid_field = row.get('UUID do motorista', '')
            nome_field = row.get('Nome próprio do motorista', '')
            apelido_field = row.get('Apelido do motorista', '')
            
            print(f"     UUID: '{uuid_field}' (len: {len(uuid_field)})")
            print(f"     Nome: '{nome_field}' (len: {len(nome_field)})")
            print(f"     Apelido: '{apelido_field}' (len: {len(apelido_field)})")
            
            # Check if this is Bruno's row
            if 'BRUNO' in nome_field.upper():
                print(f"     🎯 FOUND BRUNO'S ROW!")
                print(f"     Full row keys: {list(row.keys())}")
                for key, value in row.items():
                    if 'UUID' in key.upper() or 'NOME' in key.upper():
                        print(f"       {key}: '{value}'")
        
        # Test the exact field access used in backend
        csv_reader_test = csv.DictReader(io.StringIO(decoded))
        print(f"\n🧪 Testing Backend Field Access:")
        for row_num, row in enumerate(csv_reader_test, start=1):
            if row_num > 3:
                break
            
            # Exact same access as backend
            uuid_motorista = row.get('UUID do motorista', '').strip()
            nome_proprio = row.get('Nome próprio do motorista', '').strip()
            apelido = row.get('Apelido do motorista', '').strip()
            
            print(f"   Row {row_num}: UUID='{uuid_motorista}', Nome='{nome_proprio}', Apelido='{apelido}'")
            
            if 'BRUNO' in nome_proprio.upper():
                print(f"     🎯 BRUNO FOUND: UUID='{uuid_motorista}'")
                if uuid_motorista == "35382cb7-236e-42c1-b0b4-e16bfabb8ff3":
                    print(f"     ✅ UUID MATCHES EXPECTED VALUE!")
                else:
                    print(f"     ❌ UUID MISMATCH! Expected: '35382cb7-236e-42c1-b0b4-e16bfabb8ff3'")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    debug_csv_parsing()