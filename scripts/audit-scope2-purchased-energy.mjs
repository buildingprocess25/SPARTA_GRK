import fs from 'node:fs';
import path from 'node:path';

import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import { readStore } from '../src/lib/solar/storage.js';

const MAX_CALLS = 8;
let calls = 0;
const call = async (endpoint, payload, category) => {
  if (calls >= MAX_CALLS) throw new Error('SCOPE2_VENDOR_CALL_BUDGET_EXCEEDED');
  calls += 1;
  return executeIsolarRequest(endpoint, payload, { isLive: true, category });
};
const resultData = response => response?.data?.result_data ?? response?.result_data ?? {};
const rows = response => {
  const data = resultData(response);
  return data.pageList || data.data || (Array.isArray(data) ? data : []);
};
const quotaView = response => {
  const data = resultData(response);
  return {
    curr_hour_accessed_times: data.curr_hour_accessed_times ?? null,
    curr_month_accessed_times: data.curr_month_accessed_times ?? null,
    residue_hour: data.residue_hour ?? data.hour_residue ?? null,
    residue_month: data.residue_month ?? data.month_residue ?? null,
  };
};

const priorPath = path.resolve('docs/evidence/scope2-vendor-discovery-2026-10-07.json');
const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
const localBefore = readStore().quota;
const vendorBefore = await call('/openapi/getOpenApiCallInfo', {}, 'Diagnostics');
const stationResponse = await call('/openapi/getPowerStationList', { curPage: 1, size: 100 }, 'Monitoring');
const stations = rows(stationResponse);
const vendorAfter = await call('/openapi/getOpenApiCallInfo', {}, 'Diagnostics');
const localAfter = readStore().quota;

const distribution = {};
for (const station of stations) {
  const key = String(station.connect_type ?? 'null');
  distribution[key] = (distribution[key] || 0) + 1;
}

const keyword = /purchase|import|buy|from grid|feed[- _]?in|export|sell/i;
const pointCandidates = Object.fromEntries(Object.entries(prior.point_metadata || {}).map(([type, metadata]) => [
  type,
  (metadata.matches || []).filter(point => keyword.test(point.point_name || '')),
]));

const targetNames = ['Cileungsi', 'Pontianak', 'Manado'];
const validation = targetNames.map(name => {
  const station = stations.find(item => String(item.ps_name || '').toLowerCase().includes(name.toLowerCase()));
  return {
    plant: name,
    ps_id: station?.ps_id ?? null,
    status: 'NOT_PROVEN',
    reason: 'Titik purchase/feed-in yang jelas hanya ditemukan pada metadata device_type 11, tetapi getDeviceListByUser tidak mengembalikan perangkat type 11 untuk plant ini; ps_key sumber tidak dapat dipetakan tanpa menebak.',
  };
});

const output = {
  generated_at: new Date().toISOString(),
  calls_by_script: calls,
  call_budget: MAX_CALLS,
  local_quota_before: { hour: localBefore.callsThisHour, month: localBefore.callsThisMonth },
  local_quota_after: { hour: localAfter.callsThisHour, month: localAfter.callsThisMonth },
  vendor_quota_before: quotaView(vendorBefore),
  vendor_quota_after: quotaView(vendorAfter),
  station_count: stations.length,
  connect_type_distribution: distribution,
  connect_type_documented_meaning: {
    1: 'full grid',
    2: 'self-use plus export',
    3: 'self-use without export',
    4: 'off-grid',
  },
  point_candidates: pointCandidates,
  selected_monthly_purchase_point: null,
  selected_monthly_export_point: null,
  realtime_identity_validation: validation,
  decision: 'LOAD_UPPER_BOUND',
  decision_reason: 'Tidak ada titik bulanan purchase/import yang dapat dipetakan ke perangkat plant dengan nama, unit, dan ps_key yang semuanya terbukti.',
};

const target = path.resolve('docs/evidence/scope2-purchased-energy-discovery-2026-10-07.json');
fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output, null, 2));

