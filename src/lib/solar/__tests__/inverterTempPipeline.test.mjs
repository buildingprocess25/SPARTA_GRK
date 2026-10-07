import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  evaluateSampleValidity,
  formatDateWib,
  getWibDayUtcRange,
  aggregateDailyInverterTemp,
  aggregateMonthlyInverterTemp,
  InverterTempAggregationError,
} from '../inverterTemperatureAggregator.js';
import {
  computePearsonCorrelation,
  getInverterTemperaturePerformance,
} from '../inverterTemperatureService.js';
import {
  INVERTER_TEMP_V1,
  getActiveInverterTempMethodVersion,
  setActiveInverterTempMethodVersion,
} from '../inverterTemperatureConfig.js';
import {
  sanitizeCellForFormulaInjection,
  formatCsvRow,
  createZipBuffer,
  buildInverterTempXlsx,
  buildInverterTempZipCsv,
} from '../inverterTemperatureExport.js';

test('1. Pengujian batas hari WIB: tolak agregasi hari berjalan dan masa depan', async () => {
  const mockNow = new Date('2026-10-06T12:00:00.000Z'); // 19:00 WIB on 2026-10-06
  const todayWib = formatDateWib(mockNow);
  assert.equal(todayWib, '2026-10-06');

  // Attempt to aggregate current day (2026-10-06)
  await assert.rejects(
    aggregateDailyInverterTemp({
      dateWib: '2026-10-06',
      dryRun: true,
      now: mockNow,
    }),
    error => error instanceof InverterTempAggregationError && error.code === 'CURRENT_OR_FUTURE_DAY_FORBIDDEN',
  );

  // Attempt to aggregate future day (2026-10-07)
  await assert.rejects(
    aggregateDailyInverterTemp({
      dateWib: '2026-10-07',
      dryRun: true,
      now: mockNow,
    }),
    error => error instanceof InverterTempAggregationError && error.code === 'CURRENT_OR_FUTURE_DAY_FORBIDDEN',
  );

  // Past day (2026-10-05) range calculation is correct
  const range = getWibDayUtcRange('2026-10-05');
  assert.equal(range.startUtc.toISOString(), '2026-10-04T17:00:00.000Z'); // 00:00 WIB
  assert.equal(range.endUtc.toISOString(), '2026-10-05T16:59:59.999Z'); // 23:59:59 WIB
});

test('2. Aturan validitas v1: p4 dalam (0,100], p24 >= 10% rated power, rating hilang tolak', () => {
  const ratedIndex = new Map([
    ['RATED-SN-1', { ratedPowerW: 100_000, sourceRef: 'datasheet' }],
  ]);

  // Case A: Valid sample (p4=45C, p24=15kW >= 10kW)
  const valid = evaluateSampleValidity(
    { deviceSn: 'RATED-SN-1', p4: 45.0, p24: 15_000, deviceTime: new Date(), fetchedAt: new Date() },
    ratedIndex,
  );
  assert.equal(valid.isValid, true);
  assert.equal(valid.qualityFlags.length, 0);

  // Case B: p4 <= 0 C
  const zeroP4 = evaluateSampleValidity(
    { deviceSn: 'RATED-SN-1', p4: 0, p24: 15_000, deviceTime: new Date(), fetchedAt: new Date() },
    ratedIndex,
  );
  assert.equal(zeroP4.isValid, false);
  assert.ok(zeroP4.qualityFlags.includes('TEMPERATURE_OUT_OF_RANGE'));

  // Case C: p4 > 100 C
  const highP4 = evaluateSampleValidity(
    { deviceSn: 'RATED-SN-1', p4: 105.0, p24: 15_000, deviceTime: new Date(), fetchedAt: new Date() },
    ratedIndex,
  );
  assert.equal(highP4.isValid, false);
  assert.ok(highP4.qualityFlags.includes('TEMPERATURE_OUT_OF_RANGE'));

  // Case D: p24 < 10% rated power (9kW < 10kW)
  const lowPower = evaluateSampleValidity(
    { deviceSn: 'RATED-SN-1', p4: 45.0, p24: 9_000, deviceTime: new Date(), fetchedAt: new Date() },
    ratedIndex,
  );
  assert.equal(lowPower.isValid, false);
  assert.ok(lowPower.qualityFlags.includes('POWER_BELOW_MINIMUM_THRESHOLD'));

  // Case E: Missing rated power (SG6.0RT, SG12RT, SG33CX-P2)
  const unrated = evaluateSampleValidity(
    { deviceSn: 'UNRATED-SN-9', p4: 45.0, p24: 15_000, deviceTime: new Date(), fetchedAt: new Date() },
    ratedIndex,
  );
  assert.equal(unrated.isValid, false);
  assert.ok(unrated.qualityFlags.includes('MISSING_RATED_POWER'));

  // Case F: Stale device time (> 15 min behind fetchedAt)
  const now = new Date();
  const oldTime = new Date(now.getTime() - 20 * 60_000);
  const stale = evaluateSampleValidity(
    { deviceSn: 'RATED-SN-1', p4: 45.0, p24: 15_000, deviceTime: oldTime, fetchedAt: now },
    ratedIndex,
  );
  assert.equal(stale.isValid, false);
  assert.equal(stale.isStale, true);
  assert.ok(stale.qualityFlags.includes('STALE_DEVICE_TIME'));
});

