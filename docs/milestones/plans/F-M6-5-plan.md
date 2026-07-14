# Feature Plan: F-M6-5 — Slot-class volunteer list + Foundation subject

## Overview

Replace the fixed `volunteer_1_id`/`volunteer_2_id` pair with a `volunteer_ids: list[int]` (1-5, unique) across `SlotClassCreateSchema`/`SlotClassUpdateSchema`, and remove `subject_id` from client input entirely — every new slot-class uses the Foundation `Subject` seeded in F-M6-1. Adds the new R-bucket invariant (volunteers ≤ active children in the bucket) on both create and edit. The `SlotClassSectionVolunteer` model already stores one row per volunteer (`models/slot_class_section_volunteer.py`'s docstring: "no vol1/vol2 column — separate rows"), so this is purely a service/schema-layer change — no model or migration work. The `school_volunteer` reconciliation helpers (`ensure_school_volunteer`, `reconcile_school_volunteer`, `check_r4_volunteer`) are reused completely unchanged, per M6 decision that the `school_volunteer` lifecycle stays owned by M8a.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | `SlotClassSectionVolunteer` already supports N rows per slot-class |
| Backend services | Modified | `services/slot_classes/create.py` (`create_slot_class`), `services/slot_classes/edit.py` (`edit_slot_class`, `_replace_volunteers`) |
| Backend schemas | Modified | `schemas/slot_classes.py`: `SlotClassCreateSchema`, `SlotClassUpdateSchema` |
| Backend helpers | None | `services/slot_classes/helpers.py` reused as-is (`check_r4_volunteer`, `check_r6_volunteer_in_slot`, `validate_volunteer_worknode_match`, `ensure_school_volunteer`, `reconcile_school_volunteer`) |
| Backend API endpoints | Modified (signature only) | `slot_classes_api.py` routes unchanged in path/method; `_scs_to_schema` already returns `volunteers: list[...]` (verified in current code — no read-path change needed) |
| Frontend | None | F-M6-8's concern |
| Database migrations | No | F-M6-1 already seeded the Foundation subject |
| Celery tasks | None | — |
| Existing tests | Break | `test_create_slot_class.py`, `test_delete_slot_class.py`, `schedule/test_schedule_validation.py`, `schedule/test_schedule_view.py` all construct payloads/fixtures with `subject_id`/`volunteer_1_id`/`volunteer_2_id` |
| Documentation | Update needed | `docs/milestones/M6.md` F-M6-5 status → Built once merged |

## High-Level Design (HLD)

- **Data flow:** Client sends `{class_section_id, volunteer_ids: [...]}`. Schema validator rejects empty/>5/duplicate lists before the service runs (R3 enforced at the schema layer, same spot the current `vol1_ne_vol2` validator lives). Service resolves the Foundation subject once (module-level cache), resolves each volunteer in a loop (replacing the current two hand-written vol1/vol2 blocks), checks R-bucket against the bucket's active-children count, then bulk-inserts one `SlotClassSectionVolunteer` row per resolved volunteer — structurally identical to what `create_slot_class` already does for vol1+vol2, just generalized to N.
- **Key architectural decision:** No new caching mechanism beyond a plain module-level `None`-checked variable for the Foundation subject (mirrors no existing pattern in this codebase for "cached lookup," so keep it minimal — a global with lazy init, not a Django cache backend). Safe because the seeded row is immutable after F-M6-1.
- **Integration points:** `edit_slot_class`'s existing three-way branch (`section_changing`, `subject_changing`, `vols_changing`) drops the `subject_changing` branch entirely — subject can no longer come from client input, so it can never change. This simplifies the function: only `section_changing` and `vols_changing` remain, and the "full cascade reset" path (currently triggered by `section_changing or subject_changing`) triggers on `section_changing` alone.

## Low-Level Design (LLD)

### Backend

**Schema changes** (`sessionops/schemas/slot_classes.py`):

```python
class SlotClassCreateSchema(Schema):
    class_section_id: int
    volunteer_ids: list[int]

    @field_validator("volunteer_ids")
    @classmethod
    def validate_volunteer_ids(cls, v):
        if len(v) < 1:
            raise ValueError("At least 1 volunteer required.")
        if len(v) > 5:
            raise ValueError("Maximum 5 volunteers allowed.")
        if len(v) != len(set(v)):
            raise ValueError("Volunteer IDs must be unique.")
        return v


class SlotClassUpdateSchema(Schema):
    class_section_id: int | None = None
    volunteer_ids: list[int] | None = None

    @field_validator("volunteer_ids")
    @classmethod
    def validate_volunteer_ids(cls, v):
        if v is None:
            return v
        if len(v) < 1:
            raise ValueError("At least 1 volunteer required.")
        if len(v) > 5:
            raise ValueError("Maximum 5 volunteers allowed.")
        if len(v) != len(set(v)):
            raise ValueError("Volunteer IDs must be unique.")
        return v
```

`subject_id`, `volunteer_1_id`, `volunteer_2_id` are removed from both schemas. `VolunteerInSlotClassSchema`, `SlotClassDeleteResponseSchema` are unchanged — the read path already returns a `volunteers` list (confirmed in current `slot_classes_api.py:_scs_to_schema`).

`SlotClassReadSchema` gets one small addition needed by F-M6-8's `SlotClassItem` shape (M6.md's F-M6-8 spec lists `section_display_name` on the frontend interface, but the backend contract check in F-M6-5 only called out `volunteers: []` — this is the actual gap):

