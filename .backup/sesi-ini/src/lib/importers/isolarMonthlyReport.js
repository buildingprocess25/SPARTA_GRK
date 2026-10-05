import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { CANONICAL_DC_ENTITIES, normalizeName } from '../solar/plantMap.js';

export const EXPECTED_HEADERS = Object.freeze([
  'Plant name',
  'Time',
  'Installed power(kWp)',
  'Monthly yield(kWh)',
  'Monthly load consumption(kWh)',
  'Energy purchased this month(kWh)',
  'Monthly feed-in(kWh)',
  'PR(%)',
  'Plant monthly irradiation(Wh/㎡)',
]);

const MISSING_MARKERS = new Set(['', '--']);

function decodeUtf8(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return {
      text: decoded.replace(/^\uFEFF/, ''),
      encoding: hasBom ? 'UTF-8 BOM' : 'UTF-8',
      hasBom,
    };
  } catch (error) {
    throw new Error(`File is not valid UTF-8: ${error.message}`);
  }
}

function parseCsvLine(line, delimiter = ',') {
  const fields = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      fields.push(value);
      value = '';
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error('Malformed CSV row: unterminated quoted field');
  fields.push(value);
  return fields;
}

function detectDelimiter(headerLine) {
  const candidates = [',', ';', '\t'];
  const ranked = candidates
    .map(delimiter => ({ delimiter, count: parseCsvLine(headerLine, delimiter).length }))
    .sort((a, b) => b.count - a.count);
  return ranked[0].count > 1 ? ranked[0].delimiter : null;
}

function resolvePlant(rawName, registry) {
  const normalized = normalizeName(rawName);
  const matches = registry.filter(entity => {
    if (normalizeName(entity.canonicalName) === normalized) return true;
    return (entity.aliases || []).some(alias => normalizeName(alias) === normalized);
  });

  if (matches.length === 0) {
    return { error: { code: 'UNKNOWN_PLANT', message: `Unknown plant name: ${rawName}` } };
  }
  if (matches.length > 1) {
    return { error: { code: 'AMBIGUOUS_PLANT', message: `Ambiguous plant name: ${rawName}` } };
  }

  const entity = matches[0];
  if (!Array.isArray(entity.sungrowPsIds) || entity.sungrowPsIds.length !== 1) {
    return { error: { code: 'AMBIGUOUS_PLANT_ID', message: `Plant must resolve to one physical ps_id: ${rawName}` } };
  }

  return {
    plant: {
      rawName,
      dcId: entity.dcId,
      canonicalName: entity.canonicalName,
      psId: Number(entity.sungrowPsIds[0]),
      apiInstalledKwp: Number(entity.apiInstalledKwp),
      region: entity.region || null,
      grid: entity.grid || null,
    },
  };
}

