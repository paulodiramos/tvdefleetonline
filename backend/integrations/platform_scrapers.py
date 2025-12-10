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
        logger.info(f"🔑 {self.platform_name}: Login (a implementar)")
        return False
    
    async def extract_data(self, **kwargs) -> Dict:
        return {
            "success": False,
            "message": "Via Verde scraper a implementar"
        }


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
