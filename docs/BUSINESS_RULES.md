# Business Rules

Every rule in this file is non-negotiable. Each one has business rationale. If you think a rule is wrong, raise it with the human before writing code that violates it — don't work around it.

Rules are enforced at the **service layer** (Python), not at the DB layer, unless noted. This is deliberate: DB constraints can't encode "active" or "soft-deleted" cleanly, and application-layer enforcement gives us better error messages.

## Capacity and composition

### R1 — Maximum 5 children per section

**Rule:** A section may have at most 5 active children at any time. Soft-deleted children don't count toward the limit.

**Rationale:** MAD's pedagogy requires small-group instruction. 5 is the researched cap for volunteer-led sessions.

**Enforcement:** Service layer, before `Child.is_active=True` is set on create or reactivate. Raise `ConflictError` with a specific message.

**DB-level:** Not enforceable cleanly (partial index on `is_active` would work but creates migration friction we don't want).

---

### R2 — Section must have 1 to 2 volunteers per slot-class

**Rule:** When scheduling a volunteer to teach a section in a slot, at least 1 volunteer must be assigned; at most 2 may be assigned.

**Rationale:** Solo volunteers burn out; 3+ volunteers is inefficient and dilutes instruction quality.

**Enforcement:** Service layer on slot-class creation and update. `Vol1` is required, `Vol2` is optional.

---

### R3 — Vol1 must not equal Vol2

**Rule:** In a slot-class, the same volunteer cannot be assigned as both primary and secondary.

**Rationale:** Obvious. A person isn't two people.

**Enforcement:** Schema-level (Pydantic validator) + service layer.

## Volunteer assignment

### R4 — One volunteer belongs to exactly one school

**Rule:** A volunteer may have active assignments at only one school at any time.

**Rationale:** Volunteers commit per-school. MAD doesn't support cross-school volunteering due to scheduling and accountability.

**Enforcement:** Service layer on `SchoolVolunteer` create. Query: is there any other `SchoolVolunteer` where `volunteer_id=X AND is_active=True`? If yes, raise `ConflictError`.

**Edge case:** A volunteer moving between schools requires the old assignment to be deactivated first. The service exposes a `transfer_volunteer` flow that does both in a single transaction.

---

### R5 — Same section cannot appear twice in the same slot

**Rule:** Within one slot, each section can be scheduled at most once.

**Rationale:** A section is one group of children in one place. They can only be taught one thing at a time.

**Enforcement:** Service layer on slot-class create. Unique-together at the DB level is acceptable here as a belt-and-suspenders check, but soft-delete makes it awkward — primary enforcement is Python.

---

### R6 — Same volunteer cannot be in two slot-classes in the same slot

**Rule:** If a slot has multiple slot-classes running in parallel, a single volunteer can be in at most one of them.

**Rationale:** A volunteer teaches one section at a time.

**Enforcement:** Service layer, checked against both `Vol1` and `Vol2` fields on all slot-classes in the same slot.

## Scheduling integrity

### R7 — No overlapping slots for the same school on the same day

**Rule:** Two slots at the same school on the same date must not have overlapping time ranges.

**Rationale:** MAD's school partnerships allocate specific time windows. Overlaps mean double-booking resources or staff.

**Enforcement:** Service layer on slot create and update. Query all active slots for `(school, date)` and check for interval overlap.

## Academic year

### R8 — Exactly one academic year is globally active

**Rule:** At all times, exactly one `AcademicYear` row has `is_active=True`. All schools operate under this year.

**Rationale:** MAD runs a unified academic calendar. Per-school years were considered and rejected — too much divergence, too complex for reporting.

**Enforcement:** Service layer on year progression transitions. The flip is atomic (old year deactivated + new year activated in one transaction).

**Denormalization:** `School.active_year` is a convenience field. When `AcademicYear.is_active` flips, a background task updates `School.active_year` for all schools. This denormalization is accepted for read performance.

## Soft delete

### R9 — No hard deletes anywhere — enforced at two layers (Layer 3 deferred)

**Rule:** No model in the domain layer ever has a row removed. Deactivation is via `is_active=False`, recorded with `deleted_at` and (when known) `deleted_by`.

**Rationale:** Audit trail. Mistake recovery. Retrospective analytics. Regulatory expectations for an organization working with children.

**Enforcement is layered. Two layers are active in v1; a third layer is deferred for future.**

**Layer 1 — Application code (active):**
- Every domain model inherits from `SoftDeleteBaseModel` (or implements its pattern directly, as User does).
- `delete()` sets `is_active=False`, records audit fields, never issues SQL DELETE.
- `hard_delete()` always raises `NotImplementedError`. Anyone who actually wanted a hard delete cannot get one accidentally.
- Custom managers filter `is_active=True` by default. Use `.all_with_deleted()` to see soft-deleted rows.

**Layer 2 — Foreign key cascades blocked (active):**
- Every FK uses `on_delete=models.PROTECT`.
- This means: even if Layer 1 were bypassed, deleting a parent row would fail because of dependent children.
- PROTECT is the explicit "this hard-delete is not allowed" signal in the schema.

**Layer 3 — Database user permissions (deferred):**
- The original plan was to run the Django app as `sessionops_app_user` with no DELETE permission, ensuring even raw SQL deletes via app connections fail.
- Deferred to keep early development momentum. Single DB user is used in v1.
- If/when Layer 3 is added: create restricted user, grant only SELECT/INSERT/UPDATE on `mad_sessionops_<env>` schema, switch Django's `DBUSER` env var. ~30 minutes of work; no migration needed.

**Risk acknowledged by deferring Layer 3:** A queryset `delete()` call (e.g., `Model.objects.filter(...).delete()`) bypasses the model's `delete()` override and issues SQL DELETE. With Layer 3, this would fail at the DB. Without Layer 3, it succeeds and silently removes rows. Mitigations:
- Code review checks for `.delete()` calls on querysets
- The `SoftDeleteBaseModel.delete()` override on individual instances catches most usage
- Layer 2 (PROTECT) blocks cascades, so a single bad delete won't propagate

**Exceptions to no-hard-delete (deliberate, infrastructure-level):**
- `RefreshTokenBlacklist` (from `simplejwt`) — internal token management, hard-delete is fine
- Celery result rows, cache entries — infrastructure
- `EmailRateLimit` rows — insert-only audit; no deletion mechanism in v1, may add periodic pruning later

Domain models — User, UserAuth, Partner, School, Class, Section, Volunteer, Child, Slot, etc. — never get hard-deleted under any circumstance.

**Note on PasswordResetToken:** Despite being short-lived data, password reset tokens follow the no-hard-delete rule via the **one-row-per-user UPDATE-in-place** pattern. A user has exactly one PasswordResetToken row that is overwritten on each new reset request. The row stays for audit; the token within is consumed or rotated.

**What "deletion" means for users in practice:**
- "Delete a child" → `child.is_active=False`, record `deleted_at`, `deleted_by`, mandatory `removed_reason` (R10)
- "Remove a volunteer from school" → soft-delete the SchoolVolunteer row; the Volunteer record remains
- "Deactivate a user" (HR offboarding) → `user.is_active=False` (typically via Hasura sync)

**If hard-delete is ever genuinely needed:** explicit migration, reviewed, run manually. Never a runtime code path.

### R10 — Removal reason is mandatory when deactivating a child

**Rule:** Setting `Child.is_active=False` requires `removed_reason` to be set in the same operation. It cannot be null, empty, or whitespace-only.

**Rationale:** Attrition analysis. MAD tracks why children leave (moved, illness, dropout, graduated, etc.) for program improvement.

**Enforcement:** Service layer method `deactivate_child(child_id, reason, user)`. No direct model access should bypass this.

**Note:** Other models (volunteers, slots, sections) may have optional removal reasons — only `Child` has it as mandatory.

## Authentication and access

### R11 — Academic Support and Fellow roles have no Session-Ops login

**Rule:** Users with `role='academic_support'` or `role='fellow'` exist in the User model (they sync from Hasura) but cannot authenticate to Session-Ops.

**Rationale:** Session-Ops is an operational tool for COs, CHOs, and admins. Academic support and fellows consume outputs elsewhere.

**Enforcement:** Auth service rejects login attempts from these roles with a generic "authentication failed" response. Do NOT distinguish "role not allowed" from "bad credentials" — that leaks role information.

---

### R12 — Deactivated users cannot authenticate

**Rule:** Users with `is_active=False` cannot log in or refresh tokens. Existing tokens they hold are rejected.

**Rationale:** When a user leaves MAD, immediate access revocation without having to delete the user row.

**Enforcement:** JWT middleware filters `is_active=True` in the User lookup. Deactivation doesn't invalidate existing tokens instantly (JWTs are stateless), but tokens fail validation on next request because the lookup returns nothing.

**Response:** Generic 401, same as any other auth failure. Do not leak "account disabled."

## Data integrity

### R13 — Scope filtering is default, bypass is explicit

**Rule:** Every queryset in service code defaults to filtering by the caller's RBAC scope. Admins bypassing scope must do so via an explicit method (`all_schools()`, `all_users()`), never by accident.

**Rationale:** Easier to audit explicit bypasses than to hunt for missing filters.

**Enforcement:** Service query helpers. Reviewers check that no view calls a raw `.objects.all()` on a scope-sensitive model.

---

### R14 — Admission numbers are unique within a school

**Rule:** `Child.admission_number` must be unique across all children (including soft-deleted) within the same school.

**Rationale:** Admission numbers are school-issued and don't get reused. They're how MAD matches children across systems.

**Enforcement:** DB unique constraint on `(school_id, admission_number)`. Service layer pre-check for a friendlier error.

---

### R15 — Guardian phone numbers are stored in E.164

**Rule:** Phone numbers stored on `Child.guardian_phone` and related fields are normalized to E.164 format (`+91...`). Input validation converts common Indian formats (10-digit, with/without +91, with spaces/dashes) to E.164.

**Rationale:** Integration-friendly. Enables deduplication and messaging without downstream normalization.

**Enforcement:** Pydantic schema validator on input; DB stores the normalized form.

## Operational

### R16 — Hasura sync events are idempotent

**Rule:** Replaying a Hasura webhook event must produce the same state as processing it once.

**Rationale:** Hasura retries failed webhooks. Non-idempotent handlers cause duplicates and bad data.

**Enforcement:** Sync tasks use upsert patterns keyed on Hasura IDs, not blind inserts. Tests verify replay.

---

### R17 — Year progression is irreversible once committed

**Rule:** Once `AcademicYear.is_active` flips, rollback requires manual DB intervention. The UI provides a dry-run preview before commit.

**Rationale:** Thousands of rows change atomically. Undoing is impractical.

**Enforcement:** Two-step UI: preview → confirm. Backend exposes `preview_progression()` and `commit_progression()` as separate service calls.

---

## Conventions, not rules

These are strong defaults but not quite as load-bearing. Violate only with reason.

- All timestamps are stored in UTC. Display conversion happens on the frontend.
- All money fields (if any appear later) are integer paise/cents, not float rupees/dollars.
- All enum values are lowercase snake_case strings stored as CharField with choices, not Django enum types (simpler migrations).
- Serializer field names match model field names exactly unless there's a specific reason to rename.