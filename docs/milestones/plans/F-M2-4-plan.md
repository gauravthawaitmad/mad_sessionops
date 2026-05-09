# Feature Plan: F-M2-4 — Classes

## Overview

Build the `Program`, `Class`, and `SchoolClass` models. Seed "Foundation Program" and the 4-class catalog (5th–8th). Expose endpoints for a CO to add/list/remove classes from their school. Each addition auto-creates a `SchoolAcademicYear` (via F-M2-3) and a `SchoolClass` record. Build the Structure tab frontend with class cards and the Add Class modal.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | 3 NEW | `Program`, `Class`, `SchoolClass` |
| Backend services | 1 NEW module | `services/structure/queries.py` |
| Backend API endpoints | 2 NEW routers | Classes catalog + school-scoped class endpoints |
| Backend schemas | 1 NEW file | `schemas/structure.py` (partial — class schemas) |
| Backend migrations | Yes | Part of single M2 migration |
| Frontend components | 3 NEW | `StructureTab`, `AddClassModal`, class card |
| Frontend pages | Modified | `SchoolDetailPage.tsx` — activates Structure tab (F-M2-1 connects this) |
| Celery tasks | No | — |
| Existing tests | None broken | — |
| Documentation | None | — |

## High-Level Design

### Data flow — CO adds a class

```
CO clicks "Add Class" → AddClassModal opens
  → Modal fetches GET /api/classes/ (global catalog)
  → CO selects "5th" from dropdown
  → POST /api/schools/{schoolId}/classes/ {class_id: 1}
    → add_class_to_school(school_id, class_id, user):
        1. get_school_or_403(user, school_id) — RBAC
        2. get_or_create_school_academic_year(school_id, user) — creates SAY if first class
        3. SchoolClass.objects.create(school_id, school_academic_year_id, class_id)
           → DB constraint raises IntegrityError on duplicate → ConflictError (409)
  → 201 SchoolClassOut
  → Modal closes, class card appears in list
```

### Data flow — CO removes a class

```
CO clicks three-dot menu → "Remove class" → confirmation dialog
  → DELETE /api/schools/{schoolId}/classes/{schoolClassId}/
    → soft_delete_school_class(school_class_id, school_id, user):
        1. RBAC check
        2. Check active ClassSection rows → ConflictError (409) if any exist
        3. Set is_active=False, removed=True, deleted_at=now on SchoolClass
  → Class card disappears from list
```

### Key architectural decisions

- Class catalog is global (~4 rows in M2, can grow). COs pick from it; they don't create classes.
- `SchoolClass` uniqueness: same class cannot be added twice to same school in same academic year (DB constraint).
- `Program` exists as a real table (not a string field) for future flexibility. CO never sees it directly — it's visible as a subtitle on class cards ("Foundation Program").

## Low-Level Design

### Backend

#### Models

**`sessionops/models/program.py`**
```python
class Program(models.Model):
    program_id   = BigAutoField(primary_key=True)
    program_name = CharField(max_length=100, unique=True)
    is_active    = BooleanField(default=True)
    removed      = BooleanField(default=False)
    deleted_at   = DateTimeField(null=True, blank=True)
    created_at   = DateTimeField(auto_now_add=True)
    updated_at   = DateTimeField(auto_now=True)
    created_by   = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")
    updated_by   = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")
    class Meta:
        db_table = "program"
```

**`sessionops/models/grade_class.py`** (file named to avoid Python `class` keyword collision)
```python
class Class(models.Model):
    class_id    = BigAutoField(primary_key=True)
    class_name  = CharField(max_length=20)         # "5th"
    class_code  = CharField(max_length=4, unique=True)  # "5"
    program_id  = ForeignKey(Program, on_delete=PROTECT)
    is_active   = BooleanField(default=True)
    removed     = BooleanField(default=False)
    deleted_at  = DateTimeField(null=True, blank=True)
    created_at  = DateTimeField(auto_now_add=True)
    updated_at  = DateTimeField(auto_now=True)
    created_by  = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")
    updated_by  = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")
    class Meta:
        db_table = "class"
        ordering = ["class_code"]

class SchoolClass(models.Model):
    school_class_id         = BigAutoField(primary_key=True)
    school_id               = BigIntegerField(db_index=True)
    school_academic_year_id = ForeignKey(SchoolAcademicYear, on_delete=PROTECT)
    class_id                = ForeignKey(Class, on_delete=PROTECT, db_column="class_id")
    # db_column="class_id" → DB column is "class_id"; Python FK object is .class_id; int is .class_id_id
    is_active               = BooleanField(default=True)
    removed                 = BooleanField(default=False)
    deleted_at              = DateTimeField(null=True, blank=True)
    created_at              = DateTimeField(auto_now_add=True)
    updated_at              = DateTimeField(auto_now=True)
    created_by              = ForeignKey(User, on_delete=PROTECT, related_name="+")
    updated_by              = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")
    class Meta:
        db_table = "school_class"
        constraints = [UniqueConstraint(
            fields=["school_id", "school_academic_year_id", "class_id"],
            condition=Q(removed=False),
            name="uniq_school_class_per_year",
        )]
```

