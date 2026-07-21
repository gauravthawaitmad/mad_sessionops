"""
F-M3-5: Slot creation unit tests.
"""
from datetime import datetime, time, timezone

import pytest

from sessionops.exceptions import ConflictError, PermissionDenied, ValidationError
from sessionops.models import AcademicYear, Partner, SchoolAcademicYear, Slot, User
from sessionops.services.slots.create import create_slot, list_slots

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(8_000_000, 8_100_000))
_SID = iter(range(50_000, 60_000))


def _make_co(school_id: int | None = None) -> User:
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


def _make_school(co: User | None = None) -> Partner:
    sid = next(_SID)
    co_id = co.user_id if co else 1
    return Partner.objects.create(
        partner_id=sid,
        partner_name=f"School {sid}",
        co_id=co_id,
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


# ── TC-M3-5-01  Happy path: slot created successfully ─────────────────────────


@pytest.mark.django_db
def test_create_slot_succeeds():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    slot = create_slot(
        school_id=school.partner_id,
        day_of_week="monday",
        start_time=time(9, 0),
        end_time=time(10, 0),
        user=co,
    )

    assert slot.slot_id is not None
    assert slot.slot_name == "Monday 09:00"
    assert slot.day_of_week == "monday"
    assert slot.start_time == time(9, 0)
    assert slot.end_time == time(10, 0)
    assert slot.is_active is True
    assert slot.removed is False


# ── TC-M3-5-02  recurring is always True ──────────────────────────────────────


@pytest.mark.django_db
def test_create_slot_recurring_always_true():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    slot = create_slot(
        school_id=school.partner_id,
        day_of_week="wednesday",
        start_time=time(11, 0),
        end_time=time(12, 0),
        user=co,
    )

    assert slot.recurring is True


# ── TC-M3-5-03  slot_name is computed from day + start_time ───────────────────


@pytest.mark.django_db
def test_create_slot_name_computed():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    slot = create_slot(
        school_id=school.partner_id,
        day_of_week="friday",
        start_time=time(14, 30),
        end_time=time(15, 30),
        user=co,
    )

    assert slot.slot_name == "Friday 14:30"


# ── TC-M3-5-04  R7: overlapping slot raises ConflictError ─────────────────────


@pytest.mark.django_db
def test_create_overlapping_slot_returns_409():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    create_slot(
        school_id=school.partner_id,
        day_of_week="tuesday",
        start_time=time(10, 0),
        end_time=time(11, 0),
        user=co,
    )

    with pytest.raises(ConflictError) as exc_info:
        create_slot(
            school_id=school.partner_id,
            day_of_week="tuesday",
            start_time=time(10, 30),
            end_time=time(11, 30),
            user=co,
        )

    assert "Tuesday 10:00" in exc_info.value.message


# ── TC-M3-5-05  Touching slots are NOT overlapping ────────────────────────────


@pytest.mark.django_db
def test_adjacent_slots_do_not_overlap():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    create_slot(
        school_id=school.partner_id,
        day_of_week="friday",
        start_time=time(9, 0),
        end_time=time(10, 0),
        user=co,
    )
    # Starts exactly at end of previous slot — should succeed (no overlap)
    slot2 = create_slot(
        school_id=school.partner_id,
        day_of_week="friday",
        start_time=time(10, 0),
        end_time=time(11, 0),
        user=co,
    )
    assert slot2.slot_id is not None


# ── TC-M3-5-06  start_time >= end_time raises ValidationError ────────────────


@pytest.mark.django_db
def test_create_slot_start_after_end_returns_400():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    with pytest.raises(ValidationError):
        create_slot(
            school_id=school.partner_id,
            day_of_week="monday",
            start_time=time(11, 0),
            end_time=time(10, 0),
            user=co,
        )


@pytest.mark.django_db
def test_create_slot_equal_times_returns_400():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    with pytest.raises(ValidationError):
        create_slot(
            school_id=school.partner_id,
            day_of_week="monday",
            start_time=time(10, 0),
            end_time=time(10, 0),
            user=co,
        )


# ── TC-M3-5-07  SchoolAcademicYear is created if missing ──────────────────────


@pytest.mark.django_db
def test_create_slot_creates_school_academic_year_if_missing():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    assert not SchoolAcademicYear.objects.filter(school_id=school.partner_id).exists()

    create_slot(
        school_id=school.partner_id,
        day_of_week="thursday",
        start_time=time(14, 0),
        end_time=time(15, 0),
        user=co,
    )

    assert SchoolAcademicYear.objects.filter(school_id=school.partner_id).exists()


# ── TC-M3-5-08  CO cannot create slot in another CO's school ──────────────────


@pytest.mark.django_db
def test_co_cannot_create_slot_in_other_school():
    _make_active_year()
    co1 = _make_co()
    co2 = _make_co()
    school = _make_school(co1)  # belongs to co1

    with pytest.raises(PermissionDenied):
        create_slot(
            school_id=school.partner_id,
            day_of_week="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            user=co2,
        )


# ── TC-M3-5-09  Admin can create slot in any school ───────────────────────────


@pytest.mark.django_db
def test_admin_can_create_slot_in_any_school():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)
    admin = _make_admin()

    slot = create_slot(
        school_id=school.partner_id,
        day_of_week="saturday",
        start_time=time(8, 0),
        end_time=time(9, 0),
        user=admin,
    )
    assert slot.slot_id is not None


# ── TC-M3-5-10  list_slots ordered by day then start_time ────────────────────


@pytest.mark.django_db
def test_list_slots_ordered_by_day_and_time():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id

    create_slot(
        school_id=sid,
        day_of_week="wednesday",
        start_time=time(14, 0),
        end_time=time(15, 0),
        user=co,
    )
    create_slot(
        school_id=sid, day_of_week="monday", start_time=time(9, 0), end_time=time(10, 0), user=co
    )
    create_slot(
        school_id=sid,
        day_of_week="wednesday",
        start_time=time(10, 0),
        end_time=time(11, 0),
        user=co,
    )

    slots = list_slots(sid, co)

    assert len(slots) == 3
    assert slots[0].slot_name == "Monday 09:00"
    assert slots[1].slot_name == "Wednesday 10:00"
    assert slots[2].slot_name == "Wednesday 14:00"


# ── TC-M3-5-11  Overlap check is day-specific ────────────────────────────────


@pytest.mark.django_db
def test_overlap_does_not_block_different_day():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    create_slot(
        school_id=school.partner_id,
        day_of_week="monday",
        start_time=time(10, 0),
        end_time=time(11, 0),
        user=co,
    )
    # Same time, different day — should not conflict
    slot2 = create_slot(
        school_id=school.partner_id,
        day_of_week="tuesday",
        start_time=time(10, 0),
        end_time=time(11, 0),
        user=co,
    )
    assert slot2.slot_id is not None
