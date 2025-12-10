"""
Script para criar dados de exemplo para o sistema de Pagamentos e Recibos
"""
import asyncio
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from motor.motor_asyncio import AsyncIOMotorClient

# Configuração MongoDB
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'tvdefleet_db')]

async def criar_dados_exemplo():
    """Criar registos de exemplo"""
    
    print("🔍 Buscando parceiros...")
    parceiros = await db.parceiros.find({}, {"_id": 0}).to_list(5)
    
    if len(parceiros) == 0:
        print("❌ Nenhum parceiro encontrado. Crie parceiros primeiro.")
        return
    
    print(f"✅ Encontrados {len(parceiros)} parceiros")
    
    # Limpar registos antigos de exemplo
    await db.pagamentos_recibos.delete_many({"is_exemplo": True})
    await db.recibos.delete_many({"is_exemplo": True})
    print("🗑️  Registos de exemplo antigos removidos")
    
    registos_criados = []
    
    # Criar registos para as últimas 4 semanas
    hoje = datetime.now(timezone.utc)
    
    for semana_offset in range(4):
        # Calcular datas da semana
        data_fim = hoje - timedelta(days=semana_offset * 7)
        data_inicio = data_fim - timedelta(days=6)
        
        for idx, parceiro in enumerate(parceiros[:3]):  # Só 3 parceiros
            registro_id = str(uuid4())
            recibo_id = str(uuid4())
            
            # Valores aleatórios baseados no parceiro
            valor_base = 150 + (idx * 50)
            valor_total = valor_base + (semana_offset * 10)
            
            # Estados variados
            estados = [
                'pendente_recibo',
                'recibo_enviado', 
                'verificar_recibo',
                'aprovado',
                'pagamento_pendente',
                'liquidado'
            ]
            estado = estados[min(semana_offset + idx, len(estados) - 1)]
            
            # Criar registro
            registro = {
                "id": registro_id,
                "parceiro_id": parceiro["id"],
                "email": parceiro.get("email", ""),
                "data_inicio": data_inicio.isoformat(),
                "data_fim": data_fim.isoformat(),
                "valor_total": valor_total,
                "estado": estado,
                "recibo_url": f"/api/recibos/{recibo_id}/pdf",
                "relatorio_enviado": semana_offset < 2,  # Últimas 2 semanas já enviadas
                "data_envio_relatorio": (hoje - timedelta(days=semana_offset * 7 - 1)).isoformat() if semana_offset < 2 else None,
                "pagamento_id": str(uuid4()) if estado == "liquidado" else None,
                "data_pagamento": (hoje - timedelta(days=semana_offset * 7 - 2)).isoformat() if estado == "liquidado" else None,
                "created_at": data_inicio.isoformat(),
                "updated_at": hoje.isoformat(),
                "is_exemplo": True
            }
            
            await db.pagamentos_recibos.insert_one(registro)
            
            # Criar recibo
            recibo = {
                "id": recibo_id,
                "registro_id": registro_id,
                "numero_recibo": f"2025/{str(len(registos_criados) + 1).zfill(4)}",
                "data_emissao": data_fim.isoformat(),
                "valor": valor_total,
                "status": "emitido",
                "pdf_url": f"/api/recibos/{recibo_id}/pdf",
                "parceiro_id": parceiro["id"],
                "periodo": f"{data_inicio.strftime('%d/%m/%Y')} - {data_fim.strftime('%d/%m/%Y')}",
                "descricao": f"Relatório semanal de ganhos e despesas",
                "is_exemplo": True
            }
            
            await db.recibos.insert_one(recibo)
            
            registos_criados.append(registro)
            
            print(f"✅ Criado: Semana {data_inicio.strftime('%d/%m')} - Parceiro {parceiro.get('nome_empresa', parceiro.get('email'))[:20]} - Estado: {estado}")
    
    print(f"\n🎉 Total: {len(registos_criados)} registos criados!")
    print("\n📊 Resumo por estado:")
    
    for estado in set([r['estado'] for r in registos_criados]):
        count = len([r for r in registos_criados if r['estado'] == estado])
        print(f"   - {estado}: {count}")

async def main():
    try:
        await criar_dados_exemplo()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
