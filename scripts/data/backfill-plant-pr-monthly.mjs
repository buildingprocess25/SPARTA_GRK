import prisma from '../../src/lib/prisma.ts';
import { syncMonthlyPrFromApi } from '../../src/lib/solar/prMonthlySync.ts';
import { isValidPlantPr } from '../../src/lib/solar/prValidity.ts';

// Usage: node --env-file=.env --env-file=.env.local scripts/data/backfill-plant-pr-monthly.mjs <startYm> <endYm> [--apply]
// Re-pulls monthly PR (p83023) from iSolarCloud for the range, e.g. 202501 202611. Needed once after the ratio-to-percent
// fix in prMonthlySync.ts: older rows hold the raw ratio rounded to 2 decimals (0.73), so they are re-fetched rather
// than multiplied, which would keep the lost precision. Without --apply it only prints old vs new values.
const [startYm, endYm] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const apply = process.argv.includes('--apply');

async function main() {
  if (!/^\d{6}$/.test(startYm || '') || !/^\d{6}$/.test(endYm || '')) throw new Error('Wajib: <startYm> <endYm>, misal 202501 202611');

  const captured = [];
  const db = apply ? prisma : {
    plantMaster: prisma.plantMaster,
    plantPrMonthly: { upsert: async ({ create }) => { captured.push(create); } },
  };
  const result = await syncMonthlyPrFromApi({ db, force: true, startYm, endYm });
  console.log(`${result.rows} baris PR dari ${result.plants} plant, ${result.months.join(' s.d. ')}; di luar 10-100%: ${result.outsideValidRange}`);

  if (apply) {
    console.log('Selesai, baris sudah ditulis.');
    return;
  }
  const existing = new Map((await prisma.plantPrMonthly.findMany({ where: { yearMonth: { gte: startYm, lte: endYm } } }))
    .map(r => [`${r.yearMonth}:${r.psId}`, r.prPercent]));
  const sample = captured.filter((_, i) => i % Math.max(1, Math.floor(captured.length / 8)) === 0).slice(0, 8);
  console.table(sample.map(r => ({ bulan: r.yearMonth, psId: r.psId, lama: existing.get(`${r.yearMonth}:${r.psId}`) ?? '(baru)', baru: r.prPercent, valid: isValidPlantPr(r.prPercent) })));
  console.log(`Baris baru: ${captured.filter(r => !existing.has(`${r.yearMonth}:${r.psId}`)).length}, diganti: ${captured.filter(r => existing.has(`${r.yearMonth}:${r.psId}`)).length}`);
  console.log('Dry run. Tambahkan --apply untuk menulis ke database.');
}

main()
  .catch(err => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
