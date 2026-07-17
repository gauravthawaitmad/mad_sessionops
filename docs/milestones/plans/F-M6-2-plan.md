# Feature Plan: F-M6-2 — Bucket CRUD with slug normalization

## Overview

Add school-scoped bucket create/edit/list endpoints on top of the schema landed in F-M6-1. A "bucket" is the same `ClassSection` row M2/M3 already use, just created without a `school_class_id`/`section_code` and named via a normalized slug derived from a free-text display name instead of a fixed `SECTION_CODES` letter. The existing class-scoped section endpoints (`GET/POST /{school_id}/classes/{class_id}/sections/`) are left untouched for backward compatibility with legacy rows — buckets are additive new endpoints, not a replacement of the old ones. Buckets are class-agnostic from the first line of code: no `school_class_id` is ever accepted as bucket input.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | Uses `ClassSection` as landed by F-M6-1 |
| Backend services | New | `sessionops/services/sections/slug.py` (new module); `create_bucket`/`edit_bucket`/`list_buckets_for_school` added to `sessionops/services/structure/sections.py` |
| Backend API endpoints | New | 3 new routes on `structure_router` (`/api/schools/` prefix, confirmed in `routes.py:212`) |
| Frontend | None | F-M6-6's concern |
| Database migrations | No | F-M6-1 already landed the schema |
| Celery tasks | None | — |
| Existing tests | None expected to break | New endpoints are additive; `add_section_to_class`/`soft_delete_section` in `sections.py` are untouched |
| Documentation | Update needed | `docs/milestones/M6.md` F-M6-2 status → Built once merged |

## High-Level Design (HLD)

- **Data flow:** CO submits a display name → server derives a slug, pre-checks per-school uniqueness (friendly 409 before hitting the DB constraint), creates a `ClassSection` row with `school_class_id=None, section_code=None, section_name=<slug>, section_display_name=<input>`.
- **Key architectural decision:** Reuses `ClassSection` rather than introducing a new `Bucket` model — the M2/M3 table already has everything needed (school scoping, soft delete, children relation via `ChildClassSection`) once `school_class_id`/`section_code` are nullable (F-M6-1). A new model would duplicate all of that and fork the "children in a section" relationship in two directions.
- **Integration points:** `list_sections_for_class` (existing, class-scoped) and the new `list_buckets_for_school` (school-scoped, no class filter) both query `ClassSection` — they coexist because a school can have both legacy class-scoped sections and new buckets in the same table, distinguished only by whether `school_class_id` is null.

## Low-Level Design (LLD)

### Backend

**New file** `sessionops/services/sections/slug.py`:

```python
import re
from sessionops.exceptions import ValidationError

def normalize_section_slug(display_name: str) -> str:
    s = display_name.strip().lower()
    s = re.sub(r'[^a-z0-9]+', '_', s)
    s = s.strip('_')
    if not s:
        raise ValidationError("Bucket name must contain at least one letter or digit.")
    if len(s) > 100:  # matches widened section_name column from F-M6-1
        raise ValidationError("Bucket name is too long.")
    return s

def next_default_display_name(school_id: int) -> str:
    from sessionops.models import ClassSection
    n = ClassSection.objects.filter(
        school_id=school_id, is_active=True, removed=False
    ).count()
    return f"Group {n + 1}"
```

**Schemas** (`sessionops/schemas/structure.py` — add to existing file, do not touch `SectionAddIn`/`SectionOut` which stay for the legacy class-scoped flow):

```python
class BucketAddIn(Schema):
    display_name: str | None = None

class BucketEditIn(Schema):
    display_name: str | None = None

class BucketOut(Schema):
    class_section_id: int
    section_name: str
    section_display_name: str | None
    school_id: int
    school_class_id: int | None  # legacy-row backward-compat only; never set by bucket writes
    active_children_count: int
    is_active: bool

    @staticmethod
    def resolve_active_children_count(obj) -> int:
        return getattr(obj, "active_children_count", 0)
```

**Service functions** (add to `sessionops/services/structure/sections.py`, alongside the existing `add_section_to_class`/`soft_delete_section`):

```python
def create_bucket(school_id: int, display_name: str | None, user) -> ClassSection:
    name = display_name or next_default_display_name(school_id)
    slug = normalize_section_slug(name)
    if ClassSection.objects.filter(school_id=school_id, section_name=slug, removed=False).exists():
        raise ConflictError(f'A bucket named "{name}" already exists in this school.')
    try:
        bucket = ClassSection.objects.create(
            school_id=school_id, section_name=slug, section_display_name=name,
            school_class_id=None, section_code=None, created_by=user,
        )
    except IntegrityError:
        raise ConflictError(f'A bucket named "{name}" already exists in this school.')
    return _with_active_children_count(bucket.class_section_id)

def edit_bucket(class_section_id: int, school_id: int, display_name: str | None, user) -> ClassSection:
    try:
        bucket = ClassSection.objects.select_for_update().get(
            class_section_id=class_section_id, school_id=school_id, is_active=True, removed=False,
        )
    except ClassSection.DoesNotExist:
        raise NotFound(f"Bucket {class_section_id} not found.")
    if display_name and display_name != bucket.section_display_name:
        slug = normalize_section_slug(display_name)
        if ClassSection.objects.filter(
            school_id=school_id, section_name=slug, removed=False
        ).exclude(class_section_id=class_section_id).exists():
            raise ConflictError(f'A bucket named "{display_name}" already exists in this school.')
        bucket.section_name = slug
        bucket.section_display_name = display_name
        bucket.updated_by = user
        bucket.save(update_fields=["section_name", "section_display_name", "updated_by", "updated_at"])
    return _with_active_children_count(bucket.class_section_id)

def list_buckets_for_school(school_id: int) -> QuerySet:
    return (
        ClassSection.objects
        .filter(school_id=school_id, is_active=True, removed=False)
        .annotate(active_children_count=Count(
            "childclasssection",
            filter=Q(childclasssection__is_active=True, childclasssection__removed=False),
        ))
        .order_by("section_display_name", "section_name")
    )
```

