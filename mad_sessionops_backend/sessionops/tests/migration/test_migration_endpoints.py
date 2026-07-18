"""
F-M7-1: migration loader endpoint integration tests.

URL prefix: /api/internal/migrate/  (fixed, token-only auth — see migration_api.py)
"""

import json
from unittest.mock import patch

from django.test import Client

import pytest

from sessionops.models import Child, ChildRemovalLog, Class, Program, User

TEST_TOKEN = "test-migration-token"
_H = {"HTTP_AUTHORIZATION": f"Bearer {TEST_TOKEN}"}
MIGRATION_ACTOR_USER_ID = 1924616

_PID = iter(range(930_000, 940_000))


def _pid() -> int:
    return next(_PID)


@pytest.fixture(autouse=True)
def _ensure_migration_actor(db):
    User.objects.get_or_create(
        user_id=MIGRATION_ACTOR_USER_ID,
        defaults={
            "user_login": "gaurav.thwait@makeadiff.in",
            "user_display_name": "Gaurav Thwait",
            "email": "gaurav.thwait@makeadiff.in",
            "is_active": True,
        },
    )


@pytest.fixture
def client():
    return Client()


def _post(client, path, body):
    return client.post(
        f"/api/internal/migrate/{path}",
        data=json.dumps(body),
        content_type="application/json",
        **_H,
    )


@pytest.mark.django_db
def test_endpoint_rejects_missing_auth_header(client):
    r = client.post(
        "/api/internal/migrate/programs/",
        data=json.dumps({"program_id": _pid(), "program_name": "X"}),
        content_type="application/json",
    )
    assert r.status_code == 401
    assert r.json()["status"] == "error"


@pytest.mark.django_db
def test_endpoint_rejects_wrong_token(client):
    with patch("sessionops.services.migration.auth.MIGRATION_SERVICE_TOKEN", TEST_TOKEN):
        r = client.post(
            "/api/internal/migrate/programs/",
            data=json.dumps({"program_id": _pid(), "program_name": "X"}),
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer wrong-token",
        )
    assert r.status_code == 401


@pytest.mark.django_db
def test_endpoint_accepts_valid_token_inserts_row(client):
    pk = _pid()
    with patch("sessionops.services.migration.auth.MIGRATION_SERVICE_TOKEN", TEST_TOKEN):
        r = _post(client, "programs/", {"program_id": pk, "program_name": "New Program"})
    assert r.status_code == 201
    body = r.json()
    assert body == {"status": "inserted", "table": "programs", "pk": pk, "warnings": []}
    assert Program.objects.filter(program_id=pk).exists()


