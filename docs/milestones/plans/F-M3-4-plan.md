# Feature Plan: F-M3-4 — CHO Scope Activation

## Overview

CHO scope has returned empty (`Partner.objects.none()`) since M1. This feature makes it real: CHO users see the schools where their `User.worknode_id` maps to a `PartnerWorknode` row with a valid `partner_id`. Within those schools, CHO has full CRUD permissions (same as CO). No new endpoints — this is a pure service-layer change that ripples through every existing school-scoped endpoint.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | `PartnerWorknode` already created in F-M3-3 |
| Backend services | Extend 2 | `services/rbac/scope.py`, login/auth service (scope_warning) |
| Backend API endpoints | Extend 1 | `GET /auth/me/permissions/` (new endpoint on existing auth router) |
| Frontend pages | Modify 1 + add hook | `/schools` list page (scope_warning message); `useUserCan` hook |
| Frontend components | 1 NEW | `useUserCan(action, schoolId)` hook |
| Database migrations | No | — |
| Celery tasks | No | — |
| Existing tests | Extend | `test_scope.py` — add CHO cases |
| Documentation | Update | `ARCHITECTURE.md` + `GLOSSARY.md` CHO scope description |

## High-Level Design

### Data flow — CHO login

```
CHO logs in
  → login service: schools_visible_to(user) → empty?
      → add scope_warning to response payload
  ← JWT + {scope_warning: {code: "no_worknode_mapping", message: "..."}}
Frontend: /schools page detects scope_warning → shows "not assigned" message
```

### Data flow — CHO school access

```
CHO opens /schools
  → GET /api/schools/
  → schools_visible_to(cho_user)
      → PartnerWorknode.filter(worknode_id=user.worknode_id)
          .exclude(partner_id__isnull=True).exclude(partner_id="")
          → partner_ids
      → Partner.filter(partner_id__in=partner_ids, is_active=True, removed=False)
  ← scoped school list
```

### Data flow — permission check (frontend)

```
CHO opens school detail
  → useUserCan('modify_school', schoolId) hook fires
  → GET /api/auth/me/permissions/?school_id={id}
  → returns {can_view: true, can_modify: true} for scoped school
  → Add/Edit/Delete buttons rendered conditionally
```

## Low-Level Design

### Backend — `services/rbac/scope.py` (EXTEND)

**Current state:** `_classify()` returns `'admin'`, `'co'`, or `'none'`. CHO → `'none'`.

**Changes:**

1. Add `CHO_ROLES = {"cho"}` constant.
2. `_classify()` returns `'cho'` for CHO users.
3. `schools_visible_to(user)` — add CHO branch:

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

4. `can_modify_school(user, partner)` — add CHO branch:

```python
if kind == "cho":
    return schools_visible_to(user).filter(partner_id=partner.partner_id).exists()
```

CHO gets **identical CRUD rights as CO** within their scoped schools.

### Backend — Login service (EXTEND)

In the login response assembly, after issuing the JWT, check if the user has no visible schools and emit `scope_warning`:

```python
if not schools_visible_to(user).exists():
    response["scope_warning"] = {
        "code": "no_worknode_mapping",
        "message": "You are not assigned to any schools or partner. Please contact your community organizer or admin.",
    }
```

Apply to any role that can have an empty scope (CHO primarily, but graceful for CO and admin too).

### Backend — `GET /api/auth/me/permissions/`

New endpoint on the existing auth router:

```
GET /api/auth/me/permissions/?school_id={id}
Auth: JWT required
Returns: {can_view: bool, can_modify: bool}
```

```python
@router.get("/me/permissions/")
def get_my_permissions(request, school_id: int):
    user = request.auth
    partner = get_object_or_404(Partner, partner_id=school_id)
    return {
        "can_view": can_view_school(user, partner),
        "can_modify": can_modify_school(user, partner),
    }
```

### Frontend — `useUserCan` hook (NEW)

```javascript
function useUserCan() {
    // Returns a function: (action, schoolId) → bool
    // Calls GET /api/auth/me/permissions/?school_id={id}
    // Caches per schoolId within the session
}

// Usage
const userCan = useUserCan();
{userCan('modify_school', schoolId) && <AddClassButton />}
```

Applies to: Add Class, Add Section, Enroll Child, Add Slot, Add Slot-Class, Edit/Delete buttons throughout school detail pages.

### Frontend — `/schools` page (MODIFY)

If `scope_warning.code == "no_worknode_mapping"` is present in the schools list response (or login response), show:

> "You are not assigned to any schools or partner. Please contact your community organizer or admin."

As a centered info card instead of an empty list.

## Business Rules Enforced

| Rule | Enforcement |
|---|---|
| R13 — Scope filtering default | All service helpers go through `schools_visible_to()` |
| CHO hybrid role not allowed | Login restricted upstream; M3 assumes single role per user |

## Security Review

- `can_modify_school()` for CHO uses `schools_visible_to()` — no way to escalate outside mapped schools
- `GET /auth/me/permissions/` only returns booleans — no data leak
- `partner_worknode` rows with null/empty `partner_id` are explicitly excluded from CHO scope

## Testing Strategy

**Backend unit tests** (`tests/rbac/test_cho_scope.py`):
- `test_cho_with_worknode_id_mapping_sees_partner`
- `test_cho_without_worknode_id_sees_empty_list_and_scope_warning`
- `test_cho_with_unmapped_worknode_id_sees_scope_warning`
- `test_cho_with_worknode_id_mapping_to_null_partner_id_sees_scope_warning`
- `test_cho_can_view_school_classes_within_scope`
- `test_cho_can_create_class_within_scope`
- `test_cho_can_create_section_within_scope`
- `test_cho_can_enroll_child_within_scope`
- `test_cho_can_create_slot_within_scope`
- `test_cho_can_create_slot_class_within_scope`
- `test_cho_cannot_view_school_outside_scope_returns_403`
- `test_cho_cannot_modify_school_outside_scope_returns_403`
- `test_cho_access_independent_of_school_volunteer`
- `test_cho_with_multiple_partner_worknode_rows_sees_all_mapped_schools`

**Manual verification:**
- [ ] CHO with valid worknode mapping logs in → sees their school in list
- [ ] CHO with no worknode_id → "not assigned" message on /schools page
- [ ] CHO with worknode_id but no matching `partner_worknode` → "not assigned" message
- [ ] CHO inside scoped school → Add/Edit/Delete buttons visible
- [ ] CHO outside scoped school → API returns 403

## Implementation Order

**Chunk 1 — Backend scope:**
1. Extend `_classify()` with CHO_ROLES
2. Extend `schools_visible_to()` CHO branch
3. Extend `can_modify_school()` CHO branch
4. Add `scope_warning` to login response
5. Add `GET /auth/me/permissions/` endpoint
6. Write `test_cho_scope.py`

**Chunk 2 — Frontend:**
1. Build `useUserCan` hook
2. Apply hook to all Add/Edit/Delete buttons in school detail pages
3. Add scope_warning empty state on `/schools` list page

**Chunk 3 — Docs update:**
1. Update `ARCHITECTURE.md` — CHO scope is now `partner_worknode`-based, not `SchoolVolunteer`-based
2. Update `GLOSSARY.md` — `SchoolVolunteer` entry (CHO access no longer computed from it)

**Dependency:** F-M3-3 (PartnerWorknode model + migration) must exist before this.

## Open Questions

None. All resolved.
