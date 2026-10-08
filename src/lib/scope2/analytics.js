function rounded(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const position = Math.max(0, Math.min(1, fraction)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return rounded(sorted[lower] + (sorted[upper] - sorted[lower]) * weight, 4);
}

export function summarizeDistribution(rows, field) {
  const values = rows
    .filter(row => row.periodStatus !== 'partial')
    .map(row => row[field])
    .filter(Number.isFinite);
  if (!values.length) return { count: 0, average: null, median: null, p10: null, p90: null };
  return {
    count: values.length,
    average: rounded(values.reduce((sum, value) => sum + value, 0) / values.length, 4),
    median: percentile(values, 0.5),
    p10: percentile(values, 0.1),
    p90: percentile(values, 0.9),
  };
}

export function yoyLikeForLike(rows, month, field) {
  const pairs = new Map();
  for (const row of rows) {
    if (row.periodStatus === 'partial' || !Number.isFinite(row[field])) continue;
    const [year, rowMonth] = row.yearMonth.split('-').map(Number);
    if (rowMonth !== Number(month) || ![2025, 2026].includes(year)) continue;
    const key = row.psId ?? row.dcName;
    if (!pairs.has(key)) pairs.set(key, {});
    pairs.get(key)[year] = row[field];
  }
  const completePairs = [...pairs.values()].filter(pair => Number.isFinite(pair[2025]) && Number.isFinite(pair[2026]));
  const previousTotal = completePairs.reduce((sum, pair) => sum + pair[2025], 0);
  const currentTotal = completePairs.reduce((sum, pair) => sum + pair[2026], 0);
  return {
    pairCount: completePairs.length,
    previousTotal: rounded(previousTotal, 4),
    currentTotal: rounded(currentTotal, 4),
    changePct: previousTotal > 0 ? rounded(((currentTotal - previousTotal) / previousTotal) * 100, 2) : null,
  };
}

export function buildProjection(rows, { year, field }) {
  const eligible = rows.filter(row =>
    row.periodStatus !== 'partial'
    && Number(row.yearMonth.slice(0, 4)) === Number(year)
    && Number.isFinite(row[field]),
  );
  const monthTotals = new Map();
  for (const row of eligible) {
    monthTotals.set(row.yearMonth, (monthTotals.get(row.yearMonth) || 0) + row[field]);
  }
  const values = [...monthTotals.values()];
  const ytdComplete = values.reduce((sum, value) => sum + value, 0);
  const baseAnnual = values.length ? (ytdComplete / values.length) * 12 : null;
  return {
    completeMonthCount: values.length,
    ytdComplete: rounded(ytdComplete, 4),
    baseAnnual: baseAnnual === null ? null : rounded(baseAnnual, 4),
    minAnnual: baseAnnual === null ? null : rounded(baseAnnual * 0.95, 4),
    maxAnnual: baseAnnual === null ? null : rounded(baseAnnual * 1.05, 4),
    method: 'Rata-rata bulan lengkap × 12; rentang ±5%. Bulan parsial dikecualikan.',
  };
}

export function detectAnomalies(rows, { field }) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.psId ?? row.dcName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const anomalies = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    for (let index = 6; index < group.length; index += 1) {
      const current = group[index];
      if (current.periodStatus === 'partial' || !Number.isFinite(current[field])) continue;
      const baseline = group.slice(index - 6, index)
        .filter(item => item.periodStatus !== 'partial')
        .map(item => item[field])
        .filter(Number.isFinite);
      if (baseline.length < 6) continue;
      const median = percentile(baseline, 0.5);
      const average = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
      const standardDeviation = Math.sqrt(baseline.reduce((sum, value) => sum + ((value - average) ** 2), 0) / baseline.length);
      const changeFromMedianPct = median === 0 ? null : ((current[field] - median) / median) * 100;
      const zScore = standardDeviation > 0 ? (current[field] - average) / standardDeviation : null;
      if ((changeFromMedianPct !== null && Math.abs(changeFromMedianPct) > 25) || (zScore !== null && Math.abs(zScore) > 3)) {
        anomalies.push({
          ...current,
          medianBaseline: rounded(median, 4),
          changeFromMedianPct: rounded(changeFromMedianPct, 2),
          zScore: zScore === null ? null : rounded(zScore, 2),
        });
      }
    }
  }
  return anomalies;
}

