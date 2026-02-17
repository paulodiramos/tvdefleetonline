"""
RPA Uber - Extração de Dados de Rendimentos
Versão: 1.0
Data: 02/02/2026

Extrai dados de rendimentos do portal Uber Fleet para motoristas.
Suporta extração por semana específica ou período personalizado.
"""

import logging
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
import uuid

logger = logging.getLogger(__name__)


class UberRPA:
    """Classe para automação do portal Uber Fleet"""
    
    def __init__(self, email: str, password: str, sms_code: str = None, pin_code: str = None):
        self.email = email
        self.password = password
        self.sms_code = sms_code  # Código SMS para autenticação
        self.pin_code = pin_code  # PIN/código de acesso adicional
        self.browser = None
        self.context = None
        self.page = None
        self.downloads_path = Path("/tmp/uber_downloads")
        self.downloads_path.mkdir(exist_ok=True)
        self.session_path = Path("/tmp/uber_session")
        self.session_path.mkdir(exist_ok=True)
        
    async def iniciar_browser(self, headless: bool = True, usar_sessao: bool = True):
        """Iniciar browser Playwright com suporte a sessão persistente e anti-detecção"""
        from playwright.async_api import async_playwright
        import json
        import os
        
        # Definir caminho do Playwright
        os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'
        
        self.playwright = await async_playwright().start()
        
        # Usar configurações mais reais para evitar detecção de bot
        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=[
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1920,1080'
            ]
        )
        
        # Tentar carregar sessão guardada
        cookies_file = self.session_path / f"cookies_{self.email.replace('@','_').replace('.','_')}.json"
        storage_state = None
        
        if usar_sessao and cookies_file.exists():
            try:
                storage_state = str(cookies_file)
                logger.info(f"📂 A carregar sessão guardada: {cookies_file}")
            except Exception as e:
                logger.warning(f"⚠️ Não foi possível carregar sessão: {e}")
        
        # User agent real de Chrome no Windows
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        
        self.context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            accept_downloads=True,
            storage_state=storage_state if storage_state and Path(storage_state).exists() else None,
            user_agent=user_agent,
            locale='pt-PT',
            timezone_id='Europe/Lisbon'
        )
        
        # Remover sinais de automação
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            Object.defineProperty(navigator, 'languages', {get: () => ['pt-PT', 'pt', 'en']});
        """)
        
        self.page = await self.context.new_page()
        self.cookies_file = cookies_file
        logger.info("✅ Browser Uber iniciado (com anti-detecção)")
    
    async def guardar_sessao(self):
        """Guardar cookies e storage state para reutilizar"""
        try:
            await self.context.storage_state(path=str(self.cookies_file))
            logger.info(f"💾 Sessão guardada: {self.cookies_file}")
            return True
        except Exception as e:
            logger.error(f"❌ Erro ao guardar sessão: {e}")
            return False
        
    async def fechar_browser(self, guardar: bool = True):
        """Fechar browser, opcionalmente guardando a sessão"""
        if guardar and hasattr(self, 'context'):
            await self.guardar_sessao()
        if self.browser:
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()
        logger.info("🔒 Browser Uber fechado")
    
    async def _inserir_codigo_sms(self):
        """Método auxiliar para inserir código SMS"""
        if not self.sms_code:
            logger.warning("⚠️ Código SMS não fornecido")
            return False
        
        # Procurar campos de input para código (podem ser 4 campos separados ou 1)
        inputs = await self.page.locator('input[type="text"], input[type="tel"], input[type="number"]').all()
        
        if len(inputs) >= 4:
            # 4 campos separados - inserir um dígito em cada
            for i, digit in enumerate(self.sms_code[:4]):
                if i < len(inputs):
                    await inputs[i].fill(digit)
                    await self.page.wait_for_timeout(100)
            logger.info(f"✅ Código SMS inserido (4 campos): {self.sms_code}")
        elif len(inputs) > 0:
            # Campo único
            await inputs[0].fill(self.sms_code)
            logger.info(f"✅ Código SMS inserido: {self.sms_code}")
        
        await self.screenshot("sms_preenchido")
        
        # Clicar botão seguinte/verificar
        seguinte_btn = self.page.locator('button:has-text("Seguinte"), button:has-text("Verificar"), button:has-text("Next"), button[type="submit"]').first
        if await seguinte_btn.count() > 0:
            await seguinte_btn.click()
            await self.page.wait_for_timeout(5000)
            logger.info("✅ Clicou Seguinte após SMS")
        
        return True

    async def screenshot(self, name: str):
        """Tirar screenshot para debug"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filepath = f"/tmp/uber_{name}_{timestamp}.png"
        await self.page.screenshot(path=filepath)
        logger.info(f"📸 Screenshot: {filepath}")
        return filepath
    
    async def fazer_login(self) -> bool:
        """
        Fazer login no portal Uber Fleet.
        
        Processo:
        1. Ir para página de login
        2. Inserir email
        3. Clicar "Continuar"
        4. Selecionar "Enviar códigos por SMS" ou "Mais opções"
        5. Inserir código SMS (se fornecido)
        6. Inserir password (se necessário)
        7. Clicar "Seguinte"
        """
        try:
            logger.info(f"🔐 A fazer login Uber: {self.email}")
            
            # Navegar para o portal Uber Fleet - usar domcontentloaded em vez de networkidle
            await self.page.goto("https://fleet.uber.com/", wait_until="domcontentloaded", timeout=90000)
            await self.page.wait_for_timeout(5000)
            
            await self.screenshot("pagina_inicial")
            
            # Verificar se já estamos logados
            if "fleet.uber.com" in self.page.url and "/login" not in self.page.url:
                # Verificar se há elementos do dashboard
                dashboard = self.page.locator('text=/Página inicial|Home|Dashboard/')
                if await dashboard.count() > 0:
                    logger.info("✅ Já estava logado!")
                    return True
            
            # Aguardar campo de email
            email_input = self.page.locator('input[type="text"], input[type="email"], input[name="email"]').first
            await email_input.wait_for(timeout=30000)
            
            # Preencher email
            await email_input.fill(self.email)
            await self.page.wait_for_timeout(500)
            logger.info(f"✅ Email inserido: {self.email}")
            
            await self.screenshot("email_preenchido")
            
            # Clicar em Continuar
            continuar_btn = self.page.locator('button:has-text("Continuar"), button:has-text("Continue")').first
            if await continuar_btn.count() > 0:
                await continuar_btn.click()
                await self.page.wait_for_timeout(3000)
                logger.info("✅ Clicou Continuar")
            
            await self.screenshot("apos_continuar")
            
            # Aguardar um pouco para elementos carregarem
            await self.page.wait_for_timeout(2000)
            
            # VERIFICAR SE HÁ CAPTCHA/PUZZLE - Uber usa "Protecting your account" ou "Proteger a sua conta"
            captcha_detectado = False
            
            # Verificar se há texto de proteção de conta (PT e EN) - verificar texto visível
            page_text = await self.page.content()
            
            if "Proteger a sua conta" in page_text or "Protecting your account" in page_text or "Iniciar desafio" in page_text:
                captcha_detectado = True
                logger.info("🧩 CAPTCHA/desafio de segurança detectado pelo conteúdo da página!")
                await self.screenshot("captcha_detectado")
            
            # Verificar também por locators
            protecting_text = self.page.locator('text=/Protecting your account|Proteger a sua conta|Resolva este desafio/')
            puzzle_btn = self.page.locator('button:has-text("Start Puzzle"), button:has-text("Iniciar desafio"), button:has-text("Iniciar Puzzle")')
            
            if not captcha_detectado and (await protecting_text.count() > 0 or await puzzle_btn.count() > 0):
                captcha_detectado = True
                logger.info("🧩 CAPTCHA/desafio de segurança detectado!")
                await self.screenshot("captcha_detectado")
                
                # Tentar clicar no botão Iniciar desafio
                if await puzzle_btn.count() > 0:
                    logger.info("🧩 A clicar em Iniciar desafio...")
                    await puzzle_btn.first.click()
                    await self.page.wait_for_timeout(8000)
                    await self.screenshot("puzzle_iniciado")
                    
                    # Tentar resolver o puzzle
                    for attempt in range(10):
                        try:
                            # Verificar se ainda está no puzzle
                            still_puzzle = self.page.locator('text=/Protecting your account|Proteger a sua conta/')
                            if await still_puzzle.count() == 0:
                                logger.info("✅ Desafio parece ter sido resolvido!")
                                captcha_detectado = False
                                break
                            
                            # Procurar iframes de puzzle (Arkose Labs usa iframes)
                            frames = self.page.frames
                            for frame in frames[1:]:  # Skip main frame
                                try:
                                    # Verificar se é um iframe de verificação
                                    frame_url = frame.url
                                    if 'arkoselabs' in frame_url or 'funcaptcha' in frame_url or 'client-api' in frame_url:
                                        logger.info(f"🧩 Iframe de puzzle encontrado: {frame_url[:50]}...")
                                        
                                        # Tentar clicar em elementos do puzzle
                                        clickables = frame.locator('div[role="button"], button, img, canvas, [data-theme]')
                                        count = await clickables.count()
                                        if count > 0:
                                            # Clicar no centro do primeiro elemento
                                            await clickables.first.click()
                                            logger.info(f"🧩 Tentativa {attempt+1}: Clicou em elemento do puzzle")
                                            await self.page.wait_for_timeout(2000)
                                except Exception as fe:
                                    logger.debug(f"Frame error: {fe}")
                            
                            await self.page.wait_for_timeout(3000)
                            await self.screenshot(f"puzzle_tentativa_{attempt+1}")
                            
                        except Exception as e:
                            logger.warning(f"⚠️ Tentativa puzzle {attempt+1}: {e}")
                    
                    await self.screenshot("apos_puzzle")
                
                if captcha_detectado:
                    logger.warning("⚠️ CAPTCHA não foi possível resolver automaticamente")
                    logger.warning("💡 O desafio de segurança da Uber requer intervenção manual")
                    logger.warning("💡 Sugestão: Fazer login manual no browser, depois guardar sessão")
                    return False  # Retornar falso se CAPTCHA não resolvido
            
            # VERIFICAR SE PEDE SMS OU PODEMOS USAR PASSWORD
            await self.screenshot("apos_sms_ou_opcoes")
            
            # Verificar se estamos na página de SMS (4 dígitos)
            page_text = await self.page.content()
            
            # Se estamos na página de código SMS
            if "código de 4 dígitos" in page_text or "4-digit code" in page_text or "4 dígitos" in page_text:
                logger.info("📱 Página de código SMS detectada")
                
                # Primeiro, tentar "Mais opções" para usar palavra-passe em vez de SMS
                mais_opcoes_btn = self.page.locator('button:has-text("Mais opções"), text=Mais opções').first
                
                if await mais_opcoes_btn.count() > 0 and await mais_opcoes_btn.is_visible():
                    logger.info("🔧 A tentar usar Palavra-passe em vez de SMS...")
                    await mais_opcoes_btn.click()
                    await self.page.wait_for_timeout(2000)
                    await self.screenshot("mais_opcoes_aberto")
                    
                    # Clicar em "Palavra-passe"
                    password_option = self.page.locator('text=Palavra-passe').first
                    if await password_option.count() > 0:
                        await password_option.click()
                        await self.page.wait_for_timeout(2000)
                        logger.info("✅ Selecionou opção Palavra-passe")
                        await self.screenshot("opcao_password_selecionada")
                        
                        # Inserir password
                        password_input = self.page.locator('input[type="password"]').first
                        if await password_input.count() > 0 and await password_input.is_visible():
                            await password_input.fill(self.password)
                            logger.info("✅ Password inserida")
                            await self.screenshot("password_preenchida")
                            
                            # Clicar Seguinte
                            seguinte_btn = self.page.locator('button:has-text("Seguinte"), button:has-text("Next"), button[type="submit"]').first
                            if await seguinte_btn.count() > 0:
                                await seguinte_btn.click()
                                await self.page.wait_for_timeout(5000)
                                logger.info("✅ Clicou Seguinte após password")
                                await self.screenshot("apos_password_submit")
                        else:
                            logger.warning("⚠️ Campo de password não encontrado após selecionar opção")
                    else:
                        logger.warning("⚠️ Opção Palavra-passe não encontrada no menu")
                        # Se não há opção password, tentar usar código SMS
                        if self.sms_code:
                            await self._inserir_codigo_sms()
                
                elif self.sms_code:
                    # Não tem opção "Mais opções", usar SMS diretamente
                    await self._inserir_codigo_sms()
                else:
                    logger.warning("⚠️ Precisa de código SMS ou opção de password")
            
            # Verificar se estamos na página de password diretamente
            elif "Palavra-passe" in page_text or "Password" in page_text:
                password_input = self.page.locator('input[type="password"]').first
                if await password_input.count() > 0 and await password_input.is_visible():
                    await password_input.fill(self.password)
                    logger.info("✅ Password inserida diretamente")
                    await self.screenshot("password_direta")
                    
                    seguinte_btn = self.page.locator('button:has-text("Seguinte"), button:has-text("Next"), button[type="submit"]').first
                    if await seguinte_btn.count() > 0:
                        await seguinte_btn.click()
                        await self.page.wait_for_timeout(5000)
                        logger.info("✅ Clicou Seguinte")
            else:
                # Clicar em "Mais opções" se disponível
                mais_opcoes = self.page.locator('text=/Mais opções|More options/').first
                if await mais_opcoes.count() > 0 and await mais_opcoes.is_visible():
                    await mais_opcoes.click()
                    await self.page.wait_for_timeout(2000)
                    logger.info("✅ Clicou Mais opções")
            
            await self.screenshot("apos_sms_ou_opcoes")
            
            # VERIFICAR SE PEDE PIN/CÓDIGO DE ACESSO ADICIONAL
            pin_input = self.page.locator('input[placeholder*="PIN"], input[placeholder*="pin"], input[placeholder*="acesso"], input[type="password"][maxlength="4"], input[type="password"][maxlength="6"]').first
            if await pin_input.count() > 0 and await pin_input.is_visible():
                logger.info("🔢 Campo de PIN/código de acesso detectado")
                if self.pin_code:
                    await pin_input.fill(self.pin_code)
                    await self.page.wait_for_timeout(500)
                    logger.info(f"✅ PIN inserido")
                    await self.screenshot("pin_preenchido")
                    
                    # Clicar para continuar
                    continuar_btn = self.page.locator('button:has-text("Continuar"), button:has-text("Continue"), button:has-text("Verificar"), button[type="submit"]').first
                    if await continuar_btn.count() > 0:
                        await continuar_btn.click()
                        await self.page.wait_for_timeout(5000)
                elif self.password:
                    # Tentar usar a password como PIN
                    await pin_input.fill(self.password)
                    await self.page.wait_for_timeout(500)
                    logger.info("✅ Tentou usar password como PIN")
            
            # Procurar campo de password normal
            password_input = self.page.locator('input[type="password"]').first
            
            if await password_input.count() > 0 and await password_input.is_visible():
                await password_input.fill(self.password)
                await self.page.wait_for_timeout(500)
                logger.info("✅ Password inserida")
                
                await self.screenshot("password_preenchida")
                
                # Clicar em Seguinte/Next
                seguinte_btn = self.page.locator('button:has-text("Seguinte"), button:has-text("Next"), button[type="submit"]').first
                if await seguinte_btn.count() > 0:
                    await seguinte_btn.click()
                    await self.page.wait_for_timeout(5000)
                    logger.info("✅ Clicou Seguinte")
            
            # Verificar se aparece "Tudo pronto" ou similar
            tudo_pronto = self.page.locator('text=/Tudo pronto|All set|Concluído/')
            if await tudo_pronto.count() > 0:
                continuar_final = self.page.locator('button:has-text("Continuar"), button:has-text("Continue")').first
                if await continuar_final.count() > 0:
                    await continuar_final.click()
                    await self.page.wait_for_timeout(3000)
            
            await self.screenshot("apos_login")
            
            # Verificar se login foi bem sucedido
            await self.page.wait_for_timeout(5000)
            
            # Verificar se estamos no dashboard
            if "fleet.uber.com" in self.page.url and "/login" not in self.page.url:
                logger.info("✅ Login Uber bem sucedido!")
                return True
            
            # Verificar se há elementos do dashboard
            rendimentos_link = self.page.locator('text=/Rendimentos|Earnings/')
            if await rendimentos_link.count() > 0:
                logger.info("✅ Login Uber bem sucedido!")
                return True
            
            logger.warning("⚠️ Não foi possível confirmar login")
            return False
            
        except Exception as e:
            logger.error(f"❌ Erro no login Uber: {e}")
            await self.screenshot("erro_login")
            return False
    
    async def ir_para_rendimentos(self) -> bool:
        """Navegar para a secção de Rendimentos"""
        try:
            logger.info("📑 A navegar para Rendimentos...")
            
            # Primeiro, verificar qual domínio estamos (supplier.uber.com ou fleet.uber.com)
            current_url = self.page.url
            logger.info(f"📍 URL atual: {current_url}")
            
            # Extrair org_id se estivermos no supplier.uber.com
            org_id = None
            if 'supplier.uber.com' in current_url and '/orgs/' in current_url:
                org_id = current_url.split('/orgs/')[1].split('/')[0]
                logger.info(f"📍 Org ID: {org_id}")
            
            # Tentar navegar para Rendimentos/Earnings usando múltiplas estratégias
            navigated = False
            
            # Estratégia 1: Clicar no menu
            menu_selectors = [
                'a:has-text("Rendimentos")',
                'a:has-text("Earnings")',
                '[href*="earnings"]',
                '[href*="payments"]',
                'nav a:has-text("Rendimentos")',
                '[data-testid*="earnings"]',
            ]
            
            for selector in menu_selectors:
                try:
                    link = self.page.locator(selector).first
                    if await link.count() > 0 and await link.is_visible(timeout=2000):
                        await link.click()
                        await self.page.wait_for_timeout(3000)
                        logger.info(f"✅ Navegou via menu: {selector}")
                        navigated = True
                        break
                except:
                    continue
            
            # Estratégia 2: URL direta baseada no domínio
            if not navigated:
                if org_id and 'supplier.uber.com' in current_url:
                    # Nova interface supplier.uber.com
                    earnings_url = f"https://supplier.uber.com/orgs/{org_id}/earnings"
                    logger.info(f"📑 A tentar URL: {earnings_url}")
                    await self.page.goto(earnings_url, wait_until="domcontentloaded", timeout=60000)
                    navigated = True
                elif 'fleet.uber.com' in current_url:
                    # Interface fleet.uber.com
                    await self.page.goto("https://fleet.uber.com/p3/earnings", wait_until="domcontentloaded", timeout=60000)
                    navigated = True
                else:
                    # Tentar supplier como fallback
                    await self.page.goto("https://supplier.uber.com/", wait_until="domcontentloaded", timeout=60000)
                    await self.page.wait_for_timeout(3000)
                    
                    # Extrair org_id novamente
                    current_url = self.page.url
                    if '/orgs/' in current_url:
                        org_id = current_url.split('/orgs/')[1].split('/')[0]
                        earnings_url = f"https://supplier.uber.com/orgs/{org_id}/earnings"
                        await self.page.goto(earnings_url, wait_until="domcontentloaded", timeout=60000)
                        navigated = True
            
            await self.page.wait_for_timeout(3000)
            await self.screenshot("pagina_rendimentos")
            
            # Verificar se estamos na página de rendimentos
            new_url = self.page.url
            logger.info(f"📍 Nova URL: {new_url}")
            
            if 'earnings' in new_url.lower() or 'payments' in new_url.lower():
                logger.info("✅ Confirmado na página de Rendimentos")
                return True
            else:
                logger.warning(f"⚠️ Pode não estar na página de rendimentos: {new_url}")
                return True  # Continuar mesmo assim
            
        except Exception as e:
            logger.error(f"❌ Erro ao navegar para Rendimentos: {e}")
            await self.screenshot("erro_navegar_rendimentos")
            return False
    
    async def selecionar_periodo(self, data_inicio: str, data_fim: str) -> bool:
        """
        Selecionar período de datas para os rendimentos.
        
        Args:
            data_inicio: Data início no formato YYYY-MM-DD
            data_fim: Data fim no formato YYYY-MM-DD
        """
        try:
            logger.info(f"📅 A selecionar período: {data_inicio} a {data_fim}")
            
            # Procurar dropdown de intervalo de pagamento
            intervalo_dropdown = self.page.locator('text=/Intervalo de pagamento|Payment interval/').first
            
            if await intervalo_dropdown.count() > 0:
                await intervalo_dropdown.click()
                await self.page.wait_for_timeout(1000)
                logger.info("✅ Dropdown de intervalo aberto")
                
                await self.screenshot("dropdown_intervalo")
                
                # Procurar opção "Intervalo personalizado"
                personalizado = self.page.locator('text=/Intervalo personalizado|Custom interval/').first
                if await personalizado.count() > 0:
                    await personalizado.click()
                    await self.page.wait_for_timeout(1000)
                    logger.info("✅ Selecionou intervalo personalizado")
                    
                    # Preencher datas
                    # Converter para formato DD/MM/YYYY
                    dt_inicio = datetime.strptime(data_inicio, "%Y-%m-%d")
                    dt_fim = datetime.strptime(data_fim, "%Y-%m-%d")
                    
                    # Procurar campos de data
                    date_inputs = self.page.locator('input[type="date"], input[placeholder*="data"], input[placeholder*="date"]')
                    input_count = await date_inputs.count()
                    
                    if input_count >= 2:
                        await date_inputs.nth(0).fill(data_inicio)
                        await date_inputs.nth(1).fill(data_fim)
                        logger.info("✅ Datas preenchidas")
                    
                    # Aplicar filtro
                    aplicar_btn = self.page.locator('button:has-text("Aplicar"), button:has-text("Apply")').first
                    if await aplicar_btn.count() > 0:
                        await aplicar_btn.click()
                        await self.page.wait_for_timeout(3000)
                else:
                    # Tentar selecionar período pré-definido mais próximo
                    logger.info("📋 A procurar período pré-definido...")
            
            await self.screenshot("periodo_selecionado")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao selecionar período: {e}")
            return False
    
    async def extrair_dados_tabela(self) -> List[Dict[str, Any]]:
        """
        Extrair dados da tabela de rendimentos dos motoristas.
        
        NOVA ESTRATÉGIA: Clicar em cada motorista para abrir o painel de detalhes
        e extrair Tarifa, Gratificação, Reembolsos (portagens), etc.
        
        Estrutura do painel de detalhes (baseado no screenshot):
        - Rendimentos totais: X €
          - Tarifa: Y € (ganhos base - este é o "Uber" para comissões)
          - Gratificação: Z € (uGrat - gorjetas)
        - Reembolsos e despesas: W € (uPort - portagens)
        - Ajustes de períodos anteriores: A €
        - Rendimentos líquidos: Total €
        """
        try:
            logger.info("📊 A extrair dados da tabela com detalhes...")
            
            dados = []
            
            # Aguardar página carregar completamente
            await self.page.wait_for_timeout(5000)
            
            # Tirar screenshot para debug
            await self.screenshot("antes_extrair_tabela")
            
            # Tentar múltiplos seletores para encontrar a tabela/lista de motoristas
            tabela = None
            linhas = None
            
            # Estratégia 1: Tabela HTML tradicional
            tabela_html = self.page.locator('table, [role="table"]').first
            if await tabela_html.count() > 0:
                logger.info("📋 Encontrada tabela HTML")
                tabela = tabela_html
                linhas = tabela.locator('tbody tr, tr:not(:first-child)')
            
            # Estratégia 2: Lista de cards/items (comum em interfaces modernas)
            if linhas is None or await linhas.count() == 0:
                logger.info("📋 A tentar encontrar lista de motoristas...")
                
                # Procurar por elementos que parecem linhas de motoristas
                possible_selectors = [
                    '[data-testid*="driver"]',
                    '[data-testid*="row"]',
                    'div[role="row"]',
                    'div[class*="row"]',
                    'div[class*="list-item"]',
                    'div[class*="driver"]',
                    'div[class*="card"]',
                    # Uber Fleet específicos
                    '[class*="TableRow"]',
                    '[class*="ListRow"]',
                    'a[href*="/drivers/"]',
                    'div[class*="css-"][class*="e1"]',  # Styled components da Uber
                ]
                
                for selector in possible_selectors:
                    try:
                        elements = self.page.locator(selector)
                        count = await elements.count()
                        if count > 0:
                            logger.info(f"📋 Encontrados {count} elementos via: {selector}")
                            linhas = elements
                            break
                    except:
                        continue
            
            # Estratégia 3: Procurar por elementos com texto que parecem nomes
            if linhas is None or await linhas.count() == 0:
                logger.info("📋 A procurar elementos clicáveis na página...")
                
                # Obter HTML da página para debug
                page_html = await self.page.content()
                if 'driver' in page_html.lower() or 'motorista' in page_html.lower():
                    logger.info("📋 Página contém referências a motoristas")
                
                # Procurar divs que podem ser linhas
                all_divs = self.page.locator('div')
                div_count = await all_divs.count()
                logger.info(f"📋 Total de divs na página: {div_count}")
            
            if linhas is None:
                logger.warning("⚠️ Não foi possível encontrar lista de motoristas")
                await self.screenshot("sem_tabela")
                return dados
            
            linha_count = await linhas.count()
            if linha_count == 0:
                logger.warning("⚠️ Tabela/lista encontrada mas sem linhas")
                return dados
                
            logger.info(f"📋 Encontradas {linha_count} linhas de motoristas")
            
            for i in range(linha_count):
                try:
                    linha = linhas.nth(i)
                    celulas = linha.locator('td, [role="cell"]')
                    celula_count = await celulas.count()
                    
                    if celula_count < 2:
                        continue
                    
                    # Extrair nome da primeira coluna
                    nome = await celulas.nth(0).inner_text()
                    nome = nome.strip()
                    
                    # Se segunda coluna também é texto (apelido), juntar
                    if celula_count > 1:
                        second_cell = await celulas.nth(1).inner_text()
                        second_cell = second_cell.strip()
                        if second_cell and not any(c.isdigit() for c in second_cell.replace(",", "").replace(".", "").replace("€", "").replace("-", "")):
                            nome = f"{nome} {second_cell}"
                    
                    if not nome or nome.strip() == "":
                        continue
                    
                    logger.info(f"👤 A processar motorista {i+1}/{linha_count}: {nome}")
                    
                    # Clicar na linha para abrir o painel de detalhes
                    await linha.click()
                    await self.page.wait_for_timeout(2000)
                    
                    # Extrair dados do painel de detalhes
                    detalhes = await self.extrair_detalhes_motorista()
                    
                    if detalhes:
                        detalhes["nome"] = nome
                        detalhes["id"] = str(uuid.uuid4())
                        dados.append(detalhes)
                        logger.info(f"✅ {nome}: Tarifa={detalhes.get('tarifa', 0):.2f}€, uGrat={detalhes.get('gratificacao', 0):.2f}€, uPort={detalhes.get('portagens', 0):.2f}€")
                    
                    # Fechar painel (clicar fora ou botão fechar)
                    await self.fechar_painel_detalhes()
                    await self.page.wait_for_timeout(500)
                    
                except Exception as e:
                    logger.warning(f"⚠️ Erro ao processar linha {i}: {e}")
                    continue
            
            logger.info(f"✅ Extraídos {len(dados)} registos de motoristas com detalhes")
            return dados
            
        except Exception as e:
            logger.error(f"❌ Erro ao extrair dados: {e}")
            return []
    
    async def extrair_detalhes_motorista(self) -> Optional[Dict[str, Any]]:
        """
        Extrair dados do painel de detalhes de um motorista.
        
        Baseado no screenshot da Uber, o painel mostra:
        - Rendimentos totais: X €
          - Tarifa: Y € (expandível com seta)
          - Gratificação: Z €
        - Reembolsos e despesas: W €
        - Ajustes de períodos anteriores: A €
        - Pagamento: P €
        - Rendimentos líquidos: Total €
        - Viagens: N
        - Distância: D km
        """
        try:
            detalhes = {
                "rendimentos_totais": 0.0,
                "tarifa": 0.0,  # Ganhos base (Uber para comissões)
                "gratificacao": 0.0,  # uGrat
                "portagens": 0.0,  # uPort (Reembolsos e despesas)
                "ajustes": 0.0,
                "pagamento": 0.0,
                "rendimentos_liquidos": 0.0,
                "viagens": 0,
                "distancia_km": 0.0
            }
            
            # Aguardar painel aparecer
            await self.page.wait_for_timeout(1500)
            
            # Helper para extrair valor numérico de texto
            def parse_valor(texto: str) -> float:
                if not texto:
                    return 0.0
                # Remover símbolos e converter
                clean = texto.replace("€", "").replace("$", "").replace(",", ".").replace(" ", "").replace("\xa0", "").replace("km", "").strip()
                # Lidar com negativos
                if clean.startswith("--"):
                    clean = clean[1:]
                try:
                    return float(clean) if clean and clean not in ["-", ""] else 0.0
                except Exception:
                    return 0.0
            
            # Estratégia 1: Procurar por textos específicos no painel
            painel = self.page.locator('[role="dialog"], .modal, .drawer, .panel, .sidebar, [class*="detail"], [class*="modal"]').first
            
            # Se não encontrar painel específico, usar página inteira
            if await painel.count() == 0:
                painel = self.page
            
            # Extrair "Rendimentos totais"
            rendimentos_el = painel.locator('text=/Rendimentos totais/i').first
            if await rendimentos_el.count() > 0:
                parent = rendimentos_el.locator('xpath=..')
                valor_el = parent.locator('text=/\\d+[,.]\\d+\\s*€/').first
                if await valor_el.count() > 0:
                    detalhes["rendimentos_totais"] = parse_valor(await valor_el.inner_text())
            
            # Extrair "Tarifa" (ganhos base)
            tarifa_el = painel.locator('text=/^Tarifa$/i').first
            if await tarifa_el.count() > 0:
                parent = tarifa_el.locator('xpath=..')
                valor_el = parent.locator('text=/\\d+[,.]\\d+\\s*€/').first
                if await valor_el.count() > 0:
                    detalhes["tarifa"] = parse_valor(await valor_el.inner_text())
            
            # Extrair "Gratificação" (uGrat)
            grat_el = painel.locator('text=/Gratificação/i').first
            if await grat_el.count() > 0:
                parent = grat_el.locator('xpath=..')
                valor_el = parent.locator('text=/\\d+[,.]\\d+\\s*€/').first
                if await valor_el.count() > 0:
                    detalhes["gratificacao"] = parse_valor(await valor_el.inner_text())
            
            # Extrair "Reembolsos e despesas" (uPort - portagens)
            reemb_el = painel.locator('text=/Reembolsos e despesas|Reembolsos/i').first
            if await reemb_el.count() > 0:
                parent = reemb_el.locator('xpath=..')
                valor_el = parent.locator('text=/\\d+[,.]\\d+\\s*€/').first
                if await valor_el.count() > 0:
                    detalhes["portagens"] = parse_valor(await valor_el.inner_text())
            
            # Extrair "Ajustes de períodos anteriores"
            ajustes_el = painel.locator('text=/Ajustes de períodos anteriores|Ajustes/i').first
            if await ajustes_el.count() > 0:
                parent = ajustes_el.locator('xpath=..')
                valor_el = parent.locator('text=/\\d+[,.]\\d+\\s*€/').first
                if await valor_el.count() > 0:
                    detalhes["ajustes"] = parse_valor(await valor_el.inner_text())
            
            # Extrair "Rendimentos líquidos" (total final)
            liq_el = painel.locator('text=/Rendimentos líquidos/i').first
            if await liq_el.count() > 0:
                parent = liq_el.locator('xpath=..')
                valor_el = parent.locator('text=/\\d+[,.]\\d+\\s*€/').first
                if await valor_el.count() > 0:
                    detalhes["rendimentos_liquidos"] = parse_valor(await valor_el.inner_text())
            
            # Extrair "Viagens"
            viagens_el = painel.locator('text=/Viagens/i').first
            if await viagens_el.count() > 0:
                parent = viagens_el.locator('xpath=..')
                valor_el = parent.locator('text=/\\d+/').first
                if await valor_el.count() > 0:
                    try:
                        detalhes["viagens"] = int(parse_valor(await valor_el.inner_text()))
                    except Exception:
                        pass
            
            # Extrair "Distância"
            dist_el = painel.locator('text=/Distância/i').first
            if await dist_el.count() > 0:
                parent = dist_el.locator('xpath=..')
                valor_el = parent.locator('text=/\\d+[,.]\\d+/').first
                if await valor_el.count() > 0:
                    detalhes["distancia_km"] = parse_valor(await valor_el.inner_text())
            
            # Estratégia 2 (fallback): Extrair todos os valores numéricos e tentar mapear
            if detalhes["tarifa"] == 0 and detalhes["rendimentos_liquidos"] == 0:
                logger.info("📋 A usar estratégia alternativa de extração...")
                
                # Procurar todos os elementos com valores monetários
                valores = await painel.locator('text=/\\d+[,.]\\d+\\s*€/').all_inner_texts()
                
                if valores:
                    logger.info(f"📋 Valores encontrados: {valores}")
                    # Tentar mapear baseado na ordem típica
                    valores_num = [parse_valor(v) for v in valores]
                    
                    if len(valores_num) >= 5:
                        # Ordem típica: Rendimentos totais, Tarifa, Gratificação, Reembolsos, Rendimentos líquidos
                        detalhes["rendimentos_totais"] = valores_num[0]
                        detalhes["tarifa"] = valores_num[1]
                        detalhes["gratificacao"] = valores_num[2]
                        detalhes["portagens"] = valores_num[3] if len(valores_num) > 3 else 0
                        detalhes["rendimentos_liquidos"] = valores_num[-1]
            
            # Calcular pago_total (para compatibilidade)
            detalhes["pago_total"] = detalhes["rendimentos_liquidos"]
            
            # Validar que extraímos algo útil
            if detalhes["tarifa"] > 0 or detalhes["rendimentos_liquidos"] > 0:
                return detalhes
            
            return None
            
        except Exception as e:
            logger.warning(f"⚠️ Erro ao extrair detalhes: {e}")
            return None
    
    async def fechar_painel_detalhes(self):
        """Fechar o painel de detalhes do motorista"""
        try:
            # Tentar botão de fechar
            close_btn = self.page.locator('button[aria-label="Close"], button[aria-label="Fechar"], [class*="close"], button:has-text("×"), button:has-text("X")').first
            if await close_btn.count() > 0 and await close_btn.is_visible():
                await close_btn.click()
                return
            
            # Clicar fora do painel (overlay)
            overlay = self.page.locator('[class*="overlay"], [class*="backdrop"]').first
            if await overlay.count() > 0 and await overlay.is_visible():
                await overlay.click()
                return
            
            # Pressionar Escape
            await self.page.keyboard.press("Escape")
            
        except Exception as e:
            logger.warning(f"⚠️ Erro ao fechar painel: {e}")
            # Tentar Escape como último recurso
            try:
                await self.page.keyboard.press("Escape")
            except Exception:
                pass
    
    async def fazer_download_relatorio(self) -> Optional[str]:
        """
        Fazer download do relatório de rendimentos.
        
        Tenta usar o botão "Fazer o download do relatório" na página de Rendimentos.
        """
        try:
            logger.info("📥 A fazer download do relatório...")
            
            # Procurar botão de download
            download_btn = self.page.locator('button:has-text("Fazer o download"), button:has-text("Download"), a:has-text("download")').first
            
            if await download_btn.count() > 0 and await download_btn.is_visible():
                logger.info("✅ Botão de download encontrado")
                
                # Tentar download
                try:
                    async with self.page.expect_download(timeout=30000) as download_info:
                        await download_btn.click()
                    
                    download = await download_info.value
                    
                    # Guardar ficheiro
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    original_name = download.suggested_filename or f"uber_rendimentos_{timestamp}.csv"
                    filepath = self.downloads_path / original_name
                    
                    await download.save_as(str(filepath))
                    
                    logger.info(f"🎉 Relatório Uber descarregado: {filepath}")
                    return str(filepath)
                    
                except Exception as e:
                    logger.warning(f"⚠️ Download direto falhou: {e}")
            
            # Alternativa: Ir para secção Relatórios e gerar
            logger.info("📋 A tentar via secção Relatórios...")
            
            relatorios_link = self.page.locator('a:has-text("Relatórios"), a:has-text("Reports")').first
            if await relatorios_link.count() > 0:
                await relatorios_link.click()
                await self.page.wait_for_timeout(3000)
                
                # Gerar relatório
                gerar_btn = self.page.locator('button:has-text("Gerar relatório"), button:has-text("Generate report")').first
                if await gerar_btn.count() > 0:
                    await gerar_btn.click()
                    await self.page.wait_for_timeout(2000)
                    
                    await self.screenshot("modal_gerar_relatorio")
                    
                    # Selecionar tipo de relatório "Pagamentos de motorista"
                    tipo_dropdown = self.page.locator('text=/Tipo de relatório|Report type/').first
                    if await tipo_dropdown.count() > 0:
                        await tipo_dropdown.click()
                        await self.page.wait_for_timeout(500)
                        
                        pagamentos_option = self.page.locator('text=/Pagamentos de motorista|Driver payments/').first
                        if await pagamentos_option.count() > 0:
                            await pagamentos_option.click()
                    
                    # Clicar Gerar
                    gerar_final = self.page.locator('button:has-text("Gerar"), button:has-text("Generate")').first
                    if await gerar_final.count() > 0:
                        await gerar_final.click()
                        await self.page.wait_for_timeout(5000)
                        
                        logger.info("✅ Relatório a ser gerado...")
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Erro ao fazer download: {e}")
            return None

    def _formatar_data_pt(self, data_str: str) -> str:
        """
        Converte data YYYY-MM-DD para formato PT usado pela Uber (ex: "26 de janeiro")
        """
        meses_pt = {
            1: "janeiro", 2: "fevereiro", 3: "março", 4: "abril",
            5: "maio", 6: "junho", 7: "julho", 8: "agosto",
            9: "setembro", 10: "outubro", 11: "novembro", 12: "dezembro"
        }
        try:
            dt = datetime.strptime(data_str, "%Y-%m-%d")
            return f"{dt.day} de {meses_pt[dt.month]}"
        except:
            return data_str
    
    def _verificar_intervalo_corresponde(self, texto_linha: str, data_inicio: str, data_fim: str) -> bool:
        """
        Verifica se o texto da linha contém o intervalo de datas correcto.
        
        A Uber mostra intervalos no formato:
        - "26 de janeiro - 2 de fevereiro"
        - "20250126-20250202" (no nome do ficheiro)
        """
        # Formato 1: Datas no formato YYYYMMDD-YYYYMMDD (nome do ficheiro)
        dt_inicio = datetime.strptime(data_inicio, "%Y-%m-%d")
        dt_fim = datetime.strptime(data_fim, "%Y-%m-%d")
        data_pattern = f"{dt_inicio.strftime('%Y%m%d')}-{dt_fim.strftime('%Y%m%d')}"
        
        if data_pattern in texto_linha:
            return True
        
        # Formato 2: Datas em português (coluna Intervalo)
        # Ex: "26 de janeiro - 2 de fevereiro"
        data_inicio_pt = self._formatar_data_pt(data_inicio)
        data_fim_pt = self._formatar_data_pt(data_fim)
        
        # Verificar se ambas as datas estão na linha
        texto_lower = texto_linha.lower()
        if data_inicio_pt.lower() in texto_lower and data_fim_pt.lower() in texto_lower:
            return True
        
        # Formato 3: Verificar apenas dia/mês (sem ano) - para casos onde o ano não aparece
        dia_inicio = dt_inicio.day
        dia_fim = dt_fim.day
        
        # Procurar padrão "DD de mês - DD de mês"
        import re
        pattern = rf"{dia_inicio}\s*de\s*\w+\s*-\s*{dia_fim}\s*de\s*\w+"
        if re.search(pattern, texto_lower):
            # Verificar se os meses também correspondem
            meses_pt = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
                       "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
            mes_inicio = meses_pt[dt_inicio.month - 1]
            mes_fim = meses_pt[dt_fim.month - 1]
            if mes_inicio in texto_lower and mes_fim in texto_lower:
                return True
        
        return False

    async def gerar_e_download_csv(self, data_inicio: str, data_fim: str, org_id: str = None) -> Optional[str]:
        """
        Faz download do relatório CSV de pagamentos de motorista DA SEMANA ESPECÍFICA.
        
        CORRIGIDO: Agora identifica correctamente o relatório pela semana, comparando
        o intervalo de datas mostrado na tabela com as datas pretendidas.
        
        Baseado no fluxo observado nas screenshots do utilizador:
        1. Navegar para a página de Relatórios
        2. Identificar a linha da tabela com o intervalo de datas correcto
        3. Clicar em "Faça o download" apenas nessa linha específica
        
        Args:
            data_inicio: Data início no formato YYYY-MM-DD
            data_fim: Data fim no formato YYYY-MM-DD
            org_id: ID da organização (extraído automaticamente se não fornecido)
            
        Returns:
            Caminho do ficheiro CSV descarregado ou None se falhar
        """
        try:
            logger.info(f"📊 A procurar relatório CSV para {data_inicio} a {data_fim}...")
            
            # Extrair org_id da URL atual se não fornecido
            if not org_id:
                current_url = self.page.url
                if '/orgs/' in current_url:
                    org_id = current_url.split('/orgs/')[1].split('/')[0]
                elif '/org/' in current_url:
                    org_id = current_url.split('/org/')[1].split('/')[0]
                    
            if not org_id:
                logger.error("❌ Não foi possível determinar o org_id")
                return None
                
            logger.info(f"📍 Org ID: {org_id}")
            
            # ESTRATÉGIA 1: Usar o botão de download direto na página de Rendimentos
            # Primeiro navegar para a página de Rendimentos
            earnings_url = f"https://supplier.uber.com/orgs/{org_id}/earnings"
            logger.info(f"📑 A navegar para Rendimentos: {earnings_url}")
            
            await self.page.goto(earnings_url, wait_until="domcontentloaded", timeout=60000)
            await self.page.wait_for_timeout(5000)
            await self.screenshot("pagina_rendimentos_csv")
            
            # Procurar o botão "Fazer o download do relatório" na página de Rendimentos
            download_btn_page = self.page.locator(
                'text=Fazer o download do relatório, '
                'text=Download do relatório, '
                'button:has-text("download"), '
                'a:has-text("download relatório")'
            ).first
            
            if await download_btn_page.count() > 0 and await download_btn_page.is_visible(timeout=5000):
                logger.info("✅ Encontrado botão de download na página de Rendimentos")
                await download_btn_page.click()
                await self.page.wait_for_timeout(3000)
                await self.screenshot("apos_clicar_download_rendimentos")
                
                # Verificar se abriu modal ou se foi direto para download
                # Se abrir modal, selecionar período e confirmar
                modal = self.page.locator('[role="dialog"], .modal, [class*="modal"]').first
                if await modal.count() > 0:
                    logger.info("📋 Modal de download aberto")
                    
                    # Selecionar datas se houver campos
                    start_input = modal.locator('input[type="date"]').first
                    end_input = modal.locator('input[type="date"]').last
                    
                    if await start_input.count() > 0:
                        await start_input.fill(data_inicio)
                    if await end_input.count() > 0:
                        await end_input.fill(data_fim)
                    
                    # Clicar botão de confirmar download
                    confirm_btn = modal.locator('button:has-text("Download"), button:has-text("Exportar"), button[type="submit"]').first
                    if await confirm_btn.count() > 0:
                        try:
                            async with self.page.expect_download(timeout=60000) as download_info:
                                await confirm_btn.click()
                            
                            download = await download_info.value
                            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                            original_name = download.suggested_filename or f"uber_pagamentos_{timestamp}.csv"
                            filepath = self.downloads_path / original_name
                            await download.save_as(str(filepath))
                            
                            logger.info(f"🎉 CSV descarregado via modal: {filepath}")
                            return str(filepath)
                        except Exception as e:
                            logger.warning(f"⚠️ Erro no download via modal: {e}")
            
            # ESTRATÉGIA PRINCIPAL: Navegar para a página de Relatórios e encontrar a semana correcta
            reports_url = f"https://supplier.uber.com/orgs/{org_id}/reports"
            logger.info(f"📑 A navegar para Relatórios: {reports_url}")
            
            await self.page.goto(reports_url, wait_until="domcontentloaded", timeout=60000)
            await self.page.wait_for_timeout(5000)
            await self.screenshot("pagina_relatorios")
            
            # Formatar datas para log
            dt_inicio = datetime.strptime(data_inicio, "%Y-%m-%d")
            dt_fim = datetime.strptime(data_fim, "%Y-%m-%d")
            data_pattern = f"{dt_inicio.strftime('%Y%m%d')}-{dt_fim.strftime('%Y%m%d')}"
            data_inicio_pt = self._formatar_data_pt(data_inicio)
            data_fim_pt = self._formatar_data_pt(data_fim)
            
            logger.info(f"🔍 A procurar relatório da semana: {data_inicio_pt} - {data_fim_pt}")
            logger.info(f"🔍 Padrão ficheiro: {data_pattern}")
            
            # Obter todas as linhas da tabela de relatórios
            # A tabela tem colunas: Nome, Tipo, Intervalo, Frequência, Criado em, Ações
            rows = self.page.locator('table tbody tr, [role="table"] [role="row"]:not(:first-child)')
            rows_count = await rows.count()
            logger.info(f"📋 Encontradas {rows_count} linhas na tabela de relatórios")
            
            # Iterar por todas as linhas para encontrar a que corresponde à semana
            relatorio_encontrado = False
            
            for i in range(rows_count):
                try:
                    row = rows.nth(i)
                    row_text = await row.inner_text()
                    
                    # Ignorar linhas vazias ou cabeçalhos
                    if not row_text.strip() or "Nome" in row_text and "Tipo" in row_text:
                        continue
                    
                    logger.info(f"📋 Linha {i}: {row_text[:120]}...")
                    
                    # Verificar se esta linha corresponde ao intervalo de datas pretendido
                    if self._verificar_intervalo_corresponde(row_text, data_inicio, data_fim):
                        logger.info(f"✅ ENCONTRADO! Relatório da semana {data_inicio_pt} - {data_fim_pt} na linha {i}")
                        relatorio_encontrado = True
                        
                        # Procurar botão/link de download nesta linha específica
                        # Usar selectores que excluem elementos SVG <title>
                        download_btn = None
                        
                        # Tentar vários selectores por ordem de preferência
                        selectors = [
                            'a:has-text("Faça o download")',
                            'button:has-text("Faça o download")',
                            'a:has-text("Download"):not(svg *)',
                            'button:has-text("Download"):not(svg *)',
                            'a[download]',
                            'a[href*=".csv"]',
                            'a[href*="download"]:not([href*="javascript"])',
                        ]
                        
                        for sel in selectors:
                            try:
                                btn = row.locator(sel).first
                                if await btn.count() > 0:
                                    # Verificar se é visível e não é um elemento SVG
                                    tag = await btn.evaluate('el => el.tagName.toLowerCase()')
                                    if tag not in ['title', 'svg', 'path', 'g']:
                                        download_btn = btn
                                        logger.info(f"✅ Botão encontrado via: {sel}")
                                        break
                            except:
                                continue
                        
                        if download_btn and await download_btn.count() > 0:
                            logger.info(f"✅ Botão 'Faça o download' encontrado - a descarregar...")
                            
                            try:
                                async with self.page.expect_download(timeout=60000) as download_info:
                                    await download_btn.click()
                                
                                download = await download_info.value
                                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                                original_name = download.suggested_filename or f"uber_pagamentos_{data_pattern}_{timestamp}.csv"
                                filepath = self.downloads_path / original_name
                                await download.save_as(str(filepath))
                                
                                logger.info(f"🎉 Relatório CSV da semana {data_inicio_pt} - {data_fim_pt} descarregado: {filepath}")
                                return str(filepath)
                                
                            except Exception as e:
                                logger.warning(f"⚠️ Erro no download: {e}")
                                # Continuar a tentar outras linhas caso haja erro
                                continue
                        else:
                            logger.warning(f"⚠️ Linha encontrada mas botão de download não disponível")
                            
                except Exception as e:
                    logger.warning(f"⚠️ Erro ao processar linha {i}: {e}")
                    continue
            
            if not relatorio_encontrado:
                logger.warning(f"⚠️ Relatório para a semana {data_inicio_pt} - {data_fim_pt} não encontrado na lista")
                await self.screenshot("relatorio_nao_encontrado")
            
            # ESTRATÉGIA FALLBACK: Se não encontrou o relatório da semana específica, gerar um novo
            logger.info("📋 Relatório da semana não encontrado na lista, a tentar gerar um novo...")
            await self.screenshot("a_gerar_novo_relatorio")
            
            # Procurar botão "Gerar relatório"
            gerar_btn = self.page.locator('button:has-text("Gerar relatório"), button:has-text("Generate report")').first
            
            if await gerar_btn.count() > 0 and await gerar_btn.is_visible():
                await gerar_btn.click()
                await self.page.wait_for_timeout(2000)
                await self.screenshot("modal_gerar_relatorio")
                
                # Preencher modal de geração
                # Tipo: Pagamentos de motorista
                tipo_option = self.page.locator('text=/Pagamentos de motorista|Driver payments/i').first
                if await tipo_option.count() > 0:
                    await tipo_option.click()
                    await self.page.wait_for_timeout(500)
                
                # Datas
                start_input = self.page.locator('input[type="date"]').first
                end_input = self.page.locator('input[type="date"]').last
                
                if await start_input.count() > 0:
                    await start_input.fill(data_inicio)
                if await end_input.count() > 0:
                    await end_input.fill(data_fim)
                
                # Clicar Gerar
                confirmar_btn = self.page.locator('button:has-text("Gerar"), button[type="submit"]').first
                if await confirmar_btn.count() > 0:
                    await confirmar_btn.click()
                    await self.page.wait_for_timeout(10000)  # Aguardar geração
                    await self.screenshot("relatorio_a_gerar")
                    
                    # Verificar se apareceu para download - recarregar e procurar novamente
                    await self.page.reload()
                    await self.page.wait_for_timeout(3000)
                    
                    # Procurar o relatório recém-gerado (deve ter as datas correctas)
                    rows = self.page.locator('table tbody tr, [role="table"] [role="row"]:not(:first-child)')
                    rows_count = await rows.count()
                    
                    for i in range(rows_count):
                        try:
                            row = rows.nth(i)
                            row_text = await row.inner_text()
                            
                            if self._verificar_intervalo_corresponde(row_text, data_inicio, data_fim):
                                download_btn = row.locator('text=/Faça o download|Download/i').first
                                if await download_btn.count() == 0:
                                    download_btn = row.locator('a[download], a[href*=".csv"]').first
                                
                                if await download_btn.count() > 0:
                                    try:
                                        async with self.page.expect_download(timeout=60000) as download_info:
                                            await download_btn.click()
                                        
                                        download = await download_info.value
                                        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                                        filepath = self.downloads_path / f"uber_pagamentos_{data_pattern}_{timestamp}.csv"
                                        await download.save_as(str(filepath))
                                        
                                        logger.info(f"🎉 Novo relatório CSV gerado e descarregado: {filepath}")
                                        return str(filepath)
                                    except Exception as e:
                                        logger.error(f"❌ Erro no download após gerar: {e}")
                                break
                        except Exception as e:
                            continue
            
            logger.warning("⚠️ Não foi possível obter o relatório CSV da semana específica")
            await self.screenshot("falha_final")
            return None
            
        except Exception as e:
            logger.error(f"❌ Erro ao gerar/download CSV: {e}")
            await self.screenshot("erro_csv")
            return None

    async def processar_csv_uber(self, filepath: str) -> List[Dict[str, Any]]:
        """
        Processa um ficheiro CSV da Uber e extrai os dados dos motoristas.
        
        Colunas esperadas (baseado no CSV de exemplo do utilizador):
        - UUID do motorista
        - Nome próprio do motorista
        - Apelido do motorista
        - Pago a si (total)
        - Pago a si : Os seus rendimentos
        - Pago a si : Os seus rendimentos : Tarifa
        - Pago a si:Os seus rendimentos:Gratificação
        - Pago a si:Saldo da viagem:Reembolsos:Portagem
        - Pago a si:Os seus rendimentos:Taxa de serviço
        """
        import csv
        
        try:
            logger.info(f"📋 A processar CSV: {filepath}")
            
            motoristas = []
            
            # Ler ficheiro com detecção de encoding
            content = None
            for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
                try:
                    with open(filepath, 'r', encoding=encoding) as f:
                        content = f.read()
                    break
                except UnicodeDecodeError:
                    continue
            
            if not content:
                logger.error("❌ Não foi possível ler o ficheiro CSV")
                return []
            
            # Detectar delimitador
            delimiter = ',' if content.count(',') > content.count(';') else ';'
            
            import io
            reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
            
            for row in reader:
                uuid_motorista = row.get('UUID do motorista', '').strip()
                if not uuid_motorista:
                    continue
                
                # Ignorar linhas da empresa/parceiro (valores negativos ou transferências)
                pago_total = self._parse_valor(row.get('Pago a si', '0'))
                if pago_total < 0:
                    continue
                
                nome = f"{row.get('Nome próprio do motorista', '')} {row.get('Apelido do motorista', '')}".strip()
                
                # Extrair portagens (reembolsos) e impostos sobre tarifa
                portagens_reembolso = self._parse_valor(row.get('Pago a si:Saldo da viagem:Reembolsos:Portagem', '0'))
                imposto_tarifa = self._parse_valor(row.get('Pago a si:Saldo da viagem:Impostos:Imposto sobre a tarifa', '0'))
                
                # Total portagens = reembolsos portagem + imposto sobre tarifa
                portagens_total = portagens_reembolso + imposto_tarifa
                
                motorista = {
                    "uuid_motorista": uuid_motorista,
                    "nome": nome,
                    "pago_total": pago_total,
                    "rendimentos_total": self._parse_valor(row.get('Pago a si : Os seus rendimentos', '0')),
                    "tarifa": self._parse_valor(row.get('Pago a si : Os seus rendimentos : Tarifa', '0')),
                    "gratificacao": self._parse_valor(row.get('Pago a si:Os seus rendimentos:Gratificação', '0')),
                    "portagens": portagens_total,
                    "portagens_reembolso": portagens_reembolso,
                    "imposto_tarifa": imposto_tarifa,
                    "taxa_servico": self._parse_valor(row.get('Pago a si:Os seus rendimentos:Taxa de serviço', '0')),
                }
                
                motoristas.append(motorista)
                logger.info(f"  ✅ {nome}: Tarifa={motorista['tarifa']:.2f}€, uGrat={motorista['gratificacao']:.2f}€, uPort={motorista['portagens']:.2f}€ (reemb={portagens_reembolso:.2f}+imp={imposto_tarifa:.2f})")
            
            logger.info(f"📊 Total processado: {len(motoristas)} motoristas")
            return motoristas
            
        except Exception as e:
            logger.error(f"❌ Erro ao processar CSV: {e}")
            return []
    
    def _parse_valor(self, valor: str) -> float:
        """Converte string de valor para float"""
        if not valor:
            return 0.0
        try:
            clean = str(valor).strip().replace(',', '.').replace('€', '').replace(' ', '')
            return float(clean)
        except:
            return 0.0


