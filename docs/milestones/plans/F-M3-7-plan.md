# Feature Plan: F-M3-7 — Slot-Class Assignment

## Overview

The most complex M3 feature. CO opens a slot, clicks "Add Class to Slot", and composes: section + subject + Vol1 (required) + Vol2 (optional). On submit, five tables receive rows in a single atomic transaction: `ClassSectionSubject`, `ChildSubject` (per active child), `SlotClassSection`, `SlotClassSectionVolunteer` (1-2 rows), and `SchoolVolunteer` (if not already active at this school). Business rules R2, R3, R4, R5, R6 are all enforced here. This feature also extends the M2 `enroll_child` and `soft_delete_section` services.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | 4 NEW | `ClassSectionSubject`, `ChildSubject`, `SlotClassSection`, `SlotClassSectionVolunteer` |
| Backend services | 3 NEW + 3 EXTEND | New: `slot_classes/create.py`, `slot_classes/edit.py`, `slot_classes/delete.py`; Extend: `children/enroll.py`, `children/edit.py`, `structure/sections.py` |
| Backend API endpoints | 4 NEW routes | CRUD on slot-classes |
| Frontend pages | Modified | `SlotDetail` + `AddSlotClassModal` inside `SlotListTab` |
| Frontend components | 2 NEW | `SlotDetail.tsx`, `AddSlotClassModal.tsx` |
| Database migrations | Yes | Migration B: 4 new tables |
| Celery tasks | No | — |
| Existing tests | Extend | `test_enroll_child.py`, `test_edit_child.py`, `test_sections.py` |
| Documentation | None | — |

## High-Level Design

### 5-table transaction on create

```
CO submits "Add Class to Slot"
  → POST /api/schools/{id}/slots/{slot_id}/slot-classes/
  → create_slot_class(slot_id, payload, user)
      @transaction.atomic + select_for_update(slot)
      Validations:
        R3: vol1 != vol2
        section belongs to this school
        R5: section not already in this slot
        R6: vol1, vol2 not already in another slot-class in this slot
        worknode match: vol1 and vol2 must be in school's worknode-tagged list
        R4: vol1 and vol2 must not have active school_volunteer at a DIFFERENT school
      Inserts:
        1. ClassSectionSubject (section + subject)
        2. ChildSubject × N (one per active child in section)
        3. SlotClassSection (slot + section + css)
        4. SlotClassSectionVolunteer × 1-2 (vol1, [vol2])
        5. SchoolVolunteer × 1-2 (only if not already active at this school)
  ← slot_class_section_id + full representation
```

### school_volunteer lifecycle

| Trigger | Action |
|---|---|
| Slot-class create: volunteer has no active row at this school | Insert SchoolVolunteer |
| Slot-class create: volunteer already has active row at this school | No-op |
| Slot-class create: volunteer has active row at **different** school | 409 R4 error |
| Slot-class delete: volunteer has no more slot-classes at this school | Soft-delete SchoolVolunteer |
| Slot-class volunteer swap (edit): old volunteer has no remaining slot-classes | Soft-delete old SchoolVolunteer |

### M2 service extensions

- **`enroll_child`**: after existing 5-table insert, create `ChildSubject` rows for all active `ClassSectionSubject` rows on the section
- **`edit_child` (section change)**: soft-delete old `ChildSubject` rows, create new for new section's active subjects
- **`soft_delete_section`**: block if active `SlotClassSection` rows reference the section (same pattern as existing active-children block)

## Low-Level Design

### Backend — Models (Migration B)

#### `ClassSectionSubject` → `models/class_section_subject.py`

```python
class ClassSectionSubject(models.Model):
    class_section_subject_id = models.BigAutoField(primary_key=True)
    class_section_id         = models.ForeignKey("ClassSection", on_delete=models.PROTECT)
    subject_id               = models.ForeignKey("Subject", on_delete=models.PROTECT)
    is_active                = models.BooleanField(default=True)
    removed                  = models.BooleanField(default=False)
    deleted_at               = models.DateTimeField(null=True, blank=True)
    created_at               = models.DateTimeField(auto_now_add=True)
    updated_at               = models.DateTimeField(auto_now=True)
    created_by               = models.ForeignKey("User", on_delete=models.PROTECT,
                                                  related_name="+")
    updated_by               = models.ForeignKey("User", on_delete=models.PROTECT,
                                                  null=True, related_name="+")

    class Meta:
        db_table = "class_section_subject"
        indexes = [models.Index(fields=["class_section_id", "is_active", "removed"])]
```

#### `ChildSubject` → `models/child_subject.py`

