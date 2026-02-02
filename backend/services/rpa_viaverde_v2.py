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
        Selecionar datas usando os calendários popup do site Via Verde.
        
        Processo descoberto via vídeo do utilizador:
        1. Clicar no ícone de calendário ao lado do campo "De"
        2. O calendário abre com mês/ano no topo (ex: "janeiro 2026")
        3. Navegar com setas < > para o mês correto
        4. Clicar no dia específico para selecionar
        5. Repetir para o campo "Até"
        6. Clicar em "Filtrar" para aplicar
        
        Formato entrada: DD/MM/YYYY
        """
        try:
            logger.info(f"📅 A selecionar período: {data_inicio} a {data_fim}")
            
            await self.screenshot("antes_filtro")
            await self.page.wait_for_timeout(2000)
            
            # Parse das datas
            dia_inicio, mes_inicio, ano_inicio = map(int, data_inicio.split('/'))
            dia_fim, mes_fim, ano_fim = map(int, data_fim.split('/'))
            
            logger.info(f"📅 De: {dia_inicio}/{mes_inicio}/{ano_inicio}")
            logger.info(f"📅 Até: {dia_fim}/{mes_fim}/{ano_fim}")
            
            # Mapa de meses em português
            meses_pt = {
                1: 'janeiro', 2: 'fevereiro', 3: 'março', 4: 'abril',
                5: 'maio', 6: 'junho', 7: 'julho', 8: 'agosto',
                9: 'setembro', 10: 'outubro', 11: 'novembro', 12: 'dezembro'
            }
            
            async def selecionar_data_via_calendario(campo_label: str, dia: int, mes: int, ano: int) -> bool:
                """Selecionar uma data específica clicando no ícone de calendário"""
                try:
                    logger.info(f"📅 A selecionar {campo_label}: {dia}/{mes}/{ano}")
                    
                    # Encontrar o ícone de calendário próximo ao campo
                    # Os ícones estão próximos dos inputs com formato MM/YYYY ou DD/MM/YYYY
                    
                    # Procurar por todos os ícones de calendário (SVG ou imagem)
                    calendar_icons = self.page.locator('svg[class*="calendar"], [class*="calendar-icon"], img[src*="calendar"], button:has(svg)')
                    icon_count = await calendar_icons.count()
                    logger.info(f"📋 Encontrados {icon_count} ícones de calendário")
                    
                    # O primeiro ícone é para "De", o segundo para "Até"
                    icon_index = 0 if campo_label == "De" else 1
                    
                    if icon_count > icon_index:
                        calendar_icon = calendar_icons.nth(icon_index)
                        await calendar_icon.click()
                        await self.page.wait_for_timeout(1000)
                        logger.info(f"✅ Ícone de calendário {campo_label} clicado")
                    else:
                        # Alternativa: clicar diretamente no input de data
                        date_inputs = self.page.locator('input[value*="/"]')
                        input_count = await date_inputs.count()
                        if input_count > icon_index:
                            await date_inputs.nth(icon_index).click()
                            await self.page.wait_for_timeout(1000)
                            logger.info(f"✅ Input de data {campo_label} clicado")
                        else:
                            logger.warning(f"⚠️ Não encontrou campo {campo_label}")
                            return False
                    
                    await self.screenshot(f"calendario_{campo_label}_aberto")
                    
                    # Agora o calendário deve estar aberto
                    # Verificar o mês/ano atual no cabeçalho do calendário
                    
                    # O cabeçalho mostra algo como "janeiro 2026"
                    max_navegacoes = 24
                    for nav in range(max_navegacoes):
                        # Procurar o cabeçalho do calendário
                        header = self.page.locator('text=/[a-zA-Záéíóúç]+ \\d{4}/')
                        header_text = ""
                        
                        if await header.count() > 0:
                            header_text = await header.first.inner_text()
                            header_text = header_text.lower().strip()
                            logger.info(f"📅 Cabeçalho calendário: {header_text}")
                        
                        # Extrair mês e ano do cabeçalho
                        mes_atual = None
                        ano_atual = None
                        
                        for mes_num, mes_nome in meses_pt.items():
                            if mes_nome in header_text:
                                mes_atual = mes_num
                                # Extrair ano
                                import re
                                ano_match = re.search(r'(\d{4})', header_text)
                                if ano_match:
                                    ano_atual = int(ano_match.group(1))
                                break
                        
                        if mes_atual is None or ano_atual is None:
                            logger.warning(f"⚠️ Não conseguiu extrair mês/ano de: {header_text}")
                            break
                        
                        logger.info(f"📅 Calendário atual: {mes_atual}/{ano_atual}, destino: {mes}/{ano}")
                        
                        # Verificar se estamos no mês/ano correto
                        if mes_atual == mes and ano_atual == ano:
                            logger.info(f"✅ Mês/ano correto!")
                            break
                        
                        # Navegar para o mês correto
                        if ano_atual > ano or (ano_atual == ano and mes_atual > mes):
                            # Navegar para trás
                            prev_btn = self.page.locator('button:has-text("<"), a:has-text("<"), [class*="prev"]').first
                            if await prev_btn.count() > 0:
                                await prev_btn.click()
                                await self.page.wait_for_timeout(500)
                                logger.info("📅 Navegou para mês anterior")
                        else:
                            # Navegar para frente
                            next_btn = self.page.locator('button:has-text(">"), a:has-text(">"), [class*="next"]').first
                            if await next_btn.count() > 0:
                                await next_btn.click()
                                await self.page.wait_for_timeout(500)
                                logger.info("📅 Navegou para próximo mês")
                    
                    await self.screenshot(f"calendario_{campo_label}_mes_correto")
                    
                    # Agora selecionar o dia
                    # Os dias estão numa grid, procurar pelo número do dia
                    
                    # Procurar células com o dia específico
                    day_selectors = [
                        f'td:text-is("{dia}")',
                        f'button:text-is("{dia}")',
                        f'div.day:text-is("{dia}")',
                        f'span:text-is("{dia}")',
                    ]
                    
                    day_clicked = False
                    for selector in day_selectors:
                        try:
                            day_elements = self.page.locator(selector)
                            count = await day_elements.count()
                            
                            for i in range(count):
                                day_el = day_elements.nth(i)
                                
                                # Verificar se está visível e não é de outro mês
                                if await day_el.is_visible():
                                    class_attr = await day_el.get_attribute('class') or ''
                                    
                                    # Evitar dias desabilitados ou de outros meses
                                    if 'disabled' not in class_attr and 'other' not in class_attr and 'outside' not in class_attr:
                                        await day_el.click()
                                        await self.page.wait_for_timeout(500)
                                        logger.info(f"✅ Dia {dia} selecionado via {selector}")
                                        day_clicked = True
                                        break
                            
                            if day_clicked:
                                break
                        except Exception as e:
                            continue
                    
                    if not day_clicked:
                        logger.warning(f"⚠️ Não conseguiu selecionar dia {dia}")
                    
                    await self.screenshot(f"calendario_{campo_label}_dia_selecionado")
                    return day_clicked
                    
                except Exception as e:
                    logger.error(f"❌ Erro ao selecionar data {campo_label}: {e}")
                    return False
            
            # Selecionar data "De"
            sucesso_de = await selecionar_data_via_calendario("De", dia_inicio, mes_inicio, ano_inicio)
            await self.page.wait_for_timeout(1000)
            
            # Selecionar data "Até"
            sucesso_ate = await selecionar_data_via_calendario("Até", dia_fim, mes_fim, ano_fim)
            await self.page.wait_for_timeout(1000)
            
            await self.screenshot("datas_preenchidas")
            
            # Fechar qualquer calendário aberto
            await self.page.keyboard.press('Escape')
            await self.page.wait_for_timeout(500)
            
            # Clicar no botão "Filtrar"
            filtrar_btn = self.page.locator('button:has-text("Filtrar"), a:has-text("Filtrar"), input[value="Filtrar"]').first
            if await filtrar_btn.count() > 0:
                await filtrar_btn.click()
                await self.page.wait_for_timeout(3000)
                logger.info("✅ Filtro aplicado")
            else:
                logger.warning("⚠️ Botão Filtrar não encontrado")
            
            await self.screenshot("resultados_filtrados")
            return sucesso_de and sucesso_ate
            
        except Exception as e:
            logger.error(f"❌ Erro ao selecionar datas: {e}")
            import traceback
            logger.error(traceback.format_exc())
            await self.screenshot("erro_datas")
            return False
            
            # PASSO 3: Preencher os campos de data
            
            # Função para preencher data no formato MM/YYYY
            async def preencher_data_mmyyyy(input_element, data_mmyyyy: str) -> bool:
                """Preencher data no formato MM/YYYY"""
                try:
                    await input_element.click()
                    await self.page.wait_for_timeout(300)
                    
                    # Limpar campo
                    await self.page.keyboard.press('Control+a')
                    await self.page.wait_for_timeout(100)
                    
                    # Digitar a data
                    await input_element.fill(data_mmyyyy)
                    await self.page.wait_for_timeout(300)
                    
                    # Pressionar Tab para confirmar
                    await self.page.keyboard.press('Tab')
                    await self.page.wait_for_timeout(300)
                    
                    logger.info(f"✅ Data preenchida: {data_mmyyyy}")
                    return True
                except Exception as e:
                    logger.error(f"❌ Erro ao preencher data: {e}")
                    return False
            
            # Preencher campo "De:"
            if de_input and await de_input.count() > 0:
                sucesso_de = await preencher_data_mmyyyy(de_input, data_inicio_mmyyyy)
                if sucesso_de:
                    logger.info(f"✅ Campo 'De:' configurado: {data_inicio_mmyyyy}")
                else:
                    logger.warning(f"⚠️ Não foi possível configurar campo 'De:'")
            else:
                logger.warning("⚠️ Campo 'De:' não encontrado")
            
            await self.page.wait_for_timeout(500)
            
            # Preencher campo "Até:"
            if ate_input and await ate_input.count() > 0:
                sucesso_ate = await preencher_data_mmyyyy(ate_input, data_fim_mmyyyy)
                if sucesso_ate:
                    logger.info(f"✅ Campo 'Até:' configurado: {data_fim_mmyyyy}")
                else:
                    logger.warning(f"⚠️ Não foi possível configurar campo 'Até:'")
            else:
                logger.warning("⚠️ Campo 'Até:' não encontrado")
            
            await self.page.wait_for_timeout(500)
            await self.screenshot("datas_preenchidas")
            
            # Fechar qualquer calendário aberto
            await self.page.keyboard.press('Escape')
            await self.page.wait_for_timeout(300)
            
            # PASSO 4: Clicar no botão "Filtrar"
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

