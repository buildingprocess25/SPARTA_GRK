import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.js';
import { parseIsolarMonthlyReport } from '@/lib/importers/isolarMonthlyReport.js';
import { createPrismaMonthlyImportRepository, importIsolarMonthlyReport } from '@/lib/importers/isolarMonthlyImport.js';
import {
  closedMonthReport,
  energyFlowRowsFromDecisions,
  isReportRestatement,
  openMonthCutoff,
  upsertEnergyFlowRows,
} from '@/lib/importers/energyFlowImport.js';
import { revalidatePltsDashboardCache } from '@/lib/solar/dashboardService';
import { invalidateSummarizeCache } from '@/lib/solar/summarize';

export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const fail = (status, error, code) => NextResponse.json({ success: false, error, code }, { status });

/**
 * POST /api/plts/import-report (multipart, field "file")
 * Imports an iSolarCloud "Monthly Report" CSV into monthly_yield_observation, monthly_yield and energy_flow_monthly.
 */
export async function POST(request) {
  const decision = mutationDecisionForRequest(request);
  if (!decision.allowed) {
    return fail(decision.status, decision.message || 'Mode hanya-baca aktif; import dinonaktifkan di server ini.', decision.code);
  }

  let file;
  try {
    file = (await request.formData()).get('file');
  } catch {
    return fail(400, 'Permintaan harus berupa form upload dengan field "file".', 'INVALID_FORM');
  }
  if (!file || typeof file === 'string') return fail(400, 'File CSV belum dipilih.', 'FILE_REQUIRED');
  if (!/\.csv$/i.test(file.name)) return fail(400, 'File harus berformat .csv (Monthly Report dari portal iSolarCloud).', 'INVALID_EXTENSION');
  if (file.size > MAX_FILE_BYTES) return fail(413, 'Ukuran file melebihi 2 MB.', 'FILE_TOO_LARGE');

  let report;
  try {
    report = parseIsolarMonthlyReport(Buffer.from(await file.arrayBuffer()), { filename: file.name });
  } catch (error) {
    return fail(422, `File tidak dikenali sebagai Monthly Report iSolarCloud: ${error.message}`, 'INVALID_REPORT');
  }

  const now = new Date();
  const cutoff = openMonthCutoff({ now, filename: file.name });
  const closed = closedMonthReport(report, cutoff);
  if (closed.summary.validCount === 0) {
    return fail(422, 'File ini belum berisi bulan yang sudah selesai. Unduh ulang laporan setelah bulan berakhir.', 'NO_CLOSED_MONTHS');
  }
  if (closed.summary.errorCount > 0) {
    const sample = closed.records.filter(record => record.status === 'ERROR').slice(0, 3).map(record => `baris ${record.lineNumber}: ${record.problem}`);
    return fail(422, `File berisi ${closed.summary.errorCount} baris yang tidak valid (${sample.join('; ')}). Tidak ada data yang disimpan.`, 'REPORT_ROW_ERRORS');
  }

  try {
    const result = await importIsolarMonthlyReport({
      report: closed,
      repository: createPrismaMonthlyImportRepository(prisma),
      commit: true,
      now,
    });
    const flowRows = energyFlowRowsFromDecisions(result.preview.decisions);
    await upsertEnergyFlowRows(prisma, flowRows, now);

    revalidatePltsDashboardCache({ backgroundPreWarm: true });
    invalidateSummarizeCache();

    const months = [...new Set(flowRows.map(row => row.yearMonth))].sort();
    return NextResponse.json({
      success: true,
      fileName: file.name,
      reportYear: report.reportYear,
      duplicateFile: result.duplicateFile,
      months,
      plantMonthsSaved: flowRows.length,
      skippedOpenMonthRows: closed.openMonthRecords,
      reconciliation: result.preview.summary,
      restatementsKept: result.preview.conflicts.filter(isReportRestatement).slice(0, 20).map(item => ({
        yearMonth: item.record.storageYearMonth,
        plantName: item.record.plantNameRaw,
        reportKwh: item.record.energyKwh,
        savedKwh: item.previousEnergyKwh,
      })),
    });
  } catch (error) {
    console.error('[API /api/plts/import-report] Import failed:', error);
    return fail(500, `Import gagal: ${error.message}. Upload ulang file yang sama aman dilakukan.`, 'IMPORT_FAILED');
  }
}
