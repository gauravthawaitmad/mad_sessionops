"""
F-M8a-3: handle_insert flow unit tests.
"""

from django.utils import timezone

import pytest

from sessionops.models import AcademicYear, Partner, PartnerWorknode, SchoolVolunteer, User
from sessionops.services.realtime_sync.diff import UserDiff, compute_diff
from sessionops.services.realtime_sync.flows import FlowResult
from sessionops.services.realtime_sync.flows.cascade import SYSTEM_ADMIN_USER_ID
from sessionops.services.realtime_sync.flows.insert import handle_insert
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload

_UID = iter(range(7_300_000, 7_400_000))
_SID = iter(range(31_000, 32_000))
_WID = iter(range(51_000, 52_000))


@pytest.fixture(autouse=True)
def _system_admin_user(db):
    """cascade.py's _ensure_school_volunteer() attributes new SchoolVolunteer /
    SchoolAcademicYear rows to SYSTEM_ADMIN_USER_ID — must exist for every test
    here that exercises the worknode-resolves path."""
    admin, _ = User.objects.get_or_create(
        user_id=SYSTEM_ADMIN_USER_ID,
        defaults={
            "user_login": "system_admin@insert.test",
            "user_display_name": "System Admin",
            "email": "system_admin@insert.test",
            "user_role": "Project Lead",
            "is_active": True,
        },
    )
    if not AcademicYear.objects.filter(is_active=True, removed=False).exists():
        AcademicYear.objects.create(label="2026-2027", is_active=True, created_by=admin)


def _user(**kwargs) -> User:
    uid = next(_UID)
    defaults = dict(
        user_id=uid,
        user_login=f"u{uid}@insert.test",
        user_display_name=f"Insert User {uid}",
        email=f"u{uid}@insert.test",
        contact=None,
        user_role="Youth",
        worknode_id=None,
        is_active=True,
    )
    defaults.update(kwargs)
    return User.objects.create(**defaults)


def _payload(**kwargs) -> RealtimeSyncUserPayload:
    uid = next(_UID)
    defaults = dict(
        user_login=f"new{uid}@insert.test",
        user_display_name="New User",
        user_email=f"new{uid}@insert.test",
        user_phone="9876543210",
        user_role="Youth",
        worknode_id=None,
        user_active_status=True,
        event_type="insert",
    )
    defaults.update(kwargs)
    return RealtimeSyncUserPayload(**defaults)


def _new_diff(payload: RealtimeSyncUserPayload) -> UserDiff:
    """Mirrors what compute_diff() now returns for a true-INSERT (local_user=None)."""
    return UserDiff(
        user_exists_locally=False,
        worknode_action="added" if payload.worknode_id is not None else "none",
        incoming_role=payload.user_role,
    )


def _school_with_worknode() -> tuple[int, int]:
    """Create a Partner (school) + PartnerWorknode mapping. Returns (school_id, worknode_id)."""
    sid = next(_SID)
    wid = next(_WID)
    Partner.objects.create(
        partner_id=sid,
        partner_name=f"School {sid}",
        co_id=SYSTEM_ADMIN_USER_ID,
        converted=True,
        is_active=True,
    )
    PartnerWorknode.objects.create(partner_id=str(sid), worknode_id=wid)
    return sid, wid


# ── True INSERT (no local user) ────────────────────────────────────────────────


