import { NextResponse } from 'next/server';
import { sendPushToAll, isPushConfigured } from '@/lib/push.js';

export async function POST(request) {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { success: false, error: 'VAPID key belum dikonfigurasi di server.', code: 'VAPID_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  const username = request.headers.get('x-sparta-user') || 'seseorang';
  const result = await sendPushToAll({
    title: '🔔 Uji Coba Push Notification',
    body: `Dipicu manual oleh ${username}. Kalau ini muncul di HP kamu, push notification sudah aktif.`,
    tag: 'sparta-push-test',
    url: '/',
  });

  return NextResponse.json({ success: true, ...result });
}
