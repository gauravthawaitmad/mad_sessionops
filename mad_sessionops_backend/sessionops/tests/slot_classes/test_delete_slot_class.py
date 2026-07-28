"""
F-M3-7 Chunk 3 / F-M6-5: Slot-class edit/delete + slot-delete blocking tests.

F-M6-5 replaced volunteer_1_id/volunteer_2_id with volunteer_ids: list[int] and
dropped subject_id from client input. Every create_slot_class call here needs
the section to have at least as many active children as volunteers (R-bucket).
"""

from datetime import time
from types import SimpleNamespace

import pytest

import sessionops.services.slot_classes.helpers as slot_class_helpers
from sessionops.exceptions import ConflictError, NotFound, PermissionDenied
from sessionops.models import (
    AcademicYear,
    Child,
    ChildClassSection,
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
from sessionops.services.slot_classes.delete import delete_slot_class
from sessionops.services.slot_classes.edit import edit_slot_class
from sessionops.services.slots.delete import soft_delete_slot

# ── Counters ───────────────────────────────────────────────────────────────────

_UID = iter(range(9_200_000, 9_400_000))
_SID = iter(range(80_000, 90_000))
_WID = iter(range(10_001, 20_000))


@pytest.fixture(autouse=True)
def _reset_foundation_subject_cache():
    slot_class_helpers._FOUNDATION_SUBJECT_CACHE = None
    yield
    slot_class_helpers._FOUNDATION_SUBJECT_CACHE = None


# ── Helpers (same pattern as test_create_slot_class.py) ───────────────────────


def _make_co() -> User:
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


def _make_section(school_id: int, user: User, class_code: str = "5") -> ClassSection:
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    cls, _ = Class.objects.get_or_create(
        class_code=class_code,
        defaults={
            "class_name": f"{class_code}th",
            "program_id": program,
            "is_active": True,
        },
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


def _payload(section, *volunteers):
    return SimpleNamespace(
        class_section_id=section.class_section_id,
        volunteer_ids=[v.user_id for v in volunteers],
    )


def _edit_payload(class_section_id=None, volunteers=None):
    return SimpleNamespace(
        class_section_id=class_section_id,
        volunteer_ids=[v.user_id for v in volunteers] if volunteers is not None else None,
    )


def _setup():
    """Return (co, school, section, vol1, slot) — section has 1 active child."""
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    section = _make_section(sid, co)
    _add_children(section, 1, co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)
    return co, school, section, vol1, slot


# ── Delete tests ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_delete_slot_class_cascade_soft_deletes_all_rows():
    co, school, section, vol1, slot = _setup()
    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)

    css_id = scs.class_section_subject_id_id
    delete_slot_class(scs.slot_class_section_id, co)

    assert not SlotClassSection.objects.filter(
        slot_class_section_id=scs.slot_class_section_id, is_active=True, removed=False
    ).exists()
    assert not SlotClassSectionVolunteer.objects.filter(
        slot_class_section_id=scs, is_active=True, removed=False
    ).exists()
    assert not ClassSectionSubject.objects.filter(
        class_section_subject_id=css_id, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_delete_slot_class_reconciles_school_volunteer():
    co, school, section, vol1, slot = _setup()
    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)

    assert SchoolVolunteer.objects.filter(
        school_id=school.partner_id, volunteer_id=vol1, is_active=True, removed=False
    ).exists()

    delete_slot_class(scs.slot_class_section_id, co)

    # Volunteer has no more slot-classes at this school → SchoolVolunteer soft-deleted
    assert not SchoolVolunteer.objects.filter(
        school_id=school.partner_id, volunteer_id=vol1, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_delete_slot_class_keeps_school_volunteer_if_other_classes_remain():
    """If the volunteer still has another slot-class at the school, SchoolVolunteer stays."""
    admin = _make_admin()
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    vol1 = _make_volunteer(sid, co)

    section_a = _make_section(sid, co, class_code="5")
    section_b = _make_section(sid, co, class_code="6")
    _add_children(section_a, 1, co)
    _add_children(section_b, 1, co)

    slot_a = _make_slot(sid, co)
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027", defaults={"is_active": True, "created_by": admin}
    )
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=sid, academic_year_id=year, defaults={"created_by": co}
    )
    # Second slot on a different day
    slot_b = Slot.objects.create(
        school_id=sid,
        school_academic_year_id=say,
        slot_name="Tuesday 09:00",
        day_of_week="tuesday",
        start_time=time(9, 0),
        end_time=time(10, 0),
        recurring=True,
        is_active=True,
        created_by=co,
    )

    scs_a = create_slot_class(slot_a.slot_id, _payload(section_a, vol1), co)
    create_slot_class(slot_b.slot_id, _payload(section_b, vol1), co)

    delete_slot_class(scs_a.slot_class_section_id, co)

    # Volunteer still has scs_b → SchoolVolunteer stays
    assert SchoolVolunteer.objects.filter(
        school_id=sid, volunteer_id=vol1, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_delete_slot_class_not_found_raises_404():
    co = _make_co()
    with pytest.raises(NotFound):
        delete_slot_class(999_999_999, co)


# ── Edit tests ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_edit_slot_class_volunteer_same_school_replaces_row():
    co, school, section, vol1, slot = _setup()
    vol2 = _make_volunteer(school.partner_id, co)

    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)

    edit_slot_class(scs.slot_class_section_id, _edit_payload(volunteers=[vol2]), co)

    # vol2 is now in the slot-class
    assert SlotClassSectionVolunteer.objects.filter(
        slot_class_section_id=scs, volunteer_id=vol2, is_active=True, removed=False
    ).exists()
    # vol1 is no longer in the slot-class
    assert not SlotClassSectionVolunteer.objects.filter(
        slot_class_section_id=scs, volunteer_id=vol1, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_edit_slot_class_volunteer_removes_school_volunteer_when_last():
    co, school, section, vol1, slot = _setup()
    vol2 = _make_volunteer(school.partner_id, co)
    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)

    edit_slot_class(scs.slot_class_section_id, _edit_payload(volunteers=[vol2]), co)

    # vol1 has no remaining slot-classes → SchoolVolunteer removed
    assert not SchoolVolunteer.objects.filter(
        school_id=school.partner_id, volunteer_id=vol1, is_active=True, removed=False
    ).exists()
    # vol2 SchoolVolunteer created
    assert SchoolVolunteer.objects.filter(
        school_id=school.partner_id, volunteer_id=vol2, is_active=True, removed=False
    ).exists()


