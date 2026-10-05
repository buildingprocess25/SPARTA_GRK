import { PrismaClient } from '@prisma/client';
import { summarizePlts } from '../src/lib/solar/summarize.js';

const prisma = new PrismaClient();

async function main() {
  const summary = await summarizePlts({ period: '2026-01_2026-09' });
  const attentionLocs = summary.locations.filter(l => l.isAttention);

  console.log('=== B.5 LOKASI PERHATIAN & ALASAN LENGKAP ===');
  console.log(`Ditemukan ${attentionLocs.length} lokasi dengan status Perhatian:`);
  attentionLocs.slice(0, 5).forEach((loc, idx) => {
    console.log(`${idx + 1}. ${loc.canonicalName} (${loc.dcId})`);
    console.log(`   - Alasan: ${loc.attentionReasons.join(', ')}`);
    console.log(`   - Kapasitas: ${loc.installedKwp} kWp | Produksi YTD: ${loc.productionMwh.toFixed(2)} MWh | Spec. Yield: ${loc.specificYield.toFixed(2)} kWh/kWp`);
    console.log(`   - Data bulanan: [${loc.trend.map(v => v.toFixed(0)).join(', ')}] kWh`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
