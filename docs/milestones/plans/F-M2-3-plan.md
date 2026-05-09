# Feature Plan: F-M2-3 — Academic Year Management

## Overview

Build the `AcademicYear` and `SchoolAcademicYear` models, seed the active year "2026-2027", expose admin-only CRUD endpoints, display the locked year in the school detail header for COs, and auto-create `SchoolAcademicYear` when a CO first adds a class. Year switching is explicitly out of scope (M5).

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | 2 NEW | `AcademicYear`, `SchoolAcademicYear` |
| Backend services | 1 NEW module | `services/academic_year/queries.py` |
| Backend API endpoints | 1 NEW router | `api/academic_years_api.py` (4 endpoints) |
| Backend schemas | 1 NEW file | `schemas/academic_year.py` |
| Backend migrations | Yes | Included in the single M2 migration |
| Frontend pages | 1 NEW route | `app/admin/academic-years/` page |
| Frontend components | 1 NEW + 1 MODIFIED | `AcademicYearListPage`, `SchoolDetailPage.tsx` header |
| Celery tasks | No | — |
| Existing tests | None broken | M1 tests unaffected |
| Documentation | None | — |

## High-Level Design

### Data flow — CO views school header

```
CO navigates to /schools/{id}
  → SchoolDetailPage fetches GET /api/academic-years/active/
  → Renders "Academic Year: 2026-2027" as locked text in header
  → No edit affordance shown
```

### Data flow — Admin manages years

```
Admin navigates to /admin/academic-years/
  → Page fetches GET /api/admin/academic-years/
  → Renders list with is_active badge
  → "Create Academic Year" → modal → POST /api/admin/academic-years/
  → New year created, stays inactive (no auto-activate)
```

### Data flow — SchoolAcademicYear auto-create

```
CO adds first class to a school (F-M2-4)
  → add_class_to_school service calls get_or_create_school_academic_year(school_id, user)
  → Looks up SchoolAcademicYear for (school_id, active AcademicYear)
  → Creates if not found; returns existing if already present
```

### Key architectural decisions

- Only one `AcademicYear` can have `is_active=True` at a time — enforced by DB unique constraint on `(is_active)` where `is_active=True`
- `SchoolAcademicYear` is created lazily — not upfront for all schools
- M2 does NOT expose year deactivation or switching — those endpoints are M5

## Low-Level Design

### Backend

#### Models (`sessionops/models/academic_year.py`)

```python
class AcademicYear(models.Model):
    academic_year_id = BigAutoField(primary_key=True)
    label            = CharField(max_length=20, unique=True)   # "2026-2027"
    is_active        = BooleanField(default=False)
    removed          = BooleanField(default=False)
    deleted_at       = DateTimeField(null=True, blank=True)
    created_at       = DateTimeField(auto_now_add=True)
    updated_at       = DateTimeField(auto_now=True)
    created_by       = ForeignKey(User, on_delete=PROTECT, related_name="+")
    updated_by       = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")
    class Meta:
        db_table = "academic_year"
        constraints = [UniqueConstraint(fields=["is_active"],
                       condition=Q(is_active=True), name="uniq_active_academic_year")]

class SchoolAcademicYear(models.Model):
    school_academic_year_id = BigAutoField(primary_key=True)
    school_id               = BigIntegerField(db_index=True)
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
                       condition=Q(removed=False), name="uniq_school_academic_year")]
```

#### Schemas (`schemas/academic_year.py`)

```python
class AcademicYearOut(Schema):
    academic_year_id: int
    label: str
    is_active: bool
    created_at: datetime

class AcademicYearCreateIn(Schema):
    label: str  # validate format "YYYY-YYYY" at schema level

class AcademicYearUpdateIn(Schema):
    label: str
```

#### Services (`services/academic_year/queries.py`)

```python
def get_active_academic_year() -> AcademicYear:
    """Returns is_active=True, removed=False. Raises ValidationError if none."""
    try:
        return AcademicYear.objects.get(is_active=True, removed=False)
    except AcademicYear.DoesNotExist:
        raise ValidationError("No active academic year configured.")

def get_or_create_school_academic_year(school_id: int, user: User) -> SchoolAcademicYear:
    """Idempotent. Uses active academic year. Called from add_class_to_school."""
    active_year = get_active_academic_year()
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id,
        academic_year_id=active_year,
        removed=False,
        defaults={"created_by": user},
    )
    return say
```

