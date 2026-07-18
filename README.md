# Session-Ops

[![Backend CI](https://github.com/makeadiff/mad_sessionops/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/makeadiff/mad_sessionops/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/makeadiff/mad_sessionops/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/makeadiff/mad_sessionops/actions/workflows/frontend-ci.yml)
[![codecov](https://codecov.io/gh/makeadiff/mad_sessionops/branch/main/graph/badge.svg)](https://codecov.io/gh/makeadiff/mad_sessionops)

MAD's internal school operations platform. Manages the full lifecycle of MAD's school partnerships: City Officers set up classes, enroll children, assign volunteers, and schedule teaching slots. External user data syncs from Hasura via webhooks.

## Repo layout

This is a monorepo containing two independently deployable projects:

```
mad_sessionops/
├── mad_sessionops_backend/    ← Django + Ninja API (see its README.md)
├── mad_sessionops_frontend/   ← Next.js 16 frontend (see its README.md)
├── docker-compose.yml         ← local Docker orchestration (backend + redis + frontend)
├── docker-compose.staging.yml       ← EC2 staging overlay (dev.sessionops.makeadiff.in)
├── docker-compose.local-staging.yml ← local run against real staging credentials
├── .github/workflows/         ← CI (backend-ci.yml, frontend-ci.yml)
├── codecov.yml                ← coverage gate config (backend + frontend flags)
└── docs/milestones/           ← milestone specs, feature plans, execution task trackers
```

Both sub-projects have their own `CLAUDE.md` with stack details, architecture rules, and dev conventions — read those before working in either one.

## Quick start (local Docker)

```bash
git clone https://github.com/makeadiff/mad_sessionops.git
cd mad_sessionops

# backend needs real dev credentials (RDS, Redis, Google OAuth, etc.)
cp mad_sessionops_backend/.env.development.example mad_sessionops_backend/.env.development
# edit mad_sessionops_backend/.env.development with real values

docker compose up --build
```

- Backend: http://localhost:8000 (API docs at `/api/docs`)
- Frontend: http://localhost:3000
- Health check: http://localhost:8000/healthcheck

For running backend/frontend outside Docker (faster local iteration), see each project's own `README.md`.

## CI / Quality gates

Every PR into `main` runs:
- **Backend:** black, isort, flake8, pylint, mypy, bandit (blocking) + radon/interrogate/safety (informational) + `pytest --cov`
- **Frontend:** ESLint (strict), Prettier check, TypeScript, `vitest --coverage`, production build

Coverage is tracked via Codecov with separate `backend`/`frontend` flags; new/changed lines on a PR need ≥80% patch coverage.

## Docs

- `docs/milestones/` — milestone specs (`M1.md`, `M2.md`, ...) and per-feature plans/task trackers under `docs/milestones/plans/`
- `docs/milestones/plans/ci-cd-pipeline-plan.md` + `ci-cd-pipeline-tasks.md` — CI/CD setup, execution progress
- `docs/milestones/plans/docker-ec2-deployment-plan.md` + `docker-ec2-deployment-tasks.md` — Docker/EC2 deployment, execution progress
- `mad_sessionops_backend/CONTRIBUTING.md` — contribution workflow, coding standards, PR process
