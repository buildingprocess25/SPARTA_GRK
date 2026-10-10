export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const prisma = (await import('./lib/prisma.js')).default;
      const { preWarmPltsCache, initDbKeepAliveAndPoolWarmup } = await import('./lib/solar/dashboardService.js');
      const { startServerDaemon } = await import('./lib/solar/scheduler.js');
      const { seedAppUsersFromEnv } = await import('./lib/auth.js');

      console.log('[Instrumentation] Initializing database connection pool...');
      await prisma.$connect();
      console.log('[Instrumentation] Seeding login accounts from env (skips any that already exist in DB)...');
      await seedAppUsersFromEnv();
      console.log('[Instrumentation] Initializing connection keep-alive & pool warmup...');
      await initDbKeepAliveAndPoolWarmup();
      console.log('[Instrumentation] Pre-warming PLTS default dashboard cache...');
      await preWarmPltsCache();
      // startServerDaemon() existed in scheduler.js but was never actually
      // called anywhere - every SyncRun in the database has trigger='manual'
      // only, meaning the Dokploy Schedule cron (which depends on exact
      // external config: URL, CRON_SECRET header match, shell command syntax)
      // has never once successfully fired, even during production hours.
      // Running the sync loop in-process here means auto-sync no longer
      // depends on any external scheduler config at all - it starts the
      // moment this server process boots.
      console.log('[Instrumentation] Starting in-process iSolar sync daemon (5-minute interval)...');
      startServerDaemon({ intervalMs: 300_000 });
      console.log('[Instrumentation] PLTS Server pre-warm & keep-alive ready!');
    } catch (error) {
      console.warn('[Instrumentation] Pre-warming notice:', error?.message || error);
    }
  }
}
