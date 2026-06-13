# Feature Plan: F-M4-5 — Sync User by Login

## Overview

Provides admins with the ability to manually re-sync a single user by their login (email). Admin clicks "Sync user by login" on the Data Sync tab, types an email, and submits. The backend fetches that user's record from Hasura's `user/by-login` endpoint, upserts it into Session-Ops, and logs the action as a `SyncRun` row with `sync_type=manual_single_user`. If the user is not found in Hasura, a 404 with a clear message is returned and no local data is touched. Concurrent sync blocks the request with a 409.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | Uses extended SyncRun from F-M4-4 |
| Backend services | New | `services/sync/single_user.py` |
| Backend services | Modified | `services/hasura/client.py` — add `fetch_user_by_login` |
| Backend API endpoints | New | `POST /api/v1/admin/sync/user-by-login/` (added to `admin_sync_api.py`) |
| Backend schemas | Modified | Add `SyncUserByLoginIn`, `SyncUserByLoginOut` to `schemas/sync_admin.py` |
| Frontend pages | None | |
| Frontend components | New | `SyncUserByLoginModal.tsx` |
| Frontend components | Modified | `DataSyncTab` — wire "Sync user by login" button |
| Database migrations | No | |
| Celery tasks | No | |
| Existing tests | None | |
| Documentation | No | |

## High-Level Design (HLD)

**Data flow:**
1. Admin clicks "Sync user by login" on Data Sync tab → `SyncUserByLoginModal` opens
2. Admin enters email → clicks Sync
3. `POST /admin/sync/user-by-login/` called with `{user_login: email}`
4. Service checks: not admin → 403; another sync running → 409
5. Service creates `SyncRun(sync_type="manual_single_user", entity_type="user", target_identifier=email, status="running")`
6. Calls `fetch_user_by_login(email)` → Hasura `GET /api/rest/user/by-login?user_login=email`
7. Not found → update run to failed, raise NotFound (404)
8. Found → upsert via existing `upsert_user_from_hasura` logic → update run to success
9. Returns: `{synced_user: {user_login, user_name}, sync_run_id}`
10. Frontend: toast success, modal closes, run list refreshes

**Concurrent sync guard:** Checks `SyncRun.objects.filter(status="running").exists()` before creating the run. Race condition window is small; acceptable for M4.

**Hasura endpoint:** `GET https://hasura.makeadiff.in/api/rest/user/by-login?user_login={email}` — returns `{user_data: [<user_obj>]}` or `{user_data: []}`.

## Low-Level Design (LLD)

### Backend

#### New service: `sessionops/services/sync/single_user.py`

```python
@transaction.atomic
def sync_user_by_login(user_login: str, triggered_by: User) -> dict:
    # 1. Admin check
    if not is_admin(triggered_by):
        raise PermissionDenied()

    # 2. Concurrent run check
    if SyncRun.objects.filter(status="running").exists():
        raise ConflictError("Another sync is already in progress. Please wait.")

    # 3. Create SyncRun (running)
    run = SyncRun.objects.create(
        sync_type="manual_single_user",
        entity_type="user",
        target_identifier=user_login,
        status="running",
        triggered_by=triggered_by,
    )

    try:
        # 4. Fetch from Hasura
        user_data = fetch_user_by_login(user_login)

        # 5. Not found
        if not user_data:
            run.status = "failed"
            run.error_details = f"No user found with login '{user_login}' in Hasura"
            run.completed_at = timezone.now()
            run.save()
            raise NotFound(f"No user found with login '{user_login}' in Hasura")

        # 6. Upsert
        upserted = upsert_user_from_hasura(user_data)

        # 7. Mark success
        run.status = "success"
        run.records_fetched = 1
        run.user_logins = [{"user_login": upserted.user_login, "user_name": upserted.user_name}]
        run.completed_at = timezone.now()
        run.save()

        return {"synced_user": upserted, "sync_run_id": run.sync_run_id}

    except (NotFound, PermissionDenied, ConflictError):
        raise  # already handled above
    except Exception as e:
        run.status = "failed"
        run.error_details = str(e)
        run.completed_at = timezone.now()
        run.save()
        raise
```

#### Modified service: `sessionops/services/hasura/client.py`

```python
def fetch_user_by_login(user_login: str) -> dict | None:
    """GET /api/rest/user/by-login?user_login=<email>"""
    response = requests.get(
        f"{settings.HASURA_API_BASE_URL}/api/rest/user/by-login",
        params={"user_login": user_login},
        headers={"x-hasura-jwt": settings.HASURA_API_JWT},
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    users = data.get("user_data", [])
    return users[0] if users else None
```

#### Modified schemas: `sessionops/schemas/sync_admin.py`

```python
class SyncUserByLoginIn(Schema):
    user_login: str  # email address

class SyncUserByLoginOut(Schema):
    sync_run_id: int
    user_login: str
    user_name: str
```

#### Modified API: `sessionops/api/admin_sync_api.py`

