"""
F-M4-3: Holiday API integration tests.
"""
import json
from datetime import date

import pytest
from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import AcademicYear, Partner, User
from sessionops.services.holidays.create import create_holiday
from sessionops.services.sessions.create import create_school_session

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_800_000, 9_900_000))
_SID = iter(range(110_000, 120_000))


def _user(role: str) -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"u{uid}@t.com", user_display_name=f"U{uid}",
        email=f"u{uid}@t.com", user_role=role, is_active=True,
    )


def _school(co: User, **kwargs) -> Partner:
    sid = next(_SID)
    return Partner.objects.create(
        partner_id=sid, partner_name=f"School {sid}",
        co_id=co.user_id, converted=True, is_active=True, **kwargs,
    )


def _year() -> AcademicYear:
    try:
        return AcademicYear.objects.get(is_active=True, removed=False)
    except AcademicYear.DoesNotExist:
        admin = _user("Project Lead")
        return AcademicYear.objects.create(
            label="2026-2027", is_active=True, removed=False, created_by=admin,
        )


def _tok(user: User) -> str:
    r = RefreshToken()
    for k in ("user_id", "email", "role"):
        v = getattr(user, {"user_id": "user_id", "email": "email", "role": "user_role"}[k])
        r[k] = v; r.access_token[k] = v
    return str(r.access_token)


def _h(user: User) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {_tok(user)}"}


@pytest.fixture
def client():
    return Client()


SESSION_START = date(2026, 7, 1)
SESSION_END   = date(2027, 4, 30)

PAYLOAD = {"holiday_reason": "holidays", "start_date": "2026-08-15", "end_date": "2026-08-15"}


# ── GET /holidays/ ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_list_holidays_returns_200(client):
    _year(); co = _user("CO Full Time"); school = _school(co)
    create_school_session(school.partner_id, SESSION_START, SESSION_END, co)

    resp = client.get(f"/api/schools/{school.partner_id}/holidays/", **_h(co))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.django_db
def test_list_holidays_returns_403_for_other_co(client):
    _year(); co1 = _user("CO Full Time"); co2 = _user("CO Full Time")
    school = _school(co1)

    resp = client.get(f"/api/schools/{school.partner_id}/holidays/", **_h(co2))
    assert resp.status_code == 403


# ── POST /holidays/ ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_post_holiday_returns_200(client):
    _year(); co = _user("CO Full Time"); school = _school(co)
    create_school_session(school.partner_id, SESSION_START, SESSION_END, co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/holidays/",
        data=json.dumps(PAYLOAD), content_type="application/json", **_h(co),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["school_holiday_id"] is not None
    assert data["holiday_reason"] == "holidays"
    assert "holiday_reason_display" in data


@pytest.mark.django_db
def test_post_holiday_409_on_overlap(client):
    _year(); co = _user("CO Full Time"); school = _school(co)
    create_school_session(school.partner_id, SESSION_START, SESSION_END, co)
    create_holiday(school.partner_id, {
        "holiday_reason": "holidays",
        "start_date": date(2026, 8, 10), "end_date": date(2026, 8, 20),
    }, co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/holidays/",
        data=json.dumps({"holiday_reason": "holidays", "start_date": "2026-08-15", "end_date": "2026-08-25"}),
        content_type="application/json", **_h(co),
    )
    assert resp.status_code == 409


@pytest.mark.django_db
def test_post_holiday_400_outside_session_window(client):
    _year(); co = _user("CO Full Time"); school = _school(co)
    create_school_session(school.partner_id, SESSION_START, SESSION_END, co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/holidays/",
        data=json.dumps({"holiday_reason": "holidays", "start_date": "2025-01-01", "end_date": "2025-01-05"}),
        content_type="application/json", **_h(co),
    )
    assert resp.status_code == 400


# ── PATCH /holidays/{id}/ ──────────────────────────────────────────────────────

@pytest.mark.django_db
def test_patch_holiday_metadata_returns_same_id(client):
    _year(); co = _user("CO Full Time"); school = _school(co)
    create_school_session(school.partner_id, SESSION_START, SESSION_END, co)
    h = create_holiday(school.partner_id, {"holiday_reason": "holidays", "start_date": date(2026, 8, 15), "end_date": date(2026, 8, 15)}, co)

    resp = client.patch(
        f"/api/schools/{school.partner_id}/holidays/{h.school_holiday_id}/",
        data=json.dumps({"holiday_reason": "mad_event"}),
        content_type="application/json", **_h(co),
    )
    assert resp.status_code == 200
    assert resp.json()["school_holiday_id"] == h.school_holiday_id
    assert resp.json()["holiday_reason"] == "mad_event"


@pytest.mark.django_db
def test_patch_holiday_date_change_returns_new_id(client):
    _year(); co = _user("CO Full Time"); school = _school(co)
    create_school_session(school.partner_id, SESSION_START, SESSION_END, co)
    h = create_holiday(school.partner_id, {"holiday_reason": "holidays", "start_date": date(2026, 8, 15), "end_date": date(2026, 8, 15)}, co)

    resp = client.patch(
        f"/api/schools/{school.partner_id}/holidays/{h.school_holiday_id}/",
        data=json.dumps({"start_date": "2026-09-01", "end_date": "2026-09-03"}),
        content_type="application/json", **_h(co),
    )
    assert resp.status_code == 200
    assert resp.json()["school_holiday_id"] != h.school_holiday_id
    assert resp.json()["start_date"] == "2026-09-01"


# ── DELETE /holidays/{id}/ ─────────────────────────────────────────────────────

@pytest.mark.django_db
def test_delete_holiday_returns_204(client):
    _year(); co = _user("CO Full Time"); school = _school(co)
    create_school_session(school.partner_id, SESSION_START, SESSION_END, co)
    h = create_holiday(school.partner_id, {"holiday_reason": "holidays", "start_date": date(2026, 8, 15), "end_date": date(2026, 8, 15)}, co)

    resp = client.delete(f"/api/schools/{school.partner_id}/holidays/{h.school_holiday_id}/", **_h(co))
    assert resp.status_code == 204


@pytest.mark.django_db
def test_delete_holiday_404_when_missing(client):
    co = _user("CO Full Time"); school = _school(co)
    resp = client.delete(f"/api/schools/{school.partner_id}/holidays/999999999/", **_h(co))
    assert resp.status_code == 404
