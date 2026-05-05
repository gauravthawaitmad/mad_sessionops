# M1 Complete — Auth + School Visibility

**Date completed:** 2026-05-05
**Status:** All 5 features done. Backend 59/59 tests green. Frontend 8/8 tests green.
**Remaining:** Production deploy (EC2, nginx, certbot, prod DB, cron entry).

---

## Summary of what was built

| Feature | Status | Backend tests | Frontend tests |
|---|---|---|---|
| F-M1-1 Password auth | ✅ Complete | 20/20 | — |
| F-M1-2 Hasura sync | ✅ Complete | 12/12 | — |
| F-M1-3 RBAC scope filtering | ✅ Complete | 13/13 | — |
| F-M1-4 School list page | ✅ Complete | 8/8 | 4/4 |
| F-M1-5 School detail page | ✅ Complete | 6/6 | 4/4 |

---

## F-M1-1 — Password Authentication

### What it does
- `POST /api/auth/password/login` — email + password → JWT pair
- `POST /api/auth/password/forgot` — sends Brevo reset email (always 200, no enumeration)
- `POST /api/auth/password/reset` — consumes token, sets new password
- `POST /api/auth/password/set` — JWT-protected, first-time password for Hasura-synced users

### Backend — new files

| File | Purpose |
|---|---|
| `sessionops/services/email_service.py` | Brevo HTTP API wrapper — `send_password_reset_email`, `send_welcome_set_password_email` |
| `sessionops/migrations/0004_add_password_reset_token.py` | Adds `PasswordResetToken` table |
| `sessionops/migrations/0008_password_reset_token_invalidation_reason.py` | Adds `invalidation_reason` field (consumed / superseded) |
| `sessionops/tests/features/m1/test_f_m1_1_password_auth.py` | 20 tests — all green |

### Backend — modified files

| File | Change |
|---|---|
| `sessionops/models/user_auth.py` | Added `find_by_google_sub` / `find_by_password_login` aliases; added `create_password_auth` / `create_google_auth` class methods |
| `sessionops/services/auth_service.py` | Added `request_password_reset`, `reset_password`, `set_password_first_time`; fixed `deleted=False` → `is_active` filter; added inactive-user guard on login |
| `sessionops/api/auth_api.py` | Added `POST /password/forgot`, `POST /password/reset`, `POST /password/set` endpoints |
| `sessionops/schemas/auth.py` | Added `ForgotPasswordSchema`, `ResetPasswordSchema`, `SetPasswordSchema` |
| `sessionops/schemas/__init__.py` | Exported new schemas |
| `sessionops/models/__init__.py` | Exported `PasswordResetToken` |
| `sessionops/routes.py` | Replaced F01a-only `api/auth.py` with comprehensive `api/auth_api.py` |

### PasswordResetToken model

```python
class PasswordResetToken(SoftDeleteBaseModel):
    user           = OneToOneField(User, on_delete=PROTECT, related_name="password_reset_token")
    token_hash     = CharField(max_length=64, db_index=True)   # SHA-256 hex
    expires_at     = DateTimeField()
    consumed_at    = DateTimeField(null=True, blank=True)
    requested_at   = DateTimeField()
    requested_ip   = GenericIPAddressField(null=True, blank=True)
    invalidation_reason = CharField(
        max_length=20, null=True, blank=True,
        choices=[("consumed", "Used by user"), ("superseded", "Voided by newer request")]
    )
    class Meta:
        db_table = "password_reset_token"
```

### Active auth endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | Email + password login |
| POST | `/api/auth/refresh` | public | Refresh access token |
| GET | `/api/auth/me` | JWT | Current user profile |
| POST | `/api/auth/logout` | JWT | Blacklist refresh token |
| POST | `/api/auth/password/forgot` | public | Send Brevo reset email |
| POST | `/api/auth/password/reset` | public | Consume token, set new password |
| POST | `/api/auth/password/set` | JWT | First-time password setup |
| POST | `/api/auth/google/callback` | public | Google OAuth — kept in code, not exposed in M1 (M5) |

### Frontend — new files

