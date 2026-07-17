"""
F-M8a-4: Worknode cascade flow tests.

Tests cover all three sub-flows (worknode_added, worknode_updated, worknode_removed)
and the helpers (_resolve_school_for_worknode, _ensure_school_volunteer,
_cleanup_other_school_assignments, _cascade_remove_user_from_school).
"""

from datetime import time

import pytest
from django.utils import timezone

from sessionops.models import (
    AcademicYear,
    Class,
    ClassSection,
    ClassSectionSubject,
    PartnerWorknode,
    Partner,
    Program,
    SchoolAcademicYear,
    SchoolClass,
    SchoolVolunteer,
    Slot,
    SlotClassSection,
    SlotClassSectionVolunteer,
    Subject,
    User,
)
from sessionops.services.realtime_sync.diff import UserDiff
from sessionops.services.realtime_sync.flows.cascade import (
    _resolve_school_for_worknode,
    cascade_worknode_added,
    cascade_worknode_removed,
    cascade_worknode_updated,
    handle_worknode_change,
)
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload

# ── ID generators ──────────────────────────────────────────────────────────────

_UID = iter(range(8_000_000, 8_200_000))
_SID = iter(range(30_000, 40_000))
_WID = iter(range(50_000, 60_000))


# ── Helpers ────────────────────────────────────────────────────────────────────


def _user(**kwargs) -> User:
    uid = next(_UID)
    defaults = dict(
        user_id=uid,
        user_login=f"u{uid}@cascade.test",
        user_display_name=f"Cascade User {uid}",
        email=f"u{uid}@cascade.test",
        user_role="Youth",
        worknode_id=None,
        is_active=True,
    )
    defaults.update(kwargs)
    return User.objects.create(**defaults)


def _admin() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"admin{uid}@cascade.test",
        user_display_name=f"Admin {uid}",
        email=f"admin{uid}@cascade.test",
        user_role="Project Lead",
        is_active=True,
    )


def _school(admin: User) -> int:
    """Create a Partner (school) and return its integer partner_id."""
    sid = next(_SID)
    Partner.objects.create(
        partner_id=sid,
        partner_name=f"School {sid}",
        co_id=admin.user_id,
        converted=True,
        is_active=True,
    )
    return sid


def _worknode(school_id: int) -> int:
    """Create a PartnerWorknode mapping and return the worknode_id."""
    wid = next(_WID)
    PartnerWorknode.objects.create(
        partner_id=str(school_id),
        worknode_id=wid,
    )
    return wid


def _say(school_id: int, admin: User) -> SchoolAcademicYear:
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027",
        defaults={"is_active": True, "created_by": admin},
    )
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id,
        academic_year_id=year,
        defaults={"created_by": admin},
    )
    return say


def _slot(school_id: int, admin: User) -> Slot:
    say = _say(school_id, admin)
    return Slot.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        slot_name="Monday 09:00",
        day_of_week="monday",
        start_time=time(9, 0),
        end_time=time(10, 0),
        recurring=True,
        is_active=True,
        created_by=admin,
    )


def _css(school_id: int, admin: User) -> ClassSectionSubject:
    """Create a minimal ClassSectionSubject chain for cascade tests."""
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    cls, _ = Class.objects.get_or_create(
        class_code="5C",
        defaults={"class_name": "5th", "program_id": program, "is_active": True},
    )
    say = _say(school_id, admin)
    sc = SchoolClass.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        class_id_id=cls.class_id,
        created_by=admin,
    )
    section = ClassSection.objects.create(
        school_class_id=sc,
        school_id=school_id,
        section_code="A",
        section_name="5th - A",
        is_active=True,
        created_by=admin,
    )
    subj, _ = Subject.objects.get_or_create(
        subject_name="Foundation Day 1",
        defaults={"program_id": program},
    )
    return ClassSectionSubject.objects.create(
        class_section_id=section,
        subject_id=subj,
        is_active=True,
        created_by=admin,
    )