```python
class SlotClassReadSchema(Schema):
    slot_class_section_id: int
    class_section_id: int
    section_name: str
    section_display_name: str | None   # NEW — bucket's display name, for schedule-grid rendering
    subject_name: str
    volunteers: list[VolunteerInSlotClassSchema]
    active_children_count: int
```

And `_scs_to_schema` (`slot_classes_api.py`) gets one field added to match:

```python
def _scs_to_schema(scs) -> SlotClassReadSchema:
    active_vols = [...]  # unchanged
    return SlotClassReadSchema(
        slot_class_section_id=scs.slot_class_section_id,
        class_section_id=scs.class_section_id_id,
        section_name=scs.class_section_id.section_name,
        section_display_name=scs.class_section_id.section_display_name,  # NEW
        subject_name=scs.class_section_subject_id.subject_id.subject_name,  # unchanged — raw DB value
        volunteers=[...],  # unchanged
        active_children_count=...,  # unchanged
    )
```

**Explicitly not doing:** server-side normalization of legacy subject names ("Foundation Day 1"/"Foundation Day 2" → "Foundation"). M6.md decision #3 assigns that responsibility to the frontend ("the UI normalizes, but the DB values are preserved for Dots"), and F-M6-8's own design shows a static `Subject: Foundation` label regardless of the API's `subject_name` value — the frontend never reads `subject_name` for that label at all. Normalizing it server-side would be scope the milestone doc didn't ask for and would risk masking the real DB value for a caller that does want it (e.g. Dots reads through the DB directly, not this API, but no reason to make the API lie either). `subject_name` in the response stays the raw DB value, unchanged from today.

**Foundation Subject helper** (new, `sessionops/services/slot_classes/helpers.py` — add alongside the existing helpers):

```python
_FOUNDATION_SUBJECT_CACHE = None

def get_foundation_subject() -> Subject:
    global _FOUNDATION_SUBJECT_CACHE
    if _FOUNDATION_SUBJECT_CACHE is None:
        try:
            _FOUNDATION_SUBJECT_CACHE = Subject.objects.get(subject_name="Foundation")
        except Subject.DoesNotExist:
            raise ValidationError(
                "Configuration error: 'Foundation' Subject row not seeded. "
                "Run migration 0027 before using this feature."
            )
    return _FOUNDATION_SUBJECT_CACHE
```

Tests must reset `helpers._FOUNDATION_SUBJECT_CACHE = None` in setup/teardown, since Django test transactions roll back the DB row but not the module-level Python variable — same gotcha noted in M6.md.

**`create_slot_class` rewrite** (`services/slot_classes/create.py`):

Steps 5-8 (subject resolve, vol1 resolve, vol2 resolve, R3 check) collapse into:

