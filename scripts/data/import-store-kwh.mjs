import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import prisma from '../../src/lib/prisma.ts';
import { gridForStoreBranch } from '../../src/lib/scope2/storeBranchGrid.ts';
import {
  STORE_KWH_MODULE,
  USAGE_FLAG,
  computeMeterUsage,
  daysInYearMonth,
  parseStoreKwhRow,
  serialToDate,
  serialToInstant,
  serialToYearMonth,
  validateStoreKwhHeader,
} from '../../src/lib/scope2/storeKwh.ts';

// Usage: node --env-file=.env scripts/data/import-store-kwh.mjs "<REPORT_KWH_TOKO.xlsx>" [--apply]
// Without --apply it only reads the database and prints the result. With --apply the month in the file replaces the same month in the store_kwh_* tables.
// Reads the workbook as a stream because one month is about 620 thousand rows.

const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith('--'));
const apply = args.includes('--apply');
if (!file || !fs.existsSync(file)) {
  console.error('Pakai: node --env-file=.env scripts/data/import-store-kwh.mjs "<REPORT_KWH_TOKO.xlsx>" [--apply]');
  process.exit(1);
}

const CHUNK = 5000;
const HEADER_ROW = 6;
const MONTH_START_OFFSET = (serial) => serial - (serialToDate(serial).getUTCDate() - 1);

async function readRows(filePath) {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, { sharedStrings: 'cache', styles: 'ignore', hyperlinks: 'ignore', worksheets: 'emit', entries: 'emit' });
  const rows = [];
  let footer = 0;
  for await (const sheet of reader) {
    for await (const row of sheet) {
      const cells = Array.isArray(row.values) ? row.values.slice(1) : [];
      if (row.number === HEADER_ROW) {
        const problem = validateStoreKwhHeader(cells);
        if (problem) throw new Error(problem);
      } else if (row.number > HEADER_ROW) {
        const parsed = parseStoreKwhRow(cells);
        if (parsed) rows.push(parsed);
        else footer += 1;
      }
    }
    break;
  }
  return { rows, footer };
}

// The tables do not exist before the migration is applied; a dry run still works then.
async function optional(query, fallback) {
  try {
    return await query();
  } catch (error) {
    if (apply || error?.code !== 'P2021') throw error;
    return fallback;
  }
}

const sumBy = (items, pick) => items.reduce((total, item) => total + pick(item), 0);
const format = (value, digits = 0) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(value);

