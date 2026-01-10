"""Motoristas routes"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List, Dict, Optional
from datetime import datetime, timezone
from pathlib import Path
import uuid
import logging
import mimetypes

from models.motorista import Motorista, MotoristaCreate
from models.user import UserRole
from utils.auth import hash_password, get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)

# Upload directories
ROOT_DIR = Path(__file__).parent.parent
UPLOAD_DIR = ROOT_DIR / "uploads"
MOTORISTAS_UPLOAD_DIR = UPLOAD_DIR / "motoristas"
MOTORISTAS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/motoristas/register", response_model=Motorista)
async def register_motorista(motorista_data: MotoristaCreate):
    """Register a new motorista"""
    existing = await db.users.find_one({"email": motorista_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate provisional password if needed
    if motorista_data.senha_provisoria or not motorista_data.password:
        provisional_pass = motorista_data.phone.replace(" ", "")[-9:]
        password_to_hash = provisional_pass
        senha_provisoria = True
    else:
        password_to_hash = motorista_data.password
        senha_provisoria = False
    
    user_dict = {
        "id": str(uuid.uuid4()),
        "email": motorista_data.email,
        "name": motorista_data.name,
        "role": UserRole.MOTORISTA,
        "password": hash_password(password_to_hash),
        "phone": motorista_data.phone,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved": False
    }
    await db.users.insert_one(user_dict)
    
    motorista_dict = motorista_data.model_dump()
    motorista_dict.pop("password", None)
    motorista_dict["id"] = user_dict["id"]
    # Generate automatic ID for fleet card
    motorista_dict["id_cartao_frota_combustivel"] = f"FROTA-{str(uuid.uuid4())[:8].upper()}"
    motorista_dict["documents"] = {
        "license_photo": None, 
        "cv_file": None, 
        "profile_photo": None,
        "documento_identificacao": None,
        "licenca_tvde": None,
        "registo_criminal": None,
        "contrato": None,
        "additional_docs": []
    }
    motorista_dict["approved"] = False
    motorista_dict["senha_provisoria"] = senha_provisoria
    motorista_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.motoristas.insert_one(motorista_dict)
    
    if isinstance(motorista_dict["created_at"], str):
        motorista_dict["created_at"] = datetime.fromisoformat(motorista_dict["created_at"])
    
    return Motorista(**motorista_dict)


@router.get("/motoristas", response_model=List[Motorista])
async def get_motoristas(current_user: Dict = Depends(get_current_user)):
    """Get all motoristas (filtered by role)"""
    # Base query: exclude deleted motoristas
    query = {"deleted": {"$ne": True}}
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_atribuido"] = current_user["id"]
    elif current_user["role"] == UserRole.GESTAO:
        # Gestor vê motoristas dos parceiros atribuídos
        parceiros_ids = current_user.get("parceiros_atribuidos", [])
        if parceiros_ids:
            query["parceiro_atribuido"] = {"$in": parceiros_ids}
        else:
            query["parceiro_atribuido"] = None  # Nenhum motorista se sem parceiros
    
    motoristas = await db.motoristas.find(query, {"_id": 0}).to_list(length=None)
    
    # Enrich with parceiro name
    for m in motoristas:
        if isinstance(m.get("created_at"), str):
            m["created_at"] = datetime.fromisoformat(m["created_at"])
        
        # Add parceiro name
        if m.get("parceiro_atribuido"):
            parceiro = await db.parceiros.find_one({"id": m["parceiro_atribuido"]}, {"_id": 0})
            if parceiro:
                m["parceiro_atribuido_nome"] = parceiro.get("nome_empresa", parceiro.get("nome", "N/A"))
    
    return [Motorista(**m) for m in motoristas]


@router.get("/motoristas/{motorista_id}")
async def get_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get motorista by ID"""
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Add parceiro name
    if motorista.get("parceiro_atribuido"):
        parceiro = await db.parceiros.find_one({"id": motorista["parceiro_atribuido"]}, {"_id": 0})
        if parceiro:
            motorista["parceiro_atribuido_nome"] = parceiro.get("nome_empresa", parceiro.get("nome", "N/A"))
    
    # Check permissions
    if current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] == UserRole.MOTORISTA:
        if motorista["id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    if isinstance(motorista.get("created_at"), str):
        motorista["created_at"] = datetime.fromisoformat(motorista["created_at"])
    
    return Motorista(**motorista)


@router.put("/motoristas/{motorista_id}/approve")
async def approve_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Approve motorista account and assign base plan"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find or create default free plan in the new unified system
    plano_base = await db.planos_sistema.find_one({
        "preco_mensal": 0, 
        "ativo": True, 
        "tipo_usuario": "motorista"
    }, {"_id": 0})
    
    if not plano_base:
        # Create default free plan if it doesn't exist
        plano_base = {
            "id": str(uuid.uuid4()),
            "nome": "Base Gratuito",
            "descricao": "Plano base gratuito para todos os motoristas",
            "preco_mensal": 0,
            "tipo_usuario": "motorista",
            "modulos": [
                "dashboard_ganhos",
                "gestao_documentos"
            ],
            "ativo": True,
            "permite_trial": False,
            "dias_trial": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.planos_sistema.insert_one(plano_base)
        logger.info(f"Created default free plan for motorista: {plano_base['id']}")
    
    # Calculate expiry date (30 days from now)
    from datetime import timedelta
    plano_valida_ate = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    
    # Check if motorista profile exists
    motorista_exists = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    
    if motorista_exists:
        # Update existing motorista with approval and base plan
        logger.info(f"Updating motorista {motorista_id} with plan {plano_base['id']}")
        result = await db.motoristas.update_one(
            {"id": motorista_id},
            {"$set": {
                "approved": True, 
                "approved_by": current_user["id"], 
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "plano_id": plano_base["id"],
                "plano_nome": plano_base["nome"],
                "plano_valida_ate": plano_valida_ate,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"Motorista update result: matched={result.matched_count}, modified={result.modified_count}")
    else:
        # Create motorista profile if it doesn't exist
        user = await db.users.find_one({"id": motorista_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.get("role") != "motorista":
            raise HTTPException(status_code=400, detail="User is not a motorista")
        
        # Create motorista profile from user data with base plan
        motorista_profile = {
            "id": motorista_id,
            "name": user.get("name"),
            "email": user.get("email"),
            "phone": user.get("phone", ""),
            "whatsapp": user.get("whatsapp", ""),
            "data_nascimento": user.get("data_nascimento", ""),
            "nif": user.get("nif", ""),
            "nacionalidade": user.get("nacionalidade", "Portuguesa"),
            "morada_completa": user.get("morada_completa", ""),
            "codigo_postal": user.get("codigo_postal", ""),
            "id_cartao_frota_combustivel": f"FROTA-{str(uuid.uuid4())[:8].upper()}",
            "documents": {},
            "approved": True,
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "vehicle_assigned": None,
            "parceiro_atribuido": None,
            "contrato_id": None,
            "contacto_emergencia": {},
            "dados_bancarios": {},
            "plano_id": plano_base["id"],
            "plano_nome": plano_base["nome"],
            "plano_valida_ate": plano_valida_ate,
            "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat()),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.motoristas.insert_one(motorista_profile)
        logger.info(f"Created motorista profile for {motorista_id} with plan {plano_base['id']}")
    
    # Always update user approval status
    await db.users.update_one(
        {"id": motorista_id},
        {"$set": {"approved": True}}
    )
    
    # Verify the update
    updated_motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    logger.info(f"Motorista after update: plano_id={updated_motorista.get('plano_id')}, plano_nome={updated_motorista.get('plano_nome')}")
    
    return {
        "message": "Motorista approved successfully",
        "plano_atribuido": {
            "id": plano_base["id"],
            "nome": plano_base["nome"],
            "preco_mensal": plano_base["preco_mensal"],
            "plano_valida_ate": plano_valida_ate
        }
    }


@router.put("/motoristas/{motorista_id}")
async def update_motorista(
    motorista_id: str,
    update_data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Update motorista data (partial updates allowed)"""
    # Check if motorista exists
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Check if parceiro is assigned to this motorista
    is_assigned = False
    if current_user["role"] == UserRole.PARCEIRO:
        is_assigned = motorista.get("parceiro_atribuido") == current_user["id"]
    
    # Allow admin, gestao, OR parceiro assigned OR motorista editing their own profile
    is_authorized = (
        current_user["role"] in [UserRole.ADMIN, UserRole.GESTAO] or
        is_assigned or
        (current_user["role"] == UserRole.MOTORISTA and current_user["email"] == motorista.get("email"))
    )
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # If motorista is editing and documents are approved, only allow specific fields
    if (current_user["role"] == UserRole.MOTORISTA and 
        motorista.get("documentos_aprovados", False)):
        # Only allow editing: registo criminal and iban
        allowed_fields = [
            'codigo_registo_criminal', 'validade_registo_criminal',
            'iban', 'nome_banco'
        ]
        
        # Filter update_data to only allowed fields
        filtered_update = {k: v for k, v in update_data.items() if k in allowed_fields}
        
        if not filtered_update:
            raise HTTPException(
                status_code=403, 
                detail="Documentos aprovados. Apenas Registo Criminal e IBAN podem ser alterados. Contacte o gestor para outras alterações."
            )
        
        update_data = filtered_update
    
    # Remove fields that shouldn't be updated directly
    update_data.pop("id", None)
    update_data.pop("created_at", None)
    update_data.pop("_id", None)
    update_data.pop("documentos_aprovados", None)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update motorista
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": update_data}
    )
    
    # Update user table if name or email changed
    user_update = {}
    if "name" in update_data:
        user_update["name"] = update_data["name"]
    if "email" in update_data:
        user_update["email"] = update_data["email"]
    if "phone" in update_data:
        user_update["phone"] = update_data["phone"]
    
    if user_update:
        await db.users.update_one({"id": motorista_id}, {"$set": user_update})
    
    return {"message": "Motorista updated successfully"}


@router.delete("/motoristas/{motorista_id}")
async def delete_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Soft delete
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.users.update_one(
        {"id": motorista_id},
        {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Motorista deleted successfully"}


@router.put("/motoristas/{motorista_id}/aprovar-todos-documentos")
async def aprovar_todos_documentos(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Approve all motorista documents"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Update all document statuses
    update_docs = {}
    for doc_key in ["documento_identificacao_status", "licenca_tvde_status", "registo_criminal_status"]:
        update_docs[doc_key] = "aprovado"
    
    await db.motoristas.update_one({"id": motorista_id}, {"$set": update_docs})
    
    return {"message": "All documents approved successfully"}


@router.get("/motoristas/{motorista_id}/documento/{doc_type}/download")
async def download_motorista_document(
    motorista_id: str,
    doc_type: str,
    current_user: Dict = Depends(get_current_user)
):
    """Download motorista document"""
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Check permissions
    if current_user["role"] == UserRole.MOTORISTA:
        if motorista["id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get document path
    doc_path_key = f"{doc_type}"
    doc_url = motorista.get("documents", {}).get(doc_path_key) or motorista.get(doc_path_key)
    
    if not doc_url:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Convert URL to file path
    if doc_url.startswith("/uploads/"):
        file_path = ROOT_DIR / doc_url.lstrip("/")
    else:
        file_path = ROOT_DIR / "uploads" / doc_url
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found")
    
    media_type, _ = mimetypes.guess_type(str(file_path))
    
    return FileResponse(
        path=file_path,
        media_type=media_type or "application/octet-stream",
        filename=file_path.name
    )


@router.get("/motoristas/{motorista_id}/contrato/download")
async def download_motorista_contrato(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Download motorista contract"""
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Check permissions
    if current_user["role"] == UserRole.MOTORISTA:
        if motorista["id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    contrato_url = motorista.get("documents", {}).get("contrato")
    if not contrato_url:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Convert URL to file path
    if contrato_url.startswith("/uploads/"):
        file_path = ROOT_DIR / contrato_url.lstrip("/")
    else:
        file_path = ROOT_DIR / "uploads" / contrato_url
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Contract file not found")
    
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=f"contrato_{motorista['name']}.pdf"
    )


@router.get("/motoristas/{motorista_id}/historico-atribuicoes")
async def get_motorista_historico_atribuicoes(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Obter histórico de atribuições de veículos ao motorista
    Inclui dados do veículo (marca, modelo, matrícula), tipo de contrato, valor semanal e link para PDF
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Se parceiro, só pode ver histórico dos seus motoristas
    if current_user["role"] == UserRole.PARCEIRO and motorista.get("parceiro_atribuido") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    historico = await db.historico_atribuicoes.find(
        {"motorista_id": motorista_id},
        {"_id": 0}
    ).sort("data_inicio", -1).to_list(100)
    
    # Enriquecer cada entrada com dados do veículo e contrato
    for entry in historico:
        veiculo_id = entry.get("veiculo_id")
        
        if veiculo_id:
            # Obter dados do veículo
            veiculo = await db.vehicles.find_one({"id": veiculo_id}, {"_id": 0})
            if veiculo:
                entry["veiculo_marca"] = veiculo.get("marca", "")
                entry["veiculo_modelo"] = veiculo.get("modelo", "")
                entry["veiculo_matricula"] = veiculo.get("matricula", "")
                entry["veiculo_ano"] = veiculo.get("ano", "")
            
            # Usar tipo_contrato e valor_aluguer_semanal do próprio histórico se disponíveis
            # Caso contrário, procurar contrato associado
            if not entry.get("tipo_contrato") or not entry.get("valor_aluguer_semanal"):
                contrato = await db.contratos.find_one({
                    "$or": [
                        {"motorista_id": motorista_id, "veiculo_id": veiculo_id, "ativo": True},
                        {"motorista_id": motorista_id, "ativo": True}
                    ]
                }, {"_id": 0})
                
                if contrato:
                    if not entry.get("tipo_contrato"):
                        entry["tipo_contrato"] = contrato.get("tipo_utilizacao", contrato.get("tipo_contrato", "N/A"))
                    if not entry.get("valor_aluguer_semanal"):
                        entry["valor_aluguer_semanal"] = contrato.get("valor_semanal", contrato.get("valor_aluguer_semanal", 0))
                    entry["contrato_id"] = contrato.get("id")
                    
                    # Verificar se existe PDF do contrato
                    if contrato.get("pdf_url"):
                        entry["pdf_url"] = contrato.get("pdf_url")
                    elif contrato.get("pdf_path"):
                        entry["pdf_url"] = contrato.get("pdf_path")
        
        # Calcular duração da atribuição em dias
        if entry.get("data_inicio"):
            try:
                data_inicio = datetime.fromisoformat(entry["data_inicio"].replace("Z", "+00:00"))
                data_fim = datetime.fromisoformat(entry["data_fim"].replace("Z", "+00:00")) if entry.get("data_fim") else datetime.now(timezone.utc)
                entry["duracao_dias"] = (data_fim - data_inicio).days
            except Exception:
                pass
    
    return {
        "motorista_id": motorista_id,
        "motorista_nome": motorista.get("name"),
        "historico": historico,
        "total_registos": len(historico)
    }



# ==================== CONFIGURAÇÕES FINANCEIRAS ====================

@router.get("/motoristas/{motorista_id}/config-financeira")
async def get_config_financeira(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter configurações financeiras do motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Valores padrão
    config_padrao = {
        "acumular_viaverde": False,
        "viaverde_acumulado": 0,
        "viaverde_fonte": "ambos",
        "gratificacao_tipo": "na_comissao",
        "gratificacao_valor_fixo": 0,
        "incluir_iva_rendimentos": True,
        "iva_percentagem": 23,
        "comissao_personalizada": False,
        "comissao_motorista_percentagem": 70,
        "comissao_parceiro_percentagem": 30
    }
    
    config = motorista.get("config_financeira", config_padrao)
    
    # Merge com valores padrão para garantir todos os campos
    for key, value in config_padrao.items():
        if key not in config:
            config[key] = value
    
    return config


@router.put("/motoristas/{motorista_id}/config-financeira")
async def update_config_financeira(
    motorista_id: str,
    config: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar configurações financeiras do motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Verificar permissão do parceiro
    if current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Atualizar configuração
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {
            "config_financeira": config,
            "config_financeira_updated_at": datetime.now(timezone.utc).isoformat(),
            "config_financeira_updated_by": current_user["id"]
        }}
    )
    
    return {"message": "Configurações financeiras atualizadas com sucesso"}


@router.get("/motoristas/{motorista_id}/viaverde-acumulado")
async def get_viaverde_acumulado(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter valor acumulado de Via Verde e histórico"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Buscar histórico de movimentos Via Verde
    historico = await db.viaverde_acumulado.find(
        {"motorista_id": motorista_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calcular total acumulado
    total_acumulado = sum(
        h.get("valor", 0) if h.get("tipo") == "credito" else -h.get("valor", 0) 
        for h in historico
    )
    
    # Também verificar na config do motorista
    config = motorista.get("config_financeira", {})
    viaverde_config = config.get("viaverde_acumulado", 0)
    
    return {
        "motorista_id": motorista_id,
        "total_acumulado": max(viaverde_config, total_acumulado),
        "historico": historico
    }


@router.post("/motoristas/{motorista_id}/viaverde-acumular")
async def acumular_viaverde(
    motorista_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Acumular valor de Via Verde para o motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    valor = data.get("valor", 0)
    fonte = data.get("fonte", "manual")
    descricao = data.get("descricao", f"Acumulação Via Verde - {fonte}")
    
    # Criar registo de movimento
    movimento = {
        "id": str(uuid.uuid4()),
        "motorista_id": motorista_id,
        "valor": valor,
        "tipo": "credito",
        "fonte": fonte,
        "descricao": descricao,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.viaverde_acumulado.insert_one(movimento)
    
    # Atualizar total na config do motorista
    config = motorista.get("config_financeira", {})
    config["viaverde_acumulado"] = config.get("viaverde_acumulado", 0) + valor
    
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {"config_financeira": config}}
    )
    
    return {
        "message": f"Via Verde acumulado: €{valor:.2f}",
        "novo_total": config["viaverde_acumulado"]
    }


@router.post("/motoristas/{motorista_id}/viaverde-abater")
async def abater_viaverde(
    motorista_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Abater valor de Via Verde acumulado (cobrado no relatório)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    valor = data.get("valor", 0)
    relatorio_id = data.get("relatorio_id")
    descricao = data.get("descricao", "Abate Via Verde - Relatório Semanal")
    
    # Criar registo de movimento
    movimento = {
        "id": str(uuid.uuid4()),
        "motorista_id": motorista_id,
        "valor": valor,
        "tipo": "debito",
        "fonte": "abate_relatorio",
        "relatorio_id": relatorio_id,
        "descricao": descricao,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.viaverde_acumulado.insert_one(movimento)
    
    # Atualizar total na config do motorista (zerar ou reduzir)
    config = motorista.get("config_financeira", {})
    config["viaverde_acumulado"] = max(0, config.get("viaverde_acumulado", 0) - valor)
    
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {"config_financeira": config}}
    )
    
    return {
        "message": f"Via Verde abatido: €{valor:.2f}",
        "novo_total": config["viaverde_acumulado"]
    }

