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

# standalone output — requires next.config.ts: output: 'standalone'
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
