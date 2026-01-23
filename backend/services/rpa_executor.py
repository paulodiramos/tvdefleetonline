"""
Sistema RPA Completo - Extração Automática de Plataformas
Suporta: Uber, Bolt, Via Verde, Prio Combustível, Prio Elétrico

Este módulo contém os scripts de automação com Playwright para cada plataforma.
"""

import asyncio
import logging
import os
import json
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from playwright.async_api import async_playwright, Browser, Page, TimeoutError as PlaywrightTimeout
import base64

logger = logging.getLogger(__name__)

# Diretório para screenshots e downloads
DOWNLOADS_DIR = "/app/backend/rpa_downloads"
SCREENSHOTS_DIR = "/app/backend/rpa_screenshots"

# Criar diretórios se não existirem
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


class RPAExecutor:
    """Executor base para automações RPA"""
    
    def __init__(self, parceiro_id: str, execucao_id: str):
        self.parceiro_id = parceiro_id
        self.execucao_id = execucao_id
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.logs: List[Dict] = []
        self.screenshots: List[str] = []
        self.dados_extraidos: List[Dict] = []
        self.erros: List[str] = []
        
    def log(self, mensagem: str, nivel: str = "info"):
        """Adicionar log da execução"""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "nivel": nivel,
            "mensagem": mensagem
        }
        self.logs.append(entry)
        
        if nivel == "error":
            logger.error(f"[RPA {self.execucao_id}] {mensagem}")
            self.erros.append(mensagem)
        else:
            logger.info(f"[RPA {self.execucao_id}] {mensagem}")
    
    async def screenshot(self, nome: str) -> str:
        """Tirar screenshot e guardar"""
        if self.page:
            filename = f"{self.execucao_id}_{nome}_{datetime.now().strftime('%H%M%S')}.png"
            filepath = os.path.join(SCREENSHOTS_DIR, filename)
            await self.page.screenshot(path=filepath)
            self.screenshots.append(filename)
            self.log(f"Screenshot guardado: {filename}")
            return filename
        return ""
    
    async def iniciar_browser(self, headless: bool = True):
        """Iniciar browser Playwright"""
        self.log("A iniciar browser...")
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=headless,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='pt-PT',
            timezone_id='Europe/Lisbon'
        )
        self.page = await context.new_page()
        self.log("Browser iniciado com sucesso")
    
    async def fechar_browser(self):
        """Fechar browser"""
        if self.browser:
            await self.browser.close()
            self.log("Browser fechado")
    
    def get_resultado(self) -> Dict:
        """Obter resultado da execução"""
        return {
            "logs": self.logs,
            "screenshots": self.screenshots,
            "dados_extraidos": self.dados_extraidos,
            "erros": self.erros,
            "total_registos": len(self.dados_extraidos)
        }