| File | Purpose |
|---|---|
| `app/forgot-password/page.tsx` | Forgot password page (public) |
| `app/reset-password/page.tsx` | Reset password page, reads `?token=` from URL (public) |
| `app/set-password/page.tsx` | First-time password setup (JWT-protected) |
| `components/auth/ForgotPasswordForm/` | Email input → success message |
| `components/auth/ResetPasswordForm/` | New password + confirm, posts token |
| `components/auth/SetPasswordForm/` | New password + confirm, JWT auth |

### Frontend — modified files

| File | Change |
|---|---|
| `lib/api/services/auth.service.ts` | Fixed `refreshToken` URL, `logout` body, `forgotPassword`/`resetPassword` endpoints, `changePassword` key |
| `lib/api/client.ts` | Fixed refresh interceptor URL `/refresh-token` → `/auth/refresh` |
| `lib/redux/features/auth/authSlice.ts` | `logoutUser` thunk now passes refresh token |
| `hooks/useAuth.ts` | Post-login redirect `/dashboard` → `/home` |
| `proxy.ts` | Added `/forgot-password`, `/reset-password` as public routes |

### Key decisions (F-M1-1)

- Forgot-password always returns 200 regardless of whether the email exists — prevents enumeration
- `PasswordResetToken` is never hard-deleted — keeps audit trail
- `invalidation_reason` distinguishes consumed (user used it) vs superseded (new link requested before old one expired)
- Brevo called synchronously — no Celery in M1; if Brevo is down, request fails 500 (acceptable)
- Google OAuth endpoint stays in code but is not exposed in M1 frontend routing

---

## F-M1-2 — Hasura Scheduled Sync

### What it does
- `python manage.py sync_hasura` — upserts all users + partners from Hasura REST API
- `python manage.py sync_users` — users only
- `python manage.py sync_partners` — partners only
- Runs every 6 hours via system cron in production
- Logs each run in `SyncRun` table with counts + status

### Backend — new files

| File | Purpose |
|---|---|
| `sessionops/services/hasura/client.py` | `fetch_users()`, `fetch_partners()`, `HasuraError` |
| `sessionops/services/sync.py` | `run_sync()` — creates SyncRun, upserts users + partners |
| `sessionops/management/commands/sync_hasura.py` | `python manage.py sync_hasura` (users + partners) |
| `sessionops/management/commands/sync_users.py` | Users-only targeted sync |
| `sessionops/management/commands/sync_partners.py` | Partners-only targeted sync |
| `sessionops/management/commands/set_user_password.py` | Dev utility — sets password auth for any synced user |
| `sessionops/migrations/0005_f_m1_2_partner_syncrun_synced_at.py` | Partner + SyncRun tables, `synced_at` on User |
| `sessionops/migrations/0006_syncrun_sync_type.py` | `sync_type` field on SyncRun (users / partners / all) |
| `sessionops/migrations/0007_remove_user_email_unique.py` | Removed unique constraint on `User.email` |
| `sessionops/tests/features/m1/test_f_m1_2_hasura_sync.py` | 12 tests — all green |

### Backend — modified files

| File | Change |
|---|---|
| `sessionops/models/user.py` | Added `synced_at` field |
| `sessionops/models/__init__.py` | Exported `Partner`, `SyncRun` |

### Partner model

```python
class Partner(SoftDeleteBaseModel):
    partner_id           = BigIntegerField(unique=True, db_index=True)
    partner_name         = CharField(max_length=255)
    co_id                = BigIntegerField(null=True, blank=True, db_index=True)  # no FK constraint (D024)
    co_name              = CharField(max_length=255, null=True, blank=True)
    address_line_1       = TextField(null=True, blank=True)
    # ... (city, state, pincode, school_type, partner_affiliation_type)
    poc_name / poc_email / poc_designation / poc_contact  = CharField fields
    mou_sign_date / mou_start_date / mou_end_date = DateField
    mou_url              = TextField(null=True, blank=True)
    crm_partner_removed  = BooleanField(default=False)
    confirmed_child_count / total_child_count / classes = raw counts
    partner_created_date / partner_updated_date / synced_at = DateTimeField
    class Meta:
        db_table = "partner"
```

