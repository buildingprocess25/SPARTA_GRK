// Shared by the CSV upload route and scripts/backfill-energy-flow.mjs so both apply the same rules.

const EXPORT_STAMP_PATTERN = /_(\d{14})(?:\D|$)/;
const WRITABLE_CLASSIFICATIONS = new Set(['NEW', 'IDENTICAL', 'FINALIZE_PARTIAL']);
const REPORT_SOURCE = 'ISOLAR_REPORT_IMPORT';

export function wibYearMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(p => p.type === 'year').value}${parts.find(p => p.type === 'month').value}`;
}

/** First month that may still be incomplete: the current WIB month, or the month in the file's export timestamp if earlier. */
export function openMonthCutoff({ now = new Date(), filename = '' } = {}) {
  const current = wibYearMonth(now);
  const exported = filename.match(EXPORT_STAMP_PATTERN)?.[1]?.slice(0, 6);
  return exported && exported < current ? exported : current;
}

/** Keeps only closed months, so a mid-month export never lands as a final monthly figure. */
export function closedMonthReport(report, cutoffYm) {
  const records = report.records.filter(record => !record.storageYearMonth || record.storageYearMonth < cutoffYm);
  const valid = records.filter(record => record.status === 'VALID');
  const openMonthRecords = report.records.length - records.length;
  const totalsByMonth = Object.fromEntries(
    Object.entries(report.totalsByMonth || {}).filter(([ym]) => ym.replace('-', '') < cutoffYm),
  );
  return {
    ...report,
    records,
    totalsByMonth,
    openMonthRecords,
    summary: {
      ...report.summary,
      validCount: valid.length,
      missingCount: records.filter(record => record.status === 'MISSING').length,
      errorCount: records.filter(record => record.status === 'ERROR').length,
      totalEnergyKwh: Number(valid.reduce((sum, record) => sum + record.energyKwh, 0).toFixed(3)),
    },
  };
}

/** A report value differing from an earlier report is a vendor restatement; the PLTS page keeps the earlier one. */
export function isReportRestatement(decision) {
  return decision.classification === 'CONFLICT' && decision.previousSource === REPORT_SOURCE;
}

// The report wins over API-sourced values (e.g. api_history zeros); only restatements are left as they were.
export function energyFlowRowsFromDecisions(decisions = []) {
  return decisions
    .filter(decision => WRITABLE_CLASSIFICATIONS.has(decision.classification)
      || (decision.classification === 'CONFLICT' && !isReportRestatement(decision)))
    .map(({ record }) => ({
      yearMonth: record.storageYearMonth,
      psId: Number(record.psId),
      yieldKwh: record.energyKwh,
      feedInKwh: record.feedInKwh ?? null,
      purchasedKwh: record.purchasedEnergyKwh ?? null,
      loadKwh: record.loadKwh ?? null,
      source: REPORT_SOURCE,
    }));
}

export async function upsertEnergyFlowRows(db, rows, now = new Date()) {
  for (const r of rows) {
    await db.$executeRaw`
      INSERT INTO energy_flow_monthly (id, year_month, ps_id, yield_kwh, feed_in_kwh, purchased_kwh, load_kwh, source, fetched_at, updated_at)
      VALUES (${`efm_${r.yearMonth}_${r.psId}_${r.source}`}, ${r.yearMonth}, ${r.psId}, ${r.yieldKwh}, ${r.feedInKwh}, ${r.purchasedKwh}, ${r.loadKwh}, ${r.source}, ${now}, ${now})
      ON CONFLICT (year_month, ps_id, source) DO UPDATE
      SET yield_kwh = EXCLUDED.yield_kwh,
          feed_in_kwh = EXCLUDED.feed_in_kwh,
          purchased_kwh = EXCLUDED.purchased_kwh,
          load_kwh = EXCLUDED.load_kwh,
          updated_at = EXCLUDED.updated_at;
    `;
  }
  return rows.length;
}
