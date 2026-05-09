# Feature Plan: M2 — School Structure + Children

**Generated:** 2026-05-07
**Milestone doc:** `docs/milestones/M2.md`
**Schema authority:** M2.md spec only — old migrations deleted, fresh migrations to be generated

---

## Overview

M2 activates the Structure and Children tabs on the school detail page. A CO can build a school's academic structure (academic year → classes → sections) and manage the full child lifecycle (enroll, edit, deactivate, reactivate, filter).

12 new models, 3 new API routers, 6 new service modules, and full frontend tab activation.

---

## Actual Build Status

| Artifact | Status | Notes |
|----------|--------|-------|
| `services/rbac/scope.py` | ✅ Done | `can_modify_school`, `get_school_or_403`, `require_admin_scope` added |
| `routes.py` | ⚠️ Broken | Imports M2 routers that don't exist yet — fix by creating API files |
| Frontend `lib/api/services/index.ts` | ✅ Done | Imports structure + children service |
| Frontend `lib/api/services/structure.service.ts` | ✅ Exists | Verify content against spec |
| Frontend `lib/api/services/children.service.ts` | ✅ Exists | Verify content against spec |
| Frontend `__tests__/schools/StructureTab.test.tsx` | ✅ Exists | Verify against spec |
| Frontend `__tests__/schools/ChildrenTab.test.tsx` | ✅ Exists | Verify against spec |
| Frontend `app/admin/` + `components/admin/` | ✅ Exists | Verify content |
| Frontend `components/schools/structure/` | ✅ Exists | Verify content |
| Frontend `components/schools/children/` | ✅ Exists | Verify content |
| Migrations 0009 / 0010 / 0011 | ❌ Deleted | Start fresh — generate from spec models |
| `seed_m2_catalog.py` management command | ❌ Deleted | Recreate per spec seed data |
| All backend model Python files | ❌ Not built | Create per spec schema below |
| All backend service files | ❌ Not built | Create per spec |
| All backend API files | ❌ Not built | Create to fix routes.py breakage |
| Backend tests | ❌ Not built | Create per spec test cases |

---

## Blast Radius

| Surface | Impact | Location |
|---------|--------|----------|
| Backend models | 12 NEW | `sessionops/models/` — one file per concern |
| Backend `models/__init__.py` | MODIFY | Add all 12 model exports |
| Backend schemas | 3 NEW files | `schemas/academic_year.py`, `schemas/structure.py`, `schemas/children.py` |
| Backend services | 6 NEW modules | `services/academic_year/`, `services/structure/`, `services/children/` |
| Backend API files | 3 NEW | `api/academic_years_api.py`, `api/structure_api.py`, `api/children_api.py` |
| Backend migrations | 3 NEW | Generate via `just makemigrations` after models exist |
| Backend management command | 1 NEW | `management/commands/seed_m2_catalog.py` |
| Backend tests | 3 NEW | `tests/features/m2/test_f_m2_3.py`, `test_f_m2_4_5.py`, `test_f_m2_6_10.py` |
| Frontend service files | Verify existing | `structure.service.ts`, `children.service.ts` |
| Frontend components | Verify existing | `components/schools/structure/`, `components/schools/children/` |
| Frontend `SchoolDetailPage.tsx` | Modified | Tabs activated, academic year in header |
| Frontend admin route | Verify existing | `app/admin/academic-years/` |
| Frontend tests | Verify existing | `StructureTab.test.tsx`, `ChildrenTab.test.tsx` |

---

## Schema (from M2.md spec — canonical)

All models use the **dual-flag soft-delete pattern**: `is_active` + `removed` + `deleted_at`. No model inherits `SoftDeleteBaseModel` from M1.

### `sessionops/models/academic_year.py`

