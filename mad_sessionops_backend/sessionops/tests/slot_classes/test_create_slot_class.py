"""
F-M3-7 Chunk 2 / F-M6-5: Slot-class creation unit tests.

F-M6-5 replaced volunteer_1_id/volunteer_2_id with volunteer_ids: list[int] (1-5)
and dropped subject_id from client input (server always uses the seeded
Foundation Subject). R-bucket (volunteer count <= active children in the
bucket) is new; every test that assigns N volunteers must give the section
at least N active children.
"""
from datetime import time
from types import SimpleNamespace

import pytest

import sessionops.services.slot_classes.helpers as slot_class_helpers
from sessionops.exceptions import ConflictError, PermissionDenied, ValidationError
from sessionops.models import (
    AcademicYear,
    Child,
    ChildClassSection,
    ChildSubject,
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
    User,
)
from sessionops.services.slot_classes.create import create_slot_class
from sessionops.services.slot_classes.helpers import get_foundation_subject

# ── Counters ───────────────────────────────────────────────────────────────────

_UID = iter(range(9_000_000, 9_200_000))
_SID = iter(range(70_000, 80_000))
_WID = iter(range(100, 10_000))


@pytest.fixture(autouse=True)
def _reset_foundation_subject_cache():
    """Module-level cache in helpers.py isn't rolled back by test transactions."""
    slot_class_helpers._FOUNDATION_SUBJECT_CACHE = None
    yield
    slot_class_helpers._FOUNDATION_SUBJECT_CACHE = None


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_co(school_id: int) -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"co{uid}@test.com",
        user_display_name=f"CO {uid}",
        email=f"co{uid}@test.com",
        user_role="CO Full Time",
        is_active=True,
    )


def _make_admin() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"admin{uid}@test.com",
        user_display_name=f"Admin {uid}",
        email=f"admin{uid}@test.com",
        user_role="Project Lead",
        is_active=True,
    )


def _make_school(co: User) -> Partner:
    sid = next(_SID)
    return Partner.objects.create(
        partner_id=sid,
        partner_name=f"School {sid}",
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
    """Add `count` active children to a section/bucket — needed for R-bucket capacity."""
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


def _make_legacy_subject(name: str = "Foundation Day 1") -> object:
    """A pre-M6 subject row, to confirm new slot-classes never use it."""
    from sessionops.models import Subject

    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    subj, _ = Subject.objects.get_or_create(
        subject_name=name,
        defaults={"program_id": program},
    )
    return subj


def _make_volunteer(school_id: int, user: User) -> User:
    """Create a volunteer user with worknode_id and a PartnerWorknode row linking to school."""
    wid = next(_WID)
    uid = next(_UID)
    vol = User.objects.create(
        user_login=f"vol{uid}@test.com",
        user_display_name=f"Volunteer {uid}",
        email=f"vol{uid}@test.com",
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
    start: tuple[int, int] = (9, 0),
    end: tuple[int, int] = (10, 0),
) -> Slot:
    """Create a simple Monday slot at the school (default 9-10)."""
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
        slot_name=f"Monday {start[0]:02d}:{start[1]:02d}",
        day_of_week="monday",
        start_time=time(*start),
        end_time=time(*end),
        recurring=True,
        is_active=True,
        created_by=user,
    )


def _payload(section, *volunteers):
    return SimpleNamespace(
        class_section_id=section.class_section_id,
        volunteer_ids=[v.user_id for v in volunteers],
    )


# ── Tests ──────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_create_slot_class_creates_all_rows():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 1, co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)

    assert scs.slot_class_section_id is not None
    assert ClassSectionSubject.objects.filter(
        class_section_id=section, subject_id=get_foundation_subject(), is_active=True, removed=False
    ).exists()
    assert SlotClassSection.objects.filter(
        slot_id=slot, class_section_id=section, is_active=True, removed=False
    ).exists()
    assert SlotClassSectionVolunteer.objects.filter(
        slot_class_section_id=scs, volunteer_id=vol1, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_create_slot_class_uses_foundation_subject_regardless_of_legacy_subjects():
    """Legacy 'Foundation Day 1'/'Foundation Day 2' subjects existing in the DB must
    never be picked up — every new slot-class uses the seeded Foundation row."""
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 1, co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)
    _make_legacy_subject("Foundation Day 1")
    _make_legacy_subject("Foundation Day 2")

    create_slot_class(slot.slot_id, _payload(section, vol1), co)

    css = ClassSectionSubject.objects.get(class_section_id=section)
    assert css.subject_id.subject_name == "Foundation"


