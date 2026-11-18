"""
Email delivery service for FinanceHub authentication.
Sends transactional OTP emails for Registration and Login flows via SMTP.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("financehub.email")


def build_otp_html(otp_code: str, user_name: str, flow_type: str) -> str:
    """Generate modern, responsive HTML email template for FinanceHub OTP."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your FinanceHub Verification Code</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #0e1514;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e6efed;
    }}
    .wrapper {{
      width: 100%;
      table-layout: fixed;
      background-color: #0e1514;
      padding: 40px 0;
    }}
    .main {{
      background-color: #162120;
      margin: 0 auto;
      max-width: 520px;
      border: 1px solid #223230;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }}
    .header {{
      text-align: center;
      padding-bottom: 24px;
      border-bottom: 1px solid #223230;
    }}
    .brand-title {{
      font-size: 24px;
      font-weight: 700;
      color: #4cc2ac;
      letter-spacing: -0.5px;
      margin: 0;
    }}
    .brand-sub {{
      font-size: 12px;
      color: #97a8a4;
      margin-top: 4px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }}
    .content {{
      padding: 28px 0;
      text-align: left;
    }}
    .greeting {{
      font-size: 16px;
      font-weight: 600;
      color: #e6efed;
      margin-bottom: 12px;
    }}
    .message {{
      font-size: 14px;
      color: #97a8a4;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }}
    .otp-container {{
      background: #090e0d;
      border: 1px dashed #4cc2ac;
      border-radius: 12px;
      padding: 24px 16px;
      text-align: center;
      margin: 24px 0;
    }}
    .otp-code {{
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 34px;
      font-weight: 700;
      color: #4cc2ac;
      letter-spacing: 8px;
      margin: 0;
    }}
    .otp-expiry {{
      font-size: 12px;
      color: #97a8a4;
      margin-top: 8px;
    }}
    .security-notice {{
      background: rgba(240, 179, 90, 0.1);
      border-left: 3px solid #f0b35a;
      padding: 12px 14px;
      border-radius: 4px;
      font-size: 12px;
      color: #e6efed;
      margin-top: 20px;
      line-height: 1.4;
    }}
    .footer {{
      border-top: 1px solid #223230;
      padding-top: 20px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main">
      <div class="header">
        <h1 class="brand-title">FinanceHub</h1>
        <div class="brand-sub">Open Banking Platform</div>
      </div>
      <div class="content">
        <div class="greeting">Hello {user_name},</div>
        <p class="message">
          You recently initiated a <strong>{flow_type}</strong> request on your FinanceHub account. Use the verification code below to proceed:
        </p>
        <div class="otp-container">
          <div class="otp-code">{otp_code}</div>
          <div class="otp-expiry">Valid for 10 minutes &bull; One-time use only</div>
        </div>
        <div class="security-notice">
          <strong>Security Note:</strong> Never share this OTP with anyone, including FinanceHub staff. We will never ask for your verification code over the phone or email.
        </div>
      </div>
      <div class="footer">
        &copy; 2026 FinanceHub Technologies. All rights reserved.<br>
        If you did not request this verification, please secure your account immediately.
      </div>
    </div>
  </div>
</body>
</html>
"""


def send_otp_email(
    to_email: str,
    otp_code: str,
    user_name: Optional[str] = None,
    flow_type: str = "Verification",
) -> bool:
    """
    Send OTP verification email via SMTP.
    Configured with Gmail SMTP settings:
      EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS.
    Can be dispatched safely in a background task.
    """
    if not to_email:
        logger.warning("send_otp_email skipped: 'to_email' is empty.")
        return False

    display_name = user_name.strip() if user_name and user_name.strip() else "Customer"
    sender_user = settings.EMAIL_HOST_USER
    sender_pass = settings.EMAIL_HOST_PASSWORD

    if not sender_user or not sender_pass:
        logger.warning(
            f"[EMAIL FALLBACK] SMTP credentials not fully configured. "
            f"OTP for {to_email} ({flow_type}) is: {otp_code}"
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"{otp_code} is your FinanceHub {flow_type} Code"
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{sender_user}>"
        msg["To"] = to_email

        # Plain-text alternative
        text_content = (
            f"Hello {display_name},\n\n"
            f"Your FinanceHub {flow_type} verification code is: {otp_code}\n\n"
            f"This code is valid for 10 minutes. Please do not share this code with anyone.\n\n"
            f"— FinanceHub Security Team"
        )
        msg.attach(MIMEText(text_content, "plain", "utf-8"))

        # HTML body
        html_body = build_otp_html(otp_code=otp_code, user_name=display_name, flow_type=flow_type)
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        # Connect to SMTP server
        logger.info(f"Connecting to SMTP server {settings.EMAIL_HOST}:{settings.EMAIL_PORT}...")
        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=15) as server:
            server.ehlo()
            if settings.EMAIL_USE_TLS:
                server.starttls()
                server.ehlo()
            server.login(sender_user, sender_pass)
            server.sendmail(sender_user, [to_email], msg.as_string())

        logger.info(f"Successfully sent OTP email ({flow_type}) to {to_email}")
        return True

    except Exception as exc:
        logger.error(f"Failed to send OTP email to {to_email}: {exc}", exc_info=True)
        return False

