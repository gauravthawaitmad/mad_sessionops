import os

INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SYNC_SERVICE_TOKEN", "")


def validate_service_token(authorization_header: str) -> bool:
    """Return True iff the header matches the configured service token."""
    if not INTERNAL_SERVICE_TOKEN:
        return False
    expected = f"Bearer {INTERNAL_SERVICE_TOKEN}"
    return authorization_header == expected
