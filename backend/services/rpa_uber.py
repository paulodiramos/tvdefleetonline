"""
RPA Uber - Extração de Dados de Rendimentos
Versão: 1.0
Data: 02/02/2026

Extrai dados de rendimentos do portal Uber Fleet para motoristas.
Suporta extração por semana específica ou período personalizado.
"""

import logging
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
import uuid

logger = logging.getLogger(__name__)


class UberRPA:
    """Classe para automação do portal Uber Fleet"""
    
    def __init__(self, email: str, password: str, sms_code: str = None):
        self.email = email
        self.password = password
        self.sms_code = sms_code  # Código SMS para autenticação
        self.browser = None
        self.context = None
        self.page = None
        self.downloads_path = Path("/tmp/uber_downloads")
        self.downloads_path.mkdir(exist_ok=True)
        self.session_path = Path("/tmp/uber_session")
        self.session_path.mkdir(exist_ok=True)
        
    async def iniciar_browser(self, headless: bool = True, usar_sessao: bool = True):
        """Iniciar browser Playwright com suporte a sessão persistente"""
        from playwright.async_api import async_playwright
        import json
        
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        
        # Tentar carregar sessão guardada
        cookies_file = self.session_path / f"cookies_{self.email.replace('@','_').replace('.','_')}.json"
        storage_state = None
        
        if usar_sessao and cookies_file.exists():
            try:
                storage_state = str(cookies_file)
                logger.info(f"📂 A carregar sessão guardada: {cookies_file}")
            except Exception as e:
                logger.warning(f"⚠️ Não foi possível carregar sessão: {e}")
        
        self.context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            accept_downloads=True,
            storage_state=storage_state if storage_state and Path(storage_state).exists() else None
        )
        self.page = await self.context.new_page()
        self.cookies_file = cookies_file
        logger.info("✅ Browser Uber iniciado")
    
    async def guardar_sessao(self):
        """Guardar cookies e storage state para reutilizar"""
        try:
            await self.context.storage_state(path=str(self.cookies_file))
            logger.info(f"💾 Sessão guardada: {self.cookies_file}")
            return True
        except Exception as e:
            logger.error(f"❌ Erro ao guardar sessão: {e}")
            return False
        
    async def fechar_browser(self, guardar: bool = True):
        """Fechar browser, opcionalmente guardando a sessão"""
        if guardar and hasattr(self, 'context'):
            await self.guardar_sessao()
        if self.browser:
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()
        logger.info("🔒 Browser Uber fechado")
    
    async def screenshot(self, name: str):
        """Tirar screenshot para debug"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filepath = f"/tmp/uber_{name}_{timestamp}.png"
        await self.page.screenshot(path=filepath)
        logger.info(f"📸 Screenshot: {filepath}")
        return filepath
    
    async def fazer_login(self) -> bool:
        """
        Fazer login no portal Uber Fleet.
        
        Processo:
        1. Ir para página de login
        2. Inserir email
        3. Clicar "Continuar"
        4. Selecionar "Enviar códigos por SMS" ou "Mais opções"
        5. Inserir código SMS (se fornecido)
        6. Inserir password (se necessário)
        7. Clicar "Seguinte"
        """
        try:
            logger.info(f"🔐 A fazer login Uber: {self.email}")
            
            # Navegar para o portal Uber Fleet - usar domcontentloaded em vez de networkidle
            await self.page.goto("https://fleet.uber.com/", wait_until="domcontentloaded", timeout=90000)
            await self.page.wait_for_timeout(5000)
            
            await self.screenshot("pagina_inicial")
            
            # Verificar se já estamos logados
            if "fleet.uber.com" in self.page.url and "/login" not in self.page.url:
                # Verificar se há elementos do dashboard
                dashboard = self.page.locator('text=/Página inicial|Home|Dashboard/')
                if await dashboard.count() > 0:
                    logger.info("✅ Já estava logado!")
                    return True
            
            # Aguardar campo de email
            email_input = self.page.locator('input[type="text"], input[type="email"], input[name="email"]').first
            await email_input.wait_for(timeout=30000)
            
            # Preencher email
            await email_input.fill(self.email)
            await self.page.wait_for_timeout(500)
            logger.info(f"✅ Email inserido: {self.email}")
            
            await self.screenshot("email_preenchido")
            
            # Clicar em Continuar
            continuar_btn = self.page.locator('button:has-text("Continuar"), button:has-text("Continue")').first
            if await continuar_btn.count() > 0:
                await continuar_btn.click()
                await self.page.wait_for_timeout(3000)
                logger.info("✅ Clicou Continuar")
            
            await self.screenshot("apos_continuar")
            
            # VERIFICAR SE HÁ CAPTCHA/PUZZLE
            puzzle_btn = self.page.locator('button:has-text("Start Puzzle"), button:has-text("Iniciar")').first
            if await puzzle_btn.count() > 0 and await puzzle_btn.is_visible():
                logger.info("🧩 CAPTCHA puzzle detectado - a tentar resolver...")
                await puzzle_btn.click()
                await self.page.wait_for_timeout(3000)
                await self.screenshot("puzzle_iniciado")
                
                # Tentar resolver o puzzle (alguns são simples cliques)
                # Aguardar o iframe do puzzle
                for attempt in range(3):
                    try:
                        # Procurar elementos interativos no puzzle
                        puzzle_frame = self.page.frame_locator('iframe').first
                        
                        # Tentar clicar em elementos do puzzle
                        clickable = puzzle_frame.locator('div[role="button"], button, img').first
                        if await clickable.count() > 0:
                            await clickable.click()
                            await self.page.wait_for_timeout(2000)
                            logger.info(f"🧩 Tentativa {attempt+1}: Clicou em elemento do puzzle")
                    except Exception as e:
                        logger.warning(f"⚠️ Tentativa puzzle {attempt+1}: {e}")
                    
                    await self.page.wait_for_timeout(3000)
                    await self.screenshot(f"puzzle_tentativa_{attempt+1}")
                    
                    # Verificar se passou
                    puzzle_check = self.page.locator('text=/Protecting your account|puzzle|Start Puzzle/')
                    if await puzzle_check.count() == 0:
                        logger.info("✅ CAPTCHA parece ter passado!")
                        break
                
                await self.screenshot("apos_puzzle")
            
            # VERIFICAR SE PEDE SMS
            # Procurar opção "Enviar códigos por SMS"
            enviar_sms_btn = self.page.locator('text=/Enviar códigos por SMS|Send codes via SMS/').first
            
            if await enviar_sms_btn.count() > 0 and await enviar_sms_btn.is_visible():
                logger.info("📱 Opção SMS detectada")
                
                # Se temos código SMS, clicar para enviar
                if self.sms_code:
                    await enviar_sms_btn.click()
                    await self.page.wait_for_timeout(3000)
                    logger.info("✅ Clicou em Enviar códigos por SMS")
                    
                    await self.screenshot("aguardando_sms")
                    
                    # Aguardar campo de código SMS
                    sms_input = self.page.locator('input[type="text"], input[type="number"], input[name="code"], input[placeholder*="código"], input[placeholder*="code"]').first
                    
                    if await sms_input.count() > 0:
                        await sms_input.wait_for(timeout=10000)
                        await sms_input.fill(self.sms_code)
                        await self.page.wait_for_timeout(500)
                        logger.info(f"✅ Código SMS inserido: {self.sms_code}")
                        
                        await self.screenshot("sms_preenchido")
                        
                        # Clicar em Verificar/Continuar
                        verificar_btn = self.page.locator('button:has-text("Verificar"), button:has-text("Verify"), button:has-text("Continuar"), button:has-text("Continue"), button[type="submit"]').first
                        if await verificar_btn.count() > 0:
                            await verificar_btn.click()
                            await self.page.wait_for_timeout(5000)
                            logger.info("✅ Clicou Verificar SMS")
                else:
                    logger.warning("⚠️ Código SMS necessário mas não fornecido. A tentar alternativa...")
                    # Tentar "Mais opções" para usar password
                    mais_opcoes = self.page.locator('text=/Mais opções|More options/').first
                    if await mais_opcoes.count() > 0:
                        await mais_opcoes.click()
                        await self.page.wait_for_timeout(2000)
                        logger.info("✅ Clicou Mais opções")
            else:
                # Clicar em "Mais opções" se disponível
                mais_opcoes = self.page.locator('text=/Mais opções|More options/').first
                if await mais_opcoes.count() > 0 and await mais_opcoes.is_visible():
                    await mais_opcoes.click()
                    await self.page.wait_for_timeout(2000)
                    logger.info("✅ Clicou Mais opções")
            
            await self.screenshot("apos_sms_ou_opcoes")
            
            # Procurar campo de password
            password_input = self.page.locator('input[type="password"]').first
            
            if await password_input.count() > 0 and await password_input.is_visible():
                await password_input.fill(self.password)
                await self.page.wait_for_timeout(500)
                logger.info("✅ Password inserida")
                
                await self.screenshot("password_preenchida")
                
                # Clicar em Seguinte/Next
                seguinte_btn = self.page.locator('button:has-text("Seguinte"), button:has-text("Next"), button[type="submit"]').first
                if await seguinte_btn.count() > 0:
                    await seguinte_btn.click()
                    await self.page.wait_for_timeout(5000)
                    logger.info("✅ Clicou Seguinte")
            
            # Verificar se aparece "Tudo pronto" ou similar
            tudo_pronto = self.page.locator('text=/Tudo pronto|All set|Concluído/')
            if await tudo_pronto.count() > 0:
                continuar_final = self.page.locator('button:has-text("Continuar"), button:has-text("Continue")').first
                if await continuar_final.count() > 0:
                    await continuar_final.click()
                    await self.page.wait_for_timeout(3000)
            
            await self.screenshot("apos_login")
            
            # Verificar se login foi bem sucedido
            await self.page.wait_for_timeout(5000)
            
            # Verificar se estamos no dashboard
            if "fleet.uber.com" in self.page.url and "/login" not in self.page.url:
                logger.info("✅ Login Uber bem sucedido!")
                return True
            
            # Verificar se há elementos do dashboard
            rendimentos_link = self.page.locator('text=/Rendimentos|Earnings/')
            if await rendimentos_link.count() > 0:
                logger.info("✅ Login Uber bem sucedido!")
                return True
            
            logger.warning("⚠️ Não foi possível confirmar login")
            return False
            
        except Exception as e:
            logger.error(f"❌ Erro no login Uber: {e}")
            await self.screenshot("erro_login")
            return False
    
    async def ir_para_rendimentos(self) -> bool:
        """Navegar para a secção de Rendimentos"""
        try:
            logger.info("📑 A navegar para Rendimentos...")
            
            # Clicar no link "Rendimentos" no menu
            rendimentos_link = self.page.locator('a:has-text("Rendimentos"), a:has-text("Earnings"), [href*="earnings"]').first
            
            if await rendimentos_link.count() > 0:
                await rendimentos_link.click()
                await self.page.wait_for_timeout(3000)
                logger.info("✅ Navegou para Rendimentos")
            else:
                # Tentar URL direta
                await self.page.goto("https://fleet.uber.com/p3/earnings", wait_until="networkidle")
                await self.page.wait_for_timeout(3000)
            
            await self.screenshot("pagina_rendimentos")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao navegar para Rendimentos: {e}")
            return False
    
    async def selecionar_periodo(self, data_inicio: str, data_fim: str) -> bool:
        """
        Selecionar período de datas para os rendimentos.
        
        Args:
            data_inicio: Data início no formato YYYY-MM-DD
            data_fim: Data fim no formato YYYY-MM-DD
        """
        try:
            logger.info(f"📅 A selecionar período: {data_inicio} a {data_fim}")
            
            # Procurar dropdown de intervalo de pagamento
            intervalo_dropdown = self.page.locator('text=/Intervalo de pagamento|Payment interval/').first
            
            if await intervalo_dropdown.count() > 0:
                await intervalo_dropdown.click()
                await self.page.wait_for_timeout(1000)
                logger.info("✅ Dropdown de intervalo aberto")
                
                await self.screenshot("dropdown_intervalo")
                
                # Procurar opção "Intervalo personalizado"
                personalizado = self.page.locator('text=/Intervalo personalizado|Custom interval/').first
                if await personalizado.count() > 0:
                    await personalizado.click()
                    await self.page.wait_for_timeout(1000)
                    logger.info("✅ Selecionou intervalo personalizado")
                    
                    # Preencher datas
                    # Converter para formato DD/MM/YYYY
                    dt_inicio = datetime.strptime(data_inicio, "%Y-%m-%d")
                    dt_fim = datetime.strptime(data_fim, "%Y-%m-%d")
                    
                    # Procurar campos de data
                    date_inputs = self.page.locator('input[type="date"], input[placeholder*="data"], input[placeholder*="date"]')
                    input_count = await date_inputs.count()
                    
                    if input_count >= 2:
                        await date_inputs.nth(0).fill(data_inicio)
                        await date_inputs.nth(1).fill(data_fim)
                        logger.info("✅ Datas preenchidas")
                    
                    # Aplicar filtro
                    aplicar_btn = self.page.locator('button:has-text("Aplicar"), button:has-text("Apply")').first
                    if await aplicar_btn.count() > 0:
                        await aplicar_btn.click()
                        await self.page.wait_for_timeout(3000)
                else:
                    # Tentar selecionar período pré-definido mais próximo
                    logger.info("📋 A procurar período pré-definido...")
            
            await self.screenshot("periodo_selecionado")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao selecionar período: {e}")
            return False
    
    async def extrair_dados_tabela(self) -> List[Dict[str, Any]]:
        """
        Extrair dados da tabela de rendimentos dos motoristas.
        
        Colunas esperadas:
        - Nome do motorista
        - Rendimentos totais
        - Reembolsos e despesas
        - Ajustes
        - Pagamento
        - Rendimentos líquidos
        """
        try:
            logger.info("📊 A extrair dados da tabela...")
            
            dados = []
            
            # Aguardar tabela carregar
            await self.page.wait_for_timeout(2000)
            
            # Procurar tabela de rendimentos
            tabela = self.page.locator('table, [role="table"]').first
            
            if await tabela.count() > 0:
                # Extrair linhas
                linhas = tabela.locator('tr, [role="row"]')
                linha_count = await linhas.count()
                logger.info(f"📋 Encontradas {linha_count} linhas na tabela")
                
                for i in range(1, linha_count):  # Skip header
                    try:
                        linha = linhas.nth(i)
                        celulas = linha.locator('td, [role="cell"]')
                        celula_count = await celulas.count()
                        
                        if celula_count >= 5:
                            motorista = {
                                "id": str(uuid.uuid4()),
                                "nome": await celulas.nth(0).inner_text() if celula_count > 0 else "",
                                "rendimentos_totais": await celulas.nth(1).inner_text() if celula_count > 1 else "0",
                                "reembolsos_despesas": await celulas.nth(2).inner_text() if celula_count > 2 else "0",
                                "ajustes": await celulas.nth(3).inner_text() if celula_count > 3 else "0",
                                "pagamento": await celulas.nth(4).inner_text() if celula_count > 4 else "0",
                                "rendimentos_liquidos": await celulas.nth(5).inner_text() if celula_count > 5 else "0",
                            }
                            
                            # Limpar valores monetários
                            for key in ["rendimentos_totais", "reembolsos_despesas", "ajustes", "pagamento", "rendimentos_liquidos"]:
                                val = motorista[key]
                                # Remover símbolos de moeda e converter para float
                                val = val.replace("€", "").replace("$", "").replace(",", ".").strip()
                                try:
                                    motorista[key] = float(val) if val else 0.0
                                except:
                                    motorista[key] = 0.0
                            
                            dados.append(motorista)
                            logger.info(f"📋 Motorista: {motorista['nome']} - €{motorista['rendimentos_liquidos']}")
                    except Exception as e:
                        logger.warning(f"⚠️ Erro ao processar linha {i}: {e}")
                        continue
            
            logger.info(f"✅ Extraídos {len(dados)} registos de motoristas")
            return dados
            
        except Exception as e:
            logger.error(f"❌ Erro ao extrair dados: {e}")
            return []
    
    async def fazer_download_relatorio(self) -> Optional[str]:
        """
        Fazer download do relatório de rendimentos.
        
        Tenta usar o botão "Fazer o download do relatório" na página de Rendimentos.
        """
        try:
            logger.info("📥 A fazer download do relatório...")
            
            # Procurar botão de download
            download_btn = self.page.locator('button:has-text("Fazer o download"), button:has-text("Download"), a:has-text("download")').first
            
            if await download_btn.count() > 0 and await download_btn.is_visible():
                logger.info("✅ Botão de download encontrado")
                
                # Tentar download
                try:
                    async with self.page.expect_download(timeout=30000) as download_info:
                        await download_btn.click()
                    
                    download = await download_info.value
                    
                    # Guardar ficheiro
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    original_name = download.suggested_filename or f"uber_rendimentos_{timestamp}.csv"
                    filepath = self.downloads_path / original_name
                    
                    await download.save_as(str(filepath))
                    
                    logger.info(f"🎉 Relatório Uber descarregado: {filepath}")
                    return str(filepath)
                    
                except Exception as e:
                    logger.warning(f"⚠️ Download direto falhou: {e}")
            
            # Alternativa: Ir para secção Relatórios e gerar
            logger.info("📋 A tentar via secção Relatórios...")
            
            relatorios_link = self.page.locator('a:has-text("Relatórios"), a:has-text("Reports")').first
            if await relatorios_link.count() > 0:
                await relatorios_link.click()
                await self.page.wait_for_timeout(3000)
                
                # Gerar relatório
                gerar_btn = self.page.locator('button:has-text("Gerar relatório"), button:has-text("Generate report")').first
                if await gerar_btn.count() > 0:
                    await gerar_btn.click()
                    await self.page.wait_for_timeout(2000)
                    
                    await self.screenshot("modal_gerar_relatorio")
                    
                    # Selecionar tipo de relatório "Pagamentos de motorista"
                    tipo_dropdown = self.page.locator('text=/Tipo de relatório|Report type/').first
                    if await tipo_dropdown.count() > 0:
                        await tipo_dropdown.click()
                        await self.page.wait_for_timeout(500)
                        
                        pagamentos_option = self.page.locator('text=/Pagamentos de motorista|Driver payments/').first
                        if await pagamentos_option.count() > 0:
                            await pagamentos_option.click()
                    
                    # Clicar Gerar
                    gerar_final = self.page.locator('button:has-text("Gerar"), button:has-text("Generate")').first
                    if await gerar_final.count() > 0:
                        await gerar_final.click()
                        await self.page.wait_for_timeout(5000)
                        
                        logger.info("✅ Relatório a ser gerado...")
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Erro ao fazer download: {e}")
            return None


async def executar_rpa_uber(
    email: str,
    password: str,
    data_inicio: str,
    data_fim: str,
    sms_code: str = None,
    headless: bool = True
) -> Dict[str, Any]:
    """
    Executar RPA Uber para extrair rendimentos.
    
    Args:
        email: Email de login Uber
        password: Password Uber
        data_inicio: Data início (YYYY-MM-DD)
        data_fim: Data fim (YYYY-MM-DD)
        sms_code: Código SMS para autenticação (opcional)
        headless: Executar sem interface gráfica
    
    Returns:
        Dicionário com resultados da extração
    """
    resultado = {
        "sucesso": False,
        "ficheiro": None,
        "motoristas": [],
        "total_motoristas": 0,
        "total_rendimentos": 0.0,
        "mensagem": None,
        "logs": []
    }
    
    rpa = UberRPA(email, password, sms_code)
    
    try:
        await rpa.iniciar_browser(headless=headless)
        resultado["logs"].append("Browser iniciado")
        
        # Login
        if not await rpa.fazer_login():
            resultado["mensagem"] = "Falha no login Uber. Verifique as credenciais."
            resultado["logs"].append("Login falhou")
            return resultado
        resultado["logs"].append("Login bem sucedido")
        
        # Ir para Rendimentos
        await rpa.ir_para_rendimentos()
        resultado["logs"].append("Navegou para Rendimentos")
        
        # Selecionar período
        await rpa.selecionar_periodo(data_inicio, data_fim)
        resultado["logs"].append(f"Período selecionado: {data_inicio} a {data_fim}")
        
        # Extrair dados da tabela
        motoristas = await rpa.extrair_dados_tabela()
        
        if motoristas:
            resultado["motoristas"] = motoristas
            resultado["total_motoristas"] = len(motoristas)
            resultado["total_rendimentos"] = sum(m.get("rendimentos_liquidos", 0) for m in motoristas)
            resultado["logs"].append(f"Extraídos {len(motoristas)} motoristas")
        
        # Tentar download do relatório
        ficheiro = await rpa.fazer_download_relatorio()
        if ficheiro:
            resultado["ficheiro"] = ficheiro
            resultado["logs"].append(f"Relatório descarregado: {ficheiro}")
        
        resultado["sucesso"] = True
        resultado["mensagem"] = f"Extração Uber concluída! {len(motoristas)} motoristas, total €{resultado['total_rendimentos']:.2f}"
        
    except Exception as e:
        resultado["mensagem"] = f"Erro: {str(e)}"
        resultado["logs"].append(f"Erro: {str(e)}")
        logger.error(f"❌ Erro geral Uber: {e}")
        
    finally:
        await rpa.fechar_browser()
    
    return resultado