#### Schemas (`schemas/structure.py` — class portion)

```python
class ClassCatalogItemOut(Schema):
    class_id: int
    class_name: str
    class_code: str
    program_name: str  # from class_id.program_id.program_name

class SchoolClassOut(Schema):
    school_class_id: int
    class_id: int
    class_name: str
    program_name: str
    sections_count: int  # annotated count of active ClassSection rows

class ClassAddIn(Schema):
    class_id: int
```

#### Services (`services/structure/queries.py`)

```python
def list_classes_for_school(school_id: int) -> QuerySet[SchoolClass]:
    return (
        SchoolClass.objects
        .filter(school_id=school_id, is_active=True, removed=False)
        .select_related("class_id", "class_id__program_id")
        .annotate(sections_count=Count("class_id__classsection",
                                       filter=Q(classsection__is_active=True,
                                                classsection__removed=False)))
    )
    # Note: adjust related field names to match actual model attr names

def add_class_to_school(school_id: int, class_id: int, user: User) -> SchoolClass:
    from sessionops.services.academic_year.queries import get_or_create_school_academic_year
    say = get_or_create_school_academic_year(school_id, user)
    try:
        return SchoolClass.objects.create(
            school_id=school_id,
            school_academic_year_id=say,
            class_id_id=class_id,  # integer FK
            created_by=user,
        )
    except IntegrityError:
        raise ConflictError("This class is already added to this school for the current year.")

def soft_delete_school_class(school_class_id: int, school_id: int, user: User) -> None:
    sc = get_object_or_404(SchoolClass, school_class_id=school_class_id, school_id=school_id,
                           is_active=True, removed=False)
    active_sections = ClassSection.objects.filter(
        school_class_id=sc, is_active=True, removed=False
    ).count()
    if active_sections > 0:
        raise ConflictError(f"Cannot remove class: {active_sections} active section(s) exist.")
    now = timezone.now()
    sc.is_active = False
    sc.removed = True
    sc.deleted_at = now
    sc.updated_by = user
    sc.save()
```

#### API (`api/structure_api.py`)

Two routers exported:

**`classes_catalog_router`** — prefix `/api/classes/`

```python
@classes_catalog_router.get("/", response=list[ClassCatalogItemOut], auth=None)
def list_class_catalog(request):
    return Class.objects.filter(is_active=True, removed=False).select_related("program_id")

@classes_catalog_router.get("/section-codes/", auth=None)
def list_section_codes(request):
    return {"codes": SECTION_CODES}
```

**`structure_router`** — prefix `/api/schools/`

```python
@structure_router.get("/{school_id}/classes/", response=list[SchoolClassOut])
def list_school_classes(request, school_id: int):
    get_school_or_403(request.auth, school_id)
    return list_classes_for_school(school_id)

@structure_router.post("/{school_id}/classes/", response={201: SchoolClassOut})
def add_class(request, school_id: int, payload: ClassAddIn):
    get_school_or_403(request.auth, school_id)
    return 201, add_class_to_school(school_id, payload.class_id, request.auth)

@structure_router.delete("/{school_id}/classes/{school_class_id}/", response={204: None})
def remove_class(request, school_id: int, school_class_id: int):
    get_school_or_403(request.auth, school_id)
    soft_delete_school_class(school_class_id, school_id, request.auth)
    return 204, None
```

#### Migrations

Part of the single M2 migration. After creating all model files, run `just makemigrations sessionops`. Verify the generated migration includes `Program`, `Class`, `SchoolClass` with the unique constraint.

#### Seed data (management command)

```python
program, _ = Program.objects.get_or_create(program_name="Foundation Program",
                                             defaults={"created_by": system_user})
for name, code in [("5th","5"), ("6th","6"), ("7th","7"), ("8th","8")]:
    Class.objects.get_or_create(class_code=code,
                                defaults={"class_name": name, "program_id": program,
                                          "created_by": system_user})
```

