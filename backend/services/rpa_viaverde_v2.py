"""
RPA Via Verde V2 - Versão com Download Direto de Excel
Usa o botão "Exportar" na página de Movimentos para download direto
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)


class ViaVerdeRPA:
    """Automação Via Verde - Download direto de Excel via página de Movimentos"""
    
    LOGIN_URL = "https://www.viaverde.pt/empresas/minha-via-verde/extratos-movimentos"
    MOVIMENTOS_URL = "https://www.viaverde.pt/empresas/minha-via-verde/extratos-movimentos"
    
    # Seletores do formulário de login
    EMAIL_SELECTOR = "#txtUsername"
    PASSWORD_SELECTOR = "#txtPassword"
    
    def __init__(self, email: str, password: str):
        self.email = email
        self.password = password
        self.browser = None
        self.page = None
        self.downloads_path = Path("/tmp/viaverde_downloads")
        self.downloads_path.mkdir(exist_ok=True)
    
    async def iniciar_browser(self, headless: bool = True):
        """Iniciar browser Playwright"""
        from playwright.async_api import async_playwright
        
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            accept_downloads=True
        )
        self.page = await self.context.new_page()
        logger.info("✅ Browser iniciado")
    
    async def fechar_browser(self):
        """Fechar browser"""
        try:
            if self.browser:
                await self.browser.close()
            if hasattr(self, 'playwright') and self.playwright:
                await self.playwright.stop()
        except:
            pass
    
    async def screenshot(self, nome: str) -> str:
        """Capturar screenshot"""
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        path = f"/tmp/viaverde_{nome}_{ts}.png"
        await self.page.screenshot(path=path)
        return path
    
    async def fazer_login(self) -> bool:
        """Fazer login na Via Verde"""
        try:
            logger.info(f"🔐 A fazer login: {self.email}")
            
            await self.page.goto(self.LOGIN_URL, wait_until="networkidle")
            await self.page.wait_for_timeout(3000)
            
            # Aceitar cookies
            try:
                cookies_btn = self.page.locator('button:has-text("Aceitar")')
                if await cookies_btn.count() > 0:
                    await cookies_btn.first.click()
                    await self.page.wait_for_timeout(1000)
            except:
                pass
            
            # Aguardar formulário
            await self.page.wait_for_selector(self.EMAIL_SELECTOR, timeout=15000)
            
            # Preencher credenciais
            await self.page.locator(self.EMAIL_SELECTOR).fill(self.email)
            await self.page.wait_for_timeout(500)
            await self.page.locator(self.PASSWORD_SELECTOR).fill(self.password)
            await self.page.wait_for_timeout(500)
            
            await self.screenshot("campos_preenchidos")
            
            # Clicar em Login
            try:
                login_btn = self.page.locator('button.login-btn, button:has-text("Login")').first
                if await login_btn.count() > 0:
                    await login_btn.click()
                else:
                    await self.page.keyboard.press('Enter')
            except:
                await self.page.keyboard.press('Enter')
            
            await self.page.wait_for_timeout(8000)
            await self.screenshot("apos_login")
            
            # Verificar sucesso
            if await self.page.locator(self.EMAIL_SELECTOR).is_visible():
                logger.error("❌ Login falhou - formulário ainda visível")
                return False
            
            logger.info("✅ Login bem sucedido!")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro no login: {e}")
            return False
    
    async def ir_para_movimentos(self) -> bool:
        """
        Ficar no tab Extratos (onde estão os filtros de data).
        
        NOTA: Após análise do site Via Verde, descobrimos que:
        - Tab "Extratos" = Tem filtros de data (De/Até) em formato MM/YYYY
        - Tab "Movimentos" = Lista de extratos SEM filtros de data
        
        Portanto, devemos FICAR no tab "Extratos" para poder filtrar por data.
        """
        try:
            logger.info("📑 A verificar se estamos no tab Extratos (onde estão os filtros)...")
            
            await self.page.wait_for_timeout(2000)
            await self.screenshot("verificando_tab")
            
            # Verificar se já estamos no tab Extratos
            # Se o tab Movimentos estiver ativo, clicar em Extratos
            movimentos_active = self.page.locator('a.active:has-text("Movimentos"), li.active:has-text("Movimentos"), [class*="selected"]:has-text("Movimentos")')
            
            if await movimentos_active.count() > 0:
                logger.info("📋 Tab Movimentos está ativo, a mudar para Extratos...")
                
                # Clicar no tab Extratos
                extratos_tab = self.page.locator('a:has-text("Extratos"):not(.active), li a:has-text("Extratos")').first
                if await extratos_tab.count() > 0:
                    await extratos_tab.click()
                    await self.page.wait_for_timeout(3000)
                    logger.info("✅ Tab Extratos clicado")
            else:
                logger.info("✅ Já estamos no tab Extratos (correto)")
            
            await self.screenshot("tab_extratos")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao navegar para Extratos: {e}")
            return False
    
    async def expandir_filtro_e_selecionar_datas(self, data_inicio: str, data_fim: str) -> bool:
        """
        Selecionar datas usando os campos de data da Via Verde.
        
        Baseado nos screenshots:
        - Campo "De:" com ícone de calendário
        - Campo "Até:" com ícone de calendário
        - Botão "Filtrar" (verde)
        
        Formato entrada: DD/MM/YYYY
        """
        try:
            logger.info(f"📅 A selecionar período: {data_inicio} a {data_fim}")
            
            await self.screenshot("antes_filtro_datas")
            await self.page.wait_for_timeout(2000)
            
            # Parse das datas
            dia_inicio, mes_inicio, ano_inicio = map(int, data_inicio.split('/'))
            dia_fim, mes_fim, ano_fim = map(int, data_fim.split('/'))
            
            logger.info(f"📅 De: {dia_inicio}/{mes_inicio}/{ano_inicio}")
            logger.info(f"📅 Até: {dia_fim}/{mes_fim}/{ano_fim}")
            
            # Método 1: Preencher directamente os inputs de data
            # Baseado no screenshot, os campos são inputs com formato DD/MM/YYYY
            
            # Procurar inputs dentro da área "Filtrar por"
            date_input_selectors = [
                'input[type="text"][value*="/"]',  # Inputs com data
                'input.form-control',
                'input[placeholder*="data"]',
                'input[placeholder*="DD"]',
            ]
            
            # Tentar encontrar o container do filtro
            filtrar_container = self.page.locator('text=Filtrar por:').first
            if await filtrar_container.count() > 0:
                logger.info("✅ Container 'Filtrar por:' encontrado")
            
            # Procurar o campo "De:"
            de_label = self.page.locator('text=De:').first
            if await de_label.count() > 0:
                logger.info("✅ Label 'De:' encontrado")
                # Procurar o input próximo
                de_input = self.page.locator('input').filter(has=self.page.locator('[class*="calendar"], [class*="date"]')).first
                
            # Método alternativo: Procurar todos os inputs de data VISÍVEIS na página
            all_inputs = await self.page.locator('input:visible').all()
            date_inputs = []
            for inp in all_inputs:
                try:
                    inp_type = await inp.get_attribute('type')
                    # Ignorar inputs hidden
                    if inp_type == 'hidden':
                        continue
                    
                    value = await inp.get_attribute('value')
                    placeholder = await inp.get_attribute('placeholder') or ''
                    inp_class = await inp.get_attribute('class') or ''
                    
                    # Verificar se é um campo de data (tem "/" no valor ou "data" no placeholder/class)
                    is_date_field = (
                        (value and '/' in value and len(value) <= 10) or
                        'data' in placeholder.lower() or
                        'date' in placeholder.lower() or
                        'calendar' in inp_class.lower() or
                        'date' in inp_class.lower()
                    )
                    
                    if is_date_field:
                        is_visible = await inp.is_visible()
                        if is_visible:
                            date_inputs.append(inp)
                            logger.info(f"   📅 Input de data encontrado: value='{value}' placeholder='{placeholder}'")
                except Exception as e:
                    pass
            
            logger.info(f"📋 Encontrados {len(date_inputs)} inputs de data visíveis")
            
            # Se encontramos pelo menos 2 inputs de data
            if len(date_inputs) >= 2:
                try:
                    # Limpar e preencher o campo "De:" (primeiro input)
                    de_input = date_inputs[0]
                    await de_input.click()
                    await self.page.wait_for_timeout(300)
                    await de_input.fill('')  # Limpar
                    await de_input.fill(data_inicio)
                    logger.info(f"✅ Campo 'De:' preenchido com {data_inicio}")
                    
                    # Fechar calendário se abriu
                    await self.page.keyboard.press('Escape')
                    await self.page.wait_for_timeout(300)
                    
                    # Limpar e preencher o campo "Até:" (segundo input)
                    ate_input = date_inputs[1]
                    await ate_input.click()
                    await self.page.wait_for_timeout(300)
                    await ate_input.fill('')  # Limpar
                    await ate_input.fill(data_fim)
                    logger.info(f"✅ Campo 'Até:' preenchido com {data_fim}")
                    
                    # Fechar calendário se abriu
                    await self.page.keyboard.press('Escape')
                    await self.page.wait_for_timeout(300)
                    
                except Exception as e:
                    logger.warning(f"⚠️ Erro ao preencher datas: {e}")
            else:
                # Fallback: Tentar método JavaScript para preencher datas
                logger.warning(f"⚠️ Não encontrou inputs de data visíveis, tentando método JavaScript...")
                try:
                    await self.page.evaluate(f'''() => {{
                        // Procurar todos os inputs com valor de data
                        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
                        const dateInputs = inputs.filter(inp => {{
                            const val = inp.value || '';
                            return val.match(/\\d{{1,2}}\\/\\d{{1,2}}\\/\\d{{4}}/);
                        }});
                        
                        console.log('Found', dateInputs.length, 'date inputs');
                        
                        if (dateInputs.length >= 2) {{
                            // Preencher primeiro input (De:)
                            dateInputs[0].value = '{data_inicio}';
                            dateInputs[0].dispatchEvent(new Event('input', {{ bubbles: true }}));
                            dateInputs[0].dispatchEvent(new Event('change', {{ bubbles: true }}));
                            
                            // Preencher segundo input (Até:)
                            dateInputs[1].value = '{data_fim}';
                            dateInputs[1].dispatchEvent(new Event('input', {{ bubbles: true }}));
                            dateInputs[1].dispatchEvent(new Event('change', {{ bubbles: true }}));
                            
                            console.log('Dates filled via JavaScript');
                        }}
                    }}''')
                    logger.info(f"✅ Datas preenchidas via JavaScript")
                except Exception as js_err:
                    logger.warning(f"⚠️ Erro no método JavaScript: {js_err}")
            
            # Clicar no botão "Filtrar"
            await self.page.wait_for_timeout(500)
            
            filtrar_btn_selectors = [
                'button:has-text("Filtrar")',
                'a:has-text("Filtrar")',
                'input[value="Filtrar"]',
                '.btn-success:has-text("Filtrar")',
                '.btn-primary:has-text("Filtrar")',
            ]
            
            for selector in filtrar_btn_selectors:
                try:
                    filtrar_btn = self.page.locator(selector).first
                    if await filtrar_btn.count() > 0 and await filtrar_btn.is_visible():
                        await filtrar_btn.click()
                        await self.page.wait_for_timeout(3000)
                        logger.info("✅ Botão Filtrar clicado")
                        break
                except:
                    continue
            
            await self.screenshot("apos_filtrar")
            
            # Verificar se há movimentos filtrados (com timeout curto)
            try:
                movimentos_locator = self.page.locator('text=/\\d+ movimentos? filtrados?/i').first
                movimentos_text = await movimentos_locator.text_content(timeout=5000)
                if movimentos_text:
                    logger.info(f"📊 {movimentos_text}")
            except Exception as e:
                logger.info("📊 Não foi possível verificar texto de movimentos filtrados (continuando)")
            
            return True
            
        except Exception as e:
            logger.warning(f"⚠️ Erro ao selecionar datas (continuando): {e}")
            await self.screenshot("erro_datas")
            return True  # Continuar mesmo com erro
    
    async def exportar_excel_direto(self) -> Optional[str]:
        """
        Exportar Excel usando o botão "Exportar" na página de Extratos e Movimentos.
        
        Baseado no screenshot:
        - O botão está à DIREITA do texto "X movimentos filtrados"
        - Tem ícone verde de download + texto "Exportar" + seta dropdown
        - Dropdown mostra: Excel, PDF
        """
        try:
            logger.info("📥 A exportar Excel...")
            
            await self.screenshot("antes_export")
            await self.page.wait_for_timeout(2000)
            
            # Scroll para mostrar a área dos resultados
            await self.page.evaluate("window.scrollTo(0, 500)")
            await self.page.wait_for_timeout(1000)
            
            # Verificar se há movimentos filtrados
            try:
                mov_label = self.page.locator('text=/\\d+ movimentos? filtrados?/i').first
                if await mov_label.count() > 0:
                    movimentos_text = await mov_label.text_content()
                    logger.info(f"📊 {movimentos_text}")
            except:
                pass
            
            await self.screenshot("area_exportar")
            
            # Procurar TODOS os elementos que contêm "Exportar"
            all_exportar = await self.page.locator('text=Exportar').all()
            logger.info(f"🔍 Encontrados {len(all_exportar)} elementos com 'Exportar'")
            
            exportar_btn = None
            
            for i, elem in enumerate(all_exportar):
                try:
                    text = await elem.text_content()
                    text_clean = text.strip().lower() if text else ""
                    is_visible = await elem.is_visible()
                    
                    logger.info(f"  [{i}] '{text_clean}' - visível: {is_visible}")
                    
                    # O botão correcto tem APENAS "Exportar" (pode ter espaços/ícones)
                    # e NÃO contém "extratos", "detalhes", etc.
                    if is_visible and text_clean:
                        # Verificar se é só "exportar"
                        if text_clean == "exportar" or text_clean.strip() == "exportar":
                            exportar_btn = elem
                            logger.info(f"✅ Botão correcto encontrado: índice {i}")
                            break
                        # Aceitar se não tem outras palavras problemáticas
                        elif "exportar" in text_clean and "extrato" not in text_clean and "detalhe" not in text_clean and len(text_clean) < 20:
                            exportar_btn = elem
                            logger.info(f"✅ Botão provável encontrado: índice {i}")
                            break
                except Exception as e:
                    logger.warning(f"  [{i}] Erro: {e}")
                    continue
            
            if not exportar_btn:
                logger.warning("⚠️ Botão Exportar não encontrado")
                await self.screenshot("export_nao_encontrado")
                return None
            
            # Clicar no botão para abrir o dropdown
            logger.info("🖱️ A clicar no botão Exportar...")
            
            # Tentar vários métodos de clique (AngularJS pode precisar de eventos específicos)
            try:
                await exportar_btn.click()
            except:
                # Fallback: clicar via JavaScript
                await exportar_btn.dispatch_event('click')
            
            # Esperar dropdown abrir com mais tempo
            await self.page.wait_for_timeout(2000)
            await self.screenshot("dropdown_aberto")
            
            # Tentar clicar em "Excel" directamente via JavaScript (AngularJS)
            # O elemento tem ng-click="vm.exportTransactionsExcel()"
            try:
                # Primeiro, tentar encontrar e clicar normalmente
                excel_option = self.page.locator('a:has-text("Excel"):not(:has-text("Exportar"))').first
                if await excel_option.count() > 0:
                    is_visible = await excel_option.is_visible()
                    logger.info(f"📥 Opção Excel encontrada, visível: {is_visible}")
                    
                    if is_visible:
                        async with self.page.expect_download(timeout=30000) as download_info:
                            await excel_option.click()
                            logger.info("🖱️ Clicou em Excel")
                        
                        download = await download_info.value
                        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                        original_name = download.suggested_filename or f"viaverde_{timestamp}.xlsx"
                        filepath = self.downloads_path / original_name
                        await download.save_as(str(filepath))
                        logger.info(f"🎉 Excel exportado: {filepath}")
                        return str(filepath)
                    else:
                        # Se não está visível, tentar forçar clique ou executar JS
                        logger.info("📥 A tentar clique forçado em Excel...")
                        
                        # Método 1: Clique forçado
                        try:
                            async with self.page.expect_download(timeout=20000) as download_info:
                                await excel_option.click(force=True)
                            download = await download_info.value
                            filepath = self.downloads_path / (download.suggested_filename or f"viaverde_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx")
                            await download.save_as(str(filepath))
                            logger.info(f"🎉 Excel exportado via clique forçado: {filepath}")
                            return str(filepath)
                        except Exception as e:
                            logger.warning(f"⚠️ Clique forçado falhou: {e}")
                        
                        # Método 2: Executar função Angular directamente
                        logger.info("📥 A tentar via JavaScript...")
                        try:
                            async with self.page.expect_download(timeout=20000) as download_info:
                                await self.page.evaluate("document.querySelector('a[ng-click*=\"exportTransactionsExcel\"]').click()")
                            download = await download_info.value
                            filepath = self.downloads_path / (download.suggested_filename or f"viaverde_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx")
                            await download.save_as(str(filepath))
                            logger.info(f"🎉 Excel exportado via JS: {filepath}")
                            return str(filepath)
                        except Exception as e:
                            logger.warning(f"⚠️ JS falhou: {e}")
                
            except Exception as e:
                logger.error(f"❌ Erro ao clicar em Excel: {e}")
            
        except Exception as e:
            logger.error(f"❌ Erro ao exportar: {e}")
            await self.screenshot("export_erro")
            return None


def parse_viaverde_excel(filepath: str) -> List[Dict[str, Any]]:
    """
    Parser do ficheiro Excel exportado da Via Verde
    
    Colunas esperadas:
    - License Plate: Matrícula
    - Entry Date: Data de entrada
    - Entry Point / Exit Point: Locais
    - Value / Liquid Value: Valor
    - Market Description: Tipo (Portagens, etc)
    """
    import pandas as pd
    
    try:
        # Ler Excel
        if filepath.endswith('.csv'):
            for encoding in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    df = pd.read_csv(filepath, encoding=encoding, sep=None, engine='python')
                    break
                except:
                    continue
        else:
            df = pd.read_excel(filepath)
        
        logger.info(f"📋 Ficheiro lido: {len(df)} linhas")
        logger.info(f"📋 Colunas originais: {list(df.columns)}")
        
        movimentos = []
        
        for _, row in df.iterrows():
            movimento = {
                "id": str(uuid.uuid4()),
                "data": None,
                "hora": None,
                "matricula": None,
                "identificador": None,
                "local": None,
                "local_entrada": None,
                "local_saida": None,
                "descricao": None,
                "valor": 0.0,
                "valor_liquido": 0.0,
                "tipo": "portagem",
                "market_description": "portagens",
                "servico": None,
                "meio_pagamento": None
            }
            
            # License Plate → Matrícula
            if 'License Plate' in df.columns and pd.notna(row.get('License Plate')):
                movimento["matricula"] = str(row['License Plate']).strip().upper()
            
            # IAI → Identificador (Via Verde ID)
            if 'IAI' in df.columns and pd.notna(row.get('IAI')):
                movimento["identificador"] = str(row['IAI'])
                movimento["viaverde_id"] = str(row['IAI'])
            
            # OBU → Número do dispositivo
            if 'OBU' in df.columns and pd.notna(row.get('OBU')):
                movimento["obu"] = str(row['OBU'])
            
            # Entry Date → Data
            if 'Entry Date' in df.columns and pd.notna(row.get('Entry Date')):
                dt_value = row['Entry Date']
                if isinstance(dt_value, datetime):
                    movimento["data"] = dt_value.strftime("%Y-%m-%d")
                    movimento["hora"] = dt_value.strftime("%H:%M:%S")
                elif isinstance(dt_value, str):
                    # Formato: 2026-01-29 23:56:08
                    try:
                        dt = datetime.strptime(dt_value[:19], "%Y-%m-%d %H:%M:%S")
                        movimento["data"] = dt.strftime("%Y-%m-%d")
                        movimento["hora"] = dt.strftime("%H:%M:%S")
                    except:
                        movimento["data"] = dt_value[:10]
            
            # Entry Point / Exit Point → Locais
            entry_point = row.get('Entry Point', '') if 'Entry Point' in df.columns else ''
            exit_point = row.get('Exit Point', '') if 'Exit Point' in df.columns else ''
            
            if pd.notna(entry_point):
                movimento["local_entrada"] = str(entry_point)
            if pd.notna(exit_point):
                movimento["local_saida"] = str(exit_point)
            
            # Descrição combinada
            if movimento["local_entrada"] and movimento["local_saida"]:
                movimento["local"] = f"{movimento['local_entrada']} → {movimento['local_saida']}"
                movimento["descricao"] = movimento["local"]
            elif movimento["local_entrada"]:
                movimento["local"] = movimento["local_entrada"]
                movimento["descricao"] = movimento["local_entrada"]
            
            # Value → Valor
            if 'Value' in df.columns and pd.notna(row.get('Value')):
                try:
                    movimento["valor"] = abs(float(row['Value']))
                except:
                    pass
            
            # Liquid Value → Valor Líquido
            if 'Liquid Value' in df.columns and pd.notna(row.get('Liquid Value')):
                try:
                    movimento["valor_liquido"] = abs(float(row['Liquid Value']))
                except:
                    pass
            
            # Usar valor líquido se disponível
            if movimento["valor_liquido"] > 0:
                movimento["valor"] = movimento["valor_liquido"]
            
            # Market Description → Tipo
            if 'Market Description' in df.columns and pd.notna(row.get('Market Description')):
                market = str(row['Market Description']).lower()
                movimento["market_description"] = market
                if 'parque' in market or 'estacionamento' in market:
                    movimento["tipo"] = "parque"
                else:
                    movimento["tipo"] = "portagem"
            
            # Service Description → Serviço
            if 'Service Description' in df.columns and pd.notna(row.get('Service Description')):
                movimento["servico"] = str(row['Service Description'])
            
            # Payment Method → Meio de Pagamento
            if 'Payment Method' in df.columns and pd.notna(row.get('Payment Method')):
                movimento["meio_pagamento"] = str(row['Payment Method'])
            
            # Calcular semana/ano
            if movimento["data"]:
                try:
                    dt = datetime.strptime(movimento["data"], "%Y-%m-%d")
                    iso_cal = dt.isocalendar()
                    movimento["semana"] = iso_cal[1]
                    movimento["ano"] = iso_cal[0]
                except:
                    pass
            
            # Só adicionar se tiver dados válidos
            if movimento["valor"] > 0:
                movimentos.append(movimento)
        
        logger.info(f"📊 Parseados {len(movimentos)} movimentos com valor > 0")
        return movimentos
        
    except Exception as e:
        logger.error(f"❌ Erro ao parsear Excel: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []


async def executar_rpa_viaverde_v2(
    email: str,
    password: str,
    data_inicio: str,
    data_fim: str,
    headless: bool = True
) -> Dict[str, Any]:
    """
    Executar RPA Via Verde - Download direto de Excel
    
    Usa o botão "Exportar" na página de Movimentos para download direto,
    sem necessidade de receber email.
    """
    resultado = {
        "sucesso": False,
        "ficheiro": None,
        "movimentos": [],
        "total_movimentos": 0,
        "mensagem": None,
        "screenshots": [],
        "logs": []
    }
    
    rpa = ViaVerdeRPA(email, password)
    
    try:
        await rpa.iniciar_browser(headless=headless)
        resultado["logs"].append("Browser iniciado")
        
        # Login
        if not await rpa.fazer_login():
            resultado["mensagem"] = "Falha no login. Verifique as credenciais."
            resultado["logs"].append("Login falhou")
            return resultado
        resultado["logs"].append("Login bem sucedido")
        
        # Ir para Movimentos
        await rpa.ir_para_movimentos()
        resultado["logs"].append("Navegou para Movimentos")
        
        # Converter datas para formato DD/MM/YYYY
        from datetime import datetime as dt
        dt_inicio = dt.strptime(data_inicio, "%Y-%m-%d")
        dt_fim = dt.strptime(data_fim, "%Y-%m-%d")
        data_inicio_fmt = dt_inicio.strftime("%d/%m/%Y")
        data_fim_fmt = dt_fim.strftime("%d/%m/%Y")
        
        # Selecionar datas e filtrar
        await rpa.expandir_filtro_e_selecionar_datas(data_inicio_fmt, data_fim_fmt)
        resultado["logs"].append(f"Período selecionado: {data_inicio_fmt} a {data_fim_fmt}")
        
        # Exportar Excel diretamente
        ficheiro = await rpa.exportar_excel_direto()
        
        if ficheiro:
            resultado["ficheiro"] = ficheiro
            resultado["logs"].append(f"Excel exportado: {ficheiro}")
            
            # Parsear o Excel
            movimentos_todos = parse_viaverde_excel(ficheiro)
            
            if movimentos_todos:
                # FILTRAR movimentos pelo período solicitado
                from datetime import datetime as dt
                dt_inicio_filter = dt.strptime(data_inicio, "%Y-%m-%d")
                dt_fim_filter = dt.strptime(data_fim, "%Y-%m-%d")
                
                movimentos_filtrados = []
                for mov in movimentos_todos:
                    if mov.get("data"):
                        try:
                            mov_data = dt.strptime(mov["data"], "%Y-%m-%d")
                            # Incluir se a data está dentro do período
                            if dt_inicio_filter <= mov_data <= dt_fim_filter:
                                movimentos_filtrados.append(mov)
                        except:
                            pass
                
                logger.info(f"📊 Filtrados {len(movimentos_filtrados)} de {len(movimentos_todos)} movimentos para o período {data_inicio} a {data_fim}")
                resultado["logs"].append(f"Filtrados {len(movimentos_filtrados)} de {len(movimentos_todos)} movimentos")
                
                resultado["movimentos"] = movimentos_filtrados
                resultado["total_movimentos"] = len(movimentos_filtrados)
            
            resultado["sucesso"] = True
            resultado["mensagem"] = f"Excel exportado com sucesso! {resultado['total_movimentos']} movimentos no período {data_inicio} a {data_fim}."
        else:
            resultado["mensagem"] = "Não foi possível exportar o Excel"
            resultado["logs"].append("Exportação falhou")
        
    except Exception as e:
        resultado["mensagem"] = f"Erro: {str(e)}"
        resultado["logs"].append(f"Erro: {str(e)}")
        logger.error(f"❌ Erro geral: {e}")
        
    finally:
        await rpa.fechar_browser()
    
    return resultado

