"""
Script para capturar screenshots das principais páginas do TVDEFleet - versão melhorada
"""
import asyncio
from playwright.async_api import async_playwright
import os

BASE_URL = "https://storage-dashboard-2.preview.emergentagent.com"
OUTPUT_DIR = "/app/video_frames"

# Páginas a capturar
PAGES = [
    {"url": "/login", "name": "01_login", "wait": 3000},
    {"url": "/dashboard", "name": "02_dashboard", "wait": 4000},
    {"url": "/veiculos", "name": "03_veiculos", "wait": 3000},
    {"url": "/motoristas", "name": "04_motoristas", "wait": 3000},
    {"url": "/admin/gestao-planos", "name": "05_planos", "wait": 3000},
    {"url": "/parceiros", "name": "06_parceiros", "wait": 3000},
    {"url": "/relatorios", "name": "07_relatorios", "wait": 3000},
    {"url": "/mensagens", "name": "08_mensagens", "wait": 3000},
    {"url": "/contabilidade", "name": "09_contabilidade", "wait": 3000},
]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1
        )
        page = await context.new_page()
        
        # Screenshot do login antes de fazer login
        print("Capturando página de login...")
        await page.goto(f"{BASE_URL}/login")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{OUTPUT_DIR}/01_login.png", full_page=False)
        print("  ✓ Login capturado")
        
        # Fazer login
        print("Fazendo login...")
        await page.fill('input[type="email"]', 'admin@tvdefleet.com')
        await page.fill('input[type="password"]', 'Admin123!')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(4000)
        print("Login realizado!")
        
        # Capturar cada página após login
        for page_info in PAGES[1:]:  # Skip login
            try:
                url = f"{BASE_URL}{page_info['url']}"
                print(f"Capturando: {page_info['name']} - {url}")
                
                await page.goto(url)
                await page.wait_for_timeout(page_info['wait'])
                
                # Aguardar loading desaparecer
                try:
                    await page.wait_for_selector('[data-testid="loading"]', state='hidden', timeout=5000)
                except:
                    pass
                
                await page.wait_for_timeout(1000)
                
                # Screenshot
                output_path = f"{OUTPUT_DIR}/{page_info['name']}.png"
                await page.screenshot(path=output_path, full_page=False)
                
                # Verificar tamanho
                size = os.path.getsize(output_path)
                if size < 50000:  # Se menor que 50KB, tentar novamente
                    print(f"  ⚠ Ficheiro pequeno ({size} bytes), a tentar novamente...")
                    await page.reload()
                    await page.wait_for_timeout(page_info['wait'] + 2000)
                    await page.screenshot(path=output_path, full_page=False)
                
                print(f"  ✓ Guardado: {output_path}")
                
            except Exception as e:
                print(f"  ✗ Erro em {page_info['name']}: {e}")
        
        await browser.close()
        print("\nCaptura concluída!")

if __name__ == "__main__":
    asyncio.run(main())
