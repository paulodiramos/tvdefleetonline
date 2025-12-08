"""
Email Service using SendGrid or SMTP
Handles email notifications and transactional emails
"""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending emails via SendGrid"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def get_email_config(self) -> Optional[Dict[str, Any]]:
        """Get email configuration from database"""
        try:
            config = await self.db.configuracoes_sistema.find_one(
                {"tipo": "email_comunicacoes"},
                {"_id": 0}
            )
            return config
        except Exception as e:
            logger.error(f"Error fetching email config: {e}")
            return None
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send email using SendGrid or SMTP
        Returns: {"success": bool, "message_id": str, "error": str}
        """
        try:
            # Get configuration
            config = await self.get_email_config()
            if not config or not config.get("enabled"):
                return {
                    "success": False,
                    "error": "Email service is not configured or disabled"
                }
            
            provider = config.get("provider", "sendgrid")
            
            if provider == "smtp":
                return await self._send_via_smtp(to_email, subject, html_content, plain_content, config)
            else:
                return await self._send_via_sendgrid(to_email, subject, html_content, plain_content, config)
        
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _send_via_sendgrid(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: Optional[str],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Send email via SendGrid"""
        try:
            api_key = config.get("api_key")
            sender_email = config.get("sender_email")
            sender_name = config.get("sender_name", "TVDEFleet")
            
            if not api_key or not sender_email:
                return {
                    "success": False,
                    "error": "SendGrid configuration is incomplete"
                }
            
            # Create SendGrid message
            message = Mail(
                from_email=Email(sender_email, sender_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            if plain_content:
                message.add_content(Content("text/plain", plain_content))
            
            # Send email
            sg = SendGridAPIClient(api_key)
            response = sg.send(message)
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"Email sent successfully to {to_email} via SendGrid")
                return {
                    "success": True,
                    "message_id": response.headers.get('X-Message-Id'),
                    "status_code": response.status_code
                }
            else:
                logger.error(f"SendGrid returned status code {response.status_code}")
                return {
                    "success": False,
                    "error": f"SendGrid returned status code {response.status_code}"
                }
        
        except Exception as e:
            logger.error(f"Error sending email via SendGrid: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _send_via_smtp(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: Optional[str],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Send email via SMTP"""
        try:
            smtp_host = config.get("smtp_host")
            smtp_port = config.get("smtp_port", 587)
            smtp_user = config.get("smtp_user")
            smtp_password = config.get("smtp_password")
            sender_email = config.get("sender_email")
            sender_name = config.get("sender_name", "TVDEFleet")
            use_tls = config.get("smtp_use_tls", True)
            
            if not all([smtp_host, smtp_user, smtp_password, sender_email]):
                return {
                    "success": False,
                    "error": "SMTP configuration is incomplete"
                }
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{sender_name} <{sender_email}>"
            msg['To'] = to_email
            
            # Add plain text and HTML parts
            if plain_content:
                part1 = MIMEText(plain_content, 'plain')
                msg.attach(part1)
            
            part2 = MIMEText(html_content, 'html')
            msg.attach(part2)
            
            # Send email
            if use_tls:
                server = smtplib.SMTP(smtp_host, smtp_port)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port)
            
            server.login(smtp_user, smtp_password)
            server.sendmail(sender_email, to_email, msg.as_string())
            server.quit()
            
            logger.info(f"Email sent successfully to {to_email} via SMTP")
            return {
                "success": True,
                "provider": "smtp"
            }
        
        except Exception as e:
            logger.error(f"Error sending email via SMTP: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_notification(
        self,
        to_email: str,
        notification_type: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send notification email based on type
        
        Types:
        - document_expiry: Documento a expirar
        - payment_confirmation: Confirmação de pagamento
        - weekly_report: Relatório semanal
        - system_alert: Alerta do sistema
        """
        templates = {
            "document_expiry": self._template_document_expiry,
            "payment_confirmation": self._template_payment_confirmation,
            "weekly_report": self._template_weekly_report,
            "system_alert": self._template_system_alert,
        }
        
        template_func = templates.get(notification_type)
        if not template_func:
            return {
                "success": False,
                "error": f"Unknown notification type: {notification_type}"
            }
        
        subject, html_content = template_func(data)
        return await self.send_email(to_email, subject, html_content)
    
    def _template_document_expiry(self, data: Dict[str, Any]) -> tuple:
        """Template for document expiry notification"""
        document_name = data.get("document_name", "Documento")
        expiry_date = data.get("expiry_date", "N/A")
        days_remaining = data.get("days_remaining", 0)
        
        subject = f"⚠️ Alerta: {document_name} a expirar em {days_remaining} dias"
        
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
                .alert-box {{ background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }}
                .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>⚠️ Alerta de Documento</h1>
                </div>
                <div class="content">
                    <p>Olá,</p>
                    <p>Este é um alerta automático do sistema TVDEFleet.</p>
                    
                    <div class="alert-box">
                        <strong>Documento a Expirar:</strong> {document_name}<br>
                        <strong>Data de Expiração:</strong> {expiry_date}<br>
                        <strong>Tempo Restante:</strong> {days_remaining} dias
                    </div>
                    
                    <p>Por favor, renove o documento o quanto antes para evitar problemas operacionais.</p>
                    
                    <a href="#" class="button">Aceder ao Sistema</a>
                </div>
                <div class="footer">
                    <p>Esta é uma mensagem automática. Por favor não responda a este email.</p>
                    <p>&copy; 2024 TVDEFleet - Sistema de Gestão de Frotas</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return subject, html
    
    def _template_payment_confirmation(self, data: Dict[str, Any]) -> tuple:
        """Template for payment confirmation"""
        amount = data.get("amount", 0)
        date = data.get("date", "N/A")
        reference = data.get("reference", "N/A")
        
        subject = "✅ Confirmação de Pagamento"
        
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
                .info-box {{ background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }}
                .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ Pagamento Confirmado</h1>
                </div>
                <div class="content">
                    <p>Olá,</p>
                    <p>O seu pagamento foi processado com sucesso.</p>
                    
                    <div class="info-box">
                        <strong>Valor:</strong> €{amount:.2f}<br>
                        <strong>Data:</strong> {date}<br>
                        <strong>Referência:</strong> {reference}
                    </div>
                    
                    <p>Obrigado por utilizar o TVDEFleet!</p>
                </div>
                <div class="footer">
                    <p>Esta é uma mensagem automática. Por favor não responda a este email.</p>
                    <p>&copy; 2024 TVDEFleet - Sistema de Gestão de Frotas</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return subject, html
    
    def _template_weekly_report(self, data: Dict[str, Any]) -> tuple:
        """Template for weekly report"""
        period = data.get("period", "N/A")
        total_earnings = data.get("total_earnings", 0)
        total_trips = data.get("total_trips", 0)
        
        subject = f"📊 Relatório Semanal - {period}"
        
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
                .stats {{ display: flex; justify-content: space-around; margin: 20px 0; }}
                .stat-box {{ text-align: center; padding: 15px; background: white; border-radius: 8px; flex: 1; margin: 0 5px; }}
                .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 Relatório Semanal</h1>
                    <p>{period}</p>
                </div>
                <div class="content">
                    <p>Olá,</p>
                    <p>Aqui está o resumo da sua semana:</p>
                    
                    <div class="stats">
                        <div class="stat-box">
                            <h3 style="color: #10b981; margin: 0;">€{total_earnings:.2f}</h3>
                            <p style="margin: 5px 0 0 0; color: #6b7280;">Total Ganhos</p>
                        </div>
                        <div class="stat-box">
                            <h3 style="color: #2563eb; margin: 0;">{total_trips}</h3>
                            <p style="margin: 5px 0 0 0; color: #6b7280;">Viagens</p>
                        </div>
                    </div>
                    
                    <p>Continue o bom trabalho!</p>
                </div>
                <div class="footer">
                    <p>Esta é uma mensagem automática. Por favor não responda a este email.</p>
                    <p>&copy; 2024 TVDEFleet - Sistema de Gestão de Frotas</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return subject, html
    
    def _template_system_alert(self, data: Dict[str, Any]) -> tuple:
        """Template for system alerts"""
        alert_title = data.get("title", "Alerta do Sistema")
        alert_message = data.get("message", "")
        
        subject = f"🔔 {alert_title}"
        
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
                .alert-box {{ background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }}
                .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔔 Alerta do Sistema</h1>
                </div>
                <div class="content">
                    <p>Olá,</p>
                    
                    <div class="alert-box">
                        <h3 style="margin-top: 0;">{alert_title}</h3>
                        <p>{alert_message}</p>
                    </div>
                    
                    <p>Por favor, verifique o sistema para mais detalhes.</p>
                </div>
                <div class="footer">
                    <p>Esta é uma mensagem automática. Por favor não responda a este email.</p>
                    <p>&copy; 2024 TVDEFleet - Sistema de Gestão de Frotas</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return subject, html
