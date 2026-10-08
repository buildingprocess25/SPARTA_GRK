import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('Testing Modal Portal, Positioning, Scroll-lock, and Accessibility...');

const files = [
  { name: 'Scope1InputModal', path: 'src/components/scope1/Scope1InputModal.jsx' },
  { name: 'Scope2InputModal', path: 'src/components/scope2/Scope2InputModal.jsx' }
];

for (const f of files) {
  const filePath = path.resolve(f.path);
  assert.ok(fs.existsSync(filePath), `${f.name} must exist`);
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. createPortal to document.body
  assert.ok(content.includes("import { createPortal } from 'react-dom'"), `${f.name} must import createPortal`);
  assert.ok(content.includes('createPortal(') && content.includes('document.body'), `${f.name} must render via createPortal to document.body`);

  // 2. Fixed overlay with top z-index and flexbox centering
  assert.ok(content.includes('fixed inset-0 z-[9999] flex items-center justify-center'), `${f.name} must use fixed inset-0 z-[9999] flex items-center justify-center`);

  // 3. Body scroll locking
  assert.ok(content.includes("document.body.style.overflow = 'hidden'"), `${f.name} must lock body scroll`);
  assert.ok(content.includes('document.body.style.overflow = prevOverflow'), `${f.name} must restore body scroll`);

  // 4. Max height 90vh and internal scroll
  assert.ok(content.includes('max-h-[90vh]'), `${f.name} must have max-h-[90vh]`);
  assert.ok(content.includes('flex-1 overflow-y-auto'), `${f.name} must have internal scroll area`);

  // 5. Close by overlay click, X button, and Esc
  assert.ok(content.includes('if (e.target === e.currentTarget) onClose()'), `${f.name} must support closing on overlay click`);
  assert.ok(content.includes("e.key === 'Escape'"), `${f.name} must support closing on Esc key`);
  assert.ok(content.includes('onClick={onClose}'), `${f.name} must support closing on X button`);

  // 6. Focus accessibility
  assert.ok(content.includes('modalRef.current.focus()'), `${f.name} must focus modal on open`);
  assert.ok(content.includes('tabIndex={-1}'), `${f.name} must have tabIndex for accessibility focus`);

  console.log(`✓ ${f.name} passed all modal portal, positioning, scroll-lock, and accessibility checks!`);
}

console.log('ALL MODAL PORTAL & VIEWPORT CHECKS PASSED SUCCESSFULLY!');
