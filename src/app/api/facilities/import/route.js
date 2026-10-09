import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.js';
import { getGridEmissionFactor, getGridEmissionFactorDetails } from '@/lib/carbon/carbonEngine';

/**
 * POST /api/facilities/import
 * Handles validation, preview, duplicate detection, and batch import into FacilityMaster.
 *
 * Request Body:
 * {
 *   mode: 'PREVIEW' | 'COMMIT',
 *   records: Array<FacilityInputObject>,
 *   defaultVerificationStatus: 'VERIFIED' | 'UNVERIFIED'
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { mode = 'PREVIEW', records = [], defaultVerificationStatus = 'UNVERIFIED' } = body;

    if (String(mode).toUpperCase() === 'COMMIT') {
      const mutationDecision = mutationDecisionForRequest(request);
      if (!mutationDecision.allowed) {
        return NextResponse.json({
          success: false,
          error: mutationDecision.message || mutationDecision.code,
          message: mutationDecision.message || 'Mode hanya-baca aktif; operasi ini dinonaktifkan di server ini.',
          code: mutationDecision.code
        }, { status: mutationDecision.status });
      }
    }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, error: 'Records array must not be empty' }, { status: 400 });
    }

    // 1. Fetch existing facilities to check duplicates
    const existingFacilities = await prisma.facilityMaster.findMany({
      select: { id: true, code: true, name: true, verificationStatus: true }
    });
    const existingCodes = new Set(existingFacilities.map(f => f.code.toUpperCase()));
    const existingIds = new Set(existingFacilities.map(f => f.id));

    // 2. Validate and categorize incoming records
    const validationResults = [];
    const validToImport = [];
    let duplicateCount = 0;
    let invalidCount = 0;

    for (let index = 0; index < records.length; index++) {
      const rec = records[index];
      const errors = [];
      const warnings = [];

      // Required fields
      if (!rec.code || String(rec.code).trim() === '') {
        errors.push('Facility code is missing');
      }
      if (!rec.name || String(rec.name).trim() === '') {
        errors.push('Facility name is missing');
      }
      if (!rec.facilityType) {
        errors.push('Facility type is missing');
      }

      const cleanCode = rec.code ? String(rec.code).trim().toUpperCase() : '';
      const cleanType = rec.facilityType ? String(rec.facilityType).trim().toUpperCase() : 'OTHER';
      const facilityId = rec.id || `FAC-${cleanType}-${cleanCode.replace(/[^A-Z0-9]/g, '_')}`;

      // Duplicate check
      const isDuplicateCode = existingCodes.has(cleanCode);
      const isDuplicateId = existingIds.has(facilityId);
      if (isDuplicateCode || isDuplicateId) {
        duplicateCount++;
        warnings.push(`Existing record detected (${cleanCode}). Will be updated if committed.`);
      }

      // Grid factor lookup
      const factorObj = getGridEmissionFactorDetails(rec.gridRegion || rec.region || 'JAMALI');
      const finalFactor = rec.gridEmissionFactor !== undefined ? Number(rec.gridEmissionFactor) : factorObj.factor;

      // Provenance checking: mark as unverified if missing reputable source
      let verificationStatus = rec.verificationStatus || defaultVerificationStatus;
      if (!rec.sourceMaster || rec.sourceMaster.includes('SYNTHETIC') || rec.sourceMaster.includes('GENERATED')) {
        verificationStatus = 'UNVERIFIED';
        warnings.push('Record source indicates synthetic or generated data. Marked as UNVERIFIED.');
      }

      const isValid = errors.length === 0;
      if (!isValid) invalidCount++;

      const parsedRecord = {
        id: facilityId,
        code: cleanCode,
        name: String(rec.name).trim(),
        facilityType: cleanType,
        branchId: rec.branchId || 'BR-HO',
        branchName: rec.branchName || 'Head Office / Regional',
        region: rec.region || 'Jawa',
        province: rec.province || 'Banten',
        city: rec.city || 'Tangerang',
        address: rec.address || '',
        gridRegion: rec.gridRegion || factorObj.gridName || 'JAMALI',
        gridEmissionFactor: finalFactor,
        timezone: rec.timezone || 'Asia/Jakarta',
        isActive: rec.isActive !== undefined ? Boolean(rec.isActive) : true,
        verificationStatus,
        sourceMaster: rec.sourceMaster || 'EXCEL_CSV_IMPORT',
        sourceRef: rec.sourceRef || `Batch Import Row ${index + 1}`,
        meterType: rec.meterType || 'DEDICATED',
        sharedMeterCoverage: rec.sharedMeterCoverage || null
      };

      validationResults.push({
        row: index + 1,
        isValid,
        errors,
        warnings,
        record: parsedRecord
      });

      if (isValid) {
        validToImport.push(parsedRecord);
      }
    }

    // If PREVIEW mode, return validation report without committing to database
    if (mode === 'PREVIEW') {
      return NextResponse.json({
        success: true,
        mode: 'PREVIEW',
        summary: {
          totalSubmitted: records.length,
          validCount: validToImport.length,
          invalidCount,
          duplicateCount,
          verifiedCandidateCount: validToImport.filter(r => r.verificationStatus === 'VERIFIED').length,
          unverifiedCandidateCount: validToImport.filter(r => r.verificationStatus === 'UNVERIFIED').length
        },
        details: validationResults
      });
    }

    // COMMIT mode: Upsert valid records to database
    let importedCount = 0;
    let updatedCount = 0;

    for (const item of validToImport) {
      const exists = existingIds.has(item.id) || existingCodes.has(item.code);
      await prisma.facilityMaster.upsert({
        where: { id: item.id },
        create: item,
        update: item
      });

      if (exists) updatedCount++;
      else importedCount++;
    }

    const currentTotalInDb = await prisma.facilityMaster.count();

    return NextResponse.json({
      success: true,
      mode: 'COMMIT',
      summary: {
        totalSubmitted: records.length,
        importedCount,
        updatedCount,
        failedCount: invalidCount,
        currentTotalInDb
      },
      details: validationResults
    });
  } catch (error) {
    console.error('[Facilities Import Error]:', error);
    return NextResponse.json({ success: false, error: 'Import fasilitas gagal.', code: error?.code || 'FACILITY_IMPORT_FAILED' }, { status: 500 });
  }
}
