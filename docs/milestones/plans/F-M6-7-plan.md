# Feature Plan: F-M6-7 — Frontend Children tab

## Overview

Make bucket optional and class mandatory on Add/Edit Child, and add a Bucket column + filter to the Children list. This requires undoing a specific piece of existing behavior: today's `EnrollChildModal.tsx` treats class as a **filter that cascades into the section dropdown** — picking a class fetches `fetchSections(schoolId, selectedClassId)` and the section chosen is the only thing actually sent in the payload (`class_section_id` — confirmed by reading the current submit handler; `school_class_id` is selected in the form but never included in the API call). M6 breaks that cascade: class and bucket become two independent, parallel selections, both required to reach the API in different ways (class always sent, bucket sent only if chosen), and the bucket dropdown pulls from `fetchBuckets(schoolId)` (all buckets in the school) rather than sections scoped to a class.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend | None | Consumes F-M6-4's `ChildEnrollIn`/`ChildEditIn`/`ChildOut`/`list_children` contract, already planned separately |
| Frontend components | Modified | `EnrollChildModal.tsx`, `EditChildDrawer.tsx`, `ChildrenTab.tsx` |
| API service | Modified | `children.service.ts` — `EnrollChildInput`/`EditChildInput` gain `school_class_id`, drop the class→section cascade dependency; `ChildItem` gains `currentSection`/`currentSchoolClass` nested objects; `ListChildrenParams` gains `unassigned` |
| Frontend schemas | Modified | Zod: `school_class_id` becomes the always-required field, `class_section_id` becomes optional |
| Existing tests | Break | `ChildrenTab.test.tsx`, `EnrollChildModal.test.tsx` (any test asserting the class→section cascade or the flat `currentSectionName` field) |
| Documentation | Update needed | `docs/milestones/M6.md` F-M6-7 status → Built once merged |

## High-Level Design (HLD)

