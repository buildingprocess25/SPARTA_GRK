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

const FLOW_FIELDS = ['yieldKwh', 'feedInKwh', 'purchasedKwh', 'loadKwh'];
const sameValue = (a, b) => (a == null || b == null ? a == null && b == null : Math.abs(Number(a) - Number(b)) < 0.01);

/** Splits incoming rows into added, replaced (values differ) and unchanged against what is stored, in total and per month. */
export function diffEnergyFlowRows(existingRows, rows) {
  const keyOf = (row) => `${row.yearMonth}|${row.psId}|${row.source}`;
  const existing = new Map(existingRows.map((row) => [keyOf(row), row]));
  const totals = { added: 0, replaced: 0, unchanged: 0 };
  const months = new Map();
  for (const row of rows) {
    const month = months.get(row.yearMonth) || { yearMonth: row.yearMonth, plants: 0, yieldKwh: 0, added: 0, replaced: 0, unchanged: 0, yieldChangeKwh: 0 };
    months.set(row.yearMonth, month);
    month.plants++;
    month.yieldKwh += Number(row.yieldKwh) || 0;

    const previous = existing.get(keyOf(row));
    const status = !previous ? 'added' : FLOW_FIELDS.some((field) => !sameValue(previous[field], row[field])) ? 'replaced' : 'unchanged';
    totals[status]++;
    month[status]++;
    if (status === 'replaced') month.yieldChangeKwh += (Number(row.yieldKwh) || 0) - (Number(previous.yieldKwh) || 0);
  }
  const byMonth = [...months.values()]
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
    .map((month) => ({ ...month, yieldKwh: Math.round(month.yieldKwh), yieldChangeKwh: Math.round(month.yieldChangeKwh) }));
  return { ...totals, byMonth };
}

export async function loadExistingEnergyFlowRows(db, rows) {
  const months = [...new Set(rows.map((row) => row.yearMonth))];
  if (months.length === 0) return [];
  const stored = await db.$queryRaw`
    SELECT year_month, ps_id, source, yield_kwh, feed_in_kwh, purchased_kwh, load_kwh
    FROM energy_flow_monthly
    WHERE year_month = ANY(${months}) AND source = ${REPORT_SOURCE}
  `;
  return stored.map((row) => ({
    yearMonth: row.year_month,
    psId: Number(row.ps_id),
    source: row.source,
    yieldKwh: row.yield_kwh,
    feedInKwh: row.feed_in_kwh,
    purchasedKwh: row.purchased_kwh,
    loadKwh: row.load_kwh,
  }));
}
