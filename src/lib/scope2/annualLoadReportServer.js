import fs from 'node:fs';
import path from 'node:path';

import { CARBON_FACTORS } from '../carbon/carbonEngine.js';
import { CANONICAL_DC_ENTITIES, normalizeName } from '../solar/plantMap.js';
import { buildScope2AnnualLoadDashboard, parseAnnualLoadReport } from './annualLoadReport.js';

const REPORT_NAME_PATTERN = /^monthly load consump_Annual report_.*\.csv$/i;

function findPlant(plantName) {
  const normalized = normalizeName(plantName);
  return CANONICAL_DC_ENTITIES.find(entity =>
    normalizeName(entity.canonicalName) === normalized
    || (entity.aliases || []).some(alias => normalizeName(alias) === normalized),
  );
}

function emissionFactorForPlant(plantName) {
  const plant = findPlant(plantName);
  return CARBON_FACTORS.GRID[plant?.grid]?.factor
    ?? CARBON_FACTORS.GRID.NATIONAL_DEFAULT.factor;
}

function getWibYearMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  return {
    year: Number(parts.find(part => part.type === 'year')?.value),
    month: Number(parts.find(part => part.type === 'month')?.value),
  };
}

export function loadScope2AnnualLoadDashboard({ rootDir = process.cwd(), now = new Date() } = {}) {
  const filenames = fs.readdirSync(rootDir).filter(filename => REPORT_NAME_PATTERN.test(filename));
  if (filenames.length !== 2) {
    throw new Error(`Expected exactly two monthly load annual reports, found ${filenames.length}`);
  }

  const reports = filenames.map(filename => parseAnnualLoadReport(
    fs.readFileSync(path.join(rootDir, filename)),
    { filename },
  ));
  const years = reports.map(report => report.reportYear).sort();
  if (new Set(years).size !== 2 || years[0] !== 2025 || years[1] !== 2026) {
    throw new Error(`Expected annual reports for 2025 and 2026, found ${years.join(', ')}`);
  }

  const wib = getWibYearMonth(now);
  const currentYear = 2026;
  const currentMonth = wib.year === currentYear ? wib.month : 12;
  return buildScope2AnnualLoadDashboard({
    reports,
    currentYear,
    currentMonth,
    emissionFactorForPlant,
    tariffPerKwh: CARBON_FACTORS.TARIFFS.ELECTRICITY_PLN_PER_KWH,
  });
}

