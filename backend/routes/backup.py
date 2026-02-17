"""
Sistema de Cópia de Segurança (Backup/Restore)
Permite exportar e importar todos os dados de um parceiro
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import json
import os
import zipfile
import shutil
import base64
import logging
from pathlib import Path
from io import BytesIO

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/backup", tags=["Cópia de Segurança"])
logger = logging.getLogger(__name__)
db = get_database()

# Diretório para armazenar backups
BACKUP_DIR = Path(__file__).parent.parent / "uploads" / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

# Coleções a incluir no backup (por parceiro)
COLECOES_BACKUP = [
    # Utilizadores e Motoristas
    {"nome": "users", "filtro_campo": "parceiro_id", "alternativo": "id"},
    {"nome": "motoristas", "filtro_campo": "parceiro_atribuido"},
    {"nome": "definicoes_motorista", "filtro_campo": "motorista_id", "via_motorista": True},
    
    # Veículos
    {"nome": "vehicles", "filtro_campo": "parceiro_id"},
    {"nome": "turnos_veiculos", "filtro_campo": "parceiro_id"},
    {"nome": "historico_atribuicoes", "filtro_campo": "parceiro_id"},
    {"nome": "historico_custos_veiculo", "filtro_campo": "parceiro_id"},
    
    # Ganhos
    {"nome": "ganhos_uber", "filtro_campo": "parceiro_id"},
    {"nome": "ganhos_bolt", "filtro_campo": "parceiro_id"},
    {"nome": "dados_uber", "filtro_campo": "parceiro_id"},
    {"nome": "dados_bolt", "filtro_campo": "parceiro_id"},
    {"nome": "viagens_uber", "filtro_campo": "parceiro_id"},
    {"nome": "viagens_bolt", "filtro_campo": "parceiro_id"},
    
    # Despesas
    {"nome": "portagens_viaverde", "filtro_campo": "parceiro_id"},
    {"nome": "despesas_combustivel", "filtro_campo": "parceiro_id"},
    {"nome": "abastecimentos_combustivel", "filtro_campo": "parceiro_id"},
    {"nome": "combustivel_eletrico", "filtro_campo": "parceiro_id"},
    {"nome": "despesas", "filtro_campo": "parceiro_id"},
    {"nome": "despesas_extras", "filtro_campo": "parceiro_id"},
    {"nome": "despesas_fornecedor", "filtro_campo": "parceiro_id"},
    {"nome": "viaverde_movimentos", "filtro_campo": "parceiro_id"},
    {"nome": "viaverde_acumulado", "filtro_campo": "parceiro_id"},
    
    # Relatórios e Resumos
    {"nome": "resumos_semanais", "filtro_campo": "parceiro_id"},
    {"nome": "relatorios_semanais", "filtro_campo": "parceiro_id"},
    {"nome": "relatorios_ganhos", "filtro_campo": "parceiro_id"},
    {"nome": "ajustes_semanais", "filtro_campo": "parceiro_id"},
    
    # Vistorias
    {"nome": "vistorias", "filtro_campo": "parceiro_id"},
    {"nome": "vistorias_mobile", "filtro_campo": "parceiro_id"},
    
    # Pagamentos e Recibos
    {"nome": "pagamentos", "filtro_campo": "parceiro_id"},
    {"nome": "pagamentos_recibos", "filtro_campo": "parceiro_id"},
    {"nome": "recibos", "filtro_campo": "parceiro_id"},
    
    # Extras e Dívidas
    {"nome": "extras_motorista", "filtro_campo": "parceiro_id"},
    
    # Contratos e Documentos
    {"nome": "contratos", "filtro_campo": "parceiro_id"},
    {"nome": "contratos_motorista", "filtro_campo": "parceiro_id"},
    {"nome": "templates_contratos", "filtro_campo": "parceiro_id"},
    
    # Ponto/Turnos
    {"nome": "registos_ponto", "filtro_campo": "parceiro_id"},
    
    # Credenciais e Configurações
    {"nome": "credenciais_plataforma", "filtro_campo": "parceiro_id"},
    {"nome": "credenciais_parceiro", "filtro_campo": "parceiro_id"},
    {"nome": "config_comissoes_parceiro", "filtro_campo": "parceiro_id"},
    {"nome": "config_alertas_custos", "filtro_campo": "parceiro_id"},
    {"nome": "configuracoes_sincronizacao", "filtro_campo": "parceiro_id"},
    {"nome": "csv_configuracoes", "filtro_campo": "parceiro_id"},
    
    # Fornecedores
    {"nome": "fornecedores", "filtro_campo": "parceiro_id"},
    {"nome": "cartoes_frota", "filtro_campo": "parceiro_id"},
    
    # Alertas e Notificações
    {"nome": "alertas", "filtro_campo": "parceiro_id"},
    {"nome": "notificacoes", "filtro_campo": "user_id", "via_motorista": True},
    
    # Logs e Histórico
    {"nome": "logs_importacao", "filtro_campo": "parceiro_id"},
    {"nome": "ficheiros_importados", "filtro_campo": "parceiro_id"},
    {"nome": "historico_relatorios", "filtro_campo": "parceiro_id"},
    
    # RPA
    {"nome": "rpa_agendamentos", "filtro_campo": "parceiro_id"},
    {"nome": "rpa_execucoes", "filtro_campo": "parceiro_id"},
    {"nome": "execucoes_rpa", "filtro_campo": "parceiro_id"},
    
    # Mensagens e Tickets
    {"nome": "mensagens", "filtro_campo": "parceiro_id"},
    {"nome": "tickets", "filtro_campo": "parceiro_id"},
]

# Diretórios de ficheiros a incluir no backup completo
DIRETORIOS_FICHEIROS = [
    "uploads/vistorias_pdf",
    "uploads/recibos",
    "uploads/recibos_semanais",
    "uploads/comprovativos",
    "uploads/comprovativo_pagamento",
    "uploads/documentos",
    "uploads/contratos",
]


class ExportarBackupRequest(BaseModel):
    incluir_ficheiros: bool = False  # Opção A (com ficheiros) ou B (só dados)
    nome_backup: Optional[str] = None


class ImportarBackupResponse(BaseModel):
    success: bool
    message: str
    estatisticas: dict


def serializar_documento(doc: dict) -> dict:
    """Converte ObjectId e datetime para strings serializáveis"""
    resultado = {}
    for key, value in doc.items():
        if key == "_id":
            continue  # Ignorar _id do MongoDB
        elif hasattr(value, 'isoformat'):
            resultado[key] = value.isoformat()
        elif isinstance(value, bytes):
            resultado[key] = base64.b64encode(value).decode('utf-8')
        elif isinstance(value, dict):
            resultado[key] = serializar_documento(value)
        elif isinstance(value, list):
            resultado[key] = [
                serializar_documento(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            resultado[key] = value
    return resultado


async def obter_ids_motoristas(parceiro_id: str) -> List[str]:
    """Obtém lista de IDs de motoristas de um parceiro"""
    motoristas = await db.motoristas.find(
        {"parceiro_atribuido": parceiro_id},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    return [m["id"] for m in motoristas]


@router.post("/exportar")
async def exportar_backup(
    request: ExportarBackupRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Exportar cópia de segurança completa dos dados do parceiro.
    
    - incluir_ficheiros=False: Apenas dados (JSON leve)
    - incluir_ficheiros=True: Dados + ficheiros (ZIP completo)
    """
    
    # Verificar permissões
    if current_user["role"] not in ["admin", "parceiro"]:
        raise HTTPException(status_code=403, detail="Apenas Admin e Parceiros podem fazer backup")
    
    # Determinar parceiro_id
    if current_user["role"] == "admin":
        # Admin pode fazer backup de qualquer parceiro (ou de todos)
        parceiro_id = current_user.get("id")
    else:
        parceiro_id = current_user["id"]
    
    backup_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y%m%d_%H%M%S")
    
    nome_backup = request.nome_backup or f"backup_{timestamp}"
    
    logger.info(f"Iniciando backup para parceiro {parceiro_id}, incluir_ficheiros={request.incluir_ficheiros}")
    
    try:
        # Obter IDs dos motoristas do parceiro
        motoristas_ids = await obter_ids_motoristas(parceiro_id)
        
        # Estrutura do backup
        backup_data = {
            "versao": "1.0",
            "data_criacao": now.isoformat(),
            "parceiro_id": parceiro_id,
            "parceiro_nome": current_user.get("name", ""),
            "parceiro_email": current_user.get("email", ""),
            "tipo": "completo" if request.incluir_ficheiros else "dados",
            "colecoes": {},
            "estatisticas": {
                "total_registos": 0,
                "colecoes_exportadas": 0
            }
        }
        
        total_registos = 0
        
        # Exportar cada coleção
        for config in COLECOES_BACKUP:
            nome_colecao = config["nome"]
            filtro_campo = config["filtro_campo"]
            via_motorista = config.get("via_motorista", False)
            alternativo = config.get("alternativo")
            
            try:
                colecao = db[nome_colecao]
                
                # Construir query
                if via_motorista and motoristas_ids:
                    # Filtrar por IDs dos motoristas
                    query = {filtro_campo: {"$in": motoristas_ids}}
                elif alternativo and nome_colecao == "users":
                    # Para users, incluir o próprio parceiro e motoristas
                    query = {
                        "$or": [
                            {"id": parceiro_id},
                            {"id": {"$in": motoristas_ids}},
                            {"parceiro_id": parceiro_id}
                        ]
                    }
                else:
                    query = {filtro_campo: parceiro_id}
                
                # Buscar documentos
                docs = await colecao.find(query, {"_id": 0}).to_list(50000)
                
                if docs:
                    backup_data["colecoes"][nome_colecao] = [
                        serializar_documento(doc) for doc in docs
                    ]
                    total_registos += len(docs)
                    logger.info(f"  - {nome_colecao}: {len(docs)} registos")
                    
            except Exception as e:
                logger.warning(f"Erro ao exportar {nome_colecao}: {str(e)}")
                continue
        
        backup_data["estatisticas"]["total_registos"] = total_registos
        backup_data["estatisticas"]["colecoes_exportadas"] = len(backup_data["colecoes"])
        
        # Criar diretório do backup
        backup_path = BACKUP_DIR / backup_id
        backup_path.mkdir(parents=True, exist_ok=True)
        
        # Guardar JSON de dados
        json_file = backup_path / "dados.json"
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2)
        
        # Se incluir ficheiros, criar ZIP
        if request.incluir_ficheiros:
            ficheiros_dir = backup_path / "ficheiros"
            ficheiros_dir.mkdir(exist_ok=True)
            
            ficheiros_copiados = 0
            backend_dir = Path(__file__).parent.parent
            
            for dir_relativo in DIRETORIOS_FICHEIROS:
                dir_origem = backend_dir / dir_relativo
                if dir_origem.exists():
                    dir_destino = ficheiros_dir / dir_relativo
                    dir_destino.mkdir(parents=True, exist_ok=True)
                    
                    # Copiar ficheiros que pertencem ao parceiro
                    for ficheiro in dir_origem.iterdir():
                        if ficheiro.is_file():
                            # Verificar se ficheiro pertence ao parceiro
                            nome_ficheiro = ficheiro.name
                            if parceiro_id in nome_ficheiro or any(mid in nome_ficheiro for mid in motoristas_ids):
                                shutil.copy2(ficheiro, dir_destino / nome_ficheiro)
                                ficheiros_copiados += 1
            
            backup_data["estatisticas"]["ficheiros_copiados"] = ficheiros_copiados
            
            # Atualizar JSON com estatísticas de ficheiros
            with open(json_file, "w", encoding="utf-8") as f:
                json.dump(backup_data, f, ensure_ascii=False, indent=2)
            
            # Criar ZIP
            zip_filename = f"{nome_backup}.zip"
            zip_path = BACKUP_DIR / zip_filename
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(backup_path):
                    for file in files:
                        file_path = Path(root) / file
                        arcname = file_path.relative_to(backup_path)
                        zipf.write(file_path, arcname)
            
            # Limpar diretório temporário
            shutil.rmtree(backup_path)
            
            final_filename = zip_filename
            final_path = zip_path
            tamanho = zip_path.stat().st_size
        else:
            # Apenas JSON
            final_filename = f"{nome_backup}.json"
            final_path = BACKUP_DIR / final_filename
            shutil.move(json_file, final_path)
            shutil.rmtree(backup_path)
            tamanho = final_path.stat().st_size
        
        # Registar backup na BD
        registo_backup = {
            "id": backup_id,
            "parceiro_id": parceiro_id,
            "parceiro_nome": current_user.get("name", ""),
            "nome": nome_backup,
            "filename": final_filename,
            "path": str(final_path),
            "tipo": "completo" if request.incluir_ficheiros else "dados",
            "tamanho_bytes": tamanho,
            "tamanho_formatado": formatar_tamanho(tamanho),
            "total_registos": total_registos,
            "colecoes_exportadas": len(backup_data["colecoes"]),
            "created_at": now.isoformat(),
            "created_by": current_user["id"]
        }
        
        await db.backups.insert_one(registo_backup)
        
        logger.info(f"Backup {backup_id} criado com sucesso: {total_registos} registos, {formatar_tamanho(tamanho)}")
        
        return {
            "success": True,
            "backup_id": backup_id,
            "filename": final_filename,
            "tamanho": formatar_tamanho(tamanho),
            "estatisticas": {
                "total_registos": total_registos,
                "colecoes_exportadas": len(backup_data["colecoes"]),
                "tipo": "completo" if request.incluir_ficheiros else "dados"
            },
            "download_url": f"/api/backup/download/{backup_id}"
        }
        
    except Exception as e:
        logger.error(f"Erro ao criar backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar backup: {str(e)}")


