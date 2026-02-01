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
        """Navegar para o tab Movimentos"""
        try:
            logger.info("📑 A navegar para Movimentos...")
            
            # Clicar no tab "Movimentos"
            movimentos_tab = self.page.locator('a:has-text("Movimentos"), li:has-text("Movimentos")').first
            if await movimentos_tab.count() > 0:
                await movimentos_tab.click()
                await self.page.wait_for_timeout(3000)
                logger.info("✅ Tab Movimentos clicado")
            
            await self.screenshot("tab_movimentos")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao navegar para Movimentos: {e}")
            return False
    
    async def expandir_filtro_e_selecionar_datas(self, data_inicio: str, data_fim: str) -> bool:
        """Expandir filtro e selecionar datas"""
        try:
            logger.info(f"📅 A selecionar período: {data_inicio} a {data_fim}")
            
            await self.screenshot("antes_filtro")
            
            # O título "Filtrar por:" não é clicável
            # Os campos de data devem estar visíveis ou precisamos expandir
            
            # Tentar preencher data início (De:)
            de_input = self.page.locator('input[ng-model="vm.fromDateExtracts"]').first
            
            if await de_input.count() > 0:
                # Verificar se está visível
                if not await de_input.is_visible():
                    # Tentar expandir filtro clicando noutra área
                    try:
                        expand_btn = self.page.locator('[ng-click*="filter"], .filter-toggle, .expand-filter').first
                        if await expand_btn.count() > 0:
                            await expand_btn.click()
                            await self.page.wait_for_timeout(1000)
                    except:
                        pass
                
                # Preencher data início
                await de_input.click()
                await self.page.wait_for_timeout(300)
                await self.page.keyboard.press('Control+a')
                await self.page.keyboard.type(data_inicio)
                await self.page.keyboard.press('Tab')
                logger.info(f"✅ Data início: {data_inicio}")
            else:
                logger.warning("⚠️ Campo de data início não encontrado")
            
            await self.page.wait_for_timeout(500)
            
            # Preencher data fim (Até:)
            ate_input = self.page.locator('input[ng-model="vm.toDateExtracts"]').first
            if await ate_input.count() > 0:
                await ate_input.click()
                await self.page.wait_for_timeout(300)
                await self.page.keyboard.press('Control+a')
                await self.page.keyboard.type(data_fim)
                await self.page.keyboard.press('Escape')
                logger.info(f"✅ Data fim: {data_fim}")
            else:
                logger.warning("⚠️ Campo de data fim não encontrado")
            
            await self.page.wait_for_timeout(500)
            await self.screenshot("datas_preenchidas")
            
            # Clicar em Filtrar
            filtrar_btn = self.page.locator('button:has-text("Filtrar"), a:has-text("Filtrar")').first
            if await filtrar_btn.count() > 0:
                await filtrar_btn.click()
                await self.page.wait_for_timeout(3000)
                logger.info("✅ Filtro aplicado")
            
            await self.screenshot("resultados_filtrados")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao selecionar datas: {e}")
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

