import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../prisma.ts';
import { getLastClosedMonth } from '../../reportingMonths.ts';

// Reads the live database. On 2026-11-02 a dev server started before the ratio-to-percent fix kept its old scheduler
// timer and rewrote October as ratios (0.67), which dropped every DC out of the PR. Restart `next dev` after changing
// prMonthlySync.ts; this test catches the leftover rows.
test('stored official PR for this year is a percent, not a ratio', async () => {
  const closed = getLastClosedMonth();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT year_month, percentile_cont(0.5) WITHIN GROUP (ORDER BY pr_percent) AS median
       FROM plant_pr_monthly WHERE year_month BETWEEN $1 AND $2 GROUP BY year_month`,
    `${closed.year}01`, closed.yearMonth.replace('-', ''),
  );
  await prisma.$disconnect();
  assert.ok(rows.length > 0, 'no PR rows for closed months');
  for (const r of rows) assert.ok(Number(r.median) > 5, `${r.year_month}: median ${r.median} looks like a ratio`);
});
