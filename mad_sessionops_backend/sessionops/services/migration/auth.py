import os

MIGRATION_SERVICE_TOKEN = os.getenv("MIGRATION_SERVICE_TOKEN", "")


def validate_migration_token(authorization_header: str) -> bool:
    """Return True iff the header matches the configured migration service token."""
    if not MIGRATION_SERVICE_TOKEN:
        return False
    return authorization_header == f"Bearer {MIGRATION_SERVICE_TOKEN}"
