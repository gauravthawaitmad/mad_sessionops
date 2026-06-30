# Milestone 8a — Realtime Sync Business Logic

**Duration:** ~2 weeks (~8-10 build days, ~2 stabilize days)
**Production domain:** https://sessionops.makeadiff.in
**Status:** In progress — F-M8a-1 and F-M8a-2 complete
**Last updated:** 2026-06-17

---

# Part 1 — Milestone Overview

## Production goal

At the end of M8a, Session-Ops has a complete realtime sync business logic layer for user data, callable as an internal endpoint:

1. A single internal endpoint accepts enriched user data and applies full business logic — diff detection, role allowlist filtering, worknode_id cascade flows, and user deactivation
2. The endpoint is callable manually by admins from the sync admin tab
3. Same endpoint is the contract for future M8b (n8n / custom webhook) integration — whatever calls it later, the business logic is built and tested
4. Every sync event is logged comprehensively in a new `realtime_sync_log` table
5. The `school_volunteer` table lifecycle moves out of slot-class create transaction into realtime sync
6. Admin can view all sync events through a new Realtime Events admin tab with filters and detail views

The endpoint receives **already-enriched user payloads** (not raw Hasura table events). The work of fetching enriched data from Hasura lives in whatever caller drives the endpoint — n8n in the future, custom webhook receiver alternatively, or admin-triggered manual sync today.

## What does NOT ship in M8a

Hard out-of-scope. Don't build any of these in M8a.

- **Hasura GET API calls from Session-Ops.** The endpoint receives enriched payloads; it does not fetch them. Whatever sits in front (n8n / webhook receiver) is responsible for fetching from Hasura.
- **Webhook receiver from Hasura.** That's M8b/M9.
- **n8n setup or workflow configuration.** That's M8b/M9.
- **Automatic retry on failure.** Admin manually re-triggers if needed. Retry policy belongs in the orchestration layer (M8b).
- **Notification system for failed syncs.** Failures are visible in Realtime Events tab; no alerts in M8a.
- **Partial completion of worknode cascade.** If school can't be resolved for a worknode_id, the cascade does NOT proceed partially. Only common fields update, the rest is deferred. See key decision #11.
- **Automatic reconciliation of partial_success entries.** Admin manually re-triggers the sync after underlying data is corrected.
- **partner_worknode change → user re-sync.** If partner_worknode mapping changes for an existing worknode_id, Session-Ops doesn't automatically re-evaluate affected users. (Confirmed acceptable — won't happen in practice.)
- **Cron sync for user_data going through this endpoint.** M4's cron sync for user_data continues to function on its existing path. M8a doesn't change that. The new endpoint is a parallel path, not a replacement.
- **External alerting (email, Sentry, Slack) for sync failures.** Logged in DB, viewable in admin tab.
- **Bulk sync** — endpoint handles one user at a time. No batch endpoints.

> If something here turns out to be unexpectedly needed for M8a, talk to the human first before adding scope.

## Key architectural decisions for M8a

**1. Single internal endpoint.** `POST /api/internal/sync-user/` accepts an enriched user payload + event metadata. This endpoint is the contract between Session-Ops and any orchestration layer (n8n, custom webhook, manual admin trigger).

