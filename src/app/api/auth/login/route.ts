import { NextResponse } from 'next/server';
import { findUser, verifyPassword, createSessionToken, sessionCookieOptions, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth.ts';
import { accountLockStatus, recordAuthFailure, recordAuthSuccess } from '@/lib/server/authThrottle.ts';

export const dynamic = 'force-dynamic';

function accountLockedResponse(retryAfterSec: number) {
  return NextResponse.json(
    { success: false, error: `Terlalu banyak percobaan login gagal. Akun dikunci sementara, coba lagi dalam ${retryAfterSec} detik.`, code: 'ACCOUNT_LOCKED' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  );
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    const lock = accountLockStatus('login', username);
    if (lock.locked) return accountLockedResponse(lock.retryAfterSec);

    const user = await findUser(username);
    // Always run verifyPassword (even with a dummy hash) so a wrong username
    // takes the same time as a wrong password - avoids trivially leaking
    // which accounts exist via response timing.
    const passwordOk = verifyPassword(password, user?.passwordHash || '0'.repeat(32) + ':' + '0'.repeat(128));
    if (!user || !passwordOk) {
      const failure = recordAuthFailure('login', username);
      if (failure.locked) return accountLockedResponse(failure.retryAfterSec);
      return NextResponse.json({ success: false, error: 'Username atau password salah.' }, { status: 401 });
    }
    recordAuthSuccess('login', username);

    const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
    const token = createSessionToken(user.username, { exp });
    const response = NextResponse.json({
      success: true,
      user: { username: user.username, displayName: user.displayName },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(exp));
    return response;
  } catch (error) {
    console.error('[auth/login] error:', error.message);
    return NextResponse.json({ success: false, error: 'Login gagal diproses.' }, { status: 500 });
  }
}
