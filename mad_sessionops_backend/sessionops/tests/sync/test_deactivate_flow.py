"""
F-M8a-5: Deactivation flow tests.

Tests cover handle_deactivate() directly:
- User doesn't exist locally → skipped_no_change
- User already deactivated → skipped_no_change
- User with no school assignments → just soft-deletes user row
- User with active SchoolVolunteer + SCSV → full cascade before deactivation
- User at multiple schools → cascades across all schools
- synced_at is updated on deactivation
"""

from datetime import time

from django.utils import timezone

import pytest

from sessionops.models import (
    AcademicYear,
    Class,
    ClassSection,
    ClassSectionSubject,
    Partner,
    PartnerWorknode,
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
from sessionops.services.realtime_sync.flows.deactivate import handle_deactivate
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload

# ── ID generators ──────────────────────────────────────────────────────────────

_UID = iter(range(7_000_000, 7_200_000))
_SID = iter(range(20_000, 30_000))
_WID = iter(range(70_000, 80_000))


# ── Helpers ────────────────────────────────────────────────────────────────────


def _user(**kwargs) -> User:
    uid = next(_UID)
    defaults = dict(
        user_id=uid,
        user_login=f"u{uid}@deact.test",
        user_display_name=f"User {uid}",
        email=f"u{uid}@deact.test",
        user_role="Youth",
        worknode_id=None,
        is_active=True,
    )
    defaults.update(kwargs)
    return User.objects.create(**defaults)


def _school() -> int:
    sid = next(_SID)
    co = _user(user_role="CO Full Time")
    Partner.objects.create(
        partner_id=sid,
        partner_name=f"School {sid}",
        co_id=co.user_id,
        converted=True,
        is_active=True,
    )
    return sid


def _worknode(user: User, school_id: int) -> int:
    wid = next(_WID)
    user.worknode_id = wid
    user.save(update_fields=["worknode_id"])
    PartnerWorknode.objects.create(partner_id=str(school_id), worknode_id=wid)
    return wid


def _school_volunteer(user: User, school_id: int) -> SchoolVolunteer:
    return SchoolVolunteer.objects.create(
        school_id=school_id,
        volunteer_id=user,
    )


def _slot(school_id: int, admin: User) -> Slot:
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027",
        defaults={"is_active": True, "created_by": admin},
    )
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id,
        academic_year_id=year,
        defaults={"created_by": admin},
    )
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


def _section(school_id: int, admin: User) -> ClassSection:
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    cls, _ = Class.objects.get_or_create(
        class_code="5d",
        defaults={"class_name": "5th", "program_id": program, "is_active": True},
    )
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027",
        defaults={"is_active": True, "created_by": admin},
    )
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id,
        academic_year_id=year,
        defaults={"created_by": admin},
    )
    sc = SchoolClass.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        class_id_id=cls.class_id,
        created_by=admin,
    )
    return ClassSection.objects.create(
        school_class_id=sc,
        school_id=school_id,
        section_code="A",
        section_name="5th - A",
        is_active=True,
        created_by=admin,
    )


def _subject(admin: User) -> Subject:
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    subj, _ = Subject.objects.get_or_create(
        subject_name="Deact Subject",
        defaults={"program_id": program},
    )
    return subj


def _scsv(user: User, school_id: int, admin: User) -> SlotClassSectionVolunteer:
    """Create a full SCSV chain: CSS → SCS → SCSV for user at school."""
    slot = _slot(school_id, admin)
    section = _section(school_id, admin)
    subject = _subject(admin)
    css = ClassSectionSubject.objects.create(
        class_section_id=section,
        subject_id=subject,
        created_by=admin,
    )
    scs = SlotClassSection.objects.create(
        slot_id=slot,
        class_section_id=section,
        class_section_subject_id=css,
        created_by=admin,
    )
    return SlotClassSectionVolunteer.objects.create(
        slot_class_section_id=scs,
        volunteer_id=user,
        created_by=admin,
    )


def _payload(user_role: str = "Alumni") -> RealtimeSyncUserPayload:
    uid = next(_UID)
    return RealtimeSyncUserPayload(
        user_login=f"u{uid}@deact.test",
        user_role=user_role,
        event_type="deactivate",
    )


