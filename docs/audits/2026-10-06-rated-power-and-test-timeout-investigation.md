# Read-only investigation: inverter rated power and legacy test timeouts

Date: 2026-10-06. Scope stops before Phase 3. No production/staging write, backfill, scheduler activation, registry update, method change, or schema change was performed.

## A. Rated-power source

Live calls were limited to the verified read-only endpoints `getDeviceListByUser` and `getOpenPointInfo` after login. The inverter query returned 77 rows and exactly these 18 fields:

`chnnl_id`, `communication_dev_sn`, `dev_fault_status`, `dev_status`, `device_code`, `device_model_code`, `device_model_id`, `device_name`, `device_sn`, `device_type`, `factory_name`, `grid_connection_date`, `ps_id`, `ps_key`, `rel_state`, `rel_time`, `type_name`, `uuid`.

No field name contained rated, nominal, capacity, or power-rating semantics. Three observed examples were:

| ps_id | device_sn | device_model_code | device_type | rated-power field |
|---:|---|---|---:|---|
| 1092345 | A2140203834 | SG110CX | 1 | absent |
| 1092345 | A20C2200554 | SG50CX | 1 | absent |
| 1154267 | A21B1804347 | SG110CX | 1 | absent |

`getOpenPointInfo` for `device_type=1`, `type=2` returned 540 point definitions. None had a point name matching rated, nominal, capacity, or power rating. Therefore these two proven API surfaces do not provide rated power or its unit. The only proven model field is `device_model_code`; rating must not be inferred from it.

Unique model counts:

| model | devices |
|---|---:|
| SG110CX | 22 |
| SG125CX-P2 | 11 |
| SG12RT | 1 |
| SG15RT | 7 |
| SG20RT | 2 |
| SG33CX | 5 |
| SG33CX-P2 | 1 |
| SG40CX | 18 |
| SG50CX | 7 |
| SG6.0RT | 3 |

Documents required before registry population are the official Sungrow model-specific datasheet or technical-data appendix for the exact regional/hardware variant of each of the ten model codes. Official starting references found are:

- SG33CX/SG40CX/SG50CX datasheet: https://en.sungrowpower.com/upload/documentFile/DS_SG33CX%20SG40CX%20SG50CX%20Datasheet_V14_EN.pdf.pdf
- SG110CX datasheet: https://en.sungrowpower.com/upload/documentFile/DS_SG110CX%20Datasheet_V14_EN.pdf.pdf
- SG125CX-P2 datasheet: https://en.sungrowpower.com/upload/file/20220414/SG125CX-P2.pdf
- SG15RT/SG20RT datasheet: https://en.sungrowpower.com/upload/file/20210611/DS_20210415_SG15%2017%2020RT%20Datasheet_V1.1.3_EN.pdf
- Sungrow official download catalogue for the exact SG3-20RT family and remaining P2 variant documents: https://en.sungrowpower.com/whitepaper

These references are evidence sources to be reviewed, not authorization to populate ratings. SG6.0RT, SG12RT, and SG33CX-P2 still require an exact official model/variant document supplied or approved by the owner.

The UTF-8 BOM template contains all 77 `ps_id`/`device_sn`/model rows. The validator is dry-run by default, rejects nonpositive/non-numeric W values, missing source documents, duplicate or unknown serial numbers, mismatched ps_id/model, and malformed dates. `--apply` is the only write mode. Its preview reports current and proposed registry hash; writing the new JSON bytes causes the existing effective-version hash calculation to change automatically.

## B. Legacy test timeout diagnosis

All five timed-out scripts import `PrismaClient` from `@prisma/client`. A controlled read-only `SELECT current_schema()` probe against the guarded test target produced:

- `@prisma/client`: `PROBE_TIMEOUT_30S` after 30,004 ms;
- `src/generated/prisma`: success in 851 ms, schema `test_alfa`.

The installed package client is an older generated artifact dated 2026-10-02 with `engineType="binary"`; the project-generated client is dated 2026-10-06 and uses the Node library engine. This establishes that the reported 30-second test timeouts occur at the old package-client connection layer, before database assertions finish. It does not establish why that binary engine cannot reach this Prisma Postgres direct URL; that lower-level cause remains unproven.

