<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.agents/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.agents/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.agents/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.agents/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.agents/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->

## Project Rules

- **Never commit or push.** Do not run `git commit`, `git push`, or anything that creates or publishes commits (including amend, rebase, tags, or PR creation). Leave all changes in the working tree; the user commits and pushes.
- **The DC total is 37** in every label, report and doc. The iSolarCloud account has 39 plants because it includes the 2 Drive Thru pilot stores (`facilityType: 'STORE'`), which `isDcLocation()` excludes. Gorontalo is one of the 37 but has no PLTS yet, so it stays "dalam pembangunan".
- **Refer to [CLAUDE.md](file:///c:/ALfa/Test/CLAUDE.md)** for all other project guidelines, detailed architecture, and domain conventions.
- **`src/` is TypeScript.** Write new files as `.tsx` when they contain JSX and `.ts` otherwise; never add `.js` or `.jsx` files under `src/`. Import `src/lib` modules by their `.ts` path (e.g. `../../src/lib/units.ts`) from scripts and tests, which stay `.mjs` and run on Node 22 type stripping, so keep `src/lib` syntax erasable (no `enum`, `namespace`, or parameter properties) and use `import type` for type-only imports.
- Run `pnpm run typecheck` after code changes; it must report 0 errors.
- **Docs follow code.** Any change to behaviour, numbers, data sources, models, env vars or deploy steps updates the matching docs in the same change: `docs/SPARTA-GRK.md` (features, schema, methodology, auth), `docs/DEPLOY.md` and `.env.example` (setup), plus any feature doc it touches.

## Script Organization & Verification Rules

Never create ad-hoc scripts in the root `scripts/` directory. All verification, testing, auditing, and maintenance scripts must be placed in their respective subdirectories:

1. **`scripts/tests/`**: Unit, integration, and verification test scripts.
   - Naming convention: `test-*.mjs`, `verify-*.mjs`
   - Purpose: Validating features, functions, APIs, schema validations, and regression checks.
   - Imports: Use `../../src/...` when importing from source, and `../lib/...` when using shared test helpers.
   - Runners: Aggregated via `scripts/run-unit-tests.mjs`, `scripts/run-isolated-db-tests.mjs`, `scripts/run-readonly-tests.mjs`, or invoked directly with `node scripts/tests/<script>.mjs`.

2. **`scripts/audits/`**: Inspection, sanity checking, and diagnostics scripts.
   - Naming convention: `audit-*.mjs`, `check-*.mjs`, `inspect-*.mjs`, `diagnose-*.mjs`
   - Purpose: Read-only inspection of database records, discrepancy checks, telemetry sanity, and missing data audits.
   - Imports: Use `../../src/...` and `../lib/...`.
   - Archive: finished one-off investigations (tied to one month, plant, or project stage) go to `scripts/audits/archive/`, importing with `../../../src/...`.

3. **`scripts/data/`**: Data seeding, migration, ingestion, and backfill scripts.
   - Naming convention: `seed-*.mjs`, `import-*.mjs`, `backfill-*.mjs`, `recalc-*.mjs`
   - Purpose: Modifying database state, historical backfills, CSV imports, and periodic syncs.
   - Imports: Use `../../src/...` and `../lib/...`.

4. **`scripts/tools/`**: Measurement, profiling, screenshot, and dump utilities.
   - Naming convention: `capture-*.mjs`, `dump-*.mjs`, `measure-*.mjs`, `bench-*.mjs`
   - Purpose: One-off dev tooling, screenshots, performance benchmarks.

5. **Root `scripts/`**: Strictly reserved for daemons (`solar-daemon.mjs`, `sync-isolar.mjs`) and test runner suites (`run-*.mjs`).

### Testing & Verification Commands
- `pnpm test` or `npm run test`: Runs core unit test suite (`scripts/run-unit-tests.mjs`).
- `pnpm run test:isolated-db`: Runs tests requiring isolated database context.
- `pnpm run test:readonly`: Runs tests against readonly database endpoints.
- `pnpm run test:stabilization`: Runs full test stabilization suite.
- `pnpm run test:all`: Runs unit tests and isolated DB tests.
- `pnpm run typecheck`: TypeScript check over the whole project (`tsc --noEmit`). `src/` is TypeScript; scripts and tests import `src/lib` files by their `.ts` path and run on Node 22 type stripping.
