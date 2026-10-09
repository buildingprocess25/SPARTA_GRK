# syntax=docker/dockerfile:1
# Build from the repository root:
# docker build -f src/components/Dockerfile -t alfamart-esg .

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT_MODE=standalone
ARG NEXT_PUBLIC_NOTIFICATIONS_ENABLED=true
ENV NEXT_PUBLIC_NOTIFICATIONS_ENABLED=${NEXT_PUBLIC_NOTIFICATIONS_ENABLED}

# Prisma Client uses a project-local output directory, so generate it only
# after the complete source tree is available in this Linux build stage.
RUN npx prisma generate
# This non-secret URL only satisfies build-time Prisma module initialization.
# Supply the real DATABASE_URL and iSolar/cron credentials at runtime.
RUN DATABASE_URL=postgresql://docker-build:docker-build@127.0.0.1:5432/docker-build npm run build

FROM base AS runner
WORKDIR /app
ARG APP_PORT=3001
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=UTC
ENV PORT=${APP_PORT}
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/generated/prisma ./src/generated/prisma

USER nextjs

EXPOSE ${APP_PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/').then(response => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server.js"]
