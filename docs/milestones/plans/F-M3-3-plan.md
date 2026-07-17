# Feature Plan: F-M3-3 — Volunteer Auto-Population (Worknode Matching)

## Overview

Volunteers are no longer manually assigned in Session-Ops. Instead, the Volunteers tab auto-populates by resolving the school's `partner_worknode` mapping from Hasura → finding the `worknode_id` → querying `User` rows with that `worknode_id`. This feature also extends the Hasura sync to write `User.worknode_id` and upsert the new `PartnerWorknode` table.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | Extend + 1 NEW | `User` (+worknode_id field); new `PartnerWorknode` model |
| Backend services | Extend + 1 NEW | Extend `services/sync.py`; new `services/volunteers/list.py` |
| Backend API endpoints | 1 NEW | `GET /api/schools/{school_id}/volunteers/` |
| Frontend pages | Modified | Volunteers tab content wired in (F-M3-1 activated tab) |
| Frontend components | 1 NEW | `VolunteerListTab.tsx` with `VolunteerCard` |
| Database migrations | Yes | Migration A: User.worknode_id + PartnerWorknode table |
| Celery tasks | No | Sync is cron-based; no new tasks |
| Existing tests | Extend | `test_sync.py` — new worknode sync cases |
| Documentation | None | — |

## High-Level Design

### Data flow

```
CO opens Volunteers tab
  → GET /api/schools/{school_id}/volunteers/
  → list_school_volunteers(school_id, user)
      → can_user_view_school() check → 403 if fails
      → PartnerWorknode.filter(partner_id=str(school_id)) → worknode_ids
      → if empty → return {status: "no_worknode", ...}
      → User.filter(worknode_id__in=worknode_ids, is_active=True, removed=False)
      → if empty → return {status: "no_volunteers", ...}
      → for each user: count active SlotClassSectionVolunteer rows at this school
  ← {status: "ok", volunteers: [{user_id, user_display_name, user_login, user_role, active_slot_class_count}]}
```

### Sync flow

```
Cron job triggers run_sync()
  → _run_users_phase(): writes worknode_id from Hasura user_data onto User rows
  → _run_partner_worknode_phase(): upserts PartnerWorknode from chapter_mapping API
      key: partner_id (from Hasura chapter_id field)
      removes rows no longer in Hasura
```

### Key decisions

- `partner_id` is stored as `CharField` (Bubble convention — numeric but string-typed)
- No soft-delete on `PartnerWorknode` — hard-delete on removal is correct (sync mirror, not domain data)
- `active_slot_class_count` is computed per-volunteer in the list service (N queries but bounded by volunteer count; add `prefetch_related` if perf becomes an issue post-launch)

## Low-Level Design

### Backend — Models

#### Migration A additions

**`User.worknode_id`** (extend `models/user.py`):

```python
worknode_id = models.IntegerField(null=True, blank=True, db_index=True)
```

**`PartnerWorknode`** (new file `models/partner_worknode.py`):

```python
class PartnerWorknode(models.Model):
    partner_worknode_id    = models.BigAutoField(primary_key=True)
    partner_id             = models.CharField(max_length=100, db_index=True)
    worknode_id            = models.IntegerField(db_index=True)
    city_name              = models.CharField(max_length=200, null=True, blank=True)
    state                  = models.CharField(max_length=200, null=True, blank=True)
    co_name                = models.TextField(null=True, blank=True)
    chapter_name           = models.CharField(max_length=200, null=True, blank=True)
    engine                 = models.CharField(max_length=100, null=True, blank=True)
    chapter_status         = models.CharField(max_length=50, null=True, blank=True)
    sourcing_campaign_code = models.TextField(null=True, blank=True)
    campaign_name          = models.CharField(max_length=200, null=True, blank=True)
    fundraiser_id          = models.CharField(max_length=100, null=True, blank=True)
    fundraiser_name        = models.TextField(null=True, blank=True)
    created_at             = models.DateTimeField(auto_now_add=True)
    updated_at             = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "partner_worknode"
        indexes = [
            models.Index(fields=["partner_id"]),
            models.Index(fields=["worknode_id"]),
        ]
```

Register both in `models/__init__.py`.

### Backend — Services

#### `services/volunteers/list.py` (NEW)

`list_school_volunteers(school_id, requesting_user) -> dict`

