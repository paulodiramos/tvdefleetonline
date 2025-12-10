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
            await asyncio.sleep(2)
            
            # Screenshot da página inicial
            await self.page.screenshot(path='/tmp/viaverde_home.png')
            logger.info("📸 Screenshot da home page")
            
            # Procurar botão de login/área cliente
            login_buttons = [
                'a:has-text("Área Cliente")',
                'a:has-text("Login")',
                'a:has-text("Entrar")',
                'button:has-text("Área Cliente")',
                '[href*="login"]',
                '[href*="area-cliente"]'
            ]
            
            button_clicked = False
            for selector in login_buttons:
                try:
                    if await self.page.is_visible(selector, timeout=2000):
                        logger.info(f"🎯 Encontrado botão: {selector}")
                        await self.page.click(selector)
                        button_clicked = True
                        break
                except:
                    continue
            
            if not button_clicked:
                logger.warning("⚠️ Botão de login não encontrado, tentando acesso direto")
                # Tentar URL direta de login
                possible_login_urls = [
                    "https://www.viaverde.pt/area-cliente",
                    "https://www.viaverde.pt/login",
                    "https://cliente.viaverde.pt",
                    "https://www.viaverde.pt/particulares/area-cliente"
                ]
                
                for url in possible_login_urls:
                    try:
                        await self.page.goto(url, wait_until="networkidle", timeout=10000)
                        await asyncio.sleep(2)
                        await self.page.screenshot(path=f'/tmp/viaverde_login_page.png')
                        logger.info(f"✅ Acedido: {url}")
                        break
                    except:
                        continue
            
            await asyncio.sleep(3)
            await self.page.screenshot(path='/tmp/viaverde_login_form.png')
            
            # Tentar preencher email
            email_filled = await self._fill_field(
                [
                    'input[type="email"]',
                    'input[name="email"]',
                    'input[name="username"]',
                    'input[name="utilizador"]',
                    'input[placeholder*="mail"]',
                    'input[placeholder*="utilizador"]',
                    'input[id*="email"]',
                    'input[id*="user"]',
                    '#email',
                    '#username'
                ],
                email,
                "email"
            )
            
            if not email_filled:
                logger.error("❌ Campo de email não encontrado")
                return False
            
            await asyncio.sleep(1)
            
            # Tentar preencher password
            password_filled = await self._fill_field(
                [
                    'input[type="password"]',
                    'input[name="password"]',
                    'input[name="senha"]',
                    'input[placeholder*="password"]',
                    'input[placeholder*="senha"]',
                    'input[id*="password"]',
                    '#password',
                    '#senha'
                ],
                password,
                "password"
            )
            
            if not password_filled:
                logger.error("❌ Campo de password não encontrado")
                return False
            
            await asyncio.sleep(1)
            await self.page.screenshot(path='/tmp/viaverde_before_submit.png')
            
            # Tentar clicar no botão de login
            button_clicked = await self._click_button(
                [
                    'button[type="submit"]',
                    'button:has-text("Entrar")',
                    'button:has-text("Login")',
                    'button:has-text("Aceder")',
                    'input[type="submit"]',
                    'a:has-text("Entrar")',
                    '[data-testid="login-button"]',
                    '.btn-login',
                    '#login-button',
                    '#submit'
                ],
                "login"
            )
            
            if not button_clicked:
                logger.error("❌ Botão de login não encontrado")
                return False
            
            # Aguardar resposta
            await asyncio.sleep(8)
            await self.page.screenshot(path='/tmp/viaverde_after_login.png')
            
            # Verificar se login foi bem-sucedido
            current_url = self.page.url
            logger.info(f"📍 URL atual: {current_url}")
            
            # Verificar erros
            error_msg = await self._check_error_message()
            if error_msg:
                logger.error(f"❌ Erro: {error_msg}")
                return False
            
            # Verificar se saiu da página de login
            if "login" not in current_url.lower() or "dashboard" in current_url.lower() or "area-cliente" in current_url.lower():
                logger.info("✅ Login bem-sucedido!")
                return True
            
            logger.error("❌ Login falhou - ainda na página de login")
            return False
            
        except Exception as e:
            logger.error(f"❌ Erro durante login: {e}")
            await self.page.screenshot(path='/tmp/viaverde_error.png')
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
