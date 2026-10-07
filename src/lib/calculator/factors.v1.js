export const FACTOR_VERSION = 'calculator-reference-v1';

export const EMISSION_FACTORS = Object.freeze([
  { code: 'FUEL_RON90', category: 'fuel', label: 'Bensin RON 90', value: 2.31, unit: 'kgCO2e/L', source: 'Nilai seed referensi — wajib verifikasi resmi', year: 2026, version: FACTOR_VERSION, status: 'REFERENCE_UNVERIFIED' },
  { code: 'FUEL_RON98', category: 'fuel', label: 'Bensin RON 98', value: 2.31, unit: 'kgCO2e/L', source: 'Nilai seed referensi — wajib verifikasi resmi', year: 2026, version: FACTOR_VERSION, status: 'REFERENCE_UNVERIFIED' },
  { code: 'FUEL_DIESEL', category: 'fuel', label: 'Minyak solar', value: 2.68, unit: 'kgCO2e/L', source: 'Nilai referensi sementara — wajib verifikasi resmi', year: 2026, version: FACTOR_VERSION, status: 'REFERENCE_UNVERIFIED' },
  { code: 'FUEL_LPG', category: 'fuel', label: 'LPG', value: 3.0, unit: 'kgCO2e/kg', source: 'Nilai referensi sementara — wajib verifikasi resmi', year: 2026, version: FACTOR_VERSION, status: 'REFERENCE_UNVERIFIED' },
  { code: 'GRID_JAMALI', category: 'grid', label: 'Jawa, Madura, Bali (Jamali)', value: 0.87, unit: 'kgCO2e/kWh', locationOrGrid: 'Jamali', source: 'Nilai seed referensi — wajib verifikasi resmi', year: 2026, version: FACTOR_VERSION, status: 'REFERENCE_UNVERIFIED' },
  { code: 'GRID_INDONESIA', category: 'grid', label: 'Indonesia', value: 0.87, unit: 'kgCO2e/kWh', locationOrGrid: 'Indonesia', source: 'Nilai referensi sementara — wajib verifikasi resmi', year: 2026, version: FACTOR_VERSION, status: 'REFERENCE_UNVERIFIED' },
  { code: 'FLIGHT_DOMESTIC_ECONOMY', category: 'travel', label: 'Pesawat domestik — ekonomi', value: 0.15, unit: 'kgCO2e/penumpang-km', source: 'Nilai simulasi — wajib verifikasi resmi', year: 2026, version: FACTOR_VERSION, status: 'REFERENCE_UNVERIFIED' },
  { code: 'FLIGHT_INTERNATIONAL_ECONOMY', category: 'travel', label: 'Pesawat internasional — ekonomi', value: 0.12, unit: 'kgCO2e/penumpang-km', source: 'Nilai simulasi — wajib verifikasi resmi', year: 2026, version: FACTOR_VERSION, status: 'REFERENCE_UNVERIFIED' },
  { code: 'HOTEL_ROOM_NIGHT', category: 'travel', label: 'Hotel', value: 30, unit: 'kgCO2e/kamar-malam', source: 'Nilai simulasi — wajib verifikasi resmi', year: 2026, version: FACTOR_VERSION, status: 'REFERENCE_UNVERIFIED' },
  { code: 'TRAIN_PASSENGER_KM', category: 'travel', label: 'Kereta api', value: 0.04, unit: 'kgCO2e/penumpang-km', source: 'Nilai simulasi — wajib verifikasi resmi', year: 2026, version: FACTOR_VERSION, status: 'REFERENCE_UNVERIFIED' },
  { code: 'GREEN_SECURITY_PENDING', category: 'finance', label: 'Surat Berharga Hijau', value: null, unit: 'kgCO2e/Rp', source: 'Faktor belum tersedia', year: 2026, version: FACTOR_VERSION, status: 'NEEDS_FACTOR' },
]);

export function factorByCode(code, registry = EMISSION_FACTORS) {
  const factor = registry.find(item => item.code === code);
  return factor ? structuredClone(factor) : null;
}
