import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildScope2CanonicalDashboard } from '../dashboardService.ts';

test('PLTS tab and main dashboard consume the canonical Scope 2 bridge', () => {
  const plts = fs.readFileSync('src/components/plts/PLTSTab.tsx', 'utf8');
  const resume = fs.readFileSync('src/components/EmisiResumeTab.tsx', 'utf8');
  assert.match(plts, /scope2-reconciliation/);
  assert.match(resume, /scope2Bridge/);
});

test('canonical bridge equals inventory and does not double subtract PLTS', async () => {
  const data = await buildScope2CanonicalDashboard({ rootDir: process.cwd() });
  assert.equal(data.scope2Bridge.afterPltsTon, data.scope2Bridge.scope2InventoryTon);
  assert.equal(data.scope2Bridge.noDoubleCounting, true);
});

test('PLTS error state imports every rendered alert icon', () => {
  const plts = fs.readFileSync('src/components/plts/PLTSTab.tsx', 'utf8');
  const imports = plts.slice(0, plts.indexOf("} from 'lucide-react';"));
  assert.match(plts, /<AlertTriangle/);
  assert.match(imports, /AlertTriangle/);
});
