export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Each step runs in its own try/catch - these are unrelated subsystems
    // (DB warmup, login seed, cache warm, sync daemon) and one failing must
    // never block the others. Confirmed this actually happened: when the
    // app_user table didn't exist yet for one boot (code deployed before its
    // migration was applied), seedAppUsersFromEnv() threw, and because
    // everything shared one try/catch block, the sync daemon below it never
    // started either for that entire server lifetime - a login-seed hiccup
    // silently took auto-sync down with it.
    let prisma;
    try {
      prisma = (await import('./lib/prisma.ts')).default;
      console.log('[Instrumentation] Initializing database connection pool...');
      await prisma.$connect();
    } catch (error) {
      console.warn('[Instrumentation] DB connection notice:', error?.message || error);
      return;
    }

    try {
      console.log('[Instrumentation] Seeding login accounts from env (skips any that already exist in DB)...');
      const { seedAppUsersFromEnv } = await import('./lib/auth.ts');
      await seedAppUsersFromEnv();
    } catch (error) {
      console.warn('[Instrumentation] Login account seed notice:', error?.message || error);
    }

    try {
      console.log('[Instrumentation] Initializing connection keep-alive & pool warmup...');
      const { initDbKeepAliveAndPoolWarmup } = await import('./lib/solar/dashboardService.ts');
      await initDbKeepAliveAndPoolWarmup();
    } catch (error) {
      console.warn('[Instrumentation] Keep-alive/pool warmup notice:', error?.message || error);
    }

    try {
      console.log('[Instrumentation] Pre-warming PLTS default dashboard cache...');
      const { preWarmPltsCache } = await import('./lib/solar/dashboardService.ts');
      await preWarmPltsCache();
    } catch (error) {
      console.warn('[Instrumentation] Cache pre-warm notice:', error?.message || error);
    }

    try {
      // In-process so auto-sync does not depend on the external Dokploy cron, which never fired successfully.
      // 10 minutes, not 5: each cycle costs hundreds of DB operations and 5 minutes exhausted the Postgres plan quota.
      console.log('[Instrumentation] Starting in-process iSolar sync daemon (10-minute interval)...');
      const { startServerDaemon } = await import('./lib/solar/scheduler.ts');
      startServerDaemon({ intervalMs: 600_000 });
    } catch (error) {
      console.warn('[Instrumentation] Sync daemon start notice:', error?.message || error);
    }

    try {
      console.log('[Instrumentation] Starting monthly store sync from the Google Sheet...');
      const { startStoreSyncScheduler } = await import('./lib/stores/storeSync.ts');
      startStoreSyncScheduler();
    } catch (error) {
      console.warn('[Instrumentation] Store sync scheduler notice:', error?.message || error);
    }

    console.log('[Instrumentation] PLTS Server boot sequence complete.');
  }
}
