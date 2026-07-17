"""
F-M4-2: Session defaults service tests.
"""
from datetime import date, timedelta

import pytest

from sessionops.exceptions import PermissionDenied
from sessionops.models import AcademicYear, Partner, User
from sessionops.services.sessions.get_defaults import get_session_defaults

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_200_000, 9_300_000))
_SID = iter(range(80_000, 90_000))


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


def _make_school(co: User, mou_sign_date=None, mou_end_date=None) -> Partner:
    sid = next(_SID)
    return Partner.objects.create(
        partner_id=sid,
        partner_name=f"School {sid}",
        co_id=co.user_id,
        converted=True,
        is_active=True,
        mou_sign_date=mou_sign_date,
        mou_end_date=mou_end_date,
    )


def _make_active_year(label="2026-2027") -> AcademicYear:
    try:
        return AcademicYear.objects.get(is_active=True, removed=False)
    except AcademicYear.DoesNotExist:
        return AcademicYear.objects.create(
            label=label,
            is_active=True,
            removed=False,
            created_by=_make_admin(),
        )


# ── Tests ──────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_get_session_defaults_returns_mou_based_values():
    _make_active_year("2026-2027")
    co = _make_co()
    sign_date = date(2026, 5, 1)
    end_date  = date(2027, 4, 30)
    school = _make_school(co, mou_sign_date=sign_date, mou_end_date=end_date)

    defaults = get_session_defaults(school.partner_id, co)

    assert defaults["default_start_date"] == sign_date + timedelta(days=60)
    assert defaults["default_end_date"] == end_date
    assert defaults["academic_year_label"] == "2026-2027"


@pytest.mark.django_db
def test_get_session_defaults_with_past_mou_sign_date():
    _make_active_year()
    co = _make_co()
    past_sign = date(2020, 1, 1)
    school = _make_school(co, mou_sign_date=past_sign, mou_end_date=date(2027, 4, 30))

    defaults = get_session_defaults(school.partner_id, co)

    # Past sign date + 60 days is still returned as-is
    assert defaults["default_start_date"] == past_sign + timedelta(days=60)


@pytest.mark.django_db
def test_get_session_defaults_with_null_mou_sign_date():
    _make_active_year()
    co = _make_co()
    school = _make_school(co, mou_sign_date=None, mou_end_date=date(2027, 4, 30))

    defaults = get_session_defaults(school.partner_id, co)

    assert defaults["default_start_date"] is None
    assert defaults["default_end_date"] == date(2027, 4, 30)


@pytest.mark.django_db
def test_get_session_defaults_with_null_mou_end_date():
    _make_active_year()
    co = _make_co()
    school = _make_school(co, mou_sign_date=date(2026, 5, 1), mou_end_date=None)

    defaults = get_session_defaults(school.partner_id, co)

    assert defaults["default_end_date"] is None


@pytest.mark.django_db
def test_get_session_defaults_returns_403_for_non_school_co():
    _make_active_year()
    co1 = _make_co()
    co2 = _make_co()
    school = _make_school(co1)

    with pytest.raises(PermissionDenied):
        get_session_defaults(school.partner_id, co2)


@pytest.mark.django_db
def test_get_session_defaults_includes_academic_year_label():
    _make_active_year("2026-2027")
    co = _make_co()
    school = _make_school(co)

    defaults = get_session_defaults(school.partner_id, co)

    assert defaults["academic_year_label"] == "2026-2027"