@pytest.mark.django_db
def test_create_slot_class_creates_school_volunteer_for_new_volunteer():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 1, co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    assert not SchoolVolunteer.objects.filter(
        school_id=sid, volunteer_id=vol1, is_active=True, removed=False
    ).exists()

    create_slot_class(slot.slot_id, _payload(section, vol1), co)

    assert SchoolVolunteer.objects.filter(
        school_id=sid, volunteer_id=vol1, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_create_slot_class_skips_school_volunteer_creation_if_exists():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    year = _make_active_year(admin)
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=sid, academic_year_id=year, defaults={"created_by": co}
    )
    section = _make_section(sid, co)
    _add_children(section, 1, co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    # Pre-create SchoolVolunteer
    SchoolVolunteer.objects.create(
        school_id=sid,
        school_academic_year_id=say,
        volunteer_id=vol1,
        is_active=True,
        created_by=co,
    )

    create_slot_class(slot.slot_id, _payload(section, vol1), co)

    # Only one row should exist
    assert (
        SchoolVolunteer.objects.filter(
            school_id=sid, volunteer_id=vol1, is_active=True, removed=False
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_create_slot_class_creates_child_subject_for_each_active_child():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 2, co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    create_slot_class(slot.slot_id, _payload(section, vol1), co)

    css = ClassSectionSubject.objects.get(
        class_section_id=section, subject_id=get_foundation_subject()
    )
    child_subjects = ChildSubject.objects.filter(class_section_subject_id=css)
    assert child_subjects.count() == 2


@pytest.mark.django_db
def test_create_slot_class_single_volunteer_succeeds():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 1, co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)

    vols = SlotClassSectionVolunteer.objects.filter(
        slot_class_section_id=scs, is_active=True, removed=False
    )
    assert vols.count() == 1
    assert vols.first().volunteer_id_id == vol1.user_id


@pytest.mark.django_db
def test_create_slot_class_five_volunteers_boundary_succeeds():
    """R2 relaxed to 1-5; bucket with exactly 5 children can take exactly 5 volunteers."""
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 5, co)
    volunteers = [_make_volunteer(sid, co) for _ in range(5)]
    slot = _make_slot(sid, co)

    scs = create_slot_class(slot.slot_id, _payload(section, *volunteers), co)

    assert (
        SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs, is_active=True, removed=False
        ).count()
        == 5
    )


@pytest.mark.django_db
def test_create_slot_class_r_bucket_violation_returns_400():
    """Volunteer count exceeding active children in the bucket is rejected."""
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 1, co)  # only 1 child
    volunteers = [_make_volunteer(sid, co) for _ in range(2)]  # 2 volunteers
    slot = _make_slot(sid, co)

    with pytest.raises(ValidationError) as exc_info:
        create_slot_class(slot.slot_id, _payload(section, *volunteers), co)

    assert (
        "1 child" in exc_info.value.message
        or "1 children" in exc_info.value.message
        or "only 1" in exc_info.value.message
    )


@pytest.mark.django_db
def test_create_slot_class_section_already_in_slot_returns_409():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 1, co)
    vol1 = _make_volunteer(sid, co)
    vol2 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    create_slot_class(slot.slot_id, _payload(section, vol1), co)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot.slot_id, _payload(section, vol2), co)

    assert "already assigned" in exc_info.value.message.lower()


@pytest.mark.django_db
def test_create_slot_class_volunteer_already_in_slot_returns_409():
    """R6: same volunteer cannot be in two slot-classes in the same slot."""
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    # Two separate sections, each with a child so R-bucket doesn't get in the way
    section_a = _make_section(sid, co, class_code="5")
    section_b = _make_section(sid, co, class_code="6")
    _add_children(section_a, 1, co)
    _add_children(section_b, 1, co)

    create_slot_class(slot.slot_id, _payload(section_a, vol1), co)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot.slot_id, _payload(section_b, vol1), co)

    assert "already assigned" in exc_info.value.message.lower()


@pytest.mark.django_db
def test_create_slot_class_volunteer_already_in_different_slot_returns_409():
    """
    R6 (revised): a volunteer can have at most one active slot-class assignment
    system-wide, not just within the same slot. Slot A and Slot B are different
    (non-overlapping, per R7) time windows at the same school — the old R6 scoping
    would have allowed this; the revised rule blocks it.
    """
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    vol1 = _make_volunteer(sid, co)
    slot_a = _make_slot(sid, co, start=(9, 0), end=(10, 0))
    slot_b = _make_slot(sid, co, start=(11, 0), end=(12, 0))

    section_a = _make_section(sid, co, class_code="5")
    section_b = _make_section(sid, co, class_code="6")
    _add_children(section_a, 1, co)
    _add_children(section_b, 1, co)

    create_slot_class(slot_a.slot_id, _payload(section_a, vol1), co)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot_b.slot_id, _payload(section_b, vol1), co)

    assert "already assigned" in exc_info.value.message.lower()


