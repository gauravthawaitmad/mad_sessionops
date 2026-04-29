# Session-Ops Milestones

The plan for getting Session-Ops into production. Five milestones, ~2 weeks each, each ending in a real production deploy.

This is the central overview. Per-milestone deep specs live under `docs/milestones/MX.md` and are written **at the start of each milestone**, not all upfront.

---

## How milestones work

A milestone is **not** a sprint. A sprint is a time box. A milestone is a shippable, deployed product release.

Each milestone:

- Is ~2 weeks of calendar time
- Reserves the last 3-4 days for **stabilization** — testing, bug fixes, production deploy, smoke testing in production
- Ends with users actually using what was built
- Builds on the previous milestone — does not redo work

The principle: **easy first, complex later.** Things with fewer architectural decisions ship earlier. Things with cross-cutting concerns (Google OAuth, real-time sync, year progression) come later, when the foundation is stable.

---

## Definition of "production ready"

For every milestone, "done" means all of:

- Code merged to main on both repos
- Migrations applied in production DB
- Backend deployed on production EC2
- Frontend deployed
- Smoke test passed in production: a real user can complete the milestone's primary user flow
- Sentry error rate is at baseline (no new error spikes in 24h post-deploy)
- Rollback plan documented (how to revert if something breaks)

If any of those fail, the milestone is not done. Don't move to the next milestone with the previous one half-shipped.

---

## Timeline overview

| # | Milestone | Theme | Status | Detailed doc |
|---|---|---|---|---|
| M1 | Auth + School Visibility | Password login, RBAC, Hasura sync, school list + detail | In progress | `docs/milestones/M1.md` |
| M2 | School Configuration | Academic year, classes, sections, session dates, holidays | Not started | Written at M2 start |
| M3 | People in Schools | Children, volunteers, school-volunteer assignments | Not started | Written at M3 start |
| M4 | Scheduling | Slots, slot-classes, schedule validation | Not started | Written at M4 start |
| M5 | Google OAuth + Admin Operations | Google sign-in, sync admin dashboard, year progression, webhook sync | Not started | Written at M5 start |

**Total expected duration:** 10 weeks of build + stabilization. Each milestone's start date is "when the previous milestone ships," not a fixed calendar date.

---

# Milestone 1 — Auth + School Visibility

**Status:** In progress
**Production goal:** A user signs in with email + password, sees the schools they have access to, and can view a school's basic details.

## Features

- **F-M1-1** Password authentication — set, login, forgot password (Brevo email)
- **F-M1-2** Hasura scheduled sync — system cron every 6 hours, fetches users + partners
- **F-M1-3** RBAC scope filtering — CO sees own schools, admin sees all, CHO empty list
- **F-M1-4** School list page — scope-filtered, with search
- **F-M1-5** School detail page — Overview tab only; other tabs disabled placeholders

## Major in-scope items

- Password auth (set, login, forgot)
- Hasura sync (users + partners, cron-driven, no Celery)
- School list and detail (read-only)
- RBAC scope service
- Production deploy at https://sessionops.makeadiff.in

## Major out-of-scope items

- Google OAuth (M5)
- School configuration (M2)
- Children, volunteers, slots (M3, M4)
- Real-time webhook sync (M5)
- Sync admin UI (M5)

> **Detailed M1 spec:** `docs/milestones/M1.md`

---

# Milestone 2 — School Configuration

**Status:** Not started
**Production goal:** A CO can fully configure a school for the academic year — link an academic year, add classes, add sections, set session start/end dates, log holidays.

## Features (planned — finalize at M2 start)

- **F-M2-1** Academic year management — link a year to a school, switch active year
- **F-M2-2** Classes — add/edit classes for a school
- **F-M2-3** Sections — add/edit sections under classes; max-5-children rule visible in UI
- **F-M2-4** Session dates — start and end dates for the academic session
- **F-M2-5** Holidays — log planned closures and special days
- **F-M2-6** Setup completeness checklist — visible on school overview, shows what's still missing
- **F-M2-7** Activate Structure tab — currently disabled placeholder; M2 makes it real
- **F-M2-8** Activate Calendar tab — same; M2 makes it real

## Major in-scope items

- All structure-related school configuration (the "shell" of an operational school)
- New tabs activated on school detail page: Structure, Calendar
- Setup checklist computation (how many classes, sections, dates are configured vs missing)

## Major out-of-scope items

