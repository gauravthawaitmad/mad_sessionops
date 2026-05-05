# School list page

Route: `/schools`
Audience: CO (default), CHO (read-only treatment per F02)
Source decision: **Emergent table + Bolt's detail richness** (per `ui-reference.md`)

The landing page after login. Shows the user's accessible schools as a scannable table with KPI summary above. Compact rows by default, with each row carrying enough detail (contact, status, key counts, freshness) that the CO can triage without drilling in. Drilling in is for editing/configuring, not for looking up basic facts.

This document is the spec. All visual tokens, component names, and patterns referenced here are defined in `ui-reference.md` — do not redefine them, import them.

---

## 1. Page structure

Top-to-bottom inside the main content area (max-width 1280px, padding per app shell):

1. **Page header** — title + welcome line + city context
2. **KPI strip** — 4 metric cards
3. **Toolbar** — search + filter chips + sort
4. **Schools table** — one row per school
5. **Empty state** — only when the user has zero schools (not zero results from a filter)

The left sidebar is the standard app-shell sidebar. On `/schools` the workspace tabs section is hidden (no school selected); only the schools list is visible in the sidebar. When the user clicks a row, navigate to `/schools/[schoolId]` and the workspace tabs section appears.

---

## 2. Page header

```
My schools                                         [Hi user block — handled by app bar]
Welcome back, {firstName}. You manage {N} schools across {M} cities · Academic year {AY}
```

- Title: `Display` typography (32/40/700)
- Subtitle: `Body` (14/20/400), color `neutral.500`
- `{N}` and `{M}` are bold (`neutral.700`, weight 600), inline
- `{AY}` format: `2024–25` (en-dash, not hyphen)

If the user manages 1 school: "You manage 1 school in {city}." (singular handling required)

The user/role/city context is rendered by the app bar, not duplicated here.

---

## 3. KPI strip

A 4-column grid of metric cards. Equal width, `gap: theme.spacing(1.5)` (12px).

| # | Label | Value | Source |
|---|-------|-------|--------|
| 1 | Total schools | count of schools user has access to | `schools.length` |
| 2 | Fully configured | `{configured} / {total}` (e.g. `3 / 6`) | derived: schools where `setupStatus === 'configured'` |
| 3 | Children enrolled | sum across all schools | sum of `school.childrenCount` |
| 4 | Active volunteers | sum of distinct volunteers across schools | sum of `school.activeVolunteersCount` |

**Card styling** (uses Card component but in a denser KPI variant):
- Background: `neutral.0` (white)
- Border: `1px solid neutral.200`
- Border radius: `radius.lg`
- Padding: `theme.spacing(2)` (16px)
- Label: `Caption` (12/16/400), color `neutral.500`, margin-bottom `theme.spacing(0.5)`
- Value: `Display` size but tighter — 28px / 32px line-height / 700, color `neutral.900`
- For "Fully configured": the `/ 6` portion is `neutral.500`, weight 400, 16px (de-emphasised denominator)

No icons in the KPI cards — keep them numeric and clean. Resist the urge to add trend arrows; we don't have historical data yet.

Loading: skeleton cards matching exact dimensions.

---

## 4. Toolbar

Single row, flex layout, gap `theme.spacing(1.5)`:

```
[Search input — flex grow]   [Filter chip group]   [Sort button]
```

### 4.1 Search input
- Placeholder: `Search schools, cities, or contacts…`
- Leading icon: `Search` from lucide-react, 16px, `neutral.500`
- Searches across: `school.name`, `school.city`, `school.contactPersonName`, `school.contactPhone`
- Debounce 200ms
- Clears with `×` button when value is non-empty
- Width: `flex: 1`, min-width 240px

### 4.2 Filter chip group
Segmented control, four mutually-exclusive chips:

| Chip label | Filter |
|------------|--------|
| All        | no filter (default) |
| Configured | `setupStatus === 'configured'` |
| Partial    | `setupStatus === 'partial'` |
| Empty      | `setupStatus === 'not_configured'` |

Visual: pill-shaped container with `neutral.100` background, `radius.full`, `padding: 3px`. Active chip has `neutral.0` background, weight 500, subtle `shadow.sm`. Inactive chips are `neutral.500` text, no background.

### 4.3 Sort button
- Trigger: secondary button with `ArrowUpDown` icon (lucide), label shows current sort, e.g. `Sort: Last updated ↓`
- Click opens a small popover menu with options:
  - Last updated (default, descending)
  - Name (A–Z)
  - City (A–Z)
  - Children (high to low)
  - Status (configured first)
