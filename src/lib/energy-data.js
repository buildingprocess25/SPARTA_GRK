/**
 * Single Source of Truth - Shared Energy & Emissions Data Layer
 * Digunakan oleh Halaman "Kelistrikan PLTS Atap" dan "Scope 2: Listrik PLN"
 *
 * Menjamin 100% konsistensi:
 * - Cakupan resmi: 37 Distribution Center (DC) (2 pilot Toko Drive Thru di-filter/di-hide)
 * - Identitas energi: 
 *     Produksi = Pakai Sendiri + Ekspor (Feed-in)
 *     Beban Total = Listrik Dibeli PLN + PLTS Pakai Sendiri
 * - Emisi Scope 2 = Listrik Dibeli PLN (kWh) * Faktor Grid (kgCO2e/kWh) / 1.000
 * - Emisi Terhindar = PLTS Pakai Sendiri (kWh) * Faktor Regional ESDM (kgCO2e/kWh) / 1.000
 * - 35 DC berfaktor resmi ESDM, 2 DC (Gorontalo & Manado di Sulutgo) berfaktor sementara
 */

import fs from 'node:fs';
import path from 'node:path';
import prisma from './prisma.js';
import { CANONICAL_DC_ENTITIES, isDcLocation, normalizeName } from './solar/plantMap.js';
import { getGridFactor, GRID_EMISSION_FACTORS } from './emission-factors.js';
import { parseIsolarMonthlyReportFile } from './importers/isolarMonthlyReport.js';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

/**
 * Membaca data mentah per DC per bulan
 * Prioritas 1: Database table `energy_flow_monthly`
 * Prioritas 2 (fallback): File CSV laporan tahunan iSolarCloud
 */
export async function fetchRawEnergyFlows({ year = 2026, rootDir = process.cwd() } = {}) {
  const minYm = `${year}01`;
  const maxYm = `${year}12`;

  try {
    const dbFlows = await prisma.$queryRawUnsafe(`
      SELECT ef.year_month as "yearMonth", 
             ef.ps_id as "psId", 
             ef.yield_kwh as "yieldKwh", 
             ef.feed_in_kwh as "feedInKwh", 
             ef.purchased_kwh as "purchasedKwh", 
             ef.load_kwh as "loadKwh", 
             ef.source as "source",
             pm.canonical_name as "canonicalName",
             pm.dc_id as "dcId",
             pm.grid as "grid",
             pm.api_installed_kwp as "apiInstalledKwp"
      FROM energy_flow_monthly ef
      LEFT JOIN plant_master pm ON ef.ps_id = ANY(pm.sungrow_ps_ids)
      WHERE ef.year_month BETWEEN '${minYm}' AND '${maxYm}'
      ORDER BY ef.year_month ASC, pm.canonical_name ASC
    `);

    if (Array.isArray(dbFlows) && dbFlows.length > 0) {
      return dbFlows.map(r => ({
        yearMonth: `${r.yearMonth.slice(0, 4)}-${r.yearMonth.slice(4, 6)}`,
        storageYearMonth: r.yearMonth,
        psId: Number(r.psId),
        dcId: r.dcId,
        canonicalName: r.canonicalName,
        grid: r.grid,
        installedKwp: Number(r.apiInstalledKwp || 0),
        yieldKwh: Number(r.yieldKwh || 0),
        feedInKwh: Number(r.feedInKwh || 0),
        purchasedKwh: Number(r.purchasedKwh || 0),
        loadKwh: Number(r.loadKwh || 0),
        source: r.source || 'DB_ENERGY_FLOW_MONTHLY',
      }));
    }
  } catch (dbErr) {
    console.warn('[energy-data] DB query unavailable, falling back to CSV report files:', dbErr?.message);
  }

  // Fallback ke CSV iSolarCloud
  const csvPattern = new RegExp(`Monthly Report_Annual report_.*\\.csv$`);
  const files = fs.readdirSync(rootDir).filter(f => csvPattern.test(f));
  const targetCsv = files.find(f => {
    try {
      const firstLine = fs.readFileSync(path.join(rootDir, f), 'utf8').split('\n')[0];
      return firstLine.includes(String(year));
    } catch { return false; }
  }) || files[0];

  if (!targetCsv) {
    throw new Error(`Tidak ditemukan file laporan iSolarCloud untuk tahun ${year}`);
  }

  const parsed = parseIsolarMonthlyReportFile(path.join(rootDir, targetCsv), { filename: targetCsv });
  const entityByPsId = new Map();
  for (const entity of CANONICAL_DC_ENTITIES) {
    for (const id of (entity.sungrowPsIds || [])) {
      entityByPsId.set(Number(id), entity);
    }
  }

  return parsed.records
    .filter(r => r.status === 'VALID' && r.year === year)
    .map(r => {
      const entity = entityByPsId.get(r.psId) || {
        canonicalName: r.plantNameRaw,
        dcId: `DC-${r.psId}`,
        grid: 'JAMALI',
        apiInstalledKwp: r.installedKwp || 0
      };

      const yieldKwh = Number(r.energyKwh || 0);
      const feedInKwh = Number(r.feedInKwh || 0);
      const purchasedKwh = Number(r.purchasedEnergyKwh || 0);
      const loadKwh = Number(r.loadKwh || (purchasedKwh + Math.max(0, yieldKwh - feedInKwh)));

      return {
        yearMonth: r.yearMonth,
        storageYearMonth: r.yearMonth.replace('-', ''),
        psId: r.psId,
        dcId: entity.dcId,
        canonicalName: entity.canonicalName,
        grid: entity.grid,
        installedKwp: Number(entity.apiInstalledKwp || r.installedKwp || 0),
        yieldKwh,
        feedInKwh,
        purchasedKwh,
        loadKwh,
        source: 'CSV_ISOLAR_REPORT',
      };
    });
}

