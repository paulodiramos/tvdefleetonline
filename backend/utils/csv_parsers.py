"""
Parsers para ficheiros CSV de diferentes plataformas
"""
import csv
import io
import logging
from datetime import datetime, timezone
from typing import List, Dict, Tuple
import re

logger = logging.getLogger(__name__)

class CSVParserBase:
    """Classe base para parsers de CSV"""
    
    def __init__(self, file_content: bytes):
        self.file_content = file_content
        self.encoding = 'utf-8'
        
    def detect_encoding(self):
        """Detectar encoding do ficheiro"""
        encodings = ['utf-8', 'latin-1', 'iso-8859-1', 'windows-1252']
        for enc in encodings:
            try:
                self.file_content.decode(enc)
                self.encoding = enc
                logger.info(f"Encoding detectado: {enc}")
                return enc
            except:
                continue
        return 'utf-8'
        
    def parse(self) -> Tuple[bool, List[Dict], str]:
        """
        Parse do ficheiro CSV
        
        Returns:
            Tupla (sucesso, dados, mensagem)
        """
        raise NotImplementedError("Método parse deve ser implementado nas subclasses")


class BoltCSVParser(CSVParserBase):
    """Parser para ficheiros CSV da Bolt"""
    
    def parse(self) -> Tuple[bool, List[Dict], str]:
        """
        Parse de ficheiro CSV da Bolt
        
        Formato esperado (exemplo):
        Date,Time,Trip ID,Driver,Earnings,Distance,Duration
        2025-12-01,14:30,BOLT123456,João Silva,12.50,15.2,25
        """
        try:
            self.detect_encoding()
            decoded = self.file_content.decode(self.encoding)
            
            # Detectar delimitador
            delimiter = ','
            if ';' in decoded[:500]:
                delimiter = ';'
            
            csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
            
            records = []
            for row in csv_reader:
                try:
                    # Mapear campos (adaptar conforme estrutura real do CSV Bolt)
                    record = {
                        'data': row.get('Date') or row.get('data') or row.get('Data'),
                        'hora': row.get('Time') or row.get('hora') or row.get('Hora'),
                        'viagem_id': row.get('Trip ID') or row.get('ID') or row.get('trip_id'),
                        'motorista': row.get('Driver') or row.get('Motorista') or row.get('driver'),
                        'ganhos': self._parse_money(row.get('Earnings') or row.get('Ganhos') or row.get('earnings') or '0'),
                        'distancia': self._parse_number(row.get('Distance') or row.get('Distância') or row.get('distance') or '0'),
                        'duracao': self._parse_number(row.get('Duration') or row.get('Duração') or row.get('duration') or '0'),
                        'origem': row.get('Origin') or row.get('Origem'),
                        'destino': row.get('Destination') or row.get('Destino'),
                        'plataforma': 'bolt',
                        'dados_completos': row
                    }
                    records.append(record)
                except Exception as e:
                    logger.warning(f"Erro ao processar linha: {e}")
                    continue
            
            if len(records) == 0:
                return False, [], "Nenhum registo válido encontrado no ficheiro"
            
            logger.info(f"✅ {len(records)} registos Bolt processados")
            return True, records, f"{len(records)} viagens importadas"
            
        except Exception as e:
            logger.error(f"Erro ao fazer parse do CSV Bolt: {e}")
            return False, [], f"Erro: {str(e)}"
    
    def _parse_money(self, value: str) -> float:
        """Converter string de dinheiro para float"""
        if not value:
            return 0.0
        # Remover símbolos de moeda e espaços
        clean = re.sub(r'[€$£\s]', '', str(value))
        # Substituir vírgula por ponto
        clean = clean.replace(',', '.')
        try:
            return float(clean)
        except:
            return 0.0
    
    def _parse_number(self, value: str) -> float:
        """Converter string numérica para float"""
        if not value:
            return 0.0
        clean = str(value).replace(',', '.')
        try:
            return float(clean)
        except:
            return 0.0