```python
# 5. Resolve Foundation subject (was: payload.subject_id lookup)
subject = get_foundation_subject()

# 6. R-bucket: volunteer count vs active children (NEW — before resolving volunteers,
#    since there's no point validating volunteer identities if the count alone fails)
active_children = ChildClassSection.objects.filter(
    class_section_id=section, is_active=True, removed=False
).count()
if len(payload.volunteer_ids) > active_children:
    raise ValidationError(
        f"Cannot assign {len(payload.volunteer_ids)} volunteers — "
        f"bucket has only {active_children} child(ren). "
        f"Maximum {active_children} volunteer(s) allowed."
    )

# 7. Resolve + validate each volunteer (was: separate vol1/vol2 blocks + R3 check)
volunteers = _resolve_volunteer_list(payload.volunteer_ids, slot.school_id, slot, user)
```

where (new private helper in the same file):

```python
def _resolve_volunteer_list(volunteer_ids: list[int], school_id: int, slot: Slot, user: User) -> list[User]:
    volunteers = []
    for vid in volunteer_ids:
        try:
            vol = User.objects.get(user_id=vid, is_active=True)
        except User.DoesNotExist:
            raise NotFound(f"Volunteer {vid} not found.")
        validate_volunteer_worknode_match(school_id, vol)
        check_r6_volunteer_in_slot(slot, vol)
        check_r4_volunteer(vol, school_id)
        volunteers.append(vol)
    return volunteers
```

