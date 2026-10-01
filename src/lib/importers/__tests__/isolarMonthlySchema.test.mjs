import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'prisma', 'schema.prisma');
const migrationPath = path.join(
  root,
  'prisma',
  'migrations',
  '20261001090000_isolar_monthly_import_audit',
  'migration.sql',
);

test('MonthlyYield and ImportBatch expose auditable iSolar import provenance', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');

  for (const field of [
    'measurementType',
    'sourceFile',
    'sourceRow',
    'sourceFileHash',
    'importBatchId',
    'importedAt',
    'qualityStatus',
    'metadata',
  ]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`), `missing MonthlyYield.${field}`);
  }

  assert.match(schema, /fileHash\s+String\?/);
  assert.match(schema, /@@unique\(\[module, fileHash\]\)/);
  assert.match(schema, /monthlyYields\s+MonthlyYield\[\]/);
});

test('monthly import migration is additive-only', () => {
  assert.equal(fs.existsSync(migrationPath), true, 'migration.sql must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /ALTER TABLE "monthly_yield"\s+ADD COLUMN/);
  assert.match(sql, /ALTER TABLE "import_batch"\s+ADD COLUMN/);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE|UPDATE)\b/im);
});
