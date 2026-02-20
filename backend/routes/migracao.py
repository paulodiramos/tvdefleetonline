"""
Script de migração para corrigir motoristas existentes.
Executa as seguintes correções:
1. Copia campos em falta do users para motoristas (data_nascimento, nif, morada, etc.)
2. Renomeia campos de documentos antigos para novos nomes
3. Cria campo 'documentos' como cópia de 'documents'
"""

from fastapi import APIRouter, Depends, HTTPException
from utils.database import get_database
from utils.auth import get_current_user
from models.user import UserRole
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Obter instância da base de dados
db = get_database()


@router.post("/migrar-motoristas")
async def migrar_motoristas(current_user: dict = Depends(get_current_user)):
    """
    Migra todos os motoristas existentes para o novo formato.
    Apenas admin pode executar.
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    resultados = {
        "total_motoristas": 0,
        "campos_corrigidos": 0,
        "documentos_renomeados": 0,
        "documentos_campo_criado": 0,
        "erros": []
    }
    
    # Mapeamento de campos antigos para novos nos documentos
    mapeamento_docs = {
        "carta_conducao": "carta_conducao_frente",
        "identificacao": "cc_frente"
    }
    
    # Campos a copiar do users para motoristas
    campos_user = [
        "whatsapp", "data_nascimento", "nif", "nacionalidade",
        "morada_completa", "codigo_postal"
    ]
    
    try:
        # Buscar todos os motoristas
        motoristas = await db.motoristas.find({}).to_list(length=None)
        resultados["total_motoristas"] = len(motoristas)
        
        for motorista in motoristas:
            motorista_id = motorista.get("id")
            updates = {}
            
            # 1. Copiar campos do users se não existirem
            user = await db.users.find_one({"id": motorista_id}, {"_id": 0})
            if user:
                for campo in campos_user:
                    if user.get(campo) and not motorista.get(campo):
                        updates[campo] = user[campo]
                        resultados["campos_corrigidos"] += 1
            
            # 2. Renomear campos de documentos antigos
            documents = motorista.get("documents", {})
            docs_updated = False
            
            for antigo, novo in mapeamento_docs.items():
                if documents.get(antigo) and not documents.get(novo):
                    documents[novo] = documents[antigo]
                    # Manter o antigo para retrocompatibilidade
                    docs_updated = True
                    resultados["documentos_renomeados"] += 1
            
            if docs_updated:
                updates["documents"] = documents
            
            # 3. Criar campo 'documentos' como cópia de 'documents'
            if motorista.get("documents") and not motorista.get("documentos"):
                updates["documentos"] = motorista.get("documents", {})
                if docs_updated:
                    updates["documentos"] = documents
                resultados["documentos_campo_criado"] += 1
            
            # Aplicar updates se houver
            if updates:
                await db.motoristas.update_one(
                    {"id": motorista_id},
                    {"$set": updates}
                )
                logger.info(f"Motorista {motorista_id} actualizado: {list(updates.keys())}")
        
        return {
            "success": True,
            "message": "Migração concluída com sucesso",
            "resultados": resultados
        }
        
    except Exception as e:
        logger.error(f"Erro na migração: {str(e)}")
        resultados["erros"].append(str(e))
        return {
            "success": False,
            "message": f"Erro na migração: {str(e)}",
            "resultados": resultados
        }


@router.get("/verificar-migracao")
async def verificar_migracao(current_user: dict = Depends(get_current_user)):
    """
    Verifica quantos motoristas precisam de migração.
    """
    if current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    total = await db.motoristas.count_documents({})
    
    # Motoristas sem campo 'documentos'
    sem_documentos = await db.motoristas.count_documents({
        "documentos": {"$exists": False}
    })
    
    # Motoristas sem campos de dados pessoais
    sem_dados = await db.motoristas.count_documents({
        "$or": [
            {"data_nascimento": {"$exists": False}},
            {"nif": {"$exists": False}},
            {"morada_completa": {"$exists": False}}
        ]
    })
    
    # Motoristas com documentos em formato antigo
    com_docs_antigos = await db.motoristas.count_documents({
        "$or": [
            {"documents.carta_conducao": {"$exists": True, "$ne": None}},
            {"documents.identificacao": {"$exists": True, "$ne": None}}
        ]
    })
    
    return {
        "total_motoristas": total,
        "precisam_migracao": {
            "sem_campo_documentos": sem_documentos,
            "sem_dados_pessoais": sem_dados,
            "com_documentos_formato_antigo": com_docs_antigos
        },
        "migracao_necessaria": sem_documentos > 0 or sem_dados > 0 or com_docs_antigos > 0
    }
