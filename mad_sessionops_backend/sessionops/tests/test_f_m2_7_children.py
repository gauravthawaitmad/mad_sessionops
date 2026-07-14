"""
Tests for F-M2-7: Children edit (demographic update + section/class history).
"""

import pytest

from sessionops.exceptions import ConflictError, NotFound, PermissionDenied, ValidationError
from sessionops.models import (
    AcademicYear,
    Child,
    ChildClass,
    ChildClassSection,
    ClassSection,
    Partner,
    Program,
    SchoolAcademicYear,
    SchoolClass,
    User,
)
from sessionops.schemas.children import ChildEditIn, ChildEnrollIn
from sessionops.services.children.edit import edit_child
from sessionops.services.children.enroll import enroll_child


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_user(login: str = "admin@test.com", role: str = "Function Lead") -> User:
    return User.objects.create(
        user_display_name="Test",
        user_login=login,
        email=login,
        user_role=role,
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
    sc = SchoolClass.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        class_id_id=cls.class_id,
        created_by=user,
    )
    return ClassSection.objects.create(
        school_class_id=sc,
        school_id=school_id,
        section_code=code,
        section_name=f"{class_code}th - {code}",
        created_by=user,
    )


def _enroll(school_id: int, section: ClassSection, user: User, **kwargs) -> Child:
    defaults = dict(
        first_name="Asha", last_name="Kumar", gender="female", age=10,
        school_class_id=section.school_class_id_id,
        class_section_id=section.class_section_id,
    )
    defaults.update(kwargs)
    return enroll_child(school_id, ChildEnrollIn(**defaults), user)


# ── Tests: edit_child ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestEditChildDemographics:
    def test_updates_demographic_fields(self):
        user = _make_user("e1@t.com")
        _make_partner(300)
        section = _make_section(300, user)
        child = _enroll(300, section, user)

        updated = edit_child(
            child.child_id,
            ChildEditIn(first_name="Priya", age=12, city="Hyderabad"),
            user,
        )

        refreshed = Child.objects.get(child_id=child.child_id)
        assert refreshed.first_name == "Priya"
        assert refreshed.age == 12
        assert refreshed.city == "Hyderabad"
        assert refreshed.last_name == "Kumar"  # unchanged
        assert updated.first_name == "Priya"

    def test_demographic_edit_does_not_touch_history_rows(self):
        user = _make_user("e2@t.com")
        _make_partner(301)
        section = _make_section(301, user)
        child = _enroll(301, section, user)

        edit_child(child.child_id, ChildEditIn(last_name="Sharma"), user)

        assert ChildClassSection.objects.filter(child_id=child, is_active=True).count() == 1
        assert ChildClass.objects.filter(child_id=child, is_active=True).count() == 1

    def test_nonexistent_child_raises_not_found(self):
        user = _make_user("e3@t.com")
        _make_partner(302)

        with pytest.raises(NotFound):
            edit_child(99999, ChildEditIn(first_name="Ghost"), user)


@pytest.mark.django_db
class TestEditChildSectionChange:
    def test_section_change_creates_history_rows(self):
        user = _make_user("e4@t.com")
        _make_partner(303)
        sec_a = _make_section(303, user, code="A")
        sec_b = ClassSection.objects.create(
            school_class_id=sec_a.school_class_id,
            school_id=303,
            section_code="B",
            section_name="5th - B",
            created_by=user,
        )
        child = _enroll(303, sec_a, user)

        edit_child(child.child_id, ChildEditIn(class_section_id=sec_b.class_section_id), user)

        # Old CCS soft-deleted
        assert ChildClassSection.objects.filter(
            child_id=child, class_section_id=sec_a, is_active=False, removed=True
        ).exists()
        # New CCS created
        assert ChildClassSection.objects.filter(
            child_id=child, class_section_id=sec_b, is_active=True
        ).exists()

    def test_same_section_no_history_rows_created(self):
        user = _make_user("e5@t.com")
        _make_partner(304)
        section = _make_section(304, user)
        child = _enroll(304, section, user)

        edit_child(
            child.child_id,
            ChildEditIn(first_name="Same", class_section_id=section.class_section_id),
            user,
        )

        # Still only one active CCS (no duplicate created)
        assert ChildClassSection.objects.filter(child_id=child, is_active=True).count() == 1

    def test_full_section_target_raises_conflict(self):
        user = _make_user("e6@t.com")
        _make_partner(305)
        sec_a = _make_section(305, user, code="A")
        sec_b = ClassSection.objects.create(
            school_class_id=sec_a.school_class_id,
            school_id=305,
            section_code="B",
            section_name="5th - B",
            created_by=user,
        )
        child = _enroll(305, sec_a, user)
        # Fill sec_b to capacity
        for i in range(5):
            _enroll(305, sec_b, user, first_name=f"Fill{i}", last_name="X")

        with pytest.raises(ConflictError, match="full"):
            edit_child(child.child_id, ChildEditIn(class_section_id=sec_b.class_section_id), user)

    def test_section_at_full_capacity_same_section_no_error(self):
        """CO editing other fields when child's own section is at capacity must NOT raise 409."""
        user = _make_user("e7@t.com")
        _make_partner(306)
        section = _make_section(306, user)
        children = []
        for i in range(5):
            children.append(_enroll(306, section, user, first_name=f"C{i}", last_name="X"))

        # Edit the first child's name only — section at capacity but not changing
        updated = edit_child(
            children[0].child_id,
            ChildEditIn(first_name="Renamed", class_section_id=section.class_section_id),
            user,
        )
        assert updated.first_name == "Renamed"

    def test_cross_school_section_raises_validation_error(self):
        user = _make_user("e8@t.com")
        _make_partner(307)
        _make_partner(308)
        sec_307 = _make_section(307, user, code="A")
        sec_308 = _make_section(308, user, code="A")
        child = _enroll(307, sec_307, user)

        with pytest.raises(ValidationError, match="different school"):
            edit_child(child.child_id, ChildEditIn(class_section_id=sec_308.class_section_id), user)


