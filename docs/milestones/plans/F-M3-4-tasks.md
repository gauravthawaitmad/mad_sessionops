# F-M3-4 Execution Progress

## Chunk 1 — Backend scope

- [x] Add `_CHO_ROLES` constant + update `_classify()` in `services/rbac/scope.py`
- [x] Add CHO branch to `schools_visible_to()` in `scope.py`
- [x] Add CHO branch to `can_view_school()` in `scope.py`
- [x] Add `ScopeWarningSchema` to `schemas/auth.py`
- [x] Add `scope_warning` field to `AuthResponseSchema`
- [x] Import `ScopeWarningSchema` in `schemas/__init__.py`
- [x] Extend `login_with_password()` in `auth_service.py` with `scope_warning`
- [x] Extend `login_with_google()` in `auth_service.py` with `scope_warning`
- [x] Add `PermissionsResponseSchema` to `schemas/auth.py`
- [x] Add `GET /api/auth/me/permissions/` endpoint to `auth_api.py`
- [x] Write `tests/test_f_m3_4_cho_scope.py`
- [x] Run `just test` — 14/14 F-M3-4 tests pass (29 pre-existing failures in test_auth.py / test_f_m1_x unchanged)

## Chunk 2 — Frontend

- [x] Add `scopeWarning` to `AuthResponse` + `AuthState` in `types.ts`
- [x] Map `scope_warning` → `scopeWarning` in `auth.service.ts`
- [x] Store `scopeWarning` in `authSlice.ts` on login success
- [x] Create `lib/api/services/permissions.service.ts`
- [x] Create `lib/hooks/useUserCan.ts`
- [x] Update `SchoolDetailPage.tsx` to use `useUserCan` + pass `canModify` to tabs
- [x] Update `StructureTab.tsx` — gate "Add Class" on `canModify !== false`
- [x] Update `ChildrenTab.tsx` — gate "Enroll Child" on `canModify !== false`
- [x] Update `SchoolListPage.tsx` — scope_warning CHO empty state
- [x] `SchoolDetailPage.test.tsx` — fail-open hook means no mock needed; 16/16 pass
- [x] Run `npm run test` — 20/20 pass

## Chunk 3 — Docs

- [x] Update `docs/ARCHITECTURE.md` — CHO scope via `PartnerWorknode` (not `SchoolVolunteer`)
- [x] Update `docs/GLOSSARY.md` — CHO access note + `SchoolVolunteer` clarified

## Deviations from plan
- `SchoolDetailPage.test.tsx`: no explicit `fetchPermissions` mock needed — `useUserCan` fails-open so existing tests remain green without changes
- 29 pre-existing test failures in `test_auth.py` and `test_f_m1_x` files; not caused by F-M3-4 changes (confirmed by stash test)

## Blockers
- None
