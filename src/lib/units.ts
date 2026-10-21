export const KWH_PER_MWH = 1000;

// Display/export conversion; null and undefined pass through so "no data" stays distinguishable from 0.
export function kwhToMwh(kwh) {
  if (kwh === null || kwh === undefined || kwh === '') return kwh;
  const n = Number(kwh);
  return Number.isFinite(n) ? n / KWH_PER_MWH : kwh;
}

const idNumber = (value, digits) => value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Rupiah amounts switch to Miliar from Rp 1.000 Juta, so every Scope 3 card reads the same total the same way.
export function rupiahShort(rupiah) {
  const juta = (Number(rupiah) || 0) / 1_000_000;
  return juta >= 1000
    ? { value: `Rp ${idNumber(juta / 1000, 2)}`, unit: 'Miliar' }
    : { value: `Rp ${idNumber(juta, 1)}`, unit: 'Juta' };
}
