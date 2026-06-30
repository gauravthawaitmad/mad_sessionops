"""
F-M8a-2: allowlist.classify_event tests.
"""

import pytest

from sessionops.services.realtime_sync.allowlist import ACTIVE_ROLES, classify_event


# ── Active role → insert / update ─────────────────────────────────────────────


@pytest.mark.parametrize("role", sorted(ACTIVE_ROLES))
def test_active_role_insert_event_classified_as_insert(role):
    assert classify_event("insert", role) == "insert"


@pytest.mark.parametrize("role", sorted(ACTIVE_ROLES))
def test_active_role_update_event_classified_as_update(role):
    assert classify_event("update", role) == "update"


# Verify specific roles explicitly so a rename in ACTIVE_ROLES doesn't silently drop coverage
def test_youth_classified_as_update():
    assert classify_event("update", "Youth") == "update"


def test_cho_classified_as_update():
    assert classify_event("update", "CHO") == "update"


def test_co_full_time_classified_as_update():
    assert classify_event("update", "CO Full Time") == "update"


def test_admin_classified_as_update():
    assert classify_event("update", "Admin") == "update"


# ── Alumni → deactivate ───────────────────────────────────────────────────────


def test_alumni_classified_as_deactivate():
    assert classify_event("update", "Alumni") == "deactivate"


def test_alumni_insert_still_deactivate():
    assert classify_event("insert", "Alumni") == "deactivate"


# ── None role → deactivate ────────────────────────────────────────────────────


def test_null_role_classified_as_deactivate():
    assert classify_event("update", None) == "deactivate"


def test_null_role_insert_still_deactivate():
    assert classify_event("insert", None) == "deactivate"


# ── Unknown role → skipped ────────────────────────────────────────────────────


def test_unknown_role_classified_as_skipped():
    assert classify_event("update", "SomeOtherRole") == "skipped"


def test_empty_string_role_classified_as_skipped():
    assert classify_event("update", "") == "skipped"


def test_unknown_role_insert_classified_as_skipped():
    assert classify_event("insert", "UnknownRole") == "skipped"