class UberCSVParser(CSVParserBase):
    """Parser para ficheiros CSV da Uber"""
    
    def parse(self) -> Tuple[bool, List[Dict], str]:
        """Parse de ficheiro CSV da Uber"""
        try:
            self.detect_encoding()
            decoded = self.file_content.decode(self.encoding)
            
            delimiter = ','
            if ';' in decoded[:500]:
                delimiter = ';'
            
            csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
            
            records = []
            for row in csv_reader:
                try:
                    record = {
                        'data': row.get('Date') or row.get('data') or row.get('Data'),
                        'hora': row.get('Time') or row.get('hora'),
                        'viagem_id': row.get('Trip UUID') or row.get('UUID') or row.get('ID'),
                        'motorista': row.get('Driver') or row.get('Motorista'),
                        'ganhos': self._parse_money(row.get('Fare') or row.get('Ganhos') or row.get('earnings') or '0'),
                        'distancia': self._parse_number(row.get('Distance') or row.get('Distância') or '0'),
                        'duracao': self._parse_number(row.get('Duration') or row.get('Duração') or '0'),
                        'cidade': row.get('City') or row.get('Cidade'),
                        'tipo_servico': row.get('Product') or row.get('Serviço'),
                        'plataforma': 'uber',
                        'dados_completos': row
                    }
                    records.append(record)
                except Exception as e:
                    logger.warning(f"Erro ao processar linha Uber: {e}")
                    continue
            
            if len(records) == 0:
                return False, [], "Nenhum registo válido encontrado no ficheiro"
            
            logger.info(f"✅ {len(records)} registos Uber processados")
            return True, records, f"{len(records)} viagens importadas"
            
        except Exception as e:
            logger.error(f"Erro ao fazer parse do CSV Uber: {e}")
            return False, [], f"Erro: {str(e)}"
    
    def _parse_money(self, value: str) -> float:
        if not value:
            return 0.0
        clean = re.sub(r'[€$£\s]', '', str(value))
        clean = clean.replace(',', '.')
        try:
            return float(clean)
        except:
            return 0.0
    
    def _parse_number(self, value: str) -> float:
        if not value:
            return 0.0
        clean = str(value).replace(',', '.')
        try:
            return float(clean)
        except:
            return 0.0


class ViaVerdeCSVParser(CSVParserBase):
    """Parser para ficheiros CSV Via Verde (portagens)"""
    
    def parse(self) -> Tuple[bool, List[Dict], str]:
        """Parse de ficheiro CSV Via Verde"""
        try:
            self.detect_encoding()
            decoded = self.file_content.decode(self.encoding)
            
            delimiter = ';'  # Via Verde geralmente usa ponto e vírgula
            if ',' in decoded[:500] and ';' not in decoded[:500]:
                delimiter = ','
            
            csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
            
            records = []
            for row in csv_reader:
                try:
                    record = {
                        'data': row.get('Data') or row.get('Date') or row.get('data'),
                        'hora': row.get('Hora') or row.get('Time') or row.get('hora'),
                        'local': row.get('Local') or row.get('Portagem') or row.get('Location'),
                        'matricula': row.get('Matrícula') or row.get('Matricula') or row.get('Vehicle'),
                        'valor': self._parse_money(row.get('Valor') or row.get('Montante') or row.get('Amount') or '0'),
                        'tipo': row.get('Tipo') or 'portagem',
                        'plataforma': 'via_verde',
                        'dados_completos': row
                    }
                    records.append(record)
                except Exception as e:
                    logger.warning(f"Erro ao processar linha Via Verde: {e}")
                    continue
            
            if len(records) == 0:
                return False, [], "Nenhum registo válido encontrado no ficheiro"
            
            logger.info(f"✅ {len(records)} registos Via Verde processados")
            return True, records, f"{len(records)} transações importadas"
            
        except Exception as e:
            logger.error(f"Erro ao fazer parse do CSV Via Verde: {e}")
            return False, [], f"Erro: {str(e)}"
    
    def _parse_money(self, value: str) -> float:
        if not value:
            return 0.0
        clean = re.sub(r'[€$£\s]', '', str(value))
        clean = clean.replace(',', '.')
        try:
            return float(clean)
        except:
            return 0.0


