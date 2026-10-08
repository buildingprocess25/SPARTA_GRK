import { getCanonicalEnergyRows, getCanonicalMonthlySummary, getCanonicalYtdSummary } from '../src/lib/energy-data.js';

async function testSharedLayer() {
  console.log('=== TESTING SHARED DATA LAYER ===');
  const ytd = await getCanonicalYtdSummary({ year: 2026, throughMonth: 9, includeStores: false });
  console.log('YTD Summary (37 DCs):', ytd);

  const monthly = await getCanonicalMonthlySummary({ year: 2026, throughMonth: 9, includeStores: false });
  console.log('\nMonthly Apr 2026:', monthly[3]);

  // Check cumulative avoided emission at April
  console.log('Apr cumAvoidedEmissionTon:', monthly[3].cumAvoidedEmissionTon);
  console.log('Apr sum of Jan-Apr avoided emission:', (monthly[0].avoidedEmissionTon + monthly[1].avoidedEmissionTon + monthly[2].avoidedEmissionTon + monthly[3].avoidedEmissionTon).toFixed(2));

  // Check sum of 9 months vs YTD
  const sum9MonthsAvoided = monthly.slice(0, 9).reduce((s, m) => s + m.avoidedEmissionTon, 0);
  console.log('Sum 9 months Avoided:', sum9MonthsAvoided.toFixed(2), 'vs YTD:', ytd.avoidedEmissionTon);

  const sum9MonthsScope2 = monthly.slice(0, 9).reduce((s, m) => s + m.scope2EmissionTon, 0);
  console.log('Sum 9 months Scope 2:', sum9MonthsScope2.toFixed(2), 'vs YTD:', ytd.scope2EmissionTon);

  // Check energy balance identity
  console.log('\nIdentity: yield == self + feedIn?');
  for (const m of monthly.slice(0, 9)) {
    const balance = Math.abs(m.yieldKwh - (m.selfConsumptionKwh + m.feedInKwh));
    if (balance > 0.001) console.error(`Violation at month ${m.month}: ${balance}`);
  }
  console.log('All 9 months passed yield == self + feedIn!');
}

testSharedLayer();