```python
class AcademicYear(models.Model):
    academic_year_id = BigAutoField(primary_key=True)
    label            = CharField(max_length=20, unique=True)
    is_active        = BooleanField(default=False)
    removed          = BooleanField(default=False)
    deleted_at       = DateTimeField(null=True, blank=True)
    created_at       = DateTimeField(auto_now_add=True)
    updated_at       = DateTimeField(auto_now=True)
    created_by       = ForeignKey(User, on_delete=PROTECT, related_name="+")
    updated_by       = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")

    class Meta:
        db_table = "academic_year"
        constraints = [UniqueConstraint(fields=["is_active"], condition=Q(is_active=True),
                                        name="uniq_active_academic_year")]

class SchoolAcademicYear(models.Model):
    school_academic_year_id = BigAutoField(primary_key=True)
    school_id               = BigIntegerField(db_index=True)  # FK to partner.partner_id (no db_constraint)
    academic_year_id        = ForeignKey(AcademicYear, on_delete=PROTECT)
    is_active               = BooleanField(default=True)
    removed                 = BooleanField(default=False)
    deleted_at              = DateTimeField(null=True, blank=True)
    created_at              = DateTimeField(auto_now_add=True)
    updated_at              = DateTimeField(auto_now=True)
    created_by              = ForeignKey(User, on_delete=PROTECT, related_name="+")
    updated_by              = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")

    class Meta:
        db_table = "school_academic_year"
        constraints = [UniqueConstraint(fields=["school_id", "academic_year_id"],
                                        condition=Q(removed=False),
                                        name="uniq_school_academic_year")]
```

### `sessionops/models/program.py`

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

Seed: `program_id=1, program_name="Foundation Program"`.

### `sessionops/models/grade_class.py`

> File named `grade_class.py` to avoid shadowing Python's `class` keyword.

```python
class Class(models.Model):
    class_id    = BigAutoField(primary_key=True)
    class_name  = CharField(max_length=20)
    class_code  = CharField(max_length=4, unique=True)
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
    # Note: db_column="class_id" so the DB column is named class_id (not class_id_id).
    # Access the FK object as .class_id, the integer as .class_id_id.
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

### `sessionops/models/class_section.py`

```python
SECTION_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]

class ClassSection(models.Model):
    class_section_id = BigAutoField(primary_key=True)
    school_class_id  = ForeignKey(SchoolClass, on_delete=PROTECT)
    school_id        = BigIntegerField(db_index=True)
    section_code     = CharField(max_length=1, choices=[(c, c) for c in SECTION_CODES])
    section_name     = CharField(max_length=20)  # "5th - A" — derived, stored
    is_active        = BooleanField(default=True)
    removed          = BooleanField(default=False)
    deleted_at       = DateTimeField(null=True, blank=True)
    created_at       = DateTimeField(auto_now_add=True)
    updated_at       = DateTimeField(auto_now=True)
    created_by       = ForeignKey(User, on_delete=PROTECT, related_name="+")
    updated_by       = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")

    class Meta:
        db_table = "class_section"
        constraints = [UniqueConstraint(
            fields=["school_class_id", "section_code"],
            condition=Q(removed=False),
            name="uniq_section_per_school_class",
        )]
```

### `sessionops/models/child.py`

```python
REMOVED_REASONS = [
    ("inactive", "Inactive"),
    ("duplicate_entry", "Duplicate entry"),
    ("wrong_school_class", "Added to wrong school/class by mistake"),
    ("transferred", "Transferred to another school"),
    ("dropped_out", "Dropped out of school"),
    ("family_declined", "Family does not want the child enrolled"),
    ("child_declined", "Child no longer interested in participating"),
    ("other", "Other"),
]

class Child(models.Model):
    child_id           = BigAutoField(primary_key=True)
    school_id          = BigIntegerField(db_index=True)
    first_name         = CharField(max_length=100)
    last_name          = CharField(max_length=100)
    gender             = CharField(max_length=20, choices=[("male","Male"),("female","Female"),("other","Other")])
    date_of_birth      = DateField(null=True, blank=True)
    age                = IntegerField(null=True, blank=True)
    city               = CharField(max_length=100, null=True, blank=True)
    mother_tongue      = CharField(max_length=50, null=True, blank=True)
    date_of_enrollment = DateField(null=True, blank=True)
    mad_joining_date   = DateField(null=True, blank=True)
    is_active          = BooleanField(default=True)
    removed            = BooleanField(default=False)
    deleted_at         = DateTimeField(null=True, blank=True)
    created_at         = DateTimeField(auto_now_add=True)
    updated_at         = DateTimeField(auto_now=True)
    created_by         = ForeignKey(User, on_delete=PROTECT, related_name="+")
    updated_by         = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")

    class Meta:
        db_table = "child"
        indexes = [Index(fields=["school_id", "is_active", "removed"])]

class ChildClass(models.Model):
    child_class_id  = BigAutoField(primary_key=True)
    child_id        = ForeignKey(Child, on_delete=PROTECT)
    school_class_id = ForeignKey(SchoolClass, on_delete=PROTECT)
    is_active       = BooleanField(default=True)
    removed         = BooleanField(default=False)
    deleted_at      = DateTimeField(null=True, blank=True)
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)
    created_by      = ForeignKey(User, on_delete=PROTECT, related_name="+")
    updated_by      = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")

    class Meta:
        db_table = "child_class"
        indexes = [Index(fields=["child_id", "is_active"]), Index(fields=["school_class_id", "is_active"])]

