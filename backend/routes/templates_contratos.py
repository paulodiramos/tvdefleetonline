"""
Templates de Contratos Router
Handles contract templates management for parceiros
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
import logging
import os

from utils.database import get_database
from utils.auth import get_current_user

router = APIRouter(prefix="/templates-contratos", tags=["templates-contratos"])
db = get_database()
logger = logging.getLogger(__name__)


# ==================== CRUD ====================

@router.get("")
async def get_templates_contratos(current_user: Dict = Depends(get_current_user)):
    """Get contract templates for the current user (parceiro only)"""
    user_role = current_user["role"]
    if user_role != "parceiro" and str(user_role) != "UserRole.PARCEIRO":
        raise HTTPException(status_code=403, detail="Apenas parceiros podem acessar templates")
    
    templates = await db.templates_contrato.find(
        {"parceiro_id": current_user["id"]},
        {"_id": 0}
    ).to_list(length=None)
    return templates


@router.post("")
async def create_template_contrato(
    template_data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new contract template"""
    user_role = current_user["role"]
    if user_role != "parceiro" and str(user_role) != "UserRole.PARCEIRO":
        raise HTTPException(status_code=403, detail="Apenas parceiros podem criar templates")
    
    template = {
        "id": str(uuid4()),
        "parceiro_id": current_user["id"],
        "nome": template_data.get("nome"),
        "descricao": template_data.get("descricao", ""),
        "texto_template": template_data.get("texto_template"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.templates_contrato.insert_one(template)
    logger.info(f"Template criado: {template['nome']} para parceiro {current_user['id']}")
    return {"message": "Template criado com sucesso", "id": template["id"]}


@router.get("/{template_id}")
async def get_template_contrato(
    template_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get a specific contract template"""
    user_role = current_user["role"]
    if user_role != "parceiro" and str(user_role) != "UserRole.PARCEIRO":
        raise HTTPException(status_code=403, detail="Apenas parceiros podem acessar templates")
    
    template = await db.templates_contrato.find_one(
        {"id": template_id, "parceiro_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    
    return template


@router.put("/{template_id}")
async def update_template_contrato(
    template_id: str,
    template_data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Update a contract template"""
    user_role = current_user["role"]
    if user_role != "parceiro" and str(user_role) != "UserRole.PARCEIRO":
        raise HTTPException(status_code=403, detail="Apenas parceiros podem editar templates")
    
    # Check if template exists and belongs to user
    template = await db.templates_contrato.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    
    if template["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sem permissão para editar este template")
    
    update_data = {
        "nome": template_data.get("nome"),
        "descricao": template_data.get("descricao", ""),
        "texto_template": template_data.get("texto_template"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.templates_contrato.update_one(
        {"id": template_id},
        {"$set": update_data}
    )
    
    logger.info(f"Template {template_id} atualizado")
    return {"message": "Template atualizado com sucesso"}


@router.delete("/{template_id}")
async def delete_template_contrato(
    template_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a contract template"""
    user_role = current_user["role"]
    if user_role != "parceiro" and str(user_role) != "UserRole.PARCEIRO":
        raise HTTPException(status_code=403, detail="Apenas parceiros podem excluir templates")
    
    # Check if template exists and belongs to user
    template = await db.templates_contrato.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    
    if template["parceiro_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sem permissão para excluir este template")
    
    await db.templates_contrato.delete_one({"id": template_id})
    logger.info(f"Template {template_id} excluído")
    return {"message": "Template excluído com sucesso"}


# ==================== PDF ====================

@router.get("/{template_id}/download-pdf")
async def download_template_pdf(
    template_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Download template as PDF"""
    if current_user["role"] != "parceiro":
        raise HTTPException(status_code=403, detail="Apenas parceiros podem baixar templates")
    
    template = await db.templates_contrato.find_one(
        {"id": template_id, "parceiro_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        # Create PDF directory
        pdf_dir = "/app/uploads/templates_pdf"
        os.makedirs(pdf_dir, exist_ok=True)
        
        pdf_path = f"{pdf_dir}/template_{template_id}.pdf"
        
        doc = SimpleDocTemplate(pdf_path, pagesize=A4)
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, alignment=1)
        elements.append(Paragraph(template.get("nome", "Template de Contrato"), title_style))
        elements.append(Spacer(1, 20))
        
        # Description
        if template.get("descricao"):
            elements.append(Paragraph(f"<i>{template.get('descricao')}</i>", styles['Normal']))
            elements.append(Spacer(1, 15))
        
        # Content
        texto = template.get("texto_template", "")
        # Split by paragraphs
        paragraphs = texto.split('\n\n')
        for para in paragraphs:
            if para.strip():
                elements.append(Paragraph(para.replace('\n', '<br/>'), styles['Normal']))
                elements.append(Spacer(1, 10))
        
        doc.build(elements)
        
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=f"template_{template.get('nome', 'contrato')}.pdf"
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(e)}")


# ==================== PREVIEW ====================

@router.post("/{template_id}/preview")
async def preview_template(
    template_id: str,
    dados: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    """Preview template with sample data"""
    if current_user["role"] != "parceiro":
        raise HTTPException(status_code=403, detail="Apenas parceiros podem visualizar templates")
    
    template = await db.templates_contrato.find_one(
        {"id": template_id, "parceiro_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    
    texto = template.get("texto_template", "")
    
    # Replace placeholders with sample data
    for key, value in dados.items():
        placeholder = f"{{{{{key}}}}}"
        texto = texto.replace(placeholder, str(value))
    
    return {
        "nome": template.get("nome"),
        "texto_preview": texto
    }


# ==================== DUPLICAR ====================

@router.post("/{template_id}/duplicar")
async def duplicar_template(
    template_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Duplicate a template"""
    if current_user["role"] != "parceiro":
        raise HTTPException(status_code=403, detail="Apenas parceiros podem duplicar templates")
    
    template = await db.templates_contrato.find_one(
        {"id": template_id, "parceiro_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    
    novo_template = {
        "id": str(uuid4()),
        "parceiro_id": current_user["id"],
        "nome": f"{template.get('nome')} (Cópia)",
        "descricao": template.get("descricao", ""),
        "texto_template": template.get("texto_template"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.templates_contrato.insert_one(novo_template)
    logger.info(f"Template {template_id} duplicado como {novo_template['id']}")
    
    return {"message": "Template duplicado com sucesso", "id": novo_template["id"]}