test('3. Pearson correlation safeguard: n < 6 mengembalikan INSUFFICIENT_DATA tanpa angka r', () => {
  // Case A: n = 4 (insufficient data)
  const xSmall = [45, 48, 50, 52];
  const ySmall = [75, 73, 70, 68];
  const resSmall = computePearsonCorrelation(xSmall, ySmall);
  assert.equal(resSmall.status, 'INSUFFICIENT_DATA');
  assert.equal(resSmall.r, null);
  assert.equal(resSmall.n, 4);
  assert.equal(resSmall.pValue, null);
  assert.ok(resSmall.label.includes('Data belum cukup untuk korelasi'));

  // Case B: n = 8 (sufficient data)
  const xValid = [40, 42, 45, 48, 50, 52, 55, 58];
  const yValid = [80, 78, 75, 72, 70, 68, 65, 62]; // Strong negative correlation
  const resValid = computePearsonCorrelation(xValid, yValid);
  assert.equal(resValid.status, 'COMPUTED');
  assert.equal(resValid.n, 8);
  assert.ok(resValid.r !== null && resValid.r < -0.9);
  assert.ok(resValid.pValue !== null && resValid.pValue < 0.05);
  assert.equal(resValid.isSignificant, true);
  assert.ok(resValid.label.includes('signifikan secara statistik'));

  // Case C: Null filtering
  const xWithNulls = [40, null, 45, 48, 50, 52, null, 58];
  const yWithNulls = [80, 78, 75, 72, 70, null, 65, 62];
  const resFiltered = computePearsonCorrelation(xWithNulls, yWithNulls);
  assert.equal(resFiltered.n, 5); // Only 5 complete pairs
  assert.equal(resFiltered.status, 'INSUFFICIENT_DATA');
  assert.equal(resFiltered.r, null);
});

test('4. Versi aktif vs versi override: konfigurasi versi aktif eksplisit dan query side-by-side', () => {
  const original = getActiveInverterTempMethodVersion();
  try {
    setActiveInverterTempMethodVersion('isolar-inverter-temp-v1+rp-testv1');
    assert.equal(getActiveInverterTempMethodVersion(), 'isolar-inverter-temp-v1+rp-testv1');

    setActiveInverterTempMethodVersion('isolar-inverter-temp-v1+rp-testv2');
    assert.equal(getActiveInverterTempMethodVersion(), 'isolar-inverter-temp-v1+rp-testv2');
  } finally {
    setActiveInverterTempMethodVersion(original);
  }
});

test('5. Service query kanonik: struktur respons lengkap, seri paralel Open-Meteo terpisah', async () => {
  const mockDb = {
    monthlyYieldObservation: { findMany: async () => [] },
    productionTarget: { findMany: async () => [] },
    weatherDaily: { findMany: async () => [] },
    inverterTempDaily: { findMany: async () => [] },
    inverterTempSamplingRun: { findFirst: async () => null },
    inverterTempAggregationRun: { findFirst: async () => null },
  };

  const response = await getInverterTemperaturePerformance({
    scope: 'national',
    targetId: 'ALL',
    year: 2026,
    db: mockDb,
  });

  assert.ok(response.metadata);
  assert.equal(response.metadata.scope, 'national');
  assert.equal(response.metadata.year, 2026);
  assert.ok(response.metadata.temperatureLimitations.includes('bukan suhu permukaan modul sel PV'));
  assert.ok(response.metadata.coverageDefinitions.samplingCoverage);
  assert.ok(response.metadata.coverageDefinitions.productionCoverage);
  assert.ok(response.metadata.coverageDefinitions.monthlyCoverage);

  assert.equal(response.series.length, 12);
  for (const item of response.series) {
    assert.ok(item.month >= 1 && item.month <= 12);
    assert.ok(item.monthLabel);
    assert.equal(item.inverterTempC, null); // Null without synthetic fallback!
  }

  assert.equal(response.correlation.inverterTempVsPr.status, 'INSUFFICIENT_DATA');
  assert.equal(response.correlation.inverterTempVsPr.r, null);
});

