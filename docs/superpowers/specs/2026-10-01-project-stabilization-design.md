# SPARTA Project Stabilization Design

**Date:** 2026-10-01  
**Status:** Approved in conversation; awaiting written-spec review  
**Scope:** Development hardening, data integrity, iSolar resilience, and responsive polish

## 1. Purpose

Prepare the local SPARTA Next.js application for continued feature development without redesigning the existing product. The work will protect the live iSolarCloud integration, make PostgreSQL the reliable persistence layer, remove known data-integrity defects, and improve small-screen usability while preserving the current navigation, visual identity, and page structure.

Success means:

- iSolarCloud failures never erase valid telemetry or turn missing data into zero.
- PostgreSQL provides last-known-good telemetry and remains the system of record for sustainability transactions.
- Known importer, API, Prisma, status-mapping, and credential issues are fixed.
- Existing pages remain recognizable and usable at 360 px, 768 px, and desktop widths.
- Future features can use clear server contracts without depending on business values stored in browser localStorage.

## 2. Constraints

- Frontend remains Next.js 15 and React 19.
- Backend remains Next.js route handlers, Prisma, and PostgreSQL.
- The application is currently local, but it uses a live vendor API.
- Existing PostgreSQL data must be preserved; schema changes must be additive or safely migrated.
- No large UI redesign, navigation restructure, new state framework, or unrelated refactor.
- Automated verification must not repeatedly call the live vendor API.

## 3. Data Ownership

### 3.1 iSolar telemetry

PostgreSQL is a persistent cache and history store for iSolar telemetry. The server-side sync process is the only component that contacts iSolarCloud. UI requests read the database through `/api/isolar`.

The sync process must:

1. Fetch vendor data through server-only credentials.
2. Validate response success, plant count, identifiers, units, and basic physical plausibility.
3. Write only validated observations.
4. Preserve the previous valid observation when a request is incomplete or fails.
5. Record sync health independently from plant operational status.

The API payload must distinguish:

- `FRESH`: a recent validated vendor observation.
- `STALE`: last-known-good data older than the freshness threshold.
- `VENDOR_UNAVAILABLE`: the most recent sync failed, but cached data is available.
- `NO_DATA`: no validated observation has ever been stored.
- `Offline`: an operational status explicitly reported by the vendor, not a connectivity failure between SPARTA and the vendor.

The payload will include `freshnessStatus`, `dataAgeMinutes`, `lastSuccessfulSync`, `lastSyncAttempt`, and `vendorAvailability`.

The freshness threshold is configured by `ISOLAR_STALE_AFTER_MINUTES` and defaults to 15 minutes, which tolerates two missed five-minute polling windows. Invalid or absent configuration falls back to that default rather than treating old data as fresh.

### 3.2 Sustainability transactions

PostgreSQL is the permanent source of truth for fuel, PLN, PLTS monthly measurements, water recycling, targets, facilities, factors, and import audit records. Browser localStorage may store UI preferences, but it must not be authoritative for business totals or transaction history.

### 3.3 Audit and fallback data

Workbook baselines and static fixtures retain explicit provenance labels. They must not silently replace live data. Audit values may support comparisons and empty-development views, but API responses must expose their source.

## 4. Component Boundaries

The implementation will preserve current routes and UI structure while clarifying responsibilities:

- **Solar vendor client:** authentication, allowlisted requests, quota checks, and secret-safe errors.
- **Solar sync service:** orchestration, response validation, and last-known-good write decisions.
- **Solar repository:** Prisma reads and writes for telemetry, history, quota, locks, and sync runs.
- **Dashboard payload builder:** converts database records into a stable client contract.
- **Sustainability transaction service:** validates and persists operational transactions.
- **Import validation service:** parses files and produces a read-only preview.
- **Import commit service:** commits validated rows idempotently and records batch results.
- **Presentation components:** render API state and responsive behavior without owning business totals.

Large UI files will not be broadly rewritten. A component is extracted only when the stabilization work directly touches a coherent section and extraction reduces regression risk.

## 5. Security Hardening

- Add `.gitignore` entries for `.env*`, `.data/`, `.next/`, `node_modules/`, `.superpowers/`, logs, and generated artifacts, while allowing an `.env.example` without values.
- Remove vendor credential fallbacks from client-importable modules.
- Ensure iSolar secrets and access tokens remain server-only and never enter API responses or client bundles.
- Use the shared Prisma singleton in all route handlers and services.
- Scheduler mutation endpoints fail closed when `CRON_SECRET` is absent. Read-only health endpoints may remain available locally but must not expose sensitive records.
- Add one shared mutation guard for non-scheduler database-writing APIs. In non-production it permits requests only when the request URL resolves to the loopback host (`localhost`, `127.0.0.1`, or `[::1]`). In production it always fails closed with `503 MUTATIONS_DISABLED` until a real user-authentication layer is implemented; a header or secret embedded in browser code is not an acceptable substitute.
- Scheduler endpoints use a separate server-to-server bearer check against `CRON_SECRET`, return `503 CRON_NOT_CONFIGURED` when the secret is absent, and return `401 UNAUTHORIZED` for a missing or invalid bearer value.
- Sanitize logs and error responses to exclude credentials, tokens, and database connection strings.

