"""
F-M4-2: Sessions API integration tests.
"""
import json
from datetime import date

from django.test import Client

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import AcademicYear, Partner, User
from sessionops.services.sessions.create import create_school_session

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_400_000, 9_500_000))
_SID = iter(range(90_000, 100_000))


def _make_user(role: str) -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"user{uid}@test.com",
        user_display_name=f"User {uid}",
        email=f"user{uid}@test.com",
        user_role=role,
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


def _make_active_year() -> AcademicYear:
    try:
        return AcademicYear.objects.get(is_active=True, removed=False)
    except AcademicYear.DoesNotExist:
        admin = _make_user("Project Lead")
        return AcademicYear.objects.create(
            label="2026-2027", is_active=True, removed=False, created_by=admin
        )


def _issue_token(user: User) -> str:
    r = RefreshToken()
    r["user_id"] = user.user_id
    r["email"] = user.email
    r["role"] = user.user_role
    r.access_token["user_id"] = user.user_id
    r.access_token["email"] = user.email
    r.access_token["role"] = user.user_role
    return str(r.access_token)


def _headers(user: User) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {_issue_token(user)}"}


@pytest.fixture
def client():
    return Client()


START = date(2026, 7, 1)
END = date(2027, 4, 30)


# ── GET /session/ ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_get_session_returns_null_when_not_configured(client):
    _make_active_year()
    co = _make_user("CO Full Time")
    school = _make_school(co)

    resp = client.get(f"/api/schools/{school.partner_id}/session/", **_headers(co))

    assert resp.status_code == 200
    assert resp.json() is None


@pytest.mark.django_db
def test_get_session_returns_session_when_configured(client):
    _make_active_year()
    co = _make_user("CO Full Time")
    school = _make_school(co)
    create_school_session(school.partner_id, START, END, co)

    resp = client.get(f"/api/schools/{school.partner_id}/session/", **_headers(co))

    assert resp.status_code == 200
    data = resp.json()
    assert data["school_id"] == school.partner_id
    assert data["start_date"] == str(START)
    assert data["end_date"] == str(END)


@pytest.mark.django_db
def test_get_session_returns_403_for_other_co(client):
    _make_active_year()
    co1 = _make_user("CO Full Time")
    co2 = _make_user("CO Full Time")
    school = _make_school(co1)

    resp = client.get(f"/api/schools/{school.partner_id}/session/", **_headers(co2))
    assert resp.status_code == 403


# ── GET /session/defaults/ ────────────────────────────────────────────────────


@pytest.mark.django_db
def test_get_session_defaults_returns_mou_values(client):
    _make_active_year()
    co = _make_user("CO Full Time")
    school = _make_school(
        co,
        mou_sign_date=date(2026, 5, 1),
        mou_end_date=date(2027, 4, 30),
    )

    resp = client.get(f"/api/schools/{school.partner_id}/session/defaults/", **_headers(co))

    assert resp.status_code == 200
    data = resp.json()
    assert data["default_end_date"] == "2027-04-30"
    assert data["academic_year_label"] == "2026-2027"


@pytest.mark.django_db
def test_get_session_defaults_returns_403_for_other_co(client):
    _make_active_year()
    co1 = _make_user("CO Full Time")
    co2 = _make_user("CO Full Time")
    school = _make_school(co1)

    resp = client.get(f"/api/schools/{school.partner_id}/session/defaults/", **_headers(co2))
    assert resp.status_code == 403


# ── POST /session/ ────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_post_session_creates_row(client):
    _make_active_year()
    co = _make_user("CO Full Time")
    school = _make_school(co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/session/",
        data=json.dumps({"start_date": str(START), "end_date": str(END)}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["school_id"] == school.partner_id
    assert data["start_date"] == str(START)
    assert data["end_date"] == str(END)
    assert "session_id" in data


@pytest.mark.django_db
def test_post_session_400_start_after_end(client):
    _make_active_year()
    co = _make_user("CO Full Time")
    school = _make_school(co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/session/",
        data=json.dumps({"start_date": str(END), "end_date": str(START)}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 400


@pytest.mark.django_db
def test_post_session_409_on_duplicate(client):
    _make_active_year()
    co = _make_user("CO Full Time")
    school = _make_school(co)
    create_school_session(school.partner_id, START, END, co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/session/",
        data=json.dumps({"start_date": str(START), "end_date": str(END)}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 409


@pytest.mark.django_db
def test_post_session_403_for_other_co(client):
    _make_active_year()
    co1 = _make_user("CO Full Time")
    co2 = _make_user("CO Full Time")
    school = _make_school(co1)

    resp = client.post(
        f"/api/schools/{school.partner_id}/session/",
        data=json.dumps({"start_date": str(START), "end_date": str(END)}),
        content_type="application/json",
        **_headers(co2),
    )

    assert resp.status_code == 403


@pytest.mark.django_db
def test_post_session_requires_auth(client):
    _make_active_year()
    co = _make_user("CO Full Time")
    school = _make_school(co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/session/",
        data=json.dumps({"start_date": str(START), "end_date": str(END)}),
        content_type="application/json",
    )

    assert resp.status_code == 401
