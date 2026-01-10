"""File handling utilities for FleeTrack application"""

import shutil
import logging
from pathlib import Path
from typing import Dict
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from fastapi import UploadFile, HTTPException

logger = logging.getLogger(__name__)

# Root directory
ROOT_DIR = Path(__file__).parent.parent


def safe_parse_date(date_str: str, format: str = "%Y-%m-%d"):
    """Safely parse date string, return None if empty or invalid"""
    from datetime import datetime
    if not date_str or not date_str.strip():
        return None
    try:
        return datetime.strptime(date_str.strip(), format)
    except (ValueError, TypeError):
        return None


async def convert_image_to_pdf(image_path: Path, output_path: Path) -> Path:
    """Convert an image file to PDF format"""
    try:
        img = Image.open(image_path)
        
        # Convert RGBA to RGB if necessary
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        
        # Get image dimensions
        img_width, img_height = img.size
        
        # Calculate scaling to fit A4 page
        a4_width, a4_height = A4
        scale = min(a4_width / img_width, a4_height / img_height) * 0.9
        
        new_width = img_width * scale
        new_height = img_height * scale
        
        # Create PDF
        c = canvas.Canvas(str(output_path), pagesize=A4)
        
        # Center image on page
        x = (a4_width - new_width) / 2
        y = (a4_height - new_height) / 2
        
        c.drawImage(str(image_path), x, y, width=new_width, height=new_height)
        c.save()
        
        return output_path
    except Exception as e:
        logger.error(f"Error converting image to PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to convert image to PDF: {str(e)}")


async def save_uploaded_file(file: UploadFile, destination_dir: Path, filename: str) -> Path:
    """Save uploaded file to destination directory"""
    try:
        file_path = destination_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return file_path
    except Exception as e:
        logger.error(f"Error saving file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


async def process_uploaded_file(file: UploadFile, destination_dir: Path, file_id: str) -> Dict[str, str]:
    """
    Process uploaded file: save it and convert to PDF if it's an image
    Returns dict with 'original_path' and 'pdf_path' (if converted)
    """
    file_extension = Path(file.filename).suffix.lower()
    original_filename = f"{file_id}_original{file_extension}"
    
    # Save original file
    original_path = await save_uploaded_file(file, destination_dir, original_filename)
    
    result = {
        "original_path": str(original_path.relative_to(ROOT_DIR)),
        "pdf_path": None
    }
    
    # Check if file is an image
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.heic', '.heif'}
    
    if file_extension in image_extensions:
        # Convert image to PDF
        pdf_filename = f"{file_id}.pdf"
        pdf_path = destination_dir / pdf_filename
        
        await convert_image_to_pdf(original_path, pdf_path)
        result["pdf_path"] = str(pdf_path.relative_to(ROOT_DIR))
    elif file_extension == '.pdf':
        # If already PDF, just reference it
        result["pdf_path"] = result["original_path"]
    
    return result


async def merge_images_to_pdf_a4(image1_path: Path, image2_path: Path, output_pdf_path: Path):
    """Merge two images (frente e verso) into a single A4 PDF"""
    # A4 size in points (72 DPI)
    a4_width, a4_height = A4
    
    # Create PDF
    c = canvas.Canvas(str(output_pdf_path), pagesize=A4)
    
    # Process first image (frente) - Page 1
    img1 = Image.open(image1_path)
    img1_width, img1_height = img1.size
    
    # Calculate scaling to fit A4 while maintaining aspect ratio
    scale1 = min(a4_width / img1_width, a4_height / img1_height) * 0.9  # 90% to leave margins
    new_width1 = img1_width * scale1
    new_height1 = img1_height * scale1
    
    # Center on page
    x1 = (a4_width - new_width1) / 2
    y1 = (a4_height - new_height1) / 2
    
    c.drawImage(str(image1_path), x1, y1, new_width1, new_height1)
    c.showPage()
    
    # Process second image (verso) - Page 2
    img2 = Image.open(image2_path)
    img2_width, img2_height = img2.size
    
    scale2 = min(a4_width / img2_width, a4_height / img2_height) * 0.9
    new_width2 = img2_width * scale2
    new_height2 = img2_height * scale2
    
    x2 = (a4_width - new_width2) / 2
    y2 = (a4_height - new_height2) / 2
    
    c.drawImage(str(image2_path), x2, y2, new_width2, new_height2)
    c.save()
