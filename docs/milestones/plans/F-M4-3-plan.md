# Feature Plan: F-M4-3 — Holidays

## Overview

Per-school holiday management layered on top of the configured academic session. CO/admin/CHO can add date-range holidays (single-day or multi-day) with a reason, description, and remarks. Holidays must fall within the session window and cannot overlap other active holidays at the same school. The Calendar tab renders holiday pills on the month grid. Editing holiday dates uses soft-delete + create-new to preserve audit history; editing metadata fields (reason, description, remarks) updates in place. Deleting a holiday is a soft-delete.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | New | `SchoolHoliday` model + migration |
| Backend services | New | `services/holidays/create.py`, `edit.py`, `delete.py`, `queries.py` |
| Backend API endpoints | New | 4 endpoints under `/api/v1/schools/{id}/holidays/` |
| Backend schemas | New | `schemas/holidays.py` |
| Frontend pages | None | Renders inside CalendarTab |
| Frontend components | New | `AddHolidayModal`, `EditHolidayModal`, `DeleteHolidayModal`, `CalendarMonthGrid`, `HolidayPill` |
| Frontend components | Modified | `CalendarTab` — add "Add Holiday" button + render grid |
| Database migrations | Yes | New table `school_holiday` |
| Celery tasks | No | |
| Existing tests | None | No breakage expected |
| Documentation | No | |

## High-Level Design (HLD)

**Data flow (create holiday):**
1. CO opens Calendar tab → session is configured → "Add Holiday" button visible
2. Clicks button → `AddHolidayModal` opens
3. CO selects reason, start/end dates, optional description + remarks
4. Client validates dates (start ≤ end, within session window)
5. `POST /schools/{id}/holidays/` → service checks session exists, validates window, checks overlap → 200 or 400/409
6. Modal closes → `CalendarTab` re-fetches holidays → grid re-renders with new pill

**Data flow (edit holiday — metadata only):**
- `PATCH /holidays/{id}/` with only `{holiday_reason, holiday_description, remarks}` → in-place update, no overlap re-check

**Data flow (edit holiday — date change):**
- `PATCH /holidays/{id}/` with changed `start_date` or `end_date`
- Service: soft-delete old row, call `create_holiday` with merged payload (triggers overlap + window checks)
- Returns new holiday row (new `school_holiday_id`)
- Frontend must replace the old row id with the new one in state

**Data flow (delete holiday):**
- `DELETE /holidays/{id}/` → soft-delete → disappears from calendar immediately

**Holiday overlap check:** Classic interval overlap: `existing.start_date <= new.end_date AND existing.end_date >= new.start_date`. Excludes the row being edited (by id) when checking on date-edit.

## Low-Level Design (LLD)

### Backend

#### New model: `sessionops/models/school_holiday.py`

```python
HOLIDAY_REASONS = [
    ("mad_event", "MAD event (eg: YEC, etc)"),
    ("holidays", "Holidays"),
    ("cancelled_from_school_end", "Cancelled from school's end"),
]

class SchoolHoliday(SoftDeleteBaseModel):
    school_holiday_id   = models.BigAutoField(primary_key=True)
    school_id           = models.BigIntegerField(db_index=True)
    holiday_reason      = models.CharField(max_length=50, choices=HOLIDAY_REASONS)
    start_date          = models.DateField()
    end_date            = models.DateField()
    holiday_description = models.TextField(null=True, blank=True)
    remarks             = models.TextField(null=True, blank=True)
    created_by          = models.ForeignKey("User", on_delete=models.PROTECT, related_name="+")
    updated_by          = models.ForeignKey("User", on_delete=models.PROTECT, null=True, related_name="+")

    class Meta:
        db_table = "school_holiday"
        indexes = [
            models.Index(fields=["school_id", "is_active", "removed"]),
            models.Index(fields=["school_id", "start_date", "end_date"]),
        ]
```

Register in `sessionops/models/__init__.py`.

#### New service: `sessionops/services/holidays/create.py`

```python
@transaction.atomic
def create_holiday(school_id: int, payload: dict, user: User) -> SchoolHoliday
```

Steps:
1. `can_user_modify_school(user, school_id)` → PermissionDenied
2. Session must exist: `get_active_session(school_id)` → ValidationError if None
3. `start > end` → ValidationError
4. Window check: `start < session.start_date OR end > session.end_date` → ValidationError
5. Overlap check (exclude_id=None): Q filter → ConflictError with overlap details
6. Create and return

#### New service: `sessionops/services/holidays/edit.py`

```python
@transaction.atomic
def edit_holiday(school_holiday_id: int, payload: dict, user: User) -> SchoolHoliday
```

Steps:
1. `select_for_update().get(pk, removed=False)` → NotFound if missing
2. `can_user_modify_school(user, holiday.school_id)` → PermissionDenied
3. Detect date change: any of `start_date`, `end_date` in payload and different from current
4. **Date change path:**
   - Soft-delete current row (`is_active=False, removed=True, deleted_at=now, updated_by=user`)
   - Build `new_payload` merging current values with payload overrides
   - Call `create_holiday(school_id, new_payload, user)` (overlap check excludes the now-deleted row automatically)
   - Return new holiday
