"""
F-M1-2: Hasura Scheduled Sync — unit tests (mocked HTTP).

TC-M1-2-01  fetch_users strips decimal suffix from user_id
TC-M1-2-02  fetch_partners passes updated_after query param
TC-M1-2-03  hasura client raises HasuraError on non-200
TC-M1-2-04  sync creates new users
TC-M1-2-05  sync updates existing users
TC-M1-2-06  sync creates new partners
TC-M1-2-07  sync marks removed partner inactive
TC-M1-2-08  sync reactivates previously removed partner
TC-M1-2-09  sync does not touch user is_active
TC-M1-2-10  sync creates SyncRun with success status
TC-M1-2-11  sync marks SyncRun failed on Hasura exception
TC-M1-2-12  sync is idempotent (running twice = same state)
"""

import os
from unittest.mock import MagicMock, patch

import pytest

from sessionops.models import Partner, SyncRun, User
from sessionops.services.hasura.client import HasuraError, fetch_partners, fetch_users
from sessionops.services.sync import run_sync

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

# Raw format as Hasura sends it (decimal string user_id)
USER_ROW_RAW = {
    "user_id": "2273058.000000000",
    "user_login": "Priya.Menon@makeadiff.in",
    "user_display_name": "Priya Menon",
    "email": "Priya.Menon@makeadiff.in",
    "user_role": "CO Full Time",
}

# Parsed format returned by fetch_users() after stripping the decimal suffix
USER_ROW = {
    "user_id": 2273058,
    "user_login": "Priya.Menon@makeadiff.in",
    "user_display_name": "Priya Menon",
    "email": "Priya.Menon@makeadiff.in",
    "user_role": "CO Full Time",
}

PARTNER_ROW = {
    "partner_id": 580,
    "partner_name": "Govt. High School Shaikpet",
    "co_id": 2273058,
    "co_name": "Priya Menon",
    "city": "Hyderabad",
    "state": "Telangana",
    "crm_partner_removed": False,
}

FAKE_ENV = {
    "HASURA_API_BASE_URL": "https://hasura.test",
    "HASURA_API_JWT": "test-jwt-token",
}


# ---------------------------------------------------------------------------
# TC-M1-2-01  fetch_users strips decimal suffix
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_fetch_users_strips_decimal_suffix():
    payload = {"prod_external_apps_user_data": [dict(USER_ROW_RAW)]}
    mock_resp = MagicMock(status_code=200)
    mock_resp.json.return_value = payload

    with patch.dict(os.environ, FAKE_ENV):
        with patch("sessionops.services.hasura.client.requests.get", return_value=mock_resp):
            rows = fetch_users()

    assert rows[0]["user_id"] == 2273058


# ---------------------------------------------------------------------------
# TC-M1-2-02  fetch_partners passes updated_after param
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_fetch_partners_uses_updated_after_param():
    payload = {"prod_external_apps_partner_data": [dict(PARTNER_ROW)]}
    mock_resp = MagicMock(status_code=200)
    mock_resp.json.return_value = payload

    with patch.dict(os.environ, FAKE_ENV):
        with patch(
            "sessionops.services.hasura.client.requests.get", return_value=mock_resp
        ) as mock_get:
            fetch_partners()

    assert "updated_after" in mock_get.call_args.kwargs["params"]


# ---------------------------------------------------------------------------
# TC-M1-2-03  client raises HasuraError on non-200
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_hasura_client_raises_on_non_200():
    mock_resp = MagicMock(status_code=403, text="Forbidden")

    with patch.dict(os.environ, FAKE_ENV):
        with patch("sessionops.services.hasura.client.requests.get", return_value=mock_resp):
            with pytest.raises(HasuraError):
                fetch_users()


# ---------------------------------------------------------------------------
# TC-M1-2-04  sync creates new users
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_sync_creates_new_users():
    users_payload = [dict(USER_ROW)]
    partners_payload = []

    with _mock_hasura(users_payload, partners_payload):
        sync_run = run_sync()

    assert sync_run.status == SyncRun.STATUS_SUCCESS
    assert sync_run.users_created == 1
    assert User.objects.filter(user_id=2273058).exists()


# ---------------------------------------------------------------------------
# TC-M1-2-05  sync updates existing users
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_sync_updates_existing_users():
    User.objects.create(
        user_id=2273058,
        user_login="priya.menon@makeadiff.in",
        user_display_name="Old Name",
        email="priya.menon@makeadiff.in",
        user_role="CO Full Time",
    )

    updated_row = dict(USER_ROW)
    updated_row["user_display_name"] = "Priya Updated"

    with _mock_hasura([updated_row], []):
        sync_run = run_sync()

    assert sync_run.users_updated == 1
    assert sync_run.users_created == 0
    user = User.objects.get(user_id=2273058)
    assert user.user_display_name == "Priya Updated"


