"""
Serviço para processar ficheiros de download do RPA
Extrai dados de PDFs/CSVs e guarda no resumo semanal
"""
import os
import re
import json
import logging
import pdfplumber
import pandas as pd
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# Diretório para downloads
DOWNLOADS_DIR = "/tmp/rpa_downloads"


def garantir_diretorio(parceiro_id: str) -> str:
    """Cria o diretório de downloads se não existir"""
    path = os.path.join(DOWNLOADS_DIR, parceiro_id)
    os.makedirs(path, exist_ok=True)
    return path


def processar_download_uber(filepath: str) -> Dict[str, Any]:
    """
    Processa ficheiro de download da Uber (PDF ou CSV)
    Extrai: ganhos brutos, viagens, gorjetas, etc.
    """
    resultado = {
        "plataforma": "uber",
        "sucesso": False,
        "dados": {},
        "erro": None
    }
    
    try:
        if filepath.endswith('.pdf'):
            resultado["dados"] = extrair_dados_pdf_uber(filepath)
        elif filepath.endswith('.csv'):
            resultado["dados"] = extrair_dados_csv_uber(filepath)
        else:
            resultado["erro"] = f"Formato não suportado: {filepath}"
            return resultado
        
        resultado["sucesso"] = True
        logger.info(f"Dados Uber extraídos: {resultado['dados']}")
        
    except Exception as e:
        resultado["erro"] = str(e)
        logger.error(f"Erro ao processar Uber: {e}")
    
    return resultado


def extrair_dados_pdf_uber(filepath: str) -> Dict[str, Any]:
    """Extrai dados de um PDF da Uber"""
    dados = {
        "ganhos_brutos": 0,
        "viagens": 0,
        "gorjetas": 0,
        "bonus": 0,
        "promocoes": 0,
        "taxa_servico": 0,
        "ganhos_liquidos": 0
    }
    
    with pdfplumber.open(filepath) as pdf:
        texto_completo = ""
        for page in pdf.pages:
            texto_completo += page.extract_text() or ""
        
        # Padrões para extrair valores (adaptar conforme formato real)
        padroes = {
            "ganhos_brutos": r"(?:Ganhos|Earnings|Total)\s*[:\s]*€?\s*([\d.,]+)",
            "viagens": r"(?:Viagens|Trips|Corridas)\s*[:\s]*(\d+)",
            "gorjetas": r"(?:Gorjetas|Tips)\s*[:\s]*€?\s*([\d.,]+)",
            "bonus": r"(?:Bónus|Bonus)\s*[:\s]*€?\s*([\d.,]+)",
            "promocoes": r"(?:Promoções|Promotions)\s*[:\s]*€?\s*([\d.,]+)",
            "taxa_servico": r"(?:Taxa|Fee|Comissão)\s*[:\s]*€?\s*([\d.,]+)",
        }
        
        for campo, padrao in padroes.items():
            match = re.search(padrao, texto_completo, re.IGNORECASE)
            if match:
                valor = match.group(1).replace(",", ".")
                if campo == "viagens":
                    dados[campo] = int(valor)
                else:
                    dados[campo] = float(valor)
        
        # Calcular ganhos líquidos
        dados["ganhos_liquidos"] = (
            dados["ganhos_brutos"] + 
            dados["gorjetas"] + 
            dados["bonus"] + 
            dados["promocoes"] - 
            dados["taxa_servico"]
        )
    
    return dados


