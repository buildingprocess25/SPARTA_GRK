import { ALARM_SOURCES } from './config.js';

function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildEntityLookup(entities) {
  const lookup = new Map();
  for (const entity of entities || []) {
    for (const psId of entity.sungrowPsIds || []) {
      lookup.set(Number(psId), entity);
    }
  }
  return lookup;
}

export function normalizeAlarmRecords(records = [], entities = [], plantNames = new Map()) {
  const source = ALARM_SOURCES.ISOLAR_PLTS;
  const entityByPsId = buildEntityLookup(entities);

  return records.map((record) => {
    const psId = Number(record.psId ?? record.ps_id ?? 0);
    const entity = entityByPsId.get(psId);
    const fallbackName = record.plantName || plantNames.get(psId) || null;
    const processStatus = String(record.processStatus ?? record.process_status ?? '8');
    const faultType = Number(record.faultType ?? record.fault_type ?? 0);

    return {
      id: String(record.faultCode ?? record.fault_code ?? `${psId}-${record.faultName || 'alarm'}`),
      source: source.source,
      sourceTab: source.sourceTab,
      dcId: entity?.dcId || `PS-${psId || 'UNKNOWN'}`,
      dcName: entity?.canonicalName || fallbackName || `Plant ${psId || 'tidak terpetakan'}`,
      kind: faultType === 1 ? 'FAULT' : 'ALERT',
      title: String(record.faultName ?? record.fault_name ?? '').trim() || 'Alarm iSolar',
      occurredAt: toIsoOrNull(record.createTime ?? record.create_time),
      status: processStatus === '9' ? 'RESOLVED' : 'ACTIVE',
      vendorType: faultType,
      vendorLevel: Number(record.faultLevel ?? record.fault_level ?? 0),
      updatedAt: toIsoOrNull(record.updatedAt ?? record.updated_at),
    };
  }).sort((left, right) => {
    if (left.status !== right.status) return left.status === 'ACTIVE' ? -1 : 1;
    if (left.kind !== right.kind) return left.kind === 'FAULT' ? -1 : 1;
    return String(right.occurredAt || '').localeCompare(String(left.occurredAt || ''));
  });
}

/**
 * Station-level OFFLINE/FAULT/ALARM from PlantLatest.statusCategory - the
 * same signal sync.js already uses to trigger push notifications and the
 * ranking list badges, computed every cycle from the vendor's always-
 * succeeding getPowerStationList call. The "Status Alarm iSolar" panel used
 * to read ONLY from FaultActive (detailed per-device faults from the
 * separate getFaultAlarmInfo endpoint), which has stayed empty in practice
 * even when a plant is genuinely showing Alarm/Offline everywhere else in
 * the app - confirmed live: Lombok B showed "Alarm" in the ranking list
 * with zero corresponding entry here. This fills that gap with the more
 * reliable station-level signal instead of waiting on a vendor endpoint
 * that doesn't reliably agree with its own station overview.
 */
export function normalizeStationLevelAlarms(plants = [], entities = []) {
  const entityByPsId = buildEntityLookup(entities);
  const DEGRADED = { OFFLINE: 'FAULT', FAULT: 'FAULT', ALARM: 'ALERT' };

  return plants
    .filter((plant) => DEGRADED[plant.statusCategory])
    .map((plant) => {
      const psId = Number(plant.psId);
      const entity = entityByPsId.get(psId);
      return {
        id: `station-${psId}-${plant.statusCategory}`,
        source: 'ISOLAR_STATION_OVERVIEW',
        sourceTab: 'plts',
        dcId: entity?.dcId || `PS-${psId || 'UNKNOWN'}`,
        dcName: entity?.canonicalName || plant.name || `Plant ${psId || 'tidak terpetakan'}`,
        kind: DEGRADED[plant.statusCategory],
        title: plant.statusReason || `Status vendor: ${plant.statusCategory}`,
        occurredAt: toIsoOrNull(plant.statusCheckedAt),
        status: 'ACTIVE',
        vendorType: plant.statusCategory === 'FAULT' || plant.statusCategory === 'OFFLINE' ? 1 : 2,
        vendorLevel: 0,
        updatedAt: toIsoOrNull(plant.updatedAt),
      };
    });
}

export function summarizeAlarms(alarms = []) {
  const active = alarms.filter((alarm) => alarm.status === 'ACTIVE');
  const summary = {
    alertCount: active.filter((alarm) => alarm.kind === 'ALERT').length,
    faultCount: active.filter((alarm) => alarm.kind === 'FAULT').length,
    activeCount: active.length,
    unreadCount: 0,
    latestUpdatedAt: active.map((alarm) => alarm.updatedAt).filter(Boolean).sort().at(-1) || null,
    byTab: {},
  };

  for (const alarm of active) {
    const tab = summary.byTab[alarm.sourceTab] || { alertCount: 0, faultCount: 0, activeCount: 0 };
    tab.activeCount += 1;
    if (alarm.kind === 'FAULT') tab.faultCount += 1;
    else tab.alertCount += 1;
    summary.byTab[alarm.sourceTab] = tab;
  }

  return summary;
}

