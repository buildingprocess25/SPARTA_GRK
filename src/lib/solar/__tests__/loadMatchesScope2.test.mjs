import test from 'node:test';
import assert from 'node:assert/strict';
import { getPltsLoadDashboard } from '../dashboardService.ts';
import { buildScope2CanonicalDashboard } from '../../scope2/dashboardService.ts';
import { getLastClosedMonth } from '../../reportingMonths.ts';

// Reads the live database. The "Kebutuhan listrik vs PLTS" tab and Scope 2 must report the same monthly DC demand:
// both are PLN purchase + self-used PLTS from energy_flow_monthly. They once differed (65.78 vs ~2,034 MWh for October,
// 32,525 vs 19,262 MWh in total) because the tab read the annual report's partial, double-counted load column.
test('monthly electricity demand on the PLTS load tab matches Scope 2 for every closed month', async () => {
  const closed = getLastClosedMonth();
  const load = await getPltsLoadDashboard({
    period: `${closed.year}-01_${closed.yearMonth}`, mode: 'YTD', month: closed.month, throughMonth: closed.month,
  }, { skipCache: true });
  const scope2 = await buildScope2CanonicalDashboard({ rootDir: process.cwd() });
  const scope2ByMonth = new Map((scope2.monthly || []).map((m) => [m.yearMonth.replace('-', ''), m.totalLoadKwh]));

  let compared = 0;
  for (const m of load.monthly) {
    const ym = String(m.yearMonth).replace('-', '');
    if (ym > closed.yearMonth.replace('-', '') || m.loadKwh == null || !scope2ByMonth.has(ym)) continue;
    const s2 = scope2ByMonth.get(ym);
    assert.ok(Math.abs(m.loadKwh - s2) / s2 < 0.005, `${ym}: PLTS tab ${m.loadKwh} vs Scope 2 ${s2}`);
    compared++;
  }
  assert.ok(compared >= 9, `compared only ${compared} months`);
});
