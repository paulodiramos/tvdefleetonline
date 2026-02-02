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
        Tentar selecionar datas usando os calendários popup do site Via Verde.
        
        NOTA: Se a seleção de datas falhar, o sistema continuará e filtrará
        os dados após o download do Excel.
        
        Formato entrada: DD/MM/YYYY
        """
        try:
            logger.info(f"📅 A tentar selecionar período: {data_inicio} a {data_fim}")
            
            await self.screenshot("antes_filtro")
            await self.page.wait_for_timeout(2000)
            
            # Parse das datas
            dia_inicio, mes_inicio, ano_inicio = map(int, data_inicio.split('/'))
            dia_fim, mes_fim, ano_fim = map(int, data_fim.split('/'))
            
            logger.info(f"📅 De: {dia_inicio}/{mes_inicio}/{ano_inicio}")
            logger.info(f"📅 Até: {dia_fim}/{mes_fim}/{ano_fim}")
            
            # Tentar encontrar e clicar nos campos de data
            # Os campos podem ser inputs com formato MM/YYYY ou DD/MM/YYYY
            
            # Método 1: Procurar inputs de data e clicar diretamente
            date_inputs = self.page.locator('input[value*="/"]')
            input_count = await date_inputs.count()
            logger.info(f"📋 Encontrados {input_count} inputs de data")
            
            if input_count >= 2:
                # Tentar preencher o primeiro input (De)
                try:
                    de_input = date_inputs.nth(0)
                    await de_input.click()
                    await self.page.wait_for_timeout(500)
                    
                    # Verificar se abriu um calendário
                    calendar = self.page.locator('table, .datepicker, [class*="calendar"]')
                    if await calendar.count() > 0:
                        logger.info("✅ Calendário aberto")
                        await self.screenshot("calendario_de_aberto")
                        
                        # Tentar clicar no dia desejado
                        # (A filtragem será feita depois, então não é crítico)
                        await self.page.keyboard.press('Escape')
                except Exception as e:
                    logger.warning(f"⚠️ Não foi possível interagir com campo De: {e}")
            
            # Tentar clicar no botão Filtrar de qualquer forma
            await self.page.wait_for_timeout(500)
            
            filtrar_btn = self.page.locator('button:has-text("Filtrar"), a:has-text("Filtrar")').first
            if await filtrar_btn.count() > 0:
                try:
                    await filtrar_btn.click()
                    await self.page.wait_for_timeout(2000)
                    logger.info("✅ Botão Filtrar clicado")
                except:
                    pass
            
            await self.screenshot("apos_tentativa_filtro")
            
            # Retornar True mesmo que a filtragem no site não funcione
            # porque vamos filtrar os dados após o download
            logger.info("📋 A filtragem será aplicada após download do Excel")
            return True
            
        except Exception as e:
            logger.warning(f"⚠️ Erro ao tentar selecionar datas (continuando): {e}")
            await self.screenshot("erro_datas")
            # Retornar True para continuar com o download
            return True
    
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
                        
                        # Selecionar CSV no dropdown (Via Verde não tem opção Excel direta)
                        # O dropdown mostra: PDF, XML, CSV, HTML
                        csv_selectors = [
                            'a:has-text("CSV")',
                            'li a:has-text("CSV")',
                            '.dropdown-menu a:has-text("CSV")',
                            'ul.dropdown-menu a:text("CSV")',
                            'a:text-is("CSV")',
                        ]
                        
                        for csv_sel in csv_selectors:
                            try:
                                csv_option = self.page.locator(csv_sel).first
                                
                                if await csv_option.count() > 0 and await csv_option.is_visible():
                                    logger.info(f"✅ Opção CSV encontrada: {csv_sel}")
                                    
                                    # Tentar com expect_download (pode falhar)
                                    try:
                                        async with self.page.expect_download(timeout=10000) as download_info:
                                            await csv_option.click()
                                        
                                        download = await download_info.value
                                        
                                        # Guardar ficheiro
                                        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                                        original_name = download.suggested_filename or f"viaverde_{timestamp}.csv"
                                        filepath = self.downloads_path / original_name
                                        
                                        await download.save_as(str(filepath))
                                        
                                        logger.info(f"🎉 CSV exportado com sucesso: {filepath}")
                                        return str(filepath)
                                    except Exception as download_error:
                                        logger.warning(f"⚠️ Download direto falhou: {download_error}")
                                        
                                        # Alternativa: clicar e verificar ficheiro depois
                                        await csv_option.click(force=True)
                                        await self.page.wait_for_timeout(5000)
                                        
                                        # Verificar se há ficheiro CSV na pasta de downloads
                                        import os
                                        import glob
                                        csv_files = glob.glob(str(self.downloads_path / "*.csv"))
                                        csv_files.sort(key=os.path.getmtime, reverse=True)
                                        
                                        if csv_files:
                                            latest_csv = csv_files[0]
                                            logger.info(f"🎉 CSV encontrado na pasta: {latest_csv}")
                                            return latest_csv
                                        
                                        logger.warning("⚠️ Nenhum CSV encontrado após clicar")
                                        break
                            except Exception as e:
                                logger.warning(f"⚠️ CSV selector {csv_sel} falhou: {e}")
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

