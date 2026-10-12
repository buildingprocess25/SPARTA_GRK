# antislop audit 004 — follow-up report — 2026-10-12

Both findings approved and fixed. Lint (0 errors across all 33 touched files) and a full production build were run after the changes. Nothing was committed or pushed, per your standing instruction.

---

## Finding 1 — Inverted muted-text color pairing (HIGH) — FIXED

`text-slate-400 dark:text-slate-500` swapped to `text-slate-500 dark:text-slate-400` across all 162 occurrences in 30 files (`AlarmDialog.jsx`, `CalculatorStepper.jsx`, `EmissionFactorsReference.jsx`, `PLTSAnalyticsSection.jsx`, `Sidebar.jsx`, `KpiCard.jsx`, and 24 others). Re-verified with the skill's contrast checker: `#64748B` (slate-500) on white is now **4.76:1, PASS**, versus the old `#94A3B8` (slate-400) at 2.56:1, fail. Confirmed zero instances of the inverted pairing remain anywhere in `src`.

## Finding 2 — Weak focus indicator on form inputs (MEDIUM) — FIXED, plus 4 more found while fixing it

The 42 `focus:outline-none focus:border-{color}-500` instances identified in the audit were all given a matching `focus:ring-2 focus:ring-{color}-500`, standardizing them on the same strong-ring pattern already used by the app's buttons and modals (border-color change kept alongside the new ring, not replaced).

While applying the fix, a second, closely-related variant turned up that the audit's grep pattern had missed (it matched `focus:outline-none focus:border-...` specifically, and these used a bare `outline-none` with no `focus:` prefix, or `focus:outline-none` with nothing after it at all - meaning some of these had **no** focus indicator whatsoever, not even a weak one):

- `EmissionFactorsReference.jsx` (search input)
- `SearchableSelect.jsx` (search input + select, 2 instances)
- `PLTSAnalyticsSection.jsx` (page-size select) - this one had zero focus style at all
- `EmisiResumeTab.jsx` (the "Rincian Komparasi" collapsible toggle button) - also zero focus style at all

These are squarely the same finding (a reachable control with no visible keyboard-focus indicator), just not caught by the exact string the audit searched for, so they were fixed as part of the same pass rather than left half-done. All 4 now have `focus:ring-2 focus:ring-blue-500` (plus `focus:border-blue-500` on the two inputs, matching their siblings). Two other candidates that looked similar at first glance (`CalculatorEntryForm.jsx` / `EmissionCalculatorPage.jsx`'s shared `fieldClass`) turned out to already have a ring (`focus:ring-2 focus:ring-blue-100`) and were left alone - confirmed by reading the full class string, not just the grep snippet.

---

## Verification

- `npx eslint` on all 33 files touched: **0 errors** (525 pre-existing warnings, unrelated to this work).
- `next build` (throwaway dist dir): **succeeded**.
- Contrast re-verified with the skill's own `contrast-check.py` script, not eyeballed.
- Final greps confirm zero remaining instances of both the inverted color pairing and the ring-less focus pattern anywhere in `src`.
- `pnpm-lock.yaml` drift from the build reverted (production installs via `npm ci`, not pnpm).

Nothing has been committed or pushed.
