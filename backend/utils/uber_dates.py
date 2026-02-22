"""
Utilitários para cálculo de datas da Uber
A Uber usa semanas de SEGUNDA 4:03 AM a SEGUNDA 4:00 AM
"""
from datetime import datetime, timedelta
from typing import Dict, List

def calcular_semana_uber(semana_index: int = 0) -> Dict[str, str]:
    """
    Calcula o período de uma semana Uber
    
    Args:
        semana_index: 0=semana atual, 1=semana passada, etc.
        
    Returns:
        Dict com inicio, fim, inicio_display, fim_display
    """
    agora = datetime.now()
    
    # Encontrar a última segunda-feira
    dias_desde_segunda = agora.weekday()
    
    # Se estamos antes das 4:03 de segunda, ainda é a semana anterior
    if agora.weekday() == 0 and agora.hour < 4:
        dias_desde_segunda = 7
    
    segunda_atual = agora.date() - timedelta(days=dias_desde_segunda)
    
    # Retroceder N semanas
    segunda_inicio = segunda_atual - timedelta(weeks=semana_index)
    segunda_fim = segunda_inicio + timedelta(days=7)
    
    return {
        "inicio": segunda_inicio.strftime('%Y-%m-%d'),
        "fim": segunda_fim.strftime('%Y-%m-%d'),
        "inicio_display": f"{segunda_inicio.strftime('%b %d, %Y')}-4:03AM",
        "fim_display": f"{segunda_fim.strftime('%b %d, %Y')}-4:01AM",
        "semana_index": semana_index
    }

def listar_semanas_uber(quantidade: int = 8) -> List[Dict[str, str]]:
    """
    Lista as últimas N semanas da Uber
    
    Args:
        quantidade: Número de semanas a listar
        
    Returns:
        Lista de dicts com info de cada semana
    """
    return [calcular_semana_uber(i) for i in range(quantidade)]

def semana_uber_para_dropdown_index(semana_index: int) -> int:
    """
    Converte o semana_index do nosso sistema para o índice do dropdown da Uber
    O dropdown da Uber lista as semanas de cima para baixo, mais recente primeiro
    
    Args:
        semana_index: 0=atual, 1=passada, etc.
        
    Returns:
        Índice para seleccionar no dropdown (1-based)
    """
    # O dropdown da Uber tem a semana mais recente em primeiro
    # Então semana_index 0 = índice 1, semana_index 1 = índice 2, etc.
    return semana_index + 1


if __name__ == "__main__":
    # Teste
    print("Semanas Uber:")
    for s in listar_semanas_uber(4):
        print(f"  [{s['semana_index']}] {s['inicio_display']} - {s['fim_display']}")
