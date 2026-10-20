import { SOLAR_CONSTANTS } from '@/lib/solar/processor';
import { isFeatureEnabled } from '@/lib/solar/conversionConfig';
import { getYearToDateMonths } from '@/lib/reportingMonths';

export const ALL_METRIC_OPTIONS = [
  {
    id: 'specificYield',
    label: 'Produksi per kWp hari ini',
    trendLabel: 'Produksi per kWp per bulan',
    unit: 'kWh/kWp',
    trendUnit: 'kWh/kWp',
    desc: 'Listrik yang dihasilkan tiap 1 kWp panel (specific yield). Daftar memakai data hari ini, grafik memakai data bulanan.',
    sourceType: 'API_LIVE',
    chartSourceType: 'EXCEL_HISTORY'
  },
  {
    id: 'equivalentHour',
    label: 'Jam produksi penuh hari ini',
    trendLabel: 'Rata-rata jam produksi penuh per hari',
    unit: 'jam',
    trendUnit: 'jam/hari',
    desc: 'Berapa jam panel setara bekerja di kapasitas penuh (equivalent hours). Daftar memakai data hari ini, grafik rata-rata per hari tiap bulan.',
    sourceType: 'API_LIVE',
    chartSourceType: 'EXCEL_HISTORY'
  },
  {
    id: 'pr',
    label: 'Perkiraan PR (audit April 2026)',
    trendLabel: 'Perkiraan PR dari audit April 2026',
    unit: '%',
    trendUnit: '%',
    desc: 'Perkiraan kinerja panel dari audit April 2026 (acuan 4,2 jam matahari penuh per hari). Bukan data langsung; PR resmi iSolarCloud bisa berbeda.',
    sourceType: 'AUDIT_BASELINE',
    chartSourceType: 'AUDIT_BASELINE'
  },
  {
    id: 'yieldMwh',
    label: 'Total produksi',
    trendLabel: 'Produksi per bulan',
    unit: 'MWh',
    trendUnit: 'MWh',
    desc: 'Listrik yang dihasilkan PLTS (MWh).',
    sourceType: 'EXCEL_HISTORY',
    chartSourceType: 'EXCEL_HISTORY'
  },
  {
    id: 'capacityFactor',
    label: 'Faktor kapasitas',
    trendLabel: 'Faktor kapasitas per bulan',
    unit: '%',
    trendUnit: '%',
    desc: 'Produksi dibanding produksi maksimal jika panel bekerja penuh 24 jam setiap hari (capacity factor).',
    sourceType: 'EXCEL_HISTORY',
    chartSourceType: 'EXCEL_HISTORY'
  },
  {
    id: 'peakPower',
    label: 'Daya saat ini',
    trendLabel: 'Daya saat ini',
    unit: 'kW',
    trendUnit: 'kW',
    desc: 'Daya yang sedang dihasilkan menurut iSolarCloud (kW).',
    sourceType: 'API_LIVE',
    chartSourceType: 'API_LIVE'
  },
  {
    id: 'co2',
    label: 'Emisi yang dicegah',
    trendLabel: 'Emisi yang dicegah per bulan',
    unit: 'tCO₂e',
    trendUnit: 'tCO₂e',
    desc: `Produksi PLTS × ${SOLAR_CONSTANTS.CO2_FACTOR_PLTS} kgCO₂e/kWh.`,
    sourceType: 'EXCEL_HISTORY',
    chartSourceType: 'EXCEL_HISTORY'
  }
];

export const METRIC_OPTIONS = isFeatureEnabled('auditBaseline')
  ? ALL_METRIC_OPTIONS
  : ALL_METRIC_OPTIONS.filter(m => m.sourceType !== 'AUDIT_BASELINE');

// January through the current month; the current month counts only the days elapsed so far.
export const API_MONTHS = getYearToDateMonths().map(({ yearMonth, label }, index, all) => {
  const [year, month] = yearMonth.split('-').map(Number);
  const isCurrent = index === all.length - 1;
  return {
    ym: `${year}${String(month).padStart(2, '0')}`,
    label: `${label} ${year}`,
    short: label,
    days: isCurrent ? Math.max(1, new Date().getDate()) : new Date(year, month, 0).getDate(),
  };
});

export function getPlantColor(idx, total = 37) {
  const hue = Math.round((idx * 137.508) % 360);
  const sat = 68;
  const light = 48 + (idx % 3) * 4;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export const PALETTE = Array.from({ length: 37 }, (_, i) => getPlantColor(i, 37));
