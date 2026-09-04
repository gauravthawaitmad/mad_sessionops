# syntax=docker/dockerfile:1

# ---- deps stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- builder stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# They must be passed as build args — runtime env vars don't apply.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_ENV=production
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_ENABLE_ANALYTICS=false
ARG NEXT_PUBLIC_ENABLE_DEBUG=false
ARG NEXT_PUBLIC_ENABLE_MOCK_API=false
ARG NEXT_PUBLIC_LOG_LEVEL=error
ARG NEXT_PUBLIC_API_TIMEOUT=30000
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_APP_NAME="MAD Platform"
ARG NEXT_PUBLIC_MARKER_IO_PROJECT_ID=""

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_ENABLE_ANALYTICS=$NEXT_PUBLIC_ENABLE_ANALYTICS
ENV NEXT_PUBLIC_ENABLE_DEBUG=$NEXT_PUBLIC_ENABLE_DEBUG
ENV NEXT_PUBLIC_ENABLE_MOCK_API=$NEXT_PUBLIC_ENABLE_MOCK_API
ENV NEXT_PUBLIC_LOG_LEVEL=$NEXT_PUBLIC_LOG_LEVEL
ENV NEXT_PUBLIC_API_TIMEOUT=$NEXT_PUBLIC_API_TIMEOUT
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_MARKER_IO_PROJECT_ID=$NEXT_PUBLIC_MARKER_IO_PROJECT_ID

# SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN are for source-map upload only
# (see next.config.ts). The auth token is an org-level write credential, so
# unlike the NEXT_PUBLIC_* vars above it must NOT become a persisted ARG/ENV
# (those are readable via `docker history` on the built image) — it's mounted
# as a build secret instead, scoped only to this RUN step.
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT

RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN=$(cat /run/secrets/sentry_auth_token 2>/dev/null || echo "") \
    npm run build

# ---- runner stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# standalone output — requires next.config.ts: output: 'standalone'
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
