"""Utility functions for FleeTrack application"""

from .auth import (
    get_password_hash,
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    check_feature_access
)
from .database import get_database, get_client, close_database
from .helpers import (
    convert_image_to_pdf,
    save_uploaded_file,
    format_date,
    get_file_extension,
    is_image_file,
    is_pdf_file,
    generate_unique_filename,
    UPLOAD_DIR,
    MOTORISTAS_UPLOAD_DIR,
    PAGAMENTOS_UPLOAD_DIR,
    VEHICLE_DOCS_UPLOAD_DIR
)

__all__ = [
    # Auth
    'get_password_hash',
    'hash_password',
    'verify_password',
    'create_access_token',
    'get_current_user',
    'check_feature_access',
    # Database
    'get_database',
    'get_client',
    'close_database',
    # Helpers
    'convert_image_to_pdf',
    'save_uploaded_file',
    'format_date',
    'get_file_extension',
    'is_image_file',
    'is_pdf_file',
    'generate_unique_filename',
    'UPLOAD_DIR',
    'MOTORISTAS_UPLOAD_DIR',
    'PAGAMENTOS_UPLOAD_DIR',
    'VEHICLE_DOCS_UPLOAD_DIR'
]
