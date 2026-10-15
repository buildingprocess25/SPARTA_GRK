const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const WIB_OFFSET_MS = 7 * 3600_000;

function getWibDate(date = new Date()) {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

export function monthLabel(yearMonth) {
  const [, m] = yearMonth.split('-');
  return MONTH_NAMES[Number(m) - 1] || yearMonth;
}

export function getAvailableReportPeriods(availableMonths = []) {
  const years = availableMonths.length > 0
    ? [...new Set(availableMonths.map(m => m.slice(0, 4)))].sort().reverse()
    : ['2026'];

  const periods = [];

  years.forEach(year => {
    const yNum = Number(year);

    // 1. Akumulasi YTD & 1 Tahun Penuh
    periods.push({
      value: `${year}-01_${year}-09`,
      label: `Januari - September ${year} (YTD)`,
      type: 'ytd',
      year: yNum,
      startMonth: 1,
      endMonth: 9,
    });
    periods.push({
      value: `${year}-01_${year}-12`,
      label: `Januari - Desember ${year} (1 Tahun Penuh)`,
      type: 'ytd',
      year: yNum,
      startMonth: 1,
      endMonth: 12,
    });

    // 2. Kuartal Q1 s.d. Q4
    periods.push({
      value: `${year}-01_${year}-03`,
      label: `Kuartal 1 (${year}): Januari - Maret`,
      type: 'quarter',
      year: yNum,
      startMonth: 1,
      endMonth: 3,
    });
    periods.push({
      value: `${year}-04_${year}-06`,
      label: `Kuartal 2 (${year}): April - Juni`,
      type: 'quarter',
      year: yNum,
      startMonth: 4,
      endMonth: 6,
    });
    periods.push({
      value: `${year}-07_${year}-09`,
      label: `Kuartal 3 (${year}): Juli - September`,
      type: 'quarter',
      year: yNum,
      startMonth: 7,
      endMonth: 9,
    });
    periods.push({
      value: `${year}-10_${year}-12`,
      label: `Kuartal 4 (${year}): Oktober - Desember`,
      type: 'quarter',
      year: yNum,
      startMonth: 10,
      endMonth: 12,
    });

    // 3. Semua Bulan (Januari s.d. Desember)
    for (let m = 1; m <= 12; m++) {
      const mStr = String(m).padStart(2, '0');
      periods.push({
        value: `${year}-${mStr}_${year}-${mStr}`,
        label: `${MONTH_NAMES[m - 1]} ${year}`,
        type: 'month',
        year: yNum,
        startMonth: m,
        endMonth: m,
      });
    }
  });

  return periods;
}

export async function fetchAnnualReportData({ year, startMonth, endMonth, period: customPeriod } = {}) {
  let period = customPeriod;
  let targetYear;
  let startM;
  let endM;

  if (period) {
    const [startPart, endPart] = period.split('_');
    const [y1, m1] = startPart.split('-');
    const [, m2] = endPart.split('-');
    targetYear = Number(y1);
    startM = Number(m1);
    endM = Number(m2);
  } else {
    const wib = getWibDate();
    const currentWibYear = wib.getUTCFullYear();
    const currentWibMonth = wib.getUTCMonth() + 1;

    targetYear = year || currentWibYear;
    startM = startMonth ? Number(startMonth) : 1;
    endM = endMonth ? Number(endMonth) : (targetYear === currentWibYear ? currentWibMonth : (targetYear < currentWibYear ? 12 : currentWibMonth));
    const startStr = String(startM).padStart(2, '0');
    const endStr = String(endM).padStart(2, '0');
    period = `${targetYear}-${startStr}_${targetYear}-${endStr}`;
  }

  const [scope1Res, waterRes, emissionsRes, pltsSummaryRes] = await Promise.all([
    fetch(`/api/scope1?period=${encodeURIComponent(period)}`).then(r => r.json()),
    fetch(`/api/water-recycle?period=${encodeURIComponent(period)}`).then(r => r.json()),
    fetch(`/api/emissions?period=${encodeURIComponent(period)}`).then(r => r.json()),
    fetch(`/api/plts/dashboard/summary?mode=YTD&throughMonth=${endM}`).then(r => r.json()).catch(() => ({ success: false })),
  ]);

  if (!scope1Res.success) throw new Error(`Gagal memuat data Scope 1: ${scope1Res.error}`);
  if (!waterRes.success) throw new Error(`Gagal memuat data Water Recycle: ${waterRes.error}`);
  if (!emissionsRes.success) throw new Error(`Gagal memuat data Scope 2 & PLTS: ${emissionsRes.error}`);

  let periodLabel = '';
  if (startM === endM) {
    periodLabel = `${MONTH_NAMES[startM - 1]} ${targetYear}`;
  } else if (startM === 1) {
    periodLabel = `Januari - ${MONTH_NAMES[endM - 1]} ${targetYear} (YTD)`;
  } else {
    periodLabel = `${MONTH_NAMES[startM - 1]} - ${MONTH_NAMES[endM - 1]} ${targetYear}`;
  }

  return {
    year: targetYear,
    startMonth: startM,
    throughMonth: endM,
    period,
    periodLabel,
    scope1: scope1Res,
    water: waterRes,
    emissions: emissionsRes,
    pltsSummary: pltsSummaryRes?.success ? pltsSummaryRes.data : null,
  };
}

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

    const scope1GensetTon = Number((genset?.emissionTon || 0).toFixed(3));
    const scope1VehicleTon = Number((vehicle?.emissionTon || 0).toFixed(3));
    const scope1Ton = Number((scope1GensetTon + scope1VehicleTon).toFixed(3));
    const scope2Ton = Number((emissionRow?.scope2EmissionTon || 0).toFixed(3));
    const totalAdditionTon = Number((scope1Ton + scope2Ton).toFixed(3));

    // Aksi mitigasi per bulan
    const pltsProdKwh = emissionRow?.pltsProdKwh || 0;
    const pltsAvoidedTon = Number(((pltsProdKwh * 0.997) / 1000).toFixed(3));
    const waterAvoidedTon = Number((waterRow?.emissionAvoidedTon || 0).toFixed(3));
    const totalAvoidedTon = Number((pltsAvoidedTon + waterAvoidedTon).toFixed(3));
    const netTon = Number((totalAdditionTon - totalAvoidedTon).toFixed(3));

    const offsetRatioPct = totalAdditionTon > 0
      ? Number(((totalAvoidedTon / totalAdditionTon) * 100).toFixed(1))
      : 0;

    return {
      yearMonth: ym,
      label: `${monthLabel(ym)} ${ym.slice(0, 4)}`,
      scope1GensetTon,
      scope1VehicleTon,
      scope1Ton,
      scope2Ton,
      totalAdditionTon,
      pltsProdKwh,
      pltsAvoidedTon,
      waterAvoidedTon,
      totalAvoidedTon,
      netTon,
      offsetRatioPct,
    };
  });
}

export function exportCsvReport(reportData, filename) {
  const trend = buildCombinedMonthlyTrend(reportData);
  const headers = [
    'Bulan',
    'Scope 1 - Genset (tCO2e)',
    'Scope 1 - Kendaraan (tCO2e)',
    'Total Scope 1 (tCO2e)',
    'Scope 2 - Listrik PLN (tCO2e)',
    'Total Emisi Dihasilkan (tCO2e)',
    'Produksi PLTS (kWh)',
    'Emisi Ditekan - PLTS (tCO2e)',
    'Emisi Ditekan - Air (tCO2e)',
    'Total Emisi Ditekan (tCO2e)',
    'Emisi Bersih (tCO2e)',
    'Persentase Ditekan (%)'
  ];

  const rows = trend.map(t => [
    t.label,
    t.scope1GensetTon,
    t.scope1VehicleTon,
    t.scope1Ton,
    t.scope2Ton,
    t.totalAdditionTon,
    t.pltsProdKwh,
    t.pltsAvoidedTon,
    t.waterAvoidedTon,
    t.totalAvoidedTon,
    t.netTon,
    `${t.offsetRatioPct}%`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || `Ringkasan_Emisi_Alfamart_${reportData.period}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
