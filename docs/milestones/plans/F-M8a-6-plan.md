# Feature Plan: F-M8a-6 — Realtime Events Admin Tab

## Overview

Adds a read-only "Realtime Events" tab to the existing admin sync dashboard. Admins can view the full audit log of realtime sync events (with filters, pagination, and detail view), and trigger a manual sync for a single user by providing an enriched payload. Follows the same page structure and API pattern as M4's admin sync tab.

---

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| `api/admin_realtime_events_api.py` | New | List + detail + manual-trigger endpoints |
| `routes.py` | Modified | Register new admin realtime events router |
| `components/admin/AdminPage.tsx` | Modified | Add "Realtime Events" tab |
| `components/admin/RealtimeEventsTab.tsx` | New | Tab container with filter controls + list |
| `components/admin/RealtimeEventList.tsx` | New | Paginated log list table |
| `components/admin/RealtimeEventDetail.tsx` | New | Expandable/modal detail view |
| `components/admin/SyncUserByPayloadModal.tsx` | New | Manual sync trigger form |
| `lib/api/services/realtimeSync.service.ts` | New | Frontend API calls |
| `__tests__/admin/RealtimeEventsTab.test.tsx` | New | Component tests |
| Existing admin tests | None | No existing test files modified |
| Backend migrations | None | No new model fields |

---

## High-Level Design

```
AdminPage (tabs: Sync Runs | Realtime Events)
    |
    └── RealtimeEventsTab
            |
            ├── Filter bar (date range, status, sync_type, user_id, event_type)
            ├── RealtimeEventList (paginated table)
            │       └── Row click → RealtimeEventDetail (modal/drawer)
            └── "Sync User" button → SyncUserByPayloadModal
                        |
                        └── Paste enriched JSON payload
                            → POST /api/admin/realtime-events/sync-user/
                            → Shows result inline
```

All admin endpoints require admin JWT. No CO/CHO access.

---

## Low-Level Design

### Backend: `api/admin_realtime_events_api.py`

#### Schema

```python
from ninja import Schema
from typing import Optional
from datetime import datetime

class RealtimeSyncLogOut(Schema):
    realtime_sync_log_id: int
    user_id_from_source: int
    sync_type: str
    event_type: str
    received_at: datetime
    processed_at: Optional[datetime]
    status: str
    action_taken: str
    error_details: Optional[str]
    field_changes: Optional[list]
    cascaded_changes: Optional[list]
    deferred_operations: Optional[dict]
    rules_fired: Optional[list]
    triggered_by_user_id: Optional[int]
    external_event_id: Optional[str]

class RealtimeSyncLogDetailOut(RealtimeSyncLogOut):
    pre_snapshot: Optional[dict]
    incoming_payload: Optional[dict]

class RealtimeSyncLogListOut(Schema):
    total: int
    page: int
    page_size: int
    results: list[RealtimeSyncLogOut]

class ManualSyncIn(Schema):
    payload: dict   # raw enriched user payload (validated by realtime_sync schema inside service)

class ManualSyncOut(Schema):
    log_id: int
    status: str
    action_taken: str
    field_changes: Optional[list]
    cascaded_changes: Optional[list]
    deferred_operations: Optional[dict]
    error_details: Optional[str]
```

#### Endpoints

```
GET  /api/admin/realtime-events/
     Query params: page, page_size (default 25), status, sync_type, event_type, 
                   user_id_from_source, date_from, date_to
     Auth: Admin JWT
     Returns: RealtimeSyncLogListOut

GET  /api/admin/realtime-events/{log_id}/
     Auth: Admin JWT
     Returns: RealtimeSyncLogDetailOut (includes pre_snapshot + incoming_payload)

POST /api/admin/realtime-events/sync-user/
     Body: ManualSyncIn
     Auth: Admin JWT
     Returns: ManualSyncOut
     Note: Parses ManualSyncIn.payload as RealtimeSyncUserPayload, calls process_sync_event
```

