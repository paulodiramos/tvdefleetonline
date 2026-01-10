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
    "eletrico": "despesas_combustivel",  # Electric charges are stored here
    "eletrico_alt": "abastecimentos_eletrico",
    "gps": "viagens_gps"
}


@router.delete("/{importacao_id}")
async def delete_importacao(
    importacao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Delete an import record by ID (which is the ficheiro_nome).
    This will search through all import collections to find and delete the records.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logger.info(f"🗑️ Attempting to delete import: {importacao_id}")
    
    total_deleted = 0
    deleted_from = []
    
    # Try to find and delete from the importacoes collection first
    result = await db.importacoes.find_one_and_delete({"id": importacao_id})
    if result:
        total_deleted += 1
        deleted_from.append("importacoes")
        logger.info(f"✅ Deleted from importacoes collection: {importacao_id}")
    
    # Try each collection to find the record by ficheiro_nome
    for plataforma, collection_name in IMPORT_COLLECTIONS.items():
        try:
            collection = db[collection_name]
            
            # Delete by ficheiro_nome (which is used as ID for grouped imports)
            result = await collection.delete_many({"ficheiro_nome": importacao_id})
            if result.deleted_count > 0:
                total_deleted += result.deleted_count
                deleted_from.append(f"{collection_name}({result.deleted_count})")
                logger.info(f"✅ Deleted {result.deleted_count} records from {collection_name}")
            
            # Also try by id field (for individual records)
            result = await collection.find_one_and_delete({"id": importacao_id})
            if result:
                total_deleted += 1
                deleted_from.append(collection_name)
                logger.info(f"✅ Deleted single record from {collection_name}")
        except Exception as e:
            logger.warning(f"⚠️ Error checking {collection_name}: {e}")
            continue
    
    # Also check despesas_fornecedor for Via Verde imports
    try:
        result = await db.despesas_fornecedor.delete_many({"ficheiro_nome": importacao_id})
        if result.deleted_count > 0:
            total_deleted += result.deleted_count
            deleted_from.append(f"despesas_fornecedor({result.deleted_count})")
            logger.info(f"✅ Deleted {result.deleted_count} records from despesas_fornecedor")
    except Exception as e:
        logger.warning(f"⚠️ Error checking despesas_fornecedor: {e}")
    
    if total_deleted > 0:
        return {
            "success": True, 
            "message": f"Eliminados {total_deleted} registos da importação",
            "deleted_count": total_deleted,
            "collections": deleted_from
        }
    
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
    
    total_updated = 0
    updated_in = []
    
    # Try to update in importacoes collection first
    result = await db.importacoes.find_one_and_update(
        {"id": importacao_id},
        {"$set": update_data},
        return_document=True
    )
    if result:
        total_updated += 1
        updated_in.append("importacoes")
        logger.info(f"✅ Updated status in importacoes collection")
    
    # Try each collection
    for plataforma, collection_name in IMPORT_COLLECTIONS.items():
        try:
            collection = db[collection_name]
            
            # Try to update by ficheiro_nome (for grouped imports)
            result = await collection.update_many(
                {"ficheiro_nome": importacao_id},
                {"$set": update_data}
            )
            if result.modified_count > 0:
                total_updated += result.modified_count
                updated_in.append(f"{collection_name}({result.modified_count})")
                logger.info(f"✅ Updated {result.modified_count} records in {collection_name}")
            
            # Also try by id
            result = await collection.find_one_and_update(
                {"id": importacao_id},
                {"$set": update_data}
            )
            if result:
                total_updated += 1
                updated_in.append(collection_name)
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
            total_updated += result.modified_count
            updated_in.append(f"despesas_fornecedor({result.modified_count})")
            logger.info(f"✅ Updated {result.modified_count} records in despesas_fornecedor")
    except Exception as e:
        logger.warning(f"⚠️ Error updating despesas_fornecedor: {e}")
    
    if total_updated > 0:
        return {
            "success": True,
            "message": f"Estado atualizado em {total_updated} registos",
            "novo_estado": novo_estado,
            "updated_count": total_updated,
            "collections": updated_in
        }
    
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
    
    # Try each collection by ficheiro_nome
    for plataforma, collection_name in IMPORT_COLLECTIONS.items():
        try:
            collection = db[collection_name]
            
            # Try by ficheiro_nome first (most common case)
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
            
            # Try by id field
            result = await collection.find_one({"id": importacao_id}, {"_id": 0})
            if result:
                result["plataforma"] = plataforma
                return result
        except Exception as e:
            logger.warning(f"⚠️ Error checking {collection_name}: {e}")
            continue
    
    raise HTTPException(status_code=404, detail="Importação não encontrada")
