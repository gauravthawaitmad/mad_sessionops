# Feature Plan: M3 — Volunteers + Scheduling

## Overview

M3 activates the Volunteers and Slots tabs, wires in Worknode-based volunteer
auto-population, unlocks CHO scope, and delivers the full slot → slot-class →
schedule stack. It builds directly on M1 (auth, JWT, Hasura sync) and M2
(Class / Section / Child models). Nine features, ~13 working days.

---

## Blast Radius

| Surface | Impact | Detail |
|---|---|---|
| Backend models | Extend + 9 NEW | `User` (+worknode_id); new: `PartnerWorknode`, `Subject`, `SchoolVolunteer`, `Slot`, `ClassSectionSubject`, `ChildSubject`, `SlotClassSection`, `SlotClassSectionVolunteer` |
| Backend migrations | 2 files | (1) schema additions on User + 4 new tables; (2) remaining 4 new tables + Subject seed |
| Backend services | Extend + 7 NEW dirs | Extend: `scope.py`, `sync.py`, `children/enroll.py`, `children/edit.py`, `structure/sections.py`; New: `volunteers/`, `slots/`, `slot_classes/` |
| Backend API endpoints | 5 NEW routers/groups | volunteers, slots, slot-classes, schedule, permissions (`/auth/me/permissions/`) |
| Frontend pages | Activate + 2 NEW | Activate Volunteers tab, Activate Slots tab; new: Schedule page |
| Frontend components | ~8 new | VolunteerCard, SlotCard, SlotDetail, AddSlotModal, EditSlotModal, AddSlotClassModal, ScheduleView, useUserCan hook |
| Database migrations | Yes | Schema changes — see LLD |
| Celery tasks | No | Sync is still cron-based; no new async tasks in M3 |
| Existing tests | Extend | `test_enroll_child.py`, `test_sections.py`, `test_scope.py` all need new cases |
| Documentation | Update | `ARCHITECTURE.md` and `GLOSSARY.md` both describe CHO scope as `SchoolVolunteer`-based — must be updated to reflect `partner_worknode` mapping |

### Known discrepancy — sync file path

The M3 spec references `services/sync/hasura_sync.py` but the actual file is
`services/sync.py`. **Do not move the file** — keep extending `services/sync.py`
in place and note the path discrepancy if/when the team decides to reorganise.

---

## High-Level Design (HLD)

### Data flow — Volunteer list

```
CO opens Volunteers tab
  → GET /api/schools/{id}/volunteers/
  → list_school_volunteers(school_id, user)
      → PartnerWorknode.filter(partner_id=school_id) → worknode_ids
      → User.filter(worknode_id__in=worknode_ids, is_active=True, removed=False)
      → for each: count active SlotClassSectionVolunteer rows at this school
  ← [{user_id, user_name, user_role, active_slot_class_count}]
```

### Data flow — CHO scope

```
CHO logs in
  → login returns scope_warning if no worknode mapping found
  → GET /api/schools/
  → schools_visible_to(cho_user)
      → PartnerWorknode.filter(worknode_id=user.worknode_id) → partner_ids
      → Partner.filter(partner_id__in=partner_ids)
  ← scoped school list
```

### Data flow — Slot-class create (5-table transaction)

```
CO submits "Add Class to Slot"
  → POST /api/schools/{id}/slots/{slot_id}/slot-classes/
  → create_slot_class(slot_id, payload, user)
      Validations: R3, R5, R6, worknode match, section belongs to school
      R4 check: SchoolVolunteer.exclude(school_id=this_school).exists() → 409 if yes
      @transaction.atomic:
        1. ClassSectionSubject.create(section, subject)
        2. ChildSubject.bulk_create(per active child in section)
        3. SlotClassSection.create(slot, section, css)
        4. SlotClassSectionVolunteer.create × 1-2
        5. SchoolVolunteer.create IF not already active at this school
  ← slot_class_section_id + full payload
```

### Key architectural decisions

1. **CHO scope lives in `scope.py` only.** The existing `_classify()` helper gets a new
   `'cho'` return value. Every downstream function (`schools_visible_to`,
   `can_view_school`, `can_modify_school`) branches on it. No other layer knows about
   `partner_worknode` lookups.

2. **All new models follow the M2 soft-delete pattern** (`is_active` + `removed` +
   `deleted_at`), except `Subject` and `PartnerWorknode` (read-only / seeded catalogs).

