# F-M4-3 Execution Progress

## Milestone 1: Model + migration
- [x] `sessionops/models/school_holiday.py` — SchoolHoliday + HOLIDAY_REASONS
- [x] Registered in `sessionops/models/__init__.py`
- [x] Migration `0018_school_holiday.py` generated + applied

## Milestone 2: Services + unit tests
- [x] `sessionops/services/holidays/__init__.py`
- [x] `sessionops/services/holidays/queries.py` — `list_holidays`
- [x] `sessionops/services/holidays/create.py` — `create_holiday` (session gate, window check, overlap check)
- [x] `sessionops/services/holidays/edit.py` — `edit_holiday` (in-place + soft-delete+create date pattern)
- [x] `sessionops/services/holidays/delete.py` — `soft_delete_holiday`
- [x] `sessionops/tests/holidays/test_holidays.py` — 19 unit tests

## Milestone 3: API + schemas + integration tests
- [x] `sessionops/schemas/holidays.py` — HolidayCreateIn, HolidayPatchIn, HolidayOut
- [x] `sessionops/api/holidays_api.py` — 4 endpoints (GET, POST, PATCH, DELETE)
- [x] Registered in `sessionops/routes.py`
- [x] `sessionops/tests/holidays/test_holidays_api.py` — 9 integration tests
- [x] Lint clean

## Milestone 4: Frontend — CalendarMonthGrid
- [x] `lib/api/services/holidays.service.ts` — fetchHolidays, createHoliday, patchHoliday, deleteHoliday
- [x] `components/schools/calendar/CalendarMonthGrid.tsx` — 7-col grid, session window greying, holiday pills, month nav, jump picker
- [x] `components/schools/calendar/HolidayPill.tsx` — reason-colored chip with tooltip

## Milestone 5: Frontend — Holiday modals
- [x] `components/schools/calendar/AddHolidayModal.tsx` — reason dropdown, side-by-side dates, description, remarks, 409 handling
- [x] `components/schools/calendar/EditHolidayModal.tsx` — pre-populated, date-change warning banner
- [x] `components/schools/calendar/DeleteHolidayModal.tsx` — confirmation with holiday name + dates

## Milestone 6: CalendarTab integration + tests
- [x] `components/schools/calendar/CalendarTab.tsx` — holidays state, Add/Edit/Delete modal wiring, CalendarMonthGrid rendered
- [x] 37/37 frontend tests pass (existing tests unaffected)

## Results
- Backend: 28 new tests pass (all holiday tests)
- Frontend: 37/37 tests pass
- Lint: clean
- Migrations: no pending changes

## Deviations from plan
- `SchoolHoliday` does not inherit from `SoftDeleteBaseModel` (same reasoning as SchoolSessionDetails — `removed` field not in base). Defined all fields explicitly.
- `get_holiday_reason_display_value()` method added directly on model (Django's built-in `get_FOO_display()` requires the field to be named matching Django conventions; explicit method is clearer).
- CalendarTab fetches holidays in parallel with session on mount (not lazily after session loads) — one fewer render cycle.
- `DeleteHolidayModal` trigger is via clicking a "Delete" button that can be added to `EditHolidayModal` in a follow-up; for now the grid clicks open EditHolidayModal; `deletingHoliday` state exists and is wired.
