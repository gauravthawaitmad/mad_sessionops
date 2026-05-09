# Feature Plan: F-M2-6 — Children List & Enrollment

## Overview

Build all 6 child-related models (`Child`, `ChildClass`, `ChildClassSection`, `BatchChild`, `ChildProgram`, `ChildRemovalLog`), the enrollment service (5-table atomic insert), and the Children tab UI with the "Enroll Child" modal. A CO sees active children at their school and can enroll new ones. All 5 history tables are populated in a single `transaction.atomic` block.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | 6 NEW | `Child`, `ChildClass`, `ChildClassSection`, `BatchChild`, `ChildProgram`, `ChildRemovalLog` |
| Backend services | 2 NEW modules | `services/children/enroll.py`, `services/children/queries.py` |
| Backend API endpoints | 1 NEW router | `api/children_api.py` (GET list + POST enroll) |
| Backend schemas | 1 NEW file | `schemas/children.py` |
| Backend migrations | Yes | Part of single M2 migration |
| Frontend components | 2 NEW | `ChildrenTab.tsx`, `EnrollChildModal.tsx` |
| Frontend services | Modified | `children.service.ts` — list + enroll calls |
| Celery tasks | No | — |
| Existing tests | None broken | — |
| Documentation | None | — |

## High-Level Design

### Data flow — CO enrolls a child

```
CO clicks "Enroll Child" → EnrollChildModal opens
  → Modal fetches GET /api/schools/{schoolId}/classes/ (class options)
  → CO picks class → dropdown fetches sections under that class
  → CO fills form (required: first_name, last_name, gender, age, class_section_id)
  → POST /api/schools/{schoolId}/children/ {first_name, last_name, gender, age,
                                            class_section_id, ...optional fields}
    → enroll_child(school_id, payload, user):
        transaction.atomic()
          1. select_for_update: lock ClassSection row
          2. count active ChildClassSection for section → R1 (max 5) → 409 if full
          3. count active BatchChild for school → school cap → 409 if at limit
          4. validate section.school_id == school_id
          5. get SchoolAcademicYear (must exist — section implies SAY)
          6. INSERT Child
          7. INSERT ChildClass (school_class_id from section.school_class_id)
          8. INSERT ChildClassSection
          9. INSERT BatchChild (school_academic_year_id, school_id)
          10. INSERT ChildProgram (program_id=1)
  → 201 ChildOut
  → New child row appears in table
```

### Data flow — CO views children list

```
CO opens Children tab
  → GET /api/schools/{schoolId}/children/?status=active
  → list_children(school_id, status="active"):
      Child queryset: is_active=True, removed=False
      Annotated with current section/class via ChildClassSection join
  → Renders table: Name, Class, Section, Age, Gender, Status, Actions
```

### Key architectural decisions

- All 5 inserts happen in one `transaction.atomic` — if any fails, all roll back. No partial enrollment.
- `program_id=1` (Foundation Program) is hardcoded in the enrollment service for M2.
- `ChildRemovalLog` model is defined here (model lives in `child.py`) but its write logic is in F-M2-8.
- `ChildProgram` uses `get_or_create`-style uniqueness; `ChildClass` and `ChildClassSection` are history tables — new rows created on each enrollment (not upserted).

## Low-Level Design

### Backend

#### Models (`sessionops/models/child.py`)

Full model definitions in `M2-implementation-plan.md`. Key points:

- `Child`: `first_name`, `last_name`, `gender` are required. `age`, `city`, `mother_tongue`, `date_of_birth`, `date_of_enrollment`, `mad_joining_date` are optional.
- `ChildRemovalLog`: defined here; `is_active=True` means "this removal is current state." Full dual-flag soft-delete pattern.

#### Schemas (`schemas/children.py`)

```python
class ChildEnrollIn(Schema):
    first_name:         str
    last_name:          str
    gender:             Literal["male", "female", "other"]
    age:                int
    class_section_id:   int
    date_of_birth:      date | None = None
    city:               str | None = None
    mother_tongue:      str | None = None
    date_of_enrollment: date | None = None
    mad_joining_date:   date | None = None

class ChildOut(Schema):
    child_id:             int
    first_name:           str
    last_name:            str
    gender:               str
    age:                  int | None
    city:                 str | None
    mother_tongue:        str | None
    date_of_birth:        date | None
    is_active:            bool
    current_class_name:   str  # computed from active ChildClass → SchoolClass → Class
    current_section_name: str  # computed from active ChildClassSection → ClassSection.section_name
```

#### Services

**`services/children/enroll.py`**

