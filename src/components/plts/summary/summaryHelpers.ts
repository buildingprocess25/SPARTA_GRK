import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '@/lib/solar/conversionConfig';

export const PLTS_EMISSION_FACTOR_LABEL = String(PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH).replace('.', ',');

// Fuzzy search normalizer: lowercase, trims, collapses repeated characters
export function normalizeFuzzy(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(.)\1+/g, '$1');
}

export function matchesFuzzy(loc, query) {
  if (!query || !query.trim()) return true;
  const qClean = normalizeFuzzy(query);
  const qRaw = query.toLowerCase().trim();

  const searchableFields = [
    loc.canonicalName,
    loc.dcId,
    loc.region,
    loc.grid,
    ...(loc.aliases || [])
  ];

  return searchableFields.some(f => {
    if (!f) return false;
    const fStr = String(f);
    return fStr.toLowerCase().includes(qRaw) || normalizeFuzzy(fStr).includes(qClean);
  });
}

export function formatNum(num, min = 1, max = 2) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return num.toLocaleString('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max });
}

export const GRID_OPTIONS = [
  { value: 'ALL', label: 'Semua wilayah' },
  { value: 'JAMALI', label: 'JAMALI (Jawa-Madura-Bali)' },
  { value: 'SUMATERA', label: 'Sumatera' },
  { value: 'KALBAR', label: 'Kalimantan Barat' },
  { value: 'KALSELTENG', label: 'Kalimantan Sel-Teng' },
  { value: 'SULSELRABAR', label: 'Sulawesi Sel-Ra-Bar' },
  { value: 'SULUTGO', label: 'Sulawesi Utara-Go' },
  { value: 'BATAM', label: 'Batam' },
  { value: 'NTB_LOMBOK', label: 'NTB - Lombok' },
];

export const DATA_FRESH_THRESHOLD_MIN = 30;

// <30m = Hijau
export const DATA_STALE_THRESHOLD_MIN = 180;

// 30m-180m = Kuning, >180m = Merah
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatDataAge(minutes) {
  if (minutes == null || isNaN(minutes) || minutes < 0) return null;
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  if (remMins === 0) return `${hours} jam lalu`;
  return `${hours} jam ${remMins} mnt lalu`;
}

export function extractHhMmWib(lastSyncTime) {
  if (!lastSyncTime) return '';
  const match = lastSyncTime.match(/(\d{1,2}[:.]\d{2})/);
  return match ? `${match[1].replace(':', '.')} WIB` : lastSyncTime;
}
