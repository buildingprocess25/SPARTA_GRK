/**
 * iSolarCloud Annual Report CSV/XLSX Importer
 * Parses "Data Radiasi", "Monthly iradiasi2", "monthly load consump",
 * and "monthly yield" annual report files from iSolarCloud portal.
 *
 * File format (CSV):
 *   Line 1: Title header (e.g. "Data Radiasi_Year_2026")
 *   Line 2: "Plant name,Time,<measurement column>"
 *   Lines 3+: "Alfamart DC Karawang,2026-01,123456.78"
 *
 * Supports:
 *   - Radiasi:    "Plant monthly irradiation(Wh/?)" -> ClimateMonthly.radiationKwhM2
 *   - Load:       "Monthly load consumption(kWh)"    -> LoadMonthly.loadKwh
 *   - Yield:      "Monthly yield(kWh)"               -> MonthlyYieldObservation.energyKwh
 *
 * Plant names are resolved to psId via PlantMaster aliases in the database.
 * All operations are idempotent (upsert on unique key [yearMonth, psId, source]).
 */

import fs from 'node:fs';
import path from 'node:path';
import prisma from '../prisma.js';

// ──────────────────────────── PLANT NAME → psId RESOLVER ────────────────────

/**
 * Build a case-insensitive lookup from CSV plant name → PlantMaster entry.
 * Uses canonicalName, aliases array, and sungrowPsIds.
 */
export async function buildPlantNameIndex(db = prisma) {
  const plants = await db.plantMaster.findMany({ orderBy: { canonicalName: 'asc' } });
  const index = new Map();

  for (const plant of plants) {
    const candidates = [
      plant.canonicalName.toLowerCase(),
      `alfamart dc ${plant.canonicalName.toLowerCase()}`,
      ...(Array.isArray(plant.aliases) ? plant.aliases.map(a => String(a).toLowerCase()) : []),
    ];
    for (const alias of candidates) {
      if (alias && !index.has(alias)) {
        index.set(alias, plant);
      }
    }
  }
  return index;
}

/**
 * Resolve a CSV plant name to a PlantMaster entry.
 * @param {string} rawName - e.g. "Alfamart DC Karawang"
 * @param {Map} nameIndex - from buildPlantNameIndex
 * @returns {object|null} PlantMaster record or null
 */
export function resolvePlantByName(rawName, nameIndex) {
  const cleaned = String(rawName).trim().toLowerCase();
  if (nameIndex.has(cleaned)) return nameIndex.get(cleaned);

  // Try without "alfamart " prefix
  const withoutPrefix = cleaned.replace(/^alfamart\s+(dc\s+)?/i, '').trim();
  if (nameIndex.has(withoutPrefix)) return nameIndex.get(withoutPrefix);
  if (nameIndex.has(`alfamart dc ${withoutPrefix}`)) return nameIndex.get(`alfamart dc ${withoutPrefix}`);

  // Fuzzy: check if any alias contains the cleaned name
  for (const [key, plant] of nameIndex) {
    if (key.includes(withoutPrefix) || withoutPrefix.includes(key)) {
      return plant;
    }
  }
  return null;
}

// ──────────────────────────── FILE TYPE DETECTION ────────────────────────────

const FILE_TYPE_PATTERNS = [
  { pattern: /radiasi|irradiation/i, type: 'RADIATION' },
  { pattern: /iradiasi/i,           type: 'RADIATION' },
  { pattern: /load\s*consump/i,     type: 'LOAD' },
  { pattern: /yield/i,              type: 'YIELD' },
];