5. **Metadata-only path:**
   - Update `holiday_reason`, `holiday_description`, `remarks` in place
   - Set `updated_by=user`, save
   - Return updated holiday

#### New service: `sessionops/services/holidays/delete.py`

```python
@transaction.atomic
def soft_delete_holiday(school_holiday_id: int, user: User) -> None
```

- Fetch row (not removed) → NotFound
- `can_user_modify_school` → PermissionDenied
- Set `is_active=False, removed=True, deleted_at=now, updated_by=user`, save

#### New service: `sessionops/services/holidays/queries.py`

```python
def list_holidays(school_id: int, start_date=None, end_date=None) -> QuerySet
```

Returns active, non-removed holidays for the school, ordered by `start_date`. Optional date window filter.

#### New schemas: `sessionops/schemas/holidays.py`

```python
class HolidayCreateIn(Schema):
    holiday_reason: str  # validated against HOLIDAY_REASONS choices
    start_date: date
    end_date: date
    holiday_description: str | None = None
    remarks: str | None = None

class HolidayPatchIn(Schema):
    holiday_reason: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    holiday_description: str | None = None
    remarks: str | None = None

class HolidayOut(Schema):
    school_holiday_id: int
    school_id: int
    holiday_reason: str
    holiday_reason_display: str  # from get_holiday_reason_display()
    start_date: date
    end_date: date
    holiday_description: str | None
    remarks: str | None
    created_at: datetime
    updated_at: datetime
```

#### New API: `sessionops/api/holidays_api.py`

```python
router = Router(tags=["holidays"])

@router.get("/schools/{school_id}/holidays/", response={200: list[HolidayOut]}, auth=jwt_auth)
def list_holidays_api(request, school_id: int, start_date: date = None, end_date: date = None):
    ...

@router.post("/schools/{school_id}/holidays/", response={200: HolidayOut}, auth=jwt_auth)
def create_holiday_api(request, school_id: int, payload: HolidayCreateIn):
    ...

@router.patch("/schools/{school_id}/holidays/{holiday_id}/", response={200: HolidayOut}, auth=jwt_auth)
def edit_holiday_api(request, school_id: int, holiday_id: int, payload: HolidayPatchIn):
    ...

@router.delete("/schools/{school_id}/holidays/{holiday_id}/", response={204: None}, auth=jwt_auth)
def delete_holiday_api(request, school_id: int, holiday_id: int):
    ...
```

Register in `urls.py`.

#### Migration

New migration: create `school_holiday` table. No data backfill.

### Frontend

#### Files to modify

- `components/schools/calendar/CalendarTab.tsx`
  - Add `useHolidays(schoolId)` hook (fetches `GET /holidays/`)
  - Show "Add Holiday" button (only when session is configured)
  - Pass holidays to `<CalendarMonthGrid />`
  - Wire open/close state for Add/Edit/Delete modals

#### Files to create

- `components/schools/calendar/CalendarMonthGrid.tsx`
  - Month grid: 7-column grid, days numbered
  - Days outside session window: greyed-out style
  - Days with holidays: render `<HolidayPill />` for each overlapping holiday
  - Prev/Next month navigation arrows
  - "Jump to month" select picker
  - Click holiday pill → opens EditHolidayModal with that holiday
  - Props: `session: SessionOut`, `holidays: HolidayOut[]`, `currentMonth: Date`

- `components/schools/calendar/HolidayPill.tsx`
  - Colored chip: color keyed to `holiday_reason` enum
  - Shows reason label + truncated description
  - Full description on hover (tooltip)

- `components/schools/calendar/AddHolidayModal.tsx`
  - Fields: reason dropdown, start_date picker, end_date picker, description textarea, remarks textarea
  - Client validation: reason required, start ≤ end, both within session window (warning if outside — backend is authoritative)
  - Submit: `POST /holidays/` → on 200: close + refresh holidays; on 409: inline error with overlap details

- `components/schools/calendar/EditHolidayModal.tsx`
  - Same fields as Add, pre-populated from selected holiday
  - Warning banner above date pickers: "Changing dates will create a new holiday entry and archive this one."
  - Submit: `PATCH /holidays/{id}/` → on 200 with date change: new `school_holiday_id` returned — update local state

- `components/schools/calendar/DeleteHolidayModal.tsx`
  - Confirmation: "Delete holiday '{description or reason}' ({start} – {end})?"
  - Confirm: `DELETE /holidays/{id}/` → on 204: remove from local state

#### API integration: `lib/api/holidays.ts`

```ts
export const listHolidays = (schoolId: number, params?: { start_date?: string; end_date?: string }) =>
  apiClient.get<HolidayOut[]>(`/schools/${schoolId}/holidays/`, { params });

export const createHoliday = (schoolId: number, data: HolidayCreateIn) =>
  apiClient.post<HolidayOut>(`/schools/${schoolId}/holidays/`, data);

export const editHoliday = (schoolId: number, holidayId: number, data: HolidayPatchIn) =>
  apiClient.patch<HolidayOut>(`/schools/${schoolId}/holidays/${holidayId}/`, data);

export const deleteHoliday = (schoolId: number, holidayId: number) =>
  apiClient.delete(`/schools/${schoolId}/holidays/${holidayId}/`);
```

