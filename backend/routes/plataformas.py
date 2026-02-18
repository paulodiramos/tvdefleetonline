"""
Rotas para Gestão de Plataformas e Sincronização
- Admin: criar/editar plataformas, configurar RPA e importação
- Parceiro: configurar credenciais e executar sincronizações
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import logging
import uuid

from models.plataformas import (
    CategoriaPlataforma, MetodoIntegracao, TipoLogin,
    CriarPlataformaRequest, AtualizarPlataformaRequest,
    ConfigurarRPARequest, ConfigurarImportacaoRequest,
    CredenciaisParceiroRequest,
    CAMPOS_DESTINO, PLATAFORMAS_DEFAULT
)
from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/plataformas", tags=["Plataformas"])
db = get_database()


# ==================== CATEGORIAS E METADADOS ====================

@router.get("/categorias")
async def listar_categorias(current_user: dict = Depends(get_current_user)):
    """Listar categorias de plataformas disponíveis"""
    return [
        {"id": "plataforma", "nome": "Plataformas TVDE", "icone": "🚗", "descricao": "Uber, Bolt, etc."},
        {"id": "gps", "nome": "GPS / Tracking", "icone": "📍", "descricao": "Verizon, Cartrack, Radius"},
        {"id": "portagens", "nome": "Portagens", "icone": "🛣️", "descricao": "Via Verde"},
        {"id": "abastecimento", "nome": "Abastecimento", "icone": "⛽", "descricao": "Prio, Galp, Radius"},
    ]


@router.get("/metodos-integracao")
async def listar_metodos_integracao(current_user: dict = Depends(get_current_user)):
    """Listar métodos de integração disponíveis"""
    return [
        {"id": "rpa", "nome": "RPA (Automação)", "descricao": "Automação com browser"},
        {"id": "api", "nome": "API", "descricao": "Integração via API"},
        {"id": "upload_manual", "nome": "Upload Manual", "descricao": "Upload de ficheiro Excel/CSV"},
    ]


@router.get("/tipos-login")
async def listar_tipos_login(current_user: dict = Depends(get_current_user)):
    """Listar tipos de login disponíveis"""
    return [
        {"id": "manual", "nome": "Login Manual", "descricao": "Parceiro faz login manualmente"},
        {"id": "automatico", "nome": "Login Automático", "descricao": "Sistema faz login com credenciais"},
    ]


@router.get("/campos-destino/{categoria}")
async def obter_campos_destino(
    categoria: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter campos de destino disponíveis para uma categoria"""
    if categoria not in CAMPOS_DESTINO:
        raise HTTPException(status_code=400, detail=f"Categoria '{categoria}' não existe")
    return CAMPOS_DESTINO[categoria]


@router.get("/campos-destino")
async def obter_todos_campos_destino(current_user: dict = Depends(get_current_user)):
    """Obter todos os campos de destino por categoria"""
    return CAMPOS_DESTINO


