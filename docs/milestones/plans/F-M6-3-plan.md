# Feature Plan: F-M6-3 — Bucket-children add/remove endpoints

## Overview

Two new endpoints for managing bucket membership after a child already exists — add an existing child to a bucket, and remove a child from a bucket. This is the mechanism that makes bucket assignment "optional at enrollment, done later" (F-M6-4's design) actually usable: without these endpoints, a child enrolled without a bucket could never be placed in one afterward. Enforces the max-5 capacity rule (R1, unchanged from M2/M3), a new one-bucket-per-child invariant (R-bucket-membership), and a new invariant blocking removal when it would leave a slot-class over-volunteered (R-bucket). Populates `ChildSubject` idempotently on add; never deletes it on remove, since Dots needs historical continuity.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | Uses `ClassSection`, `Child`, `ChildClassSection`, `ChildSubject`, `ClassSectionSubject`, `SlotClassSection`, `SlotClassSectionVolunteer` — all existing |
| Backend services | New | New module `sessionops/services/structure/bucket_children.py`: `add_child_to_bucket`, `remove_child_from_bucket` |
| Backend API endpoints | New | 2 new routes on `structure_router` |
| Frontend | None | F-M6-6's concern (`ManageBucketChildrenDrawer.tsx` calls these) |
| Database migrations | No | — |
| Celery tasks | None | — |
| Existing tests | None expected to break | Additive endpoints; existing `edit_child` bucket-change path (F-M6-4) is a separate code path that will eventually be the "move" half of remove-and-add, but that's F-M6-4's file, not touched here |
| Documentation | Update needed | `docs/milestones/M6.md` F-M6-3 status → Built once merged |

## High-Level Design (HLD)

- **Data flow:** `add_child_to_bucket` locks the bucket and child rows, checks capacity and membership invariants, inserts `ChildClassSection`, then idempotently backfills `ChildSubject` for every `ClassSectionSubject` already scheduled on that bucket (so a child added to a bucket that already has a running slot-class shows up in Dots correctly). `remove_child_from_bucket` walks every active `SlotClassSection` on the bucket and checks that removing this child wouldn't push `volunteer_count > remaining_children_count` before soft-deleting the membership row.
- **Key architectural decision:** R-bucket is checked at removal time here and at volunteer-assignment time in F-M6-5 — both sides of the same invariant (`volunteers ≤ children`) are enforced wherever the count can change, rather than trying to enforce it once centrally. This mirrors how R1 (max-5 capacity) is already checked independently at enroll, edit, and (now) bucket-add.
- **Integration points:** Reuses `count_active_children_in_section` (already exists in `sections.py`) for the R1 check rather than re-writing the query. `SlotClassSection`/`SlotClassSectionVolunteer` queries for the R-bucket check follow the same `is_active=True, removed=False` filtering pattern used throughout `slot_classes/create.py`.

## Low-Level Design (LLD)

### Backend

**New file** `sessionops/services/structure/bucket_children.py`:

```python
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from sessionops.exceptions import ConflictError, NotFound
from sessionops.models import (
    Child, ChildClassSection, ChildSubject, ClassSection,
    ClassSectionSubject, SlotClassSection, SlotClassSectionVolunteer,
)

MAX_CHILDREN_PER_BUCKET = 5  # same constant as MAX_CHILDREN_PER_SECTION in enroll.py — R1 is one rule


@transaction.atomic
def add_child_to_bucket(school_id: int, class_section_id: int, child_id: int, user) -> ChildClassSection:
    bucket = ClassSection.objects.select_for_update().filter(
        class_section_id=class_section_id, school_id=school_id, is_active=True, removed=False,
    ).first()
    if not bucket:
        raise NotFound(f"Bucket {class_section_id} not found.")

    child = Child.objects.select_for_update().filter(
        child_id=child_id, school_id=school_id, is_active=True, removed=False,
    ).first()
    if not child:
        raise NotFound(f"Child {child_id} not found.")

    existing = ChildClassSection.objects.filter(
        child_id=child, is_active=True, removed=False
    ).select_related("class_section_id").first()
    if existing:
        if existing.class_section_id_id == class_section_id:
            return existing  # idempotent no-op
        raise ConflictError(
            f'{child.first_name} {child.last_name} is already in bucket '
            f'"{existing.class_section_id.section_display_name or existing.class_section_id.section_name}". '
            f"Remove them from that bucket first."
        )

    occupied = ChildClassSection.objects.filter(
        class_section_id=bucket, is_active=True, removed=False
    ).count()
    if occupied >= MAX_CHILDREN_PER_BUCKET:
        raise ConflictError(f"Bucket is full ({MAX_CHILDREN_PER_BUCKET}/{MAX_CHILDREN_PER_BUCKET}).")

    ccs = ChildClassSection.objects.create(child_id=child, class_section_id=bucket, created_by=user)

    active_css = list(ClassSectionSubject.objects.filter(
        class_section_id=bucket, is_active=True, removed=False
    ))
    for css in active_css:
        ChildSubject.objects.get_or_create(
            child_id=child, class_section_subject_id=css, defaults={"created_by": user},
        )

    return ccs


@transaction.atomic
def remove_child_from_bucket(school_id: int, class_section_id: int, child_id: int, user) -> None:
    bucket = ClassSection.objects.select_for_update().filter(
        class_section_id=class_section_id, school_id=school_id, is_active=True, removed=False,
    ).first()
    if not bucket:
        raise NotFound(f"Bucket {class_section_id} not found.")

    ccs = ChildClassSection.objects.select_for_update().filter(
        child_id=child_id, class_section_id=bucket, is_active=True, removed=False,
    ).first()
    if not ccs:
        raise NotFound(f"Child {child_id} is not in this bucket.")

    remaining_children = ChildClassSection.objects.filter(
        class_section_id=bucket, is_active=True, removed=False,
    ).exclude(child_class_section_id=ccs.child_class_section_id).count()

    active_slot_classes = SlotClassSection.objects.filter(
        class_section_id=bucket, is_active=True, removed=False,
    ).annotate(vol_count=Count(
        "slotclasssectionvolunteer",
        filter=Q(slotclasssectionvolunteer__is_active=True, slotclasssectionvolunteer__removed=False),
    ))
    for scs in active_slot_classes:
        if scs.vol_count > remaining_children:
            raise ConflictError(
                f"Cannot remove child. A scheduled slot-class for this bucket has "
                f"{scs.vol_count} volunteers and would have only {remaining_children} children. "
                f"Remove a volunteer from the slot-class first."
            )

    now = timezone.now()
    ccs.is_active = False
    ccs.removed = True
    ccs.deleted_at = now
    ccs.updated_by = user
    ccs.save(update_fields=["is_active", "removed", "deleted_at", "updated_by", "updated_at"])
    # ChildSubject rows are intentionally NOT touched — retained for Dots history (decision #2)
```

**Schemas** (`sessionops/schemas/structure.py`):

```python
class BucketChildAddIn(Schema):
    child_id: int

class BucketChildOut(Schema):
    child_class_section_id: int
    child_id: int
    class_section_id: int
```

**API endpoints** (add to `structure_router`):

| Method | Path | Auth/RBAC | Response |
|--------|------|-----------|----------|
| POST | `/api/schools/{school_id}/sections/{section_id}/children/` | `get_school_or_403` | `201: BucketChildOut`, `404`, `409` |
| DELETE | `/api/schools/{school_id}/sections/{section_id}/children/{child_id}/` | `get_school_or_403` | `204: None`, `404`, `409` |

**Migrations:** None.

### Frontend

None — F-M6-6's concern.

## Business Rules Enforced

- **R1:** Max 5 active children per bucket — same constant/semantics as the existing `MAX_CHILDREN_PER_SECTION`, just checked at a new entry point (bucket-add, not just enroll/edit).
- **R-bucket (NEW):** `count(active volunteers on any slot-class of this bucket) ≤ count(active children in bucket)` after removal — checked here on the removal path; F-M6-5 checks the same invariant from the volunteer side.
- **R-bucket-membership (NEW):** One active `ChildClassSection` per child. Enforced by checking for any other active membership before inserting; adding to the same bucket twice is idempotent (not an error), matching the general project convention that repeat-safe operations shouldn't punish double-submission from the UI.
- **R9:** Soft-delete only — `remove_child_from_bucket` sets `is_active=False, removed=True, deleted_at`, never issues a `DELETE`. `ChildSubject` rows are explicitly preserved (never soft-deleted) per M6 decision #2.

## Security Review

- **Auth:** Both endpoints require `get_school_or_403(request.auth, school_id)` — same pattern as every other route in `structure_router`.
- **RBAC scope:** No additional scoping needed beyond school-level — a bucket and a child are both already validated as belonging to `school_id` inside the service functions (`ClassSection.objects.filter(..., school_id=school_id, ...)` and `Child.objects.filter(..., school_id=school_id, ...)`), so a CO cannot add/remove children across school boundaries even if they guess IDs from another school.
- **Input validation:** `child_id` is validated for existence, active status, and school membership before any write. No free-text input in this feature.
- **Data exposure:** No new read surface — both endpoints are write-only, responses only echo back IDs already known to the caller.

## Testing Strategy

- **Backend unit tests** (new `test_bucket_children.py`):
  - Happy path: add child to empty bucket → `ChildClassSection` created, `ChildSubject` backfilled for existing `ClassSectionSubject` rows on the bucket
  - R1: adding a 6th child to a full bucket → `ConflictError`
  - R-bucket-membership: adding a child already in another bucket → `ConflictError` naming the existing bucket by display name
  - Idempotency: adding the same child to the same bucket twice → second call returns the existing row, no duplicate insert
  - R-bucket: removing a child that would leave a 3-volunteer slot-class with only 2 remaining children → `ConflictError` with the exact guidance message
  - Happy path removal: remove a child from a bucket with no scheduled slot-classes → succeeds, `ChildSubject` rows untouched (still present, still active)
- **Backend integration tests** (new `test_bucket_children_api.py`): full request/response cycle for both endpoints, RBAC scope variations, 404 for nonexistent bucket/child, 409 for both conflict types
- **Manual verification:** via `just serve` + Ninja docs — add a child to a bucket that already has an active slot-class, confirm `ChildSubject` row appears for that child immediately; then try removing a child from an over-volunteered bucket and confirm the exact error text shown

## Milestones (implementation order)

1. **Chunk 1 — add_child_to_bucket:** service + endpoint + tests. Independently useful (lets COs start populating buckets) even before removal exists.
2. **Chunk 2 — remove_child_from_bucket:** service + endpoint + tests, including the R-bucket cross-check against F-M6-5's not-yet-built volunteer list (test against manually-created `SlotClassSectionVolunteer` rows in the interim, since F-M6-5 may not be merged yet depending on build order).

Both chunks are independently deployable — a school can use "add" alone (matches the existing behavior of never being able to remove a child from a section pre-M6, since M2/M3 never exposed a standalone remove-from-section endpoint outside full deactivation).

## Open Questions

None — every business rule this feature needs (R1's constant, R-bucket's exact check shape, R-bucket-membership's conflict semantics) is already specified precisely in `docs/milestones/M6.md` decision #6 and the F-M6-3 section, and confirmed consistent with existing patterns in `services/children/enroll.py` and `services/slot_classes/create.py`.