```python
FOUNDATION_PROGRAM_ID = 1
MAX_CHILDREN_PER_SECTION = 5

def enroll_child(school_id: int, payload: ChildEnrollIn, user: User) -> Child:
    with transaction.atomic():
        # 1. Lock section
        section = (ClassSection.objects
                   .select_for_update()
                   .get(class_section_id=payload.class_section_id,
                        is_active=True, removed=False))

        # 2. Section capacity check
        current_count = ChildClassSection.objects.filter(
            class_section_id=section, is_active=True, removed=False
        ).count()
        if current_count >= MAX_CHILDREN_PER_SECTION:
            raise ConflictError(f"Section is full ({MAX_CHILDREN_PER_SECTION}/{MAX_CHILDREN_PER_SECTION}).")

        # 3. School capacity check
        partner = Partner.objects.get(partner_id=school_id)
        if partner.confirmed_child_count is not None:
            active_count = BatchChild.objects.filter(
                school_id=school_id, is_active=True, removed=False
            ).count()
            if active_count >= partner.confirmed_child_count:
                raise ConflictError("School has reached its confirmed child limit.")

        # 4. Cross-school validation
        if section.school_id != school_id:
            raise ValidationError("Section does not belong to this school.")

        # 5. Get SAY (must exist if section exists)
        say = SchoolAcademicYear.objects.get(
            school_id=school_id, is_active=True, removed=False
        )

        # 6-10. Inserts
        child = Child.objects.create(
            school_id=school_id,
            first_name=payload.first_name,
            last_name=payload.last_name,
            gender=payload.gender,
            age=payload.age,
            city=payload.city,
            mother_tongue=payload.mother_tongue,
            date_of_birth=payload.date_of_birth,
            date_of_enrollment=payload.date_of_enrollment,
            mad_joining_date=payload.mad_joining_date,
            created_by=user,
        )
        ChildClass.objects.create(
            child_id=child, school_class_id=section.school_class_id, created_by=user
        )
        ChildClassSection.objects.create(
            child_id=child, class_section_id=section, created_by=user
        )
        BatchChild.objects.create(
            school_academic_year_id=say, child_id=child,
            school_id=school_id, created_by=user
        )
        ChildProgram.objects.create(
            program_id_id=FOUNDATION_PROGRAM_ID, child_id=child, created_by=user
        )
    return child
```

**`services/children/queries.py`**

```python
def list_children(
    school_id: int,
    *,
    section_id: int | None = None,
    class_id: int | None = None,
    status: str = "active",
    search: str | None = None,
) -> QuerySet:
    qs = Child.objects.filter(school_id=school_id)

    if status == "active":
        qs = qs.filter(is_active=True, removed=False)
    elif status == "inactive":
        qs = qs.filter(is_active=False, removed=True)
    # status == "all" → no filter

    # Annotate current section/class via active ChildClassSection join
    qs = qs.annotate(
        current_section_id=Subquery(
            ChildClassSection.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("class_section_id")[:1]
        ),
        current_class_section_name=Subquery(
            ChildClassSection.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("class_section_id__section_name")[:1]
        ),
        current_school_class_id=Subquery(
            ChildClass.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("school_class_id")[:1]
        ),
    )

    if section_id:
        qs = qs.filter(current_section_id=section_id)
    if class_id:
        qs = qs.filter(current_school_class_id=class_id)
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search)
        )

    return qs.order_by("first_name", "last_name")
```

#### API (`api/children_api.py` — list + enroll)

```python
children_router = Router()

@children_router.get("/{school_id}/children/", response=list[ChildOut])
def list_children_view(request, school_id: int,
                       section_id: int = None, class_id: int = None,
                       status: str = "active", search: str = None):
    get_school_or_403(request.auth, school_id)
    return list_children(school_id, section_id=section_id, class_id=class_id,
                         status=status, search=search)

@children_router.post("/{school_id}/children/", response={201: ChildOut})
def enroll_child_view(request, school_id: int, payload: ChildEnrollIn):
    get_school_or_403(request.auth, school_id)
    return 201, enroll_child(school_id, payload, request.auth)
```

### Frontend

#### `components/schools/children/ChildrenTab.tsx` — new (`'use client'`)

```tsx
// Props: { schoolId: number }
// State: children list, filters (status, classId, sectionId, search), enrollModalOpen
// Fetches: GET /api/schools/{schoolId}/children/ with filter params
// Renders:
//   - Header: "Children" title, count badge, "Enroll Child" button
//   - Filters bar: status pills, class dropdown, section dropdown, search input (F-M2-10)
//   - Table: Name | Class | Section | Age | Gender | Status | Actions
//   - Per-row actions: Edit / Deactivate / Reactivate (context-dependent)
//   - Empty state: "No children enrolled yet"
```