- Children enrollment (M3)
- Volunteer assignment (M3)
- Slot creation or scheduling (M4)
- Bulk class/section import (later — manual entry only in M2)
- Past-year archive view (later)

## Open questions to resolve at M2 start

- Are academic years per-school or platform-wide? (Single global year vs per-school year)
- Class naming convention — "Class 5", "Grade 5", "5th", or whatever Hasura sends?
- Holiday categories — single list vs typed (national, regional, school-specific)?
- Is Calendar tab read-only summary, or does it allow editing dates from the calendar view?

> **Detailed M2 spec:** Written when M2 begins.

---

# Milestone 3 — People in Schools

**Status:** Not started
**Production goal:** A CO can enroll children into sections and assign volunteers to a school. Both lifecycles fully supported.

## Features (planned — finalize at M3 start)

- **F-M3-1** Children list and enrollment — add child, assign to section, basic info
- **F-M3-2** Children edit — update info, change section
- **F-M3-3** Children deactivation with mandatory reason — soft-delete with `removed_reason`
- **F-M3-4** Children reactivation — bring back a previously-deactivated child
- **F-M3-5** Children list filters — by section, by status, by search
- **F-M3-6** Volunteer assignment — assign a volunteer (existing user) to a school
- **F-M3-7** Volunteer removal with cascade handling — remove from school, deal with their assignments
- **F-M3-8** CHO scope activation — CHO users now see schools where they have an active assignment
- **F-M3-9** Synced volunteer deactivation alert — when a volunteer's user record gets deactivated via sync, surface this to admins
- **F-M3-10** Activate Children tab — currently disabled placeholder
- **F-M3-11** Activate Volunteers tab — currently disabled placeholder

## Major in-scope items

- Full child lifecycle (enroll, edit, deactivate, reactivate, list)
- Volunteer assignment to schools
- CHO RBAC scope becomes real (was empty in M1, M2)
- Two new tabs activated on school detail

## Major out-of-scope items

- Slot scheduling (M4)
- Bulk children import (later)
- Child attendance tracking (later — out of M1-M5 scope unless reprioritized)
- Volunteer performance metrics (later)
- Parent communication features (later)

## Open questions to resolve at M3 start

