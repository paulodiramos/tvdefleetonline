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
                # Aguardar tabela carregar com timeout maior
                logger.info("⏳ Aguardando tabela de extratos carregar...")
                await self.page.wait_for_selector('table', timeout=30000)  # 30s
                logger.info("✅ Tabela encontrada!")
                
                # Extrair linhas da tabela
                rows = await self.page.query_selector_all('table tbody tr')
                logger.info(f"📊 Encontradas {len(rows)} linhas na tabela")
                
                if len(rows) == 0:
                    logger.warning("⚠️ Tabela encontrada mas está vazia")
                
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
                        else:
                            logger.debug(f"⚠️ Linha ignorada: apenas {len(cells)} células")
                    except Exception as e:
                        logger.warning(f"⚠️ Erro ao processar linha: {e}")
                        continue
                
                logger.info(f"✅ {len(dados_extraidos)} registos extraídos da tabela")
                
            except Exception as e:
                logger.error(f"❌ Erro ao aguardar/extrair tabela: {e}")
                logger.info("📸 Tirando screenshot para debug...")
                await self.page.screenshot(path='/tmp/viaverde_table_error.png')
            
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