class UberRPA(RPAExecutor):
    """Automação para extração de dados do Uber Driver"""
    
    URLS = {
        "login": "https://auth.uber.com/v2/",
        "dashboard": "https://drivers.uber.com/p3/",
        "earnings": "https://drivers.uber.com/p3/payments/statements",
        "trips": "https://drivers.uber.com/p3/trips"
    }
    
    async def login(self, email: str, password: str) -> bool:
        """Fazer login no Uber"""
        try:
            self.log("A aceder à página de login Uber...")
            await self.page.goto(self.URLS["login"], wait_until="networkidle")
            await self.screenshot("uber_login_page")
            
            # Inserir email
            self.log("A inserir email...")
            email_input = await self.page.wait_for_selector("#useridInput, input[name='email']", timeout=10000)
            await email_input.fill(email)
            
            # Clicar em continuar
            continue_btn = await self.page.wait_for_selector("#forward-button, button[type='submit']", timeout=5000)
            await continue_btn.click()
            await self.page.wait_for_timeout(2000)
            
            # Verificar se pede password
            try:
                password_input = await self.page.wait_for_selector("#password, input[type='password']", timeout=10000)
                self.log("A inserir password...")
                await password_input.fill(password)
                
                # Submeter
                submit_btn = await self.page.wait_for_selector("#forward-button, button[type='submit']", timeout=5000)
                await submit_btn.click()
                await self.page.wait_for_timeout(3000)
                
            except PlaywrightTimeout:
                self.log("Campo de password não encontrado - pode ser 2FA", "warning")
            
            await self.screenshot("uber_after_login")
            
            # Verificar se login foi bem sucedido
            current_url = self.page.url
            if "drivers.uber.com" in current_url or "partner" in current_url:
                self.log("Login Uber bem sucedido!")
                return True
            else:
                self.log(f"Login Uber pode ter falhado. URL atual: {current_url}", "warning")
                return False
                
        except Exception as e:
            self.log(f"Erro no login Uber: {str(e)}", "error")
            await self.screenshot("uber_login_error")
            return False
    
    async def extrair_ganhos_semanal(self, data_inicio: str = None, data_fim: str = None) -> List[Dict]:
        """Extrair ganhos semanais do Uber"""
        try:
            self.log("A aceder à página de ganhos...")
            await self.page.goto(self.URLS["earnings"], wait_until="networkidle")
            await self.page.wait_for_timeout(2000)
            await self.screenshot("uber_earnings_page")
            
            ganhos = []
            
            # Tentar extrair da tabela de pagamentos
            try:
                # Procurar elementos de pagamento/statement
                statements = await self.page.query_selector_all("[data-testid='statement-row'], .statement-row, tr[class*='payment']")
                
                if statements:
                    self.log(f"Encontrados {len(statements)} registos de pagamento")
                    
                    for statement in statements:
                        try:
                            # Extrair data
                            date_el = await statement.query_selector("[data-testid='date'], .date, td:first-child")
                            date_text = await date_el.inner_text() if date_el else ""
                            
                            # Extrair valor
                            amount_el = await statement.query_selector("[data-testid='amount'], .amount, td:last-child")
                            amount_text = await amount_el.inner_text() if amount_el else "0"
                            
                            # Limpar e converter valor
                            amount_clean = re.sub(r'[^\d,.]', '', amount_text).replace(',', '.')
                            
                            ganho = {
                                "plataforma": "uber",
                                "tipo": "ganho_semanal",
                                "data": date_text,
                                "valor_bruto": float(amount_clean) if amount_clean else 0,
                                "moeda": "EUR",
                                "extraido_em": datetime.now(timezone.utc).isoformat()
                            }
                            ganhos.append(ganho)
                            
                        except Exception as e:
                            self.log(f"Erro ao processar registo: {e}", "warning")
                else:
                    # Tentar extrair de elementos visíveis na página
                    self.log("A tentar extração alternativa...")
                    
                    # Procurar valor total na página
                    total_elements = await self.page.query_selector_all("[class*='total'], [class*='earnings'], [class*='amount']")
                    for el in total_elements:
                        text = await el.inner_text()
                        if '€' in text or 'EUR' in text:
                            amount_match = re.search(r'[\d.,]+', text)
                            if amount_match:
                                ganhos.append({
                                    "plataforma": "uber",
                                    "tipo": "ganho_total",
                                    "valor_bruto": float(amount_match.group().replace(',', '.')),
                                    "moeda": "EUR",
                                    "extraido_em": datetime.now(timezone.utc).isoformat()
                                })
                                break
                                
            except Exception as e:
                self.log(f"Erro na extração de ganhos: {e}", "error")
            
            self.dados_extraidos.extend(ganhos)
            self.log(f"Total de {len(ganhos)} registos de ganhos extraídos do Uber")
            return ganhos
            
        except Exception as e:
            self.log(f"Erro ao extrair ganhos Uber: {str(e)}", "error")
            await self.screenshot("uber_earnings_error")
            return []