test('6. Sanitasi formula injection & format CSV RFC 4180', () => {
  // Test formula injection characters: =, +, -, @
  assert.equal(sanitizeCellForFormulaInjection('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.equal(sanitizeCellForFormulaInjection('+12345'), "'+12345");
  assert.equal(sanitizeCellForFormulaInjection('-cmd|/c calc'), "'-cmd|/c calc");
  assert.equal(sanitizeCellForFormulaInjection('@IMPORTDATA("http://evil")'), "'@IMPORTDATA(\"http://evil\")");
  assert.equal(sanitizeCellForFormulaInjection('Normal Text'), 'Normal Text');
  assert.equal(sanitizeCellForFormulaInjection(123.45), '123.45');
  assert.equal(sanitizeCellForFormulaInjection(null), '');

  // Test RFC 4180 CSV Row formatting
  const formattedRow = formatCsvRow(['Lokasi, DC', 'Quotes "Included"', '=Formula', 45.6]);
  assert.equal(formattedRow, '"Lokasi, DC","Quotes ""Included""","\'=Formula",45.6');
});

test('7. Ekspor XLSX 3-Sheet: validitas struktur dan paritas dataset', async () => {
  const mockDb = {
    monthlyYieldObservation: { findMany: async () => [] },
    productionTarget: { findMany: async () => [] },
    weatherDaily: { findMany: async () => [] },
    inverterTempDaily: { findMany: async () => [] },
    inverterTempSamplingRun: { findFirst: async () => null },
    inverterTempAggregationRun: { findFirst: async () => null },
  };

  const xlsxBuf = await buildInverterTempXlsx({
    scope: 'national',
    targetId: 'ALL',
    year: 2026,
    db: mockDb,
  });

  assert.ok(Buffer.isBuffer(xlsxBuf));
  assert.ok(xlsxBuf.length > 500);

  // Parse generated XLSX workbook
  const wb = XLSX.read(xlsxBuf, { type: 'buffer' });
  assert.deepEqual(wb.SheetNames, ['Ringkasan Bulanan', 'Rincian Harian', 'Metadata & Kualitas']);

  const sheet1 = XLSX.utils.sheet_to_json(wb.Sheets['Ringkasan Bulanan'], { header: 1 });
  assert.equal(sheet1[0][0], 'Bulan (YYYY-MM)');
  assert.equal(sheet1[0][2], 'PR Terbobot (%)');
  assert.equal(sheet1[0][3], 'Suhu Inverter (°C)');
  assert.equal(sheet1.length, 13); // 1 header + 12 monthly rows
});

test('8. Ekspor ZIP 3-CSV: validitas ZIP buffer dan konten RFC 4180', async () => {
  const mockDb = {
    monthlyYieldObservation: { findMany: async () => [] },
    productionTarget: { findMany: async () => [] },
    weatherDaily: { findMany: async () => [] },
    inverterTempDaily: { findMany: async () => [] },
    inverterTempSamplingRun: { findFirst: async () => null },
    inverterTempAggregationRun: { findFirst: async () => null },
  };

  const zipBuf = await buildInverterTempZipCsv({
    scope: 'national',
    targetId: 'ALL',
    year: 2026,
    db: mockDb,
  });

  assert.ok(Buffer.isBuffer(zipBuf));
  // ZIP signature check: 0x50, 0x4b, 0x03, 0x04 (PK..)
  assert.equal(zipBuf[0], 0x50);
  assert.equal(zipBuf[1], 0x4b);
  assert.equal(zipBuf[2], 0x03);
  assert.equal(zipBuf[3], 0x04);
});
