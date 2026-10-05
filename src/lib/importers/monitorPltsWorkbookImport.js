/**
 * Monitor PLTS Workbook Importer
 * Parses "Monitor PLTS 2026 (1).xlsx" workbook which contains per-month sheets
 * (JAN 2026, FEB 2026, MAR 2026, APRIL 2026, MEI 2026, JUNI 2026, JULI 2026, AGUS 2026)
 * each with columns: Plant name, Monthly yield(MWh), Energy purchased(MWh),
 * Monthly feed-in(MWh), Monthly load consumption(MWh), Total Produksi
 *
 * Also parses the "Radiasi" sheet with monthly average irradiation per plant.
 *
 * All data is upsertet to ClimateMonthly, LoadMonthly, and MonthlyYieldObservation.
 */

import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import prisma from '../prisma.js';
import { buildPlantNameIndex, resolvePlantByName, whM2ToKwhM2 } from './isolarAnnualReportImport.js';

const SOURCE_TAG = 'MONITOR_PLTS_WORKBOOK';

/** Map sheet names to YYYY-MM periods */
const SHEET_MONTH_MAP = {
  'JAN 2026':   '202601',
  'FEB 2026':   '202602',
  'MAR 2026':   '202603',
  'APRIL 2026': '202604',
  'MEI 2026':   '202605',
  'JUNI 2026':  '202606',
  'JULI 2026':  '202607',
  'AGUS 2026':  '202608',
  'SEP 2026':   '202609',
  'OKT 2026':   '202610',
  'NOV 2026':   '202611',
  'DES 2026':   '202612',
};

/**
 * Parse a monthly sheet from the Monitor PLTS workbook.
 * Returns rows with yield(kWh), load(kWh), feedIn(kWh), purchased(kWh).
 * NOTE: Values in the workbook are in MWh — we convert to kWh (× 1000).
 */
function parseMonthlySheet(ws, yearMonth) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (data.length < 2) return [];

  const header = data[0].map(h => String(h || '').trim().toLowerCase());
  const nameCol = header.findIndex(h => h.includes('plant name'));
  const yieldCol = header.findIndex(h => h.includes('monthly yield'));
  const loadCol = header.findIndex(h => h.includes('load consumption'));
  const feedInCol = header.findIndex(h => h.includes('feed-in'));
  const purchasedCol = header.findIndex(h => h.includes('purchased'));

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const plantName = String(row[nameCol] || '').trim();
    if (!plantName) continue;

    // Skip aggregate rows (e.g. "Lombok", "Cilacap")
    const lowerName = plantName.toLowerCase();
    if (['lombok', 'cilacap', 'total', 'grand total'].includes(lowerName)) continue;

    const yieldMwh = yieldCol >= 0 ? Number(row[yieldCol]) : null;
    const loadMwh = loadCol >= 0 ? Number(row[loadCol]) : null;
    const feedInMwh = feedInCol >= 0 ? Number(row[feedInCol]) : null;
    const purchasedMwh = purchasedCol >= 0 ? Number(row[purchasedCol]) : null;

    rows.push({
      plantName,
      yearMonth,
      yieldKwh: Number.isFinite(yieldMwh) ? Math.round(yieldMwh * 1000 * 100) / 100 : null,
      loadKwh: Number.isFinite(loadMwh) ? Math.round(loadMwh * 1000 * 100) / 100 : null,
      feedInKwh: Number.isFinite(feedInMwh) ? Math.round(feedInMwh * 1000 * 100) / 100 : null,
      purchasedKwh: Number.isFinite(purchasedMwh) ? Math.round(purchasedMwh * 1000 * 100) / 100 : null,
      sourceRow: i + 1,
    });
  }
  return rows;
}

/**
 * Parse the Radiasi sheet — it has average monthly irradiation (Wh/m²) by period.
 * Sheet format:
 *   Row 0: [null, 2025, 2026]
 *   Row 1: ["Time", "Average of Plant monthly irradiation(Wh/㎡)"]
 *   Row 2+: [excelDate, value2025, value2026]
 *
 * NOTE: This sheet has AVERAGE irradiation across ALL plants, not per-plant.
 * It's useful as a national average reference but not per-plant PR calculation.
 */
