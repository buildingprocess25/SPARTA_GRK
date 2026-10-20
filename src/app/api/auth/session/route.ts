import { NextResponse } from 'next/server';
import { createSessionToken, readSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth.ts';
import { SESSION_IDLE_TIMEOUT_MS } from '@/lib/sessionPolicy.ts';

export const dynamic = 'force-dynamic';

// Remaining idle time is returned as a duration, not a timestamp, so a browser whose clock is off still counts down correctly.
function sessionBody(payload) {
  return { success: true, idleRemainingMs: Math.max(0, payload.act + SESSION_IDLE_TIMEOUT_MS - Date.now()) };
}

function unauthenticated() {
  const response = NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}

/** Reads the session without extending it. */
export async function GET(request) {
  const payload = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  return payload ? NextResponse.json(sessionBody(payload)) : unauthenticated();
}

/**
 * Extends the idle window. Only the browser idle guard calls this, and only after real input (pointer, key, scroll),
 * so background polling such as the alarm feed never keeps an unattended session alive.
 */
export async function POST(request) {
  const payload = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!payload) return unauthenticated();
  const token = createSessionToken(payload.u, { exp: payload.exp });
  const response = NextResponse.json(sessionBody({ ...payload, act: Date.now() }));
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(payload.exp));
  return response;
}
