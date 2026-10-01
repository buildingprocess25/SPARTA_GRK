# iSolar Monthly History Import and YoY Dashboard Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-01-isolar-monthly-history-import-design.md`

## Global constraints

- Preserve all pre-existing user changes in the dirty worktree; stage only files intentionally changed for this feature.
- Use the two named CSV files from the workspace root and never copy them from or resolve them through a scratch path.
- Do not create plants, aliases, daily observations, or telemetry snapshots from the reports.
- Preserve numeric zero as observed data and preserve empty/`--` cells as unavailable.
- Keep Lombok A/B and Cilacap 1/2/3 as independent `ps_id` records.
- Never overwrite finalized API/manual history on conflict. A closed-month `api_live_partial` row may be finalized only under the approved audited policy.
- Start every implementation task with a failing regression assertion and watch it pass after the change.
- Do not call the live iSolar vendor API from tests.
- Database mutations must be preceded by a fresh dry-run and followed by direct query evidence.

## Task 1 — Provenance schema and safe migration

**Files:** `prisma/schema.prisma`, `prisma/migrations/20261001090000_isolar_monthly_import_audit/migration.sql`, importer schema tests

1. Add a failing schema assertion for the required `MonthlyYield` provenance fields and compound `ImportBatch(module,fileHash)` identity.
2. Extend the Prisma schema with nullable source file, row, hash, batch, import timestamp, measurement type, quality, and metadata fields plus the batch relation.
3. Add an additive-only migration containing `ALTER TABLE ... ADD COLUMN`, index, unique constraint, and foreign key statements; include no drop, truncate, or data rewrite.
4. Run the schema assertion, `npx prisma validate`, and `npx prisma generate`.
5. Commit only the schema, migration, and test changes for this task.

**Expected:** schema assertions pass; Prisma validates and generates; migration inspection finds no destructive statement.

**Produces:** audit-capable canonical monthly storage consumed by Task 3.

## Task 2 — Strict report parser and explicit plant mapping

**Files:** `src/lib/importers/isolarMonthlyReport.js`, `src/lib/importers/__tests__/isolarMonthlyReport.test.mjs`

1. Add failing parser tests against both original workspace CSVs for BOM, delimiter, metadata year, headers, row counts, missing counts, numeric zeroes, monthly totals, hashes, and physical line numbers.
2. Add failing mapping tests for all 39 names and explicit independent IDs for Lombok A/B and Cilacap 1/2/3.
3. Add failing rejection tests for invalid encoding, delimiter/header, unit, period/year mismatch, invalid number, ambiguous/unknown plant, and duplicate plant-period.
4. Implement the pure parser and strict alias resolver without database access.
5. Run the focused Node test file and commit the parser and tests.

**Expected:** 2025 parses as 460 valid plus 8 missing totaling 6,482,001.90 kWh; 2026 parses as 351 valid plus 117 missing totaling 4,804,338.80 kWh; all mapping and rejection tests pass.

**Produces:** validated normalized observations consumed by Task 3.

## Task 3 — Dry-run reconciliation and idempotent importer

**Files:** `src/lib/importers/isolarMonthlyImport.js`, `src/lib/importers/__tests__/isolarMonthlyImport.test.mjs`, `scripts/import-isolar-monthly-history.mjs`, `package.json`

1. Add failing unit tests using an injected repository for NEW, IDENTICAL, FINALIZE_PARTIAL, CONFLICT, MISSING, ERROR, duplicate hash, and transaction rollback behavior.
2. Implement reconciliation using `(YYYYMM, ps_id, MONTHLY_YIELD)` and a 0.005 kWh comparison tolerance.
3. Implement the approved precedence rule: closed `api_live_partial` may be finalized with previous values retained in batch audit metadata; `api_history`, manual, and unknown conflicts are skipped.
4. Implement dry-run as the default CLI mode and require `--commit` for mutations.
5. Emit per-file and combined JSON/text summaries containing format, mapping, totals, row-level conflicts, and insert/finalize/skip/error counts.
6. Use bounded Prisma transactions and the compound batch hash identity so repeat imports perform no duplicate mutation.
7. Run focused tests and commit the importer, CLI, package script, and tests.

**Expected:** all policy branches and rollback cases pass without a real database or vendor API call.

**Consumes:** Task 1 provenance schema and Task 2 parsed observations. **Produces:** safe dry-run/commit workflow consumed by Tasks 4 and 7.

## Task 4 — Database migration, dry-run, commit, and reconciliation

**Files:** no product-source changes unless a test exposes a defect; generated reports remain in the ignored plan workspace

