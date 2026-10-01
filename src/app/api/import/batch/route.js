import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseAndValidateUpload, commitBatchToDatabase } from '@/lib/importers/batchUploadProcessor';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.js';

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
        category,
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
          return NextResponse.json({ success: false, error: mutationDecision.code, code: mutationDecision.code }, { status: mutationDecision.status });
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
      const body = await request.json();
      const { records, category, filename, allowPartial, isDraft, mode } = body;

      if (String(mode).toUpperCase() !== 'COMMIT') {
        return NextResponse.json(
          { success: false, error: 'Mode JSON harus COMMIT setelah preview tervalidasi.', code: 'INVALID_IMPORT_MODE' },
          { status: 400 }
        );
      }

      const mutationDecision = mutationDecisionForRequest(request);
      if (!mutationDecision.allowed) {
        return NextResponse.json({ success: false, error: mutationDecision.code, code: mutationDecision.code }, { status: mutationDecision.status });
      }

      if (!records || !Array.isArray(records)) {
        return NextResponse.json(
          { success: false, error: 'Array records wajib disertakan dalam format JSON.' },
          { status: 400 }
        );
      }

      if (!category) {
        return NextResponse.json(
          { success: false, error: 'Kategori wajib disertakan.' },
          { status: 400 }
        );
      }

      const commitResult = await commitBatchToDatabase({
        records,
        category,
        filename: filename || 'batch_import.xlsx',
        allowPartial: !!allowPartial,
        isDraft: !!isDraft
      });

      return NextResponse.json({
        success: true,
        mode: mode || 'COMMIT',
        ...commitResult
      });
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
        error: err.message || 'Terjadi kesalahan pada server saat memproses batch import.'
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const moduleFilter = searchParams.get('module');

    const where = {};
    if (moduleFilter) {
      where.module = moduleFilter;
    }

    const batches = await prisma.importBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return NextResponse.json({
      success: true,
      batches
    });
  } catch (err) {
    console.error('[API /api/import/batch GET] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal mengambil riwayat import batch.' },
      { status: 500 }
    );
  }
}
