"""
F-M6-8 addendum: legacy 'Foundation Day 1'/'Foundation Day 2' subject names must
display as 'Foundation' on both slot-class read paths (list/create/edit response
and the schedule view), even though the underlying DB row is untouched (Dots
reads the raw column). F-M6-5's plan assumed this normalization already existed
server-side; it didn't — added here as part of F-M6-8's execution.
"""
from datetime import time
from types import SimpleNamespace

import pytest

import sessionops.services.slot_classes.helpers as slot_class_helpers
from sessionops.api.slot_classes_api import _scs_to_schema
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
from sessionops.services.slot_classes.helpers import normalize_subject_display_name
from sessionops.services.slot_classes.schedule import get_school_schedule

# ── Counters ───────────────────────────────────────────────────────────────────

_UID = iter(range(9_300_000, 9_500_000))
_SID = iter(range(80_000, 90_000))
_WID = iter(range(10_000, 20_000))


@pytest.fixture(autouse=True)
def _reset_foundation_subject_cache():
    slot_class_helpers._FOUNDATION_SUBJECT_CACHE = None
    yield
    slot_class_helpers._FOUNDATION_SUBJECT_CACHE = None


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_co() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"co_sn{uid}@test.com",
        user_display_name=f"CO SN {uid}",
        email=f"co_sn{uid}@test.com",
        user_role="CO Full Time",
        is_active=True,
    )


def _make_school(co: User) -> Partner:
    sid = next(_SID)
    return Partner.objects.create(
        partner_id=sid,
        partner_name=f"Subject Norm School {sid}",
        co_id=co.user_id,
        converted=True,
        is_active=True,
    )


def _make_active_year(user: User) -> AcademicYear:
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027",
        defaults={"is_active": True, "created_by": user},
    )
    return year


def _make_section(school_id: int, user: User) -> ClassSection:
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    cls, _ = Class.objects.get_or_create(
        class_code="5",
        defaults={"class_name": "5th", "program_id": program, "is_active": True},
    )
    year = _make_active_year(user)
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
        section_name="5th - A",
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


def _make_volunteer(school_id: int) -> User:
    wid = next(_WID)
    uid = next(_UID)
    vol = User.objects.create(
        user_login=f"vol_sn{uid}@test.com",
        user_display_name=f"Volunteer SN {uid}",
        email=f"vol_sn{uid}@test.com",
        user_role="CHO",
        is_active=True,
        worknode_id=wid,
    )
    PartnerWorknode.objects.create(partner_id=str(school_id), worknode_id=wid)
    return vol


def _make_slot(school_id: int, user: User) -> Slot:
    year = _make_active_year(user)
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id, academic_year_id=year, defaults={"created_by": user}
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


def _payload(section, *volunteers):
    return SimpleNamespace(
        class_section_id=section.class_section_id,
        volunteer_ids=[v.user_id for v in volunteers],
    )


def _make_legacy_slot_class(school_id: int, co: User, legacy_subject_name: str):
    """Create a slot-class the normal way (always Foundation), then rewrite its
    ClassSectionSubject to point at a legacy pre-M6 subject row — simulating data
    that predates the M6 pivot."""
    section = _make_section(school_id, co)
    _add_children(section, 1, co)
    vol = _make_volunteer(school_id)
    slot = _make_slot(school_id, co)
    scs = create_slot_class(slot.slot_id, _payload(section, vol), co)

    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    legacy_subject, _ = Subject.objects.get_or_create(
        subject_name=legacy_subject_name, defaults={"program_id": program}
    )
    css = scs.class_section_subject_id
    css.subject_id = legacy_subject
    css.save(update_fields=["subject_id"])

    return scs, slot


# ── Unit tests — normalize_subject_display_name ─────────────────────────────────


def test_normalize_leaves_foundation_unchanged():
    assert normalize_subject_display_name("Foundation") == "Foundation"


def test_normalize_collapses_foundation_day_1():
    assert normalize_subject_display_name("Foundation Day 1") == "Foundation"


def test_normalize_collapses_foundation_day_2():
    assert normalize_subject_display_name("Foundation Day 2") == "Foundation"


def test_normalize_leaves_other_subjects_unchanged():
    assert normalize_subject_display_name("Some Other Subject") == "Some Other Subject"


# ── Integration — slot-class read path (_scs_to_schema) ─────────────────────────


@pytest.mark.django_db
def test_scs_to_schema_normalizes_legacy_subject_name():
    co = _make_co()
    school = _make_school(co)
    scs, _slot = _make_legacy_slot_class(school.partner_id, co, "Foundation Day 1")

    result = _scs_to_schema(scs)

    assert result.subject_name == "Foundation"


@pytest.mark.django_db
def test_scs_to_schema_does_not_mutate_db_value():
    co = _make_co()
    school = _make_school(co)
    scs, _slot = _make_legacy_slot_class(school.partner_id, co, "Foundation Day 2")

    _scs_to_schema(scs)

    css = scs.class_section_subject_id
    css.refresh_from_db()
    assert css.subject_id.subject_name == "Foundation Day 2"


# ── Integration — schedule view read path (get_school_schedule) ────────────────


@pytest.mark.django_db
def test_schedule_view_normalizes_legacy_subject_name():
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    _scs, _slot = _make_legacy_slot_class(sid, co, "Foundation Day 1")

    result = get_school_schedule(sid, co)
    day_map = {d["day_of_week"]: d["slots"] for d in result["days"]}
    sc = day_map["monday"][0]["slot_classes"][0]

    assert sc["subject_name"] == "Foundation"
