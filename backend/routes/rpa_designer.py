"""
API Routes para RPA Designer - Sistema de Upload de Scripts Playwright
Permite ao Admin fazer upload de scripts gravados localmente (via Playwright Codegen)
e disponibilizá-los para os parceiros executarem.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid
import logging
import os
import re

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rpa-designer", tags=["rpa-designer"])

db = get_database()

# Diretório para scripts
SCRIPTS_DIR = "/app/backend/rpa_scripts"
os.makedirs(SCRIPTS_DIR, exist_ok=True)


# ==================== MODELOS ====================

class CampoCredencial(BaseModel):
    """Define um campo de credencial que o parceiro precisa preencher"""
    nome: str  # email, password, username, api_key, etc.
    tipo: str = "text"  # text, password, email
    label: str  # Label para mostrar no formulário
    obrigatorio: bool = True
    placeholder: Optional[str] = None


class ScriptRPACreate(BaseModel):
    """Dados para criar um novo script RPA"""
    nome: str  # Nome da plataforma/automação
    descricao: str
    icone: str = "🤖"  # Emoji ou nome do ícone
    cor: str = "#6B7280"  # Cor hex para o card
    url_base: str  # URL base da plataforma (ex: https://viaverde.pt)
    campos_credenciais: List[CampoCredencial]  # Campos que o parceiro precisa preencher
    codigo_script: str  # Código Python do Playwright
    tipos_extracao: List[str] = ["todos"]  # Tipos de extração disponíveis
    notas_admin: Optional[str] = None  # Notas internas (só admin vê)


class ScriptRPAUpdate(BaseModel):
    """Dados para atualizar um script RPA"""
    nome: Optional[str] = None
    descricao: Optional[str] = None
    icone: Optional[str] = None
    cor: Optional[str] = None
    url_base: Optional[str] = None
    campos_credenciais: Optional[List[CampoCredencial]] = None
    codigo_script: Optional[str] = None
    tipos_extracao: Optional[List[str]] = None
    notas_admin: Optional[str] = None
    ativo: Optional[bool] = None


# ==================== ENDPOINTS ADMIN ====================

@router.post("/scripts")
async def criar_script(
    dados: ScriptRPACreate,
    current_user: Dict = Depends(get_current_user)
):
    """Criar novo script RPA (apenas admin)"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem criar scripts")
    
    # Validar código do script
    if not dados.codigo_script or len(dados.codigo_script) < 50:
        raise HTTPException(status_code=400, detail="Código do script muito curto ou inválido")
    
    # Gerar ID único
    script_id = str(uuid.uuid4())[:8]
    
    # Criar slug para o script (usado como identificador)
    slug = re.sub(r'[^a-z0-9]', '_', dados.nome.lower())
    slug = re.sub(r'_+', '_', slug).strip('_')
    
    # Verificar se slug já existe
    existente = await db.rpa_scripts.find_one({"slug": slug, "ativo": True})
    if existente:
        slug = f"{slug}_{script_id}"
    
    now = datetime.now(timezone.utc)
    
    script = {
        "id": script_id,
        "slug": slug,
        "nome": dados.nome,
        "descricao": dados.descricao,
        "icone": dados.icone,
        "cor": dados.cor,
        "url_base": dados.url_base,
        "campos_credenciais": [campo.dict() for campo in dados.campos_credenciais],
        "codigo_script": dados.codigo_script,
        "tipos_extracao": dados.tipos_extracao,
        "notas_admin": dados.notas_admin,
        "ativo": True,
        "versao": 1,
        "execucoes_total": 0,
        "execucoes_sucesso": 0,
        "created_at": now.isoformat(),
        "created_by": current_user["id"],
        "updated_at": now.isoformat(),
        "updated_by": current_user["id"]
    }
    
    # Guardar script na base de dados
    await db.rpa_scripts.insert_one(script)
    
    # Guardar ficheiro do script
    script_path = os.path.join(SCRIPTS_DIR, f"{slug}.py")
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(dados.codigo_script)
    
    logger.info(f"✅ Script RPA criado: {dados.nome} (slug: {slug})")
    
    return {
        "message": "Script criado com sucesso",
        "id": script_id,
        "slug": slug
    }


@router.get("/scripts")
async def listar_scripts(
    incluir_inativos: bool = False,
    current_user: Dict = Depends(get_current_user)
):
    """Listar todos os scripts RPA"""
    
    query = {}
    
    # Parceiros só vêem scripts ativos
    if current_user["role"] != "admin":
        query["ativo"] = True
    elif not incluir_inativos:
        query["ativo"] = True
    
    scripts = await db.rpa_scripts.find(
        query,
        {"_id": 0, "codigo_script": 0}  # Não incluir código na listagem
    ).sort("nome", 1).to_list(100)
    
    # Para parceiros, não mostrar notas de admin
    if current_user["role"] != "admin":
        for script in scripts:
            script.pop("notas_admin", None)
    
    return scripts


