# Feature Plan: F-M2-9 — Children Reactivation

## Overview

Build the reactivation flow for a deactivated child. A CO filters the Children tab to `status=inactive`, finds the child, clicks "Reactivate", picks a class and section via a cascading modal, and confirms. New active history rows are created (`ChildClass`, `ChildClassSection`, `BatchChild`, `ChildProgram`), the `Child` row is reactivated, and the current `ChildRemovalLog` is marked inactive. Old deactivated rows are preserved. All changes in a single `transaction.atomic`.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | All models already exist |
| Backend services | 1 NEW module | `services/children/reactivate.py` |
| Backend API endpoints | Modified | `api/children_api.py` — POST reactivate endpoint |
| Backend schemas | Modified | `schemas/children.py` — `ReactivateIn` schema |
| Backend migrations | No | No schema changes |
| Frontend components | 1 NEW | `ReactivateChildModal.tsx` |
| Frontend services | Modified | `children.service.ts` — add `reactivateChild` call |
| Celery tasks | No | — |
| Existing tests | None broken | — |
| Documentation | None | — |

## High-Level Design

### Data flow — CO reactivates a child

```
CO sets status filter to "Inactive"
  → Table shows deactivated children (greyed-out background)
  → CO clicks "Reactivate" on a row → ReactivateChildModal opens
  → Modal shows: class dropdown (school's active SchoolClasses),
                 section dropdown (cascades from class, shows "(Full)" on 5/5 sections)
  → CO picks class → picks section → clicks "Reactivate"
  → POST /api/schools/{schoolId}/children/{childId}/reactivate/
      {class_section_id: 42}
    → reactivate_child(child_id, class_section_id, user):
        transaction.atomic() + select_for_update on Child
          1. Lock child row; validate is_active=False (must be deactivated)
          2. RBAC check
          3. Validate target section belongs to same school as child
          4. Section capacity check (max 5)
          5. School-level capacity check (confirmed_child_count; null = unlimited)
          6. Reactivate Child: is_active=True
          7. INSERT new ChildClass (active row)
          8. INSERT new ChildClassSection (active row)
          9. INSERT new BatchChild (active row)
          10. INSERT new ChildProgram with program_id=1 (active row)
          11. Mark current ChildRemovalLog: is_active=False, removed=True, deleted_at=now
  → 200 ChildOut
  → Child disappears from inactive list; visible in active list
```

### Key architectural decisions

- **4 new history rows** are created on reactivation (`ChildClass`, `ChildClassSection`, `BatchChild`, `ChildProgram`) — old deactivated rows are NOT updated; they stay as history.
- **`ChildRemovalLog`**: the most recent `is_active=True` log is marked `is_active=False, removed=True, deleted_at=now`. If no log exists (edge case), proceed anyway.
- **`BatchChild`**: uses the same `SchoolAcademicYear` as the original enrollment — fetched from active SAY for the school.
- **`ChildProgram`**: hardcoded `program_id=1` (Foundation) as with enrollment.
- **School capacity check**: counts active `BatchChild` rows (`is_active=True, removed=False`) for the school vs. `partner.confirmed_child_count`. Reactivated child counts toward the cap.
- Old `ChildClass`, `ChildClassSection`, `BatchChild`, `ChildProgram` rows with `is_active=False, removed=True` are untouched — preserved for history audit.

## Low-Level Design

### Backend

#### Schema addition (`schemas/children.py`)

```python
class ReactivateIn(Schema):
    class_section_id: int
```

#### Service (`services/children/reactivate.py`)

```python
FOUNDATION_PROGRAM_ID = 1

def reactivate_child(child_id: int, payload: ReactivateIn, user: User) -> Child:
    with transaction.atomic():
        # 1. Lock and validate — child must be deactivated
        try:
            child = (Child.objects
                     .select_for_update()
                     .get(child_id=child_id, is_active=False)
        except Child.DoesNotExist:
            # Either not found or already active
            child_active = Child.objects.filter(
                child_id=child_id, is_active=True
            ).exists()
            if child_active:
                raise ValidationError("Child is already active.")
            raise NotFoundError("Child not found.")

        # 2. RBAC
        get_school_or_403(user, child.school_id)

        # 3. Validate target section
        section = (ClassSection.objects
                   .select_for_update()
                   .get(class_section_id=payload.class_section_id,
                        is_active=True, removed=False))

        if section.school_id != child.school_id:
            raise ValidationError("Target section belongs to a different school.")

        # 4. Section capacity check
        current_count = ChildClassSection.objects.filter(
            class_section_id=section, is_active=True, removed=False
        ).count()
        if current_count >= MAX_CHILDREN_PER_SECTION:
            raise ConflictError(
                f"Section is full ({MAX_CHILDREN_PER_SECTION}/{MAX_CHILDREN_PER_SECTION})."
            )

        # 5. School-level capacity check
        partner = Partner.objects.get(partner_id=child.school_id)
        if partner.confirmed_child_count is not None:
            active_count = BatchChild.objects.filter(
                school_id=child.school_id, is_active=True, removed=False
            ).count()
            if active_count >= partner.confirmed_child_count:
                raise ConflictError("School has reached its confirmed child limit.")

        now = timezone.now()

        # 6. Reactivate Child row
        child.is_active = True
        child.updated_by = user
        child.save(update_fields=["is_active", "updated_by", "updated_at"])

        # 7-10. Insert new active history rows
        say = SchoolAcademicYear.objects.get(
            school_id=child.school_id, is_active=True, removed=False
        )
        ChildClass.objects.create(
            child_id=child, school_class_id=section.school_class_id, created_by=user
        )
        ChildClassSection.objects.create(
            child_id=child, class_section_id=section, created_by=user
        )
        BatchChild.objects.create(
            school_academic_year_id=say, child_id=child,
            school_id=child.school_id, created_by=user
        )
        ChildProgram.objects.create(
            program_id_id=FOUNDATION_PROGRAM_ID, child_id=child, created_by=user
        )

        # 11. Mark current ChildRemovalLog inactive
        ChildRemovalLog.objects.filter(
            child_id=child, is_active=True, removed=False
        ).update(
            is_active=False, removed=True, deleted_at=now
        )

    return child
```

