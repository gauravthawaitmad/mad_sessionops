"""
Brevo (formerly Sendinblue) transactional email service.

Uses Brevo's HTTP API directly (no SDK dependency).
Required env vars:
  BREVO_API_KEY        — Brevo v3 API key
  BREVO_FROM_EMAIL     — verified sender address (e.g. noreply@sessionops.makeadiff.in)
  BREVO_FROM_NAME      — sender display name (default: Session-Ops)
"""

import os

import requests

from sessionops.utils.custom_logger import get_logger

logger = get_logger(__name__)

_API_URL = "https://api.brevo.com/v3/smtp/email"

# ---------------------------------------------------------------------------
# Brand constants
# ---------------------------------------------------------------------------
_BRAND_RED = "#C62828"
_BRAND_DARK = "#111827"
_GRAY_50 = "#f9fafb"
_GRAY_100 = "#f3f4f6"
_GRAY_200 = "#e5e7eb"
_GRAY_500 = "#6b7280"
_GRAY_700 = "#374151"
_WHITE = "#ffffff"


def _headers() -> dict:
    api_key = os.environ.get("BREVO_API_KEY", "")
    if not api_key:
        raise RuntimeError("BREVO_API_KEY is not set in environment")
    return {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": api_key,
    }


def _from_sender() -> dict:
    return {
        "name": os.environ.get("BREVO_FROM_NAME", "Session-Ops"),
        "email": os.environ.get("BREVO_FROM_EMAIL", "noreply@sessionops.makeadiff.in"),
    }


