"""
Serviço de Browser Interativo para Login Uber
Permite ao utilizador ver e interagir com o browser Playwright via WebSocket
Utiliza sessão persistente de 30 dias para evitar login repetido
"""
import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Configurar Playwright
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'

# Directório persistente para sessões Uber (sobrevive a restarts)
UBER_SESSIONS_DIR = "/app/data/uber_sessions"


class BrowserInterativo:
    """Browser Playwright com interface interativa via screenshots - Sessão persistente de 30 dias"""
    
    def __init__(self, parceiro_id: str):
        self.parceiro_id = parceiro_id
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.ativo = False
        self.ultimo_screenshot = None
        # Directório persistente para guardar toda a sessão do browser (cookies, localStorage, etc.)
        self.user_data_dir = os.path.join(UBER_SESSIONS_DIR, f"parceiro_{parceiro_id}")
        
    async def iniciar(self):
        """Iniciar browser com contexto persistente (sessão de 30 dias)"""
        from playwright.async_api import async_playwright
        
        # Criar directório de sessão
        os.makedirs(self.user_data_dir, exist_ok=True)
        
        self.playwright = await async_playwright().start()
        
        # Usar launch_persistent_context para manter sessão entre utilizações
        # Isto guarda cookies, localStorage, sessionStorage, IndexedDB - tudo!
        logger.info(f"Iniciando browser Uber com sessão persistente: {self.user_data_dir}")
        
        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=self.user_data_dir,
            headless=True,
            viewport={"width": 1280, "height": 800},
            accept_downloads=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            locale='pt-PT',
            timezone_id='Europe/Lisbon',
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,800'
            ]
        )
        
        # Anti-detecção
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        """)
        
        # Usar página existente ou criar nova
        if self.context.pages:
            self.page = self.context.pages[0]
        else:
            self.page = await self.context.new_page()
        
        self.ativo = True
        
        logger.info(f"Browser interativo Uber iniciado para parceiro {self.parceiro_id} (sessão persistente)")
        return True
        
    async def navegar(self, url: str):
        """Navegar para URL"""
        if not self.page:
            return False
        await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(1)
        return True
        
    async def screenshot(self) -> Optional[str]:
        """Capturar screenshot como base64"""
        if not self.page:
            return None
        try:
            screenshot_bytes = await self.page.screenshot(type="jpeg", quality=50)
            self.ultimo_screenshot = base64.b64encode(screenshot_bytes).decode('utf-8')
            return self.ultimo_screenshot
        except Exception as e:
            logger.error(f"Erro no screenshot: {e}")
            return None
            
    async def clicar(self, x: int, y: int):
        """Clicar numa posição"""
        if not self.page:
            return False
        await self.page.mouse.click(x, y)
        await asyncio.sleep(0.5)
        return True
        
    async def escrever(self, texto: str):
        """Escrever texto"""
        if not self.page:
            return False
        await self.page.keyboard.type(texto, delay=50)
        return True
        
    async def tecla(self, tecla: str):
        """Pressionar tecla (Enter, Tab, etc)"""
        if not self.page:
            return False
        await self.page.keyboard.press(tecla)
        await asyncio.sleep(0.3)
        return True
        
    async def verificar_login(self) -> dict:
        """Verificar se está logado no Uber"""
        if not self.page:
            return {"logado": False, "erro": "Browser não iniciado"}
            
        url = self.page.url
        
        # Se está na página do fleet sem auth, está logado
        if "fleet.uber.com" in url and "auth" not in url:
            return {"logado": True, "url": url}
        if "supplier.uber.com" in url and "auth" not in url:
            return {"logado": True, "url": url}
            
        return {"logado": False, "url": url}
        
    async def guardar_sessao(self):
        """
        Guardar estado da sessão.
        Com launch_persistent_context, a sessão é automaticamente guardada no user_data_dir.
        Este método existe para compatibilidade e apenas confirma que o directório existe.
        """
        if not self.context:
            return False
        try:
            # Com contexto persistente, os dados são guardados automaticamente
            if os.path.exists(self.user_data_dir):
                logger.info(f"Sessão Uber persistente activa em: {self.user_data_dir}")
                return True
            else:
                logger.warning(f"Directório de sessão não encontrado: {self.user_data_dir}")
                return False
        except Exception as e:
            logger.error(f"Erro ao verificar sessão Uber: {e}")
            return False
            
    async def extrair_rendimentos(self) -> dict:
        """Extrair rendimentos após login"""
        if not self.page:
            return {"sucesso": False, "erro": "Browser não iniciado"}
            
        try:
            # Verificar se está logado
            status = await self.verificar_login()
            if not status["logado"]:
                return {"sucesso": False, "erro": "Não está logado"}
                
            # Navegar para rendimentos
            logger.info("A navegar para Rendimentos...")
            
            # Tentar encontrar link de rendimentos
            rendimentos_link = self.page.locator('a:has-text("Rendimentos"), a:has-text("Earnings"), [href*="earnings"]').first
            
            if await rendimentos_link.count() > 0:
                await rendimentos_link.click()
                await asyncio.sleep(3)
            else:
                # Tentar URL direta
                current_url = self.page.url
                if '/orgs/' in current_url:
                    org_id = current_url.split('/orgs/')[1].split('/')[0]
                    await self.page.goto(f"https://supplier.uber.com/orgs/{org_id}/earnings", wait_until="domcontentloaded")
                else:
                    await self.page.goto("https://fleet.uber.com/p3/earnings", wait_until="domcontentloaded")
                await asyncio.sleep(3)
                
            # Fazer download do relatório
            logger.info("A fazer download do relatório...")
            download_btn = self.page.locator('button:has-text("Fazer o download"), button:has-text("Download")').first
            
            motoristas_data = []
            
            if await download_btn.count() > 0 and await download_btn.is_visible():
                try:
                    os.makedirs("/tmp/uber_downloads", exist_ok=True)
                    
                    async with self.page.expect_download(timeout=60000) as download_info:
                        await download_btn.click()
                    
                    download = await download_info.value
                    
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    filename = f"/tmp/uber_downloads/uber_{self.parceiro_id}_{timestamp}.csv"
                    await download.save_as(filename)
                    
                    logger.info(f"CSV descarregado: {filename}")
                    
                    # Processar CSV
                    import csv
                    import io
                    
                    with open(filename, 'r', encoding='utf-8-sig') as f:
                        content = f.read()
                    
                    delimiter = ';' if ';' in content else ','
                    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
                    
                    for row in reader:
                        nome = row.get("Nome do motorista", row.get("Driver name", row.get("Nome", "")))
                        if nome:
                            motoristas_data.append({
                                "nome": nome,
                                "rendimentos_totais": self._parse_valor(row.get("Rendimentos totais", row.get("Total earnings", "0"))),
                                "rendimentos_liquidos": self._parse_valor(row.get("Rendimentos líquidos", row.get("Net earnings", "0"))),
                            })
                    
                    total = sum(m.get("rendimentos_liquidos", 0) for m in motoristas_data)
                    
                    return {
                        "sucesso": True,
                        "motoristas": motoristas_data,
                        "total_motoristas": len(motoristas_data),
                        "total_rendimentos": total,
                        "ficheiro": filename
                    }
                    
                except Exception as e:
                    logger.warning(f"Download falhou: {e}")
                    return {"sucesso": False, "erro": f"Erro no download: {str(e)}"}
            else:
                return {"sucesso": False, "erro": "Botão de download não encontrado"}
                
        except Exception as e:
            logger.error(f"Erro na extração: {e}")
            return {"sucesso": False, "erro": str(e)}
            
    def _parse_valor(self, valor_str: str) -> float:
        """Converter string de valor monetário para float"""
        if not valor_str:
            return 0.0
        valor = valor_str.replace("€", "").replace("$", "").replace(" ", "").strip()
        valor = valor.replace(",", ".")
        try:
            return float(valor)
        except:
            return 0.0
            
    async def fechar(self):
        """Fechar browser (a sessão persiste no user_data_dir)"""
        self.ativo = False
        try:
            # Com launch_persistent_context, o context inclui o browser
            if self.context:
                await self.context.close()
            if self.playwright:
                await self.playwright.stop()
            self.context = None
            self.page = None
            logger.info(f"Browser Uber fechado para parceiro {self.parceiro_id} (sessão persistente mantida)")
        except Exception as e:
            logger.error(f"Erro ao fechar browser Uber: {e}")


# Dicionário global de browsers ativos
browsers_ativos = {}


async def get_browser(parceiro_id: str) -> BrowserInterativo:
    """Obter ou criar browser para parceiro"""
    if parceiro_id not in browsers_ativos or not browsers_ativos[parceiro_id].ativo:
        browser = BrowserInterativo(parceiro_id)
        await browser.iniciar()
        browsers_ativos[parceiro_id] = browser
    return browsers_ativos[parceiro_id]


async def fechar_browser(parceiro_id: str):
    """Fechar browser de um parceiro"""
    if parceiro_id in browsers_ativos:
        await browsers_ativos[parceiro_id].fechar()
        del browsers_ativos[parceiro_id]
