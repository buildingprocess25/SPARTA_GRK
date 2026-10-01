# iSolar Monthly History Import and Year-over-Year Dashboard Design

**Date:** 2026-10-01  
**Status:** Approved in principle; awaiting written-spec review  
**Scope:** Import the supplied 2025 and 2026 iSolarCloud monthly reports, preserve source provenance, and expose comparable historical periods throughout the PLTS dashboard.

## 1. Objective

The primary outcome is a trustworthy year-over-year production view. Users must be able to compare aligned periods such as January 2025 against January 2026, both at portfolio level and for each independent physical plant. Importing the CSV files is the mechanism for filling and reconciling that historical dataset, not the end product by itself.

Success means:

- 2025 and 2026 are selectable from periods discovered in the database.
- Monthly charts align the same calendar months across years.
- KPIs, tables, grid and plant filters, and exports use the same selected historical periods.
- YTD comparisons use equivalent month bounds, rather than comparing a partial year with a full year.
- Missing values remain unavailable and never become synthetic zeroes.
- Every imported value and every conflict is traceable to a file, row, batch, and file hash.
- Re-importing either source file does not duplicate or add values to existing observations.

## 2. Source Files and Observed Format

The two source files are in the project workspace root, not in a scratch directory:

- `Monthly Report_Annual report_20261001111519.csv`
- `Monthly Report_Annual report_20261001111530.csv`

Both files use:

- UTF-8 with BOM.
- Comma delimiters.
- LF line endings.
- One report metadata line followed by one header line.
- Nine columns.
- A dot decimal separator and no thousands separator.
- One row per plant and calendar month.

The first file declares `Monthly Report_Year_2025` in its contents and contains periods `2025-01` through `2025-12`. The second declares `Monthly Report_Year_2026` and contains periods `2026-01` through `2026-12`. The year comes from report contents and row periods; filename timestamps are not used as reporting years.

The relevant measurement is `Monthly yield(kWh)`. It is monthly energy, not a cumulative counter. The files do not contain an independent annual-total row, so reconciliation can sum valid monthly detail but cannot compare that sum with a separately supplied annual total.

Observed record counts before implementation:

| Report | Data rows | Plants | Valid monthly yields | Missing yields | Valid-yield total |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2025 | 468 | 39 | 460 | 8 | 6,482,001.90 kWh |
| 2026 | 468 | 39 | 351 | 117 | 4,804,338.80 kWh |

The eight missing 2025 values are January-April for Gorontalo and Luwu. The 117 missing 2026 values are October-December for all 39 plants. Empty strings and `--` are unavailable observations and are never inserted as zero.

The reports cover different years and therefore do not overlap each other. They cover the same set of 39 physical plants.

## 3. Plant Identity and Mapping

The reports do not contain vendor `ps_id` values. The importer must therefore use an explicit, auditable alias registry backed by `CANONICAL_DC_ENTITIES`.

Mapping rules:

1. Normalize whitespace, case, punctuation, and the known `Dhrive` spelling variation.
2. Require an exact match against a canonical name or declared alias after normalization.
3. Reject zero matches and multiple matches.
4. Never create a new `PlantMaster`, facility, or inferred alias during import.
5. Validate the report's installed capacity against the mapped plant's API capacity and report any mismatch without using capacity as a fuzzy identity key.

All 39 current report names map uniquely. The following identities remain independent at storage and comparison level:

- Lombok A: `ps_id` 1219736.
- Lombok B: `ps_id` 1219715.
- Cilacap 1: `ps_id` 1386493.
- Cilacap 2: `ps_id` 1387109.
- Cilacap 3: `ps_id` 1387111.

Dashboard roll-ups may sum selected physical plants for presentation, but the underlying records, filters, conflict decisions, and exports retain their individual identities.

## 4. Storage and Provenance

`MonthlyYield` remains the canonical dataset consumed by historical PLTS queries. Its current compact `YYYYMM` period representation remains in place to avoid a disruptive conversion of existing records and consumers.

The schema will add nullable provenance fields to `MonthlyYield`:

- measurement type, fixed to `MONTHLY_YIELD` for these records;
- source filename;
- source row number;
- source file SHA-256;
- import batch ID;
- imported timestamp;
- quality status.

