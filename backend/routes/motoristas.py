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
    
    # Return all fields directly from MongoDB
    return motorista


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
    """Approve all motorista documents and set status to ativo"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista not found")
    
    # Check if parceiro is assigned
    if current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update all document statuses and set motorista as ativo
    update_data = {
        "documento_identificacao_status": "aprovado",
        "licenca_tvde_status": "aprovado",
        "registo_criminal_status": "aprovado",
        "documentos_aprovados": True,
        "status_motorista": "ativo",  # IMPORTANTE: Mudar status para ativo
        "approved": True,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": current_user["id"]
    }
    
    # Update document validations
    documents_validacao = motorista.get("documents_validacao", {})
    for doc_type in motorista.get("documents", {}).keys():
        if motorista.get("documents", {}).get(doc_type):
            documents_validacao[doc_type] = {
                "validado": True,
                "validado_por": current_user.get("name", "Admin"),
                "validado_em": datetime.now(timezone.utc).isoformat(),
                "observacoes": "Aprovação em lote"
            }
    
    update_data["documents_validacao"] = documents_validacao
    
    await db.motoristas.update_one({"id": motorista_id}, {"$set": update_data})
    
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
    
    # Get document path - check both 'documentos' and 'documents' fields
    doc_url = (
        motorista.get("documentos", {}).get(doc_type) or 
        motorista.get("documents", {}).get(doc_type) or 
        motorista.get(doc_type)
    )
    
    if not doc_url:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Convert URL to file path
    if doc_url.startswith("uploads/"):
        file_path = ROOT_DIR / doc_url
    elif doc_url.startswith("/uploads/"):
        file_path = ROOT_DIR / doc_url.lstrip("/")
    else:
        file_path = ROOT_DIR / "uploads" / doc_url
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Document file not found: {file_path}")
    
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


# ==================== DESPESAS EXTRAS (DANOS, DÍVIDAS, CRÉDITOS) ====================

@router.get("/motoristas/{motorista_id}/despesas-extras")
async def get_despesas_extras(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Listar despesas extras do motorista (danos, dívidas, créditos)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0, "id": 1})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    despesas = await db.despesas_extras.find(
        {"motorista_id": motorista_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calcular saldo
    total_debitos = sum(d.get("valor", 0) for d in despesas if d.get("tipo") == "debito")
    total_creditos = sum(d.get("valor", 0) for d in despesas if d.get("tipo") == "credito")
    saldo = total_creditos - total_debitos
    
    return {
        "despesas": despesas,
        "total_debitos": round(total_debitos, 2),
        "total_creditos": round(total_creditos, 2),
        "saldo": round(saldo, 2)
    }


@router.post("/motoristas/{motorista_id}/despesas-extras")
async def add_despesa_extra(
    motorista_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Adicionar despesa extra ao motorista (danos, dívidas, créditos de dias)
    
    Tipos de despesa:
    - debito: danos, dívidas, multas (valor positivo a cobrar)
    - credito: crédito de dias, reembolsos (valor positivo a devolver)
    
    Categorias:
    - danos: Danos no veículo
    - divida: Dívida pendente
    - multa: Multa de trânsito
    - credito_dias: Crédito de dias (férias, folgas)
    - reembolso: Reembolso de despesas
    - outro: Outros
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0, "id": 1, "name": 1})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    tipo = data.get("tipo", "debito")  # debito ou credito
    categoria = data.get("categoria", "outro")
    valor = float(data.get("valor", 0))
    descricao = data.get("descricao", "")
    semana = data.get("semana")
    ano = data.get("ano")
    
    if valor <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")
    
    despesa = {
        "id": str(uuid.uuid4()),
        "motorista_id": motorista_id,
        "motorista_nome": motorista.get("name"),
        "tipo": tipo,
        "categoria": categoria,
        "valor": round(valor, 2),
        "descricao": descricao,
        "semana": semana,
        "ano": ano,
        "status": "pendente",  # pendente, pago, cancelado
        "parceiro_id": current_user["id"] if current_user["role"] == UserRole.PARCEIRO else data.get("parceiro_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.despesas_extras.insert_one(despesa)
    
    tipo_texto = "Débito" if tipo == "debito" else "Crédito"
    return {
        "message": f"{tipo_texto} de €{valor:.2f} adicionado com sucesso",
        "despesa": {k: v for k, v in despesa.items() if k != "_id"}
    }


@router.put("/motoristas/{motorista_id}/despesas-extras/{despesa_id}")
async def update_despesa_extra(
    motorista_id: str,
    despesa_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Atualizar despesa extra (status, valor, etc.)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    despesa = await db.despesas_extras.find_one({"id": despesa_id, "motorista_id": motorista_id})
    if not despesa:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    
    update_data = {}
    if "status" in data:
        update_data["status"] = data["status"]
    if "valor" in data:
        update_data["valor"] = round(float(data["valor"]), 2)
    if "descricao" in data:
        update_data["descricao"] = data["descricao"]
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_data["updated_by"] = current_user["id"]
        
        await db.despesas_extras.update_one(
            {"id": despesa_id},
            {"$set": update_data}
        )
    
    return {"message": "Despesa atualizada com sucesso"}


@router.delete("/motoristas/{motorista_id}/despesas-extras/{despesa_id}")
async def delete_despesa_extra(
    motorista_id: str,
    despesa_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar despesa extra"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.despesas_extras.delete_one({"id": despesa_id, "motorista_id": motorista_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    
    return {"message": "Despesa eliminada com sucesso"}


# ==================== UPLOAD DE DOCUMENTOS ====================

@router.post("/motoristas/{motorista_id}/documentos/upload")
async def upload_documento_motorista(
    motorista_id: str,
    file: UploadFile = File(...),
    tipo_documento: str = Form(...),
    converter_pdf: str = Form(default="false"),
    current_user: Dict = Depends(get_current_user)
):
    """Upload de documento do motorista com conversão para PDF"""
    import shutil
    from PIL import Image
    from io import BytesIO
    
    user_role = current_user["role"]
    allowed_roles = [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA, "admin", "gestao", "parceiro", "motorista"]
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Verificar permissão do parceiro
    if user_role in [UserRole.PARCEIRO, "parceiro"]:
        parceiro_id = motorista.get("parceiro_atribuido") or motorista.get("parceiro_associado")
        if parceiro_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Motorista só pode fazer upload para si mesmo
    if user_role in [UserRole.MOTORISTA, "motorista"]:
        if motorista_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Criar diretório para documentos do motorista
    docs_dir = MOTORISTAS_UPLOAD_DIR / motorista_id / "documentos"
    docs_dir.mkdir(parents=True, exist_ok=True)
    
    # Ler conteúdo do ficheiro
    file_content = await file.read()
    file_extension = Path(file.filename).suffix.lower()
    
    # Converter para PDF se solicitado e se for imagem
    should_convert = converter_pdf.lower() == "true"
    is_image = file_extension in ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']
    
    if should_convert and is_image:
        try:
            # Abrir imagem
            image = Image.open(BytesIO(file_content))
            
            # Converter para RGB se necessário (para PNG com transparência)
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Gerar nome do ficheiro PDF
            filename = f"{tipo_documento}_{uuid.uuid4()}.pdf"
            file_path = docs_dir / filename
            
            # Guardar como PDF
            image.save(str(file_path), 'PDF', resolution=100.0)
            
            logger.info(f"Imagem convertida para PDF: {file_path}")
            
        except Exception as e:
            logger.error(f"Erro ao converter para PDF: {e}")
            # Fallback: guardar ficheiro original
            filename = f"{tipo_documento}_{uuid.uuid4()}{file_extension}"
            file_path = docs_dir / filename
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
    else:
        # Guardar ficheiro como está
        filename = f"{tipo_documento}_{uuid.uuid4()}{file_extension}"
        file_path = docs_dir / filename
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
    
    relative_path = str(file_path.relative_to(ROOT_DIR))
    
    # Atualizar motorista com o caminho do documento
    # Usar $set com dot notation para evitar conflitos
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {
            f"documentos.{tipo_documento}": relative_path,
            f"documentos.{tipo_documento}_uploaded_at": datetime.now(timezone.utc).isoformat(),
            f"documentos.{tipo_documento}_uploaded_by": current_user["id"]
        }}
    )
    
    logger.info(f"Documento {tipo_documento} carregado para motorista {motorista_id}: {relative_path}")
    
    return {
        "message": "Documento carregado com sucesso",
        "tipo_documento": tipo_documento,
        "url": relative_path,
        "convertido_pdf": should_convert and is_image
    }


@router.get("/motoristas/{motorista_id}/documentos")
async def get_documentos_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Obter lista de documentos do motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Verificar permissões
    if current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] == UserRole.MOTORISTA:
        if motorista_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    documentos = motorista.get("documentos", {})
    
    return {
        "motorista_id": motorista_id,
        "documentos": documentos
    }


@router.delete("/motoristas/{motorista_id}/documentos/{tipo_documento}")
async def delete_documento_motorista(
    motorista_id: str,
    tipo_documento: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar documento do motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    documentos = motorista.get("documentos", {})
    
    if tipo_documento in documentos:
        # Tentar eliminar o ficheiro físico
        file_path = ROOT_DIR / documentos[tipo_documento]
        if file_path.exists():
            file_path.unlink()
        
        # Remover da base de dados
        del documentos[tipo_documento]
        
        await db.motoristas.update_one(
            {"id": motorista_id},
            {"$set": {"documentos": documentos}}
        )
        
        return {"message": f"Documento {tipo_documento} eliminado"}
    
    raise HTTPException(status_code=404, detail="Documento não encontrado")



# ==================== FOTO DE PERFIL ====================

@router.post("/motoristas/{motorista_id}/foto")
async def upload_foto_motorista(
    motorista_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload da foto de perfil do motorista"""
    from PIL import Image
    from io import BytesIO
    
    # Verificar permissões
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        # Motorista só pode atualizar a própria foto
        if current_user["role"] != UserRole.MOTORISTA or current_user["id"] != motorista_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Verificar permissão do parceiro
    if current_user["role"] == UserRole.PARCEIRO:
        if motorista.get("parceiro_atribuido") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validar tipo de ficheiro
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Tipo de ficheiro não suportado. Use: {', '.join(allowed_types)}"
        )
    
    # Criar diretório para fotos do motorista
    fotos_dir = MOTORISTAS_UPLOAD_DIR / motorista_id / "foto"
    fotos_dir.mkdir(parents=True, exist_ok=True)
    
    # Ler e processar a imagem
    file_content = await file.read()
    
    try:
        # Abrir imagem com Pillow
        image = Image.open(BytesIO(file_content))
        
        # Converter para RGB se necessário
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            if image.mode in ('RGBA', 'LA'):
                background.paste(image, mask=image.split()[-1])
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Redimensionar para tamanho máximo (mantendo proporção)
        max_size = (500, 500)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Criar imagem quadrada (crop centralizado)
        width, height = image.size
        min_dim = min(width, height)
        left = (width - min_dim) // 2
        top = (height - min_dim) // 2
        right = left + min_dim
        bottom = top + min_dim
        image = image.crop((left, top, right, bottom))
        
        # Redimensionar para tamanho final
        image = image.resize((300, 300), Image.Resampling.LANCZOS)
        
        # Gerar nome único para o ficheiro
        filename = f"foto_{uuid.uuid4()}.jpg"
        file_path = fotos_dir / filename
        
        # Guardar imagem otimizada
        image.save(str(file_path), 'JPEG', quality=85, optimize=True)
        
        logger.info(f"Foto de perfil processada e guardada: {file_path}")
        
    except Exception as e:
        logger.error(f"Erro ao processar imagem: {e}")
        raise HTTPException(status_code=400, detail="Erro ao processar a imagem")
    
    # Caminho relativo para guardar na DB
    relative_path = str(file_path.relative_to(ROOT_DIR))
    
    # Eliminar foto anterior se existir
    old_foto = motorista.get("foto_url")
    if old_foto:
        old_path = ROOT_DIR / old_foto
        if old_path.exists():
            try:
                old_path.unlink()
                logger.info(f"Foto anterior eliminada: {old_path}")
            except Exception as e:
                logger.warning(f"Não foi possível eliminar foto anterior: {e}")
    
    # Atualizar motorista com o caminho da nova foto
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$set": {
            "foto_url": relative_path,
            "foto_updated_at": datetime.now(timezone.utc).isoformat(),
            "foto_updated_by": current_user["id"]
        }}
    )
    
    logger.info(f"Foto de perfil atualizada para motorista {motorista_id}: {relative_path}")
    
    return {
        "message": "Foto atualizada com sucesso",
        "url": relative_path
    }



