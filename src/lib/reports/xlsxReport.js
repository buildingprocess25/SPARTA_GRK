import { addNativeCharts, EMU_PER_CM } from './xlsxCharts.js';

export const REPORT_COLORS = {
  genset: 'D97706',
  vehicle: 'EA580C',
  scope2: '2563EB',
  scope3: '6366F1',
  plts: '16A34A',
  water: '0D9488',
  net: '334155',
  pln: '64748B',
};

const STYLE = {
  ink: 'FF1F2A37',
  muted: 'FF6B7280',
  headerFill: 'FFEEF2F6',
  headerRule: 'FF9AA5B1',
  rowRule: 'FFE5E9EE',
  totalFill: 'FFF6F8FA',
};

const DEFAULT_ROW_HEIGHT_EMU = 15 * 12700;

// Headers already carry their unit, so the unit decides the cell format; key-value sheets use the row's Satuan instead.
const UNIT_FORMATS = [
  [/\(tCO2e\)|^tCO2e$/, '#,##0.000'],
  [/\(kgCO2e\)|^kgCO2e$/, '#,##0.00'],
  [/\(°C\)/, '0.0'],
  [/\(kWh\/m²\)/, '#,##0.00'],
  [/\(Rp\)|^Rupiah$|\(Rupiah\)/, '#,##0'],
  [/\(kWh\)|^kWh$/, '#,##0'],
  [/\(MWh\)|^MWh$/, '#,##0.00'],
  [/\(Liter\)|^Liter$/, '#,##0.0'],
  [/\(m³\)|^m³$/, '#,##0.0'],
  [/\(kWp\)/, '#,##0.00'],
  [/\(km\)/, '#,##0'],
  [/\(%\)|^%$/, '0.0%'],
  [/^Lokasi DC$|^Jumlah|^No$/, '#,##0'],
  [/Faktor|kgCO2e\//, '0.000#'],
];

function formatFor(label) {
  return UNIT_FORMATS.find(([pattern]) => pattern.test(label))?.[1] || null;
}

// Factors, ratios and row numbers are not quantities, so the total row leaves them empty.
const isSummable = (header) => /\((tCO2e|Rp|kWh|MWh|Liter|m³|kWp|km)\)|^Jumlah/.test(header);

const colLetter = (index) => {
  let n = index;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const sheetRef = (name, col, fromRow, toRow) => `'${name.replace(/'/g, "''")}'!$${colLetter(col)}$${fromRow}:$${colLetter(col)}$${toRow}`;

function textWidth(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value.toLocaleString('id-ID', { maximumFractionDigits: 3 }).length + 1;
  return String(value).length;
}

/**
 * Writes one table and returns where its columns and rows ended up, so charts can reference them.
 * @returns {{ headerRow: number, firstRow: number, lastRow: number, colOf: Map<string, number>, width: number }}
 */
function writeTable(ws, { rows, startRow, startCol, total, keyValue, title, formats = {} }) {
  // Explicit per-column formats win over the unit inferred from the header (e.g. a 0-100 "(%)" column).
  const fmtFor = (header) => (header in formats ? formats[header] : formatFor(header));
  let row = startRow;
  if (title) {
    const cell = ws.getCell(row, startCol);
    cell.value = title;
    cell.font = { bold: true, size: 11, color: { argb: STYLE.ink } };
    row += 1;
  }
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const colOf = new Map(headers.map((h, i) => [h, startCol + i]));
  const headerRow = row;

  headers.forEach((header, i) => {
    const cell = ws.getCell(headerRow, startCol + i);
    cell.value = header;
    cell.font = { bold: true, size: 10, color: { argb: STYLE.ink } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.headerFill } };
    cell.alignment = { vertical: 'middle', horizontal: i === 0 || !fmtFor(header) ? 'left' : 'right', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: STYLE.headerRule } } };
  });
  ws.getRow(headerRow).height = 30;

  rows.forEach((record, r) => {
    const rowNumber = headerRow + 1 + r;
    const unit = keyValue ? String(record.Satuan || '') : null;
    const emphasise = keyValue && /^Total/.test(String(record.Parameter || record.Indikator || record.Metrik || ''));
    headers.forEach((header, i) => {
      const cell = ws.getCell(rowNumber, startCol + i);
      let value = record[header] === '' ? null : record[header];
      const indented = typeof value === 'string' && /^\s+-\s/.test(value);
      if (indented) value = value.trim().replace(/^-\s*/, '');
      cell.value = value === undefined ? null : value;
      const numFmt = keyValue && header === 'Nilai' ? formatFor(unit) : fmtFor(header);
      if (typeof value === 'number' && numFmt) cell.numFmt = numFmt;
      cell.font = { size: 10, bold: emphasise, color: { argb: STYLE.ink } };
      cell.alignment = {
        vertical: 'top',
        wrapText: typeof value === 'string',
        horizontal: typeof value === 'number' ? 'right' : 'left',
        indent: indented ? 2 : 0,
      };
      cell.border = { bottom: { style: 'hair', color: { argb: STYLE.rowRule } } };
    });
  });

  let lastRow = headerRow + rows.length;
  if (total && rows.length) {
    lastRow += 1;
    headers.forEach((header, i) => {
      const col = startCol + i;
      const cell = ws.getCell(lastRow, col);
      if (i === 0) cell.value = 'Total';
      else if (isSummable(header) && rows.some((r) => typeof r[header] === 'number')) {
        const result = rows.reduce((s, r) => s + (typeof r[header] === 'number' ? r[header] : 0), 0);
        cell.value = { formula: `SUM(${colLetter(col)}${headerRow + 1}:${colLetter(col)}${headerRow + rows.length})`, result };
        cell.numFmt = fmtFor(header);
        cell.alignment = { horizontal: 'right' };
      }
      cell.font = { bold: true, size: 10, color: { argb: STYLE.ink } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.totalFill } };
      cell.border = { top: { style: 'thin', color: { argb: STYLE.headerRule } } };
    });
  }

  headers.forEach((header, i) => {
    const column = ws.getColumn(startCol + i);
    const numeric = Boolean(fmtFor(header)) && rows.some((r) => typeof r[header] === 'number');
    const longestWord = Math.max(...header.split(/\s+/).map((w) => w.length));
    const content = Math.max(0, ...rows.map((r) => textWidth(r[header])));
    const wanted = numeric
      ? Math.min(18, Math.max(11, content + 2, longestWord + 2))
      : Math.min(keyValue ? 60 : 46, Math.max(8, content + 2, longestWord + 2));
    column.width = Math.max(column.width || 0, wanted);
  });

  return { headerRow, firstRow: headerRow + 1, lastRow: headerRow + rows.length, totalRow: total ? lastRow : null, colOf, width: headers.length, endRow: lastRow };
}