@pytest.mark.django_db
def test_edit_slot_class_multiple_volunteers_replaces_all():
    """R2 relaxed to 1-5: edit can grow/shrink the volunteer list, not just swap 1-for-1."""
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    section = _make_section(sid, co)
    _add_children(section, 3, co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)
    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)

    vol2 = _make_volunteer(sid, co)
    vol3 = _make_volunteer(sid, co)
    edit_slot_class(scs.slot_class_section_id, _edit_payload(volunteers=[vol1, vol2, vol3]), co)

    active_vol_ids = set(
        SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs, is_active=True, removed=False
        ).values_list("volunteer_id_id", flat=True)
    )
    assert active_vol_ids == {vol1.user_id, vol2.user_id, vol3.user_id}


@pytest.mark.django_db
def test_edit_slot_class_same_single_volunteer_is_noop():
    """
    Regression: resubmitting the same volunteer_ids the client already had
    (e.g. an edit form that always sends its current state) must not
    deactivate and recreate the SlotClassSectionVolunteer row — that would
    show up in audit history as a spurious removal+reassignment.
    """
    co, school, section, vol1, slot = _setup()
    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)

    original = SlotClassSectionVolunteer.objects.get(slot_class_section_id=scs, volunteer_id=vol1)

    edit_slot_class(scs.slot_class_section_id, _edit_payload(volunteers=[vol1]), co)

    assert SlotClassSectionVolunteer.objects.filter(slot_class_section_id=scs).count() == 1
    unchanged = SlotClassSectionVolunteer.objects.get(slot_class_section_id=scs, volunteer_id=vol1)
    assert unchanged.slot_class_section_volunteer_id == original.slot_class_section_volunteer_id
    assert unchanged.is_active is True
    assert unchanged.removed is False
    assert unchanged.deleted_at is None


@pytest.mark.django_db
def test_edit_slot_class_same_volunteers_reordered_is_noop():
    """Same set of volunteers submitted in a different order is still a no-op."""
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    section = _make_section(sid, co)
    _add_children(section, 2, co)
    vol1 = _make_volunteer(sid, co)
    vol2 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)
    scs = create_slot_class(slot.slot_id, _payload(section, vol1, vol2), co)

    original_ids = set(
        SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs, is_active=True, removed=False
        ).values_list("slot_class_section_volunteer_id", flat=True)
    )

    edit_slot_class(scs.slot_class_section_id, _edit_payload(volunteers=[vol2, vol1]), co)

    unchanged_ids = set(
        SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs, is_active=True, removed=False
        ).values_list("slot_class_section_volunteer_id", flat=True)
    )
    assert unchanged_ids == original_ids


@pytest.mark.django_db
def test_edit_slot_class_r_bucket_violation_returns_400():
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    section = _make_section(sid, co)
    _add_children(section, 1, co)  # only 1 child
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)
    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)

    vol2 = _make_volunteer(sid, co)
    from sessionops.exceptions import ValidationError

    with pytest.raises(ValidationError):
        edit_slot_class(scs.slot_class_section_id, _edit_payload(volunteers=[vol1, vol2]), co)


