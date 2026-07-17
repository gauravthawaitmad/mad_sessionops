"""
Tests for F-M3-3: Worknode sync — user.worknode_id field + partner_worknode table.
"""

from unittest.mock import patch
from datetime import datetime, timezone

import pytest

from sessionops.models import PartnerWorknode, User
from sessionops.services.sync import _bulk_upsert_users, _run_partner_worknode_phase


def _now():
    return datetime.now(tz=timezone.utc)


def _make_sync_run():
    from sessionops.models import SyncRun
    return SyncRun.objects.create(status=SyncRun.STATUS_RUNNING, entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_ALL)


def _noop(msg: str) -> None:
    pass


# ── User worknode_id sync ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserWorknodeSyncField:
    def test_user_data_sync_writes_worknode_id(self):
        rows = [
            {
                "user_id": 9001,
                "user_login": "vol1@test.com",
                "user_display_name": "Vol One",
                "email": "vol1@test.com",
                "user_role": "Wingman",
                "worknode_id": 42,
            }
        ]
        _bulk_upsert_users(rows, _now())
        user = User.objects.get(user_id=9001)
        assert user.worknode_id == 42

    def test_user_data_sync_writes_null_worknode_id_when_absent(self):
        rows = [
            {
                "user_id": 9002,
                "user_login": "vol2@test.com",
                "user_display_name": "Vol Two",
                "email": "vol2@test.com",
                "user_role": "Wingman",
            }
        ]
        _bulk_upsert_users(rows, _now())
        user = User.objects.get(user_id=9002)
        assert user.worknode_id is None

    def test_user_data_sync_updates_worknode_id_on_re_sync(self):
        rows = [
            {
                "user_id": 9003,
                "user_login": "vol3@test.com",
                "user_display_name": "Vol Three",
                "email": "vol3@test.com",
                "user_role": "Wingman",
                "worknode_id": 10,
            }
        ]
        _bulk_upsert_users(rows, _now())

        rows[0]["worknode_id"] = 99
        _bulk_upsert_users(rows, _now())

        user = User.objects.get(user_id=9003)
        assert user.worknode_id == 99


# ── PartnerWorknode sync ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPartnerWorknodeSync:
    def test_partner_worknode_sync_upserts_rows(self):
        sync_run = _make_sync_run()
        chapter_rows = [
            {
                "chapter_id": "580",
                "worknode_id": 42,
                "city_name": "Hyderabad",
                "state": "Telangana",
                "co_name": "Ipshita Das",
                "chapter_name": "HYD Chapter",
                "engine": None,
                "chapter_status": "active",
                "sourcing_campaign_code": None,
                "campaign_name": None,
                "fundraiser_id": None,
                "fundraiser_name": None,
            }
        ]

        with patch(
            "sessionops.services.sync.fetch_chapter_mapping",
            return_value=chapter_rows,
        ):
            _run_partner_worknode_phase(sync_run, _now(), _noop)

        pw = PartnerWorknode.objects.get(partner_id="580")
        assert pw.worknode_id == 42
        assert pw.city_name == "Hyderabad"
        assert pw.chapter_name == "HYD Chapter"

    def test_partner_worknode_sync_idempotent(self):
        sync_run = _make_sync_run()
        chapter_rows = [
            {"chapter_id": "581", "worknode_id": 55, "city_name": "Pune"}
        ]

        with patch(
            "sessionops.services.sync.fetch_chapter_mapping",
            return_value=chapter_rows,
        ):
            _run_partner_worknode_phase(sync_run, _now(), _noop)
            _run_partner_worknode_phase(sync_run, _now(), _noop)

        assert PartnerWorknode.objects.filter(partner_id="581").count() == 1

    def test_partner_worknode_sync_removes_dropped_rows(self):
        PartnerWorknode.objects.create(partner_id="999", worknode_id=77)

        sync_run = _make_sync_run()
        chapter_rows = [
            {"chapter_id": "582", "worknode_id": 88}
        ]

        with patch(
            "sessionops.services.sync.fetch_chapter_mapping",
            return_value=chapter_rows,
        ):
            _run_partner_worknode_phase(sync_run, _now(), _noop)

        assert not PartnerWorknode.objects.filter(partner_id="999").exists()
        assert PartnerWorknode.objects.filter(partner_id="582").exists()

    def test_partner_worknode_sync_skips_rows_missing_chapter_id(self):
        sync_run = _make_sync_run()
        chapter_rows = [
            {"chapter_id": None, "worknode_id": 10},
            {"worknode_id": 20},
        ]

        with patch(
            "sessionops.services.sync.fetch_chapter_mapping",
            return_value=chapter_rows,
        ):
            _run_partner_worknode_phase(sync_run, _now(), _noop)

        assert PartnerWorknode.objects.count() == 0

    def test_partner_worknode_sync_updates_fields_on_re_sync(self):
        sync_run = _make_sync_run()
        first = [{"chapter_id": "583", "worknode_id": 11, "city_name": "Old City"}]
        second = [{"chapter_id": "583", "worknode_id": 11, "city_name": "New City"}]

        with patch("sessionops.services.sync.fetch_chapter_mapping", return_value=first):
            _run_partner_worknode_phase(sync_run, _now(), _noop)

        with patch("sessionops.services.sync.fetch_chapter_mapping", return_value=second):
            _run_partner_worknode_phase(sync_run, _now(), _noop)

        pw = PartnerWorknode.objects.get(partner_id="583")
        assert pw.city_name == "New City"
        assert PartnerWorknode.objects.filter(partner_id="583").count() == 1