def _make_sixth_class(school_id: int, user: User) -> SchoolClass:
    program = Program.objects.get(program_id=1)
    from sessionops.models import Class
    cls_6, _ = Class.objects.get_or_create(
        class_code="6",
        defaults={"class_name": "6th", "program_id": program, "is_active": True},
    )
    say = SchoolAcademicYear.objects.get(school_id=school_id)
    return SchoolClass.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        class_id_id=cls_6.class_id,
        created_by=user,
    )


@pytest.mark.django_db
class TestEditChildClassChange:
    def test_class_change_via_explicit_school_class_id(self):
        """M6: class change is explicit (school_class_id), independent of any
        bucket/section change — no longer a side effect of section change."""
        user = _make_user("e9@t.com")
        _make_partner(309)
        sec_5a = _make_section(309, user, code="A", class_code="5")
        sc_6 = _make_sixth_class(309, user)

        child = _enroll(309, sec_5a, user)
        edit_child(
            child.child_id,
            ChildEditIn(school_class_id=sc_6.school_class_id),
            user,
        )

        # Old ChildClass soft-deleted
        assert ChildClass.objects.filter(
            child_id=child, is_active=False, removed=True
        ).exists()
        # New ChildClass created for 6th — exactly one active row
        assert ChildClass.objects.filter(
            child_id=child, school_class_id=sc_6, is_active=True
        ).exists()
        assert ChildClass.objects.filter(child_id=child, is_active=True).count() == 1

    def test_bucket_change_alone_does_not_touch_class(self):
        """The old 'class follows section' side effect is removed in M6 — a
        bucket has no school_class_id to follow anyway."""
        user = _make_user("e9b@t.com")
        _make_partner(3091)
        sec_a = _make_section(3091, user, code="A")
        sec_b = ClassSection.objects.create(
            school_class_id=sec_a.school_class_id,
            school_id=3091,
            section_code="B",
            section_name="5th - B",
            created_by=user,
        )
        child = _enroll(3091, sec_a, user)
        original_cc_id = ChildClass.objects.get(child_id=child, is_active=True).child_class_id

        edit_child(child.child_id, ChildEditIn(class_section_id=sec_b.class_section_id), user)

        current_cc = ChildClass.objects.get(child_id=child, is_active=True)
        assert current_cc.child_class_id == original_cc_id  # unchanged

    def test_old_child_subject_rows_retained_on_bucket_change(self):
        """M6 decision #2: ChildSubject rows are never soft-deleted on bucket
        change — Dots needs the full history."""
        from sessionops.models import ChildSubject, ClassSectionSubject, Subject

        user = _make_user("e9c@t.com")
        _make_partner(3092)
        sec_a = _make_section(3092, user, code="A")
        sec_b = ClassSection.objects.create(
            school_class_id=sec_a.school_class_id,
            school_id=3092,
            section_code="B",
            section_name="5th - B",
            created_by=user,
        )
        program = Program.objects.get(program_id=1)
        subject, _ = Subject.objects.get_or_create(
            subject_name="Foundation Day 1", defaults={"program_id": program}
        )
        css_a = ClassSectionSubject.objects.create(
            class_section_id=sec_a, subject_id=subject, created_by=user
        )

        child = _enroll(3092, sec_a, user)
        ChildSubject.objects.get_or_create(
            child_id=child, class_section_subject_id=css_a, defaults={"created_by": user}
        )

        edit_child(child.child_id, ChildEditIn(class_section_id=sec_b.class_section_id), user)

        # Old ChildSubject row (from sec_a) remains active — not soft-deleted
        assert ChildSubject.objects.filter(
            child_id=child, class_section_subject_id=css_a, is_active=True, removed=False
        ).exists()

    def test_class_change_data_quality_guard(self):
        """Belt-and-braces: if a child somehow has 2+ active ChildClass rows
        (pre-existing data inconsistency), edit_child refuses to silently
        pick one — raises instead of guessing."""
        user = _make_user("e9d@t.com")
        _make_partner(3093)
        sec_a = _make_section(3093, user, code="A")
        sc_6 = _make_sixth_class(3093, user)
        child = _enroll(3093, sec_a, user)

        # Force a second active ChildClass row directly (bypassing the service)
        ChildClass.objects.create(child_id=child, school_class_id=sc_6, created_by=user)

        with pytest.raises(ValidationError, match="Data inconsistency"):
            edit_child(
                child.child_id,
                ChildEditIn(school_class_id=sc_6.school_class_id),
                user,
            )


@pytest.mark.django_db
class TestEditChildRBAC:
    def test_co_cannot_edit_child_from_other_school(self):
        admin = _make_user("admin@t.com")
        co = _make_user("co@t.com", role="CO Full Time")
        co.co_id = 999  # assign a CO id
        co.save()

        _make_partner(310)
        _make_partner(311)
        # Give co access to 311, not 310
        Partner.objects.filter(partner_id=311).update(co_id=co.user_id)

        section = _make_section(310, admin)
        child = _enroll(310, section, admin)

        with pytest.raises(PermissionDenied):
            edit_child(child.child_id, ChildEditIn(first_name="Hijack"), co)
