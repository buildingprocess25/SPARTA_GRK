/**
 * PLN Electricity Tariff Master for Cost Savings Calculation
 * Source: Tarif Tenaga Listrik (TTL) PLN per Golongan
 * Reference: Permen ESDM & Keputusan Direksi PLN
 *
 * ATURAN:
 * - Tarif default untuk gedung komersial/industri (golongan I-3/TM atau B-2/TM)
 * - Tarif bisa di-override per DC jika ada kontrak tarif khusus
 * - Jika vendor API mengembalikan revenue valid dalam IDR, simpan sebagai referensi
 *   tapi tetap hitung kanonikal sebagai perbandingan
 */

/** Tarif PLN per kWh dalam Rupiah (IDR) */
export const PLN_TARIFF_DEFAULT = {
  /** Tarif Dasar Listrik (TDL) golongan Industri I-3/TM (>200 kVA) - Rp 1.444,70/kWh */
  ratePerKwh: 1444.70,
  golongan: 'I-3/TM',
  label: 'Industri Menengah >200 kVA',
  source: 'Permen ESDM No. 3/2020 & Penyesuaian TTL PLN 2024',
  currency: 'IDR',
};

/**
 * Per-DC tariff overrides (if a DC has a special contract rate).
 * Key = dcId, value = { ratePerKwh, golongan, source }
 * Currently empty — all DCs use the default tariff.
 */
export const PLN_TARIFF_OVERRIDES = {};

/**
 * Get the PLN tariff applicable to a specific DC.
 * @param {string} dcId - DC identifier (e.g. 'DC-KARAWANG')
 * @returns {{ ratePerKwh: number, golongan: string, currency: string, source: string }}
 */
export function getPlnTariff(dcId) {
  const override = PLN_TARIFF_OVERRIDES[dcId];
  if (override) {
    return { ...PLN_TARIFF_DEFAULT, ...override };
  }
  return { ...PLN_TARIFF_DEFAULT };
}

/**
 * Calculate cost savings from self-consumption of PLTS production.
 * @param {number} productionKwh - Energy produced by PLTS (kWh)
 * @param {string} [dcId] - Optional DC identifier for tariff lookup
 * @returns {{ savingsIdr: number|null, ratePerKwh: number, currency: string, method: string }}
 */
export function calculateCostSavings(productionKwh, dcId) {
  if (productionKwh === null || productionKwh === undefined || !Number.isFinite(productionKwh) || productionKwh <= 0) {
    return { savingsIdr: null, ratePerKwh: 0, currency: 'IDR', method: 'canonical' };
  }
  const tariff = getPlnTariff(dcId);
  return {
    savingsIdr: Math.round(productionKwh * tariff.ratePerKwh),
    ratePerKwh: tariff.ratePerKwh,
    currency: tariff.currency,
    method: 'canonical',
  };
}

/**
 * Validate and extract vendor revenue from iSolarCloud raw data.
 * Returns null if the currency is not IDR or the value is anomalous.
 * @param {object} rawIncomeObj - { unit: string, value: string|number }
 * @returns {{ value: number, currency: string }|null}
 */
export function extractVendorRevenue(rawIncomeObj) {
  if (!rawIncomeObj || typeof rawIncomeObj !== 'object') return null;
  const unit = String(rawIncomeObj.unit || '').toUpperCase();
  const value = Number(rawIncomeObj.value);
  // Only accept IDR — vendor may return INR, USD, CNY which are misconfigured
  if (unit !== 'IDR' || !Number.isFinite(value) || value < 0) return null;
  return { value, currency: 'IDR' };
}
