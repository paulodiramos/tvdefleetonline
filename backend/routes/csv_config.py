"""CSV Configuration routes for FleeTrack application"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
import logging
import csv
import io
import re

from utils.database import get_database
from utils.auth import get_current_user
from models.csv_config import (
    CSVConfiguracao, CSVConfiguracaoCreate, CSVConfiguracaoUpdate,
    CSVColumnMapping, get_default_mappings, SYSTEM_FIELDS
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/csv-config", tags=["csv-config"])

db = get_database()


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== CONFIGURATION CRUD ====================

@router.get("/plataformas")
async def get_plataformas_disponiveis(current_user: Dict = Depends(get_current_user)):
    """Get list of available platforms for CSV import"""
    plataformas = [
        {
            "id": "uber",
            "nome": "Uber",
            "descricao": "Ficheiros de pagamentos e viagens da Uber",
            "formatos_suportados": [".csv"],
            "icon": "uber"
        },
        {
            "id": "bolt",
            "nome": "Bolt",
            "descricao": "Ficheiros de ganhos e viagens da Bolt",
            "formatos_suportados": [".csv"],
            "icon": "bolt"
        },
        {
            "id": "via_verde",
            "nome": "Via Verde",
            "descricao": "Ficheiros de portagens Via Verde",
            "formatos_suportados": [".csv", ".xlsx"],
            "icon": "viaverde"
        },
        {
            "id": "combustivel",
            "nome": "Combustível",
            "descricao": "Ficheiros de abastecimentos (elétrico e fóssil)",
            "formatos_suportados": [".csv", ".xlsx"],
            "icon": "fuel"
        },
        {
            "id": "gps",
            "nome": "GPS/Rastreamento",
            "descricao": "Ficheiros de dados de GPS e quilometragem",
            "formatos_suportados": [".csv"],
            "icon": "gps"
        }
    ]
    return plataformas


@router.get("/campos-sistema/{plataforma}")
async def get_campos_sistema(plataforma: str, current_user: Dict = Depends(get_current_user)):
    """Get available system fields for a platform"""
    if plataforma not in SYSTEM_FIELDS:
        raise HTTPException(status_code=400, detail=f"Plataforma '{plataforma}' não reconhecida")
    
    return {
        "plataforma": plataforma,
        "campos": SYSTEM_FIELDS[plataforma]
    }


@router.get("/mapeamentos-padrao/{plataforma}")
async def get_mapeamentos_padrao(plataforma: str, current_user: Dict = Depends(get_current_user)):
    """Get default column mappings for a platform"""
    mappings = get_default_mappings(plataforma)
    if not mappings:
        return {"plataforma": plataforma, "mapeamentos": []}
    
    return {
        "plataforma": plataforma,
        "mapeamentos": [m.model_dump() for m in mappings]
    }


@router.post("")
async def criar_configuracao(
    config_data: CSVConfiguracaoCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new CSV configuration"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # If parceiro, can only create for themselves
    if current_user["role"] == UserRole.PARCEIRO and config_data.parceiro_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot create configuration for another partner")
    
    config_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    config = {
        "id": config_id,
        "parceiro_id": config_data.parceiro_id,
        "plataforma": config_data.plataforma,
        "nome_configuracao": config_data.nome_configuracao,
        "descricao": config_data.descricao,
        "delimitador": config_data.delimitador,
        "encoding": config_data.encoding,
        "skip_linhas": config_data.skip_linhas,
        "mapeamentos": [m.model_dump() for m in config_data.mapeamentos],
        "configuracoes_especificas": config_data.configuracoes_especificas,
        "ativo": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.csv_configuracoes.insert_one(config)
    
    logger.info(f"CSV configuration created: {config_id} for {config_data.plataforma}")
    
    return {"message": "Configuração criada com sucesso", "config_id": config_id}


@router.get("")
async def listar_configuracoes(
    parceiro_id: Optional[str] = None,
    plataforma: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List CSV configurations"""
    query = {}
    
    # Filter by role
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    if plataforma:
        query["plataforma"] = plataforma
    
    configs = await db.csv_configuracoes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return configs


