import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { AIRPORTS } from './airports.js';
import {
  CABIN, EMISSION_STATUS, TRAVEL_ACCOUNTS, TRAVEL_CATEGORY,
  finishTravelEntry, parseCsvRows, parseLedgerAmount, parseLedgerDate, parseRouteField, parseTravelLedgerRows,
} from './travelLedger.js';

// Node's ESM interop exposes SSF only on the default export; bundlers expose it on the namespace.
const SSF = XLSX.SSF ?? XLSX.default?.SSF;

export const SOURCE_KIND = Object.freeze({ MANUAL: 'MANUAL', TEMPLATE: 'TEMPLATE' });

export const TEMPLATE_COLUMNS = Object.freeze([
  { key: 'TANGGAL', required: true, hint: 'Tanggal transaksi, format 2026-01-17 atau 17/01/2026' },
  { key: 'KUU', required: true, hint: 'Kode KUU yang menanggung biaya, misalnya Z001 atau 1AZ1' },
  { key: 'JENIS', required: true, hint: 'PESAWAT untuk tiket pesawat, LAINNYA untuk uang saku, hotel, transport lokal' },
  { key: 'RUTE', required: false, hint: 'Wajib untuk PESAWAT. Kode bandara dipisah tanda minus, misalnya CGK-DPS-CGK' },
  { key: 'KELAS', required: false, hint: 'EKONOMI (bawaan) atau BISNIS. Hanya untuk PESAWAT' },
  { key: 'NAMA_PENUMPANG', required: false, hint: 'Nama karyawan yang berangkat (opsional)' },
  { key: 'KETERANGAN', required: false, hint: 'Keperluan perjalanan (opsional)' },
  { key: 'BIAYA_RP', required: true, hint: 'Nominal rupiah tanpa titik atau koma, misalnya 2500000' },
  { key: 'AKUN', required: false, hint: '611402 atau 621402 (bawaan 611402)' },
]);

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

  const kind = String(fields.kind ?? '').trim().toUpperCase();
  const flight = kind === 'PESAWAT' || kind === TRAVEL_CATEGORY.FLIGHT;
  if (!flight && !['LAINNYA', TRAVEL_CATEGORY.OTHER].includes(kind)) errors.push('JENIS harus PESAWAT atau LAINNYA');

  let amountRupiah = 0;
  // Indonesian thousand dots ("2.500.000") are accepted alongside plain digits and the ledger's commas.
  const amountText = String(fields.amount ?? '').trim();
  const amountInput = /^\d{1,3}(\.\d{3})+$/.test(amountText) ? amountText.replace(/\./g, '') : amountText;
  try { amountRupiah = parseLedgerAmount(amountInput); } catch { errors.push('biaya bukan angka'); }
  if (!errors.includes('biaya bukan angka') && amountRupiah <= 0) errors.push('biaya harus lebih dari 0');

  const cabinText = String(fields.cabin ?? '').trim().toUpperCase();
  const cabin = ['BISNIS', 'BUSINESS'].includes(cabinText) ? CABIN.BUSINESS : CABIN.ECONOMY;
  if (cabinText && !['EKONOMI', 'ECONOMY', 'BISNIS', 'BUSINESS'].includes(cabinText)) errors.push('KELAS harus EKONOMI atau BISNIS');

  const stops = flight ? parseRouteField(fields.route) : null;
  if (flight) {
    if (stops.length < 2) errors.push('RUTE minimal dua kode bandara, misalnya CGK-DPS');
    const unknown = stops.filter(code => !AIRPORTS[code]);
    if (unknown.length) errors.push(`kode bandara belum dikenal: ${unknown.join(', ')}`);
  }

  const account = String(fields.account ?? '').trim().replace(/^0/, '') || TRAVEL_ACCOUNTS[0];
  if (!TRAVEL_ACCOUNTS.includes(account)) errors.push(`AKUN harus ${TRAVEL_ACCOUNTS.join(' atau ')}`);

  if (errors.length) return { error: errors.join('; ') };

  const passenger = String(fields.passenger ?? '').trim();
  const note = String(fields.note ?? '').trim();
  const description = [flight ? `TIKET PESAWAT ${stops.join('-')}` : 'BIAYA PERJALANAN DINAS', note, passenger && `A.N ${passenger}`]
    .filter(Boolean).join(' ').toUpperCase();

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
  }, { flight, stops, cabin });
  if (flight && entry.emissionStatus !== EMISSION_STATUS.CALCULATED) return { error: 'rute tidak bisa dihitung' };
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
    const values = TEMPLATE_COLUMNS.map(c => cell(row, c.key));
    const result = buildRowEntry({
      date: cell(row, 'TANGGAL'),
      kuu: cell(row, 'KUU'),
      kind: cell(row, 'JENIS'),
      route: cell(row, 'RUTE'),
      cabin: cell(row, 'KELAS'),
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
    ['Satu baris = satu tiket per penumpang, atau satu pengeluaran non-tiket.'],
    ['Emisi dihitung otomatis dari RUTE. Baris LAINNYA dicatat biayanya saja.'],
  ]);
  guide['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, guide, 'Petunjuk');

  const airports = XLSX.utils.aoa_to_sheet([
    ['Kode', 'Bandara', 'Negara'],
    ...Object.entries(AIRPORTS).map(([code, a]) => [code, a.name, a.country]),
  ]);
  airports['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(workbook, airports, 'Kode Bandara');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
