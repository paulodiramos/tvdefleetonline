"""
Serviço de Execução Dinâmica de RPA v2
- Lê a configuração de passos de uma plataforma da BD
- Executa os passos automaticamente com Playwright
- Suporta datas dinâmicas, credenciais, downloads
"""
import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path

logger = logging.getLogger(__name__)

# Configurar Playwright
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'

# Directórios
DOWNLOADS_DIR = Path("/app/backend/rpa_downloads")
DOWNLOADS_DIR.mkdir(exist_ok=True)
SCREENSHOTS_DIR = Path("/app/backend/rpa_screenshots")
SCREENSHOTS_DIR.mkdir(exist_ok=True)


class RPADinamicoExecutor:
    """Executor dinâmico de passos RPA baseado na configuração da plataforma"""
    
    def __init__(self, plataforma: Dict[str, Any], credenciais: Dict[str, Any], parceiro_id: str):
        self.plataforma = plataforma
        self.credenciais = credenciais
        self.parceiro_id = parceiro_id
        self.playwright = None
        self.context = None
        self.page = None
        self.logs: List[str] = []
        self.screenshots: List[str] = []
        self.downloaded_files: List[str] = []
        
        # Datas para substituição dinâmica
        self.data_inicio: Optional[datetime] = None
        self.data_fim: Optional[datetime] = None
        self.formato_data: str = "%d/%m/%Y"
    
    def log(self, msg: str):
        """Adiciona log com timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {msg}"
        self.logs.append(log_entry)
        logger.info(f"[RPA:{self.plataforma.get('nome', '?')}] {msg}")
    
    async def screenshot(self, nome: str) -> Optional[str]:
        """Tira screenshot para debug"""
        if not self.page:
            return None
        try:
            safe_nome = "".join(c for c in nome if c.isalnum() or c in "_-")
            filename = f"{self.parceiro_id}_{self.plataforma.get('nome', 'unknown')}_{safe_nome}_{datetime.now().strftime('%H%M%S')}.png"
            path = SCREENSHOTS_DIR / filename
            await self.page.screenshot(path=str(path))
            self.screenshots.append(str(path))
            self.log(f"📸 Screenshot: {filename}")
            return str(path)
        except Exception as e:
            self.log(f"⚠️ Erro screenshot: {e}")
            return None
    
    async def iniciar_browser(self, headless: bool = True) -> bool:
        """Inicializa browser com contexto persistente"""
        try:
            from playwright.async_api import async_playwright
            
            self.playwright = await async_playwright().start()
            
            # Contexto persistente para manter sessão
            user_data_dir = f"/app/data/rpa_sessions/{self.parceiro_id}/{self.plataforma.get('id', 'default')}"
            Path(user_data_dir).mkdir(parents=True, exist_ok=True)
            
            self.context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir,
                headless=headless,
                viewport={"width": 1920, "height": 1080},
                accept_downloads=True,
                ignore_https_errors=True,
                args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
            )
            
            self.page = await self.context.new_page()
            self.log(f"✅ Browser iniciado")
            return True
            
        except Exception as e:
            self.log(f"❌ Erro browser: {e}")
            return False
    
    async def fechar_browser(self, manter_sessao: bool = True):
        """Fecha browser"""
        try:
            if self.context and not manter_sessao:
                await self.context.close()
            if self.playwright:
                await self.playwright.stop()
        except Exception as e:
            self.log(f"⚠️ Erro ao fechar: {e}")
    
    async def executar_passo(self, passo: Dict[str, Any]) -> bool:
        """Executa um passo individual"""
        tipo = passo.get("tipo", "")
        seletor = passo.get("seletor", "")
        valor = passo.get("valor", "")
        timeout = passo.get("timeout", 5000)
        descricao = passo.get("descricao", tipo)
        
        self.log(f"▶️ {passo.get('ordem', '?')}. {descricao}")
        
        try:
            # === NAVEGAÇÃO ===
            if tipo == "goto":
                url = valor or seletor
                await self.page.goto(url, timeout=timeout, wait_until="domcontentloaded")
                await self.page.wait_for_timeout(1000)
            
            # === ESPERAS ===
            elif tipo == "wait":
                await self.page.wait_for_timeout(timeout)
            
            elif tipo == "wait_selector":
                await self.page.wait_for_selector(seletor, timeout=timeout)
            
            # === CLIQUES ===
            elif tipo == "click":
                seletores = [s.strip() for s in seletor.split(",")]
                for sel in seletores:
                    try:
                        el = self.page.locator(sel).first
                        if await el.count() > 0:
                            await el.click(timeout=timeout)
                            break
                    except:
                        continue
            
            # === TEXTO ===
            elif tipo == "type":
                await self.page.locator(seletor).first.fill(valor, timeout=timeout)
            
            # === CREDENCIAIS ===
            elif tipo == "fill_credential":
                campo = passo.get("campo_credencial", "")
                valor_cred = self.credenciais.get(campo, "")
                if valor_cred:
                    seletores = [s.strip() for s in seletor.split(",")]
                    for sel in seletores:
                        try:
                            el = self.page.locator(sel).first
                            if await el.count() > 0:
                                await el.fill(str(valor_cred), timeout=timeout)
                                break
                        except:
                            continue
            
            # === DATAS DINÂMICAS ===
            elif tipo == "fill_date_start":
                if self.data_inicio:
                    data_str = self.data_inicio.strftime(self.formato_data)
                    seletores = [s.strip() for s in seletor.split(",")]
                    for sel in seletores:
                        try:
                            el = self.page.locator(sel).first
                            if await el.count() > 0:
                                await el.fill(data_str, timeout=timeout)
                                self.log(f"   📅 Data início: {data_str}")
                                break
                        except:
                            continue
            
            elif tipo == "fill_date_end":
                if self.data_fim:
                    data_str = self.data_fim.strftime(self.formato_data)
                    seletores = [s.strip() for s in seletor.split(",")]
                    for sel in seletores:
                        try:
                            el = self.page.locator(sel).first
                            if await el.count() > 0:
                                await el.fill(data_str, timeout=timeout)
                                self.log(f"   📅 Data fim: {data_str}")
                                break
                        except:
                            continue
            
            # === DOWNLOAD ===
            elif tipo == "download":
                async with self.page.expect_download(timeout=timeout) as download_info:
                    if seletor:
                        await self.page.locator(seletor).first.click()
                
                download = await download_info.value
                filename = f"{self.plataforma.get('nome', 'file')}_{self.parceiro_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{download.suggested_filename}"
                filepath = DOWNLOADS_DIR / filename
                await download.save_as(str(filepath))
                self.downloaded_files.append(str(filepath))
                self.log(f"   📥 Download: {filename}")
            
            # === TECLA ===
            elif tipo == "press":
                tecla = passo.get("tecla", "Enter")
                await self.page.keyboard.press(tecla)
            
            # === SCREENSHOT ===
            elif tipo == "screenshot":
                await self.screenshot(descricao)
            
            else:
                self.log(f"   ⚠️ Tipo desconhecido: {tipo}")
            
            return True
            
        except Exception as e:
            self.log(f"   ❌ Erro: {e}")
            await self.screenshot(f"erro_{passo.get('ordem', 0)}")
            return False
    
    async def executar_login(self) -> bool:
        """Executa passos de login"""
        passos = self.plataforma.get("passos_login", [])
        if not passos:
            return True
        
        self.log(f"🔐 Login ({len(passos)} passos)")
        
        for passo in sorted(passos, key=lambda x: x.get("ordem", 0)):
            if not await self.executar_passo(passo):
                return False
        
        self.log("✅ Login concluído")
        return True
    
    async def executar_extracao(self, data_inicio: datetime, data_fim: datetime) -> Dict[str, Any]:
        """Executa passos de extração"""
        self.data_inicio = data_inicio
        self.data_fim = data_fim
        
        passos = self.plataforma.get("passos_extracao", [])
        if not passos:
            return {"sucesso": False, "erro": "Sem passos de extração"}
        
        self.log(f"📊 Extração ({len(passos)} passos)")
        self.log(f"   Período: {data_inicio.strftime('%d/%m/%Y')} a {data_fim.strftime('%d/%m/%Y')}")
        
        for passo in sorted(passos, key=lambda x: x.get("ordem", 0)):
            if not await self.executar_passo(passo):
                return {
                    "sucesso": False,
                    "erro": f"Falha no passo {passo.get('ordem')}: {passo.get('descricao')}",
                    "ficheiros": self.downloaded_files
                }
        
        self.log(f"✅ Extração concluída - {len(self.downloaded_files)} ficheiro(s)")
        return {"sucesso": True, "ficheiros": self.downloaded_files}
    
    async def executar_completo(self, data_inicio: datetime, data_fim: datetime, headless: bool = True) -> Dict[str, Any]:
        """Executa sincronização completa"""
        resultado = {
            "sucesso": False,
            "plataforma": self.plataforma.get("nome"),
            "parceiro_id": self.parceiro_id,
            "ficheiros": [],
            "logs": [],
            "screenshots": [],
            "erro": None,
            "iniciado_em": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            if not await self.iniciar_browser(headless):
                resultado["erro"] = "Falha ao iniciar browser"
                resultado["logs"] = self.logs
                return resultado
            
            # Login (se automático)
            tipo_login = self.plataforma.get("tipo_login", "automatico")
            if tipo_login == "automatico":
                if not await self.executar_login():
                    resultado["erro"] = "Falha no login"
                    resultado["logs"] = self.logs
                    resultado["screenshots"] = self.screenshots
                    return resultado
            else:
                # Login manual - apenas navegar
                url = self.plataforma.get("url_login") or self.plataforma.get("url_base", "")
                if url:
                    await self.page.goto(url)
                    await self.page.wait_for_timeout(2000)
            
            # Extração
            ext = await self.executar_extracao(data_inicio, data_fim)
            resultado["sucesso"] = ext.get("sucesso", False)
            resultado["erro"] = ext.get("erro")
            resultado["ficheiros"] = ext.get("ficheiros", [])
            
        except Exception as e:
            resultado["erro"] = str(e)
            self.log(f"❌ Erro: {e}")
        
        finally:
            await self.fechar_browser(manter_sessao=True)
            resultado["logs"] = self.logs
            resultado["screenshots"] = self.screenshots
            resultado["terminado_em"] = datetime.now(timezone.utc).isoformat()
        
        return resultado


async def executar_sincronizacao_dinamica(
    plataforma_id: str,
    parceiro_id: str,
    data_inicio: datetime,
    data_fim: datetime,
    headless: bool = True,
    db = None
) -> Dict[str, Any]:
    """
    Função principal para executar sincronização dinâmica.
    """
    if db is None:
        from utils.database import get_database
        db = get_database()
    
    # Carregar plataforma
    plataforma = await db.plataformas.find_one({"id": plataforma_id}, {"_id": 0})
    if not plataforma:
        return {"sucesso": False, "erro": f"Plataforma não encontrada"}
    
    # Carregar credenciais
    cred_doc = await db.credenciais_parceiros.find_one({
        "parceiro_id": parceiro_id,
        "plataforma_id": plataforma_id,
        "ativo": True
    }, {"_id": 0})
    
    if not cred_doc:
        return {"sucesso": False, "erro": f"Credenciais não configuradas"}
    
    credenciais = {
        "email": cred_doc.get("email", ""),
        "password": cred_doc.get("password_encrypted", ""),
        **cred_doc.get("dados_extra", {})
    }
    
    # Executar
    executor = RPADinamicoExecutor(plataforma, credenciais, parceiro_id)
    resultado = await executor.executar_completo(data_inicio, data_fim, headless)
    
    # Registar log
    log_entry = {
        "parceiro_id": parceiro_id,
        "plataforma_id": plataforma_id,
        "plataforma_nome": plataforma.get("nome"),
        "status": "sucesso" if resultado["sucesso"] else "erro",
        "erro": resultado.get("erro"),
        "ficheiros": resultado.get("ficheiros", []),
        "iniciado_em": resultado.get("iniciado_em"),
        "terminado_em": resultado.get("terminado_em"),
        "periodo": {"inicio": data_inicio.isoformat(), "fim": data_fim.isoformat()}
    }
    await db.logs_sincronizacao.insert_one(log_entry)
    
    # Actualizar estatísticas
    await db.plataformas.update_one(
        {"id": plataforma_id},
        {
            "$inc": {"total_sincronizacoes": 1},
            "$set": {"ultima_sincronizacao": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return resultado
