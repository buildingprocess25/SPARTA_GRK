import fs from 'node:fs';
import prisma from '../prisma.js';

export function parseBmesMonthlyRows(rows = []) {
  return rows.map((row, index) => {
    const ymRaw = row.year_month || row.yearMonth || row.YearMonth || row.bulan || '';
    const ym = String(ymRaw).replace(/[-_/]/g, '').trim();
    if (!/^\d{6}$/.test(ym)) {
      throw new Error(`Baris ${index + 1}: format year_month '${ymRaw}' tidak valid (gunakan YYYYMM)`);
    }

    const radiationRaw = row.radiation_kwh_m2 ?? row.radiationKwhM2 ?? row.radiasi ?? null;
    const tempRaw = row.module_temp_c ?? row.moduleTempC ?? row.suhu_panel ?? null;
    const psIdRaw = row.ps_id ?? row.psId ?? 0;

    return {
      yearMonth: ym,
      psId: Number(psIdRaw) || 0,
      radiationKwhM2: radiationRaw !== null && radiationRaw !== '' ? Number(radiationRaw) : null,
      moduleTempC: tempRaw !== null && tempRaw !== '' ? Number(tempRaw) : null,
      source: 'BMES_MONTHLY_IMPORT',
      sourceRef: row.source_ref || row.sourceRef || 'BMES_NATIONAL_REPORT',
      metadata: {
        prPercentOfficial: row.pr_percent ?? row.prPercent ?? null,
      },
    };
  });
}

export async function importBmesMonthly(parsedRows = [], { db = prisma, dryRun = false } = {}) {
  const results = {
    total: parsedRows.length,
    inserted: 0,
    dryRun,
  };

  if (dryRun) return results;

  for (const item of parsedRows) {
    await db.climateMonthly.upsert({
      where: {
        yearMonth_psId_source: {
          yearMonth: item.yearMonth,
          psId: item.psId,
          source: item.source,
        },
      },
      update: {
        radiationKwhM2: item.radiationKwhM2,
        moduleTempC: item.moduleTempC,
        metadata: item.metadata,
        updatedAt: new Date(),
      },
      create: {
        yearMonth: item.yearMonth,
        psId: item.psId,
        radiationKwhM2: item.radiationKwhM2,
        moduleTempC: item.moduleTempC,
        source: item.source,
        sourceRef: item.sourceRef,
        metadata: item.metadata,
      },
    });
    results.inserted += 1;
  }

  return results;
}
