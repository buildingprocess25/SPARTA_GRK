import { NextResponse } from 'next/server';

/**
 * Route guard for the 2-account login (see src/lib/auth.js). Runs on the
 * Edge runtime, so it can't use Node's `crypto` module - session token
 * verification here is reimplemented with Web Crypto (HMAC-SHA256), kept in
 * sync with createSessionToken()'s signing scheme in src/lib/auth.js.
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
    if (!payload?.u || !payload?.exp || Date.now() > payload.exp) return null;
    return payload.u;
  } catch (_) {
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next')
    || pathname === '/favicon.ico'
    || STATIC_FILE_PATTERN.test(pathname)
    || PUBLIC_PAGE_PATHS.has(pathname)
    || PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
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
    return NextResponse.redirect(loginUrl);
  }

  // Forward the verified username as a request header so route handlers (e.g.
  // the manual-sync mutation guard in src/lib/server/requestGuards.js) can
  // trust "this request already passed login" without re-verifying the
  // cookie themselves. Must be set on the outgoing *request*, not just the
  // response, or downstream handlers never see it.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set('x-sparta-user', username);
  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
