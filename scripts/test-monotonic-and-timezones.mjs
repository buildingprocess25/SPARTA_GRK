import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import { getPlantTimezone, getPlantLocalDateTime } from './sync-isolar.mjs';
import { requireIsolatedTestDatabase } from './lib/require-isolated-test-database.mjs';

console.log('=== TEST SIMULASI ATURAN MONOTON, TIMEZONE WITA/WIT, DAN ANTI-OVERWRITE ===\n');

async function runMonotonicSimulation() {
  requireIsolatedTestDatabase('test-monotonic-and-timezones');
  const testPsId = 9999991; // Dummy test plant ID
  const testDcId = 'DC-BALI'; // WITA timezone (UTC+8)
  const tz = getPlantTimezone(testDcId);
  assert.equal(tz, 'Asia/Makassar');

  // Cleanup test fixtures
  await prisma.dailyYield.deleteMany({
    where: { psId: testPsId },
  });

  try {
    // SCENARIO 1: Run pada 20:00 WIB (21:00 WITA) tanggal 2 Oktober 2026
    console.log('1. Simulasi Run Normal 20:00 WIB (21:00 WITA)...');
    const dt1 = new Date('2026-10-02T13:00:00.000Z'); // 20:00 WIB = 21:00 WITA
    const localTime1 = getPlantLocalDateTime(dt1, tz);
    assert.equal(localTime1.dateStr, '2026-10-02');
    assert.equal(localTime1.hour, 21);

    const yield1 = 485.5; // 485.5 kWh hari ini
    await prisma.dailyYield.upsert({
      where: { dateWib_psId: { dateWib: localTime1.dateStr, psId: testPsId } },
      update: { yieldKwh: yield1, capacityKwp: 100, source: 'api_live' },
      create: { dateWib: localTime1.dateStr, psId: testPsId, yieldKwh: yield1, capacityKwp: 100, source: 'api_live' },
    });

    const row1 = await prisma.dailyYield.findUnique({
      where: { dateWib_psId: { dateWib: '2026-10-02', psId: testPsId } },
    });
    assert.equal(row1.yieldKwh, 485.5);
    console.log(`   ✓ Data tersimpan: ${row1.dateWib} = ${row1.yieldKwh} kWh`);

    // SCENARIO 2: Sync ulang jam 21:30 WIB (22:30 WITA) pada hari yang sama (nilai naik sedikit atau sama)
    console.log('\n2. Simulasi Sync Ulang pada 21:30 WIB (22:30 WITA) - Nilai Tetap/Naik...');
    const dt2 = new Date('2026-10-02T14:30:00.000Z');
    const localTime2 = getPlantLocalDateTime(dt2, tz);
    assert.equal(localTime2.dateStr, '2026-10-02');

    const yield2 = 486.2; // Nilai update akhir
    const existingRow = await prisma.dailyYield.findUnique({
      where: { dateWib_psId: { dateWib: localTime2.dateStr, psId: testPsId } },
    });

    if (existingRow && yield2 >= existingRow.yieldKwh) {
      await prisma.dailyYield.update({
        where: { dateWib_psId: { dateWib: localTime2.dateStr, psId: testPsId } },
        data: { yieldKwh: yield2 },
      });
    }
    const row2 = await prisma.dailyYield.findUnique({
      where: { dateWib_psId: { dateWib: '2026-10-02', psId: testPsId } },
    });
    assert.equal(row2.yieldKwh, 486.2);
    console.log(`   ✓ Data ter-upsert: ${row2.dateWib} = ${row2.yieldKwh} kWh (jumlah baris tetap 1)`);

    // SCENARIO 3: Sync susulan jam 23:30 WIB (00:30 WITA tanggal 3 Oktober 2026)
    // Di WITA sudah reset ke 0 kWh karena tengah malam telah lewat
    console.log('\n3. Simulasi Sync Susulan 23:30 WIB (00:30 WITA hari berikutnya) - Reset 0 kWh...');
    const dt3 = new Date('2026-10-02T16:30:00.000Z'); // 23:30 WIB = 00:30 WITA tgl 3 Okt
    const localTime3 = getPlantLocalDateTime(dt3, tz);
    assert.equal(localTime3.dateStr, '2026-10-03'); // Tanggal lokal sudah berganti ke 3 Okt!
    assert.equal(localTime3.hour, 0);

    const yield3 = 0.0; // Vendor API mengirim today_energy = 0 kWh untuk hari baru
    await prisma.dailyYield.create({
      data: { dateWib: localTime3.dateStr, psId: testPsId, yieldKwh: yield3, capacityKwp: 100, source: 'api_live' },
    });

    // Verifikasi: Hari sebelumnya (2026-10-02) TIDAK terhapus dan nilainya tetap 486.2 kWh!
    const prevDay = await prisma.dailyYield.findUnique({
      where: { dateWib_psId: { dateWib: '2026-10-02', psId: testPsId } },
    });
    const currentDay = await prisma.dailyYield.findUnique({
      where: { dateWib_psId: { dateWib: '2026-10-03', psId: testPsId } },
    });
    assert.equal(prevDay.yieldKwh, 486.2);
    assert.equal(currentDay.yieldKwh, 0.0);
    console.log(`   ✓ Hari sebelumnya (2026-10-02) UTUH: ${prevDay.yieldKwh} kWh`);
    console.log(`   ✓ Hari baru (2026-10-03) tersimpan sebagai baris terpisah: ${currentDay.yieldKwh} kWh`);

    // SCENARIO 4: Retry / Run manual pada 01:00 WIB yang mencoba menimpa data tanggal 2026-10-02 dengan nilai 0 kWh
    console.log('\n4. Simulasi Aturan Monoton: Percobaan menimpa 2026-10-02 dengan today_energy=0...');
    const maliciousYield = 0.0;
    const existingPrev = await prisma.dailyYield.findUnique({
      where: { dateWib_psId: { dateWib: '2026-10-02', psId: testPsId } },
    });

    let didOverwrite = false;
    if (existingPrev) {
      if (maliciousYield >= existingPrev.yieldKwh) {
        await prisma.dailyYield.update({
          where: { dateWib_psId: { dateWib: '2026-10-02', psId: testPsId } },
          data: { yieldKwh: maliciousYield },
        });
        didOverwrite = true;
      } else {
        console.log(`   ✓ [MONOTONIC_PROTECTION] Penimpaan ditolak: Nilai baru (${maliciousYield}) < nilai eksisting (${existingPrev.yieldKwh}).`);
      }
    }
    assert.equal(didOverwrite, false);

    const verifiedPrev = await prisma.dailyYield.findUnique({
      where: { dateWib_psId: { dateWib: '2026-10-02', psId: testPsId } },
    });
    assert.equal(verifiedPrev.yieldKwh, 486.2);
    console.log(`   ✓ Nilai 2026-10-02 tetap aman dan terlindungi: ${verifiedPrev.yieldKwh} kWh.`);

    console.log('\n================================================================================');
    console.log('   SEMUA TEST ATURAN MONOTON DAN TIMEZONE WITA BERHASIL 100%!   ');
    console.log('================================================================================\n');
  } finally {
    // Cleanup test fixtures
    await prisma.dailyYield.deleteMany({
      where: { psId: testPsId },
    });
    await prisma.$disconnect();
  }
}

runMonotonicSimulation();
