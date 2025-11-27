#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def reset_motorista_approval():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["tvdefleet_db"]
    
    # Reset motorista-001 to set documentos_aprovados = False
    result = await db.motoristas.update_one(
        {"id": "motorista-001"},
        {"$set": {"documentos_aprovados": False}}
    )
    
    if result.modified_count > 0:
        print("✅ Motorista documentos_aprovados reset to False")
    else:
        print("❌ Failed to reset motorista")
    
    # Verify the reset
    motorista = await db.motoristas.find_one({"id": "motorista-001"})
    if motorista:
        print(f"Current documentos_aprovados status: {motorista.get('documentos_aprovados', False)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(reset_motorista_approval())