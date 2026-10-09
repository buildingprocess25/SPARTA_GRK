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