`_with_active_children_count` is a small private helper wrapping the same `annotate(...).get(...)` re-fetch pattern already used in `add_section_to_class` (lines 57-67 of the current `sections.py`) — reused rather than duplicated inline.

**API endpoints** (add to `structure_router` in `structure_api.py`):

| Method | Path | Auth/RBAC | Response |
|--------|------|-----------|----------|
| GET | `/api/schools/{school_id}/sections/` | `get_school_or_403` (CO scope, CHO scope, admin — same as every other school-scoped route in this router) | `200: list[BucketOut]` |
| POST | `/api/schools/{school_id}/sections/` | `get_school_or_403` | `201: BucketOut` |
| PATCH | `/api/schools/{school_id}/sections/{class_section_id}/` | `get_school_or_403` | `200: BucketOut` |

`DELETE /api/schools/{school_id}/sections/{class_section_id}/` already exists (`remove_section`, M2) and needs no change — it soft-deletes any `ClassSection` regardless of whether it's a legacy section or a bucket.

**Migrations:** None — F-M6-1 already landed everything this feature needs.

### Frontend

None — F-M6-6's concern.

## Business Rules Enforced

- **R-section-slug (NEW):** Slug uniqueness per school. Application-level pre-check (friendly `ConflictError`) backed by the DB partial unique index from F-M6-1 as a race-condition backstop (caught via `IntegrityError`).
- **R9 (soft-delete only):** No new delete path in this feature; existing `soft_delete_section` is reused unchanged.

## Security Review

- **Auth:** All three new endpoints require `get_school_or_403(request.auth, school_id)`, identical to every existing route in `structure_router` — no new auth pattern introduced.
- **RBAC scope:** `get_school_or_403` already enforces CO-own-school / CHO-worknode-match / admin-all-schools scoping (same helper used across M2/M3). No bucket-specific scoping needed since a bucket is scoped by `school_id` exactly like a section.
- **Input validation:** `display_name` is user-supplied free text — `normalize_section_slug` strips to `[a-z0-9_]`, so no injection surface reaches the DB via the slug. `section_display_name` is stored and rendered as-is; frontend (F-M6-6) is responsible for safe rendering (React's default escaping covers this).
- **Data exposure:** `BucketOut` exposes `school_class_id` for legacy-row compatibility, but only for the bucket's own school (already scoped by `get_school_or_403`) — no cross-school leakage.

## Testing Strategy

- **Backend unit tests** (`sessionops/services/structure/`, new `test_buckets.py`):
  - `create_bucket` derives correct slug for various display-name inputs (spaces, punctuation, mixed case, "5th - D" style names)
  - `create_bucket` with no `display_name` falls back to `next_default_display_name`
  - `create_bucket` raises `ConflictError` on slug collision within the same school
  - `create_bucket` allows the same slug in two different schools
  - `edit_bucket` re-derives slug on rename; no-op rename (same name) doesn't touch DB
  - `edit_bucket` raises `ConflictError` renaming into a collision
  - `list_buckets_for_school` returns `active_children_count` correctly annotated, ordered by display name
- **Backend integration tests** (new `test_buckets_api.py`): full request/response cycle through the 3 new endpoints with RBAC scope variations (CO own school, CO other school → 403, CHO matched worknode, admin)
- **Backward-compat regression:** run existing `test_f_m2_5_sections.py` unchanged — confirms class-scoped section endpoints still work against `ClassSection` after this feature's additions
- **Manual verification:** `just serve`, hit the new endpoints via the Ninja auto-docs UI (`/api/docs`) with a real CO token; confirm slug derivation and collision errors read correctly

## Milestones (implementation order)

1. **Chunk 1 — slug helper + service functions:** `slug.py`, `create_bucket`, `edit_bucket`, `list_buckets_for_school`, unit tests. No API surface yet — testable in isolation.
2. **Chunk 2 — schemas + endpoints:** `BucketAddIn`/`BucketEditIn`/`BucketOut`, 3 routes, integration tests.
3. **Chunk 3 — regression pass:** run full existing structure/section test suite, confirm zero breakage.

Each chunk leaves the system deployable — chunk 1 alone is inert (no route calls it yet), chunk 2 makes buckets usable via API (testable with curl/Postman before any frontend exists).

## Open Questions

None. The one item that could have blocked this (slug length vs. `section_name` column width) was resolved in F-M6-1 by widening the column to 100 chars — this feature's `normalize_section_slug` caps at 100 to match.
