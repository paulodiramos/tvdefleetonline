"""
RPA Execution Engine using Playwright
Executes automation scripts step by step
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

# Paths
ROOT_DIR = Path(__file__).parent.parent
UPLOAD_DIR = ROOT_DIR / "uploads"
SCREENSHOTS_DIR = UPLOAD_DIR / "automacao_screenshots"
DOWNLOADS_DIR = UPLOAD_DIR / "automacao_downloads"

# Ensure directories exist
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Encryption
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", Fernet.generate_key().decode())
cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)


def decrypt_password(encrypted: str) -> str:
    """Decrypt a password"""
    try:
        return cipher_suite.decrypt(encrypted.encode()).decode()
    except Exception as e:
        logger.error(f"Error decrypting password: {e}")
        return ""


class AutomacaoExecutor:
    """
    Executes automation scripts using Playwright
    """
    
    def __init__(self, db, execucao_id: str):
        self.db = db
        self.execucao_id = execucao_id
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.logs: List[Dict[str, Any]] = []
        self.screenshots: List[str] = []
        self.variaveis: Dict[str, str] = {}
        self.download_path: Optional[str] = None
        
    async def log(self, mensagem: str, tipo: str = "info"):
        """Add log entry"""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tipo": tipo,
            "mensagem": mensagem
        }
        self.logs.append(entry)
        
        if tipo == "error":
            logger.error(f"[{self.execucao_id[:8]}] {mensagem}")
        else:
            logger.info(f"[{self.execucao_id[:8]}] {mensagem}")
        
        # Update in database
        await self.db.execucoes_automacao.update_one(
            {"id": self.execucao_id},
            {"$push": {"logs": entry}}
        )
    
    async def update_status(self, status: str, progresso: int = None, passo_atual: str = None):
        """Update execution status"""
        update = {"status": status}
        if progresso is not None:
            update["progresso"] = progresso
        if passo_atual is not None:
            update["passo_atual"] = passo_atual
        
        await self.db.execucoes_automacao.update_one(
            {"id": self.execucao_id},
            {"$set": update}
        )
    
    async def take_screenshot(self, nome: str) -> Optional[str]:
        """Take screenshot and save"""
        if not self.page:
            return None
        
        try:
            filename = f"{self.execucao_id}_{nome}_{uuid.uuid4().hex[:8]}.png"
            filepath = SCREENSHOTS_DIR / filename
            await self.page.screenshot(path=str(filepath))
            
            relative_path = str(filepath.relative_to(ROOT_DIR))
            self.screenshots.append(relative_path)
            
            await self.db.execucoes_automacao.update_one(
                {"id": self.execucao_id},
                {"$push": {"screenshots": relative_path}}
            )
            
            await self.log(f"Screenshot guardado: {nome}")
            return relative_path
        except Exception as e:
            await self.log(f"Erro ao tirar screenshot: {e}", "error")
            return None
    
    async def setup_browser(self):
        """Initialize browser"""
        await self.log("A iniciar browser...")
        
        playwright = await async_playwright().start()
        
        # Create downloads directory for this execution
        self.download_path = str(DOWNLOADS_DIR / self.execucao_id)
        os.makedirs(self.download_path, exist_ok=True)
        
        self.browser = await playwright.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        )
        
        self.context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            accept_downloads=True,
            locale="pt-PT"
        )
        
        self.page = await self.context.new_page()
        
        # Handle downloads
        self.page.on("download", self._handle_download)
        
        await self.log("Browser iniciado com sucesso")
    
    async def _handle_download(self, download):
        """Handle file downloads"""
        try:
            suggested_filename = download.suggested_filename
            filepath = os.path.join(self.download_path, suggested_filename)
            await download.save_as(filepath)
            
            # Update execution with downloaded file
            await self.db.execucoes_automacao.update_one(
                {"id": self.execucao_id},
                {"$set": {"ficheiro_resultado": filepath}}
            )
            
            await self.log(f"Ficheiro descarregado: {suggested_filename}")
        except Exception as e:
            await self.log(f"Erro ao guardar download: {e}", "error")
    
    async def close_browser(self):
        """Close browser"""
        try:
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            await self.log("Browser fechado")
        except Exception as e:
            await self.log(f"Erro ao fechar browser: {e}", "error")
    
    def replace_variables(self, value: str) -> str:
        """Replace {{variable}} placeholders with actual values"""
        if not value:
            return value
        
        result = value
        for var_name, var_value in self.variaveis.items():
            result = result.replace(f"{{{{{var_name}}}}}", var_value or "")
        
        return result
    
    async def execute_step(self, passo: Dict[str, Any]) -> bool:
        """Execute a single automation step"""
        tipo = passo.get("tipo")
        nome = passo.get("nome", tipo)
        seletor = self.replace_variables(passo.get("seletor", ""))
        valor = self.replace_variables(passo.get("valor", ""))
        timeout = passo.get("timeout", 30000)
        opcional = passo.get("opcional", False)
        
        await self.log(f"Executando passo: {nome} ({tipo})")
        
        try:
            if passo.get("screenshot_antes"):
                await self.take_screenshot(f"antes_{nome}")
            
            if tipo == "navegar":
                await self.page.goto(valor, wait_until="domcontentloaded", timeout=timeout)
                await asyncio.sleep(2)  # Wait for page to stabilize
                
            elif tipo == "clicar":
                await self.page.wait_for_selector(seletor, timeout=timeout)
                await self.page.click(seletor, force=True)
                await asyncio.sleep(1)
                
            elif tipo == "preencher":
                await self.page.wait_for_selector(seletor, timeout=timeout)
                await self.page.fill(seletor, valor)
                await asyncio.sleep(0.5)
                
            elif tipo == "selecionar":
                await self.page.wait_for_selector(seletor, timeout=timeout)
                await self.page.select_option(seletor, valor)
                
            elif tipo == "esperar":
                if seletor:
                    await self.page.wait_for_selector(seletor, timeout=timeout)
                else:
                    await asyncio.sleep(timeout / 1000)
                    
            elif tipo == "download":
                # Wait for download to start
                async with self.page.expect_download(timeout=timeout) as download_info:
                    if seletor:
                        await self.page.click(seletor)
                download = await download_info.value
                
                # Save the download
                filename = passo.get("nome_ficheiro", download.suggested_filename)
                filename = self.replace_variables(filename)
                filepath = os.path.join(self.download_path, filename)
                await download.save_as(filepath)
                
                await self.db.execucoes_automacao.update_one(
                    {"id": self.execucao_id},
                    {"$set": {"ficheiro_resultado": filepath}}
                )
                await self.log(f"Ficheiro descarregado: {filename}")
                
            elif tipo == "screenshot":
                await self.take_screenshot(nome)
                
            elif tipo == "extrair_texto":
                await self.page.wait_for_selector(seletor, timeout=timeout)
                element = await self.page.query_selector(seletor)
                if element:
                    texto = await element.text_content()
                    variavel = passo.get("variavel", "texto_extraido")
                    self.variaveis[variavel] = texto
                    await self.log(f"Texto extraído: {texto[:100]}...")
                    
            elif tipo == "extrair_tabela":
                await self.page.wait_for_selector(seletor, timeout=timeout)
                # Extract table data
                rows = await self.page.query_selector_all(f"{seletor} tr")
                table_data = []
                for row in rows:
                    cells = await row.query_selector_all("td, th")
                    row_data = [await cell.text_content() for cell in cells]
                    table_data.append(row_data)
                
                await self.log(f"Tabela extraída: {len(table_data)} linhas")
                
            elif tipo == "codigo_2fa":
                # For 2FA, we need to wait for user input or use TOTP
                await self.page.wait_for_selector(seletor, timeout=timeout)
                if valor:  # If we have a TOTP secret
                    import pyotp
                    totp = pyotp.TOTP(valor)
                    codigo = totp.now()
                    await self.page.fill(seletor, codigo)
                else:
                    await self.log("⚠️ Código 2FA necessário - aguardando...", "warning")
                    # Wait longer for manual intervention
                    await asyncio.sleep(30)
                    
            elif tipo == "condicao":
                # Conditional execution
                condicao = passo.get("condicao", "")
                elemento_existe = False
                try:
                    elemento_existe = await self.page.wait_for_selector(condicao, timeout=5000) is not None
                except:
                    pass
                
                if elemento_existe:
                    passos_verdadeiro = passo.get("passos_se_verdadeiro", [])
                    for sub_passo in passos_verdadeiro:
                        await self.execute_step(sub_passo)
                else:
                    passos_falso = passo.get("passos_se_falso", [])
                    for sub_passo in passos_falso:
                        await self.execute_step(sub_passo)
            
            if passo.get("screenshot_depois"):
                await self.take_screenshot(f"depois_{nome}")
            
            await self.log(f"✅ Passo concluído: {nome}")
            return True
            
        except Exception as e:
            error_msg = f"❌ Erro no passo '{nome}': {str(e)}"
            await self.log(error_msg, "error")
            await self.take_screenshot(f"erro_{nome}")
            
            if opcional:
                await self.log(f"Passo opcional, continuando...")
                return True
            
            return False
    
    async def run(
        self,
        automacao: Dict[str, Any],
        credenciais: Dict[str, Any],
        data_inicio: str = None,
        data_fim: str = None
    ) -> Dict[str, Any]:
        """
        Run the complete automation
        """
        resultado = {
            "sucesso": False,
            "ficheiro": None,
            "registos": 0,
            "erro": None
        }
        
        try:
            # Update status
            await self.update_status("em_execucao", 0)
            await self.log(f"Iniciando automação: {automacao.get('nome')}")
            
            # Set variables
            self.variaveis = {
                "email": credenciais.get("email", ""),
                "password": decrypt_password(credenciais.get("password_encrypted", "")),
                "codigo_2fa": credenciais.get("codigo_2fa_secret", ""),
                "data_inicio": data_inicio or datetime.now().strftime("%Y-%m-%d"),
                "data_fim": data_fim or datetime.now().strftime("%Y-%m-%d"),
                "data": datetime.now().strftime("%Y%m%d")
            }
            
            # Add extra data from credentials
            for key, value in credenciais.get("dados_extra", {}).items():
                self.variaveis[key] = value
            
            # Setup browser
            await self.setup_browser()
            await self.take_screenshot("inicio")
            
            # Get steps
            passos = automacao.get("passos", [])
            total_passos = len(passos)
            
            if total_passos == 0:
                await self.log("Nenhum passo definido na automação", "error")
                resultado["erro"] = "Nenhum passo definido"
                return resultado
            
            # Execute steps
            for i, passo in enumerate(passos):
                progresso = int((i / total_passos) * 100)
                await self.update_status("em_execucao", progresso, passo.get("nome", f"Passo {i+1}"))
                
                success = await self.execute_step(passo)
                
                if not success:
                    resultado["erro"] = f"Falha no passo: {passo.get('nome', i+1)}"
                    await self.update_status("erro", progresso)
                    await self.take_screenshot("erro_final")
                    return resultado
            
            # Take final screenshot
            await self.take_screenshot("final")
            
            # Success
            await self.update_status("sucesso", 100)
            await self.log("✅ Automação concluída com sucesso!")
            
            resultado["sucesso"] = True
            resultado["ficheiro"] = self.download_path
            
            # Update execution record
            await self.db.execucoes_automacao.update_one(
                {"id": self.execucao_id},
                {"$set": {
                    "status": "sucesso",
                    "progresso": 100,
                    "terminado_em": datetime.now(timezone.utc).isoformat(),
                    "screenshots": self.screenshots
                }}
            )
            
        except Exception as e:
            error_msg = f"Erro na automação: {str(e)}"
            await self.log(error_msg, "error")
            await self.take_screenshot("erro_excecao")
            
            resultado["erro"] = error_msg
            
            await self.db.execucoes_automacao.update_one(
                {"id": self.execucao_id},
                {"$set": {
                    "status": "erro",
                    "erro_mensagem": error_msg,
                    "terminado_em": datetime.now(timezone.utc).isoformat()
                }}
            )
            
        finally:
            await self.close_browser()
        
        return resultado


async def run_automation(db, execucao_id: str):
    """
    Background task to run automation
    """
    try:
        # Get execution details
        execucao = await db.execucoes_automacao.find_one({"id": execucao_id}, {"_id": 0})
        if not execucao:
            logger.error(f"Execução não encontrada: {execucao_id}")
            return
        
        # Get automation
        automacao = await db.automacoes.find_one({"id": execucao["automacao_id"]}, {"_id": 0})
        if not automacao:
            logger.error(f"Automação não encontrada: {execucao['automacao_id']}")
            await db.execucoes_automacao.update_one(
                {"id": execucao_id},
                {"$set": {"status": "erro", "erro_mensagem": "Automação não encontrada"}}
            )
            return
        
        # Get credentials
        credenciais = await db.credenciais_parceiro.find_one({
            "parceiro_id": execucao["parceiro_id"],
            "fornecedor_id": execucao["fornecedor_id"]
        }, {"_id": 0})
        
        if not credenciais:
            logger.error(f"Credenciais não encontradas para parceiro {execucao['parceiro_id']}")
            await db.execucoes_automacao.update_one(
                {"id": execucao_id},
                {"$set": {"status": "erro", "erro_mensagem": "Credenciais não configuradas"}}
            )
            return
        
        # Run automation
        executor = AutomacaoExecutor(db, execucao_id)
        resultado = await executor.run(
            automacao=automacao,
            credenciais=credenciais,
            data_inicio=execucao.get("data_inicio"),
            data_fim=execucao.get("data_fim")
        )
        
        # Update automation stats
        if resultado["sucesso"]:
            await db.automacoes.update_one(
                {"id": automacao["id"]},
                {
                    "$set": {"ultima_execucao": datetime.now(timezone.utc).isoformat()},
                    "$inc": {"execucoes_sucesso": 1}
                }
            )
        else:
            await db.automacoes.update_one(
                {"id": automacao["id"]},
                {"$inc": {"execucoes_erro": 1}}
            )
        
        logger.info(f"Automação {execucao_id} concluída: {'sucesso' if resultado['sucesso'] else 'erro'}")
        
    except Exception as e:
        logger.error(f"Erro ao executar automação {execucao_id}: {e}")
        await db.execucoes_automacao.update_one(
            {"id": execucao_id},
            {"$set": {
                "status": "erro",
                "erro_mensagem": str(e),
                "terminado_em": datetime.now(timezone.utc).isoformat()
            }}
        )
