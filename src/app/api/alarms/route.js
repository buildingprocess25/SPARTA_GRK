import { NextResponse } from 'next/server';
import { loadActiveAlarms } from '@/lib/alarms/service.js';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const payload = await loadActiveAlarms({ limit: url.searchParams.get('limit') });
    return NextResponse.json({ success: true, data: payload }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('[alarms/route] Failed to load alarms:', error?.message || error);
    return NextResponse.json(
      { success: false, error: 'Data alarm belum dapat diperbarui.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
