"""
Tests for F-M2-3: Academic Year Management.

Coverage:
  - get_active_academic_year() returns active year
  - Only-one-active-year constraint enforced
  - get_all_academic_years() returns list
  - create_academic_year() stays inactive, raises ConflictError on duplicate
  - update_academic_year() updates label, raises NotFound for missing
  - get_or_create_school_academic_year() creates + is idempotent
  - Label format validation (YYYY-YYYY)
"""

from django.db import IntegrityError

import pytest

from sessionops.exceptions import ConflictError, NotFound
from sessionops.models import AcademicYear, SchoolAcademicYear, User
from sessionops.schemas.academic_year import AcademicYearCreateIn, AcademicYearUpdateIn
from sessionops.services.academic_year.queries import (
    create_academic_year,
    get_active_academic_year,
    get_all_academic_years,
    get_or_create_school_academic_year,
    update_academic_year,
)


def _make_user(login: str = "admin@test.com", role: str = "Function Lead") -> User:
    return User.objects.create(
        user_display_name="Test User",
        user_login=login,
        email=login,
        user_role=role,
        is_active=True,
    )


def _make_active_year(user: User, label: str = "2026-2027") -> AcademicYear:
    return AcademicYear.objects.create(label=label, is_active=True, created_by=user)


@pytest.mark.django_db
class TestGetActiveAcademicYear:
    def test_returns_active_year(self):
        user = _make_user()
        _make_active_year(user)
        year = get_active_academic_year()
        assert year.label == "2026-2027"
        assert year.is_active is True

    def test_raises_not_found_when_none(self):
        with pytest.raises(NotFound):
            get_active_academic_year()

    def test_returns_removed_false_year_only(self):
        user = _make_user()
        AcademicYear.objects.create(
            label="2026-2027", is_active=True, removed=True, created_by=user
        )
        with pytest.raises(NotFound):
            get_active_academic_year()


@pytest.mark.django_db
class TestActiveYearConstraint:
    def test_only_one_active_year_constraint_enforced(self):
        user = _make_user()
        _make_active_year(user, "2026-2027")
        with pytest.raises(IntegrityError):
            AcademicYear.objects.create(label="2027-2028", is_active=True, created_by=user)

    def test_multiple_inactive_years_allowed(self):
        user = _make_user()
        AcademicYear.objects.create(label="2024-2025", is_active=False, created_by=user)
        AcademicYear.objects.create(label="2025-2026", is_active=False, created_by=user)
        assert AcademicYear.objects.filter(is_active=False).count() == 2


@pytest.mark.django_db
class TestGetAllAcademicYears:
    def test_returns_list(self):
        user = _make_user()
        _make_active_year(user, "2026-2027")
        AcademicYear.objects.create(label="2025-2026", is_active=False, created_by=user)
        years = get_all_academic_years()
        assert isinstance(years, list)
        assert len(years) == 2

    def test_excludes_removed_years(self):
        user = _make_user()
        _make_active_year(user, "2026-2027")
        AcademicYear.objects.create(
            label="2025-2026", is_active=False, removed=True, created_by=user
        )
        years = get_all_academic_years()
        assert len(years) == 1


@pytest.mark.django_db
class TestCreateAcademicYear:
    def test_create_year_stays_inactive(self):
        user = _make_user()
        payload = AcademicYearCreateIn(label="2026-2027")
        year = create_academic_year(payload, user)
        assert year.is_active is False
        assert year.label == "2026-2027"

    def test_create_duplicate_raises_conflict(self):
        user = _make_user()
        AcademicYear.objects.create(label="2026-2027", is_active=True, created_by=user)
        payload = AcademicYearCreateIn(label="2026-2027")
        with pytest.raises(ConflictError):
            create_academic_year(payload, user)

    def test_label_must_be_yyyy_yyyy_format(self):
        from pydantic import ValidationError as PydanticValidationError

        with pytest.raises(PydanticValidationError):
            AcademicYearCreateIn(label="2026")
        with pytest.raises(PydanticValidationError):
            AcademicYearCreateIn(label="2026/2027")
        with pytest.raises(PydanticValidationError):
            AcademicYearCreateIn(label="2026-2028")  # not consecutive


@pytest.mark.django_db
class TestUpdateAcademicYear:
    def test_update_label(self):
        user = _make_user()
        year = AcademicYear.objects.create(label="2025-2026", is_active=False, created_by=user)
        payload = AcademicYearUpdateIn(label="2024-2025")
        updated = update_academic_year(year.academic_year_id, payload)
        assert updated.label == "2024-2025"

    def test_update_nonexistent_raises_not_found(self):
        payload = AcademicYearUpdateIn(label="2030-2031")
        with pytest.raises(NotFound):
            update_academic_year(999999, payload)


@pytest.mark.django_db
class TestSchoolAcademicYearAutoCreate:
    def test_creates_on_first_call(self):
        user = _make_user()
        _make_active_year(user)
        school_id = 1001
        say = get_or_create_school_academic_year(school_id, user)
        assert say.school_id == school_id
        assert say.academic_year_id.label == "2026-2027"

    def test_is_idempotent(self):
        user = _make_user()
        _make_active_year(user)
        school_id = 1002
        say1 = get_or_create_school_academic_year(school_id, user)
        say2 = get_or_create_school_academic_year(school_id, user)
        assert say1.school_academic_year_id == say2.school_academic_year_id
        assert SchoolAcademicYear.objects.filter(school_id=school_id).count() == 1
