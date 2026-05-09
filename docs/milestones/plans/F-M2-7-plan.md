# Feature Plan: F-M2-7 — Children Edit

## Overview

Build the edit flow for an enrolled child. Demographic fields update in place on the `Child` row. Changing section/class creates new history rows (`ChildClassSection`, `ChildClass`) and soft-deletes the old ones. All changes are wrapped in a single `transaction.atomic` block to maintain history integrity.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | All models built in F-M2-6 |
| Backend services | 1 NEW module | `services/children/edit.py` |
| Backend API endpoints | Modified | `api/children_api.py` — PATCH endpoint added |
| Backend schemas | Modified | `schemas/children.py` — add `ChildEditIn` |
| Backend migrations | No | No schema changes |
| Frontend components | 2 NEW | `EditChildDrawer.tsx`, reuses `EnrollChildModal` field set |
| Frontend services | Modified | `children.service.ts` — add `updateChild` call |
| Celery tasks | No | — |
| Existing tests | None broken | — |
| Documentation | None | — |

## High-Level Design

### Data flow — CO edits a child

```
CO clicks "Edit" on child row → EditChildDrawer slides in from right
  → Drawer pre-fills with child's current data
  → CO edits fields (demographic and/or section)
  → PATCH /api/schools/{schoolId}/children/{childId}/
      {first_name?, last_name?, gender?, age?, class_section_id?, ...optional fields}
    → edit_child(child_id, payload, user):
        transaction.atomic() + select_for_update on Child
          1. Lock child row
          2. RBAC check: can user modify this school?
          3. Update demographic fields in place on Child
          4. If class_section_id changed:
               a. Validate target section belongs to same school
               b. Count active ChildClassSection for target → 409 if full (R1)
               c. Soft-delete current ChildClassSection
               d. INSERT new ChildClassSection
               e. If new section's school_class differs from current ChildClass:
                    - Soft-delete current ChildClass
                    - INSERT new ChildClass
  → 200 ChildOut (with updated current_section_name, current_class_name)
  → Drawer closes; row updates in table
```

### Key architectural decisions

- Demographic-only edits touch only the `Child` row — no history rows created or soft-deleted.
- Section change always creates a new `ChildClassSection` row and soft-deletes (`is_active=False, removed=True, deleted_at=now()`) the current one.
- Class change (when section is in a different class) also creates a new `ChildClass` row and soft-deletes the current one.
- `BatchChild` is NOT updated on section/class move — it tracks school+year membership, which doesn't change within a single year.
- `ChildProgram` is NOT updated — program assignment doesn't change in M2.
- `select_for_update` on `Child` prevents concurrent edits from racing.

## Low-Level Design

### Backend

#### Schema addition (`schemas/children.py`)

```python
class ChildEditIn(Schema):
    first_name:         str | None = None
    last_name:          str | None = None
    gender:             Literal["male", "female", "other"] | None = None
    age:                int | None = None
    class_section_id:   int | None = None  # if provided, triggers history rows
    date_of_birth:      date | None = None
    city:               str | None = None
    mother_tongue:      str | None = None
    date_of_enrollment: date | None = None
    mad_joining_date:   date | None = None
```

All fields optional — PATCH semantics. Only provided fields are updated.

#### Service (`services/children/edit.py`)

```python
def edit_child(child_id: int, payload: ChildEditIn, user: User) -> Child:
    with transaction.atomic():
        # 1. Lock child row
        child = (Child.objects
                 .select_for_update()
                 .get(child_id=child_id, is_active=True, removed=False))

        # 2. RBAC check
        get_school_or_403(user, child.school_id)

        # 3. Update demographic fields (only non-None values)
        demographic_fields = [
            "first_name", "last_name", "gender", "age",
            "date_of_birth", "city", "mother_tongue",
            "date_of_enrollment", "mad_joining_date",
        ]
        update_fields = ["updated_by", "updated_at"]
        for field in demographic_fields:
            val = getattr(payload, field, None)
            if val is not None:
                setattr(child, field, val)
                update_fields.append(field)
        child.updated_by = user
        child.save(update_fields=update_fields)

        # 4. Handle section/class change
        if payload.class_section_id is not None:
            new_section = (ClassSection.objects
                           .select_for_update()
                           .get(class_section_id=payload.class_section_id,
                                is_active=True, removed=False))

            # 4a. Cross-school check
            if new_section.school_id != child.school_id:
                raise ValidationError("Target section belongs to a different school.")

            # 4b. Section capacity check
            current_count = ChildClassSection.objects.filter(
                class_section_id=new_section, is_active=True, removed=False
            ).count()
            if current_count >= MAX_CHILDREN_PER_SECTION:
                raise ConflictError(
                    f"Section is full ({MAX_CHILDREN_PER_SECTION}/{MAX_CHILDREN_PER_SECTION})."
                )

            # Get current active section
            now = timezone.now()
            current_ccs = ChildClassSection.objects.filter(
                child_id=child, is_active=True, removed=False
            ).first()

            if current_ccs and current_ccs.class_section_id_id != payload.class_section_id:
                # 4c. Soft-delete current ChildClassSection
                current_ccs.is_active = False
                current_ccs.removed = True
                current_ccs.deleted_at = now
                current_ccs.updated_by = user
                current_ccs.save()

                # 4d. Insert new ChildClassSection
                ChildClassSection.objects.create(
                    child_id=child,
                    class_section_id=new_section,
                    created_by=user,
                )

                # 4e. Handle class change if needed
                current_cc = ChildClass.objects.filter(
                    child_id=child, is_active=True, removed=False
                ).first()
                new_school_class_id = new_section.school_class_id_id

                if current_cc and current_cc.school_class_id_id != new_school_class_id:
                    current_cc.is_active = False
                    current_cc.removed = True
                    current_cc.deleted_at = now
                    current_cc.updated_by = user
                    current_cc.save()

                    ChildClass.objects.create(
                        child_id=child,
                        school_class_id=new_section.school_class_id,
                        created_by=user,
                    )
    return child
```

