import fs from 'node:fs';
import path from 'node:path';
import prisma from '../../src/lib/prisma.ts';
import { isVehicleFuelRecord } from '../../src/lib/scope1/fuelCategory.ts';
import { buildGensetFuelActivities, parseGensetJournalCsv, verifyGensetTotals } from '../../src/lib/scope1/gensetJournal.ts';

// Usage: node --env-file=.env scripts/data/import-genset-fuel-journal.mjs <BBM GENSET journal.csv> [--apply]
// Without --apply it only prints what would change. With --apply every non-vehicle FuelActivity row
// (manual genset entries and earlier journal imports) is replaced by the rows from this file.
const args = process.argv.slice(2);
const csvPath = args.find(arg => !arg.startsWith('--'));
const apply = args.includes('--apply');

async function main() {
  if (!csvPath) throw new Error('Wajib: path CSV jurnal BBM genset');
  const parsed = parseGensetJournalCsv(fs.readFileSync(csvPath, 'utf8'));
  if (parsed.problems.length) throw new Error(`${parsed.problems.length} baris tidak valid: ${parsed.problems.slice(0, 3).join('; ')}`);
  const totalProblems = verifyGensetTotals(parsed);
  if (totalProblems.length) throw new Error(`Total akun tidak cocok:\n  ${totalProblems.join('\n  ')}`);

  const { activities, skipped } = buildGensetFuelActivities(parsed.lines, { sourceFile: path.basename(csvPath) });
  const nonFuel = parsed.lines.filter(l => !l.fuelType);
  const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);

  console.log(`${parsed.lines.length} baris jurnal, total Rp ${sum(parsed.lines, 'amountRupiah').toLocaleString('id-ID')}`);
  console.log(`Bukan BBM (oli, aki, coolant, suku cadang): ${nonFuel.length} baris, Rp ${sum(nonFuel, 'amountRupiah').toLocaleString('id-ID')}`);
  for (const fuelType of [...new Set(activities.map(a => a.fuelType))]) {
    const rows = activities.filter(a => a.fuelType === fuelType);
    console.log(`  ${fuelType}: Rp ${sum(rows, 'costRupiah').toLocaleString('id-ID')} -> ${Math.round(sum(rows, 'liters')).toLocaleString('id-ID')} L, ${sum(rows, 'emissionTon').toFixed(3)} tCO2e`);
  }
  if (skipped.length) console.log(`Grup bernilai <= 0 dilewati: ${skipped.map(g => `${g.kuu} ${g.yearMonth} ${g.fuelType} Rp ${g.costRupiah}`).join(', ')}`);
  const months = [...new Set(activities.map(a => a.yearMonth))].sort();
  console.log(`Data baru: ${activities.length} baris (${new Set(activities.map(a => a.dcId)).size} KUU, ${months[0]} s.d. ${months.at(-1)}), ${Math.round(sum(activities, 'liters')).toLocaleString('id-ID')} L, ${sum(activities, 'emissionTon').toFixed(3)} tCO2e`);

  const existing = (await prisma.fuelActivity.findMany()).filter(r => !isVehicleFuelRecord(r));
  console.log(`Data genset lama yang akan dihapus: ${existing.length}`);
  for (const r of existing) console.log(`  - ${r.id} ${r.yearMonth} ${r.dcId} ${r.liters} L ${r.source}`);

  if (!apply) {
    console.log('Dry run. Tambahkan --apply untuk menulis ke database.');
    return;
  }
  await prisma.$transaction([
    prisma.fuelActivity.deleteMany({ where: { id: { in: existing.map(r => r.id) } } }),
    prisma.fuelActivity.createMany({ data: activities }),
  ]);
  console.log('Selesai.');
}

main()
  .catch(err => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