function rounded(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function optionalNumber(value, divisor = 1) {
  const normalized = String(value ?? '').trim();
  if (MISSING_MARKERS.has(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed / divisor : null;
}

export function parseIsolarMonthlyReport(input, {
  filename = 'isolar-monthly-report.csv',
  sourcePath = null,
  registry = CANONICAL_DC_ENTITIES,
} = {}) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const { text, encoding, hasBom } = decodeUtf8(buffer);
  const lineEnding = text.includes('\r\n') ? 'CRLF' : 'LF';
  const lines = text.split(/\r?\n/);
  while (lines.length > 0 && lines.at(-1) === '') lines.pop();

  if (lines.length < 2) throw new Error('Report must contain metadata and header rows');

  const metadataLine = lines[0].trim();
  const metadataMatch = /^Monthly Report_Year_(\d{4})$/.exec(metadataLine);
  if (!metadataMatch) throw new Error(`Invalid report metadata row: ${metadataLine}`);
  const reportYear = Number(metadataMatch[1]);

  const delimiter = detectDelimiter(lines[1]);
  if (delimiter !== ',') {
    throw new Error(`Unsupported CSV delimiter or header; expected comma, detected ${JSON.stringify(delimiter)}`);
  }

  const headers = parseCsvLine(lines[1], delimiter).map(value => value.trim());
  if (headers.length !== EXPECTED_HEADERS.length || headers.some((value, index) => value !== EXPECTED_HEADERS[index])) {
    throw new Error(`Unexpected report header or energy unit: ${headers.join(' | ')}`);
  }

  const records = [];
  const problems = [];
  const warnings = [];
  const mappedPlants = new Map();
  const seenPlantPeriods = new Set();

  for (let offset = 2; offset < lines.length; offset += 1) {
    const lineNumber = offset + 1;
    const rawLine = lines[offset];
    if (rawLine.trim() === '') continue;

    let cells;
    try {
      cells = parseCsvLine(rawLine, delimiter);
    } catch (error) {
      const problem = { lineNumber, code: 'MALFORMED_CSV', message: error.message };
      problems.push(problem);
      records.push({ lineNumber, status: 'ERROR', energyKwh: null, problem });
      continue;
    }

    if (cells.length !== EXPECTED_HEADERS.length) {
      const problem = { lineNumber, code: 'COLUMN_COUNT', message: `Expected 9 columns, found ${cells.length}` };
      problems.push(problem);
      records.push({ lineNumber, status: 'ERROR', energyKwh: null, problem });
      continue;
    }

    const plantNameRaw = cells[0].trim();
    const yearMonth = cells[1].trim();
    const installedRaw = cells[2].trim();
    const energyRaw = cells[3].trim();
    const baseRecord = {
      lineNumber,
      plantNameRaw,
      yearMonth,
      storageYearMonth: yearMonth.replace('-', ''),
      installedKwp: null,
      energyKwh: null,
      loadKwh: optionalNumber(cells[4]),
      purchasedEnergyKwh: optionalNumber(cells[5]),
      feedInKwh: optionalNumber(cells[6]),
      prPercentOfficial: optionalNumber(cells[7]),
      radiationWhM2: optionalNumber(cells[8]),
      radiationKwhM2: optionalNumber(cells[8], 1000),
      measurementType: 'MONTHLY_YIELD',
      energyUnit: 'kWh',
      raw: Object.fromEntries(EXPECTED_HEADERS.map((header, index) => [header, cells[index]])),
    };

    const periodMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth);
    if (!periodMatch) {
      const problem = { lineNumber, code: 'INVALID_PERIOD', message: `Invalid monthly period: ${yearMonth}` };
      problems.push(problem);
      records.push({ ...baseRecord, status: 'ERROR', problem });
      continue;
    }
    if (Number(periodMatch[1]) !== reportYear) {
      const problem = { lineNumber, code: 'PERIOD_YEAR_MISMATCH', message: `Period ${yearMonth} does not match report year ${reportYear}` };
      problems.push(problem);
      records.push({ ...baseRecord, status: 'ERROR', problem });
      continue;
    }

    const installedKwp = Number(installedRaw);
    if (!Number.isFinite(installedKwp) || installedKwp < 0) {
      const problem = { lineNumber, code: 'INVALID_CAPACITY', message: `Invalid installed power: ${installedRaw}` };
      problems.push(problem);
      records.push({ ...baseRecord, status: 'ERROR', problem });
      continue;
    }
    baseRecord.installedKwp = installedKwp;

    const resolved = resolvePlant(plantNameRaw, registry);
    if (resolved.error) {
      const problem = { lineNumber, ...resolved.error };
      problems.push(problem);
      records.push({ ...baseRecord, status: 'ERROR', problem });
      continue;
    }
    const plant = resolved.plant;
    Object.assign(baseRecord, {
      dcId: plant.dcId,
      canonicalName: plant.canonicalName,
      psId: plant.psId,
      grid: plant.grid,
      region: plant.region,
    });
    mappedPlants.set(plant.psId, plant);

    if (Math.abs(installedKwp - plant.apiInstalledKwp) > 0.001) {
      warnings.push({
        lineNumber,
        code: 'CAPACITY_MISMATCH',
        plantNameRaw,
        reportKwp: installedKwp,
        masterKwp: plant.apiInstalledKwp,
      });
    }

    const identity = `${baseRecord.storageYearMonth}|${plant.psId}`;
    if (seenPlantPeriods.has(identity)) {
      const problem = { lineNumber, code: 'DUPLICATE_PLANT_PERIOD', message: `Duplicate measurement for ${plantNameRaw} ${yearMonth}` };
      problems.push(problem);
      records.push({ ...baseRecord, status: 'ERROR', problem });
      continue;
    }
    seenPlantPeriods.add(identity);

    if (MISSING_MARKERS.has(energyRaw)) {
      records.push({ ...baseRecord, status: 'MISSING' });
      continue;
    }

    const energyKwh = Number(energyRaw);
    if (!Number.isFinite(energyKwh) || energyKwh < 0) {
      const problem = { lineNumber, code: 'INVALID_ENERGY', message: `Invalid monthly yield: ${energyRaw}` };
      problems.push(problem);
      records.push({ ...baseRecord, status: 'ERROR', problem });
      continue;
    }

    records.push({ ...baseRecord, energyKwh, status: 'VALID' });
  }

  const validRecords = records.filter(record => record.status === 'VALID');
  const missingRecords = records.filter(record => record.status === 'MISSING');
  const errorRecords = records.filter(record => record.status === 'ERROR');
  const periodValues = records
    .map(record => record.yearMonth)
    .filter(value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    .sort();

  const totalsByMonth = {};
  const totalsByPlant = {};
  for (const record of validRecords) {
    totalsByMonth[record.yearMonth] = rounded((totalsByMonth[record.yearMonth] || 0) + record.energyKwh);
    totalsByPlant[record.plantNameRaw] = rounded((totalsByPlant[record.plantNameRaw] || 0) + record.energyKwh);
  }

  return {
    filename: path.basename(filename),
    sourcePath,
    hash: crypto.createHash('sha256').update(buffer).digest('hex'),
    encoding,
    hasBom,
    delimiter,
    lineEnding,
    metadataLine,
    headerLineNumber: 2,
    headers,
    reportYear,
    period: {
      start: periodValues[0] || null,
      end: periodValues.at(-1) || null,
    },
    measurement: 'MONTHLY_YIELD',
    energyUnit: 'kWh',
    granularity: 'MONTHLY',
    hasAnnualTotal: false,
    dataRowCount: records.length,
    records,
    plants: [...mappedPlants.values()].map(plant => ({ ...plant })),
    problems,
    warnings,
    totalsByMonth,
    totalsByPlant,
    summary: {
      validCount: validRecords.length,
      missingCount: missingRecords.length,
      errorCount: errorRecords.length,
      totalEnergyKwh: rounded(validRecords.reduce((sum, record) => sum + record.energyKwh, 0)),
    },
  };
}

export function parseIsolarMonthlyReportFile(filePath, options = {}) {
  const resolved = path.resolve(filePath);
  const buffer = fs.readFileSync(resolved);
  return parseIsolarMonthlyReport(buffer, {
    ...options,
    filename: options.filename || path.basename(resolved),
    sourcePath: resolved,
  });
}
