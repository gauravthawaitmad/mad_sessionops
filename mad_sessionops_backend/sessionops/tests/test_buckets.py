"""
Tests for F-M6-2: Bucket CRUD with slug normalization.
"""

import pytest

from sessionops.exceptions import ConflictError, NotFound, ValidationError
from sessionops.models import AcademicYear, ClassSection, User
from sessionops.services.sections.slug import next_default_display_name, normalize_section_slug
from sessionops.services.structure.sections import (
    create_bucket,
    edit_bucket,
    list_buckets_for_school,
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


@pytest.fixture(autouse=True)
def _active_academic_year(db):
    """create_bucket() now binds every new bucket to the active AcademicYear
    (see get_or_create_school_academic_year) — needed for every test in this file."""
    if not AcademicYear.objects.filter(is_active=True, removed=False).exists():
        creator = User.objects.create(
            user_login="ay_fixture@test.com",
            user_display_name="AY Fixture",
            email="ay_fixture@test.com",
            is_active=True,
        )
        AcademicYear.objects.create(label="2026-2027", is_active=True, created_by=creator)


# ── normalize_section_slug ───────────────────────────────────────────────────────


class TestNormalizeSectionSlug:
    def test_spaces_become_underscores(self):
        assert normalize_section_slug("Care Monster") == "care_monster"

    def test_numbers_preserved(self):
        assert normalize_section_slug("Group 1") == "group_1"

    def test_punctuation_collapsed(self):
        assert normalize_section_slug("5th - D") == "5th_d"

    def test_leading_trailing_spaces_stripped(self):
        assert normalize_section_slug("   spaces   ") == "spaces"

    def test_mixed_case_lowercased(self):
        assert normalize_section_slug("CARE Monster") == "care_monster"

    def test_empty_after_normalization_raises(self):
        with pytest.raises(ValidationError):
            normalize_section_slug("   ---   ")

    def test_too_long_raises(self):
        with pytest.raises(ValidationError):
            normalize_section_slug("a" * 101)

    def test_exactly_100_chars_allowed(self):
        assert normalize_section_slug("a" * 100) == "a" * 100


# ── next_default_display_name ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestNextDefaultDisplayName:
    def test_first_bucket_is_group_1(self):
        assert next_default_display_name(school_id=301) == "Group 1"

    def test_counts_existing_active_sections(self):
        user = _make_user()
        ClassSection.objects.create(school_id=301, section_name="existing", created_by=user)
        assert next_default_display_name(school_id=301) == "Group 2"


# ── create_bucket ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCreateBucket:
    def test_creates_bucket_with_slug_and_display_name(self):
        user = _make_user()
        bucket = create_bucket(302, "Care Monster", user)
        assert bucket.section_name == "care_monster"
        assert bucket.section_display_name == "Care Monster"
        assert bucket.school_class_id is None
        assert bucket.section_code is None

    def test_no_display_name_uses_default(self):
        user = _make_user()
        bucket = create_bucket(303, None, user)
        assert bucket.section_display_name == "Group 1"
        assert bucket.section_name == "group_1"

    def test_duplicate_slug_same_school_raises_conflict(self):
        user = _make_user()
        create_bucket(304, "Care Monster", user)
        with pytest.raises(ConflictError):
            create_bucket(304, "Care Monster", user)

    def test_same_slug_different_schools_allowed(self):
        user = _make_user()
        create_bucket(305, "Care Monster", user)
        bucket = create_bucket(306, "Care Monster", user)
        assert bucket.section_name == "care_monster"

    def test_active_children_count_starts_at_zero(self):
        user = _make_user()
        bucket = create_bucket(307, "Fresh Bucket", user)
        assert bucket.active_children_count == 0


# ── edit_bucket ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestEditBucket:
    def test_renames_and_rederives_slug(self):
        user = _make_user()
        bucket = create_bucket(308, "Old Name", user)
        edited = edit_bucket(bucket.class_section_id, 308, "New Name", user)
        assert edited.section_name == "new_name"
        assert edited.section_display_name == "New Name"

    def test_noop_rename_same_name_does_not_error(self):
        user = _make_user()
        bucket = create_bucket(309, "Same Name", user)
        edited = edit_bucket(bucket.class_section_id, 309, "Same Name", user)
        assert edited.section_name == "same_name"

    def test_rename_into_collision_raises_conflict(self):
        user = _make_user()
        create_bucket(310, "Taken", user)
        bucket = create_bucket(310, "Available", user)
        with pytest.raises(ConflictError):
            edit_bucket(bucket.class_section_id, 310, "Taken", user)

    def test_nonexistent_bucket_raises_not_found(self):
        user = _make_user()
        with pytest.raises(NotFound):
            edit_bucket(999999, 311, "Name", user)

    def test_wrong_school_raises_not_found(self):
        user = _make_user()
        bucket = create_bucket(312, "Name", user)
        with pytest.raises(NotFound):
            edit_bucket(bucket.class_section_id, 999, "Other Name", user)


# ── list_buckets_for_school ───────────────────────────────────────────────────────


@pytest.mark.django_db
class TestListBucketsForSchool:
    def test_returns_only_buckets_for_school(self):
        user = _make_user()
        create_bucket(313, "Bucket A", user)
        create_bucket(313, "Bucket B", user)
        create_bucket(314, "Other School Bucket", user)
        buckets = list(list_buckets_for_school(313))
        assert len(buckets) == 2

    def test_ordered_by_display_name(self):
        user = _make_user()
        create_bucket(315, "Zebra", user)
        create_bucket(315, "Alpha", user)
        buckets = list(list_buckets_for_school(315))
        assert [b.section_display_name for b in buckets] == ["Alpha", "Zebra"]

    def test_excludes_soft_deleted_buckets(self):
        user = _make_user()
        bucket = create_bucket(316, "To Delete", user)
        cs = ClassSection.objects.get(class_section_id=bucket.class_section_id)
        cs.is_active = False
        cs.removed = True
        cs.save()
        buckets = list(list_buckets_for_school(316))
        assert len(buckets) == 0

    def test_active_children_count_annotated(self):
        user = _make_user()
        create_bucket(317, "Bucket", user)
        buckets = list(list_buckets_for_school(317))
        assert buckets[0].active_children_count == 0
