import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { assertStoreModels, StoreModelsMissingError } from '@/lib/stores/storeSync.ts';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 50;

/**
 * GET /api/stores?q=&branch=&limit=
 * Active stores only. Franchise stores (F/R = F) are not operated by Alfa, so they stay out of Scope 1 input when the sheet has that column.
 */
export async function GET(request) {
  try {
    assertStoreModels(prisma);
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const branch = (searchParams.get('branch') || '').trim().toUpperCase();
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), MAX_LIMIT);

    const where = {
      isActive: true,
      ownership: { not: 'F' },
      ...(branch ? { branch } : {}),
      ...(q ? {
        OR: [
          { code: { startsWith: q.toUpperCase() } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const select = { code: true, name: true, branch: true };
    const [stores, total, branches, exact] = await Promise.all([
      prisma.storeMaster.findMany({
        where,
        select,
        orderBy: [{ branch: 'asc' }, { code: 'asc' }],
        take: limit,
      }),
      prisma.storeMaster.count({ where }),
      prisma.storeMaster.groupBy({
        by: ['branch'],
        where: { isActive: true, ownership: { not: 'F' } },
        _count: true,
        orderBy: { branch: 'asc' },
      }),
      q
        ? prisma.storeMaster.findFirst({ where: { code: q.toUpperCase(), isActive: true, ownership: { not: 'F' }, ...(branch ? { branch } : {}) }, select })
        : null,
    ]);

    // An exact code match goes first so typing "1A07" selects that store, not the first alphabetical hit.
    const ordered = exact ? [exact, ...stores.filter(store => store.code !== exact.code)].slice(0, limit) : stores;

    return NextResponse.json({
      success: true,
      stores: ordered,
      total,
      exactMatch: exact?.code || null,
      branches: branches.map(item => ({ branch: item.branch, count: item._count })),
    });
  } catch (error) {
    console.error('[API /api/stores] Error:', error);
    const message = error instanceof StoreModelsMissingError ? error.message : 'Server gagal membaca master toko.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
