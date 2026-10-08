import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import XLSX from 'xlsx';

import { buildScope2CanonicalDashboard } from '../../src/lib/scope2/dashboardService.js';
import { CANONICAL_DC_ENTITIES, isDcLocation } from '../../src/lib/solar/plantMap.js';
import { calculateWeightedPr } from '../../src/lib/solar/dashboard.js';
import { parseIsolarMonthlyReportFile } from '../../src/lib/importers/isolarMonthlyReport.js';
import { getGridFactor } from '../../src/lib/emission-factors.js';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'docs', 'compare-tmp');
const monthFiles = [
  ['01', 'Monitor PLTS 2026 (3)-JAN 2026.csv'],
  ['02', 'Monitor PLTS 2026 (3)-FEB 2026.csv'],
  ['03', 'Monitor PLTS 2026 (3)-MAR 2026.csv'],
  ['04', 'Monitor PLTS 2026 (3)-APRIL 2026.csv'],
  ['05', 'Monitor PLTS 2026 (3)-MEI 2026.csv'],
  ['06', 'Monitor PLTS 2026 (3)-JUNI 2026.csv'],
  ['07', 'Monitor PLTS 2026 (3)-JULI 2026.csv'],
  ['08', 'Monitor PLTS 2026 (3)-AGUS 2026.csv'],
  ['09', 'Monitor PLTS 2026 (3)-SEP 2026.csv'],
];
const allMentorFiles = fs.readdirSync(root).filter(name => /^Monitor PLTS 2026 \(3\)-.*\.csv$/i.test(name)).sort();

function sheetRows(filename) {
  const book = XLSX.readFile(path.join(root, filename), { raw: true, cellDates: false });
  return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: false, defval: null });
}

function num(value) {
  if (value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '-') return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 6) {
  return value === null || value === undefined ? null : Number(Number(value).toFixed(digits));
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filename, rows) {
  fs.writeFileSync(path.join(outDir, filename), rows.map(row => row.map(csvEscape).join(',')).join('\r\n') + '\r\n');
}

function status(csvValue, dashboardValue) {
  if (csvValue === null || dashboardValue === null) return 'TIDAK_DAPAT_DIBANDINGKAN';
  const diff = dashboardValue - csvValue;
  if (Math.abs(diff) < 0.0000005) return 'COCOK_PERSIS';
  const pct = csvValue === 0 ? null : Math.abs(diff / csvValue) * 100;
  return pct !== null && pct <= 0.5 ? 'SELISIH_KECIL_<=0.5%' : 'SELISIH_MATERIAL_>0.5%';
}

function fileProfile(filename) {
  const buffer = fs.readFileSync(path.join(root, filename));
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const rows = sheetRows(filename);
  const nonEmptyRows = rows.filter(row => row.some(cell => cell !== null && String(cell).trim() !== ''));
  const firstNonEmpty = nonEmptyRows[0] || [];
  const delimiterCounts = { comma: (text.split(/\r?\n/)[0].match(/,/g) || []).length, semicolon: (text.split(/\r?\n/)[0].match(/;/g) || []).length, tab: (text.split(/\r?\n/)[0].match(/\t/g) || []).length };
  const flat = rows.flat().filter(cell => cell !== null).map(String);
  return {
    filename,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    encoding: buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) ? 'UTF-8 BOM' : 'UTF-8 (valid/assumed)',
    delimiter: delimiterCounts.comma >= delimiterCounts.semicolon && delimiterCounts.comma >= delimiterCounts.tab ? ',' : (delimiterCounts.semicolon >= delimiterCounts.tab ? ';' : 'TAB'),
    rowCount: rows.length,
    nonEmptyRowCount: nonEmptyRows.length,
    maxColumnCount: Math.max(0, ...rows.map(row => row.length)),
    firstNonEmptyRow: firstNonEmpty,
    formulaLikeCellCount: flat.filter(value => value.trim().startsWith('=')).length,
    spreadsheetErrorCellCount: flat.filter(value => /^#(REF!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|NULL!)/i.test(value.trim())).length,
  };
}

const dashboard = buildScope2CanonicalDashboard({ rootDir: root, now: new Date('2026-10-08T00:00:00+07:00') });
const dashboardRows = dashboard.canonicalRows.filter(row => row.yearMonth <= '2026-09');
const byKey = new Map(dashboardRows.map(row => [`${row.yearMonth}|${row.dcName}`, row]));
const mentorRows = [];
const monthlyIntegrity = [];

