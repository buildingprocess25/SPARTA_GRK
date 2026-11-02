import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGensetFuelActivities, classifyGensetFuel, parseGensetJournalCsv, verifyGensetTotals, GENSET_PRICE_PER_LITER,
} from '../gensetJournal.ts';

const HEADER = 'J_UU_PEMBUAT,J_UU_CODE,J_ACCOUNTING_DATE,J_MSJC_CODE,J_MSA_AKUN,J_SUB_LEDGER1,J_MSD_CODE,J_REFER10,J_DEBIT,J_CREDIT,SALDO,J_ATTRIB1,J_ATTRIB2,J_ATTRIB3,J_TRANSAKSI,J_CODE';

const SAMPLE = [
  ',,,,,,,,,0612304,1050000,0,,,,',
  ',,,,,,,,,0622304,900000,0,,,,',
  ',,,,,,,,,,,,,,,',
  HEADER,
  'BZ01,B237,01/22/2026,KO,0612304,,O112,BBM UNTUK GENSET,150000,0,150000,x,,,KKB,1',
  'BZ01,B239,01/22/2026,KO,0612304,,O112,BBM UNTUK GENSET,600000,0,600000,x,,,KKB,2',
  'BZ01,BZ01,01/13/2026,PA,0612304,,O112,(HUA-J) B731 PMBLN PERTAMAX GENSET MOKO,250000,0,250000,x,,,TBBD_J,3',
  'BZ01,B645,01/31/2026,ASA,0612304,,O112,"ATK - OLI SHELL TELLUS S2 MX 46 (PER DRUM 209 L)",50000,0,50000,x,,,ATK,4',
  'BZ01,BZ01,02/12/2026,PA,0622304,,H060,(HUA-J) BY LII PERTAMAX DEX UNTUK GENSET OFFICE BDG,900000,0,900000,x,,,TBBD_J,5',
].join('\r\n');

test('fuel is read from the description; non-fuel lines are excluded', () => {
  assert.equal(classifyGensetFuel('BBM UNTUK GENSET'), 'SOLAR');
  assert.equal(classifyGensetFuel('ATK - BBM INDUSTRI BIO SOLAR B40'), 'SOLAR');
  assert.equal(classifyGensetFuel('BY LII PERTAMAX DEX UNTUK GENSET'), 'SOLAR');
  assert.equal(classifyGensetFuel('PMBLN PERTAMX GENSET MOKO'), 'PERTAMAX');
  assert.equal(classifyGensetFuel('BI PEMBELIAN BENSIN U/ GENSET'), 'PERTALITE');
  assert.equal(classifyGensetFuel('ATK - OLI SHELL TELLUS S2 MX 46'), null);
  assert.equal(classifyGensetFuel('BY CAS AKI GENSET'), null);
});

test('MM/DD dates, zero-padded accounts and control totals parse together', () => {
  const parsed = parseGensetJournalCsv(SAMPLE);
  assert.deepEqual(parsed.problems, []);
  assert.deepEqual(parsed.lines.map(l => l.accountingDate), ['2026-01-22', '2026-01-22', '2026-01-13', '2026-01-31', '2026-02-12']);
  assert.deepEqual(verifyGensetTotals(parsed), []);
});

test('activities group per KUU, month and fuel with liters from rupiah', () => {
  const { activities, skipped } = buildGensetFuelActivities(parseGensetJournalCsv(SAMPLE).lines, { sourceFile: 'f.csv' });
  assert.deepEqual(skipped, []);
  const janSolar = activities.find(a => a.yearMonth === '2026-01' && a.fuelType === 'SOLAR');
  assert.equal(janSolar.costRupiah, 750000);
  assert.equal(janSolar.liters, 750000 / GENSET_PRICE_PER_LITER.SOLAR);
  assert.equal(janSolar.facilityType, 'warehouse');
  assert.equal(activities.length, 3);
  assert.equal(activities.reduce((s, a) => s + a.costRupiah, 0), 1900000);
});
