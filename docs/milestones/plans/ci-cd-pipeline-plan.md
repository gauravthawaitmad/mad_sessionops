# Plan: CI/CD Pipeline — Coverage, Quality, Lint, PR Template, READMEs

**Type:** Cross-cutting infrastructure/tooling (not tied to a product milestone — no `F-MX-Y` id; follows the same non-milestone convention as `docker-ec2-deployment-plan.md`).
**Status:** Not started.
**Scope:** CI quality gate only. Deployment/CD automation (EC2 push) is explicitly out of scope — see `docker-ec2-deployment-plan.md`.

---

## Overview

`mad_sessionops` is a single GitHub repo containing both `mad_sessionops_backend/` and `mad_sessionops_frontend/`, and it has **no working CI today** despite files that look like CI. The backend's `ci.yml`/`code-quality.yml` live under `mad_sessionops_backend/.github/workflows/`, not repo-root `.github/workflows/` — GitHub Actions never discovers workflows there, so they have never run. The frontend has no CI at all. Neither project gates on coverage. There's no PR template and no root README.

This plan stands up real, root-level GitHub Actions workflows for both projects, with an enforced coverage gate via Codecov, blocking lint/type/quality checks, a PR template, and updated READMEs. Below the file-level spec is a **pre-flight findings** section from directly exercising the proposed blocking tools against the current codebase — several of them do not currently pass, which materially affects whether this can ship "green on day one" as scoped.

---

## Pre-flight findings (verified against the working tree, not assumed)

These were discovered by actually running the tools this plan proposes to make blocking. They are not in the original request and need a decision before implementation (see Open Questions).

| Tool (proposed: blocking) | Current state | Detail |
|---|---|---|
| `black --check sessionops/` | **Fails** | 139 of 217 files would be reformatted (88 non-test, 51 test files) — spans production code (`api/`, `management/commands/`, `models/`, `admin.py`, `asgi.py`), not just tests. Black has effectively never been enforced. |
| `isort --check-only sessionops/` | **Fails** | At least 18 test files under `sessionops/tests/` have incorrectly sorted imports. |
| `flake8 sessionops/` | **Crashes**, not just fails | `.flake8`'s `ignore =` list uses inline `#` comments after each code (e.g. `E203,  # whitespace before ':'`). Flake8's config parser doesn't treat `#` as a comment inside that value — it tries to validate `#` itself as an error code and raises `ValueError: Error code '#' supplied to 'ignore' option does not match '^[A-Z]{1,3}[0-9]{0,3}$'`. The job would fail on config load, before checking a single file. |
| `mypy sessionops/` | **Crashes**, not just fails | `mypy.ini` has `plugins = ["mypy_django_plugin.main"]` — a Python/JSON list literal, but mypy.ini expects a bare comma-separated string. Mypy tries to import a plugin literally named `["mypy_django_plugin.main"]` and aborts with 1 error before checking anything. |
| `pylint sessionops/` (errors only, `--enable=E`) | **Has real E-level findings** | Confirmed independent of the `|| true` currently masking it: `E1205 logging-too-many-args` in `sessionops/services/sync/__init__.py` and `upsert.py` (4 call sites), and `E5142 imported-auth-user` in `sessionops/tests/test_sample.py` — the latter is a direct violation of this repo's own non-negotiable rule #4 ("never use Django's built-in User model"), in what looks like a leftover scaffold test file. |
| `pytest --cov=sessionops` | **Not fully exercised** | 731 tests collected; a full local run needs a configured local Postgres + Redis matching the CI env vars and wasn't completed in this planning pass (timed out at 100s mid-suite, likely DB-bound). Run this in full before relying on the plan's "green on day one" claim — see Verification step 0 below. |

**Net effect:** flipping `lint` straight to blocking, as scoped, fails the very first CI run — not from flaky infra, but from pre-existing config bugs and unformatted code. This needs to be resolved as part of this change, not discovered after merge. See **Open Questions**.

---

## Blast Radius

