import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { AIRPORTS } from './airports.ts';
import {
  CABIN, EMISSION_STATUS, HOTEL_CLASS, TRAIN_CLASS, TRAVEL_ACCOUNTS, TRAVEL_CATEGORY,
  finishTravelEntry, flightFactor, hotelFactor, parseCsvRows, parseLedgerAmount, parseLedgerDate, parseRouteField, parseStationRoute,
  parseTravelLedgerRows, trainFactor,
} from './travelLedger.ts';

// Node's ESM interop exposes SSF only on the default export; bundlers expose it on the namespace and have no default.
// Reading `.default` through a plain object keeps webpack from rejecting the missing export at build time.
const xlsxModule = Object(XLSX);
const SSF = xlsxModule.SSF ?? xlsxModule.default?.SSF;

export const SOURCE_KIND = Object.freeze({ MANUAL: 'MANUAL', TEMPLATE: 'TEMPLATE' });

// Single-table layout with a JENIS column: still accepted for CSV uploads and for files made with the older template.
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

type TemplateColumn = { key: string; required: boolean; hint: string; width?: number; options?: string[]; numeric?: 'whole' | 'decimal' };

const COL: Record<string, TemplateColumn> = {
  TANGGAL: { key: 'TANGGAL', required: true, width: 13, hint: 'Tanggal transaksi, format 2026-01-17 atau 17/01/2026' },
  KUU: { key: 'KUU', required: true, width: 9, hint: 'Kode KUU yang menanggung biaya, misalnya Z001 atau 1AZ1' },
  NAMA: { key: 'NAMA_KARYAWAN', required: false, width: 24, hint: 'Nama karyawan yang berangkat (opsional)' },
  KETERANGAN: { key: 'KETERANGAN', required: false, width: 28, hint: 'Keperluan perjalanan (opsional)' },
  BIAYA: { key: 'BIAYA_RP', required: true, width: 14, numeric: 'decimal', hint: 'Nominal rupiah tanpa titik atau koma, misalnya 2500000' },
  AKUN: { key: 'AKUN', required: false, width: 9, hint: '611402 atau 621402 (kosong = 611402)' },
};

/** The downloadable template: one sheet per kind, each with only the columns that kind needs. The sheet name sets JENIS. */
export const TEMPLATE_SHEETS = Object.freeze([
  {
    name: 'Pesawat',
    category: TRAVEL_CATEGORY.FLIGHT,
    rule: 'Satu baris = satu tiket per penumpang. Emisi dihitung dari jarak antar bandara di RUTE.',
    columns: [
      COL.TANGGAL, COL.KUU,
      { key: 'RUTE', required: true, width: 18, hint: 'Kode bandara dipisah tanda minus, misalnya CGK-DPS-CGK. Kode ada di sheet Kode Bandara' },
      { key: 'KELAS', required: false, width: 12, options: ['EKONOMI', 'BISNIS'], hint: 'EKONOMI atau BISNIS (kosong = EKONOMI)' },
      COL.NAMA, COL.KETERANGAN, COL.BIAYA, COL.AKUN,
    ],
  },
  {
    name: 'Hotel',
    category: TRAVEL_CATEGORY.HOTEL,
    rule: 'Satu baris = satu pemesanan hotel. Emisi dihitung dari MALAM x KAMAR.',
    columns: [
      COL.TANGGAL, COL.KUU,
      { key: 'MALAM', required: true, width: 9, numeric: 'decimal', hint: 'Jumlah malam menginap, misalnya 3' },
      { key: 'KAMAR', required: false, width: 9, numeric: 'whole', hint: 'Jumlah kamar (kosong = 1)' },
      { key: 'KOTA', required: false, width: 16, hint: 'Kota lokasi hotel (opsional), misalnya SURABAYA' },
      { key: 'KELAS', required: false, width: 14, options: ['BINTANG_1_3', 'BINTANG_4', 'BINTANG_5'], hint: 'BINTANG_1_3, BINTANG_4, atau BINTANG_5 (kosong = rata-rata)' },
      COL.NAMA, COL.KETERANGAN, COL.BIAYA, COL.AKUN,
    ],
  },
  {
    name: 'Kereta Api',
    category: TRAVEL_CATEGORY.TRAIN,
    rule: 'Satu baris = satu tiket per penumpang. Emisi dihitung dari JARAK_KM.',
    columns: [
      COL.TANGGAL, COL.KUU,
      { key: 'RUTE', required: false, width: 26, hint: 'Nama stasiun dipisah tanda minus (opsional), misalnya GAMBIR-YOGYAKARTA-GAMBIR' },
      { key: 'JARAK_KM', required: true, width: 11, numeric: 'decimal', hint: 'Total jarak perjalanan dalam km, pulang-pergi dijumlah, misalnya 1024' },
      { key: 'KELAS', required: false, width: 12, options: ['ANTARKOTA', 'KRL', 'CEPAT'], hint: 'ANTARKOTA, KRL, atau CEPAT (kosong = ANTARKOTA)' },
      COL.NAMA, COL.KETERANGAN, COL.BIAYA, COL.AKUN,
    ],
  },
  {
    name: 'Lainnya',
    category: TRAVEL_CATEGORY.OTHER,
    rule: 'Uang saku, transport lokal, dan biaya lain. Dicatat biayanya saja, tanpa emisi.',
    columns: [COL.TANGGAL, COL.KUU, COL.NAMA, COL.KETERANGAN, COL.BIAYA, COL.AKUN],
  },
] as { name: string; category: string; rule: string; columns: TemplateColumn[] }[]);

