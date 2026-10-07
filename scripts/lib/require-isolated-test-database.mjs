function inspectDatabaseUrl(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return {
      raw,
      host: url.hostname.toLowerCase(),
      database: url.pathname.replace(/^\/+/, '').split('/')[0],
      schema: url.searchParams.get('schema') || 'public',
      user: url.username,
      pooled: /pool/i.test(url.hostname) || url.searchParams.get('pgbouncer') === 'true',
    };
  } catch {
    return null;
  }
}

export function isIsolatedTestDatabase() {
  const effective = inspectDatabaseUrl(process.env.DATABASE_URL || '');
  const declaredTest = inspectDatabaseUrl(process.env.TEST_DATABASE_URL || '');
  const production = inspectDatabaseUrl(process.env.PRODUCTION_DATABASE_URL || '');
  const mutationAllowed = process.env.ALLOW_DB_MUTATION_TESTS === 'true';
  if (!mutationAllowed || !effective || !declaredTest || effective.raw !== declaredTest.raw) return false;
  if (effective.pooled || !(/test/i.test(effective.database) || /test/i.test(effective.schema))) return false;
  if (production && effective.host === production.host && effective.database === production.database && effective.user === production.user) return false;
  return true;
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
