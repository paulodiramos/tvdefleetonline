"""
RPA Simplificado - Upload de CSV e Exportação
Suporta: Prio Combustível, Prio Elétrico, Verizon GPS, Cartrack GPS
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging
import csv
import io
import json

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rpa", tags=["rpa-simplificado"])

db = get_database()


# ==================== MODELOS ====================

class FornecedorConfig(BaseModel):
    nome: str
    tipo: str  # combustivel_prio, eletrico_prio, gps_verizon, gps_cartrack, outro
    delimitador: str = ";"
    encoding: str = "utf-8"
    skip_linhas: int = 0
    mapeamento: Dict[str, str] = {}
    ativo: bool = True


class ImportacaoStatus(BaseModel):
    id: str
    fornecedor: str
    ficheiro: str
    status: str  # pendente, processando, sucesso, erro
    registos_importados: int = 0
    registos_erro: int = 0
    mensagem: str = ""
    data: str


# ==================== FORNECEDORES DISPONÍVEIS ====================

FORNECEDORES_DISPONIVEIS = [
    {
        "id": "combustivel_prio",
        "nome": "Prio Combustível",
        "icone": "⛽",
        "cor": "#F59E0B",
        "tipo": "combustivel",
        "descricao": "Importar abastecimentos de combustível da Prio",
        "campos_esperados": ["data", "matricula", "litros", "valor", "local"],
        "mapeamento_padrao": {
            "Data": "data",
            "Matrícula": "matricula",
            "Litros": "litros",
            "Valor": "valor",
            "Local": "local",
            "Cartão": "cartao"
        }
    },
    {
        "id": "eletrico_prio",
        "nome": "Prio Elétrico",
        "icone": "🔌",
        "cor": "#8B5CF6",
        "tipo": "carregamento_eletrico",
        "descricao": "Importar carregamentos elétricos da Prio",
        "campos_esperados": ["data", "matricula", "kwh", "valor", "estacao"],
        "mapeamento_padrao": {
            "Data": "data",
            "Matrícula": "matricula",
            "kWh": "kwh",
            "Energia (kWh)": "kwh",
            "Valor": "valor",
            "Estação": "estacao",
            "Cartão": "cartao"
        }
    },
    {
        "id": "gps_verizon",
        "nome": "GPS Verizon",
        "icone": "📍",
        "cor": "#EF4444",
        "tipo": "gps",
        "descricao": "Importar dados de rastreamento GPS Verizon",
        "campos_esperados": ["data", "matricula", "km_percorridos", "tempo_conducao"],
        "mapeamento_padrao": {
            "Date": "data",
            "Vehicle": "matricula",
            "Distance (km)": "km_percorridos",
            "Drive Time": "tempo_conducao",
            "Driver": "motorista"
        }
    },
    {
        "id": "gps_cartrack",
        "nome": "GPS Cartrack",
        "icone": "🛰️",
        "cor": "#3B82F6",
        "tipo": "gps",
        "descricao": "Importar dados de rastreamento GPS Cartrack",
        "campos_esperados": ["data", "matricula", "km_percorridos", "tempo_conducao"],
        "mapeamento_padrao": {
            "Data": "data",
            "Veículo": "matricula",
            "Km Percorridos": "km_percorridos",
            "Tempo de Condução": "tempo_conducao",
            "Condutor": "motorista"
        }
    },
    {
        "id": "outro",
        "nome": "Outro Sistema",
        "icone": "📄",
        "cor": "#6B7280",
        "tipo": "outro",
        "descricao": "Importar dados de outros sistemas via CSV",
        "campos_esperados": [],
        "mapeamento_padrao": {}
    }
]


# ==================== ENDPOINTS FORNECEDORES ====================

@router.get("/fornecedores")
async def listar_fornecedores():
    """Listar fornecedores disponíveis para importação"""
    return FORNECEDORES_DISPONIVEIS


@router.get("/fornecedores/{fornecedor_id}")
async def get_fornecedor(fornecedor_id: str):
    """Obter detalhes de um fornecedor"""
    fornecedor = next((f for f in FORNECEDORES_DISPONIVEIS if f["id"] == fornecedor_id), None)
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    return fornecedor


# ==================== CONFIGURAÇÃO DE IMPORTAÇÃO ====================

@router.get("/configuracoes")
async def listar_configuracoes(
    parceiro_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Listar configurações de importação do parceiro"""
    query = {"ativo": True}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    configs = await db.rpa_configuracoes.find(query, {"_id": 0}).to_list(100)
    return configs