3. **`school_volunteer` has no public endpoint.** Its rows are only created and
   destroyed as side-effects of slot-class CRUD.

4. **Two migration files.** Split to reduce rollback risk:
   - Migration A: `User.worknode_id`, `PartnerWorknode`, `Subject` (+ seed), `SchoolVolunteer`, `Slot`
   - Migration B: `ClassSectionSubject`, `ChildSubject`, `SlotClassSection`, `SlotClassSectionVolunteer`

5. **No new Celery tasks.** Sync is still a periodic task hitting `sync.py`. Only new
   code paths inside the sync are the `worknode_id` field write on User and a new
   `_run_partner_worknode_phase()`.

---

## Low-Level Design (LLD)

### Backend — Models

All new model files go in `sessionops/models/`. Add each to `models/__init__.py`.

#### `User` extension (`models/user.py`)

Add one field:

```python
worknode_id = models.IntegerField(null=True, blank=True, db_index=True)
```

#### `PartnerWorknode` → `models/partner_worknode.py` (NEW)

```python
class PartnerWorknode(models.Model):
    partner_worknode_id    = models.BigAutoField(primary_key=True)
    partner_id             = models.CharField(max_length=100, db_index=True)
    worknode_id            = models.IntegerField(db_index=True)
    city_name              = models.CharField(max_length=200, null=True, blank=True)
    state                  = models.CharField(max_length=200, null=True, blank=True)
    co_name                = models.TextField(null=True, blank=True)
    chapter_name           = models.CharField(max_length=200, null=True, blank=True)
    engine                 = models.CharField(max_length=100, null=True, blank=True)
    chapter_status         = models.CharField(max_length=50, null=True, blank=True)
    sourcing_campaign_code = models.TextField(null=True, blank=True)
    campaign_name          = models.CharField(max_length=200, null=True, blank=True)
    fundraiser_id          = models.CharField(max_length=100, null=True, blank=True)
    fundraiser_name        = models.TextField(null=True, blank=True)
    created_at             = models.DateTimeField(auto_now_add=True)
    updated_at             = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "partner_worknode"
        indexes = [
            models.Index(fields=["partner_id"]),
            models.Index(fields=["worknode_id"]),
        ]
```

No `is_active`/`removed` — sync-managed mirror.

#### `Subject` → `models/subject.py` (NEW)

```python
class Subject(models.Model):
    subject_id   = models.BigAutoField(primary_key=True)
    subject_name = models.CharField(max_length=100, unique=True)
    program_id   = models.ForeignKey("Program", on_delete=models.PROTECT,
                                     db_column="program_id")
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    created_by   = models.ForeignKey("User", on_delete=models.PROTECT,
                                     null=True, related_name="+")
    updated_by   = models.ForeignKey("User", on_delete=models.PROTECT,
                                     null=True, related_name="+")

    class Meta:
        db_table = "subject"
```

Seeded in Migration A:
- `subject_name="Foundation Day 1", program_id=1, created_by=None`
- `subject_name="Foundation Day 2", program_id=1, created_by=None`

No `is_active`/`removed`.

#### `SchoolVolunteer` → `models/school_volunteer.py` (NEW)

```python
class SchoolVolunteer(models.Model):
    school_volunteer_id     = models.BigAutoField(primary_key=True)
    school_id               = models.BigIntegerField(db_index=True)
    volunteer_id            = models.ForeignKey("User", on_delete=models.PROTECT)
    school_academic_year_id = models.ForeignKey("SchoolAcademicYear",
                                                on_delete=models.PROTECT)
    is_active               = models.BooleanField(default=True)
    removed                 = models.BooleanField(default=False)
    deleted_at              = models.DateTimeField(null=True, blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)
    created_by              = models.ForeignKey("User", on_delete=models.PROTECT,
                                                related_name="+")
    updated_by              = models.ForeignKey("User", on_delete=models.PROTECT,
                                                null=True, related_name="+")

    class Meta:
        db_table = "school_volunteer"
        indexes = [
            models.Index(fields=["school_id", "is_active", "removed"]),
            models.Index(fields=["volunteer_id", "is_active", "removed"]),
        ]
```

#### `Slot` → `models/slot.py` (NEW)

