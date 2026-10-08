import fs from 'fs';
import prisma from '../src/lib/prisma.js';
import { CANONICAL_DC_ENTITIES, isDcLocation } from '../src/lib/solar/plantMap.js';

async function checkPlants() {
  console.log('CANONICAL_DC_ENTITIES count:', CANONICAL_DC_ENTITIES.length);
  const dcOnly = CANONICAL_DC_ENTITIES.filter(isDcLocation);
  console.log('CANONICAL_DC_ENTITIES isDcLocation count:', dcOnly.length);
  const nonDc = CANONICAL_DC_ENTITIES.filter(e => !isDcLocation(e));
  console.log('CANONICAL_DC_ENTITIES non-DC entities:', nonDc.map(e => ({ name: e.canonicalName, id: e.dcId, type: e.type, facilityType: e.facilityType })));

  const dbPlants = await prisma.plantMaster.findMany({ select: { dcId: true, canonicalName: true, sungrowPsIds: true } });
  console.log('DB PlantMaster count:', dbPlants.length);
  const dbDcOnly = dbPlants.filter(isDcLocation);
  console.log('DB PlantMaster isDcLocation count:', dbDcOnly.length);
  const dbNonDc = dbPlants.filter(p => !isDcLocation(p));
  console.log('DB PlantMaster non-DC:', dbNonDc.map(p => p.canonicalName));

  const csvLines = fs.readFileSync('Monthly Report_Annual report_20261001111530.csv', 'utf8').trim().split('\n');
  const csvPlants = new Set();
  for (let i = 2; i < csvLines.length; i++) {
    const name = csvLines[i].split(',')[0].trim();
    if (name) csvPlants.add(name);
  }
  console.log('CSV distinct plant names count:', csvPlants.size);
  console.log('CSV plant names:', [...csvPlants].sort());

  await prisma.$disconnect();
}

checkPlants();
