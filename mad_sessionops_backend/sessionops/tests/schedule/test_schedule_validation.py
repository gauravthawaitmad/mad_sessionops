"""
F-M3-8: Schedule validation integration tests.

Verifies that business rules R3, R4, R5, R6, R7 are enforced with the correct
error types and messages. Each test exercises the rule via the service layer
against a real database.
"""
from datetime import time
from types import SimpleNamespace

import pytest

from sessionops.exceptions import ConflictError, ValidationError
from sessionops.models import (
    AcademicYear,
    Class,
    ClassSection,
    Partner,
    PartnerWorknode,
    Program,
    SchoolAcademicYear,
    SchoolClass,
    Slot,
    User,
)
from sessionops.services.slot_classes.create import create_slot_class
from sessionops.services.slots.create import create_slot
from sessionops.services.slots.edit import edit_slot

# ── Counters (ranges distinct from other test files) ──────────────────────────

_UID = iter(range(8_000_000, 8_200_000))
_SID = iter(range(60_000, 69_999))
_WID = iter(range(50_000, 59_999))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_admin() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"admin_sv{uid}@test.com",
        user_display_name=f"Admin SV {uid}",
        email=f"admin_sv{uid}@test.com",
        user_role="Project Lead",
        is_active=True,
    )


def _make_co() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"co_sv{uid}@test.com",
        user_display_name=f"CO SV {uid}",
        email=f"co_sv{uid}@test.com",
        user_role="CO Full Time",
        is_active=True,
    )


def _make_school(co: User) -> Partner:
    sid = next(_SID)
    return Partner.objects.create(
        partner_id=sid,
        partner_name=f"Test School {sid}",
        co_id=co.user_id,
        converted=True,
        is_active=True,
    )


def _make_active_year(admin: User) -> AcademicYear:
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027",
        defaults={"is_active": True, "created_by": admin},
    )
    return year


def _make_section(school_id: int, user: User, class_code: str = "5") -> ClassSection:
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    cls, _ = Class.objects.get_or_create(
        class_code=class_code,
        defaults={"class_name": f"{class_code}th", "program_id": program, "is_active": True},
    )
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027",
        defaults={"is_active": True, "created_by": user},
    )
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id,
        academic_year_id=year,
        defaults={"created_by": user},
    )
    sc = SchoolClass.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        class_id_id=cls.class_id,
        created_by=user,
    )
    return ClassSection.objects.create(
        school_class_id=sc,
        school_id=school_id,
        section_code="A",
        section_name=f"{class_code}th - A",
        is_active=True,
        created_by=user,
    )


def _make_subject(user: User, name: str = "Foundation Day 1"):
    from sessionops.models import Subject
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    subj, _ = Subject.objects.get_or_create(
        subject_name=name,
        defaults={"program_id": program},
    )
    return subj


def _make_volunteer(school_id: int, user: User) -> User:
    wid = next(_WID)
    uid = next(_UID)
    vol = User.objects.create(
        user_login=f"vol_sv{uid}@test.com",
        user_display_name=f"Volunteer SV {uid}",
        email=f"vol_sv{uid}@test.com",
        user_role="CHO",
        is_active=True,
        worknode_id=wid,
    )
    PartnerWorknode.objects.create(
        partner_id=str(school_id),
        worknode_id=wid,
    )
    return vol


def _make_slot(school_id: int, user: User,
               day: str = "monday",
               start: time = time(9, 0),
               end: time = time(10, 0)) -> Slot:
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027",
        defaults={"is_active": True, "created_by": user},
    )
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id,
        academic_year_id=year,
        defaults={"created_by": user},
    )
    return Slot.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        slot_name=f"{day.capitalize()} {start.strftime('%H:%M')}",
        day_of_week=day,
        start_time=start,
        end_time=end,
        recurring=True,
        is_active=True,
        created_by=user,
    )


def _payload(section, subject, vol1, vol2=None):
    return SimpleNamespace(
        class_section_id=section.class_section_id,
        subject_id=subject.subject_id,
        volunteer_1_id=vol1.user_id,
        volunteer_2_id=vol2.user_id if vol2 else None,
    )