```python
@router.post("/admin/sync/user-by-login/", response={200: SyncUserByLoginOut}, auth=jwt_auth)
def sync_user_by_login_api(request, payload: SyncUserByLoginIn):
    if not is_admin(request.auth):
        raise PermissionDenied()
    result = sync_user_by_login(payload.user_login, request.auth)
    synced = result["synced_user"]
    return 200, {
        "sync_run_id": result["sync_run_id"],
        "user_login": synced.user_login,
        "user_name": synced.user_name,
    }
```

Error responses (handled by Ninja exception middleware):
- `PermissionDenied` → 403
- `NotFound` → 404
- `ConflictError` → 409

### Frontend

#### New component: `components/admin/SyncUserByLoginModal.tsx`

- Title: "Sync user by login"
- Field: email input (type=email for basic validation)
- Helper text: "Enter the user's login email. Their data will be fetched from Hasura and updated."
- Buttons: Cancel / Sync
- On submit:
  - Button shows spinner, is disabled
  - `POST /admin/sync/user-by-login/` with `{user_login: email}`
  - **200:** green toast "User {user_name} synced. Run ID: {sync_run_id}", close modal, trigger run list refresh
  - **404:** inline red error below input "No user found with this email in Hasura"
  - **409:** red toast "Another sync is in progress. Try again in a moment.", close modal
  - **Other errors:** generic error toast

#### Modified: `components/admin/DataSyncTab.tsx`

- Wire "Sync user by login" button → opens `SyncUserByLoginModal`
- Pass `onSyncComplete` callback to modal → refreshes run list

#### API integration (extend `lib/api/syncAdmin.ts`)

```ts
export const syncUserByLogin = (userLogin: string) =>
  apiClient.post<SyncUserByLoginOut>("/admin/sync/user-by-login/", { user_login: userLogin });
```

## Business Rules Enforced

- **Admin-only:** Non-admin returns 403 — checked in service and endpoint
- **Concurrent sync guard:** If any `SyncRun.status="running"` exists → 409
- **No local data touched on 404:** SyncRun is marked `failed`, but no `User` row is created or modified
- **Idempotent upsert (R16):** Reuses existing `upsert_user_from_hasura` logic — safe to run multiple times for same user

## Security Review

| Endpoint | Auth | RBAC |
|----------|------|------|
| `POST /admin/sync/user-by-login/` | JWT required | Admin only |

- `user_login` is an email string — no SQL injection surface (passed as a query param to Hasura, not interpolated into a SQL query)
- `user_login` length should be validated: `user_login: str = Field(max_length=254)` in the Pydantic schema
- Hasura call uses `params={"user_login": ...}` (URL-encoded) — not subject to header injection

## Testing Strategy

**Backend unit tests (`tests/services/test_single_user_sync.py`):**
- `test_sync_user_by_login_succeeds` — mock `fetch_user_by_login` returns user data
- `test_sync_user_by_login_creates_sync_run_with_target_identifier`
- `test_sync_user_by_login_not_found_returns_404` — mock returns None
- `test_sync_user_by_login_blocked_when_sync_running` — pre-create a running SyncRun
- `test_sync_user_by_login_returns_403_for_non_admin`
- `test_sync_user_by_login_upserts_existing_user` — user already exists, mock returns updated data
- `test_sync_user_by_login_marks_run_failed_on_hasura_error`

**Backend integration tests (`tests/api/test_admin_sync_api.py`):**
- `test_post_sync_user_by_login_returns_200`
- `test_post_sync_user_by_login_returns_403_for_co`
- `test_post_sync_user_by_login_returns_409_when_running`

**Frontend component tests:**
- `SyncUserByLoginModal` submits with email, shows spinner, shows success toast on 200
- `SyncUserByLoginModal` shows inline error on 404
- `SyncUserByLoginModal` shows toast on 409

**Manual verification:**
- Click "Sync user by login" → enter real email → verify user data updated in DB
- Enter unknown email → "No user found" inline error
- Start a manual sync, immediately click "Sync user by login" → 409 toast

## Milestones (implementation order)

1. **Hasura client extension** — Add `fetch_user_by_login` to `client.py`. Manual test against Hasura. (1 hr)
2. **Service + schemas** — `sync_user_by_login` service, schemas, unit tests (mocking Hasura client). (2 hr)
3. **API endpoint** — Add to `admin_sync_api.py`. Integration tests. (1 hr)
4. **Frontend modal** — `SyncUserByLoginModal` with all error states. Wire to "Sync user by login" button. (2 hr)
5. **Tests** — Frontend component tests. (1 hr)

## Open Questions

- **`upsert_user_from_hasura` location:** Confirm the exact function name and module for the existing user upsert logic (likely in `services/sync.py` or a helper module). This is reused directly — do not duplicate.
- **`is_admin` helper:** Confirm the admin role check utility used elsewhere in the codebase — use the same one for consistency.
- **Hasura `user/by-login` response shape:** Confirm the exact JSON structure returned (`user_data: [...]` vs. `users: [...]`). Inspect the existing Hasura client patterns or test against the Hasura endpoint before implementation.