- Selected option has a `Check` icon at the right
- Popover uses `radius.md`, `shadow.md`, 1px `neutral.200` border

---

## 5. Schools table

Single Card surface wrapping the table. Border `1px solid neutral.200`, `radius.lg`, no internal padding (the table fills the card edge to edge), `overflow: hidden` (so the rounded corners clip the header).

### 5.1 Columns

Grid layout, `display: grid`, columns:

```
grid-template-columns: minmax(0, 2.4fr) 1fr 1.1fr 0.8fr 0.8fr 0.8fr 1fr;
gap: theme.spacing(1.5);
padding: theme.spacing(1.5) theme.spacing(2);
```

| Column | Header | Alignment | Notes |
|--------|--------|-----------|-------|
| 1 | School | left | Avatar + name (line 1) + contact (line 2) |
| 2 | City | left | `neutral.500` text |
| 3 | Status | left | Status badge |
| 4 | Children | right | Tabular numeric (mono font), `neutral.500` if 0 |
| 5 | Volunteers | right | Tabular numeric, `neutral.500` if 0 |
| 6 | Assignments | right | Tabular numeric, `neutral.500` if 0 |
| 7 | Last updated | left | Relative time, `Caption`, `neutral.500` |

### 5.2 Header row
- Background: `neutral.50`
- Text: `Caption` (12/16/400), `neutral.500`, `text-transform: uppercase`, `letter-spacing: 0.04em`, weight 500
- Border-bottom: `1px solid neutral.200`
- Sortable columns (Name, City, Children, Last updated) show a sort indicator caret on hover; clicking sets that column as sort key (matches the sort popover state).

### 5.3 Data row
- Border-bottom: `1px solid neutral.200` (no border on last row — the card border closes it)
- Padding: `theme.spacing(1.75) theme.spacing(2)` (14px / 16px)
- Hover: background `neutral.50`, cursor `pointer`
- Click: navigate to `/schools/[schoolId]` (the row is the click target, not a button)
- Keyboard: row is focusable (`tabindex=0`), Enter/Space navigates
- Focus ring: 2px `primary.500` inset

**Column 1 (School):**
- Avatar: 32×32, `radius.md` (NOT circular — use rounded square for school identity, reserve circles for people per ui-reference Avatar pattern)
- Initials: 2 chars, derived from name (e.g. "St. Mary's High School" → "SM", "Government Primary Koramangala" → "GP")
- Avatar background uses deterministic hash from school name; foreground always white (matches Avatar component spec)
- Name: `Body` (14/20), weight 500, `neutral.900`, single-line truncate
- Contact line: `Caption` (12/16), `neutral.500`, format: `{contactPersonName} · {contactPhone}`, single-line truncate
- The `min-width: 0` on the inner div is required for truncation to work inside the grid track

**Column 3 (Status):** Status badge component with the conventional status mapping:

| `setupStatus` value | Badge variant | Label |
|---------------------|---------------|-------|
| `configured`        | `success`     | Configured |
| `partial`           | `warning`     | Partial |
| `not_configured`    | `neutral`     | Not configured |

Each badge has a 6px leading dot in the badge's accent color (`success.500` / `warning.500` / `neutral.500`).

**Columns 4–6 (numeric):** mono font (`JetBrains Mono`, 14/20/500), right-aligned. Zero values use `neutral.500` instead of `neutral.700` so they recede visually — combined with last-updated sort this makes stale/empty schools obvious without highlighting them aggressively.

**Column 7 (Last updated):**
- Format: relative time using a small helper (e.g. `formatDistanceToNow` from date-fns)
- Examples: `2 hours ago`, `Yesterday`, `4 days ago`, `Never` (when null)
- `Never` renders in `neutral.500` italic — visual hint that nothing has happened yet

### 5.4 Empty filter results
When search/filter returns zero rows but the user has schools:

```
[Search icon, 24px, neutral.500]
No schools match "{query}"
[Clear filters — secondary button]
```

Center this inside the table card, padding `theme.spacing(6)` vertical. Don't use the full empty-state component here — that's reserved for the "user has zero schools" case below.

### 5.5 Loading state
Skeleton: 6 placeholder rows matching the row height (~58px each). Skeleton backgrounds in `neutral.100` with subtle pulse. The header row is rendered for real (no skeleton on headers).

---

## 6. Empty state (user has zero schools)

