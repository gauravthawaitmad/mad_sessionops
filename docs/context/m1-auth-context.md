# M1 Context — F-M1-1 + F-M1-2

**Date:** 2026-04-29
**Features:** F-M1-1 (Password auth) + F-M1-2 (Hasura sync)
**Status:** Both complete. F-M1-1: 20/20 tests passing. F-M1-2: 12/12 tests passing.

---

## What was built in this session

### Backend

#### Bugs fixed
| File | Issue | Fix |
|------|-------|-----|
| `sessionops/models/user_auth.py` | `auth_service.py` called `find_by_google_sub()` / `find_by_password_login()` which didn't exist | Added aliases pointing to existing `find_google_auth()` / `find_password_auth()` |
| `sessionops/models/user_auth.py` | `create_password_auth()` and `create_google_auth()` were missing class methods | Added both as classmethods |
| `sessionops/services/auth_service.py` | Used `deleted=False` filter (field doesn't exist; model uses `is_active` via soft-delete manager) | Removed `deleted=False` from `register_with_password` and `change_password` |
| `sessionops/services/auth_service.py` | Inactive users could log in (no `user.is_active` check) | Added `is_active` guard in `login_with_password` |

#### New files
| File | Purpose |
|------|---------|
| `sessionops/models/password_reset_token.py` | Single-use reset tokens, 30-min expiry, `consume()` method |
| `sessionops/services/email_service.py` | Brevo HTTP API wrapper: `send_password_reset_email`, `send_welcome_set_password_email` |
| `sessionops/migrations/0004_add_password_reset_token.py` | Migration for `PasswordResetToken` |
| `sessionops/tests/features/m1/test_f_m1_1_password_auth.py` | 20 test cases, all passing |

#### Modified files
| File | Change |
|------|--------|
| `sessionops/routes.py` | Replaced F01a-only `api/auth.py` import with comprehensive `api/auth_api.py` |
| `sessionops/api/auth_api.py` | Added 3 new endpoints: `POST /password/forgot`, `POST /password/reset`, `POST /password/set` |
| `sessionops/schemas/auth.py` | Added `ForgotPasswordSchema`, `ResetPasswordSchema`, `SetPasswordSchema` |
| `sessionops/schemas/__init__.py` | Exported new schemas |
| `sessionops/models/__init__.py` | Exported `PasswordResetToken` |
| `sessionops/services/auth_service.py` | Added `request_password_reset`, `reset_password`, `set_password_first_time` methods |

#### Active API endpoints (all under `/api/auth/`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/register` | public | Email+password registration |
| POST | `/login` | public | Email+password login |
| POST | `/google/oauth/callback` | public | Google OAuth (M5) |
| POST | `/refresh` | public | Refresh access token |
| GET | `/me` | JWT | Current user profile |
| PUT | `/me` | JWT | Update profile |
| POST | `/logout` | JWT | Blacklist refresh token |
| POST | `/password/forgot` | public | Send Brevo reset email |
| POST | `/password/reset` | public | Consume token, set new password |
| POST | `/password/set` | JWT | First-time password for Hasura-synced users |
| POST | `/password/change` | JWT | Change existing password |

---

### Frontend

#### Bugs fixed
| File | Issue | Fix |
|------|-------|-----|
| `lib/api/services/auth.service.ts` | `refreshToken` called `/auth/refresh-token` | Fixed to `/auth/refresh` with key `refresh_token` |
| `lib/api/services/auth.service.ts` | `logout` sent no body | Added `refresh_token` in request body |
| `lib/api/services/auth.service.ts` | `forgotPassword` called `/auth/forgot-password` | Fixed to `/auth/password/forgot` |
| `lib/api/services/auth.service.ts` | `resetPassword` called `/auth/reset-password` | Fixed to `/auth/password/reset` |
| `lib/api/services/auth.service.ts` | `changePassword` used non-existent `data.oldPassword` | Fixed to `data.currentPassword` |
| `lib/api/client.ts` | Refresh interceptor used `/refresh-token` URL | Fixed to `/auth/refresh` |
| `lib/redux/features/auth/authSlice.ts` | `logoutUser` thunk sent no refresh token | Passes `state.auth.refreshToken` to service |
| `hooks/useAuth.ts` | Post-login redirect went to `/dashboard` (route doesn't exist) | Changed to `/home` |

#### New files
| File | Purpose |
|------|---------|
| `app/forgot-password/page.tsx` | Forgot password page (public route) |
| `app/reset-password/page.tsx` | Reset password page, reads `?token=` from URL (public route) |
| `app/set-password/page.tsx` | Set password page for Hasura-synced users (JWT-protected) |
| `components/auth/ForgotPasswordForm/ForgotPasswordForm.tsx` | Form: email → success message |
| `components/auth/ResetPasswordForm/ResetPasswordForm.tsx` | Form: new password + confirm, posts token |
| `components/auth/SetPasswordForm/SetPasswordForm.tsx` | Form: new password + confirm, JWT-protected |

#### Modified files
| File | Change |
|------|--------|
| `proxy.ts` | Added `/forgot-password` and `/reset-password` as public routes |

---

## Environment variables required
```
# Brevo (transactional email)
BREVO_API_KEY=your_brevo_v3_api_key
BREVO_FROM_EMAIL=noreply@sessionops.makeadiff.in
BREVO_FROM_NAME=Session-Ops

# Frontend URL (used in reset email link)
FRONTEND_URL=https://sessionops.makeadiff.in
```

---

## Test file location
```
mad_sessionops_backend/sessionops/tests/features/m1/test_f_m1_1_password_auth.py
```
20 test cases, all passing as of 2026-04-29.

---

## What's NOT done yet (next sessions)
- F-M1-3: RBAC scope filtering (CO sees own schools, admin sees all)
- F-M1-4: School list page
- F-M1-5: School detail page (Overview tab)

---

## Key decisions made (F-M1-1)
- `PasswordResetToken` is never hard-deleted (audit trail). Old tokens accumulate.
- Forgot-password endpoint always returns 200 even for unknown emails (prevents enumeration).
- `set_password_first_time` raises `PASSWORD_ALREADY_SET` if user already has password auth — use change-password instead.
- Brevo API called synchronously (no Celery yet — Celery comes in M5). If Brevo is down, the request fails with 500. Acceptable for M1.
- The Google OAuth callback endpoint stays in code but is removed from M1 routing — it will be activated in M5.

---

## F-M1-2 — Hasura Sync

### New files
| File | Purpose |
|------|---------|
| `sessionops/models/partner.py` | `Partner` model — school data synced from Hasura |
| `sessionops/models/sync_run.py` | `SyncRun` model — insert-only audit log per sync run |
| `sessionops/services/hasura/client.py` | `fetch_users()`, `fetch_partners()`, `HasuraError` |
| `sessionops/services/sync.py` | `run_sync(progress=None)` — upserts users + partners |
| `sessionops/management/commands/sync_hasura.py` | `python manage.py sync_hasura` |
| `sessionops/migrations/0005_f_m1_2_partner_syncrun_synced_at.py` | Migration |
| `sessionops/tests/features/m1/test_f_m1_2_hasura_sync.py` | 12 tests, all passing |

### Modified files
| File | Change |
|------|--------|
| `sessionops/models/user.py` | Added `synced_at` field (tracks last Hasura refresh per user) |
| `sessionops/models/__init__.py` | Exported `Partner`, `SyncRun` |

### Env vars required
```
HASURA_API_BASE_URL=https://hasura.makeadiff.in
HASURA_API_JWT=<long-lived service JWT>
```

### Key decisions (F-M1-2)
- Upsert key for users is `user_id` (not `user_login`). Prior bulk import used `user_login` as key — on collision, the existing row is updated to use the canonical Hasura `user_id` (IntegrityError fallback with `transaction.atomic()` savepoint).
- Sync does NOT touch `User.is_active`. A user disappearing from Hasura response is not deactivated locally (M5 addresses this).
- `Partner.all_objects` is an unfiltered manager — needed to find soft-deleted rows for re-activation.
- `crm_partner_removed=true` → `is_active=False` on Partner; false → re-activate.
- `run_sync()` accepts an optional `progress` callback (e.g. `self.stdout.write`) for real-time CLI output.
- `SyncRun` does not inherit `SoftDeleteBaseModel` — it's an immutable audit trail.
