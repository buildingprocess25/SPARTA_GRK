import fs from 'node:fs';
import path from 'node:path';

const required = ['ISOLAR_BASE_URL', 'ISOLAR_APP_KEY', 'ISOLAR_SECRET_KEY', 'ISOLAR_USER_ACCOUNT', 'ISOLAR_USER_PASSWORD'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);

const base = process.env.ISOLAR_BASE_URL;
const appkey = process.env.ISOLAR_APP_KEY;
const accessKey = process.env.ISOLAR_SECRET_KEY;

async function post(path, body) {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', sys_code: '901', 'x-access-key': accessKey },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok || String(json.result_code) !== '1') throw new Error(`${path} failed: ${json.result_code || response.status}`);
  return json;
}

const login = await post('/openapi/login', {
  appkey,
  user_account: process.env.ISOLAR_USER_ACCOUNT,
  user_password: process.env.ISOLAR_USER_PASSWORD,
});
const common = { appkey, token: login.result_data.token, lang: '_en_US' };
const devices = [];
for (let page = 1; ; page++) {
  const response = await post('/openapi/getDeviceListByUser', {
    ...common, curPage: page, size: 100, device_type_list: [1], is_virtual_unit: '0', rel_state: '1',
  });
  const data = response.result_data || {};
  const rows = data.pageList || data.data || [];
  devices.push(...rows);
  if (page >= Number(data.totalPage || 1) || rows.length === 0) break;
}

const pointResponse = await post('/openapi/getOpenPointInfo', {
  ...common, device_type: '1', type: 2, curPage: 1, size: 999,
});
const pointData = pointResponse.result_data || {};
const points = pointData.point_list || pointData.pageList || pointData.data || (Array.isArray(pointData) ? pointData : []);
const ratingPattern = /rated|nominal|capacity|power rating|rated output/i;
const ratingFields = [...new Set(devices.flatMap(row => Object.keys(row)).filter(key => ratingPattern.test(key)))].sort();
const ratingPoints = points.filter(point => ratingPattern.test(String(point.point_name || point.point_desc || point.name || '')));
const models = new Map();
for (const row of devices) {
  const model = String(row.device_model_code || row.device_model || row.device_type_name || '').trim() || '(kosong)';
  models.set(model, (models.get(model) || 0) + 1);
}

const examples = devices.slice(0, 3).map(row => ({
  ps_id: row.ps_id,
  device_sn: row.device_sn,
  device_model_code: row.device_model_code ?? null,
  device_model: row.device_model ?? null,
  device_type: row.device_type ?? null,
  actual_fields: Object.keys(row).sort(),
  rating_like_values: Object.fromEntries(ratingFields.map(key => [key, row[key] ?? null])),
}));

if (process.argv.includes('--write-template')) {
  const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const header = ['ps_id', 'device_sn', 'model', 'rated_power_w', 'sumber_dokumen', 'diverifikasi_oleh', 'tanggal'];
  const rows = devices
    .map(row => [row.ps_id, row.device_sn, row.device_model_code || '', '', '', '', ''])
    .sort((a, b) => Number(a[0]) - Number(b[0]) || String(a[1]).localeCompare(String(b[1])));
  const target = path.resolve('docs/templates/inverter-rated-power-template.csv');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n', 'utf8');
  console.log(JSON.stringify({ template: target, rows: rows.length }));
  process.exit(0);
}

console.log(JSON.stringify({
  endpoint: '/openapi/getDeviceListByUser',
  device_count: devices.length,
  actual_field_names: [...new Set(devices.flatMap(row => Object.keys(row)))].sort(),
  rating_like_field_names: ratingFields,
  examples,
  unique_models: [...models.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([model, count]) => ({ model, count })),
  point_metadata: {
    endpoint: '/openapi/getOpenPointInfo', device_type: '1', point_count: points.length,
    rating_like_points: ratingPoints.map(point => ({
      point_id: point.point_id ?? point.id ?? null,
      point_name: point.point_name ?? point.point_desc ?? point.name ?? null,
      storage_unit: point.storage_unit ?? null,
      show_unit: point.show_unit ?? point.unit ?? null,
    })),
  },
}, null, 2));
