#!/usr/bin/env node
/**
 * CLI: Import iSolarCloud Annual Report CSV files
 *
 * Usage:
 *   node --env-file=.env scripts/import-isolar-annual-reports.mjs [options] <file1.csv> [file2.csv ...]
 *   node --env-file=.env scripts/import-isolar-annual-reports.mjs --auto [--commit]
 *
 * Options:
 *   --commit    Actually write to database (default: dry-run)
 *   --auto      Auto-discover all matching report CSVs in project root
 *   --verbose   Show per-row details
 *
 * Examples:
 *   # Dry-run all files
 *   node --env-file=.env scripts/import-isolar-annual-reports.mjs --auto
 *
 *   # Import all files for real
 *   node --env-file=.env scripts/import-isolar-annual-reports.mjs --auto --commit
 *
 *   # Import specific file
 *   node --env-file=.env scripts/import-isolar-annual-reports.mjs --commit "Data Radiasi_Annual report_20261002100124.csv"
 */

import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma.js';
import { importIsolarAnnualReport } from '../src/lib/importers/isolarAnnualReportImport.js';
import { importMonitorPltsWorkbook, importMonitorPltsCsv } from '../src/lib/importers/monitorPltsWorkbookImport.js';

const args = process.argv.slice(2);
const isCommit = args.includes('--commit');
const isAuto = args.includes('--auto');
const isVerbose = args.includes('--verbose');
const files = args.filter(a => !a.startsWith('--'));

const PROJECT_ROOT = path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'), '..');

// Auto-discover matching files
const CSV_PATTERNS = [
  /Data Radiasi_Annual report/i,
  /Monthly iradiasi.*_Annual report/i,
  /monthly load consump_Annual report/i,
  /monthly yield_Annual report/i,
  /Monitor PLTS.*\.csv$/i,
];
const XLSX_PATTERNS = [
  /Monitor PLTS.*\.xlsx$/i,
  /Data Radiasi_Annual report.*\.xlsx$/i,
  /Monthly iradiasi.*_Annual report.*\.xlsx$/i,
  /monthly load consump_Annual report.*\.xlsx$/i,
  /monthly yield_Annual report.*\.xlsx$/i,
];

