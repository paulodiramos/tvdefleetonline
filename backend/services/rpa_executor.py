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
        "login": "https://www.viaverde.pt/empresas/login",
        "dashboard": "https://www.viaverde.pt/empresas",
        "extratos": "https://www.viaverde.pt/empresas/extratos",
        "movimentos": "https://www.viaverde.pt/empresas/movimentos"
    }
    
    async def login(self, username: str, password: str) -> bool:
        """Fazer login na Via Verde Empresas"""
        try:
            self.log("A aceder à página de login Via Verde...")
            await self.page.goto(self.URLS["login"], wait_until="networkidle")
            await self.screenshot("viaverde_login_page")
            
            # Inserir username
            self.log("A inserir credenciais...")
            username_input = await self.page.wait_for_selector("#username, input[name='username']", timeout=10000)
            await username_input.fill(username)
            
            # Inserir password
            password_input = await self.page.wait_for_selector("#password, input[name='password']", timeout=5000)
            await password_input.fill(password)
            
            # Submeter
            submit_btn = await self.page.wait_for_selector("#kc-login, button[type='submit']", timeout=5000)
            await submit_btn.click()
            await self.page.wait_for_timeout(3000)
            
            await self.screenshot("viaverde_after_login")
            
            # Verificar login
            current_url = self.page.url
            if "login" not in current_url.lower():
                self.log("Login Via Verde bem sucedido!")
                return True
            else:
                self.log("Login Via Verde pode ter falhado", "warning")
                return False
                
        except Exception as e:
            self.log(f"Erro no login Via Verde: {str(e)}", "error")
            await self.screenshot("viaverde_login_error")
            return False
    
    async def extrair_portagens(self, data_inicio: str = None, data_fim: str = None) -> List[Dict]:
        """Extrair movimentos de portagens"""
        try:
            self.log("A aceder à página de movimentos...")
            await self.page.goto(self.URLS["movimentos"], wait_until="networkidle")
            await self.page.wait_for_timeout(2000)
            await self.screenshot("viaverde_movimentos_page")
            
            portagens = []
            
            # Tentar extrair da tabela de movimentos
            try:
                rows = await self.page.query_selector_all("table tbody tr, [class*='movement-row'], [class*='transaction']")
                
                if rows:
                    self.log(f"Encontrados {len(rows)} movimentos")
                    
                    for row in rows:
                        try:
                            cells = await row.query_selector_all("td")
                            if len(cells) >= 3:
                                # Extrair data/hora
                                date_el = cells[0]
                                date_text = await date_el.inner_text() if date_el else ""
                                
                                # Extrair local/descrição
                                desc_el = cells[1] if len(cells) > 1 else None
                                desc_text = await desc_el.inner_text() if desc_el else ""
                                
                                # Extrair valor
                                amount_el = cells[-1]
                                amount_text = await amount_el.inner_text() if amount_el else "0"
                                amount_clean = re.sub(r'[^\d,.]', '', amount_text).replace(',', '.')
                                
                                # Extrair matrícula se disponível
                                matricula = ""
                                for cell in cells:
                                    cell_text = await cell.inner_text()
                                    mat_match = re.search(r'[A-Z]{2}-\d{2}-[A-Z]{2}|\d{2}-[A-Z]{2}-\d{2}', cell_text)
                                    if mat_match:
                                        matricula = mat_match.group()
                                        break
                                
                                portagens.append({
                                    "plataforma": "viaverde",
                                    "tipo": "portagem",
                                    "data_hora": date_text.strip(),
                                    "descricao": desc_text.strip(),
                                    "matricula": matricula,
                                    "valor": float(amount_clean) if amount_clean else 0,
                                    "moeda": "EUR",
                                    "extraido_em": datetime.now(timezone.utc).isoformat()
                                })
                        except Exception as e:
                            self.log(f"Erro ao processar movimento: {e}", "warning")
                else:
                    self.log("Nenhum movimento encontrado na página", "warning")
                    
            except Exception as e:
                self.log(f"Erro na extração de portagens: {e}", "error")
            
            self.dados_extraidos.extend(portagens)
            self.log(f"Total de {len(portagens)} portagens extraídas")
            return portagens
            
        except Exception as e:
            self.log(f"Erro ao extrair portagens Via Verde: {str(e)}", "error")
            await self.screenshot("viaverde_error")
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
