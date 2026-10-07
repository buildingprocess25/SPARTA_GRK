import * as XLSX from 'xlsx';
import zlib from 'zlib';
import prismaClient from '../prisma.js';
import { getInverterTemperaturePerformance } from './inverterTemperatureService.js';
import { getActiveInverterTempMethodVersion } from './inverterTemperatureConfig.js';

/**
 * CRC32 computation for ZIP archive creation
 */
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Formula injection sanitizer (protects against CSV/Spreadsheet injection)
 * Any string starting with =, +, -, @ will be prefixed with single quote '
 */
export function sanitizeCellForFormulaInjection(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Format CSV line adhering to RFC 4180, UTF-8, and formula injection guard
 */
export function formatCsvRow(values) {
  return values
    .map(v => {
      const sanitized = sanitizeCellForFormulaInjection(v);
      if (typeof v === 'number' && Number.isFinite(v)) {
        return String(v);
      }
      if (sanitized.includes('"') || sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('\r')) {
        return `"${sanitized.replaceAll('"', '""')}"`;
      }
      return `"${sanitized}"`;
    })
    .join(',');
}

/**
 * Create pure standard ZIP buffer containing files [{ filename, content (string|Buffer) }]
 */
export function createZipBuffer(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const filenameBuf = Buffer.from(file.filename, 'utf-8');
    const contentBuf = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content, 'utf-8');

    const uncompressedSize = contentBuf.length;
    const fileCrc = crc32(contentBuf);

    // Deflate compression
    const compressedData = zlib.deflateRawSync(contentBuf);
    const compressedSize = compressedData.length;
    const useCompression = compressedSize < uncompressedSize;

    const dataToStore = useCompression ? compressedData : contentBuf;
    const compressionMethod = useCompression ? 8 : 0; // 8 = Deflate, 0 = Store
    const finalCompressedSize = useCompression ? compressedSize : uncompressedSize;

    // Date & Time (MS-DOS format)
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (Math.floor(now.getSeconds() / 2));
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    // Local Header (30 bytes + filename length)
    const localHeader = Buffer.alloc(30 + filenameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4);        // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);    // General purpose bit flag (UTF-8)
    localHeader.writeUInt16LE(compressionMethod, 8); // Compression method
    localHeader.writeUInt16LE(dosTime, 10);  // Last mod file time
    localHeader.writeUInt16LE(dosDate, 12);  // Last mod file date
    localHeader.writeUInt32LE(fileCrc, 14);  // CRC-32
    localHeader.writeUInt32LE(finalCompressedSize, 18); // Compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22);   // Uncompressed size
    localHeader.writeUInt16LE(filenameBuf.length, 26); // Filename length
    localHeader.writeUInt16LE(0, 28);                  // Extra field length
    filenameBuf.copy(localHeader, 30);

    // Central Directory Header (46 bytes + filename length)
    const centralHeader = Buffer.alloc(46 + filenameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central file header signature
    centralHeader.writeUInt16LE(20, 4);         // Version made by
    centralHeader.writeUInt16LE(20, 6);         // Version needed
    centralHeader.writeUInt16LE(0x0800, 8);     // Bit flag (UTF-8)
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(fileCrc, 16);
    centralHeader.writeUInt32LE(finalCompressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(filenameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // Extra field length
    centralHeader.writeUInt16LE(0, 32);         // File comment length
    centralHeader.writeUInt16LE(0, 34);         // Disk number start
    centralHeader.writeUInt16LE(0, 36);         // Internal file attributes
    centralHeader.writeUInt32LE(0, 38);         // External file attributes
    centralHeader.writeUInt32LE(offset, 42);    // Relative offset of local header
    filenameBuf.copy(centralHeader, 46);

    localHeaders.push(Buffer.concat([localHeader, dataToStore]));
    centralHeaders.push(centralHeader);

    offset += localHeader.length + dataToStore.length;
  }

  const centralDirOffset = offset;
  const centralDirBuf = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuf.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // EOCD signature
  eocd.writeUInt16LE(0, 4);                // Number of this disk
  eocd.writeUInt16LE(0, 6);                // Disk where central directory starts
  eocd.writeUInt16LE(files.length, 8);     // Number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10);    // Total number of central directory records
  eocd.writeUInt32LE(centralDirSize, 12);  // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16);// Offset of start of central directory
  eocd.writeUInt16LE(0, 20);               // Comment length

  return Buffer.concat([...localHeaders, centralDirBuf, eocd]);
}

/**
 * Fetch raw daily inverter temp records for detailed export
 */
async function fetchDailyInverterTempDetails({ year, db }) {
  try {
    const dailies = await db.inverterTempDaily.findMany({
      where: {
        dateWib: { startsWith: `${year}-` },
      },
      orderBy: [{ dateWib: 'asc' }, { inverterSn: 'asc' }],
    });
    return dailies;
  } catch {
    return [];
  }
}

/**
 * Build XLSX workbook (3 sheets)
 */
export async function buildInverterTempXlsx({
  scope = 'national',
  targetId = 'ALL',
  year = 2026,
  methodVersion = null,
  db = prismaClient,
} = {}) {
  const performanceData = await getInverterTemperaturePerformance({
    scope,
    targetId,
    year,
    methodVersion,
    db,
  });

  const dailyRecords = await fetchDailyInverterTempDetails({ year, db });

  // 1. Sheet 1: Ringkasan Bulanan
  const sheet1Data = [
    [
      'Bulan (YYYY-MM)',
      'Nama Bulan',
      'PR Terbobot (%)',
      'Suhu Inverter (°C)',
      'Suhu Udara Open-Meteo (°C)',
      'Iradiasi GHI (kWh/m²)',
      'Cakupan Suhu Inverter (%)',
      'Status Kelayakan Data',
      'Parsial',
    ],
    ...performanceData.series.map(s => [
      s.monthKey,
      s.monthLabel,
      s.prWeightedPct !== null ? s.prWeightedPct : '',
      s.inverterTempC !== null ? s.inverterTempC : '',
      s.ambientTempC !== null ? s.ambientTempC : '',
      s.ghiKwhM2 !== null ? s.ghiKwhM2 : '',
      s.inverterCoveragePct,
      s.qualityStatus,
      s.isPartial ? 'YA' : 'TIDAK',
    ]),
  ];

  // 2. Sheet 2: Rincian Harian
  const sheet2Data = [
    [
      'Tanggal (WIB)',
      'Inverter SN',
      'Nama Plant / DC',
      'Versi Metodologi',
      'Slot Terjadwal',
      'Slot Sukses',
      'Slot Valid',
      'Suhu Rata-rata (°C)',
      'Suhu Minimum (°C)',
      'Suhu Maksimum (°C)',
      'Spread Suhu (°C)',
      'Rasio Stale (%)',
      'Status Kualitas',
      'Alasan Kualitas',
    ],
    ...(dailyRecords.length > 0
      ? dailyRecords.map(d => [
          d.dateWib,
          d.inverterSn,
          d.dcId || d.plantName || '',
          d.methodVersion,
          d.scheduledSlots,
          d.successSlots,
          d.validSlots,
          d.avgTempC !== null ? d.avgTempC : '',
          d.minTempC !== null ? d.minTempC : '',
          d.maxTempC !== null ? d.maxTempC : '',
          d.spreadTempC !== null ? d.spreadTempC : '',
          d.staleRatioPct !== null ? d.staleRatioPct : '',
          d.qualityStatus,
          d.qualityReasons ? d.qualityReasons.join('; ') : '',
        ])
      : [['Belum ada data rekaman harian inverter temperature', '', '', '', '', '', '', '', '', '', '', '', '', '']]),
  ];

  // 3. Sheet 3: Metadata & Kualitas
  const meta = performanceData.metadata;
  const sheet3Data = [
    ['Parameter Metadata', 'Nilai / Keterangan'],
    ['Scope Analisis', sanitizeCellForFormulaInjection(meta.scope)],
    ['Target ID', sanitizeCellForFormulaInjection(meta.targetId)],
    ['Tahun', meta.year],
    ['Versi Metodologi Aktif', sanitizeCellForFormulaInjection(meta.activeMethodVersion)],
    ['Versi Metodologi Data', sanitizeCellForFormulaInjection(meta.methodVersion)],
    ['Kapasitas Terpasang Total (kWp)', meta.totalInstalledKwp],
    ['Jumlah Plant Dihitung', meta.plantCount],
    ['Jumlah DC Dihitung', meta.dcCount],
    ['Jumlah Inverter Terpantau', meta.inverterCount],
    ['Jumlah Inverter Tanpa Rating', meta.unratedInverterCount],
    ['Eksekusi Sukses Terakhir', meta.lastSuccessfulRun || 'Belum pernah sukses'],
    ['Status Stale (>30m)', meta.isStale ? 'PERINGATAN_STALE' : 'OK'],
    ['Peringatan Cakupan Rendah (<80%)', meta.hasCoverageWarning ? 'YA' : 'TIDAK'],
    ['', ''],
    ['DEFINISI CAKUPAN (COVERAGE)', ''],
    ['1. Sampling Coverage', meta.coverageDefinitions.samplingCoverage],
    ['2. Production Coverage', meta.coverageDefinitions.productionCoverage],
    ['3. Monthly Coverage', meta.coverageDefinitions.monthlyCoverage],
    ['', ''],
    ['KETERBATASAN FISIK SUHU INVERTER', meta.temperatureLimitations],
    ['', ''],
    ['HASIL ANALISIS KORELASI PEARSON', ''],
    ['Suhu Inverter vs PR', meta.correlation?.inverterTempVsPr?.label || performanceData.correlation.inverterTempVsPr.label],
    ['Suhu Udara Open-Meteo vs PR', meta.correlation?.ambientTempVsPr?.label || performanceData.correlation.ambientTempVsPr.label],
  ];

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);

  XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan Bulanan');
  XLSX.utils.book_append_sheet(wb, ws2, 'Rincian Harian');
  XLSX.utils.book_append_sheet(wb, ws3, 'Metadata & Kualitas');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf;
}

/**
 * Build ZIP 3-CSV package
 */
export async function buildInverterTempZipCsv({
  scope = 'national',
  targetId = 'ALL',
  year = 2026,
  methodVersion = null,
  db = prismaClient,
} = {}) {
  const performanceData = await getInverterTemperaturePerformance({
    scope,
    targetId,
    year,
    methodVersion,
    db,
  });

  const dailyRecords = await fetchDailyInverterTempDetails({ year, db });

  // CSV 1: 01_ringkasan_bulanan.csv
  const csv1Rows = [
    formatCsvRow([
      'Bulan (YYYY-MM)',
      'Nama Bulan',
      'PR Terbobot (%)',
      'Suhu Inverter (°C)',
      'Suhu Udara Open-Meteo (°C)',
      'Iradiasi GHI (kWh/m²)',
      'Cakupan Suhu Inverter (%)',
      'Status Kelayakan Data',
      'Parsial',
    ]),
    ...performanceData.series.map(s =>
      formatCsvRow([
        s.monthKey,
        s.monthLabel,
        s.prWeightedPct !== null ? s.prWeightedPct : '',
        s.inverterTempC !== null ? s.inverterTempC : '',
        s.ambientTempC !== null ? s.ambientTempC : '',
        s.ghiKwhM2 !== null ? s.ghiKwhM2 : '',
        s.inverterCoveragePct,
        s.qualityStatus,
        s.isPartial ? 'YA' : 'TIDAK',
      ])
    ),
  ];
  const csv1Content = `\uFEFF${csv1Rows.join('\r\n')}\r\n`;

  // CSV 2: 02_rincian_harian.csv
  const csv2Rows = [
    formatCsvRow([
      'Tanggal (WIB)',
      'Inverter SN',
      'Nama Plant / DC',
      'Versi Metodologi',
      'Slot Terjadwal',
      'Slot Sukses',
      'Slot Valid',
      'Suhu Rata-rata (°C)',
      'Suhu Minimum (°C)',
      'Suhu Maksimum (°C)',
      'Spread Suhu (°C)',
      'Rasio Stale (%)',
      'Status Kualitas',
      'Alasan Kualitas',
    ]),
    ...(dailyRecords.length > 0
      ? dailyRecords.map(d =>
          formatCsvRow([
            d.dateWib,
            d.inverterSn,
            d.dcId || d.plantName || '',
            d.methodVersion,
            d.scheduledSlots,
            d.successSlots,
            d.validSlots,
            d.avgTempC !== null ? d.avgTempC : '',
            d.minTempC !== null ? d.minTempC : '',
            d.maxTempC !== null ? d.maxTempC : '',
            d.spreadTempC !== null ? d.spreadTempC : '',
            d.staleRatioPct !== null ? d.staleRatioPct : '',
            d.qualityStatus,
            d.qualityReasons ? d.qualityReasons.join('; ') : '',
          ])
        )
      : [formatCsvRow(['Belum ada data rekaman harian inverter temperature', '', '', '', '', '', '', '', '', '', '', '', '', ''])]),
  ];
  const csv2Content = `\uFEFF${csv2Rows.join('\r\n')}\r\n`;

  // CSV 3: 03_metadata_kualitas.csv
  const meta = performanceData.metadata;
  const csv3Rows = [
    formatCsvRow(['Parameter Metadata', 'Nilai / Keterangan']),
    formatCsvRow(['Scope Analisis', meta.scope]),
    formatCsvRow(['Target ID', meta.targetId]),
    formatCsvRow(['Tahun', meta.year]),
    formatCsvRow(['Versi Metodologi Aktif', meta.activeMethodVersion]),
    formatCsvRow(['Versi Metodologi Data', meta.methodVersion]),
    formatCsvRow(['Kapasitas Terpasang Total (kWp)', meta.totalInstalledKwp]),
    formatCsvRow(['Jumlah Plant Dihitung', meta.plantCount]),
    formatCsvRow(['Jumlah DC Dihitung', meta.dcCount]),
    formatCsvRow(['Jumlah Inverter Terpantau', meta.inverterCount]),
    formatCsvRow(['Jumlah Inverter Tanpa Rating', meta.unratedInverterCount]),
    formatCsvRow(['Eksekusi Sukses Terakhir', meta.lastSuccessfulRun || 'Belum pernah sukses']),
    formatCsvRow(['Status Stale (>30m)', meta.isStale ? 'PERINGATAN_STALE' : 'OK']),
    formatCsvRow(['Peringatan Cakupan Rendah (<80%)', meta.hasCoverageWarning ? 'YA' : 'TIDAK']),
    formatCsvRow(['DEFINISI CAKUPAN', '']),
    formatCsvRow(['Sampling Coverage', meta.coverageDefinitions.samplingCoverage]),
    formatCsvRow(['Production Coverage', meta.coverageDefinitions.productionCoverage]),
    formatCsvRow(['Monthly Coverage', meta.coverageDefinitions.monthlyCoverage]),
    formatCsvRow(['KETERBATASAN FISIK SUHU INVERTER', meta.temperatureLimitations]),
    formatCsvRow(['Korelasi Suhu Inverter vs PR', performanceData.correlation.inverterTempVsPr.label]),
    formatCsvRow(['Korelasi Suhu Udara Open-Meteo vs PR', performanceData.correlation.ambientTempVsPr.label]),
  ];
  const csv3Content = `\uFEFF${csv3Rows.join('\r\n')}\r\n`;

  return createZipBuffer([
    { filename: '01_ringkasan_bulanan.csv', content: csv1Content },
    { filename: '02_rincian_harian.csv', content: csv2Content },
    { filename: '03_metadata_kualitas.csv', content: csv3Content },
  ]);
}

/**
 * Log export execution audit
 */
export async function logExportAudit({
  exportType,
  scope,
  targetId,
  year,
  methodVersion,
  ipAddress = '127.0.0.1',
  userAgent = 'internal-dashboard',
  db = prismaClient,
}) {
  try {
    if (db.inverterTempExportAudit) {
      await db.inverterTempExportAudit.create({
        data: {
          exportType,
          scope,
          targetId: String(targetId),
          year: Number(year) || 2026,
          methodVersion: methodVersion || getActiveInverterTempMethodVersion(),
          exportedAt: new Date(),
          ipAddress: String(ipAddress),
          userAgent: String(userAgent).slice(0, 255),
        },
      });
    }
  } catch (err) {
    console.warn('[logExportAudit] Notice: audit log write skipped:', err.message);
  }
}
