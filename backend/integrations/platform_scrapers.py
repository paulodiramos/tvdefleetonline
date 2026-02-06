"""
Módulo unificado de scrapers para todas as plataformas
Suporta: Bolt, Uber, Via Verde, GPS, Combustível
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Tuple
from playwright.async_api import async_playwright, Page, Browser
import re
import csv

logger = logging.getLogger(__name__)

class BaseScraper:
    """Classe base para todos os scrapers"""
    
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.platform_name = "Base"
        self.login_url = ""
        
    async def __aenter__(self):
        await self.initialize()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
        
    async def initialize(self):
        """Inicializar browser"""
        try:
            logger.info(f"🚀 Inicializando {self.platform_name} scraper...")
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(
                headless=self.headless,
                args=['--no-sandbox', '--disable-setuid-sandbox']
            )
            self.page = await self.browser.new_page()
            self.page.set_default_timeout(60000)
            logger.info("✅ Browser inicializado")
        except Exception as e:
            logger.error(f"❌ Erro ao inicializar browser: {e}")
            raise
            
    async def close(self):
        """Fechar browser"""
        try:
            if self.page:
                await self.page.close()
            if self.browser:
                await self.browser.close()
            logger.info("🔒 Browser fechado")
        except Exception as e:
            logger.error(f"Erro ao fechar browser: {e}")
    
    async def login(self, email: str, password: str, **kwargs) -> bool:
        """Método genérico de login - deve ser sobrescrito"""
        raise NotImplementedError
    
    async def extract_data(self, **kwargs) -> Dict:
        """Método genérico de extração - deve ser sobrescrito"""
        raise NotImplementedError


class BoltScraper(BaseScraper):
    """Scraper para Bolt Partners"""
    
    def __init__(self, headless: bool = True):
        super().__init__(headless)
        self.platform_name = "Bolt"
        self.login_url = "https://partners.bolt.eu/login"
    
    async def login(self, email: str, password: str, **kwargs) -> bool:
        try:
            logger.info(f"🔑 {self.platform_name}: Login com {email}")
            await self.page.goto(self.login_url, wait_until="networkidle")
            await asyncio.sleep(2)
            
            # Tentar preencher email
            email_filled = await self._fill_field(
                ['input[type="email"]', 'input[name="email"]', '#email'],
                email,
                "email"
            )
            
            if not email_filled:
                return False
            
            await asyncio.sleep(1)
            
            # Tentar preencher password
            password_filled = await self._fill_field(
                ['input[type="password"]', 'input[name="password"]', '#password'],
                password,
                "password"
            )
            
            if not password_filled:
                return False
            
            await asyncio.sleep(1)
            
            # Clicar no botão de login
            button_clicked = await self._click_button(
                ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("Sign in")'],
                "login"
            )
            
            if not button_clicked:
                return False
            
            await asyncio.sleep(8)
            
            # Verificar sucesso
            current_url = self.page.url
            if "login" not in current_url.lower() or "dashboard" in current_url.lower():
                logger.info("✅ Login bem-sucedido!")
                return True
            
            logger.error("❌ Login falhou")
            return False
            
        except Exception as e:
            logger.error(f"❌ Erro durante login: {e}")
            return False
    
    async def extract_data(self, start_date=None, end_date=None) -> Dict:
        try:
            logger.info(f"📊 {self.platform_name}: Extraindo dados...")
            
            # Aguardar página carregar
            await asyncio.sleep(5)
            
            # Simular extração (ajustar conforme estrutura real)
            return {
                "success": True,
                "platform": "bolt",
                "data": [],
                "message": "Dados extraídos (simulação - ajustar seletores para produção)"
            }
        except Exception as e:
            logger.error(f"❌ Erro ao extrair dados: {e}")
            return {"success": False, "error": str(e)}
    
    async def _fill_field(self, selectors: List[str], value: str, field_name: str) -> bool:
        for selector in selectors:
            try:
                if await self.page.is_visible(selector, timeout=2000):
                    await self.page.fill(selector, value)
                    logger.info(f"✅ Campo {field_name} preenchido")
                    return True
            except:
                continue
        logger.error(f"❌ Campo {field_name} não encontrado")
        return False
    
    async def _click_button(self, selectors: List[str], button_name: str) -> bool:
        for selector in selectors:
            try:
                if await self.page.is_visible(selector, timeout=2000):
                    await self.page.click(selector)
                    logger.info(f"✅ Botão {button_name} clicado")
                    return True
            except:
                continue
        logger.error(f"❌ Botão {button_name} não encontrado")
        return False


class UberScraper(BaseScraper):
    """Scraper para Uber Partners"""
    
    def __init__(self, headless: bool = True):
        super().__init__(headless)
        self.platform_name = "Uber"
        self.login_url = "https://partners.uber.com/login"
    
    async def login(self, email: str, password: str, **kwargs) -> bool:
        # Similar ao Bolt, ajustar seletores
        logger.info(f"🔑 {self.platform_name}: Login (a implementar)")
        return False
    
    async def extract_data(self, **kwargs) -> Dict:
        return {
            "success": False,
            "message": "Uber scraper a implementar com seletores específicos"
        }


class ViaVerdeScraper(BaseScraper):
    """Scraper para Via Verde"""
    
    def __init__(self, headless: bool = True):
        super().__init__(headless)
        self.platform_name = "Via Verde"
        self.login_url = "https://www.viaverde.pt"
    
    async def login(self, email: str, password: str, account_type: str = "empresas") -> bool:
        try:
            logger.info(f"🔑 {self.platform_name}: Login com {email} (área: {account_type})")
            
            # ESTRATÉGIA: Navegar direto para a página de extratos que FORÇA o login
            # Isto mantém a sessão na área correta
            target_url = f'https://www.viaverde.pt/{account_type}/minha-via-verde/extratos-movimentos'
            logger.info(f"🔗 Navegando direto para extratos (forçará login): {target_url}")
            
            await self.page.goto(target_url, wait_until='domcontentloaded')
            await asyncio.sleep(4)
            
            # ============ ACEITAR COOKIES PRIMEIRO ============
            logger.info("🍪 Verificando cookie banner...")
            cookie_accepted = False
            cookie_selectors = [
                'button:has-text("Accept All Cookies")',
                'button:has-text("Aceitar todos")',
                'button:has-text("Aceitar Todos os Cookies")',
                '[id*="onetrust-accept"]',
                '#onetrust-accept-btn-handler',
                'button.onetrust-close-btn-handler',
                '[data-action="accept"]'
            ]
            
            for selector in cookie_selectors:
                try:
                    btn = self.page.locator(selector)
                    if await btn.count() > 0 and await btn.first.is_visible(timeout=2000):
                        await btn.first.click()
                        logger.info(f"✅ Cookies aceites: {selector}")
                        cookie_accepted = True
                        await asyncio.sleep(2)
                        break
                except Exception:
                    continue
            
            if not cookie_accepted:
                logger.info("ℹ️ Cookie banner não encontrado ou já aceite")
            
            # Isto deve mostrar a página de login/redirect
            await self.page.screenshot(path='/tmp/viaverde_01_login_page.png')
            logger.info(f"📍 URL atual: {self.page.url}")
            logger.info("📸 Screenshot 1: Página de login")
            
            # Verificar se já estamos numa página de login direto (não modal)
            # Procurar campos de login na página principal
            logger.info("🔍 Verificando se há formulário de login direto...")
            
            direct_email_selectors = [
                'input#txtUsername',
                'input[name*="UserLogin"][type="email"]',
                'input[type="email"]',
                'input[name="email"]'
            ]
            
            has_direct_form = False
            for selector in direct_email_selectors:
                try:
                    if await self.page.is_visible(selector, timeout=2000):
                        logger.info(f"✅ Formulário direto encontrado: {selector}")
                        has_direct_form = True
                        break
                except:
                    continue
            
            if not has_direct_form:
                # Procurar e clicar no botão "Login" que abre modal
                logger.info("🔍 Formulário direto não encontrado, procurando botão de modal...")
                
                login_trigger_buttons = [
                    'button:has-text("Login")',
                    'a:has-text("Login")',
                    '[class*="login"]',
                    '#login-button',
                    'button[data-action="login"]'
                ]
                
                modal_opened = False
                for selector in login_trigger_buttons:
                    try:
                        if await self.page.is_visible(selector, timeout=2000):
                            logger.info(f"🎯 Clicando em botão modal: {selector}")
                            await self.page.click(selector)
                            await asyncio.sleep(3)
                            modal_opened = True
                            break
                    except:
                        continue
                
                if not modal_opened:
                    logger.warning("⚠️ Tentando clicar em qualquer link com 'login'")
                    try:
                        await self.page.click('text=Login')
                        await asyncio.sleep(2)
                        modal_opened = True
                    except:
                        pass
                
                if not modal_opened:
                    logger.error("❌ Botão de login não encontrado")
                    return False
            
            await self.page.screenshot(path='/tmp/viaverde_02_login_form.png')
            logger.info("📸 Screenshot 2: Formulário de login")
            
            # Aguardar modal aparecer - CRÍTICO: Dar tempo para animação completar
            logger.info("⏳ Aguardando modal aparecer e estar interativo...")
            await asyncio.sleep(4)
            
            # Verificar se há iframe
            frames = self.page.frames
            logger.info(f"🔍 Encontrados {len(frames)} frames na página")
            
            # Tentar encontrar modal/dialog e aguardar estar visível
            modal_selectors = [
                '[role="dialog"]',
                '.modal',
                '#modal-login',
                '[aria-modal="true"]',
                '.popup',
                'div:has-text("A Minha Via Verde")'
            ]
            
            modal_found = False
            for selector in modal_selectors:
                try:
                    await self.page.wait_for_selector(selector, timeout=5000, state='visible')
                    modal_found = True
                    logger.info(f"✅ Modal encontrado e visível: {selector}")
                    break
                except:
                    continue
            
            # Aguardar mais um pouco para garantir que campos estão interativos
            await asyncio.sleep(2)
            
            await self.page.screenshot(path='/tmp/viaverde_03_modal_search.png')
            logger.info("📸 Screenshot 3: Modal confirmado")
            
            # Seletores corretos baseados na inspeção real da página
            email_selectors = [
                # CORRETO: ID real encontrado na página
                '#txtUsername',
                'input#txtUsername',
                # Fallback: qualquer input email visível
                'input[type="email"]',
                '[role="dialog"] input[type="email"]',
                '.modal input[type="email"]',
                # Por name attribute
                'input[name*="txtUsername"]',
                'input[name*="UserLogin"]',
                # Prioridade baixa: genéricos
                'input[placeholder*="email" i]'
            ]
            
            logger.info("📝 Tentando preencher email...")
            email_filled = False
            for selector in email_selectors:
                try:
                    # Aguardar elemento aparecer
                    await self.page.wait_for_selector(selector, timeout=3000)
                    if await self.page.is_visible(selector):
                        # Clicar para dar foco
                        await self.page.click(selector)
                        await asyncio.sleep(0.5)
                        
                        # Limpar campo
                        await self.page.fill(selector, '')
                        await asyncio.sleep(0.3)
                        
                        # Digitar email
                        await self.page.type(selector, email, delay=50)
                        await asyncio.sleep(0.5)
                        
                        # Verificar preenchimento
                        filled_value = await self.page.evaluate(f'document.querySelector("{selector}").value')
                        if filled_value and '@' in filled_value:
                            logger.info(f"✅ Email preenchido com: {selector} ({filled_value})")
                            email_filled = True
                            break
                        else:
                            logger.warning(f"⚠️ Email não preenchido corretamente com {selector}")
                except Exception as e:
                    logger.debug(f"Tentativa {selector}: {e}")
                    continue
            
            if not email_filled:
                logger.error("❌ Campo de email não encontrado")
                await self.page.screenshot(path='/tmp/viaverde_04_email_fail.png')
                
                # DEBUG: Tentar pegar info de todos os inputs visíveis
                try:
                    all_inputs = await self.page.query_selector_all('input')
                    logger.info(f"🔍 DEBUG: Total de inputs encontrados: {len(all_inputs)}")
                    
                    for i, inp in enumerate(all_inputs):
                        try:
                            is_visible = await inp.is_visible()
                            inp_type = await inp.get_attribute('type')
                            inp_id = await inp.get_attribute('id')
                            inp_name = await inp.get_attribute('name')
                            inp_class = await inp.get_attribute('class')
                            logger.info(f"  Input {i+1}: type={inp_type}, id={inp_id}, name={inp_name}, visible={is_visible}, class={inp_class}")
                        except:
                            pass
                except Exception as e:
                    logger.warning(f"Erro ao fazer debug dos inputs: {e}")
                
                return False
            
            await asyncio.sleep(1)
            await self.page.screenshot(path='/tmp/viaverde_05_email_filled.png')
            logger.info("📸 Screenshot 4: Email preenchido")
            
            # Seletores corretos baseados na inspeção real da página
            password_selectors = [
                # CORRETO: ID real encontrado na página
                '#txtPassword',
                'input#txtPassword',
                # Fallback: qualquer input password visível
                'input[type="password"]',
                '[role="dialog"] input[type="password"]',
                '.modal input[type="password"]',
                # Por name attribute
                'input[name*="txtPassword"]',
                'input[name*="UserLogin"]',
                # Prioridade baixa: genéricos
                'input[placeholder*="pass" i]',
                'input[placeholder*="senha" i]'
            ]
            
            logger.info("🔐 Tentando preencher password...")
            password_filled = False
            for selector in password_selectors:
                try:
                    await self.page.wait_for_selector(selector, timeout=3000)
                    if await self.page.is_visible(selector):
                        # CRÍTICO: Usar múltiplos métodos para garantir preenchimento
                        # 1. Primeiro clicar no campo para dar foco
                        await self.page.click(selector)
                        await asyncio.sleep(0.5)
                        
                        # 2. Limpar campo primeiro
                        await self.page.fill(selector, '')
                        await asyncio.sleep(0.3)
                        
                        # 3. Usar .type() em vez de .fill() para simular digitação real
                        await self.page.type(selector, password, delay=50)
                        await asyncio.sleep(0.5)
                        
                        # 4. Verificar se o valor foi preenchido verificando o atributo value
                        filled_value = await self.page.evaluate(f'document.querySelector("{selector}").value')
                        if filled_value and len(filled_value) > 0:
                            logger.info(f"✅ Password preenchida com sucesso usando: {selector} (length: {len(filled_value)})")
                            password_filled = True
                            break
                        else:
                            logger.warning(f"⚠️ Password não foi preenchida corretamente com {selector}")
                except Exception as e:
                    logger.debug(f"Tentativa {selector} falhou: {e}")
                    continue
            
            if not password_filled:
                logger.error("❌ Campo de password não encontrado ou não foi possível preencher")
                await self.page.screenshot(path='/tmp/viaverde_06_password_fail.png')
                return False
            
            # Aguardar para garantir que JavaScript processou os inputs
            await asyncio.sleep(2)
            await self.page.screenshot(path='/tmp/viaverde_07_before_submit.png')
            logger.info("📸 Screenshot 5: Antes de submeter")
            
            # Clicar no botão Login dentro do modal
            login_button_selectors = [
                'button:has-text("Login")',
                '[role="dialog"] button[type="submit"]',
                '.modal button:has-text("Login")',
                '.login-btn',
                '#login-button',
                'button.via-verde-button',
                'button.btn-primary',
                'button.green-button'
            ]
            
            logger.info("👆 Tentando clicar no botão Login...")
            button_clicked = False
            for selector in login_button_selectors:
                try:
                    if await self.page.is_visible(selector, timeout=2000):
                        await self.page.click(selector)
                        logger.info(f"✅ Botão clicado: {selector}")
                        button_clicked = True
                        break
                except:
                    continue
            
            if not button_clicked:
                logger.error("❌ Botão de login não encontrado")
                await self.page.screenshot(path='/tmp/viaverde_08_button_fail.png')
                return False
            
            # Aguardar resposta e processamento
            logger.info("⏳ Aguardando resposta do servidor...")
            await asyncio.sleep(5)
            
            # CRÍTICO: Verificar se modal fechou (principal indicador de sucesso)
            modal_closed = False
            try:
                modal = await self.page.query_selector('[role="dialog"]')
                if modal:
                    is_visible = await modal.is_visible()
                    modal_closed = not is_visible
                else:
                    modal_closed = True
                    
                logger.info(f"🔍 Modal fechou: {modal_closed}")
            except:
                modal_closed = True
                logger.info("🔍 Modal não encontrado - presumindo fechado")
            
            await asyncio.sleep(3)
            await self.page.screenshot(path='/tmp/viaverde_09_after_submit.png')
            logger.info("📸 Screenshot 6: Após submit")
            
            # Verificar URL
            current_url = self.page.url
            logger.info(f"📍 URL final: {current_url}")
            
            # Se modal fechou, é muito provável que login foi bem-sucedido
            if modal_closed:
                logger.info("✅ Modal fechou - provável sucesso")
            
            # Verificar erros apenas se modal ainda estiver aberto
            if not modal_closed:
                error_msg = await self._check_error_message()
                if error_msg:
                    logger.error(f"❌ Mensagem de erro encontrada: {error_msg}")
                    return False
            
            # Verificar indicadores de sucesso
            success_indicators = [
                modal_closed,  # Se modal fechou, principal indicador
                "dashboard" in current_url.lower(),
                "area-cliente" in current_url.lower(),
                "extrato" in current_url.lower(),
                "movimento" in current_url.lower(),
                "particulares" in current_url.lower() and "login" not in current_url.lower()
            ]
            
            if any(success_indicators):
                logger.info("✅ Login bem-sucedido!")
                await self.page.screenshot(path='/tmp/viaverde_10_success.png')
                return True
            
            logger.error("❌ Login falhou - indicadores de sucesso não encontrados")
            return False
            
        except Exception as e:
            logger.error(f"❌ Erro durante login: {e}")
            import traceback
            traceback.print_exc()
            await self.page.screenshot(path='/tmp/viaverde_99_exception.png')
            return False
    
    async def extract_data(self, start_date=None, end_date=None) -> Dict:
        try:
            logger.info(f"📊 {self.platform_name}: Extraindo dados de portagens...")
            
            # Calcular datas se não fornecidas (última semana)
            if not start_date:
                start_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            
            logger.info(f"📅 Período: {start_date} até {end_date}")
            
            # Aguardar página carregar após login
            await asyncio.sleep(3)
            current_url = self.page.url
            logger.info(f"📍 URL atual após login: {current_url}")
            await self.page.screenshot(path='/tmp/viaverde_01_after_login.png')
            
            # 1. Navegar para página de extratos e movimentos (EMPRESAS)
            logger.info("🔗 Navegando para extratos e movimentos (Empresas)...")
            try:
                await self.page.goto(
                    'https://www.viaverde.pt/empresas/minha-via-verde/extratos-movimentos',
                    wait_until="domcontentloaded",
                    timeout=30000
                )
                await asyncio.sleep(5)
                logger.info("✅ Página de extratos carregada")
                await self.page.screenshot(path='/tmp/viaverde_02_extratos_page.png')
            except Exception as e:
                logger.error(f"❌ Erro ao navegar para extratos: {e}")
                return {
                    "success": False,
                    "platform": "via_verde",
                    "message": f"Erro ao aceder à página de extratos: {str(e)}",
                    "data": []
                }
            
            # 2. Clicar no botão/tab "Movimentos"
            logger.info("🔍 Procurando botão 'Movimentos'...")
            movimentos_selectors = [
                'a:has-text("Movimentos")',
                'button:has-text("Movimentos")',
                '[href*="movimento"]',
                'li:has-text("Movimentos")',
                '.tab:has-text("Movimentos")'
            ]
            
            clicked_movimentos = False
            for selector in movimentos_selectors:
                try:
                    locator = self.page.locator(selector)
                    if await locator.is_visible(timeout=3000):
                        logger.info(f"✅ Encontrado: {selector}")
                        await locator.click()
                        await asyncio.sleep(3)
                        clicked_movimentos = True
                        logger.info("✅ Clicado em 'Movimentos'")
                        await self.page.screenshot(path='/tmp/viaverde_03_movimentos_tab.png')
                        break
                except Exception as e:
                    logger.debug(f"Tentativa {selector} falhou: {e}")
                    continue
            
            if not clicked_movimentos:
                logger.warning("⚠️ Botão 'Movimentos' não encontrado, continuando...")
            
            # 3. Preencher filtros de data
            logger.info("📅 Preenchendo filtros de data...")
            
            # Converter formato de data para DD-MM-YYYY (formato português) e DD/MM/YYYY
            start_date_pt = datetime.strptime(start_date, '%Y-%m-%d').strftime('%d-%m-%Y')
            end_date_pt = datetime.strptime(end_date, '%Y-%m-%d').strftime('%d-%m-%Y')
            start_date_slash = datetime.strptime(start_date, '%Y-%m-%d').strftime('%d/%m/%Y')
            end_date_slash = datetime.strptime(end_date, '%Y-%m-%d').strftime('%d/%m/%Y')
            
            # Procurar campos de data
            date_from_selectors = [
                'input[name*="DataInicio"]',
                'input[name*="dataInicio"]',
                'input[name*="from"]',
                'input[id*="DataInicio"]',
                'input[placeholder*="início"]',
                'input[placeholder*="Início"]',
                'input[id*="startDate"]',
                'input[name*="startDate"]',
                '#dataInicio',
                '.date-from input',
                'input[type="date"]:first-of-type'
            ]
            
            date_to_selectors = [
                'input[name*="DataFim"]',
                'input[name*="dataFim"]',
                'input[name*="to"]',
                'input[id*="DataFim"]',
                'input[placeholder*="fim"]',
                'input[placeholder*="Fim"]',
                'input[id*="endDate"]',
                'input[name*="endDate"]',
                '#dataFim',
                '.date-to input',
                'input[type="date"]:last-of-type'
            ]
            
            # Função auxiliar para preencher campo de data
            async def fill_date_field(selectors, date_value, date_value_slash, field_name):
                for selector in selectors:
                    try:
                        locator = self.page.locator(selector).first
                        if await locator.is_visible(timeout=2000):
                            # Limpar campo primeiro
                            await locator.click()
                            await asyncio.sleep(0.3)
                            await locator.fill('')
                            await asyncio.sleep(0.2)
                            
                            # Tentar com formato DD-MM-YYYY
                            await locator.fill(date_value)
                            await asyncio.sleep(0.3)
                            
                            # Verificar se foi aceite
                            value = await locator.input_value()
                            if value and len(value) > 5:
                                logger.info(f"✅ {field_name} preenchida: {date_value} (valor: {value})")
                                return True
                            
                            # Tentar com formato DD/MM/YYYY
                            await locator.fill('')
                            await locator.fill(date_value_slash)
                            await asyncio.sleep(0.3)
                            
                            value = await locator.input_value()
                            if value and len(value) > 5:
                                logger.info(f"✅ {field_name} preenchida: {date_value_slash} (valor: {value})")
                                return True
                            
                            # Tentar via keyboard type
                            await locator.fill('')
                            await locator.type(date_value, delay=50)
                            await asyncio.sleep(0.3)
                            
                            logger.info(f"✅ {field_name} preenchida via type: {date_value}")
                            return True
                    except Exception as e:
                        logger.debug(f"Tentativa {selector} falhou: {e}")
                        continue
                return False
            
            # Preencher data inicial
            filled_from = await fill_date_field(
                date_from_selectors, 
                start_date_pt, 
                start_date_slash, 
                "Data inicial"
            )
            
            # Preencher data final
            filled_to = await fill_date_field(
                date_to_selectors, 
                end_date_pt, 
                end_date_slash, 
                "Data final"
            )
            
            if not filled_from or not filled_to:
                logger.warning(f"⚠️ Datas não preenchidas (from: {filled_from}, to: {filled_to})")
                # Tirar screenshot para debug
                await self.page.screenshot(path='/tmp/viaverde_04_dates_failed.png')
            
            await self.page.screenshot(path='/tmp/viaverde_04_dates_filled.png')
            
            # 4. Clicar no botão "Filtrar"
            logger.info("🔍 Procurando botão 'Filtrar'...")
            filter_selectors = [
                'button:has-text("Filtrar")',
                'input[value="Filtrar"]',
                'a:has-text("Filtrar")',
                'button[type="submit"]'
            ]
            
            clicked_filter = False
            for selector in filter_selectors:
                try:
                    locator = self.page.locator(selector)
                    if await locator.is_visible(timeout=3000):
                        logger.info(f"✅ Encontrado botão filtrar: {selector}")
                        await locator.click()
                        await asyncio.sleep(5)  # Aguardar resultados carregarem
                        clicked_filter = True
                        logger.info("✅ Filtro aplicado")
                        await self.page.screenshot(path='/tmp/viaverde_05_after_filter.png')
                        break
                except:
                    continue
            
            if not clicked_filter:
                logger.warning("⚠️ Botão 'Filtrar' não encontrado")
            
            # 5. Exportar CSV
            logger.info("📥 Procurando botão 'Exportar CSV'...")
            export_selectors = [
                'button:has-text("Exportar")',
                'a:has-text("Exportar")',
                'button:has-text("CSV")',
                'a:has-text("CSV")',
                'button:has-text("Download")',
                '[title*="Exportar"]',
                '[title*="CSV"]'
            ]
            
            # Configurar download
            download_path = f'/tmp/viaverde_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            
            export_clicked = False
            for selector in export_selectors:
                try:
                    locator = self.page.locator(selector)
                    if await locator.is_visible(timeout=3000):
                        logger.info(f"✅ Encontrado botão exportar: {selector}")
                        
                        # Aguardar download
                        async with self.page.expect_download() as download_info:
                            await locator.click()
                            download = await download_info.value
                        
                        # Guardar ficheiro
                        await download.save_as(download_path)
                        logger.info(f"✅ CSV exportado: {download_path}")
                        export_clicked = True
                        break
                except Exception as e:
                    logger.debug(f"Tentativa {selector} falhou: {e}")
                    continue
            
            if not export_clicked:
                logger.warning("⚠️ Botão 'Exportar CSV' não encontrado")
                return {
                    "success": False,
                    "platform": "via_verde",
                    "message": "Não foi possível encontrar o botão de exportação de CSV. Verifique se há dados disponíveis para o período selecionado.",
                    "data": []
                }
            
            await self.page.screenshot(path='/tmp/viaverde_06_export_done.png')
            
            # 6. Processar CSV (básico - pode ser expandido)
            dados_extraidos = []
            try:
                import csv
                with open(download_path, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        dados_extraidos.append(dict(row))
                
                logger.info(f"✅ {len(dados_extraidos)} registos extraídos do CSV")
            except Exception as e:
                logger.warning(f"⚠️ Erro ao processar CSV: {e}")
            
            return {
                "success": True,
                "platform": "via_verde",
                "extracted_at": datetime.now(timezone.utc).isoformat(),
                "data": dados_extraidos,
                "total_registos": len(dados_extraidos),
                "message": f"Extração concluída! {len(dados_extraidos)} movimentos exportados.",
                "csv_file": download_path,
                "period": f"{start_date} até {end_date}"
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao extrair dados: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": []
            }
    
    async def _fill_field(self, selectors: List[str], value: str, field_name: str) -> bool:
        for selector in selectors:
            try:
                if await self.page.is_visible(selector, timeout=2000):
                    await self.page.fill(selector, value)
                    logger.info(f"✅ Campo {field_name} preenchido usando: {selector}")
                    return True
            except:
                continue
        logger.error(f"❌ Campo {field_name} não encontrado")
        return False
    
    async def _click_button(self, selectors: List[str], button_name: str) -> bool:
        for selector in selectors:
            try:
                if await self.page.is_visible(selector, timeout=2000):
                    await self.page.click(selector)
                    logger.info(f"✅ Botão {button_name} clicado usando: {selector}")
                    return True
            except:
                continue
        logger.error(f"❌ Botão {button_name} não encontrado")
        return False
    
    async def _check_error_message(self) -> Optional[str]:
        """Verificar mensagem de erro na página"""
        try:
            error_selectors = [
                '.error', '.alert-danger', '[class*="error"]',
                '[role="alert"]', '.notification--error',
                'div:has-text("inválid")', 'div:has-text("incorret")'
            ]
            
            for selector in error_selectors:
                try:
                    if await self.page.is_visible(selector, timeout=1000):
                        error_text = await self.page.text_content(selector)
                        return error_text
                except:
                    continue
                    
            return None
        except:
            return None


class GPSScraper(BaseScraper):
    """Scraper genérico para sistemas GPS"""
    
    def __init__(self, headless: bool = True):
        super().__init__(headless)
        self.platform_name = "GPS"
        self.login_url = ""  # Configurável por utilizador
    
    async def login(self, email: str, password: str, **kwargs) -> bool:
        logger.info(f"🔑 {self.platform_name}: Login genérico (a implementar)")
        return False
    
    async def extract_data(self, **kwargs) -> Dict:
        return {
            "success": False,
            "message": "GPS scraper genérico a implementar"
        }


class PrioScraper(BaseScraper):
    """Scraper para Prio Energy - Portal MyPRIO"""
    
    def __init__(self, headless: bool = True):
        super().__init__(headless)
        self.platform_name = "Prio"
        self.login_url = "https://www.myprio.com/MyPrioReactiveTheme/Login"
    
    async def login(self, username: str, password: str, **kwargs) -> Dict:
        """Login no portal MyPRIO"""
        try:
            logger.info(f"🔑 {self.platform_name}: Login com utilizador {username}")
            
            # Navegar para página de login
            await self.page.goto(self.login_url, wait_until='networkidle')
            await asyncio.sleep(2)
            
            await self.page.screenshot(path='/tmp/prio_01_login_page.png')
            
            # Preencher utilizador
            username_input = self.page.locator('#Input_Username')
            if await username_input.count() > 0:
                await username_input.fill(username)
                logger.info(f"✅ Utilizador preenchido: {username}")
            else:
                logger.error("❌ Campo de utilizador não encontrado")
                return {"success": False, "error": "Campo de utilizador não encontrado"}
            
            await asyncio.sleep(0.5)
            
            # Preencher password
            password_input = self.page.locator('#Input_Password')
            if await password_input.count() > 0:
                await password_input.fill(password)
                logger.info("✅ Password preenchida")
            else:
                logger.error("❌ Campo de password não encontrado")
                return {"success": False, "error": "Campo de password não encontrado"}
            
            await self.page.screenshot(path='/tmp/prio_02_credentials_filled.png')
            
            # Clicar no botão de login
            login_btn = self.page.locator('button:has-text("INICIAR SESSÃO")')
            if await login_btn.count() == 0:
                login_btn = self.page.locator('input[type="submit"]')
            if await login_btn.count() == 0:
                login_btn = self.page.get_by_role("button", name="INICIAR SESSÃO")
            
            if await login_btn.count() > 0:
                await login_btn.first.click()
                logger.info("✅ Botão de login clicado")
            else:
                logger.error("❌ Botão de login não encontrado")
                return {"success": False, "error": "Botão de login não encontrado"}
            
            # Aguardar navegação
            await asyncio.sleep(5)
            
            await self.page.screenshot(path='/tmp/prio_03_after_login.png')
            
            # Verificar se login foi bem sucedido
            current_url = self.page.url
            page_content = await self.page.content()
            
            # Verificar erros de login
            error_selectors = [
                '.error-message',
                '.alert-danger',
                '[class*="error"]',
                'text=credenciais inválidas',
                'text=utilizador ou password incorretos'
            ]
            
            for selector in error_selectors:
                try:
                    if await self.page.locator(selector).count() > 0:
                        error_text = await self.page.locator(selector).first.text_content()
                        logger.error(f"❌ Erro de login: {error_text}")
                        return {"success": False, "error": error_text}
                except Exception:
                    continue
            
            # Verificar se saiu da página de login
            if "Login" not in current_url or "Dashboard" in current_url or "Home" in current_url:
                logger.info("✅ Login Prio bem sucedido!")
                return {"success": True}
            
            # Verificar elementos típicos de área logada
            dashboard_indicators = [
                'text=Bem-vindo',
                'text=Dashboard',
                'text=Minha Conta',
                'text=Consumos',
                'text=Faturas',
                '[class*="dashboard"]',
                '[class*="menu"]'
            ]
            
            for indicator in dashboard_indicators:
                try:
                    if await self.page.locator(indicator).count() > 0:
                        logger.info(f"✅ Login confirmado - encontrado: {indicator}")
                        return {"success": True}
                except Exception:
                    continue
            
            logger.warning("⚠️ Estado de login incerto")
            return {"success": True, "warning": "Login pode ter sido bem sucedido, mas não foi possível confirmar"}
            
        except Exception as e:
            logger.error(f"❌ Erro durante login Prio: {e}")
            await self.page.screenshot(path='/tmp/prio_99_error.png')
            return {"success": False, "error": str(e)}
    
    async def extract_data(self, start_date: str = None, end_date: str = None, **kwargs) -> Dict:
        """Extrair dados de consumo/faturas do portal Prio"""
        try:
            logger.info("📊 Prio: Iniciando extração de dados...")
            
            await self.page.screenshot(path='/tmp/prio_04_dashboard.png')
            
            # Navegar para secção de consumos/faturas
            # Procurar menu de consumos
            consumos_selectors = [
                'a:has-text("Consumos")',
                'a:has-text("Movimentos")',
                '[href*="consumos"]',
                '[href*="movements"]',
                'text=Consultar Consumos'
            ]
            
            clicked_consumos = False
            for selector in consumos_selectors:
                try:
                    locator = self.page.locator(selector)
                    if await locator.count() > 0 and await locator.first.is_visible(timeout=2000):
                        await locator.first.click()
                        await asyncio.sleep(3)
                        clicked_consumos = True
                        logger.info(f"✅ Navegou para consumos: {selector}")
                        break
                except Exception:
                    continue
            
            if not clicked_consumos:
                logger.warning("⚠️ Secção de consumos não encontrada")
            
            await self.page.screenshot(path='/tmp/prio_05_consumos.png')
            
            # Preencher filtros de data se disponíveis
            if start_date and end_date:
                logger.info(f"📅 Aplicando filtro de datas: {start_date} a {end_date}")
                
                # Formato de data para o portal (DD/MM/YYYY)
                start_formatted = datetime.strptime(start_date, '%Y-%m-%d').strftime('%d/%m/%Y')
                end_formatted = datetime.strptime(end_date, '%Y-%m-%d').strftime('%d/%m/%Y')
                
                date_from_selectors = [
                    'input[id*="DataInicio"]',
                    'input[id*="StartDate"]',
                    'input[name*="startDate"]',
                    'input[placeholder*="início"]',
                    'input[placeholder*="De"]'
                ]
                
                date_to_selectors = [
                    'input[id*="DataFim"]',
                    'input[id*="EndDate"]',
                    'input[name*="endDate"]',
                    'input[placeholder*="fim"]',
                    'input[placeholder*="Até"]'
                ]
                
                # Preencher data inicial
                for selector in date_from_selectors:
                    try:
                        locator = self.page.locator(selector).first
                        if await locator.is_visible(timeout=1000):
                            await locator.fill(start_formatted)
                            logger.info(f"✅ Data inicial: {start_formatted}")
                            break
                    except Exception:
                        continue
                
                # Preencher data final
                for selector in date_to_selectors:
                    try:
                        locator = self.page.locator(selector).first
                        if await locator.is_visible(timeout=1000):
                            await locator.fill(end_formatted)
                            logger.info(f"✅ Data final: {end_formatted}")
                            break
                    except Exception:
                        continue
                
                # Clicar em pesquisar/filtrar
                search_btn = self.page.locator('button:has-text("Pesquisar"), button:has-text("Filtrar"), input[type="submit"]').first
                if await search_btn.count() > 0:
                    await search_btn.click()
                    await asyncio.sleep(3)
            
            await self.page.screenshot(path='/tmp/prio_06_results.png')
            
            # Tentar extrair dados da tabela
            data = []
            table = self.page.locator('table').first
            if await table.count() > 0:
                rows = await self.page.locator('table tbody tr').all()
                logger.info(f"📊 Encontradas {len(rows)} linhas na tabela")
                
                for row in rows[:50]:  # Limitar a 50 registos
                    try:
                        cells = await row.locator('td').all()
                        row_data = []
                        for cell in cells:
                            text = await cell.text_content()
                            row_data.append(text.strip() if text else '')
                        if row_data:
                            data.append(row_data)
                    except Exception:
                        continue
            
            # Tentar exportar CSV se disponível
            export_selectors = [
                'button:has-text("Exportar")',
                'a:has-text("Exportar")',
                'button:has-text("Excel")',
                'button:has-text("CSV")',
                '[title*="Exportar"]'
            ]
            
            for selector in export_selectors:
                try:
                    locator = self.page.locator(selector)
                    if await locator.count() > 0 and await locator.first.is_visible(timeout=2000):
                        logger.info(f"✅ Botão de exportar encontrado: {selector}")
                        # Não clicar automaticamente, apenas informar
                        break
                except Exception:
                    continue
            
            await self.page.screenshot(path='/tmp/prio_07_final.png')
            
            return {
                "success": True,
                "platform": "prio",
                "data": data,
                "rows_extracted": len(data)
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao extrair dados Prio: {e}")
            await self.page.screenshot(path='/tmp/prio_99_extract_error.png')
            return {
                "success": False,
                "platform": "prio",
                "error": str(e)
            }


class CombustivelScraper(BaseScraper):
    """Scraper para sistemas de gestão de combustível"""
    
    def __init__(self, headless: bool = True):
        super().__init__(headless)
        self.platform_name = "Combustível"
        self.login_url = ""  # Configurável
    
    async def login(self, email: str, password: str, **kwargs) -> bool:
        logger.info(f"🔑 {self.platform_name}: Login (a implementar)")
        return False
    
    async def extract_data(self, **kwargs) -> Dict:
        return {
            "success": False,
            "message": "Combustível scraper a implementar"
        }


def get_scraper(platform: str, headless: bool = True):
    """Factory para obter o scraper correto"""
    scrapers = {
        'bolt': BoltScraper,
        'uber': UberScraper,
        'via_verde': ViaVerdeScraper,
        'prio': PrioScraper,
        'gps': GPSScraper,
        'combustivel': CombustivelScraper
    }
    
    scraper_class = scrapers.get(platform.lower())
    if not scraper_class:
        raise ValueError(f"Plataforma '{platform}' não suportada")
    
    return scraper_class(headless)
