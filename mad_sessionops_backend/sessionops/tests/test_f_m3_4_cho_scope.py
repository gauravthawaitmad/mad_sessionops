"""
F-M3-4: CHO Scope Activation — unit tests.

Covers schools_visible_to(), can_view_school(), can_modify_school(), and
get_school_or_403() for CHO users.
"""

import pytest

from sessionops.exceptions import NotFound, PermissionDenied
from sessionops.models import Partner, PartnerWorknode, User
from sessionops.services.rbac.scope import (
    can_modify_school,
    can_view_school,
    get_school_or_403,
    schools_visible_to,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_000_000, 9_100_000))
_SID = iter(range(60_000, 70_000))


def _make_cho(worknode_id: int | None = None) -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"cho{uid}@test.com",
        user_display_name=f"CHO {uid}",
        email=f"cho{uid}@test.com",
        user_role="CHO",
        is_active=True,
        worknode_id=worknode_id,
    )


def _make_school(co_id: int = 1, is_active: bool = True) -> Partner:
    sid = next(_SID)
    return Partner.objects.create(
        partner_id=sid,
        partner_name=f"School {sid}",
        co_id=co_id,
        converted=True,
        is_active=is_active,
    )


def _make_pw(school: Partner, worknode_id: int) -> PartnerWorknode:
    return PartnerWorknode.objects.create(
        partner_id=str(school.partner_id),
        worknode_id=worknode_id,
    )


# ── TC-M3-4-01  CHO with worknode_id mapping sees their school ─────────────────

@pytest.mark.django_db
def test_cho_with_worknode_id_mapping_sees_partner():
    cho = _make_cho(worknode_id=200)
    school = _make_school()
    _make_pw(school, worknode_id=200)

    qs = schools_visible_to(cho)

    assert school.partner_id in list(qs.values_list("partner_id", flat=True))


# ── TC-M3-4-02  CHO with no worknode_id sees empty list ───────────────────────

@pytest.mark.django_db
def test_cho_without_worknode_id_sees_empty_list():
    _make_school()
    cho = _make_cho(worknode_id=None)

    qs = schools_visible_to(cho)

    assert qs.count() == 0


# ── TC-M3-4-03  CHO with unmapped worknode_id sees empty list ─────────────────

@pytest.mark.django_db
def test_cho_with_unmapped_worknode_id_sees_empty_list():
    cho = _make_cho(worknode_id=999)
    _make_school()
    # No PartnerWorknode row for worknode_id=999

    qs = schools_visible_to(cho)

    assert qs.count() == 0


# ── TC-M3-4-04  PartnerWorknode with empty partner_id is excluded ──────────────

@pytest.mark.django_db
def test_cho_with_worknode_id_mapping_to_empty_partner_id_sees_nothing():
    cho = _make_cho(worknode_id=300)
    PartnerWorknode.objects.create(partner_id="", worknode_id=300)

    qs = schools_visible_to(cho)

    assert qs.count() == 0


# ── TC-M3-4-05  can_view_school returns True for CHO in scope ─────────────────

@pytest.mark.django_db
def test_cho_can_view_school_within_scope():
    cho = _make_cho(worknode_id=400)
    school = _make_school()
    _make_pw(school, worknode_id=400)

    assert can_view_school(cho, school) is True


# ── TC-M3-4-06  can_view_school returns False for CHO outside scope ───────────

@pytest.mark.django_db
def test_cho_cannot_view_school_outside_scope():
    cho = _make_cho(worknode_id=500)
    school = _make_school()
    # No PartnerWorknode for this school+worknode

    assert can_view_school(cho, school) is False


# ── TC-M3-4-07  can_modify_school True for CHO within scope ───────────────────

@pytest.mark.django_db
def test_cho_can_modify_school_within_scope():
    cho = _make_cho(worknode_id=600)
    school = _make_school()
    _make_pw(school, worknode_id=600)

    assert can_modify_school(cho, school) is True


# ── TC-M3-4-08  can_modify_school False for CHO outside scope ─────────────────

@pytest.mark.django_db
def test_cho_cannot_modify_school_outside_scope():
    cho = _make_cho(worknode_id=700)
    school = _make_school()

    assert can_modify_school(cho, school) is False


# ── TC-M3-4-09  get_school_or_403 succeeds for CHO within scope ───────────────

@pytest.mark.django_db
def test_cho_get_school_or_403_within_scope():
    cho = _make_cho(worknode_id=800)
    school = _make_school()
    _make_pw(school, worknode_id=800)

    result = get_school_or_403(cho, school.partner_id)

    assert result.partner_id == school.partner_id


# ── TC-M3-4-10  get_school_or_403 raises PermissionDenied outside scope ───────

@pytest.mark.django_db
def test_cho_get_school_or_403_outside_scope_raises():
    cho = _make_cho(worknode_id=900)
    school = _make_school()

    with pytest.raises((PermissionDenied, NotFound)):
        get_school_or_403(cho, school.partner_id)


# ── TC-M3-4-11  CHO access is independent of school_volunteer ─────────────────

@pytest.mark.django_db
def test_cho_access_independent_of_school_volunteer():
    """CHO scope comes from partner_worknode, NOT from school_volunteer rows."""
    cho = _make_cho(worknode_id=1000)
    school = _make_school()
    # No school_volunteer row — pure worknode mapping
    _make_pw(school, worknode_id=1000)

    assert can_view_school(cho, school) is True


# ── TC-M3-4-12  CHO with multiple partner_worknode rows sees all schools ───────

@pytest.mark.django_db
def test_cho_with_multiple_partner_worknode_rows_sees_all_mapped_schools():
    cho = _make_cho(worknode_id=1100)
    school_a = _make_school()
    school_b = _make_school()
    _make_pw(school_a, worknode_id=1100)
    _make_pw(school_b, worknode_id=1100)

    ids = set(schools_visible_to(cho).values_list("partner_id", flat=True))

    assert school_a.partner_id in ids
    assert school_b.partner_id in ids


# ── TC-M3-4-13  CHO does not see inactive schools ─────────────────────────────

@pytest.mark.django_db
def test_cho_does_not_see_inactive_schools():
    cho = _make_cho(worknode_id=1200)
    active_school = _make_school(is_active=True)
    inactive_school = _make_school(is_active=False)
    _make_pw(active_school, worknode_id=1200)
    _make_pw(inactive_school, worknode_id=1200)

    ids = set(schools_visible_to(cho).values_list("partner_id", flat=True))

    assert active_school.partner_id in ids
    assert inactive_school.partner_id not in ids


# ── TC-M3-4-14  Existing M1 tests still hold: CHO without worknode → 'none' ───

@pytest.mark.django_db
def test_cho_without_worknode_id_cannot_view_any_school():
    school = _make_school()
    cho = _make_cho(worknode_id=None)

    assert can_view_school(cho, school) is False
