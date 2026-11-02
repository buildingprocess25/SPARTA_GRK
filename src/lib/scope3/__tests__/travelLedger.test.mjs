import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTravelEntries, extractRoute, otherTravelKind, parseLedgerAmount, parseLedgerDate,
  parseTravelLedgerCsv, verifyAccountTotals, CABIN, EMISSION_STATUS, TRAIN_CLASS, TRAVEL_CATEGORY,
  flightEmission, flightFactor, hotelEmission, hotelStayFromDescription, trainEmission,
} from '../travelLedger.ts';
import { prepareTravelImport, TravelImportError } from '../travelImport.ts';
import * as XLSX from 'xlsx';
import { buildTravelTemplateWorkbook, parseTravelUpload, TEMPLATE_SHEETS } from '../travelTemplate.ts';
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
  // PKU-CGK is about 950 km per segment, so each segment takes the BI medium-haul factor.
  assert.deepEqual(domestic.metadata.legs.map(l => l.factorId), ['FLIGHT_DOMESTIC_ECONOMY_MEDIUM', 'FLIGHT_DOMESTIC_ECONOMY_MEDIUM']);
  assert.ok(Math.abs(domestic.emissionKg - domestic.distanceKm * 0.089) < 0.1);

  assert.equal(international.isInternational, true);
  assert.ok(Math.abs(international.emissionKg - international.distanceKm * 0.06449) < 0.1);

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

test('journal exports with MM/DD/YYYY dates are detected per file', () => {
  const mdy = csv([
    '1AZ1,1AZ1,01/17/2026,MJ,611402, ,O900,PBYR TIKET PESAWAT PKU - CGK A.N A,3000000,0,3000000,x,y,z,MANUAL,1',
    'BZ01,BZ01,02/03/2026,MJ,621402, ,H060,BI TRANSPORTASI A/N C,700000,0,700000,x,y,z,MANUAL,2',
  ]);
  assert.deepEqual(parseTravelLedgerCsv(mdy).lines.map(l => l.accountingDate), ['2026-01-17', '2026-02-03']);
  const zeroPadded = csv(['1AZ1,1AZ1,01/17/2026,MJ,0611402, ,O900,X,3000000,0,3000000,x,y,z,MANUAL,1'], { '0611402': '3000000' });
  const parsed = parseTravelLedgerCsv(zeroPadded);
  assert.equal(parsed.lines[0].account, '611402');
  assert.deepEqual(verifyAccountTotals(parsed), []);
  const dmy = csv([
    '1AZ1,1AZ1,17/01/2026,MJ,611402, ,O900,PBYR TIKET PESAWAT PKU - CGK A.N A,3000000,0,3000000,x,y,z,MANUAL,1',
    'BZ01,BZ01,02/03/2026,MJ,621402, ,H060,BI TRANSPORTASI A/N C,700000,0,700000,x,y,z,MANUAL,2',
  ]);
  assert.deepEqual(parseTravelLedgerCsv(dmy).lines.map(l => l.accountingDate), ['2026-01-17', '2026-03-02']);
  const mixed = csv([
    '1AZ1,1AZ1,17/01/2026,MJ,611402, ,O900,X,3000000,0,3000000,x,y,z,MANUAL,1',
    'BZ01,BZ01,01/17/2026,MJ,621402, ,H060,Y,700000,0,700000,x,y,z,MANUAL,2',
  ]);
  assert.throws(() => parseTravelLedgerCsv(mixed), /campur/);
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
  assert.deepEqual(business.metadata.legs.map(l => l.factorId), ['FLIGHT_DOMESTIC_BUSINESS_MEDIUM', 'FLIGHT_DOMESTIC_BUSINESS_MEDIUM']);
  assert.ok(Math.abs(business.emissionKg - business.distanceKm * 0.160) < 0.1);
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
  const routedFlights = result.travelGroups.filter(g => g.category === TRAVEL_CATEGORY.FLIGHT && g.band);
  assert.deepEqual(routedFlights.map(g => `${g.kuu} ${g.route} ${g.band}`).sort(), ['1AZ1 PKU-CGK-PKU medium', 'Z001 CGK-DAC-CGK international']);
  // Refunds and routeless tickets stay in the groups, so the table adds up to the summary total.
  assert.equal(result.travelGroups.reduce((s, g) => s + g.rupiah, 0), result.summary.totalRupiah);
  assert.equal(result.monthlyTrend[0].month, 'Jan');

  const bands = Object.fromEntries(result.distanceBands.map(b => [b.id, b.segmentCount]));
  assert.deepEqual(bands, { short: 0, medium: 2, long: 0, international: 2 });
  assert.ok(Math.abs(result.distanceBands.reduce((s, b) => s + b.emissionTon, 0) - result.summary.flightTon) < 0.01);
  assert.equal(result.otherByKind.find(k => k.id === 'ALLOWANCE').count, 1);
  assert.equal(result.byKuu.find(k => k.kuu === 'Z001').internationalTon, result.byKuu.find(k => k.kuu === 'Z001').emissionTon);
});

