# Feature Plan: F-M6-8 — Frontend Slots tab

## Overview

Three changes to the Slots tab, all downstream of F-M6-5's write *and* read contracts: (1) Add/Edit Slot-Class modal drops the subject picker (currently a button-list picker driven by `fetchSubjects()`, `AddSlotClassModal.tsx:866`) for a static "Subject: Foundation" label; (2) the current two hardcoded `volunteer_1_id`/`volunteer_2_id` button-pickers (`AddSlotClassModal.tsx:899-940`, including the "differs from Volunteer 1" Zod refinement at line 68) are replaced by one `VolunteerMultiSelect` (1-5, unique enforced by the multi-select itself rather than a two-field refinement); (3) schedule grid cells drop the subject pill and show the bucket's display name instead. F-M6-5's plan was extended (after this feature surfaced two gaps during planning) to add `section_display_name` to `SlotClassReadSchema` and to normalize legacy "Foundation Day 1"/"Foundation Day 2" subject names to "Foundation" server-side — so this feature's frontend work can render both fields directly with no client-side fallback logic.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend | None | Consumes F-M6-5's write contract; read contract already correct |
| Frontend components | Modified | `AddSlotClassModal.tsx`, `SlotDetail.tsx` (edit path), `ScheduleView.tsx`, `SlotGridView.tsx` |
| Frontend components | New | `VolunteerMultiSelect.tsx` |
| API service | Modified | `slot_classes.service.ts` — `CreateSlotClassInput`/`UpdateSlotClassInput` drop `subject_id`/`volunteer_1_id`/`volunteer_2_id`, add `volunteer_ids: number[]`; `SlotClassItem.sectionName` needs a `sectionDisplayName` companion (bucket display name, sourced from F-M6-2's `BucketOut.section_display_name` via whatever `SlotClassReadSchema` update carries it through — see Open Questions) |
| Frontend schemas | Modified | Zod: drop `subject_id`/`volunteer_1_id`/`volunteer_2_id` + the two-field refinement; add `volunteer_ids: number[]` with min/max/unique refinement |
| Existing tests | Break | Any test asserting `volunteer_1_id`/`volunteer_2_id` fields or the subject picker |
| Documentation | Update needed | `docs/milestones/M6.md` F-M6-8 status → Built once merged |

## High-Level Design (HLD)

- **Data flow:** Bucket dropdown (unchanged mechanism, now sourced from `fetchBuckets` instead of `fetchSections`/class-scoped sections) + static "Subject: Foundation" text (no fetch, no state) + `VolunteerMultiSelect` bound to `volunteer_ids: number[]` in form state. Submit sends `{class_section_id, volunteer_ids}` — no `subject_id` field exists in the payload at all, matching F-M6-5's schema which rejects it as an unknown field would simply be ignored by Pydantic unless `extra="forbid"` is set (verify this doesn't silently accept a stray `subject_id` — not a functional bug either way since the server ignores it, but cleaner to not send it).
- **Key architectural decision:** `VolunteerMultiSelect` replaces the two independent button-list pickers (`volunteer_1_id`, `volunteer_2_id`, each rendered as its own labeled button-grid in the current 990-line file) with a single component managing one array — this collapses two nearly-identical blocks of markup (lines ~890-940 today) into one reusable piece used in both Add and Edit.
- **Integration points:** The live-count/R-bucket-banner UX (`"N of 5 selected. Bucket has M children — max M volunteers."`) is new client-side derived state (`selectedBucket.activeChildrenCount` from `BucketItem`, already available via F-M6-6's `buckets.service.ts`) — purely a UX hint computed from data already fetched, not a re-implementation of the R-bucket business rule itself (submit is still allowed to fail server-side; the banner just disables the submit button proactively for a faster feedback loop, consistent with the frontend's "input shape validation is fine, business rules aren't reimplemented" carve-out — here it's arguably closer to a business rule than plain shape validation, but it mirrors the existing project pattern of the R1 max-5 disable-hint already used in `ManageBucketChildrenDrawer`/`StructureTab`, so it's consistent with prior practice even though it's a judgment call, not a hard rule from `BUSINESS_RULES.md`).

## Low-Level Design (LLD)

### Backend

None — this feature only consumes F-M6-5's contract.

## Low-Level Design — Frontend

**`slot_classes.service.ts` changes:**

```typescript
export interface CreateSlotClassInput {
  class_section_id: number;
  volunteer_ids: number[];
}

export interface UpdateSlotClassInput {
  class_section_id?: number;
  volunteer_ids?: number[];
}

export interface SlotClassItem {
  slotClassSectionId: number;
  classSectionId: number;
  sectionName: string;
  sectionDisplayName: string | null;  // NEW
  subjectName: string;                // stays — still "Foundation" from the server, just no longer user-editable
  volunteers: VolunteerInSlotClass[]; // unchanged shape
  activeChildrenCount: number;
}
```

`fetchSubjects()` is removed from this file if nothing else calls it (grep confirms `AddSlotClassModal.tsx` is its only current caller) — otherwise leave it in place unused-but-harmless rather than guessing at other callers.

**New file `VolunteerMultiSelect.tsx`:**

```typescript
interface VolunteerMultiSelectProps {
  schoolId: number;
  value: number[];
  onChange: (ids: number[]) => void;
  maxSelectable: number;  // min(bucket.activeChildrenCount, 5), computed by the caller
  disabled?: boolean;
}
```

Fetches from the existing volunteers endpoint (`volunteers.service.ts`, already used elsewhere for this school), renders as an MUI `Autocomplete` with `multiple` — this is a cleaner fit than replicating the current button-grid pattern twice, since `Autocomplete` handles the "already selected" exclusion and the max-count disable natively via its `options` filtering, rather than hand-rolling two separate button lists like today's vol1/vol2 blocks do. Disables adding past `maxSelectable`. Shows an inline conflict indicator (tooltip or chip color) for a volunteer already assigned to another slot-class in this slot — this requires the volunteer list response to carry "already in this slot" info, or a client-side cross-check against the other slot-classes already fetched for this slot (`fetchSlotClasses(schoolId, slotId)`, already called by the parent `SlotDetail`/`ScheduleView` — reuse that data rather than a new fetch).

**`AddSlotClassModal.tsx` changes:**

- Remove the `subject_id` Zod field, the `fetchSubjects()` call, and the subject button-picker block (~lines 860-875 currently).
- Add a static `<Typography>Subject: Foundation</Typography>` in its place — no state, no fetch.
- Remove `volunteer_1_id`/`volunteer_2_id` fields and their refinement (lines 63-69); add:

```typescript
volunteer_ids: z.array(z.number().positive())
  .min(1, 'At least 1 volunteer required')
  .max(5, 'Maximum 5 volunteers')
  .refine((ids) => new Set(ids).size === ids.length, 'Volunteers must be unique'),
```

- Replace the two button-picker blocks (~lines 890-940) with one `<VolunteerMultiSelect>`.
- Add the live-count text and R-bucket banner, computed from `watch('volunteer_ids').length` vs. the selected bucket's `activeChildrenCount` (from the bucket list already fetched for the dropdown).
- `onSubmit`: payload becomes `{ class_section_id: values.class_section_id, volunteer_ids: values.volunteer_ids }`.
- Bucket dropdown now sources from `fetchBuckets(schoolId)` (F-M6-6) instead of whatever class-scoped section source it uses today — confirm at build time whether the current modal already uses `fetchSections`-style scoping or something schedule-specific; either way it becomes a flat "all buckets in this school" list matching every other M6 bucket dropdown.

**`SlotDetail.tsx` (edit path) changes:** Same schema/field changes as Add. Pre-population: `volunteer_ids` initialized from the fetched `SlotClassItem.volunteers.map(v => v.userId)` (already available today — this is a straightforward array-of-IDs derivation, not a new fetch). Subject renders `slotClass.subjectName` directly with no client-side normalization — F-M6-5's `_normalize_subject_display_name` server-side helper guarantees the API always returns "Foundation" for both new and legacy rows, so the frontend just displays the string it's given.

**`ScheduleView.tsx` / `SlotGridView.tsx` changes:** Cell content changes from `{subjectPill} {sectionName}` (or whatever the current rendering is — verify exact JSX at build time in this 320+/737-line file) to bucket display name (bold) + volunteer first names (caption), using `SlotClassItem.sectionDisplayName ?? SlotClassItem.sectionName` and `volunteers.map(v => v.userDisplayName.split(' ')[0])`. Remove the subject pill rendering; do not delete a shared `SubjectPill` component file unless grep confirms zero other references.

## Business Rules Enforced

- **R2/R3 (display-only):** 1-5 unique volunteers enforced client-side as UX (Zod `min`/`max`/`refine`), server-authoritative via F-M6-5.
- **R-bucket (display-only):** Live count + banner is a UX hint derived from already-fetched bucket data, not a re-derivation of server logic — if the bucket's child count changes between fetch and submit (another user edits concurrently), the server's 400 is still the authoritative rejection and its message is shown verbatim.

## Security Review

- **Auth:** No change — uses existing `slot_classes.service.ts` functions through the shared Axios client.
- **RBAC display:** No new role gating in this feature beyond what `AddSlotClassModal`/`SlotDetail` already have.
- **Input validation:** `volunteer_ids` are numeric IDs selected from a fetched, school-scoped volunteer list (via `VolunteerMultiSelect`) — no free-text entry.
- **Data exposure:** No new data surfaced — `sectionDisplayName` is already returned by the bucket/section endpoints for other features; this feature just renders it in a new place (the schedule grid).

## Testing Strategy

- **Frontend component tests:**
  - `AddSlotClassModal.test.tsx`: no subject dropdown rendered; static "Subject: Foundation" text present; `VolunteerMultiSelect` renders and accepts 1-5 selections; selecting more than `bucket.activeChildrenCount` shows the R-bucket banner and disables submit; Zod errors for empty/6+/duplicate `volunteer_ids`; valid submit calls `createSlotClass` with `{class_section_id, volunteer_ids}` and no `subject_id`/`volunteer_1_id`/`volunteer_2_id` keys at all
  - `SlotDetail.test.tsx`: edit modal pre-populates all volunteers from `volunteers[]`; renders whatever `subjectName` the API returns as-is (the "always Foundation for legacy rows" guarantee is F-M6-5's server-side test responsibility, not re-tested here); server 409 (R6 conflict) shown inline
  - `ScheduleView.test.tsx` / `SlotGridView.test.tsx`: cell renders bucket display name, not subject; cell renders volunteer first names
- **Manual verification:** `npm run dev`, create a slot-class with 4 volunteers in a bucket with 4 children (boundary), then try adding a 5th and confirm the banner blocks submit; open an existing legacy slot-class (if any exist in dev data with "Foundation Day 1"/"Foundation Day 2") and confirm it displays "Foundation"

## Milestones (implementation order)

1. **Chunk 1 — slot_classes.service.ts contract update:** new types. Verify against a real F-M6-5 backend response, and specifically confirm whether `subject_name` normalization for legacy rows happens server-side or needs a frontend fallback (see Open Questions) before building the display logic that depends on the answer.
2. **Chunk 2 — VolunteerMultiSelect:** new component, built and tested in isolation against the existing volunteers endpoint.
3. **Chunk 3 — AddSlotClassModal:** schema, static subject label, multi-select integration, live count + banner.
4. **Chunk 4 — SlotDetail (edit path):** same changes, pre-populate from `volunteers[]`.
5. **Chunk 5 — ScheduleView / SlotGridView:** cell rendering change.

## Open Questions

None. Both gaps found while planning this feature (legacy subject-name normalization, missing `section_display_name` on the read schema) were resolved by extending F-M6-5's plan directly rather than deferred here — see F-M6-5-plan.md's updated LLD (`_normalize_subject_display_name` helper, `SlotClassReadSchema.section_display_name`). This feature can be built purely against that contract with no server-side fallback logic of its own.
