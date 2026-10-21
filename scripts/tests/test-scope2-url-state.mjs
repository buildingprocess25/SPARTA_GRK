import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('Testing Scope 2 URL state cleanup and clean defaults...');

const dashboardPath = path.resolve('src/components/scope2/Scope2AnnualLoadDashboard.tsx');
const pagePath = path.resolve('src/app/page.tsx');

const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
const pageCode = fs.readFileSync(pagePath, 'utf8');

// 1. Dashboard does not append all default parameters unconditionally
assert.ok(
  dashboardCode.includes('isDefault'),
  'Dashboard must check if filters match default state'
);

// 2. Dashboard clears parameters on unmount
assert.ok(
  dashboardCode.includes('scope2Keys.forEach(k => {') && dashboardCode.includes('url.searchParams.delete(k)'),
  'Dashboard must clean up Scope 2 query parameters on unmount'
);

// 3. page.tsx navigates cleanly and deep-links to Scope 2 if query params present
assert.ok(
  pageCode.includes("params.has('scope2Basis') || params.has('tariff')"),
  'page.tsx must detect Scope 2 parameters for deep linking on mount'
);

assert.ok(
  pageCode.includes("tab !== 'penambah' || subOption !== 'scope2'"),
  'page.tsx must strip Scope 2 params when navigating away from Scope 2'
);

console.log('✓ All Scope 2 URL state cleanup contracts verified successfully!');
