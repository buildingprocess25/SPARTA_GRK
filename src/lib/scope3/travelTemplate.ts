import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { AIRPORTS } from './airports.ts';
import {
  CABIN, EMISSION_STATUS, HOTEL_CLASS, TRAIN_CLASS, TRAVEL_ACCOUNTS, TRAVEL_CATEGORY,
  finishTravelEntry, hotelFactor, parseCsvRows, parseLedgerAmount, parseLedgerDate, parseRouteField, parseStationRoute,
  parseTravelLedgerRows, trainFactor,
} from './travelLedger.ts';

// Node's ESM interop exposes SSF only on the default export; bundlers expose it on the namespace and have no default.
// Reading `.default` through a plain object keeps webpack from rejecting the missing export at build time.
const xlsxModule = Object(XLSX);
const SSF = xlsxModule.SSF ?? xlsxModule.default?.SSF;

export const SOURCE_KIND = Object.freeze({ MANUAL: 'MANUAL', TEMPLATE: 'TEMPLATE' });

export const TEMPLATE_COLUMNS = Object.freeze([
  { key: 'TANGGAL', required: true, hint: 'Tanggal transaksi, format 2026-01-17 atau 17/01/2026' },
  { key: 'KUU', required: true, hint: 'Kode KUU yang menanggung biaya, misalnya Z001 atau 1AZ1' },
  { key: 'JENIS', required: true, hint: 'PESAWAT, HOTEL, KERETA, atau LAINNYA (uang saku, transport lokal)' },
  { key: 'RUTE', required: false, hint: 'PESAWAT (wajib): kode bandara, misalnya CGK-DPS-CGK. KERETA (opsional): nama stasiun, misalnya GAMBIR-YOGYAKARTA' },
  { key: 'KELAS', required: false, hint: 'PESAWAT: EKONOMI (bawaan) atau BISNIS. HOTEL: BINTANG_1_3, BINTANG_4, BINTANG_5 (kosong = rata-rata). KERETA: ANTARKOTA (bawaan), KRL, atau CEPAT' },
  { key: 'MALAM', required: false, hint: 'Wajib untuk HOTEL. Jumlah malam menginap, misalnya 3' },
  { key: 'KAMAR', required: false, hint: 'HOTEL: jumlah kamar (bawaan 1)' },
  { key: 'KOTA', required: false, hint: 'HOTEL: kota lokasi hotel (opsional), misalnya SURABAYA' },
  { key: 'JARAK_KM', required: false, hint: 'Wajib untuk KERETA. Total jarak perjalanan dalam km, misalnya 512 (pulang-pergi dijumlah)' },
  { key: 'NAMA_PENUMPANG', required: false, hint: 'Nama karyawan yang berangkat (opsional)' },
  { key: 'KETERANGAN', required: false, hint: 'Keperluan perjalanan (opsional)' },
  { key: 'BIAYA_RP', required: true, hint: 'Nominal rupiah tanpa titik atau koma, misalnya 2500000' },
  { key: 'AKUN', required: false, hint: '611402 atau 621402 (bawaan 611402)' },
]);

// Re-upload dedupe hashes these columns; hotel and train columns join the hash only when filled,
// so a file made with the older template still hashes the same as before.
const HASH_BASE_KEYS = ['TANGGAL', 'KUU', 'JENIS', 'RUTE', 'KELAS', 'NAMA_PENUMPANG', 'KETERANGAN', 'BIAYA_RP', 'AKUN'];
const HASH_EXTRA_KEYS = ['MALAM', 'KAMAR', 'KOTA', 'JARAK_KM'];

const KIND_ALIASES = Object.freeze({
  PESAWAT: TRAVEL_CATEGORY.FLIGHT,
  [TRAVEL_CATEGORY.FLIGHT]: TRAVEL_CATEGORY.FLIGHT,
  HOTEL: TRAVEL_CATEGORY.HOTEL,
  PENGINAPAN: TRAVEL_CATEGORY.HOTEL,
  KERETA: TRAVEL_CATEGORY.TRAIN,
  KERETA_API: TRAVEL_CATEGORY.TRAIN,
  KA: TRAVEL_CATEGORY.TRAIN,
  [TRAVEL_CATEGORY.TRAIN]: TRAVEL_CATEGORY.TRAIN,
  LAINNYA: TRAVEL_CATEGORY.OTHER,
  [TRAVEL_CATEGORY.OTHER]: TRAVEL_CATEGORY.OTHER,
});