const GROUND_TEMPLATE = Buffer.from([
  'TANGGAL,KUU,JENIS,RUTE,KELAS,MALAM,KAMAR,KOTA,NEGARA,JARAK_KM,NAMA_PENUMPANG,KETERANGAN,BIAYA_RP,AKUN',
  '2026-03-02,Z001,HOTEL,,BINTANG_4,3,2,Surabaya,,,,Rakor,2100000,',
  '2026-03-03,Z001,HOTEL,,,2,,,Vietnam,,,,900000,',
  '2026-03-04,1AZ1,KERETA,Gambir - Yogyakarta - Gambir,,,,,,"1024",,,900000,',
  '2026-03-05,1AZ1,KERETA,,EKSEKUTIF,,,,,40,,,20000,',
  '2026-03-06,1AZ1,HOTEL,,,,,,,,,,500000,',
  '2026-03-07,1AZ1,KERETA,,EKONOMI,,,,,,,,300000,',
  '2026-03-08,1AZ1,HOTEL,,,1,,,Atlantis,,,,300000,',
  '2026-03-09,1AZ1,KERETA,,KRL,,,,,40,,,20000,',
].join('\n'));

test('hotel rows use the country factor and train rows the KAI class factor', () => {
  const parsed = parseTravelUpload(GROUND_TEMPLATE, 'ground.csv');
  assert.equal(parsed.entries.length, 4);
  assert.deepEqual(parsed.errors.map(e => e.row), [6, 7, 8, 9]);
  assert.match(parsed.errors[0].message, /MALAM/);
  assert.match(parsed.errors[1].message, /JARAK_KM/);
  assert.match(parsed.errors[2].message, /NEGARA hotel belum ada di tabel faktor BI: Atlantis/);
  assert.match(parsed.errors[3].message, /KELAS kereta harus EKONOMI/);

  const [indonesia, vietnam, economy, executive] = parsed.entries;
  // A star class from the older template is ignored; the hotel defaults to Indonesia.
  assert.equal(indonesia.category, TRAVEL_CATEGORY.HOTEL);
  assert.equal(indonesia.route, 'SURABAYA');
  assert.equal(indonesia.metadata.roomNights, 6);
  assert.equal(indonesia.metadata.factorId, 'HOTEL_ID');
  assert.ok(Math.abs(indonesia.emissionKg - 6 * 49.37) < 0.01);
  assert.equal(vietnam.metadata.factorId, 'HOTEL_VN');
  assert.ok(Math.abs(vietnam.emissionKg - 2 * 38.5) < 0.01);

  assert.equal(economy.category, TRAVEL_CATEGORY.TRAIN);
  assert.equal(economy.route, 'GAMBIR-YOGYAKARTA-GAMBIR');
  assert.equal(economy.distanceKm, 1024);
  assert.ok(Math.abs(economy.emissionKg - 1024 * 0.01219) < 0.01);
  assert.ok(Math.abs(executive.emissionKg - 40 * 0.0175) < 0.01);
  assert.equal(executive.route, null);
});

