"""
Script para capturar screenshots das principais páginas do TVDEFleet
"""
import asyncio
from playwright.async_api import async_playwright
import os

BASE_URL = "https://frota-sync-rpa.preview.emergentagent.com"
OUTPUT_DIR = "/app/video_frames"

# Páginas a capturar com descrição
PAGES = [
    {"url": "/login", "name": "01_login", "wait": 2000, "logged_in": False},
    {"url": "/dashboard", "name": "02_dashboard", "wait": 3000, "logged_in": True},
    {"url": "/veiculos", "name": "03_veiculos", "wait": 2000, "logged_in": True},
    {"url": "/motoristas", "name": "04_motoristas", "wait": 2000, "logged_in": True},
    {"url": "/admin/gestao-planos", "name": "05_planos", "wait": 2000, "logged_in": True},
    {"url": "/admin/usuarios", "name": "06_usuarios", "wait": 2000, "logged_in": True},
    {"url": "/relatorios", "name": "07_relatorios", "wait": 2000, "logged_in": True},
    {"url": "/mensagens", "name": "08_mensagens", "wait": 2000, "logged_in": True},
    {"url": "/faturacao", "name": "09_faturacao", "wait": 2000, "logged_in": True},
    {"url": "/contabilidade", "name": "10_contabilidade", "wait": 2000, "logged_in": True},
]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1
        )
        page = await context.new_page()
        
        # Login primeiro
        print("Fazendo login...")
        await page.goto(f"{BASE_URL}/login")
        await page.wait_for_timeout(2000)
        await page.fill('input[type="email"]', 'admin@tvdefleet.com')
        await page.fill('input[type="password"]', 'Admin123!')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(3000)
        print("Login realizado!")
        
        # Capturar cada página
        for page_info in PAGES:
            try:
                url = f"{BASE_URL}{page_info['url']}"
                print(f"Capturando: {page_info['name']} - {url}")
                
                await page.goto(url)
                await page.wait_for_timeout(page_info['wait'])
                
                # Screenshot
                output_path = f"{OUTPUT_DIR}/{page_info['name']}.png"
                await page.screenshot(path=output_path, full_page=False)
                print(f"  ✓ Guardado: {output_path}")
                
            except Exception as e:
                print(f"  ✗ Erro em {page_info['name']}: {e}")
        
        await browser.close()
        print("\nCaptura concluída!")

if __name__ == "__main__":
    asyncio.run(main())
