import * as XLSX from 'xlsx';

import { filterCanonicalRows, parseScope2Query } from './analytics.js';
import { aggregateCanonicalRows } from './energyReconciliation.js';

function escapeFormula(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function rowsByGrid(rows) {
  return [...new Set(rows.map(row => row.grid))].sort().map(grid => {
    const group = rows.filter(row => row.grid === grid);
    const summary = aggregateCanonicalRows(group);
    return {
      grid,
      plant_count: new Set(group.map(row => row.psId)).size,
      purchased_mwh: summary.totalPurchasedKwh / 1_000,
      load_upper_bound_mwh: summary.loadUpperBoundEnergyKwh / 1_000,
      factor_kg_per_kwh: group[0]?.gridFactorKgPerKwh ?? null,
      factor_status: group[0]?.factorStatus ?? 'temporary',
      scope2_emission_ton: summary.scope2EmissionTon,
    };
  });
}

export function buildScope2ExportData(dashboard, searchParams) {
  const query = parseScope2Query(searchParams);
  const filtered = filterCanonicalRows(dashboard.canonicalRows, query);
  const rows = filtered.map(row => ({
    year_month: row.yearMonth,
    ps_id: row.psId,
    dc_name: row.dcName,
    grid: row.grid,
    connect_type: row.connectType,
    load_kwh: row.loadKwh,
    production_kwh: row.productionKwh,
    export_kwh: row.exportKwh,
    self_consumed_kwh: row.selfConsumedKwh,
    purchased_kwh: row.purchasedKwh,
    scope2_basis: row.scope2Basis,
    factor_kg_per_kwh: row.gridFactorKgPerKwh,
    factor_status: row.factorStatus,
    scope2_emission_ton: row.scope2EmissionTon,
    period_status: row.periodStatus,
    source: row.sourceRefs.join(' | '),
    flags: row.qualityFlags.join(' | '),
  }));
  const summaryAggregate = aggregateCanonicalRows(filtered);
  return {
    summary: {
      row_count: rows.length,
      plant_count: new Set(rows.map(row => row.ps_id)).size,
      total_load_kwh: rows.reduce((sum, row) => sum + (row.load_kwh || 0), 0),
      purchased_kwh_proven: summaryAggregate.totalPurchasedKwh,
      load_upper_bound_kwh: summaryAggregate.loadUpperBoundEnergyKwh,
      scope2_emission_ton: summaryAggregate.scope2EmissionTon,
      excluded_temporary_factor_kwh: summaryAggregate.excludedTemporaryFactorKwh,
    },
    rows,
    perGrid: rowsByGrid(filtered),
    parameters: {
      exported_at: new Date().toISOString(),
      period: query.period,
      month: query.month,
      from: query.from,
      to: query.to,
      grid: query.grid,
      dc: query.dc,
      search: query.q,
      tariff_rupiah_per_kwh: query.tariff,
      tariff_status: 'asumsi, perlu konfirmasi',
      scope2_basis: query.scope2Basis,
      method: 'Purchased bila self-consumption terbukti; selain itu load upper bound.',
      source_hashes: dashboard.reports.map(report => `${report.filename}:${report.hash}`).join(' | '),
    },
  };
}

export function buildScope2Csv(exported) {
  const safeRows = exported.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, escapeFormula(value)])));
  const sheet = XLSX.utils.json_to_sheet(safeRows);
  return `\uFEFF${XLSX.utils.sheet_to_csv(sheet, { FS: ',' })}`;
}

export function buildScope2Workbook(exported) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([exported.summary]), 'Ringkasan');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exported.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, escapeFormula(value)])))), 'Per DC-Bulan');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exported.perGrid), 'Per Grid');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(Object.entries(exported.parameters).map(([parameter, value]) => ({ parameter, value: escapeFormula(value) }))), 'Parameter');
  return workbook;
}

