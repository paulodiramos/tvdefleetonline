"""
RPA Via Verde V2 - Versão Simplificada
Solicita exportação de dados por email (limitação do site Via Verde)
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class ViaVerdeRPA:
    """Automação Via Verde - Solicita exportação por email"""
    
    LOGIN_URL = "https://www.viaverde.pt/empresas/minha-via-verde/extratos-movimentos"
    
    # Seletores do formulário de login
    EMAIL_SELECTOR = "#txtUsername"
    PASSWORD_SELECTOR = "#txtPassword"
    
    def __init__(self, email: str, password: str):
        self.email = email
        self.password = password
        self.browser = None
        self.page = None
        self.screenshots_path = Path("/tmp")
    
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
            
            # Clicar em Login (botão ou Enter)
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
    
    async def solicitar_exportacao(self, data_inicio: str, data_fim: str) -> Dict[str, Any]:
        """
        Solicitar exportação de dados por email
        
        NOTA: A Via Verde não permite download direto - apenas envia link por email
        """
        resultado = {
            "sucesso": False,
            "mensagem": None,
            "email_destino": self.email
        }
        
        try:
            logger.info(f"📧 A solicitar exportação para {self.email}...")
            
            await self.page.wait_for_timeout(2000)
            await self.screenshot("pagina_extratos")
            
            # Clicar em "Exportar detalhes"
            exportar = self.page.locator('text=Exportar detalhes').first
            if await exportar.count() > 0:
                await exportar.click()
                await self.page.wait_for_timeout(1500)
                
                # Selecionar CSV
                csv_opt = self.page.locator('text=CSV').first
                if await csv_opt.count() > 0:
                    await csv_opt.click()
                    await self.page.wait_for_timeout(2000)
                    
                    await self.screenshot("modal_email")
                    
                    # Preencher email no modal
                    email_input = self.page.locator('input[type="email"], input[placeholder*="email"]').first
                    if await email_input.count() > 0:
                        await email_input.fill(self.email)
                        await self.page.wait_for_timeout(500)
                        
                        # Confirmar
                        confirmar = self.page.locator('.modal button:has-text("Confirmar")').first
                        if await confirmar.count() > 0:
                            await confirmar.click()
                            await self.page.wait_for_timeout(3000)
                            
                            await self.screenshot("confirmado")
                            
                            resultado["sucesso"] = True
                            resultado["mensagem"] = (
                                f"Exportação solicitada com sucesso!\n"
                                f"Um email será enviado para {self.email} com o link de download.\n"
                                f"Período: {data_inicio} a {data_fim}"
                            )
                            logger.info("✅ Exportação solicitada!")
                            return resultado
            
            resultado["mensagem"] = "Não foi possível solicitar exportação"
            return resultado
            
        except Exception as e:
            resultado["mensagem"] = f"Erro: {str(e)}"
            logger.error(f"❌ Erro: {e}")
            return resultado


async def executar_rpa_viaverde_v2(
    email: str,
    password: str,
    data_inicio: str,
    data_fim: str,
    headless: bool = True
) -> Dict[str, Any]:
    """
    Executar RPA Via Verde - Solicita exportação por email
    
    IMPORTANTE: A Via Verde não permite download direto.
    Os dados serão enviados para o email fornecido.
    """
    resultado = {
        "sucesso": False,
        "mensagem": None,
        "email_destino": email,
        "periodo": f"{data_inicio} a {data_fim}",
        "screenshots": []
    }
    
    rpa = ViaVerdeRPA(email, password)
    
    try:
        await rpa.iniciar_browser(headless=headless)
        
        if not await rpa.fazer_login():
            resultado["mensagem"] = "Falha no login. Verifique as credenciais."
            return resultado
        
        # Converter datas
        from datetime import datetime as dt
        dt_inicio = dt.strptime(data_inicio, "%Y-%m-%d")
        dt_fim = dt.strptime(data_fim, "%Y-%m-%d")
        data_inicio_fmt = dt_inicio.strftime("%d/%m/%Y")
        data_fim_fmt = dt_fim.strftime("%d/%m/%Y")
        
        export_result = await rpa.solicitar_exportacao(data_inicio_fmt, data_fim_fmt)
        
        resultado["sucesso"] = export_result["sucesso"]
        resultado["mensagem"] = export_result["mensagem"]
        
        if export_result["sucesso"]:
            resultado["instrucoes"] = (
                "Os dados da Via Verde serão enviados para o seu email.\n"
                "1. Verifique a caixa de entrada do email\n"
                "2. Clique no link de download\n"
                "3. Importe o ficheiro CSV no sistema"
            )
        
    except Exception as e:
        resultado["mensagem"] = f"Erro: {str(e)}"
        logger.error(f"❌ Erro geral: {e}")
        
    finally:
        await rpa.fechar_browser()
    
    return resultado