class GPSCSVParser(CSVParserBase):
    """Parser para ficheiros CSV de GPS (rastreamento)"""
    
    def parse(self) -> Tuple[bool, List[Dict], str]:
        """Parse de ficheiro CSV GPS"""
        try:
            self.detect_encoding()
            decoded = self.file_content.decode(self.encoding)
            
            delimiter = ','
            if ';' in decoded[:500]:
                delimiter = ';'
            
            csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
            
            records = []
            for row in csv_reader:
                try:
                    record = {
                        'data': row.get('Data') or row.get('Date') or row.get('data'),
                        'hora': row.get('Hora') or row.get('Time') or row.get('hora'),
                        'matricula': row.get('Matrícula') or row.get('Vehicle') or row.get('Veículo'),
                        'distancia': self._parse_number(row.get('Distância') or row.get('Distance') or row.get('km') or '0'),
                        'latitude': row.get('Latitude') or row.get('Lat'),
                        'longitude': row.get('Longitude') or row.get('Lon') or row.get('Long'),
                        'velocidade': self._parse_number(row.get('Velocidade') or row.get('Speed') or '0'),
                        'localizacao': row.get('Local') or row.get('Location'),
                        'plataforma': 'gps',
                        'dados_completos': row
                    }
                    records.append(record)
                except Exception as e:
                    logger.warning(f"Erro ao processar linha GPS: {e}")
                    continue
            
            if len(records) == 0:
                return False, [], "Nenhum registo válido encontrado no ficheiro"
            
            logger.info(f"✅ {len(records)} registos GPS processados")
            return True, records, f"{len(records)} registos importados"
            
        except Exception as e:
            logger.error(f"Erro ao fazer parse do CSV GPS: {e}")
            return False, [], f"Erro: {str(e)}"
    
    def _parse_number(self, value: str) -> float:
        if not value:
            return 0.0
        clean = str(value).replace(',', '.')
        try:
            return float(clean)
        except:
            return 0.0


class CombustivelCSVParser(CSVParserBase):
    """Parser para ficheiros CSV de Combustível"""
    
    def parse(self) -> Tuple[bool, List[Dict], str]:
        """Parse de ficheiro CSV Combustível"""
        try:
            self.detect_encoding()
            decoded = self.file_content.decode(self.encoding)
            
            delimiter = ','
            if ';' in decoded[:500]:
                delimiter = ';'
            
            csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
            
            records = []
            for row in csv_reader:
                try:
                    record = {
                        'data': row.get('Data') or row.get('Date') or row.get('data'),
                        'hora': row.get('Hora') or row.get('Time'),
                        'matricula': row.get('Matrícula') or row.get('Vehicle') or row.get('Veículo'),
                        'valor': self._parse_money(row.get('Valor') or row.get('Amount') or row.get('Total') or '0'),
                        'litros': self._parse_number(row.get('Litros') or row.get('Liters') or row.get('Quantity') or '0'),
                        'preco_litro': self._parse_money(row.get('Preço/Litro') or row.get('Price/Liter') or '0'),
                        'posto': row.get('Posto') or row.get('Station') or row.get('Local'),
                        'tipo_combustivel': row.get('Tipo') or row.get('Fuel Type') or row.get('Combustível'),
                        'plataforma': 'combustivel',
                        'dados_completos': row
                    }
                    records.append(record)
                except Exception as e:
                    logger.warning(f"Erro ao processar linha Combustível: {e}")
                    continue
            
            if len(records) == 0:
                return False, [], "Nenhum registo válido encontrado no ficheiro"
            
            logger.info(f"✅ {len(records)} registos Combustível processados")
            return True, records, f"{len(records)} abastecimentos importados"
            
        except Exception as e:
            logger.error(f"Erro ao fazer parse do CSV Combustível: {e}")
            return False, [], f"Erro: {str(e)}"
    
    def _parse_money(self, value: str) -> float:
        if not value:
            return 0.0
        clean = re.sub(r'[€$£\s]', '', str(value))
        clean = clean.replace(',', '.')
        try:
            return float(clean)
        except:
            return 0.0
    
    def _parse_number(self, value: str) -> float:
        if not value:
            return 0.0
        clean = str(value).replace(',', '.')
        try:
            return float(clean)
        except:
            return 0.0


def get_parser(plataforma: str, file_content: bytes):
    """
    Obter parser adequado para a plataforma
    
    Args:
        plataforma: Nome da plataforma (bolt, uber, via_verde, gps, combustivel)
        file_content: Conteúdo do ficheiro em bytes
        
    Returns:
        Instância do parser correspondente
    """
    parsers = {
        'bolt': BoltCSVParser,
        'uber': UberCSVParser,
        'via_verde': ViaVerdeCSVParser,
        'gps': GPSCSVParser,
        'combustivel': CombustivelCSVParser
    }
    
    parser_class = parsers.get(plataforma.lower())
    if not parser_class:
        raise ValueError(f"Plataforma '{plataforma}' não suportada")
    
    return parser_class(file_content)