| Surface | Impact | Notes |
|---|---|---|
| Root `.github/workflows/` | New | `backend-ci.yml`, `frontend-ci.yml` — first workflows GitHub Actions will ever actually run for this repo |
| `mad_sessionops_backend/.github/workflows/` | Removed | `ci.yml`, `code-quality.yml` retired (superseded by root workflows; leaving both in place would be confusing dead config) |
| `mad_sessionops_backend/.flake8` | Fixed | Malformed `ignore` list crashes flake8 today (see pre-flight findings) |
| `mad_sessionops_backend/mypy.ini` | Fixed | Malformed `plugins` value crashes mypy today (see pre-flight findings) |
| `mad_sessionops_backend/.pylintrc` | Fixed | `django-settings-module=madui.settings` → `sessionops.settings` |
| `mad_sessionops_backend/sessionops/**` (up to 139 files) | Reformatted | One-time `black`/`isort` pass — see Open Questions on how to land this without a noise PR |
| `mad_sessionops_backend/sessionops/services/sync/{__init__.py,upsert.py}` | Fixed | Real pylint E1205 findings (logging call arg mismatches) |
| `mad_sessionops_backend/sessionops/tests/test_sample.py` | Fixed or removed | Imports Django's built-in `User` — violates repo rule #4; needs a decision (fix import or delete if it's dead scaffold) |
| `mad_sessionops_backend/CODE_QUALITY.md`, `check-quality.sh`, `fix-quality.sh` | Path fix | `madui/` → `sessionops/` throughout |
| `mad_sessionops_frontend/package.json`, `vitest.config.ts` | New | Coverage support (`@vitest/coverage-v8`, coverage block, `test:coverage` script) |
| `mad_sessionops_frontend/.husky/pre-commit`, `pre-push` | Modified | Switch to `lint-staged`; un-comment dead lint/test checks |
| `mad_sessionops_frontend/package.json` | New devDependency | `lint-staged` + config |
| Root `codecov.yml`, `README.md`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/*` | New | |
| `mad_sessionops_frontend/README.md` | Rewrite | Currently untouched `create-next-app` boilerplate |
| `mad_sessionops_backend/README.md` | Light edit | Stale "Dalgo" framing, Python version claim |
| Database migrations | No | Not a data-model feature |
| Celery tasks | No | |
| Existing tests | No behavior change, only formatting/import-order | Confirm no test logic changes slip into the black/isort remediation pass |

---

## Decisions (confirmed with user)

- **Coverage tool:** Codecov, both projects, two flags (`backend`, `frontend`). Requires a `CODECOV_TOKEN` repo secret (manual, see Follow-ups).
- **Branch triggers:** PRs into `main` + direct pushes to `main`. Drops the stale `develop` reference (branch doesn't exist).
- **Backend lint stack:** keep black + isort + flake8 + pylint + mypy + bandit (matches `.pre-commit-config.yaml`). No migration to ruff; `justfile`'s ruff targets are a known pre-existing inconsistency, left alone.
- **Blocking vs informational (backend):** blocking = black, isort, flake8, pylint, mypy, bandit. Informational (`continue-on-error: true`) = radon, interrogate, safety.

---

## Design

### Backend workflow — `.github/workflows/backend-ci.yml`

- Triggers: `pull_request` → `main`, `push` → `main`; `paths: ['mad_sessionops_backend/**', '.github/workflows/backend-ci.yml']`.
- `defaults.run.working-directory: mad_sessionops_backend`.
- Python **3.12** (matches `Dockerfile`'s `python:3.12-slim`, not the stale `3.10` in the old inert workflow). `astral-sh/setup-uv` + `uv sync --frozen`.
- **`lint` job (blocking):** `black --check sessionops/`, `isort --check-only sessionops/`, `flake8 sessionops/`, `pylint sessionops/` (no `|| true`), `mypy sessionops/` (no `continue-on-error`), `bandit -r sessionops/ -c .bandit`. Depends on the config fixes and remediation pass below — do not enable as blocking until those land (see Open Questions).
- **`test` job (blocking):** real service containers:
  ```yaml
  services:
    postgres:
      image: postgres:14
      env: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres, POSTGRES_DB: test_db }
      ports: ['5432:5432']
      options: >-
        --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    redis:
      image: redis:7-alpine
      ports: ['6379:6379']
      options: --health-cmd "redis-cli ping" --health-interval 10s --health-timeout 5s --health-retries 5
  ```
  Env: `DBHOST=localhost`, `DBPORT=5432`, `DBUSER=postgres`, `DBPASSWORD=postgres`, `DBADMINUSER=postgres`, `DBADMINPASSWORD=postgres` — confirmed in `sessionops/settings.py:171-191`: under `_TESTING` (`pytest` in `sys.argv` or `PYTEST_CURRENT_TEST` set), the DB connection uses `DBADMINUSER`/`DBADMINPASSWORD` so Django can create/drop the test DB; the postgres image's superuser satisfies that. Plus `DJANGOSECRET`, `JWT_SECRET_KEY`, `FRONTEND_URL`, `CELERY_BROKER_URL=redis://localhost:6379/0`, `CELERY_RESULT_BACKEND=redis://localhost:6379/0` — same shape as the existing (inert) `.env.test` block in the old `ci.yml`. Run `pytest --cov=sessionops --cov-report=xml --cov-report=term-missing` (coverage `source`/`omit` already configured in `pyproject.toml` — excludes migrations, tests, schemas, settings/urls/wsgi/asgi/routes), then `codecov/codecov-action@v4` with `flags: backend`, `token: ${{ secrets.CODECOV_TOKEN }}`, `fail_ci_if_error: true`.
- **`quality` job (informational, `continue-on-error: true`):** radon cc/mi, interrogate, safety — relocated from the current inert `code-quality.yml`, left non-blocking per the confirmed decision.
- Retire `mad_sessionops_backend/.github/workflows/ci.yml` and `code-quality.yml` once the root versions are verified working, so there's exactly one place CI is defined.

### Frontend workflow — `.github/workflows/frontend-ci.yml`

- Triggers: same `main` PR/push model; `paths: ['mad_sessionops_frontend/**', '.github/workflows/frontend-ci.yml']`.
- `defaults.run.working-directory: mad_sessionops_frontend`. Node 20 (matches `Dockerfile`'s `node:20-alpine`), `npm ci`.
- **`lint-and-typecheck` job (blocking):** `npm run lint:strict`, `npm run format:check`, `npm run type-check`. All three scripts already exist and work today (`package.json` confirmed) — no known day-one breakage here, unlike the backend.
- **`test` job (blocking):** `npm run test:coverage` (new script, see below), then Codecov upload with `flags: frontend`.
- **`build` job (blocking):** `npm run build` with dummy `NEXT_PUBLIC_*` values (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, etc. — confirmed public/non-secret, already committed as placeholders in `.env.*.example`). Since `next.config`'s `eslint.ignoreDuringBuilds` / `typescript.ignoreBuildErrors` are not set, `next build` already fails on lint/type errors — this job is a genuine regression check, not a rubber stamp.

### Frontend: add coverage support (currently entirely missing)

- `package.json`: add `@vitest/coverage-v8` devDependency (confirmed absent today); add `"test:coverage": "vitest run --coverage"`.
- `vitest.config.ts`: add a `coverage` block —
  ```ts
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov', 'html'],
    exclude: ['node_modules/**', '.next/**', '**/*.config.*', '__tests__/**'],
  }
  ```
  (current config has no `coverage` key at all — confirmed.)

### Root Codecov config — `codecov.yml`

Two components/flags: `backend` → `mad_sessionops_backend/sessionops/**`, `frontend` → `mad_sessionops_frontend/**`. Project coverage target `auto` with `threshold: 1%` (no historical baseline exists). Patch (new-code) coverage target `80%`, required — the concrete lever for the coverage priority: it forces every PR's changed lines to be well-tested going forward without demanding an immediate full-repo rewrite to hit a global number.

### PR + issue templates (root-level only, new)

- `.github/pull_request_template.md`: summary, linked milestone/feature doc (`docs/milestones/...`), type-of-change checklist, testing-performed checklist (unit tests added/updated, manual verification), screenshots section (UI changes), a checklist item referencing `CONTRIBUTING.md` (confirmed: `mad_sessionops_backend/CONTRIBUTING.md:248,256` already tells contributors to "use the PR template" — a template that doesn't exist yet).
- `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`: relocate/generalize from the existing backend-only versions (currently inert at `mad_sessionops_backend/.github/ISSUE_TEMPLATE/`, confirmed present) to root, so GitHub actually surfaces them for both projects.

### READMEs

- **Root `README.md` (new — confirmed none exists today):** overview, links to both sub-READMEs, monorepo layout, `docker-compose.yml` quick-start (confirmed present at root), CI/coverage badges, pointer to `docs/milestones/` and `CONTRIBUTING.md`.
- **Frontend `README.md` (rewrite — confirmed still literal `create-next-app` boilerplate):** stack, real npm scripts (`dev`/`build`/`lint`/`lint:strict`/`type-check`/`test`/`test:coverage`/`format`), required env vars, folder structure, testing pattern (vitest + testing-library), link back to backend docs.
- **Backend `README.md` (light edit):** fix stale "Dalgo" framing (confirmed: `README.md:3` reads "A Django backend application following Dalgo best practices"), add CI/coverage badges, correct Python version statement to 3.12 (matches `Dockerfile`).

### Backend fixes needed for the lint job to actually pass

Confirmed by direct execution (see Pre-flight findings) — this section is materially larger than originally scoped:

1. **`.flake8`:** move the `# comment` off each `ignore =` line (put explanations above the block or drop them) — the inline-comment-per-code form crashes flake8's config parser today.
2. **`mypy.ini`:** change `plugins = ["mypy_django_plugin.main"]` to `plugins = mypy_django_plugin.main` (mypy.ini wants a bare string/comma-list, not a Python list literal).
3. **`.pylintrc`:** `django-settings-module=madui.settings` → `sessionops.settings`.
4. **One-time `black`/`isort` remediation pass** across all 139 currently-non-conforming files (see Open Questions for how to land this without burying real review in a 139-file diff).
5. **`sessionops/services/sync/__init__.py` and `upsert.py`:** fix the 4 `E1205 logging-too-many-args` call sites (logging format string arg-count mismatches — worth checking whether the logged values are actually wrong, not just the lint signature).
6. **`sessionops/tests/test_sample.py`:** fix or remove the `django.contrib.auth.models.User` import (repo rule #4 violation) — looks like a leftover scaffold file; confirm it's not accidentally exercising something real before deleting.
7. **`CODE_QUALITY.md` / `check-quality.sh` / `fix-quality.sh`:** `madui/` → `sessionops/` throughout (confirmed: every path reference in these three files is still stale).

### Frontend Husky hooks — align local checks with the new CI gate

- `.husky/pre-commit`: confirmed today it runs `npm run format` (mutating, whole-repo) + `type-check`. Switch to `lint-staged` (new devDependency + config: `eslint --fix` + `prettier --write` on staged `ts/tsx/js` files) + keep `type-check`.
- `.husky/pre-push`: confirmed today `npm run lint:strict` and `npm run test` are dead `#`-commented lines. Un-comment both so contributors catch failures before CI does.

---

## Testing Strategy

- **Backend:** the `test` job itself *is* the test suite (`pytest --cov`) — no new tests to write for this change. What needs verification is that the suite passes at all against the new service-container env (see Verification step 0 — not confirmed in this planning pass) and that the coverage config in `pyproject.toml` produces sane output in CI (right `source`/`omit`).
- **Frontend:** same — `vitest run --coverage` is the existing suite plus a new reporter. No new test files needed for this change itself.
- **Workflow correctness** can only be verified by actually running the workflows on GitHub (path filters, service containers, secrets wiring) — none of this is verifiable by reading YAML alone.

---

## Verification

0. **New, added by this plan given the pre-flight findings:** before anything else, run the full backend suite locally against a real Postgres+Redis matching the proposed CI env (`DBADMINUSER`/`DBADMINPASSWORD` path), and run `black`/`isort`/`flake8`/`mypy`/`pylint` to completion, to get an authoritative pass/fail baseline — this plan's own spot-checks were time-boxed and didn't complete a full suite run.
1. Push the new root workflow files on a throwaway branch, open a draft PR into `main`, confirm both `backend-ci` and `frontend-ci` trigger (path filters correct) and every job (lint, test w/ services, quality, build) reports status.
2. Confirm Codecov comments appear on the PR with backend/frontend flags broken out, and patch-coverage enforcement behaves as configured.
3. Run `npm run test:coverage` and `pytest --cov=sessionops --cov-report=term-missing` locally to sanity-check coverage config before relying on CI.
4. Confirm the PR template renders on a new PR, and issue templates appear when creating a new issue on GitHub.

---

## Implementation order

1. **Backend config fixes + remediation** (`.flake8`, `mypy.ini`, `.pylintrc`, black/isort pass, the 4 pylint E-findings, `test_sample.py`) — lands first and independently, so the repo is lint-clean *before* any CI workflow enforces it. Reviewable as "tooling fixes, no behavior change" (confirm via test suite pass before/after).
2. **Root workflows + Codecov config** (`backend-ci.yml`, `frontend-ci.yml`, `codecov.yml`) on a throwaway/draft-PR branch, iterated until both are fully green per Verification steps 1-3. Retire the old inert backend workflow files in the same change.
3. **Frontend coverage support** (`@vitest/coverage-v8`, vitest config, `test:coverage` script) — needed before step 2's frontend `test` job can pass.
4. **PR template, issue templates, READMEs (root, frontend, backend)** — no CI dependency, can land in parallel with 1-3.
5. **Husky hook alignment** (`lint-staged`, un-comment pre-push checks) — last, since it depends on the same lint commands already being clean from step 1.

Each step leaves the repo in a working state; step 2 is the one that actually flips CI from decorative to enforced, so it should be the last thing merged in this sequence.

---

## Open Questions

1. **How should the 139-file black/isort remediation land?** Options: (a) one dedicated "formatting only, no logic changes" PR reviewed purely by diff-stat and CI pass, landed immediately before the CI PR; (b) run formatters file-by-file scoped to directories as a series of smaller PRs; (c) turn on lint as blocking but scope `black --check`/`isort --check-only` to changed files only (a ratchet) so the existing 139 files are grandfathered and only new/touched code is held to the standard. The plan as scoped assumes (a) or (b) fully clean the tree first — needs a human call given the size of the diff.
2. **`test_sample.py`:** is it dead scaffold safe to delete, or does anything reference it? Needs a quick check before choosing "fix the import" vs "delete the file."
3. **The 4 `E1205 logging-too-many-args` findings in `services/sync/`:** are these cosmetic (extra unused format args) or do they indicate the logged message is actually wrong/missing data in production logs? Worth a quick look before just silencing the lint warning.
4. **CODECOV_TOKEN:** does one already exist for this repo/org in Codecov, or does it need to be created from scratch (requires connecting the repo to Codecov first, which needs GitHub org-level access)?
5. **Retiring `mad_sessionops_backend/.github/workflows/*`:** confirmed safe to delete outright (superseded by root workflows), but flagging since it's a delete, not just an add.

## Follow-ups (manual, not part of this change)

- Add a `CODECOV_TOKEN` repo secret (Settings → Secrets → Actions).
- Once green, enable branch protection on `main` requiring `backend-ci`/`frontend-ci` (and Codecov's status check) before merge — a GitHub repo-settings change, not a file change.
- Consider the `justfile` ruff/pyproject inconsistency and the flat (non-grouped) backend dependency list separately — both pre-existing, intentionally not bundled here.
