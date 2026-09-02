"""
Tests for F-M6-1: Schema migrations — nullable class_section fields,
section_display_name, slug uniqueness, Foundation subject seed.
"""

from django.db import IntegrityError, transaction

import pytest

from sessionops.models import ClassSection, Program, Subject, User

# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_user(login: str = "admin@test.com", role: str = "Function Lead") -> User:
    return User.objects.create(
        user_display_name="Test User",
        user_login=login,
        email=login,
        user_role=role,
        is_active=True,
    )


# ── ClassSection nullability (bucket-shape rows) ────────────────────────────────


@pytest.mark.django_db
class TestClassSectionNullableFields:
    def test_bucket_style_row_with_no_class_or_code(self):
        """A row with school_class_id=None and section_code=None (bucket shape) is valid."""
        user = _make_user()
        cs = ClassSection.objects.create(
            school_id=1,
            section_name="care_monster",
            section_display_name="Care Monster",
            created_by=user,
        )
        assert cs.school_class_id is None
        assert cs.section_code is None
        assert cs.section_display_name == "Care Monster"

    def test_legacy_style_row_still_works(self):
        """A legacy row with school_class_id + section_code set is still valid."""
        from sessionops.models import AcademicYear, Class, SchoolAcademicYear, SchoolClass

        user = _make_user()
        program, _ = Program.objects.get_or_create(program_name="Foundation Program")
        cls, _ = Class.objects.get_or_create(
            class_code="5", defaults={"class_name": "5th", "program_id": program, "is_active": True}
        )
        year, _ = AcademicYear.objects.get_or_create(
            label="2026-2027", defaults={"is_active": True, "created_by": user}
        )
        say, _ = SchoolAcademicYear.objects.get_or_create(
            school_id=1, academic_year_id=year, defaults={"created_by": user}
        )
        school_class = SchoolClass.objects.create(
            school_id=1, school_academic_year_id=say, class_id_id=cls.class_id, created_by=user
        )
        cs = ClassSection.objects.create(
            school_class_id=school_class,
            school_id=1,
            section_code="A",
            section_name="5th - A",
            created_by=user,
        )
        assert cs.section_code == "A"

    def test_section_name_accepts_up_to_100_chars(self):
        """section_name widened from 20 to 100 chars for slugs derived from free-text names."""
        user = _make_user()
        long_name = "a" * 100
        cs = ClassSection.objects.create(
            school_id=1,
            section_name=long_name,
            created_by=user,
        )
        cs.refresh_from_db()
        assert cs.section_name == long_name


# ── uniq_section_per_school_class (updated condition) ───────────────────────────


@pytest.mark.django_db
class TestSectionCodeConstraint:
    def test_two_null_section_codes_do_not_collide(self):
        """Two buckets (section_code=None) in the same school_class don't violate
        uniq_section_per_school_class — the constraint now only applies when
        section_code IS NOT NULL."""
        user = _make_user()
        ClassSection.objects.create(school_id=1, section_name="bucket_one", created_by=user)
        ClassSection.objects.create(school_id=1, section_name="bucket_two", created_by=user)
        assert ClassSection.objects.filter(school_id=1).count() == 2


# ── class_section_slug_per_school (NEW) ─────────────────────────────────────────


@pytest.mark.django_db
class TestSlugUniquePerSchool:
    def test_duplicate_slug_same_school_raises_integrity_error(self):
        user = _make_user()
        ClassSection.objects.create(school_id=1, section_name="care_monster", created_by=user)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ClassSection.objects.create(
                    school_id=1, section_name="care_monster", created_by=user
                )

    def test_same_slug_different_schools_is_allowed(self):
        user = _make_user()
        ClassSection.objects.create(school_id=1, section_name="care_monster", created_by=user)
        ClassSection.objects.create(school_id=2, section_name="care_monster", created_by=user)
        assert ClassSection.objects.filter(section_name="care_monster").count() == 2

    def test_soft_deleted_row_does_not_block_reuse_of_slug(self):
        """The constraint is scoped to (is_active AND NOT removed) — a
        soft-deleted bucket's slug can be reused by a new bucket in the same
        school."""
        user = _make_user()
        cs = ClassSection.objects.create(school_id=1, section_name="care_monster", created_by=user)
        cs.removed = True
        cs.is_active = False
        cs.save()
        # Should not raise
        ClassSection.objects.create(school_id=1, section_name="care_monster", created_by=user)

    def test_inactive_not_removed_row_does_not_block_reuse_of_slug(self):
        """The actual bug this constraint fix addresses: Bubble's historical
        rows can be is_active=False while removed=False (deactivated, not
        soft-deleted). The old constraint (scoped to removed=False only)
        incorrectly blocked a new active row from reusing that name. The
        fixed constraint (is_active AND NOT removed) allows it."""
        user = _make_user()
        cs = ClassSection.objects.create(school_id=1, section_name="care_monster", created_by=user)
        cs.is_active = False  # deactivated, but NOT removed
        cs.save()
        assert cs.removed is False
        # Should not raise — this previously raised IntegrityError before the fix
        new_cs = ClassSection.objects.create(
            school_id=1, section_name="care_monster", created_by=user
        )
        assert new_cs.is_active is True
        assert ClassSection.objects.filter(school_id=1, section_name="care_monster").count() == 2


# ── Foundation subject seed (0027) — neutered 2026-09-02 ────────────────────────


@pytest.mark.django_db
class TestFoundationSubjectSeed:
    """
    Migration 0027 no longer seeds a 'Foundation' Subject row (see the migration
    file for why: Subject isn't part of the M7 Bubble migration — decision #18 —
    and auto-seeding here collided with the real historical subjects that
    migration brings in with their own subject_id values). These tests assert
    the no-op behavior instead of the old auto-seed.
    """

    def test_foundation_subject_not_auto_seeded(self):
        """Nothing named 'Foundation' exists unless a test (or the real Bubble
        import) explicitly creates it — the migration itself creates nothing."""
        assert not Subject.objects.filter(subject_name="Foundation").exists()

    def test_legacy_foundation_subjects_unaffected(self):
        """Pre-existing 'Foundation Day 1'/'Foundation Day 2'-style subjects
        (as seeded by other fixtures, or as they'll exist for real once migrated
        from Bubble) are completely unaffected by the now-inert migration."""
        program, _ = Program.objects.get_or_create(program_name="Foundation Program")
        Subject.objects.get_or_create(
            subject_name="Foundation Day 1", defaults={"program_id": program}
        )
        assert Subject.objects.filter(subject_name="Foundation Day 1").exists()
        assert Subject.objects.filter(subject_name="Foundation Day 1").count() == 1
        assert not Subject.objects.filter(subject_name="Foundation").exists()
