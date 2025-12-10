"""
Script para popular a base de dados com dados iniciais de teste
"""
import asyncio
import os
from datetime import datetime, timezone
from uuid import uuid4
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# Configuração
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client['tvdefleet']
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_database():
    """Popula a base de dados com dados iniciais"""
    
    print("🌱 Iniciando população da base de dados...")
    
    # 1. Criar utilizadores base
    print("\n👥 Criando utilizadores...")
    
    users_data = [
        {
            "id": str(uuid4()),
            "email": "admin@tvdefleet.com",
            "password": pwd_context.hash("o72ocUHy"),
            "name": "Admin TVDEFleet",
            "role": "admin",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid4()),
            "email": "gestor@tvdefleet.com",
            "password": pwd_context.hash("OrR44xJ1"),
            "name": "João Silva - Gestor",
            "role": "gestao",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid4()),
            "email": "parceiro@tvdefleet.com",
            "password": pwd_context.hash("UQ1B6DXU"),
            "name": "Maria Santos - Parceira",
            "role": "parceiro",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid4()),
            "email": "operacional@tvdefleet.com",
            "password": pwd_context.hash("rn8rYw7E"),
            "name": "Pedro Costa - Operacional",
            "role": "operacional",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid4()),
            "email": "motorista@tvdefleet.com",
            "password": pwd_context.hash("2rEFuwQO"),
            "name": "Carlos Oliveira - Motorista",
            "role": "motorista",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Check if users already exist
    existing_count = await db.users.count_documents({})
    if existing_count > 0:
        print(f"   ⚠️ Já existem {existing_count} utilizadores. A limpar...")
        await db.users.delete_many({})
    
    await db.users.insert_many(users_data)
    print(f"   ✅ {len(users_data)} utilizadores criados")
    
    # 2. Criar parceiros na coleção parceiros
    print("\n🏢 Criando parceiros...")
    
    parceiro_user = next(u for u in users_data if u['role'] == 'parceiro')
    
    parceiros_data = [
        {
            "id": parceiro_user['id'],
            "email": parceiro_user['email'],
            "nome_empresa": "Santos & Filhos Lda",
            "nif": "123456789",
            "morada": "Rua da Liberdade, 123, Lisboa",
            "telefone": "+351 912 345 678",
            "contacto_responsavel": "Maria Santos",
            "iban": "PT50 0000 0000 0000 0000 0000 0",
            "plano_id": None,
            "status": "ativo",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid4()),
            "email": "parceiro2@tvdefleet.com",
            "nome_empresa": "TransPorto Express",
            "nif": "234567890",
            "morada": "Av. dos Aliados, 456, Porto",
            "telefone": "+351 913 456 789",
            "contacto_responsavel": "António Porto",
            "iban": "PT50 1111 1111 1111 1111 1111 1",
            "plano_id": None,
            "status": "ativo",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid4()),
            "email": "parceiro3@tvdefleet.com",
            "nome_empresa": "Braga Mobility Solutions",
            "nif": "345678901",
            "morada": "Praça da República, 789, Braga",
            "telefone": "+351 914 567 890",
            "contacto_responsavel": "José Braga",
            "iban": "PT50 2222 2222 2222 2222 2222 2",
            "plano_id": None,
            "status": "ativo",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.parceiros.delete_many({})
    await db.parceiros.insert_many(parceiros_data)
    print(f"   ✅ {len(parceiros_data)} parceiros criados")
    
    # 3. Criar alguns planos de exemplo
    print("\n💳 Criando planos...")
    
    planos_data = [
        {
            "id": str(uuid4()),
            "nome": "Plano Básico",
            "descricao": "Ideal para pequenas frotas",
            "preco_mensal": 29.99,
            "preco_anual": 299.90,
            "funcionalidades": ["Gestão de até 5 veículos", "Relatórios básicos", "Suporte por email"],
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid4()),
            "nome": "Plano Profissional",
            "descricao": "Para frotas em crescimento",
            "preco_mensal": 79.99,
            "preco_anual": 799.90,
            "funcionalidades": ["Gestão de até 20 veículos", "Relatórios avançados", "Suporte prioritário", "Integração Moloni"],
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid4()),
            "nome": "Plano Enterprise",
            "descricao": "Para grandes operadores",
            "preco_mensal": 199.99,
            "preco_anual": 1999.90,
            "funcionalidades": ["Veículos ilimitados", "Todos os relatórios", "Suporte 24/7", "API dedicada", "Gestor de conta"],
            "ativo": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.planos.delete_many({})
    await db.planos.insert_many(planos_data)
    print(f"   ✅ {len(planos_data)} planos criados")
    
    # 4. Criar motoristas de exemplo
    print("\n🚗 Criando motoristas...")
    
    motorista_user = next(u for u in users_data if u['role'] == 'motorista')
    
    motoristas_data = [
        {
            "id": motorista_user['id'],
            "email": motorista_user['email'],
            "nome": "Carlos Oliveira",
            "nif": "456789012",
            "carta_conducao": "PT123456789",
            "validade_carta": "2028-12-31",
            "telefone": "+351 915 678 901",
            "parceiro_id": parceiros_data[0]['id'],
            "status": "ativo",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid4()),
            "email": "motorista2@example.com",
            "nome": "Ricardo Silva",
            "nif": "567890123",
            "carta_conducao": "PT234567890",
            "validade_carta": "2027-08-15",
            "telefone": "+351 916 789 012",
            "parceiro_id": parceiros_data[0]['id'],
            "status": "ativo",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.motoristas.delete_many({})
    await db.motoristas.insert_many(motoristas_data)
    print(f"   ✅ {len(motoristas_data)} motoristas criados")
    
    print("\n🎉 Base de dados populada com sucesso!")
    print("\n📊 Resumo:")
    print(f"   - Utilizadores: {await db.users.count_documents({})}")
    print(f"   - Parceiros: {await db.parceiros.count_documents({})}")
    print(f"   - Motoristas: {await db.motoristas.count_documents({})}")
    print(f"   - Planos: {await db.planos.count_documents({})}")

async def main():
    try:
        await seed_database()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
