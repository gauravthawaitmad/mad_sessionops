# CI/CD Pipeline Execution Progress

Plan: `docs/milestones/plans/ci-cd-pipeline-plan.md`
Decision on file-name references throughout: no `F-MX-Y` id — this is cross-cutting infra, tracked as `ci-cd-pipeline`.

**Note:** per user preference, this execution does not run `git add`/`git commit`/`git push` at any point — the user commits manually. Each milestone below should be reviewed and committed by the user once its checklist is done.

## Decisions made during execution (resolved Open Questions from the plan)

- **139-file black/isort remediation:** lands as one dedicated "formatting only, no logic changes" pass (user confirmed, option A).
- **`test_sample.py`:** confirmed dead Dalgo scaffold, unreferenced elsewhere — deleted, not fixed.
- **5x `E1205 logging-too-many-args` in `services/sync/`:** confirmed false positive — `.pylintrc` had `logging-format-style=new` while the codebase correctly uses lazy `%`-style logging throughout. Fixed by changing the setting to `old`, not by touching the sync module's logging calls.
- **Retiring old backend workflow files:** proceeding with deletion (superseded by root workflows), per plan.
- **CODECOV_TOKEN:** left as a manual Follow-up per the plan — not something code changes can resolve.
- **mypy `celery` stub (found 2026-07-18, not in original plan):** `mypy.ini` was missing an `ignore_missing_imports` entry for `celery.*` (it has no py.typed marker) — added, matching the existing pattern for `ninja`/`rest_framework`/`sentry_sdk`/`pytest`/`dotenv`.
- **pylint `ignore-paths` for migrations (found 2026-07-18, not in original plan):** added `ignore-paths=.*/migrations/.*` to `.pylintrc`, mirroring `.flake8`'s existing `exclude = migrations` — migrations are Django-generated boilerplate, not hand-written logic worth linting for duplication.
- **pylint score on Windows checkouts is misleading — do not "fix" it (found 2026-07-18):** this repo has `core.autocrlf=true` locally and no `.gitattributes`, so a Windows checkout has CRLF line endings while `.pylintrc` requires `expected-line-ending-format=LF` (matching GitHub Actions' `ubuntu-latest`, which checks out the LF endings actually stored in git). Locally this produces ~6200 false-positive `C0328` findings and tanks the score to ~4.3/10. Confirmed the real (CI-equivalent) score by rerunning with `--disable=C0328`: **9.47/10**, well above the `fail-under=6.5` gate. No source changes needed for this — verify on Linux/CI, not by chasing the Windows-local number.

## Milestone 1: Backend config fixes + formatting remediation
- [x] Fix `.flake8` malformed `ignore` list (crashes flake8 today)
- [x] Fix `mypy.ini` malformed `plugins` value (crashes mypy today) — plus added missing `celery.*` stub ignore
- [x] Fix `.pylintrc`: `django-settings-module` → `sessionops.settings`, `logging-format-style` → `old` — plus added `ignore-paths` for migrations
- [x] Delete dead `sessionops/tests/test_sample.py`
- [x] Run `black`/`isort` across `sessionops/` (one dedicated formatting-only pass)
- [x] Fix `CODE_QUALITY.md`, `check-quality.sh`, `fix-quality.sh`: `madui/` → `sessionops/`
- [x] Verify: black --check, isort --check-only, flake8, mypy, bandit all pass clean; pylint passes at 9.47/10 CI-equivalent (see note above on Windows-local CRLF noise)

## Milestone 2: Root CI workflows + Codecov config
- [x] `.github/workflows/backend-ci.yml`
- [x] `.github/workflows/frontend-ci.yml`
- [x] `codecov.yml` (root)
- [x] Retire `mad_sessionops_backend/.github/workflows/*` (ci.yml, code-quality.yml, ISSUE_TEMPLATE) — deleted (unstaged), superseded by root `.github/`

## Milestone 3: Frontend coverage support
- [x] `package.json`: add `@vitest/coverage-v8`, `test:coverage` script
- [x] `vitest.config.ts`: add coverage block
- [x] Verify `npm run test:coverage` runs locally — produces `coverage/lcov.info` + HTML report
- [x] **Found + fixed (2026-07-18, not in original plan):** Vitest's `coverage.reportOnFailure` defaults to `false` — it silently discards the entire coverage report if *any* test fails, which would make Codecov uploads empty on any PR with a red test. Set `reportOnFailure: true` in `vitest.config.ts`.

## Milestone 4: PR template, issue templates, READMEs
- [x] `.github/pull_request_template.md`
- [x] `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md` (root; backend copies deleted)
- [x] Root `README.md`
- [x] Frontend `README.md` rewrite
- [x] Backend `README.md` light edit (Dalgo framing softened, Python 3.10→3.12 fixed, badges added)

## Milestone 5: Husky hook alignment
- [x] `package.json`: add `lint-staged` devDependency + config
- [x] `.husky/pre-commit`: switch to `lint-staged`
- [x] `.husky/pre-push`: type-check uncommented; `lint:strict` and `test` left informational — see Open Questions below (both surfaced real, larger pre-existing problems that need a separate decision/pass before they can block every push)

## Open Questions (new, discovered 2026-07-18 during Milestones 3 & 5 — not in original plan)

1. **`next lint` no longer exists in Next.js 16 — fixed, unambiguous bug fix, already applied.** The CLI dropped the `lint` subcommand entirely; `npm run lint`/`lint:fix`/`lint:strict` (all defined as `next lint ...`) were silently broken. Also, `eslint.config.mjs` was still using the `next lint`-era pattern (`FlatCompat` wrapping the legacy shareable config string `"next/core-web-vitals"`), which crashes under ESLint 9 (`TypeError: Converting circular structure to JSON` inside `@eslint/eslintrc`'s config-validator — confirmed by reproducing with a minimal config, and confirmed the fix by testing `eslint-config-next`'s actual flat-config exports directly). **Fixed:** `eslint.config.mjs` now imports `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` directly as flat config arrays (no `FlatCompat`); `package.json` scripts now call `eslint .` directly instead of `next lint`. Verified `next build` does not itself run ESLint (only TypeScript), so this doesn't affect the CI `build` job.
2. **141 pre-existing ESLint errors + 62 warnings, surfaced now that lint actually runs (user decision: land the fix, keep lint informational for now).** Mostly `@typescript-eslint/no-explicit-any` (redux slices/types, `lib/errors/*`, `lib/toast/toast.tsx`, `lib/redux/storeAccessor.ts`), plus 2 `react-hooks/set-state-in-effect` findings in `lib/errors/networkStatus.tsx` (calling `setState` synchronously in a `useEffect` body — worth a real look, not just a lint suppress) and one `no-require-imports` in `lib/redux/persistConfig.ts`. **Current state:** `frontend-ci.yml`'s `lint-and-typecheck` job runs `lint:strict` with `continue-on-error: true`; `.husky/pre-push`'s lint step stays commented out. **Needs a decision before flipping to blocking:** same three options as the backend's black/isort remediation — (a) one dedicated cleanup PR, (b) file-by-file passes, (c) ratchet to changed-files-only.
3. **2 pre-existing test failures in `__tests__/admin/DataSyncTab.test.tsx`** ("renders 3 entity cards with sync buttons", "entity buttons show 'Syncing…'") — the test queries `getByRole('button', { name: /sync partners/i })` but the rendered sync buttons no longer expose that accessible name (rendered DOM shows an icon-only button with no visible/aria label for the per-entity sync actions). Confirmed pre-existing and unrelated to this session's changes (reproduces identically on a clean `npm run test`, no coverage involved). `.husky/pre-push` runs `npm run test` but falls back to a warning echo (non-blocking) specifically because of this — needs a real fix (add an accessible name to the buttons, or update the test) before it can block pushes. `frontend-ci.yml`'s `test` job is left blocking as originally planned (test failures should gate CI); this means the very first `frontend-ci` run on a PR touching the frontend will show 2 failing tests until this is fixed.

## First real PR run (2026-07-18/19) — backend `test`/`lint` failures, now resolved

The PR's first real GitHub Actions run failed on `Backend CI / Lint`, `Backend CI / Quality`, and `Backend CI / Test` (46 test failures), plus config bugs surfaced only by actually running against real Postgres/Redis:

- **`.env.{ENVIRONMENT}` file requirement:** `settings.py` hard-requires a physical env file on disk (not just process env vars) to even import — `lint`/`test`/`quality` jobs didn't write one. Fixed by adding a "Create .env.test file" step to each job in `backend-ci.yml`.
- **`interrogate` crashed on missing `pkg_resources`:** `pbr`'s unconstrained `setuptools` dependency resolved to 83.0.0, which dropped `pkg_resources`. Pinned `setuptools<81`.
- **46 backend test failures, investigated and fixed in full** (verified via a complete local run against real Postgres — 0 failures remaining, confirmed independently against the 1 flaky infra-only failure re-run in isolation):
  1. **Real bug:** realtime sync's reactivation flow never set `is_active=True` (see `sessionops/services/realtime_sync/utils.py` — `apply_common_fields` now reads `payload.user_active_status`, matching the schema's own documented-but-unimplemented intent).
  2. **Real bug:** concurrent inserts for a brand-new `user_id` could race past `select_for_update()` (nothing to lock yet) and crash with a raw 500 instead of the test's expected "both complete without error" (`sessionops/services/realtime_sync/flows/insert.py` — nested atomic + IntegrityError recovery).
  3. **Real bug / design gap:** `close_old_connections()` calls inside the sync services (legitimate for long-running cron/background-thread batches) unconditionally closed the DB connection, which breaks pytest-django's transaction-wrapped test connection when those same functions are called directly and synchronously in unit tests — this was the root cause of every `connection already closed` / `assert None is not None` failure across `test_incremental_sync.py` and `test_trigger.py`. Fixed with a shared guarded helper (`upsert.close_old_connections`) that no-ops when already inside an atomic block, used by `trigger.py`, `incremental.py`, and `sync/__init__.py`. Also set `CONN_MAX_AGE` (was unset → Django default 0) to persistent — a fixed positive age just delays the same bug until the test *session* (not any one test) runs past that age, since pytest-django keeps one connection alive for the whole run.
  4. **Test bug:** `test_subject_normalization.py`'s legacy-subject fixture didn't set the required `program_id` FK.
  5. **Test bug:** `test_incremental_sync.py`'s `_mock_all()` passed pre-built `MagicMock` instances to `patch.multiple()` instead of `mock.DEFAULT` — `patch.multiple`'s returned dict only populates `DEFAULT`-valued keys, so `mocks["fetch_users_updated_after"]` KeyError'd.
  6. **Test bug:** 2 tests created a `User` row and expected the cursor helpers to read `User.synced_at` directly, but `_get_user_cursor()`/`_get_partner_cursor()` derive purely from the last successful `SyncRun.cursor_end` (per the module's own cursor-strategy docstring) — fixed both to create the `SyncRun` the function actually reads.
- **Environment note for anyone reproducing locally:** this repo has no `.python-version` pin — a local venv can silently end up on a newer Python (3.13) than CI's 3.12, producing unrelated extra failures. Pin to 3.12 (`uv python install 3.12 && uv sync --python 3.12`) before trusting a local full-suite run. Also, full local runs against Docker Desktop/WSL2 Postgres were extremely slow (minutes, vs. ~34s on GitHub's native Linux runners) — use `--reuse-db` after the first run, and don't be alarmed by the wall-clock difference from CI.

## Blockers
- **`CODECOV_TOKEN`** remains a manual, out-of-band step (Settings → Secrets → Actions) — not resolvable from code.
- **Frontend lint debt (141 errors) and the 2 DataSyncTab test failures** (Open Questions 2–3 above) block flipping frontend lint/test to fully blocking in CI/pre-push — currently informational/non-blocking by design, not by oversight.
