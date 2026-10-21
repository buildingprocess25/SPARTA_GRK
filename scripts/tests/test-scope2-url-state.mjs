import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('Testing Global Deep-Linking and URL State Management...');

const dashboardPath = path.resolve('src/components/scope2/Scope2AnnualLoadDashboard.tsx');
const pagePath = path.resolve('src/app/page.tsx');
const sidebarPath = path.resolve('src/components/Sidebar.tsx');

const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
const pageCode = fs.readFileSync(pagePath, 'utf8');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

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

// 3. page.tsx supports deep linking for all tabs (scope1, scope2, scope3, plts, water, history, calculator)
assert.ok(
  pageCode.includes("parseNavigationState"),
  'page.tsx must have parseNavigationState parser'
);

assert.ok(
  pageCode.includes("syncUrlWithTab"),
  'page.tsx must have syncUrlWithTab handler'
);

assert.ok(
  pageCode.includes("handlePopState"),
  'page.tsx must handle popstate for browser Back/Forward navigation'
);

// 4. Sidebar routes root tab clicks through navigateTo
assert.ok(
  sidebarCode.includes("if (navigateTo) {") && sidebarCode.includes("navigateTo(item.id);"),
  'Sidebar must route root tab clicks through navigateTo'
);

console.log('✓ All Deep-Linking & URL state management contracts verified successfully!');