`ImportBatch` will gain a first-class SHA-256 file hash and import mode/status metadata. A committed file hash is unique for this import module, so running the same file again resolves to the existing batch rather than creating another set of observations. Batch metadata records parser format, report year, totals, missing values, inserted records, identical records, conflicts, and errors.

The canonical uniqueness remains one monthly-yield measurement per `(yearMonth, psId)`. The measurement type is explicit provenance but does not introduce a second monthly-yield value for the same plant and period.

No report value is written to `PlantLatest`, `DailyYield`, or `PlantSnapshot30m`. Monthly values are not expanded into daily estimates.

## 5. Parsing and Validation

The importer consists of a pure parser, a reconciliation service, and a CLI entry point.

The parser will:

- Detect and validate UTF-8 BOM/UTF-8 decoding.
- Detect the delimiter from the header and require the expected nine columns.
- Preserve physical CSV line numbers.
- Validate the metadata year and require every row period to belong to that year.
- Validate `YYYY-MM` periods and calendar month bounds.
- Parse finite, non-negative monthly-yield values in kWh.
- Preserve a real numeric `0.00` as a valid observation.
- Classify empty strings and `--` as missing, not erroneous and not zero.
- Reject duplicate plant-period measurements inside one file.
- Map plant names using the explicit rules above.

The normal storage unit is kWh, matching `MonthlyYield.energyKwh`; no conversion is needed for the two supplied files. Unit parsing is nevertheless explicit so an unexpected header or unit fails safely rather than being silently interpreted.

Numeric identity uses the source's displayed precision. For values displayed to two decimal places, values within 0.005 kWh are identical. The comparison tolerance is used only for reconciliation classification; inserted values retain the parsed source value.

## 6. Source Precedence and Conflict Policy

Both the API and these reports originate from iSolarCloud, but database comparison has already shown that source and capture timing can differ. The importer therefore never assumes equality solely from vendor identity.

The explicit policy is:

1. **No existing row:** insert the report observation with source `ISOLAR_REPORT_IMPORT` and full provenance.
2. **Numerically identical existing row:** leave the canonical value and source unchanged; classify it as `IDENTICAL` in the import batch.
3. **Conflict with `api_live_partial` for a closed calendar month:** the official monthly report is allowed to finalize the value. Update the canonical value and source to `ISOLAR_REPORT_IMPORT`, while recording the previous value, previous source, new value, decision, file, row, and batch in durable audit metadata.
4. **Conflict with `api_history` or another finalized source:** do not overwrite. Record a conflict with both values and skip the canonical mutation.
5. **Conflict with manual or unknown source:** do not overwrite. Record and skip.

This is not a general claim that report data always wins. It is a narrow rule permitting a finalized monthly export to replace a partial live observation after that month has closed. The importer determines whether a month is closed using the reporting timezone `Asia/Jakarta` and the import time.

The initial database comparison, before applying this policy, found:

- 460 new valid 2025 observations.
- 298 identical 2026 observations.
- 53 conflicting 2026 observations.
- 125 missing cells across both reports.
- No mapping errors.

Of the 53 conflicts, 38 are September 2026 `api_live_partial` rows and are eligible for the finalized-report rule. The other 15 are `api_history` conflicts affecting Kotabumi and Parung and remain unresolved/skipped. No unverified operational explanation is attached to those differences.

## 7. Dry-Run, Commit, and Transaction Behavior

The CLI accepts explicit workspace-relative file paths and defaults to dry-run. A commit flag is required for database writes.

Dry-run output includes:

- File path, hash, encoding, delimiter, metadata row, header row, and report year.
- Reporting period and units.
- Mapped and problematic plant names.
- Counts for valid, missing, invalid, new, identical, finalizable partial conflicts, blocked conflicts, and errors.
- Totals by physical plant, month, and year.
- Database values, report values, source, and differences for conflicts.
- Reconciliation sum of valid monthly details, with a statement that no independent annual total exists.

Commit runs only after a successful parse and dry-run classification. Database changes use bounded transactions. Each file receives one import batch, and monthly mutations are processed in batches sized to avoid a long transaction while retaining a clear audit trail. A failed transaction is rolled back and reflected in the batch status.

The result reports inserted, finalized, identical/skipped, conflict/skipped, missing, and error counts. Importing the same hashes again performs no new monthly mutations.

