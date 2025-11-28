"""Authentication utilities for FleeTrack application"""

import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any
import os

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def hash_password(password: str) -> str:
    """Alias for get_password_hash for backward compatibility"""
    return get_password_hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def create_access_token(user_id: str, email: str, role: str) -> str:
    """Create a JWT access token"""
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db = None  # Will be injected
) -> Dict[str, Any]:
    """Get current user from JWT token"""
    if db is None:
        from .database import get_database
        db = get_database()
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def check_feature_access(user: Dict, feature_name: str, db = None) -> bool:
    """Check if user has access to a specific feature based on their subscription"""
    if db is None:
        from .database import get_database
        db = get_database()
    
    from ..models.user import UserRole
    
    # Admin always has access
    if user["role"] == UserRole.ADMIN:
        return True
    
    # Get user's subscription
    subscription_id = user.get("subscription_id")
    if not subscription_id:
        # No subscription = no access to premium features
        return False
    
    subscription = await db.subscriptions.find_one({"id": subscription_id, "status": "ativo"}, {"_id": 0})
    if not subscription:
        return False
    
    # Get plan features
    plano = await db.planos.find_one({"id": subscription["plano_id"]}, {"_id": 0})
    if not plano:
        return False
    
    return feature_name in plano.get("features", [])
