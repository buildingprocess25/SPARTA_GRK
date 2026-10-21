import { NextResponse } from 'next/server';
import { readSessionToken, SESSION_COOKIE } from '@/lib/auth.ts';
import { nextDailyCutoff } from '@/lib/sessionPolicy.ts';

export const dynamic = 'force-dynamic';

function unauthenticated() {
  const response = NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}

/**
 * Reads the session for the browser cutoff guard.
 * The time left is returned as a duration, not a timestamp, so a browser whose clock is off still counts down correctly.
 */
export async function GET(request) {
  const payload = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!payload) return unauthenticated();
  return NextResponse.json({ success: true, cutoffRemainingMs: Math.max(0, nextDailyCutoff(payload.act) - Date.now()) });
}
