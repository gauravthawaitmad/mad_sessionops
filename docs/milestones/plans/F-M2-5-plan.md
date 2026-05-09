# Feature Plan: F-M2-5 — Sections

## Overview

Build the `ClassSection` model and expose endpoints for a CO to add/list/remove sections under a class. Section codes are A–L, hardcoded as a constant (no DB table). The max-5-children rule is enforced at child enrollment (F-M2-6), not here. The `available-codes` endpoint returns only unused letters for a given `SchoolClass`, powering the frontend dropdown.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | 1 NEW | `ClassSection` |
| Backend services | 1 NEW module | `services/structure/sections.py` |
| Backend API endpoints | Modified | `api/structure_api.py` — section endpoints added |
| Backend schemas | Modified | `schemas/structure.py` — section schemas added |
| Backend migrations | Yes | Part of single M2 migration |
| Frontend components | 2 NEW | Section list (inline in class card), `AddSectionModal` |
| Celery tasks | No | — |
| Existing tests | None broken | — |
| Documentation | None | — |

## High-Level Design

### Data flow — CO adds a section

```
CO expands a class card → clicks "Add Section"
  → AddSectionModal fetches GET .../sections/available-codes/
  → Dropdown shows only unused letters (e.g., ["A","B","C",...])
  → CO picks "A" → POST .../sections/ {section_code: "A"}
    → add_section_to_class(school_class_id, school_id, "A", user):
        1. RBAC: get_school_or_403 (via school_id)
        2. Validate "A" in SECTION_CODES
        3. Compute section_name = f"{class_name} - A"   → "5th - A"
        4. ClassSection.objects.create(...)
           → DB constraint raises IntegrityError on duplicate → ConflictError (409)
  → Section row appears under class card
```

### Data flow — CO removes a section

```
CO clicks three-dot menu on section → "Remove section" → confirm
  → DELETE .../sections/{classSectionId}/
    → soft_delete_section(class_section_id, school_id, user):
        1. RBAC check
        2. Count active ChildClassSection rows → ConflictError (409) with count if > 0
        3. Set is_active=False, removed=True, deleted_at=now
```

### Key architectural decisions

- `SECTION_CODES = ["A","B","C","D","E","F","G","H","I","J","K","L"]` — module-level constant, not a DB table
- `section_name` is stored (e.g., "5th - A") for query convenience; computed at creation time from `class_name + section_code`
- `available-codes` returns letters not yet assigned to an **active** (`removed=False`) section for that school_class; soft-deleted sections' codes become available again

## Low-Level Design

### Backend

#### Model (`sessionops/models/class_section.py`)

```python
SECTION_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]

class ClassSection(models.Model):
    class_section_id = BigAutoField(primary_key=True)
    school_class_id  = ForeignKey(SchoolClass, on_delete=PROTECT)
    school_id        = BigIntegerField(db_index=True)
    section_code     = CharField(max_length=1, choices=[(c, c) for c in SECTION_CODES])
    section_name     = CharField(max_length=20)  # "5th - A"
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

#### Schemas (`schemas/structure.py` — section portion)

```python
class SectionOut(Schema):
    class_section_id: int
    section_code: str
    section_name: str
    children_count: int  # active ChildClassSection rows

class SectionCreateIn(Schema):
    section_code: str

    @field_validator("section_code")
    def validate_code(cls, v):
        if v not in SECTION_CODES:
            raise ValueError(f"section_code must be one of {SECTION_CODES}")
        return v

class AvailableCodesOut(Schema):
    codes: list[str]
```

#### Services (`services/structure/sections.py`)

```python
def list_sections_for_class(school_class_id: int) -> QuerySet[ClassSection]:
    return (
        ClassSection.objects
        .filter(school_class_id=school_class_id, is_active=True, removed=False)
        .annotate(children_count=Count(
            "childclasssection",
            filter=Q(childclasssection__is_active=True, childclasssection__removed=False)
        ))
        .order_by("section_code")
    )

def available_section_codes(school_class_id: int) -> list[str]:
    used = set(
        ClassSection.objects
        .filter(school_class_id=school_class_id, removed=False)
        .values_list("section_code", flat=True)
    )
    return [c for c in SECTION_CODES if c not in used]

def add_section_to_class(
    school_class_id: int, school_id: int, section_code: str, user: User
) -> ClassSection:
    sc = get_object_or_404(SchoolClass, school_class_id=school_class_id,
                           school_id=school_id, is_active=True, removed=False)
    class_name = sc.class_id.class_name  # "5th"
    section_name = f"{class_name} - {section_code}"  # "5th - A"
    try:
        return ClassSection.objects.create(
            school_class_id=sc,
            school_id=school_id,
            section_code=section_code,
            section_name=section_name,
            created_by=user,
        )
    except IntegrityError:
        raise ConflictError(f"Section {section_code} already exists for this class.")

def count_active_children_in_section(class_section_id: int) -> int:
    return ChildClassSection.objects.filter(
        class_section_id=class_section_id, is_active=True, removed=False
    ).count()

def soft_delete_section(class_section_id: int, school_id: int, user: User) -> None:
    cs = get_object_or_404(ClassSection, class_section_id=class_section_id,
                           school_id=school_id, is_active=True, removed=False)
    count = count_active_children_in_section(class_section_id)
    if count > 0:
        raise ConflictError(f"Cannot remove section: {count} active child(ren) enrolled.")
    now = timezone.now()
    cs.is_active = False
    cs.removed = True
    cs.deleted_at = now
    cs.updated_by = user
    cs.save()