**2. Enriched payload is provided by the caller.** Session-Ops does NOT call Hasura. The caller (n8n or admin UI's "Sync user" form) is responsible for fetching enriched user state from Hasura's joined-query API and POSTing it to Session-Ops.

**3. Role allowlist is the first gate.** Every incoming event first checks: is this user's role in the allowlist for this event type? If not, skip with `status='skipped_role_not_allowed'`. Allowlists:
- INSERT/UPDATE: Youth, Wingman, Project Associate, Fellow, CHO, CO Part Time, Function Lead, CO Full Time, Academic Support, Admin, Project Lead (11 roles)
- DEACTIVATE: Alumni, null (2 values)

**4. Diff is computed locally, not trusted from caller.** Session-Ops reads the current local user state, compares against the incoming enriched payload, and computes the field changes. The caller's "what changed" hints are not trusted (different table schemas, different join contexts).

**5. Three primary flows.** Based on diff + role allowlist:
- INSERT — user doesn't exist locally OR exists but is_active=false (re-activation)
- UPDATE — user exists, fields changed, role still in update allowlist
- DEACTIVATE — role changed to a deactivation role (Alumni, null)

**6. Worknode_id changes get sub-flows.** Within UPDATE, three sub-cases based on worknode_id before/after:
- worknode_added (was null/empty, now set)
- worknode_updated (set value changed to different set value)
- worknode_removed (was set, now null/empty)

**7. Cascade reuses M3 services.** The slot_class_section_volunteer + class_section_subject + child_subject soft-delete cascade already exists in M3's `delete_slot_class` and `_reconcile_school_volunteer_for_volunteers` helpers. M8a calls into these — no new cascade logic.

**8. `school_volunteer` lifecycle moves to realtime sync.** In M3, school_volunteer rows were created inside slot-class create. In M8a, that side-effect is removed. school_volunteer is created/soft-deleted by realtime sync based on worknode_id changes. M3's `_reconcile_school_volunteer_for_volunteers` helper is removed entirely (its responsibility now lives in the sync flows).

**9. Concurrent processing for same user is serialized.** `select_for_update` lock on the local user row ensures two simultaneous sync events for the same user_id process sequentially. The second one sees the result of the first.

**10. Stale events are skipped.** Each sync event compares its `xModifiedTimestamp` (or equivalent timestamp from the enriched payload) against the local user's stored timestamp. If incoming is older → `status='skipped_stale'`. Handles out-of-order delivery from any caller.

**11. Missing school for worknode_id → partial_success, common fields only.** When a worknode_id is set but `partner_worknode` table has no matching row (or matching row has no partner_id), the cascade does NOT run partially. Only common fields update. The new worknode_id is NOT written to the local user row (stays at old value to preserve consistency with school_volunteer state). `status='partial_success'`, `action_taken='no_school_found_for_worknode'`, `deferred_operations` JSON captures what was skipped. Admin re-triggers later after partner_worknode is corrected.

**12. Comprehensive sync log.** Every event written to `realtime_sync_log`, including skipped/no-change cases. Storage is cheap, observability is valuable. Includes pre-snapshot, distilled field-level diffs, cascaded changes, rules fired, and error details when applicable.

**13. Dual auth on endpoint from M8a.** The endpoint accepts admin JWT (roles: Function Lead / Project Associate / Project Lead) OR a service token via `Authorization: Bearer`. Service token is validated against `INTERNAL_SYNC_SERVICE_TOKEN` env var. n8n uses the service token path; admin UI uses admin JWT. Both return the same response shape.

**14. Endpoint URL is non-obvious.** Endpoint URL stored in environment variable, not at a predictable path. Security through obscurity is one layer; admin JWT is the other.

**15. Manual sync flow uses same business logic.** When admin uses "Sync user" in the admin UI, the request goes through exactly the same business logic as any future automated trigger. No separate code path.

**16. M4's M3 `_reconcile_school_volunteer_for_volunteers` is deleted.** The helper goes away. Its work is now done inside the realtime sync flows when worknode_id changes are processed.

**17. Slot-class create transaction shrinks from 5 tables to 4.** The `school_volunteer` step is removed from `services/slot_classes/create.py`. Existing M3 tests for slot-class creation need adjustment.

**18. No fallback to cron for user_data sync logic.**

**19. Endpoint accepts defensive payloads.** n8n may forward empty strings for nullable fields (Hasura returns `""` instead of `null` for unset columns). The schema coerces `""` → `null` for all optional fields before Pydantic type validation. `worknode_id` also accepts numeric strings (`"42"` → `42`). `user_active_status` accepts `"true"`/`"false"` string literals in addition to booleans. Unknown extra fields are rejected with 422. M4's cron path continues to function as it does today (its existing incremental upsert). M8a does not change M4. Admin can use either path. The two paths arrive at the same eventual state; M8a's path is more thorough (cascade logic), M4's path is simpler (basic field upsert).

## Models touched (overview)

| Model | Status | Purpose |
|---|---|---|
| RealtimeSyncLog | NEW | Comprehensive audit log of every sync event |
| User | EXTEND | New constraint on `worknode_id` consistency check (not a schema change, just service-layer validation) |
| SchoolVolunteer | (no change) | Lifecycle now driven by realtime sync, not slot-class create |
| SlotClassSection, SlotClassSectionVolunteer, ClassSectionSubject, ChildSubject | (no change) | Cascade reuses M3 services |
| `services/slot_classes/create.py` | EXTEND | Remove school_volunteer creation step |
| `services/slot_classes/_reconcile_school_volunteer_for_volunteers` | REMOVE | Logic moves to realtime sync |

## Configuration / environment variables

New env vars:

```
# Internal sync endpoint
INTERNAL_SYNC_ENDPOINT_PATH=/sync-user-internal
INTERNAL_SYNC_SERVICE_TOKEN={shared secret — used by n8n to authenticate}
```

`INTERNAL_SYNC_ENDPOINT_PATH` sets the router prefix. The full URL pattern is:
```
POST {BASE_URL}{INTERNAL_SYNC_ENDPOINT_PATH}/{user_id}
```
Default value if unset: `/sync-user-internal` (matches test env).

The path is non-guessable by design. Both env vars are gitignored and must never appear in logs.

## Pre-build verification checklist (Day 1)

- [ ] Confirm enriched user payload shape from Hasura's joined query (sample response in dev environment)
- [ ] Confirm what `xModifiedTimestamp` field is called in the payload
- [ ] Confirm M3 production deploy status (M8a doesn't directly depend on M3 prod, but staging Session-Ops should be on M3+M4)
- [ ] M4.md doc hygiene complete (Status field reflects staging deploy)

## Build sequence (~10 working days)

| Days | Phase | Output |
|---|---|---|
| 1 | Sync log model + migration | F-M8a-1. RealtimeSyncLog table created. |
| 2-3 | Endpoint + diff engine + dispatcher | F-M8a-2. Endpoint accepts payload, diffs, role-allowlist filters, dispatches to flow handlers. |
| 4 | User create + common field flows | F-M8a-3. INSERT + UPDATE (common-fields-only) flows complete. End-to-end testable. |
| 5-7 | Worknode cascade flows | F-M8a-4. worknode_added, worknode_updated, worknode_removed. Reuses M3 helpers. Partial-success handling for missing school. |
| 8 | User deactivation + slot-class create modification | F-M8a-5. DEACTIVATE flow. Slot-class create updated. M3 reconcile helper removed. |
| 9 | Realtime Events admin tab | F-M8a-6. Read-only viewer for sync log + manual sync trigger. |
| 10-11 | Stabilization + staging deploy | UAT, edge cases, deploy. |

## Definition of "M8a production ready"

- All M8a features work end-to-end in dev
- All migrations apply cleanly on a fresh DB
- Backend pytest green; frontend Vitest green
- Production migrations applied to `mad_sessionops_prod`
- All M3 slot-class tests still pass after removal of school_volunteer step from create transaction
- Admin can manually sync a user from the new admin tab
- Manual sync produces correct cascade behavior for worknode_added, worknode_updated, worknode_removed, deactivation
- Realtime Events tab renders log entries correctly
- One real admin has triggered a manual sync in production and verified the result
- Partial_success behavior verified: trigger a sync for a user whose worknode_id has no partner_worknode mapping; confirm common fields updated, worknode_id NOT updated, log entry created with correct status
- Sentry shows no error spikes in 24h post-deploy
- Rollback procedure documented

## Reference docs

- `docs/MILESTONES.md` — overview
- `docs/milestones/M1.md` — JWT auth foundation
- `docs/milestones/M2.md` — User, Partner, school_class models
- `docs/milestones/M3.md` — slot-class cascade logic; M3's `_reconcile_school_volunteer_for_volunteers` helper (being removed in M8a)
- `docs/milestones/M4.md` — SyncRun, cron sync model
- `docs/BUSINESS_RULES.md` — R4 (one volunteer one school)
- `docs/GLOSSARY.md` — worknode_id, partner_worknode terminology

### Already-built code (do not redo)

- `sessionops/models/user.py` — User model
- `sessionops/services/slot_classes/delete.py` — slot-class cascade delete (used by M8a worknode flows)
- `sessionops/services/auth/role_helpers.py` — JWT validation
- M3 + M4 endpoint structure, RBAC helpers

## Critical path dependencies

| Dependency | Status | Blocks |
|---|---|---|
| M3 in staging or production | M3 staging deployed | M8a depends on M3 cascade helpers being present |
| Enriched payload sample from Hasura | To verify Day 1 | M8a service code shape depends on this |
| F-M8a-5 modifies M3 slot-class create | Internal | F-M8a-5 must ship together with F-M8a-1..4; or be in same release |

---

# Part 2 — Features

## F-M8a-1 — Sync log foundation

### What it does

Creates the `realtime_sync_log` table that captures every sync event with full audit detail. Includes status enums and action_taken enums. This is foundation — no features build until this is in place.

### Schema — models and migrations

```python
SYNC_TYPES = [
    ("manual_admin", "Manual trigger by admin"),
    ("realtime_webhook", "Realtime via n8n / webhook"),  # reserved for M8b
    ("cron_fallback", "Cron-based fallback sync"),         # reserved
]

EVENT_TYPES = [
    ("insert", "User created"),
    ("update", "User updated"),
    ("deactivate", "User deactivated"),
]

SYNC_STATUSES = [
    ("success", "Success"),
    ("partial_success", "Partial — common fields only, worknode cascade skipped"),
    ("failed", "Failed"),
    ("skipped_role_not_allowed", "Skipped — role not in allowlist"),
    ("skipped_no_change", "Skipped — no meaningful changes"),
    ("skipped_stale", "Skipped — incoming data older than stored"),
]

ACTIONS_TAKEN = [
    ("user_created", "New user inserted"),
    ("common_fields_updated", "Common field update only"),
    ("worknode_added", "Worknode_id added with cascade"),
    ("worknode_updated", "Worknode_id updated with cascade"),
    ("worknode_removed", "Worknode_id removed with cascade"),
    ("user_deactivated", "User deactivated with cascade"),
    ("no_change", "No action — same as before"),
    ("no_school_found_for_worknode", "Common fields updated, worknode cascade skipped — no school_id for worknode"),
    ("failed", "Failed mid-processing"),
]


class RealtimeSyncLog(models.Model):
    realtime_sync_log_id   = BigAutoField(primary_key=True)

    user_id_from_source    = IntegerField(db_index=True)
    sync_type              = CharField(max_length=30, choices=SYNC_TYPES)
    event_type             = CharField(max_length=20, choices=EVENT_TYPES)
    triggered_by           = ForeignKey(User, on_delete=PROTECT, null=True, related_name="+")
    external_event_id      = CharField(max_length=200, null=True, blank=True, db_index=True)

    received_at            = DateTimeField(auto_now_add=True, db_index=True)
    processed_at           = DateTimeField(null=True)

    status                 = CharField(max_length=30, choices=SYNC_STATUSES)
    action_taken           = CharField(max_length=40, choices=ACTIONS_TAKEN)
    error_details          = TextField(null=True, blank=True)

    pre_snapshot           = JSONField(null=True, blank=True)
    incoming_payload       = JSONField(null=True, blank=True)
    field_changes          = JSONField(null=True, blank=True)
    cascaded_changes       = JSONField(null=True, blank=True)
    rules_fired            = JSONField(null=True, blank=True)
    deferred_operations    = JSONField(null=True, blank=True)

    created_at             = DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "realtime_sync_log"
        indexes = [
            models.Index(fields=["user_id_from_source", "received_at"]),
            models.Index(fields=["status", "received_at"]),
            models.Index(fields=["sync_type", "received_at"]),
            models.Index(fields=["external_event_id"]),
        ]
```

### Field notes

- `user_id_from_source`: Hasura's user_id. NOT a FK to local User (local row may not exist on INSERT events).
- `external_event_id`: reserved for M8b — Hasura's webhook event_id, used for dedup. Null in M8a manual triggers.
- `incoming_payload`: distilled to ~20 fields used in diff (not the full 12-table enriched response). Keeps row size manageable.
- `pre_snapshot`: local user state before sync. Same ~20 fields as `incoming_payload` for easy comparison.
- `field_changes`: list of `{field, old, new}` records for fields that actually changed.
- `cascaded_changes`: list of `{table, row_id, action}` for soft-delete operations performed.
- `deferred_operations`: when `status='partial_success'`, captures what was skipped and why.

### Acceptance criteria

1. Migration applies cleanly on fresh DB
2. Indexes exist as defined
3. Log row can be inserted with all required fields
4. Foreign key to `triggered_by` allows null (for future automated calls)
5. JSONField columns accept structured data and remain queryable

### Test cases

- `test_realtime_sync_log_migration_applies`
- `test_realtime_sync_log_insert_with_minimal_fields`
- `test_realtime_sync_log_insert_with_all_fields`
- `test_realtime_sync_log_query_by_user_id`
- `test_realtime_sync_log_query_by_status`
- `test_realtime_sync_log_jsonfield_serialization`

---

## F-M8a-2 — Internal sync endpoint, diff engine, role allowlist, dispatcher

### What it does

The core orchestration layer. The endpoint receives an enriched user payload with `user_id` in the URL path. Authentication via admin JWT (M8a) or service token (M8b). The handler:

1. Validates auth (admin JWT or service token in `Authorization` header)
2. Validates payload shape (Pydantic v2)
3. Acquires `select_for_update` lock on local user row (or handles missing row for INSERT events)
4. Computes diff: incoming payload vs local state across all tracked fields
5. Applies role allowlist filter
6. Compares `x_modified_timestamp` to local `synced_at` — skips stale events
7. Dispatches to flow handler based on diff and event_type
8. Writes comprehensive log entry
9. Returns 200 with `log_id`, `status`, `action_taken`, `field_changes`, `cascaded_changes`

### Endpoint

```
POST {BASE_URL}{INTERNAL_SYNC_ENDPOINT_PATH}/{user_id}
```

- `INTERNAL_SYNC_ENDPOINT_PATH` is set in `.env.development` (e.g. `/sync-user-internal`)
- `user_id` is Hasura's integer user ID — passed as a URL path parameter
- The endpoint path is non-guessable by design; value is never logged

### Authentication

All callers send auth in the `Authorization` header. Two accepted forms:

| Caller | Header value | Resolves to |
|---|---|---|
| Admin (M8a) | `Bearer {admin_jwt}` | Admin `User` object; must have role in ADMIN_ROLES |
| n8n / service (M8b) | `Bearer {INTERNAL_SYNC_SERVICE_TOKEN}` | `None` (no local user) |

ADMIN_ROLES (from `role_helpers.py`): `Function Lead`, `Project Associate`, `Project Lead`

### Request

```
POST /sync-user-internal/12345
Authorization: Bearer {token}
Content-Type: application/json
```

```json
{
  "user_login": "alice@makeadiff.in",
  "user_display_name": "Alice Wingman",
  "user_email": "alice@makeadiff.in",
  "user_phone": "9876543210",
  "user_role": "Wingman",
  "user_active_status": true,
  "worknode_id": 7821,
  "city": "Mumbai",
  "center": "Dharavi",
  "state": "Maharashtra",
  "reporting_manager_user_login": "bob@makeadiff.in",
  "reporting_manager_role_code": "FL",
  "reporting_manager_user_id": 9900,
  "event_type": "update",
  "x_modified_timestamp": "2026-06-13T14:32:11+00:00",
  "external_event_id": "evt_abc123",
  "sync_type": "realtime_webhook",
  "triggered_by_user_id": null
}
```

**Required fields:** `user_login`, `event_type`

**All other fields optional** (default to `null` / `"manual_admin"` for `sync_type`; `user_active_status` defaults to `null` — treated as `true` in the service layer)

**`user_id` is in the URL path, NOT in the request body.**

### Response

```json
{
  "log_id": 42,
  "status": "success",
  "action_taken": "common_fields_updated",
  "field_changes": [
    {"field": "user_display_name", "old": "Alice W", "new": "Alice Wingman"}
  ],
  "cascaded_changes": [],
  "deferred_operations": null
}
```

### Status values

| status | meaning |
|---|---|
| `success` | Flow handler ran and completed |
| `partial_success` | Common fields updated; worknode cascade skipped (no school found) |
| `skipped_stale` | `x_modified_timestamp` older than local `synced_at` |
| `skipped_no_change` | All tracked fields match, no worknode change, not a deactivation |
| `skipped_role_not_allowed` | Role not in ACTIVE_ROLES or DEACTIVATE_ROLES allowlist |
| `failed` | Exception during processing |

### n8n integration guide

Use an **HTTP Request** node in n8n with these settings:

| Setting | Value |
|---|---|
| Method | `POST` |
| URL | `https://sessionops.makeadiff.in{{$env.INTERNAL_SYNC_ENDPOINT_PATH}}/{{$json.user_id}}` |
| Authentication | `Generic Credential Type` → `Header Auth` |
| Header name | `Authorization` |
| Header value | `Bearer {{$env.INTERNAL_SYNC_SERVICE_TOKEN}}` |
| Content-Type | `application/json` |

**Recommended body mapping** (n8n expression using Hasura webhook event data):

```json
{
  "user_login":                   "{{ $json.event.data.new.user_login }}",
  "user_display_name":            "{{ $json.event.data.new.user_display_name }}",
  "user_email":                   "{{ $json.event.data.new.email }}",
  "user_phone":                   "{{ $json.event.data.new.contact }}",
  "user_role":                    "{{ $json.event.data.new.user_role }}",
  "user_active_status":           "{{ $json.event.data.new.is_active }}",
  "worknode_id":                  "{{ $json.event.data.new.worknode_id }}",
  "city":                         "{{ $json.event.data.new.city }}",
  "center":                       "{{ $json.event.data.new.center }}",
  "state":                        "{{ $json.event.data.new.state }}",
  "reporting_manager_user_login": "{{ $json.event.data.new.reporting_manager_user_login }}",
  "reporting_manager_role_code":  "{{ $json.event.data.new.reporting_manager_role_code }}",
  "reporting_manager_user_id":    "{{ $json.event.data.new.reporting_manager_user_id }}",
  "event_type":                   "{{ $json.event.op === 'INSERT' ? 'insert' : 'update' }}",
  "x_modified_timestamp":         "{{ $json.event.data.new.updated_at }}",
  "external_event_id":            "{{ $json.id }}",
  "sync_type":                    "realtime_webhook"
}
```

**Env vars to set in n8n:**
- `INTERNAL_SYNC_ENDPOINT_PATH` — must match the value in Session-Ops `.env.development`
- `INTERNAL_SYNC_SERVICE_TOKEN` — must match `INTERNAL_SYNC_SERVICE_TOKEN` in Session-Ops env

### Service code layout

```
sessionops/services/realtime_sync/
├── __init__.py
├── schema.py        # RealtimeSyncUserPayload (Pydantic v2)
├── auth.py          # validate_service_token()
├── diff.py          # compute_diff() → UserDiff; TRACKED_FIELDS
├── allowlist.py     # classify_event(); ACTIVE_ROLES, DEACTIVATE_ROLES
├── orchestrator.py  # process_sync_event(user_id, payload, triggered_by)
└── flows/
    └── __init__.py  # FlowResult; handle_insert/update/deactivate stubs
```

### Payload schema (`schema.py`)

```python
class RealtimeSyncUserPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")  # unknown fields raise 422

    # Core user identity
    user_login: str                              # required
    user_display_name: Optional[str] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    user_role: Optional[str] = None
    # Renamed from is_active. Bool or bool-like string ("true"/"false"). None → treated as True.
    user_active_status: Optional[bool] = None
    worknode_id: Optional[int] = None            # accepts numeric string; "" → null

    # Location / org hierarchy
    city: Optional[str] = None
    center: Optional[str] = None
    state: Optional[str] = None
    reporting_manager_user_login: Optional[str] = None
    reporting_manager_role_code: Optional[str] = None
    reporting_manager_user_id: Optional[int] = None

    # Sync metadata
    event_type: str                             # required: "insert" | "update" | "deactivate"
    x_modified_timestamp: Optional[str] = None # ISO8601 from Hasura updated_at
    external_event_id: Optional[str] = None    # M8b dedup key
    sync_type: str = "manual_admin"
    triggered_by_user_id: Optional[int] = None

    # Validators: empty string → None for all optional fields;
    # worknode_id accepts numeric string; user_active_status accepts "true"/"false".
```

### Diff engine (`diff.py`)

Tracked fields (compared local ↔ payload):

| User model field | Payload field | Note |
|---|---|---|
| `user_login` | `user_login` | direct |
| `user_display_name` | `user_display_name` | direct |
| `email` | `user_email` | name differs |
| `contact` | `user_phone` | name differs |
| `user_role` | `user_role` | direct |
| `worknode_id` | `worknode_id` | direct; also drives worknode_action |
| `is_active` | `user_active_status` | name differs; None payload value treated as True |
| `city` | `city` | direct |
| `center` | `center` | direct |
| `state` | `state` | direct |
| `reporting_manager_user_login` | `reporting_manager_user_login` | direct |
| `reporting_manager_role_code` | `reporting_manager_role_code` | direct |
| `reporting_manager_user_id` | `reporting_manager_user_id` | direct |

Stale check uses `local_user.synced_at` (not `last_synced_at`).

### Acceptance criteria

1. Endpoint accepts valid admin JWT from Function Lead / Project Associate / Project Lead
2. Endpoint rejects CO, CHO, unauthenticated requests with 401
3. Endpoint accepts service token from `Authorization: Bearer {INTERNAL_SYNC_SERVICE_TOKEN}`
4. Missing required fields (`user_login`, `event_type`) returns 422
5. Role allowlist filter correctly returns `skipped_role_not_allowed` for unknown roles
6. Stale event check uses `x_modified_timestamp` vs `synced_at`
7. `select_for_update` lock serializes concurrent events for same user_id
8. Dispatcher routes correctly: INSERT vs UPDATE vs DEACTIVATE
9. Log entry created for every event, including all skip cases
10. Endpoint returns `log_id`, `status`, `action_taken`, `field_changes`, `cascaded_changes`
11. `user_id` from URL path is stored in `RealtimeSyncLog.user_id_from_source`

### Test cases (implemented)

- `test_endpoint_rejects_unauthenticated` — 401
- `test_endpoint_rejects_non_admin_jwt_co` — 401
- `test_endpoint_rejects_non_admin_jwt_cho` — 401
- `test_endpoint_accepts_admin_jwt` — 200 for Project Lead
- `test_endpoint_accepts_function_lead_jwt` — 200 for Function Lead
- `test_endpoint_accepts_service_token` — 200 with patched token
- `test_endpoint_rejects_wrong_service_token` — 401
- `test_role_allowlist_skips_unknown_role` — `skipped_role_not_allowed`
- `test_role_allowlist_allows_youth` — success
- `test_role_allowlist_deactivate_on_alumni` — deactivate path
- `test_stale_event_skipped` — `skipped_stale`
- `test_no_change_skipped` — `skipped_no_change`
- `test_log_row_written_for_every_call` — 3 calls → 3 rows
- `test_missing_required_field_returns_422` — 422
- `test_concurrent_events_serialize` — two threads, both 200

Diff engine tests (`test_diff_engine.py`, 17 tests):
- user not found, no-change, field change, email/contact mapping, worknode add/remove/update/unchanged, stale check (4 cases), pre_snapshot fields, reactivation flag

Allowlist tests (`test_allowlist.py`, 33 tests):
- All 11 ACTIVE_ROLES × insert + update, Alumni/null → deactivate, unknown role → skipped

### Done log

- **2026-06-13** — F-M8a-2 built and all 65 tests passing. Files: `services/realtime_sync/{schema,auth,diff,allowlist,orchestrator}.py`, `services/realtime_sync/flows/__init__.py`, `api/realtime_sync_api.py`. Route registered in `routes.py` under `INTERNAL_SYNC_ENDPOINT_PATH` env var. Bug fixed: `pre_snapshot["synced_at"]` was a raw `datetime` object that Django's default JSONField encoder rejected — serialized to ISO string.
- **2026-06-17** — Payload expanded with `city`, `center`, `state`, `reporting_manager_user_login`, `reporting_manager_role_code`, `reporting_manager_user_id`, `user_active_status`. `user_id` moved from request body to URL path parameter (`POST …/{user_id}`). `process_sync_event` signature updated to accept `user_id` as first positional arg. All 6 new location/org fields added to `TRACKED_FIELDS` and `_FIELD_TO_PAYLOAD`. Tests updated: `_payload()` helpers no longer include `user_id`; all endpoint test URLs use `_url(uid)` helper. 65/65 tests still pass.
- **2026-06-26** — Defensive payload hardening + field rename. `is_active` (bool) removed from payload; replaced by `user_active_status: Optional[bool]` (renamed to match Hasura). Empty-string-to-None coercion added for all optional fields. `worknode_id` accepts numeric strings. `user_active_status` accepts `"true"`/`"false"` string literals. `event_type` validated against allowed values. `extra="forbid"` added to reject unknown fields. `_FIELD_TO_PAYLOAD["is_active"]` updated to `"user_active_status"`. `apply_common_fields` maps `payload.user_active_status → user.is_active` (None defaults to True). 13 new validation tests added in `test_payload_validation.py`. All test `_payload()` helpers updated to use `user_active_status=True`.

---

## F-M8a-3 — User create + common field update flows

### What it does

The simplest two flows. Builds the foundation that every other flow uses (writing to user table, logging field_changes).

### Flow 1: User create (INSERT or UPDATE event with no local user)

```python
def _handle_user_create(incoming, log, triggered_by_user):
    user = User.objects.create(
        user_id=incoming["user_id"],
        user_login=incoming["user_login"],
        user_name=incoming["user_name"],
        user_role=incoming["user_role"],
        worknode_id=incoming.get("worknode_id"),
        user_phone=incoming.get("user_phone"),
        user_email=incoming.get("user_email"),
        is_active=True,
        removed=False,
        last_synced_at=timezone.now(),
        created_by=triggered_by_user,
    )

    log.field_changes = [
        {"field": k, "old": None, "new": v}
        for k, v in _distill_payload(incoming).items()
        if v is not None and k != "xModifiedTimestamp"
    ]

    # If incoming has worknode_id, run worknode_added side-effects
    if incoming.get("worknode_id"):
        _process_worknode_change_for_new_user(user, incoming, log)

    _finalize_log(log, "success", "user_created")
```

### Flow 2a: Common field update (UPDATE event, local user exists, worknode_id unchanged)

```python
def _handle_user_update(local_user, incoming, log, triggered_by_user):
    incoming_worknode = incoming.get("worknode_id")
    old_worknode = local_user.worknode_id

    worknode_changed = (old_worknode != incoming_worknode)

    if worknode_changed:
        # Delegate to worknode-aware flow (F-M8a-4)
        return _handle_worknode_change(local_user, incoming, log, triggered_by_user)

    # Common fields only path
    changed = _apply_common_field_updates(local_user, incoming, log)

    if not changed:
        _finalize_log(log, "skipped_no_change", "no_change")
        return

    local_user.last_synced_at = timezone.now()
    local_user.updated_by = triggered_by_user
    local_user.save()

    _finalize_log(log, "success", "common_fields_updated")


def _apply_common_field_updates(local_user, incoming, log):
    """Update non-cascade fields. Returns True if any field changed."""
    field_changes = []
    common_fields = ("user_name", "user_login", "user_phone", "user_email", "user_role")

    for field in common_fields:
        old_value = getattr(local_user, field)
        new_value = incoming.get(field)
        if old_value != new_value and new_value is not None:
            setattr(local_user, field, new_value)
            field_changes.append({"field": field, "old": old_value, "new": new_value})

    if field_changes:
        log.field_changes = field_changes

    return len(field_changes) > 0
```

### Acceptance criteria

1. INSERT event with no local user creates a new user row with all fields from payload
2. INSERT event for a user that already exists is treated as UPDATE (dispatch handles it)
3. UPDATE event with no field changes returns `skipped_no_change`
4. UPDATE event with common field changes updates those fields, logs diff, sets `last_synced_at`
5. UPDATE event with worknode_id change delegates to worknode flow (F-M8a-4)
6. New user gets `is_active=True, removed=False` on creation
7. `field_changes` log accurately reflects what changed
8. `created_by` and `updated_by` set to `triggered_by_user`

### Test cases

- `test_create_user_inserts_with_all_fields`
- `test_create_user_field_changes_logged`
- `test_update_common_fields_no_worknode_change_succeeds`
- `test_update_common_fields_no_changes_returns_skipped_no_change`
- `test_update_common_fields_field_changes_logged_correctly`
- `test_update_common_fields_updates_last_synced_at`
- `test_insert_event_for_existing_user_treated_as_update`
- `test_create_user_brand_new_with_worknode_id_delegates_to_worknode_flow`

---

## F-M8a-4 — Worknode_id cascade flows

### What it does

The complex sub-feature. Handles worknode_id changes with full cascade through `school_volunteer` and `slot_class_section_volunteer` tables, reusing M3's cascade services. Includes the partial_success handling when partner_worknode lookup fails.

### Three sub-flows

#### 4a — worknode_added (old was null/empty, new has value)

```python
def _handle_worknode_added(local_user, incoming, log, triggered_by_user):
    new_worknode_id = incoming["worknode_id"]

    # Look up school for the new worknode
    school_id = _resolve_school_for_worknode(new_worknode_id)

    if school_id is None:
        # Partial success — common fields only
        _apply_common_field_updates(local_user, incoming, log)
        local_user.last_synced_at = timezone.now()
        local_user.updated_by = triggered_by_user
        local_user.save()  # worknode_id NOT updated

        log.deferred_operations = [{
            "operation": "create_school_volunteer",
            "reason": "no_partner_worknode_for_worknode_id",
            "worknode_id": new_worknode_id,
        }]
        _finalize_log(log, "partial_success", "no_school_found_for_worknode")
        return

    # Defensive: clean up any active school_volunteer at other schools
    cleanup_actions = _cleanup_other_school_assignments(
        local_user, school_id, triggered_by_user
    )

    # Apply common field updates
    _apply_common_field_updates(local_user, incoming, log)

    # Set worknode_id on local user
    local_user.worknode_id = new_worknode_id
    local_user.last_synced_at = timezone.now()
    local_user.updated_by = triggered_by_user
    local_user.save()

    # Create school_volunteer for the new school (if not already active)
    sv_action = _ensure_school_volunteer(local_user, school_id, triggered_by_user)

    log.field_changes = (log.field_changes or []) + [
        {"field": "worknode_id", "old": None, "new": new_worknode_id}
    ]
    log.cascaded_changes = cleanup_actions + ([sv_action] if sv_action else [])
    log.rules_fired = ["worknode_added"]

    _finalize_log(log, "success", "worknode_added")
```

#### 4b — worknode_updated (old value, new different value)

```python
def _handle_worknode_updated(local_user, incoming, log, triggered_by_user):
    old_worknode_id = local_user.worknode_id
    new_worknode_id = incoming["worknode_id"]

    new_school_id = _resolve_school_for_worknode(new_worknode_id)

    if new_school_id is None:
        # Partial success — common fields only, do NOT update worknode_id, do NOT clean up old school
        _apply_common_field_updates(local_user, incoming, log)
        local_user.last_synced_at = timezone.now()
        local_user.updated_by = triggered_by_user
        local_user.save()  # worknode_id stays at old value

        log.deferred_operations = [{
            "operation": "worknode_update_with_cascade",
            "reason": "no_partner_worknode_for_new_worknode_id",
            "old_worknode_id": old_worknode_id,
            "new_worknode_id": new_worknode_id,
        }]
        _finalize_log(log, "partial_success", "no_school_found_for_worknode")
        return

    old_school_id = _resolve_school_for_worknode(old_worknode_id)

    # Clean up old school's assignments
    cleanup_actions = _cascade_remove_user_at_school(
        local_user, old_school_id, triggered_by_user
    )

    # Defensive: clean up any other schools too (shouldn't exist per R4, but be safe)
    cleanup_actions += _cleanup_other_school_assignments(
        local_user, new_school_id, triggered_by_user
    )

    # Apply common field updates
    _apply_common_field_updates(local_user, incoming, log)

    # Update worknode_id
    local_user.worknode_id = new_worknode_id
    local_user.last_synced_at = timezone.now()
    local_user.updated_by = triggered_by_user
    local_user.save()

    # Create school_volunteer for the new school
    sv_action = _ensure_school_volunteer(local_user, new_school_id, triggered_by_user)

    log.field_changes = (log.field_changes or []) + [
        {"field": "worknode_id", "old": old_worknode_id, "new": new_worknode_id}
    ]
    log.cascaded_changes = cleanup_actions + ([sv_action] if sv_action else [])
    log.rules_fired = ["worknode_updated"]

    _finalize_log(log, "success", "worknode_updated")
```

#### 4c — worknode_removed (old value, new is null/empty)

```python
def _handle_worknode_removed(local_user, incoming, log, triggered_by_user):
    old_worknode_id = local_user.worknode_id
    old_school_id = _resolve_school_for_worknode(old_worknode_id)

    # Old school is always known (it was stored locally). No partial_success path here.

    cleanup_actions = _cascade_remove_user_at_school(
        local_user, old_school_id, triggered_by_user
    )

    # Apply common field updates
    _apply_common_field_updates(local_user, incoming, log)

    # Set worknode_id to null
    local_user.worknode_id = None
    local_user.last_synced_at = timezone.now()
    local_user.updated_by = triggered_by_user
    local_user.save()

    log.field_changes = (log.field_changes or []) + [
        {"field": "worknode_id", "old": old_worknode_id, "new": None}
    ]
    log.cascaded_changes = cleanup_actions
    log.rules_fired = ["worknode_removed"]

    _finalize_log(log, "success", "worknode_removed")
```

### Helper: resolve school from worknode_id

```python
def _resolve_school_for_worknode(worknode_id):
    if not worknode_id:
        return None
    pw = PartnerWorknode.objects.filter(worknode_id=worknode_id).first()
    if not pw or not pw.partner_id:
        return None
    return pw.partner_id
```

### Helper: cascade remove user's slot-class assignments at a school

```python
def _cascade_remove_user_at_school(user, school_id, triggered_by_user):
    """Soft-delete the user's slot_class_section_volunteer rows at school.
    For each scs row affected, check if the parent slot_class_section becomes
    empty and cascade further (using M3's delete_slot_class logic).
    Also soft-delete the school_volunteer row."""

    actions = []

    # Find user's active SCS-V rows at this school
    scs_volunteer_rows = SlotClassSectionVolunteer.objects.filter(
        volunteer_id=user,
        is_active=True, removed=False,
        slot_class_section_id__slot_id__school_id=school_id,
    ).select_for_update()

    affected_scs_ids = set()
    for sv_row in scs_volunteer_rows:
        affected_scs_ids.add(sv_row.slot_class_section_id_id)
        sv_row.is_active = False
        sv_row.removed = True
        sv_row.deleted_at = timezone.now()
        sv_row.updated_by = triggered_by_user
        sv_row.save()
        actions.append({
            "table": "slot_class_section_volunteer",
            "row_id": sv_row.slot_class_section_volunteer_id,
            "action": "soft_delete",
        })

    # For each affected slot_class_section, check if it should be soft-deleted
    for scs_id in affected_scs_ids:
        remaining_volunteers = SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs_id,
            is_active=True, removed=False,
        ).exists()

        if not remaining_volunteers:
            cascade_actions = _cascade_remove_slot_class_section(
                scs_id, triggered_by_user
            )
            actions.extend(cascade_actions)

    # Soft-delete the school_volunteer row
    school_vol = SchoolVolunteer.objects.filter(
        school_id=school_id,
        volunteer_id=user,
        is_active=True, removed=False,
    ).first()

    if school_vol:
        school_vol.is_active = False
        school_vol.removed = True
        school_vol.deleted_at = timezone.now()
        school_vol.updated_by = triggered_by_user
        school_vol.save()
        actions.append({
            "table": "school_volunteer",
            "row_id": school_vol.school_volunteer_id,
            "action": "soft_delete",
        })

    return actions


def _cascade_remove_slot_class_section(scs_id, triggered_by_user):
    """When a slot_class_section has no remaining volunteers, soft-delete:
    - the slot_class_section itself
    - its class_section_subject (if not used elsewhere)
    - any child_subject rows for that class_section_subject"""

    actions = []
    scs = SlotClassSection.objects.get(slot_class_section_id=scs_id)

    scs.is_active = False
    scs.removed = True
    scs.deleted_at = timezone.now()
    scs.updated_by = triggered_by_user
    scs.save()
    actions.append({
        "table": "slot_class_section",
        "row_id": scs_id,
        "action": "soft_delete",
    })

    # Soft-delete class_section_subject if not used by other slot_class_section rows
    css_id = scs.class_section_subject_id_id
    other_uses = SlotClassSection.objects.filter(
        class_section_subject_id=css_id,
        is_active=True, removed=False,
    ).exclude(slot_class_section_id=scs_id).exists()

    if not other_uses:
        css = ClassSectionSubject.objects.get(class_section_subject_id=css_id)
        css.is_active = False
        css.removed = True
        css.deleted_at = timezone.now()
        css.updated_by = triggered_by_user
        css.save()
        actions.append({
            "table": "class_section_subject",
            "row_id": css_id,
            "action": "soft_delete",
        })

        # Soft-delete child_subject rows for this CSS
        child_subjects = ChildSubject.objects.filter(
            class_section_subject_id=css_id,
            is_active=True, removed=False,
        )
        for cs in child_subjects:
            cs.is_active = False
            cs.removed = True
            cs.deleted_at = timezone.now()
            cs.updated_by = triggered_by_user
            cs.save()
            actions.append({
                "table": "child_subject",
                "row_id": cs.child_subject_id,
                "action": "soft_delete",
            })

    return actions


def _ensure_school_volunteer(user, school_id, triggered_by_user):
    """Create school_volunteer row if not already active at this school."""
    existing = SchoolVolunteer.objects.filter(
        school_id=school_id,
        volunteer_id=user,
        is_active=True, removed=False,
    ).first()

    if existing:
        return None

    sv = SchoolVolunteer.objects.create(
        school_id=school_id,
        volunteer_id=user,
        is_active=True,
        removed=False,
        created_by=triggered_by_user,
    )

    return {
        "table": "school_volunteer",
        "row_id": sv.school_volunteer_id,
        "action": "create",
    }


def _cleanup_other_school_assignments(user, current_school_id, triggered_by_user):
    """Defensive: clean up any active school_volunteer + slot_class_section_volunteer
    rows at schools OTHER than current_school_id. Per R4, shouldn't exist, but be safe."""

    actions = []
    other_school_vols = SchoolVolunteer.objects.filter(
        volunteer_id=user,
        is_active=True, removed=False,
    ).exclude(school_id=current_school_id)

    for sv in other_school_vols:
        cascade_actions = _cascade_remove_user_at_school(
            user, sv.school_id, triggered_by_user
        )
        actions.extend(cascade_actions)

    return actions
```

### Acceptance criteria

1. worknode_added with valid partner_worknode mapping: school_volunteer created, log entry shows `worknode_added` action
2. worknode_added with no partner_worknode for new worknode_id: only common fields update, status=`partial_success`, action=`no_school_found_for_worknode`, worknode_id NOT updated on local user
3. worknode_updated with valid mapping: old school cleaned up (school_volunteer + slot_class_section_volunteer soft-deleted), new school_volunteer created, slot_class_section_volunteer rows at old school cascaded correctly
4. worknode_updated with no partner_worknode for new worknode_id: only common fields, partial_success, no cleanup of old school, worknode_id stays at old value
5. worknode_removed: cascade always runs (old school known), worknode_id set to null
6. Cascade correctly soft-deletes slot_class_section when last volunteer is removed
7. Cascade soft-deletes class_section_subject and child_subject when slot_class_section is removed
8. If slot_class_section still has another volunteer, parent rows are NOT cascaded
9. cascaded_changes log captures every soft-delete with table, row_id, action
10. deferred_operations log captures partial-success skipped work

### Test cases

- `test_worknode_added_with_valid_mapping_creates_school_volunteer`
- `test_worknode_added_partial_success_when_no_partner_worknode`
- `test_worknode_added_partial_success_worknode_id_not_updated`
- `test_worknode_updated_cleans_up_old_school_and_creates_new`
- `test_worknode_updated_cascade_when_user_was_last_volunteer_in_scs`
- `test_worknode_updated_preserves_scs_when_other_volunteer_present`
- `test_worknode_updated_partial_success_when_new_mapping_missing`
- `test_worknode_updated_partial_no_cleanup_of_old_school`
- `test_worknode_removed_runs_full_cascade`
- `test_worknode_removed_cascades_to_class_section_subject_and_child_subject`
- `test_worknode_removed_preserves_css_when_other_scs_uses_it`
- `test_cascaded_changes_log_includes_all_soft_deletes`
- `test_deferred_operations_log_in_partial_success_cases`
- `test_defensive_cleanup_of_other_school_assignments`

---

## F-M8a-5 — User deactivation flow + slot-class create modification

### What it does

The deactivation flow handles users whose role changes to Alumni or null. Cascades remove all active assignments across all schools. Also, this feature modifies M3's slot-class create transaction to remove the `school_volunteer` creation step (which now lives in F-M8a-4), and removes the M3 reconcile helper entirely.

### Deactivation flow

```python
def _handle_deactivation(local_user, incoming, log, triggered_by_user):
    if not local_user:
        # User doesn't exist locally — nothing to deactivate
        _finalize_log(log, "skipped_no_change", "no_change")
        return

    actions = []

    # Find all active school_volunteer rows for this user
    school_vols = SchoolVolunteer.objects.filter(
        volunteer_id=local_user,
        is_active=True, removed=False,
    )

    affected_schools = list(school_vols.values_list("school_id", flat=True))

    # Cascade-remove from each school
    for school_id in affected_schools:
        cascade_actions = _cascade_remove_user_at_school(
            local_user, school_id, triggered_by_user
        )
        actions.extend(cascade_actions)

    # Set user inactive
    local_user.is_active = False
    local_user.removed = False  # not hard-deleted, just deactivated
    local_user.user_role = incoming.get("user_role")  # e.g., "Alumni"
    local_user.last_synced_at = timezone.now()
    local_user.updated_by = triggered_by_user
    local_user.save()

    log.field_changes = [
        {"field": "user_role", "old": log.pre_snapshot["user_role"], "new": incoming.get("user_role")},
        {"field": "is_active", "old": True, "new": False},
    ]
    log.cascaded_changes = actions
    log.rules_fired = ["user_deactivated"]

    _finalize_log(log, "success", "user_deactivated")
```

### Slot-class create modification

Existing M3 `services/slot_classes/create.py::create_slot_class` includes this block:

```python
# OLD (M3): create school_volunteer if not exists
school_vol_exists = SchoolVolunteer.objects.filter(...).exists()
if not school_vol_exists:
    SchoolVolunteer.objects.create(...)
```

**Remove this block entirely.** The slot-class create transaction shrinks from 5 tables to 4:
1. class_section_subject
2. child_subject
3. slot_class_section
4. slot_class_section_volunteer

The `school_volunteer` row is now solely managed by realtime sync (created when worknode_id is set).

### Remove M3's reconcile helper

`services/slot_classes/_reconcile_school_volunteer_for_volunteers` — **delete entirely.** Its responsibility moves to realtime sync via the `_cascade_remove_user_at_school` helper.

Any call sites of the M3 helper need updating:
- M3's `delete_slot_class`: was calling `_reconcile_school_volunteer_for_volunteers` to soft-delete school_volunteer when the last assignment at a school was removed. **This call is removed.** school_volunteer lifecycle is no longer tied to slot-class lifecycle.

This is a meaningful semantic shift: in M3, deleting all slot-class assignments for a user at a school would soft-delete their school_volunteer row. In M8a+, that no longer happens. The school_volunteer row persists until realtime sync gets a worknode_id change event.

This is intentional and aligns with the new model: school_volunteer reflects "where Worknode says this user is assigned," not "where they currently have slot-class assignments." A user could be tagged at a school via Worknode but have no slot-class assignments yet.

### Acceptance criteria

1. Deactivation with role=Alumni cascades through all schools
2. Deactivation with role=null treated same as Alumni
3. Deactivation when user has no active assignments still sets is_active=False
4. Deactivation when local user doesn't exist returns `skipped_no_change`
5. Slot-class create transaction no longer creates school_volunteer row
6. Slot-class create still passes existing M3 tests (with adjusted expectations)
7. `_reconcile_school_volunteer_for_volunteers` function no longer exists in code
8. Slot-class delete no longer touches school_volunteer row
9. Deleting all slot-class assignments for a user at a school does NOT soft-delete their school_volunteer (semantic shift verified)

### Test cases

- `test_deactivation_cascades_across_all_schools`
- `test_deactivation_with_alumni_role`
- `test_deactivation_with_null_role`
- `test_deactivation_when_user_not_local_returns_skipped_no_change`
- `test_deactivation_sets_user_inactive_but_not_removed`
- `test_slot_class_create_no_longer_touches_school_volunteer`
- `test_slot_class_create_transaction_now_4_tables`
- `test_existing_M3_slot_class_tests_pass_with_adjusted_expectations`
- `test_slot_class_delete_no_longer_soft_deletes_school_volunteer`
- `test_school_volunteer_persists_after_all_slot_classes_deleted_at_school`

---

## F-M8a-6 — Realtime Events admin tab

### What it does

Read-only admin UI for the sync log. Adds a new tab to the admin page (alongside M4's Data Sync tab). Includes a manual sync trigger form.

### Frontend — pages and integration

Admin page (built in M4) gets a new tab: **"Realtime Events"**.

#### Layout

Top section:
- Action bar with one button:
  - **"Sync User by Payload"** — opens a modal where admin pastes a JSON payload and sends to the internal sync endpoint
- Filters bar:
  - By status (success, partial_success, failed, skipped_*)
  - By sync_type (manual_admin, realtime_webhook for M8b, cron_fallback)
  - By user_id (search input)
  - By date range

Master+detail layout below filters:
- Left: list of recent events (last 50, paginated), most recent first
- Right: detail panel for selected event

#### Event list row shape

Each row:
- Timestamp (received_at)
- User ID + name (joined from local User table when available)
- Sync type badge
- Event type badge (insert / update / deactivate)
- Status badge (color-coded)
- Action taken
- Click → loads detail

#### Detail panel

Shows:
- All metadata: log_id, user_id, sync_type, event_type, external_event_id, triggered_by
- Timestamps: received_at, processed_at, duration
- Status + action_taken with full descriptions
- `pre_snapshot` and `incoming_payload` displayed side-by-side
- `field_changes` rendered as a clean diff table
- `cascaded_changes` rendered as a table of (table, row_id, action)
- `rules_fired` as a list of badges
- `deferred_operations` (when partial_success) rendered clearly
- `error_details` (when failed) rendered in `<pre>` block

#### "Sync User by Payload" modal

The simplest possible manual trigger:

- Field: paste a JSON payload (the same shape the endpoint accepts)
- Field: select event_type (insert / update / deactivate)
- Button: "Send to sync endpoint"
- On success: log entry created, list refreshes, new event highlighted
- On failure: error message displayed

For M8a, the admin is expected to construct the payload manually (or use a separate script to fetch from Hasura). When M8b lands, the n8n flow becomes the primary trigger and this modal becomes a debugging tool.

### Backend — endpoints

#### `GET /api/admin/realtime-events/`
- Auth: admin only
- Query params: `status`, `sync_type`, `user_id`, `date_from`, `date_to`, `limit` (default 50)
- Returns: list of `realtime_sync_log` rows with selected fields

#### `GET /api/admin/realtime-events/{log_id}/`
- Auth: admin only
- Returns: full `realtime_sync_log` row including all JSON fields

The internal sync endpoint (F-M8a-2) is the action endpoint.

### Acceptance criteria

1. New tab "Realtime Events" appears on admin page
2. Tab is admin-only (403 for CO/CHO)
3. Recent events list shows up to 50 rows, paginated
4. Filters work for status, sync_type, user_id, date range
5. Detail panel shows all fields including JSON contents
6. "Sync User by Payload" modal accepts valid JSON and triggers sync
7. After successful sync, new event appears at top of list
8. Failed sync attempts also appear in list with error details visible
9. partial_success events clearly distinguishable (color, badge, deferred_operations visible)
10. User_id search returns matching events

### Test cases

- `test_realtime_events_tab_renders_for_admin`
- `test_realtime_events_tab_403_for_co`
- `test_list_events_paginates`
- `test_list_events_filter_by_status`
- `test_list_events_filter_by_user_id`
- `test_list_events_filter_by_date_range`
- `test_event_detail_returns_all_fields`
- `test_event_detail_renders_json_fields_correctly`
- `test_sync_user_by_payload_modal_submits_correctly`
- `test_partial_success_events_display_deferred_operations`

---

# Part 3 — Wrap-up

## Resolved decisions

Locked at M8a spec time:

- Internal endpoint receives enriched payloads (Session-Ops does not call Hasura)
- Role allowlists: 11 roles for create/update, 2 values (Alumni, null) for deactivation
- Diff computed locally; caller's "what changed" hints not trusted
- `select_for_update` lock + stale timestamp check handle concurrent processing
- Cascade reuses M3 services for slot_class_section / class_section_subject / child_subject
- school_volunteer lifecycle moves entirely to realtime sync
- M3's `_reconcile_school_volunteer_for_volunteers` helper removed
- Slot-class create transaction shrinks from 5 tables to 4
- Partial-success behavior: no cascade, common fields only, worknode_id stays at old value
- Admin auth on endpoint for M8a; service token reserved for M8b
- Endpoint URL token in env var (non-obvious URL)
- Comprehensive sync log including skip/no-change cases
- Manual sync trigger via admin UI for M8a; n8n/webhook in M8b
- Field `is_active` renamed to `user_active_status` in API payload (matches Hasura naming). Local DB column remains `is_active` (Django convention). Payload `user_active_status=null` treated as `true` in service layer. Old field name rejected by `extra="forbid"`.
- Endpoint accepts defensive payloads: empty strings coerced to null, `worknode_id` accepts numeric strings, `user_active_status` accepts bool-like strings.

## Pre-build verification checklist (Day 1)

- [ ] Sample enriched user payload from Hasura's joined query reviewed
- [ ] Confirm `xModifiedTimestamp` field name in the payload
- [ ] M3 production deploy status verified (M8a assumes M3 cascade helpers exist)
- [ ] M4.md doc hygiene done (status reflects current state)

## Open questions to resolve during M8a

- **`last_synced_at` field on User model.** M8a's diff service uses this for stale-event detection. Does M2/M3 User model already have this field? If not, M8a adds it as a small extension.
- **JSON payload size for `incoming_payload` log field.** May need a max size check (e.g., truncate if >50KB).
- **Whether to display partial-success deferred_operations as an actionable item.** For M8a, just displayed. Later milestone may add "Re-sync now" button when partner_worknode is updated.

## Deferred to later milestones

- **M8b/M9:** n8n setup + Hasura Event Trigger → n8n → Session-Ops endpoint integration
- **Notification system** for sync failures, partial successes, deferred operations
- **Automatic retry mechanism.** Lives in M8b's orchestration layer.
- **Bulk sync endpoint.** Single-user is sufficient for M8a.
- **partner_worknode change → user re-sync.** Confirmed won't happen in practice; not addressed.
- **Email/Sentry/Slack alerts** for sync events.
- **Webhook receiver from Hasura.** That's M8b/M9 by design.

## Notes for plan-mode work

When working on M8a:

1. Read M8a.md, M3.md (for cascade helpers), M4.md (for SyncRun and admin page pattern) before any feature
2. Pick one feature at a time. Finish (build + test + manual smoke), then start next.
3. Tests are not optional. Service-layer unit tests + at least one integration test per endpoint.
4. The slot-class create modification (F-M8a-5) is risky because it touches M3 production-ready code. Add tests around the new behavior, run all M3 tests, verify no regressions.
5. The cascade logic reuses M3 services. Do NOT duplicate cascade code in M8a — call into M3's helpers (`_cascade_remove_slot_class_section`, etc.).
6. All multi-table operations use `transaction.atomic` with `select_for_update` on the user row.
7. Cascades are explicit in service code, not Django CASCADE. PROTECT is the only on_delete used.
8. The `realtime_sync_log` table is append-only via the API. Admin UI is read-only.

**Check in with the human (chat) when:**

- Architecture decisions arise that this doc doesn't answer
- The spec is ambiguous and the answer materially affects implementation
- About to do something risky (production deploy of slot-class create change, removal of `_reconcile_school_volunteer_for_volunteers`)
- Edge case: user with worknode_id set but no school_volunteer (drift state)

**Don't check in for:**

- Routine implementation choices
- Test failures you can debug yourself
- Style or formatting issues

## Done log

Append entries as work completes. Format: `YYYY-MM-DD — note`

*(empty — fill as M8a progresses)*