function discoverFiles() {
  const rootFiles = fs.readdirSync(PROJECT_ROOT);
  const csvFiles = rootFiles
    .filter(f => f.endsWith('.csv') && CSV_PATTERNS.some(p => p.test(f)))
    .map(f => path.join(PROJECT_ROOT, f));
  const xlsxFiles = rootFiles
    .filter(f => f.endsWith('.xlsx') && XLSX_PATTERNS.some(p => p.test(f)))
    .map(f => path.join(PROJECT_ROOT, f));
  return [...csvFiles, ...xlsxFiles].sort();
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  IMPORT iSOLAR ANNUAL REPORT → DATABASE                      ║');
  console.log(`║  Mode: ${isCommit ? 'COMMIT (write to DB)' : 'DRY-RUN (read only)'}${' '.repeat(isCommit ? 20 : 22)}║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');

  let targetFiles = files.map(f => path.resolve(process.cwd(), f));

  if (isAuto || targetFiles.length === 0) {
    targetFiles = discoverFiles();
    console.log(`\nAuto-discovered ${targetFiles.length} report file(s):`);
    targetFiles.forEach(f => console.log(`  → ${path.basename(f)}`));
  }

  if (targetFiles.length === 0) {
    console.log('\n⚠ Tidak ada file yang ditemukan. Jalankan dengan --auto atau berikan path file.');
    process.exit(0);
  }

  console.log('');
  const allResults = [];

  for (const filePath of targetFiles) {
    const basename = path.basename(filePath);
    console.log(`┌─ Processing: ${basename}`);

    if (!fs.existsSync(filePath)) {
      console.log(`│  ✗ File tidak ditemukan: ${filePath}`);
      console.log('└─');
      continue;
    }

    try {
      const isXlsx = basename.endsWith('.xlsx');
      const isMonitor = /Monitor PLTS/i.test(basename);

      if (isXlsx && isMonitor) {
        // Monitor PLTS workbook — contains multi-sheet monthly data
        const result = await importMonitorPltsWorkbook(filePath, { db: prisma, dryRun: !isCommit });
        console.log(`│  Type:     MONITOR_WORKBOOK (${result.sheetsProcessed} sheets)`);
        console.log(`│  Yield:    ${result.yield.imported} imported, ${result.yield.skippedNoPlant} no-plant, ${result.yield.skippedNoValue} no-value`);
        console.log(`│  Load:     ${result.load.imported} imported, ${result.load.skippedNoPlant} no-plant, ${result.load.skippedNoValue} no-value`);
        console.log(`│  Radiasi:  ${result.radiation.imported} average reference rows`);
        if (result.unmappedPlants.length > 0) {
          console.log(`│  Unmapped: ${result.unmappedPlants.join(', ')}`);
        }
        console.log(`│  Mode:     ${!isCommit ? 'DRY-RUN' : 'COMMITTED'}`);
        console.log('└─ ✓');
      } else if (isMonitor) {
        // Monitor PLTS single month CSV
        const result = await importMonitorPltsCsv(filePath, { db: prisma, dryRun: !isCommit });
        console.log(`│  Type:     MONITOR_CSV (${result.yearMonth})`);
        console.log(`│  Yield:    ${result.yield.imported} imported, ${result.yield.skippedNoPlant} no-plant, ${result.yield.skippedNoValue} no-value`);
        console.log(`│  Load:     ${result.load.imported} imported, ${result.load.skippedNoPlant} no-plant, ${result.load.skippedNoValue} no-value`);
        if (result.unmappedPlants.length > 0) {
          console.log(`│  Unmapped: ${result.unmappedPlants.join(', ')}`);
        }
        console.log(`│  Mode:     ${!isCommit ? 'DRY-RUN' : 'COMMITTED'}`);
        console.log('└─ ✓');
      } else {
        // iSolarCloud CSV annual report
        const result = await importIsolarAnnualReport(filePath, { db: prisma, dryRun: !isCommit });
        allResults.push(result);
        console.log(`│  Type:     ${result.fileType}`);
        console.log(`│  Title:    ${result.title}`);
        console.log(`│  Total:    ${result.total} baris data`);
        console.log(`│  Imported: ${result.imported}${!isCommit ? ' (dry-run)' : ''}`);
        console.log(`│  Skipped:  ${result.skippedNoPlant} (no plant) + ${result.skippedNoValue} (no value)`);
        if (result.errors.length > 0 && isVerbose) {
          console.log(`│  Errors:`);
          result.errors.forEach(e => console.log(`│    Row ${e.row}: ${e.plantName} - ${e.error}`));
        } else if (result.errors.length > 0) {
          console.log(`│  Errors:   ${result.errors.length} (use --verbose to see details)`);
        }
        console.log('└─ ✓');
      }
    } catch (err) {
      console.log(`│  ✗ ERROR: ${err.message}`);
      if (isVerbose) console.log(`│  Stack: ${err.stack}`);
      console.log('└─');
    }
    console.log('');
  }

  // Summary
  console.log('════════════════════════════════════════════════════════════════');
  console.log('RINGKASAN IMPORT:');
  const byType = {};
  for (const r of allResults) {
    if (!byType[r.fileType]) byType[r.fileType] = { imported: 0, total: 0 };
    byType[r.fileType].imported += r.imported;
    byType[r.fileType].total += r.total;
  }
  for (const [type, stats] of Object.entries(byType)) {
    console.log(`  ${type}: ${stats.imported}/${stats.total} baris`);
  }
  console.log(`  Total file: ${allResults.length}`);
  console.log(`  Mode: ${isCommit ? 'COMMIT' : 'DRY-RUN'}`);
  if (!isCommit) {
    console.log('\n  ℹ Untuk menyimpan ke database, jalankan ulang dengan --commit');
  }
  console.log('════════════════════════════════════════════════════════════════');
}

try {
  await main();
} catch (err) {
  console.error('Fatal error:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