### SyncRun model

```python
class SyncRun(models.Model):
    id           = BigAutoField(primary_key=True)
    started_at   = DateTimeField(auto_now_add=True, db_index=True)
    completed_at = DateTimeField(null=True, blank=True)
    status       = CharField(choices=[("running","Running"),("success","Success"),("failed","Failed")])
    sync_type    = CharField(choices=[("users","Users"),("partners","Partners"),("all","All")], default="all")
    users_fetched / users_created / users_updated = IntegerField
    partners_fetched / partners_created / partners_updated = IntegerField
    error_message = TextField(null=True, blank=True)
    class Meta:
        db_table = "sync_run"
```

### Cron entry (production)

```
# /etc/cron.d/sessionops-sync
0 */6 * * * sessionops cd /opt/sessionops && \
  /opt/sessionops/.venv/bin/python manage.py sync_hasura \
  >> /var/log/sessionops/sync.log 2>&1
```

### Key decisions (F-M1-2)

- `User.email` unique constraint removed — Hasura has duplicate emails in edge cases; upsert key is `user_id`
- `Partner.all_objects` is an unfiltered manager — needed to find soft-deleted rows for re-activation
- `crm_partner_removed=true` → `is_active=False`; false → re-activate
- Sync does NOT touch `User.is_active` — no deactivation signal from Hasura in M1 (M5 addresses)
- `user_id` from Hasura arrives as `"2273058.000000000"` — stripped and parsed to int
- `sync_type` field added so targeted commands (`sync_users`, `sync_partners`) produce distinct log entries

---

## F-M1-3 — RBAC Scope Filtering

### What it does
Server-side scope filtering applied to all school endpoints. Frontend cannot bypass.

### Scope rules

| Role | Schools visible |
|---|---|
| Function Lead, Project Lead, Project Associate, CXO | All partners (admin scope) |
| CO Full Time, CO Part Time | Where `partner.co_id == user.user_id` |
| CHO | None (empty queryset) |
| Other roles | Cannot log in (R11) |

### Backend — new files

| File | Purpose |
|---|---|
| `sessionops/services/rbac/__init__.py` | Package init |
| `sessionops/services/rbac/scope.py` | `schools_visible_to(user)` → queryset; `can_view_school(user, partner)` → bool |
| `sessionops/tests/features/m1/test_f_m1_3_rbac_scope.py` | 13 tests — all green |

### Key decisions (F-M1-3)

- CXO is treated as admin scope in M1 (hardcoded, not in `ADMIN_ROLES` from `role_helpers.py`)
- `can_view_school` returns False for CHO — all school detail requests from CHO get 404 (not 403, to avoid leaking existence)

---

## F-M1-4 — School List Page

### What it does
Landing page after login. Scope-filtered list of schools. Search (client-side, debounced 200ms). Sort by name/city/children/updated. Click row → school detail.

