"""
Teste do ViaVerdeRPA V2 - verifica se a sincronização funciona.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta

# Adicionar backend ao path
sys.path.insert(0, '/app/backend')

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configurar Playwright
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'


async def test_viaverde_v2():
    """
    Testa o ViaVerdeRPA V2.
    """
    from services.rpa_viaverde_v2 import executar_rpa_viaverde_v2
    
    # Credenciais de teste
    email = "tsacamalda@gmail.com"
    password = "D@niel18"
    
    # Testar com Semana 5 de 2026 (datas conhecidas)
    semana_teste = 5
    ano_teste = 2026
    
    # Calcular datas da semana 5 (Segunda a Domingo)
    jan4 = datetime(ano_teste, 1, 4)
    start_of_week = jan4 - timedelta(days=jan4.weekday()) + timedelta(weeks=semana_teste-1)
    end_of_week = start_of_week + timedelta(days=6)
    
    data_inicio = start_of_week.strftime('%Y-%m-%d')  # Formato: 2026-01-26
    data_fim = end_of_week.strftime('%Y-%m-%d')       # Formato: 2026-02-01
    
    logger.info("=" * 60)
    logger.info(f"📅 TESTE VIA VERDE RPA V2 - Semana {semana_teste}/{ano_teste}")
    logger.info(f"   Data início: {data_inicio}")
    logger.info(f"   Data fim: {data_fim}")
    logger.info("=" * 60)
    
    # Executar RPA
    resultado = await executar_rpa_viaverde_v2(
        email=email,
        password=password,
        data_inicio=data_inicio,
        data_fim=data_fim,
        headless=True
    )
    
    # Mostrar resultados
    logger.info("\n" + "=" * 60)
    logger.info("📋 RESULTADOS:")
    logger.info(f"   Sucesso: {resultado.get('sucesso')}")
    logger.info(f"   Ficheiro: {resultado.get('ficheiro')}")
    logger.info(f"   Total movimentos: {resultado.get('total_movimentos', 0)}")
    logger.info(f"   Mensagem: {resultado.get('mensagem')}")
    
    logger.info("\n📝 LOGS:")
    for log in resultado.get('logs', []):
        logger.info(f"   - {log}")
    
    if resultado.get('movimentos'):
        logger.info("\n📊 MOVIMENTOS ENCONTRADOS:")
        for i, mov in enumerate(resultado['movimentos'][:10]):
            logger.info(f"   [{i+1}] {mov.get('data')} | {mov.get('hora', '')} | {mov.get('local', '')[:40]} | €{mov.get('valor', 0):.2f}")
        
        if len(resultado['movimentos']) > 10:
            logger.info(f"   ... e mais {len(resultado['movimentos']) - 10} movimentos")
    
    logger.info("\n" + "=" * 60)
    logger.info("✅ TESTE CONCLUÍDO")
    logger.info("=" * 60)
    
    return resultado


if __name__ == "__main__":
    asyncio.run(test_viaverde_v2())
