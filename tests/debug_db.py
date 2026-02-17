#!/usr/bin/env python3
"""
Debug script to check database directly
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
ROOT_DIR = Path(__file__).parent / "backend"
load_dotenv(ROOT_DIR / '.env')

async def check_database():
    """Check database for motorista plan fields"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Get all motoristas
    motoristas = await db.motoristas.find({}, {"_id": 0}).to_list(None)
    
    print(f"Found {len(motoristas)} motoristas in database:")
    for m in motoristas:
        print(f"  - ID: {m.get('id')}")
        print(f"    Name: {m.get('name')}")
        print(f"    Approved: {m.get('approved')}")
        print(f"    Plan ID: {m.get('plano_id')}")
        print(f"    Plan Nome: {m.get('plano_nome')}")
        print(f"    Plan Valida Ate: {m.get('plano_valida_ate')}")
        print()
    
    # Check planos_sistema
    planos = await db.planos_sistema.find({"tipo_usuario": "motorista", "preco_mensal": 0}, {"_id": 0}).to_list(None)
    print(f"Found {len(planos)} free motorista plans:")
    for p in planos:
        print(f"  - ID: {p.get('id')}")
        print(f"    Nome: {p.get('nome')}")
        print(f"    Ativo: {p.get('ativo')}")
        print()

if __name__ == "__main__":
    asyncio.run(check_database())