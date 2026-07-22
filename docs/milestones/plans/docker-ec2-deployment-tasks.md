# Docker + EC2 Deployment Execution Progress

Plan: `docs/milestones/plans/docker-ec2-deployment-plan.md`

**Note:** per user preference, this execution does not run `git add`/`git commit`/`git push` at any point — the user commits manually.

## How implementation diverged from the plan (confirmed against the working tree, 2026-07-18)

The plan specifies a fully containerized stack with nginx as its own container doing TLS termination and reverse-proxying to `backend`/`frontend` containers. What's actually built and already committed on `dev_gaurav` is simpler:

- **No `nginx/` container or `nginx/default.conf`.** `docker-compose.yml` exposes `backend` on host port 8000 and `frontend` on host port 3000 directly (`ports: ["8000:8000"]` / `["3000:3000"]`) — no bridge-only internal networking, no in-stack reverse proxy.
- **No `.env.docker` / `.env.docker.example` files.** The plan's Step 2/6 env-file design was dropped in favor of reusing the existing per-environment files: `mad_sessionops_backend/.env.development` for local Docker, `mad_sessionops_backend/.env.staging` (from `.env.staging.example`) for EC2 — selected via a `BACKEND_ENV_FILE` env var read by `docker-compose.yml`'s `env_file:` directive. This matches Decision #5 already recorded in the plan itself (bottom of `docker-ec2-deployment-plan.md`).
- **Two compose overlays exist instead of one flat file:** `docker-compose.yml` (base, local dev) + `docker-compose.staging.yml` (overrides `frontend` build args for `dev.sessionops.makeadiff.in`) + `docker-compose.local-staging.yml` (untriaged — check contents before relying on it).
- **Health endpoint is `GET /healthcheck`** in `sessionops/routes.py`'s existing `public_api` router (line ~264), not a new dedicated `sessionops/api/health_api.py` file as the plan's Step 8 specified — same outcome (unauthenticated health probe), different file location. `docker-compose.yml`'s healthcheck calls this correctly.
- **`entrypoint.sh` does more than the plan's Step 7:** collectstatic + migrate, plus a schema-existence bootstrap (`CREATE SCHEMA IF NOT EXISTS`, grants) using `DBADMINUSER`/`DBADMINPASSWORD`, plus conditionally runs `sync_users`/`sync_partners`/`sync_partner_worknode` on staging/production only (skipped in development to avoid hitting real Hasura). Also gated on `$1 = "gunicorn"` so celery-worker/celery-beat containers (which override `CMD`) skip the collectstatic/migrate/sync steps entirely rather than just no-op-ing them.
- **No celery-worker/celery-beat services in `docker-compose.yml`** — the plan's architecture diagram includes them; they are not present in the committed compose file. Confirm whether Celery is intentionally out of scope for the initial deploy or still pending.

**Net effect:** since there's no containerized nginx, TLS termination and reverse-proxying for `dev.sessionops.makeadiff.in` must happen at the EC2 host level (host-installed nginx + certbot, proxying to `localhost:8000`/`localhost:3000`) rather than in a `nginx` container as the plan describes. This needs to be built directly on the EC2 instance in Phase 2 — it is not a repo file-change and can't be done from this session.

---

## Phase 1 — Local Docker testing
- [x] `next.config.ts`: `output: 'standalone'` (confirmed present)
- [x] Backend `Dockerfile` (multi-stage, uv-based) — committed
- [x] Backend `entrypoint.sh` (collectstatic + schema bootstrap + migrate + conditional Hasura sync) — committed, exceeds plan's Step 7 scope
- [x] `/healthcheck` endpoint (`sessionops/routes.py`, `public_api` router) — committed, different location than plan's Step 8 but same behavior
- [x] Frontend `Dockerfile` (deps/builder/runner, standalone output) — committed
- [x] `docker-compose.yml` (root) — committed, diverged from plan: no nginx container, direct port exposure, reuses `.env.development`/`.env.staging` via `BACKEND_ENV_FILE`
- [x] `docker-compose.staging.yml` overlay for `dev.sessionops.makeadiff.in` frontend build args — committed
- [x] `docker-compose.local-staging.yml` — confirmed purpose: local Docker run against real staging credentials (RDS/Brevo/Google OAuth via `.env.staging`) with `localhost` URLs, distinct from `docker-compose.staging.yml`'s EC2-domain overlay. Self-documented via header comment, no action needed.
- [~] nginx reverse proxy — **not built as a container** (plan's Step 4); if TLS/reverse-proxy is still meant to live in Docker rather than the EC2 host, this needs an explicit decision (see Open Questions)
- [x] celery-worker / celery-beat containers — confirmed out of scope for this deploy (2026-07-21, user decision); not present in `docker-compose.yml` by design
- [ ] Run the actual Phase 1 local smoke test end-to-end (`docker compose build && up -d`, `curl /healthcheck`, `curl /`) and confirm all services report healthy — not verified in this session (no local Docker Desktop check performed)

## Phase 2 — EC2 Deployment
- [ ] Provision EC2 instance (`t3.medium`, Ubuntu 22.04, security group per plan) — **requires AWS console/CLI access this session does not have**
- [ ] Install Docker + docker-compose-plugin on the instance
- [ ] Clone repo to `/opt/sessionops` (or confirm it's already there if an instance exists)
- [ ] Add EC2 security group to RDS inbound rules (Decision #3 in the plan) — AWS console action
- [ ] Fill `mad_sessionops_backend/.env.staging` with real production values on the instance
- [ ] Host-level nginx + certbot for `dev.sessionops.makeadiff.in` (see divergence note above — this replaces the plan's containerized nginx)
- [ ] Add `https://dev.sessionops.makeadiff.in` to Google OAuth Authorized Origins/Redirect URIs (Decision #4) — GCP Console action
- [ ] `docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build` on the instance
- [ ] Verify: `docker compose ps` all healthy, `curl http://localhost/healthcheck`, `curl https://dev.sessionops.makeadiff.in/`

## Blockers
- **Phase 2 cannot be executed from this session.** It requires AWS console/CLI credentials, SSH access to a real or new EC2 instance, and DNS/GCP console changes — none of which this session has. Phase 1 (all repo file changes) is done; Phase 2 needs the user to either grant access or run the documented steps themselves.

## Open Questions (new, raised during this status check — not in the original plan)
1. **Is nginx staying host-level, or should it be moved back into Docker?** Current state has no containerized nginx and no host-level nginx config committed anywhere in the repo (host config, by nature, wouldn't be — but there's no doc describing the intended host setup either). Needs a decision before Phase 2 EC2 work starts.
2. **Resolved (2026-07-21, user decision): Celery is out of scope for this deploy.** `docker-compose.yml` intentionally has no `celery-worker`/`celery-beat` services. Hasura sync currently runs as a one-shot step in `entrypoint.sh` (`sync_users`/`sync_partners`/`sync_partner_worknode` on container start for staging/production), not as a recurring Celery beat schedule. Revisit if/when recurring async jobs are needed.
3. **Resolved:** `docker-compose.local-staging.yml` already has a header comment identifying its purpose (local Docker run against real staging credentials with `localhost` URLs) — no action needed.
4. **Is there already a provisioned EC2 instance for `dev.sessionops.makeadiff.in`,** or does Phase 2 start from zero? Changes what "pending" work actually means here.
