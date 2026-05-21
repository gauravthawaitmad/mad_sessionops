# Feature Plan: F-M3-5 — Slot Creation

## Overview

CO can create weekly recurring slots at a school (e.g., "Monday 11-12 AM"). A slot is a pure time-pattern container — it does not know about specific dates (that's M4). Each slot has a name, day of week, start/end time, and always has `recurring=True` in M3. Business rule R7 (no overlapping slots same school same day) is enforced on create.

This feature also introduces three new models defined together for M3 schema cohesion: `Subject` (universal catalog, seeded), `SchoolVolunteer` (implicit-only table), and `Slot` itself.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | 3 NEW | `Subject`, `SchoolVolunteer`, `Slot` |
| Backend services | 1 NEW | `services/slots/create.py` |
| Backend API endpoints | 2 NEW routes | `GET` + `POST /api/schools/{id}/slots/` |
| Frontend pages | Modified | `SlotListTab.tsx` with Add Slot modal |
| Frontend components | 2 NEW | `SlotCard.tsx`, `AddSlotModal.tsx` |
| Database migrations | Yes | Migration A: Subject + seed + SchoolVolunteer + Slot |
| Celery tasks | No | — |
| Existing tests | None | — |
| Documentation | None | — |

## High-Level Design

### Data flow

```
CO clicks "Add Slot"
  → AddSlotModal (slot_name, day_of_week, start_time, end_time)
  → POST /api/schools/{school_id}/slots/
  → create_slot(school_id, payload, user)
      → can_user_modify_school() check
      → validate start_time < end_time
      → R7: check time overlap for (school, day_of_week)
      → get_or_create_school_academic_year(school_id, user)
      → Slot.objects.create(...)
  ← slot_id + full slot payload
Slot appears in list grouped by day_of_week
```

## Low-Level Design

### Backend — Models

All three models go in Migration A together with F-M3-3 schema additions (User.worknode_id + PartnerWorknode).

#### `Subject` → `models/subject.py`

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

No `is_active`/`removed` — universal catalog like Class. Seeded in migration:
- `subject_name="Foundation Day 1", program_id=1`
- `subject_name="Foundation Day 2", program_id=1`

#### `SchoolVolunteer` → `models/school_volunteer.py`

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

Defined here for schema completeness. Only written by F-M3-7 (slot-class create).

#### `Slot` → `models/slot.py`

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

### Backend — Service

#### `services/slots/create.py`

```python
@transaction.atomic
def create_slot(school_id, payload, user):
    if not can_user_modify_school(user, school_id):
        raise PermissionDenied()

    if payload["start_time"] >= payload["end_time"]:
        raise ValidationError("start_time must be before end_time")

    # R7: no overlapping slots same school same day
    overlapping = Slot.objects.filter(
        school_id=school_id,
        day_of_week=payload["day_of_week"],
        is_active=True,
        removed=False,
    ).filter(
        Q(start_time__lt=payload["end_time"]) &
        Q(end_time__gt=payload["start_time"])
    ).first()

    if overlapping:
        raise ConflictError(
            f"This time overlaps with existing slot '{overlapping.slot_name}' "
            f"({overlapping.start_time}–{overlapping.end_time})."
        )

    say = get_or_create_school_academic_year(school_id, user)

    return Slot.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        slot_name=payload["slot_name"],
        day_of_week=payload["day_of_week"],
        start_time=payload["start_time"],
        end_time=payload["end_time"],
        recurring=True,
        created_by=user,
    )
```

`get_or_create_school_academic_year` is imported from `services/academic_year/queries.py` (confirmed exists).

### Backend — Schemas

```python
class SlotCreateSchema(Schema):
    slot_name: str
    day_of_week: Literal["monday","tuesday","wednesday","thursday",
                          "friday","saturday","sunday"]
    start_time: time
    end_time: time

class SlotReadSchema(Schema):
    slot_id: int
    slot_name: str
    day_of_week: str
    start_time: time
    end_time: time
    recurring: bool
    slot_class_count: int
```

### Backend — Endpoints

**`api/slots_api.py`** (NEW — only GET + POST for this feature; PATCH + DELETE in F-M3-6)

| Method | Path | Auth | RBAC | Description |
|---|---|---|---|---|
| GET | `/schools/{school_id}/slots/` | JWT | `can_view_school` | List active slots |
| POST | `/schools/{school_id}/slots/` | JWT | `can_modify_school` | Create slot |

GET response: list of `SlotReadSchema` ordered by day_of_week sort order then start_time.
POST errors: 400 (invalid times), 403 (scope), 409 (overlap with slot name in message).

### Frontend

**`SlotListTab.tsx`** (NEW):
- Calls `GET /schools/{schoolId}/slots/`
- Groups by `day_of_week` (Monday → Sunday order)
- "Add Slot" button (shown when `userCan('modify_school', schoolId)`)
- Empty state: "No slots configured yet. Click 'Add Slot' to create one."

**`AddSlotModal.tsx`** (NEW):
- Fields: Slot name (text), Day of week (select), Start time (time), End time (time)
- Client-side: start_time < end_time validation before submit
- On 409: inline error showing the conflicting slot name and time

**`SlotCard.tsx`** (NEW — basic version; three-dot menu added in F-M3-6):
- Shows: slot_name, day_of_week, time range, slot-class count
- Three-dot menu placeholder (edit/delete wired in F-M3-6)

## Business Rules Enforced

| Rule | Enforcement |
|---|---|
| R7 — No overlapping slots same school same day | `create_slot` service, time-range overlap query |
| start_time < end_time | Service validation + client-side form validation |
| `recurring=True` always | Hardcoded in `create_slot`; no toggle exposed |

## Security Review

- POST requires `can_modify_school(user, school_id)` — CO scoped to own schools, CHO to worknode-mapped schools
- `school_id` in path validated against user's scope before any DB write
- `start_time`/`end_time` are time fields — no injection risk; Pydantic validates type

## Testing Strategy

**Backend unit tests** (`tests/slots/test_create_slot.py`):
- `test_create_slot_succeeds`
- `test_create_slot_recurring_always_true`
- `test_create_overlapping_slot_returns_409`
- `test_create_slot_start_after_end_returns_400`
- `test_create_slot_creates_school_academic_year_if_missing`
- `test_co_cannot_create_slot_in_other_school`
- `test_cho_cannot_create_slot` ← Note: this is for CHO outside scope; CHO inside scope CAN create
- `test_admin_can_create_slot_in_any_school`
- `test_list_slots_ordered_by_day_and_time`

**Manual verification:**
- [ ] Create slot with valid data → appears in list grouped by day
- [ ] Create overlapping slot → 409 with existing slot name and time in message
- [ ] Create slot with end_time before start_time → 400
- [ ] Verify `recurring=True` in DB

## Implementation Order

**Chunk 1 — Models + migration:**
1. Create `models/subject.py`, `models/school_volunteer.py`, `models/slot.py`
2. Register all in `models/__init__.py`
3. Write Migration A (with seed for Subject)
4. Run migration

**Chunk 2 — Service + endpoint:**
1. Write `services/slots/create.py`
2. Write `api/slots_api.py` (GET + POST)
3. Write `test_create_slot.py`

**Chunk 3 — Frontend:**
1. Build `SlotCard.tsx`
2. Build `AddSlotModal.tsx`
3. Build `SlotListTab.tsx`
4. Activate Slots tab (F-M3-2)

**Dependency:** F-M3-3 Migration A must run before this (both use the same migration file).

## Open Questions

None. All resolved.
