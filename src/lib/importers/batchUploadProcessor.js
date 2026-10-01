import * as XLSX from 'xlsx';
import prisma from '../prisma.js';
import {
  CARBON_FACTORS,
  getGridEmissionFactor,
  calculateScope1FuelEmission,
  calculateScope2ElectricityEmission,
  calculatePLTSAvoidedEmissions,
  calculateWaterRecycleImpact
} from '../carbon/carbonEngine.js';
import { MASTER_FACILITIES, findFacilityById } from '../master/facilityMaster.js';

export const TEMPLATE_VERSION = 'v2026.1';

/**
 * Clean numeric string or number into a Float
 */
export function parseCleanNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim();
  // Remove thousand separator dots or commas if standard formatting
  // e.g. "12.500.000,50" -> "12500000.50" or "12,500,000.50" -> "12500000.50"
  let cleaned = str.replace(/[Rp\s]/gi, '');
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // European format: 1.000,50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,000.50
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Format and sanitize date / period to YYYY-MM and YYYY-MM-DD
 */
export function parseDateAndPeriod(val) {
  if (!val) return { dateStr: null, yearMonth: null, isValid: false };

  // If Excel serial number (e.g. 45885)
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const year = d.y;
      const month = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      return {
        dateStr: `${year}-${month}-${day}`,
        yearMonth: `${year}-${month}`,
        isValid: true
      };
    }
  }

  const str = String(val).trim();

  // YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return {
      dateStr: `${year}-${month}-${day}`,
      yearMonth: `${year}-${month}`,
      isValid: true
    };
  }

  // YYYY-MM
  const ymMatch = str.match(/^(\d{4})[/-](\d{1,2})$/);
  if (ymMatch) {
    const year = ymMatch[1];
    const month = ymMatch[2].padStart(2, '0');
    return {
      dateStr: `${year}-${month}-01`,
      yearMonth: `${year}-${month}`,
      isValid: true
    };
  }

  // Month text format e.g. "Januari 2026", "Ags 2026", "2026-08"
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', jun: '06',
    jul: '07', ags: '08', agu: '08', aug: '08', sep: '09', okt: '10', oct: '10', nov: '11', des: '12', dec: '12'
  };

  const lower = str.toLowerCase();
  for (const [mName, mNum] of Object.entries(monthMap)) {
    if (lower.includes(mName)) {
      const yearMatch = str.match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
      return {
        dateStr: `${year}-${mNum}-01`,
        yearMonth: `${year}-${mNum}`,
        isValid: true
      };
    }
  }

  return { dateStr: null, yearMonth: null, isValid: false, raw: str };
}

/**
 * Detect Activity Category from Sheet Name or Header row
 */
export function detectCategoryFromSheet(headers = [], sheetName = '') {
  const headerStr = headers.map(h => String(h || '').toUpperCase()).join(' ');
  const sheetUpper = String(sheetName).toUpperCase();

  if (sheetUpper.includes('GENSET') || headerStr.includes('KAPASITAS_KVA') || headerStr.includes('KODE_ASET_GENSET')) {
    return 'GENSET';
  }
  if (sheetUpper.includes('KENDARAAN') || sheetUpper.includes('VEHICLE') || headerStr.includes('NOMOR_POLISI') || headerStr.includes('JENIS_KENDARAAN')) {
    return 'VEHICLE';
  }
  if (sheetUpper.includes('PLN') || sheetUpper.includes('LISTRIK') || headerStr.includes('KONSUMSI_LISTRIK') || headerStr.includes('ID_PELANGGAN_PLN')) {
    return 'PLN';
  }
  if (sheetUpper.includes('PLTS') || headerStr.includes('METRIK_ENERGI') || headerStr.includes('NOMOR_BUKTI_GATEWAY')) {
    return 'PLTS';
  }
  if (sheetUpper.includes('WATER') || sheetUpper.includes('AIR') || headerStr.includes('VOLUME_M3') || headerStr.includes('METER_AWAL')) {
    return 'WATER';
  }

  // Fallback check
  if (headerStr.includes('JENIS_BBM')) return 'GENSET';
  if (headerStr.includes('KONSUMSI')) return 'PLN';
  return 'GENSET';
}

/**
 * Parse and Validate Excel / CSV buffer or Array of Objects
 */
