sdddssasript RPA gerado pelo Playwright Codegen
Plataforma: [NOME_PLATAFORMA]
Data: [DATA]

INSTRUÇÕES:
1. Execute `npx playwright codegen [URL]` no seu computador
2. Grave as ações necessárias no browser
3. Copie o código Python gerado
4. Cole neste template, substituindo a função `executar()`
5. Certifique-se que as credenciais são passadas como parâmetros

VARIÁVEIS DISPONÍVEIS:
- email: Email/username do parceiro
- password: Password do parceiro
- data_inicio: Data de início (opcional)
- data_fim: Data de fim (opcional)
"""

async def executar(page, credenciais: dict, data_inicio: str = None, data_fim: str = None):
    """
    Função principal de execução.
    
    Args:
        page: Objeto Page do Playwright
        credenciais: Dict com os campos definidos (ex: {"email": "...", "password": "..."})
        data_inicio: Data de início para filtros (opcional)
        data_fim: Data de fim para filtros (opcional)
    
    Returns:
        dict com:
            - sucesso: bool