@pytest.mark.django_db
def test_endpoint_accepts_valid_token_updates_row(client):
    pk = _pid()
    with patch("sessionops.services.migration.auth.MIGRATION_SERVICE_TOKEN", TEST_TOKEN):
        _post(client, "programs/", {"program_id": pk, "program_name": "V1"})
        r = _post(client, "programs/", {"program_id": pk, "program_name": "V2"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "updated"
    assert body["changes"] == ["program_name"]


@pytest.mark.django_db
def test_endpoint_returns_422_for_orphan_required_fk(client):
    pk = _pid()
    with patch("sessionops.services.migration.auth.MIGRATION_SERVICE_TOKEN", TEST_TOKEN):
        r = _post(
            client,
            "classes/",
            {
                "class_id": pk,
                "class_name": "X",
                "class_code": f"X{pk % 10}",
                "program_id": 999_999_999,
            },
        )
    assert r.status_code == 422
    body = r.json()
    assert body["status"] == "skipped"
    assert body["reason"] == "orphan_fk"
    assert body["action"] == "skip"
    assert not Class.objects.filter(class_id=pk).exists()


@pytest.mark.django_db
def test_endpoint_returns_400_for_schema_violation(client):
    with patch("sessionops.services.migration.auth.MIGRATION_SERVICE_TOKEN", TEST_TOKEN):
        r = _post(client, "programs/", {"program_name": "No PK here"})
    assert r.status_code == 400
    assert r.json()["status"] == "invalid"


@pytest.mark.django_db
def test_endpoint_returns_400_for_malformed_json(client):
    with patch("sessionops.services.migration.auth.MIGRATION_SERVICE_TOKEN", TEST_TOKEN):
        r = client.post(
            "/api/internal/migrate/programs/",
            data="not json",
            content_type="application/json",
            **_H,
        )
    assert r.status_code == 400


@pytest.mark.django_db
def test_endpoint_children_full_chain_real_fk_and_insert(client):
    """children (raw school_id check) and school-classes (two real FKs) — the
    two end-to-end chains called out in the plan's Testing Strategy."""
    program_pk = _pid()
    class_pk = _pid()
    with patch("sessionops.services.migration.auth.MIGRATION_SERVICE_TOKEN", TEST_TOKEN):
        r1 = _post(client, "programs/", {"program_id": program_pk, "program_name": "P"})
        assert r1.status_code == 201
        r2 = _post(
            client,
            "classes/",
            {
                "class_id": class_pk,
                "class_name": "Grade Z",
                "class_code": f"Z{class_pk % 10}",
                "program_id": program_pk,
            },
        )
        assert r2.status_code == 201
        # re-POST identical body -> 200 with no changes
        r3 = _post(
            client,
            "classes/",
            {
                "class_id": class_pk,
                "class_name": "Grade Z",
                "class_code": f"Z{class_pk % 10}",
                "program_id": program_pk,
            },
        )
    assert r3.status_code == 200
    assert r3.json()["changes"] == []


@pytest.mark.django_db
def test_endpoint_children_orphan_school_id_returns_422(client):
    """decision #15 — school_id is a raw BigIntegerField, not a DB-level FK to
    partner, so this is the only thing that catches a bad reference."""
    pk = _pid()
    with patch("sessionops.services.migration.auth.MIGRATION_SERVICE_TOKEN", TEST_TOKEN):
        r = _post(
            client,
            "children/",
            {
                "child_id": pk,
                "school_id": 777_777_777,
                "first_name": "Test",
                "last_name": "Child",
                "gender": "other",
            },
        )
    assert r.status_code == 422
    assert r.json()["reason"] == "orphan_fk"
    assert not Child.objects.filter(child_id=pk).exists()


@pytest.mark.django_db
def test_endpoint_child_removal_log_warns_on_invalid_co_id_but_still_inserts(client):
    """child_removal_log's co_id is a documented 'loose FK' (M7.md decision #19)
    — treated as optional/warn-only, unlike every other raw-int reference in
    this codebase. An unresolvable co_id must NOT block the row."""
    from sessionops.models import Partner

    partner_pk = _pid()
    Partner.objects.create(partner_id=partner_pk, partner_name="Test School")

    child_pk = _pid()
    Child.objects.create(
        child_id=child_pk,
        school_id=partner_pk,
        first_name="Test",
        last_name="Child",
        gender="other",
        created_by_id=MIGRATION_ACTOR_USER_ID,
    )

    log_pk = _pid()
    with patch("sessionops.services.migration.auth.MIGRATION_SERVICE_TOKEN", TEST_TOKEN):
        r = _post(
            client,
            "child-removal-logs/",
            {
                "child_removal_log_id": log_pk,
                "child_id": child_pk,
                "co_id": 888_888_888,  # does not exist — should warn, not block
                "school_id": partner_pk,
                "removed_reason": "dropped_out",
                "removed_datetime": "2026-01-01T00:00:00Z",
            },
        )

    assert r.status_code == 201, r.json()
    body = r.json()
    assert any("co_id" in w for w in body["warnings"])
    log = ChildRemovalLog.objects.get(child_removal_log_id=log_pk)
    assert (
        log.co_id == 888_888_888
    )  # optional_fks only nulls real FK fields; co_id is a plain int column, kept as-is