def extrair_dados_csv_uber(filepath: str) -> Dict[str, Any]:
    """Extrai dados de um CSV da Uber"""
    dados = {
        "ganhos_brutos": 0,
        "viagens": 0,
        "gorjetas": 0,
        "bonus": 0,
        "promocoes": 0,
        "taxa_servico": 0,
        "ganhos_liquidos": 0
    }
    
    df = pd.read_csv(filepath)
    
    # Tentar encontrar colunas relevantes
    colunas = df.columns.str.lower()
    
    for col in df.columns:
        col_lower = col.lower()
        if any(x in col_lower for x in ['ganho', 'earning', 'total', 'amount']):
            if 'tip' not in col_lower and 'gorjeta' not in col_lower:
                dados["ganhos_brutos"] = df[col].sum()
        elif any(x in col_lower for x in ['gorjeta', 'tip']):
            dados["gorjetas"] = df[col].sum()
        elif any(x in col_lower for x in ['bonus', 'bónus']):
            dados["bonus"] = df[col].sum()
    
    dados["viagens"] = len(df)
    dados["ganhos_liquidos"] = dados["ganhos_brutos"] + dados["gorjetas"] + dados["bonus"]
    
    return dados


def processar_download_bolt(filepath: str) -> Dict[str, Any]:
    """Processa ficheiro de download da Bolt"""
    resultado = {
        "plataforma": "bolt",
        "sucesso": False,
        "dados": {},
        "erro": None
    }
    
    try:
        if filepath.endswith('.pdf'):
            resultado["dados"] = extrair_dados_pdf_bolt(filepath)
        elif filepath.endswith('.csv'):
            resultado["dados"] = extrair_dados_csv_bolt(filepath)
        else:
            resultado["erro"] = f"Formato não suportado: {filepath}"
            return resultado
        
        resultado["sucesso"] = True
        
    except Exception as e:
        resultado["erro"] = str(e)
        logger.error(f"Erro ao processar Bolt: {e}")
    
    return resultado


def extrair_dados_pdf_bolt(filepath: str) -> Dict[str, Any]:
    """Extrai dados de um PDF da Bolt"""
    dados = {
        "ganhos_brutos": 0,
        "viagens": 0,
        "gorjetas": 0,
        "bonus": 0,
        "comissao_bolt": 0,
        "ganhos_liquidos": 0
    }
    
    with pdfplumber.open(filepath) as pdf:
        texto_completo = ""
        for page in pdf.pages:
            texto_completo += page.extract_text() or ""
        
        # Padrões para Bolt
        padroes = {
            "ganhos_brutos": r"(?:Total|Ganhos|Faturação)\s*[:\s]*€?\s*([\d.,]+)",
            "viagens": r"(?:Viagens|Corridas|Rides)\s*[:\s]*(\d+)",
            "gorjetas": r"(?:Gorjetas|Tips)\s*[:\s]*€?\s*([\d.,]+)",
            "bonus": r"(?:Bónus|Bonus|Incentivos)\s*[:\s]*€?\s*([\d.,]+)",
            "comissao_bolt": r"(?:Comissão|Commission|Taxa Bolt)\s*[:\s]*€?\s*([\d.,]+)",
        }
        
        for campo, padrao in padroes.items():
            match = re.search(padrao, texto_completo, re.IGNORECASE)
            if match:
                valor = match.group(1).replace(",", ".")
                if campo == "viagens":
                    dados[campo] = int(valor)
                else:
                    dados[campo] = float(valor)
        
        dados["ganhos_liquidos"] = (
            dados["ganhos_brutos"] + 
            dados["gorjetas"] + 
            dados["bonus"] - 
            dados["comissao_bolt"]
        )
    
    return dados


def extrair_dados_csv_bolt(filepath: str) -> Dict[str, Any]:
    """Extrai dados de um CSV da Bolt"""
    dados = {
        "ganhos_brutos": 0,
        "viagens": 0,
        "gorjetas": 0,
        "bonus": 0,
        "comissao_bolt": 0,
        "ganhos_liquidos": 0
    }
    
    df = pd.read_csv(filepath)
    dados["viagens"] = len(df)
    
    for col in df.columns:
        col_lower = col.lower()
        if any(x in col_lower for x in ['total', 'ganho', 'earning']):
            dados["ganhos_brutos"] = df[col].sum()
        elif 'tip' in col_lower or 'gorjeta' in col_lower:
            dados["gorjetas"] = df[col].sum()
    
    dados["ganhos_liquidos"] = dados["ganhos_brutos"] + dados["gorjetas"]
    
    return dados


