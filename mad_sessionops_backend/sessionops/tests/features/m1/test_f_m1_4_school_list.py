"""
F-M1-4: School List endpoint — backend integration tests.

TC-M1-4-01  CO sees only their schools (scope-filtered)
TC-M1-4-02  admin (Function Lead) sees all schools
TC-M1-4-03  CHO gets empty list
TC-M1-4-04  search filters by partner_name
TC-M1-4-05  search filters by city
TC-M1-4-06  search filters by state
TC-M1-4-07  unauthenticated request returns 401
TC-M1-4-08  response summary totals match schools returned
"""

import pytest
from ninja.testing import TestClient
from rest_framework_simplejwt.tokens import AccessToken

from sessionops.models import Partner, User
from sessionops.routes import api


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(role: str) -> User:
    """Create a real User in the test DB; user_id is auto-generated."""
    import uuid
    suffix = uuid.uuid4().hex[:8]
    return User.objects.create(
        user_login=f"{suffix}@test.com",
        user_display_name="Test User",
        email=f"{suffix}@test.com",
        user_role=role,
    )


def _make_partner(name: str, co_id: int | None = None,
                  city: str | None = None, state: str | None = None) -> Partner:
    import random
    partner_id = random.randint(100_000, 999_999)
    return Partner.objects.create(
        partner_id=partner_id,
        partner_name=name,
        co_id=co_id,
        city=city,
        state=state,
        converted=True,
    )


def _auth_header(user: User) -> dict:
    token = AccessToken()
    token["user_id"] = user.user_id
    token["email"] = user.email
    token["role"] = user.user_role
    return {"headers": {"Authorization": f"Bearer {str(token)}"}}


CLIENT = TestClient(api)


# ---------------------------------------------------------------------------
# TC-M1-4-01  CO sees only own schools
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_school_list_returns_scope_filtered_for_co():
    co = _make_user("CO Full Time")
    mine = _make_partner("My School", co_id=co.user_id, city="Mumbai")
    _make_partner("Other School", co_id=co.user_id + 99999, city="Delhi")

    resp = CLIENT.get("/api/schools/", **_auth_header(co))

    assert resp.status_code == 200
    data = resp.json()
    ids = [s["partner_id"] for s in data["schools"]]
    assert mine.partner_id in ids
    assert len(ids) == 1
    assert data["summary"]["total_schools"] == 1


# ---------------------------------------------------------------------------
# TC-M1-4-02  admin sees all schools
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_school_list_returns_all_for_admin():
    admin = _make_user("Function Lead")
    a = _make_partner("School A", co_id=100)
    b = _make_partner("School B", co_id=200)

    resp = CLIENT.get("/api/schools/", **_auth_header(admin))

    assert resp.status_code == 200
    data = resp.json()
    ids = {s["partner_id"] for s in data["schools"]}
    assert a.partner_id in ids
    assert b.partner_id in ids


# ---------------------------------------------------------------------------
# TC-M1-4-03  CHO sees empty list
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_school_list_returns_empty_for_cho():
    cho = _make_user("CHO")
    _make_partner("Some School", co_id=999)

    resp = CLIENT.get("/api/schools/", **_auth_header(cho))

    assert resp.status_code == 200
    data = resp.json()
    assert data["schools"] == []
    assert data["summary"]["total_schools"] == 0


# ---------------------------------------------------------------------------
# TC-M1-4-04  search by name
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_school_list_search_filters_by_name():
    admin = _make_user("Function Lead")
    target = _make_partner("Govt. High School Shaikpet", city="Hyderabad")
    _make_partner("St. Mary's Primary School", city="Pune")

    resp = CLIENT.get("/api/schools/?search=shaikpet", **_auth_header(admin))

    assert resp.status_code == 200
    data = resp.json()
    ids = [s["partner_id"] for s in data["schools"]]
    assert target.partner_id in ids
    assert len(ids) == 1


# ---------------------------------------------------------------------------
# TC-M1-4-05  search by city
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_school_list_search_filters_by_city():
    admin = _make_user("Project Lead")
    target = _make_partner("School A", city="Hyderabad")
    other = _make_partner("School B", city="Mumbai")

    resp = CLIENT.get("/api/schools/?search=hyderabad", **_auth_header(admin))

    assert resp.status_code == 200
    data = resp.json()
    ids = [s["partner_id"] for s in data["schools"]]
    assert target.partner_id in ids
    assert other.partner_id not in ids


# ---------------------------------------------------------------------------
# TC-M1-4-06  search by state
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_school_list_search_filters_by_state():
    admin = _make_user("Project Associate")
    target = _make_partner("School X", city="Pune", state="Maharashtra")
    other = _make_partner("School Y", city="Bengaluru", state="Karnataka")

    resp = CLIENT.get("/api/schools/?search=maharashtra", **_auth_header(admin))

    assert resp.status_code == 200
    data = resp.json()
    ids = [s["partner_id"] for s in data["schools"]]
    assert target.partner_id in ids
    assert other.partner_id not in ids


# ---------------------------------------------------------------------------
# TC-M1-4-07  unauthenticated returns 401
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_school_list_requires_auth():
    resp = CLIENT.get("/api/schools/")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# TC-M1-4-08  summary totals match returned schools
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_school_list_summary_totals():
    co = _make_user("CO Full Time")
    _make_partner("School A", co_id=co.user_id)
    _make_partner("School B", co_id=co.user_id)
    _make_partner("Other CO School", co_id=co.user_id + 99999)

    resp = CLIENT.get("/api/schools/", **_auth_header(co))

    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["total_schools"] == len(data["schools"]) == 2
