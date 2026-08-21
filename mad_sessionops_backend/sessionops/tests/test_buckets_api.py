"""
F-M6-2: Buckets API integration tests.
"""

import json

from django.test import Client

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import AcademicYear, Partner, User

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_600_000, 9_700_000))
_SID = iter(range(96_000, 97_000))


@pytest.fixture(autouse=True)
def _active_academic_year(db):
    """create_bucket() now binds every new bucket to the active AcademicYear
    (see get_or_create_school_academic_year) — needed for every test in this file."""
    if not AcademicYear.objects.filter(is_active=True, removed=False).exists():
        creator = User.objects.create(
            user_login="ay_fixture@test.com",
            user_display_name="AY Fixture",
            email="ay_fixture@test.com",
            is_active=True,
        )
        AcademicYear.objects.create(label="2026-2027", is_active=True, created_by=creator)


def _make_user(role: str) -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"user{uid}@test.com",
        user_display_name=f"User {uid}",
        email=f"user{uid}@test.com",
        user_role=role,
        is_active=True,
    )


def _make_school(co: User | None = None) -> Partner:
    sid = next(_SID)
    return Partner.objects.create(
        partner_id=sid,
        partner_name=f"School {sid}",
        co_id=co.user_id if co else None,
        converted=True,
        is_active=True,
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


# ── GET /sections/ ────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_list_buckets_empty(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)

    resp = client.get(f"/api/schools/{school.partner_id}/sections/", **_headers(co))

    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.django_db
def test_list_buckets_after_create(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    client.post(
        f"/api/schools/{school.partner_id}/sections/",
        data=json.dumps({"display_name": "Care Monster"}),
        content_type="application/json",
        **_headers(co),
    )

    resp = client.get(f"/api/schools/{school.partner_id}/sections/", **_headers(co))

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["section_display_name"] == "Care Monster"
    assert data[0]["section_name"] == "care_monster"


@pytest.mark.django_db
def test_list_buckets_403_for_co_of_other_school(client):
    co = _make_user("CO Full Time")
    other_co = _make_user("CO Full Time")
    school = _make_school(other_co)

    resp = client.get(f"/api/schools/{school.partner_id}/sections/", **_headers(co))

    assert resp.status_code == 403


@pytest.mark.django_db
def test_list_buckets_admin_sees_any_school(client):
    admin = _make_user("Function Lead")
    co = _make_user("CO Full Time")
    school = _make_school(co)

    resp = client.get(f"/api/schools/{school.partner_id}/sections/", **_headers(admin))

    assert resp.status_code == 200


# ── POST /sections/ ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_post_bucket_creates_row(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/sections/",
        data=json.dumps({"display_name": "Care Monster"}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["section_name"] == "care_monster"
    assert data["section_display_name"] == "Care Monster"
    assert data["school_class_id"] is None
    assert data["active_children_count"] == 0


@pytest.mark.django_db
def test_post_bucket_no_display_name_uses_default(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/sections/",
        data=json.dumps({}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 201
    assert resp.json()["section_display_name"] == "Group 1"


@pytest.mark.django_db
def test_post_bucket_duplicate_slug_returns_409(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    client.post(
        f"/api/schools/{school.partner_id}/sections/",
        data=json.dumps({"display_name": "Care Monster"}),
        content_type="application/json",
        **_headers(co),
    )

    resp = client.post(
        f"/api/schools/{school.partner_id}/sections/",
        data=json.dumps({"display_name": "Care Monster"}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 409


@pytest.mark.django_db
def test_post_bucket_403_for_co_of_other_school(client):
    co = _make_user("CO Full Time")
    other_co = _make_user("CO Full Time")
    school = _make_school(other_co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/sections/",
        data=json.dumps({"display_name": "Care Monster"}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 403


# ── PATCH /sections/{id}/ ─────────────────────────────────────────────────────


@pytest.mark.django_db
def test_patch_bucket_renames(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    created = client.post(
        f"/api/schools/{school.partner_id}/sections/",
        data=json.dumps({"display_name": "Old Name"}),
        content_type="application/json",
        **_headers(co),
    ).json()

    resp = client.patch(
        f"/api/schools/{school.partner_id}/sections/{created['class_section_id']}/",
        data=json.dumps({"display_name": "New Name"}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["section_display_name"] == "New Name"
    assert data["section_name"] == "new_name"


@pytest.mark.django_db
def test_patch_bucket_404_for_nonexistent(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)

    resp = client.patch(
        f"/api/schools/{school.partner_id}/sections/999999/",
        data=json.dumps({"display_name": "New Name"}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 404


@pytest.mark.django_db
def test_patch_bucket_409_on_collision(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    client.post(
        f"/api/schools/{school.partner_id}/sections/",
        data=json.dumps({"display_name": "Taken"}),
        content_type="application/json",
        **_headers(co),
    )
    created = client.post(
        f"/api/schools/{school.partner_id}/sections/",
        data=json.dumps({"display_name": "Available"}),
        content_type="application/json",
        **_headers(co),
    ).json()

    resp = client.patch(
        f"/api/schools/{school.partner_id}/sections/{created['class_section_id']}/",
        data=json.dumps({"display_name": "Taken"}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 409


# ── DELETE /sections/{id}/ (existing M2 endpoint, unchanged) ──────────────────


@pytest.mark.django_db
def test_delete_bucket_via_existing_endpoint(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    created = client.post(
        f"/api/schools/{school.partner_id}/sections/",
        data=json.dumps({"display_name": "To Delete"}),
        content_type="application/json",
        **_headers(co),
    ).json()

    resp = client.delete(
        f"/api/schools/{school.partner_id}/sections/{created['class_section_id']}/",
        **_headers(co),
    )

    assert resp.status_code == 204

    listing = client.get(f"/api/schools/{school.partner_id}/sections/", **_headers(co))
    assert listing.json() == []
