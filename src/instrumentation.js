export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const prisma = (await import('./lib/prisma.js')).default;
      const { preWarmPltsCache, initDbKeepAliveAndPoolWarmup } = await import('./lib/solar/dashboardService.js');
      
      console.log('[Instrumentation] Initializing database connection pool...');
      await prisma.$connect();
      console.log('[Instrumentation] Initializing connection keep-alive & pool warmup...');
      await initDbKeepAliveAndPoolWarmup();
      console.log('[Instrumentation] Pre-warming PLTS default dashboard cache...');
      await preWarmPltsCache();
      console.log('[Instrumentation] PLTS Server pre-warm & keep-alive ready!');
    } catch (error) {
      console.warn('[Instrumentation] Pre-warming notice:', error?.message || error);
    }
  }
}