```python
def list_school_volunteers(school_id, requesting_user):
    if not can_user_view_school(requesting_user, school_id):
        raise PermissionDenied()

    worknode_ids = PartnerWorknode.objects.filter(
        partner_id=str(school_id),
    ).values_list("worknode_id", flat=True).distinct()

    if not worknode_ids:
        return {
            "status": "no_worknode",
            "message": "No Worknode found for this school. Please contact admin.",
            "volunteers": [],
        }

    volunteers = User.objects.filter(
        worknode_id__in=list(worknode_ids),
        is_active=True,
        removed=False,
    ).order_by("user_display_name")

    if not volunteers.exists():
        return {
            "status": "no_volunteers",
            "message": "No volunteers found for this school. Please make sure you've tagged the Worknode in user management.",
            "volunteers": [],
        }

    serialized = []
    for v in volunteers:
        active_slot_class_count = SlotClassSectionVolunteer.objects.filter(
            volunteer_id=v,
            is_active=True,
            removed=False,
            slot_class_section_id__slot_id__school_id=school_id,
        ).count()
        serialized.append({
            "user_id": v.user_id,
            "user_display_name": v.user_display_name,
            "user_login": v.user_login,
            "user_role": v.user_role,
            "active_slot_class_count": active_slot_class_count,
        })

    return {"status": "ok", "volunteers": serialized}
```

#### `services/sync.py` — EXTEND

1. In `_build_user_obj()`: map `worknode_id` from the Hasura user payload (field name TBC from Hasura schema — likely `worknode_id`).

2. Add `_run_partner_worknode_phase(rows)`:

```python
def _run_partner_worknode_phase(rows: list[dict]):
    """Upsert PartnerWorknode from Hasura chapter_mapping.
    Hasura field 'chapter_id' maps to our 'partner_id'. Key: partner_id.
    """
    incoming_partner_ids = set()
    for row in rows:
        partner_id = str(row["chapter_id"])
        incoming_partner_ids.add(partner_id)
        PartnerWorknode.objects.update_or_create(
            partner_id=partner_id,
            defaults={
                "worknode_id":            row["worknode_id"],
                "city_name":              row.get("city_name"),
                "state":                  row.get("state"),
                "co_name":                row.get("co_name"),
                "chapter_name":           row.get("chapter_name"),
                "engine":                 row.get("engine"),
                "chapter_status":         row.get("chapter_status"),
                "sourcing_campaign_code": row.get("sourcing_campaign_code"),
                "campaign_name":          row.get("campaign_name"),
                "fundraiser_id":          row.get("fundraiser_id"),
                "fundraiser_name":        row.get("fundraiser_name"),
            },
        )
    # Remove rows no longer present in Hasura
    PartnerWorknode.objects.exclude(partner_id__in=incoming_partner_ids).delete()
```

Hasura API: `GET /api/rest/chapter_mapping?chapter_validation=true`
Response root key: `prod_external_apps_chapter_mapping`
Ignored Hasura fields: `chapter_validation`, `cho_id`, `cho_name`, `co_id`

3. Call `_run_partner_worknode_phase()` from `run_sync()`.

### Backend — Schemas

```python
class VolunteerCardSchema(Schema):
    user_id: int
    user_display_name: str
    user_login: str
    user_role: str
    active_slot_class_count: int

class VolunteerListResponseSchema(Schema):
    status: str          # "ok" | "no_worknode" | "no_volunteers"
    message: str | None = None
    volunteers: list[VolunteerCardSchema]
```

### Backend — Endpoint

**`api/volunteers_api.py`** (NEW)

| Method | Path | Auth | RBAC | Response |
|---|---|---|---|---|
| GET | `/schools/{school_id}/volunteers/` | JWT | `can_view_school` (CO/admin/CHO) | `VolunteerListResponseSchema` |

Returns 200 in all cases (including no_worknode / no_volunteers). Returns 403 if user cannot view school.

### Frontend

**`VolunteerListTab.tsx`** (NEW):
- Calls `GET /schools/{schoolId}/volunteers/`
- Renders `VolunteerCard` list when `status == "ok"`
- Two empty states driven by `status` field:
  - `no_worknode` → "No Worknode found for this school. Please contact admin."
  - `no_volunteers` → "No volunteers found for this school. Please make sure you've tagged the Worknode in user management."
- Header: "Volunteers ({count})"
- No action buttons (read-only)

**`VolunteerCard.tsx`** (NEW):
- Shows: `user_display_name`, `user_login`, `user_role`
- Shows: "{N} active class assignment{s}" badge (0 when not teaching)
- No three-dot menu, no actions

## Business Rules Enforced

| Rule | Enforcement |
|---|---|
| R13 — Scope filtering default | `can_user_view_school()` called before any data access |
| R16 — Sync idempotency | `update_or_create` on `partner_id`; replay-safe |

## Security Review

- `GET /volunteers/` requires JWT; 403 if not in scope
- `partner_worknode` metadata (city_name, co_name, etc.) is never returned to frontend — only `user_*` fields from User table
- `active_slot_class_count` is scoped to the current school only

## Testing Strategy

