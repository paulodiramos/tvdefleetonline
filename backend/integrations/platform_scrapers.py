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
    
    async def login(self, email: str, password: str) -> bool:
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
    
    async def login(self, email: str, password: str) -> bool:
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
    
    async def login(self, email: str, password: str) -> bool:
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
    
    async def login(self, email: str, password: str) -> bool:
        try:
            logger.info(f"🔑 {self.platform_name}: Login com {email}")
            
            # Navegar para a página principal
            await self.page.goto(self.login_url, wait_until="networkidle")
            await asyncio.sleep(3)
            
            # Screenshot da página inicial
            await self.page.screenshot(path='/tmp/viaverde_01_home.png')
            logger.info("📸 Screenshot 1: Home page")
            
            # IMPORTANTE: Procurar e clicar no botão "Login" que abre o modal
            logger.info("🔍 Procurando botão de login que abre modal...")
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
                        logger.info(f"🎯 Clicando em: {selector}")
                        await self.page.click(selector)
                        await asyncio.sleep(2)
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
            
            # Screenshot após tentar abrir modal
            await self.page.screenshot(path='/tmp/viaverde_02_after_click.png')
            logger.info("📸 Screenshot 2: Após clicar em login")
            
            # Aguardar modal aparecer
            logger.info("⏳ Aguardando modal aparecer...")
            await asyncio.sleep(3)
            
            # Verificar se há iframe
            frames = self.page.frames
            logger.info(f"🔍 Encontrados {len(frames)} frames na página")
            
            # Tentar encontrar modal/dialog
            modal_selectors = [
                '[role="dialog"]',
                '.modal',
                '#modal-login',
                '[aria-modal="true"]',
                '.popup'
            ]
            
            modal_found = False
            for selector in modal_selectors:
                if await self.page.is_visible(selector, timeout=2000):
                    logger.info(f"✅ Modal encontrado: {selector}")
                    modal_found = True
                    break
            
            await self.page.screenshot(path='/tmp/viaverde_03_modal_search.png')
            logger.info("📸 Screenshot 3: Procura por modal")
            
            # Seletores mais específicos baseados na análise da imagem
            email_selectors = [
                # Baseado na análise: campos podem ter IDs específicos
                '#email',
                '#login-email',
                '#emailAddress',
                'input[name="email"]',
                'input[type="email"]',
                # Dentro de modal/dialog
                '[role="dialog"] input[type="email"]',
                '.modal input[type="email"]',
                # Por placeholder
                'input[placeholder*="Email"]',
                'input[placeholder*="email"]',
                # Por classes
                '.email-input',
                '.via-verde-input[name="email"]'
            ]
            
            logger.info("📝 Tentando preencher email...")
            email_filled = False
            for selector in email_selectors:
                try:
                    # Aguardar elemento aparecer
                    await self.page.wait_for_selector(selector, timeout=3000)
                    if await self.page.is_visible(selector):
                        await self.page.fill(selector, email)
                        logger.info(f"✅ Email preenchido com: {selector}")
                        email_filled = True
                        break
                except Exception as e:
                    logger.debug(f"Tentativa {selector}: {e}")
                    continue
            
            if not email_filled:
                logger.error("❌ Campo de email não encontrado")
                await self.page.screenshot(path='/tmp/viaverde_04_email_fail.png')
                # Tentar pegar todos os inputs visíveis
                all_inputs = await self.page.query_selector_all('input')
                logger.info(f"Total de inputs encontrados: {len(all_inputs)}")
                return False
            
            await asyncio.sleep(1)
            await self.page.screenshot(path='/tmp/viaverde_05_email_filled.png')
            logger.info("📸 Screenshot 4: Email preenchido")
            
            # Preencher password
            password_selectors = [
                '#password',
                '#login-password',
                'input[name="password"]',
                'input[type="password"]',
                '[role="dialog"] input[type="password"]',
                '.modal input[type="password"]',
                'input[placeholder*="senha"]',
                'input[placeholder*="password"]',
                '.password-input'
            ]
            
            logger.info("🔐 Tentando preencher password...")
            password_filled = False
            for selector in password_selectors:
                try:
                    await self.page.wait_for_selector(selector, timeout=3000)
                    if await self.page.is_visible(selector):
                        await self.page.fill(selector, password)
                        logger.info(f"✅ Password preenchida com: {selector}")
                        password_filled = True
                        break
                except:
                    continue
            
            if not password_filled:
                logger.error("❌ Campo de password não encontrado")
                await self.page.screenshot(path='/tmp/viaverde_06_password_fail.png')
                return False
            
            await asyncio.sleep(1)
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
            
            # Aguardar resposta
            logger.info("⏳ Aguardando resposta do servidor...")
            await asyncio.sleep(10)
            await self.page.screenshot(path='/tmp/viaverde_09_after_submit.png')
            logger.info("📸 Screenshot 6: Após submit")
            
            # Verificar se login foi bem-sucedido
            current_url = self.page.url
            logger.info(f"📍 URL final: {current_url}")
            
            # Verificar erros
            error_msg = await self._check_error_message()
            if error_msg:
                logger.error(f"❌ Mensagem de erro encontrada: {error_msg}")
                return False
            
            # Verificar indicadores de sucesso
            success_indicators = [
                "dashboard" in current_url.lower(),
                "area-cliente" in current_url.lower(),
                "extrato" in current_url.lower(),
                "movimento" in current_url.lower()
            ]
            
            # Verificar se modal fechou
            try:
                modal_closed = not await self.page.is_visible('[role="dialog"]', timeout=2000)
                if modal_closed:
                    logger.info("✅ Modal fechou - possível sucesso")
            except:
                modal_closed = True
            
            if any(success_indicators) or (modal_closed and "login" not in current_url.lower()):
                logger.info("✅ Login bem-sucedido!")
                await self.page.screenshot(path='/tmp/viaverde_10_success.png')
                return True
            
            logger.error("❌ Login falhou")
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
            
            # Aguardar página carregar
            await asyncio.sleep(5)
            await self.page.screenshot(path='/tmp/viaverde_dashboard.png')
            
            # Procurar por links "Extratos e Movimentos"
            extratos_links = [
                'a:has-text("Extratos e Movimentos")',
                'a:has-text("Extratos")',
                'a:has-text("Movimentos")',
                '[href*="extrato"]',
                '[href*="movimento"]'
            ]
            
            navegado = False
            for link in extratos_links:
                try:
                    if await self.page.is_visible(link, timeout=2000):
                        await self.page.click(link)
                        await asyncio.sleep(4)
                        logger.info(f"✅ Navegado para Extratos e Movimentos")
                        navegado = True
                        break
                except:
                    continue
            
            if not navegado:
                logger.warning("⚠️ Link de Extratos não encontrado, tentando URL direta")
                try:
                    await self.page.goto('https://www.viaverde.pt/extratos-movimentos')
                    await asyncio.sleep(3)
                except:
                    pass
            
            await self.page.screenshot(path='/tmp/viaverde_extratos_page.png')
            
            # Tentar extrair dados da tabela HTML
            logger.info("📋 Tentando extrair dados da tabela...")
            
            dados_extraidos = []
            
            try:
                # Aguardar tabela carregar
                await self.page.wait_for_selector('table', timeout=10000)
                
                # Extrair linhas da tabela
                rows = await self.page.query_selector_all('table tbody tr')
                logger.info(f"📊 Encontradas {len(rows)} linhas na tabela")
                
                for row in rows:
                    try:
                        # Extrair células
                        cells = await row.query_selector_all('td')
                        
                        if len(cells) >= 4:
                            # Estrutura conforme screenshots: Nº Extrato, Contrato, Ano, Mês
                            num_extrato = await cells[0].text_content()
                            contrato = await cells[1].text_content()
                            ano = await cells[2].text_content()
                            mes = await cells[3].text_content()
                            
                            dados_extraidos.append({
                                "numero_extrato": num_extrato.strip() if num_extrato else "",
                                "contrato": contrato.strip() if contrato else "",
                                "ano": ano.strip() if ano else "",
                                "mes": mes.strip() if mes else "",
                                "plataforma": "via_verde"
                            })
                    except Exception as e:
                        logger.warning(f"⚠️ Erro ao processar linha: {e}")
                        continue
                
                logger.info(f"✅ {len(dados_extraidos)} registos extraídos da tabela")
                
            except Exception as e:
                logger.warning(f"⚠️ Não foi possível extrair tabela: {e}")
            
            # Se não conseguiu extrair da tabela, tentar baixar PDF
            if len(dados_extraidos) == 0:
                logger.info("📥 Tentando exportar via botão...")
                
                export_buttons = [
                    'button:has-text("Exportar extratos")',
                    'button:has-text("Exportar")',
                    'a:has-text("Exportar extratos")',
                    'a:has-text("2ª Via")'
                ]
                
                for button in export_buttons:
                    try:
                        if await self.page.is_visible(button, timeout=2000):
                            logger.info(f"🎯 Encontrado botão: {button}")
                            await self.page.click(button)
                            await asyncio.sleep(3)
                            logger.info("✅ Clicado em botão de exportação")
                            break
                    except:
                        continue
            
            return {
                "success": True,
                "platform": "via_verde",
                "extracted_at": datetime.now(timezone.utc).isoformat(),
                "data": dados_extraidos,
                "total_registos": len(dados_extraidos),
                "message": f"{len(dados_extraidos)} extratos encontrados"
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
    
    async def login(self, email: str, password: str) -> bool:
        logger.info(f"🔑 {self.platform_name}: Login genérico (a implementar)")
        return False
    
    async def extract_data(self, **kwargs) -> Dict:
        return {
            "success": False,
            "message": "GPS scraper genérico a implementar"
        }


class CombustivelScraper(BaseScraper):
    """Scraper para sistemas de gestão de combustível"""
    
    def __init__(self, headless: bool = True):
        super().__init__(headless)
        self.platform_name = "Combustível"
        self.login_url = ""  # Configurável
    
    async def login(self, email: str, password: str) -> bool:
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
        'gps': GPSScraper,
        'combustivel': CombustivelScraper
    }
    
    scraper_class = scrapers.get(platform.lower())
    if not scraper_class:
        raise ValueError(f"Plataforma '{platform}' não suportada")
    
    return scraper_class(headless)