```python
DAYS_OF_WEEK = [
    ("monday","Monday"), ("tuesday","Tuesday"), ("wednesday","Wednesday"),
    ("thursday","Thursday"), ("friday","Friday"), ("saturday","Saturday"),
    ("sunday","Sunday"),
]

class Slot(models.Model):
    slot_id                 = models.BigAutoField(primary_key=True)
    school_id               = models.BigIntegerField(db_index=True)
    school_academic_year_id = models.ForeignKey("SchoolAcademicYear",
                                                on_delete=models.PROTECT)
    slot_name               = models.CharField(max_length=100)
    day_of_week             = models.CharField(max_length=10, choices=DAYS_OF_WEEK)
    start_time              = models.TimeField()
    end_time                = models.TimeField()
    recurring               = models.BooleanField(default=True)
    is_active               = models.BooleanField(default=True)
    removed                 = models.BooleanField(default=False)
    deleted_at              = models.DateTimeField(null=True, blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)
    created_by              = models.ForeignKey("User", on_delete=models.PROTECT,
                                                related_name="+")
    updated_by              = models.ForeignKey("User", on_delete=models.PROTECT,
                                                null=True, related_name="+")

    class Meta:
        db_table = "slot"
        indexes = [
            models.Index(fields=["school_id", "is_active", "removed"]),
            models.Index(fields=["school_id", "day_of_week"]),
        ]
```

#### `ClassSectionSubject` → `models/class_section_subject.py` (NEW)

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
        indexes = [
            models.Index(fields=["class_section_id", "is_active", "removed"]),
        ]
```

#### `ChildSubject` → `models/child_subject.py` (NEW)

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

#### `SlotClassSection` → `models/slot_class_section.py` (NEW)

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
        indexes = [
            models.Index(fields=["slot_id", "is_active", "removed"]),
        ]
```

#### `SlotClassSectionVolunteer` → `models/slot_class_section_volunteer.py` (NEW)

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

---

### Backend — Migrations

**Migration A** — depends on last M2 migration:

```
0_add_worknode_id_and_m3_schema.py
  AlterField: User.worknode_id (add IntegerField, null=True, db_index=True)
  CreateModel: PartnerWorknode
  CreateModel: Subject
  RunPython:   seed_subjects (Foundation Day 1, Foundation Day 2 under program_id=1)
  CreateModel: SchoolVolunteer
  CreateModel: Slot
```

**Migration B** — depends on Migration A:

```
0_add_slot_class_tables.py
  CreateModel: ClassSectionSubject
  CreateModel: ChildSubject
  CreateModel: SlotClassSection
  CreateModel: SlotClassSectionVolunteer
```

---

### Backend — Services

#### `services/rbac/scope.py` — EXTEND

Current `_classify()` returns `'admin'`, `'co'`, or `'none'`. Extend to also return
`'cho'`. All downstream functions branch on this new value.

```python
# _classify extension
CHO_ROLES = {"cho"}

def _classify(user):
    roles = {r.strip().lower() for r in (user.user_role or "").split(",")}
    if roles & ADMIN_ROLES or roles & CXO_ROLES:
        return "admin"
    if roles & CO_ROLES:
        return "co"
    if roles & CHO_ROLES:
        return "cho"
    return "none"
```

`schools_visible_to(user)` — add CHO branch:

```python
if kind == "cho":
    if user.worknode_id is None:
        return Partner.objects.none()
    partner_ids = (
        PartnerWorknode.objects
        .filter(worknode_id=user.worknode_id)
        .exclude(partner_id__isnull=True)
        .exclude(partner_id="")
        .values_list("partner_id", flat=True)
        .distinct()
    )
    if not partner_ids:
        return Partner.objects.none()
    return Partner.objects.filter(
        partner_id__in=list(partner_ids),
        is_active=True, removed=False,
    )
```

`can_modify_school(user, partner)` — CHO gets same CRUD as CO within their scope:

```python
if kind == "cho":
    return schools_visible_to(user).filter(partner_id=partner.partner_id).exists()
```

#### `services/sync.py` — EXTEND

Two additions:

1. In `_build_user_obj()`: map `worknode_id` field from Hasura payload.
2. New phase `_run_partner_worknode_phase(data)`:
   - Upsert `PartnerWorknode` rows by `partner_id` (one-to-one confirmed).
   - Delete (from local table) any `partner_id` values no longer in the Hasura payload.
