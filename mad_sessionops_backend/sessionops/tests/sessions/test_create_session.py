"""
F-M4-2: Session creation service tests.
"""
from datetime import date

import pytest

from sessionops.exceptions import ConflictError, PermissionDenied, ValidationError
from sessionops.models import AcademicYear, Partner, SchoolSessionDetails, User
from sessionops.services.sessions.create import create_school_session

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_000_000, 9_100_000))
_SID = iter(range(70_000, 80_000))


def _make_admin() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"admin{uid}@test.com",
        user_display_name=f"Admin {uid}",
        email=f"admin{uid}@test.com",
        user_role="Project Lead",
        is_active=True,
    )


def _make_co() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"co{uid}@test.com",
        user_display_name=f"CO {uid}",
        email=f"co{uid}@test.com",
        user_role="CO Full Time",
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


START = date(2026, 7, 1)
END = date(2027, 4, 30)


# ── Tests ──────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_create_session_succeeds_with_valid_dates():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    session = create_school_session(school.partner_id, START, END, co)

    assert session.session_id is not None
    assert session.school_id == school.partner_id
    assert session.start_date == START
    assert session.end_date == END
    assert session.is_active is True
    assert session.removed is False
    assert session.created_by == co


@pytest.mark.django_db
def test_create_session_starts_in_past_allowed():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    past_start = date(2025, 1, 1)
    past_end = date(2025, 12, 31)

    session = create_school_session(school.partner_id, past_start, past_end, co)
    assert session.start_date == past_start


@pytest.mark.django_db
def test_create_session_start_after_end_returns_400():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    with pytest.raises(ValidationError, match="start_date must be before end_date"):
        create_school_session(school.partner_id, END, START, co)


@pytest.mark.django_db
def test_create_session_equal_dates_returns_400():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    with pytest.raises(ValidationError):
        create_school_session(school.partner_id, START, START, co)


@pytest.mark.django_db
def test_create_session_returns_409_when_active_session_exists():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    create_school_session(school.partner_id, START, END, co)

    with pytest.raises(ConflictError, match="Session already configured"):
        create_school_session(school.partner_id, START, END, co)


@pytest.mark.django_db
def test_co_cannot_create_session_in_other_school():
    _make_active_year()
    co1 = _make_co()
    co2 = _make_co()
    school = _make_school(co1)  # owned by co1

    with pytest.raises(PermissionDenied):
        create_school_session(school.partner_id, START, END, co2)


@pytest.mark.django_db
def test_admin_can_create_session_in_any_school():
    _make_active_year()
    co = _make_co()
    admin = _make_admin()
    school = _make_school(co)

    session = create_school_session(school.partner_id, START, END, admin)
    assert session.session_id is not None


@pytest.mark.django_db
def test_create_session_stores_to_correct_school_academic_year():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    session = create_school_session(school.partner_id, START, END, co)

    assert session.school_academic_year.school_id == school.partner_id


@pytest.mark.django_db
def test_create_session_only_one_active_per_school():
    _make_active_year()
    co = _make_co()
    school = _make_school(co)

    create_school_session(school.partner_id, START, END, co)

    count = SchoolSessionDetails.objects.filter(
        school_id=school.partner_id, is_active=True, removed=False
    ).count()
    assert count == 1
