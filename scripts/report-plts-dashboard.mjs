import prisma from '../src/lib/prisma.js';
import { getPltsDashboard } from '../src/lib/solar/dashboardService.js';

try {
  const data = await getPltsDashboard({
    period: process.argv[2] || '2026-01_2026-09',
    mode: process.argv[3] || 'YTD',
    throughMonth: process.argv[4] || '9',
    compare: '2025,2026',
  });
  console.log(JSON.stringify({
    summary: data.summary,
    months: data.monthly,
    conflictCount: data.conflicts.length,
    conflicts: data.conflicts,
    yoy: data.yoy,
    support: data.support,
    plantCount: data.plants.length,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
