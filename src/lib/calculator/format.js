const idNumber = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatNumber(value) {
  return Number.isFinite(value) ? idNumber.format(value) : '—';
}

export function formatEmission(valueKg) {
  if (!Number.isFinite(valueKg)) return '—';
  return Math.abs(valueKg) >= 1_000
    ? `${idNumber.format(valueKg / 1_000)} tCO₂e (${idNumber.format(valueKg)} kgCO₂e)`
    : `${idNumber.format(valueKg)} kgCO₂e`;
}

export function formatTotalEmission(valueKg) {
  return Number.isFinite(valueKg) && valueKg !== 0 ? formatEmission(valueKg) : '—';
}
