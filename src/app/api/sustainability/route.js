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
import { getYearToDateMonths } from '@/lib/reportingMonths';
import { isVehicleFuelRecord } from '@/lib/scope1/fuelCategory.js';
import { getCanonicalEnergyRows, getCanonicalMonthlySummary } from '@/lib/energy-data.js';
import { buildScope2CanonicalDashboard } from '@/lib/scope2/dashboardService.js';

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

    const reportingMonths = getYearToDateMonths(new Date(now));
    const reportingYear = Number(reportingMonths[0].yearMonth.slice(0, 4));
    const monthKeys = reportingMonths.map(m => m.yearMonth);
    const monthLabels = reportingMonths.map(m => m.label);

    // PLTS and Scope 2 read energy_flow_monthly through the same modules as the PLTS and Scope 2 pages.
    const [energyRows, pltsMonthly, scope2Dashboard] = await Promise.all([
      getCanonicalEnergyRows({ year: reportingYear, throughMonth: reportingMonths.length }),
      getCanonicalMonthlySummary({ year: reportingYear, throughMonth: reportingMonths.length }),
      buildScope2CanonicalDashboard({ year: reportingYear }),
    ]);

    const waterRecords = await prisma.waterActivity.findMany({
      where: { qualityStatus: { not: 'DRAFT' } },
      orderBy: [{ yearMonth: 'asc' }, { branchName: 'asc' }]
    });

    const fuelRecords = await prisma.fuelActivity.findMany({
      where: { status: { in: ['ACTIVE', 'APPROVED', 'VERIFIED'] } },
      orderBy: [{ date: 'desc' }]
    });

    const targetRecords = await prisma.productionTarget.findMany({
      orderBy: [{ yearMonth: 'asc' }]
    });

    const plantMasters = await prisma.plantMaster.findMany({
      orderBy: [{ canonicalName: 'asc' }]
    });

    const pltsByMonth = new Map(pltsMonthly.map(m => [m.yearMonth, m]));
    const pltsMonthlyTrend = monthKeys.map((ym, idx) => {
      const m = pltsByMonth.get(ym);
      const yieldMwh = m ? m.yieldMwh : 0;
      return {
        month: monthLabels[idx],
        yearMonth: ym,
        pltsGen: Number((yieldMwh * 1000).toFixed(1)), // in kWh for chart
        pltsGenMwh: Number(yieldMwh.toFixed(5)),
        purchasedMwh: Number((m?.purchasedMwh || 0).toFixed(5)),
        feedInMwh: Number((m?.feedInMwh || 0).toFixed(5)),
        selfConsumptionMwh: Number((m?.selfConsumptionMwh || 0).toFixed(5)),
        loadMwh: Number((m?.loadMwh || 0).toFixed(5)),
        totalProdMwh: Number(yieldMwh.toFixed(5)),
        avoidedCo2Ton: Number((m?.avoidedEmissionTon || 0).toFixed(3)),
        plantCount: m?.plantCount || 0,
        hasData: yieldMwh > 0 || (m?.purchasedMwh || 0) > 0,
      };
    });

    // Monthly water recycle trend
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

    // Scope 1 and 2, actuals only
    const totalPltsAvoidedTon = pltsMonthlyTrend.reduce((acc, m) => acc + m.avoidedCo2Ton, 0);
    const totalWaterAvoidedTon = waterMonthlyTrend.reduce((acc, m) => acc + m.avoidedCo2Ton, 0);
    // Savings use self-consumed energy, the same basis as the PLTS page's savings card.
    const totalPltsCostSavedJuta = (pltsMonthlyTrend.reduce((acc, m) => acc + m.selfConsumptionMwh * 1000, 0) * CARBON_FACTORS.TARIFFS.ELECTRICITY_PLN_PER_KWH) / 1_000_000;
    const totalWaterCostSavedJuta = waterMonthlyTrend.reduce((acc, m) => acc + m.costSavedJuta, 0);

    const scope1MonthlyTrend = monthKeys.map((ym, idx) => {
      const monthFuel = fuelRecords.filter(r => r.yearMonth === ym);
      return {
        month: monthLabels[idx],
        yearMonth: ym,
        fuelLiters: Number(monthFuel.reduce((acc, r) => acc + (r.liters || 0), 0).toFixed(2)),
        emissionTon: Number(monthFuel.reduce((acc, r) => acc + (r.emissionTon || 0), 0).toFixed(3)),
        gensetEmissionTon: Number(monthFuel.filter((r) => !isVehicleFuelRecord(r)).reduce((acc, r) => acc + (r.emissionTon || 0), 0).toFixed(3)),
        vehicleEmissionTon: Number(monthFuel.filter(isVehicleFuelRecord).reduce((acc, r) => acc + (r.emissionTon || 0), 0).toFixed(3)),
        runHours: monthFuel.reduce((acc, r) => acc + (Number(r.metadata?.runHours) || 0), 0),
      };
    });

    const scope2ByMonth = new Map((scope2Dashboard.monthly || []).map(m => [m.yearMonth, m]));
    const scope2MonthlyTrend = monthKeys.map((ym, idx) => {
      const m = scope2ByMonth.get(ym);
      return {
        month: monthLabels[idx],
        yearMonth: ym,
        plnKwh: Number((m?.totalPurchasedKwh || 0).toFixed(1)),
        emissionTon: Number((m?.scope2EmissionTon || 0).toFixed(3)),
        hasData: (m?.totalPurchasedKwh || 0) > 0,
      };
    });
    const totalPurchasedKwh = scope2MonthlyTrend.reduce((acc, m) => acc + m.plnKwh, 0);
    const scope2TotalEmissionTon = Number(scope2MonthlyTrend.reduce((acc, m) => acc + m.emissionTon, 0).toFixed(2));

    // Per DC-month, so multi-plant DCs (Cilacap, Lombok) return their combined yield.
    const detailByDcMonth = new Map();
    for (const row of energyRows) {
      const key = `${row.dcId}|${row.yearMonth}`;
      const acc = detailByDcMonth.get(key) || { dcId: row.dcId, plantNameRaw: row.dcName, yearMonth: row.yearMonth, yieldKwh: 0, feedInKwh: 0, purchasedKwh: 0 };
      acc.yieldKwh += row.yieldKwh;
      acc.feedInKwh += row.feedInKwh;
      acc.purchasedKwh += row.purchasedKwh;
      detailByDcMonth.set(key, acc);
    }
    const detailMeasurements = [...detailByDcMonth.values()];

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
        energyFlowRows: energyRows.length,
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
        detailMeasurements
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
        monthlyTrend: scope1MonthlyTrend,
        detailActivities: fuelRecords
      },
      scope2: {
        totalPlnKwh: Number(totalPurchasedKwh.toFixed(1)),
        totalEmissionTon: scope2TotalEmissionTon,
        monthlyTrend: scope2MonthlyTrend,
      },
      targets: targetRecords,
      plants: plantMasters,
      // This route is behind the login wall in middleware.js, so any request
      // that reaches this point has already passed authentication.
      mutationsAllowed: true,
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

      let store = null;
      if (body.storeCode) {
        store = await prisma.storeMaster.findUnique({ where: { code: String(body.storeCode).trim().toUpperCase() } });
        const storeProblem = !store
          ? `Kode toko ${body.storeCode} tidak ada di master toko.`
          : !store.isActive
            ? `Toko ${store.code} ${store.name} sudah nonaktif sejak sinkronisasi terakhir.`
            : store.ownership === 'F'
              ? `Toko ${store.code} ${store.name} adalah Franchise, jadi BBM-nya bukan Scope 1 Alfa.`
              : null;
        if (storeProblem) {
          return NextResponse.json({ status: 'error', code: 'STORE_NOT_ELIGIBLE', message: storeProblem }, { status: 422 });
        }
      }

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
          facilityType: isMobile ? 'transport' : (body.facilityType || 'warehouse'),
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
          proofRef: proofRef || null,
          metadata: {
            ...(store ? { storeCode: store.code, storeName: store.name, storeBranch: store.branch } : {}),
            ...(isMobile
              ? { vehiclePlateNo: body.vehiclePlateNo || null, operatorUnit: body.operatorUnit || null }
              : { runHours: parseFloat(body.runHours) || null, gensetAssetCode: body.gensetAssetCode || null, gensetKva: parseFloat(body.gensetKva) || null }),
          },
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
