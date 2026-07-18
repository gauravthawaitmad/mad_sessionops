"""
F-M4-4 / F-M4-5 / F-M4-7: Admin sync dashboard API integration tests.
"""

from unittest.mock import MagicMock, patch

from django.test import Client

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import SyncRun, User

HASURA_USER_ROW = {
    "user_id": 88001,
    "user_login": "test@makeadiff.in",
    "user_display_name": "Test User",
    "email": "test@makeadiff.in",
    "user_role": "CO Full Time",
}

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_700_000, 9_800_000))


def _user(role: str) -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"u{uid}@t.com",
        user_display_name=f"User{uid}",
        email=f"u{uid}@t.com",
        user_role=role,
        is_active=True,
    )


def _tok(user: User) -> str:
    r = RefreshToken()
    for k in ("user_id", "email"):
        v = getattr(user, k if k != "email" else "email")
        r[k] = v
        r.access_token[k] = v
    return str(r.access_token)


def _h(user: User) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {_tok(user)}"}


def _sync_run(**kwargs) -> SyncRun:
    defaults = {
        "status": SyncRun.STATUS_SUCCESS,
        "entity_sync_type": SyncRun.ENTITY_SYNC_TYPE_ALL,
        "run_type": SyncRun.RUN_TYPE_AUTO,
    }
    defaults.update(kwargs)
    return SyncRun.objects.create(**defaults)


@pytest.fixture
def client():
    return Client()


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_admin_runs_returns_200_for_admin(client):
    admin = _user("Project Lead")
    _sync_run()
    resp = client.get("/api/admin/sync/runs/", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.django_db
def test_admin_runs_returns_403_for_co(client):
    co = _user("CO Full Time")
    resp = client.get("/api/admin/sync/runs/", **_h(co))
    assert resp.status_code == 403


@pytest.mark.django_db
def test_admin_runs_returns_403_for_cho(client):
    cho = _user("CHO")
    resp = client.get("/api/admin/sync/runs/", **_h(cho))
    assert resp.status_code == 403


@pytest.mark.django_db
def test_get_run_detail_returns_full_row(client):
    admin = _user("Function Lead")
    run = _sync_run(status=SyncRun.STATUS_FAILED, error_message="err")
    resp = client.get(f"/api/admin/sync/runs/{run.id}/", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["sync_run_id"] == run.id
    assert data["error_details"] == "err"
    assert data["status"] == "failed"


@pytest.mark.django_db
def test_list_runs_empty_state(client):
    admin = _user("Project Associate")
    resp = client.get("/api/admin/sync/runs/", **_h(admin))
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.django_db
def test_admin_stats_returns_200_for_admin(client):
    admin = _user("Project Lead")
    resp = client.get("/api/admin/sync/stats/", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert "entity_stats" in data
    assert "cron_health" in data
    assert "user" in data["entity_stats"]
    assert "healthy" in data["cron_health"]


# ── F-M4-5: Sync user by login API ────────────────────────────────────────────


@pytest.mark.django_db
def test_post_sync_user_by_login_returns_200(client):
    admin = _user("Project Lead")
    with patch(
        "sessionops.services.sync.single_user.fetch_user_by_login",
        return_value=dict(HASURA_USER_ROW),
    ):
        resp = client.post(
            "/api/admin/sync/user-by-login/",
            content_type="application/json",
            data={"user_login": "test@makeadiff.in"},
            **_h(admin),
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_login"] == "test@makeadiff.in"
    assert "sync_run_id" in data


@pytest.mark.django_db
def test_post_sync_user_by_login_returns_403_for_co(client):
    co = _user("CO Full Time")
    resp = client.post(
        "/api/admin/sync/user-by-login/",
        content_type="application/json",
        data={"user_login": "x@makeadiff.in"},
        **_h(co),
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_post_sync_user_by_login_returns_409_when_running(client):
    admin = _user("Project Lead")
    SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_ALL,
    )
    resp = client.post(
        "/api/admin/sync/user-by-login/",
        content_type="application/json",
        data={"user_login": "x@makeadiff.in"},
        **_h(admin),
    )
    assert resp.status_code == 409


# ── F-M4-7: Manual sync trigger API ───────────────────────────────────────────


@pytest.mark.django_db
def test_post_trigger_returns_200_for_admin(client):
    admin = _user("Project Lead")
    with patch("sessionops.services.sync.trigger.threading.Thread") as mock_thread_cls:
        mock_thread_cls.return_value = MagicMock()
        resp = client.post("/api/admin/sync/trigger/", content_type="application/json", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert "user_run_id" in data
    assert "partner_run_id" in data
    assert "partner_worknode_run_id" in data


@pytest.mark.django_db
def test_post_trigger_returns_403_for_co(client):
    co = _user("CO Full Time")
    resp = client.post("/api/admin/sync/trigger/", content_type="application/json", **_h(co))
    assert resp.status_code == 403


@pytest.mark.django_db
def test_post_trigger_returns_409_when_running(client):
    admin = _user("Function Lead")
    SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_ALL,
    )
    resp = client.post("/api/admin/sync/trigger/", content_type="application/json", **_h(admin))
    assert resp.status_code == 409
