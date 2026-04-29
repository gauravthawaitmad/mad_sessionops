# Session-Ops Architecture

How the system is put together. Read this before any task that crosses more than one module.

## System diagram (prose)

Session-Ops is a two-repo system with one external dependency:┌──────────────────────┐         ┌──────────────────────┐
│  mad-sessionops-     │  HTTPS  │  mad-sessionops-     │
│  frontend            │◄───────►│  backend             │
│  (Next.js 16)        │   JWT   │  (Django + Ninja)    │
└──────────────────────┘         └──────────┬───────────┘
│
┌─────────────────┼─────────────────┐
│                 │                 │
▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ PostgreSQL   │  │  Redis       │  │  Hasura      │
│ (AWS RDS)    │  │  (broker)    │  │  (external)  │
└──────────────┘  └──────┬───────┘  └──────┬───────┘
│                 │
▼                 │ webhook
┌──────────────┐         │
│ Celery       │◄────────┘
│ worker+beat  │
└──────────────┘

## Actors and their flows

Three actor categories touch Session-Ops:

- **CO (City Officer)** — full-time or part-time. Manages schools assigned to them. 80% of daily usage.
- **CHO (Chief Operating Officer)** — oversight role. Sees schools where they have an active volunteer assignment.
- **Admin / Functional Lead / Project Associate** — god-mode. See everything, including sync health and year progression.
- **Academic Support / Fellow** — exist in the user model but **have no login to Session-Ops.** They are referenced in scheduling but do not authenticate.

See `docs/RBAC.md` (Sprint 2) for the full permission matrix.

## Request lifecycle (typical write)

Example: a CO enrolls a child into a section.
Frontend sends POST /api/schools/{id}/sections/{id}/children
with JWT access token in Authorization header.

Ninja middleware (sessionops/auth.py) decodes JWT, looks up
User by id, filters is_active=True. Attaches user to request.auth.
Raises AuthenticationError if any step fails.

RBAC guard on the endpoint checks:

User role is in {co_full_time, co_part_time, admin, fellow-admin}
If CO, partner.co_id == request.auth.id for the school
Raises PermissionDenied if not.



Endpoint parses body into ChildCreateSchema (Pydantic v2).

Endpoint calls services.children.enroll_child(
user=request.auth, section_id=..., payload=...
).

Service enforces business rules:

Section is_active=True, not soft-deleted
Section has < 5 active children
Child.admission_number is unique within school
Guardian phone matches E.164 pattern
Raises ValidationError or ConflictError if any fail.



Service creates Child in a transaction, logs audit trail,
returns the created instance.

Endpoint serializes via ChildReadSchema, returns 201.


The key invariant: **business rules live in the service (step 6).** The view doesn't know about them. The model stores data but doesn't enforce rules beyond what a DB constraint can express.

## Where logic lives

| Layer | Responsibility | Never does |
|-------|----------------|------------|
| `api/` (Ninja routers) | Parse input, call service, return output | Business rules, DB queries beyond `get_object_or_404` |
| `schemas/` (Pydantic) | Shape validation, field-level validation | Cross-record rules (uniqueness, counts, relationships) |
| `services/` | All business rules, all multi-step transactions, all cross-model validation | HTTP concerns (status codes, headers) |
| `models/` | Data shape, relationships, simple field validators | Uniqueness across other tables, role-based filtering |
| `tasks/` (Celery) | Async work: sync, notifications, year progression | Anything synchronous a user is waiting on |

If you find yourself writing business logic in a router, stop and move it to a service. If you find a service doing HTTP-specific things (building response objects, setting status codes), stop and move that back to the router.

## Authentication flow

**Login path (new session):**
Frontend initiates Google OAuth PKCE flow.
User authenticates with Google. Browser returns to frontend
/auth/callback with authorization code.
Frontend POSTs code + code_verifier to
/api/auth/google/callback on backend.
Backend exchanges code with Google, gets id_token + user info.
Backend finds/creates User by Google email, issues JWT
access + refresh pair.
Backend returns JWT pair + user profile.
Frontend stores tokens in redux-persist and the access_token
cookie (for middleware).


