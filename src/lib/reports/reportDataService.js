/**
 * Shared data fetcher for the official report exports (SRN-PPI / OJK
 * Sustainability Report). Pulls from the same real, already-verified API
 * routes the dashboards themselves use (/api/scope1, /api/water-recycle,
 * /api/emissions) rather than any mock context data, so a regulator-facing
 * export never diverges from what the dashboard actually shows.
 */
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const WIB_OFFSET_MS = 7 * 3600_000;

function getWibDate(date = new Date()) {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

export async function fetchAnnualReportData({ year } = {}) {
  const wib = getWibDate();
  const currentWibYear = wib.getUTCFullYear();
  const currentWibMonth = wib.getUTCMonth() + 1;

  const targetYear = year || currentWibYear;
  const endMonth = targetYear === currentWibYear
    ? currentWibMonth
    : (targetYear < currentWibYear ? 12 : currentWibMonth);
  const currentMonth = String(endMonth).padStart(2, '0');
  const period = `${targetYear}-01_${targetYear}-${currentMonth}`;

  const [scope1Res, waterRes, emissionsRes] = await Promise.all([
    fetch(`/api/scope1?period=${encodeURIComponent(period)}`).then(r => r.json()),
    fetch(`/api/water-recycle?period=${encodeURIComponent(period)}`).then(r => r.json()),
    fetch(`/api/emissions?period=${encodeURIComponent(period)}`).then(r => r.json()),
  ]);

  if (!scope1Res.success) throw new Error(`Gagal memuat data Scope 1: ${scope1Res.error}`);
  if (!waterRes.success) throw new Error(`Gagal memuat data Water Recycle: ${waterRes.error}`);
  if (!emissionsRes.success) throw new Error(`Gagal memuat data Scope 2 & PLTS: ${emissionsRes.error}`);

  const periodLabel = `Januari - ${MONTH_NAMES[endMonth - 1]} ${targetYear}`;

  return {
    year: targetYear,
    throughMonth: endMonth,
    period,
    periodLabel,
    scope1: scope1Res,
    water: waterRes,
    emissions: emissionsRes,
  };
}

export function monthLabel(yearMonth) {
  const [, m] = yearMonth.split('-');
  return MONTH_NAMES[Number(m) - 1];
}

/** Builds a combined per-month row set across Scope 1 (genset+kendaraan), Scope 2, PLTS avoided, and Water avoided. */
export function buildCombinedMonthlyTrend(reportData) {
  const { scope1, water, emissions } = reportData;
  const months = new Set([
    ...scope1.genset.monthlyTrend.map(m => m.yearMonth),
    ...scope1.vehicle.monthlyTrend.map(m => m.yearMonth),
    ...water.monthlyTrend.map(m => m.yearMonth),
    ...emissions.monthlyTrend.map(m => m.yearMonth),
  ]);
  const gensetByMonth = new Map(scope1.genset.monthlyTrend.map(m => [m.yearMonth, m]));
  const vehicleByMonth = new Map(scope1.vehicle.monthlyTrend.map(m => [m.yearMonth, m]));
  const waterByMonth = new Map(water.monthlyTrend.map(m => [m.yearMonth, m]));
  const emissionsByMonth = new Map(emissions.monthlyTrend.map(m => [m.yearMonth, m]));

  return [...months].sort().map(ym => {
    const genset = gensetByMonth.get(ym);
    const vehicle = vehicleByMonth.get(ym);
    const waterRow = waterByMonth.get(ym);
    const emissionRow = emissionsByMonth.get(ym);
    const scope1Ton = (genset?.emissionTon || 0) + (vehicle?.emissionTon || 0);
    const scope2Ton = emissionRow?.scope2EmissionTon || 0;
    const totalAdditionTon = scope1Ton + scope2Ton;
    const waterAvoidedTon = waterRow?.emissionAvoidedTon || 0;
    return {
      yearMonth: ym,
      label: `${monthLabel(ym)} ${ym.slice(0, 4)}`,
      scope1GensetTon: Number((genset?.emissionTon || 0).toFixed(3)),
      scope1VehicleTon: Number((vehicle?.emissionTon || 0).toFixed(3)),
      scope2Ton: Number(scope2Ton.toFixed(3)),
      totalAdditionTon: Number(totalAdditionTon.toFixed(3)),
      pltsProdKwh: emissionRow?.pltsProdKwh ?? null,
      waterAvoidedTon: Number(waterAvoidedTon.toFixed(3)),
      // PLTS avoided emission is only available as a period total per DC
      // (/api/emissions `data[].avoidedEmissionTon`), not broken down by
      // month yet - net here only nets off water, PLTS avoided total is
      // shown separately in the summary sheet.
      netTon: Number((totalAdditionTon - waterAvoidedTon).toFixed(3)),
    };
  });
}
