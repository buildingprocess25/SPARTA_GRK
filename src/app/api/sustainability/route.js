import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.js';
import {
  reconcileCarbonBalance,
  CARBON_FACTORS,
  calculateScope1FuelEmission,
  calculateScope2ElectricityEmission,
  calculatePLTSAvoidedEmissions,
  calculateWaterRecycleImpact,
  getGridEmissionFactor
} from '@/lib/carbon/carbonEngine';

// Micro-cache (10 seconds) for performance
let cachedPayload = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10_000;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const now = Date.now();
    if (!forceRefresh && cachedPayload && now - lastCacheTime < CACHE_TTL_MS) {
      return NextResponse.json(cachedPayload, {
        headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=10' }
      });
    }

    // 1. Fetch Real Energy Measurements from DB (Only Verified/Active, exclude DRAFT from actuals)
    const energyRecords = await prisma.energyMeasurement.findMany({
      where: { qualityStatus: { not: 'DRAFT' } },
      orderBy: [{ yearMonth: 'asc' }, { dcId: 'asc' }]
    });

    // 2. Fetch Real Water Activity Records from DB (Exclude DRAFT from actuals)
    const waterRecords = await prisma.waterActivity.findMany({
      where: { qualityStatus: { not: 'DRAFT' } },
      orderBy: [{ yearMonth: 'asc' }, { branchName: 'asc' }]
    });

    // 3. Fetch Fuel Activity Records from DB (Exclude DRAFT from actuals)
    const fuelRecords = await prisma.fuelActivity.findMany({
      where: { status: { in: ['ACTIVE', 'APPROVED', 'VERIFIED'] } },
      orderBy: [{ date: 'desc' }]
    });

    // 4. Fetch Targets from DB
    const targetRecords = await prisma.productionTarget.findMany({
      orderBy: [{ yearMonth: 'asc' }]
    });

    // 5. Fetch Canonical Plant Masters
    const plantMasters = await prisma.plantMaster.findMany({
      orderBy: [{ canonicalName: 'asc' }]
    });

    // 6. Aggregate Monthly Trends for PLTS Energy (8 months)
    const monthKeys = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags'];

    const pltsMonthlyTrend = monthKeys.map((ym, idx) => {
      const monthMeasurements = energyRecords.filter(r => r.yearMonth === ym && !r.isAggregateRow);
      const totalYieldMwh = monthMeasurements.reduce((acc, r) => acc + r.yieldMwh, 0);
      const totalPurchasedMwh = monthMeasurements.reduce((acc, r) => acc + r.purchasedMwh, 0);
      const totalFeedInMwh = monthMeasurements.reduce((acc, r) => acc + r.feedInMwh, 0);
      const totalLoadMwh = monthMeasurements.reduce((acc, r) => acc + r.loadMwh, 0);
      const totalProdMwh = monthMeasurements.reduce((acc, r) => acc + r.totalProdMwh, 0);
      const avoidedCo2Ton = totalProdMwh * CARBON_FACTORS.PLTS_PORTFOLIO.CO2_AVOIDED_TON_PER_MWH;

      return {
        month: monthLabels[idx],
        yearMonth: ym,
        pltsGen: Number((totalYieldMwh * 1000).toFixed(1)), // in kWh for chart
        pltsGenMwh: Number(totalYieldMwh.toFixed(5)),
        purchasedMwh: Number(totalPurchasedMwh.toFixed(5)),
        feedInMwh: Number(totalFeedInMwh.toFixed(5)),
        loadMwh: Number(totalLoadMwh.toFixed(5)),
        totalProdMwh: Number(totalProdMwh.toFixed(5)),
        avoidedCo2Ton: Number(avoidedCo2Ton.toFixed(3)),
        plantCount: monthMeasurements.length
      };
    });

    // 7. Aggregate Monthly Trends for Water Recycle
    const waterMonthlyTrend = monthKeys.map((ym, idx) => {
      const monthWater = waterRecords.filter(r => r.yearMonth === ym);
      const totalVolumeM3 = monthWater.reduce((acc, r) => acc + r.volumeM3, 0);
      const avoidedCo2Ton = monthWater.reduce((acc, r) => acc + r.emissionAvoidedTon, 0);
      const costSavedRupiah = monthWater.reduce((acc, r) => acc + (r.costSavedRupiah || 0), 0);

      return {
        month: monthLabels[idx],
        yearMonth: ym,
        recycled: Number(totalVolumeM3.toFixed(2)),
        avoidedCo2Ton: Number(avoidedCo2Ton.toFixed(3)),
        costSavedJuta: Number((costSavedRupiah / 1_000_000).toFixed(2)),
        recordCount: monthWater.length
      };
    });

    // 8. Aggregate Scope 1 & Scope 2 (Strictly Actual)
    const totalPltsAvoidedTon = pltsMonthlyTrend.reduce((acc, m) => acc + m.avoidedCo2Ton, 0);
    const totalWaterAvoidedTon = waterMonthlyTrend.reduce((acc, m) => acc + m.avoidedCo2Ton, 0);
    const totalPltsCostSavedJuta = (pltsMonthlyTrend.reduce((acc, m) => acc + m.pltsGen, 0) * CARBON_FACTORS.TARIFFS.ELECTRICITY_PLN_PER_KWH) / 1_000_000;
    const totalWaterCostSavedJuta = waterMonthlyTrend.reduce((acc, m) => acc + m.costSavedJuta, 0);

    // Sum purchased electricity for Scope 2 (purchased MWh converted to kWh * Grid factor)
    const totalPurchasedKwh = energyRecords.filter(r => !r.isAggregateRow).reduce((acc, r) => acc + r.purchasedKwh, 0);
    const scope2TotalEmissionTon = Number(((totalPurchasedKwh * 0.87) / 1000).toFixed(2));

    // Fuel Scope 1 from fuelRecords strictly
    const fuelScope1Ton = fuelRecords.reduce((acc, r) => acc + r.emissionTon, 0);
    const hasFuelData = fuelRecords.length > 0;

    const carbonBalance = reconcileCarbonBalance({
      scope1Ton: fuelScope1Ton,
      scope2Ton: scope2TotalEmissionTon,
      pltsAvoidedTon: totalPltsAvoidedTon,
      waterAvoidedTon: totalWaterAvoidedTon,
      pltsCostSavedJuta: totalPltsCostSavedJuta,
      waterCostSavedJuta: totalWaterCostSavedJuta
    });

    const payload = {
      status: 'success',
      timestamp: new Date().toISOString(),
      source: 'DATABASE_POSTGRESQL_VERIFIED_TRANSACTIONS',
      counts: {
        plants: plantMasters.length,
        energyMeasurements: energyRecords.length,
        waterActivities: waterRecords.length,
        fuelActivities: fuelRecords.length,
        targets: targetRecords.length
      },
      hasOperationalData: {
        fuel: hasFuelData,
        pln: totalPurchasedKwh > 0,
        plts: totalPltsAvoidedTon > 0,
        water: totalWaterAvoidedTon > 0
      },
      carbonBalance,
      plts: {
        totalProdMwhYtd: Number(pltsMonthlyTrend.reduce((acc, m) => acc + m.totalProdMwh, 0).toFixed(5)),
        totalAvoidedCo2TonYtd: Number(totalPltsAvoidedTon.toFixed(3)),
        totalCostSavedJuta: Number(totalPltsCostSavedJuta.toFixed(2)),
        monthlyTrend: pltsMonthlyTrend,
        detailMeasurements: energyRecords
      },
      water: {
        totalVolumeM3Ytd: Number(waterMonthlyTrend.reduce((acc, m) => acc + m.recycled, 0).toFixed(2)),
        totalAvoidedCo2TonYtd: Number(totalWaterAvoidedTon.toFixed(3)),
        totalCostSavedJuta: Number(totalWaterCostSavedJuta.toFixed(2)),
        monthlyTrend: waterMonthlyTrend,
        detailActivities: waterRecords
      },
      fuel: {
        totalLitersYtd: Number(fuelRecords.reduce((acc, r) => acc + r.liters, 0).toFixed(2)),
        totalEmissionTonYtd: Number(fuelScope1Ton.toFixed(3)),
        totalCostJutaYtd: Number((fuelRecords.reduce((acc, r) => acc + (r.costRupiah || 0), 0) / 1_000_000).toFixed(2)),
        detailActivities: fuelRecords
      },
      targets: targetRecords,
      plants: plantMasters,
      mutationsAllowed: Boolean(process.env.DISABLE_MUTATIONS !== 'true' && process.env.ALLOW_MANUAL_SYNC !== 'false'),
    };

    cachedPayload = payload;
    lastCacheTime = now;

    return NextResponse.json(payload, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=10' }
    });
  } catch (error) {
    console.error('Error fetching sustainability API data:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const mutationDecision = mutationDecisionForRequest(request);
  if (!mutationDecision.allowed) {
    return NextResponse.json({
      success: false,
      error: mutationDecision.message || 'Mode hanya-baca aktif; operasi ini dinonaktifkan di server ini.',
      code: mutationDecision.code
    }, { status: mutationDecision.status });
  }
  try {
    const body = await request.json();
    const {
      module,
      dcId,
      dcName,
      date = new Date().toISOString().split('T')[0],
      yearMonth,
      status = 'ACTIVE', // ACTIVE (final) | DRAFT
      proofRef,
      source = 'MANUAL',
      idempotencyKey = null,
      sourceRef = null
    } = body;

    const ym = yearMonth || date.slice(0, 7);
    const targetDcId = dcId || `DC-${(dcName || 'DEFAULT').toUpperCase().replace(/\s+/g, '')}`;

    // ─── 1. STRICT PENDING_VALIDATION FACTOR REJECTION ON FINAL SAVE ───
    if (module === 'genset' || module === 'fuel' || module === 'vehicle') {
      const fuelType = (body.fuelType || 'SOLAR').toUpperCase();
      if (fuelType === 'PERTAMAX' && status === 'ACTIVE') {
        return NextResponse.json({
          status: 'error',
          code: 'FACTOR_PENDING_VALIDATION',
          message: 'Penyimpanan FINAL ditolak: Faktor emisi Pertamax masih berstatus PENDING_VALIDATION (konflik workbook 0.2868 vs 2.2868 kg/L). Anda hanya dapat menyimpannya sebagai DRAFT hingga dokumen sumber resmi disahkan.',
          allowedStatus: 'DRAFT'
        }, { status: 422 });
      }
    }

    // ─── 2. IDEMPOTENCY KEY CHECK & DEDUPLICATION ───
    const computedKey = idempotencyKey || `${module}-${targetDcId}-${date}-${proofRef || 'noref'}`;

    let savedRecord = null;
    let calculationResult = null;

    if (module === 'genset' || module === 'fuel' || module === 'vehicle') {
      const fuelType = (body.fuelType || 'SOLAR').toUpperCase();
      const liters = parseFloat(body.fuelLiters) || (parseFloat(body.liters) || 0);
      const costRupiah = parseFloat(body.costRupiah) || null;
      const pricePerLiter = parseFloat(body.pricePerLiter) || null;
      const isMobile = module === 'vehicle';

      // Check existing by proofRef & date to prevent double submit
      if (proofRef) {
        const existing = await prisma.fuelActivity.findFirst({
          where: { dcId: targetDcId, date, proofRef }
        });
        if (existing) {
          return NextResponse.json({
            status: 'success',
            deduplicated: true,
            message: 'Transaksi BBM telah tersimpan sebelumnya (idempotent duplicate prevented).',
            recordId: existing.id,
            savedRecord: existing
          });
        }
      }

      calculationResult = calculateScope1FuelEmission({
        fuelType,
        liters: liters > 0 ? liters : null,
        costRupiah: costRupiah > 0 ? costRupiah : null,
        pricePerLiter
      });

      const combustionTypeStr = isMobile
        ? `Scope 1B Mobile Combustion (Kendaraan: ${body.vehiclePlateNo || '-'} • Unit: ${body.operatorUnit || '-'})`
        : `Scope 1A Stationary Combustion (Genset: ${body.gensetAssetCode || '-'} • ${body.runHours || 0} Jam)`;

      const validationNote = fuelType === 'PERTAMAX'
        ? `Catatan Audit: Faktor Pertamax ESDM 2.2868 kg/L (Status: PENDING_VALIDATION - Hanya Disimpan Sebagai DRAFT) • ${combustionTypeStr}`
        : `Faktor Terverifikasi Standar ESDM Pedoman GRK • ${combustionTypeStr}`;

      savedRecord = await prisma.fuelActivity.create({
        data: {
          date,
          yearMonth: ym,
          dcId: targetDcId,
          facilityType: body.facilityType || (isMobile ? 'transport' : 'warehouse'),
          warehouseSub: body.warehouseSub || 'wh',
          fuelType,
          liters: calculationResult.liters,
          costRupiah: costRupiah || (calculationResult.costEstimateJuta * 1_000_000),
          pricePerLiter: pricePerLiter || (calculationResult.factorKgPerLiter ? 15000 : null),
          emissionFactor: calculationResult.factorKgPerLiter,
          emissionKg: calculationResult.emissionKg,
          emissionTon: calculationResult.emissionTon,
          scope: 'SCOPE_1',
          status: fuelType === 'PERTAMAX' ? 'DRAFT' : status,
          validationNote,
          source,
          proofRef: proofRef || null
        }
      });
    } else if (module === 'water') {
      const volumeM3 = parseFloat(body.waterRecycled) || (parseFloat(body.volumeM3) || 0);
      const meterStart = parseFloat(body.meterStart) || null;
      const meterEnd = parseFloat(body.meterEnd) || null;
      const ratePerM3 = parseFloat(body.pdamRate) || CARBON_FACTORS.WATER.DEFAULT_PDAM_RATE_PER_M3;

      if (proofRef) {
        const existing = await prisma.waterActivity.findFirst({
          where: { dcId: targetDcId, date, notes: { contains: proofRef } }
        });
        if (existing) {
          return NextResponse.json({
            status: 'success',
            deduplicated: true,
            message: 'Transaksi Daur Ulang Air telah tersimpan sebelumnya (idempotent duplicate prevented).',
            recordId: existing.id,
            savedRecord: existing
          });
        }
      }

      calculationResult = calculateWaterRecycleImpact({
        volumeM3,
        meterStart,
        meterEnd,
        ratePerM3
      });

      savedRecord = await prisma.waterActivity.create({
        data: {
          date,
          yearMonth: ym,
          dcId: targetDcId,
          branchName: dcName || targetDcId,
          activityType: 'RECYCLE',
          meterStart,
          meterEnd,
          volumeM3: calculationResult.volumeM3,
          emissionFactor: calculationResult.factorKgPerM3,
          emissionAvoidedKg: calculationResult.co2AvoidedTon * 1000,
          emissionAvoidedTon: calculationResult.co2AvoidedTon,
          costSavedRupiah: calculationResult.costSavedJuta * 1_000_000,
          ratePerM3,
          qualityStatus: status === 'DRAFT' ? 'DRAFT' : 'VERIFIED',
          source,
          notes: proofRef ? `No Bukti: ${proofRef} (Metode: ${calculationResult.factorSource})` : `Input Audit Manual (Metode: ${calculationResult.factorSource})`
        }
      });
    } else if (module === 'plts') {
      const energyKwh = parseFloat(body.pltsGenerated) || (parseFloat(body.energyKwh) || 0);
      const useCorporateRkapFactor = body.useCorporateRkapFactor !== false;

      // ─── 3. PREVENT PLTS DOUBLE COUNTING ───
      // If a record exists for this dcId & yearMonth, prevent creating another duplicate row
      const existing = await prisma.energyMeasurement.findFirst({
        where: { dcId: targetDcId, yearMonth: ym, category: 'PLTS' }
      });

      if (existing) {
        if (source === 'ISOLAR_GATEWAY_IMPORT') {
          // Update existing verified record with provenance audit
          savedRecord = await prisma.energyMeasurement.update({
            where: { id: existing.id },
            data: {
              yieldKwh: energyKwh,
              yieldMwh: energyKwh / 1000,
              totalProdKwh: energyKwh,
              totalProdMwh: energyKwh / 1000,
              avoidedCo2Ton: (energyKwh / 1000) * CARBON_FACTORS.PLTS_PORTFOLIO.CO2_AVOIDED_TON_PER_MWH,
              source: 'ISOLAR_GATEWAY_IMPORT',
              qualityStatus: status === 'DRAFT' ? 'DRAFT' : 'COMPLETE'
            }
          });
          return NextResponse.json({
            status: 'success',
            updated: true,
            message: `Data PLTS ${targetDcId} periode ${ym} berhasil diperbarui dari iSolarCloud tanpa duplikasi.`,
            recordId: savedRecord.id,
            savedRecord
          });
        } else {
          return NextResponse.json({
            status: 'warning',
            duplicateBlocked: true,
            message: `Peringatan: Pengukuran PLTS untuk ${targetDcId} periode ${ym} sudah ada di database (Sumber: ${existing.source}). Untuk mencegah double-counting, gunakan fitur sinkronisasi atau edit record yang ada.`,
            recordId: existing.id,
            existingRecord: existing
          }, { status: 409 });
        }
      }

      calculationResult = calculatePLTSAvoidedEmissions({
        energyKwh,
        locationName: dcName,
        useCorporateRkapFactor
      });

      savedRecord = await prisma.energyMeasurement.create({
        data: {
          yearMonth: ym,
          dcId: targetDcId,
          plantNameRaw: dcName || targetDcId,
          yieldMwh: calculationResult.energyMwh,
          yieldKwh: calculationResult.energyKwh,
          totalProdMwh: calculationResult.energyMwh,
          totalProdKwh: calculationResult.energyKwh,
          avoidedCo2Ton: calculationResult.co2AvoidedTon,
          source: source || 'MANUAL',
          category: 'PLTS',
          proofRef: proofRef || '',
          qualityStatus: status === 'DRAFT' ? 'DRAFT' : 'COMPLETE'
        }
      });
    } else if (module === 'pln') {
      const kwh = parseFloat(body.plnKwh) || (parseFloat(body.kwh) || 0);
      const customGridFactor = parseFloat(body.emissionFactor) || null;

      calculationResult = calculateScope2ElectricityEmission({
        kwh,
        locationName: dcName,
        customGridFactor
      });

      savedRecord = await prisma.energyMeasurement.create({
        data: {
          yearMonth: ym,
          dcId: targetDcId,
          plantNameRaw: dcName || targetDcId,
          purchasedKwh: calculationResult.kwh,
          purchasedMwh: calculationResult.kwh / 1000,
          source: source || 'MANUAL',
          category: 'PLN',
          proofRef: proofRef || '',
          qualityStatus: status === 'DRAFT' ? 'DRAFT' : 'COMPLETE',
          metadata: { activityDate: date }
        }
      });
    } else {
      return NextResponse.json(
        { status: 'error', message: `Unknown module: ${module}` },
        { status: 400 }
      );
    }

    // Invalidate micro-cache
    cachedPayload = null;
    lastCacheTime = 0;

    return NextResponse.json({
      status: 'success',
      message: `Data ${module} berhasil disimpan dengan status ${status}!`,
      recordId: savedRecord?.id,
      module,
      calculated: calculationResult,
      savedRecord
    });
  } catch (error) {
    console.error('Error saving sustainability transaction:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to save transaction' },
      { status: 500 }
    );
  }
}
