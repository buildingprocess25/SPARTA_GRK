# SPARTA Project Stabilization Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-01-project-stabilization-design.md`

## Global constraints

- Preserve the current visual identity, navigation, page structure, and existing PostgreSQL records.
- Do not call the live iSolar API from ordinary automated tests.
- Do not reset, deploy migrations to, or mark migrations on the existing database.
- Every defect fix starts with a regression assertion that fails before the fix and passes afterward.
- Keep credentials server-only and never print their values.

## Task 1 — Repository hygiene and client secret removal

**Files:** `.gitignore`, `.env.example`, `src/services/isolarCloudService.js`, `scripts/test-stabilization.mjs`, `package.json`

1. Add a static security assertion that scans client-importable source and initially fails on the embedded iSolar credentials.
2. Add `.gitignore` rules for secrets, local caches, dependencies, build output, logs, and Superpowers scratch files; retain `.env.example`.
3. Replace the browser service with an internal-API-only client containing no vendor configuration or secret fallback.
4. Add a value-free `.env.example` documenting required and optional server settings.
5. Run `node scripts/test-stabilization.mjs security`; expected: all security assertions pass.

**Produces:** a clean repository boundary and a testable guarantee that browser code contains no vendor secret material.

## Task 2 — Fail-closed mutation guards and shared Prisma client

**Files:** `src/lib/server/requestGuards.js`, `src/app/api/cron/isolar-sync/route.js`, database-writing routes/services, `scripts/test-stabilization.mjs`

1. Add failing pure-function tests for absent/invalid/valid cron secrets and loopback/production mutation decisions.
2. Implement shared guard decision functions with stable codes `CRON_NOT_CONFIGURED`, `UNAUTHORIZED`, and `MUTATIONS_DISABLED`.
3. Remove query-string cron authentication; accept bearer authentication only.
4. Apply the local mutation guard to non-scheduler write handlers while leaving preview/read handlers usable.
5. Replace source-level `new PrismaClient()` instances with `src/lib/prisma.js`.
6. Run guard tests and a production build; expected: assertions pass and compilation succeeds.

**Consumes:** Task 1 server/client boundary. **Produces:** shared route security and one Prisma pool per process.

## Task 3 — Import and calculation integrity

**Files:** `src/lib/importers/batchUploadProcessor.js`, `src/app/api/import/batch/route.js`, `scripts/test-stabilization.mjs`

1. Add failing regression assertions for WATER normalization and the `importedAt` history field.
2. Correct WATER calculator inputs and convert `costSavedJuta` to stored rupiah explicitly.
3. Correct import history ordering and clamp the requested history limit.
4. Enforce the supported commit categories; unsupported development modules may preview but cannot commit.
5. Keep PLN purchased energy and PLTS generated energy explicitly classified.
6. Run focused import tests, then the existing calculator/import suites.

**Produces:** correct persisted WATER values and stable import contracts.

## Task 4 — Last-known-good iSolar contract and metric truthfulness

**Files:** `src/lib/solar/freshness.js`, `src/lib/solar/sync.js`, `src/app/api/isolar/route.js`, `src/components/PLTSTab.jsx`, `scripts/test-stabilization.mjs`

1. Add failing pure-function tests for `FRESH`, `STALE`, `VENDOR_UNAVAILABLE`, and `NO_DATA` decisions, including invalid freshness configuration.
2. Compute freshness from the last successful sync, not merely the latest failed attempt.
3. Return `freshnessStatus`, `vendorAvailability`, `lastSuccessfulSync`, `lastSyncAttempt`, and safe error codes from `/api/isolar`.
4. Preserve cached station data during vendor failure and display a compact stale/vendor warning in the existing PLTS header area.
5. Mark point `83023` as experimental/unproven in API output and UI; do not present it as official daily PR.
6. Run focused freshness/status tests and the existing solar processor/backend suites.

**Consumes:** Task 2 guarded server boundary. **Produces:** stable telemetry freshness contract consumed by the UI.

## Task 5 — Prisma migration baseline without touching live data

**Files:** `prisma/migrations/20261001000000_baseline/migration.sql`, `docs/database-migration.md`, `package.json`

1. Generate SQL from an empty PostgreSQL schema to the checked-in Prisma schema.
2. Inspect the SQL for destructive statements; expected: create/index/constraint statements only.
3. Document separate new-database and existing-database procedures, including backup, schema diff, and explicit baseline marking.
4. Run `npx prisma validate` and regenerate the client locally; do not run migrate deploy/reset/resolve against the configured database.

**Produces:** versioned schema history and a safe operator procedure.

## Task 6 — Responsive polish and final verification

**Files:** existing layout/navigation/components and `src/app/globals.css`; documentation as needed

1. Audit the current layout at 360 px, 768 px, and desktop widths using existing responsive classes.
2. Fix only concrete overflow, viewport, touch-target, drawer focus/scroll, table, chart-height, and dialog-width defects.
3. Add accessible status semantics for loading, stale, vendor unavailable, empty, and offline states without changing the product structure.
4. Reconcile README field mappings and scheduler descriptions with implemented behavior.
5. Run focused stabilization tests, existing non-vendor tests, Prisma validation, and `npm run build`.
6. Review the complete diff for secret exposure, destructive SQL, accidental design restructuring, and unrelated edits.

**Consumes:** freshness fields from Task 4. **Produces:** the approved stabilization result.

## Review focus

- Requests that spoof host headers or omit production secrets.
- A failed sync following an older successful sync with valid cached plants.
- WATER unit conversion between tonnes, kilograms, juta rupiah, and rupiah.
- Browser bundles or error messages containing vendor credentials.
- Migration SQL that could alter or drop an existing table.
- Narrow-screen horizontal overflow and controls smaller than practical touch targets.
