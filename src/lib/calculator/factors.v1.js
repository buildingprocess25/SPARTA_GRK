export const FACTOR_VERSION = 'calculator-reference-v2.0.0';

export const FACTOR_STATUS = Object.freeze({
  OFFICIAL: 'OFFICIAL',
  TEMPORARY: 'TEMPORARY',
  NEEDS_FACTOR: 'NEEDS_FACTOR',
});

const temporary = 'Nilai referensi umum untuk simulasi; verifikasi dokumen primer terbaru sebelum pelaporan resmi.';
const ipcc = 'IPCC 2006 Guidelines, default combustion factor (proxy; perlu lokalisasi)';
const defra = 'UK Government GHG Conversion Factors 2024 (proxy internasional; perlu lokalisasi)';
const gridSource = 'Referensi faktor jaringan ESDM/KLHK; tahun berlaku dan nilai wajib diverifikasi';

const factor = (id, category, name, value, unit, source, extra = {}) => Object.freeze({
  id, code: id, category, name, label: name, value, unit, source,
  year: extra.year ?? (source.startsWith('IPCC 2006') ? 2006 : 2024),
  version: extra.version ?? FACTOR_VERSION,
  status: extra.status ?? FACTOR_STATUS.TEMPORARY,
  notes: extra.notes ?? temporary,
  ...(category === 'fuel' ? { gwpVersion: 'IPCC AR5', gwp: { CO2: 1, CH4: 28, N2O: 265 } } : {}),
  ...extra,
});

/**
 * Satu-satunya katalog faktor Kalkulator Emisi. Nilai TEMPORARY hanya untuk
 * simulasi; NEEDS_FACTOR tidak pernah diperlakukan sebagai nol oleh engine.
 * densityKgPerL/densityKgPerM3 dan ncvMjPerKg dipakai untuk konversi unit.
 */
