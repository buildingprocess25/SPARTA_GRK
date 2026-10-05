import { PrismaClient } from '@prisma/client';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';

const prisma = new PrismaClient();

async function main() {
  const months = ['202601', '202602', '202603', '202604', '202605', '202606', '202607', '202608', '202609'];
  const monthLabels = {
    '202601': 'Jan 2026',
    '202602': 'Feb 2026',
    '202603': 'Mar 2026',
    '202604': 'Apr 2026',
    '202605': 'Mei 2026',
    '202606': 'Jun 2026',
    '202607': 'Jul 2026',
    '202608': 'Agu 2026',
    '202609': 'Sep 2026'
  };

  const plants = await prisma.plantLatest.findMany();
  const plantCapMap = new Map(plants.map(p => [Number(p.psId), Number(p.capacityKwp || 0)]));

  console.log('=== A.4 DATA SERI TREN JAN-SEP 2026 ===');
  console.log('| Bulan | Lokasi Ada Data | Total Produksi (kWh) | Total Kapasitas (kWp) | Specific Yield Tertimbang (kWh/kWp) |');
  console.log('|---|---|---|---|---|');

  for (const ym of months) {
    const monthlyRecords = await prisma.monthlyYield.findMany({
      where: { yearMonth: ym }
    });
    
    let locCount = 0;
    let totalKwh = 0;
    let totalKwp = 0;

    for (const dc of CANONICAL_DC_ENTITIES) {
      const psIds = (dc.sungrowPsIds || []).map(Number);
      const matching = monthlyRecords.filter(r => psIds.includes(Number(r.psId)));
      const dcCap = psIds.reduce((sum, id) => sum + (plantCapMap.get(id) || dc.apiInstalledKwp || 0), 0);
      
      if (matching.length > 0) {
        const sumKwh = matching.reduce((acc, r) => acc + Number(r.energyKwh || 0), 0);
        if (sumKwh > 0 || matching.some(r => r.energyKwh !== null)) {
          locCount++;
          totalKwh += sumKwh;
          totalKwp += dcCap;
        }
      }
    }

    const weightedSpecificYield = totalKwp > 0 ? (totalKwh / totalKwp).toFixed(2) : '0.00';
    const isPartial = ym === '202609' ? ' (sebagian)' : '';
    console.log(`| ${monthLabels[ym]}${isPartial} | ${locCount} | ${totalKwh.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} | ${totalKwp.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${weightedSpecificYield} |`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
