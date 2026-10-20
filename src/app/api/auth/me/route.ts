import { NextResponse } from 'next/server';
import { findUser, verifySessionToken, SESSION_COOKIE } from '@/lib/auth.js';

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const username = verifySessionToken(token);
  if (!username) {
    return NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const user = await findUser(username);
  if (!user) {
    return NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  return NextResponse.json({ success: true, user: { username: user.username, displayName: user.displayName } });
}
