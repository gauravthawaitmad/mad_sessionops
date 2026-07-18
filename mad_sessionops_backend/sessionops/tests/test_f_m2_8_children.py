"""
Tests for F-M2-8: Children deactivation.
"""

import unittest.mock

import pytest

from sessionops.exceptions import NotFound, PermissionDenied
from sessionops.models import (
    AcademicYear,
    BatchChild,
    Child,
    ChildClass,
    ChildClassSection,
    ChildProgram,
    ChildRemovalLog,
    ClassSection,
    Partner,
    Program,
    SchoolAcademicYear,
    SchoolClass,
    User,
)
from sessionops.schemas.children import ChildEnrollIn, DeactivateIn
from sessionops.services.children.deactivate import deactivate_child
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


def _make_section(
    school_id: int, user: User, code: str = "A", class_code: str = "5"
) -> ClassSection:
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
        first_name="Asha",
        last_name="Kumar",
        gender="female",
        age=10,
        school_class_id=section.school_class_id_id,
        class_section_id=section.class_section_id,
    )
    defaults.update(kwargs)
    return enroll_child(school_id, ChildEnrollIn(**defaults), user)


# ── Tests ──────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestDeactivateChildHistoryRows:
    def test_deactivate_marks_child_inactive(self):
        user = _make_user("d1@t.com")
        _make_partner(400)
        section = _make_section(400, user)
        child = _enroll(400, section, user)

        deactivate_child(child.child_id, DeactivateIn(removed_reason="transferred"), user)

        child.refresh_from_db()
        assert child.is_active is False

    def test_deactivate_soft_deletes_all_history_rows(self):
        user = _make_user("d2@t.com")
        _make_partner(401)
        section = _make_section(401, user)
        child = _enroll(401, section, user)

        deactivate_child(child.child_id, DeactivateIn(removed_reason="dropped_out"), user)

        assert ChildClass.objects.filter(child_id=child, is_active=True).count() == 0
        assert ChildClassSection.objects.filter(child_id=child, is_active=True).count() == 0
        assert BatchChild.objects.filter(child_id=child, is_active=True).count() == 0
        assert ChildProgram.objects.filter(child_id=child, is_active=True).count() == 0

    def test_history_rows_have_removed_flag_and_deleted_at(self):
        user = _make_user("d3@t.com")
        _make_partner(402)
        section = _make_section(402, user)
        child = _enroll(402, section, user)

        deactivate_child(child.child_id, DeactivateIn(removed_reason="inactive"), user)

        ccs = ChildClassSection.objects.get(child_id=child)
        assert ccs.removed is True
        assert ccs.deleted_at is not None


@pytest.mark.django_db
class TestDeactivateChildRemovalLog:
    def test_creates_removal_log_with_correct_fields(self):
        user = _make_user("d4@t.com")
        _make_partner(403)
        section = _make_section(403, user)
        child = _enroll(403, section, user)

        deactivate_child(
            child.child_id,
            DeactivateIn(removed_reason="transferred"),
            user,
        )

        log = ChildRemovalLog.objects.get(child_id=child)
        assert log.removed_reason == "transferred"
        assert log.co_id == user.user_id
        assert log.school_id == 403
        assert log.is_active is True
        assert log.removed is False
        assert log.removed_datetime is not None
        assert log.other_details is None

    def test_other_reason_with_details_stores_details(self):
        user = _make_user("d5@t.com")
        _make_partner(404)
        section = _make_section(404, user)
        child = _enroll(404, section, user)

        deactivate_child(
            child.child_id,
            DeactivateIn(removed_reason="other", other_details="Family moved abroad"),
            user,
        )

        log = ChildRemovalLog.objects.get(child_id=child)
        assert log.other_details == "Family moved abroad"


@pytest.mark.django_db
class TestDeactivateChildValidation:
    def test_other_reason_without_details_raises_validation_error(self):
        from pydantic import ValidationError as PydanticValidationError

        with pytest.raises(PydanticValidationError):
            DeactivateIn(removed_reason="other")

    def test_other_reason_with_empty_details_raises_validation_error(self):
        from pydantic import ValidationError as PydanticValidationError

        with pytest.raises(PydanticValidationError):
            DeactivateIn(removed_reason="other", other_details="")

    def test_already_inactive_child_raises_not_found(self):
        user = _make_user("d6@t.com")
        _make_partner(405)
        section = _make_section(405, user)
        child = _enroll(405, section, user)

        # First deactivation
        deactivate_child(child.child_id, DeactivateIn(removed_reason="inactive"), user)

        # Second deactivation must raise NotFound
        with pytest.raises(NotFound):
            deactivate_child(child.child_id, DeactivateIn(removed_reason="inactive"), user)


@pytest.mark.django_db
class TestDeactivateChildRBAC:
    def test_co_cannot_deactivate_other_school_child(self):
        admin = _make_user("admin2@t.com")
        co = _make_user("co2@t.com", role="CO Full Time")
        co.co_id = 888
        co.save()

        _make_partner(406)
        _make_partner(407)
        Partner.objects.filter(partner_id=407).update(co_id=co.user_id)

        section = _make_section(406, admin)
        child = _enroll(406, section, admin)

        with pytest.raises(PermissionDenied):
            deactivate_child(child.child_id, DeactivateIn(removed_reason="inactive"), co)

    def test_admin_can_deactivate_any_child(self):
        admin = _make_user("admin3@t.com")
        _make_partner(408)
        section = _make_section(408, admin)
        child = _enroll(408, section, admin)

        # Should not raise
        deactivate_child(child.child_id, DeactivateIn(removed_reason="transferred"), admin)
        child.refresh_from_db()
        assert child.is_active is False


@pytest.mark.django_db(transaction=True)
class TestDeactivateChildTransaction:
    def test_partial_failure_rolls_back(self):
        user = _make_user("d7@t.com")
        _make_partner(409)
        section = _make_section(409, user)
        child = _enroll(409, section, user)

        with unittest.mock.patch(
            "sessionops.services.children.deactivate.ChildRemovalLog.objects.create",
            side_effect=Exception("Simulated DB error"),
        ):
            with pytest.raises(Exception):
                deactivate_child(child.child_id, DeactivateIn(removed_reason="inactive"), user)

        # Transaction rolled back — child is still active
        child.refresh_from_db()
        assert child.is_active is True
        assert ChildClassSection.objects.filter(child_id=child, is_active=True).exists()
