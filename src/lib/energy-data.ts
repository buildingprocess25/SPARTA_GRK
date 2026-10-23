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
 * - Emisi Terhindar = PLTS Pakai Sendiri (kWh) * 0,997 kgCO2/kWh / 1.000, semua DC kecuali yang masih konstruksi
 * - Scope 2 hanya dihitung untuk grid berfaktor resmi; Sulutgo (Gorontalo & Manado) masih sementara
 */

import fs from 'node:fs';
import path from 'node:path';
import prisma from './prisma.ts';
import { CANONICAL_DC_ENTITIES, isDcLocation, normalizeName } from './solar/plantMap.ts';
import { getGridFactor, GRID_EMISSION_FACTORS, DEFAULT_GRID_FACTOR_KG_PER_KWH } from './emission-factors.ts';
import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from './solar/conversionConfig.ts';
import { isPlantUnderConstruction } from './solar/dashboard.ts';
import { parseIsolarMonthlyReportFile } from './importers/isolarMonthlyReport.ts';
import { isApiEnergyFlow, mergeEnergyFlowRows } from './solar/energyFlowSources.ts';

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
export interface RawEnergyFlowRow {
  yearMonth: string;
  storageYearMonth: string;
  psId: number;
  dcId: string;
  canonicalName: string;
  grid: string;
  installedKwp: number;
  yieldKwh: number;
  feedInKwh: number;
  purchasedKwh: number;
  loadKwh: number;
  source: string;
  // Only database rows carry a fetch timestamp; workbook fallback rows do not.
  fetchedAt?: string | null;
}

export async function fetchRawEnergyFlows({ year = 2026, rootDir = process.cwd() } = {}): Promise<RawEnergyFlowRow[]> {
  const parsedYear = Number(year);
  const safeYear = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : 2026;
  const minYm = `${safeYear}01`;
  const maxYm = `${safeYear}12`;

  try {
    const dbFlows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ef.year_month as "yearMonth", 
             ef.ps_id as "psId", 
             ef.yield_kwh as "yieldKwh", 
             ef.feed_in_kwh as "feedInKwh", 
             ef.purchased_kwh as "purchasedKwh", 
             ef.load_kwh as "loadKwh", 
             ef.source as "source",
             ef.fetched_at as "fetchedAt",
             pm.canonical_name as "canonicalName",
             pm.dc_id as "dcId",
             pm.grid as "grid",
             pm.api_installed_kwp as "apiInstalledKwp"
      FROM energy_flow_monthly ef
      LEFT JOIN plant_master pm ON ef.ps_id = ANY(pm.sungrow_ps_ids)
      WHERE ef.year_month BETWEEN $1 AND $2
      ORDER BY ef.year_month ASC, pm.canonical_name ASC
    `, minYm, maxYm);

    if (Array.isArray(dbFlows) && dbFlows.length > 0) {
      return mergeEnergyFlowRows(dbFlows).map(r => ({
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
        fetchedAt: r.fetchedAt ? new Date(r.fetchedAt).toISOString() : null,
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
  const entityByDcId = new Map(CANONICAL_DC_ENTITIES.map(e => [e.dcId, e] as const));
  const entityByName = new Map(CANONICAL_DC_ENTITIES.map(e => [normalizeName(e.canonicalName), e] as const));

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
    // API rows are month-to-date until the monthly report replaces them, so they never count as a closed month.
    const isProvisional = isApiEnergyFlow(raw);
    const isPartial = mNum > throughMonth || isProvisional;

    const yieldKwh = Number(raw.yieldKwh || 0);
    const feedInKwh = Number(raw.feedInKwh || 0);
    const selfConsumptionKwh = Math.max(0, yieldKwh - feedInKwh);
    const purchasedKwh = Number(raw.purchasedKwh || 0);
    // Beban total terverifikasi identitas: purchasedKwh + selfConsumptionKwh
    const rawLoadKwh = Number(raw.loadKwh || 0);
    const loadKwh = Number(purchasedKwh + selfConsumptionKwh);

    const grid = entity?.grid || raw.grid || 'JAMALI';
    const factorObj = getGridFactor(grid);
    const gridFactorKgPerKwh = factorObj?.cmExPost ?? DEFAULT_GRID_FACTOR_KG_PER_KWH;
    const pltsFactorKgPerKwh = factorObj?.cmPlts ?? PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH;
    const factorStatus = factorObj?.status ?? 'sementara';
    // Scope 2 needs an official grid factor; PLTS uses the single 0.997 factor, so only construction excludes it.
    const isEligibleEmission = factorStatus === 'resmi';
    const isEligibleAvoided = !isPlantUnderConstruction(entity);

    // Emisi dihitung presisi penuh, pembulatan saat tampil
    const avoidedEmissionTonRaw = isEligibleAvoided ? (selfConsumptionKwh * pltsFactorKgPerKwh) / 1000 : null;
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
      isEligibleAvoided,
      avoidedEmissionTon: avoidedEmissionTonRaw !== null ? round(avoidedEmissionTonRaw, 4) : null,
      scope2EmissionTon: scope2EmissionTonRaw !== null ? round(scope2EmissionTonRaw, 4) : null,
      avoidedEmissionTonRaw,
      scope2EmissionTonRaw,
      periodStatus: isPartial ? 'partial' : 'complete',
      isProvisional,
      dataFetchedAt: isProvisional ? raw.fetchedAt : null,
      qualityFlags: [
        ...(factorStatus !== 'resmi' ? ['TEMPORARY_EMISSION_FACTOR'] : []),
        ...(isPartial ? ['PARTIAL_PERIOD'] : []),
        ...(isProvisional ? ['PROVISIONAL_API'] : []),
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
    const avoidedEmissionTon = mRows.reduce((s, r) => s + (r.avoidedEmissionTonRaw || 0), 0);
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
      isProvisional: mRows.some(r => r.isProvisional),
      dataFetchedAt: mRows.map(r => r.dataFetchedAt).filter(Boolean).sort().at(-1) || null,
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
  const avoidedEmissionTon = ytdRows.reduce((s, r) => s + (r.avoidedEmissionTonRaw || 0), 0);
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