#### State management

Local `useState` in `CalendarTab` for holidays array. On date-edit, replace old holiday with new one returned from PATCH (new id). No Redux slice needed.

#### Form validation (Zod)

```ts
const addHolidaySchema = z.object({
  holiday_reason: z.enum(["mad_event", "holidays", "cancelled_from_school_end"]),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  holiday_description: z.string().optional(),
  remarks: z.string().optional(),
}).refine(d => new Date(d.start_date) <= new Date(d.end_date), {
  message: "Start date must be on or before end date",
  path: ["end_date"],
});
```

## Business Rules Enforced

- **R9 (soft delete):** Holiday delete sets `is_active=False, removed=True` — never hard-delete
- **R-cal-1 (session gate):** Can't add holiday if no active session → 400
- **R-cal-2 (window constraint):** Holiday dates must fall within session start/end → 400
- **R-cal-3 (no overlap):** Active holidays at same school cannot overlap → 409
- **Date-edit audit:** Date changes preserved via soft-delete + create-new pattern

## Security Review

| Endpoint | Auth | RBAC |
|----------|------|------|
| `GET /holidays/` | JWT required | `can_user_view_school` |
| `POST /holidays/` | JWT required | `can_user_modify_school` |
| `PATCH /holidays/{id}/` | JWT required | `can_user_modify_school` (checked via holiday.school_id) |
| `DELETE /holidays/{id}/` | JWT required | `can_user_modify_school` (checked via holiday.school_id) |

- `holiday_reason` is validated against the enum choices in the schema — no freeform injection
- `holiday_description` and `remarks` are free text stored as-is (no eval/exec surface in Django)
- `school_id` in path is typed int — Ninja rejects non-integer

## Testing Strategy

**Backend unit tests (`tests/services/test_holidays.py`):**
- `test_create_holiday_succeeds_within_session_window`
- `test_create_holiday_without_session_returns_400`
- `test_create_holiday_outside_session_window_returns_400`
- `test_create_holiday_overlapping_active_holiday_returns_409`
- `test_create_holiday_single_day_succeeds`
- `test_create_holiday_past_date_within_session_allowed`
- `test_create_holiday_optional_fields_can_be_null`
- `test_edit_holiday_reason_only_updates_in_place`
- `test_edit_holiday_date_range_soft_deletes_and_creates_new`
- `test_edit_holiday_date_change_triggers_overlap_check`
- `test_delete_holiday_soft_deletes`
- `test_list_holidays_returns_only_active`
- `test_list_holidays_windowed_query`
- `test_co_cannot_create_holiday_in_other_school`
- `test_cho_can_create_holiday_within_scope`

**Backend integration tests (`tests/api/test_holidays_api.py`):**
- `test_post_holiday_returns_200`
- `test_post_holiday_409_on_overlap`
- `test_patch_holiday_date_change_returns_new_id`
- `test_delete_holiday_returns_204`

**Frontend component tests:**
- `AddHolidayModal` submits correct payload, shows 409 error inline
- `EditHolidayModal` shows date-change warning, submits PATCH
- `DeleteHolidayModal` calls DELETE on confirm
- `CalendarMonthGrid` renders holiday pills on correct days

**Manual verification:**
- Add a single-day holiday → pill appears on that day in grid
- Add overlapping holiday → 409 error shown
- Edit dates → old pill gone, new pill on new date
- Delete holiday → pill disappears immediately

## Milestones (implementation order)

1. **Model + migration** — `SchoolHoliday` model + migration. (1 hr)
2. **Services** — `create_holiday`, `edit_holiday`, `soft_delete_holiday`, `list_holidays`. All overlap and window checks. Unit tests. (4 hr)
3. **API + schemas** — 4 endpoints. Integration tests. (2 hr)
4. **CalendarMonthGrid** — Month grid component with session window styling. No holidays yet (empty array). (3 hr)
5. **Holiday modals** — Add, Edit, Delete modals with API integration. (4 hr)
6. **HolidayPill + grid integration** — Render pills on grid days, connect Edit/Delete modals. (2 hr)
7. **Tests** — Frontend component tests. (2 hr)

## Open Questions

- **Overlap check on edit (date change):** The soft-delete approach means the old row is `removed=True` before `create_holiday` runs, so the overlap query naturally excludes it. Verify that `create_holiday`'s overlap check filters `removed=False` — it does per the service spec.
- **Calendar grid library:** Is there an existing date/calendar utility in the frontend (e.g. `date-fns`)? Check `package.json` before building the month grid. If `date-fns` is already a dependency, use it for month generation logic.
- **Holiday pill color scheme:** Three reasons need three colors. Confirm with designer or pick from the existing design system color tokens. Not blocking — can use placeholder colors initially.
- **Pagination on holiday list:** M4 spec says no pagination for holidays (school-scoped list is small). Confirm max reasonable holiday count per school per year to ensure a flat list is acceptable.
