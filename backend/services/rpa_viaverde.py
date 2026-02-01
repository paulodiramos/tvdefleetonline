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
    
    # Seletores específicos do formulário DNN da Via Verde
    USERNAME_SELECTOR = "#dnn_ctr4019_Login_Login_DNN_txtUsername"
    PASSWORD_SELECTOR = "#dnn_ctr4019_Login_Login_DNN_txtPassword"
    LOGIN_BUTTON_SELECTOR = "#dnn_ctr4019_Login_Login_DNN_cmdLogin"
    
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
        """Fazer login na Via Verde Empresas"""
        try:
            logger.info(f"🔐 A fazer login com {self.email}...")
            
            # Aceder directamente à URL que força o login
            await self.page.goto(self.LOGIN_URL, wait_until="networkidle")
            await self.page.wait_for_timeout(3000)
            
            # Aceitar cookies se aparecer o banner
            try:
                accept_cookies = self.page.locator('button:has-text("Accept All"), button:has-text("Aceitar")')
                if await accept_cookies.count() > 0:
                    await accept_cookies.first.click()
                    await self.page.wait_for_timeout(1000)
            except:
                pass
            
            # O formulário de login deve aparecer automaticamente
            # Aguardar campos de login
            await self.page.wait_for_selector('input[type="email"], input[type="password"]', timeout=10000)
            
            # Preencher email - procurar pelo placeholder ou tipo
            email_filled = False
            email_selectors = [
                'input[type="email"]',
                'input[placeholder="Email"]',
                'input[name*="user"]',
                'input[id*="user"]',
                '#txtUsername'
            ]
            
            for selector in email_selectors:
                email_field = self.page.locator(selector).first
                if await email_field.count() > 0:
                    try:
                        is_visible = await email_field.is_visible()
                        if is_visible:
                            await email_field.click()
                            await email_field.fill(self.email)
                            email_filled = True
                            logger.info("✅ Email preenchido")
                            break
                    except:
                        continue
            
            if not email_filled:
                # Tentar preencher qualquer input de email visível
                all_emails = await self.page.locator('input[type="email"]').all()
                for ef in all_emails:
                    if await ef.is_visible():
                        await ef.fill(self.email)
                        email_filled = True
                        break
            
            if not email_filled:
                logger.error("❌ Não encontrou campo de email visível")
                return False
            
            await self.page.wait_for_timeout(500)
            
            # Preencher password
            password_filled = False
            password_selectors = [
                'input[type="password"]',
                'input[placeholder*="passe"]',
                'input[placeholder*="senha"]',
                '#txtPassword'
            ]
            
            for selector in password_selectors:
                password_field = self.page.locator(selector).first
                if await password_field.count() > 0:
                    try:
                        is_visible = await password_field.is_visible()
                        if is_visible:
                            await password_field.click()
                            await password_field.fill(self.password)
                            password_filled = True
                            logger.info("✅ Password preenchida")
                            break
                    except:
                        continue
            
            if not password_filled:
                # Tentar preencher qualquer input de password visível
                all_pwds = await self.page.locator('input[type="password"]').all()
                for pf in all_pwds:
                    if await pf.is_visible():
                        await pf.fill(self.password)
                        password_filled = True
                        break
            
            if not password_filled:
                logger.error("❌ Não encontrou campo de password visível")
                return False
            
            await self.page.wait_for_timeout(500)
            
            # Clicar no botão de submit do login
            submit_clicked = False
            submit_selectors = [
                'button[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("Entrar")',
                'input[type="submit"]',
                '#dnn_UserLogin_cmdLogin'
            ]
            
            for selector in submit_selectors:
                submit_button = self.page.locator(selector)
                if await submit_button.count() > 0:
                    try:
                        visible_btn = submit_button.first
                        if await visible_btn.is_visible():
                            await visible_btn.click()
                            submit_clicked = True
                            logger.info("✅ Botão Login clicado")
                            break
                    except:
                        continue
            
            if not submit_clicked:
                logger.error("❌ Não encontrou botão de submit")
                return False
            
            # Aguardar navegação após login
            await self.page.wait_for_timeout(8000)
            
            # Verificar se login foi bem sucedido
            current_url = self.page.url
            logger.info(f"URL após login: {current_url}")
            
            # Verificar indicadores de login bem sucedido
            success_indicators = [
                'minha-via-verde' in current_url and 'returnurl' not in current_url.lower(),
                'dashboard' in current_url,
                'area-reservada' in current_url,
                await self.page.locator('text=Extratos').count() > 0,
                await self.page.locator('text=Sair').count() > 0,
                await self.page.locator('text=Logout').count() > 0,
                await self.page.locator('text=A Minha Via Verde').count() > 0
            ]
            
            if any(success_indicators):
                logger.info("✅ Login bem sucedido!")
                return True
            
            # Verificar se ainda está na página de login (falha)
            if 'returnurl' in current_url.lower():
                # Verificar mensagens de erro
                error_text = await self.page.locator('.error, .alert, .validation-summary-errors').all_text_contents()
                if error_text:
                    logger.error(f"❌ Erro de login: {error_text}")
                else:
                    logger.error("❌ Login falhou - credenciais podem estar incorretas")
                return False
            
            logger.info("✅ Login aparentemente bem sucedido!")
            return True
                
        except Exception as e:
            logger.error(f"❌ Erro no login: {e}")
            return False
    
    async def navegar_para_extratos(self) -> bool:
        """Navegar para a página de Extratos e Movimentos"""
        try:
            logger.info("📄 A navegar para Extratos e Movimentos...")
            
            # Tentar clicar no menu lateral "Extratos e Movimentos"
            extratos_link = self.page.get_by_role('link', name='Extratos e Movimentos')
            if await extratos_link.count() == 0:
                extratos_link = self.page.locator('text=Extratos e Movimentos')
            
            if await extratos_link.count() == 0:
                # Tentar via "Consultar extratos e movimentos"
                extratos_link = self.page.get_by_role('link', name='Consultar extratos e movimentos')
            
            await extratos_link.first.click()
            await self.page.wait_for_timeout(3000)
            
            logger.info("✅ Página de extratos carregada")
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