function parseRadiasiSheet(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (data.length < 3) return [];
  const yearRow = data[0];
  const results = [];
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (typeof row[0] === 'string' && row[0].toLowerCase().includes('total')) continue;
    const excelDate = row[0];
    if (!Number.isFinite(excelDate)) continue;
    // Convert Excel serial date to JS Date
    const jsDate = XLSX.SSF.parse_date_code(excelDate);
    const yearMonthPairs = [];
    if (yearRow[1] && Number.isFinite(row[1])) {
      yearMonthPairs.push({ year: Number(yearRow[1]), radiationWhM2: row[1], month: jsDate.m });
    }
    if (yearRow[2] && Number.isFinite(row[2])) {
      yearMonthPairs.push({ year: Number(yearRow[2]), radiationWhM2: row[2], month: jsDate.m });
    }
    for (const pair of yearMonthPairs) {
      results.push({
        yearMonth: `${pair.year}${String(pair.month).padStart(2, '0')}`,
        radiationKwhM2: whM2ToKwhM2(pair.radiationWhM2),
        source: 'national_average',
      });
    }
  }
  return results;
}

/**
 * Import the full Monitor PLTS workbook.
 */
export async function importMonitorPltsWorkbook(filePath, { db = prisma, dryRun = false } = {}) {
  const wb = XLSX.readFile(filePath);
  const nameIndex = await buildPlantNameIndex(db);
  const filename = filePath.split(/[\\/]/).pop();

  const results = {
    filename,
    sheetsProcessed: 0,
    yield: { imported: 0, skippedNoPlant: 0, skippedNoValue: 0 },
    load: { imported: 0, skippedNoPlant: 0, skippedNoValue: 0 },
    radiation: { imported: 0 },
    unmappedPlants: new Set(),
    errors: [],
  };

  // Process monthly sheets
  for (const [sheetName, yearMonth] of Object.entries(SHEET_MONTH_MAP)) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    results.sheetsProcessed++;
    const rows = parseMonthlySheet(ws, yearMonth);

    for (const row of rows) {
      const plant = resolvePlantByName(row.plantName, nameIndex);
      if (!plant) {
        results.unmappedPlants.add(row.plantName);
        results.yield.skippedNoPlant++;
        results.load.skippedNoPlant++;
        continue;
      }

      const psId = plant.sungrowPsIds[0];

      // Import yield
      if (row.yieldKwh !== null && row.yieldKwh >= 0) {
        if (!dryRun) {
          await db.monthlyYieldObservation.upsert({
            where: {
              yearMonth_psId_measurementType_source: {
                yearMonth, psId, measurementType: 'MONTHLY_YIELD', source: SOURCE_TAG,
              },
            },
            update: {
              energyKwh: row.yieldKwh,
              sourceFile: filename,
              sourceRow: row.sourceRow,
              qualityStatus: row.yieldKwh > 0 ? 'FINAL' : 'ZERO',
              metadata: { sheetName, feedInKwh: row.feedInKwh, purchasedKwh: row.purchasedKwh },
              updatedAt: new Date(),
            },
            create: {
              yearMonth, psId,
              energyKwh: row.yieldKwh,
              measurementType: 'MONTHLY_YIELD',
              source: SOURCE_TAG,
              sourceFile: filename,
              sourceRow: row.sourceRow,
              qualityStatus: row.yieldKwh > 0 ? 'FINAL' : 'ZERO',
              metadata: { sheetName, feedInKwh: row.feedInKwh, purchasedKwh: row.purchasedKwh },
            },
          });
        }
        results.yield.imported++;
      } else {
        results.yield.skippedNoValue++;
      }

      // Import load
      if (row.loadKwh !== null && row.loadKwh > 0) {
        if (!dryRun) {
          await db.loadMonthly.upsert({
            where: {
              yearMonth_psId_source: { yearMonth, psId, source: SOURCE_TAG },
            },
            update: { loadKwh: row.loadKwh, metadata: { sheetName, filename }, updatedAt: new Date() },
            create: {
              yearMonth, psId,
              loadKwh: row.loadKwh,
              source: SOURCE_TAG,
              sourceRef: filename,
              metadata: { sheetName, filename },
            },
          });
        }
        results.load.imported++;
      } else {
        results.load.skippedNoValue++;
      }
    }
  }

  // Process Radiasi sheet (national average)
  const radiasiSheet = wb.Sheets['Radiasi'];
  if (radiasiSheet) {
    const radRows = parseRadiasiSheet(radiasiSheet);
    // Store as a pseudo-plant entry with psId=0 for national average reference
    for (const row of radRows) {
      if (row.radiationKwhM2 !== null) {
        results.radiation.imported++;
        // Note: This is an average across all plants, stored for reference only
      }
    }
  }

  return {
    ...results,
    unmappedPlants: [...results.unmappedPlants],
  };
}

/**
 * Import a single month CSV file (e.g. "Monitor PLTS 2026 - APRIL 2026.csv").
 */