@router.get("/download/{backup_id}")
async def download_backup(
    backup_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download de um ficheiro de backup"""
    
    # Verificar permissões
    if current_user["role"] not in ["admin", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Buscar backup
    backup = await db.backups.find_one({"id": backup_id}, {"_id": 0})
    
    if not backup:
        raise HTTPException(status_code=404, detail="Backup não encontrado")
    
    # Verificar se pertence ao parceiro
    if current_user["role"] == "parceiro" and backup["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    file_path = Path(backup["path"])
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Ficheiro de backup não encontrado")
    
    return FileResponse(
        path=str(file_path),
        filename=backup["filename"],
        media_type="application/octet-stream"
    )


@router.post("/importar")
async def importar_backup(
    file: UploadFile = File(...),
    modo: str = Form("substituir"),  # "substituir" ou "adicionar"
    current_user: dict = Depends(get_current_user)
):
    """
    Importar cópia de segurança.
    
    - modo="substituir": Substitui dados existentes
    - modo="adicionar": Adiciona sem substituir (pode criar duplicados)
    """
    
    # Verificar permissões
    if current_user["role"] not in ["admin", "parceiro"]:
        raise HTTPException(status_code=403, detail="Apenas Admin e Parceiros podem restaurar backup")
    
    parceiro_id = current_user["id"]
    
    logger.info(f"Iniciando importação de backup para parceiro {parceiro_id}, modo={modo}")
    
    try:
        # Ler ficheiro
        content = await file.read()
        
        # Verificar se é ZIP ou JSON
        if file.filename.endswith(".zip"):
            # Extrair ZIP
            temp_dir = BACKUP_DIR / f"temp_{uuid.uuid4()}"
            temp_dir.mkdir(parents=True, exist_ok=True)
            
            with zipfile.ZipFile(BytesIO(content), 'r') as zipf:
                zipf.extractall(temp_dir)
            
            # Ler dados.json
            json_file = temp_dir / "dados.json"
            if not json_file.exists():
                shutil.rmtree(temp_dir)
                raise HTTPException(status_code=400, detail="Ficheiro dados.json não encontrado no ZIP")
            
            with open(json_file, "r", encoding="utf-8") as f:
                backup_data = json.load(f)
            
            # Copiar ficheiros se existirem
            ficheiros_dir = temp_dir / "ficheiros"
            if ficheiros_dir.exists():
                backend_dir = Path(__file__).parent.parent
                for root, dirs, files in os.walk(ficheiros_dir):
                    for filename in files:
                        src = Path(root) / filename
                        rel_path = src.relative_to(ficheiros_dir)
                        dest = backend_dir / rel_path
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(src, dest)
            
            shutil.rmtree(temp_dir)
            
        elif file.filename.endswith(".json"):
            backup_data = json.loads(content.decode("utf-8"))
        else:
            raise HTTPException(status_code=400, detail="Formato de ficheiro não suportado. Use .json ou .zip")
        
        # Validar estrutura do backup
        if "versao" not in backup_data or "colecoes" not in backup_data:
            raise HTTPException(status_code=400, detail="Ficheiro de backup inválido")
        
        # Estatísticas
        estatisticas = {
            "colecoes_importadas": 0,
            "registos_inseridos": 0,
            "registos_atualizados": 0,
            "erros": []
        }
        
        # Mapear IDs antigos para novos (se necessário)
        id_map = {
            "parceiro": {backup_data.get("parceiro_id", ""): parceiro_id},
            "motoristas": {},
            "veiculos": {}
        }
        
        # Importar cada coleção
        for nome_colecao, documentos in backup_data["colecoes"].items():
            if not documentos:
                continue
                
            try:
                colecao = db[nome_colecao]
                
                for doc in documentos:
                    # Atualizar referências de parceiro_id
                    if "parceiro_id" in doc:
                        doc["parceiro_id"] = parceiro_id
                    if "parceiro_atribuido" in doc:
                        doc["parceiro_atribuido"] = parceiro_id
                    
                    # Adicionar marcador de importação
                    doc["importado_de_backup"] = True
                    doc["importado_em"] = datetime.now(timezone.utc).isoformat()
                    
                    if modo == "substituir" and "id" in doc:
                        # Tentar atualizar, senão inserir
                        result = await colecao.update_one(
                            {"id": doc["id"]},
                            {"$set": doc},
                            upsert=True
                        )
                        if result.modified_count > 0:
                            estatisticas["registos_atualizados"] += 1
                        else:
                            estatisticas["registos_inseridos"] += 1
                    else:
                        # Gerar novo ID se modo adicionar
                        if modo == "adicionar" and "id" in doc:
                            old_id = doc["id"]
                            doc["id"] = str(uuid.uuid4())
                            doc["id_original"] = old_id
                        
                        await colecao.insert_one(doc)
                        estatisticas["registos_inseridos"] += 1
                
                estatisticas["colecoes_importadas"] += 1
                logger.info(f"  - {nome_colecao}: {len(documentos)} registos importados")
                
            except Exception as e:
                erro = f"Erro ao importar {nome_colecao}: {str(e)}"
                logger.warning(erro)
                estatisticas["erros"].append(erro)
                continue
        
        # Registar importação
        now = datetime.now(timezone.utc)
        registo_importacao = {
            "id": str(uuid.uuid4()),
            "parceiro_id": parceiro_id,
            "filename": file.filename,
            "modo": modo,
            "backup_original": {
                "parceiro_id": backup_data.get("parceiro_id"),
                "parceiro_nome": backup_data.get("parceiro_nome"),
                "data_criacao": backup_data.get("data_criacao"),
                "versao": backup_data.get("versao")
            },
            "estatisticas": estatisticas,
            "created_at": now.isoformat(),
            "created_by": current_user["id"]
        }
        
        await db.backup_importacoes.insert_one(registo_importacao)
        
        logger.info(f"Importação concluída: {estatisticas['registos_inseridos']} inseridos, {estatisticas['registos_atualizados']} atualizados")
        
        return {
            "success": True,
            "message": "Backup importado com sucesso",
            "estatisticas": estatisticas
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Ficheiro JSON inválido")
    except Exception as e:
        logger.error(f"Erro ao importar backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao importar backup: {str(e)}")


@router.get("/historico")
async def listar_backups(
    current_user: dict = Depends(get_current_user)
):
    """Listar histórico de backups do parceiro"""
    
    if current_user["role"] not in ["admin", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {}
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    
    backups = await db.backups.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Verificar se ficheiros ainda existem
    for backup in backups:
        backup["ficheiro_existe"] = Path(backup.get("path", "")).exists()
    
    return {"backups": backups, "total": len(backups)}


@router.get("/importacoes")
async def listar_importacoes(
    current_user: dict = Depends(get_current_user)
):
    """Listar histórico de importações"""
    
    if current_user["role"] not in ["admin", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    query = {}
    if current_user["role"] == "parceiro":
        query["parceiro_id"] = current_user["id"]
    
    importacoes = await db.backup_importacoes.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"importacoes": importacoes, "total": len(importacoes)}


@router.delete("/{backup_id}")
async def apagar_backup(
    backup_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Apagar um backup"""
    
    if current_user["role"] not in ["admin", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    backup = await db.backups.find_one({"id": backup_id}, {"_id": 0})
    
    if not backup:
        raise HTTPException(status_code=404, detail="Backup não encontrado")
    
    # Verificar permissão
    if current_user["role"] == "parceiro" and backup["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Apagar ficheiro
    file_path = Path(backup.get("path", ""))
    if file_path.exists():
        file_path.unlink()
    
    # Apagar registo
    await db.backups.delete_one({"id": backup_id})
    
    logger.info(f"Backup {backup_id} apagado por {current_user['id']}")
    
    return {"success": True, "message": "Backup apagado com sucesso"}


@router.get("/info")
async def info_backup(
    current_user: dict = Depends(get_current_user)
):
    """Informações sobre o sistema de backup"""
    
    if current_user["role"] not in ["admin", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = current_user["id"]
    
    # Contar registos por coleção
    contagens = {}
    total_registos = 0
    
    motoristas_ids = await obter_ids_motoristas(parceiro_id)
    
    for config in COLECOES_BACKUP[:10]:  # Apenas primeiras 10 para ser rápido
        nome_colecao = config["nome"]
        filtro_campo = config["filtro_campo"]
        via_motorista = config.get("via_motorista", False)
        
        try:
            colecao = db[nome_colecao]
            
            if via_motorista and motoristas_ids:
                query = {filtro_campo: {"$in": motoristas_ids}}
            elif nome_colecao == "users":
                query = {
                    "$or": [
                        {"id": parceiro_id},
                        {"id": {"$in": motoristas_ids}},
                        {"parceiro_id": parceiro_id}
                    ]
                }
            else:
                query = {filtro_campo: parceiro_id}
            
            count = await colecao.count_documents(query)
            if count > 0:
                contagens[nome_colecao] = count
                total_registos += count
        except:
            continue
    
    # Último backup
    ultimo_backup = await db.backups.find_one(
        {"parceiro_id": parceiro_id},
        {"_id": 0}
    )
    
    return {
        "total_colecoes": len(COLECOES_BACKUP),
        "total_registos_estimado": total_registos,
        "principais_colecoes": contagens,
        "ultimo_backup": ultimo_backup,
        "tipos_disponiveis": [
            {"tipo": "dados", "descricao": "Apenas dados (JSON leve)"},
            {"tipo": "completo", "descricao": "Dados + Ficheiros (ZIP completo)"}
        ]
    }


def formatar_tamanho(bytes_size: int) -> str:
    """Formata tamanho em bytes para formato legível"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024
    return f"{bytes_size:.1f} TB"
