"""
Rotas para Exportação de Dados (Motoristas e Veículos)
Permite exportar dados para CSV com seleção de campos
"""

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from typing import Dict, List, Optional
from datetime import datetime, timezone
import csv
import io
import logging
import uuid

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/exportacao", tags=["exportacao"])
db = get_database()


# Definição dos campos disponíveis para exportação
CAMPOS_MOTORISTAS = {
    "nome": {"label": "Nome", "campo_db": "name", "default": True},
    "email": {"label": "Email", "campo_db": "email", "default": True},
    "telefone": {"label": "Telefone", "campo_db": "phone", "default": True},
    "nif": {"label": "NIF", "campo_db": "nif", "default": True},
    "morada": {"label": "Morada", "campo_db": "morada", "default": False},
    "codigo_postal": {"label": "Código Postal", "campo_db": "codigo_postal", "default": False},
    "cidade": {"label": "Cidade", "campo_db": "cidade", "default": False},
    "data_nascimento": {"label": "Data de Nascimento", "campo_db": "data_nascimento", "default": False},
    "nacionalidade": {"label": "Nacionalidade", "campo_db": "nacionalidade", "default": False},
    "iban": {"label": "IBAN", "campo_db": "iban", "default": False},
    "carta_conducao": {"label": "Carta de Condução", "campo_db": "carta_conducao", "default": True},
    "validade_carta": {"label": "Validade Carta", "campo_db": "validade_carta_conducao", "default": True},
    "certificado_tvde": {"label": "Certificado TVDE", "campo_db": "certificado_tvde", "default": True},
    "validade_tvde": {"label": "Validade TVDE", "campo_db": "validade_certificado_tvde", "default": True},
    "veiculo_atribuido": {"label": "Veículo Atribuído", "campo_db": "veiculo_atribuido", "default": True},
    "estado": {"label": "Estado", "campo_db": "status", "default": True},
    "data_inicio": {"label": "Data de Início", "campo_db": "data_inicio", "default": False},
    "uuid_uber": {"label": "UUID Uber", "campo_db": "uuid_motorista_uber", "default": False},
    "id_bolt": {"label": "ID Bolt", "campo_db": "identificador_motorista_bolt", "default": False},
    "created_at": {"label": "Data de Registo", "campo_db": "created_at", "default": False},
}

CAMPOS_VEICULOS = {
    "matricula": {"label": "Matrícula", "campo_db": "matricula", "default": True},
    "marca": {"label": "Marca", "campo_db": "marca", "default": True},
    "modelo": {"label": "Modelo", "campo_db": "modelo", "default": True},
    "ano": {"label": "Ano", "campo_db": "ano", "default": True},
    "cor": {"label": "Cor", "campo_db": "cor", "default": False},
    "combustivel": {"label": "Combustível", "campo_db": "combustivel", "default": True},
    "cilindrada": {"label": "Cilindrada", "campo_db": "cilindrada", "default": False},
    "potencia": {"label": "Potência", "campo_db": "potencia", "default": False},
    "num_lugares": {"label": "Nº Lugares", "campo_db": "num_lugares", "default": False},
    "num_portas": {"label": "Nº Portas", "campo_db": "num_portas", "default": False},
    "chassi": {"label": "Chassi/VIN", "campo_db": "chassi", "default": False},
    "motorista_atribuido": {"label": "Motorista Atribuído", "campo_db": "motorista_nome", "default": True},
    "estado": {"label": "Estado", "campo_db": "estado", "default": True},
    # Seguro
    "seguradora": {"label": "Seguradora", "campo_db": "seguro.seguradora", "default": True},
    "apolice": {"label": "Nº Apólice", "campo_db": "seguro.apolice", "default": False},
    "validade_seguro": {"label": "Validade Seguro", "campo_db": "seguro.validade", "default": True},
    # Inspeção
    "ultima_inspecao": {"label": "Última Inspeção", "campo_db": "inspecao.ultima_inspecao", "default": True},
    "proxima_inspecao": {"label": "Próxima Inspeção", "campo_db": "inspecao.proxima_inspecao", "default": True},
    # Licenças
    "licenca_tvde": {"label": "Licença TVDE", "campo_db": "licenca_tvde", "default": True},
    "validade_licenca": {"label": "Validade Licença", "campo_db": "validade_licenca_tvde", "default": True},
    # Outros
    "km_atual": {"label": "Km Atual", "campo_db": "km_atual", "default": False},
    "created_at": {"label": "Data de Registo", "campo_db": "created_at", "default": False},
}


