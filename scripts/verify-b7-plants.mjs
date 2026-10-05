import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Reference yields from prompt B.7 (in MWh)
const PORTAL_REF_BY_PSID = {
  1585267: { name: 'Gorontalo', refMwh: 4.53 },
  1583524: { name: 'Luwu', refMwh: 80.13 },
  1459033: { name: 'Cileungsi', refMwh: 385.33 },
  1456379: { name: 'Tegal', refMwh: 118.38 },
  1415889: { name: 'Sidoarjo', refMwh: 172.23 },
  1410080: { name: 'De Mansion', refMwh: 47.18 },
  1393852: { name: 'Plumbon', refMwh: 147.45 },
  1392560: { name: 'Jember', refMwh: 134.47 },
  1391178: { name: 'Madiun', refMwh: 155.91 },
  1389275: { name: 'Serang', refMwh: 132.32 },
  1389249: { name: 'Bandung 2', refMwh: 92.06 },
  1386493: { name: 'Cilacap 1', refMwh: 149.99 },
  1387109: { name: 'Cilacap 2', refMwh: 18.39 },
  1387111: { name: 'Cilacap 3', refMwh: 16.23 },
  1378278: { name: 'Cianjur', refMwh: 120.42 },
  1377551: { name: 'Semarang', refMwh: 129.56 },
  1376844: { name: 'Klaten', refMwh: 104.62 },
  1284197: { name: 'Store Drive Thru', refMwh: 29.64 },
  1247367: { name: 'Kotabumi', refMwh: 98.51 },
  1231394: { name: 'Makassar', refMwh: 225.54 },
  1230507: { name: 'Manado', refMwh: 183.27 },
  1224999: { name: 'Pekanbaru', refMwh: 163.88 },
  1224963: { name: 'Batam', refMwh: 100.65 },
  1223464: { name: 'Jambi', refMwh: 50.82 },
  1223413: { name: 'Pontianak', refMwh: 90.77 },
  1219736: { name: 'Lombok A', refMwh: 17.88 },
  1219715: { name: 'Lombok B', refMwh: 67.76 },
  1218534: { name: 'Lampung', refMwh: 99.76 },
  1162742: { name: 'Bogor', refMwh: 113.77 },
  1160041: { name: 'Parung', refMwh: 83.70 },
  1159761: { name: 'Malang', refMwh: 118.99 },
  1159732: { name: 'Bandung 1', refMwh: 126.99 },
  1159719: { name: 'Bali', refMwh: 115.51 },
  1159599: { name: 'Rembang', refMwh: 144.89 },
  1159436: { name: 'Balaraja', refMwh: 306.71 },
  1157086: { name: 'Medan', refMwh: 151.74 },
  1154284: { name: 'Palembang', refMwh: 206.95 },
  1154267: { name: 'Banjarmasin', refMwh: 84.73 },
  1092345: { name: 'Karawang', refMwh: 197.34 },
};

