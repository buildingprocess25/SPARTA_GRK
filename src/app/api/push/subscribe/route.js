import { NextResponse } from 'next/server';
import { saveSubscription } from '@/lib/push.js';

export async function POST(request) {
  try {
    // request is behind the login wall (middleware.js) - x-sparta-user is
    // guaranteed present and trustworthy by the time this handler runs.
    const username = request.headers.get('x-sparta-user') || 'unknown';
    const body = await request.json().catch(() => ({}));
    const userAgent = request.headers.get('user-agent') || null;

    await saveSubscription({ username, subscription: body?.subscription, userAgent });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[push/subscribe] error:', error.message);
    return NextResponse.json({ success: false, error: 'Gagal menyimpan langganan notifikasi.' }, { status: 500 });
  }
}