## 8. Historical Query and Comparison Semantics

A shared server-side historical aggregation service will drive all PLTS historical surfaces. API routes must not independently recreate period logic.

Supported selections include:

- A single month, such as January 2025.
- A single calendar year.
- A year-specific YTD range.
- A year-over-year comparison between aligned calendar months or aligned YTD bounds.

Comparison rules:

- January 2025 aligns only with January 2026, February with February, and so on.
- YTD uses the latest comparable month available in both selected years unless the user explicitly selects a narrower range.
- A percentage change is returned only when both values are available and the baseline is greater than zero.
- A real zero remains zero and may participate in comparisons.
- A missing observation remains `null`, produces an unavailable marker, and is not included as zero in totals.
- A current calendar month is labeled `sebagian` only when its selected observation is partial.
- Current-month daily and monthly values are never added together. The resolver selects one canonical representation to prevent double counting.

The service returns aligned monthly series, per-plant totals, portfolio totals, availability flags, source/quality metadata, and comparison deltas. Year options are derived from canonical history in the database, so 2025 and 2026 appear automatically after import.

## 9. Dashboard Integration

The PLTS dashboard will use the shared historical response for:

- KPI production totals.
- Year-over-year absolute and percentage changes.
- The January-December comparison chart with separate year series.
- The per-plant table.
- Grid, plant, search, and period filters.
- CSV export of the currently filtered historical result.

The period UI will expose 2025, 2026, individual months, and an explicit comparison mode. The displayed range and partial/full quality status accompany all aggregate figures. Hard refresh and manual telemetry refresh do not reconstruct or replace historical report rows; subsequent reads return the same canonical history.

Live telemetry remains a separate concern. Live power, today's energy, alarms, and freshness continue to come from telemetry tables and are not rewritten by historical filters.

## 10. Emissions

Avoided-emission calculations use the existing project emission engine and grid mapping. The historical service passes the selected period, plant grid, calculation method, and factor metadata through to the response. It must expose the factor value, unit, source/version, and method used.

No factor is changed to force agreement with the CSV reports. The reports supply energy, not an instruction to recalibrate emission factors. If no applicable active factor can be resolved, the emission value is unavailable and the energy result remains visible.

## 11. Testing and Verification

Automated tests cover:

- Both original CSV files, including BOM, metadata, headers, rows, missing values, real zeroes, periods, and totals.
- Rejection of an invalid encoding, delimiter, header, year mismatch, unit, numeric value, or duplicate plant-period.
- Explicit mapping of all 39 names, especially Lombok A/B and Cilacap 1/2/3.
- kWh normalization and numeric tolerance.
- Classification of new, identical, finalizable partial conflict, and blocked conflict records.
- Re-importing the same hash without duplication.
- Transaction rollback on write failure.
- Queries for 2025, 2026, single months, aligned YTD, and January 2025 versus January 2026.
- Missing-history propagation as `null`/unavailable.
- Grid and plant filtering across KPI, chart, table, and export.
- Current-month partial labeling and prevention of daily/monthly double counting.
- Emission calculation through the existing factor resolver without factor mutation.

After implementation, verification will run:

1. Parser tests and dry-run against both original files.
2. Database commit for permitted mutations.
3. The same import again to prove idempotency.
4. Direct database queries reconciling stored canonical values against committed report records.
5. Dashboard API queries for 2025, 2026, and aligned year-over-year comparisons.
6. Relevant existing regression tests.
7. The complete test command and production build.

The final report will distinguish dry-run predictions from proven committed database results. If database access is unavailable at commit time, it will explicitly state that no database commit was proven.

## 12. Expected Initial Commit Outcome

Given the database state observed during design, the expected first committed run is:

- Insert 460 valid 2025 observations.
- Finalize up to 38 closed-month 2026 records currently sourced as `api_live_partial`, subject to a fresh dry-run immediately before commit.
- Skip 298 identical 2026 observations.
- Skip and audit 15 conflicts against `api_history`.
- Skip 125 missing report cells.
- Create no plants, no daily records, no telemetry snapshots, and no annual values synthesized from monthly records.

These numbers are expectations, not a claim of completed persistence. The importer must recalculate them against the live database immediately before commit and report the actual transaction results afterward.
