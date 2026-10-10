# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for SPARTA Next.js Standalone deployment on Dokploy

# ─── 1. Base Image ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# ─── 2. Dependencies Stage ────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# ─── 3. Builder Stage ─────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client for the build step
RUN npx prisma generate

# Ensure Next.js outputs the standalone directory containing minimal runtime bundle
ENV NEXT_OUTPUT_MODE=standalone
ARG NEXT_PUBLIC_NOTIFICATIONS_ENABLED=true
ENV NEXT_PUBLIC_NOTIFICATIONS_ENABLED=${NEXT_PUBLIC_NOTIFICATIONS_ENABLED}

# Web Push public key must be baked in at build time (NEXT_PUBLIC_* vars are
# inlined into the client bundle, unlike normal runtime env vars) - set this
# as a Dokploy "Build Arg", not just a runtime env var, or push subscriptions
# will silently fail client-side. VAPID_PRIVATE_KEY stays a runtime-only env
# var (used server-side only) and needs no build arg.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}

# Non-secret placeholders for build-time validation
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
ENV ISOLAR_MODE=mock

RUN npm run build

# ─── 4. Production Runner Stage ───────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ARG APP_PORT=3001
ENV PORT=${APP_PORT}
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Jakarta

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid 1001 nextjs

# Copy static assets and standalone bundle
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/generated/prisma ./src/generated/prisma

USER nextjs

EXPOSE ${APP_PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3001) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
