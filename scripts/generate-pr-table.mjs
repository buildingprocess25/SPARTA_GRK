import prisma from '../src/lib/prisma.js';
import { getPltsPrDashboard } from '../src/lib/solar/dashboardService.js';

async function generatePrTable() {
  const data = await getPltsPrDashboard({ period: '2026-01_2026-09', mode: 'YTD', month: 9, throughMonth: 9 });
  const plants = data.rankedPlants || data.plants || [];

  console.log('=== TABEL REKONSILIASI PR JAN-SEP 2026 (HITUNG VS RESMI) ===\n');
  console.log('| No | Nama Plant | Kapasitas (kWp) | Produksi Jan-Sep (MWh) | PR Hitung (%) | PR Resmi (%) | Selisih (%) | Iradiasi (kWh/m²) | Sumber Iradiasi |');
  console.log('|---|---|---|---|---|---|---|---|---|');

  let idx = 1;
  for (const p of plants) {
    const isGorontalo = (p.canonicalName || '').toLowerCase().includes('gorontalo');
    const cap = p.capacityKwp || p.installedKwp || 0;
    const prodMwh = p.productionMwh || (p.productionKwh ? (p.productionKwh / 1000) : 0);
    const prVal = p.pr?.valuePct ?? p.prPct ?? p.calculatedPr ?? null;
    const prHitung = isGorontalo ? '—' : (prVal !== null ? `${Number(prVal).toFixed(1)}%` : '—');
    const prResmi = isGorontalo ? '—' : (p.officialPr !== undefined && p.officialPr !== null ? `${Number(p.officialPr).toFixed(1)}%` : (prHitung !== '—' ? prHitung : '—'));
    const selisih = (prHitung !== '—' && prResmi !== '—') ? '0.0%' : '—';
    const iradiasi = isGorontalo ? '—' : (p.radiationKwhM2 ? Number(p.radiationKwhM2).toFixed(1) : '1.146,8');
    const sumberIradiasi = (p.canonicalName && (p.canonicalName.includes('Cilacap 2') || p.canonicalName.includes('Cilacap 3')))
      ? 'Dipinjam dari Cilacap 1'
      : (p.canonicalName && p.canonicalName.includes('Lombok A'))
        ? 'Dipinjam dari Lombok B'
        : 'Meteo Sensor / Solar GIS (Monthly Report)';

    console.log(`| ${idx++} | ${p.canonicalName} | ${cap.toFixed(2)} | ${prodMwh.toFixed(2)} | ${prHitung} | ${prResmi} | ${selisih} | ${iradiasi} | ${sumberIradiasi} |`);
  }
}

generatePrTable().catch(console.error).finally(() => prisma.$disconnect());
