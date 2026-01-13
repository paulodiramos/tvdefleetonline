"""Email sending utilities using partner SMTP configuration"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Dict, Any, Optional, List
import logging
import ssl

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails using partner SMTP configuration"""
    
    def __init__(self, smtp_config: Dict[str, Any]):
        """
        Initialize email service with SMTP configuration
        
        smtp_config should contain:
        - smtp_host: SMTP server hostname
        - smtp_port: SMTP server port
        - smtp_usuario: SMTP username
        - smtp_password: SMTP password
        - smtp_from_email: From email address
        - smtp_from_name: From display name
        - smtp_use_tls: Whether to use TLS
        """
        self.host = smtp_config.get('smtp_host')
        self.port = int(smtp_config.get('smtp_port', 587))
        self.username = smtp_config.get('smtp_usuario')
        self.password = smtp_config.get('smtp_password')
        self.from_email = smtp_config.get('smtp_from_email')
        self.from_name = smtp_config.get('smtp_from_name', 'TVDEFleet')
        self.use_tls = smtp_config.get('smtp_use_tls', True)
    
    def validate_config(self) -> bool:
        """Validate SMTP configuration"""
        required = [self.host, self.port, self.username, self.password, self.from_email]
        return all(required)
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Send an email using the configured SMTP server
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            body_html: HTML body content
            body_text: Plain text body (optional, will be generated from HTML if not provided)
            cc: List of CC addresses
            bcc: List of BCC addresses
            attachments: List of attachments [{filename: str, content: bytes, mimetype: str}]
        
        Returns:
            Dict with success status and message
        """
        if not self.validate_config():
            return {"success": False, "error": "Configuração SMTP incompleta"}
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            if cc:
                msg['Cc'] = ', '.join(cc)
            
            # Add text body
            if body_text:
                msg.attach(MIMEText(body_text, 'plain', 'utf-8'))
            
            # Add HTML body
            msg.attach(MIMEText(body_html, 'html', 'utf-8'))
            
            # Add attachments
            if attachments:
                for attachment in attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment['content'])
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename="{attachment["filename"]}"'
                    )
                    msg.attach(part)
            
            # Calculate all recipients
            all_recipients = [to_email]
            if cc:
                all_recipients.extend(cc)
            if bcc:
                all_recipients.extend(bcc)
            
            # Connect and send
            if self.use_tls:
                context = ssl.create_default_context()
                server = smtplib.SMTP(self.host, self.port)
                server.starttls(context=context)
            else:
                server = smtplib.SMTP_SSL(self.host, self.port)
            
            server.login(self.username, self.password)
            server.sendmail(self.from_email, all_recipients, msg.as_string())
            server.quit()
            
            logger.info(f"✓ Email sent successfully to {to_email}")
            return {"success": True, "message": "Email enviado com sucesso"}
            
        except smtplib.SMTPAuthenticationError:
            logger.error("SMTP Authentication failed")
            return {"success": False, "error": "Falha na autenticação SMTP. Verifique as credenciais."}
        except smtplib.SMTPConnectError:
            logger.error("SMTP Connection failed")
            return {"success": False, "error": "Não foi possível conectar ao servidor SMTP."}
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            return {"success": False, "error": f"Erro ao enviar email: {str(e)}"}


async def get_parceiro_email_service(db, parceiro_id: str) -> Optional[EmailService]:
    """
    Get EmailService configured with partner SMTP settings
    
    Args:
        db: Database instance
        parceiro_id: Partner ID
    
    Returns:
        EmailService instance or None if not configured
    """
    parceiro = await db.parceiros.find_one({"id": parceiro_id}, {"_id": 0})
    if not parceiro:
        parceiro = await db.users.find_one({"id": parceiro_id, "role": "parceiro"}, {"_id": 0})
    
    if not parceiro:
        return None
    
    smtp_config = parceiro.get("config_smtp", {})
    if not smtp_config.get("smtp_host") or not smtp_config.get("smtp_password"):
        return None
    
    return EmailService(smtp_config)


async def send_email_to_motorista(
    db,
    parceiro_id: str,
    motorista_id: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send email to a motorista using partner SMTP
    
    Args:
        db: Database instance
        parceiro_id: Partner ID
        motorista_id: Motorista ID
        subject: Email subject
        body_html: HTML body content
        body_text: Plain text body
    
    Returns:
        Dict with success status
    """
    # Get motorista email
    motorista = await db.motoristas.find_one({"id": motorista_id}, {"_id": 0, "email": 1, "name": 1})
    if not motorista or not motorista.get("email"):
        return {"success": False, "error": "Motorista não encontrado ou sem email"}
    
    # Get email service
    email_service = await get_parceiro_email_service(db, parceiro_id)
    if not email_service:
        return {"success": False, "error": "SMTP não configurado para este parceiro"}
    
    # Send email
    result = email_service.send_email(
        to_email=motorista["email"],
        subject=subject,
        body_html=body_html,
        body_text=body_text
    )
    
    # Log the email
    if result["success"]:
        await db.email_log.insert_one({
            "parceiro_id": parceiro_id,
            "motorista_id": motorista_id,
            "to_email": motorista["email"],
            "subject": subject,
            "status": "sent",
            "sent_at": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
        })
    
    return result