async def executar_rpa_uber(
    email: str,
    password: str,
    data_inicio: str,
    data_fim: str,
    sms_code: str = None,
    pin_code: str = None,
    headless: bool = True
) -> Dict[str, Any]:
    """
    Executar RPA Uber para extrair rendimentos.
    
    Args:
        email: Email de login Uber
        password: Password Uber
        data_inicio: Data início (YYYY-MM-DD)
        data_fim: Data fim (YYYY-MM-DD)
        sms_code: Código SMS para autenticação (opcional)
        pin_code: PIN/código de acesso adicional (opcional)
        headless: Executar sem interface gráfica
    
    Returns:
        Dicionário com resultados da extração incluindo:
        - motoristas: lista com tarifa, gratificacao, portagens para cada motorista
        - total_tarifa: soma das tarifas (ganhos base para comissões)
        - total_gratificacoes: soma das gratificações (uGrat)
        - total_portagens: soma das portagens (uPort)
        - total_rendimentos: soma dos rendimentos líquidos
    """
    resultado = {
        "sucesso": False,
        "ficheiro": None,
        "motoristas": [],
        "total_motoristas": 0,
        "total_tarifa": 0.0,  # Ganhos base (Uber para comissões)
        "total_gratificacoes": 0.0,  # uGrat
        "total_portagens": 0.0,  # uPort
        "total_rendimentos": 0.0,  # Rendimentos líquidos
        "mensagem": None,
        "logs": [],
        "precisa_sms": False,
        "precisa_captcha": False
    }
    
    rpa = UberRPA(email, password, sms_code, pin_code)
    
    try:
        await rpa.iniciar_browser(headless=headless, usar_sessao=True)
        resultado["logs"].append("Browser iniciado")
        
        # Login
        if not await rpa.fazer_login():
            # Verificar se é problema de CAPTCHA ou SMS
            resultado["mensagem"] = "Falha no login Uber. Pode ser necessário código SMS ou resolver CAPTCHA."
            resultado["logs"].append("Login falhou - verificar se precisa SMS ou CAPTCHA")
            resultado["precisa_sms"] = True
            resultado["precisa_captcha"] = True
            return resultado
        resultado["logs"].append("Login bem sucedido")
        
        # Guardar sessão após login bem sucedido
        await rpa.guardar_sessao()
        resultado["logs"].append("Sessão guardada para uso futuro")
        
        # Ir para Rendimentos
        await rpa.ir_para_rendimentos()
        resultado["logs"].append("Navegou para Rendimentos")
        
        # Selecionar período
        await rpa.selecionar_periodo(data_inicio, data_fim)
        resultado["logs"].append(f"Período selecionado: {data_inicio} a {data_fim}")
        
        # Extrair dados da tabela (com detalhes de cada motorista)
        motoristas = await rpa.extrair_dados_tabela()
        
        if motoristas:
            resultado["motoristas"] = motoristas
            resultado["total_motoristas"] = len(motoristas)
            # Calcular totais separados
            resultado["total_tarifa"] = sum(m.get("tarifa", 0) for m in motoristas)
            resultado["total_gratificacoes"] = sum(m.get("gratificacao", 0) for m in motoristas)
            resultado["total_portagens"] = sum(m.get("portagens", 0) for m in motoristas)
            resultado["total_rendimentos"] = sum(m.get("rendimentos_liquidos", 0) for m in motoristas)
            resultado["logs"].append(f"Extraídos {len(motoristas)} motoristas com detalhes")
            resultado["logs"].append(f"Totais: Tarifa={resultado['total_tarifa']:.2f}€, uGrat={resultado['total_gratificacoes']:.2f}€, uPort={resultado['total_portagens']:.2f}€")
        
        # Tentar download do relatório
        ficheiro = await rpa.fazer_download_relatorio()
        if ficheiro:
            resultado["ficheiro"] = ficheiro
            resultado["logs"].append(f"Relatório descarregado: {ficheiro}")
        
        resultado["sucesso"] = True
        resultado["mensagem"] = f"Extração Uber concluída! {len(motoristas)} motoristas - Tarifa: €{resultado['total_tarifa']:.2f}, uGrat: €{resultado['total_gratificacoes']:.2f}, uPort: €{resultado['total_portagens']:.2f}"
        
    except Exception as e:
        resultado["mensagem"] = f"Erro: {str(e)}"
        resultado["logs"].append(f"Erro: {str(e)}")
        logger.error(f"❌ Erro geral Uber: {e}")
        
    finally:
        await rpa.fechar_browser()
    
    return resultado