- **Data flow (enroll):** Component mounts → fetch classes (`fetchSchoolClasses`, unchanged call) and buckets (`fetchBuckets`, new, from F-M6-6's service) **independently and in parallel** — no more `useEffect` keyed on `selectedClassId` to fetch sections. User picks a class (required) and, separately, optionally picks a bucket. Submit payload always includes `school_class_id`; includes `class_section_id` only if a bucket was chosen.
- **Data flow (edit):** Drawer pre-populates both dropdowns independently from `ChildItem.currentSchoolClass`/`currentSection` (F-M6-4's new nested shape) rather than the current flat `currentClassId`/`currentSectionId`. Saving sends whichever of `school_class_id`/`class_section_id` changed — clearing the bucket dropdown sends `class_section_id: null` explicitly (not omitted), since the backend needs to distinguish "no change" (field absent) from "unassign" (field `null`) — confirms this against F-M6-4's schema, where `ChildEditIn.class_section_id: int | None = None` already defaults to `None`/absent meaning no-op; sending an explicit `null` requires the API client to not silently drop null-valued keys (verify `lib/api/client.ts`'s serialization doesn't strip nulls before this chunk starts, since that's a shared-client concern, not this feature's file).
- **Key architectural decision:** No client-side re-derivation of "which sections belong to which class" — that relationship no longer exists for buckets (they're class-agnostic by design), so the two dropdowns are structurally independent components with no shared state, unlike today's cascade.

## Low-Level Design (LLD)

### Backend

None — this feature only consumes the F-M6-4 contract.

### Frontend

**`children.service.ts` changes:**

```typescript
export interface EnrollChildInput {
  first_name: string;
  last_name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  school_class_id: number;          // NEW — always sent now
  class_section_id?: number | null; // CHANGED — optional
  date_of_birth?: string;
  city?: string;
  mother_tongue?: string;
  date_of_enrollment?: string;
  mad_joining_date?: string;
}

export interface EditChildInput {
  // ...existing optional demographic fields...
  school_class_id?: number;
  class_section_id?: number | null;
}

export interface ChildItem {
  childId: number;
  // ...existing fields...
  currentSection: { classSectionId: number; sectionDisplayName: string | null; sectionName: string } | null;
  currentSchoolClass: { schoolClassId: number; className: string } | null;
  // currentClassName/currentSectionName/currentSectionId/currentClassId REMOVED —
  // confirm via grep that nothing outside ChildrenTab/EditChildDrawer/EnrollChildModal
  // reads these flat fields before deleting them
}

interface RawChild {
  // ...existing...
  current_section: { class_section_id: number; section_display_name: string | null; section_name: string } | null;
  current_school_class: { school_class_id: number; class_name: string } | null;
}

function mapChild(raw: RawChild): ChildItem {
  return {
    // ...existing mapped fields...
    currentSection: raw.current_section && {
      classSectionId: raw.current_section.class_section_id,
      sectionDisplayName: raw.current_section.section_display_name,
      sectionName: raw.current_section.section_name,
    },
    currentSchoolClass: raw.current_school_class && {
      schoolClassId: raw.current_school_class.school_class_id,
      className: raw.current_school_class.class_name,
    },
  };
}

export interface ListChildrenParams {
  status?: 'active' | 'inactive' | 'all';
  class_id?: number;
  section_id?: number;
  unassigned?: boolean;  // NEW
  search?: string;
}
```

**`EnrollChildModal.tsx` changes:**

- Zod schema: `school_class_id: z.number().min(1, 'Select a class')` stays required (already present in the current schema, just now actually used in the payload); `class_section_id: z.number().min(1, 'Select a section')` → `class_section_id: z.number().nullable().optional()`.
- Remove the `useEffect` at the current file's lines 386-398 that fetches sections keyed on `selectedClassId` and calls `setValue('class_section_id', undefined)` on class change — this cascade no longer applies.
- Add an independent `useEffect` (mirrors the existing class-fetch effect at lines ~380-384) that calls `fetchBuckets(schoolId)` once on modal open, unconditional on class selection.
- Bucket `<Select>`/`<Autocomplete>` becomes optional — add a "None" / placeholder option, since a child can enroll unassigned (M6 decision #9).
- `onSubmit`: add `school_class_id: values.school_class_id` to the payload (currently selected but not sent); only include `class_section_id` in the payload if truthy.

**`EditChildDrawer.tsx` changes:** Same schema shift as Enroll. Pre-population reads `child.currentSchoolClass?.schoolClassId` / `child.currentSection?.classSectionId` (new nested shape) instead of today's flat `currentClassId`/`currentSectionId`. On save, diff against the original values: include `school_class_id` in the payload only if changed; include `class_section_id` (possibly `null`) only if the bucket selection changed.

**`ChildrenTab.tsx` changes:**

- Add a "Bucket" column between existing columns, rendering `child.currentSection?.sectionDisplayName ?? child.currentSection?.sectionName` when present, or an "Unassigned" chip (styled consistently with existing status chips in this file) when `currentSection` is `null`.
- Add a bucket filter dropdown: options are `["All", "Unassigned", ...buckets from fetchBuckets(schoolId)]`. Selecting "Unassigned" calls `fetchChildren(schoolId, { ...otherParams, unassigned: true })`; selecting a specific bucket calls it with `section_id: bucket.classSectionId`; "All" omits both.
- Existing class filter (if the current `ChildrenTab` has one — verify at build time; the M2/M3 filter set per `docs/milestones/M2.md`'s F-M2-10 was class/section/status/search) stays independent of the new bucket filter, exactly as class and bucket are independent everywhere else in this feature.

## Business Rules Enforced

- **R1 (display-only):** Bucket picker in Enroll/Edit doesn't hard-block past 5 — server-authoritative via F-M6-3/F-M6-4's capacity checks; frontend shows the 409 message verbatim on submit failure.
- No other business rule is re-implemented here — this feature is purely a shape/UX change following F-M6-4's contract.

## Security Review

- **Auth:** No change — uses existing `children.service.ts` functions routed through the shared Axios client.
- **RBAC display:** No new role-gated UI in this feature; existing `canModify`-style gating (if present in `ChildrenTab`/`EnrollChildModal` today) is preserved unchanged.
- **Input validation:** `school_class_id`/`class_section_id` are both numeric IDs selected from a fetched, scoped list (`fetchSchoolClasses(schoolId)`/`fetchBuckets(schoolId)`) — no free-text ID entry, so no injection surface. Server remains the authority on cross-school ID validation (F-M6-4's `NotFound`/`ValidationError` on mismatched school).
- **Data exposure:** `ChildItem`'s new nested fields expose the same information as the old flat fields, restructured — no new data surfaced to the client.

## Testing Strategy

- **Frontend component tests:**
  - `EnrollChildModal.test.tsx`: submit without class → Zod error, no API call; submit without bucket → API called with `class_section_id` omitted/absent; submit with bucket → `class_section_id` present in payload; class selection no longer triggers a bucket-list refetch (assert `fetchBuckets` called exactly once, on modal open, not on every class change) — this assertion is the regression guard for removing the cascade
  - `EditChildDrawer.test.tsx`: pre-populates class + bucket independently from `currentSchoolClass`/`currentSection`; clearing bucket sends `class_section_id: null`; changing class alone sends only `school_class_id`, no `class_section_id`
  - `ChildrenTab.test.tsx`: Bucket column renders display name or "Unassigned"; bucket filter dropdown calls `fetchChildren` with the right params for each of All/Unassigned/specific-bucket
- **Manual verification:** `npm run dev`, enroll a child with class only, confirm no error and the list shows "Unassigned" in the Bucket column; then edit that child to add a bucket; then filter the list by that bucket and by "Unassigned" and confirm correct results

## Milestones (implementation order)

1. **Chunk 1 — children.service.ts contract update:** new types, mapper, `unassigned` param. Verify against a real F-M6-4 backend response before touching any component (confirms the contract assumption is correct).
2. **Chunk 2 — EnrollChildModal:** remove cascade, add independent bucket fetch, schema change, payload change.
3. **Chunk 3 — EditChildDrawer:** same schema/pre-population changes for the edit path.
4. **Chunk 4 — ChildrenTab:** Bucket column + filter dropdown.

Each chunk is independently testable; chunk 1 is a pure contract/type change with no visual effect, safe to land first and verify against staging before the UI changes build on top of it.

## Open Questions

None remaining that block starting this feature — both items M6.md originally flagged ("does `ChildItem` include `current_section`?", "does `list_children` support `unassigned`?") are resolved by F-M6-4's plan explicitly committing to build both as part of that feature's scope, not as a follow-up discovered here.