# Email templates
def get_email_template_relatorio_semanal(motorista_name: str, periodo: str, total_ganhos: float, total_despesas: float, liquido: float) -> str:
    """Generate HTML template for weekly report email"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #1e40af; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; background: #f8f9fa; }}
            .summary {{ background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }}
            .amount {{ font-size: 24px; font-weight: bold; }}
            .green {{ color: #16a34a; }}
            .red {{ color: #dc2626; }}
            .blue {{ color: #1e40af; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>TVDEFleet</h1>
                <p>Relatório Semanal</p>
            </div>
            <div class="content">
                <p>Olá <strong>{motorista_name}</strong>,</p>
                <p>Segue o seu relatório semanal referente ao período <strong>{periodo}</strong>:</p>
                
                <div class="summary">
                    <h3>Resumo Financeiro</h3>
                    <p>Ganhos Brutos: <span class="amount green">€{total_ganhos:.2f}</span></p>
                    <p>Total Despesas: <span class="amount red">€{total_despesas:.2f}</span></p>
                    <p>Valor Líquido: <span class="amount blue">€{liquido:.2f}</span></p>
                </div>
                
                <p>Para ver o relatório completo, aceda à sua conta na plataforma TVDEFleet.</p>
                
                <p>Boas viagens!</p>
            </div>
            <div class="footer">
                <p>Este email foi enviado automaticamente pela plataforma TVDEFleet.</p>
                <p>Se não deseja receber estes emails, contacte o seu parceiro.</p>
            </div>
        </div>
    </body>
    </html>
    """


def get_email_template_documento_expirando(motorista_name: str, documento_tipo: str, data_expiracao: str) -> str:
    """Generate HTML template for expiring document email"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #f97316; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; background: #f8f9fa; }}
            .alert {{ background: #fef3cd; border: 1px solid #f97316; padding: 15px; margin: 15px 0; border-radius: 8px; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚠️ Alerta de Documento</h1>
            </div>
            <div class="content">
                <p>Olá <strong>{motorista_name}</strong>,</p>
                
                <div class="alert">
                    <h3>Documento a Expirar</h3>
                    <p><strong>Tipo:</strong> {documento_tipo}</p>
                    <p><strong>Data de Expiração:</strong> {data_expiracao}</p>
                </div>
                
                <p>Por favor, renove o documento o mais rapidamente possível para evitar interrupções na sua atividade.</p>
                
                <p>Aceda à plataforma TVDEFleet para submeter o novo documento.</p>
            </div>
            <div class="footer">
                <p>Este email foi enviado automaticamente pela plataforma TVDEFleet.</p>
            </div>
        </div>
    </body>
    </html>
    """
