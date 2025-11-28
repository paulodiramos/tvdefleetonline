"""Helper utilities for FleeTrack application"""

from pathlib import Path
from datetime import datetime
from typing import Optional
import logging
import mimetypes
from fastapi import UploadFile, HTTPException
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

# Upload directories
ROOT_DIR = Path(__file__).parent.parent
UPLOAD_DIR = ROOT_DIR / "uploads"
MOTORISTAS_UPLOAD_DIR = UPLOAD_DIR / "motoristas"
PAGAMENTOS_UPLOAD_DIR = UPLOAD_DIR / "pagamentos"
VEHICLE_DOCS_UPLOAD_DIR = UPLOAD_DIR / "vehicle_documents"

# Ensure directories exist
UPLOAD_DIR.mkdir(exist_ok=True)
MOTORISTAS_UPLOAD_DIR.mkdir(exist_ok=True)
PAGAMENTOS_UPLOAD_DIR.mkdir(exist_ok=True)
VEHICLE_DOCS_UPLOAD_DIR.mkdir(exist_ok=True)


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
        logging.error(f"Error converting image to PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to convert image to PDF: {str(e)}")


async def save_uploaded_file(file: UploadFile, destination_dir: Path, filename: str) -> Path:
    """Save uploaded file to destination directory"""
    try:
        file_path = destination_dir / filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        return file_path
    except Exception as e:
        logging.error(f"Error saving file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


def format_date(date_str: Optional[str], format: str = "%d/%m/%Y") -> str:
    """Format date string to specified format"""
    if not date_str:
        return ""
    
    try:
        date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return date_obj.strftime(format)
    except (ValueError, AttributeError):
        return date_str


def get_file_extension(filename: str) -> str:
    """Get file extension from filename"""
    return Path(filename).suffix.lower()


def is_image_file(filename: str) -> bool:
    """Check if file is an image"""
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    return get_file_extension(filename) in image_extensions


def is_pdf_file(filename: str) -> bool:
    """Check if file is a PDF"""
    return get_file_extension(filename) == '.pdf'


def generate_unique_filename(original_filename: str, prefix: str = "") -> str:
    """Generate unique filename with timestamp"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    extension = get_file_extension(original_filename)
    base_name = Path(original_filename).stem
    
    if prefix:
        return f"{prefix}_{base_name}_{timestamp}{extension}"
    return f"{base_name}_{timestamp}{extension}"
