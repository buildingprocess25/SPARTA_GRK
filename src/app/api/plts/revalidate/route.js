import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { revalidatePltsDashboardCache, PLTS_CACHE_TAG } from '@/lib/solar/dashboardService';

export const dynamic = 'force-dynamic';

// Rate Limiting Storage in globalThis
if (!globalThis.__PLTS_REVALIDATE_RATE_LIMIT__) {
  globalThis.__PLTS_REVALIDATE_RATE_LIMIT__ = new Map();
}
const rateLimitMap = globalThis.__PLTS_REVALIDATE_RATE_LIMIT__;

function checkRateLimit(clientIp) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 20;

  const timestamps = (rateLimitMap.get(clientIp) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(clientIp, timestamps);
  return true;
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Constant-time dummy comparison to mitigate timing leak
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

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
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    // 1. Rate Limiting Check
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json({
        success: false,
        error: 'Too many revalidation requests. Please wait a moment.',
        code: 'RATE_LIMIT_EXCEEDED',
      }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // 2. Security Token Verification
    const expectedSecret = process.env.REVALIDATE_SECRET_TOKEN || process.env.CRON_SECRET || 'plts_internal_secret_key_2026';
    const providedToken = extractToken(request);

    if (!providedToken || !safeCompare(providedToken, expectedSecret)) {
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

    // 3. Invalidate in-memory server cache and trigger background pre-warm
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
