import prisma from '../prisma.js';
import { CANONICAL_DC_ENTITIES } from '../solar/plantMap.js';
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
    prisma.plantLatest.findMany({
      select: {
        psId: true,
        name: true,
        psStatus: true,
        psFaultStatus: true,
        faultCount: true,
        alarmCount: true,
        statusCategory: true,
        statusReason: true,
        vendorUpdateTime: true,
        statusCheckedAt: true,
      },
    }),
  ]);
  const plantNames = new Map(plants.map((plant) => [Number(plant.psId), plant.name]));

  // Track psIds that already have granular records in faultActive
  const coveredPsIds = new Set(records.map((r) => Number(r.psId || r.ps_id)));

  // Augment with station-level status alarms from plantLatest for plants with active faults/alarms
  const stationAlarms = [];
  for (const plant of plants) {
    const numId = Number(plant.psId);
    if (coveredPsIds.has(numId)) continue;

    const isFault = Number(plant.psFaultStatus) === 1 || Number(plant.faultCount) > 0 || plant.statusCategory === 'FAULT';
    const isOffline = Number(plant.psStatus) === 0 || plant.statusCategory === 'OFFLINE';
    const isAlarm = (Number(plant.psFaultStatus) === 2 || Number(plant.alarmCount) > 0 || plant.statusCategory === 'ALARM') && !isFault;

    if (isFault) {
      stationAlarms.push({
        id: `plant-fault-${numId}`,
        faultCode: `ps-${numId}-fault`,
        psId: numId,
        plantName: plant.name,
        faultName: 'Hardware Fault / Gangguan Proteksi Inverter',
        faultType: 1,
        faultLevel: 1,
        processStatus: '8',
        createTime: plant.vendorUpdateTime || plant.statusCheckedAt || new Date(),
        updatedAt: plant.statusCheckedAt || new Date(),
      });
    } else if (isOffline) {
      stationAlarms.push({
        id: `plant-offline-${numId}`,
        faultCode: `ps-${numId}-offline`,
        psId: numId,
        plantName: plant.name,
        faultName: 'Stasiun PLTS Offline (Komunikasi Terputus)',
        faultType: 1,
        faultLevel: 1,
        processStatus: '8',
        createTime: plant.vendorUpdateTime || plant.statusCheckedAt || new Date(),
        updatedAt: plant.statusCheckedAt || new Date(),
      });
    } else if (isAlarm) {
      stationAlarms.push({
        id: `plant-alarm-${numId}`,
        faultCode: `ps-${numId}-alarm`,
        psId: numId,
        plantName: plant.name,
        faultName: `Peringatan Aktif Inverter (${plant.alarmCount || 1} Alarm)`,
        faultType: 2,
        faultLevel: 2,
        processStatus: '8',
        createTime: plant.vendorUpdateTime || plant.statusCheckedAt || new Date(),
        updatedAt: plant.statusCheckedAt || new Date(),
      });
    }
  }

  const allRecords = [...records, ...stationAlarms].slice(0, safeLimit);
  const alarms = normalizeAlarmRecords(allRecords, CANONICAL_DC_ENTITIES, plantNames);

  return { alarms, summary: summarizeAlarms(alarms) };
}

