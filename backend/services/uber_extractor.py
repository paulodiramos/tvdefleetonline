"""
RPA Uber - Extração Automática de Rendimentos
Fluxo baseado no vídeo de exemplo:
1. Navegar para Relatórios
2. Gerar relatório > Pagamentos de motorista
3. Selecionar intervalo de tempo
4. Selecionar organização
5. Gerar
6. Download do CSV
"""
import asyncio
import csv
import io
import os
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

# Configurar Playwright
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'


class UberExtractor:
    """Extrator automático de rendimentos da Uber Fleet"""
    
    def __init__(self, parceiro_id: str, email: str, password: str):
        self.parceiro_id = parceiro_id
        self.email = email
        self.password = password
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.session_path = f"/tmp/uber_sessao_{parceiro_id}.json"
        self.downloads_path = Path("/tmp/uber_downloads")
        self.downloads_path.mkdir(exist_ok=True)
        
    async def iniciar(self, usar_sessao: bool = True) -> bool:
        """Iniciar browser com sessão guardada"""
        from playwright.async_api import async_playwright
        
        self.playwright = await async_playwright().start()
        
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        )
        
        # Carregar sessão se existir
        storage_state = None
        if usar_sessao and os.path.exists(self.session_path):
            storage_state = self.session_path
            logger.info(f"Carregando sessão: {self.session_path}")
        
        self.context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            accept_downloads=True,
            storage_state=storage_state,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            locale='pt-PT'
        )
        
        # Anti-detecção
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        """)
        
        self.page = await self.context.new_page()
        return True
        
    async def verificar_login(self) -> dict:
        """Verificar se está logado"""
        try:
            await self.page.goto("https://supplier.uber.com/", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)
            
            url = self.page.url
            
            if "supplier.uber.com" in url and "auth" not in url and "login" not in url:
                # Guardar sessão
                await self.context.storage_state(path=self.session_path)
                return {"logado": True, "url": url}
            
            return {"logado": False, "url": url, "erro": "Sessão expirada"}
            
        except Exception as e:
            return {"logado": False, "erro": str(e)}
            
    async def fazer_login(self, sms_code: str = None) -> dict:
        """Fazer login na Uber"""
        try:
            await self.page.goto("https://auth.uber.com/v2/?next_url=https%3A%2F%2Fsupplier.uber.com%2F", wait_until="domcontentloaded")
            await asyncio.sleep(2)
            
            # Preencher email
            email_input = self.page.locator('input[name="email"], input[type="email"], #PHONE_NUMBER_or_EMAIL_ADDRESS')
            if await email_input.count() > 0:
                await email_input.fill(self.email)
                await self.page.keyboard.press("Enter")
                await asyncio.sleep(2)
            
            # Clicar em "Mais opções" se aparecer
            mais_opcoes = self.page.get_by_text("Mais opções")
            if await mais_opcoes.count() > 0:
                await mais_opcoes.first.click()
                await asyncio.sleep(1)
            else:
                mais_opcoes_en = self.page.get_by_text("More options")
                if await mais_opcoes_en.count() > 0:
                    await mais_opcoes_en.first.click()
                    await asyncio.sleep(1)
            
            # Clicar em opção de password
            password_option = self.page.get_by_text("palavra-passe")
            if await password_option.count() > 0:
                await password_option.first.click()
                await asyncio.sleep(1)
            else:
                password_option_en = self.page.get_by_text("password")
                if await password_option_en.count() > 0:
                    await password_option_en.first.click()
                    await asyncio.sleep(1)
            
            # Preencher password
            password_input = self.page.locator('input[name="password"], input[type="password"]')
            if await password_input.count() > 0:
                await password_input.fill(self.password)
                await self.page.keyboard.press("Enter")
                await asyncio.sleep(3)
            
            # Verificar se precisa SMS
            page_content = await self.page.content()
            if "4 dígitos" in page_content or "código" in page_content.lower():
                if sms_code:
                    sms_input = self.page.locator('input[name="verificationCode"], input[type="tel"], input[maxlength="4"]')
                    if await sms_input.count() > 0:
                        await sms_input.fill(sms_code)
                        await self.page.keyboard.press("Enter")
                        await asyncio.sleep(3)
                else:
                    return {"sucesso": False, "precisa_sms": True, "mensagem": "Código SMS necessário"}
            
            # Verificar se tem CAPTCHA
            if "Proteger" in page_content or "challenge" in page_content.lower():
                return {"sucesso": False, "precisa_captcha": True, "mensagem": "CAPTCHA detectado"}
            
            # Verificar login
            await asyncio.sleep(2)
            url = self.page.url
            
            if "supplier.uber.com" in url and "auth" not in url:
                await self.context.storage_state(path=self.session_path)
                return {"sucesso": True, "mensagem": "Login realizado com sucesso"}
            
            return {"sucesso": False, "erro": "Login falhou - verifique credenciais"}
            
        except Exception as e:
            return {"sucesso": False, "erro": str(e)}
            
    async def extrair_rendimentos(self, semana_inicio: str = None, semana_fim: str = None) -> dict:
        """
        Extrair rendimentos seguindo o fluxo do vídeo:
        1. Relatórios
        2. Gerar relatório
        3. Pagamentos de motorista
        4. Selecionar intervalo
        5. Selecionar organização
        6. Gerar
        7. Download
        """
        try:
            # Verificar login primeiro
            status = await self.verificar_login()
            if not status.get("logado"):
                return {"sucesso": False, "erro": "Não está logado"}
            
            logger.info("A iniciar extração de rendimentos...")
            
            # 1. Navegar para Relatórios
            logger.info("Passo 1: Navegar para Relatórios")
            await self.page.goto("https://supplier.uber.com/", wait_until="domcontentloaded")
            await asyncio.sleep(2)
            
            # Clicar no menu Relatórios
            relatorios_menu = self.page.get_by_role("link", name="Relatórios")
            if await relatorios_menu.count() > 0:
                await relatorios_menu.first.click()
                await asyncio.sleep(2)
            else:
                # Tentar link por href
                relatorios_link = self.page.locator('a[href*="reports"]').first
                if await relatorios_link.count() > 0:
                    await relatorios_link.click()
                    await asyncio.sleep(2)
                else:
                    # Tentar URL direta
                    current_url = self.page.url
                    if '/orgs/' in current_url:
                        org_id = current_url.split('/orgs/')[1].split('/')[0]
                        await self.page.goto(f"https://supplier.uber.com/orgs/{org_id}/reports", wait_until="domcontentloaded")
                    await asyncio.sleep(2)
            
            # 2. Clicar em "Gerar relatório"
            logger.info("Passo 2: Clicar em Gerar relatório")
            gerar_btn = self.page.get_by_role("button", name="Gerar relatório")
            if await gerar_btn.count() == 0:
                gerar_btn = self.page.get_by_text("Gerar relatório")
            if await gerar_btn.count() > 0:
                await gerar_btn.first.click()
                await asyncio.sleep(2)
            else:
                return {"sucesso": False, "erro": "Botão 'Gerar relatório' não encontrado"}
            
            # 3. Selecionar tipo: Pagamentos de motorista
            logger.info("Passo 3: Selecionar tipo de relatório")
            tipo_dropdown = self.page.locator('[data-testid*="report-type"]').first
            if await tipo_dropdown.count() == 0:
                tipo_dropdown = self.page.get_by_role("button", name="Tipo de relatório")
            if await tipo_dropdown.count() > 0:
                await tipo_dropdown.first.click()
                await asyncio.sleep(1)
                
                pagamentos_option = self.page.get_by_text("Pagamentos de motorista")
                if await pagamentos_option.count() > 0:
                    await pagamentos_option.first.click()
                    await asyncio.sleep(1)
            
            # 4. Selecionar intervalo de tempo
            logger.info("Passo 4: Selecionar intervalo de tempo")
            intervalo_dropdown = self.page.get_by_role("button", name="Intervalo")
            if await intervalo_dropdown.count() == 0:
                intervalo_dropdown = self.page.locator('[data-testid*="time-range"]')
            if await intervalo_dropdown.count() == 0:
                # Tentar outros seletores comuns
                intervalo_dropdown = self.page.locator('button:has-text("Selecionar intervalo")')
            if await intervalo_dropdown.count() > 0:
                await intervalo_dropdown.first.click()
                await asyncio.sleep(1)
                
                # Selecionar a primeira opção disponível (semana mais recente)
                primeira_opcao = self.page.locator('[role="option"]').first
                if await primeira_opcao.count() > 0:
                    await primeira_opcao.click()
                    await asyncio.sleep(1)
            else:
                logger.warning("⚠️ Dropdown de intervalo não encontrado")
            
            # 5. Selecionar organização - CRÍTICO para o botão Gerar ficar ativo
            logger.info("Passo 5: Selecionar organização")
            org_selected = False
            
            # Tirar screenshot antes de selecionar
            await self.page.screenshot(path='/tmp/uber_05_before_org.png')
            
            # Tentar múltiplas abordagens para encontrar e selecionar organização
            try:
                # Abordagem 1: Procurar dropdown pelo placeholder em português e inglês
                org_selectors = [
                    'text="Selecione as organizações"',
                    'text="Select organizations"',
                    '[data-baseweb="select"]:has-text("organização")',
                    '[data-baseweb="select"]:has-text("organization")',
                    'div[role="combobox"]',
                    # Dropdown baseado em aria-label
                    '[aria-label*="organization" i]',
                    '[aria-label*="organização" i]',
                    # Por classe de input
                    'input[id*="org"]',
                ]
                
                org_dropdown = None
                for selector in org_selectors:
                    try:
                        loc = self.page.locator(selector)
                        if await loc.count() > 0:
                            first = loc.first
                            if await first.is_visible(timeout=1000):
                                org_dropdown = first
                                logger.info(f"  Dropdown encontrado: {selector}")
                                break
                    except:
                        continue
                
                if org_dropdown:
                    await org_dropdown.click()
                    await asyncio.sleep(1.5)
                    
                    # Tirar screenshot do dropdown aberto
                    await self.page.screenshot(path='/tmp/uber_06_org_dropdown_open.png')
                    logger.info("  Screenshot do dropdown aberto")
                    
                    # Tentar selecionar a primeira opção disponível
                    option_selectors = [
                        '[role="option"]',
                        'li[role="option"]',
                        '[data-baseweb="menu-item"]',
                        'ul li',
                        'input[type="checkbox"]'
                    ]
                    
                    for opt_selector in option_selectors:
                        try:
                            options = self.page.locator(opt_selector)
                            count = await options.count()
                            if count > 0:
                                first_opt = options.first
                                if await first_opt.is_visible(timeout=1000):
                                    await first_opt.click()
                                    org_selected = True
                                    logger.info(f"  ✅ Opção selecionada via: {opt_selector}")
                                    await asyncio.sleep(1)
                                    break
                        except:
                            continue
                    
                    # Se não selecionou ainda, tentar checkbox
                    if not org_selected:
                        checkboxes = self.page.locator('input[type="checkbox"]')
                        count = await checkboxes.count()
                        logger.info(f"  Checkboxes encontrados: {count}")
                        for i in range(count):
                            cb = checkboxes.nth(i)
                            try:
                                if await cb.is_visible(timeout=500):
                                    is_checked = await cb.is_checked()
                                    if not is_checked:
                                        await cb.click()
                                        org_selected = True
                                        logger.info(f"  ✅ Checkbox {i} marcado")
                                        break
                            except:
                                continue
                else:
                    logger.warning("  ⚠️ Dropdown de organização não encontrado")
                    
                    # Tentar procurar dentro do modal
                    modal = self.page.locator('[role="dialog"]').last
                    if await modal.count() > 0:
                        all_dropdowns = modal.locator('[data-baseweb="select"]')
                        count = await all_dropdowns.count()
                        logger.info(f"  Dropdowns no modal: {count}")
                        
                        # O dropdown de organização é geralmente o último
                        if count > 0:
                            last_dropdown = all_dropdowns.last
                            await last_dropdown.click()
                            await asyncio.sleep(1)
                            
                            # Selecionar primeira opção
                            option = self.page.locator('[role="option"]').first
                            if await option.count() > 0:
                                await option.click()
                                org_selected = True
                                logger.info("  ✅ Organização selecionada do último dropdown")
                    
            except Exception as e:
                logger.warning(f"  Erro ao selecionar organização: {e}")
            
            # Screenshot após tentativa de seleção
            await self.page.screenshot(path='/tmp/uber_after_org_select.png')
            logger.info(f"  Organização selecionada: {org_selected}")
            
            # 6. Clicar em Gerar - com retry
            logger.info("Passo 6: Clicar em Gerar")
            gerar_final_btn = self.page.get_by_role("button", name="Gerar", exact=True)
            if await gerar_final_btn.count() > 0:
                max_retries = 3
                for retry in range(max_retries):
                    try:
                        # Aguardar que o botão esteja habilitado
                        await gerar_final_btn.first.wait_for(state="visible", timeout=5000)
                        
                        # Verificar se está habilitado
                        is_disabled = await gerar_final_btn.first.is_disabled()
                        if is_disabled:
                            logger.warning(f"Botão 'Gerar' desabilitado (tentativa {retry+1}/{max_retries})")
                            
                            # Screenshot para debug
                            await self.page.screenshot(path=f'/tmp/uber_gerar_disabled_{retry}.png')
                            
                            if retry < max_retries - 1:
                                # Tentar scroll e esperar mais
                                await gerar_final_btn.first.scroll_into_view_if_needed()
                                await asyncio.sleep(3)
                                
                                # Tentar selecionar organização novamente se não foi selecionada
                                if not org_selected:
                                    logger.info("Tentando selecionar organização novamente...")
                                    all_checkboxes = self.page.locator('input[type="checkbox"]')
                                    count = await all_checkboxes.count()
                                    for i in range(count):
                                        cb = all_checkboxes.nth(i)
                                        if await cb.is_visible():
                                            is_checked = await cb.is_checked()
                                            if not is_checked:
                                                await cb.click()
                                                await asyncio.sleep(1)
                                                break
                                continue
                            else:
                                return {"sucesso": False, "erro": "Botão 'Gerar' desabilitado - selecione organização e período. Verifique as credenciais e permissões."}
                        
                        await gerar_final_btn.first.click()
                        await asyncio.sleep(5)  # Aguardar geração
                        logger.info("✅ Botão Gerar clicado com sucesso")
                        break
                    except Exception as e:
                        logger.warning(f"Erro ao clicar em Gerar (tentativa {retry+1}): {e}")
                        if retry == max_retries - 1:
                            return {"sucesso": False, "erro": f"Falha ao clicar no botão Gerar: {str(e)}"}
            else:
                return {"sucesso": False, "erro": "Botão 'Gerar' não encontrado na página"}
            
            # 7. Fazer download
            logger.info("Passo 7: Fazer download")
            
            # Fechar modal se ainda estiver aberto
            fechar_btn = self.page.get_by_role("button", name="Cancelar")
            if await fechar_btn.count() > 0:
                await fechar_btn.first.click()
                await asyncio.sleep(1)
            else:
                close_icon = self.page.locator('[aria-label="close"]')
                if await close_icon.count() > 0:
                    await close_icon.first.click()
                    await asyncio.sleep(1)
            
            # Encontrar botão de download na tabela
            download_btn = self.page.get_by_role("button", name="download")
            if await download_btn.count() == 0:
                download_btn = self.page.get_by_role("link", name="download")
            if await download_btn.count() == 0:
                download_btn = self.page.get_by_text("Faça o download")
            
            if await download_btn.count() > 0:
                try:
                    async with self.page.expect_download(timeout=60000) as download_info:
                        await download_btn.click()
                    
                    download = await download_info.value
                    
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    filename = f"{self.downloads_path}/uber_{self.parceiro_id}_{timestamp}.csv"
                    await download.save_as(filename)
                    
                    logger.info(f"CSV descarregado: {filename}")
                    
                    # Processar CSV
                    motoristas = await self._processar_csv(filename)
                    
                    return {
                        "sucesso": True,
                        "motoristas": motoristas,
                        "total_motoristas": len(motoristas),
                        "total_rendimentos": sum(m.get("rendimentos_liquidos", 0) for m in motoristas),
                        "ficheiro": filename
                    }
                    
                except Exception as e:
                    logger.warning(f"Download falhou: {e}")
                    return {"sucesso": False, "erro": f"Erro no download: {str(e)}"}
            else:
                return {"sucesso": False, "erro": "Botão de download não encontrado"}
                
        except Exception as e:
            logger.error(f"Erro na extração: {e}")
            return {"sucesso": False, "erro": str(e)}
            
    async def _processar_csv(self, filepath: str) -> List[Dict]:
        """Processar ficheiro CSV de rendimentos"""
        motoristas = []
        
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            
            delimiter = ';' if ';' in content else ','
            reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
            
            for row in reader:
                nome = row.get("Nome do motorista", row.get("Driver name", row.get("Nome", "")))
                if nome:
                    motoristas.append({
                        "nome": nome,
                        "rendimentos_totais": self._parse_valor(row.get("Rendimentos totais", row.get("Total earnings", "0"))),
                        "rendimentos_liquidos": self._parse_valor(row.get("Rendimentos líquidos", row.get("Net earnings", "0"))),
                        "reembolsos": self._parse_valor(row.get("Reembolsos e despesas", row.get("Reimbursements", "0"))),
                        "ajustes": self._parse_valor(row.get("Ajustes", row.get("Adjustments", "0"))),
                    })
                    
        except Exception as e:
            logger.error(f"Erro ao processar CSV: {e}")
            
        return motoristas
        
    def _parse_valor(self, valor_str: str) -> float:
        """Converter valor monetário para float"""
        if not valor_str:
            return 0.0
        valor = valor_str.replace("€", "").replace("$", "").replace(" ", "").strip()
        valor = valor.replace(",", ".")
        try:
            return float(valor)
        except:
            return 0.0
            
    async def fechar(self):
        """Fechar browser"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


async def extrair_rendimentos_parceiro(parceiro_id: str, email: str, password: str, sms_code: str = None) -> dict:
    """Função helper para extrair rendimentos de um parceiro"""
    extractor = UberExtractor(parceiro_id, email, password)
    
    try:
        await extractor.iniciar()
        
        # Verificar se já está logado
        status = await extractor.verificar_login()
        
        if not status.get("logado"):
            # Tentar fazer login
            login_result = await extractor.fazer_login(sms_code)
            
            if not login_result.get("sucesso"):
                await extractor.fechar()
                return login_result
        
        # Extrair rendimentos
        resultado = await extractor.extrair_rendimentos()
        
        await extractor.fechar()
        return resultado
        
    except Exception as e:
        await extractor.fechar()
        return {"sucesso": False, "erro": str(e)}
