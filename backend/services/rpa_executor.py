"""
Motor de Execução RPA
Executa designs gravados pelo admin para cada parceiro
"""
import asyncio
import os
import logging
import uuid
import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path

logger = logging.getLogger(__name__)

# Configurar Playwright
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'


class RPAExecutor:
    """Executor de designs RPA gravados"""
    
    def __init__(self, parceiro_id: str, plataforma_id: str):
        self.parceiro_id = parceiro_id
        self.plataforma_id = plataforma_id
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.session_path = f"/tmp/rpa_sessao_{parceiro_id}_{plataforma_id}.json"
        self.downloads_path = Path("/tmp/rpa_downloads")
        self.downloads_path.mkdir(exist_ok=True)
        self.screenshots_path = Path("/tmp/rpa_screenshots")
        self.screenshots_path.mkdir(exist_ok=True)
        self.logs: List[str] = []
        self.screenshots: List[str] = []
        self.downloaded_file = None
        
    def _log(self, msg: str):
        """Adicionar log"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {msg}"
        self.logs.append(log_entry)
        logger.info(f"[RPA {self.parceiro_id}] {msg}")
        
    async def iniciar(self, usar_sessao: bool = True) -> bool:
        """Iniciar browser"""
        from playwright.async_api import async_playwright
        
        self._log("A iniciar browser...")
        self.playwright = await async_playwright().start()
        
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        )
        
        # Carregar sessão se existir
        storage_state = None
        if usar_sessao and os.path.exists(self.session_path):
            storage_state = self.session_path
            self._log(f"Sessão carregada: {self.session_path}")
        
        self.context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            accept_downloads=True,
            storage_state=storage_state,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            locale='pt-PT'
        )
        
        # Anti-detecção
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        """)
        
        self.page = await self.context.new_page()
        self._log("Browser iniciado com sucesso")
        return True
        
    async def guardar_sessao(self):
        """Guardar sessão atual"""
        if self.context:
            await self.context.storage_state(path=self.session_path)
            self._log(f"Sessão guardada: {self.session_path}")
            
    async def tirar_screenshot(self, nome: str = None) -> str:
        """Tirar screenshot da página atual"""
        if not nome:
            nome = f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        filepath = f"{self.screenshots_path}/{self.parceiro_id}_{nome}.png"
        await self.page.screenshot(path=filepath, full_page=False)
        self.screenshots.append(filepath)
        self._log(f"Screenshot: {filepath}")
        return filepath
        
    async def executar_passo(self, passo: Dict[str, Any], credenciais: Dict[str, str], variaveis: Dict[str, Any]) -> bool:
        """Executar um passo individual"""
        tipo = passo.get("tipo")
        self._log(f"Passo {passo.get('ordem')}: {tipo} - {passo.get('descricao', '')}")
        
        try:
            if tipo == "goto":
                url = passo.get("valor", "")
                # Substituir variáveis na URL
                for var_nome, var_valor in variaveis.items():
                    url = url.replace(f"{{{{{var_nome}}}}}", str(var_valor))
                await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(2)
                
            elif tipo == "click":
                elemento = await self._encontrar_elemento(passo)
                if elemento:
                    await elemento.click()
                    await asyncio.sleep(1)
                else:
                    self._log(f"⚠️ Elemento não encontrado: {passo.get('seletor')}")
                    return False
                    
            elif tipo == "type":
                elemento = await self._encontrar_elemento(passo)
                if elemento:
                    valor = passo.get("valor", "")
                    # Substituir variáveis
                    for var_nome, var_valor in variaveis.items():
                        valor = valor.replace(f"{{{{{var_nome}}}}}", str(var_valor))
                    await elemento.fill(valor)
                    await asyncio.sleep(0.5)
                else:
                    return False
                    
            elif tipo == "fill_credential":
                elemento = await self._encontrar_elemento(passo)
                if elemento:
                    campo = passo.get("campo_credencial", "")
                    valor = credenciais.get(campo, "")
                    if not valor:
                        self._log(f"⚠️ Credencial não encontrada: {campo}")
                        return False
                    await elemento.fill(valor)
                    await asyncio.sleep(0.5)
                else:
                    return False
                    
            elif tipo == "select":
                elemento = await self._encontrar_elemento(passo)
                if elemento:
                    valor = passo.get("valor", "")
                    await elemento.select_option(valor)
                    await asyncio.sleep(1)
                else:
                    return False
                    
            elif tipo == "wait":
                ms = passo.get("timeout", 2000)
                await asyncio.sleep(ms / 1000)
                
            elif tipo == "wait_selector":
                seletor = passo.get("seletor", "")
                timeout = passo.get("timeout", 10000)
                await self.page.wait_for_selector(seletor, timeout=timeout)
                
            elif tipo == "press":
                tecla = passo.get("tecla", "Enter")
                await self.page.keyboard.press(tecla)
                await asyncio.sleep(0.5)
                
            elif tipo == "scroll":
                direcao = passo.get("direcao", "down")
                pixels = passo.get("pixels", 300)
                if direcao == "down":
                    await self.page.evaluate(f"window.scrollBy(0, {pixels})")
                elif direcao == "up":
                    await self.page.evaluate(f"window.scrollBy(0, -{pixels})")
                await asyncio.sleep(0.5)
                
            elif tipo == "hover":
                elemento = await self._encontrar_elemento(passo)
                if elemento:
                    await elemento.hover()
                    await asyncio.sleep(0.5)
                    
            elif tipo == "screenshot":
                nome = passo.get("valor", f"passo_{passo.get('ordem')}")
                await self.tirar_screenshot(nome)
                
            elif tipo == "download":
                timeout = passo.get("timeout", 60000)
                return await self._aguardar_download(timeout)
                
            elif tipo == "variable":
                # Variáveis são processadas na substituição, este passo é informativo
                pass
                
            return True
            
        except Exception as e:
            self._log(f"❌ Erro no passo {passo.get('ordem')}: {str(e)}")
            return False
            
    async def _encontrar_elemento(self, passo: Dict[str, Any]):
        """Encontrar elemento na página"""
        seletor = passo.get("seletor", "")
        seletor_tipo = passo.get("seletor_tipo", "css")
        
        try:
            if seletor_tipo == "css":
                elemento = self.page.locator(seletor).first
            elif seletor_tipo == "xpath":
                elemento = self.page.locator(f"xpath={seletor}").first
            elif seletor_tipo == "text":
                elemento = self.page.get_by_text(seletor).first
            elif seletor_tipo == "role":
                # Formato: "button:Gerar relatório"
                parts = seletor.split(":", 1)
                role = parts[0]
                name = parts[1] if len(parts) > 1 else None
                elemento = self.page.get_by_role(role, name=name).first
            else:
                elemento = self.page.locator(seletor).first
                
            if await elemento.count() > 0:
                return elemento
            return None
            
        except Exception as e:
            self._log(f"Erro ao encontrar elemento: {e}")
            return None
            
    async def _aguardar_download(self, timeout: int = 60000) -> bool:
        """Aguardar e processar download"""
        try:
            # Procurar botão de download
            download_btns = [
                self.page.get_by_role("button", name="download"),
                self.page.get_by_role("link", name="download"),
                self.page.get_by_text("Download"),
                self.page.get_by_text("Exportar"),
                self.page.locator('a[download]').first,
            ]
            
            for btn in download_btns:
                if await btn.count() > 0:
                    async with self.page.expect_download(timeout=timeout) as download_info:
                        await btn.click()
                    
                    download = await download_info.value
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    filename = f"{self.downloads_path}/{self.parceiro_id}_{self.plataforma_id}_{timestamp}.csv"
                    await download.save_as(filename)
                    
                    self._log(f"✅ Ficheiro descarregado: {filename}")
                    self.downloaded_file = filename
                    return True
                    
            self._log("⚠️ Nenhum botão de download encontrado")
            return False
            
        except Exception as e:
            self._log(f"❌ Erro no download: {e}")
            return False
            
    async def executar_design(self, design: Dict[str, Any], credenciais: Dict[str, str], variaveis: Dict[str, Any] = None) -> Dict[str, Any]:
        """Executar um design completo"""
        if variaveis is None:
            variaveis = {}
            
        self.downloaded_file = None
        resultado = {
            "sucesso": False,
            "passos_executados": 0,
            "passos_total": len(design.get("passos", [])),
            "ficheiro": None,
            "logs": [],
            "screenshots": [],
            "erro": None
        }
        
        try:
            self._log(f"A executar design: {design.get('nome')}")
            
            # Calcular variáveis de semana
            semana_offset = design.get("semana_offset", 0)
            hoje = datetime.now()
            
            # Calcular datas da semana
            dias_atras = semana_offset * 7
            fim_semana = hoje - timedelta(days=dias_atras)
            inicio_semana = fim_semana - timedelta(days=7)
            
            variaveis.update({
                "SEMANA_OFFSET": semana_offset,
                "SEMANA_INICIO": inicio_semana.strftime("%d/%m/%Y"),
                "SEMANA_FIM": fim_semana.strftime("%d/%m/%Y"),
                "SEMANA_INICIO_ISO": inicio_semana.strftime("%Y-%m-%d"),
                "SEMANA_FIM_ISO": fim_semana.strftime("%Y-%m-%d"),
                "DATA_ATUAL": hoje.strftime("%d/%m/%Y"),
            })
            
            self._log(f"Variáveis: {variaveis}")
            
            # Executar passos
            passos = design.get("passos", [])
            for passo in passos:
                sucesso = await self.executar_passo(passo, credenciais, variaveis)
                resultado["passos_executados"] += 1
                
                if not sucesso and passo.get("tipo") not in ["screenshot", "variable"]:
                    # Passo crítico falhou
                    resultado["erro"] = f"Passo {passo.get('ordem')} falhou"
                    break
                    
            # Guardar sessão após execução
            await self.guardar_sessao()
            
            # Verificar se houve download
            if self.downloaded_file:
                resultado["ficheiro"] = self.downloaded_file
                resultado["sucesso"] = True
            elif resultado["passos_executados"] == resultado["passos_total"]:
                resultado["sucesso"] = True
                
            resultado["logs"] = self.logs
            resultado["screenshots"] = self.screenshots
            
            self._log(f"Execução concluída: {'✅ Sucesso' if resultado['sucesso'] else '❌ Falhou'}")
            
        except Exception as e:
            resultado["erro"] = str(e)
            resultado["logs"] = self.logs
            self._log(f"❌ Erro na execução: {e}")
            
        return resultado
        
    async def fechar(self):
        """Fechar browser"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        self._log("Browser fechado")


async def executar_design_parceiro(
    parceiro_id: str,
    plataforma_id: str,
    design: Dict[str, Any],
    credenciais: Dict[str, str]
) -> Dict[str, Any]:
    """Função helper para executar design de um parceiro"""
    executor = RPAExecutor(parceiro_id, plataforma_id)
    
    try:
        await executor.iniciar()
        resultado = await executor.executar_design(design, credenciais)
        await executor.fechar()
        return resultado
        
    except Exception as e:
        await executor.fechar()
        return {
            "sucesso": False,
            "erro": str(e),
            "logs": executor.logs,
            "screenshots": executor.screenshots
        }
