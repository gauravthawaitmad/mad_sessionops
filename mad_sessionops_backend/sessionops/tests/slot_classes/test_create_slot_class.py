"""
F-M3-7 Chunk 2: Slot-class creation unit tests.
"""
from datetime import time
from types import SimpleNamespace

import pytest

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

# ── Counters ───────────────────────────────────────────────────────────────────

_UID = iter(range(9_000_000, 9_200_000))
_SID = iter(range(70_000, 80_000))
_WID = iter(range(100, 10_000))


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


def _make_subject(user: User, name: str = "Foundation Day 1") -> object:
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


def _make_slot(school_id: int, user: User) -> Slot:
    """Create a simple Monday 9-10 slot at the school."""
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
        slot_name="Monday 09:00",
        day_of_week="monday",
        start_time=time(9, 0),
        end_time=time(10, 0),
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


# ── Tests ──────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_create_slot_class_creates_all_rows():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    subject = _make_subject(co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    scs = create_slot_class(slot.slot_id, _payload(section, subject, vol1), co)

    assert scs.slot_class_section_id is not None
    assert ClassSectionSubject.objects.filter(
        class_section_id=section, subject_id=subject, is_active=True, removed=False
    ).exists()
    assert SlotClassSection.objects.filter(
        slot_id=slot, class_section_id=section, is_active=True, removed=False
    ).exists()
    assert SlotClassSectionVolunteer.objects.filter(
        slot_class_section_id=scs, volunteer_id=vol1, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_create_slot_class_creates_school_volunteer_for_new_volunteer():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    subject = _make_subject(co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    assert not SchoolVolunteer.objects.filter(
        school_id=sid, volunteer_id=vol1, is_active=True, removed=False
    ).exists()

    create_slot_class(slot.slot_id, _payload(section, subject, vol1), co)

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
    subject = _make_subject(co)
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

    create_slot_class(slot.slot_id, _payload(section, subject, vol1), co)

    # Only one row should exist
    assert SchoolVolunteer.objects.filter(
        school_id=sid, volunteer_id=vol1, is_active=True, removed=False
    ).count() == 1


@pytest.mark.django_db
def test_create_slot_class_creates_child_subject_for_each_active_child():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    subject = _make_subject(co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    # Create 2 children in the section
    for i in range(2):
        child = Child.objects.create(
            school_id=sid,
            first_name=f"Child{i}",
            last_name="Test",
            gender="M",
            is_active=True,
            created_by=co,
        )
        ChildClassSection.objects.create(
            child_id=child,
            class_section_id=section,
            is_active=True,
            created_by=co,
        )

    scs = create_slot_class(slot.slot_id, _payload(section, subject, vol1), co)

    css = ClassSectionSubject.objects.get(class_section_id=section, subject_id=subject)
    child_subjects = ChildSubject.objects.filter(class_section_subject_id=css)
    assert child_subjects.count() == 2


@pytest.mark.django_db
def test_create_slot_class_only_vol1_no_vol2_succeeds():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    subject = _make_subject(co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    scs = create_slot_class(slot.slot_id, _payload(section, subject, vol1, vol2=None), co)

    vols = SlotClassSectionVolunteer.objects.filter(
        slot_class_section_id=scs, is_active=True, removed=False
    )
    assert vols.count() == 1
    assert vols.first().volunteer_id_id == vol1.user_id


@pytest.mark.django_db
def test_create_slot_class_vol1_eq_vol2_returns_400():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    subject = _make_subject(co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    payload = SimpleNamespace(
        class_section_id=section.class_section_id,
        subject_id=subject.subject_id,
        volunteer_1_id=vol1.user_id,
        volunteer_2_id=vol1.user_id,  # same as vol1
    )

    with pytest.raises(ValidationError):
        create_slot_class(slot.slot_id, payload, co)


@pytest.mark.django_db
def test_create_slot_class_section_already_in_slot_returns_409():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    subject = _make_subject(co)
    vol1 = _make_volunteer(sid, co)
    vol2 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    create_slot_class(slot.slot_id, _payload(section, subject, vol1), co)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot.slot_id, _payload(section, subject, vol2), co)

    assert "already assigned" in exc_info.value.message.lower()


@pytest.mark.django_db
def test_create_slot_class_volunteer_already_in_slot_returns_409():
    """R6: same volunteer cannot be in two slot-classes in the same slot."""
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    subject = _make_subject(co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    # Two separate sections
    section_a = _make_section(sid, co, class_code="5")
    section_b = _make_section(sid, co, class_code="6")

    create_slot_class(slot.slot_id, _payload(section_a, subject, vol1), co)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot.slot_id, _payload(section_b, subject, vol1), co)

    assert "already assigned" in exc_info.value.message.lower()


@pytest.mark.django_db
def test_create_slot_class_volunteer_not_in_worknode_list_returns_400():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    subject = _make_subject(co)
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
        create_slot_class(slot.slot_id, _payload(section, subject, outsider), co)


@pytest.mark.django_db
def test_create_slot_class_section_not_at_school_returns_400():
    admin = _make_admin()
    co = _make_co(0)
    school = _make_school(co)
    other_school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    subject = _make_subject(co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    # Section belongs to other_school
    other_section = _make_section(other_school.partner_id, co, class_code="7")

    with pytest.raises(ValidationError) as exc_info:
        create_slot_class(slot.slot_id, _payload(other_section, subject, vol1), co)

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
    subject = _make_subject(co1)
    slot1 = _make_slot(school1.partner_id, co1)

    # Volunteer linked to school1 only
    vol1 = _make_volunteer(school1.partner_id, co1)

    # Assign volunteer to school1's slot-class (creates SchoolVolunteer for school1)
    create_slot_class(slot1.slot_id, _payload(section1, subject, vol1), co1)

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
    slot2 = _make_slot(school2.partner_id, co2)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot2.slot_id, _payload(section2, subject, vol1), co2)

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
    subject = _make_subject(co1)
    slot1 = _make_slot(school1.partner_id, co1)

    vol1 = _make_volunteer(school1.partner_id, co1)
    create_slot_class(slot1.slot_id, _payload(section1, subject, vol1), co1)

    # Add worknode link to school2 for same volunteer
    wid2 = next(_WID)
    vol1.worknode_id = wid2
    vol1.save(update_fields=["worknode_id"])
    PartnerWorknode.objects.create(
        partner_id=str(school2.partner_id),
        worknode_id=wid2,
    )

    section2 = _make_section(school2.partner_id, co2, class_code="9")
    slot2 = _make_slot(school2.partner_id, co2)

    with pytest.raises(ConflictError) as exc_info:
        create_slot_class(slot2.slot_id, _payload(section2, subject, vol1), co2)

    assert school1.partner_name in exc_info.value.message


@pytest.mark.django_db
def test_co_cannot_create_slot_class_in_other_school():
    admin = _make_admin()
    co1 = _make_co(0)
    co2 = _make_co(0)
    school1 = _make_school(co1)
    school2 = _make_school(co2)
    _make_active_year(admin)

    section = _make_section(school1.partner_id, co1)
    subject = _make_subject(co1)
    vol1 = _make_volunteer(school1.partner_id, co1)
    slot = _make_slot(school1.partner_id, co1)

    # co2 tries to create a slot-class in co1's school
    with pytest.raises(PermissionDenied):
        create_slot_class(slot.slot_id, _payload(section, subject, vol1), co2)
