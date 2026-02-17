"""
Teste do PrioScraper corrigido - verifica se o filtro de datas funciona.
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


async def test_prio_scraper_fixed():
    """
    Testa o PrioScraper corrigido.
    """
    from integrations.platform_scrapers import PrioScraper
    
    # Credenciais de teste
    username = "196635"
    password = "Sacam@2026"
    
    # Testar com Semana 5 de 2026 (datas conhecidas)
    semana_teste = 5
    ano_teste = 2026
    
    # Calcular datas da semana 5
    jan4 = datetime(ano_teste, 1, 4)
    start_of_week = jan4 - timedelta(days=jan4.weekday()) + timedelta(weeks=semana_teste-1)
    end_of_week = start_of_week + timedelta(days=6)
    
    start_date = start_of_week.strftime('%Y-%m-%d')
    end_date = end_of_week.strftime('%Y-%m-%d')
    
    logger.info("=" * 60)
    logger.info(f"📅 TESTE PRIO SCRAPER - Semana {semana_teste}/{ano_teste}")
    logger.info(f"   Data início: {start_date}")
    logger.info(f"   Data fim: {end_date}")
    logger.info("=" * 60)
    
    async with PrioScraper(headless=True) as scraper:
        # 1. Login
        logger.info("\n🔐 PASSO 1: Login...")
        login_result = await scraper.login(username, password)
        
        if not login_result.get("success"):
            logger.error(f"❌ Login falhou: {login_result.get('error')}")
            return
        
        logger.info("✅ Login bem sucedido!")
        
        # 2. Extrair dados com filtro de datas
        logger.info(f"\n📊 PASSO 2: Extraindo dados para {start_date} a {end_date}...")
        result = await scraper.extract_data(start_date=start_date, end_date=end_date)
        
        # 3. Verificar resultados
        logger.info("\n📋 RESULTADOS:")
        logger.info(f"   Sucesso: {result.get('success')}")
        logger.info(f"   Total de linhas extraídas: {result.get('rows_extracted', 0)}")
        
        if result.get('data'):
            logger.info("\n📝 TRANSAÇÕES EXTRAÍDAS:")
            for i, trans in enumerate(result['data'][:5]):
                # Formato esperado: [data, litros, valor, local]
                logger.info(f"   [{i+1}] Data: {trans[0]}, Litros: {trans[1]}, Valor: {trans[2]}€, Local: {trans[3][:30]}...")
            
            if len(result['data']) > 5:
                logger.info(f"   ... e mais {len(result['data']) - 5} transações")
        else:
            logger.warning("   ⚠️ Nenhuma transação extraída")
        
        # 4. Verificar se as datas extraídas estão no período correcto
        if result.get('data'):
            datas_corretas = 0
            datas_incorretas = 0
            
            for trans in result['data']:
                data_trans = trans[0] if trans else ""
                # Converter de DD/MM/YYYY para datetime
                try:
                    if "/" in data_trans:
                        parts = data_trans.split(" ")[0].split("/")
                        if len(parts) == 3:
                            dt_trans = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                            if start_of_week <= dt_trans <= end_of_week:
                                datas_corretas += 1
                            else:
                                datas_incorretas += 1
                                logger.warning(f"   ⚠️ Data fora do período: {data_trans}")
                except Exception as e:
                    logger.warning(f"   Erro ao verificar data {data_trans}: {e}")
            
            logger.info(f"\n📊 VERIFICAÇÃO DE DATAS:")
            logger.info(f"   ✅ Dentro do período: {datas_corretas}")
            logger.info(f"   ❌ Fora do período: {datas_incorretas}")
            
            if datas_incorretas > 0:
                logger.error("   🔴 FILTRO DE DATAS NÃO ESTÁ A FUNCIONAR CORRECTAMENTE!")
            else:
                logger.info("   🟢 FILTRO DE DATAS FUNCIONANDO CORRECTAMENTE!")
    
    logger.info("\n" + "=" * 60)
    logger.info("✅ TESTE CONCLUÍDO")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_prio_scraper_fixed())
