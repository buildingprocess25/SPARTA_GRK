import { buildTargetMonthlyRows } from '../solar/rkapTargets.js';
import crypto from 'node:crypto';

function rowKey(row) {
  return `${row.yearMonth}:${row.metric}:${row.source}`;
}

export async function importRkapTargets({ repository, commit = false, year = 2026 } = {}) {
  if (!repository?.find || !repository?.upsert) throw new Error('RKAP target repository is required');
  const rows = buildTargetMonthlyRows(year);
  const result = { mode: commit ? 'COMMIT' : 'DRY_RUN', rows, newRecords: 0, identical: 0, conflicts: 0, inserted: 0 };

  const existingRows = repository.findMany ? await repository.findMany(rows) : null;
  const existingByKey = existingRows ? new Map(existingRows.map(row => [rowKey(row), row])) : null;
  const pending = [];
  for (const row of rows) {
    const existing = existingByKey ? existingByKey.get(rowKey(row)) : await repository.find(rowKey(row), row);
    if (!existing) {
      result.newRecords += 1;
      if (commit) pending.push(row);
      continue;
    }
    const identical = Number(existing.value) === row.value
      && existing.unit === row.unit
      && existing.sourceHash === row.sourceHash;
    if (identical) result.identical += 1;
    else result.conflicts += 1;
  }
  if (commit && pending.length) {
    if (repository.upsertMany) await repository.upsertMany(pending);
    else for (const row of pending) await repository.upsert(row);
    result.inserted = pending.length;
  }
  return result;
}

export function createPrismaRkapTargetRepository(prisma) {
  return {
    async findMany(rows) {
      const source = rows[0]?.source;
      const yearMonths = rows.map(row => row.yearMonth);
      if (prisma.targetMonthly) {
        return prisma.targetMonthly.findMany({ where: { source, yearMonth: { in: yearMonths } } });
      }
      const records = await prisma.$queryRawUnsafe(
        'SELECT * FROM "target_monthly" WHERE "source" = $1 AND "year_month" = ANY($2::text[])',
        source, yearMonths,
      );
      return records.map(record => ({
        ...record,
        yearMonth: record.year_month,
        sourceHash: record.source_hash,
      }));
    },
    async find(_key, row) {
      if (prisma.targetMonthly) {
        return prisma.targetMonthly.findUnique({
          where: { yearMonth_metric_source: { yearMonth: row.yearMonth, metric: row.metric, source: row.source } },
        });
      }
      const records = await prisma.$queryRawUnsafe(
        'SELECT * FROM "target_monthly" WHERE "year_month" = $1 AND "metric" = $2 AND "source" = $3 LIMIT 1',
        row.yearMonth, row.metric, row.source,
      );
      const record = records[0];
      return record ? { ...record, sourceHash: record.source_hash } : null;
    },
    async upsert(row) {
      if (prisma.targetMonthly) {
        return prisma.targetMonthly.upsert({
          where: { yearMonth_metric_source: { yearMonth: row.yearMonth, metric: row.metric, source: row.source } },
          create: row,
          update: {},
        });
      }
      return prisma.$executeRawUnsafe(
        `INSERT INTO "target_monthly"
          ("id", "year_month", "metric", "value", "unit", "source", "source_ref", "source_hash", "metadata", "updated_at")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,CURRENT_TIMESTAMP)
         ON CONFLICT ("year_month", "metric", "source") DO NOTHING`,
        crypto.randomUUID(), row.yearMonth, row.metric, row.value, row.unit, row.source,
        row.sourceRef, row.sourceHash, JSON.stringify(row.metadata || {}),
      );
    },
    async upsertMany(rows) {
      if (!rows.length) return;
      if (prisma.targetMonthly) {
        await prisma.targetMonthly.createMany({ data: rows, skipDuplicates: true });
        return;
      }
      const payload = rows.map(row => ({ id: crypto.randomUUID(), ...row }));
      await prisma.$executeRawUnsafe(
        `INSERT INTO "target_monthly"
          ("id", "year_month", "metric", "value", "unit", "source", "source_ref", "source_hash", "metadata", "updated_at")
         SELECT x.id, x.year_month, x.metric, x.value, x.unit, x.source, x.source_ref,
                x.source_hash, x.metadata, CURRENT_TIMESTAMP
         FROM jsonb_to_recordset($1::jsonb) AS x(
           id text, year_month text, metric text, value double precision, unit text,
           source text, source_ref text, source_hash text, metadata jsonb
         )
         ON CONFLICT ("year_month", "metric", "source") DO NOTHING`,
        JSON.stringify(payload.map(row => ({
          id: row.id,
          year_month: row.yearMonth,
          metric: row.metric,
          value: row.value,
          unit: row.unit,
          source: row.source,
          source_ref: row.sourceRef,
          source_hash: row.sourceHash,
          metadata: row.metadata,
        }))),
      );
    },
  };
}
