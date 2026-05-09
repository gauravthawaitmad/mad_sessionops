# Feature Plan: F-M2-8 — Children Deactivation

## Overview

Build the deactivation flow for an enrolled child. CO clicks "Deactivate" on a child row, selects a removal reason from an 8-option dropdown, and confirms. On submit: the `Child` row and all active history rows are soft-deleted, and a `ChildRemovalLog` row is created. The child disappears from the default "Active" list. "Other" reason requires `other_details`. All changes in a single `transaction.atomic`.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | `ChildRemovalLog` model built in F-M2-6 |
| Backend services | 1 NEW module | `services/children/deactivate.py` |
| Backend API endpoints | Modified | `api/children_api.py` — POST deactivate endpoint |
| Backend schemas | Modified | `schemas/children.py` — `DeactivateIn` schema |
| Backend migrations | No | No schema changes |
| Frontend components | 1 NEW | `DeactivateChildModal.tsx` |
| Frontend services | Modified | `children.service.ts` — add `deactivateChild` call |
| Celery tasks | No | — |
| Existing tests | None broken | — |
| Documentation | None | — |

## High-Level Design

### Data flow — CO deactivates a child

```
CO clicks "Deactivate" on child row → DeactivateChildModal opens
  → Modal shows: reason dropdown (8 options) + optional "Additional details"
  → "Additional details" becomes required when reason = "other"
  → CO picks reason, clicks "Deactivate"
  → POST /api/schools/{schoolId}/children/{childId}/deactivate/
      {removed_reason: "transferred", other_details: null}
    → deactivate_child(child_id, payload, user):
        transaction.atomic()
          1. Lock child row; validate is_active=True, removed=False
          2. RBAC check
          3. Validate: if reason == "other", other_details required
          4. now = timezone.now()
          5. Set Child: is_active=False
          6. Soft-delete all ChildClass rows for this child (is_active=False, removed=True, deleted_at=now)
          7. Soft-delete all ChildClassSection rows for this child
          8. Soft-delete all BatchChild rows for this child
          9. Soft-delete all ChildProgram rows for this child
          10. INSERT ChildRemovalLog(child_id, co_id=user.user_id, school_id,
                                     removed_reason, other_details,
                                     removed_datetime=now, is_active=True)
  → 200 OK (or 204)
  → Child disappears from active list; visible under status=inactive filter
```

### Key architectural decisions

- **Bulk soft-delete** on history tables: `ChildClass.objects.filter(child_id=child, is_active=True, removed=False).update(is_active=False, removed=True, deleted_at=now, updated_by=user)`. Use queryset `.update()` for efficiency — avoids N+1.
- **`ChildRemovalLog.is_active=True`** on creation — means "this removal is the current state." Reactivation (F-M2-9) will flip this to `is_active=False, removed=True`.
- **`co_id`** on `ChildRemovalLog` is a loose FK (integer, `db_constraint=False`) to `user.user_id` — stores who performed the deactivation.
- **Re-deactivation** (deactivating a child who was previously deactivated then reactivated): creates a fresh `ChildRemovalLog` row. History is always preserved.

## Low-Level Design

### Backend

#### Schema addition (`schemas/children.py`)

```python
REMOVED_REASONS = [
    "inactive", "duplicate_entry", "wrong_school_class", "transferred",
    "dropped_out", "family_declined", "child_declined", "other",
]

class DeactivateIn(Schema):
    removed_reason: Literal[
        "inactive", "duplicate_entry", "wrong_school_class", "transferred",
        "dropped_out", "family_declined", "child_declined", "other"
    ]
    other_details: str | None = None

    @model_validator(mode="after")
    def require_details_for_other(self):
        if self.removed_reason == "other" and not self.other_details:
            raise ValueError("other_details is required when reason is 'other'")
        return self
```

#### Service (`services/children/deactivate.py`)

```python
def deactivate_child(child_id: int, payload: DeactivateIn, user: User) -> None:
    with transaction.atomic():
        # 1. Lock and validate
        child = (Child.objects
                 .select_for_update()
                 .get(child_id=child_id, is_active=True, removed=False))

        # 2. RBAC
        get_school_or_403(user, child.school_id)

        now = timezone.now()

        # 3-9. Soft-delete child and all history rows
        Child.objects.filter(child_id=child_id).update(
            is_active=False, updated_by=user
        )
        ChildClass.objects.filter(
            child_id=child_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_by=user)

        ChildClassSection.objects.filter(
            child_id=child_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_by=user)

        BatchChild.objects.filter(
            child_id=child_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_by=user)

        ChildProgram.objects.filter(
            child_id=child_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_by=user)

        # 10. Create removal log
        ChildRemovalLog.objects.create(
            child_id=child,
            co_id=user.user_id,
            school_id=child.school_id,
            removed_reason=payload.removed_reason,
            other_details=payload.other_details,
            removed_datetime=now,
            is_active=True,
            removed=False,
        )
```

#### API (added to `api/children_api.py`)

