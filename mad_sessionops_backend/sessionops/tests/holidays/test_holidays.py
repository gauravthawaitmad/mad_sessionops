"""
F-M4-3: Holiday service unit tests.
"""
from datetime import date

import pytest

from sessionops.exceptions import ConflictError, NotFound, PermissionDenied, ValidationError
from sessionops.models import AcademicYear, Partner, SchoolHoliday, SchoolSessionDetails, User
from sessionops.services.holidays.create import create_holiday
from sessionops.services.holidays.delete import soft_delete_holiday
from sessionops.services.holidays.edit import edit_holiday
from sessionops.services.holidays.queries import list_holidays

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_600_000, 9_700_000))
_SID = iter(range(100_000, 110_000))


def _admin():
    uid = next(_UID)
    return User.objects.create(
        user_login=f"admin{uid}@t.com", user_display_name=f"A{uid}",
        email=f"admin{uid}@t.com", user_role="Project Lead", is_active=True,
    )


def _co():
    uid = next(_UID)
    return User.objects.create(
        user_login=f"co{uid}@t.com", user_display_name=f"CO{uid}",
        email=f"co{uid}@t.com", user_role="CO Full Time", is_active=True,
    )


def _school(co: User) -> Partner:
    sid = next(_SID)
    return Partner.objects.create(
        partner_id=sid, partner_name=f"School {sid}",
        co_id=co.user_id, converted=True, is_active=True,
    )


def _year() -> AcademicYear:
    try:
        return AcademicYear.objects.get(is_active=True, removed=False)
    except AcademicYear.DoesNotExist:
        return AcademicYear.objects.create(
            label="2026-2027", is_active=True, removed=False, created_by=_admin(),
        )


def _session(school: Partner, co: User,
             start=date(2026, 7, 1), end=date(2027, 4, 30)) -> SchoolSessionDetails:
    from sessionops.services.sessions.create import create_school_session
    return create_school_session(school.partner_id, start, end, co)


SESSION_START = date(2026, 7, 1)
SESSION_END   = date(2027, 4, 30)

PAYLOAD = {
    "holiday_reason": "holidays",
    "start_date": date(2026, 8, 15),
    "end_date":   date(2026, 8, 15),
}


# ── Create tests ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_create_holiday_succeeds_within_session_window():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    h = create_holiday(school.partner_id, PAYLOAD, co)
    assert h.school_holiday_id is not None
    assert h.school_id == school.partner_id
    assert h.is_active is True
    assert h.removed is False


@pytest.mark.django_db
def test_create_holiday_without_session_returns_400():
    _year()
    co = _co(); school = _school(co)
    # No session configured
    with pytest.raises(ValidationError, match="session is not configured"):
        create_holiday(school.partner_id, PAYLOAD, co)


@pytest.mark.django_db
def test_create_holiday_outside_session_window_returns_400():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    payload = {**PAYLOAD, "start_date": date(2025, 1, 1), "end_date": date(2025, 1, 5)}
    with pytest.raises(ValidationError, match="session window"):
        create_holiday(school.partner_id, payload, co)


@pytest.mark.django_db
def test_create_holiday_end_before_start_returns_400():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    payload = {**PAYLOAD, "start_date": date(2026, 8, 20), "end_date": date(2026, 8, 15)}
    with pytest.raises(ValidationError, match="on or before"):
        create_holiday(school.partner_id, payload, co)


@pytest.mark.django_db
def test_create_holiday_single_day_succeeds():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    payload = {**PAYLOAD, "start_date": date(2026, 8, 15), "end_date": date(2026, 8, 15)}
    h = create_holiday(school.partner_id, payload, co)
    assert h.start_date == h.end_date


@pytest.mark.django_db
def test_create_holiday_overlapping_active_holiday_returns_409():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    create_holiday(school.partner_id, {**PAYLOAD, "start_date": date(2026, 8, 10), "end_date": date(2026, 8, 20)}, co)
    # Overlaps
    with pytest.raises(ConflictError, match="overlaps"):
        create_holiday(school.partner_id, {**PAYLOAD, "start_date": date(2026, 8, 15), "end_date": date(2026, 8, 25)}, co)


@pytest.mark.django_db
def test_create_holiday_past_date_within_session_allowed():
    # Session can have a past start_date (e.g. data backfill)
    _year()
    co = _co(); school = _school(co)
    _session(school, co, start=date(2025, 7, 1), end=date(2026, 4, 30))
    payload = {**PAYLOAD, "start_date": date(2025, 8, 1), "end_date": date(2025, 8, 5)}
    h = create_holiday(school.partner_id, payload, co)
    assert h.school_holiday_id is not None