```

#### API (added to `api/structure_api.py` — `structure_router`)

```python
@structure_router.get("/{school_id}/classes/{school_class_id}/sections/",
                      response=list[SectionOut])
def list_sections(request, school_id: int, school_class_id: int):
    get_school_or_403(request.auth, school_id)
    return list_sections_for_class(school_class_id)

@structure_router.get("/{school_id}/classes/{school_class_id}/sections/available-codes/",
                      response=AvailableCodesOut)
def get_available_codes(request, school_id: int, school_class_id: int):
    get_school_or_403(request.auth, school_id)
    return {"codes": available_section_codes(school_class_id)}

@structure_router.post("/{school_id}/classes/{school_class_id}/sections/",
                       response={201: SectionOut})
def add_section(request, school_id: int, school_class_id: int, payload: SectionCreateIn):
    get_school_or_403(request.auth, school_id)
    return 201, add_section_to_class(school_class_id, school_id, payload.section_code, request.auth)

@structure_router.delete("/{school_id}/sections/{class_section_id}/", response={204: None})
def remove_section(request, school_id: int, class_section_id: int):
    get_school_or_403(request.auth, school_id)
    soft_delete_section(class_section_id, school_id, request.auth)
    return 204, None
```

### Frontend

#### Section list (inline in class card — part of `StructureTab.tsx`)

When a class card is expanded:
- Fetches `GET .../classes/{schoolClassId}/sections/`
- Renders each section: `section_name`, `children_count` badge, three-dot menu (Remove)
- "Add Section" button at bottom of expanded card

#### `components/schools/structure/AddSectionModal.tsx` — new

```tsx
// Props: { schoolId, schoolClassId, onSuccess }
// On open: fetches GET .../sections/available-codes/
// Dropdown: available codes only; if empty → "All sections (A-L) already added"
// Submit: POST .../sections/ {section_code}
// 201 → close, refresh sections list, success toast
// 409 → inline error (shouldn't happen if dropdown filtered, but guard anyway)
```

#### API integration (`lib/api/services/structure.service.ts` — additions)

```typescript
export const listSections = (schoolId: number, schoolClassId: number) =>
  apiClient.get(`/api/schools/${schoolId}/classes/${schoolClassId}/sections/`)

export const getAvailableSectionCodes = (schoolId: number, schoolClassId: number) =>
  apiClient.get(`/api/schools/${schoolId}/classes/${schoolClassId}/sections/available-codes/`)

export const addSection = (schoolId: number, schoolClassId: number, sectionCode: string) =>
  apiClient.post(`/api/schools/${schoolId}/classes/${schoolClassId}/sections/`,
                 { section_code: sectionCode })

export const removeSection = (schoolId: number, classSectionId: number) =>
  apiClient.delete(`/api/schools/${schoolId}/sections/${classSectionId}/`)
```

#### Form validation (Zod)

```typescript
const sectionCreateSchema = z.object({
  section_code: z.enum(["A","B","C","D","E","F","G","H","I","J","K","L"]),
})
```

## Business Rules Enforced

| Rule | Enforcement |
|------|------------|
| Section code must be A–L | Pydantic `field_validator` in `SectionCreateIn` + service validates against constant |
| No duplicate section per class | DB constraint `uniq_section_per_school_class` → service catches `IntegrityError` → 409 |
| Cannot delete section with active children | `soft_delete_section` checks `ChildClassSection` count → 409 with count |
| CO cannot add section to another school's class | `get_school_or_403` on every endpoint (school_id in URL) |
| Max 5 children per section | **NOT enforced here** — enforced in F-M2-6 at enrollment time |

## Security Review

- All section endpoints require JWT + RBAC
- `school_id` in URL + RBAC check prevents cross-school manipulation
- `school_class_id` validated to belong to `school_id` inside service (via `get_object_or_404(SchoolClass, school_class_id=..., school_id=...)`)
- `available-codes` doesn't expose sensitive data — just letter strings

## Testing Strategy

**Backend (`test_f_m2_4_5_structure.py` — sections portion):**
- `test_add_section_creates_row_with_correct_name` — "5th - A" stored
- `test_add_section_with_used_code_returns_409`
- `test_available_section_codes_excludes_used` — used code absent
- `test_available_section_codes_includes_soft_deleted_letters` — after soft-delete, code returns
- `test_co_cannot_add_section_to_other_school` — 403
- `test_admin_can_add_section_to_any_school` — 201
- `test_soft_delete_section_with_no_children_succeeds` — 204
- `test_soft_delete_section_with_active_children_returns_409` — includes count in message

**Manual verification:**
- [ ] CO adds section A → "5th - A" appears under class card
- [ ] CO tries adding A again → 409
- [ ] Available codes dropdown excludes A, shows B–L
- [ ] Soft-delete A → A reappears in available codes
- [ ] CO tries removing section with children → blocked with count message
- [ ] CO tries adding section to another school's class → 403

## Implementation Order

**Chunk 1 — Model**
- Create `class_section.py` (included in single M2 migration)

**Chunk 2 — Services + API**
- Create `services/structure/sections.py`
- Add section endpoints to `api/structure_api.py`

**Chunk 3 — Frontend**
- Extend class card expansion to render sections
- Create `AddSectionModal.tsx`
- Update `structure.service.ts`

## Open Questions

None. Resolved per spec:
- Available codes includes soft-deleted letters (`test_available_section_codes_includes_soft_deleted_letters` confirms this), ans - yes
- section_name caching is acceptable for M2 since class names are seeded and stable. ans - not needed for now