R3 (uniqueness) is already enforced by the schema validator before this function runs — no duplicate check needed here (matches the current code's pattern of trusting schema-level validation for `vol1 != vol2`).

Steps 13-17 (CSS insert, ChildSubject bulk-create, SlotClassSection insert, SCSV insert(s), SchoolVolunteer ensure) stay structurally the same, just loop over `volunteers` instead of the `[vol1] + ([vol2] if vol2 else [])` pattern already used at line 159 today — that list-comprehension pattern already generalizes trivially to N.

**`edit_slot_class` changes** (`services/slot_classes/edit.py`):

- Remove `subject_changing` entirely: delete `new_subject_id = payload.subject_id`, the `subject_changing` boolean, and the `if subject_changing: ... else: new_subject = scs.class_section_subject_id.subject_id` branch. Replace with: `new_subject = get_foundation_subject()` unconditionally whenever the cascade-reset path runs (only `section_changing` can trigger it now).
- Rename `new_vol1_id`/`new_vol2_id` to a single `new_volunteer_ids = payload.volunteer_ids` (may be `None` = no change, matching the existing None-means-no-change convention for `class_section_id`).
- `vols_changing = new_volunteer_ids is not None` (was: `new_vol1_id is not None or payload.volunteer_2_id is not None`).
- Add the R-bucket check wherever volunteers change — both in the cascade-reset path's "re-create volunteers" block and in the volunteer-only-swap path, against `active_children` computed for whichever section is now current (`new_section` if section changed, else `scs.class_section_id`).
- `_replace_volunteers(scs, vol_ids, ...)` signature is unchanged in shape (already takes a list) — its internal `if len(vol_ids) == 2 and vol_ids[0] == vol_ids[1]` duplicate check becomes redundant now that the schema validator enforces uniqueness for the whole list; remove it (dead code, not a functional change since the schema already blocks it before this function is ever called with duplicates).

**API endpoints:** No path/method changes. `slot_classes_api.py`'s `post_slot_class`/`patch_slot_class` pass `payload` straight through to the services — no change needed at the router layer beyond the schema import already picking up the new field names.

**Migrations:** None — F-M6-1 already seeded the Foundation subject this feature depends on.

### Frontend

None — F-M6-8's concern. This feature's job is to make sure the write contract (`volunteer_ids`) and the already-correct read contract (`volunteers: [...]`, confirmed present in current code) are both right before F-M6-8 starts.

## Business Rules Enforced

- **R2 (relaxed):** 1-5 volunteers, was 1-2 — enforced by the schema validator (`len(v) < 1` / `len(v) > 5`).
- **R3 (generalized):** All volunteer IDs unique — enforced by the schema validator (`len(v) != len(set(v))`), replacing the old `vol1_ne_vol2` model-validator on the schema and the redundant runtime check in `_replace_volunteers`.
- **R4:** Unchanged — `check_r4_volunteer` reused verbatim.
- **R5:** Unchanged — the "section not already in this slot" check (`create.py:87-95`) doesn't reference volunteers at all.
- **R6:** Unchanged in mechanism, extended in scope — `check_r6_volunteer_in_slot` is now called once per volunteer in the list instead of twice (vol1, vol2).
- **R-bucket (NEW):** `count(volunteer_ids) ≤ count(active children in bucket)` — checked in `create_slot_class` before resolving volunteers, and in `edit_slot_class` wherever volunteers or section change.

## Security Review

- **Auth:** No change — both endpoints already require `get_school_or_403` + `can_modify_school` (verified in current `create_slot_class`/`edit_slot_class`).
- **RBAC scope:** `_resolve_volunteer_list` calls `validate_volunteer_worknode_match(school_id, vol)` per volunteer — same per-volunteer school-membership check as today, just looped instead of duplicated twice inline. No new cross-school leakage surface from generalizing to N.
- **Input validation:** `volunteer_ids` list bounds (1-5) and uniqueness are enforced before any DB query runs (schema layer), preventing a malicious client from submitting an oversized list to force N lookups — though even an unbounded list before this fix would only cost N `User.objects.get()` calls, not a real DoS vector given RBAC already gates the endpoint to authenticated school-scoped users.
- **Data exposure:** No change — response shape for volunteers was already a list.

## Testing Strategy

- **Backend unit tests** (rewrite `test_create_slot_class.py`, `test_delete_slot_class.py`):
  - Create with 1 volunteer, bucket has 1 child → succeeds
  - Create with 5 volunteers, bucket has exactly 5 children → succeeds (boundary)
  - Create with volunteers exceeding active-children count → `ValidationError` with exact counts in message
  - Create with 0 volunteers → schema-level rejection (Pydantic `ValueError`)
  - Create with 6 volunteers → schema-level rejection
  - Create with duplicate volunteer ID → schema-level rejection
  - Foundation subject always used regardless of any legacy "Foundation Day 1"/"Foundation Day 2" subjects existing in the DB
  - R4/R5/R6 regression: same assertions as today, adapted to the list-based payload
  - Edit: replacing volunteers reconciles `school_volunteer` for removed volunteers exactly as before (assert `SchoolVolunteer.is_active=False` for a volunteer dropped from the list)
  - Edit: section change still resets subject/ChildSubject cascade correctly with Foundation subject
- **Backend integration tests:** update `schedule/test_schedule_validation.py`, `schedule/test_schedule_view.py` fixtures (`_make_subject` helpers currently create "Foundation Day 1"/"Foundation Day 2" via `Program.objects.get_or_create(program_name="Foundation Program")` — these fixtures can stay for *reading* legacy data, but new slot-class creation in tests must switch to expecting the seeded "Foundation" subject)
- **Read-path tests (new):** `section_display_name` in the response matches the bucket's `ClassSection.section_display_name`, including `None` for legacy sections that never got one backfilled; a slot-class whose stored `Subject.subject_name` is a legacy value ("Foundation Day 1"/"Foundation Day 2") still returns that raw value in `subject_name` — confirming the API does NOT normalize it (normalization is frontend-only, per M6 decision #3)
- **Manual verification:** `just serve`, create a slot-class with 3 volunteers via the API, confirm response `subject_name == "Foundation"` (new rows always use the seeded row) and `section_display_name` matches the bucket; try exceeding the bucket's child count and confirm the exact error message

## Milestones (implementation order)

1. **Chunk 1 — Foundation subject helper + create_slot_class rewrite:** `get_foundation_subject`, `_resolve_volunteer_list`, R-bucket check, schema change for `SlotClassCreateSchema`. Fully working state — slot-class creation works end-to-end with the new contract.
2. **Chunk 2 — edit_slot_class rewrite:** remove `subject_changing`, generalize volunteer replace, add R-bucket check to the edit path, schema change for `SlotClassUpdateSchema`.
3. **Chunk 3 — test rewrite:** update all 4 affected test files to the new payload/fixture shape, confirm 100% pass.

## Open Questions

None. The `volunteers: []` shape was already correct (confirmed by reading current code). One read-path gap was found while cross-checking F-M6-8's `SlotClassItem` interface in M6.md — `section_display_name` missing from `SlotClassReadSchema` — and is folded into this feature's LLD above rather than left for F-M6-8 to discover. Server-side subject-name normalization was considered and deliberately excluded: M6.md decision #3 assigns that responsibility to the frontend, so adding it here would be scope beyond what the milestone doc specifies.
