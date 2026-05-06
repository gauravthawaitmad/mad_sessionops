# Deployment Plan: Docker + EC2

**Goal:** Containerise the Django backend (+ Celery) and Next.js frontend, verify everything works locally with `docker compose up`, then deploy to an EC2 instance.

**Note:** This supersedes the "no containers" note in `ARCHITECTURE.md`. We will update that doc when implementation is done.

---

## Architecture overview

```
EC2 instance (Ubuntu 22.04)
│
├── nginx              ← port 80/443, TLS termination, reverse proxy
├── frontend           ← Next.js standalone server, port 3000 (internal)
├── backend            ← Gunicorn/Django, port 8000 (internal)
├── celery-worker      ← Celery prefork worker
├── celery-beat        ← Celery beat scheduler
└── redis              ← Redis 7, port 6379 (internal)
                         (PostgreSQL stays on AWS RDS — no DB container)
```

All containers share a single Docker bridge network (`sessionops-net`).
Only nginx is exposed to the internet (ports 80/443).

---

## Phase 1 — Local Docker testing

### Files to create

```
mad_sessionops/
├── docker-compose.yml                        ← orchestration for local + prod
├── nginx/
│   └── default.conf                          ← reverse proxy config
├── mad_sessionops_backend/
│   ├── Dockerfile
│   └── .env.docker.example                   ← docker-specific env template
└── mad_sessionops_frontend/
    ├── Dockerfile
    └── .env.docker.example
```

---

### Step 1 — Backend Dockerfile

**File:** `mad_sessionops_backend/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

# Install uv (official binary)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install system deps required by psycopg2-binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# --- dependency layer (cached unless pyproject.toml/uv.lock change) ---
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# --- source layer ---
COPY . .

# Install the project itself into the venv
RUN uv sync --frozen --no-dev

# Add the venv to PATH
ENV VIRTUAL_ENV=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Default: web server. Override in docker-compose for worker/beat.
CMD ["gunicorn", "sessionops.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--timeout", "120", \
     "--access-logfile", "-"]
```

**Key decisions:**
- Uses the official `uv` binary (no pip install of uv — always latest stable).
- Two-stage `uv sync` for cache-friendly layer ordering: deps first, source second.
- `--no-dev` strips linting/testing packages from the image.
- Workers = 2; tune upward on larger EC2 instances (rule of thumb: 2–4 × CPU cores).

---

### Step 2 — Backend env for Docker

**File:** `mad_sessionops_backend/.env.docker.example`

```env
# Copy to .env.docker and fill in real values. NEVER commit .env.docker.

DJANGOSECRET=change-me-generate-with-python-c-"import-secrets;print(secrets.token_hex(50))"
DEBUG=False
ENVIRONMENT=docker

# Point to your actual RDS instance (or localhost:5432 if testing with local PG)
DBNAME=mad_dev
DBHOST=your-rds-endpoint.ap-south-1.rds.amazonaws.com
DBPORT=5432
DBUSER=postgres
DBPASSWORD=change-me
DBSCHEMA=mad_platform_dev

# In Docker, Redis is the service name defined in docker-compose.yml
REDIS_HOST=redis
REDIS_PORT=6379
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# CORS — set to your EC2 domain or localhost for local testing
ALLOWED_HOSTS=localhost,127.0.0.1,your-ec2-ip-or-domain
CORS_ALLOWED_ORIGINS=http://localhost,http://localhost:3000,https://your-ec2-domain
FRONTEND_URL=http://localhost
FRONTEND_URL_V2=http://localhost

JWT_SECRET_KEY=change-me-long-random-string
JWT_ACCESS_TOKEN_EXPIRY_HOURS=12
JWT_REFRESH_TOKEN_EXPIRY_DAYS=30

GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

SENTRY_DSN=
SENTRY_TSR=1.0
SENTRY_PSR=1.0
SENTRY_ENABLE_LOGS=True
SENTRY_SEND_DEFAULT_PII=False

EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=noreply@sessionops.makeadiff.in

BREVO_API_KEY=your-brevo-api-key
BREVO_FROM_EMAIL=noreply@sessionops.makeadiff.in
BREVO_FROM_NAME=Session-Ops

HASURA_API_BASE_URL=https://hasura.makeadiff.in
HASURA_API_JWT=your-hasura-service-jwt
```

---

### Step 3 — Frontend Dockerfile

