import { PrismaClient } from '@prisma/client';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function run() {
  console.log('=== PERBANDINGAN YIELD HISTORI API (Jan-Sep 2026) vs BASELINE AUDIT (April 2026) ===\n');

  const baselinePath = path.resolve('src/data/monitorPltsApril2026.json');
  const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

  console.log('Lokasi DC\t\t\tJan 26\tFeb 26\tMar 26\tApr API\tApr Audit\tSelisih Apr\tMay 26\tJun 26\tJul 26\tAug 26\tSep 26(Partial)');

  for (const dc of CANONICAL_DC_ENTITIES) {
    const dcName = dc.canonicalName;
    const bEntry = baselineData.find(b => b.plantName?.toLowerCase() === dcName.toLowerCase());
    const baseAprKwh = bEntry ? (Number(bEntry.monthlyYieldMwh || 0) * 1000) : 0;

    const monthlyRecords = await prisma.monthlyYield.findMany({
      where: {
        psId: { in: dc.sungrowPsIds },
      },
    });

    const getMonthYield = (ym) => {
      return monthlyRecords
        .filter(r => r.yearMonth === ym)
        .reduce((s, r) => s + r.energyKwh, 0);
    };

    const mJan = getMonthYield('202601');
    const mFeb = getMonthYield('202602');
    const mMar = getMonthYield('202603');
    const mAprApi = getMonthYield('202604');
    const mMay = getMonthYield('202605');
    const mJun = getMonthYield('202606');
    const mJul = getMonthYield('202607');
    const mAug = getMonthYield('202608');
    const mSep = getMonthYield('202609');

    const diffAprKwh = mAprApi - baseAprKwh;
    const diffAprPct = baseAprKwh > 0 ? (diffAprKwh / baseAprKwh) * 100 : 0;

    console.log(
      `${dcName.padEnd(28).slice(0, 28)}\t` +
      `${mJan.toFixed(0).padStart(6)}\t` +
      `${mFeb.toFixed(0).padStart(6)}\t` +
      `${mMar.toFixed(0).padStart(6)}\t` +
      `${mAprApi.toFixed(0).padStart(7)}\t` +
      `${baseAprKwh.toFixed(0).padStart(9)}\t` +
      `${(diffAprPct >= 0 ? '+' : '') + diffAprPct.toFixed(1) + '%'}\t` +
      `${mMay.toFixed(0).padStart(6)}\t` +
      `${mJun.toFixed(0).padStart(6)}\t` +
      `${mJul.toFixed(0).padStart(6)}\t` +
      `${mAug.toFixed(0).padStart(6)}\t` +
      `${mSep.toFixed(0).padStart(14)}`
    );
  }

  await prisma.$disconnect();
}

run().catch(console.error);