```python
from ninja import Router
from sessionops.services.rbac.scope import require_admin_scope
from sessionops.models import RealtimeSyncLog
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload
from sessionops.services.realtime_sync.orchestrator import process_sync_event

router = Router(tags=["admin-realtime-events"])

@router.get("", response=RealtimeSyncLogListOut)
def list_realtime_events(request, page: int = 1, page_size: int = 25,
                          status: str = None, sync_type: str = None,
                          event_type: str = None, user_id_from_source: int = None,
                          date_from: str = None, date_to: str = None):
    require_admin_scope(request.auth)
    
    qs = RealtimeSyncLog.objects.order_by("-received_at")
    if status:       qs = qs.filter(status=status)
    if sync_type:    qs = qs.filter(sync_type=sync_type)
    if event_type:   qs = qs.filter(event_type=event_type)
    if user_id_from_source: qs = qs.filter(user_id_from_source=user_id_from_source)
    if date_from:    qs = qs.filter(received_at__gte=parse_date(date_from))
    if date_to:      qs = qs.filter(received_at__lte=parse_date(date_to))
    
    total = qs.count()
    offset = (page - 1) * page_size
    results = list(qs[offset:offset + page_size])
    return {"total": total, "page": page, "page_size": page_size, "results": results}

@router.get("/{log_id}", response=RealtimeSyncLogDetailOut)
def get_realtime_event(request, log_id: int):
    require_admin_scope(request.auth)
    try:
        return RealtimeSyncLog.objects.get(realtime_sync_log_id=log_id)
    except RealtimeSyncLog.DoesNotExist:
        raise NotFound("Realtime sync log entry not found")

@router.post("/sync-user", response=ManualSyncOut)
def manual_sync_user(request, body: ManualSyncIn):
    require_admin_scope(request.auth)
    try:
        sync_payload = RealtimeSyncUserPayload(**body.payload)
    except Exception as e:
        raise BusinessValidationError(f"Invalid payload: {e}")
    
    log = process_sync_event(sync_payload, triggered_by=request.auth)
    return {
        "log_id": log.realtime_sync_log_id,
        "status": log.status,
        "action_taken": log.action_taken,
        "field_changes": log.field_changes,
        "cascaded_changes": log.cascaded_changes,
        "deferred_operations": log.deferred_operations,
        "error_details": log.error_details,
    }
```

#### Route registration in `routes.py`

```python
from sessionops.api.admin_realtime_events_api import router as admin_realtime_events_router

api.add_router("/admin/realtime-events", admin_realtime_events_router)
```

---

### Frontend: `lib/api/services/realtimeSync.service.ts`

```typescript
import { apiClient } from "../client";

export interface RealtimeSyncLogEntry {
  realtime_sync_log_id: number;
  user_id_from_source: number;
  sync_type: string;
  event_type: string;
  received_at: string;
  processed_at: string | null;
  status: string;
  action_taken: string;
  error_details: string | null;
  field_changes: Array<{ field: string; old: unknown; new: unknown }> | null;
  cascaded_changes: Array<{ table: string; id?: number; action: string }> | null;
  deferred_operations: Record<string, unknown> | null;
  rules_fired: string[] | null;
  triggered_by_user_id: number | null;
}

export interface RealtimeSyncLogDetail extends RealtimeSyncLogEntry {
  pre_snapshot: Record<string, unknown> | null;
  incoming_payload: Record<string, unknown> | null;
}

export interface RealtimeEventsListResponse {
  total: number;
  page: number;
  page_size: number;
  results: RealtimeSyncLogEntry[];
}

export interface ManualSyncResult {
  log_id: number;
  status: string;
  action_taken: string;
  field_changes: RealtimeSyncLogEntry["field_changes"];
  cascaded_changes: RealtimeSyncLogEntry["cascaded_changes"];
  deferred_operations: RealtimeSyncLogEntry["deferred_operations"];
  error_details: string | null;
}

export const realtimeSyncService = {
  listEvents: (params: {
    page?: number;
    page_size?: number;
    status?: string;
    sync_type?: string;
    event_type?: string;
    user_id_from_source?: number;
    date_from?: string;
    date_to?: string;
  }): Promise<RealtimeEventsListResponse> =>
    apiClient.get("/admin/realtime-events", { params }),

  getEvent: (logId: number): Promise<RealtimeSyncLogDetail> =>
    apiClient.get(`/admin/realtime-events/${logId}`),

  manualSync: (payload: Record<string, unknown>): Promise<ManualSyncResult> =>
    apiClient.post("/admin/realtime-events/sync-user", { payload }),
};
```

