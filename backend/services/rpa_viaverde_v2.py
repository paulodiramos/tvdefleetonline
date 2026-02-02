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
        """Navegar para o tab Movimentos e garantir que estamos na vista correta"""
        try:
            logger.info("📑 A navegar para Movimentos...")
            
            # A página tem dois tabs: "Extratos" e "Movimentos"
            # Precisamos clicar no tab "Movimentos" que NÃO está ativo (verde)
            
            # Primeiro, verificar se já estamos na página correta
            await self.page.wait_for_timeout(2000)
            
            # Procurar o tab "Movimentos" - pode ser um link ou botão
            movimentos_selectors = [
                'a:text-is("Movimentos")',
                'button:text-is("Movimentos")',
                'li:has-text("Movimentos") a',
                'div[role="tab"]:has-text("Movimentos")',
                '.nav-tabs a:has-text("Movimentos")',
                'ul.nav a:has-text("Movimentos")',
                # Tab não selecionado (sem fundo verde)
                'a:has-text("Movimentos"):not(.active)',
            ]
            
            for selector in movimentos_selectors:
                movimentos_tab = self.page.locator(selector).first
                if await movimentos_tab.count() > 0:
                    is_visible = await movimentos_tab.is_visible()
                    if is_visible:
                        await movimentos_tab.click()
                        await self.page.wait_for_timeout(3000)
                        logger.info(f"✅ Tab Movimentos clicado via: {selector}")
                        break
            
            await self.screenshot("tab_movimentos")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao navegar para Movimentos: {e}")
            return False
    
    async def expandir_filtro_e_selecionar_datas(self, data_inicio: str, data_fim: str) -> bool:
        """
        Expandir filtro e selecionar datas usando interação com calendário popup.
        
        A interface Via Verde tem:
        - Secção "Filtrar por:" que pode estar colapsada
        - Dois campos de input com ícones de calendário (De e Até)
        - Um calendário popup com navegação por mês (setas < >)
        - Grid de dias para seleção
        - Botões "Limpar" e "Filtrar"
        
        Formato esperado: DD/MM/YYYY
        """
        try:
            logger.info(f"📅 A selecionar período: {data_inicio} a {data_fim}")
            
            await self.screenshot("antes_filtro")
            
            # PASSO 1: Expandir o filtro se estiver colapsado
            # Procurar por "Filtrar por:" ou área de filtro colapsável
            filtrar_section = self.page.locator('text=/Filtrar por/', 'text=Filtrar', '[class*="filter"]').first
            
            # Verificar se há uma seta para baixo (indica filtro colapsado)
            expand_selectors = [
                'text=/Filtrar por:/ >> svg',
                '[class*="filter"] >> button',
                '[class*="filter-header"]',
                'div:has-text("Filtrar por:") >> [class*="arrow"]',
                'div:has-text("Filtrar por:") >> svg',
                'div:has-text("Filtrar por:")',
            ]
            
            for selector in expand_selectors:
                try:
                    expand_btn = self.page.locator(selector).first
                    if await expand_btn.count() > 0 and await expand_btn.is_visible():
                        await expand_btn.click()
                        await self.page.wait_for_timeout(1500)
                        logger.info(f"✅ Filtro expandido via: {selector}")
                        await self.screenshot("filtro_expandido")
                        break
                except:
                    pass
            
            await self.page.wait_for_timeout(1000)
            
            # Parse das datas
            from datetime import datetime as dt
            dia_inicio, mes_inicio, ano_inicio = data_inicio.split('/')
            dia_fim, mes_fim, ano_fim = data_fim.split('/')
            
            # Converter para inteiros
            dia_inicio = int(dia_inicio)
            mes_inicio = int(mes_inicio)
            ano_inicio = int(ano_inicio)
            dia_fim = int(dia_fim)
            mes_fim = int(mes_fim)
            ano_fim = int(ano_fim)
            
            logger.info(f"📅 Data início: {dia_inicio}/{mes_inicio}/{ano_inicio}")
            logger.info(f"📅 Data fim: {dia_fim}/{mes_fim}/{ano_fim}")
            
            # PASSO 2: Encontrar os campos de data
            # Os campos têm ícones de calendário e mostram datas no formato DD/MM/YYYY
            
            de_input = None
            ate_input = None
            
            # Procurar inputs que tenham valor com formato de data ou ícone de calendário
            # Na Via Verde, os inputs estão dentro de divs com ícone de calendário
            
            date_input_selectors = [
                # Inputs com valor de data visível
                'input[value*="/"]',
                # Inputs dentro de containers com ícone de calendário
                'div:has(svg[class*="calendar"]) input',
                'div:has([class*="calendar-icon"]) input',
                # Inputs com placeholders de data
                'input[placeholder*="dd/mm"]',
                'input[placeholder*="DD/MM"]',
                # Inputs tipo date ou datetime
                'input[type="date"]',
                'input[type="text"][class*="date"]',
            ]
            
            # Primeiro, tirar screenshot para debug
            await self.screenshot("procurando_inputs")
            
            # Procurar todos os inputs visíveis e verificar quais têm formato de data
            all_visible_inputs = self.page.locator('input:visible')
            input_count = await all_visible_inputs.count()
            logger.info(f"📋 Total de inputs visíveis: {input_count}")
            
            date_inputs_found = []
            for i in range(min(input_count, 20)):
                try:
                    inp = all_visible_inputs.nth(i)
                    value = await inp.get_attribute('value') or ''
                    placeholder = await inp.get_attribute('placeholder') or ''
                    inp_type = await inp.get_attribute('type') or ''
                    inp_class = await inp.get_attribute('class') or ''
                    
                    # Verificar se parece um campo de data
                    is_date_field = False
                    
                    # Formato DD/MM/YYYY
                    import re
                    if re.match(r'\d{2}/\d{2}/\d{4}', value):
                        is_date_field = True
                    # Formato mm/dd/yyyy
                    elif re.match(r'\d{1,2}/\d{1,2}/\d{4}', value):
                        is_date_field = True
                    # Placeholder de data
                    elif 'data' in placeholder.lower() or 'date' in placeholder.lower():
                        is_date_field = True
                    elif 'mm/dd' in placeholder.lower() or 'dd/mm' in placeholder.lower():
                        is_date_field = True
                    
                    if is_date_field:
                        date_inputs_found.append({
                            'index': i,
                            'input': inp,
                            'value': value,
                            'placeholder': placeholder
                        })
                        logger.info(f"📋 Input data encontrado [{i}]: value='{value}', placeholder='{placeholder}'")
                except Exception as e:
                    pass
            
            logger.info(f"📋 Encontrados {len(date_inputs_found)} inputs de data")
            
            # Se encontrámos pelo menos 2 inputs de data, usar o primeiro para "De" e segundo para "Até"
            if len(date_inputs_found) >= 2:
                de_input = date_inputs_found[0]['input']
                ate_input = date_inputs_found[1]['input']
                logger.info(f"✅ Usando inputs de data: De='{date_inputs_found[0]['value']}', Até='{date_inputs_found[1]['value']}'")
            elif len(date_inputs_found) == 1:
                de_input = date_inputs_found[0]['input']
                logger.info(f"⚠️ Apenas 1 input de data encontrado")
            
            # PASSO 3: Preencher as datas
            
            # Método de seleção de data via calendário popup
            async def selecionar_data_calendario(input_element, dia: int, mes: int, ano: int) -> bool:
                """Selecionar uma data específica usando o calendário popup"""
                try:
                    # Clicar no input para abrir o calendário
                    await input_element.click()
                    await self.page.wait_for_timeout(500)
                    
                    # Esperar que o calendário popup apareça
                    calendar_popup = self.page.locator('table.calendar, .datepicker, .calendar-popup, [class*="calendar"], div:has(table):has(button:has-text("<"))')
                    await calendar_popup.first.wait_for(timeout=3000)
                    
                    await self.screenshot(f"calendario_aberto_{dia}_{mes}")
                    
                    # Obter mês/ano atual do calendário
                    # O cabeçalho geralmente mostra "janeiro 2026" ou similar
                    header = self.page.locator('text=/[a-zA-Zç]+ \\d{4}/, .calendar-header, [class*="month"]')
                    header_text = ""
                    if await header.count() > 0:
                        header_text = await header.first.inner_text()
                        logger.info(f"📅 Cabeçalho calendário: {header_text}")
                    
                    # Mapa de meses em português
                    meses_pt = {
                        'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4,
                        'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
                        'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
                    }
                    
                    # Extrair mês e ano atual do header
                    mes_atual = None
                    ano_atual = None
                    for mes_nome, mes_num in meses_pt.items():
                        if mes_nome in header_text.lower():
                            mes_atual = mes_num
                            # Extrair ano
                            import re
                            ano_match = re.search(r'(\d{4})', header_text)
                            if ano_match:
                                ano_atual = int(ano_match.group(1))
                            break
                    
                    if mes_atual is None or ano_atual is None:
                        logger.warning(f"⚠️ Não foi possível extrair mês/ano de: {header_text}")
                        # Tentar método alternativo - preencher diretamente
                        return False
                    
                    logger.info(f"📅 Calendário atual: {mes_atual}/{ano_atual}, destino: {mes}/{ano}")
                    
                    # Navegar para o mês correto
                    max_navegacao = 24  # Máximo de meses para navegar
                    navegacoes = 0
                    
                    while (mes_atual != mes or ano_atual != ano) and navegacoes < max_navegacao:
                        # Calcular direção
                        if ano_atual > ano or (ano_atual == ano and mes_atual > mes):
                            # Navegar para trás (mês anterior)
                            prev_btn = self.page.locator('button:has-text("<"), a:has-text("<"), [class*="prev"], [aria-label*="anterior"]').first
                            if await prev_btn.count() > 0:
                                await prev_btn.click()
                                await self.page.wait_for_timeout(300)
                                mes_atual -= 1
                                if mes_atual < 1:
                                    mes_atual = 12
                                    ano_atual -= 1
                        else:
                            # Navegar para frente (próximo mês)
                            next_btn = self.page.locator('button:has-text(">"), a:has-text(">"), [class*="next"], [aria-label*="próximo"]').first
                            if await next_btn.count() > 0:
                                await next_btn.click()
                                await self.page.wait_for_timeout(300)
                                mes_atual += 1
                                if mes_atual > 12:
                                    mes_atual = 1
                                    ano_atual += 1
                        
                        navegacoes += 1
                        logger.info(f"📅 Navegação {navegacoes}: agora em {mes_atual}/{ano_atual}")
                    
                    await self.screenshot(f"calendario_mes_correto_{mes}_{ano}")
                    
                    # Selecionar o dia
                    # Os dias são geralmente em células de tabela ou divs
                    day_selector = f'td:has-text("{dia}"):not([class*="disabled"]):not([class*="other"]), button:has-text("{dia}"), div.day:has-text("{dia}"), span:has-text("{dia}")'
                    
                    # Procurar pelo dia específico
                    day_cells = self.page.locator(f'td, button, div.day, span.day')
                    day_count = await day_cells.count()
                    
                    day_found = False
                    for i in range(day_count):
                        cell = day_cells.nth(i)
                        try:
                            text = await cell.inner_text()
                            text = text.strip()
                            
                            # Verificar se é o dia correto e não está desabilitado
                            if text == str(dia):
                                class_attr = await cell.get_attribute('class') or ''
                                # Evitar dias de outros meses ou desabilitados
                                if 'disabled' not in class_attr and 'other' not in class_attr and 'outside' not in class_attr:
                                    await cell.click()
                                    day_found = True
                                    logger.info(f"✅ Dia {dia} selecionado")
                                    break
                        except:
                            pass
                    
                    if not day_found:
                        # Tentar clicar diretamente pelo texto
                        exact_day = self.page.locator(f'td:text-is("{dia}"), button:text-is("{dia}")').first
                        if await exact_day.count() > 0:
                            await exact_day.click()
                            day_found = True
                            logger.info(f"✅ Dia {dia} selecionado (método alternativo)")
                    
                    await self.page.wait_for_timeout(500)
                    return day_found
                    
                except Exception as e:
                    logger.error(f"❌ Erro ao selecionar data no calendário: {e}")
                    return False
            
            # Método alternativo: preencher diretamente o campo de texto
            async def preencher_data_direto(input_element, data_str: str) -> bool:
                """Preencher data diretamente no campo de input"""
                try:
                    await input_element.click()
                    await self.page.wait_for_timeout(200)
                    
                    # Limpar campo
                    await self.page.keyboard.press('Control+a')
                    await self.page.wait_for_timeout(100)
                    
                    # Digitar a data
                    await input_element.fill(data_str)
                    await self.page.wait_for_timeout(200)
                    
                    # Pressionar Tab para confirmar
                    await self.page.keyboard.press('Tab')
                    await self.page.wait_for_timeout(300)
                    
                    logger.info(f"✅ Data preenchida diretamente: {data_str}")
                    return True
                except Exception as e:
                    logger.error(f"❌ Erro ao preencher data: {e}")
                    return False
            
            # Tentar selecionar data de início
            if de_input and await de_input.count() > 0:
                # Primeiro tentar método direto (mais simples)
                sucesso_inicio = await preencher_data_direto(de_input, data_inicio)
                
                if not sucesso_inicio:
                    # Se falhar, tentar via calendário
                    sucesso_inicio = await selecionar_data_calendario(de_input, dia_inicio, mes_inicio, ano_inicio)
                
                if sucesso_inicio:
                    logger.info(f"✅ Data início configurada: {data_inicio}")
                else:
                    logger.warning(f"⚠️ Não foi possível configurar data início")
            else:
                logger.warning("⚠️ Campo de data início não encontrado")
            
            await self.page.wait_for_timeout(500)
            
            # Tentar selecionar data de fim
            if ate_input and await ate_input.count() > 0:
                # Primeiro tentar método direto
                sucesso_fim = await preencher_data_direto(ate_input, data_fim)
                
                if not sucesso_fim:
                    # Se falhar, tentar via calendário
                    sucesso_fim = await selecionar_data_calendario(ate_input, dia_fim, mes_fim, ano_fim)
                
                if sucesso_fim:
                    logger.info(f"✅ Data fim configurada: {data_fim}")
                else:
                    logger.warning(f"⚠️ Não foi possível configurar data fim")
            else:
                logger.warning("⚠️ Campo de data fim não encontrado")
            
            await self.page.wait_for_timeout(500)
            await self.screenshot("datas_preenchidas")
            
            # Fechar qualquer calendário que esteja aberto (clicar fora ou pressionar Escape)
            await self.page.keyboard.press('Escape')
            await self.page.wait_for_timeout(300)
            
            # Clicar no botão "Filtrar"
            filtrar_btn = self.page.locator('button:has-text("Filtrar"), a:has-text("Filtrar"), input[value="Filtrar"]').first
            if await filtrar_btn.count() > 0:
                await filtrar_btn.click()
                await self.page.wait_for_timeout(3000)
                logger.info("✅ Filtro aplicado")
            else:
                logger.warning("⚠️ Botão Filtrar não encontrado")
            
            await self.screenshot("resultados_filtrados")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao selecionar datas: {e}")
            import traceback
            logger.error(traceback.format_exc())
            await self.screenshot("erro_datas")
            return False
    
    async def exportar_excel_direto(self) -> Optional[str]:
        """
        Exportar Excel usando o botão "Exportar" na página de Movimentos
        Este botão faz download direto sem precisar de email!
        """
        try:
            logger.info("📥 A exportar Excel diretamente...")
            
            await self.screenshot("antes_export")
            
            # Procurar o botão "Exportar" na página de movimentos
            exportar_btn_selectors = [
                'a.link-download.dropdown-link',
                'a.dropdown-link:has-text("Exportar")',
                'a:has-text("Exportar excel")',
                'text=Exportar excel'
            ]
            
            for selector in exportar_btn_selectors:
                try:
                    exportar_btn = self.page.locator(selector).first
                    if await exportar_btn.count() > 0 and await exportar_btn.is_visible():
                        logger.info(f"✅ Botão Exportar encontrado: {selector}")
                        await exportar_btn.click()
                        await self.page.wait_for_timeout(1500)
                        
                        await self.screenshot("dropdown_exportar")
                        
                        # Selecionar Excel no dropdown
                        # O dropdown mostra "Excel" e "PDF"
                        excel_selectors = [
                            'a:has-text("Excel")',
                            'li a:has-text("Excel")',
                            '.dropdown-menu a:has-text("Excel")',
                            'ul.dropdown-menu a:text("Excel")'
                        ]
                        
                        for excel_sel in excel_selectors:
                            try:
                                excel_option = self.page.locator(excel_sel).first
                                
                                if await excel_option.count() > 0 and await excel_option.is_visible():
                                    logger.info(f"✅ Opção Excel encontrada: {excel_sel}")
                                    
                                    # Aguardar download
                                    async with self.page.expect_download(timeout=30000) as download_info:
                                        await excel_option.click()
                                    
                                    download = await download_info.value
                                    
                                    # Guardar ficheiro
                                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                                    original_name = download.suggested_filename or f"viaverde_{timestamp}.xlsx"
                                    filepath = self.downloads_path / original_name
                                    
                                    await download.save_as(str(filepath))
                                    
                                    logger.info(f"🎉 Excel exportado com sucesso: {filepath}")
                                    return str(filepath)
                            except Exception as e:
                                logger.warning(f"⚠️ Excel selector {excel_sel} falhou: {e}")
                                continue
                        
                        break
                except Exception as e:
                    logger.warning(f"⚠️ Tentativa com {selector} falhou: {e}")
                    continue
            
            # Se não encontrou o botão de exportar, tentar alternativa
            logger.warning("⚠️ Botão de exportar não encontrado, a tentar alternativa...")
            await self.screenshot("export_erro")
            return None
            
        except Exception as e:
            logger.error(f"❌ Erro ao exportar Excel: {e}")
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
            
            # IAI → Identificador
            if 'IAI' in df.columns and pd.notna(row.get('IAI')):
                movimento["identificador"] = str(row['IAI'])
            
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
            movimentos = parse_viaverde_excel(ficheiro)
            
            if movimentos:
                resultado["movimentos"] = movimentos
                resultado["total_movimentos"] = len(movimentos)
                resultado["logs"].append(f"Parseados {len(movimentos)} movimentos")
            
            resultado["sucesso"] = True
            resultado["mensagem"] = f"Excel exportado com sucesso! {len(movimentos)} movimentos encontrados."
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

