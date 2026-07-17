# F-M6-6 Execution Progress

## Chunk 1: buckets.service.ts + BucketsTab + BucketCard (read-only)
- [x] `lib/api/services/buckets.service.ts` — fetch/create/edit/remove bucket, add/remove child
- [x] `components/schools/structure/BucketCard.tsx`
- [x] `components/schools/structure/BucketsTab.tsx`

## Chunk 2: AddBucketModal + EditBucketModal
- [x] `components/schools/structure/AddBucketModal.tsx`
- [x] `components/schools/structure/EditBucketModal.tsx`
- [x] Wire into `BucketsTab`/`BucketCard`

## Chunk 3: ManageBucketChildrenDrawer
- [x] `components/schools/structure/ManageBucketChildrenDrawer.tsx`
- [x] Wire into `BucketCard`

## Chunk 4: Cleanup + SchoolDetailPage swap
- [x] `SchoolDetailPage.tsx` — tab label "Structure" → "Buckets", swap component
- [x] Delete `StructureTab.tsx`, `AddClassModal.tsx`, `AddSectionModal.tsx`
- [x] Update `SchoolDetailPage.test.tsx` — "Structure" → "Buckets" references

## Tests
- [x] `BucketsTab.test.tsx`
- [x] `BucketCard.test.tsx`
- [x] `AddBucketModal.test.tsx`
- [x] `EditBucketModal.test.tsx`
- [x] `ManageBucketChildrenDrawer.test.tsx`
- [x] `SchoolDetailPage.test.tsx` updates

## Validation
- [x] `npm run type-check` (tsc --noEmit) — clean. `npm run lint` (`next lint`) is broken pre-existing in this repo: Next.js 16.0.7 dropped the `next lint` command entirely (`next lint --help` shows no such subcommand), and running `eslint` directly hits a pre-existing circular-JSON crash in the flat-config/eslintrc bridge (`eslint-config-next` + `eslint.config.mjs`), unrelated to this feature. Not fixed — out of scope for F-M6-6; flagged for a separate tooling fix.
- [x] `npm run test` — new tests: 39/39 passing (BucketsTab, BucketCard, AddBucketModal, EditBucketModal, ManageBucketChildrenDrawer, SchoolDetailPage). Full suite: 85/88 passing; 3 failures in `__tests__/admin/DataSyncTab.test.tsx` and `__tests__/admin/RealtimeEventsTab.test.tsx` — both pre-existing (files untouched by this diff, confirmed via `git status`), unrelated to Buckets.

## Deviations from plan
- `BucketCard` menu-only for "Manage Children" (no separate always-visible button) — the plan's LLD didn't specify a duplicate entry point, so kept it to the three-dot menu per the M6.md spec's file list.
- Added `aria-label`s ("Close", "Add child", "Remove child") to icon-only buttons in `ManageBucketChildrenDrawer` — not in the plan, but needed for accessible names and stable test queries; harmless UI addition.
- **Restored `AddClassModal.tsx`** and added a "Classes" section (list + Add Class + remove) to the top of `BucketsTab.tsx`. The written plan (and M6.md) said to delete `AddClassModal.tsx` along with `StructureTab`/`AddSectionModal`, but that conflated two concerns: section→bucket (correct to remove) and school↔class assignment (a separate, still-mandatory concept per F-M6-4 — `school_class_id` is required at child enrollment via `EnrollChildModal`'s `ClassPicker`, which reads `fetchSchoolClasses`). Deleting `AddClassModal` would have left no UI path to assign a class to a school. Caught by the user during review; fixed same session — not something the plan should have specified, flagging it here since it deviates from the written F-M6-6 plan/M6.md file-deletion list.

## Blockers
- None