async function main() {
  const { rows, footer } = await readRows(file);
  if (!rows.length) throw new Error('Tidak ada baris data di file.');
  const months = new Set(rows.map(row => serialToYearMonth(row.dateSerial)));
  if (months.size !== 1) throw new Error(`File harus berisi satu bulan, ditemukan: ${[...months].join(', ')}`);
  const [yearMonth] = months;
  const monthStart = MONTH_START_OFFSET(rows[0].dateSerial);
  const daysInMonth = daysInYearMonth(yearMonth);
  const monthEnd = monthStart + daysInMonth - 1;

  const unmapped = [...new Set(rows.filter(row => !gridForStoreBranch(row.branchCode)).map(row => `${row.branchCode} ${row.branchName}`))];
  if (unmapped.length) throw new Error(`Cabang belum punya Wilayah PLN di storeBranchGrid.ts: ${unmapped.join(', ')}`);

  const storeMaster = await prisma.storeMaster.findMany({ select: { code: true, ownership: true } });
  const ownershipOf = new Map(storeMaster.map(store => [store.code, store.ownership]));

  const previousMonthRows = await optional(() => prisma.storeKwhMonthly.findMany({
    where: { yearMonth: { lt: yearMonth }, lastReadingKwh: { not: null } },
    orderBy: { yearMonth: 'asc' },
    select: { storeCode: true, meterId: true, lastReadingKwh: true, lastReadingDate: true },
  }), []);
  const lastKnown = new Map();
  for (const row of previousMonthRows) {
    const serial = Math.round(row.lastReadingDate.getTime() / 86_400_000) + 25_569;
    lastKnown.set(`${row.storeCode}|${row.meterId}`, { value: row.lastReadingKwh, dateSerial: serial });
  }

  const storeDays = new Map();
  const meters = new Map();
  for (const row of rows) {
    if (!storeDays.has(row.storeCode)) storeDays.set(row.storeCode, new Set());
    storeDays.get(row.storeCode).add(row.dateSerial);
    const key = `${row.storeCode}|${row.meterId}`;
    if (!meters.has(key)) meters.set(key, []);
    meters.get(key).push(row);
  }

  const batchId = crypto.randomUUID();
  const readingRows = [];
  const monthlyRows = [];
  const daily = new Map();
  const flagCounts = {};
  const dailyRow = (serial, branchCode, meterType, storeComplete) => {
    const key = `${serial}|${branchCode}|${meterType}|${storeComplete}`;
    if (!daily.has(key)) {
      daily.set(key, {
        readingDate: serialToDate(serial), yearMonth, dayIndex: serial - monthStart, branchCode, meterType, storeComplete,
        usageKwh: 0, reportedMeters: 0, zeroPrevious: 0, topUp: 0, decreased: 0, placeholder: 0, replaced: 0, lowUsageRows: 0, batchId,
      });
    }
    return daily.get(key);
  };

  for (const [key, meterRows] of meters) {
    const head = meterRows[0];
    const usage = computeMeterUsage(meterRows, { monthStart, monthEnd, lastKnown: lastKnown.get(key) ?? null });
    const grid = gridForStoreBranch(head.branchCode);
    const ownership = ownershipOf.has(head.storeCode) ? ownershipOf.get(head.storeCode) : null;
    const inScope = ownership !== 'F';
    const storeReportedDays = storeDays.get(head.storeCode).size;
    const storeComplete = storeReportedDays === daysInMonth;

    monthlyRows.push({
      yearMonth, storeCode: head.storeCode, meterId: head.meterId, storeName: head.storeName, branchCode: head.branchCode, branchName: head.branchName,
      gridRegion: grid.grid, gridFactor: grid.factor, meterType: head.meterType, ownership, inScope, storeComplete,
      measuredKwh: usage.measuredKwh, estimatedKwh: usage.estimatedKwh, emissionKg: (usage.measuredKwh + usage.estimatedKwh) * grid.factor,
      medianDailyKwh: usage.medianKwh, reportedDays: usage.reportedDays, storeReportedDays, coveredDays: usage.coveredDays,
      missingDays: usage.missingDays, flaggedDays: usage.flaggedDays, lowUsage: usage.lowUsage,
      lastReadingKwh: usage.lastReading?.value ?? null,
      lastReadingDate: usage.lastReading ? serialToDate(usage.lastReading.dateSerial) : null,
      batchId,
    });

    for (const row of usage.rows) {
      flagCounts[row.flag] = (flagCounts[row.flag] ?? 0) + 1;
      readingRows.push({
        readingDate: serialToDate(row.dateSerial), yearMonth, storeCode: head.storeCode, meterId: head.meterId, branchCode: head.branchCode, meterType: head.meterType,
        inputAt: row.inputSerial === null ? null : serialToInstant(row.inputSerial), readingKwh: row.reading, previousKwh: row.previous, rawGapKwh: row.gap,
        usageKwh: row.usage, spreadDays: row.spreadDays, flag: row.flag, batchId,
      });
      if (!inScope) continue;
      const day = dailyRow(row.dateSerial, head.branchCode, head.meterType, storeComplete);
      day.reportedMeters += 1;
      if (row.previous === 0) day.zeroPrevious += 1;
      if (row.meterType === 'PREPAID' && row.reading > row.previous) day.topUp += 1;
      if (row.meterType === 'POSTPAID' && row.reading < row.previous) day.decreased += 1;
      if (row.flag === USAGE_FLAG.PLACEHOLDER) day.placeholder += 1;
      if (row.flag !== USAGE_FLAG.OK && row.flag !== USAGE_FLAG.RECOMPUTED) day.replaced += 1;
      if (usage.lowUsage) day.lowUsageRows += 1;
    }
    if (!inScope) continue;
    for (const map of [usage.measuredByDay, usage.estimatedByDay]) {
      for (const [serial, kwh] of map) dailyRow(serial, head.branchCode, head.meterType, storeComplete).usageKwh += kwh;
    }
  }

  const inScope = monthlyRows.filter(row => row.inScope);
  const stores = rowsList => new Set(rowsList.map(row => row.storeCode)).size;
  const measured = sumBy(inScope, row => row.measuredKwh);
  const estimated = sumBy(inScope, row => row.estimatedKwh);
  const lowStores = new Map();
  for (const row of inScope) lowStores.set(row.storeCode, (lowStores.get(row.storeCode) ?? true) && row.lowUsage);

  console.log(`Periode ${yearMonth}: ${format(rows.length)} baris, ${footer} baris judul/keterangan dilewati.`);
  console.log(`Meter ${format(monthlyRows.length)}, toko ${format(stores(monthlyRows))}.`);
  console.log(`Master toko: ${format(storeMaster.length)} baris. Kode toko di file yang tidak ada di master: ${format(new Set(monthlyRows.filter(row => row.ownership === null).map(row => row.storeCode)).size)}.`);
  console.log(`Kolom F/R terisi di master: ${format(storeMaster.filter(store => store.ownership).length)} toko.`);
  console.log(`Toko Franchise dikeluarkan: ${format(stores(monthlyRows.filter(row => !row.inScope)))} toko, ${format(sumBy(monthlyRows.filter(row => !row.inScope), row => row.measuredKwh + row.estimatedKwh) / 1000)} MWh.`);
  console.log(`Masuk Scope 2: ${format(stores(inScope))} toko.`);
  console.log(`Listrik: ${format((measured + estimated) / 1000)} MWh (terukur ${format(measured / 1000)}, estimasi ${format(estimated / 1000)}, ${format((estimated / (measured + estimated)) * 100, 1)}%).`);
  console.log(`Emisi: ${format(sumBy(inScope, row => row.emissionKg) / 1000)} tCO2e.`);
  console.log(`Toko yang semua meternya naik 5 kWh per hari atau kurang: ${format([...lowStores.values()].filter(Boolean).length)}.`);
  console.log('Status baris:', flagCounts);
  const byGrid = {};
  for (const row of inScope) byGrid[row.gridRegion] = (byGrid[row.gridRegion] ?? 0) + row.emissionKg / 1000;
  console.log('Emisi per Wilayah PLN (tCO2e):', Object.fromEntries(Object.entries(byGrid).map(([grid, ton]) => [grid, Math.round(ton)])));

  if (!apply) {
    console.log('Dry run. Tambahkan --apply untuk menulis ke database.');
    return;
  }

  const fileHash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const dailyRows = [...daily.values()];
  await prisma.$transaction(async tx => {
    await tx.storeKwhReading.deleteMany({ where: { yearMonth } });
    await tx.storeKwhMonthly.deleteMany({ where: { yearMonth } });
    await tx.storeKwhBranchDaily.deleteMany({ where: { yearMonth } });
    for (let i = 0; i < readingRows.length; i += CHUNK) await tx.storeKwhReading.createMany({ data: readingRows.slice(i, i + CHUNK) });
    for (let i = 0; i < monthlyRows.length; i += CHUNK) await tx.storeKwhMonthly.createMany({ data: monthlyRows.slice(i, i + CHUNK) });
    for (let i = 0; i < dailyRows.length; i += CHUNK) await tx.storeKwhBranchDaily.createMany({ data: dailyRows.slice(i, i + CHUNK) });
    const batch = { filename: path.basename(file), module: STORE_KWH_MODULE, recordCount: readingRows.length, status: 'SUCCESS', fileHash, importMode: 'CLI', metadata: { yearMonth, batchId } };
    await tx.importBatch.upsert({ where: { module_fileHash: { module: STORE_KWH_MODULE, fileHash } }, create: batch, update: { ...batch, importedAt: new Date() } });
  }, { timeout: 30 * 60_000, maxWait: 60_000 });
  console.log(`Tersimpan: ${format(readingRows.length)} bacaan, ${format(monthlyRows.length)} rekap meter, ${format(dailyRows.length)} rekap harian.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