**File:** `mad_sessionops_frontend/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1

# ---- deps stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (baked into JS bundle at build time)
ARG NEXT_PUBLIC_API_URL=http://localhost/api
ARG NEXT_PUBLIC_APP_URL=http://localhost
ARG NEXT_PUBLIC_APP_ENV=production
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_ENABLE_ANALYTICS=false
ARG NEXT_PUBLIC_ENABLE_DEBUG=false
ARG NEXT_PUBLIC_ENABLE_MOCK_API=false
ARG NEXT_PUBLIC_LOG_LEVEL=error
ARG NEXT_PUBLIC_API_TIMEOUT=30000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_ENABLE_ANALYTICS=$NEXT_PUBLIC_ENABLE_ANALYTICS
ENV NEXT_PUBLIC_ENABLE_DEBUG=$NEXT_PUBLIC_ENABLE_DEBUG
ENV NEXT_PUBLIC_ENABLE_MOCK_API=$NEXT_PUBLIC_ENABLE_MOCK_API
ENV NEXT_PUBLIC_LOG_LEVEL=$NEXT_PUBLIC_LOG_LEVEL
ENV NEXT_PUBLIC_API_TIMEOUT=$NEXT_PUBLIC_API_TIMEOUT

RUN npm run build

# ---- runner stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Standalone output is smallest — requires next.config.ts output: 'standalone'
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Required change to `next.config.ts`:**
Add `output: 'standalone'` so Next.js emits a self-contained Node server:

```ts
// next.config.ts
const nextConfig = {
  output: 'standalone',
  // ... rest of existing config
};
export default nextConfig;
```

**Key decisions:**
- Three-stage build: `deps` → `builder` → `runner`. Final image has no build tools.
- All `NEXT_PUBLIC_*` vars are ARGs baked at build time (they are inlined into the JS bundle — cannot be set at runtime). Pass them via `docker compose build --build-arg`.
- Standalone output keeps the runner image small (~120 MB vs ~600 MB full).

---

### Step 4 — Nginx config

**File:** `nginx/default.conf`

```nginx
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:3000;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Django static files (served by nginx directly for performance)
    location /static/ {
        alias /app/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Everything else → frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Step 5 — docker-compose.yml

**File:** `docker-compose.yml` (at repo root)

```yaml
name: sessionops

services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks:
      - sessionops-net
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./mad_sessionops_backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - ./mad_sessionops_backend/.env.docker
    networks:
      - sessionops-net
    volumes:
      - staticfiles:/app/staticfiles
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/api/health/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  celery-worker:
    build:
      context: ./mad_sessionops_backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - ./mad_sessionops_backend/.env.docker
    networks:
      - sessionops-net
    depends_on:
      redis:
        condition: service_healthy
    command: >
      celery -A sessionops worker
      --loglevel=info
      --pool=prefork
      --concurrency=2

  celery-beat:
    build:
      context: ./mad_sessionops_backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - ./mad_sessionops_backend/.env.docker
    networks:
      - sessionops-net
    depends_on:
      redis:
        condition: service_healthy
    command: >
      celery -A sessionops beat
      --loglevel=info
      --scheduler django_celery_beat.schedulers:DatabaseScheduler

  frontend:
    build:
      context: ./mad_sessionops_frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost/api}
        NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-http://localhost}
        NEXT_PUBLIC_APP_ENV: ${NEXT_PUBLIC_APP_ENV:-production}
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: ${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
        NEXT_PUBLIC_ENABLE_ANALYTICS: ${NEXT_PUBLIC_ENABLE_ANALYTICS:-false}
        NEXT_PUBLIC_ENABLE_DEBUG: ${NEXT_PUBLIC_ENABLE_DEBUG:-false}
        NEXT_PUBLIC_ENABLE_MOCK_API: ${NEXT_PUBLIC_ENABLE_MOCK_API:-false}
        NEXT_PUBLIC_LOG_LEVEL: ${NEXT_PUBLIC_LOG_LEVEL:-error}
        NEXT_PUBLIC_API_TIMEOUT: ${NEXT_PUBLIC_API_TIMEOUT:-30000}
    restart: unless-stopped
    networks:
      - sessionops-net
    depends_on:
      - backend

  nginx:
    image: nginx:1.25-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"       # wired up later when adding TLS
    networks:
      - sessionops-net
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - staticfiles:/app/staticfiles:ro
    depends_on:
      - backend
      - frontend

networks:
  sessionops-net:
    driver: bridge

volumes:
  redis-data:
  staticfiles:
```

---

### Step 6 — Frontend env for Docker

**File:** `mad_sessionops_frontend/.env.docker.example`

```env
# These are passed as docker build ARGs — not runtime env vars.
# Copy to .env.docker and fill in.
NEXT_PUBLIC_API_URL=http://localhost/api
NEXT_PUBLIC_APP_URL=http://localhost
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_ENABLE_MOCK_API=false
NEXT_PUBLIC_LOG_LEVEL=error
NEXT_PUBLIC_API_TIMEOUT=30000
```

---

### Step 7 — collectstatic entrypoint

The backend container needs to run `collectstatic` before serving so nginx can serve static files.
Add an entrypoint script:

**File:** `mad_sessionops_backend/entrypoint.sh`

```bash
#!/bin/sh
set -e

echo "Running collectstatic..."
python manage.py collectstatic --noinput

echo "Applying migrations..."
python manage.py migrate --noinput

exec "$@"
```

Update the backend `Dockerfile` CMD section:

```dockerfile
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "sessionops.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120", "--access-logfile", "-"]
```

Note: The `entrypoint.sh` is only useful on the `backend` service. `celery-worker` and `celery-beat` override `CMD` but still run entrypoint — this is fine (collectstatic is idempotent).

---

### Step 8 — Health check endpoint

The `docker-compose.yml` healthcheck calls `/api/health/`. Add a simple health endpoint to the backend if one doesn't exist:

```python
# In sessionops/api/health_api.py
from ninja import Router
router = Router()

@router.get("/health/", auth=None)
def health(request):
    return {"status": "ok"}
```

Register it in `routes.py`. This keeps the healthcheck unauthenticated so Docker can probe it.

---

## Phase 1 — Local test procedure

```bash
# 1. Copy and fill env files
cp mad_sessionops_backend/.env.docker.example mad_sessionops_backend/.env.docker
cp mad_sessionops_frontend/.env.docker.example mad_sessionops_frontend/.env.docker.env
# Edit both files with real values

# 2. Export frontend build args (read from the frontend env file)
export $(cat mad_sessionops_frontend/.env.docker.env | xargs)

# 3. Build all images
docker compose build

# 4. Start everything
docker compose up -d

# 5. Verify
docker compose ps          # all services should be "running" / "healthy"
docker compose logs -f     # watch for errors

# 6. Smoke test
curl http://localhost/api/health/        # → {"status":"ok"}
curl http://localhost/                   # → Next.js HTML
```

---

## Phase 2 — EC2 Deployment

### EC2 instance recommendation

| Attribute | Recommended |
|-----------|-------------|
| Instance type | `t3.medium` (2 vCPU, 4 GB RAM) — minimum for all containers |
| OS | Ubuntu 22.04 LTS |
| Storage | 20 GB gp3 root volume |
| Security group | Inbound: 22 (SSH, restricted to your IP), 80 (HTTP), 443 (HTTPS) |
| IAM role | None required if using env vars; optionally attach SSM for secrets |

### EC2 setup steps

```bash
# -- On the EC2 instance --

# 1. Update and install Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 2. Add ubuntu user to docker group (re-login after)
sudo usermod -aG docker ubuntu

# 3. Clone repo
git clone https://github.com/makeadiff/mad_sessionops.git /opt/sessionops
cd /opt/sessionops

# 4. Copy and fill production env files
cp mad_sessionops_backend/.env.docker.example mad_sessionops_backend/.env.docker
# nano/vim to fill in production values

# 5. Build and start
export $(grep -v '^#' mad_sessionops_frontend/.env.docker.env | xargs)
docker compose build
docker compose up -d

# 6. Verify
docker compose ps
curl http://localhost/api/health/
```

### TLS with Let's Encrypt (Certbot)

After pointing your domain's A record to the EC2 IP:

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Stop nginx container temporarily
docker compose stop nginx

# Obtain certificate (standalone mode)
sudo certbot certonly --standalone -d your-domain.com

# Update nginx/default.conf to add HTTPS server block + redirect
# Then restart nginx
docker compose start nginx
```

Or use an AWS Application Load Balancer in front of EC2 for TLS termination — simpler for managed certs.

### Deployment update process (on EC2)

```bash
cd /opt/sessionops
git pull origin main
export $(grep -v '^#' mad_sessionops_frontend/.env.docker.env | xargs)
docker compose build
docker compose up -d --no-deps --build backend celery-worker celery-beat frontend
docker compose restart nginx
```

---

## Implementation order

| # | Task | Files created/modified |
|---|------|------------------------|
| 1 | Add `output: 'standalone'` to `next.config.ts` | `mad_sessionops_frontend/next.config.ts` |
| 2 | Create backend `Dockerfile` + `entrypoint.sh` | `mad_sessionops_backend/Dockerfile`, `entrypoint.sh` |
| 3 | Create `mad_sessionops_backend/.env.docker.example` | new file |
| 4 | Add `/api/health/` endpoint to backend | `sessionops/api/health_api.py`, `sessionops/routes.py` |
| 5 | Create frontend `Dockerfile` | `mad_sessionops_frontend/Dockerfile` |
| 6 | Create `mad_sessionops_frontend/.env.docker.example` | new file |
| 7 | Create `nginx/default.conf` | `nginx/default.conf` |
| 8 | Create `docker-compose.yml` | repo root |
| 9 | Local smoke test | — |
| 10 | EC2 provision + deploy | — |

---

## Decisions made (2026-05-06)

1. **Domain**: Staging deploys to `dev.sessionops.makeadiff.in`. nginx `server_name` includes this + localhost.
2. **Redis**: Docker container (`redis:7-alpine`) with a named volume. ElastiCache deferred.
3. **RDS connectivity**: Checklist item — add EC2 security group to RDS inbound rules before first EC2 deploy.
4. **Google OAuth**: Add `https://dev.sessionops.makeadiff.in` to Authorized Origins and Redirect URIs in GCP Console.
5. **Env files**: `backend/.env.development` → local Docker. `backend/.env.staging` (from `.env.staging.example`) → EC2. No separate `.env.docker` file.
6. **Static files**: Single-node volume. EFS deferred until multi-node scaling.