```python
class ChildSubject(models.Model):
    child_subject_id         = models.BigAutoField(primary_key=True)
    child_id                 = models.ForeignKey("Child", on_delete=models.PROTECT)
    class_section_subject_id = models.ForeignKey("ClassSectionSubject",
                                                  on_delete=models.PROTECT)
    is_active                = models.BooleanField(default=True)
    removed                  = models.BooleanField(default=False)
    deleted_at               = models.DateTimeField(null=True, blank=True)
    created_at               = models.DateTimeField(auto_now_add=True)
    updated_at               = models.DateTimeField(auto_now=True)
    created_by               = models.ForeignKey("User", on_delete=models.PROTECT,
                                                  related_name="+")
    updated_by               = models.ForeignKey("User", on_delete=models.PROTECT,
                                                  null=True, related_name="+")

    class Meta:
        db_table = "child_subject"
        indexes = [
            models.Index(fields=["child_id", "is_active", "removed"]),
            models.Index(fields=["class_section_subject_id", "is_active", "removed"]),
        ]
```

`ChildSubject` is **history-only** — never used for current-state queries.

#### `SlotClassSection` → `models/slot_class_section.py`

```python
class SlotClassSection(models.Model):
    slot_class_section_id    = models.BigAutoField(primary_key=True)
    slot_id                  = models.ForeignKey("Slot", on_delete=models.PROTECT)
    class_section_id         = models.ForeignKey("ClassSection", on_delete=models.PROTECT)
    class_section_subject_id = models.ForeignKey("ClassSectionSubject",
                                                  on_delete=models.PROTECT)
    is_active                = models.BooleanField(default=True)
    removed                  = models.BooleanField(default=False)
    deleted_at               = models.DateTimeField(null=True, blank=True)
    created_at               = models.DateTimeField(auto_now_add=True)
    updated_at               = models.DateTimeField(auto_now=True)
    created_by               = models.ForeignKey("User", on_delete=models.PROTECT,
                                                  related_name="+")
    updated_by               = models.ForeignKey("User", on_delete=models.PROTECT,
                                                  null=True, related_name="+")

    class Meta:
        db_table = "slot_class_section"
        indexes = [models.Index(fields=["slot_id", "is_active", "removed"])]
```

Both `class_section_id` and `class_section_subject_id` are denormalized — matches Bubble.

#### `SlotClassSectionVolunteer` → `models/slot_class_section_volunteer.py`

```python
class SlotClassSectionVolunteer(models.Model):
    slot_class_section_volunteer_id = models.BigAutoField(primary_key=True)
    slot_class_section_id           = models.ForeignKey("SlotClassSection",
                                                         on_delete=models.PROTECT)
    volunteer_id                    = models.ForeignKey("User",
                                                         on_delete=models.PROTECT)
    is_active                       = models.BooleanField(default=True)
    removed                         = models.BooleanField(default=False)
    deleted_at                      = models.DateTimeField(null=True, blank=True)
    created_at                      = models.DateTimeField(auto_now_add=True)
    updated_at                      = models.DateTimeField(auto_now=True)
    created_by                      = models.ForeignKey("User", on_delete=models.PROTECT,
                                                         related_name="+")
    updated_by                      = models.ForeignKey("User", on_delete=models.PROTECT,
                                                         null=True, related_name="+")

    class Meta:
        db_table = "slot_class_section_volunteer"
        indexes = [
            models.Index(fields=["slot_class_section_id", "is_active", "removed"]),
            models.Index(fields=["volunteer_id", "is_active", "removed"]),
        ]
```

No vol1/vol2 column — separate rows. Both volunteers are treated identically.

### Backend — Services

#### `services/slot_classes/create.py`

`create_slot_class(slot_id, payload, user) -> SlotClassSection`

Full implementation per M3.md §F-M3-7. Key steps:
1. `select_for_update` on Slot
2. RBAC check
3. R3 (vol1 ≠ vol2), R5 (section not in slot), R6 (vol not in slot), worknode match, R4 (vol not at other school)
4. `@transaction.atomic` 5-table insert
5. `school_volunteer` upsert (create if not already active at this school)

Helper: `_validate_volunteer_worknode_match(school_id, volunteer_id)`
Helper: `_reconcile_school_volunteer_for_volunteers(school_id, volunteer_ids, user)` — also used by edit and delete

#### `services/slot_classes/edit.py`

`edit_slot_class(scs_id, payload, user) -> SlotClassSection`