class BoltRPA(RPAExecutor):
    """Automação para extração de dados do Bolt Fleet"""
    
    URLS = {
        "login": "https://fleets.bolt.eu/login",
        "dashboard": "https://fleets.bolt.eu/",
        "earnings": "https://fleets.bolt.eu/reports",
        "drivers": "https://fleets.bolt.eu/drivers"
    }
    
    async def login(self, email: str, password: str) -> bool:
        """Fazer login no Bolt Fleet"""
        try:
            self.log("A aceder à página de login Bolt...")
            await self.page.goto(self.URLS["login"], wait_until="networkidle")
            await self.screenshot("bolt_login_page")
            
            # Inserir email
            self.log("A inserir credenciais...")
            email_input = await self.page.wait_for_selector("input[name='email'], input[type='email']", timeout=10000)
            await email_input.fill(email)
            
            # Inserir password
            password_input = await self.page.wait_for_selector("input[name='password'], input[type='password']", timeout=5000)
            await password_input.fill(password)
            
            # Submeter
            submit_btn = await self.page.wait_for_selector("button[type='submit']", timeout=5000)
            await submit_btn.click()
            await self.page.wait_for_timeout(3000)
            
            await self.screenshot("bolt_after_login")
            
            # Verificar login
            current_url = self.page.url
            if "login" not in current_url.lower():
                self.log("Login Bolt bem sucedido!")
                return True
            else:
                self.log("Login Bolt pode ter falhado", "warning")
                return False
                
        except Exception as e:
            self.log(f"Erro no login Bolt: {str(e)}", "error")
            await self.screenshot("bolt_login_error")
            return False
    
    async def extrair_ganhos_semanal(self, data_inicio: str = None, data_fim: str = None) -> List[Dict]:
        """Extrair ganhos semanais do Bolt"""
        try:
            self.log("A aceder à página de relatórios...")
            await self.page.goto(self.URLS["earnings"], wait_until="networkidle")
            await self.page.wait_for_timeout(2000)
            await self.screenshot("bolt_reports_page")
            
            ganhos = []
            
            # Tentar extrair da tabela
            try:
                rows = await self.page.query_selector_all("table tbody tr, [class*='report-row']")
                
                if rows:
                    self.log(f"Encontradas {len(rows)} linhas de relatório")
                    
                    for row in rows:
                        try:
                            cells = await row.query_selector_all("td")
                            if len(cells) >= 2:
                                date_text = await cells[0].inner_text() if cells else ""
                                amount_text = await cells[-1].inner_text() if cells else "0"
                                
                                amount_clean = re.sub(r'[^\d,.]', '', amount_text).replace(',', '.')
                                
                                ganhos.append({
                                    "plataforma": "bolt",
                                    "tipo": "ganho_semanal",
                                    "data": date_text.strip(),
                                    "valor_bruto": float(amount_clean) if amount_clean else 0,
                                    "moeda": "EUR",
                                    "extraido_em": datetime.now(timezone.utc).isoformat()
                                })
                        except Exception as e:
                            self.log(f"Erro ao processar linha: {e}", "warning")
                else:
                    # Extração alternativa
                    self.log("A tentar extração alternativa de valores...")
                    page_text = await self.page.inner_text("body")
                    
                    # Procurar padrões de valores monetários
                    amounts = re.findall(r'€\s*([\d.,]+)|(\d+[.,]\d{2})\s*€', page_text)
                    for match in amounts[:5]:  # Limitar a 5
                        value = match[0] or match[1]
                        if value:
                            ganhos.append({
                                "plataforma": "bolt",
                                "tipo": "valor_extraido",
                                "valor_bruto": float(value.replace(',', '.')),
                                "moeda": "EUR",
                                "extraido_em": datetime.now(timezone.utc).isoformat()
                            })
                            
            except Exception as e:
                self.log(f"Erro na extração de ganhos Bolt: {e}", "error")
            
            self.dados_extraidos.extend(ganhos)
            self.log(f"Total de {len(ganhos)} registos extraídos do Bolt")
            return ganhos
            
        except Exception as e:
            self.log(f"Erro ao extrair ganhos Bolt: {str(e)}", "error")
            await self.screenshot("bolt_earnings_error")
            return []


