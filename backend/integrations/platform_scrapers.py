"""
Módulo unificado de scrapers para todas as plataformas
Suporta: Bolt, Uber, Via Verde, GPS, Combustível
"""
import asyncio
import logging
import os
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Tuple
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
import re
import csv

logger = logging.getLogger(__name__)

class BaseScraper:
    """Classe base para todos os scrapers"""
    
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
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
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless,
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
            )
            self.context = await self.browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                locale='pt-PT'
            )
            self.page = await self.context.new_page()
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
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
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
    """Scraper para Uber Fleet/Supplier"""
    
    def __init__(self, headless: bool = True, parceiro_id: str = None):
        super().__init__(headless)
        self.platform_name = "Uber Fleet"
        self.login_url = "https://supplier.uber.com/"
        self.parceiro_id = parceiro_id
        self.session_path = f"/tmp/uber_sessao_{parceiro_id}.json" if parceiro_id else None
    
    async def initialize(self):
        """Inicializar browser, opcionalmente com sessão guardada"""
        await super().initialize()
        
        # Se temos sessão guardada, carregar cookies
        if self.session_path and os.path.exists(self.session_path):
            try:
                import json
                with open(self.session_path, 'r') as f:
                    storage_state = json.load(f)
                
                # Aplicar cookies
                if 'cookies' in storage_state:
                    await self.context.add_cookies(storage_state['cookies'])
                    logger.info(f"✅ Sessão Uber carregada de {self.session_path}")
            except Exception as e:
                logger.warning(f"⚠️ Erro ao carregar sessão Uber: {e}")
    
    async def verificar_login(self) -> bool:
        """Verificar se está logado na Uber"""
        try:
            await self.page.goto("https://supplier.uber.com/", wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)
            
            url = self.page.url
            logger.info(f"📍 Uber URL atual: {url}")
            
            # Se redirecionou para login, não está logado
            if "login" in url.lower() or "auth" in url.lower():
                return False
            
            # Verificar elementos que indicam login
            dashboard_elements = [
                'text="Relatórios"',
                'text="Reports"',
                'text="Dashboard"',
                '[data-testid="dashboard"]'
            ]
            
            for selector in dashboard_elements:
                try:
                    el = self.page.locator(selector)
                    if await el.count() > 0:
                        logger.info("✅ Login Uber verificado - elementos de dashboard encontrados")
                        return True
                except:
                    continue
            
            return False
            
        except Exception as e:
            logger.warning(f"⚠️ Erro ao verificar login Uber: {e}")
            return False
    
    async def login(self, email: str, password: str, **kwargs) -> Dict:
        """
        Login na Uber - requer sessão guardada pelo parceiro.
        A Uber usa autenticação com SMS/OTP que não pode ser automatizada.
        """
        logger.info(f"🔑 {self.platform_name}: Verificando sessão...")
        
        # Verificar se já está logado (via sessão guardada)
        is_logged = await self.verificar_login()
        
        if is_logged:
            return {"success": True, "message": "Logado via sessão guardada"}
        else:
            return {
                "success": False, 
                "error": "Sessão Uber expirada ou não existe. O parceiro deve fazer login manual em /login-plataformas"
            }
    
    async def extract_data(self, start_date: str = None, end_date: str = None, **kwargs) -> Dict:
        """
        Extrair dados de ganhos da Uber Fleet usando sessão guardada.
        
        Novo fluxo otimizado:
        1. Navegar para a página de earning-reports
        2. Procurar relatório existente para o período solicitado
        3. Se existir → Descarregar
        4. Se não existir → Gerar novo e descarregar
        5. Processar ficheiro CSV/PDF
        """
        try:
            logger.info("📊 Uber: Iniciando extração de dados...")
            logger.info(f"📅 Período solicitado: {start_date} a {end_date}")
            
            # Verificar se está logado
            is_logged = await self.verificar_login()
            if not is_logged:
                return {
                    "success": False,
                    "error": "Não está logado na Uber. Use /login-plataformas para guardar a sessão."
                }
            
            await self.page.screenshot(path='/tmp/uber_01_dashboard.png')
            current_url = self.page.url
            logger.info(f"📍 URL inicial: {current_url}")
            
            # ============ PASSO 1: NAVEGAR PARA EARNING-REPORTS ============
            logger.info("📍 Passo 1: Navegando para earning-reports...")
            
            # Extrair org_id da URL atual se disponível
            org_id = None
            if '/orgs/' in current_url:
                try:
                    org_id = current_url.split('/orgs/')[1].split('/')[0]
                    logger.info(f"📍 Organization ID detectado: {org_id}")
                except:
                    pass
            
            # URL direta para os relatórios de ganhos
            if org_id:
                reports_url = f"https://supplier.uber.com/orgs/{org_id}/reports/earning-reports"
            else:
                reports_url = "https://supplier.uber.com/reports/earning-reports"
            
            await self.page.goto(reports_url, wait_until="domcontentloaded", timeout=45000)
            await asyncio.sleep(4)
            
            await self.page.screenshot(path='/tmp/uber_02_reports_page.png')
            logger.info(f"📍 URL atual: {self.page.url}")
            
            # ============ PASSO 2: PROCURAR RELATÓRIO EXISTENTE ============
            logger.info("📍 Passo 2: Procurando relatórios existentes...")
            
            # Formatar datas para procurar no nome do relatório (formato: YYYYMMDD)
            start_formatted = start_date.replace("-", "") if start_date else ""
            end_formatted = end_date.replace("-", "") if end_date else ""
            
            # Procurar botões de download na tabela
            download_buttons = self.page.locator('button:has-text("download"), a:has-text("download"), button:has-text("Faça o download")')
            download_count = await download_buttons.count()
            logger.info(f"📊 Encontrados {download_count} botões de download")
            
            # Procurar na tabela de relatórios pelo período
            report_found = False
            report_row = None
            
            # Obter todas as linhas da tabela
            rows = self.page.locator('table tbody tr, [role="row"]')
            row_count = await rows.count()
            logger.info(f"📊 Encontradas {row_count} linhas na tabela de relatórios")
            
            for i in range(row_count):
                row = rows.nth(i)
                row_text = await row.inner_text()
                
                # Verificar se o relatório é de "Pagamentos de motorista" ou "Driver payments"
                if "pagamentos" in row_text.lower() or "payments" in row_text.lower() or "driver" in row_text.lower():
                    # Verificar se o período corresponde (aproximadamente)
                    if start_formatted in row_text or end_formatted in row_text:
                        logger.info(f"✅ Relatório encontrado para o período: {row_text[:100]}...")
                        report_found = True
                        report_row = row
                        break
                    
                    # Se não encontrou período específico, usar o mais recente como fallback
                    if not report_found:
                        report_row = row
            
            await self.page.screenshot(path='/tmp/uber_03_reports_list.png')
            
            # ============ PASSO 3: DESCARREGAR RELATÓRIO ============
            if report_row:
                logger.info("📍 Passo 3: Descarregando relatório...")
                
                # Procurar botão de download na linha
                download_btn = report_row.locator('button:has-text("download"), a:has-text("download"), button:has-text("Faça o download")')
                
                if await download_btn.count() > 0:
                    # Configurar para capturar o download
                    try:
                        async with self.page.expect_download(timeout=30000) as download_info:
                            await download_btn.first.click()
                        
                        download = await download_info.value
                        download_path = f"/tmp/uber_report_{self.parceiro_id}.csv"
                        await download.save_as(download_path)
                        logger.info(f"✅ Relatório descarregado: {download_path}")
                        
                        await self.page.screenshot(path='/tmp/uber_04_downloaded.png')
                        
                        # ============ PASSO 4: PROCESSAR FICHEIRO ============
                        return await self._processar_relatorio_csv(download_path, start_date, end_date)
                        
                    except Exception as dl_err:
                        logger.warning(f"⚠️ Erro no download: {dl_err}")
                        # Tentar clique direto sem esperar download
                        await download_btn.first.click()
                        await asyncio.sleep(5)
                        await self.page.screenshot(path='/tmp/uber_04_after_click.png')
            
            # Se não encontrou relatório, tentar gerar um novo
            logger.info("⚠️ Relatório não encontrado para o período, tentando gerar novo...")
            
            # ============ PASSO 2: CLICAR EM "GERAR RELATÓRIO" ============
            logger.info("📍 Passo 2: Clicando em Gerar relatório...")
            
            gerar_clicked = False
            gerar_selectors = [
                'button:has-text("Gerar relatório")',
                'button:has-text("Generate report")',
                'button:has-text("Generate")',
                '[data-testid="generate-report-button"]',
                'button[aria-label*="Generate"]',
                'button[aria-label*="Gerar"]'
            ]
            
            for selector in gerar_selectors:
                try:
                    btn = self.page.locator(selector)
                    if await btn.count() > 0 and await btn.first.is_visible(timeout=3000):
                        await btn.first.click()
                        gerar_clicked = True
                        await asyncio.sleep(3)
                        logger.info(f"✅ Clicou em Gerar relatório: {selector}")
                        break
                except Exception as e:
                    logger.debug(f"Selector {selector} não funcionou: {e}")
                    continue
            
            if not gerar_clicked:
                logger.warning("⚠️ Botão 'Gerar relatório' não encontrado, tentando screenshot da página")
                await self.page.screenshot(path='/tmp/uber_03_no_generate_btn.png')
            
            await self.page.screenshot(path='/tmp/uber_03_after_generate_click.png')
            
            # ============ PASSO 3: SELECIONAR TIPO DE RELATÓRIO ============
            logger.info("📍 Passo 3: Selecionando tipo de relatório...")
            
            # Aguardar modal aparecer
            await asyncio.sleep(2)
            
            tipo_selected = False
            tipo_selectors = [
                'text="Pagamentos de motorista"',
                'text="Driver payments"',
                'div:has-text("Pagamentos de motorista")',
                '[data-testid="driver-payments-option"]',
                'input[value*="driver"]'
            ]
            
            for selector in tipo_selectors:
                try:
                    el = self.page.locator(selector)
                    if await el.count() > 0 and await el.first.is_visible(timeout=2000):
                        await el.first.click()
                        tipo_selected = True
                        await asyncio.sleep(1)
                        logger.info(f"✅ Tipo de relatório selecionado: {selector}")
                        break
                except Exception:
                    continue
            
            if not tipo_selected:
                logger.warning("⚠️ Tipo de relatório não selecionado automaticamente")
            
            await self.page.screenshot(path='/tmp/uber_04_tipo_selecionado.png')
            
            # ============ PASSO 4: SELECIONAR PERÍODO ============
            logger.info("📍 Passo 4: Configurando período...")
            
            if start_date and end_date:
                # Tentar encontrar e interagir com o seletor de período
                period_selectors = [
                    '[data-testid="time-range-selector"]',
                    'button:has-text("Intervalo")',
                    'button:has-text("Time range")',
                    'div:has-text("Selecionar intervalo")'
                ]
                
                for selector in period_selectors:
                    try:
                        el = self.page.locator(selector)
                        if await el.count() > 0 and await el.first.is_visible(timeout=2000):
                            await el.first.click()
                            await asyncio.sleep(2)
                            logger.info(f"✅ Abriu seletor de período: {selector}")
                            
                            # Tentar selecionar "Última semana" ou primeiro item
                            week_options = [
                                'text="Última semana"',
                                'text="Last week"',
                                '[role="option"]:first-child'
                            ]
                            for opt in week_options:
                                try:
                                    opt_el = self.page.locator(opt)
                                    if await opt_el.count() > 0:
                                        await opt_el.first.click()
                                        await asyncio.sleep(1)
                                        logger.info(f"✅ Período selecionado: {opt}")
                                        break
                                except:
                                    continue
                            break
                    except:
                        continue
            
            await self.page.screenshot(path='/tmp/uber_05_periodo.png')
            
            # ============ PASSO 5: SELECIONAR ORGANIZAÇÃO (CRÍTICO) ============
            logger.info("📍 Passo 5: Selecionando organização...")
            
            org_selected = False
            
            # Procurar dropdown de organização
            org_dropdown_selectors = [
                'text="Selecione as organizações"',
                '[placeholder*="organizações"]',
                '[data-testid="organization-selector"]',
                'div:has-text("Organizações"):not(:has(div))'
            ]
            
            # Primeiro, encontrar o dropdown
            for selector in org_dropdown_selectors:
                try:
                    dropdown = self.page.locator(selector)
                    if await dropdown.count() > 0 and await dropdown.first.is_visible(timeout=2000):
                        await dropdown.first.click()
                        await asyncio.sleep(2)
                        logger.info(f"✅ Dropdown de organização aberto: {selector}")
                        
                        # Tentar selecionar a primeira opção (checkbox ou option)
                        option_selectors = [
                            '[role="option"]',
                            'input[type="checkbox"]',
                            'li[role="option"]',
                            '[data-testid*="option"]'
                        ]
                        
                        for opt_sel in option_selectors:
                            try:
                                options = self.page.locator(opt_sel)
                                count = await options.count()
                                if count > 0:
                                    # Clicar na primeira opção
                                    first_opt = options.first
                                    if await first_opt.is_visible(timeout=1000):
                                        await first_opt.click()
                                        org_selected = True
                                        await asyncio.sleep(1)
                                        logger.info(f"✅ Organização selecionada via: {opt_sel}")
                                        break
                            except:
                                continue
                        
                        if org_selected:
                            break
                except Exception as e:
                    logger.debug(f"Erro com selector {selector}: {e}")
                    continue
            
            if not org_selected:
                # Fallback: Procurar no modal por qualquer checkbox não marcado
                logger.info("⚠️ Tentando fallback para seleção de organização...")
                try:
                    modal = self.page.locator('[role="dialog"]')
                    if await modal.count() > 0:
                        checkboxes = modal.locator('input[type="checkbox"]')
                        count = await checkboxes.count()
                        logger.info(f"📊 Encontrados {count} checkboxes no modal")
                        for i in range(count):
                            cb = checkboxes.nth(i)
                            if await cb.is_visible():
                                is_checked = await cb.is_checked()
                                if not is_checked:
                                    await cb.click()
                                    org_selected = True
                                    logger.info(f"✅ Checkbox {i} marcado via fallback")
                                    break
                except Exception as e:
                    logger.warning(f"Fallback falhou: {e}")
            
            await self.page.screenshot(path='/tmp/uber_06_org_selecionada.png')
            logger.info(f"📊 Organização selecionada: {org_selected}")
            
            # ============ PASSO 6: CLICAR EM "GERAR" ============
            logger.info("📍 Passo 6: Clicando no botão Gerar final...")
            
            await asyncio.sleep(2)
            
            gerar_final_btn = self.page.locator('button:has-text("Gerar"), button:has-text("Generate")')
            if await gerar_final_btn.count() > 0:
                # Verificar estado do botão
                is_disabled = await gerar_final_btn.first.is_disabled()
                
                if is_disabled:
                    logger.error("❌ Botão 'Gerar' está desabilitado - faltam campos obrigatórios")
                    await self.page.screenshot(path='/tmp/uber_07_gerar_disabled.png')
                    
                    return {
                        "success": False,
                        "error": "Botão 'Gerar' está desabilitado. Verifique se organização e período estão selecionados.",
                        "screenshots": [
                            "/tmp/uber_01_dashboard.png",
                            "/tmp/uber_06_org_selecionada.png",
                            "/tmp/uber_07_gerar_disabled.png"
                        ]
                    }
                
                # Clicar no botão
                await gerar_final_btn.first.click()
                await asyncio.sleep(5)
                logger.info("✅ Botão Gerar clicado")
            else:
                logger.warning("⚠️ Botão Gerar final não encontrado")
            
            await self.page.screenshot(path='/tmp/uber_07_after_generate.png')
            
            # ============ PASSO 7: DOWNLOAD ============
            logger.info("📍 Passo 7: Aguardando download...")
            
            # Fechar modal se ainda aberto
            try:
                close_btn = self.page.locator('[aria-label="close"], button:has-text("Cancelar")')
                if await close_btn.count() > 0:
                    await close_btn.first.click()
                    await asyncio.sleep(2)
            except:
                pass
            
            # Procurar botão de download na lista de relatórios
            download_found = False
            download_selectors = [
                'button:has-text("download")',
                'a:has-text("Download")',
                '[data-testid*="download"]',
                'button[aria-label*="Download"]'
            ]
            
            for selector in download_selectors:
                try:
                    dl_btn = self.page.locator(selector)
                    if await dl_btn.count() > 0 and await dl_btn.first.is_visible(timeout=5000):
                        download_found = True
                        logger.info(f"✅ Botão de download encontrado: {selector}")
                        
                        # TODO: Implementar download real
                        # async with self.page.expect_download() as download_info:
                        #     await dl_btn.first.click()
                        # download = await download_info.value
                        break
                except:
                    continue
            
            await self.page.screenshot(path='/tmp/uber_08_final.png')
            
            return {
                "success": True,
                "platform": "uber",
                "data": [],
                "org_selected": org_selected,
                "download_available": download_found,
                "message": f"Extração Uber: Organização {'selecionada' if org_selected else 'NÃO selecionada'}. Download {'disponível' if download_found else 'não encontrado'}.",
                "screenshots": [
                    "/tmp/uber_01_dashboard.png",
                    "/tmp/uber_02_reports_page.png",
                    "/tmp/uber_06_org_selecionada.png",
                    "/tmp/uber_08_final.png"
                ]
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao extrair dados Uber: {e}")
            import traceback
            traceback.print_exc()
            await self.page.screenshot(path='/tmp/uber_99_error.png')
            return {
                "success": False,
                "platform": "uber",
                "error": str(e),
                "screenshots": ["/tmp/uber_99_error.png"]
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
            
            # ============ VERIFICAR COOKIE BANNER NOVAMENTE ============
            # Pode ter aparecido após o modal de login
            logger.info("🍪 Verificando cookie banner antes de submeter...")
            cookie_selectors = [
                'button:has-text("Accept All Cookies")',
                'button:has-text("Aceitar todos")',
                'button:has-text("Aceitar Todos os Cookies")',
                '[id*="onetrust-accept"]',
                '#onetrust-accept-btn-handler'
            ]
            
            for selector in cookie_selectors:
                try:
                    btn = self.page.locator(selector)
                    if await btn.count() > 0 and await btn.first.is_visible(timeout=1000):
                        await btn.first.click()
                        logger.info(f"✅ Cookies aceites antes do submit: {selector}")
                        await asyncio.sleep(1)
                        break
                except Exception:
                    continue
            
            # Clicar no botão Login dentro do modal
            login_button_selectors = [
                'button:has-text("Login")',
                '[role="dialog"] button[type="submit"]',
                '.modal button:has-text("Login")',
                '.login-btn',
                '#login-button',
                'button.via-verde-button',
                'button.btn-primary',
                'button.green-button',
                # Botão verde dentro do dialog/modal
                '[role="dialog"] button',
                'div[class*="modal"] button'
            ]
            
            logger.info("👆 Tentando clicar no botão Login...")
            button_clicked = False
            
            # Primeiro, tentar o seletor mais específico usando locator
            try:
                login_btn = self.page.locator('[role="dialog"]').locator('button:has-text("Login")')
                if await login_btn.count() > 0:
                    await login_btn.first.click()
                    logger.info("✅ Botão Login clicado via locator do dialog")
                    button_clicked = True
            except Exception as e:
                logger.debug(f"Erro ao clicar via locator: {e}")
            
            # Fallback para seletores individuais
            if not button_clicked:
                for selector in login_button_selectors:
                    try:
                        if await self.page.is_visible(selector, timeout=2000):
                            await self.page.click(selector)
                            logger.info(f"✅ Botão clicado: {selector}")
                            button_clicked = True
                            break
                    except:
                        continue
            
            # Última tentativa: pressionar Enter
            if not button_clicked:
                try:
                    logger.info("⌨️ Tentando pressionar Enter...")
                    await self.page.keyboard.press("Enter")
                    button_clicked = True
                    logger.info("✅ Enter pressionado")
                except Exception as e:
                    logger.warning(f"Erro ao pressionar Enter: {e}")
            
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
            
            # ============ ACEITAR COOKIES SE APARECER ============
            logger.info("🍪 Aceitando cookie banner...")
            try:
                await asyncio.sleep(2)
                
                cookie_btn = self.page.locator('button:has-text("Ok")')
                if await cookie_btn.count() > 0 and await cookie_btn.first.is_visible(timeout=3000):
                    await cookie_btn.first.click(force=True)
                    await asyncio.sleep(2)
                    logger.info("✅ Cookies aceites")
            except Exception:
                logger.debug("Cookie banner não encontrado ou já aceite")
            
            # ============ PASSO 1: NAVEGAR DIRETAMENTE PARA PRIO FROTA TRANSAÇÕES ============
            # URL correta descoberta: https://www.myprio.com/Transactions/Transactions
            logger.info("📍 Passo 1: Navegando para Prio Frota Transações...")
            
            try:
                prio_frota_url = "https://www.myprio.com/Transactions/Transactions"
                await self.page.goto(prio_frota_url, wait_until='networkidle', timeout=30000)
                await asyncio.sleep(3)
                logger.info(f"✅ Navegou para: {self.page.url}")
                    
            except Exception as e:
                logger.warning(f"⚠️ Erro ao navegar: {e}")
            
            await self.page.screenshot(path='/tmp/prio_06_after_navigation.png')
            
            # ============ PASSO 2: PREENCHER DATAS ============
            if start_date and end_date:
                logger.info(f"📅 Passo 2: Aplicando filtro de datas: {start_date} a {end_date}")
                
                # Converter formato de data (YYYY-MM-DD para DD/MM/YYYY)
                start_formatted = datetime.strptime(start_date, '%Y-%m-%d').strftime('%d/%m/%Y')
                end_formatted = datetime.strptime(end_date, '%Y-%m-%d').strftime('%d/%m/%Y')
                
                # Preencher data início - procurar pelo campo "Início"
                try:
                    inicio_selectors = [
                        'input[id*="Inicio"]',
                        'input[placeholder*="Início"]',
                        'input[name*="start"]',
                        'input[id*="Start"]',
                        '#DataInicio',
                        'input.date-inicio'
                    ]
                    
                    for selector in inicio_selectors:
                        try:
                            inicio_input = self.page.locator(selector).first
                            if await inicio_input.count() > 0 and await inicio_input.is_visible(timeout=2000):
                                await inicio_input.clear()
                                await inicio_input.fill(start_formatted)
                                logger.info(f"✅ Data início preenchida: {start_formatted}")
                                break
                        except Exception:
                            continue
                except Exception as e:
                    logger.warning(f"⚠️ Erro ao preencher data início: {e}")
                
                await asyncio.sleep(1)
                
                # Preencher data fim - procurar pelo campo "Fim"
                try:
                    fim_selectors = [
                        'input[id*="Fim"]',
                        'input[placeholder*="Fim"]',
                        'input[name*="end"]',
                        'input[id*="End"]',
                        '#DataFim',
                        'input.date-fim'
                    ]
                    
                    for selector in fim_selectors:
                        try:
                            fim_input = self.page.locator(selector).first
                            if await fim_input.count() > 0 and await fim_input.is_visible(timeout=2000):
                                await fim_input.clear()
                                await fim_input.fill(end_formatted)
                                logger.info(f"✅ Data fim preenchida: {end_formatted}")
                                break
                        except Exception:
                            continue
                except Exception as e:
                    logger.warning(f"⚠️ Erro ao preencher data fim: {e}")
                
                await self.page.screenshot(path='/tmp/prio_07_datas_preenchidas.png')
                
                # ============ PASSO 3: CLICAR EM PESQUISAR ============
                logger.info("📍 Passo 3: Clicando em PESQUISAR...")
                try:
                    pesquisar_selectors = [
                        'button:has-text("PESQUISAR")',
                        'button:has-text("Pesquisar")',
                        'input[value="PESQUISAR"]',
                        'button.btn-search',
                        '#btnPesquisar',
                        'button[type="submit"]'
                    ]
                    
                    clicked_pesquisar = False
                    for selector in pesquisar_selectors:
                        try:
                            btn = self.page.locator(selector).first
                            if await btn.count() > 0 and await btn.is_visible(timeout=2000):
                                await btn.click()
                                clicked_pesquisar = True
                                logger.info(f"✅ Clicou em Pesquisar: {selector}")
                                await asyncio.sleep(4)  # Aguardar resultados
                                break
                        except Exception:
                            continue
                    
                    if not clicked_pesquisar:
                        # Tentar via JavaScript
                        await self.page.evaluate('''() => {
                            const btns = document.querySelectorAll('button');
                            for (let btn of btns) {
                                if (btn.textContent.includes('PESQUISAR') || btn.textContent.includes('Pesquisar')) {
                                    btn.click();
                                    return true;
                                }
                            }
                            return false;
                        }''')
                        await asyncio.sleep(4)
                        
                except Exception as e:
                    logger.warning(f"⚠️ Erro ao clicar em Pesquisar: {e}")
            
            await self.page.screenshot(path='/tmp/prio_08_resultados.png')
            
            # ============ PASSO 4: EXTRAIR DADOS DA TABELA ============
            logger.info("📍 Passo 4: Extraindo dados da tabela...")
            data = []
            
            try:
                # Aguardar tabela carregar
                await asyncio.sleep(2)
                
                # Colunas da tabela (do vídeo):
                # POSTO, REDE, DATA, CARTÃO, ESTADO, LITROS, COMB., RECIBO, KM'S, ID. CONDUTOR, FATURA, VALOR UNIT. (S/IVA), TOTAL
                
                table = self.page.locator('table').first
                if await table.count() > 0:
                    rows = await self.page.locator('table tbody tr').all()
                    logger.info(f"📊 Encontradas {len(rows)} linhas na tabela")
                    
                    for row in rows[:100]:  # Limitar a 100 registos
                        try:
                            cells = await row.locator('td').all()
                            num_cells = len(cells)
                            logger.info(f"    Linha com {num_cells} células")
                            
                            if num_cells >= 6:
                                # Extrair todos os valores para análise
                                all_values = []
                                for i, cell in enumerate(cells):
                                    text = await cell.text_content()
                                    all_values.append(f"[{i}]='{text.strip()[:30] if text else ''}'")
                                logger.info(f"    Células: {' '.join(all_values[:8])}...")
                                
                                # Colunas (14 células):
                                # 0: POSTO, 1: REDE, 2: DATA, 3: CARTÃO, 4: ESTADO, 5: LITROS, 6: COMB., 
                                # 7: RECIBO, 8: KM'S, 9: ID COND., 10: FATURA, 11: V.UNIT (S/IVA), 12: TOTAL, 13: ???
                                
                                posto = await cells[0].text_content() if num_cells > 0 else ""
                                data_trans = await cells[2].text_content() if num_cells > 2 else ""
                                litros_raw = await cells[5].text_content() if num_cells > 5 else "0"
                                
                                # Procurar a coluna TOTAL (que tem valor €)
                                # É provável que seja a coluna 11 ou 12 (índice 10, 11 ou 12)
                                total_raw = "0"
                                # Tentar diferentes índices para encontrar o valor €
                                for idx in [12, 11, -2, -3]:
                                    if abs(idx) < num_cells:
                                        val = await cells[idx].text_content()
                                        if val and ('€' in val or val.strip().replace(',', '').replace('.', '').isdigit()):
                                            total_raw = val
                                            logger.info(f"    Encontrou total em índice {idx}: '{val}'")
                                            break
                                
                                # Log valores brutos
                                logger.info(f"    Bruto - posto:'{posto[:20] if posto else ''}' data:'{data_trans}' litros:'{litros_raw}' total:'{total_raw}'")
                                
                                # Limpar valores
                                posto = posto.strip() if posto else ""
                                data_trans = data_trans.strip() if data_trans else ""
                                litros_clean = litros_raw.strip().replace(",", ".").replace("L", "").replace(" ", "") if litros_raw else "0"
                                total_clean = total_raw.strip().replace(",", ".").replace("€", "").replace(" ", "") if total_raw else "0"
                                
                                # Validar que são números
                                try:
                                    litros_float = float(litros_clean) if litros_clean else 0
                                    total_float = float(total_clean) if total_clean else 0
                                except ValueError as ve:
                                    logger.warning(f"    ValueError ao converter: litros='{litros_clean}' total='{total_clean}' - {ve}")
                                    litros_float = 0
                                    total_float = 0
                                
                                logger.info(f"    Limpo - litros:{litros_float} total:{total_float}")
                                
                                if total_float > 0:  # Só adicionar se tiver valor
                                    row_data = [data_trans, str(litros_float), str(total_float), posto]
                                    data.append(row_data)
                                    logger.info(f"  ✅ Linha válida: {data_trans}, {litros_float}L, {total_float}€")
                                else:
                                    logger.info(f"    ⚠️ Linha ignorada (total=0)")
                        except Exception as row_err:
                            logger.warning(f"  Erro ao processar linha: {row_err}")
                            continue
                    
                    logger.info(f"✅ Extraídas {len(data)} transações válidas")
                else:
                    logger.warning("⚠️ Tabela não encontrada")
                    
                    # Tentar encontrar mensagem de "sem resultados"
                    no_results = self.page.locator('text="Sem resultados"')
                    if await no_results.count() > 0:
                        logger.info("ℹ️ Nenhum resultado encontrado para o período")
                        
            except Exception as e:
                logger.warning(f"⚠️ Erro ao extrair tabela: {e}")
            
            await self.page.screenshot(path='/tmp/prio_09_final.png')
            
            return {
                "success": True,
                "platform": "prio",
                "data": data,
                "rows_extracted": len(data)
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao extrair dados Prio: {e}")
            import traceback
            traceback.print_exc()
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
