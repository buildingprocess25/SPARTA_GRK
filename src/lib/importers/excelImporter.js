import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma.js';
import { CANONICAL_DC_ENTITIES, lookupPlantMetadata } from '../solar/plantMap.js';
import { CARBON_FACTORS, getGridEmissionFactor } from '../carbon/carbonEngine.js';

// Month mapping for Excel sheets
const MONTH_MAP = {
  'JAN 2026': '2026-01',
  'FEB 2026': '2026-02',
  'MAR 2026': '2026-03',
  'APRIL 2026': '2026-04',
  'MEI 2026': '2026-05',
  'JUNI 2026': '2026-06',
  'JULI 2026': '2026-07',
  'AGUS 2026': '2026-08',
};

// Explicit Plant Name Normalizer for Excel Importer (Strict 39 Detail Entities)
export const EXCEL_PLANT_ALIAS_MAP = {
  'gorontalo': 'DC-GORONTALO',
  'luwu': 'DC-LUWU',
  'cileungsi': 'DC-CILEUNGSI',
  'tegal': 'DC-TEGAL',
  'sidoarjo': 'DC-SIDOARJO',
  'tk. drive thru de mansion': 'DC-DEMANSION',
  'tk drive thru de mansion': 'DC-DEMANSION',
  'de mansion': 'DC-DEMANSION',
  'plumbon': 'DC-PLUMBON',
  'jember': 'DC-JEMBER',
  'madiun': 'DC-MADIUN',
  'serang': 'DC-SERANG',
  'bandung 2': 'DC-BANDUNG2',
  'cilacap 1': 'DC-CILACAP-1',
  'cilacap 2': 'DC-CILACAP-2',
  'cilacap 3': 'DC-CILACAP-3',
  'cianjur': 'DC-CIANJUR',
  'semarang': 'DC-SEMARANG',
  'klaten': 'DC-KLATEN',
  'tk. drive thru gs': 'DC-DRIVETHRUGS',
  'tk drive thru gs': 'DC-DRIVETHRUGS',
  'drive thru gs': 'DC-DRIVETHRUGS',
  'kotabumi': 'DC-KOTABUMI',
  'makassar': 'DC-MAKASSAR',
  'manado': 'DC-MANADO',
  'pekanbaru': 'DC-PEKANBARU',
  'batam': 'DC-BATAM',
  'jambi': 'DC-JAMBI',
  'pontianak': 'DC-PONTIANAK',
  'lombok a': 'DC-LOMBOK-A',
  'lombok b': 'DC-LOMBOK-B',
  'lampung': 'DC-LAMPUNG',
  'bogor': 'DC-BOGOR',
  'parung': 'DC-PARUNG',
  'malang': 'DC-MALANG',
  'bandung 1': 'DC-BANDUNG1',
  'bali': 'DC-BALI',
  'rembang': 'DC-REMBANG',
  'balaraja': 'DC-BALARAJA',
  'medan': 'DC-MEDAN',
  'palembang': 'DC-PALEMBANG',
  'banjarmasin': 'DC-BANJARMASIN',
  'karawang': 'DC-KARAWANG',
};

/**
 * 1. Seed Plant Master Registry (39 Canonical Plants)
 */
export async function seedPlantMaster() {
  console.log('[IMPORTER] Seeding 39 Canonical Plant Master records...');
  let seeded = 0;

  for (const dc of CANONICAL_DC_ENTITIES) {
    await prisma.plantMaster.upsert({
      where: { dcId: dc.dcId },
      update: {
        canonicalName: dc.canonicalName,
        aliases: dc.aliases,
        sungrowPsIds: dc.sungrowPsIds,
        apiInstalledKwp: dc.apiInstalledKwp,
        baselineInstalledKwp: dc.baselineInstalledKwp,
        region: dc.region,
        grid: dc.grid,
        isMultiPlant: dc.isMultiPlant,
        parentDc: dc.parentDc || null,
      },
      create: {
        dcId: dc.dcId,
        canonicalName: dc.canonicalName,
        aliases: dc.aliases,
        sungrowPsIds: dc.sungrowPsIds,
        apiInstalledKwp: dc.apiInstalledKwp,
        baselineInstalledKwp: dc.baselineInstalledKwp,
        region: dc.region,
        grid: dc.grid,
        isMultiPlant: dc.isMultiPlant,
        parentDc: dc.parentDc || null,
      },
    });
    seeded++;
  }

  console.log(`[IMPORTER] Successfully seeded ${seeded} PlantMaster records.`);
  return seeded;
}