function chartFromSpec(spec, table, sheetName) {
  const count = Math.min(spec.topN || Infinity, table.rows.length);
  const lastRow = table.firstRow + count - 1;
  const catCol = table.colOf.get(spec.categoryKey);
  const categories = {
    ref: sheetRef(sheetName, catCol, table.firstRow, lastRow),
    values: table.rows.slice(0, count).map((r) => String(r[spec.categoryKey] ?? '')),
  };
  const series = spec.series.map((s) => ({
    ...s,
    name: s.name || s.key,
    ref: sheetRef(sheetName, table.colOf.get(s.key), table.firstRow, lastRow),
    values: table.rows.slice(0, count).map((r) => r[s.key]),
  }));
  return { ...spec, categories, series };
}

/**
 * @param {{ reportName: string, company: string, periodLabel: string, sheets: object[] }} report
 * Each sheet: { name, title, notes?, rows, keyValue?, total?, formats?: { [header]: numFmt }, side?: [{ title, rows, total?, formats? }], charts?: [{ table: 'main'|number, type, title, categoryKey, series, ... }], chartsBelow? }
 */
export async function renderReportWorkbook(report) {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SPARTA Gas Rumah Kaca';
  workbook.created = new Date();
  const generatedOn = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const sheetCharts = [];

  for (const sheet of report.sheets) {
    const ws = workbook.addWorksheet(sheet.name, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
      properties: { defaultRowHeight: 15 },
    });

    ws.getCell(1, 1).value = sheet.title;
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: STYLE.ink } };
    ws.getCell(2, 1).value = `${report.company} · ${report.reportName} · Periode ${report.periodLabel} · Dibuat ${generatedOn}`;
    ws.getCell(2, 1).font = { size: 9, color: { argb: STYLE.muted } };
    (sheet.notes || []).forEach((note, i) => {
      ws.getCell(3 + i, 1).value = note;
      ws.getCell(3 + i, 1).font = { size: 9, italic: true, color: { argb: STYLE.muted } };
    });

    const mainStart = 4 + (sheet.notes?.length || 0);
    const main = writeTable(ws, { rows: sheet.rows, startRow: mainStart, startCol: 1, total: sheet.total, keyValue: sheet.keyValue, formats: sheet.formats });
    main.rows = sheet.rows;
    ws.views = [{ state: 'frozen', ySplit: main.headerRow, xSplit: 0 }];
    if (!sheet.keyValue && sheet.rows.length > 8) {
      ws.autoFilter = { from: { row: main.headerRow, column: 1 }, to: { row: main.headerRow, column: main.width } };
    }
    ws.pageSetup.printTitlesRow = `${main.headerRow}:${main.headerRow}`;

    // Short tables get their charts underneath; long lists keep them beside the table so they show without scrolling down.
    const below = sheet.chartsBelow ?? (sheet.rows.length <= 15 && !sheet.keyValue);
    const zoneCol = below ? 1 : main.width + 2;
    let zoneRow = below ? main.endRow + 3 : main.headerRow;

    const tables = [main];
    for (const side of sheet.side || []) {
      const placed = writeTable(ws, { rows: side.rows, startRow: zoneRow, startCol: zoneCol, total: side.total, title: side.title, formats: side.formats });
      placed.rows = side.rows;
      tables.push(placed);
      zoneRow = placed.endRow + 3;
    }

    const charts = (sheet.charts || []).map((spec) => {
      const table = spec.table === undefined || spec.table === 'main' ? main : tables[spec.table + 1];
      const chart = chartFromSpec(spec, table, sheet.name);
      const cx = Math.round((spec.widthCm || (spec.type === 'doughnut' ? 13 : 17)) * EMU_PER_CM);
      const cy = Math.round((spec.heightCm || (spec.type === 'doughnut' ? 8 : 9)) * EMU_PER_CM);
      chart.anchor = { col: zoneCol - 1, row: zoneRow - 1, cx, cy };
      zoneRow += Math.ceil(cy / DEFAULT_ROW_HEIGHT_EMU) + 2;
      return chart;
    });
    sheetCharts.push({ sheet: sheet.name, charts });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return addNativeCharts(buffer, sheetCharts);
}

/** Sorts by `key` (largest first, text values last) and renumbers the No column to match. */
export function rankRows(rows, key) {
  const score = (r) => (typeof r[key] === 'number' ? r[key] : -Infinity);
  return [...rows].sort((a, b) => score(b) - score(a)).map((r, i) => ('No' in r ? { ...r, No: i + 1 } : r));
}

export function downloadWorkbook(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