### Backend

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/schools/` | JWT | Scope-filtered list; `?search=` for name/city/state filter |

| File | Purpose |
|---|---|
| `sessionops/api/schools_api.py` | `GET /api/schools/` with RBAC scope + search |
| `sessionops/schemas/schools.py` | `SchoolListItemSchema`, `SchoolListResponseSchema` |
| `sessionops/tests/features/m1/test_f_m1_4_school_list.py` | 8 tests — all green |

### Frontend

| File | Purpose |
|---|---|
| `app/schools/page.tsx` | Route — reads user from Redux, renders `<SchoolListPage>` |
| `app/schools/layout.tsx` | AppShell wrapper |
| `components/schools/SchoolListPage.tsx` | Page component — owns search/sort state, fetches once on mount |
| `components/schools/SchoolToolbar.tsx` | Search input (debounced 200ms) + sort popover |
| `components/schools/SchoolTable.tsx` | Table grid with sticky header + scrollable body |
| `components/schools/SchoolTableRow.tsx` | Single row — memoized, `router.push` on click/Enter/Space |
| `components/schools/SchoolEmptyState.tsx` | Zero-schools state (shown when API returns empty list) |
| `components/schools/SchoolKpiStrip.tsx` | KPI metric cards above table |
| `lib/api/services/schools.service.ts` | `fetchSchools()` — maps snake_case API response to camelCase |
| `__tests__/schools/SchoolListPage.test.tsx` | 4 Vitest tests — all green |

### Layout details

- `SchoolListPage`: fixed-height flex column (`height: 100%`); title/metrics/toolbar in `flexShrink: 0` top section; table fills remaining height
- `SchoolTable`: sticky header, scrollable body (`flex: 1, overflowY: auto, minHeight: 0`), 10 skeleton rows at `height: 64px`
- `SchoolTableRow`: `height: ROW_H = 64` exact; `role="row"`, `tabIndex={0}`, keyboard accessible

### Key decisions (F-M1-4)

- Search is client-side (all schools fetched once on mount, filtered locally) — CO has ≤20 schools; no need for server search per keystroke
- `fetchSchools()` called once; no search params sent to backend
- Sort is also client-side in `sortSchools()` helper

---

## F-M1-5 — School Detail Page (Overview Tab)

### What it does
`/schools/[partnerId]` — shows full school info read-only. Sidebar with 6 workspace tabs (Overview active, 5 disabled). RBAC: CO sees only their school, admin sees all, CHO gets 404.

### Backend

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/schools/{partner_id}/` | JWT | Full Partner data; 404 if not found OR out of scope |

| File | Purpose |
|---|---|
| `sessionops/api/schools_api.py` | `get_school()` — 404 for out-of-scope (no 403, avoids leaking existence) |
| `sessionops/schemas/schools.py` | `SchoolDetailSchema` — all Partner fields + co_name + synced_at + config status + 4 metric counts |
| `sessionops/tests/features/m1/test_f_m1_5_school_detail.py` | 6 tests — all green |

### SchoolDetail response shape

```typescript
interface SchoolDetail {
  partnerId, partnerName,
  addressLine1, addressLine2, city, state, pincode,
  schoolType, partnerAffiliationType,
  pocName, pocEmail, pocDesignation, pocContact,
  mouSignDate, mouStartDate, mouEndDate, mouUrl,
  coId, coName,
  syncedAt, configurationStatus,   // configurationStatus = "awaiting_setup" in M1
  childrenCount, classesCount, volunteersCount, assignmentsCount  // all 0 in M1
}
```

### Frontend

| File | Purpose |
|---|---|
| `app/schools/[partnerId]/page.tsx` | Route — uses `use(params)` for Next.js 16 async params |
| `components/schools/SchoolDetailPage.tsx` | Full page component |
| `lib/api/services/schools.service.ts` | `fetchSchool(partnerId)` — maps raw API response |
| `__tests__/schools/SchoolDetailPage.test.tsx` | 4 Vitest tests — all green |

### SchoolDetailPage layout

- **Sidebar** (220px, sticky): "All schools" back link + 6 workspace tabs
  - Overview — active, enabled
  - Structure / Children / Volunteers / Slots / Calendar — disabled, `opacity: 0.45`, `cursor: not-allowed`, wrapped in MUI Tooltip ("Coming in a future milestone")
- **Right panel** (scrollable): sticky school header + Overview content
  - Header: school avatar (deterministic hash color), name, city/state, CO name
  - InfoStrip: horizontal pill row (location, school type, CO, MOU status)
  - StatCards: Children enrolled, Classes, Volunteers, Teaching sessions (all 0 in M1)
  - Sections: School Information, Point of Contact, MOU Details, Community Organizer
- **404 state**: AlertCircle icon + "School not found" + back link

### Key decisions (F-M1-5)

- 404 returned for out-of-scope schools (not 403) — prevents leaking existence
- `configurationStatus` hardcoded `"awaiting_setup"` in M1 — M2 computes it for real
- Metric counts (`children_count`, `classes_count`, etc.) added to response schema beyond original spec — used by StatCards in UI, return 0 in M1

---

