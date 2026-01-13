"""
Despesas (Expenses) Routes for FleeTrack
- Import CSV/XLSX from suppliers (Via Verde, etc.)
- Automatic association with vehicles and drivers
- Expense management
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
import logging
import pandas as pd
import io
import os

from utils.database import get_database
from utils.auth import get_current_user
from models.despesas import (
    TipoFornecedorDespesa, TipoResponsavel,
    DespesaFornecedor, ImportacaoDespesas, DespesaCreate,
    VIA_VERDE_COLUMN_MAPPING
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/despesas", tags=["despesas"])

db = get_database()


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"


# ==================== IMPORTAÇÃO ====================

@router.post("/importar")
async def importar_despesas(
    file: UploadFile = File(...),
    tipo_fornecedor: str = Form("via_verde"),
    semana_dados: Optional[int] = Form(None),
    ano_dados: Optional[int] = Form(None),
    semana_relatorio: Optional[int] = Form(None),
    ano_relatorio: Optional[int] = Form(None),
    current_user: Dict = Depends(get_current_user)
):
    """
    Import expenses from CSV/XLSX file
    Automatically associates with vehicles and drivers
    
    Parameters:
    - semana_dados: Week when the expenses occurred
    - ano_dados: Year of the expenses
    - semana_relatorio: Week where expenses should appear in report
    - ano_relatorio: Year of the report
    """
    # Determine parceiro_id
    if current_user["role"] == UserRole.PARCEIRO:
        parceiro_id = current_user["id"]
    else:
        # Admin/Gestao - get from first parceiro or use a default
        parceiro = await db.parceiros.find_one({}, {"_id": 0, "id": 1})
        parceiro_id = parceiro["id"] if parceiro else current_user.get("parceiro_id", current_user["id"])
    
    # Read file
    content = await file.read()
    filename = file.filename.lower()
    
    try:
        if filename.endswith('.xlsx') or filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(content))
        elif filename.endswith('.csv'):
            # Try different encodings
            try:
                df = pd.read_csv(io.BytesIO(content), encoding='utf-8')
            except:
                df = pd.read_csv(io.BytesIO(content), encoding='latin-1')
        else:
            raise HTTPException(status_code=400, detail="Formato de ficheiro não suportado. Use CSV ou XLSX.")
    except Exception as e:
        logger.error(f"Error reading file: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao ler ficheiro: {str(e)}")
    
    # Create import record
    importacao_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    importacao = {
        "id": importacao_id,
        "nome_ficheiro": file.filename,
        "tipo_fornecedor": tipo_fornecedor,
        "parceiro_id": parceiro_id,
        "total_registos": len(df),
        "registos_importados": 0,
        "registos_erro": 0,
        "registos_duplicados": 0,
        "veiculos_encontrados": 0,
        "motoristas_associados": 0,
        "valor_total": 0.0,
        "valor_motoristas": 0.0,
        "valor_parceiro": 0.0,
        "erros": [],
        "status": "processando",
        "semana_dados": semana_dados,
        "ano_dados": ano_dados,
        "semana_relatorio": semana_relatorio,
        "ano_relatorio": ano_relatorio,
        "created_at": now.isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.importacoes_despesas.insert_one(importacao)
    
    # Process rows
    despesas_criadas = []
    erros = []
    veiculos_cache = {}
    motoristas_cache = {}
    
    # Map columns
    column_mapping = {}
    for col in df.columns:
        col_clean = col.strip()
        if col_clean in VIA_VERDE_COLUMN_MAPPING:
            column_mapping[col] = VIA_VERDE_COLUMN_MAPPING[col_clean]
    
    # Find matricula column
    matricula_col = None
    for col, mapped in column_mapping.items():
        if mapped == "matricula":
            matricula_col = col
            break
    
    if not matricula_col:
        # Try to find by common names
        for col in df.columns:
            if "matricula" in col.lower() or "license" in col.lower() or "plate" in col.lower():
                matricula_col = col
                column_mapping[col] = "matricula"
                break
    
    if not matricula_col:
        await db.importacoes_despesas.update_one(
            {"id": importacao_id},
            {"$set": {"status": "erro", "erros": [{"linha": 0, "erro": "Coluna de matrícula não encontrada"}]}}
        )
        raise HTTPException(status_code=400, detail="Coluna de matrícula não encontrada no ficheiro")
    
    # Process each row
    for idx, row in df.iterrows():
        try:
            matricula = str(row[matricula_col]).strip().upper()
            
            if not matricula or matricula == "NAN" or pd.isna(row[matricula_col]):
                continue
            
            # Get vehicle from cache or database
            if matricula not in veiculos_cache:
                veiculo = await db.vehicles.find_one(
                    {"matricula": {"$regex": f"^{matricula}$", "$options": "i"}},
                    {"_id": 0}
                )
                veiculos_cache[matricula] = veiculo
            else:
                veiculo = veiculos_cache[matricula]
            
            veiculo_id = veiculo["id"] if veiculo else None
            motorista_id = None
            tipo_responsavel = TipoResponsavel.VEICULO
            motivo_responsabilidade = "Despesa do veículo (parceiro)"
            
            # Determine responsibility based on contract type
            # aluguer, compra, slot → motorista
            # comissao → veiculo (parceiro)
            if veiculo:
                # Check contract type
                tipo_contrato = veiculo.get("tipo_contrato", {})
                contrato_tipo = None
                
                if isinstance(tipo_contrato, dict):
                    contrato_tipo = tipo_contrato.get("tipo", "").lower()
                elif isinstance(tipo_contrato, str):
                    contrato_tipo = tipo_contrato.lower()
                
                # Contracts that assign expense to motorista: aluguer, compra, slot
                motorista_contracts = ["aluguer", "compra", "slot"]
                is_motorista_contract = any(ct in (contrato_tipo or "") for ct in motorista_contracts)
                
                # Get assigned driver
                motorista_atribuido = veiculo.get("motorista_atribuido") or veiculo.get("motorista_id")
                
                if motorista_atribuido:
                    # Get driver from cache or database
                    if motorista_atribuido not in motoristas_cache:
                        motorista = await db.motoristas.find_one(
                            {"id": motorista_atribuido},
                            {"_id": 0}
                        )
                        motoristas_cache[motorista_atribuido] = motorista
                    else:
                        motorista = motoristas_cache[motorista_atribuido]
                    
                    if motorista:
                        motorista_id = motorista["id"]
                        
                        # Determine responsibility based on contract type
                        # aluguer, compra, slot → despesa do motorista
                        # comissao → despesa do veículo (parceiro)
                        if is_motorista_contract:
                            tipo_responsavel = TipoResponsavel.MOTORISTA
                            motivo_responsabilidade = f"Veículo com contrato {contrato_tipo} - despesa do motorista"
                        else:
                            tipo_responsavel = TipoResponsavel.VEICULO
                            motivo_responsabilidade = "Veículo em comissão - despesa do parceiro"
            
            # Parse values
            valor_bruto = 0.0
            valor_liquido = 0.0
            desconto = 0.0
            
            for col, mapped in column_mapping.items():
                if mapped == "valor_bruto" and col in row:
                    try:
                        valor_bruto = float(row[col]) if pd.notna(row[col]) else 0.0
                    except:
                        valor_bruto = 0.0
                elif mapped == "valor_liquido" and col in row:
                    try:
                        valor_liquido = float(row[col]) if pd.notna(row[col]) else 0.0
                    except:
                        valor_liquido = 0.0
                elif mapped == "desconto" and col in row:
                    try:
                        desconto = float(row[col]) if pd.notna(row[col]) else 0.0
                    except:
                        desconto = 0.0
            
            # Use valor_bruto if valor_liquido is 0
            if valor_liquido == 0 and valor_bruto > 0:
                valor_liquido = valor_bruto - desconto
            
            # Parse dates
            data_entrada = None
            data_saida = None
            data_pagamento = None
            
            for col, mapped in column_mapping.items():
                if col in row and pd.notna(row[col]):
                    try:
                        if mapped == "data_entrada":
                            data_entrada = pd.to_datetime(row[col]).isoformat()
                        elif mapped == "data_saida":
                            data_saida = pd.to_datetime(row[col]).isoformat()
                        elif mapped == "data_pagamento":
                            data_pagamento = pd.to_datetime(row[col]).isoformat()
                    except:
                        pass
            
            # Get other fields
            ponto_entrada = None
            ponto_saida = None
            tipo_servico = None
            descricao_servico = None
            
            for col, mapped in column_mapping.items():
                if col in row and pd.notna(row[col]):
                    if mapped == "ponto_entrada":
                        ponto_entrada = str(row[col])
                    elif mapped == "ponto_saida":
                        ponto_saida = str(row[col])
                    elif mapped == "tipo_servico":
                        tipo_servico = str(row[col])
                    elif mapped == "descricao_servico":
                        descricao_servico = str(row[col])
            
            # Create despesa record
            despesa_id = str(uuid.uuid4())
            
            despesa = {
                "id": despesa_id,
                "tipo_fornecedor": tipo_fornecedor,
                "importacao_id": importacao_id,
                "matricula": matricula,
                "veiculo_id": veiculo_id,
                "motorista_id": motorista_id,
                "parceiro_id": parceiro_id,
                "tipo_responsavel": tipo_responsavel.value if isinstance(tipo_responsavel, TipoResponsavel) else tipo_responsavel,
                "motivo_responsabilidade": motivo_responsabilidade,
                "data_entrada": data_entrada,
                "data_saida": data_saida,
                "data_pagamento": data_pagamento,
                "ponto_entrada": ponto_entrada,
                "ponto_saida": ponto_saida,
                "valor_bruto": valor_bruto,
                "desconto": desconto,
                "valor_liquido": valor_liquido,
                "tipo_servico": tipo_servico,
                "descricao_servico": descricao_servico,
                "semana_dados": semana_dados,
                "ano_dados": ano_dados,
                "semana_relatorio": semana_relatorio,
                "ano_relatorio": ano_relatorio,
                "dados_originais": {k: str(v) if pd.notna(v) else None for k, v in row.to_dict().items()},
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            
            despesas_criadas.append(despesa)
            
        except Exception as e:
            erros.append({
                "linha": idx + 2,  # +2 for header and 0-index
                "matricula": str(row.get(matricula_col, "N/A")),
                "erro": str(e)
            })
    
    # Insert all despesas
    if despesas_criadas:
        await db.despesas_fornecedor.insert_many(despesas_criadas)
    
    # Calculate statistics
    veiculos_encontrados = len([d for d in despesas_criadas if d["veiculo_id"]])
    motoristas_associados = len([d for d in despesas_criadas if d["motorista_id"]])
    valor_total = sum(d["valor_liquido"] for d in despesas_criadas)
    valor_motoristas = sum(d["valor_liquido"] for d in despesas_criadas if d["tipo_responsavel"] == "motorista")
    valor_parceiro = sum(d["valor_liquido"] for d in despesas_criadas if d["tipo_responsavel"] == "veiculo")
    
    # Update import record
    await db.importacoes_despesas.update_one(
        {"id": importacao_id},
        {"$set": {
            "status": "concluido",
            "registos_importados": len(despesas_criadas),
            "registos_erro": len(erros),
            "veiculos_encontrados": veiculos_encontrados,
            "motoristas_associados": motoristas_associados,
            "valor_total": valor_total,
            "valor_motoristas": valor_motoristas,
            "valor_parceiro": valor_parceiro,
            "erros": erros[:50]  # Limit errors stored
        }}
    )
    
    logger.info(f"✅ Importação concluída: {len(despesas_criadas)} registos, {len(erros)} erros")
    
    return {
        "message": "Importação concluída com sucesso",
        "importacao_id": importacao_id,
        "total_registos": len(df),
        "registos_importados": len(despesas_criadas),
        "registos_erro": len(erros),
        "veiculos_encontrados": veiculos_encontrados,
        "motoristas_associados": motoristas_associados,
        "valor_total": round(valor_total, 2),
        "valor_motoristas": round(valor_motoristas, 2),
        "valor_parceiro": round(valor_parceiro, 2),
        "erros": erros[:10]  # Return first 10 errors
    }


@router.post("/preview")
async def preview_importacao(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Preview CSV/XLSX file before import"""
    content = await file.read()
    filename = file.filename.lower()
    
    try:
        if filename.endswith('.xlsx') or filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(content))
        elif filename.endswith('.csv'):
            try:
                df = pd.read_csv(io.BytesIO(content), encoding='utf-8')
            except:
                df = pd.read_csv(io.BytesIO(content), encoding='latin-1')
        else:
            raise HTTPException(status_code=400, detail="Formato não suportado")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler ficheiro: {str(e)}")
    
    # Identify columns
    colunas_identificadas = {}
    for col in df.columns:
        col_clean = col.strip()
        if col_clean in VIA_VERDE_COLUMN_MAPPING:
            colunas_identificadas[col] = VIA_VERDE_COLUMN_MAPPING[col_clean]
        else:
            # Try fuzzy match
            for key, value in VIA_VERDE_COLUMN_MAPPING.items():
                if key.lower() in col.lower() or col.lower() in key.lower():
                    colunas_identificadas[col] = value
                    break
    
    # Get sample data
    sample_data = df.head(10).to_dict('records')
    
    # Clean NaN values
    for row in sample_data:
        for key, value in row.items():
            if pd.isna(value):
                row[key] = None
            elif isinstance(value, (pd.Timestamp, datetime)):
                row[key] = value.isoformat() if hasattr(value, 'isoformat') else str(value)
    
    # Count unique matriculas
    matricula_col = None
    for col, mapped in colunas_identificadas.items():
        if mapped == "matricula":
            matricula_col = col
            break
    
    matriculas_unicas = []
    if matricula_col:
        matriculas_unicas = df[matricula_col].dropna().unique().tolist()
        matriculas_unicas = [str(m).upper() for m in matriculas_unicas if str(m).upper() != "NAN"]
    
    return {
        "nome_ficheiro": file.filename,
        "total_registos": len(df),
        "colunas": list(df.columns),
        "colunas_identificadas": colunas_identificadas,
        "matriculas_unicas": matriculas_unicas[:20],  # First 20
        "total_matriculas": len(matriculas_unicas),
        "sample_data": sample_data
    }


