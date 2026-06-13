# Feature Plan: F-M4-2 — Session Dates

## Overview

Implements the one-time, immutable academic session configuration for a school. CO/admin/CHO opens the Calendar tab empty state, clicks "Configure session", fills a modal pre-filled from Partner MOU dates, saves. Backend creates a `SchoolSessionDetails` row. Once saved, the tab header shows static session dates with no edit affordance. The session cannot be modified or deleted in M4.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | New | `SchoolSessionDetails` model + migration |
| Backend services | New | `services/sessions/create.py`, `services/sessions/get_defaults.py` |
| Backend API endpoints | New | 3 endpoints under `/api/v1/schools/{id}/session/` |
| Backend schemas | New | `schemas/sessions.py` |
| Frontend pages | None | CalendarTab already created in F-M4-1 |
| Frontend components | New | `SetSessionModal.tsx`, update `CalendarTab` for configured state |
| Database migrations | Yes | New table `school_session_details` |
| Existing tests | None | No breakage expected |
| Documentation | No | |

## High-Level Design (HLD)

**Data flow (create session):**
1. CO opens Calendar tab → `CalendarTab` calls `GET /schools/{id}/session/` → null
2. CalendarEmptyState CTA clicked → `SetSessionModal` opens
3. Modal calls `GET /schools/{id}/session/defaults/` → pre-fills date pickers
4. CO adjusts dates → clicks Save → `POST /schools/{id}/session/` → 200
5. Modal closes → `CalendarTab` re-fetches session → renders configured state (header + month grid)

**Immutability:** No PATCH or DELETE endpoint exists. Once created, only the admin can modify via direct DB access (M4 design decision, per spec).

**Concurrency guard:** On duplicate POST (race condition → 409), frontend shows error toast and reloads the tab.

**Session defaults:** `start_date = partner.mou_sign_date + timedelta(days=60)`, `end_date = partner.mou_end_date`. Returns values even if they're in the past.

## Low-Level Design (LLD)

### Backend

#### New model: `sessionops/models/session_details.py`

```python
class SchoolSessionDetails(SoftDeleteBaseModel):
    session_id              = models.BigAutoField(primary_key=True)
    school_id               = models.BigIntegerField(db_index=True)
    school_academic_year    = models.ForeignKey("SchoolAcademicYear", on_delete=models.PROTECT)
    start_date              = models.DateField()
    end_date                = models.DateField()
    created_by              = models.ForeignKey("User", on_delete=models.PROTECT, related_name="+")
    updated_by              = models.ForeignKey("User", on_delete=models.PROTECT, null=True, related_name="+")

    class Meta:
        db_table = "school_session_details"
        indexes = [
            models.Index(fields=["school_id", "is_active", "removed"]),
            models.Index(fields=["school_academic_year"]),
        ]
```

Note: `is_active`, `removed`, `deleted_at`, `created_at`, `updated_at` come from `SoftDeleteBaseModel`.

Register in `sessionops/models/__init__.py`.

#### New service: `sessionops/services/sessions/create.py`

```python
@transaction.atomic
def create_school_session(school_id: int, start_date: date, end_date: date, user: User) -> SchoolSessionDetails
```

- RBAC: `can_user_modify_school(user, school_id)` → raise PermissionDenied
- Validate: `start_date >= end_date` → raise ValidationError
- Get active year: `get_active_school_academic_year(school_id)` → raise NotFound if none
- Conflict check: active, non-removed session exists for (school_id, year) → raise ConflictError (409)
- Create and return

#### New service: `sessionops/services/sessions/get_defaults.py`

```python
def get_session_defaults(school_id: int, user: User) -> dict
```

- RBAC: `can_user_view_school(user, school_id)` → raise PermissionDenied
- Fetch `Partner` for school_id → raise NotFound if missing
- Returns `{default_start_date, default_end_date, academic_year_label}`
- `default_start_date = partner.mou_sign_date + timedelta(days=60)` (None-safe: return None if mou_sign_date is null)
- `default_end_date = partner.mou_end_date`

#### New service: `sessionops/services/sessions/queries.py`

```python
def get_active_session(school_id: int) -> SchoolSessionDetails | None
```

Returns first active, non-removed session for the school's current academic year.

#### New schemas: `sessionops/schemas/sessions.py`

```python
class SessionDefaultsOut(Schema):
    default_start_date: date | None
    default_end_date: date | None
    academic_year_label: str  # e.g. "2026-2027"

class SessionCreateIn(Schema):
    start_date: date
    end_date: date

class SessionOut(Schema):
    session_id: int
    school_id: int
    school_academic_year_id: int
    start_date: date
    end_date: date
    created_at: datetime
```

#### New API: `sessionops/api/sessions_api.py`

```python
router = Router(tags=["sessions"])

@router.get("/schools/{school_id}/session/", response={200: SessionOut | None}, auth=jwt_auth)
def get_session(request, school_id: int):
    session = get_active_session(school_id)
    return 200, session  # None → serialized as null in response

@router.get("/schools/{school_id}/session/defaults/", response={200: SessionDefaultsOut}, auth=jwt_auth)
def get_session_defaults_api(request, school_id: int):
    return 200, get_session_defaults(school_id, request.auth)

@router.post("/schools/{school_id}/session/", response={200: SessionOut}, auth=jwt_auth)
def create_session(request, school_id: int, payload: SessionCreateIn):
    session = create_school_session(school_id, payload.start_date, payload.end_date, request.auth)
    return 200, session
```

