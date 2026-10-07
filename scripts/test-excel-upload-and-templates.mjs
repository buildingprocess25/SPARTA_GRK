import assert from 'node:assert/strict';
import { PrismaClient } from '../src/generated/prisma/index.js';
import * as XLSX from 'xlsx';
import {
  generateGensetTemplate,
  generateVehicleTemplate,
  generatePlnTemplate,
  generatePltsTemplate,
  generateWaterTemplate
} from '../src/lib/importers/templateGenerator.js';
import {
  parseAndValidateUpload,
  commitBatchToDatabase
} from '../src/lib/importers/batchUploadProcessor.js';
import { MASTER_FACILITIES } from '../src/lib/master/facilityMaster.js';
import { requireIsolatedTestDatabase } from './lib/require-isolated-test-database.mjs';

const prisma = new PrismaClient();

async function runTests() {
  requireIsolatedTestDatabase('test-excel-upload-and-templates');
  console.log('🧪 Starting Excel/CSV Templates & Batch Upload Test Suite...\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // TEST SUITE 1: Template Generation Tests
  console.log('--- SUITE 1: Template Generation & Structure ---');
  
  const templateGenerators = [
    { cat: 'GENSET', fn: generateGensetTemplate, filename: 'Template_Genset.xlsx' },
    { cat: 'VEHICLE', fn: generateVehicleTemplate, filename: 'Template_Kendaraan.xlsx' },
    { cat: 'PLN', fn: generatePlnTemplate, filename: 'Template_PLN.xlsx' },
    { cat: 'PLTS', fn: generatePltsTemplate, filename: 'Template_PLTS.xlsx' },
    { cat: 'WATER', fn: generateWaterTemplate, filename: 'Template_Water.xlsx' }
  ];

  for (const t of templateGenerators) {
    test(`Template ${t.cat} contains PETUNJUK, DATA_INPUT, and REFERENSI_FASILITAS`, () => {
      const wb = t.fn();
      assert.ok(wb && wb.SheetNames, 'Output should be a XLSX Workbook');
      assert.ok(wb.SheetNames.includes('PETUNJUK'), 'Must contain PETUNJUK sheet');
      assert.ok(wb.SheetNames.includes('DATA_INPUT'), 'Must contain DATA_INPUT sheet');
      assert.ok(wb.SheetNames.includes('REFERENSI_FASILITAS'), 'Must contain REFERENSI_FASILITAS sheet');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      assert.ok(Buffer.isBuffer(buffer), 'Output should convert to a Buffer');
      assert.ok(buffer.length > 1000, 'Buffer size should be valid xlsx');

      // Check Facilities sheet has verified facilities
      const facSheet = wb.Sheets['REFERENSI_FASILITAS'];
      const facRows = XLSX.utils.sheet_to_json(facSheet, { header: 1 });
      assert.ok(facRows.length >= 40, `Facility count in template reference should be at least 40 (found ${facRows.length})`);
    });
  }

  // TEST SUITE 2: Parser & Validation Tests (Scope 1 Genset)
  console.log('\n--- SUITE 2: Scope 1 Genset Parser & Calculation ---');

  await asyncTest('Parses valid Genset rows and skips sample rows', async () => {
    // Generate valid workbook
    const wsData = [
      ["KODE_FASILITAS", "NAMA_FASILITAS", "PERIODE", "TANGGAL_PENGISIAN", "JENIS_BBM", "MODE_INPUT", "JUMLAH_LITER", "NILAI_RUPIAH", "HARGA_PER_LITER", "NOMOR_BUKTI", "KODE_ASET", "JAM_OPERASI", "CATATAN"],
      ["FAC-DC-BALARAJA", "DC Balaraja", "2026-08", "2026-08-15", "SOLAR", "LITER", 1500, "", "", "INV-GEN-001", "GEN-01", 45, "Operasional genset rutin"],
      ["FAC-DC-KARAWANG", "DC Karawang", "2026-08", "2026-08-20", "BIOSOLAR", "RUPIAH", "", 13600000, 6800, "INV-GEN-002", "GEN-02", 30, "Pembelian BioSolar via PO"],
      ["CONTOH_JANGAN_DIIMPOR", "DC Contoh", "2026-08", "2026-08-01", "SOLAR", "LITER", 9999, "", "", "SAMPLE-01", "", "", "Sample row should be ignored"]
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "DATA_INPUT");
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseAndValidateUpload(buf, { categoryHint: 'GENSET', filename: 'test_genset.xlsx' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.totalRows, 2, 'Sample row must be skipped (2 data rows remaining)');
    assert.strictEqual(result.validCount, 2, 'Both rows must be valid');
    assert.strictEqual(result.errorCount, 0, 'No errors expected');

    // Check emission calculation for row 1: 1500 Liter * 2.6685 kgCO2e/L = 4002.75 kg = ~4.003 ton
    const r1 = result.records[0];
    assert.strictEqual(r1.facilityCode, 'FAC-DC-BALARAJA');
    assert.strictEqual(r1.normalizedCalculation.liters, 1500);
    assert.ok(Math.abs(r1.calculatedResult.emissionTon - 4.00) < 0.05, `Calculated emission: ${r1.calculatedResult.emissionTon}`);

    // Check emission calculation for row 2: 13,600,000 / 6800 = 2000 Liter * 2.6685 = 5.337 ton
    const r2 = result.records[1];
    assert.strictEqual(r2.facilityCode, 'FAC-DC-KARAWANG');
    assert.strictEqual(r2.normalizedCalculation.liters, 2000);
    assert.ok(Math.abs(r2.calculatedResult.emissionTon - 5.34) < 0.05, `Calculated emission: ${r2.calculatedResult.emissionTon}`);
  });

  // TEST SUITE 3: Validation & Error Handling
  console.log('\n--- SUITE 3: Rejection of Unregistered Facility & Missing Fields ---');

  await asyncTest('Rejects unknown facility code and invalid numbers with explicit error message', async () => {
    const wsData = [
      ["KODE_FASILITAS", "PERIODE", "JENIS_BBM", "MODE_INPUT", "JUMLAH_LITER"],
      ["FAC-UNKNOWN-999", "2026-08", "SOLAR", "LITER", 500],
      ["FAC-DC-BALARAJA", "2026-08", "SOLAR", "LITER", "INVALID_NUMBER"]
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "DATA_INPUT");
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseAndValidateUpload(buf, { categoryHint: 'GENSET', filename: 'invalid_data.xlsx' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.totalRows, 2);
    assert.strictEqual(result.errorCount, 2);
    assert.strictEqual(result.validCount, 0);

    // Row 1 error check
    assert.ok(result.records[0].errors.some(e => e.includes('tidak terdaftar pada Master Fasilitas')), 'Should reject unknown facility');
    // Row 2 error check
    assert.ok(result.records[1].errors.some(e => e.includes('Jumlah liter')), 'Should reject invalid number');
  });

  // TEST SUITE 4: Scope 1 Kendaraan & Pertamax Draft Status
  console.log('\n--- SUITE 4: Scope 1 Vehicle & Pertamax Draft Status ---');

  await asyncTest('Marks Pertamax vehicle transactions as DRAFT (PENDING_VALIDATION)', async () => {
    const wsData = [
      ["KODE_FASILITAS", "PERIODE", "TANGGAL_PENGISIAN", "NOMOR_POLISI", "UNIT_PENANGGUNG_JAWAB", "JENIS_BBM", "MODE_INPUT", "JUMLAH_LITER", "NOMOR_BUKTI"],
      ["FAC-DC-BALARAJA", "2026-08", "2026-08-10", "B 1234 ABC", "Logistik", "PERTALITE", "LITER", 100, "STRUK-001"],
      ["FAC-DC-BALARAJA", "2026-08", "2026-08-12", "B 5678 DEF", "Operational", "PERTAMAX", "LITER", 100, "STRUK-002"]
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "DATA_INPUT");
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseAndValidateUpload(buf, { categoryHint: 'VEHICLE', filename: 'kendaraan.xlsx' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.validCount, 2);
    assert.strictEqual(result.draftCount, 1, 'Pertamax row must be flagged as DRAFT');

    const pertaliteRow = result.records[0];
    assert.strictEqual(pertaliteRow.isDraft, false);
    assert.strictEqual(pertaliteRow.isValid, true);

    const pertamaxRow = result.records[1];
    assert.strictEqual(pertamaxRow.isDraft, true);
    assert.strictEqual(pertamaxRow.isValid, true);
  });

  // TEST SUITE 5: Scope 2 Listrik PLN & Sumatera Grid Factor
  console.log('\n--- SUITE 5: Scope 2 PLN & Grid Factor Verification ---');

  await asyncTest('Calculates Scope 2 PLN with verified Sumatera Grid Factor (0.761 kgCO2e/kWh)', async () => {
    const wsData = [
      ["KODE_FASILITAS", "PERIODE", "METER_ID", "PURCHASED_ELECTRICITY_KWH", "TOTAL_TAGIHAN_RUPIAH", "NOMOR_BUKTI"],
      ["FAC-DC-PALEMBANG", "2026-08", "531234567890", 100000, 145000000, "PLN-PLB-0826"]
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "DATA_INPUT");
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseAndValidateUpload(buf, { categoryHint: 'PLN', filename: 'pln_palembang.xlsx' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.validCount, 1);

    const r = result.records[0];
    assert.strictEqual(r.facilityCode, 'FAC-DC-PALEMBANG');
    assert.strictEqual(r.normalizedCalculation.kwh, 100000);
    // Factor: 0.761 -> 100,000 * 0.761 / 1000 = 76.10 ton CO2e
    assert.strictEqual(r.factorApplied, 0.761);
    assert.ok(Math.abs(r.calculatedResult.emissionTon - 76.10) < 0.1);
  });

  // TEST SUITE 6: Database Idempotent Commit Test
  console.log('\n--- SUITE 6: PostgreSQL Database Commit & Idempotency ---');

  await asyncTest('Commits batch to database idempotently and writes audit log', async () => {
    const testRecord = {
      rowNumber: 2,
      facilityCode: 'FAC-DC-BALARAJA',
      facilityName: 'DC Balaraja',
      period: '2026-09',
      date: '2026-09-15',
      proofRef: 'BATCH-TEST-INV-001',
      notes: 'Automated test batch insert',
      category: 'GENSET',
      categoryData: {
        fuelType: 'SOLAR',
        inputMode: 'LITER',
        liters: 800,
        assetCode: 'GEN-TEST',
        operatingHours: 25
      },
      normalizedCalculation: {
        liters: 800
      },
      factorApplied: 2.6685,
      calculatedResult: {
        fuelType: 'SOLAR',
        liters: 800,
        factorKgPerLiter: 2.6685,
        emissionKg: 2134.8,
        emissionTon: 2.1348
      },
      isValid: true,
      isDraft: false,
      errors: []
    };

    // First Commit
    const commit1 = await commitBatchToDatabase({
      records: [testRecord],
      category: 'GENSET',
      filename: 'automated_test_genset.xlsx',
      allowPartial: false,
      isDraft: false
    });

    assert.strictEqual(commit1.success, true);
    assert.strictEqual(commit1.committedCount, 1);
    assert.ok(commit1.batchId, 'Should generate a batchId');

    // Verify record in PostgreSQL FuelActivity
    const saved1 = await prisma.fuelActivity.findFirst({
      where: {
        dcId: 'FAC-DC-BALARAJA',
        yearMonth: '2026-09',
        proofRef: 'BATCH-TEST-INV-001'
      }
    });
    assert.ok(saved1, 'Record must exist in PostgreSQL database');
    assert.strictEqual(saved1.liters, 800);
    assert.strictEqual(saved1.source, 'EXCEL_IMPORT');
    assert.strictEqual(saved1.status, 'VERIFIED');

    // Verify ImportBatch audit record
    const batchLog = await prisma.importBatch.findUnique({
      where: { id: commit1.batchId }
    });
    assert.ok(batchLog, 'ImportBatch record must exist in PostgreSQL');
    assert.strictEqual(batchLog.recordCount, 1);
    assert.strictEqual(batchLog.module, 'GENSET');

    // Re-import the same record (Idempotency test)
    const commit2 = await commitBatchToDatabase({
      records: [testRecord],
      category: 'GENSET',
      filename: 'automated_test_genset.xlsx',
      allowPartial: false,
      isDraft: false
    });
    assert.strictEqual(commit2.success, true);
    assert.strictEqual(commit2.committedCount, 1);

    // Ensure record was updated in place, NOT duplicated
    const count = await prisma.fuelActivity.count({
      where: {
        dcId: 'FAC-DC-BALARAJA',
        yearMonth: '2026-09',
        proofRef: 'BATCH-TEST-INV-001'
      }
    });
    assert.strictEqual(count, 1, 'Re-import must NOT create duplicate rows');

    // Clean up test record
    await prisma.fuelActivity.deleteMany({
      where: { proofRef: 'BATCH-TEST-INV-001' }
    });
    await prisma.importBatch.delete({
      where: { id: commit1.batchId }
    });
    await prisma.importBatch.delete({
      where: { id: commit2.batchId }
    });
  });

  console.log(`\n========================================`);
  console.log(`🎉 TEST SUMMARY: ${passed}/${total} assertions passed successfully!`);
  console.log(`========================================\n`);

  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  console.error('Test script crashed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
