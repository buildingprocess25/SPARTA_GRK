import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.ts';
import { buildRowEntry, SOURCE_KIND } from '@/lib/scope3/travelTemplate.ts';

export const dynamic = 'force-dynamic';

const fail = (status, error, code) => NextResponse.json({ success: false, error, code }, { status });

/**
 * POST /api/scope3/entries (JSON)
 * One manual business-travel row: { date, kuu, kind: PESAWAT|LAINNYA, route, cabin, passenger, note, amount, account }.
 * Emission is recalculated here; any value sent by the browser is ignored.
 */
export async function POST(request) {
  const decision = mutationDecisionForRequest(request);
  if (!decision.allowed) {
    return fail(decision.status, decision.message || 'Mode hanya-baca aktif; input data dinonaktifkan di server ini.', decision.code);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'Body harus JSON.', 'INVALID_JSON');
  }

  const result = buildRowEntry(body ?? {}, {
    journalCode: `MAN-${crypto.randomUUID()}`,
    sourceFile: 'Input manual',
    journalType: SOURCE_KIND.MANUAL,
  });
  if (result.error) return fail(422, `Data belum benar: ${result.error}.`, 'INVALID_ENTRY');

  try {
    const saved = await prisma.businessTravelEntry.create({ data: result.entry });
    return NextResponse.json({ success: true, entry: saved });
  } catch (error) {
    console.error('[API /api/scope3/entries] Error:', error);
    return fail(500, error.message || 'Gagal menyimpan', 'SAVE_FAILED');
  }
}
