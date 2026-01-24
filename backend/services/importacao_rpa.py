"""
Serviço de Importação de Dados RPA
Suporta importação manual (upload) e automática (agendada)
"""

import os
import csv
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from io import StringIO
import uuid

logger = logging.getLogger(__name__)


class CSVParser:
    """Parser de CSV para diferentes plataformas"""
    
    @staticmethod
    def parse_bolt(content: str) -> List[Dict]:
        """Parse CSV da Bolt Fleet"""
        results = []
        reader = csv.DictReader(StringIO(content), delimiter=',')
        
        for row in reader:
            try:
                # Adaptar campos da Bolt
                record = {
                    "plataforma": "bolt",
                    "motorista_nome": row.get("Driver name", row.get("Nome do motorista", "")),
                    "motorista_email": row.get("Driver email", row.get("Email", "")),
                    "data": row.get("Date", row.get("Data", "")),
                    "corridas": int(row.get("Rides", row.get("Corridas", 0)) or 0),
                    "valor_bruto": float(row.get("Gross earnings", row.get("Ganhos brutos", "0").replace(",", ".").replace("€", "").strip()) or 0),
                    "comissao": float(row.get("Commission", row.get("Comissão", "0").replace(",", ".").replace("€", "").strip()) or 0),
                    "valor_liquido": float(row.get("Net earnings", row.get("Ganhos líquidos", "0").replace(",", ".").replace("€", "").strip()) or 0),
                    "bonus": float(row.get("Bonus", row.get("Bónus", "0").replace(",", ".").replace("€", "").strip()) or 0),
                    "gorjetas": float(row.get("Tips", row.get("Gorjetas", "0").replace(",", ".").replace("€", "").strip()) or 0),
                }
                results.append(record)
            except Exception as e:
                logger.warning(f"Erro ao processar linha Bolt: {e}")
                continue
        
        return results
    
    @staticmethod
    def parse_uber(content: str) -> List[Dict]:
        """Parse CSV da Uber"""
        results = []
        reader = csv.DictReader(StringIO(content), delimiter=',')
        
        for row in reader:
            try:
                record = {
                    "plataforma": "uber",
                    "motorista_nome": row.get("Driver", row.get("Motorista", "")),
                    "motorista_email": row.get("Email", ""),
                    "data": row.get("Date", row.get("Data", "")),
                    "corridas": int(row.get("Trips", row.get("Viagens", 0)) or 0),
                    "valor_bruto": float(row.get("Gross Fares", row.get("Tarifas brutas", "0").replace(",", ".").replace("€", "").strip()) or 0),
                    "comissao": float(row.get("Service Fee", row.get("Taxa de serviço", "0").replace(",", ".").replace("€", "").strip()) or 0),
                    "valor_liquido": float(row.get("Net Payout", row.get("Pagamento líquido", "0").replace(",", ".").replace("€", "").strip()) or 0),
                    "bonus": float(row.get("Promotions", row.get("Promoções", "0").replace(",", ".").replace("€", "").strip()) or 0),
                    "gorjetas": float(row.get("Tips", row.get("Gorjetas", "0").replace(",", ".").replace("€", "").strip()) or 0),
                }
                results.append(record)
            except Exception as e:
                logger.warning(f"Erro ao processar linha Uber: {e}")
                continue
        
        return results
    
    @staticmethod
    def parse_generic(content: str) -> List[Dict]:
        """Parse CSV genérico"""
        results = []
        reader = csv.DictReader(StringIO(content), delimiter=',')
        
        for row in reader:
            # Tentar identificar campos comuns
            record = {
                "plataforma": "outra",
                "raw_data": dict(row)
            }
            
            # Mapear campos conhecidos
            for key, value in row.items():
                key_lower = key.lower()
                if "nome" in key_lower or "name" in key_lower or "driver" in key_lower:
                    record["motorista_nome"] = value
                elif "email" in key_lower:
                    record["motorista_email"] = value
                elif "data" in key_lower or "date" in key_lower:
                    record["data"] = value
                elif "corrida" in key_lower or "ride" in key_lower or "trip" in key_lower:
                    try:
                        record["corridas"] = int(value or 0)
                    except:
                        pass
                elif "bruto" in key_lower or "gross" in key_lower:
                    try:
                        record["valor_bruto"] = float(value.replace(",", ".").replace("€", "").strip() or 0)
                    except:
                        pass
                elif "liquido" in key_lower or "net" in key_lower:
                    try:
                        record["valor_liquido"] = float(value.replace(",", ".").replace("€", "").strip() or 0)
                    except:
                        pass
            
            results.append(record)
        
        return results
    
    @classmethod
    def parse(cls, content: str, plataforma: str) -> List[Dict]:
        """Parse CSV baseado na plataforma"""
        parsers = {
            "bolt": cls.parse_bolt,
            "uber": cls.parse_uber,
        }
        
        parser = parsers.get(plataforma.lower(), cls.parse_generic)
        return parser(content)


def agrupar_por_motorista(records: List[Dict]) -> Dict[str, Dict]:
    """Agrupa registos por motorista para resumo semanal"""
    motoristas = {}
    
    for record in records:
        nome = record.get("motorista_nome", "Desconhecido")
        email = record.get("motorista_email", "")
        
        key = email if email else nome
        
        if key not in motoristas:
            motoristas[key] = {
                "nome": nome,
                "email": email,
                "plataforma": record.get("plataforma", ""),
                "total_corridas": 0,
                "total_bruto": 0.0,
                "total_comissao": 0.0,
                "total_liquido": 0.0,
                "total_bonus": 0.0,
                "total_gorjetas": 0.0,
                "dias_trabalhados": set(),
                "registos": []
            }
        
        motoristas[key]["total_corridas"] += record.get("corridas", 0)
        motoristas[key]["total_bruto"] += record.get("valor_bruto", 0)
        motoristas[key]["total_comissao"] += record.get("comissao", 0)
        motoristas[key]["total_liquido"] += record.get("valor_liquido", 0)
        motoristas[key]["total_bonus"] += record.get("bonus", 0)
        motoristas[key]["total_gorjetas"] += record.get("gorjetas", 0)
        
        if record.get("data"):
            motoristas[key]["dias_trabalhados"].add(record["data"])
        
        motoristas[key]["registos"].append(record)
    
    # Converter sets para listas
    for key in motoristas:
        motoristas[key]["dias_trabalhados"] = len(motoristas[key]["dias_trabalhados"])
    
    return motoristas


def gerar_resumo_semanal(motorista_data: Dict, semana: int, ano: int) -> Dict:
    """Gera resumo semanal para um motorista"""
    return {
        "semana": semana,
        "ano": ano,
        "motorista": motorista_data["nome"],
        "email": motorista_data["email"],
        "plataforma": motorista_data["plataforma"],
        "metricas": {
            "corridas": motorista_data["total_corridas"],
            "valor_bruto": round(motorista_data["total_bruto"], 2),
            "comissao": round(motorista_data["total_comissao"], 2),
            "valor_liquido": round(motorista_data["total_liquido"], 2),
            "bonus": round(motorista_data["total_bonus"], 2),
            "gorjetas": round(motorista_data["total_gorjetas"], 2),
            "dias_trabalhados": motorista_data["dias_trabalhados"]
        },
        "gerado_em": datetime.now(timezone.utc).isoformat()
    }
