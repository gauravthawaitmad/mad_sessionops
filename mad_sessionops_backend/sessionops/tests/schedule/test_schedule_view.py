"""
F-M3-9 / F-M6-5: Schedule view service tests.

Verifies the get_school_schedule service returns the correct structure
and respects RBAC scope. F-M6-5 dropped subject_id/volunteer_1_id/volunteer_2_id
from slot-class creation in favor of volunteer_ids, and added section_display_name
to each slot-class dict (needed by F-M6-8's schedule grid).
"""
from datetime import time
from types import SimpleNamespace

import pytest

import sessionops.services.slot_classes.helpers as slot_class_helpers
from sessionops.exceptions import PermissionDenied
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
    User,
)
from sessionops.services.slot_classes.create import create_slot_class
from sessionops.services.slot_classes.schedule import get_school_schedule

# ── Counters ───────────────────────────────────────────────────────────────────

_UID = iter(range(7_000_000, 7_200_000))
_SID = iter(range(40_000, 49_999))
_WID = iter(range(70_000, 79_999))


@pytest.fixture(autouse=True)
def _reset_foundation_subject_cache():
    slot_class_helpers._FOUNDATION_SUBJECT_CACHE = None
    yield
    slot_class_helpers._FOUNDATION_SUBJECT_CACHE = None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_admin() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"admin_sch{uid}@test.com",
        user_display_name=f"Admin SCH {uid}",
        email=f"admin_sch{uid}@test.com",
        user_role="Project Lead",
        is_active=True,
    )


def _make_co() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"co_sch{uid}@test.com",
        user_display_name=f"CO SCH {uid}",
        email=f"co_sch{uid}@test.com",
        user_role="CO Full Time",
        is_active=True,
    )


def _make_school(co: User) -> Partner:
    sid = next(_SID)
    return Partner.objects.create(
        partner_id=sid,
        partner_name=f"Schedule School {sid}",
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


def _make_say(school_id: int, user: User, year: AcademicYear) -> SchoolAcademicYear:
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id,
        academic_year_id=year,
        defaults={"created_by": user},
    )
    return say


def _make_section(
    school_id: int, user: User, class_code: str = "5", display_name: str | None = None
) -> ClassSection:
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
        school_id=school_id, academic_year_id=year, defaults={"created_by": user}
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
        section_display_name=display_name,
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
        user_login=f"vol_sch{uid}@test.com",
        user_display_name=f"Vol SCH {uid}",
        email=f"vol_sch{uid}@test.com",
        user_role="CHO",
        is_active=True,
        worknode_id=wid,
    )
    PartnerWorknode.objects.create(partner_id=str(school_id), worknode_id=wid)
    return vol


def _make_slot(
    school_id: int,
    user: User,
    day: str = "monday",
    start: time = time(9, 0),
    end: time = time(10, 0),
) -> Slot:
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027", defaults={"is_active": True, "created_by": user}
    )
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id, academic_year_id=year, defaults={"created_by": user}
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


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_schedule_view_returns_full_structure():
    """Result includes school_id, school_name, academic_year, and 7 days."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    year = _make_active_year(admin)
    _make_say(school.partner_id, co, year)

    result = get_school_schedule(school.partner_id, co)

    assert result["school_id"] == school.partner_id
    assert result["school_name"] == school.partner_name
    assert result["academic_year"] == "2026-2027"
    assert len(result["days"]) == 7
    days = [d["day_of_week"] for d in result["days"]]
    assert days == ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


@pytest.mark.django_db
def test_schedule_view_groups_by_day():
    """Slots appear in the correct day bucket."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)

    _make_slot(sid, co, day="tuesday", start=time(10, 0), end=time(11, 0))
    _make_slot(sid, co, day="friday", start=time(9, 0), end=time(10, 0))

    result = get_school_schedule(sid, co)
    day_map = {d["day_of_week"]: d["slots"] for d in result["days"]}

    assert len(day_map["tuesday"]) == 1
    assert len(day_map["friday"]) == 1
    assert len(day_map["monday"]) == 0
    assert day_map["tuesday"][0]["slot_name"] == "Tuesday 10:00"


