import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/health
 * Production healthcheck endpoint for Dokploy / Docker container monitoring.
 * Verifies:
 * 1. Database connectivity & query latency (PostgreSQL via Prisma)
 * 2. iSolar sync engine status (latest attempt, latest success, data age)
 * 3. Total active DC plants stored in database
 */
export async function GET() {
  const startTime = Date.now();
  const now = new Date();

  // 1. Database Connectivity Check
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

  // 2. Telemetry & Sync Health Inspection
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