class ChildClassSection(models.Model):
    child_class_section_id = BigAutoField(primary_key=True)
    child_id               = ForeignKey(Child, on_delete=PROTECT)
    class_section_id       = ForeignKey(ClassSection, on_delete=PROTECT)
    is_active              = BooleanField(default=True)
    removed                = BooleanField(default=False)
    deleted_at             = DateTimeField(null=True, blank=True)
    created_at             = DateTimeField(auto_now_add=True)
    updated_at             = DateTimeField(auto_now=True)
    created_by             = ForeignKey(User, on_delete=PROTECT, related_name="+")
    updated_by             = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")

    class Meta:
        db_table = "child_class_section"
        indexes = [Index(fields=["child_id", "is_active"]), Index(fields=["class_section_id", "is_active"])]

class BatchChild(models.Model):
    batch_child_id          = BigAutoField(primary_key=True)
    school_academic_year_id = ForeignKey(SchoolAcademicYear, on_delete=PROTECT)
    child_id                = ForeignKey(Child, on_delete=PROTECT)
    school_id               = BigIntegerField(db_index=True)
    is_active               = BooleanField(default=True)
    removed                 = BooleanField(default=False)
    deleted_at              = DateTimeField(null=True, blank=True)
    created_at              = DateTimeField(auto_now_add=True)
    updated_at              = DateTimeField(auto_now=True)
    created_by              = ForeignKey(User, on_delete=PROTECT, related_name="+")
    updated_by              = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")

    class Meta:
        db_table = "batch_child"

class ChildProgram(models.Model):
    child_program_id = BigAutoField(primary_key=True)
    program_id       = ForeignKey(Program, on_delete=PROTECT)
    child_id         = ForeignKey(Child, on_delete=PROTECT)
    is_active        = BooleanField(default=True)
    removed          = BooleanField(default=False)
    deleted_at       = DateTimeField(null=True, blank=True)
    created_at       = DateTimeField(auto_now_add=True)
    updated_at       = DateTimeField(auto_now=True)
    created_by       = ForeignKey(User, on_delete=PROTECT, related_name="+")
    updated_by       = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")

    class Meta:
        db_table = "child_program"

class ChildRemovalLog(models.Model):
    child_removal_log_id = BigAutoField(primary_key=True)
    child_id             = ForeignKey(Child, on_delete=PROTECT)
    co_id                = BigIntegerField()  # loose FK to user.user_id (no db_constraint)
    school_id            = BigIntegerField(db_index=True)
    removed_reason       = CharField(max_length=20, choices=REMOVED_REASONS)
    other_details        = TextField(null=True, blank=True)
    removed_datetime     = DateTimeField()
    is_active            = BooleanField(default=True)
    removed              = BooleanField(default=False)
    deleted_at           = DateTimeField(null=True, blank=True)
    created_at           = DateTimeField(auto_now_add=True)
    updated_at           = DateTimeField(auto_now=True)

    class Meta:
        db_table = "child_removal_log"
        indexes = [Index(fields=["child_id", "is_active"])]
```

`is_active=True` on a log row means "this removal is the current active state." When child is reactivated, the latest log gets `is_active=False, removed=True`.

---

## High-Level Design

### Data flow — child enrollment (happy path)

```
CO submits "Enroll Child" form
  → POST /api/schools/{school_id}/children/
  → Ninja auth middleware: decode JWT, attach user
  → get_school_or_403(user, school_id)
  → enroll_child(school_id, payload, user):
      transaction.atomic()
        1. select_for_update: fetch and lock ClassSection
        2. Count active ChildClassSection rows → R1 (max 5) → 409 if full
        3. Count active BatchChild rows → school cap (confirmed_child_count) → 409 if at limit
        4. Validate section.school_id == school_id
        5. Get SchoolAcademicYear (must exist; section implies SAY exists)
        6. INSERT Child
        7. INSERT ChildClass (school_class_id from section.school_class_id)
        8. INSERT ChildClassSection
        9. INSERT BatchChild (school_academic_year_id, school_id)
        10. INSERT ChildProgram (program_id=1, Foundation)
  → 201 ChildOut
