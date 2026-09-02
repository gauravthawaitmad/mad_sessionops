"""
F-M3-8 / F-M6-5: Schedule validation integration tests.

Verifies that business rules R4, R5, R6, R7 are enforced with the correct
error types and messages. Each test exercises the rule via the service layer
against a real database.

R3 (volunteer-ID uniqueness) moved to the schema layer in F-M6-5 — see
tests/slot_classes/test_slot_class_schemas.py for its coverage. Every
create_slot_class call here needs the section to have at least as many
active children as volunteers assigned (R-bucket, new in F-M6-5).
"""
from datetime import time
from types import SimpleNamespace

import pytest

import sessionops.services.slot_classes.helpers as slot_class_helpers
from sessionops.exceptions import ConflictError
from sessionops.models import (
    AcademicYear,
    Child,
    ChildClassSection,
    Class,
    ClassSection,
    Partner,
    PartnerWorknode,
    Program,
    SchoolAcademicYear,
    SchoolClass,
    Slot,
    Subject,
    User,
)
from sessionops.services.slot_classes.create import create_slot_class
from sessionops.services.slots.create import create_slot
from sessionops.services.slots.edit import edit_slot

# ── Counters (ranges distinct from other test files) ──────────────────────────

_UID = iter(range(8_000_000, 8_200_000))
_SID = iter(range(60_000, 69_999))
_WID = iter(range(50_000, 59_999))


@pytest.fixture(autouse=True)
def _reset_foundation_subject_cache(db):
    """Also ensures the "Foundation" Subject row exists — see
    test_create_slot_class.py's identical fixture for why (migration 0027 no
    longer seeds it)."""
    program, _ = Program.objects.get_or_create(
        program_name="Foundation Program", defaults={"is_active": True}
    )
    Subject.objects.get_or_create(subject_name="Foundation", defaults={"program_id": program})
    slot_class_helpers._FOUNDATION_SUBJECT_CACHE = None
    yield
    slot_class_helpers._FOUNDATION_SUBJECT_CACHE = None


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


def _add_children(section: ClassSection, count: int, user: User) -> list[Child]:
    children = []
    for i in range(count):
        child = Child.objects.create(
            school_id=section.school_id,
            first_name=f"Child{i}",
            last_name="Test",
            gender="male",
            is_active=True,
            created_by=user,
        )
        ChildClassSection.objects.create(
            child_id=child,
            class_section_id=section,
            is_active=True,
            created_by=user,
        )
        children.append(child)
    return children


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


def _make_slot(
    school_id: int,
    user: User,
    day: str = "monday",
    start: time = time(9, 0),
    end: time = time(10, 0),
) -> Slot:
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


def _payload(section, *volunteers):
    return SimpleNamespace(
        class_section_id=section.class_section_id,
        volunteer_ids=[v.user_id for v in volunteers],
    )


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
    _add_children(section_a, 1, co1)
    slot_a = _make_slot(school_a.partner_id, co1)
    vol = _make_volunteer(school_a.partner_id, co1)
    create_slot_class(slot_a.slot_id, _payload(section_a, vol), co1)

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
    _add_children(section_b, 1, co2)
    slot_b = _make_slot(school_b.partner_id, co2)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot_b.slot_id, _payload(section_b, vol), co2)

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
    _add_children(section, 1, co)
    vol1 = _make_volunteer(sid, co)
    vol2 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    # First assignment succeeds
    create_slot_class(slot.slot_id, _payload(section, vol1), co)

    # Second assignment with same section must fail
    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot.slot_id, _payload(section, vol2), co)

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
    vol = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    section_a = _make_section(sid, co, class_code="5")
    section_b = _make_section(sid, co, class_code="6")
    _add_children(section_a, 1, co)
    _add_children(section_b, 1, co)

    # First slot-class: vol in section_a
    create_slot_class(slot.slot_id, _payload(section_a, vol), co)

    # Second slot-class: vol again in section_b — same slot
    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot.slot_id, _payload(section_b, vol), co)

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
