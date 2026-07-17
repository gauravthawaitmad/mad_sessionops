# Feature Plan: F-M6-4 — Child enrollment decoupling + child_class invariant

## Overview

Today, `ChildEnrollIn.class_section_id` is required and both the `ChildClass` (grade) and `ChildClassSection` (section) links are derived from that one section — `enroll_child` reads `section.school_class_id_id` to create `ChildClass` (`services/children/enroll.py:96-100`). M6 breaks that coupling: `school_class_id` becomes an explicit, required field on the payload, and `class_section_id` (now naming a bucket) becomes optional. This also touches `edit_child`, which currently changes section and silently changes class only when the *new section's* `school_class_id` differs (`services/children/edit.py:143-160`) — M6 makes class change an explicit, independent operation. Also: idempotent `ChildSubject` inserts (`get_or_create` instead of `bulk_create`) and stop soft-deleting old `ChildSubject` rows on section change, since Dots needs the full history.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | No schema change |
| Backend services | Modified | `services/children/enroll.py` (`enroll_child`), `services/children/edit.py` (`edit_child`) — both rewritten |
| Backend schemas | Modified | `schemas/children.py`: `ChildEnrollIn` gains required `school_class_id`, `class_section_id` becomes optional; `ChildEditIn` gains optional `school_class_id`; `ChildOut` gains `current_section` / `current_school_class` nested objects (needed by F-M6-7) |
| Backend queries | Modified | `services/children/queries.py`: `list_children` needs an `unassigned` filter option (needed by F-M6-7) |
| Backend API endpoints | Modified (signature only) | `children_api.py` routes unchanged in path/method, just pass through the new/changed schema fields |
| Frontend | None | F-M6-7's concern, but depends on this feature's `ChildOut`/`list_children` changes |
| Database migrations | No | — |
| Celery tasks | None | — |
| Existing tests | Break | `test_f_m2_6_children.py`, `test_f_m2_7_children.py` currently construct `ChildEnrollIn` with only `class_section_id` — every enroll call site in tests needs `school_class_id` added |
| Documentation | Update needed | `docs/milestones/M6.md` F-M6-4 status → Built once merged |

## High-Level Design (HLD)