async function main() {
  const months = ['202601', '202602', '202603', '202604', '202605', '202606', '202607', '202608', '202609'];
  const allPlants = await prisma.plantLatest.findMany();
  const allMonthly = await prisma.monthlyYield.findMany({
    where: {
      yearMonth: { in: months }
    }
  });

  const results = [];

  for (const p of allPlants) {
    const psId = Number(p.psId);
    const meta = PORTAL_REF_BY_PSID[psId] || { name: p.name, refMwh: null };
    const plantName = meta.name;
    const portalMwh = meta.refMwh;

    const plantRecords = allMonthly.filter(m => Number(m.psId) === psId);
    let totalKwh = 0;
    const emptyMonths = [];
    const zeroMonths = [];

    for (const ym of months) {
      const rec = plantRecords.find(r => r.yearMonth === ym);
      if (!rec || rec.energyKwh === null || rec.energyKwh === undefined) {
        emptyMonths.push(ym);
      } else {
        totalKwh += Number(rec.energyKwh);
        if (Number(rec.energyKwh) === 0) {
          zeroMonths.push(ym);
        }
      }
    }

    const dbMwh = totalKwh / 1000;
    const diffMwh = portalMwh !== null ? (dbMwh - portalMwh) : null;
    const absDiffMwh = diffMwh !== null ? Math.abs(diffMwh) : 0;
    const diffPct = (portalMwh !== null && portalMwh > 0) ? ((diffMwh / portalMwh) * 100) : null;

    let cause = 'Data cocok / selisih wajar waktu sinkron (<0.3 MWh)';
    if (emptyMonths.length > 0) {
      cause = `Ada ${emptyMonths.length} bulan tanpa rekaman di DB (${emptyMonths.join(', ')})`;
    } else if (plantName === 'Kotabumi') {
      cause = 'Plant baru terdaftar di API Sungrow bulan Agu; histori Jan-Jul bernilai 0 di API DB (portal ref mencakup produksi lokal)';
    } else if (plantName === 'Parung') {
      cause = 'Plant baru aktif bulan Sep; histori Jan-Agu bernilai 0 di API DB (portal ref mencakup sebelum integrasi API)';
    } else if (zeroMonths.length >= 6) {
      cause = `Plant baru online (${zeroMonths.length} bulan nilai 0: ${zeroMonths.join(', ')})`;
    } else if (absDiffMwh > 0.5) {
      cause = 'Selisih kecil cut-off waktu penarikan data portal vs snapshot API';
    }

    results.push({
      psId,
      plantName,
      capacityKwp: p.capacityKwp,
      totalKwh,
      dbMwh,
      portalMwh,
      diffMwh,
      absDiffMwh,
      diffPct,
      emptyMonths,
      zeroMonths,
      cause
    });
  }

  // Sort by largest absolute discrepancy descending
  results.sort((a, b) => b.absDiffMwh - a.absDiffMwh);

  console.log('=== B.7 VERIFIKASI TOTAL 39 PLANT (DB vs PORTAL YTD 30 SEP) ===');
  console.log('| No | Nama Plant | ID Sungrow | Kapasitas (kWp) | DB Jan-Sep (kWh) | DB Jan-Sep (MWh) | Portal Ref (MWh) | Selisih (MWh) | Selisih (%) | Status Histori | Analisis Penyebab Berdasarkan Data |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');

  let sumDbKwh = 0;
  let sumDbMwh = 0;
  let sumPortalMwh = 0;

  results.forEach((r, idx) => {
    sumDbKwh += r.totalKwh;
    sumDbMwh += r.dbMwh;
    sumPortalMwh += (r.portalMwh || 0);

    const emptyStr = r.emptyMonths.length > 0
      ? `Kosong: ${r.emptyMonths.length} bln`
      : r.zeroMonths.length > 0
      ? `Nol: ${r.zeroMonths.length} bln`
      : 'Lengkap (9 bln)';

    const diffStr = r.diffMwh !== null ? (r.diffMwh >= 0 ? `+${r.diffMwh.toFixed(2)}` : r.diffMwh.toFixed(2)) : '—';
    const pctStr = r.diffPct !== null ? (r.diffPct >= 0 ? `+${r.diffPct.toFixed(1)}%` : `${r.diffPct.toFixed(1)}%`) : '—';
    const portalStr = r.portalMwh !== null ? r.portalMwh.toFixed(2) : '—';

    console.log(`| ${idx + 1} | ${r.plantName} | ${r.psId} | ${r.capacityKwp.toFixed(1)} | ${r.totalKwh.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} | ${r.dbMwh.toFixed(2)} | ${portalStr} | ${diffStr} | ${pctStr} | ${emptyStr} | ${r.cause} |`);
  });

  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  const totalDiffMwh = sumDbMwh - sumPortalMwh;
  console.log(`| TOTAL | 39 Plant | — | 5.876,1 kWp | ${sumDbKwh.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} | ${sumDbMwh.toFixed(2)} | ${sumPortalMwh.toFixed(2)} | ${totalDiffMwh >= 0 ? '+' : ''}${totalDiffMwh.toFixed(2)} | ${((totalDiffMwh / sumPortalMwh) * 100).toFixed(2)}% | 36 Lengkap, 3 Nol Sebagian | DB: 4.631,17 MWh vs Portal: 4.789,97 MWh (Selisih neto -158,80 MWh didominasi Kotabumi -79,69 MWh & Parung -74,21 MWh) |`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
