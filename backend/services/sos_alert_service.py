"""
SafeHer — SOS Email Alert Service
====================================
Reliable backend-side SOS email dispatch.

The frontend also sends SOS emails directly through EmailJS (so the
alert fires even if the backend is asleep or has crashed). This service
is the BACKUP path for when EmailJS is over its free-tier quota, blocked
by the network, or for production deployments that prefer server-side
sending.

It only activates if SMTP_* env vars are set. Without them, /sos/alert
returns 503 and the frontend should fall back to EmailJS.
"""

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Iterable, Optional

from core.config import get_settings

logger = logging.getLogger("safeher.sos_alert")

settings = get_settings()


def smtp_configured() -> bool:
    """True iff all required SMTP_* settings are present."""
    return all(
        [
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            settings.SMTP_USER,
            settings.SMTP_PASSWORD,
            settings.SMTP_FROM,
        ]
    )


def _build_message(
    to_email: str,
    to_name: str,
    from_name: str,
    from_phone: str,
    time_str: str,
    location_address: str,
    tracking_link: str,
) -> EmailMessage:
    """
    Construct the HTML email. Mirrors the EmailJS template structure
    so the recipient experience is identical regardless of dispatch path.
    """
    subject = f"🚨 {from_name} needs your help — SafeHer SOS"

    plain = (
        f"{from_name} ({from_phone}) triggered a SafeHer SOS at {time_str}.\n"
        f"Location: {location_address}\n"
        f"Live tracking: {tracking_link}\n"
        f"If you can, contact them or call 999.\n"
    )

    html = f"""
    <!doctype html>
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;
        background:#f4f4f5;padding:24px;color:#111;">
      <div style="max-width:560px;margin:0 auto;background:#fff;
        border-radius:12px;padding:28px;border:1px solid #e5e7eb;">
        <div style="background:#dc2626;color:#fff;border-radius:8px;
          padding:12px 16px;font-weight:600;font-size:18px;">
          🚨 SafeHer Emergency Alert
        </div>
        <p style="margin:18px 0 6px 0;font-size:16px;">
          Hi {to_name},</p>
        <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;">
          <strong>{from_name}</strong> just activated SafeHer SOS at
          <strong>{time_str}</strong>.
        </p>
        <table cellpadding="6" style="font-size:14px;border-collapse:collapse;">
          <tr><td style="color:#666;">Phone</td>
              <td><strong>{from_phone}</strong></td></tr>
          <tr><td style="color:#666;">Location</td>
              <td>{location_address}</td></tr>
        </table>
        <div style="margin:22px 0;text-align:center;">
          <a href="{tracking_link}"
             style="display:inline-block;background:#dc2626;color:#fff;
             padding:12px 22px;border-radius:8px;text-decoration:none;
             font-weight:600;font-size:15px;">
            Open live tracking
          </a>
        </div>
        <p style="font-size:13px;color:#555;line-height:1.55;">
          If you can, contact {from_name} now or call emergency services
          (<strong>999</strong>).
        </p>
        <p style="font-size:12px;color:#999;margin-top:24px;">
          Sent by SafeHer — a women's safety companion.
        </p>
      </div>
    </body></html>
    """

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email
    msg.set_content(plain)
    msg.add_alternative(html, subtype="html")
    return msg


def _send_one(
    to_email: str,
    to_name: str,
    from_name: str,
    from_phone: str,
    time_str: str,
    location_address: str,
    tracking_link: str,
) -> None:
    """Synchronous SMTP send — runs inside asyncio.to_thread in the router."""
    msg = _build_message(
        to_email, to_name, from_name, from_phone,
        time_str, location_address, tracking_link,
    )

    port = int(settings.SMTP_PORT)
    context = ssl.create_default_context()

    if port == 465:
        # SSL
        with smtplib.SMTP_SSL(
            settings.SMTP_HOST, port, context=context, timeout=15
        ) as smtp:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    else:
        # STARTTLS (587, 25)
        with smtplib.SMTP(settings.SMTP_HOST, port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)


async def send_sos_emails(
    recipients: Iterable[dict],
    from_name: str,
    from_phone: str,
    time_str: str,
    location_address: str,
    tracking_link: str,
) -> dict:
    """
    Send SOS emails to all recipients in parallel.

    `recipients` is an iterable of dicts with at least {'name', 'email'}.
    Recipients missing an email are skipped. Per-recipient failures are
    collected and returned so the caller can log / surface them.
    """
    if not smtp_configured():
        raise RuntimeError(
            "SMTP is not configured on this backend. Set SMTP_HOST, SMTP_PORT, "
            "SMTP_USER, SMTP_PASSWORD, SMTP_FROM in the environment to enable "
            "server-side SOS email dispatch."
        )

    sent = 0
    failed: list[dict] = []

    async def _one(rec: dict) -> None:
        nonlocal sent
        email = (rec.get("email") or "").strip()
        if not email:
            return
        try:
            await asyncio.to_thread(
                _send_one,
                email,
                rec.get("name", ""),
                from_name,
                from_phone,
                time_str,
                location_address,
                tracking_link,
            )
            sent += 1
            logger.info(f"SOS email sent → {email}")
        except Exception as e:
            logger.error(f"SOS email FAILED → {email}: {e}")
            failed.append({"email": email, "error": str(e)})

    await asyncio.gather(*(_one(r) for r in recipients), return_exceptions=True)
    return {"sent": sent, "failed": failed}