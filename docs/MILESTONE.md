# Milestones

The plan for getting Session-Ops into production. Five milestones, ~2 weeks each, each ending in a real production deploy.

## How milestones work

A milestone is **not** a sprint. A sprint is a time box. A milestone is a shippable, deployed product release.

Each milestone:
- Is ~2 weeks of calendar time
- Reserves the last 3-4 days for **stabilization**: testing with real data, fixing bugs, deploying to production, smoke testing in production
- Ends with users actually using what was built
- Builds on the previous milestone — does not redo work

The principle: **easy first, complex later.** Things with fewer architectural decisions ship earlier. Things with cross-cutting concerns (real-time sync, year progression) come later, when the foundation is stable.

## Definition of "production ready"

For every milestone, "done" means all of:

- Code merged to main on both repos
- Migrations applied in production DB
- Backend deployed on production EC2
- Frontend deployed (Vercel or EC2 — TBD by M1 deploy time)
- Smoke test passed in production: a real user can complete the milestone's primary user flow
- Sentry error rate is at baseline (no new error spikes in 24h post-deploy)
- Rollback plan documented (how to revert if something breaks)

If any of those fail, the milestone is not done. Don't move to the next milestone with the previous one half-shipped.

## Milestone overview

| Milestone | Theme | Primary outcome | Status |
|-----------|-------|-----------------|--------|
| M1 | Auth + school visibility | A user can sign in with password and see their schools | in progress |
| M2 | School configuration | A CO can set up classes, sections, session, holidays | not started |
| M3 | People — children and volunteers | A CO can manage children and volunteers in a school | not started |
| M4 | Scheduling | A CO can create slots and schedule slot-classes | not started |
| M5 | Google OAuth + admin features | Google sign-in, sync admin dashboard, year progression | not started |

## What's in each milestone (high level)

The detailed scope and feature breakdown lives in each milestone's own doc (`docs/milestones/MX.md`). Below is the elevator pitch.

### M1 — Auth + school visibility (current)

**Production goal:** A user signs in with email/password, sees the schools they have access to, and can view a school's basic details.

**In scope:**
- Password authentication: set, login, forgot password (Brevo email)
- RBAC: scope filtering by role, CO sees own schools, admin sees all, CHO sees empty list in M1
- Hasura scheduled sync: every 6 hours, fetches users + partners (REST API, JWT auth)
- School list page (Partner = School in M1)
- School detail page: Overview tab only
- Logout
- Production deploy at https://sessionops.makeadiff.in (EC2, nginx, certbot)

**Out of scope:** Google OAuth (M5), CHO scope (needs volunteers, M3), school configuration (M2), real-time webhook sync (later).

See `docs/milestones/M1.md` for details.

### M2 — School configuration

**Production goal:** A CO can fully configure a school for the academic year — link an academic year, add classes, add sections, set session start/end dates, log holidays.

**In scope:**
- Academic year linkage (link a year to a school)
- Classes: add to a school
- Sections: add under a class, max-5-children rule visible in UI even though no children yet
- Session dates: start and end
- Holidays: log planned closures
- Setup completeness checklist on school overview tab

**Out of scope:** Children (M3), volunteers (M3), slots (M4).

### M3 — People in schools

**Production goal:** A CO can enroll children into sections and assign volunteers to a school. Both lifecycles fully supported.

**In scope:**
- Children: enroll, edit, deactivate (with reason), reactivate
- Children list with filters
- Volunteers: assign, view assignments, remove (with cascade handling)
- CHO role scope activates (CHO sees schools where they have an active SchoolVolunteer record — now that SchoolVolunteer exists)
- Synced volunteer deactivation alert

**Out of scope:** Scheduling (M4).

### M4 — Scheduling

**Production goal:** A CO can create teaching slots and schedule which sections + volunteers + subjects fill each slot.

**In scope:**
- Slots: create, view, edit, delete
- Slot-classes: assign section + subject + 1-2 volunteers
- All scheduling validation rules (no overlaps, vol1 ≠ vol2, no double-booked volunteer, etc.)
- Move volunteer between slot-classes

**Out of scope:** Year progression (M5), real-time sync (M5).

### M5 — Google OAuth + admin operations

**Production goal:** Users can sign in with Google. Admins can monitor sync health and run year progression.

**In scope:**
- Google OAuth login (resurrects the F01a work that was paused)
- Webhook-based real-time sync (replaces or supplements the scheduled pull from M1)
- Sync health admin dashboard
- Manual sync trigger
- Year progression flow

**Why this is M5:** Each piece here has architectural complexity that we've explicitly chosen to defer. Google OAuth has PKCE, hosted-domain considerations, library choices. Webhooks have idempotency and retry semantics. Year progression has irreversibility risk. By M5, the rest of the product is stable in production and these can ship without blocking core CO workflows.

## Working with milestones

**At the start of each milestone:**
- Open the milestone's doc (`docs/milestones/MX.md`)
- Confirm the scope is still right (push back if reality has changed)
- Build days: 8-10 working days
- Stabilize days: last 3-4 days

**During the milestone:**
- Use Claude Code plan mode for implementation work
- Come to chat only when stuck on architecture or scope
- Update the milestone doc's "Done log" as work completes

**At the end of each milestone:**
- All "Definition of production ready" boxes checked
- Update this file's status table
- Brief retrospective: what went faster than expected, what hit blockers, what to carry into the next milestone
- Decide: ship as-is, or one extra day of fixes, or something needs to slip to next milestone

**Don't add scope mid-milestone.** If a need surfaces, write it down and address it in the next milestone planning. The 2-week box is a forcing function for "what really matters."

## What survived from earlier planning

These docs are still authoritative. Read them when relevant:
- `BUSINESS_RULES.md` — every non-negotiable rule
- `GLOSSARY.md` — terms (CO, CHO, slot, slot-class, etc.)
- `ARCHITECTURE.md` — how the system fits together
- `DECISIONS.md` — past architectural decisions
- `UI_REFERENCE.md` — visual system

These are deprecated:
- `FEATURE_PLAN.md` (replaced by this file)
- `FEATURE_TEMPLATE.md` (replaced by per-milestone feature notes)
- `PROGRESS.md` (folded into each milestone's done log)
- `F01a-google-oauth-login.md` and `F01b-password-authentication.md` (auth work re-scoped under M1 password and M5 Google)

## What's already built and lives in M1

State of code as of milestone restart:
- Schema renamed to `mad_sessionops_dev`
- `SoftDeleteBaseModel` and `User`/`UserAuth` models match the multi-auth schema
- 4605 users already in the DB from prior work
- F01a auth services (`role_helpers`, `complete_google_login`, `refresh_access_token`, `logout`, exceptions) are built and tested — but Google-side flow is paused
- API endpoints `/api/auth/google/callback`, `/refresh`, `/logout`, `/me` exist; Google callback is dead code until M5

M1 reuses the schema, role helpers, JWT services, refresh, logout, /me. Adds password endpoints. Removes the Google callback from M1 routing (or leaves it disabled — we decide in the M1 doc).