import { NextResponse } from 'next/server';
import { summarizePlts } from '@/lib/solar/summarize';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || undefined;
    const grid = searchParams.get('grid') || undefined;
    const dc = searchParams.get('dc') || undefined;
    const compare = searchParams.get('compare');
    const compareYears = compare
      ? compare.split(',').map(Number).filter(Number.isInteger)
      : undefined;
    const comparisonThroughMonth = searchParams.get('throughMonth')
      ? Number(searchParams.get('throughMonth'))
      : undefined;

    const data = await summarizePlts({ period, grid, dc, compareYears, comparisonThroughMonth });
    
    return NextResponse.json({
      success: true,
      data
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      }
    });
  } catch (error) {
    console.error('[API Overview PLTS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
