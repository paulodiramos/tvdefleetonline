"""
Rotas para upload e processamento de ficheiros
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging
import os
import uuid
import shutil

from utils.database import get_database
from utils.auth import get_current_user
from services.rpa_processor import processar_download, guardar_no_resumo_semanal

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/uploads", tags=["uploads"])
db = get_database()

# Diretório para guardar ficheiros
UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def calcular_semana_ano(offset_str: str) -> tuple:
    """Calcula semana e ano baseado no offset string"""
    now = datetime.now()
    
    if offset_str == "atual":
        offset = 0
    elif offset_str == "passada":
        offset = 1
    elif offset_str == "anterior":
        offset = 2
    else:
        offset = 0
    
    data = now - timedelta(weeks=offset)
    iso_cal = data.isocalendar()
    return iso_cal[1], iso_cal[0]


@router.post("/ficheiro")
async def upload_ficheiro(
    file: UploadFile = File(...),
    plataforma: str = Form(...),
    motorista_id: str = Form(...),
    semana: str = Form("atual"),
    current_user: dict = Depends(get_current_user)
):
    """
    Faz upload de um ficheiro (PDF, CSV, Excel) para processamento posterior
    """
    try:
        # Validar extensão
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ['.pdf', '.csv', '.xlsx', '.xls']:
            raise HTTPException(status_code=400, detail="Tipo de ficheiro não suportado")
        
        # Gerar ID único
        file_id = str(uuid.uuid4())
        
        # Calcular semana/ano
        semana_num, ano = calcular_semana_ano(semana)
        
        # Criar nome do ficheiro
        safe_filename = f"{file_id}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, safe_filename)
        
        # Guardar ficheiro
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Guardar metadados na DB
        ficheiro_doc = {
            "id": file_id,
            "nome_ficheiro": file.filename,
            "filepath": filepath,
            "plataforma": plataforma,
            "motorista_id": motorista_id,
            "semana": semana_num,
            "ano": ano,
            "processado": False,
            "dados_extraidos": None,
            "parceiro_id": current_user.get("parceiro_id") or current_user.get("id"),
            "enviado_por": current_user.get("id"),
            "enviado_em": datetime.now(timezone.utc).isoformat()
        }
        
        await db.ficheiros_upload.insert_one(ficheiro_doc)
        
        logger.info(f"Ficheiro guardado: {file.filename} para {plataforma}, motorista {motorista_id}")
        
        return {
            "sucesso": True,
            "id": file_id,
            "nome": file.filename,
            "semana": semana_num,
            "ano": ano
        }
        
    except Exception as e:
        logger.error(f"Erro ao fazer upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ficheiros")
async def listar_ficheiros(
    current_user: dict = Depends(get_current_user)
):
    """
    Lista todos os ficheiros enviados pelo utilizador/parceiro
    """
    try:
        query = {}
        
        # Filtrar por parceiro se não for admin
        if current_user.get("role") != "admin":
            parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
            query["parceiro_id"] = parceiro_id
        
        ficheiros = await db.ficheiros_upload.find(
            query,
            {"_id": 0}
        ).sort("enviado_em", -1).to_list(100)
        
        return {"ficheiros": ficheiros}
        
    except Exception as e:
        logger.error(f"Erro ao listar ficheiros: {e}")
        return {"ficheiros": []}


@router.post("/processar/{file_id}")
async def processar_ficheiro(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Processa um ficheiro enviado e importa os dados para o Resumo Semanal
    """
    try:
        # Buscar ficheiro
        ficheiro = await db.ficheiros_upload.find_one({"id": file_id})
        
        if not ficheiro:
            raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
        
        filepath = ficheiro["filepath"]
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Ficheiro não existe no servidor")
        
        plataforma = ficheiro["plataforma"]
        motorista_id = ficheiro["motorista_id"]
        parceiro_id = ficheiro.get("parceiro_id", current_user.get("id"))
        semana = ficheiro["semana"]
        ano = ficheiro["ano"]
        
        # Processar o ficheiro
        logger.info(f"A processar ficheiro: {filepath} para {plataforma}")
        
        # Mapear plataforma para nome esperado pelo processador
        plataforma_map = {
            "uber": "Uber Fleet",
            "bolt": "Bolt Fleet",
            "viaverde": "Via Verde",
            "prio_combustivel": "Prio Combustível",
            "prio_eletrico": "Prio Elétrico"
        }
        plataforma_nome = plataforma_map.get(plataforma, plataforma)
        
        resultado = processar_download(filepath, plataforma_nome)
        
        if not resultado["sucesso"]:
            return {
                "sucesso": False,
                "erro": resultado.get("erro", "Erro ao processar ficheiro")
            }
        
        dados = resultado["dados"]
        
        # Guardar no resumo semanal
        resultado_guardar = await guardar_no_resumo_semanal(
            db,
            parceiro_id=parceiro_id,
            motorista_id=motorista_id,
            semana=semana,
            ano=ano,
            dados=dados,
            plataforma=plataforma_nome
        )
        
        if resultado_guardar["sucesso"]:
            # Atualizar ficheiro como processado
            await db.ficheiros_upload.update_one(
                {"id": file_id},
                {
                    "$set": {
                        "processado": True,
                        "dados_extraidos": dados,
                        "processado_em": datetime.now(timezone.utc).isoformat(),
                        "colecao_destino": resultado_guardar.get("colecao")
                    }
                }
            )
            
            return {
                "sucesso": True,
                "mensagem": f"Dados importados para Semana {semana}/{ano}",
                "dados": dados,
                "colecao": resultado_guardar.get("colecao"),
                "campos": resultado_guardar.get("campos_atualizados", [])
            }
        else:
            return {
                "sucesso": False,
                "erro": resultado_guardar.get("erro", "Erro ao guardar dados")
            }
        
    except Exception as e:
        logger.error(f"Erro ao processar ficheiro: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.delete("/ficheiro/{file_id}")
async def eliminar_ficheiro(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Elimina um ficheiro enviado
    """
    try:
        ficheiro = await db.ficheiros_upload.find_one({"id": file_id})
        
        if not ficheiro:
            raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
        
        # Verificar permissões
        if current_user.get("role") != "admin":
            parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
            if ficheiro.get("parceiro_id") != parceiro_id:
                raise HTTPException(status_code=403, detail="Sem permissão")
        
        # Eliminar ficheiro físico
        filepath = ficheiro.get("filepath")
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        
        # Eliminar da DB
        await db.ficheiros_upload.delete_one({"id": file_id})
        
        return {"sucesso": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao eliminar ficheiro: {e}")
        raise HTTPException(status_code=500, detail=str(e))
