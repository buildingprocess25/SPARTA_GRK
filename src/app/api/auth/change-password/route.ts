import { NextResponse } from 'next/server';
import { findUser, verifyPassword, changePassword, verifySessionToken, SESSION_COOKIE } from '@/lib/auth.ts';
import { accountLockStatus, recordAuthFailure, recordAuthSuccess } from '@/lib/server/authThrottle.ts';

export const dynamic = 'force-dynamic';

function accountLockedResponse(retryAfterSec: number) {
  return NextResponse.json(
    { success: false, error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${retryAfterSec} detik.`, code: 'ACCOUNT_LOCKED' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  );
}

export async function POST(request) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const sessionUsername = verifySessionToken(token);
    if (!sessionUsername) {
      return NextResponse.json({ success: false, error: 'Sesi tidak valid, silakan login ulang.' }, { status: 401 });
    }

    const lock = accountLockStatus('change-password', sessionUsername);
    if (lock.locked) return accountLockedResponse(lock.retryAfterSec);

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
      const failure = recordAuthFailure('change-password', sessionUsername);
      if (failure.locked) return accountLockedResponse(failure.retryAfterSec);
      return NextResponse.json({ success: false, error: 'Password saat ini salah.' }, { status: 401 });
    }
    recordAuthSuccess('change-password', sessionUsername);
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
