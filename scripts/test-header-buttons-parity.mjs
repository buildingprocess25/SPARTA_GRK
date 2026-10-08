import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('Testing Scope 1 & Scope 2 Header Button Parity...');

const scope1Path = path.resolve('src/components/PenambahEmisiTab.jsx');
const scope2Path = path.resolve('src/components/Scope2AnnualLoadDashboard.jsx');

const scope1Content = fs.readFileSync(scope1Path, 'utf8');
const scope2Content = fs.readFileSync(scope2Path, 'utf8');

// Expected button class signature
const expectedButtonClass = 'inline-flex items-center justify-center gap-2 h-10 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white shadow-sm hover:bg-slate-800 hover:shadow-md hover:ring-2 hover:ring-slate-700/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 active:scale-[0.98] transition-all duration-150 shrink-0 cursor-pointer';

assert.ok(scope1Content.includes(expectedButtonClass), 'Scope 1 button must have exact expected styling');
assert.ok(scope2Content.includes(expectedButtonClass), 'Scope 2 button must have exact expected styling');

// Check icons and labels
assert.ok(scope1Content.includes('<Fuel size={16} className="text-rose-400 shrink-0" />'), 'Scope 1 must have Fuel size 16 icon with rose accent');
assert.ok(scope1Content.includes('<span className="tracking-wide">Input Data Scope 1</span>'), 'Scope 1 must have Input Data Scope 1 label');

assert.ok(scope2Content.includes('<Zap size={16} className="text-amber-400 shrink-0" />'), 'Scope 2 must have Zap size 16 icon with amber accent');
assert.ok(scope2Content.includes('<span className="tracking-wide">Input Data Scope 2</span>'), 'Scope 2 must have Input Data Scope 2 label');

// Check header alignment
const headerClass = 'pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4';
assert.ok(scope1Content.includes(headerClass), 'Scope 1 header must have exact alignment class');
assert.ok(scope2Content.includes(headerClass), 'Scope 2 header must have exact alignment class');

// Check top-right alignment wrapper
const wrapperClass = 'flex items-center gap-2 shrink-0 sm:self-start';
assert.ok(scope1Content.includes(wrapperClass), 'Scope 1 must have top-right aligned wrapper');
assert.ok(scope2Content.includes(wrapperClass), 'Scope 2 must have top-right aligned wrapper');

console.log('ALL SCOPE 1 & 2 HEADER BUTTON PARITY CHECKS PASSED!');
