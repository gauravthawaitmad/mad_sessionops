"""Tests for F-M2-10: Children list filters (status, class, section, search)."""

import pytest

from sessionops.models import (
    AcademicYear,
    Child,
    ClassSection,
    Partner,
    Program,
    SchoolAcademicYear,
    SchoolClass,
    User,
)
from sessionops.schemas.children import ChildEnrollIn, DeactivateIn, ChildEditIn
from sessionops.services.children.deactivate import deactivate_child
from sessionops.services.children.edit import edit_child
from sessionops.services.children.enroll import enroll_child
from sessionops.services.children.queries import list_children


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_user(login: str) -> User:
    return User.objects.create(
        user_display_name="Test",
        user_login=login,
        email=login,
        user_role="Function Lead",
        is_active=True,
    )


def _make_partner(partner_id: int) -> Partner:
    return Partner.objects.create(
        partner_id=partner_id,
        partner_name=f"School {partner_id}",
        converted=True,
    )


def _make_section(school_id: int, user: User, code: str = "A", class_code: str = "5") -> ClassSection:
    program, _ = Program.objects.get_or_create(
        program_id=1,
        defaults={"program_name": "Foundation Program", "is_active": True},
    )
    from sessionops.models import Class
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
    sc, _ = SchoolClass.objects.get_or_create(
        school_id=school_id,
        school_academic_year_id=say,
        class_id_id=cls.class_id,
        defaults={"created_by": user},
    )
    return ClassSection.objects.create(
        school_class_id=sc,
        school_id=school_id,
        section_code=code,
        section_name=f"Class {class_code} - {code}",
        created_by=user,
    )


def _enroll(school_id: int, section: ClassSection, user: User, **kwargs) -> Child:
    defaults = dict(
        first_name="Asha", last_name="Kumar", gender="female", age=10,
        class_section_id=section.class_section_id,
    )
    defaults.update(kwargs)
    return enroll_child(school_id, ChildEnrollIn(**defaults), user)


# ── Status filter ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStatusFilter:
    def test_default_status_active_excludes_deactivated(self):
        user = _make_user("f10_s1@t.com")
        _make_partner(600)
        section = _make_section(600, user)
        active_child = _enroll(600, section, user, first_name="Active")
        inactive_child = _enroll(600, section, user, first_name="Inactive")
        deactivate_child(inactive_child.child_id, DeactivateIn(removed_reason="dropped_out"), user)

        ids = [c.child_id for c in list_children(600, status="active")]
        assert active_child.child_id in ids
        assert inactive_child.child_id not in ids

    def test_status_inactive_returns_only_deactivated(self):
        user = _make_user("f10_s2@t.com")
        _make_partner(601)
        section = _make_section(601, user)
        active_child = _enroll(601, section, user, first_name="Active")
        inactive_child = _enroll(601, section, user, first_name="Inactive")
        deactivate_child(inactive_child.child_id, DeactivateIn(removed_reason="dropped_out"), user)

        ids = [c.child_id for c in list_children(601, status="inactive")]
        assert inactive_child.child_id in ids
        assert active_child.child_id not in ids

    def test_status_all_returns_both(self):
        user = _make_user("f10_s3@t.com")
        _make_partner(602)
        section = _make_section(602, user)
        c1 = _enroll(602, section, user, first_name="Alpha")
        c2 = _enroll(602, section, user, first_name="Beta")
        deactivate_child(c2.child_id, DeactivateIn(removed_reason="inactive"), user)

        ids = [c.child_id for c in list_children(602, status="all")]
        assert c1.child_id in ids
        assert c2.child_id in ids


# ── Class + section filter ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestClassSectionFilter:
    def test_filter_by_class_narrows_to_that_school_class(self):
        user = _make_user("f10_c1@t.com")
        _make_partner(603)
        sec5 = _make_section(603, user, code="A", class_code="5")
        sec6 = _make_section(603, user, code="A", class_code="6")
        c5 = _enroll(603, sec5, user, first_name="InClass5")
        c6 = _enroll(603, sec6, user, first_name="InClass6")

        sc5_id = sec5.school_class_id_id
        ids = [c.child_id for c in list_children(603, class_id=sc5_id)]
        assert c5.child_id in ids
        assert c6.child_id not in ids

    def test_filter_by_section_uses_current_assignment(self):
        user = _make_user("f10_c2@t.com")
        _make_partner(604)
        sec_a = _make_section(604, user, code="A")
        sec_b = _make_section(604, user, code="B")
        child = _enroll(604, sec_a, user)

        # Move to section B
        edit_child(child.child_id, ChildEditIn(class_section_id=sec_b.class_section_id), user)

        ids_b = [c.child_id for c in list_children(604, section_id=sec_b.class_section_id)]
        ids_a = [c.child_id for c in list_children(604, section_id=sec_a.class_section_id)]
        assert child.child_id in ids_b
        assert child.child_id not in ids_a

    def test_inactive_children_excluded_when_class_filter_active(self):
        user = _make_user("f10_c3@t.com")
        _make_partner(605)
        section = _make_section(605, user)
        child = _enroll(605, section, user)
        deactivate_child(child.child_id, DeactivateIn(removed_reason="inactive"), user)

        sc_id = section.school_class_id_id
        # Inactive children have no active class assignment — filtered out
        ids = [c.child_id for c in list_children(605, class_id=sc_id)]
        assert child.child_id not in ids


# ── Search filter ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSearchFilter:
    def test_search_first_name_case_insensitive(self):
        user = _make_user("f10_q1@t.com")
        _make_partner(606)
        section = _make_section(606, user)
        child = _enroll(606, section, user, first_name="Alibek", last_name="Sanov")
        _enroll(606, section, user, first_name="Rajesh", last_name="Verma")

        ids = [c.child_id for c in list_children(606, search="ali")]
        assert child.child_id in ids

    def test_search_last_name_substring(self):
        user = _make_user("f10_q2@t.com")
        _make_partner(607)
        section = _make_section(607, user)
        child = _enroll(607, section, user, first_name="Priya", last_name="Sharma")
        _enroll(607, section, user, first_name="Ravi", last_name="Kumar")

        ids = [c.child_id for c in list_children(607, search="harm")]
        assert child.child_id in ids

    def test_filters_combine_status_and_search(self):
        user = _make_user("f10_q3@t.com")
        _make_partner(608)
        section = _make_section(608, user)
        active = _enroll(608, section, user, first_name="Alisha", last_name="Roy")
        inactive = _enroll(608, section, user, first_name="Alina", last_name="Roy")
        deactivate_child(inactive.child_id, DeactivateIn(removed_reason="inactive"), user)

        ids = [c.child_id for c in list_children(608, status="active", search="Ali")]
        assert active.child_id in ids
        assert inactive.child_id not in ids