def _scs(slot: Slot, css: ClassSectionSubject, admin: User) -> SlotClassSection:
    return SlotClassSection.objects.create(
        slot_id=slot,
        class_section_id=css.class_section_id,
        class_section_subject_id=css,
        is_active=True,
        created_by=admin,
    )


def _scsv(scs: SlotClassSection, volunteer: User, admin: User) -> SlotClassSectionVolunteer:
    return SlotClassSectionVolunteer.objects.create(
        slot_class_section_id=scs,
        volunteer_id=volunteer,
        is_active=True,
        created_by=admin,
    )


def _payload(user: User, worknode_id=None, **kwargs) -> RealtimeSyncUserPayload:
    defaults = dict(
        user_login=user.user_login,
        user_display_name=user.user_display_name,
        user_email=user.email,
        user_role=user.user_role,
        worknode_id=worknode_id,
        user_active_status=True,
        event_type="update",
    )
    defaults.update(kwargs)
    return RealtimeSyncUserPayload(**defaults)


def _diff(worknode_action: str = "none") -> UserDiff:
    return UserDiff(user_exists_locally=True, worknode_action=worknode_action)


# ── _resolve_school_for_worknode ───────────────────────────────────────────────


@pytest.mark.django_db
def test_resolve_returns_none_when_no_mapping():
    assert _resolve_school_for_worknode(999999) is None


@pytest.mark.django_db
def test_resolve_returns_school_id_as_int():
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    assert _resolve_school_for_worknode(wid) == sid


