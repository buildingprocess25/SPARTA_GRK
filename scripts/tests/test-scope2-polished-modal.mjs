import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('Testing Scope 2 Polished Modal Layout & Parity with Scope 1...');

const modalPath = path.resolve('src/components/scope2/Scope2InputModal.jsx');
assert.ok(fs.existsSync(modalPath), 'Scope2InputModal.jsx must exist');
const content = fs.readFileSync(modalPath, 'utf8');

// 1. Modal width parity (max-w-[680px])
assert.ok(content.includes('max-w-[680px]'), 'Modal width must be max-w-[680px] to match Scope 1');

// 2. Read-only Grid Factor Info Card
assert.ok(content.includes('Faktor Emisi Grid:'), 'Must display grid factor label');
assert.ok(content.includes('ESDM Resmi'), 'Must have ESDM badge');
assert.ok(content.includes('gridFactor.toFixed(3)'), 'Must display read-only factor number');

// 3. Collapsible Additional Data (Optional)
assert.ok(content.includes('isAdditionalDataOpen'), 'Must have isAdditionalDataOpen state');
assert.ok(content.includes('useState(false)'), 'Must default to collapsed (false)');
assert.ok(content.includes('Data Tambahan (Opsional)'), 'Must have accordion label');
assert.ok(content.includes('modal-scope2-customer') && content.includes('modal-scope2-invoice'), 'Must contain optional fields inside accordion');

// 4. Live calculation preview card with prominent emission and verification formula
assert.ok(content.includes('Kalkulasi Emisi Scope 2 Terhitung'), 'Must have live calculation card');
assert.ok(content.includes('liveCalculation.emissionTon.toFixed(3)'), 'Must show prominent emission value');
assert.ok(content.includes('liveCalculation.formula'), 'Must show verification formula at bottom');

// 5. Compact Period row
assert.ok(content.includes('grid-cols-12 gap-2'), 'Must group period in compact 12-col grid');
assert.ok(content.includes('modal-scope2-month') && content.includes('modal-scope2-year'), 'Must contain month and year selectors');

// 6. Docked footer actions
assert.ok(content.includes('shrink-0') && content.includes('Simpan Data Scope 2'), 'Footer must be docked and shrink-0');

console.log('ALL SCOPE 2 POLISHED MODAL CHECKS PASSED!');
