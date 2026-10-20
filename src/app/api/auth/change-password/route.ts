import { NextResponse } from 'next/server';
import { findUser, verifyPassword, changePassword, verifySessionToken, SESSION_COOKIE } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

// Same per-IP throttle pattern as /api/auth/login - resets on deploy/restart,
// fine for a 2-account app.
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 8;
if (!globalThis.__AUTH_CHANGE_PW_ATTEMPTS__) globalThis.__AUTH_CHANGE_PW_ATTEMPTS__ = new Map();
const attempts = globalThis.__AUTH_CHANGE_PW_ATTEMPTS__;

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
        { success: false, error: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }

    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const sessionUsername = verifySessionToken(token);
    if (!sessionUsername) {
      return NextResponse.json({ success: false, error: 'Sesi tidak valid, silakan login ulang.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');
    const confirmPassword = String(body?.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ success: false, error: 'Semua kolom password wajib diisi.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password baru minimal 8 karakter.' }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, error: 'Konfirmasi password baru tidak cocok.' }, { status: 400 });
    }

    const user = await findUser(sessionUsername);
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json({ success: false, error: 'Password saat ini salah.' }, { status: 401 });
    }
    if (verifyPassword(newPassword, user.passwordHash)) {
      return NextResponse.json({ success: false, error: 'Password baru tidak boleh sama dengan password lama.' }, { status: 400 });
    }

    await changePassword(user.username, newPassword);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[auth/change-password] error:', error.message);
    return NextResponse.json({ success: false, error: 'Gagal mengubah password.' }, { status: 500 });
  }
}
