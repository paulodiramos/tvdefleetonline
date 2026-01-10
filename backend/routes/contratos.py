"""Contratos routes for FleeTrack application"""

from fastapi import APIRouter, HTTPException, Depends, Body
from fastapi.responses import StreamingResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging
from io import BytesIO

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contratos", tags=["contratos"])
db = get_database()


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


class ContratoCreateRequest(BaseModel):
    parceiro_id: str
    motorista_id: str
    vehicle_id: Optional[str] = None
    data_inicio: str
    tipo_contrato: str = "comissao"
    valor_semanal: float = 230.0
    comissao_percentual: Optional[float] = None
    caucao_total: float = 300.0
    caucao_lavagem: float = 90.0
    tem_caucao: bool = True
    caucao_parcelada: bool = False
    caucao_parcelas: Optional[int] = None
    caucao_texto: Optional[str] = None
    tem_epoca: bool = False
    data_inicio_epoca_alta: Optional[str] = None
    data_fim_epoca_alta: Optional[str] = None
    valor_epoca_alta: Optional[float] = None
    texto_epoca_alta: Optional[str] = None
    data_inicio_epoca_baixa: Optional[str] = None
    data_fim_epoca_baixa: Optional[str] = None
    valor_epoca_baixa: Optional[float] = None
    texto_epoca_baixa: Optional[str] = None
    condicoes_veiculo: Optional[str] = None
    template_texto: Optional[str] = None


@router.get("/exemplos")
async def get_exemplos_contratos(current_user: dict = Depends(get_current_user)):
    """Obtém exemplos de contratos disponíveis"""
    exemplos = [
        {"tipo": "aluguer_normal", "nome": "Aluguer Normal (sem caução)"},
        {"tipo": "aluguer_caucao", "nome": "Aluguer com Caução"},
        {"tipo": "aluguer_caucao_parcelada", "nome": "Aluguer com Caução Parcelada"},
        {"tipo": "aluguer_epocas", "nome": "Aluguer por Épocas"},
        {"tipo": "comissao", "nome": "Contrato de Comissão"},
        {"tipo": "compra_veiculo", "nome": "Compra de Veículo"},
        {"tipo": "motorista_privado", "nome": "Motorista Privado"}
    ]
    return exemplos


@router.get("/exemplos/{tipo}/download")
async def download_exemplo_contrato(
    tipo: str,
    current_user: dict = Depends(get_current_user)
):
    """Download de exemplo de contrato"""
    # Por enquanto, retornar template básico
    # TODO: Implementar templates reais
    template = f"EXEMPLO DE CONTRATO - TIPO: {tipo.upper()}\n\nEste é um template de exemplo."
    
    buffer = BytesIO(template.encode('utf-8'))
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=exemplo_{tipo}.txt"}
    )