def _base_email_html(*, heading: str, body_html: str, cta_url: str, cta_label: str, footer_note: str) -> str:
    """
    Shared branded HTML shell for all transactional emails.
    Uses table-based layout for maximum email client compatibility.
    All styles are inlined.
    """
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{heading}</title>
</head>
<body style="margin:0;padding:0;background-color:{_GRAY_50};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{_GRAY_50};min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

          <!-- header brand bar -->
          <tr>
            <td style="background-color:{_BRAND_RED};border-radius:10px 10px 0 0;padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-size:15px;font-weight:700;color:{_WHITE};letter-spacing:-0.01em;">Session-Ops</span>
                    <br />
                    <span style="font-size:10px;color:rgba(255,255,255,0.65);letter-spacing:0.07em;text-transform:uppercase;">Make a Difference · Internal</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="background-color:{_WHITE};padding:32px;border-left:1px solid {_GRAY_200};border-right:1px solid {_GRAY_200};">

              <!-- heading -->
              <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:{_BRAND_DARK};line-height:1.3;">{heading}</h1>
              <div style="height:3px;width:32px;background-color:{_BRAND_RED};border-radius:2px;margin-bottom:24px;"></div>

              <!-- dynamic body content -->
              {body_html}

              <!-- CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0 0;">
                <tr>
                  <td style="border-radius:8px;background-color:{_BRAND_DARK};">
                    <a href="{cta_url}"
                       style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:{_WHITE};text-decoration:none;border-radius:8px;letter-spacing:0.01em;">
                      {cta_label} &rarr;
                    </a>
                  </td>
                </tr>
              </table>


            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="background-color:{_GRAY_100};border:1px solid {_GRAY_200};border-top:none;border-radius:0 0 10px 10px;padding:20px 32px;">
              <p style="margin:0;font-size:12px;color:{_GRAY_500};line-height:1.6;">{footer_note}</p>
              <p style="margin:10px 0 0 0;font-size:11px;color:{_GRAY_500};">
                &copy; {_get_year()} Make A Difference (MAD) &middot; Internal use only
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>"""


def _get_year() -> int:
    from datetime import date
    return date.today().year


def _unique_subject_suffix() -> str:
    """Short timestamp suffix that breaks email threading in Gmail/Outlook."""
    from datetime import datetime
    return datetime.now().strftime("%d %b %Y, %H:%M")


def send_password_reset_email(to_email: str, to_name: str, reset_url: str) -> None:
    """
    Send a password-reset email via Brevo.

    Args:
        to_email: Recipient email address.
        to_name:  Recipient display name.
        reset_url: Full URL including token.
    """
    first_name = to_name.split()[0] if to_name else "there"

    body_html = f"""
      <p style="margin:0 0 16px 0;font-size:14px;color:{_GRAY_700};line-height:1.7;">
        Hi <strong>{first_name}</strong>,
      </p>
      <p style="margin:0 0 16px 0;font-size:14px;color:{_GRAY_700};line-height:1.7;">
        We received a request to reset your <strong>Session-Ops</strong> password.
        Click the button below to choose a new one.
      </p>
      <p style="margin:0;font-size:13px;color:{_GRAY_500};line-height:1.6;">
        This link expires in <strong>30 minutes</strong>. If you did not request a password
        reset, you can safely ignore this email &mdash; your account is not affected.
      </p>
    """

    html = _base_email_html(
        heading="Reset your password",
        body_html=body_html,
        cta_url=reset_url,
        cta_label="Reset password",
        footer_note="You are receiving this because a password reset was requested for your Session-Ops account.",
    )

    payload = {
        "sender": _from_sender(),
        "to": [{"email": to_email, "name": to_name}],
        "subject": f"Reset your Session-Ops password — {_unique_subject_suffix()}",
        "htmlContent": html,
    }

    try:
        resp = requests.post(_API_URL, json=payload, headers=_headers(), timeout=10)
        resp.raise_for_status()
        logger.info(f"Password reset email sent to {to_email}")
    except requests.HTTPError as exc:
        logger.error(f"Brevo API error sending to {to_email}: {exc.response.text}")
        raise RuntimeError("Failed to send password reset email") from exc
    except requests.RequestException as exc:
        logger.error(f"Network error sending email to {to_email}: {exc}")
        raise RuntimeError("Failed to send password reset email") from exc


def send_welcome_set_password_email(to_email: str, to_name: str, set_url: str) -> None:
    """
    Send a set-password welcome email to a Hasura-synced user who has no password yet.

    Args:
        to_email: Recipient email address.
        to_name:  Recipient display name.
        set_url:  Full URL to the set-password page.
    """
    first_name = to_name.split()[0] if to_name else "there"

    body_html = f"""
      <p style="margin:0 0 16px 0;font-size:14px;color:{_GRAY_700};line-height:1.7;">
        Hi <strong>{first_name}</strong>,
      </p>
      <p style="margin:0 0 16px 0;font-size:14px;color:{_GRAY_700};line-height:1.7;">
        Your <strong>Session-Ops</strong> account has been created and is ready to use.
        Set a password to sign in with your email address.
      </p>
      <p style="margin:0;font-size:13px;color:{_GRAY_500};line-height:1.6;">
        This link expires in <strong>30 minutes</strong>. If you did not expect this email,
        please contact your city administrator.
      </p>
    """

    html = _base_email_html(
        heading="Set up your password",
        body_html=body_html,
        cta_url=set_url,
        cta_label="Set my password",
        footer_note="You are receiving this because a Session-Ops account was created for you.",
    )

    payload = {
        "sender": _from_sender(),
        "to": [{"email": to_email, "name": to_name}],
        "subject": f"Set up your Session-Ops password — {_unique_subject_suffix()}",
        "htmlContent": html,
    }

    try:
        resp = requests.post(_API_URL, json=payload, headers=_headers(), timeout=10)
        resp.raise_for_status()
        logger.info(f"Set-password email sent to {to_email}")
    except requests.HTTPError as exc:
        logger.error(f"Brevo API error sending to {to_email}: {exc.response.text}")
        raise RuntimeError("Failed to send set-password email") from exc
    except requests.RequestException as exc:
        logger.error(f"Network error sending email to {to_email}: {exc}")
        raise RuntimeError("Failed to send set-password email") from exc
