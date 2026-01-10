"""Routes for managing import records (importações)"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import logging

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/importacoes", tags=["importacoes"])

db = get_database()


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# Collection mapping for different import types
IMPORT_COLLECTIONS = {
    "uber": "ganhos_uber",
    "bolt": "ganhos_bolt",
    "viaverde": "portagens_viaverde",
    "via_verde": "portagens_viaverde",
    "combustivel": "abastecimentos_combustivel",
    "eletrico": "abastecimentos_eletrico",
    "gps": "viagens_gps"
}


@router.delete("/{importacao_id}")
async def delete_importacao(
    importacao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Delete an import record by ID.
    This will search through all import collections to find and delete the record.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logger.info(f"🗑️ Attempting to delete import: {importacao_id}")
    
    # Try to find and delete from the importacoes collection first
    result = await db.importacoes.find_one_and_delete({"id": importacao_id})
    if result:
        logger.info(f"✅ Deleted from importacoes collection: {importacao_id}")
        return {"success": True, "message": "Importação eliminada com sucesso", "collection": "importacoes"}
    
    # Try each collection to find the record
    for plataforma, collection_name in IMPORT_COLLECTIONS.items():
        try:
            collection = db[collection_name]
            
            # Try to find by id field
            result = await collection.find_one_and_delete({"id": importacao_id})
            if result:
                logger.info(f"✅ Deleted from {collection_name}: {importacao_id}")
                return {"success": True, "message": "Importação eliminada com sucesso", "collection": collection_name}
            
            # Try to find by ficheiro_nome (for grouped imports)
            result = await collection.delete_many({"ficheiro_nome": importacao_id})
            if result.deleted_count > 0:
                logger.info(f"✅ Deleted {result.deleted_count} records from {collection_name} with ficheiro_nome: {importacao_id}")
                return {
                    "success": True, 
                    "message": f"Eliminados {result.deleted_count} registos da importação",
                    "collection": collection_name,
                    "deleted_count": result.deleted_count
                }
        except Exception as e:
            logger.warning(f"⚠️ Error checking {collection_name}: {e}")
            continue
    
    # Also check despesas_fornecedor for Via Verde imports
    try:
        result = await db.despesas_fornecedor.delete_many({"ficheiro_nome": importacao_id})
        if result.deleted_count > 0:
            logger.info(f"✅ Deleted {result.deleted_count} records from despesas_fornecedor")
            return {
                "success": True,
                "message": f"Eliminados {result.deleted_count} registos da importação",
                "collection": "despesas_fornecedor",
                "deleted_count": result.deleted_count
            }
    except Exception as e:
        logger.warning(f"⚠️ Error checking despesas_fornecedor: {e}")
    
    raise HTTPException(status_code=404, detail="Importação não encontrada")


@router.put("/{importacao_id}/estado")
async def update_importacao_status(
    importacao_id: str,
    data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """
    Update the status of an import record.
    Valid states: 'processado', 'pendente', 'erro', 'revisto'
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    novo_estado = data.get("estado")
    if not novo_estado:
        raise HTTPException(status_code=400, detail="Campo 'estado' é obrigatório")
    
    valid_states = ["processado", "pendente", "erro", "revisto"]
    if novo_estado.lower() not in valid_states:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Estados válidos: {', '.join(valid_states)}")
    
    logger.info(f"📝 Updating import status: {importacao_id} -> {novo_estado}")
    
    update_data = {
        "estado": novo_estado.lower(),
        "estado_atualizado_em": datetime.now(timezone.utc).isoformat(),
        "estado_atualizado_por": current_user["id"]
    }
    
    # Try to update in importacoes collection first
    result = await db.importacoes.find_one_and_update(
        {"id": importacao_id},
        {"$set": update_data},
        return_document=True
    )
    if result:
        logger.info(f"✅ Updated status in importacoes collection")
        return {"success": True, "message": "Estado atualizado com sucesso", "novo_estado": novo_estado}
    
    # Try each collection
    for plataforma, collection_name in IMPORT_COLLECTIONS.items():
        try:
            collection = db[collection_name]
            
            # Try to update by id
            result = await collection.find_one_and_update(
                {"id": importacao_id},
                {"$set": update_data}
            )
            if result:
                logger.info(f"✅ Updated status in {collection_name}")
                return {"success": True, "message": "Estado atualizado com sucesso", "novo_estado": novo_estado}
            
            # Try to update by ficheiro_nome (for grouped imports)
            result = await collection.update_many(
                {"ficheiro_nome": importacao_id},
                {"$set": update_data}
            )
            if result.modified_count > 0:
                logger.info(f"✅ Updated {result.modified_count} records in {collection_name}")
                return {
                    "success": True,
                    "message": f"Estado atualizado em {result.modified_count} registos",
                    "novo_estado": novo_estado,
                    "updated_count": result.modified_count
                }
        except Exception as e:
            logger.warning(f"⚠️ Error updating {collection_name}: {e}")
            continue
    
    # Also check despesas_fornecedor
    try:
        result = await db.despesas_fornecedor.update_many(
            {"ficheiro_nome": importacao_id},
            {"$set": update_data}
        )
        if result.modified_count > 0:
            logger.info(f"✅ Updated {result.modified_count} records in despesas_fornecedor")
            return {
                "success": True,
                "message": f"Estado atualizado em {result.modified_count} registos",
                "novo_estado": novo_estado,
                "updated_count": result.modified_count
            }
    except Exception as e:
        logger.warning(f"⚠️ Error updating despesas_fornecedor: {e}")
    
    raise HTTPException(status_code=404, detail="Importação não encontrada")


@router.get("/{importacao_id}")
async def get_importacao(
    importacao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Get details of a specific import record.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Try importacoes collection first
    result = await db.importacoes.find_one({"id": importacao_id}, {"_id": 0})
    if result:
        return result
    
    # Try each collection
    for plataforma, collection_name in IMPORT_COLLECTIONS.items():
        try:
            collection = db[collection_name]
            result = await collection.find_one({"id": importacao_id}, {"_id": 0})
            if result:
                result["plataforma"] = plataforma
                return result
            
            # Try by ficheiro_nome
            records = await collection.find({"ficheiro_nome": importacao_id}, {"_id": 0}).to_list(1000)
            if records:
                return {
                    "id": importacao_id,
                    "plataforma": plataforma,
                    "ficheiro_nome": importacao_id,
                    "total_registos": len(records),
                    "registos": records[:10],  # First 10 records as sample
                    "estado": records[0].get("estado", "processado") if records else "processado"
                }
        except Exception as e:
            logger.warning(f"⚠️ Error checking {collection_name}: {e}")
            continue
    
    raise HTTPException(status_code=404, detail="Importação não encontrada")
