import fs from 'node:fs';
import path from 'node:path';
import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import { readStore } from '../src/lib/solar/storage.js';

const MAX_CALLS = 14;
let calls = 0;
const call = async (endpoint, payload, category) => {
  if (calls >= MAX_CALLS) throw new Error('DISCOVERY_CALL_BUDGET_EXCEEDED');
  calls += 1;
  return executeIsolarRequest(endpoint, payload, { isLive: true, category });
};
const rowsOf = value => {
  const data = value?.data?.result_data ?? value?.result_data ?? {};
  return data.pageList || data.data || data.device_list || (Array.isArray(data) ? data : []);
};
const keywords = /purchased|import|\bbuy\b|from grid|feed[- _]?in|export|\bsell\b|to grid|consumption|\bload\b|self[- _]?use|forward|reverse energy/i;
const quotaBefore = readStore().quota;

const vendorQuotaBefore = await call('/openapi/getOpenApiCallInfo', {}, 'Diagnostics');
const stationResponse = await call('/openapi/getPowerStationList', { curPage: 1, size: 100 }, 'Monitoring');
const stations = rowsOf(stationResponse);

const devices = [];
for (let page = 1; ; page += 1) {
  const response = await call('/openapi/getDeviceListByUser', { curPage: page, size: 500 }, 'Device Management');
  const data = response?.data?.result_data || {};
  const pageRows = data.pageList || data.data || data.device_list || [];
  devices.push(...pageRows);
  const totalPage = Number(data.totalPage || data.total_page || 1);
  if (page >= totalPage || pageRows.length === 0) break;
}

const pointResults = {};
for (const deviceType of ['11', '5', '3']) {
  try {
    const response = await call('/openapi/getOpenPointInfo', {
      device_type: deviceType, type: 2, curPage: 1, size: 999,
    }, 'Metadata');
    const points = rowsOf(response);
    pointResults[deviceType] = {
      ok: true,
      total: points.length,
      matches: points.filter(point => keywords.test(String(point.point_name || point.point_desc || point.name || ''))).map(point => ({
        point_id: point.point_id ?? point.id ?? null,
        point_name: point.point_name ?? point.point_desc ?? point.name ?? null,
        show_unit: point.show_unit ?? point.unit ?? null,
        storage_unit: point.storage_unit ?? null,
      })),
    };
  } catch (error) {
    pointResults[deviceType] = { ok: false, error_name: error?.name || 'Error', error_message: error?.message || String(error) };
  }
}

const vendorQuotaAfter = await call('/openapi/getOpenApiCallInfo', {}, 'Diagnostics');
const quotaAfter = readStore().quota;
const stationById = new Map(stations.map(row => [Number(row.ps_id), row]));
const perPlant = new Map(stations.map(row => [Number(row.ps_id), {
  ps_id: Number(row.ps_id), ps_name: row.ps_name || row.station_name || row.name || '',
  connect_type: row.connect_type ?? null, device_counts: {},
} ]));
for (const device of devices) {
  const psId = Number(device.ps_id);
  if (!perPlant.has(psId)) perPlant.set(psId, { ps_id: psId, ps_name: stationById.get(psId)?.ps_name || '', connect_type: stationById.get(psId)?.connect_type ?? null, device_counts: {} });
  const type = String(device.device_type ?? 'unknown');
  perPlant.get(psId).device_counts[type] = (perPlant.get(psId).device_counts[type] || 0) + 1;
}
const connectTypes = {};
for (const station of stations) {
  const key = String(station.connect_type ?? 'null');
  connectTypes[key] = (connectTypes[key] || 0) + 1;
}
const localDelta = {
  hour: Number(quotaAfter.callsThisHour || 0) - Number(quotaBefore.callsThisHour || 0),
  month: Number(quotaAfter.callsThisMonth || 0) - Number(quotaBefore.callsThisMonth || 0),
};
const vendorQuota = response => {
  const data = response?.data?.result_data || {};
  return {
    curr_hour_accessed_times: data.curr_hour_accessed_times ?? null,
    curr_month_accessed_times: data.curr_month_accessed_times ?? null,
    residue_hour: data.residue_hour ?? data.hour_residue ?? null,
    residue_month: data.residue_month ?? data.month_residue ?? null,
  };
};
const output = {
  generated_at: new Date().toISOString(),
  calls_by_script: calls,
  local_counter_before: { hour: quotaBefore.callsThisHour, month: quotaBefore.callsThisMonth },
  local_counter_after: { hour: quotaAfter.callsThisHour, month: quotaAfter.callsThisMonth },
  local_counter_delta: localDelta,
  counter_matches_calls: localDelta.hour === calls && localDelta.month === calls,
  vendor_quota_before: vendorQuota(vendorQuotaBefore),
  vendor_quota_after: vendorQuota(vendorQuotaAfter),
  station_count: stations.length,
  connect_type_distribution: connectTypes,
  device_count: devices.length,
  plants: [...perPlant.values()].sort((a, b) => a.ps_id - b.ps_id),
  plants_with_meter_type_5: [...perPlant.values()].filter(row => row.device_counts['5']).map(row => row.ps_id),
  plants_without_meter_type_5: [...perPlant.values()].filter(row => !row.device_counts['5']).map(row => row.ps_id),
  point_metadata: pointResults,
};
const target = path.resolve('docs/evidence/scope2-vendor-discovery-2026-10-07.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(output, null, 2));
