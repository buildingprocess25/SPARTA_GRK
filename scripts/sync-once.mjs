#!/usr/bin/env node

/**
 * npm run sync:once - Manual sync trigger for testing
 * Usage: node scripts/sync-once.mjs
 * 
 * Calls runSync({ trigger: 'manual' }) and prints summary.
 * NEVER prints tokens, secrets, or DATABASE_URL.
 */

import { fileURLToPath } from 'url';
import path from 'path';

// Load .env.local for standalone execution
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

import fs from 'fs';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  });
}

// Dynamic import after env is loaded
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

// Make prisma available globally for the sync module
globalThis.prisma = prisma;

// Import sync module
const { runSync } = await import('../src/lib/solar/sync.js');

console.log('━━━ iSolarCloud Manual Sync ━━━');
console.log(`Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
console.log('Trigger: manual\n');

try {
  const result = await runSync({ trigger: 'manual' });

  console.log('─── Hasil SyncRun ───');
  console.log(`Status: ${result.syncRun.status}`);
  console.log(`Plant count: ${result.plantCount}`);
  console.log(`HTTP calls vendor: ${result.httpCalls}`);
  if (result.error) console.log(`Error: ${result.error}`);

  // Count DB records
  const plantCount = await prisma.plantLatest.count();
  const syncCount = await prisma.syncRun.count();
  const dailyCount = await prisma.dailyYield.count();
  
  // Quota info
  const { getWibTimeInfo } = await import('../src/lib/solar/sync.js');
  const ti = getWibTimeInfo();
  const hourlyQ = await prisma.quotaCounter.findUnique({
    where: { kind_bucketKey: { kind: 'hourly', bucketKey: ti.hourBucket } }
  });
  const monthlyQ = await prisma.quotaCounter.findUnique({
    where: { kind_bucketKey: { kind: 'monthly', bucketKey: ti.monthBucket } }
  });

  console.log('\n─── Database State ───');
  console.log(`PlantLatest: ${plantCount} rows`);
  console.log(`SyncRun: ${syncCount} rows`);
  console.log(`DailyYield: ${dailyCount} rows`);
  console.log(`Kuota jam ini: ${hourlyQ?.count || 0} / 2000`);
  console.log(`Kuota bulan ini: ${monthlyQ?.count || 0} / 100000`);

  // Print plant table
  const plants = await prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } });
  console.log('\n─── Tabel Lokasi ───');
  console.log('ps_id\t\tNama\t\t\t\tKap(kWp)\tDaya(kW)\tYield(kWh)\tEqH\tStatus');
  for (const p of plants) {
    const name = (p.name || '').padEnd(28).slice(0, 28);
    const cap = String(p.capacityKwp).padStart(8);
    const pwr = p.currPowerKw !== null ? String(p.currPowerKw.toFixed(1)).padStart(8) : '    null';
    const yld = p.todayEnergyKwh !== null ? String(p.todayEnergyKwh.toFixed(1)).padStart(10) : '      null';
    const eqh = p.equivalentHour !== null ? p.equivalentHour.toFixed(2) : 'null';
    const st = p.psStatus === 1 ? 'Normal' : 'Offline';
    console.log(`${p.psId}\t${name}\t${cap}\t${pwr}\t${yld}\t${eqh}\t${st}`);
  }

} catch (err) {
  console.error('Sync failed:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