3. Call `_run_partner_worknode_phase()` from `run_sync()`.

#### `services/volunteers/list.py` (NEW)

`list_school_volunteers(school_id, requesting_user) -> dict`

Full logic as specified in M3.md §F-M3-3. Returns one of:
- `{"status": "ok", "volunteers": [...]}`
- `{"status": "no_worknode", "message": "...", "volunteers": []}`
- `{"status": "no_volunteers", "message": "...", "volunteers": []}`

#### `services/slots/create.py` (NEW)

`create_slot(school_id, payload, user) -> Slot`

Enforces R7 (overlap), validates `start_time < end_time`, calls
`get_or_create_school_academic_year()`.

#### `services/slots/edit.py` (NEW)

`edit_slot(slot_id, payload, user) -> Slot`

R7 overlap check excludes self. Allowed even with active slot-classes.

#### `services/slots/delete.py` (NEW)

`soft_delete_slot(slot_id, user) -> Slot`

Blocks if `SlotClassSection.filter(slot_id=slot, is_active=True, removed=False).exists()`.
Returns 409 with `"Cannot delete this slot. Remove the N class assignments first."`.
Does NOT call `_reconcile_school_volunteer_for_volunteers`.

#### `services/slot_classes/create.py` (NEW)

`create_slot_class(slot_id, payload, user) -> SlotClassSection`

5-table atomic transaction. Full logic per M3.md §F-M3-7.
Also contains `_validate_volunteer_worknode_match()` and
`_reconcile_school_volunteer_for_volunteers()` helpers.

#### `services/slot_classes/edit.py` (NEW)

`edit_slot_class(scs_id, payload, user) -> SlotClassSection`

Three sub-flows: volunteer-only swap, section change (full cascade), subject change
(full cascade). Reuses `_reconcile_school_volunteer_for_volunteers()`.

#### `services/slot_classes/delete.py` (NEW)

`delete_slot_class(scs_id, user)`

Soft-deletes `SlotClassSectionVolunteer` rows, `ClassSectionSubject` row, and
`SlotClassSection` row in one transaction. Calls reconcile helper for each
affected volunteer.

#### `services/slot_classes/schedule.py` (NEW)

`get_school_schedule(school_id, requesting_user, day_of_week=None) -> dict`

Builds the full schedule dict using `prefetch_related` to avoid N+1. Response
shape as per M3.md §F-M3-9.

#### `services/children/enroll.py` — EXTEND

After the existing 5-table insert, add:

```python
# M3 extension: backfill ChildSubject for any active subjects on this section
active_subjects = ClassSectionSubject.objects.filter(
    class_section_id=section,
    is_active=True, removed=False,
)
if active_subjects.exists():
    ChildSubject.objects.bulk_create([
        ChildSubject(child_id=child, class_section_subject_id=css, created_by=user)
        for css in active_subjects
    ])
```

#### `services/children/edit.py` — EXTEND

When section changes: soft-delete old `ChildSubject` rows for old section,
create new ones for new section's active `ClassSectionSubject` rows.

#### `services/structure/sections.py` — EXTEND

In `soft_delete_section()`, before the existing children check, add:

```python
# M3 extension: block if active slot-classes reference this section
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

---

### Backend — Schemas (Pydantic v2)

Create `schemas/m3_schemas.py` (or split per domain):

```python
# Volunteers
class VolunteerCardSchema(Schema):
    user_id: int
    user_name: str
    user_role: str
    active_slot_class_count: int

class VolunteerListResponseSchema(Schema):
    status: str  # "ok" | "no_worknode" | "no_volunteers"
    message: str | None = None
    volunteers: list[VolunteerCardSchema]

# Slots
class SlotCreateSchema(Schema):
    slot_name: str
    day_of_week: str
    start_time: time
    end_time: time

class SlotUpdateSchema(Schema):
    slot_name: str | None = None
    day_of_week: str | None = None
    start_time: time | None = None
    end_time: time | None = None

class SlotReadSchema(Schema):
    slot_id: int
    slot_name: str
    day_of_week: str
    start_time: time
    end_time: time
    recurring: bool
    slot_class_count: int

# Slot-classes
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
    volunteer_1_id: int | None = None
    volunteer_2_id: int | None = None
    class_section_id: int | None = None
    subject_id: int | None = None