@pytest.mark.django_db
def test_create_holiday_optional_fields_can_be_null():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    h = create_holiday(school.partner_id, {**PAYLOAD, "holiday_description": None, "remarks": None}, co)
    assert h.holiday_description is None
    assert h.remarks is None


@pytest.mark.django_db
def test_co_cannot_create_holiday_in_other_school():
    _year()
    co1 = _co(); co2 = _co()
    school = _school(co1); _session(school, co1)
    with pytest.raises(PermissionDenied):
        create_holiday(school.partner_id, PAYLOAD, co2)


@pytest.mark.django_db
def test_admin_can_create_holiday_in_any_school():
    _year()
    co = _co(); admin = _admin()
    school = _school(co); _session(school, co)
    h = create_holiday(school.partner_id, PAYLOAD, admin)
    assert h.school_holiday_id is not None


# ── Edit tests ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_edit_holiday_reason_only_updates_in_place():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    h = create_holiday(school.partner_id, PAYLOAD, co)
    original_id = h.school_holiday_id

    updated = edit_holiday(h.school_holiday_id, {"holiday_reason": "mad_event"}, co)

    assert updated.school_holiday_id == original_id
    assert updated.holiday_reason == "mad_event"
    assert updated.is_active is True


@pytest.mark.django_db
def test_edit_holiday_description_only_updates_in_place():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    h = create_holiday(school.partner_id, PAYLOAD, co)

    updated = edit_holiday(h.school_holiday_id, {"holiday_description": "Independence Day"}, co)

    assert updated.school_holiday_id == h.school_holiday_id
    assert updated.holiday_description == "Independence Day"


@pytest.mark.django_db
def test_edit_holiday_date_range_soft_deletes_and_creates_new():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    h = create_holiday(school.partner_id, PAYLOAD, co)
    old_id = h.school_holiday_id

    new_h = edit_holiday(h.school_holiday_id, {
        "start_date": date(2026, 9, 1),
        "end_date":   date(2026, 9, 3),
    }, co)

    assert new_h.school_holiday_id != old_id
    assert new_h.start_date == date(2026, 9, 1)
    # Old row should be soft-deleted
    old = SchoolHoliday.objects.get(school_holiday_id=old_id)
    assert old.removed is True
    assert old.is_active is False


@pytest.mark.django_db
def test_edit_holiday_date_change_triggers_overlap_check():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    h1 = create_holiday(school.partner_id, {**PAYLOAD, "start_date": date(2026, 8, 1), "end_date": date(2026, 8, 5)}, co)
    h2 = create_holiday(school.partner_id, {**PAYLOAD, "start_date": date(2026, 9, 1), "end_date": date(2026, 9, 5)}, co)

    # Editing h2's dates to overlap with h1 should raise ConflictError
    with pytest.raises(ConflictError, match="overlaps"):
        edit_holiday(h2.school_holiday_id, {"start_date": date(2026, 8, 3), "end_date": date(2026, 8, 10)}, co)


@pytest.mark.django_db
def test_edit_holiday_not_found_raises_404():
    _year()
    co = _co()
    with pytest.raises(NotFound):
        edit_holiday(999_999_999, {"holiday_reason": "holidays"}, co)


# ── Delete tests ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_delete_holiday_soft_deletes():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    h = create_holiday(school.partner_id, PAYLOAD, co)

    soft_delete_holiday(h.school_holiday_id, co)

    deleted = SchoolHoliday.objects.get(school_holiday_id=h.school_holiday_id)
    assert deleted.is_active is False
    assert deleted.removed is True
    assert deleted.deleted_at is not None


@pytest.mark.django_db
def test_delete_holiday_not_found_raises_404():
    with pytest.raises(NotFound):
        soft_delete_holiday(999_999_999, _co())


# ── List tests ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_list_holidays_returns_only_active():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    h = create_holiday(school.partner_id, PAYLOAD, co)
    soft_delete_holiday(h.school_holiday_id, co)

    result = list_holidays(school.partner_id)
    assert all(hol.school_holiday_id != h.school_holiday_id for hol in result)


@pytest.mark.django_db
def test_list_holidays_windowed_query():
    _year()
    co = _co(); school = _school(co); _session(school, co)
    create_holiday(school.partner_id, {**PAYLOAD, "start_date": date(2026, 8, 1), "end_date": date(2026, 8, 5)}, co)
    create_holiday(school.partner_id, {**PAYLOAD, "start_date": date(2026, 10, 1), "end_date": date(2026, 10, 5)}, co)

    result = list_holidays(school.partner_id, start_date=date(2026, 7, 1), end_date=date(2026, 9, 30))
    assert len(result) == 1
    assert result[0].start_date == date(2026, 8, 1)
