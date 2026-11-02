import { NextResponse } from 'next/server';
import { isSessionPayloadActive, nextDailyCutoff } from './lib/sessionPolicy.ts';
import { createIpGuard, getClientIp, trafficConfigFromEnv, trafficTierForPath } from './lib/server/ipGuard.ts';
import type { IpGuard } from './lib/server/ipGuard.ts';

/**
 * Route guard for the 2-account login (see src/lib/auth.ts). Runs on the
 * Edge runtime, so it can't use Node's `crypto` module - session token
 * verification here is reimplemented with Web Crypto (HMAC-SHA256), kept in
 * sync with createSessionToken()'s signing scheme in src/lib/auth.ts.
 */

const SESSION_COOKIE = 'sparta_session';

const PUBLIC_PAGE_PATHS = new Set(['/login']);
const PUBLIC_API_PREFIXES = [
  '/api/auth/',       // login/logout/me themselves
  '/api/health',      // Docker HEALTHCHECK has no session cookie
  '/api/cron/',        // authenticated separately via CRON_SECRET bearer token
  '/api/plts/revalidate', // authenticated separately via REVALIDATE_SECRET_TOKEN
];
const STATIC_FILE_PATTERN = /\.(png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|woff2?|ttf)$/i;
const FORWARDED_USER_HEADER = 'x-sparta-user';

const trafficConfig = trafficConfigFromEnv(process.env);
const globalGuard = globalThis as typeof globalThis & { __SPARTA_IP_GUARD__?: IpGuard };
const ipGuard = globalGuard.__SPARTA_IP_GUARD__ ??= createIpGuard();

function rejectTraffic(pathname: string, retryAfterSec: number, code: 'IP_BLOCKED' | 'RATE_LIMITED') {
  const headers = { 'Retry-After': String(retryAfterSec), 'Cache-Control': 'no-store' };
  const error = code === 'IP_BLOCKED'
    ? 'Akses dari alamat IP ini diblokir sementara karena trafik berlebihan.'
    : 'Terlalu banyak permintaan. Coba lagi sebentar lagi.';
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error, code }, { status: 429, headers });
  }
  return new NextResponse(error, { status: 429, headers });
}

function guardTraffic(request, pathname: string) {
  const ip = getClientIp(request.headers, trafficConfig.trustedProxyHops);
  // No proxy header means a direct local call (Docker HEALTHCHECK, dev server); there is no client IP to judge.
  if (ip === 'unknown' || trafficConfig.allowlist.has(ip)) return null;
  if (trafficConfig.blockedIps.has(ip)) return rejectTraffic(pathname, 3600, 'IP_BLOCKED');

  const tier = trafficTierForPath(pathname);
  const decision = ipGuard.check(tier, ip, trafficConfig.rules[tier]);
  if (decision.allowed) return null;
  if (decision.newlyBanned) {
    console.warn(`[ip-guard] ${ip} diblokir ${Math.round(decision.retryAfterSec / 60)} menit: batas trafik "${tier}" terlampaui berulang (${pathname})`);
  }
  return rejectTraffic(pathname, decision.retryAfterSec, decision.banned ? 'IP_BLOCKED' : 'RATE_LIMITED');
}

function base64urlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifySessionTokenEdge(token, secret) {
  if (!token || !secret || !token.includes('.')) return null;
  const [payloadStr, signature] = token.split('.');
  if (!payloadStr || !signature) return null;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify('HMAC', key, base64urlToBytes(signature), new TextEncoder().encode(payloadStr));
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadStr)));
    return isSessionPayloadActive(payload) ? payload.u : null;
  } catch (_) {
    return null;
  }
}

// Only picks the login banner text; access was already denied by the verified check above, so the payload is not trusted here.
function expiredByCutoff(token) {
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(String(token).split('.')[0])));
    return Boolean(payload?.act) && Date.now() >= nextDailyCutoff(payload.act);
  } catch (_) {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico' || STATIC_FILE_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  const rejected = guardTraffic(request, pathname);
  if (rejected) return rejected;

  if (PUBLIC_PAGE_PATHS.has(pathname) || PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    // Public routes skip the session check, so a client-sent identity header must not reach them.
    if (!request.headers.has(FORWARDED_USER_HEADER)) return NextResponse.next();
    const strippedHeaders = new Headers(request.headers);
    strippedHeaders.delete(FORWARDED_USER_HEADER);
    return NextResponse.next({ request: { headers: strippedHeaders } });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const username = await verifySessionTokenEdge(token, process.env.AUTH_SESSION_SECRET || '');

  if (!username) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.', code: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    if (token && expiredByCutoff(token)) loginUrl.searchParams.set('reason', 'cutoff');
    return NextResponse.redirect(loginUrl);
  }

  // Forward the verified username as a request header so route handlers (e.g.
  // the manual-sync mutation guard in src/lib/server/requestGuards.ts) can
  // trust "this request already passed login" without re-verifying the
  // cookie themselves. Must be set on the outgoing *request*, not just the
  // response, or downstream handlers never see it.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(FORWARDED_USER_HEADER, username);
  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