# ── R3: Vol1 ≠ Vol2 ───────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_r3_vol1_eq_vol2_blocked():
    """R3: Same volunteer as both vol1 and vol2 must be rejected (400)."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    subject = _make_subject(co)
    vol = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    payload = SimpleNamespace(
        class_section_id=section.class_section_id,
        subject_id=subject.subject_id,
        volunteer_1_id=vol.user_id,
        volunteer_2_id=vol.user_id,
    )

    with pytest.raises(ValidationError) as exc_info:
        create_slot_class(slot.slot_id, payload, co)

    assert "Vol1 and Vol2 cannot be the same volunteer" in exc_info.value.message


# ── R4: One volunteer per school ──────────────────────────────────────────────

@pytest.mark.django_db
def test_r4_volunteer_at_other_school_blocked_with_school_name_in_message():
    """R4: Volunteer already active at school_A must be blocked at school_B,
    and the error message must name school_A so the CO knows where to look."""
    admin = _make_admin()
    co1 = _make_co()
    co2 = _make_co()
    school_a = _make_school(co1)
    school_b = _make_school(co2)
    _make_active_year(admin)

    # Assign volunteer to school_A
    section_a = _make_section(school_a.partner_id, co1)
    subject = _make_subject(co1)
    slot_a = _make_slot(school_a.partner_id, co1)
    vol = _make_volunteer(school_a.partner_id, co1)
    create_slot_class(slot_a.slot_id, _payload(section_a, subject, vol), co1)

    # Link same volunteer to school_B via a second worknode entry
    wid_b = next(_WID)
    vol.worknode_id = wid_b
    vol.save(update_fields=["worknode_id"])
    PartnerWorknode.objects.create(
        partner_id=str(school_b.partner_id),
        worknode_id=wid_b,
    )

    # Attempt to assign volunteer to school_B
    section_b = _make_section(school_b.partner_id, co2, class_code="6")
    slot_b = _make_slot(school_b.partner_id, co2)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot_b.slot_id, _payload(section_b, subject, vol), co2)

    assert school_a.partner_name in exc_info.value.message
    assert "Remove them from there first" in exc_info.value.message


# ── R5: No duplicate section in slot ─────────────────────────────────────────

@pytest.mark.django_db
def test_r5_duplicate_section_in_slot_blocked():
    """R5: Same section scheduled twice in the same slot must be rejected (409),
    and the error message must contain the section name."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    subject = _make_subject(co)
    vol1 = _make_volunteer(sid, co)
    vol2 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    # First assignment succeeds
    create_slot_class(slot.slot_id, _payload(section, subject, vol1), co)

    # Second assignment with same section must fail
    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot.slot_id, _payload(section, subject, vol2), co)

    assert section.section_name in exc_info.value.message


# ── R6: No volunteer double-booked in same slot ───────────────────────────────

@pytest.mark.django_db
def test_r6_volunteer_double_booked_in_slot_blocked():
    """R6: A volunteer already in one slot-class cannot be added to a second
    slot-class in the same slot. Error message must contain the volunteer's name."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    subject = _make_subject(co)
    vol = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    section_a = _make_section(sid, co, class_code="5")
    section_b = _make_section(sid, co, class_code="6")

    # First slot-class: vol in section_a
    create_slot_class(slot.slot_id, _payload(section_a, subject, vol), co)

    # Second slot-class: vol again in section_b — same slot
    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot.slot_id, _payload(section_b, subject, vol), co)

    assert vol.user_display_name in exc_info.value.message


# ── R7: No overlapping slots ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_r7_overlapping_slots_blocked_on_create():
    """R7: Creating a slot that overlaps an existing one must be rejected (409).
    Error message must contain the conflicting slot's name and time range."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)

    # Existing slot: Monday 10:00–11:00
    _make_slot(sid, co, day="monday", start=time(10, 0), end=time(11, 0))

    # Attempt to create Monday 10:30–11:30 (overlaps)
    with pytest.raises(ConflictError) as exc_info:
        create_slot(
            school_id=sid,
            day_of_week="monday",
            start_time=time(10, 30),
            end_time=time(11, 30),
            user=co,
        )

    msg = exc_info.value.message
    assert "10:00" in msg
    assert "11:00" in msg
    assert "Monday" in msg


@pytest.mark.django_db
def test_r7_error_message_contains_slot_name_and_times():
    """R7 (via edit): editing a slot's time to overlap another must also be blocked,
    and the error message must include the conflicting slot name and times."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)

    # Two non-overlapping slots
    _make_slot(sid, co, day="tuesday", start=time(9, 0), end=time(10, 0))
    slot_b = _make_slot(sid, co, day="tuesday", start=time(11, 0), end=time(12, 0))

    # Try to edit slot_b to overlap slot_a
    with pytest.raises(ConflictError) as exc_info:
        edit_slot(
            slot_id=slot_b.slot_id,
            day_of_week="tuesday",
            start_time=time(9, 30),
            end_time=time(10, 30),
            user=co,
        )

    msg = exc_info.value.message
    assert "09:00" in msg
    assert "10:00" in msg
    assert "This time overlaps" in msg
