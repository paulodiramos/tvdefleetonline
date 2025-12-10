"""
Módulo de integração com Bolt Partner Platform
Extrai dados de ganhos e relatórios usando Playwright
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Tuple
from playwright.async_api import async_playwright, Page, Browser
import re
import json

logger = logging.getLogger(__name__)

class BoltScraper:
    """Scraper para plataforma Bolt Partner"""
    
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.base_url = "https://partners.bolt.eu"
        
    async def __aenter__(self):
        """Context manager entry"""
        await self.initialize()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        await self.close()
        
    async def initialize(self):
        """Inicializar browser e página"""
        try:
            logger.info("🚀 Inicializando Bolt scraper...")
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(
                headless=self.headless,
                args=['--no-sandbox', '--disable-setuid-sandbox']
            )
            self.page = await self.browser.new_page()
            
            # Set longer timeout
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
        """
        Fazer login na plataforma Bolt Partner
        
        Args:
            email: Email de acesso
            password: Password de acesso
            
        Returns:
            True se login bem-sucedido, False caso contrário
        """
        try:
            logger.info(f"🔑 Tentando login com email: {email}")
            
            # Navegar para página de login
            await self.page.goto(f"{self.base_url}/login", wait_until="networkidle")
            await asyncio.sleep(2)
            
            # Preencher email
            logger.info("📝 Preenchendo email...")
            email_selector = 'input[type="email"], input[name="email"], input[id*="email"]'
            await self.page.wait_for_selector(email_selector, timeout=10000)
            await self.page.fill(email_selector, email)
            
            # Preencher password
            logger.info("🔐 Preenchendo password...")
            password_selector = 'input[type="password"], input[name="password"]'
            await self.page.fill(password_selector, password)
            
            # Clicar no botão de login
            logger.info("👆 Clicando no botão de login...")
            login_button = 'button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")'
            await self.page.click(login_button)
            
            # Aguardar navegação ou erro
            await asyncio.sleep(5)
            
            # Verificar se login foi bem-sucedido
            current_url = self.page.url
            
            if "login" not in current_url.lower():
                logger.info("✅ Login bem-sucedido!")
                
                # Tirar screenshot de confirmação
                await self.page.screenshot(path='/tmp/bolt_login_success.png')
                return True
            else:
                # Verificar mensagem de erro
                error_msg = await self._check_error_message()
                logger.error(f"❌ Login falhou. URL ainda contém 'login'. Erro: {error_msg}")
                await self.page.screenshot(path='/tmp/bolt_login_failed.png')
                return False
                
        except Exception as e:
            logger.error(f"❌ Erro durante login: {e}")
            await self.page.screenshot(path='/tmp/bolt_login_error.png')
            return False
            
    async def _check_error_message(self) -> Optional[str]:
        """Verificar mensagem de erro na página"""
        try:
            error_selectors = [
                '.error', '.alert-danger', '[class*="error"]',
                '[role="alert"]', '.notification--error'
            ]
            
            for selector in error_selectors:
                if await self.page.is_visible(selector):
                    error_text = await self.page.text_content(selector)
                    return error_text
                    
            return None
        except:
            return None
            
    async def extract_earnings_data(
        self, 
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """
        Extrair dados de ganhos do dashboard
        
        Args:
            start_date: Data de início (padrão: 7 dias atrás)
            end_date: Data de fim (padrão: hoje)
            
        Returns:
            Dicionário com dados de ganhos
        """
        try:
            if not start_date:
                start_date = datetime.now(timezone.utc) - timedelta(days=7)
            if not end_date:
                end_date = datetime.now(timezone.utc)
                
            logger.info(f"📊 Extraindo dados de ganhos de {start_date.date()} a {end_date.date()}")
            
            # Aguardar página carregar completamente
            await asyncio.sleep(3)
            
            # Capturar screenshot do dashboard
            await self.page.screenshot(path='/tmp/bolt_dashboard.png')
            
            # Tentar encontrar dados de ganhos
            earnings_data = {
                "success": True,
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
                "total_earnings": 0.0,
                "trips_count": 0,
                "drivers": [],
                "extracted_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Tentar extrair valores do dashboard
            # Nota: Os seletores exatos dependem da estrutura da página Bolt
            try:
                # Extrair earnings total (adaptar seletores conforme necessário)
                earnings_selectors = [
                    '[data-testid="total-earnings"]',
                    '.earnings-total',
                    '[class*="earnings"]',
                ]
                
                for selector in earnings_selectors:
                    if await self.page.is_visible(selector):
                        earnings_text = await self.page.text_content(selector)
                        # Extrair número
                        earnings_match = re.search(r'[\d,.]+', earnings_text)
                        if earnings_match:
                            earnings_data["total_earnings"] = float(earnings_match.group().replace(',', '.'))
                            logger.info(f"💰 Ganhos extraídos: €{earnings_data['total_earnings']}")
                            break
                            
            except Exception as e:
                logger.warning(f"⚠️ Não foi possível extrair ganhos específicos: {e}")
                
            # Extrair conteúdo HTML para análise posterior
            page_content = await self.page.content()
            earnings_data["raw_html_length"] = len(page_content)
            
            logger.info("✅ Extração de dados concluída")
            return earnings_data
            
        except Exception as e:
            logger.error(f"❌ Erro ao extrair dados: {e}")
            return {
                "success": False,
                "error": str(e),
                "extracted_at": datetime.now(timezone.utc).isoformat()
            }
            
    async def download_report(self, output_path: str = "/tmp/bolt_report.csv") -> Tuple[bool, str]:
        """
        Fazer download do relatório de ganhos
        
        Args:
            output_path: Caminho para guardar o ficheiro
            
        Returns:
            Tupla (sucesso, caminho_ficheiro)
        """
        try:
            logger.info("📥 Tentando fazer download do relatório...")
            
            # Procurar botão de download/export
            download_selectors = [
                'button:has-text("Download")',
                'button:has-text("Export")',
                '[data-testid="download-button"]',
                'a[href*="download"]',
                'a[href*="export"]'
            ]
            
            for selector in download_selectors:
                try:
                    if await self.page.is_visible(selector, timeout=2000):
                        logger.info(f"🎯 Encontrado botão de download: {selector}")
                        
                        # Configurar download
                        async with self.page.expect_download() as download_info:
                            await self.page.click(selector)
                            download = await download_info.value
                            
                        # Guardar ficheiro
                        await download.save_as(output_path)
                        logger.info(f"✅ Relatório guardado em: {output_path}")
                        return True, output_path
                        
                except Exception as e:
                    continue
                    
            logger.warning("⚠️ Botão de download não encontrado")
            return False, "Botão de download não encontrado"
            
        except Exception as e:
            logger.error(f"❌ Erro ao fazer download: {e}")
            return False, str(e)
            
    async def navigate_to_earnings(self) -> bool:
        """Navegar para a página de ganhos/relatórios"""
        try:
            logger.info("🧭 Navegando para página de ganhos...")
            
            # Possíveis links para earnings/reports
            earnings_links = [
                'a:has-text("Earnings")',
                'a:has-text("Reports")',
                'a:has-text("Ganhos")',
                'a:has-text("Relatórios")',
                '[href*="earnings"]',
                '[href*="reports"]'
            ]
            
            for link in earnings_links:
                try:
                    if await self.page.is_visible(link, timeout=2000):
                        await self.page.click(link)
                        await asyncio.sleep(3)
                        logger.info("✅ Navegação bem-sucedida")
                        return True
                except:
                    continue
                    
            logger.info("ℹ️ Link de ganhos não encontrado, assumindo que já estamos na página correta")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao navegar: {e}")
            return False


async def test_bolt_connection(email: str, password: str) -> Dict:
    """
    Testar conexão com Bolt Partner
    
    Args:
        email: Email de acesso
        password: Password
        
    Returns:
        Dicionário com resultado do teste
    """
    result = {
        "success": False,
        "message": "",
        "data": {}
    }
    
    try:
        async with BoltScraper(headless=True) as scraper:
            # Tentar login
            login_success = await scraper.login(email, password)
            
            if login_success:
                result["success"] = True
                result["message"] = "Login bem-sucedido!"
                
                # Tentar navegar para earnings
                await scraper.navigate_to_earnings()
                
                # Extrair dados
                earnings_data = await scraper.extract_earnings_data()
                result["data"] = earnings_data
                
            else:
                result["message"] = "Falha no login. Verifique as credenciais."
                
    except Exception as e:
        result["message"] = f"Erro durante teste: {str(e)}"
        logger.error(f"Erro no teste: {e}")
        
    return result