@pytest.mark.django_db
def test_create_slot_class_volunteer_not_in_worknode_list_returns_400():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 1, co)
    slot = _make_slot(sid, co)

    # Volunteer without any PartnerWorknode link to this school
    uid = next(_UID)
    outsider = User.objects.create(
        user_login=f"outsider{uid}@test.com",
        user_display_name=f"Outsider {uid}",
        email=f"outsider{uid}@test.com",
        user_role="CHO",
        is_active=True,
        worknode_id=next(_WID),
    )

    with pytest.raises(ValidationError):
        create_slot_class(slot.slot_id, _payload(section, outsider), co)


@pytest.mark.django_db
def test_create_slot_class_section_not_at_school_returns_400():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    other_school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    # Section belongs to other_school
    other_section = _make_section(other_school.partner_id, co, class_code="7")

    with pytest.raises(ValidationError) as exc_info:
        create_slot_class(slot.slot_id, _payload(other_section, vol1), co)

    assert "does not belong" in exc_info.value.message.lower()


@pytest.mark.django_db
def test_create_slot_class_vol_at_different_school_returns_409_r4():
    admin = _make_admin()
    co1 = _make_co(0)
    co2 = _make_co(0)
    school1 = _make_school(co1)
    school2 = _make_school(co2)
    _make_active_year(admin)

    section1 = _make_section(school1.partner_id, co1)
    _add_children(section1, 1, co1)
    slot1 = _make_slot(school1.partner_id, co1)

    # Volunteer linked to school1 only
    vol1 = _make_volunteer(school1.partner_id, co1)

    # Assign volunteer to school1's slot-class (creates SchoolVolunteer for school1)
    create_slot_class(slot1.slot_id, _payload(section1, vol1), co1)

    # Now try to assign same volunteer to school2's slot-class
    # Note: vol1 is NOT linked to school2 via worknode, so we'd get a worknode error first.
    # To test R4 specifically, we need the volunteer to also be worknode-linked to school2.
    wid2 = next(_WID)
    vol1.worknode_id = wid2  # override to a different worknode
    vol1.save(update_fields=["worknode_id"])
    PartnerWorknode.objects.create(
        partner_id=str(school2.partner_id),
        worknode_id=wid2,
    )

    section2 = _make_section(school2.partner_id, co2, class_code="8")
    _add_children(section2, 1, co2)
    slot2 = _make_slot(school2.partner_id, co2)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot2.slot_id, _payload(section2, vol1), co2)

    assert exc_info.value.error_code == "CONFLICT"


@pytest.mark.django_db
def test_create_slot_class_vol_at_different_school_message_includes_school_name():
    admin = _make_admin()
    co1 = _make_co(0)
    co2 = _make_co(0)
    school1 = _make_school(co1)
    school2 = _make_school(co2)
    _make_active_year(admin)

    section1 = _make_section(school1.partner_id, co1)
    _add_children(section1, 1, co1)
    slot1 = _make_slot(school1.partner_id, co1)

    vol1 = _make_volunteer(school1.partner_id, co1)
    create_slot_class(slot1.slot_id, _payload(section1, vol1), co1)

    # Add worknode link to school2 for same volunteer
    wid2 = next(_WID)
    vol1.worknode_id = wid2
    vol1.save(update_fields=["worknode_id"])
    PartnerWorknode.objects.create(
        partner_id=str(school2.partner_id),
        worknode_id=wid2,
    )

    section2 = _make_section(school2.partner_id, co2, class_code="9")
    _add_children(section2, 1, co2)
    slot2 = _make_slot(school2.partner_id, co2)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot2.slot_id, _payload(section2, vol1), co2)

    assert school1.partner_name in exc_info.value.message


@pytest.mark.django_db
def test_co_cannot_create_slot_class_in_other_school():
    admin = _make_admin()
    co1 = _make_co(0)
    co2 = _make_co(0)
    school1 = _make_school(co1)
    _make_school(co2)
    _make_active_year(admin)

    section = _make_section(school1.partner_id, co1)
    vol1 = _make_volunteer(school1.partner_id, co1)
    slot = _make_slot(school1.partner_id, co1)

    # co2 tries to create a slot-class in co1's school
    with pytest.raises(PermissionDenied):
        create_slot_class(slot.slot_id, _payload(section, vol1), co2)