@pytest.mark.django_db
def test_edit_slot_class_section_full_cascade_reset():
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    section_a = _make_section(sid, co, class_code="5")
    section_b = _make_section(sid, co, class_code="6")
    _add_children(section_a, 1, co)
    _add_children(section_b, 1, co)

    scs = create_slot_class(slot.slot_id, _payload(section_a, vol1), co)
    old_css_id = scs.class_section_subject_id_id

    edit_slot_class(
        scs.slot_class_section_id,
        _edit_payload(class_section_id=section_b.class_section_id),
        co,
    )

    scs.refresh_from_db()
    assert scs.class_section_id_id == section_b.class_section_id

    # Old CSS is soft-deleted
    assert not ClassSectionSubject.objects.filter(
        class_section_subject_id=old_css_id, is_active=True, removed=False
    ).exists()
    # New CSS created for section_b, always with the Foundation subject
    new_css = ClassSectionSubject.objects.get(
        class_section_id=section_b, is_active=True, removed=False
    )
    assert new_css.subject_id.subject_name == "Foundation"


# ── Slot-delete blocking tests (deferred from F-M3-6) ─────────────────────────


@pytest.mark.django_db
def test_delete_slot_with_active_slot_classes_returns_409():
    co, school, section, vol1, slot = _setup()
    create_slot_class(slot.slot_id, _payload(section, vol1), co)

    with pytest.raises(ConflictError) as exc_info:
        soft_delete_slot(slot.slot_id, co)

    assert "1" in exc_info.value.message
    assert "assignment" in exc_info.value.message.lower()


@pytest.mark.django_db
def test_delete_slot_with_only_removed_slot_classes_succeeds():
    co, school, section, vol1, slot = _setup()
    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)

    # Remove the slot-class first
    delete_slot_class(scs.slot_class_section_id, co)

    # Now slot delete should succeed
    deleted_slot = soft_delete_slot(slot.slot_id, co)
    assert deleted_slot.removed is True


@pytest.mark.django_db
def test_delete_slot_does_not_cascade():
    """Deleting a slot that has only removed slot-classes doesn't affect CSS/SCSV rows."""
    co, school, section, vol1, slot = _setup()
    scs = create_slot_class(slot.slot_id, _payload(section, vol1), co)
    css_id = scs.class_section_subject_id_id

    delete_slot_class(scs.slot_class_section_id, co)
    soft_delete_slot(slot.slot_id, co)

    # CSS was already soft-deleted by delete_slot_class, not by soft_delete_slot
    assert ClassSectionSubject.objects.filter(
        class_section_subject_id=css_id, removed=True
    ).exists()


@pytest.mark.django_db
def test_delete_slot_error_message_includes_active_count():
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id
    vol1 = _make_volunteer(sid, co)
    vol2 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    section_a = _make_section(sid, co, class_code="5")
    section_b = _make_section(sid, co, class_code="6")
    _add_children(section_a, 1, co)
    _add_children(section_b, 1, co)

    create_slot_class(slot.slot_id, _payload(section_a, vol1), co)
    create_slot_class(slot.slot_id, _payload(section_b, vol2), co)

    with pytest.raises(ConflictError) as exc_info:
        soft_delete_slot(slot.slot_id, co)

    assert "2" in exc_info.value.message


@pytest.mark.django_db
def test_cho_can_create_slot_class_within_scope():
    """CHO with valid worknode mapping can create a slot-class in their school."""
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id

    # CHO whose worknode_id maps to this school
    cho_wid = next(_WID)
    cho = User.objects.create(
        user_login=f"cho{next(_UID)}@test.com",
        user_display_name="CHO User",
        email="cho@test.com",
        user_role="CHO",
        is_active=True,
        worknode_id=cho_wid,
    )
    PartnerWorknode.objects.create(partner_id=str(sid), worknode_id=cho_wid)

    section = _make_section(sid, co)
    _add_children(section, 1, co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    scs = create_slot_class(slot.slot_id, _payload(section, vol1), cho)
    assert scs.slot_class_section_id is not None


@pytest.mark.django_db
def test_cho_cannot_create_slot_class_outside_scope_returns_403():
    """CHO without worknode mapping to the school is denied."""
    co = _make_co()
    school = _make_school(co)
    sid = school.partner_id

    # CHO with NO PartnerWorknode link to this school
    cho = User.objects.create(
        user_login=f"cho_out{next(_UID)}@test.com",
        user_display_name="Out-of-scope CHO",
        email="cho_out@test.com",
        user_role="CHO",
        is_active=True,
        worknode_id=next(_WID),
    )

    section = _make_section(sid, co)
    vol1 = _make_volunteer(sid, co)
    slot = _make_slot(sid, co)

    with pytest.raises(PermissionDenied):
        create_slot_class(slot.slot_id, _payload(section, vol1), cho)
