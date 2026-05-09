# Glossary

Terms that matter in Session-Ops. When Claude Code uses the wrong word, bugs follow. Read this before modeling or naming anything.

## Organizational

**MAD** — Make A Difference. The nonprofit this platform serves. Appears in the org name but not in code unless in branding contexts.

**Partner** — A school-level business relationship with MAD. One partner has one school (for now). Partner holds the contract, the CO assignment, and high-level metadata. School holds the operational data.

**School** — A physical school where MAD runs programs. Belongs to a Partner. Has Classes, which have Sections.

**MAD roles** — A user's role in MAD's organization is stored as a comma-separated string in `User.user_role` (synced from Hasura). A single user may hold multiple roles. The role string drives access to Session-Ops.

**Allowed roles** (any one grants Session-Ops login):
- **CO Full Time** — Full-time Community Organizer. Manages assigned schools.
- **CO Part Time** — Part-time Community organizer. Same Session-Ops permissions as Full Time. The distinction is HR-internal.
- **CHO** — Chapter Organizer. Sees schools where they have an active volunteer assignment.
- **CXO** — CXO-level access. Treated as standard Session-Ops user (not admin).
- **Function Lead** — Grants admin scope. Sees all schools.
- **Project Associate** — Grants admin scope. Sees all schools.
- **Project Lead** — Grants admin scope. Sees all schools.

**Disallowed-alone roles** (never grant Session-Ops access on their own):
- **Academic Support** — MAD volunteer supporting academic content. No Session-Ops login.
- **Wingman** — Volunteer-adjacent role. No Session-Ops login.
- **Fellow** — MAD fellow. No Session-Ops login. (Note: "Fellow" appears in some scheduling UI as a non-volunteer who can teach — that's a separate concept from the role gate. A user with role `"Fellow"` alone cannot log in, but a slot may have a fellow assigned.)
- **Youth** — Youth program participant. No Session-Ops login.
- **Unassigned User** — Placeholder for users not yet assigned a real role. No login.

**Combination behavior:** A user's roles are evaluated together. If any single role is in the allowed list, the user can log in and gets the union of permissions from all their allowed roles. Disallowed roles in the string are ignored when paired with allowed roles.

**Admin scope:** A user has admin scope (sees all schools, all data) if any of their roles is one of: Function Lead, Project Associate, Project Lead. The boolean is computed at auth time and surfaced as `user.is_admin` in the API.

**CO** — Catch-all term in code and docs for users with role `CO Full Time` or `CO Part Time`. Both have identical Session-Ops permissions: scoped to schools where `partner.co_id == user.id`.

## Domain

**Class** — A grade level at a school. Example: "Class 5", "Class 6". A school has multiple classes.

**Section** — A subdivision of a class. Example: "5-A", "5-B". Has up to 5 active children. Max 5 is the hardest rule in the system.

**Child** — A student enrolled in a section. Has an child_id unique across table. Has an `is_active` flag and a `removed_reason` that is mandatory when set inactive.

**Volunteer** — An external person (not MAD staff) who teaches sections. Assigned to exactly one school. Has contact info and an onboarding record.

**School Volunteer** (`SchoolVolunteer`) — The join record between Volunteer and School. This is what "activates" a volunteer at a school. CHO access is computed from active SchoolVolunteer rows.

**Academic Year** — A MAD academic year. Exactly one is globally active at a time. Year progression is the annual operation that rolls everything forward.

**Session** — A teaching period at a school across a year. Has a date range and operating days. One School has one Session per Academic Year. Configures holidays, operating hours, etc.

**Holiday** — A date within a session when no teaching happens. Configured per school.

## Scheduling (the part everyone gets wrong)

These three terms are related but distinct. Getting them confused causes real bugs.

**Slot** — A time window at a school on a specific date. Example: "School X, 2026-05-14, 10:00–11:30". Slots don't say *what* is being taught — they're the empty container.

**Slot-Class** (`SlotClass`) — The assignment of a section + volunteer(s) to a slot. This is where scheduling becomes concrete: "In that slot, section 5-A is taught by Volunteer Priya (Vol1) and Volunteer Rahul (Vol2)". One slot has multiple slot-classes (multiple sections taught in parallel).

**Vol1 / Vol2** — The primary and secondary volunteers on a slot-class. Vol1 required, Vol2 optional. Rule: Vol1 ≠ Vol2.

**Rule of thumb:**
- "Slot" = when and where
- "Slot-class" = who teaches whom (within a slot)
- A slot has 0..N slot-classes
- A slot-class has 1 slot, 1 section, 1 or 2 volunteers

## State and lifecycle

**Active** — `is_active=True`. The record is in use. Default state.

**Inactive / Deactivated** — `is_active=False`. The record exists in the database but is not in use. Business rules ignore it (e.g., max-5-children counts only active).

**Soft-deleted** — `removed=True` and `is_active=false`. Same practical effect as deactivation. Field name varies by model for historical reasons:
- Most models: `is_active=False` and `removed=true` means deactivated

Treat both as the same concept. **There is no hard delete.**

**Removal reason** — Required text field when deactivating a child. Not required (but allowed) on other models.

**Soft-delete semantics in queries:** Default manager filters out deactivated rows. Use `Model.objects.all_with_deleted()` to see them (admin only). Do not use `._meta` or raw SQL to bypass.

## Auth

**JWT access token** — Short-lived (default 1 hour). Sent on every request in `Authorization: Bearer`.

**JWT refresh token** — Long-lived (default 1 day). Used to obtain a new access token. Can be blacklisted on logout.

**PKCE** — Proof Key for Code Exchange. The Google OAuth flow variant we use. Frontend generates a code verifier, sends its hash to Google, exchanges the returned code + original verifier for tokens. More secure than implicit flow for SPAs.

**Hasura** — External source of truth for User and Partner data. Sends webhooks to our backend on changes. We never push back to Hasura.

## Infrastructure

**RDS** — AWS Relational Database Service. Managed Postgres. We run in ap-south-1 (Mumbai) for latency.

**uv** — Python package manager. Replaces pip/poetry. We use `uv sync --frozen` for reproducible installs.

**justfile** — Command runner. Like Makefile but simpler syntax.

## Terms we do NOT use

To keep docs and code clean, **avoid** these terms. They're ambiguous or deprecated.

- "User" when you mean "CO" or "CHO" or "Admin" — be specific
- "Delete" when you mean "deactivate" — always say deactivate or soft-delete
- "Staff" — too vague, use the specific role
- "Teacher" — we have volunteers, fellows, and (maybe) academic support. Never "teacher"
- "Student" — we have children. The product calls them children.
- "Group" when you mean "section" — always say section
- "Class" when you mean "slot-class" — always say slot-class for scheduling, class for grade level
- "Madui" — old name of the module. It's `sessionops` now. Fix any reference you find.
- "Admin" as a literal role name — there is no role called "Admin" in MAD. Code that says "admin" is referring to *admin scope*, granted by Function Lead / Project Associate / Project Lead.