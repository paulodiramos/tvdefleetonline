"""
Serviço de envio de relatórios para motoristas.
Suporta envio por WhatsApp (link direto) e Email (SMTP do parceiro ou sistema).
"""
import os
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Dict, List
from datetime import datetime

logger = logging.getLogger(__name__)

# SMTP Configuration from environment (fallback when partner SMTP not available)
SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", os.environ.get("SMTP_USER"))
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "TVDEFleet")

def send_email_smtp(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: Optional[str] = None
) -> Dict:
    """
    Envia email via SMTP configurado no sistema.
    Retorna {"success": True/False, "message": "..."}
    """
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASSWORD]):
        return {
            "success": False,
            "message": "Email não enviado - Configuração SMTP incompleta. Configure SMTP_HOST, SMTP_USER e SMTP_PASSWORD no .env"
        }
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg['To'] = to_email
        
        # Add plain text and HTML parts
        if plain_content:
            msg.attach(MIMEText(plain_content, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_content, 'html', 'utf-8'))
        
        # Connect and send
        context = ssl.create_default_context()
        
        if SMTP_PORT == 465:
            # SSL connection
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context)
        else:
            # TLS connection (STARTTLS)
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
        
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM_EMAIL, to_email, msg.as_string())
        server.quit()
        
        logger.info(f"✓ Email enviado com sucesso para {to_email} via SMTP")
        return {"success": True, "message": "Email enviado com sucesso"}
        
    except smtplib.SMTPAuthenticationError:
        logger.error("SMTP Authentication failed")
        return {"success": False, "message": "Falha na autenticação SMTP. Verifique as credenciais."}
    except smtplib.SMTPConnectError as e:
        logger.error(f"SMTP Connection failed: {e}")
        return {"success": False, "message": "Não foi possível conectar ao servidor SMTP."}
    except Exception as e:
        logger.error(f"Erro ao enviar email via SMTP: {str(e)}")
        return {"success": False, "message": str(e)}


def generate_whatsapp_link(
    phone_number: str,
    message: str
) -> str:
    """
    Gera link direto para WhatsApp com mensagem pré-preenchida.
    """
    # Limpar número de telefone (remover espaços, hífens, etc.)
    cleaned_phone = ''.join(filter(str.isdigit, phone_number))
    
    # Adicionar código de país se não tiver (assumir Portugal +351)
    if not cleaned_phone.startswith('351') and len(cleaned_phone) == 9:
        cleaned_phone = '351' + cleaned_phone
    
    # Encode da mensagem para URL
    from urllib.parse import quote
    encoded_message = quote(message)
    
    return f"https://wa.me/{cleaned_phone}?text={encoded_message}"


