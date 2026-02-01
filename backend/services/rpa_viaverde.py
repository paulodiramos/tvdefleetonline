"""
RPA Via Verde - Script de Automação Playwright
Extrai movimentos/portagens entre datas específicas
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class ViaVerdeRPA:
    """Classe para automação de extração de dados da Via Verde"""
    
    BASE_URL = "https://www.viaverde.pt/empresas"
    
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
            
            # Aceder à página inicial
            await self.page.goto(self.BASE_URL, wait_until="networkidle")
            await self.page.wait_for_timeout(2000)
            
            # Clicar no botão Login (pode estar no header)
            login_button = self.page.get_by_role('button', name='Login')
            if await login_button.count() == 0:
                # Tentar encontrar link de login
                login_button = self.page.get_by_role('link', name='Login')
            
            await login_button.first.click()
            await self.page.wait_for_timeout(2000)
            
            # Preencher email
            email_field = self.page.locator('input[placeholder="Email"]')
            if await email_field.count() == 0:
                email_field = self.page.locator('input[type="email"]')
            await email_field.fill(self.email)
            
            # Preencher password
            password_field = self.page.locator('input[placeholder="Palavra-passe"]')
            if await password_field.count() == 0:
                password_field = self.page.locator('input[type="password"]')
            await password_field.fill(self.password)
            
            # Clicar no botão de submit do login
            submit_button = self.page.get_by_role('button', name='Login').last
            await submit_button.click()
            
            # Aguardar navegação após login
            await self.page.wait_for_timeout(5000)
            
            # Verificar se login foi bem sucedido (procurar menu de utilizador)
            if "minha-via-verde" in self.page.url or await self.page.locator('text=Extratos').count() > 0:
                logger.info("✅ Login bem sucedido!")
                return True
            else:
                logger.error("❌ Login falhou - não foi redirecionado")
                return False
                
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