export async function parseAndValidateUpload(fileBuffer, { categoryHint = 'AUTO', filename = 'upload.xlsx' } = {}) {
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });

  // Priority sheet: DATA_INPUT or first sheet
  const targetSheetName = wb.SheetNames.find(s => s.toUpperCase() === 'DATA_INPUT') || wb.SheetNames[0];
  const ws = wb.Sheets[targetSheetName];

  if (!ws) {
    return {
      success: false,
      error: 'Sheet data tidak ditemukan dalam file Excel / CSV',
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      records: []
    };
  }

  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (!rawRows || rawRows.length < 2) {
    return {
      success: false,
      error: 'File tidak memuat baris data transaksi (minimal 1 baris header + 1 baris data)',
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      records: []
    };
  }

  const headers = rawRows[0].map(h => String(h || '').trim().toUpperCase());
  const detectedCategory = categoryHint !== 'AUTO' ? categoryHint : detectCategoryFromSheet(headers, targetSheetName);

  const headerIndexMap = {};
  headers.forEach((h, idx) => {
    headerIndexMap[h] = idx;
  });

  const parsedRecords = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  let exampleRowsSkipped = 0;

  const seenRecordKeys = new Set();

  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
    const row = rawRows[rowIndex];
    if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
      continue; // Skip empty rows
    }

    const rowNumber = rowIndex + 1;
    const errors = [];
    const warnings = [];

    // Helper getter by header name alias
    const getVal = (...aliases) => {
      for (const a of aliases) {
        const u = a.toUpperCase();
        if (headerIndexMap[u] !== undefined) {
          return row[headerIndexMap[u]];
        }
      }
      return undefined;
    };

    // 1. Check if example row marked for skipping anywhere in the row
    const isSampleRow = row.some(cell => cell && String(cell).toUpperCase().includes('CONTOH'));
    if (isSampleRow) {
      exampleRowsSkipped++;
      continue; // Ignore template sample rows safely
    }

    // 2. Extract common fields
    const facCodeRaw = getVal('KODE_FASILITAS', 'KODE_DC', 'KODE_FASILITAS_ATAU_PLANT', 'KODE', 'FACILITY_CODE');
    const periodRaw = getVal('PERIODE_BULAN', 'TANGGAL_PENGISIAN', 'PERIODE', 'TANGGAL', 'DATE');
    const explicitProof = getVal('NOMOR_BUKTI_INVOICE', 'NOMOR_BUKTI_STRUK', 'NOMOR_FAKTUR_TAGIHAN', 'NOMOR_BUKTI_GATEWAY', 'NOMOR_LOGBOOK_AIR', 'NOMOR_BUKTI', 'PROOF_REF');
    const assetOrMeterId = getVal('ID_PELANGGAN_PLN', 'ID_PELANGGAN', 'KODE_ASET_GENSET', 'ASSET_CODE', 'NOMOR_POLISI', 'PLAT_NOMOR', 'VEHICLE_PLATE', 'ID_METER_AIR', 'METER_ID');
    
    let proofRefRaw = [];
    if (explicitProof) proofRefRaw.push(String(explicitProof).trim());
    if (assetOrMeterId) proofRefRaw.push(String(assetOrMeterId).trim());
    const proofRef = proofRefRaw.length > 0 ? proofRefRaw.join('|') : 'MAIN';
    const notesVal = String(getVal('CATATAN_AUDIT', 'KETERANGAN', 'NOTES', 'CATATAN') || '');

    if (!facCodeRaw) {
      errors.push('Kode Fasilitas wajib diisi');
    }

    const facCode = String(facCodeRaw || '').trim();
    const facility = findFacilityById(facCode);

    if (!facility) {
      errors.push(`Kode fasilitas '${facCode}' tidak terdaftar pada Master Fasilitas resmi`);
    }

    const { dateStr, yearMonth, isValid: isDateValid } = parseDateAndPeriod(periodRaw);
    if (!isDateValid) {
      errors.push(`Format tanggal/periode '${periodRaw}' tidak valid (Gunakan format YYYY-MM atau YYYY-MM-DD)`);
    }

    let categoryData = {};
    let calculatedResult = null;
    let qualityStatus = 'VERIFIED';

    // 3. Category-specific Parsing & Validation
    if (detectedCategory === 'GENSET') {
      const fuelTypeRaw = String(getVal('JENIS_BBM', 'FUEL_TYPE') || 'SOLAR').trim().toUpperCase();
      const inputMode = String(getVal('MODE_INPUT', 'INPUT_MODE') || 'LITER').trim().toUpperCase();
      const liters = parseCleanNumber(getVal('JUMLAH_LITER', 'LITER', 'LITERS'));
      const costRupiah = parseCleanNumber(getVal('TOTAL_RUPIAH', 'NILAI_RUPIAH', 'RUPIAH', 'BIAYA_RUPIAH', 'COST_RUPIAH'));
      const pricePerLiter = parseCleanNumber(getVal('HARGA_PER_LITER', 'PRICE_PER_LITER'));
      const assetCode = getVal('KODE_ASET_GENSET', 'ASSET_CODE');
      const kvaRating = parseCleanNumber(getVal('KAPASITAS_KVA', 'KVA'));
      const runHours = parseCleanNumber(getVal('JAM_OPERASI', 'RUN_HOURS'));

      if (!['SOLAR', 'BIOSOLAR', 'BIO_SOLAR', 'PERTALITE', 'PERTAMAX'].includes(fuelTypeRaw)) {
        errors.push(`Jenis BBM '${fuelTypeRaw}' tidak valid (Harus SOLAR, BIOSOLAR, PERTALITE, atau PERTAMAX)`);
      }

      if (inputMode === 'LITER' && (liters === null || liters <= 0)) {
        errors.push('Jumlah liter harus lebih dari 0 pada mode LITER');
      } else if (inputMode === 'RUPIAH' && (costRupiah === null || costRupiah <= 0)) {
        errors.push('Total rupiah harus lebih dari 0 pada mode RUPIAH');
      }

      if (fuelTypeRaw === 'PERTAMAX') {
        qualityStatus = 'DRAFT';
        warnings.push('Faktor Pertamax berstatus PENDING_VALIDATION. Disimpan sebagai DRAFT.');
      }

      const normalizedFuelType = (fuelTypeRaw === 'BIOSOLAR' || fuelTypeRaw === 'BIO_SOLAR') ? 'SOLAR' : fuelTypeRaw;

      if (errors.length === 0) {
        calculatedResult = calculateScope1FuelEmission({
          fuelType: normalizedFuelType,
          liters: inputMode === 'LITER' ? liters : null,
          costRupiah: inputMode === 'RUPIAH' ? costRupiah : null,
          pricePerLiter
        });
      }

      categoryData = {
        activityType: 'GENSET',
        fuelType: fuelTypeRaw,
        inputMode,
        liters: calculatedResult ? calculatedResult.liters : (liters || 0),
        costRupiah: calculatedResult ? calculatedResult.costRupiah : costRupiah,
        pricePerLiter: calculatedResult ? calculatedResult.pricePerLiter : pricePerLiter,
        assetCode: assetCode ? String(assetCode).trim() : null,
        kvaRating,
        runHours
      };
    } else if (detectedCategory === 'VEHICLE') {
      const fuelTypeRaw = String(getVal('JENIS_BBM', 'FUEL_TYPE') || 'PERTALITE').trim().toUpperCase();
      const inputMode = String(getVal('MODE_INPUT', 'INPUT_MODE') || 'LITER').trim().toUpperCase();
      const liters = parseCleanNumber(getVal('JUMLAH_LITER', 'LITER', 'LITERS'));
      const costRupiah = parseCleanNumber(getVal('TOTAL_RUPIAH', 'RUPIAH', 'BIAYA_RUPIAH'));
      const pricePerLiter = parseCleanNumber(getVal('HARGA_PER_LITER', 'PRICE_PER_LITER'));
      const vehiclePlate = getVal('NOMOR_POLISI', 'PLAT_NOMOR', 'VEHICLE_PLATE');
      const vehicleType = getVal('JENIS_KENDARAAN', 'VEHICLE_TYPE') || 'OPERATIONAL_CAR';
      const operatorUnit = getVal('UNIT_PENANGGUNG_JAWAB', 'OPERATOR_UNIT') || 'Operasional';

      if (!['SOLAR', 'PERTALITE', 'PERTAMAX'].includes(fuelTypeRaw)) {
        errors.push(`Jenis BBM '${fuelTypeRaw}' tidak valid`);
      }

      if (inputMode === 'LITER' && (liters === null || liters <= 0)) {
        errors.push('Jumlah liter harus lebih dari 0 pada mode LITER');
      } else if (inputMode === 'RUPIAH' && (costRupiah === null || costRupiah <= 0)) {
        errors.push('Total rupiah harus lebih dari 0 pada mode RUPIAH');
      }

      if (fuelTypeRaw === 'PERTAMAX') {
        qualityStatus = 'DRAFT';
        warnings.push('Faktor Pertamax berstatus PENDING_VALIDATION. Disimpan sebagai DRAFT.');
      }

      if (errors.length === 0) {
        calculatedResult = calculateScope1FuelEmission({
          fuelType: fuelTypeRaw,
          liters: inputMode === 'LITER' ? liters : null,
          costRupiah: inputMode === 'RUPIAH' ? costRupiah : null,
          pricePerLiter
        });
      }

      categoryData = {
        activityType: 'VEHICLE',
        fuelType: fuelTypeRaw,
        inputMode,
        liters: calculatedResult ? calculatedResult.liters : (liters || 0),
        costRupiah: calculatedResult ? calculatedResult.costRupiah : costRupiah,
        pricePerLiter: calculatedResult ? calculatedResult.pricePerLiter : pricePerLiter,
        vehiclePlate: vehiclePlate ? String(vehiclePlate).trim() : null,
        vehicleType: String(vehicleType).trim(),
        operatorUnit: String(operatorUnit).trim()
      };
    } else if (detectedCategory === 'PLN') {
      const rawEnergy = parseCleanNumber(getVal('KONSUMSI_LISTRIK', 'KONSUMSI_LISTRIK_KWH', 'PURCHASED_ELECTRICITY_KWH', 'PURCHASED_ELECTRICITY', 'KWH', 'ENERGY'));
      const unit = String(getVal('SATUAN_ENERGI', 'SATUAN') || 'kWh').trim();
      const customerId = getVal('ID_PELANGGAN_PLN', 'ID_PELANGGAN');
      const powerVa = parseCleanNumber(getVal('DAYA_TERPASANG_VA', 'DAYA_VA'));
      const meterType = String(getVal('TIPE_METER', 'METER_TYPE') || 'DEDICATED').trim().toUpperCase();
      const billRupiah = parseCleanNumber(getVal('TOTAL_TAGIHAN_RUPIAH', 'TAGIHAN_RUPIAH'));

      if (rawEnergy === null || rawEnergy < 0) {
        errors.push('Konsumsi listrik wajib diisi angka non-negatif');
      }

      const multiplier = unit.toUpperCase() === 'MWH' ? 1000 : 1;
      const effectiveKwh = (rawEnergy || 0) * multiplier;

      if (errors.length === 0 && facility) {
        calculatedResult = calculateScope2ElectricityEmission({
          kwh: effectiveKwh,
          locationName: facility.name,
          customGridFactor: facility.gridFactor
        });
      }

      categoryData = {
        kwh: effectiveKwh,
        unit: 'kWh',
        customerId: customerId ? String(customerId).trim() : null,
        powerVa,
        meterType,
        billRupiah
      };
    } else if (detectedCategory === 'PLTS') {
      const rawEnergy = parseCleanNumber(getVal('NILAI_ENERGI', 'PRODUKSI_PLTS', 'ENERGY'));
      const unit = String(getVal('SATUAN_ENERGI', 'SATUAN') || 'kWh').trim();
      const metricType = String(getVal('METRIK_ENERGI', 'METRIC_TYPE') || 'YIELD').trim().toUpperCase();
      const factorMethod = String(getVal('METODE_FAKTOR_REDUKSI', 'FACTOR_METHOD') || 'RKAP_CORPORATE_0.997').trim();

      if (rawEnergy === null || rawEnergy < 0) {
        errors.push('Nilai energi PLTS wajib diisi angka non-negatif');
      }

      const multiplier = unit.toUpperCase() === 'MWH' ? 1000 : 1;
      const effectiveKwh = (rawEnergy || 0) * multiplier;
      const useRkap = !factorMethod.toUpperCase().includes('GRID');

      if (errors.length === 0 && facility) {
        calculatedResult = calculatePLTSAvoidedEmissions({
          energyKwh: effectiveKwh,
          locationName: facility.name,
          useCorporateRkapFactor: useRkap
        });
      }

      categoryData = {
        energyKwh: effectiveKwh,
        metricType,
        factorMethod
      };
    } else if (detectedCategory === 'WATER') {
      const inputMode = String(getVal('MODE_INPUT', 'INPUT_MODE') || 'VOLUME').trim().toUpperCase();
      const volumeM3 = parseCleanNumber(getVal('VOLUME_M3', 'VOLUME', 'RECYCLED_M3'));
      const meterStart = parseCleanNumber(getVal('METER_AWAL_M3', 'METER_AWAL'));
      const meterEnd = parseCleanNumber(getVal('METER_AKHIR_M3', 'METER_AKHIR'));
      const meterId = getVal('ID_METER_AIR', 'METER_ID');
      const pdamRate = parseCleanNumber(getVal('ASUMSI_TARIF_PDAM', 'TARIF_PDAM')) || 8000;

      let effectiveM3 = 0;
      if (inputMode === 'METER') {
        if (meterStart === null || meterEnd === null) {
          errors.push('Meter Awal dan Meter Akhir wajib diisi pada mode METER');
        } else if (meterEnd < meterStart) {
          errors.push(`Meter Akhir (${meterEnd}) tidak boleh lebih kecil dari Meter Awal (${meterStart})`);
        } else {
          effectiveM3 = meterEnd - meterStart;
        }
      } else {
        if (volumeM3 === null || volumeM3 < 0) {
          errors.push('Volume daur ulang air (m3) wajib diisi angka non-negatif');
        } else {
          effectiveM3 = volumeM3;
        }
      }

      if (errors.length === 0) {
        calculatedResult = calculateWaterRecycleImpact({
          recycledM3: effectiveM3,
          pdamTariffPerM3: pdamRate
        });
      }

      categoryData = {
        inputMode,
        volumeM3: effectiveM3,
        meterStart,
        meterEnd,
        meterId: meterId ? String(meterId).trim() : null,
        pdamRate
      };
    }

    // 4. Duplicate Check within the same file batch
    const uniqueKey = `${detectedCategory}_${facCode}_${yearMonth}_${proofRef}`;
    if (seenRecordKeys.has(uniqueKey)) {
      duplicateCount++;
      warnings.push(`Duplikasi terdeteksi pada baris file yang sama (${facCode} ${yearMonth})`);
    } else {
      seenRecordKeys.add(uniqueKey);
    }

    const isValid = errors.length === 0;
    if (isValid) validCount++;
    else invalidCount++;

    const isDraft = qualityStatus === 'DRAFT' || categoryData?.fuelType === 'PERTAMAX';
    const factorApplied = calculatedResult ? (calculatedResult.factorKgPerLiter || calculatedResult.gridFactor || calculatedResult.factorUsed || calculatedResult.emissionFactor || 0) : 0;

    parsedRecords.push({
      rowNumber,
      isValid,
      isDraft,
      category: detectedCategory,
      facilityCode: facCode,
      facilityName: facility ? facility.name : facCode,
      facilityId: facility ? facility.id : null,
      region: facility ? (facility.region || facility.province) : null,
      gridFactor: facility ? (facility.gridFactor || 0.87) : 0.87,
      date: dateStr || `${yearMonth}-01`,
      dateStr: dateStr || `${yearMonth}-01`,
      period: yearMonth,
      yearMonth,
      proofRef: String(proofRef).trim(),
      notes: notesVal,
      qualityStatus,
      categoryData,
      normalizedCalculation: {
        liters: categoryData?.liters !== undefined ? categoryData.liters : null,
        kwh: categoryData?.kwh !== undefined ? categoryData.kwh : (categoryData?.energyKwh !== undefined ? categoryData.energyKwh : null),
        volumeM3: categoryData?.volumeM3 !== undefined ? categoryData.volumeM3 : null
      },
      factorApplied,
      calculatedResult,
      errors,
      warnings
    });
  }

  // 5. Check against Database for Conflict / No-Op (UNCHANGED)
  if (parsedRecords.length > 0) {
    const uniqueYearMonths = [...new Set(parsedRecords.map(r => r.yearMonth))].filter(Boolean);
    const uniqueDcIds = [...new Set(parsedRecords.map(r => r.facilityCode))].filter(Boolean);

    try {
      if (detectedCategory === 'GENSET' || detectedCategory === 'VEHICLE') {
        const existingFuels = await prisma.fuelActivity.findMany({
          where: { yearMonth: { in: uniqueYearMonths }, dcId: { in: uniqueDcIds }, source: 'EXCEL_IMPORT' }
        });
        for (const r of parsedRecords) {
          if (!r.isValid) continue;
          const fuelType = r.categoryData?.fuelType || 'SOLAR';
          const match = existingFuels.find(x => x.yearMonth === r.yearMonth && x.dcId === r.facilityCode && x.fuelType === fuelType && x.proofRef === r.proofRef);
          if (match) {
            const isIdentical = match.liters === (r.categoryData?.liters || 0);
            r.qualityStatus = isIdentical ? 'UNCHANGED' : 'CONFLICT';
            if (!isIdentical) {
              r.warnings.push(`Konflik: Data sudah ada dengan nilai ${match.liters} LITER.`);
            }
          }
        }
      } else if (detectedCategory === 'PLN' || detectedCategory === 'PLTS') {
        const existingEnergy = await prisma.energyMeasurement.findMany({
          where: { yearMonth: { in: uniqueYearMonths }, dcId: { in: uniqueDcIds }, source: 'EXCEL_IMPORT', category: detectedCategory }
        });
        for (const r of parsedRecords) {
          if (!r.isValid) continue;
          const match = existingEnergy.find(x => x.yearMonth === r.yearMonth && x.dcId === r.facilityCode && x.proofRef === r.proofRef);
          if (match) {
            const kwh = detectedCategory === 'PLN' ? (r.categoryData?.kwh || 0) : (r.categoryData?.energyKwh || 0);
            const matchKwh = detectedCategory === 'PLN' ? match.purchasedKwh : match.totalProdKwh; // totalProdKwh contains the PLTS kwh
            const isIdentical = matchKwh === kwh;
            r.qualityStatus = isIdentical ? 'UNCHANGED' : 'CONFLICT';
            if (!isIdentical) {
              r.warnings.push(`Konflik: Data sudah ada dengan nilai ${matchKwh} kWh.`);
            }
          }
        }
      } else if (detectedCategory === 'WATER') {
        const existingWater = await prisma.waterActivity.findMany({
          where: { yearMonth: { in: uniqueYearMonths }, dcId: { in: uniqueDcIds }, source: 'EXCEL_IMPORT' }
        });
        for (const r of parsedRecords) {
          if (!r.isValid) continue;
          // Water might not use proofRef explicitly in its unique constraint. Schema says: @@unique([yearMonth, dcId, activityType])
          const activityType = 'RECYCLE';
          const match = existingWater.find(x => x.yearMonth === r.yearMonth && x.dcId === r.facilityCode && x.activityType === activityType);
          if (match) {
            const isIdentical = match.volumeM3 === (r.categoryData?.volumeM3 || 0);
            r.qualityStatus = isIdentical ? 'UNCHANGED' : 'CONFLICT';
            if (!isIdentical) {
              r.warnings.push(`Konflik: Data sudah ada dengan nilai ${match.volumeM3} m3.`);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[IMPORTER] Gagal mengecek konflik DB:', e.message);
    }
  }

  const draftCount = parsedRecords.filter(r => r.isDraft).length;
  const totalEmissionTon = parsedRecords
    .filter(r => r.isValid && (r.category === 'GENSET' || r.category === 'VEHICLE' || r.category === 'PLN'))
    .reduce((acc, r) => acc + (r.calculatedResult?.emissionTon || 0), 0);
  const totalAvoidedTon = parsedRecords
    .filter(r => r.isValid && (r.category === 'PLTS' || r.category === 'WATER'))
    .reduce((acc, r) => acc + (r.calculatedResult?.co2AvoidedTon || r.calculatedResult?.emissionAvoidedTon || 0), 0);

  return {
    success: true,
    filename,
    templateVersion: TEMPLATE_VERSION,
    category: detectedCategory,
    sheetName: targetSheetName,
    totalRows: parsedRecords.length,
    validCount,
    errorCount: invalidCount,
    invalidCount,
    draftCount,
    duplicateCount,
    exampleRowsSkipped,
    totalEmissionTon,
    totalAvoidedTon,
    records: parsedRecords
  };
}

/**
 * Commit Valid Batch Records to PostgreSQL via Prisma
 */
export async function commitBatchToDatabase({
  records = [],
  category = 'GENSET',
  filename = 'import.xlsx',
  allowPartial = false,
  isDraft = false
}) {
  const validRecords = allowPartial ? records.filter(r => r.isValid) : records;

  if (!allowPartial && records.some(r => !r.isValid)) {
    throw new Error('Terdapat baris data yang memiliki error. Perbaiki error atau aktifkan opsi "Izinkan Impor Sebagian Baris Valid".');
  }

  if (validRecords.length === 0) {
    throw new Error('Tidak ada baris data valid yang dapat disimpan ke database.');
  }

  const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  let committedCount = 0;
  let skippedDuplicates = 0;

  for (const item of validRecords) {
    if (item.qualityStatus === 'UNCHANGED') {
      skippedDuplicates++;
      continue;
    }

    const { category, facilityId, facilityCode, facilityName, dateStr, yearMonth, proofRef, notes, categoryData, calculatedResult } = item;
    const finalStatus = isDraft ? 'DRAFT' : (item.qualityStatus || 'VERIFIED');
    const rowDate = dateStr || item.date || item.dateStr || (yearMonth ? `${yearMonth}-01` : new Date().toISOString().split('T')[0]);
    const rowYearMonth = yearMonth || item.yearMonth || item.period || rowDate.substring(0, 7);

    if (category === 'GENSET' || category === 'VEHICLE') {
      const liters = calculatedResult ? calculatedResult.liters : (categoryData?.liters || 0);
      const emissionTon = calculatedResult ? calculatedResult.emissionTon : 0;
      const emissionKg = calculatedResult ? calculatedResult.emissionKg : 0;
      const ef = calculatedResult ? calculatedResult.factorKgPerLiter : 2.6685;

      // Idempotent Upsert FuelActivity
      const existingFuel = await prisma.fuelActivity.findFirst({
        where: { 
          dcId: facilityCode, 
          yearMonth: rowYearMonth, 
          fuelType: categoryData?.fuelType || 'SOLAR',
          source: 'EXCEL_IMPORT',
          proofRef: proofRef || 'MAIN'
        }
      });

      if (existingFuel) {
        await prisma.fuelActivity.update({
          where: { id: existingFuel.id },
          data: {
            date: rowDate,
            yearMonth: rowYearMonth,
            liters,
            costRupiah: categoryData?.costRupiah,
            pricePerLiter: categoryData?.pricePerLiter,
            emissionFactor: ef,
            emissionKg,
            emissionTon,
            status: finalStatus,
            validationNote: (item.warnings || []).join('; ') || 'Batch imported via SPARTA Excel/CSV Importer',
            batchId,
            metadata: {
              originalRow: item.rowNumber,
              normalizedValues: item.normalizedCalculation || {},
              factorApplied: item.factorApplied || null,
              factorSource: calculatedResult?.factorSource || 'UNKNOWN'
            }
          }
        });
      } else {
        await prisma.fuelActivity.create({
          data: {
            date: rowDate,
            yearMonth: rowYearMonth,
            dcId: facilityCode,
            facilityType: categoryData?.activityType === 'GENSET' ? 'warehouse' : 'vehicle',
            warehouseSub: categoryData?.activityType,
            fuelType: categoryData?.fuelType || 'SOLAR',
            liters,
            costRupiah: categoryData?.costRupiah,
            pricePerLiter: categoryData?.pricePerLiter,
            emissionFactor: ef,
            emissionKg,
            emissionTon,
            scope: 'SCOPE_1',
            status: finalStatus,
            validationNote: (item.warnings || []).join('; ') || 'Batch imported via SPARTA Excel/CSV Importer',
            source: 'EXCEL_IMPORT',
            batchId,
            proofRef: proofRef || 'MAIN',
            metadata: {
              originalRow: item.rowNumber,
              normalizedValues: item.normalizedCalculation || {},
              factorApplied: item.factorApplied || null,
              factorSource: calculatedResult?.factorSource || 'UNKNOWN'
            }
          }
        });
      }
      committedCount++;
    } else if (category === 'PLN' || category === 'PLTS') {
      const kwh = category === 'PLN' ? (categoryData?.kwh || 0) : (categoryData?.energyKwh || 0);
      const mwh = kwh / 1000;
      const avoidedTon = calculatedResult ? (calculatedResult.co2AvoidedTon || 0) : 0;
      const recordProofRef = proofRef || '';

      await prisma.energyMeasurement.upsert({
        where: {
          yearMonth_dcId_source_category_proofRef: {
            yearMonth: rowYearMonth,
            dcId: facilityCode,
            source: 'EXCEL_IMPORT',
            category,
            proofRef: recordProofRef
          }
        },
        create: {
          yearMonth: rowYearMonth,
          dcId: facilityCode,
          plantNameRaw: facilityName,
          yieldKwh: category === 'PLTS' ? kwh : 0,
          yieldMwh: category === 'PLTS' ? mwh : 0,
          purchasedKwh: category === 'PLN' ? kwh : 0,
          purchasedMwh: category === 'PLN' ? mwh : 0,
          totalProdKwh: category === 'PLTS' ? kwh : 0,
          totalProdMwh: category === 'PLTS' ? mwh : 0,
          avoidedCo2Ton: avoidedTon,
          source: 'EXCEL_IMPORT',
          category,
          proofRef: recordProofRef,
          batchId,
          sheetName: 'DATA_INPUT',
          rowNumber: item.rowNumber,
          qualityStatus: finalStatus,
          isAggregateRow: false,
          metadata: {
            originalRow: item.rowNumber,
            normalizedValues: item.normalizedCalculation || {},
            factorApplied: item.factorApplied || null,
            factorSource: calculatedResult?.factorSource || 'UNKNOWN'
          }
        },
        update: {
          plantNameRaw: facilityName,
          yieldKwh: category === 'PLTS' ? kwh : undefined,
          yieldMwh: category === 'PLTS' ? mwh : undefined,
          purchasedKwh: category === 'PLN' ? kwh : undefined,
          purchasedMwh: category === 'PLN' ? mwh : undefined,
          totalProdKwh: category === 'PLTS' ? kwh : undefined,
          totalProdMwh: category === 'PLTS' ? mwh : undefined,
          avoidedCo2Ton: avoidedTon,
          qualityStatus: finalStatus,
          batchId,
          metadata: {
            originalRow: item.rowNumber,
            normalizedValues: item.normalizedCalculation || {},
            factorApplied: item.factorApplied || null,
            factorSource: calculatedResult?.factorSource || 'UNKNOWN'
          }
        }
      });
      committedCount++;
    } else if (category === 'WATER') {
      const volumeM3 = categoryData?.volumeM3 || 0;
      const avoidedTon = calculatedResult ? (calculatedResult.emissionAvoidedTon || 0) : 0;
      const costSaved = calculatedResult ? (calculatedResult.costSavedRupiah || 0) : 0;

      await prisma.waterActivity.upsert({
        where: {
          yearMonth_dcId_activityType: {
            yearMonth: rowYearMonth,
            dcId: facilityCode,
            activityType: 'RECYCLE'
          }
        },
        create: {
          date: rowDate,
          yearMonth: rowYearMonth,
          dcId: facilityCode,
          branchName: facilityName,
          activityType: 'RECYCLE',
          meterStart: categoryData?.meterStart,
          meterEnd: categoryData?.meterEnd,
          volumeM3,
          emissionFactor: 0.344,
          emissionAvoidedKg: avoidedTon * 1000,
          emissionAvoidedTon: avoidedTon,
          costSavedRupiah: costSaved,
          ratePerM3: categoryData?.pdamRate || 8000,
          qualityStatus: finalStatus,
          notes: notes || 'Batch imported via SPARTA Excel/CSV Importer',
          source: 'EXCEL_IMPORT',
          batchId,
          metadata: {
            originalRow: item.rowNumber,
            normalizedValues: item.normalizedCalculation || {},
            factorApplied: item.factorApplied || null,
            factorSource: calculatedResult?.factorSource || 'UNKNOWN'
          }
        },
        update: {
          meterStart: categoryData?.meterStart,
          meterEnd: categoryData?.meterEnd,
          volumeM3,
          emissionAvoidedKg: avoidedTon * 1000,
          emissionAvoidedTon: avoidedTon,
          costSavedRupiah: costSaved,
          qualityStatus: finalStatus,
          batchId,
          metadata: {
            originalRow: item.rowNumber,
            normalizedValues: item.normalizedCalculation || {},
            factorApplied: item.factorApplied || null,
            factorSource: calculatedResult?.factorSource || 'UNKNOWN'
          }
        }
      });
      committedCount++;
    }
  }

  // Create Batch Log in ImportBatch model
  await prisma.importBatch.create({
    data: {
      id: batchId,
      filename,
      sheetName: 'DATA_INPUT',
      module: category,
      recordCount: committedCount,
      status: records.some(r => !r.isValid) ? 'PARTIAL' : 'SUCCESS',
      errors: records.filter(r => !r.isValid).map(r => ({ row: r.rowNumber, errors: r.errors || [] })),
      metadata: {
        totalRows: records.length,
        committedCount,
        allowPartial,
        isDraft,
        importedAt: new Date().toISOString()
      }
    }
  });

  return {
    success: true,
    batchId,
    committedCount,
    skippedDuplicates,
    totalRecords: records.length,
    status: isDraft ? 'DRAFT' : 'FINAL'
  };
}