- **Data flow (enroll):** `school_class_id` is now the mandatory anchor — validated against `SchoolClass` directly rather than derived from a section. If `class_section_id` (bucket) is also given, it's validated and linked exactly as before, just no longer the source of the class link.
- **Data flow (edit):** Two independent optional operations on the same call — a class change (`school_class_id` differs from current active `ChildClass`) and a bucket change (`class_section_id` differs from current active `ChildClassSection`). Previously these were coupled through the section; now the section's `school_class_id` is null for buckets anyway; so class change becomes its own atomic swap, guarded by a pre-check for pre-existing data inconsistency (decision #5 in M6.md — no DB constraint, service-layer serialisation via `select_for_update` on `Child` is the sole enforcement).
- **Key architectural decision:** No DB partial-unique index backs the one-active-`ChildClass`-per-child invariant (M6.md decision #5). The existing `edit_child` already takes `select_for_update()` on the `Child` row at the top of its transaction (`edit.py:31-37`) — that serialises concurrent edit calls for the same child, which is sufficient given all class changes for a child funnel through this one function.
- **Integration points:** `enroll_child`'s current School-capacity check (`Partner.confirmed_child_count` vs `BatchChild` count) and SAY resolution are unchanged — they don't depend on section at all already. Only the class-derivation and bucket-linking blocks change.

## Low-Level Design (LLD)

### Backend

**Schema changes** (`sessionops/schemas/children.py`):

```python
class ChildEnrollIn(Schema):
    first_name:         str
    last_name:          str
    gender:             Literal["male", "female", "other"]
    age:                int
    school_class_id:    int                     # NEW, required — replaces derivation from section
    class_section_id:   int | None = None       # CHANGED: was required, now optional (bucket)
    date_of_birth:      date | None = None
    city:               str | None = None
    mother_tongue:      str | None = None
    date_of_enrollment: date | None = None
    mad_joining_date:   date | None = None


class ChildEditIn(Schema):
    first_name:         str | None = None
    last_name:          str | None = None
    gender:             Literal["male", "female", "other"] | None = None
    age:                int | None = None
    school_class_id:    int | None = None       # NEW — explicit class change
    class_section_id:   int | None = None       # unchanged type, now means "bucket"
    date_of_birth:      date | None = None
    city:               str | None = None
    mother_tongue:      str | None = None
    date_of_enrollment: date | None = None
    mad_joining_date:   date | None = None


class CurrentSectionOut(Schema):
    class_section_id: int
    section_display_name: str | None
    section_name: str

class CurrentSchoolClassOut(Schema):
    school_class_id: int
    class_name: str

class ChildOut(Schema):
    # ...all existing fields unchanged...
    current_section:      CurrentSectionOut | None      # NEW — replaces current_section_name/current_section_id for F-M6-7's Bucket column
    current_school_class: CurrentSchoolClassOut | None   # NEW — replaces current_class_name/current_class_id

    @staticmethod
    def resolve_current_section(obj) -> CurrentSectionOut | None:
        sid = getattr(obj, "_current_section_id", None)
        if not sid:
            return None
        return CurrentSectionOut(
            class_section_id=sid,
            section_display_name=getattr(obj, "current_section_display_name", None),
            section_name=getattr(obj, "current_section_name", "") or "",
        )

    @staticmethod
    def resolve_current_school_class(obj) -> CurrentSchoolClassOut | None:
        cid = getattr(obj, "_current_school_class_id", None)
        if not cid:
            return None
        return CurrentSchoolClassOut(
            school_class_id=cid,
            class_name=getattr(obj, "current_class_name", "") or "",
        )
```

Keeping `current_class_name`/`current_section_name` as the flat legacy fields alongside the new nested ones is deliberately **not** done — F-M6-7 is the only consumer and it's being built fresh against the new shape, so there's no reason to carry two representations. Confirm no other consumer of `ChildOut` (e.g. an export/report feature) depends on the flat fields before removing them — quick grep across `mad_sessionops_frontend` for `currentSectionName`/`currentClassName` usage beyond `ChildrenTab`/`EditChildDrawer` before merging.

**`enroll_child` rewrite** (`services/children/enroll.py`):

```python
@transaction.atomic
def enroll_child(school_id: int, payload: ChildEnrollIn, user: User) -> Child:
    # 1. Validate school_class_id belongs to this school
    try:
        school_class = SchoolClass.objects.select_related("class_id").get(
            school_class_id=payload.school_class_id, school_id=school_id,
            is_active=True, removed=False,
        )
    except SchoolClass.DoesNotExist:
        raise NotFound(f"School class {payload.school_class_id} not found.")

    # 2. If bucket given, lock + validate + capacity check (same as today's section check)
    bucket = None
    if payload.class_section_id is not None:
        try:
            bucket = ClassSection.objects.select_for_update().get(
                class_section_id=payload.class_section_id, is_active=True, removed=False,
            )
        except ClassSection.DoesNotExist:
            raise NotFound(f"Bucket {payload.class_section_id} not found.")
        if bucket.school_id != school_id:
            raise ValidationError("Bucket does not belong to this school.")
        occupied = ChildClassSection.objects.filter(
            class_section_id=bucket, is_active=True, removed=False
        ).count()
        if occupied >= MAX_CHILDREN_PER_SECTION:
            raise ConflictError(f"Bucket is full ({MAX_CHILDREN_PER_SECTION}/{MAX_CHILDREN_PER_SECTION}).")

    # 3. School confirmed-child-count cap — UNCHANGED
    # 4. Resolve SAY — UNCHANGED

    # 5. Create Child — UNCHANGED
    # 6. ALWAYS create ChildClass from payload.school_class_id (was: from section.school_class_id_id)
    ChildClass.objects.create(child_id=child, school_class_id=school_class, created_by=user)

    # 7. If bucket given: create ChildClassSection + idempotent ChildSubject
    if bucket:
        ChildClassSection.objects.create(child_id=child, class_section_id=bucket, created_by=user)
        active_css = list(ClassSectionSubject.objects.filter(
            class_section_id=bucket, is_active=True, removed=False
        ))
        for css in active_css:
            ChildSubject.objects.get_or_create(  # CHANGED: get_or_create, not bulk_create
                child_id=child, class_section_subject_id=css, defaults={"created_by": user},
            )

    # 8. BatchChild + ChildProgram — UNCHANGED
```

**`edit_child` — class change path (new block)**, inserted before or after the existing section-change block in `services/children/edit.py`:

```python
if payload.school_class_id is not None:
    current_active_count = ChildClass.objects.filter(
        child_id=child, is_active=True, removed=False
    ).count()
    if current_active_count > 1:
        raise ValidationError(
            "Data inconsistency: multiple active class assignments for this child. "
            "Contact an administrator."
        )
    current_cc = ChildClass.objects.filter(child_id=child, is_active=True, removed=False).first()
    if current_cc is None or current_cc.school_class_id_id != payload.school_class_id:
        try:
            new_school_class = SchoolClass.objects.get(
                school_class_id=payload.school_class_id, school_id=child.school_id,
                is_active=True, removed=False,
            )
        except SchoolClass.DoesNotExist:
            raise NotFound(f"School class {payload.school_class_id} not found.")
        now = timezone.now()
        if current_cc:
            current_cc.is_active = False
            current_cc.removed = True
            current_cc.deleted_at = now
            current_cc.updated_by = user
            current_cc.save()
        ChildClass.objects.create(child_id=child, school_class_id=new_school_class, created_by=user)
```

**`edit_child` — bucket change path (modify existing block):** Remove the current section-change block's implicit class-follow logic (`edit.py:143-160`, "Handle class change when section moves to a different SchoolClass") — that entire sub-block is deleted, since class change is now the independent block above, not something that happens as a side-effect of section change (a bucket has no `school_class_id` to follow anyway). Also change the `ChildSubject` sync at `edit.py:102-124`: keep creating new rows via `get_or_create` (already effectively idempotent via `bulk_create` today since it's all-or-nothing per section, but switch to `get_or_create` for consistency with F-M6-3), and **delete the old-row soft-delete block entirely** (`edit.py:103-123`) — old `ChildSubject` rows are no longer touched on bucket change, per decision #2.