for (const [month, filename] of monthFiles) {
  const rows = sheetRows(filename);
  const headers = rows[0].map(value => String(value ?? '').trim());
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  const data = rows.slice(1).filter(row => row[0] !== null && String(row[0]).trim() !== '');
  const physical = data.slice(0, 39);
  const derived = data.slice(39);
  let identityProduction = 0;
  let identityLoad = 0;
  for (const row of physical) {
    const name = String(row[indexes['Plant name']]).trim();
    const monthlyYieldMwh = num(row[indexes['Monthly yield(MWh)']]);
    const purchasedMwh = num(row[indexes['Energy purchased this month(MWh)']]);
    const exportMwh = num(row[indexes['Monthly feed-in(MWh)']]);
    const loadMwh = num(row[indexes['Monthly load consumption(MWh)']]);
    const explicitProduction = indexes['Total Produksi'] === undefined ? null : num(row[indexes['Total Produksi']]);
    const productionMwh = monthlyYieldMwh;
    const selfMwh = monthlyYieldMwh === null || exportMwh === null ? null : monthlyYieldMwh - exportMwh;
    // The mentor's "Total Produksi" is a derived column that adds feed-in to yield,
    // even though vendor yield already includes feed-in. Count this as a semantic
    // identity issue against the canonical production = self-use + export model.
    if (explicitProduction !== null && productionMwh !== null && Math.abs(explicitProduction - productionMwh) > 0.00002) identityProduction++;
    if ([loadMwh, purchasedMwh, selfMwh].every(v => v !== null) && Math.abs(loadMwh - purchasedMwh - selfMwh) > 0.00002) identityLoad++;
    mentorRows.push({ filename, yearMonth: `2026-${month}`, name, monthlyYieldMwh, selfMwh, purchasedMwh, exportMwh, loadMwh, productionMwh, explicitProduction });
  }
  monthlyIntegrity.push({ filename, headers, physicalRowCount: physical.length, derivedRowCount: derived.length, derivedNames: derived.map(row => row[0]), productionIdentityViolations: identityProduction, loadIdentityViolations: identityLoad });
}

const compareHeader = [
  'year_month','dc_name','metric','unit','csv_value','dashboard_value','difference_dashboard_minus_csv','difference_pct_of_csv','status','csv_source','dashboard_source','notes'
];
const compareRows = [];
const metrics = [
  ['production', 'MWh', 'productionMwh', 'productionKwh'],
  ['self_consumption', 'MWh', 'selfMwh', 'selfConsumedKwh'],
  ['export', 'MWh', 'exportMwh', 'exportKwh'],
  ['purchased_pln', 'MWh', 'purchasedMwh', 'purchasedKwh'],
  ['load', 'MWh', 'loadMwh', 'loadKwh'],
];
for (const mentor of mentorRows.filter(row => !row.name.startsWith('Tk. Drive Thru'))) {
  const dash = byKey.get(`${mentor.yearMonth}|${mentor.name}`);
  for (const [metric, unit, csvField, dashField] of metrics) {
    const csvValue = mentor[csvField];
    const dashboardValue = dash && dash[dashField] !== null ? dash[dashField] / 1000 : null;
    const diff = csvValue !== null && dashboardValue !== null ? dashboardValue - csvValue : null;
    const pct = diff !== null && csvValue !== 0 ? diff / csvValue * 100 : null;
    compareRows.push([
      mentor.yearMonth, mentor.name, metric, unit, round(csvValue), round(dashboardValue), round(diff), round(pct), status(csvValue, dashboardValue),
      `${mentor.filename}: ${csvField}`, dash ? dash.sourceRefs.join(' + ') : 'tidak ditemukan',
      dash ? '' : 'Baris dashboard tidak ditemukan',
    ]);
  }
}
writeCsv('per-dc-month-comparison.csv', [compareHeader, ...compareRows]);

const statusCounts = Object.fromEntries([...new Set(compareRows.map(row => row[8]))].map(key => [key, compareRows.filter(row => row[8] === key).length]));
const material = compareRows.filter(row => row[8] === 'SELISIH_MATERIAL_>0.5%').sort((a, b) => Math.abs(b[6] ?? 0) - Math.abs(a[6] ?? 0));
const top20Differences = compareRows.filter(row => row[8] !== 'COCOK_PERSIS').sort((a, b) => Math.abs(b[6] ?? 0) - Math.abs(a[6] ?? 0)).slice(0, 20);