/**
 * Menghasilkan baris kanonik per DC per bulan (37 Distribution Centers)
 */
export async function getCanonicalEnergyRows({
  year = 2026,
  includeStores = false, // Sesuai arahan user, default false (hide drive-thru)
  throughMonth = 9,
  rootDir = process.cwd(),
} = {}) {
  const rawRows = await fetchRawEnergyFlows({ year, rootDir });

  // Entity lookup untuk memastikan klasifikasi DC vs Toko
  const entityByDcId = new Map(CANONICAL_DC_ENTITIES.map(e => [e.dcId, e]));
  const entityByName = new Map(CANONICAL_DC_ENTITIES.map(e => [normalizeName(e.canonicalName), e]));

  const rows = [];
  const seenIdentities = new Set();

  for (const raw of rawRows) {
    const normName = normalizeName(raw.canonicalName);
    const entity = entityByDcId.get(raw.dcId) || entityByName.get(normName);
    const isDc = entity ? isDcLocation(entity) : !raw.canonicalName.toLowerCase().includes('drive thru');

    if (!includeStores && !isDc) {
      continue; // Sembunyikan 2 Toko Drive Thru
    }

    const identity = `${raw.storageYearMonth}|${raw.psId}`;
    if (seenIdentities.has(identity)) {
      continue; // Deduplikasi
    }
    seenIdentities.add(identity);

    const mNum = Number(raw.storageYearMonth.slice(4, 6));
    const isPartial = mNum > throughMonth;

    const yieldKwh = Number(raw.yieldKwh || 0);
    const feedInKwh = Number(raw.feedInKwh || 0);
    const selfConsumptionKwh = Math.max(0, yieldKwh - feedInKwh);
    const purchasedKwh = Number(raw.purchasedKwh || 0);
    // Beban total terverifikasi identitas: purchasedKwh + selfConsumptionKwh
    const rawLoadKwh = Number(raw.loadKwh || 0);
    const loadKwh = Number(purchasedKwh + selfConsumptionKwh);

    const grid = entity?.grid || raw.grid || 'JAMALI';
    const factorObj = getGridFactor(grid);
    const gridFactorKgPerKwh = factorObj?.cmExPost ?? 0.87;
    const pltsFactorKgPerKwh = factorObj?.cmPlts ?? 0.83;
    const factorStatus = factorObj?.status ?? 'sementara';
    const isEligibleEmission = factorStatus === 'resmi';

    // Emisi dihitung presisi penuh, pembulatan saat tampil
    const avoidedEmissionTonRaw = isEligibleEmission ? (selfConsumptionKwh * pltsFactorKgPerKwh) / 1000 : null;
    const scope2EmissionTonRaw = isEligibleEmission ? (purchasedKwh * gridFactorKgPerKwh) / 1000 : null;

    rows.push({
      yearMonth: raw.yearMonth,
      storageYearMonth: raw.storageYearMonth,
      year: Number(raw.storageYearMonth.slice(0, 4)),
      month: mNum,
      monthLabel: MONTH_NAMES_SHORT[mNum - 1] || `M${mNum}`,
      psId: raw.psId,
      dcId: entity?.dcId || raw.dcId,
      dcName: entity?.canonicalName || raw.canonicalName,
      grid,
      installedKwp: entity?.apiInstalledKwp || raw.installedKwp || 0,
      isDc,
      connectType: 3,
      scope2Basis: 'purchased',
      yieldKwh,
      yieldMwh: yieldKwh / 1000,
      feedInKwh,
      feedInMwh: feedInKwh / 1000,
      selfConsumptionKwh,
      selfConsumptionMwh: selfConsumptionKwh / 1000,
      purchasedKwh,
      purchasedMwh: purchasedKwh / 1000,
      loadKwh,
      loadMwh: loadKwh / 1000,
      rawLoadKwh,
      gridFactorKgPerKwh,
      pltsFactorKgPerKwh,
      factorStatus,
      isEligibleEmission,
      avoidedEmissionTon: avoidedEmissionTonRaw !== null ? round(avoidedEmissionTonRaw, 4) : null,
      scope2EmissionTon: scope2EmissionTonRaw !== null ? round(scope2EmissionTonRaw, 4) : null,
      avoidedEmissionTonRaw,
      scope2EmissionTonRaw,
      periodStatus: isPartial ? 'partial' : 'complete',
      qualityFlags: [
        ...(factorStatus !== 'resmi' ? ['TEMPORARY_EMISSION_FACTOR'] : []),
        ...(isPartial ? ['PARTIAL_PERIOD'] : []),
      ],
    });
  }

  return rows;
}