**`list_children` filter addition** (`services/children/queries.py`):

```python
def list_children(
    school_id: int, *, section_id: int | None = None, class_id: int | None = None,
    status: str = "active", search: str | None = None, unassigned: bool = False,  # NEW
) -> QuerySet:
    # ...existing annotation logic unchanged...
    if unassigned:
        qs = qs.filter(_current_section_id__isnull=True)
    elif section_id:
        qs = qs.filter(_current_section_id=section_id)
    # ...rest unchanged...
```

Also add `current_section_display_name` to the existing annotate block (subquery on `class_section_id__section_display_name`), needed by `ChildOut.resolve_current_section`.

**API endpoints:** No path/method changes. `children_api.py`'s `list_children_view` gains an `unassigned: bool = False` query param passthrough; `enroll_child_view`/`edit_child_view` pass the new schema fields through unchanged (already generic pass-through of `payload`).

**Migrations:** None.

### Frontend

None — F-M6-7's concern. This feature's job is to make the contract (`ChildOut.current_section`/`current_school_class`, `list_children(unassigned=...)`) exist and be correct before F-M6-7 starts building against it.

## Business Rules Enforced

- **R1:** Bucket capacity check on enroll — same constant and logic as today, just now conditional on a bucket being provided at all.
- **R-class (NEW):** One active `ChildClass` per child, enforced at the service layer only (no DB constraint — decision #5). `select_for_update()` on the `Child` row (already present in `edit_child`, added to `enroll_child`'s section/bucket lock) serialises concurrent changes for the same child.
- **R9:** Soft-delete on class swap (mirrors the existing section-swap pattern). `ChildSubject` rows are never deleted on bucket change — this is a *behavior change* from the current M3 code, which does soft-delete old `ChildSubject` rows on section change; removing that soft-delete is this feature's explicit scope per decision #2.

## Security Review

- **Auth:** No change — both endpoints already require `get_school_or_403`.
- **RBAC scope:** `school_class_id` and `class_section_id` are both validated against `school_id` inside the service (cross-school guards already exist for section; the same guard is added for `school_class_id` in the new class-change block). Without this, a CO could move a child into a class belonging to a different school by guessing an ID.
- **Input validation:** `school_class_id` is now required at enroll — Pydantic/Ninja rejects a missing field before the service even runs, closing off the previous implicit assumption that class always comes from section.
- **Data exposure:** `ChildOut`'s new nested fields expose the same data as before (class name, section name) in a different shape — no new information surfaced.

## Testing Strategy

- **Backend unit tests:**
  - Enroll with class only (no bucket) → `Child` + `ChildClass` created, no `ChildClassSection`, `ChildOut.current_section is None`
  - Enroll with class + bucket → all rows created, `ChildSubject` idempotent for pre-existing bucket subjects
  - Enroll with `school_class_id` from a different school → `NotFound`
  - Edit: change class only → old `ChildClass` soft-deleted, new one active, exactly one active row after
  - Edit: change bucket only → `ChildClassSection` swapped, class untouched, old `ChildSubject` rows remain active (not soft-deleted) — this is the behavior-change assertion, write it explicitly so a future regression is caught
  - Edit: data-quality guard — seed a child with 2 active `ChildClass` rows directly via the ORM (bypassing the service), call `edit_child` with a `school_class_id` → `ValidationError`, no silent overwrite
  - `list_children(unassigned=True)` returns only children with no active `ChildClassSection`
- **Backend integration tests:** update `test_f_m2_6_children.py`/`test_f_m2_7_children.py` enroll call sites to pass `school_class_id`; add new enroll/edit scenarios above at the API layer too
- **Regression:** run `test_f_m3_3_volunteers.py`, `slot_classes/test_create_slot_class.py`, `schedule/test_schedule_*.py` unchanged — none of them create children through `enroll_child` directly (they use direct ORM fixtures per the earlier code read), so should be unaffected, but confirm by running the full suite
- **Manual verification:** `just serve`, enroll a child with only a class via the API, confirm no error and no bucket assignment; then use F-M6-3's add-to-bucket endpoint to place them later

## Milestones (implementation order)

1. **Chunk 1 — enroll_child rewrite + schema change:** `ChildEnrollIn` change, `enroll_child` rewrite, tests. This alone unblocks "enroll without a bucket," a fully working state.
2. **Chunk 2 — edit_child class-change path:** new block, `ChildEditIn.school_class_id`, R-class guard, tests.
3. **Chunk 3 — edit_child bucket-change path + ChildSubject retention:** remove the class-follow side effect and the old-row soft-delete, switch to `get_or_create`, tests asserting retention.
4. **Chunk 4 — ChildOut/list_children contract for F-M6-7:** nested `current_section`/`current_school_class`, `unassigned` filter. Ship this chunk even if F-M6-7 hasn't started yet — it's cheap to verify in isolation via API tests and unblocks F-M6-7 immediately when it does start.

## Open Questions

None. `docs/milestones/M6.md`'s F-M6-4 section and decision #5/#9/#10 fully specify this feature's behavior, and reading the actual `enroll.py`/`edit.py` confirmed exactly which blocks need to change vs. stay untouched.
