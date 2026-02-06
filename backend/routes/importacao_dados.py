"""
Rotas para importação de dados - Uber, Bolt, Via Verde, Prio
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import logging
import os
import uuid
import shutil

from utils.database import get_database
from utils.auth import get_current_user
from services.rpa_processor import processar_download, guardar_no_resumo_semanal

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/importacao", tags=["importacao"])
db = get_database()

UPLOAD_DIR = "/tmp/importacoes"
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


@router.post("/upload-preview")
async def upload_e_preview(
    file: UploadFile = File(...),
    plataforma: str = Form(...),
    semana: str = Form("passada"),
    current_user: dict = Depends(get_current_user)
):
    """
    Faz upload do ficheiro, processa e retorna preview dos dados
    """
    try:
        # Validar extensão
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ['.pdf', '.csv', '.xlsx', '.xls']:
            raise HTTPException(status_code=400, detail="Tipo de ficheiro não suportado")
        
        file_id = str(uuid.uuid4())
        semana_num, ano = calcular_semana_ano(semana)
        
        # Guardar ficheiro
        safe_filename = f"{file_id}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, safe_filename)
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Mapear plataforma para nome do processador
        plataforma_map = {
            "uber": "Uber Fleet",
            "bolt": "Bolt Fleet",
            "viaverde": "Via Verde",
            "prio_combustivel": "Prio Combustível",
            "prio_eletrico": "Prio Elétrico"
        }
        plataforma_nome = plataforma_map.get(plataforma, plataforma)
        
        # Processar ficheiro
        resultado = processar_download(filepath, plataforma_nome)
        
        if not resultado["sucesso"]:
            # Eliminar ficheiro se falhou
            os.remove(filepath)
            return {
                "sucesso": False,
                "erro": resultado.get("erro", "Não foi possível extrair dados do ficheiro")
            }
        
        # Guardar metadados temporários
        parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
        
        await db.importacoes_temp.insert_one({
            "id": file_id,
            "nome_ficheiro": file.filename,
            "filepath": filepath,
            "plataforma": plataforma,
            "plataforma_nome": plataforma_nome,
            "semana": semana_num,
            "ano": ano,
            "dados": resultado["dados"],
            "parceiro_id": parceiro_id,
            "enviado_por": current_user.get("id"),
            "criado_em": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "sucesso": True,
            "file_id": file_id,
            "dados": resultado["dados"],
            "semana": semana_num,
            "ano": ano,
            "plataforma": plataforma_nome,
            "motorista_sugerido": None  # Pode ser melhorado para sugerir baseado no conteúdo
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro no upload-preview: {e}")
        return {"sucesso": False, "erro": str(e)}


class ConfirmarImportacaoRequest(BaseModel):
    file_id: str
    motorista_id: str
    dados: Dict[str, Any]
    plataforma: str
    semana: int
    ano: int


@router.post("/confirmar")
async def confirmar_importacao(
    data: ConfirmarImportacaoRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Confirma a importação e guarda os dados no resumo semanal
    """
    try:
        # Buscar dados temporários
        temp = await db.importacoes_temp.find_one({"id": data.file_id})
        
        if not temp:
            raise HTTPException(status_code=404, detail="Dados temporários não encontrados")
        
        parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
        
        # Mapear plataforma
        plataforma_map = {
            "uber": "Uber Fleet",
            "bolt": "Bolt Fleet",
            "viaverde": "Via Verde",
            "prio_combustivel": "Prio Combustível",
            "prio_eletrico": "Prio Elétrico"
        }
        plataforma_nome = plataforma_map.get(data.plataforma, data.plataforma)
        
        # Guardar no resumo semanal
        resultado = await guardar_no_resumo_semanal(
            db,
            parceiro_id=parceiro_id,
            motorista_id=data.motorista_id,
            semana=data.semana,
            ano=data.ano,
            dados=data.dados,
            plataforma=plataforma_nome
        )
        
        if not resultado["sucesso"]:
            return {
                "sucesso": False,
                "erro": resultado.get("erro", "Erro ao guardar dados")
            }
        
        # Guardar registo permanente
        await db.importacoes_ficheiros.insert_one({
            "id": data.file_id,
            "nome_ficheiro": temp.get("nome_ficheiro"),
            "filepath": temp.get("filepath"),
            "plataforma": data.plataforma,
            "plataforma_nome": plataforma_nome,
            "motorista_id": data.motorista_id,
            "semana": data.semana,
            "ano": data.ano,
            "dados_extraidos": data.dados,
            "colecao_destino": resultado.get("colecao"),
            "campos_atualizados": resultado.get("campos_atualizados"),
            "parceiro_id": parceiro_id,
            "sincronizado": True,
            "importado_em": datetime.now(timezone.utc).isoformat()
        })
        
        # Eliminar temporário
        await db.importacoes_temp.delete_one({"id": data.file_id})
        
        logger.info(f"Importação confirmada: {data.plataforma} -> motorista {data.motorista_id}, S{data.semana}/{data.ano}")
        
        return {
            "sucesso": True,
            "mensagem": f"Dados importados para Semana {data.semana}/{data.ano}",
            "colecao": resultado.get("colecao"),
            "campos": resultado.get("campos_atualizados", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao confirmar importação: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.get("/ficheiros")
async def listar_ficheiros(
    current_user: dict = Depends(get_current_user)
):
    """
    Lista ficheiros importados
    """
    try:
        query = {}
        
        if current_user.get("role") != "admin":
            parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
            query["parceiro_id"] = parceiro_id
        
        ficheiros = await db.importacoes_ficheiros.find(
            query,
            {"_id": 0}
        ).sort("importado_em", -1).to_list(100)
        
        return {"ficheiros": ficheiros}
        
    except Exception as e:
        logger.error(f"Erro ao listar ficheiros: {e}")
        return {"ficheiros": []}


@router.post("/reprocessar/{file_id}")
async def reprocessar_ficheiro(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Reprocessa um ficheiro já importado
    """
    try:
        ficheiro = await db.importacoes_ficheiros.find_one({"id": file_id})
        
        if not ficheiro:
            raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
        
        parceiro_id = current_user.get("parceiro_id") or current_user.get("id")
        
        # Guardar no resumo semanal
        resultado = await guardar_no_resumo_semanal(
            db,
            parceiro_id=parceiro_id,
            motorista_id=ficheiro["motorista_id"],
            semana=ficheiro["semana"],
            ano=ficheiro["ano"],
            dados=ficheiro["dados_extraidos"],
            plataforma=ficheiro.get("plataforma_nome", ficheiro["plataforma"])
        )
        
        if resultado["sucesso"]:
            await db.importacoes_ficheiros.update_one(
                {"id": file_id},
                {"$set": {
                    "sincronizado": True,
                    "ultima_sincronizacao": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            return {
                "sucesso": True,
                "mensagem": "Dados sincronizados com sucesso"
            }
        else:
            return {
                "sucesso": False,
                "erro": resultado.get("erro")
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao reprocessar: {e}")
        return {"sucesso": False, "erro": str(e)}


@router.delete("/ficheiro/{file_id}")
async def eliminar_ficheiro(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Elimina um ficheiro importado
    """
    try:
        ficheiro = await db.importacoes_ficheiros.find_one({"id": file_id})
        
        if not ficheiro:
            # Verificar também nos temporários
            temp = await db.importacoes_temp.find_one({"id": file_id})
            if temp:
                if temp.get("filepath") and os.path.exists(temp["filepath"]):
                    os.remove(temp["filepath"])
                await db.importacoes_temp.delete_one({"id": file_id})
                return {"sucesso": True}
            raise HTTPException(status_code=404, detail="Ficheiro não encontrado")
        
        # Eliminar ficheiro físico
        if ficheiro.get("filepath") and os.path.exists(ficheiro["filepath"]):
            os.remove(ficheiro["filepath"])
        
        await db.importacoes_ficheiros.delete_one({"id": file_id})
        
        return {"sucesso": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao eliminar: {e}")
        raise HTTPException(status_code=500, detail=str(e))