| Script | Purpose | DB target during controlled diagnosis | Proven timeout cause | Data behavior |
|---|---|---|---|---|
| `test-database-and-workbook-reconciliation.mjs` | Reconcile workbook control totals, factors, water, 39 plants, targets | `db.prisma.io`, schema `test_alfa` | first Prisma query still blocked at 184 s; old client probe times out | read-only, requires populated reference/production-like data |
| `test-scheduler-and-snapshots.mjs` | Slotting, snapshot idempotency/concurrency, scheduler coordination | Intended guarded target is `db.prisma.io/test_alfa`, but script reloads `.env.local` and can overwrite the effective URL | imports the same failing package client; not executed because it also writes snapshots and bypasses the process-only URL discipline | mutating integration test; unsafe in a read-only audit |
| `test-calculator-and-sustainability.mjs` | Calculator persistence, dedup, draft exclusion, provenance | guarded test target would be `db.prisma.io/test_alfa` | imports the same failing package client | creates/deletes fuel rows; not executed in this audit |
| `test-master-facilities-and-audit.mjs` | Master facility counts/mappings and audit rules | guarded test target `db.prisma.io/test_alfa` | imports the same failing package client | read-only but requires populated master data |
| `test-excel-upload-and-templates.mjs` | Template parsing plus batch commit/idempotency | guarded test target would be `db.prisma.io/test_alfa` | imports the same failing package client | creates/deletes import and fuel rows; not executed in this audit |

The six scripts above, plus `test-final-suite.mjs`, are byte-identical to commit `fc1e373`, the commit checked out in the separate pre-Phase-2 worktree. On that worktree the same database/workbook script reached its first Prisma query and timed out at 45 seconds. Thus the common timeout existed before Phase 2 and was not introduced by the Phase-2 source changes.

The baseline `test-final-suite.mjs` could not start in the detached worktree because `src/generated/prisma` is ignored and absent there. However, its source and `> 4000 MWh` assertion are byte-identical before/after Phase 2. On the current tree against empty `test_alfa`, tests 1-3 passed and test 4 failed exactly at `Total YTD production must be > 4000 MWh`. This is a data-fixture requirement, not a new Phase-2 assertion.

### Test classification and proposed npm split

The requested binary classification is insufficient because three tests deliberately write fixtures. The honest classification is:

1. Empty-DB/pure tests: lint verification, units/denylist, metrics/Cilacap, proxy PR audit, carbon reconciliation, fault-status synthetic, and inverter-temperature unit tests.
2. Production-data read-only tests: database/workbook reconciliation, master facilities/audit, and final suite. These assert known workbook/YTD/master values and must not run against an empty test DB.
3. Isolated mutable-DB tests: scheduler/snapshots, calculator/sustainability, Excel upload/templates, and inverter-temperature foundation. These require a guarded disposable/test database and cleanup.

Proposed commands, not implemented:

- `npm test`: category 1 only;
- `npm run test:db:isolated`: category 3, requires the hard test guard;
- `npm run test:data:readonly`: category 2, requires an explicitly approved read-only data URL/role;
- `npm run test:all`: explicit orchestration of the three commands in a controlled environment.

No assertion content should change. Separately, the legacy scripts should eventually import the configured generated client consistently, but that is a proposed fix and was not applied here.

## C. Prisma production safety note

Never run `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against production or staging. The repository has known legacy Prisma drift, including a diff proposal to drop `plant_latest_status_category_status_checked_at_idx`; schema-reconciliation commands could therefore perform unrelated/destructive changes.

For production, only `prisma migrate deploy` may be considered, and only after all of the following:

1. explicit owner approval;
2. verified recoverable backup;
3. effective-URL guard confirms the intended non-pooler deployment target;
4. SQL and `prisma migrate diff` review proves the deployment creates only the five approved inverter-temperature tables and their new constraints/indexes;
5. no legacy table/index alteration or drop is proposed.

If any check differs, stop; do not repair drift as part of the inverter-temperature deployment.