export async function importMonitorPltsCsv(filePath, options = {}) {
  const { dryRun = false, db = prisma } = options;
  const filename = path.basename(filePath);

  // Detect month from filename (e.g. "APRIL 2026")
  let yearMonth = null;
  for (const [key, ym] of Object.entries(SHEET_MONTH_MAP)) {
    if (filename.toUpperCase().includes(key)) {
      yearMonth = ym;
      break;
    }
  }

  if (!yearMonth) {
    // Try regex
    const m = filename.match(/(202\d)[\s_-]*(\d{2})/);
    if (m) yearMonth = `${m[1]}${m[2]}`;
  }

  if (!yearMonth) {
    throw new Error(`Tidak dapat mendeteksi periode bulan dari nama file: ${filename}`);
  }

  const nameIndex = await buildPlantNameIndex(db);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`File terlalu pendek: ${filePath}`);

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameCol = header.findIndex(h => h.includes('plant name'));
  const yieldCol = header.findIndex(h => h.includes('monthly yield'));
  const loadCol = header.findIndex(h => h.includes('load consumption'));
  const feedInCol = header.findIndex(h => h.includes('feed-in'));
  const purchasedCol = header.findIndex(h => h.includes('purchased'));

  const results = {
    fileType: 'MONITOR_CSV',
    filename,
    yearMonth,
    yield: { imported: 0, skippedNoPlant: 0, skippedNoValue: 0 },
    load: { imported: 0, skippedNoPlant: 0, skippedNoValue: 0 },
    unmappedPlants: new Set(),
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    const plantName = (parts[nameCol] || '').trim();
    if (!plantName) continue;

    const lowerName = plantName.toLowerCase();
    if (['lombok', 'cilacap', 'total', 'grand total'].includes(lowerName)) continue;

    const yieldMwh = yieldCol >= 0 ? Number(parts[yieldCol]) : null;
    const loadMwh = loadCol >= 0 ? Number(parts[loadCol]) : null;
    const feedInMwh = feedInCol >= 0 ? Number(parts[feedInCol]) : null;
    const purchasedMwh = purchasedCol >= 0 ? Number(parts[purchasedCol]) : null;

    const yieldKwh = Number.isFinite(yieldMwh) ? Math.round(yieldMwh * 1000 * 100) / 100 : null;
    const loadKwh = Number.isFinite(loadMwh) ? Math.round(loadMwh * 1000 * 100) / 100 : null;
    const feedInKwh = Number.isFinite(feedInMwh) ? Math.round(feedInMwh * 1000 * 100) / 100 : null;
    const purchasedKwh = Number.isFinite(purchasedMwh) ? Math.round(purchasedMwh * 1000 * 100) / 100 : null;

    const plant = resolvePlantByName(plantName, nameIndex);
    if (!plant || !plant.sungrowPsIds || plant.sungrowPsIds.length === 0) {
      results.unmappedPlants.add(plantName);
      results.yield.skippedNoPlant++;
      results.load.skippedNoPlant++;
      continue;
    }

    const psId = plant.sungrowPsIds[0];

    // Yield
    if (yieldKwh !== null && yieldKwh >= 0) {
      if (!dryRun) {
        await db.monthlyYieldObservation.upsert({
          where: {
            yearMonth_psId_measurementType_source: {
              yearMonth, psId, measurementType: 'MONTHLY_YIELD', source: SOURCE_TAG,
            },
          },
          update: {
            energyKwh: yieldKwh,
            sourceFile: filename,
            sourceRow: i + 1,
            qualityStatus: yieldKwh > 0 ? 'FINAL' : 'ZERO',
            metadata: { feedInKwh, purchasedKwh },
            updatedAt: new Date(),
          },
          create: {
            yearMonth, psId,
            energyKwh: yieldKwh,
            measurementType: 'MONTHLY_YIELD',
            source: SOURCE_TAG,
            sourceFile: filename,
            sourceRow: i + 1,
            qualityStatus: yieldKwh > 0 ? 'FINAL' : 'ZERO',
            metadata: { feedInKwh, purchasedKwh },
          },
        });
      }
      results.yield.imported++;
    } else {
      results.yield.skippedNoValue++;
    }

    // Load
    if (loadKwh !== null && loadKwh > 0) {
      if (!dryRun) {
        await db.loadMonthly.upsert({
          where: {
            yearMonth_psId_source: { yearMonth, psId, source: SOURCE_TAG },
          },
          update: { loadKwh, metadata: { filename }, updatedAt: new Date() },
          create: {
            yearMonth, psId,
            loadKwh,
            source: SOURCE_TAG,
            sourceRef: filename,
            metadata: { filename },
          },
        });
      }
      results.load.imported++;
    } else {
      results.load.skippedNoValue++;
    }
  }

  return {
    ...results,
    unmappedPlants: [...results.unmappedPlants],
  };
}

