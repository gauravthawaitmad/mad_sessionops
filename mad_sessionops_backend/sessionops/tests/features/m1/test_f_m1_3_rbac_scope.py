"""
F-M1-3: RBAC Scope Filtering — unit tests.

TC-M1-3-01  admin roles (Function Lead, Project Lead, Project Associate) see all partners
TC-M1-3-02  CO Full Time sees only partners where co_id matches user_id
TC-M1-3-03  CO Part Time sees only partners where co_id matches user_id
TC-M1-3-04  CHO sees empty queryset
TC-M1-3-05  CXO is treated as admin scope (sees all)
TC-M1-3-06  multi-role user with one admin role gets admin scope
TC-M1-3-07  can_view_school returns True for admin regardless of co_id
TC-M1-3-08  can_view_school returns True for CO when co_id matches
TC-M1-3-09  can_view_school returns False for CO when co_id does not match
TC-M1-3-10  can_view_school returns False for CHO
TC-M1-3-11  schools_visible_to returns only active partners (soft-delete respected)
"""

import pytest

from sessionops.models import Partner, User
from sessionops.services.rbac.scope import can_view_school, schools_visible_to

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(user_id: int, role: str) -> User:
    return User(user_id=user_id, user_login=f"u{user_id}@test.com", user_role=role)


def _make_partner(partner_id: int, co_id: int | None = None, is_active: bool = True) -> Partner:
    return Partner(
        partner_id=partner_id, partner_name=f"School {partner_id}", co_id=co_id, is_active=is_active
    )


# ---------------------------------------------------------------------------
# TC-M1-3-01  Admin roles see all partners
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["Function Lead", "Project Lead", "Project Associate"])
def test_admin_scope_sees_all(role):
    partner_a = Partner.objects.create(
        partner_id=1, partner_name="School A", co_id=100, converted=True
    )
    partner_b = Partner.objects.create(
        partner_id=2, partner_name="School B", co_id=200, converted=True
    )
    user = _make_user(999, role)

    qs = schools_visible_to(user)

    ids = set(qs.values_list("partner_id", flat=True))
    assert partner_a.partner_id in ids
    assert partner_b.partner_id in ids


# ---------------------------------------------------------------------------
# TC-M1-3-02 / TC-M1-3-03  CO sees only their schools
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["CO Full Time", "CO Part Time"])
def test_co_scope_filters_by_co_id(role):
    co_user_id = 2273058
    Partner.objects.create(
        partner_id=10, partner_name="My School", co_id=co_user_id, converted=True
    )
    Partner.objects.create(
        partner_id=11, partner_name="Other School", co_id=9999999, converted=True
    )
    user = _make_user(co_user_id, role)

    qs = schools_visible_to(user)

    ids = list(qs.values_list("partner_id", flat=True))
    assert ids == [10]


# ---------------------------------------------------------------------------
# TC-M1-3-04  CHO sees empty queryset
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_cho_scope_returns_none():
    Partner.objects.create(partner_id=20, partner_name="Any School", co_id=1)
    user = _make_user(555, "CHO")

    qs = schools_visible_to(user)

    assert qs.count() == 0


# ---------------------------------------------------------------------------
# TC-M1-3-05  CXO treated as admin scope
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_cxo_scope_treated_as_admin():
    Partner.objects.create(partner_id=30, partner_name="School X", co_id=100, converted=True)
    Partner.objects.create(partner_id=31, partner_name="School Y", co_id=200, converted=True)
    user = _make_user(1, "CXO")

    qs = schools_visible_to(user)

    assert qs.count() >= 2


# ---------------------------------------------------------------------------
# TC-M1-3-06  Multi-role: one admin role is enough
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_multi_role_with_admin_role_gets_admin_scope():
    Partner.objects.create(partner_id=40, partner_name="School Z", co_id=100, converted=True)
    user = _make_user(50, "CO Full Time,Function Lead")

    qs = schools_visible_to(user)

    # Should see all (admin takes precedence)
    ids = set(qs.values_list("partner_id", flat=True))
    assert 40 in ids


# ---------------------------------------------------------------------------
# TC-M1-3-07  can_view_school — admin True for any school
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_can_view_school_admin_true():
    partner = Partner.objects.create(partner_id=50, partner_name="Random", co_id=99999)
    user = _make_user(1, "Function Lead")

    assert can_view_school(user, partner) is True


# ---------------------------------------------------------------------------
# TC-M1-3-08  can_view_school — CO True for own school
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_can_view_school_co_own_school_true():
    co_id = 2273058
    partner = Partner.objects.create(partner_id=60, partner_name="My School", co_id=co_id)
    user = _make_user(co_id, "CO Full Time")

    assert can_view_school(user, partner) is True


# ---------------------------------------------------------------------------
# TC-M1-3-09  can_view_school — CO False for other school
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_can_view_school_co_not_owner_false():
    partner = Partner.objects.create(partner_id=70, partner_name="Other School", co_id=9999999)
    user = _make_user(2273058, "CO Full Time")

    assert can_view_school(user, partner) is False


# ---------------------------------------------------------------------------
# TC-M1-3-10  can_view_school — CHO always False
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_can_view_school_cho_false():
    partner = Partner.objects.create(partner_id=80, partner_name="School", co_id=100)
    user = _make_user(555, "CHO")

    assert can_view_school(user, partner) is False


# ---------------------------------------------------------------------------
# TC-M1-3-11  Soft-deleted partners excluded from CO and admin scopes
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_schools_visible_to_excludes_inactive_partners():
    co_id = 3000000
    Partner.objects.create(
        partner_id=90, partner_name="Active", co_id=co_id, is_active=True, converted=True
    )
    Partner.objects.create(
        partner_id=91, partner_name="Removed", co_id=co_id, is_active=False, converted=True
    )
    co_user = _make_user(co_id, "CO Full Time")
    admin_user = _make_user(1, "Function Lead")

    co_ids = list(schools_visible_to(co_user).values_list("partner_id", flat=True))
    admin_ids = list(schools_visible_to(admin_user).values_list("partner_id", flat=True))

    assert 90 in co_ids
    assert 91 not in co_ids
    assert 90 in admin_ids
    assert 91 not in admin_ids
