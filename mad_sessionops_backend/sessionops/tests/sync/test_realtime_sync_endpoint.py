"""
F-M8a-2: realtime sync endpoint integration tests.

URL: /sync-user-internal/{user_id}  (default INTERNAL_SYNC_ENDPOINT_PATH fallback)
Auth: admin JWT (Project Lead / Function Lead / Project Associate)
   OR service token (patched via mock)
"""

import json
import threading
from unittest.mock import patch

from django.test import Client
from django.utils import timezone

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import RealtimeSyncLog, User

ENDPOINT_BASE = "/sync-user-internal"

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(7_100_000, 7_200_000))


def _url(user_id: int) -> str:
    return f"{ENDPOINT_BASE}/{user_id}"


def _user(role: str = "Project Lead", is_active: bool = True) -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"u{uid}@sync.test",
        user_display_name=f"SyncUser{uid}",
        email=f"u{uid}@sync.test",
        user_role=role,
        is_active=is_active,
    )


def _tok(user: User) -> str:
    r = RefreshToken()
    r["user_id"] = user.user_id
    r["email"] = user.email
    r.access_token["user_id"] = user.user_id
    r.access_token["email"] = user.email
    return str(r.access_token)


def _h(user: User) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {_tok(user)}"}


def _svc_h(token: str) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


def _payload(**kwargs) -> dict:
    uid = next(_UID)
    defaults = dict(
        user_login=f"hasura{uid}@test.com",
        user_display_name="Hasura User",
        user_email=f"hasura{uid}@test.com",
        user_role="Youth",
        user_active_status=True,
        event_type="insert",
        sync_type="manual_admin",
    )
    defaults.update(kwargs)
    return defaults


@pytest.fixture
def client():
    return Client()


# ── Authentication ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_endpoint_rejects_unauthenticated(client):
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_payload()),
        content_type="application/json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_endpoint_rejects_non_admin_jwt_co(client):
    co = _user("CO Full Time")
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_payload()),
        content_type="application/json",
        **_h(co),
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_endpoint_rejects_non_admin_jwt_cho(client):
    cho = _user("CHO")
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_payload()),
        content_type="application/json",
        **_h(cho),
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_endpoint_accepts_admin_jwt(client):
    admin = _user("Project Lead")
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_payload()),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "log_id" in data
    assert "status" in data


@pytest.mark.django_db
def test_endpoint_accepts_function_lead_jwt(client):
    fl = _user("Function Lead")
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_payload()),
        content_type="application/json",
        **_h(fl),
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_endpoint_accepts_service_token(client):
    TEST_TOKEN = "test-service-secret-abc"
    uid = next(_UID)
    with patch("sessionops.services.realtime_sync.auth.INTERNAL_SERVICE_TOKEN", TEST_TOKEN):
        resp = client.post(
            _url(uid),
            data=json.dumps(_payload()),
            content_type="application/json",
            **_svc_h(TEST_TOKEN),
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "log_id" in data


@pytest.mark.django_db
def test_endpoint_rejects_wrong_service_token(client):
    uid = next(_UID)
    with patch("sessionops.services.realtime_sync.auth.INTERNAL_SERVICE_TOKEN", "correct-token"):
        resp = client.post(
            _url(uid),
            data=json.dumps(_payload()),
            content_type="application/json",
            **_svc_h("wrong-token"),
        )
    assert resp.status_code == 401


# ── Role allowlist ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_role_allowlist_skips_unknown_role(client):
    admin = _user("Project Lead")
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_payload(user_role="SomeOtherRole", event_type="update")),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "skipped_role_not_allowed"
    assert resp.json()["action_taken"] == "no_change"


@pytest.mark.django_db
def test_role_allowlist_allows_youth(client):
    admin = _user("Project Lead")
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_payload(user_role="Youth", event_type="insert")),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] in {"success", "skipped_no_change"}


@pytest.mark.django_db
def test_role_allowlist_deactivate_on_alumni(client):
    admin = _user("Project Lead")
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_payload(user_role="Alumni", event_type="update")),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 200
    # Deactivate flow stub returns success / user_deactivated
    data = resp.json()
    assert data["action_taken"] in {"user_deactivated", "no_change"}


# ── Stale / no-change skipping ────────────────────────────────────────────────


@pytest.mark.django_db
def test_stale_event_skipped(client):
    admin = _user("Project Lead")
    uid = next(_UID)
    # Create a user with a recent synced_at
    User.objects.create(
        user_id=uid,
        user_login=f"stale{uid}@test.com",
        user_display_name="Stale User",
        email=f"stale{uid}@test.com",
        user_role="CO Full Time",
        is_active=True,
        synced_at=timezone.now(),
    )
    # Send an event with an old x_modified_timestamp
    resp = client.post(
        _url(uid),
        data=json.dumps(
            _payload(
                user_login=f"stale{uid}@test.com",
                user_role="CO Full Time",
                event_type="update",
                x_modified_timestamp="2020-01-01T00:00:00+00:00",
            )
        ),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "skipped_stale"


@pytest.mark.django_db
def test_no_change_skipped(client):
    admin = _user("Project Lead")
    uid = next(_UID)
    login = f"nochange{uid}@test.com"
    User.objects.create(
        user_id=uid,
        user_login=login,
        user_display_name="NC User",
        email=login,
        contact=None,
        user_role="CO Full Time",
        worknode_id=None,
        is_active=True,
    )
    resp = client.post(
        _url(uid),
        data=json.dumps(
            _payload(
                user_login=login,
                user_display_name="NC User",
                user_email=login,
                user_phone=None,
                user_role="CO Full Time",
                worknode_id=None,
                user_active_status=True,
                event_type="update",
            )
        ),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "skipped_no_change"


# ── Log row written for every call ────────────────────────────────────────────


@pytest.mark.django_db
def test_log_row_written_for_every_call(client):
    admin = _user("Project Lead")
    before = RealtimeSyncLog.objects.count()

    for _ in range(3):
        uid = next(_UID)
        resp = client.post(
            _url(uid),
            data=json.dumps(_payload()),
            content_type="application/json",
            **_h(admin),
        )
        assert resp.status_code == 200

    assert RealtimeSyncLog.objects.count() == before + 3


# ── Schema validation ─────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_missing_required_field_returns_422(client):
    admin = _user("Project Lead")
    uid = next(_UID)
    # Missing required field: event_type
    bad_payload = {"user_login": "missing_event_type@test.com"}
    resp = client.post(
        _url(uid),
        data=json.dumps(bad_payload),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 422


# ── Concurrent serialisation ──────────────────────────────────────────────────


@pytest.mark.django_db(transaction=True)
def test_concurrent_events_serialize(client):
    """Two threads posting for the same user_id both complete without error."""
    admin = _user("Project Lead")
    uid = next(_UID)
    body = _payload(
        user_login=f"concurrent{uid}@test.com",
        user_role="Youth",
        event_type="insert",
    )
    headers = _h(admin)
    results = []

    def post():
        c = Client()
        resp = c.post(
            _url(uid),
            data=json.dumps(body),
            content_type="application/json",
            **headers,
        )
        results.append(resp.status_code)

    t1 = threading.Thread(target=post)
    t2 = threading.Thread(target=post)
    t1.start()
    t2.start()
    t1.join(timeout=10)
    t2.join(timeout=10)

    assert len(results) == 2
    assert all(r == 200 for r in results)
