"""
Serviço de Browser Interativo para Login Prio
Permite ao utilizador fazer login manual (com SMS 2FA) e depois extrai dados automaticamente
Utiliza sessão persistente de 30 dias para evitar login repetido
"""
import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
import re

logger = logging.getLogger(__name__)

# Configurar Playwright
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'

# Directório persistente para sessões Prio (sobrevive a restarts)
PRIO_SESSIONS_DIR = "/app/data/prio_sessions"


class BrowserInterativoPrio:
    """Browser Playwright com interface interativa para Prio - Sessão persistente de 30 dias"""
    
    def __init__(self, parceiro_id: str):
        self.parceiro_id = parceiro_id
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.ativo = False
        self.ultimo_screenshot = None
        # Directório persistente para guardar toda a sessão do browser (cookies, localStorage, etc.)
        self.user_data_dir = os.path.join(PRIO_SESSIONS_DIR, f"parceiro_{parceiro_id}")
        self.download_path = f"/tmp/prio_downloads_{parceiro_id}"
        
    async def iniciar(self, verificar_sessao_existente: bool = False):
        """
        Iniciar browser com contexto persistente (sessão de 30 dias)
        
        Args:
            verificar_sessao_existente: Se True, verifica se já está logado antes de retornar
        """
        from playwright.async_api import async_playwright
        
        # Criar directórios necessários
        os.makedirs(self.download_path, exist_ok=True)
        os.makedirs(self.user_data_dir, exist_ok=True)
        
        self.playwright = await async_playwright().start()
        
        # Usar launch_persistent_context para manter sessão entre utilizações
        # Isto guarda cookies, localStorage, sessionStorage, IndexedDB - tudo!
        logger.info(f"Iniciando browser Prio com sessão persistente: {self.user_data_dir}")
        
        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=self.user_data_dir,
            headless=True,
            viewport={"width": 1280, "height": 800},
            accept_downloads=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            locale='pt-PT',
            timezone_id='Europe/Lisbon',
            ignore_https_errors=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,800'
            ]
        )
        
        # Anti-detecção
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        """)
        
        # Usar página existente ou criar nova
        if self.context.pages:
            self.page = self.context.pages[0]
        else:
            self.page = await self.context.new_page()
        
        self.ativo = True
        
        # Se pedido, verificar se já tem sessão válida navegando para página protegida
        if verificar_sessao_existente:
            logger.info("Verificando sessão existente...")
            await self._verificar_e_restaurar_sessao()
        
        logger.info(f"Browser interativo Prio iniciado para parceiro {self.parceiro_id} (sessão persistente)")
        return True
    
    async def _verificar_e_restaurar_sessao(self):
        """
        Verifica se há sessão válida.
        Primeiro verifica a URL actual, só navega se necessário.
        """
        try:
            current_url = self.page.url if self.page else ""
            logger.info(f"🔍 Verificando sessão Prio. URL actual: {current_url}")
            
            # Se já estamos numa página válida da Prio (não é login), a sessão está OK
            if current_url and 'myprio.com' in current_url and 'Login' not in current_url and 'login' not in current_url:
                logger.info(f"✅ Sessão Prio válida! Já estamos em: {current_url}")
                return True
            
            # Se estamos na página de login ou URL vazia, verificar navegando para Home
            logger.info(f"📍 Navegando para Home para verificar sessão...")
            await self.page.goto("https://myprio.com/Home/Home", wait_until="commit", timeout=20000)
            await asyncio.sleep(2)
            
            current_url = self.page.url
            
            # Se não redirecionou para login, a sessão está válida
            if 'Login' not in current_url and 'login' not in current_url:
                logger.info(f"✅ Sessão Prio válida! URL: {current_url}")
                return True
            else:
                logger.info(f"⚠️ Sessão Prio expirada. Redirecionado para: {current_url}")
                return False
                
        except Exception as e:
            logger.warning(f"Erro ao verificar sessão: {e}")
            return False
        
    async def navegar(self, url: str):
        """Navegar para URL"""
        if not self.page:
            return False
        try:
            # Usar 'commit' que é mais tolerante que 'domcontentloaded'
            await self.page.goto(url, wait_until="commit", timeout=30000)
        except Exception as e:
            # Se falhar, tentar sem wait_until
            logger.warning(f"Navegação falhou com wait_until, tentando sem: {e}")
            try:
                await self.page.goto(url, timeout=30000)
            except Exception as e2:
                logger.error(f"Navegação falhou completamente: {e2}")
                return False
        await asyncio.sleep(2)
        return True
        
    async def screenshot(self) -> Optional[str]:
        """Capturar screenshot como base64"""
        if not self.page:
            return None
        try:
            screenshot_bytes = await self.page.screenshot(type="jpeg", quality=50)
            self.ultimo_screenshot = base64.b64encode(screenshot_bytes).decode('utf-8')
            return self.ultimo_screenshot
        except Exception as e:
            logger.error(f"Erro no screenshot Prio: {e}")
            return None
            
    async def clicar(self, x: int, y: int):
        """Clicar numa posição"""
        if not self.page:
            return False
        try:
            await self.page.mouse.click(x, y)
            await asyncio.sleep(0.5)
            return True
        except Exception as e:
            logger.error(f"Erro ao clicar: {e}")
            return False
            
    async def digitar(self, texto: str):
        """Digitar texto"""
        if not self.page:
            return False
        try:
            await self.page.keyboard.type(texto)
            await asyncio.sleep(0.3)
            return True
        except Exception as e:
            logger.error(f"Erro ao digitar: {e}")
            return False
            
    async def tecla(self, tecla: str):
        """Pressionar tecla especial"""
        if not self.page:
            return False
        try:
            await self.page.keyboard.press(tecla)
            await asyncio.sleep(0.3)
            return True
        except Exception as e:
            logger.error(f"Erro na tecla: {e}")
            return False
    
    async def preencher_email(self, email: str) -> Dict:
        """Preencher campo de email/utilizador no formulário de login Prio"""
        if not self.page:
            return {"sucesso": False, "erro": "Browser não iniciado"}
        
        try:
            # Selectores possíveis para o campo de utilizador no Prio
            selectores = [
                'input[type="text"]',
                'input[name*="user"]',
                'input[id*="user"]',
                'input[name*="email"]',
                'input[id*="email"]',
                'input[placeholder*="tilizador"]',
                'input[placeholder*="mail"]',
                'input.form-control:first-of-type'
            ]
            
            for selector in selectores:
                try:
                    campo = self.page.locator(selector).first
                    if await campo.count() > 0 and await campo.is_visible():
                        await campo.click()
                        await asyncio.sleep(0.3)
                        # Limpar campo existente
                        await campo.fill('')
                        await asyncio.sleep(0.2)
                        await campo.fill(email)
                        await asyncio.sleep(0.3)
                        logger.info(f"Email/utilizador Prio preenchido: {email}")
                        return {"sucesso": True}
                except Exception as e:
                    continue
            
            return {"sucesso": False, "erro": "Campo de utilizador não encontrado"}
            
        except Exception as e:
            logger.error(f"Erro ao preencher email Prio: {e}")
            return {"sucesso": False, "erro": str(e)}
    
    async def preencher_password(self, password: str) -> Dict:
        """Preencher campo de password no formulário de login Prio"""
        if not self.page:
            return {"sucesso": False, "erro": "Browser não iniciado"}
        
        try:
            # Selectores possíveis para o campo de password no Prio
            selectores = [
                'input[type="password"]',
                'input[name*="pass"]',
                'input[id*="pass"]',
                'input[placeholder*="assword"]',
                'input[placeholder*="alavra"]'
            ]
            
            for selector in selectores:
                try:
                    campo = self.page.locator(selector).first
                    if await campo.count() > 0 and await campo.is_visible():
                        await campo.click()
                        await asyncio.sleep(0.3)
                        # Limpar campo existente
                        await campo.fill('')
                        await asyncio.sleep(0.2)
                        await campo.fill(password)
                        await asyncio.sleep(0.3)
                        logger.info("Password Prio preenchida")
                        return {"sucesso": True}
                except Exception as e:
                    continue
            
            return {"sucesso": False, "erro": "Campo de password não encontrado"}
            
        except Exception as e:
            logger.error(f"Erro ao preencher password Prio: {e}")
            return {"sucesso": False, "erro": str(e)}
    
    async def preencher_sms(self, codigo: str) -> Dict:
        """
        Preencher código SMS no formulário de verificação Prio.
        Suporta tanto campos únicos como múltiplas caixas (uma por dígito).
        OPTIMIZADO para velocidade.
        """
        if not self.page:
            return {"sucesso": False, "erro": "Browser não iniciado"}
        
        try:
            logger.info(f"🔐 Preenchendo código SMS: {codigo}")
            codigo = codigo.strip()
            
            # Método 1: Múltiplas caixas OTP (mais rápido com JavaScript)
            otp_filled = await self.page.evaluate(f'''() => {{
                // Procurar inputs com maxlength=1 (típico de OTP)
                const inputs = document.querySelectorAll('input[maxlength="1"]');
                if (inputs.length >= 4 && inputs.length <= 8) {{
                    const codigo = "{codigo}";
                    for (let i = 0; i < Math.min(codigo.length, inputs.length); i++) {{
                        inputs[i].value = codigo[i];
                        inputs[i].dispatchEvent(new Event('input', {{ bubbles: true }}));
                        inputs[i].dispatchEvent(new Event('change', {{ bubbles: true }}));
                    }}
                    return true;
                }}
                return false;
            }}''')
            
            if otp_filled:
                logger.info(f"✅ Código SMS preenchido via JavaScript (rápido)")
                return {"sucesso": True}
            
            # Método 2: Campo único (também via JavaScript para velocidade)
            single_filled = await self.page.evaluate(f'''() => {{
                // Procurar campo de código único
                const selectors = [
                    'input[name*="code"]', 'input[name*="sms"]', 'input[name*="otp"]',
                    'input[placeholder*="código"]', 'input[placeholder*="SMS"]',
                    'input[maxlength="6"]', 'input[maxlength="4"]'
                ];
                for (const sel of selectors) {{
                    const input = document.querySelector(sel);
                    if (input && input.offsetParent !== null) {{
                        input.focus();
                        input.value = "{codigo}";
                        input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        return true;
                    }}
                }}
                return false;
            }}''')
            
            if single_filled:
                logger.info(f"✅ Código SMS preenchido em campo único (rápido)")
                return {"sucesso": True}
            
            # Método 3: Fallback - digitação via teclado (mais lento mas mais compatível)
            logger.info("⚠️ Usando fallback: digitação via teclado")
            await self.page.keyboard.type(codigo, delay=30)  # Reduzido de 100ms para 30ms
            logger.info(f"✅ Código SMS digitado via teclado")
            return {"sucesso": True}
            
        except Exception as e:
            logger.error(f"❌ Erro ao preencher SMS Prio: {e}")
            return {"sucesso": False, "erro": str(e)}
    
    async def clicar_iniciar_sessao(self) -> Dict:
        """Clicar no botão 'Iniciar Sessão' automaticamente"""
        if not self.page:
            return {"sucesso": False, "erro": "Browser não iniciado"}
        
        try:
            # Selectores possíveis para o botão de login
            selectores = [
                'button:has-text("INICIAR SESSÃO")',
                'button:has-text("Iniciar Sessão")',
                'button:has-text("Iniciar sessão")',
                'button:has-text("Login")',
                'button:has-text("Entrar")',
                'input[type="submit"]',
                'button[type="submit"]',
                '.btn-primary',
                'button.btn',
                'a:has-text("INICIAR SESSÃO")'
            ]
            
            for selector in selectores:
                try:
                    botao = self.page.locator(selector).first
                    if await botao.count() > 0 and await botao.is_visible():
                        await botao.click()
                        await asyncio.sleep(2)
                        logger.info("Botão 'Iniciar Sessão' clicado")
                        return {"sucesso": True}
                except Exception as e:
                    continue
            
            return {"sucesso": False, "erro": "Botão 'Iniciar Sessão' não encontrado"}
            
        except Exception as e:
            logger.error(f"Erro ao clicar iniciar sessão Prio: {e}")
            return {"sucesso": False, "erro": str(e)}
    
    async def verificar_login(self) -> Dict:
        """Verificar se está logado na Prio"""
        if not self.page:
            return {"logado": False, "erro": "Browser não iniciado"}
        
        try:
            current_url = self.page.url
            
            # Se estiver na página de login, não está logado
            if 'Login' in current_url or 'login' in current_url.lower():
                return {"logado": False, "pagina": "login"}
            
            # Se está na página Home/Home, está logado (página protegida)
            if '/Home/Home' in current_url or '/Home' in current_url:
                return {"logado": True, "pagina": current_url}
            
            # Se está em páginas de transações, está logado
            if '/Transactions' in current_url or '/transactions' in current_url.lower():
                return {"logado": True, "pagina": current_url}
            
            # Verificar elementos que indicam login
            elementos_logado = [
                'text=HOME',
                'text=Gestão de Conta',
                'text=PRIO Frota',
                'text=Transações',
                '[class*="menu"]',
                '[class*="sidebar"]',
                '[class*="navbar"]',
                'nav'
            ]
            
            for selector in elementos_logado:
                try:
                    if await self.page.locator(selector).count() > 0:
                        return {"logado": True, "pagina": current_url}
                except:
                    continue
            
            return {"logado": False, "pagina": current_url}
            
        except Exception as e:
            logger.error(f"Erro ao verificar login Prio: {e}")
            return {"logado": False, "erro": str(e)}
    
    async def guardar_sessao(self):
        """
        Guardar sessão Prio.
        Com launch_persistent_context, a sessão é automaticamente guardada no user_data_dir.
        Este método existe para compatibilidade e apenas confirma que o directório existe.
        """
        if not self.context:
            return False
        try:
            # Com contexto persistente, os dados são guardados automaticamente
            # Apenas verificamos que o directório existe
            if os.path.exists(self.user_data_dir):
                logger.info(f"Sessão Prio persistente activa em: {self.user_data_dir}")
                return True
            else:
                logger.warning(f"Directório de sessão não encontrado: {self.user_data_dir}")
                return False
        except Exception as e:
            logger.error(f"Erro ao verificar sessão Prio: {e}")
            return False
    
    async def refrescar_sessao(self) -> Dict:
        """
        Refrescar a sessão Prio navegando para uma página protegida.
        Isto mantém a sessão activa e previne timeout por inactividade.
        
        Returns:
            Dict com 'sucesso': bool e informações sobre o estado da sessão
        """
        if not self.page:
            return {"sucesso": False, "erro": "Browser não iniciado"}
        
        try:
            logger.info("🔄 Refrescando sessão Prio...")
            
            # Navegar para a página Home para refrescar a sessão
            await self.page.goto("https://myprio.com/Home/Home", wait_until="commit", timeout=20000)
            await asyncio.sleep(2)
            
            current_url = self.page.url
            
            if 'Login' not in current_url:
                logger.info(f"✅ Sessão Prio refrescada com sucesso! URL: {current_url}")
                return {
                    "sucesso": True,
                    "mensagem": "Sessão refrescada com sucesso",
                    "url": current_url
                }
            else:
                logger.warning(f"⚠️ Sessão Prio expirada durante refresh. URL: {current_url}")
                return {
                    "sucesso": False,
                    "erro": "Sessão expirada. Necessário novo login.",
                    "url": current_url
                }
                
        except Exception as e:
            logger.error(f"Erro ao refrescar sessão: {e}")
            return {"sucesso": False, "erro": str(e)}

    
    async def extrair_combustivel(self, data_inicio: str, data_fim: str) -> Dict:
        """
        Extrair dados de combustível (Transações Frota)
        data_inicio e data_fim no formato YYYY-MM-DD
        
        Fluxo baseado no vídeo do utilizador:
        1. Navegar para Transações Frota
        2. Abrir painel de pesquisa lateral (se necessário)
        3. Seleccionar datas nos campos de calendário (Início e Fim)
        4. Clicar em PESQUISAR
        5. Clicar em Exportar
        6. Clicar em ".XLS PARA EXCEL"
        """
        if not self.page:
            return {"sucesso": False, "erro": "Browser não iniciado"}
        
        try:
            logger.info(f"🔄 Prio: Extraindo combustível de {data_inicio} a {data_fim}")
            
            # 1. Navegar para Transações Frota
            await self.page.goto("https://myprio.com/Transactions/Transactions", wait_until='networkidle', timeout=30000)
            await asyncio.sleep(3)
            
            # Verificar se foi redirecionado para login
            if 'Login' in self.page.url:
                return {"sucesso": False, "erro": "Sessão expirada. Faça login novamente."}
            
            await self.page.screenshot(path='/app/backend/screenshots/prio_comb_01_pagina.png')
            
            # 2. Preparar datas (formato DD/MM/YYYY)
            start_date = datetime.strptime(data_inicio, '%Y-%m-%d')
            end_date = datetime.strptime(data_fim, '%Y-%m-%d')
            start_formatted = start_date.strftime('%d/%m/%Y')
            end_formatted = end_date.strftime('%d/%m/%Y')
            
            logger.info(f"📅 Datas a preencher: {start_formatted} - {end_formatted}")
            
            # 3. Encontrar e preencher campos de data
            # O vídeo mostra inputs com labels "Início" e "Fim" dentro de um painel de pesquisa
            try:
                # Aguardar que a página carregue completamente
                await self.page.wait_for_load_state('networkidle')
                await asyncio.sleep(2)
                
                # Tentar diferentes estratégias para encontrar os campos de data
                
                # Estratégia 1: Inputs com placeholder ou label de data
                date_inputs = await self.page.query_selector_all('input[type="text"], input[type="date"], input.form-control')
                
                logger.info(f"📋 Encontrados {len(date_inputs)} inputs")
                
                # Procurar especificamente campos de data de início e fim
                inicio_preenchido = False
                fim_preenchido = False
                
                # Tentar preencher via selectores específicos
                inicio_selectors = [
                    'input[placeholder*="Início"]',
                    'input[placeholder*="inicio"]',
                    'input[id*="start"]',
                    'input[id*="inicio"]',
                    'input[name*="start"]',
                    'input[name*="inicio"]',
                    '#DataInicio',
                    '#startDate'
                ]
                
                fim_selectors = [
                    'input[placeholder*="Fim"]',
                    'input[placeholder*="fim"]',
                    'input[id*="end"]',
                    'input[id*="fim"]',
                    'input[name*="end"]',
                    'input[name*="fim"]',
                    '#DataFim',
                    '#endDate'
                ]
                
                # Tentar encontrar campo de início
                for selector in inicio_selectors:
                    try:
                        campo = self.page.locator(selector).first
                        if await campo.count() > 0:
                            await campo.click()
                            await asyncio.sleep(0.3)
                            await self.page.keyboard.press('Control+a')
                            await self.page.keyboard.type(start_formatted)
                            await self.page.keyboard.press('Escape')
                            await self.page.keyboard.press('Tab')
                            inicio_preenchido = True
                            logger.info(f"✅ Data início preenchida via {selector}")
                            break
                    except:
                        continue
                
                # Tentar encontrar campo de fim
                for selector in fim_selectors:
                    try:
                        campo = self.page.locator(selector).first
                        if await campo.count() > 0:
                            await campo.click()
                            await asyncio.sleep(0.3)
                            await self.page.keyboard.press('Control+a')
                            await self.page.keyboard.type(end_formatted)
                            await self.page.keyboard.press('Escape')
                            await self.page.keyboard.press('Tab')
                            fim_preenchido = True
                            logger.info(f"✅ Data fim preenchida via {selector}")
                            break
                    except:
                        continue
                
                # Fallback: usar os primeiros 2 inputs de texto se não encontrou campos específicos
                if not inicio_preenchido or not fim_preenchido:
                    inputs = self.page.locator('input[type="text"], input.form-control')
                    count = await inputs.count()
                    
                    if count >= 2:
                        if not inicio_preenchido:
                            # Campo de data INÍCIO (primeiro input)
                            inicio_input = inputs.nth(0)
                            await inicio_input.click(click_count=3)
                            await asyncio.sleep(0.2)
                            await self.page.keyboard.press('Control+a')
                            await self.page.keyboard.press('Delete')
                            await asyncio.sleep(0.2)
                            await inicio_input.type(start_formatted, delay=30)
                            await self.page.keyboard.press('Escape')
                            await self.page.keyboard.press('Tab')
                            logger.info(f"✅ Data início preenchida (fallback): {start_formatted}")
                            await asyncio.sleep(0.5)
                        
                        if not fim_preenchido:
                            # Campo de data FIM (segundo input)
                            fim_input = inputs.nth(1)
                            await fim_input.click(click_count=3)
                            await asyncio.sleep(0.2)
                            await self.page.keyboard.press('Control+a')
                            await self.page.keyboard.press('Delete')
                            await asyncio.sleep(0.2)
                            await fim_input.type(end_formatted, delay=30)
                            await self.page.keyboard.press('Escape')
                            await self.page.keyboard.press('Tab')
                            logger.info(f"✅ Data fim preenchida (fallback): {end_formatted}")
                    
            except Exception as e:
                logger.error(f"❌ Erro ao preencher datas: {e}")
                await self.page.screenshot(path='/app/backend/screenshots/prio_comb_error_datas.png')
            
            await asyncio.sleep(1)
            await self.page.screenshot(path='/app/backend/screenshots/prio_comb_02_datas.png')
            
            # 4. Clicar em PESQUISAR
            pesquisar_selectors = [
                'button:has-text("PESQUISAR")',
                'button:has-text("Pesquisar")',
                'input[type="submit"][value*="Pesquisar"]',
                'a:has-text("PESQUISAR")',
                '.btn:has-text("PESQUISAR")'
            ]
            
            pesquisar_clicado = False
            for selector in pesquisar_selectors:
                btn = self.page.locator(selector).first
                if await btn.count() > 0:
                    await btn.click()
                    pesquisar_clicado = True
                    logger.info("✅ Botão PESQUISAR clicado")
                    break
            
            if not pesquisar_clicado:
                logger.warning("⚠️ Botão PESQUISAR não encontrado")
            
            await asyncio.sleep(3)  # Aguardar resultados
            await self.page.screenshot(path='/app/backend/screenshots/prio_comb_03_resultados.png')
            
            # 5. Clicar em Exportar
            exportar_selectors = [
                'button:has-text("Exportar")',
                'a:has-text("Exportar")',
                '.btn:has-text("Exportar")',
                '[data-testid="export-button"]'
            ]
            
            exportar_clicado = False
            for selector in exportar_selectors:
                btn = self.page.locator(selector).first
                if await btn.count() > 0:
                    await btn.click()
                    exportar_clicado = True
                    logger.info("✅ Botão Exportar clicado")
                    break
            
            if not exportar_clicado:
                return {"sucesso": False, "erro": "Botão Exportar não encontrado"}
            
            await asyncio.sleep(2)
            await self.page.screenshot(path='/app/backend/screenshots/prio_comb_04_export_modal.png')
            
            # 6. Clicar em ".XLS PARA EXCEL" e capturar download (conforme vídeo)
            download_file = None
            
            try:
                async with self.page.expect_download(timeout=60000) as download_info:
                    # Procurar botão XLS
                    xls_selectors = [
                        'button:has-text("XLS PARA EXCEL")',
                        'button:has-text(".XLS PARA EXCEL")',
                        'a:has-text("XLS")',
                        'button:has-text("XLS")',
                        '.btn:has-text("XLS")'
                    ]
                    
                    xls_clicado = False
                    for selector in xls_selectors:
                        btn = self.page.locator(selector).first
                        if await btn.count() > 0:
                            await btn.click()
                            xls_clicado = True
                            logger.info("✅ Botão XLS clicado")
                            break
                    
                    if not xls_clicado:
                        return {"sucesso": False, "erro": "Botão XLS não encontrado"}
                    
                    download = await download_info.value
                    
                    # Usar a extensão correcta do ficheiro descarregado
                    suggested_filename = download.suggested_filename
                    extension = '.xlsx' if '.xlsx' in suggested_filename.lower() else '.xls'
                    download_file = os.path.join(self.download_path, f"combustivel_{data_inicio}_{data_fim}{extension}")
                    await download.save_as(download_file)
                    logger.info(f"✅ Ficheiro guardado: {download_file}")
                    
            except Exception as e:
                logger.error(f"❌ Erro no download: {e}")
                await self.page.screenshot(path='/app/backend/screenshots/prio_comb_download_erro.png')
                return {"sucesso": False, "erro": f"Erro no download: {str(e)}"}
            
            return {
                "sucesso": True,
                "ficheiro": download_file,
                "tipo": "combustivel",
                "data_inicio": data_inicio,
                "data_fim": data_fim
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao extrair combustível: {e}")
            try:
                await self.page.screenshot(path='/app/backend/screenshots/prio_comb_erro.png')
            except:
                pass
            return {"sucesso": False, "erro": str(e)}
    
    async def extrair_eletrico(self, data_inicio: str, data_fim: str) -> Dict:
        """
        Extrair dados de carregamentos elétricos (Transações Electric)
        data_inicio e data_fim no formato YYYY-MM-DD
        
        Fluxo baseado no vídeo do utilizador:
        1. Clicar em "CARTÃO PRIO ELECTRIC" no menu lateral
        2. Na página "Transações Electric", preencher datas no painel direito
        3. Clicar em PESQUISAR
        4. Clicar em "Exportar ..." (botão com 3 pontos)
        5. No modal, clicar em "CSV EXPORTAR PARA CSV"
        """
        if not self.page:
            return {"sucesso": False, "erro": "Browser não iniciado"}
        
        try:
            logger.info(f"🔄 Prio Electric: Extraindo dados de {data_inicio} a {data_fim}")
            
            # 1. Navegar para CARTÃO PRIO ELECTRIC via menu lateral
            logger.info("📍 Procurando menu CARTÃO PRIO ELECTRIC...")
            
            # Primeiro verificar onde estamos
            current_url = self.page.url
            logger.info(f"📍 URL actual: {current_url}")
            
            # Se não estamos na Prio, navegar primeiro para a Home
            if 'myprio.com' not in current_url.lower():
                logger.info("📍 Navegando para Prio Home...")
                await self.page.goto("https://myprio.com/Home/Home", wait_until='domcontentloaded', timeout=30000)
                await asyncio.sleep(3)
                current_url = self.page.url
                logger.info(f"📍 Nova URL: {current_url}")
            
            # Listar todos os elementos do menu para debug
            menu_items = await self.page.evaluate('''() => {
                const links = document.querySelectorAll('a, [class*="menu"], [class*="nav"], li');
                return Array.from(links)
                    .filter(el => el.offsetParent !== null)
                    .map(el => el.textContent?.trim().substring(0, 60))
                    .filter(t => t && t.length > 0)
                    .slice(0, 30);
            }''')
            logger.info(f"📋 Menu items encontrados: {menu_items}")
            
            # Clicar no menu "CARTÃO PRIO ELECTRIC" no menu lateral
            menu_clicado = await self.page.evaluate('''() => {
                const links = document.querySelectorAll('a, div, span, button, li');
                for (const el of links) {
                    const text = (el.textContent || '').toUpperCase();
                    if (text.includes('CARTÃO PRIO ELECTRIC') || text.includes('PRIO ELECTRIC') || 
                        text === 'ELECTRIC' || text.includes('CARTAO PRIO ELECTRIC')) {
                        el.click();
                        return el.textContent?.trim() || 'clicked';
                    }
                }
                return false;
            }''')
            
            if menu_clicado:
                logger.info(f"✅ Menu clicado: {menu_clicado}")
                await asyncio.sleep(3)
            else:
                # Tentar selectores Playwright
                menu_selectors = [
                    'text=CARTÃO PRIO ELECTRIC',
                    'text=PRIO ELECTRIC',
                    'text=Electric',
                    'a:has-text("ELECTRIC")',
                    'a:has-text("Electric")',
                    '[href*="electric"]',
                    '[href*="Electric"]',
                    'li:has-text("ELECTRIC")'
                ]
                for selector in menu_selectors:
                    try:
                        loc = self.page.locator(selector).first
                        if await loc.count() > 0:
                            await loc.click()
                            logger.info(f"✅ Menu clicado via: {selector}")
                            await asyncio.sleep(3)
                            menu_clicado = True
                            break
                    except:
                        continue
            
            if not menu_clicado:
                logger.warning("⚠️ Menu CARTÃO PRIO ELECTRIC não encontrado, tentando continuar...")
            
            # Verificar se estamos na página de Transações Electric
            await self.page.screenshot(path='/tmp/prio_elec_01_pagina.png')
            
            current_url = self.page.url
            if 'Login' in current_url or 'login' in current_url:
                return {"sucesso": False, "erro": "Sessão expirada. Faça login novamente."}
            
            logger.info(f"📍 Página actual: {current_url}")
            
            # 2. Preencher datas no painel de pesquisa (lado direito)
            start_formatted = datetime.strptime(data_inicio, '%Y-%m-%d').strftime('%d/%m/%Y')
            end_formatted = datetime.strptime(data_fim, '%Y-%m-%d').strftime('%d/%m/%Y')
            logger.info(f"📅 Datas: {start_formatted} a {end_formatted}")
            
            # Preencher campo INÍCIO
            inicio_preenchido = await self.page.evaluate(f'''() => {{
                // Procurar input de INÍCIO
                const labels = document.querySelectorAll('label, span, div');
                for (const label of labels) {{
                    if (label.textContent.trim() === 'INÍCIO' || label.textContent.trim() === 'Início') {{
                        // Procurar input próximo
                        const container = label.closest('div');
                        const input = container?.querySelector('input') || label.nextElementSibling?.querySelector('input');
                        if (input) {{
                            input.value = "{start_formatted}";
                            input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            return true;
                        }}
                    }}
                }}
                // Fallback: procurar por placeholder
                const inputs = document.querySelectorAll('input[type="text"]');
                for (const input of inputs) {{
                    if (input.placeholder?.includes('dd/mm') || input.placeholder?.includes('DD/MM')) {{
                        input.value = "{start_formatted}";
                        input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        return true;
                    }}
                }}
                return false;
            }}''')
            
            # Preencher campo FIM
            fim_preenchido = await self.page.evaluate(f'''() => {{
                const labels = document.querySelectorAll('label, span, div');
                for (const label of labels) {{
                    if (label.textContent.trim() === 'FIM' || label.textContent.trim() === 'Fim') {{
                        const container = label.closest('div');
                        const input = container?.querySelector('input') || label.nextElementSibling?.querySelector('input');
                        if (input) {{
                            input.value = "{end_formatted}";
                            input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            return true;
                        }}
                    }}
                }}
                return false;
            }}''')
            
            if inicio_preenchido and fim_preenchido:
                logger.info("✅ Datas preenchidas")
            else:
                logger.warning(f"⚠️ Datas: início={inicio_preenchido}, fim={fim_preenchido}")
            
            await asyncio.sleep(1)
            await self.page.screenshot(path='/tmp/prio_elec_02_datas.png')
            
            # 3. Clicar em PESQUISAR
            logger.info("🔍 Clicando em PESQUISAR...")
            
            pesquisar_clicado = await self.page.evaluate('''() => {
                const btns = document.querySelectorAll('button, a, input[type="submit"]');
                for (const btn of btns) {
                    const text = btn.textContent || btn.value || '';
                    if (text.trim() === 'PESQUISAR' || text.trim() === 'Pesquisar') {
                        btn.click();
                        return true;
                    }
                }
                return false;
            }''')
            
            if pesquisar_clicado:
                logger.info("✅ PESQUISAR clicado")
                await asyncio.sleep(5)  # Aguardar resultados
            else:
                logger.warning("⚠️ Botão PESQUISAR não encontrado")
            
            await self.page.screenshot(path='/tmp/prio_elec_03_resultados.png')
            
            # 4. Clicar no botão "..." (três pontos) ao lado de "Exportar"
            logger.info("📤 Clicando nos três pontos (...) ao lado de Exportar...")
            
            # O botão é "..." ao lado de "Exportar", não a palavra em si
            exportar_clicado = await self.page.evaluate('''() => {
                // Listar todos os elementos para debug
                const allElements = document.querySelectorAll('button, a, span, div, i');
                const exportarArea = [];
                
                for (const el of allElements) {
                    const text = el.textContent?.trim() || '';
                    // Procurar elemento que é apenas "..." ou pontos
                    if (text === '...' || text === '···' || text === '•••' || text === '⋯' || text === '⋮') {
                        el.click();
                        return 'clicked: ' + text;
                    }
                }
                
                // Procurar próximo do "Exportar"
                for (const el of allElements) {
                    const text = el.textContent || '';
                    if (text.includes('Exportar')) {
                        // Procurar siblings
                        let sibling = el.nextElementSibling;
                        while (sibling) {
                            if (sibling.textContent?.includes('...') || sibling.textContent?.includes('⋮')) {
                                sibling.click();
                                return 'clicked sibling of Exportar';
                            }
                            sibling = sibling.nextElementSibling;
                        }
                        // Clicar no próprio se não encontrar sibling
                        el.click();
                        return 'clicked Exportar element';
                    }
                }
                
                return false;
            }''')
            
            if not exportar_clicado:
                # Tentar selectores Playwright específicos
                export_selectors = [
                    'button:has-text("...")',
                    'span:has-text("...")',
                    'text=...',
                    '[aria-label*="export"]',
                    '[aria-label*="more"]',
                    'text=Exportar',
                    'button:has-text("Exportar")'
                ]
                for selector in export_selectors:
                    try:
                        loc = self.page.locator(selector).first
                        if await loc.count() > 0:
                            await loc.click()
                            exportar_clicado = selector
                            logger.info(f"✅ Botão encontrado via: {selector}")
                            break
                    except:
                        continue
            
            if not exportar_clicado:
                await self.page.screenshot(path='/tmp/prio_elec_export_nao_encontrado.png')
                return {"sucesso": False, "erro": "Botão ... (exportar) não encontrado"}
            
            logger.info(f"✅ Botão clicado: {exportar_clicado}")
            await asyncio.sleep(2)
            await self.page.screenshot(path='/tmp/prio_elec_04_modal.png')
            
            # 5. No modal, clicar em "CSV EXPORTAR PARA CSV"
            logger.info("📥 Clicando em CSV EXPORTAR PARA CSV...")
            
            download_file = None
            
            try:
                async with self.page.expect_download(timeout=60000) as download_info:
                    # Clicar no botão CSV
                    csv_clicado = await self.page.evaluate('''() => {
                        const btns = document.querySelectorAll('button, a');
                        for (const btn of btns) {
                            const text = btn.textContent || '';
                            // Procurar exactamente "CSV EXPORTAR PARA CSV" ou variações
                            if (text.includes('CSV EXPORTAR PARA CSV') || 
                                text.includes('CSV Exportar para CSV') ||
                                (text.includes('CSV') && text.includes('EXPORTAR'))) {
                                btn.click();
                                return true;
                            }
                        }
                        return false;
                    }''')
                    
                    if not csv_clicado:
                        # Tentar selectores Playwright
                        csv_selectors = [
                            'button:has-text("CSV EXPORTAR PARA CSV")',
                            'button:has-text("CSV Exportar")',
                            'a:has-text("CSV EXPORTAR")',
                            'button:has-text("EXPORTAR PARA CSV")'
                        ]
                        for selector in csv_selectors:
                            try:
                                loc = self.page.locator(selector).first
                                if await loc.count() > 0:
                                    await loc.click()
                                    csv_clicado = True
                                    break
                            except:
                                continue
                    
                    if not csv_clicado:
                        return {"sucesso": False, "erro": "Botão CSV EXPORTAR não encontrado no modal"}
                    
                    logger.info("✅ Botão CSV EXPORTAR clicado")
                    
                    # Aguardar download
                    download = await download_info.value
                    
                    suggested_filename = download.suggested_filename
                    extension = '.csv' if '.csv' in suggested_filename.lower() else '.xlsx'
                    download_file = os.path.join(self.download_path, f"eletrico_{data_inicio}_{data_fim}{extension}")
                    await download.save_as(download_file)
                    logger.info(f"✅ Ficheiro guardado: {download_file}")
                    
            except Exception as e:
                logger.error(f"❌ Erro no download: {e}")
                await self.page.screenshot(path='/tmp/prio_elec_download_erro.png')
                return {"sucesso": False, "erro": f"Erro no download: {str(e)}"}
            
            return {
                "sucesso": True,
                "ficheiro": download_file,
                "tipo": "eletrico",
                "data_inicio": data_inicio,
                "data_fim": data_fim
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao extrair elétrico: {e}")
            import traceback
            traceback.print_exc()
            await self.page.screenshot(path='/tmp/prio_elec_99_error.png')
            return {"sucesso": False, "erro": str(e)}
    
    async def fechar(self, manter_sessao: bool = True):
        """
        Fechar browser.
        
        Args:
            manter_sessao: Se True (default), mantém o browser activo para reutilizar a sessão.
                          Se False, fecha completamente.
        """
        try:
            if manter_sessao:
                # IMPORTANTE: NÃO fechar o contexto para manter a sessão activa!
                # Os cookies são guardados automaticamente no user_data_dir pelo Playwright
                # O browser continua activo em background para a próxima sincronização
                logger.info(f"✅ Browser Prio mantido activo para parceiro {self.parceiro_id} (sessão persistente)")
                # NÃO fechar nada - manter browser activo
                return
            
            # Só fechar se explicitamente pedido (manter_sessao=False)
            logger.info(f"🔴 Browser Prio fechado completamente para parceiro {self.parceiro_id}")
            
            if self.context:
                await self.context.close()
            if self.playwright:
                await self.playwright.stop()
            
            self.context = None
            self.page = None
            self.ativo = False
            
        except Exception as e:
            logger.error(f"Erro ao fechar browser Prio: {e}")


# Gestão de instâncias de browser por parceiro
_browsers_prio: Dict[str, BrowserInterativoPrio] = {}


async def get_browser_prio(parceiro_id: str, verificar_sessao: bool = False) -> BrowserInterativoPrio:
    """
    Obter ou criar browser para um parceiro.
    
    Args:
        parceiro_id: ID do parceiro
        verificar_sessao: Se True, verifica se a sessão ainda está válida ao iniciar
    
    Returns:
        Instância do browser Prio
    """
    if parceiro_id not in _browsers_prio or not _browsers_prio[parceiro_id].ativo:
        browser = BrowserInterativoPrio(parceiro_id)
        await browser.iniciar(verificar_sessao_existente=verificar_sessao)
        _browsers_prio[parceiro_id] = browser
    return _browsers_prio[parceiro_id]


async def verificar_sessao_prio_valida(parceiro_id: str) -> Dict:
    """
    Verifica se o parceiro tem uma sessão Prio válida sem precisar de novo login.
    Esta função tenta reutilizar a sessão existente no user_data_dir.
    
    Returns:
        Dict com 'valida': bool e 'mensagem': str
    """
    try:
        # Iniciar browser com verificação de sessão
        browser = await get_browser_prio(parceiro_id, verificar_sessao=True)
        
        # Verificar se está logado
        login_status = await browser.verificar_login()
        
        if login_status.get("logado"):
            return {
                "valida": True,
                "mensagem": "Sessão válida",
                "url": login_status.get("pagina", "")
            }
        else:
            return {
                "valida": False,
                "mensagem": "Sessão expirada. Necessário novo login.",
                "url": login_status.get("pagina", "")
            }
            
    except Exception as e:
        logger.error(f"Erro ao verificar sessão Prio: {e}")
        return {
            "valida": False,
            "mensagem": f"Erro: {str(e)}"
        }


async def fechar_browser_prio(parceiro_id: str):
    """Fechar browser de um parceiro"""
    if parceiro_id in _browsers_prio:
        await _browsers_prio[parceiro_id].fechar()
        del _browsers_prio[parceiro_id]
