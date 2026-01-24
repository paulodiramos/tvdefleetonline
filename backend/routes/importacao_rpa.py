"""
API de Importação de Dados RPA
Endpoints para upload manual e configuração de importação automática
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import logging

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database
from services.importacao_rpa import CSVParser, agrupar_por_motorista, gerar_resumo_semanal

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)


class AgendamentoConfig(BaseModel):
    """Configuração de agendamento automático"""
    ativo: bool = False
    dia_semana: int = 0  # 0=Segunda, 6=Domingo
    hora: int = 8  # Hora do dia (0-23)
    plataformas: List[str] = []  # ["bolt", "uber"]
    enviar_whatsapp: bool = True
    enviar_email: bool = True


class ImportacaoManual(BaseModel):
    """Dados para importação manual"""
    plataforma: str
    semana: Optional[int] = None
    ano: Optional[int] = None


def get_parceiro_id(current_user: Dict) -> str:
    """Get parceiro_id from current user"""
    if current_user["role"] in [UserRole.PARCEIRO, "parceiro"]:
        return current_user["id"]
    elif current_user["role"] in [UserRole.GESTAO, "gestao"]:
        return current_user.get("parceiro_id") or current_user["id"]
    else:
        return current_user.get("parceiro_id") or "admin"


# ==================== IMPORTAÇÃO MANUAL ====================

@router.post("/importacao/upload")
async def upload_csv(
    file: UploadFile = File(...),
    plataforma: str = Form(...),
    semana: Optional[int] = Form(None),
    ano: Optional[int] = Form(None),
    current_user: Dict = Depends(get_current_user)
):
    """Upload manual de ficheiro CSV"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    # Validar ficheiro
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Apenas ficheiros CSV são aceites")
    
    # Ler conteúdo
    content = await file.read()
    try:
        content_str = content.decode('utf-8')
    except:
        content_str = content.decode('latin-1')
    
    # Parse CSV
    try:
        records = CSVParser.parse(content_str, plataforma)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar CSV: {str(e)}")
    
    if not records:
        raise HTTPException(status_code=400, detail="Nenhum registo encontrado no ficheiro")
    
    # Definir semana/ano
    hoje = datetime.now()
    if not semana:
        semana = hoje.isocalendar()[1]
    if not ano:
        ano = hoje.year
    
    # Agrupar por motorista
    motoristas = agrupar_por_motorista(records)
    
    # Guardar importação
    importacao_id = str(uuid.uuid4())
    importacao = {
        "id": importacao_id,
        "parceiro_id": parceiro_id,
        "plataforma": plataforma,
        "ficheiro": file.filename,
        "semana": semana,
        "ano": ano,
        "total_registos": len(records),
        "total_motoristas": len(motoristas),
        "tipo": "manual",
        "status": "processado",
        "data_importacao": datetime.now(timezone.utc),
        "importado_por": current_user["id"]
    }
    
    await db.importacoes_rpa.insert_one(importacao)
    
    # Guardar/atualizar dados dos motoristas
    resumos_criados = 0
    for key, motorista_data in motoristas.items():
        resumo = gerar_resumo_semanal(motorista_data, semana, ano)
        resumo["importacao_id"] = importacao_id
        resumo["parceiro_id"] = parceiro_id
        resumo["id"] = str(uuid.uuid4())
        
        # Verificar se já existe resumo para este motorista/semana/plataforma
        existing = await db.resumos_semanais_rpa.find_one({
            "parceiro_id": parceiro_id,
            "email": motorista_data["email"],
            "plataforma": plataforma,
            "semana": semana,
            "ano": ano
        })
        
        if existing:
            await db.resumos_semanais_rpa.update_one(
                {"_id": existing["_id"]},
                {"$set": resumo}
            )
        else:
            await db.resumos_semanais_rpa.insert_one(resumo)
            resumos_criados += 1
    
    # Guardar registos individuais
    for record in records:
        record["importacao_id"] = importacao_id
        record["parceiro_id"] = parceiro_id
        record["semana"] = semana
        record["ano"] = ano
        record["id"] = str(uuid.uuid4())
        await db.registos_rpa.insert_one(record)
    
    return {
        "success": True,
        "message": f"Importação concluída com sucesso",
        "importacao_id": importacao_id,
        "detalhes": {
            "ficheiro": file.filename,
            "plataforma": plataforma,
            "semana": semana,
            "ano": ano,
            "total_registos": len(records),
            "total_motoristas": len(motoristas),
            "resumos_criados": resumos_criados
        }
    }


