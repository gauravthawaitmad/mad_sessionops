import os

PARTNER_SYNC_SERVICE_TOKEN = os.getenv("PARTNER_SYNC_SERVICE_TOKEN", "")


def validate_partner_sync_service_token(authorization_header: str) -> bool:
    """Return True iff the header matches the configured partner-sync service token."""
    if not PARTNER_SYNC_SERVICE_TOKEN:
        return False
    expected = f"Bearer {PARTNER_SYNC_SERVICE_TOKEN}"
    return authorization_header == expected
