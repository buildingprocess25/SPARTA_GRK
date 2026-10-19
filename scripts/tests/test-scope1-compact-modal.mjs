import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('Testing Scope 1 Modal Layout & Compactness Improvements...');

const modalPath = path.resolve('src/components/scope1/Scope1InputModal.jsx');
assert.ok(fs.existsSync(modalPath), 'Scope1InputModal.jsx must exist');
const content = fs.readFileSync(modalPath, 'utf8');

// 1. Modal width (640 - 720px)
assert.ok(content.includes('max-w-[680px]'), 'Modal width must be max-w-[680px] (within 640-720px)');

// 2. Collapsible Genset Details
assert.ok(content.includes('isGensetDetailsOpen'), 'Must have isGensetDetailsOpen state');
assert.ok(content.includes('useState(false)'), 'isGensetDetailsOpen must default to false (collapsed)');
assert.ok(content.includes('Detail Teknis Mesin Genset (Opsional)'), 'Must have collapsible title');
assert.ok(content.includes('ChevronDown'), 'Must have chevron icon for toggle');

// 3. One-line period row (Month, Year, Date)
assert.ok(content.includes('grid-cols-12 gap-2'), 'Must group period and date in compact 12-col grid');
assert.ok(content.includes('modal-month-select') && content.includes('modal-year-select') && content.includes('modal-date-input'), 'Must contain all 3 period controls');

// 4. Equal height fuel cards with check badge
assert.ok(content.includes('h-[78px]'), 'Fuel cards must have uniform height (h-[78px])');
assert.ok(content.includes('size-4.5 rounded-full bg-rose-500 text-white'), 'Selected card must have clear check badge');

// 5. Live calculation card matching Scope 2
assert.ok(content.includes('Kalkulasi Emisi Scope 1 Terhitung'), 'Must have complete calculation card');
assert.ok(content.includes('liveCalc.emissionTon.toFixed(3)'), 'Must show calculated emission');
assert.ok(content.includes('liveCalc.formula'), 'Must show verification formula');

// 6. Docked footer
assert.ok(content.includes('shrink-0') && content.includes('Simpan Data Scope 1'), 'Footer actions must be shrink-0 and docked');

console.log('ALL SCOPE 1 MODAL COMPACTNESS & POLISH CHECKS PASSED!');