def processar_download_prio(filepath: str) -> Dict[str, Any]:
    """Processa ficheiro de download da Prio (combustível/elétrico)"""
    resultado = {
        "plataforma": "prio",
        "sucesso": False,
        "dados": {},
        "erro": None
    }
    
    try:
        if filepath.endswith('.pdf'):
            resultado["dados"] = extrair_dados_pdf_prio(filepath)
        elif filepath.endswith('.csv'):
            resultado["dados"] = extrair_dados_csv_prio(filepath)
        else:
            resultado["erro"] = f"Formato não suportado: {filepath}"
            return resultado
        
        resultado["sucesso"] = True
        
    except Exception as e:
        resultado["erro"] = str(e)
        logger.error(f"Erro ao processar Prio: {e}")
    
    return resultado


def extrair_dados_pdf_prio(filepath: str) -> Dict[str, Any]:
    """Extrai dados de um PDF da Prio"""
    dados = {
        "total_litros": 0,
        "total_valor": 0,
        "total_kwh": 0,
        "transacoes": []
    }
    
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if row and len(row) >= 3:
                        # Tentar extrair dados de cada linha
                        try:
                            transacao = {
                                "data": row[0] if row[0] else "",
                                "descricao": row[1] if len(row) > 1 else "",
                                "valor": float(str(row[-1]).replace(",", ".").replace("€", "").strip()) if row[-1] else 0
                            }
                            dados["transacoes"].append(transacao)
                            dados["total_valor"] += transacao["valor"]
                        except:
                            pass
    
    return dados


def extrair_dados_csv_prio(filepath: str) -> Dict[str, Any]:
    """Extrai dados de um CSV da Prio"""
    dados = {
        "total_litros": 0,
        "total_valor": 0,
        "total_kwh": 0,
        "transacoes": []
    }
    
    df = pd.read_csv(filepath)
    
    for col in df.columns:
        col_lower = col.lower()
        if 'litro' in col_lower:
            dados["total_litros"] = df[col].sum()
        elif 'kwh' in col_lower:
            dados["total_kwh"] = df[col].sum()
        elif any(x in col_lower for x in ['valor', 'total', 'amount']):
            dados["total_valor"] = df[col].sum()
    
    dados["transacoes"] = df.to_dict('records')
    
    return dados


def processar_download_viaverde(filepath: str) -> Dict[str, Any]:
    """Processa ficheiro de download da Via Verde"""
    resultado = {
        "plataforma": "viaverde",
        "sucesso": False,
        "dados": {},
        "erro": None
    }
    
    try:
        dados = {
            "total_portagens": 0,
            "transacoes": []
        }
        
        if filepath.endswith('.pdf'):
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    texto = page.extract_text() or ""
                    # Procurar valores de portagem
                    valores = re.findall(r'€?\s*([\d.,]+)\s*€?', texto)
                    for v in valores:
                        try:
                            valor = float(v.replace(",", "."))
                            if 0 < valor < 100:  # Filtrar valores razoáveis
                                dados["total_portagens"] += valor
                        except:
                            pass
        
        resultado["dados"] = dados
        resultado["sucesso"] = True
        
    except Exception as e:
        resultado["erro"] = str(e)
        logger.error(f"Erro ao processar Via Verde: {e}")
    
    return resultado


def processar_download(filepath: str, plataforma: str) -> Dict[str, Any]:
    """
    Processa um ficheiro de download baseado na plataforma
    """
    plataforma_lower = plataforma.lower()
    
    if "uber" in plataforma_lower:
        return processar_download_uber(filepath)
    elif "bolt" in plataforma_lower:
        return processar_download_bolt(filepath)
    elif "prio" in plataforma_lower:
        return processar_download_prio(filepath)
    elif "viaverde" in plataforma_lower or "via verde" in plataforma_lower:
        return processar_download_viaverde(filepath)
    else:
        return {
            "plataforma": plataforma,
            "sucesso": False,
            "erro": f"Plataforma '{plataforma}' não suportada para processamento automático"
        }