Register router in `mad_sessionops_backend/mad_sessionops_backend/urls.py` (or wherever Ninja API is mounted).

#### Migration

New migration: create `school_session_details` table. No data backfill needed (all schools start without a session).

### Frontend

#### Files to modify

- `components/schools/calendar/CalendarTab.tsx`
  - After session loads (non-null), render `<SessionHeader session={session} />` + `<CalendarMonthGrid session={session} ... />`
  - Pass `onSessionCreated` callback to `SetSessionModal` to re-fetch

#### Files to create

- `components/schools/calendar/SetSessionModal.tsx`
  - On open: fetches `GET /session/defaults/` to pre-fill pickers
  - Fields: academic_year (read-only text), start_date picker, end_date picker
  - Warning banner (immutability warning)
  - Client validation: both required, start < end
  - Submit: `POST /session/` → on 200: close + notify parent → on 409: show error + suggest reload
  - Buttons: Cancel / Save

- `components/schools/calendar/SessionHeader.tsx`
  - Static display: "Session: {start} – {end}" (no edit affordance)

#### API integration (extend `lib/api/sessions.ts`)

```ts
export const getSchoolSession = (schoolId: number) =>
  apiClient.get<SessionOut | null>(`/schools/${schoolId}/session/`);

export const getSessionDefaults = (schoolId: number) =>
  apiClient.get<SessionDefaultsOut>(`/schools/${schoolId}/session/defaults/`);

export const createSession = (schoolId: number, data: SessionCreateIn) =>
  apiClient.post<SessionOut>(`/schools/${schoolId}/session/`, data);
```

#### State management

Local `useState` in `CalendarTab` for `session` and `isSetSessionModalOpen`. No Redux slice needed (session is school-scoped, not global).

## Business Rules Enforced

- **One session per (school, academic year):** enforced in `create_school_session` — 409 if duplicate
- **start_date < end_date:** enforced in service + client validation
- **Session immutability:** no PATCH/DELETE endpoint; no edit affordance in UI
- **RBAC:** CO scoped to own schools, CHO scoped to worknode schools, admin unrestricted

## Security Review

| Endpoint | Auth | RBAC |
|----------|------|------|
| `GET /session/` | JWT required | `can_user_view_school` |
| `GET /session/defaults/` | JWT required | `can_user_view_school` |
| `POST /session/` | JWT required | `can_user_modify_school` |

- Input: `start_date` and `end_date` are typed `date` fields — Pydantic rejects non-date inputs
- `school_id` in path is an integer — Ninja rejects non-integer
- No free-text fields; no XSS surface

## Testing Strategy

**Backend unit tests (`tests/services/test_create_session.py`):**
- `test_create_session_succeeds_with_valid_dates`
- `test_create_session_start_after_end_returns_400`
- `test_create_session_returns_409_when_active_session_exists`
- `test_create_session_starts_in_past_allowed`
- `test_co_cannot_create_session_in_other_school`
- `test_cho_can_create_session_within_scope`
- `test_admin_can_create_session_in_any_school`

**Backend unit tests (`tests/services/test_session_defaults.py`):**
- `test_get_session_defaults_returns_mou_based_values`
- `test_get_session_defaults_with_past_mou_sign_date`
- `test_get_session_defaults_with_null_mou_sign_date`

**Backend integration tests (`tests/api/test_sessions_api.py`):**
- `test_get_session_returns_null_when_not_configured`
- `test_post_session_creates_row`
- `test_post_session_409_on_duplicate`

**Frontend component tests:**
- `SetSessionModal` renders with pre-filled dates from defaults
- Submit with invalid dates shows error
- Submit with valid dates calls POST and closes modal

**Manual verification:**
- Open Calendar tab, click "Configure session", verify defaults are pre-filled
- Save → header shows session dates, modal is gone, no edit affordance visible
- Re-open tab (refresh) → configured state persists

## Milestones (implementation order)

1. **Model + migration** — Create `SchoolSessionDetails` model file + generate migration. (1 hr)
2. **Services** — `create_school_session`, `get_session_defaults`, `get_active_session`. Unit tests. (3 hr)
3. **API + schemas** — 3 endpoints, schemas, register router. Integration tests. (2 hr)
4. **Frontend — SetSessionModal** — Modal component with date pickers, defaults pre-fill, warning banner, POST integration. (3 hr)
5. **Frontend — CalendarTab configured state** — SessionHeader + wire modal open/close. (1 hr)
6. **Frontend tests** — Component tests for modal and configured state. (1 hr)

## Open Questions

- **Partner model field names:** Confirm `partner.mou_sign_date` and `partner.mou_end_date` exist as DateField on the Partner model (not aliased differently from Hasura). Check `sessionops/models/partner.py` before implementing `get_session_defaults`.
- **`get_active_school_academic_year` helper:** Confirm this function already exists in `services/academic_year/queries.py` or equivalent. If not, create a simple query in `services/sessions/queries.py`.
- **Response shape for `null` session:** Ninja may serialize `None` differently — confirm frontend handles both `null` body and `{session: null}` wrapper gracefully.