# ── worknode_added ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_worknode_added_creates_school_volunteer():
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    vol = _user(worknode_id=None)
    now = timezone.now()

    result = cascade_worknode_added(vol, _payload(vol, worknode_id=wid), _diff(), now, [], [])

    assert result.status == "success"
    assert result.action_taken == "worknode_added"
    assert SchoolVolunteer.objects.filter(
        school_id=sid, volunteer_id=vol, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_worknode_added_sets_worknode_id_on_user():
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    vol = _user(worknode_id=None)
    now = timezone.now()

    cascade_worknode_added(vol, _payload(vol, worknode_id=wid), _diff(), now, [], [])

    vol.refresh_from_db()
    assert vol.worknode_id == wid


@pytest.mark.django_db
def test_worknode_added_partial_success_when_no_mapping():
    vol = _user(worknode_id=None)
    now = timezone.now()

    result = cascade_worknode_added(
        vol, _payload(vol, worknode_id=99999), _diff(), now, [], []
    )

    assert result.status == "partial_success"
    assert result.action_taken == "no_school_found_for_worknode"
    assert result.deferred_operations["reason"] == "no_partner_worknode_mapping"


@pytest.mark.django_db
def test_worknode_added_does_not_set_worknode_id_on_partial():
    vol = _user(worknode_id=None)
    now = timezone.now()

    cascade_worknode_added(vol, _payload(vol, worknode_id=99999), _diff(), now, [], [])

    vol.refresh_from_db()
    assert vol.worknode_id is None


@pytest.mark.django_db
def test_worknode_added_preserves_existing_sv_at_same_school():
    """Core scenario: user already has SV at school A, new worknode maps to same school A.
    The existing SchoolVolunteer must NOT be removed or duplicated."""
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    vol = _user(worknode_id=None)
    # Pre-existing active SchoolVolunteer at the same school
    existing_sv = SchoolVolunteer.objects.create(
        school_id=sid, volunteer_id=vol
    )
    now = timezone.now()

    result = cascade_worknode_added(vol, _payload(vol, worknode_id=wid), _diff(), now, [], [])

    assert result.status == "success"
    existing_sv.refresh_from_db()
    assert existing_sv.is_active is True  # untouched
    assert existing_sv.removed is False   # untouched
    # Only one SchoolVolunteer row at this school
    assert SchoolVolunteer.objects.filter(
        school_id=sid, volunteer_id=vol, is_active=True, removed=False
    ).count() == 1
    # cascaded_changes has no "created" entry (SV already existed)
    created_entries = [c for c in result.cascaded_changes if c.get("action") == "created"]
    assert len(created_entries) == 0


@pytest.mark.django_db
def test_worknode_added_cleans_up_drift_at_other_school():
    """User has drift SV at school B; new worknode maps to school A. B must be cleaned up."""
    admin = _admin()
    sid_a = _school(admin)
    sid_b = _school(admin)
    wid_a = _worknode(sid_a)
    vol = _user(worknode_id=None)
    # Drift: active SV at school B
    SchoolVolunteer.objects.create(school_id=sid_b, volunteer_id=vol)
    now = timezone.now()

    result = cascade_worknode_added(vol, _payload(vol, worknode_id=wid_a), _diff(), now, [], [])

    assert result.status == "success"
    # School B's SV soft-deleted
    assert not SchoolVolunteer.objects.filter(
        school_id=sid_b, volunteer_id=vol, is_active=True, removed=False
    ).exists()
    # School A's SV created
    assert SchoolVolunteer.objects.filter(
        school_id=sid_a, volunteer_id=vol, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_worknode_added_logs_school_volunteer_in_cascaded_changes():
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    vol = _user(worknode_id=None)
    cascaded_changes: list = []
    now = timezone.now()

    cascade_worknode_added(vol, _payload(vol, worknode_id=wid), _diff(), now, cascaded_changes, [])

    sv_entries = [c for c in cascaded_changes if c["table"] == "school_volunteer"]
    assert len(sv_entries) == 1
    assert sv_entries[0]["action"] == "created"
    assert sv_entries[0]["school_id"] == sid


# ── worknode_removed ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_worknode_removed_soft_deletes_school_volunteer():
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    vol = _user(worknode_id=wid)
    SchoolVolunteer.objects.create(school_id=sid, volunteer_id=vol)
    now = timezone.now()

    result = cascade_worknode_removed(vol, _payload(vol, worknode_id=None), _diff(), now, [], [])

    assert result.status == "success"
    assert result.action_taken == "worknode_removed"
    assert not SchoolVolunteer.objects.filter(
        school_id=sid, volunteer_id=vol, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_worknode_removed_sets_worknode_id_to_null():
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    vol = _user(worknode_id=wid)
    now = timezone.now()

    cascade_worknode_removed(vol, _payload(vol, worknode_id=None), _diff(), now, [], [])

    vol.refresh_from_db()
    assert vol.worknode_id is None


@pytest.mark.django_db
def test_worknode_removed_cascades_slot_class_assignments():
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    vol = _user(worknode_id=wid)
    SchoolVolunteer.objects.create(school_id=sid, volunteer_id=vol)
    slot = _slot(sid, admin)
    css = _css(sid, admin)
    scs = _scs(slot, css, admin)
    scsv = _scsv(scs, vol, admin)
    now = timezone.now()

    cascade_worknode_removed(vol, _payload(vol, worknode_id=None), _diff(), now, [], [])

    scsv.refresh_from_db()
    assert scsv.is_active is False
    scs.refresh_from_db()
    assert scs.is_active is False  # no remaining volunteers
    css.refresh_from_db()
    assert css.is_active is False  # no remaining SCS


@pytest.mark.django_db
def test_worknode_removed_does_not_cascade_scs_when_other_volunteer_present():
    """If another volunteer is still in the SCS, the SCS must NOT be soft-deleted."""
    admin = _admin()
    sid = _school(admin)
    wid_a = _worknode(sid)
    wid_b = _worknode(sid)
    vol_a = _user(worknode_id=wid_a)
    vol_b = _user(worknode_id=wid_b)
    SchoolVolunteer.objects.create(school_id=sid, volunteer_id=vol_a)
    SchoolVolunteer.objects.create(school_id=sid, volunteer_id=vol_b)
    slot = _slot(sid, admin)
    css = _css(sid, admin)
    scs = _scs(slot, css, admin)
    scsv_a = _scsv(scs, vol_a, admin)
    _scsv(scs, vol_b, admin)  # vol_b still in this SCS
    now = timezone.now()

    cascade_worknode_removed(vol_a, _payload(vol_a, worknode_id=None), _diff(), now, [], [])

    scsv_a.refresh_from_db()
    assert scsv_a.is_active is False  # vol_a's row gone
    scs.refresh_from_db()
    assert scs.is_active is True  # vol_b still there → SCS survives
    css.refresh_from_db()
    assert css.is_active is True  # SCS still active → CSS survives


@pytest.mark.django_db
def test_worknode_removed_no_old_school_no_cascade():
    """Edge case: user.worknode_id=None but worknode_action=removed — no errors, empty changes."""
    vol = _user(worknode_id=None)
    cascaded_changes: list = []
    now = timezone.now()

    result = cascade_worknode_removed(
        vol, _payload(vol, worknode_id=None), _diff(), now, cascaded_changes, []
    )

    assert result.status == "success"
    assert cascaded_changes == []


# ── worknode_updated ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_worknode_updated_removes_from_old_school_and_adds_to_new():
    admin = _admin()
    sid_a = _school(admin)
    sid_b = _school(admin)
    wid_a = _worknode(sid_a)
    wid_b = _worknode(sid_b)
    vol = _user(worknode_id=wid_a)
    SchoolVolunteer.objects.create(school_id=sid_a, volunteer_id=vol)
    now = timezone.now()

    result = cascade_worknode_updated(
        vol, _payload(vol, worknode_id=wid_b), _diff(), now, [], []
    )

    assert result.status == "success"
    assert result.action_taken == "worknode_updated"
    # Old school SV soft-deleted
    assert not SchoolVolunteer.objects.filter(
        school_id=sid_a, volunteer_id=vol, is_active=True, removed=False
    ).exists()
    # New school SV created
    assert SchoolVolunteer.objects.filter(
        school_id=sid_b, volunteer_id=vol, is_active=True, removed=False
    ).exists()
    vol.refresh_from_db()
    assert vol.worknode_id == wid_b


@pytest.mark.django_db
def test_worknode_updated_partial_success_when_new_mapping_missing():
    admin = _admin()
    sid_a = _school(admin)
    wid_a = _worknode(sid_a)
    vol = _user(worknode_id=wid_a)
    SchoolVolunteer.objects.create(school_id=sid_a, volunteer_id=vol)
    now = timezone.now()

    result = cascade_worknode_updated(
        vol, _payload(vol, worknode_id=99999), _diff(), now, [], []
    )

    assert result.status == "partial_success"
    assert result.action_taken == "no_school_found_for_worknode"
    vol.refresh_from_db()
    assert vol.worknode_id == wid_a  # not updated


@pytest.mark.django_db
def test_worknode_updated_old_school_not_cascaded_on_partial():
    """When new school can't be resolved, the old school must NOT be touched."""
    admin = _admin()
    sid_a = _school(admin)
    wid_a = _worknode(sid_a)
    vol = _user(worknode_id=wid_a)
    sv = SchoolVolunteer.objects.create(school_id=sid_a, volunteer_id=vol)
    now = timezone.now()

    cascade_worknode_updated(vol, _payload(vol, worknode_id=99999), _diff(), now, [], [])

    sv.refresh_from_db()
    assert sv.is_active is True  # old school SV untouched


@pytest.mark.django_db
def test_worknode_updated_cascades_slot_class_at_old_school():
    admin = _admin()
    sid_a = _school(admin)
    sid_b = _school(admin)
    wid_a = _worknode(sid_a)
    wid_b = _worknode(sid_b)
    vol = _user(worknode_id=wid_a)
    SchoolVolunteer.objects.create(school_id=sid_a, volunteer_id=vol)
    slot_a = _slot(sid_a, admin)
    css_a = _css(sid_a, admin)
    scs_a = _scs(slot_a, css_a, admin)
    scsv_a = _scsv(scs_a, vol, admin)
    now = timezone.now()

    cascade_worknode_updated(vol, _payload(vol, worknode_id=wid_b), _diff(), now, [], [])

    scsv_a.refresh_from_db()
    assert scsv_a.is_active is False  # old school slot-class cascade fired
    scs_a.refresh_from_db()
    assert scs_a.is_active is False


# ── cascaded_changes log ───────────────────────────────────────────────────────


@pytest.mark.django_db
def test_cascaded_changes_contains_sv_soft_deleted_on_removed():
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    vol = _user(worknode_id=wid)
    SchoolVolunteer.objects.create(school_id=sid, volunteer_id=vol)
    cascaded_changes: list = []
    now = timezone.now()

    cascade_worknode_removed(
        vol, _payload(vol, worknode_id=None), _diff(), now, cascaded_changes, []
    )

    sv_entries = [c for c in cascaded_changes if c["table"] == "school_volunteer"]
    assert any(e["action"] == "soft_deleted" for e in sv_entries)


# ── deferred_operations ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_deferred_operations_set_on_partial_success_added():
    vol = _user(worknode_id=None)
    now = timezone.now()

    result = cascade_worknode_added(vol, _payload(vol, worknode_id=99999), _diff(), now, [], [])

    assert result.deferred_operations is not None
    assert result.deferred_operations["worknode_id"] == 99999
    assert "ensure_school_volunteer" in result.deferred_operations["skipped_actions"]


@pytest.mark.django_db
def test_deferred_operations_set_on_partial_success_updated():
    admin = _admin()
    sid_a = _school(admin)
    wid_a = _worknode(sid_a)
    vol = _user(worknode_id=wid_a)
    now = timezone.now()

    result = cascade_worknode_updated(
        vol, _payload(vol, worknode_id=99999), _diff(), now, [], []
    )

    assert result.deferred_operations is not None
    assert result.deferred_operations["new_worknode_id"] == 99999
    assert result.deferred_operations["old_worknode_id"] == wid_a


# ── handle_worknode_change dispatcher ─────────────────────────────────────────


@pytest.mark.django_db
def test_dispatcher_routes_added():
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    vol = _user(worknode_id=None)
    now = timezone.now()

    result = handle_worknode_change(
        vol, _payload(vol, worknode_id=wid), _diff(worknode_action="added"), now
    )

    assert result.action_taken == "worknode_added"


@pytest.mark.django_db
def test_dispatcher_routes_removed():
    admin = _admin()
    sid = _school(admin)
    wid = _worknode(sid)
    vol = _user(worknode_id=wid)
    now = timezone.now()

    result = handle_worknode_change(
        vol, _payload(vol, worknode_id=None), _diff(worknode_action="removed"), now
    )

    assert result.action_taken == "worknode_removed"


@pytest.mark.django_db
def test_dispatcher_routes_updated():
    admin = _admin()
    sid_a = _school(admin)
    sid_b = _school(admin)
    wid_a = _worknode(sid_a)
    wid_b = _worknode(sid_b)
    vol = _user(worknode_id=wid_a)
    now = timezone.now()

    result = handle_worknode_change(
        vol, _payload(vol, worknode_id=wid_b), _diff(worknode_action="updated"), now
    )

    assert result.action_taken == "worknode_updated"


def test_dispatcher_raises_on_unexpected_action():
    diff = _diff(worknode_action="none")
    with pytest.raises(ValueError, match="unexpected worknode_action"):
        handle_worknode_change(None, None, diff, timezone.now())