#### API (added to `api/children_api.py`)

```python
@children_router.post("/{school_id}/children/{child_id}/reactivate/",
                      response={200: ChildOut})
def reactivate_child_view(request, school_id: int, child_id: int,
                           payload: ReactivateIn):
    get_school_or_403(request.auth, school_id)
    return 200, reactivate_child(child_id, payload, request.auth)
```

### Frontend

#### `components/schools/children/ReactivateChildModal.tsx` — new

```tsx
// Props: { schoolId: number; child: ChildOut; onClose: () => void; onSuccess: () => void }
//
// Title: "Reactivate {child.first_name} {child.last_name}?"
// Body:
//   - Class dropdown: GET /api/schools/{schoolId}/classes/ → active SchoolClasses
//   - Section dropdown: GET /api/schools/{schoolId}/classes/{schoolClassId}/sections/
//     - Cascades from class selection
//     - Sections at 5/5 children show "(Full)" suffix and are disabled
//
// Submit: POST /api/schools/{schoolId}/children/{child.child_id}/reactivate/
// 200 → close, refresh list, success toast "Child reactivated"
// 400 section full → inline "This section is full (5/5)"
// 400 school cap → inline "School has reached its enrolled child limit"
// 400 already active → inline "Child is already active"
```

#### Zod schema (frontend)

```typescript
const reactivateSchema = z.object({
  class_section_id: z.number().positive(),
})
```

#### API integration (`lib/api/services/children.service.ts` — addition)

```typescript
export const reactivateChild = (
  schoolId: number,
  childId: number,
  data: { class_section_id: number }
) =>
  apiClient.post(
    `/api/schools/${schoolId}/children/${childId}/reactivate/`,
    data
  )
```

## Business Rules Enforced

| Rule | Enforcement |
|------|------------|
| R1 — Max 5 children per section | `reactivate_child`: capacity check on target section → 409/400 |
| `confirmed_child_count` cap | `reactivate_child`: count active BatchChild vs. cap → 409/400 |
| R9 — No hard delete | Old deactivated history rows preserved; new active rows created |
| Cannot reactivate already-active child | `.get(is_active=False)` → distinct 400 |
| Cross-school section blocked | `section.school_id == child.school_id` check → 400 |
| CO cannot reactivate another school's child | `get_school_or_403` on child's `school_id` → 403 |
| All changes atomic | `transaction.atomic` wraps all inserts + ChildRemovalLog update |

## Security Review

- `get_school_or_403(user, child.school_id)` — CO cannot reactivate a child from another school
- Target `class_section_id` cross-school check — CO cannot move child to section from another school
- `child.school_id` from DB (not URL) — cannot be spoofed
- `select_for_update` on Child and ClassSection prevents race conditions

## Testing Strategy

**Backend (`test_f_m2_7_10_children.py` — reactivation portion):**
- `test_reactivate_creates_new_active_rows` — new ChildClass, ChildClassSection, BatchChild, ChildProgram created
- `test_reactivate_marks_removal_log_inactive` — ChildRemovalLog gets `is_active=False, removed=True`
- `test_reactivate_already_active_returns_400` — 400 with "Child is already active"
- `test_reactivate_to_full_section_returns_400` — 400 when target at 5 children
- `test_reactivate_school_at_confirmed_limit_returns_400` — 400 when school at cap
- `test_reactivate_preserves_old_history_rows` — deactivated ChildClass/CCS rows still in DB
- `test_co_cannot_reactivate_other_school_child` — 403
- `test_admin_can_reactivate_any_child` — 200

**Manual verification:**
- [ ] CO sets filter to "Inactive" → deactivated children visible (greyed-out)
- [ ] CO reactivates → child appears in "Active" list
- [ ] New ChildClass, ChildClassSection, BatchChild, ChildProgram rows in DB (verify via dbshell)
- [ ] Old deactivated rows still present in DB
- [ ] ChildRemovalLog: `is_active=False, removed=True, deleted_at` set
- [ ] Target section at 5 → "(Full)" shown in dropdown; submit blocked with 400
- [ ] School at cap → 400 with clear message
- [ ] CO tries reactivating another school's child → 403
- [ ] Try reactivating already-active child → 400

## Implementation Order

**Chunk 1 — Schema + Service**
- Add `ReactivateIn` to `schemas/children.py`
- Create `services/children/reactivate.py`

**Chunk 2 — API**
- Add POST reactivate endpoint to `api/children_api.py`
- Smoke test via Swagger

**Chunk 3 — Frontend**
- Create `ReactivateChildModal.tsx`
- Update `children.service.ts`
- Wire modal into `ChildrenTab.tsx` (per-row Reactivate button, visible for inactive children)

## Open Questions

None. All resolved:
- School cap check counts active BatchChild rows — reactivated child counts toward cap
- Old deactivated rows preserved; only new active rows created on reactivation
- ChildRemovalLog update: queryset `.update()` on `is_active=True, removed=False` rows
