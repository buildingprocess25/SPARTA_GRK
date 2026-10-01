import fs from 'node:fs';
import path from 'node:path';

import prisma from '../src/lib/prisma.js';
import { parseIsolarMonthlyReportFile } from '../src/lib/importers/isolarMonthlyReport.js';
import {
  createPrismaMonthlyImportRepository,
  importIsolarMonthlyReport,
  toPublicImportResult,
} from '../src/lib/importers/isolarMonthlyImport.js';

const DEFAULT_FILES = [
  'Monthly Report_Annual report_20261001111519.csv',
  'Monthly Report_Annual report_20261001111530.csv',
];

function parseArgs(argv) {
  const commit = argv.includes('--commit');
  const json = argv.includes('--json');
  const files = argv.filter(arg => !arg.startsWith('--'));
  return { commit, json, files: files.length > 0 ? files : DEFAULT_FILES };
}

function resolveWorkspaceFile(file) {
  const root = path.resolve(process.cwd());
  const resolved = path.resolve(root, file);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Report path must stay inside workspace: ${file}`);
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`Report file not found in workspace: ${resolved}`);
  }
  return resolved;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repository = createPrismaMonthlyImportRepository(prisma);
  const results = [];

  for (const file of args.files) {
    const resolved = resolveWorkspaceFile(file);
    const report = parseIsolarMonthlyReportFile(resolved);
    const result = await importIsolarMonthlyReport({
      report,
      repository,
      commit: args.commit,
      now: new Date(),
    });
    results.push(toPublicImportResult(result));
  }

  const output = {
    mode: args.commit ? 'COMMIT' : 'DRY_RUN',
    workspace: process.cwd(),
    generatedAt: new Date().toISOString(),
    results,
    combined: results.reduce((acc, item) => {
      for (const key of ['new', 'identical', 'finalizePartial', 'conflict', 'missing', 'error']) {
        acc[key] += Number(item.reconciliation[key] || 0);
      }
      acc.sourceEnergyKwh = Number((acc.sourceEnergyKwh + Number(item.sourceSummary.totalEnergyKwh || 0)).toFixed(2));
      acc.inserted += Number(item.commit.inserted || 0);
      acc.finalized += Number(item.commit.finalized || 0);
      return acc;
    }, { new: 0, identical: 0, finalizePartial: 0, conflict: 0, missing: 0, error: 0, sourceEnergyKwh: 0, inserted: 0, finalized: 0 }),
  };

  process.stdout.write(`${JSON.stringify(output, null, args.json ? 2 : 2)}\n`);
}

main()
  .catch(error => {
    console.error(JSON.stringify({ status: 'error', message: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
