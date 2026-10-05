# PLTS Offline, PR, and Baseline Bug-Fix Plan

## Goal

Fix the three reported dashboard bugs without changing the existing golden snapshots, close the outstanding daily-yield/test-contamination/climate/PR-exclusion/COD findings, and keep automatic scheduling disabled.

## Constraints

- Treat the current branch and dirty worktree as shared user work; do not discard unrelated changes.
- Do not invent the two portal-offline plant names or the portal PR comparator while the supplied placeholders remain empty.
- Vendor status semantics require vendor documentation or raw-response evidence; unknown codes stay unknown.
- Offline telemetry must not become a valid zero-production observation.
- PR uses only one canonical energy observation per plant-period, valid and consistently typed irradiation, and effective capacity for plants commissioned by that period. Any excluded plant is removed from numerator and denominator.
- `auditBaseline=false` means no baseline read, calculation, API field, or eager client import.
- Golden snapshot JSON files must remain byte-identical.
- Do not enable the automatic scheduler.

## Task 1 — Evidence lock and root-cause inventory

1. Hash and verify existing golden snapshots.
2. Inventory status flow, PR flow, baseline references, DB schema/state, daily-yield anomaly, and test mutations.
3. Capture raw vendor status fields for offline candidates and 2–3 normal comparators within the existing API-call budget.
4. Locate primary vendor documentation for status-code meaning; record unsupported semantics as unknown.

## Task 2 — Persisted plant status

1. Add failing unit/integration tests for two mocked offline plants, persistence, endpoint/UI projection, revalidation, and zero-production exclusion.
2. Add or repair the canonical persisted status record (category, reason, raw fields, checked time).
3. Make sync persist status and invalidate the dashboard cache; make the dashboard read it.
4. Render offline count and auditable plant list/status.

## Task 3 — Canonical PR

1. Add failing tests for per-plant monthly PR inputs, weighted aggregate, COD, missing/invalid irradiation, numerator-denominator symmetry, anomaly bounds, and card/table/tab equality.
2. Trace and remove duplicate/proxy/baseline-derived inputs.
3. Normalize and expose irradiation unit/type/source and show monthly PR in recap when available.
4. Produce the requested per-plant reconciliation table and explain only evidence-backed differences.

## Task 4 — Audit Baseline isolation

1. Record repo and DB baseline-reference inventory.
2. Add failing tests proving `auditBaseline=false` removes baseline reads, response fields, calculations, and eager imports.
3. Replace static baseline imports with a gated dynamic path used only when the flag is on.
4. Run the requested hard test with guaranteed restoration of the file and DB values; compare golden hashes and dashboard output.

## Task 5 — Outstanding data-integrity findings

1. Reconcile `daily_yield` for 2026-10-02 and correct only proven bad/duplicate observations with an auditable transaction.
2. Identify and isolate/remove proven test contamination; make mutating tests use test fixtures/cleanup.
3. Verify climate consistency and COD rules across all PR consumers.

## Task 6 — Verification and report

Run focused tests, the relevant full suite, production build, DB reconciliation queries, raw JSON/table/grep evidence, and final review. Report unresolved owner-input gaps explicitly, then wait for approval.

## Review focus

- No hidden baseline fallback when the flag is false.
- No real database mutations from tests.
- No offline-as-zero production semantics.
- No PR numerator/denominator population mismatch or duplicate energy.
- No golden snapshot drift and no scheduler activation.