### Frontend

#### `components/schools/structure/StructureTab.tsx` — new (`'use client'`)

```tsx
// Props: { schoolId: number }
// State: classes list (local), expandedClassId (local)
// On mount: GET /api/schools/{schoolId}/classes/
// Renders:
//   - Header: "Structure" + "Add Class" button
//   - If empty: empty state + "Add Class" button
//   - Class cards: class name, "Foundation Program" subtitle, sections_count badge,
//                  "Add Section" button, three-dot menu (Remove class)
//   - Clicking card: expand to reveal sections (F-M2-5 handles sections inline)
```

#### `components/schools/structure/AddClassModal.tsx` — new

```tsx
// Fetches GET /api/classes/ on open
// Dropdown: class options (label: class_name, value: class_id)
//   Filters out classes already added (from parent's class list)
// Submit: POST /api/schools/{schoolId}/classes/
// 201 → close, refresh, success toast
// 409 → inline error: "This class is already added to this school"
```

#### API integration (`lib/api/services/structure.service.ts`)

```typescript
export const listSchoolClasses = (schoolId: number) =>
  apiClient.get(`/api/schools/${schoolId}/classes/`)

export const addClassToSchool = (schoolId: number, classId: number) =>
  apiClient.post(`/api/schools/${schoolId}/classes/`, { class_id: classId })

export const removeSchoolClass = (schoolId: number, schoolClassId: number) =>
  apiClient.delete(`/api/schools/${schoolId}/classes/${schoolClassId}/`)

export const listClassCatalog = () =>
  apiClient.get(`/api/classes/`)
```

#### State management

Local component state only. No Redux slices needed.

#### Form validation (Zod)

```typescript
const classAddSchema = z.object({
  class_id: z.number().positive(),
})
```

## Business Rules Enforced

| Rule | Enforcement |
|------|------------|
| Cannot add same class twice per school per year | DB constraint `uniq_school_class_per_year` → service catches `IntegrityError` → 409 |
| Cannot delete class with active sections | Service checks active `ClassSection` count → 409 |
| CO cannot add class to another school | `get_school_or_403` on every endpoint |
| Class catalog is global (CO cannot create classes) | No POST endpoint on `/api/classes/` |

## Security Review

- `/api/classes/` — unauthenticated OK (global catalog, no sensitive data)
- `/api/schools/{id}/classes/` — all methods require JWT + RBAC via `get_school_or_403`
- Admin can add classes to any school because `get_school_or_403` returns true for admin scope
- 409 response on duplicate class does not leak data (no school enumeration risk)

## Testing Strategy

**Backend (`test_f_m2_4_5_structure.py`):**
- `test_seeded_classes_exist` — DB has 5th/6th/7th/8th after seed
- `test_seeded_program_exists` — "Foundation Program" exists
- `test_list_school_classes_returns_only_for_user_scope` — CO sees only own school
- `test_add_class_to_school_creates_school_class_row` — SchoolClass row created
- `test_add_class_creates_school_academic_year_if_missing` — SAY auto-created
- `test_add_duplicate_class_returns_409`
- `test_co_cannot_add_class_to_other_school` — 403
- `test_admin_can_add_class_to_any_school` — 201
- `test_soft_delete_class_with_no_sections_succeeds` — 204, is_active=False
- `test_soft_delete_class_with_active_sections_returns_409`

**Manual verification:**
- [ ] Catalog endpoint returns 4 classes
- [ ] CO adds "5th" → SchoolClass row in DB, card appears in UI
- [ ] CO adds "5th" again → 409, inline error in modal
- [ ] CO removes class with no sections → disappears
- [ ] CO removes class with sections → 409 with count message
- [ ] CO tries another school's class endpoint → 403

## Implementation Order

**Chunk 1 — Models + migration seed**
- Create `program.py`, `grade_class.py`
- Run migration (with all M2 models)
- Run seed command

**Chunk 2 — Services + API**
- Create `services/structure/queries.py`
- Create `api/structure_api.py` (class portions only)
- Fix `routes.py` breakage by providing all expected exports

**Chunk 3 — Frontend**
- Create `StructureTab.tsx`, `AddClassModal.tsx`
- Update `structure.service.ts`

## Open Questions

None. All resolved per M2.md spec and open question answers.
