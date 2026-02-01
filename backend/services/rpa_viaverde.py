"""
RPA Via Verde - Script de Automação Playwright
Extrai movimentos/portagens entre datas específicas
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)


def parse_viaverde_file(filepath: str) -> List[Dict[str, Any]]:
    """
    Parser do ficheiro exportado da Via Verde (CSV ou Excel)
    
    Estrutura esperada:
    - Data/Hora
    - Matrícula
    - Identificador (Via Verde)
    - Local/Descrição
    - Valor
    - Tipo (Portagem, Parque, etc)
    
    Returns:
        Lista de movimentos parseados
    """
    import pandas as pd
    
    try:
        # Determinar tipo de ficheiro e ler
        if filepath.endswith('.csv'):
            # Tentar diferentes encodings comuns em Portugal
            for encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
                try:
                    df = pd.read_csv(filepath, encoding=encoding, sep=None, engine='python')
                    logger.info(f"📄 CSV lido com encoding: {encoding}")
                    break
                except Exception as e:
                    continue
            else:
                logger.error("❌ Não conseguiu ler o CSV com nenhum encoding")
                return []
        else:
            df = pd.read_excel(filepath)
            logger.info("📄 Excel lido com sucesso")
        
        logger.info(f"📋 Colunas encontradas: {list(df.columns)}")
        logger.info(f"📋 Primeiras linhas:\n{df.head()}")
        
        # Normalizar nomes das colunas (remover espaços, lowercase)
        df.columns = [col.strip().lower().replace(' ', '_').replace('/', '_') for col in df.columns]
        logger.info(f"📋 Colunas normalizadas: {list(df.columns)}")
        
        movimentos = []
        
        for _, row in df.iterrows():
            # Tentar extrair dados com vários nomes possíveis de colunas
            movimento = {
                "id": str(uuid.uuid4()),
                "data": None,
                "hora": None,
                "matricula": None,
                "identificador": None,
                "local": None,
                "descricao": None,
                "valor": 0.0,
                "tipo": None,
                "market_description": "portagens"
            }
            
            # Data/Hora
            for col in ['data_hora', 'data__hora', 'data', 'date', 'datetime', 'data_movimento']:
                if col in df.columns and pd.notna(row.get(col)):
                    dt_value = row.get(col)
                    if isinstance(dt_value, datetime):
                        movimento["data"] = dt_value.strftime("%Y-%m-%d")
                        movimento["hora"] = dt_value.strftime("%H:%M:%S")
                        movimento["entry_date"] = dt_value.strftime("%Y-%m-%d")
                    elif isinstance(dt_value, str):
                        # Tentar parsear diferentes formatos de data
                        dt_value = dt_value.strip()
                        for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M"]:
                            try:
                                dt = datetime.strptime(dt_value[:len(fmt)], fmt)
                                movimento["data"] = dt.strftime("%Y-%m-%d")
                                movimento["hora"] = dt.strftime("%H:%M:%S") if len(dt_value) > 10 else "00:00:00"
                                movimento["entry_date"] = dt.strftime("%Y-%m-%d")
                                break
                            except:
                                continue
                        else:
                            movimento["data"] = dt_value[:10]
                            movimento["entry_date"] = dt_value[:10]
                    break
            
            # Matrícula
            for col in ['matrícula', 'matricula', 'plate', 'veiculo', 'vehicle', 'viatura']:
                if col in df.columns and pd.notna(row.get(col)):
                    movimento["matricula"] = str(row.get(col)).strip().upper()
                    break
            
            # Identificador Via Verde
            for col in ['identificador', 'id_viaverde', 'identifier', 'tag', 'id']:
                if col in df.columns and pd.notna(row.get(col)):
                    movimento["identificador"] = str(row.get(col)).strip()
                    break
            
            # Local/Descrição
            for col in ['local', 'descrição', 'descricao', 'description', 'location', 'ponto']:
                if col in df.columns and pd.notna(row.get(col)):
                    movimento["local"] = str(row.get(col)).strip()
                    movimento["descricao"] = str(row.get(col)).strip()
                    break
            
            # Valor
            for col in ['valor', 'value', 'amount', 'total', 'preço', 'preco', 'montante']:
                if col in df.columns and pd.notna(row.get(col)):
                    try:
                        val = row.get(col)
                        if isinstance(val, str):
                            val = val.replace('€', '').replace(',', '.').replace(' ', '').strip()
                        movimento["valor"] = abs(float(val))
                    except:
                        pass
                    break
            
            # Tipo (Portagem, Parque, etc)
            for col in ['tipo', 'type', 'categoria', 'category', 'produto']:
                if col in df.columns and pd.notna(row.get(col)):
                    tipo = str(row.get(col)).strip().lower()
                    movimento["tipo"] = tipo
                    if 'parque' in tipo or 'estacionamento' in tipo:
                        movimento["market_description"] = "parques"
                    break
            
            # Calcular semana/ano da data
            if movimento["data"]:
                try:
                    dt = datetime.strptime(movimento["data"], "%Y-%m-%d")
                    iso_cal = dt.isocalendar()
                    movimento["semana"] = iso_cal[1]
                    movimento["ano"] = iso_cal[0]
                except:
                    pass
            
            # Só adicionar se tiver dados válidos
            if movimento["data"] and movimento["valor"] > 0:
                movimentos.append(movimento)
        
        logger.info(f"📊 Parsed {len(movimentos)} movimentos do ficheiro Via Verde")
        return movimentos
        
    except Exception as e:
        logger.error(f"❌ Erro ao parsear ficheiro Via Verde: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []


# Manter o alias antigo para compatibilidade
def parse_excel_viaverde(filepath: str) -> List[Dict[str, Any]]:
    """Alias para parse_viaverde_file para compatibilidade"""
    return parse_viaverde_file(filepath)
async def importar_movimentos_viaverde(
    movimentos: List[Dict[str, Any]], 
    parceiro_id: str,
    db
) -> Dict[str, Any]:
    """
    Importar movimentos parseados para a coleção portagens_viaverde
    
    Args:
        movimentos: Lista de movimentos do parser
        parceiro_id: ID do parceiro
        db: Conexão MongoDB
        
    Returns:
        Resultado da importação
    """
    resultado = {
        "sucesso": True,
        "importados": 0,
        "duplicados": 0,
        "erros": 0,
        "por_semana": {}
    }
    
    for mov in movimentos:
        try:
            # Adicionar parceiro_id
            mov["parceiro_id"] = parceiro_id
            mov["fonte"] = "rpa_viaverde"
            mov["imported_at"] = datetime.now().isoformat()
            
            # Tentar encontrar veículo pela matrícula
            if mov.get("matricula"):
                veiculo = await db.vehicles.find_one({
                    "parceiro_id": parceiro_id,
                    "$or": [
                        {"matricula": mov["matricula"]},
                        {"matricula": mov["matricula"].replace("-", "")},
                        {"matricula": {"$regex": mov["matricula"].replace("-", ""), "$options": "i"}}
                    ]
                }, {"_id": 0, "id": 1})
                
                if veiculo:
                    mov["veiculo_id"] = veiculo["id"]
            
            # Verificar duplicado (mesma data, matrícula e valor)
            existing = await db.portagens_viaverde.find_one({
                "parceiro_id": parceiro_id,
                "entry_date": mov.get("entry_date") or mov.get("data"),
                "matricula": mov.get("matricula"),
                "valor": mov.get("valor")
            })
            
            if existing:
                resultado["duplicados"] += 1
                continue
            
            # Inserir
            await db.portagens_viaverde.insert_one(mov)
            resultado["importados"] += 1
            
            # Contar por semana
            semana_key = f"{mov.get('semana', '?')}/{mov.get('ano', '?')}"
            if semana_key not in resultado["por_semana"]:
                resultado["por_semana"][semana_key] = {"count": 0, "total": 0}
            resultado["por_semana"][semana_key]["count"] += 1
            resultado["por_semana"][semana_key]["total"] += mov.get("valor", 0)
            
        except Exception as e:
            logger.error(f"Erro ao importar movimento: {e}")
            resultado["erros"] += 1
    
    logger.info(f"✅ Importação Via Verde: {resultado['importados']} novos, {resultado['duplicados']} duplicados, {resultado['erros']} erros")
    return resultado


class ViaVerdeRPA:
    """Classe para automação de extração de dados da Via Verde"""
    
    BASE_URL = "https://www.viaverde.pt/empresas"
    # Aceder diretamente à página de extratos força o redirect para login
    LOGIN_URL = "https://www.viaverde.pt/empresas/minha-via-verde/extratos-movimentos"
    EXTRATOS_URL = "https://www.viaverde.pt/empresas/minha-via-verde/extratos-movimentos"
    
    # Seletores CORRETOS do modal de login (encontrados via análise)
    # Os campos visíveis do formulário de login são:
    MODAL_EMAIL_ID = "#txtUsername"
    MODAL_PASSWORD_ID = "#txtPassword"
    
    # Seletores antigos do DNN (formulário no rodapé - não visível)
    DNN_USERNAME_SELECTOR = "#dnn_ctr4019_Login_Login_DNN_txtUsername"
    DNN_PASSWORD_SELECTOR = "#dnn_ctr4019_Login_Login_DNN_txtPassword"
    DNN_LOGIN_BUTTON_SELECTOR = "#dnn_ctr4019_Login_Login_DNN_cmdLogin"
    
    def __init__(self, email: str, password: str):
        self.email = email
        self.password = password
        self.browser = None
        self.page = None
        self.downloads_path = Path("/tmp/viaverde_downloads")
        self.downloads_path.mkdir(exist_ok=True)
    
    async def iniciar_browser(self, headless: bool = True):
        """Iniciar o browser Playwright"""
        from playwright.async_api import async_playwright
        
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=['--disable-blink-features=AutomationControlled']
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            accept_downloads=True
        )
        self.page = await self.context.new_page()
        logger.info("🌐 Browser iniciado")
    
    async def fechar_browser(self):
        """Fechar o browser"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        logger.info("🌐 Browser fechado")
    
    async def fazer_login(self) -> bool:
        """Fazer login na Via Verde Empresas usando o modal de login"""
        try:
            logger.info(f"🔐 A fazer login com {self.email}...")
            
            # Aceder directamente à URL de extratos (força o modal de login)
            await self.page.goto(self.LOGIN_URL, wait_until="networkidle")
            await self.page.wait_for_timeout(3000)
            
            # Screenshot inicial para debug
            await self.capturar_screenshot("01_pagina_inicial")
            
            # Aceitar cookies se aparecer
            try:
                cookie_selectors = [
                    'button:has-text("Aceitar")',
                    'button:has-text("Accept")',
                    '#onetrust-accept-btn-handler'
                ]
                for selector in cookie_selectors:
                    cookie_btn = self.page.locator(selector)
                    if await cookie_btn.count() > 0:
                        await cookie_btn.first.click()
                        await self.page.wait_for_timeout(1000)
                        logger.info("✅ Cookies aceites")
                        break
            except:
                pass
            
            # O modal de login aparece automaticamente
            logger.info("⏳ A aguardar modal de login...")
            await self.page.wait_for_timeout(2000)
            
            # Aguardar o campo de email estar visível
            try:
                await self.page.wait_for_selector(self.MODAL_EMAIL_ID, state="visible", timeout=10000)
                logger.info("✅ Formulário de login encontrado")
            except:
                logger.error("❌ Formulário de login não encontrado")
                await self.capturar_screenshot("02_erro_formulario")
                return False
            
            await self.capturar_screenshot("02_modal_login")
            
            # ===== PREENCHER EMAIL =====
            logger.info(f"📝 A preencher email: {self.email}")
            email_field = self.page.locator(self.MODAL_EMAIL_ID)
            await email_field.click()
            await email_field.fill("")  # Limpar
            await email_field.fill(self.email)
            await self.page.wait_for_timeout(500)
            logger.info("✅ Email preenchido")
            
            # ===== PREENCHER PASSWORD =====
            logger.info("📝 A preencher password...")
            password_field = self.page.locator(self.MODAL_PASSWORD_ID)
            await password_field.click()
            await password_field.fill("")  # Limpar
            await password_field.fill(self.password)
            await self.page.wait_for_timeout(500)
            logger.info("✅ Password preenchida")
            
            # Screenshot após preencher campos
            await self.capturar_screenshot("03_campos_preenchidos")
            
            # ===== CLICAR NO BOTÃO LOGIN =====
            logger.info("🔘 A clicar no botão Login...")
            
            # O botão de login no modal
            login_btn_selectors = [
                'button.login-btn:visible',
                'button:has-text("Login"):visible',
                '.modal button[type="submit"]',
                '#btnLogin'
            ]
            
            login_clicked = False
            for selector in login_btn_selectors:
                try:
                    btn = self.page.locator(selector).first
                    if await btn.count() > 0 and await btn.is_visible():
                        await btn.click()
                        login_clicked = True
                        logger.info(f"✅ Botão de login clicado: {selector}")
                        break
                except:
                    continue
            
            # Se não encontrou botão específico, tentar pressionar Enter
            if not login_clicked:
                logger.info("⏳ A tentar via Enter...")
                await self.page.keyboard.press('Enter')
                login_clicked = True
            
            # Aguardar navegação/resposta
            logger.info("⏳ A aguardar resposta do login...")
            await self.page.wait_for_timeout(8000)
            
            # Screenshot após login
            await self.capturar_screenshot("04_apos_login")
            
            # Verificar se o login foi bem sucedido
            current_url = self.page.url
            logger.info(f"📍 URL após login: {current_url}")
            
            # Verificar se há erro de login
            try:
                error_elem = self.page.locator('.error-message, .alert-danger, .validation-error')
                if await error_elem.count() > 0:
                    error_text = await error_elem.all_text_contents()
                    if error_text and any(t.strip() for t in error_text):
                        logger.error(f"❌ Erro no login: {error_text}")
                        return False
            except:
                pass
            
            # Verificar se o modal ainda está visível (login falhou)
            try:
                email_field_visible = await self.page.locator(self.MODAL_EMAIL_ID).is_visible()
                if email_field_visible:
                    # Modal ainda visível, verificar se há mensagem de erro
                    logger.warning("⚠️ Modal ainda visível, a verificar...")
                    
                    # Tentar de novo após aguardar mais
                    await self.page.wait_for_timeout(3000)
                    email_field_visible = await self.page.locator(self.MODAL_EMAIL_ID).is_visible()
                    
                    if email_field_visible:
                        logger.error("❌ Login falhou - modal ainda visível")
                        await self.capturar_screenshot("05_erro_login")
                        return False
            except:
                pass
            
            # Verificar por elementos que indicam login bem sucedido
            login_indicators = [
                'text=Extratos e Movimentos',
                'text=A Minha Via Verde',
                'text=Sair',
                'text=Filtrar',
                'text=Exportar',
                '.user-name',
                '#userNameLink'
            ]
            
            for indicator in login_indicators:
                try:
                    count = await self.page.locator(indicator).count()
                    if count > 0:
                        logger.info(f"✅ Login confirmado! Indicador: {indicator}")
                        return True
                except:
                    continue
            
            # Se chegamos aqui sem confirmar, verificar URL
            if "extratos" in current_url.lower() and "returnurl" not in current_url.lower():
                logger.info("✅ Login bem sucedido (URL confirmada)")
                return True
            
            # Tentar navegar para extratos para confirmar
            logger.warning("⚠️ A tentar navegar para extratos...")
            await self.page.goto(self.EXTRATOS_URL, wait_until="networkidle")
            await self.page.wait_for_timeout(3000)
            await self.capturar_screenshot("06_tentativa_extratos")
            
            if "returnurl" not in self.page.url.lower():
                logger.info("✅ Login parece bem sucedido")
                return True
            
            logger.error("❌ Login falhou")
            return False
                
        except Exception as e:
            logger.error(f"❌ Erro ao fazer login: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    async def navegar_para_extratos(self) -> bool:
        """Navegar para a página de Extratos e Movimentos e ir ao tab Movimentos"""
        try:
            logger.info("📄 A navegar para Extratos e Movimentos...")
            
            # Verificar se já estamos na página de extratos
            current_url = self.page.url
            if "extratos" in current_url.lower() or "movimentos" in current_url.lower():
                logger.info("✅ Já está na página de extratos")
            else:
                # Se não estamos, navegar diretamente
                await self.page.goto(self.EXTRATOS_URL, wait_until="networkidle")
                await self.page.wait_for_timeout(3000)
            
            await self.capturar_screenshot("07_pagina_extratos")
            
            # Clicar no tab "Movimentos" para poder filtrar por datas
            logger.info("📑 A clicar no tab Movimentos...")
            
            movimentos_tab_selectors = [
                'text=Movimentos',
                'a:has-text("Movimentos")',
                'button:has-text("Movimentos")',
                '[role="tab"]:has-text("Movimentos")'
            ]
            
            tab_clicked = False
            for selector in movimentos_tab_selectors:
                try:
                    tab = self.page.locator(selector).first
                    if await tab.count() > 0:
                        is_visible = await tab.is_visible()
                        if is_visible:
                            await tab.click()
                            tab_clicked = True
                            logger.info(f"✅ Tab Movimentos clicado: {selector}")
                            break
                except:
                    continue
            
            if not tab_clicked:
                logger.warning("⚠️ Tab Movimentos não encontrado, continuando na página atual")
            
            await self.page.wait_for_timeout(2000)
            await self.capturar_screenshot("08_tab_movimentos")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao navegar para extratos: {e}")
            return False
    
    async def selecionar_datas(self, data_inicio: str, data_fim: str) -> bool:
        """
        Selecionar intervalo de datas para filtrar movimentos
        
        Args:
            data_inicio: Data início no formato DD/MM/YYYY
            data_fim: Data fim no formato DD/MM/YYYY
        """
        try:
            logger.info(f"📅 A selecionar datas: {data_inicio} a {data_fim}")
            
            await self.capturar_screenshot("09_antes_datas")
            
            # IMPORTANTE: Primeiro, expandir a área de filtro clicando em "Filtrar por"
            logger.info("📋 A expandir área de filtro...")
            try:
                filtrar_btn = self.page.locator('text=Filtrar por').first
                if await filtrar_btn.count() > 0:
                    await filtrar_btn.click()
                    await self.page.wait_for_timeout(2000)
                    logger.info("✅ Área de filtro expandida")
            except Exception as e:
                logger.warning(f"⚠️ Não conseguiu expandir filtro: {e}")
            
            # Agora os campos de data devem estar visíveis
            # ng-model="vm.fromDateExtracts" e ng-model="vm.toDateExtracts"
            
            # Campo "De" (data início)
            de_input = self.page.locator('input[ng-model="vm.fromDateExtracts"], input[ng-model*="fromDate"]').first
            ate_input = self.page.locator('input[ng-model="vm.toDateExtracts"], input[ng-model*="toDate"]').first
            
            # Verificar se os inputs estão visíveis agora
            if await de_input.count() > 0 and await de_input.is_visible():
                logger.info("📝 A preencher data início...")
                await de_input.click()
                await self.page.wait_for_timeout(500)
                
                # Limpar e digitar a data
                await self.page.keyboard.press('Control+a')
                await self.page.keyboard.type(data_inicio)
                await self.page.keyboard.press('Tab')  # Mover para o próximo campo
                await self.page.wait_for_timeout(500)
                
                logger.info(f"✅ Data início preenchida: {data_inicio}")
            else:
                logger.warning("⚠️ Campo de data início não encontrado após expandir filtro")
            
            if await ate_input.count() > 0 and await ate_input.is_visible():
                logger.info("📝 A preencher data fim...")
                await ate_input.click()
                await self.page.wait_for_timeout(500)
                
                await self.page.keyboard.press('Control+a')
                await self.page.keyboard.type(data_fim)
                await self.page.keyboard.press('Escape')  # Fechar calendário
                await self.page.wait_for_timeout(500)
                
                logger.info(f"✅ Data fim preenchida: {data_fim}")
            else:
                logger.warning("⚠️ Campo de data fim não encontrado após expandir filtro")
            
            await self.capturar_screenshot("10_datas_preenchidas")
            
            logger.info("✅ Datas selecionadas")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao selecionar datas: {e}")
            await self.capturar_screenshot("datas_erro")
            return False
    
    async def aplicar_filtro(self) -> bool:
        """Clicar no botão Filtrar para aplicar os filtros"""
        try:
            logger.info("🔍 A aplicar filtro...")
            
            # Procurar botão Filtrar (não o dropdown "Filtrar por")
            filtrar_selectors = [
                'button:has-text("Filtrar"):not(:has-text("por"))',
                'button.btn-filter',
                'a.btn:has-text("Filtrar")',
                'input[value="Filtrar"]'
            ]
            
            clicked = False
            for selector in filtrar_selectors:
                try:
                    btn = self.page.locator(selector).first
                    if await btn.count() > 0 and await btn.is_visible():
                        await btn.click()
                        clicked = True
                        logger.info(f"✅ Botão Filtrar clicado: {selector}")
                        break
                except:
                    continue
            
            if not clicked:
                # Tentar pelo role
                filtrar_button = self.page.get_by_role('button', name='Filtrar', exact=True)
                if await filtrar_button.count() > 0:
                    await filtrar_button.first.click()
                    clicked = True
            
            # Aguardar carregamento dos resultados
            await self.page.wait_for_timeout(3000)
            
            logger.info("✅ Filtro aplicado")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao aplicar filtro: {e}")
            return False
    
    async def exportar_excel(self) -> Optional[str]:
        """
        Exportar os dados filtrados para CSV
        
        NOTA: A Via Verde tem dois tipos de exportação:
        1. "Exportar detalhes filtrados" - Envia link por email (não faz download direto)
        2. Exportar extratos individuais da tabela - Faz download direto
        
        Vamos usar a opção 2 pois permite download direto
        
        Returns:
            Caminho do ficheiro exportado ou None se falhar
        """
        try:
            logger.info("📥 A exportar dados...")
            
            await self.capturar_screenshot("11_antes_export")
            
            # Opção 1: Tentar exportar extratos individuais da tabela (download direto)
            logger.info("📋 A procurar extratos na tabela para exportar...")
            
            # Encontrar todos os dropdowns de exportar na tabela
            export_dropdowns = await self.page.locator('a.dropdown-link:has-text("Exportar")').all()
            logger.info(f"📋 Encontrados {len(export_dropdowns)} dropdowns de exportar")
            
            if len(export_dropdowns) > 0:
                for i, dropdown in enumerate(export_dropdowns[:3]):
                    try:
                        if await dropdown.is_visible():
                            logger.info(f"📋 A tentar exportar extrato {i+1}...")
                            
                            # Clicar no dropdown de exportar
                            await dropdown.click()
                            await self.page.wait_for_timeout(1000)
                            
                            await self.capturar_screenshot(f"12_dropdown_{i}")
                            
                            # Procurar opção CSV
                            csv_option = self.page.locator('a:has-text("CSV")').first
                            
                            if await csv_option.count() > 0 and await csv_option.is_visible():
                                logger.info("✅ Opção CSV encontrada, a tentar download...")
                                
                                # Tentar download direto
                                try:
                                    async with self.page.expect_download(timeout=15000) as download_info:
                                        await csv_option.click()
                                    
                                    download = await download_info.value
                                    
                                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                                    original_name = download.suggested_filename or f"viaverde_extrato_{timestamp}.csv"
                                    filepath = self.downloads_path / original_name
                                    
                                    await download.save_as(str(filepath))
                                    
                                    logger.info(f"✅ Ficheiro exportado: {filepath}")
                                    return str(filepath)
                                    
                                except Exception as e:
                                    logger.warning(f"⚠️ Download não iniciou (pode precisar de email): {e}")
                                    # Fechar dropdown e continuar
                                    await self.page.keyboard.press('Escape')
                                    await self.page.wait_for_timeout(500)
                            else:
                                # Fechar dropdown
                                await self.page.keyboard.press('Escape')
                                await self.page.wait_for_timeout(500)
                    except Exception as e:
                        logger.warning(f"⚠️ Erro no dropdown {i}: {e}")
                        await self.page.keyboard.press('Escape')
                        await self.page.wait_for_timeout(500)
            
            # Opção 2: Usar "Exportar detalhes filtrados" que envia por email
            # Isto requer que o utilizador verifique o email depois
            logger.info("📧 A usar exportação por email (Via Verde não permite download direto de detalhes)...")
            
            exportar_detalhes = self.page.locator('text=Exportar detalhes').first
            
            if await exportar_detalhes.count() > 0 and await exportar_detalhes.is_visible():
                await exportar_detalhes.click()
                await self.page.wait_for_timeout(1500)
                
                # Selecionar CSV
                csv_option = self.page.locator('text=CSV').first
                if await csv_option.count() > 0:
                    await csv_option.click()
                    await self.page.wait_for_timeout(2000)
                    
                    await self.capturar_screenshot("13_modal_email")
                    
                    # Preencher email no modal
                    email_input = self.page.locator('input[type="email"], input[placeholder*="email"], input[name*="email"]').first
                    
                    if await email_input.count() > 0:
                        # Usar o mesmo email que o login
                        await email_input.click()
                        await email_input.fill(self.email)
                        logger.info(f"✅ Email preenchido: {self.email}")
                        
                        await self.page.wait_for_timeout(500)
                        
                        # Clicar em Confirmar
                        confirmar_btn = self.page.locator('.modal button:has-text("Confirmar")').first
                        
                        if await confirmar_btn.count() > 0:
                            await confirmar_btn.click()
                            await self.page.wait_for_timeout(3000)
                            
                            await self.capturar_screenshot("14_apos_confirmar")
                            
                            logger.info("✅ Exportação solicitada! O link será enviado para o email.")
                            
                            # Criar um ficheiro marcador indicando que exportação foi solicitada
                            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                            marker_file = self.downloads_path / f"viaverde_export_pendente_{timestamp}.txt"
                            
                            with open(marker_file, 'w') as f:
                                f.write(f"Exportação Via Verde solicitada em {timestamp}\n")
                                f.write(f"Email: {self.email}\n")
                                f.write("NOTA: O link de download será enviado para este email.\n")
                                f.write("Verifique a caixa de entrada para fazer o download.\n")
                            
                            # Retornar None pois não há download direto
                            # Mas a exportação foi solicitada com sucesso
                            return str(marker_file)
            
            await self.capturar_screenshot("export_erro")
            logger.error("❌ Não conseguiu exportar dados")
            return None
            
        except Exception as e:
            logger.error(f"❌ Erro ao exportar: {e}")
            await self.capturar_screenshot("export_erro")
            return None
    
    async def capturar_screenshot(self, nome: str = "screenshot") -> str:
        """Capturar screenshot da página atual"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filepath = f"/tmp/viaverde_{nome}_{timestamp}.png"
        await self.page.screenshot(path=filepath)
        logger.info(f"📸 Screenshot guardado: {filepath}")
        return filepath
    
    async def extrair_movimentos(
        self, 
        data_inicio: str, 
        data_fim: str,
        headless: bool = True
    ) -> Dict[str, Any]:
        """
        Processo completo de extração de movimentos Via Verde
        
        Args:
            data_inicio: Data início formato DD/MM/YYYY
            data_fim: Data fim formato DD/MM/YYYY
            headless: Executar sem interface gráfica
            
        Returns:
            Dict com resultado da extração
        """
        resultado = {
            "sucesso": False,
            "ficheiro": None,
            "screenshots": [],
            "logs": [],
            "erro": None
        }
        
        try:
            # 1. Iniciar browser
            await self.iniciar_browser(headless=headless)
            resultado["logs"].append("Browser iniciado")
            
            # 2. Fazer login
            if not await self.fazer_login():
                resultado["erro"] = "Falha no login"
                resultado["screenshots"].append(await self.capturar_screenshot("login_erro"))
                return resultado
            
            resultado["logs"].append("Login bem sucedido")
            resultado["screenshots"].append(await self.capturar_screenshot("apos_login"))
            
            # 3. Navegar para extratos
            if not await self.navegar_para_extratos():
                resultado["erro"] = "Falha ao navegar para extratos"
                resultado["screenshots"].append(await self.capturar_screenshot("navegacao_erro"))
                return resultado
            
            resultado["logs"].append("Navegação para extratos")
            
            # 4. Selecionar datas
            if not await self.selecionar_datas(data_inicio, data_fim):
                resultado["erro"] = "Falha ao selecionar datas"
                resultado["screenshots"].append(await self.capturar_screenshot("datas_erro"))
                return resultado
            
            resultado["logs"].append(f"Datas selecionadas: {data_inicio} a {data_fim}")
            
            # 5. Aplicar filtro
            if not await self.aplicar_filtro():
                resultado["erro"] = "Falha ao aplicar filtro"
                resultado["screenshots"].append(await self.capturar_screenshot("filtro_erro"))
                return resultado
            
            resultado["logs"].append("Filtro aplicado")
            resultado["screenshots"].append(await self.capturar_screenshot("resultados"))
            
            # 6. Exportar Excel
            ficheiro = await self.exportar_excel()
            if not ficheiro:
                resultado["erro"] = "Falha ao exportar Excel"
                resultado["screenshots"].append(await self.capturar_screenshot("export_erro"))
                return resultado
            
            resultado["ficheiro"] = ficheiro
            resultado["logs"].append(f"Ficheiro exportado: {ficheiro}")
            resultado["sucesso"] = True
            
            logger.info("🎉 Extração concluída com sucesso!")
            
        except Exception as e:
            resultado["erro"] = str(e)
            logger.error(f"❌ Erro na extração: {e}")
            try:
                resultado["screenshots"].append(await self.capturar_screenshot("erro_geral"))
            except:
                pass
                
        finally:
            await self.fechar_browser()
        
        return resultado


# Função auxiliar para converter datas
def formatar_data_viaverde(data_iso: str) -> str:
    """
    Converter data ISO (YYYY-MM-DD) para formato Via Verde (DD/MM/YYYY)
    """
    try:
        dt = datetime.strptime(data_iso, "%Y-%m-%d")
        return dt.strftime("%d/%m/%Y")
    except:
        return data_iso


# Função principal para ser chamada pelo sistema
async def executar_rpa_viaverde(
    email: str,
    password: str,
    data_inicio: str,  # YYYY-MM-DD
    data_fim: str,     # YYYY-MM-DD
    headless: bool = True
) -> Dict[str, Any]:
    """
    Função principal para executar RPA Via Verde
    
    Args:
        email: Email de login Via Verde
        password: Password Via Verde
        data_inicio: Data início formato YYYY-MM-DD
        data_fim: Data fim formato YYYY-MM-DD
        headless: Executar sem interface gráfica
        
    Returns:
        Resultado da extração
    """
    # Converter datas para formato Via Verde
    data_inicio_vv = formatar_data_viaverde(data_inicio)
    data_fim_vv = formatar_data_viaverde(data_fim)
    
    # Executar RPA
    rpa = ViaVerdeRPA(email, password)
    resultado = await rpa.extrair_movimentos(
        data_inicio_vv, 
        data_fim_vv, 
        headless=headless
    )
    
    return resultado


# Teste local
if __name__ == "__main__":
    import sys
    
    async def test():
        resultado = await executar_rpa_viaverde(
            email="teste@example.com",
            password="senha123",
            data_inicio="2025-12-01",
            data_fim="2025-12-31",
            headless=False  # Mostrar browser para debug
        )
        print(f"Resultado: {resultado}")
    
    asyncio.run(test())
