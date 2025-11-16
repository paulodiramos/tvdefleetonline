"""
Sistema de Sincronização Automática de Plataformas
Suporta: Uber, Bolt, Via Verde, Cartão Combustível, GPS
"""

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
import asyncio
import os
from datetime import datetime, timezone
import logging
from cryptography.fernet import Fernet
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# Chave de encriptação (deve estar no .env)
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key())
fernet = Fernet(ENCRYPTION_KEY)

def encrypt_password(password: str) -> str:
    """Encripta password"""
    return fernet.encrypt(password.encode()).decode()

def decrypt_password(encrypted_password: str) -> str:
    """Desencripta password"""
    return fernet.decrypt(encrypted_password.encode()).decode()


class PlatformSyncer:
    """Classe base para sincronização de plataformas"""
    
    def __init__(self, email: str, password: str, headless: bool = True):
        self.email = email
        self.password = password
        self.headless = headless
        self.browser = None
        self.context = None
        self.page = None
        
    async def __aenter__(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=self.headless)
        self.context = await self.browser.new_context()
        self.page = await self.context.new_page()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
            
    async def download_csv(self) -> tuple[bool, str, str]:
        """
        Método abstrato - deve ser implementado por cada plataforma
        Retorna: (sucesso, caminho_ficheiro, mensagem)
        """
        raise NotImplementedError


class UberSyncer(PlatformSyncer):
    """Sincronizador para Uber"""
    
    async def download_csv(self) -> tuple[bool, str, str]:
        try:
            logger.info("Iniciando sincronização Uber...")
            
            # 1. Navegar para página de login
            await self.page.goto('https://partners.uber.com/login', timeout=30000)
            await self.page.wait_for_load_state('networkidle')
            
            # 2. Fazer login
            await self.page.fill('input[type="email"]', self.email)
            await self.page.click('button[type="submit"]')
            await asyncio.sleep(2)
            
            await self.page.fill('input[type="password"]', self.password)
            await self.page.click('button[type="submit"]')
            
            # 3. Aguardar login (pode ter 2FA na primeira vez)
            try:
                # Esperar pela dashboard
                await self.page.wait_for_url('**/dashboard**', timeout=60000)
            except PlaywrightTimeout:
                # Se timeout, pode ser 2FA - retornar status especial
                if 'verification' in self.page.url or 'sms' in self.page.url:
                    return False, '', 'Requer verificação SMS. Complete manualmente e tente novamente.'
                return False, '', 'Timeout ao fazer login'
            
            logger.info("Login Uber bem-sucedido")
            
            # 4. Navegar para área de pagamentos
            await self.page.goto('https://partners.uber.com/payments', timeout=30000)
            await self.page.wait_for_load_state('networkidle')
            
            # 5. Procurar e clicar no botão de download
            download_button = self.page.locator('text=/download|export|baixar/i').first
            
            # Setup download
            download_path = tempfile.mkdtemp()
            
            async with self.page.expect_download() as download_info:
                await download_button.click()
            
            download = await download_info.value
            file_path = os.path.join(download_path, download.suggested_filename)
            await download.save_as(file_path)
            
            logger.info(f"Ficheiro Uber baixado: {file_path}")
            return True, file_path, 'Sucesso'
            
        except Exception as e:
            logger.error(f"Erro ao sincronizar Uber: {e}")
            return False, '', str(e)


class BoltSyncer(PlatformSyncer):
    """Sincronizador para Bolt"""
    
    async def download_csv(self) -> tuple[bool, str, str]:
        try:
            logger.info("Iniciando sincronização Bolt...")
            
            # 1. Navegar para página de login Bolt
            await self.page.goto('https://fleet.bolt.eu/login', timeout=30000)
            await self.page.wait_for_load_state('networkidle')
            
            # 2. Fazer login
            await self.page.fill('input[type="email"], input[name="email"]', self.email)
            await self.page.fill('input[type="password"], input[name="password"]', self.password)
            await self.page.click('button[type="submit"]')
            
            # 3. Aguardar dashboard
            await self.page.wait_for_url('**/dashboard**', timeout=30000)
            logger.info("Login Bolt bem-sucedido")
            
            # 4. Navegar para reports/earnings
            await self.page.goto('https://fleet.bolt.eu/reports/earnings', timeout=30000)
            await self.page.wait_for_load_state('networkidle')
            
            # 5. Download CSV
            download_path = tempfile.mkdtemp()
            
            async with self.page.expect_download() as download_info:
                # Procurar botão de export/download
                await self.page.locator('text=/export|download|baixar/i').first.click()
            
            download = await download_info.value
            file_path = os.path.join(download_path, download.suggested_filename)
            await download.save_as(file_path)
            
            logger.info(f"Ficheiro Bolt baixado: {file_path}")
            return True, file_path, 'Sucesso'
            
        except Exception as e:
            logger.error(f"Erro ao sincronizar Bolt: {e}")
            return False, '', str(e)


class ViaVerdeSyncer(PlatformSyncer):
    """Sincronizador para Via Verde"""
    
    async def download_csv(self) -> tuple[bool, str, str]:
        try:
            logger.info("Iniciando sincronização Via Verde...")
            
            # 1. Login Via Verde
            await self.page.goto('https://www.viaverde.pt/particulares/area-reservada', timeout=30000)
            await self.page.wait_for_load_state('networkidle')
            
            # 2. Preencher credenciais
            await self.page.fill('input[name="username"], input[type="text"]', self.email)
            await self.page.fill('input[name="password"], input[type="password"]', self.password)
            await self.page.click('button[type="submit"]')
            
            # 3. Aguardar área reservada
            await self.page.wait_for_url('**/area-reservada**', timeout=30000)
            logger.info("Login Via Verde bem-sucedido")
            
            # 4. Navegar para extratos/movimentos
            await self.page.goto('https://www.viaverde.pt/particulares/area-reservada/movimentos', timeout=30000)
            await self.page.wait_for_load_state('networkidle')
            
            # 5. Download
            download_path = tempfile.mkdtemp()
            
            async with self.page.expect_download() as download_info:
                await self.page.locator('text=/exportar|excel|csv/i').first.click()
            
            download = await download_info.value
            file_path = os.path.join(download_path, download.suggested_filename)
            await download.save_as(file_path)
            
            logger.info(f"Ficheiro Via Verde baixado: {file_path}")
            return True, file_path, 'Sucesso'
            
        except Exception as e:
            logger.error(f"Erro ao sincronizar Via Verde: {e}")
            return False, '', str(e)


# Factory para criar syncer apropriado
def get_syncer(plataforma: str, email: str, password: str, headless: bool = True):
    """Retorna o syncer apropriado para a plataforma"""
    syncers = {
        'uber': UberSyncer,
        'bolt': BoltSyncer,
        'via_verde': ViaVerdeSyncer,
        # 'combustivel': CombustivelSyncer,  # A implementar
        # 'gps': GPSSyncer,  # A implementar
    }
    
    syncer_class = syncers.get(plataforma)
    if not syncer_class:
        raise ValueError(f"Plataforma não suportada: {plataforma}")
    
    return syncer_class(email, password, headless)


async def sync_platform(plataforma: str, email: str, encrypted_password: str, headless: bool = True):
    """
    Sincroniza uma plataforma específica
    Retorna: (sucesso, caminho_ficheiro, mensagem)
    """
    try:
        password = decrypt_password(encrypted_password)
        
        async with get_syncer(plataforma, email, password, headless) as syncer:
            return await syncer.download_csv()
            
    except Exception as e:
        logger.error(f"Erro ao sincronizar {plataforma}: {e}")
        return False, '', str(e)
