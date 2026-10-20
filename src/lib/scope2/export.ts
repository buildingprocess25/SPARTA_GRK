import * as XLSX from 'xlsx';

import { filterCanonicalRows, parseScope2Query } from './analytics.ts';
import { aggregateCanonicalRows } from './energyReconciliation.ts';
import { REPORT_COLORS, renderReportWorkbook } from '../reports/xlsxReport.ts';
import { kwhToMwh } from '../units.ts';

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

// Energy columns go out in MWh; ratio columns such as factor_kg_per_kwh keep their unit.
const ENERGY_KWH_KEY = /^(load|production|export|self_consumed|purchased)_kwh$/;

export function buildScope2Csv(exported) {
  const safeRows = exported.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => (
    ENERGY_KWH_KEY.test(key) ? [key.replace(/_kwh$/, '_mwh'), kwhToMwh(value)] : [key, escapeFormula(value)]
  ))));
  const sheet = XLSX.utils.json_to_sheet(safeRows);
  return `\uFEFF${XLSX.utils.sheet_to_csv(sheet, { FS: ',' })}`;
}

const PERIOD_STATUS_LABEL = { complete: 'Lengkap', partial: 'Sementara (bulan berjalan)' };
const FACTOR_STATUS_LABEL = { official: 'Resmi', temporary: 'Sementara' };
const clean = (value) => escapeFormula(value ?? null);

/** Report-ready workbook (titles, number formats, totals, native charts) with the same four sheets as before. */
export async function buildScope2WorkbookBytes(exported) {
  const s = exported.summary;
  const ringkasan = [
    { Parameter: 'Jumlah baris DC-bulan', Nilai: s.row_count, Satuan: 'Baris' },
    { Parameter: 'Jumlah plant', Nilai: s.plant_count, Satuan: 'Lokasi DC' },
    { Parameter: 'Total beban listrik', Nilai: kwhToMwh(s.total_load_kwh), Satuan: 'MWh' },
    { Parameter: 'Listrik dibeli PLN (terbukti)', Nilai: kwhToMwh(s.purchased_kwh_proven), Satuan: 'MWh' },
    { Parameter: 'Beban batas atas (tanpa bukti beli)', Nilai: kwhToMwh(s.load_upper_bound_kwh), Satuan: 'MWh' },
    { Parameter: 'Energi berfaktor sementara (tidak dihitung)', Nilai: kwhToMwh(s.excluded_temporary_factor_kwh), Satuan: 'MWh' },
    { Parameter: 'Total emisi Scope 2', Nilai: s.scope2_emission_ton, Satuan: 'tCO2e' },
  ];
  const months = new Map();
  for (const row of exported.rows) {
    const m = months.get(row.year_month) || { Bulan: row.year_month, 'Listrik dibeli PLN (MWh)': 0, 'Emisi Scope 2 (tCO2e)': 0, Status: PERIOD_STATUS_LABEL[row.period_status] || row.period_status };
    m['Listrik dibeli PLN (MWh)'] += (row.purchased_kwh || 0) / 1000;
    m['Emisi Scope 2 (tCO2e)'] += row.scope2_emission_ton || 0;
    if (row.period_status === 'partial') m.Status = PERIOD_STATUS_LABEL.partial;
    months.set(row.year_month, m);
  }
  const perBulan = [...months.values()].sort((a, b) => a.Bulan.localeCompare(b.Bulan));
  const perDcBulan = exported.rows.map(row => ({
    Bulan: row.year_month,
    'PS ID': row.ps_id,
    'Nama DC': clean(row.dc_name),
    Grid: clean(row.grid),
    'Beban (MWh)': kwhToMwh(row.load_kwh),
    'Produksi PLTS (MWh)': kwhToMwh(row.production_kwh),
    'Ekspor ke jaringan (MWh)': kwhToMwh(row.export_kwh),
    'PLTS dipakai sendiri (MWh)': kwhToMwh(row.self_consumed_kwh),
    'Listrik dibeli PLN (MWh)': kwhToMwh(row.purchased_kwh),
    'Basis Scope 2': clean(row.scope2_basis),
    'Faktor emisi (kgCO2e/kWh)': row.factor_kg_per_kwh,
    'Status faktor': FACTOR_STATUS_LABEL[row.factor_status] || clean(row.factor_status),
    'Emisi Scope 2 (tCO2e)': row.scope2_emission_ton,
    'Status periode': PERIOD_STATUS_LABEL[row.period_status] || clean(row.period_status),
    Sumber: clean(row.source),
    Catatan: clean(row.flags),
  }));
  const perGrid = [...exported.perGrid]
    .sort((a, b) => (b.scope2_emission_ton || 0) - (a.scope2_emission_ton || 0))
    .map(row => ({
      Grid: clean(row.grid),
      'Jumlah plant': row.plant_count,
      'Listrik dibeli PLN (MWh)': row.purchased_mwh,
      'Beban batas atas (MWh)': row.load_upper_bound_mwh,
      'Faktor emisi (kgCO2e/kWh)': row.factor_kg_per_kwh,
      'Status faktor': FACTOR_STATUS_LABEL[row.factor_status] || clean(row.factor_status),
      'Emisi Scope 2 (tCO2e)': row.scope2_emission_ton,
    }));
  const parameter = Object.entries(exported.parameters).map(([key, value]) => ({ Parameter: key, Nilai: clean(value) }));
  const p = exported.parameters;

  return renderReportWorkbook({
    reportName: 'Ekspor Scope 2 Listrik PLN',
    company: 'PT Sumber Alfaria Trijaya Tbk',
    periodLabel: p.period === 'month' && p.month ? p.month : p.from && p.to ? `${p.from} s.d. ${p.to}` : String(p.period || 'YTD').toUpperCase(),
    sheets: [
      {
        name: 'Ringkasan', title: 'Ringkasan emisi Scope 2', rows: ringkasan, keyValue: true,
        side: [{ title: 'Emisi per bulan', rows: perBulan, total: true }],
        charts: [{ table: 0, type: 'column', title: 'Emisi Scope 2 per bulan (tCO2e)', categoryKey: 'Bulan', series: [{ key: 'Emisi Scope 2 (tCO2e)', name: 'Emisi (tCO2e)', color: REPORT_COLORS.scope2 }] }],
      },
      {
        name: 'Per DC-Bulan', title: 'Rincian per DC per bulan', rows: perDcBulan, total: true,
        notes: ['Status "Sementara" berarti angka bulan berjalan dari API iSolarCloud, sebelum laporan bulanan resmi diimpor.'],
      },
      {
        name: 'Per Grid', title: 'Emisi Scope 2 per sistem grid', rows: perGrid, total: true,
        charts: [{ type: 'bar', title: 'Emisi Scope 2 per grid (tCO2e)', categoryKey: 'Grid', series: [{ key: 'Emisi Scope 2 (tCO2e)', name: 'Emisi (tCO2e)', color: REPORT_COLORS.scope2 }] }],
      },
      { name: 'Parameter', title: 'Parameter ekspor', rows: parameter },
    ],
  });
}