class ViaVerdeRPA(RPAExecutor):
    """Automação para extração de dados da Via Verde Empresas"""
    
    URLS = {
        "home": "https://www.viaverde.pt/empresas",
        "area_reservada": "https://www.viaverde.pt/area-reservada",
        "extratos": "https://www.viaverde.pt/area-reservada/extratos-e-movimentos",
        "movimentos": "https://www.viaverde.pt/area-reservada/consultar-extratos-e-movimentos"
    }
    
    async def login(self, username: str, password: str) -> bool:
        """Fazer login na Via Verde Empresas via popup"""
        try:
            self.log("A aceder à página Via Verde Empresas...")
            await self.page.goto(self.URLS["home"], wait_until="networkidle")
            await self.page.wait_for_timeout(2000)
            await self.screenshot("viaverde_home")
            
            # Clicar no botão de Login para abrir o popup
            self.log("A abrir popup de login...")
            try:
                # Procurar botão de login no header
                login_btn = await self.page.wait_for_selector(
                    "a[href*='login'], button:has-text('Login'), .login-btn, [data-testid='login']",
                    timeout=5000
                )
                await login_btn.click()
                await self.page.wait_for_timeout(1500)
            except:
                self.log("Botão de login não encontrado, verificando se popup já está aberto...")
            
            await self.screenshot("viaverde_popup_open")
            
            # Aguardar pelo popup/modal de login "A Minha Via Verde"
            self.log("A aguardar popup de login...")
            
            # Tentar diferentes seletores para o campo de email
            email_selectors = [
                "input[type='email']",
                "input[name='email']",
                "input[placeholder*='Email']",
                "input[placeholder*='email']",
                "#email",
                ".modal input[type='text']:first-of-type",
                "[class*='modal'] input:first-of-type"
            ]
            
            email_input = None
            for selector in email_selectors:
                try:
                    email_input = await self.page.wait_for_selector(selector, timeout=3000)
                    if email_input:
                        self.log(f"Campo email encontrado com seletor: {selector}")
                        break
                except:
                    continue
            
            if not email_input:
                self.log("Campo de email não encontrado no popup", "error")
                await self.screenshot("viaverde_no_email_field")
                return False
            
            # Preencher email
            self.log("A inserir email...")
            await email_input.fill(username)
            await self.page.wait_for_timeout(500)
            
            # Procurar campo de password
            password_selectors = [
                "input[type='password']",
                "input[name='password']",
                "input[placeholder*='Palavra-passe']",
                "input[placeholder*='palavra-passe']",
                "input[placeholder*='Password']",
                "#password"
            ]
            
            password_input = None
            for selector in password_selectors:
                try:
                    password_input = await self.page.wait_for_selector(selector, timeout=3000)
                    if password_input:
                        self.log(f"Campo password encontrado com seletor: {selector}")
                        break
                except:
                    continue
            
            if not password_input:
                self.log("Campo de password não encontrado", "error")
                await self.screenshot("viaverde_no_password_field")
                return False
            
            # Preencher password
            self.log("A inserir password...")
            await password_input.fill(password)
            await self.page.wait_for_timeout(500)
            
            await self.screenshot("viaverde_credentials_filled")
            
            # Clicar no botão de Login dentro do popup
            submit_selectors = [
                "button:has-text('Login')",
                "button[type='submit']",
                ".modal button.btn-primary",
                "[class*='modal'] button:has-text('Login')",
                "form button[type='submit']",
                ".login-form button"
            ]
            
            submit_btn = None
            for selector in submit_selectors:
                try:
                    submit_btn = await self.page.wait_for_selector(selector, timeout=2000)
                    if submit_btn:
                        self.log(f"Botão submit encontrado com seletor: {selector}")
                        break
                except:
                    continue
            
            if submit_btn:
                await submit_btn.click()
                self.log("A submeter login...")
            else:
                # Tentar pressionar Enter
                self.log("Botão não encontrado, a tentar Enter...")
                await password_input.press("Enter")
            
            await self.page.wait_for_timeout(4000)
            await self.screenshot("viaverde_after_login")
            
            # Verificar login - procurar elementos que indicam sessão iniciada
            current_url = self.page.url
            page_content = await self.page.content()
            
            # Verificar se login foi bem sucedido
            login_indicators = [
                "área reservada" in page_content.lower(),
                "minha conta" in page_content.lower(),
                "sair" in page_content.lower(),
                "logout" in page_content.lower(),
                "area-reservada" in current_url,
                "dashboard" in current_url
            ]
            
            if any(login_indicators):
                self.log("Login Via Verde bem sucedido!")
                return True
            else:
                # Verificar se há mensagem de erro
                error_selectors = [".error", ".alert-danger", "[class*='error']", "[class*='invalid']"]
                for selector in error_selectors:
                    try:
                        error_el = await self.page.query_selector(selector)
                        if error_el:
                            error_text = await error_el.inner_text()
                            self.log(f"Erro de login: {error_text}", "error")
                            break
                    except:
                        continue
                
                self.log(f"Login pode ter falhado. URL atual: {current_url}", "warning")
                return False
                
        except Exception as e:
            self.log(f"Erro no login Via Verde: {str(e)}", "error")
            await self.screenshot("viaverde_login_error")
            return False
    
    async def extrair_portagens(self, data_inicio: str = None, data_fim: str = None) -> List[Dict]:
        """Extrair movimentos de portagens com data, hora, local e valor"""
        try:
            self.log("A aceder à página de extratos e movimentos...")
            
            # Tentar navegar para a página de movimentos
            try:
                await self.page.goto(self.URLS["movimentos"], wait_until="networkidle")
            except:
                await self.page.goto(self.URLS["extratos"], wait_until="networkidle")
            
            await self.page.wait_for_timeout(3000)
            await self.screenshot("viaverde_movimentos_page")
            
            portagens = []
            
            # Aplicar filtros de data se fornecidos
            if data_inicio or data_fim:
                self.log("A aplicar filtros de data...")
                try:
                    if data_inicio:
                        date_from = await self.page.query_selector("input[name*='data_inicio'], input[type='date']:first-of-type, #dataInicio")
                        if date_from:
                            await date_from.fill(data_inicio)
                    
                    if data_fim:
                        date_to = await self.page.query_selector("input[name*='data_fim'], input[type='date']:last-of-type, #dataFim")
                        if date_to:
                            await date_to.fill(data_fim)
                    
                    # Clicar em pesquisar/filtrar
                    filter_btn = await self.page.query_selector("button:has-text('Pesquisar'), button:has-text('Filtrar'), button[type='submit']")
                    if filter_btn:
                        await filter_btn.click()
                        await self.page.wait_for_timeout(2000)
                except Exception as e:
                    self.log(f"Erro ao aplicar filtros: {e}", "warning")
            
            # Extrair da tabela de movimentos
            self.log("A extrair movimentos da tabela...")
            
            # Procurar tabela de movimentos
            table_selectors = [
                "table tbody tr",
                ".movimento-row",
                ".transaction-row",
                "[class*='movement'] tr",
                ".table-movimentos tr",
                ".lista-movimentos .item"
            ]
            
            rows = []
            for selector in table_selectors:
                try:
                    rows = await self.page.query_selector_all(selector)
                    if rows and len(rows) > 0:
                        self.log(f"Tabela encontrada com seletor: {selector} ({len(rows)} linhas)")
                        break
                except:
                    continue
            
            if rows:
                self.log(f"A processar {len(rows)} movimentos...")
                
                for idx, row in enumerate(rows):
                    try:
                        # Extrair todo o texto da linha
                        row_text = await row.inner_text()
                        
                        # Ignorar linhas de cabeçalho ou vazias
                        if not row_text.strip() or "data" in row_text.lower() and "hora" in row_text.lower():
                            continue
                        
                        cells = await row.query_selector_all("td, .cell, [class*='col']")
                        
                        if len(cells) >= 2:
                            # Extrair data e hora
                            date_text = ""
                            time_text = ""
                            
                            # Primeira célula geralmente tem data/hora
                            first_cell = await cells[0].inner_text() if cells else ""
                            
                            # Tentar extrair data no formato DD/MM/YYYY ou YYYY-MM-DD
                            date_match = re.search(r'(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})', first_cell)
                            if date_match:
                                date_text = date_match.group(1)
                            
                            # Tentar extrair hora no formato HH:MM
                            time_match = re.search(r'(\d{2}:\d{2})', first_cell)
                            if time_match:
                                time_text = time_match.group(1)
                            
                            # Se não encontrou na primeira célula, procurar nas outras
                            if not date_text:
                                for cell in cells:
                                    cell_text = await cell.inner_text()
                                    date_match = re.search(r'(\d{2}[/-]\d{2}[/-]\d{4})', cell_text)
                                    if date_match:
                                        date_text = date_match.group(1)
                                        time_match = re.search(r'(\d{2}:\d{2})', cell_text)
                                        if time_match:
                                            time_text = time_match.group(1)
                                        break
                            
                            # Extrair local/descrição (geralmente segunda ou terceira célula)
                            desc_text = ""
                            for i, cell in enumerate(cells):
                                if i > 0:  # Pular primeira célula (data)
                                    cell_text = await cell.inner_text()
                                    # Verificar se parece ser uma descrição (não é só números)
                                    if cell_text and not re.match(r'^[\d,.\s€]+$', cell_text.strip()):
                                        desc_text = cell_text.strip()
                                        break
                            
                            # Extrair matrícula
                            matricula = ""
                            for cell in cells:
                                cell_text = await cell.inner_text()
                                # Formatos de matrícula portuguesa
                                mat_patterns = [
                                    r'[A-Z]{2}-\d{2}-[A-Z]{2}',  # AA-00-AA
                                    r'\d{2}-[A-Z]{2}-\d{2}',     # 00-AA-00
                                    r'\d{2}-\d{2}-[A-Z]{2}',     # 00-00-AA
                                    r'[A-Z]{2}-\d{2}-\d{2}'      # AA-00-00
                                ]
                                for pattern in mat_patterns:
                                    mat_match = re.search(pattern, cell_text)
                                    if mat_match:
                                        matricula = mat_match.group()
                                        break
                                if matricula:
                                    break
                            
                            # Extrair valor (última célula geralmente)
                            valor = 0
                            for cell in reversed(cells):
                                cell_text = await cell.inner_text()
                                # Procurar valores monetários
                                valor_match = re.search(r'([\d.,]+)\s*€|€\s*([\d.,]+)', cell_text)
                                if valor_match:
                                    valor_str = valor_match.group(1) or valor_match.group(2)
                                    valor_str = valor_str.replace('.', '').replace(',', '.')
                                    try:
                                        valor = float(valor_str)
                                        break
                                    except:
                                        pass
                            
                            # Criar registo de portagem
                            if date_text or valor > 0:  # Só adicionar se tiver data ou valor
                                portagem = {
                                    "plataforma": "viaverde",
                                    "tipo": "portagem",
                                    "data": date_text,
                                    "hora": time_text,
                                    "data_hora": f"{date_text} {time_text}".strip(),
                                    "descricao": desc_text,
                                    "local": desc_text,  # Alias
                                    "matricula": matricula,
                                    "valor": valor,
                                    "moeda": "EUR",
                                    "linha_original": row_text[:200],  # Para debug
                                    "extraido_em": datetime.now(timezone.utc).isoformat()
                                }
                                portagens.append(portagem)
                                self.log(f"  → {date_text} {time_text} | {matricula} | {desc_text[:30]}... | {valor}€")
                                
                    except Exception as e:
                        self.log(f"Erro ao processar linha {idx}: {e}", "warning")
            else:
                self.log("Nenhuma tabela de movimentos encontrada", "warning")
                
                # Tentar extração alternativa do conteúdo da página
                self.log("A tentar extração alternativa...")
                page_text = await self.page.inner_text("body")
                
                # Procurar padrões de movimentos no texto
                # Formato típico: data hora local matrícula valor
                movimento_pattern = r'(\d{2}[/-]\d{2}[/-]\d{4})\s+(\d{2}:\d{2})?\s*([A-Za-záéíóúãõç\s]+?)\s+([A-Z]{2}-\d{2}-[A-Z]{2}|\d{2}-[A-Z]{2}-\d{2})?\s*([\d.,]+)\s*€'
                
                matches = re.findall(movimento_pattern, page_text)
                for match in matches[:50]:  # Limitar a 50
                    portagens.append({
                        "plataforma": "viaverde",
                        "tipo": "portagem",
                        "data": match[0],
                        "hora": match[1] or "",
                        "data_hora": f"{match[0]} {match[1]}".strip(),
                        "descricao": match[2].strip(),
                        "local": match[2].strip(),
                        "matricula": match[3] or "",
                        "valor": float(match[4].replace('.', '').replace(',', '.')) if match[4] else 0,
                        "moeda": "EUR",
                        "extraido_em": datetime.now(timezone.utc).isoformat()
                    })
            
            self.dados_extraidos.extend(portagens)
            self.log(f"✅ Total de {len(portagens)} portagens extraídas")
            
            await self.screenshot("viaverde_extraction_complete")
            
            return portagens
            
        except Exception as e:
            self.log(f"Erro ao extrair portagens Via Verde: {str(e)}", "error")
            await self.screenshot("viaverde_error")
            return []
    
    async def extrair_consumos_por_matricula(self) -> List[Dict]:
        """Extrair consumos agrupados por matrícula/veículo"""
        try:
            self.log("A extrair consumos por matrícula...")
            
            # Primeiro extrair todas as portagens
            portagens = await self.extrair_portagens()
            
            # Agrupar por matrícula
            consumos_por_matricula = {}
            for p in portagens:
                mat = p.get("matricula", "SEM_MATRICULA")
                if mat not in consumos_por_matricula:
                    consumos_por_matricula[mat] = {
                        "matricula": mat,
                        "total_valor": 0,
                        "total_movimentos": 0,
                        "movimentos": []
                    }
                consumos_por_matricula[mat]["total_valor"] += p.get("valor", 0)
                consumos_por_matricula[mat]["total_movimentos"] += 1
                consumos_por_matricula[mat]["movimentos"].append(p)
            
            resultado = list(consumos_por_matricula.values())
            self.log(f"✅ Consumos agrupados por {len(resultado)} matrículas")
            
            return resultado
            
        except Exception as e:
            self.log(f"Erro ao extrair consumos por matrícula: {str(e)}", "error")
            return []