async def guardar_no_resumo_semanal(
    db, 
    parceiro_id: str, 
    motorista_id: str,
    semana: int, 
    ano: int, 
    dados: Dict[str, Any],
    plataforma: str
) -> Dict[str, Any]:
    """
    Guarda os dados extraídos nas coleções de importação (ganhos_uber, ganhos_bolt, etc.)
    que são usadas pelo resumo semanal
    """
    try:
        plataforma_lower = plataforma.lower()
        now = datetime.now(timezone.utc).isoformat()
        
        # Calcular datas da semana
        from datetime import date
        first_day_of_year = date(ano, 1, 1)
        if first_day_of_year.weekday() <= 3:
            first_monday = first_day_of_year - timedelta(days=first_day_of_year.weekday())
        else:
            first_monday = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
        
        week_start = first_monday + timedelta(weeks=semana - 1)
        week_end = week_start + timedelta(days=6)
        
        data_inicio = week_start.strftime("%Y-%m-%d")
        data_fim = week_end.strftime("%Y-%m-%d")
        
        resultado = {"sucesso": False, "colecao": None, "campos_atualizados": []}
        
        if "uber" in plataforma_lower:
            # Guardar na coleção ganhos_uber
            registro = {
                "id": str(uuid.uuid4()) if 'uuid' in dir() else f"rpa_{parceiro_id}_{semana}_{ano}",
                "motorista_id": motorista_id,
                "parceiro_id": parceiro_id,
                "semana": semana,
                "ano": ano,
                "periodo_inicio": data_inicio,
                "periodo_fim": data_fim,
                "rendimentos": dados.get("ganhos_liquidos", 0),
                "rendimentos_total": dados.get("ganhos_brutos", 0),
                "gorjetas": dados.get("gorjetas", 0),
                "bonus": dados.get("bonus", 0),
                "promocoes": dados.get("promocoes", 0),
                "taxa_servico": dados.get("taxa_servico", 0),
                "viagens": dados.get("viagens", 0),
                "fonte": "rpa",
                "importado_em": now,
                "atualizado_em": now
            }
            
            # Upsert por motorista/semana/ano
            await db.ganhos_uber.update_one(
                {
                    "motorista_id": motorista_id,
                    "semana": semana,
                    "ano": ano,
                    "fonte": "rpa"
                },
                {"$set": registro},
                upsert=True
            )
            resultado["colecao"] = "ganhos_uber"
            resultado["campos_atualizados"] = ["rendimentos", "viagens", "gorjetas", "bonus"]
            
        elif "bolt" in plataforma_lower:
            # Guardar na coleção ganhos_bolt
            registro = {
                "id": str(uuid.uuid4()) if 'uuid' in dir() else f"rpa_{parceiro_id}_{semana}_{ano}",
                "motorista_id": motorista_id,
                "parceiro_id": parceiro_id,
                "semana": semana,
                "ano": ano,
                "periodo_inicio": data_inicio,
                "periodo_fim": data_fim,
                "ganhos_liquidos": dados.get("ganhos_liquidos", 0),
                "ganhos_brutos": dados.get("ganhos_brutos", 0),
                "gorjetas": dados.get("gorjetas", 0),
                "bonus": dados.get("bonus", 0),
                "comissao_bolt": dados.get("comissao_bolt", 0),
                "viagens": dados.get("viagens", 0),
                "fonte": "rpa",
                "importado_em": now,
                "atualizado_em": now
            }
            
            await db.ganhos_bolt.update_one(
                {
                    "motorista_id": motorista_id,
                    "semana": semana,
                    "ano": ano,
                    "fonte": "rpa"
                },
                {"$set": registro},
                upsert=True
            )
            resultado["colecao"] = "ganhos_bolt"
            resultado["campos_atualizados"] = ["ganhos_liquidos", "viagens", "gorjetas", "bonus"]
            
        elif "prio" in plataforma_lower:
            # Determinar se é combustível ou elétrico
            if dados.get("total_kwh", 0) > 0:
                # Elétrico - guardar em despesas_eletrico
                registro = {
                    "id": str(uuid.uuid4()) if 'uuid' in dir() else f"rpa_{parceiro_id}_{semana}_{ano}",
                    "motorista_id": motorista_id,
                    "parceiro_id": parceiro_id,
                    "semana": semana,
                    "ano": ano,
                    "periodo_inicio": data_inicio,
                    "periodo_fim": data_fim,
                    "valor_total": dados.get("total_valor", 0),
                    "kwh": dados.get("total_kwh", 0),
                    "transacoes": dados.get("transacoes", []),
                    "fonte": "rpa",
                    "importado_em": now
                }
                
                await db.despesas_eletrico.update_one(
                    {
                        "motorista_id": motorista_id,
                        "semana": semana,
                        "ano": ano,
                        "fonte": "rpa"
                    },
                    {"$set": registro},
                    upsert=True
                )
                resultado["colecao"] = "despesas_eletrico"
                resultado["campos_atualizados"] = ["valor_total", "kwh"]
            else:
                # Combustível - guardar em despesas_combustivel
                registro = {
                    "id": str(uuid.uuid4()) if 'uuid' in dir() else f"rpa_{parceiro_id}_{semana}_{ano}",
                    "motorista_id": motorista_id,
                    "parceiro_id": parceiro_id,
                    "semana": semana,
                    "ano": ano,
                    "periodo_inicio": data_inicio,
                    "periodo_fim": data_fim,
                    "valor_total": dados.get("total_valor", 0),
                    "litros": dados.get("total_litros", 0),
                    "transacoes": dados.get("transacoes", []),
                    "fonte": "rpa",
                    "importado_em": now
                }
                
                await db.despesas_combustivel.update_one(
                    {
                        "motorista_id": motorista_id,
                        "semana": semana,
                        "ano": ano,
                        "fonte": "rpa"
                    },
                    {"$set": registro},
                    upsert=True
                )
                resultado["colecao"] = "despesas_combustivel"
                resultado["campos_atualizados"] = ["valor_total", "litros"]
                
        elif "viaverde" in plataforma_lower or "via verde" in plataforma_lower:
            # Guardar em despesas_viaverde
            registro = {
                "id": str(uuid.uuid4()) if 'uuid' in dir() else f"rpa_{parceiro_id}_{semana}_{ano}",
                "motorista_id": motorista_id,
                "parceiro_id": parceiro_id,
                "semana": semana,
                "ano": ano,
                "periodo_inicio": data_inicio,
                "periodo_fim": data_fim,
                "valor_total": dados.get("total_portagens", 0),
                "transacoes": dados.get("transacoes", []),
                "fonte": "rpa",
                "importado_em": now
            }
            
            await db.despesas_viaverde.update_one(
                {
                    "motorista_id": motorista_id,
                    "semana": semana,
                    "ano": ano,
                    "fonte": "rpa"
                },
                {"$set": registro},
                upsert=True
            )
            resultado["colecao"] = "despesas_viaverde"
            resultado["campos_atualizados"] = ["valor_total"]
        
        if resultado["colecao"]:
            resultado["sucesso"] = True
            logger.info(f"Dados RPA guardados em {resultado['colecao']}: parceiro={parceiro_id}, semana={semana}/{ano}")
        else:
            resultado["erro"] = f"Plataforma '{plataforma}' não suportada"
        
        return resultado
        
    except Exception as e:
        logger.error(f"Erro ao guardar dados RPA: {e}")
        return {"sucesso": False, "erro": str(e)}


def calcular_semana_ano(offset: int = 0) -> tuple:
    """
    Calcula semana e ano baseado no offset
    offset=0 -> semana atual
    offset=1 -> semana passada
    """
    data = datetime.now() - timedelta(weeks=offset)
    return data.isocalendar()[1], data.isocalendar()[0]
