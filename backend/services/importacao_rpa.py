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
    def _limpar_valor(valor: str) -> float:
        """Limpar e converter valor monetário para float"""
        if not valor or valor == "":
            return 0.0
        # Remover símbolos de moeda, espaços e converter vírgula para ponto
        valor_limpo = str(valor).replace("€", "").replace(" ", "").replace(",", ".").strip()
        try:
            return float(valor_limpo) if valor_limpo else 0.0
        except:
            return 0.0
    
    @staticmethod
    def parse_bolt(content: str) -> List[Dict]:
        """Parse CSV da Bolt Fleet - formato real português"""
        results = []
        # Remover BOM se existir
        if content.startswith('\ufeff'):
            content = content[1:]
        
        reader = csv.DictReader(StringIO(content), delimiter=',')
        
        for row in reader:
            try:
                # Formato real da Bolt Portugal
                motorista = row.get("Motorista", row.get("Driver name", ""))
                email = row.get("Email", row.get("Driver email", ""))
                telefone = row.get("Telemóvel", row.get("Phone", ""))
                
                # Ganhos - formato "Ganhos brutos (total)|€"
                ganhos_bruto = CSVParser._limpar_valor(
                    row.get("Ganhos brutos (total)|€", 
                    row.get("Ganhos brutos (total)", 
                    row.get("Gross earnings", "0")))
                )
                
                comissao = CSVParser._limpar_valor(
                    row.get("Comissões|€",
                    row.get("Comissões",
                    row.get("Commission", "0")))
                )
                
                ganhos_liquido = CSVParser._limpar_valor(
                    row.get("Ganhos líquidos|€",
                    row.get("Ganhos líquidos",
                    row.get("Net earnings", "0")))
                )
                
                gorjetas = CSVParser._limpar_valor(
                    row.get("Gorjetas dos passageiros|€",
                    row.get("Gorjetas",
                    row.get("Tips", "0")))
                )
                
                bonus = CSVParser._limpar_valor(
                    row.get("Ganhos da campanha|€",
                    row.get("Bónus",
                    row.get("Bonus", "0")))
                )
                
                portagens = CSVParser._limpar_valor(
                    row.get("Portagens|€",
                    row.get("Portagens", "0"))
                )
                
                total_taxas = CSVParser._limpar_valor(
                    row.get("Total de taxas|€",
                    row.get("Total de taxas", "0"))
                )
                
                record = {
                    "plataforma": "bolt",
                    "motorista_nome": motorista,
                    "motorista_email": email,
                    "motorista_telefone": telefone,
                    "valor_bruto": ganhos_bruto,
                    "comissao": comissao,
                    "valor_liquido": ganhos_liquido,
                    "gorjetas": gorjetas,
                    "bonus": bonus,
                    "portagens": portagens,
                    "total_taxas": total_taxas,
                    "pagamento_previsto": CSVParser._limpar_valor(row.get("Pagamento previsto|€", "0")),
                }
                
                # Só adicionar se tiver dados válidos
                if motorista and (ganhos_bruto > 0 or ganhos_liquido > 0):
                    results.append(record)
                    
            except Exception as e:
                logger.warning(f"Erro ao processar linha Bolt: {e} - Row: {row}")
                continue
        
        return results
    
    @staticmethod
    def parse_uber(content: str) -> List[Dict]:
        """Parse CSV da Uber - formato real português"""
        results = []
        # Remover BOM se existir
        if content.startswith('\ufeff'):
            content = content[1:]
        
        reader = csv.DictReader(StringIO(content), delimiter=',')
        
        for row in reader:
            try:
                # Formato real da Uber Portugal
                uuid = row.get("UUID do motorista", "")
                nome = row.get("Nome próprio do motorista", row.get("First name", ""))
                apelido = row.get("Apelido do motorista", row.get("Last name", ""))
                nome_completo = f"{nome} {apelido}".strip()
                
                # Valor total pago
                pago_total = CSVParser._limpar_valor(
                    row.get("Pago a si", 
                    row.get("Paid to you", "0"))
                )
                
                # Rendimentos
                rendimentos = CSVParser._limpar_valor(
                    row.get("Pago a si : Os seus rendimentos",
                    row.get("Your earnings", "0"))
                )
                
                # Tarifa bruta
                tarifa = CSVParser._limpar_valor(
                    row.get("Pago a si:Os seus rendimentos:Tarifa:Tarifa",
                    row.get("Pago a si : Os seus rendimentos : Tarifa",
                    row.get("Fare", "0")))
                )
                
                # Taxa de serviço (comissão Uber)
                taxa_servico = CSVParser._limpar_valor(
                    row.get("Pago a si:Os seus rendimentos:Taxa de serviço",
                    row.get("Service fee", "0"))
                )
                
                # Gorjetas
                gorjetas = CSVParser._limpar_valor(
                    row.get("Pago a si:Os seus rendimentos:Gratificação",
                    row.get("Tips", "0"))
                )
                
                # Portagens
                portagens = CSVParser._limpar_valor(
                    row.get("Pago a si:Saldo da viagem:Reembolsos:Portagem",
                    row.get("Tolls", "0"))
                )
                
                # Transferência bancária (pode ser negativo se foi pago ao parceiro)
                transferencia = CSVParser._limpar_valor(
                    row.get("Pago a si:Saldo da viagem:Pagamentos:Transferido para uma conta bancária", "0")
                )
                
                record = {
                    "plataforma": "uber",
                    "motorista_uuid": uuid,
                    "motorista_nome": nome_completo,
                    "motorista_email": "",  # Uber não inclui email no CSV
                    "valor_bruto": tarifa if tarifa > 0 else abs(pago_total),
                    "comissao": abs(taxa_servico),
                    "valor_liquido": pago_total if pago_total > 0 else rendimentos,
                    "gorjetas": gorjetas,
                    "portagens": portagens,
                    "transferencia_bancaria": transferencia,
                    "rendimentos_totais": rendimentos,
                }
                
                # Só adicionar se tiver dados válidos (excluir linhas de transferência pura)
                if nome_completo and pago_total != 0:
                    results.append(record)
                    
            except Exception as e:
                logger.warning(f"Erro ao processar linha Uber: {e} - Row: {row}")
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
