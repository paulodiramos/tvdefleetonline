"""
Rotas para Importação de Ganhos (Uber e Bolt)
Extraído do server.py para melhor organização
"""

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime, timezone
import uuid
import csv
import io
import re
import logging

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/import", tags=["import-ganhos"])
security = HTTPBearer()
db = get_database()


def parse_float(value):
    """Helper para converter valores de CSV"""
    if not value or value == '':
        return 0.0
    try:
        clean_value = str(value).strip().replace(',', '.')
        return float(clean_value)
    except:
        return 0.0


@router.post("/uber/ganhos")
async def importar_ganhos_uber(
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Importa ficheiro CSV de ganhos da Uber"""
    try:
        user = await get_current_user(credentials)
        if user['role'] not in ['admin', 'manager', 'parceiro']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        contents = await file.read()
        
        # Handle BOM e encoding
        for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
            try:
                decoded = contents.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        
        # Detectar delimitador
        sample = decoded[:1000]
        delimiter = ';' if sample.count(';') > sample.count(',') else ','
        logger.info(f"Detected CSV delimiter for Uber ganhos import: '{delimiter}'")
        
        csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
        
        ganhos_importados = []
        motoristas_encontrados = 0
        motoristas_nao_encontrados = 0
        erros = []
        total_ganhos = 0.0
        
        # Extrair período do nome do ficheiro
        periodo_match = re.search(r'(\d{8})-(\d{8})', file.filename)
        periodo_inicio = periodo_match.group(1) if periodo_match else None
        periodo_fim = periodo_match.group(2) if periodo_match else None
        
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                uuid_motorista = row.get('UUID do motorista', '').strip()
                if not uuid_motorista:
                    continue
                
                motorista = await db.motoristas.find_one({'uuid_motorista_uber': uuid_motorista})
                motorista_id = motorista['id'] if motorista else None
                
                if motorista:
                    motoristas_encontrados += 1
                else:
                    motoristas_nao_encontrados += 1
                
                pago_total = parse_float(row.get('Pago a si', '0'))
                rendimentos_total = parse_float(row.get('Pago a si : Os seus rendimentos', '0'))
                
                ganho = {
                    'id': str(uuid.uuid4()),
                    'uuid_motorista_uber': uuid_motorista,
                    'motorista_id': motorista_id,
                    'nome_motorista': row.get('Nome próprio do motorista', ''),
                    'apelido_motorista': row.get('Apelido do motorista', ''),
                    'periodo_inicio': periodo_inicio,
                    'periodo_fim': periodo_fim,
                    'pago_total': pago_total,
                    'rendimentos_total': rendimentos_total,
                    'dinheiro_recebido': parse_float(row.get('Pago a si : Saldo da viagem : Pagamentos : Dinheiro recebido', '0')),
                    'tarifa_total': parse_float(row.get('Pago a si : Os seus rendimentos : Tarifa', '0')),
                    'tarifa_base': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Tarifa', '0')),
                    'tarifa_ajuste': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Ajuste', '0')),
                    'tarifa_cancelamento': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Cancelamento', '0')),
                    'tarifa_dinamica': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Tarifa dinâmica', '0')),
                    'taxa_reserva': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Taxa de reserva', '0')),
                    'uber_priority': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:UberX Priority', '0')),
                    'tempo_espera': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Tempo de espera na recolha', '0')),
                    'taxa_servico': parse_float(row.get('Pago a si:Os seus rendimentos:Taxa de serviço', '0')),
                    'imposto_tarifa': parse_float(row.get('Pago a si:Os seus rendimentos:Tarifa:Imposto sobre a tarifa', '0')),
                    'taxa_aeroporto': parse_float(row.get('Pago a si:Os seus rendimentos:Outros rendimentos:Taxa de aeroporto', '0')),
                    'gratificacao': parse_float(row.get('Pago a si:Os seus rendimentos:Gratificação', '0')),
                    'portagens': parse_float(row.get('Pago a si:Saldo da viagem:Reembolsos:Portagem', '0')),
                    'ajustes': parse_float(row.get('Pago a si:Os seus rendimentos:Outros rendimentos:Ajuste', '0')),
                    'ficheiro_nome': file.filename,
                    'data_importacao': datetime.now(timezone.utc),
                    'importado_por': user['id']
                }
                
                await db.ganhos_uber.insert_one(ganho)
                ganho_copy = {k: v for k, v in ganho.items() if k != '_id'}
                ganhos_importados.append(ganho_copy)
                total_ganhos += pago_total
                
            except Exception as e:
                erros.append(f"Linha {row_num}: {str(e)}")
        
        # Serializar para resposta
        ganhos_serializados = []
        for g in ganhos_importados[:10]:
            ganho_serial = {}
            for k, v in g.items():
                if k == '_id':
                    continue
                if isinstance(v, datetime):
                    ganho_serial[k] = v.isoformat()
                else:
                    ganho_serial[k] = v
            ganhos_serializados.append(ganho_serial)
        
        return {
            'success': True,
            'total_linhas': len(ganhos_importados),
            'motoristas_encontrados': motoristas_encontrados,
            'motoristas_nao_encontrados': motoristas_nao_encontrados,
            'total_ganhos': round(total_ganhos, 2),
            'ganhos_importados': ganhos_serializados,
            'erros': erros
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao importar ficheiro: {str(e)}")


@router.post("/bolt/ganhos")
async def importar_ganhos_bolt(
    file: UploadFile = File(...),
    parceiro_id: Optional[str] = Form(None),
    periodo_inicio: Optional[str] = Form(None),
    periodo_fim: Optional[str] = Form(None),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Importa ficheiro CSV de ganhos da Bolt"""
    try:
        user = await get_current_user(credentials)
        if user['role'] not in ['admin', 'manager', 'parceiro']:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        contents = await file.read()
        
        # Handle BOM e encoding
        for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
            try:
                decoded = contents.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        
        # Detectar delimitador
        sample = decoded[:1000]
        delimiter = ';' if sample.count(';') > sample.count(',') else ','
        logger.info(f"Detected CSV delimiter for Bolt ganhos import: '{delimiter}'")
        
        csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
        
        ganhos_importados = []
        motoristas_encontrados = 0
        motoristas_nao_encontrados = 0
        erros = []
        total_ganhos = 0.0
        
        # Extrair período
        periodo_match = re.search(r'(\d{4})W(\d{2})', file.filename)
        periodo_ano = None
        periodo_semana = None
        if periodo_match:
            periodo_ano = periodo_match.group(1)
            periodo_semana = periodo_match.group(2)
        elif periodo_inicio:
            try:
                data_inicio = datetime.strptime(periodo_inicio, "%Y-%m-%d")
                iso_cal = data_inicio.isocalendar()
                periodo_ano = iso_cal[0]
                periodo_semana = iso_cal[1]
            except ValueError:
                pass
        
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                identificador_motorista = row.get('Identificador do motorista', '').strip()
                identificador_individual = row.get('Identificador individual', '').strip()
                
                if not identificador_motorista:
                    continue
                
                # Procurar motorista
                motorista = await db.motoristas.find_one({'identificador_motorista_bolt': identificador_individual})
                
                if not motorista:
                    email_motorista = row.get('Email', '').strip().lower()
                    if email_motorista:
                        motorista = await db.motoristas.find_one({
                            '$or': [
                                {'email': {'$regex': f'^{email_motorista}$', '$options': 'i'}},
                                {'email_bolt': {'$regex': f'^{email_motorista}$', '$options': 'i'}}
                            ]
                        }, {"_id": 0})
                        
                        if motorista:
                            await db.motoristas.update_one(
                                {'id': motorista['id']},
                                {'$set': {
                                    'identificador_motorista_bolt': identificador_individual,
                                    'bolt_driver_id': identificador_motorista
                                }}
                            )
                
                motorista_id = motorista['id'] if motorista else None
                
                if motorista:
                    motoristas_encontrados += 1
                else:
                    motoristas_nao_encontrados += 1
                
                ganhos_liquidos = parse_float(row.get('Ganhos líquidos|€', '0'))
                
                ganho = {
                    'id': str(uuid.uuid4()),
                    'identificador_motorista_bolt': identificador_motorista,
                    'identificador_individual': identificador_individual,
                    'motorista_id': motorista_id,
                    'nome_motorista': row.get('Motorista', ''),
                    'email_motorista': row.get('Email', ''),
                    'telemovel_motorista': row.get('Telemóvel', ''),
                    'periodo_ano': periodo_ano,
                    'periodo_semana': periodo_semana,
                    'ganhos_brutos_total': parse_float(row.get('Ganhos brutos (total)|€', '0')),
                    'ganhos_brutos_app': parse_float(row.get('Ganhos brutos (pagamentos na app)|€', '0')),
                    'iva_ganhos_app': parse_float(row.get('IVA sobre os ganhos brutos (pagamentos na app)|€', '0')),
                    'ganhos_brutos_dinheiro': parse_float(row.get('Ganhos brutos (pagamentos em dinheiro)|€', '0')),
                    'iva_ganhos_dinheiro': parse_float(row.get('IVA sobre os ganhos brutos (pagamentos em dinheiro)|€', '0')),
                    'dinheiro_recebido': parse_float(row.get('Dinheiro recebido|€', '0')),
                    'gorjetas': parse_float(row.get('Gorjetas dos passageiros|€', '0')),
                    'ganhos_campanha': parse_float(row.get('Ganhos da campanha|€', '0')),
                    'reembolsos_despesas': parse_float(row.get('Reembolsos de despesas|€', '0')),
                    'taxas_cancelamento': parse_float(row.get('Taxas de cancelamento|€', '0')),
                    'iva_taxas_cancelamento': parse_float(row.get('IVA das taxas de cancelamento|€', '0')),
                    'portagens': parse_float(row.get('Portagens|€', '0')),
                    'taxas_reserva': parse_float(row.get('Taxas de reserva|€', '0')),
                    'iva_taxas_reserva': parse_float(row.get('IVA das taxas de reserva|€', '0')),
                    'total_taxas': parse_float(row.get('Total de taxas|€', '0')),
                    'comissoes': parse_float(row.get('Comissões|€', '0')),
                    'reembolsos_passageiros': parse_float(row.get('Reembolsos aos passageiros|€', '0')),
                    'outras_taxas': parse_float(row.get('Outras taxas|€', '0')),
                    'ganhos_liquidos': ganhos_liquidos,
                    'pagamento_previsto': parse_float(row.get('Pagamento previsto|€', '0')),
                    'ganhos_brutos_por_hora': parse_float(row.get('Ganhos brutos por hora|€/h', '0')),
                    'ganhos_liquidos_por_hora': parse_float(row.get('Ganhos líquidos por hora|€/h', '0')),
                    'ficheiro_nome': file.filename,
                    'parceiro_id': parceiro_id,
                    'data_importacao': datetime.now(timezone.utc),
                    'importado_por': user['id']
                }
                
                await db.ganhos_bolt.insert_one(ganho)
                ganho_copy = {k: v for k, v in ganho.items() if k != '_id'}
                ganhos_importados.append(ganho_copy)
                total_ganhos += ganhos_liquidos
                
            except Exception as e:
                erros.append(f"Linha {row_num}: {str(e)}")
        
        # Serializar para resposta
        ganhos_serializados = []
        for g in ganhos_importados[:10]:
            ganho_serial = {}
            for k, v in g.items():
                if k == '_id':
                    continue
                if isinstance(v, datetime):
                    ganho_serial[k] = v.isoformat()
                else:
                    ganho_serial[k] = v
            ganhos_serializados.append(ganho_serial)
        
        return {
            'success': True,
            'total_linhas': len(ganhos_importados),
            'motoristas_encontrados': motoristas_encontrados,
            'motoristas_nao_encontrados': motoristas_nao_encontrados,
            'total_ganhos': round(total_ganhos, 2),
            'periodo': f"{periodo_ano}W{periodo_semana}" if periodo_ano else None,
            'ganhos_importados': ganhos_serializados,
            'erros': erros
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao importar ficheiro: {str(e)}")


@router.get("/uber/ganhos")
async def listar_ganhos_uber(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    motorista_id: Optional[str] = None,
    periodo_inicio: Optional[str] = None,
    periodo_fim: Optional[str] = None,
    limit: int = 100
):
    """Lista ganhos importados da Uber"""
    user = await get_current_user(credentials)
    
    query = {}
    if motorista_id:
        query['motorista_id'] = motorista_id
    if periodo_inicio:
        query['periodo_inicio'] = periodo_inicio
    if periodo_fim:
        query['periodo_fim'] = periodo_fim
    
    ganhos = await db.ganhos_uber.find(query, {"_id": 0}).sort("data_importacao", -1).limit(limit).to_list(limit)
    
    # Serializar datas
    for g in ganhos:
        if 'data_importacao' in g and isinstance(g['data_importacao'], datetime):
            g['data_importacao'] = g['data_importacao'].isoformat()
    
    return ganhos


@router.get("/bolt/ganhos")
async def listar_ganhos_bolt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    motorista_id: Optional[str] = None,
    parceiro_id: Optional[str] = None,
    periodo_ano: Optional[str] = None,
    periodo_semana: Optional[str] = None,
    limit: int = 100
):
    """Lista ganhos importados da Bolt"""
    user = await get_current_user(credentials)
    
    query = {}
    if motorista_id:
        query['motorista_id'] = motorista_id
    if parceiro_id:
        query['parceiro_id'] = parceiro_id
    if periodo_ano:
        query['periodo_ano'] = periodo_ano
    if periodo_semana:
        query['periodo_semana'] = periodo_semana
    
    ganhos = await db.ganhos_bolt.find(query, {"_id": 0}).sort("data_importacao", -1).limit(limit).to_list(limit)
    
    # Serializar datas
    for g in ganhos:
        if 'data_importacao' in g and isinstance(g['data_importacao'], datetime):
            g['data_importacao'] = g['data_importacao'].isoformat()
    
    return ganhos
