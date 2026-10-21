import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTravelEntries, extractRoute, parseLedgerAmount, parseLedgerDate,
  parseTravelLedgerCsv, verifyAccountTotals, EMISSION_STATUS, TRAVEL_CATEGORY,
} from '../travelLedger.ts';
import { prepareTravelImport, TravelImportError } from '../travelImport.ts';
import { parseTravelUpload } from '../travelTemplate.ts';
import { summarizeTravelEntries } from '../travelSummary.ts';

const HEADER = 'J_UU_PEMBUAT,J_UU_CODE,J_ACCOUNTING_DATE,J_MSJC_CODE,J_MSA_AKUN,J_SUB_LEDGER1,J_MSD_CODE,J_REFER10,J_DEBIT,J_CREDIT,SALDO,J_ATTRIB1,J_ATTRIB2,J_ATTRIB3,J_TRANSAKSI,J_CODE';

const csv = (lines, totals = { '0611402': ' 3,000,000 ', '0621402': ' 700,000 ' }) => [
  ...Object.entries(totals).map(([account, amount]) => `,,,,,,,,,${account},"${amount}",0,,,,`),
  ',,,,,,,,,,,,,,,',
  HEADER,
  ...lines,
].join('\r\n');

const SAMPLE = csv([
  '1AZ1,1AZ1,17-Jan-26,MJ,611402, ,O900,(HUA-J) PBYR TIKET PESAWAT PKU - CGK - CGK - PKU 26/01/26 A.N A," 2,500,000 ", - ," 2,500,000 ",x,y,z,MANUAL,1',
  '1AZ1,1AZ1,18-Jan-26,IA,611402,1,O900,PJUM BPDL RAKORNAS A.N A," 600,000 ", - ," 600,000 ",x,y,,BMAR,2',
  'Z001,Z001,19-Jan-26,MJ,611402, ,O900,PBYR TIKET PESAWAT CGK-DAC-CGK A.N B," 1,000,000 ", - ," 1,000,000 ",x,y,z,MANUAL,3',
  'Z001,Z001,20-Jan-26,IA,611402,1,O900,KEKURANGAN UM BPDL," (1,100,000)", - ," (1,100,000)",x,y,,BMAR,4',
  'BZ01,BZ01,21-Jan-26,MJ,621402, ,H060,BI TRANSPORTASI TIKET PESAWAT A/N C," 700,000 ", - ," 700,000 ",x,y,z,MANUAL,5',
]);

test('ledger amounts handle thousand separators, parentheses and dashes', () => {
  assert.equal(parseLedgerAmount(' 4,724,600 '), 4724600);
  assert.equal(parseLedgerAmount(' (150,000)'), -150000);
  assert.equal(parseLedgerAmount(' - '), 0);
  assert.equal(parseLedgerDate('7-Jan-26'), '2026-01-07');
});

test('routes collapse repeated hinge airports and accept slashes', () => {
  assert.deepEqual(extractRoute('(HUA-J) PBYR TIKET PESAWAT PKU - BTH - BTH - SUB 26/01/26'), ['PKU', 'BTH', 'SUB']);
  assert.deepEqual(extractRoute('PBYR TIKET PESAWAT 15/12/25 PNK/YIA/YIA/PNK A.N X'), ['PNK', 'YIA', 'PNK']);
  assert.equal(extractRoute('BI TRANSPORTASI TIKET PESAWAT A/N X'), null);
});

test('parser reads control totals and journal lines that match them', () => {
  const parsed = parseTravelLedgerCsv(SAMPLE);
  assert.deepEqual(parsed.accountTotals, { 611402: 3000000, 621402: 700000 });
  assert.equal(parsed.lines.length, 5);
  assert.deepEqual(verifyAccountTotals(parsed), []);
});

test('flights get distance-based emission; allowances and routeless tickets stay cost-only', () => {
  const entries = buildTravelEntries(parseTravelLedgerCsv(SAMPLE).lines, { sourceFile: 'f.csv' });
  const [domestic, allowance, international, , routeless] = entries;

  assert.equal(domestic.category, TRAVEL_CATEGORY.FLIGHT);
  assert.equal(domestic.route, 'PKU-CGK-PKU');
  assert.equal(domestic.legCount, 2);
  assert.ok(domestic.distanceKm > 1800 && domestic.distanceKm < 2000);
  assert.ok(Math.abs(domestic.emissionKg - domestic.distanceKm * 0.15) < 0.1);

  assert.equal(international.isInternational, true);
  assert.ok(Math.abs(international.emissionKg - international.distanceKm * 0.12) < 0.1);

  assert.equal(allowance.category, TRAVEL_CATEGORY.OTHER);
  assert.equal(allowance.emissionTon, 0);
  assert.equal(routeless.emissionStatus, EMISSION_STATUS.NO_ROUTE);
});

