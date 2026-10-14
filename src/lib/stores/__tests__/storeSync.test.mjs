import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { fetchStoreSheetRows, parseStoreRows, storeSheetConfig, StoreSheetAccessError } from '../storeSheet.js';
import { diffStores } from '../storeSync.js';

const SHEET = [
  ['Branch', 'Kode Toko', 'Nama Toko', 'F/R', 'Titik Koordinat'],
  ['PEKANBARU', '1A01', 'JEND SUDIRMAN', 'R', '0.50954 101.4494'],
  ['PEKANBARU', '1a0l', 'JENSUD - ROHUL', 'f', '1.028359 100.461891'],
  ['PEKANBARU', '1A0M', 'SUNGAI GANTANG INHIL', 'F', '-0.51995 102.92329'],
  ['PEKANBARU', '1A01', 'DUPLIKAT', 'R', '0.5 101.4'],
  ['PEKANBARU', '1A99', 'KOMA, DALAM NAMA', 'R'],
  ['PEKANBARU', '1A98', 'TANPA STATUS', 'X', '0.5 101.4'],
  [],
];

const jsonResponse = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('parseStoreRows normalizes codes and ownership and reads coordinates', () => {
  const { stores } = parseStoreRows(SHEET);
  assert.deepEqual(stores[0], { code: '1A01', name: 'JEND SUDIRMAN', branch: 'PEKANBARU', ownership: 'R', latitude: 0.50954, longitude: 101.4494 });
  assert.equal(stores[1].code, '1A0L');
  assert.equal(stores[1].ownership, 'F');
  assert.equal(stores[2].latitude, -0.51995);
});

test('parseStoreRows skips duplicates and unknown F/R with a reason, keeps rows without coordinates', () => {
  const { stores, skipped, missingCoordinates } = parseStoreRows(SHEET);
  assert.deepEqual(stores.map((store) => store.code), ['1A01', '1A0L', '1A0M', '1A99']);
  assert.equal(stores[3].latitude, null);
  assert.equal(missingCoordinates, 1);
  assert.deepEqual(skipped.map((item) => item.reason), ['Kode Toko ganda', 'F/R tidak dikenal: "X"']);
});

test('parseStoreRows accepts an A:C range without F/R and coordinates', () => {
  const narrow = SHEET.map((row) => row.slice(0, 3));
  const { stores, skipped } = parseStoreRows(narrow, { range: "'Sheet 1'!A:C" });
  assert.deepEqual(stores[0], { code: '1A01', name: 'JEND SUDIRMAN', branch: 'PEKANBARU', ownership: '', latitude: null, longitude: null });
  assert.deepEqual(stores.map((store) => store.code), ['1A01', '1A0L', '1A0M', '1A99', '1A98']);
  assert.deepEqual(skipped.map((item) => item.reason), ['Kode Toko ganda']);
});

test('parseStoreRows names the missing column', () => {
  assert.throws(() => parseStoreRows([['Kode Toko', 'Branch'], ['1A01', 'X']], { range: 'Sheet1!A:B' }), /nama toko.*GOOGLE_STORE_SHEET_RANGE/s);
  assert.throws(() => parseStoreRows([['Branch', 'Nama'], ['A', 'B']]), /Kode Toko/);
});

test('storeSheetConfig reads the env names and unescapes the private key', () => {
  const config = storeSheetConfig({
    GOOGLE_STORE_SPREADSHEET_ID: ' abc ',
    GOOGLE_STORE_SHEET_RANGE: "'Sheet 1'!A:C",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'line1\\nline2',
  });
  assert.equal(config.spreadsheetId, 'abc');
  assert.equal(config.range, "'Sheet 1'!A:C");
  assert.equal(config.privateKey, 'line1\nline2');
});

test('fetchStoreSheetRows signs in with the read-only scope and reads the encoded range', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) return jsonResponse(200, { access_token: 'token-1' });
    return jsonResponse(200, { values: [['Kode Toko'], ['1A01']] });
  };
  const config = { spreadsheetId: 'sheet-id', range: "'Sheet 1'!A:C", serviceAccountEmail: 'bot@example.iam.gserviceaccount.com', privateKey, apiKey: '' };

  const rows = await fetchStoreSheetRows({ config, fetchImpl });

  assert.deepEqual(rows, [['Kode Toko'], ['1A01']]);
  const assertion = new URLSearchParams(calls[0].init.body).get('assertion');
  const claims = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString());
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/spreadsheets.readonly');
  assert.equal(new URL(calls[1].url).pathname, "/v4/spreadsheets/sheet-id/values/'Sheet%201'!A%3AC");
  assert.equal(calls[1].init.headers.Authorization, 'Bearer token-1');
});

test('fetchStoreSheetRows narrows the OAuth refresh token to read-only', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) return jsonResponse(200, { access_token: 'token-2' });
    return jsonResponse(200, { values: [['Kode Toko']] });
  };
  const config = { spreadsheetId: 'sheet-id', range: 'Sheet1', clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh', serviceAccountEmail: '', privateKey: '', apiKey: '' };

  await fetchStoreSheetRows({ config, fetchImpl });

  const body = new URLSearchParams(calls[0].init.body);
  assert.equal(body.get('grant_type'), 'refresh_token');
  assert.equal(body.get('scope'), 'https://www.googleapis.com/auth/spreadsheets.readonly');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer token-2');
});

test('fetchStoreSheetRows explains missing credentials and denied access', async () => {
  const base = { spreadsheetId: 'sheet-id', range: 'Sheet1', serviceAccountEmail: '', privateKey: '', apiKey: '' };
  await assert.rejects(fetchStoreSheetRows({ config: base, fetchImpl: async () => jsonResponse(200, {}) }), /GOOGLE_REFRESH_TOKEN/);
  await assert.rejects(
    fetchStoreSheetRows({ config: { ...base, apiKey: 'k' }, fetchImpl: async () => jsonResponse(403, { error: { message: 'denied' } }) }),
    (error) => error instanceof StoreSheetAccessError && /Viewer/.test(error.message),
  );
});

test('diffStores counts added, updated, reactivated and deactivated stores', () => {
  const existing = [
    { code: 'A', name: 'A', branch: 'X', ownership: 'R', latitude: null, longitude: null, isActive: true },
    { code: 'B', name: 'B', branch: 'X', ownership: 'R', latitude: null, longitude: null, isActive: true },
    { code: 'C', name: 'C', branch: 'X', ownership: 'R', latitude: null, longitude: null, isActive: false },
    { code: 'D', name: 'D', branch: 'X', ownership: 'R', latitude: null, longitude: null, isActive: true },
  ];
  const sheet = [
    { code: 'A', name: 'A', branch: 'X', ownership: 'R', latitude: null, longitude: null },
    { code: 'B', name: 'B BARU', branch: 'X', ownership: 'R', latitude: null, longitude: null },
    { code: 'C', name: 'C', branch: 'X', ownership: 'R', latitude: null, longitude: null },
    { code: 'E', name: 'E', branch: 'X', ownership: 'F', latitude: null, longitude: null },
  ];
  assert.deepEqual(diffStores(sheet, existing), { added: 1, updated: 1, reactivated: 1, deactivated: 1 });
});
