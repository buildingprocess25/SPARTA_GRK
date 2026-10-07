import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import prisma from '../src/lib/prisma.js';

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve('backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log('=== MEMULAI PROSES BACKUP DATABASE PLTS ===');
  console.log(`Waktu: ${new Date().toISOString()}`);

  // 1. Export via Prisma to JSON (Portable & Independent)
  const [monthlyYieldRows, obsRows, energyFlowRows, plantMasterRows, plantLatestRows] = await Promise.all([
    prisma.monthlyYield.findMany({ orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }] }),
    prisma.monthlyYieldObservation.findMany({ orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }, { source: 'asc' }] }),
    prisma.energyFlowMonthly.findMany({ orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }] }),
    prisma.plantMaster.findMany({ orderBy: { dcId: 'asc' } }),
    prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } }),
  ]);

  const jsonBackup = {
    metadata: {
      timestamp: new Date().toISOString(),
      counts: {
        monthlyYield: monthlyYieldRows.length,
        monthlyYieldObservation: obsRows.length,
        energyFlowMonthly: energyFlowRows.length,
        plantMaster: plantMasterRows.length,
        plantLatest: plantLatestRows.length,
      }
    },
    tables: {
      monthlyYield: monthlyYieldRows,
      monthlyYieldObservation: obsRows,
      energyFlowMonthly: energyFlowRows,
      plantMaster: plantMasterRows,
      plantLatest: plantLatestRows,
    }
  };

  const jsonPath = path.join(backupDir, `backup_plts_tables_${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonBackup, null, 2), 'utf-8');
  const jsonHash = crypto.createHash('sha256').update(fs.readFileSync(jsonPath)).digest('hex');

  console.log(`\n✔ [BACKUP JSON] Berhasil disimpan di:`);
  console.log(`  Path: ${jsonPath}`);
  console.log(`  SHA256: ${jsonHash}`);
  console.log(`  Row count monthly_yield: ${monthlyYieldRows.length}`);
  console.log(`  Row count monthly_yield_observation: ${obsRows.length}`);
  console.log(`  Row count energy_flow_monthly: ${energyFlowRows.length}`);

  // 2. Generate clean standalone SQL dump
  const sqlPath = path.join(backupDir, `backup_monthly_yield_${timestamp}.sql`);
  let sqlContent = `-- SQL DUMP BACKUP FOR PLTS TABLES\n-- Generated at: ${new Date().toISOString()}\n\n`;
  
  // Table: monthly_yield
  sqlContent += `-- Table: monthly_yield (${monthlyYieldRows.length} rows)\n`;
  for (const r of monthlyYieldRows) {
    sqlContent += `INSERT INTO monthly_yield (year_month, ps_id, energy_kwh, source, measurement_type, source_file, source_row, quality_status, updated_at) VALUES ('${r.yearMonth}', ${r.psId}, ${r.energyKwh}, '${r.source}', '${r.measurementType}', ${r.sourceFile ? `'${r.sourceFile.replace(/'/g, "''")}'` : 'NULL'}, ${r.sourceRow ?? 'NULL'}, ${r.qualityStatus ? `'${r.qualityStatus}'` : 'NULL'}, '${new Date(r.updatedAt).toISOString()}') ON CONFLICT (year_month, ps_id) DO UPDATE SET energy_kwh = EXCLUDED.energy_kwh, source = EXCLUDED.source;\n`;
  }
  
  // Table: monthly_yield_observation
  sqlContent += `\n-- Table: monthly_yield_observation (${obsRows.length} rows)\n`;
  for (const r of obsRows) {
    sqlContent += `INSERT INTO monthly_yield_observation (year_month, ps_id, source, energy_kwh, measurement_type, quality_status, updated_at) VALUES ('${r.yearMonth}', ${r.psId}, '${r.source}', ${r.energyKwh}, '${r.measurementType}', ${r.qualityStatus ? `'${r.qualityStatus}'` : 'NULL'}, '${new Date(r.updatedAt).toISOString()}') ON CONFLICT (year_month, ps_id, source, measurement_type) DO UPDATE SET energy_kwh = EXCLUDED.energy_kwh;\n`;
  }

  // Table: energy_flow_monthly
  sqlContent += `\n-- Table: energy_flow_monthly (${energyFlowRows.length} rows)\n`;
  for (const r of energyFlowRows) {
    sqlContent += `INSERT INTO energy_flow_monthly (year_month, ps_id, yield_kwh, feed_in_kwh, purchased_kwh, load_kwh, source, fetched_at) VALUES ('${r.yearMonth}', ${r.psId}, ${r.yieldKwh ?? 'NULL'}, ${r.feedInKwh ?? 'NULL'}, ${r.purchasedKwh ?? 'NULL'}, ${r.loadKwh ?? 'NULL'}, '${r.source}', '${new Date(r.fetchedAt).toISOString()}') ON CONFLICT (year_month, ps_id) DO UPDATE SET yield_kwh = EXCLUDED.yield_kwh, feed_in_kwh = EXCLUDED.feed_in_kwh, purchased_kwh = EXCLUDED.purchased_kwh, load_kwh = EXCLUDED.load_kwh;\n`;
  }

  fs.writeFileSync(sqlPath, sqlContent, 'utf-8');
  const sqlHash = crypto.createHash('sha256').update(fs.readFileSync(sqlPath)).digest('hex');
  console.log(`\n✔ [BACKUP SQL Dump] Berhasil disimpan di:`);
  console.log(`  Path: ${sqlPath}`);
  console.log(`  SHA256: ${sqlHash}`);
  console.log(`  Size: ${(fs.statSync(sqlPath).size / 1024).toFixed(2)} KB`);
  let pgDumpSuccess = true;

  await prisma.$disconnect();

  return {
    jsonPath,
    jsonHash,
    sqlPath: pgDumpSuccess ? sqlPath : null,
    counts: jsonBackup.metadata.counts,
  };
}

runBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
