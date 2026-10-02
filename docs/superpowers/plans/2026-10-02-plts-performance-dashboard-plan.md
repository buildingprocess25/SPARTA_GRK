# PLTS Performance Dashboard Implementation Plan

Spec authority: `C:\Users\valen\.codex\attachments\2372674f-a886-455b-8e80-39939c13b996\pasted-text.txt`

## Global constraints

- Preserve the protected Overview/Resume interactions and the Live iSolarCloud tab.
- Use only the project owner's existing RKAP calculations and table concepts; external sources must not replace their figures.
- No dummy values. Missing measurements render as unavailable with the required input named.
- One database-backed dashboard aggregation path and one shared global filter state.
- Vendor discovery is capped at eight calls and all calls go through the metered API client.
- Every task is test-first and independently committed where the dirty worktree permits safe staging.

## Task 1: Lock existing behavior and establish dashboard contracts

- Add a source-level before/after feature-lock verifier with file:line inventory.
- Add failing contract tests for period parsing, source resolution, target achievement, factor eligibility, PR validity, and like-for-like comparison.
- Define the shared dashboard query/filter contract and source-resolution policy.
- Expected: verifier is green before product changes; new contract tests initially fail for missing modules.

## Task 2: Add target, climate/load, and source-preserving data models

- Add Prisma models/migration for monthly targets and optional monthly climate/load measurements.
- Add an idempotent RKAP target importer sourced from `sustainabilityData`.
- Preserve report and API observations for conflicting monthly yields without overwriting either source.
- Expected: generated Prisma client succeeds; target dry-run and commit reconcile Jan-Aug 3,960 MWh and Jan-Sep 4,435 MWh.

## Task 3: Build the single dashboard aggregation service and JSON route

- Implement validated dashboard query parsing and one aggregation service.
- Implement report-preferred completed-month resolution, >5% conflict flags, official-factor exclusion, full-coverage specific yield, PR validity, and like-for-like YoY.
- Add `GET /api/plts/dashboard` with stable JSON success/error envelopes and no vendor calls.
- Expected: contract tests pass and route tests prove JSON responses for invalid input and failures.

## Task 4: Add shared Overview filters and additive performance UI

- Lift period/mode/month/grid/plant filters to the Overview owner and preserve URL parameters.
- Extend the existing summary with target/progress/savings, separate PR card, target/chart toggles, and source/conflict detail.
- Add the tabbed `Analisis Kinerja PLTS` card between summary and emissions.
- Connect emissions to the same filters and render missing PLN/factors honestly.
- Expected: feature lock remains green, no removed protected controls/columns, no page-level horizontal overflow.

## Task 5: Perform bounded iSolar measurement discovery

- Use the metered client for at most eight discovery calls.
- Persist only proven monthly radiation/module-temperature/load measurements; never integrate instantaneous values.
- Add the BMES national-monthly fallback importer and honest empty states.
- Expected: report every call, point name/unit, result, and whether data was persisted.

## Task 6: Reconcile, verify, build, and review

- Print Jan-Sep official/CSV/database reconciliation, all 15 source conflicts, like-for-like YoY, factor impact, and new-card values.
- Run feature lock after changes, focused tests, full tests, production build, and responsive height/overflow checks.
- Perform a fresh whole-branch code review and one TDD fix pass for Critical/Important findings.
- Expected: all required evidence is captured from actual command/database output; unproven items are listed explicitly.

## Review focus

- No protected Overview behavior regresses.
- CSV/API conflicts stay independently auditable and are not double-counted.
- Missing load, climate, or official factor data never becomes zero or an estimate.
- All visible totals use the same resolved plant-month set and filter state.
- No vendor call occurs from the dashboard GET route.
