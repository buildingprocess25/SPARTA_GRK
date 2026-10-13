// CLI twin of POST /api/plts/import-report: imports iSolarCloud "Monthly Report" CSVs with the same rules.
// Usage: npm run import:energy-flow [-- --dry-run] [-- path/to/report.csv ...]
// Without file arguments it picks the newest "Monthly Report_Annual report_*.csv" per year in the project root.
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';
import { parseIsolarMonthlyReportFile } from '../src/lib/importers/isolarMonthlyReport.js';
import { createPrismaMonthlyImportRepository, importIsolarMonthlyReport } from '../src/lib/importers/isolarMonthlyImport.js';
import {
  closedMonthReport,
  energyFlowRowsFromDecisions,
  openMonthCutoff,
  upsertEnergyFlowRows,
} from '../src/lib/importers/energyFlowImport.js';

const REPORT_PATTERN = /^Monthly Report_Annual report_.*\.csv$/i;

function reportYear(fullPath) {
  const firstLine = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)[0];
  return Number(firstLine.match(/Year_(\d{4})/)?.[1]) || null;
}

function findLatestReportsPerYear(dir) {
  const byYear = new Map();
  for (const fileName of fs.readdirSync(dir).filter(name => REPORT_PATTERN.test(name))) {
    const fullPath = path.join(dir, fileName);
    const year = reportYear(fullPath);
    if (year && (!byYear.has(year) || fileName > path.basename(byYear.get(year)))) byYear.set(year, fullPath);
  }
  return [...byYear.entries()].sort(([a], [b]) => a - b).map(([, fullPath]) => fullPath);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArgs = args.filter(a => !a.startsWith('--')).map(file => path.resolve(process.cwd(), file));
  const files = fileArgs.length ? fileArgs : findLatestReportsPerYear(process.cwd());

  if (!files.length) {
    console.error('Tidak ada file "Monthly Report_Annual report_*.csv" di folder project. Unduh dari portal iSolarCloud atau berikan path file sebagai argumen.');
    process.exitCode = 1;
    return;
  }

  const repository = createPrismaMonthlyImportRepository(prisma);
  const now = new Date();
  for (const fullPath of files) {
    const fileName = path.basename(fullPath);
    const closed = closedMonthReport(parseIsolarMonthlyReportFile(fullPath), openMonthCutoff({ now, filename: fileName }));
    console.log(`${fileName} (tahun ${closed.reportYear})`);
    console.log(`  ${closed.summary.validCount} plant-bulan valid, ${closed.openMonthRecords} baris bulan belum tutup dilewati, ${closed.summary.errorCount} baris error`);
    if (closed.summary.validCount === 0) continue;
    if (closed.summary.errorCount > 0) { console.error('  dilewati karena ada baris error'); process.exitCode = 1; continue; }

    const result = await importIsolarMonthlyReport({ report: closed, repository, commit: !dryRun, now });
    const flowRows = energyFlowRowsFromDecisions(result.preview.decisions);
    const months = [...new Set(flowRows.map(row => row.yearMonth))].sort();
    console.log(`  rekonsiliasi: ${JSON.stringify(result.preview.summary)}${result.duplicateFile ? ' (file ini sudah pernah diimpor)' : ''}`);
    console.log(`  energy_flow_monthly: ${flowRows.length} baris, bulan ${months[0] ?? '-'} s.d. ${months.at(-1) ?? '-'}`);
    if (!dryRun) await upsertEnergyFlowRows(prisma, flowRows, now);
  }

  console.log(dryRun
    ? '\n--dry-run: tidak ada yang ditulis ke database.'
    : '\nSelesai. Cache dashboard PLTS diperbarui paling lambat 30 menit, atau segera lewat POST /api/plts/revalidate.');
}

main().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
