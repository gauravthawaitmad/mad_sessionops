"""
F-M3-6: Slot edit and soft-delete unit tests.

Tests requiring SlotClassSection (delete-blocking) are deferred to F-M3-7.
"""
from datetime import time

import pytest

from sessionops.exceptions import ConflictError, NotFound, PermissionDenied, ValidationError
from sessionops.models import AcademicYear, Partner, Slot, User
from sessionops.services.slots.create import create_slot
from sessionops.services.slots.delete import soft_delete_slot
from sessionops.services.slots.edit import edit_slot

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_000_000, 9_100_000))
_SID = iter(range(70_000, 80_000))


def _make_co() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"co{uid}@test.com",
        user_display_name=f"CO {uid}",
        email=f"co{uid}@test.com",
        user_role="CO Full Time",
        is_active=True,
    )


def _make_admin() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"admin{uid}@test.com",
        user_display_name=f"Admin {uid}",
        email=f"admin{uid}@test.com",
        user_role="Project Lead",
        is_active=True,
    )


def _make_school(co: User) -> Partner:
    sid = next(_SID)
    return Partner.objects.create(
        partner_id=sid,
        partner_name=f"School {sid}",
        co_id=co.user_id,
        converted=True,
        is_active=True,
    )


def _make_active_year() -> AcademicYear:
    try:
        return AcademicYear.objects.get(is_active=True, removed=False)
    except AcademicYear.DoesNotExist:
        return AcademicYear.objects.create(
            label="2026-2027",
            is_active=True,
            removed=False,
            created_by=_make_admin(),
        )


def _make_slot(
    school: Partner,
    co: User,
    day: str = "monday",
    start: time = time(9, 0),
    end: time = time(10, 0),
) -> Slot:
    return create_slot(
        school_id=school.partner_id,
        day_of_week=day,
        start_time=start,
        end_time=end,
        user=co,
    )


# ── Edit tests ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_edit_slot_updates_fields():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)
    slot = _make_slot(school, co, day="monday", start=time(9, 0), end=time(10, 0))

    updated = edit_slot(
        slot_id=slot.slot_id,
        day_of_week="tuesday",
        start_time=time(11, 0),
        end_time=time(12, 0),
        user=co,
    )

    assert updated.day_of_week == "tuesday"
    assert updated.start_time == time(11, 0)
    assert updated.end_time == time(12, 0)


@pytest.mark.django_db
def test_edit_slot_recomputes_slot_name():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)
    slot = _make_slot(school, co, day="monday", start=time(9, 0), end=time(10, 0))

    updated = edit_slot(
        slot_id=slot.slot_id,
        day_of_week="wednesday",
        start_time=time(14, 30),
        end_time=time(15, 30),
        user=co,
    )

    assert updated.slot_name == "Wednesday 14:30"


@pytest.mark.django_db
def test_edit_slot_partial_update_keeps_unchanged_fields():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)
    slot = _make_slot(school, co, day="monday", start=time(9, 0), end=time(10, 0))

    # Only update end_time
    updated = edit_slot(
        slot_id=slot.slot_id,
        day_of_week=None,
        start_time=None,
        end_time=time(10, 30),
        user=co,
    )

    assert updated.day_of_week == "monday"
    assert updated.start_time == time(9, 0)
    assert updated.end_time == time(10, 30)
    assert updated.slot_name == "Monday 09:00"


@pytest.mark.django_db
def test_edit_slot_overlap_check_excludes_self():
    """Editing a slot to the same time should not conflict with itself."""
    _make_active_year()
    co = _make_co()
    school = _make_school(co)
    slot = _make_slot(school, co, day="monday", start=time(9, 0), end=time(10, 0))

    updated = edit_slot(
        slot_id=slot.slot_id,
        day_of_week=None,
        start_time=time(9, 0),
        end_time=time(10, 30),
        user=co,
    )
    assert updated.end_time == time(10, 30)


@pytest.mark.django_db
def test_edit_slot_overlap_with_other_slot_returns_409():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)
    _make_slot(school, co, day="monday", start=time(10, 0), end=time(11, 0))
    slot2 = _make_slot(school, co, day="monday", start=time(11, 0), end=time(12, 0))

    with pytest.raises(ConflictError):
        edit_slot(
            slot_id=slot2.slot_id,
            day_of_week=None,
            start_time=time(10, 30),
            end_time=time(12, 0),
            user=co,
        )


@pytest.mark.django_db
def test_edit_slot_invalid_times_returns_400():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)
    slot = _make_slot(school, co)

    with pytest.raises(ValidationError):
        edit_slot(
            slot_id=slot.slot_id,
            day_of_week=None,
            start_time=time(11, 0),
            end_time=time(10, 0),
            user=co,
        )


@pytest.mark.django_db
def test_edit_slot_not_found_raises_404():
    _make_active_year()
    co = _make_co()

    with pytest.raises(NotFound):
        edit_slot(slot_id=999_999_999, day_of_week=None, start_time=None, end_time=None, user=co)


@pytest.mark.django_db
def test_co_cannot_edit_other_school_slot():
    _make_active_year()
    co1 = _make_co()
    co2 = _make_co()
    school = _make_school(co1)
    slot = _make_slot(school, co1)

    with pytest.raises(PermissionDenied):
        edit_slot(
            slot_id=slot.slot_id,
            day_of_week="tuesday",
            start_time=None,
            end_time=None,
            user=co2,
        )


@pytest.mark.django_db
def test_admin_can_edit_any_slot():
    _make_active_year()
    co = _make_co()
    admin = _make_admin()
    school = _make_school(co)
    slot = _make_slot(school, co)

    updated = edit_slot(
        slot_id=slot.slot_id,
        day_of_week="friday",
        start_time=time(8, 0),
        end_time=time(9, 0),
        user=admin,
    )
    assert updated.day_of_week == "friday"


# ── Delete tests ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_delete_slot_succeeds():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)
    slot = _make_slot(school, co)

    deleted = soft_delete_slot(slot_id=slot.slot_id, user=co)

    assert deleted.is_active is False
    assert deleted.removed is True
    assert deleted.deleted_at is not None


@pytest.mark.django_db
def test_delete_slot_not_found_raises_404():
    _make_active_year()
    co = _make_co()

    with pytest.raises(NotFound):
        soft_delete_slot(slot_id=999_999_999, user=co)


@pytest.mark.django_db
def test_delete_slot_not_found_for_already_deleted():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)
    slot = _make_slot(school, co)
    soft_delete_slot(slot_id=slot.slot_id, user=co)

    with pytest.raises(NotFound):
        soft_delete_slot(slot_id=slot.slot_id, user=co)


@pytest.mark.django_db
def test_co_cannot_delete_other_school_slot():
    _make_active_year()
    co1 = _make_co()
    co2 = _make_co()
    school = _make_school(co1)
    slot = _make_slot(school, co1)

    with pytest.raises(PermissionDenied):
        soft_delete_slot(slot_id=slot.slot_id, user=co2)


@pytest.mark.django_db
def test_admin_can_delete_any_slot():
    _make_active_year()
    co = _make_co()
    admin = _make_admin()
    school = _make_school(co)
    slot = _make_slot(school, co)

    deleted = soft_delete_slot(slot_id=slot.slot_id, user=admin)
    assert deleted.removed is True
