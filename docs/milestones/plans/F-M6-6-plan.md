# Feature Plan: F-M6-6 — Frontend Buckets tab

## Overview

Replace the "Structure" tab (`StructureTab.tsx` — class → expandable section-grid, `AddClassModal`/`AddSectionModal`) with a "Buckets" tab: a flat list of `BucketCard`s (display name + child-count badge + menu), backed entirely by F-M6-2/F-M6-3's new endpoints. No class hierarchy, no class dropdown anywhere in the new UI — buckets are class-agnostic per M6 decision #1, built correctly from the start since nothing here exists yet. `structure.service.ts` (classes/sections API) is left in place, untouched — it's still consumed by the current `ChildrenTab` until F-M6-7 migrates that tab off it.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend | None | Consumes F-M6-2/F-M6-3 endpoints, already planned separately |
| Frontend pages | Modified | `SchoolDetailPage.tsx` — tab label "Structure" → "Buckets", component swap |
| Frontend components | New | `BucketsTab.tsx`, `BucketCard.tsx`, `AddBucketModal.tsx`, `EditBucketModal.tsx`, `ManageBucketChildrenDrawer.tsx` (all in `components/schools/structure/`) |
| Frontend components | Deleted | `StructureTab.tsx`, `AddClassModal.tsx`, `AddSectionModal.tsx` — the only 3 files currently in `components/schools/structure/` |
| API service | New | `lib/api/services/buckets.service.ts` |
| API service | Unchanged | `structure.service.ts` stays — still used by `ChildrenTab` until F-M6-7 |
| State management | Local only | No Redux slice — `StructureTab`'s existing pattern (local `useState` + `useEffect` fetch) is the precedent, reused as-is |
| Form validation | New | Zod schema for `display_name` (required, non-empty, max 255) in Add/Edit Bucket modals |
| Existing tests | Break | `SchoolDetailPage.test.tsx` currently asserts the "Structure" tab label |
| Documentation | Update needed | `docs/milestones/M6.md` F-M6-6 status → Built once merged |

## High-Level Design (HLD)