const HOTEL_CLASS_ALIASES = Object.freeze({
  '': HOTEL_CLASS.AVERAGE, RATA_RATA: HOTEL_CLASS.AVERAGE, [HOTEL_CLASS.AVERAGE]: HOTEL_CLASS.AVERAGE,
  BINTANG_1_3: HOTEL_CLASS.STAR_1_3, BINTANG_1: HOTEL_CLASS.STAR_1_3, BINTANG_2: HOTEL_CLASS.STAR_1_3, BINTANG_3: HOTEL_CLASS.STAR_1_3, [HOTEL_CLASS.STAR_1_3]: HOTEL_CLASS.STAR_1_3,
  BINTANG_4: HOTEL_CLASS.STAR_4, [HOTEL_CLASS.STAR_4]: HOTEL_CLASS.STAR_4,
  BINTANG_5: HOTEL_CLASS.STAR_5, [HOTEL_CLASS.STAR_5]: HOTEL_CLASS.STAR_5,
});

const TRAIN_CLASS_ALIASES = Object.freeze({
  '': TRAIN_CLASS.INTERCITY, ANTARKOTA: TRAIN_CLASS.INTERCITY, [TRAIN_CLASS.INTERCITY]: TRAIN_CLASS.INTERCITY,
  KRL: TRAIN_CLASS.COMMUTER, [TRAIN_CLASS.COMMUTER]: TRAIN_CLASS.COMMUTER,
  CEPAT: TRAIN_CLASS.HIGH_SPEED, WHOOSH: TRAIN_CLASS.HIGH_SPEED, [TRAIN_CLASS.HIGH_SPEED]: TRAIN_CLASS.HIGH_SPEED,
});

// "2,5" and "1.234" both appear in Indonesian sheets; plain integers are the common case.
function parseQuantity(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const normalized = /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, '') : text.replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

function rowsFromUpload(buffer, fileName) {
  if (/\.xlsx?$/i.test(fileName)) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellNF: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet?.['!ref']) return [];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const rows = [];
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (!cell) row.push('');
        // Date cells are serial numbers with a date format; display text depends on the user's locale, the code does not.
        else if (cell.t === 'n' && cell.z && SSF.is_date(cell.z)) {
          const d = SSF.parse_date_code(cell.v);
          row.push(`${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`);
        } else if (cell.t === 'n') row.push(String(cell.v));
        else row.push(String(cell.w ?? cell.v ?? ''));
      }
      rows.push(row);
    }
    return rows;
  }
  const text = buffer.toString('utf8');
  return parseCsvRows(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text);
}

const normalizeHeader = cell => String(cell).trim().toUpperCase().replace(/\s+/g, '_');

function templateCode(fileName, rowNumber, values) {
  // Same file and row always hash the same, so re-uploading a template does not duplicate rows.
  return `TPL-${crypto.createHash('sha1').update([fileName, rowNumber, ...values].join('|')).digest('hex').slice(0, 20)}`;
}

