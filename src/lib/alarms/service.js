import prisma from '@/lib/prisma.js';
import { CANONICAL_DC_ENTITIES } from '@/lib/solar/plantMap.js';
import { ALARM_DEFAULT_LIMIT } from './config.js';
import { normalizeAlarmRecords, summarizeAlarms } from './normalize.js';

export async function loadActiveAlarms({ limit = ALARM_DEFAULT_LIMIT } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || ALARM_DEFAULT_LIMIT, 1), 500);
  const [records, plants] = await Promise.all([
    prisma.faultActive.findMany({
      where: { processStatus: '8' },
      orderBy: [{ faultLevel: 'desc' }, { createTime: 'desc' }],
      take: safeLimit,
    }),
    prisma.plantLatest.findMany({ select: { psId: true, name: true } }),
  ]);
  const plantNames = new Map(plants.map((plant) => [Number(plant.psId), plant.name]));
  const alarms = normalizeAlarmRecords(records, CANONICAL_DC_ENTITIES, plantNames);

  return { alarms, summary: summarizeAlarms(alarms) };
}