## Database migrations (M1 total: 8)

| Migration | What it adds |
|---|---|
| 0001_initial | User, base schema |
| 0002_add_user_is_active | `User.is_active` |
| 0003_f01a_softdelete_base_and_userauth | `SoftDeleteBaseModel`, `UserAuth` |
| 0004_add_password_reset_token | `PasswordResetToken` table |
| 0005_f_m1_2_partner_syncrun_synced_at | `Partner`, `SyncRun`, `User.synced_at` |
| 0006_syncrun_sync_type | `SyncRun.sync_type` field |
| 0007_remove_user_email_unique | Removed unique constraint on `User.email` |
| 0008_password_reset_token_invalidation_reason | `PasswordResetToken.invalidation_reason` |

---

## Environment variables (full M1 set)

```bash
# Database
DBSCHEMA=mad_sessionops
DBNAME=mad_sessionops
DB_HOST=localhost
DB_PORT=5432
DB_USER=...
DB_PASSWORD=...

# Auth
JWT_SECRET_KEY=...
JWT_ACCESS_TOKEN_EXPIRY_HOURS=12
JWT_REFRESH_TOKEN_EXPIRY_DAYS=7

# Hasura sync (F-M1-2)
HASURA_API_BASE_URL=https://hasura.makeadiff.in
HASURA_API_JWT=<long-lived service JWT>

# Brevo email (F-M1-1)
BREVO_API_KEY=...
BREVO_FROM_EMAIL=noreply@makeadiff.in
BREVO_FROM_NAME=MAD Session-Ops

# Frontend URL (used in reset email link)
FRONTEND_URL=http://localhost:3000   # prod: https://sessionops.makeadiff.in

# Sentry
SENTRY_DSN=...
ENVIRONMENT=development
```

---

## Frontend test setup

```
mad_sessionops_frontend/
├── vitest.config.ts          ← jsdom env, @/ alias, setupFiles
├── vitest.setup.ts           ← @testing-library/jest-dom import
└── __tests__/
    └── schools/
        ├── SchoolListPage.test.tsx   ← 4 tests (F-M1-4)
        └── SchoolDetailPage.test.tsx ← 4 tests (F-M1-5)
```

Run: `npm test` (alias for `vitest run`)

---

## Implementation deviations from original M1 spec

| Spec | Actual | Why |
|---|---|---|
| `POST /api/auth/password/request-reset` | `POST /api/auth/password/forgot` | Matches frontend route naming |
| `POST /api/auth/password/set` (token flow) | `POST /api/auth/password/reset` | Distinguishes token reset from first-time set |
| `/auth/forgot-password` (frontend) | `/forgot-password` | Flat routing, no `/auth/` prefix |
| `/auth/set-password?token=` (frontend) | `/reset-password?token=` + `/set-password` (JWT) | Two separate pages for two separate flows |
| Post-login redirect → `/schools` | → `/home` | `/home` acts as a routing hub |
| `SchoolDetailSchema` — spec fields only | + `children_count`, `classes_count`, `volunteers_count`, `assignments_count` | Needed for StatCard metrics; all return 0 in M1 |

---

## Production deploy checklist (remaining)

- [ ] EC2 instance provisioned and accessible
- [ ] nginx configured to reverse-proxy backend (port 8000) and serve frontend
- [ ] Let's Encrypt certificate active for `sessionops.makeadiff.in`
- [ ] systemd services for backend (uvicorn) and frontend (Node PM2) running
- [ ] System cron installed: `0 */6 * * * python manage.py sync_hasura`
- [ ] Production database `mad_sessionops_prod` created with schema
- [ ] All production env vars set (separate JWT secret, prod Sentry DSN, prod Brevo keys)
- [ ] Migrations applied on prod DB
- [ ] First sync run completed — verify SyncRun table has a `status="success"` row
- [ ] One real CO signed in to production
- [ ] One real admin signed in to production
- [ ] CHO test user signs in, sees empty state with friendly message
- [ ] Sentry shows no error spikes in 24h post-deploy
- [ ] Rollback procedure documented (DB backup + git tag)