/**
 * Menghasilkan ringkasan bulanan (12 bulan)
 */
export async function getCanonicalMonthlySummary({
  year = 2026,
  includeStores = false,
  throughMonth = 9,
  rootDir = process.cwd(),
} = {}) {
  const rows = await getCanonicalEnergyRows({ year, includeStores, throughMonth, rootDir });

  const monthly = [];
  let runningAvoidedCumTon = 0;
  let runningScope2CumTon = 0;

  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`;
    const mRows = rows.filter(r => r.month === m);
    const isPartial = m > throughMonth || mRows.some(r => r.periodStatus === 'partial');

    const yieldKwh = mRows.reduce((s, r) => s + r.yieldKwh, 0);
    const feedInKwh = mRows.reduce((s, r) => s + r.feedInKwh, 0);
    const selfConsumptionKwh = mRows.reduce((s, r) => s + r.selfConsumptionKwh, 0);
    const purchasedKwh = mRows.reduce((s, r) => s + r.purchasedKwh, 0);
    const loadKwh = mRows.reduce((s, r) => s + r.loadKwh, 0);

    const eligibleRows = mRows.filter(r => r.isEligibleEmission);
    const avoidedEmissionTon = eligibleRows.reduce((s, r) => s + (r.avoidedEmissionTonRaw || 0), 0);
    const scope2EmissionTon = eligibleRows.reduce((s, r) => s + (r.scope2EmissionTonRaw || 0), 0);

    if (!isPartial) {
      runningAvoidedCumTon += avoidedEmissionTon;
      runningScope2CumTon += scope2EmissionTon;
    }

    monthly.push({
      yearMonth: ym,
      storageYearMonth: `${year}${String(m).padStart(2, '0')}`,
      month: m,
      monthLabel: MONTH_NAMES_SHORT[m - 1],
      periodStatus: isPartial ? 'partial' : 'complete',
      plantCount: mRows.length,
      officialPlantCount: eligibleRows.length,
      temporaryPlantCount: mRows.length - eligibleRows.length,
      yieldKwh,
      yieldMwh: yieldKwh / 1000,
      feedInKwh,
      feedInMwh: feedInKwh / 1000,
      selfConsumptionKwh,
      selfConsumptionMwh: selfConsumptionKwh / 1000,
      purchasedKwh,
      purchasedMwh: purchasedKwh / 1000,
      loadKwh,
      loadMwh: loadKwh / 1000,
      avoidedEmissionTon: round(avoidedEmissionTon, 2),
      cumAvoidedEmissionTon: !isPartial ? round(runningAvoidedCumTon, 2) : null,
      scope2EmissionTon: round(scope2EmissionTon, 2),
      cumScope2EmissionTon: !isPartial ? round(runningScope2CumTon, 2) : null,
    });
  }

  return monthly;
}

/**
 * Menghasilkan ringkasan YTD (Januari s.d. throughMonth)
 */
export async function getCanonicalYtdSummary({
  year = 2026,
  throughMonth = 9,
  includeStores = false,
  rootDir = process.cwd(),
} = {}) {
  const rows = await getCanonicalEnergyRows({ year, includeStores, throughMonth, rootDir });
  const ytdRows = rows.filter(r => r.month <= throughMonth);

  const yieldKwh = ytdRows.reduce((s, r) => s + r.yieldKwh, 0);
  const feedInKwh = ytdRows.reduce((s, r) => s + r.feedInKwh, 0);
  const selfConsumptionKwh = ytdRows.reduce((s, r) => s + r.selfConsumptionKwh, 0);
  const purchasedKwh = ytdRows.reduce((s, r) => s + r.purchasedKwh, 0);
  const loadKwh = ytdRows.reduce((s, r) => s + r.loadKwh, 0);

  const eligibleRows = ytdRows.filter(r => r.isEligibleEmission);
  const avoidedEmissionTon = eligibleRows.reduce((s, r) => s + (r.avoidedEmissionTonRaw || 0), 0);
  const scope2EmissionTon = eligibleRows.reduce((s, r) => s + (r.scope2EmissionTonRaw || 0), 0);

  const distinctPlants = new Set(ytdRows.map(r => r.dcId));
  const distinctOfficialPlants = new Set(eligibleRows.map(r => r.dcId));

  const intensityTonPerMwh = purchasedKwh > 0 ? (scope2EmissionTon / (purchasedKwh / 1000)) : null;

  return {
    year,
    throughMonth,
    periodLabel: `Jan–${MONTH_NAMES_SHORT[throughMonth - 1]} ${year} (YTD)`,
    plantCount: distinctPlants.size,
    officialPlantCount: distinctOfficialPlants.size,
    temporaryPlantCount: distinctPlants.size - distinctOfficialPlants.size,
    observationsCount: ytdRows.length,
    yieldKwh,
    yieldMwh: yieldKwh / 1000,
    feedInKwh,
    feedInMwh: feedInKwh / 1000,
    selfConsumptionKwh,
    selfConsumptionMwh: selfConsumptionKwh / 1000,
    purchasedKwh,
    purchasedMwh: purchasedKwh / 1000,
    loadKwh,
    loadMwh: loadKwh / 1000,
    avoidedEmissionTon: round(avoidedEmissionTon, 2),
    scope2EmissionTon: round(scope2EmissionTon, 2),
    intensityTonPerMwh: intensityTonPerMwh !== null ? round(intensityTonPerMwh, 2) : null,
  };
}