Three sub-flows:
1. **Volunteer-only swap**: soft-delete old `SlotClassSectionVolunteer`, create new, apply R3/R6/R4, reconcile old volunteer's `SchoolVolunteer`, create new volunteer's `SchoolVolunteer` if missing
2. **Section change**: full cascade reset (soft-delete all child rows, re-insert)
3. **Subject change**: full cascade reset

#### `services/slot_classes/delete.py`

`delete_slot_class(scs_id, user)`

Soft-deletes in order: `SlotClassSectionVolunteer` rows → `ClassSectionSubject` row → `SlotClassSection` row → reconcile `SchoolVolunteer` for affected volunteers.

All soft-deletes in one `@transaction.atomic`.

#### `services/children/enroll.py` — EXTEND

After existing 5-table insert, add:

```python
# M3 extension: create ChildSubject for any active subjects on this section
active_css = ClassSectionSubject.objects.filter(
    class_section_id=section,
    is_active=True, removed=False,
)
if active_css.exists():
    ChildSubject.objects.bulk_create([
        ChildSubject(child_id=child, class_section_subject_id=css, created_by=user)
        for css in active_css
    ])
```

#### `services/children/edit.py` — EXTEND

On section change: soft-delete `ChildSubject` rows for old `ClassSectionSubject` rows, create new rows for new section's active subjects.

#### `services/structure/sections.py` — EXTEND

In `soft_delete_section()`, before the existing children check:

```python
# M3 extension
active_scs_count = SlotClassSection.objects.filter(
    class_section_id=section,
    is_active=True, removed=False,
).count()
if active_scs_count > 0:
    raise ConflictError(
        f"Cannot delete this section. Remove the {active_scs_count} class "
        f"assignment{'s' if active_scs_count != 1 else ''} from the schedule first."
    )
```

### Backend — Schemas

```python
class SlotClassCreateSchema(Schema):
    class_section_id: int
    subject_id: int
    volunteer_1_id: int
    volunteer_2_id: int | None = None

    @model_validator(mode="after")
    def vol1_ne_vol2(self):
        if self.volunteer_2_id and self.volunteer_1_id == self.volunteer_2_id:
            raise ValueError("Vol1 and Vol2 cannot be the same volunteer")
        return self

class SlotClassUpdateSchema(Schema):
    volunteer_1_id:   int | None = None
    volunteer_2_id:   int | None = None
    class_section_id: int | None = None
    subject_id:       int | None = None

class VolunteerInSlotClassSchema(Schema):
    user_id: int
    user_display_name: str
    user_role: str

class SlotClassReadSchema(Schema):
    slot_class_section_id: int
    section_name: str
    subject_name: str
    volunteers: list[VolunteerInSlotClassSchema]
    active_children_count: int
```

### Backend — Endpoints

**`api/slot_classes_api.py`** (NEW):

| Method | Path | Auth | RBAC | Description |
|---|---|---|---|---|
| GET | `/schools/{id}/slots/{slot_id}/slot-classes/` | JWT | `can_view_school` | List slot-classes |
| POST | `/schools/{id}/slots/{slot_id}/slot-classes/` | JWT | `can_modify_school` | Create slot-class |
| PATCH | `/schools/{id}/slots/{slot_id}/slot-classes/{scs_id}/` | JWT | `can_modify_school` | Edit slot-class |
| DELETE | `/schools/{id}/slots/{slot_id}/slot-classes/{scs_id}/` | JWT | `can_modify_school` | Delete slot-class |

CHO has `can_modify_school` within worknode-scoped schools — full CRUD.

POST errors: 400 (R3, worknode mismatch, section mismatch), 403, 409 (R4, R5, R6)
PATCH errors: same as POST + 404
DELETE errors: 403, 404

### Frontend

**`SlotDetail.tsx`** (NEW — expands within `SlotCard`):
- Calls `GET /slots/{slot_id}/slot-classes/`
- Lists slot-classes: section, subject, volunteer names
- "Add Class to Slot" button (when `userCan('modify_school', schoolId)`)
- Three-dot per slot-class: Edit, Delete

