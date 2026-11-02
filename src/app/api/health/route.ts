import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma.ts';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth.ts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ANONYMOUS_CACHE_MS = 10_000;
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

let anonymousProbe: { at: number; healthy: boolean } | null = null;
let anonymousProbeInFlight: Promise<boolean> | null = null;

// The route is public for the Docker HEALTHCHECK, so anonymous calls share one DB ping per 10 s instead of one per request.
async function probeDatabaseCached(): Promise<boolean> {
  if (anonymousProbe && Date.now() - anonymousProbe.at < ANONYMOUS_CACHE_MS) return anonymousProbe.healthy;
  anonymousProbeInFlight ??= prisma.$queryRaw`SELECT 1`
    .then(() => true, () => false)
    .then((healthy) => {
      anonymousProbe = { at: Date.now(), healthy };
      anonymousProbeInFlight = null;
      return healthy;
    });
  return anonymousProbeInFlight;
}

/**
 * GET /api/health
 * Without a session: only `{ status, timestamp }`, enough for Docker/Dokploy.
 * With a session (Profil > Pemeliharaan): DB latency, iSolar sync state and plant count.
 */
export async function GET(request) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    const healthy = await probeDatabaseCached();
    return NextResponse.json(
      { status: healthy ? 'healthy' : 'unhealthy', timestamp: new Date().toISOString() },
      { status: healthy ? 200 : 503, headers: NO_STORE },
    );
  }

  const startTime = Date.now();
  const now = new Date();

  // Database connectivity
  let dbStatus = 'disconnected';
  let dbLatencyMs = null;
  let dbError = null;

  try {
    const dbPingStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbPingStart;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message || 'Database query failed';
  }

  // If database is completely unreachable, container is unhealthy (503)
  if (dbStatus !== 'connected') {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: now.toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          status: dbStatus,
          error: dbError,
        },
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  }

  // Telemetry and sync health
  let lastSync = null;
  let lastSuccess = null;
  let plantCount = 0;

  try {
    const [latestRun, latestSuccessfulRun, plants] = await Promise.all([
      prisma.syncRun.findFirst({
        orderBy: { startedAt: 'desc' },
      }),
      prisma.syncRun.findFirst({
        where: { status: 'success' },
        orderBy: { finishedAt: 'desc' },
      }),
      prisma.plantLatest.count(),
    ]);

    lastSync = latestRun;
    lastSuccess = latestSuccessfulRun;
    plantCount = plants;
  } catch (err) {
    console.warn('[HealthCheck] Warning: Failed to query syncRun history:', err.message);
  }

  const lastSuccessTime = lastSuccess?.finishedAt || lastSuccess?.startedAt || null;
  const lastSuccessAgeMinutes = lastSuccessTime
    ? Math.round((now.getTime() - new Date(lastSuccessTime).getTime()) / 60_000)
    : null;

  const totalLatencyMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: now.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      latencyMs: totalLatencyMs,
      database: {
        status: 'connected',
        latencyMs: dbLatencyMs,
      },
      solarSync: {
        status: lastSync?.status || 'idle',
        lastAttemptAt: lastSync?.startedAt || null,
        lastSuccessAt: lastSuccessTime,
        lastSuccessAgeMinutes,
        lastErrorCode: lastSync?.errorCode || null,
        lastErrorMessage: lastSync?.errorMessage || null,
        activePlantsInDb: plantCount,
      },
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}