Only shown when `schools.length === 0`. Replaces the entire table area (KPIs and toolbar are also hidden — there's nothing to summarize or filter).

```
[BookOpen icon, 32px, neutral.500]

No schools assigned yet
You'll see your schools here once an admin assigns them to your account.
Reach out to your MAD coordinator if you think this is wrong.

[Contact admin — secondary button — opens mailto: link]
```

Centered, vertical padding `theme.spacing(8)` minimum. Body text in `neutral.500`.

CHO note: same empty state, no special variation.

---

## 7. CHO read-only treatment

Per F02: hide all action buttons, keep all data visible. On this page:
- The page is naturally read-only already (no actions live here — drilling into a school is reading, not editing)
- No changes needed for CHO

---

## 8. Data shape

The page expects a single endpoint response shaped roughly like:

```ts
type SchoolListResponse = {
  schools: Array<{
    id: string;
    name: string;
    initials: string;          // pre-computed server-side
    city: string;
    contactPersonName: string;
    contactPhone: string;       // formatted, e.g. "+91 98200 11234"
    setupStatus: 'configured' | 'partial' | 'not_configured';
    childrenCount: number;
    volunteersCount: number;
    assignmentsCount: number;
    updatedAt: string | null;   // ISO 8601, null if never
  }>;
  summary: {
    totalSchools: number;
    fullyConfigured: number;
    childrenEnrolled: number;
    activeVolunteers: number;
    academicYear: string;       // "2024-25"
  };
};
```

Filtering and sorting happen client-side — the dataset is small (≤20 schools per CO realistically). No pagination needed.

---

## 9. Component breakdown

Build as:

```
app/schools/page.tsx                          ← route, fetches data
components/schools/SchoolListPage.tsx         ← layout, owns search/filter/sort state
components/schools/SchoolKpiStrip.tsx         ← 4 KPI cards
components/schools/SchoolToolbar.tsx          ← search + chips + sort
components/schools/SchoolTable.tsx            ← table grid
components/schools/SchoolTableRow.tsx         ← single row (memoized)
components/schools/SchoolEmptyState.tsx       ← zero-schools state
```

State lives in `SchoolListPage`. Filter/sort logic in a `useMemo` that derives the visible row list from the raw schools array + search/filter/sort state. No URL state for filters in v1 (kept simple); revisit if COs ask for shareable filtered links.

---

## 10. Acceptance checklist

- [ ] KPI strip renders 4 cards with correct counts derived from the schools array
- [ ] `/ 6` denominator in "Fully configured" is visually de-emphasised
- [ ] Search filters across name, city, contact name, and phone (case-insensitive, 200ms debounce)
- [ ] Filter chips are mutually exclusive; default is "All"
- [ ] Sort defaults to last updated, descending; "Never" sorts to the bottom
- [ ] Status badges use the success/warning/neutral variants from ui-reference
- [ ] Zero numeric values render in `neutral.500`, non-zero in `neutral.700`
- [ ] Row click navigates to `/schools/[schoolId]`
- [ ] Row is keyboard-focusable; Enter/Space activates navigation
- [ ] Empty filter result shows inline "No schools match" with clear-filters action
- [ ] Empty user state (zero schools) shows the full empty-state component, hides KPI/toolbar
- [ ] Loading state shows 6 skeleton rows + skeleton KPI cards (header rendered for real)
- [ ] Singular vs plural copy is correct (`1 school in Mumbai` vs `6 schools across 6 cities`)
- [ ] All colors come from theme tokens — grep the file for `#` and find zero hardcoded hex
- [ ] All spacing uses `theme.spacing()` — no hardcoded `px` for layout gaps
- [ ] Page passes axe-core accessibility checks at WCAG AA

---

## 11. What we explicitly chose NOT to do (and why)

Documenting these so they don't get re-litigated:

- **No left rail school list shortcut on this page.** Bolt has it; we don't need it because the table is the navigator. The sidebar still shows the schools list (per app shell), so users have it via the shell already.
- **No "Open" button on each row.** The row is the click target. A button next to a clickable row is visual noise and creates a target ambiguity.
- **No address column.** It's a CO's job to know the schools, and the address shows in the school detail header. Keeping it off the list keeps rows scannable.
- **No bulk actions, no row checkboxes.** No bulk operations exist in v1. Add when there's a real bulk use case.
- **No pagination.** A CO has at most ~20 schools. Pagination is a tax for a problem we don't have.
- **No "Add school" button.** Schools are admin-provisioned, not CO-created. (See F13.)