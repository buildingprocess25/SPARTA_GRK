import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.js';
import { getGridEmissionFactor, getGridEmissionFactorDetails } from '@/lib/carbon/carbonEngine';

/**
 * GET /api/facilities
 * Queries database facility master with search, filtering, and pagination.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityType = searchParams.get('facilityType') || 'all';
    const branchId = searchParams.get('branchId') || 'all';
    const verificationStatus = searchParams.get('verificationStatus') || 'all'; // 'VERIFIED', 'UNVERIFIED', 'all'
    const searchQuery = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const fetchAll = searchParams.get('all') === 'true';

    const where = {};

    if (facilityType !== 'all') {
      where.facilityType = facilityType;
    }
    if (branchId !== 'all') {
      where.branchId = branchId;
    }
    if (verificationStatus !== 'all') {
      where.verificationStatus = verificationStatus;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { province: { contains: q, mode: 'insensitive' } },
        { region: { contains: q, mode: 'insensitive' } },
        { branchName: { contains: q, mode: 'insensitive' } }
      ];
    }

    const totalCount = await prisma.facilityMaster.count({ where });

    let facilities;
    if (fetchAll) {
      facilities = await prisma.facilityMaster.findMany({
        where,
        orderBy: [{ facilityType: 'asc' }, { name: 'asc' }]
      });
    } else {
      facilities = await prisma.facilityMaster.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ facilityType: 'asc' }, { name: 'asc' }]
      });
    }

    // Aggregate statistics across full database
    const allCountsByType = await prisma.facilityMaster.groupBy({
      by: ['facilityType', 'verificationStatus'],
      _count: { id: true }
    });

    const summary = {
      total: 0,
      verifiedTotal: 0,
      unverifiedTotal: 0,
      byType: {
        HO: { verified: 0, unverified: 0, total: 0 },
        BRANCH_OFFICE: { verified: 0, unverified: 0, total: 0 },
        DC: { verified: 0, unverified: 0, total: 0 },
        WAREHOUSE: { verified: 0, unverified: 0, total: 0 },
        DEPO: { verified: 0, unverified: 0, total: 0 },
        STORE_HUB: { verified: 0, unverified: 0, total: 0 },
        STORE: { verified: 0, unverified: 0, total: 0 },
        OTHER: { verified: 0, unverified: 0, total: 0 }
      }
    };

    allCountsByType.forEach(c => {
      const type = c.facilityType || 'OTHER';
      const isVer = c.verificationStatus === 'VERIFIED';
      const count = c._count.id;

      summary.total += count;
      if (isVer) summary.verifiedTotal += count;
      else summary.unverifiedTotal += count;

      if (!summary.byType[type]) {
        summary.byType[type] = { verified: 0, unverified: 0, total: 0 };
      }
      if (isVer) summary.byType[type].verified += count;
      else summary.byType[type].unverified += count;
      summary.byType[type].total += count;
    });

    return NextResponse.json({
      success: true,
      data: facilities,
      pagination: {
        page,
        pageSize: fetchAll ? totalCount : pageSize,
        totalRecords: totalCount,
        totalPages: fetchAll ? 1 : Math.ceil(totalCount / pageSize)
      },
      summary
    });
  } catch (error) {
    console.error('[Facilities API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/facilities
 * Upsert or create single operational facility
 */
export async function POST(request) {
  const mutationDecision = mutationDecisionForRequest(request);
  if (!mutationDecision.allowed) {
    return NextResponse.json({ success: false, error: mutationDecision.code, code: mutationDecision.code }, { status: mutationDecision.status });
  }
  try {
    const body = await request.json();
    const {
      id,
      code,
      name,
      facilityType,
      branchId,
      branchName,
      region,
      province,
      city,
      address,
      gridRegion,
      gridEmissionFactor,
      timezone,
      verificationStatus,
      sourceMaster,
      sourceRef,
      meterType,
      sharedMeterCoverage
    } = body;

    if (!code || !name || !facilityType) {
      return NextResponse.json({ success: false, error: 'Code, name, and facilityType are required' }, { status: 400 });
    }

    // Default or lookup factor
    const factorObj = getGridEmissionFactorDetails(gridRegion || region || 'JAMALI');
    const finalFactor = gridEmissionFactor !== undefined ? Number(gridEmissionFactor) : factorObj.factor;

    const facilityId = id || `FAC-${facilityType}-${code.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

    const upserted = await prisma.facilityMaster.upsert({
      where: { id: facilityId },
      create: {
        id: facilityId,
        code,
        name,
        facilityType,
        branchId: branchId || 'BR-HO',
        branchName: branchName || 'Head Office / Regional',
        region: region || 'Jawa',
        province: province || 'Banten',
        city: city || 'Tangerang',
        address: address || '',
        gridRegion: gridRegion || factorObj.gridName || 'JAMALI',
        gridEmissionFactor: finalFactor,
        timezone: timezone || 'Asia/Jakarta',
        isActive: true,
        verificationStatus: verificationStatus || 'VERIFIED',
        sourceMaster: sourceMaster || 'MANUAL_ENTRY',
        sourceRef: sourceRef || 'User input via Facilities API',
        meterType: meterType || 'DEDICATED',
        sharedMeterCoverage
      },
      update: {
        name,
        facilityType,
        branchId: branchId || undefined,
        branchName: branchName || undefined,
        region: region || undefined,
        province: province || undefined,
        city: city || undefined,
        address: address || undefined,
        gridRegion: gridRegion || undefined,
        gridEmissionFactor: finalFactor,
        timezone: timezone || undefined,
        verificationStatus: verificationStatus || undefined,
        sourceMaster: sourceMaster || undefined,
        sourceRef: sourceRef || undefined,
        meterType: meterType || undefined,
        sharedMeterCoverage: sharedMeterCoverage || undefined
      }
    });

    return NextResponse.json({ success: true, data: upserted });
  } catch (error) {
    console.error('[Facilities POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