def get_nested_value(obj: dict, path: str):
    """Obtém valor de campo aninhado (ex: 'seguro.validade')"""
    keys = path.split('.')
    value = obj
    for key in keys:
        if isinstance(value, dict):
            value = value.get(key)
        else:
            return None
    return value


def format_value(value) -> str:
    """Formata valor para CSV"""
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, bool):
        return "Sim" if value else "Não"
    if isinstance(value, list):
        return "; ".join(str(v) for v in value)
    return str(value)


@router.get("/campos")
async def listar_campos_disponiveis(
    current_user: dict = Depends(get_current_user)
):
    """Lista todos os campos disponíveis para exportação"""
    if current_user["role"] not in ["admin", "parceiro", "gestao"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    return {
        "motoristas": [
            {"id": k, "label": v["label"], "default": v["default"]}
            for k, v in CAMPOS_MOTORISTAS.items()
        ],
        "veiculos": [
            {"id": k, "label": v["label"], "default": v["default"]}
            for k, v in CAMPOS_VEICULOS.items()
        ]
    }


@router.get("/motoristas")
async def exportar_motoristas(
    campos: str = Query(None, description="Campos separados por vírgula"),
    delimitador: str = Query(";", description="Delimitador CSV (vírgula ou ponto-e-vírgula)"),
    current_user: dict = Depends(get_current_user)
):
    """Exportar motoristas para CSV"""
    if current_user["role"] not in ["admin", "parceiro", "gestao"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Determinar campos a exportar
    if campos:
        campos_selecionados = [c.strip() for c in campos.split(",") if c.strip() in CAMPOS_MOTORISTAS]
    else:
        campos_selecionados = [k for k, v in CAMPOS_MOTORISTAS.items() if v["default"]]
    
    if not campos_selecionados:
        raise HTTPException(status_code=400, detail="Nenhum campo válido selecionado")
    
    # Query de motoristas
    query = {}
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif current_user["role"] == "gestao":
        query["parceiro_id"] = current_user.get("associated_partner_id", current_user["id"])
    
    motoristas = await db.motoristas.find(query, {"_id": 0}).to_list(None)
    
    # Buscar veículos para mapear nomes
    veiculos_map = {}
    veiculos = await db.vehicles.find({}, {"_id": 0, "id": 1, "matricula": 1}).to_list(None)
    for v in veiculos:
        veiculos_map[v.get("id")] = v.get("matricula", "")
    
    # Gerar CSV
    output = io.StringIO()
    delimiter = ";" if delimitador == ";" else ","
    
    # Header
    headers = [CAMPOS_MOTORISTAS[c]["label"] for c in campos_selecionados]
    writer = csv.writer(output, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    
    # Dados
    for motorista in motoristas:
        row = []
        for campo in campos_selecionados:
            campo_info = CAMPOS_MOTORISTAS[campo]
            campo_db = campo_info["campo_db"]
            
            # Tratamento especial para veículo atribuído
            if campo == "veiculo_atribuido":
                veiculo_id = motorista.get("veiculo_atribuido") or motorista.get("assigned_vehicle_id")
                value = veiculos_map.get(veiculo_id, "")
            else:
                value = get_nested_value(motorista, campo_db)
            
            row.append(format_value(value))
        
        writer.writerow(row)
    
    # Preparar response
    output.seek(0)
    filename = f"motoristas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    # Adicionar BOM para Excel reconhecer UTF-8
    content = '\ufeff' + output.getvalue()
    
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )


@router.get("/veiculos")
async def exportar_veiculos(
    campos: str = Query(None, description="Campos separados por vírgula"),
    delimitador: str = Query(";", description="Delimitador CSV (vírgula ou ponto-e-vírgula)"),
    current_user: dict = Depends(get_current_user)
):
    """Exportar veículos para CSV"""
    if current_user["role"] not in ["admin", "parceiro", "gestao"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Determinar campos a exportar
    if campos:
        campos_selecionados = [c.strip() for c in campos.split(",") if c.strip() in CAMPOS_VEICULOS]
    else:
        campos_selecionados = [k for k, v in CAMPOS_VEICULOS.items() if v["default"]]
    
    if not campos_selecionados:
        raise HTTPException(status_code=400, detail="Nenhum campo válido selecionado")
    
    # Query de veículos
    query = {}
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif current_user["role"] == "gestao":
        query["parceiro_id"] = current_user.get("associated_partner_id", current_user["id"])
    
    veiculos = await db.vehicles.find(query, {"_id": 0}).to_list(None)
    
    # Buscar motoristas para mapear nomes
    motoristas_map = {}
    motoristas = await db.motoristas.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(None)
    for m in motoristas:
        motoristas_map[m.get("id")] = m.get("name", "")
    
    # Gerar CSV
    output = io.StringIO()
    delimiter = ";" if delimitador == ";" else ","
    
    # Header
    headers = [CAMPOS_VEICULOS[c]["label"] for c in campos_selecionados]
    writer = csv.writer(output, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    
    # Dados
    for veiculo in veiculos:
        row = []
        for campo in campos_selecionados:
            campo_info = CAMPOS_VEICULOS[campo]
            campo_db = campo_info["campo_db"]
            
            # Tratamento especial para motorista atribuído
            if campo == "motorista_atribuido":
                motorista_id = veiculo.get("motorista_atribuido") or veiculo.get("assigned_driver_id")
                value = motoristas_map.get(motorista_id, "")
            else:
                value = get_nested_value(veiculo, campo_db)
            
            row.append(format_value(value))
        
        writer.writerow(row)
    
    # Preparar response
    output.seek(0)
    filename = f"veiculos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    # Adicionar BOM para Excel reconhecer UTF-8
    content = '\ufeff' + output.getvalue()
    
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )


@router.get("/completa")
async def exportar_tudo(
    campos_motoristas: str = Query(None, description="Campos de motoristas"),
    campos_veiculos: str = Query(None, description="Campos de veículos"),
    delimitador: str = Query(";", description="Delimitador CSV"),
    current_user: dict = Depends(get_current_user)
):
    """Exportar motoristas e veículos num único ficheiro ZIP"""
    import zipfile
    
    if current_user["role"] not in ["admin", "parceiro", "gestao"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Criar ZIP em memória
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Exportar motoristas
        motoristas_csv = await _gerar_csv_motoristas(campos_motoristas, delimitador, current_user)
        zip_file.writestr(f"motoristas_{datetime.now().strftime('%Y%m%d')}.csv", motoristas_csv)
        
        # Exportar veículos
        veiculos_csv = await _gerar_csv_veiculos(campos_veiculos, delimitador, current_user)
        zip_file.writestr(f"veiculos_{datetime.now().strftime('%Y%m%d')}.csv", veiculos_csv)
    
    zip_buffer.seek(0)
    filename = f"exportacao_completa_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


async def _gerar_csv_motoristas(campos: str, delimitador: str, current_user: dict) -> str:
    """Gera CSV de motoristas como string"""
    if campos:
        campos_selecionados = [c.strip() for c in campos.split(",") if c.strip() in CAMPOS_MOTORISTAS]
    else:
        campos_selecionados = [k for k, v in CAMPOS_MOTORISTAS.items() if v["default"]]
    
    query = {}
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif current_user["role"] == "gestao":
        query["parceiro_id"] = current_user.get("associated_partner_id", current_user["id"])
    
    motoristas = await db.motoristas.find(query, {"_id": 0}).to_list(None)
    
    veiculos_map = {}
    veiculos = await db.vehicles.find({}, {"_id": 0, "id": 1, "matricula": 1}).to_list(None)
    for v in veiculos:
        veiculos_map[v.get("id")] = v.get("matricula", "")
    
    output = io.StringIO()
    delimiter = ";" if delimitador == ";" else ","
    headers = [CAMPOS_MOTORISTAS[c]["label"] for c in campos_selecionados]
    writer = csv.writer(output, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    
    for motorista in motoristas:
        row = []
        for campo in campos_selecionados:
            campo_info = CAMPOS_MOTORISTAS[campo]
            if campo == "veiculo_atribuido":
                veiculo_id = motorista.get("veiculo_atribuido") or motorista.get("assigned_vehicle_id")
                value = veiculos_map.get(veiculo_id, "")
            else:
                value = get_nested_value(motorista, campo_info["campo_db"])
            row.append(format_value(value))
        writer.writerow(row)
    
    return '\ufeff' + output.getvalue()


async def _gerar_csv_veiculos(campos: str, delimitador: str, current_user: dict) -> str:
    """Gera CSV de veículos como string"""
    if campos:
        campos_selecionados = [c.strip() for c in campos.split(",") if c.strip() in CAMPOS_VEICULOS]
    else:
        campos_selecionados = [k for k, v in CAMPOS_VEICULOS.items() if v["default"]]
    
    query = {}
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    elif current_user["role"] == "gestao":
        query["parceiro_id"] = current_user.get("associated_partner_id", current_user["id"])
    
    veiculos = await db.vehicles.find(query, {"_id": 0}).to_list(None)
    
    motoristas_map = {}
    motoristas = await db.motoristas.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(None)
    for m in motoristas:
        motoristas_map[m.get("id")] = m.get("name", "")
    
    output = io.StringIO()
    delimiter = ";" if delimitador == ";" else ","
    headers = [CAMPOS_VEICULOS[c]["label"] for c in campos_selecionados]
    writer = csv.writer(output, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    
    for veiculo in veiculos:
        row = []
        for campo in campos_selecionados:
            campo_info = CAMPOS_VEICULOS[campo]
            if campo == "motorista_atribuido":
                motorista_id = veiculo.get("motorista_atribuido") or veiculo.get("assigned_driver_id")
                value = motoristas_map.get(motorista_id, "")
            else:
                value = get_nested_value(veiculo, campo_info["campo_db"])
            row.append(format_value(value))
        writer.writerow(row)
    
    return '\ufeff' + output.getvalue()


# =============================================================================
# IMPORTAÇÃO DE DADOS
# =============================================================================

# Mapeamento inverso: label -> campo_db
LABEL_TO_CAMPO_MOTORISTAS = {v["label"]: {"id": k, "campo_db": v["campo_db"]} for k, v in CAMPOS_MOTORISTAS.items()}
LABEL_TO_CAMPO_VEICULOS = {v["label"]: {"id": k, "campo_db": v["campo_db"]} for k, v in CAMPOS_VEICULOS.items()}


def parse_csv_value(value: str, campo_id: str) -> any:
    """Converte valor do CSV para o tipo apropriado"""
    if value is None or value.strip() == "":
        return None
    
    value = value.strip()
    
    # Campos booleanos
    if value.lower() in ["sim", "yes", "true", "1"]:
        return True
    if value.lower() in ["não", "nao", "no", "false", "0"]:
        return False
    
    # Campos numéricos
    if campo_id in ["ano", "num_lugares", "num_portas", "km_atual", "cilindrada", "potencia"]:
        try:
            return int(value.replace(".", "").replace(",", ""))
        except:
            return value
    
    return value


def set_nested_value(obj: dict, path: str, value: any):
    """Define valor em campo aninhado (ex: 'seguro.validade')"""
    keys = path.split('.')
    for key in keys[:-1]:
        if key not in obj:
            obj[key] = {}
        obj = obj[key]
    obj[keys[-1]] = value


@router.post("/importar/motoristas/preview")
async def preview_importar_motoristas(
    file: UploadFile = File(...),
    delimitador: str = Form(";"),
    current_user: dict = Depends(get_current_user)
):
    """Pré-visualizar importação de motoristas - mostra alterações detectadas"""
    from fastapi import File, UploadFile, Form
    
    if current_user["role"] not in ["admin", "parceiro", "gestao"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    try:
        contents = await file.read()
        
        # Decodificar ficheiro
        for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
            try:
                decoded = contents.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        
        # Remover BOM se presente
        if decoded.startswith('\ufeff'):
            decoded = decoded[1:]
        
        # Detectar delimitador
        sample = decoded[:1000]
        if delimitador == "auto":
            delimitador = ';' if sample.count(';') > sample.count(',') else ','
        
        csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimitador)
        
        # Buscar motoristas existentes do parceiro
        query = {}
        if current_user["role"] == "parceiro":
            query["parceiro_id"] = current_user["id"]
        elif current_user["role"] == "gestao":
            query["parceiro_id"] = current_user.get("associated_partner_id", current_user["id"])
        
        motoristas_db = await db.motoristas.find(query, {"_id": 0}).to_list(None)
        motoristas_por_nif = {m.get("nif"): m for m in motoristas_db if m.get("nif")}
        
        # Processar linhas do CSV
        preview_results = []
        linhas_ignoradas = 0
        erros = []
        
        for row_num, row in enumerate(csv_reader, start=2):
            # Encontrar NIF no CSV
            nif = None
            for label in ["NIF", "nif", "Nif"]:
                if label in row:
                    nif = row[label].strip() if row[label] else None
                    break
            
            if not nif:
                linhas_ignoradas += 1
                continue
            
            # Verificar se motorista existe
            motorista_existente = motoristas_por_nif.get(nif)
            if not motorista_existente:
                linhas_ignoradas += 1
                erros.append(f"Linha {row_num}: NIF '{nif}' não encontrado")
                continue
            
            # Detectar alterações
            alteracoes = []
            for csv_label, csv_value in row.items():
                if csv_label not in LABEL_TO_CAMPO_MOTORISTAS:
                    continue
                
                campo_info = LABEL_TO_CAMPO_MOTORISTAS[csv_label]
                campo_id = campo_info["id"]
                campo_db = campo_info["campo_db"]
                
                # Ignorar campo NIF (é o identificador)
                if campo_id == "nif":
                    continue
                
                # Valor atual no DB
                valor_atual = get_nested_value(motorista_existente, campo_db)
                valor_atual_str = format_value(valor_atual) if valor_atual else ""
                
                # Valor novo do CSV
                valor_novo = csv_value.strip() if csv_value else ""
                
                # Comparar
                if valor_atual_str != valor_novo and valor_novo:
                    alteracoes.append({
                        "campo": csv_label,
                        "campo_id": campo_id,
                        "valor_atual": valor_atual_str or "(vazio)",
                        "valor_novo": valor_novo
                    })
            
            if alteracoes:
                preview_results.append({
                    "linha": row_num,
                    "nif": nif,
                    "nome": motorista_existente.get("name", ""),
                    "motorista_id": motorista_existente.get("id"),
                    "alteracoes": alteracoes
                })
        
        return {
            "sucesso": True,
            "total_linhas": row_num - 1,
            "registos_para_atualizar": len(preview_results),
            "linhas_ignoradas": linhas_ignoradas,
            "preview": preview_results,
            "erros": erros[:10]  # Limitar erros mostrados
        }
        
    except Exception as e:
        logger.error(f"Erro ao processar ficheiro: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar ficheiro: {str(e)}")


@router.post("/importar/motoristas/confirmar")
async def confirmar_importar_motoristas(
    file: UploadFile = File(...),
    delimitador: str = Form(";"),
    current_user: dict = Depends(get_current_user)
):
    """Confirmar e executar importação de motoristas"""
    from fastapi import File, UploadFile, Form
    
    if current_user["role"] not in ["admin", "parceiro", "gestao"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    try:
        contents = await file.read()
        
        # Decodificar ficheiro
        for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
            try:
                decoded = contents.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        
        if decoded.startswith('\ufeff'):
            decoded = decoded[1:]
        
        csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimitador)
        
        # Buscar motoristas existentes
        query = {}
        if current_user["role"] == "parceiro":
            query["parceiro_id"] = current_user["id"]
        elif current_user["role"] == "gestao":
            query["parceiro_id"] = current_user.get("associated_partner_id", current_user["id"])
        
        motoristas_db = await db.motoristas.find(query, {"_id": 0}).to_list(None)
        motoristas_por_nif = {m.get("nif"): m for m in motoristas_db if m.get("nif")}
        
        # Processar e atualizar
        atualizados = 0
        erros = []
        
        for row_num, row in enumerate(csv_reader, start=2):
            nif = None
            for label in ["NIF", "nif", "Nif"]:
                if label in row:
                    nif = row[label].strip() if row[label] else None
                    break
            
            if not nif:
                continue
            
            motorista_existente = motoristas_por_nif.get(nif)
            if not motorista_existente:
                continue
            
            # Preparar atualizações
            updates = {}
            for csv_label, csv_value in row.items():
                if csv_label not in LABEL_TO_CAMPO_MOTORISTAS:
                    continue
                
                campo_info = LABEL_TO_CAMPO_MOTORISTAS[csv_label]
                campo_id = campo_info["id"]
                campo_db = campo_info["campo_db"]
                
                if campo_id == "nif":
                    continue
                
                valor_atual = get_nested_value(motorista_existente, campo_db)
                valor_atual_str = format_value(valor_atual) if valor_atual else ""
                valor_novo = csv_value.strip() if csv_value else ""
                
                if valor_atual_str != valor_novo and valor_novo:
                    valor_convertido = parse_csv_value(valor_novo, campo_id)
                    if '.' in campo_db:
                        # Campo aninhado
                        set_nested_value(updates, campo_db, valor_convertido)
                    else:
                        updates[campo_db] = valor_convertido
            
            if updates:
                try:
                    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
                    await db.motoristas.update_one(
                        {"id": motorista_existente["id"]},
                        {"$set": updates}
                    )
                    atualizados += 1
                except Exception as e:
                    erros.append(f"Linha {row_num}: Erro ao atualizar - {str(e)}")
        
        # Log da importação
        log = {
            "id": str(uuid.uuid4()),
            "tipo": "importacao_motoristas",
            "ficheiro": file.filename,
            "total_atualizados": atualizados,
            "erros": len(erros),
            "executado_por": current_user["id"],
            "data": datetime.now(timezone.utc).isoformat()
        }
        await db.logs_importacao.insert_one(log)
        
        return {
            "sucesso": True,
            "atualizados": atualizados,
            "erros": erros[:10]
        }
        
    except Exception as e:
        logger.error(f"Erro na importação: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na importação: {str(e)}")


@router.post("/importar/veiculos/preview")
async def preview_importar_veiculos(
    file: UploadFile = File(...),
    delimitador: str = Form(";"),
    current_user: dict = Depends(get_current_user)
):
    """Pré-visualizar importação de veículos - mostra alterações detectadas"""
    from fastapi import File, UploadFile, Form
    
    if current_user["role"] not in ["admin", "parceiro", "gestao"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    try:
        contents = await file.read()
        
        for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
            try:
                decoded = contents.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        
        if decoded.startswith('\ufeff'):
            decoded = decoded[1:]
        
        if delimitador == "auto":
            sample = decoded[:1000]
            delimitador = ';' if sample.count(';') > sample.count(',') else ','
        
        csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimitador)
        
        # Buscar veículos existentes
        query = {}
        if current_user["role"] == "parceiro":
            query["parceiro_id"] = current_user["id"]
        elif current_user["role"] == "gestao":
            query["parceiro_id"] = current_user.get("associated_partner_id", current_user["id"])
        
        veiculos_db = await db.vehicles.find(query, {"_id": 0}).to_list(None)
        veiculos_por_matricula = {v.get("matricula"): v for v in veiculos_db if v.get("matricula")}
        
        preview_results = []
        linhas_ignoradas = 0
        erros = []
        
        for row_num, row in enumerate(csv_reader, start=2):
            matricula = None
            for label in ["Matrícula", "Matricula", "matricula", "MATRICULA"]:
                if label in row:
                    matricula = row[label].strip().upper() if row[label] else None
                    break
            
            if not matricula:
                linhas_ignoradas += 1
                continue
            
            veiculo_existente = veiculos_por_matricula.get(matricula)
            if not veiculo_existente:
                linhas_ignoradas += 1
                erros.append(f"Linha {row_num}: Matrícula '{matricula}' não encontrada")
                continue
            
            alteracoes = []
            for csv_label, csv_value in row.items():
                if csv_label not in LABEL_TO_CAMPO_VEICULOS:
                    continue
                
                campo_info = LABEL_TO_CAMPO_VEICULOS[csv_label]
                campo_id = campo_info["id"]
                campo_db = campo_info["campo_db"]
                
                if campo_id == "matricula":
                    continue
                
                valor_atual = get_nested_value(veiculo_existente, campo_db)
                valor_atual_str = format_value(valor_atual) if valor_atual else ""
                valor_novo = csv_value.strip() if csv_value else ""
                
                if valor_atual_str != valor_novo and valor_novo:
                    alteracoes.append({
                        "campo": csv_label,
                        "campo_id": campo_id,
                        "valor_atual": valor_atual_str or "(vazio)",
                        "valor_novo": valor_novo
                    })
            
            if alteracoes:
                preview_results.append({
                    "linha": row_num,
                    "matricula": matricula,
                    "marca_modelo": f"{veiculo_existente.get('marca', '')} {veiculo_existente.get('modelo', '')}".strip(),
                    "veiculo_id": veiculo_existente.get("id"),
                    "alteracoes": alteracoes
                })
        
        return {
            "sucesso": True,
            "total_linhas": row_num - 1,
            "registos_para_atualizar": len(preview_results),
            "linhas_ignoradas": linhas_ignoradas,
            "preview": preview_results,
            "erros": erros[:10]
        }
        
    except Exception as e:
        logger.error(f"Erro ao processar ficheiro: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar ficheiro: {str(e)}")


@router.post("/importar/veiculos/confirmar")
async def confirmar_importar_veiculos(
    file: UploadFile = File(...),
    delimitador: str = Form(";"),
    current_user: dict = Depends(get_current_user)
):
    """Confirmar e executar importação de veículos"""
    from fastapi import File, UploadFile, Form
    
    if current_user["role"] not in ["admin", "parceiro", "gestao"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    try:
        contents = await file.read()
        
        for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
            try:
                decoded = contents.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        
        if decoded.startswith('\ufeff'):
            decoded = decoded[1:]
        
        csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimitador)
        
        query = {}
        if current_user["role"] == "parceiro":
            query["parceiro_id"] = current_user["id"]
        elif current_user["role"] == "gestao":
            query["parceiro_id"] = current_user.get("associated_partner_id", current_user["id"])
        
        veiculos_db = await db.vehicles.find(query, {"_id": 0}).to_list(None)
        veiculos_por_matricula = {v.get("matricula"): v for v in veiculos_db if v.get("matricula")}
        
        atualizados = 0
        erros = []
        
        for row_num, row in enumerate(csv_reader, start=2):
            matricula = None
            for label in ["Matrícula", "Matricula", "matricula", "MATRICULA"]:
                if label in row:
                    matricula = row[label].strip().upper() if row[label] else None
                    break
            
            if not matricula:
                continue
            
            veiculo_existente = veiculos_por_matricula.get(matricula)
            if not veiculo_existente:
                continue
            
            updates = {}
            for csv_label, csv_value in row.items():
                if csv_label not in LABEL_TO_CAMPO_VEICULOS:
                    continue
                
                campo_info = LABEL_TO_CAMPO_VEICULOS[csv_label]
                campo_id = campo_info["id"]
                campo_db = campo_info["campo_db"]
                
                if campo_id == "matricula":
                    continue
                
                valor_atual = get_nested_value(veiculo_existente, campo_db)
                valor_atual_str = format_value(valor_atual) if valor_atual else ""
                valor_novo = csv_value.strip() if csv_value else ""
                
                if valor_atual_str != valor_novo and valor_novo:
                    valor_convertido = parse_csv_value(valor_novo, campo_id)
                    if '.' in campo_db:
                        set_nested_value(updates, campo_db, valor_convertido)
                    else:
                        updates[campo_db] = valor_convertido
            
            if updates:
                try:
                    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
                    await db.vehicles.update_one(
                        {"id": veiculo_existente["id"]},
                        {"$set": updates}
                    )
                    atualizados += 1
                except Exception as e:
                    erros.append(f"Linha {row_num}: Erro ao atualizar - {str(e)}")
        
        log = {
            "id": str(uuid.uuid4()),
            "tipo": "importacao_veiculos",
            "ficheiro": file.filename,
            "total_atualizados": atualizados,
            "erros": len(erros),
            "executado_por": current_user["id"],
            "data": datetime.now(timezone.utc).isoformat()
        }
        await db.logs_importacao.insert_one(log)
        
        return {
            "sucesso": True,
            "atualizados": atualizados,
            "erros": erros[:10]
        }
        
    except Exception as e:
        logger.error(f"Erro na importação: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na importação: {str(e)}")

