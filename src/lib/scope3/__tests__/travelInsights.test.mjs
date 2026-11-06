import test from 'node:test';
import assert from 'node:assert/strict';

import { buildKuuMonthly, findDominantKuu, kuuSeries, listIncompleteEntries, rankFlightRoutes, summarizeKuu } from '../travelInsights.ts';

const entry = (over = {}) => ({
  journalCode: 'J1', kuu: 'A', yearMonth: '2026-01', category: 'FLIGHT', emissionStatus: 'CALCULATED',
  emissionTon: 1, amountRupiah: 1_000_000, distanceKm: 100, description: 'tiket', ...over,
});

test('merges entries by KUU, month and category', () => {
  const rows = buildKuuMonthly([entry(), entry({ journalCode: 'J2' }), entry({ category: 'HOTEL' }), entry({ yearMonth: '2026-02' })]);
  assert.equal(rows.length, 3);
  const flight = rows.find(row => row.category === 'FLIGHT' && row.yearMonth === '2026-01');
  assert.equal(flight.emissionTon, 2);
  assert.equal(flight.rupiah, 2_000_000);
  assert.equal(flight.distanceKm, 200);
});

test('lists only activity lines that lack a detail, largest cost first', () => {
  const list = listIncompleteEntries([
    entry(),
    entry({ journalCode: 'a', emissionStatus: 'NO_ROUTE', amountRupiah: 100 }),
    entry({ journalCode: 'b', emissionStatus: 'UNKNOWN_AIRPORT', amountRupiah: 300 }),
    entry({ journalCode: 'c', category: 'HOTEL', emissionStatus: 'NO_QUANTITY', amountRupiah: 200 }),
    entry({ journalCode: 'd', category: 'OTHER_TRAVEL', emissionStatus: 'NO_FACTOR', amountRupiah: 900 }),
  ]);
  assert.deepEqual(list.map(item => item.id), ['b', 'c', 'a']);
  assert.equal(list[0].statusLabel, 'Bandara tidak dikenal');
});

test('refunds need no completing', () => {
  assert.equal(listIncompleteEntries([entry({ emissionStatus: 'NO_ROUTE', amountRupiah: -500 })]).length, 0);
});

test('ranks flight routes across KUU and ignores other kinds', () => {
  const groups = [
    { category: 'FLIGHT', route: 'CGK-DPS', count: 2, emissionTon: 1, rupiah: 10, distanceKm: 5, isInternational: false },
    { category: 'FLIGHT', route: 'CGK-DPS', count: 3, emissionTon: 2, rupiah: 20, distanceKm: 5, isInternational: false },
    { category: 'FLIGHT', route: 'CGK-KNO', count: 1, emissionTon: 9, rupiah: 5, distanceKm: 9, isInternational: false },
    { category: 'FLIGHT', route: null, count: 1, emissionTon: 0, rupiah: 5, distanceKm: 0 },
    { category: 'HOTEL', route: 'Bali', count: 1, emissionTon: 99, rupiah: 5, distanceKm: 0 },
  ];
  const ranked = rankFlightRoutes(groups);
  assert.deepEqual(ranked.map(item => item.route), ['CGK-KNO', 'CGK-DPS']);
  assert.equal(ranked[1].count, 5);
  assert.equal(rankFlightRoutes(groups, 1).length, 1);
});

test('a month without entries is a gap, and zero emission stays zero', () => {
  const rows = buildKuuMonthly([entry({ emissionTon: 0 }), entry({ yearMonth: '2026-03', emissionTon: 2 })]);
  assert.deepEqual(kuuSeries(rows, 'A', ['2026-01', '2026-02', '2026-03'], 'emissionTon'), [0, null, 2]);
  assert.deepEqual(kuuSeries(rows, 'A', ['2026-01'], 'rupiahJuta'), [1]);
});

test('flags a KUU only when it dwarfs the next one', () => {
  const items = [{ kuu: 'A', emissionTon: 100 }, { kuu: 'B', emissionTon: 10 }];
  assert.deepEqual(findDominantKuu(items, 'emissionTon'), { kuu: 'A', ratio: 10 });
  assert.equal(findDominantKuu([{ kuu: 'A', emissionTon: 20 }, { kuu: 'B', emissionTon: 10 }], 'emissionTon'), null);
  assert.equal(findDominantKuu([{ kuu: 'A', emissionTon: 20 }], 'emissionTon'), null);
  assert.equal(findDominantKuu([{ kuu: 'A', emissionTon: 20 }, { kuu: 'B', emissionTon: 0 }], 'emissionTon'), null);
});

test('summarizes each KUU', () => {
  const [a] = summarizeKuu(buildKuuMonthly([entry(), entry({ yearMonth: '2026-02', category: 'HOTEL' })]));
  assert.equal(a.emissionTon, 2);
  assert.equal(a.rupiahJuta, 2);
  assert.equal(a.months, 2);
});
