import { buildRatedPowerIndex, loadRatedPowerRegistry } from '../src/lib/solar/inverterTemperatureConfig.js';

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

const loaded = loadRatedPowerRegistry();
const index = buildRatedPowerIndex(loaded.registry);
const missing = devices
  .filter(item => !index.has(String(item.device_sn || item.sn || '')))
  .map(item => ({
    device_sn: String(item.device_sn || item.sn || ''),
    ps_id: Number(item.ps_id || 0),
    device_name: item.device_name || '',
    device_model_code: item.device_model_code || '',
    reason: 'MISSING_RATED_POWER',
  }))
  .sort((a, b) => a.ps_id - b.ps_id || a.device_sn.localeCompare(b.device_sn));

console.log(JSON.stringify({
  effective_method_version: loaded.effectiveMethodVersion,
  registered_devices: devices.length,
  devices_with_rating: devices.length - missing.length,
  missing_count: missing.length,
  missing,
}, null, 2));
