"""
Tests for F-M6-3: Bucket-children add/remove.
"""

from datetime import time

import pytest

from sessionops.exceptions import ConflictError, NotFound
from sessionops.models import (
    AcademicYear,
    Child,
    ChildClassSection,
    ChildSubject,
    ClassSection,
    ClassSectionSubject,
    Partner,
    Program,
    SchoolAcademicYear,
    Slot,
    SlotClassSection,
    SlotClassSectionVolunteer,
    Subject,
    User,
)
from sessionops.schemas.children import ChildEditIn, DeactivateIn
from sessionops.services.children.deactivate import deactivate_child
from sessionops.services.children.edit import edit_child
from sessionops.services.structure.bucket_children import (
    add_child_to_bucket,
    remove_child_from_bucket,
)
from sessionops.services.structure.sections import create_bucket

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(9_800_000, 9_900_000))


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


def _make_user(role: str = "Function Lead") -> User:
    uid = next(_UID)
    return User.objects.create(
        user_login=f"user{uid}@test.com",
        user_display_name=f"User {uid}",
        email=f"user{uid}@test.com",
        user_role=role,
        is_active=True,
    )


def _make_partner(school_id: int) -> Partner:
    return Partner.objects.get_or_create(
        partner_id=school_id,
        defaults={"partner_name": f"School {school_id}", "converted": True},
    )[0]


def _make_child(school_id: int, user: User, first_name: str = "Test") -> Child:
    return Child.objects.create(
        school_id=school_id,
        first_name=first_name,
        last_name="Child",
        gender="other",
        created_by=user,
    )


def _make_subject(user: User, name: str = "Foundation") -> Subject:
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    subj, _ = Subject.objects.get_or_create(subject_name=name, defaults={"program_id": program})
    return subj


def _make_class_section_subject(
    bucket: ClassSection, subject: Subject, user: User
) -> ClassSectionSubject:
    return ClassSectionSubject.objects.create(
        class_section_id=bucket, subject_id=subject, created_by=user
    )


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
        created_by=user,
    )


def _make_slot_class_with_volunteers(
    bucket: ClassSection,
    css: ClassSectionSubject,
    school_id: int,
    user: User,
    n_volunteers: int,
) -> SlotClassSection:
    slot = _make_slot(school_id, user)
    scs = SlotClassSection.objects.create(
        slot_id=slot,
        class_section_id=bucket,
        class_section_subject_id=css,
        created_by=user,
    )
    for i in range(n_volunteers):
        vol = _make_user(role="CHO")
        SlotClassSectionVolunteer.objects.create(
            slot_class_section_id=scs,
            volunteer_id=vol,
            created_by=user,
        )
    return scs


# ── add_child_to_bucket ───────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestAddChildToBucket:
    def test_happy_path_creates_membership(self):
        user = _make_user()
        bucket = create_bucket(401, "Care Monster", user)
        child = _make_child(401, user)

        ccs = add_child_to_bucket(401, bucket.class_section_id, child.child_id, user)

        assert ccs.child_id_id == child.child_id
        assert ccs.class_section_id_id == bucket.class_section_id
        assert ChildClassSection.objects.filter(
            child_id=child,
            class_section_id_id=bucket.class_section_id,
            is_active=True,
            removed=False,
        ).exists()

    def test_backfills_child_subject_for_existing_class_section_subjects(self):
        user = _make_user()
        bucket = create_bucket(402, "Bucket", user)
        subject = _make_subject(user)
        css = _make_class_section_subject(
            ClassSection.objects.get(class_section_id=bucket.class_section_id), subject, user
        )
        child = _make_child(402, user)

        add_child_to_bucket(402, bucket.class_section_id, child.child_id, user)

        assert ChildSubject.objects.filter(
            child_id=child, class_section_subject_id=css, is_active=True, removed=False
        ).exists()

    def test_r1_max_5_children_per_bucket(self):
        user = _make_user()
        bucket = create_bucket(403, "Full Bucket", user)
        for _ in range(5):
            child = _make_child(403, user)
            add_child_to_bucket(403, bucket.class_section_id, child.child_id, user)

        sixth_child = _make_child(403, user)
        with pytest.raises(ConflictError):
            add_child_to_bucket(403, bucket.class_section_id, sixth_child.child_id, user)

    def test_r_bucket_membership_child_already_in_another_bucket(self):
        user = _make_user()
        bucket_a = create_bucket(404, "Bucket A", user)
        bucket_b = create_bucket(404, "Bucket B", user)
        child = _make_child(404, user)
        add_child_to_bucket(404, bucket_a.class_section_id, child.child_id, user)

        with pytest.raises(ConflictError, match="Bucket A"):
            add_child_to_bucket(404, bucket_b.class_section_id, child.child_id, user)

    def test_idempotent_add_to_same_bucket_twice(self):
        user = _make_user()
        bucket = create_bucket(405, "Bucket", user)
        child = _make_child(405, user)

        first = add_child_to_bucket(405, bucket.class_section_id, child.child_id, user)
        second = add_child_to_bucket(405, bucket.class_section_id, child.child_id, user)

        assert first.child_class_section_id == second.child_class_section_id
        assert (
            ChildClassSection.objects.filter(child_id=child, is_active=True, removed=False).count()
            == 1
        )

    def test_bucket_not_found(self):
        user = _make_user()
        child = _make_child(406, user)
        with pytest.raises(NotFound):
            add_child_to_bucket(406, 999999, child.child_id, user)

    def test_child_not_found(self):
        user = _make_user()
        bucket = create_bucket(407, "Bucket", user)
        with pytest.raises(NotFound):
            add_child_to_bucket(407, bucket.class_section_id, 999999, user)

    def test_child_in_wrong_school_not_found(self):
        user = _make_user()
        bucket = create_bucket(408, "Bucket", user)
        child = _make_child(409, user)  # different school
        with pytest.raises(NotFound):
            add_child_to_bucket(408, bucket.class_section_id, child.child_id, user)