# ==================== LISTAGEM ====================

@router.get("/")
async def listar_despesas(
    veiculo_id: Optional[str] = None,
    motorista_id: Optional[str] = None,
    tipo_responsavel: Optional[str] = None,
    tipo_fornecedor: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: Dict = Depends(get_current_user)
):
    """List expenses with filters"""
    query = {}
    
    # Parceiro filter - handle None user gracefully
    if current_user and current_user.get("role") == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user.get("id")
    
    if veiculo_id:
        query["veiculo_id"] = veiculo_id
    if motorista_id:
        query["motorista_id"] = motorista_id
    if tipo_responsavel:
        query["tipo_responsavel"] = tipo_responsavel
    if tipo_fornecedor:
        query["tipo_fornecedor"] = tipo_fornecedor
    
    # Date filter
    if data_inicio or data_fim:
        query["data_entrada"] = {}
        if data_inicio:
            query["data_entrada"]["$gte"] = data_inicio
        if data_fim:
            query["data_entrada"]["$lte"] = data_fim
    
    despesas = await db.despesas_fornecedor.find(
        query,
        {"_id": 0, "dados_originais": 0}
    ).sort("data_entrada", -1).skip(skip).limit(limit).to_list(limit)
    
    # Add vehicle and driver info
    for despesa in despesas:
        if despesa.get("veiculo_id"):
            veiculo = await db.vehicles.find_one(
                {"id": despesa["veiculo_id"]},
                {"_id": 0, "matricula": 1, "marca": 1, "modelo": 1}
            )
            despesa["veiculo"] = veiculo
        
        if despesa.get("motorista_id"):
            motorista = await db.motoristas.find_one(
                {"id": despesa["motorista_id"]},
                {"_id": 0, "name": 1, "email": 1}
            )
            despesa["motorista"] = motorista
    
    # Get total count
    total = await db.despesas_fornecedor.count_documents(query)
    
    return {
        "despesas": despesas,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.get("/resumo")
async def resumo_despesas(
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Get expense summary"""
    query = {}
    
    # Handle None user gracefully
    if current_user and current_user.get("role") == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user.get("id")
    
    # Filter by month/year if provided
    if mes and ano:
        data_inicio = f"{ano}-{mes:02d}-01"
        if mes == 12:
            data_fim = f"{ano + 1}-01-01"
        else:
            data_fim = f"{ano}-{mes + 1:02d}-01"
        query["data_entrada"] = {"$gte": data_inicio, "$lt": data_fim}
    
    # Aggregate by tipo_responsavel
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$tipo_responsavel",
            "total": {"$sum": "$valor_liquido"},
            "count": {"$sum": 1}
        }}
    ]
    
    resultados = await db.despesas_fornecedor.aggregate(pipeline).to_list(10)
    
    # Aggregate by tipo_fornecedor
    pipeline_fornecedor = [
        {"$match": query},
        {"$group": {
            "_id": "$tipo_fornecedor",
            "total": {"$sum": "$valor_liquido"},
            "count": {"$sum": 1}
        }}
    ]
    
    por_fornecedor = await db.despesas_fornecedor.aggregate(pipeline_fornecedor).to_list(10)
    
    # Total geral
    total_geral = sum(r["total"] for r in resultados)
    
    return {
        "por_responsavel": {r["_id"]: {"total": round(r["total"], 2), "count": r["count"]} for r in resultados},
        "por_fornecedor": {r["_id"]: {"total": round(r["total"], 2), "count": r["count"]} for r in por_fornecedor},
        "total_geral": round(total_geral, 2),
        "total_registos": sum(r["count"] for r in resultados)
    }


@router.get("/por-veiculo/{veiculo_id}")
async def despesas_por_veiculo(
    veiculo_id: str,
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    """Get expenses for a specific vehicle"""
    despesas = await db.despesas_fornecedor.find(
        {"veiculo_id": veiculo_id},
        {"_id": 0, "dados_originais": 0}
    ).sort("data_entrada", -1).limit(limit).to_list(limit)
    
    # Summary
    total_motorista = sum(d["valor_liquido"] for d in despesas if d["tipo_responsavel"] == "motorista")
    total_parceiro = sum(d["valor_liquido"] for d in despesas if d["tipo_responsavel"] == "veiculo")
    
    return {
        "despesas": despesas,
        "resumo": {
            "total_registos": len(despesas),
            "total_motorista": round(total_motorista, 2),
            "total_parceiro": round(total_parceiro, 2),
            "total_geral": round(total_motorista + total_parceiro, 2)
        }
    }


@router.get("/por-motorista/{motorista_id}")
async def despesas_por_motorista(
    motorista_id: str,
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    """Get expenses for a specific driver"""
    despesas = await db.despesas_fornecedor.find(
        {"motorista_id": motorista_id, "tipo_responsavel": "motorista"},
        {"_id": 0, "dados_originais": 0}
    ).sort("data_entrada", -1).limit(limit).to_list(limit)
    
    # Add vehicle info
    for despesa in despesas:
        if despesa.get("veiculo_id"):
            veiculo = await db.vehicles.find_one(
                {"id": despesa["veiculo_id"]},
                {"_id": 0, "matricula": 1, "marca": 1, "modelo": 1}
            )
            despesa["veiculo"] = veiculo
    
    total = sum(d["valor_liquido"] for d in despesas)
    
    return {
        "despesas": despesas,
        "resumo": {
            "total_registos": len(despesas),
            "total_despesas": round(total, 2)
        }
    }


# ==================== IMPORTAÇÕES ====================

@router.get("/importacoes")
async def listar_importacoes(
    limit: int = 20,
    current_user: Dict = Depends(get_current_user)
):
    """List import history"""
    query = {}
    
    # Handle None user gracefully
    if current_user and current_user.get("role") == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user.get("id")
    
    importacoes = await db.importacoes_despesas.find(
        query,
        {"_id": 0, "erros": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return importacoes


@router.get("/importacoes/{importacao_id}")
async def get_importacao(
    importacao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get import details"""
    importacao = await db.importacoes_despesas.find_one(
        {"id": importacao_id},
        {"_id": 0}
    )
    
    if not importacao:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    
    return importacao


@router.delete("/importacoes/{importacao_id}")
async def eliminar_importacao(
    importacao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete import and all associated expenses"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Apenas admin/gestão pode eliminar importações")
    
    # Delete all expenses from this import
    result = await db.despesas_fornecedor.delete_many({"importacao_id": importacao_id})
    
    # Delete import record
    await db.importacoes_despesas.delete_one({"id": importacao_id})
    
    return {
        "message": "Importação e despesas eliminadas",
        "despesas_eliminadas": result.deleted_count
    }



# ==================== RELATÓRIO DE CUSTOS POR FORNECEDOR ====================

@router.get("/relatorio-fornecedores")
async def relatorio_custos_fornecedores(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    ano: Optional[int] = None,
    current_user: Dict = Depends(get_current_user)
):
    """
    Comprehensive report of costs by supplier/category
    Used for the dedicated /relatorio-fornecedores page
    """
    from datetime import datetime, timedelta
    
    query = {}
    
    # Parceiro filter
    if current_user and current_user.get("role") == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user.get("id")
    
    # Date filters
    if data_inicio:
        query.setdefault("data_entrada", {})["$gte"] = data_inicio
    if data_fim:
        query.setdefault("data_entrada", {})["$lte"] = data_fim
    
    # If year specified, filter by that year
    if ano and not data_inicio and not data_fim:
        query["data_entrada"] = {
            "$gte": f"{ano}-01-01",
            "$lte": f"{ano}-12-31"
        }
    
    # 1. Total por categoria de fornecedor
    pipeline_categoria = [
        {"$match": query},
        {"$group": {
            "_id": "$tipo_fornecedor",
            "total": {"$sum": "$valor_liquido"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total": -1}}
    ]
    por_categoria = await db.despesas_fornecedor.aggregate(pipeline_categoria).to_list(20)
    
    # 2. Total por fornecedor específico (nome do fornecedor)
    pipeline_fornecedor = [
        {"$match": query},
        {"$group": {
            "_id": {"nome": "$fornecedor_nome", "tipo": "$tipo_fornecedor"},
            "total": {"$sum": "$valor_liquido"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total": -1}},
        {"$limit": 20}
    ]
    por_fornecedor = await db.despesas_fornecedor.aggregate(pipeline_fornecedor).to_list(20)
    
    # 3. Evolução mensal (últimos 12 meses)
    pipeline_mensal = [
        {"$match": query},
        {"$addFields": {
            "mes_ano": {"$substr": ["$data_entrada", 0, 7]}
        }},
        {"$group": {
            "_id": "$mes_ano",
            "total": {"$sum": "$valor_liquido"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 12}
    ]
    evolucao_mensal = await db.despesas_fornecedor.aggregate(pipeline_mensal).to_list(12)
    
    # 4. Por responsável (motorista vs parceiro)
    pipeline_responsavel = [
        {"$match": query},
        {"$group": {
            "_id": "$tipo_responsavel",
            "total": {"$sum": "$valor_liquido"},
            "count": {"$sum": 1}
        }}
    ]
    por_responsavel = await db.despesas_fornecedor.aggregate(pipeline_responsavel).to_list(10)
    
    # 5. Top veículos com mais despesas
    pipeline_veiculos = [
        {"$match": {**query, "veiculo_id": {"$ne": None}}},
        {"$group": {
            "_id": "$veiculo_id",
            "total": {"$sum": "$valor_liquido"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total": -1}},
        {"$limit": 10}
    ]
    top_veiculos = await db.despesas_fornecedor.aggregate(pipeline_veiculos).to_list(10)
    
    # Enrich with vehicle info
    for v in top_veiculos:
        if v["_id"]:
            veiculo = await db.vehicles.find_one(
                {"id": v["_id"]},
                {"_id": 0, "matricula": 1, "marca": 1, "modelo": 1}
            )
            v["veiculo"] = veiculo
    
    # 6. Top motoristas com mais despesas
    pipeline_motoristas = [
        {"$match": {**query, "motorista_id": {"$ne": None}}},
        {"$group": {
            "_id": "$motorista_id",
            "total": {"$sum": "$valor_liquido"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total": -1}},
        {"$limit": 10}
    ]
    top_motoristas = await db.despesas_fornecedor.aggregate(pipeline_motoristas).to_list(10)
    
    # Enrich with driver info
    for m in top_motoristas:
        if m["_id"]:
            motorista = await db.motoristas.find_one(
                {"id": m["_id"]},
                {"_id": 0, "name": 1, "email": 1}
            )
            m["motorista"] = motorista
    
    # Calculate totals
    total_geral = sum(c["total"] for c in por_categoria)
    total_registos = sum(c["count"] for c in por_categoria)
    
    # Calculate category percentages
    categorias_com_percentagem = []
    for cat in por_categoria:
        categorias_com_percentagem.append({
            "categoria": cat["_id"] or "Não especificado",
            "total": round(cat["total"], 2),
            "count": cat["count"],
            "percentagem": round((cat["total"] / total_geral * 100) if total_geral > 0 else 0, 1)
        })
    
    # Format fornecedores
    fornecedores_formatados = []
    for f in por_fornecedor:
        fornecedores_formatados.append({
            "nome": f["_id"]["nome"] or "Não especificado",
            "tipo": f["_id"]["tipo"] or "outros",
            "total": round(f["total"], 2),
            "count": f["count"]
        })
    
    return {
        "resumo": {
            "total_geral": round(total_geral, 2),
            "total_registos": total_registos,
            "media_por_registo": round(total_geral / total_registos, 2) if total_registos > 0 else 0
        },
        "por_categoria": categorias_com_percentagem,
        "por_fornecedor": fornecedores_formatados,
        "evolucao_mensal": [
            {"mes": e["_id"], "total": round(e["total"], 2), "count": e["count"]}
            for e in evolucao_mensal
        ],
        "por_responsavel": {
            r["_id"] or "nao_especificado": {"total": round(r["total"], 2), "count": r["count"]}
            for r in por_responsavel
        },
        "top_veiculos": [
            {
                "veiculo_id": v["_id"],
                "veiculo": v.get("veiculo"),
                "total": round(v["total"], 2),
                "count": v["count"]
            }
            for v in top_veiculos
        ],
        "top_motoristas": [
            {
                "motorista_id": m["_id"],
                "motorista": m.get("motorista"),
                "total": round(m["total"], 2),
                "count": m["count"]
            }
            for m in top_motoristas
        ]
    }


@router.get("/relatorio-fornecedores/comparativo")
async def comparativo_mensal_fornecedores(
    meses: int = 6,
    current_user: Dict = Depends(get_current_user)
):
    """
    Compare costs by category across last N months
    """
    from datetime import datetime, timedelta
    
    query = {}
    if current_user and current_user.get("role") == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user.get("id")
    
    # Get data for last N months
    hoje = datetime.now()
    data_inicio = (hoje - timedelta(days=meses * 30)).strftime("%Y-%m-01")
    query["data_entrada"] = {"$gte": data_inicio}
    
    pipeline = [
        {"$match": query},
        {"$addFields": {
            "mes_ano": {"$substr": ["$data_entrada", 0, 7]}
        }},
        {"$group": {
            "_id": {"mes": "$mes_ano", "categoria": "$tipo_fornecedor"},
            "total": {"$sum": "$valor_liquido"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.mes": 1}}
    ]
    
    resultados = await db.despesas_fornecedor.aggregate(pipeline).to_list(200)
    
    # Organize by month
    meses_data = {}
    categorias = set()
    
    for r in resultados:
        mes = r["_id"]["mes"]
        categoria = r["_id"]["categoria"] or "outros"
        categorias.add(categoria)
        
        if mes not in meses_data:
            meses_data[mes] = {"mes": mes, "categorias": {}, "total": 0}
        
        meses_data[mes]["categorias"][categoria] = round(r["total"], 2)
        meses_data[mes]["total"] += r["total"]
    
    # Calculate month-over-month changes
    meses_ordenados = sorted(meses_data.values(), key=lambda x: x["mes"])
    for i, mes in enumerate(meses_ordenados):
        mes["total"] = round(mes["total"], 2)
        if i > 0:
            mes_anterior = meses_ordenados[i-1]
            variacao = mes["total"] - mes_anterior["total"]
            mes["variacao"] = round(variacao, 2)
            mes["variacao_percentual"] = round((variacao / mes_anterior["total"] * 100) if mes_anterior["total"] > 0 else 0, 1)
        else:
            mes["variacao"] = 0
            mes["variacao_percentual"] = 0
    
    return {
        "meses": meses_ordenados,
        "categorias": list(categorias)
    }