**`AddSlotClassModal.tsx`** (NEW):
- Section dropdown (from school's sections)
- Subject dropdown (Foundation Day 1 / Foundation Day 2)
- Vol1 dropdown — required; populated from volunteer list (F-M3-3)
- Vol2 dropdown — optional; same list, vol1 option disabled
- Volunteers already in this slot shown as disabled in both dropdowns
- R4 error: full-modal alert with school name: "{name} is already at school '{school}'. Remove them from there first."
- R3, R5, R6: inline field errors

## Business Rules Enforced

| Rule | Enforcement |
|---|---|
| R2 — 1-2 volunteers per slot-class | Schema: Vol1 required, Vol2 optional |
| R3 — Vol1 ≠ Vol2 | Pydantic `model_validator` + service check |
| R4 — Volunteer at exactly one school | Service: `SchoolVolunteer.exclude(school_id=this_school).exists()` |
| R5 — Section not twice in same slot | Service: `SlotClassSection` existence check |
| R6 — Volunteer not in two slot-classes in same slot | Service: `SlotClassSectionVolunteer` check |
| R9 — No hard deletes | `on_delete=PROTECT` on all FKs; all deletes are soft |

## Security Review

- All write endpoints require `can_modify_school()` — CHO scoped to worknode-mapped schools
- `_validate_volunteer_worknode_match()` prevents picking volunteers from other schools' Worknode lists
- R4 error message reveals the name of the other school — acceptable within MAD's collaborative context
- `select_for_update` on Slot prevents concurrent slot-class creation races

## Testing Strategy

**Backend unit tests** (`tests/slot_classes/`):

`test_create_slot_class.py`:
- `test_create_slot_class_creates_all_rows`
- `test_create_slot_class_creates_school_volunteer_for_new_volunteer`
- `test_create_slot_class_skips_school_volunteer_creation_if_exists`
- `test_create_slot_class_creates_child_subject_for_each_active_child`
- `test_create_slot_class_in_single_transaction`
- `test_create_slot_class_vol_at_different_school_returns_409_r4`
- `test_create_slot_class_vol_at_different_school_message_includes_school_name`
- `test_create_slot_class_vol1_eq_vol2_returns_400`
- `test_create_slot_class_section_already_in_slot_returns_409`
- `test_create_slot_class_volunteer_already_in_slot_returns_409`
- `test_create_slot_class_volunteer_not_in_worknode_list_returns_400`
- `test_create_slot_class_section_not_at_school_returns_400`
- `test_create_slot_class_only_vol1_no_vol2_succeeds`

`test_edit_slot_class.py`:
- `test_edit_slot_class_volunteer_same_school_replaces_row`
- `test_edit_slot_class_volunteer_keeps_school_volunteer_if_other_slot_classes_remain`
- `test_edit_slot_class_volunteer_removes_school_volunteer_when_last`
- `test_edit_slot_class_section_full_cascade_reset`

`test_delete_slot_class.py`:
- `test_delete_slot_class_cascade_soft_deletes_all_rows`
- `test_delete_slot_class_reconciles_school_volunteer`
- `test_cho_can_create_slot_class_within_scope`
- `test_cho_cannot_create_slot_class_outside_scope_returns_403`
- `test_co_cannot_create_slot_class_in_other_school`

**M2 extension tests** (extend existing files):
- `test_enroll_child_in_section_with_existing_subjects_creates_child_subjects`
- `test_edit_child_section_updates_child_subjects`
- Section delete blocked by slot-class: `test_section_delete_blocked_when_slot_classes_exist`

**Manual verification:**
- [ ] Create slot-class with Vol1 only → all 4 tables get rows (5 if new volunteer)
- [ ] Create slot-class with Vol1 + Vol2 → all 5 tables get rows
- [ ] R4: Vol already at another school → 409 with school name
- [ ] R5: same section in slot twice → 409
- [ ] R6: same vol in two slot-classes in same slot → 409
- [ ] Delete slot-class → `SchoolVolunteer` soft-deleted if no more slot-classes at school
- [ ] Enroll new child in section that already has slot-classes → `ChildSubject` rows created

## Implementation Order

**Chunk 1 — Models + Migration B:**
1. Create 4 model files
2. Register in `models/__init__.py`
3. Write and run Migration B

**Chunk 2 — Core service (create):**
1. Write `services/slot_classes/create.py` (including helpers)
2. Write create test file
3. Run tests

**Chunk 3 — Edit + Delete services:**
1. Write `services/slot_classes/edit.py`
2. Write `services/slot_classes/delete.py`
3. Write edit/delete tests

**Chunk 4 — M2 extensions:**
1. Extend `services/children/enroll.py`
2. Extend `services/children/edit.py`
3. Extend `services/structure/sections.py`
4. Write/extend M2 extension tests

**Chunk 5 — API + Frontend:**
1. Write `api/slot_classes_api.py`
2. Build `SlotDetail.tsx`
3. Build `AddSlotClassModal.tsx`

**Dependency:** F-M3-5 (Slot model + Migration A) and F-M3-3 (volunteer list for dropdown).

## Open Questions

None. All resolved:
- CHO has full CRUD on slot-classes within scope (confirmed per F-M3-4)
- `get_or_create_school_academic_year` available at `services/academic_year/queries.py`
