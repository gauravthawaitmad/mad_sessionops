"""
Tests for F-M2-6: Children enrollment + list.
"""

import pytest

from sessionops.exceptions import ConflictError, NotFound, ValidationError
from sessionops.models import (
    AcademicYear,
    BatchChild,
    Child,
    ChildClass,
    ChildClassSection,
    ChildProgram,
    ClassSection,
    Partner,
    Program,
    SchoolAcademicYear,
    SchoolClass,
    User,
)
from sessionops.schemas.children import ChildEnrollIn
from sessionops.services.children.enroll import enroll_child
from sessionops.services.children.queries import list_children

# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_user(login: str = "admin@test.com", role: str = "Function Lead") -> User:
    return User.objects.create(
        user_display_name="Test",
        user_login=login,
        email=login,
        user_role=role,
        is_active=True,
    )


def _make_partner(partner_id: int, confirmed_child_count=None) -> Partner:
    return Partner.objects.create(
        partner_id=partner_id,
        partner_name=f"School {partner_id}",
        converted=True,
        confirmed_child_count=confirmed_child_count,
    )


def _make_section(school_id: int, user: User, code: str = "A") -> ClassSection:
    # Explicit pk=1 so enroll_child's hardcoded FOUNDATION_PROGRAM_ID=1 always resolves.
    # Auto-increment sequences don't reset on transaction rollback, so each test
    # must force the explicit insert rather than relying on sequence start value.
    program, _ = Program.objects.get_or_create(
        program_id=1,
        defaults={"program_name": "Foundation Program", "is_active": True},
    )
    from sessionops.models import Class

    cls, _ = Class.objects.get_or_create(
        class_code="5",
        defaults={"class_name": "5th", "program_id": program, "is_active": True},
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
        section_name=f"5th - {code}",
        created_by=user,
    )


def _payload(section: ClassSection, **overrides) -> ChildEnrollIn:
    defaults = dict(
        first_name="Asha",
        last_name="Kumar",
        gender="female",
        age=10,
        school_class_id=section.school_class_id_id,
        class_section_id=section.class_section_id,
    )
    defaults.update(overrides)
    return ChildEnrollIn(**defaults)