@router.get("/importacao/historico")
async def get_historico_importacoes(
    limit: int = 20,
    current_user: Dict = Depends(get_current_user)
):
    """Lista histórico de importações"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    query = {} if parceiro_id == "admin" else {"parceiro_id": parceiro_id}
    
    importacoes = await db.importacoes_rpa.find(
        query,
        {"_id": 0}
    ).sort("data_importacao", -1).limit(limit).to_list(length=limit)
    
    return importacoes


@router.get("/importacao/resumos")
async def get_resumos_semanais(
    semana: Optional[int] = None,
    ano: Optional[int] = None,
    plataforma: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Lista resumos semanais importados"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    query = {} if parceiro_id == "admin" else {"parceiro_id": parceiro_id}
    
    if semana:
        query["semana"] = semana
    if ano:
        query["ano"] = ano
    if plataforma:
        query["plataforma"] = plataforma
    
    resumos = await db.resumos_semanais_rpa.find(
        query,
        {"_id": 0}
    ).sort("gerado_em", -1).to_list(length=100)
    
    return resumos


# ==================== AGENDAMENTO AUTOMÁTICO ====================

@router.get("/importacao/agendamento")
async def get_agendamento(current_user: Dict = Depends(get_current_user)):
    """Obtém configuração de agendamento"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    config = await db.agendamentos_rpa.find_one(
        {"parceiro_id": parceiro_id},
        {"_id": 0}
    )
    
    if not config:
        return {
            "ativo": False,
            "dia_semana": 0,
            "hora": 8,
            "plataformas": [],
            "enviar_whatsapp": True,
            "enviar_email": True
        }
    
    return config


