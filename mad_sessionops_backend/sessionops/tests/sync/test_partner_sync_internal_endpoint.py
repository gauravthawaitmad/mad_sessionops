"""
Internal partner-sync trigger endpoint integration tests.

URL: /sync-partner-internal/  (default PARTNER_SYNC_ENDPOINT_PATH fallback)
Auth: service-token only — no admin JWT fallback (see partner_sync_internal_api.py).
The background thread is mocked out (same pattern as test_admin_sync_api.py) so
these tests only exercise the trigger/SyncRun-creation path, not the real
Hasura fetch.
"""

from unittest.mock import MagicMock, patch

from django.test import Client

import pytest

from sessionops.models import SyncRun

ENDPOINT = "/sync-partner-internal/"


@pytest.fixture
def client():
    return Client()


def _svc_h(token: str) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


@pytest.mark.django_db
def test_endpoint_rejects_unauthenticated(client):
    resp = client.post(ENDPOINT, content_type="application/json")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_endpoint_rejects_wrong_service_token(client):
    with patch("sessionops.services.sync.auth.PARTNER_SYNC_SERVICE_TOKEN", "correct-token"):
        resp = client.post(ENDPOINT, content_type="application/json", **_svc_h("wrong-token"))
    assert resp.status_code == 401


@pytest.mark.django_db
def test_endpoint_accepts_correct_service_token_and_triggers_partner_sync():
    client = Client()
    TEST_TOKEN = "n8n-partner-sync-secret"
    with (
        patch("sessionops.services.sync.auth.PARTNER_SYNC_SERVICE_TOKEN", TEST_TOKEN),
        patch("sessionops.services.sync.trigger.threading.Thread") as mock_thread_cls,
    ):
        mock_thread_cls.return_value = MagicMock()
        resp = client.post(ENDPOINT, content_type="application/json", **_svc_h(TEST_TOKEN))

    assert resp.status_code == 200
    data = resp.json()
    assert "partner_run_id" in data

    run = SyncRun.objects.get(id=data["partner_run_id"])
    assert run.entity_type == SyncRun.ENTITY_TYPE_PARTNER
    assert run.run_type == SyncRun.RUN_TYPE_AUTO
    assert run.triggered_by is None
    assert run.status == SyncRun.STATUS_RUNNING


@pytest.mark.django_db
def test_endpoint_returns_409_when_partner_sync_already_running():
    SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        entity_type=SyncRun.ENTITY_TYPE_PARTNER,
    )
    client = Client()
    TEST_TOKEN = "n8n-partner-sync-secret"
    with patch("sessionops.services.sync.auth.PARTNER_SYNC_SERVICE_TOKEN", TEST_TOKEN):
        resp = client.post(ENDPOINT, content_type="application/json", **_svc_h(TEST_TOKEN))
    assert resp.status_code == 409


@pytest.mark.django_db
def test_endpoint_does_not_block_on_user_sync_running():
    """Per-entity lock: a running USER sync must not block the partner-sync trigger."""
    SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        entity_type=SyncRun.ENTITY_TYPE_USER,
    )
    client = Client()
    TEST_TOKEN = "n8n-partner-sync-secret"
    with (
        patch("sessionops.services.sync.auth.PARTNER_SYNC_SERVICE_TOKEN", TEST_TOKEN),
        patch("sessionops.services.sync.trigger.threading.Thread") as mock_thread_cls,
    ):
        mock_thread_cls.return_value = MagicMock()
        resp = client.post(ENDPOINT, content_type="application/json", **_svc_h(TEST_TOKEN))
    assert resp.status_code == 200
