import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma.js';

const workspace = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'));
const baselinePath = path.resolve(workspace, 'src/data/monitorPltsApril2026.json');
const disabledPath = `${baselinePath}.hard-test-disabled`;
const goldenDir = path.resolve(workspace, 'test-fixtures');
const rollbackMarker = new Error('ROLLBACK_BASELINE_HARD_TEST');

function assertInsideWorkspace(target) {
  const relative = path.relative(workspace, target);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `Path di luar workspace: ${target}`);
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function goldenHashes() {
  return Object.fromEntries(
    fs.readdirSync(goldenDir)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => [name, hashFile(path.join(goldenDir, name))]),
  );
}

function dashboardSignature(data) {
  return JSON.stringify({
    summary: data.summary,
    monthly: data.monthly,
    fullYearMonthly: data.fullYearMonthly,
    plants: data.plants,
    prDetails: data.prDetails,
    support: data.support,
  });
}

async function main() {
  assert.equal(process.env.NEXT_PUBLIC_FEATURE_AUDIT_BASELINE === 'true', false, 'Hard-test hanya valid saat auditBaseline=false');
  assertInsideWorkspace(baselinePath);
  assertInsideWorkspace(disabledPath);
  assert.ok(fs.existsSync(baselinePath), `File baseline tidak ditemukan: ${baselinePath}`);
  assert.ok(!fs.existsSync(disabledPath), `File sementara sudah ada: ${disabledPath}`);

  const query = { period: '2026-01_2026-09', mode: 'YTD', throughMonth: 9, compare: '2025,2026', grid: 'ALL', plant: 'ALL' };
  const now = new Date('2026-10-02T13:00:00.000Z');
  const goldenBefore = goldenHashes();

  const { getPltsDashboard } = await import(`../src/lib/solar/dashboardService.js?before=${Date.now()}`);
  const before = await getPltsDashboard(query, { db: prisma, now, skipCache: true });
  const beforeSignature = dashboardSignature(before);

  fs.renameSync(baselinePath, disabledPath);
  try {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.plantMaster.updateMany({ data: { baselineInstalledKwp: 0 } });
        const cold = await import(`../src/lib/solar/dashboardService.js?disabled=${Date.now()}`);
        const after = await cold.getPltsDashboard(query, { db: tx, now, skipCache: true });
        assert.equal(dashboardSignature(after), beforeSignature, 'Angka dashboard berubah saat baseline dinonaktifkan keras');
        throw rollbackMarker;
      }, { timeout: 60_000 });
    } catch (error) {
      if (error !== rollbackMarker) throw error;
    }
  } finally {
    if (fs.existsSync(disabledPath)) fs.renameSync(disabledPath, baselinePath);
  }

  assert.deepEqual(goldenHashes(), goldenBefore, 'Golden snapshot berubah');
  const nonZeroBaselineRows = await prisma.plantMaster.count({ where: { baselineInstalledKwp: { gt: 0 } } });
  assert.ok(nonZeroBaselineRows > 0, 'Rollback baselineInstalledKwp tidak terbukti');
  console.log(JSON.stringify({
    result: 'PASS',
    baselineFileRenamedAndRestored: true,
    baselineColumnZeroedInsideRolledBackTransaction: true,
    dashboardSignatureIdentical: true,
    goldenHashesUnchanged: goldenBefore,
    restoredNonZeroBaselineRows: nonZeroBaselineRows,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