@router.put("/importacao/agendamento")
async def update_agendamento(
    config: AgendamentoConfig,
    current_user: Dict = Depends(get_current_user)
):
    """Atualiza configuração de agendamento"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    config_data = {
        "parceiro_id": parceiro_id,
        "ativo": config.ativo,
        "dia_semana": config.dia_semana,
        "hora": config.hora,
        "plataformas": config.plataformas,
        "enviar_whatsapp": config.enviar_whatsapp,
        "enviar_email": config.enviar_email,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user["id"]
    }
    
    await db.agendamentos_rpa.update_one(
        {"parceiro_id": parceiro_id},
        {"$set": config_data},
        upsert=True
    )
    
    return {"message": "Agendamento atualizado com sucesso"}


@router.post("/importacao/executar-agendado")
async def executar_importacao_agendada(
    plataforma: str,
    current_user: Dict = Depends(get_current_user)
):
    """Executa manualmente uma importação agendada (trigger do script RPA)"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    # Buscar script RPA da plataforma
    script = await db.rpa_scripts.find_one(
        {"slug": plataforma.lower(), "ativo": True},
        {"_id": 0}
    )
    
    if not script:
        raise HTTPException(status_code=404, detail=f"Script RPA para {plataforma} não encontrado")
    
    # Buscar credenciais do parceiro
    credenciais = await db.credenciais_plataformas.find_one(
        {"parceiro_id": parceiro_id, "plataforma": plataforma.lower()},
        {"_id": 0}
    )
    
    if not credenciais:
        raise HTTPException(status_code=400, detail=f"Credenciais de {plataforma} não configuradas")
    
    # Criar execução pendente
    execucao_id = str(uuid.uuid4())
    execucao = {
        "id": execucao_id,
        "parceiro_id": parceiro_id,
        "script_id": script["id"],
        "plataforma": plataforma,
        "status": "pendente",
        "tipo": "agendado",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.execucoes_rpa.insert_one(execucao)
    
    return {
        "success": True,
        "message": f"Execução de {plataforma} agendada",
        "execucao_id": execucao_id
    }


# ==================== ENVIO AUTOMÁTICO ====================

@router.post("/importacao/enviar-resumos/{importacao_id}")
async def enviar_resumos_importacao(
    importacao_id: str,
    via_whatsapp: bool = True,
    via_email: bool = True,
    current_user: Dict = Depends(get_current_user)
):
    """Envia resumos de uma importação para os motoristas"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    parceiro_id = get_parceiro_id(current_user)
    
    # Buscar resumos da importação
    resumos = await db.resumos_semanais_rpa.find(
        {"importacao_id": importacao_id},
        {"_id": 0}
    ).to_list(length=100)
    
    if not resumos:
        raise HTTPException(status_code=404, detail="Nenhum resumo encontrado para esta importação")
    
    resultados = {
        "total": len(resumos),
        "whatsapp_enviados": 0,
        "whatsapp_erros": 0,
        "email_enviados": 0,
        "email_erros": 0,
        "detalhes": []
    }
    
    # Importar serviços de envio
    if via_whatsapp:
        from routes.whatsapp_cloud import send_whatsapp_cloud_message
    
    if via_email:
        from utils.email_service import get_parceiro_email_service
    
    for resumo in resumos:
        detalhe = {"motorista": resumo["motorista"], "whatsapp": None, "email": None}
        
        # Buscar motorista na BD para obter telefone
        motorista = await db.motoristas.find_one(
            {"$or": [
                {"email": resumo["email"]},
                {"nome": resumo["motorista"]}
            ]},
            {"_id": 0, "telefone": 1, "whatsapp": 1, "phone": 1, "email": 1}
        )
        
        # Gerar mensagem
        metricas = resumo["metricas"]
        mensagem = f"""📊 *Resumo Semanal - Semana {resumo['semana']}/{resumo['ano']}*

Olá {resumo['motorista']}!

🚗 *{resumo['plataforma'].upper()}*

• Corridas: {metricas['corridas']}
• Valor Bruto: €{metricas['valor_bruto']:.2f}
• Comissão: €{metricas['comissao']:.2f}
• *Valor Líquido: €{metricas['valor_liquido']:.2f}*
• Bónus: €{metricas['bonus']:.2f}
• Gorjetas: €{metricas['gorjetas']:.2f}
• Dias trabalhados: {metricas['dias_trabalhados']}

_Mensagem automática TVDEFleet_"""
        
        # Enviar WhatsApp
        if via_whatsapp and motorista:
            telefone = motorista.get("whatsapp") or motorista.get("telefone") or motorista.get("phone")
            if telefone:
                try:
                    result = await send_whatsapp_cloud_message(telefone, mensagem, parceiro_id)
                    if result["success"]:
                        resultados["whatsapp_enviados"] += 1
                        detalhe["whatsapp"] = "enviado"
                    else:
                        resultados["whatsapp_erros"] += 1
                        detalhe["whatsapp"] = result.get("error", "erro")
                except Exception as e:
                    resultados["whatsapp_erros"] += 1
                    detalhe["whatsapp"] = str(e)
        
        # Enviar Email
        if via_email and (resumo.get("email") or (motorista and motorista.get("email"))):
            email_destino = resumo.get("email") or motorista.get("email")
            try:
                email_service = await get_parceiro_email_service(parceiro_id)
                if email_service:
                    # Converter mensagem para HTML simples
                    html_mensagem = mensagem.replace("*", "<strong>").replace("\n", "<br>")
                    result = await email_service.send_email(
                        to_email=email_destino,
                        subject=f"Resumo Semanal - Semana {resumo['semana']}/{resumo['ano']}",
                        html_content=f"<html><body>{html_mensagem}</body></html>"
                    )
                    if result.get("success"):
                        resultados["email_enviados"] += 1
                        detalhe["email"] = "enviado"
                    else:
                        resultados["email_erros"] += 1
                        detalhe["email"] = result.get("error", "erro")
            except Exception as e:
                resultados["email_erros"] += 1
                detalhe["email"] = str(e)
        
        resultados["detalhes"].append(detalhe)
    
    return resultados
