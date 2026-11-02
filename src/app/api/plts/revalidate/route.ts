import { NextResponse } from 'next/server';
import { createIpGuard, getClientIp, safeEqual, trafficConfigFromEnv } from '@/lib/server/ipGuard.ts';
import type { IpGuard } from '@/lib/server/ipGuard.ts';
import { revalidatePltsDashboardCache, PLTS_CACHE_TAG } from '@/lib/solar/dashboardService';

export const dynamic = 'force-dynamic';

const REVALIDATE_RULE = { windowMs: 60_000, max: 20, strikesToBan: 3, strikeWindowMs: 10 * 60_000, banMs: 2 * 60_000 };
const globalRevalidate = globalThis as typeof globalThis & { __PLTS_REVALIDATE_GUARD__?: IpGuard };
const revalidateGuard = globalRevalidate.__PLTS_REVALIDATE_GUARD__ ??= createIpGuard({ maxBuckets: 2_000, maxBans: 500 });

function extractToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const customHeader = request.headers.get('x-revalidate-token') || request.headers.get('x-cron-secret');
  if (customHeader) {
    return customHeader.trim();
  }
  return '';
}

export async function POST(request) {
  try {
    const clientIp = getClientIp(request.headers, trafficConfigFromEnv(process.env).trustedProxyHops);
    const limit = revalidateGuard.check('revalidate', clientIp, REVALIDATE_RULE);

    if (!limit.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Too many revalidation requests. Please wait a moment.',
        code: 'RATE_LIMIT_EXCEEDED',
      }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(limit.retryAfterSec) },
      });
    }

    const expectedSecret = process.env.REVALIDATE_SECRET_TOKEN || process.env.CRON_SECRET || '';
    if (!expectedSecret) {
      return NextResponse.json({
        success: false,
        error: 'Revalidation is not configured on this server.',
        code: 'REVALIDATE_NOT_CONFIGURED',
      }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const providedToken = extractToken(request);

    if (!providedToken || !safeEqual(providedToken, expectedSecret)) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized: Invalid or missing revalidation secret token.',
        code: 'UNAUTHORIZED',
      }, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const url = new URL(request.url);
    const tag = url.searchParams.get('tag') || PLTS_CACHE_TAG;

    revalidatePltsDashboardCache({ backgroundPreWarm: true });

    return NextResponse.json({
      success: true,
      revalidated: true,
      tag,
      timestamp: Date.now(),
      message: 'PLTS server dashboard cache invalidated and pre-warming initiated.',
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal merevalidasi cache PLTS',
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}

export async function GET(request) {
  // Reject public unauthenticated browser GET requests
  return NextResponse.json({
    success: false,
    error: 'Method Not Allowed. Revalidation requires authenticated POST.',
    code: 'METHOD_NOT_ALLOWED',
  }, {
    status: 405,
    headers: {
      'Cache-Control': 'no-store',
      'Allow': 'POST',
    },
  });
}