/**
 * 2. Seed Official Emission Factors Registry
 */
export async function seedEmissionFactorRegistry() {
  console.log('[IMPORTER] Seeding Official Emission Factor Registry...');
  const factors = [
    {
      category: 'FUEL',
      code: 'FUEL_SOLAR',
      label: 'Solar / Biosolar (B35/B40)',
      factorValue: 2.6685,
      unit: 'kgCO2e/L',
      sourceDoc: 'ESDM Inventory Emisi GRK Sektor Energi & perhitungan emisi karbon.xlsx',
      status: 'ACTIVE',
      conflictNotes: 'Official ESDM factor 2.6685 kgCO2e/L'
    },
    {
      category: 'FUEL',
      code: 'FUEL_PERTALITE',
      label: 'Pertalite (RON 90)',
      factorValue: 2.2951,
      unit: 'kgCO2e/L',
      sourceDoc: 'ESDM Inventory Emisi GRK Sektor Energi & perhitungan emisi karbon.xlsx',
      status: 'ACTIVE',
      conflictNotes: 'Official ESDM factor 2.2951 kgCO2e/L'
    },
    {
      category: 'FUEL',
      code: 'FUEL_PERTAMAX',
      label: 'Pertamax (RON 92)',
      factorValue: 2.2868,
      unit: 'kgCO2e/L',
      sourceDoc: 'ESDM Inventory Emisi GRK Sektor Energi & perhitungan emisi karbon.xlsx (Table K8)',
      status: 'PENDING_VALIDATION',
      conflictNotes: 'Conflict detected: D7 formula uses 0.2868 (typographical omission in workbook formula) while Reference Table K8 states 2.2868. Value 2.2868 is validated against ESDM standard.'
    },
    {
      category: 'GRID',
      code: 'GRID_JAMALI',
      label: 'Jawa-Madura-Bali Grid',
      factorValue: 0.87,
      unit: 'kgCO2e/kWh',
      locationOrGrid: 'JAMALI',
      sourceDoc: 'ESDM Kepmen Faktor Emisi Ketenagalistrikan',
      status: 'ACTIVE'
    },
    {
      category: 'GRID',
      code: 'GRID_KALSELTENG',
      label: 'Kalimantan Selatan & Tengah Grid',
      factorValue: 1.20,
      unit: 'kgCO2e/kWh',
      locationOrGrid: 'KALIMANTAN_SELATAN',
      sourceDoc: 'ESDM Kepmen Faktor Emisi Ketenagalistrikan',
      status: 'ACTIVE'
    },
    {
      category: 'GRID',
      code: 'GRID_BATAM',
      label: 'Batam Grid',
      factorValue: 0.76,
      unit: 'kgCO2e/kWh',
      locationOrGrid: 'BATAM',
      sourceDoc: 'ESDM Kepmen Faktor Emisi Ketenagalistrikan',
      status: 'ACTIVE'
    },
    {
      category: 'GRID',
      code: 'GRID_SULUTGO',
      label: 'Sulutgo Grid (Sulut & Gorontalo)',
      factorValue: 0.60,
      unit: 'kgCO2e/kWh',
      locationOrGrid: 'SULUTGO',
      sourceDoc: 'ESDM Kepmen Faktor Emisi Ketenagalistrikan',
      status: 'ACTIVE'
    },
    {
      category: 'GRID',
      code: 'GRID_SUMATERA',
      label: 'Sumatera Interkoneksi Grid',
      factorValue: 0.77,
      unit: 'kgCO2e/kWh',
      locationOrGrid: 'SUMATERA',
      sourceDoc: 'ESDM Kepmen Faktor Emisi Ketenagalistrikan',
      status: 'ACTIVE'
    },
    {
      category: 'GRID',
      code: 'GRID_LOMBOK',
      label: 'Lombok (NTB) Grid',
      factorValue: 0.75,
      unit: 'kgCO2e/kWh',
      locationOrGrid: 'LOMBOK',
      sourceDoc: 'ESDM Kepmen Faktor Emisi Ketenagalistrikan',
      status: 'ACTIVE'
    },
    {
      category: 'GRID',
      code: 'GRID_SULSELRABAR',
      label: 'Sulselrabar Grid',
      factorValue: 0.73,
      unit: 'kgCO2e/kWh',
      locationOrGrid: 'SULSELRABAR',
      sourceDoc: 'ESDM Kepmen Faktor Emisi Ketenagalistrikan',
      status: 'ACTIVE'
    },
    {
      category: 'PLTS',
      code: 'PLTS_PORTFOLIO_RKAP',
      label: 'Corporate RKAP Portfolio Avoided Multiplier',
      factorValue: 0.997,
      unit: 'tCO2e/MWh',
      sourceDoc: 'Monitor PLTS 2026 (1).xlsx (Resume Sheet)',
      status: 'ACTIVE',
      conflictNotes: 'Corporate ESG portfolio standard multiplier: 0.997 tCO2/MWh avoided.'
    },
    {
      category: 'PLTS',
      code: 'PLTS_CDM_MARGINAL',
      label: 'CDM Baseline Grid Marginal Factor',
      factorValue: 0.83,
      unit: 'kgCO2e/kWh',
      sourceDoc: 'Clean Development Mechanism (CDM) Java-Bali baseline',
      status: 'ACTIVE',
      conflictNotes: 'Used for daily marginal operations reporting.'
    },
    {
      category: 'WATER',
      code: 'WATER_RECYCLE_IPCC',
      label: 'Water Recycling Avoided Emission Factor',
      factorValue: 0.344,
      unit: 'kgCO2e/m3',
      sourceDoc: 'IPCC 2006 Guidelines for National GHG Inventories & perhitungan emisi karbon.xlsx',
      status: 'ACTIVE'
    }
  ];

  for (const f of factors) {
    await prisma.emissionFactorRegistry.upsert({
      where: { code: f.code },
      update: f,
      create: f
    });
  }

  console.log(`[IMPORTER] Successfully seeded ${factors.length} EmissionFactorRegistry records.`);
  return factors.length;
}

