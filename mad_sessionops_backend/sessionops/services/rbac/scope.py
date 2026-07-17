"""
F-M1-3 / F-M3-4 RBAC scope filtering.

Scope rules:
  Function Lead / Project Lead / Project Associate / CXO → all partners (admin scope)
  CO Full Time / CO Part Time → partners where co_id == user.user_id
  CHO → partners where user.worknode_id maps to a PartnerWorknode row (F-M3-4)
  Other roles cannot log in, so they never reach this layer.

CXO is not in ADMIN_ROLES (which drives login-gate permissions) but is treated
as admin scope here — that is an explicit M1 decision, see milestone doc F-M1-3.
"""

from django.db.models import QuerySet

from sessionops.models import Partner, PartnerWorknode, User
from sessionops.services.auth.role_helpers import ADMIN_ROLES, parse_user_roles

_ADMIN_SCOPE_ROLES: frozenset[str] = ADMIN_ROLES | frozenset(["CXO"])
_CO_ROLES: frozenset[str] = frozenset(["CO Full Time", "CO Part Time"])
_CHO_ROLES: frozenset[str] = frozenset(["CHO"])


def _classify(user: User) -> str:
    """Return 'admin', 'co', 'cho', or 'none' based on the user's highest scope."""
    roles = set(parse_user_roles(user.user_role))
    if roles & _ADMIN_SCOPE_ROLES:
        return "admin"
    if roles & _CO_ROLES:
        return "co"
    if roles & _CHO_ROLES:
        return "cho"
    return "none"


def schools_visible_to(user: User) -> QuerySet:
    """Return a Partner queryset scoped to what the user may see."""
    scope = _classify(user)
    if scope == "admin":
        return Partner.objects.filter(converted=True)
    if scope == "co":
        return Partner.objects.filter(co_id=user.user_id, converted=True)
    if scope == "cho":
        if user.worknode_id is None:
            return Partner.objects.none()
        partner_ids = (
            PartnerWorknode.objects
            .filter(worknode_id=user.worknode_id)
            .exclude(partner_id__isnull=True)
            .exclude(partner_id="")
            .values_list("partner_id", flat=True)
            .distinct()
        )
        if not partner_ids:
            return Partner.objects.none()
        return Partner.objects.filter(
            partner_id__in=list(partner_ids),
            is_active=True,
        )
    return Partner.objects.none()


def can_view_school(user: User, partner: Partner) -> bool:
    """Return True if the user may view this specific partner (school)."""
    scope = _classify(user)
    if scope == "admin":
        return True
    if scope == "co":
        return partner.co_id == user.user_id
    if scope == "cho":
        return schools_visible_to(user).filter(partner_id=partner.partner_id).exists()
    return False


def can_modify_school(user: User, partner: Partner) -> bool:
    """Return True if the user may write to this partner's data (M2+).

    Semantically identical to can_view_school; separate function for clarity
    at call sites where intent is write, not read.
    """
    return can_view_school(user, partner)


def get_school_or_403(user: User, school_id: int) -> Partner:
    """Return the Partner for school_id if visible to user, else raise PermissionDenied."""
    from sessionops.exceptions import NotFound, PermissionDenied

    try:
        partner = Partner.objects.get(partner_id=school_id)
    except Partner.DoesNotExist:
        raise NotFound(f"School {school_id} not found.")
    if not can_view_school(user, partner):
        raise PermissionDenied()
    return partner


def require_admin_scope(user: User) -> None:
    """Raise PermissionDenied if the user does not have admin scope."""
    from sessionops.exceptions import PermissionDenied

    if _classify(user) != "admin":
        raise PermissionDenied("Admin scope required.")
