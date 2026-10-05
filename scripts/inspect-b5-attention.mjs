import { PrismaClient } from '@prisma/client';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';

const prisma = new PrismaClient();

async function main() {
  const plants = await prisma.plantLatest.findMany();
  const faults = await prisma.faultActive.findMany();
  const plantMap = new Map(plants.map(p => [Number(p.psId), p]));
  const faultMap = new Map();
  faults.forEach(f => {
    const arr = faultMap.get(Number(f.psId)) || [];
    arr.push(f);
    faultMap.set(Number(f.psId), arr);
  });

  const attentionList = [];
  for (const dc of CANONICAL_DC_ENTITIES) {
    const reasons = [];
    for (const psId of dc.sungrowPsIds) {
      const p = plantMap.get(Number(psId));
      if (!p) {
        reasons.push('Perangkat tidak melapor');
      } else {
        if (p.psStatus === 0) reasons.push('Offline (ps_status 0)');
        if (p.alarmCount && p.alarmCount > 0) reasons.push(`Alarm aktif (${p.alarmCount})`);
      }
      const activeF = faultMap.get(Number(psId));
      if (activeF && activeF.length > 0) {
        reasons.push(`Fault aktif (${activeF.length}: ${activeF.map(x => x.faultName).join(', ')})`);
      }
    }
    if (reasons.length > 0) {
      attentionList.push({ name: dc.canonicalName, dcId: dc.dcId, reasons });
    }
  }

  console.log('=== B.5 LOKASI PERHATIAN (OPERASIONAL STATUS) ===');
  console.log(`Total lokasi perhatian: ${attentionList.length}`);
  attentionList.forEach((a, idx) => {
    console.log(`${idx + 1}. ${a.name} (${a.dcId}): ${a.reasons.join('; ')}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
