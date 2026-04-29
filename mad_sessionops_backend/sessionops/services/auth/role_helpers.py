"""
Role helpers for F01a authentication gate.

Roles are stored as a comma-separated string in User.user_role, synced from Hasura.
A user may hold multiple roles. If any role is in ALLOWED_ROLES, login is permitted.
If any role is in ADMIN_ROLES, the user gets admin scope (sees all schools/data).
"""

ALLOWED_ROLES: frozenset[str] = frozenset(
    [
        "CO Full Time",
        "CO Part Time",
        "CHO",
        "CXO",
        "Function Lead",
        "Project Associate",
        "Project Lead",
    ]
)

ADMIN_ROLES: frozenset[str] = frozenset(
    [
        "Function Lead",
        "Project Associate",
        "Project Lead",
    ]
)


def parse_user_roles(user_role: str) -> list[str]:
    """Split and strip the comma-separated role string. Returns [] for empty/blank input."""
    if not user_role or not user_role.strip():
        return []
    return [r.strip() for r in user_role.split(",") if r.strip()]


def get_allowed_roles(user_role: str) -> list[str]:
    """Return the subset of the user's roles that are in ALLOWED_ROLES."""
    return [r for r in parse_user_roles(user_role) if r in ALLOWED_ROLES]


def is_admin_role(role: str) -> bool:
    """Return True if this single role grants admin scope."""
    return role in ADMIN_ROLES


def user_has_admin_access(user_role: str) -> bool:
    """Return True if any of the user's roles grants admin scope."""
    return any(r in ADMIN_ROLES for r in parse_user_roles(user_role))
