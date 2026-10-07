import assert from 'node:assert/strict';
import { isIsolatedTestDatabase, requireIsolatedTestDatabase } from './lib/require-isolated-test-database.mjs';

console.log('================================================================================');
console.log('TEST: ANTI-PRODUCTION DATABASE GUARD VERIFICATION');
console.log('================================================================================\n');

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

try {
  // Test 1: Guard rejects when ALLOW_DB_MUTATION_TESTS is not 'true'
  restoreEnv();
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test_db?schema=test_alfa';
  process.env.TEST_DATABASE_URL = 'postgresql://user:pass@localhost:5432/test_db?schema=test_alfa';
  process.env.ALLOW_DB_MUTATION_TESTS = 'false';
  assert.equal(isIsolatedTestDatabase(), false, 'Rejects when ALLOW_DB_MUTATION_TESTS != true');
  assert.throws(() => requireIsolatedTestDatabase('dummy-test'), /ditolak/i);
  console.log('  ✔ [PASS] 1. Guard rejects when ALLOW_DB_MUTATION_TESTS is not true');

  // Test 2: Guard rejects when DATABASE_URL !== TEST_DATABASE_URL
  restoreEnv();
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test_db?schema=test_alfa';
  process.env.TEST_DATABASE_URL = 'postgresql://user:pass@localhost:5432/other_test_db?schema=test_alfa';
  process.env.ALLOW_DB_MUTATION_TESTS = 'true';
  assert.equal(isIsolatedTestDatabase(), false, 'Rejects when DATABASE_URL != TEST_DATABASE_URL');
  console.log('  ✔ [PASS] 2. Guard rejects when DATABASE_URL != TEST_DATABASE_URL');

  // Test 3: Guard rejects pooled connection string (pgbouncer / pool in hostname)
  restoreEnv();
  process.env.DATABASE_URL = 'postgresql://user:pass@pooler.neon.tech:5432/test_db?schema=test_alfa';
  process.env.TEST_DATABASE_URL = 'postgresql://user:pass@pooler.neon.tech:5432/test_db?schema=test_alfa';
  process.env.ALLOW_DB_MUTATION_TESTS = 'true';
  assert.equal(isIsolatedTestDatabase(), false, 'Rejects pooled connection');
  console.log('  ✔ [PASS] 3. Guard rejects pooled database URLs');

  // Test 4: Guard rejects when database name and schema do not contain 'test'
  restoreEnv();
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/production_db?schema=public';
  process.env.TEST_DATABASE_URL = 'postgresql://user:pass@localhost:5432/production_db?schema=public';
  process.env.ALLOW_DB_MUTATION_TESTS = 'true';
  assert.equal(isIsolatedTestDatabase(), false, 'Rejects non-test database name');
  console.log('  ✔ [PASS] 4. Guard rejects non-test database/schema names');

  // Test 5: Guard rejects when target matches PRODUCTION_DATABASE_URL
  restoreEnv();
  const prodUrl = 'postgresql://prod_user:secret@db.alfa.internal:5432/alfamart_prod?schema=test_schema';
  process.env.DATABASE_URL = prodUrl;
  process.env.TEST_DATABASE_URL = prodUrl;
  process.env.PRODUCTION_DATABASE_URL = prodUrl;
  process.env.ALLOW_DB_MUTATION_TESTS = 'true';
  assert.equal(isIsolatedTestDatabase(), false, 'Rejects matching production database identity');
  console.log('  ✔ [PASS] 5. Guard rejects matching production host/database/user');

  // Test 6: Guard accepts strictly isolated test database
  restoreEnv();
  process.env.DATABASE_URL = 'postgresql://test_user:pass@localhost:5432/alfa_test?schema=test_alfa';
  process.env.TEST_DATABASE_URL = 'postgresql://test_user:pass@localhost:5432/alfa_test?schema=test_alfa';
  process.env.PRODUCTION_DATABASE_URL = 'postgresql://prod_user:secret@db.alfa.internal:5432/alfamart_prod?schema=public';
  process.env.ALLOW_DB_MUTATION_TESTS = 'true';
  assert.equal(isIsolatedTestDatabase(), true, 'Accepts valid isolated test target');
  assert.doesNotThrow(() => requireIsolatedTestDatabase('valid-isolated-test'));
  console.log('  ✔ [PASS] 6. Guard accepts strictly validated test target');

  console.log('\n✅ All anti-production guard verification tests passed successfully!');
} finally {
  restoreEnv();
}