- **Data flow:** `BucketsTab` fetches `GET /schools/{id}/sections/` (F-M6-2) on mount, renders a flat grid of `BucketCard`s (no expand/collapse — unlike `StructureTab`'s class→section nesting, there's only one level now). Add/Edit open a modal with a single `display_name` field; on success, the modal's `onAdded`/`onEdited` callback updates local state (same pattern as `StructureTab`'s `onAdded`/`AddClassModal` callback). The three-dot menu on each card opens `ManageBucketChildrenDrawer` (add/remove children) and a delete confirmation (reusing the existing `DELETE /sections/{id}/` endpoint, unchanged from M2).
- **Key architectural decision:** No class dropdown, no "Mixed"/class-label anywhere in this feature's components — this is the M6 pivot's core visual change, built directly rather than added-then-removed. `BucketCard` never reads or displays `school_class_id` even though `BucketOut` includes it (F-M6-2's response schema keeps the field for legacy-row backward compatibility only).
- **Integration points:** `StructureTab`'s `capacityColor`/`MAX_CAPACITY` pattern (lines 32-48 of the current file) is reused verbatim for `BucketCard`'s child-count badge — same 5-cap visual language, just without the nested nested-under-class layout.

## Low-Level Design (LLD)

### Backend

None — this feature only consumes F-M6-2/F-M6-3 endpoints already specified in their own plans.

### Frontend

**New file** `lib/api/services/buckets.service.ts` (mirrors `structure.service.ts`'s raw/mapped-type + mapper pattern exactly):

```typescript
import { api } from '../client';

export interface BucketItem {
  classSectionId: number;
  sectionName: string;
  sectionDisplayName: string | null;
  activeChildrenCount: number;
}

interface RawBucket {
  class_section_id: number;
  section_name: string;
  section_display_name: string | null;
  school_id: number;
  school_class_id: number | null;  // present in response, intentionally never read by any component
  active_children_count: number;
  is_active: boolean;
}

function mapBucket(raw: RawBucket): BucketItem {
  return {
    classSectionId: raw.class_section_id,
    sectionName: raw.section_name,
    sectionDisplayName: raw.section_display_name,
    activeChildrenCount: raw.active_children_count,
  };
}

export async function fetchBuckets(schoolId: number): Promise<BucketItem[]> {
  const raw = await api.get<RawBucket[]>(`/schools/${schoolId}/sections/`);
  return raw.map(mapBucket);
}

export async function createBucket(schoolId: number, displayName: string): Promise<BucketItem> {
  const raw = await api.post<RawBucket>(`/schools/${schoolId}/sections/`, { display_name: displayName });
  return mapBucket(raw);
}

export async function editBucket(schoolId: number, classSectionId: number, displayName: string): Promise<BucketItem> {
  const raw = await api.patch<RawBucket>(`/schools/${schoolId}/sections/${classSectionId}/`, { display_name: displayName });
  return mapBucket(raw);
}

export async function removeBucket(schoolId: number, classSectionId: number): Promise<void> {
  await api.delete(`/schools/${schoolId}/sections/${classSectionId}/`);
}

// F-M6-3 endpoints
export async function addChildToBucket(schoolId: number, classSectionId: number, childId: number): Promise<void> {
  await api.post(`/schools/${schoolId}/sections/${classSectionId}/children/`, { child_id: childId });
}

export async function removeChildFromBucket(schoolId: number, classSectionId: number, childId: number): Promise<void> {
  await api.delete(`/schools/${schoolId}/sections/${classSectionId}/children/${childId}/`);
}
```

**`BucketsTab.tsx`** — structurally the outer half of `StructureTab.tsx` (header + `useEffect` fetch + loading/error/empty states, lines 451-560) minus the class-nesting layer:

```typescript
export function BucketsTab({ schoolId, canModify = true }: { schoolId: number; canModify?: boolean }) {
  const [buckets, setBuckets] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBuckets(schoolId)
      .then((data) => { if (!cancelled) { setBuckets(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError('Failed to load buckets.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [schoolId]);

  // header (title "Buckets", "+ Add Bucket" button) + loading/error/empty states
  // (same visual pattern as StructureTab's equivalent block, no activeYear line — buckets aren't year-scoped)

  return (
    // ...
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
      {buckets.map((b) => (
        <BucketCard key={b.classSectionId} bucket={b} schoolId={schoolId} canModify={canModify}
          onUpdated={(updated) => setBuckets((prev) => prev.map((x) => x.classSectionId === updated.classSectionId ? updated : x))}
          onRemoved={(id) => setBuckets((prev) => prev.filter((x) => x.classSectionId !== id))}
        />
      ))}
    </Box>
    // ...
  );
}
```

**`BucketCard.tsx`** — display name (large), child-count badge reusing `capacityColor`/`MAX_CAPACITY` from the existing pattern, three-dot menu with "Manage Children", "Edit", "Delete". No class chip, no "Mixed" label — this is the explicit contrast with `SectionCard`'s current `sectionCode` badge (which this component deliberately does not have an equivalent of).

**`AddBucketModal.tsx` / `EditBucketModal.tsx`** — single-field forms (React Hook Form + Zod, per frontend CLAUDE.md convention), `display_name` only:

```typescript
const bucketSchema = z.object({
  display_name: z.string().trim().min(1, 'Bucket name is required').max(255, 'Name is too long'),
});
```

No class dropdown field exists in either schema or form — there is nothing to "not include," since this is new code with no prior version to diverge from.

**`ManageBucketChildrenDrawer.tsx`** — school-wide child picker (search across `fetchChildren(schoolId, { status: 'active' })` from `children.service.ts`, filtering out children already in a bucket — F-M6-4's `list_children` doesn't need to expose this filter specially, client-side filter on `currentSection == null` OR just let the user pick any child and rely on the backend's R-bucket-membership 409 for children already elsewhere, showing the error inline) + current roster with a remove button per child. Disables "Add" once `activeChildrenCount >= 5` (client-side UX hint only — R1 is still server-enforced per the frontend's non-negotiable rule against reimplementing business logic).

**`SchoolDetailPage.tsx`:** tab label `"Structure"` → `"Buckets"`; import swap `StructureTab` → `BucketsTab`.

**Files to delete** once `BucketsTab` replaces it end-to-end: `StructureTab.tsx`, `AddClassModal.tsx`, `AddSectionModal.tsx`.

## Business Rules Enforced

- **R1 (display-only):** Add-to-bucket UI disables past 5 children as a UX hint; the actual 5-cap enforcement is server-side (F-M6-3), matching the frontend's non-negotiable rule against reimplementing business rules client-side.
- **R-section-slug, R-bucket-membership, R-bucket (display-only):** All server-authoritative. Frontend displays the API's error message verbatim rather than re-deriving or predicting these conditions client-side.
- Zod validation on `display_name` is input-shape validation (required, length), explicitly allowed under the frontend's "Exception: input shape validation... via Zod schemas is fine" rule — not a business rule.

## Security Review

- **Auth:** No new auth pattern — uses the shared Axios instance (`lib/api/client.ts`) which already attaches the JWT and handles refresh, per frontend CLAUDE.md rule 4 (no fetch calls outside `lib/api/`).
- **RBAC display:** `canModify` prop (already threaded through `StructureTab` today) gates whether Add/Edit/Delete/Manage-Children controls render — mirrors the existing pattern exactly. Backend remains the actual enforcement point (`get_school_or_403` in F-M6-2/F-M6-3), per frontend CLAUDE.md rule 7.
- **Input validation:** `display_name` is free text rendered via React/MUI's default JSX escaping — no `dangerouslySetInnerHTML` anywhere in this feature, so no XSS surface from bucket names.
- **Data exposure:** No new data exposed beyond what `BucketOut`/`ChildItem` already return; `ManageBucketChildrenDrawer`'s school-wide child picker is scoped to the current `schoolId` exactly like `EnrollChildModal`'s existing patterns.

## Testing Strategy

- **Frontend component tests** (Vitest/Jest per existing convention):
  - `BucketsTab.test.tsx`: renders flat grid, empty state when zero buckets, "Buckets" tab label (not "Structure"), loading/error states
  - `BucketCard.test.tsx`: renders display name + count badge; no class label rendered anywhere in the DOM (explicit `queryByText`/`queryByTestId` assertion that no class chip exists — this guards against the exact drift the earlier (lost) build reportedly had)
  - `AddBucketModal.test.tsx`: empty submit shows Zod error, no API call; valid submit calls `createBucket` with `display_name`; server 409 (slug collision) displays verbatim; no class dropdown present in the rendered form (explicit negative assertion)
  - `EditBucketModal.test.tsx`: same shape as Add, pre-populated with current display name
  - `ManageBucketChildrenDrawer.test.tsx`: add/remove wired to `buckets.service.ts` F-M6-3 functions; "Add" disabled at 5 children; server 409 (already-in-another-bucket) displayed inline
  - `SchoolDetailPage.test.tsx`: tab label updated to "Buckets"
- **Manual verification:** `npm run dev`, click through create → rename → add children → remove child → delete bucket, confirm every state transition and error path renders correctly; specifically verify no class-related UI appears anywhere in this tab

## Milestones (implementation order)

1. **Chunk 1 — buckets.service.ts + BucketsTab + BucketCard (read-only):** list buckets, render cards. Deployable as a read-only "Buckets" tab even before Add/Edit/Manage-Children exist.
2. **Chunk 2 — AddBucketModal + EditBucketModal:** create/rename flow, Zod validation, server-error display.
3. **Chunk 3 — ManageBucketChildrenDrawer:** add/remove children, wired to F-M6-3.
4. **Chunk 4 — cleanup + SchoolDetailPage swap:** delete `StructureTab`/`AddClassModal`/`AddSectionModal`, update tab label, update `SchoolDetailPage.test.tsx`.

Each chunk leaves the app in a working state; chunk 4 (the actual cutover) is the only one that removes the old tab, so it should land last and only once chunks 1-3 are confirmed working against a real backend.

## Open Questions

None. `docs/milestones/M6.md` decision #1 and the F-M6-6 section fully specify the class-agnostic requirement, and reading the actual `StructureTab.tsx` confirmed exactly which visual patterns (capacity color, card layout, modal callback shape) to reuse vs. drop.
