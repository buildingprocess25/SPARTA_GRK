#!/usr/bin/env node

/**
 * Server-side Background Worker / Daemon for iSolarCloud Sync & 30-Minute Snapshot
 * Usage:
 *   node scripts/solar-daemon.mjs              (Run continuous daemon, default 5m loop)
 *   node scripts/solar-daemon.mjs --once       (Run single scheduler cycle and exit)
 *   node scripts/solar-daemon.mjs --snapshot   (Capture 30-min snapshot for current slot)
 *   node scripts/solar-daemon.mjs --status     (Print system health and snapshot audit report)
 *   node scripts/solar-daemon.mjs --history    (Print recent 30-min snapshot runs)
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

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

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
globalThis.prisma = prisma;

const { runSchedulerCycle } = await import('../src/lib/solar/scheduler.js');
const { captureSnapshot30m, getSnapshotStatusReport, getSnapshotHistory, get30mSlotInfo } = await import('../src/lib/solar/snapshot.js');
const { formatWibTime, getWibTimeInfo } = await import('../src/lib/solar/sync.js');

const args = process.argv.slice(2);

console.log('================================================================================');
console.log('SPARTA PLTS — SERVER SCHEDULER & 30-MINUTE SNAPSHOT ENGINE');
console.log(`Waktu Server: ${formatWibTime(new Date())}`);
console.log('================================================================================\n');

try {
  if (args.includes('--status')) {
    const report = await getSnapshotStatusReport();
    console.log('─── Status Sinkronisasi & Snapshot ───');
    console.log(`Status Sistem      : ${report.status}`);
    console.log(`Slot Saat Ini      : ${report.currentSlotWib} WIB`);
    console.log(`Slot Berikutnya    : ${report.nextSlotWib}`);
    console.log(`Jendela Operasional: ${report.isInSyncWindow ? 'AKTIF (05:30-18:30 WIB)' : 'DI LUAR JENDELA'}`);
    console.log('\n─── Polling Telemetri (5 Menit) ───');
    console.log(`Interval           : ${report.polling?.intervalMinutes} Menit`);
    console.log(`Sync Terakhir      : ${report.polling?.lastSuccessSyncAt || '-'}`);
    console.log(`Status Sync        : ${report.polling?.lastSyncStatus}`);
    console.log(`Plant Terupdate    : ${report.polling?.freshPlantsCount} / ${report.polling?.totalPlantsTracked}`);
    console.log('\n─── Snapshot Berkala (30 Menit) ───');
    console.log(`Interval           : ${report.snapshot30m?.intervalMinutes} Menit (:00 & :30)`);
    console.log(`Slot Snapshot Terakhir: ${report.snapshot30m?.lastSnapshotSlot || '-'}`);
    console.log(`Status Snapshot    : ${report.snapshot30m?.lastSnapshotStatus}`);
    console.log(`Record Slot Terakhir : ${report.snapshot30m?.totalCapturedInLastSlot} plants`);
    console.log(`Total Snapshot Hari Ini: ${report.snapshot30m?.totalSnapshotsToday} records`);
    if (report.snapshot30m?.lastSnapshotPowerKw) {
      console.log(`Total Daya Slot    : ${report.snapshot30m.lastSnapshotPowerKw.toLocaleString('id-ID')} kW`);
      console.log(`Total Energi Harian: ${report.snapshot30m.lastSnapshotTodayEnergyKwh.toLocaleString('id-ID')} kWh`);
    }
  } else if (args.includes('--history')) {
    const history = await getSnapshotHistory({ limit: 12 });
    console.log('─── 12 Slot Snapshot Terakhir ───');
    console.log('Slot WIB\t\tStatus\t\tPlant\tDaya(kW)\tToday(kWh)\tTrigger\tDurasi');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    for (const r of history.runs) {
      const slot = (r.slot_wib || '').padEnd(18);
      const st = (r.status || '').padEnd(10);
      const cnt = `${r.captured_count}/${r.total_plants}`.padEnd(8);
      const pwr = r.total_power_kw !== null ? String(r.total_power_kw.toFixed(1)).padStart(10) : '      null';
      const yld = r.total_today_energy_kwh !== null ? String(r.total_today_energy_kwh.toFixed(1)).padStart(12) : '        null';
      const trg = (r.trigger || '').padEnd(8);
      const dur = `${r.duration_ms || 0}ms`;
      console.log(`${slot}\t${st}\t${cnt}\t${pwr}\t${yld}\t${trg}\t${dur}`);
    }
  } else if (args.includes('--snapshot')) {
    console.log('Menjalankan Snapshot 30 Menit secara manual...');
    const res = await captureSnapshot30m({ trigger: 'manual' });
    console.log(`Hasil Snapshot: ${res.status}`);
    console.log(`Slot: ${res.slotWib} WIB`);
    console.log(`Captured: ${res.capturedCount} / ${res.totalPlants} plants`);
    console.log(`Total Daya: ${res.totalPowerKw} kW`);
    console.log(`Total Energi Hari Ini: ${res.totalTodayEnergyKwh} kWh`);
  } else if (args.includes('--once')) {
    console.log('Menjalankan 1 Siklus Scheduler (5m Poll + 30m Check)...');
    const res = await runSchedulerCycle({ trigger: 'manual', forceSync: true, forceSnapshot: true });
    console.log(`Sync Status    : ${res.syncResult?.status || res.syncResult?.syncRun?.status}`);
    console.log(`Snapshot Status: ${res.snapshotResult?.status}`);
    console.log(`Slot WIB       : ${res.slotWib}`);
  } else {
    // Continuous daemon loop
    console.log('Memulai Daemon Polling (Setiap 5 Menit) dan Snapshot (:00 & :30)...');
    console.log('Tekan Ctrl+C untuk menghentikan.\n');

    const runLoop = async () => {
      try {
        const cycle = await runSchedulerCycle({ trigger: 'daemon' });
        console.log(`[${formatWibTime(new Date())}] Siklus Selesai: Sync=${cycle.syncResult?.status || cycle.syncResult?.syncRun?.status || 'ok'}, Snapshot=${cycle.snapshotResult?.status || 'skipped'}`);
      } catch (err) {
        console.error(`[${formatWibTime(new Date())}] Error dalam siklus:`, err.message);
      }
    };

    await runLoop();
    setInterval(runLoop, 300_000); // 5 minutes
  }
} catch (err) {
  console.error('Fatal error:', err.message);
  process.exitCode = 1;
}
