#!/usr/bin/env python3
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from uuid import uuid4
import asyncio
import bcrypt

async def criar_dados_teste():
    # Conectar ao MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017/tvde-fleet')
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_database()
    
    print("🔄 Verificando/criando motorista de teste...")
    
    # Verificar se o usuário já existe
    user_email = "geral@sostoners.pt"
    existing_user = await db.users.find_one({"email": user_email})
    
    if not existing_user:
        # Criar usuário
        password = "teste123"
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        user_id = str(uuid4())
        user_data = {
            "id": user_id,
            "email": user_email,
            "name": "Motorista Teste",
            "hashed_password": hashed_password.decode('utf-8'),
            "role": "motorista",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_data)
        print(f"✅ Usuário criado: {user_email} / senha: {password}")
    else:
        user_id = existing_user["id"]
        print(f"✅ Usuário já existe: {user_email}")
    
    # Verificar se o motorista já existe
    existing_motorista = await db.motoristas.find_one({"email": user_email})
    
    if not existing_motorista:
        # Criar perfil de motorista
        motorista_id = str(uuid4())
        motorista_data = {
            "id": motorista_id,
            "email": user_email,
            "name": "Motorista Teste",
            "phone": "+351912345678",
            "morada_completa": "Rua de Teste, 123",
            "codigo_postal": "1000-001",
            "localidade": "Lisboa",
            "data_nascimento": "1990-01-15",
            "nacionalidade": "Portuguesa",
            "nif": "123456789",
            "numero_seguranca_social": "12345678901",
            "numero_cartao_utente": "987654321",
            "numero_licenca_tvde": "12345/2024",
            "validade_licenca_tvde": "2025-12-31",
            "codigo_registo_criminal": "ABCD-1234-EFGH-5678I",
            "validade_registo_criminal": "2025-06-30",
            "iban": "PT50 0035 0268 00038229130 61",
            "nome_banco": "Caixa Geral de Depósitos",
            "tipo_pagamento": "recibo_verde",
            "emergencia_nome": "Contacto Emergência",
            "emergencia_telefone": "+351912345679",
            "emergencia_email": "emergencia@teste.com",
            "emergencia_morada": "Rua Emergência, 456",
            "emergencia_codigo_postal": "2000-002",
            "emergencia_localidade": "Porto",
            "emergencia_ligacao": "irmao",
            "documents": {},
            "documents_validacao": {},
            "approved": True,
            "status_motorista": "ativo",
            "created_at": datetime.now(timezone.utc),
            "approved_at": datetime.now(timezone.utc)
        }
        await db.motoristas.insert_one(motorista_data)
        print(f"✅ Perfil de motorista criado: {motorista_id}")
    else:
        motorista_id = existing_motorista["id"]
        print(f"✅ Perfil de motorista já existe: {motorista_id}")
    
    # Criar relatório de ganhos
    print("🔄 Criando relatório de ganhos semanal...")
    
    relatorio_data = {
        "id": str(uuid4()),
        "motorista_id": motorista_id,
        "motorista_nome": "Motorista Teste",
        "semana_inicio": "2024-01-01",
        "semana_fim": "2024-01-07",
        "ganhos_uber": 450.00,
        "ganhos_bolt": 350.00,
        "total_ganhos": 800.00,
        "status": "pendente",
        "created_at": datetime.now(timezone.utc)
    }
    
    # Verificar se já existe relatório para este motorista nesta semana
    existing_relatorio = await db.relatorios_semanais.find_one({
        "motorista_id": motorista_id,
        "semana_inicio": "2024-01-01"
    })
    
    if not existing_relatorio:
        await db.relatorios_semanais.insert_one(relatorio_data)
        print(f"✅ Relatório de ganhos criado para a semana 01-01-2024 a 07-01-2024")
    else:
        print(f"✅ Relatório de ganhos já existe para esta semana")
    
    print("\n📋 CREDENCIAIS DE TESTE:")
    print(f"   Email: {user_email}")
    print(f"   Senha: teste123")
    print(f"   Role: motorista")
    print(f"   Motorista ID: {motorista_id}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(criar_dados_teste())
