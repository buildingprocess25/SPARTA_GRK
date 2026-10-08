import { FACTOR_STATUS, factorByCode } from './factors.v1.js';

const DAY_MS = 86_400_000;

function parseDate(value, label = 'Tanggal') {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) throw new Error(`${label} tidak valid`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() + 1 !== Number(match[2]) || date.getUTCDate() !== Number(match[3])) throw new Error(`${label} tidak valid`);
  return date;
}

function nonNegative(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} wajib berupa angka`);
  if (parsed < 0) throw new Error(`${label} tidak boleh negatif`);
  return parsed;
}

function positive(value, label) {
  const parsed = nonNegative(value, label);
  if (parsed === 0) throw new Error(`${label} harus lebih dari 0`);
  return parsed;
}

function getFactor(code, registry, allowUnavailable = false) {
  const found = factorByCode(code, registry);
  if (!found) throw new Error('Faktor emisi tidak ditemukan');
  if ((!Number.isFinite(found.value) || found.status === FACTOR_STATUS.NEEDS_FACTOR) && !allowUnavailable) {
    throw new Error('Faktor emisi belum tersedia');
  }
  return found;
}

export function inclusiveDays(start, end) {
  const from = parseDate(start, 'Tanggal mulai');
  const to = parseDate(end, 'Tanggal selesai');
  if (to < from) throw new Error('Tanggal selesai harus sama atau setelah tanggal mulai');
  return Math.floor((to - from) / DAY_MS) + 1;
}

export function daysInYear(year) {
  return new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29 ? 366 : 365;
}

export function prorateAnnualAmount(annualKg, periodStart, periodEnd, ownershipStart, ownershipEnd) {
  const annual = nonNegative(annualKg, 'Nominal tahunan');
  inclusiveDays(periodStart, periodEnd);
  inclusiveDays(ownershipStart, ownershipEnd);
  const start = new Date(Math.max(parseDate(periodStart), parseDate(ownershipStart)));
  const end = new Date(Math.min(parseDate(periodEnd), parseDate(ownershipEnd)));
  if (end < start) return 0;
  let total = 0;
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    const segmentStart = new Date(Math.max(start, new Date(Date.UTC(year, 0, 1))));
    const segmentEnd = new Date(Math.min(end, new Date(Date.UTC(year, 11, 31))));
    total += annual * (Math.floor((segmentEnd - segmentStart) / DAY_MS) + 1) / daysInYear(year);
  }
  return total;
}

function toKilograms(amount, unit, factor) {
  if (unit === 'kg') return amount;
  if (unit === 'L') {
    if (!factor.densityKgPerL) throw new Error('Densitas kg/L belum tersedia untuk konversi');
    return amount * factor.densityKgPerL;
  }
  if (unit === 'm3') {
    if (!factor.densityKgPerM3) throw new Error('Densitas kg/m³ belum tersedia untuk konversi');
    return amount * factor.densityKgPerM3;
  }
  if (unit === 'GJ') {
    if (!factor.ncvMjPerKg) throw new Error('Nilai kalor belum tersedia untuk konversi');
    return amount * 1_000 / factor.ncvMjPerKg;
  }
  throw new Error('Satuan aktivitas tidak didukung');
}

export function convertFuelActivity(amountValue, fromUnit, factor) {
  const amount = nonNegative(amountValue, 'Data aktivitas');
  const target = factor.activityUnit || factor.unit?.split('/').at(-1);
  if (fromUnit === target) return amount;
  const kilograms = toKilograms(amount, fromUnit, factor);
  if (target === 'kg') return kilograms;
  if (target === 'L') {
    if (!factor.densityKgPerL) throw new Error('Densitas kg/L belum tersedia untuk konversi');
    return kilograms / factor.densityKgPerL;
  }
  if (target === 'm3') {
    if (!factor.densityKgPerM3) throw new Error('Densitas kg/m³ belum tersedia untuk konversi');
    return kilograms / factor.densityKgPerM3;
  }
  if (target === 'GJ') {
    if (!factor.ncvMjPerKg) throw new Error('Nilai kalor belum tersedia untuk konversi');
    return kilograms * factor.ncvMjPerKg / 1_000;
  }
  throw new Error('Satuan faktor tidak didukung');
}

function calculated(kgCo2e, factors = [], details = {}) {
  const snapshots = factors.filter(Boolean).map(item => structuredClone(item));
  return { kgCo2e, status: 'calculated', factorSnapshot: snapshots[0] || null, factorSnapshots: snapshots, details };
}

function unavailable(factor, details = {}) {
  return { kgCo2e: null, status: 'needs_factor', factorSnapshot: structuredClone(factor), factorSnapshots: [structuredClone(factor)], details };
}

export function calculateEntry(input, registry) {
  switch (input.category) {
    case 'scope1a': {
      const emissionFactor = getFactor(input.factorCode, registry);
      const convertedActivity = convertFuelActivity(input.activity, input.activityUnit || emissionFactor.activityUnit || 'L', emissionFactor);
      return calculated(convertedActivity * emissionFactor.value, [emissionFactor], { activity: Number(input.activity), activityUnit: input.activityUnit || emissionFactor.activityUnit, convertedActivity, factorValue: emissionFactor.value });
    }
    case 'scope1b': {
      const emissionFactor = getFactor(input.factorCode, registry);
      if (input.mode === 'distance' && emissionFactor.category === 'vehicle') {
        const distanceKm = nonNegative(input.distanceKm, 'Jarak');
        const defaultConsumption = emissionFactor.defaultKmPerLiter;
        const kmPerLiter = positive(input.kmPerLiter || defaultConsumption, 'Konsumsi kendaraan');
        const fuel = getFactor(emissionFactor.fuelFactorCode, registry);
        const kgCo2e = distanceKm / kmPerLiter * fuel.value;
        return calculated(kgCo2e, [emissionFactor, fuel], { distanceKm, kmPerLiter, liters: distanceKm / kmPerLiter });
      }
      const liters = input.mode === 'distance'
        ? nonNegative(input.distanceKm, 'Jarak') / positive(input.kmPerLiter, 'Konsumsi kendaraan')
        : convertFuelActivity(input.activity, input.activityUnit || emissionFactor.activityUnit || 'L', emissionFactor);
      return calculated(liters * emissionFactor.value, [emissionFactor], { convertedActivity: liters, factorValue: emissionFactor.value });
    }
    case 'scope2': {
      const emissionFactor = getFactor(input.factorCode, registry);
      const activity = nonNegative(input.activity, 'Pemakaian listrik');
      return calculated(activity * emissionFactor.value, [emissionFactor], { activity, factorValue: emissionFactor.value });
    }
    case 'renewable': {
      // Compatibility: legacy entries only supplied activity + a grid factor.
      if (!input.technologyFactorCode) {
        const grid = getFactor(input.factorCode, registry);
        const activity = nonNegative(input.activity, 'Energi terbarukan');
        return calculated(activity * grid.value, [grid], { selfConsumedKwh: activity, exportedKwh: 0, gridFactor: grid.value, lifecycleFactor: 0 });
      }
      const grid = getFactor(input.gridFactorCode, registry);
      const technology = getFactor(input.technologyFactorCode, registry);
      const selfConsumedKwh = nonNegative(input.selfConsumedKwh, 'Energi dipakai sendiri');
      const exportedKwh = nonNegative(input.exportedKwh || 0, 'Energi diekspor');
      const avoidedPerKwh = Math.max(0, grid.value - technology.value);
      return calculated(selfConsumedKwh * avoidedPerKwh, [grid, technology], { selfConsumedKwh, exportedKwh, gridFactor: grid.value, lifecycleFactor: technology.value, avoidedPerKwh });
    }
    case 'flight':
    case 'train':
    case 'bus':
    case 'taxi': {
      const emissionFactor = getFactor(input.factorCode, registry);
      const passengers = nonNegative(input.passengers, 'Jumlah penumpang');
      const distanceKm = nonNegative(input.distanceKm, 'Jarak');
      return calculated(passengers * distanceKm * emissionFactor.value, [emissionFactor], { passengers, distanceKm });
    }
    case 'hotel': {
      const emissionFactor = getFactor(input.factorCode, registry);
      const rooms = nonNegative(input.rooms, 'Jumlah kamar');
      const nights = nonNegative(input.nights, 'Jumlah malam');
      return calculated(rooms * nights * emissionFactor.value, [emissionFactor], { rooms, nights });
    }
    case 'financed': {
      const outstanding = nonNegative(input.outstanding, 'Outstanding');
      const enterpriseValue = positive(input.enterpriseValue, 'Nilai perusahaan');
      const investeeEmissionKg = nonNegative(input.investeeEmissionKg, 'Emisi investee');
      const attribution = outstanding / enterpriseValue;
      if (attribution < 0 || attribution > 1) throw new Error('Faktor atribusi harus antara 0 dan 1');
      return calculated(attribution * investeeEmissionKg, [], { attribution });
    }
    case 'offset': {
      const annualKg = nonNegative(input.annualKg, 'Nominal tahunan');
      inclusiveDays(input.periodStart, input.periodEnd);
      inclusiveDays(input.ownershipStart, input.ownershipEnd);
      const offsetFactor = input.factorCode ? getFactor(input.factorCode, registry, true) : null;
      if (offsetFactor && (!Number.isFinite(offsetFactor.value) || offsetFactor.status === FACTOR_STATUS.NEEDS_FACTOR)) return unavailable(offsetFactor, { annualKg, periodStart: input.periodStart, periodEnd: input.periodEnd, ownershipStart: input.ownershipStart, ownershipEnd: input.ownershipEnd });
      const prorated = prorateAnnualAmount(annualKg, input.periodStart, input.periodEnd, input.ownershipStart, input.ownershipEnd);
      return calculated(prorated * (offsetFactor?.value ?? 1), offsetFactor ? [offsetFactor] : [], { annualKg, proratedKg: prorated });
    }
    case 'ev':
    case 'kkb': {
      const grid = getFactor(input.gridFactorCode || input.factorCode, registry);
      const vehicle = input.evFactorCode ? getFactor(input.evFactorCode, registry) : null;
      const units = input.category === 'kkb' ? nonNegative(input.units, 'Jumlah unit') : 1;
      const distance = input.category === 'kkb' ? nonNegative(input.distanceKmPerUnit, 'Jarak per unit') * units : nonNegative(input.distanceKm, 'Jarak');
      const baselineKgPerKm = nonNegative(input.baselineKgPerKm ?? vehicle?.baselineKgPerKm, 'Faktor baseline');
      const consumptionKwhPerKm = nonNegative(input.consumptionKwhPerKm ?? vehicle?.value, 'Konsumsi listrik');
      const baselineKg = distance * baselineKgPerKm;
      const electricityKwh = distance * consumptionKwhPerKm;
      return calculated(Math.max(0, baselineKg - electricityKwh * grid.value), [grid, vehicle], { distanceKm: distance, baselineKg, electricityKwh, electricityEmissionKg: electricityKwh * grid.value });
    }
    case 'green_security': {
      const holdingRupiah = nonNegative(input.holdingRupiah, 'Nilai kepemilikan');
      const pendingFactor = getFactor(input.factorCode, registry, true);
      if (!Number.isFinite(pendingFactor.value) || pendingFactor.status === FACTOR_STATUS.NEEDS_FACTOR) return unavailable(pendingFactor, { holdingRupiah });
      return calculated(holdingRupiah * pendingFactor.value, [pendingFactor], { holdingRupiah });
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
    unavailableCount: entries.filter(entry => entry.status === 'needs_factor').length,
    temporaryCount: entries.filter(entry => (entry.factorSnapshots || [entry.factorSnapshot]).filter(Boolean).some(item => item.status === FACTOR_STATUS.TEMPORARY)).length,
  };
}