const monthlyComparison = monthFiles.map(([month, filename]) => {
  const csv = mentorRows.filter(row => row.yearMonth === `2026-${month}` && !row.name.startsWith('Tk. Drive Thru'));
  const dash = dashboardRows.filter(row => row.yearMonth === `2026-${month}`);
  const result = { yearMonth: `2026-${month}`, csvSource: filename };
  for (const [metric,, csvField, dashField] of metrics) {
    const csvValue = csv.reduce((sum, row) => sum + (row[csvField] ?? 0), 0);
    const dashboardValue = dash.reduce((sum, row) => sum + (row[dashField] ?? 0), 0) / 1000;
    result[metric] = { csvMwh: round(csvValue), dashboardMwh: round(dashboardValue), differenceMwh: round(dashboardValue - csvValue), differencePct: csvValue ? round((dashboardValue - csvValue) / csvValue * 100) : null, status: status(csvValue, dashboardValue) };
  }
  return result;
});

const ytdComparison = {};
for (const [metric,, csvField, dashField] of metrics) {
  const csvValue = mentorRows.filter(row => !row.name.startsWith('Tk. Drive Thru')).reduce((sum, row) => sum + (row[csvField] ?? 0), 0);
  const dashboardValue = dashboardRows.reduce((sum, row) => sum + (row[dashField] ?? 0), 0) / 1000;
  ytdComparison[metric] = { csvMwh: round(csvValue), dashboardMwh: round(dashboardValue), differenceMwh: round(dashboardValue - csvValue), differencePct: csvValue ? round((dashboardValue - csvValue) / csvValue * 100) : null, status: status(csvValue, dashboardValue) };
}

const capacityEntities = CANONICAL_DC_ENTITIES.filter(isDcLocation);
const capacity = {
  dashboardKwp: round(capacityEntities.reduce((sum, entity) => sum + entity.apiInstalledKwp, 0), 2),
  plantCount: capacityEntities.length,
  mentorMonthsWithCapacity: {},
};
for (const [month, filename] of monthFiles.filter(([month]) => ['05','06','07'].includes(month))) {
  const rows = sheetRows(filename);
  const capacityIndex = rows[0].findIndex(value => String(value ?? '').trim() === 'Kapasitas');
  const physical = rows.slice(1, 40).filter(row => !String(row[0] ?? '').startsWith('Tk. Drive Thru'));
  capacity.mentorMonthsWithCapacity[`2026-${month}`] = { filename, capacityIndex, sumKwp: round(physical.reduce((sum, row) => sum + (num(row[capacityIndex]) ?? 0), 0), 2), nonNumericCount: physical.filter(row => num(row[capacityIndex]) === null).length };
}

const productionReportFile = fs.readdirSync(root).find(name => /^Monthly Report_Annual report_20261001111530\.csv$/.test(name));
const productionReport = parseIsolarMonthlyReportFile(path.join(root, productionReportFile), { filename: productionReportFile });
const dcIds = new Set(CANONICAL_DC_ENTITIES.filter(isDcLocation).map(entity => entity.dcId));
const rawRecords = productionReport.records.filter(row => row.status === 'VALID' && row.yearMonth <= '2026-09' && dcIds.has(row.dcId));
const prMonthly = [];
for (let month = 1; month <= 9; month++) {
  const ym = `2026-${String(month).padStart(2, '0')}`;
  const inputs = rawRecords.filter(row => row.yearMonth === ym).map(row => ({ plantId: row.dcId, yearMonth: ym, energyKwh: row.energyKwh, capacityKwp: row.installedKwp, radiationKwhM2: row.radiationKwhM2, isOperational: true }));
  prMonthly.push({ yearMonth: ym, dashboardAlgorithm: calculateWeightedPr(inputs), vendorOfficialAveragePct: round(inputs.reduce((sum, _, index) => sum + (rawRecords.filter(row => row.yearMonth === ym)[index]?.prPercentOfficial ?? 0), 0) / Math.max(1, inputs.filter((_, index) => rawRecords.filter(row => row.yearMonth === ym)[index]?.prPercentOfficial !== null).length), 6) });
}
const prYtd = calculateWeightedPr(rawRecords.map(row => ({ plantId: row.dcId, yearMonth: row.yearMonth, energyKwh: row.energyKwh, capacityKwp: row.installedKwp, radiationKwhM2: row.radiationKwhM2, isOperational: true })));

const resume = sheetRows('Monitor PLTS 2026 (3)-Resume.csv');
const resumeEvidence = {
  originalTargetProductionMonthlyMwh: resume[3].slice(2, 14).map(num),
  originalTargetProductionEoyMwh: num(resume[3][15]),
  productionAchievementMonthlyAll39Mwh: resume[4].slice(2, 14).map(num),
  productionAchievementYtdAll39Mwh: num(resume[4][14]),
  co2AchievementMonthlyAll39Ton: resume[9].slice(2, 14).map(num),
  co2AchievementYtdAll39Ton: num(resume[9][14]),
  coalAchievementMonthlyAll39Ton: resume[15].slice(2, 14).map(num),
  coalAchievementYtdAll39Ton: num(resume[15][14]),
  treeAchievementMonthlyAll39: resume[20].slice(2, 14).map(num),
  treeAchievementYtdAll39: num(resume[20][14]),
};

