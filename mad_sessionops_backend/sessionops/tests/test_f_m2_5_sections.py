"""
Tests for F-M2-5: Sections — add, list, available codes, remove.
"""

import pytest

from sessionops.exceptions import ConflictError, NotFound
from sessionops.models import (
    AcademicYear,
    Child,
    ChildClassSection,
    Class,
    ClassSection,
    Program,
    SchoolAcademicYear,
    SchoolClass,
    User,
)
from sessionops.services.structure.sections import (
    add_section_to_class,
    available_section_codes,
    list_sections_for_class,
    soft_delete_section,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_user(login: str = "admin@test.com", role: str = "Function Lead") -> User:
    return User.objects.create(
        user_display_name="Test User",
        user_login=login,
        email=login,
        user_role=role,
        is_active=True,
    )





def _make_school_class(school_id: int, user: User, class_code: str = "5", class_name: str = "5th") -> SchoolClass:
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    cls, _ = Class.objects.get_or_create(
        class_code=class_code,
        defaults={"class_name": class_name, "program_id": program, "is_active": True},
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
    return SchoolClass.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        class_id_id=cls.class_id,
        created_by=user,
    )


# ── Tests: add_section_to_class ────────────────────────────────────────────────

@pytest.mark.django_db
class TestAddSection:
    def test_add_section_creates_row_with_correct_name(self):
        user = _make_user()
        sc = _make_school_class(school_id=10, user=user)
        section = add_section_to_class(sc.school_class_id, 10, "A", user)
        assert section.section_code == "A"
        assert section.section_name == "5th - A"
        assert ClassSection.objects.filter(school_class_id=sc, section_code="A").exists()

    def test_add_section_with_used_code_raises_conflict(self):
        user = _make_user("u2@t.com")
        sc = _make_school_class(school_id=11, user=user)
        add_section_to_class(sc.school_class_id, 11, "B", user)
        with pytest.raises(ConflictError):
            add_section_to_class(sc.school_class_id, 11, "B", user)

    def test_add_section_to_nonexistent_class_raises_not_found(self):
        user = _make_user("u3@t.com")
        with pytest.raises(NotFound):
            add_section_to_class(99999, 10, "A", user)

    def test_section_name_computed_correctly_for_different_classes(self):
        user = _make_user("u4@t.com")
        sc = _make_school_class(school_id=12, user=user, class_code="6", class_name="6th")
        section = add_section_to_class(sc.school_class_id, 12, "C", user)
        assert section.section_name == "6th - C"


# ── Tests: available_section_codes ────────────────────────────────────────────

@pytest.mark.django_db
class TestAvailableSectionCodes:
    def test_all_codes_available_for_new_class(self):
        user = _make_user("u5@t.com")
        sc = _make_school_class(school_id=20, user=user)
        codes = available_section_codes(sc.school_class_id)
        assert codes == ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]

    def test_used_code_excluded(self):
        user = _make_user("u6@t.com")
        sc = _make_school_class(school_id=21, user=user)
        add_section_to_class(sc.school_class_id, 21, "A", user)
        codes = available_section_codes(sc.school_class_id)
        assert "A" not in codes
        assert "B" in codes

    def test_soft_deleted_code_becomes_available_again(self):
        user = _make_user("u7@t.com")
        sc = _make_school_class(school_id=22, user=user)
        section = add_section_to_class(sc.school_class_id, 22, "A", user)
        assert "A" not in available_section_codes(sc.school_class_id)

        soft_delete_section(section.class_section_id, 22, user)
        assert "A" in available_section_codes(sc.school_class_id)


# ── Tests: list_sections_for_class ────────────────────────────────────────────

@pytest.mark.django_db
class TestListSections:
    def test_list_returns_active_sections_ordered(self):
        user = _make_user("u8@t.com")
        sc = _make_school_class(school_id=30, user=user)
        add_section_to_class(sc.school_class_id, 30, "B", user)
        add_section_to_class(sc.school_class_id, 30, "A", user)
        sections = list(list_sections_for_class(sc.school_class_id))
        assert [s.section_code for s in sections] == ["A", "B"]

    def test_list_excludes_soft_deleted(self):
        user = _make_user("u9@t.com")
        sc = _make_school_class(school_id=31, user=user)
        section = add_section_to_class(sc.school_class_id, 31, "A", user)
        soft_delete_section(section.class_section_id, 31, user)
        assert list_sections_for_class(sc.school_class_id).count() == 0


# ── Tests: soft_delete_section ────────────────────────────────────────────────

@pytest.mark.django_db
class TestSoftDeleteSection:
    def test_soft_delete_with_no_children_succeeds(self):
        user = _make_user("u10@t.com")
        sc = _make_school_class(school_id=40, user=user)
        section = add_section_to_class(sc.school_class_id, 40, "A", user)
        soft_delete_section(section.class_section_id, 40, user)
        cs = ClassSection.objects.get(class_section_id=section.class_section_id)
        assert not cs.is_active
        assert cs.removed
        assert cs.deleted_at is not None

    def test_soft_delete_nonexistent_raises_not_found(self):
        user = _make_user("u11@t.com")
        with pytest.raises(NotFound):
            soft_delete_section(99999, 40, user)

    def test_soft_delete_with_active_children_raises_conflict_with_count(self):
        user = _make_user("u12@t.com")
        sc = _make_school_class(school_id=41, user=user)
        section = add_section_to_class(sc.school_class_id, 41, "A", user)
        # Create a ChildClassSection row manually to simulate an enrolled child
        child = Child.objects.create(
            school_id=41,
            first_name="Test",
            last_name="Child",
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
        with pytest.raises(ConflictError) as exc_info:
            soft_delete_section(section.class_section_id, 41, user)
        assert "1 active child" in str(exc_info.value)


# ── F-M3-7 extension: section delete blocked by slot-class assignments ────────

@pytest.mark.django_db
def test_section_delete_blocked_when_slot_classes_exist():
    """M3 extension: soft_delete_section raises ConflictError if active SlotClassSection rows exist."""
    from datetime import time
    from sessionops.models import (
        AcademicYear, Partner, PartnerWorknode, SchoolAcademicYear, Slot,
        SlotClassSection, ClassSectionSubject, Subject,
    )

    user = _make_user("u_scs@t.com")
    school_id = 42_001
    Partner.objects.create(
        partner_id=school_id,
        partner_name=f"School {school_id}",
        co_id=user.user_id,
        converted=True,
        is_active=True,
    )
    sc = _make_school_class(school_id=school_id, user=user)
    section = add_section_to_class(sc.school_class_id, school_id, "A", user)

    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027", defaults={"is_active": True, "created_by": user}
    )
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id, academic_year_id=year, defaults={"created_by": user}
    )
    slot = Slot.objects.create(
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

    from sessionops.models import Program as _Prog
    prog, _ = _Prog.objects.get_or_create(program_name="Foundation Program")
    subj, _ = Subject.objects.get_or_create(
        subject_name="Foundation Day 1", defaults={"program_id": prog}
    )
    css = ClassSectionSubject.objects.create(
        class_section_id=section,
        subject_id=subj,
        created_by=user,
    )
    SlotClassSection.objects.create(
        slot_id=slot,
        class_section_id=section,
        class_section_subject_id=css,
        is_active=True,
        created_by=user,
    )

    with pytest.raises(ConflictError) as exc_info:
        soft_delete_section(section.class_section_id, school_id, user)

    assert "assignment" in exc_info.value.message.lower()