```

### Data flow — child deactivation

```
POST /api/schools/{school_id}/children/{child_id}/deactivate/
  → deactivate_child(child_id, school_id, removal_reason, other_details, user):
      transaction.atomic() + select_for_update(Child)
        1. RBAC check
        2. Validate child is_active=True (404 if already removed)
        3. Validate removal_reason in REMOVED_REASONS choices
        4. If removal_reason == "other": validate other_details not empty
        5. Soft-delete: Child, all active ChildClass, all active ChildClassSection,
           active BatchChild, active ChildProgram
        6. INSERT ChildRemovalLog (is_active=True)
```

### Data flow — child reactivation

```
POST /api/schools/{school_id}/children/{child_id}/reactivate/
  → reactivate_child(child_id, class_section_id, school_id, user):
      transaction.atomic() + select_for_update(Child)
        1. Validate child is_active=False, removed=True (400 if already active)
        2. RBAC check
        3. Validate target ClassSection: same school_id, has capacity, school has capacity
        4. Reactivate Child (is_active=True, removed=False, deleted_at=None)
        5. INSERT new ChildClass, ChildClassSection, BatchChild, ChildProgram
        6. Mark current ChildRemovalLog: is_active=False, removed=True, deleted_at=now
```

---

## Service Signatures

### `services/academic_year/queries.py`

```python
def get_active_academic_year() -> AcademicYear:
    # Returns is_active=True, removed=False row. Raises ValidationError if none.

def get_or_create_school_academic_year(school_id: int, user: User) -> SchoolAcademicYear:
    # Idempotent. Called when CO first adds a class to a school.
```

### `services/structure/queries.py`

```python
MAX_CHILDREN_PER_SECTION = 5

def list_classes_for_school(school_id: int) -> QuerySet[SchoolClass]:
    # Active year scope; is_active=True, removed=False.

def add_class_to_school(school_id: int, class_id: int, user: User) -> SchoolClass:
    # get_or_create SchoolAcademicYear, then SchoolClass.
    # Raises ConflictError (409) on duplicate.

def soft_delete_school_class(school_class_id: int, school_id: int, user: User) -> None:
    # Raises ConflictError (409) if active ClassSection rows exist.
```

### `services/structure/sections.py`

```python
def list_sections_for_class(school_class_id: int) -> QuerySet[ClassSection]:

def available_section_codes(school_class_id: int) -> list[str]:
    # SECTION_CODES minus codes already used by active sections for this school_class.

def add_section_to_class(school_class_id: int, school_id: int, section_code: str, user: User) -> ClassSection:
    # Validates section_code in SECTION_CODES.
    # Computes section_name = f"{class_name} - {section_code}".
    # Raises ConflictError (409) on duplicate.

def count_active_children_in_section(class_section_id: int) -> int:

def soft_delete_section(class_section_id: int, school_id: int, user: User) -> None:
    # Raises ConflictError (409) if active ChildClassSection rows exist; includes count in message.
```

### `services/children/enroll.py`

```python
def enroll_child(school_id: int, payload: ChildEnrollIn, user: User) -> Child:
    # transaction.atomic. All 5 inserts or nothing.
```

### `services/children/edit.py`

```python
def edit_child(child_id: int, school_id: int, payload: ChildEditIn, user: User) -> Child:
    # transaction.atomic + select_for_update(Child).
    # Demographic fields: update in place.
    # If class_section_id changed: validate target (same school, not full),
    #   soft-delete old ChildClassSection, insert new.
    # If new section's school_class_id differs from current: soft-delete old ChildClass, insert new.
```

### `services/children/deactivate.py`

```python
REMOVED_REASONS = [k for k, _ in REMOVED_REASONS_CHOICES]

def deactivate_child(child_id: int, school_id: int, removal_reason: str,
                     other_details: str | None, user: User) -> Child:
    # transaction.atomic + select_for_update(Child).
    # Validates reason in REMOVED_REASONS. If "other": requires other_details.
    # Soft-deletes Child + all active history rows. Inserts ChildRemovalLog (is_active=True).
```

### `services/children/reactivate.py`

```python
def reactivate_child(child_id: int, class_section_id: int, school_id: int, user: User) -> Child:
    # transaction.atomic + select_for_update(Child).
    # Validates child is removed. Validates target section (same school, not full, school not at cap).
    # Reactivates Child. Inserts new history rows.
    # Marks current ChildRemovalLog is_active=False, removed=True, deleted_at=now.
