import { createSign } from 'node:crypto';

// Reads the store list through the Google Sheets API with the spreadsheets.readonly scope, so the sync can never edit the sheet.
const READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DEFAULT_RANGE = 'Sheet1';
const REQUEST_TIMEOUT_MS = 30_000;

const HEADER_ALIASES = {
  code: ['kode toko', 'kode', 'store code', 'kd toko'],
  name: ['nama toko', 'nama', 'store name'],
  branch: ['branch', 'cabang'],
  ownership: ['f/r', 'r/f', 'reguler/franchise', 'tipe toko'],
  coordinate: ['titik koordinat', 'koordinat'],
};

// Generous bounds around Indonesia; anything outside is treated as a typo, not a location.
const LAT_RANGE = [-12, 7];
const LNG_RANGE = [94, 142];

export class StoreSheetAccessError extends Error {}

export function storeSheetConfig(env = process.env) {
  return {
    spreadsheetId: (env.GOOGLE_STORE_SPREADSHEET_ID || '').trim(),
    range: (env.GOOGLE_STORE_SHEET_RANGE || '').trim() || DEFAULT_RANGE,
    serviceAccountEmail: (env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim(),
    // Hosting panels store the PEM on one line with literal "\n".
    privateKey: (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim(),
    apiKey: (env.GOOGLE_API_KEY || '').trim(),
    clientId: (env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: (env.GOOGLE_CLIENT_SECRET || '').trim(),
    refreshToken: (env.GOOGLE_REFRESH_TOKEN || '').trim(),
  };
}

const base64url = (value) => Buffer.from(value).toString('base64url');

async function requestToken(body, fetchImpl, label) {
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new StoreSheetAccessError(`Login ${label} Google ditolak (${data.error_description || data.error || `HTTP ${response.status}`}).`);
  }
  return data.access_token;
}

// The refresh token may carry wider scopes (Drive, Gmail); asking for spreadsheets.readonly narrows this access token to reading only.
function fetchOAuthToken({ clientId, clientSecret, refreshToken }, fetchImpl) {
  return requestToken({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token', scope: READONLY_SCOPE }, fetchImpl, 'OAuth');
}

async function fetchServiceAccountToken({ serviceAccountEmail, privateKey }, fetchImpl) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: serviceAccountEmail, scope: READONLY_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  let signature;
  try {
    signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(privateKey, 'base64url');
  } catch {
    throw new StoreSheetAccessError('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY tidak valid. Salin nilai "private_key" dari file JSON service account apa adanya.');
  }

  return requestToken({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }, fetchImpl, 'service account');
}

/** Returns the sheet as rows of cell strings. */
export async function fetchStoreSheetRows({ config = storeSheetConfig(), fetchImpl = fetch } = {}) {
  if (!config.spreadsheetId) throw new StoreSheetAccessError('GOOGLE_STORE_SPREADSHEET_ID belum diisi di env server.');

  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(config.range)}`);
  url.searchParams.set('majorDimension', 'ROWS');
  url.searchParams.set('valueRenderOption', 'FORMATTED_VALUE');
  const headers: Record<string, string> = {};
  if (config.clientId && config.clientSecret && config.refreshToken) {
    headers.Authorization = `Bearer ${await fetchOAuthToken(config, fetchImpl)}`;
  } else if (config.serviceAccountEmail && config.privateKey) {
    headers.Authorization = `Bearer ${await fetchServiceAccountToken(config, fetchImpl)}`;
  } else if (config.apiKey) {
    url.searchParams.set('key', config.apiKey);
  } else {
    throw new StoreSheetAccessError('Kredensial Google belum diisi. Isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, dan GOOGLE_REFRESH_TOKEN di env server.');
  }

  const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const data = await response.json().catch(() => ({}));
  if (response.status === 403 || response.status === 401) {
    const who = config.refreshToken ? 'akun Google pemilik GOOGLE_REFRESH_TOKEN' : (config.serviceAccountEmail || 'API key ini');
    throw new StoreSheetAccessError(`Google menolak akses ke sheet. Bagikan sheet ke ${who} sebagai Viewer. (${data.error?.message || `HTTP ${response.status}`})`);
  }
  if (response.status === 404) throw new StoreSheetAccessError('Spreadsheet tidak ditemukan. Periksa GOOGLE_STORE_SPREADSHEET_ID.');
  if (response.status === 400) {
    throw new StoreSheetAccessError(`Range "${config.range}" tidak valid. Periksa GOOGLE_STORE_SHEET_RANGE, contoh: 'Sheet 1'!A:E. (${data.error?.message || 'HTTP 400'})`);
  }
  if (!response.ok) throw new StoreSheetAccessError(`Google Sheets API merespons HTTP ${response.status}.`);
  return (data.values || []).map((row) => row.map((cell) => String(cell ?? '')));
}

function parseCoordinate(value) {
  const parts = String(value || '').trim().split(/[\s,;]+/).filter(Boolean).map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  const [latitude, longitude] = parts;
  const inRange = latitude >= LAT_RANGE[0] && latitude <= LAT_RANGE[1] && longitude >= LNG_RANGE[0] && longitude <= LNG_RANGE[1];
  return inRange ? { latitude, longitude } : null;
}

/**
 * Turns sheet rows into store rows. Unusable rows come back in `skipped` with a reason,
 * so the sync log shows what to fix in the sheet instead of silently dropping them.
 */
export function parseStoreRows(table, { range = '' } = {}) {
  const normalized = (cell) => String(cell ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();
  const headerIndex = table.findIndex((cells) => cells.some((cell) => HEADER_ALIASES.code.includes(normalized(cell))));
  if (headerIndex === -1) throw new Error(`Kolom "Kode Toko" tidak ditemukan di range ${range || 'sheet'}.`);

  const header = table[headerIndex].map(normalized);
  const column = Object.fromEntries(Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, header.findIndex((cell) => aliases.includes(cell))]));
  const missing = ['name'].filter((key) => column[key] === -1).map((key) => HEADER_ALIASES[key][0]);
  if (missing.length) {
    throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(', ')}. Kolom yang terbaca: ${table[headerIndex].join(', ')}. Perluas GOOGLE_STORE_SHEET_RANGE supaya kolom itu ikut terbaca.`);
  }

  const stores = [];
  const skipped = [];
  const seen = new Set();
  let missingCoordinates = 0;
  // F/R is optional: without it ownership stays '' and only an explicit 'F' is excluded downstream.
  const hasOwnership = column.ownership !== -1;

  table.slice(headerIndex + 1).forEach((cells, offset) => {
    const line = headerIndex + offset + 2;
    const get = (key) => (column[key] === -1 ? '' : String(cells[column[key]] ?? '').trim());
    if (cells.every((cell) => !String(cell).trim())) return;

    const code = get('code').toUpperCase();
    const ownership = get('ownership').toUpperCase();
    if (!code) return void skipped.push({ line, reason: 'Kode Toko kosong' });
    if (seen.has(code)) return void skipped.push({ line, code, reason: 'Kode Toko ganda' });
    if (hasOwnership && !['R', 'F'].includes(ownership)) return void skipped.push({ line, code, reason: `F/R tidak dikenal: "${get('ownership')}"` });
    if (!get('name')) return void skipped.push({ line, code, reason: 'Nama Toko kosong' });

    seen.add(code);
    const coordinate = parseCoordinate(get('coordinate'));
    if (!coordinate) missingCoordinates++;
    stores.push({
      code,
      name: get('name'),
      branch: get('branch').toUpperCase(),
      ownership,
      latitude: coordinate?.latitude ?? null,
      longitude: coordinate?.longitude ?? null,
    });
  });

  return { stores, skipped, missingCoordinates };
}

export async function readStoreSheet(options: { config?: ReturnType<typeof storeSheetConfig>; fetchImpl?: typeof fetch } = {}) {
  const config = options.config || storeSheetConfig();
  const rows = await fetchStoreSheetRows({ ...options, config });
  return parseStoreRows(rows, { range: config.range });
}