const HEADER_TYPE_PATTERNS = [
  { pattern: /irradiation\(Wh/i,        type: 'RADIATION' },
  { pattern: /load\s+consumption\(kWh/i, type: 'LOAD' },
  { pattern: /yield\(kWh/i,             type: 'YIELD' },
];

/**
 * Detect measurement type from filename and/or header column.
 */
export function detectFileType(filename, headerColumn) {
  // Try header first (more reliable)
  if (headerColumn) {
    for (const { pattern, type } of HEADER_TYPE_PATTERNS) {
      if (pattern.test(headerColumn)) return type;
    }
  }
  // Fallback to filename
  if (filename) {
    for (const { pattern, type } of FILE_TYPE_PATTERNS) {
      if (pattern.test(filename)) return type;
    }
  }
  return null;
}

// ──────────────────────────── CSV PARSER ─────────────────────────────────────

/**
 * Parse a CSV file from iSolarCloud annual report.
 * @param {string} filePath - Absolute path to CSV file
 * @returns {{ title: string, type: string, rows: Array<{ plantName: string, yearMonth: string, value: number|null }> }}
 */
export function parseIsolarCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 3) throw new Error(`File terlalu pendek (${lines.length} baris): ${filePath}`);

  const title = lines[0].trim();
  const headerLine = lines[1].trim();
  const headers = headerLine.split(',').map(h => h.trim());

  if (headers.length < 3) throw new Error(`Header tidak valid (${headers.length} kolom): ${headerLine}`);

  const measurementHeader = headers[2];
  const fileType = detectFileType(path.basename(filePath), measurementHeader);
  if (!fileType) throw new Error(`Tipe file tidak dikenali dari header "${measurementHeader}" atau nama "${path.basename(filePath)}"`);

  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    const plantName = (parts[0] || '').trim();
    const timeStr = (parts[1] || '').trim();
    const valueStr = (parts[2] || '').trim();

    if (!plantName || !timeStr) continue;

    // Parse yearMonth from "2026-01" -> "202601"
    const ymMatch = timeStr.match(/^(\d{4})-(\d{2})$/);
    if (!ymMatch) continue;
    const yearMonth = `${ymMatch[1]}${ymMatch[2]}`;

    // Parse value (empty = null)
    let value = null;
    if (valueStr !== '' && valueStr !== 'null' && valueStr !== 'undefined') {
      value = Number(valueStr);
      if (!Number.isFinite(value)) value = null;
    }

    rows.push({ plantName, yearMonth, value, sourceRow: i + 1 });
  }

  return { title, type: fileType, rows, filename: path.basename(filePath) };
}

// ──────────────────────────── UNIT CONVERSION ───────────────────────────────

/**
 * Convert radiation from Wh/m² (as returned by iSolarCloud) to kWh/m².
 * iSolarCloud returns "Plant monthly irradiation(Wh/?)" — the unit is Wh/m².
 */
export function whM2ToKwhM2(whM2) {
  if (whM2 === null || whM2 === undefined || !Number.isFinite(whM2)) return null;
  return Number((whM2 / 1000).toFixed(6));
}

// ──────────────────────────── DATABASE IMPORTERS ────────────────────────────

const SOURCE_TAG = 'ISOLAR_ANNUAL_REPORT';

/**
 * Import radiation rows into ClimateMonthly.
 */
export async function importRadiation(parsedRows, nameIndex, { db = prisma, dryRun = false, filename = '' } = {}) {
  const results = { total: parsedRows.length, imported: 0, skippedNoPlant: 0, skippedNoValue: 0, errors: [] };

  for (const row of parsedRows) {
    const plant = resolvePlantByName(row.plantName, nameIndex);
    if (!plant) {
      results.skippedNoPlant++;
      results.errors.push({ row: row.sourceRow, plantName: row.plantName, error: 'Plant tidak ditemukan' });
      continue;
    }
    if (row.value === null) {
      results.skippedNoValue++;
      continue;
    }

    const radiationKwhM2 = whM2ToKwhM2(row.value);
    if (radiationKwhM2 === null) {
      results.skippedNoValue++;
      continue;
    }

    if (!dryRun) {
      const psId = plant.sungrowPsIds[0];
      await db.climateMonthly.upsert({
        where: {
          yearMonth_psId_source: { yearMonth: row.yearMonth, psId, source: SOURCE_TAG },
        },
        update: {
          radiationKwhM2,
          sourceRef: filename,
          metadata: {
            filename,
            sourceRow: row.sourceRow,
            radiationType: 'ISOLAR_PLANT_IRRADIATION_UNSPECIFIED',
            periodType: 'MONTHLY',
            originalUnit: 'Wh/m2',
            normalizedUnit: 'kWh/m2',
            conversionFactor: 0.001,
          },
          updatedAt: new Date(),
        },
        create: {
          yearMonth: row.yearMonth,
          psId,
          radiationKwhM2,
          source: SOURCE_TAG,
          sourceRef: filename,
          metadata: {
            filename,
            sourceRow: row.sourceRow,
            radiationType: 'ISOLAR_PLANT_IRRADIATION_UNSPECIFIED',
            periodType: 'MONTHLY',
            originalUnit: 'Wh/m2',
            normalizedUnit: 'kWh/m2',
            conversionFactor: 0.001,
          },
        },
      });
    }
    results.imported++;
  }
  return results;
}