---

### Frontend components

#### `components/admin/RealtimeEventsTab.tsx`

Container. Holds filter state (status, sync_type, event_type, user_id, date range), fetches list via `realtimeSyncService.listEvents`, renders `RealtimeEventList` + "Sync User" button.

Filter state: local React state (no Redux needed — filters are ephemeral).

```tsx
const [filters, setFilters] = useState({ status: "", sync_type: "", event_type: "",
  user_id_from_source: "", date_from: "", date_to: "", page: 1 });
const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
const [showSyncModal, setShowSyncModal] = useState(false);
```

Renders:
- Filter bar: dropdowns for status, sync_type, event_type; text input for user_id; date inputs
- `<RealtimeEventList events={results} total={total} page={filters.page} onPageChange onRowClick />`
- `<RealtimeEventDetail logId={selectedLogId} onClose />` (modal, null when closed)
- `<SyncUserByPayloadModal open={showSyncModal} onClose onSuccess />`

---

#### `components/admin/RealtimeEventList.tsx`

Table columns: `log_id`, `user_id_from_source`, `event_type`, `received_at` (formatted), `status` (badge), `action_taken`.

Status badge colors:
- `success` → green
- `partial_success` → yellow/amber
- `failed` → red
- `skipped_*` → gray
- `running` → blue (shouldn't normally appear in list)

Pagination: same pattern as M4's SyncRunList component.

---

#### `components/admin/RealtimeEventDetail.tsx`

Modal. Fetches full detail via `realtimeSyncService.getEvent(logId)` on mount.

Sections:
1. **Header:** log_id, received_at, processed_at, status, action_taken
2. **User info:** user_id_from_source, sync_type, event_type, triggered_by_user_id
3. **Field changes:** table showing {field, old, new} rows (from `field_changes`)
4. **Cascaded changes:** table showing {table, id/parent_id, action, count?}
5. **Deferred operations:** JSON viewer (shown only if `deferred_operations` non-null)
6. **Pre-snapshot / Incoming payload:** collapsible JSON viewer
7. **Error details:** shown only if `error_details` non-null, red text block

---

#### `components/admin/SyncUserByPayloadModal.tsx`

Form with:
- Textarea: paste enriched JSON payload (large textarea, monospace font)
- Event type selector: "insert" | "update" | "deactivate"
- Submit button: "Sync User"
- Result panel: shows `status`, `action_taken`, `field_changes`, `error_details` after submit

On submit:
1. Parse textarea content as JSON
2. Add `event_type` from selector, `sync_type: "manual_admin"`
3. Call `realtimeSyncService.manualSync(parsedPayload)`
4. Show result inline
5. On success: call `onSuccess()` to refresh the events list

---

#### Modify `components/admin/AdminPage.tsx`

Add "Realtime Events" tab alongside existing tabs (e.g. "Sync Runs").

Follow same pattern as existing tabs:
```tsx
const TABS = ["Sync Runs", "Realtime Events"];  // add to existing tab list
```

Render:
```tsx
{activeTab === "Realtime Events" && <RealtimeEventsTab />}
```

---

## Business Rules Enforced

- **Admin-only:** All three endpoints call `require_admin_scope`. CO/CHO cannot view sync logs.
- **`pre_snapshot` and `incoming_payload` only in detail view:** Not returned in list endpoint (reduces payload size).
- **Manual sync same business logic:** `manual_sync_user` calls `process_sync_event` directly — no separate code path.

---

## Security Review

- All endpoints require admin JWT — same as M4's admin sync endpoints.
- `ManualSyncIn.payload` is parsed as `RealtimeSyncUserPayload` (Pydantic validation) before any processing. Invalid JSON or missing required fields → 400 via `BusinessValidationError`.
- `pre_snapshot` and `incoming_payload` JSON blobs are displayed to admins only. They may contain PII (email, phone) — acceptable for admin view.
- Frontend JSON textarea input is passed through Pydantic validation on the backend; no eval/exec of JSON content.

---

## Testing Strategy

### Backend: `tests/sync/test_admin_realtime_events_api.py`

```python
def test_list_events_requires_admin():
    # CO/CHO JWT → 403

def test_list_events_returns_paginated_results():
    # Insert 30 log rows; GET with page=2&page_size=10
    # Assert 10 results, total=30

def test_list_events_filter_by_status():
    # Insert rows with mixed statuses; filter status=success → only success rows returned

def test_list_events_filter_by_user_id():
    # Insert rows with different user_id_from_source; filter → correct rows

def test_list_events_filter_by_date_range():
    # Insert rows at different times; filter date_from → only recent rows

def test_get_event_detail_includes_snapshots():
    # GET /{log_id}/ → assert pre_snapshot and incoming_payload present

def test_get_event_not_found():
    # GET /9999/ → 404

def test_manual_sync_valid_payload():
    # POST /sync-user with valid payload → 200, log_id returned

def test_manual_sync_invalid_payload():
    # POST /sync-user with missing required field → 400

def test_manual_sync_writes_triggered_by():
    # POST as admin → assert RealtimeSyncLog.triggered_by = admin user
```

### Frontend: `__tests__/admin/RealtimeEventsTab.test.tsx`

```typescript
describe("RealtimeEventsTab", () => {
  it("renders event list on mount");
  it("filters by status");
  it("opens detail modal on row click");
  it("opens sync modal on button click");
  it("refreshes list after successful manual sync");
  it("shows status badge with correct color for each status value");
});

describe("SyncUserByPayloadModal", () => {
  it("validates JSON before submitting");
  it("shows error if JSON invalid");
  it("shows result panel after successful sync");
  it("shows error_details if sync fails");
});
```

---

## Implementation Order

1. Write `api/admin_realtime_events_api.py` (all 3 endpoints)
2. Register in `routes.py`
3. Write backend tests
4. Write `lib/api/services/realtimeSync.service.ts`
5. Write `RealtimeEventsTab.tsx`
6. Write `RealtimeEventList.tsx`
7. Write `RealtimeEventDetail.tsx`
8. Write `SyncUserByPayloadModal.tsx`
9. Modify `AdminPage.tsx` to add tab
10. Write frontend tests
11. Manual test: trigger manual sync from UI → verify log entry appears in list → click row → verify detail modal

---

## Open Questions

1. **Existing `AdminPage.tsx` tab structure** — confirm how tabs are currently implemented (state + conditional render, or router-based tabs). Follow the same pattern.
2. **M4 SyncRunList component** — can `RealtimeEventList` reuse any existing list/pagination components from M4? Review before writing from scratch.
3. **Date input format for filters** — does the existing admin UI have a date picker component? If so, use the same one. If not, a plain `<input type="date">` is acceptable for M8a.
4. **Enriched payload format for manual sync** — what does the admin paste into the textarea? Define and document the expected JSON structure (same as `RealtimeSyncUserPayload`). Consider adding a format hint/example in the modal.
5. **Log retention** — no cleanup policy defined for `realtime_sync_log` rows. Out of scope for M8a, but worth flagging for M8b/M9.