// Reference sheets in the template (and the example rows an earlier template kept in Petunjuk) are never data.
const REFERENCE_SHEET = /^(PETUNJUK|FAKTOR|KODE_BANDARA)/;

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

function sheetRows(sheet) {
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

/** Every sheet of an Excel file in order, or the single unnamed table of a CSV. */
function sheetsFromUpload(buffer, fileName) {
  if (/\.xlsx?$/i.test(fileName)) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellNF: true });
    return workbook.SheetNames.map(name => ({ name, rows: sheetRows(workbook.Sheets[name]) }));
  }
  const text = buffer.toString('utf8');
  return [{ name: null, rows: parseCsvRows(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text) }];
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
 * Reads one table: a kind sheet (JENIS comes from the sheet name) or a single table with a JENIS column.
 * Returns null when the rows hold no data table this importer understands.
 */
function parseTable(rows, { fileName, sheetName, category }) {
  const headerIndex = rows.findIndex(r => {
    const headers = r.map(normalizeHeader);
    return headers.includes('TANGGAL') && headers.includes('BIAYA_RP');
  });
  if (headerIndex < 0) return null;
  const headers = rows[headerIndex].map(normalizeHeader);
  const singleTable = headers.includes('JENIS');
  const sheetDef = TEMPLATE_SHEETS.find(s => s.category === category);
  if (!singleTable && !sheetDef) return null;

  const required = (singleTable ? TEMPLATE_COLUMNS : sheetDef.columns).filter(c => c.required).map(c => c.key);
  const missing = required.filter(key => !headers.includes(key));
  if (missing.length) throw new Error(`${sheetName ? `Sheet ${sheetName}: k` : 'K'}olom wajib tidak ada: ${missing.join(', ')}`);
  const cell = (row, key) => (headers.includes(key) ? row[headers.indexOf(key)] ?? '' : '');

  const entries = [];
  const errors = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (row.every(c => !String(c).trim())) return;
    const rowNumber = headerIndex + offset + 2;
    let values;
    if (singleTable) {
      const extra = HASH_EXTRA_KEYS.map(key => cell(row, key));
      values = [...HASH_BASE_KEYS.map(key => cell(row, key)), ...(extra.some(v => String(v).trim()) ? extra : [])];
    } else {
      values = [sheetName, ...sheetDef.columns.map(c => cell(row, c.key))];
    }
    const result = buildRowEntry({
      date: cell(row, 'TANGGAL'),
      kuu: cell(row, 'KUU'),
      kind: singleTable ? cell(row, 'JENIS') : category,
      route: cell(row, 'RUTE'),
      cabin: cell(row, 'KELAS'),
      nights: cell(row, 'MALAM'),
      rooms: cell(row, 'KAMAR'),
      city: cell(row, 'KOTA'),
      distanceKm: cell(row, 'JARAK_KM'),
      passenger: cell(row, 'NAMA_KARYAWAN') || cell(row, 'NAMA_PENUMPANG'),
      note: cell(row, 'KETERANGAN'),
      amount: cell(row, 'BIAYA_RP'),
      account: cell(row, 'AKUN'),
    }, { journalCode: templateCode(fileName, rowNumber, values), sourceFile: fileName, journalType: SOURCE_KIND.TEMPLATE });
    if (result.error) errors.push({ sheet: sheetName, row: rowNumber, message: result.error });
    else entries.push(result.entry);
  });
  return { entries, errors };
}

