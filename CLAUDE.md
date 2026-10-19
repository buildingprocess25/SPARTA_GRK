<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.claude/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.claude/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.claude/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.claude/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.claude/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.claude/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

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