```

### `services/children/queries.py`

```python
def list_children(
    school_id: int,
    *,
    section_id: int | None = None,
    class_id: int | None = None,
    status: str = "active",   # "active" | "inactive" | "all"
    search: str | None = None,
) -> QuerySet[Child]:
    # Joins to ChildClassSection (is_active=True, removed=False) for current section/class.
    # status: active=(is_active=T, removed=F), inactive=(is_active=F, removed=T), all=both.
    # search: icontains on first_name + last_name.
```

---

## API Endpoints

### `api/academic_years_api.py` → router prefix `/api/academic-years/`

| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/active/` | Any auth | Active `AcademicYear` row |
| GET | `/admin/` | Admin scope | All academic years |
| POST | `/admin/` | Admin scope | Create (stays inactive) |
| PATCH | `/admin/{id}/` | Admin scope | Update label |

### `api/structure_api.py` → two routers

`classes_catalog_router` prefix `/api/classes/`:

| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/` | Any auth | Global `Class` catalog |
| GET | `/section-codes/` | Any auth | `SECTION_CODES` constant |

`structure_router` prefix `/api/schools/`:

| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/{school_id}/classes/` | Auth + RBAC | SchoolClass list with `sections_count` |
| POST | `/{school_id}/classes/` | Auth + RBAC | Add class; body `{class_id}` |
| DELETE | `/{school_id}/classes/{school_class_id}/` | Auth + RBAC | Soft-delete; 409 if has sections |
| GET | `/{school_id}/classes/{school_class_id}/sections/` | Auth + RBAC | Section list with `children_count` |
| GET | `/{school_id}/classes/{school_class_id}/sections/available-codes/` | Auth + RBAC | Unused letters |
| POST | `/{school_id}/classes/{school_class_id}/sections/` | Auth + RBAC | Add section; body `{section_code}` |
| DELETE | `/{school_id}/sections/{class_section_id}/` | Auth + RBAC | Soft-delete; 409 if has children |

### `api/children_api.py` → router prefix `/api/schools/`

| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/{school_id}/children/` | Auth + RBAC | List; params: `section_id`, `class_id`, `status`, `search` |
| POST | `/{school_id}/children/` | Auth + RBAC | Enroll; 201 |
| PATCH | `/{school_id}/children/{child_id}/` | Auth + RBAC | Edit |
| POST | `/{school_id}/children/{child_id}/deactivate/` | Auth + RBAC | Deactivate |
| POST | `/{school_id}/children/{child_id}/reactivate/` | Auth + RBAC | Reactivate |

---

## Schemas

### `schemas/academic_year.py`
- `AcademicYearOut`: `academic_year_id`, `label`, `is_active`, `created_at`
- `AcademicYearCreateIn`: `label: str`
- `AcademicYearUpdateIn`: `label: str`

### `schemas/structure.py`
- `ClassCatalogItemOut`: `class_id`, `class_name`, `class_code`, `program_name`
- `SchoolClassOut`: `school_class_id`, `class_id`, `class_name`, `program_name`, `sections_count: int`
- `SectionOut`: `class_section_id`, `section_code`, `section_name`, `children_count: int`
- `ClassAddIn`: `class_id: int`
- `SectionCreateIn`: `section_code: str` — validated against `SECTION_CODES`

### `schemas/children.py`
- `ChildOut`: `child_id`, `first_name`, `last_name`, `gender`, `age`, `city`, `mother_tongue`, `date_of_birth`, `date_of_enrollment`, `mad_joining_date`, `is_active`, `current_class_name`, `current_section_name`
- `ChildEnrollIn`: required: `first_name`, `last_name`, `gender`, `age`, `class_section_id: int`; optional: `date_of_birth`, `city`, `mother_tongue`, `date_of_enrollment`, `mad_joining_date`
- `ChildEditIn`: all fields optional; `class_section_id: int | None`
- `ChildDeactivateIn`: `removal_reason: Literal[8 values]`, `other_details: str | None`
- `ChildReactivateIn`: `class_section_id: int`

---

## Seed Data (via management command)

`management/commands/seed_m2_catalog.py` — idempotent, safe to run multiple times:

1. Get-or-create `AcademicYear(label="2026-2027", is_active=True, created_by=user_id=1924616)`
2. Get-or-create `Program(program_name="Foundation Program")`
3. Get-or-create each: `Class(class_name="5th", class_code="5", program)`, `6th/6`, `7th/7`, `8th/8`

---

## Business Rules Enforced

| Rule | Enforcement point |
|------|------------------|
| R1 — Max 5 active children per section | `enroll_child`, `reactivate_child`, `edit_child` (section move) |
| One active AcademicYear at a time | DB unique constraint `uniq_active_academic_year` |
| R9 — No hard deletes | All FKs use `on_delete=PROTECT`; never call `.delete()` on M2 models |
| Removal reason mandatory | `deactivate_child`: validate non-empty `removal_reason` before any writes |
| "Other" reason requires `other_details` | `deactivate_child`: 400 if reason=other and other_details empty |
| RBAC scope filtering | `get_school_or_403` on every school-scoped endpoint |
| School cap (`confirmed_child_count`) | `enroll_child`, `reactivate_child`: count active `BatchChild` vs. cap; `null` = unlimited |
| Section code must be A–L | Pydantic schema + service validates against `SECTION_CODES` |
| No duplicate class per school per year | DB constraint + `ConflictError` (409) from service |
| No duplicate section per class | DB constraint + `ConflictError` (409) from service |
| Cannot delete class with active sections | `soft_delete_school_class`: check first |
| Cannot delete section with active children | `soft_delete_section`: check first; include count in 409 message |

---

## Security Review

- All M2 endpoints require JWT — no unauthenticated paths
- Every school-scoped endpoint calls `get_school_or_403` → returns 403 (not 404) so COs cannot enumerate other schools' data
- Admin-only endpoints call `require_admin_scope`
- `removal_reason` validated as `Literal[8 values]` in Pydantic schema + checked in service
- Cross-school section injection blocked: `enroll_child` and `reactivate_child` verify `section.school_id == school_id`

---

## Testing Strategy

**Backend test files to create:**

`sessionops/tests/features/m2/test_f_m2_3_academic_year.py` — all test cases from F-M2-3

`sessionops/tests/features/m2/test_f_m2_4_5_structure.py` — all test cases from F-M2-4 and F-M2-5

`sessionops/tests/features/m2/test_f_m2_6_10_children.py` — all test cases from F-M2-6 through F-M2-10

**Run:**
```bash
# Backend
just test

