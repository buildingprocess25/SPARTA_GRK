import prisma from '../src/lib/prisma.js';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';
import { getGridFactor } from '../src/lib/emission-factors.js';
import { resolveMonthly, sumEligibleEmissions, buildLikeForLike } from '../src/lib/solar/dashboard.js';

async function main() {
  console.log('=== REKONSILIASI BAGIAN 1 & BAGIAN 2 ===\n');

  // Fetch all observations for 2025 and 2026
  const obs = await prisma.monthlyYieldObservation.findMany({
    where: {
      yearMonth: { in: [
        '202501','202502','202503','202504','202505','202506','202507','202508','202509',
        '202601','202602','202603','202604','202605','202606','202607','202608','202609'
      ]}
    }
  });

  // Map observations by yearMonth:psId:source
  const obsMap = new Map();
  for (const o of obs) {
    obsMap.set(`${o.yearMonth}:${o.psId}:${o.source}`, o.energyKwh);
  }

  const months2026 = ['202601','202602','202603','202604','202605','202606','202607','202608','202609'];
  const months2025 = ['202501','202502','202503','202504','202505','202506','202507','202508','202509'];

  // All 39 canonical entities
  console.log(`Total canonical DC entities: ${CANONICAL_DC_ENTITIES.length}`);

  // Calculate per plant Jan-Sep 2026 (Both before with api_history and after with ISOLAR_REPORT_IMPORT)
  let totalBeforeKwh = 0;
  let totalAfterKwh = 0;
  let total2025Kwh = 0;

  const plantRows = [];

  for (const entity of CANONICAL_DC_ENTITIES) {
    const psId = entity.sungrowPsIds[0];
    let plantBeforeKwh = 0;
    let plantAfterKwh = 0;
    let plant2025Kwh = 0;

    for (const ym of months2026) {
      const reportKwh = obsMap.get(`${ym}:${psId}:ISOLAR_REPORT_IMPORT`) ?? null;
      const apiKwh = obsMap.get(`${ym}:${psId}:api_history`) ?? null;

      // Before: used api_history when available
      const beforeVal = (apiKwh !== null && apiKwh !== undefined) ? apiKwh : (reportKwh ?? 0);
      plantBeforeKwh += beforeVal;

      // After: resolveMonthly with preferredCompletedSource = ISOLAR_REPORT_IMPORT
      const resolved = resolveMonthly({ reportKwh, apiHistoryKwh: apiKwh, isCompletedMonth: true });
      plantAfterKwh += (resolved.energyKwh ?? 0);
    }

    for (const ym of months2025) {
      const val2025 = obsMap.get(`${ym}:${psId}:ISOLAR_REPORT_IMPORT`) ?? 0;
      plant2025Kwh += val2025;
    }

    totalBeforeKwh += plantBeforeKwh;
    totalAfterKwh += plantAfterKwh;
    total2025Kwh += plant2025Kwh;

    const factorObj = getGridFactor(entity.grid);
    const factor = factorObj ? factorObj.cmPlts : null;
    const factorStatus = (factorObj && factorObj.status) ? factorObj.status : (factor ? 'resmi' : 'tidak_ada');

    const emisiBefore = (factor && factorStatus === 'resmi') ? (plantBeforeKwh / 1000) * factor : 0;
    const emisiAfter = (factor && factorStatus === 'resmi') ? (plantAfterKwh / 1000) * factor : 0;

    plantRows.push({
      dcId: entity.dcId,
      name: entity.canonicalName,
      psId,
      grid: entity.grid,
      kwh2025: plant2025Kwh,
      kwhBefore: plantBeforeKwh,
      kwhAfter: plantAfterKwh,
      diffKwh: plantAfterKwh - plantBeforeKwh,
      factor,
      factorStatus,
      emisiBefore,
      emisiAfter,
      diffEmisi: emisiAfter - emisiBefore
    });
  }

  console.log('\n=== HASIL BAGIAN 1: SEBELUM VS SESUDAH ===');
  console.log(`Total Jan-Sep 2026 SEBELUM: ${(totalBeforeKwh / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2 })} MWh (${totalBeforeKwh.toFixed(1)} kWh)`);
  console.log(`Total Jan-Sep 2026 SESUDAH : ${(totalAfterKwh / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2 })} MWh (${totalAfterKwh.toFixed(1)} kWh)`);
  console.log(`Selisih Produksi          : ${((totalAfterKwh - totalBeforeKwh) / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2 })} MWh (+${(totalAfterKwh - totalBeforeKwh).toFixed(1)} kWh)`);

  console.log(`\nTotal Jan-Sep 2025        : ${(total2025Kwh / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2 })} MWh (${total2025Kwh.toFixed(1)} kWh)`);
  const yoyBeforeKwh = totalBeforeKwh - total2025Kwh;
  const yoyBeforePct = (yoyBeforeKwh / total2025Kwh) * 100;
  console.log(`YoY Jan-Sep SEBELUM       : ${(yoyBeforeKwh / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2 })} MWh (${yoyBeforePct.toFixed(2)}%)`);

  const yoyAfterKwh = totalAfterKwh - total2025Kwh;
  const yoyAfterPct = (yoyAfterKwh / total2025Kwh) * 100;
  console.log(`YoY Jan-Sep SESUDAH       : +${(yoyAfterKwh / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2 })} MWh (+${yoyAfterPct.toFixed(2)}%)`);

  // Like-for-like YoY analysis
  console.log('\n--- LIKE-FOR-LIKE YoY ANALYSIS ---');
  const lflRows = plantRows.map(p => ({
    currentKwh: p.kwhAfter > 0 ? p.kwhAfter : null,
    previousKwh: p.kwh2025 > 0 ? p.kwh2025 : null,
    name: p.name,
    dcId: p.dcId
  }));
  const lfl = buildLikeForLike(lflRows);
  const excludedFromLfl = lflRows.filter(r => r.currentKwh === null || r.previousKwh === null);
  console.log(`Jumlah plant yang dibandingkan (Like-for-Like): ${lfl.plantCount}`);
  console.log(`Jumlah plant yang dikeluarkan: ${lfl.excludedPlantCount}`);
  console.log(`Daftar plant dikeluarkan dari Like-for-Like:`, excludedFromLfl.map(e => `${e.name} (2025: ${e.previousKwh}, 2026: ${e.currentKwh})`));
  const lflDiffKwh = lfl.currentKwh - lfl.previousKwh;
  const lflPct = (lflDiffKwh / lfl.previousKwh) * 100;
  console.log(`LFL 2025: ${(lfl.previousKwh / 1000).toFixed(2)} MWh | LFL 2026: ${(lfl.currentKwh / 1000).toFixed(2)} MWh | LFL YoY: +${(lflDiffKwh / 1000).toFixed(2)} MWh (+${lflPct.toFixed(2)}%)`);

  // Section 2: Avoided emissions breakdown (39 lines)
  console.log('\n=== TABEL EMISI PER PLANT (39 BARIS) ===\n');
  console.log('| No | DC / Plant | Grid | Produksi Jan-Sep (MWh) | Faktor Emisi (tCO2e/MWh) | Status Faktor | Emisi Terhindar (tCO2e) | Catatan |');
  console.log('|---|---|---|---|---|---|---|---|');

  let totalMwhResmi = 0;
  let totalEmisiResmi = 0;
  let totalMwhExcluded = 0;
  let excludedPlantCount = 0;

  plantRows.sort((a, b) => a.name.localeCompare(b.name)).forEach((p, idx) => {
    const prodMwh = p.kwhAfter / 1000;
    const isResmi = p.factorStatus === 'resmi';
    const emisi = isResmi && p.factor ? prodMwh * p.factor : 0;
    if (isResmi) {
      totalMwhResmi += prodMwh;
      totalEmisiResmi += emisi;
    } else {
      totalMwhExcluded += prodMwh;
      excludedPlantCount++;
    }
    const catatan = isResmi ? 'Dihitung' : 'Tidak dihitung (faktor sementara/belum resmi)';
    console.log(`| ${idx + 1} | ${p.name} | ${p.grid || '—'} | ${prodMwh.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${p.factor !== null ? p.factor.toFixed(4) : '—'} | ${p.factorStatus} | ${isResmi ? emisi.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} | ${catatan} |`);
  });

  console.log('|---|---|---|---|---|---|---|---|');
  console.log(`| | **TOTAL PORTFOLIO** | | **${(totalAfterKwh / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** | | | **${totalEmisiResmi.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** | **${excludedPlantCount} plant (${totalMwhExcluded.toLocaleString('id-ID', { minimumFractionDigits: 2 })} MWh) tanpa faktor resmi tidak dihitung** |`);

  console.log(`\nRingkasan Emisi:`);
  console.log(`- Emisi Sebelum: 3.722,11 tCO2e`);
  console.log(`- Emisi Sesudah: ${totalEmisiResmi.toFixed(2)} tCO2e`);
  console.log(`- Kenaikan Emisi: +${(totalEmisiResmi - 3722.11).toFixed(2)} tCO2e`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