```

---

### Backend — API Endpoints

All routers added to the Ninja `api` instance in `api/__init__.py` (or equivalent).
New files:

#### `api/volunteers_api.py`

| Method | Path | Auth | RBAC | Description |
|---|---|---|---|---|
| GET | `/schools/{school_id}/volunteers/` | JWT | CO/admin/CHO (view scope) | List auto-populated volunteers |

#### `api/slots_api.py`

| Method | Path | Auth | RBAC | Description |
|---|---|---|---|---|
| GET | `/schools/{school_id}/slots/` | JWT | CO/admin/CHO (view scope) | List slots |
| POST | `/schools/{school_id}/slots/` | JWT | CO/admin/CHO (modify scope) | Create slot |
| PATCH | `/schools/{school_id}/slots/{slot_id}/` | JWT | CO/admin/CHO (modify scope) | Edit slot |
| DELETE | `/schools/{school_id}/slots/{slot_id}/` | JWT | CO/admin/CHO (modify scope) | Soft-delete slot |

#### `api/slot_classes_api.py`

| Method | Path | Auth | RBAC | Description |
|---|---|---|---|---|
| GET | `/schools/{school_id}/slots/{slot_id}/slot-classes/` | JWT | CO/admin/CHO (view scope) | List slot-classes |
| POST | `/schools/{school_id}/slots/{slot_id}/slot-classes/` | JWT | CO/admin/CHO (modify scope) | Create slot-class |
| PATCH | `/schools/{school_id}/slots/{slot_id}/slot-classes/{scs_id}/` | JWT | CO/admin/CHO (modify scope) | Edit slot-class |
| DELETE | `/schools/{school_id}/slots/{slot_id}/slot-classes/{scs_id}/` | JWT | CO/admin/CHO (modify scope) | Delete slot-class |

> CHO has full CRUD on slot-classes within their worknode-scoped schools. Confirmed: F-M3-4 criterion 10 is authoritative. F-M3-7 criterion 14 was incorrect and has been corrected in M3.md.

#### `api/schedule_api.py`

| Method | Path | Auth | RBAC | Description |
|---|---|---|---|---|
| GET | `/schools/{school_id}/schedule/` | JWT | CO/admin/CHO (view scope) | Full weekly schedule |

#### `api/auth_api.py` — EXTEND

| Method | Path | Auth | RBAC | Description |
|---|---|---|---|---|
| GET | `/auth/me/permissions/` | JWT | Any authenticated | Returns `{can_view, can_modify}` for a given `school_id` query param |

---

### Frontend

#### Tab activations (F-M3-1, F-M3-2)

In `SchoolDetailPage`, remove the "Coming soon" disabled treatment from Volunteers and Slots tabs. Wire each to its data component (built in subsequent features).

#### Volunteers tab (F-M3-3)

`VolunteerListTab` component:
- Calls `GET /schools/{id}/volunteers/`
- Renders `VolunteerCard` list (name, role, active slot-class count)
- Two empty states driven by `status` field in response
- No action buttons

#### CHO scope (F-M3-4)

`useUserCan(action, schoolId)` hook:
- Calls `GET /auth/me/permissions/?school_id={id}`
- Returns `{can_view, can_modify}`
- Used to conditionally render Add/Edit/Delete buttons throughout the app

`/schools` list page: detect `scope_warning.code == "no_worknode_mapping"` in
schools response and render the "not assigned" message instead of an empty list.

#### Slots tab (F-M3-2, F-M3-5, F-M3-6)

`SlotListTab` component:
- Calls `GET /schools/{id}/slots/`
- Groups by `day_of_week`
- `SlotCard` with three-dot menu (Edit / Delete)
- Add Slot modal (slot_name, day_of_week, start_time, end_time)
- Edit Slot modal (pre-populated)
- Delete confirmation modal (disabled state when active slot-classes exist)

#### Slot-class assignment (F-M3-7)

`SlotDetail` (expandable within SlotCard):
- Calls `GET /schools/{id}/slots/{slot_id}/slot-classes/`
- "Add Class to Slot" button → `AddSlotClassModal`
  - Section dropdown, Subject dropdown, Vol1 dropdown (required), Vol2 dropdown (optional)
  - Vol1 selection disabled in Vol2 dropdown
  - Volunteers already in this slot shown as disabled in dropdowns
  - R4 error: full-modal alert with school name

#### Schedule view (F-M3-9)

`ScheduleView` page at `/schools/{id}/schedule`:
- Calls `GET /schools/{id}/schedule/`
- Day-by-day expandable sections (Mon–Sun)
- Desktop: 7-day grid; Mobile: stacked
- Empty state per day

---

## Business Rules Enforced

| Rule | Feature | Enforcement point |
|---|---|---|
| R2: 1-2 volunteers per slot-class | F-M3-7 | Schema (Vol1 required, Vol2 optional) |
| R3: Vol1 ≠ Vol2 | F-M3-7 | Pydantic `model_validator` + service check |
| R4: Volunteer at exactly one school | F-M3-7 | Service layer, `SchoolVolunteer` check |
| R5: Section can't appear twice in slot | F-M3-7 | Service layer, `SlotClassSection` existence check |
| R6: Volunteer can't be in two slot-classes in same slot | F-M3-7 | Service layer, `SlotClassSectionVolunteer` check |
| R7: No overlapping slots same school same day | F-M3-5, F-M3-6 | Service layer, time-range overlap query |
| R9: No hard deletes | ALL | `on_delete=PROTECT` on all new FKs; soft-delete only |
| R13: Scope filtering default | ALL | All service queries go through `schools_visible_to()` |
| R16: Sync idempotency | F-M3-3 | Upsert on `partner_id` key; replay-safe |

---

## Security Review

| Endpoint | Auth required | RBAC check | Input validation | Data exposure risk |
|---|---|---|---|---|
| GET volunteers | JWT | `can_view_school` | school_id path param | Exposes user names + roles within school — acceptable |
| POST/PATCH/DELETE slots | JWT | `can_modify_school` | Pydantic schema | None beyond standard |
| POST/PATCH/DELETE slot-classes | JWT | `can_modify_school` | Pydantic + service validators (R3-R6) | Section/volunteer cross-school data in error messages — intentional |
| GET schedule | JWT | `can_view_school` | school_id path param | Schedule data is school-scoped — acceptable |
| GET permissions | JWT | Self only | school_id query param | Returns boolean only — safe |

**Notes:**
- R4 error message includes `other_school.partner_name`. This intentionally reveals that the volunteer is at another school. Considered acceptable — COs within MAD operate collaboratively. Flag if policy changes.
- `partner_worknode` data (city_name, co_name, etc.) must **never** be returned directly to the frontend in M3. Only `partner_id` and `worknode_id` are used internally.

---

## Testing Strategy

### Backend unit tests (service layer)

New test files:

```
tests/volunteers/test_list_volunteers.py          # 11 tests from spec
tests/slots/test_create_slot.py                   # 9 tests
tests/slots/test_edit_delete_slot.py              # 13 tests
tests/slot_classes/test_create_slot_class.py      # 14 tests
tests/slot_classes/test_edit_slot_class.py        # 3 tests
tests/slot_classes/test_delete_slot_class.py      # 2 tests
tests/schedule/test_schedule_validation.py        # 6 integration tests (R3-R7)
tests/schedule/test_schedule_view.py              # 8 tests
tests/rbac/test_cho_scope.py                      # 14 tests
tests/sync/test_worknode_sync.py                  # 3 tests
```

Extend existing test files:

```
tests/children/test_enroll_child.py     # add test_enroll_child_in_section_with_existing_subjects_creates_child_subjects
tests/children/test_edit_child.py       # add test_edit_child_section_updates_child_subjects
tests/structure/test_sections.py        # add section delete blocked by slot-class cases
```

### Backend integration tests (API layer)

One integration test per endpoint verifying RBAC:
- CO can access their school, 403 on other schools
- CHO can access their worknode-mapped school, 403 outside scope
- Admin can access any school

### Frontend tests

- `VolunteerListTab`: renders cards, renders empty states (no_worknode, no_volunteers)
- `SlotCard`: renders, three-dot opens edit/delete
- `AddSlotModal`: validation, 409 overlap error shown inline
- `AddSlotClassModal`: R4 error displayed as modal-level alert
- `useUserCan`: returns correct booleans, buttons conditionally rendered

### Manual verification steps (per feature)

1. Create a test user with `worknode_id` matching a `partner_worknode` row → open Volunteers tab → see them listed
2. Log in as CHO with valid worknode mapping → see assigned school in list
3. Log in as CHO with no worknode mapping → see "not assigned" message
4. Create overlapping slot → get 409 with existing slot name in message
5. Create slot-class → verify all 5 tables got rows in DB
6. Assign a volunteer to school A, then try assigning to school B slot-class → get R4 error with school A's name
7. Delete slot-class → verify school_volunteer soft-deleted when no more slot-classes remain
8. View schedule → verify all slots and slot-classes rendered, no N+1 DB queries (use Django Debug Toolbar or query count assertion)

---

## Implementation Order (Chunks)

### Chunk 1 — Schema foundation (Day 1)

Deliverables: clean migrations, models registered, Subject seeded, sync extended, tabs visually active but data-empty.

1. Create `models/partner_worknode.py`, `models/subject.py`, `models/school_volunteer.py`, `models/slot.py`
2. Add `worknode_id` to `models/user.py`
3. Register all in `models/__init__.py`
4. Write and run **Migration A**
5. Extend `services/sync.py`: `worknode_id` on user, `_run_partner_worknode_phase()`
6. Write sync tests (`test_worknode_sync.py`)
7. Frontend: remove "Coming soon" from Volunteers and Slots tabs (F-M3-1, F-M3-2 — visual only)

**Checkpoint:** `python manage.py migrate` clean on fresh DB. Subject rows exist. No app errors.

---

### Chunk 2 — Volunteer list + CHO scope (Days 2–4)

Deliverables: Volunteers tab shows real data; CHO can log in and see schools.

1. `services/volunteers/list.py` + tests
2. `api/volunteers_api.py` endpoint
3. Frontend: `VolunteerListTab` component with cards + empty states (F-M3-3)
4. Extend `services/rbac/scope.py` for CHO (`_classify`, `schools_visible_to`, `can_modify_school`)
5. Extend `services/auth_service.py` (or login path) to emit `scope_warning`
6. `api/auth_api.py` — `GET /auth/me/permissions/` endpoint
7. Frontend: `useUserCan` hook; "not assigned" empty state on `/schools` for CHO (F-M3-4)
8. Tests: `test_list_volunteers.py`, `test_cho_scope.py`

**Checkpoint:** CO opens Volunteers tab, sees volunteers. CHO logs in, sees their school.

---

### Chunk 3 — Slot CRUD (Day 5)

Deliverables: CO can create/edit/delete slots.

1. `services/slots/create.py`, `services/slots/edit.py`, `services/slots/delete.py`
2. `api/slots_api.py` (GET, POST, PATCH, DELETE)
3. Frontend: `SlotListTab`, `AddSlotModal`, `EditSlotModal`, delete confirmation (F-M3-5, F-M3-6)
4. Tests: `test_create_slot.py`, `test_edit_delete_slot.py`

**Checkpoint:** CO creates a slot, edits it, deletes it. Overlap blocked with R7 message.

---

### Chunk 4 — Slot-class tables + cascade (Days 6–9)

Deliverables: CO can compose a full slot-class; all business rules enforced; child enrollment and section delete extended.

1. Create `models/class_section_subject.py`, `models/child_subject.py`, `models/slot_class_section.py`, `models/slot_class_section_volunteer.py`
2. Register in `models/__init__.py`
3. Write and run **Migration B**
4. `services/slot_classes/create.py` (5-table transaction + helpers)
5. `services/slot_classes/edit.py`
6. `services/slot_classes/delete.py`
7. Extend `services/children/enroll.py` (ChildSubject backfill)
8. Extend `services/children/edit.py` (ChildSubject on section change)
9. Extend `services/structure/sections.py` (slot-class block on section delete)
10. `api/slot_classes_api.py`
11. Frontend: `SlotDetail`, `AddSlotClassModal` (F-M3-7)
12. Tests: all slot-class test files

**Checkpoint:** Create a full slot-class via API. Verify all 5 tables in DB. R3/R4/R5/R6 all return 409 with correct messages.

---

### Chunk 5 — Schedule view + stabilization (Days 10–13)

Deliverables: Schedule view renders; all integration tests pass; production deploy.

1. `services/slot_classes/schedule.py`
2. `api/schedule_api.py`
3. Frontend: `ScheduleView` page (F-M3-9)
4. Integration test suite for R3–R7 (`test_schedule_validation.py`)
5. Tests: `test_schedule_view.py`
6. Update `ARCHITECTURE.md` and `GLOSSARY.md` (CHO scope now `partner_worknode`, not `SchoolVolunteer`)
7. Production deploy: migrate, seed verify, smoke tests, Sentry watch

**Checkpoint:** Full schedule renders for a school with multiple slots. All M3 tests green.

---

## Resolved Questions

All five pre-build questions resolved 2026-05-21.

### Q1 — CHO slot-class permissions ✅ RESOLVED

**F-M3-4 is authoritative.** CHO can create/edit/delete slot-classes within their
worknode-scoped schools. F-M3-7 criterion 14 ("CHO cannot create slot-classes") was
incorrect — corrected in M3.md. Both spec and plan endpoint tables now say
`CO/admin/CHO (modify scope)` for all slot-class write operations.

### Q2 — `get_or_create_school_academic_year` ✅ RESOLVED

The helper exists at `services/academic_year/queries.py`. Import and call it from
`create_slot()` and `create_slot_class()` — no need to write it.

### Q3 — Sync file path ✅ RESOLVED

Extend `services/sync.py` in place. No rename.

### Q4 — User display fields ✅ RESOLVED

Use `user_display_name` and `user_login`. The volunteer card schema becomes:

```python
class VolunteerCardSchema(Schema):
    user_id: int
    user_display_name: str
    user_login: str
    user_role: str
    active_slot_class_count: int
