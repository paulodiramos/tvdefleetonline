"""Authentication and profile routes"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict
from datetime import datetime, timezone
import uuid

from models.user import User, UserCreate, UserLogin, TokenResponse, UserRole
from utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from utils.database import get_database

router = APIRouter()
db = get_database()


async def enviar_email_boas_vindas(user: Dict):
    """Send welcome email to new user"""
    role_labels = {
        "motorista": "Motorista",
        "parceiro": "Parceiro",
        "operacional": "Operacional",
        "gestao": "Gestor",
        "admin": "Administrador"
    }
    
    role_label = role_labels.get(user.get("role"), "Utilizador")
    
    # Get email config
    config = await db.configuracoes.find_one({"tipo": "email"}, {"_id": 0})
    email_from = config.get("email_contacto", "info@tvdefleet.com") if config else "info@tvdefleet.com"
    
    print(f"📧 ENVIAR EMAIL DE BOAS-VINDAS:")
    print(f"   Para: {user.get('email')}")
    print(f"   Nome: {user.get('name')}")
    print(f"   Role: {role_label}")
    
    # Queue email for sending
    await db.email_queue.insert_one({
        "to": user.get("email"),
        "from": email_from,
        "subject": f"Bem-vindo à TVDEFleet - Registo de {role_label}",
        "body": f"""
        Olá {user.get('name')},
        
        Bem-vindo à TVDEFleet!
        
        O seu registo como {role_label} foi recebido com sucesso.
        
        A nossa equipa irá analisar os seus dados e entrará em contacto em breve.
        Após aprovação, receberá as suas credenciais de acesso definitivas.
        
        Dados do registo:
        - Email: {user.get('email')}
        - Telefone: {user.get('phone', 'N/A')}
        - Data de registo: {user.get('created_at')}
        
        Se tiver alguma dúvida, entre em contacto connosco:
        Email: {email_from}
        Telefone: +351 912 345 678
        WhatsApp: https://wa.me/351912345678
        
        Obrigado,
        Equipa TVDEFleet
        """,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "tipo": "boas_vindas",
        "user_id": user.get("id")
    })


@router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    """Register a new user"""
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user_data.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["id"] = str(uuid.uuid4())
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    user_dict["approved"] = user_data.role == UserRole.ADMIN
    
    await db.users.insert_one(user_dict)
    
    # Send welcome email
    await enviar_email_boas_vindas(user_dict)
    
    user_dict.pop("password")
    if isinstance(user_dict["created_at"], str):
        user_dict["created_at"] = datetime.fromisoformat(user_dict["created_at"])
    
    return User(**user_dict)


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login user"""
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user["role"] == UserRole.MOTORISTA and not user.get("approved", False):
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    token = create_access_token(user["id"], user["email"], user["role"])
    
    user.pop("password")
    if isinstance(user["created_at"], str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    
    return TokenResponse(access_token=token, user=User(**user))


@router.get("/auth/me", response_model=User)
async def get_me(current_user: Dict = Depends(get_current_user)):
    """Get current user info"""
    if isinstance(current_user["created_at"], str):
        current_user["created_at"] = datetime.fromisoformat(current_user["created_at"])
    return User(**current_user)


@router.put("/profile/update")
async def update_profile(update_data: Dict, current_user: Dict = Depends(get_current_user)):
    """Update user profile"""
    allowed_fields = ["name", "phone", "morada", "campos_customizados"]
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_dict})
    
    return {"message": "Profile updated successfully"}


@router.post("/profile/change-password")
async def change_password(
    password_data: Dict,
    current_user: Dict = Depends(get_current_user)
):
    """Change user password"""
    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Missing password fields")
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not verify_password(current_password, user["password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    hashed_new = hash_password(new_password)
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"password": hashed_new}})
    
    return {"message": "Password changed successfully"}


