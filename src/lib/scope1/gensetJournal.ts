import { CARBON_FACTORS, calculateScope1FuelEmission } from '../carbon/carbonEngine.ts';
import { detectSlashOrder, parseCsvRows, parseLedgerAmount, parseLedgerDate } from '../scope3/travelLedger.ts';

// GL journal export of the genset fuel accounts 612304 / 622304. The journal holds rupiah only,
// so liters are estimated as rupiah / price per liter. Most store petty-cash lines read just
// "BBM UNTUK GENSET" without naming the fuel; those count as industrial Solar.
export const GENSET_ACCOUNTS = Object.freeze(['612304', '622304']);
export const GENSET_SOURCE = 'JURNAL_BBM_GENSET';

export const GENSET_PRICE_PER_LITER = Object.freeze({
  SOLAR: CARBON_FACTORS.FUEL.SOLAR.industrialPricePerLiter,
  PERTAMAX: CARBON_FACTORS.FUEL.PERTAMAX.defaultPricePerLiter,
  PERTALITE: CARBON_FACTORS.FUEL.PERTALITE.defaultPricePerLiter,
});

const REQUIRED_HEADERS = ['J_UU_PEMBUAT', 'J_ACCOUNTING_DATE', 'J_MSA_AKUN', 'J_REFER10', 'SALDO', 'J_CODE'];
const NON_FUEL = /\bOLI\b|COOLANT|ELEMENT|\bAKI\b|RADIATOR|MATERIAL|\bPERB\b|PERBAIKAN|SPARE|ENGKOL|FILTER|SWITCH|DRUM/;

/** null for oil, battery, coolant and spare-part lines, which are booked here but burn no fuel. */
export function classifyGensetFuel(description) {
  const text = String(description ?? '').toUpperCase();
  if (NON_FUEL.test(text)) return null;
  // "PERTAMAX DEX" and "PERTAMINA DEX" are diesel, so diesel is checked before Pertamax.
  if (/SOLAR|DEX/.test(text)) return 'SOLAR';
  if (/PERTAMAX|PERTAMX/.test(text)) return 'PERTAMAX';
  if (/PERTALITE|BENSIN/.test(text)) return 'PERTALITE';
  return 'SOLAR';
}

export function parseGensetJournalCsv(text) {
  const raw = String(text);
  const rows = parseCsvRows(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw);
  const headerIndex = rows.findIndex(r => r[0]?.trim() === 'J_UU_PEMBUAT');
  if (headerIndex < 0) throw new Error('Header J_UU_PEMBUAT tidak ditemukan. Pastikan file adalah ekspor jurnal BBM genset.');
  const header = rows[headerIndex].map(h => h.trim());
  const missing = REQUIRED_HEADERS.filter(h => !header.includes(h));
  if (missing.length) throw new Error(`Kolom wajib tidak ada: ${missing.join(', ')}`);
  const col = name => header.indexOf(name);
  const slashOrder = detectSlashOrder(rows.slice(headerIndex + 1).map(r => r[col('J_ACCOUNTING_DATE')]));

  const accountTotals = {};
  for (const r of rows.slice(0, headerIndex)) {
    const accountIndex = r.findIndex(c => /^0?6[12]2304$/.test(c.trim()));
    if (accountIndex >= 0) accountTotals[r[accountIndex].trim().replace(/^0/, '')] = parseLedgerAmount(r[accountIndex + 1]);
  }

  const lines = [];
  const problems = [];
  rows.slice(headerIndex + 1).forEach((r, offset) => {
    const lineNumber = headerIndex + offset + 2;
    if (!r[0]?.trim()) return;
    try {
      const description = r[col('J_REFER10')].replace(/^"+|"+$/g, '').trim();
      lines.push({
        lineNumber,
        kuu: r[col('J_UU_PEMBUAT')].trim(),
        accountingDate: parseLedgerDate(r[col('J_ACCOUNTING_DATE')], slashOrder),
        account: r[col('J_MSA_AKUN')].trim().replace(/^0/, ''),
        description,
        amountRupiah: parseLedgerAmount(r[col('SALDO')]),
        fuelType: classifyGensetFuel(description),
      });
    } catch (error) {
      problems.push(`baris ${lineNumber}: ${error.message}`);
    }
  });
  return { accountTotals, lines, problems };
}

export function verifyGensetTotals({ accountTotals, lines }: { accountTotals: Record<string, number>; lines: { account: string; amountRupiah: number }[] }) {
  return Object.entries(accountTotals).flatMap(([account, expected]) => {
    const actual = lines.filter(l => l.account === account).reduce((s, l) => s + l.amountRupiah, 0);
    return Math.abs(actual - expected) > 1 ? [`Akun ${account}: jumlah baris Rp ${actual} vs total file Rp ${expected}`] : [];
  });
}

/**
 * One FuelActivity row per KUU, month and fuel. Reversals net against their month;
 * a group that nets to zero or below is returned in `skipped` instead of being stored.
 */
export function buildGensetFuelActivities(lines, { sourceFile }) {
  const groups = new Map();
  for (const line of lines) {
    if (!line.fuelType) continue;
    const yearMonth = line.accountingDate.slice(0, 7);
    const key = `${line.kuu}|${yearMonth}|${line.fuelType}`;
    if (!groups.has(key)) groups.set(key, { kuu: line.kuu, yearMonth, fuelType: line.fuelType, costRupiah: 0, lineCount: 0 });
    const group = groups.get(key);
    group.costRupiah += line.amountRupiah;
    group.lineCount += 1;
  }

  const activities = [];
  const skipped = [];
  for (const group of groups.values()) {
    if (group.costRupiah <= 0) { skipped.push(group); continue; }
    const pricePerLiter = GENSET_PRICE_PER_LITER[group.fuelType];
    const emission = calculateScope1FuelEmission({ fuelType: group.fuelType, costRupiah: group.costRupiah, pricePerLiter });
    activities.push({
      date: `${group.yearMonth}-01`,
      yearMonth: group.yearMonth,
      dcId: group.kuu,
      facilityType: 'warehouse',
      fuelType: emission.fuelType,
      liters: emission.liters,
      costRupiah: group.costRupiah,
      pricePerLiter,
      emissionFactor: emission.factorKgPerLiter,
      emissionKg: emission.emissionKg,
      emissionTon: emission.emissionTon,
      status: 'ACTIVE',
      validationNote: `Jurnal BBM genset KUU ${group.kuu}: ${group.lineCount} baris, liter = Rp / Rp ${pricePerLiter.toLocaleString('id-ID')} per liter`,
      source: GENSET_SOURCE,
      batchId: `${GENSET_SOURCE}-${group.yearMonth.slice(0, 4)}`,
      proofRef: sourceFile,
      metadata: { kuu: group.kuu, lineCount: group.lineCount, litersEstimatedFromRupiah: true },
    });
  }
  return { activities, skipped };
}