# ── remove_child_from_bucket ───────────────────────────────────────────────────────


@pytest.mark.django_db
class TestRemoveChildFromBucket:
    def test_happy_path_removes_membership(self):
        user = _make_user()
        bucket = create_bucket(410, "Bucket", user)
        child = _make_child(410, user)
        add_child_to_bucket(410, bucket.class_section_id, child.child_id, user)

        remove_child_from_bucket(410, bucket.class_section_id, child.child_id, user)

        assert not ChildClassSection.objects.filter(
            child_id=child, is_active=True, removed=False
        ).exists()
        assert ChildClassSection.objects.filter(child_id=child, removed=True).exists()

    def test_child_subject_untouched_on_removal(self):
        user = _make_user()
        bucket = create_bucket(411, "Bucket", user)
        subject = _make_subject(user)
        css = _make_class_section_subject(
            ClassSection.objects.get(class_section_id=bucket.class_section_id), subject, user
        )
        child = _make_child(411, user)
        add_child_to_bucket(411, bucket.class_section_id, child.child_id, user)

        remove_child_from_bucket(411, bucket.class_section_id, child.child_id, user)

        assert ChildSubject.objects.filter(
            child_id=child, class_section_subject_id=css, is_active=True, removed=False
        ).exists()

    def test_r_bucket_blocks_removal_when_over_volunteered(self):
        user = _make_user()
        bucket_out = create_bucket(412, "Bucket", user)
        bucket = ClassSection.objects.get(class_section_id=bucket_out.class_section_id)
        subject = _make_subject(user)
        css = _make_class_section_subject(bucket, subject, user)

        children = [_make_child(412, user) for _ in range(3)]
        for c in children:
            add_child_to_bucket(412, bucket.class_section_id, c.child_id, user)

        _make_slot_class_with_volunteers(bucket, css, 412, user, n_volunteers=3)

        with pytest.raises(ConflictError, match="3 volunteers"):
            remove_child_from_bucket(412, bucket.class_section_id, children[0].child_id, user)

    def test_removal_allowed_when_volunteers_within_remaining_capacity(self):
        user = _make_user()
        bucket_out = create_bucket(413, "Bucket", user)
        bucket = ClassSection.objects.get(class_section_id=bucket_out.class_section_id)
        subject = _make_subject(user)
        css = _make_class_section_subject(bucket, subject, user)

        children = [_make_child(413, user) for _ in range(3)]
        for c in children:
            add_child_to_bucket(413, bucket.class_section_id, c.child_id, user)

        _make_slot_class_with_volunteers(bucket, css, 413, user, n_volunteers=2)

        # Removing one child leaves 2 remaining, exactly matching 2 volunteers — allowed
        remove_child_from_bucket(413, bucket.class_section_id, children[0].child_id, user)

        assert not ChildClassSection.objects.filter(
            child_id=children[0], is_active=True, removed=False
        ).exists()

    def test_child_not_in_bucket_raises_not_found(self):
        user = _make_user()
        bucket = create_bucket(414, "Bucket", user)
        child = _make_child(414, user)
        with pytest.raises(NotFound):
            remove_child_from_bucket(414, bucket.class_section_id, child.child_id, user)

    def test_bucket_not_found(self):
        user = _make_user()
        child = _make_child(415, user)
        with pytest.raises(NotFound):
            remove_child_from_bucket(415, 999999, child.child_id, user)


