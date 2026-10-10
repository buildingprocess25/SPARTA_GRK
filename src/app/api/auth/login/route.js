import { NextResponse } from 'next/server';
import { findUser, verifyPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

// In-memory per-IP throttle. Resets on deploy/restart - fine for a 2-account
// login, not meant to survive a multi-instance deployment.
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 8;
if (!globalThis.__AUTH_LOGIN_ATTEMPTS__) globalThis.__AUTH_LOGIN_ATTEMPTS__ = new Map();
const attempts = globalThis.__AUTH_LOGIN_ATTEMPTS__;

function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attempts.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_ATTEMPTS;
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    const user = await findUser(username);
    // Always run verifyPassword (even with a dummy hash) so a wrong username
    // takes the same time as a wrong password - avoids trivially leaking
    // which accounts exist via response timing.
    const passwordOk = verifyPassword(password, user?.passwordHash || '0'.repeat(32) + ':' + '0'.repeat(128));
    if (!user || !passwordOk) {
      return NextResponse.json({ success: false, error: 'Username atau password salah.' }, { status: 401 });
    }

    const token = createSessionToken(user.username);
    const response = NextResponse.json({
      success: true,
      user: { username: user.username, displayName: user.displayName },
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('[auth/login] error:', error.message);
    return NextResponse.json({ success: false, error: 'Login gagal diproses.' }, { status: 500 });
  }
}