**Backend unit tests** (`tests/volunteers/test_list_volunteers.py`):
- `test_list_school_volunteers_returns_users_with_matching_worknode_id`
- `test_list_school_volunteers_no_partner_worknode_returns_no_worknode_status`
- `test_list_school_volunteers_no_matching_users_returns_no_volunteers_status`
- `test_list_school_volunteers_excludes_inactive_users`
- `test_list_school_volunteers_excludes_removed_users`
- `test_list_school_volunteers_includes_active_slot_class_count`
- `test_list_school_volunteers_dedupe_when_multiple_worknode_rows`
- `test_list_school_volunteers_returns_403_for_co_without_school_access`
- `test_list_school_volunteers_renders_for_cho_with_school_access`

**Sync tests** (`tests/sync/test_worknode_sync.py`):
- `test_user_data_sync_writes_worknode_id`
- `test_partner_worknode_sync_upserts_rows`
- `test_partner_worknode_sync_removes_dropped_rows`

**Manual verification:**
- [ ] Run sync → `partner_worknode` table populated
- [ ] CO opens Volunteers tab for school with matching Worknode → sees volunteer list
- [ ] School with no `partner_worknode` row → "No Worknode found" message
- [ ] `partner_worknode` exists but no matching Users → "No volunteers found" message
- [ ] Inactive user with matching worknode_id excluded from list

## Implementation Order

**Chunk 1 — Schema + migration:**
1. Add `worknode_id` to `User`
2. Create `PartnerWorknode` model
3. Register in `__init__.py`
4. Write and run Migration A (User.worknode_id + PartnerWorknode)

**Chunk 2 — Sync extension:**
1. Extend `_build_user_obj()` with worknode_id
2. Add `_run_partner_worknode_phase()`
3. Wire into `run_sync()`
4. Write sync tests

**Chunk 3 — Service + endpoint:**
1. Write `services/volunteers/list.py`
2. Write `api/volunteers_api.py`
3. Write volunteer list tests

**Chunk 4 — Frontend:**
1. Build `VolunteerCard.tsx`
2. Build `VolunteerListTab.tsx`
3. Activate tab (F-M3-1)

## Open Questions

None. All resolved:
- `user_display_name` + `user_login` confirmed as the display fields
- Hasura field mapping confirmed: `chapter_id` → `partner_id`; ignored: `chapter_validation`, `cho_id`, `cho_name`, `co_id`
- Response root key: `prod_external_apps_chapter_mapping`

---

## Amendments (post-implementation)

### A1 — Fix `active_slot_class_count` (was always 0)

**File:** `services/volunteers/list.py`

The original implementation hard-coded `active_slot_class_count: 0` with a comment deferring to F-M3-7. `SlotClassSectionVolunteer` already exists, so the count is now computed:

```python
active_slot_class_count = SlotClassSectionVolunteer.objects.filter(
    volunteer_id=v,
    is_active=True,
    removed=False,
    slot_class_section_id__slot_id__school_id=school_id,
).count()
```

Traversal: `SlotClassSectionVolunteer → SlotClassSection → Slot → school_id (BigIntegerField)`.

### A2 — Volunteer detail fields in API response

**Files:** `services/volunteers/list.py`, `schemas/volunteers.py`

Added `email`, `contact`, `city`, `state` to the serialized volunteer dict and schema:

```python
class VolunteerCardSchema(Schema):
    ...
    email: str
    contact: str | None = None
    city: str | None = None
    state: str | None = None
```

`contact`, `city`, `state` are nullable (`null=True` on the model).

### A3 — Volunteer detail drawer (frontend)

**Files:** `VolunteerCard.tsx`, `VolunteerDetailDrawer.tsx`, `VolunteerListTab.tsx`

- `VolunteerCard` is now clickable (hover highlight + pointer cursor). Added `onClick` prop.
- New `VolunteerDetailDrawer` — MUI `Drawer` anchored right, slides in on card click. Shows: teaching badge, `user_id`, `email`, `user_login`, `contact`, `city`, `state`.
- `VolunteerListTab` manages `selected: VolunteerCard | null` state and renders the drawer.

### A3 — New test cases

Added to `tests/test_f_m3_3_volunteers.py`:

**`TestListSchoolVolunteers` (new):**
- `test_list_school_volunteers_returns_contact_detail_fields` — email, contact, city, state present and correct
- `test_list_school_volunteers_returns_null_for_missing_contact_fields` — nullable fields return None when not set

**`TestActiveSlotClassCount` (new class):**
- `test_active_slot_class_count_reflects_actual_assignments` — count is 1 after one assignment
- `test_active_slot_class_count_zero_when_no_assignments` — count is 0 with no assignments
- `test_active_slot_class_count_ignores_other_school_assignments` — cross-school isolation
- `test_active_slot_class_count_ignores_removed_assignments` — removed=True rows excluded
- `test_active_slot_class_count_increments_for_multiple_assignments` — count is 2 with two assignments
