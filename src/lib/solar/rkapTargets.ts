import fs from 'node:fs';
import crypto from 'node:crypto';

export const RKAP_TARGET_SOURCE = 'SUSTAINABILITY_DATA_OWNER';
export const RKAP_TARGET_SOURCE_REF = 'src/data/sustainabilityData.js#pltsTargetMatrix';

function extractObjectLiteral(source, exportName) {
  const marker = `export const ${exportName} =`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`${exportName} was not found in owner source`);
  const objectStart = source.indexOf('{', markerIndex + marker.length);
  if (objectStart < 0) throw new Error(`${exportName} does not contain an object literal`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(objectStart, index + 1);
  }
  throw new Error(`${exportName} object literal is not balanced`);
}

export function loadOwnerTargetMatrix() {
  const sourceUrl = new URL('../../data/sustainabilityData.js', import.meta.url);
  const source = fs.readFileSync(sourceUrl, 'utf8');
  const literal = extractObjectLiteral(source, 'pltsTargetMatrix');
  const matrix = Function(`"use strict"; return (${literal});`)();
  return {
    matrix,
    sourceHash: crypto.createHash('sha256').update(source).digest('hex'),
  };
}

export function buildTargetMonthlyRows(year = 2026) {
  const { matrix, sourceHash } = loadOwnerTargetMatrix();
  const configs = [
    ['prod_mwh', 'MWh', matrix.energyMwh.target],
    ['co2_t', 'tCO2e', matrix.co2Ton.target],
  ];
  return configs.flatMap(([metric, unit, values]) => values.map((value, index) => ({
    yearMonth: `${year}${String(index + 1).padStart(2, '0')}`,
    metric,
    value: Number(value),
    unit,
    source: RKAP_TARGET_SOURCE,
    sourceRef: RKAP_TARGET_SOURCE_REF,
    sourceHash,
    metadata: { monthLabel: matrix.months[index], ownerSource: true },
  })));
}

function factorStats(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const spreadPct = average === 0 ? Number.POSITIVE_INFINITY : (max - min) / average * 100;
  return { value: spreadPct <= 0.5 ? average : null, min, max, spreadPct, stable: spreadPct <= 0.5 };
}

export function deriveRkapFactors() {
  const { matrix } = loadOwnerTargetMatrix();
  const ratios = (values) => values.map((value, index) => Number(value) / Number(matrix.energyMwh.target[index]));
  return {
    co2KgPerKwh: factorStats(ratios(matrix.co2Ton.target)),
    coalTonPerMwh: factorStats(ratios(matrix.coalTon.target)),
    treePerMwh: factorStats(ratios(matrix.treePohon.target)),
    source: RKAP_TARGET_SOURCE_REF,
  };
}