# ── deactivate_child (R-bucket) ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestDeactivateChildRBucket:
    def test_deactivate_blocked_when_over_volunteers_remaining_bucket(self):
        user = _make_user()
        _make_partner(420)
        bucket_out = create_bucket(420, "Bucket", user)
        bucket = ClassSection.objects.get(class_section_id=bucket_out.class_section_id)
        subject = _make_subject(user)
        css = _make_class_section_subject(bucket, subject, user)

        children = [_make_child(420, user) for _ in range(3)]
        for c in children:
            add_child_to_bucket(420, bucket.class_section_id, c.child_id, user)

        _make_slot_class_with_volunteers(bucket, css, 420, user, n_volunteers=3)

        with pytest.raises(ConflictError, match="3 volunteers"):
            deactivate_child(children[0].child_id, DeactivateIn(removed_reason="dropped_out"), user)

        # Blocked — no partial state change
        assert Child.objects.get(child_id=children[0].child_id).is_active is True
        assert ChildClassSection.objects.filter(
            child_id=children[0], is_active=True, removed=False
        ).exists()

    def test_deactivate_succeeds_when_no_slot_class_or_within_capacity(self):
        user = _make_user()
        _make_partner(421)
        bucket_out = create_bucket(421, "Bucket", user)
        bucket = ClassSection.objects.get(class_section_id=bucket_out.class_section_id)
        subject = _make_subject(user)
        css = _make_class_section_subject(bucket, subject, user)

        children = [_make_child(421, user) for _ in range(3)]
        for c in children:
            add_child_to_bucket(421, bucket.class_section_id, c.child_id, user)

        _make_slot_class_with_volunteers(bucket, css, 421, user, n_volunteers=2)

        # Removing one child leaves 2 remaining, exactly matching 2 volunteers — allowed
        deactivate_child(children[0].child_id, DeactivateIn(removed_reason="dropped_out"), user)

        assert Child.objects.get(child_id=children[0].child_id).is_active is False
        assert not ChildClassSection.objects.filter(
            child_id=children[0], is_active=True, removed=False
        ).exists()


# ── edit_child bucket-reassignment (R-bucket) ────────────────────────────────────


@pytest.mark.django_db
class TestEditChildRBucket:
    def test_bucket_move_blocked_when_vacating_over_volunteers_old_bucket(self):
        user = _make_user()
        _make_partner(430)
        old_bucket_out = create_bucket(430, "Old Bucket", user)
        old_bucket = ClassSection.objects.get(class_section_id=old_bucket_out.class_section_id)
        new_bucket_out = create_bucket(430, "New Bucket", user)
        subject = _make_subject(user)
        css = _make_class_section_subject(old_bucket, subject, user)

        children = [_make_child(430, user) for _ in range(3)]
        for c in children:
            add_child_to_bucket(430, old_bucket.class_section_id, c.child_id, user)

        _make_slot_class_with_volunteers(old_bucket, css, 430, user, n_volunteers=3)

        with pytest.raises(ConflictError, match="3 volunteers"):
            edit_child(
                children[0].child_id,
                ChildEditIn(class_section_id=new_bucket_out.class_section_id),
                user,
            )

        # Blocked — old bucket membership untouched
        assert ChildClassSection.objects.filter(
            child_id=children[0],
            class_section_id_id=old_bucket.class_section_id,
            is_active=True,
            removed=False,
        ).exists()

    def test_bucket_move_succeeds_normal_case(self):
        user = _make_user()
        _make_partner(431)
        old_bucket_out = create_bucket(431, "Old Bucket", user)
        old_bucket = ClassSection.objects.get(class_section_id=old_bucket_out.class_section_id)
        new_bucket_out = create_bucket(431, "New Bucket", user)

        child = _make_child(431, user)
        add_child_to_bucket(431, old_bucket.class_section_id, child.child_id, user)

        edit_child(
            child.child_id, ChildEditIn(class_section_id=new_bucket_out.class_section_id), user
        )

        assert not ChildClassSection.objects.filter(
            child_id=child,
            class_section_id_id=old_bucket.class_section_id,
            is_active=True,
            removed=False,
        ).exists()
        assert ChildClassSection.objects.filter(
            child_id=child,
            class_section_id_id=new_bucket_out.class_section_id,
            is_active=True,
            removed=False,
        ).exists()
