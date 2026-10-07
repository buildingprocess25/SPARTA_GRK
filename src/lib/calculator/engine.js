import { factorByCode } from './factors.v1.js';

const DAY_MS = 86_400_000;

function parseDate(value, label = 'Tanggal') {
  const date = new Date(`${value}T00:00:00Z`);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} tidak valid`);
  return date;
}

function nonNegative(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} wajib berupa angka`);
  if (parsed < 0) throw new Error(`${label} tidak boleh negatif`);
  return parsed;
}

function requirePositive(value, label) {
  const parsed = nonNegative(value, label);
  if (parsed === 0) throw new Error(`${label} harus lebih dari 0`);
  return parsed;
}

function getFactor(code, registry, allowMissing = false) {
  const factor = factorByCode(code, registry);
  if (!factor) throw new Error('Faktor emisi tidak ditemukan');
  if (!Number.isFinite(factor.value)) {
    if (allowMissing) return factor;
    throw new Error('Faktor emisi belum tersedia');
  }
  return factor;
}

export function inclusiveDays(start, end) {
  const from = parseDate(start, 'Tanggal mulai');
  const to = parseDate(end, 'Tanggal selesai');
  if (to < from) throw new Error('Tanggal selesai harus sama atau setelah tanggal mulai');
  return Math.floor((to - from) / DAY_MS) + 1;
}

function daysInYear(year) {
  return new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29 ? 366 : 365;
}

function overlapAnnualAmount(annualKg, periodStart, periodEnd, ownershipStart, ownershipEnd) {
  const start = new Date(Math.max(parseDate(periodStart), parseDate(ownershipStart)));
  const end = new Date(Math.min(parseDate(periodEnd), parseDate(ownershipEnd)));
  if (end < start) return 0;
  let total = 0;
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    const segmentStart = new Date(Math.max(start, new Date(Date.UTC(year, 0, 1))));
    const segmentEnd = new Date(Math.min(end, new Date(Date.UTC(year, 11, 31))));
    const days = Math.floor((segmentEnd - segmentStart) / DAY_MS) + 1;
    total += annualKg * days / daysInYear(year);
  }
  return total;
}

function result(kgCo2e, factor = null, details = {}) {
  return { kgCo2e, status: 'calculated', factorSnapshot: factor ? structuredClone(factor) : null, details };
}

export function calculateEntry(input, registry) {
  switch (input.category) {
    case 'scope1a':
    case 'scope2':
    case 'renewable': {
      const activity = nonNegative(input.activity, 'Data aktivitas');
      const factor = getFactor(input.factorCode, registry);
      return result(activity * factor.value, factor, { activity, factorValue: factor.value });
    }
    case 'scope1b': {
      const factor = getFactor(input.factorCode, registry);
      const liters = input.mode === 'distance'
        ? nonNegative(input.distanceKm, 'Jarak') / requirePositive(input.kmPerLiter, 'Konsumsi kendaraan')
        : nonNegative(input.activity, 'Pemakaian BBM');
      return result(liters * factor.value, factor, { liters, factorValue: factor.value });
    }
    case 'flight':
    case 'train': {
      const factor = getFactor(input.factorCode, registry);
      const passengers = nonNegative(input.passengers, 'Jumlah penumpang');
      const distanceKm = nonNegative(input.distanceKm, 'Jarak');
      return result(passengers * distanceKm * factor.value, factor, { passengers, distanceKm });
    }
    case 'hotel': {
      const factor = getFactor(input.factorCode, registry);
      const rooms = nonNegative(input.rooms, 'Jumlah kamar');
      const nights = nonNegative(input.nights, 'Jumlah malam');
      return result(rooms * nights * factor.value, factor, { rooms, nights });
    }
    case 'financed': {
      const outstanding = nonNegative(input.outstanding, 'Outstanding');
      const enterpriseValue = requirePositive(input.enterpriseValue, 'Nilai perusahaan');
      const investeeEmissionKg = nonNegative(input.investeeEmissionKg, 'Emisi investee');
      const attribution = outstanding / enterpriseValue;
      if (attribution > 1) throw new Error('Faktor atribusi harus antara 0 dan 1');
      return result(attribution * investeeEmissionKg, null, { attribution });
    }
    case 'offset': {
      const annualKg = nonNegative(input.annualKg, 'Nominal tahunan');
      inclusiveDays(input.periodStart, input.periodEnd);
      inclusiveDays(input.ownershipStart, input.ownershipEnd);
      return result(overlapAnnualAmount(annualKg, input.periodStart, input.periodEnd, input.ownershipStart, input.ownershipEnd), null, { annualKg });
    }
    case 'ev':
    case 'kkb': {
      const factor = getFactor(input.factorCode, registry);
      const units = input.category === 'kkb' ? nonNegative(input.units, 'Jumlah unit') : 1;
      const distance = input.category === 'kkb' ? nonNegative(input.distanceKmPerUnit, 'Jarak per unit') * units : nonNegative(input.distanceKm, 'Jarak');
      const baseline = distance * nonNegative(input.baselineKgPerKm, 'Faktor baseline');
      const electricityKwh = distance * nonNegative(input.consumptionKwhPerKm, 'Konsumsi listrik');
      return result(Math.max(0, baseline - electricityKwh * factor.value), factor, { distanceKm: distance, baselineKg: baseline, electricityKwh });
    }
    case 'green_security': {
      const holdingRupiah = nonNegative(input.holdingRupiah, 'Nilai kepemilikan');
      const factor = getFactor(input.factorCode, registry, true);
      if (!Number.isFinite(factor.value)) return { kgCo2e: null, status: 'needs_factor', factorSnapshot: structuredClone(factor), details: { holdingRupiah } };
      return result(holdingRupiah * factor.value, factor, { holdingRupiah });
    }
    default:
      throw new Error('Kategori kalkulasi tidak dikenali');
  }
}

export function summarizeEntries(entries) {
  const valid = entries.filter(entry => Number.isFinite(entry.kgCo2e));
  const totalAdditionKg = valid.filter(entry => entry.kind === 'addition').reduce((sum, entry) => sum + entry.kgCo2e, 0);
  const totalReductionKg = valid.filter(entry => entry.kind === 'reduction').reduce((sum, entry) => sum + entry.kgCo2e, 0);
  const denominator = totalAdditionKg + totalReductionKg;
  const byCategory = {};
  for (const entry of valid) {
    const current = byCategory[entry.category] || { kgCo2e: 0, count: 0, sharePct: null };
    current.kgCo2e += entry.kgCo2e;
    current.count += 1;
    byCategory[entry.category] = current;
  }
  Object.values(byCategory).forEach(item => { item.sharePct = denominator > 0 ? item.kgCo2e / denominator * 100 : null; });
  return {
    totalAdditionKg,
    totalReductionKg,
    netKg: totalAdditionKg - totalReductionKg,
    reductionPct: totalAdditionKg > 0 ? totalReductionKg / totalAdditionKg * 100 : null,
    byCategory,
  };
}