# ---------------------------------------------------------------------------
# TC-M1-2-06  sync creates new partners
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_sync_creates_new_partners():
    with _mock_hasura([], [dict(PARTNER_ROW)]):
        sync_run = run_sync()

    assert sync_run.status == SyncRun.STATUS_SUCCESS
    assert sync_run.partners_created == 1
    assert Partner.objects.filter(partner_id=580).exists()


# ---------------------------------------------------------------------------
# TC-M1-2-07  sync marks removed partner inactive
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_sync_marks_removed_partner_inactive():
    removed_row = dict(PARTNER_ROW)
    removed_row["crm_partner_removed"] = True

    with _mock_hasura([], [removed_row]):
        run_sync()

    partner = Partner.all_objects.get(partner_id=580)
    assert partner.is_active is False
    assert partner.crm_partner_removed is True


# ---------------------------------------------------------------------------
# TC-M1-2-08  sync reactivates previously removed partner
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_sync_reactivates_previously_removed_partner():
    # First: create as removed
    Partner.all_objects.create(
        partner_id=580,
        partner_name="Old School",
        is_active=False,
        crm_partner_removed=True,
    )

    # Now sync with crm_partner_removed=False
    reactivated_row = dict(PARTNER_ROW)
    reactivated_row["crm_partner_removed"] = False

    with _mock_hasura([], [reactivated_row]):
        run_sync()

    partner = Partner.all_objects.get(partner_id=580)
    assert partner.is_active is True
    assert partner.crm_partner_removed is False


# ---------------------------------------------------------------------------
# TC-M1-2-09  sync does not touch user is_active
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_sync_does_not_touch_user_is_active():
    user = User.objects.create(
        user_id=2273058,
        user_login="priya.menon@makeadiff.in",
        user_display_name="Priya Menon",
        email="priya.menon@makeadiff.in",
        user_role="CO Full Time",
        is_active=False,  # manually deactivated
    )

    with _mock_hasura([dict(USER_ROW)], []):
        run_sync()

    user.refresh_from_db()
    assert user.is_active is False  # sync must NOT change this


# ---------------------------------------------------------------------------
# TC-M1-2-10  sync creates SyncRun with success status
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_sync_creates_sync_run_on_success():
    with _mock_hasura([dict(USER_ROW)], [dict(PARTNER_ROW)]):
        sync_run = run_sync()

    assert sync_run.status == SyncRun.STATUS_SUCCESS
    assert sync_run.completed_at is not None
    assert sync_run.users_fetched == 1
    assert sync_run.partners_fetched == 1
    assert SyncRun.objects.count() == 1


# ---------------------------------------------------------------------------
# TC-M1-2-11  sync marks SyncRun failed on exception
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_sync_marks_run_failed_on_exception():
    from sessionops.services.hasura.client import HasuraError

    with patch("sessionops.services.sync.fetch_users", side_effect=HasuraError("timeout")):
        with pytest.raises(HasuraError):
            run_sync()

    sync_run = SyncRun.objects.get()
    assert sync_run.status == SyncRun.STATUS_FAILED
    assert "timeout" in sync_run.error_message
    assert sync_run.completed_at is not None


# ---------------------------------------------------------------------------
# TC-M1-2-12  sync is idempotent
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_sync_is_idempotent():
    with _mock_hasura([dict(USER_ROW)], [dict(PARTNER_ROW)]):
        run_sync()

    with _mock_hasura([dict(USER_ROW)], [dict(PARTNER_ROW)]):
        run_sync()

    assert User.objects.filter(user_id=2273058).count() == 1
    assert Partner.objects.filter(partner_id=580).count() == 1
    assert SyncRun.objects.count() == 2  # two separate runs logged


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _mock_hasura(users: list, partners: list):
    """Patch all 3 hasura client functions in sync.py.

    run_sync() always runs all 3 phases (users, partners, partner_worknode) —
    fetch_chapter_mapping must be mocked too, or the real implementation runs
    and raises "HASURA_API_BASE_URL is not set" trying to make a real HTTP call.
    """
    from unittest.mock import patch

    return patch.multiple(
        "sessionops.services.sync",
        fetch_users=MagicMock(return_value=users),
        fetch_partners=MagicMock(return_value=partners),
        fetch_chapter_mapping=MagicMock(return_value=[]),
    )
