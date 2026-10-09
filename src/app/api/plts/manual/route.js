import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.js';
import { invalidatePltsServerCache } from '@/lib/solar/dashboardService';
import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '@/lib/solar/conversionConfig';

export const dynamic = 'force-dynamic';

const finite = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function POST(request) {
  const decision = mutationDecisionForRequest(request);
  if (!decision.allowed) {
    return NextResponse.json(
      { success: false, error: decision.message || 'Mode hanya-baca aktif; operasi ini dinonaktifkan di server ini.', code: decision.code },
      { status: decision.status }
    );
  }

  try {
    const body = await request.json();
    const dcId = String(body.dcId || '').trim();
    const psId = Number(body.psId);
    const yearMonth = String(body.yearMonth || '').replace('-', '');
    const productionKwh = finite(body.productionKwh);
    const selfConsumptionKwh = finite(body.selfConsumptionKwh);
    const feedInKwh = finite(body.feedInKwh);

    if (!dcId || !Number.isInteger(psId) || !/^20\d{4}$/.test(yearMonth)) {
      return NextResponse.json({ success: false, error: 'Plant dan periode PLTS tidak valid.' }, { status: 400 });
    }
    if (productionKwh === null || productionKwh <= 0 || selfConsumptionKwh === null || selfConsumptionKwh < 0 || feedInKwh === null || feedInKwh < 0) {
      return NextResponse.json({ success: false, error: 'Nilai energi PLTS tidak valid.' }, { status: 400 });
    }
    if (Math.abs(productionKwh - selfConsumptionKwh - feedInKwh) > 0.01) {
      return NextResponse.json({ success: false, error: 'Produksi harus sama dengan pemakaian sendiri ditambah ekspor.' }, { status: 400 });
    }

    const plant = await prisma.plantMaster.findUnique({
      where: { dcId },
      select: { dcId: true, canonicalName: true, sungrowPsIds: true },
    });
    if (!plant || !plant.sungrowPsIds.includes(psId)) {
      return NextResponse.json({ success: false, error: 'Plant PLTS tidak ditemukan atau PS ID tidak sesuai.' }, { status: 404 });
    }

    const source = 'MANUAL_INPUT';
    await prisma.$transaction([
      prisma.monthlyYieldObservation.upsert({
        where: {
          yearMonth_psId_measurementType_source: {
            yearMonth,
            psId,
            measurementType: 'MONTHLY_YIELD',
            source,
          },
        },
        update: {
          energyKwh: productionKwh,
          qualityStatus: 'COMPLETE',
          metadata: { enteredManually: true, dcId, selfConsumptionKwh, feedInKwh },
        },
        create: {
          yearMonth,
          psId,
          energyKwh: productionKwh,
          measurementType: 'MONTHLY_YIELD',
          source,
          qualityStatus: 'COMPLETE',
          metadata: { enteredManually: true, dcId, selfConsumptionKwh, feedInKwh },
        },
      }),
      prisma.energyFlowMonthly.upsert({
        where: { yearMonth_psId_source: { yearMonth, psId, source } },
        update: { yieldKwh: productionKwh, feedInKwh },
        create: { yearMonth, psId, yieldKwh: productionKwh, feedInKwh, source },
      }),
    ]);

    invalidatePltsServerCache();
    return NextResponse.json({
      success: true,
      data: {
        dcId,
        plantName: plant.canonicalName,
        psId,
        yearMonth,
        productionKwh,
        selfConsumptionKwh,
        feedInKwh,
        avoidedEmissionTon: Number(((selfConsumptionKwh * PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH) / 1000).toFixed(6)),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menyimpan data PLTS.' }, { status: 500 });
  }
}