/**
 * 3. Seed Production Targets (RKAP 2026 Original vs Revised)
 */
export async function seedProductionTargets(workbookPath) {
  console.log('[IMPORTER] Seeding Corporate Production Targets from Resume sheet...');
  const targets = [
    // RKAP 2026 Original (Total 5,858 MWh / 5,843 Ton CO2)
    { yearMonth: '2026-01', targetMwh: 515.0, targetKwh: 515000, targetCo2Ton: 513.0, targetCoalTon: 208.06, targetTreeCount: 27810, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-02', targetMwh: 535.0, targetKwh: 535000, targetCo2Ton: 533.0, targetCoalTon: 216.14, targetTreeCount: 28890, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-03', targetMwh: 535.0, targetKwh: 535000, targetCo2Ton: 533.0, targetCoalTon: 216.14, targetTreeCount: 28890, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-04', targetMwh: 475.0, targetKwh: 475000, targetCo2Ton: 474.0, targetCoalTon: 191.90, targetTreeCount: 25650, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-05', targetMwh: 475.0, targetKwh: 475000, targetCo2Ton: 474.0, targetCoalTon: 191.90, targetTreeCount: 25650, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-06', targetMwh: 475.0, targetKwh: 475000, targetCo2Ton: 474.0, targetCoalTon: 191.90, targetTreeCount: 25650, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-07', targetMwh: 475.0, targetKwh: 475000, targetCo2Ton: 474.0, targetCoalTon: 191.90, targetTreeCount: 25650, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-08', targetMwh: 475.0, targetKwh: 475000, targetCo2Ton: 474.0, targetCoalTon: 191.90, targetTreeCount: 25650, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-09', targetMwh: 475.0, targetKwh: 475000, targetCo2Ton: 474.0, targetCoalTon: 191.90, targetTreeCount: 25650, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-10', targetMwh: 475.0, targetKwh: 475000, targetCo2Ton: 474.0, targetCoalTon: 191.90, targetTreeCount: 25650, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-11', targetMwh: 474.0, targetKwh: 474000, targetCo2Ton: 473.0, targetCoalTon: 191.50, targetTreeCount: 25596, version: 'RKAP_2026_ORIGINAL' },
    { yearMonth: '2026-12', targetMwh: 474.0, targetKwh: 474000, targetCo2Ton: 473.0, targetCoalTon: 191.50, targetTreeCount: 25596, version: 'RKAP_2026_ORIGINAL' },

    // RKAP 2026 Revised (Total 6,453.9 MWh)
    { yearMonth: '2026-01', targetMwh: 515.0, targetKwh: 515000, targetCo2Ton: 513.455, targetCoalTon: 208.06, targetTreeCount: 27810, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-02', targetMwh: 535.0, targetKwh: 535000, targetCo2Ton: 533.395, targetCoalTon: 216.14, targetTreeCount: 28890, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-03', targetMwh: 535.0, targetKwh: 535000, targetCo2Ton: 533.395, targetCoalTon: 216.14, targetTreeCount: 28890, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-04', targetMwh: 535.0, targetKwh: 535000, targetCo2Ton: 533.395, targetCoalTon: 216.14, targetTreeCount: 28890, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-05', targetMwh: 535.0, targetKwh: 535000, targetCo2Ton: 533.395, targetCoalTon: 216.14, targetTreeCount: 28890, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-06', targetMwh: 535.0, targetKwh: 535000, targetCo2Ton: 533.395, targetCoalTon: 216.14, targetTreeCount: 28890, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-07', targetMwh: 535.0, targetKwh: 535000, targetCo2Ton: 533.395, targetCoalTon: 216.14, targetTreeCount: 28890, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-08', targetMwh: 545.8, targetKwh: 545800, targetCo2Ton: 544.162, targetCoalTon: 220.50, targetTreeCount: 29473, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-09', targetMwh: 546.2, targetKwh: 546200, targetCo2Ton: 544.561, targetCoalTon: 220.66, targetTreeCount: 29495, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-10', targetMwh: 546.3, targetKwh: 546300, targetCo2Ton: 544.661, targetCoalTon: 220.71, targetTreeCount: 29500, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-11', targetMwh: 545.2, targetKwh: 545200, targetCo2Ton: 543.564, targetCoalTon: 220.26, targetTreeCount: 29441, version: 'RKAP_2026_REVISED' },
    { yearMonth: '2026-12', targetMwh: 545.4, targetKwh: 545400, targetCo2Ton: 543.764, targetCoalTon: 220.34, targetTreeCount: 29452, version: 'RKAP_2026_REVISED' },
  ];

  for (const t of targets) {
    await prisma.productionTarget.upsert({
      where: {
        yearMonth_scope_version: {
          yearMonth: t.yearMonth,
          scope: 'PORTFOLIO',
          version: t.version
        }
      },
      update: t,
      create: {
        ...t,
        scope: 'PORTFOLIO'
      }
    });
  }

  console.log(`[IMPORTER] Successfully seeded ${targets.length} ProductionTarget records.`);
  return targets.length;
}