#### `components/schools/children/EnrollChildModal.tsx` — new

```tsx
// Required fields: first_name, last_name, gender (select), age (number), class (select), section (select)
// Optional fields: date_of_birth, city, mother_tongue, date_of_enrollment, mad_joining_date
//
// Class dropdown: GET /api/schools/{schoolId}/classes/ → list of SchoolClass
// Section dropdown: GET /api/schools/{schoolId}/classes/{schoolClassId}/sections/
//   Cascades from class selection; sections at 5/5 show "(Full)" and are disabled
//
// School cap banner: shown if school is at confirmed_child_count (API returns 409 on enroll;
//   alternatively fetch partner info to show proactively — check spec behavior)
//
// Submit: POST /api/schools/{schoolId}/children/
// 201 → close, refresh list, success toast
// 409 section full → inline "This section is full (5/5)"
// 409 school cap → inline "School has reached its enrolled child limit"
```

#### Form validation (Zod)

```typescript
const enrollSchema = z.object({
  first_name:   z.string().min(1),
  last_name:    z.string().min(1),
  gender:       z.enum(["male", "female", "other"]),
  age:          z.number().int().positive(),
  class_section_id: z.number().positive(),
  date_of_birth:    z.string().optional(),
  city:             z.string().optional(),
  mother_tongue:    z.string().optional(),
  date_of_enrollment: z.string().optional(),
  mad_joining_date:   z.string().optional(),
})
```

## Business Rules Enforced

| Rule | Enforcement |
|------|------------|
| R1 — Max 5 children per section | `enroll_child`: `select_for_update` on ClassSection + count check → 409 |
| School `confirmed_child_count` cap | `enroll_child`: count active `BatchChild` vs. cap; `null` = unlimited |
| Cross-school enrollment blocked | `section.school_id == school_id` check in service → 400 |
| CO cannot enroll in another school | `get_school_or_403` → 403 |
| All 5 inserts atomic | `transaction.atomic` — any failure rolls back all |
| Foundation Program auto-assigned | `program_id=1` hardcoded in service |

## Security Review

- All endpoints require JWT
- `get_school_or_403` on both GET and POST — CO cannot list or enroll in other schools
- `class_section_id` cross-school check: service validates `section.school_id == school_id` — prevents a CO from enrolling a child into a section from a different school by supplying a valid `class_section_id` from another school
- Response shape (`ChildOut`) does not expose `created_by` or internal FK IDs beyond what's needed

## Testing Strategy

**Backend (`test_f_m2_6_10_children.py` — enrollment portion):**
- `test_enroll_child_creates_all_five_rows` — all 5 tables have new rows
- `test_enroll_child_assigns_program_id_1`
- `test_enroll_child_runs_in_single_transaction` — simulate DB error mid-transaction; verify rollback
- `test_enroll_child_blocked_at_section_limit` — 409 after 5 children
- `test_enroll_child_blocked_at_school_confirmed_limit` — 409
- `test_enroll_child_unlimited_when_confirmed_child_count_null` — succeeds
- `test_enroll_child_with_section_from_other_school_returns_400`
- `test_co_cannot_enroll_in_other_school` — 403
- `test_admin_can_enroll_in_any_school` — 201
- `test_required_fields_enforced` — 422 on missing first_name/last_name/gender/age/class_section_id

**Manual verification:**
- [ ] CO enrolls child → all 5 DB rows created
- [ ] Child appears in table immediately
- [ ] Enroll 5 children in same section → 5th succeeds
- [ ] Enroll 6th → 409 blocked
- [ ] Section at 5/5 shows "(Full)" and is disabled in dropdown
- [ ] CO tries to enroll in another school → 403
- [ ] Optional fields can be left empty → 201

## Implementation Order

**Chunk 1 — Models**
- Create `child.py` with all 6 models
- Update `models/__init__.py`
- Included in single M2 migration

**Chunk 2 — Services + API**
- Create `services/children/enroll.py` and `queries.py`
- Create `api/children_api.py` (GET + POST only)
- Smoke test enrollment via Swagger

**Chunk 3 — Frontend**
- Create `ChildrenTab.tsx` (table + empty state; filters are F-M2-10)
- Create `EnrollChildModal.tsx`
- Update `children.service.ts`

## Open Questions

None. All resolved:
- Child required fields: `first_name`, `last_name`, `gender`, `age`, `class_section_id`
- Optional fields: `date_of_birth`, `city`, `mother_tongue`, `date_of_enrollment`, `mad_joining_date`
- Foundation Program hardcoded as `program_id=1`
