import prisma from '../../src/lib/prisma.ts';
import { isVehicleFuelRecord } from '../../src/lib/scope1/fuelCategory.ts';

// Usage: node --env-file=.env scripts/data/backfill-vehicle-covered-through.mjs <YYYY-MM-DD> [--apply]
// Sets metadata.coveredThrough on the vehicle fuel rows of that date's month, for a rekap imported before
// import-vehicle-fuel-costs.mjs had --covered-through. Without --apply it only prints what would change.
const args = process.argv.slice(2);
const coveredThrough = args.find(arg => !arg.startsWith('--'));
const apply = args.includes('--apply');

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(coveredThrough || '')) throw new Error('Wajib: tanggal cakupan YYYY-MM-DD, misal 2026-10-15');
  const yearMonth = coveredThrough.slice(0, 7);

  const rows = (await prisma.fuelActivity.findMany({ where: { yearMonth } })).filter(isVehicleFuelRecord);
  if (!rows.length) throw new Error(`Tidak ada data BBM kendaraan untuk ${yearMonth}`);

  const files = [...new Set(rows.map(r => r.proofRef || '(tanpa file)'))];
  console.log(`${rows.length} baris BBM kendaraan ${yearMonth} dari ${files.join(', ')}`);
  const already = rows.filter(r => r.metadata?.coveredThrough === coveredThrough).length;
  console.log(`Sudah bertanda ${coveredThrough}: ${already}, akan diubah: ${rows.length - already}`);

  if (!apply) {
    console.log('Dry run. Tambahkan --apply untuk menulis ke database.');
    return;
  }

  await prisma.$transaction(rows.map(r => prisma.fuelActivity.update({
    where: { id: r.id },
    data: { metadata: { ...(r.metadata || {}), coveredThrough } },
  })));
  console.log('Selesai.');
}

main()
  .catch(err => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