# ── Tests ──────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_deactivate_nonexistent_user_returns_skipped_no_change():
    result = handle_deactivate(None, _payload(), diff=None, user_id=9_999_999)
    assert result.status == "skipped_no_change"
    assert result.action_taken == "no_change"


@pytest.mark.django_db
def test_deactivate_already_deactivated_user_returns_skipped_no_change():
    user = _user(is_active=False)
    result = handle_deactivate(user, _payload(), diff=None, user_id=user.user_id)
    assert result.status == "skipped_no_change"
    assert result.action_taken == "no_change"


@pytest.mark.django_db
def test_deactivate_user_soft_deletes_user_row():
    user = _user()
    before = timezone.now()

    result = handle_deactivate(user, _payload("Alumni"), diff=None, user_id=user.user_id)

    assert result.status == "success"
    assert result.action_taken == "user_deactivated"

    user.refresh_from_db()
    assert user.is_active is False
    assert user.deleted_at is not None
    assert user.deleted_at >= before
    assert user.synced_at is not None
    assert user.synced_at >= before
    assert user.user_role == "Alumni"


@pytest.mark.django_db
def test_deactivate_user_with_null_role():
    user = _user()
    result = handle_deactivate(user, _payload(user_role=None), diff=None, user_id=user.user_id)
    assert result.status == "success"
    user.refresh_from_db()
    assert user.is_active is False
    assert user.user_role == ""


@pytest.mark.django_db
def test_deactivate_updates_synced_at():
    user = _user()
    handle_deactivate(user, _payload(), diff=None, user_id=user.user_id)
    user.refresh_from_db()
    assert user.synced_at is not None


@pytest.mark.django_db
def test_deactivate_user_with_no_school_assignments_succeeds():
    """User exists but has no SchoolVolunteer rows — only user row is soft-deleted."""
    user = _user()
    result = handle_deactivate(user, _payload(), diff=None, user_id=user.user_id)
    assert result.status == "success"
    assert result.action_taken == "user_deactivated"

    user.refresh_from_db()
    assert user.is_active is False
    # No cascaded SCSV/SV changes
    sv_changes = [c for c in result.cascaded_changes if c["table"] != "user"]
    assert sv_changes == []


@pytest.mark.django_db
def test_deactivate_cascades_slot_class_assignments():
    admin = _user(user_role="Project Lead")
    school_id = _school()
    user = _user()
    _worknode(user, school_id)
    _school_volunteer(user, school_id)
    scsv = _scsv(user, school_id, admin)

    result = handle_deactivate(user, _payload(), diff=None, user_id=user.user_id)

    assert result.status == "success"
    # SCSV is soft-deleted
    scsv.refresh_from_db()
    assert scsv.is_active is False
    assert scsv.removed is True
    # SchoolVolunteer is soft-deleted
    assert not SchoolVolunteer.objects.filter(
        school_id=school_id, volunteer_id=user, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_deactivate_cascades_across_all_schools():
    """User active at two schools — both get cascaded."""
    school_a = _school()
    school_b = _school()
    user = _user()

    _school_volunteer(user, school_a)
    _school_volunteer(user, school_b)

    result = handle_deactivate(user, _payload(), diff=None, user_id=user.user_id)

    assert result.status == "success"
    assert not SchoolVolunteer.objects.filter(
        volunteer_id=user, is_active=True, removed=False
    ).exists()
    sv_cascade = [c for c in result.cascaded_changes if c["table"] == "school_volunteer"]
    assert len(sv_cascade) == 2


@pytest.mark.django_db
def test_deactivate_rules_fired_includes_deactivate_user():
    user = _user()
    result = handle_deactivate(user, _payload(), diff=None, user_id=user.user_id)
    assert "deactivate_user" in result.rules_fired


@pytest.mark.django_db
def test_deactivate_cascaded_changes_includes_user_soft_delete():
    user = _user()
    result = handle_deactivate(user, _payload(), diff=None, user_id=user.user_id)
    user_changes = [c for c in result.cascaded_changes if c["table"] == "user"]
    assert len(user_changes) == 1
    assert user_changes[0]["action"] == "soft_deleted"
    assert user_changes[0]["id"] == user.user_id