@pytest.mark.django_db
def test_handle_insert_creates_new_user():
    uid = next(_UID)
    payload = _payload(user_login=f"brand{uid}@insert.test", user_email=f"brand{uid}@insert.test")
    handle_insert(None, payload, _new_diff(payload), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.user_login == payload.user_login
    assert user.is_active is True


@pytest.mark.django_db
def test_handle_insert_sets_synced_at():
    uid = next(_UID)
    before = timezone.now()
    payload = _payload()
    handle_insert(None, payload, _new_diff(payload), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.synced_at is not None
    assert user.synced_at >= before


@pytest.mark.django_db
def test_handle_insert_sets_worknode_id_when_school_resolves():
    uid = next(_UID)
    _school_id, wid = _school_with_worknode()
    payload = _payload(worknode_id=wid)
    handle_insert(None, payload, _new_diff(payload), user_id=uid)
    assert User.objects.get(user_id=uid).worknode_id == wid


@pytest.mark.django_db
def test_handle_insert_creates_school_volunteer_when_worknode_resolves():
    uid = next(_UID)
    school_id, wid = _school_with_worknode()
    payload = _payload(worknode_id=wid)
    result = handle_insert(None, payload, _new_diff(payload), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert SchoolVolunteer.objects.filter(
        school_id=school_id, volunteer_id=user, is_active=True, removed=False
    ).exists()
    assert result.action_taken == "worknode_added"


@pytest.mark.django_db
def test_handle_insert_unresolvable_worknode_leaves_worknode_id_unset():
    # worknode_id has no PartnerWorknode mapping — user row still created (partial_success),
    # but worknode_id must NOT be stamped onto a school-less row (would orphan the FK intent).
    uid = next(_UID)
    payload = _payload(worknode_id=999_999)
    result = handle_insert(None, payload, _new_diff(payload), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.worknode_id is None
    assert user.is_active is True  # user row itself is still created
    assert result.status == "partial_success"


@pytest.mark.django_db
def test_handle_insert_null_worknode_id_stays_null():
    uid = next(_UID)
    payload = _payload(worknode_id=None)
    handle_insert(None, payload, _new_diff(payload), user_id=uid)
    assert User.objects.get(user_id=uid).worknode_id is None


@pytest.mark.django_db
def test_handle_insert_sets_location_fields():
    uid = next(_UID)
    payload = _payload(city="Mumbai", center="Dharavi", state="Maharashtra")
    handle_insert(None, payload, _new_diff(payload), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.city == "Mumbai"
    assert user.center == "Dharavi"
    assert user.state == "Maharashtra"


@pytest.mark.django_db
def test_handle_insert_sets_reporting_manager_fields():
    uid = next(_UID)
    payload = _payload(
        reporting_manager_user_login="mgr@test.com",
        reporting_manager_role_code="FL",
        reporting_manager_user_id=9900,
    )
    handle_insert(None, payload, _new_diff(payload), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.reporting_manager_user_login == "mgr@test.com"
    assert user.reporting_manager_role_code == "FL"
    assert user.reporting_manager_user_id == 9900


@pytest.mark.django_db
def test_handle_insert_maps_email_and_contact():
    uid = next(_UID)
    payload = _payload(user_email="e@test.com", user_phone="1234567890")
    handle_insert(None, payload, _new_diff(payload), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.email == "e@test.com"
    assert user.contact == "1234567890"


@pytest.mark.django_db
def test_handle_insert_returns_correct_flow_result():
    uid = next(_UID)
    payload = _payload()
    result = handle_insert(None, payload, _new_diff(payload), user_id=uid)
    assert isinstance(result, FlowResult)
    assert result.status == "success"
    assert result.action_taken == "user_created"


@pytest.mark.django_db
def test_handle_insert_diff_matches_compute_diff():
    # Guards against insert.py and diff.py's worknode_action logic drifting apart.
    uid = next(_UID)
    _school_id, wid = _school_with_worknode()
    payload = _payload(worknode_id=wid)
    diff = compute_diff(None, payload)
    assert diff.worknode_action == "added"

    result = handle_insert(None, payload, diff, user_id=uid)
    assert result.action_taken == "worknode_added"


# ── Re-activation (local user exists but is_active=False) ─────────────────────


@pytest.mark.django_db
def test_handle_insert_reactivates_soft_deleted_user():
    uid = next(_UID)
    existing = _user(user_id=uid, is_active=False, user_display_name="Old Name")
    payload = _payload(
        user_login=existing.user_login,
        user_email=existing.email,
        user_display_name="Reactivated",
        user_role="Wingman",
    )
    diff = UserDiff(user_exists_locally=True, is_reactivation=True, incoming_role="Wingman")

    handle_insert(existing, payload, diff, user_id=uid)

    existing.refresh_from_db()
    assert existing.is_active is True
    assert existing.user_display_name == "Reactivated"
    assert existing.user_role == "Wingman"


@pytest.mark.django_db
def test_handle_insert_reactivation_sets_synced_at():
    uid = next(_UID)
    existing = _user(user_id=uid, is_active=False, synced_at=None)
    payload = _payload(user_login=existing.user_login, user_email=existing.email)
    diff = UserDiff(user_exists_locally=True, is_reactivation=True, incoming_role="Youth")
    before = timezone.now()

    handle_insert(existing, payload, diff, user_id=uid)

    existing.refresh_from_db()
    assert existing.synced_at is not None
    assert existing.synced_at >= before


@pytest.mark.django_db
def test_handle_insert_reactivation_clears_deleted_at():
    uid = next(_UID)
    existing = _user(user_id=uid, is_active=False, deleted_at=timezone.now())
    payload = _payload(user_login=existing.user_login, user_email=existing.email)
    diff = UserDiff(user_exists_locally=True, is_reactivation=True, incoming_role="Youth")

    handle_insert(existing, payload, diff, user_id=uid)

    existing.refresh_from_db()
    assert existing.deleted_at is None


@pytest.mark.django_db
def test_handle_insert_reactivation_sets_worknode_id_when_school_resolves():
    uid = next(_UID)
    _school_id, wid = _school_with_worknode()
    existing = _user(user_id=uid, is_active=False, worknode_id=None)
    payload = _payload(user_login=existing.user_login, user_email=existing.email, worknode_id=wid)
    diff = UserDiff(
        user_exists_locally=True,
        is_reactivation=True,
        worknode_action="added",
        incoming_role="Youth",
    )

    handle_insert(existing, payload, diff, user_id=uid)

    existing.refresh_from_db()
    assert existing.worknode_id == wid


@pytest.mark.django_db
def test_handle_insert_reactivation_creates_school_volunteer():
    uid = next(_UID)
    school_id, wid = _school_with_worknode()
    existing = _user(user_id=uid, is_active=False, worknode_id=None)
    payload = _payload(user_login=existing.user_login, user_email=existing.email, worknode_id=wid)
    diff = UserDiff(
        user_exists_locally=True,
        is_reactivation=True,
        worknode_action="added",
        incoming_role="Youth",
    )

    handle_insert(existing, payload, diff, user_id=uid)

    assert SchoolVolunteer.objects.filter(
        school_id=school_id, volunteer_id=existing, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_handle_insert_reactivation_no_worknode_change_skips_cascade():
    uid = next(_UID)
    _school_id, wid = _school_with_worknode()
    existing = _user(user_id=uid, is_active=False, worknode_id=wid)
    payload = _payload(user_login=existing.user_login, user_email=existing.email, worknode_id=wid)
    diff = UserDiff(
        user_exists_locally=True,
        is_reactivation=True,
        worknode_action="none",
        incoming_role="Youth",
    )

    result = handle_insert(existing, payload, diff, user_id=uid)

    assert result.action_taken == "user_created"
    existing.refresh_from_db()
    assert existing.worknode_id == wid