@router.get("/{config_id}")
async def get_configuracao(config_id: str, current_user: Dict = Depends(get_current_user)):
    """Get a specific CSV configuration"""
    config = await db.csv_configuracoes.find_one({"id": config_id}, {"_id": 0})
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuração não encontrada")
    
    # Check access
    if current_user["role"] == UserRole.PARCEIRO and config["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return config


@router.put("/{config_id}")
async def atualizar_configuracao(
    config_id: str,
    update_data: CSVConfiguracaoUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Update a CSV configuration"""
    config = await db.csv_configuracoes.find_one({"id": config_id}, {"_id": 0})
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuração não encontrada")
    
    # Check access
    if current_user["role"] == UserRole.PARCEIRO and config["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if "mapeamentos" in update_dict:
        update_dict["mapeamentos"] = [m.model_dump() if hasattr(m, 'model_dump') else m for m in update_dict["mapeamentos"]]
    
    await db.csv_configuracoes.update_one({"id": config_id}, {"$set": update_dict})
    
    return {"message": "Configuração atualizada com sucesso"}


@router.delete("/{config_id}")
async def eliminar_configuracao(config_id: str, current_user: Dict = Depends(get_current_user)):
    """Delete a CSV configuration"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.csv_configuracoes.delete_one({"id": config_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Configuração não encontrada")
    
    return {"message": "Configuração eliminada com sucesso"}


# ==================== CSV ANALYSIS ====================

@router.post("/analisar-ficheiro")
async def analisar_ficheiro(
    file: UploadFile = File(...),
    delimitador: str = Form(","),
    encoding: str = Form("utf-8"),
    current_user: Dict = Depends(get_current_user)
):
    """
    Analyze a CSV file to detect columns and sample data
    Useful for creating custom mappings
    """
    try:
        content = await file.read()
        
        # Try different encodings if specified one fails
        encodings_to_try = [encoding, 'utf-8', 'latin-1', 'windows-1252']
        decoded_content = None
        used_encoding = None
        
        for enc in encodings_to_try:
            try:
                decoded_content = content.decode(enc)
                used_encoding = enc
                break
            except:
                continue
        
        if not decoded_content:
            raise HTTPException(status_code=400, detail="Não foi possível ler o ficheiro. Verifique o encoding.")
        
        # Remove BOM if present
        if decoded_content.startswith('\ufeff'):
            decoded_content = decoded_content[1:]
        
        # Detect delimiter if not specified
        first_line = decoded_content.split('\n')[0]
        detected_delimitador = delimitador
        
        if delimitador == "auto":
            if ';' in first_line and ',' not in first_line:
                detected_delimitador = ';'
            elif '\t' in first_line:
                detected_delimitador = '\t'
            else:
                detected_delimitador = ','
        
        # Parse CSV
        reader = csv.DictReader(io.StringIO(decoded_content), delimiter=detected_delimitador)
        
        # Get headers
        headers = reader.fieldnames or []
        
        # Get sample rows (first 5)
        sample_rows = []
        for i, row in enumerate(reader):
            if i >= 5:
                break
            sample_rows.append(row)
        
        # Analyze each column
        column_analysis = []
        for header in headers:
            values = [row.get(header, '') for row in sample_rows]
            
            # Detect type
            detected_type = "text"
            
            # Check if money (contains € or has decimal values)
            if any(re.search(r'[€$£]|\d+[.,]\d{2}', str(v)) for v in values if v):
                detected_type = "money"
            # Check if date
            elif any(re.search(r'\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}', str(v)) for v in values if v):
                detected_type = "date"
            # Check if number
            elif all(re.match(r'^-?\d+([.,]\d+)?$', str(v).strip()) for v in values if v and str(v).strip()):
                detected_type = "number"
            
            column_analysis.append({
                "nome_coluna": header,
                "tipo_detectado": detected_type,
                "valores_exemplo": values[:3],
                "tem_valores_vazios": any(not v or not str(v).strip() for v in values)
            })
        
        return {
            "nome_ficheiro": file.filename,
            "tamanho": len(content),
            "encoding_detectado": used_encoding,
            "delimitador_detectado": detected_delimitador,
            "total_colunas": len(headers),
            "total_linhas_amostra": len(sample_rows),
            "colunas": column_analysis,
            "linhas_amostra": sample_rows
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao analisar ficheiro: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== IMPORT WITH CONFIGURATION ====================

@router.post("/importar/{config_id}")
async def importar_com_configuracao(
    config_id: str,
    file: UploadFile = File(...),
    motorista_id: Optional[str] = Form(None),
    current_user: Dict = Depends(get_current_user)
):
    """
    Import a CSV file using a saved configuration
    """
    try:
        # Get configuration
        config = await db.csv_configuracoes.find_one({"id": config_id}, {"_id": 0})
        
        if not config:
            raise HTTPException(status_code=404, detail="Configuração não encontrada")
        
        if not config.get("ativo"):
            raise HTTPException(status_code=400, detail="Configuração não está ativa")
        
        # Check access
        if current_user["role"] == UserRole.PARCEIRO and config["parceiro_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Read file
        content = await file.read()
        
        # Decode
        try:
            decoded_content = content.decode(config.get("encoding", "utf-8"))
        except:
            decoded_content = content.decode("latin-1")
        
        if decoded_content.startswith('\ufeff'):
            decoded_content = decoded_content[1:]
        
        # Parse CSV
        delimitador = config.get("delimitador", ",")
        skip_linhas = config.get("skip_linhas", 0)
        
        lines = decoded_content.split('\n')
        if skip_linhas > 0:
            lines = lines[skip_linhas:]
        
        reader = csv.DictReader(io.StringIO('\n'.join(lines)), delimiter=delimitador)
        
        # Get mappings
        mapeamentos = config.get("mapeamentos", [])
        
        # Create mapping dict
        mapping_dict = {}
        for m in mapeamentos:
            csv_col = m.get("csv_column")
            sys_field = m.get("system_field")
            if csv_col and sys_field:
                mapping_dict[csv_col] = {
                    "field": sys_field,
                    "transform": m.get("transform"),
                    "default": m.get("default_value"),
                    "required": m.get("required", False)
                }
        
        # Process rows
        registos_processados = 0
        registos_salvos = 0
        erros = []
        
        collection_name = f"dados_{config['plataforma']}"
        
        for i, row in enumerate(reader):
            try:
                registo = {
                    "id": str(uuid.uuid4()),
                    "parceiro_id": config["parceiro_id"],
                    "motorista_id": motorista_id,
                    "config_id": config_id,
                    "plataforma": config["plataforma"],
                    "importado_por": current_user["id"],
                    "nome_ficheiro": file.filename,
                    "data_importacao": datetime.now(timezone.utc).isoformat()
                }
                
                # Apply mappings
                for csv_col, mapping_info in mapping_dict.items():
                    valor_original = row.get(csv_col, "")
                    valor_transformado = transform_value(valor_original, mapping_info.get("transform"))
                    
                    if mapping_info.get("required") and not valor_transformado:
                        valor_transformado = mapping_info.get("default")
                        if not valor_transformado:
                            raise ValueError(f"Campo obrigatório vazio: {csv_col}")
                    
                    registo[mapping_info["field"]] = valor_transformado
                
                # Store original data
                registo["dados_originais"] = dict(row)
                
                # Save to database
                await db[collection_name].insert_one(registo)
                registos_salvos += 1
                
            except Exception as e:
                erros.append({"linha": i + 1, "erro": str(e)})
            
            registos_processados += 1
        
        # Log import
        log = {
            "id": str(uuid.uuid4()),
            "config_id": config_id,
            "plataforma": config["plataforma"],
            "ficheiro": file.filename,
            "registos_processados": registos_processados,
            "registos_salvos": registos_salvos,
            "erros": len(erros),
            "parceiro_id": config["parceiro_id"],
            "motorista_id": motorista_id,
            "usuario_id": current_user["id"],
            "data": datetime.now(timezone.utc).isoformat()
        }
        await db.logs_importacao_csv.insert_one(log)
        
        logger.info(f"✅ Importação concluída: {registos_salvos}/{registos_processados} registos")
        
        return {
            "success": True,
            "message": f"{registos_salvos} de {registos_processados} registos importados com sucesso",
            "registos_processados": registos_processados,
            "registos_salvos": registos_salvos,
            "erros": erros[:10] if erros else []  # Return first 10 errors only
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao importar ficheiro: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def transform_value(value: str, transform_type: Optional[str]) -> Any:
    """Transform a CSV value based on type"""
    if not value or not str(value).strip():
        return None
    
    value = str(value).strip()
    
    if transform_type == "money":
        # Remove currency symbols and spaces
        clean = re.sub(r'[€$£\s]', '', value)
        # Replace comma with dot
        clean = clean.replace(',', '.')
        try:
            return float(clean)
        except:
            return 0.0
    
    elif transform_type == "number":
        clean = value.replace(',', '.')
        try:
            return float(clean)
        except:
            return 0.0
    
    elif transform_type == "date":
        # Try common date formats
        formats = [
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%Y/%m/%d",
            "%d.%m.%Y"
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                return dt.strftime("%Y-%m-%d")
            except:
                continue
        return value  # Return original if no format matches
    
    else:
        return value


# ==================== QUICK IMPORT (WITHOUT CONFIG) ====================

@router.post("/importar-rapido/{plataforma}")
async def importar_rapido(
    plataforma: str,
    file: UploadFile = File(...),
    parceiro_id: Optional[str] = Form(None),
    motorista_id: Optional[str] = Form(None),
    current_user: Dict = Depends(get_current_user)
):
    """
    Quick import using default mappings for the platform
    """
    try:
        # Get default mappings
        default_mappings = get_default_mappings(plataforma)
        
        if not default_mappings:
            raise HTTPException(
                status_code=400, 
                detail=f"Plataforma '{plataforma}' não tem mapeamentos padrão. Crie uma configuração personalizada."
            )
        
        # Read and parse file
        content = await file.read()
        
        # Try encodings
        decoded_content = None
        for enc in ['utf-8', 'latin-1', 'windows-1252']:
            try:
                decoded_content = content.decode(enc)
                break
            except:
                continue
        
        if not decoded_content:
            raise HTTPException(status_code=400, detail="Não foi possível ler o ficheiro")
        
        if decoded_content.startswith('\ufeff'):
            decoded_content = decoded_content[1:]
        
        # Detect delimiter
        first_line = decoded_content.split('\n')[0]
        delimiter = ';' if ';' in first_line and ',' not in first_line else ','
        
        reader = csv.DictReader(io.StringIO(decoded_content), delimiter=delimiter)
        
        # Process
        registos_salvos = 0
        collection_name = f"dados_{plataforma}"
        
        # Create mapping dict from defaults
        mapping_dict = {m.csv_column: {"field": m.system_field, "transform": m.transform} for m in default_mappings}
        
        for row in reader:
            try:
                registo = {
                    "id": str(uuid.uuid4()),
                    "parceiro_id": parceiro_id or current_user.get("id"),
                    "motorista_id": motorista_id,
                    "plataforma": plataforma,
                    "importado_por": current_user["id"],
                    "nome_ficheiro": file.filename,
                    "data_importacao": datetime.now(timezone.utc).isoformat()
                }
                
                for csv_col, mapping_info in mapping_dict.items():
                    valor = row.get(csv_col, "")
                    registo[mapping_info["field"]] = transform_value(valor, mapping_info.get("transform"))
                
                registo["dados_originais"] = dict(row)
                
                await db[collection_name].insert_one(registo)
                registos_salvos += 1
                
            except Exception as e:
                logger.warning(f"Erro ao processar linha: {e}")
                continue
        
        return {
            "success": True,
            "message": f"{registos_salvos} registos importados com sucesso",
            "registos_importados": registos_salvos
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na importação rápida: {e}")
        raise HTTPException(status_code=500, detail=str(e))