test('import refuses a file whose lines do not add up to the account totals', () => {
  const broken = csv(SAMPLE.split('\r\n').slice(4), { '0611402': ' 9,999,999 ' });
  assert.throws(() => prepareTravelImport(broken, { sourceFile: 'f.csv' }), TravelImportError);
});

test('dates accept ledger, ISO and Indonesian formats and reject impossible days', () => {
  assert.equal(parseLedgerDate('2026-01-17'), '2026-01-17');
  assert.equal(parseLedgerDate('17/01/2026'), '2026-01-17');
  assert.throws(() => parseLedgerDate('31/02/2026'));
});

test('template rows validate per row and business class uses its own factor', () => {
  const file = Buffer.from([
    'TANGGAL,KUU,JENIS,RUTE,KELAS,NAMA_PENUMPANG,KETERANGAN,BIAYA_RP,AKUN',
    '2026-02-03,z001,PESAWAT,CGK-DPS-CGK,BISNIS,Budi,Rakor,5.000.000,',
    '2026-02-04,1AZ1,LAINNYA,,,,Hotel,750000,621402',
    '2026-02-05,1AZ1,PESAWAT,CGK-XXX,,,,1000000,',
    'bukan-tanggal,1AZ1,PESAWAT,CGK-DPS,,,,0,',
  ].join('\n'));
  const parsed = parseTravelUpload(file, 'scope3.csv');
  assert.equal(parsed.format, 'TEMPLATE');
  assert.equal(parsed.entries.length, 2);
  assert.deepEqual(parsed.errors.map(e => e.row), [4, 5]);
  assert.match(parsed.errors[0].message, /XXX/);

  const [business, hotel] = parsed.entries;
  assert.equal(business.kuu, 'Z001');
  assert.equal(business.amountRupiah, 5000000);
  assert.ok(Math.abs(business.emissionKg - business.distanceKm * 0.225) < 0.1);
  assert.equal(hotel.category, TRAVEL_CATEGORY.OTHER);
  assert.equal(hotel.account, '621402');

  const again = parseTravelUpload(file, 'scope3.csv');
  assert.equal(again.entries[0].journalCode, business.journalCode);
});

test('the raw BPDL journal is recognised by the upload reader', () => {
  const parsed = parseTravelUpload(Buffer.from(SAMPLE), 'jurnal.csv');
  assert.equal(parsed.format, 'JOURNAL');
  assert.equal(parsed.ledger.lines.length, 5);
});

test('summary groups by KUU and route and counts only positive tickets', () => {
  const entries = buildTravelEntries(parseTravelLedgerCsv(SAMPLE).lines, { sourceFile: 'f.csv' });
  const result = summarizeTravelEntries(entries, ['2026-01']);
  assert.equal(result.summary.totalRupiah, 3700000);
  assert.equal(result.summary.ticketCount, 3);
  assert.equal(result.summary.uncalculatedFlights, 1);
  assert.equal(result.byKuu.length, 3);
  const flightGroups = result.travelGroups.filter(g => g.category === TRAVEL_CATEGORY.FLIGHT);
  assert.deepEqual(flightGroups.map(g => `${g.kuu} ${g.route} ${g.band}`).sort(), ['1AZ1 PKU-CGK-PKU medium', 'Z001 CGK-DAC-CGK international']);
  assert.equal(result.monthlyTrend[0].month, 'Jan');

  const bands = Object.fromEntries(result.distanceBands.map(b => [b.id, b.ticketCount]));
  assert.deepEqual(bands, { short: 0, medium: 1, long: 0, international: 1 });
  assert.equal(result.byKuu.find(k => k.kuu === 'Z001').internationalTon, result.byKuu.find(k => k.kuu === 'Z001').emissionTon);
});

const GROUND_TEMPLATE = Buffer.from([
  'TANGGAL,KUU,JENIS,RUTE,KELAS,MALAM,KAMAR,KOTA,JARAK_KM,NAMA_PENUMPANG,KETERANGAN,BIAYA_RP,AKUN',
  '2026-03-02,Z001,HOTEL,,BINTANG_4,3,2,Surabaya,,,Rakor,2100000,',
  '2026-03-03,Z001,HOTEL,,,2,,,,,,900000,',
  '2026-03-04,1AZ1,KERETA,Gambir - Yogyakarta - Gambir,,,,,"1024",,,900000,',
  '2026-03-05,1AZ1,KERETA,,KRL,,,,40,,,20000,',
  '2026-03-06,1AZ1,HOTEL,,,,,,,,,500000,',
  '2026-03-07,1AZ1,KERETA,,ANTARKOTA,,,,,,,300000,',
  '2026-03-08,1AZ1,HOTEL,,BINTANG_9,1,,,,,,300000,',
].join('\n'));

