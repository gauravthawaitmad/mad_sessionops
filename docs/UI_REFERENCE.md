# UI Reference

The visual and interaction system for Session-Ops. Every feature doc references this. Update this when a pattern changes; do NOT make screen-level pattern decisions inside a feature doc.

The design synthesizes two AI-generated prototypes (Bolt and Emergent) with adjustments for MAD brand direction and class-management UX needs.

## Where the prototypes live
docs/ui-prototype/
├── bolt/                       ← Bolt prototype screenshots (school detail-heavy)
│   ├── school-detail-overview.png
│   ├── school-detail-structure.png
│   ├── school-detail-children.png
│   ├── school-detail-volunteers.png
│   ├── school-detail-slots.png
│   ├── school-detail-calendar.png
│   ├── login.png
│   └── school-list.png
└── emergent/                   ← Emergent prototype screenshots (login + workspace pattern)
├── login.png
├── school-list.png
├── school-detail-overview.png
├── school-detail-classes-sections.png
├── school-detail-children.png
├── school-detail-volunteers.png
├── school-detail-slots.png
└── school-detail-calendar.png

Both are reference, neither is "the design." This document records what we're taking from where.

## Per-screen source decisions

| Screen | Adopted from | What we change |
|--------|--------------|----------------|
| Login | Emergent visual framing | 
| School list | Emergent table + Bolt's detail richness | Compact rows by default, expandable on hover/click for address + contact |
| School detail shell | Emergent (vertical sidebar workspace) | Adopt as-is; scales to 6+ tabs |
| Overview tab | Emergent (setup checklist + stat cards) | Show setup checklist when not fully configured; switch to Quick Actions panel when fully configured |
| Classes & Sections tab | Emergent layout + Bolt's capacity bars | Visual capacity bar instead of "2/5 seats" text |
| Children tab | Bolt (grouped by class > section) with view toggle | Default grouped; toggle to flat list (Emergent style) for filtering/searching |
| Volunteers tab | Bolt (rich cards with subject tags + assignment chips) | Subject tags computed from assignments, not stored on volunteer |
| Slots tab | Emergent (compact + `1/2 vols` capacity badges) | Capacity badges color-coded green/neutral |
| Calendar tab | Bolt (grid + sidebar event list) | Emergent's chip-in-cell as enhancement for sparse days |
| CHO views | Designed in F02 | Read-only treatment: hide all action buttons, keep all data visible |
| Admin views (sync, year progression) | Designed in F13 / F14 | No prototype reference; design from scratch |

## Brand direction

MAD's brand is red, blue, yellow, white. We adapt this for an operations tool:

- **Primary blue** for actions, links, active states. Sober and conventional — operations users expect "blue means primary action."
- **MAD red** for brand chrome (logo, hero areas, the "MAD" wordmark next to "Session-Ops" in the header). Never on buttons or save actions.
- **MAD yellow / amber** for "needs attention" states only — partial setup, holiday markers, sync warnings.
- **Status colors are conventional, brand-independent:**
  - Green: success, complete, "fully configured," section at capacity (capacity = goal)
  - Amber: partial, in progress, needs attention
  - Red: error, destructive action confirmation, sync failure
  - Gray: inactive, soft-deleted, "not started"

Rationale: a CO using this tool 4 hours a day learns blue = OK, red = danger from every other piece of software they use. Fighting that convention to honor brand is a losing trade. Brand presence stays in the chrome.

## Design tokens

These tokens are implemented in `mad-sessionops-frontend/lib/theme.ts` as MUI v6 theme values. Every component reads from theme — no hardcoded hex codes, no hardcoded pixel values.

### Color
Brand:
brand.red.500       #E53935   ← MAD primary red — chrome only
brand.red.600       #C62828   ← darker for hover on red chrome elements
brand.yellow.500    #FBC02D   ← MAD yellow — attention states only
Primary action (blue):
primary.50          #EFF6FF
primary.100         #DBEAFE
primary.500         #3B82F6   ← default action color
primary.600         #2563EB   ← hover
primary.700         #1D4ED8   ← active/pressed
Status:
success.500         #10B981   ← complete, full capacity, configured
success.50          #ECFDF5   ← background tint for success cards
warning.500         #F59E0B   ← partial, needs attention
warning.50          #FFFBEB
error.500           #EF4444   ← errors, destructive confirmation
error.50            #FEF2F2
Neutrals:
neutral.0           #FFFFFF   ← surface
neutral.50          #F8FAFC   ← page background
neutral.100         #F1F5F9   ← subtle dividers, hover
neutral.200         #E2E8F0   ← borders
neutral.500         #64748B   ← secondary text
neutral.700         #334155   ← primary text
neutral.900         #0F172A   ← headings, sidebar dark
Sidebar:
sidebar.bg          #0F172A   ← dark slate (very dark blue, not pure black)
sidebar.fg          #F1F5F9   ← text on dark
sidebar.muted       #64748B   ← secondary text on dark
sidebar.active      #1E293B   ← selected item background

