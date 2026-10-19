import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw new Error('CSV_INVALID_UNCLOSED_QUOTE');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(values => values.some(value => value.trim() !== ''));
}

function sha12(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const inputIndex = args.indexOf('--input');
const input = path.resolve(inputIndex >= 0 ? args[inputIndex + 1] : 'docs/templates/inverter-rated-power-template.csv');
if (inputIndex >= 0 && !args[inputIndex + 1]) throw new Error('--input memerlukan path');

const templatePath = path.resolve('docs/templates/inverter-rated-power-template.csv');
const registryPath = path.resolve('config/inverter-rated-power.v1.json');
const requiredHeaders = ['ps_id', 'device_sn', 'model', 'rated_power_w', 'sumber_dokumen', 'diverifikasi_oleh', 'tanggal'];
const templateRows = parseCsv(fs.readFileSync(templatePath, 'utf8'));
const templateHeader = templateRows.shift();
if (JSON.stringify(templateHeader) !== JSON.stringify(requiredHeaders)) throw new Error('TEMPLATE_HEADER_MISMATCH');
const known = new Map(templateRows.map(values => [values[1].trim(), { psId: Number(values[0]), model: values[2].trim() }]));

const rows = parseCsv(fs.readFileSync(input, 'utf8'));
const header = rows.shift();
if (JSON.stringify(header) !== JSON.stringify(requiredHeaders)) throw new Error(`CSV_HEADER_MISMATCH: ${requiredHeaders.join(',')}`);
const errors = [];
const seen = new Set();
const ratings = [];
for (const [offset, values] of rows.entries()) {
  const line = offset + 2;
  const record = Object.fromEntries(requiredHeaders.map((key, index) => [key, (values[index] ?? '').trim()]));
  if (seen.has(record.device_sn)) errors.push(`baris ${line}: device_sn duplikat ${record.device_sn}`);
  seen.add(record.device_sn);
  const expected = known.get(record.device_sn);
  if (!expected) errors.push(`baris ${line}: device_sn tidak dikenal ${record.device_sn || '(kosong)'}`);
  if (expected && Number(record.ps_id) !== expected.psId) errors.push(`baris ${line}: ps_id tidak cocok untuk ${record.device_sn}`);
  if (expected && record.model !== expected.model) errors.push(`baris ${line}: model tidak cocok untuk ${record.device_sn}`);
  const watts = Number(record.rated_power_w);
  if (!Number.isFinite(watts) || watts <= 0) errors.push(`baris ${line}: rated_power_w wajib angka positif dalam W`);
  if (!record.sumber_dokumen) errors.push(`baris ${line}: sumber_dokumen wajib terisi`);
  if (record.tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(record.tanggal)) errors.push(`baris ${line}: tanggal wajib YYYY-MM-DD`);
  if (expected && Number.isFinite(watts) && watts > 0 && record.sumber_dokumen) {
    ratings.push({
      deviceSn: record.device_sn, ratedPower: watts, unit: 'W', sourceRef: record.sumber_dokumen,
      verifiedBy: record.diverifikasi_oleh || null, verifiedDate: record.tanggal || null,
      psId: expected.psId, model: expected.model,
    });
  }
}

if (errors.length) {
  console.error(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', valid: false, error_count: errors.length, errors }, null, 2));
  process.exit(1);
}
const current = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const next = { ...current, ratings };
const serialized = JSON.stringify(next, null, 2) + '\n';
const currentSerialized = fs.readFileSync(registryPath, 'utf8');
console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run', valid: true, rows: ratings.length,
  current_hash12: sha12(currentSerialized), proposed_hash12: sha12(serialized), hash_will_change: sha12(currentSerialized) !== sha12(serialized),
}, null, 2));
if (apply) fs.writeFileSync(registryPath, serialized, 'utf8');