```python
@children_router.post("/{school_id}/children/{child_id}/deactivate/",
                      response={200: None})
def deactivate_child_view(request, school_id: int, child_id: int,
                          payload: DeactivateIn):
    get_school_or_403(request.auth, school_id)
    deactivate_child(child_id, payload, request.auth)
    return 200, None
```

### Frontend

#### `components/schools/children/DeactivateChildModal.tsx` — new

```tsx
// Props: { schoolId: number; child: ChildOut; onClose: () => void; onSuccess: () => void }
//
// Fields:
//   - Removal reason: <select> with 8 options (value = key, label = display string)
//       "inactive"           → "Inactive"
//       "duplicate_entry"    → "Duplicate entry"
//       "wrong_school_class" → "Added to wrong school/class by mistake"
//       "transferred"        → "Transferred to another school"
//       "dropped_out"        → "Dropped out of school"
//       "family_declined"    → "Family does not want the child enrolled"
//       "child_declined"     → "Child no longer interested in participating"
//       "other"              → "Other"
//   - Additional details: <textarea> — hidden unless reason = "other"; required when visible
//
// Title: "Deactivate child: {child.first_name} {child.last_name}?"
// Buttons: "Cancel" (secondary), "Deactivate" (red/destructive)
//
// Submit: POST /api/schools/{schoolId}/children/{child.child_id}/deactivate/
// 200 → close, refresh list, success toast "Child deactivated"
// 400 (missing other_details) → inline error under textarea
```

#### Zod schema (frontend)

```typescript
const deactivateSchema = z.object({
  removed_reason: z.enum([
    "inactive", "duplicate_entry", "wrong_school_class", "transferred",
    "dropped_out", "family_declined", "child_declined", "other",
  ]),
  other_details: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.removed_reason === "other" && !data.other_details?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please provide additional details",
      path: ["other_details"],
    })
  }
})
```

#### API integration (`lib/api/services/children.service.ts` — addition)

```typescript
export const deactivateChild = (
  schoolId: number,
  childId: number,
  data: { removed_reason: string; other_details?: string }
) =>
  apiClient.post(
    `/api/schools/${schoolId}/children/${childId}/deactivate/`,
    data
  )
```

## Business Rules Enforced

| Rule | Enforcement |
|------|------------|
| R9 — No hard delete | Soft-delete pattern: all rows preserved with `is_active=False, removed=True, deleted_at` set |
| "Other" requires details | `model_validator` in `DeactivateIn` (backend 400) + Zod `superRefine` (frontend) |
| All changes atomic | `transaction.atomic` wraps all updates + ChildRemovalLog insert |
| CO cannot deactivate another school's child | `get_school_or_403` on child's `school_id` → 403 |
| Cannot deactivate already-inactive child | `.get(is_active=True, removed=False)` → 404 if not found |

## Security Review

- `get_school_or_403(user, child.school_id)` — CO cannot deactivate a child at another school
- `child.school_id` from DB (not URL) — cannot be spoofed via request
- `co_id` stored as `user.user_id` from JWT, not from request body
- `ChildRemovalLog` does not expose sensitive data in response (no data returned, just 200)

## Testing Strategy

**Backend (`test_f_m2_7_10_children.py` — deactivation portion):**
- `test_deactivate_child_marks_all_history_inactive` — Child + ChildClass + ChildClassSection + BatchChild + ChildProgram all soft-deleted
- `test_deactivate_creates_removal_log` — ChildRemovalLog row created with correct fields
- `test_deactivate_with_other_reason_requires_details` — 400 if reason=other and no other_details
- `test_deactivate_runs_in_single_transaction` — simulate error after Child update; verify rollback
- `test_co_cannot_deactivate_other_school_child` — 403
- `test_admin_can_deactivate_any_child` — 200
- `test_deactivate_already_removed_child_returns_404` — 404 if child already inactive

**Manual verification:**
- [ ] CO deactivates child with reason "Transferred" → child gone from active list
- [ ] Child visible under `status=inactive` filter
- [ ] All 5 history tables soft-deleted (verify via dbshell)
- [ ] `ChildRemovalLog` row has correct `co_id`, `removed_reason`, `removed_datetime`
- [ ] Deactivate with reason "Other" and no details → form blocked (frontend) + 400 (backend)
- [ ] Deactivate with reason "Other" and details → 200
- [ ] CO tries deactivating another school's child → 403
- [ ] Try deactivating already-inactive child → 404

## Implementation Order

**Chunk 1 — Schema + Service**
- Add `DeactivateIn` to `schemas/children.py`
- Create `services/children/deactivate.py`

**Chunk 2 — API**
- Add POST deactivate endpoint to `api/children_api.py`
- Smoke test via Swagger

**Chunk 3 — Frontend**
- Create `DeactivateChildModal.tsx`
- Update `children.service.ts`
- Wire modal into `ChildrenTab.tsx` (per-row Deactivate button)

## Open Questions

None. All resolved:
- Re-deactivation creates a fresh `ChildRemovalLog` row (always preserve history)
- `co_id` is a loose FK (db_constraint=False) to avoid enforcing FK on user table