/**
 * 4. Import Monthly PLTS Energy Data from Monitor PLTS 2026 (1).xlsx
 */
export async function importPLTSMonthlyWorkbook(filePath = 'Monitor PLTS 2026 (1).xlsx', { dryRun = false } = {}) {
  console.log(`[IMPORTER] Starting PLTS Energy import from ${filePath} (dryRun=${dryRun})...`);
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const wb = xlsx.readFile(resolvedPath);
  const monthlySheets = ['JAN 2026', 'FEB 2026', 'MAR 2026', 'APRIL 2026', 'MEI 2026', 'JUNI 2026', 'JULI 2026', 'AGUS 2026'];

  const batchId = `import-plts-${Date.now()}`;
  let totalImported = 0;
  const sheetSummaries = {};
  const errors = [];

  for (const sheetName of monthlySheets) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      errors.push(`Sheet ${sheetName} not found in workbook`);
      continue;
    }

    const yearMonth = MONTH_MAP[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    let sheetCount = 0;
    let sheetYield = 0;
    let sheetPurchased = 0;
    let sheetFeedIn = 0;
    let sheetLoad = 0;
    let sheetTotalProd = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row[0]) continue;
      const rawName = String(row[0]).trim();
      const lowerName = rawName.toLowerCase();

      // Check for aggregate rows: Cilacap, Lombok, Total
      const isAggregate = lowerName === 'cilacap' || lowerName === 'lombok' || lowerName === 'total';
      if (isAggregate) {
        continue; // Skip composite parent rows to prevent double counting in detail records
      }

      const dcId = EXCEL_PLANT_ALIAS_MAP[lowerName] || lookupPlantMetadata({ plantName: rawName }).psId;
      if (!dcId || dcId === 'SG-UNKNOWN') {
        errors.push(`Unknown plant name on sheet ${sheetName} row ${r + 1}: "${rawName}"`);
        continue;
      }

      const yieldMwh = Number(row[1]) || 0;
      const purchasedMwh = Number(row[2]) || 0;
      const feedInMwh = Number(row[3]) || 0;
      const loadMwh = Number(row[4]) || 0;
      const totalProdMwh = Number(row[5]) !== 0 && !isNaN(Number(row[5]))
        ? Number(row[5])
        : Number((yieldMwh + feedInMwh).toFixed(5));

      const yieldKwh = Number((yieldMwh * 1000).toFixed(2));
      const purchasedKwh = Number((purchasedMwh * 1000).toFixed(2));
      const feedInKwh = Number((feedInMwh * 1000).toFixed(2));
      const loadKwh = Number((loadMwh * 1000).toFixed(2));
      const totalProdKwh = Number((totalProdMwh * 1000).toFixed(2));
      const avoidedCo2Ton = Number((totalProdMwh * CARBON_FACTORS.PLTS_PORTFOLIO.CO2_AVOIDED_TON_PER_MWH).toFixed(5));

      sheetCount++;
      sheetYield += yieldMwh;
      sheetPurchased += purchasedMwh;
      sheetFeedIn += feedInMwh;
      sheetLoad += loadMwh;
      sheetTotalProd += totalProdMwh;

      if (!dryRun) {
        await prisma.energyMeasurement.upsert({
          where: {
            yearMonth_dcId_source_category_proofRef: {
              yearMonth,
              dcId,
              source: 'EXCEL_IMPORT',
              category: 'PLN', // excelImporter defaults to PLN in schema
              proofRef: ''
            }
          },
          update: {
            plantNameRaw: rawName,
            yieldMwh,
            purchasedMwh,
            feedInMwh,
            loadMwh,
            totalProdMwh,
            yieldKwh,
            purchasedKwh,
            feedInKwh,
            loadKwh,
            totalProdKwh,
            avoidedCo2Ton,
            batchId,
            sheetName,
            rowNumber: r + 1,
            qualityStatus: yieldMwh === 0 && purchasedMwh > 0 ? 'PARTIAL' : 'COMPLETE',
            isAggregateRow: false
          },
          create: {
            yearMonth,
            dcId,
            plantNameRaw: rawName,
            yieldMwh,
            purchasedMwh,
            feedInMwh,
            loadMwh,
            totalProdMwh,
            yieldKwh,
            purchasedKwh,
            feedInKwh,
            loadKwh,
            totalProdKwh,
            avoidedCo2Ton,
            source: 'EXCEL_IMPORT',
            batchId,
            sheetName,
            rowNumber: r + 1,
            qualityStatus: yieldMwh === 0 && purchasedMwh > 0 ? 'PARTIAL' : 'COMPLETE',
            isAggregateRow: false
          }
        });
      }
    }

    sheetSummaries[sheetName] = {
      yearMonth,
      plantsCount: sheetCount,
      sumYieldMwh: Number(sheetYield.toFixed(5)),
      sumPurchasedMwh: Number(sheetPurchased.toFixed(5)),
      sumFeedInMwh: Number(sheetFeedIn.toFixed(5)),
      sumLoadMwh: Number(sheetLoad.toFixed(5)),
      sumTotalProdMwh: Number(sheetTotalProd.toFixed(5)),
      avoidedCo2Ton: Number((sheetTotalProd * 0.997).toFixed(5))
    };

    totalImported += sheetCount;
  }

  if (!dryRun) {
    await prisma.importBatch.create({
      data: {
        id: batchId,
        filename: path.basename(filePath),
        sheetName: monthlySheets.join(','),
        module: 'PLTS_ENERGY',
        recordCount: totalImported,
        status: errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
        errors,
        metadata: sheetSummaries
      }
    });
  }

  console.log(`[IMPORTER] PLTS import finished: ${totalImported} records processed across 8 monthly sheets.`);
  return {
    batchId,
    totalImported,
    sheetSummaries,
    errors
  };
}