export function parseScope2Query(searchParams) {
  const rawPeriod = (searchParams.get('period') || 'ytd').toLowerCase();
  const period = ['ytd', 'month', 'range'].includes(rawPeriod) ? rawPeriod : 'ytd';
  const tariffValue = Number(searchParams.get('tariff'));
  const rawGrid = (searchParams.get('grid') || 'all').trim();
  const grid = (rawGrid.toLowerCase() === 'all' || rawGrid === '') ? 'all' : rawGrid.toUpperCase();
  const rawDc = (searchParams.get('dc') || 'all').trim();
  const dc = (rawDc.toLowerCase() === 'all' || rawDc === '') ? 'all' : rawDc;

  let month = searchParams.get('month') || null;
  if (month) {
    month = month.trim();
    if (/^\d{1,2}$/.test(month)) {
      month = `2026-${month.padStart(2, '0')}`;
    } else if (/^\d{4}\d{2}$/.test(month)) {
      month = `${month.slice(0, 4)}-${month.slice(4, 6)}`;
    }
  }

  let from = searchParams.get('from') || null;
  if (from) {
    from = from.trim();
    if (/^\d{4}\d{2}$/.test(from)) from = `${from.slice(0, 4)}-${from.slice(4, 6)}`;
  }
  let to = searchParams.get('to') || null;
  if (to) {
    to = to.trim();
    if (/^\d{4}\d{2}$/.test(to)) to = `${to.slice(0, 4)}-${to.slice(4, 6)}`;
  }

  return {
    period,
    month,
    from,
    to,
    grid,
    dc,
    q: normalizeText(searchParams.get('q')),
    tariff: Number.isFinite(tariffValue) && tariffValue > 0 ? tariffValue : 1_400,
    scope2Basis: searchParams.get('scope2Basis') === 'load' ? 'load' : 'purchased',
  };
}

export function filterCanonicalRows(rows, query) {
  const queryGrid = (query.grid || 'all').trim().toLowerCase();
  const queryDc = (query.dc || 'all').trim().toLowerCase();
  const queryQ = query.q ? normalizeText(query.q) : '';

  return rows.filter(row => {
    if (queryGrid !== 'all' && (row.grid || '').toLowerCase() !== queryGrid) {
      return false;
    }
    if (queryDc !== 'all') {
      const matchCandidates = [
        String(row.psId || '').toLowerCase(),
        (row.dcName || '').toLowerCase(),
        (row.dcId || '').toLowerCase(),
        (row.dcId || '').toLowerCase().replace(/^dc-/, ''),
        normalizeText(row.dcName),
      ];
      const targetDc = queryDc.replace(/^dc-/, '');
      const normalizedTarget = normalizeText(queryDc);
      if (
        !matchCandidates.includes(queryDc) &&
        !matchCandidates.includes(targetDc) &&
        !matchCandidates.includes(normalizedTarget)
      ) {
        return false;
      }
    }
    if (queryQ) {
      const searchHaystack = normalizeText(`${row.dcName || ''} ${row.psId || ''} ${row.dcId || ''}`);
      if (!searchHaystack.includes(queryQ)) return false;
    }
    if (query.period === 'month' && query.month) {
      const targetMonth = query.month.includes('-')
        ? query.month
        : `2026-${query.month.padStart(2, '0')}`;
      if (row.yearMonth !== targetMonth) return false;
    }
    if (query.period === 'range') {
      if (query.from && row.yearMonth < query.from) return false;
      if (query.to && row.yearMonth > query.to) return false;
    }
    if (query.period === 'ytd' && !row.yearMonth.startsWith('2026-')) return false;
    return true;
  });
}

export function buildAutomaticSummary({ rows, targetPltsSharePct }) {
  const complete = rows.filter(row => row.periodStatus !== 'partial');
  const totalLoad = complete.reduce((sum, row) => sum + (row.loadKwh || 0), 0);
  const selfUse = complete.reduce((sum, row) => sum + (row.selfConsumedKwh || 0), 0);
  const purchasedCount = complete.filter(row => row.scope2Basis === 'purchased').length;
  const upperBoundCount = complete.filter(row => row.scope2Basis === 'load_upper_bound').length;
  const share = totalLoad > 0 ? (selfUse / totalLoad) * 100 : null;
  const sentences = [
    `${purchasedCount} observasi memakai basis listrik dibeli; ${upperBoundCount} observasi masih memakai batas atas beban.`,
    share === null ? 'Porsi PLTS belum tersedia karena self-consumption belum terbukti.' : `Porsi PLTS terhadap beban lengkap adalah ${rounded(share, 2)}%.`,
    Number.isFinite(targetPltsSharePct) ? `Target porsi PLTS yang dipakai adalah ${targetPltsSharePct}%.` : 'Target porsi PLTS belum tersedia karena dokumen target belum terbukti.',
    'Batasan: bulan parsial, faktor sementara, dan baris tanpa identitas energi tidak dimasukkan ke analitik lengkap.',
  ];
  return sentences;
}