# ── Tests: enroll_child ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestEnrollChild:
    def test_creates_all_five_rows(self):
        user = _make_user()
        _make_partner(100)
        section = _make_section(100, user)

        child = enroll_child(100, _payload(section), user)

        assert Child.objects.filter(child_id=child.child_id).exists()
        assert ChildClass.objects.filter(child_id=child, is_active=True).exists()
        assert ChildClassSection.objects.filter(child_id=child, is_active=True).exists()
        assert BatchChild.objects.filter(child_id=child, is_active=True).exists()
        assert ChildProgram.objects.filter(child_id=child, is_active=True).exists()

    def test_assigns_foundation_program(self):
        user = _make_user("u2@t.com")
        _make_partner(101)
        section = _make_section(101, user)

        child = enroll_child(101, _payload(section), user)

        cp = ChildProgram.objects.get(child_id=child)
        assert cp.program_id_id == 1

    def test_blocked_at_section_capacity(self):
        user = _make_user("u3@t.com")
        _make_partner(102)
        section = _make_section(102, user, code="B")

        for i in range(5):
            enroll_child(102, _payload(section, first_name=f"Child{i}", last_name="X"), user)

        with pytest.raises(ConflictError, match="full"):
            enroll_child(102, _payload(section, first_name="Over", last_name="Limit"), user)

    def test_blocked_at_school_confirmed_limit(self):
        user = _make_user("u4@t.com")
        _make_partner(103, confirmed_child_count=1)
        section_a = _make_section(103, user, code="C")
        # need two different section codes for the same school
        section_b = ClassSection.objects.create(
            school_class_id=section_a.school_class_id,
            school_id=103,
            section_code="D",
            section_name="5th - D",
            created_by=user,
        )

        enroll_child(103, _payload(section_a, first_name="First"), user)
        with pytest.raises(ConflictError, match="confirmed child limit"):
            enroll_child(103, _payload(section_b, first_name="Second"), user)

    def test_allowed_when_confirmed_count_null(self):
        user = _make_user("u5@t.com")
        _make_partner(104, confirmed_child_count=None)
        section = _make_section(104, user, code="E")

        # Enroll more than a typical small limit — should succeed
        for i in range(3):
            enroll_child(104, _payload(section, first_name=f"Child{i}", last_name="Free"), user)

        assert BatchChild.objects.filter(school_id=104, is_active=True).count() == 3

    def test_bucket_from_other_school_raises_validation_error(self):
        user = _make_user("u6@t.com")
        _make_partner(105)
        _make_partner(106)
        section_local = _make_section(105, user, code="F")
        section_other = _make_section(106, user, code="F")

        with pytest.raises(ValidationError, match="does not belong"):
            enroll_child(
                105,
                _payload(section_local, class_section_id=section_other.class_section_id),
                user,
            )

    def test_school_class_from_other_school_raises_not_found(self):
        user = _make_user("u6b@t.com")
        _make_partner(1050)
        _make_partner(1060)
        section_other = _make_section(1060, user, code="F")

        with pytest.raises(NotFound, match="School class"):
            enroll_child(
                1050,
                _payload(section_other, school_class_id=section_other.school_class_id_id),
                user,
            )

    def test_nonexistent_bucket_raises_not_found(self):
        user = _make_user("u7@t.com")
        _make_partner(107)
        section = _make_section(107, user, code="G")
        payload = ChildEnrollIn(
            first_name="Ghost",
            last_name="Child",
            gender="male",
            age=11,
            school_class_id=section.school_class_id_id,
            class_section_id=99999,
        )
        with pytest.raises(NotFound):
            enroll_child(107, payload, user)

    def test_nonexistent_school_class_raises_not_found(self):
        user = _make_user("u7b@t.com")
        _make_partner(1070)
        payload = ChildEnrollIn(
            first_name="Ghost",
            last_name="Child",
            gender="male",
            age=11,
            school_class_id=99999,
        )
        with pytest.raises(NotFound, match="School class"):
            enroll_child(1070, payload, user)

    def test_enroll_without_bucket_succeeds(self):
        user = _make_user("u7c@t.com")
        _make_partner(1071)
        section = _make_section(1071, user, code="H")

        child = enroll_child(
            1071,
            _payload(section, class_section_id=None),
            user,
        )

        assert ChildClass.objects.filter(child_id=child, is_active=True).exists()
        assert not ChildClassSection.objects.filter(child_id=child, is_active=True).exists()

    def test_returned_child_has_class_and_section_names(self):
        user = _make_user("u8@t.com")
        _make_partner(108)
        section = _make_section(108, user, code="G")

        child = enroll_child(108, _payload(section, first_name="Ravi"), user)

        assert hasattr(child, "current_class_name")
        assert hasattr(child, "current_section_name")
        assert child.current_class_name == "5th"
        assert child.current_section_name == "5th - G"


# ── Tests: list_children ───────────────────────────────────────────────────────


@pytest.mark.django_db
class TestListChildren:
    def test_returns_enrolled_children(self):
        user = _make_user("u9@t.com")
        _make_partner(200)
        section = _make_section(200, user, code="H")

        enroll_child(200, _payload(section, first_name="Priya"), user)
        enroll_child(200, _payload(section, first_name="Arjun"), user)

        qs = list_children(200)
        assert qs.count() == 2

    def test_excludes_removed_children(self):
        user = _make_user("u10@t.com")
        _make_partner(201)
        section = _make_section(201, user, code="I")

        child = enroll_child(201, _payload(section, first_name="Remove"), user)
        Child.objects.filter(child_id=child.child_id).update(is_active=False, removed=True)

        qs = list_children(201, status="active")
        assert qs.count() == 0

    def test_status_all_includes_inactive(self):
        user = _make_user("u11@t.com")
        _make_partner(202)
        section = _make_section(202, user, code="J")

        child = enroll_child(202, _payload(section, first_name="Mixed"), user)
        Child.objects.filter(child_id=child.child_id).update(is_active=False, removed=True)

        assert list_children(202, status="all").count() == 1
        assert list_children(202, status="active").count() == 0