Credential rotation is an external operational action. Code changes will remove exposure paths, but the current iSolar keys should be rotated separately because they have existed in source code.

## 6. Database and Prisma

- Create a reviewed initial migration from the current Prisma schema. For an existing database, compare the live schema with the migration first and mark the baseline as applied only when the relevant structures match; apply only additive follow-up migrations afterward. A new local database applies the baseline normally.
- Take a PostgreSQL backup before any migration is applied to an existing database. The implementation may generate and validate migration files locally, but it must not reset, deploy to, or mark a migration on an existing database without an explicit operator command.
- Replace runtime table creation in the snapshot request path with managed Prisma migrations.
- Keep sync/import operations idempotent through unique constraints and upserts.
- Preserve existing records during migration.
- Use explicit transactions for multi-record commits where partial state would be misleading.
- Keep telemetry cache models separate in responsibility from sustainability transaction models.

## 7. Required Integrity Fixes

The stabilization includes these known defects:

1. Correct WATER batch-calculator argument and return-field names so avoided emissions and cost savings are persisted.
2. Order import history by `importedAt`, matching the Prisma model.
3. Separate or explicitly classify PLN consumption and PLTS generation in workbook imports so category semantics match stored values.
4. Validate supported modules server-side. EV and efficiency remain visible only as development features and cannot be committed until backend models and methodology are designed.
5. Apply the documented vendor status mapping: offline, fault, alarm, normal; include both `fault_count` and `alarm_count`.
6. Treat iSolar point `83023` as an experimental instantaneous metric, not proven daily Plant PR.
7. Align inverter point documentation with the verified implementation for `p1`, `p4`, and `p24`.
8. Align scheduler and quota documentation with actual five-minute polling and thirty-minute snapshots.
9. Validate facility, period, units, non-negative values, required proof references where applicable, and draft/final factor rules on the server.
10. Fix API/schema field mismatches and return stable error codes for client handling.

## 8. Error Handling and Observability

- Vendor failures create failed sync-run records and preserve cached telemetry.
- Database failures return controlled errors and never masquerade as verified fixture data.
- Manual refresh keeps its cooldown and returns a clear result: refreshed, skipped, stale cache served, quota blocked, or failed.
- File preview never writes to the database.
- File commit reports committed, unchanged, conflicted, draft, and invalid rows separately.
- UI states distinguish loading, empty, error, stale, vendor unavailable, and plant offline.
- Sync logs record safe error codes, duration, plant counts, and HTTP-call counts.

## 9. Responsive Polish

The existing design remains intact. Changes are limited to usability and visual refinement:

- Keep the desktop sidebar and existing mobile drawer pattern; improve focus handling, overlay behavior, body scroll locking, and touch targets.
- Adjust page gutters and vertical spacing for narrow screens.
- Make KPI grids flow from desktop columns to two columns and then one column where needed.
- Give charts safe minimum heights and simplify axis/legend density on small screens.
- Preserve desktop tables. Add safe overflow where appropriate and use a compact card representation on mobile only for tables that remain unreadable.
- Make input fields full-width on mobile and keep primary actions easy to reach.
- Constrain profile panels and dialogs to the viewport.
- Add consistent loading, empty, error, stale, and offline treatments using the existing color language.
- Preserve existing colors, typography, menu order, tab structure, and information architecture.

## 10. Testing Strategy

Automated tests will cover:

- Carbon calculators and unit normalization.
- WATER batch import calculations.
- Import history field contracts.
- Fault/alarm/offline mapping.
- Last-known-good behavior when vendor requests fail or return incomplete data.
- Sync and import idempotency.
- `/api/isolar` and `/api/sustainability` response contracts.
- Secret absence from client-importable configuration and production bundles.
- Responsive smoke checks at 360 px, 768 px, and desktop width.
- Production build and Prisma schema/migration validation.

Vendor-dependent diagnostics remain opt-in scripts, not part of the ordinary automated test run.

## 11. Delivery Order

1. Repository hygiene and server-only secret handling.
2. Prisma singleton and safe migration baseline.
3. Import/API/status integrity fixes with regression tests.
4. Last-known-good telemetry contract and UI stale states.
5. Removal of browser-owned business state.
6. Responsive polish of existing components.
7. Documentation reconciliation and full non-vendor verification.

Each phase must leave the application buildable and avoid destructive database operations.

## 12. Out of Scope

- Full authentication and role-based access control.
- A new visual design system or navigation structure.
- Replacing Next.js, Prisma, PostgreSQL, Recharts, or the Excel library.
- Completing EV and energy-efficiency accounting methodology.
- Changing corporate emission factors without approved source documents.
- Rotating vendor credentials automatically.