@router.get("/motoristas/{motorista_id}/foto")
async def get_foto_motorista(
    motorista_id: str
):
    """Obter foto de perfil do motorista (endpoint público para exibição)"""
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0, "foto_url": 1})
    
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    foto_url = motorista.get("foto_url")
    if not foto_url:
        raise HTTPException(status_code=404, detail="Motorista não tem foto de perfil")
    
    # Converter para caminho absoluto
    file_path = ROOT_DIR / foto_url
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Ficheiro da foto não encontrado")
    
    media_type, _ = mimetypes.guess_type(str(file_path))
    
    return FileResponse(
        path=file_path,
        media_type=media_type or "image/jpeg",
        filename=file_path.name
    )


@router.delete("/motoristas/{motorista_id}/foto")
async def delete_foto_motorista(
    motorista_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Eliminar foto de perfil do motorista"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    foto_url = motorista.get("foto_url")
    if not foto_url:
        raise HTTPException(status_code=404, detail="Motorista não tem foto de perfil")
    
    # Eliminar ficheiro físico
    file_path = ROOT_DIR / foto_url
    if file_path.exists():
        file_path.unlink()
        logger.info(f"Foto eliminada: {file_path}")
    
    # Remover da base de dados
    await db.motoristas.update_one(
        {"id": motorista_id},
        {"$unset": {"foto_url": "", "foto_updated_at": "", "foto_updated_by": ""}}
    )
    
    return {"message": "Foto eliminada com sucesso"}

