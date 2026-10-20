import { NextResponse } from 'next/server';
import { removeSubscriptionByEndpoint } from '@/lib/push.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await removeSubscriptionByEndpoint(body?.endpoint);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[push/unsubscribe] error:', error.message);
    return NextResponse.json({ success: false, error: 'Gagal menghapus langganan notifikasi.' }, { status: 500 });
  }
}