/** Validates one template or manual row and returns { entry } or { error }. */
export function buildRowEntry(fields, { journalCode, sourceFile, journalType }) {
  const errors = [];
  let accountingDate;
  try { accountingDate = parseLedgerDate(fields.date); } catch { errors.push('tanggal tidak valid'); }

  const kuu = String(fields.kuu ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,6}$/.test(kuu)) errors.push('kode KUU kosong atau tidak valid');

  const category = KIND_ALIASES[String(fields.kind ?? '').trim().toUpperCase().replace(/\s+/g, '_')];
  if (!category) errors.push('JENIS harus PESAWAT, HOTEL, KERETA, atau LAINNYA');
  const flight = category === TRAVEL_CATEGORY.FLIGHT;
  const hotel = category === TRAVEL_CATEGORY.HOTEL;
  const train = category === TRAVEL_CATEGORY.TRAIN;

  let amountRupiah = 0;
  // Indonesian thousand dots ("2.500.000") are accepted alongside plain digits and the ledger's commas.
  const amountText = String(fields.amount ?? '').trim();
  const amountInput = /^\d{1,3}(\.\d{3})+$/.test(amountText) ? amountText.replace(/\./g, '') : amountText;
  try { amountRupiah = parseLedgerAmount(amountInput); } catch { errors.push('biaya bukan angka'); }
  if (!errors.includes('biaya bukan angka') && amountRupiah <= 0) errors.push('biaya harus lebih dari 0');

  // One KELAS column serves every kind; manual input may send hotelClass/trainClass directly.
  const classText = String(fields.cabin ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const cabin = ['BISNIS', 'BUSINESS'].includes(classText) ? CABIN.BUSINESS : CABIN.ECONOMY;
  if (flight && classText && !['EKONOMI', 'ECONOMY', 'BISNIS', 'BUSINESS'].includes(classText)) errors.push('KELAS pesawat harus EKONOMI atau BISNIS');
  const hotelClass = HOTEL_CLASS_ALIASES[String(fields.hotelClass ?? classText).trim().toUpperCase()];
  if (hotel && !hotelClass) errors.push('KELAS hotel harus BINTANG_1_3, BINTANG_4, BINTANG_5, atau kosong');
  const trainClass = TRAIN_CLASS_ALIASES[String(fields.trainClass ?? classText).trim().toUpperCase()];
  if (train && !trainClass) errors.push('KELAS kereta harus ANTARKOTA, KRL, atau CEPAT');

  const stops = flight ? parseRouteField(fields.route) : null;
  if (flight) {
    if (stops.length < 2) errors.push('RUTE minimal dua kode bandara, misalnya CGK-DPS');
    const unknown = stops.filter(code => !AIRPORTS[code]);
    if (unknown.length) errors.push(`kode bandara belum dikenal: ${unknown.join(', ')}`);
  }

  const nights = parseQuantity(fields.nights);
  const rooms = parseQuantity(fields.rooms);
  if (hotel) {
    if (!(nights > 0)) errors.push('MALAM wajib diisi angka lebih dari 0 untuk HOTEL');
    if (rooms !== null && !(rooms > 0 && Number.isInteger(rooms))) errors.push('KAMAR harus bilangan bulat lebih dari 0');
  }
  const distanceKm = parseQuantity(fields.distanceKm);
  const stations = train ? parseStationRoute(fields.route) : [];
  if (train && !(distanceKm > 0)) errors.push('JARAK_KM wajib diisi angka lebih dari 0 untuk KERETA');

  const account = String(fields.account ?? '').trim().replace(/^0/, '') || TRAVEL_ACCOUNTS[0];
  if (!TRAVEL_ACCOUNTS.includes(account)) errors.push(`AKUN harus ${TRAVEL_ACCOUNTS.join(' atau ')}`);

  if (errors.length) return { error: errors.join('; ') };

  const passenger = String(fields.passenger ?? '').trim();
  const note = String(fields.note ?? '').trim();
  const city = String(fields.city ?? '').trim();
  const headline = flight ? `TIKET PESAWAT ${stops.join('-')}`
    : hotel ? `HOTEL ${nights} MALAM${city ? ` ${city}` : ''}`
      : train ? `TIKET KERETA${stations.length ? ` ${stations.join('-')}` : ''}`
        : 'BIAYA PERJALANAN DINAS';
  const description = [headline, note, passenger && `A.N ${passenger}`].filter(Boolean).join(' ').toUpperCase();

  const entry = finishTravelEntry({
    journalCode,
    accountingDate,
    kuu,
    kuuSource: null,
    account,
    costCenter: null,
    journalType,
    description,
    amountRupiah,
    sourceFile,
    metadata: { passenger: passenger || null },
  }, { category, stops, cabin, nights, rooms: rooms ?? 1, hotelClass, city, distanceKm, trainClass, stations });
  if (category !== TRAVEL_CATEGORY.OTHER && entry.emissionStatus !== EMISSION_STATUS.CALCULATED) {
    return { error: flight ? 'rute tidak bisa dihitung' : 'emisi tidak bisa dihitung' };
  }
  return { entry };
}

/**
 * Reads an uploaded CSV/Excel file. Two shapes are accepted: the SPARTA Scope 3 template,
 * or the raw BPDL journal export (header J_UU_PEMBUAT), which is checked against its account totals.
 */
export function parseTravelUpload(buffer, fileName) {
  const rows = rowsFromUpload(buffer, fileName);

  if (rows.some(r => normalizeHeader(r[0] ?? '') === 'J_UU_PEMBUAT')) {
    return { format: 'JOURNAL', ledger: parseTravelLedgerRows(rows) };
  }

  const headerIndex = rows.findIndex(r => {
    const headers = r.map(normalizeHeader);
    return headers.includes('TANGGAL') && headers.includes('BIAYA_RP');
  });
  if (headerIndex < 0) {
    throw new Error('Kolom TANGGAL dan BIAYA_RP tidak ditemukan. Pakai template Scope 3 atau ekspor jurnal BPDL (kolom J_UU_PEMBUAT).');
  }
  const headers = rows[headerIndex].map(normalizeHeader);
  const missing = TEMPLATE_COLUMNS.filter(c => c.required && !headers.includes(c.key)).map(c => c.key);
  if (missing.length) throw new Error(`Kolom wajib tidak ada: ${missing.join(', ')}`);
  const cell = (row, key) => (headers.includes(key) ? row[headers.indexOf(key)] ?? '' : '');

  const entries = [];
  const errors = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (row.every(c => !String(c).trim())) return;
    const rowNumber = headerIndex + offset + 2;
    const extra = HASH_EXTRA_KEYS.map(key => cell(row, key));
    const values = [...HASH_BASE_KEYS.map(key => cell(row, key)), ...(extra.some(v => String(v).trim()) ? extra : [])];
    const result = buildRowEntry({
      date: cell(row, 'TANGGAL'),
      kuu: cell(row, 'KUU'),
      kind: cell(row, 'JENIS'),
      route: cell(row, 'RUTE'),
      cabin: cell(row, 'KELAS'),
      nights: cell(row, 'MALAM'),
      rooms: cell(row, 'KAMAR'),
      city: cell(row, 'KOTA'),
      distanceKm: cell(row, 'JARAK_KM'),
      passenger: cell(row, 'NAMA_PENUMPANG'),
      note: cell(row, 'KETERANGAN'),
      amount: cell(row, 'BIAYA_RP'),
      account: cell(row, 'AKUN'),
    }, { journalCode: templateCode(fileName, rowNumber, values), sourceFile: fileName, journalType: SOURCE_KIND.TEMPLATE });
    if (result.error) errors.push({ row: rowNumber, message: result.error });
    else entries.push(result.entry);
  });
  if (!entries.length && !errors.length) throw new Error('Template tidak berisi baris data di bawah header.');
  return { format: 'TEMPLATE', entries, errors };
}

