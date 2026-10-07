import prisma from '../src/lib/prisma.js';
import { resolveMonthly, MONTHLY_SOURCE_POLICY } from '../src/lib/solar/dashboard.js';

async function dryRunSync() {
  console.log('=== DRY-RUN SINKRONISASI TABEL MonthlyYield DARI MonthlyYieldObservation ===\n');

  // 1. Get current MonthlyYield stats
  const currentMonthlyYield = await prisma.monthlyYield.findMany({
    orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }]
  });
  const current2026 = currentMonthlyYield.filter(r => r.yearMonth >= '202601' && r.yearMonth <= '202609');
  const currentTotalKwh2026 = current2026.reduce((sum, r) => sum + r.energyKwh, 0);
  const currentSources = {};
  for (const r of current2026) {
    currentSources[r.source] = (currentSources[r.source] || 0) + 1;
  }

  console.log('--- KONDISI SEBELUM SINKRONISASI (Current State) ---');
  console.log(`Total baris MonthlyYield (all): ${currentMonthlyYield.length}`);
  console.log(`Total baris Jan-Sep 2026: ${current2026.length}`);
  console.log(`Total Energi Jan-Sep 2026: ${currentTotalKwh2026.toLocaleString('id-ID')} kWh (${(currentTotalKwh2026 / 1000).toFixed(2)} MWh)`);
  console.log(`Distribusi Source Jan-Sep 2026:`, currentSources);

  // 2. Fetch all MonthlyYieldObservation records
  const observations = await prisma.monthlyYieldObservation.findMany({
    orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }, { source: 'asc' }]
  });
  const currentMap = new Map(currentMonthlyYield.map(r => [`${r.yearMonth}:${r.psId}`, r]));

  // Group observations by yearMonth:psId
  const obsIndex = new Map();
  for (const obs of observations) {
    const key = `${obs.yearMonth}:${obs.psId}`;
    if (!obsIndex.has(key)) obsIndex.set(key, new Map());
    obsIndex.get(key).set(obs.source, obs);
  }

  let willInsert = 0;
  let willUpdate = 0;
  let unchanged = 0;
  const plannedRows = [];

  for (const [key, sourceMap] of obsIndex.entries()) {
    const [yearMonth, psIdStr] = key.split(':');
    const psId = Number(psIdStr);
    const report = sourceMap.get('ISOLAR_REPORT_IMPORT');
    const api = sourceMap.get('api_history');
    const partial = sourceMap.get('api_live_partial');

    const resolved = resolveMonthly({
      reportKwh: report?.energyKwh,
      apiHistoryKwh: api?.energyKwh,
      livePartialKwh: partial?.energyKwh,
      isCompletedMonth: yearMonth < '202610',
    });

    if (resolved.energyKwh === null) continue;

    const existing = currentMap.get(key);
    const targetSource = resolved.source;
    const targetKwh = resolved.energyKwh;

    if (!existing) {
      willInsert++;
      plannedRows.push({ action: 'INSERT', key, yearMonth, psId, targetKwh, targetSource, prevKwh: null, prevSource: null });
    } else {
      const diffKwh = Math.abs(existing.energyKwh - targetKwh);
      const isDiff = diffKwh > 0.001 || existing.source !== targetSource;
      if (isDiff) {
        willUpdate++;
        plannedRows.push({ action: 'UPDATE', key, yearMonth, psId, targetKwh, targetSource, prevKwh: existing.energyKwh, prevSource: existing.source, diffKwh });
      } else {
        unchanged++;
      }
    }
  }

  // 3. Compute planned after state
  const planned2026 = plannedRows.filter(r => r.yearMonth >= '202601' && r.yearMonth <= '202609');
  const allResolved2026Keys = [...obsIndex.keys()].filter(k => k >= '202601' && k <= '202609:9999999');
  let plannedTotalKwh2026 = 0;
  let plannedSources2026 = {};

  for (const key of obsIndex.keys()) {
    const [ym] = key.split(':');
    if (ym >= '202601' && ym <= '202609') {
      const sourceMap = obsIndex.get(key);
      const report = sourceMap.get('ISOLAR_REPORT_IMPORT');
      const api = sourceMap.get('api_history');
      const resolved = resolveMonthly({
        reportKwh: report?.energyKwh,
        apiHistoryKwh: api?.energyKwh,
        isCompletedMonth: true,
      });
      if (resolved.energyKwh !== null) {
        plannedTotalKwh2026 += resolved.energyKwh;
        plannedSources2026[resolved.source] = (plannedSources2026[resolved.source] || 0) + 1;
      }
    }
  }

  console.log('\n--- HASIL DRY-RUN RENCANA SINKRONISASI (Proposed Dry-Run) ---');
  console.log(`Jumlah baris yang akan di-INSERT: ${willInsert}`);
  console.log(`Jumlah baris yang akan di-UPDATE: ${willUpdate}`);
  console.log(`Jumlah baris yang UNCHANGED: ${unchanged}`);
  console.log(`Total baris setelah sinkronisasi: ${currentMonthlyYield.length + willInsert}`);
  
  console.log('\n--- PERBANDINGAN MWh JAN-SEP 2026 ---');
  console.log(`Total MWh SEBELUM: ${(currentTotalKwh2026 / 1000).toFixed(2)} MWh (${currentTotalKwh2026.toLocaleString('id-ID')} kWh)`);
  console.log(`Total MWh SESUDAH : ${(plannedTotalKwh2026 / 1000).toFixed(2)} MWh (${plannedTotalKwh2026.toLocaleString('id-ID')} kWh)`);
  console.log(`Delta Energi     : +${((plannedTotalKwh2026 - currentTotalKwh2026) / 1000).toFixed(2)} MWh (+${(plannedTotalKwh2026 - currentTotalKwh2026).toLocaleString('id-ID')} kWh)`);
  console.log(`Distribusi Source Baru Jan-Sep 2026:`, plannedSources2026);

  console.log('\n--- SAMPEL 5 BARIS YANG AKAN DI-UPDATE ---');
  for (const item of plannedRows.slice(0, 5)) {
    console.log(`[${item.action}] ${item.key} | Sebelum: ${item.prevKwh} kWh (${item.prevSource}) -> Sesudah: ${item.targetKwh} kWh (${item.targetSource})`);
  }

  await prisma.$disconnect();
}

dryRunSync().catch(err => {
  console.error(err);
  process.exit(1);
});