**Request path (authenticated):**
Frontend attaches Authorization: Bearer <access> to request.
Ninja middleware decodes, verifies signature, checks exp,
looks up User.
If access expired, Axios interceptor on frontend:
a. Queues the failed request
b. POSTs to /api/auth/refresh with refresh token
c. On success, retries queued requests with new access
d. On failure, logs user out and redirects to /login


**Logout:** backend blacklists the refresh token (simplejwt's token_blacklist app). Frontend clears Redux state and the cookie.

## RBAC enforcement

Two layers of enforcement, both required:

**Layer 1 — Endpoint-level role guard.** Every endpoint declares which roles can call it via a decorator (implemented in Sprint 2). Unauthorized role → 403.

**Layer 2 — Object-level scope filtering.** Within an authorized role, the queryset is filtered to the user's scope:

- `admin`, `functional_lead`, `project_associate` → all schools
- `co_full_time`, `co_part_time` → schools where `partner.co_id == user.id`
- `cho` → schools where an active `SchoolVolunteer` record exists for this user

This filtering lives in service layer query helpers, not in raw views. See `docs/RBAC.md` (Sprint 2) for the helper contract.

## Hasura sync (Sprint 6)

External users and partners sync from a Hasura source of truth via webhooks:Hasura (event) → webhook → /api/webhooks/hasura (backend endpoint)
→ validates HMAC signature
→ enqueues Celery task (sessionops.tasks.sync.handle_hasura_event)
→ returns 200 immediatelyCelery worker picks up task:
→ parses event (INSERT / UPDATE / DELETE)
→ applies to local User / Partner / etc.
→ writes SyncLog row with status
→ on failure, retries with exponential backoff up to N times
→ on permanent failure, marks SyncLog failed and surfaces to admin UI

Invariants:

- The webhook endpoint returns 200 within ~500ms regardless of processing outcome. Long work is always async.
- Tasks are idempotent. A replayed event produces the same state.
- Deletes from Hasura translate to soft-deletes in Session-Ops, never hard deletes.
- Admin dashboard surfaces sync failures with enough context to manually recover.

Full detail in `docs/HASURA_SYNC.md` (Sprint 6).

## Year progression (Sprint 7)

Once a year, an admin runs the year-progression pipeline:
Admin triggers progression from admin UI
Backend creates new AcademicYear row, sets is_active=False initially
Celery task iterates schools:

Advances each Class to next grade level
Rolls Sections forward (new sections created, old marked completed)
Decides child disposition per policy (graduated / continuing / dropped)
Archives old slots


Admin reviews a preview report
On approval, task flips new AcademicYear.is_active=True and old to False
All downstream queries immediately see the new year


This is a dangerous operation. It happens once a year. It has its own dedicated feature doc (`docs/features/F08-year-progression.md`) when Sprint 7 approaches.

## Deployment (brief)

Production deploys directly to EC2 (no containers). Rough plan:

- Git pull to deploy directory
- `uv sync --frozen` to install deps
- `python manage.py migrate` with a dedicated migration user
- `systemctl restart sessionops-web sessionops-worker sessionops-beat`
- Nginx in front, terminates TLS, reverse-proxies to gunicorn

Details live in ops runbooks, not in this repo.

## What this architecture is NOT

- **Not microservices.** One Django app, one deployable. Services are Python modules, not network boundaries.
- **Not event-sourced.** Celery tasks are for async work, not domain events. State lives in Postgres rows.
- **Not multi-tenant in the SaaS sense.** All data is MAD's. Schools are not tenants; they're domain entities.
- **Not real-time.** No WebSockets, no long-polling. Plain HTTP request/response.