class PrioRPA(RPAExecutor):
    """Automação para extração de dados da Prio (Combustível e Elétrico)"""
    
    URLS = {
        "login": "https://areaprivada.prio.pt/login",
        "dashboard": "https://areaprivada.prio.pt/",
        "consumos": "https://areaprivada.prio.pt/consumos",
        "faturas": "https://areaprivada.prio.pt/faturas"
    }
    
    async def login(self, email: str, password: str) -> bool:
        """Fazer login na área privada Prio"""
        try:
            self.log("A aceder à página de login Prio...")
            await self.page.goto(self.URLS["login"], wait_until="networkidle")
            await self.screenshot("prio_login_page")
            
            # Inserir email
            self.log("A inserir credenciais...")
            email_input = await self.page.wait_for_selector("input[type='email'], input[name='email'], #email", timeout=10000)
            await email_input.fill(email)
            
            # Inserir password
            password_input = await self.page.wait_for_selector("input[type='password'], input[name='password'], #password", timeout=5000)
            await password_input.fill(password)
            
            # Submeter
            submit_btn = await self.page.wait_for_selector("button[type='submit'], input[type='submit']", timeout=5000)
            await submit_btn.click()
            await self.page.wait_for_timeout(3000)
            
            await self.screenshot("prio_after_login")
            
            # Verificar login
            current_url = self.page.url
            if "login" not in current_url.lower():
                self.log("Login Prio bem sucedido!")
                return True
            else:
                self.log("Login Prio pode ter falhado", "warning")
                return False
                
        except Exception as e:
            self.log(f"Erro no login Prio: {str(e)}", "error")
            await self.screenshot("prio_login_error")
            return False
    
    async def extrair_consumos(self, tipo: str = "todos") -> List[Dict]:
        """Extrair consumos de combustível e/ou elétrico"""
        try:
            self.log("A aceder à página de consumos...")
            await self.page.goto(self.URLS["consumos"], wait_until="networkidle")
            await self.page.wait_for_timeout(2000)
            await self.screenshot("prio_consumos_page")
            
            consumos = []
            
            # Tentar extrair da tabela de consumos
            try:
                rows = await self.page.query_selector_all("table tbody tr, [class*='consumo'], [class*='transaction']")
                
                if rows:
                    self.log(f"Encontrados {len(rows)} consumos")
                    
                    for row in rows:
                        try:
                            cells = await row.query_selector_all("td")
                            if len(cells) >= 3:
                                row_text = await row.inner_text()
                                
                                # Determinar tipo (combustível ou elétrico)
                                tipo_consumo = "combustivel"
                                if "kwh" in row_text.lower() or "elétrico" in row_text.lower() or "eletrico" in row_text.lower():
                                    tipo_consumo = "eletrico"
                                
                                # Extrair data/hora
                                date_text = await cells[0].inner_text() if cells else ""
                                
                                # Extrair local/posto
                                local_text = ""
                                for cell in cells[1:-1]:
                                    text = await cell.inner_text()
                                    if not re.match(r'^[\d.,]+$', text.strip()):
                                        local_text = text.strip()
                                        break
                                
                                # Extrair quantidade (litros ou kWh)
                                quantidade = 0
                                for cell in cells:
                                    text = await cell.inner_text()
                                    qty_match = re.search(r'([\d.,]+)\s*(L|l|litros?|kWh|kwh)?', text)
                                    if qty_match:
                                        quantidade = float(qty_match.group(1).replace(',', '.'))
                                        if qty_match.group(2) and 'kw' in qty_match.group(2).lower():
                                            tipo_consumo = "eletrico"
                                        break
                                
                                # Extrair valor
                                amount_el = cells[-1]
                                amount_text = await amount_el.inner_text() if amount_el else "0"
                                amount_clean = re.sub(r'[^\d,.]', '', amount_text).replace(',', '.')
                                
                                # Extrair matrícula
                                matricula = ""
                                for cell in cells:
                                    cell_text = await cell.inner_text()
                                    mat_match = re.search(r'[A-Z]{2}-\d{2}-[A-Z]{2}|\d{2}-[A-Z]{2}-\d{2}', cell_text)
                                    if mat_match:
                                        matricula = mat_match.group()
                                        break
                                
                                consumo = {
                                    "plataforma": "prio",
                                    "tipo": tipo_consumo,
                                    "data_hora": date_text.strip(),
                                    "local": local_text,
                                    "matricula": matricula,
                                    "quantidade": quantidade,
                                    "unidade": "kWh" if tipo_consumo == "eletrico" else "L",
                                    "valor": float(amount_clean) if amount_clean else 0,
                                    "moeda": "EUR",
                                    "extraido_em": datetime.now(timezone.utc).isoformat()
                                }
                                
                                # Filtrar por tipo se especificado
                                if tipo == "todos" or tipo == tipo_consumo:
                                    consumos.append(consumo)
                                    
                        except Exception as e:
                            self.log(f"Erro ao processar consumo: {e}", "warning")
                else:
                    self.log("Nenhum consumo encontrado na página", "warning")
                    
            except Exception as e:
                self.log(f"Erro na extração de consumos: {e}", "error")
            
            self.dados_extraidos.extend(consumos)
            self.log(f"Total de {len(consumos)} consumos extraídos")
            return consumos
            
        except Exception as e:
            self.log(f"Erro ao extrair consumos Prio: {str(e)}", "error")
            await self.screenshot("prio_error")
            return []


