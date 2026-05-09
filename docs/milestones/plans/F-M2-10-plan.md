# Feature Plan: F-M2-10 — Children List Filters

## Overview

Add filtering capabilities to the Children tab. Four filters: status toggle (Active/Inactive/All), class dropdown, section dropdown (cascades from class), and debounced search input. Status defaults to "Active". Filters can be combined. Backend `GET /api/schools/{school_id}/children/` already accepts the query params (built in F-M2-6); this feature wires up the frontend filter bar and completes the backend query logic.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | No model changes |
| Backend services | Modified | `services/children/queries.py` — complete filter logic |
| Backend API endpoints | None new | Query params already defined in F-M2-6 |
| Backend schemas | None | Params handled inline in endpoint |
| Backend migrations | No | — |
| Frontend components | Modified | `ChildrenTab.tsx` — add filter bar; `ChildrenTab` was stubbed in F-M2-6 |
| Frontend services | None new | Existing `listChildren` call gains query params |
| Celery tasks | No | — |
| Existing tests | None broken | — |
| Documentation | None | — |

## High-Level Design

### Data flow — CO filters children list

```
CO opens Children tab (status=active by default)
  → GET /api/schools/{schoolId}/children/?status=active
  → Table shows active children

CO clicks "Inactive" pill
  → GET /api/schools/{schoolId}/children/?status=inactive
  → Table shows deactivated children (greyed-out background)

CO selects class from dropdown
  → GET /api/schools/{schoolId}/children/?status=active&class_id=5
  → Table narrows to children currently in that class

CO types in search box (debounced 300ms)
  → GET /api/schools/{schoolId}/children/?status=active&search=ali
  → Table narrows by first_name or last_name substring
```

### Key architectural decisions

- **Status filter logic**: "active" → `is_active=True, removed=False`; "inactive" → `is_active=False, removed=True`; "all" → no filter on these flags.
- **Section/class filter**: joins to `ChildClassSection` and `ChildClass` via `Subquery` to find the *current* active assignment. Filtering by `section_id` means "child's current active section is X".
- **Debounce at 300ms** in frontend — no backend throttling needed.
- **Frontend state**: all filter state is local to `ChildrenTab`; no Redux slices. Each filter change triggers a new API call.
- **Section dropdown cascades** from class: if class is selected, section dropdown loads sections for that class. If class is deselected, section dropdown resets.

## Low-Level Design

### Backend

#### Service (`services/children/queries.py` — complete implementation)

The `list_children` function was stubbed in F-M2-6. This feature completes it:

```python
def list_children(
    school_id: int,
    *,
    section_id: int | None = None,
    class_id: int | None = None,
    status: str = "active",
    search: str | None = None,
) -> QuerySet:
    qs = Child.objects.filter(school_id=school_id)

    # Status filter
    if status == "active":
        qs = qs.filter(is_active=True, removed=False)
    elif status == "inactive":
        qs = qs.filter(is_active=False, removed=False)
    # status == "all" → no filter

    # Annotate current section/class via subquery
    qs = qs.annotate(
        current_section_id=Subquery(
            ChildClassSection.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("class_section_id")[:1]
        ),
        current_class_section_name=Subquery(
            ChildClassSection.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("class_section_id__section_name")[:1]
        ),
        current_school_class_id=Subquery(
            ChildClass.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("school_class_id")[:1]
        ),
        current_class_name=Subquery(
            ChildClass.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("school_class_id__class_id__class_name")[:1]
        ),
    )

    # Apply filters based on annotations
    if section_id:
        qs = qs.filter(current_section_id=section_id)
    if class_id:
        qs = qs.filter(current_school_class_id=class_id)
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search)
        )

    return qs.order_by("first_name", "last_name")
```

Note: for inactive children (`status=inactive`), `current_section_id` / `current_school_class_id` will be `None` because those rows are also soft-deleted. Section and class filters naturally return empty when combined with `status=inactive` unless a child was re-enrolled after deactivation (edge case, handled correctly by the subquery logic).

#### API endpoint (existing in `api/children_api.py` — verify params are wired)

```python
@children_router.get("/{school_id}/children/", response=list[ChildOut])
def list_children_view(
    request,
    school_id: int,
    section_id: int = None,
    class_id: int = None,
    status: str = "active",
    search: str = None,
):
    get_school_or_403(request.auth, school_id)
    return list_children(
        school_id,
        section_id=section_id,
        class_id=class_id,
        status=status,
        search=search,
    )
```

### Frontend

#### `components/schools/children/ChildrenTab.tsx` — update filter bar

