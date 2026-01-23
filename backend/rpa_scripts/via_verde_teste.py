async def executar(page, credenciais, data_inicio=None, data_fim=None):
    email = credenciais.get("email")
    password = credenciais.get("password")
    
    await page.goto("https://www.viaverde.pt/empresas")
    # ... código de automação ...
    
    return {"sucesso": True, "dados": [], "total": 0}