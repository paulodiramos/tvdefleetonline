"""
Rotas para Exportação de Dados (Motoristas e Veículos)
Permite exportar dados para CSV com seleção de campos
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Dict, List, Optional
from datetime import datetime, timezone
import csv
import io
import logging

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