@router.get("/{plataforma_id}/parceiros-com-credenciais")
async def listar_parceiros_com_credenciais(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Listar parceiros que têm credenciais configuradas para esta plataforma.
    Admin only - retorna apenas nome e email de login (sem passwords).
    Procura em duas fontes: campo credenciais_plataformas do parceiro e colecção credenciais_plataforma.
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode ver esta informação")
    
    # Verificar se plataforma existe e obter nome
    plataforma = await db.plataformas.find_one(
        {"id": plataforma_id},
        {"_id": 0, "nome": 1, "campos_credenciais": 1}
    )
    
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    plataforma_nome = plataforma.get("nome", "").lower().replace(" ", "_")
    parceiros_dict = {}  # usar dict para evitar duplicados
    
    # Fonte 1: Campo credenciais_plataformas dentro do documento parceiro
    parceiros_cursor = db.parceiros.find(
        {f"credenciais_plataformas.{plataforma_id}": {"$exists": True}},
        {"_id": 0, "id": 1, "nome": 1, f"credenciais_plataformas.{plataforma_id}": 1}
    )
    
    async for parceiro in parceiros_cursor:
        creds = parceiro.get("credenciais_plataformas", {}).get(plataforma_id, {})
        parceiros_dict[parceiro.get("id")] = {
            "id": parceiro.get("id"),
            "nome": parceiro.get("nome", "Sem nome"),
            "email_login": creds.get("email") or creds.get("username") or creds.get("utilizador"),
            "tem_password": bool(creds.get("password") or creds.get("senha"))
        }
    
    # Fonte 2: Colecção credenciais_plataforma (por nome da plataforma)
    # Tentar várias variações do nome
    nomes_plataforma = [
        plataforma_nome,
        plataforma.get("nome", ""),
        plataforma.get("nome", "").lower(),
        plataforma_nome.replace("_", ""),
        plataforma_id
    ]
    
    for nome in nomes_plataforma:
        if not nome:
            continue
        creds_cursor = db.credenciais_plataforma.find(
            {"plataforma": {"$regex": f"^{nome}$", "$options": "i"}, "ativo": {"$ne": False}},
            {"_id": 0, "parceiro_id": 1, "email": 1, "password_encrypted": 1}
        )
        async for cred in creds_cursor:
            parceiro_id = cred.get("parceiro_id")
            if parceiro_id and parceiro_id not in parceiros_dict:
                # Buscar nome do parceiro
                parceiro = await db.parceiros.find_one(
                    {"id": parceiro_id},
                    {"_id": 0, "nome": 1}
                )
                parceiros_dict[parceiro_id] = {
                    "id": parceiro_id,
                    "nome": parceiro.get("nome", "Sem nome") if parceiro else "Sem nome",
                    "email_login": cred.get("email"),
                    "tem_password": bool(cred.get("password_encrypted"))
                }
    
    return list(parceiros_dict.values())


# ==================== CRUD PLATAFORMAS (ADMIN) ====================

@router.get("/exportar-todos")
async def exportar_todas_plataformas(
    current_user: dict = Depends(get_current_user)
):
    """Exportar todas as plataformas e RPAs (Admin only) - Para backup completo"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode exportar")
    
    # Buscar todas as plataformas
    plataformas = await db.plataformas.find({}, {"_id": 0}).to_list(100)
    
    # Buscar todos os RPAs
    rascunhos = await db.rpa_rascunhos.find({}, {"_id": 0}).to_list(500)
    designs = await db.rpa_designs.find({}, {"_id": 0}).to_list(500)
    
    export_data = {
        "versao": "1.0",
        "tipo": "backup_completo",
        "exportado_em": datetime.now(timezone.utc).isoformat(),
        "exportado_por": current_user["id"],
        "plataformas": plataformas,
        "rpa": {
            "rascunhos": rascunhos,
            "designs": designs
        },
        "metadados": {
            "total_plataformas": len(plataformas),
            "total_rascunhos": len(rascunhos),
            "total_designs": len(designs)
        }
    }
    
    return export_data


@router.get("")
async def listar_plataformas(
    categoria: Optional[str] = None,
    ativo: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar todas as plataformas"""
    filtro = {}
    
    if categoria:
        filtro["categoria"] = categoria
    
    # Parceiros só vêem plataformas ativas
    if current_user["role"] != "admin":
        filtro["ativo"] = True
    elif ativo is not None:
        filtro["ativo"] = ativo
    
    plataformas = await db.plataformas.find(
        filtro,
        {"_id": 0}
    ).sort([("categoria", 1), ("nome", 1)]).to_list(length=100)
    
    # Adicionar estatísticas para admin
    if current_user["role"] == "admin":
        for p in plataformas:
            # Contar parceiros que usam esta plataforma
            count = await db.credenciais_parceiros.count_documents({
                "plataforma_id": p["id"],
                "ativo": True
            })
            p["parceiros_ativos"] = count
    
    return plataformas


@router.get("/{plataforma_id}")
async def obter_plataforma(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de uma plataforma"""
    plataforma = await db.plataformas.find_one(
        {"id": plataforma_id},
        {"_id": 0}
    )
    
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    return plataforma


@router.post("")
async def criar_plataforma(
    data: CriarPlataformaRequest,
    current_user: dict = Depends(get_current_user)
):
    """Criar nova plataforma (Admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode criar plataformas")
    
    # Verificar se já existe
    existente = await db.plataformas.find_one({"nome": data.nome})
    if existente:
        raise HTTPException(status_code=400, detail=f"Plataforma '{data.nome}' já existe")
    
    now = datetime.now(timezone.utc).isoformat()
    
    plataforma = {
        "id": str(uuid.uuid4()),
        "nome": data.nome,
        "icone": data.icone,
        "descricao": data.descricao,
        "categoria": data.categoria.value if hasattr(data.categoria, 'value') else data.categoria,
        "subcategoria_abastecimento": data.subcategoria_abastecimento.value if data.subcategoria_abastecimento and hasattr(data.subcategoria_abastecimento, 'value') else data.subcategoria_abastecimento,
        "url_base": data.url_base,
        "url_login": data.url_login,
        "metodo_integracao": data.metodo_integracao.value if hasattr(data.metodo_integracao, 'value') else data.metodo_integracao,
        "tipo_login": data.tipo_login.value if hasattr(data.tipo_login, 'value') else data.tipo_login,
        "requer_2fa": data.requer_2fa,
        "tipo_2fa": data.tipo_2fa,
        "campos_credenciais": data.campos_credenciais,
        "passos_login": [],
        "passos_extracao": [],
        "config_importacao": None,
        "ativo": True,
        "testado": False,
        "criado_por": current_user["id"],
        "criado_em": now,
        "atualizado_em": now,
        "total_sincronizacoes": 0,
        "ultima_sincronizacao": None
    }
    
    await db.plataformas.insert_one(plataforma)
    
    logger.info(f"Plataforma criada: {data.nome} por {current_user['id']}")
    
    return {
        "sucesso": True,
        "plataforma_id": plataforma["id"],
        "mensagem": f"Plataforma '{data.nome}' criada com sucesso"
    }


@router.put("/{plataforma_id}")
async def atualizar_plataforma(
    plataforma_id: str,
    data: AtualizarPlataformaRequest,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar plataforma (Admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode editar plataformas")
    
    update_data = {}
    for k, v in data.dict().items():
        if v is not None:
            # Converter enums para string
            if hasattr(v, 'value'):
                update_data[k] = v.value
            else:
                update_data[k] = v
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.plataformas.update_one(
        {"id": plataforma_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    return {"sucesso": True, "mensagem": "Plataforma atualizada"}


@router.delete("/{plataforma_id}")
async def eliminar_plataforma(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar/desativar plataforma (Admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode eliminar plataformas")
    
    # Verificar se há parceiros usando
    count = await db.credenciais_parceiros.count_documents({
        "plataforma_id": plataforma_id,
        "ativo": True
    })
    
    if count > 0:
        # Apenas desativar, não eliminar
        await db.plataformas.update_one(
            {"id": plataforma_id},
            {"$set": {"ativo": False, "atualizado_em": datetime.now(timezone.utc).isoformat()}}
        )
        return {"sucesso": True, "mensagem": f"Plataforma desativada ({count} parceiros a usar)"}
    
    # Eliminar se não há parceiros
    result = await db.plataformas.delete_one({"id": plataforma_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    return {"sucesso": True, "mensagem": "Plataforma eliminada"}


# ==================== CONFIGURAÇÃO RPA (ADMIN) ====================

@router.put("/{plataforma_id}/rpa")
async def configurar_rpa(
    plataforma_id: str,
    data: ConfigurarRPARequest,
    current_user: dict = Depends(get_current_user)
):
    """Configurar passos RPA de uma plataforma (Admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode configurar RPA")
    
    update_data = {"atualizado_em": datetime.now(timezone.utc).isoformat()}
    
    if data.passos_login is not None:
        update_data["passos_login"] = data.passos_login
    
    if data.passos_extracao is not None:
        update_data["passos_extracao"] = data.passos_extracao
    
    result = await db.plataformas.update_one(
        {"id": plataforma_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    return {"sucesso": True, "mensagem": "Configuração RPA atualizada"}


@router.get("/{plataforma_id}/rpa")
async def obter_configuracao_rpa(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter configuração RPA de uma plataforma"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode ver configuração RPA")
    
    plataforma = await db.plataformas.find_one(
        {"id": plataforma_id},
        {"_id": 0, "passos_login": 1, "passos_extracao": 1, "metodo_integracao": 1}
    )
    
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    return plataforma


# ==================== CONFIGURAÇÃO IMPORTAÇÃO (ADMIN) ====================

@router.put("/{plataforma_id}/importacao")
async def configurar_importacao(
    plataforma_id: str,
    data: ConfigurarImportacaoRequest,
    current_user: dict = Depends(get_current_user)
):
    """Configurar importação de ficheiros de uma plataforma (Admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode configurar importação")
    
    config = {
        "tipo_ficheiro": data.tipo_ficheiro,
        "linha_cabecalho": data.linha_cabecalho,
        "linha_inicio_dados": data.linha_inicio_dados,
        "encoding": data.encoding,
        "separador_csv": data.separador_csv,
        "mapeamento_campos": data.mapeamento_campos
    }
    
    result = await db.plataformas.update_one(
        {"id": plataforma_id},
        {"$set": {
            "config_importacao": config,
            "atualizado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    return {"sucesso": True, "mensagem": "Configuração de importação atualizada"}


@router.get("/{plataforma_id}/importacao")
async def obter_configuracao_importacao(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter configuração de importação de uma plataforma"""
    plataforma = await db.plataformas.find_one(
        {"id": plataforma_id},
        {"_id": 0, "config_importacao": 1, "categoria": 1}
    )
    
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    # Incluir campos de destino disponíveis
    categoria = plataforma.get("categoria", "abastecimento")
    campos_disponiveis = CAMPOS_DESTINO.get(categoria, [])
    
    return {
        "config": plataforma.get("config_importacao"),
        "campos_disponiveis": campos_disponiveis
    }


# ==================== EXPORTAR / IMPORTAR RPA ====================

@router.get("/{plataforma_id}/exportar-rpa")
async def exportar_rpa_plataforma(
    plataforma_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Exportar configuração RPA de uma plataforma (Admin only)
    
    Exporta:
    - Configuração da plataforma
    - Passos RPA configurados
    - Rascunhos RPA
    - Mapeamento de dados
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode exportar RPA")
    
    # Buscar plataforma
    plataforma = await db.plataformas.find_one({"id": plataforma_id}, {"_id": 0})
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    # Buscar rascunhos RPA
    rascunhos = await db.rpa_rascunhos.find({"plataforma_id": plataforma_id}, {"_id": 0}).to_list(100)
    
    # Buscar designs RPA
    designs = await db.rpa_designs.find({"plataforma_id": plataforma_id}, {"_id": 0}).to_list(100)
    
    # Buscar execuções (últimas 10 para referência)
    execucoes = await db.rpa_execucoes.find(
        {"plataforma_id": plataforma_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Criar pacote de exportação
    export_data = {
        "versao": "1.0",
        "exportado_em": datetime.now(timezone.utc).isoformat(),
        "exportado_por": current_user["id"],
        "plataforma": plataforma,
        "rpa": {
            "rascunhos": rascunhos,
            "designs": designs,
            "execucoes_exemplo": execucoes
        },
        "metadados": {
            "total_rascunhos": len(rascunhos),
            "total_designs": len(designs),
            "total_execucoes": len(execucoes)
        }
    }
    
    logger.info(f"RPA exportado para plataforma {plataforma.get('nome')} por {current_user['id']}")
    
    return export_data


class ImportarRPARequest(BaseModel):
    versao: str
    plataforma: Dict[str, Any]
    rpa: Dict[str, Any]
    substituir_existente: bool = False


@router.post("/{plataforma_id}/importar-rpa")
async def importar_rpa_plataforma(
    plataforma_id: str,
    data: ImportarRPARequest,
    current_user: dict = Depends(get_current_user)
):
    """Importar configuração RPA para uma plataforma (Admin only)
    
    Importa:
    - Configuração RPA da plataforma
    - Passos RPA
    - Mapeamento de dados
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode importar RPA")
    
    # Verificar se plataforma existe
    plataforma_existente = await db.plataformas.find_one({"id": plataforma_id}, {"_id": 0})
    if not plataforma_existente:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    resultados = {
        "plataforma_atualizada": False,
        "rascunhos_importados": 0,
        "designs_importados": 0
    }
    
    # Atualizar configuração RPA da plataforma
    plataforma_import = data.plataforma
    campos_atualizar = {}
    
    if "config_rpa" in plataforma_import:
        campos_atualizar["config_rpa"] = plataforma_import["config_rpa"]
    if "config_importacao" in plataforma_import:
        campos_atualizar["config_importacao"] = plataforma_import["config_importacao"]
    if "metodo" in plataforma_import:
        campos_atualizar["metodo"] = plataforma_import["metodo"]
    
    if campos_atualizar:
        campos_atualizar["atualizado_em"] = datetime.now(timezone.utc).isoformat()
        campos_atualizar["importado_de"] = data.plataforma.get("id")
        campos_atualizar["importado_em"] = datetime.now(timezone.utc).isoformat()
        
        await db.plataformas.update_one(
            {"id": plataforma_id},
            {"$set": campos_atualizar}
        )
        resultados["plataforma_atualizada"] = True
    
    # Importar rascunhos RPA
    if data.rpa.get("rascunhos"):
        if data.substituir_existente:
            await db.rpa_rascunhos.delete_many({"plataforma_id": plataforma_id})
        
        for rascunho in data.rpa["rascunhos"]:
            rascunho_novo = {
                **rascunho,
                "id": str(uuid.uuid4()),  # Novo ID
                "plataforma_id": plataforma_id,
                "importado_em": datetime.now(timezone.utc).isoformat(),
                "importado_por": current_user["id"]
            }
            await db.rpa_rascunhos.insert_one(rascunho_novo)
            resultados["rascunhos_importados"] += 1
    
    # Importar designs RPA
    if data.rpa.get("designs"):
        if data.substituir_existente:
            await db.rpa_designs.delete_many({"plataforma_id": plataforma_id})
        
        for design in data.rpa["designs"]:
            design_novo = {
                **design,
                "id": str(uuid.uuid4()),  # Novo ID
                "plataforma_id": plataforma_id,
                "importado_em": datetime.now(timezone.utc).isoformat(),
                "importado_por": current_user["id"]
            }
            await db.rpa_designs.insert_one(design_novo)
            resultados["designs_importados"] += 1
    
    logger.info(f"RPA importado para plataforma {plataforma_existente.get('nome')} por {current_user['id']}: {resultados}")
    
    return {
        "sucesso": True,
        "mensagem": "RPA importado com sucesso",
        "resultados": resultados
    }


@router.get("/exportar-todos")
async def exportar_todas_plataformas(
    current_user: dict = Depends(get_current_user)
):
    """Exportar todas as plataformas e RPAs (Admin only) - Para backup completo"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin pode exportar")
    
    # Buscar todas as plataformas
    plataformas = await db.plataformas.find({}, {"_id": 0}).to_list(100)
    
    # Buscar todos os RPAs
    rascunhos = await db.rpa_rascunhos.find({}, {"_id": 0}).to_list(500)
    designs = await db.rpa_designs.find({}, {"_id": 0}).to_list(500)
    
    export_data = {
        "versao": "1.0",
        "tipo": "backup_completo",
        "exportado_em": datetime.now(timezone.utc).isoformat(),
        "exportado_por": current_user["id"],
        "plataformas": plataformas,
        "rpa": {
            "rascunhos": rascunhos,
            "designs": designs
        },
        "metadados": {
            "total_plataformas": len(plataformas),
            "total_rascunhos": len(rascunhos),
            "total_designs": len(designs)
        }
    }
    
    return export_data


# ==================== SEED PLATAFORMAS DEFAULT ====================

@router.post("/seed")
async def seed_plataformas(current_user: dict = Depends(get_current_user)):
    """Criar plataformas pré-definidas (Admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas Admin")
    
    # Verificar se já existem
    existing = await db.plataformas.count_documents({})
    if existing > 0:
        return {"mensagem": f"Já existem {existing} plataformas", "criadas": 0}
    
    now = datetime.now(timezone.utc).isoformat()
    criadas = 0
    
    for p in PLATAFORMAS_DEFAULT:
        plataforma = {
            "id": str(uuid.uuid4()),
            **p,
            "passos_login": [],
            "passos_extracao": [],
            "config_importacao": None,
            "ativo": True,
            "testado": False,
            "criado_por": current_user["id"],
            "criado_em": now,
            "atualizado_em": now,
            "total_sincronizacoes": 0,
            "ultima_sincronizacao": None
        }
        await db.plataformas.insert_one(plataforma)
        criadas += 1
    
    logger.info(f"Seed: {criadas} plataformas criadas por {current_user['id']}")
    
    return {"mensagem": f"Criadas {criadas} plataformas", "criadas": criadas}


# ==================== CREDENCIAIS PARCEIRO ====================

@router.get("/parceiro/credenciais")
async def listar_credenciais_parceiro(
    current_user: dict = Depends(get_current_user)
):
    """Listar credenciais do parceiro atual"""
    parceiro_id = current_user.get("parceiro_id")
    if not parceiro_id and current_user["role"] != "admin":
        raise HTTPException(status_code=400, detail="Parceiro não identificado")
    
    # Admin pode ver todas, parceiro só as suas
    filtro = {}
    if current_user["role"] != "admin":
        filtro["parceiro_id"] = parceiro_id
    
    credenciais = await db.credenciais_parceiros.find(
        filtro,
        {"_id": 0, "password_encrypted": 0}  # Não retornar password
    ).to_list(length=100)
    
    # Adicionar info da plataforma
    for c in credenciais:
        plataforma = await db.plataformas.find_one(
            {"id": c["plataforma_id"]},
            {"_id": 0, "nome": 1, "icone": 1, "categoria": 1}
        )
        c["plataforma"] = plataforma
    
    return credenciais


@router.post("/parceiro/credenciais")
async def criar_credenciais_parceiro(
    data: CredenciaisParceiroRequest,
    current_user: dict = Depends(get_current_user)
):
    """Criar/atualizar credenciais de uma plataforma"""
    parceiro_id = current_user.get("parceiro_id")
    if not parceiro_id:
        raise HTTPException(status_code=400, detail="Parceiro não identificado")
    
    # Verificar se plataforma existe
    plataforma = await db.plataformas.find_one({"id": data.plataforma_id, "ativo": True})
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Verificar se já existe
    existente = await db.credenciais_parceiros.find_one({
        "parceiro_id": parceiro_id,
        "plataforma_id": data.plataforma_id
    })
    
    if existente:
        # Atualizar
        update_data = {
            "email": data.email,
            "dados_extra": data.dados_extra,
            "ativo": data.ativo,
            "sincronizacao_automatica": data.sincronizacao_automatica,
            "frequencia_dias": data.frequencia_dias,
            "atualizado_em": now
        }
        if data.password:
            # TODO: Encriptar password
            update_data["password_encrypted"] = data.password
        
        await db.credenciais_parceiros.update_one(
            {"id": existente["id"]},
            {"$set": update_data}
        )
        
        return {"sucesso": True, "mensagem": "Credenciais atualizadas"}
    
    # Criar novo
    credenciais = {
        "id": str(uuid.uuid4()),
        "parceiro_id": parceiro_id,
        "plataforma_id": data.plataforma_id,
        "email": data.email,
        "password_encrypted": data.password,  # TODO: Encriptar
        "dados_extra": data.dados_extra,
        "ativo": data.ativo,
        "sessao_ativa": False,
        "ultima_sessao": None,
        "sincronizacao_automatica": data.sincronizacao_automatica,
        "frequencia_dias": data.frequencia_dias,
        "proxima_sincronizacao": None,
        "criado_em": now,
        "atualizado_em": now
    }
    
    await db.credenciais_parceiros.insert_one(credenciais)
    
    return {"sucesso": True, "mensagem": "Credenciais criadas", "id": credenciais["id"]}


@router.delete("/parceiro/credenciais/{credencial_id}")
async def eliminar_credenciais_parceiro(
    credencial_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar credenciais de uma plataforma"""
    parceiro_id = current_user.get("parceiro_id")
    if not parceiro_id:
        raise HTTPException(status_code=400, detail="Parceiro não identificado")
    
    result = await db.credenciais_parceiros.delete_one({
        "id": credencial_id,
        "parceiro_id": parceiro_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Credenciais não encontradas")
    
    return {"sucesso": True, "mensagem": "Credenciais eliminadas"}


# ==================== PLATAFORMAS ATIVAS DO PARCEIRO ====================

@router.get("/parceiro/ativas")
async def listar_plataformas_ativas_parceiro(
    categoria: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar plataformas que o parceiro tem credenciais configuradas"""
    parceiro_id = current_user.get("parceiro_id")
    if not parceiro_id:
        raise HTTPException(status_code=400, detail="Parceiro não identificado")
    
    # Buscar credenciais do parceiro
    filtro_cred = {"parceiro_id": parceiro_id, "ativo": True}
    credenciais = await db.credenciais_parceiros.find(
        filtro_cred,
        {"_id": 0, "plataforma_id": 1}
    ).to_list(length=100)
    
    plataforma_ids = [c["plataforma_id"] for c in credenciais]
    
    if not plataforma_ids:
        return []
    
    # Buscar plataformas
    filtro_plat = {"id": {"$in": plataforma_ids}, "ativo": True}
    if categoria:
        filtro_plat["categoria"] = categoria
    
    plataformas = await db.plataformas.find(
        filtro_plat,
        {"_id": 0}
    ).sort("nome", 1).to_list(length=100)
    
    return plataformas



# ==================== EXECUÇÃO DE SINCRONIZAÇÃO ====================

class ExecutarSincronizacaoRequest(BaseModel):
    plataforma_id: str
    data_inicio: str  # ISO format
    data_fim: str  # ISO format


@router.post("/sincronizar")
async def executar_sincronizacao(
    data: ExecutarSincronizacaoRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Executar sincronização de uma plataforma"""
    from datetime import datetime
    from services.rpa_dinamico import executar_sincronizacao_dinamica
    
    parceiro_id = current_user.get("parceiro_id")
    if not parceiro_id:
        raise HTTPException(status_code=400, detail="Parceiro não identificado")
    
    # Verificar se plataforma existe e parceiro tem credenciais
    plataforma = await db.plataformas.find_one({"id": data.plataforma_id, "ativo": True})
    if not plataforma:
        raise HTTPException(status_code=404, detail="Plataforma não encontrada")
    
    cred = await db.credenciais_parceiros.find_one({
        "parceiro_id": parceiro_id,
        "plataforma_id": data.plataforma_id,
        "ativo": True
    })
    if not cred:
        raise HTTPException(status_code=400, detail="Configure primeiro as credenciais desta plataforma")
    
    # Parse datas
    try:
        data_inicio = datetime.fromisoformat(data.data_inicio.replace('Z', '+00:00'))
        data_fim = datetime.fromisoformat(data.data_fim.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Formato de data inválido")
    
    # Criar registo de sincronização pendente
    sync_id = str(uuid.uuid4())
    sync_log = {
        "id": sync_id,
        "parceiro_id": parceiro_id,
        "plataforma_id": data.plataforma_id,
        "plataforma_nome": plataforma.get("nome"),
        "status": "pendente",
        "periodo": {"inicio": data.data_inicio, "fim": data.data_fim},
        "criado_em": datetime.now(timezone.utc).isoformat()
    }
    await db.logs_sincronizacao.insert_one(sync_log)
    
    # Executar em background
    async def run_sync():
        try:
            resultado = await executar_sincronizacao_dinamica(
                plataforma_id=data.plataforma_id,
                parceiro_id=parceiro_id,
                data_inicio=data_inicio,
                data_fim=data_fim,
                headless=True,
                db=db
            )
            
            # Actualizar log
            await db.logs_sincronizacao.update_one(
                {"id": sync_id},
                {"$set": {
                    "status": "sucesso" if resultado.get("sucesso") else "erro",
                    "erro": resultado.get("erro"),
                    "ficheiros": resultado.get("ficheiros", []),
                    "terminado_em": datetime.now(timezone.utc).isoformat()
                }}
            )
        except Exception as e:
            await db.logs_sincronizacao.update_one(
                {"id": sync_id},
                {"$set": {"status": "erro", "erro": str(e), "terminado_em": datetime.now(timezone.utc).isoformat()}}
            )
    
    background_tasks.add_task(run_sync)
    
    return {
        "sucesso": True,
        "mensagem": f"Sincronização iniciada para {plataforma.get('nome')}",
        "sync_id": sync_id
    }


@router.get("/sincronizar/{sync_id}")
async def obter_status_sincronizacao(
    sync_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter status de uma sincronização"""
    parceiro_id = current_user.get("parceiro_id")
    
    filtro = {"id": sync_id}
    if current_user["role"] != "admin":
        filtro["parceiro_id"] = parceiro_id
    
    sync_log = await db.logs_sincronizacao.find_one(filtro, {"_id": 0})
    
    if not sync_log:
        raise HTTPException(status_code=404, detail="Sincronização não encontrada")
    
    return sync_log


@router.get("/sincronizacoes/historico")
async def obter_historico_sincronizacoes(
    plataforma_id: Optional[str] = None,
    limite: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Obter histórico de sincronizações"""
    parceiro_id = current_user.get("parceiro_id")
    
    filtro = {}
    if current_user["role"] != "admin":
        filtro["parceiro_id"] = parceiro_id
    
    if plataforma_id:
        filtro["plataforma_id"] = plataforma_id
    
    logs = await db.logs_sincronizacao.find(
        filtro,
        {"_id": 0}
    ).sort("criado_em", -1).to_list(length=limite)
    
    return logs