```

Update `list_school_volunteers()` serialization accordingly:

```python
serialized.append({
    "user_id": v.user_id,
    "user_display_name": v.user_display_name,
    "user_login": v.user_login,
    "user_role": v.user_role,
    "active_slot_class_count": active_slot_class_count,
})
```

### Q5 — Hasura `partner_worknode` payload ✅ RESOLVED

**Endpoint:** `GET https://hasura.makeadiff.in/api/rest/chapter_mapping?chapter_validation=true`

**Response root key:** `prod_external_apps_chapter_mapping` (list of objects)

**Field mapping — Hasura → model:**

| Hasura field | Model field | Notes |
|---|---|---|
| `chapter_id` | `partner_id` | **Upsert key.** String, e.g. `"281"` |
| `worknode_id` | `worknode_id` | Integer |
| `city_name` | `city_name` | |
| `state` | `state` | |
| `co_name` | `co_name` | |
| `chapter_name` | `chapter_name` | |
| `engine` | `engine` | |
| `chapter_status` | `chapter_status` | |
| `sourcing_campaign_code` | `sourcing_campaign_code` | |
| `campaign_name` | `campaign_name` | |
| `fundraiser_id` | `fundraiser_id` | |
| `fundraiser_name` | `fundraiser_name` | |

**Fields in Hasura payload NOT stored in model (ignore during sync):**
`chapter_validation`, `cho_id`, `cho_name`, `co_id`