test('BI 2026 guide case studies reproduce with the BI factors', () => {
  // Kasus 1 (hal. 45): CGK-SUB 691,21 km x 0,120 = 82,9 kg.
  const cgkSub = flightEmission(['CGK', 'SUB']);
  assert.ok(Math.abs(cgkSub.distanceKm - 691.21) < 1);
  assert.equal(cgkSub.legs[0].factorValue, 0.120);
  assert.ok(Math.abs(cgkSub.emissionKg - 82.9) < 0.2);
  assert.equal(flightFactor(true, CABIN.ECONOMY).value, 0.06449);
  assert.equal(flightFactor(false, CABIN.ECONOMY, 926).value, 0.089);
  assert.equal(flightFactor(false, CABIN.ECONOMY, 1853).value, 0.078);
  assert.equal(flightFactor(false, CABIN.FIRST, 500).value, 0.216);
  // Kereta (hal. 47): 150 km eksekutif = 2,625 kg per orang.
  assert.ok(Math.abs(trainEmission({ distanceKm: 150, trainClass: TRAIN_CLASS.EXECUTIVE }).emissionKg - 2.625) < 1e-9);
  // Hotel di Indonesia 15 malam = 740,55 kg (contoh Kalkulator Hijau).
  assert.ok(Math.abs(hotelEmission({ nights: 15 }).emissionKg - 740.55) < 1e-9);
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

const xlsxModule = XLSX.default ?? XLSX;
function workbookBuffer(sheets) {
  const wb = xlsxModule.utils.book_new();
  for (const [name, rows] of sheets) xlsxModule.utils.book_append_sheet(wb, xlsxModule.utils.aoa_to_sheet(rows), name);
  return xlsxModule.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('the downloaded template has one input sheet per kind and no data yet', async () => {
  const buffer = await buildTravelTemplateWorkbook();
  const wb = xlsxModule.read(buffer, { type: 'buffer' });
  assert.deepEqual(wb.SheetNames, ['Pesawat', 'Hotel', 'Kereta Api', 'Lainnya', 'Petunjuk', 'Faktor Emisi', 'Negara Hotel', 'Kode Bandara']);
  for (const def of TEMPLATE_SHEETS) {
    const header = xlsxModule.utils.sheet_to_json(wb.Sheets[def.name], { header: 1 })[0];
    assert.deepEqual(header, def.columns.map(c => c.key));
    assert.ok(!header.includes('JENIS'));
  }
  assert.throws(() => parseTravelUpload(buffer, 'kosong.xlsx'), /belum berisi baris data/);
});

test('each kind sheet sets JENIS; reference sheets and their example rows are skipped', () => {
  const buffer = workbookBuffer([
    // A guide placed first, holding a header-like example row, must not be imported.
    ['Petunjuk', [['Contoh'], ['TANGGAL', 'KUU', 'JENIS', 'BIAYA_RP'], ['2026-01-01', 'Z001', 'PESAWAT', '1']]],
    ['Pesawat', [['TANGGAL', 'KUU', 'RUTE', 'KELAS', 'NAMA_KARYAWAN', 'KETERANGAN', 'BIAYA_RP', 'AKUN'], ['2026-04-01', 'Z001', 'CGK-DPS-CGK', 'BISNIS', 'Budi', '', '2500000', '']]],
    ['Hotel', [['TANGGAL', 'KUU', 'MALAM', 'KAMAR', 'KOTA', 'NEGARA', 'NAMA_KARYAWAN', 'KETERANGAN', 'BIAYA_RP', 'AKUN'],
      ['2026-04-01', 'Z001', '2', '', 'Denpasar', 'Indonesia', 'Budi', '', '1400000', ''],
      ['2026-04-02', 'Z001', '', '', '', '', '', '', '700000', '']]],
    ['Kereta Api', [['TANGGAL', 'KUU', 'RUTE', 'JARAK_KM', 'KELAS', 'NAMA_KARYAWAN', 'KETERANGAN', 'BIAYA_RP', 'AKUN'], ['2026-04-03', '1AZ1', 'Gambir-Bandung', '150', 'EKSEKUTIF', '', '', '300000', '']]],
    ['Lainnya', [['TANGGAL', 'KUU', 'NAMA_KARYAWAN', 'KETERANGAN', 'BIAYA_RP', 'AKUN']]],
  ]);
  const parsed = parseTravelUpload(buffer, 'scope3.xlsx');
  assert.equal(parsed.format, 'TEMPLATE');
  assert.deepEqual(parsed.entries.map(e => e.category), [TRAVEL_CATEGORY.FLIGHT, TRAVEL_CATEGORY.HOTEL, TRAVEL_CATEGORY.TRAIN]);
  assert.deepEqual(parsed.errors.map(e => `${e.sheet} ${e.row}`), ['Hotel 3']);
  assert.match(parsed.errors[0].message, /MALAM/);
  const [flight, hotel, train] = parsed.entries;
  assert.equal(flight.metadata.cabin, 'BUSINESS');
  assert.equal(flight.metadata.passenger, 'Budi');
  assert.equal(hotel.route, 'DENPASAR');
  assert.equal(hotel.metadata.factorId, 'HOTEL_ID');
  assert.equal(train.metadata.factorId, 'TRAIN_EXECUTIVE');

  // Same row text in two kind sheets must not collide in the re-upload dedupe code.
  assert.equal(new Set(parsed.entries.map(e => e.journalCode)).size, parsed.entries.length);
  assert.deepEqual(parseTravelUpload(buffer, 'scope3.xlsx').entries.map(e => e.journalCode), parsed.entries.map(e => e.journalCode));
});

test('a kind sheet missing its required column names the sheet', () => {
  const buffer = workbookBuffer([['Hotel', [['TANGGAL', 'KUU', 'BIAYA_RP'], ['2026-04-01', 'Z001', '1000']]]]);
  assert.throws(() => parseTravelUpload(buffer, 'x.xlsx'), /Sheet Hotel: kolom wajib tidak ada: MALAM/);
});

test('the older single-sheet template with a JENIS column still imports', () => {
  const buffer = workbookBuffer([['Perjalanan Dinas', [
    ['TANGGAL', 'KUU', 'JENIS', 'RUTE', 'KELAS', 'NAMA_PENUMPANG', 'KETERANGAN', 'BIAYA_RP', 'AKUN'],
    ['2026-02-03', 'Z001', 'PESAWAT', 'CGK-DPS', '', 'Ani', '', '1000000', ''],
  ]]]);
  const parsed = parseTravelUpload(buffer, 'lama.xlsx');
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].metadata.passenger, 'Ani');
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
  assert.ok(result.factors.some(f => f.id === 'HOTEL_ID') && result.factors.some(f => f.id === 'TRAIN_ECONOMY'));
  assert.ok(!result.factors.some(f => f.id === 'HOTEL_VN'));
});

test('Lainnya splits into kinds read from the description and counts its transactions', () => {
  assert.equal(otherTravelKind({ description: 'BPDL', journalType: 'PL' }), 'PAYROLL');
  assert.equal(otherTravelKind({ description: 'PJUM BPDL BANGLADESH DHAKA TGL 27/08-26/09/2025', journalType: 'IA' }), 'INTERNATIONAL');
  assert.equal(otherTravelKind({ description: '(HUA-J) BY KLAIM KEKURANGAN BPDL LUWU-PINRANG', journalType: 'PA' }), 'CLAIM');
  assert.equal(otherTravelKind({ description: '(HUA-J) BY TIKET PENYEBRANGAN SUMBAWA - LOMBOK', journalType: 'PA' }), 'TRANSPORT');
  assert.equal(otherTravelKind({ description: 'PJUM BPDL A/N HADRI TGL 26-27 DEC 25 KUNJUNGAN TOKO', journalType: 'IA' }), 'ALLOWANCE');
  assert.equal(otherTravelKind({ description: 'BY PEMBUATAN PARSPOR', journalType: 'MJ' }), 'MISC');

  const other = (description, journalType, amountRupiah) => ({
    kuu: 'Z001', yearMonth: '2026-01', category: TRAVEL_CATEGORY.OTHER, route: null, description, journalType, amountRupiah,
    distanceKm: 0, legCount: 0, emissionTon: 0, emissionStatus: EMISSION_STATUS.NO_FACTOR, isInternational: false, metadata: {},
  });
  const result = summarizeTravelEntries([
    other('PJUM BPDL A/N A KUNJUNGAN TOKO', 'IA', 500000),
    other('PJUM BPDL A/N B KUNJUNGAN TOKO', 'IA', 300000),
    other('KEKURANGAN UM BPDL', 'BMAR', -100000),
    other('BPDL', 'PL', 0),
  ], ['2026-01']);
  const byKind = Object.fromEntries(result.travelGroups.map(g => [g.otherKind, g]));
  assert.equal(byKind.ALLOWANCE.count, 2);
  assert.equal(byKind.ALLOWANCE.rupiah, 800000);
  assert.equal(byKind.CLAIM.count, 0);
  assert.equal(byKind.PAYROLL.rupiah, 0);
  assert.equal(result.summary.otherCount, 2);
  assert.ok(result.otherKinds.some(k => k.id === 'PAYROLL' && k.label));
});

test('journal hotel lines read nights and country from the stay dates in the description', () => {
  assert.deepEqual(hotelStayFromDescription('(HUA-J) BI HOTEL LUXTO BANDUNG TGL 07/07/26 - 09/07/26 AN PETER'), { nights: 2, country: 'ID' });
  assert.deepEqual(hotelStayFromDescription('BI HOTEL SOUTH PALMS RESORT AND SPA PANGLAO TGL 31/07/26-02/08/26 A/N X'), { nights: 2, country: 'PH' });
  assert.deepEqual(hotelStayFromDescription('(HUA-J) BIAYA HOTEL DI JEPANG TGL 07-10/10/26 A/N HHC'), { nights: 3, country: 'JP' });
  assert.deepEqual(hotelStayFromDescription('PMBL TIKET KAPAL DAN HOTEL U/ KUNJUNGAN TK KORINDO 12-13 MEI 26 A/N TEDY'), { nights: 1, country: 'ID' });
  assert.deepEqual(hotelStayFromDescription("HOTEL KNJNGN TK KORINDO AN TEDY & HERIYANA 22-23 JUN'26"), { nights: 1, country: 'ID' });
  assert.deepEqual(hotelStayFromDescription('BI HOTEL THE ROYAL MANDAYATGL 08/09/26 - 11/09/26 AN B'), { nights: 3, country: 'ID' });
  assert.equal(hotelStayFromDescription('KLAIM PENGINAPAN KEP MONITORING TK GO W929').nights, null);

  const [hotel] = buildTravelEntries(parseTravelLedgerCsv(csv([
    'Z001,Z001,10-Jul-26,MJ,611402, ,O900,(HUA-J) BI HOTEL LUXTO BANDUNG TGL 07/07/26 - 09/07/26 AN P," 1,860,000 ", - ," 1,860,000 ",x,y,z,MANUAL,21',
  ], { '0611402': ' 1,860,000 ' })).lines, { sourceFile: 'f.csv' });
  assert.equal(hotel.emissionStatus, EMISSION_STATUS.CALCULATED);
  assert.ok(Math.abs(hotel.emissionKg - 2 * 49.37) < 0.01);
});
