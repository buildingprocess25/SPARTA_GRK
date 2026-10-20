import prisma from '../prisma.ts';
import { CANONICAL_DC_ENTITIES } from '../solar/plantMap.ts';
import { ALARM_DEFAULT_LIMIT } from './config.ts';
import { normalizeAlarmRecords, normalizeStationLevelAlarms, summarizeAlarms } from './normalize.ts';

export async function loadActiveAlarms({ limit = ALARM_DEFAULT_LIMIT } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || ALARM_DEFAULT_LIMIT, 1), 500);
  const [records, plants] = await Promise.all([
    prisma.faultActive.findMany({
      where: { processStatus: '8' },
      orderBy: [{ faultLevel: 'desc' }, { createTime: 'desc' }],
      take: safeLimit,
    }),
    prisma.plantLatest.findMany({ select: { psId: true, name: true, statusCategory: true, statusReason: true, statusCheckedAt: true, updatedAt: true } }),
  ]);
  const plantNames = new Map(plants.map((plant) => [Number(plant.psId), plant.name] as const));
  const detailAlarms = normalizeAlarmRecords(records, CANONICAL_DC_ENTITIES, plantNames);
  const stationAlarms = normalizeStationLevelAlarms(plants, CANONICAL_DC_ENTITIES);

  // Both lists can legitimately both have an entry for the same plant (one
  // detailed, one station-level) - that's fine, dedupe only exact id clashes.
  const seenIds = new Set(detailAlarms.map((alarm) => alarm.id));
  const alarms = [...detailAlarms, ...stationAlarms.filter((alarm) => !seenIds.has(alarm.id))]
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === 'ACTIVE' ? -1 : 1;
      if (left.kind !== right.kind) return left.kind === 'FAULT' ? -1 : 1;
      return String(right.occurredAt || '').localeCompare(String(left.occurredAt || ''));
    })
    .slice(0, safeLimit);

  return { alarms, summary: summarizeAlarms(alarms) };
}