/**
 * Reads an uploaded CSV/Excel file. Accepted shapes: the Scope 3 template with one sheet per kind
 * (Pesawat, Hotel, Kereta Api, Lainnya), a single table with a JENIS column (CSV or the older template),
 * or the raw BPDL journal export (header J_UU_PEMBUAT), which is checked against its account totals.
 */
export function parseTravelUpload(buffer, fileName) {
  const sheets = sheetsFromUpload(buffer, fileName);

  const journal = sheets.find(s => s.rows.some(r => normalizeHeader(r[0] ?? '') === 'J_UU_PEMBUAT'));
  if (journal) return { format: 'JOURNAL', ledger: parseTravelLedgerRows(journal.rows) };

  const entries = [];
  const errors = [];
  let tables = 0;
  for (const sheet of sheets) {
    const sheetKey = sheet.name ? normalizeHeader(sheet.name) : '';
    if (REFERENCE_SHEET.test(sheetKey)) continue;
    const result = parseTable(sheet.rows, { fileName, sheetName: sheet.name, category: KIND_ALIASES[sheetKey] ?? null });
    if (!result) continue;
    tables += 1;
    entries.push(...result.entries);
    errors.push(...result.errors);
  }
  if (!tables) {
    throw new Error('Tabel data tidak ditemukan. Pakai template Scope 3 (sheet Pesawat, Hotel, Kereta Api, Lainnya), CSV dengan kolom TANGGAL, JENIS, dan BIAYA_RP, atau ekspor jurnal BPDL (kolom J_UU_PEMBUAT).');
  }
  if (!entries.length && !errors.length) throw new Error('Template belum berisi baris data. Isi minimal satu baris di sheet Pesawat, Hotel, Kereta Api, atau Lainnya.');
  return { format: 'TEMPLATE', entries, errors };
}

const TEMPLATE_INPUT_ROWS = 500;
const HEADER_REQUIRED_FILL = 'FF1E293B';
const HEADER_OPTIONAL_FILL = 'FF64748B';

function addReferenceSheet(workbook, name, rows, widths) {
  const sheet = workbook.addWorksheet(name);
  rows.forEach(row => sheet.addRow(row));
  sheet.columns.forEach((column, i) => { column.width = widths[i] ?? 14; });
  return sheet;
}

/**
 * Builds the downloadable .xlsx template with ExcelJS (SheetJS cannot write dropdowns):
 * one input sheet per kind with header notes, KELAS dropdowns and number checks, then the reference sheets.
 */