1. Query migration status and current monthly source counts without mutation.
2. Apply the additive migration to the configured project database.
3. Run the importer dry-run against both original files and compare every count and total with the spec.
4. If the dry-run has mapping/parser errors or unexpected finalized-source mutations, stop the commit and fix via RED→GREEN.
5. Run `--commit` for both files.
6. Run the exact same import again and prove zero duplicate monthly mutations.
7. Query database totals, sources, import batches, hashes, Lombok IDs, Cilacap IDs, and unresolved conflicts.

**Expected:** database evidence distinguishes inserted, finalized, identical, conflict, missing, and error counts; the repeated import is idempotent.

**Consumes:** Task 3 importer. **Produces:** canonical 2025/2026 database history consumed by Task 5.

## Task 5 — Shared historical and year-over-year query service

**Files:** `src/lib/solar/history.js`, `src/lib/solar/__tests__/history.test.mjs`, `src/lib/solar/summarize.js`, `src/app/api/overview/plts/route.js`, `src/app/api/emissions/route.js`

1. Add failing pure aggregation tests for 2025, 2026, January-vs-January, aligned YTD, real zero, missing values, plant/grid filters, source quality, and current-month partial precedence.
2. Implement one shared historical aggregation service with repository injection for tests.
3. Generate available years and period options from database observations without creating a cross-year default YTD.
4. Prevent monthly and daily current-period energy from being added together.
5. Return aligned Jan–Dec series, per-plant rows, KPI totals, deltas, percentage changes, availability, quality, and emission-factor metadata.
6. Adapt overview and emissions routes to the shared service while preserving existing response fields needed by current clients.
7. Run focused history/API tests and commit tracked files; document any intentionally uncommitted pre-existing target file in the ledger.

**Expected:** January 2025 and January 2026 remain distinct and comparable; aligned YTD uses the same final month; missing values serialize as `null`, not zero.

**Consumes:** Task 4 canonical monthly history. **Produces:** one history contract consumed by Task 6.

## Task 6 — Dashboard comparison, filters, and export

**Files:** `src/components/PLTSSummaryCard.jsx`, `src/components/PLTSTab.jsx`, focused dashboard contract tests

1. Add failing contract assertions for year options, explicit comparison mode, aligned month labels, partial labels, unavailable markers, and filtered historical CSV export.
2. Add 2025, 2026, single-month, year-specific YTD, and YoY selections sourced from the server response.
3. Render two aligned year series and comparison KPIs with absolute and percentage deltas only when mathematically valid.
4. Make KPI, chart, table, grid filter, plant filter, search, and export derive from the same historical response.
5. Preserve independent physical plant rows and display missing history as unavailable.
6. Ensure manual telemetry refresh does not mutate or reset selected historical data.
7. Run focused UI/contract tests and a production build, then commit only feature-owned changes where ownership is separable.

**Expected:** dashboard requests and displays database-backed 2025/2026 comparisons consistently and build succeeds.

**Consumes:** Task 5 history contract. **Produces:** approved comparison workflow.

## Task 7 — End-to-end verification and evidence report

**Files:** `scripts/test-isolar-monthly-history.mjs`, existing relevant test scripts, plan ledger

1. Add an end-to-end verification script that checks database counts/totals against valid CSV details and exercises 2025, 2026, January comparison, Lombok, and Cilacap queries.
2. Run parser, importer, history, dashboard contract, existing relevant regression, full `npm test`, Prisma validation, and production build commands.
3. Run direct database reconciliation and the importer one final time in dry-run/idempotency mode.
4. Review the complete feature diff for destructive SQL, source-precedence errors, double counting, hidden zero coercion, and accidental plant merging.
5. Commit verification code and prepare the final evidence report from command output and database queries.

**Expected:** all relevant tests and production build pass; database totals equal the canonical committed result; no duplicate import is possible.

**Consumes:** all prior tasks. **Produces:** verified implementation and auditable delivery evidence.

## Review focus

- UTF-8 decoding that silently accepts malformed input or a changed delimiter/header.
- Empty cells or `--` becoming zero through JavaScript coercion or Prisma defaults.
- Name normalization merging Lombok A/B, Cilacap variants, or unknown plants.
- `api_history` conflicts being overwritten or `api_live_partial` being finalized before month close.
- File hash idempotency that records duplicate batches or applies mutations twice.
- Current-month daily values being added to an existing monthly value.
- Cross-year YTD ranges and comparisons with unequal month bounds.
- Percentage changes calculated from missing or zero baselines.
- KPI, chart, table, filters, and export querying different datasets.
- Emission factor values being altered to match source-report totals.