### Typography

Font: **Inter** (loaded via `next/font/google`). Geometric sans, ships well with Indian English, broad weight range.
Display     32px / 40px line-height / 700 weight   ← page-level headings
H1          24px / 32px / 700                       ← section headings
H2          18px / 28px / 600                       ← subsection headings
H3          16px / 24px / 600                       ← card titles
Body        14px / 20px / 400                       ← default body
Body lg     16px / 24px / 400                       ← prominent body, intro paragraphs
Caption     12px / 16px / 400                       ← metadata, hints
Mono        14px / 20px / 500                       ← times, IDs, numbers in tables

Mono font: **JetBrains Mono** for time strings (`09:00–10:30`), IDs, and tabular numbers. Adopted from Emergent's slots screen — the monospace times are noticeably more scannable.

### Spacing

8px base unit. Use `theme.spacing(n)` where n is multiples of 0.5.
xs   4px   (theme.spacing(0.5))
sm   8px   (theme.spacing(1))
md   16px  (theme.spacing(2))   ← default card padding
lg   24px  (theme.spacing(3))   ← default section gap
xl   32px  (theme.spacing(4))   ← page-level gaps
2xl  48px  (theme.spacing(6))   ← top-level page padding

### Shape
radius.sm    4px    ← small chips, badges, pills
radius.md    8px    ← buttons, inputs, small cards
radius.lg    12px   ← cards, dialogs, surfaces
radius.full  9999px ← avatars, status dots, capsule buttons

Shadows are minimal. The visual hierarchy is built with borders (`neutral.200`) and background tints, not drop shadows.
shadow.sm    0 1px 2px rgba(15, 23, 42, 0.05)       ← subtle, hover only
shadow.md    0 4px 12px rgba(15, 23, 42, 0.08)      ← dialogs, popovers

### Layout
sidebar.width            240px              ← left sidebar (school list / workspace tabs)
content.maxWidth         1280px             ← main content max width
content.padding          theme.spacing(4)   ← horizontal padding
header.height            64px               ← top app bar

## Component patterns

Common components — these are the building blocks. Define once in `components/ui/`, reuse everywhere.

### Button

Variants: `primary`, `secondary`, `ghost`, `danger`, `dangerGhost`.

- **Primary:** filled blue, white text. Used for the main action on a screen (one per screen ideally).
- **Secondary:** outlined, neutral border, primary text color. Default for non-primary actions.
- **Ghost:** no border, no fill, primary text color. Tertiary actions.
- **Danger:** filled red, white text. Destructive confirmation only ("Delete", "Remove permanently"). Never the default destructive trigger — that's `dangerGhost`.
- **DangerGhost:** ghost button with `error.500` text. The "Remove" / "Deactivate" action that opens the confirmation dialog.

Sizes: `sm` (32px height), `md` (40px, default), `lg` (48px).

Always include a leading or trailing icon when the action is non-trivial. Icons from `lucide-react`.

### Card

Standard surface with `border: 1px solid neutral.200`, `border-radius: lg`, `padding: md`. No shadow at rest.

Header pattern: title (H3) + optional metadata + optional right-aligned actions.

### Tabs

Two variants — pick based on screen:

- **Horizontal tabs:** for ≤4 tabs. Used in dialog panels, secondary  igation.
- **Vertical sidebar tabs:** for ≥5 tabs. Used in the school detail workspace (Overview / Classes & Sections / Children / Volunteers / Slots / Calendar).

Active state: blue text, `primary.500` left border (vertical) or bottom border (horizontal), 2px thick.

### Status badge

Pill-shaped (`radius.full`), 12px text, padding `xs sm`. Variants:
- `success` — green text on `success.50` background
- `warning` — amber text on `warning.50`
- `error` — red text on `error.50`
- `neutral` — gray text on `neutral.100`

Examples: "Fully configured" (success), "Partial" (warning), "Not configured" (neutral), "Inactive" (neutral).

### Capacity bar

Used wherever max-5 children is relevant.
[Section A]                    3/5  Full / 1 seat available / 2 seats available
████████░░░░░░░░░░░░░░░░░░     ← progress bar

- Bar fill: `success.500` when at capacity, `primary.500` when partial, `neutral.300` when empty
- Background card: `success.50` tint when full, white when not

This is the visual treatment of business rule R1 (max 5 per section). Critical pattern.

### Avatar

Circle with initials. Background uses a deterministic color hash from the name (so "Aarav Sharma" is always the same color). Foreground always white. Used in lists where personal identity matters (children, volunteers, COs).

