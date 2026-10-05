import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma.js';
import { parseBmesMonthlyRows, importBmesMonthly } from '../src/lib/importers/bmesMonthlyImport.js';

const filePath = process.argv[2];
const isCommit = process.argv.includes('--commit');

if (!filePath) {
  console.log('Penggunaan: node scripts/import-bmes-monthly.mjs <file.json|file.csv> [--commit]');
  console.log('Format JSON yang didukung: array of { year_month: "202601", radiation_kwh_m2: 110.5, module_temp_c: 38.2, pr_percent: 83.5 }');
  process.exit(0);
}

try {
  const content = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8');
  let rawRows = [];
  if (filePath.endsWith('.json')) {
    rawRows = JSON.parse(content);
  } else if (filePath.endsWith('.csv')) {
    const lines = content.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim());
    rawRows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
    });
  } else {
    throw new Error('Format file tidak didukung (harus .json atau .csv)');
  }

  const parsed = parseBmesMonthlyRows(rawRows);
  console.log(`Parsed ${parsed.length} baris data BMES.`);

  const result = await importBmesMonthly(parsed, { db: prisma, dryRun: !isCommit });
  console.log(`Hasil Import (commit=${isCommit}):`, JSON.stringify(result, null, 2));
} catch (err) {
  console.error('Gagal mengimpor data BMES:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