test('hotel rows use room-nights and train rows use distance, each with its own factor', () => {
  const parsed = parseTravelUpload(GROUND_TEMPLATE, 'ground.csv');
  assert.equal(parsed.entries.length, 4);
  assert.deepEqual(parsed.errors.map(e => e.row), [6, 7, 8]);
  assert.match(parsed.errors[0].message, /MALAM/);
  assert.match(parsed.errors[1].message, /JARAK_KM/);
  assert.match(parsed.errors[2].message, /KELAS hotel/);

  const [star4, average, intercity, commuter] = parsed.entries;
  assert.equal(star4.category, TRAVEL_CATEGORY.HOTEL);
  assert.equal(star4.route, 'SURABAYA');
  assert.equal(star4.metadata.roomNights, 6);
  assert.equal(star4.emissionKg, 6 * 30);
  assert.equal(average.emissionKg, 2 * 30);
  assert.equal(average.metadata.factorId, 'HOTEL_ROOM_NIGHT');

  assert.equal(intercity.category, TRAVEL_CATEGORY.TRAIN);
  assert.equal(intercity.route, 'GAMBIR-YOGYAKARTA-GAMBIR');
  assert.equal(intercity.distanceKm, 1024);
  assert.ok(Math.abs(intercity.emissionKg - 1024 * 0.041) < 0.01);
  assert.ok(Math.abs(commuter.emissionKg - 40 * 0.035) < 0.01);
  assert.equal(commuter.route, null);
});

test('journal lines naming hotel or train are classified but keep emission empty without quantities', () => {
  const lines = parseTravelLedgerCsv(csv([
    'Z001,Z001,05-Feb-26,MJ,611402, ,O900,PBYR HOTEL SANTIKA SBY A.N B," 1,500,000 ", - ," 1,500,000 ",x,y,z,MANUAL,11',
    'Z001,Z001,06-Feb-26,MJ,611402, ,O900,PBYR TIKET KERETA KAI GMR-YK A.N B," 600,000 ", - ," 600,000 ",x,y,z,MANUAL,12',
    'Z001,Z001,07-Feb-26,IA,611402,1,O900,PJUM BPDL HOTEL DAN UANG MAKAN A.N B," 900,000 ", - ," 900,000 ",x,y,,BMAR,13',
  ], { '0611402': ' 3,000,000 ' })).lines;
  const [hotel, train, allowance] = buildTravelEntries(lines, { sourceFile: 'f.csv' });
  assert.equal(hotel.category, TRAVEL_CATEGORY.HOTEL);
  assert.equal(hotel.emissionStatus, EMISSION_STATUS.NO_QUANTITY);
  assert.equal(hotel.emissionTon, 0);
  assert.equal(train.category, TRAVEL_CATEGORY.TRAIN);
  assert.equal(train.emissionStatus, EMISSION_STATUS.NO_QUANTITY);
  assert.equal(allowance.category, TRAVEL_CATEGORY.OTHER);
});

test('summary splits emission and cost by kind and keeps distanceKm flight-only', () => {
  const flights = buildTravelEntries(parseTravelLedgerCsv(SAMPLE).lines, { sourceFile: 'f.csv' });
  const ground = parseTravelUpload(GROUND_TEMPLATE, 'ground.csv').entries;
  const result = summarizeTravelEntries([...flights, ...ground], ['2026-01', '2026-03']);
  const s = result.summary;
  const flightOnly = summarizeTravelEntries(flights, ['2026-01']).summary;

  assert.equal(s.distanceKm, flightOnly.distanceKm);
  assert.equal(s.trainKm, 1064);
  assert.equal(s.roomNights, 8);
  assert.equal(s.hotelStays, 2);
  assert.equal(s.trainTrips, 2);
  assert.equal(s.hotelRupiah, 3000000);
  assert.equal(s.trainRupiah, 920000);
  assert.ok(Math.abs(s.emissionTon - (s.flightTon + s.hotelTon + s.trainTon)) < 0.002);
  assert.equal(s.totalRupiah, flightOnly.totalRupiah + 3920000);

  const hotelGroups = result.travelGroups.filter(g => g.category === TRAVEL_CATEGORY.HOTEL);
  assert.deepEqual(hotelGroups.map(g => `${g.kuu} ${g.route} ${g.roomNights}`).sort(), ['Z001 SURABAYA 6', 'Z001 null 2']);
  assert.ok(result.travelGroups.every(g => g.category === TRAVEL_CATEGORY.FLIGHT || g.band === null));
  assert.ok(result.factors.some(f => f.id === 'HOTEL_ROOM_NIGHT') && result.factors.some(f => f.id === 'TRAIN_INTERCITY'));
});
