export function isIsolatedTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL || '';
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || '';
  const mutationAllowed = process.env.ALLOW_DB_MUTATION_TESTS === 'true';
  return mutationAllowed && Boolean(testDatabaseUrl) && databaseUrl === testDatabaseUrl;
}

export function requireIsolatedTestDatabase(testName) {
  if (!isIsolatedTestDatabase()) {
    throw new Error(
      `${testName} ditolak: tes yang memutasi DB wajib memakai TEST_DATABASE_URL ` +
      'yang identik dengan DATABASE_URL dan ALLOW_DB_MUTATION_TESTS=true.',
    );
  }
}

export function skipUnlessIsolatedTestDatabase(testName) {
  if (isIsolatedTestDatabase()) return false;
  console.log(`[SKIP] ${testName}: tidak ada DB tes terisolasi; DB project tidak disentuh.`);
  return true;
}