```tsx
// State additions:
const [status, setStatus] = useState<"active" | "inactive" | "all">("active")
const [classId, setClassId] = useState<number | null>(null)
const [sectionId, setSectionId] = useState<number | null>(null)
const [search, setSearch] = useState("")
const debouncedSearch = useDebounce(search, 300)

// Effect: re-fetch when any filter changes
useEffect(() => {
  fetchChildren({ status, class_id: classId, section_id: sectionId, search: debouncedSearch })
}, [status, classId, sectionId, debouncedSearch])

// Filter bar render:
// <StatusPills value={status} onChange={setStatus} />
// <ClassDropdown schoolId={schoolId} value={classId} onChange={(v) => { setClassId(v); setSectionId(null) }} />
// <SectionDropdown schoolId={schoolId} schoolClassId={classId} value={sectionId} onChange={setSectionId} disabled={!classId} />
// <SearchInput value={search} onChange={setSearch} placeholder="Search children..." />

// Table row styling:
// Inactive children: className="bg-gray-50 text-gray-400" (greyed-out)
```

#### `useDebounce` hook (utility, create if not already present)

```typescript
// lib/hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debounced
}
```

#### API call update (`lib/api/services/children.service.ts`)

```typescript
interface ChildrenListParams {
  status?: "active" | "inactive" | "all"
  class_id?: number
  section_id?: number
  search?: string
}

export const listChildren = (schoolId: number, params: ChildrenListParams = {}) => {
  const searchParams = new URLSearchParams()
  if (params.status)     searchParams.set("status", params.status)
  if (params.class_id)   searchParams.set("class_id", String(params.class_id))
  if (params.section_id) searchParams.set("section_id", String(params.section_id))
  if (params.search)     searchParams.set("search", params.search)
  const query = searchParams.toString()
  return apiClient.get(
    `/api/schools/${schoolId}/children/${query ? `?${query}` : ""}`
  )
}
```

## Business Rules Enforced

| Rule | Enforcement |
|------|------------|
| Status "active" default | Backend default param `status="active"`; frontend initial state `"active"` |
| Section/class filter uses current assignment | `Subquery` on active `ChildClassSection` / `ChildClass` rows |
| CO cannot filter another school's children | `get_school_or_403` on GET endpoint |

## Security Review

- All filter params are SQL-safe: `class_id` and `section_id` are integer-typed in Django Ninja (auto-validated); `search` uses ORM `icontains` (parameterized, no raw SQL injection risk); `status` is matched against a string in Python before hitting the ORM
- `get_school_or_403` on GET endpoint — CO cannot fetch another school's children regardless of filter params

## Testing Strategy

**Backend (`test_f_m2_7_10_children.py` — filter portion):**
- `test_list_children_default_status_active` — returns only `is_active=True, removed=False`
- `test_list_children_status_inactive` — returns only `is_active=False, removed=True`
- `test_list_children_status_all` — returns both active and inactive
- `test_list_children_filter_by_section_uses_current_assignment` — child moved to new section; filtered by new section only
- `test_list_children_filter_by_class` — returns children in specified class
- `test_list_children_search_first_name` — case-insensitive substring match on first_name
- `test_list_children_search_last_name` — case-insensitive substring match on last_name
- `test_list_children_filters_combine` — e.g., status=active + search returns intersection

**Manual verification:**
- [ ] Tab opens with "Active" pill selected; active children shown
- [ ] Click "Inactive" → active children hidden; deactivated shown with greyed-out background
- [ ] Click "All" → both active and inactive children shown
- [ ] Select a class → list narrows to that class's children
- [ ] Select class, then section → list narrows further
- [ ] Deselect class → section dropdown resets and hides
- [ ] Type partial first name → results update after 300ms debounce
- [ ] Type partial last name → results update
- [ ] Type + select class → results are intersection
- [ ] Clear search → results expand back
- [ ] CO accesses another school's children endpoint (via curl) → 403

## Implementation Order

**Chunk 1 — Backend query logic**
- Complete `list_children` function in `services/children/queries.py` with full annotation + filter logic
- Smoke test all filter combinations via Swagger

**Chunk 2 — Frontend filter bar**
- Add `useDebounce` hook if not present
- Extend `ChildrenTab.tsx` with filter state and filter bar components
- Update `listChildren` in `children.service.ts` to accept params
- Wire `StatusPills`, `ClassDropdown`, `SectionDropdown`, `SearchInput` sub-components

## Open Questions

None. All resolved:
- Section filter applies to current assignment (history tables filtered by `is_active=True, removed=False`)
- Inactive children shown with greyed-out styling — `status=inactive`
- Search debounced 300ms on frontend, no backend throttling
- Section dropdown disabled (not hidden) when no class selected