const officialPltsAvoidedTon = dashboardRows.reduce((sum, row) => {
  const factor = getGridFactor(row.grid);
  return sum + (factor?.status === 'resmi' ? row.selfConsumedKwh * factor.cmPlts / 1000 : 0);
}, 0);
const excludedTemporaryPltsKwh = dashboardRows.reduce((sum, row) => {
  const factor = getGridFactor(row.grid);
  return sum + (factor?.status !== 'resmi' ? row.selfConsumedKwh : 0);
}, 0);
const banjarmasinRows = dashboardRows.filter(row => row.dcName === 'Banjarmasin');
const banjarmasinPurchasedKwh = banjarmasinRows.reduce((sum, row) => sum + row.purchasedKwh, 0);
const dashboardDerived = {
  productionMwh: ytdComparison.production.dashboardMwh,
  selfConsumptionMwh: ytdComparison.self_consumption.dashboardMwh,
  avoidedEmissionTonRegionalOfficialOnly: round(officialPltsAvoidedTon, 6),
  excludedTemporaryPltsSelfConsumptionKwh: round(excludedTemporaryPltsKwh, 2),
  coalAvoidedTonCurrentPageFormula: round(ytdComparison.self_consumption.dashboardMwh * 0.400, 1),
  treeCountCurrentPageFormula: Math.round((officialPltsAvoidedTon * 1000) / 21.77),
  scope2EmissionCurrentTon: dashboard.completeSummary.scope2EmissionTon,
  scope2MissingBanjarmasinPurchasedMwh: round(banjarmasinPurchasedKwh / 1000, 6),
  scope2EmissionIfKalseltengFactor12AppliedTon: round(dashboard.completeSummary.scope2EmissionTon + banjarmasinPurchasedKwh * 1.2 / 1000, 6),
  targetEoyMwhFallback: 5858,
  targetYtdMwhJanSep: resumeEvidence.originalTargetProductionMonthlyMwh.slice(0, 9).reduce((sum, value) => sum + value, 0),
};

const extraEvidence = {};
for (const filename of allMentorFiles.filter(name => !monthFiles.some(([, monthly]) => monthly === name))) {
  const rows = sheetRows(filename);
  extraEvidence[filename] = { nonEmptyRows: rows.filter(row => row.some(cell => cell !== null && String(cell).trim() !== '')).length, maxColumns: Math.max(...rows.map(row => row.length)), notes: [] };
}
extraEvidence['Monitor PLTS 2026 (3)-COMPARASI FEB.csv'].notes.push('Kolom Produksi Feb-2026 cocok dengan Monthly yield + feed-in (total produksi) per plant; iradiasi bersumber dari laporan vendor.');
extraEvidence['Monitor PLTS 2026 (3)-2025 vs 2026.csv'].notes.push('Blok per cabang: load, self-consumption, feed-in, purchase; kolom TOTAL PRODUKSI adalah self-consumption + feed-in.');
extraEvidence['Monitor PLTS 2026 (3)-Radiasi.csv'].notes.push('Ringkasan rata-rata radiasi 2026 hanya terisi Januari-Maret; tidak memadai untuk validasi PR April-September.');
extraEvidence['Monitor PLTS 2026 (3)-Rekap Corporate Reputation.csv'].notes.push('Matriks bulanan mengulang load, self-consumption, feed-in, purchase dari CSV bulanan.');

const evidence = {
  generatedAt: new Date().toISOString(),
  comparisonScope: '2026-01 through 2026-09 complete months; 37 DC, excluding two Drive Thru stores',
  fileProfiles: allMentorFiles.map(fileProfile),
  monthlyIntegrity,
  compareRowCount: compareRows.length,
  statusCounts,
  materialTop20: material.slice(0, 20).map(row => Object.fromEntries(compareHeader.map((header, index) => [header, row[index]]))),
  top20Differences: top20Differences.map(row => Object.fromEntries(compareHeader.map((header, index) => [header, row[index]]))),
  monthlyComparison,
  ytdComparison,
  capacity,
  dashboardScope2: { summaryIncludingOctoberPartial: dashboard.summary, completeSummaryJanSep: dashboard.completeSummary, partialSummaryOctober: dashboard.partialSummary, coverage: dashboard.coverage, reports: dashboard.reports },
  prMonthly,
  prYtd,
  resumeEvidence,
  dashboardDerived,
  extraEvidence,
};
fs.writeFileSync(path.join(outDir, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ compareRowCount: compareRows.length, statusCounts, ytdComparison, capacity, dashboardDerived }, null, 2));