@router.get("/profile/permissions")
async def get_permissions(current_user: Dict = Depends(get_current_user)):
    """Get user permissions based on role and subscription"""
    permissions = {
        "can_add_motoristas": False,
        "can_add_vehicles": False,
        "can_view_financeiro": False,
        "can_create_contracts": False,
        "can_manage_planos": False,
        "can_view_alertas": False,
        "max_motoristas": 0,
        "max_vehicles": 0
    }
    
    role = current_user["role"]
    
    if role == UserRole.ADMIN or role == UserRole.GESTAO:
        # Full permissions
        permissions.update({
            "can_add_motoristas": True,
            "can_add_vehicles": True,
            "can_view_financeiro": True,
            "can_create_contracts": True,
            "can_manage_planos": True,
            "can_view_alertas": True,
            "max_motoristas": 999,
            "max_vehicles": 999
        })
    elif role == UserRole.PARCEIRO:
        # Parceiro has access based on their setup
        permissions.update({
            "can_add_motoristas": True,
            "can_add_vehicles": True,
            "can_view_financeiro": True,
            "can_create_contracts": True,
            "can_manage_planos": False,
            "can_view_alertas": True,
            "max_motoristas": 999,
            "max_vehicles": 999
        })
    elif role == UserRole.OPERACIONAL:
        # Check subscription for operacional
        subscription_id = current_user.get("subscription_id")
        if subscription_id:
            subscription = await db.motorista_plano_assinaturas.find_one(
                {"id": subscription_id}, {"_id": 0}
            )
            if subscription and subscription.get("status") == "ativo":
                plano_id = subscription.get("plano_id")
                plano = await db.planos_motorista.find_one({"id": plano_id}, {"_id": 0})
                if plano:
                    permissions.update({
                        "can_add_motoristas": plano.get("permite_adicionar_motoristas", False),
                        "can_add_vehicles": plano.get("permite_adicionar_veiculos", False),
                        "can_view_financeiro": plano.get("acesso_relatorios_financeiros", False),
                        "can_create_contracts": plano.get("permite_criar_contratos", False),
                        "can_view_alertas": plano.get("alertas_manutencao", False),
                        "max_motoristas": plano.get("limite_motoristas", 0),
                        "max_vehicles": plano.get("limite_veiculos", 0)
                    })
    
    return permissions


@router.post("/auth/forgot-password")
async def forgot_password(email_data: Dict):
    """Send password reset email with temporary password"""
    import random
    import string
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    import bcrypt
    
    email = email_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email é obrigatório")
    
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Email não encontrado no sistema")
    
    # Generate temporary password (8 characters: letters + numbers)
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
    
    # Hash the temporary password
    hashed_password = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt())
    
    # Update user password
    await db.users.update_one(
        {"email": email},
        {"$set": {
            "password": hashed_password.decode('utf-8'),
            "senha_provisoria": True,
            "senha_provisoria_criada_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Also update in motoristas if exists
    await db.motoristas.update_one(
        {"email": email},
        {"$set": {"senha_provisoria": True}}
    )
    
    # Enviar email com senha temporária
    email_sent = False
    try:
        smtp_host = os.environ.get('SMTP_HOST', 'smtp.tvdefleet.com')
        smtp_port = int(os.environ.get('SMTP_PORT', 587))
        smtp_user = os.environ.get('SMTP_USER', 'info@tvdefleet.com')
        smtp_password = os.environ.get('SMTP_PASSWORD', '')
        from_email = os.environ.get('SMTP_FROM_EMAIL', 'info@tvdefleet.com')
        from_name = os.environ.get('SMTP_FROM_NAME', 'TVDEFleet')
        
        if smtp_password:
            user_name = user.get("name", "").split()[0] if user.get("name") else None
            
            # HTML Email
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #2563eb, #0891b2); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }}
                    .password-box {{ background: #1e293b; color: #22c55e; padding: 15px 25px; border-radius: 8px; font-family: monospace; font-size: 24px; text-align: center; margin: 20px 0; letter-spacing: 2px; }}
                    .warning {{ background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }}
                    .footer {{ text-align: center; padding: 20px; color: #64748b; font-size: 12px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚗 TVDEFleet</h1>
                        <p>Gestão Inteligente de Frotas</p>
                    </div>
                    <div class="content">
                        <h2>Olá{f', {user_name}' if user_name else ''}!</h2>
                        <p>Recebemos um pedido de recuperação de senha para a sua conta.</p>
                        <p>A sua <strong>senha temporária</strong> é:</p>
                        
                        <div class="password-box">
                            {temp_password}
                        </div>
                        
                        <div class="warning">
                            <strong>⚠️ Importante:</strong>
                            <ul>
                                <li>Esta senha é temporária e deve ser alterada no primeiro login</li>
                                <li>Se não solicitou esta recuperação, ignore este email</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© {datetime.now().year} TVDEFleet - Todos os direitos reservados</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = "🔐 TVDEFleet - Recuperação de Senha"
            msg['From'] = f"{from_name} <{from_email}>"
            msg['To'] = email
            msg.attach(MIMEText(html_body, 'html', 'utf-8'))
            
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(from_email, email, msg.as_string())
            
            email_sent = True
            print(f"✅ Email de recuperação enviado para {email}")
            
    except Exception as e:
        print(f"❌ Erro ao enviar email: {e}")
    
    if email_sent:
        return {
            "message": "Email de recuperação enviado com sucesso!",
            "email": email,
            "email_sent": True,
            "instructions": "Verifique a sua caixa de entrada (e spam) para obter a senha temporária."
        }
    else:
        return {
            "message": "Senha temporária gerada (email não enviado - verifique configuração SMTP)",
            "temp_password": temp_password,
            "email": email,
            "email_sent": False,
            "instructions": "Use esta senha temporária para fazer login."
        }
