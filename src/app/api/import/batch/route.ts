import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseAndValidateUpload, commitBatchToDatabase } from '@/lib/importers/batchUploadProcessor';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.js';
import { normalizeImportHistoryLimit } from '@/lib/importers/importContracts.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle Multipart Form Data (File Upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const category = formData.get('category');
      const mode = formData.get('mode') || 'PREVIEW'; // 'PREVIEW' or 'COMMIT'
      const allowPartial = formData.get('allowPartial') === 'true' || formData.get('allowPartial') === true;
      const isDraft = formData.get('isDraft') === 'true' || formData.get('isDraft') === true;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'File wajib diunggah.' },
          { status: 400 }
        );
      }

      if (!category) {
        return NextResponse.json(
          { success: false, error: 'Kategori template wajib dipilih (GENSET, VEHICLE, PLN, PLTS, WATER).' },
          { status: 400 }
        );
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const filename = file.name || 'uploaded_file.xlsx';

      // Always parse and validate on server
      const validationResult = await parseAndValidateUpload(fileBuffer, {
        categoryHint: category,
        filename
      });

      if (!validationResult.success) {
        return NextResponse.json(
          { success: false, error: validationResult.error },
          { status: 400 }
        );
      }

      // If PREVIEW mode, return parsed and validated records with summary
      if (mode === 'PREVIEW') {
        return NextResponse.json({
          success: true,
          mode: 'PREVIEW',
          ...validationResult
        });
      }

      // If COMMIT mode, execute idempotent database transactions
      if (mode === 'COMMIT') {
        const mutationDecision = mutationDecisionForRequest(request);
        if (!mutationDecision.allowed) {
          return NextResponse.json({
            success: false,
            error: mutationDecision.message || mutationDecision.code,
            message: mutationDecision.message || 'Mode hanya-baca aktif; operasi ini dinonaktifkan di server ini.',
            code: mutationDecision.code
          }, { status: mutationDecision.status });
        }
        const commitResult = await commitBatchToDatabase({
          records: validationResult.records,
          category,
          filename,
          allowPartial,
          isDraft
        });

        return NextResponse.json({
          success: true,
          mode: 'COMMIT',
          ...commitResult
        });
      }
    }

    // Handle JSON payload (for direct commit after client preview)
    if (contentType.includes('application/json')) {
      return NextResponse.json({ success: false, error: 'Unggah ulang file agar server menghitung dan memvalidasi data.', code: 'JSON_COMMIT_DISABLED' }, { status: 415 });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported Content-Type. Use multipart/form-data or application/json.' },
      { status: 415 }
    );
  } catch (err) {
    console.error('[API /api/import/batch] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Terjadi kesalahan pada server saat memproses batch import.', code: err?.code || 'IMPORT_FAILED'
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = normalizeImportHistoryLimit(searchParams.get('limit'));
    const moduleFilter = searchParams.get('module');

    // Deleted uploads stay in import_batch as an audit trail but are hidden unless asked for.
    const where = searchParams.get('includeDeleted') === 'true' ? {} : { status: { not: 'DELETED' } };
    if (moduleFilter) {
      where.module = { in: moduleFilter.split(',').map((value) => value.trim()).filter(Boolean) };
    }

    const batches = await prisma.importBatch.findMany({
      where,
      orderBy: { importedAt: 'desc' },
      take: limit
    });

    return NextResponse.json({
      success: true,
      batches
    });
  } catch (err) {
    console.error('[API /api/import/batch GET] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil riwayat import batch.', code: err?.code || 'IMPORT_HISTORY_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/import/batch?id=BATCH-...
 * Removes every row an Excel upload created. The import_batch row is kept with status DELETED for the audit trail.
 */
export async function DELETE(request) {
  const mutationDecision = mutationDecisionForRequest(request);
  if (!mutationDecision.allowed) {
    return NextResponse.json({ success: false, error: mutationDecision.message || mutationDecision.code, code: mutationDecision.code }, { status: mutationDecision.status });
  }

  const id = new URL(request.url).searchParams.get('id') || '';
  // Only Excel uploads from this route carry BATCH- ids; iSolar and legacy imports are linked differently and are not deletable here.
  if (!id.startsWith('BATCH-')) {
    return NextResponse.json({ success: false, error: 'ID upload tidak valid.', code: 'INVALID_BATCH_ID' }, { status: 400 });
  }

  try {
    const batch = await prisma.importBatch.findUnique({ where: { id } });
    if (!batch) return NextResponse.json({ success: false, error: 'Upload tidak ditemukan.', code: 'BATCH_NOT_FOUND' }, { status: 404 });
    if (batch.status === 'DELETED') return NextResponse.json({ success: false, error: 'Upload ini sudah dihapus.', code: 'BATCH_ALREADY_DELETED' }, { status: 409 });

    const deletedBy = request.headers.get('x-sparta-user') || null;
    const deletedRows = await prisma.$transaction(async (tx) => {
      const [fuel, energy, water] = await Promise.all([
        tx.fuelActivity.deleteMany({ where: { batchId: id } }),
        tx.energyMeasurement.deleteMany({ where: { batchId: id } }),
        tx.waterActivity.deleteMany({ where: { batchId: id } }),
      ]);
      const total = fuel.count + energy.count + water.count;
      await tx.importBatch.update({
        where: { id },
        data: {
          status: 'DELETED',
          metadata: { ...(batch.metadata || {}), deletedAt: new Date().toISOString(), deletedBy, deletedRows: total, statusBeforeDelete: batch.status },
        },
      });
      return total;
    });

    return NextResponse.json({ success: true, id, filename: batch.filename, deletedRows });
  } catch (err) {
    console.error('[API /api/import/batch DELETE] Error:', err);
    return NextResponse.json({ success: false, error: 'Upload gagal dihapus. Tidak ada data yang berubah.', code: err?.code || 'BATCH_DELETE_FAILED' }, { status: 500 });
  }
}