@pytest.mark.django_db
def test_schedule_view_orders_slots_by_start_time():
    """Multiple slots on the same day are ordered by start_time ascending."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)

    _make_slot(sid, co, day="wednesday", start=time(14, 0), end=time(15, 0))
    _make_slot(sid, co, day="wednesday", start=time(9, 0), end=time(10, 0))
    _make_slot(sid, co, day="wednesday", start=time(11, 0), end=time(12, 0))

    result = get_school_schedule(sid, co)
    day_map = {d["day_of_week"]: d["slots"] for d in result["days"]}
    times = [s["start_time"] for s in day_map["wednesday"]]

    assert times == ["09:00", "11:00", "14:00"]


@pytest.mark.django_db
def test_schedule_view_includes_volunteers():
    """Each slot-class lists the assigned volunteers by name."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 1, co)
    vol = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    create_slot_class(slot.slot_id, _payload(section, vol), co)

    result = get_school_schedule(sid, co)
    day_map = {d["day_of_week"]: d["slots"] for d in result["days"]}
    sc = day_map["monday"][0]["slot_classes"][0]

    assert len(sc["volunteers"]) == 1
    assert sc["volunteers"][0]["user_display_name"] == vol.user_display_name
    assert sc["volunteers"][0]["user_id"] == vol.user_id


@pytest.mark.django_db
def test_schedule_view_includes_section_display_name():
    """F-M6-8 renders the bucket's display name on schedule-grid cells."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co, display_name="Care Monster")
    _add_children(section, 1, co)
    vol = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    create_slot_class(slot.slot_id, _payload(section, vol), co)

    result = get_school_schedule(sid, co)
    day_map = {d["day_of_week"]: d["slots"] for d in result["days"]}
    sc = day_map["monday"][0]["slot_classes"][0]

    assert sc["section_display_name"] == "Care Monster"


@pytest.mark.django_db
def test_schedule_view_includes_active_children_count():
    """active_children_count in a slot-class matches enrolled children in the section."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)
    section = _make_section(sid, co)
    _add_children(section, 3, co)
    vol = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    create_slot_class(slot.slot_id, _payload(section, vol), co)

    result = get_school_schedule(sid, co)
    day_map = {d["day_of_week"]: d["slots"] for d in result["days"]}
    sc = day_map["monday"][0]["slot_classes"][0]

    assert sc["active_children_count"] == 3


@pytest.mark.django_db
def test_cho_can_view_schedule_for_assigned_school():
    """A CHO whose worknode_id maps to the school can retrieve the schedule."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)

    # Create CHO with worknode link to school
    wid = next(_WID)
    uid = next(_UID)
    cho = User.objects.create(
        user_login=f"cho_sch{uid}@test.com",
        user_display_name=f"CHO SCH {uid}",
        email=f"cho_sch{uid}@test.com",
        user_role="CHO",
        is_active=True,
        worknode_id=wid,
    )
    PartnerWorknode.objects.create(partner_id=str(sid), worknode_id=wid)

    result = get_school_schedule(sid, cho)

    assert result["school_id"] == sid


@pytest.mark.django_db
def test_co_cannot_view_other_school_schedule():
    """A CO cannot retrieve the schedule of a school they don't own."""
    admin = _make_admin()
    co1 = _make_co()
    co2 = _make_co()
    school1 = _make_school(co1)
    _make_active_year(admin)

    with pytest.raises(PermissionDenied):
        get_school_schedule(school1.partner_id, co2)


@pytest.mark.django_db
def test_schedule_view_day_filter():
    """day_of_week query param returns only slots for that day."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _make_active_year(admin)

    _make_slot(sid, co, day="monday", start=time(9, 0), end=time(10, 0))
    _make_slot(sid, co, day="thursday", start=time(14, 0), end=time(15, 0))

    result = get_school_schedule(sid, co, day_of_week="monday")

    assert len(result["days"]) == 1
    assert result["days"][0]["day_of_week"] == "monday"
    assert len(result["days"][0]["slots"]) == 1


@pytest.mark.django_db
def test_schedule_view_empty_school():
    """A school with no slots returns 7 days each with empty slot lists."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    _make_active_year(admin)

    result = get_school_schedule(school.partner_id, co)

    assert all(len(d["slots"]) == 0 for d in result["days"])