def generate_relatorio_motorista_html(motorista_data: Dict, semana: int, ano: int) -> str:
    """
    Gera HTML do relatório semanal do motorista.
    """
    nome = motorista_data.get("motorista_nome", "Motorista")
    matricula = motorista_data.get("veiculo_matricula", "N/A")
    
    ganhos_uber = motorista_data.get("ganhos_uber", 0)
    ganhos_bolt = motorista_data.get("ganhos_bolt", 0)
    total_ganhos = motorista_data.get("total_ganhos", 0)
    
    combustivel = motorista_data.get("combustivel", 0)
    eletrico = motorista_data.get("carregamento_eletrico", 0)
    via_verde = motorista_data.get("via_verde", 0)
    total_despesas = motorista_data.get("total_despesas_operacionais", 0)
    
    valor_liquido = motorista_data.get("valor_liquido_motorista", 0)
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }}
            .section {{ margin-bottom: 20px; }}
            .section-title {{ font-size: 14px; color: #64748b; margin-bottom: 8px; text-transform: uppercase; }}
            .value {{ font-size: 24px; font-weight: bold; }}
            .value.positive {{ color: #16a34a; }}
            .value.negative {{ color: #dc2626; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }}
            th {{ background: #f1f5f9; font-weight: 600; }}
            .total-row {{ background: #e0f2fe; font-weight: bold; }}
            .footer {{ text-align: center; padding: 20px; color: #64748b; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">Relatório Semanal</h1>
                <p style="margin: 5px 0 0 0;">Semana {semana}/{ano}</p>
            </div>
            
            <div class="content">
                <div class="section">
                    <p><strong>Motorista:</strong> {nome}</p>
                    <p><strong>Veículo:</strong> {matricula}</p>
                </div>
                
                <div class="section">
                    <div class="section-title">Ganhos</div>
                    <table>
                        <tr>
                            <td>Uber</td>
                            <td style="text-align: right;">€{ganhos_uber:.2f}</td>
                        </tr>
                        <tr>
                            <td>Bolt</td>
                            <td style="text-align: right;">€{ganhos_bolt:.2f}</td>
                        </tr>
                        <tr class="total-row">
                            <td><strong>Total Ganhos</strong></td>
                            <td style="text-align: right;"><strong>€{total_ganhos:.2f}</strong></td>
                        </tr>
                    </table>
                </div>
                
                <div class="section">
                    <div class="section-title">Despesas</div>
                    <table>
                        <tr>
                            <td>Combustível</td>
                            <td style="text-align: right;">€{combustivel:.2f}</td>
                        </tr>
                        <tr>
                            <td>Via Verde</td>
                            <td style="text-align: right;">€{via_verde:.2f}</td>
                        </tr>
                        <tr>
                            <td>Carregamento Elétrico</td>
                            <td style="text-align: right;">€{eletrico:.2f}</td>
                        </tr>
                        <tr class="total-row">
                            <td><strong>Total Despesas</strong></td>
                            <td style="text-align: right;"><strong>€{total_despesas:.2f}</strong></td>
                        </tr>
                    </table>
                </div>
                
                <div class="section" style="background: {'#dcfce7' if valor_liquido >= 0 else '#fee2e2'}; padding: 15px; border-radius: 8px; text-align: center;">
                    <div class="section-title">Valor Líquido</div>
                    <div class="value {'positive' if valor_liquido >= 0 else 'negative'}">
                        €{valor_liquido:.2f}
                    </div>
                </div>
            </div>
            
            <div class="footer">
                <p>Este relatório foi gerado automaticamente pelo TVDEFleet.</p>
                <p>Data de geração: {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html


def generate_relatorio_motorista_text(motorista_data: Dict, semana: int, ano: int) -> str:
    """
    Gera texto do relatório semanal do motorista (para WhatsApp).
    """
    nome = motorista_data.get("motorista_nome", "Motorista")
    matricula = motorista_data.get("veiculo_matricula", "N/A")
    
    ganhos_uber = motorista_data.get("ganhos_uber", 0)
    ganhos_bolt = motorista_data.get("ganhos_bolt", 0)
    total_ganhos = motorista_data.get("total_ganhos", 0)
    
    combustivel = motorista_data.get("combustivel", 0)
    eletrico = motorista_data.get("carregamento_eletrico", 0)
    via_verde = motorista_data.get("via_verde", 0)
    total_despesas = motorista_data.get("total_despesas_operacionais", 0)
    
    valor_liquido = motorista_data.get("valor_liquido_motorista", 0)
    
    text = f"""📊 *RELATÓRIO SEMANAL*
Semana {semana}/{ano}

👤 *{nome}*
🚗 Veículo: {matricula}

💰 *GANHOS*
• Uber: €{ganhos_uber:.2f}
• Bolt: €{ganhos_bolt:.2f}
• *Total: €{total_ganhos:.2f}*

📉 *DESPESAS*
• Combustível: €{combustivel:.2f}
• Via Verde: €{via_verde:.2f}
• Elétrico: €{eletrico:.2f}
• *Total: €{total_despesas:.2f}*

{'✅' if valor_liquido >= 0 else '⚠️'} *VALOR LÍQUIDO: €{valor_liquido:.2f}*

_Gerado por TVDEFleet_"""
    
    return text


async def enviar_relatorio_motorista(
    motorista_data: Dict,
    semana: int,
    ano: int,
    enviar_email: bool = True,
    enviar_whatsapp: bool = True,
    db = None,
    parceiro_id: str = None
) -> Dict:
    """
    Envia relatório semanal para o motorista.
    Usa SMTP do parceiro se disponível, caso contrário tenta SendGrid.
    Retorna resultado do envio.
    """
    results = {
        "motorista_id": motorista_data.get("motorista_id"),
        "motorista_nome": motorista_data.get("motorista_nome"),
        "email": {"enviado": False, "mensagem": ""},
        "whatsapp": {"enviado": False, "link": ""}
    }
    
    email = motorista_data.get("motorista_email")
    telefone = motorista_data.get("motorista_telefone")
    
    # Enviar Email
    if enviar_email and email:
        html_content = generate_relatorio_motorista_html(motorista_data, semana, ano)
        subject = f"Relatório Semanal - Semana {semana}/{ano}"
        
        email_result = None
        
        # Tentar usar SMTP do parceiro primeiro
        if db is not None and parceiro_id:
            try:
                from utils.email_service import get_parceiro_email_service
                email_service = await get_parceiro_email_service(db, parceiro_id)
                if email_service:
                    email_result = email_service.send_email(
                        to_email=email,
                        subject=subject,
                        body_html=html_content
                    )
                    logger.info(f"Email enviado via SMTP do parceiro para {email}")
            except Exception as e:
                logger.error(f"Erro ao usar SMTP do parceiro: {e}")
        
        # Fallback para SMTP do sistema se SMTP do parceiro não disponível
        if email_result is None:
            email_result = send_email_smtp(email, subject, html_content)
        
        results["email"] = {
            "enviado": email_result.get("success", False),
            "mensagem": email_result.get("message") or email_result.get("error", "")
        }
    elif enviar_email:
        results["email"]["mensagem"] = "Email não disponível"
    
    # Gerar link WhatsApp
    if enviar_whatsapp and telefone:
        text_content = generate_relatorio_motorista_text(motorista_data, semana, ano)
        whatsapp_link = generate_whatsapp_link(telefone, text_content)
        results["whatsapp"] = {
            "enviado": True,
            "link": whatsapp_link
        }
    elif enviar_whatsapp:
        results["whatsapp"]["link"] = ""
        results["whatsapp"]["mensagem"] = "Telefone não disponível"
    
    return results
