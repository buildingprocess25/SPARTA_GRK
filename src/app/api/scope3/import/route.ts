import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.js';
import { processTravelUpload, TravelImportError } from '@/lib/scope3/travelImport.js';

export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const fail = (status, error, code) => NextResponse.json({ success: false, error, code }, { status });

/**
 * POST /api/scope3/import (multipart: file, mode=PREVIEW|COMMIT, allowPartial=true|false)
 * Accepts the Scope 3 template or a BPDL journal export, as .xlsx, .xls or .csv.
 */
export async function POST(request) {
  const decision = mutationDecisionForRequest(request);
  if (!decision.allowed) {
    return fail(decision.status, decision.message || 'Mode hanya-baca aktif; import dinonaktifkan di server ini.', decision.code);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return fail(400, 'Permintaan harus berupa form upload dengan field "file".', 'INVALID_FORM');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') return fail(400, 'File belum dipilih.', 'FILE_REQUIRED');
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return fail(400, 'File harus .xlsx, .xls, atau .csv.', 'INVALID_EXTENSION');
  if (file.size > MAX_FILE_BYTES) return fail(413, 'Ukuran file melebihi 5 MB.', 'FILE_TOO_LARGE');

  try {
    const result = await processTravelUpload(prisma, Buffer.from(await file.arrayBuffer()), {
      fileName: file.name,
      mode: form.get('mode') === 'COMMIT' ? 'COMMIT' : 'PREVIEW',
      allowPartial: form.get('allowPartial') === 'true',
    });
    return NextResponse.json({ success: true, fileName: file.name, ...result });
  } catch (error) {
    if (error instanceof TravelImportError) return fail(422, error.message, 'INVALID_FILE');
    console.error('[API /api/scope3/import] Error:', error);
    return fail(500, error.message || 'Import gagal', 'IMPORT_FAILED');
  }
}