- Mandatory child fields vs optional (what's the minimum to enroll)?
- Volunteer-to-school enforcement: 1 volunteer per school confirmed in business rules — does this apply per academic year or forever?
- What happens to a section when its assigned children all get deactivated?
- Volunteer deactivation alert: in-app notification only, or email too?

> **Detailed M3 spec:** Written when M3 begins.

---

# Milestone 4 — Scheduling

**Status:** Not started
**Production goal:** A CO can create teaching slots and schedule which sections + volunteers + subjects fill each slot.

## Features (planned — finalize at M4 start)

- **F-M4-1** Slot creation — define a time slot (day, start time, end time) for a school
- **F-M4-2** Slot edit and delete (soft-delete) — change times, remove slots
- **F-M4-3** Slot-class assignment — assign section + subject + 1-2 volunteers to a slot
- **F-M4-4** Schedule validation — no overlapping slots for same volunteer, vol1 ≠ vol2, valid section/volunteer
- **F-M4-5** Move volunteer between slot-classes — reassignment workflow
- **F-M4-6** Schedule view — visual representation of the week's slots and assignments
- **F-M4-7** Activate Slots tab — currently disabled placeholder
- **F-M4-8** Schedule conflict detection across schools — flag if a volunteer is double-booked

## Major in-scope items

- Full slot creation, editing, deletion
- Slot-class composition (section + subject + volunteers)
- All scheduling business rules enforced (volunteer count, overlaps, etc.)
- Slots tab activated on school detail

## Major out-of-scope items

- Recurring slot templates (later — M4 creates each slot individually)
- Substitute volunteer workflow (later)
- Automatic schedule generation (never — humans schedule)
- Calendar view across schools (out of M4 — possible M5 addition)

## Open questions to resolve at M4 start

- Slot duration constraints — minimum/maximum length?
- Subjects: predefined list or free-text?
- Cross-school volunteer schedule conflict — is it a hard block or a warning?
- Time zone handling — all slots in IST, or user-locale aware?

> **Detailed M4 spec:** Written when M4 begins.

---

# Milestone 5 — Google OAuth + Admin Operations

**Status:** Not started
**Production goal:** Users can sign in with Google. Admins can monitor sync health, manually trigger syncs, and run year progression. Real-time webhook sync replaces (or supplements) cron-based sync.

## Features (planned — finalize at M5 start)

- **F-M5-1** Google OAuth sign-in — activate the F01a backend code that's been sitting paused; build frontend Google flow
- **F-M5-2** Sync admin dashboard — see sync run history, status, counts, errors
- **F-M5-3** Manual sync trigger UI — "Sync now" button for admins
- **F-M5-4** Sync health alerts — Sentry/email if sync fails N times in a row
- **F-M5-5** Webhook receiver from Hasura — replace 6-hour cron with real-time updates (or supplement: webhook + safety-net cron)
- **F-M5-6** Year progression workflow — promote children at end of year, archive old data
- **F-M5-7** Year progression preview — show what will change before committing
- **F-M5-8** Volunteer-deactivation alerts — admin sees impacted assignments when a volunteer's user record deactivates
- **F-M5-9** Field-level sync diff (optional) — track which fields changed between sync runs
- **F-M5-10** Celery + Redis introduction — replace cron-based sync with proper async queue

## Major in-scope items

- Google OAuth (full flow, frontend reactivated)
- Sync admin UI for monitoring and manual triggers
- Webhook-based real-time sync
- Year progression flow
- Celery and Redis for queueing

## Major out-of-scope items

- Bulk admin operations beyond year progression (e.g., bulk school deactivation) — defer until needed
- Custom sync schedules per environment — assume one global schedule
- Multi-tenant admin features — out of scope; single MAD organization only

## Open questions to resolve at M5 start

- Webhook authentication from Hasura — what mechanism? Shared secret in headers?
- Year progression — does it run automatically on a date, or always manual trigger?
- Hosted-domain restriction on Google OAuth — restrict to `@makeadiff.in` only, or allow any verified domain?
- Should sync dashboard show field-level diffs, or just per-run aggregate counts?

> **Detailed M5 spec:** Written when M5 begins.

---

## Working with milestones

### At the start of each milestone

- Open the central doc (this file) and confirm scope is still right
- Write the milestone's detailed doc (`docs/milestones/MX.md`) using M1.md as the template
- Build days: 8-10 working days
- Stabilize days: last 3-4 days

### During the milestone

- Use Claude Code plan mode for implementation work
- Come to chat only when stuck on architecture or scope
- Update the milestone doc's "Done log" as work completes

### At the end of each milestone

- All "Definition of production ready" boxes checked
- Update this file's status table
- Brief retrospective: what went faster than expected, what hit blockers, what to carry into the next milestone
- Decide: ship as-is, one extra day of fixes, or something needs to slip to the next milestone

### Don't add scope mid-milestone

If a need surfaces, write it down and address it in the next milestone planning. The 2-week box is a forcing function for "what really matters."

---

## What survived from earlier planning

These docs are still authoritative. Read them when relevant:

- `BUSINESS_RULES.md` — every non-negotiable rule
- `GLOSSARY.md` — terms (CO, CHO, slot, slot-class, etc.)
- `ARCHITECTURE.md` — how the system fits together
- `DECISIONS.md` — past architectural decisions
- `UI_REFERENCE.md` — visual system
- `FRONTEND_ARCHITECTURE.md` — frontend conventions
- `FRONTEND_DECISIONS.md` — frontend decisions

These are deprecated:

- `FEATURE_PLAN.md` — replaced by this file
- `FEATURE_TEMPLATE.md` — replaced by per-milestone feature notes
- `PROGRESS.md` — folded into each milestone's done log
- `F01a-google-oauth-login.md` and `F01b-password-authentication.md` — auth work re-scoped under M1 password and M5 Google

---

## Quick reference — what's already built before M1

State of code as of milestone restart:

- Schema renamed to `mad_sessionops_dev`
- `SoftDeleteBaseModel` and `User`/`UserAuth` models match the multi-auth schema
- 4605 users already in the DB from prior import
- Auth services (`role_helpers`, `complete_google_login`, `refresh_access_token`, `logout`, exceptions) are built and tested — Google-side flow paused
- API endpoints `/api/auth/google/callback`, `/refresh`, `/logout`, `/me` exist
- Single DB user `sessionops_app_user` with full schema permissions

M1 reuses the schema, role helpers, JWT services, refresh, logout, /me. Adds password endpoints. Removes Google callback from M1 routing (kept in code for M5).