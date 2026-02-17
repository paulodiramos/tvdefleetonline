"""
Teste de diagnóstico para o filtro de datas do Prio.
Executa o scraper e verifica se os campos de data são encontrados e preenchidos.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configurar Playwright
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'


async def test_prio_date_filter():
    """
    Testa o filtro de datas do Prio.
    """
    from playwright.async_api import async_playwright
    
    # Credenciais de teste
    username = "196635"
    password = "Sacam@2026"
    
    # Calcular datas da semana 5 e semana 6 para testar diferença
    # Semana 5 de 2026: 27/01/2026 a 02/02/2026
    # Semana 6 de 2026: 03/02/2026 a 09/02/2026
    
    semana_teste = 5
    ano_teste = 2026
    
    # Calcular datas
    jan4 = datetime(ano_teste, 1, 4)
    start_of_week = jan4 - timedelta(days=jan4.weekday()) + timedelta(weeks=semana_teste-1)
    end_of_week = start_of_week + timedelta(days=6)
    
    start_date = start_of_week.strftime('%Y-%m-%d')  # 2026-01-27
    end_date = end_of_week.strftime('%Y-%m-%d')      # 2026-02-02
    
    logger.info(f"📅 Testando filtro de datas para Semana {semana_teste}/{ano_teste}")
    logger.info(f"   Data início: {start_date}")
    logger.info(f"   Data fim: {end_date}")
    
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(
        headless=True,
        args=['--no-sandbox', '--disable-setuid-sandbox']
    )
    
    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080}
    )
    page = await context.new_page()
    
    try:
        # 1. Login
        logger.info("🔐 Fazendo login no Prio...")
        await page.goto("https://www.myprio.com/MyPrioReactiveTheme/Login", wait_until='networkidle')
        await asyncio.sleep(2)
        
        await page.screenshot(path='/tmp/prio_test_01_login.png')
        
        # Preencher credenciais
        username_input = page.locator('#Input_Username')
        if await username_input.count() > 0:
            await username_input.fill(username)
            logger.info("✅ Username preenchido")
        
        password_input = page.locator('#Input_Password')
        if await password_input.count() > 0:
            await password_input.fill(password)
            logger.info("✅ Password preenchida")
        
        # Clicar login
        login_btn = page.locator('button:has-text("INICIAR SESSÃO")')
        if await login_btn.count() > 0:
            await login_btn.first.click()
        
        await asyncio.sleep(5)
        await page.screenshot(path='/tmp/prio_test_02_after_login.png')
        
        # Aceitar cookies se existir
        try:
            cookie_btn = page.locator('button:has-text("Ok")')
            if await cookie_btn.count() > 0 and await cookie_btn.first.is_visible():
                await cookie_btn.first.click(force=True)
                await asyncio.sleep(2)
                logger.info("✅ Cookies aceites")
        except:
            pass
        
        # 2. Navegar para Transações
        logger.info("📍 Navegando para Transações...")
        await page.goto("https://www.myprio.com/Transactions/Transactions", wait_until='networkidle')
        await asyncio.sleep(3)
        
        await page.screenshot(path='/tmp/prio_test_03_transactions.png')
        
        # 3. DIAGNÓSTICO - Encontrar todos os inputs na página
        logger.info("🔍 DIAGNÓSTICO - Procurando inputs de data...")
        
        all_inputs = await page.locator('input').all()
        logger.info(f"   Total de inputs na página: {len(all_inputs)}")
        
        for i, inp in enumerate(all_inputs):
            try:
                inp_id = await inp.get_attribute('id') or ''
                inp_name = await inp.get_attribute('name') or ''
                inp_placeholder = await inp.get_attribute('placeholder') or ''
                inp_type = await inp.get_attribute('type') or ''
                inp_value = await inp.get_attribute('value') or ''
                inp_class = await inp.get_attribute('class') or ''
                is_visible = await inp.is_visible()
                
                if is_visible and (inp_type in ['text', 'date', ''] or 'date' in inp_id.lower() or 'date' in inp_class.lower() or 'inicio' in inp_id.lower() or 'fim' in inp_id.lower()):
                    logger.info(f"   [{i}] id='{inp_id}' name='{inp_name}' placeholder='{inp_placeholder}' type='{inp_type}' value='{inp_value[:30] if inp_value else ''}' class='{inp_class[:50] if inp_class else ''}'")
            except Exception as e:
                logger.warning(f"   [{i}] Erro: {e}")
        
        # 4. Tentar encontrar os campos de data específicos
        logger.info("🔍 Procurando campos de data específicos...")
        
        # Lista de seletores para campo de início
        inicio_selectors = [
            'input[id*="Inicio"]',
            'input[id*="inicio"]',
            'input[id*="Start"]',
            'input[id*="start"]',
            'input[placeholder*="Início"]',
            'input[placeholder*="início"]',
            'input[name*="start"]',
            '#DataInicio',
            '#Input_DataInicio',
            'input.date-inicio',
            'input[data-type="date"]:first-of-type',
        ]
        
        for selector in inicio_selectors:
            try:
                inp = page.locator(selector).first
                count = await inp.count()
                if count > 0:
                    is_visible = await inp.is_visible()
                    logger.info(f"   ✅ ENCONTRADO: '{selector}' - visível: {is_visible}")
                else:
                    logger.info(f"   ❌ Não encontrado: '{selector}'")
            except Exception as e:
                logger.info(f"   ❌ Erro em '{selector}': {e}")
        
        # 5. Listar todos os elementos com 'date' no atributo
        logger.info("🔍 Procurando elementos com 'date'...")
        
        date_elements = await page.locator('[class*="date"], [id*="date"], [id*="Date"], [class*="calendar"], [id*="calendar"]').all()
        logger.info(f"   Encontrados {len(date_elements)} elementos com 'date'")
        
        for i, elem in enumerate(date_elements[:10]):
            try:
                tag = await elem.evaluate('el => el.tagName')
                elem_id = await elem.get_attribute('id') or ''
                elem_class = await elem.get_attribute('class') or ''
                logger.info(f"   [{i}] <{tag}> id='{elem_id}' class='{elem_class[:60]}'")
            except:
                pass
        
        # 6. Capturar HTML da área de filtro
        logger.info("📄 Capturando HTML da área de filtro...")
        try:
            filter_html = await page.locator('.filter-area, .filtros, form').first.inner_html()
            # Guardar para análise
            with open('/tmp/prio_filter_html.html', 'w') as f:
                f.write(filter_html[:5000])
            logger.info("   HTML guardado em /tmp/prio_filter_html.html")
        except Exception as e:
            logger.warning(f"   Erro ao capturar HTML: {e}")
        
        # 7. Capturar toda a página
        page_html = await page.content()
        with open('/tmp/prio_full_page.html', 'w') as f:
            f.write(page_html)
        logger.info("   HTML completo guardado em /tmp/prio_full_page.html")
        
        await page.screenshot(path='/tmp/prio_test_04_final.png', full_page=True)
        
        logger.info("✅ Diagnóstico concluído. Verificar screenshots em /tmp/prio_test_*.png")
        
    except Exception as e:
        logger.error(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()
        await page.screenshot(path='/tmp/prio_test_99_error.png')
    finally:
        await browser.close()
        await playwright.stop()


if __name__ == "__main__":
    asyncio.run(test_prio_date_filter())
