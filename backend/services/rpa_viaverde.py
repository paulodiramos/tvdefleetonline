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


def parse_excel_viaverde(filepath: str) -> List[Dict[str, Any]]:
    """
    Parser do ficheiro Excel exportado da Via Verde
    
    Estrutura esperada do Excel:
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
        # Ler Excel
        df = pd.read_excel(filepath)
        
        # Normalizar nomes das colunas (remover espaços, lowercase)
        df.columns = [col.strip().lower().replace(' ', '_') for col in df.columns]
        
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
            for col in ['data/hora', 'data_hora', 'data', 'date', 'datetime']:
                if col in df.columns and pd.notna(row.get(col)):
                    dt_value = row.get(col)
                    if isinstance(dt_value, datetime):
                        movimento["data"] = dt_value.strftime("%Y-%m-%d")
                        movimento["hora"] = dt_value.strftime("%H:%M:%S")
                        movimento["entry_date"] = dt_value.strftime("%Y-%m-%d")
                    elif isinstance(dt_value, str):
                        movimento["data"] = dt_value[:10]
                        movimento["entry_date"] = dt_value[:10]
                    break
            
            # Matrícula
            for col in ['matrícula', 'matricula', 'plate', 'veiculo', 'vehicle']:
                if col in df.columns and pd.notna(row.get(col)):
                    movimento["matricula"] = str(row.get(col)).strip().upper()
                    break
            
            # Identificador Via Verde
            for col in ['identificador', 'id_viaverde', 'identifier', 'tag']:
                if col in df.columns and pd.notna(row.get(col)):
                    movimento["identificador"] = str(row.get(col)).strip()
                    break
            
            # Local/Descrição
            for col in ['local', 'descrição', 'descricao', 'description', 'location']:
                if col in df.columns and pd.notna(row.get(col)):
                    movimento["local"] = str(row.get(col)).strip()
                    movimento["descricao"] = str(row.get(col)).strip()
                    break
            
            # Valor
            for col in ['valor', 'value', 'amount', 'total', 'preço', 'preco']:
                if col in df.columns and pd.notna(row.get(col)):
                    try:
                        val = row.get(col)
                        if isinstance(val, str):
                            val = val.replace('€', '').replace(',', '.').strip()
                        movimento["valor"] = abs(float(val))
                    except:
                        pass
                    break
            
            # Tipo (Portagem, Parque, etc)
            for col in ['tipo', 'type', 'categoria', 'category']:
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
        
        logger.info(f"📊 Parsed {len(movimentos)} movimentos do Excel Via Verde")
        return movimentos
        
    except Exception as e:
        logger.error(f"❌ Erro ao parsear Excel Via Verde: {e}")
        return []


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
    
    # Seletores para o MODAL de login (pop-up "A Minha Via Verde")
    # Este é o formulário principal que aparece quando se acede à área reservada
    MODAL_EMAIL_SELECTORS = [
        'input[placeholder="Email"]',
        '.modal input[type="email"]',
        'input[name="email"]',
        '#email',
        '[data-testid="login-email"]'
    ]
    MODAL_PASSWORD_SELECTORS = [
        'input[placeholder="Palavra-passe"]',
        'input[placeholder="Password"]',
        '.modal input[type="password"]',
        'input[name="password"]',
        '#password',
        '[data-testid="login-password"]'
    ]
    MODAL_LOGIN_BUTTON_SELECTORS = [
        'button:has-text("Login")',
        '.modal button[type="submit"]',
        'button.login-btn',
        '[data-testid="login-button"]'
    ]
    
    # Seletores antigos do DNN (formulário no rodapé - backup)
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
        """Fazer login na Via Verde Empresas usando os seletores DNN específicos"""
        try:
            logger.info(f"🔐 A fazer login com {self.email}...")
            
            # Aceder directamente à URL de extratos (força redirect para login)
            await self.page.goto(self.LOGIN_URL, wait_until="networkidle")
            await self.page.wait_for_timeout(3000)
            
            # Screenshot inicial para debug
            await self.capturar_screenshot("01_pagina_inicial")
            
            # Aceitar cookies se aparecer
            try:
                accept_cookies = self.page.locator('button:has-text("Accept All"), button:has-text("Aceitar"), button:has-text("Aceito")')
                if await accept_cookies.count() > 0:
                    await accept_cookies.first.click()
                    await self.page.wait_for_timeout(1000)
                    logger.info("✅ Cookies aceites")
            except:
                pass
            
            # Verificar se já está logado (redirect não aconteceu)
            current_url = self.page.url
            logger.info(f"📍 URL atual: {current_url}")
            
            # Se já estiver na página de extratos após login, sucesso
            if "extratos" in current_url.lower() and "returnurl" not in current_url.lower():
                logger.info("✅ Já está logado!")
                return True
            
            # Aguardar formulário de login DNN específico da Via Verde
            logger.info("⏳ A aguardar formulário de login...")
            
            # Os seletores específicos do DNN da Via Verde
            try:
                # Aguardar que o campo de username esteja visível
                await self.page.wait_for_selector(self.USERNAME_SELECTOR, timeout=15000)
                logger.info("✅ Formulário de login encontrado")
            except:
                # Tentar scroll para mostrar o formulário (está no rodapé)
                logger.info("⚠️ A fazer scroll para encontrar formulário...")
                await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await self.page.wait_for_timeout(2000)
                await self.capturar_screenshot("02_apos_scroll")
                
                try:
                    await self.page.wait_for_selector(self.USERNAME_SELECTOR, timeout=10000)
                except:
                    logger.error("❌ Formulário de login não encontrado")
                    return False
            
            # Screenshot antes de preencher
            await self.capturar_screenshot("03_formulario_login")
            
            # Preencher Username (email)
            logger.info(f"📝 A preencher username: {self.email}")
            username_field = self.page.locator(self.USERNAME_SELECTOR)
            await username_field.scroll_into_view_if_needed()
            await username_field.click()
            await username_field.fill("")  # Limpar
            await username_field.fill(self.email)
            await self.page.wait_for_timeout(500)
            logger.info("✅ Username preenchido")
            
            # Preencher Password
            logger.info("📝 A preencher password...")
            password_field = self.page.locator(self.PASSWORD_SELECTOR)
            await password_field.scroll_into_view_if_needed()
            await password_field.click()
            await password_field.fill("")  # Limpar
            await password_field.fill(self.password)
            await self.page.wait_for_timeout(500)
            logger.info("✅ Password preenchida")
            
            # Screenshot após preencher campos
            await self.capturar_screenshot("04_campos_preenchidos")
            
            # Clicar no botão Login
            logger.info("🔘 A clicar no botão Login...")
            login_button = self.page.locator(self.LOGIN_BUTTON_SELECTOR)
            await login_button.scroll_into_view_if_needed()
            await login_button.click()
            logger.info("✅ Botão de login clicado")
            
            # Aguardar navegação/resposta
            await self.page.wait_for_timeout(5000)
            
            # Screenshot após login
            await self.capturar_screenshot("05_apos_login")
            
            # Verificar se o login foi bem sucedido
            current_url = self.page.url
            logger.info(f"📍 URL após login: {current_url}")
            
            # Verificar por elementos que indicam login bem sucedido
            login_indicators = [
                'text=Extratos e Movimentos',
                'text=A Minha Via Verde',
                'text=Sair',
                'text=Logout',
                '.user-logged',
                '#dnn_dnnUSER_userNameLink'  # Link com nome do utilizador após login
            ]
            
            for indicator in login_indicators:
                try:
                    count = await self.page.locator(indicator).count()
                    if count > 0:
                        logger.info(f"✅ Login confirmado! Indicador encontrado: {indicator}")
                        return True
                except:
                    continue
            
            # Verificar se há mensagem de erro
            error_selectors = [
                '.dnnFormValidationSummary',
                '.validation-summary-errors',
                '.error-message',
                'span[id*="Error"]',
                '.alert-danger'
            ]
            
            for selector in error_selectors:
                try:
                    error_elem = self.page.locator(selector)
                    if await error_elem.count() > 0:
                        error_text = await error_elem.all_text_contents()
                        if error_text and any(t.strip() for t in error_text):
                            logger.error(f"❌ Erro no login: {error_text}")
                            return False
                except:
                    continue
            
            # Se não encontrou indicadores mas também não há erro, tentar navegar
            logger.warning("⚠️ Não foi possível confirmar login, a tentar navegar para extratos...")
            await self.page.goto(self.EXTRATOS_URL, wait_until="networkidle")
            await self.page.wait_for_timeout(3000)
            await self.capturar_screenshot("06_tentativa_extratos")
            
            # Verificar novamente
            if "returnurl" not in self.page.url.lower():
                logger.info("✅ Login parece bem sucedido (acesso a área restrita)")
                return True
            
            logger.error("❌ Login falhou - redirect para página de login")
            return False
                
        except Exception as e:
            logger.error(f"❌ Erro ao fazer login: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    async def navegar_para_extratos(self) -> bool:
        """Navegar para a página de Extratos e Movimentos"""
        try:
            logger.info("📄 A navegar para Extratos e Movimentos...")
            
            # Verificar se já estamos na página de extratos
            current_url = self.page.url
            if "extratos" in current_url.lower() or "movimentos" in current_url.lower():
                logger.info("✅ Já está na página de extratos")
                await self.capturar_screenshot("07_ja_em_extratos")
                return True
            
            # Se não estamos, navegar diretamente
            await self.page.goto(self.EXTRATOS_URL, wait_until="networkidle")
            await self.page.wait_for_timeout(3000)
            
            # Verificar se carregou corretamente
            await self.capturar_screenshot("07_pagina_extratos")
            
            # Verificar se há elementos da página de extratos
            extratos_indicators = [
                'text=Movimentos',
                'text=Filtrar',
                'text=Exportar',
                'text=De',
                'text=Até'
            ]
            
            for indicator in extratos_indicators:
                if await self.page.locator(indicator).count() > 0:
                    logger.info(f"✅ Página de extratos confirmada: {indicator}")
                    return True
            
            # Se não encontrou indicadores, pode ainda assim estar correto
            logger.warning("⚠️ Indicadores de extratos não encontrados, continuando...")
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
            
            # Limpar filtros existentes primeiro
            limpar_button = self.page.get_by_role('button', name='Limpar')
            if await limpar_button.count() > 0:
                await limpar_button.click()
                await self.page.wait_for_timeout(1000)
            
            # Campo "De" (data início)
            # Tentar encontrar o campo de data início
            de_input = self.page.locator('input').filter(has_text='').nth(0)  # Primeiro input de data
            
            # Alternativa: procurar pelo label "De"
            de_container = self.page.locator('label:has-text("De")').locator('..')
            de_input = de_container.locator('input').first
            
            if await de_input.count() == 0:
                # Tentar outro seletor
                de_input = self.page.locator('[placeholder*="DD/MM"]').first
            
            # Limpar e preencher data início
            await de_input.click()
            await de_input.fill('')
            await de_input.type(data_inicio)
            await self.page.wait_for_timeout(500)
            
            # Campo "Até" (data fim)
            ate_container = self.page.locator('label:has-text("Até")').locator('..')
            ate_input = ate_container.locator('input').first
            
            if await ate_input.count() == 0:
                ate_input = self.page.locator('[placeholder*="DD/MM"]').last
            
            # Limpar e preencher data fim
            await ate_input.click()
            await ate_input.fill('')
            await ate_input.type(data_fim)
            await self.page.wait_for_timeout(500)
            
            # Fechar calendário se aberto (pressionar Escape)
            await self.page.keyboard.press('Escape')
            await self.page.wait_for_timeout(500)
            
            logger.info("✅ Datas selecionadas")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao selecionar datas: {e}")
            return False
    
    async def aplicar_filtro(self) -> bool:
        """Clicar no botão Filtrar para aplicar os filtros"""
        try:
            logger.info("🔍 A aplicar filtro...")
            
            filtrar_button = self.page.get_by_role('button', name='Filtrar')
            await filtrar_button.click()
            
            # Aguardar carregamento dos resultados
            await self.page.wait_for_timeout(3000)
            
            logger.info("✅ Filtro aplicado")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao aplicar filtro: {e}")
            return False
    
    async def exportar_excel(self) -> Optional[str]:
        """
        Exportar os dados filtrados para Excel
        
        Returns:
            Caminho do ficheiro exportado ou None se falhar
        """
        try:
            logger.info("📥 A exportar para Excel...")
            
            # Clicar no botão Exportar
            exportar_button = self.page.get_by_role('button', name='Exportar')
            await exportar_button.click()
            await self.page.wait_for_timeout(1000)
            
            # Selecionar opção Excel no menu dropdown
            excel_option = self.page.get_by_role('menuitem', name='Excel')
            if await excel_option.count() == 0:
                excel_option = self.page.locator('text=Excel')
            
            # Configurar listener para download
            async with self.page.expect_download() as download_info:
                await excel_option.click()
            
            download = await download_info.value
            
            # Guardar ficheiro
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"viaverde_movimentos_{timestamp}.xlsx"
            filepath = self.downloads_path / filename
            
            await download.save_as(str(filepath))
            
            logger.info(f"✅ Ficheiro exportado: {filepath}")
            return str(filepath)
            
        except Exception as e:
            logger.error(f"❌ Erro ao exportar: {e}")
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