/** Builds the downloadable .xlsx template: an empty data sheet, column guide, and airport codes. */
export function buildTravelTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();
  const data = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS.map(c => c.key)]);
  data['!cols'] = TEMPLATE_COLUMNS.map(c => ({ wch: Math.max(14, c.key.length + 4) }));
  XLSX.utils.book_append_sheet(workbook, data, 'Perjalanan Dinas');

  const guide = XLSX.utils.aoa_to_sheet([
    ['Kolom', 'Wajib', 'Cara mengisi'],
    ...TEMPLATE_COLUMNS.map(c => [c.key, c.required ? 'Ya' : 'Tidak', c.hint]),
    [],
    ['Satu baris = satu tiket pesawat atau kereta per penumpang, satu pemesanan hotel, atau satu pengeluaran lain.'],
    ['PESAWAT dihitung dari RUTE, HOTEL dari MALAM x KAMAR, KERETA dari JARAK_KM. Baris LAINNYA dicatat biayanya saja.'],
    [],
    ['Contoh pengisian'],
    ['TANGGAL', 'KUU', 'JENIS', 'RUTE', 'KELAS', 'MALAM', 'KAMAR', 'KOTA', 'JARAK_KM', 'BIAYA_RP'],
    ['2026-02-03', 'Z001', 'PESAWAT', 'CGK-DPS-CGK', 'EKONOMI', '', '', '', '', '2500000'],
    ['2026-02-03', 'Z001', 'HOTEL', '', 'BINTANG_4', '3', '1', 'DENPASAR', '', '2100000'],
    ['2026-02-10', '1AZ1', 'KERETA', 'GAMBIR-YOGYAKARTA-GAMBIR', 'ANTARKOTA', '', '', '', '1024', '900000'],
  ]);
  guide['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, guide, 'Petunjuk');

  const factors = XLSX.utils.aoa_to_sheet([
    ['JENIS', 'KELAS', 'Faktor emisi', 'Satuan'],
    ['HOTEL', '(kosong)', hotelFactor(HOTEL_CLASS.AVERAGE)?.value, hotelFactor(HOTEL_CLASS.AVERAGE)?.unit],
    ['HOTEL', 'BINTANG_1_3', hotelFactor(HOTEL_CLASS.STAR_1_3)?.value, hotelFactor(HOTEL_CLASS.STAR_1_3)?.unit],
    ['HOTEL', 'BINTANG_4', hotelFactor(HOTEL_CLASS.STAR_4)?.value, hotelFactor(HOTEL_CLASS.STAR_4)?.unit],
    ['HOTEL', 'BINTANG_5', hotelFactor(HOTEL_CLASS.STAR_5)?.value, hotelFactor(HOTEL_CLASS.STAR_5)?.unit],
    ['KERETA', 'ANTARKOTA', trainFactor(TRAIN_CLASS.INTERCITY)?.value, trainFactor(TRAIN_CLASS.INTERCITY)?.unit],
    ['KERETA', 'KRL', trainFactor(TRAIN_CLASS.COMMUTER)?.value, trainFactor(TRAIN_CLASS.COMMUTER)?.unit],
    ['KERETA', 'CEPAT', trainFactor(TRAIN_CLASS.HIGH_SPEED)?.value, trainFactor(TRAIN_CLASS.HIGH_SPEED)?.unit],
  ]);
  factors['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, factors, 'Faktor Hotel & Kereta');

  const airports = XLSX.utils.aoa_to_sheet([
    ['Kode', 'Bandara', 'Negara'],
    ...Object.entries(AIRPORTS).map(([code, a]) => [code, a.name, a.country]),
  ]);
  airports['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(workbook, airports, 'Kode Bandara');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