# Função principal para executar automação
async def executar_automacao(
    plataforma: str,
    parceiro_id: str,
    execucao_id: str,
    credenciais: Dict[str, str],
    tipo_extracao: str = "ganhos",
    data_inicio: str = None,
    data_fim: str = None
) -> Dict:
    """
    Executar automação para uma plataforma específica
    
    Args:
        plataforma: uber, bolt, viaverde, prio
        parceiro_id: ID do parceiro
        execucao_id: ID único desta execução
        credenciais: {email, password} ou {username, password}
        tipo_extracao: ganhos, portagens, combustivel, eletrico, todos
        data_inicio: Data início do período (opcional)
        data_fim: Data fim do período (opcional)
    
    Returns:
        Dict com logs, screenshots, dados_extraidos, erros
    """
    
    executor = None
    
    try:
        # Selecionar executor baseado na plataforma
        if plataforma == "uber":
            executor = UberRPA(parceiro_id, execucao_id)
        elif plataforma == "bolt":
            executor = BoltRPA(parceiro_id, execucao_id)
        elif plataforma == "viaverde":
            executor = ViaVerdeRPA(parceiro_id, execucao_id)
        elif plataforma == "prio":
            executor = PrioRPA(parceiro_id, execucao_id)
        else:
            return {"error": f"Plataforma não suportada: {plataforma}"}
        
        # Iniciar browser
        await executor.iniciar_browser(headless=True)
        
        # Fazer login
        email = credenciais.get("email") or credenciais.get("username", "")
        password = credenciais.get("password", "")
        
        login_ok = await executor.login(email, password)
        
        if not login_ok:
            executor.log("Login falhou - verificar credenciais", "error")
            return executor.get_resultado()
        
        # Executar extração baseada no tipo
        if plataforma in ["uber", "bolt"]:
            await executor.extrair_ganhos_semanal(data_inicio, data_fim)
        elif plataforma == "viaverde":
            await executor.extrair_portagens(data_inicio, data_fim)
        elif plataforma == "prio":
            await executor.extrair_consumos(tipo_extracao)
        
        return executor.get_resultado()
        
    except Exception as e:
        error_msg = f"Erro fatal na execução: {str(e)}"
        logger.error(error_msg)
        if executor:
            executor.log(error_msg, "error")
            return executor.get_resultado()
        return {"error": error_msg}
        
    finally:
        if executor:
            await executor.fechar_browser()
