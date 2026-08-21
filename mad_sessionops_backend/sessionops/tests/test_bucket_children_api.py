"""
F-M6-3: Bucket-children API integration tests.
"""

import json

from django.test import Client

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import AcademicYear, Child, Partner, User

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_900_000, 10_000_000))
_SID = iter(range(97_000, 98_000))


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


def _make_child(school_id: int, user: User) -> Child:
    return Child.objects.create(
        school_id=school_id,
        first_name="Test",
        last_name="Child",
        gender="other",
        created_by=user,
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


def _create_bucket(client, school_id, co, display_name="Bucket"):
    return client.post(
        f"/api/schools/{school_id}/sections/",
        data=json.dumps({"display_name": display_name}),
        content_type="application/json",
        **_headers(co),
    ).json()


# ── POST /sections/{id}/children/ ─────────────────────────────────────────────


@pytest.mark.django_db
def test_post_bucket_child_adds_membership(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    bucket = _create_bucket(client, school.partner_id, co)
    child = _make_child(school.partner_id, co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/sections/{bucket['class_section_id']}/children/",
        data=json.dumps({"child_id": child.child_id}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["child_id"] == child.child_id
    assert data["class_section_id"] == bucket["class_section_id"]


@pytest.mark.django_db
def test_post_bucket_child_409_when_bucket_full(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    bucket = _create_bucket(client, school.partner_id, co)

    for _ in range(5):
        child = _make_child(school.partner_id, co)
        client.post(
            f"/api/schools/{school.partner_id}/sections/{bucket['class_section_id']}/children/",
            data=json.dumps({"child_id": child.child_id}),
            content_type="application/json",
            **_headers(co),
        )

    sixth = _make_child(school.partner_id, co)
    resp = client.post(
        f"/api/schools/{school.partner_id}/sections/{bucket['class_section_id']}/children/",
        data=json.dumps({"child_id": sixth.child_id}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 409


@pytest.mark.django_db
def test_post_bucket_child_409_already_in_another_bucket(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    bucket_a = _create_bucket(client, school.partner_id, co, "Bucket A")
    bucket_b = _create_bucket(client, school.partner_id, co, "Bucket B")
    child = _make_child(school.partner_id, co)
    client.post(
        f"/api/schools/{school.partner_id}/sections/{bucket_a['class_section_id']}/children/",
        data=json.dumps({"child_id": child.child_id}),
        content_type="application/json",
        **_headers(co),
    )

    resp = client.post(
        f"/api/schools/{school.partner_id}/sections/{bucket_b['class_section_id']}/children/",
        data=json.dumps({"child_id": child.child_id}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 409


@pytest.mark.django_db
def test_post_bucket_child_404_bucket_not_found(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    child = _make_child(school.partner_id, co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/sections/999999/children/",
        data=json.dumps({"child_id": child.child_id}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 404


@pytest.mark.django_db
def test_post_bucket_child_403_for_co_of_other_school(client):
    co = _make_user("CO Full Time")
    other_co = _make_user("CO Full Time")
    school = _make_school(other_co)
    bucket = _create_bucket(client, school.partner_id, other_co)
    child = _make_child(school.partner_id, other_co)

    resp = client.post(
        f"/api/schools/{school.partner_id}/sections/{bucket['class_section_id']}/children/",
        data=json.dumps({"child_id": child.child_id}),
        content_type="application/json",
        **_headers(co),
    )

    assert resp.status_code == 403


# ── DELETE /sections/{id}/children/{child_id}/ ────────────────────────────────


@pytest.mark.django_db
def test_delete_bucket_child_removes_membership(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    bucket = _create_bucket(client, school.partner_id, co)
    child = _make_child(school.partner_id, co)
    client.post(
        f"/api/schools/{school.partner_id}/sections/{bucket['class_section_id']}/children/",
        data=json.dumps({"child_id": child.child_id}),
        content_type="application/json",
        **_headers(co),
    )

    resp = client.delete(
        f"/api/schools/{school.partner_id}/sections/{bucket['class_section_id']}/children/{child.child_id}/",
        **_headers(co),
    )

    assert resp.status_code == 204


@pytest.mark.django_db
def test_delete_bucket_child_404_when_not_a_member(client):
    co = _make_user("CO Full Time")
    school = _make_school(co)
    bucket = _create_bucket(client, school.partner_id, co)
    child = _make_child(school.partner_id, co)

    resp = client.delete(
        f"/api/schools/{school.partner_id}/sections/{bucket['class_section_id']}/children/{child.child_id}/",
        **_headers(co),
    )

    assert resp.status_code == 404


@pytest.mark.django_db
def test_delete_bucket_child_403_for_co_of_other_school(client):
    co = _make_user("CO Full Time")
    other_co = _make_user("CO Full Time")
    school = _make_school(other_co)
    bucket = _create_bucket(client, school.partner_id, other_co)
    child = _make_child(school.partner_id, other_co)
    client.post(
        f"/api/schools/{school.partner_id}/sections/{bucket['class_section_id']}/children/",
        data=json.dumps({"child_id": child.child_id}),
        content_type="application/json",
        **_headers(other_co),
    )

    resp = client.delete(
        f"/api/schools/{school.partner_id}/sections/{bucket['class_section_id']}/children/{child.child_id}/",
        **_headers(co),
    )

    assert resp.status_code == 403