@router.post("/configuracoes")
async def criar_configuracao(
    config: FornecedorConfig,
    current_user: Dict = Depends(get_current_user)
):
    """Criar configuração de importação personalizada"""
    config_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Determinar parceiro_id
    parceiro_id = current_user["id"] if current_user["role"] == "parceiro" else current_user.get("associated_partner_id")
    
    config_doc = {
        "id": config_id,
        "parceiro_id": parceiro_id,
        **config.model_dump(),
        "created_at": now.isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.rpa_configuracoes.insert_one(config_doc)
    
    logger.info(f"✅ Configuração RPA criada: {config.nome} ({config.tipo})")
    
    return {"message": "Configuração criada com sucesso", "id": config_id}


@router.put("/configuracoes/{config_id}")
async def atualizar_configuracao(
    config_id: str,
    updates: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar configuração de importação"""
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.rpa_configuracoes.update_one(
        {"id": config_id},
        {"$set": updates}
    )
    
    return {"message": "Configuração atualizada"}


@router.delete("/configuracoes/{config_id}")
async def eliminar_configuracao(
    config_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar configuração de importação"""
    await db.rpa_configuracoes.update_one(
        {"id": config_id},
        {"$set": {"ativo": False}}
    )
    
    return {"message": "Configuração eliminada"}


# ==================== UPLOAD E PROCESSAMENTO CSV ====================

@router.post("/upload/{fornecedor_id}")
async def upload_csv(
    fornecedor_id: str,
    file: UploadFile = File(...),
    parceiro_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Upload e processamento de ficheiro CSV"""
    
    # Validar fornecedor
    fornecedor = next((f for f in FORNECEDORES_DISPONIVEIS if f["id"] == fornecedor_id), None)
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    
    # Determinar parceiro_id
    if current_user["role"] == "parceiro":
        parceiro_id = current_user["id"]
    elif not parceiro_id:
        parceiro_id = current_user.get("associated_partner_id")
    
    if not parceiro_id:
        raise HTTPException(status_code=400, detail="parceiro_id é obrigatório")
    
    # Criar registo de importação
    importacao_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    importacao = {
        "id": importacao_id,
        "parceiro_id": parceiro_id,
        "fornecedor_id": fornecedor_id,
        "fornecedor_nome": fornecedor["nome"],
        "ficheiro": file.filename,
        "status": "processando",
        "registos_importados": 0,
        "registos_erro": 0,
        "erros": [],
        "created_at": now.isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.rpa_importacoes.insert_one(importacao)
    
    try:
        # Ler ficheiro
        content = await file.read()
        
        # Tentar diferentes encodings
        for encoding in ["utf-8", "latin-1", "windows-1252"]:
            try:
                text = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise HTTPException(status_code=400, detail="Não foi possível ler o ficheiro. Encoding não suportado.")
        
        # Detectar delimitador
        first_line = text.split('\n')[0]
        delimitador = ';' if ';' in first_line else ','
        
        # Parse CSV
        reader = csv.DictReader(io.StringIO(text), delimiter=delimitador)
        rows = list(reader)
        
        if not rows:
            raise HTTPException(status_code=400, detail="Ficheiro vazio ou sem dados válidos")
        
        # Processar registos
        registos_importados = 0
        registos_erro = 0
        erros = []
        
        mapeamento = fornecedor.get("mapeamento_padrao", {})
        
        for idx, row in enumerate(rows):
            try:
                # Mapear campos
                registo = {
                    "id": str(uuid.uuid4()),
                    "importacao_id": importacao_id,
                    "parceiro_id": parceiro_id,
                    "fornecedor_id": fornecedor_id,
                    "tipo": fornecedor["tipo"],
                    "dados_originais": dict(row),
                    "created_at": now.isoformat()
                }
                
                # Aplicar mapeamento
                for csv_col, system_field in mapeamento.items():
                    if csv_col in row:
                        valor = row[csv_col]
                        
                        # Converter valores numéricos
                        if system_field in ["valor", "litros", "kwh", "km_percorridos"]:
                            try:
                                valor = valor.replace(",", ".").replace("€", "").strip()
                                valor = float(valor) if valor else 0
                            except:
                                pass
                        
                        registo[system_field] = valor
                
                # Guardar registo
                collection_name = f"rpa_{fornecedor['tipo']}"
                await db[collection_name].insert_one(registo)
                
                # Se for combustível ou elétrico, criar também na collection de despesas
                if fornecedor["tipo"] in ["combustivel", "carregamento_eletrico"]:
                    despesa = {
                        "id": str(uuid.uuid4()),
                        "parceiro_id": parceiro_id,
                        "tipo": "combustivel" if fornecedor["tipo"] == "combustivel" else "eletrico",
                        "descricao": f"{fornecedor['nome']} - {registo.get('matricula', 'N/A')}",
                        "valor": registo.get("valor", 0),
                        "data": registo.get("data", now.isoformat()[:10]),
                        "matricula": registo.get("matricula"),
                        "litros": registo.get("litros"),
                        "kwh": registo.get("kwh"),
                        "local": registo.get("local") or registo.get("estacao"),
                        "origem": "importacao_rpa",
                        "importacao_id": importacao_id,
                        "created_at": now.isoformat()
                    }
                    await db.despesas.insert_one(despesa)
                
                registos_importados += 1
                
            except Exception as e:
                registos_erro += 1
                erros.append(f"Linha {idx + 2}: {str(e)}")
                logger.warning(f"Erro ao processar linha {idx + 2}: {e}")
        
        # Atualizar importação
        status = "sucesso" if registos_erro == 0 else "sucesso_parcial"
        
        await db.rpa_importacoes.update_one(
            {"id": importacao_id},
            {"$set": {
                "status": status,
                "registos_importados": registos_importados,
                "registos_erro": registos_erro,
                "erros": erros[:10],  # Limitar a 10 erros
                "processado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"✅ Importação concluída: {registos_importados} registos, {registos_erro} erros")
        
        return {
            "success": True,
            "importacao_id": importacao_id,
            "registos_importados": registos_importados,
            "registos_erro": registos_erro,
            "erros": erros[:5] if erros else [],
            "message": f"Importação concluída: {registos_importados} registos importados"
        }
        
    except Exception as e:
        # Atualizar importação com erro
        await db.rpa_importacoes.update_one(
            {"id": importacao_id},
            {"$set": {
                "status": "erro",
                "erro_mensagem": str(e),
                "processado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.error(f"❌ Erro na importação: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/importacoes")
async def listar_importacoes(
    parceiro_id: Optional[str] = None,
    fornecedor_id: Optional[str] = None,
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    """Listar histórico de importações"""
    query = {}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    if fornecedor_id:
        query["fornecedor_id"] = fornecedor_id
    
    importacoes = await db.rpa_importacoes.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return importacoes


@router.get("/importacoes/{importacao_id}")
async def get_importacao(
    importacao_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter detalhes de uma importação"""
    importacao = await db.rpa_importacoes.find_one({"id": importacao_id}, {"_id": 0})
    if not importacao:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    
    return importacao


# ==================== EXPORTAÇÃO CSV ====================

@router.get("/exportar/relatorios-semanais")
async def exportar_relatorios_semanais(
    parceiro_id: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Exportar relatórios semanais em CSV"""
    
    query = {}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    if data_inicio:
        query["data_inicio"] = {"$gte": data_inicio}
    if data_fim:
        query["data_fim"] = {"$lte": data_fim}
    
    # Buscar relatórios
    relatorios = await db.relatorios_semanais.find(
        query,
        {"_id": 0}
    ).sort("data_inicio", -1).to_list(1000)
    
    if not relatorios:
        raise HTTPException(status_code=404, detail="Nenhum relatório encontrado")
    
    # Criar CSV
    output = io.StringIO()
    
    # Definir campos
    campos = [
        "motorista_nome", "motorista_email", "data_inicio", "data_fim",
        "uber_bruto", "uber_liquido", "uber_viagens",
        "bolt_bruto", "bolt_liquido", "bolt_viagens",
        "total_bruto", "total_liquido", "total_viagens",
        "total_comissao", "total_pagar", "status"
    ]
    
    writer = csv.DictWriter(output, fieldnames=campos, delimiter=';')
    writer.writeheader()
    
    for rel in relatorios:
        row = {
            "motorista_nome": rel.get("motorista_nome", ""),
            "motorista_email": rel.get("motorista_email", ""),
            "data_inicio": rel.get("data_inicio", ""),
            "data_fim": rel.get("data_fim", ""),
            "uber_bruto": rel.get("uber", {}).get("bruto", 0),
            "uber_liquido": rel.get("uber", {}).get("liquido", 0),
            "uber_viagens": rel.get("uber", {}).get("viagens", 0),
            "bolt_bruto": rel.get("bolt", {}).get("bruto", 0),
            "bolt_liquido": rel.get("bolt", {}).get("liquido", 0),
            "bolt_viagens": rel.get("bolt", {}).get("viagens", 0),
            "total_bruto": rel.get("total_bruto", 0),
            "total_liquido": rel.get("total_liquido", 0),
            "total_viagens": rel.get("total_viagens", 0),
            "total_comissao": rel.get("total_comissao", 0),
            "total_pagar": rel.get("total_pagar", 0),
            "status": rel.get("status", "")
        }
        writer.writerow(row)
    
    output.seek(0)
    
    filename = f"relatorios_semanais_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/exportar/recibos")
async def exportar_recibos(
    parceiro_id: Optional[str] = None,
    motorista_id: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    status: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Exportar recibos/transações em CSV"""
    
    query = {}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    if motorista_id:
        query["motorista_id"] = motorista_id
    
    if status:
        query["status"] = status
    
    if data_inicio or data_fim:
        query["data"] = {}
        if data_inicio:
            query["data"]["$gte"] = data_inicio
        if data_fim:
            query["data"]["$lte"] = data_fim
    
    # Buscar recibos
    recibos = await db.recibos.find(
        query,
        {"_id": 0}
    ).sort("data", -1).to_list(5000)
    
    if not recibos:
        raise HTTPException(status_code=404, detail="Nenhum recibo encontrado")
    
    # Criar CSV
    output = io.StringIO()
    
    campos = [
        "id", "motorista_nome", "motorista_email", "data", 
        "plataforma", "valor_bruto", "valor_liquido", "viagens",
        "status", "observacoes", "created_at"
    ]
    
    writer = csv.DictWriter(output, fieldnames=campos, delimiter=';')
    writer.writeheader()
    
    for recibo in recibos:
        row = {
            "id": recibo.get("id", ""),
            "motorista_nome": recibo.get("motorista_nome", ""),
            "motorista_email": recibo.get("motorista_email", ""),
            "data": recibo.get("data", ""),
            "plataforma": recibo.get("plataforma", ""),
            "valor_bruto": recibo.get("valor_bruto", 0),
            "valor_liquido": recibo.get("valor_liquido", 0),
            "viagens": recibo.get("viagens", 0),
            "status": recibo.get("status", ""),
            "observacoes": recibo.get("observacoes", ""),
            "created_at": recibo.get("created_at", "")
        }
        writer.writerow(row)
    
    output.seek(0)
    
    filename = f"recibos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/exportar/despesas")
async def exportar_despesas(
    parceiro_id: Optional[str] = None,
    tipo: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Exportar despesas (combustível, elétrico, etc.) em CSV"""
    
    query = {}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    if tipo:
        query["tipo"] = tipo
    
    if data_inicio or data_fim:
        query["data"] = {}
        if data_inicio:
            query["data"]["$gte"] = data_inicio
        if data_fim:
            query["data"]["$lte"] = data_fim
    
    # Buscar despesas
    despesas = await db.despesas.find(
        query,
        {"_id": 0}
    ).sort("data", -1).to_list(5000)
    
    if not despesas:
        raise HTTPException(status_code=404, detail="Nenhuma despesa encontrada")
    
    # Criar CSV
    output = io.StringIO()
    
    campos = [
        "id", "tipo", "descricao", "valor", "data", "matricula",
        "litros", "kwh", "local", "origem", "created_at"
    ]
    
    writer = csv.DictWriter(output, fieldnames=campos, delimiter=';')
    writer.writeheader()
    
    for despesa in despesas:
        row = {
            "id": despesa.get("id", ""),
            "tipo": despesa.get("tipo", ""),
            "descricao": despesa.get("descricao", ""),
            "valor": despesa.get("valor", 0),
            "data": despesa.get("data", ""),
            "matricula": despesa.get("matricula", ""),
            "litros": despesa.get("litros", ""),
            "kwh": despesa.get("kwh", ""),
            "local": despesa.get("local", ""),
            "origem": despesa.get("origem", "manual"),
            "created_at": despesa.get("created_at", "")
        }
        writer.writerow(row)
    
    output.seek(0)
    
    filename = f"despesas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================== ESTATÍSTICAS ====================

@router.get("/estatisticas")
async def get_estatisticas(
    parceiro_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Obter estatísticas de importações RPA"""
    
    query = {}
    
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif parceiro_id:
        query["parceiro_id"] = parceiro_id
    
    # Total importações
    total_importacoes = await db.rpa_importacoes.count_documents(query)
    
    # Importações com sucesso
    query_sucesso = {**query, "status": {"$in": ["sucesso", "sucesso_parcial"]}}
    importacoes_sucesso = await db.rpa_importacoes.count_documents(query_sucesso)
    
    # Importações com erro
    query_erro = {**query, "status": "erro"}
    importacoes_erro = await db.rpa_importacoes.count_documents(query_erro)
    
    # Últimas importações
    ultimas = await db.rpa_importacoes.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Por fornecedor
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$fornecedor_id",
            "total": {"$sum": 1},
            "registos": {"$sum": "$registos_importados"}
        }}
    ]
    
    por_fornecedor = await db.rpa_importacoes.aggregate(pipeline).to_list(10)
    
    return {
        "total_importacoes": total_importacoes,
        "importacoes_sucesso": importacoes_sucesso,
        "importacoes_erro": importacoes_erro,
        "taxa_sucesso": (importacoes_sucesso / total_importacoes * 100) if total_importacoes > 0 else 0,
        "ultimas_importacoes": ultimas,
        "por_fornecedor": por_fornecedor
    }