export async function buildTravelTemplateWorkbook() {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SPARTA Gas Rumah Kaca';
  workbook.created = new Date();

  for (const def of TEMPLATE_SHEETS) {
    const sheet = workbook.addWorksheet(def.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = def.columns.map(c => ({ header: c.key, key: c.key, width: c.width ?? 14 }));
    def.columns.forEach((c, i) => {
      const header = sheet.getCell(1, i + 1);
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.required ? HEADER_REQUIRED_FILL : HEADER_OPTIONAL_FILL } };
      header.note = `${c.required ? 'Wajib' : 'Opsional'}. ${c.hint}`;
      for (let r = 2; r <= TEMPLATE_INPUT_ROWS + 1; r += 1) {
        const target = sheet.getCell(r, i + 1);
        if (c.key === 'TANGGAL') target.numFmt = 'yyyy-mm-dd';
        if (c.key === 'BIAYA_RP') target.numFmt = '#,##0';
        if (c.options) {
          target.dataValidation = {
            type: 'list', allowBlank: true, formulae: [`"${c.options.join(',')}"`],
            showErrorMessage: true, errorTitle: 'Pilihan tidak dikenal', error: `Pilih salah satu: ${c.options.join(', ')}`,
          };
        } else if (c.numeric) {
          target.dataValidation = {
            type: c.numeric, operator: 'greaterThan', allowBlank: true, formulae: [0],
            showErrorMessage: true, errorTitle: 'Angka tidak valid', error: `${c.key} harus angka lebih dari 0`,
          };
        }
      }
    });
  }

  const guide = [
    ['Template Scope 3 · Perjalanan Dinas'],
    [],
    ['Isi sheet yang dipakai saja; sheet yang dibiarkan kosong dilewati. Jenis perjalanan diambil dari nama sheet, jadi jangan ganti nama sheet.'],
    ['Header gelap wajib diisi, header abu-abu opsional. Arahkan kursor ke header untuk melihat cara mengisinya.'],
    [],
    ...TEMPLATE_SHEETS.flatMap(def => [
      [`Sheet ${def.name}`],
      [def.rule],
      ...def.columns.filter(c => ![COL.TANGGAL, COL.KUU, COL.NAMA, COL.KETERANGAN, COL.BIAYA, COL.AKUN].includes(c))
        .map(c => [`  ${c.key}${c.required ? ' (wajib)' : ''}: ${c.hint}`]),
      [],
    ]),
    ['Kolom yang sama di semua sheet'],
    ...[COL.TANGGAL, COL.KUU, COL.NAMA, COL.KETERANGAN, COL.BIAYA, COL.AKUN].map(c => [`  ${c.key}${c.required ? ' (wajib)' : ''}: ${c.hint}`]),
    [],
    ['Mengunggah ulang file yang sama tidak membuat data dobel.'],
  ];
  const guideSheet = addReferenceSheet(workbook, 'Petunjuk', guide, [120]);
  guideSheet.getCell('A1').font = { bold: true, size: 14 };
  guide.forEach((row, i) => { if (/^(Sheet |Kolom yang sama)/.test(String(row[0] ?? ''))) guideSheet.getCell(i + 1, 1).font = { bold: true }; });

  const factorRow = (kind, label, factor) => [kind, label, factor?.value ?? null, factor?.unit ?? ''];
  const factorSheet = addReferenceSheet(workbook, 'Faktor Emisi', [
    ['Sheet', 'KELAS', 'Faktor emisi', 'Satuan'],
    factorRow('Pesawat', 'EKONOMI, domestik', flightFactor(false, CABIN.ECONOMY)),
    factorRow('Pesawat', 'EKONOMI, internasional', flightFactor(true, CABIN.ECONOMY)),
    factorRow('Pesawat', 'BISNIS, domestik', flightFactor(false, CABIN.BUSINESS)),
    factorRow('Pesawat', 'BISNIS, internasional', flightFactor(true, CABIN.BUSINESS)),
    factorRow('Hotel', '(kosong) rata-rata', hotelFactor(HOTEL_CLASS.AVERAGE)),
    factorRow('Hotel', 'BINTANG_1_3', hotelFactor(HOTEL_CLASS.STAR_1_3)),
    factorRow('Hotel', 'BINTANG_4', hotelFactor(HOTEL_CLASS.STAR_4)),
    factorRow('Hotel', 'BINTANG_5', hotelFactor(HOTEL_CLASS.STAR_5)),
    factorRow('Kereta Api', 'ANTARKOTA', trainFactor(TRAIN_CLASS.INTERCITY)),
    factorRow('Kereta Api', 'KRL', trainFactor(TRAIN_CLASS.COMMUTER)),
    factorRow('Kereta Api', 'CEPAT', trainFactor(TRAIN_CLASS.HIGH_SPEED)),
  ], [12, 24, 14, 26]);
  factorSheet.getRow(1).font = { bold: true };

  const airportSheet = addReferenceSheet(workbook, 'Kode Bandara', [
    ['Kode', 'Bandara', 'Negara'],
    ...Object.entries(AIRPORTS).map(([code, a]) => [code, a.name, a.country]),
  ], [8, 30, 8]);
  airportSheet.getRow(1).font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
