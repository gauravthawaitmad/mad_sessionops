"""
F-M1-5: School Detail endpoint — backend integration tests.

TC-M1-5-01  CO can view their own school (full data returned)
TC-M1-5-02  CO gets 404 for a school they don't own (not 403)
TC-M1-5-03  Admin sees any school
TC-M1-5-04  CHO gets 404 for any school
TC-M1-5-05  Nonexistent partner_id returns 404
TC-M1-5-06  Unauthenticated request returns 401
"""

import random
import uuid

import pytest
from ninja.testing import TestClient
from rest_framework_simplejwt.tokens import AccessToken

from sessionops.models import Partner, User
from sessionops.routes import api

CLIENT = TestClient(api)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(role: str) -> User:
    suffix = uuid.uuid4().hex[:8]
    return User.objects.create(
        user_login=f"{suffix}@test.com",
        user_display_name="Test User",
        email=f"{suffix}@test.com",
        user_role=role,
    )


def _make_partner(name: str, co_id: int | None = None, **kwargs) -> Partner:
    return Partner.objects.create(
        partner_id=random.randint(100_000, 999_999),
        partner_name=name,
        co_id=co_id,
        converted=True,
        city=kwargs.get("city"),
        state=kwargs.get("state"),
        poc_name=kwargs.get("poc_name"),
        mou_url=kwargs.get("mou_url"),
        synced_at=kwargs.get("synced_at"),
    )


def _auth_header(user: User) -> dict:
    token = AccessToken()
    token["user_id"] = user.user_id
    token["email"] = user.email
    token["role"] = user.user_role
    return {"headers": {"Authorization": f"Bearer {str(token)}"}}


# ---------------------------------------------------------------------------
# TC-M1-5-01  CO views own school
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_school_detail_returns_full_data_for_co_owner():
    co = _make_user("CO Full Time")
    school = _make_partner(
        "Govt. HS Shaikpet", co_id=co.user_id, city="Hyderabad", state="Telangana"
    )

    resp = CLIENT.get(f"/api/schools/{school.partner_id}", **_auth_header(co))

    assert resp.status_code == 200
    data = resp.json()
    assert data["partner_id"] == school.partner_id
    assert data["partner_name"] == "Govt. HS Shaikpet"
    assert data["city"] == "Hyderabad"
    assert data["state"] == "Telangana"
    assert data["configuration_status"] == "awaiting_setup"


# ---------------------------------------------------------------------------
# TC-M1-5-02  CO gets 404 for school they don't own
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_school_detail_returns_404_for_co_not_owner():
    co = _make_user("CO Full Time")
    other_school = _make_partner("Other School", co_id=co.user_id + 99999)

    resp = CLIENT.get(f"/api/schools/{other_school.partner_id}", **_auth_header(co))

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TC-M1-5-03  Admin sees any school
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_school_detail_returns_data_for_admin():
    admin = _make_user("Function Lead")
    school = _make_partner("Any School", co_id=42)

    resp = CLIENT.get(f"/api/schools/{school.partner_id}", **_auth_header(admin))

    assert resp.status_code == 200
    assert resp.json()["partner_id"] == school.partner_id


# ---------------------------------------------------------------------------
# TC-M1-5-04  CHO gets 404
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_school_detail_returns_404_for_cho():
    cho = _make_user("CHO")
    school = _make_partner("Some School", co_id=99)

    resp = CLIENT.get(f"/api/schools/{school.partner_id}", **_auth_header(cho))

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TC-M1-5-05  Nonexistent partner_id → 404
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_school_detail_returns_404_for_nonexistent_id():
    admin = _make_user("Function Lead")

    resp = CLIENT.get("/api/schools/999999999", **_auth_header(admin))

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TC-M1-5-06  Unauthenticated → 401
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_school_detail_requires_auth():
    resp = CLIENT.get("/api/schools/123456")

    assert resp.status_code == 401
