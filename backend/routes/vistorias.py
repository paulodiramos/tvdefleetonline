"""
Vistorias (Vehicle Inspections) Router
Handles vehicle inspections, damage reports, and PDF generation
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
import logging
import os

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/vehicles", tags=["vistorias"])
db = get_database()
logger = logging.getLogger(__name__)


class UserRole:
    ADMIN = "admin"
    GESTAO = "gestao"
    PARCEIRO = "parceiro"
    MOTORISTA = "motorista"


# ==================== FICHA DE VISTORIA PDF ====================

@router.get("/vistoria-template-pdf")
async def download_vistoria_template_generic(
    current_user: Dict = Depends(get_current_user)
):
    """Generate generic PDF template for manual inspection notes (without specific vehicle)"""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import cm
    import io
    
    user_role = current_user["role"]
    allowed_roles = [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, "admin", "gestao", "parceiro"]
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create PDF in memory
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Header
    c.setFont("Helvetica-Bold", 18)
    c.drawString(2*cm, height - 2*cm, "FICHA DE VISTORIA - APONTAMENTOS")
    
    # Vehicle info (blank for manual fill)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2*cm, height - 3.5*cm, "Dados do Veículo:")
    c.setFont("Helvetica", 11)
    c.drawString(2*cm, height - 4.2*cm, "Matrícula: _______________________")
    c.drawString(10*cm, height - 4.2*cm, "Marca: _______________________")
    c.drawString(2*cm, height - 4.9*cm, "Modelo: _______________________")
    c.drawString(10*cm, height - 4.9*cm, "Ano: __________")
    c.drawString(2*cm, height - 5.6*cm, "Km Atual: _______________________")
    
    # Date and inspector
    c.drawString(2*cm, height - 6.5*cm, "Data da Vistoria: ____/____/________")
    c.drawString(10*cm, height - 6.5*cm, "Inspetor: _______________________")
    
    # Inspection checklist
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2*cm, height - 8*cm, "Lista de Verificação:")
    
    checklist_items = [
        "Pneus (pressão, desgaste, danos)",
        "Luzes (faróis, mínimos, piscas, travagem)",
        "Travões (estado, eficácia)",
        "Nível de óleo motor",
        "Nível líquido refrigeração",
        "Nível líquido travões",
        "Nível líquido limpa-vidros",
        "Bateria (estado, terminais)",
        "Escovas limpa-vidros",
        "Documentos (seguro, inspeção)",
        "Extintor (validade, estado)",
        "Triângulo de emergência",
        "Colete refletor",
        "Kit primeiros socorros",
        "Interior (limpeza, estado)",
        "Exterior (danos, pintura)",
    ]
    
    c.setFont("Helvetica", 10)
    y_pos = height - 9*cm
    for item in checklist_items:
        c.drawString(2*cm, y_pos, f"☐ {item}")
        c.drawString(12*cm, y_pos, "OK / NOK / N/A")
        y_pos -= 0.6*cm
    
    # Observations section
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2*cm, y_pos - 1*cm, "Observações / Anomalias Detetadas:")
    
    c.setFont("Helvetica", 10)
    for i in range(8):
        c.drawString(2*cm, y_pos - 1.8*cm - (i * 0.6*cm), "_" * 80)
    
    # Signature section
    y_pos = y_pos - 7*cm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(2*cm, y_pos, "Assinatura do Inspetor: _________________________")
    c.drawString(11*cm, y_pos, "Data: ____/____/________")
    
    # Footer
    c.setFont("Helvetica", 8)
    c.drawString(2*cm, 1.5*cm, f"Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M')} | TVDEFleet")
    
    c.save()
    buffer.seek(0)
    
    filename = f"ficha_vistoria_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================== VISTORIAS CRUD ====================

@router.post("/{vehicle_id}/vistorias")
async def create_vistoria(
    vehicle_id: str,
    vistoria_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Create a new vehicle vistoria/inspection"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify vehicle exists
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Create vistoria
    vistoria_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    vistoria = {
        "id": vistoria_id,
        "veiculo_id": vehicle_id,
        "parceiro_id": vistoria_data.get("parceiro_id") or vehicle.get("parceiro_id"),
        "data_vistoria": vistoria_data.get("data_vistoria", now.isoformat()),
        "tipo": vistoria_data.get("tipo", "periodica"),
        "km_veiculo": vistoria_data.get("km_veiculo"),
        "responsavel_nome": current_user.get("name"),
        "responsavel_id": current_user.get("id"),
        "observacoes": vistoria_data.get("observacoes"),
        "estado_geral": vistoria_data.get("estado_geral", "bom"),
        "status": vistoria_data.get("status", "fechada"),
        "fotos": vistoria_data.get("fotos", []),
        "itens_verificados": vistoria_data.get("itens_verificados", {}),
        "danos_encontrados": vistoria_data.get("danos_encontrados", []),
        "pdf_relatorio": None,
        "assinatura_responsavel": vistoria_data.get("assinatura_responsavel"),
        "assinatura_motorista": vistoria_data.get("assinatura_motorista"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.vistorias.insert_one(vistoria)
    
    # Update vehicle with next vistoria date if provided
    if vistoria_data.get("proxima_vistoria"):
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {"proxima_vistoria": vistoria_data.get("proxima_vistoria")}}
        )
    
    logger.info(f"Vistoria created: {vistoria_id} for vehicle {vehicle_id}")
    return {"message": "Vistoria created successfully", "vistoria_id": vistoria_id}


@router.get("/{vehicle_id}/vistorias")
async def get_vehicle_vistorias(
    vehicle_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get all vistorias for a vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vistorias = await db.vistorias.find(
        {"veiculo_id": vehicle_id},
        {"_id": 0}
    ).sort("data_vistoria", -1).to_list(100)
    
    return vistorias


@router.get("/{vehicle_id}/vistorias/{vistoria_id}")
async def get_vistoria(
    vehicle_id: str,
    vistoria_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get a specific vistoria"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vistoria = await db.vistorias.find_one(
        {"id": vistoria_id, "veiculo_id": vehicle_id},
        {"_id": 0}
    )
    
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    return vistoria


@router.put("/{vehicle_id}/vistorias/{vistoria_id}")
async def update_vistoria(
    vehicle_id: str,
    vistoria_id: str,
    vistoria_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Update a vistoria"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vistoria_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.vistorias.update_one(
        {"id": vistoria_id, "veiculo_id": vehicle_id},
        {"$set": vistoria_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    return {"message": "Vistoria updated successfully"}


@router.delete("/{vehicle_id}/vistorias/{vistoria_id}")
async def delete_vistoria(
    vehicle_id: str,
    vistoria_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a vistoria"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.vistorias.delete_one(
        {"id": vistoria_id, "veiculo_id": vehicle_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    return {"message": "Vistoria deleted successfully"}


# ==================== FOTOS DE VISTORIA ====================

@router.post("/{vehicle_id}/vistorias/{vistoria_id}/upload-foto")
async def upload_vistoria_foto(
    vehicle_id: str,
    vistoria_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload a photo to a vistoria"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify vistoria exists
    vistoria = await db.vistorias.find_one({"id": vistoria_id, "veiculo_id": vehicle_id})
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    # Save file
    upload_dir = f"/app/uploads/vistorias/{vistoria_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_id = str(uuid.uuid4())
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    file_path = f"{upload_dir}/{file_id}.{file_ext}"
    
    content = await file.read()
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Add photo reference to vistoria
    foto_info = {
        "id": file_id,
        "filename": file.filename,
        "path": file_path,
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vistorias.update_one(
        {"id": vistoria_id},
        {"$push": {"fotos": foto_info}}
    )
    
    return {"message": "Photo uploaded", "foto_id": file_id}


# ==================== DANOS ====================

@router.post("/{vehicle_id}/vistorias/{vistoria_id}/adicionar-dano")
async def adicionar_dano_vistoria(
    vehicle_id: str,
    vistoria_id: str,
    dano_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Add a damage report to a vistoria"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vistoria = await db.vistorias.find_one({"id": vistoria_id, "veiculo_id": vehicle_id})
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    dano = {
        "id": str(uuid.uuid4()),
        "tipo": dano_data.get("tipo", "outro"),
        "descricao": dano_data.get("descricao"),
        "localizacao": dano_data.get("localizacao"),
        "gravidade": dano_data.get("gravidade", "baixa"),  # baixa, media, alta
        "fotos": dano_data.get("fotos", []),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vistorias.update_one(
        {"id": vistoria_id},
        {"$push": {"danos_encontrados": dano}}
    )
    
    return {"message": "Dano adicionado", "dano_id": dano["id"]}


# ==================== PDF E EMAIL ====================

@router.post("/{vehicle_id}/vistorias/{vistoria_id}/gerar-pdf")
async def gerar_pdf_vistoria(
    vehicle_id: str,
    vistoria_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Generate PDF report for a vistoria"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vistoria = await db.vistorias.find_one({"id": vistoria_id, "veiculo_id": vehicle_id}, {"_id": 0})
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        # Create PDF directory
        pdf_dir = "/app/uploads/vistorias_pdf"
        os.makedirs(pdf_dir, exist_ok=True)
        
        pdf_path = f"{pdf_dir}/vistoria_{vistoria_id}.pdf"
        
        doc = SimpleDocTemplate(pdf_path, pagesize=A4)
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1)
        elements.append(Paragraph("Relatório de Vistoria", title_style))
        elements.append(Spacer(1, 20))
        
        # Vehicle info
        elements.append(Paragraph(f"<b>Veículo:</b> {vehicle.get('marca', '')} {vehicle.get('modelo', '')}", styles['Normal']))
        elements.append(Paragraph(f"<b>Matrícula:</b> {vehicle.get('matricula', '')}", styles['Normal']))
        elements.append(Paragraph(f"<b>Data:</b> {vistoria.get('data_vistoria', '')[:10]}", styles['Normal']))
        elements.append(Paragraph(f"<b>Responsável:</b> {vistoria.get('responsavel_nome', '')}", styles['Normal']))
        elements.append(Paragraph(f"<b>KM:</b> {vistoria.get('km_veiculo', 'N/A')}", styles['Normal']))
        elements.append(Paragraph(f"<b>Estado Geral:</b> {vistoria.get('estado_geral', 'N/A')}", styles['Normal']))
        elements.append(Spacer(1, 15))
        
        # Observations
        if vistoria.get("observacoes"):
            elements.append(Paragraph("<b>Observações:</b>", styles['Normal']))
            elements.append(Paragraph(vistoria.get("observacoes"), styles['Normal']))
            elements.append(Spacer(1, 15))
        
        # Damages
        danos = vistoria.get("danos_encontrados", [])
        if danos:
            elements.append(Paragraph("<b>Danos Encontrados:</b>", styles['Normal']))
            for dano in danos:
                elements.append(Paragraph(f"• {dano.get('tipo')}: {dano.get('descricao')} ({dano.get('gravidade')})", styles['Normal']))
        else:
            elements.append(Paragraph("<b>Nenhum dano encontrado.</b>", styles['Normal']))
        
        doc.build(elements)
        
        # Update vistoria with PDF path
        await db.vistorias.update_one(
            {"id": vistoria_id},
            {"$set": {"pdf_relatorio": pdf_path}}
        )
        
        return {"message": "PDF gerado com sucesso", "pdf_path": pdf_path}
        
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(e)}")


@router.get("/{vehicle_id}/vistorias/{vistoria_id}/download-pdf")
async def download_vistoria_pdf(
    vehicle_id: str,
    vistoria_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Download PDF report for a vistoria"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vistoria = await db.vistorias.find_one({"id": vistoria_id, "veiculo_id": vehicle_id}, {"_id": 0})
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    pdf_path = vistoria.get("pdf_relatorio")
    if not pdf_path or not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found. Generate it first.")
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"vistoria_{vistoria_id}.pdf"
    )


@router.post("/{vehicle_id}/vistorias/{vistoria_id}/enviar-email")
async def enviar_email_vistoria(
    vehicle_id: str,
    vistoria_id: str,
    email_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Send vistoria report via email"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vistoria = await db.vistorias.find_one({"id": vistoria_id, "veiculo_id": vehicle_id}, {"_id": 0})
    if not vistoria:
        raise HTTPException(status_code=404, detail="Vistoria not found")
    
    # Get parceiro email config
    parceiro_id = vistoria.get("parceiro_id") or current_user.get("parceiro_id") or current_user.get("id")
    
    from utils.email_service import enviar_email_com_anexo
    
    destinatario = email_data.get("destinatario")
    if not destinatario:
        raise HTTPException(status_code=400, detail="Destinatário não especificado")
    
    pdf_path = vistoria.get("pdf_relatorio")
    if not pdf_path or not os.path.exists(pdf_path):
        # Generate PDF first
        await gerar_pdf_vistoria(vehicle_id, vistoria_id, current_user)
        vistoria = await db.vistorias.find_one({"id": vistoria_id}, {"_id": 0})
        pdf_path = vistoria.get("pdf_relatorio")
    
    try:
        resultado = await enviar_email_com_anexo(
            db=db,
            parceiro_id=parceiro_id,
            destinatario=destinatario,
            assunto=f"Relatório de Vistoria - {vistoria_id[:8]}",
            corpo=f"Segue em anexo o relatório de vistoria do veículo.",
            anexo_path=pdf_path
        )
        return resultado
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar email: {str(e)}")


# ==================== AGENDAMENTOS DE VISTORIA ====================

@router.post("/{vehicle_id}/agendar-vistoria")
async def agendar_vistoria(
    vehicle_id: str,
    agendamento_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Schedule a new vistoria for a vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    agendamento_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    agendamento = {
        "id": agendamento_id,
        "veiculo_id": vehicle_id,
        "parceiro_id": vehicle.get("parceiro_id"),
        "data_agendada": agendamento_data.get("data_agendada"),
        "tipo": agendamento_data.get("tipo", "periodica"),
        "observacoes": agendamento_data.get("observacoes"),
        "status": "agendada",  # agendada, realizada, cancelada
        "created_by": current_user.get("id"),
        "created_at": now.isoformat()
    }
    
    await db.agendamentos_vistoria.insert_one(agendamento)
    
    # Update vehicle
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"proxima_vistoria": agendamento_data.get("data_agendada")}}
    )
    
    return {"message": "Vistoria agendada", "agendamento_id": agendamento_id}


@router.get("/{vehicle_id}/agendamentos-vistoria")
async def get_agendamentos_vistoria(
    vehicle_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get scheduled vistorias for a vehicle"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO, UserRole.MOTORISTA]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    agendamentos = await db.agendamentos_vistoria.find(
        {"veiculo_id": vehicle_id},
        {"_id": 0}
    ).sort("data_agendada", -1).to_list(50)
    
    return agendamentos