**Sync phase implementation sketch:**

```python
def _run_partner_worknode_phase(data: list[dict]):
    """Upsert partner_worknode rows. Key: partner_id (from chapter_id)."""
    rows = data  # already the list from prod_external_apps_chapter_mapping

    incoming_partner_ids = set()
    for row in rows:
        partner_id = str(row["chapter_id"])
        incoming_partner_ids.add(partner_id)
        PartnerWorknode.objects.update_or_create(
            partner_id=partner_id,
            defaults={
                "worknode_id":            row["worknode_id"],
                "city_name":              row.get("city_name"),
                "state":                  row.get("state"),
                "co_name":                row.get("co_name"),
                "chapter_name":           row.get("chapter_name"),
                "engine":                 row.get("engine"),
                "chapter_status":         row.get("chapter_status"),
                "sourcing_campaign_code": row.get("sourcing_campaign_code"),
                "campaign_name":          row.get("campaign_name"),
                "fundraiser_id":          row.get("fundraiser_id"),
                "fundraiser_name":        row.get("fundraiser_name"),
            },
        )

    # Remove rows no longer in Hasura
    PartnerWorknode.objects.exclude(
        partner_id__in=incoming_partner_ids
    ).delete()
```

Note: `PartnerWorknode` has no soft-delete — it's a sync mirror, so hard-delete on
removal is correct here (the only exception to R9 for this table).
