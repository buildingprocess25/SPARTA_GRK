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
      prisma = (await import('./lib/prisma.js')).default;
      console.log('[Instrumentation] Initializing database connection pool...');
      await prisma.$connect();
    } catch (error) {
      console.warn('[Instrumentation] DB connection notice:', error?.message || error);
      return;
    }

    try {
      console.log('[Instrumentation] Seeding login accounts from env (skips any that already exist in DB)...');
      const { seedAppUsersFromEnv } = await import('./lib/auth.js');
      await seedAppUsersFromEnv();
    } catch (error) {
      console.warn('[Instrumentation] Login account seed notice:', error?.message || error);
    }

    try {
      console.log('[Instrumentation] Initializing connection keep-alive & pool warmup...');
      const { initDbKeepAliveAndPoolWarmup } = await import('./lib/solar/dashboardService.js');
      await initDbKeepAliveAndPoolWarmup();
    } catch (error) {
      console.warn('[Instrumentation] Keep-alive/pool warmup notice:', error?.message || error);
    }

    try {
      console.log('[Instrumentation] Pre-warming PLTS default dashboard cache...');
      const { preWarmPltsCache } = await import('./lib/solar/dashboardService.js');
      await preWarmPltsCache();
    } catch (error) {
      console.warn('[Instrumentation] Cache pre-warm notice:', error?.message || error);
    }

    try {
      // startServerDaemon() existed in scheduler.js but was never actually
      // called anywhere - every SyncRun in the database has trigger='manual'
      // only, meaning the Dokploy Schedule cron (which depends on exact
      // external config: URL, CRON_SECRET header match, shell command syntax)
      // has never once successfully fired, even during production hours.
      // Running the sync loop in-process here means auto-sync no longer
      // depends on any external scheduler config at all - it starts the
      // moment this server process boots.
      //
      // Interval widened from 5 to 10 minutes: each cycle writes dozens to
      // hundreds of individual DB operations (39 plants upserted, faults,
      // inverter telemetry, snapshots), and running every 5 minutes was the
      // single largest contributor to the managed Postgres plan's monthly
      // operations quota being exhausted (confirmed: workspace got blocked
      // mid-month). Doubling the interval roughly halves that cost with no
      // effect on page load speed - it only trades a few extra minutes of
      // telemetry staleness, which is an acceptable tradeoff for a solar
      // production dashboard (not a safety-critical real-time system).
      console.log('[Instrumentation] Starting in-process iSolar sync daemon (10-minute interval)...');
      const { startServerDaemon } = await import('./lib/solar/scheduler.js');
      startServerDaemon({ intervalMs: 600_000 });
    } catch (error) {
      console.warn('[Instrumentation] Sync daemon start notice:', error?.message || error);
    }

    console.log('[Instrumentation] PLTS Server boot sequence complete.');
  }
}
