# antislop audit 001 — follow-up report — 2026-10-12

All 4 findings from `audit-001-2026-10-12.md` approved and fixed. Lint (0 errors across every touched file) and a full production build were run after each group of changes; the real-data computation was additionally re-verified against the live database before and after the fix. No commit or push was made, per your standing instruction.

---

## Finding 1 — Dashboard landing-page KPIs were mock data (HIGH) — FIXED

`src/components/EmisiResumeTab.jsx` no longer reads `resumeKPI` from the mock `SustainabilityContext`. It now fetches real data on mount from the same endpoints the report export and the Scope 1/2 bridge panels already use (`/api/scope1`, `/api/water-recycle`, `/api/emissions`, `/api/plts/dashboard/summary`), and computes Net Emissions, Emisi Kotor, Total Offset, and Total Penghematan Biaya from that. All 4 KPI cards, the `MainScope2Bridge` prop, and the 5 downstream usages in the "Rincian Komparasi" detail panel now show the same real figures.

Also fixed along the way: the "EMISI KOTOR" card had a hardcoded, never-updating "Listrik PLN (97.9%) & Solar Genset (2.1%)" trend line — it was a fabricated number with no source. It's now computed live from the real Scope 1/Scope 2 split. The "TOTAL OFFSET" card's trend line (PLTS MWh + water m³) was also switched from mock to real.

Loading and error states were added (R-27): cards show "—" / "Memuat..." while fetching, and an error banner with the actual error message if the fetch fails.

**Verified against the live database**: scope1Ton 7.617, scope2Ton 10248.702, grossEmissionTon 10256.319, pltsAvoidedTon 3727.934, waterAvoidedTon 2.037, netEmissionTon 6526.348, netReductionPct 36.4% — consistent with every other real-data figure already verified elsewhere in this project.

**Known, disclosed scope boundary**: the "Tren Bulanan Penambahan vs Pengurangan Emisi" chart and table further down the same page (`monthlyComparisonData`, built from `scope1.monthlyTrend` / `scope2.monthlyTrend` / `pltsData.monthlyTrend` / `waterData.monthlyTrend`) still reads from the mock context and was **not** touched by this fix. Finding 1 targeted the Hard Gate violation specifically named in the audit — the top-level KPI row and its direct downstream readouts, which is what a reader sees and trusts first. Rewiring the monthly trend chart/table to real data is a separate, comparably-sized task (it needs a monthly-granularity PLTS-avoided breakdown that doesn't exist yet in `/api/emissions`, similar to the Scope 2 monthly trend work done earlier this session) and should be scoped as its own follow-up if you want it done.

## Finding 2 — Em dash as copy punctuation (HIGH) — FIXED

Found and fixed 36 instances (11 more than the audit's initial estimate of ~25 — a second, more careful scan after approval caught additional cases the first regex missed, including bracketed dropdown labels like `[{code}] name — region`). Across 16 files: `calculatorConfig.js`, `CalculatorEntryForm.jsx`, `CalculatorEntryList.jsx`, `CalculatorRecap.jsx`, `InputDataTab.jsx` (13 instances), `PenambahEmisiTab.jsx`, `EmisiResumeTab.jsx`, `OverviewTab.jsx`, `PLTSAnalyticsSection.jsx`, `PLTSTab.jsx`, `Scope1InputModal.jsx`, `Scope2InputModal.jsx`, `WaterRecycleInputModal.jsx`, `factors.v1.js`, `suggestions.js`, `annualLoadReport.js`, `history.js`.

Each was replaced with whichever of comma / period / colon / parentheses fit the sentence, per R-02. The `'—'` empty-data-placeholder convention (used throughout the app's tables for "no data available") was left untouched — it's a different pattern, not covered by this rule. A final re-scan confirmed zero remaining em dashes in UI-facing text; the only remaining em dashes in the codebase are inside code comments, which are outside R-02's scope (it governs text the agent writes for display, not internal comments).

## Finding 3 — Generic Sparkles icon (MEDIUM) — FIXED

- `EmisiResumeTab.jsx`: "Total Penghematan Biaya" KPI card now uses `Calculator` (already the convention for cost figures elsewhere in the app, e.g. the Scope 1 "Biaya BBM" cards) instead of `Sparkles`.
- `PLTSAnalyticsSection.jsx`: "Analisis Multi-DC & Ranking Kinerja PLTS" section header now uses `Award` (already imported and used for similar ranking/achievement concepts in the same file) instead of `Sparkles`.
- Cleaned up the 4 dead `Sparkles` imports noted in the audit (`Header.jsx`, `PLTSMonthlyMatrixTable.jsx`, `PLTSTab.jsx`, `TabSystemPerformancePr.jsx`) since they were never rendered.

## Finding 4 — Scattered backdrop-blur with no written purpose (LOW) — FIXED

- 3 Recharts tooltip containers in `PLTSAnalyticsSection.jsx`: added one comment above the shared tooltip function documenting the purpose (legibility over chart gridlines).
- `TabProductionTarget.jsx` and `TabSystemPerformancePr.jsx`: same one-line comment added at each tooltip.
- `CalculatorEntryForm.jsx`'s sticky form action bar: comment added.
- `PLTSDashboardSkeletons.jsx`'s skeleton loader: on closer look this one had no real justification (nothing behind a loading skeleton needs blurring), so `backdrop-blur-md` was removed rather than justified.

---

## Verification

- `npx eslint` on every file touched across all 4 findings: **0 errors** (359 pre-existing warnings, all unrelated to this work — mostly `no-unused-vars` and `react-hooks/exhaustive-deps` that predate this session).
- `next build` (throwaway dist dir): **succeeded**, including after Finding 1's new API calls.
- Finding 1's real-data math independently re-verified against the live database via a standalone script, matching figures already confirmed elsewhere in this project.
- `pnpm-lock.yaml` drift from running the build was reverted (production installs via `npm ci`, not pnpm, so this file is vestigial and not meant to track build-time changes).

Nothing has been committed or pushed, per your standing instruction.