# Frontend
npm run test
```

---

## Implementation Order

### Phase 1 — Backend models + migrations (~1 day)

1. Create all 5 model files + update `models/__init__.py`
2. `just makemigrations sessionops` → generates one migration with all 12 tables
3. Create `management/commands/seed_m2_catalog.py`
4. `just migrate` → applies migration
5. `python manage.py seed_m2_catalog` → seeds AcademicYear, Program, Class rows

### Phase 2 — Backend services + API (~1.5 days)

1. Create all service modules
2. Create all 3 API files → fixes the `routes.py` breakage
3. Verify `just serve` starts clean
4. Smoke each endpoint via Swagger at `http://localhost:8000/api/docs`

### Phase 3 — Backend tests (~1 day)

1. Create test directory + 3 test files
2. `just test` — all green

### Phase 4 — Frontend verification (~1 day)

1. Open and verify each untracked file in `components/schools/structure/`, `components/schools/children/`, `app/admin/`
2. Confirm enrollment form uses: first_name, last_name, gender, age, class, section (no admission_number — spec does not have it as a required field)
3. Confirm reactivation modal has class + section cascading picker (not auto-restore)
4. Confirm deactivation modal has 8-option dropdown + conditional `other_details` text field
5. `npm run test` — all green

### Phase 5 — Stabilization + production (~2 days)

1. Full manual smoke checklist
2. Tag `m2-dev-complete`
3. Production deploy with seed command using `user_id=1924616`

---

## Manual Smoke Checklist

- [ ] `just serve` starts without ImportError
- [ ] CO: Structure tab active, empty state shows
- [ ] CO: Add "5th" class → SchoolAcademicYear auto-created
- [ ] CO: Add "5th" again → 409 "already added"
- [ ] CO: Add section "A" under 5th → appears
- [ ] CO: Add section "A" again → 409
- [ ] Available codes endpoint excludes "A", returns B–L
- [ ] CO: Enroll 5 children in section A → all succeed
- [ ] CO: Enroll 6th → blocked (409 section full)
- [ ] CO: Edit child, change to section B → new ChildClassSection row created, old deactivated
- [ ] CO: Deactivate child, reason "transferred" → child gone from default list
- [ ] CO: Filter status=inactive → deactivated child appears
- [ ] CO: Reactivate child → modal shows class + section picker, not auto-restore
- [ ] CO: Reactivate → child active again, new history rows exist, old RemovalLog marked inactive
- [ ] CO: Access another school → 403
- [ ] Admin: Can add classes to any school
- [ ] Admin: `/admin/academic-years` → list visible
- [ ] CO: `/admin/academic-years` → redirected to `/schools`
