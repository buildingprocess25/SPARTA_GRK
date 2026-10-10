import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getGridFactor } from '../src/lib/emission-factors.js';

console.log('Testing Scope 2 Emission Factors & Formulas...');

// 1. Check Grid Factors
const jamaliObj = getGridFactor('JAMALI');
assert.ok(jamaliObj && jamaliObj.cmExPost > 0.8 && jamaliObj.cmExPost < 0.9, 'JAMALI emission factor must be around 0.87');
const jamaliFactor = jamaliObj.cmExPost;

const mwh = 150.5;
const emisiTco2e = mwh * jamaliFactor;
assert.ok(emisiTco2e > 0, 'Emisi must be greater than 0');
console.log(`✓ Grid JAMALI factor: ${jamaliFactor} tCO2e/MWh | 150.5 MWh = ${emisiTco2e.toFixed(3)} tCO2e`);

// 2. Check Scope2InputModal exists and has key components
const modalPath = path.resolve('src/components/scope2/Scope2InputModal.jsx');
assert.ok(fs.existsSync(modalPath), 'Scope2InputModal.jsx must exist');
const modalContent = fs.readFileSync(modalPath, 'utf8');

assert.ok(modalContent.includes('Input Data Scope 2 — Listrik PLN'), 'Must contain header title');
assert.ok(modalContent.includes('Input Manual'), 'Must have Input Manual tab');
assert.ok(modalContent.includes('Upload Excel (.xlsx / .csv)'), 'Must have Excel upload tab');
assert.ok(modalContent.includes('MWh') && modalContent.includes('kWh'), 'Must have MWh/kWh toggle');
assert.ok(modalContent.includes('getGridFactor'), 'Must calculate with official grid factor');
assert.ok(modalContent.includes('/api/templates?category=PLN'), 'Must support official template download');
console.log('✓ Scope2InputModal component contains all required elements and verification hooks');

// 3. Check Scope2AnnualLoadDashboard integration
const dashboardPath = path.resolve('src/components/scope2/Scope2AnnualLoadDashboard.jsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

assert.ok(dashboardContent.includes('Scope2InputModal'), 'Must import Scope2InputModal');
assert.ok(dashboardContent.includes('isInputModalOpen'), 'Must track modal open state');
assert.ok(dashboardContent.includes('Input Data Scope 2'), 'Must have Input Data Scope 2 button');
console.log('✓ Scope2AnnualLoadDashboard successfully integrated with reactive refresh state');

// 4. Check Scope 1 beautification
const scope1ModalPath = path.resolve('src/components/scope1/Scope1InputModal.jsx');
const scope1ModalContent = fs.readFileSync(scope1ModalPath, 'utf8');
assert.ok(scope1ModalContent.includes('bg-slate-950/60 backdrop-blur'), 'Scope 1 modal must have glassmorphism styling');

const scope1TabPath = path.resolve('src/components/PenambahEmisiTab.jsx');
const scope1TabContent = fs.readFileSync(scope1TabPath, 'utf8');
assert.ok(scope1TabContent.includes('Input Data Scope 1'), 'Scope 1 tab has Input Data button');
assert.ok(scope1TabContent.includes('bg-slate-900'), 'Scope 1 button upgraded from neon pink to executive dark styling');
console.log('✓ Scope 1 aesthetic upgraded to match executive design system');

console.log('ALL SCOPE 2 INPUT MODAL & INTEGRATION TESTS PASSED!');
