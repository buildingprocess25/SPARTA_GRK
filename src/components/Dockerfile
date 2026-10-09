# Use Docker BuildKit for better layer caching during rebuild
# Enable with: DOCKER_BUILDKIT=1 docker build .

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT_MODE=standalone

# Provide non-secret placeholders so Next.js/Prisma imports that validate
# env variables do not fail during image build.
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
ENV DIRECT_URL=postgresql://postgres:postgres@localhost:5432/postgres
ENV SESSION_SECRET=build-time-session-secret-at-least-32-chars
ENV APP_BASE_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_NOTIFICATIONS_ENABLED=true
ENV NEXT_PUBLIC_NOTIFICATIONS_ENABLED=$NEXT_PUBLIC_NOTIFICATIONS_ENABLED
ENV GMAIL_USER=build@example.com
ENV GOOGLE_CLIENT_ID=build-client-id
ENV GOOGLE_CLIENT_SECRET=build-client-secret
ENV GOOGLE_REFRESH_TOKEN=build-refresh-token
ENV GOOGLE_DRIVE_ROOT_FOLDER_ID=build-folder-id

RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=UTC
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
