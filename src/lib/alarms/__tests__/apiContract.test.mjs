import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.resolve(here, relative), 'utf8');

test('alarm API is a no-store read-only database endpoint', () => {
  const route = read('../../../app/api/alarms/route.js');
  assert.match(route, /export async function GET/);
  assert.match(route, /loadActiveAlarms/);
  assert.match(route, /Cache-Control['"]\s*:\s*['"]no-store/);
  assert.doesNotMatch(route, /runSync|getFaultAlarmInfo|fetch\s*\(/);
  assert.doesNotMatch(route, /export async function (?:POST|PUT|PATCH|DELETE)/);
});

test('alarm service reads active records and limits its payload', () => {
  const service = read('../service.js');
  assert.match(service, /faultActive\.findMany/);
  assert.match(service, /safeLimit\s*=\s*Math\.min\(Math\.max/);
  assert.match(service, /take:\s*safeLimit/);
  assert.match(service, /processStatus:\s*['"]8['"]/);
  assert.doesNotMatch(service, /create\s*\(|update\s*\(|delete\s*\(|upsert\s*\(/);
});