@router.get("/scripts/{script_id}")
async def get_script(
    script_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter detalhes de um script"""
    
    script = await db.rpa_scripts.find_one(
        {"$or": [{"id": script_id}, {"slug": script_id}]},
        {"_id": 0}
    )
    
    if not script:
        raise HTTPException(status_code=404, detail="Script não encontrado")
    
    # Parceiros não vêem o código nem notas de admin
    if current_user["role"] != "admin":
        if not script.get("ativo"):
            raise HTTPException(status_code=404, detail="Script não encontrado")
        script.pop("codigo_script", None)
        script.pop("notas_admin", None)
    
    return script


@router.put("/scripts/{script_id}")
async def atualizar_script(
    script_id: str,
    dados: ScriptRPAUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar script RPA (apenas admin)"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar scripts")
    
    script = await db.rpa_scripts.find_one({"$or": [{"id": script_id}, {"slug": script_id}]})
    if not script:
        raise HTTPException(status_code=404, detail="Script não encontrado")
    
    updates = {"updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user["id"]}
    
    if dados.nome is not None:
        updates["nome"] = dados.nome
    if dados.descricao is not None:
        updates["descricao"] = dados.descricao
    if dados.icone is not None:
        updates["icone"] = dados.icone
    if dados.cor is not None:
        updates["cor"] = dados.cor
    if dados.url_base is not None:
        updates["url_base"] = dados.url_base
    if dados.campos_credenciais is not None:
        updates["campos_credenciais"] = [campo.dict() for campo in dados.campos_credenciais]
    if dados.tipos_extracao is not None:
        updates["tipos_extracao"] = dados.tipos_extracao
    if dados.notas_admin is not None:
        updates["notas_admin"] = dados.notas_admin
    if dados.ativo is not None:
        updates["ativo"] = dados.ativo
    
    if dados.codigo_script is not None:
        updates["codigo_script"] = dados.codigo_script
        updates["versao"] = script.get("versao", 1) + 1
        
        # Atualizar ficheiro
        script_path = os.path.join(SCRIPTS_DIR, f"{script['slug']}.py")
        with open(script_path, 'w', encoding='utf-8') as f:
            f.write(dados.codigo_script)
    
    await db.rpa_scripts.update_one(
        {"id": script["id"]},
        {"$set": updates}
    )
    
    logger.info(f"✅ Script RPA atualizado: {script['nome']} (id: {script['id']})")
    
    return {"message": "Script atualizado com sucesso"}


@router.delete("/scripts/{script_id}")
async def eliminar_script(
    script_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar script RPA (soft delete, apenas admin)"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem eliminar scripts")
    
    script = await db.rpa_scripts.find_one({"$or": [{"id": script_id}, {"slug": script_id}]})
    if not script:
        raise HTTPException(status_code=404, detail="Script não encontrado")
    
    # Soft delete
    await db.rpa_scripts.update_one(
        {"id": script["id"]},
        {"$set": {
            "ativo": False,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": current_user["id"]
        }}
    )
    
    logger.info(f"🗑️ Script RPA eliminado: {script['nome']} (id: {script['id']})")
    
    return {"message": "Script eliminado"}


@router.post("/scripts/{script_id}/duplicar")
async def duplicar_script(
    script_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Duplicar um script existente (apenas admin)"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem duplicar scripts")
    
    script = await db.rpa_scripts.find_one({"$or": [{"id": script_id}, {"slug": script_id}]}, {"_id": 0})
    if not script:
        raise HTTPException(status_code=404, detail="Script não encontrado")
    
    # Criar novo script
    novo_id = str(uuid.uuid4())[:8]
    novo_slug = f"{script['slug']}_copia_{novo_id}"
    now = datetime.now(timezone.utc)
    
    novo_script = {
        **script,
        "id": novo_id,
        "slug": novo_slug,
        "nome": f"{script['nome']} (Cópia)",
        "versao": 1,
        "execucoes_total": 0,
        "execucoes_sucesso": 0,
        "created_at": now.isoformat(),
        "created_by": current_user["id"],
        "updated_at": now.isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.rpa_scripts.insert_one(novo_script)
    
    # Copiar ficheiro
    script_path = os.path.join(SCRIPTS_DIR, f"{novo_slug}.py")
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(script.get("codigo_script", ""))
    
    logger.info(f"📋 Script RPA duplicado: {novo_script['nome']} (slug: {novo_slug})")
    
    return {
        "message": "Script duplicado com sucesso",
        "id": novo_id,
        "slug": novo_slug
    }


# ==================== ENDPOINTS EXECUÇÃO (PARCEIROS) ====================

@router.get("/plataformas-disponiveis")
async def listar_plataformas_disponiveis(
    current_user: Dict = Depends(get_current_user)
):
    """Listar plataformas disponíveis para o parceiro (scripts ativos)"""
    
    scripts = await db.rpa_scripts.find(
        {"ativo": True},
        {
            "_id": 0,
            "codigo_script": 0,
            "notas_admin": 0
        }
    ).sort("nome", 1).to_list(100)
    
    # Transformar para formato de plataforma
    plataformas = []
    for script in scripts:
        plataformas.append({
            "id": script["slug"],
            "nome": script["nome"],
            "icone": script.get("icone", "🤖"),
            "cor": script.get("cor", "#6B7280"),
            "descricao": script.get("descricao", ""),
            "tipos_extracao": script.get("tipos_extracao", ["todos"]),
            "campos_credenciais": script.get("campos_credenciais", [
                {"nome": "email", "tipo": "email", "label": "Email", "obrigatorio": True},
                {"nome": "password", "tipo": "password", "label": "Password", "obrigatorio": True}
            ]),
            "url_login": script.get("url_base", ""),
            "requer_2fa": False,
            "is_custom": True  # Indica que é um script customizado
        })
    
    return plataformas


@router.get("/estatisticas")
async def get_estatisticas_admin(
    current_user: Dict = Depends(get_current_user)
):
    """Obter estatísticas dos scripts (apenas admin)"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    # Total de scripts
    total_scripts = await db.rpa_scripts.count_documents({"ativo": True})
    scripts_inativos = await db.rpa_scripts.count_documents({"ativo": False})
    
    # Estatísticas de execução
    pipeline = [
        {"$match": {"ativo": True}},
        {"$group": {
            "_id": None,
            "total_execucoes": {"$sum": "$execucoes_total"},
            "total_sucesso": {"$sum": "$execucoes_sucesso"}
        }}
    ]
    
    stats = await db.rpa_scripts.aggregate(pipeline).to_list(1)
    
    execucoes_stats = stats[0] if stats else {"total_execucoes": 0, "total_sucesso": 0}
    
    # Scripts mais usados
    top_scripts = await db.rpa_scripts.find(
        {"ativo": True},
        {"_id": 0, "nome": 1, "slug": 1, "execucoes_total": 1, "execucoes_sucesso": 1}
    ).sort("execucoes_total", -1).limit(5).to_list(5)
    
    return {
        "total_scripts": total_scripts,
        "scripts_inativos": scripts_inativos,
        "total_execucoes": execucoes_stats.get("total_execucoes", 0),
        "total_sucesso": execucoes_stats.get("total_sucesso", 0),
        "taxa_sucesso": (
            (execucoes_stats.get("total_sucesso", 0) / execucoes_stats.get("total_execucoes", 1) * 100)
            if execucoes_stats.get("total_execucoes", 0) > 0 else 0
        ),
        "top_scripts": top_scripts
    }


# ==================== TEMPLATE DE SCRIPT ====================

@router.get("/template-script")
@router.get("/template")  # Alias para compatibilidade
async def get_template_script(
    current_user: Dict = Depends(get_current_user)
):
    """Obter template de script Playwright para o admin"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    template = '''"""
Script RPA gerado pelo Playwright Codegen
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
            - dados: list de registos extraídos
            - erro: mensagem de erro se houver
    """
    
    email = credenciais.get("email")
    password = credenciais.get("password")
    
    try:
        # === INÍCIO DO CÓDIGO GRAVADO ===
        # Cole aqui o código do Playwright Codegen
        
        await page.goto("https://example.com/login")
        
        # Exemplo: Preencher login
        await page.fill("input[name='email']", email)
        await page.fill("input[name='password']", password)
        await page.click("button[type='submit']")
        
        # Aguardar navegação
        await page.wait_for_load_state("networkidle")
        
        # Exemplo: Extrair dados de uma tabela
        dados = []
        rows = await page.query_selector_all("table tbody tr")
        
        for row in rows:
            cells = await row.query_selector_all("td")
            if len(cells) >= 3:
                dados.append({
                    "data": await cells[0].inner_text(),
                    "descricao": await cells[1].inner_text(),
                    "valor": await cells[2].inner_text()
                })
        
        # === FIM DO CÓDIGO GRAVADO ===
        
        return {
            "sucesso": True,
            "dados": dados,
            "total": len(dados)
        }
        
    except Exception as e:
        return {
            "sucesso": False,
            "dados": [],
            "erro": str(e)
        }
'''
    
    return {
        "template": template,
        "instrucoes": [
            "1. No seu computador, instale o Playwright: npm init playwright@latest",
            "2. Execute o gravador: npx playwright codegen [URL_DA_PLATAFORMA]",
            "3. Navegue no browser e faça as ações que quer automatizar",
            "4. Copie o código Python gerado",
            "5. Cole na função executar() do template",
            "6. Substitua os valores fixos por variáveis (email, password)",
            "7. Faça upload do script completo"
        ]
    }
