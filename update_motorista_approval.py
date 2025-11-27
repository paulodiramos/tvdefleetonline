#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def update_motorista_approval():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["tvdefleet_db"]
    
    # Update motorista-001 to set documentos_aprovados = True
    result = await db.motoristas.update_one(
        {"id": "motorista-001"},
        {"$set": {"documentos_aprovados": True}}
    )
    
    if result.modified_count > 0:
        print("✅ Motorista documentos_aprovados set to True")
    else:
        print("❌ Failed to update motorista")
    
    # Verify the update
    motorista = await db.motoristas.find_one({"id": "motorista-001"})
    if motorista:
        print(f"Current documentos_aprovados status: {motorista.get('documentos_aprovados', False)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_motorista_approval())