/**
 * 5. Import Water Recycling from CSV
 */
export async function importWaterRecycleCSV(filePath = 'WR Thn 2026 Laporan H.O (akun SAT) - WR_Thn_2026.csv', { dryRun = false } = {}) {
  console.log(`[IMPORTER] Starting Water Recycle import from ${filePath} (dryRun=${dryRun})...`);
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const lines = content.split('\n');
  const batchId = `import-water-${Date.now()}`;
  let importedCount = 0;
  const errors = [];

  // Parse CSV rows starting after headers
  // Month columns: 
  // Col 2: Des 2025 (baseline)
  // Col 3: Jan 2026
  // Col 4: Feb 2026
  // Col 5: Mar 2026
  // Col 6: Apr 2026
  // Col 7: Mei 2026
  // Col 8: Jun 2026
  // Col 9: Jul 2026
  // Col 10: Agu 2026
  const monthCols = [
    { colIdx: 3, yearMonth: '2026-01', prevColIdx: 2 },
    { colIdx: 4, yearMonth: '2026-02', prevColIdx: 3 },
    { colIdx: 5, yearMonth: '2026-03', prevColIdx: 4 },
    { colIdx: 6, yearMonth: '2026-04', prevColIdx: 5 },
    { colIdx: 7, yearMonth: '2026-05', prevColIdx: 6 },
    { colIdx: 8, yearMonth: '2026-06', prevColIdx: 7 },
    { colIdx: 9, yearMonth: '2026-07', prevColIdx: 8 },
    { colIdx: 10, yearMonth: '2026-08', prevColIdx: 9 },
  ];

  function parseMeterValue(valStr) {
    if (!valStr) return null;
    const clean = String(valStr).replace(/"/g, '').trim();
    if (!clean || clean.toUpperCase().includes('RUSAK') || clean.toUpperCase().includes('TIDAK ADA')) {
      return null;
    }
    // Handle Indonesian formatting: "1.160,0" -> 1160.0 or "378,6" -> 378.6
    const standardized = clean.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(standardized);
    return isNaN(num) ? null : num;
  }

  for (let i = 5; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    // Split line respecting quotes
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const branchName = parts[1]?.replace(/"/g, '').trim();
    if (!branchName || branchName.toUpperCase().includes('TOTAL')) continue;

    const matchedMeta = lookupPlantMetadata({ plantName: branchName });
    const dcId = matchedMeta.psId || `DC-${branchName.toUpperCase().replace(/\s+/g, '-')}`;

    for (const m of monthCols) {
      const currMeter = parseMeterValue(parts[m.colIdx]);
      const prevMeter = parseMeterValue(parts[m.prevColIdx]);

      if (currMeter === null && prevMeter === null) continue;

      let volumeM3 = 0;
      let qualityStatus = 'VERIFIED';
      let notes = null;

      if (currMeter !== null && prevMeter !== null) {
        if (currMeter >= prevMeter) {
          volumeM3 = Number((currMeter - prevMeter).toFixed(2));
        } else {
          // Flow meter reset/replacement
          volumeM3 = currMeter;
          qualityStatus = 'ESTIMATED';
          notes = `Meter reset detected: Prev ${prevMeter}, Current ${currMeter}`;
        }
      } else if (currMeter !== null && prevMeter === null) {
        volumeM3 = 0;
        qualityStatus = 'PARTIAL';
        notes = 'Previous month meter reading missing';
      }

      const emissionAvoidedKg = Number((volumeM3 * CARBON_FACTORS.WATER.FACTOR_KG_PER_M3).toFixed(2));
      const emissionAvoidedTon = Number((emissionAvoidedKg / 1000).toFixed(4));
      const costSavedRupiah = Number((volumeM3 * CARBON_FACTORS.WATER.DEFAULT_PDAM_RATE_PER_M3).toFixed(0));

      if (!dryRun) {
        await prisma.waterActivity.upsert({
          where: {
            yearMonth_dcId_activityType: {
              yearMonth: m.yearMonth,
              dcId,
              activityType: 'RECYCLE'
            }
          },
          update: {
            branchName,
            meterStart: prevMeter,
            meterEnd: currMeter,
            volumeM3,
            emissionFactor: CARBON_FACTORS.WATER.FACTOR_KG_PER_M3,
            emissionAvoidedKg,
            emissionAvoidedTon,
            costSavedRupiah,
            ratePerM3: CARBON_FACTORS.WATER.DEFAULT_PDAM_RATE_PER_M3,
            qualityStatus,
            notes,
            source: 'EXCEL_IMPORT',
            batchId
          },
          create: {
            date: `${m.yearMonth}-28`,
            yearMonth: m.yearMonth,
            dcId,
            branchName,
            activityType: 'RECYCLE',
            meterStart: prevMeter,
            meterEnd: currMeter,
            volumeM3,
            emissionFactor: CARBON_FACTORS.WATER.FACTOR_KG_PER_M3,
            emissionAvoidedKg,
            emissionAvoidedTon,
            costSavedRupiah,
            ratePerM3: CARBON_FACTORS.WATER.DEFAULT_PDAM_RATE_PER_M3,
            qualityStatus,
            notes,
            source: 'EXCEL_IMPORT',
            batchId
          }
        });
      }

      importedCount++;
    }
  }

  if (!dryRun) {
    await prisma.importBatch.create({
      data: {
        id: batchId,
        filename: path.basename(filePath),
        sheetName: 'WR_Thn_2026',
        module: 'WATER_RECYCLE',
        recordCount: importedCount,
        status: errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
        errors
      }
    });
  }

  console.log(`[IMPORTER] Water recycle import finished: ${importedCount} records processed.`);
  return {
    batchId,
    importedCount,
    errors
  };
}

/**
 * Master Function: Run Full Data Ingestion Pipeline
 */
export async function runFullDataIngestionPipeline() {
  console.log('================================================================================');
  console.log('[DATA INGESTION PIPELINE] Starting full database seeding & real data import...');
  console.log('================================================================================');

  const plants = await seedPlantMaster();
  const factors = await seedEmissionFactorRegistry();
  const targets = await seedProductionTargets();
  const pltsResult = await importPLTSMonthlyWorkbook();
  const waterResult = await importWaterRecycleCSV();

  console.log('\n[DATA INGESTION PIPELINE] Pipeline Summary:');
  console.log(`- Plant Master seeded: ${plants}`);
  console.log(`- Emission Factors registered: ${factors}`);
  console.log(`- Production Targets seeded: ${targets}`);
  console.log(`- PLTS Energy records imported: ${pltsResult.totalImported}`);
  console.log(`- Water Recycle records imported: ${waterResult.importedCount}`);
  console.log('================================================================================\n');

  return {
    plants,
    factors,
    targets,
    pltsResult,
    waterResult
  };
}
