"""
F-M1-3 RBAC scope filtering.

Scope rules (M1):
  Function Lead / Project Lead / Project Associate / CXO → all partners (admin scope)
  CO Full Time / CO Part Time → partners where co_id == user.user_id
  CHO → empty (no volunteer data in M1)
  Other roles cannot log in, so they never reach this layer.

CXO is not in ADMIN_ROLES (which drives login-gate permissions) but is treated
as admin scope here — that is an explicit M1 decision, see milestone doc F-M1-3.
"""

from django.db.models import QuerySet

from sessionops.models import Partner, User
from sessionops.services.auth.role_helpers import ADMIN_ROLES, parse_user_roles

_ADMIN_SCOPE_ROLES: frozenset[str] = ADMIN_ROLES | frozenset(["CXO"])
_CO_ROLES: frozenset[str] = frozenset(["CO Full Time", "CO Part Time"])


def _classify(user: User) -> str:
    """Return 'admin', 'co', or 'none' based on the user's highest scope."""
    roles = set(parse_user_roles(user.user_role))
    if roles & _ADMIN_SCOPE_ROLES:
        return "admin"
    if roles & _CO_ROLES:
        return "co"
    return "none"


def schools_visible_to(user: User) -> QuerySet:
    """Return a Partner queryset scoped to what the user may see."""
    scope = _classify(user)
    if scope == "admin":
        return Partner.objects.filter(converted=True)
    if scope == "co":
        return Partner.objects.filter(co_id=user.user_id, converted=True)
    return Partner.objects.none()


def can_view_school(user: User, partner: Partner) -> bool:
    """Return True if the user may view this specific partner (school)."""
    scope = _classify(user)
    if scope == "admin":
        return True
    if scope == "co":
        return partner.co_id == user.user_id
    return False