@router.post("")
async def criar_contrato(
    contrato_data: ContratoCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Cria um novo contrato"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verificar se parceiro pode criar contrato
    if current_user["role"] == UserRole.PARCEIRO and contrato_data.parceiro_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado a criar contrato para outro parceiro")
    
    # Obter dados do parceiro
    parceiro = await db.parceiros.find_one({"id": contrato_data.parceiro_id}, {"_id": 0})
    if not parceiro:
        parceiro = await db.users.find_one({"id": contrato_data.parceiro_id}, {"_id": 0})
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    # Obter dados do motorista
    motorista = await db.motoristas.find_one({"id": contrato_data.motorista_id}, {"_id": 0})
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    
    # Obter dados do veículo se especificado
    veiculo = None
    if contrato_data.vehicle_id:
        veiculo = await db.vehicles.find_one({"id": contrato_data.vehicle_id}, {"_id": 0})
    
    # Gerar referência do contrato
    ano = datetime.now().year
    count = await db.contratos.count_documents({"parceiro_id": contrato_data.parceiro_id})
    referencia = f"{str(count + 1).zfill(3)}/{ano}"
    
    contrato = {
        "id": str(uuid.uuid4()),
        "referencia": referencia,
        "parceiro_id": contrato_data.parceiro_id,
        "motorista_id": contrato_data.motorista_id,
        "vehicle_id": contrato_data.vehicle_id,
        
        # Dados do parceiro
        "parceiro_nome": parceiro.get("nome_empresa") or parceiro.get("name", ""),
        "parceiro_nif": parceiro.get("contribuinte_empresa") or parceiro.get("nif", ""),
        "parceiro_morada": parceiro.get("morada_completa") or parceiro.get("morada", ""),
        "parceiro_codigo_postal": parceiro.get("codigo_postal", ""),
        "parceiro_localidade": parceiro.get("localidade", ""),
        "parceiro_telefone": parceiro.get("telefone", ""),
        "parceiro_email": parceiro.get("email", ""),
        
        # Dados do motorista
        "motorista_nome": motorista.get("name", ""),
        "motorista_cc": motorista.get("numero_documento") or motorista.get("numero_cc", ""),
        "motorista_cc_validade": motorista.get("validade_documento") or motorista.get("validade_cc", ""),
        "motorista_nif": motorista.get("nif", ""),
        "motorista_morada": motorista.get("morada_completa", ""),
        "motorista_codigo_postal": motorista.get("codigo_postal", ""),
        "motorista_telefone": motorista.get("phone", ""),
        "motorista_email": motorista.get("email", ""),
        
        # Dados do veículo
        "vehicle_marca": veiculo.get("marca", "") if veiculo else "",
        "vehicle_modelo": veiculo.get("modelo", "") if veiculo else "",
        "vehicle_matricula": veiculo.get("matricula", "") if veiculo else "",
        
        # Termos financeiros
        "tipo_contrato": contrato_data.tipo_contrato,
        "valor_semanal": contrato_data.valor_semanal,
        "comissao_percentual": contrato_data.comissao_percentual,
        "caucao_total": contrato_data.caucao_total,
        "caucao_lavagem": contrato_data.caucao_lavagem,
        "tem_caucao": contrato_data.tem_caucao,
        "caucao_parcelada": contrato_data.caucao_parcelada,
        "caucao_parcelas": contrato_data.caucao_parcelas,
        "caucao_texto": contrato_data.caucao_texto,
        
        # Épocas
        "tem_epoca": contrato_data.tem_epoca,
        "data_inicio_epoca_alta": contrato_data.data_inicio_epoca_alta,
        "data_fim_epoca_alta": contrato_data.data_fim_epoca_alta,
        "valor_epoca_alta": contrato_data.valor_epoca_alta,
        "texto_epoca_alta": contrato_data.texto_epoca_alta,
        "data_inicio_epoca_baixa": contrato_data.data_inicio_epoca_baixa,
        "data_fim_epoca_baixa": contrato_data.data_fim_epoca_baixa,
        "valor_epoca_baixa": contrato_data.valor_epoca_baixa,
        "texto_epoca_baixa": contrato_data.texto_epoca_baixa,
        
        # Outros
        "condicoes_veiculo": contrato_data.condicoes_veiculo,
        "template_texto": contrato_data.template_texto,
        "data_inicio": contrato_data.data_inicio,
        
        # Status
        "status": "pendente",  # pendente, ativo, terminado, cancelado
        "assinado_motorista": False,
        "assinado_parceiro": False,
        
        # Metadata
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user["id"]
    }
    
    await db.contratos.insert_one(contrato)
    
    # Remover _id antes de retornar
    contrato.pop("_id", None)
    
    return contrato


@router.get("")
async def get_contratos(current_user: dict = Depends(get_current_user)):
    """Lista contratos"""
    query = {}
    
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    elif current_user["role"] == UserRole.MOTORISTA:
        query["motorista_id"] = current_user["id"]
    
    contratos = await db.contratos.find(query, {"_id": 0}).to_list(None)
    return contratos


@router.get("/{contrato_id}")
async def get_contrato(
    contrato_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtém um contrato específico"""
    contrato = await db.contratos.find_one({"id": contrato_id}, {"_id": 0})
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    
    # Verificar permissões
    if current_user["role"] == UserRole.PARCEIRO and contrato["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user["role"] == UserRole.MOTORISTA and contrato["motorista_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return contrato


@router.put("/{contrato_id}/assinar")
async def assinar_contrato(
    contrato_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Assina um contrato"""
    contrato = await db.contratos.find_one({"id": contrato_id}, {"_id": 0})
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    
    update_data = {}
    
    if current_user["role"] == UserRole.MOTORISTA:
        if contrato["motorista_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        update_data["assinado_motorista"] = True
        update_data["data_assinatura_motorista"] = datetime.now(timezone.utc)
    
    elif current_user["role"] == UserRole.PARCEIRO:
        if contrato["parceiro_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        update_data["assinado_parceiro"] = True
        update_data["data_assinatura_parceiro"] = datetime.now(timezone.utc)
    
    elif current_user["role"] in [UserRole.ADMIN, UserRole.GESTAO]:
        # Admin pode assinar em nome de qualquer parte
        update_data["assinado_parceiro"] = True
        update_data["data_assinatura_parceiro"] = datetime.now(timezone.utc)
    
    # Verificar se ambos assinaram para ativar o contrato
    will_be_active = False
    if contrato.get("assinado_motorista") and update_data.get("assinado_parceiro"):
        will_be_active = True
    elif contrato.get("assinado_parceiro") and update_data.get("assinado_motorista"):
        will_be_active = True
    
    if will_be_active:
        update_data["status"] = "ativo"
    
    await db.contratos.update_one(
        {"id": contrato_id},
        {"$set": update_data}
    )
    
    return {"message": "Contrato assinado com sucesso"}


@router.delete("/{contrato_id}")
async def delete_contrato(
    contrato_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancela/elimina um contrato"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    contrato = await db.contratos.find_one({"id": contrato_id}, {"_id": 0})
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    
    if current_user["role"] == UserRole.PARCEIRO and contrato["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Marcar como cancelado em vez de eliminar
    await db.contratos.update_one(
        {"id": contrato_id},
        {"$set": {
            "status": "cancelado",
            "cancelado_por": current_user["id"],
            "cancelado_em": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Contrato cancelado"}
