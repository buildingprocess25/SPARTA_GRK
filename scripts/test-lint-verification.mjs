import { execSync } from 'child_process';
import assert from 'assert';

console.log('=== [TEST] ESLINT CONFIGURATION & NO-UNDEF RULE PROOF ===');

// 1. Verify that running eslint on src/ passes with 0 errors
console.log('1. Testing ESLint across src/ ...');
try {
  const output = execSync('npx eslint src/', { encoding: 'utf8' });
  assert(output.includes('(0 errors'), 'Expected 0 errors in src/');
  console.log('✅ src/ passed ESLint with 0 errors.');
} catch (err) {
  console.error('❌ ESLint failed on src/:', err.stdout || err.message);
  process.exit(1);
}

// 2. Verify that running eslint on the intentional fail fixture catches no-undef
console.log('2. Testing ESLint on intentional failure fixture (tests/fixtures/eslint-fail-fixture.js) ...');
let failedAsExpected = false;
try {
  execSync('npx eslint tests/fixtures/eslint-fail-fixture.js', { encoding: 'utf8' });
} catch (err) {
  const output = err.stdout || err.message || '';
  if (output.includes("'undeclaredVariableXYZ' is not defined") && output.includes('no-undef')) {
    failedAsExpected = true;
    console.log('✅ Intentional fixture correctly failed with no-undef error:');
    console.log(output.trim());
  } else {
    console.error('❌ Unexpected failure output:', output);
  }
}

assert(failedAsExpected, 'Expected fixture to fail with no-undef error');
console.log('✅ All ESLint verification tests passed successfully!\n');