#### API (added to `api/children_api.py`)

```python
@children_router.patch("/{school_id}/children/{child_id}/", response=ChildOut)
def edit_child_view(request, school_id: int, child_id: int, payload: ChildEditIn):
    get_school_or_403(request.auth, school_id)
    return edit_child(child_id, payload, request.auth)
```

### Frontend

#### `components/schools/children/EditChildDrawer.tsx` — new

```tsx
// Props: { schoolId: number; child: ChildOut; onClose: () => void; onSuccess: () => void }
// Slides in from right (Drawer component)
// Pre-fills all fields from `child` prop
// Class + Section dropdowns cascade (same logic as EnrollChildModal)
// Section change shows banner: "Changing section will preserve history"
// Submit: PATCH /api/schools/{schoolId}/children/{child.child_id}/
// 200 → close, refresh list, success toast
// 400 target full → inline "This section is full"
// 400 wrong school → inline "Section does not belong to this school"
```

#### API integration (`lib/api/services/children.service.ts` — addition)

```typescript
export const updateChild = (schoolId: number, childId: number, data: Partial<ChildEditIn>) =>
  apiClient.patch(`/api/schools/${schoolId}/children/${childId}/`, data)
```

#### Form validation (Zod — partial schema for edits)

```typescript
const editChildSchema = z.object({
  first_name:         z.string().min(1).optional(),
  last_name:          z.string().min(1).optional(),
  gender:             z.enum(["male", "female", "other"]).optional(),
  age:                z.number().int().positive().optional(),
  class_section_id:   z.number().positive().optional(),
  date_of_birth:      z.string().optional(),
  city:               z.string().optional(),
  mother_tongue:      z.string().optional(),
  date_of_enrollment: z.string().optional(),
  mad_joining_date:   z.string().optional(),
})
```

## Business Rules Enforced

| Rule | Enforcement |
|------|------------|
| R1 — Max 5 children per section | `edit_child`: capacity check on target section before new `ChildClassSection` |
| R9 — No hard delete | Old `ChildClassSection` / `ChildClass` rows soft-deleted, not deleted |
| Cross-school section blocked | `new_section.school_id == child.school_id` check in service → 400 |
| CO cannot edit another school's child | `get_school_or_403` on child's `school_id` → 403 |
| All changes atomic | `transaction.atomic` + `select_for_update` on Child |

## Security Review

- `get_school_or_403(user, child.school_id)` — CO cannot edit a child enrolled at another school
- `class_section_id` cross-school check in service — CO cannot move child to section from another school
- `select_for_update` on Child prevents concurrent edit race conditions
- Response shape (`ChildOut`) does not expose `created_by`, internal FKs

## Testing Strategy

**Backend (`test_f_m2_7_10_children.py` — edit portion):**
- `test_edit_child_demographic_fields_only` — Child row updated, no history rows touched
- `test_edit_child_changes_section_creates_history` — old CCS soft-deleted, new CCS created
- `test_edit_child_changes_class_creates_history` — old CC soft-deleted, new CC created
- `test_edit_child_to_full_section_returns_400` — 400 when target at 5 children
- `test_edit_child_to_other_school_section_returns_400` — 400 on cross-school section
- `test_edit_child_history_query_returns_all_assignments` — old rows queryable via DB
- `test_co_cannot_edit_other_school_child` — 403
- `test_admin_can_edit_any_child` — 200
- `test_edit_child_runs_in_single_transaction` — simulate error mid-transaction, verify rollback

**Manual verification:**
- [ ] Edit name only → only `Child` row updated; history rows unchanged
- [ ] Change section within same class → new `ChildClassSection` row; old marked `is_active=false, removed=true`
- [ ] Change section to different class → both `ChildClass` and `ChildClassSection` history rows updated
- [ ] Target section at 5 → 400 with "Section is full"
- [ ] Target section from other school → 400
- [ ] CO tries editing another school's child → 403

## Implementation Order

**Chunk 1 — Schema + Service**
- Add `ChildEditIn` to `schemas/children.py`
- Create `services/children/edit.py`

**Chunk 2 — API**
- Add PATCH endpoint to `api/children_api.py`
- Smoke test via Swagger

**Chunk 3 — Frontend**
- Create `EditChildDrawer.tsx`
- Update `children.service.ts`
- Wire drawer into `ChildrenTab.tsx` (per-row Edit button)

## Open Questions

None. All resolved:
- `BatchChild` not updated on section/class move (tracks school+year membership, unchanged within year)
- `ChildProgram` not updated (program doesn't change in M2)
- PATCH semantics: only provided fields updated