#### API (`api/academic_years_api.py`)

Router registered in `routes.py` as `api.add_router("/api/academic-years/", academic_years_router)`.

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/active/` | Any auth | — | `AcademicYearOut` |
| GET | `/admin/` | `require_admin_scope` | — | `list[AcademicYearOut]` |
| POST | `/admin/` | `require_admin_scope` | `AcademicYearCreateIn` | `AcademicYearOut` 201 |
| PATCH | `/admin/{id}/` | `require_admin_scope` | `AcademicYearUpdateIn` | `AcademicYearOut` |

#### Migrations

Included in the single M2 migration generated by `just makemigrations sessionops` after all model files are created.

#### Seed data

Management command `seed_m2_catalog.py`:
```python
AcademicYear.objects.get_or_create(
    label="2026-2027",
    defaults={"is_active": True, "created_by": user_with_id_1924616},
)
```

### Frontend

#### School detail header (`SchoolDetailPage.tsx`) — modify

Add to the school detail header row: `Academic Year: {activeYear.label}` as plain text. No interactive control. Fetch via:
```typescript
const { data: activeYear } = useFetch("/api/academic-years/active/")
```
Render once on mount; no re-fetch on tab change.

#### Admin page `app/admin/academic-years/page.tsx` — new

- Server component wrapper that checks admin scope; redirects CO to `/schools`
- Client component `AcademicYearListPage` renders:
  - Table: label, is_active badge ("Active" / "Inactive"), created_at
  - "Create Academic Year" button → `CreateAcademicYearModal`

#### `components/admin/CreateAcademicYearModal.tsx` — new

- Input: `label` (text field, hint: "e.g. 2027-2028")
- Submit: `POST /api/admin/academic-years/`
- On success: close modal, refresh list, success toast
- Note: new year stays inactive — no auto-activate warning shown

#### Route guard

Admin route `/admin/academic-years` protected by `proxy.ts` or page-level check using user role from Redux auth state. CO gets redirected to `/schools`.

## Business Rules Enforced

| Rule | Enforcement |
|------|------------|
| Only one active academic year | DB unique constraint `uniq_active_academic_year` |
| CO cannot create/switch years | `require_admin_scope` on POST/PATCH endpoints |
| New year stays inactive | `POST /admin/academic-years/` always creates with `is_active=False` |

## Security Review

- `GET /active/` — any authenticated user; returns only label + id (no sensitive data)
- `GET /admin/`, `POST /admin/`, `PATCH /admin/{id}/` — `require_admin_scope` raises 403 for CO
- Frontend admin route: redirect at page level + API enforces separately (defence in depth)

## Testing Strategy

**Backend (`test_f_m2_3_academic_year.py`):**
- `test_seeded_academic_year_exists` — DB has "2026-2027" row with is_active=True after migration
- `test_get_active_academic_year_returns_seeded_row` — service returns correct row
- `test_only_one_active_year_constraint_enforced` — inserting second active year raises IntegrityError
- `test_admin_can_list_academic_years` — 200 with list
- `test_co_cannot_list_academic_years` — 403
- `test_admin_can_create_academic_year` — 201, new row is_active=False
- `test_co_cannot_create_academic_year` — 403
- `test_school_academic_year_auto_created_on_first_class_add` — tested via structure tests

**Manual verification:**
- [ ] `GET /api/academic-years/active/` returns `{"label": "2026-2027", ...}`
- [ ] CO on school detail sees "Academic Year: 2026-2027" in header
- [ ] Admin visits `/admin/academic-years/` → sees list
- [ ] Admin creates "2027-2028" → appears in list as Inactive
- [ ] CO visits `/admin/academic-years/` → redirected to `/schools`

## Implementation Order

**Chunk 1 — Model + migration + seed**
- Create `models/academic_year.py`
- Update `models/__init__.py`
- Run `just makemigrations` (after all M2 models are ready)
- Create and run seed command

**Chunk 2 — Backend service + API**
- Create `services/academic_year/queries.py`
- Create `api/academic_years_api.py`
- Smoke test via Swagger

**Chunk 3 — Frontend**
- Modify `SchoolDetailPage.tsx` header
- Create admin page + modal

## Open Questions

None. All resolved:
- Seed user: `user_id=1924616` (gaurav.thwait@makeadiff.in)
- Year deactivation/switching: M5, not M2
