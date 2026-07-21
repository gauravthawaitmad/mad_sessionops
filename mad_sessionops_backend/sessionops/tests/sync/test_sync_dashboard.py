"""
F-M4-4: Sync dashboard service unit tests.
"""

from datetime import datetime, timedelta, timezone

from django.utils import timezone as dj_timezone

import pytest

from sessionops.models import Partner, PartnerWorknode, SyncRun, User
from sessionops.services.sync.dashboard import (
    get_cron_health,
    get_entity_stats,
    get_run_detail,
    list_recent_runs,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────

_UID = iter(range(8_000_000, 8_100_000))


def _sync_run(**kwargs) -> SyncRun:
    defaults = {
        "status": SyncRun.STATUS_SUCCESS,
        "entity_sync_type": SyncRun.ENTITY_SYNC_TYPE_ALL,
        "run_type": SyncRun.RUN_TYPE_AUTO,
    }
    defaults.update(kwargs)
    return SyncRun.objects.create(**defaults)


def _user(role: str = "CO Full Time") -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"u{uid}@t.com",
        user_display_name=f"User{uid}",
        email=f"u{uid}@t.com",
        user_role=role,
        is_active=True,
    )


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_list_recent_runs_returns_last_50_descending():
    for _ in range(60):
        _sync_run()
    runs = list(list_recent_runs(limit=50))
    assert len(runs) == 50
    # Descending order: first run started_at >= second
    for i in range(len(runs) - 1):
        assert runs[i].started_at >= runs[i + 1].started_at


@pytest.mark.django_db
def test_entity_stats_counts_correctly():
    _user()
    u2 = _user()
    u2.is_active = False
    u2.save()

    Partner.all_objects.create(partner_id=77001, partner_name="P1", is_active=True)
    Partner.all_objects.create(partner_id=77002, partner_name="P2", is_active=False)
    PartnerWorknode.objects.create(partner_id="500", worknode_id=1)
    PartnerWorknode.objects.create(partner_id="501", worknode_id=2)

    stats = get_entity_stats()
    assert stats["user"]["active"] >= 1
    assert stats["user"]["inactive"] >= 1
    assert stats["partner"]["active"] >= 1
    assert stats["partner"]["inactive"] >= 1
    assert stats["partner_worknode"]["total"] >= 2
    assert stats["partner_worknode"]["inactive"] == 0


@pytest.mark.django_db
def test_cron_health_green_when_recent_auto_success():
    recent_time = dj_timezone.now() - timedelta(hours=1)
    run = _sync_run(run_type=SyncRun.RUN_TYPE_AUTO, status=SyncRun.STATUS_SUCCESS)
    # Patch started_at to be 1 hour ago
    SyncRun.objects.filter(pk=run.pk).update(started_at=recent_time)

    health = get_cron_health()
    assert health["healthy"] is True
    assert health["hours_since_last_success"] is not None
    assert health["hours_since_last_success"] <= 2.0


@pytest.mark.django_db
def test_cron_health_red_when_last_success_over_2h_ago():
    old_time = dj_timezone.now() - timedelta(hours=5)
    run = _sync_run(run_type=SyncRun.RUN_TYPE_AUTO, status=SyncRun.STATUS_SUCCESS)
    SyncRun.objects.filter(pk=run.pk).update(started_at=old_time)

    health = get_cron_health()
    assert health["healthy"] is False
    assert health["hours_since_last_success"] > 2.0


@pytest.mark.django_db
def test_cron_health_red_when_never_synced():
    health = get_cron_health()
    assert health["healthy"] is False
    assert health["reason"] == "no_successful_sync_ever"
    assert health["last_successful_sync_at"] is None


@pytest.mark.django_db
def test_get_run_detail_returns_correct_row():
    run = _sync_run(status=SyncRun.STATUS_FAILED, error_message="timeout")
    detail = get_run_detail(run.id)
    assert detail.id == run.id
    assert detail.error_message == "timeout"