### Empty state
[icon, neutral.500]
[Heading — H2]            ← "No volunteers yet" / "No children enrolled"
[body text]               ← brief explanation
[primary action button]   ← "Add volunteer" / "Enrol child"

Centered in the parent container, generous vertical padding (`theme.spacing(8)` minimum).

### Loading state

For lists/tables: skeleton rows in `neutral.100` with subtle pulse animation. Match the height of the actual content so layout doesn't jump on load.

For full-page loads: centered spinner in `primary.500`. Avoid full-page spinners when possible — prefer skeleton.

### Error state

For inline errors (form fields): red text below the field, no icon needed.

For section-level failures (a card couldn't load): replace the card content with:
[icon — alert circle, error.500]
[Couldn't load this section]
[Retry button — secondary variant]

For full-page errors (route-level): a full empty-state pattern with the error icon, message, and "Retry" / "Go back" actions.

### Dialog (modal)

Used sparingly. Width: 480px default, 640px for forms, 800px for tables. Max height: 90vh with scroll inside.

Header has H2 title + close icon. Footer has buttons right-aligned: cancel (secondary) on the left, primary action on the right.

Destructive confirmations always use the `danger` variant for the primary action AND require the user to read the action label, not the dialog title, to confirm.

### Form patterns

- **All forms:** React Hook Form + Zod resolver. No custom form state.
- **Field layout:** label above input, helper text below, error text replaces helper on validation failure.
- **Required fields:** marked with red asterisk after the label, NOT with "(required)" suffix.
- **Inline validation:** on blur, not on every keystroke. Exception: password strength meters (none in scope yet).
- **Save button:** disabled while submitting, shows spinner + "Saving..." text.
- **On success:** toast notification top-right, dialog closes if applicable, list refreshes.
- **On failure:** field-level errors mapped from backend `details`, plus a top-of-form error banner if non-field error.

### Toast notifications

Top-right corner, 4-second auto-dismiss for success, 8-second for warning, manual-dismiss for error.
[icon] [message text]                         [×]

Variants match status colors. Stack vertically if multiple.

## Layout: app shell

The shell is constant across all authenticated routes:
┌──────────────────────────────────────────────────────────────┐
│  [App bar — 64px tall]                                        │
│  Logo · Session-Ops MAD       [Schools]   Mumbai · Priya · CO │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                    │
│ Sidebar  │  Main content                                      │
│ 240px    │  (max 1280px wide, centered)                       │
│          │                                                    │
│ School   │                                                    │
│ list     │                                                    │
│ + Tabs   │                                                    │
│ within   │                                                    │
│ school   │                                                    │
│          │                                                    │
└──────────┴───────────────────────────────────────────────────┘

The sidebar shows two things at once:
1. **Schools section** (top): the user's accessible schools, with a status dot per school
2. **Workspace tabs section** (below): the tabs for the currently-open school (Overview / Classes & Sections / etc.), only visible when a school is selected

When a school is selected, the school list collapses to a list with the active school highlighted; tabs appear underneath. When no school is selected (e.g., on `/schools` index), the workspace tabs section is hidden.

App bar contents (left to right):
- Logo (small icon) + "Session-Ops" wordmark + "MAD" tag in muted text
- (right side) City context (e.g., "Mumbai" for COs scoped to one city) + user avatar with name + role chip + dropdown menu

## Iconography

Library: `lucide-react` (already in stack). Stroke width: 1.5 (default). Size: 20px in inline contexts, 16px in dense lists, 24px in headers/empty states.

Specific icon assignments (consistent across the app):
- `BookOpen` — Overview / school
- `GraduationCap` — Classes & Sections
- `Users` — Children
- `UserPlus` — Volunteers (action context)
- `Clock` — Slots / time
- `Calendar` — Calendar
- `Filter` — filter actions
- `Search` — search
- `Plus` — create / add
- `Trash2` — delete / remove (always pair with confirmation)
- `Check` / `CheckCircle2` — success / complete
- `AlertTriangle` — warning
- `XCircle` — error
- `LogOut` — sign out

## Accessibility baselines

- All interactive elements reachable by keyboard
- Focus rings visible (2px `primary.500` outline)
- Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text
- Form labels always present (no placeholder-as-label)
- Status communicated by more than color alone (text or icon accompanies color)
- Modal focus traps + escape to close
- Loading states announced via `aria-live` for screen readers

These are baselines, not stretch goals. Every feature meets them.

## What this doc is NOT

- **Not a Figma replacement.** When we eventually have proper design files, those become source of truth. This doc captures the system in a form Claude Code can read.
- **Not a component library reference.** Component implementation details live in `components/ui/` JSDoc and Storybook (if/when added).
- **Not exhaustive.** New patterns get added when they appear in features. Features that introduce new patterns must update this doc in the same PR.