export const EMISSION_FACTORS = Object.freeze([
  factor('FUEL_RON88', 'fuel', 'Bensin RON 88', 2.31, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.74, ncvMjPerKg: 44.3 }),
  factor('FUEL_RON90', 'fuel', 'Bensin RON 90', 2.31, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.74, ncvMjPerKg: 44.3 }),
  factor('FUEL_RON92', 'fuel', 'Bensin RON 92', 2.31, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.74, ncvMjPerKg: 44.3 }),
  factor('FUEL_RON95', 'fuel', 'Bensin RON 95', 2.31, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.74, ncvMjPerKg: 44.3 }),
  factor('FUEL_RON98', 'fuel', 'Bensin RON 98', 2.31, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.74, ncvMjPerKg: 44.3 }),
  factor('FUEL_DIESEL_CN48', 'fuel', 'Solar / Minyak Solar CN48', 2.68, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.84, ncvMjPerKg: 43 }),
  factor('FUEL_DIESEL', 'fuel', 'Solar / Minyak Solar', 2.68, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.84, ncvMjPerKg: 43 }),
  factor('FUEL_DIESEL_CN51', 'fuel', 'Solar CN51', 2.68, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.84, ncvMjPerKg: 43 }),
  factor('FUEL_B30', 'fuel', 'Biosolar B30', 1.88, 'kgCO2e/L', 'IPCC 2006 default dengan pendekatan fraksi fosil 70%', { activityUnit: 'L', densityKgPerL: 0.85, ncvMjPerKg: 41, biogenic: true }),
  factor('FUEL_B35', 'fuel', 'Biosolar B35', 1.74, 'kgCO2e/L', 'IPCC 2006 default dengan pendekatan fraksi fosil 65%', { activityUnit: 'L', densityKgPerL: 0.85, ncvMjPerKg: 41, biogenic: true }),
  factor('FUEL_DEXLITE', 'fuel', 'Dexlite', 2.68, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.83, ncvMjPerKg: 43 }),
  factor('FUEL_DIESEL_OIL', 'fuel', 'Minyak Diesel', 3.20, 'kgCO2e/kg', ipcc, { activityUnit: 'kg', densityKgPerL: 0.86, ncvMjPerKg: 43 }),
  factor('FUEL_KEROSENE', 'fuel', 'Minyak Tanah', 2.54, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.80, ncvMjPerKg: 43.8 }),
  factor('FUEL_FUEL_OIL', 'fuel', 'Minyak Bakar', 3.11, 'kgCO2e/kg', ipcc, { activityUnit: 'kg', densityKgPerL: 0.96, ncvMjPerKg: 40.4 }),
  factor('FUEL_AVTUR', 'fuel', 'Avtur', 2.54, 'kgCO2e/L', ipcc, { activityUnit: 'L', densityKgPerL: 0.80, ncvMjPerKg: 43.8 }),
  factor('FUEL_LPG', 'fuel', 'LPG', 3.00, 'kgCO2e/kg', ipcc, { activityUnit: 'kg', densityKgPerL: 0.54, ncvMjPerKg: 47.3 }),
  factor('FUEL_LNG', 'fuel', 'LNG', 2.75, 'kgCO2e/kg', ipcc, { activityUnit: 'kg', densityKgPerL: 0.45, ncvMjPerKg: 48 }),
  factor('FUEL_CNG', 'fuel', 'CNG', 2.75, 'kgCO2e/kg', ipcc, { activityUnit: 'kg', densityKgPerM3: 0.72, ncvMjPerKg: 48 }),
  factor('FUEL_NATURAL_GAS', 'fuel', 'Gas Alam', 1.90, 'kgCO2e/m3', ipcc, { activityUnit: 'm3', densityKgPerM3: 0.72, ncvMjPerKg: 48 }),
  factor('FUEL_COAL', 'fuel', 'Batubara', 95.60, 'kgCO2e/GJ', ipcc, { activityUnit: 'GJ', ncvMjPerKg: 25.8 }),
  factor('FUEL_WOOD_PELLET', 'fuel', 'Biomassa / Pelet Kayu', 0.03, 'kgCO2e/kg', 'IPCC 2006: CO2 biogenik dilaporkan terpisah; nilai proxy CH4+N2O', { activityUnit: 'kg', densityKgPerM3: 650, ncvMjPerKg: 17, biogenic: true }),
  factor('FUEL_BIOGAS', 'fuel', 'Biogas', 0.02, 'kgCO2e/m3', 'IPCC 2006: CO2 biogenik dilaporkan terpisah; nilai proxy CH4+N2O', { activityUnit: 'm3', densityKgPerM3: 1.15, ncvMjPerKg: 20, biogenic: true }),

  factor('VEHICLE_MOTORCYCLE', 'vehicle', 'Motor', 0.077, 'kgCO2e/km', defra, { defaultKmPerLiter: 40, fuelFactorCode: 'FUEL_RON90' }),
  factor('VEHICLE_CAR_GASOLINE', 'vehicle', 'Mobil bensin', 0.192, 'kgCO2e/km', defra, { defaultKmPerLiter: 12, fuelFactorCode: 'FUEL_RON90' }),
  factor('VEHICLE_CAR_DIESEL', 'vehicle', 'Mobil diesel', 0.223, 'kgCO2e/km', defra, { defaultKmPerLiter: 12, fuelFactorCode: 'FUEL_DIESEL' }),
  factor('VEHICLE_PICKUP', 'vehicle', 'Pickup / L300', 0.335, 'kgCO2e/km', defra, { defaultKmPerLiter: 8, fuelFactorCode: 'FUEL_DIESEL' }),
  factor('VEHICLE_TRUCK_LIGHT', 'vehicle', 'Truk ringan', 0.490, 'kgCO2e/km', defra, { defaultKmPerLiter: 5.5, fuelFactorCode: 'FUEL_DIESEL' }),
  factor('VEHICLE_TRUCK_MEDIUM', 'vehicle', 'Truk sedang / berat', 0.890, 'kgCO2e/km', defra, { defaultKmPerLiter: 3.2, fuelFactorCode: 'FUEL_DIESEL' }),
  factor('VEHICLE_BOX_DELIVERY', 'vehicle', 'Box delivery', 0.420, 'kgCO2e/km', defra, { defaultKmPerLiter: 6.5, fuelFactorCode: 'FUEL_DIESEL' }),

  factor('GRID_JAMALI', 'grid', 'Jawa–Madura–Bali (Jamali)', 0.87, 'kgCO2e/kWh', gridSource, { year: 2019, locationOrGrid: 'Jamali' }),
  factor('GRID_SUMATERA', 'grid', 'Sumatera', 0.85, 'kgCO2e/kWh', gridSource, { year: 2019, locationOrGrid: 'Sumatera' }),
  factor('GRID_KALIMANTAN', 'grid', 'Kalimantan', 0.94, 'kgCO2e/kWh', gridSource, { year: 2019, locationOrGrid: 'Kalimantan' }),
  factor('GRID_SULAWESI', 'grid', 'Sulawesi', 0.81, 'kgCO2e/kWh', gridSource, { year: 2019, locationOrGrid: 'Sulawesi' }),
  factor('GRID_NUSA_TENGGARA', 'grid', 'Nusa Tenggara', 0.79, 'kgCO2e/kWh', gridSource, { year: 2019, locationOrGrid: 'Nusa Tenggara' }),
  factor('GRID_MALUKU_PAPUA', 'grid', 'Maluku–Papua', 0.78, 'kgCO2e/kWh', gridSource, { year: 2019, locationOrGrid: 'Maluku–Papua' }),
  factor('GRID_INDONESIA', 'grid', 'Indonesia (rata-rata nasional)', 0.87, 'kgCO2e/kWh', gridSource, { year: 2019, locationOrGrid: 'Indonesia' }),

  factor('FLIGHT_DOMESTIC_ECONOMY', 'travel', 'Pesawat domestik — ekonomi', 0.15, 'kgCO2e/penumpang-km', defra),
  factor('FLIGHT_DOMESTIC_BUSINESS', 'travel', 'Pesawat domestik — bisnis', 0.225, 'kgCO2e/penumpang-km', defra),
  factor('FLIGHT_INTERNATIONAL_ECONOMY', 'travel', 'Pesawat internasional — ekonomi', 0.12, 'kgCO2e/penumpang-km', defra),
  factor('FLIGHT_INTERNATIONAL_BUSINESS', 'travel', 'Pesawat internasional — bisnis', 0.348, 'kgCO2e/penumpang-km', defra),
  factor('FLIGHT_INTERNATIONAL_FIRST', 'travel', 'Pesawat internasional — first', 0.480, 'kgCO2e/penumpang-km', defra),
  factor('HOTEL_3_STAR', 'travel', 'Hotel bintang 1–3', 20, 'kgCO2e/kamar-malam', defra),
  factor('HOTEL_4_STAR', 'travel', 'Hotel bintang 4', 30, 'kgCO2e/kamar-malam', defra),
  factor('HOTEL_5_STAR', 'travel', 'Hotel bintang 5', 45, 'kgCO2e/kamar-malam', defra),
  factor('HOTEL_ROOM_NIGHT', 'travel', 'Hotel (rata-rata)', 30, 'kgCO2e/kamar-malam', defra),
  factor('TRAIN_KRL', 'travel', 'KRL', 0.035, 'kgCO2e/penumpang-km', defra),
  factor('TRAIN_INTERCITY', 'travel', 'KA antarkota', 0.041, 'kgCO2e/penumpang-km', defra),
  factor('TRAIN_HIGH_SPEED', 'travel', 'KA cepat', 0.030, 'kgCO2e/penumpang-km', defra),
  factor('TRAIN_PASSENGER_KM', 'travel', 'Kereta api (rata-rata)', 0.04, 'kgCO2e/penumpang-km', defra),
  factor('TRAVEL_BUS', 'travel', 'Bus', 0.105, 'kgCO2e/penumpang-km', defra),
  factor('TRAVEL_TAXI', 'travel', 'Taksi / ride-hailing', 0.192, 'kgCO2e/penumpang-km', defra),

  factor('RENEWABLE_SOLAR', 'renewable', 'PLTS (Surya)', 0, 'kgCO2e/kWh', 'Konfigurasi kalkulator: faktor siklus hidup dinonaktifkan (default 0)', { technology: 'solar' }),
  factor('RENEWABLE_WIND', 'renewable', 'PLTB (Angin)', 0, 'kgCO2e/kWh', 'Konfigurasi kalkulator: faktor siklus hidup dinonaktifkan (default 0)', { technology: 'wind' }),
  factor('RENEWABLE_HYDRO', 'renewable', 'PLTA / Hidro', 0, 'kgCO2e/kWh', 'Konfigurasi kalkulator: faktor siklus hidup dinonaktifkan (default 0)', { technology: 'hydro' }),
  factor('RENEWABLE_MICRO_HYDRO', 'renewable', 'PLTMH / Mikrohidro', 0, 'kgCO2e/kWh', 'Konfigurasi kalkulator: faktor siklus hidup dinonaktifkan (default 0)', { technology: 'micro-hydro' }),
  factor('RENEWABLE_GEOTHERMAL', 'renewable', 'PLTP (Panas Bumi)', 0, 'kgCO2e/kWh', 'Konfigurasi kalkulator: faktor siklus hidup dinonaktifkan (default 0)', { technology: 'geothermal' }),
  factor('RENEWABLE_BIOMASS', 'renewable', 'Biomassa', 0, 'kgCO2e/kWh', 'Konfigurasi kalkulator: CO2 biogenik wajib dilaporkan terpisah', { technology: 'biomass', biogenic: true }),
  factor('RENEWABLE_BIOGAS', 'renewable', 'Biogas', 0, 'kgCO2e/kWh', 'Konfigurasi kalkulator: CO2 biogenik wajib dilaporkan terpisah', { technology: 'biogas', biogenic: true }),
  factor('RENEWABLE_WASTE', 'renewable', 'PLTSa (Sampah)', 0, 'kgCO2e/kWh', 'Konfigurasi kalkulator: faktor siklus hidup dinonaktifkan (default 0)', { technology: 'waste' }),
  factor('RENEWABLE_OTHER', 'renewable', 'EBT lainnya', 0, 'kgCO2e/kWh', 'Konfigurasi kalkulator: faktor siklus hidup dinonaktifkan (default 0)', { technology: 'other' }),

  factor('EV_MOTORCYCLE', 'ev', 'Motor listrik', 0.035, 'kWh/km', 'Asumsi konsumsi kendaraan listrik untuk simulasi', { baselineKgPerKm: 0.077 }),
  factor('EV_CAR', 'ev', 'Mobil listrik', 0.16, 'kWh/km', 'Asumsi konsumsi kendaraan listrik untuk simulasi', { baselineKgPerKm: 0.192 }),
  factor('EV_TRUCK', 'ev', 'Truk listrik', 0.80, 'kWh/km', 'Asumsi konsumsi kendaraan listrik untuk simulasi', { baselineKgPerKm: 0.89 }),

  factor('OFFSET_SPE_GRK', 'offset', 'SPE-GRK / Sertifikat Pengurangan Emisi', 1, 'kgCO2e/kgCO2e', 'Nilai nominal unit sertifikat; validitas proyek tetap wajib diverifikasi'),
  factor('OFFSET_VOLUNTARY', 'offset', 'Kredit karbon sukarela bersertifikat', 1, 'kgCO2e/kgCO2e', 'Nilai nominal unit sertifikat; validitas proyek tetap wajib diverifikasi'),
  factor('OFFSET_REDD', 'offset', 'REDD+', 1, 'kgCO2e/kgCO2e', 'Nilai nominal unit kredit; permanensi dan vintage wajib diverifikasi'),
  factor('OFFSET_BLUE_CARBON', 'offset', 'Penanaman / blue carbon', 1, 'kgCO2e/kgCO2e', 'Nilai nominal hasil verifikasi; permanensi wajib diverifikasi'),
  factor('OFFSET_OTHER', 'offset', 'Offset lainnya', null, 'kgCO2e/unit', 'Belum ada faktor atau unit resmi', { status: FACTOR_STATUS.NEEDS_FACTOR }),

  factor('GREEN_BOND_PENDING', 'finance', 'Green bond', null, 'kgCO2e/Rp', 'Faktor resmi belum tersedia', { status: FACTOR_STATUS.NEEDS_FACTOR }),
  factor('GREEN_SUKUK_PENDING', 'finance', 'Green sukuk', null, 'kgCO2e/Rp', 'Faktor resmi belum tersedia', { status: FACTOR_STATUS.NEEDS_FACTOR }),
  factor('GREEN_SECURITY_PENDING', 'finance', 'Surat berharga hijau lainnya', null, 'kgCO2e/Rp', 'Faktor resmi belum tersedia', { status: FACTOR_STATUS.NEEDS_FACTOR }),
]);

export function factorByCode(code, registry = EMISSION_FACTORS) {
  const found = registry.find(item => item.code === code || item.id === code);
  return found ? structuredClone(found) : null;
}

export function factorsByCategory(category, registry = EMISSION_FACTORS) {
  return registry.filter(item => item.category === category).map(item => structuredClone(item));
}
