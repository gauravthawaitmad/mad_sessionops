# F-M6-7 Execution Progress

## Chunk 1: children.service.ts contract update
- [x] `ChildItem` — remove `currentClassName`/`currentSectionName`/`currentSectionId`/`currentClassId`; add `currentSection`/`currentSchoolClass` nested objects
- [x] `EnrollChildInput` — add `school_class_id: number` (required); `class_section_id` becomes optional
- [x] `EditChildInput` — add `school_class_id?: number`; `class_section_id?: number | null` (explicit null = unassign)
- [x] `RawChild` + `mapChild` updated for nested `current_section`/`current_school_class`
- [x] `ListChildrenParams` — add `unassigned?: boolean`; `fetchChildren` serializes it
- [x] `reactivateChild` — accept `{ school_class_id: number; class_section_id?: number }` matching backend `ReactivateIn`

## Chunk 2: EnrollChildModal.tsx
- [x] Zod: `class_section_id` → `z.number().nullable().optional()`
- [x] Remove class→section cascade `useEffect`; fetch buckets independently via `fetchBuckets(schoolId)` on open
- [x] Replace `SectionPicker` with `BucketPicker` (uses `BucketItem`, includes an "Unassigned" tile)
- [x] `onSubmit` — always send `school_class_id`; send `class_section_id` only if chosen

## Chunk 3: EditChildDrawer.tsx
- [x] Same Zod/schema shift as Enroll
- [x] Pre-populate from `child.currentSchoolClass?.schoolClassId` / `child.currentSection?.classSectionId`
- [x] Replace section cascade with independent bucket fetch + `BucketPicker`
- [x] `onSubmit` diffs against original: `school_class_id` only if changed; `class_section_id` only if changed (explicit `null` when cleared)

## Chunk 4: ChildrenTab.tsx
- [x] Bucket column (replaces Section column): `currentSection?.sectionDisplayName ?? sectionName`, or "Unassigned" chip
- [x] Bucket filter dropdown (All / Unassigned / specific bucket) — independent of class filter, uses `fetchBuckets`
- [x] Remove class→section cascade (`fetchSections` keyed on `classId`)
- [x] Class filter stays independent, unchanged

## Extra (discovered during review, approved by user): ReactivateChildModal.tsx
- [x] Fetch buckets independently (drop class→section cascade); bucket optional, class required (matches `ReactivateIn`)
- [x] Submit sends `{ school_class_id, class_section_id? }` — currently missing `school_class_id` entirely (pre-existing bug, predates F-M6-7)

## Also touched (dependency, not in original blast radius)
- [x] `ManageBucketChildrenDrawer.tsx` (F-M6-6) reads `child.currentSectionId` — must switch to `child.currentSection` now that the flat field is removed
- [x] `ManageBucketChildrenDrawer.test.tsx` fixture updated for new `ChildItem` shape

## Tests
- [x] `EnrollChildModal.test.tsx` (5 tests)
- [x] `EditChildDrawer.test.tsx` (4 tests)
- [x] `ChildrenTab.test.tsx` (4 tests)
- [x] `ReactivateChildModal.test.tsx` (4 tests)
- [x] Update `ManageBucketChildrenDrawer.test.tsx` fixtures for new `ChildItem` shape

## Validation
- [x] `npm run type-check` — clean
- [x] `npm run test` — new/updated suites (children, structure, SchoolDetailPage): 61/61 passing. Full suite: 108/110 passing under parallel load; the 2 failures are in `__tests__/admin/DataSyncTab.test.tsx`, untouched by this diff and already flaky/pre-existing (also seen intermittently failing during F-M6-6's execution, along with RealtimeEventsTab/SchoolListPage/CalendarTab in different runs — a resource-contention issue under `vitest run` with no test file selector, not a regression from this feature).

## Blockers
- None