/**
 * Import load consumption rows into LoadMonthly.
 */
export async function importLoadConsumption(parsedRows, nameIndex, { db = prisma, dryRun = false, filename = '' } = {}) {
  const results = { total: parsedRows.length, imported: 0, skippedNoPlant: 0, skippedNoValue: 0, errors: [] };

  for (const row of parsedRows) {
    const plant = resolvePlantByName(row.plantName, nameIndex);
    if (!plant) {
      results.skippedNoPlant++;
      results.errors.push({ row: row.sourceRow, plantName: row.plantName, error: 'Plant tidak ditemukan' });
      continue;
    }
    if (row.value === null) {
      results.skippedNoValue++;
      continue;
    }

    if (!dryRun) {
      const psId = plant.sungrowPsIds[0];
      await db.loadMonthly.upsert({
        where: {
          yearMonth_psId_source: { yearMonth: row.yearMonth, psId, source: SOURCE_TAG },
        },
        update: { loadKwh: row.value, metadata: { filename, sourceRow: row.sourceRow }, updatedAt: new Date() },
        create: {
          yearMonth: row.yearMonth,
          psId,
          loadKwh: row.value,
          source: SOURCE_TAG,
          sourceRef: filename,
          metadata: { filename, sourceRow: row.sourceRow },
        },
      });
    }
    results.imported++;
  }
  return results;
}

/**
 * Import yield rows into MonthlyYieldObservation.
 */
export async function importYield(parsedRows, nameIndex, { db = prisma, dryRun = false, filename = '' } = {}) {
  const results = { total: parsedRows.length, imported: 0, skippedNoPlant: 0, skippedNoValue: 0, errors: [] };

  for (const row of parsedRows) {
    const plant = resolvePlantByName(row.plantName, nameIndex);
    if (!plant) {
      results.skippedNoPlant++;
      results.errors.push({ row: row.sourceRow, plantName: row.plantName, error: 'Plant tidak ditemukan' });
      continue;
    }
    if (row.value === null) {
      results.skippedNoValue++;
      continue;
    }

    if (!dryRun) {
      const psId = plant.sungrowPsIds[0];
      await db.monthlyYieldObservation.upsert({
        where: {
          yearMonth_psId_measurementType_source: {
            yearMonth: row.yearMonth,
            psId,
            measurementType: 'MONTHLY_YIELD',
            source: SOURCE_TAG,
          },
        },
        update: {
          energyKwh: row.value,
          sourceFile: filename,
          sourceRow: row.sourceRow,
          qualityStatus: row.value > 0 ? 'FINAL' : 'ZERO',
          metadata: { filename, sourceRow: row.sourceRow },
          updatedAt: new Date(),
        },
        create: {
          yearMonth: row.yearMonth,
          psId,
          energyKwh: row.value,
          measurementType: 'MONTHLY_YIELD',
          source: SOURCE_TAG,
          sourceFile: filename,
          sourceRow: row.sourceRow,
          qualityStatus: row.value > 0 ? 'FINAL' : 'ZERO',
          metadata: { filename, sourceRow: row.sourceRow },
        },
      });
    }
    results.imported++;
  }
  return results;
}

/**
 * Main orchestrator: detect file type and route to the correct importer.
 */
export async function importIsolarAnnualReport(filePath, { db = prisma, dryRun = false } = {}) {
  const parsed = parseIsolarCsv(filePath);
  const nameIndex = await buildPlantNameIndex(db);
  const filename = parsed.filename;

  let result;
  switch (parsed.type) {
    case 'RADIATION':
      result = await importRadiation(parsed.rows, nameIndex, { db, dryRun, filename });
      break;
    case 'LOAD':
      result = await importLoadConsumption(parsed.rows, nameIndex, { db, dryRun, filename });
      break;
    case 'YIELD':
      result = await importYield(parsed.rows, nameIndex, { db, dryRun, filename });
      break;
    default:
      throw new Error(`Tipe file tidak didukung: ${parsed.type}`);
  }

  return { ...result, fileType: parsed.type, title: parsed.title, filename };
}
