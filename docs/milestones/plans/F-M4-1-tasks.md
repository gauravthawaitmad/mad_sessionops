# F-M4-1 Execution Progress

## Milestone 1: Remove tab disable
- [x] `SchoolDetailPage.tsx` — set calendar `enabled: true`
- [x] `SchoolDetailPage.tsx` — import CalendarTab + render in content switch

## Milestone 2: CalendarEmptyState
- [x] Created `components/schools/calendar/CalendarEmptyState.tsx`

## Milestone 3: CalendarTab + sessions service
- [x] Created `lib/api/services/sessions.service.ts`
- [x] Created `components/schools/calendar/CalendarTab.tsx`

## Milestone 4: Tests
- [x] Created `__tests__/schools/calendar/CalendarTab.test.tsx` (8 tests)
- [x] Updated `__tests__/schools/SchoolDetailPage.test.tsx`:
  - Added mocks for sessions, slots, slot_classes, volunteers, schedule, permissions services + useUserCan hook
  - Fixed all 5 tooltip-count assertions from `.toBe(1)` → `.toBe(0)` (Calendar now enabled)
  - Renamed `test_school_detail_disables_other_tabs` → `test_school_detail_all_tabs_enabled_in_m4`
  - Fixed stale slot empty-state text assertion (pre-existing mismatch)

## Result
28/28 tests passing. No lint issues introduced.

## Deviations from plan
- `_configureOpen` state wired in CalendarTab but modal itself (F-M4-2) is a no-op for now — clicking CTA opens nothing visible yet. This is expected per the plan ("clicking the CTA can render a placeholder").
- Added mocks for additional services (slots, volunteers, schedule, permissions) in SchoolDetailPage tests — these were pre-existing failures unrelated to F-M4-1, but fixed while touching the file.
- Fixed one pre-existing stale text assertion in `test_slots_tab_empty_state_for_school_with_no_slots`.

## Blockers
- None
